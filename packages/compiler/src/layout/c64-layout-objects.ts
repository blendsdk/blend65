import type { SourceSpan } from "../project/types.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import { repairMachineBranches } from "../machine/block-layout.js";
import { vicFieldFailure, vicFieldValue } from "../machine/vic-fields.js";
import type { MachineInstruction } from "../machine/machine-types.js";
import type {
  MachineBlock,
  MachineDataObject,
  MachineFunction,
  MachineProgram,
} from "../machine/machine-types.js";
import type { C64LayoutInterval } from "./c64-layout.js";
import { overlaps } from "./c64-layout-placement.js";

/** Return the selected encoded size of one machine function. */
export function functionBytes(fn: MachineFunction): number | null {
  let bytes = 0;
  for (const block of fn.blocks) {
    for (const instruction of block.instructions) bytes += instruction.cost.bytes;
    const terminator = block.terminator;
    if (terminator.kind === "branch") bytes += 2;
    else if (terminator.kind === "long-branch") bytes += 5;
    else if (terminator.kind === "jump") bytes += 3;
    else if (terminator.kind === "return") bytes += terminator.cost?.bytes ?? 1;
  }
  return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
}

/** Return the selected encoded size of one machine block. */
export function blockBytes(block: MachineFunction["blocks"][number]): number | null {
  return functionBytes(Object.freeze({ id: block.label, blocks: Object.freeze([block]) }));
}

/** Compare stable identities without locale-dependent collation. */
export function compareIds(left: { readonly id: string }, right: { readonly id: string }): number {
  return Buffer.compare(Buffer.from(left.id), Buffer.from(right.id));
}

/** Add one interval only if it is valid and non-overlapping. */
export function addInterval(intervals: C64LayoutInterval[], interval: C64LayoutInterval): boolean {
  if (
    interval.start < 0 ||
    interval.end > 0xffff ||
    interval.end < interval.start ||
    intervals.some((existing) =>
      overlaps(interval.start, interval.end, existing.start, existing.end),
    )
  ) {
    return false;
  }
  intervals.push(Object.freeze(interval));
  return true;
}

/** Return resident bytes for one data object, validating their byte range. */
export function dataBytes(data: MachineDataObject): readonly number[] | null {
  if (data.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 0xff)) {
    return null;
  }
  return Object.freeze([...data.bytes]);
}

