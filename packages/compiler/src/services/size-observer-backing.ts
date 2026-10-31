import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import { bindingLabel } from "../machine/lower-control.js";
import type { StorageHome, StorageRequest, StorageRange } from "../storage/storage-types.js";
import type { FinalObserverInput } from "./size-observers.js";

/** A complete declared aggregate, never the two-byte storage containing its address. */
export interface ObjectRoot {
  /** Declared storage identity of the complete object. */
  readonly binding: BindingId;
  /** Function owning private bytes, or null for resident platform data. */
  readonly owner: BindingId | null;
  /** Packed source type and exact full extent. */
  readonly type: Extract<SemanticType, { readonly kind: "array" | "struct" }>;
}

/** Complete backing evidence produced by one actual final layout. */
export interface Backing {
  /** Complete inclusive object extent in this particular final layout. */
  readonly range: StorageRange;
  /** Real private request; globals deliberately have no SFA request. */
  readonly request: StorageRequest | null;
}

/**
 * Look up actual complete data extents, never an estimate or an address-bearing pointer.
 * The caller owns separate caches for each layout and must retain all source, lifetime,
 * interference and physical observer checks. This lookup alone discharges no obligation.
 * @param root Complete source object whose identity has already been resolved.
 * @param shared One actual final construction, not a mixture of reference and candidate facts.
 * @param homes Request homes from that same construction's certificate.
 * @returns Its actual complete backing, or null when that representation is not established.
 * @example const data = findNamedObjectBacking(root, shared, homes);
 */
export function findNamedObjectBacking(
  root: ObjectRoot,
  shared: FinalObserverInput["candidate"]["shared"],
  homes: ReadonlyMap<string, StorageHome>,
): Backing | null {
  const key = bindingIdentityKey(root.binding);
  let result: Backing | null = null;
  if (root.owner === null) {
    // This is the producer's canonical binding identity, not a parsed request
    // name. Both the real data object and platform-owned interval must exist.
    const id = bindingLabel("global", root.binding);
    const data = shared.layout.program.data.filter((object) => object.id === id);
    const intervals = shared.layout.intervals.filter(
      (interval) => interval.id === id && ["global", "bss", "immutable"].includes(interval.kind),
    );
    if (
      data.length === 1 &&
      intervals.length === 1 &&
      data[0]!.bytes.length === root.type.size &&
      intervals[0]!.end - intervals[0]!.start + 1 === root.type.size
    )
      result = { range: intervals[0]!, request: null };
  } else {
    const requests = shared.certificate.inventory.requests.filter(
      (request) =>
        request.binding !== null &&
        bindingIdentityKey(request.binding) === key &&
        bindingIdentityKey(request.owner) === bindingIdentityKey(root.owner!) &&
        request.storageClass === "local" &&
        (request.domain === undefined || request.domain === "main") &&
        request.activationRoot === undefined,
    );
    const bodies = shared.layout.program.functions.filter(
      (fn) =>
        fn.sourceFunction !== undefined &&
        bindingIdentityKey(fn.sourceFunction) === bindingIdentityKey(root.owner!) &&
        fn.executionContext?.domain === "main" &&
        fn.executionContext.activationRoot === undefined,
    );
    const request = requests.length === 1 ? requests[0] : undefined;
    const home = request === undefined ? undefined : homes.get(request.id);
    if (
      bodies.length === 1 &&
      request !== undefined &&
      request.type !== null &&
      semanticTypesEqual(request.type, root.type) &&
      request.bytes === root.type.size &&
      home?.bytes === root.type.size
    )
      result = { range: { start: home.address, end: home.address + home.bytes - 1 }, request };
  }
  return result;
}
