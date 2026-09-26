import { projectDiagnostic } from "../project/diagnostics.js";
import type { SourceSpan } from "../project/types.js";
import { resolveAggregateDeclaration } from "./aggregate-names.js";
import { scalarSyntaxType } from "./constants.js";
import { evaluateConstant } from "./aggregate-constants.js";
import { bindingIdentityKey, semanticTypeKey } from "./semantic-types.js";
import { semanticTypeName, semanticTypeSize } from "./semantic-type-relations.js";
import { EnumTable } from "./enum-types.js";
import { buildPackedStruct, voidTypeSpan } from "./struct-types.js";
export {
  semanticTypeName,
  semanticTypeSize,
  semanticTypesEqual,
} from "./semantic-type-relations.js";
import type {
  AggregateRegistryHost,
  ArrayType,
  BindingId,
  FunctionSignature,
  ModuleGraph,
  ScalarScope,
  SemanticType,
  StructType,
} from "./semantic-types.js";
import type {
  Declaration,
  Expr,
  FunctionDeclaration,
  StructDeclaration,
  TypeSyntax,
} from "./syntax.js";

/** Resolve nominal structs and fixed arrays for one module-analysis run. */
export class AggregateRegistry {
  /** Byte-backed nominal enums prepared before other declared types. */
  readonly enums: EnumTable;
  /** Nominal struct types keyed by exact module-qualified name. */
  readonly structsByQualifiedName = new Map<string, StructType>();
  /** Nominal struct types keyed by their source declaration identity. */
  readonly structsByBinding = new Map<string, StructType>();
  /** Interned array types keyed by complete element shape and extent. */
  readonly arraysByKey = new Map<string, ArrayType>();
  /** Constant declarations currently being evaluated, used to stop dependency cycles. */
  readonly evaluatingConstants = new Set<string>();
  /** Struct declarations retained as valid work for a later aggregate slice. */
  readonly deferredStructs = new Set<string>();

  /** Prepare nominal structs before declaration headers and bodies resolve their types. */
  constructor(
    readonly graph: ModuleGraph,
    readonly declarations: ReadonlyMap<string, Declaration>,
    readonly host: AggregateRegistryHost,
  ) {
    this.enums = new EnumTable(graph, host, (expression, module) => {
      const failure = { handled: false };
      const value = evaluateConstant(this, expression, module, undefined, false, failure)?.value;
      return typeof value === "bigint" ? value : null;
    });
    this.enums.prepare();
    this.prepareStructs();
  }

  /** Return every aggregate type created during this analysis. */
  types(): readonly SemanticType[] {
    return Object.freeze([
      ...this.enums.byName.values(),
      ...this.structsByQualifiedName.values(),
      ...this.arraysByKey.values(),
    ]);
  }

  /** Return whether a struct declaration was deferred instead of rejected. */
  isDeferredStruct(binding: BindingId): boolean {
    return this.deferredStructs.has(bindingIdentityKey(binding));
  }

  /** Resolve the type published by a module declaration without reporting twice. */
  declarationType(declaration: Declaration, module: string): SemanticType | null {
    if (declaration.kind === "enum") {
      return this.enums.byName.get(`${module}.${declaration.name}`) ?? null;
    }
    if (declaration.kind === "struct") {
      return this.structsByQualifiedName.get(`${module}.${declaration.name}`) ?? null;
    }
    if (declaration.kind === "variable") {
      return this.resolveType(declaration.type, module, declaration.initializer, false);
    }
    if (declaration.kind === "function") {
      return this.resolveType(declaration.returnType, module, null, false);
    }
    return null;
  }

