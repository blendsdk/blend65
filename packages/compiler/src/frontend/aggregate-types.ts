import { projectDiagnostic } from "../project/diagnostics.js";
import {
  commonIntegerType,
  convertInteger,
  defaultIntegerType,
  evaluateBinaryInteger,
  evaluateUnaryInteger,
  isIntegerType,
  scalarSyntaxType,
  SCALAR_TYPES,
} from "./constants.js";
import { bindingIdentityKey, semanticTypeKey } from "./semantic-types.js";
import { semanticTypeName, semanticTypeSize } from "./semantic-type-relations.js";
import { EnumTable } from "./enum-types.js";
import { buildScalarStruct, voidTypeSpan } from "./struct-types.js";
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
  ScalarType,
} from "./semantic-types.js";
import type { Declaration, Expr, FunctionDeclaration, TypeSyntax } from "./syntax.js";

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
      const value = this.evaluateConstant(expression, module, undefined, false, failure)?.value;
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
    if (returnType.kind !== "scalar" && returnType.kind !== "enum" && report) {
      this.host.defer(
        declaration.returnType?.span ?? declaration.nameSpan,
        "Aggregate return ABI remains pending",
      );
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
      if (parameter.type?.kind === "array-type" && parameter.type.extent === null) {
        if (report) {
          this.host.defer(parameter.type.span, "Unsized aggregate parameter ABI remains pending");
        }
        return null;
      }
      const type = this.resolveType(parameter.type, module, null, report);
      if (type === null) return null;
      if (parameter.readonly && type.kind === "scalar") {
        if (report) {
          this.host.diagnose(
            projectDiagnostic(
              "E10246",
              `Parameter '${parameter.name}' uses 'const' with non-aggregate type '${type.name}' — const parameters require an array or struct`,
              parameter.span,
            ),
          );
        }
        return null;
      }
      parameters.push(Object.freeze({ type, readonly: parameter.readonly }));
    }
    return Object.freeze({ parameters: Object.freeze(parameters), returnType });
  }

  /** Resolve an admitted scalar, nominal struct, or one-dimensional fixed array. */
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
      if (report) this.host.defer(syntax.span, "Function value typing remains pending");
      return null;
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
    if (element.kind === "array") {
      if (report)
        this.host.defer(syntax.span, "Nested arrays remain outside the admitted frontend slice");
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
    const key = `${semanticTypeKey(element)}[${length}]`;
    const existing = this.arraysByKey.get(key);
    if (existing !== undefined) return existing;
    const array = Object.freeze({ kind: "array", element, length, size } as const);
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
      if (initializer?.kind === "array-literal" && initializer.fill === null) {
        return initializer.elements.length;
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
      this.evaluateConstant(syntax.extent, module, scope, report, failure)?.value ?? null;
    if (typeof value === "bigint" && value >= 0n && value <= 65535n) return Number(value);
    if (report && !failure.handled) {
      const found = typeof value === "bigint" ? value.toString() : semanticExtentKind(value);
      this.host.diagnose(
        projectDiagnostic(
          "E10264",
          `Array extent '${this.host.sourceText(syntax.extent.span)}' must be a compile-time integer in 0..65535 — found ${found}`,
          syntax.extent.span,
        ),
      );
    }
    return null;
  }

  /** Evaluate the admitted compile-time expression subset used by fixed extents. */
  private evaluateConstant(
    expression: Expr,
    module: string,
    scope: ScalarScope | undefined,
    report: boolean,
    failure: { handled: boolean },
  ): { readonly value: bigint | boolean; readonly type: ScalarType } | null {
    if (expression.kind === "number") {
      const type = defaultIntegerType(expression.value);
      return type === null ? null : { value: expression.value, type };
    }
    if (expression.kind === "boolean") {
      return { value: expression.value, type: SCALAR_TYPES.boolean };
    }
    if (expression.kind === "name") {
      return this.evaluateNamedConstant(expression, module, scope, report, failure);
    }
    if (expression.kind === "member" && expression.object.kind === "name") {
      const member = this.enums.member(
        expression.object.name,
        expression.member,
        module,
        expression.span.sourceId,
      );
      return member === null ? null : { value: member.value, type: SCALAR_TYPES.byte };
    }
    if (expression.kind === "unary") {
      const operand = this.evaluateConstant(expression.operand, module, scope, report, failure);
      if (operand === null) return null;
      if (expression.operator === "!") {
        return typeof operand.value === "boolean"
          ? { value: !operand.value, type: SCALAR_TYPES.boolean }
          : null;
      }
      if (typeof operand.value !== "bigint" || !isIntegerType(operand.type)) return null;
      const value = evaluateUnaryInteger(expression.operator, operand.value);
      if (value === null) return null;
      const type = expression.operator === "-" ? defaultIntegerType(value) : operand.type;
      return type === null ? null : { value, type };
    }
    if (expression.kind === "binary") {
      const left = this.evaluateConstant(expression.left, module, scope, report, failure);
      const right = this.evaluateConstant(expression.right, module, scope, report, failure);
      if (left === null || right === null) return null;
      if (expression.operator === "&&" || expression.operator === "||") {
        if (typeof left.value !== "boolean" || typeof right.value !== "boolean") return null;
        return {
          value:
            expression.operator === "&&" ? left.value && right.value : left.value || right.value,
          type: SCALAR_TYPES.boolean,
        };
      }
      if (
        typeof left.value !== "bigint" ||
        typeof right.value !== "bigint" ||
        !isIntegerType(left.type) ||
        !isIntegerType(right.type)
      ) {
        return null;
      }
      const shift = expression.operator === "<<" || expression.operator === ">>";
      const operationType = shift ? left.type : commonIntegerType(left.type, right.type);
      if (operationType === null) return null;
      const value = evaluateBinaryInteger(
        expression.operator,
        left.value,
        right.value,
        operationType,
      );
      if (value === null) return null;
      return {
        value,
        type: typeof value === "boolean" ? SCALAR_TYPES.boolean : operationType,
      };
    }
    if (expression.kind === "conditional") {
      const condition = this.evaluateConstant(expression.condition, module, scope, report, failure);
      if (condition?.type !== SCALAR_TYPES.boolean || typeof condition.value !== "boolean") {
        return null;
      }
      return this.evaluateConstant(
        condition.value ? expression.whenTrue : expression.whenFalse,
        module,
        scope,
        report,
        failure,
      );
    }
    if (expression.kind === "cast") {
      const operand = this.evaluateConstant(expression.operand, module, scope, report, failure);
      const destination = this.resolveType(expression.type, module, null, report, scope);
      if (
        operand === null ||
        typeof operand.value !== "bigint" ||
        !isIntegerType(operand.type) ||
        destination === null ||
        !isIntegerType(destination)
      ) {
        return null;
      }
      return {
        value: convertInteger(operand.value, operand.type, destination).value,
        type: destination,
      };
    }
    if (expression.kind === "sizeof") {
      if (expression.operand.kind === "array-type" && expression.operand.extent === null) {
        if (report) {
          this.host.diagnose(
            projectDiagnostic(
              "E10266",
              `'sizeof' requires a fixed-size type — unsized array type '${this.host.sourceText(expression.operand.span)}' has no standalone extent`,
              expression.operand.span,
            ),
          );
        }
        failure.handled = true;
        return null;
      }
      const type = this.resolveType(expression.operand, module, null, report, scope);
      if (type === null) failure.handled = true;
      return type === null
        ? null
        : { value: BigInt(semanticTypeSize(type)), type: SCALAR_TYPES.word };
    }
    if (expression.kind === "offsetof") {
      const type = this.resolveType(expression.operand, module, null, report, scope);
      if (type === null) {
        failure.handled = true;
        return null;
      }
      if (type.kind !== "struct") {
        if (report) {
          this.host.diagnose(
            projectDiagnostic(
              "E10201",
              `'offsetof' requires a struct type — found '${semanticTypeName(type)}'`,
              expression.operand.span,
            ),
          );
        }
        failure.handled = true;
        return null;
      }
      const field = type.fields.find(({ name }) => name === expression.field);
      if (field === undefined) {
        if (report) {
          this.host.diagnose(
            projectDiagnostic(
              "E10202",
              `Field '${expression.field}' is not present in struct '${this.host.sourceText(expression.operand.span)}' — available fields: ${type.fields.map(({ name }) => name).join(", ")}`,
              expression.fieldSpan,
            ),
          );
        }
        failure.handled = true;
        return null;
      }
      return { value: BigInt(field.offset), type: SCALAR_TYPES.word };
    }
    if (expression.kind === "length") {
      const type = this.resolveConstantValueType(expression.operand, module, scope);
      if (type !== null && type.kind !== "array") {
        if (report) {
          this.host.diagnose(
            projectDiagnostic(
              "E10203",
              `'length' requires an array — found '${semanticTypeName(type)}'`,
              expression.operand.span,
            ),
          );
        }
        failure.handled = true;
        return null;
      }
      return type?.kind === "array"
        ? { value: BigInt(type.length), type: SCALAR_TYPES.word }
        : null;
    }
    if (
      expression.kind === "call" &&
      expression.callee.kind === "name" &&
      (expression.callee.name === "lo" || expression.callee.name === "hi") &&
      expression.arguments.length === 1
    ) {
      const argument = this.evaluateConstant(
        expression.arguments[0]!,
        module,
        scope,
        report,
        failure,
      );
      if (
        argument === null ||
        typeof argument.value !== "bigint" ||
        !isIntegerType(argument.type)
      ) {
        return null;
      }
      const width = argument.type.name.endsWith("byte") ? 8 : 16;
      let bits = argument.value & ((1n << BigInt(width)) - 1n);
      if (expression.callee.name === "hi" && argument.type.name === "sbyte" && bits >= 0x80n) {
        bits |= 0xff00n;
      }
      return {
        value: expression.callee.name === "lo" ? bits & 0xffn : (bits >> 8n) & 0xffn,
        type: SCALAR_TYPES.byte,
      };
    }
    return null;
  }

  /** Resolve and evaluate one module or imported constant by source identity. */
  private evaluateNamedConstant(
    expression: Extract<Expr, { readonly kind: "name" }>,
    module: string,
    scope: ScalarScope | undefined,
    report: boolean,
    failure: { handled: boolean },
  ): { readonly value: bigint | boolean; readonly type: ScalarType } | null {
    if (!expression.name.includes(".")) {
      for (
        let current: ScalarScope | null | undefined = scope;
        current !== undefined && current !== null;
        current = current.parent
      ) {
        const state = current.values.get(expression.name);
        if (state === undefined) continue;
        const type = state.binding.type;
        return state.binding.storage === "constant" &&
          type?.kind === "scalar" &&
          type.name !== "void" &&
          state.known !== null
          ? { value: state.known, type }
          : null;
      }
    }
    const resolved = this.resolveNamedDeclaration(
      expression.name,
      module,
      expression.span.sourceId,
    );
    if (resolved === null || resolved.declaration.kind !== "variable") return null;
    const declaration = resolved.declaration;
    if (declaration.declarationKind !== "const" || declaration.initializer === null) return null;
    const key = bindingIdentityKey(resolved.binding);
    if (this.evaluatingConstants.has(key)) return null;
    const type = this.resolveType(
      declaration.type,
      resolved.module,
      declaration.initializer,
      false,
    );
    if (type === null || type.kind !== "scalar" || type.name === "void") return null;
    this.evaluatingConstants.add(key);
    const value = this.evaluateConstant(
      declaration.initializer,
      resolved.module,
      undefined,
      report,
      failure,
    );
    this.evaluatingConstants.delete(key);
    return value === null ? null : { value: value.value, type };
  }

  /** Resolve the declared type of a value used by a constant query. */
  private resolveConstantValueType(
    expression: Expr,
    module: string,
    scope: ScalarScope | undefined,
  ): SemanticType | null {
    if (expression.kind !== "name") return null;
    if (!expression.name.includes(".")) {
      for (
        let current: ScalarScope | null | undefined = scope;
        current !== undefined && current !== null;
        current = current.parent
      ) {
        const state = current.values.get(expression.name);
        if (state !== undefined) return state.binding.type;
      }
    }
    const resolved = this.resolveNamedDeclaration(
      expression.name,
      module,
      expression.span.sourceId,
    );
    return resolved?.declaration.kind === "variable"
      ? this.resolveType(
          resolved.declaration.type,
          resolved.module,
          resolved.declaration.initializer,
          false,
        )
      : null;
  }

  /** Resolve a qualified, local-module, or source-imported declaration. */
  private resolveNamedDeclaration(
    name: string,
    module: string,
    sourceId: string,
  ): {
    readonly binding: BindingId;
    readonly declaration: Declaration;
    readonly module: string;
  } | null {
    const imported = this.graph.imports.find(
      (candidate) => candidate.sourceSpan.sourceId === sourceId && candidate.alias === name,
    );
    const binding =
      imported === undefined
        ? this.graph.bindings.find(
            ({ qualifiedName }) =>
              qualifiedName === (name.includes(".") ? name : `${module}.${name}`),
          )
        : this.graph.bindings.find(
            (candidate) =>
              bindingIdentityKey(candidate.id) === bindingIdentityKey(imported.binding),
          );
    if (binding === undefined) return null;
    const declaration = this.declarations.get(bindingIdentityKey(binding.id));
    if (declaration === undefined) return null;
    const owner = binding.qualifiedName?.slice(0, -(binding.name.length + 1)) ?? module;
    return { binding: binding.id, declaration, module: owner };
  }

  /** Build scalar-field struct layouts before any body or declaration uses them. */
  private prepareStructs(): void {
    for (const binding of this.graph.bindings) {
      const declaration = this.declarations.get(bindingIdentityKey(binding.id));
      if (declaration?.kind !== "struct" || binding.qualifiedName === null) continue;
      const type = buildScalarStruct(declaration, binding.id, this.host, this.deferredStructs);
      if (type !== null) {
        this.structsByQualifiedName.set(binding.qualifiedName, type);
        this.structsByBinding.set(bindingIdentityKey(binding.id), type);
      }
    }
  }
}

/** Describe a non-integer extent result without inventing a value. */
function semanticExtentKind(value: bigint | boolean | null): string {
  if (typeof value === "boolean") return "boolean";
  return "non-constant expression";
}
