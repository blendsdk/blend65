import { createHash } from "node:crypto";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { interruptExecutionKey } from "../semantic/interrupt-context-facts.js";
import { allocateStorage } from "./allocate.js";
import { deeperStackRoute, hardwareCallRoutes } from "./call-stack.js";
import { buildInterference } from "./interference.js";
import { simultaneousIRQStackPeak } from "./irq-stack.js";
import type {
  FunctionResultLocation,
  HelperCallDemand,
  InterferenceEdge,
  NmiEntryStackPeak,
  ResourceTotals,
  StorageBinder,
  StorageClosureCertificate,
  StorageClosureResult,
  StorageDiscovery,
  StorageHome,
  StorageInventory,
  StoragePlacement,
  StorageProfile,
  StorageRequest,
} from "./storage-types.js";

/** Compare stable identities without locale-dependent collation. */
function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

/** Render the source facts of one storage request for equality and hashing. */
function requestFingerprint(request: StorageRequest): string {
  return JSON.stringify([
    request.id,
    request.storageClass,
    bindingIdentityKey(request.owner),
    request.domain ?? null,
    request.activationRoot ?? null,
    request.binding === null ? null : bindingIdentityKey(request.binding),
    request.value,
    request.type,
    request.bytes,
    request.alignment,
    request.region,
    request.pageSafeIndirect ?? false,
    request.persistent ?? false,
    [
      bindingIdentityKey(request.lifetime.function),
      request.lifetime.value,
      [request.lifetime.definition.block, request.lifetime.definition.operation],
      request.lifetime.liveAt.map(({ block, operation }) => [block, operation]),
      request.lifetime.callsCrossed.map(({ sourceId, start, end }) => [sourceId, start, end]),
    ],
    request.source === null
      ? null
      : [request.source.sourceId, request.source.start, request.source.end],
    request.reason,
  ]);
}

/** Render one ABI result decision for deterministic certificate identity. */
function resultFingerprint(result: FunctionResultLocation): string {
  return JSON.stringify([
    bindingIdentityKey(result.function),
    result.domain ?? null,
    result.activationRoot ?? null,
    result.location,
  ]);
}

/** Render one selected helper call for deterministic ordering and validation. */
function helperFingerprint(helper: HelperCallDemand): string {
  return JSON.stringify([
    helper.id,
    bindingIdentityKey(helper.caller),
    helper.liveRequestIds,
    helper.helperRequestIds,
    helper.stackBytes,
    helper.source ?? null,
  ]);
}

/** Compute a stable SHA-256 identity for already-canonical text records. */
function hashRecords(records: readonly string[]): string {
  const hash = createHash("sha256");
  for (const record of records) {
    hash.update(record.length.toString(10));
    hash.update(":");
    hash.update(record);
    hash.update("\n");
  }
  return hash.digest("hex");
}

/**
 * Compute the certificate identity of one complete ordered storage inventory.
 * @param inventory Semantic and machine-created requests with ABI result facts.
 * @returns Stable SHA-256 inventory identity.
 * @example storageInventoryHash(inventory).length === 64
 */
export function storageInventoryHash(inventory: StorageInventory): string {
  return hashRecords([
    ...inventory.requests.map(requestFingerprint),
    ...inventory.results.map(resultFingerprint),
  ]);
}

/** Count distinct physical bytes occupied by final homes. */
function staticTotals(homes: readonly StorageHome[]): ResourceTotals {
  const bytes = {
    ram: new Set<number>(),
    zeroPage: new Set<number>(),
  };
  for (const home of homes) {
    const region = home.region === "ram" ? bytes.ram : bytes.zeroPage;
    for (let offset = 0; offset < home.bytes; offset += 1) region.add(home.address + offset);
  }
  return Object.freeze({ ram: bytes.ram.size, zeroPage: bytes.zeroPage.size });
}

