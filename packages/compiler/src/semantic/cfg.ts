import { SCALAR_TYPES } from "../frontend/constants.js";
import type {
  SemanticType,
  TypedBlock,
  TypedExpr,
  TypedForStatement,
  TypedIfStatement,
  TypedSwitchStatement,
  TypedStatement,
} from "../frontend/semantic-types.js";
import type {
  BlockId,
  SemanticBlock,
  SemanticOperation,
  SemanticTerminator,
  ValueId,
} from "./operations.js";

/** Mutable construction state which is frozen before leaving this module. */
export interface MutableSemanticBlock {
  /** Stable block identity. */
  readonly id: BlockId;
  /** Operations accumulated in source order. */
  readonly operations: SemanticOperation[];
  /** Final control transfer, or null while the block is open. */
  terminator: SemanticTerminator | null;
}

/** Loop exits visible while lowering one nested source body. */
interface LoopTargets {
  readonly continueTarget: BlockId;
  readonly breakTarget: BlockId;
}

/** Focused callback which lowers one expression into the current CFG block. */
export type LowerSemanticExpression = (expression: TypedExpr) => ValueId | null;

/** Narrow a for initializer without relying on mutable-array inference. */
function isExpressionList(
  initializer: TypedForStatement["initializer"],
): initializer is readonly TypedExpr[] {
  return Array.isArray(initializer);
}

/** Return whether a scalar type is the language's void type. */
function isVoid(type: SemanticType): boolean {
  return type.kind === "scalar" && type.name === "void";
}

/** Direct stateful builder for structured source control flow. */
export class ControlFlowBuilder {
  private readonly blocks: MutableSemanticBlock[] = [];
  private readonly prefix: string;
  private blockCounter = 0;
  private valueCounter = 0;
  private current: MutableSemanticBlock | null;

  /** Create a builder with one live entry block. */
  constructor(prefix: string) {
    this.prefix = prefix;
    this.current = this.createBlock("entry");
  }

  /** Stable identity of the first block. */
  get entry(): BlockId {
    return this.blocks[0]!.id;
  }

  /** Current open block, or null after a terminal source exit. */
  get currentBlock(): MutableSemanticBlock | null {
    return this.current;
  }

  /** Lower an entire source block in statement order. */
  lowerBody(
    body: TypedBlock,
    lowerExpression: LowerSemanticExpression,
    loop: LoopTargets | null = null,
  ): void {
    for (const statement of body.statements) {
      if (this.current === null) break;
      this.lowerStatement(statement, lowerExpression, loop);
    }
  }

  /** Terminate a live fallthrough and return an immutable CFG. */
  finish(resultType: SemanticType): readonly SemanticBlock[] {
    if (this.current !== null && this.current.terminator === null) {
      this.terminate(
        isVoid(resultType)
          ? Object.freeze({ kind: "return", value: null })
          : Object.freeze({ kind: "unreachable" }),
      );
    }
    for (const block of this.blocks) {
      if (block.terminator === null) block.terminator = Object.freeze({ kind: "unreachable" });
    }
    return Object.freeze(
      this.blocks.map((block) =>
        Object.freeze({
          id: block.id,
          operations: Object.freeze([...block.operations]),
          terminator: block.terminator!,
        }),
      ),
    );
  }

  /** Create one empty block in deterministic construction order. */
  createBlock(label: string): MutableSemanticBlock {
    const block: MutableSemanticBlock = {
      id: `${this.prefix}:b${this.blockCounter++}:${label}`,
      operations: [],
      terminator: null,
    };
    this.blocks.push(block);
    return block;
  }

  /** Select an existing block as the current append target. */
  select(block: MutableSemanticBlock): void {
    this.current = block;
  }

  /** Allocate one stable function-local value identity. */
  nextValue(): ValueId {
    return `${this.prefix}:v${this.valueCounter++}`;
  }

  /** Append one operation to the current live block. */
  emit(operation: SemanticOperation): void {
    if (this.current === null || this.current.terminator !== null) {
      throw new Error("Cannot append an operation after control flow has terminated");
    }
    this.current.operations.push(operation);
  }

  /** End the current block and clear the fallthrough cursor. */
  terminate(terminator: SemanticTerminator): void {
    if (this.current === null || this.current.terminator !== null) {
      throw new Error("Cannot terminate an already terminated semantic block");
    }
    this.current.terminator = terminator;
    this.current = null;
  }

  /** End a named block only when it still has a live fallthrough. */
  jumpFrom(block: MutableSemanticBlock | null, target: BlockId): void {
    if (block === null || block.terminator !== null) return;
    block.terminator = Object.freeze({ kind: "jump", target });
  }

