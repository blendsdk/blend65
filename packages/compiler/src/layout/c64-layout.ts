import type { StorageClosureCertificate } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import { selectC64KernalFacts } from "../profile/c64-kernal.js";
import { repairMachineBranches } from "../machine/block-layout.js";
import { validateMachineProgram } from "../machine/bind.js";
import { machineInstruction } from "../machine/lower-control.js";
import type { MachineBlock, MachineFunction, MachineProgram } from "../machine/machine-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import {
  freeSourceStart,
  overlaps,
  satisfiesSourcePlacement,
  sourceDataStart,
} from "./c64-layout-placement.js";
import { C64_STARTUP_STATE_ID, createC64StartupStateData, bindC64StartupState } from "./startup.js";

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
  /** True when the handler requires VIC visibility for this object. */
  readonly vicVisible?: boolean;
  /** Exact handler or source alignment in bytes. */
  readonly requiredAlignment?: number;
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
  | {
      readonly kind: "error";
      readonly reason: string;
      readonly objectId: string | null;
      /** Complete source-linked diagnostic when the reason has one exact owner. */
      readonly diagnostic?: ProjectDiagnostic;
    };

import {
  functionBytes,
  blockBytes,
  compareIds,
  addInterval,
  dataBytes,
  storageIntervals,
  resolvePlacementTransforms,
  compactFoldedFunctions,
} from "./c64-layout-objects.js";

/**
 * Place one contiguous startup path and reject an out-of-range relative edge.
 * Extra loop blocks are short by construction; long-branch repair would move bytes
 * after the path and is intentionally not guessed here.
 */
function placeStartupPath(
  blocks: readonly MachineBlock[],
  origin: number,
): readonly MachineBlock[] | null {
  const labels = new Map<string, number>();
  let cursor = origin;
  for (const block of blocks) {
    const bytes = blockBytes(block);
    if (bytes === null || labels.has(block.label)) return null;
    labels.set(block.label, cursor);
    cursor += bytes;
  }
  for (const block of blocks) {
    const terminator = block.terminator;
    if (terminator.kind !== "branch") continue;
    const target = labels.get(terminator.target);
    const fallthrough = labels.get(terminator.fallthrough);
    const instructions = block.instructions.reduce((sum, item) => sum + item.cost.bytes, 0);
    const distance =
      target === undefined ? 0 : target - (labels.get(block.label)! + instructions + 2);
    if (target === undefined || fallthrough === undefined || distance < -128 || distance > 127)
      return null;
  }
  let placed = origin;
  return Object.freeze(
    blocks.map((block) => {
      const result = Object.freeze({ ...block, origin: placed });
      placed += blockBytes(block)!;
      return result;
    }),
  );
}

/** Add the zero-filled remainder of one active screen's complete 1 KiB block. */
function addScreenTail(
  intervals: C64LayoutInterval[],
  start: number,
  payloadBytes: number,
): boolean {
  if (payloadBytes >= 1024) return true;
  const tailStart = start + payloadBytes;
  const pointerStart = start + 0x3f8;
  if (tailStart < pointerStart) {
    if (
      !addInterval(intervals, {
        id: `screen.${start.toString(16)}.tail`,
        kind: "fill",
        start: tailStart,
        end: pointerStart - 1,
        bytes: Object.freeze(new Array<number>(pointerStart - tailStart).fill(0)),
      })
    ) {
      return false;
    }
  }
  const pointerTableStart = Math.max(tailStart, pointerStart);
  return addInterval(intervals, {
    id: `screen.${start.toString(16)}.pointer-table`,
    kind: "fill",
    start: pointerTableStart,
    end: start + 0x3ff,
    bytes: Object.freeze(new Array<number>(start + 0x400 - pointerTableStart).fill(0)),
  });
}

