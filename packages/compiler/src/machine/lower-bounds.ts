import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticPlace } from "../semantic/operations.js";
import {
  machineCost,
  machineInstruction,
  machineState,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineBlock, MachineInstruction, MachineTerminator } from "./machine-types.js";
import { loadA, loweringFailure, type FunctionLoweringState } from "./lower.js";

/** One dynamic ordinal and the extent of the array selected at that path step. */
interface BoundsIndex {
  readonly value: string;
  readonly extent: number;
  /** Four-byte borrowed parameter home, whose final word is the runtime extent. */
  readonly countHome?: string;
}

/** Walk the declared type so each nested subscript is checked against its own extent. */
function dynamicIndices(
  place: SemanticPlace,
  state: FunctionLoweringState,
  source: SourceSpan,
): BoundsIndex[] {
  if (place.rootType === undefined) {
    throw loweringFailure("Indexed place has no declared root type for bounds checking", source);
  }
  let current = place.rootType;
  const indices: BoundsIndex[] = [];
  const parameter = state.input.program.semantic.functions
    .find(({ id }) => bindingIdentityKey(id) === bindingIdentityKey(state.owner))
    ?.parameters.find(({ id }) => bindingIdentityKey(id) === bindingIdentityKey(place.root));
  const countHome = parameter?.outerUnsized
    ? `${bindingIdentityKey(state.owner)}:parameter:${bindingIdentityKey(place.root)}`
    : null;
  let outer = true;
  for (const component of place.path) {
    if (component.kind === "field") {
      if (current.kind !== "struct") throw loweringFailure("Field has no packed struct", source);
      const field = current.fields.find(({ name }) => name === component.name);
      if (field === undefined) throw loweringFailure("Packed field is missing", source);
      current = field.type;
      continue;
    }
    if (current.kind !== "array") throw loweringFailure("Index has no fixed array", source);
    const value = state.values.get(component.value);
    if (value === undefined || value.kind === "condition" || value.kind === "register") {
      throw loweringFailure("Array ordinal was not retained before the bounds check", source);
    }
    if (outer && countHome !== null) {
      indices.push({ value: component.value, extent: current.length, countHome });
    } else if (value.kind !== "constant") {
      indices.push({ value: component.value, extent: current.length });
    }
    outer = false;
    current = current.element;
  }
  return indices;
}

