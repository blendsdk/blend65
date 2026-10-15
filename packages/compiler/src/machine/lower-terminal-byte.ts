import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { literalResolver, valueDefinitions } from "../semantic/aggregate-place-proof.js";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import { hasUnobservedByteCapture } from "./byte-capture-observers.js";
import { machineInstruction } from "./lower-control.js";
import { typeBytes, type FunctionLoweringState } from "./lower-state.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";

/**
 * Prove that both direct branch arms only replace A with a constant byte and
 * return. No other value, index register or incoming arithmetic flag is used
 * before the byte-return ABI ends the invocation. Missing targets are conservative.
 * The function owner supplies its existing block index; this does not walk a CFG.
 */
export function hasByteReturnArms(
  block: SemanticBlock,
  blocks: readonly SemanticBlock[],
  blockIndexes: ReadonlyMap<string, number>,
): boolean {
  if (block.terminator.kind !== "branch") return false;
  return [block.terminator.whenTrue, block.terminator.whenFalse].every((target) => {
    const index = blockIndexes.get(target);
    const arm = index === undefined ? undefined : blocks[index];
    const constant = arm?.operations[0];
    return (
      arm?.operations.length === 1 &&
      constant?.kind === "constant" &&
      (constant.type.kind === "scalar" || constant.type.kind === "enum") &&
      typeBytes(constant.type) === 1 &&
      arm.terminator.kind === "return" &&
      arm.terminator.value === constant.result
    );
  });
}

/** Match the same untransformed invocation-private byte, not its physical address. */
function sameHome(
  instruction: MachineInstruction | undefined,
  opcode: string,
  home: MachineInstruction,
): boolean {
  return (
    instruction?.opcode === opcode &&
    instruction.mode === "storage" &&
    instruction.memory.length === 0 &&
    instruction.operand?.kind === "storage" &&
    instruction.operand.addressByte === undefined &&
    home.operand?.kind === "storage" &&
    instruction.operand.requestId === home.operand.requestId &&
    (instruction.operand.offset ?? 0) === (home.operand.offset ?? 0)
  );
}

/**
 * Extract one endpoint bit instead of shifting seven times in a complete void leaf.
 * The original private parameter load and fixed byte store remain unchanged.
 * LSR/LDA #0/ROR moves bit zero to bit seven; ASL/LDA #0/ROL moves bit seven
 * to bit zero. Final A/N/Z and D/I/V are unchanged. Outgoing carry differs,
 * so no later instruction, edge, startup return or interrupt-domain ABI qualifies.
 * Matching the source shift and its original parameter home excludes unrelated
 * instruction chains. The ordinary void ABI promises no returned arithmetic flags.
 */
