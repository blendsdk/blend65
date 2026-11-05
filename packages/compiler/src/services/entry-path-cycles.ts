import type {
  MachineBlock,
  MachineFunction,
  MachineProgram,
  MachineTerminator,
} from "../machine/machine-types.js";
import type { OptimizationCycleMeasurement } from "../machine/optimization-cost.js";

/** One inclusive cycle range for a completed path alternative. */
interface CycleRange {
  readonly minimum: number;
  readonly maximum: number;
}

/** Proven iteration interval for one machine loop header. */
interface LoopBound {
  readonly header: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly members: ReadonlySet<string>;
  readonly exits: readonly {
    readonly kind: "update" | "break" | "return";
    readonly target: string | null;
  }[];
}

/** Mutable walk state for one path alternative. */
interface WalkState {
  readonly path: ReadonlySet<string>;
  readonly callStack: ReadonlySet<string>;
  /** Enclosing loop header at which a nested loop's exit stops. */
  readonly boundary?: string;
}

const UNKNOWN_STATE_LIMIT = 200_000;
const MAX_WALK_DEPTH = 192;

/**
 * Sum instruction cycles and inline known direct calls and bounded loops.
 *
 * This is intentionally a proof-carrying range, not a dynamic profile. A path
 * alternative is included only when every instruction, call target and loop
 * trip count is known from the closed machine program and its loop proofs. An
 * unproved retry, indirect target, recursive call, exceeded state budget or
 * unproved cycle makes the whole measurement unknown.
 */
class EntryPathAnalysis {
  private readonly blocks = new Map<string, MachineBlock>();
  private readonly functions = new Map<string, MachineFunction>();
  private readonly loops = new Map<string, LoopBound>();
  private readonly loopEntries = new Map<string, LoopBound>();
  private readonly memo = new Map<string, CycleRange | null>();
  private states = 0;
  private failed = false;

  constructor(private readonly program: MachineProgram) {
    for (const fn of [program.startup, ...program.functions]) {
      this.functions.set(fn.id, fn);
      for (const block of fn.blocks) this.blocks.set(block.label, block);
    }
    for (const fn of program.functions) this.collectLoops(fn);
    // Original (non-fixed) loops retain their checked source facts without a
    // fixed-counter proof; they are still proved induction facts, not guesses.
    for (const packet of program.storageSelection?.sourceFacts?.functions.values() ?? [])
      for (const loop of packet.loops) this.addSourceLoop(loop);
    this.collectMachineCountedLoops();
  }

  /** Return the complete entry-to-return measurement. */
  measure(): OptimizationCycleMeasurement {
    const entry = this.program.startup.blocks[0];
    if (entry === undefined) return Object.freeze({ kind: "unknown" });
    const range = this.walkBlock(entry.label, emptyState(), 0);
    if (range === null || this.failed) return Object.freeze({ kind: "unknown" });
    return range.minimum === range.maximum
      ? Object.freeze({ kind: "exact" as const, value: range.minimum })
      : Object.freeze({
          kind: "range" as const,
          minimum: range.minimum,
          maximum: range.maximum,
        });
  }

  /** Index every loop that can be recognised by its machine header label. */
  private collectLoops(fn: MachineFunction): void {
    const add = (loop: {
      readonly header: { readonly id: string };
      readonly body: { readonly id: string };
      readonly members: ReadonlySet<string>;
      readonly tripDomain: { readonly minimum: number; readonly maximum: number };
      readonly exactIterations: number | null;
      readonly exits: readonly {
        readonly kind: "update" | "break" | "return";
        readonly target: string | { readonly id: string } | null;
      }[];
    }): void => {
      const exact = loop.exactIterations;
      const minimum = exact ?? loop.tripDomain.minimum;
      const maximum = exact ?? loop.tripDomain.maximum;
      if (
        !Number.isSafeInteger(minimum) ||
        !Number.isSafeInteger(maximum) ||
        minimum < 0 ||
        maximum < minimum ||
        maximum > 256
      )
        return;
      const bound: LoopBound = {
        header: loop.header.id,
        minimum,
        maximum,
        members: loop.members,
        exits: Object.freeze(
          loop.exits.map((exit) =>
            Object.freeze({
              kind: exit.kind,
              target:
                exit.target === null
                  ? null
                  : typeof exit.target === "string"
                    ? exit.target
                    : exit.target.id,
            }),
          ),
        ),
      };
      this.loops.set(loop.header.id, bound);
      this.loopEntries.set(loop.body.id, bound);
    };
    for (const proof of fn.fixedCounterProofs ?? []) add(proof.loop);
    for (const proof of fn.fixedLoopProofs ?? []) add(proof.loop);
  }

