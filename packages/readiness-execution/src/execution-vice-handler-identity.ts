import { createHash } from "node:crypto";

import type { ExecutionHandlerIdentityV1 } from "@blend65/readiness";

const ENCODER = new TextEncoder();

function revision(identity: string): string {
  return `sha256:${createHash("sha256")
    .update(ENCODER.encode(`blend65-fixed-execution-handler-v1\0${identity}`))
    .digest("hex")}`;
}

/** Fixed private identities for the production evaluated-emulator dependency set. */
export const FIXED_EVALUATED_VICE_HANDLER_IDENTITIES_V1: readonly ExecutionHandlerIdentityV1[] =
  Object.freeze([
    Object.freeze({
      capabilityId: "emit" as const,
      contractVersion: "assembly-emitter-v1",
      implementationRevision: revision("default-worker-emitter-v1"),
    }),
    Object.freeze({
      capabilityId: "acme" as const,
      contractVersion: "supervised-acme-route-v1",
      implementationRevision: revision("default-supervised-acme-v1"),
    }),
    Object.freeze({
      capabilityId: "vice" as const,
      contractVersion: "evaluated-vice-route-v1",
      implementationRevision: revision("default-evaluated-vice-v1"),
    }),
  ]);

/** Canonical digest checked again when the sealed route crosses into runtime admission. */
export const FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1 = `sha256:${createHash("sha256")
  .update(
    ENCODER.encode(
      JSON.stringify({
        domain: "blend65-fixed-evaluated-vice-handlers-v1",
        handlers: FIXED_EVALUATED_VICE_HANDLER_IDENTITIES_V1,
      }),
    ),
  )
  .digest("hex")}`;
