import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { evaluateBinaryInteger, evaluateUnaryInteger, wrapInteger } from "./constants.js";
import { semanticTypeSize } from "./semantic-type-relations.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type {
  BindingId,
  SemanticBinding,
  SemanticType,
  TypedBlock,
  TypedExpr,
  TypedForStatement,
  TypedIfStatement,
  TypedStatement,
  TypedVariableStatement,
} from "./semantic-types.js";
import type { TypeSyntax } from "./syntax.js";
import { ComptimeBudget, ComptimeBudgetFailure } from "./comptime-budget.js";

/** A checked direct function body with its parameter bindings in source order. */
export interface ComptimeFunction {
  /** Stable source function identity. */
  readonly binding: BindingId;
  /** Parameter storage identities, one per written parameter. */
  readonly parameters: readonly BindingId[];
  /** Typed body with ordinary language conversions already resolved. */
  readonly body: TypedBlock;
}

/** One scalar value and the temporary bytes holding its evaluation result. */
interface ScalarValue {
  readonly value: bigint | boolean;
  readonly bytes: number;
}

/** An exit from a selected statement or block. */
type ExecutionExit =
  | { readonly kind: "normal" | "break" | "continue" }
  | { readonly kind: "return"; readonly result: ScalarValue | null };

/** A source error discards the entire outermost compile-time result. */
class ComptimeSemanticFailure extends Error {
  constructor(readonly diagnostic: ProjectDiagnostic) {
    super(diagnostic.message);
  }
}

/** Mutable values are private to one compile-time invocation. */
interface Frame {
  readonly values: Map<string, bigint | boolean>;
  allocatedBytes: number;
}

/** Narrow a for initializer without asserting away its readonly expression-list type. */
function isExpressionList(
  initializer: TypedVariableStatement | readonly TypedExpr[],
): initializer is readonly TypedExpr[] {
  return Array.isArray(initializer);
}

/** Visit source dependencies without charging execution of either branch. */
function visitExpressionBindings(expression: TypedExpr, visit: (binding: BindingId) => void): void {
  if (expression.binding !== null) visit(expression.binding);
  const children: (TypedExpr | undefined)[] = [
    expression.left,
    expression.right,
    expression.condition,
    expression.whenTrue,
    expression.whenFalse,
    expression.target,
    expression.callee,
    expression.object,
    expression.index,
  ];
  if (expression.operand !== undefined && isTypedOperand(expression.operand)) {
    children.push(expression.operand);
  }
  if (typeof expression.value === "object" && expression.value !== null) {
    children.push(expression.value);
  }
  if (expression.fill !== undefined && expression.fill !== null) children.push(expression.fill);
  children.push(...(expression.arguments ?? []));
  children.push(...(expression.elements ?? []));
  children.push(...(expression.fields ?? []).map(({ value }) => value));
  for (const child of children) {
    if (child !== undefined) visitExpressionBindings(child, visit);
  }
}

/** Visit the names in a typed body so declaration ordering can put constants first. */
function visitBlockBindings(block: TypedBlock, visit: (binding: BindingId) => void): void {
  for (const statement of block.statements) {
    switch (statement.kind) {
      case "variable":
        if (statement.initializer !== null) visitExpressionBindings(statement.initializer, visit);
        break;
      case "expression-statement":
        visitExpressionBindings(statement.expression, visit);
        break;
      case "return":
        if (statement.value !== null && statement.value !== undefined) {
          visitExpressionBindings(statement.value, visit);
        }
        break;
      case "block":
        visitBlockBindings(statement, visit);
        break;
      case "if": {
        let branch: TypedIfStatement | null = statement;
        while (branch !== null) {
          visitExpressionBindings(branch.condition, visit);
          visitBlockBindings(branch.then, visit);
          if (branch.otherwise?.kind === "block") {
            visitBlockBindings(branch.otherwise, visit);
          }
          branch = branch.otherwise?.kind === "if" ? branch.otherwise : null;
        }
        break;
      }
      case "while":
      case "do-while":
        visitExpressionBindings(statement.condition, visit);
        visitBlockBindings(statement.body, visit);
        break;
      case "for":
        if (statement.initializer !== null) {
          if (isExpressionList(statement.initializer)) {
            for (const expression of statement.initializer)
              visitExpressionBindings(expression, visit);
          } else if (statement.initializer.initializer !== null) {
            visitExpressionBindings(statement.initializer.initializer, visit);
          }
        }
        if (statement.condition !== null) visitExpressionBindings(statement.condition, visit);
        for (const update of statement.update ?? []) visitExpressionBindings(update, visit);
        visitBlockBindings(statement.body, visit);
        break;
      case "switch":
        visitExpressionBindings(statement.value, visit);
        for (const clause of statement.clauses) visitBlockBindings(clause.body, visit);
        break;
      case "break":
      case "continue":
        break;
    }
  }
}

