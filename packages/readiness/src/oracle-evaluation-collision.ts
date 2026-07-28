import { createHash } from "node:crypto";

import { copyUint8Array, isSha256Digest, uint8ArrayByteLength } from "./canonical-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type {
  OracleIdentityResultV1,
  OracleValidationResultV1,
} from "./oracle-evaluation-identity.js";
import type { OracleDiagnostic } from "./oracle-model.js";

/** Digest primitive accepted by the bounded collision registry. */
export type OracleEvaluationDigest = (preimage: Uint8Array) => Uint8Array;

/** Opaque registry that permanently taints a digest after a collision is observed. */
export interface OracleEvaluationCollisionRegistry {
  /**
   * Retains one digest/preimage pair or reports a closed collision failure.
   *
   * @example
   * ```ts
   * registry.register(identity, preimage);
   * ```
   */
  readonly register: (digest: Sha256Digest, preimage: Uint8Array) => OracleValidationResultV1<true>;
  /** Releases retained bytes and permanently closes the registry. */
  readonly dispose: () => void;
}

interface CollisionState {
  readonly digest: OracleEvaluationDigest;
  readonly entries: Map<Sha256Digest, Uint8Array | null>;
  accountedBytes: number;
  disposed: boolean;
}

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const COLLISION_STATES = new WeakMap<object, CollisionState>();
const MAX_ENTRIES = 4_096;
const MAX_RETAINED_BYTES = 16_777_216;

function diagnostic(
  code: OracleDiagnostic["code"],
  path: string,
  message: string,
): OracleDiagnostic {
  return Object.freeze({ code, path, message });
}

function failure<T>(
  code: OracleDiagnostic["code"],
  path: string,
  message: string,
): Extract<OracleValidationResultV1<T>, { readonly ok: false }> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function defaultDigest(preimage: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(preimage).digest());
}

function registerPreimage(
  state: CollisionState,
  digest: Sha256Digest,
  preimage: Uint8Array,
): OracleValidationResultV1<true> {
  if (state.disposed) {
    return failure("oracle.input.invalid", "/registry", "Collision registry has been disposed.");
  }
  const retained = state.entries.get(digest);
  if (retained === null) {
    return failure(
      "oracle.identity.collision",
      "/identity",
      "Digest is no longer authoritative after a canonical collision.",
    );
  }
  if (retained !== undefined) {
    if (equalBytes(retained, preimage)) {
      return Object.freeze({ ok: true, value: true, diagnostics: EMPTY_DIAGNOSTICS });
    }
    state.entries.set(digest, null);
    return failure(
      "oracle.identity.collision",
      "/identity",
      "Digest identifies unequal canonical preimages.",
    );
  }
  if (state.entries.size >= MAX_ENTRIES) {
    return failure("oracle.input.limit", "/registry", "Collision registry entry limit exceeded.");
  }
  const nextBytes = state.accountedBytes + preimage.byteLength;
  if (!Number.isSafeInteger(nextBytes) || nextBytes > MAX_RETAINED_BYTES) {
    return failure("oracle.input.limit", "/registry", "Collision registry byte limit exceeded.");
  }
  const isolated = copyUint8Array(preimage, preimage.byteLength);
  if (isolated === undefined) {
    return failure("oracle.input.invalid", "/preimage", "Canonical preimage is not a byte array.");
  }
  state.entries.set(digest, isolated);
  state.accountedBytes = nextBytes;
  return Object.freeze({ ok: true, value: true, diagnostics: EMPTY_DIAGNOSTICS });
}

/**
 * Creates a bounded per-evaluation collision registry.
 *
 * The optional digest is intended only for deterministic collision conformance. Its
 * return value must be exactly 32 bytes.
 *
 * @param digest Optional isolated digest primitive.
 * @returns Factory-owned collision registry.
 *
 * @example
 * ```ts
 * const registry = createOracleEvaluationCollisionRegistry();
 * ```
 */
export function createOracleEvaluationCollisionRegistry(
  digest: OracleEvaluationDigest = defaultDigest,
): OracleEvaluationCollisionRegistry {
  const state: CollisionState = {
    digest,
    entries: new Map(),
    accountedBytes: 0,
    disposed: false,
  };
  const registry = Object.freeze({
    register: (
      registeredDigest: Sha256Digest,
      preimage: Uint8Array,
    ): OracleValidationResultV1<true> => {
      try {
        if (!isSha256Digest(registeredDigest)) {
          return failure("oracle.input.invalid", "/identity", "Digest spelling is not canonical.");
        }
        const byteLength = uint8ArrayByteLength(preimage);
        if (byteLength === undefined || byteLength > MAX_RETAINED_BYTES) {
          return failure(
            byteLength === undefined ? "oracle.input.invalid" : "oracle.input.limit",
            "/preimage",
            "Canonical preimage is invalid or exceeds the fixed byte limit.",
          );
        }
        return registerPreimage(state, registeredDigest, preimage);
      } catch {
        return failure(
          "oracle.input.invalid",
          "/registry",
          "Collision registry input could not be inspected safely.",
        );
      }
    },
    dispose: (): void => {
      state.entries.clear();
      state.accountedBytes = 0;
      state.disposed = true;
    },
  });
  COLLISION_STATES.set(registry, state);
  return registry;
}

/**
 * Hashes and registers one isolated canonical preimage.
 *
 * @param preimage Canonical bytes owned by the identity derivation.
 * @param registry Optional factory-owned collision registry.
 * @returns Canonical digest and defensive preimage copy, or a closed failure.
 */
export function deriveOracleEvaluationDigest(
  preimage: Uint8Array,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1 {
  try {
    const byteLength = uint8ArrayByteLength(preimage);
    if (byteLength === undefined || byteLength > MAX_RETAINED_BYTES) {
      return failure(
        byteLength === undefined ? "oracle.input.invalid" : "oracle.input.limit",
        "/preimage",
        "Canonical preimage is invalid or exceeds the fixed byte limit.",
      );
    }
    const isolated = copyUint8Array(preimage, byteLength);
    if (isolated === undefined) {
      return failure(
        "oracle.input.invalid",
        "/preimage",
        "Canonical preimage could not be copied.",
      );
    }
    let identity: Sha256Digest;
    if (registry === undefined) {
      identity = `sha256:${createHash("sha256").update(isolated).digest("hex")}`;
    } else {
      const state = COLLISION_STATES.get(registry);
      if (state === undefined || state.disposed) {
        return failure("oracle.input.invalid", "/registry", "Collision registry is not active.");
      }
      const digestInput = copyUint8Array(isolated, isolated.byteLength);
      const digestBytes =
        digestInput === undefined ? undefined : copyUint8Array(state.digest(digestInput), 32);
      if (digestBytes === undefined) {
        return failure(
          "oracle.input.invalid",
          "/identity",
          "Digest primitive must return 32 bytes.",
        );
      }
      identity = `sha256:${Array.from(digestBytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")}`;
      const registered = registerPreimage(state, identity, isolated);
      if (!registered.ok) return registered;
    }
    return Object.freeze({
      ok: true,
      identity,
      preimage: isolated,
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return failure(
      "oracle.input.invalid",
      "/identity",
      "Canonical identity could not be derived safely.",
    );
  }
}
