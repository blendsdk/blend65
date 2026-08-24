import { describe, expect, it } from "vitest";

import {
  consumeExecutionReportFaultV1,
  getExecutionEnvironmentCapabilitiesOverrideV1,
  getPendingExecutionReportFaultV1,
  recordExecutionReportReconciliationV1,
  recordPlannedExecutionV1,
  runWithExecutionOrchestrationConformanceV1,
  snapshotExecutionResultForOrchestrationV1,
  takeExecutionResultSubstitutionV1,
} from "./execution-orchestration-conformance-v1.js";

const DIGEST = `sha256:${"a".repeat(64)}`;
const RESULT = Object.freeze({
  status: "pass" as const,
  tier: "frontend" as const,
  stage: "frontend" as const,
  code: "pass" as const,
  usage: Object.freeze({
    wallMs: 0,
    outputBytes: 0,
    evidenceBytes: 0,
    instructions: 0,
    cycles: 0,
    launchAttempts: 0,
  }),
  evidence: Object.freeze({ digest: DIGEST, retainedBytes: 0, truncated: false }),
});

describe("execution orchestration conformance", () => {
  it("copies controls and returns only a frozen bounded transcript", async () => {
    const controls = {
      actualResults: [{ executionIdentity: DIGEST, tier: "frontend" as const, result: RESULT }],
      reportFaults: ["after-temporary-create" as const],
    };
    const run = await runWithExecutionOrchestrationConformanceV1(controls, async () => {
      recordPlannedExecutionV1(DIGEST, "frontend", "rule.example", "frontend");
      expect(takeExecutionResultSubstitutionV1(DIGEST, "frontend")).toEqual(RESULT);
      expect(consumeExecutionReportFaultV1("after-temporary-create")).toBe(true);
      recordExecutionReportReconciliationV1("prior-report");
      return true;
    });

    expect(run.value).toBe(true);
    expect(run.transcript.map((entry) => entry.kind)).toEqual([
      "planned-execution",
      "result-substitution",
      "report-fault",
      "report-reconciliation",
    ]);
    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(run.transcript)).toBe(true);
    expect(run.transcript.every((entry) => Object.isFrozen(entry))).toBe(true);
  });

  it("rejects duplicate, unmatched, unused, nested, and malformed controls", async () => {
    const substitution = { executionIdentity: DIGEST, tier: "frontend" as const, result: RESULT };
    await expect(
      runWithExecutionOrchestrationConformanceV1(
        { actualResults: [substitution, substitution] },
        async () => true,
      ),
    ).rejects.toThrow();
    await expect(
      runWithExecutionOrchestrationConformanceV1(
        { actualResults: [substitution] },
        async () => true,
      ),
    ).rejects.toThrow();
    await expect(
      runWithExecutionOrchestrationConformanceV1(
        { reportFaults: ["after-temporary-write"] },
        async () => true,
      ),
    ).rejects.toThrow();
    await expect(
      runWithExecutionOrchestrationConformanceV1(
        { reportFaults: ["after-temporary-write", "after-temporary-write"] },
        async () => true,
      ),
    ).rejects.toThrow();
    await expect(
      runWithExecutionOrchestrationConformanceV1({ actualResults: [substitution] }, async () => {
        expect(takeExecutionResultSubstitutionV1(`sha256:${"b".repeat(64)}`, "frontend")).toBe(
          undefined,
        );
        return true;
      }),
    ).rejects.toThrow();
    await expect(
      runWithExecutionOrchestrationConformanceV1({}, () =>
        runWithExecutionOrchestrationConformanceV1({}, async () => true),
      ),
    ).rejects.toThrow();
    await expect(
      runWithExecutionOrchestrationConformanceV1(
        { actualResults: [{ ...substitution, result: { ...RESULT, tier: "vice" } }] },
        async () => true,
      ),
    ).rejects.toThrow();
  });

  it("isolates concurrent scopes and leaves genuine no-scope behavior untouched", async () => {
    expect(getExecutionEnvironmentCapabilitiesOverrideV1()).toBeUndefined();
    expect(getPendingExecutionReportFaultV1()).toBeUndefined();
    expect(takeExecutionResultSubstitutionV1(DIGEST, "frontend")).toBeUndefined();
    expect(consumeExecutionReportFaultV1("before-report-rename")).toBe(false);
    recordPlannedExecutionV1(DIGEST, "frontend", "rule.no-scope", "frontend");
    recordExecutionReportReconciliationV1("ambiguous");

    const first = runWithExecutionOrchestrationConformanceV1(
      {
        capabilities: {
          acme: { available: true, version: "0.97" },
          vice: { available: false },
        },
        reportFaults: ["before-report-rename"],
      },
      async () => {
        await Promise.resolve();
        expect(getExecutionEnvironmentCapabilitiesOverrideV1()).toEqual({
          acme: { available: true, version: "0.97" },
          vice: { available: false },
        });
        expect(consumeExecutionReportFaultV1("before-report-rename")).toBe(true);
        return "first";
      },
    );
    const second = runWithExecutionOrchestrationConformanceV1(
      {
        capabilities: {
          acme: { available: false },
          vice: { available: true, version: "3.10" },
        },
        reportFaults: ["after-report-directory-sync"],
      },
      async () => {
        await Promise.resolve();
        expect(getExecutionEnvironmentCapabilitiesOverrideV1()).toEqual({
          acme: { available: false },
          vice: { available: true, version: "3.10" },
        });
        expect(consumeExecutionReportFaultV1("after-report-directory-sync")).toBe(true);
        return "second";
      },
    );

    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        value: "first",
        transcript: [{ kind: "report-fault", point: "before-report-rename" }],
      },
      {
        value: "second",
        transcript: [{ kind: "report-fault", point: "after-report-directory-sync" }],
      },
    ]);
    expect(getExecutionEnvironmentCapabilitiesOverrideV1()).toBeUndefined();
  });

  it("rejects every detached access after the authorized operation closes", async () => {
    let completeDetached: ((errors: readonly unknown[]) => void) | undefined;
    const detached = new Promise<readonly unknown[]>((resolve) => {
      completeDetached = resolve;
    });
    await runWithExecutionOrchestrationConformanceV1({}, async () => {
      setTimeout(() => {
        const errors: unknown[] = [];
        for (const operation of [
          () => getExecutionEnvironmentCapabilitiesOverrideV1(),
          () => takeExecutionResultSubstitutionV1(DIGEST, "frontend"),
          () => recordPlannedExecutionV1(DIGEST, "frontend", "rule.detached", "frontend"),
        ]) {
          try {
            operation();
          } catch (error) {
            errors.push(error);
          }
        }
        completeDetached?.(errors);
      }, 0);
      return true;
    });

    const errors = await detached;
    expect(errors).toHaveLength(3);
    expect(errors.every((error) => error instanceof TypeError)).toBe(true);
    expect(errors.every((error) => String(error).includes("scope is closed"))).toBe(true);
  });

  it("rejects hostile schemas, invalid results, and repeated consumption", async () => {
    for (const controls of [
      null,
      [],
      Object.create({}),
      { unknown: true },
      { capabilities: { acme: { available: true }, vice: { available: "yes" } } },
      { capabilities: { acme: { available: true, version: "" }, vice: { available: true } } },
      { actualResults: "invalid" },
      {
        actualResults: [{ executionIdentity: "invalid", tier: "frontend", result: RESULT }],
      },
      {
        actualResults: [{ executionIdentity: DIGEST, tier: "unknown", result: RESULT }],
      },
      { reportFaults: ["unknown"] },
    ]) {
      await expect(
        runWithExecutionOrchestrationConformanceV1(controls as never, async () => true),
      ).rejects.toThrow();
    }
    const accessor = {};
    Object.defineProperty(accessor, "capabilities", { enumerable: true, get: () => ({}) });
    await expect(
      runWithExecutionOrchestrationConformanceV1(accessor, async () => true),
    ).rejects.toThrow();
    const sparse: unknown[] = [];
    sparse.length = 1;
    await expect(
      runWithExecutionOrchestrationConformanceV1(
        { actualResults: sparse as never },
        async () => true,
      ),
    ).rejects.toThrow();

    for (const candidate of [
      { ...RESULT, tier: "vice" },
      { ...RESULT, stage: "unknown" },
      { ...RESULT, code: "semantic-mismatch" },
      { ...RESULT, status: "unknown" },
      { ...RESULT, usage: { ...RESULT.usage, wallMs: -1 } },
      { ...RESULT, evidence: { ...RESULT.evidence, digest: "invalid" } },
      { ...RESULT, evidence: { ...RESULT.evidence, retainedBytes: -1 } },
      { ...RESULT, adapterSubcode: "unexpected" },
    ]) {
      expect(() => snapshotExecutionResultForOrchestrationV1(candidate, "frontend")).toThrow();
    }
    expect(
      snapshotExecutionResultForOrchestrationV1(
        { ...RESULT, usage: { ...RESULT.usage, wallMs: 0.5 } },
        "frontend",
      ).usage.wallMs,
    ).toBe(0.5);
    expect(
      snapshotExecutionResultForOrchestrationV1(
        {
          ...RESULT,
          evidence: { ...RESULT.evidence, digest: DIGEST.slice("sha256:".length) },
        },
        "frontend",
      ).evidence.digest,
    ).toBe(DIGEST);
    expect(() =>
      snapshotExecutionResultForOrchestrationV1(
        {
          ...RESULT,
          status: "failure",
          code: "semantic-mismatch",
          adapterSubcode: "",
        },
        "frontend",
      ),
    ).toThrow();
    expect(() =>
      snapshotExecutionResultForOrchestrationV1(
        {
          ...RESULT,
          status: "failure",
          code: "semantic-mismatch",
          cleanupBlocker: { code: "invalid", evidenceDigest: DIGEST },
        },
        "frontend",
      ),
    ).toThrow();
    expect(
      snapshotExecutionResultForOrchestrationV1(
        {
          ...RESULT,
          status: "failure",
          code: "semantic-mismatch",
          cleanupBlocker: {
            code: "emulator-lease-recovery-blocked",
            evidenceDigest: DIGEST.slice("sha256:".length),
          },
        },
        "frontend",
      ),
    ).toMatchObject({ cleanupBlocker: { evidenceDigest: DIGEST } });
    for (const evidenceDigest of ["invalid", "A".repeat(64), "a".repeat(63)]) {
      expect(() =>
        snapshotExecutionResultForOrchestrationV1(
          {
            ...RESULT,
            status: "failure",
            code: "semantic-mismatch",
            cleanupBlocker: {
              code: "emulator-lease-recovery-blocked",
              evidenceDigest,
            },
          },
          "frontend",
        ),
      ).toThrow();
    }

    await expect(
      runWithExecutionOrchestrationConformanceV1(
        {
          actualResults: [{ executionIdentity: DIGEST, tier: "frontend", result: RESULT }],
          reportFaults: ["before-report-rename"],
        },
        async () => {
          expect(takeExecutionResultSubstitutionV1(DIGEST, "frontend")).toEqual(RESULT);
          expect(() => takeExecutionResultSubstitutionV1(DIGEST, "frontend")).toThrow();
          expect(consumeExecutionReportFaultV1("before-report-rename")).toBe(true);
          expect(() => consumeExecutionReportFaultV1("before-report-rename")).toThrow();
        },
      ),
    ).resolves.toBeDefined();
    await expect(
      runWithExecutionOrchestrationConformanceV1({}, undefined as never),
    ).rejects.toThrow();
    expect(() => recordPlannedExecutionV1("invalid", "frontend", "rule", "frontend")).toThrow();
  });

  it("fails closed at the transcript capacity boundary", async () => {
    await expect(
      runWithExecutionOrchestrationConformanceV1({}, async () => {
        for (let index = 0; index <= 16_384; index += 1) {
          recordPlannedExecutionV1(DIGEST, "frontend", `rule.${index}`, "frontend");
        }
      }),
    ).rejects.toThrow("transcript capacity");
  });
});