/** Distinguish a checked value operand from a retained type spelling. */
function isTypedOperand(operand: TypedExpr | TypeSyntax): operand is TypedExpr {
  return "constant" in operand;
}

/**
 * Interpret checked source operations on the host without emitting target work.
 * Every selected operation is metered even when its value was already proved by analysis.
 */
export class ComptimeEvaluator {
  private readonly functions = new Map<string, ComptimeFunction>();
  private readonly active = new Set<string>();

  constructor(
    readonly budget: ComptimeBudget,
    readonly constantValue: (binding: BindingId) => bigint | boolean | null,
    readonly diagnose: (diagnostic: ProjectDiagnostic) => void,
  ) {}

  /** Register a typed function body before any constant root is evaluated. */
  registerFunction(entry: ComptimeFunction): void {
    this.functions.set(bindingIdentityKey(entry.binding), entry);
  }

  /** Return exact source binding dependencies, including nested direct calls. */
  constantDependencies(
    bindings: ReadonlyMap<string, SemanticBinding>,
  ): ReadonlyMap<string, readonly BindingId[]> {
    const result = new Map<string, readonly BindingId[]>();
    for (const key of this.functions.keys()) {
      const constants = new Map<string, BindingId>();
      const seen = new Set<string>();
      const visitFunction = (functionKey: string): void => {
        if (seen.has(functionKey)) return;
        seen.add(functionKey);
        const entry = this.functions.get(functionKey);
        if (entry === undefined) return;
        visitBlockBindings(entry.body, (binding) => {
          const bindingKey = bindingIdentityKey(binding);
          if (bindings.get(bindingKey)?.storage === "constant") constants.set(bindingKey, binding);
          if (this.functions.has(bindingKey)) visitFunction(bindingKey);
        });
      };
      visitFunction(key);
      result.set(
        key,
        Object.freeze(
          [...constants]
            .sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
            .map(([, id]) => id),
        ),
      );
    }
    return result;
  }

  /** Evaluate one outermost scalar constant, retaining only its final value bytes. */
  evaluateRoot(expression: TypedExpr, type: SemanticType): bigint | boolean | null {
    const checkpoint = this.budget.liveCheckpoint();
    const root = expression.span;
    const frame: Frame = { values: new Map(), allocatedBytes: 0 };
    try {
      const result = this.evaluate(expression, frame, root);
      this.budget.allocate(semanticTypeSize(type), root, root);
      this.budget.release(result.bytes);
      return this.convert(result.value, type);
    } catch (failure) {
      this.budget.abandonRoot(checkpoint);
      if (failure instanceof ComptimeBudgetFailure || failure instanceof ComptimeSemanticFailure) {
        this.diagnose(failure.diagnostic);
        return null;
      }
      throw failure;
    }
  }

