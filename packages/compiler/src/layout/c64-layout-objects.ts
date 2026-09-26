import type { StorageClosureCertificate } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import type {
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

/** Resolve one layout-owned immediate transform after every asset has a final address. */
export function resolvePlacementTransforms(
  program: MachineProgram,
  intervals: readonly C64LayoutInterval[],
  profile: TargetProfile,
): MachineProgram | null {
  const placed = new Map(intervals.map((interval) => [interval.id, interval] as const));
  const resolveFunction = (fn: MachineFunction): MachineFunction | null => {
    const blocks = fn.blocks.map((block) => {
      const instructions = block.instructions.map((instruction) => {
        const operand = instruction.operand;
        if (operand?.kind !== "label" || operand.transform !== "vic-sprite-block") {
          return instruction;
        }
        const interval = placed.get(operand.label);
        const address = interval === undefined ? -1 : interval.start + (operand.offset ?? 0);
        if (
          interval?.kind !== "asset" ||
          address < profile.machine.vicBankStart ||
          address > profile.machine.vicBankEnd ||
          address % 64 !== 0
        ) {
          return null;
        }
        return Object.freeze({
          ...instruction,
          operand: Object.freeze({
            kind: "immediate" as const,
            value: (address - profile.machine.vicBankStart) / 64,
          }),
        });
      });
      if (instructions.some((instruction) => instruction === null)) return null;
      return Object.freeze({
        ...block,
        instructions: Object.freeze(instructions.filter((instruction) => instruction !== null)),
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
  if (startup === null || functions.some((fn) => fn === null)) return null;
  return Object.freeze({
    ...program,
    startup,
    functions: Object.freeze(functions.filter((fn) => fn !== null)),
  });
}
