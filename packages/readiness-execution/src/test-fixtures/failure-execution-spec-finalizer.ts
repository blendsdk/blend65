import { createHash } from "node:crypto";

import type { FailureCandidateViceLocalControllerV1 } from "./failure-candidate-vice-local-support.js";
import type {
  FailureExecutionSpecApiV1,
  FailureExecutionSpecDataV1,
  FailureExecutionSpecFixtureOptionsV1,
  FailureExecutionSpecMismatchAuthoritiesV1,
  FailureExecutionSpecResultV1,
  FailureExecutionSpecScenarioV1,
} from "./failure-execution-spec-types.js";

type Api = FailureExecutionSpecApiV1;
type Data = FailureExecutionSpecDataV1;
type Result<T> = FailureExecutionSpecResultV1<T>;
type Digest = `sha256:${string}`;

interface FinalizeFailureExecutionSpecFixtureInputV1 {
  readonly scenario: FailureExecutionSpecScenarioV1;
  readonly options: FailureExecutionSpecFixtureOptionsV1;
  readonly controller: FailureCandidateViceLocalControllerV1;
  readonly readiness: Api;
  readonly reduction: Api;
  readonly internals: Api;
  readonly executionApi: Api;
  readonly parent: object;
  readonly execution: object;
  readonly oracle: object;
  readonly campaign: object;
  readonly executionPolicy: object;
  readonly routePlan: Data;
  readonly routeItems: readonly unknown[];
  readonly report: Data;
  readonly subjectIndex: number;
  readonly matchedControlIndex?: number;
  readonly selectedSequenceLength: number;
  readonly candidateFamily: "typed-valid" | "typed-invalid";
}

export interface FinalizedFailureExecutionSpecFixtureV1 {
  readonly reportSidecars: readonly Data[];
  readonly reportPositions: readonly object[];
  readonly reportRecords: readonly unknown[];
  readonly subjectPosition: object;
  readonly originalRequest: object;
  readonly controlRequest?: object;
  readonly origin: object;
  readonly candidate: object;
  readonly budget: object;
  readonly mismatchAuthorities: FailureExecutionSpecMismatchAuthoritiesV1;
  readonly expectedDisposition:
    | "confirmed-source-failure"
    | "stateful-sequence-failure"
    | "flaky-failure";
}

const ENCODER = new TextEncoder();
const FAILURE_OBSERVATION_LABEL = "failure-observation";

function digest(label: string): Digest {
  return `sha256:${createHash("sha256").update(label).digest("hex")}`;
}

function call<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  const callable = api[name];
  if (typeof callable !== "function") throw new TypeError(`missing callable ${name}`);
  return Reflect.apply(callable, undefined, arguments_) as T;
}

function success<T>(result: Result<T>): T {
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics ?? []));
  return result.value;
}

function recordValue(value: unknown, message: string): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError(message);
  return value as Data;
}

function publicResult(value: unknown): Data {
  const result = recordValue(value, "public execution result");
  return Object.freeze({
    status: result.status ?? null,
    code: result.code ?? null,
    tier: result.tier ?? null,
    stage: result.stage ?? null,
    cleanupBlocker: result.cleanupBlocker ?? null,
  });
}

function routeRecords(report: Data): readonly unknown[] {
  const records = report.routeRecords;
  if (!Array.isArray(records)) throw new TypeError("complete report route records");
  return records;
}