  /** Charge one expression before reading children or mutating evaluator-local state. */
  private evaluate(expression: TypedExpr, frame: Frame, root: SourceSpan): ScalarValue {
    this.budget.step(expression.span, root);
    switch (expression.kind) {
      case "number":
      case "boolean":
      case "literal":
      case "member":
      case "sizeof":
      case "offsetof":
      case "length":
        if (expression.constant !== null) {
          return this.temporary(expression.constant, expression.type, expression.span, root);
        }
        break;
      case "name": {
        if (expression.binding === null) break;
        const key = bindingIdentityKey(expression.binding);
        const value = frame.values.get(key) ?? this.constantValue(expression.binding);
        if (value !== null && value !== undefined) {
          return { value, bytes: 0 };
        }
        break;
      }
      case "unary": {
        if (expression.operand === undefined || !isTypedOperand(expression.operand)) break;
        const operand = this.evaluate(expression.operand, frame, root);
        const operator = expression.operator;
        const value =
          operator === "!" && typeof operand.value === "boolean"
            ? !operand.value
            : typeof operand.value === "bigint"
              ? evaluateUnaryInteger(operator ?? "", operand.value)
              : null;
        if (value === null) break;
        const result = this.temporary(
          this.convert(value, expression.type),
          expression.type,
          expression.span,
          root,
        );
        this.budget.release(operand.bytes);
        return result;
      }
      case "cast": {
        if (expression.operand === undefined || !isTypedOperand(expression.operand)) break;
        const operand = this.evaluate(expression.operand, frame, root);
        const result = this.temporary(
          this.convert(operand.value, expression.type),
          expression.type,
          expression.span,
          root,
        );
        this.budget.release(operand.bytes);
        return result;
      }
      case "binary":
        return this.binary(expression, frame, root);
      case "conditional": {
        if (
          expression.condition === undefined ||
          expression.whenTrue === undefined ||
          expression.whenFalse === undefined
        )
          break;
        const condition = this.evaluate(expression.condition, frame, root);
        this.budget.release(condition.bytes);
        const selected = condition.value ? expression.whenTrue : expression.whenFalse;
        const value = this.evaluate(selected, frame, root);
        const result = this.temporary(
          this.convert(value.value, expression.type),
          expression.type,
          expression.span,
          root,
        );
        this.budget.release(value.bytes);
        return result;
      }
      case "assignment":
        return this.assignment(expression, frame, root);
      case "call":
        if (
          (expression.callee === undefined || expression.callee.binding === null) &&
          expression.constant !== null
        ) {
          this.budget.step(expression.span, root);
          let argumentBytes = 0;
          for (const argument of expression.arguments ?? []) {
            const value = this.evaluate(argument, frame, root);
            argumentBytes += value.bytes;
          }
          const result = this.temporary(
            expression.constant,
            expression.type,
            expression.span,
            root,
          );
          this.budget.release(argumentBytes);
          return result;
        }
        return this.call(expression, frame, root);
      default:
        break;
    }
    throw this.invalid(
      expression.span,
      "This expression cannot be evaluated by a compile-time function",
    );
  }

  /** Preserve short-circuit selection and the ordinary fixed-width arithmetic result. */
  private binary(expression: TypedExpr, frame: Frame, root: SourceSpan): ScalarValue {
    if (expression.left === undefined || expression.right === undefined) {
      throw this.invalid(expression.span, "Incomplete compile-time binary expression");
    }
    const left = this.evaluate(expression.left, frame, root);
    const operator = expression.operator;
    if (operator === "&&" || operator === "||") {
      if (typeof left.value !== "boolean") {
        throw this.invalid(expression.span, "Logical operand is not Boolean");
      }
      if ((operator === "&&" && !left.value) || (operator === "||" && left.value)) {
        const result = this.temporary(left.value, expression.type, expression.span, root);
        this.budget.release(left.bytes);
        return result;
      }
    }
    const right = this.evaluate(expression.right, frame, root);
    let value: bigint | boolean | null = null;
    if (operator === "&&" || operator === "||") {
      if (typeof left.value === "boolean" && typeof right.value === "boolean") {
        value = operator === "&&" ? left.value && right.value : left.value || right.value;
      }
    } else if (typeof left.value === "bigint" && typeof right.value === "bigint") {
      value = evaluateBinaryInteger(operator ?? "", left.value, right.value, expression.left.type);
    } else if (operator === "==" || operator === "!=") {
      value = operator === "==" ? left.value === right.value : left.value !== right.value;
    }
    if (value === null) throw this.invalid(expression.span, "Compile-time arithmetic is undefined");
    const result = this.temporary(
      this.convert(value, expression.type),
      expression.type,
      expression.span,
      root,
    );
    this.budget.release(left.bytes + right.bytes);
    return result;
  }