  /** Add one checked source loop that has no fixed-counter representation. */
  private addSourceLoop(loop: {
    readonly header: { readonly id: string };
    readonly body: { readonly id: string };
    readonly members: ReadonlySet<string>;
    readonly tripDomain: { readonly minimum: number; readonly maximum: number };
    readonly exactIterations: number | null;
    readonly exits: readonly {
      readonly kind: "update" | "break" | "return";
      readonly target: string | { readonly id: string } | null;
    }[];
  }): void {
    if (this.loops.has(loop.header.id)) return;
    const exact = loop.exactIterations;
    const minimum = exact ?? loop.tripDomain.minimum;
    const maximum = exact ?? loop.tripDomain.maximum;
    if (
      !Number.isSafeInteger(minimum) ||
      !Number.isSafeInteger(maximum) ||
      minimum < 0 ||
      maximum < minimum ||
      maximum > 256
    )
      return;
    const bound: LoopBound = {
      header: loop.header.id,
      minimum,
      maximum,
      members: loop.members,
      exits: Object.freeze(
        loop.exits.map((exit) =>
          Object.freeze({
            kind: exit.kind,
            target:
              exit.target === null
                ? null
                : typeof exit.target === "string"
                  ? exit.target
                  : exit.target.id,
          }),
        ),
      ),
    };
    this.loops.set(loop.header.id, bound);
    this.loopEntries.set(loop.body.id, bound);
  }

  /** Recognise compiler-generated down-counted loops such as startup capture/restore. */
  private collectMachineCountedLoops(): void {
    for (const [label, block] of this.blocks) {
      if (this.loops.has(label)) continue;
      const terminator = block.terminator;
      if (
        terminator.kind !== "branch" ||
        (terminator.opcode !== "bpl" && terminator.opcode !== "bne") ||
        terminator.target !== label
      )
        continue;
      const decrement = block.instructions.find(
        (instruction) => instruction.opcode === "dex" || instruction.opcode === "dey",
      );
      if (decrement === undefined) continue;
      const register = decrement.opcode === "dex" ? "x" : "y";
      const seed = this.counterSeed(label, register);
      // A generated variable-shift loop consumes a guarded byte count. Its
      // lowering emits the `>= 8` saturation arm and the zero-count arm before
      // this loop, so the loop runs once per remaining bit in 1..7.
      const generatedShift = terminator.opcode === "bne" && label.includes(".shift.");
      if (!generatedShift && (seed === undefined || seed < 0 || seed > 255)) continue;
      const minimum = generatedShift ? 1 : terminator.opcode === "bpl" ? seed! + 1 : seed!;
      const maximum = generatedShift ? 7 : minimum;
      if (minimum < 1 || maximum < minimum) continue;
      const bound: LoopBound = {
        header: label,
        minimum,
        maximum,
        members: new Set([label]),
        exits: Object.freeze([{ kind: "update" as const, target: null }]),
      };
      this.loops.set(label, bound);
      this.loopEntries.set(label, bound);
    }
  }