/** Completes report-bound authorities after genuine route execution. */
export async function finalizeFailureExecutionSpecFixtureV1(
  input: FinalizeFailureExecutionSpecFixtureInputV1,
): Promise<FinalizedFailureExecutionSpecFixtureV1> {
  const {
    scenario,
    options,
    controller,
    readiness,
    reduction,
    internals,
    executionApi,
    parent,
    execution,
    oracle,
    campaign,
    executionPolicy,
    routePlan,
    routeItems,
    report,
    subjectIndex,
    matchedControlIndex,
    selectedSequenceLength,
    candidateFamily,
  } = input;
  const route = recordValue(routeItems[subjectIndex], "subject route");
  const caseIdentity = String(route.caseIdentity);
  const readReportSidecars = (selectedReport: Data): readonly Data[] =>
    success(
      call<Result<readonly Data[]>>(
        internals,
        "getExecutionAuthorityReportPredicateSidecarsV1",
        selectedReport,
      ),
    );
  const readReportPositions = (selectedReport: Data): readonly object[] =>
    success(
      call<Result<readonly object[]>>(
        internals,
        "getExecutionAuthorityReportPositionsV1",
        selectedReport,
      ),
    );
  const reportSidecars = readReportSidecars(report);
  const reportPositions = readReportPositions(report);
  const reportRecords = routeRecords(report);
  if (reportPositions.length !== routeItems.length || reportSidecars.length !== routeItems.length) {
    throw new TypeError("fixture report provenance cardinality");
  }
  if (matchedControlIndex !== undefined) {
    const controlIndex = matchedControlIndex;
    const controlRecord = recordValue(reportRecords[controlIndex], "reported control record");
    const controlResult = recordValue(controlRecord.result, "reported control result");
    if (controlResult.status !== "pass") {
      const subjectResult = recordValue(
        recordValue(reportRecords[subjectIndex], "reported subject record").result,
        "reported subject result",
      );
      const project = (result: Data): Data => ({
        status: result.status ?? null,
        code: result.code ?? null,
        tier: result.tier ?? null,
        stage: result.stage ?? null,
      });
      throw new TypeError(
        JSON.stringify({
          subject: project(subjectResult),
          control: project(controlResult),
          selectedWorkerTiers: controller.selectedWorkerTiers,
          realProcessLaunchCount: controller.activity.processLaunches.length,
          selectedEmitCompletion: controller.selectedEmitCompletion ?? null,
          selectedProcessTrace: controller.selectedProcessTrace,
          injectionCount: controller.viceLauncherInjectionCount,
          armTransitions: controller.activity.viceLauncherArmTransitions,
        }),
      );
    }
  }
  const subjectRecord = recordValue(reportRecords[subjectIndex], "subject route record");
  const subjectResult = recordValue(Reflect.get(subjectRecord, "result"), "subject result");
  if (Reflect.get(subjectResult, "status") !== "failure") {
    if (options.subjectTier !== "vice") {
      throw new TypeError("selected report occurrence must fail");
    }
    if (matchedControlIndex === undefined) {
      throw new TypeError("fixture VICE control route unavailable");
    }
    const controlIndex = matchedControlIndex;
    const controlRecord = recordValue(reportRecords[controlIndex], "control route record");
    const controlResult = recordValue(controlRecord.result, "control result");
    throw new TypeError(
      JSON.stringify({
        subject: {
          position: subjectIndex + 1,
          caseIdentity: String(recordValue(routeItems[subjectIndex], "subject route").caseIdentity),
          ...publicResult(subjectResult),
        },
        control: {
          position: controlIndex + 1,
          caseIdentity: String(recordValue(routeItems[controlIndex], "control route").caseIdentity),
          ...publicResult(controlResult),
        },
        injectionCount: controller.viceLauncherInjectionCount,
        armTransitions: controller.activity.viceLauncherArmTransitions,
      }),
    );
  }
  if (
    scenario === "sequence-only" &&
    options.subjectTier !== "vice" &&
    Reflect.get(subjectResult, "code") !== "compiler-ice"
  ) {
    throw new TypeError("fixture selected sequence compiler failure");
  }
  if (
    scenario === "direct-shrink-stable" &&
    !["diagnostic-mismatch", "unexpected-emission", "semantic-mismatch"].includes(
      String(Reflect.get(subjectResult, "code")),
    )
  ) {
    throw new TypeError("fixture selected direct-shrink failure");
  }
  if (
    options.subjectTier === "vice" &&
    (Reflect.get(subjectResult, "code") !== "emulator-launch-failure" ||
      Reflect.get(subjectResult, "stage") !== "vice-launch" ||
      controller.viceLauncherInjectionCount !== 1 ||
      controller.armedProcessTier !== undefined ||
      JSON.stringify(controller.activity.viceLauncherArmTransitions) !==
        JSON.stringify(["armed", "consumed"]))
  ) {
    throw new TypeError("fixture authentic VICE selected result");
  }
  const subjectPosition = reportPositions[subjectIndex];
  if (subjectPosition === undefined) throw new TypeError("fixture subject report position");
  const originalRequest = success(
    call<Result<object>>(internals, "getExecutionReportPositionRequestV1", subjectPosition),
  );
  const originalRequestData = recordValue(originalRequest, "exact original request");
  if (JSON.stringify(originalRequestData.route) !== JSON.stringify(route)) {
    throw new TypeError("fixture report position request route");
  }
  const requestKind = originalRequestData.kind ?? "valid-envelope";
  const selectedCandidateFamily =
    requestKind === "invalid-diagnostic"
      ? "typed-invalid"
      : requestKind === "valid-envelope"
        ? "typed-valid"
        : undefined;
  if (
    selectedCandidateFamily === undefined ||
    (options.candidateFamily !== undefined && selectedCandidateFamily !== candidateFamily) ||
    (scenario === "sequence-only" &&
      options.subjectTier !== "vice" &&
      selectedCandidateFamily !== "typed-valid")
  ) {
    throw new TypeError("fixture report position candidate family");
  }
  const selectedDiagnosticOutcome = controller.diagnosticOutcomes.get(caseIdentity);
  if (
    (selectedCandidateFamily === "typed-invalid" && selectedDiagnosticOutcome === undefined) ||
    (selectedCandidateFamily !== "typed-invalid" && selectedDiagnosticOutcome !== undefined)
  ) {
    throw new TypeError("fixture selected diagnostic outcome join");
  }
  if (selectedDiagnosticOutcome === undefined) {
    delete controller.selectedDiagnosticOutcome;
  } else {
    controller.selectedDiagnosticOutcome = selectedDiagnosticOutcome;
  }
  const sourceAuthority =
    selectedCandidateFamily === "typed-valid"
      ? originalRequestData.executionCase
      : originalRequestData.diagnosticCase;
  if (typeof sourceAuthority !== "object" || sourceAuthority === null) {
    throw new TypeError("fixture report position source authority");
  }
  let matchedControlRequest: Data | undefined;
  if (matchedControlIndex !== undefined) {
    const controlPosition = reportPositions[matchedControlIndex];
    if (controlPosition === undefined || controlPosition === subjectPosition) {
      throw new TypeError("fixture distinct control report position");
    }
    const controlRecord = recordValue(reportRecords[matchedControlIndex], "control route record");
    const controlResult = recordValue(controlRecord.result, "control result");
    if (controlResult.status !== "pass") {
      throw new TypeError("fixture matched control must pass");
    }
    matchedControlRequest = recordValue(
      success(
        call<Result<object>>(internals, "getExecutionReportPositionRequestV1", controlPosition),
      ),
      "exact control request",
    );
    const controlRoute = recordValue(matchedControlRequest.route, "exact control route");
    const exactRouteFields = (value: Data): string =>
      JSON.stringify({
        ruleId: value.ruleId,
        obligation: value.obligation,
        terminalTier: value.terminalTier,
        prerequisiteTiers: value.prerequisiteTiers,
      });
    if (
      (matchedControlRequest.kind ?? "valid-envelope") !== requestKind ||
      controlRoute.caseIdentity === route.caseIdentity ||
      exactRouteFields(controlRoute) !== exactRouteFields(route) ||
      matchedControlRequest.policy !== originalRequestData.policy ||
      matchedControlRequest.oracle !== originalRequestData.oracle
    ) {
      throw new TypeError("fixture control request mismatch");
    }
  }
  const { digest: routePlanDigest, ...routePlanPreimage } = routePlan;
  const routePlanBytes = call<Uint8Array>(
    readiness,
    "serializeExecutionRoutePlanPreimageV1",
    routePlanPreimage,
  );
  if (digest(new TextDecoder().decode(routePlanBytes)) !== routePlanDigest) {
    throw new TypeError("fixture route plan digest");
  }
  const sidecar = recordValue(reportSidecars[subjectIndex], "subject predicate sidecar");
  const predicateBasis = recordValue(
    Reflect.get(sidecar, "predicateBasis"),
    "subject predicate basis",
  );
  const ingredients = recordValue(
    Reflect.get(predicateBasis, "value"),
    "subject predicate ingredients",
  );
  if (matchedControlIndex !== undefined && matchedControlRequest !== undefined) {
    const controlSidecar = recordValue(
      reportSidecars[matchedControlIndex],
      "control predicate sidecar",
    );
    const controlBasis = recordValue(
      Reflect.get(controlSidecar, "predicateBasis"),
      "control predicate basis",
    );
    if (controlBasis.kind !== "pass") {
      throw new TypeError("fixture control predicate basis");
    }
  }
  const predicate = success(
    call<Result<{ readonly predicate: object }>>(readiness, "deriveFailurePredicateIdentityV1", {
      ...ingredients,
      revision: "failure-predicate-v1",
    }),
  ).predicate;
  const defaultFailurePolicy = recordValue(
    readiness.FAILURE_REDUCTION_DEFAULT_POLICY_V1,
    "failure policy",
  );
  const failurePolicy = {
    ...defaultFailurePolicy,
    budget: {
      ...recordValue(defaultFailurePolicy.budget, "failure budget"),
      sequenceCases: selectedSequenceLength,
    },
  };
  const origin = success(
    call<Result<object>>(
      internals,
      "authorizeFailureEnvelopeFromReportPositionV1",
      subjectPosition,
      failurePolicy,
    ),
  );
  const projectEnvelope = (authority: object): Data =>
    success(call<Result<Data>>(readiness, "getFailureEnvelopeProjectionV1", authority));
  const originProjection = projectEnvelope(origin);
  const projectedToolVersions = originProjection.toolVersions;
  if (!Array.isArray(projectedToolVersions)) {
    throw new TypeError("fixture origin tool identities");
  }
  let foreignToolOrigin: object | undefined;
  if (options.includeForeignToolOrigin === true) {
    const foreignToolIndex = routeItems.findIndex(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        Reflect.get(entry, "terminalTier") === "vice",
    );
    if (foreignToolIndex < 0 || foreignToolIndex === subjectIndex) {
      throw new TypeError("fixture foreign tool report position");
    }
    const foreignToolRoute = recordValue(
      routeItems[foreignToolIndex],
      "foreign tool subject route",
    );
    const selectedFailurePosition = controller.failingPosition;
    const selectedFailureIdentity = controller.reportFailureIdentity;
    const selectedSubjectTier = controller.subjectTier;
    if (selectedFailureIdentity === undefined) {
      throw new TypeError("fixture selected failure identity");
    }
    controller.failingPosition = foreignToolIndex + 1;
    controller.reportFailureIdentity = String(Reflect.get(foreignToolRoute, "caseIdentity"));
    controller.subjectTier = "vice";
    controller.reportRoutePosition = 0;
    controller.armedProcessOrdinal = 0;
    delete controller.armedProcessTier;
    const foreignToolReport = success(
      await call<Promise<Result<Data>>>(executionApi, "executeReadinessCampaign", {
        parent,
        execution,
        oracle,
        campaign,
        target: "c64",
        policy: executionPolicy,
        capabilities: {
          acme: { available: true, version: "0.97" },
          vice: { available: true, version: "3.10" },
        },
      }),
    );
    const foreignToolRecords = Reflect.get(foreignToolReport, "routeRecords");
    if (!Array.isArray(foreignToolRecords)) {
      throw new TypeError("fixture foreign tool report records");
    }
    const foreignToolRecord = recordValue(
      foreignToolRecords[foreignToolIndex],
      "foreign tool route record",
    );
    const foreignToolResult = recordValue(
      Reflect.get(foreignToolRecord, "result"),
      "foreign tool route result",
    );
    if (Reflect.get(foreignToolResult, "status") !== "failure") {
      throw new TypeError("foreign tool report occurrence must fail");
    }
    const foreignToolPositions = success(
      call<Result<readonly object[]>>(
        internals,
        "getExecutionAuthorityReportPositionsV1",
        foreignToolReport,
      ),
    );
    const foreignToolPosition = foreignToolPositions[foreignToolIndex];
    if (foreignToolPosition === undefined) {
      throw new TypeError("fixture foreign tool position authority");
    }
    foreignToolOrigin = success(
      call<Result<object>>(
        internals,
        "authorizeFailureEnvelopeFromReportPositionV1",
        foreignToolPosition,
        failurePolicy,
      ),
    );
    controller.failingPosition = selectedFailurePosition;
    controller.reportFailureIdentity = selectedFailureIdentity;
    controller.subjectTier = selectedSubjectTier;
    controller.reportRoutePosition = 0;
    controller.armedProcessOrdinal = 0;
    delete controller.armedProcessTier;
  }
  const observationBytes = ENCODER.encode(FAILURE_OBSERVATION_LABEL);
  const toolVersions = projectedToolVersions as readonly object[];
  const authorizeOrigin = (
    selectedPredicate: object,
    selectedObservationBytes: Uint8Array,
    selectedRoutePlanBytes: Uint8Array = routePlanBytes,
    selectedToolVersions: readonly object[] = toolVersions,
  ): object =>
    success(
      call<Result<object>>(readiness, "authorizeFailureEnvelopeV1", {
        revision: "failure-envelope-authorization-input-v1",
        source: { kind: selectedCandidateFamily, authority: sourceAuthority },
        routePlanBytes: selectedRoutePlanBytes,
        routePlanDigest: digest(new TextDecoder().decode(selectedRoutePlanBytes)),
        predicate: selectedPredicate,
        policy: failurePolicy,
        observationBytes: selectedObservationBytes,
        toolVersions: selectedToolVersions,
      }),
    );
  const predicateData = recordValue(predicate, "failure predicate");
  const derivePredicate = (changes: Readonly<Record<string, unknown>>): object =>
    success(
      call<Result<{ readonly predicate: object }>>(readiness, "deriveFailurePredicateIdentityV1", {
        ...predicateData,
        ...changes,
      }),
    ).predicate;
  const mismatchedObservationBytes = ENCODER.encode(`${FAILURE_OBSERVATION_LABEL}-other`);
  const canaryObservation = {
    kind: "observed",
    digest: digest(new TextDecoder().decode(observationBytes)),
  };
  const predicateMismatch = derivePredicate({
    resultCode: "emission-failure",
    observation: canaryObservation,
  });
  const observationMismatch = derivePredicate({
    observation: {
      kind: "observed",
      digest: digest(new TextDecoder().decode(mismatchedObservationBytes)),
    },
  });
  const cleanupMismatch = derivePredicate({
    observation: canaryObservation,
    cleanup: "cleanup-blocked",
  });
  const changedRoutePlanBytes = new Uint8Array([...routePlanBytes, 0x0a]);
  const routePlanMismatch = authorizeOrigin(
    derivePredicate({ observation: canaryObservation }),
    observationBytes,
    changedRoutePlanBytes,
  );
  const predicateMismatchOrigin = authorizeOrigin(predicateMismatch, observationBytes);
  const mismatchCandidateOrigin =
    foreignToolOrigin ??
    (selectedCandidateFamily === "typed-valid" ? routePlanMismatch : undefined);
  const mismatchCandidate =
    mismatchCandidateOrigin === undefined
      ? undefined
      : success(
          call<Result<object>>(
            reduction,
            "createReductionCandidateAuthorityV1",
            mismatchCandidateOrigin,
            success(
              call<Result<object>>(
                reduction,
                "createInitialReductionCandidateV1",
                mismatchCandidateOrigin,
              ),
            ),
            [],
          ),
        );
  const mismatchAuthorities: FailureExecutionSpecMismatchAuthoritiesV1 = {
    predicate: predicateMismatchOrigin,
    observation: authorizeOrigin(observationMismatch, mismatchedObservationBytes),
    cleanup: authorizeOrigin(cleanupMismatch, observationBytes),
    routePlan: routePlanMismatch,
    ...(foreignToolOrigin === undefined ? {} : { tool: foreignToolOrigin }),
    ...(mismatchCandidate === undefined ? {} : { candidate: mismatchCandidate }),
  };
  const originPredicate = recordValue(originProjection.predicate, "origin predicate projection");
  const assertDifferent = (left: unknown, right: unknown, message: string): void => {
    if (JSON.stringify(left) === JSON.stringify(right)) throw new TypeError(message);
  };
  const predicateProjection = projectEnvelope(mismatchAuthorities.predicate);
  const observationProjection = projectEnvelope(mismatchAuthorities.observation);
  const cleanupProjection = projectEnvelope(mismatchAuthorities.cleanup);
  const routeProjection = projectEnvelope(mismatchAuthorities.routePlan);
  assertDifferent(
    predicateProjection.predicate,
    originProjection.predicate,
    "fixture foreign predicate axis",
  );
  assertDifferent(
    recordValue(observationProjection.predicate, "foreign observation predicate").observation,
    originPredicate.observation,
    "fixture foreign observation axis",
  );
  assertDifferent(
    recordValue(cleanupProjection.predicate, "foreign cleanup predicate").cleanup,
    originPredicate.cleanup,
    "fixture foreign cleanup axis",
  );
  assertDifferent(
    routeProjection.routePlanDigest,
    originProjection.routePlanDigest,
    "fixture foreign route-plan axis",
  );
  if (mismatchAuthorities.tool !== undefined) {
    const toolProjection = projectEnvelope(mismatchAuthorities.tool);
    assertDifferent(
      toolProjection.toolVersions,
      originProjection.toolVersions,
      "fixture foreign tool axis",
    );
  }
  controller.phase = "candidate";
  controller.freshOrdinal = 0;
  controller.reportRoutePosition = 0;
  delete controller.armedProcessTier;
  controller.armedProcessOrdinal = 0;
  delete controller.candidateIdentity;
  const initial = success(
    call<Result<object>>(reduction, "createInitialReductionCandidateV1", origin),
  );
  const candidate = success(
    call<Result<object>>(reduction, "createReductionCandidateAuthorityV1", origin, initial, []),
  );
  const budget = success(
    call<Result<object>>(readiness, "createFailureCampaignBudgetAuthorityV1", failurePolicy, {
      nonPassResults: 0,
      resolvableNonPassResults: 0,
    }),
  );
  const expectedDisposition =
    scenario === "standalone-stable" ||
    scenario === "direct-shrink-stable" ||
    scenario === "infrastructure-with-passing-control"
      ? "confirmed-source-failure"
      : scenario === "sequence-only"
        ? "stateful-sequence-failure"
        : "flaky-failure";
  return {
    reportSidecars,
    reportPositions,
    reportRecords,
    subjectPosition,
    originalRequest,
    ...(matchedControlRequest === undefined ? {} : { controlRequest: matchedControlRequest }),
    origin,
    candidate,
    budget,
    mismatchAuthorities,
    expectedDisposition,
  };
}