  /** Lower one typed statement while preserving structured control exits. */
  private lowerStatement(
    statement: TypedStatement,
    lowerExpression: LowerSemanticExpression,
    loop: LoopTargets | null,
  ): void {
    switch (statement.kind) {
      case "variable": {
        if (statement.initializer === null) return;
        const value = lowerExpression(statement.initializer);
        if (value === null) throw new Error("Completed local initializer did not produce a value");
        this.emit(
          Object.freeze({
            kind: "store",
            place: Object.freeze({ root: statement.binding, path: Object.freeze([]) }),
            value,
            type: statement.type,
            span: statement.span,
          }),
        );
        return;
      }
      case "expression-statement":
        lowerExpression(statement.expression);
        return;
      case "block":
        this.lowerBody(statement, lowerExpression, loop);
        return;
      case "if":
        this.lowerIf(statement, lowerExpression, loop);
        return;
      case "while":
        this.lowerWhile(statement.condition, statement.body, lowerExpression);
        return;
      case "for":
        this.lowerFor(statement, lowerExpression);
        return;
      case "do-while":
        this.lowerDoWhile(statement.condition, statement.body, lowerExpression);
        return;
      case "switch":
        this.lowerSwitch(statement, lowerExpression, loop);
        return;
      case "continue":
        if (loop === null) throw new Error("Completed continue statement has no loop target");
        this.terminate(Object.freeze({ kind: "jump", target: loop.continueTarget }));
        return;
      case "break":
        if (loop === null) throw new Error("Completed break statement has no loop target");
        this.terminate(Object.freeze({ kind: "jump", target: loop.breakTarget }));
        return;
      case "return": {
        const value = statement.value == null ? null : lowerExpression(statement.value);
        this.terminate(Object.freeze({ kind: "return", value }));
        return;
      }
    }
  }

  /** Lower a conditional, excluding an arm proved unreachable by frontend constants. */
  private lowerIf(
    statement: TypedIfStatement,
    lowerExpression: LowerSemanticExpression,
    loop: LoopTargets | null,
  ): void {
    const condition = lowerExpression(statement.condition);
    if (condition === null) throw new Error("Completed if condition did not produce a value");
    if (typeof statement.condition.constant === "boolean") {
      if (statement.condition.constant) this.lowerBody(statement.then, lowerExpression, loop);
      else if (statement.otherwise !== null) {
        this.lowerElse(statement.otherwise, lowerExpression, loop);
      }
      return;
    }

    const conditionBlock = this.current;
    if (conditionBlock === null) return;
    const whenTrue = this.createBlock("if-true");
    const whenFalse = this.createBlock("if-false");
    conditionBlock.terminator = Object.freeze({
      kind: "branch",
      condition,
      whenTrue: whenTrue.id,
      whenFalse: whenFalse.id,
    });

    this.select(whenTrue);
    this.lowerBody(statement.then, lowerExpression, loop);
    const trueExit = this.current;
    this.select(whenFalse);
    if (statement.otherwise !== null) {
      this.lowerElse(statement.otherwise, lowerExpression, loop);
    }
    const falseExit = this.current;

    if (trueExit === null && falseExit === null) {
      this.current = null;
      return;
    }
    const merge = this.createBlock("if-end");
    this.jumpFrom(trueExit, merge.id);
    this.jumpFrom(falseExit, merge.id);
    this.select(merge);
  }

  /** Lower either a brace block or a nested else-if chain. */
  private lowerElse(
    otherwise: TypedBlock | TypedIfStatement,
    lowerExpression: LowerSemanticExpression,
    loop: LoopTargets | null,
  ): void {
    if (otherwise.kind === "if") this.lowerIf(otherwise, lowerExpression, loop);
    else this.lowerBody(otherwise, lowerExpression, loop);
  }

  /** Lower a pre-test loop with explicit condition, body, and exit blocks. */
  private lowerWhile(
    conditionExpression: TypedExpr,
    bodySource: TypedBlock,
    lowerExpression: LowerSemanticExpression,
  ): void {
    const entry = this.current;
    if (entry === null) return;
    const conditionBlock = this.createBlock("while-condition");
    const body = this.createBlock("while-body");
    const end = this.createBlock("while-end");
    entry.terminator = Object.freeze({ kind: "jump", target: conditionBlock.id });

    this.select(conditionBlock);
    const condition = lowerExpression(conditionExpression);
    if (condition === null) throw new Error("Completed while condition did not produce a value");
    const conditionIsFalse = conditionExpression.constant === false;
    const conditionIsLiteralTrue =
      conditionExpression.kind === "boolean" && conditionExpression.constant === true;
    if (conditionIsFalse || conditionIsLiteralTrue) {
      this.terminate(
        Object.freeze({
          kind: "jump",
          target: conditionIsFalse ? end.id : body.id,
        }),
      );
    } else {
      this.terminate(
        Object.freeze({ kind: "branch", condition, whenTrue: body.id, whenFalse: end.id }),
      );
    }

    if (!conditionIsFalse) {
      this.select(body);
      this.lowerBody(bodySource, lowerExpression, {
        continueTarget: conditionBlock.id,
        breakTarget: end.id,
      });
      this.jumpFrom(this.current, conditionBlock.id);
    }
    this.select(end);
  }

