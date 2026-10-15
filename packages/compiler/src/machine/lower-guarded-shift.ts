import type { SemanticFunction } from "../semantic/operations.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import { loweredPlace, typeBytes, type FunctionLoweringState } from "./lower-state.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";

/** Recognize a memory-free official immediate byte instruction. */
function immediate(
  instruction: MachineInstruction | undefined,
  opcode: string,
  value: number,
): boolean {
  return (
    instruction?.opcode === opcode &&
    instruction.mode === "immediate" &&
    instruction.operand?.kind === "immediate" &&
    instruction.operand.value === value &&
    instruction.memory.length === 0
  );
}

/** Recognize one exact byte read from an already selected invocation-private home. */
function homeRead(
  instruction: MachineInstruction | undefined,
  opcode: string,
  requestId: string,
  offset: number,
): boolean {
  return (
    instruction?.opcode === opcode &&
    instruction.mode === "storage" &&
    instruction.operand?.kind === "storage" &&
    instruction.operand.requestId === requestId &&
    (instruction.operand.offset ?? 0) === offset &&
    instruction.operand.addressByte === undefined &&
    instruction.memory.length === 0
  );
}

/** The byte ABI has no outgoing index-register or condition-code obligation. */
function returnsByte(block: MachineBlock | undefined, constant: boolean): boolean {
  if (block?.terminator.kind !== "return") return false;
  if (!constant) return block.instructions.length === 0;
  const [load] = block.instructions;
  return (
    block.instructions.length === 1 &&
    load?.operand?.kind === "immediate" &&
    load.operand.value >= 0 &&
    load.operand.value <= 255 &&
    immediate(load, "lda", load.operand.value)
  );
}

/** Recognize only the accumulator shift followed by its counted loop decrement. */
function shiftLoop(block: MachineBlock): boolean {
  const instructions = block.instructions;
  const shift = instructions.at(-2);
  const decrement = instructions.at(-1);
  return (
    ((instructions.length === 2 && (shift?.opcode === "asl" || shift?.opcode === "lsr")) ||
      (instructions.length === 3 &&
        shift?.opcode === "ror" &&
        immediate(instructions[0], "cmp", 128))) &&
    shift?.mode === "accumulator" &&
    shift.operand === null &&
    shift.memory.length === 0 &&
    decrement?.opcode === "dex" &&
    decrement.mode === "implied" &&
    decrement.operand === null &&
    decrement.memory.length === 0
  );
}

/**
 * Keep an unsigned parameter count in X across the exact pure guard/shift leaf.
 *
 * This is a fixed structured-instruction pattern, not register availability analysis.
 * It recognizes the complete private-home comparison, direct success edge, two empty
 * shift-entry blocks, counted accumulator loop and both byte returns. The rejected
 * edge may contain the frontend's single empty jump to its constant return. Every extra
 * entry, instruction, effect or return duty keeps the original blocks. A value load
 * overwrites Z, so the selected zero block explicitly compares the retained X with zero.
 * No storage is added or inferred from an instruction's request-name spelling.
 * @param blocks Selected blocks before final function-storage closure or layout.
 * @param state Source parameter identities, existing homes and selected CPU.
 * @param returnsToStartup Whether returning has platform restoration duties.
 * @param source The source function already identified by the function owner.
 * @returns The original blocks or the same leaf with its redundant count reload removed.
 */