  /** Resolve and validate one ordinary function signature. */
  functionSignature(
    declaration: FunctionDeclaration,
    module: string,
    report: boolean,
  ): FunctionSignature | null {
    const returnType = this.resolveType(declaration.returnType, module, null, report);
    if (returnType === null) return null;
    if (
      declaration.mode === "interrupt" &&
      (declaration.parameters.length !== 0 ||
        returnType.kind !== "scalar" ||
        returnType.name !== "void")
    ) {
      if (report) {
        this.host.diagnose(
          projectDiagnostic(
            "E10050",
            `Interrupt function '${declaration.name}' must have signature '(): void' — found '(${declaration.parameters.map((parameter) => (parameter.type === null ? "<missing>" : this.host.sourceText(parameter.type.span))).join(", ")}): ${semanticTypeName(returnType)}'`,
            declaration.span,
          ),
        );
      }
      return null;
    }
    const parameters: FunctionSignature["parameters"][number][] = [];
    for (const parameter of declaration.parameters) {
      if (parameter.type?.kind === "named-type" && parameter.type.name === "void") {
        if (report) {
          this.host.diagnose(
            projectDiagnostic(
              "SEMANTIC_ERROR",
              "Type 'void' cannot be used as a parameter",
              parameter.type.span,
            ),
          );
        }
        return null;
      }
      const voidElement =
        parameter.type?.kind === "array-type" ? voidTypeSpan(parameter.type.element) : null;
      if (voidElement !== null) {
        if (report) {
          this.host.diagnose(
            projectDiagnostic(
              "SEMANTIC_ERROR",
              "Type 'void' cannot be used as an array element",
              voidElement,
            ),
          );
        }
        return null;
      }
      const outerUnsized = parameter.type?.kind === "array-type" && parameter.type.extent === null;
      let type: SemanticType | null;
      if (parameter.type?.kind === "array-type" && outerUnsized) {
        const element = this.resolveType(parameter.type.element, module, null, report);
        type = element === null ? null : this.fixedArray(element, 0);
      } else {
        type = this.resolveType(parameter.type, module, null, report);
      }
      if (type === null) return null;
      if (parameter.readonly && type.kind !== "array" && type.kind !== "struct") {
        if (report) {
          this.host.diagnose(
            projectDiagnostic(
              "E10246",
              `Parameter '${parameter.name}' uses 'const' with non-aggregate type '${semanticTypeName(type)}' — const parameters require an array or struct`,
              parameter.span,
            ),
          );
        }
        return null;
      }
      parameters.push(
        Object.freeze({
          name: parameter.name,
          nameSpan: parameter.nameSpan,
          type,
          readonly: parameter.readonly,
          ...(outerUnsized ? { outerUnsized: true as const } : {}),
        }),
      );
    }
    return Object.freeze({ parameters: Object.freeze(parameters), returnType });
  }

  /** Resolve a scalar, nominal struct, or fixed array with any complete rectangular shape. */
  resolveType(
    syntax: TypeSyntax | null,
    module: string,
    initializer: Expr | null,
    report: boolean,
    scope?: ScalarScope,
  ): SemanticType | null {
    if (syntax === null) return null;
    if (syntax.kind === "named-type") {
      const scalar = scalarSyntaxType(syntax);
      if (scalar !== null) return scalar;
      const enumType = this.enums.type(syntax.name, module, syntax.span.sourceId);
      if (enumType !== null) return enumType;
      const qualified = syntax.name.includes(".") ? syntax.name : `${module}.${syntax.name}`;
      const imported = this.graph.imports.find(
        (candidate) =>
          candidate.sourceSpan.sourceId === syntax.span.sourceId && candidate.alias === syntax.name,
      );
      const struct =
        this.structsByQualifiedName.get(qualified) ??
        (imported === undefined
          ? null
          : (this.structsByBinding.get(bindingIdentityKey(imported.binding)) ?? null));
      if (struct === null && report) {
        this.host.diagnose(
          projectDiagnostic("E10241", `Unknown type '${syntax.name}'`, syntax.span),
        );
      }
      return struct;
    }
    if (syntax.kind === "unchecked") {
      if (report)
        this.host.defer(syntax.span, "Type form is not implemented by this frontend slice");
      return null;
    }
    if (syntax.kind === "function-type") {
      const parameters: FunctionSignature["parameters"][number][] = [];
      for (const parameter of syntax.parameters) {
        const outerUnsized = parameter.type.kind === "array-type" && parameter.type.extent === null;
        const type =
          outerUnsized && parameter.type.kind === "array-type"
            ? (() => {
                const element = this.resolveType(
                  parameter.type.element,
                  module,
                  null,
                  report,
                  scope,
                );
                return element === null ? null : this.fixedArray(element, 0);
              })()
            : this.resolveType(parameter.type, module, null, report, scope);
        if (type === null) return null;
        if (type.kind === "scalar" && type.name === "void") {
          if (report)
            this.host.diagnose(
              projectDiagnostic(
                "SEMANTIC_ERROR",
                "Type 'void' cannot be used as a parameter",
                parameter.span,
              ),
            );
          return null;
        }
        if (parameter.readonly && type.kind !== "array" && type.kind !== "struct") {
          if (report)
            this.host.diagnose(
              projectDiagnostic(
                "E10246",
                "Const parameters require an array or struct type",
                parameter.span,
              ),
            );
          return null;
        }
        parameters.push(
          Object.freeze({
            type,
            readonly: parameter.readonly,
            ...(outerUnsized ? { outerUnsized: true as const } : {}),
          }),
        );
      }
      const returnType = this.resolveType(syntax.returnType, module, null, report, scope);
      return returnType === null
        ? null
        : Object.freeze({ kind: "function", parameters: Object.freeze(parameters), returnType });
    }
    const element = this.resolveType(syntax.element, module, null, report, scope);
    if (element === null) return null;
    if (element.kind === "scalar" && element.name === "void") {
      if (report) {
        this.host.diagnose(
          projectDiagnostic(
            "SEMANTIC_ERROR",
            "Type 'void' cannot be used as an array element",
            syntax.element.span,
          ),
        );
      }
      return null;
    }
    const length = this.resolveExtent(syntax, module, initializer, report, scope);
    if (length === null) return null;
    const size = semanticTypeSize(element) * length;
    if (size > 65535) {
      if (report) {
        this.host.diagnose(
          projectDiagnostic(
            "E10265",
            `Type '${this.host.sourceText(syntax.span)}' requires ${size} bytes — fixed array and struct types are limited to 65535 bytes`,
            syntax.span,
          ),
        );
      }
      return null;
    }
    return this.fixedArray(element, length);
  }

