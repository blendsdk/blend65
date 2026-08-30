import { createHash } from "node:crypto";

import { compareExecutionText } from "./execution-validation.js";

import type { Sha256Digest } from "./model-registry-model.js";

/** Canonical content encoding used only for bounded deterministic identities and sizes. */
export function encodeReductionValueV1(value: unknown): Uint8Array {
  const normalize = (current: unknown): unknown => {
    if (typeof current === "bigint") return { $bigint: current.toString() };
    if (current instanceof Uint8Array) {
      return { $bytes: Buffer.from(current).toString("base64") };
    }
    if (Array.isArray(current)) return current.map(normalize);
    if (typeof current !== "object" || current === null) return current;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(current).sort(compareExecutionText)) {
      const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("Reduction values require ordinary data properties.");
      }
      output[key] = normalize(descriptor.value);
    }
    return output;
  };
  return new TextEncoder().encode(JSON.stringify(normalize(value)));
}

/** Returns a canonical SHA-256 digest for bounded reduction content. */
export function digestReductionValueV1(value: unknown): Sha256Digest {
  return `sha256:${createHash("sha256").update(encodeReductionValueV1(value)).digest("hex")}`;
}
