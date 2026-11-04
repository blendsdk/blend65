import type { SourceSpan } from "../project/types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type { FixedLoopRuntime } from "./fixed-loop-selection.js";
import type { SemanticTerminator } from "../semantic/operations.js";
import type { CpuFacts } from "../target/nmos6510.js";
import { nmosInstructionForm, nmosInstructionState } from "../target/nmos6510.js";
import type {
  MachineCost,
  MachineFunction,
  MachineBlock,
  MachineInstruction,
  MachineMemoryEffect,
  MachineOperand,
  MachineStateUse,
  MachineTerminator,
} from "./machine-types.js";

/** Value location retained while one semantic function is selected into machine operations. */
export type LoweredValue =
  | {
      readonly kind: "constant";
      readonly value: number;
      readonly bytes: number;
      readonly signed?: boolean;
    }
  | {
      readonly kind: "storage";
      readonly requestId: string;
      readonly bytes: number;
      readonly signed?: boolean;
      /** First byte inside a wider certified home. */
      readonly offset?: number;
    }
  | {
      readonly kind: "label";
      readonly label: string;
      readonly bytes: number;
      readonly signed?: boolean;
      /** First byte of a scalar view inside the same resident data symbol. */
      readonly offset?: number;
      readonly transform?: "vic-sprite-block";
      /** Source-owned zero-page data has a proved one-byte physical address. */
      readonly zeroPage?: boolean;
    }
  | {
      /** The two immediate bytes of a function's code address, not its code contents. */
      readonly kind: "symbol-address";
      readonly label: string;
      readonly bytes: number;
      readonly signed?: boolean;
    }
  | {
      readonly kind: "register";
      readonly registers: "a" | "x" | "y" | "ax" | "ay";
      readonly bytes: 1 | 2;
      readonly signed?: boolean;
    }
  | {
      readonly kind: "zero-extended";
      readonly low: LoweredValue;
      readonly bytes: 2;
      readonly signed: boolean;
    }
  | {
      /**
       * A proved `constantBase + unsignedByteIndex` address, retained instead of
       * being computed into a temporary word.
       *
       * Only the volatile raw-memory read that owns this value may consume it: it
       * emits the native `absolute,X` form. Every other consumer fails loudly in
       * `modeForValue`, so this value can never be mistaken for the computed sum.
       */
      readonly kind: "ordinal-address";
      readonly base: number;
      readonly index: LoweredValue;
      readonly bytes: number;
      readonly signed: boolean;
    }
  | {
      readonly kind: "condition";
      readonly whenTrue: string;
      readonly usesFlag: "n" | "v" | "z" | "c";
    };

/** Return the exact packed byte width of one semantic type. */
export function typeBytes(type: SemanticType): number {
  if (type.kind === "array" || type.kind === "struct") return type.size;
  if (type.kind === "function" || type.kind === "interrupt-handler") return 2;
  if (type.kind === "enum") return 1;
  if (type.name === "void") return 0;
  return type.name === "word" || type.name === "sword" ? 2 : 1;
}

/** Return whether one scalar uses signed two's-complement ordering. */
export function isSignedType(type: SemanticType): boolean {
  return type.kind === "scalar" && (type.name === "sbyte" || type.name === "sword");
}

/** Convert a source binding into the stable generated label used by layout and serialization. */
export function bindingLabel(prefix: string, binding: BindingId): string {
  return `${prefix}.${bindingIdentityKey(binding)}`;
}

/** Return each distinct semantic successor without introducing a second graph. */
export function semanticSuccessors(terminator: SemanticTerminator): readonly string[] {
  if (terminator.kind === "jump") return Object.freeze([terminator.target]);
  if (terminator.kind !== "branch") return Object.freeze([]);
  return terminator.whenTrue === terminator.whenFalse
    ? Object.freeze([terminator.whenTrue])
    : Object.freeze([terminator.whenTrue, terminator.whenFalse]);
}

