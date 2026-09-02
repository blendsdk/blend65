import { describe, expect, it } from "vitest";

import type {
  FailureExecutionCheckpointReferenceV1 as CheckpointReferenceV1,
  FailureExecutionConfirmationResultV1 as ConfirmationResultV1,
  FailureExecutionConfirmationStepV1 as ConfirmationStepV1,
  FailureExecutionObservationV1 as ObservationV1,
  FailureExecutionSpecDataV1 as Data,
  FailureExecutionSpecResultV1 as Result,
} from "./test-fixtures/failure-execution-spec-fixture.js";
import {
  call,
  confirmationContext,
  driveConfirmation,
  failure,
  fixture,
  invocation,
  protocol,
  record,
  success,
} from "./failure-candidate-execution-spec-support.js";
import { installFailureExecutionToolVersionDriftV1 } from "./test-fixtures/failure-execution-tool-drift.js";

describe("failure candidate confirmation oracle", () => {
  it("should reject complete predicate, normalized observation, and cleanup mismatches before execution", async () => {
    const value = await fixture("standalone-stable");
    const api = value.apis;
    const before = value.activity.workerRequests.length;
    for (const origin of [
      value.mismatchAuthorities.predicate,
      value.mismatchAuthorities.observation,
      value.mismatchAuthorities.cleanup,
    ]) {
      failure(
        call<Result<unknown>>(api.internals, "createFailureConfirmationContextV1", {
          report: value.report,
          subject: value.subjectPosition,
          candidate: value.candidate,
          origin,
          budget: value.budget,
        }),
        "historical-authority-unavailable",
      );
    }
    expect(value.activity.workerRequests).toHaveLength(before);
  }, 600_000);

  // Every authority comes from the same exact report occurrence; structural and current fallbacks fail.
  it("should reject wrong report positions, route plans, tools, candidate envelopes, and structural report copies", async () => {
    const value = await fixture("standalone-stable", { includeForeignToolOrigin: true });
    const api = value.apis;
    const before = value.activity.workerRequests.length;
    const foreignToolOrigin = value.mismatchAuthorities.tool;
    if (foreignToolOrigin === undefined) throw new TypeError("foreign tool origin");
    const foreignCandidate = value.mismatchAuthorities.candidate;
    if (foreignCandidate === undefined) throw new TypeError("foreign candidate");
    const otherPosition = value.reportPositions.find(
      (position) => position !== value.subjectPosition,
    );
    if (otherPosition === undefined) throw new TypeError("distinct report occurrence");
    const foreignToolProjection = success(
      call<Result<Data>>(api.readiness, "getFailureEnvelopeProjectionV1", foreignToolOrigin),
    );
    const foreignToolVersions = foreignToolProjection.toolVersions;
    if (!Array.isArray(foreignToolVersions)) throw new TypeError("historical tool versions");
    const serializedToolVersions = JSON.stringify(foreignToolVersions);
    expect(serializedToolVersions).toContain(process.versions.node);
    expect(serializedToolVersions).toContain("0.97");
    expect(serializedToolVersions).toContain("3.10");
    for (const input of [
      { subject: otherPosition },
      { report: { ...value.report } },
      { origin: value.mismatchAuthorities.routePlan },
      { origin: foreignToolOrigin },
      { candidate: foreignCandidate },
    ]) {
      failure(
        call<Result<unknown>>(api.internals, "createFailureConfirmationContextV1", {
          report: value.report,
          subject: value.subjectPosition,
          candidate: value.candidate,
          origin: value.origin,
          budget: value.budget,
          ...input,
        }),
        "historical-authority-unavailable",
      );
    }
    expect(value.activity.workerRequests).toHaveLength(before);
  }, 600_000);

  // Every minimized source failure receives two fresh confirmations, including direct-shrink failures.
  it("should confirm a direct-shrink failure twice in genuinely distinct standalone isolates without a control", async () => {
    const value = await fixture("direct-shrink-stable");
    const api = value.apis;
    const driven = await driveConfirmation(api, value);
    const routeRecords = record(value.report, "report").routeRecords;
    if (!Array.isArray(routeRecords)) throw new TypeError("report route records");
    const subjectResult = record(
      record(routeRecords[value.subjectIndex], "subject route record").result,
      "subject result",
    );
    expect(["diagnostic-mismatch", "unexpected-emission", "semantic-mismatch"]).toContain(
      subjectResult.code,
    );
    expect(driven.result).toMatchObject({
      revision: "failure-confirmation-result-v1",
      disposition: "confirmed-source-failure",
      confirmationDigests: [
        expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      ],
      confirmationCheckpoints: [
        {
          digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
          reportPosition: value.subjectIndex + 1,
          attemptOrdinal: 1,
          position: 0,
        },
        {
          digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
          reportPosition: value.subjectIndex + 1,
          attemptOrdinal: 2,
          position: 0,
        },
      ],
    });
    expect(new Set(driven.result.confirmationCheckpoints.map((entry) => entry.digest)).size).toBe(
      2,
    );
    expect(driven.steps.filter((step) => step.kind === "execute-candidate")).toHaveLength(2);
    expect(driven.steps.filter((step) => step.kind === "execute-control")).toHaveLength(0);
    expect(new Set(value.activity.workerThreads).size).toBeGreaterThanOrEqual(2);
    expect(new Set(value.activity.rootIdentities).size).toBeGreaterThanOrEqual(2);
    expect(new Set(value.activity.isolateIdentities).size).toBeGreaterThanOrEqual(2);
  }, 600_000);

  describe.sequential("sequence attempt boundaries", () => {
    // A sequence attempt authenticates ordered originals and exactly one terminal candidate.
    it.each([2, 3, 4, 5, 6, 7, 8, 9, 64] as const)(
      "should bind a failure at exact sequence position %i in one isolated attempt",
      async (failingPosition) => {
        const value = await fixture("sequence-only", {
          failingPosition,
          sequenceLength: failingPosition,
        });
        const api = value.apis;
        const beforeRequests = value.activity.workerRequests.length;
        const beforeBudget = success(
          call<Result<Data>>(api.readiness, "getFailureCampaignBudgetSnapshotV1", value.budget),
        );
        const driven = await driveConfirmation(api, value);
        const positions: number[] = [];
        const observations: ObservationV1[] = [];
        for (const step of driven.steps) {
          if (step.kind !== "execute-sequence-position" || step.position === undefined) continue;
          const observation = success(
            call<Result<ObservationV1>>(
              api.internals,
              "getFailureExecutionObservationV1",
              driven.protocol,
              step.position,
            ),
          );
          observations.push(observation);
          positions.push(observation.position);
        }
        expect(positions).toEqual(Array.from({ length: failingPosition }, (_, index) => index + 1));
        expect(driven.result.disposition).toBe("stateful-sequence-failure");
        expect(driven.result.confirmationCheckpoints).toMatchObject([
          {
            reportPosition: value.subjectIndex + 1,
            attemptOrdinal: 1,
            position: 0,
          },
          {
            reportPosition: value.subjectIndex + 1,
            attemptOrdinal: 2,
            position: 0,
          },
        ]);
        const sequenceEvidence = record(driven.result.sequenceEvidence, "sequence evidence");
        const checkpoints = sequenceEvidence.checkpoints;
        if (!Array.isArray(checkpoints)) throw new TypeError("sequence checkpoint evidence");
        const checkpointReferences = checkpoints as readonly CheckpointReferenceV1[];
        expect(checkpointReferences).toHaveLength(failingPosition);
        expect(checkpointReferences.map((entry) => entry.reportPosition)).toEqual(
          Array.from({ length: failingPosition }, (_, index) => index + 1),
        );
        expect(checkpointReferences.map((entry) => entry.position)).toEqual(
          Array.from({ length: failingPosition }, (_, index) => index + 1),
        );
        expect(new Set(checkpointReferences.map((entry) => entry.attemptOrdinal)).size).toBe(1);
        expect(new Set(checkpointReferences.map((entry) => entry.digest)).size).toBe(
          failingPosition,
        );
        expect(
          new Set(
            driven.steps
              .filter((step) => step.kind === "execute-sequence-position")
              .map((step) => step.attempt),
          ).size,
        ).toBeGreaterThanOrEqual(1);
        expect(new Set(observations.map((observation) => observation.workerIdentity)).size).toBe(1);
        expect(new Set(observations.map((observation) => observation.rootIdentity)).size).toBe(
          failingPosition,
        );
        const dedicatedRequests = value.activity.workerRequests
          .slice(beforeRequests)
          .filter((request) => request.dedicated);
        const orderedSubjects = dedicatedRequests
          .map((request) => request.caseIdentity)
          .filter(
            (identity, index, identities) => index === 0 || identities[index - 1] !== identity,
          );
        expect(orderedSubjects.slice(0, -1)).toEqual(
          value.originatingCaseIdentities.slice(0, failingPosition - 1),
        );
        expect(orderedSubjects.at(-1)).not.toBe(
          value.originatingCaseIdentities[failingPosition - 1],
        );
        const afterBudget = success(
          call<Result<Data>>(api.readiness, "getFailureCampaignBudgetSnapshotV1", value.budget),
        );
        const beforeUsed = record(beforeBudget.used, "before budget usage");
        const afterUsed = record(afterBudget.used, "after budget usage");
        expect(Number(afterUsed.sequenceCases) - Number(beforeUsed.sequenceCases)).toBe(
          failingPosition,
        );
        expect(Number(afterUsed.routeExecutions) - Number(beforeUsed.routeExecutions)).toBe(
          failingPosition + 2,
        );
        if (failingPosition === 64) {
          const attempt = driven.steps.find(
            (step) => step.kind === "execute-sequence-position",
          )?.attempt;
          if (attempt === undefined) throw new TypeError("completed sequence attempt");
          const beforeNext = value.activity.workerRequests.length;
          failure(
            call<Result<unknown>>(
              api.internals,
              "nextStatefulSequencePositionV1",
              driven.protocol,
              attempt,
            ),
          );
          expect(value.activity.workerRequests).toHaveLength(beforeNext);
        }
      },
      300_000,
    );

    it("should reject sequence position 65 before worker or handler launch", async () => {
      const overLimit = await fixture("sequence-only", {
        failingPosition: 2,
        sequenceLength: 64,
      });
      const api = overLimit.apis;
      const session = protocol(api, overLimit);
      const before = [...overLimit.activity.workerThreads];
      failure(
        call<Result<unknown>>(api.internals, "beginStatefulSequenceAttemptV1", session, {
          attemptOrdinal: 1,
          precedingOriginals: Array.from({ length: 64 }, () => overLimit.originalRequest),
          terminalCandidate: invocation(api, overLimit.candidate, "confirmation"),
          failingPosition: 65,
          caseLimit: 65,
        }),
      );
      expect(overLimit.activity.workerThreads).toEqual(before);
    }, 300_000);
  });

  // Evaluations remain opaque, single-use, and bound to one exact attempt, position, and subject.
  it("should reject copied and foreign sequence evaluations while retaining position-local checkpoints", async () => {
    const value = await fixture("sequence-only", { failingPosition: 2, sequenceLength: 2 });
    const api = value.apis;
    const sessionProtocol = protocol(api, value);
    const session = success(
      call<Result<object>>(
        api.internals,
        "createFailureConfirmationSessionV1",
        sessionProtocol,
        value.candidate,
        value.origin,
        value.budget,
      ),
    );
    let previousEvaluation: object | undefined;
    const observations: ObservationV1[] = [];
    for (let count = 0; count < 32; count += 1) {
      const step = success(
        call<Result<ConfirmationStepV1>>(
          api.internals,
          "nextFailureConfirmationStepV1",
          sessionProtocol,
          session,
        ),
      );
      if (step.kind === "complete") break;
      if (step.authority === undefined) throw new TypeError("confirmation authority");
      const evaluation = success(
        await call<Promise<Result<object>>>(
          api.internals,
          "executeFailureConfirmationStepV1",
          sessionProtocol,
          session,
          step.authority,
        ),
      );
      if (
        step.kind === "execute-sequence-position" &&
        step.attempt !== undefined &&
        step.position !== undefined
      ) {
        failure(
          call<Result<unknown>>(
            api.internals,
            "recordStatefulSequencePositionV1",
            sessionProtocol,
            step.attempt,
            step.position,
            { ...record(evaluation, "step evaluation") },
          ),
        );
        if (previousEvaluation !== undefined) {
          failure(
            call<Result<unknown>>(
              api.internals,
              "recordStatefulSequencePositionV1",
              sessionProtocol,
              step.attempt,
              step.position,
              previousEvaluation,
            ),
          );
        }
      }
      success(
        call<Result<true>>(
          api.internals,
          "recordFailureConfirmationStepV1",
          sessionProtocol,
          session,
          step.authority,
          evaluation,
        ),
      );
      if (step.kind === "execute-sequence-position" && step.position !== undefined) {
        observations.push(
          success(
            call<Result<ObservationV1>>(
              api.internals,
              "getFailureExecutionObservationV1",
              sessionProtocol,
              step.position,
            ),
          ),
        );
        previousEvaluation = evaluation;
      }
    }
    expect(observations.map((observation) => observation.position)).toEqual([1, 2]);
    expect(new Set(observations.map((observation) => observation.workerIdentity)).size).toBe(1);
    expect(new Set(observations.map((observation) => observation.rootIdentity)).size).toBe(2);
  });

  // Protocol close settles every owned executor and hides external rejection text.
  it("should attempt every owned shutdown, close authority, and return one deterministic aggregate issue", async () => {
    const value = await fixture("standalone-stable", { rejectOwnedShutdownOrdinal: 1 });
    const api = value.apis;
    const sessionProtocol = protocol(api, value);
    for (let ordinal = 0; ordinal < 3; ordinal += 1) {
      const subject = invocation(api, value.candidate, "confirmation");
      success(
        call<Result<object>>(
          api.internals,
          "mintStandaloneFailureExecutionIsolationV1",
          sessionProtocol,
          subject,
        ),
      );
    }
    const closed = await call<Promise<Result<true>>>(
      api.internals,
      "closeFailureExecutionProtocolV1",
      sessionProtocol,
    );
    failure(closed, "execution.io");
    if (closed.ok) throw new TypeError("shutdown rejection must remain observable");
    expect(closed.issues).toEqual([
      {
        code: "execution.io",
        path: "/isolation/shutdown",
        message: "1",
      },
    ]);
    expect(JSON.stringify(closed)).not.toContain("external worker fixture secret");
    expect(value.activity.ownedShutdownAttempts).toEqual([1, 2, 3]);
    failure(
      call<Result<unknown>>(
        api.internals,
        "mintCampaignFailureExecutionIsolationV1",
        sessionProtocol,
      ),
    );
  }, 600_000);

  // Fresh-run or sequence disagreement is flaky and never promotable beyond the campaign.
  it("should classify unstable fresh or sequence runs as flaky and keep them campaign-only", async () => {
    const value = await fixture("flaky");
    const api = value.apis;
    const direct = success(
      await call<Promise<Result<ConfirmationResultV1>>>(
        api.execution,
        "confirmReducedFailureV1",
        confirmationContext(api, value),
      ),
    );
    expect(direct).toMatchObject({ disposition: "flaky-failure" });
    expect(direct).not.toHaveProperty("promotionAuthority");
    expect(direct).not.toHaveProperty("sequenceEvidence.promotionAuthority");
  }, 600_000);

  // Infrastructure-like candidate failure is confirmed only after a passing same-route control.
  it("should require two infrastructure reproductions and a distinct passing same-route control", async () => {
    const value = await fixture("infrastructure-with-passing-control");
    const api = value.apis;
    const before = value.activity.workerRequests.length;
    const candidate = success(
      call<Result<Data>>(api.reduction, "getReductionCandidateProjectionV1", value.candidate),
    );
    const driven = await driveConfirmation(api, value);
    expect(driven.result.disposition).toBe("confirmed-source-failure");
    expect(driven.steps.filter((step) => step.kind === "execute-candidate")).toHaveLength(2);
    expect(driven.steps.filter((step) => step.kind === "execute-control")).toHaveLength(1);
    expect(new Set(value.activity.workerThreads).size).toBeGreaterThanOrEqual(3);
    const confirmationRequests = value.activity.workerRequests.slice(before);
    const candidateRequests = confirmationRequests.filter(
      (request) => request.caseIdentity === candidate.candidateExecutionIdentity,
    );
    const controlRequests = confirmationRequests.filter(
      (request) => request.caseIdentity !== candidate.candidateExecutionIdentity,
    );
    expect(candidateRequests.length).toBeGreaterThanOrEqual(2);
    expect(controlRequests.length).toBeGreaterThanOrEqual(1);
    const observedControl = controlRequests[0];
    if (observedControl === undefined) throw new TypeError("observed control request");
    const reportRecords = record(value.report, "report").routeRecords;
    if (!Array.isArray(reportRecords)) throw new TypeError("report route records");
    const controlIndex = reportRecords.findIndex((entry) => {
      const reportRecord = record(entry, "route record");
      return reportRecord.caseIdentity === observedControl.caseIdentity;
    });
    expect(controlIndex).toBeGreaterThanOrEqual(0);
    const controlRecord = record(reportRecords[controlIndex], "control route record");
    expect(record(controlRecord.result, "control result").status).toBe("pass");
    const controlPosition = value.reportPositions[controlIndex];
    if (controlPosition === undefined) throw new TypeError("control report position");
    const controlRequest = success(
      call<Result<object>>(api.internals, "getExecutionReportPositionRequestV1", controlPosition),
    );
    const sourceBoundKey =
      /(?:case|campaign|candidate|execution|observation|routePlan|rankDigest|source)/iu;
    const semanticContract = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(semanticContract);
      if (typeof input !== "object" || input === null) return input;
      return Object.fromEntries(
        Object.entries(input)
          .filter(([key]) => !sourceBoundKey.test(key))
          .map(([key, entry]) => [key, semanticContract(entry)]),
      );
    };
    expect(semanticContract(controlRequest)).toEqual(semanticContract(value.originalRequest));
    expect(record(controlRequest, "control request").policy).toEqual(
      record(value.originalRequest, "subject request").policy,
    );
    expect(record(controlRequest, "control request").oracle).toEqual(
      record(value.originalRequest, "subject request").oracle,
    );
  }, 600_000);

  // Historical external-tool versions are revalidated before an isolated launch owns resources.
  it("should reject authenticated ACME version drift before root or worker launch", async () => {
    const value = await fixture("infrastructure-with-passing-control", { subjectTier: "acme" });
    const context = confirmationContext(value.apis, value);
    const before = {
      workers: value.activity.workerRequests.length,
      roots: value.activity.rootIdentities.length,
      processes: value.activity.processLaunches.length,
    };
    const drift = installFailureExecutionToolVersionDriftV1("acme");
    try {
      failure(
        await call<Promise<Result<unknown>>>(
          value.apis.execution,
          "confirmReducedFailureV1",
          context,
        ),
        "historical-authority-unavailable",
      );
      expect(value.activity.workerRequests).toHaveLength(before.workers);
      expect(value.activity.rootIdentities).toHaveLength(before.roots);
      expect(value.activity.processLaunches).toHaveLength(before.processes);
    } finally {
      drift.cleanup();
    }
  }, 600_000);

  // Missing retained handler or tool authority is closed and never replaced by current authority.
  it("should fail closed without current handler or tool fallback when historical authority is missing", async () => {
    const value = await fixture("standalone-stable");
    const api = value.apis;
    const before = [...value.activity.workerThreads];
    failure(
      call<Result<unknown>>(api.internals, "createFailureConfirmationContextV1", {
        report: { ...value.report },
        subject: value.subjectPosition,
        candidate: value.candidate,
        origin: value.origin,
        budget: value.budget,
      }),
      "historical-authority-unavailable",
    );
    expect(value.activity.workerThreads).toEqual(before);
  }, 600_000);
});