export function selectGuardedShiftCount(
  blocks: readonly MachineBlock[],
  state: FunctionLoweringState,
  returnsToStartup: boolean,
  source: SemanticFunction | undefined,
): readonly MachineBlock[] {
  if (returnsToStartup || state.interruptDepth.domain !== "main") return blocks;
  if (source === undefined || source.entryKind === "interrupt" || typeBytes(source.result) !== 1)
    return blocks;
  const parameterHomes = new Map<string, number>();
  const countHomes = new Map<string, number>();
  for (const parameter of source.parameters) {
    if (parameter.type.kind !== "scalar") continue;
    const width = typeBytes(parameter.type);
    const value = loweredPlace({ root: parameter.id, path: [] }, width, false, state);
    if (value.kind !== "storage") continue;
    parameterHomes.set(value.requestId, width);
    if (parameter.type.name === "byte" || parameter.type.name === "word")
      countHomes.set(value.requestId, width);
  }
  if (countHomes.size === 0) return blocks;
  const byLabel = new Map(blocks.map((block) => [block.label, block] as const));
  if (byLabel.size !== blocks.length) return blocks;
  const predecessors = new Map(blocks.map((block) => [block.label, new Set<string>()] as const));
  for (const block of blocks) {
    const terminator = block.terminator;
    const targets =
      terminator.kind === "branch"
        ? [terminator.target, terminator.fallthrough]
        : terminator.kind === "jump" || terminator.kind === "fallthrough"
          ? [terminator.target]
          : [];
    for (const target of targets) predecessors.get(target)?.add(block.label);
  }
  /** Exact direct predecessors exclude joins, backedges and alternate entry into the window. */
  const enteredOnlyFrom = (block: MachineBlock, ...labels: readonly string[]): boolean => {
    const incoming = predecessors.get(block.label);
    return (
      block !== blocks[0] &&
      incoming?.size === labels.length &&
      labels.every((label) => incoming.has(label))
    );
  };
  for (const guard of blocks) {
    if (
      guard !== blocks[0] ||
      guard.terminator.kind !== "branch" ||
      guard.terminator.opcode !== "bcc"
    )
      continue;
    const countOperand = guard.instructions[0]?.operand;
    if (countOperand?.kind !== "storage") continue;
    const width = countHomes.get(countOperand.requestId);
    if (
      width === undefined ||
      guard.instructions.length !== (width === 1 ? 2 : 4) ||
      !homeRead(guard.instructions[0], "lda", countOperand.requestId, 0) ||
      !immediate(guard.instructions[1], "cmp", 8) ||
      (width === 2 &&
        (!homeRead(guard.instructions[2], "lda", countOperand.requestId, 1) ||
          !immediate(guard.instructions[3], "sbc", 0)))
    )
      continue;
    const accepted = byLabel.get(guard.terminator.target);
    const rejected = byLabel.get(guard.terminator.fallthrough);
    // A normal if-without-else has one empty rejection edge before its return.
    // Match that single frontend shape, not an arbitrary chain of jump aliases.
    const rejectionReturn =
      rejected?.terminator.kind === "jump" && rejected.instructions.length === 0
        ? byLabel.get(rejected.terminator.target)
        : rejected;
    if (
      accepted?.terminator.kind !== "fallthrough" ||
      accepted.instructions.length !== 2 ||
      !enteredOnlyFrom(accepted, guard.label) ||
      rejected === undefined ||
      !enteredOnlyFrom(rejected, guard.label) ||
      !returnsByte(rejectionReturn, true) ||
      (rejectionReturn !== rejected &&
        (rejectionReturn === undefined || !enteredOnlyFrom(rejectionReturn, rejected.label)))
    )
      continue;
    const [valueLoad, countLoad] = accepted.instructions;
    const valueOperand = valueLoad?.operand;
    if (
      valueOperand?.kind !== "storage" ||
      parameterHomes.get(valueOperand.requestId) !== 1 ||
      !homeRead(valueLoad, "lda", valueOperand.requestId, 0) ||
      !homeRead(countLoad, "ldx", countOperand.requestId, 0)
    )
      continue;
    const low = byLabel.get(accepted.terminator.target);
    if (
      low?.terminator.kind !== "fallthrough" ||
      low.instructions.length !== 0 ||
      !enteredOnlyFrom(low, accepted.label)
    )
      continue;
    const zero = byLabel.get(low.terminator.target);
    if (
      zero?.terminator.kind !== "branch" ||
      zero.terminator.opcode !== "beq" ||
      zero.instructions.length !== 0 ||
      !enteredOnlyFrom(zero, low.label)
    )
      continue;
    const loop = byLabel.get(zero.terminator.fallthrough);
    const done = byLabel.get(zero.terminator.target);
    if (
      loop?.terminator.kind !== "branch" ||
      loop.terminator.opcode !== "bne" ||
      loop.terminator.target !== loop.label ||
      loop.terminator.fallthrough !== done?.label ||
      !shiftLoop(loop) ||
      !enteredOnlyFrom(loop, zero.label, loop.label) ||
      done === undefined ||
      !returnsByte(done, false) ||
      !enteredOnlyFrom(done, zero.label, loop.label)
    )
      continue;
    const leaf = new Set([guard, accepted, low, zero, loop, done, rejected, rejectionReturn]);
    if (blocks.length !== leaf.size || blocks.some((block) => !leaf.has(block))) continue;
    const lowGuardLabel = `${guard.label}.shift.checked-count.low`;
    if (width === 2 && byLabel.has(lowGuardLabel)) continue;
    const cpu = state.input.profile.cpu;
    const loadX = machineInstruction(
      cpu,
      "ldx",
      "storage",
      countOperand,
      [],
      guard.instructions[0]!.source,
    );
    const compareX = machineInstruction(
      cpu,
      "cpx",
      "immediate",
      { kind: "immediate", value: 8 },
      [],
      guard.instructions[1]!.source,
    );
    const rejection = Object.freeze({
      kind: "branch" as const,
      opcode: "bcs",
      target: guard.terminator.fallthrough,
      fallthrough: accepted.label,
      uses: machineState([], ["c"]),
      cost: machineCost(cpu, "bcs", "relative"),
    });
    const selectedGuard: readonly MachineBlock[] =
      width === 1
        ? [{ ...guard, instructions: [loadX, compareX], terminator: rejection }]
        : [
            {
              ...guard,
              instructions: [guard.instructions[2]!],
              terminator: {
                kind: "branch",
                opcode: "bne",
                target: guard.terminator.fallthrough,
                fallthrough: lowGuardLabel,
                uses: machineState([], ["z"]),
                cost: machineCost(cpu, "bne", "relative"),
              },
            },
            { label: lowGuardLabel, instructions: [loadX, compareX], terminator: rejection },
          ];
    const compareZero = machineInstruction(
      cpu,
      "cpx",
      "immediate",
      { kind: "immediate", value: 0 },
      [],
      countLoad!.source,
    );
    return Object.freeze(
      blocks.flatMap((block) =>
        block === guard
          ? selectedGuard.map((selected) =>
              Object.freeze({
                ...selected,
                instructions: Object.freeze(selected.instructions),
                terminator: Object.freeze(selected.terminator),
              }),
            )
          : block === accepted
            ? [Object.freeze({ ...block, instructions: Object.freeze([valueLoad!]) })]
            : block === zero
              ? [Object.freeze({ ...block, instructions: Object.freeze([compareZero]) })]
              : [block],
      ),
    );
  }
  return blocks;
}
