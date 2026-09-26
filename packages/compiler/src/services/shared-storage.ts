import { layoutC64Program } from "../layout/c64-layout.js";
import type { C64LayoutResult } from "../layout/c64-layout.js";
import { bindMachineProgram } from "../machine/bind.js";
import type { MachineFunction, MachineProgram } from "../machine/machine-types.js";
import { closeStorage } from "../storage/closure.js";
import type {
  StorageBinder,
  StorageClosureResult,
  StorageRange,
} from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import type { SourceSpan } from "../project/types.js";

type ClosedStorage = Extract<StorageClosureResult, { readonly kind: "complete" }>;
type BoundMachine = Extract<ReturnType<typeof bindMachineProgram>, { readonly kind: "complete" }>;
type CompleteLayout = Extract<C64LayoutResult, { readonly kind: "complete" }>;

/** Final shared-memory placement, or a terminal failure before any artifact is emitted. */
export type SharedStorageResult =
  | {
      /** Shared RAM and all bound code/data origins passed the final consistency check. */
      readonly kind: "complete";
      /** Certificate regenerated using only the actual trailing free RAM ranges. */
      readonly certificate: ClosedStorage;
      /** Original symbolic instructions bound to the final certified homes. */
      readonly machine: BoundMachine;
      /** Rechecked code, data and storage layout used by serialization. */
      readonly layout: CompleteLayout;
    }
  | Extract<C64LayoutResult, { readonly kind: "error" }>
  | {
      /** Source-owned RAM exhaustion, not a compiler layout invariant failure. */
      readonly kind: "resource-error";
      /** Occupied platform bytes plus the already certified function-storage demand. */
      readonly used: number;
      /** Source storage request which could not be assigned a final home. */
      readonly source: SourceSpan | null;
    };

/** Subtract platform-owned BSS from the suffix left after the contiguous emitted image. */
function trailingRanges(layout: CompleteLayout, profile: TargetProfile): readonly StorageRange[] {
  const ranges: StorageRange[] = [];
  let cursor = layout.loadRange.end + 1;
  for (const interval of layout.intervals) {
    if (interval.end < cursor) continue;
    if (interval.start > cursor) ranges.push({ start: cursor, end: interval.start - 1 });
    cursor = Math.max(cursor, interval.end + 1);
  }
  if (cursor <= profile.packager.residentEnd)
    ranges.push({ start: cursor, end: profile.packager.residentEnd });
  return Object.freeze(ranges.map((range) => Object.freeze(range)));
}

/** Compare selected structure and origins, including helper sharing, without comparing moved operands. */
function codeShape(fn: MachineFunction): unknown {
  return [
    fn.id,
    fn.origin,
    fn.blocks.map((block) => [
      block.label,
      block.origin,
      block.instructions.map((instruction) => [
        instruction.opcode,
        instruction.mode,
        instruction.cost.bytes,
      ]),
      block.terminator,
    ]),
  ];
}

/**
 * Derive platform-owned free ranges, then close and bind function storage before final layout.
 * The draft is never serialized. No certified address is moved in place: closure creates a new
 * certificate, and the original symbolic operands are bound again against that certificate.
 */
export function closeSharedStorage(
  symbolic: MachineProgram,
  binder: StorageBinder,
  provisional: ClosedStorage,
  profile: TargetProfile,
): SharedStorageResult {
  const bound = bindMachineProgram(symbolic, provisional.certificate);
  if (bound.kind === "error")
    return { kind: "error", reason: "machine-storage-binding", objectId: bound.requestId };
  const draft = layoutC64Program({
    program: bound.program,
    certificate: provisional.certificate,
    profile,
    draftFunctionStorage: true,
  });
  if (draft.kind === "error") return draft;
  const storage = Object.freeze({
    ...symbolic.storageProfile!,
    ram: trailingRanges(draft, profile),
  });
  const certificate = closeStorage(provisional.inventory, storage, binder);
  if (certificate.kind === "error" && certificate.reason === "resource") {
    const residentBytes = draft.intervals.reduce(
      (total, interval) =>
        interval.start >= profile.packager.residentStart
          ? total + interval.end - interval.start + 1
          : total,
      0,
    );
    return {
      kind: "resource-error",
      used: residentBytes + provisional.certificate.staticBytes.ram,
      source:
        provisional.inventory.requests.find(({ id }) => id === certificate.requestId)?.source ??
        null,
    };
  }
  if (certificate.kind === "error")
    return { kind: "error", reason: "shared-storage", objectId: certificate.requestId ?? null };
  const machine = bindMachineProgram(
    { ...symbolic, storageProfile: storage },
    certificate.certificate,
  );
  if (machine.kind === "error")
    return { kind: "error", reason: "machine-storage-binding", objectId: machine.requestId };
  const layout = layoutC64Program({
    program: machine.program,
    certificate: certificate.certificate,
    profile,
  });
  if (layout.kind === "error") return layout;
  const shape = (selected: CompleteLayout): string =>
    JSON.stringify([
      selected.loadRange,
      selected.intervals.filter(({ kind }) => kind !== "sfa"),
      codeShape(selected.program.startup),
      selected.program.functions.map(codeShape),
    ]);
  if (shape(draft) !== shape(layout))
    return { kind: "error", reason: "storage-layout-instability", objectId: null };
  return { kind: "complete", certificate, machine, layout };
}