  /** Find the immediate counter load on a direct predecessor of a self-loop. */
  private counterSeed(label: string, register: "x" | "y"): number | undefined {
    for (const [candidate, block] of this.blocks) {
      if (candidate === label) continue;
      const terminator = block.terminator;
      const enters =
        ((terminator.kind === "jump" || terminator.kind === "fallthrough") &&
          terminator.target === label) ||
        (terminator.kind === "branch" &&
          (terminator.target === label || terminator.fallthrough === label));
      if (!enters) continue;
      for (let index = block.instructions.length - 1; index >= 0; index -= 1) {
        const instruction = block.instructions[index]!;
        if (!instruction.defines.registers.includes(register)) continue;
        if (
          instruction.opcode === (register === "x" ? "ldx" : "ldy") &&
          instruction.operand?.kind === "immediate"
        )
          return instruction.operand.value;
        break;
      }
    }
    return undefined;
  }

  /** Memoize one block range by its label and enclosing-loop boundary. */
  private walkBlock(label: string, state: WalkState, depth: number): CycleRange | null {
    const key = `${label}\0${state.boundary ?? ""}`;
    if (this.memo.has(key)) return this.memo.get(key)!;
    const result = this.walkBlockUncached(label, state, depth);
    this.memo.set(key, result);
    return result;
  }

  /** Walk one block and all alternatives until return or a proved loop bound. */
  private walkBlockUncached(label: string, state: WalkState, depth: number): CycleRange | null {
    if (this.failed) return null;
    if (depth > MAX_WALK_DEPTH) {
      this.failed = true;
      return null;
    }
    this.states += 1;
    if (this.states > UNKNOWN_STATE_LIMIT) {
      this.failed = true;
      return null;
    }
    if (state.path.has(label)) return null;
    const block = this.blocks.get(label);
    if (block === undefined) return null;
    const nextState: WalkState = Object.freeze({
      path: new Set(state.path).add(label),
      callStack: state.callStack,
      ...(state.boundary === undefined ? {} : { boundary: state.boundary }),
    });
    const cost = this.walkInstructions(block, nextState, depth + 1);
    if (cost === null) return null;
    const terminator = this.walkTerminator(block.terminator, nextState, depth + 1);
    if (terminator === null) return null;
    return {
      minimum: cost.minimum + terminator.minimum,
      maximum: cost.maximum + terminator.maximum,
    };
  }

  /** Sum block instructions and inline direct calls. */
  private walkInstructions(
    block: MachineBlock,
    state: WalkState,
    depth: number,
  ): CycleRange | null {
    let minimum = 0;
    let maximum = 0;
    for (const instruction of block.instructions) {
      if (["brk", "rti"].includes(instruction.opcode)) return null;
      if (instruction.opcode === "jsr") {
        if (instruction.operand?.kind !== "label") return null;
        const callee = this.functions.get(instruction.operand.label);
        if (callee === undefined || state.callStack.has(callee.id)) return null;
        const entry = callee.blocks[0];
        if (entry === undefined) return null;
        const calleeState: WalkState = Object.freeze({
          path: new Set<string>(),
          callStack: new Set(state.callStack).add(callee.id),
          ...(state.boundary === undefined ? {} : { boundary: state.boundary }),
        });
        const result = this.walkBlock(entry.label, calleeState, depth + 1);
        if (result === null) return null;
        minimum += instruction.cost.minCycles + result.minimum;
        maximum += instruction.cost.maxCycles + result.maximum;
        continue;
      }
      if (instruction.opcode === "jmp") return null;
      minimum += instruction.cost.minCycles;
      maximum += instruction.cost.maxCycles;
    }
    return { minimum, maximum };
  }

  /** Follow every structured edge, applying proved loop trip intervals. */
  private walkTerminator(
    terminator: MachineTerminator,
    state: WalkState,
    depth: number,
  ): CycleRange | null {
    const base = this.terminatorCost(terminator);
    if (terminator.kind === "return") return base;
    if (terminator.kind === "unreachable") {
      this.failed = true;
      return null;
    }
    if (terminator.kind === "fallthrough")
      return this.join(base, this.walkSuccessor(terminator.target, state, depth));
    if (terminator.kind === "jump")
      return this.join(base, this.walkSuccessor(terminator.target, state, depth));
    if (terminator.kind === "long-branch")
      return this.join(
        base,
        this.join(
          this.walkSuccessor(terminator.fallthrough, state, depth),
          this.walkSuccessor(terminator.jump.target, state, depth),
        ),
      );
    return this.join(
      base,
      this.join(
        this.walkSuccessor(terminator.target, state, depth),
        this.walkSuccessor(terminator.fallthrough, state, depth),
      ),
    );
  }

