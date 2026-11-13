import type { CpuFacts } from "../target/nmos6510.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type {
  MachineBlock,
  MachineInstruction,
  MachineOperand,
  MachineTerminator,
} from "./machine-types.js";

/** One fixed byte home addressed by an ordinary load. */
interface ByteHome {
  readonly kind: "storage" | "label" | "absolute";
  readonly id: string;
  readonly offset: number;
}

/** One byte comparison pattern found at the end of a switch test block. */
interface ByteTest {
  readonly kind: "byte";
  readonly block: MachineBlock;
  readonly load: MachineInstruction;
  readonly xor: MachineInstruction;
  readonly home: ByteHome;
}

/** One word comparison pattern with two byte homes and an equality scratch byte. */
interface WordTest {
  readonly kind: "word";
  readonly block: MachineBlock;
  readonly lowLoad: MachineInstruction;
  readonly lowXor: MachineInstruction;
  readonly store: MachineInstruction;
  readonly highLoad: MachineInstruction;
  readonly highXor: MachineInstruction;
  readonly combine: MachineInstruction;
  readonly lowHome: ByteHome;
  readonly highHome: ByteHome;
  readonly lowValue: number;
  readonly highValue: number;
  readonly scratchId: string;
}

/** One recognized switch test in a linear dispatch chain. */
type SwitchTest = ByteTest | WordTest;

/** Optimized blocks plus scratch requests whose last instruction was removed. */
export interface SwitchDispatchResult {
  readonly blocks: readonly MachineBlock[];
  readonly removedRequestIds: ReadonlySet<string>;
}

/** Read the fixed byte home carried by one direct load, or null for other forms. */
function fixedByteHome(instruction: MachineInstruction): ByteHome | null {
  if (
    instruction.opcode !== "lda" ||
    !["storage", "absolute", "zero-page"].includes(instruction.mode) ||
    instruction.memory.some((effect) => effect.volatile)
  )
    return null;
  const operand = instruction.operand;
  if (operand?.kind === "storage") {
    return Object.freeze({ kind: "storage", id: operand.requestId, offset: operand.offset ?? 0 });
  }
  if (operand?.kind === "label") {
    if (operand.addressByte !== undefined || operand.transform !== undefined) return null;
    return Object.freeze({ kind: "label", id: operand.label, offset: operand.offset ?? 0 });
  }
  if (operand?.kind === "absolute") {
    return Object.freeze({
      kind: "absolute",
      id: String(operand.value),
      offset: 0,
    });
  }
  return null;
}

/** Read one immutable immediate byte from an equality instruction. */
function immediateByte(instruction: MachineInstruction): number | null {
  return instruction.operand?.kind === "immediate" ? instruction.operand.value : null;
}

/** Compare two fixed byte homes without depending on final address binding. */
function sameHome(left: ByteHome, right: ByteHome): boolean {
  return left.kind === right.kind && left.id === right.id && left.offset === right.offset;
}

/** Return whether one home is the low byte and the other its adjacent high byte. */
function adjacentHomes(low: ByteHome, high: ByteHome): boolean {
  return low.kind === high.kind && low.id === high.id && high.offset === low.offset + 1;
}

/** Recognize one byte equality test ending in a branch to a switch arm. */
function byteTest(block: MachineBlock): ByteTest | null {
  const terminator = block.terminator;
  if (
    terminator.kind !== "branch" ||
    terminator.opcode !== "beq" ||
    !terminator.target.includes(":switch-arm-")
  )
    return null;
  const xor = block.instructions.at(-1);
  const load = block.instructions.at(-2);
  if (xor?.opcode !== "eor" || load?.opcode !== "lda") return null;
  const home = fixedByteHome(load);
  if (home === null || immediateByte(xor) === null) return null;
  return Object.freeze({ kind: "byte", block, load, xor, home });
}

