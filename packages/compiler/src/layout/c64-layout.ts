import type { StorageClosureCertificate } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import { repairMachineBranches } from "../machine/block-layout.js";
import { validateMachineProgram } from "../machine/bind.js";
import type {
  MachineDataObject,
  MachineFunction,
  MachineProgram,
} from "../machine/machine-types.js";
import { C64_STARTUP_STATE_ID, createC64StartupStateData } from "./startup.js";

/** One inclusive placed interval in the selected C64 memory map. */
export interface C64LayoutInterval {
  /** Stable source or compiler-owned identity. */
  readonly id: string;
  /** Placement ownership class. */
  readonly kind: "stub" | "code" | "immutable" | "global" | "bss" | "asset" | "sfa" | "fill";
  /** Inclusive first address. */
  readonly start: number;
  /** Inclusive last address. */
  readonly end: number;
  /** Loaded bytes, or null for storage reserved without PRG bytes. */
  readonly bytes: readonly number[] | null;
}

/** Inputs to deterministic final C64 layout. */
export interface C64LayoutInput {
  /** Bound structured machine program. */
  readonly program: MachineProgram;
  /** Final storage closure proof. */
  readonly certificate: StorageClosureCertificate;
  /** Exact selected C64 profile. */
  readonly profile: TargetProfile;
}

/** Conflict-free selected layout or a terminal resource error without partial output. */
export type C64LayoutResult =
  | {
      readonly kind: "complete";
      readonly intervals: readonly C64LayoutInterval[];
      readonly spriteBlocks: readonly number[];
      readonly loadRange: { readonly start: number; readonly end: number };
      readonly program: MachineProgram;
    }
  | { readonly kind: "error"; readonly reason: string; readonly objectId: string | null };

/** Round one address upward to a power-of-two boundary. */
function align(address: number, alignment: number): number {
  return Math.ceil(address / alignment) * alignment;
}

