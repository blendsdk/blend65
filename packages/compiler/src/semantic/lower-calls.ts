import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticBinding, SemanticType, TypedExpr } from "../frontend/semantic-types.js";
import type { ControlFlowBuilder } from "./cfg.js";
import { required } from "./lower-control.js";
import type { AggregateDestination, ArrayCountSource, ValueId } from "./operations.js";

/** Return whether a scalar type is the language's void type. */
function isVoid(type: SemanticType): boolean {
  return type.kind === "scalar" && type.name === "void";
}

/** Lower ordered call arguments, intrinsics and selected platform effects into the owning CFG. */
export class CallLowerer {
  /** Share the current expression builder without adding a second evaluation path. */
  constructor(
    private readonly builder: ControlFlowBuilder,
    private readonly bindingsByKey: ReadonlyMap<string, SemanticBinding>,
    private readonly lower: (
      expression: TypedExpr,
      destination?: AggregateDestination,
    ) => ValueId | null,
  ) {}

  /** Lower raw-memory, profile, or ordinary direct calls after source-ordered arguments. */
  lowerCall(
    expression: TypedExpr,
    type: SemanticType,
    destination?: AggregateDestination,
  ): ValueId | null {
    if (expression.embedded !== undefined) {
      const result = this.builder.nextValue();
      this.builder.emit(
        Object.freeze({
          kind: "embedded-address",
          result,
          asset: expression.embedded.assetId,
          type,
          integer: expression.integer,
          span: expression.span,
        }),
      );
      return result;
    }
    const callee = required(expression.callee, "call target");
    const binding =
      callee.binding === null ? null : this.bindingsByKey.get(bindingIdentityKey(callee.binding));
    const target =
      callee.type.kind === "function" && binding?.storage !== "function"
        ? this.lower(callee)
        : null;
    const capability = binding?.qualifiedName ?? binding?.name;
    const sinkArgument = expression.arguments?.[0];
    if (
      binding?.operationEffect !== undefined &&
      (capability === "c64.system.setIRQ" || capability === "c64.system.setIRQExclusive") &&
      expression.arguments?.length === 1 &&
      sinkArgument?.kind === "conditional" &&
      isVoid(type)
    ) {
      this.lowerInterruptSinkChoice(expression, sinkArgument, binding);
      return null;
    }
    const arguments_ = (expression.arguments ?? []).map((argument) => {
      const value = this.lower(argument);
      if (value === null) throw new Error("Completed call argument has no value");
      return value;
    });
    if (expression.memory !== null && expression.memory !== undefined) {
      return this.lowerMemory(expression, type, arguments_);
    }

    if (target !== null && callee.type.kind === "function") {
      const argumentArrayCounts = (expression.arguments ?? []).map((argument, index) => {
        const parameter = expression.signature?.parameters[index];
        if (!parameter?.outerUnsized) return null;
        if (argument.outerUnsized && argument.binding !== null)
          return Object.freeze({ kind: "parameter" as const, binding: argument.binding });
        if (argument.type.kind === "array")
          return Object.freeze({ kind: "fixed" as const, count: argument.type.length });
        throw new Error("Unsized array argument has no count source");
      });
      const result = isVoid(type) ? null : this.builder.nextValue();
      this.builder.emit(
        Object.freeze({
          kind: "indirect-call",
          result,
          target,
          ...(expression.calleeDisplay === undefined
            ? {}
            : { targetDisplay: expression.calleeDisplay }),
          ...(expression.calleeDeclaration === undefined
            ? {}
            : { calleeDeclaration: expression.calleeDeclaration }),
          arguments: Object.freeze(arguments_),
          ...(argumentArrayCounts.some((count) => count !== null)
            ? { argumentArrayCounts: Object.freeze(argumentArrayCounts) }
            : {}),
          signature: callee.type,
          type,
          ...(destination === undefined ? {} : { aggregateDestination: destination }),
          span: expression.span,
        }),
      );
      return result;
    }
    if (callee.binding === null) {
      if (
        callee.name === "asm_sei" ||
        callee.name === "asm_cli" ||
        callee.name === "asm_php" ||
        callee.name === "asm_plp" ||
        callee.name === "asm_nop"
      ) {
        this.builder.emit(
          Object.freeze({ kind: "cpu-control", control: callee.name, span: expression.span }),
        );
        return null;
      }
      if ((callee.name === "bcd_add" || callee.name === "bcd_sub") && arguments_.length === 2) {
        const result = this.builder.nextValue();
        const width = type.kind === "scalar" && type.name === "word" ? 2 : 1;
        this.builder.emit(
          Object.freeze({
            kind: "bcd",
            result,
            operator: callee.name === "bcd_add" ? "add" : "sub",
            left: arguments_[0]!,
            right: arguments_[1]!,
            width,
            validLeft: typeof expression.arguments?.[0]?.constant === "bigint",
            validRight: typeof expression.arguments?.[1]?.constant === "bigint",
            flagEffects: "owned-decimal-region",
            type,
            integer: expression.integer,
            span: expression.span,
          }),
        );
        return result;
      }
      if ((callee.name === "lo" || callee.name === "hi") && arguments_.length === 1) {
        const result = this.builder.nextValue();
        this.builder.emit(
          Object.freeze({
            kind: "unary",
            result,
            operator: callee.name,
            operand: arguments_[0]!,
            type,
            integer: expression.integer,
            span: expression.span,
          }),
        );
        return result;
      }
      throw new Error("Completed direct call has no resolved callee");
    }
    const argumentArrayCounts: (ArrayCountSource | null)[] = (expression.arguments ?? []).map(
      (argument, index) => {
        const parameter = expression.signature?.parameters[index];
        if (!parameter?.outerUnsized) return null;
        if (argument.outerUnsized) {
          if (argument.binding === null || argument.binding === undefined) {
            throw new Error("Forwarded unsized array has no parameter binding");
          }
          return Object.freeze({ kind: "parameter" as const, binding: argument.binding });
        }
        if (argument.type.kind !== "array")
          throw new Error("Unsized array argument has no array extent");
        return Object.freeze({ kind: "fixed" as const, count: argument.type.length });
      },
    );
    const result = isVoid(type) ? null : this.builder.nextValue();
    if (binding?.operationEffect !== undefined) {
      this.builder.emit(
        Object.freeze({
          kind: "platform",
          result,
          capability: binding.qualifiedName ?? binding.name,
          arguments: Object.freeze(arguments_),
          type,
          effect: binding.operationEffect,
          span: expression.span,
        }),
      );
    } else {
      this.builder.emit(
        Object.freeze({
          kind: "call",
          result,
          callee: callee.binding,
          arguments: Object.freeze(arguments_),
          ...(argumentArrayCounts.some((count) => count !== null)
            ? { argumentArrayCounts: Object.freeze(argumentArrayCounts) }
            : {}),
          type,
          ...(destination === undefined ? {} : { aggregateDestination: destination }),
          span: expression.span,
        }),
      );
    }
    return result;
  }

