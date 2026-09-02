import type { FailureConfirmationContextStateV1 } from "./failure-confirmation-context.js";
import type { ExecutionReportOccurrenceStateV1 } from "./execution-report-provenance.js";
import { discoverRequiredExecutionToolVersionsV1 } from "./execution-tool-discovery.js";

/** Freshly verifies runtime tool versions against one authenticated report occurrence. */
export async function validateFailureConfirmationToolVersionsV1(
  context: FailureConfirmationContextStateV1,
  occurrence: ExecutionReportOccurrenceStateV1,
): Promise<boolean> {
  const node = context.report.toolVersions.find(({ tool }) => tool === "node");
  if (node?.version !== process.versions.node) return false;
  const tiers = [...occurrence.route.prerequisiteTiers, occurrence.route.terminalTier];
  const required = Object.freeze([
    ...(tiers.includes("acme") ? (["acme"] as const) : []),
    ...(tiers.includes("vice") ? (["vice"] as const) : []),
  ]);
  const observed = await discoverRequiredExecutionToolVersionsV1(required);
  return (
    observed !== undefined &&
    observed.every(
      (candidate) =>
        context.report.toolVersions.find(({ tool }) => tool === candidate.tool)?.version ===
        candidate.version,
    )
  );
}

/** Verifies every route that confirmation may execute before an isolation root is allocated. */
export async function validateFailureConfirmationContextToolVersionsV1(
  context: FailureConfirmationContextStateV1,
): Promise<boolean> {
  const occurrences =
    context.disposition === "direct-shrink"
      ? [context.subject]
      : [
          context.subject,
          ...context.preceding,
          ...(context.control === undefined ? [] : [context.control]),
        ];
  for (const occurrence of new Set(occurrences)) {
    if (!(await validateFailureConfirmationToolVersionsV1(context, occurrence))) return false;
  }
  return true;
}