/** Recognize one word equality test ending in a branch to a switch arm. */
function wordTest(block: MachineBlock): WordTest | null {
  const terminator = block.terminator;
  if (
    terminator.kind !== "branch" ||
    terminator.opcode !== "beq" ||
    !terminator.target.includes(":switch-arm-")
  )
    return null;
  if (block.instructions.length < 6) return null;
  const instructions = block.instructions.slice(-6);
  const [lowLoad, lowXor, store, highLoad, highXor, combine] = instructions;
  if (
    lowLoad?.opcode !== "lda" ||
    lowXor?.opcode !== "eor" ||
    store?.opcode !== "sta" ||
    highLoad?.opcode !== "lda" ||
    highXor?.opcode !== "eor" ||
    combine?.opcode !== "ora"
  )
    return null;
  const lowHome = fixedByteHome(lowLoad);
  const highHome = fixedByteHome(highLoad);
  const lowValue = immediateByte(lowXor);
  const highValue = immediateByte(highXor);
  const scratch = store.operand;
  const combined = combine.operand;
  if (
    lowHome === null ||
    highHome === null ||
    lowValue === null ||
    highValue === null ||
    !adjacentHomes(lowHome, highHome) ||
    scratch?.kind !== "storage" ||
    (scratch.offset ?? 0) !== 0 ||
    combined?.kind !== "storage" ||
    combined.requestId !== scratch.requestId ||
    (combined.offset ?? 0) !== 0
  )
    return null;
  return Object.freeze({
    kind: "word",
    block,
    lowLoad,
    lowXor,
    store,
    highLoad,
    highXor,
    combine,
    lowHome,
    highHome,
    lowValue,
    highValue,
    scratchId: scratch.requestId,
  });
}

/** Recognize either supported switch comparison shape. */
function switchTest(block: MachineBlock): SwitchTest | null {
  return byteTest(block) ?? wordTest(block);
}

/** Build one relative branch terminator with its exact selected cost. */
function branch(
  cpu: CpuFacts,
  opcode: "beq" | "bne",
  target: string,
  fallthrough: string,
): MachineTerminator {
  return Object.freeze({
    kind: "branch" as const,
    opcode,
    target,
    fallthrough,
    uses: machineState([], ["z"]),
    cost: machineCost(cpu, opcode, "relative"),
  });
}

/** Build one equality comparison which preserves the selector already in A. */
function compareInstruction(cpu: CpuFacts, xor: MachineInstruction): MachineInstruction {
  const instruction = machineInstruction(cpu, "cmp", xor.mode, xor.operand, xor.memory, xor.source);
  return xor.sourceIteration === undefined
    ? instruction
    : Object.freeze({ ...instruction, sourceIteration: xor.sourceIteration });
}

/** A fresh load already owns Z when the compared constant is zero. */
function compareUnlessZero(cpu: CpuFacts, xor: MachineInstruction): readonly MachineInstruction[] {
  return immediateByte(xor) === 0 ? [] : [compareInstruction(cpu, xor)];
}

/** Collect every storage request still named by an instruction after rewriting. */
function referencedRequests(blocks: readonly MachineBlock[]): ReadonlySet<string> {
  const ids = new Set<string>();
  const record = (operand: MachineOperand | null): void => {
    if (operand?.kind === "storage" || operand?.kind === "indirect-y") ids.add(operand.requestId);
  };
  for (const block of blocks) {
    for (const instruction of block.instructions) {
      record(instruction.operand);
      for (const effect of instruction.memory) {
        if (effect.address.kind === "storage" || effect.address.kind === "indirect-y") {
          ids.add(effect.address.requestId);
        }
      }
    }
  }
  return ids;
}

/** Find direct predecessors for every machine block in one function body. */
function predecessorMap(blocks: readonly MachineBlock[]): ReadonlyMap<string, ReadonlySet<string>> {
  const incoming = new Map<string, Set<string>>(blocks.map((block) => [block.label, new Set()]));
  const link = (from: string, to: string): void => {
    incoming.get(to)?.add(from);
  };
  for (const block of blocks) {
    const terminator = block.terminator;
    if (terminator.kind === "jump") link(block.label, terminator.target);
    else if (terminator.kind === "branch") {
      link(block.label, terminator.target);
      link(block.label, terminator.fallthrough);
    } else if (terminator.kind === "long-branch") {
      link(block.label, terminator.fallthrough);
      link(block.label, terminator.jump.target);
    } else if (terminator.kind === "fallthrough") link(block.label, terminator.target);
  }
  return incoming;
}

/** Return whether a test label is used by an instruction rather than the dispatch chain. */
function labelUsedByInstruction(blocks: readonly MachineBlock[], label: string): boolean {
  return blocks.some((block) =>
    block.instructions.some(
      (instruction) => instruction.operand?.kind === "label" && instruction.operand.label === label,
    ),
  );
}