/** Return declared machine successors, including inverse-branch-over-jump relaxation. */
export function machineSuccessors(block: MachineBlock): readonly string[] {
  const edge = block.terminator;
  if (edge.kind === "branch") return [edge.target, edge.fallthrough];
  if (edge.kind === "long-branch") return [edge.jump.target, edge.fallthrough];
  return edge.kind === "jump" || edge.kind === "fallthrough" ? [edge.target] : [];
}

/** Bounded prefix differences; physical/asynchronous observations remain separate obligations. */
export const BYTE_WINDOW_CHANGED = Object.freeze({ a: 1, n: 2, c: 4, x: 8, z: 16, v: 32, y: 64 });

/** Reduce existing CPU effects to the state components relevant to bounded byte windows. */
function stateMask(state: MachineStateUse): number {
  return (
    (state.registers.includes("a") ? BYTE_WINDOW_CHANGED.a : 0) |
    (state.flags.includes("n") ? BYTE_WINDOW_CHANGED.n : 0) |
    (state.flags.includes("c") ? BYTE_WINDOW_CHANGED.c : 0) |
    (state.registers.includes("x") ? BYTE_WINDOW_CHANGED.x : 0) |
    (state.flags.includes("z") ? BYTE_WINDOW_CHANGED.z : 0) |
    (state.flags.includes("v") ? BYTE_WINDOW_CHANGED.v : 0) |
    (state.registers.includes("y") ? BYTE_WINDOW_CHANGED.y : 0)
  );
}

/** A bounded continuation prefix; different components only disappear, never grow. */
interface PrefixState {
  readonly block: string;
  readonly start: number;
  readonly changed: number;
  children?: readonly PrefixState[];
}

/**
 * Cache supported prefix proofs without a general flag allocator or recursive host walk.
 * Calls, cycles and unresolved transfers reject the window. Both successor paths
 * use the caller's explicit return obligations (A/N/X by default). Other flags
 * are not a strengthened public return ABI. Reads are checked before definitions.
 */
export function byteContinuationQuery(
  blocks: ReadonlyMap<string, MachineBlock>,
  returnUses: MachineStateUse = { registers: ["a", "x"], flags: ["n"] },
) {
  const memo = new Map<string, boolean>();
  const returnState = stateMask(returnUses);
  const key = (state: PrefixState) => `${state.block}\0${state.start}\0${state.changed}`;
  return (block: string, start: number, changed: number): boolean => {
    const initial: PrefixState = { block, start, changed };
    const pending = [initial];
    const visiting = new Set<string>();
    const finish = (state: PrefixState, safe: boolean) => {
      memo.set(key(state), safe);
      visiting.delete(key(state));
      pending.pop();
    };
    while (pending.length > 0) {
      const state = pending.at(-1)!;
      const id = key(state);
      if (memo.has(id)) {
        pending.pop();
        continue;
      }
      if (state.children === undefined) {
        visiting.add(id);
        const current = blocks.get(state.block);
        if (current === undefined) {
          finish(state, false);
          continue;
        }
        let different = state.changed;
        let rejected = false;
        for (const instruction of current.instructions.slice(state.start)) {
          if (different === 0) break;
          if (
            instruction.opcode === "jsr" ||
            instruction.opcode === "jmp" ||
            (stateMask(instruction.uses) & different) !== 0
          ) {
            rejected = true;
            break;
          }
          different &= ~stateMask(instruction.defines);
        }
        if (rejected || different === 0) {
          finish(state, !rejected);
          continue;
        }
        const terminal = current.terminator;
        if (terminal.kind === "return") {
          finish(state, (different & returnState) === 0);
          continue;
        }
        if (
          (terminal.kind === "branch" || terminal.kind === "long-branch") &&
          (stateMask(terminal.uses) & different) !== 0
        ) {
          finish(state, false);
          continue;
        }
        const targets = machineSuccessors(current);
        if (targets.length === 0) {
          finish(state, false);
          continue;
        }
        state.children = targets.map((target) => ({ block: target, start: 0, changed: different }));
      }
      if (state.children.some((child) => memo.get(key(child)) === false)) {
        finish(state, false);
        continue;
      }
      const next = state.children.find((child) => !memo.has(key(child)));
      if (next === undefined) finish(state, true);
      else if (visiting.has(key(next))) finish(state, false);
      else pending.push(next);
    }
    return memo.get(key(initial)) ?? false;
  };
}