  /** Keep a conditional handler choice in control flow instead of constructing raw handler addresses. */
  private lowerInterruptSinkChoice(
    call: TypedExpr,
    choice: TypedExpr,
    binding: SemanticBinding,
  ): void {
    if (choice.kind !== "conditional") {
      const argument = this.lower(choice);
      if (argument === null) throw new Error("Completed interrupt sink argument has no value");
      this.builder.emit(
        Object.freeze({
          kind: "platform",
          result: null,
          capability: binding.qualifiedName ?? binding.name,
          arguments: Object.freeze([argument]),
          type: call.type,
          effect: binding.operationEffect!,
          span: call.span,
        }),
      );
      return;
    }
    const conditionNode = required(choice.condition, "interrupt handler condition");
    const whenTrueNode = required(choice.whenTrue, "true interrupt handler");
    const whenFalseNode = required(choice.whenFalse, "false interrupt handler");
    const condition = this.lower(conditionNode);
    if (condition === null) throw new Error("Completed interrupt handler condition has no value");
    if (typeof conditionNode.constant === "boolean") {
      this.lowerInterruptSinkChoice(
        call,
        conditionNode.constant ? whenTrueNode : whenFalseNode,
        binding,
      );
      return;
    }
    const conditionBlock = this.builder.currentBlock!;
    const whenTrue = this.builder.createBlock("interrupt-choice-true");
    const whenFalse = this.builder.createBlock("interrupt-choice-false");
    conditionBlock.terminator = Object.freeze({
      kind: "branch",
      condition,
      whenTrue: whenTrue.id,
      whenFalse: whenFalse.id,
    });
    this.builder.select(whenTrue);
    this.lowerInterruptSinkChoice(call, whenTrueNode, binding);
    const trueExit = this.builder.currentBlock!;
    this.builder.select(whenFalse);
    this.lowerInterruptSinkChoice(call, whenFalseNode, binding);
    const falseExit = this.builder.currentBlock!;
    const merge = this.builder.createBlock("interrupt-choice-end");
    this.builder.jumpFrom(trueExit, merge.id);
    this.builder.jumpFrom(falseExit, merge.id);
    this.builder.select(merge);
  }

  /** Emit one volatile raw-memory access from already evaluated operands. */
  private lowerMemory(
    expression: TypedExpr,
    type: SemanticType,
    arguments_: readonly ValueId[],
  ): ValueId | null {
    const memory = expression.memory!;
    const address = arguments_[0];
    if (address === undefined) throw new Error("Raw-memory operation is missing its address");
    if (memory.access === "read") {
      const result = this.builder.nextValue();
      this.builder.emit(
        Object.freeze({
          kind: "memory-read",
          result,
          address,
          width: memory.width,
          byteOrder: memory.byteOrder,
          volatile: true,
          type,
          integer: expression.integer,
          span: expression.span,
        }),
      );
      return result;
    }
    const value = arguments_[1];
    if (value === undefined) throw new Error("Raw-memory write is missing its value");
    this.builder.emit(
      Object.freeze({
        kind: "memory-write",
        address,
        value,
        width: memory.width,
        byteOrder: memory.byteOrder,
        volatile: true,
        span: expression.span,
      }),
    );
    return null;
  }
}
