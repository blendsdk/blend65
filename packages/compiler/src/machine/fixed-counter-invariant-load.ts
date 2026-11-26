import type { SemanticBlock } from "../semantic/operations.js";
import type {
  FixedLoopRuntime,
  MachineBlock,
  MachineFunction,
  MachineInstruction,
} from "./machine-types.js";

/** Indexed store mode belonging to each counter register the finite schedule may select. */
const INDEXED_STORE_MODE = Object.freeze({ x: "absolute-x", y: "absolute-y" } as const);

/**
 * Whether this load's value is the same on every iteration of the loop around it.
 *
 * Two forms qualify and nothing else. An immediate carries its value in the
 * instruction, so nothing can change it. A named absolute read takes its value
 * from one module byte, and is admitted only while every access it makes is a
 * non-volatile read: a volatile read is an input whose count and order are
 * themselves observable, and moving one changes what the program observes even
 * when the byte it returns is identical.
 *
 * Requiring a named operand and requiring non-volatile accesses are deliberately
 * both here, and today either one alone would keep every volatile read out,
 * because a hardware read reaches its address as a literal rather than through a
 * name. That is a fact about the current lowering, not about the hazard: a named
 * hardware register would satisfy the operand test and still be unmovable, so
 * the access itself has to be asked about too.
 *
 * A load that reads a register is rejected whatever its mode, because the only
 * register this shape has to offer is the loop's own counter.
 */
function invariantLoad(instruction: MachineInstruction): boolean {
  if (instruction.opcode !== "lda" || instruction.uses.registers.length !== 0) return false;
  const immediate =
    instruction.mode === "immediate" &&
    instruction.operand?.kind === "immediate" &&
    instruction.memory.length === 0;
  const named =
    instruction.mode === "absolute" &&
    instruction.operand?.kind === "label" &&
    instruction.memory.every((effect) => effect.kind === "read" && !effect.volatile);
  return immediate || named;
}

/** Whether any of these instructions replaces the accumulator the hoisted load fills. */
function rewritesAccumulator(instructions: readonly MachineInstruction[]): boolean {
  return instructions.some((instruction) => instruction.defines.registers.includes("a"));
}

/**
 * The emitted blocks of one source block, or null when none is recorded.
 *
 * A source block can lower to more than one emitted block — a bounds guard or a
 * variable operation splits it — so asking about the block that carries the
 * source id would ask about only the first of them.
 *
 * The association is keyed by the stable source id rather than by object
 * identity, because context specialization may copy a role block, and a copy
 * would not be found by identity. A missing association is a refusal: inventing
 * one from the source id would quietly reduce this walk to the single-block
 * assumption it exists to remove, which is the unsound direction.
 */
function emittedBlocks(
  labelsBySource: ReadonlyMap<string, readonly string[]>,
  source: SemanticBlock,
  blocks: readonly MachineBlock[],
): readonly MachineBlock[] | null {
  const labels = labelsBySource.get(source.id);
  if (labels === undefined) return null;
  const named = new Set(labels);
  return blocks.filter((block) => named.has(block.label));
}

/**
 * Whether appending an instruction that rewrites N and Z to this block is safe.
 *
 * Only a block leaving through an unconditional edge qualifies. A conditional
 * edge reads the flags its own instructions settled, and an appended load would
 * answer the branch with the loaded byte instead.
 */
function acceptsAppendedLoad(block: MachineBlock): boolean {
  return block.terminator.kind === "jump" || block.terminator.kind === "fallthrough";
}