  /** Intern a complete fixed array so literals and declarations share its shape identity. */
  fixedArray(element: SemanticType, length: number): ArrayType {
    const key = `${semanticTypeKey(element)}[${length}]`;
    const existing = this.arraysByKey.get(key);
    if (existing !== undefined) return existing;
    const array = Object.freeze({
      kind: "array",
      element,
      length,
      size: semanticTypeSize(element) * length,
    } as const);
    this.arraysByKey.set(key, array);
    return array;
  }

  /** Resolve an explicit array extent or infer one from an element-list initializer. */
  private resolveExtent(
    syntax: Extract<TypeSyntax, { readonly kind: "array-type" }>,
    module: string,
    initializer: Expr | null,
    report: boolean,
    scope?: ScalarScope,
  ): number | null {
    if (syntax.extent === null) {
      if (
        initializer?.kind === "call" &&
        initializer.callee.kind === "name" &&
        initializer.callee.name === "embed"
      ) {
        const embeddedLength = this.host.embeddedExtent?.(initializer);
        if (embeddedLength !== null && embeddedLength !== undefined) return embeddedLength;
      }
      if (initializer?.kind === "array-literal" && initializer.fill === null) {
        return initializer.elements.length;
      }
      if (initializer?.kind === "literal" && initializer.literalKind === "string") {
        return initializer.items.length;
      }
      if (
        initializer?.kind === "call" &&
        initializer.callee.kind === "name" &&
        (initializer.callee.name === "screen_codes" || initializer.callee.name === "petscii") &&
        initializer.arguments[0]?.kind === "literal" &&
        initializer.arguments[0].literalKind === "string"
      ) {
        return initializer.arguments[0].items.length;
      }
      if (initializer?.kind === "array-literal" && initializer.fill !== null) {
        if (report) {
          this.host.diagnose(
            projectDiagnostic(
              "E10114",
              "Fill syntax '[...; fill]' requires an explicit array size",
              initializer.span,
            ),
          );
        }
      } else if (report) {
        this.host.diagnose(
          projectDiagnostic(
            "E10253",
            `Array use at '${this.host.sourceText(syntax.span)}' has no compile-time-known extent — add '[N]', use an extent-inferencing initializer, or keep 'T[]' as an outermost parameter form`,
            syntax.span,
          ),
        );
      }
      return null;
    }
    const failure = { handled: false };
    const value =
      evaluateConstant(this, syntax.extent, module, scope, report, failure)?.value ?? null;
    if (typeof value === "bigint" && value >= 0n && value <= 65535n) return Number(value);
    if (report && !failure.handled) {
      const found = typeof value === "bigint" ? value.toString() : semanticExtentKind(value);
      this.host.diagnose(
        projectDiagnostic(
          value === null ? "E10110" : "E10264",
          value === null
            ? `Array size must be a compile-time constant expression — found '${this.host.sourceText(syntax.extent.span)}'`
            : `Array extent '${this.host.sourceText(syntax.extent.span)}' must be a compile-time integer in 0..65535 — found ${found}`,
          syntax.extent.span,
        ),
      );
    }
    return null;
  }

