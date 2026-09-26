import type { StorageClosureCertificate } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import { repairMachineBranches } from "../machine/block-layout.js";
import { validateMachineProgram } from "../machine/bind.js";
import type { MachineFunction, MachineProgram } from "../machine/machine-types.js";
import {
  align,
  freeSourceStart,
  overlaps,
  satisfiesSourcePlacement,
  sourceDataStart,
} from "./c64-layout-placement.js";
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
  /** Draft only: leave RAM function homes out while deriving their trailing free ranges. */
  readonly draftFunctionStorage?: boolean;
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

import {
  functionBytes,
  blockBytes,
  compareIds,
  addInterval,
  dataBytes,
  storageIntervals,
  resolvePlacementTransforms,
} from "./c64-layout-objects.js";

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

  const sourceEntry = input.program.startup.blocks.find(({ label }) => label === "startup.entry");
  const startupRestore = input.program.startup.blocks.find(
    ({ label }) => label === "startup.restore",
  );
  const sourceEntryBytes = sourceEntry === undefined ? null : blockBytes(sourceEntry);
  const restoreBytes = startupRestore === undefined ? null : blockBytes(startupRestore);
  if (
    sourceEntryBytes === null ||
    restoreBytes === null ||
    sourceEntry === undefined ||
    startupRestore === undefined
  ) {
    return Object.freeze({ kind: "error", reason: "invalid-code-size", objectId: null });
  }
  const mainTarget =
    sourceEntry.terminator.kind === "fallthrough" ? sourceEntry.terminator.target : null;
  const mainFunction = input.program.functions.find(({ id }) => id === mainTarget);
  const mainBytes = mainFunction === undefined ? null : functionBytes(mainFunction);
  const entryEnd = input.profile.packager.startupAddress + sourceEntryBytes;
  const entryMain =
    mainFunction === undefined ? null : repairMachineBranches(mainFunction, entryEnd);
  const sfaIntervals = storageIntervals(
    input.draftFunctionStorage
      ? {
          ...input.certificate,
          homes: input.certificate.homes.filter(({ region }) => region === "zero-page"),
        }
      : input.certificate,
  );
  if (sfaIntervals === null) {
    return Object.freeze({ kind: "error", reason: "sfa-conflict", objectId: null });
  }
  const fixedData = input.program.data
    .filter(({ zeropage, placement }) => !zeropage && placement?.at != null)
    .map(({ id, bytes, placement }) => ({
      id,
      start: placement!.at!,
      end: placement!.at! + bytes.length - 1,
    }));
  const fixedFunctions = new Map<
    string,
    Extract<ReturnType<typeof repairMachineBranches>, { kind: "complete" }>
  >();
  for (const fn of input.program.functions) {
    if (fn.placement?.at == null) continue;
    const repaired = repairMachineBranches(fn, fn.placement.at);
    if (repaired.kind === "error") {
      return Object.freeze({ kind: "error", reason: "branch-layout", objectId: fn.id });
    }
    fixedFunctions.set(fn.id, repaired);
  }
  const fixedCode = [...fixedFunctions].map(([id, repaired]) => ({
    id,
    start: repaired.function.origin!,
    end: repaired.function.origin! + repaired.byteLength - 1,
  }));
  const mainAtEntry =
    mainFunction !== undefined &&
    mainBytes !== null &&
    entryMain?.kind === "complete" &&
    sourceDataStart(entryEnd, mainBytes, 1, mainFunction.placement) === entryEnd &&
    ![...fixedData, ...fixedCode.filter(({ id }) => id !== mainTarget)].some((interval) =>
      overlaps(entryEnd, entryEnd + entryMain.byteLength - 1, interval.start, interval.end),
    );
  const needsMainJump = mainTarget !== null && mainFunction !== undefined && !mainAtEntry;
  const startupEntry = needsMainJump
    ? Object.freeze({
        ...sourceEntry,
        terminator: Object.freeze({
          kind: "jump" as const,
          opcode: "jmp" as const,
          target: mainTarget!,
          cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
        }),
      })
    : sourceEntry;
  const entryBytes = blockBytes(startupEntry);
  if (entryBytes === null) {
    return Object.freeze({ kind: "error", reason: "invalid-code-size", objectId: null });
  }
  const orderedFunctions = [...input.program.functions].sort((left, right) => {
    if (left.id === mainTarget) return -1;
    if (right.id === mainTarget) return 1;
    return 0;
  });
  const codePieces: { start: number; end: number }[] = [
    {
      start: input.profile.packager.startupAddress,
      end: input.profile.packager.startupAddress + entryBytes - 1,
    },
  ];
  const fixedReservations = [...fixedData, ...fixedCode, ...sfaIntervals];
  const repairedById = new Map<string, MachineFunction>();
  for (const fn of orderedFunctions) {
    const fixed = fixedFunctions.get(fn.id);
    if (fixed === undefined) continue;
    const origin = fixed.function.origin!;
    if (
      !satisfiesSourcePlacement(origin, fixed.byteLength, fn.placement, input.profile) ||
      [...codePieces, ...fixedReservations.filter(({ id }) => id !== fn.id)].some((interval) =>
        overlaps(origin, origin + fixed.byteLength - 1, interval.start, interval.end),
      )
    )
      return Object.freeze({ kind: "error", reason: "source-placement", objectId: fn.id });
    codePieces.push({ start: origin, end: origin + fixed.byteLength - 1 });
    repairedById.set(fn.id, fixed.function);
  }
  for (const fn of orderedFunctions) {
    if (repairedById.has(fn.id)) continue;
    const estimate = repairMachineBranches(fn, entryEnd);
    if (estimate.kind === "error") {
      return Object.freeze({ kind: "error", reason: "branch-layout", objectId: fn.id });
    }
    const origin = freeSourceStart(
      input.profile.packager.startupAddress + entryBytes,
      estimate.byteLength,
      1,
      fn.placement,
      [...codePieces, ...fixedReservations],
      input.profile,
    );
    if (origin === null || (fn.id === mainTarget && !needsMainJump && origin !== entryEnd)) {
      return Object.freeze({ kind: "error", reason: "source-placement", objectId: fn.id });
    }
    const repaired = repairMachineBranches(fn, origin);
    if (repaired.kind === "error" || repaired.byteLength !== estimate.byteLength)
      return Object.freeze({ kind: "error", reason: "branch-layout", objectId: fn.id });
    codePieces.push({ start: origin, end: origin + repaired.byteLength - 1 });
    repairedById.set(fn.id, repaired.function);
  }
  const restoreOrigin = freeSourceStart(
    input.profile.packager.startupAddress + entryBytes,
    restoreBytes,
    1,
    undefined,
    [...codePieces, ...fixedReservations],
    input.profile,
  );
  if (restoreOrigin === null) {
    return Object.freeze({ kind: "error", reason: "code-conflict", objectId: "startup.restore" });
  }
  codePieces.push({ start: restoreOrigin, end: restoreOrigin + restoreBytes - 1 });
  const repairedFunctions = orderedFunctions.map((fn) => repairedById.get(fn.id)!);
  const placedRestore = Object.freeze({ ...startupRestore, origin: restoreOrigin });
  const placedStartup = Object.freeze({
    ...input.program.startup,
    origin: input.profile.packager.startupAddress,
    blocks: Object.freeze([
      Object.freeze({ ...startupEntry, origin: input.profile.packager.startupAddress }),
      placedRestore,
    ]),
  });
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
  const codeGroups: { start: number; end: number }[] = [];
  for (const piece of codePieces.sort((left, right) => left.start - right.start)) {
    const last = codeGroups.at(-1);
    if (last !== undefined && piece.start === last.end + 1) last.end = piece.end;
    else codeGroups.push({ ...piece });
  }
  for (const [index, group] of codeGroups.entries()) {
    const id = index === 0 ? "program.code" : `program.code.${index}`;
    if (
      !addInterval(intervals, {
        id,
        kind: "code",
        start: group.start,
        end: group.end,
        bytes: Object.freeze(new Array<number>(group.end - group.start + 1).fill(0)),
      })
    )
      return Object.freeze({ kind: "error", reason: "code-conflict", objectId: id });
  }
  for (const interval of sfaIntervals) {
    if (!addInterval(intervals, interval)) {
      return Object.freeze({ kind: "error", reason: "sfa-conflict", objectId: interval.id });
    }
  }

  const zeroPageData = laidOutProgram.data.filter(({ zeropage }) => zeropage).sort(compareIds);
  for (const data of zeroPageData) {
    const bytes = dataBytes(data);
    if (
      data.kind !== "bss" ||
      bytes === null ||
      bytes.length === 0 ||
      bytes.some((byte) => byte !== 0)
    ) {
      return Object.freeze({ kind: "error", reason: "source-placement", objectId: data.id });
    }
    let placed = false;
    for (const region of input.profile.storage.zeroPage) {
      let start = sourceDataStart(region.start, bytes.length, data.alignment, data.placement);
      while (start !== null && start + bytes.length - 1 <= region.end) {
        if (start < region.start) break;
        const end = start + bytes.length - 1;
        const crossing = intervals.find((interval) =>
          overlaps(start!, end, interval.start, interval.end),
        );
        if (crossing === undefined) {
          const placement = data.placement;
          if (
            placement !== undefined &&
            (start % placement.align !== 0 ||
              (placement.noCross !== null &&
                Math.floor(start / placement.noCross) !== Math.floor(end / placement.noCross)) ||
              placement.region !== null)
          )
            break;
          placed = addInterval(intervals, {
            id: data.id,
            kind: "bss",
            start,
            end,
            bytes: null,
          });
          break;
        }
        if (data.placement?.at !== null && data.placement?.at !== undefined) break;
        start = sourceDataStart(crossing.end + 1, bytes.length, data.alignment, data.placement);
      }
      if (placed) break;
    }
    if (!placed) {
      return Object.freeze({ kind: "error", reason: "source-placement", objectId: data.id });
    }
  }

  const nonAssets = laidOutProgram.data
    .filter(
      ({ kind, zeropage, vicSpriteBlocks }) =>
        (kind !== "asset" || vicSpriteBlocks === false) && kind !== "bss" && !zeropage,
    )
    .sort((left, right) => {
      const leftFixed = left.placement?.at != null;
      const rightFixed = right.placement?.at != null;
      return leftFixed === rightFixed ? compareIds(left, right) : leftFixed ? -1 : 1;
    });
  let cursor = input.profile.packager.startupAddress;
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
    if (
      data.placement?.at == null &&
      bytes.length > input.profile.packager.residentEnd - input.profile.packager.residentStart + 1
    )
      return Object.freeze({ kind: "error", reason: "resident-range", objectId: null });
    const fixed = data.placement?.at != null;
    const start = freeSourceStart(
      cursor,
      bytes.length,
      data.alignment,
      data.placement,
      fixed ? intervals : [...intervals, ...fixedData],
      input.profile,
    );
    if (start === null) {
      return Object.freeze({ kind: "error", reason: "source-placement", objectId: data.id });
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
    if (!fixed) cursor = start + bytes.length;
  }

  const spriteBlocks: number[] = [];
  const assets = laidOutProgram.data
    .filter(({ kind, vicSpriteBlocks }) => kind === "asset" && vicSpriteBlocks !== false)
    .sort(compareIds);
  for (const asset of assets) {
    const bytes = dataBytes(asset);
    if (bytes === null || bytes.length === 0 || bytes.length % 64 !== 0) {
      return Object.freeze({ kind: "error", reason: "invalid-asset", objectId: asset.id });
    }
    let start = align(input.profile.machine.spriteStart, 64);
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
  }

  const loadedBeforeFill = [...intervals]
    .filter(({ bytes }) => bytes !== null)
    .sort((left, right) => left.start - right.start);
  let nextLoaded = loadedBeforeFill[0]!.end + 1;
  for (const interval of loadedBeforeFill.slice(1)) {
    if (interval.start > nextLoaded) {
      const fillBytes = Object.freeze(new Array<number>(interval.start - nextLoaded).fill(0));
      if (
        !addInterval(intervals, {
          id: `fill.${nextLoaded.toString(16)}`,
          kind: "fill",
          start: nextLoaded,
          end: interval.start - 1,
          bytes: fillBytes,
        })
      )
        return Object.freeze({ kind: "error", reason: "fill-conflict", objectId: interval.id });
    }
    nextLoaded = interval.end + 1;
  }

  const uninitialized = laidOutProgram.data
    .filter(({ kind, zeropage }) => kind === "bss" && !zeropage)
    .sort((left, right) => {
      const leftFixed = left.placement?.at !== null && left.placement?.at !== undefined;
      const rightFixed = right.placement?.at !== null && right.placement?.at !== undefined;
      return leftFixed === rightFixed ? compareIds(left, right) : leftFixed ? -1 : 1;
    });
  let bssCursor = nextLoaded;
  for (const data of uninitialized) {
    const bytes = dataBytes(data);
    if (
      bytes === null ||
      bytes.length === 0 ||
      bytes.some((byte) => byte !== 0) ||
      !Number.isInteger(data.alignment) ||
      data.alignment <= 0 ||
      (data.alignment & (data.alignment - 1)) !== 0
    ) {
      return Object.freeze({ kind: "error", reason: "invalid-data", objectId: data.id });
    }
    let start = sourceDataStart(bssCursor, bytes.length, data.alignment, data.placement);
    while (start !== null && data.placement?.at == null) {
      const end = start + bytes.length - 1;
      const occupied = intervals.find((interval) =>
        overlaps(start!, end, interval.start, interval.end),
      );
      if (occupied === undefined) break;
      start = sourceDataStart(occupied.end + 1, bytes.length, data.alignment, data.placement);
    }
    if (
      start === null ||
      !satisfiesSourcePlacement(start, bytes.length, data.placement, input.profile)
    ) {
      return Object.freeze({ kind: "error", reason: "source-placement", objectId: data.id });
    }
    if (
      !addInterval(intervals, {
        id: data.id,
        kind: "bss",
        start,
        end: start + bytes.length - 1,
        bytes: null,
      })
    ) {
      return Object.freeze({
        kind: "error",
        reason: data.placement ? "source-placement" : "data-conflict",
        objectId: data.id,
      });
    }
    if (data.placement?.at == null) bssCursor = start + bytes.length;
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
    ) ||
    ordered.some(
      ({ kind, start, end }) =>
        kind === "bss" &&
        (start < input.profile.packager.residentStart ||
          end > input.profile.packager.residentEnd) &&
        !input.profile.storage.zeroPage.some(
          (region) => start >= region.start && end <= region.end,
        ),
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
