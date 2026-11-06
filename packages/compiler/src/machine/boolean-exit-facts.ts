import type { MachineFunction, MachineInstruction } from "./machine-types.js";

/** Bind return facts to their exact body and the independently proved callees they used. */
const BOOLEAN_EXIT_SEAL = Symbol("boolean-exit-facts");

/** Private all-exit contract, never an assumption about the public Boolean calling convention. */
export interface BooleanExitFacts {
  /** Exact selected body, including its context-specific label and final shaping. */
  readonly function: MachineFunction;
  /** Every reachable ordinary RTS covered by this certificate. */
  readonly exits: readonly string[];
  /** Canonical A also owns N=0; removing a reload must not change negative flags. */
  readonly negativeClear: true;
  /** Immutable dependency identities cannot be replaced through public fields. */
  readonly [BOOLEAN_EXIT_SEAL]: {
    readonly function: MachineFunction;
    readonly dependencies: readonly BooleanExitFacts[];
  };
}

/** Owner-proved private bytes and exact direct callees for one selected body. */
export interface BooleanExitContext {
  /** Actual bodies against which every transitive certificate is checked. */
  readonly functions: ReadonlyMap<string, MachineFunction>;
  /** Independently established facts; the body being proved cannot certify itself. */
  readonly callees: ReadonlyMap<string, BooleanExitFacts>;
  /** Return an authenticated ordinary private-byte identity, or null for other memory. */
  readonly privateByte: (instruction: MachineInstruction) => string | null;
}

/** Finite accumulator/flag facts and only the private bytes known to hold zero or one. */
interface BooleanExitState {
  /** Exact accumulator byte when known; null may still be canonical. */
  readonly a: number | null;
  /** Both zero and one are canonical even when their exact join is unknown. */
  readonly canonical: boolean;
  /** Whether Z describes the current accumulator's zero test. */
  readonly zeroFromA: boolean;
  /** Whether N describes the current accumulator's sign bit. */
  readonly negativeFromA: boolean;
  /** Presence proves canonicality; the value is exact zero/one or their unknown join. */
  readonly memory: ReadonlyMap<string, number | null>;
}

/** Compare the finite memory component without relying on map insertion order. */
function sameMemory(left: BooleanExitState["memory"], right: BooleanExitState["memory"]): boolean {
  return (
    left.size === right.size &&
    [...left].every(([key, value]) => right.has(key) && right.get(key) === value)
  );
}

/** Keep a byte fact only when every predecessor establishes the same private identity. */
function joinedMemory(left: BooleanExitState["memory"], right: BooleanExitState["memory"]) {
  return new Map(
    [...left].flatMap(([key, value]) =>
      right.has(key) ? [[key, value === right.get(key) ? value : null] as const] : [],
    ),
  );
}

