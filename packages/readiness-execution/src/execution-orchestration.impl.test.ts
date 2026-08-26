import { createPublishedOracleContext } from "@blend65/readiness/published-oracle";
import {
  projectExecutionCampaignV1,
  resolvePublishedSnapshotByDigest,
  type ExecutionPolicyV1,
  type PreparedCampaign,
} from "@blend65/readiness";
import { getPreparedCampaignExecutionIdentityV1 } from "@blend65/readiness/execution-campaign-identity";
import { describe, expect, it } from "vitest";

import { createLocalExecutionCampaignV1 } from "./execution-campaign-factory.js";
import { runWithExecutionOrchestrationConformanceV1 } from "./execution-orchestration-conformance-v1.js";
import { executeReadinessCampaign } from "./execution-orchestration.js";
import {
  resolveLiveExecutionContextV1,
  selectExecutionPublicationByDigestV1,
} from "./execution-publication-catalog.js";
import { createExecutionPublicationCatalogFixtureV1 } from "./test-fixtures/execution-publication-catalog-spec-fixture.js";
import { createGenuineExecutionCampaigns } from "./test-fixtures/genuine-execution-campaign.js";

const POLICY: ExecutionPolicyV1 = Object.freeze({
  revision: "execution-policy-v1",
  budget: Object.freeze({
    operationMs: 1_000,
    launchAttemptMs: 1_000,
    routeMs: 10_000,
    cleanupGraceMs: 3_000,
    outputBytes: 64,
    evidenceBytes: 16_777_216,
    instructions: 100,
    cycles: 1_000,
    launchAttempts: 2,
  }),
});
const RESULT_USAGE = Object.freeze({
  wallMs: 0,
  outputBytes: 0,
  evidenceBytes: 0,
  instructions: 0,
  cycles: 0,
  launchAttempts: 0,
});
const RESULT_EVIDENCE = Object.freeze({
  digest: `sha256:${"a".repeat(64)}`,
  retainedBytes: 0,
  truncated: false,
});

function terminalResult(tier: "frontend" | "compiler-api" | "cli" | "emit" | "acme" | "vice") {
  return Object.freeze({
    status: "pass" as const,
    tier,
    stage: tier === "vice" ? ("compare" as const) : tier,
    code: "pass" as const,
    usage: RESULT_USAGE,
    evidence: RESULT_EVIDENCE,
  });
}