function selectTerminalEndpointShift(
  blocks: readonly MachineBlock[],
  state: Pick<FunctionLoweringState, "input" | "interruptDepth">,
  returnsToStartup: boolean,
  source: SemanticFunction | undefined,
): readonly MachineBlock[] {
  if (
    returnsToStartup ||
    state.interruptDepth.domain !== "main" ||
    source === undefined ||
    source.entryKind === "interrupt" ||
    source.result.kind !== "scalar" ||
    source.result.name !== "void" ||
    source.parameters.length !== 1 ||
    source.parameters[0]!.type.kind !== "scalar" ||
    source.parameters[0]!.type.name !== "byte" ||
    blocks.length !== 1
  )
    return blocks;
  const block = blocks[0]!;
  if (block.terminator.kind !== "return" || block.instructions.length !== 9) return blocks;
  const load = block.instructions[0]!;
  const shifts = block.instructions.slice(1, 8);
  const first = shifts[0]!;
  const store = block.instructions[8]!;
  const home = `${bindingIdentityKey(source.id)}:parameter:${bindingIdentityKey(source.parameters[0]!.id)}`;
  if (
    !sameHome(load, "lda", load) ||
    load.operand?.kind !== "storage" ||
    load.operand.requestId !== home ||
    (load.operand.offset ?? 0) !== 0 ||
    (first.opcode !== "asl" && first.opcode !== "lsr") ||
    first.source === null ||
    !shifts.every(
      (shift) =>
        shift.opcode === first.opcode &&
        shift.mode === "accumulator" &&
        shift.operand === null &&
        shift.memory.length === 0 &&
        shift.source === first.source,
    ) ||
    store.opcode !== "sta" ||
    !["absolute", "zero-page", "storage"].includes(store.mode) ||
    store.operand === null ||
    !["absolute", "storage", "label"].includes(store.operand.kind) ||
    (store.operand.kind === "storage" && store.operand.addressByte !== undefined) ||
    (store.operand.kind === "label" &&
      (store.operand.addressByte !== undefined || store.operand.transform !== undefined)) ||
    !store.memory.every((effect) => effect.kind === "write" && effect.width === 1)
  )
    return blocks;
  const definitions = valueDefinitions(source.blocks);
  const operations = [...definitions.values()].filter(
    (operation) => operation.span === first.source,
  );
  const shift = operations.find((operation) => operation.kind === "binary");
  if (
    operations.filter((operation) => operation.kind === "binary").length !== 1 ||
    shift?.kind !== "binary" ||
    shift.type.kind !== "scalar" ||
    shift.type.name !== "byte" ||
    shift.operator !== (first.opcode === "asl" ? "<<" : ">>") ||
    literalResolver(definitions)(shift.right) !== 7n
  )
    return blocks;
  const cpu = state.input.profile.cpu;
  const instructions = [
    load,
    machineInstruction(
      cpu,
      first.opcode === "asl" ? "lsr" : "asl",
      "accumulator",
      null,
      [],
      first.source,
    ),
    machineInstruction(cpu, "lda", "immediate", { kind: "immediate", value: 0 }, [], first.source),
    machineInstruction(
      cpu,
      first.opcode === "asl" ? "ror" : "rol",
      "accumulator",
      null,
      [],
      first.source,
    ),
    store,
  ];
  return Object.freeze([Object.freeze({ ...block, instructions: Object.freeze(instructions) })]);
}

/**
 * Use disposable X for an exact terminal byte increment/decrement and bitwise use.
 *
 * The complete ordinary leaf is a load, optional private capture store, carry setup,
 * add/subtract one, private AND/ORA/EOR and RTS. No other instruction or edge can
 * need the outgoing X or C/V, which the ordinary byte ABI does not preserve.
 * LDX/STX retain the original capture and every source read; DEX/INX changes only
 * X, then TXA supplies the same wrapping byte to the unchanged bitwise consumer.
 * Source flags are not observed, while final A/N/Z and D/I remain unchanged.
 * Indexed modes, extra effects, startup and all interrupt domains keep their old
 * path. Selection uses existing symbolic homes before closure and adds no storage.
 * @param blocks The complete selected function before final closure and layout.
 * @param state Existing CPU and execution-domain ownership.
 * @param returnsToStartup Whether the function has platform restoration duties.
 * @param source The source owner whose result establishes the ordinary byte ABI.
 * @returns The same blocks, or the exact leaf with one avoidable byte removed.
 */
