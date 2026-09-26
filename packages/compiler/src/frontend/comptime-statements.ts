import type { SourceSpan } from "../project/types.js";
import { semanticTypeSize } from "./semantic-type-relations.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type {
  SemanticType,
  TypedBlock,
  TypedExpr,
  TypedForStatement,
  TypedIfStatement,
  TypedStatement,
  TypedVariableStatement,
} from "./semantic-types.js";
import type { ComptimeBudget } from "./comptime-budget.js";
import { isAggregateValue } from "./comptime-aggregates.js";
import type { AggregateValue, ComptimeFrame as Frame, ScalarValue } from "./comptime-aggregates.js";
import { isExpressionList } from "./comptime-dependencies.js";

/** A selected value remains live until its enclosing expression releases it. */
type EvaluatedValue = ScalarValue | AggregateValue;

/** An exit from a selected statement or block. */
export type ExecutionExit =
  | { readonly kind: "normal" | "break" | "continue" }
  | { readonly kind: "return"; readonly result: EvaluatedValue | null };

/** Expression operations shared with selected-statement execution. */
export interface ComptimeStatementHost {
  /** Meter shared by all expressions, calls, and statements in a root. */
  readonly budget: ComptimeBudget;
  /** Identify fixed aggregate types. */
  readonly isAggregate: (type: SemanticType) => boolean;
  /** Evaluate a scalar and retain its temporary bytes. */
  readonly evaluate: (expression: TypedExpr, frame: Frame, root: SourceSpan) => ScalarValue;
  /** Evaluate an aggregate and retain its temporary bytes. */
  readonly evaluateAggregate: (
    expression: TypedExpr,
    frame: Frame,
    root: SourceSpan,
  ) => AggregateValue;
  /** Retain a returned scalar before releasing its expression temporary. */
  readonly temporary: (
    value: bigint | boolean,
    type: SemanticType,
    span: SourceSpan,
    root: SourceSpan,
  ) => ScalarValue;
  /** Retain a returned aggregate before releasing its expression temporary. */
  readonly temporaryAggregate: (
    value: readonly number[],
    type: SemanticType,
    span: SourceSpan,
    root: SourceSpan,
  ) => AggregateValue;
  /** Charge the logical byte work of an aggregate copy. */
  readonly chargeAggregateBytes: (count: number, span: SourceSpan, root: SourceSpan) => void;
  /** Apply the destination's integer representation. */
  readonly convert: (value: bigint | boolean, type: SemanticType) => bigint | boolean;
}

/** Execute selected control flow with lexical storage release and shared metering. */
export class ComptimeStatements {
  /** Reuse the evaluator's expression semantics and budget. */
  constructor(private readonly host: ComptimeStatementHost) {}