/** Build an immutable machine-state record. */
export function machineState(
  registers: MachineStateUse["registers"] = [],
  flags: MachineStateUse["flags"] = [],
): MachineStateUse {
  return Object.freeze({ registers: Object.freeze(registers), flags: Object.freeze(flags) });
}

/** Return the exact cost of one documented physical form. */
export function machineCost(cpu: CpuFacts, opcode: string, mode: string): MachineCost {
  const form = nmosInstructionForm(cpu, opcode, mode);
  if (form === null) throw new Error(`Illegal NMOS instruction form: ${opcode}/${mode}`);
  return Object.freeze({
    bytes: form.bytes,
    minCycles: form.minCycles,
    maxCycles: form.maxCycles,
  });
}

/**
 * Construct one documented instruction, preserving symbolic storage until final binding.
 *
 * A `storage` mode is not a second instruction set. It says only that final closure must choose
 * between the opcode's zero-page and absolute forms. Its provisional cost is the absolute form.
 */
export function machineInstruction(
  cpu: CpuFacts,
  opcode: string,
  mode: string,
  operand: MachineOperand | null,
  memory: readonly MachineMemoryEffect[] = [],
  source: SourceSpan | null = null,
): MachineInstruction {
  const physicalMode = mode === "storage" ? "absolute" : mode;
  const form = nmosInstructionForm(cpu, opcode, physicalMode);
  if (form === null) throw new Error(`Illegal NMOS instruction form: ${opcode}/${mode}`);
  const state = nmosInstructionState(cpu, opcode, physicalMode);
  if (state === null) throw new Error(`Illegal NMOS instruction form: ${opcode}/${mode}`);
  return Object.freeze({
    opcode,
    mode,
    operand,
    uses: machineState(state.usesRegisters, state.usesFlags),
    defines: machineState(state.definesRegisters, state.definesFlags),
    memory: Object.freeze(memory),
    cost: Object.freeze({
      bytes: form.bytes,
      minCycles: form.minCycles,
      maxCycles: form.maxCycles,
    }),
    source,
  });
}

/** Convert a retained value into an instruction operand at one byte offset. */
export function operandForValue(value: LoweredValue, offset = 0): MachineOperand {
  if (value.kind === "zero-extended") {
    return offset === 0
      ? operandForValue(value.low, 0)
      : Object.freeze({ kind: "immediate", value: 0 });
  }
  if (value.kind === "constant") {
    return Object.freeze({ kind: "immediate", value: (value.value >> (offset * 8)) & 0xff });
  }
  if (value.kind === "storage") {
    return Object.freeze({
      kind: "storage",
      requestId: value.requestId,
      offset: (value.offset ?? 0) + offset,
    });
  }
  if (value.kind === "label") {
    return Object.freeze({
      kind: "label",
      label: value.label,
      offset: (value.offset ?? 0) + offset,
      ...(value.transform === undefined ? {} : { transform: value.transform }),
    });
  }
  if (value.kind === "symbol-address") {
    return Object.freeze({
      kind: "label",
      label: value.label,
      addressByte: offset === 0 ? "low" : "high",
    });
  }
  throw new Error("Machine value has no addressable operand");
}

/** Select the addressing mode implied by a retained value. */
export function modeForValue(
  value: LoweredValue,
  offset = 0,
): "immediate" | "storage" | "zero-page" | "absolute" {
  if (value.kind === "zero-extended") {
    return offset === 0 ? modeForValue(value.low, 0) : "immediate";
  }
  if (value.kind === "constant") return "immediate";
  if (value.kind === "storage") return "storage";
  if (value.kind === "label")
    return value.transform === "vic-sprite-block"
      ? "immediate"
      : value.zeroPage
        ? "zero-page"
        : "absolute";
  if (value.kind === "symbol-address") return "immediate";
  throw new Error("Machine value has no addressable mode");
}

