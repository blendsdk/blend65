import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type {
  InterferenceEdge,
  StorageAllocationResult,
  StorageHome,
  StorageInventory,
  StorageProfile,
  StorageRange,
  StorageRequest,
} from "./storage-types.js";

/** Compare stable identities without locale-dependent collation. */
function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

/** Return the deterministic allocation priority for a region requirement. */
function regionPriority(region: StorageRequest["region"]): number {
  if (region === "zero-page-required") return 0;
  if (region === "zero-page-preferred") return 1;
  return 2;
}

/** Compare requests in the fixed placement order. */
function compareRequests(left: StorageRequest, right: StorageRequest): number {
  return (
    regionPriority(left.region) - regionPriority(right.region) ||
    right.alignment - left.alignment ||
    right.bytes - left.bytes ||
    compareText(bindingIdentityKey(left.owner), bindingIdentityKey(right.owner)) ||
    compareText(left.id, right.id)
  );
}

/** Round an address upward to the requested power-of-two boundary. */
function alignAddress(address: number, alignment: number): number {
  return Math.ceil(address / alignment) * alignment;
}

/** NMOS indirect jumps cannot read a callable word beginning at the last byte of a page. */
function validCallableAddress(request: StorageRequest, address: number): boolean {
  return request.type?.kind !== "function" || request.bytes !== 2 || (address & 0xff) !== 0xff;
}

/** Check whether two inclusive byte intervals overlap. */
function rangesOverlap(
  leftStart: number,
  leftBytes: number,
  rightStart: number,
  rightBytes: number,
) {
  return leftStart <= rightStart + rightBytes - 1 && rightStart <= leftStart + leftBytes - 1;
}

/** Normalize and order profile ranges for deterministic first-fit placement. */
function rangesForRegion(
  ranges: readonly StorageRange[],
  region: StorageHome["region"],
): readonly StorageRange[] {
  const upperBound = region === "zero-page" ? 0xff : 0xffff;
  return Object.freeze(
    ranges
      .map(({ start, end }) => ({ start: Math.max(0, start), end: Math.min(upperBound, end) }))
      .filter(({ start, end }) => Number.isInteger(start) && Number.isInteger(end) && start <= end)
      .sort((left, right) => left.start - right.start || left.end - right.end),
  );
}

/** Return the concrete regions which may satisfy one request. */
function candidateRegions(
  request: StorageRequest,
  profile: StorageProfile,
): readonly {
  readonly name: StorageHome["region"];
  readonly ranges: readonly StorageRange[];
}[] {
  if (request.region === "zero-page-required") {
    return [{ name: "zero-page", ranges: rangesForRegion(profile.zeroPage, "zero-page") }];
  }
  if (request.region === "zero-page-preferred") {
    return [
      { name: "zero-page", ranges: rangesForRegion(profile.zeroPage, "zero-page") },
      { name: "ram", ranges: rangesForRegion(profile.ram, "ram") },
    ];
  }
  return [{ name: "ram", ranges: rangesForRegion(profile.ram, "ram") }];
}

/** Build a fast set of canonical interference pairs. */
function interferenceKeys(edges: readonly InterferenceEdge[]): ReadonlySet<string> {
  return new Set(edges.map(({ left, right }) => `${left}\u0000${right}`));
}

/** Check whether two request identities have an interference edge. */
function interfere(edges: ReadonlySet<string>, left: string, right: string): boolean {
  const pair = compareText(left, right) <= 0 ? `${left}\u0000${right}` : `${right}\u0000${left}`;
  return edges.has(pair);
}

/** Find the first legal address for one request in a concrete region. */
function findAddress(
  request: StorageRequest,
  region: StorageHome["region"],
  ranges: readonly StorageRange[],
  homes: readonly StorageHome[],
  edges: ReadonlySet<string>,
): number | null {
  for (const range of ranges) {
    let address = alignAddress(range.start, request.alignment);
    while (address <= range.end && address + request.bytes - 1 <= range.end) {
      // NMOS JMP (addr) reads its high byte from the start of the same page when
      // addr ends in $ff. A callable word must therefore never begin there.
      if (!validCallableAddress(request, address)) {
        address = alignAddress(address + 1, request.alignment);
        continue;
      }
      const blocked = placementBlocked(request, address, region, homes, edges);
      if (!blocked) return address;
      address = alignAddress(address + 1, request.alignment);
    }
  }
  return null;
}