/** Split one selected dynamic access into inline comparisons and a normal hot-path continuation. */
export function lowerBoundsGuards(
  place: SemanticPlace,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
  stopLabel: string,
  source: SourceSpan,
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } | null {
  const indices = dynamicIndices(place, state, source);
  if (indices.length === 0) return null;
  const cpu = state.input.profile.cpu;
  const blocks: MachineBlock[] = [];
  let label = entryLabel;
  let instructions = [...prefix];
  const nextLabel = (index: number, part: string) =>
    `${entryLabel}.bounds.${ordinal}.${index}.${part}`;
  const branch = (
    opcode: "bcs" | "bcc" | "bne" | "bmi",
    target: string,
    fallthrough: string,
  ): MachineTerminator =>
    Object.freeze({
      kind: "branch" as const,
      opcode,
      target,
      fallthrough,
      uses: machineState([], [opcode === "bmi" ? "n" : opcode === "bne" ? "z" : "c"]),
      cost: machineCost(cpu, opcode, "relative"),
    });
  const emit = (terminator: MachineTerminator, next: string): void => {
    blocks.push(Object.freeze({ label, instructions: Object.freeze(instructions), terminator }));
    label = next;
    instructions = [];
  };
  const immediate = (value: number) => Object.freeze({ kind: "immediate" as const, value });
  const load = (value: string, offset: number): void => {
    const retained = state.values.get(value);
    if (retained === undefined) throw loweringFailure("Array ordinal is missing", source);
    instructions.push(loadA(retained, offset, state, source));
  };

  for (const [index, selected] of indices.entries()) {
    const value = state.values.get(selected.value);
    if (value === undefined || value.kind === "condition" || value.kind === "register") {
      throw loweringFailure("Array ordinal was not retained before the bounds check", source);
    }
    const pass = nextLabel(index, "pass");
    const extent = selected.extent;
    if (selected.countHome !== undefined) {
      const count: LoweredValue = Object.freeze({
        kind: "storage",
        requestId: selected.countHome,
        offset: 2,
        bytes: 2,
      });
      if (value.signed) {
        load(selected.value, value.bytes - 1);
        const nonnegative = nextLabel(index, "nonnegative");
        emit(branch("bmi", stopLabel, nonnegative), nonnegative);
      }
      if (value.bytes === 1) {
        instructions.push(loadA(count, 1, state, source));
        const compareLow = nextLabel(index, "low");
        emit(branch("bne", pass, compareLow), compareLow);
      } else if (value.bytes === 2) {
        load(selected.value, 1);
        instructions.push(
          machineInstruction(
            cpu,
            "cmp",
            "storage",
            Object.freeze({ kind: "storage", requestId: selected.countHome, offset: 3 }),
            [],
            source,
          ),
        );
        const compareHigh = nextLabel(index, "high");
        emit(branch("bcc", pass, compareHigh), compareHigh);
        const compareLow = nextLabel(index, "low");
        emit(branch("bne", stopLabel, compareLow), compareLow);
      } else {
        throw loweringFailure("Array ordinal exceeds word width", source);
      }
      load(selected.value, 0);
      instructions.push(
        machineInstruction(
          cpu,
          "cmp",
          "storage",
          Object.freeze({ kind: "storage", requestId: selected.countHome, offset: 2 }),
          [],
          source,
        ),
      );
      emit(branch("bcs", stopLabel, pass), pass);
      continue;
    }
    if (extent === 0) {
      emit(
        Object.freeze({
          kind: "jump",
          opcode: "jmp",
          target: stopLabel,
          cost: machineCost(cpu, "jmp", "absolute"),
        }),
        pass,
      );
      continue;
    }
    if (value.bytes === 1) {
      if ((!value.signed && extent >= 256) || (value.signed && extent >= 128)) {
        if (value.signed) {
          load(selected.value, 0);
          emit(branch("bmi", stopLabel, pass), pass);
        }
        continue;
      }
      load(selected.value, 0);
      instructions.push(machineInstruction(cpu, "cmp", "immediate", immediate(extent), [], source));
      emit(branch("bcs", stopLabel, pass), pass);
      continue;
    }
    if (value.bytes !== 2) throw loweringFailure("Array ordinal exceeds word width", source);
    if (value.signed && extent >= 32768) {
      load(selected.value, 1);
      emit(branch("bmi", stopLabel, pass), pass);
      continue;
    }
    const high = extent >> 8;
    const low = extent & 0xff;
    load(selected.value, 1);
    if (high === 0) {
      const lowLabel = nextLabel(index, "low");
      emit(branch("bne", stopLabel, lowLabel), lowLabel);
    } else if (low === 0) {
      instructions.push(machineInstruction(cpu, "cmp", "immediate", immediate(high), [], source));
      emit(branch("bcs", stopLabel, pass), pass);
      continue;
    } else {
      const above = nextLabel(index, "above");
      const lowLabel = nextLabel(index, "low");
      instructions.push(machineInstruction(cpu, "cmp", "immediate", immediate(high), [], source));
      emit(branch("bcc", pass, above), above);
      emit(branch("bne", stopLabel, lowLabel), lowLabel);
    }
    load(selected.value, 0);
    instructions.push(machineInstruction(cpu, "cmp", "immediate", immediate(low), [], source));
    emit(branch("bcs", stopLabel, pass), pass);
  }
  if (blocks.length === 0) return null;
  return Object.freeze({ blocks: Object.freeze(blocks), continuation: label });
}
