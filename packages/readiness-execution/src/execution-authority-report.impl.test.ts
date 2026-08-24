import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { mkdirSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  authorizeExecutionAuthorityReportV1,
  EXECUTION_AUTHORITY_REPORT_PATH_V1,
  serializeExecutionAuthorityReportV1,
  writeExecutionAuthorityReportV1,
} from "./execution-authority-report.js";
import { runWithExecutionOrchestrationConformanceV1 } from "./execution-orchestration-conformance-v1.js";
import { deriveCampaignRouteExecutionIdentityV1 } from "./execution-orchestration-identity.js";
import type { ExecutionAuthorityReportV1 } from "./execution-orchestration.js";
import type { ExecutionResultV1 } from "@blend65/readiness";

const roots: string[] = [];
const DIGESTS = ["a", "b", "c", "d"].map((value) => `sha256:${value.repeat(64)}`) as [
  string,
  string,
  string,
  string,
];
const PASS_RESULT = Object.freeze({
  status: "pass" as const,
  tier: "frontend" as const,
  stage: "frontend" as const,
  code: "pass" as const,
  usage: Object.freeze({
    wallMs: 1,
    outputBytes: 2,
    evidenceBytes: 3,
    instructions: 4,
    cycles: 5,
    launchAttempts: 0,
  }),
  evidence: Object.freeze({ digest: DIGESTS[0], retainedBytes: 3, truncated: false }),
});

function routeRecord(result: ExecutionResultV1) {
  return Object.freeze({
    caseIdentity: DIGESTS[0],
    executionIdentity: deriveCampaignRouteExecutionIdentityV1({
      routePlanDigest: DIGESTS[3],
      caseIdentity: DIGESTS[0],
      ruleId: "rule.example",
      obligation: "frontend",
      terminalTier: "frontend",
      requiredTools: [],
    }),
    ruleId: "rule.example",
    obligation: "frontend",
    terminalTier: "frontend" as const,
    requiredTools: Object.freeze([]),
    unavailableTools: Object.freeze([]),
    result,
  });
}

function report(seed = `sha256:${"7".repeat(64)}`): ExecutionAuthorityReportV1 {
  return authorizeExecutionAuthorityReportV1(
    Object.freeze({
      revision: "execution-authority-report-v1",
      parentDigest: DIGESTS[0],
      executionDigest: DIGESTS[0],
      oracleDigest: DIGESTS[1],
      campaignDigest: DIGESTS[2],
      routePlanDigest: DIGESTS[3],
      target: "c64",
      seed,
      toolVersions: Object.freeze([
        Object.freeze({ tool: "node" as const, version: "22.0.0" }),
        Object.freeze({ tool: "acme" as const, version: "0.97" }),
        Object.freeze({ tool: "vice" as const, version: "3.10" }),
      ]),
      projectionRevisions: Object.freeze([
        "c64-vic-color-observation-v1" as const,
        "c64-vic-color-readback-v1" as const,
      ]),
      results: Object.freeze([]),
      routeRecords: Object.freeze([]),
      residualBlockers: Object.freeze([]),
      summary: Object.freeze({
        status: "pass" as const,
        selectedCases: 0,
        passedCases: 0,
        blockers: Object.freeze([]),
      }),
    }),
  );
}

