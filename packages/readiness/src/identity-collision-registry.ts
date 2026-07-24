import {
  copyUint8Array,
  hashCanonicalIdentity,
  isSha256Digest,
  uint8ArrayByteLength,
} from "./canonical-identity.js";
import type {
  IdentityDiagnostic,
  IdentityRegistryResult,
  IdentityResult,
} from "./case-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";

/** Injectable 32-byte digest primitive used to prove collision handling. */
export type IdentityDigest = (preimage: Uint8Array) => Uint8Array;

const IDENTITY_COLLISION_REGISTRY_BRAND: unique symbol = Symbol("identity-collision-registry");

/** Opaque collision-retention capability produced only by the registry factory. */
export interface IdentityCollisionRegistry {
  /** Compile-time marker paired with module-private runtime state. */
  readonly [IDENTITY_COLLISION_REGISTRY_BRAND]: true;
  /** Retains one digest/preimage pair or reports collision and lifecycle failures as data. */
  readonly register: (digest: Sha256Digest, preimage: Uint8Array) => IdentityRegistryResult;
  /** Releases all retained preimages and permanently closes the registry. */
  readonly dispose: () => void;
}

/** Fixed memory bounds applied by every identity collision registry. */
export interface IdentityCollisionRegistryLimits {
  /** Maximum number of distinct digest/preimage pairs retained by one registry. */
  readonly maxEntries: number;
  /** Maximum aggregate canonical preimage bytes retained by one registry. */
  readonly maxPreimageBytes: number;
}

interface IdentityCollisionState {
  readonly digest: IdentityDigest;
  readonly preimages: Map<Sha256Digest, Uint8Array>;
  retainedBytes: number;
  disposed: boolean;
}

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const COLLISION_STATES = new WeakMap<object, IdentityCollisionState>();

/** Resource policy for in-memory collision proof retention. */
export const IDENTITY_COLLISION_REGISTRY_LIMITS: IdentityCollisionRegistryLimits = Object.freeze({
  maxEntries: 4_096,
  maxPreimageBytes: 16_777_216,
});

function diagnostic(
  code: IdentityDiagnostic["code"],
  path: string,
  message: string,
): IdentityDiagnostic {
  return Object.freeze({ code, path, message });
}

