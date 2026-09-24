import { projectDiagnostic } from "../project/diagnostics.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type {
  AggregateRegistryHost,
  BindingId,
  EnumType,
  ModuleGraph,
  ScalarExpressionHost,
  ScalarExpressionResult,
} from "./semantic-types.js";
import { semanticTypeName } from "./semantic-type-relations.js";
import { semanticTypesEqual } from "./semantic-type-relations.js";
import type { EnumDeclaration, Expr } from "./syntax.js";

/** Match one insertion, deletion, or substitution without a general spelling engine. */
function oneEditApart(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length >= right.length) leftIndex += 1;
    if (right.length >= left.length) rightIndex += 1;
  }
  return edits + Number(leftIndex < left.length || rightIndex < right.length) === 1;
}

/** One member value after the enum's byte-range and naming rules are checked. */
export interface ResolvedEnumMember {
  /** Nominal type of the member expression. */
  readonly type: EnumType;
  /** Compile-time byte value; aliases may have the same value. */
  readonly value: bigint;
}

/** Resolve byte-backed enum declarations without allocating runtime data. */
export class EnumTable {
  /** Types keyed by their exact qualified declaration name. */
  readonly byName = new Map<string, EnumType>();
  /** Types keyed by stable declaration identity for imported aliases. */
  readonly byBinding = new Map<string, EnumType>();
  /** Checked member values keyed by enum declaration identity. */
  readonly members = new Map<string, Map<string, bigint>>();
  /** Source members retained so forward references resolve without source-order rules. */
  private readonly declarations = new Map<
    string,
    { module: string; declaration: EnumDeclaration }
  >();
  /** Member computations in progress; a revisit proves a constant cycle. */
  private readonly evaluating = new Set<string>();
  /** Rejected member computations are remembered to avoid repeated diagnostics. */
  private readonly failed = new Set<string>();

  constructor(
    readonly graph: ModuleGraph,
    readonly host: AggregateRegistryHost,
    readonly evaluate: (expression: Expr, module: string) => bigint | null,
  ) {}

  /** Register all enum names before checking fields, signatures, and values. */
  prepare(): void {
    for (const module of this.graph.modules) {
      for (const unit of module.units) {
        for (const declaration of unit.declarations) {
          if (declaration.kind !== "enum") continue;
          const binding = this.bindingFor(module.name, declaration);
          if (binding === null) continue;
          const type: EnumType = Object.freeze({
            kind: "enum",
            name: declaration.name,
            binding,
          });
          const key = bindingIdentityKey(binding);
          this.byName.set(`${module.name}.${declaration.name}`, type);
          this.byBinding.set(key, type);
          this.members.set(key, new Map());
          this.declarations.set(key, { module: module.name, declaration });
        }
      }
    }
    for (const module of this.graph.modules) {
      for (const unit of module.units) {
        for (const declaration of unit.declarations) {
          if (declaration.kind === "enum") this.checkMembers(module.name, declaration);
        }
      }
    }
  }

  /** Resolve a local, qualified, or imported enum type name. */
  type(name: string, module: string, sourceId: string): EnumType | null {
    const direct = this.byName.get(name.includes(".") ? name : `${module}.${name}`);
    if (direct !== undefined) return direct;
    const imported = this.graph.imports.find(
      (candidate) => candidate.sourceSpan.sourceId === sourceId && candidate.alias === name,
    );
    return imported === undefined
      ? null
      : (this.byBinding.get(bindingIdentityKey(imported.binding)) ?? null);
  }

  /** Suggest only one unambiguous visible enum with a single spelling error. */
  suggestion(name: string, module: string, sourceId: string): string | null {
    const visible = [...this.byName.keys()]
      .filter((qualified) => qualified.startsWith(`${module}.`))
      .map((qualified) => qualified.slice(module.length + 1));
    for (const imported of this.graph.imports) {
      if (
        imported.sourceSpan.sourceId === sourceId &&
        this.byBinding.has(bindingIdentityKey(imported.binding))
      ) {
        visible.push(imported.alias);
      }
    }
    const matches = [...new Set(visible.filter((candidate) => oneEditApart(name, candidate)))];
    return matches.length === 1 ? matches[0]! : null;
  }