  /** Enter a target block or function tail jump, respecting a proved loop header. */
  private walkSuccessor(label: string, state: WalkState, depth: number): CycleRange | null {
    const functionTarget = this.functions.get(label);
    if (functionTarget !== undefined) {
      const entry = functionTarget.blocks[0];
      if (entry === undefined) return null;
      return this.walkBlock(entry.label, state, depth + 1);
    }
    if (state.boundary !== undefined && label === state.boundary) return { minimum: 0, maximum: 0 };
    // Reaching a loop header already on this path is the current iteration's
    // back edge; the loop range handles repetition separately.
    if (this.loops.has(label) && state.path.has(label)) return { minimum: 0, maximum: 0 };
    if (!this.blocks.has(label)) return null;
    const loop = this.loops.get(label);
    if (loop !== undefined) return this.walkLoop(loop, label, state, depth);
    const bodyEntry = this.loopEntries.get(label);
    if (bodyEntry !== undefined) return this.walkLoop(bodyEntry, bodyEntry.header, state, depth);
    return this.walkBlock(label, state, depth + 1);
  }

  /** Cost one proved loop from its header to its exit. */
  private walkLoop(
    loop: LoopBound,
    header: string,
    state: WalkState,
    depth: number,
  ): CycleRange | null {
    const block = this.blocks.get(header);
    if (block === undefined) return null;
    const bodyTargets = this.successors(header).filter((target) => loop.members.has(target));
    const exitTargets = new Set(
      this.successors(header).filter((target) => !loop.members.has(target)),
    );
    for (const exit of loop.exits)
      if (exit.target !== null && exit.target !== header && !loop.members.has(exit.target))
        exitTargets.add(exit.target);
    const headerIsBody = bodyTargets.length === 1 && bodyTargets[0] === header;
    const headerCost = headerIsBody ? null : this.walkInstructions(block, state, depth + 1);
    if (!headerIsBody && headerCost === null) return null;
    const iteration = this.joinMany(
      bodyTargets.map((target) =>
        this.walkLoopBody(loop, target, state, new Set<string>(), depth + 1),
      ),
    );
    if (iteration === null) return null;
    const exit = this.joinMany(
      [...exitTargets].map((target) => this.walkSuccessor(target, state, depth + 1)),
    );
    if (exit === null) return null;
    const base = headerCost ?? { minimum: 0, maximum: 0 };
    const perIteration = {
      minimum: base.minimum + iteration.minimum,
      maximum: base.maximum + iteration.maximum,
    };
    const earlyExit = loop.exits.some((entry) => entry.kind !== "update");
    if (earlyExit)
      return {
        minimum: loop.minimum === 0 ? exit.minimum : loop.minimum * perIteration.minimum,
        maximum: loop.maximum * perIteration.maximum + exit.maximum,
      };
    return {
      minimum: loop.minimum * perIteration.minimum + exit.minimum,
      maximum: loop.maximum * perIteration.maximum + exit.maximum,
    };
  }