function failure(
  code: IdentityDiagnostic["code"],
  path: string,
  message: string,
): IdentityResult<never> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function registryFailure(
  code: IdentityDiagnostic["code"],
  path: string,
  message: string,
): IdentityRegistryResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function identitySuccess(
  identity: Sha256Digest,
  isolatedPreimage: Uint8Array,
): IdentityResult<Sha256Digest> {
  return Object.freeze({
    ok: true,
    identity,
    preimage: isolatedPreimage,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  const leftByteLength = uint8ArrayByteLength(left);
  const rightByteLength = uint8ArrayByteLength(right);
  if (
    leftByteLength === undefined ||
    rightByteLength === undefined ||
    leftByteLength !== rightByteLength
  ) {
    return false;
  }
  for (let index = 0; index < leftByteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function registerPreimage(
  state: IdentityCollisionState,
  digest: Sha256Digest,
  preimage: Uint8Array,
  owned: boolean = false,
): IdentityRegistryResult {
  if (state.disposed) {
    return registryFailure(
      "identity.registry.disposed",
      "/registry",
      "Collision registry has been disposed.",
    );
  }
  const preimageByteLength = uint8ArrayByteLength(preimage);
  if (preimageByteLength === undefined) {
    return registryFailure(
      "identity.input.invalid",
      "/digest",
      "Canonical preimage must be a byte array.",
    );
  }
  const retained = state.preimages.get(digest);
  if (retained !== undefined && !equalBytes(retained, preimage)) {
    return registryFailure(
      "identity.collision",
      "/digest",
      "Digest is already registered for a different canonical preimage.",
    );
  }
  if (retained !== undefined) {
    return Object.freeze({ ok: true, diagnostics: EMPTY_DIAGNOSTICS });
  }
  if (state.preimages.size >= IDENTITY_COLLISION_REGISTRY_LIMITS.maxEntries) {
    return registryFailure(
      "identity.registry.limit",
      "/registry",
      `Collision registry exceeds ${IDENTITY_COLLISION_REGISTRY_LIMITS.maxEntries} entries.`,
    );
  }
  const nextBytes = state.retainedBytes + preimageByteLength;
  if (
    !Number.isSafeInteger(nextBytes) ||
    nextBytes > IDENTITY_COLLISION_REGISTRY_LIMITS.maxPreimageBytes
  ) {
    return registryFailure(
      "identity.registry.limit",
      "/registry",
      `Collision registry exceeds ${IDENTITY_COLLISION_REGISTRY_LIMITS.maxPreimageBytes} retained bytes.`,
    );
  }
  const retainedPreimage = owned ? preimage : copyUint8Array(preimage, preimageByteLength);
  if (retainedPreimage === undefined) {
    return registryFailure(
      "identity.input.invalid",
      "/digest",
      "Canonical preimage could not be retained safely.",
    );
  }
  state.preimages.set(digest, retainedPreimage);
  state.retainedBytes = nextBytes;
  return Object.freeze({ ok: true, diagnostics: EMPTY_DIAGNOSTICS });
}

/**
 * Derives a canonical digest and proves its preimage against an optional collision registry.
 *
 * @param preimage Newly materialized canonical identity bytes.
 * @param registry Optional factory-produced collision registry.
 * @returns The digest and isolated preimage, or deterministic registry diagnostics.
 *
 * @example
 * ```ts
 * const result = deriveIdentityDigest(preimage, registry);
 * ```
 */
export function deriveIdentityDigest(
  preimage: Uint8Array,
  registry: IdentityCollisionRegistry | undefined,
): IdentityResult<Sha256Digest> {
  const preimageByteLength = uint8ArrayByteLength(preimage);
  if (preimageByteLength === undefined) {
    return failure("identity.input.invalid", "/digest", "Identity preimage must be a byte array.");
  }
  if (preimageByteLength > IDENTITY_COLLISION_REGISTRY_LIMITS.maxPreimageBytes) {
    return failure(
      "identity.registry.limit",
      "/registry",
      `Collision registry rejects preimages above ${IDENTITY_COLLISION_REGISTRY_LIMITS.maxPreimageBytes} bytes.`,
    );
  }
  try {
    const isolatedPreimage = copyUint8Array(preimage, preimageByteLength);
    if (isolatedPreimage === undefined) {
      return failure(
        "identity.input.invalid",
        "/digest",
        "Identity preimage could not be copied safely.",
      );
    }
    if (registry === undefined) {
      return identitySuccess(hashCanonicalIdentity(isolatedPreimage), isolatedPreimage);
    }
    const state = COLLISION_STATES.get(registry);
    if (state === undefined) {
      return failure(
        "identity.input.invalid",
        "/digest",
        "Collision registry was not produced by the registry factory.",
      );
    }
    if (state.disposed) {
      return failure(
        "identity.registry.disposed",
        "/registry",
        "Collision registry has been disposed.",
      );
    }
    const digestInput = copyUint8Array(preimage, preimageByteLength);
    if (digestInput === undefined) {
      return failure(
        "identity.input.invalid",
        "/digest",
        "Identity preimage could not be copied safely.",
      );
    }
    const digestBytes = copyUint8Array(state.digest(digestInput), 32);
    if (digestBytes === undefined) {
      return failure(
        "identity.input.invalid",
        "/digest",
        "Identity digest must return exactly 32 bytes.",
      );
    }
    const digest: Sha256Digest = `sha256:${Array.from(digestBytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")}`;
    const registered = registerPreimage(state, digest, preimage);
    if (!registered.ok) return registered;
    return identitySuccess(digest, isolatedPreimage);
  } catch {
    return failure("identity.input.invalid", "/digest", "Identity digest could not be computed.");
  }
}

function defaultDigest(preimage: Uint8Array): Uint8Array {
  const digest = hashCanonicalIdentity(preimage).slice("sha256:".length);
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    const pair = digest.slice(index * 2, index * 2 + 2);
    bytes[index] = Number.parseInt(pair, 16);
  }
  return bytes;
}

/**
 * Creates an opaque bounded collision registry that retains canonical preimages defensively.
 *
 * @param digest Optional 32-byte digest primitive for collision conformance tests.
 * @returns A non-forgeable per-campaign collision-retention capability.
 *
 * @example
 * ```ts
 * const registry = createIdentityCollisionRegistry();
 * ```
 */
export function createIdentityCollisionRegistry(
  digest: IdentityDigest = defaultDigest,
): IdentityCollisionRegistry {
  const state: IdentityCollisionState = {
    digest,
    preimages: new Map<Sha256Digest, Uint8Array>(),
    retainedBytes: 0,
    disposed: false,
  };
  const registryValue: IdentityCollisionRegistry = {
    [IDENTITY_COLLISION_REGISTRY_BRAND]: true,
    register: (registeredDigest: Sha256Digest, preimage: Uint8Array): IdentityRegistryResult => {
      try {
        if (state.disposed) {
          return registryFailure(
            "identity.registry.disposed",
            "/registry",
            "Collision registry has been disposed.",
          );
        }
        if (!isSha256Digest(registeredDigest)) {
          return registryFailure(
            "identity.input.invalid",
            "/digest",
            "Registered digest is not canonical.",
          );
        }
        const byteLength = uint8ArrayByteLength(preimage);
        if (byteLength === undefined) {
          return registryFailure(
            "identity.input.invalid",
            "/digest",
            "Registered preimage must be a byte array.",
          );
        }
        if (byteLength > IDENTITY_COLLISION_REGISTRY_LIMITS.maxPreimageBytes) {
          return registryFailure(
            "identity.registry.limit",
            "/registry",
            `Collision registry rejects preimages above ${IDENTITY_COLLISION_REGISTRY_LIMITS.maxPreimageBytes} bytes.`,
          );
        }
        if (
          !state.preimages.has(registeredDigest) &&
          state.retainedBytes + byteLength > IDENTITY_COLLISION_REGISTRY_LIMITS.maxPreimageBytes
        ) {
          return registryFailure(
            "identity.registry.limit",
            "/registry",
            `Collision registry exceeds ${IDENTITY_COLLISION_REGISTRY_LIMITS.maxPreimageBytes} retained bytes.`,
          );
        }
        const copiedPreimage = copyUint8Array(preimage, byteLength);
        if (copiedPreimage === undefined) {
          return registryFailure(
            "identity.input.invalid",
            "/digest",
            "Registered preimage could not be copied safely.",
          );
        }
        return registerPreimage(state, registeredDigest, copiedPreimage, true);
      } catch {
        return registryFailure(
          "identity.input.invalid",
          "/digest",
          "Registered identity could not be inspected safely.",
        );
      }
    },
    dispose: (): void => {
      state.preimages.clear();
      state.retainedBytes = 0;
      state.disposed = true;
    },
  };
  const registry = Object.freeze(registryValue);
  COLLISION_STATES.set(registry, state);
  return registry;
}