  /** Resolve a member only through its enum-qualified spelling. */
  member(
    enumName: string,
    memberName: string,
    module: string,
    sourceId: string,
  ): ResolvedEnumMember | null {
    const type = this.type(enumName, module, sourceId);
    if (type === null) return null;
    const record = this.declarations.get(bindingIdentityKey(type.binding));
    const index =
      record?.declaration.members.findIndex((member) => member.name === memberName) ?? -1;
    if (index < 0) return null;
    const value = this.evaluateMember(type, index);
    return value === null ? null : Object.freeze({ type, value });
  }

  /** Force every member once; the evaluator follows dependencies across declarations. */
  private checkMembers(module: string, declaration: EnumDeclaration): void {
    const type = this.byName.get(`${module}.${declaration.name}`);
    if (type === undefined) return;
    const seen = new Set<string>();
    for (const [index, member] of declaration.members.entries()) {
      if (seen.has(member.name)) {
        this.host.diagnose(
          projectDiagnostic(
            "E10232",
            `Duplicate enum member '${member.name}' in enum '${declaration.name}'`,
            member.nameSpan,
          ),
        );
        continue;
      }
      seen.add(member.name);
      this.evaluateMember(type, index);
    }
  }

  /** Evaluate a member lazily so an explicit value may name a later declaration. */
  private evaluateMember(type: EnumType, index: number): bigint | null {
    const bindingKey = bindingIdentityKey(type.binding);
    const record = this.declarations.get(bindingKey);
    const member = record?.declaration.members[index];
    if (record === undefined || member === undefined) return null;
    const memberKey = `${bindingKey}:${index}`;
    const cached = this.members.get(bindingKey)?.get(member.name);
    if (cached !== undefined) return cached;
    if (this.failed.has(memberKey) || this.evaluating.has(memberKey)) return null;
    this.evaluating.add(memberKey);
    let value: bigint | null;
    if (member.value !== null) {
      value = this.evaluate(member.value, record.module);
    } else if (index === 0) {
      value = 0n;
    } else {
      const previous = this.evaluateMember(type, index - 1);
      value = previous === null ? null : previous + 1n;
    }
    this.evaluating.delete(memberKey);
    if (value === null) {
      this.failed.add(memberKey);
      if (member.value !== null) {
        this.host.diagnose(
          projectDiagnostic(
            "E10230",
            `Enum member value must be a compile-time byte constant — found '${this.host.sourceText(member.value.span)}'`,
            member.value.span,
          ),
        );
      }
      return null;
    }
    if (value < 0n || value > 255n) {
      this.failed.add(memberKey);
      this.host.diagnose(
        projectDiagnostic(
          "E10233",
          `Enum member value ${value} is out of range — expected 0–255`,
          member.value?.span ?? member.nameSpan,
        ),
      );
      return null;
    }
    this.members.get(bindingKey)?.set(member.name, value);
    return value;
  }

  /** Find the graph binding for one parsed enum without depending on object identity. */
  private bindingFor(module: string, declaration: EnumDeclaration): BindingId | null {
    return (
      this.graph.bindings.find(
        (binding) =>
          binding.qualifiedName === `${module}.${declaration.name}` &&
          binding.id.sourceId === declaration.span.sourceId &&
          binding.id.span.start === declaration.span.start &&
          binding.id.span.end === declaration.span.end,
      )?.id ?? null
    );
  }
}

/** Accept only an enum value of the same declared type in an enum-typed context. */
export function applyExpectedEnum(
  result: ScalarExpressionResult,
  expected: EnumType,
  expression: Expr,
  host: ScalarExpressionHost,
): ScalarExpressionResult {
  const node = result.node;
  if (node === null) return result;
  if (semanticTypesEqual(node.type, expected)) return result;
  host.diagnose(
    projectDiagnostic(
      "E10235",
      `Cannot assign '${semanticTypeName(node.type)}' to enum '${expected.name}' — use '${expected.name}(<expr>)'`,
      expression.span,
    ),
  );
  return { node: null, exact: result.exact };
}