/** Return the exact maximum weighted clique in one region's interference graph. */
function maximumConcurrentBytes(
  requests: readonly StorageRequest[],
  interference: readonly InterferenceEdge[],
): number {
  const ids = new Set(requests.map(({ id }) => id));
  const adjacent = new Map(requests.map(({ id }) => [id, new Set<string>()] as const));
  for (const edge of interference) {
    if (!ids.has(edge.left) || !ids.has(edge.right)) continue;
    adjacent.get(edge.left)!.add(edge.right);
    adjacent.get(edge.right)!.add(edge.left);
  }
  const weights = new Map(requests.map(({ id, bytes }) => [id, bytes] as const));
  const ordered = requests.map(({ id }) => id).sort(compareText);
  let best = 0;
  const search = (candidates: readonly string[], weight: number): void => {
    best = Math.max(best, weight);
    let remaining = candidates.reduce((sum, id) => sum + (weights.get(id) ?? 0), 0);
    for (let index = 0; index < candidates.length; index += 1) {
      if (weight + remaining <= best) return;
      const id = candidates[index]!;
      const value = weights.get(id) ?? 0;
      const neighbors = adjacent.get(id) ?? new Set<string>();
      const next = candidates.slice(index + 1).filter((candidate) => neighbors.has(candidate));
      search(next, weight + value);
      remaining -= value;
    }
  };
  search(ordered, 0);
  return best;
}

/** Compute maximum simultaneous request bytes in each selected address region. */
function peakTotals(
  requests: readonly StorageRequest[],
  homes: readonly StorageHome[],
  interference: readonly InterferenceEdge[],
): ResourceTotals {
  const homeByRequest = new Map(homes.map((home) => [home.requestId, home] as const));
  const inRegion = (region: StorageHome["region"]) =>
    requests.filter((request) => homeByRequest.get(request.id)?.region === region);
  return Object.freeze({
    ram: maximumConcurrentBytes(inRegion("ram"), interference),
    zeroPage: maximumConcurrentBytes(inRegion("zero-page"), interference),
  });
}

/** Return the proved hardware-stack split, or null when it exceeds the selected capacity. */
function hardwareStackPeak(
  inventory: StorageInventory,
  profile: StorageProfile,
  helperCalls: readonly HelperCallDemand[],
  instructionSites: StorageBinder["instructionSites"],
  selectedPeak?: ReturnType<typeof simultaneousIRQStackPeak>,
): {
  readonly total: number;
  readonly program: number;
  readonly system: number;
  readonly route: readonly string[];
} | null {
  if (
    (profile.hardwareStackCapacity !== undefined &&
      (!Number.isInteger(profile.hardwareStackCapacity) || profile.hardwareStackCapacity < 0)) ||
    (profile.hardwareStackReserve !== undefined &&
      (!Number.isInteger(profile.hardwareStackReserve) || profile.hardwareStackReserve < 0)) ||
    (profile.interruptStackBytes !== undefined &&
      (!Number.isInteger(profile.interruptStackBytes) || profile.interruptStackBytes < 0)) ||
    (profile.startupStackBytes !== undefined &&
      (!Number.isInteger(profile.startupStackBytes) || profile.startupStackBytes < 0))
  ) {
    return null;
  }
  const startup = profile.startupStackBytes ?? 0;
  if (
    (inventory.program.interruptRoutes?.length ?? 0) > 0 &&
    profile.interruptStackBytes === undefined
  ) {
    const peak =
      selectedPeak ??
      simultaneousIRQStackPeak(
        inventory.program,
        helperCalls,
        startup,
        instructionSites,
        inventory.requests,
      );
    return { ...peak, total: peak.program + peak.system };
  }
  const routes = hardwareCallRoutes(inventory, helperCalls);
  if (!Number.isFinite(routes.program.bytes) || !Number.isFinite(routes.interrupt.bytes))
    return null;
  const program = deeperStackRoute(
    routes.program,
    Object.freeze({ bytes: startup, route: Object.freeze(["startup"]) }),
  );
  const system = Math.max(routes.interrupt.bytes, profile.interruptStackBytes ?? 0);
  const total = program.bytes + system;
  const result = Object.freeze({
    total,
    program: program.bytes,
    system,
    route: Object.freeze([...program.route, ...routes.interrupt.route]),
  });
  return result;
}