/** Rewrite byte equality tests to reuse the selector in A and compare non-destructively. */
function rewriteByteChain(
  chain: readonly ByteTest[],
  cpu: CpuFacts,
): readonly MachineBlock[] | null {
  const first = chain[0]!;
  for (const [index, test] of chain.entries()) {
    if (!sameHome(first.home, test.home)) return null;
    if (index > 0 && test.block.instructions.length !== 2) return null;
  }
  return chain.map((test, index) => {
    const compare = compareInstruction(cpu, test.xor);
    if (index === 0) {
      const instructions =
        immediateByte(test.xor) === 0
          ? [...test.block.instructions.slice(0, -1)]
          : [...test.block.instructions.slice(0, -1), compare];
      return Object.freeze({ ...test.block, instructions: Object.freeze(instructions) });
    }
    return Object.freeze({ ...test.block, instructions: Object.freeze([compare]) });
  });
}

/** Build one word test's low/high blocks without an equality scratch home. */
function wordTestBlocks(
  cpu: CpuFacts,
  test: WordTest,
  lowLabel: string,
  highLabel: string,
  lowTarget: string,
  highTarget: string,
  highFallthrough: string,
  prefix: readonly MachineInstruction[],
): readonly MachineBlock[] {
  const low = Object.freeze({
    label: lowLabel,
    instructions: Object.freeze([...prefix, test.lowLoad, ...compareUnlessZero(cpu, test.lowXor)]),
    terminator: branch(cpu, "bne", lowTarget, highLabel),
  } satisfies MachineBlock);
  const high = Object.freeze({
    label: highLabel,
    instructions: Object.freeze([test.highLoad, ...compareUnlessZero(cpu, test.highXor)]),
    terminator: branch(cpu, "beq", highTarget, highFallthrough),
  } satisfies MachineBlock);
  return Object.freeze([low, high]);
}

/** Rewrite a word equality chain with a shared low byte into one low test and high tests. */
function rewriteCommonLowWordChain(
  chain: readonly WordTest[],
  cpu: CpuFacts,
  chainEnd: string,
): readonly MachineBlock[] | null {
  const first = chain[0]!;
  for (const [index, test] of chain.entries()) {
    if (index > 0 && test.block.instructions.length !== 6) return null;
    if (
      !sameHome(first.lowHome, test.lowHome) ||
      !sameHome(first.highHome, test.highHome) ||
      test.lowValue !== first.lowValue
    )
      return null;
  }
  const prefix = first.block.instructions.slice(0, -6);
  // Keep every original test label on one of the replacement blocks. Downstream
  // observer and debug evidence already names those labels and must still find
  // them after the dispatch chain is reshaped.
  const laterLabels = chain.slice(1).map((test) => test.block.label);
  const highLabels = chain.map((_, index) =>
    index === 0 ? `${first.block.label}.switch.high-0` : laterLabels[index - 1]!,
  );
  const lowBlock: MachineBlock = Object.freeze({
    label: first.block.label,
    instructions: Object.freeze([
      ...prefix,
      first.lowLoad,
      ...compareUnlessZero(cpu, first.lowXor),
    ]),
    terminator: branch(cpu, "bne", chainEnd, highLabels[0]!),
  });
  const highBlocks = chain.map((test, index) => {
    const arm = test.block.terminator;
    if (arm.kind !== "branch") throw new Error("Switch test lost its arm branch");
    const next = highLabels[index + 1] ?? chainEnd;
    return Object.freeze({
      label: highLabels[index]!,
      instructions: Object.freeze(
        index === 0
          ? [test.highLoad, ...compareUnlessZero(cpu, test.highXor)]
          : [compareInstruction(cpu, test.highXor)],
      ),
      terminator: branch(cpu, "beq", arm.target, next),
    } satisfies MachineBlock);
  });
  return Object.freeze([lowBlock, ...highBlocks]);
}

/** Rewrite a word equality chain with independent low bytes into two blocks per test. */
function rewriteGeneralWordChain(
  chain: readonly WordTest[],
  cpu: CpuFacts,
  chainEnd: string,
): readonly MachineBlock[] | null {
  const first = chain[0]!;
  if (chain.slice(1).some((test) => test.block.instructions.length !== 6)) return null;
  const labels = chain.map((test, index) => ({
    low: index === 0 ? first.block.label : test.block.label,
    high: `${test.block.label}.switch.high`,
  }));
  const prefix = first.block.instructions.slice(0, -6);
  return chain.flatMap((test, index) => {
    const arm = test.block.terminator;
    if (arm.kind !== "branch") throw new Error("Switch test lost its arm branch");
    const nextLow = labels[index + 1]?.low ?? chainEnd;
    return wordTestBlocks(
      cpu,
      test,
      labels[index]!.low,
      labels[index]!.high,
      nextLow,
      arm.target,
      nextLow,
      index === 0 ? prefix : [],
    );
  });
}