  /** Execute selected statements in source order, releasing block-local storage on exit. */
  executeBlock(block: TypedBlock, frame: Frame, root: SourceSpan): ExecutionExit {
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
        frame.aggregates.delete(key);
      }
      frame.allocatedBytes -= bytes;
      this.host.budget.release(bytes);
    }
  }

  /** Execute one typed statement; loops charge only iterations they actually enter. */
  private executeStatement(
    statement: TypedStatement,
    frame: Frame,
    root: SourceSpan,
  ): ExecutionExit {
    this.host.budget.step(statement.span, root);
    switch (statement.kind) {
      case "variable":
        return this.declareLocal(statement, frame, root);
      case "expression-statement": {
        const result = this.host.isAggregate(statement.expression.type)
          ? this.host.evaluateAggregate(statement.expression, frame, root)
          : this.host.evaluate(statement.expression, frame, root);
        this.host.budget.release(result.bytes);
        return { kind: "normal" };
      }
      case "block":
        return this.executeBlock(statement, frame, root);
      case "if":
        return this.executeIf(statement, frame, root);
      case "while":
        while (true) {
          const condition = this.host.evaluate(statement.condition, frame, root);
          this.host.budget.release(condition.bytes);
          if (!condition.value) return { kind: "normal" };
          this.host.budget.step(statement.span, root);
          const exit = this.executeBlock(statement.body, frame, root);
          if (exit.kind === "return") return exit;
          if (exit.kind === "break") return { kind: "normal" };
        }
      case "for":
        return this.executeFor(statement, frame, root);
      case "do-while":
        while (true) {
          this.host.budget.step(statement.span, root);
          const exit = this.executeBlock(statement.body, frame, root);
          if (exit.kind === "return") return exit;
          if (exit.kind === "break") return { kind: "normal" };
          const condition = this.host.evaluate(statement.condition, frame, root);
          this.host.budget.release(condition.bytes);
          if (!condition.value) return { kind: "normal" };
        }
      case "return": {
        if (statement.value === undefined || statement.value === null) {
          return { kind: "return", result: null };
        }
        const evaluated = this.host.isAggregate(statement.value.type)
          ? this.host.evaluateAggregate(statement.value, frame, root)
          : this.host.evaluate(statement.value, frame, root);
        const result = isAggregateValue(evaluated)
          ? this.host.temporaryAggregate(
              evaluated.value,
              statement.value.type,
              statement.span,
              root,
            )
          : this.host.temporary(evaluated.value, statement.value.type, statement.span, root);
        this.host.budget.release(evaluated.bytes);
        return { kind: "return", result };
      }
      case "break":
      case "continue":
        return { kind: statement.kind };
      case "switch": {
        const selected = this.host.evaluate(statement.value, frame, root);
        this.host.budget.release(selected.bytes);
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
    this.host.budget.allocate(bytes, statement.span, root);
    frame.allocatedBytes += bytes;
    const key = bindingIdentityKey(statement.binding);
    if (statement.initializer !== null) {
      const value = this.host.isAggregate(statement.type)
        ? this.host.evaluateAggregate(statement.initializer, frame, root)
        : this.host.evaluate(statement.initializer, frame, root);
      if (isAggregateValue(value)) {
        this.host.chargeAggregateBytes(value.value.length, statement.initializer.span, root);
        frame.aggregates.set(key, [...value.value]);
      } else {
        frame.values.set(key, this.host.convert(value.value, statement.type));
      }
      this.host.budget.release(value.bytes);
    } else if (this.host.isAggregate(statement.type)) {
      frame.aggregates.set(key, Array<number>(bytes).fill(-1));
    }
    return { kind: "normal" };
  }

  /** Only the selected branch is evaluated or charged. */
  private executeIf(statement: TypedIfStatement, frame: Frame, root: SourceSpan): ExecutionExit {
    const condition = this.host.evaluate(statement.condition, frame, root);
    this.host.budget.release(condition.bytes);
    if (condition.value) return this.executeBlock(statement.then, frame, root);
    if (statement.otherwise === null) return { kind: "normal" };
    return statement.otherwise.kind === "block"
      ? this.executeBlock(statement.otherwise, frame, root)
      : this.executeStatement(statement.otherwise, frame, root);
  }

  /** The for-header local survives iterations and is released after the loop. */
  private executeFor(statement: TypedForStatement, frame: Frame, root: SourceSpan): ExecutionExit {
    let headerBytes = 0;
    let headerKey: string | null = null;
    try {
      if (statement.initializer !== null) {
        if (isExpressionList(statement.initializer)) {
          for (const expression of statement.initializer) {
            const result = this.host.isAggregate(expression.type)
              ? this.host.evaluateAggregate(expression, frame, root)
              : this.host.evaluate(expression, frame, root);
            this.host.budget.release(result.bytes);
          }
        } else {
          const initial = statement.initializer;
          this.executeStatement(initial, frame, root);
          headerBytes = semanticTypeSize(initial.type);
          headerKey = bindingIdentityKey(initial.binding);
        }
      }
      while (true) {
        if (statement.condition !== null) {
          const condition = this.host.evaluate(statement.condition, frame, root);
          this.host.budget.release(condition.bytes);
          if (!condition.value) return { kind: "normal" };
        }
        this.host.budget.step(statement.span, root);
        const exit = this.executeBlock(statement.body, frame, root);
        if (exit.kind === "return") return exit;
        if (exit.kind === "break") return { kind: "normal" };
        for (const update of statement.update ?? []) {
          const result = this.host.isAggregate(update.type)
            ? this.host.evaluateAggregate(update, frame, root)
            : this.host.evaluate(update, frame, root);
          this.host.budget.release(result.bytes);
        }
      }
    } finally {
      if (headerKey !== null) {
        frame.values.delete(headerKey);
        frame.aggregates.delete(headerKey);
        frame.allocatedBytes -= headerBytes;
        this.host.budget.release(headerBytes);
      }
    }
  }
}
