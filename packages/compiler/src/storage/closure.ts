import { createHash } from "node:crypto";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { allocateStorage } from "./allocate.js";
import { buildInterference } from "./interference.js";
import type {
  FunctionResultLocation,
  HelperCallDemand,
  InterferenceEdge,
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
    request.binding === null ? null : bindingIdentityKey(request.binding),
    request.value,
    request.type,
    request.bytes,
    request.alignment,
    request.region,
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
  return JSON.stringify([bindingIdentityKey(result.function), result.location]);
}

/** Render one selected helper call for deterministic ordering and validation. */
function helperFingerprint(helper: HelperCallDemand): string {
  return JSON.stringify([
    helper.id,
    bindingIdentityKey(helper.caller),
    helper.liveRequestIds,
    helper.helperRequestIds,
    helper.stackBytes,
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

interface HardwareStackRoute {
  /** Return-address and helper bytes retained on this program route. */
  readonly bytes: number;
  /** Stable execution identities from the selected root to its deepest point. */
  readonly route: readonly string[];
}

/** Select the larger stack route, using its stable identity to break equal-cost ties. */
function deeperStackRoute(left: HardwareStackRoute, right: HardwareStackRoute): HardwareStackRoute {
  if (left.bytes !== right.bytes) return left.bytes > right.bytes ? left : right;
  return compareText(JSON.stringify(left.route), JSON.stringify(right.route)) <= 0 ? left : right;
}

/** Compute the deepest reachable direct-call chain and retain the exact winning route. */
function hardwareCallRoute(
  inventory: StorageInventory,
  helperCalls: readonly HelperCallDemand[],
): HardwareStackRoute {
  const graph = new Map(
    inventory.program.callGraph.map(
      (entry) =>
        [bindingIdentityKey(entry.function), entry.callees.map(bindingIdentityKey)] as const,
    ),
  );
  const helperStackByCaller = new Map<string, number>();
  for (const helper of helperCalls) {
    const caller = bindingIdentityKey(helper.caller);
    helperStackByCaller.set(
      caller,
      Math.max(helperStackByCaller.get(caller) ?? 0, helper.stackBytes),
    );
  }
  const helperByCaller = new Map<string, HelperCallDemand>();
  for (const helper of helperCalls) {
    const caller = bindingIdentityKey(helper.caller);
    const previous = helperByCaller.get(caller);
    if (
      previous === undefined ||
      helper.stackBytes > previous.stackBytes ||
      (helper.stackBytes === previous.stackBytes && compareText(helper.id, previous.id) < 0)
    ) {
      helperByCaller.set(caller, helper);
    }
  }
  const memo = new Map<string, HardwareStackRoute>();
  const active = new Set<string>();
  const depth = (functionKey: string): HardwareStackRoute => {
    const known = memo.get(functionKey);
    if (known !== undefined) return known;
    if (active.has(functionKey)) {
      return Object.freeze({
        bytes: Number.POSITIVE_INFINITY,
        route: Object.freeze([functionKey]),
      });
    }
    active.add(functionKey);
    const helper = helperByCaller.get(functionKey);
    let functionDepth: HardwareStackRoute = Object.freeze({
      bytes: helperStackByCaller.get(functionKey) ?? 0,
      route: Object.freeze(
        helper === undefined ? [functionKey] : [functionKey, `helper:${helper.id}`],
      ),
    });
    for (const callee of graph.get(functionKey) ?? []) {
      const calleeDepth = depth(callee);
      const candidate = Object.freeze({
        bytes:
          calleeDepth.bytes === Number.POSITIVE_INFINITY
            ? calleeDepth.bytes
            : calleeDepth.bytes + 2,
        route: Object.freeze([functionKey, ...calleeDepth.route]),
      });
      functionDepth = deeperStackRoute(functionDepth, candidate);
    }
    active.delete(functionKey);
    memo.set(functionKey, functionDepth);
    return functionDepth;
  };

  let deepest: HardwareStackRoute = Object.freeze({ bytes: 0, route: Object.freeze(["main"]) });
  for (const root of inventory.program.roots) {
    if (root.kind === "main") {
      deepest = deeperStackRoute(deepest, depth(bindingIdentityKey(root.function)));
      continue;
    }
    if (root.kind === "initializer") {
      const key = bindingIdentityKey(root.binding);
      const helper = helperByCaller.get(key);
      let initializerDepth: HardwareStackRoute = Object.freeze({
        bytes: 2 + (helperStackByCaller.get(key) ?? 0),
        route: Object.freeze(
          helper === undefined
            ? ["startup", `initializer:${key}`]
            : ["startup", `initializer:${key}`, `helper:${helper.id}`],
        ),
      });
      const initializer = (inventory.program.initializers ?? []).find(
        ({ binding }) => bindingIdentityKey(binding) === key,
      );
      for (const callee of initializer?.callees ?? []) {
        const calleeDepth = depth(bindingIdentityKey(callee));
        initializerDepth = deeperStackRoute(
          initializerDepth,
          Object.freeze({
            bytes:
              calleeDepth.bytes === Number.POSITIVE_INFINITY
                ? calleeDepth.bytes
                : calleeDepth.bytes + 4,
            route: Object.freeze(["startup", `initializer:${key}`, ...calleeDepth.route]),
          }),
        );
      }
      deepest = deeperStackRoute(deepest, initializerDepth);
    }
  }
  return deepest;
}

/** Return the proved hardware-stack split, or null when it exceeds the selected capacity. */
function hardwareStackPeak(
  inventory: StorageInventory,
  profile: StorageProfile,
  helperCalls: readonly HelperCallDemand[],
): {
  readonly total: number;
  readonly program: number;
  readonly system: number;
  readonly route: readonly string[];
} | null {
  const call = hardwareCallRoute(inventory, helperCalls);
  if (!Number.isFinite(call.bytes)) return null;
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
  const program = deeperStackRoute(
    call,
    Object.freeze({ bytes: startup, route: Object.freeze(["startup"]) }),
  );
  const system = profile.interruptStackBytes ?? 0;
  const total = program.bytes + system;
  const result = Object.freeze({ total, program: program.bytes, system, route: program.route });
  if (profile.hardwareStackCapacity === undefined) return result;
  const available = profile.hardwareStackCapacity - (profile.hardwareStackReserve ?? 0);
  return total <= available ? result : null;
}

/** Build the provisional closure proof for one stable inventory and placement. */
function certificate(
  inventory: StorageInventory,
  placement: StoragePlacement,
  interference: readonly InterferenceEdge[],
  profile: StorageProfile,
  stackPeak: NonNullable<ReturnType<typeof hardwareStackPeak>>,
  helperCalls: readonly HelperCallDemand[],
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
function validBinder(binder: StorageBinder): boolean {
  const candidateIds = new Set(binder.candidateRequestIds);
  const helperIds = new Set(binder.helperCalls.map(({ id }) => id));
  if (
    candidateIds.size !== binder.candidateRequestIds.length ||
    helperIds.size !== binder.helperCalls.length ||
    binder.candidateRequestIds.some((id) => id.length === 0)
  ) {
    return false;
  }
  return binder.helperCalls.every(
    (helper) =>
      helper.id.length > 0 &&
      Number.isInteger(helper.stackBytes) &&
      helper.stackBytes >= 0 &&
      new Set(helper.liveRequestIds).size === helper.liveRequestIds.length &&
      new Set(helper.helperRequestIds).size === helper.helperRequestIds.length &&
      helper.liveRequestIds.every((id) => id.length > 0) &&
      helper.helperRequestIds.every((id) => id.length > 0),
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
  if (!validBinder(binder)) return Object.freeze({ kind: "error", reason: "nonconvergent" });
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
    const interference = buildInterference(inventory, helperCalls);
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
    const stackPeak = hardwareStackPeak(inventory, profile, helperCalls);
    if (stackPeak === null) return Object.freeze({ kind: "error", reason: "stack" });
    return Object.freeze({
      kind: "complete",
      inventory,
      placement: allocation.placement,
      certificate: certificate(
        inventory,
        allocation.placement,
        interference,
        profile,
        stackPeak,
        helperCalls,
      ),
    });
  }

  return Object.freeze({ kind: "error", reason: "nonconvergent" });
}