export function selectTerminalByteArithmetic(
  blocks: readonly MachineBlock[],
  state: Pick<FunctionLoweringState, "input" | "interruptDepth">,
  returnsToStartup: boolean,
  source: SemanticFunction | undefined,
): readonly MachineBlock[] {
  if (
    returnsToStartup ||
    state.interruptDepth.domain !== "main" ||
    source === undefined ||
    source.entryKind === "interrupt" ||
    source.result.kind !== "scalar" ||
    !["byte", "sbyte"].includes(source.result.name) ||
    blocks.length !== 1
  )
    return blocks;
  const block = blocks[0]!;
  const instructions = block.instructions;
  if (
    block.terminator.kind !== "return" ||
    (instructions.length !== 4 && instructions.length !== 5)
  )
    return blocks;
  const captured = instructions.length === 5;
  const load = instructions[0]!;
  const home = captured ? instructions[1]! : load;
  const carry = instructions[captured ? 2 : 1]!;
  const arithmetic = instructions[captured ? 3 : 2]!;
  const bitwise = instructions.at(-1)!;
  const subtract = arithmetic.opcode === "sbc";
  if (
    load.opcode !== "lda" ||
    !["storage", "absolute", "zero-page"].includes(load.mode) ||
    !load.memory.every((effect) => effect.kind === "read" && effect.width === 1) ||
    home.operand?.kind !== "storage" ||
    home.operand.addressByte !== undefined ||
    !sameHome(home, captured ? "sta" : "lda", home) ||
    !["and", "ora", "eor"].includes(bitwise.opcode) ||
    !sameHome(bitwise, bitwise.opcode, home) ||
    (!subtract && arithmetic.opcode !== "adc") ||
    arithmetic.mode !== "immediate" ||
    arithmetic.operand?.kind !== "immediate" ||
    arithmetic.operand.value !== 1 ||
    arithmetic.memory.length !== 0 ||
    carry.opcode !== (subtract ? "sec" : "clc") ||
    carry.mode !== "implied" ||
    carry.operand !== null ||
    carry.memory.length !== 0
  )
    return blocks;
  const cpu = state.input.profile.cpu;
  const selected = [
    machineInstruction(cpu, "ldx", load.mode, load.operand, load.memory, load.source),
    ...(captured
      ? [machineInstruction(cpu, "stx", home.mode, home.operand, home.memory, home.source)]
      : []),
    machineInstruction(cpu, subtract ? "dex" : "inx", "implied", null, [], arithmetic.source),
    machineInstruction(cpu, "txa", "implied", null, [], arithmetic.source),
    bitwise,
  ];
  return Object.freeze([Object.freeze({ ...block, instructions: Object.freeze(selected) })]);
}

/**
 * Save a captured byte only on the exact terminal arm that calls another function.
 *
 * This complete four-block diamond has one fresh volatile load/private store,
 * an N-branch, a sole no-argument direct call, an empty bypass and a same-home
 * reload/byte return. The bypass already has the original A/N/Z. The called
 * arm must save before JSR and reload afterwards because the ordinary ABI does
 * not preserve A. Keeping the original home and conservative interference
 * lifetime protects nested calls and interrupts without another storage model.
 * All extra instructions, source/raw/indexed observers, RAM publication, parameters,
 * startup and interrupt domains keep the original selection. No source value or
 * ordered effect is reordered; existing complete-window facts guard the private save.
 */