  /** Mutate only the current invocation's local storage. */
  private assignment(expression: TypedExpr, frame: Frame, root: SourceSpan): ScalarValue {
    const target = expression.target;
    const valueNode = expression.value;
    if (
      target?.binding === null ||
      target?.binding === undefined ||
      typeof valueNode !== "object" ||
      valueNode === null ||
      !("kind" in valueNode)
    ) {
      throw this.invalid(expression.span, "Compile-time assignment needs a local scalar place");
    }
    this.budget.step(target.span, root);
    const key = bindingIdentityKey(target.binding);
    const current = frame.values.get(key);
    if (current === undefined) {
      throw this.invalid(target.span, "Compile-time assignment cannot write runtime storage");
    }
    const rhs = this.evaluate(valueNode, frame, root);
    let value: bigint | boolean | null = rhs.value;
    if (expression.operator !== "=") {
      if (typeof current !== "bigint" || typeof rhs.value !== "bigint") {
        throw this.invalid(expression.span, "Compound assignment requires integer operands");
      }
      value = evaluateBinaryInteger(
        expression.operator?.slice(0, -1) ?? "",
        current,
        rhs.value,
        target.type,
      );
    }
    if (value === null) throw this.invalid(expression.span, "Compile-time arithmetic is undefined");
    const converted = this.convert(value, target.type);
    const result = this.temporary(converted, expression.type, expression.span, root);
    frame.values.set(key, converted);
    this.budget.release(rhs.bytes);
    return result;
  }

  /** Resolve only a registered direct compile-time function, never a runtime target. */
  private call(expression: TypedExpr, caller: Frame, root: SourceSpan): ScalarValue {
    const callee = expression.callee;
    if (callee?.name === "lo" || callee?.name === "hi") {
      this.budget.step(expression.span, root);
      const argument = expression.arguments?.[0];
      if (argument === undefined)
        throw this.invalid(expression.span, "Missing byte-extraction operand");
      const result = this.evaluate(argument, caller, root);
      if (typeof result.value !== "bigint") {
        throw this.invalid(argument.span, "Byte extraction requires an integer");
      }
      const width =
        argument.type.kind === "scalar" &&
        (argument.type.name === "byte" || argument.type.name === "sbyte")
          ? 8
          : 16;
      let bits = result.value & ((1n << BigInt(width)) - 1n);
      if (
        callee.name === "hi" &&
        width === 8 &&
        argument.type.kind === "scalar" &&
        argument.type.name === "sbyte" &&
        bits >= 0x80n
      )
        bits |= 0xff00n;
      const extracted = callee.name === "lo" ? bits & 0xffn : (bits >> 8n) & 0xffn;
      const value = this.temporary(extracted, expression.type, expression.span, root);
      this.budget.release(result.bytes);
      return value;
    }
    if (callee?.binding === null || callee?.binding === undefined) {
      throw this.invalid(expression.span, "Indirect calls have no compile-time target");
    }
    const key = bindingIdentityKey(callee.binding);
    const target = this.functions.get(key);
    if (target === undefined) {
      throw this.invalid(
        expression.span,
        "Ordinary or unavailable function cannot run at compile time",
      );
    }
    if (this.active.has(key)) {
      throw new ComptimeSemanticFailure(
        projectDiagnostic(
          "E10180",
          "Recursive compile-time function call is not allowed",
          expression.span,
        ),
      );
    }
    this.budget.enterCall(expression.span, root);
    this.active.add(key);
    const frame: Frame = { values: new Map(), allocatedBytes: 0 };
    let argumentBytes = 0;
    try {
      this.budget.step(callee.span, root);
      const arguments_ = expression.arguments ?? [];
      for (const [index, argument] of arguments_.entries()) {
        const parameter = target.parameters[index];
        if (parameter === undefined) {
          throw this.invalid(expression.span, "Compile-time call parameter count is incomplete");
        }
        const value = this.evaluate(argument, caller, root);
        argumentBytes += value.bytes;
        this.budget.allocate(semanticTypeSize(argument.type), argument.span, root);
        frame.allocatedBytes += semanticTypeSize(argument.type);
        frame.values.set(bindingIdentityKey(parameter), value.value);
      }
      this.budget.release(argumentBytes);
      argumentBytes = 0;
      const exit = this.executeBlock(target.body, frame, root);
      if (exit.kind !== "return" || exit.result === null) {
        throw this.invalid(expression.span, "Compile-time function did not return a value");
      }
      const result = this.temporary(
        this.convert(exit.result.value, expression.type),
        expression.type,
        expression.span,
        root,
      );
      this.budget.release(exit.result.bytes);
      return result;
    } finally {
      this.budget.release(argumentBytes + frame.allocatedBytes);
      this.active.delete(key);
      this.budget.leaveCall();
    }
  }

