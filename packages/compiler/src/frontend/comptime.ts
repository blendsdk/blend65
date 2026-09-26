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
} from "./semantic-types.js";
import type { TypeSyntax } from "./syntax.js";
import { ComptimeStatements } from "./comptime-statements.js";
import { ComptimeBudget, ComptimeBudgetFailure } from "./comptime-budget.js";
import { ComptimeAggregates, isAggregateValue } from "./comptime-aggregates.js";
import type { AggregateValue, ComptimeFrame, ScalarValue } from "./comptime-aggregates.js";
import { collectConstantDependencies } from "./comptime-dependencies.js";
import { evaluateIntegerTrigonometry, isTrigonometryIntrinsic } from "./trigonometry.js";
import { foldPackedBcd, invalidPackedBcdDigit } from "./machine-intrinsics.js";

/** A checked direct function body with its parameter bindings in source order. */
export interface ComptimeFunction {
  /** Stable source function identity. */
  readonly binding: BindingId;
  /** Parameter storage identities, one per written parameter. */
  readonly parameters: readonly BindingId[];
  /** Typed body with ordinary language conversions already resolved. */
  readonly body: TypedBlock;
}

/** Scalar or aggregate result retained across a compile-time call. */
type EvaluatedValue = ScalarValue | AggregateValue;

type Frame = ComptimeFrame;