/** Rebuild loaded code intervals and gap fill after post-layout function compaction. */
function finalizeCompactedIntervals(
  intervals: readonly C64LayoutInterval[],
  program: MachineProgram,
): readonly C64LayoutInterval[] | null {
  const pieces: { start: number; end: number }[] = [];
  for (const fn of [program.startup, ...program.functions]) {
    for (const block of fn.blocks) {
      if (block.origin === undefined) continue;
      const bytes = blockBytes(block);
      if (bytes === null) return null;
      if (bytes > 0) pieces.push({ start: block.origin, end: block.origin + bytes - 1 });
    }
  }
  pieces.sort((left, right) => left.start - right.start);
  const merged: { start: number; end: number }[] = [];
  for (const piece of pieces) {
    const last = merged.at(-1);
    if (last !== undefined && piece.start <= last.end + 1) {
      last.end = Math.max(last.end, piece.end);
    } else {
      merged.push({ ...piece });
    }
  }
  const result = intervals.filter(
    (interval) => interval.kind !== "code" && !interval.id.startsWith("fill."),
  );
  for (const [index, piece] of merged.entries()) {
    const id = index === 0 ? "program.code" : `program.code.${index}`;
    if (
      !addInterval(result, {
        id,
        kind: "code",
        start: piece.start,
        end: piece.end,
        bytes: Object.freeze(new Array<number>(piece.end - piece.start + 1).fill(0)),
      })
    ) {
      return null;
    }
  }
  const loaded = result
    .filter(({ bytes }) => bytes !== null)
    .sort((left, right) => left.start - right.start);
  if (loaded.length === 0) return null;
  let nextLoaded = loaded[0]!.end + 1;
  for (const interval of loaded.slice(1)) {
    if (interval.start > nextLoaded) {
      if (
        !addInterval(result, {
          id: `fill.${nextLoaded.toString(16)}`,
          kind: "fill",
          start: nextLoaded,
          end: interval.start - 1,
          bytes: Object.freeze(new Array<number>(interval.start - nextLoaded).fill(0)),
        })
      ) {
        return null;
      }
    }
    nextLoaded = Math.max(nextLoaded, interval.end + 1);
  }
  return Object.freeze(
    result.sort((left, right) => left.start - right.start || compareIds(left, right)),
  );
}

/**
 * Place startup/code, data, final SFA homes and VIC-visible sprite data deterministically.
 * @param input Bound program, final certificate and exact selected profile.
 * @returns One conflict-free layout with explicit loaded fill.
 */