/** Check whether an address overlaps an already placed interfering request. */
function placementBlocked(
  request: StorageRequest,
  address: number,
  region: StorageHome["region"],
  homes: readonly StorageHome[],
  edges: ReadonlySet<string>,
): boolean {
  return homes.some(
    (home) =>
      home.region === region &&
      interfere(edges, request.id, home.requestId) &&
      rangesOverlap(address, request.bytes, home.address, home.bytes),
  );
}

/**
 * Exhaust the finite address choices only after first-fit fails.
 *
 * The fallback prevents a greedy early choice from becoming a false resource error. It retains
 * the same request and address order, so the first complete placement is deterministic.
 */
function placeExactly(
  requests: readonly StorageRequest[],
  profile: StorageProfile,
  edges: ReadonlySet<string>,
  index = 0,
  homes: readonly StorageHome[] = [],
): readonly StorageHome[] | null {
  if (index === requests.length) return homes;
  const request = requests[index]!;
  const visited = new Set<string>();
  for (const candidate of candidateRegions(request, profile)) {
    for (const range of candidate.ranges) {
      let address = alignAddress(range.start, request.alignment);
      while (address <= range.end && address + request.bytes - 1 <= range.end) {
        const key = `${candidate.name}:${address}`;
        if (
          !visited.has(key) &&
          validCallableAddress(request, address) &&
          !placementBlocked(request, address, candidate.name, homes, edges)
        ) {
          visited.add(key);
          const home = Object.freeze({
            requestId: request.id,
            address,
            bytes: request.bytes,
            region: candidate.name,
          });
          const complete = placeExactly(requests, profile, edges, index + 1, [...homes, home]);
          if (complete !== null) return complete;
        }
        address = alignAddress(address + 1, request.alignment);
      }
    }
  }
  return null;
}

/**
 * Assign every request a deterministic static home, overlaying only non-interfering requests.
 *
 * Resource failure returns no partial placement. Zero-page pairs are bounded by the selected
 * zero-page windows, so a two-byte request can use `$fe-$ff` but can never wrap through `$00`.
 */
export function allocateStorage(
  inventory: StorageInventory,
  interference: readonly InterferenceEdge[],
  profile: StorageProfile,
): StorageAllocationResult {
  const homes: StorageHome[] = [];
  const edges = interferenceKeys(interference);
  const requests = [...inventory.requests].sort(compareRequests);
  let firstFailure: string | null = null;

  const invalid = requests.find(
    (request) =>
      !Number.isInteger(request.bytes) ||
      request.bytes < 0 ||
      !Number.isInteger(request.alignment) ||
      request.alignment <= 0 ||
      (request.alignment & (request.alignment - 1)) !== 0,
  );
  if (invalid !== undefined) {
    return Object.freeze({ kind: "error", reason: "resource", requestId: invalid.id });
  }

  for (const request of requests) {
    let selected: StorageHome | null = null;
    for (const candidate of candidateRegions(request, profile)) {
      const address = findAddress(request, candidate.name, candidate.ranges, homes, edges);
      if (address === null) continue;
      selected = Object.freeze({
        requestId: request.id,
        address,
        bytes: request.bytes,
        region: candidate.name,
      });
      break;
    }
    if (selected === null) {
      firstFailure = request.id;
      break;
    }
    homes.push(selected);
  }

  if (firstFailure !== null) {
    const exact = placeExactly(requests, profile, edges);
    if (exact === null) {
      return Object.freeze({ kind: "error", reason: "resource", requestId: firstFailure });
    }
    homes.splice(0, homes.length, ...exact);
  }

  homes.sort((left, right) => compareText(left.requestId, right.requestId));
  return Object.freeze({
    kind: "complete",
    placement: Object.freeze({ homes: Object.freeze(homes) }),
  });
}
