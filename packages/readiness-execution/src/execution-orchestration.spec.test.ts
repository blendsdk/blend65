import { createHash } from "node:crypto";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { createPublishedOracleContext } from "@blend65/readiness/published-oracle";
import {
  prepareExecutionPublicationCandidateV1,
  resolvePublishedSnapshotByDigest,
  type ExecutionOperationResultV1,
  type ExecutionPolicyV1,
  type ExecutionProjectionRevisionV1,
  type ExecutionResultV1,
  type ExecutionTierV1,
  type PreparedCampaign,
  type PublishedOracleContext,
  type PublishedSnapshot,
} from "@blend65/readiness";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as executionPackage from "./index.js";
import {
  CURRENT_EXECUTION_PARENT_DIGEST,
  createExecutionPublicationCatalogFixtureV1,
  encodeCanonicalJsonV1,
  readCurrentPublicationPointerBytesV1,
  type ExecutionPublicationCatalogFixtureV1,
} from "./test-fixtures/execution-publication-catalog-spec-fixture.js";
import { createGenuineExecutionCampaigns } from "./test-fixtures/genuine-execution-campaign.js";

const REPORT_PATH = "readiness/execution-evidence/rd-04-local-v1.json";
const SEED = "7".repeat(64);
const DIGEST = `sha256:${"a".repeat(64)}`;
const USAGE = Object.freeze({
  wallMs: 0,
  outputBytes: 0,
  evidenceBytes: 0,
  instructions: 0,
  cycles: 0,
  launchAttempts: 0,
});
const EVIDENCE = Object.freeze({ digest: DIGEST, retainedBytes: 0, truncated: false });
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

interface ExecutionEnvironmentCapabilitiesV1 {
  readonly acme: { readonly available: boolean; readonly version?: string };
  readonly vice: { readonly available: boolean; readonly version?: string };
}

interface ExecutionCampaignSummaryV1 {
  readonly status: "pass" | "failure" | "unavailable";
  readonly selectedCases: number;
  readonly passedCases: number;
  readonly blockers: readonly string[];
}

interface ExecutionAuthorityReportV1 {
  readonly revision: "execution-authority-report-v1";
  readonly parentDigest: string;
  readonly oracleDigest: string;
  readonly campaignDigest: string;
  readonly routePlanDigest: string;
  readonly target: "c64";
  readonly seed: string;
  readonly toolVersions: readonly {
    readonly tool: "node" | "acme" | "vice";
    readonly version: string;
  }[];
  readonly projectionRevisions: readonly ExecutionProjectionRevisionV1[];
  readonly results: readonly ExecutionResultV1[];
  readonly summary: ExecutionCampaignSummaryV1;
}

interface OrchestrationApiV1 {
  executeReadinessCampaign(input: {
    readonly parent: PublishedSnapshot;
    readonly execution: executionPackage.LiveExecutionContextV1;
    readonly oracle: PublishedOracleContext;
    readonly campaign: PreparedCampaign;
    readonly target: "c64";
    readonly policy: ExecutionPolicyV1;
    readonly capabilities: ExecutionEnvironmentCapabilitiesV1;
  }): Promise<ExecutionOperationResultV1<ExecutionAuthorityReportV1>>;
  serializeExecutionAuthorityReportV1(report: ExecutionAuthorityReportV1): Uint8Array;
  writeExecutionAuthorityReportV1(
    repositoryRoot: string,
    report: ExecutionAuthorityReportV1,
  ): Promise<ExecutionOperationResultV1<string>>;
  runReadinessExecutionCliV1(
    argv: readonly string[],
    io: { readonly cwd: string; writeOut(text: string): void; writeErr(text: string): void },
  ): Promise<0 | 1 | 2 | 3 | 4>;
}

type ReportFaultPointV1 =
  | "after-temporary-create"
  | "after-temporary-write"
  | "after-temporary-file-sync"
  | "before-report-rename"
  | "after-report-rename"
  | "after-report-directory-sync"
  | "during-report-reconciliation";

interface PlannedExecutionObservationV1 {
  readonly kind: "planned-execution";
  readonly executionIdentity: string;
  readonly tier: ExecutionTierV1;
  readonly ruleId: string;
  readonly obligation: string;
}