/** A source error discards the entire outermost compile-time result. */
class ComptimeSemanticFailure extends Error {
  constructor(readonly diagnostic: ProjectDiagnostic) {
    super(diagnostic.message);
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
  private readonly aggregates: ComptimeAggregates;
  private readonly statements: ComptimeStatements;

  constructor(
    readonly budget: ComptimeBudget,
    readonly constantValue: (binding: BindingId) => bigint | boolean | null,
    readonly diagnose: (diagnostic: ProjectDiagnostic) => void,
    readonly constantAggregate: (binding: BindingId) => readonly number[] | null = () => null,
  ) {
    this.aggregates = new ComptimeAggregates(
      budget,
      constantAggregate,
      (expression, frame, root) => this.evaluate(expression, frame, root),
      (expression, frame, root) => this.call(expression, frame, root),
      (span, message) => {
        throw this.invalid(span, message);
      },
      (expression, current, rhs) => this.assignmentValue(expression, current, rhs),
    );
    this.statements = new ComptimeStatements({
      budget,
      isAggregate: (type) => this.aggregates.isAggregate(type),
      evaluate: (expression, frame, root) => this.evaluate(expression, frame, root),
      evaluateAggregate: (expression, frame, root) =>
        this.aggregates.evaluate(expression, frame, root),
      temporary: (value, type, span, root) => this.temporary(value, type, span, root),
      temporaryAggregate: (value, type, span, root) =>
        this.aggregates.temporary(value, type, span, root),
      chargeAggregateBytes: (count, span, root) => this.aggregates.chargeBytes(count, span, root),
      convert: (value, type) => this.convert(value, type),
    });
  }

  /** Register a typed function body before any constant root is evaluated. */
  registerFunction(entry: ComptimeFunction): void {
    this.functions.set(bindingIdentityKey(entry.binding), entry);
  }

  /** Return exact source binding dependencies, including nested direct calls. */
  constantDependencies(
    bindings: ReadonlyMap<string, SemanticBinding>,
  ): ReadonlyMap<string, readonly BindingId[]> {
    return collectConstantDependencies(this.functions, bindings);
  }

  /** Evaluate one outermost constant, retaining only its final logical value bytes. */
  evaluateRoot(
    expression: TypedExpr,
    type: SemanticType,
    rootName: string,
  ): bigint | boolean | readonly number[] | null {
    const checkpoint = this.budget.liveCheckpoint();
    const root = expression.span;
    const frame: Frame = { values: new Map(), aggregates: new Map(), allocatedBytes: 0 };
    try {
      const result = this.aggregates.isAggregate(type)
        ? this.aggregates.evaluate(expression, frame, root)
        : this.evaluate(expression, frame, root);
      this.budget.allocate(semanticTypeSize(type), root, root);
      if (this.aggregates.isAggregate(type))
        this.aggregates.chargeBytes(semanticTypeSize(type), root, root);
      this.budget.release(result.bytes);
      return isAggregateValue(result)
        ? Object.freeze([...result.value])
        : this.convert(result.value, type);
    } catch (failure) {
      this.budget.abandonRoot(checkpoint);
      if (failure instanceof ComptimeBudgetFailure || failure instanceof ComptimeSemanticFailure) {
        this.diagnose(
          failure instanceof ComptimeBudgetFailure
            ? Object.freeze({
                ...failure.diagnostic,
                message: `${failure.diagnostic.message} while evaluating root '${rootName}'`,
              })
            : failure.diagnostic,
        );
        return null;
      }
      throw failure;
    }
  }

  /** Charge one expression before reading children or mutating evaluator-local state. */
  private evaluate(expression: TypedExpr, frame: Frame, root: SourceSpan): ScalarValue {
    this.budget.step(expression.span, root);
    if (
      (expression.kind === "member" || expression.kind === "index") &&
      expression.object !== undefined &&
      this.aggregates.isAggregate(expression.object.type)
    ) {
      return this.aggregates.readScalar(expression, frame, root);
    }
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
          expression.callee?.name !== undefined &&
          isTrigonometryIntrinsic(expression.callee.name)
        ) {
          const result = this.call(expression, frame, root);
          if (!isAggregateValue(result)) return result;
          break;
        }
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
        {
          const result = this.call(expression, frame, root);
          if (!isAggregateValue(result)) return result;
          break;
        }
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
      target === undefined ||
      typeof valueNode !== "object" ||
      valueNode === null ||
      !("kind" in valueNode)
    ) {
      throw this.invalid(expression.span, "Compile-time assignment needs a local scalar place");
    }
    if (target.kind === "index" || target.kind === "member") {
      return this.aggregates.assignScalar(expression, valueNode, frame, root);
    }
    this.budget.step(target.span, root);
    if (target.binding === null) {
      throw this.invalid(target.span, "Compile-time assignment needs a local scalar place");
    }
    const key = bindingIdentityKey(target.binding);
    const current = frame.values.get(key);
    if (current === undefined) {
      throw this.invalid(target.span, "Compile-time assignment cannot write runtime storage");
    }
    const rhs = this.evaluate(valueNode, frame, root);
    const converted = this.assignmentValue(expression, current, rhs.value);
    const result = this.temporary(converted, expression.type, expression.span, root);
    frame.values.set(key, converted);
    this.budget.release(rhs.bytes);
    return result;
  }

  /** Use identical fixed-width compound arithmetic for scalar and aggregate places. */
  private assignmentValue(
    expression: TypedExpr,
    current: bigint | boolean,
    rhs: bigint | boolean,
  ): bigint | boolean {
    const type = expression.target?.type ?? expression.type;
    let value: bigint | boolean | null = rhs;
    if (expression.operator !== "=") {
      if (typeof current !== "bigint" || typeof rhs !== "bigint") {
        throw this.invalid(expression.span, "Compound assignment requires integer operands");
      }
      value = evaluateBinaryInteger(expression.operator?.slice(0, -1) ?? "", current, rhs, type);
    }
    if (value === null) throw this.invalid(expression.span, "Compile-time arithmetic is undefined");
    return this.convert(value, type);
  }

  /** Resolve only a registered direct compile-time function, never a runtime target. */
  private call(expression: TypedExpr, caller: Frame, root: SourceSpan): EvaluatedValue {
    const callee = expression.callee;
    if (callee?.name === "bcd_add" || callee?.name === "bcd_sub") {
      this.budget.enterCall(expression.span, root, callee.name);
      let argumentBytes = 0;
      try {
        this.budget.step(callee.span, root);
        const operands = expression.arguments ?? [];
        if (operands.length !== 2)
          throw this.invalid(expression.span, "Incomplete packed-BCD call");
        const left = this.evaluate(operands[0]!, caller, root);
        argumentBytes += left.bytes;
        const right = this.evaluate(operands[1]!, caller, root);
        argumentBytes += right.bytes;
        if (typeof left.value !== "bigint" || typeof right.value !== "bigint") {
          throw this.invalid(expression.span, "Packed-BCD operands must be unsigned integers");
        }
        const digits: 2 | 4 =
          expression.type.kind === "scalar" && expression.type.name === "word" ? 4 : 2;
        for (const [index, value] of [left.value, right.value].entries()) {
          if (invalidPackedBcdDigit(value, digits)) {
            throw new ComptimeSemanticFailure(
              projectDiagnostic(
                "E10254",
                "Packed BCD operand contains a non-decimal digit",
                operands[index]!.span,
              ),
            );
          }
        }
        return this.temporary(
          foldPackedBcd(callee.name, left.value, right.value, digits),
          expression.type,
          expression.span,
          root,
        );
      } finally {
        this.budget.release(argumentBytes);
        this.budget.leaveCall();
      }
    }
    if (callee?.name !== undefined && isTrigonometryIntrinsic(callee.name)) {
      this.budget.enterCall(expression.span, root, callee.name);
      let argumentBytes = 0;
      try {
        this.budget.step(callee.span, root);
        const argument = expression.arguments?.[0];
        if (argument === undefined)
          throw this.invalid(expression.span, "Missing trigonometry phase");
        const phase = this.evaluate(argument, caller, root);
        argumentBytes = phase.bytes;
        if (typeof phase.value !== "bigint") {
          throw this.invalid(argument.span, "Trigonometry requires an integer phase");
        }
        return this.temporary(
          evaluateIntegerTrigonometry(callee.name, phase.value),
          expression.type,
          expression.span,
          root,
        );
      } finally {
        this.budget.release(argumentBytes);
        this.budget.leaveCall();
      }
    }
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
    this.budget.enterCall(expression.span, root, callee.name);
    this.active.add(key);
    const frame: Frame = { values: new Map(), aggregates: new Map(), allocatedBytes: 0 };
    let argumentBytes = 0;
    try {
      this.budget.step(callee.span, root);
      const arguments_ = expression.arguments ?? [];
      for (const [index, argument] of arguments_.entries()) {
        const parameter = target.parameters[index];
        if (parameter === undefined) {
          throw this.invalid(expression.span, "Compile-time call parameter count is incomplete");
        }
        const value = this.aggregates.isAggregate(argument.type)
          ? this.aggregates.evaluate(argument, caller, root)
          : this.evaluate(argument, caller, root);
        argumentBytes += value.bytes;
        this.budget.allocate(semanticTypeSize(argument.type), argument.span, root);
        frame.allocatedBytes += semanticTypeSize(argument.type);
        if (isAggregateValue(value)) {
          this.aggregates.chargeBytes(value.value.length, argument.span, root);
          frame.aggregates.set(bindingIdentityKey(parameter), [...value.value]);
        } else {
          frame.values.set(bindingIdentityKey(parameter), value.value);
        }
      }
      this.budget.release(argumentBytes);
      argumentBytes = 0;
      const exit = this.statements.executeBlock(target.body, frame, root);
      if (exit.kind !== "return" || exit.result === null) {
        throw this.invalid(expression.span, "Compile-time function did not return a value");
      }
      const result = isAggregateValue(exit.result)
        ? this.aggregates.temporary(exit.result.value, expression.type, expression.span, root)
        : this.temporary(
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