/** Validate certified overlays and return their distinct occupied unions. */
export function storageIntervals(
  certificate: StorageClosureCertificate,
): readonly C64LayoutInterval[] | null {
  const homes = [...certificate.homes].sort(
    (left, right) =>
      left.address - right.address || compareIds({ id: left.requestId }, { id: right.requestId }),
  );
  const conflicts = new Set(
    certificate.interference.map(({ left, right }) =>
      left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`,
    ),
  );
  for (let left = 0; left < homes.length; left += 1) {
    const first = homes[left]!;
    if (
      !Number.isInteger(first.address) ||
      !Number.isInteger(first.bytes) ||
      first.bytes < 0 ||
      first.address < 0 ||
      first.address + first.bytes - 1 > 0xffff
    ) {
      return null;
    }
    if (first.bytes === 0) continue;
    for (let right = left + 1; right < homes.length; right += 1) {
      const second = homes[right]!;
      if (second.address > first.address + first.bytes - 1) break;
      if (second.bytes === 0) continue;
      const key =
        first.requestId < second.requestId
          ? `${first.requestId}\u0000${second.requestId}`
          : `${second.requestId}\u0000${first.requestId}`;
      if (conflicts.has(key)) return null;
    }
  }

  const groups: { start: number; end: number; ids: string[] }[] = [];
  for (const home of homes) {
    // A zero-byte object owns an address marker, not a resident byte interval.
    if (home.bytes === 0) continue;
    const end = home.address + home.bytes - 1;
    const last = groups.at(-1);
    if (last !== undefined && home.address <= last.end) {
      last.end = Math.max(last.end, end);
      last.ids.push(home.requestId);
    } else {
      groups.push({ start: home.address, end, ids: [home.requestId] });
    }
  }
  return Object.freeze(
    groups.map(({ start, end, ids }) =>
      Object.freeze({
        id: ids.length === 1 ? ids[0]! : `sfa.overlay:${ids.sort().join("+")}`,
        kind: "sfa" as const,
        start,
        end,
        bytes: null,
      }),
    ),
  );
}

/** Fold one immediate `lda` followed by a constant logical operation. */
function foldConstantImmediateOps(
  instructions: readonly MachineInstruction[],
): readonly MachineInstruction[] {
  const folded: MachineInstruction[] = [];
  for (const instruction of instructions) {
    const previous = folded.at(-1);
    if (
      previous !== undefined &&
      previous.opcode === "lda" &&
      previous.mode === "immediate" &&
      previous.operand?.kind === "immediate" &&
      instruction.mode === "immediate" &&
      instruction.operand?.kind === "immediate" &&
      (instruction.opcode === "ora" || instruction.opcode === "and" || instruction.opcode === "eor")
    ) {
      const left = previous.operand.value;
      const right = instruction.operand.value;
      const value =
        instruction.opcode === "ora"
          ? left | right
          : instruction.opcode === "and"
            ? left & right
            : left ^ right;
      folded[folded.length - 1] = Object.freeze({
        ...previous,
        operand: Object.freeze({ kind: "immediate" as const, value: value & 0xff }),
      });
      // Keep the logical instruction with its identity operand. Removing it
      // would shorten the block after sizing and leave executable zero fill at
      // the next fallthrough target. The size-neutral identity form preserves
      // the folded value while a dedicated sizing pass owns the real byte win.
      const identity = instruction.opcode === "and" ? 0xff : 0;
      folded.push(
        Object.freeze({
          ...instruction,
          operand: Object.freeze({ kind: "immediate" as const, value: identity }),
          foldedIdentity: true as const,
        }),
      );
      continue;
    }
    folded.push(instruction);
  }
  return Object.freeze(folded);
}

/** Detailed placement-transform outcome with the exact failing source and contributors. */
export type PlacementTransformResult =
  | { readonly kind: "complete"; readonly program: MachineProgram }
  | {
      readonly kind: "error";
      readonly message: string;
      readonly source: SourceSpan | null;
      readonly contributors: readonly string[];
    };

/** Resolve one layout-owned immediate transform after every asset has a final address. */
export function resolvePlacementTransforms(
  program: MachineProgram,
  intervals: readonly C64LayoutInterval[],
  profile: TargetProfile,
): PlacementTransformResult {
  const placed = new Map(intervals.map((interval) => [interval.id, interval] as const));
  let failure: Extract<PlacementTransformResult, { kind: "error" }> | null = null;
  const fail = (
    instruction: MachineInstruction,
    message: string,
    contributors: readonly string[],
  ): null => {
    failure ??= Object.freeze({
      kind: "error" as const,
      message,
      source: instruction.source,
      contributors: Object.freeze([...contributors]),
    });
    return null;
  };
  const screenLabels = new Set<string>();
  for (const fn of [program.startup, ...program.functions]) {
    for (const block of fn.blocks) {
      for (const instruction of block.instructions) {
        const operand = instruction.operand;
        if (operand?.kind === "label" && operand.transform === "vic-screen-select") {
          screenLabels.add(operand.label);
        }
      }
    }
  }
  const activeScreenLabel = screenLabels.size === 1 ? [...screenLabels][0]! : null;
  const resolveEffect = (
    effect: MachineInstruction["memory"][number],
    instruction: MachineInstruction,
  ) => {
    if (effect.address.kind !== "symbolic" || effect.address.label !== activeScreenLabel) {
      return effect;
    }
    const interval = placed.get(effect.address.label);
    if (interval === undefined || interval.kind !== "asset") {
      return fail(
        instruction,
        `VIC pointer table '${effect.address.label}' has no placed screen asset`,
        [`label=${effect.address.label}`, "field=sprite-pointer-table"],
      );
    }
    return Object.freeze({
      ...effect,
      address: Object.freeze({
        kind: "absolute" as const,
        value: interval.start + (effect.address.offset ?? 0),
      }),
    });
  };
  const resolveFunction = (fn: MachineFunction): MachineFunction | null => {
    const blocks = fn.blocks.map((block) => {
      const instructions = block.instructions.map((instruction) => {
        const operand = instruction.operand;
        if (operand?.kind === "label" && operand.addressTransform === "sprite-pointer-table") {
          if (activeScreenLabel === null) {
            return fail(
              instruction,
              "Sprite pointer table requires exactly one active VIC screen selected by 'vicScreenSelect'",
              ["field=sprite-pointer-table", "c64.vic.vicScreenSelect"],
            );
          }
          const interval = placed.get(activeScreenLabel);
          if (interval === undefined || interval.kind !== "asset") {
            return fail(
              instruction,
              `Active screen '${activeScreenLabel}' has no placed VIC asset`,
              [`label=${activeScreenLabel}`, "field=sprite-pointer-table"],
            );
          }
          const address = interval.start + (operand.offset ?? 0);
          if (address < 0 || address > 0xffff) {
            return fail(
              instruction,
              `Sprite pointer table address $${address.toString(16)} is outside cpu16`,
              [`label=${activeScreenLabel}`, "field=sprite-pointer-table"],
            );
          }
          const memory = instruction.memory.map((effect) => resolveEffect(effect, instruction));
          if (memory.some((effect) => effect === null)) return null;
          return Object.freeze({
            ...instruction,
            operand: Object.freeze({ kind: "absolute" as const, value: address }),
            memory: Object.freeze(
              memory.filter((effect): effect is NonNullable<typeof effect> => effect !== null),
            ),
          });
        }
        if (operand?.kind !== "label" || operand.transform === undefined) {
          const memory = instruction.memory.map((effect) => resolveEffect(effect, instruction));
          if (memory.some((effect) => effect === null)) return null;
          return Object.freeze({
            ...instruction,
            memory: Object.freeze(
              memory.filter((effect): effect is NonNullable<typeof effect> => effect !== null),
            ),
          });
        }
        const interval = placed.get(operand.label);
        const address = interval === undefined ? -1 : interval.start + (operand.offset ?? 0);
        if (interval?.kind !== "asset") {
          return fail(
            instruction,
            `VIC field '${operand.transform}' requires a VIC-visible asset; '${operand.label}' is not a placed asset`,
            [
              `field=${operand.transform}`,
              `label=${operand.label}`,
              `interval=${interval?.kind ?? "missing"}`,
            ],
          );
        }
        const fieldFailure = vicFieldFailure(
          operand.transform,
          address,
          profile.machine.vicBankStart,
          profile.machine.characterRomStart,
          profile.machine.characterRomEnd,
        );
        if (fieldFailure !== null) {
          return fail(instruction, fieldFailure.message, [
            `field=${operand.transform}`,
            `label=${operand.label}`,
            `address=$${address.toString(16).padStart(4, "0")}`,
            `reason=${fieldFailure.reason}`,
            `vic-bank=$${profile.machine.vicBankStart.toString(16)}-$${(profile.machine.vicBankStart + 0x3fff).toString(16)}`,
            `character-rom=$${profile.machine.characterRomStart.toString(16)}-$${profile.machine.characterRomEnd.toString(16)}`,
          ]);
        }
        const value = vicFieldValue(
          operand.transform,
          address,
          profile.machine.vicBankStart,
          profile.machine.characterRomStart,
          profile.machine.characterRomEnd,
        );
        if (value === null) {
          return fail(instruction, `VIC field '${operand.transform}' cannot be derived`, [
            `field=${operand.transform}`,
            `label=${operand.label}`,
          ]);
        }
        const memory = instruction.memory.map((effect) => resolveEffect(effect, instruction));
        if (memory.some((effect) => effect === null)) return null;
        return Object.freeze({
          ...instruction,
          operand: Object.freeze({ kind: "immediate" as const, value }),
          foldedVicField: true as const,
          memory: Object.freeze(
            memory.filter((effect): effect is NonNullable<typeof effect> => effect !== null),
          ),
        });
      });
      if (instructions.some((instruction) => instruction === null)) return null;
      return Object.freeze({
        ...block,
        instructions: foldConstantImmediateOps(
          instructions.filter(
            (instruction): instruction is MachineInstruction => instruction !== null,
          ),
        ),
      });
    });
    if (blocks.some((block) => block === null)) return null;
    return Object.freeze({
      ...fn,
      blocks: Object.freeze(blocks.filter((block) => block !== null)),
    });
  };
  const startup = resolveFunction(program.startup);
  const functions = program.functions.map(resolveFunction);
  if (startup === null || functions.some((fn) => fn === null)) {
    return (
      failure ?? {
        kind: "error",
        message: "Placement transform could not be resolved",
        source: null,
        contributors: [],
      }
    );
  }
  return Object.freeze({
    kind: "complete" as const,
    program: Object.freeze({
      ...program,
      startup,
      functions: Object.freeze(functions.filter((fn) => fn !== null)),
    }),
  });
}

/**
 * Remove post-layout identity operands from ordinary functions and repair their
 * branch forms at the existing origins.
 *
 * The startup path keeps its identity form because its contiguous entry and
 * fallthrough relation is not moved by this residual slice. A function whose
 * repaired form would grow keeps the original identity form so a valid program
 * is never rejected for a two-byte code-payload win.
 */
export function compactFoldedFunctions(program: MachineProgram): MachineProgram {
  const foldArithmetic = (blocks: readonly MachineBlock[]): readonly MachineBlock[] => {
    const byLabel = new Map(blocks.map((block) => [block.label, block] as const));
    const memo = new Map<string, boolean>();
    const visiting = new Set<string>();
    const flagsSafe = (label: string, index: number): boolean => {
      const key = `${label}\0${index}`;
      const cached = memo.get(key);
      if (cached !== undefined) return cached;
      if (visiting.has(key)) return false;
      visiting.add(key);
      const block = byLabel.get(label);
      if (block === undefined) return true;
      let safe = true;
      for (let cursor = index; cursor < block.instructions.length; cursor += 1) {
        const instruction = block.instructions[cursor]!;
        if (instruction.uses.flags.some((flag) => flag === "c" || flag === "v")) {
          safe = false;
          break;
        }
        if (
          instruction.opcode === "jsr" ||
          instruction.defines.flags.some((flag) => flag === "c" || flag === "v")
        ) {
          safe = true;
          break;
        }
      }
      if (safe) {
        const terminal = block.terminator;
        if (terminal.kind === "branch" || terminal.kind === "long-branch") {
          const target = terminal.kind === "branch" ? terminal.target : terminal.jump.target;
          safe =
            !terminal.uses.flags.some((flag) => flag === "c" || flag === "v") &&
            flagsSafe(target, 0) &&
            flagsSafe(terminal.fallthrough, 0);
        } else if (terminal.kind === "jump") {
          safe = flagsSafe(terminal.target, 0);
        }
      }
      visiting.delete(key);
      memo.set(key, safe);
      return safe;
    };
    return blocks.map((block) => {
      const instructions: MachineInstruction[] = [];
      const source = block.instructions;
      for (let index = 0; index < source.length; index += 1) {
        const first = source[index]!;
        if (
          first.opcode === "lda" &&
          first.mode === "immediate" &&
          first.operand?.kind === "immediate" &&
          first.foldedVicField === true
        ) {
          const second = source[index + 1];
          const third = source[index + 2];
          const left = first.operand.value;
          let folded: number | undefined;
          let consumed = 0;
          if (
            second?.opcode === "clc" &&
            third?.opcode === "adc" &&
            third.mode === "immediate" &&
            third.operand?.kind === "immediate"
          ) {
            folded = (left + third.operand.value) & 0xff;
            consumed = 2;
          } else if (
            second?.opcode === "sec" &&
            third?.opcode === "sbc" &&
            third.mode === "immediate" &&
            third.operand?.kind === "immediate"
          ) {
            folded = (left - third.operand.value) & 0xff;
            consumed = 2;
          } else if (second?.opcode === "asl" && second.mode === "accumulator") {
            folded = (left << 1) & 0xff;
            consumed = 1;
          } else if (second?.opcode === "lsr" && second.mode === "accumulator") {
            folded = (left >> 1) & 0xff;
            consumed = 1;
          }
          if (folded !== undefined && flagsSafe(block.label, index + consumed + 1)) {
            instructions.push(
              Object.freeze({
                ...first,
                operand: Object.freeze({ kind: "immediate" as const, value: folded }),
              }),
            );
            index += consumed;
            continue;
          }
        }
        instructions.push(first);
      }
      return Object.freeze({ ...block, instructions: Object.freeze(instructions) });
    });
  };
  const compact = (fn: MachineFunction): MachineFunction => {
    if (
      fn.origin === undefined ||
      !fn.blocks.some((block) =>
        block.instructions.some(
          (instruction) =>
            instruction.foldedIdentity === true || instruction.foldedVicField === true,
        ),
      )
    ) {
      return fn;
    }
    const stripped = fn.blocks.map((block) =>
      Object.freeze({
        ...block,
        instructions: Object.freeze(
          block.instructions.filter((instruction) => instruction.foldedIdentity !== true),
        ),
      }),
    );
    const blocks = foldArithmetic(stripped);
    const repaired = repairMachineBranches(Object.freeze({ ...fn, blocks }), fn.origin);
    if (repaired.kind === "error") return fn;
    const original = functionBytes(fn);
    if (original === null || repaired.byteLength > original) return fn;
    return repaired.function;
  };
  return Object.freeze({
    ...program,
    functions: Object.freeze(program.functions.map(compact)),
  });
}

/**
 * Partition one bounded address window into free ranges around occupied intervals.
 *
 * Ranges outside the window are ignored and ranges crossing a boundary are
 * clipped to it. Overlapping or unsorted input still yields a deterministic
 * partition because clipped ranges are sorted before merging.
 */
export function freeIntervalsInWindow(
  start: number,
  end: number,
  occupied: readonly { readonly start: number; readonly end: number }[],
): readonly { readonly start: number; readonly end: number; readonly size: number }[] {
  const inside = occupied
    .filter((range) => range.start < end && range.end >= start)
    .map((range) => ({
      start: Math.max(start, range.start),
      end: Math.min(end, range.end) + 1,
    }))
    .sort((left, right) => left.start - right.start);
  const free: { start: number; end: number; size: number }[] = [];
  let cursor = start;
  for (const range of inside) {
    if (cursor < range.start) {
      free.push({ start: cursor, end: range.start, size: range.start - cursor });
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < end) free.push({ start: cursor, end, size: end - cursor });
  return Object.freeze(free.map((range) => Object.freeze(range)));
}
