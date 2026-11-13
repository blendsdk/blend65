import type { BinaryOperation } from "../semantic/operations.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";
import {
  machineCost,
  machineInstruction,
  machineState,
  modeForValue,
  operandForValue,
} from "./lower-control.js";
import { lowerBooleanBranch } from "./lower-boolean-branch.js";
import { appendLoadA, loweringFailure } from "./lower-state.js";
import type { FunctionLoweringState } from "./lower-state.js";
import type { LoweredValue } from "./lower-control.js";
import type { BooleanMaskTest } from "./machine-types.js";

export type { BooleanMaskTest } from "./machine-types.js";

/** Return whether one value has exactly one bit set in its low sixteen bits. */
function singleBitMask(value: number): boolean {
  return value > 0 && value <= 0xffff && (value & (value - 1)) === 0;
}

/** Invert one equality operator. */
function invertedOperator(operator: string): "==" | "!=" {
  return operator === "==" ? "!=" : "==";
}

/** Build one immediate exclusive-or of A with a byte constant. */
function exclusiveOrImmediate(
  state: FunctionLoweringState,
  value: number,
  source: BinaryOperation["span"],
): MachineInstruction {
  return machineInstruction(
    state.input.profile.cpu,
    "eor",
    "immediate",
    Object.freeze({ kind: "immediate", value }),
    [],
    source,
  );
}

/** Build one immediate compare of A with a byte constant. */
function compareImmediate(
  state: FunctionLoweringState,
  value: number,
  source: BinaryOperation["span"],
): MachineInstruction {
  return machineInstruction(
    state.input.profile.cpu,
    "cmp",
    "immediate",
    Object.freeze({ kind: "immediate", value }),
    [],
    source,
  );
}

/** Build one immediate load of the canonical Boolean one. */
function loadOne(
  state: FunctionLoweringState,
  source: BinaryOperation["span"],
): MachineInstruction {
  return machineInstruction(
    state.input.profile.cpu,
    "lda",
    "immediate",
    Object.freeze({ kind: "immediate", value: 1 }),
    [],
    source,
  );
}

/** Build one immediate inversion of the canonical Boolean zero or one. */
function invertBoolean(
  state: FunctionLoweringState,
  source: BinaryOperation["span"],
): MachineInstruction {
  return machineInstruction(
    state.input.profile.cpu,
    "eor",
    "immediate",
    Object.freeze({ kind: "immediate", value: 1 }),
    [],
    source,
  );
}

/** Build one conditional terminator whose only live input is Z. */
function branchOnZero(
  state: FunctionLoweringState,
  opcode: "beq" | "bne",
  target: string,
  fallthrough: string,
): MachineBlock["terminator"] {
  return Object.freeze({
    kind: "branch",
    opcode,
    target,
    fallthrough,
    uses: machineState([], ["z"]),
    cost: machineCost(state.input.profile.cpu, opcode, "relative"),
  });
}

/** Return whether one lowered value currently holds its only observed byte in A. */
function inRegisterA(value: LoweredValue): boolean {
  if (value.kind === "register") return value.registers === "a" && value.bytes === 1;
  return (
    value.kind === "zero-extended" &&
    value.low.kind === "register" &&
    value.low.registers === "a" &&
    value.low.bytes === 1
  );
}

/**
 * Split the current block into the expert word-mask join.
 *
 * The low masked byte is already in A and its `AND` already set Z. The join
 * tests the high masked byte only when the low byte is zero, so both bytes are
 * observed without a two-byte temporary. The `!=` form loads one on the
 * nonzero path; the `==` form inverts the shared zero arm. No storage request
 * or data object is created.
 * @param operation The selected `== 0`/`!= 0` comparison.
 * @param test Selected word mask and comparison constant.
 * @param masked Lowered `masked-word` value carrying the addressable operand.
 * @param state Exact selected CPU, span and current stack plan.
 * @param entryLabel Label of the block that already contains the low masked byte.
 * @param prefix Instructions already emitted into that block.
 * @param ordinal Monotone per-block split index for unique labels.
 * @returns The split blocks and the continuation label for the remaining source.
 */