/** Track actual byte producers; unresolved stores and calls invalidate retained memory facts. */
function instructionState(
  before: BooleanExitState,
  instruction: MachineInstruction,
  context: BooleanExitContext | undefined,
  dependencies: Set<BooleanExitFacts>,
): BooleanExitState {
  const { opcode, operand } = instruction;
  if (opcode === "jsr") {
    const id =
      instruction.mode === "absolute" &&
      operand?.kind === "label" &&
      operand.addressByte === undefined &&
      operand.transform === undefined &&
      (operand.offset ?? 0) === 0
        ? operand.label
        : null;
    const callee = id === null ? undefined : context?.functions.get(id);
    const facts = id === null ? undefined : context?.callees.get(id);
    const certified =
      callee !== undefined &&
      facts !== undefined &&
      validBooleanExitFacts(facts, callee, context?.functions);
    if (certified) dependencies.add(facts);
    return {
      a: null,
      canonical: certified,
      zeroFromA: certified,
      negativeFromA: certified,
      memory: new Map(),
    };
  }
  const key = context?.privateByte(instruction) ?? null;
  let memory = before.memory;
  const directStore = ["sta", "stx", "sty"].includes(opcode);
  const memoryUpdate =
    ["inc", "dec", "asl", "lsr", "rol", "ror"].includes(opcode) &&
    instruction.mode !== "accumulator";
  if (directStore || memoryUpdate || instruction.memory.some(({ kind }) => kind === "write")) {
    const changed = key === null ? new Map<string, number | null>() : new Map(memory);
    if (key !== null) {
      if (opcode === "sta" && before.canonical) changed.set(key, before.a);
      else changed.delete(key);
    }
    memory = changed;
  }
  const immediate =
    instruction.mode === "immediate" && operand?.kind === "immediate" ? operand.value : null;
  if (opcode === "lda") {
    const retained = key !== null && memory.has(key);
    return {
      a: retained ? memory.get(key)! : immediate,
      canonical: retained || immediate === 0 || immediate === 1,
      zeroFromA: true,
      negativeFromA: true,
      memory,
    };
  }
  if (["and", "ora", "eor"].includes(opcode)) {
    const a =
      before.a === null || immediate === null
        ? null
        : opcode === "and"
          ? before.a & immediate
          : opcode === "ora"
            ? before.a | immediate
            : before.a ^ immediate;
    return { a, canonical: a === 0 || a === 1, zeroFromA: true, negativeFromA: true, memory };
  }
  if ((opcode === "cmp" && immediate === 0) || opcode === "tax" || opcode === "tay")
    return { ...before, zeroFromA: true, negativeFromA: true, memory };
  const changesA = instruction.defines.registers.includes("a");
  return {
    a: changesA ? null : before.a,
    canonical: !changesA && before.canonical,
    zeroFromA: !changesA && !instruction.defines.flags.includes("z") && before.zeroFromA,
    negativeFromA: !changesA && !instruction.defines.flags.includes("n") && before.negativeFromA,
    memory,
  };
}

/**
 * Prove canonical A=0/1 and agreeing N/Z at every reachable ordinary return.
 * Private-byte identities come from the owning storage proof, never guessed numeric
 * addresses. Joins intersect facts; calls discard memory facts before admitting only
 * an independently certified returned A. PLP loses flag agreement until a fresh load.
 * @param fn Actual selected machine body after local shaping.
 * @param context Optional owner-authenticated memory and direct-call facts.
 * @returns A body/dependency-bound certificate, or null for an unproved exit/transfer.
 */
export function deriveBooleanExitFacts(
  fn: MachineFunction,
  context?: BooleanExitContext,
): BooleanExitFacts | null {
  const first = fn.blocks[0];
  const blocks = new Map(fn.blocks.map((block) => [block.label, block]));
  if (first === undefined || blocks.size !== fn.blocks.length) return null;
  const states = new Map<string, BooleanExitState>();
  const pending: string[] = [];
  const queued = new Set<string>();
  const dependencies = new Set<BooleanExitFacts>();
  /** Each join only loses information, so the existing finite worklist converges. */
  const enqueue = (label: string, state: BooleanExitState): boolean => {
    if (!blocks.has(label)) return false;
    const old = states.get(label);
    const joined =
      old === undefined
        ? state
        : {
            a: old.a === state.a ? state.a : null,
            canonical: old.canonical && state.canonical,
            zeroFromA: old.zeroFromA && state.zeroFromA,
            negativeFromA: old.negativeFromA && state.negativeFromA,
            memory: joinedMemory(old.memory, state.memory),
          };
    if (
      old === undefined ||
      old.a !== joined.a ||
      old.canonical !== joined.canonical ||
      old.zeroFromA !== joined.zeroFromA ||
      old.negativeFromA !== joined.negativeFromA ||
      !sameMemory(old.memory, joined.memory)
    ) {
      states.set(label, joined);
      if (!queued.has(label)) {
        queued.add(label);
        pending.push(label);
      }
    }
    return true;
  };
  enqueue(first.label, {
    a: null,
    canonical: false,
    zeroFromA: false,
    negativeFromA: false,
    memory: new Map(),
  });
  const exits = new Map<string, BooleanExitState>();
  for (let index = 0; index < pending.length; index += 1) {
    const label = pending[index]!;
    queued.delete(label);
    const block = blocks.get(label)!;
    let state = states.get(label)!;
    for (const instruction of block.instructions) {
      if (
        [
          "jmp",
          "rti",
          "rts",
          "brk",
          "bcc",
          "bcs",
          "beq",
          "bne",
          "bmi",
          "bpl",
          "bvc",
          "bvs",
        ].includes(instruction.opcode)
      )
        return null;
      state = instructionState(state, instruction, context, dependencies);
    }
    const edge = block.terminator;
    if (edge.kind === "return") {
      exits.set(label, state);
      continue;
    }
    if (edge.kind === "unreachable") continue;
    if (edge.kind === "jump" || edge.kind === "fallthrough") {
      if (!enqueue(edge.target, state)) return null;
      continue;
    }
    const target = edge.kind === "long-branch" ? edge.jump.target : edge.target;
    const equalOnTarget =
      edge.kind === "long-branch" ? edge.opcode === "bne" : edge.opcode === "beq";
    const testsZero = ["beq", "bne"].includes(edge.opcode) && state.zeroFromA;
    for (const [destination, equal] of [
      [target, equalOnTarget],
      [edge.fallthrough, !equalOnTarget],
    ] as const) {
      if (testsZero && state.a !== null && (state.a === 0) !== equal) continue;
      if (!enqueue(destination, testsZero && equal ? { ...state, a: 0, canonical: true } : state))
        return null;
    }
  }
  if (
    exits.size === 0 ||
    [...exits.values()].some(
      (state) => !state.canonical || !state.zeroFromA || !state.negativeFromA,
    )
  )
    return null;
  return Object.freeze({
    function: fn,
    exits: Object.freeze([...exits.keys()]),
    negativeClear: true,
    [BOOLEAN_EXIT_SEAL]: Object.freeze({
      function: fn,
      dependencies: Object.freeze([...dependencies]),
    }),
  });
}