/** Return the selected encoded size of one machine function. */
function functionBytes(fn: MachineFunction): number | null {
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
function blockBytes(block: MachineFunction["blocks"][number]): number | null {
  return functionBytes(Object.freeze({ id: block.label, blocks: Object.freeze([block]) }));
}

/** Check overlap of two inclusive intervals. */
function overlaps(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

/** Compare stable identities without locale-dependent collation. */
function compareIds(left: { readonly id: string }, right: { readonly id: string }): number {
  return Buffer.compare(Buffer.from(left.id), Buffer.from(right.id));
}

/** Add one interval only if it is valid and non-overlapping. */
function addInterval(intervals: C64LayoutInterval[], interval: C64LayoutInterval): boolean {
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
function dataBytes(data: MachineDataObject): readonly number[] | null {
  if (data.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 0xff)) {
    return null;
  }
  return Object.freeze([...data.bytes]);
}

/** Validate certified overlays and return their distinct occupied unions. */
function storageIntervals(
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
      first.bytes <= 0 ||
      first.address < 0 ||
      first.address + first.bytes - 1 > 0xffff
    ) {
      return null;
    }
    for (let right = left + 1; right < homes.length; right += 1) {
      const second = homes[right]!;
      if (second.address > first.address + first.bytes - 1) break;
      const key =
        first.requestId < second.requestId
          ? `${first.requestId}\u0000${second.requestId}`
          : `${second.requestId}\u0000${first.requestId}`;
      if (conflicts.has(key)) return null;
    }
  }

  const groups: { start: number; end: number; ids: string[] }[] = [];
  for (const home of homes) {
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
function resolvePlacementTransforms(
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

/**
 * Place startup/code, data, final SFA homes and VIC-visible sprite data deterministically.
 * @param input Bound program, final certificate and exact selected profile.
 * @returns One conflict-free layout with explicit loaded fill.
 */
export function layoutC64Program(input: C64LayoutInput): C64LayoutResult {
  if (
    input.profile.id !== "c64-pal-prg-kernal-6581" ||
    !input.certificate.closed ||
    input.certificate.profileId !== input.profile.id
  ) {
    return Object.freeze({ kind: "error", reason: "profile-or-certificate", objectId: null });
  }
  const intervals: C64LayoutInterval[] = [];
  const stubBytes = Object.freeze([
    0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00,
  ]);
  addInterval(intervals, {
    id: "basic.stub",
    kind: "stub",
    start: 0x0801,
    end: 0x080c,
    bytes: stubBytes,
  });

  const startupEntry = input.program.startup.blocks.find(({ label }) => label === "startup.entry");
  const startupRestore = input.program.startup.blocks.find(
    ({ label }) => label === "startup.restore",
  );
  const entryBytes = startupEntry === undefined ? null : blockBytes(startupEntry);
  const restoreBytes = startupRestore === undefined ? null : blockBytes(startupRestore);
  if (
    entryBytes === null ||
    restoreBytes === null ||
    startupEntry === undefined ||
    startupRestore === undefined
  ) {
    return Object.freeze({ kind: "error", reason: "invalid-code-size", objectId: null });
  }
  const mainTarget =
    startupEntry.terminator.kind === "fallthrough" ? startupEntry.terminator.target : null;
  const orderedFunctions = [...input.program.functions].sort((left, right) => {
    if (left.id === mainTarget) return -1;
    if (right.id === mainTarget) return 1;
    return 0;
  });
  let codeCursor = input.profile.packager.startupAddress + entryBytes;
  const repairedFunctions: MachineFunction[] = [];
  for (const fn of orderedFunctions) {
    const repaired = repairMachineBranches(fn, codeCursor);
    if (repaired.kind === "error") {
      return Object.freeze({ kind: "error", reason: "branch-layout", objectId: fn.id });
    }
    repairedFunctions.push(repaired.function);
    codeCursor += repaired.byteLength;
  }
  const placedRestore = Object.freeze({ ...startupRestore, origin: codeCursor });
  const placedStartup = Object.freeze({
    ...input.program.startup,
    origin: input.profile.packager.startupAddress,
    blocks: Object.freeze([
      Object.freeze({ ...startupEntry, origin: input.profile.packager.startupAddress }),
      placedRestore,
    ]),
  });
  codeCursor += restoreBytes;
  const expectedStartupState = createC64StartupStateData();
  const suppliedStartupState = input.program.data.find(({ id }) => id === C64_STARTUP_STATE_ID);
  if (
    suppliedStartupState !== undefined &&
    (suppliedStartupState.kind !== expectedStartupState.kind ||
      suppliedStartupState.alignment !== expectedStartupState.alignment ||
      suppliedStartupState.bytes.length !== expectedStartupState.bytes.length ||
      suppliedStartupState.bytes.some((byte) => byte !== 0))
  ) {
    return Object.freeze({
      kind: "error",
      reason: "invalid-data",
      objectId: C64_STARTUP_STATE_ID,
    });
  }
  const laidOutProgram: MachineProgram = Object.freeze({
    ...input.program,
    startup: placedStartup,
    functions: Object.freeze(repairedFunctions),
    data:
      suppliedStartupState === undefined
        ? Object.freeze([...input.program.data, expectedStartupState])
        : input.program.data,
  });
  const codeBytes = codeCursor - input.profile.packager.startupAddress;
  if (codeBytes > 0) {
    if (
      !addInterval(intervals, {
        id: "program.code",
        kind: "code",
        start: input.profile.packager.startupAddress,
        end: input.profile.packager.startupAddress + codeBytes - 1,
        bytes: Object.freeze(new Array<number>(codeBytes).fill(0)),
      })
    ) {
      return Object.freeze({ kind: "error", reason: "code-conflict", objectId: "program.code" });
    }
  }

  const sfaIntervals = storageIntervals(input.certificate);
  if (sfaIntervals === null) {
    return Object.freeze({ kind: "error", reason: "sfa-conflict", objectId: null });
  }
  for (const interval of sfaIntervals) {
    if (!addInterval(intervals, interval)) {
      return Object.freeze({ kind: "error", reason: "sfa-conflict", objectId: interval.id });
    }
  }

  const nonAssets = laidOutProgram.data.filter(({ kind }) => kind !== "asset").sort(compareIds);
  let cursor = Math.max(
    input.profile.packager.startupAddress,
    ...intervals.filter(({ bytes }) => bytes !== null).map(({ end }) => end + 1),
  );
  for (const data of nonAssets) {
    const bytes = dataBytes(data);
    if (
      bytes === null ||
      !Number.isInteger(data.alignment) ||
      data.alignment <= 0 ||
      (data.alignment & (data.alignment - 1)) !== 0
    ) {
      return Object.freeze({ kind: "error", reason: "invalid-data", objectId: data.id });
    }
    const start = align(cursor, data.alignment);
    if (start > cursor) {
      const fillBytes = Object.freeze(new Array<number>(start - cursor).fill(0));
      addInterval(intervals, {
        id: `fill.${cursor.toString(16)}`,
        kind: "fill",
        start: cursor,
        end: start - 1,
        bytes: fillBytes,
      });
    }
    if (
      bytes.length > 0 &&
      !addInterval(intervals, {
        id: data.id,
        kind: data.kind,
        start,
        end: start + bytes.length - 1,
        bytes,
      })
    ) {
      return Object.freeze({ kind: "error", reason: "data-conflict", objectId: data.id });
    }
    cursor = start + bytes.length;
  }

  const spriteBlocks: number[] = [];
  const assets = laidOutProgram.data.filter(({ kind }) => kind === "asset").sort(compareIds);
  for (const asset of assets) {
    const bytes = dataBytes(asset);
    if (bytes === null || bytes.length === 0 || bytes.length % 64 !== 0) {
      return Object.freeze({ kind: "error", reason: "invalid-asset", objectId: asset.id });
    }
    let start = align(Math.max(cursor, input.profile.machine.spriteStart), 64);
    while (
      overlaps(
        start,
        start + bytes.length - 1,
        input.profile.machine.characterRomStart,
        input.profile.machine.characterRomEnd,
      ) ||
      overlaps(
        start,
        start + bytes.length - 1,
        input.profile.machine.screenAddress,
        input.profile.machine.screenEnd,
      ) ||
      intervals.some((interval) =>
        overlaps(start, start + bytes.length - 1, interval.start, interval.end),
      )
    ) {
      start = align(start + 64, 64);
    }
    const end = start + bytes.length - 1;
    if (start < input.profile.machine.vicBankStart || end > input.profile.machine.vicBankEnd) {
      return Object.freeze({ kind: "error", reason: "vic-visibility", objectId: asset.id });
    }
    if (start > cursor) {
      const fillBytes = Object.freeze(new Array<number>(start - cursor).fill(0));
      if (
        !addInterval(intervals, {
          id: `fill.${cursor.toString(16)}`,
          kind: "fill",
          start: cursor,
          end: start - 1,
          bytes: fillBytes,
        })
      ) {
        return Object.freeze({ kind: "error", reason: "fill-conflict", objectId: asset.id });
      }
    }
    if (
      !addInterval(intervals, {
        id: asset.id,
        kind: "asset",
        start,
        end,
        bytes,
      })
    ) {
      return Object.freeze({ kind: "error", reason: "asset-conflict", objectId: asset.id });
    }
    for (let offset = 0; offset < bytes.length; offset += 64) {
      spriteBlocks.push((start - input.profile.machine.vicBankStart + offset) / 64);
    }
    cursor = end + 1;
  }

  const ordered = Object.freeze(
    [...intervals].sort((left, right) => left.start - right.start || compareIds(left, right)),
  );
  const loaded = ordered.filter(({ bytes }) => bytes !== null);
  if (loaded.length === 0) {
    return Object.freeze({ kind: "error", reason: "empty-layout", objectId: null });
  }
  if (
    loaded.some(
      ({ start, end }) =>
        start < input.profile.packager.residentStart || end > input.profile.packager.residentEnd,
    )
  ) {
    return Object.freeze({ kind: "error", reason: "resident-range", objectId: null });
  }
  const resolvedProgram = resolvePlacementTransforms(laidOutProgram, ordered, input.profile);
  if (resolvedProgram === null) {
    return Object.freeze({ kind: "error", reason: "placement-transform", objectId: null });
  }
  if (
    resolvedProgram.storageInventoryHash !== undefined &&
    !validateMachineProgram(resolvedProgram)
  ) {
    return Object.freeze({ kind: "error", reason: "placement-transform", objectId: null });
  }
  return Object.freeze({
    kind: "complete",
    intervals: ordered,
    spriteBlocks: Object.freeze(spriteBlocks),
    loadRange: Object.freeze({ start: loaded[0]!.start, end: loaded.at(-1)!.end }),
    program: resolvedProgram,
  });
}