/** Map one semantic terminator to a structured machine terminator. */
export function lowerTerminator(
  terminator: SemanticTerminator,
  values: ReadonlyMap<string, LoweredValue>,
  cpu: CpuFacts,
  returnsToStartup: boolean,
): MachineTerminator {
  if (terminator.kind === "jump") {
    return Object.freeze({
      kind: "jump",
      opcode: "jmp",
      target: terminator.target,
      cost: machineCost(cpu, "jmp", "absolute"),
    });
  }
  if (terminator.kind === "branch") {
    const condition = values.get(terminator.condition);
    const opcode = condition?.kind === "condition" ? condition.whenTrue : "bne";
    const flag = condition?.kind === "condition" ? condition.usesFlag : "z";
    return Object.freeze({
      kind: "branch",
      opcode,
      target: terminator.whenTrue,
      fallthrough: terminator.whenFalse,
      uses: machineState([], [flag]),
      cost: machineCost(cpu, opcode, "relative"),
    });
  }
  if (terminator.kind === "return") {
    if (returnsToStartup) {
      return Object.freeze({
        kind: "jump",
        opcode: "jmp",
        target: "startup.restore",
        cost: machineCost(cpu, "jmp", "absolute"),
      });
    }
    return Object.freeze({
      kind: "return",
      opcode: "rts",
      cost: machineCost(cpu, "rts", "implied"),
    });
  }
  return Object.freeze({ kind: "unreachable" });
}

/** Original selected function identity prevents a certificate from describing another body. */
const BOOLEAN_EXIT_SEAL = Symbol("boolean-exit-facts");

/** Private all-exit contract, never an assumption about the public Boolean calling convention. */
export interface BooleanExitFacts {
  /** Exact immutable selected body, including its context-specific label and final shaping. */
  readonly function: MachineFunction;
  /** Every reachable ordinary RTS covered by this certificate. */
  readonly exits: readonly string[];
  /** Canonical A also owns N=0; removing a reload must not silently change negative flags. */
  readonly negativeClear: true;
  /** Bind the original function identity independently of the public field. */
  readonly [BOOLEAN_EXIT_SEAL]: MachineFunction;
}

/** Only the accumulator and its N/Z relationship are needed for a Boolean exit. */
interface BooleanExitState {
  /** Exact byte when proved; null includes all other byte values. */
  readonly a: number | null;
  /** A join of zero and one remains canonical even when its exact value is unknown. */
  readonly canonical: boolean;
  /** Whether current Z describes the current accumulator's zero test. */
  readonly zeroFromA: boolean;
  /** Whether current N describes the current accumulator's sign bit. */
  readonly negativeFromA: boolean;
}

/** Track supported byte producers; calls and unrelated flag writes discard their own facts. */
function booleanInstructionState(
  before: BooleanExitState,
  instruction: MachineInstruction,
): BooleanExitState {
  const { opcode, operand } = instruction;
  if (opcode === "jsr")
    return { a: null, canonical: false, zeroFromA: false, negativeFromA: false };
  const immediate =
    instruction.mode === "immediate" && operand?.kind === "immediate" ? operand.value : null;
  if (opcode === "lda")
    return {
      a: immediate,
      canonical: immediate === 0 || immediate === 1,
      zeroFromA: true,
      negativeFromA: true,
    };
  if (["and", "ora", "eor"].includes(opcode)) {
    const a =
      before.a === null || immediate === null
        ? null
        : opcode === "and"
          ? before.a & immediate
          : opcode === "ora"
            ? before.a | immediate
            : before.a ^ immediate;
    return { a, canonical: a === 0 || a === 1, zeroFromA: true, negativeFromA: true };
  }
  if ((opcode === "cmp" && immediate === 0) || opcode === "tax" || opcode === "tay")
    return { ...before, zeroFromA: true, negativeFromA: true };
  const changesA = instruction.defines.registers.includes("a");
  return {
    a: changesA ? null : before.a,
    canonical: !changesA && before.canonical,
    zeroFromA: !changesA && !instruction.defines.flags.includes("z") && before.zeroFromA,
    negativeFromA: !changesA && !instruction.defines.flags.includes("n") && before.negativeFromA,
  };
}