/**
 * Recheck exact transitive bodies; an unchanged caller cannot hide a replaced callee.
 * @param facts Original producer certificate.
 * @param fn Actual body being consumed now.
 * @param functions Current bodies, required when the certificate depends on calls.
 * @returns Whether every sealed body still belongs to this exact selection.
 */
export function validBooleanExitFacts(
  facts: BooleanExitFacts,
  fn: MachineFunction,
  functions?: ReadonlyMap<string, MachineFunction>,
): boolean {
  const pending = [facts];
  const seen = new Set<BooleanExitFacts>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const seal = current[BOOLEAN_EXIT_SEAL];
    const actual = current === facts ? fn : functions?.get(current.function.id);
    if (actual === undefined || current.function !== actual || seal?.function !== actual)
      return false;
    pending.push(...seal.dependencies);
  }
  return true;
}

/**
 * Discover only dependency-supported certificates, independent of source order.
 * Each newly proved body wakes its unproved direct callers; a cycle cannot supply
 * its own starting certificate. No instruction, request or ordinary ABI is changed.
 * @param functions Actual ordinary Boolean bodies admitted by the owner.
 * @param privateByte Owner-authenticated private identity for an instruction in that body.
 * @returns Exactly the bodies whose complete returned-value/flag proof closes.
 */
export function deriveBooleanExitGraph(
  functions: readonly MachineFunction[],
  privateByte: (fn: MachineFunction, instruction: MachineInstruction) => string | null,
): ReadonlyMap<string, BooleanExitFacts> {
  const byId = new Map(functions.map((fn) => [fn.id, fn]));
  const callers = new Map<string, Set<string>>();
  for (const fn of functions)
    for (const block of fn.blocks)
      for (const instruction of block.instructions) {
        const operand = instruction.operand;
        if (instruction.opcode !== "jsr" || operand?.kind !== "label") continue;
        const incoming = callers.get(operand.label) ?? new Set<string>();
        incoming.add(fn.id);
        callers.set(operand.label, incoming);
      }
  const facts = new Map<string, BooleanExitFacts>();
  const pending = [...byId.keys()];
  const queued = new Set(pending);
  for (let index = 0; index < pending.length; index += 1) {
    const id = pending[index]!;
    queued.delete(id);
    if (facts.has(id)) continue;
    const fn = byId.get(id)!;
    const proof = deriveBooleanExitFacts(fn, {
      functions: byId,
      callees: facts,
      privateByte: (instruction) => privateByte(fn, instruction),
    });
    if (proof === null) continue;
    facts.set(id, proof);
    for (const caller of callers.get(id) ?? [])
      if (!facts.has(caller) && !queued.has(caller)) {
        queued.add(caller);
        pending.push(caller);
      }
  }
  return facts;
}