function lowerWordMaskComparison(
  operation: BinaryOperation,
  test: BooleanMaskTest,
  masked: Extract<LoweredValue, { readonly kind: "masked-word" }>,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } {
  const highLabel = `${entryLabel}.boolean.${ordinal}.high`;
  const nonzeroLabel = `${entryLabel}.boolean.${ordinal}.nonzero`;
  const zeroLabel = `${entryLabel}.boolean.${ordinal}.zero`;
  const trueLabel = `${entryLabel}.boolean.${ordinal}.true`;
  const falseLabel = `${entryLabel}.boolean.${ordinal}.false`;
  const continuation = `${entryLabel}.boolean.${ordinal}.continue`;
  if (test.highMask === undefined)
    throw loweringFailure("Word mask comparison has no high mask byte", operation.span);
  const highTest: MachineInstruction[] = [];
  appendLoadA(highTest, masked.operand, 1, state, operation.span);
  highTest.push(
    machineInstruction(
      state.input.profile.cpu,
      "and",
      "immediate",
      Object.freeze({ kind: "immediate", value: test.highMask }),
      [],
      operation.span,
    ),
  );
  const one = loadOne(state, operation.span);
  const zero = machineInstruction(
    state.input.profile.cpu,
    "lda",
    "immediate",
    Object.freeze({ kind: "immediate", value: 0 }),
    [],
    operation.span,
  );
  if (test.constant === 0) {
    // A zero comparison is the joined zero test: the low AND owns Z, and the
    // high AND owns Z only when the low byte was zero.
    const blocks: readonly MachineBlock[] =
      operation.operator === "!="
        ? Object.freeze([
            Object.freeze({
              label: entryLabel,
              instructions: Object.freeze([...prefix]),
              terminator: branchOnZero(state, "bne", nonzeroLabel, highLabel),
            }),
            Object.freeze({
              label: highLabel,
              instructions: Object.freeze(highTest),
              terminator: branchOnZero(state, "beq", continuation, nonzeroLabel),
            }),
            Object.freeze({
              label: nonzeroLabel,
              instructions: Object.freeze([one]),
              terminator: Object.freeze({ kind: "fallthrough" as const, target: continuation }),
            }),
          ])
        : Object.freeze([
            Object.freeze({
              label: entryLabel,
              instructions: Object.freeze([...prefix]),
              terminator: branchOnZero(state, "bne", nonzeroLabel, highLabel),
            }),
            Object.freeze({
              label: highLabel,
              instructions: Object.freeze(highTest),
              terminator: branchOnZero(state, "beq", zeroLabel, nonzeroLabel),
            }),
            Object.freeze({
              label: nonzeroLabel,
              instructions: Object.freeze([one]),
              terminator: Object.freeze({ kind: "fallthrough" as const, target: zeroLabel }),
            }),
            Object.freeze({
              label: zeroLabel,
              instructions: Object.freeze([invertBoolean(state, operation.span)]),
              terminator: Object.freeze({ kind: "fallthrough" as const, target: continuation }),
            }),
          ]);
    return Object.freeze({ blocks, continuation });
  }
  // A general nonzero word constant needs one equality test per masked byte.
  // The low CMP starts the split; the high CMP confirms only when the low byte
  // matched. The arms load the canonical Boolean, so the result is in A.
  const lowConstant = test.constant & 0xff;
  const highConstant = (test.constant >> 8) & 0xff;
  highTest.push(compareImmediate(state, highConstant, operation.span));
  const entry: MachineInstruction[] = [
    ...prefix,
    compareImmediate(state, lowConstant, operation.span),
  ];
  const blocks: readonly MachineBlock[] =
    operation.operator === "=="
      ? Object.freeze([
          Object.freeze({
            label: entryLabel,
            instructions: Object.freeze(entry),
            terminator: branchOnZero(state, "bne", falseLabel, highLabel),
          }),
          Object.freeze({
            label: highLabel,
            instructions: Object.freeze(highTest),
            terminator: branchOnZero(state, "beq", trueLabel, falseLabel),
          }),
          Object.freeze({
            label: falseLabel,
            instructions: Object.freeze([zero]),
            terminator: branchOnZero(state, "beq", continuation, trueLabel),
          }),
          Object.freeze({
            label: trueLabel,
            instructions: Object.freeze([one]),
            terminator: Object.freeze({ kind: "fallthrough" as const, target: continuation }),
          }),
        ])
      : Object.freeze([
          Object.freeze({
            label: entryLabel,
            instructions: Object.freeze(entry),
            terminator: branchOnZero(state, "bne", trueLabel, highLabel),
          }),
          Object.freeze({
            label: highLabel,
            instructions: Object.freeze(highTest),
            terminator: branchOnZero(state, "beq", falseLabel, trueLabel),
          }),
          Object.freeze({
            label: trueLabel,
            instructions: Object.freeze([one]),
            terminator: branchOnZero(state, "bne", continuation, falseLabel),
          }),
          Object.freeze({
            label: falseLabel,
            instructions: Object.freeze([zero]),
            terminator: Object.freeze({ kind: "fallthrough" as const, target: continuation }),
          }),
        ]);
  return Object.freeze({ blocks, continuation });
}