/**
 * Prove canonical A=0/1 and agreeing N/Z at every reachable ordinary return.
 * This small, monotone join tracks no memory, stack contents or general value
 * ranges. In particular PLP loses flag agreement until a later byte producer
 * restores it. A zero branch can explain an otherwise empty shared false arm.
 * @param fn Actual selected machine body, after local return and byte shaping.
 * @returns A body-bound private certificate, or null for any unproved exit/transfer.
 */
export function deriveBooleanExitFacts(fn: MachineFunction): BooleanExitFacts | null {
  const first = fn.blocks[0];
  const blocks = new Map(fn.blocks.map((block) => [block.label, block]));
  if (first === undefined || blocks.size !== fn.blocks.length) return null;
  const states = new Map<string, BooleanExitState>();
  const pending: string[] = [];
  const queued = new Set<string>();
  /** Join only facts true on every predecessor; each input loses information finitely. */
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
          };
    if (
      old === undefined ||
      old.a !== joined.a ||
      old.canonical !== joined.canonical ||
      old.zeroFromA !== joined.zeroFromA ||
      old.negativeFromA !== joined.negativeFromA
    ) {
      states.set(label, joined);
      if (!queued.has(label)) {
        queued.add(label);
        pending.push(label);
      }
    }
    return true;
  };
  enqueue(first.label, { a: null, canonical: false, zeroFromA: false, negativeFromA: false });
  const exits = new Map<string, BooleanExitState>();
  for (let index = 0; index < pending.length; index += 1) {
    const label = pending[index]!;
    queued.delete(label);
    const block = blocks.get(label)!;
    let state = states.get(label)!;
    for (const instruction of block.instructions) {
      // An instruction-level jump has no declared successor in this small proof.
      if (
        instruction.opcode === "jmp" ||
        instruction.opcode === "rti" ||
        instruction.opcode === "rts"
      )
        return null;
      state = booleanInstructionState(state, instruction);
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
    // A relaxed branch's opcode is inverted; its jump still names the old taken edge.
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
    [BOOLEAN_EXIT_SEAL]: fn,
  });
}

/** Require the original body, not merely an equal label or a copied public certificate field. */
export function validBooleanExitFacts(facts: BooleanExitFacts, fn: MachineFunction): boolean {
  return facts.function === fn && facts[BOOLEAN_EXIT_SEAL] === fn;
}

/**
 * Omit zero-high comparison work only when independent continuation proofs permit it.
 * SBC sets V while CMP preserves it, so full word flags are the starting point.
 * The proof graph removes every candidate suffix first to avoid self-supported
 * flag ownership. Physical/asynchronous observations remain separate obligations.
 * @param fn Actual selected body before resource binding and final layout.
 * @param runtime Exact source loops and their emitted block associations.
 * @returns The selected body, or null when a source-owned comparison was lost.
 */
