import type { SourceSpan } from "../project/types.js";
import type { VicFieldTransform } from "./vic-fields.js";
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
      readonly transform?: VicFieldTransform;
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
       * Only the volatile raw-memory read or write that owns this value may
       * consume it: it emits the native `absolute,X` form. Every other consumer
       * fails loudly in `modeForValue`, so this value can never be mistaken for
       * the computed sum.
       */
      readonly kind: "ordinal-address";
      readonly base: number;
      readonly index: LoweredValue;
      readonly bytes: number;
      readonly signed: boolean;
    }
  | {
      /** A statically resolved source place consumed directly by one raw access. */
      readonly kind: "static-address";
      readonly requestId?: string;
      readonly label?: string;
      readonly offset: number;
      readonly bytes: number;
      readonly signed: boolean;
      /** Source-owned zero-page data has a proved one-byte physical address. */
      readonly zeroPage?: boolean;
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
  if (value.kind === "static-address") {
    if (value.requestId !== undefined) {
      return Object.freeze({
        kind: "storage",
        requestId: value.requestId,
        offset: value.offset + offset,
      });
    }
    if (value.label !== undefined) {
      return Object.freeze({
        kind: "label",
        label: value.label,
        offset: value.offset + offset,
      });
    }
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
    return value.transform !== undefined ? "immediate" : value.zeroPage ? "zero-page" : "absolute";
  if (value.kind === "symbol-address") return "immediate";
  if (value.kind === "static-address")
    return value.requestId !== undefined ? "storage" : "absolute";
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

export {
  deriveBooleanExitFacts,
  deriveBooleanExitGraph,
  validBooleanExitFacts,
} from "./boolean-exit-facts.js";
export type { BooleanExitFacts, BooleanExitContext } from "./boolean-exit-facts.js";

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
