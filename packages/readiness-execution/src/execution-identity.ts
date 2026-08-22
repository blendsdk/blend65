import { createHash } from "node:crypto";

import type {
  ExecutionHandlerIdentityV1,
  ExecutionObservationLayoutV1,
  ExecutionPrebuildIdentityInputV1,
} from "@blend65/readiness";

const TEXT_ENCODER = new TextEncoder();

function sha256(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(TEXT_ENCODER.encode(JSON.stringify(value)))
    .digest("hex")}`;
}

function compareHandlers(
  left: ExecutionHandlerIdentityV1,
  right: ExecutionHandlerIdentityV1,
): number {
  const leftKey = `${left.capabilityId}\u0000${left.contractVersion}\u0000${left.implementationRevision}`;
  const rightKey = `${right.capabilityId}\u0000${right.contractVersion}\u0000${right.implementationRevision}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

/** Derives the execution identity fixed before assembler label resolution. */
export function derivePrebuildExecutionIdentityV1(input: ExecutionPrebuildIdentityInputV1): string {
  const handlers = [...input.handlers].sort(compareHandlers).map((handler) => ({
    capabilityId: handler.capabilityId,
    contractVersion: handler.contractVersion,
    implementationRevision: handler.implementationRevision,
  }));
  return sha256({
    domain: "blend65-execution-prebuild-v1",
    sourceCaseDigest: input.sourceCaseDigest,
    renderedSourceDigest: input.renderedSourceDigest,
    argumentsDigest: input.argumentsDigest,
    envelopeRevision: input.envelopeRevision,
    selectorRevision: input.selectorRevision,
    fixtureRevision: input.fixtureRevision,
    fixtureDigest: input.fixtureDigest,
    observationProjectionRevision: input.observationProjectionRevision ?? null,
    target: input.target,
    policyDigest: input.policyDigest,
    handlers,
    observation: {
      kind: input.observation.kind,
      byteLength: input.observation.byteLength,
      address: input.observation.address ?? null,
      projectionRevision: input.observation.projectionRevision ?? null,
    },
  });
}

/** Binds a pre-build identity to one exact accepted compiler observation layout. */
export function deriveFinalExecutionIdentityV1(
  prebuildIdentity: string,
  layout: ExecutionObservationLayoutV1,
): string {
  return sha256({
    domain: "blend65-execution-final-v1",
    prebuildIdentity,
    layout: {
      revision: layout.revision,
      resultSymbols: [...layout.resultSymbols],
      resultAddresses: [...layout.resultAddresses],
      completionSymbol: layout.completionSymbol,
      completionAddress: layout.completionAddress,
      postEntryStores: layout.postEntryStores.map((store) => ({
        instructionAddress: store.instructionAddress,
        targetAddress: store.targetAddress,
        kind: store.kind,
        ...(store.kind === "observation-byte"
          ? { byteIndex: store.byteIndex }
          : { value: store.value }),
      })),
      proofDigest: layout.proofDigest,
    },
  });
}