/**
 * Load a finite loop's invariant byte once, before the loop, instead of on every trip.
 *
 * The accumulator is the one register this loop shape leaves alone: its store,
 * increment and comparison all write elsewhere, and the zero-high comparison work
 * that would have overwritten A has already been removed under its own
 * continuation proof. So the byte a body reloads each trip is still in A from the
 * trip before, and the reload is work for nothing — `(trips - 1)` copies of it.
 *
 * The move is only sound where the value cannot change underneath it, which is
 * why the program may install no interrupt route and expose no callable or
 * interrupt root: an asynchronous write between the hoisted load and the last
 * store would be observed by the loop as it stands and not by the hoisted form.
 *
 * The loop must also be proved to run at least twice. Once is the soundness
 * floor — a load must not become newly executed on a path that previously
 * skipped it — but twice is the floor that matters: a single trip has no repeat
 * to remove, so moving its load would reorder a program's bytes for no gain at
 * all, and a transformation that changes output without improving it is noise.
 *
 * Nothing else about the schedule changes. The accumulator and the flags at the
 * loop's exit are what they were, because the exit is reached through the same
 * comparison and the body's last store leaves A alone.
 *
 * @param fn Selected body after the comparison state has been settled.
 * @param runtime Exact source loops, counter registers and block associations.
 * @returns The body with each proved invariant load moved to its preheader.
 * @example const hoisted = hoistFixedCounterInvariantLoads(selected, runtime);
 */
export function hoistFixedCounterInvariantLoads(
  fn: MachineFunction,
  runtime: FixedLoopRuntime,
): MachineFunction {
  if (runtime.counters.size === 0 || runtime.interruptObservers) return fn;
  const labelsBySource = new Map(
    [...runtime.sourceBlocks].map(([block, labels]) => [block.id, labels] as const),
  );
  let blocks = fn.blocks;
  for (const counter of runtime.counters.values()) {
    const { loop, register } = counter;
    if (register === null || loop.tripDomain.minimum < 2) continue;
    // The cycle has to be the body and the update and nothing else. Asking only
    // about those two and the test would say nothing about a third block inside
    // the cycle, and a loop whose body contains its own loop or a branch has
    // exactly that: blocks that run between one store and the next, free to
    // leave anything in the accumulator.
    if (
      loop.members.size !== 2 ||
      !loop.members.has(loop.body.id) ||
      !loop.members.has(loop.update.id) ||
      loop.body.terminator.kind !== "jump" ||
      loop.body.terminator.target !== loop.update.id
    )
      continue;
    const at = (id: string) => blocks.find((block) => block.label === id);
    const preheader = at(loop.preheader.id),
      header = at(loop.header.id),
      body = at(loop.body.id),
      update = at(loop.update.id);
    if (
      preheader === undefined ||
      header === undefined ||
      body === undefined ||
      update === undefined ||
      body.instructions.length !== 2
    )
      continue;
    const [load, store] = body.instructions;
    // Each of the three roles must have lowered to exactly the one emitted block
    // the role lookup already found. A role that split would put code in the
    // cycle this walk has not seen, and counting the three together would let
    // one role's extra block hide another role's missing one.
    const roles = [header, body, update];
    const emitted = [loop.header, loop.body, loop.update].map((source) =>
      emittedBlocks(labelsBySource, source, blocks),
    );
    if (emitted.some((found, index) => found?.length !== 1 || found[0] !== roles[index])) continue;
    const carried = roles.flatMap((block) =>
      block === body ? block.instructions.slice(1) : block.instructions,
    );
    if (
      load === undefined ||
      store === undefined ||
      !invariantLoad(load) ||
      store.opcode !== "sta" ||
      store.mode !== INDEXED_STORE_MODE[register] ||
      rewritesAccumulator(carried) ||
      !acceptsAppendedLoad(preheader)
    )
      continue;
    // Every path into the body runs the preheader first: the header is entered
    // from the preheader and the update alone, and the body only from those two.
    const entries = runtime.predecessors.get(loop.header.id) ?? [];
    const reached = runtime.predecessors.get(loop.body.id) ?? [];
    if (
      entries.length !== 2 ||
      !entries.includes(loop.preheader.id) ||
      !entries.includes(loop.update.id) ||
      reached.some((id) => id !== loop.header.id && id !== loop.preheader.id)
    )
      continue;
    blocks = Object.freeze(
      blocks.map((block) =>
        block.label === loop.body.id
          ? Object.freeze({ ...block, instructions: Object.freeze([store]) })
          : block.label === loop.preheader.id
            ? Object.freeze({
                ...block,
                instructions: Object.freeze([...block.instructions, load]),
              })
            : block,
      ),
    );
  }
  return blocks === fn.blocks ? fn : Object.freeze({ ...fn, blocks });
}