function selectTerminalCapturedByte(
  blocks: readonly MachineBlock[],
  state: Pick<FunctionLoweringState, "input" | "interruptDepth">,
  returnsToStartup: boolean,
  source: SemanticFunction | undefined,
): readonly MachineBlock[] {
  if (
    returnsToStartup ||
    state.interruptDepth.domain !== "main" ||
    source === undefined ||
    source.entryKind === "interrupt" ||
    source.parameters.length !== 0 ||
    source.result.kind !== "scalar" ||
    source.result.name !== "byte" ||
    blocks.length !== 4
  )
    return blocks;
  const guard = blocks[0]!;
  if (
    guard.instructions.length !== 2 ||
    guard.terminator.kind !== "branch" ||
    !["bmi", "bpl"].includes(guard.terminator.opcode)
  )
    return blocks;
  const [load, home] = guard.instructions;
  if (
    load?.opcode !== "lda" ||
    !["absolute", "zero-page"].includes(load.mode) ||
    load.memory.length !== 1 ||
    load.memory[0]!.kind !== "read" ||
    load.memory[0]!.width !== 1 ||
    !load.memory[0]!.volatile ||
    home === undefined ||
    !sameHome(home, "sta", home)
  )
    return blocks;
  const byLabel = new Map(blocks.map((block) => [block.label, block] as const));
  if (byLabel.size !== 4) return blocks;
  const first = byLabel.get(guard.terminator.target);
  const second = byLabel.get(guard.terminator.fallthrough);
  const called = first?.instructions.length === 1 ? first : second;
  const bypass = called === first ? second : first;
  if (
    called === undefined ||
    bypass === undefined ||
    called === guard ||
    bypass === guard ||
    called === bypass ||
    called.instructions.length !== 1 ||
    bypass.instructions.length !== 0 ||
    called.terminator.kind !== "jump" ||
    bypass.terminator.kind !== "jump" ||
    called.terminator.target !== bypass.terminator.target
  )
    return blocks;
  const returned = byLabel.get(called.terminator.target);
  const call = called.instructions[0]!;
  if (
    returned === undefined ||
    returned === guard ||
    returned === called ||
    returned === bypass ||
    returned.instructions.length !== 1 ||
    returned.terminator.kind !== "return" ||
    !sameHome(returned.instructions[0], "lda", home) ||
    call.opcode !== "jsr" ||
    call.mode !== "absolute" ||
    call.operand?.kind !== "label" ||
    call.memory.length !== 0
  )
    return blocks;
  const operations = source.blocks.flatMap((block) => block.operations);
  const stores = operations.filter(
    (operation) => operation.kind === "store" && operation.span === home.source,
  );
  const calls = operations.filter(
    (operation) => operation.kind === "call" && operation.span === call.source,
  );
  const store = stores[0];
  const sourceCall = calls[0];
  if (
    stores.length !== 1 ||
    store?.kind !== "store" ||
    store.place.path.length !== 0 ||
    store.type.kind !== "scalar" ||
    store.type.name !== "byte" ||
    calls.length !== 1 ||
    sourceCall?.kind !== "call" ||
    sourceCall.arguments.length !== 0
  )
    return blocks;
  const binding = bindingIdentityKey(store.place.root);
  const references = operations.filter(
    (operation) => "place" in operation && bindingIdentityKey(operation.place.root) === binding,
  );
  // Only the declaration and its two direct reads own this home. An address
  // or selected-place use could expose the store, even if it emitted no code.
  if (
    references.length !== 3 ||
    references.some(
      (operation) =>
        (operation.kind !== "load" && operation.kind !== "store") ||
        operation.place.path.length !== 0,
    ) ||
    state.input.program.semantic.globals.some((global) => bindingIdentityKey(global.id) === binding)
  )
    return blocks;
  const capture = operations.find(
    (operation) => "result" in operation && operation.result === store.value,
  );
  if (capture?.kind !== "memory-read" || capture.width !== 1 || capture.span !== load.source)
    return blocks;
  if (!hasUnobservedByteCapture(state.input, source, capture)) return blocks;
  return Object.freeze(
    blocks.map((block) =>
      block === guard
        ? Object.freeze({ ...block, instructions: Object.freeze([load]) })
        : block === called
          ? Object.freeze({
              ...block,
              instructions: Object.freeze([home, call, returned.instructions[0]!]),
            })
          : block === returned
            ? Object.freeze({ ...block, instructions: Object.freeze([]) })
            : block,
    ),
  );
}

/**
 * Select exact ordinary terminal-byte leaves at the existing function boundary.
 * All selections retain source spans and original symbolic homes before closure.
 * @param blocks The complete selected function, including all generated helpers.
 * @param state Existing CPU, program and execution-domain ownership.
 * @param returnsToStartup Whether the return owns platform restoration duties.
 * @param source The source function defining the ordinary byte ABI.
 * @returns The original blocks or an equivalent exact terminal leaf.
 */
export function selectTerminalByteLeaves(
  blocks: readonly MachineBlock[],
  state: Pick<FunctionLoweringState, "input" | "interruptDepth">,
  returnsToStartup: boolean,
  source: SemanticFunction | undefined,
): readonly MachineBlock[] {
  return selectTerminalEndpointShift(
    selectTerminalCapturedByte(
      selectTerminalByteArithmetic(blocks, state, returnsToStartup, source),
      state,
      returnsToStartup,
      source,
    ),
    state,
    returnsToStartup,
    source,
  );
}