type ConformanceObservationV1 =
  | PlannedExecutionObservationV1
  | {
      readonly kind: "result-substitution";
      readonly executionIdentity: string;
      readonly tier: ExecutionTierV1;
    }
  | { readonly kind: "report-fault"; readonly point: ReportFaultPointV1 }
  | {
      readonly kind: "report-reconciliation";
      readonly state: "prior-report" | "committed" | "ambiguous";
    };

interface ConformanceApiV1 {
  runWithExecutionOrchestrationConformanceV1<T>(
    controls: {
      readonly capabilities?: ExecutionEnvironmentCapabilitiesV1;
      readonly actualResults?: readonly {
        readonly executionIdentity: string;
        readonly tier: ExecutionTierV1;
        readonly result: ExecutionResultV1;
      }[];
      readonly reportFaults?: readonly ReportFaultPointV1[];
    },
    operation: () => T | Promise<T>,
  ): Promise<{ readonly value: T; readonly transcript: readonly ConformanceObservationV1[] }>;
}

const api = executionPackage as unknown as OrchestrationApiV1 & typeof executionPackage;
const CONFORMANCE_MODULE = ["./execution-orchestration-conformance-v1", "js"].join(".");

let catalog: ExecutionPublicationCatalogFixtureV1;
let parent: PublishedSnapshot;
let oracle: PublishedOracleContext;
let live: executionPackage.LiveExecutionContextV1;
let campaign: PreparedCampaign;

function success<T>(result: ExecutionOperationResultV1<T>): T {
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.code).join(","));
  return result.value;
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function terminalResult(
  tier: ExecutionTierV1,
  code: "pass" | "semantic-mismatch",
): ExecutionResultV1 {
  return code === "pass"
    ? {
        status: "pass",
        tier,
        stage: tier === "vice" ? "compare" : tier,
        code,
        usage: USAGE,
        evidence: EVIDENCE,
      }
    : {
        status: "failure",
        tier,
        stage: "compare",
        code,
        usage: USAGE,
        evidence: EVIDENCE,
      };
}

async function conformance(): Promise<ConformanceApiV1> {
  return (await import(/* @vite-ignore */ CONFORMANCE_MODULE)) as ConformanceApiV1;
}

async function scoped<T>(
  controls: Parameters<ConformanceApiV1["runWithExecutionOrchestrationConformanceV1"]>[0],
  operation: () => Promise<T>,
) {
  return (await conformance()).runWithExecutionOrchestrationConformanceV1(controls, operation);
}

function execute(capabilities: ExecutionEnvironmentCapabilitiesV1) {
  return api.executeReadinessCampaign({
    parent,
    execution: live,
    oracle,
    campaign,
    target: "c64",
    policy: POLICY,
    capabilities,
  });
}

function planned(transcript: readonly ConformanceObservationV1[]) {
  return transcript.filter(
    (entry): entry is PlannedExecutionObservationV1 => entry.kind === "planned-execution",
  );
}

function substitutions(routes: readonly PlannedExecutionObservationV1[], mismatchIndex = -1) {
  return routes.map((route, index) => ({
    executionIdentity: route.executionIdentity,
    tier: route.tier,
    result: terminalResult(route.tier, index === mismatchIndex ? "semantic-mismatch" : "pass"),
  }));
}

function expectMachineNeutralOutput(stdout: string, stderr: string): void {
  expect(stdout.length).toBeLessThanOrEqual(1_048_576);
  expect(stderr.length).toBeLessThanOrEqual(1_048_576);
  expect(stdout).not.toContain(catalog.repositoryRoot);
  expect(stderr).not.toContain(catalog.repositoryRoot);
  expect(`${stdout}${stderr}`).not.toMatch(/(?:\/tmp\/|\\\\|[A-Za-z]:\\)/u);
}

async function cliRun(
  controls: Parameters<ConformanceApiV1["runWithExecutionOrchestrationConformanceV1"]>[0],
  argv: readonly string[],
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const result = await scoped(controls, () =>
    api.runReadinessExecutionCliV1(argv, {
      cwd: catalog.repositoryRoot,
      writeOut: (text) => stdout.push(text),
      writeErr: (text) => stderr.push(text),
    }),
  );
  return { ...result, stdout: stdout.join(""), stderr: stderr.join("") };
}