/** Build the provisional closure proof for one stable inventory and placement. */
function certificate(
  inventory: StorageInventory,
  placement: StoragePlacement,
  interference: readonly InterferenceEdge[],
  profile: StorageProfile,
  stackPeak: NonNullable<ReturnType<typeof hardwareStackPeak>>,
  helperCalls: readonly HelperCallDemand[],
  nmiEntries: readonly NmiEntryStackPeak[],
): StorageClosureCertificate {
  return Object.freeze({
    inventoryHash: storageInventoryHash(inventory),
    graphHash: hashRecords([
      ...interference.map(({ left, right, reason }) => JSON.stringify([left, right, reason])),
      ...helperCalls.map(helperFingerprint),
    ]),
    profileId: profile.profileId ?? "unspecified",
    homes: placement.homes,
    interference,
    helperCalls,
    staticBytes: staticTotals(placement.homes),
    peakBytes: peakTotals(inventory.requests, placement.homes, interference),
    hardwareStackPeak: stackPeak.total,
    hardwareStackProgramPeak: stackPeak.program,
    hardwareStackSystemPeak: stackPeak.system,
    hardwareStackRoute: stackPeak.route,
    ...(nmiEntries.length === 0 ? {} : { nmiEntryPeaks: nmiEntries }),
    closed: true,
  });
}

/** Normalize the stable no-addition callback and the finite machine binder. */
function binderFacts(discover: StorageDiscovery | StorageBinder): StorageBinder {
  if (typeof discover !== "function") return discover;
  return Object.freeze({
    candidateRequestIds: Object.freeze([]),
    helperCalls: Object.freeze([]),
    discover,
  });
}

/** Validate the finite binder declaration before executing its callback. */
function validBinder(binder: StorageBinder, inventory: StorageInventory): boolean {
  const candidateIds = new Set(binder.candidateRequestIds);
  const helperIds = new Set(binder.helperCalls.map(({ id }) => id));
  if (
    candidateIds.size !== binder.candidateRequestIds.length ||
    helperIds.size !== binder.helperCalls.length ||
    binder.candidateRequestIds.some((id) => id.length === 0)
  ) {
    return false;
  }
  const nmiEntries = binder.nmiEntries ?? [];
  const proof = inventory.program.interruptContextAnalysis;
  const validEntries =
    new Set(nmiEntries.map(({ id }) => id)).size === nmiEntries.length &&
    nmiEntries.every(
      (entry) =>
        entry.id.length > 0 &&
        Number.isInteger(entry.entryStackBytes) &&
        entry.entryStackBytes >= 3 &&
        entry.contexts.length > 0 &&
        entry.contexts.every(
          (context) =>
            context.domain === "nmi" &&
            proof?.reached.has(interruptExecutionKey(entry.handler, context)) === true,
        ),
    );
  return (
    validEntries &&
    binder.helperCalls.every(
      (helper) =>
        helper.id.length > 0 &&
        Number.isInteger(helper.stackBytes) &&
        helper.stackBytes >= 0 &&
        new Set(helper.liveRequestIds).size === helper.liveRequestIds.length &&
        new Set(helper.helperRequestIds).size === helper.helperRequestIds.length &&
        helper.liveRequestIds.every((id) => id.length > 0) &&
        helper.helperRequestIds.every((id) => id.length > 0),
    )
  );
}

/** Check that selected helper facts refer only to closed execution and storage identities. */
function helpersReferenceInventory(
  inventory: StorageInventory,
  helperCalls: readonly HelperCallDemand[],
): boolean {
  const requestIds = new Set(inventory.requests.map(({ id }) => id));
  const executionOwners = new Set([
    ...inventory.program.reachableFunctions.map(bindingIdentityKey),
    ...(inventory.program.initializers ?? []).map(({ binding }) => bindingIdentityKey(binding)),
  ]);
  return helperCalls.every(
    (helper) =>
      executionOwners.has(bindingIdentityKey(helper.caller)) &&
      helper.liveRequestIds.every((id) => requestIds.has(id)) &&
      helper.helperRequestIds.every((id) => requestIds.has(id)),
  );
}

/**
 * Reallocate monotonically while target binding discovers finite storage requirements.
 *
 * A request identity may be added once and may then only repeat with exactly the same facts.
 * Changing an existing identity or exhausting the fixed round bound fails without a certificate.
 */