  /** Execute selected statements in source order, releasing block-local storage on exit. */
  private executeBlock(block: TypedBlock, frame: Frame, root: SourceSpan): ExecutionExit {
    const added: string[] = [];
    let bytes = 0;
    try {
      for (const statement of block.statements) {
        const before = frame.allocatedBytes;
        const exit = this.executeStatement(statement, frame, root);
        if (statement.kind === "variable") {
          added.push(bindingIdentityKey(statement.binding));
          bytes += frame.allocatedBytes - before;
        }
        if (exit.kind !== "normal") return exit;
      }
      return { kind: "normal" };
    } finally {
      for (const key of added) {
        frame.values.delete(key);
      }
      frame.allocatedBytes -= bytes;
      this.budget.release(bytes);
    }
  }

  /** Execute one typed statement; loops charge only iterations they actually enter. */
  private executeStatement(
    statement: TypedStatement,
    frame: Frame,
    root: SourceSpan,
  ): ExecutionExit {
    this.budget.step(statement.span, root);
    switch (statement.kind) {
      case "variable":
        return this.declareLocal(statement, frame, root);
      case "expression-statement": {
        const result = this.evaluate(statement.expression, frame, root);
        this.budget.release(result.bytes);
        return { kind: "normal" };
      }
      case "block":
        return this.executeBlock(statement, frame, root);
      case "if":
        return this.executeIf(statement, frame, root);
      case "while":
        while (true) {
          const condition = this.evaluate(statement.condition, frame, root);
          this.budget.release(condition.bytes);
          if (!condition.value) return { kind: "normal" };
          this.budget.step(statement.span, root);
          const exit = this.executeBlock(statement.body, frame, root);
          if (exit.kind === "return") return exit;
          if (exit.kind === "break") return { kind: "normal" };
        }
      case "for":
        return this.executeFor(statement, frame, root);
      case "do-while":
        while (true) {
          this.budget.step(statement.span, root);
          const exit = this.executeBlock(statement.body, frame, root);
          if (exit.kind === "return") return exit;
          if (exit.kind === "break") return { kind: "normal" };
          const condition = this.evaluate(statement.condition, frame, root);
          this.budget.release(condition.bytes);
          if (!condition.value) return { kind: "normal" };
        }
      case "return": {
        if (statement.value === undefined || statement.value === null) {
          return { kind: "return", result: null };
        }
        const evaluated = this.evaluate(statement.value, frame, root);
        const result = this.temporary(evaluated.value, statement.value.type, statement.span, root);
        this.budget.release(evaluated.bytes);
        return { kind: "return", result };
      }
      case "break":
      case "continue":
        return { kind: statement.kind };
      case "switch": {
        const selected = this.evaluate(statement.value, frame, root);
        this.budget.release(selected.bytes);
        const matching = statement.clauses.findIndex(
          (clause) =>
            clause.values !== null &&
            clause.values.some((candidate) => candidate.constant === selected.value),
        );
        const start =
          matching >= 0
            ? matching
            : statement.clauses.findIndex((clause) => clause.values === null);
        for (let index = start; index >= 0 && index < statement.clauses.length; index += 1) {
          const clause = statement.clauses[index]!;
          const exit = this.executeBlock(clause.body, frame, root);
          if (exit.kind === "break") return { kind: "normal" };
          if (exit.kind !== "normal") return exit;
          if (!clause.fallthrough) return { kind: "normal" };
        }
        return { kind: "normal" };
      }
    }
  }

