import {
  copyUint8Array,
  encodeCanonicalIdentity,
  uint8ArrayByteLength,
} from "./canonical-identity.js";
import {
  deriveOracleEvaluationDigest,
  type OracleEvaluationCollisionRegistry,
} from "./oracle-evaluation-collision.js";
import type { OracleIdentityResultV1 } from "./oracle-evaluation-identity.js";
import type { OracleDiagnostic } from "./oracle-model.js";

const MAX_CONTENT_BYTES = 16_777_000;

function failure(code: OracleDiagnostic["code"], message: string): OracleIdentityResultV1 {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([
      Object.freeze({
        code,
        path: "/content",
        message,
      }),
    ]),
  });
}

function deriveContentIdentity(
  domain: "blend65-oracle-source-content-v1" | "blend65-oracle-transformed-content-v1",
  content: Uint8Array,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1 {
  try {
    const byteLength = uint8ArrayByteLength(content);
    if (byteLength === undefined || byteLength > MAX_CONTENT_BYTES) {
      return failure(
        byteLength === undefined ? "oracle.input.invalid" : "oracle.input.limit",
        "Content must be a bounded byte array.",
      );
    }
    const isolated = copyUint8Array(content, byteLength);
    if (isolated === undefined) {
      return failure("oracle.input.invalid", "Content could not be copied safely.");
    }
    return deriveOracleEvaluationDigest(
      encodeCanonicalIdentity(domain, [{ name: "content", value: isolated }]),
      registry,
    );
  } catch {
    return failure("oracle.input.invalid", "Content identity could not be derived safely.");
  }
}

/**
 * Derives the domain-separated identity of exact source bytes.
 *
 * @param content Exact generated source bytes.
 * @param registry Optional bounded collision registry.
 * @returns Canonical identity, preimage, and diagnostics.
 *
 * @example
 * ```ts
 * const result = deriveOracleSourceContentIdentity(sourceBytes);
 * ```
 */
export function deriveOracleSourceContentIdentity(
  content: Uint8Array,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1 {
  return deriveContentIdentity("blend65-oracle-source-content-v1", content, registry);
}

/**
 * Derives the role-separated identity of transformed source bytes.
 *
 * @param content Exact transformed source bytes.
 * @param registry Optional bounded collision registry.
 * @returns Canonical identity, preimage, and diagnostics.
 *
 * @example
 * ```ts
 * const result = deriveOracleTransformedContentIdentity(transformedBytes);
 * ```
 */
export function deriveOracleTransformedContentIdentity(
  content: Uint8Array,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1 {
  return deriveContentIdentity("blend65-oracle-transformed-content-v1", content, registry);
}