/**
 * Materialize one selected masked comparison with the expert inline branch.
 *
 * A masked byte (or the low byte of a zero-extended word) is already in A and
 * its `AND` already set Z. A single-bit mask equal to the constant inverts the
 * zero test; every other byte constant emits `EOR #C` and keeps the source
 * sense. A word mask starts the two-byte join. The comparison result is left in
 * A, so no storage request, helper call or data object is created.
 * @param operation The selected `==`/`!=` comparison.
 * @param test Selection facts recorded for the masked value.
 * @param masked Exact lowered representation of that value.
 * @param state Exact CPU, span and stack-plan state.
 * @param entryLabel Label of the block holding the masked value.
 * @param prefix Instructions already emitted into that block.
 * @param ordinal Monotone per-block split index for unique labels.
 * @returns The split blocks and the continuation label.
 */
export function lowerMaskedComparison(
  operation: BinaryOperation,
  test: BooleanMaskTest,
  masked: LoweredValue | undefined,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
): {
  readonly blocks: readonly MachineBlock[];
  readonly continuation: string;
  readonly instructions?: readonly MachineInstruction[];
} {
  if (masked === undefined)
    throw loweringFailure("Selected masked comparison value was not lowered", operation.span);
  if (test.form === "word-align") {
    if (masked.kind !== "word-aligned")
      throw loweringFailure(
        "Selected aligned word-mask comparison does not have an aligned value",
        operation.span,
      );
    const instructions: MachineInstruction[] = [
      machineInstruction(
        state.input.profile.cpu,
        masked.combine,
        modeForValue(masked.other, masked.otherOffset),
        operandForValue(masked.other, masked.otherOffset),
        [],
        operation.span,
      ),
    ];
    // Normalize the combined selected bit to 0/1. Low positions are cheapest
    // with AND plus LSRs; high positions with ASL to carry, LDA #0 and ROL.
    if (masked.normalize >= 5) {
      for (let step = 0; step < 8 - masked.normalize; step += 1)
        instructions.push(
          machineInstruction(
            state.input.profile.cpu,
            "asl",
            "accumulator",
            null,
            [],
            operation.span,
          ),
        );
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "lda",
          "immediate",
          Object.freeze({ kind: "immediate", value: 0 }),
          [],
          operation.span,
        ),
        machineInstruction(state.input.profile.cpu, "rol", "accumulator", null, [], operation.span),
      );
    } else {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "and",
          "immediate",
          Object.freeze({ kind: "immediate", value: 1 << masked.normalize }),
          [],
          operation.span,
        ),
      );
      for (let step = 0; step < masked.normalize; step += 1)
        instructions.push(
          machineInstruction(
            state.input.profile.cpu,
            "lsr",
            "accumulator",
            null,
            [],
            operation.span,
          ),
        );
    }
    const invert =
      (test.constant === 0 && operation.operator === "==") ||
      (test.constant === test.mask && operation.operator === "!=");
    if (invert) instructions.push(invertBoolean(state, operation.span));
    return Object.freeze({
      blocks: Object.freeze([]),
      continuation: entryLabel,
      instructions: Object.freeze(instructions),
    });
  }
  if (test.form === "word") {
    if (masked.kind !== "masked-word")
      throw loweringFailure(
        "Selected word-mask comparison does not have a joined masked value",
        operation.span,
      );
    return lowerWordMaskComparison(operation, test, masked, state, entryLabel, prefix, ordinal);
  }
  if (!inRegisterA(masked))
    throw loweringFailure(
      "Selected byte-mask comparison value is not in register A",
      operation.span,
    );
  // A high-byte-only word mask already reduced to its masked high byte in A;
  // compare that byte with 0 (zero test) or with the high mask itself.
  const byteTest =
    test.form === "word-high"
      ? Object.freeze({
          ...test,
          form: "byte" as const,
          constant: (test.constant >> 8) & 0xff,
          mask: test.highMask ?? null,
        })
      : test;
  const identity =
    byteTest.mask !== null && byteTest.constant === byteTest.mask && singleBitMask(byteTest.mask);
  const effective = identity ? invertedOperator(operation.operator) : operation.operator;
  const instructions = [...prefix];
  // CMP sets Z but preserves A; the shared zero-test splitter assumes the
  // equality path has A=0. EOR leaves A=0 exactly on equality, at the same
  // two-byte/two-cycle cost, and the masked value is single-use.
  if (!identity && byteTest.constant !== 0)
    instructions.push(exclusiveOrImmediate(state, byteTest.constant, operation.span));
  return lowerBooleanBranch(
    Object.freeze({ ...operation, operator: effective }),
    state,
    entryLabel,
    Object.freeze(instructions),
    ordinal,
  );
}