  /** Cost one iteration inside a loop; the back edge or any outside edge ends it. */
  private walkLoopBody(
    loop: LoopBound,
    label: string,
    state: WalkState,
    seen: ReadonlySet<string>,
    depth: number,
  ): CycleRange | null {
    if (!loop.members.has(label)) return { minimum: 0, maximum: 0 };
    if (label === loop.header) {
      if (seen.size > 0) return { minimum: 0, maximum: 0 };
    } else if (seen.has(label)) return null;
    const nested = this.loops.get(label);
    if (nested !== undefined && nested !== loop) {
      const nestedState: WalkState = Object.freeze({
        path: state.path,
        callStack: state.callStack,
        boundary: loop.header,
      });
      return this.walkLoop(nested, label, nestedState, depth);
    }
    const block = this.blocks.get(label);
    if (block === undefined) return null;
    const cost = this.walkInstructions(block, state, depth + 1);
    if (cost === null) return null;
    const nextSeen = new Set(seen).add(label);
    const terminator = block.terminator;
    const base = this.terminatorCost(terminator);
    const successorRange = (target: string): CycleRange | null => {
      if (target === loop.header || !loop.members.has(target)) return { minimum: 0, maximum: 0 };
      const targetLoop = this.loops.get(target);
      if (targetLoop !== undefined && targetLoop !== loop) {
        const nestedState: WalkState = Object.freeze({
          path: state.path,
          callStack: state.callStack,
          boundary: loop.header,
        });
        return this.walkLoop(targetLoop, target, nestedState, depth + 1);
      }
      return this.walkLoopBody(loop, target, state, nextSeen, depth + 1);
    };
    const edge =
      terminator.kind === "jump" || terminator.kind === "fallthrough"
        ? successorRange(terminator.target)
        : terminator.kind === "branch"
          ? this.join(successorRange(terminator.target), successorRange(terminator.fallthrough))
          : terminator.kind === "long-branch"
            ? this.join(
                successorRange(terminator.fallthrough),
                successorRange(terminator.jump.target),
              )
            : { minimum: 0, maximum: 0 };
    if (edge === null) return null;
    return {
      minimum: cost.minimum + base.minimum + edge.minimum,
      maximum: cost.maximum + base.maximum + edge.maximum,
    };
  }

  /** List the direct successor labels of one already indexed block. */
  private successors(label: string): readonly string[] {
    const block = this.blocks.get(label);
    if (block === undefined) return [];
    const terminator = block.terminator;
    if (terminator.kind === "jump" || terminator.kind === "fallthrough") return [terminator.target];
    if (terminator.kind === "branch") return [terminator.target, terminator.fallthrough];
    if (terminator.kind === "long-branch") return [terminator.fallthrough, terminator.jump.target];
    return [];
  }

  /** Return the structured terminator's own cycle cost. */
  private terminatorCost(terminator: MachineTerminator): CycleRange {
    const cost = "cost" in terminator && terminator.cost !== undefined ? terminator.cost : null;
    return cost === null
      ? { minimum: 0, maximum: 0 }
      : { minimum: cost.minCycles, maximum: cost.maxCycles };
  }

  /** Combine two alternatives into one inclusive range. */
  private join(left: CycleRange | null, right: CycleRange | null): CycleRange | null {
    if (left === null || right === null) return null;
    return {
      minimum: Math.min(left.minimum, right.minimum),
      maximum: Math.max(left.maximum, right.maximum),
    };
  }

  /** Combine zero or more alternatives; an empty set is a zero-cost path. */
  private joinMany(ranges: readonly (CycleRange | null)[]): CycleRange | null {
    if (ranges.length === 0) return { minimum: 0, maximum: 0 };
    return ranges.reduce<CycleRange | null>((total, range) => this.join(total, range), {
      minimum: Number.POSITIVE_INFINITY,
      maximum: 0,
    });
  }
}

/** Start a path with no visited block or call frame. */
function emptyState(): WalkState {
  return Object.freeze({
    path: new Set<string>(),
    callStack: new Set<string>(),
  });
}

/**
 * Derive the exact/range cycle measurement for the program entry-to-return
 * semantic path from the final machine program.
 *
 * The analysis is frequency-free and uses only the selected instruction forms,
 * structured edges, direct call targets and proved loop trip intervals. It
 * returns `unknown` whenever one alternative is not fully proved; it never
 * substitutes zero, an average or a benchmark-specific estimate.
 *
 * @param program Final machine program after rule, loop and storage closure.
 * @returns Exact, range or honest unknown for `program.entry-to-return`.
 * @example const cycles = deriveEntryPathCycles(layout.program);
 */
export function deriveEntryPathCycles(program: MachineProgram): OptimizationCycleMeasurement {
  return new EntryPathAnalysis(program).measure();
}