  /** A local is allocated before its initializer can publish a value. */
  private declareLocal(
    statement: TypedVariableStatement,
    frame: Frame,
    root: SourceSpan,
  ): ExecutionExit {
    const bytes = semanticTypeSize(statement.type);
    this.budget.allocate(bytes, statement.span, root);
    frame.allocatedBytes += bytes;
    const key = bindingIdentityKey(statement.binding);
    if (statement.initializer !== null) {
      const value = this.evaluate(statement.initializer, frame, root);
      frame.values.set(key, this.convert(value.value, statement.type));
      this.budget.release(value.bytes);
    }
    return { kind: "normal" };
  }

  /** Only the selected branch is evaluated or charged. */
  private executeIf(statement: TypedIfStatement, frame: Frame, root: SourceSpan): ExecutionExit {
    const condition = this.evaluate(statement.condition, frame, root);
    this.budget.release(condition.bytes);
    if (condition.value) return this.executeBlock(statement.then, frame, root);
    if (statement.otherwise === null) return { kind: "normal" };
    return statement.otherwise.kind === "block"
      ? this.executeBlock(statement.otherwise, frame, root)
      : this.executeIf(statement.otherwise, frame, root);
  }

  /** The for-header local survives iterations and is released after the loop. */
  private executeFor(statement: TypedForStatement, frame: Frame, root: SourceSpan): ExecutionExit {
    let headerBytes = 0;
    let headerKey: string | null = null;
    try {
      if (statement.initializer !== null) {
        if (isExpressionList(statement.initializer)) {
          for (const expression of statement.initializer) {
            const result = this.evaluate(expression, frame, root);
            this.budget.release(result.bytes);
          }
        } else {
          const initial = statement.initializer;
          this.declareLocal(initial, frame, root);
          headerBytes = semanticTypeSize(initial.type);
          headerKey = bindingIdentityKey(initial.binding);
        }
      }
      while (true) {
        if (statement.condition !== null) {
          const condition = this.evaluate(statement.condition, frame, root);
          this.budget.release(condition.bytes);
          if (!condition.value) return { kind: "normal" };
        }
        this.budget.step(statement.span, root);
        const exit = this.executeBlock(statement.body, frame, root);
        if (exit.kind === "return") return exit;
        if (exit.kind === "break") return { kind: "normal" };
        for (const update of statement.update ?? []) {
          const result = this.evaluate(update, frame, root);
          this.budget.release(result.bytes);
        }
      }
    } finally {
      if (headerKey !== null) {
        frame.values.delete(headerKey);
        frame.allocatedBytes -= headerBytes;
        this.budget.release(headerBytes);
      }
    }
  }

  /** Allocate one typed temporary only after its value is known. */
  private temporary(
    value: bigint | boolean,
    type: SemanticType,
    span: SourceSpan,
    root: SourceSpan,
  ): ScalarValue {
    const bytes = semanticTypeSize(type);
    this.budget.allocate(bytes, span, root);
    return { value, bytes };
  }

  private convert(value: bigint | boolean, type: SemanticType): bigint | boolean {
    if (typeof value === "boolean") return value;
    if (type.kind === "enum") return BigInt.asUintN(8, value);
    return wrapInteger(value, type);
  }

  private invalid(span: SourceSpan, message: string): ComptimeSemanticFailure {
    return new ComptimeSemanticFailure(projectDiagnostic("E10191", message, span));
  }
}