describe("execution campaign orchestration", () => {
  it("aggregates every selected route when local tools are unavailable", async () => {
    const fixture = await createExecutionPublicationCatalogFixtureV1();
    try {
      const parent = await resolvePublishedSnapshotByDigest({
        repositoryRoot: fixture.repositoryRoot,
        publicationDigest: fixture.parentDigest,
      });
      if (!parent.ok) throw new TypeError(JSON.stringify(parent.diagnostics));
      const oracle = createPublishedOracleContext(parent.value);
      if (!oracle.ok) throw new TypeError(JSON.stringify(oracle.diagnostics));
      const selected = await selectExecutionPublicationByDigestV1(
        fixture.repositoryRoot,
        fixture.childDigest,
      );
      if (!selected.ok) throw new TypeError(JSON.stringify(selected.issues));
      const live = resolveLiveExecutionContextV1(selected.value);
      if (!live.ok) throw new TypeError(JSON.stringify(live.issues));
      const campaigns = await createGenuineExecutionCampaigns(parent.value);
      const campaign = campaigns.orchestration;
      const unavailableCapabilities = {
        acme: { available: false },
        vice: { available: false },
      } as const;
      const mixedParent = await executeReadinessCampaign({
        parent: parent.value,
        execution: live.value,
        oracle: oracle.value,
        campaign: campaigns.runtime,
        target: "c64",
        policy: POLICY,
        capabilities: unavailableCapabilities,
      });
      expect(mixedParent).toMatchObject({
        ok: false,
        issues: [{ code: "execution.identity", path: "/campaign/parentDigest" }],
      });
      const discovery = await runWithExecutionOrchestrationConformanceV1(
        { capabilities: unavailableCapabilities },
        () =>
          executeReadinessCampaign({
            parent: parent.value,
            execution: live.value,
            oracle: oracle.value,
            campaign,
            target: "c64",
            policy: POLICY,
            capabilities: unavailableCapabilities,
          }),
      );
      const result = discovery.value;
      if (!result.ok) throw new TypeError(JSON.stringify(result.issues));

      expect(result.value.summary.status).toBe("unavailable");
      expect(result.value.results).toHaveLength(result.value.summary.selectedCases);
      expect(result.value.summary.blockers).toContain("tier-unavailable:acme");
      expect(result.value.summary.blockers).toContain("tier-unavailable:vice");
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(result.value.routeRecords).toHaveLength(result.value.results.length);
      expect(
        result.value.routeRecords.every(
          (record, index) => record.result === result.value.results[index],
        ),
      ).toBe(true);

      const routes = discovery.transcript.filter((entry) => entry.kind === "planned-execution");

      const localCampaign = await createLocalExecutionCampaignV1(parent.value, "7".repeat(64));
      const fixtureProjection = projectExecutionCampaignV1(campaign);
      const localProjection = projectExecutionCampaignV1(localCampaign);
      if (!fixtureProjection.ok || !localProjection.ok) {
        throw new TypeError("Expected genuine orchestration campaign projections.");
      }
      expect(localProjection.value).toEqual(fixtureProjection.value);
      expect(localProjection.value.campaignDigest).toBe(
        "sha256:d6c590aea3d84fc59c5618a9bd8ab8d6ad653bcdb29c0b7528b1e875ee7b776d",
      );
      const population = new Map<
        string,
        { cases: number; valid: number; invalid: number; strata: Set<string> }
      >();
      for (const item of localProjection.value.cases) {
        const retained = population.get(item.ruleId) ?? {
          cases: 0,
          valid: 0,
          invalid: 0,
          strata: new Set<string>(),
        };
        retained.cases += 1;
        retained[item.validity] += 1;
        retained.strata.add(
          JSON.stringify([item.validity, [...item.spellingTuple], item.boundaryFamilyId]),
        );
        population.set(item.ruleId, retained);
      }
      expect(
        [...population.entries()].sort().map(([ruleId, value]) => ({
          ruleId,
          cases: value.cases,
          valid: value.valid,
          invalid: value.invalid,
          strata: value.strata.size,
        })),
      ).toEqual([
        {
          ruleId: "rule.ch12.3-1-memory-access.peek-addr.signature.word",
          cases: 8,
          valid: 4,
          invalid: 4,
          strata: 3,
        },
        {
          ruleId: "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
          cases: 8,
          valid: 4,
          invalid: 4,
          strata: 3,
        },
        {
          ruleId: "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
          cases: 12,
          valid: 8,
          invalid: 4,
          strata: 7,
        },
        {
          ruleId: "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
          cases: 12,
          valid: 8,
          invalid: 4,
          strata: 6,
        },
      ]);
      expect(getPreparedCampaignExecutionIdentityV1(localCampaign)).toEqual(
        getPreparedCampaignExecutionIdentityV1(campaign),
      );

      const baseInput = {
        parent: parent.value,
        execution: live.value,
        oracle: oracle.value,
        campaign,
        target: "c64" as const,
        policy: POLICY,
        capabilities: { acme: { available: false }, vice: { available: false } },
      };
      for (const invalidInput of [
        null,
        [],
        Object.create({}),
        { ...baseInput, unexpected: true },
        new Proxy(baseInput, {
          ownKeys: () => {
            throw new TypeError("hostile");
          },
        }),
        { ...baseInput, capabilities: null },
        { ...baseInput, capabilities: { acme: { available: "yes" }, vice: { available: false } } },
        {
          ...baseInput,
          capabilities: { acme: { available: true, version: "" }, vice: { available: false } },
        },
      ]) {
        const rejected = await executeReadinessCampaign(invalidInput as never);
        expect(rejected.ok).toBe(false);
      }
      const accessorCapabilities = { acme: { available: false }, vice: { available: false } };
      Object.defineProperty(accessorCapabilities.acme, "available", {
        enumerable: true,
        get: () => false,
      });
      expect(
        (
          await executeReadinessCampaign({
            ...baseInput,
            capabilities: accessorCapabilities as never,
          })
        ).ok,
      ).toBe(false);
      for (const forged of [
        { ...baseInput, parent: { ...parent.value } },
        { ...baseInput, execution: { ...live.value } },
        {
          ...baseInput,
          oracle: { selectedReleaseDigest: fixture.parentDigest } as typeof oracle.value,
        },
        {
          ...baseInput,
          oracle: { selectedReleaseDigest: `sha256:${"0".repeat(64)}` } as typeof oracle.value,
        },
        { ...baseInput, campaign: { ...campaign } as PreparedCampaign },
        { ...baseInput, target: "x16" as "c64" },
        {
          ...baseInput,
          policy: {
            ...POLICY,
            budget: { ...POLICY.budget, cleanupGraceMs: 2_999 },
          },
        },
      ]) {
        const rejected = await executeReadinessCampaign(forged);
        expect(rejected.ok).toBe(false);
      }
      for (const capabilities of [
        { acme: { available: false }, vice: { available: true } },
        { acme: { available: true }, vice: { available: false } },
      ] as const) {
        const affected = (tier: (typeof routes)[number]["tier"]) =>
          (!capabilities.acme.available && (tier === "acme" || tier === "vice")) ||
          (!capabilities.vice.available && tier === "vice");
        const actualResults = routes
          .filter((route) => !affected(route.tier))
          .map((route) => ({
            executionIdentity: route.executionIdentity,
            tier: route.tier,
            result: terminalResult(route.tier),
          }));
        const partialRun = await runWithExecutionOrchestrationConformanceV1(
          { capabilities, actualResults },
          () => executeReadinessCampaign({ ...baseInput, capabilities }),
        );
        const partial = partialRun.value;
        expect(partial.ok).toBe(true);
        if (!partial.ok) throw new TypeError("Expected partial tool availability report.");
        expect(partial.value.summary.status).toBe("unavailable");
        expect(partial.value.toolVersions.map(({ version }) => version)).toContain("available");
        expect(
          partial.value.routeRecords.filter((record) => record.result.status === "pass"),
        ).toHaveLength(actualResults.length);
        expect(
          partial.value.routeRecords
            .filter((record) => affected(record.terminalTier))
            .every((record) => record.result.code === "tier-unavailable"),
        ).toBe(true);
      }

      const mutablePolicy = {
        revision: "execution-policy-v1" as const,
        budget: { ...POLICY.budget },
      };
      let policyObservations = 0;
      const available = {
        acme: { available: true, version: "0.97" },
        vice: { available: true, version: "3.10" },
      } as const;
      const policyRun = await runWithExecutionOrchestrationConformanceV1(
        {
          capabilities: available,
          actualResults: routes.map((route) => ({
            executionIdentity: route.executionIdentity,
            tier: route.tier,
            result: terminalResult(route.tier),
          })),
          atPlannedPolicyUse: (policy) => {
            expect(Object.isFrozen(policy)).toBe(true);
            expect(policy.budget.routeMs).toBe(POLICY.budget.routeMs);
            if (policyObservations === 0) mutablePolicy.budget.routeMs = 3_000;
            policyObservations += 1;
          },
        },
        () =>
          executeReadinessCampaign({
            ...baseInput,
            policy: mutablePolicy,
            capabilities: available,
          }),
      );
      expect(policyObservations).toBe(routes.length);
      expect(policyRun.value).toMatchObject({ ok: true, value: { summary: { status: "pass" } } });
    } finally {
      await fixture.cleanup();
    }
  }, 240_000);
});
