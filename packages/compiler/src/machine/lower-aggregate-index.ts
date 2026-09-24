import type { SourceSpan } from "../project/types.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  appendLoadA,
  loadA,
  loweringFailure,
  requestStorage,
  storeA,
  type FunctionLoweringState,
} from "./lower.js";

/** One dynamic packed offset selected while walking an aggregate place. */
export interface AggregateIndexTerm {
  /** Retained semantic value whose bytes encode the ordinal. */
  readonly value: string;
  /** Packed byte width of one selected array element. */
  readonly stride: number;
  /** Fixed element count at this array level. */
  readonly extent: number;
}

/** Store one immediate byte without introducing a pseudo-instruction. */
function appendImmediateStore(
  instructions: MachineInstruction[],
  value: number,
  destination: LoweredValue,
  offset: number,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "lda",
      "immediate",
      Object.freeze({ kind: "immediate", value: value & 0xff }),
      [],
      source,
    ),
    storeA(destination, offset, state, source),
  );
}

/** Widen and scale one ordinal into a reusable two-byte SFA temporary. */
export function lowerAggregateIndex(
  term: AggregateIndexTerm,
  state: FunctionLoweringState,
  source: SourceSpan,
): { readonly instructions: readonly MachineInstruction[]; readonly value: LoweredValue } {
  const index = state.values.get(term.value);
  if (index === undefined || index.kind === "condition" || index.bytes > 2) {
    throw loweringFailure("Aggregate index has no retained byte/word value", source);
  }
  const candidateRequest = requestStorage(
    state,
    "aggregate-index-candidate",
    "temporary",
    2,
    "ram",
    source,
    "Widened and shifted aggregate index",
  );
  const candidate: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: candidateRequest.id,
    bytes: 2,
    signed: false,
  });
  const instructions: MachineInstruction[] = [];
  appendLoadA(instructions, index, 0, state, source);
  instructions.push(storeA(candidate, 0, state, source));
  if (index.bytes === 2) {
    appendLoadA(instructions, index, 1, state, source);
    instructions.push(storeA(candidate, 1, state, source));
  } else if (index.signed === true) {
    appendLoadA(instructions, index, 0, state, source);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "cmp",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0x80 }),
        [],
        source,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        source,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "sbc",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        source,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "eor",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0xff }),
        [],
        source,
      ),
      storeA(candidate, 1, state, source),
    );
  } else {
    appendImmediateStore(instructions, 0, candidate, 1, state, source);
  }

  if (term.stride === 1) {
    return Object.freeze({ instructions: Object.freeze(instructions), value: candidate });
  }
  if ((term.stride & (term.stride - 1)) === 0) {
    for (let shift = 0; shift < Math.log2(term.stride); shift += 1) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "asl",
          "storage",
          operandForValue(candidate, 0),
          [],
          source,
        ),
        machineInstruction(
          state.input.profile.cpu,
          "rol",
          "storage",
          operandForValue(candidate, 1),
          [],
          source,
        ),
      );
    }
    return Object.freeze({ instructions: Object.freeze(instructions), value: candidate });
  }

  if (
    term.stride === 5 &&
    index.bytes === 1 &&
    index.signed !== true &&
    index.kind !== "register"
  ) {
    for (let shift = 0; shift < 2; shift += 1) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "asl",
          "storage",
          operandForValue(candidate, 0),
          [],
          source,
        ),
        machineInstruction(
          state.input.profile.cpu,
          "rol",
          "storage",
          operandForValue(candidate, 1),
          [],
          source,
        ),
      );
    }
    instructions.push(
      loadA(candidate, 0, state, source),
      machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], source),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        modeForValue(index),
        operandForValue(index, 0),
        [],
        source,
      ),
      storeA(candidate, 0, state, source),
      loadA(candidate, 1, state, source),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        source,
      ),
      storeA(candidate, 1, state, source),
    );
    return Object.freeze({ instructions: Object.freeze(instructions), value: candidate });
  }

  const resultRequest = requestStorage(
    state,
    "aggregate-index-result",
    "temporary",
    2,
    "ram",
    source,
    "Packed aggregate index scale accumulator",
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: resultRequest.id,
    bytes: 2,
    signed: false,
  });
  appendImmediateStore(instructions, 0, result, 0, state, source);
  appendImmediateStore(instructions, 0, result, 1, state, source);
  let factor = term.stride;
  while (factor !== 0) {
    if ((factor & 1) !== 0) {
      instructions.push(
        loadA(result, 0, state, source),
        machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], source),
        machineInstruction(
          state.input.profile.cpu,
          "adc",
          "storage",
          operandForValue(candidate, 0),
          [],
          source,
        ),
        storeA(result, 0, state, source),
        loadA(result, 1, state, source),
        machineInstruction(
          state.input.profile.cpu,
          "adc",
          "storage",
          operandForValue(candidate, 1),
          [],
          source,
        ),
        storeA(result, 1, state, source),
      );
    }
    factor = Math.floor(factor / 2);
    if (factor !== 0) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "asl",
          "storage",
          operandForValue(candidate, 0),
          [],
          source,
        ),
        machineInstruction(
          state.input.profile.cpu,
          "rol",
          "storage",
          operandForValue(candidate, 1),
          [],
          source,
        ),
      );
    }
  }
  return Object.freeze({ instructions: Object.freeze(instructions), value: result });
}
