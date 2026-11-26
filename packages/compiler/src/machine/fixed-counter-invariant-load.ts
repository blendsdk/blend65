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
  let blocks = fn.blocks;
  for (const counter of runtime.counters.values()) {
    const { loop, register } = counter;
    if (register === null || loop.tripDomain.minimum < 2) continue;
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
    if (
      load === undefined ||
      store === undefined ||
      !invariantLoad(load) ||
      store.opcode !== "sta" ||
      store.mode !== INDEXED_STORE_MODE[register] ||
      rewritesAccumulator([store, ...header.instructions, ...update.instructions]) ||
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
