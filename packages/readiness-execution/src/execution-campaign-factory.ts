import type {
  GenerationConfiguration,
  PreparedCampaign,
  PublishedSnapshot,
} from "@blend65/readiness";
import { createPublishedExecutionCampaignV1 } from "@blend65/readiness/execution-campaign-identity";

/** Fixed reviewed population used by the local execution authority command. */
export const LOCAL_EXECUTION_CAMPAIGN_CONFIGURATION_V1: GenerationConfiguration = Object.freeze({
  caseCount: 40,
  maxInvalidCases: 16,
  enabledRuleIds: Object.freeze([
    "rule.ch12.3-1-memory-access.peek-addr.signature.word",
    "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
    "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
    "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
  ]),
  spellings: Object.freeze(["literal", "parameter"] as const),
  budget: Object.freeze({
    maxModules: 4,
    maxDeclarations: 128,
    maxIrNodes: 512,
    maxStatements: 256,
    maxExpressionDepth: 16,
    maxLoopWork: 1n,
    maxSourceBytes: 65_536,
    maxAttempts: 128,
  }),
});

/**
 * Builds the deterministic C64 campaign under the exact selected publication authority.
 *
 * The selected snapshot owns all inventory, model and participant authority. Current executable
 * route bytes are attributed separately by the execution candidate digest.
 *
 * @param snapshot Genuine selected publication snapshot.
 * @param seed Lowercase 64-character hexadecimal campaign seed without the digest prefix.
 * @returns Genuine parent-bound prepared campaign.
 */
export function createLocalExecutionCampaignV1(
  snapshot: PublishedSnapshot,
  seed: string,
): PreparedCampaign {
  if (!/^[0-9a-f]{64}$/u.test(seed)) throw new TypeError("Execution campaign seed is invalid.");
  const prepared = createPublishedExecutionCampaignV1(snapshot, {
    schemaVersion: 1,
    target: "c64",
    seed: `sha256:${seed}`,
    configuration: LOCAL_EXECUTION_CAMPAIGN_CONFIGURATION_V1,
  });
  if (!prepared.ok) {
    throw new TypeError(
      prepared.diagnostics[0]?.message ?? "Selected execution campaign preparation failed.",
    );
  }
  return prepared.value;
}