  /** Resolve packed structs in dependency order and reject containment cycles at their first edge. */
  private prepareStructs(): void {
    const status = new Map<string, "resolving" | "complete" | "invalid">();
    const path: {
      readonly key: string;
      readonly name: string;
      readonly incoming: SourceSpan | null;
    }[] = [];
    const resolveStruct = (
      binding: ModuleGraph["bindings"][number],
      declaration: StructDeclaration,
      incoming: SourceSpan | null = null,
    ): StructType | null => {
      const key = bindingIdentityKey(binding.id);
      if (status.get(key) === "complete") return this.structsByBinding.get(key) ?? null;
      if (status.get(key) === "invalid") return null;
      status.set(key, "resolving");
      path.push({ key, name: declaration.name, incoming });
      const module = binding.qualifiedName?.slice(0, -(binding.name.length + 1)) ?? "";
      const resolveField = (syntax: TypeSyntax): SemanticType | null => {
        if (syntax.kind === "array-type") {
          const element = resolveField(syntax.element);
          if (element === null) return null;
          const length = this.resolveExtent(syntax, module, null, true);
          if (length === null) return null;
          const size = semanticTypeSize(element) * length;
          if (size > 65535) {
            this.host.diagnose(
              projectDiagnostic(
                "E10265",
                `Type '${this.host.sourceText(syntax.span)}' requires ${size} bytes — fixed array and struct types are limited to 65535 bytes`,
                syntax.span,
              ),
            );
            return null;
          }
          return this.fixedArray(element, length);
        }
        if (syntax.kind === "named-type") {
          const target = resolveAggregateDeclaration(
            this.graph,
            this.declarations,
            syntax.name,
            module,
            syntax.span.sourceId,
          );
          if (target?.declaration.kind === "struct") {
            const targetKey = bindingIdentityKey(target.binding);
            if (status.get(targetKey) === "resolving") {
              const cycle = path.slice(path.findIndex((item) => item.key === targetKey));
              const edges = [...cycle.slice(1).map((item) => item.incoming!), syntax.span];
              this.host.diagnose(
                projectDiagnostic(
                  targetKey === key ? "E10091" : "E10092",
                  targetKey === key
                    ? `Struct '${declaration.name}' cannot contain a field of its own type`
                    : `Circular struct dependency: ${cycle.map((item) => item.name).join(" contains ")} which contains ${target.declaration.name}`,
                  edges[0]!,
                  null,
                  targetKey === key
                    ? [{ span: declaration.nameSpan, message: "Struct declared here" }]
                    : edges.map((span) => ({ span, message: "Containment edge is here" })),
                ),
              );
              return null;
            }
            const targetBinding = this.graph.bindings.find(
              ({ id }) => bindingIdentityKey(id) === targetKey,
            );
            return targetBinding === undefined
              ? null
              : resolveStruct(targetBinding, target.declaration, syntax.span);
          }
        }
        if (syntax.kind === "function-type" || syntax.kind === "unchecked") {
          this.deferredStructs.add(key);
        }
        return this.resolveType(syntax, module, null, true);
      };
      const type = buildPackedStruct(declaration, binding.id, this.host, resolveField);
      path.pop();
      status.set(key, type === null ? "invalid" : "complete");
      if (type !== null && binding.qualifiedName !== null) {
        this.structsByQualifiedName.set(binding.qualifiedName, type);
        this.structsByBinding.set(key, type);
      }
      return type;
    };
    for (const binding of this.graph.bindings) {
      const declaration = this.declarations.get(bindingIdentityKey(binding.id));
      if (declaration?.kind !== "struct" || binding.qualifiedName === null) continue;
      resolveStruct(binding, declaration);
    }
  }
}

/** Describe a non-integer extent result without inventing a value. */
function semanticExtentKind(value: bigint | boolean | null): string {
  if (typeof value === "boolean") return "boolean";
  return "non-constant expression";
}
