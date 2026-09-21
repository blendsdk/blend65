import type { CompleteC64Layout } from "../artifacts/acme-validate.js";
import type { EvidenceRecord } from "../artifacts/evidence-types.js";
import { canonicalEvidenceHash } from "../artifacts/evidence-validation.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { StorageClosureCertificate, StorageInventory } from "../storage/storage-types.js";
import {
  compareText,
  functionName,
  globalName,
  machineBlockRange,
  machineFunctionRange,
} from "./evidence-records.js";

/** Convert a final physical layout interval into the memory-ledger schema. */
function physicalInterval(
  interval: CompleteC64Layout["intervals"][number],
  inventory: StorageInventory,
  certificate: StorageClosureCertificate,
  assetIds: ReadonlyMap<string, string>,
  ownerOverride?: EvidenceRecord,
): EvidenceRecord {
  const size = interval.end - interval.start + 1;
  const semanticAssetId = interval.id.startsWith("asset.") ? interval.id.slice(6) : null;
  const evidenceAssetId = semanticAssetId === null ? undefined : assetIds.get(semanticAssetId);
  const isAsset = interval.kind === "asset" && evidenceAssetId !== undefined;
  const isStorage = interval.kind === "sfa";
  const isPadding = interval.kind === "fill";
  const requestsById = new Map(inventory.requests.map((request) => [request.id, request] as const));
  const selectedHomes = isStorage
    ? certificate.homes.filter(
        (home) => home.address <= interval.end && home.address + home.bytes - 1 >= interval.start,
      )
    : [];
  const selectedRequests = selectedHomes.flatMap((home) => {
    const request = requestsById.get(home.requestId);
    return request === undefined ? [] : [request];
  });
  if (isStorage && selectedRequests.length !== selectedHomes.length) {
    throw new Error("Final SFA layout references an unknown storage request");
  }
  const helperOwners = new Map<string, string>();
  for (const helper of certificate.helperCalls) {
    for (const requestId of helper.helperRequestIds) helperOwners.set(requestId, helper.id);
  }
  const allHelper =
    selectedHomes.length > 0 && selectedHomes.every(({ requestId }) => helperOwners.has(requestId));
  const namesByBinding = new Map(
    inventory.program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), functionName(fn)]),
  );
  const ownerIds = allHelper
    ? selectedRequests.map((request) => {
        const ownerName =
          namesByBinding.get(bindingIdentityKey(request.owner)) ??
          `initializer::${bindingIdentityKey(request.owner)}`;
        return `${ownerName}::${request.id}`;
      })
    : selectedRequests.map(
        (request) =>
          namesByBinding.get(bindingIdentityKey(request.owner)) ??
          `initializer::${bindingIdentityKey(request.owner)}`,
      );
  const distinctOwnerIds = [...new Set(ownerIds)].sort(compareText);
  const storageOwner =
    distinctOwnerIds.length === 1
      ? distinctOwnerIds[0]!
      : `overlay:${JSON.stringify(distinctOwnerIds)}`;
  const zeroPage = isStorage && interval.start < 0x100;
  const memoryKind = isStorage
    ? zeroPage
      ? "zeroPage"
      : allHelper
        ? "scratch"
        : "sfa"
    : interval.kind === "stub"
      ? "code"
      : interval.kind === "immutable"
        ? "initializedData"
        : interval.kind === "fill"
          ? "padding"
          : interval.kind;
  const alignment = isStorage
    ? Math.max(
        1,
        ...selectedHomes.flatMap((home, index) =>
          home.address === interval.start ? [selectedRequests[index]!.alignment] : [],
        ),
      )
    : interval.kind === "asset"
      ? 64
      : 1;
  return Object.freeze({
    id: interval.id,
    addressSpaceId: "cpu16",
    start: interval.start,
    end: interval.end + 1,
    size,
    owner:
      ownerOverride ??
      (isAsset
        ? Object.freeze({ kind: "asset", id: evidenceAssetId })
        : isStorage
          ? Object.freeze({ kind: allHelper ? "helper" : "function", id: storageOwner })
          : Object.freeze({ kind: "compiler", id: interval.id })),
    kind: memoryKind,
    origin: isAsset
      ? Object.freeze({ kind: "asset", assetId: evidenceAssetId })
      : Object.freeze({ kind: "generated", identity: interval.id }),
    mutability:
      interval.kind === "global" || interval.kind === "bss" || isStorage ? "mutable" : "immutable",
    alignmentBytes: alignment,
    contiguity: Object.freeze({ kind: "single" }),
    residencyIds: Object.freeze(["resident"]),
    cpuMappings: Object.freeze(["cpu"]),
    resourceClass: zeroPage ? "zeroPage" : "general",
    payloadBytes: isPadding || isStorage ? 0 : size,
    paddingBytes: isPadding ? size : 0,
    reservedBytes: isStorage ? size : 0,
    ...(isAsset
      ? { vic: Object.freeze({ bankId: "vic-bank-0", visibility: Object.freeze(["vic"]) }) }
      : {}),
  });
}

