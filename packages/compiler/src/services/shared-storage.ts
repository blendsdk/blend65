import { layoutC64Program } from "../layout/c64-layout.js";
import type { C64LayoutResult } from "../layout/c64-layout.js";
import { bindMachineProgram } from "../machine/bind.js";
import { validLoweringProvenance } from "../machine/lower.js";
import { machineProgramContent } from "../machine/lowering-provenance.js";
import type { MachineContentObservation } from "../machine/lowering-provenance.js";
import { storageInventoryHash } from "../storage/closure.js";
import type { MachineFunction, MachineProgram } from "../machine/machine-types.js";
import { closeStorage } from "../storage/closure.js";
import type {
  StorageBinder,
  StorageClosureResult,
  StorageRange,
  StorageProfile,
} from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import type { SourceSpan } from "../project/types.js";

type ClosedStorage = Extract<StorageClosureResult, { readonly kind: "complete" }>;
type BoundMachine = Extract<ReturnType<typeof bindMachineProgram>, { readonly kind: "complete" }>;
type CompleteLayout = Extract<C64LayoutResult, { readonly kind: "complete" }>;

/** Private output evidence cannot be copied onto another root and become producer authority. */
const SHARED_EVIDENCE = Symbol("shared-storage-evidence");
/** This authority is distinct from the discoverable property key and never leaves the owner. */
const SHARED_MINT = Symbol("shared-storage-mint");

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

/** Fully closed output of this owner, before any observer or cost acceptance. */
type CompleteSharedStorage = Extract<SharedStorageResult, { readonly kind: "complete" }>;

/** Capture plain final certificate/layout facts; source graphs are covered by their original hash. */
function sharedContent(result: CompleteSharedStorage, profile: TargetProfile): string {
  return JSON.stringify(
    [
      storageInventoryHash(result.certificate.inventory),
      result.certificate.certificate,
      result.certificate.placement,
      result.certificate.irqOverlap,
      result.layout.intervals,
      result.layout.loadRange,
      profile,
    ],
    (_key: string, value: unknown) => {
      if (value instanceof Map || value instanceof Set)
        throw new Error("Final shared facts require an explicit collection observation");
      return typeof value === "bigint" ? `bigint:${value.toString()}` : value;
    },
  );
}

/** Compare structural machine observations without giving either observation minting authority. */
function sameMachineContent(
  left: MachineContentObservation,
  right: MachineContentObservation,
): boolean {
  return (
    left.fingerprint === right.fingerprint &&
    left.references.length === right.references.length &&
    left.references.every((reference, index) => reference === right.references[index])
  );
}

/** Final actual producer tuple, not a replacement layout, certificate, or second machine graph. */
class SharedEvidence {
  readonly #root: CompleteSharedStorage;
  readonly #symbolic: MachineProgram;
  readonly #binder: StorageBinder;
  readonly #profile: TargetProfile;
  readonly #storage: StorageProfile;
  readonly #machine: MachineContentObservation;
  readonly #layout: MachineContentObservation;
  readonly #content: string;

  /** Only this module's successful closure path has the private mint capability. */
  constructor(
    mint: symbol,
    root: CompleteSharedStorage,
    symbolic: MachineProgram,
    binder: StorageBinder,
    profile: TargetProfile,
    storage: StorageProfile,
  ) {
    if (mint !== SHARED_MINT) throw new Error("Shared evidence belongs to its real producer");
    this.#root = root;
    this.#symbolic = symbolic;
    this.#binder = binder;
    this.#profile = profile;
    this.#storage = storage;
    this.#machine = machineProgramContent(root.machine.program);
    this.#layout = machineProgramContent(root.layout.program);
    this.#content = sharedContent(root, profile);
    Object.freeze(this);
  }

  /** Check actual members and mutable nested contents, then the earlier lowering association. */
  matches(
    root: CompleteSharedStorage,
    symbolic: MachineProgram,
    binder: StorageBinder,
    profile: TargetProfile,
  ): boolean {
    return (
      root === this.#root &&
      symbolic === this.#symbolic &&
      binder === this.#binder &&
      root.machine.program.storageProfile === this.#storage &&
      root.layout.program.storageProfile === this.#storage &&
      sharedContent(root, profile) === this.#content &&
      sharedContent(this.#root, this.#profile) === this.#content &&
      sameMachineContent(this.#machine, machineProgramContent(root.machine.program)) &&
      sameMachineContent(this.#layout, machineProgramContent(root.layout.program)) &&
      validLoweringProvenance(symbolic, binder, root.certificate.inventory, profile)
    );
  }
}

/**
 * Verify the real lowering-to-final-closure handoff without replaying any compiler stage.
 * A geometric complete result is not automatically observer-safe; missing, copied or stale
 * evidence is false. Mutable instruction/proof/site collections must still match their producer.
 * @param symbolic Exact original selected program returned by the real lowering producer.
 * @param binder Its actual finite discovery/helper/startup/site contract.
 * @param result Actual complete shared result to be consumed.
 * @param profile Original target facts, not the reserved or trailing-RAM allocation profile.
 * @returns Whether both producer associations and all captured contents remain unchanged.
 * @example validSharedStorageProvenance(symbolic, binder, shared, profile)
 */
export function validSharedStorageProvenance(
  symbolic: MachineProgram,
  binder: StorageBinder,
  result: CompleteSharedStorage,
  profile: TargetProfile,
): boolean {
  try {
    const evidence: unknown = Reflect.get(result, SHARED_EVIDENCE);
    return (
      evidence instanceof SharedEvidence && evidence.matches(result, symbolic, binder, profile)
    );
  } catch {
    return false;
  }
}

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
  // Geometric-only callers remain supported, but later restoration of changed
  // inputs must never turn their output into an authenticated lowering handoff.
  const loweringValidAtEntry = validLoweringProvenance(
    symbolic,
    binder,
    provisional.inventory,
    profile,
  );
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
  const result: CompleteSharedStorage = { kind: "complete", certificate, machine, layout };
  if (
    loweringValidAtEntry &&
    validLoweringProvenance(symbolic, binder, certificate.inventory, profile)
  ) {
    const evidence = new SharedEvidence(SHARED_MINT, result, symbolic, binder, profile, storage);
    Object.defineProperty(result, SHARED_EVIDENCE, { value: evidence });
  }
  return Object.freeze(result);
}