  /** Lower a post-test loop with its continue edge at the condition. */
  private lowerDoWhile(
    conditionExpression: TypedExpr,
    bodySource: TypedBlock,
    lowerExpression: LowerSemanticExpression,
  ): void {
    const entry = this.current;
    if (entry === null) return;
    const body = this.createBlock("do-body");
    const conditionBlock = this.createBlock("do-condition");
    const end = this.createBlock("do-end");
    entry.terminator = Object.freeze({ kind: "jump", target: body.id });
    this.select(body);
    this.lowerBody(bodySource, lowerExpression, {
      continueTarget: conditionBlock.id,
      breakTarget: end.id,
    });
    this.jumpFrom(this.current, conditionBlock.id);
    this.select(conditionBlock);
    const condition = lowerExpression(conditionExpression);
    if (condition === null) throw new Error("Completed do-while condition has no value");
    this.terminate(
      Object.freeze({ kind: "branch", condition, whenTrue: body.id, whenFalse: end.id }),
    );
    this.select(end);
  }

  /** Compare one selector once against constant labels, then run only the chosen arm. */
  private lowerSwitch(
    statement: TypedSwitchStatement,
    lowerExpression: LowerSemanticExpression,
    loop: LoopTargets | null,
  ): void {
    const selector = lowerExpression(statement.value);
    if (selector === null) throw new Error("Completed switch selector has no value");
    const entry = this.current;
    if (entry === null) return;
    const arms = statement.clauses.map((_, index) => this.createBlock(`switch-arm-${index}`));
    const end = this.createBlock("switch-end");
    const defaultIndex = statement.clauses.findIndex((clause) => clause.values === null);
    const fallback = defaultIndex < 0 ? end.id : arms[defaultIndex]!.id;
    this.select(entry);
    for (const [index, clause] of statement.clauses.entries()) {
      if (clause.values === null) continue;
      for (const value of clause.values) {
        const label = lowerExpression(value);
        if (label === null) throw new Error("Completed switch label has no value");
        const match = this.nextValue();
        this.emit(
          Object.freeze({
            kind: "binary",
            result: match,
            operator: "==",
            left: selector,
            right: label,
            type: SCALAR_TYPES.boolean,
            integer: null,
            span: value.span,
          }),
        );
        const next = this.createBlock("switch-next");
        this.terminate(
          Object.freeze({
            kind: "branch",
            condition: match,
            whenTrue: arms[index]!.id,
            whenFalse: next.id,
          }),
        );
        this.select(next);
      }
    }
    this.terminate(Object.freeze({ kind: "jump", target: fallback }));
    for (const [index, clause] of statement.clauses.entries()) {
      this.select(arms[index]!);
      this.lowerBody(clause.body, lowerExpression, loop);
      this.jumpFrom(this.current, clause.fallthrough ? (arms[index + 1]?.id ?? end.id) : end.id);
    }
    this.select(end);
  }

  /** Lower an ordinary three-clause loop with a distinct update target. */
  private lowerFor(statement: TypedForStatement, lowerExpression: LowerSemanticExpression): void {
    if (statement.initializer !== null) {
      if (isExpressionList(statement.initializer)) {
        for (const expression of statement.initializer) lowerExpression(expression);
      } else {
        this.lowerStatement(statement.initializer, lowerExpression, null);
      }
    }
    const initializerExit = this.current;
    if (initializerExit === null) return;
    const conditionBlock = this.createBlock("for-condition");
    const body = this.createBlock("for-body");
    const update = this.createBlock("for-update");
    const end = this.createBlock("for-end");
    initializerExit.terminator = Object.freeze({ kind: "jump", target: conditionBlock.id });

    this.select(conditionBlock);
    const condition =
      statement.condition === null
        ? this.emitBooleanConstant(true, statement.span)
        : lowerExpression(statement.condition);
    if (condition === null) throw new Error("Completed for condition did not produce a value");
    const conditionIsFalse = statement.condition?.constant === false;
    const conditionIsAlwaysTrue =
      statement.condition === null ||
      (statement.condition.kind === "boolean" && statement.condition.constant === true);
    if (conditionIsFalse || conditionIsAlwaysTrue) {
      this.terminate(Object.freeze({ kind: "jump", target: conditionIsFalse ? end.id : body.id }));
    } else {
      this.terminate(
        Object.freeze({ kind: "branch", condition, whenTrue: body.id, whenFalse: end.id }),
      );
    }

    if (!conditionIsFalse) {
      this.select(body);
      this.lowerBody(statement.body, lowerExpression, {
        continueTarget: update.id,
        breakTarget: end.id,
      });
      this.jumpFrom(this.current, update.id);

      this.select(update);
      for (const expression of statement.update ?? []) lowerExpression(expression);
      this.terminate(Object.freeze({ kind: "jump", target: conditionBlock.id }));
    }
    this.select(end);
  }

  /** Emit the implicit true condition used by `for (;;)` without target facts. */
  private emitBooleanConstant(value: boolean, span: TypedExpr["span"]): ValueId {
    const result = this.nextValue();
    this.emit(
      Object.freeze({
        kind: "constant",
        result,
        value,
        type: Object.freeze({ kind: "scalar", name: "boolean" }),
        integer: null,
        span,
      }),
    );
    return result;
  }
}