export function selectFixedCounterHeaderState(
  fn: MachineFunction,
  runtime: FixedLoopRuntime,
): MachineFunction | null {
  if (runtime.counters.size === 0) return fn;
  const headers = new Map(
    [...runtime.counters.values()].map((counter) => [counter.loop.header.id, counter]),
  );
  const candidate: MachineBlock[] = [];
  const found = new Set<string>();
  for (const block of fn.blocks) {
    const counter = headers.get(block.label);
    if (counter === undefined) {
      candidate.push(block);
      continue;
    }
    found.add(block.label);
    const load = block.instructions.at(-2);
    const subtract = block.instructions.at(-1);
    if (
      load?.opcode !== "lda" ||
      subtract?.opcode !== "sbc" ||
      load.mode !== "immediate" ||
      subtract.mode !== "immediate" ||
      load.operand?.kind !== "immediate" ||
      load.operand.value !== 0 ||
      subtract.operand?.kind !== "immediate" ||
      subtract.operand.value !== 0 ||
      load.source !== counter.loop.comparison.span ||
      subtract.source !== counter.loop.comparison.span
    )
      return null;
    candidate.push(
      Object.freeze({ ...block, instructions: Object.freeze(block.instructions.slice(0, -2)) }),
    );
  }
  if (found.size !== headers.size) return null;
  const byLabel = new Map(candidate.map((block) => [block.label, block]));
  const source = runtime.counterFacts[0]!.function;
  const aggregate = source.result.kind === "array" || source.result.kind === "struct";
  const bytes = aggregate ? 0 : semanticTypeSize(source.result);
  const safe = byteContinuationQuery(byLabel, {
    registers: bytes === 2 ? ["a", "x"] : bytes === 1 ? ["a"] : [],
    flags: bytes === 0 ? [] : ["n"],
  });
  const overflowCandidate = candidate.map((block) => {
    const counter = headers.get(block.label);
    return counter === undefined
      ? block
      : Object.freeze({
          ...block,
          instructions: Object.freeze([
            ...block.instructions,
            machineInstruction(
              runtime.cpu,
              "clv",
              "implied",
              null,
              [],
              counter.loop.comparison.span,
            ),
          ]),
        });
  });
  const safeWithOverflow = byteContinuationQuery(
    new Map(overflowCandidate.map((block) => [block.label, block])),
    {
      registers: bytes === 2 ? ["a", "x"] : bytes === 1 ? ["a"] : [],
      flags: bytes === 0 ? [] : ["n"],
    },
  );
  const sourceBlocks = new Map(
    [...runtime.sourceBlocks].map(([block, labels]) => [block.id, labels]),
  );
  const admitted = new Set<string>();
  const overflowOnly = new Set<string>();
  for (const [label, counter] of headers) {
    const body = [...counter.loop.members]
      .flatMap((id) => sourceBlocks.get(id) ?? [])
      .map((id) => byLabel.get(id));
    const quiet = body.every(
      (block) =>
        block !== undefined &&
        block.instructions.every(
          (instruction) => instruction.opcode !== "jsr" && !instruction.uses.flags.includes("v"),
        ) &&
        !(
          (block.terminator.kind === "branch" || block.terminator.kind === "long-branch") &&
          block.terminator.uses.flags.includes("v")
        ),
    );
    const overflowDead = quiet && safe(counter.loop.exit.id, 0, BYTE_WINDOW_CHANGED.v);
    const changed =
      BYTE_WINDOW_CHANGED.a |
      BYTE_WINDOW_CHANGED.n |
      BYTE_WINDOW_CHANGED.z |
      (overflowDead ? 0 : BYTE_WINDOW_CHANGED.v);
    if (process.env.BLEND65_DEBUG_V === "1" && counter.loop.comparison.span.start === 6929)
      console.error(
        "V",
        runtime.policy,
        label.split(":").slice(-1)[0],
        quiet,
        overflowDead,
        safe(counter.loop.body.id, 0, changed),
        safe(counter.loop.exit.id, 0, changed),
      );
    if (safe(counter.loop.body.id, 0, changed) && safe(counter.loop.exit.id, 0, changed))
      admitted.add(label);
    else if (
      counter.loop.initial.domain.maximum <= counter.loop.bound &&
      safeWithOverflow(counter.loop.body.id, 0, BYTE_WINDOW_CHANGED.a) &&
      safeWithOverflow(counter.loop.exit.id, 0, BYTE_WINDOW_CHANGED.a)
    )
      overflowOnly.add(label);
  }
  return Object.freeze({
    ...fn,
    blocks: Object.freeze(
      fn.blocks.map((block, index) =>
        admitted.has(block.label)
          ? candidate[index]!
          : overflowOnly.has(block.label)
            ? overflowCandidate[index]!
            : block,
      ),
    ),
  });
}