beforeAll(async () => {
  catalog = await createExecutionPublicationCatalogFixtureV1();
  const selectedParent = await resolvePublishedSnapshotByDigest({
    repositoryRoot: catalog.repositoryRoot,
    publicationDigest: catalog.parentDigest,
  });
  if (!selectedParent.ok) throw new Error("Expected the genuine parent fixture to resolve.");
  parent = selectedParent.value;
  const published = createPublishedOracleContext(parent);
  if (!published.ok) throw new Error("Expected the genuine published oracle context.");
  oracle = published.value;
  live = success(api.resolveLiveExecutionContextV1(catalog.release));
  campaign = (await createGenuineExecutionCampaigns()).orchestration;
  expect(catalog.parentDigest).toBe(CURRENT_EXECUTION_PARENT_DIGEST);
  success(
    await api.selectExecutionPublicationByDigestV1(catalog.repositoryRoot, catalog.childDigest),
  );
}, 240_000);

afterAll(async () => catalog?.cleanup());

describe("execution orchestration acceptance", () => {
  it("retains exact unavailable ACME and VICE blockers and cannot pass", async () => {
    const unavailable = { acme: { available: false }, vice: { available: false } } as const;
    const run = await scoped({ capabilities: unavailable }, () => execute(unavailable));
    const report = success(run.value);

    expect(report.summary.status).toBe("unavailable");
    expect(report.summary.passedCases).toBeLessThan(report.summary.selectedCases);
    expect(report.summary.blockers).toEqual([...report.summary.blockers].sort());
    expect(
      report.summary.blockers.filter((blocker) => blocker.startsWith("tier-unavailable:")),
    ).toEqual(["tier-unavailable:acme", "tier-unavailable:vice"]);
    expect(report.results).not.toContainEqual(
      expect.objectContaining({ status: "pass", tier: "vice" }),
    );
    expect(Object.isFrozen(run.transcript)).toBe(true);
    expect(run.transcript.every((entry) => Object.isFrozen(entry))).toBe(true);
  });

  it("executes every selected obligation and preserves residual population blockers", async () => {
    const unavailable = { acme: { available: false }, vice: { available: false } } as const;
    const discovery = await scoped({ capabilities: unavailable }, () => execute(unavailable));
    success(discovery.value);
    const routes = planned(discovery.transcript);
    expect(routes.length).toBeGreaterThan(0);

    const available = {
      acme: { available: true, version: "0.97" },
      vice: { available: true, version: "3.10" },
    } as const;
    const run = await scoped(
      { capabilities: available, actualResults: substitutions(routes) },
      () => execute(available),
    );
    const report = success(run.value);

    expect(report.results).toHaveLength(routes.length);
    expect(report.summary.selectedCases).toBe(routes.length);
    expect(report.summary.passedCases).toBe(routes.length);
    expect(
      run.transcript
        .filter((entry) => entry.kind === "result-substitution")
        .map(({ executionIdentity, tier }) => `${executionIdentity}\0${tier}`),
    ).toEqual(routes.map(({ executionIdentity, tier }) => `${executionIdentity}\0${tier}`));
    expect(
      new Set(routes.map(({ ruleId, obligation }) => `${ruleId}\0${obligation}`)).size,
    ).toBeGreaterThan(0);
    expect(report.summary.blockers.some((blocker) => blocker.startsWith("residual:"))).toBe(true);
  });

  it("aggregates a substituted semantic mismatch without exposing oracle truth", async () => {
    const unavailable = { acme: { available: false }, vice: { available: false } } as const;
    const discovery = await scoped({ capabilities: unavailable }, () => execute(unavailable));
    success(discovery.value);
    const routes = planned(discovery.transcript);
    expect(routes.length).toBeGreaterThan(0);
    const available = {
      acme: { available: true, version: "0.97" },
      vice: { available: true, version: "3.10" },
    } as const;
    const run = await scoped(
      { capabilities: available, actualResults: substitutions(routes, 0) },
      () => execute(available),
    );
    const report = success(run.value);
    const bytes = api.serializeExecutionAuthorityReportV1(report);

    expect(report.summary.status).toBe("failure");
    expect(report.results).toContainEqual(expect.objectContaining({ code: "semantic-mismatch" }));
    expect(new TextDecoder().decode(bytes)).not.toMatch(
      /expectation|expectedValue|expectedEffect/u,
    );
    expect(run.transcript.every((entry) => !("expectation" in entry))).toBe(true);
    expect("runWithExecutionOrchestrationConformanceV1" in executionPackage).toBe(false);

    const duplicate = substitutions(routes, 0)[0];
    await expect(
      scoped({ capabilities: available, actualResults: [duplicate, duplicate] }, () =>
        execute(available),
      ),
    ).rejects.toThrow();
    await expect(
      scoped({ actualResults: [{ ...duplicate, executionIdentity: DIGEST }] }, () =>
        execute(available),
      ),
    ).rejects.toThrow();
    await expect(
      scoped(
        {
          actualResults: [
            { ...duplicate, tier: duplicate.tier === "frontend" ? "vice" : "frontend" },
          ],
        },
        () => execute(available),
      ),
    ).rejects.toThrow();
    await expect(scoped({ actualResults: [duplicate] }, async () => true)).rejects.toThrow();
    await expect(scoped({}, () => scoped({}, async () => true))).rejects.toThrow();
  });

  it("rejects publication without accepted local VICE proof while preserving selection", async () => {
    const pointerBefore = await readCurrentPublicationPointerBytesV1(catalog.repositoryRoot);
    const review = JSON.parse(new TextDecoder().decode(catalog.semanticReviewBytes)) as Record<
      string,
      unknown
    >;
    review.localAcmeVice = { digest: DIGEST, outcome: "rejected" };
    const rejected = await prepareExecutionPublicationCandidateV1({
      repositoryRoot: catalog.repositoryRoot,
      parentDigest: catalog.parentDigest,
      bindingBytes: catalog.bindingBytes,
      semanticReviewBytes: encodeCanonicalJsonV1(review),
    });

    expect(rejected.ok).toBe(false);
    expect(JSON.stringify(rejected)).toContain("localAcmeVice");
    expect(await readCurrentPublicationPointerBytesV1(catalog.repositoryRoot)).toEqual(
      pointerBefore,
    );
  });

  it("enforces exact CLI grammar, all exits, and bounded machine-neutral output", async () => {
    const argv = ["--target", "c64", "--seed", SEED] as const;
    const unavailable = { acme: { available: false }, vice: { available: false } } as const;
    await rm(join(catalog.repositoryRoot, "readiness", "execution-evidence"), {
      recursive: true,
      force: true,
    });
    const missingTools = await cliRun({ capabilities: unavailable }, argv);
    expect(missingTools.value).toBe(3);
    expect(missingTools.stdout.endsWith("\n")).toBe(true);
    expectMachineNeutralOutput(missingTools.stdout, missingTools.stderr);
    const repeatedMissingTools = await cliRun({ capabilities: unavailable }, argv);
    expect(repeatedMissingTools.stdout).toBe(missingTools.stdout);
    expect(repeatedMissingTools.stderr).toBe(missingTools.stderr);
    const routes = planned(missingTools.transcript);
    expect(routes.length).toBeGreaterThan(0);

    const invalidArguments = [
      [],
      ["--unknown"],
      ["--target", "c64", "--target", "c64", "--seed", SEED],
      ["--target", "c64", "--seed", "A".repeat(64)],
      ["--target", "c64", "--seed", SEED, "--report", "/tmp/report.json"],
      ["--target", "c64", "--seed", SEED, "--report", "../report.json"],
      ["--target", "c64", "--seed", SEED, "--report", "report.json"],
    ];
    const grammar =
      "Usage: yarn readiness:execute -- --target c64 --seed <64-lowercase-hex> " +
      "[--report readiness/execution-evidence/rd-04-local-v1.json]\n";
    for (const invalid of invalidArguments) {
      const result = await api.runReadinessExecutionCliV1(invalid, {
        cwd: catalog.repositoryRoot,
        writeOut: () => undefined,
        writeErr: (text) => expect(text).toBe(grammar),
      });
      expect(result).toBe(2);
    }

    const available = {
      acme: { available: true, version: "0.97" },
      vice: { available: true, version: "3.10" },
    } as const;
    const actualResults = substitutions(routes);
    await rm(join(catalog.repositoryRoot, "readiness", "execution-evidence"), {
      recursive: true,
      force: true,
    });
    const passed = await cliRun({ capabilities: available, actualResults }, argv);
    expect(passed.value).toBe(0);
    expectMachineNeutralOutput(passed.stdout, passed.stderr);
    await rm(join(catalog.repositoryRoot, "readiness", "execution-evidence"), {
      recursive: true,
      force: true,
    });
    const failed = await cliRun(
      { capabilities: available, actualResults: substitutions(routes, 0) },
      argv,
    );
    expect(failed.value).toBe(1);
    expectMachineNeutralOutput(failed.stdout, failed.stderr);
    await rm(join(catalog.repositoryRoot, "readiness", "execution-evidence"), {
      recursive: true,
      force: true,
    });
    const reportFailure = await cliRun(
      { capabilities: available, actualResults, reportFaults: ["after-report-rename"] },
      argv,
    );
    expect(reportFailure.value).toBe(4);
    expectMachineNeutralOutput(reportFailure.stdout, reportFailure.stderr);
  });

  it("reproduces canonical reports and never overwrites or leaves partial bytes", async () => {
    const unavailable = { acme: { available: false }, vice: { available: false } } as const;
    const run = await scoped({ capabilities: unavailable }, () => execute(unavailable));
    const report = success(run.value);
    const bytes = api.serializeExecutionAuthorityReportV1(report);
    expect(api.serializeExecutionAuthorityReportV1(report)).toEqual(bytes);
    const reportText = new TextDecoder().decode(bytes);
    const reportDigest = sha256(bytes);
    expect(reportText.endsWith("\n")).toBe(true);
    expect(reportDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(reportText).not.toContain(catalog.repositoryRoot);
    expect(reportText).not.toMatch(/"(?:cwd|pid|port|timestamp)"\s*:/u);

    await rm(join(catalog.repositoryRoot, "readiness", "execution-evidence"), {
      recursive: true,
      force: true,
    });
    const first = success(
      await api.writeExecutionAuthorityReportV1(catalog.repositoryRoot, report),
    );
    const reportFile = join(catalog.repositoryRoot, first);
    expect(new Uint8Array(await readFile(reportFile))).toEqual(bytes);
    expect((await stat(reportFile)).mode & 0o777).toBe(0o600);
    expect(
      (await stat(join(catalog.repositoryRoot, "readiness", "execution-evidence"))).mode & 0o777,
    ).toBe(0o700);
    expect(success(await api.writeExecutionAuthorityReportV1(catalog.repositoryRoot, report))).toBe(
      first,
    );

    const different = { ...report, seed: "8".repeat(64) };
    expect((await api.writeExecutionAuthorityReportV1(catalog.repositoryRoot, different)).ok).toBe(
      false,
    );
    expect(new Uint8Array(await readFile(reportFile))).toEqual(bytes);

    const review = JSON.parse(new TextDecoder().decode(catalog.semanticReviewBytes)) as Record<
      string,
      unknown
    >;
    review.localAcmeVice = { digest: reportDigest, outcome: "accepted" };
    const reviewed = await prepareExecutionPublicationCandidateV1({
      repositoryRoot: catalog.repositoryRoot,
      parentDigest: catalog.parentDigest,
      bindingBytes: catalog.bindingBytes,
      semanticReviewBytes: encodeCanonicalJsonV1(review),
    });
    expect(reviewed.ok).toBe(true);
    expect(JSON.stringify(review)).toContain(reportDigest);

    for (const fault of [
      "after-temporary-create",
      "after-temporary-write",
      "after-temporary-file-sync",
      "before-report-rename",
      "after-report-rename",
      "after-report-directory-sync",
      "during-report-reconciliation",
    ] as const) {
      const faultRoot = join(catalog.repositoryRoot, `report-fault-${fault}`);
      success(await api.writeExecutionAuthorityReportV1(faultRoot, report));
      const faulted = await scoped({ reportFaults: [fault] }, () =>
        api.writeExecutionAuthorityReportV1(faultRoot, different),
      );
      expect(faulted.value.ok).toBe(false);
      expect(new Uint8Array(await readFile(join(faultRoot, REPORT_PATH)))).toEqual(bytes);
      const entries = await readdir(faultRoot, { recursive: true }).catch(() => [] as string[]);
      expect(entries.some((entry) => String(entry).includes(".tmp"))).toBe(false);
    }
  });
});