/** Derive the ordered physical memory ledger from final layout and closure records. */
export function deriveMemoryIntervals(
  layout: CompleteC64Layout,
  inventory: StorageInventory,
  certificate: StorageClosureCertificate,
  assetIds: ReadonlyMap<string, string>,
): readonly EvidenceRecord[] {
  const expanded = layout.intervals.flatMap((interval) => {
    if (interval.id.startsWith("global.")) {
      const global = inventory.program.semantic.globals.find(
        ({ id }) => `global.${bindingIdentityKey(id)}` === interval.id,
      );
      if (global === undefined) throw new Error("Final global layout has no semantic owner");
      return [
        physicalInterval(
          interval,
          inventory,
          certificate,
          assetIds,
          Object.freeze({ kind: "symbol", id: globalName(global.id) }),
        ),
      ];
    }
    if (interval.kind !== "code") {
      return [physicalInterval(interval, inventory, certificate, assetIds)];
    }
    const sourceOwners = new Map<string, string>(
      inventory.program.semantic.functions.map(
        (fn) => [`fn.${bindingIdentityKey(fn.id)}`, functionName(fn)] as const,
      ),
    );
    for (const initializer of inventory.program.initializers ?? []) {
      sourceOwners.set(
        `init.${bindingIdentityKey(initializer.binding)}`,
        `initializer::${bindingIdentityKey(initializer.binding)}`,
      );
    }
    const pieces: EvidenceRecord[] = [];
    for (const block of layout.program.startup.blocks) {
      const range = machineBlockRange(block);
      pieces.push(
        physicalInterval(
          Object.freeze({
            id: `code.${block.label}`,
            kind: "code",
            start: range.start,
            end: range.end - 1,
            bytes: null,
          }),
          inventory,
          certificate,
          assetIds,
          Object.freeze({ kind: "platform", id: "startup" }),
        ),
      );
    }
    for (const machine of layout.program.functions) {
      const range = machineFunctionRange(machine);
      const ownerName = sourceOwners.get(machine.id);
      pieces.push(
        physicalInterval(
          Object.freeze({
            id: `code.${machine.id}`,
            kind: "code",
            start: range.start,
            end: range.end - 1,
            bytes: null,
          }),
          inventory,
          certificate,
          assetIds,
          ownerName === undefined
            ? Object.freeze({ kind: "platform", id: machine.id })
            : Object.freeze({ kind: "function", id: ownerName }),
        ),
      );
    }
    pieces.sort((left, right) => (left.start as number) - (right.start as number));
    let cursor = interval.start;
    for (const piece of pieces) {
      if (piece.start !== cursor) throw new Error("Final code ranges do not partition layout code");
      cursor = piece.end as number;
    }
    if (cursor !== interval.end + 1) throw new Error("Final code ranges do not cover layout code");
    return pieces;
  });
  return Object.freeze(
    expanded.sort((left, right) => {
      const leftOwner = left.owner as EvidenceRecord;
      const rightOwner = right.owner as EvidenceRecord;
      return (
        compareText(String(left.addressSpaceId), String(right.addressSpaceId)) ||
        compareText(String(left.bankId ?? ""), String(right.bankId ?? "")) ||
        (left.start as number) - (right.start as number) ||
        (left.end as number) - (right.end as number) ||
        compareText(String(left.kind), String(right.kind)) ||
        compareText(String(leftOwner.kind), String(rightOwner.kind)) ||
        compareText(String(leftOwner.id), String(rightOwner.id)) ||
        compareText(String(left.id), String(right.id))
      );
    }),
  );
}

/** Hash the exact final function/helper SFA projection required by the memory schema. */
export function sfaClosureHash(intervals: readonly EvidenceRecord[]): string {
  return canonicalEvidenceHash(
    intervals
      .filter((interval) => {
        const owner = interval.owner as EvidenceRecord;
        return (
          ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)) &&
          ["function", "helper"].includes(String(owner.kind))
        );
      })
      .map((interval) => {
        const projected: Record<string, unknown> = {
          id: interval.id,
          addressSpaceId: interval.addressSpaceId,
          start: interval.start,
          end: interval.end,
          owner: interval.owner,
          kind: interval.kind,
          resourceClass: interval.resourceClass,
          residencyIds: interval.residencyIds,
        };
        if (interval.bankId !== undefined) projected.bankId = interval.bankId;
        return projected;
      }),
  );
}