async function root(): Promise<string> {
  const created = await mkdtemp(join(tmpdir(), "blend65-execution-report-"));
  roots.push(created);
  return created;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

describe("execution authority report publication", () => {
  it("serializes closed machine-neutral reports and rejects malformed aggregates", () => {
    const value = report();
    const first = serializeExecutionAuthorityReportV1(value);
    expect(serializeExecutionAuthorityReportV1(value)).toEqual(first);
    expect(new TextDecoder().decode(first)).toBe(`${JSON.stringify(value)}\n`);
    expect(() => serializeExecutionAuthorityReportV1({ ...value })).toThrow(
      "was not minted by campaign orchestration",
    );
    expect(() =>
      serializeExecutionAuthorityReportV1({
        ...value,
        unexpected: true,
      } as ExecutionAuthorityReportV1),
    ).toThrow();
    expect(() =>
      serializeExecutionAuthorityReportV1({
        ...value,
        summary: { ...value.summary, blockers: ["z", "a"] },
      }),
    ).toThrow();
    for (const malformed of [
      null,
      [],
      Object.create({}),
      { ...value, revision: "unknown" },
      { ...value, parentDigest: "invalid" },
      { ...value, target: "x16" },
      { ...value, seed: "" },
      { ...value, toolVersions: [] },
      { ...value, toolVersions: "invalid" },
      {
        ...value,
        toolVersions: [
          { tool: "acme", version: "0.97" },
          { tool: "node", version: "22" },
          { tool: "vice", version: "3.10" },
        ],
      },
      { ...value, projectionRevisions: [] },
      { ...value, results: [{}] },
      { ...value, results: "invalid" },
      { ...value, routeRecords: [{}] },
      { ...value, residualBlockers: ["invalid"] },
      { ...value, summary: { ...value.summary, status: "unknown" } },
      { ...value, summary: { ...value.summary, selectedCases: -1 } },
      { ...value, summary: { ...value.summary, selectedCases: 1 } },
      { ...value, summary: { ...value.summary, passedCases: 1 } },
      { ...value, summary: { ...value.summary, blockers: [""] } },
    ]) {
      expect(() => serializeExecutionAuthorityReportV1(malformed as never)).toThrow();
    }
    const reportWithResult = authorizeExecutionAuthorityReportV1({
      ...value,
      results: [PASS_RESULT],
      routeRecords: [routeRecord(PASS_RESULT)],
      summary: { status: "pass" as const, selectedCases: 1, passedCases: 1, blockers: [] },
    });
    expect(() => serializeExecutionAuthorityReportV1(reportWithResult)).not.toThrow();
    const canonicalResultReport = JSON.parse(
      new TextDecoder().decode(serializeExecutionAuthorityReportV1(reportWithResult)),
    ) as {
      results: [{ usage: { wallMs: number } }];
      routeRecords: [{ executionIdentity: string }];
    };
    expect(canonicalResultReport.results[0].usage.wallMs).toBe(0);
    expect(canonicalResultReport.routeRecords[0].executionIdentity).not.toBe(DIGESTS[0]);
    for (const inconsistent of [
      { ...reportWithResult, summary: { ...reportWithResult.summary, status: "failure" } },
      { ...reportWithResult, summary: { ...reportWithResult.summary, passedCases: 0 } },
      {
        ...reportWithResult,
        summary: { ...reportWithResult.summary, blockers: ["execution-failure:compiler-ice"] },
      },
      {
        ...reportWithResult,
        routeRecords: [
          {
            ...routeRecord(PASS_RESULT),
            executionIdentity: DIGESTS[0],
          },
        ],
      },
      {
        ...reportWithResult,
        routeRecords: [
          {
            ...routeRecord(PASS_RESULT),
            result: { ...PASS_RESULT, status: "failure", code: "compiler-ice" },
          },
        ],
      },
      {
        ...reportWithResult,
        residualBlockers: ["residual:rule:rule.other"],
      },
    ]) {
      expect(() => serializeExecutionAuthorityReportV1(inconsistent as never)).toThrow();
    }
    const accessorReport = { ...value };
    Object.defineProperty(accessorReport, "seed", { enumerable: true, get: () => value.seed });
    expect(() => serializeExecutionAuthorityReportV1(accessorReport)).toThrow();
    const hostileReport = new Proxy(
      { ...value },
      {
        ownKeys: () => {
          throw new TypeError("hostile");
        },
      },
    );
    expect(() => serializeExecutionAuthorityReportV1(hostileReport)).toThrow();
    const sparseTools = [...value.toolVersions];
    delete sparseTools[1];
    expect(() =>
      serializeExecutionAuthorityReportV1({ ...value, toolVersions: sparseTools as never }),
    ).toThrow();
    const hiddenTool = [...value.toolVersions];
    Object.defineProperty(hiddenTool, "1", { enumerable: false, value: hiddenTool[1] });
    expect(() =>
      serializeExecutionAuthorityReportV1({ ...value, toolVersions: hiddenTool }),
    ).toThrow();
    const hostileTools = new Proxy([...value.toolVersions], {
      ownKeys: () => {
        throw new TypeError("hostile");
      },
    });
    expect(() =>
      serializeExecutionAuthorityReportV1({ ...value, toolVersions: hostileTools }),
    ).toThrow();
    const failureResult = {
      ...PASS_RESULT,
      status: "failure" as const,
      code: "semantic-mismatch" as const,
      adapterSubcode: "mismatch",
    };
    expect(() =>
      serializeExecutionAuthorityReportV1(
        authorizeExecutionAuthorityReportV1({
          ...value,
          results: [failureResult],
          routeRecords: [routeRecord(failureResult)],
          summary: {
            status: "failure",
            selectedCases: 1,
            passedCases: 0,
            blockers: ["execution-failure:semantic-mismatch"],
          },
        }),
      ),
    ).not.toThrow();
  });

  it("publishes once, permits identical bytes, and never overwrites different evidence", async () => {
    const repositoryRoot = await root();
    const first = report();
    const firstBytes = serializeExecutionAuthorityReportV1(first);
    const written = await writeExecutionAuthorityReportV1(repositoryRoot, first);
    expect(written).toEqual({ ok: true, value: EXECUTION_AUTHORITY_REPORT_PATH_V1 });
    if (!written.ok) throw new TypeError("Expected initial report publication.");
    expect(new Uint8Array(await readFile(join(repositoryRoot, written.value)))).toEqual(firstBytes);
    expect((await stat(join(repositoryRoot, written.value))).mode & 0o777).toBe(0o600);
    expect((await stat(join(repositoryRoot, "readiness", "execution-evidence"))).mode & 0o777).toBe(
      0o700,
    );
    expect(await writeExecutionAuthorityReportV1(repositoryRoot, first)).toEqual(written);
    expect(
      (await writeExecutionAuthorityReportV1(repositoryRoot, report(`sha256:${"8".repeat(64)}`)))
        .ok,
    ).toBe(false);
    expect(new Uint8Array(await readFile(join(repositoryRoot, written.value)))).toEqual(firstBytes);
  });

  it("allows exactly one of two different concurrent publications to win", async () => {
    const repositoryRoot = await root();
    const left = report(`sha256:${"1".repeat(64)}`);
    const right = report(`sha256:${"2".repeat(64)}`);
    const outcomes = await Promise.all([
      writeExecutionAuthorityReportV1(repositoryRoot, left),
      writeExecutionAuthorityReportV1(repositoryRoot, right),
    ]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    const retained = new Uint8Array(
      await readFile(join(repositoryRoot, EXECUTION_AUTHORITY_REPORT_PATH_V1)),
    );
    expect([
      serializeExecutionAuthorityReportV1(left),
      serializeExecutionAuthorityReportV1(right),
    ]).toContainEqual(retained);
    const entries = await readdir(join(repositoryRoot, "readiness", "execution-evidence"));
    expect(entries).toEqual(["rd-04-local-v1.json"]);
  });

  it("reconciles two identical concurrent publications as the same authority", async () => {
    const repositoryRoot = await root();
    const value = report();
    const outcomes = await Promise.all([
      writeExecutionAuthorityReportV1(repositoryRoot, value),
      writeExecutionAuthorityReportV1(repositoryRoot, value),
    ]);
    expect(outcomes).toEqual([
      { ok: true, value: EXECUTION_AUTHORITY_REPORT_PATH_V1 },
      { ok: true, value: EXECUTION_AUTHORITY_REPORT_PATH_V1 },
    ]);
    expect(
      new Uint8Array(await readFile(join(repositoryRoot, EXECUTION_AUTHORITY_REPORT_PATH_V1))),
    ).toEqual(serializeExecutionAuthorityReportV1(value));
  });

  it("rejects noncanonical roots and symlinked report ancestors", async () => {
    const repositoryRoot = await root();
    expect((await writeExecutionAuthorityReportV1("relative", report())).ok).toBe(false);
    expect((await writeExecutionAuthorityReportV1(repositoryRoot, null as never)).ok).toBe(false);
    expect((await writeExecutionAuthorityReportV1(`${repositoryRoot}/.`, report())).ok).toBe(false);
    const outside = await root();
    await symlink(outside, join(repositoryRoot, "readiness"));
    expect((await writeExecutionAuthorityReportV1(repositoryRoot, report())).ok).toBe(false);
    expect(await readdir(outside)).toEqual([]);
  });

  it("rejects symlinked and special existing report targets", async () => {
    for (const kind of ["symlink", "directory", "hardlink"] as const) {
      const repositoryRoot = await root();
      const directory = join(repositoryRoot, "readiness", "execution-evidence");
      const target = join(repositoryRoot, EXECUTION_AUTHORITY_REPORT_PATH_V1);
      await mkdir(directory, { recursive: true });
      if (kind === "symlink") {
        const outside = join(await root(), "outside.json");
        await writeFile(outside, "outside");
        await symlink(outside, target);
      } else if (kind === "hardlink") {
        const outside = join(await root(), "outside.json");
        await writeFile(outside, serializeExecutionAuthorityReportV1(report()));
        await link(outside, target);
      } else {
        await mkdir(target);
      }
      expect((await writeExecutionAuthorityReportV1(repositoryRoot, report())).ok).toBe(false);
    }
  });

  it("fails closed when the pinned report directory is replaced before commit", async () => {
    const repositoryRoot = await root();
    const directory = join(repositoryRoot, "readiness", "execution-evidence");
    const displaced = join(repositoryRoot, "readiness", "execution-evidence-displaced");
    let replaced = false;
    const result = await runWithExecutionOrchestrationConformanceV1(
      {
        atReportBoundary: (point) => {
          if (point !== "before-report-rename" || replaced) return;
          renameSync(directory, displaced);
          mkdirSync(directory, { mode: 0o700 });
          replaced = true;
        },
      },
      () => writeExecutionAuthorityReportV1(repositoryRoot, report()),
    );

    expect(replaced).toBe(true);
    expect(result.value.ok).toBe(false);
    await expect(
      readFile(join(repositoryRoot, EXECUTION_AUTHORITY_REPORT_PATH_V1)),
    ).rejects.toThrow();
  });

  it("fails closed when an identical report read is followed by directory replacement", async () => {
    const repositoryRoot = await root();
    const directory = join(repositoryRoot, "readiness", "execution-evidence");
    const displaced = join(repositoryRoot, "readiness", "execution-evidence-read-displaced");
    const value = report();
    expect((await writeExecutionAuthorityReportV1(repositoryRoot, value)).ok).toBe(true);
    let replaced = false;
    const result = await runWithExecutionOrchestrationConformanceV1(
      {
        atReportBoundary: (point) => {
          if (point !== "after-existing-report-read" || replaced) return;
          renameSync(directory, displaced);
          mkdirSync(directory, { mode: 0o700 });
          replaced = true;
        },
      },
      () => writeExecutionAuthorityReportV1(repositoryRoot, value),
    );

    expect(replaced).toBe(true);
    expect(result.value.ok).toBe(false);
  });

  it("consumes every fault once, preserves prior bytes, and records reconciliation", async () => {
    for (const point of [
      "after-temporary-create",
      "after-temporary-write",
      "after-temporary-file-sync",
      "before-report-rename",
      "after-report-rename",
      "after-report-directory-sync",
      "during-report-reconciliation",
    ] as const) {
      const repositoryRoot = await root();
      const original = report();
      const originalBytes = serializeExecutionAuthorityReportV1(original);
      expect((await writeExecutionAuthorityReportV1(repositoryRoot, original)).ok).toBe(true);
      const structuralCopy = {
        ...report(`sha256:${"9".repeat(64)}`),
      };
      expect(() => serializeExecutionAuthorityReportV1(structuralCopy)).toThrow(
        "Execution authority report was not minted by campaign orchestration.",
      );
      const faulted = await runWithExecutionOrchestrationConformanceV1(
        { reportFaults: [point] },
        () => writeExecutionAuthorityReportV1(repositoryRoot, structuralCopy),
      );
      expect(faulted.value.ok).toBe(false);
      expect(faulted.transcript.filter((entry) => entry.kind === "report-fault")).toEqual([
        { kind: "report-fault", point },
      ]);
      expect(
        new Uint8Array(await readFile(join(repositoryRoot, EXECUTION_AUTHORITY_REPORT_PATH_V1))),
      ).toEqual(originalBytes);
      const entries = await readdir(join(repositoryRoot, "readiness", "execution-evidence"));
      expect(entries).toEqual(["rd-04-local-v1.json"]);
      expect(() => serializeExecutionAuthorityReportV1(structuralCopy)).toThrow(
        "Execution authority report was not minted by campaign orchestration.",
      );
    }
  });

  it("classifies post-commit faults without returning a false success", async () => {
    for (const point of [
      "after-report-rename",
      "after-report-directory-sync",
      "during-report-reconciliation",
    ] as const) {
      const repositoryRoot = await root();
      const value = report();
      const faulted = await runWithExecutionOrchestrationConformanceV1(
        { reportFaults: [point] },
        () => writeExecutionAuthorityReportV1(repositoryRoot, value),
      );
      expect(faulted.value.ok).toBe(false);
      expect(faulted.transcript).toContainEqual({
        kind: "report-reconciliation",
        state: "committed",
      });
      expect(
        new Uint8Array(await readFile(join(repositoryRoot, EXECUTION_AUTHORITY_REPORT_PATH_V1))),
      ).toEqual(serializeExecutionAuthorityReportV1(value));
    }
  });
});