export function layoutC64Program(input: C64LayoutInput): C64LayoutResult {
  if (
    selectC64KernalFacts(input.profile.id) === null ||
    !input.certificate.closed ||
    input.certificate.profileId !== input.profile.id
  ) {
    return Object.freeze({ kind: "error", reason: "profile-or-certificate", objectId: null });
  }
  const boundStartup = bindC64StartupState(input.program, input.certificate.homes, input.profile);
  if (boundStartup === null) {
    return Object.freeze({ kind: "error", reason: "invalid-data", objectId: C64_STARTUP_STATE_ID });
  }
  input = { ...input, program: boundStartup };
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

  const startupBlocks = input.program.startup.blocks;
  const entryIndex = startupBlocks.findIndex(({ label }) => label === "startup.entry");
  const restoreIndex = startupBlocks.findIndex(({ label }) => label === "startup.restore");
  if (entryIndex !== 0 || restoreIndex <= 0 || restoreIndex >= startupBlocks.length) {
    return Object.freeze({ kind: "error", reason: "invalid-code-size", objectId: null });
  }
  const entryBlocks = startupBlocks.slice(0, restoreIndex);
  const restoreBlocks = startupBlocks.slice(restoreIndex);
  const startupLabels = new Set(startupBlocks.map(({ label }) => label));
  if (startupLabels.size !== startupBlocks.length) {
    return Object.freeze({ kind: "error", reason: "invalid-code-size", objectId: null });
  }
  const entrySizes = entryBlocks.map(blockBytes);
  const restoreSizes = restoreBlocks.map(blockBytes);
  if (entrySizes.some((bytes) => bytes === null) || restoreSizes.some((bytes) => bytes === null)) {
    return Object.freeze({ kind: "error", reason: "invalid-code-size", objectId: null });
  }
  const entryBaseBytes = entrySizes.reduce<number>((sum, bytes) => sum + bytes!, 0);
  const restoreBytes = restoreSizes.reduce<number>((sum, bytes) => sum + bytes!, 0);
  const mainTargets = entryBlocks.flatMap(({ terminator }) =>
    terminator.kind === "fallthrough" && !startupLabels.has(terminator.target)
      ? [terminator.target]
      : [],
  );
  if (mainTargets.length !== 1) {
    return Object.freeze({ kind: "error", reason: "invalid-code-size", objectId: null });
  }
  const mainTarget = mainTargets[0]!;
  const mainFunction = input.program.functions.find(({ id }) => id === mainTarget);
  const mainBytes = mainFunction === undefined ? null : functionBytes(mainFunction);
  const entryEnd = input.profile.packager.startupAddress + entryBaseBytes;
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
    .map(({ id, bytes, placement, vicScreenRole }) => ({
      id,
      start: placement!.at!,
      end: placement!.at! + (vicScreenRole === true ? 1024 : bytes.length) - 1,
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
  const needsMainJump = mainFunction !== undefined && !mainAtEntry;
  const entryPath = needsMainJump
    ? entryBlocks.map((block, index) =>
        index === entryBlocks.length - 1
          ? Object.freeze({
              ...block,
              terminator: Object.freeze({
                kind: "jump" as const,
                opcode: "jmp" as const,
                target: mainTarget,
                cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
              }),
            })
          : block,
      )
    : entryBlocks;
  const entryBytes = entryPath
    .map(blockBytes)
    .reduce<
      number | null
    >((sum, bytes) => (sum === null || bytes === null ? null : sum + bytes), 0);
  if (entryBytes === null) {
    return Object.freeze({ kind: "error", reason: "invalid-code-size", objectId: null });
  }
  const placedEntry = placeStartupPath(entryPath, input.profile.packager.startupAddress);
  if (placedEntry === null) {
    return Object.freeze({ kind: "error", reason: "branch-layout", objectId: "startup.entry" });
  }
  const orderedFunctions = [...input.program.functions].sort((left, right) => {
    if (left.id === mainTarget) return -1;
    if (right.id === mainTarget) return 1;
    // Publish the low-$47 NMI wrapper before ordinary bodies so later first-fit
    // placement can occupy the alignment gap with real code instead of fill.
    if (left.nmiPublicationEntry === true && right.nmiPublicationEntry !== true) return -1;
    if (right.nmiPublicationEntry === true && left.nmiPublicationEntry !== true) return 1;
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
  const nmiAdapters = new Set<string>();
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
    if (fn.nmiPublicationEntry && (origin & 0xff) !== 0x47) nmiAdapters.add(fn.id);
  }
  for (const fn of orderedFunctions) {
    if (repairedById.has(fn.id)) continue;
    const estimate = repairMachineBranches(fn, entryEnd);
    if (estimate.kind === "error") {
      return Object.freeze({ kind: "error", reason: "branch-layout", objectId: fn.id });
    }
    let origin = freeSourceStart(
      input.profile.packager.startupAddress + entryBytes,
      estimate.byteLength,
      1,
      fn.placement,
      [...codePieces, ...fixedReservations],
      input.profile,
      fn.nmiPublicationEntry === true,
    );
    if (origin === null && fn.nmiPublicationEntry) {
      origin = freeSourceStart(
        input.profile.packager.startupAddress + entryBytes,
        estimate.byteLength,
        1,
        fn.placement,
        [...codePieces, ...fixedReservations],
        input.profile,
      );
      nmiAdapters.add(fn.id);
    }
    if (origin === null || (fn.id === mainTarget && !needsMainJump && origin !== entryEnd)) {
      return Object.freeze({ kind: "error", reason: "source-placement", objectId: fn.id });
    }
    const repaired = repairMachineBranches(fn, origin);
    if (repaired.kind === "error" || repaired.byteLength !== estimate.byteLength)
      return Object.freeze({ kind: "error", reason: "branch-layout", objectId: fn.id });
    codePieces.push({ start: origin, end: origin + repaired.byteLength - 1 });
    repairedById.set(fn.id, repaired.function);
  }
  for (const id of nmiAdapters) {
    const wrapper = repairedById.get(id)!;
    const origin = freeSourceStart(
      input.profile.packager.startupAddress + entryBytes,
      3,
      1,
      undefined,
      [...codePieces, ...fixedReservations],
      input.profile,
      true,
    );
    if (origin === null)
      return Object.freeze({ kind: "error", reason: "source-placement", objectId: id });
    const body = wrapper.blocks[0]!;
    const entry = Object.freeze({
      label: `${body.label}.nmi-publication`,
      origin,
      instructions: Object.freeze([
        machineInstruction(
          input.profile.cpu,
          "jmp",
          "absolute",
          Object.freeze({ kind: "label", label: body.label }),
          [],
        ),
      ]),
      terminator: Object.freeze({ kind: "unreachable" as const }),
    });
    // The body already passed its complete source constraints. This immutable
    // entry owns no function storage; both pieces retain one source/debug owner.
    repairedById.set(
      id,
      Object.freeze({
        ...wrapper,
        origin,
        blocks: Object.freeze([entry, ...wrapper.blocks]),
      }),
    );
    codePieces.push({ start: origin, end: origin + 2 });
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
  const placedRestore = placeStartupPath(restoreBlocks, restoreOrigin);
  if (placedRestore === null) {
    return Object.freeze({ kind: "error", reason: "branch-layout", objectId: "startup.restore" });
  }
  const placedStartup = Object.freeze({
    ...input.program.startup,
    origin: input.profile.packager.startupAddress,
    blocks: Object.freeze([...placedEntry, ...placedRestore]),
  });
  const expectedStartupState = createC64StartupStateData(input.program.c64Startup);
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
  let cursor: number = input.profile.packager.startupAddress;
  for (const data of nonAssets) {
    const bytes = dataBytes(data);
    if (
      bytes === null ||
      !Number.isInteger(data.alignment) ||
      data.alignment <= 0 ||
      (data.alignment & (data.alignment - 1)) !== 0 ||
      (data.vicConsumerBytes !== undefined && bytes.length < data.vicConsumerBytes)
    ) {
      return Object.freeze({ kind: "error", reason: "invalid-data", objectId: data.id });
    }
    const screenRole = data.vicScreenRole === true;
    const placementBytes = screenRole ? 1024 : bytes.length;
    if (
      data.placement?.at == null &&
      placementBytes > input.profile.packager.residentEnd - input.profile.packager.residentStart + 1
    )
      return Object.freeze({ kind: "error", reason: "resident-range", objectId: null });
    const fixed = data.placement?.at != null;
    const visible = data.vicVisible === true;
    const occupied: { readonly start: number; readonly end: number }[] = fixed
      ? [...intervals]
      : [...intervals, ...fixedData];
    if (visible) {
      occupied.push(
        {
          start: input.profile.machine.characterRomStart,
          end: input.profile.machine.characterRomEnd,
        },
        {
          start: input.profile.machine.screenAddress,
          end: input.profile.machine.screenEnd,
        },
      );
    }
    // Hardware-constrained data searches the whole legal VIC window instead of
    // waiting behind ordinary code/data. This keeps feasibility independent of
    // content-hash ordering and honors R6.39's no-hidden-code-priority rule.
    const searchStart =
      visible && !fixed
        ? Math.max(input.profile.machine.vicBankStart, input.profile.packager.residentStart)
        : visible
          ? Math.max(cursor, input.profile.machine.vicBankStart)
          : cursor;
    const start = freeSourceStart(
      searchStart,
      placementBytes,
      data.alignment,
      data.placement,
      occupied,
      input.profile,
    );
    if (
      start === null ||
      (visible &&
        (start < input.profile.machine.vicBankStart ||
          start + placementBytes - 1 > input.profile.machine.vicBankEnd))
    ) {
      return Object.freeze({
        kind: "error",
        reason: visible ? "vic-visibility" : "source-placement",
        objectId: data.id,
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
        ...(data.vicVisible === true ? { vicVisible: true } : {}),
        requiredAlignment: data.alignment,
      })
    ) {
      return Object.freeze({ kind: "error", reason: "data-conflict", objectId: data.id });
    }
    if (screenRole && !addScreenTail(intervals, start, bytes.length)) {
      return Object.freeze({ kind: "error", reason: "data-conflict", objectId: data.id });
    }
    if (!fixed) cursor = Math.max(cursor, start + placementBytes);
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
    // An active screen owns its complete 1 KiB block: 1,000 payload bytes,
    // 16 zero bytes in the same block and the final eight pointer bytes.
    const screenRole = asset.vicScreenRole === true;
    const placementBytes = screenRole ? 1024 : bytes.length;
    const occupied: { readonly start: number; readonly end: number }[] = [
      ...intervals,
      // A fixed sprite is its own placement request; its reserved range must not
      // be mistaken for a conflicting object while it is being placed.
      ...fixedData.filter(({ id }) => id !== asset.id),
      {
        start: input.profile.machine.characterRomStart,
        end: input.profile.machine.characterRomEnd,
      },
      {
        start: input.profile.machine.screenAddress,
        end: input.profile.machine.screenEnd,
      },
    ];
    const candidate = (from: number): number | null => {
      const value = freeSourceStart(
        from,
        placementBytes,
        Math.max(64, asset.placement?.align ?? 1),
        asset.placement,
        occupied,
        input.profile,
      );
      return value !== null &&
        value >= input.profile.machine.vicBankStart &&
        value + placementBytes - 1 <= input.profile.machine.vicBankEnd
        ? value
        : null;
    };
    const start =
      candidate(
        Math.max(input.profile.machine.spriteStart, input.profile.packager.residentStart),
      ) ??
      candidate(Math.max(input.profile.machine.vicBankStart, input.profile.packager.residentStart));
    const end = start === null ? -1 : start + bytes.length - 1;
    if (start === null) {
      return Object.freeze({ kind: "error", reason: "vic-visibility", objectId: asset.id });
    }
    if (
      !addInterval(intervals, {
        id: asset.id,
        kind: "asset",
        start,
        end,
        bytes,
        vicVisible: true,
        requiredAlignment: 64,
      })
    ) {
      return Object.freeze({ kind: "error", reason: "asset-conflict", objectId: asset.id });
    }
    if (screenRole && !addScreenTail(intervals, start, bytes.length)) {
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
      if (
        data.placement?.region === "c64.vic.bank0-ram" &&
        start <= input.profile.machine.characterRomEnd &&
        end >= input.profile.machine.characterRomStart
      ) {
        start = sourceDataStart(
          input.profile.machine.characterRomEnd + 1,
          bytes.length,
          data.alignment,
          data.placement,
        );
        continue;
      }
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
        ...(data.vicVisible === true || data.placement?.region === "c64.vic.bank0-ram"
          ? { vicVisible: true }
          : {}),
        requiredAlignment: Math.max(data.alignment, data.placement?.align ?? 1),
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
  const resolved = resolvePlacementTransforms(laidOutProgram, ordered, input.profile);
  if (resolved.kind === "error") {
    return Object.freeze({
      kind: "error",
      reason: "placement-transform",
      objectId: null,
      diagnostic: projectDiagnostic(
        "E10273",
        resolved.message.startsWith("Cannot place")
          ? resolved.message
          : `Cannot place 'VIC field' — ${resolved.message}; change the field address or placement constraint`,
        resolved.source,
        null,
        [],
        resolved.contributors.length === 0
          ? null
          : `Contributors: ${resolved.contributors.join("; ")}`,
      ),
    });
  }
  if (
    resolved.program.storageInventoryHash !== undefined &&
    !validateMachineProgram(resolved.program)
  ) {
    return Object.freeze({ kind: "error", reason: "placement-transform", objectId: null });
  }
  const compacted = compactFoldedFunctions(resolved.program);
  if (compacted.storageInventoryHash !== undefined && !validateMachineProgram(compacted)) {
    return Object.freeze({ kind: "error", reason: "placement-transform", objectId: null });
  }
  const finalIntervals = finalizeCompactedIntervals(ordered, compacted);
  if (finalIntervals === null) {
    return Object.freeze({ kind: "error", reason: "code-conflict", objectId: null });
  }
  const finalLoaded = finalIntervals.filter(({ bytes }) => bytes !== null);
  return Object.freeze({
    kind: "complete",
    intervals: finalIntervals,
    spriteBlocks: Object.freeze(spriteBlocks),
    loadRange: Object.freeze({
      start: finalLoaded[0]!.start,
      end: finalLoaded.at(-1)!.end,
    }),
    program: compacted,
  });
}