/**
 * Select the expert dispatch shape for ordinary runtime switches.
 *
 * Byte tests keep the selector in A and compare each case without reloading or
 * destroying it. Word tests replace the byte-XOR/scratch/OR equality with direct
 * low/high byte comparisons. A shared low byte is tested once for the whole chain.
 * Only linear single-predecessor test chains whose branch target is a switch arm
 * participate; every other equality keeps its ordinary lowering.
 *
 * @param blocks Complete lowered function blocks before terminal shaping.
 * @param cpu Exact selected CPU forms for replacement instructions.
 * @returns Optimized blocks and equality scratch requests no longer referenced.
 */
export function selectSwitchDispatch(
  blocks: readonly MachineBlock[],
  cpu: CpuFacts,
): SwitchDispatchResult {
  const byLabel = new Map(blocks.map((block) => [block.label, block] as const));
  const incoming = predecessorMap(blocks);
  const tests = new Map(blocks.map((block) => [block.label, switchTest(block)] as const));
  const consumed = new Set<string>();
  const replacements = new Map<string, readonly MachineBlock[]>();
  const removedLabels = new Set<string>();
  const scratchCandidates = new Set<string>();

  for (const block of blocks) {
    if (consumed.has(block.label)) continue;
    const first = tests.get(block.label);
    if (first === null || first === undefined) continue;
    const chain: SwitchTest[] = [first];
    for (;;) {
      const current = chain.at(-1)!;
      if (current.block.terminator.kind !== "branch") break;
      const next = byLabel.get(current.block.terminator.fallthrough);
      if (next === undefined) break;
      const candidate = tests.get(next.label);
      if (candidate === null || candidate === undefined) break;
      if (candidate.kind !== first.kind) break;
      const predecessors = incoming.get(next.label);
      if (predecessors?.size !== 1 || !predecessors.has(current.block.label)) break;
      chain.push(candidate);
    }
    // Only a real dispatch chain, never an isolated conditional whose arm
    // happens to share the internal label marker.
    if (chain.length === 1 && (incoming.get(block.label)?.size ?? 0) > 1) continue;
    const chainEnd =
      chain.at(-1)!.block.terminator.kind === "branch"
        ? (chain.at(-1)!.block.terminator as Extract<MachineTerminator, { kind: "branch" }>)
            .fallthrough
        : null;
    if (chainEnd === null) continue;
    // A removed test label must not be a data reference; its only control-flow
    // predecessor is the previous test in this chain.
    const removable = chain.slice(1).map((test) => test.block.label);
    if (removable.some((label) => labelUsedByInstruction(blocks, label))) continue;

    if (first.kind === "byte") {
      const rewritten = rewriteByteChain(chain as readonly ByteTest[], cpu);
      if (rewritten === null) continue;
      for (const [index, test] of chain.entries()) {
        consumed.add(test.block.label);
        replacements.set(test.block.label, [rewritten[index]!]);
      }
      continue;
    }

    const wordChain = chain as readonly WordTest[];
    for (const test of wordChain) scratchCandidates.add(test.scratchId);
    const common = rewriteCommonLowWordChain(wordChain, cpu, chainEnd);
    if (common !== null) {
      consumed.add(wordChain[0]!.block.label);
      replacements.set(wordChain[0]!.block.label, common);
      for (const test of wordChain.slice(1)) {
        consumed.add(test.block.label);
        removedLabels.add(test.block.label);
      }
      continue;
    }
    const general = rewriteGeneralWordChain(wordChain, cpu, chainEnd);
    if (general === null) continue;
    consumed.add(wordChain[0]!.block.label);
    replacements.set(wordChain[0]!.block.label, general);
    for (const test of wordChain.slice(1)) {
      consumed.add(test.block.label);
      removedLabels.add(test.block.label);
    }
  }

  if (replacements.size === 0) {
    return Object.freeze({ blocks, removedRequestIds: new Set<string>() });
  }
  const rewritten: MachineBlock[] = [];
  for (const block of blocks) {
    const replacement = replacements.get(block.label);
    if (replacement !== undefined) rewritten.push(...replacement);
    else if (!removedLabels.has(block.label)) rewritten.push(block);
  }
  const referenced = referencedRequests(rewritten);
  const removedRequestIds = new Set([...scratchCandidates].filter((id) => !referenced.has(id)));
  return Object.freeze({ blocks: Object.freeze(rewritten), removedRequestIds });
}