export function closeStorage(
  initial: StorageInventory,
  profile: StorageProfile,
  discover: StorageDiscovery | StorageBinder,
): StorageClosureResult {
  let requests = [...initial.requests].sort((left, right) => compareText(left.id, right.id));
  const binder = binderFacts(discover);
  if (!validBinder(binder, initial))
    return Object.freeze({ kind: "error", reason: "nonconvergent" });
  const candidateIds = new Set(binder.candidateRequestIds);
  const helperCalls = Object.freeze(
    [...binder.helperCalls].sort((left, right) => compareText(left.id, right.id)),
  );

  for (let round = 0; round <= candidateIds.size; round += 1) {
    const inventory = Object.freeze({
      program: initial.program,
      requests: Object.freeze(requests),
      results: initial.results,
    });
    const selectedPeak =
      (inventory.program.interruptRoutes?.length ?? 0) > 0 &&
      profile.interruptStackBytes === undefined
        ? simultaneousIRQStackPeak(
            inventory.program,
            helperCalls,
            profile.startupStackBytes ?? 0,
            binder.instructionSites,
            inventory.requests,
          )
        : undefined;
    const interference = buildInterference(inventory, helperCalls, selectedPeak?.irqOverlap);
    const allocation = allocateStorage(inventory, interference, profile);
    if (allocation.kind === "error") {
      return Object.freeze({
        kind: "error",
        reason: "resource",
        requestId: allocation.requestId,
      });
    }

    const existing = new Map(requests.map((request) => [request.id, request] as const));
    const additions: StorageRequest[] = [];
    for (const discovered of binder.discover(allocation.placement, round)) {
      const known = existing.get(discovered.id);
      if (known !== undefined) {
        if (requestFingerprint(known) !== requestFingerprint(discovered)) {
          return Object.freeze({ kind: "error", reason: "nonconvergent" });
        }
        continue;
      }
      const duplicate = additions.find(({ id }) => id === discovered.id);
      if (duplicate !== undefined) {
        if (requestFingerprint(duplicate) !== requestFingerprint(discovered)) {
          return Object.freeze({ kind: "error", reason: "nonconvergent" });
        }
        continue;
      }
      if (!candidateIds.has(discovered.id)) {
        return Object.freeze({ kind: "error", reason: "nonconvergent" });
      }
      additions.push(discovered);
    }

    if (additions.length > 0) {
      requests = [...requests, ...additions].sort((left, right) => compareText(left.id, right.id));
      continue;
    }

    if (!helpersReferenceInventory(inventory, helperCalls)) {
      return Object.freeze({ kind: "error", reason: "nonconvergent" });
    }
    const stackPeak = hardwareStackPeak(
      inventory,
      profile,
      helperCalls,
      binder.instructionSites,
      selectedPeak,
    );
    if (stackPeak === null) return Object.freeze({ kind: "error", reason: "stack" });
    if (!Number.isFinite(stackPeak.total)) {
      return Object.freeze({
        kind: "error",
        reason: "stack",
        measured: stackPeak.total,
        route: stackPeak.route,
      });
    }
    if (
      profile.hardwareStackCapacity !== undefined &&
      stackPeak.total > profile.hardwareStackCapacity - (profile.hardwareStackReserve ?? 0)
    ) {
      return Object.freeze({
        kind: "error",
        reason: "stack",
        measured: stackPeak.total,
        available: profile.hardwareStackCapacity - (profile.hardwareStackReserve ?? 0),
        route: stackPeak.route,
      });
    }
    const nmiEntries =
      (binder.nmiEntries?.length ?? 0) === 0
        ? []
        : hardwareCallRoutes(inventory, helperCalls, binder.nmiEntries).nmiEntries;
    for (const entry of nmiEntries) {
      const available =
        profile.hardwareStackCapacity === undefined
          ? undefined
          : profile.hardwareStackCapacity - (profile.hardwareStackReserve ?? 0);
      if (!Number.isFinite(entry.bytes) || (available !== undefined && entry.bytes > available)) {
        return Object.freeze({
          kind: "error",
          reason: "stack",
          measured: entry.bytes,
          ...(available === undefined ? {} : { available }),
          route: Object.freeze([`per-entry:generated-nmi`, entry.id, ...entry.route]),
        });
      }
    }
    return Object.freeze({
      kind: "complete",
      inventory,
      placement: allocation.placement,
      ...(selectedPeak?.irqOverlap === undefined ? {} : { irqOverlap: selectedPeak.irqOverlap }),
      certificate: certificate(
        inventory,
        allocation.placement,
        interference,
        profile,
        stackPeak,
        helperCalls,
        nmiEntries,
      ),
    });
  }

  return Object.freeze({ kind: "error", reason: "nonconvergent" });
}
