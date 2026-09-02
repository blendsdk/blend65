import {
  activateFailureCandidateViceControllerV1,
  assertFailureCandidateViceLocalVersionsV1,
  closeFailureCandidateViceControllerV1,
  type FailureCandidateViceLocalControllerV1,
} from "./failure-candidate-vice-local-support.js";
import {
  cleanupControlledFailureExecutionAdaptersV1,
  installControlledFailureExecutionAdaptersV1,
} from "./failure-execution-spec-adapters.js";
import { finalizeFailureExecutionSpecFixtureV1 } from "./failure-execution-spec-finalizer.js";
import { createFailureExecutionSpecReportV1 } from "./failure-execution-spec-report.js";
import type {
  FailureExecutionSpecActivityV1,
  FailureExecutionSpecApiV1,
  FailureExecutionSpecDataV1,
  FailureExecutionSpecDigestV1,
  FailureExecutionSpecFixtureOptionsV1,
  FailureExecutionSpecFixtureV1,
  FailureExecutionSpecResultV1,
  FailureExecutionSpecScenarioV1,
} from "./failure-execution-spec-types.js";

export type {
  FailureExecutionCandidateEvaluationV1,
  FailureExecutionCheckpointReferenceV1,
  FailureExecutionConfirmationResultV1,
  FailureExecutionConfirmationStepV1,
  FailureExecutionObservationV1,
  FailureExecutionProtocolApisV1,
  FailureExecutionSpecActivityV1,
  FailureExecutionSpecApiV1,
  FailureExecutionSpecDataV1,
  FailureExecutionSpecDigestV1,
  FailureExecutionSpecFixtureOptionsV1,
  FailureExecutionSpecFixtureV1,
  FailureExecutionSpecMismatchAuthoritiesV1,
  FailureExecutionSpecResultV1,
  FailureExecutionSpecScenarioV1,
  FailureExecutionSpecWorkerRequestV1,
} from "./failure-execution-spec-types.js";

type Api = FailureExecutionSpecApiV1;
type Data = FailureExecutionSpecDataV1;
type Digest = FailureExecutionSpecDigestV1;
type Result<T> = FailureExecutionSpecResultV1<T>;

type ControllerV1 = FailureCandidateViceLocalControllerV1;
type ExecutionTierV1 = "frontend" | "compiler-api" | "cli" | "emit" | "acme" | "vice";

interface DiagnosticOutcomeV1 {
  readonly code: string;
  readonly phase: "lexer" | "parser" | "semantic" | "sfa";
  readonly severity: "error";
}

function call<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  const callable = api[name];
  if (typeof callable !== "function") throw new TypeError(`missing callable ${name}`);
  return Reflect.apply(callable, undefined, arguments_) as T;
}

function success<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics ?? []));
  }
  return result.value;
}

function recordValue(value: unknown, message: string): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Data;
}

function validateOptions(
  scenario: FailureExecutionSpecScenarioV1,
  options: FailureExecutionSpecFixtureOptionsV1,
): {
  readonly failingPosition: number;
  readonly sequenceLength: number;
  readonly subjectTier: "frontend" | "acme" | "vice";
  readonly candidateFamily: "typed-valid" | "typed-invalid";
  readonly rejectOwnedShutdownOrdinal?: number;
} {
  if (
    ![
      "standalone-stable",
      "direct-shrink-stable",
      "sequence-only",
      "flaky",
      "infrastructure-with-passing-control",
    ].includes(scenario)
  ) {
    throw new TypeError("unknown failure-execution scenario");
  }
  const failingPosition = options.failingPosition ?? 2;
  const sequenceLength = options.sequenceLength ?? failingPosition;
  const subjectTier = options.subjectTier ?? "frontend";
  const candidateFamily =
    options.candidateFamily ??
    (scenario === "direct-shrink-stable" ? "typed-invalid" : "typed-valid");
  const rejectOwnedShutdownOrdinal = options.rejectOwnedShutdownOrdinal;
  const includeForeignToolOrigin = options.includeForeignToolOrigin ?? false;
  if (
    !Number.isSafeInteger(failingPosition) ||
    !Number.isSafeInteger(sequenceLength) ||
    failingPosition < 1 ||
    failingPosition > 64 ||
    sequenceLength < failingPosition ||
    sequenceLength > 64 ||
    !["frontend", "acme", "vice"].includes(subjectTier) ||
    !["typed-valid", "typed-invalid"].includes(candidateFamily) ||
    (scenario === "direct-shrink-stable" && candidateFamily !== "typed-invalid") ||
    typeof includeForeignToolOrigin !== "boolean" ||
    (rejectOwnedShutdownOrdinal !== undefined &&
      (!Number.isSafeInteger(rejectOwnedShutdownOrdinal) || rejectOwnedShutdownOrdinal < 1))
  ) {
    throw new TypeError("failure-execution sequence bounds");
  }
  return {
    failingPosition,
    sequenceLength,
    subjectTier,
    candidateFamily,
    ...(rejectOwnedShutdownOrdinal === undefined ? {} : { rejectOwnedShutdownOrdinal }),
  };
}

/**
 * Creates one genuine publication-bound confirmation input with controlled external activity.
 * Invalid scenario bounds are rejected before any production module is loaded.
 */
export async function createFailureExecutionSpecFixtureV1(
  scenario: FailureExecutionSpecScenarioV1,
  options: FailureExecutionSpecFixtureOptionsV1 = {},
): Promise<FailureExecutionSpecFixtureV1> {
  const {
    failingPosition,
    sequenceLength,
    subjectTier,
    candidateFamily,
    rejectOwnedShutdownOrdinal,
  } = validateOptions(scenario, options);
  if (options.subjectTier === "vice") {
    assertFailureCandidateViceLocalVersionsV1();
  }
  const activity: FailureExecutionSpecActivityV1 = {
    workerThreads: [],
    isolateIdentities: [],
    rootIdentities: [],
    processLaunches: [],
    workerRequests: [],
    ownedShutdownAttempts: [],
    viceLauncherInjections: [],
    viceLauncherArmTransitions: [],
  };
  const controller: ControllerV1 = {
    scenario,
    failingPosition,
    sequenceLength,
    subjectTier,
    ...(rejectOwnedShutdownOrdinal === undefined ? {} : { rejectOwnedShutdownOrdinal }),
    activity,
    phase: "report",
    freshOrdinal: 0,
    reportRoutePosition: 0,
    armedProcessOrdinal: 0,
    ownedExecutorOrdinal: 0,
    rejectedOwnedShutdown: false,
    diagnosticOutcomes: new Map(),
    viceLauncherInjectionCount: 0,
    selectedWorkerTiers: [],
    selectedProcessTrace: [],
  };
  if (options.subjectTier === "vice") {
    activateFailureCandidateViceControllerV1(controller);
  } else {
    await installControlledFailureExecutionAdaptersV1(controller);
  }

  const catalogFixtures =
    (await import("./execution-publication-catalog-spec-fixture.js")) as unknown as Api;
  const campaignFixtures = (await import("./genuine-execution-campaign.js")) as unknown as Api;
  const readiness = (await import("@blend65/readiness")) as unknown as Api;
  const reduction =
    (await import("@blend65/readiness/failure-reduction-internals")) as unknown as Api;
  const published = (await import("@blend65/readiness/published-oracle")) as unknown as Api;
  const campaignIdentity =
    (await import("@blend65/readiness/execution-campaign-identity")) as unknown as Api;
  const executionApi = (await import("../index.js")) as unknown as Api;
  const internals = (await import("../failure-execution-internals.js")) as unknown as Api;
  const reports = (await import("../execution-authority-report.js")) as unknown as Api;
  controller.protocolApis = Object.freeze({
    execution: executionApi,
    internals,
    readiness,
    reduction,
    reports,
    published,
  });
  const catalog = await call<
    Promise<{
      readonly repositoryRoot: string;
      readonly parentDigest: Digest;
      readonly release: object;
      cleanup(): Promise<void>;
    }>
  >(catalogFixtures, "createExecutionPublicationCatalogFixtureV1");
  try {
    const parent = success(
      await call<Promise<Result<object>>>(readiness, "resolvePublishedSnapshotByDigest", {
        repositoryRoot: catalog.repositoryRoot,
        publicationDigest: catalog.parentDigest,
      }),
    );
    const execution = success(
      call<Result<object>>(executionApi, "resolveLiveExecutionContextV1", catalog.release),
    );
    const oracle = success(call<Result<object>>(published, "createPublishedOracleContext", parent));
    const orchestrationCampaign = (
      await call<Promise<{ readonly orchestration: object }>>(
        campaignFixtures,
        "createGenuineExecutionCampaigns",
        parent,
      )
    ).orchestration;
    const campaign =
      scenario === "sequence-only" && options.subjectTier !== "vice"
        ? success(
            call<Result<object>>(campaignIdentity, "createPublishedExecutionCampaignV1", parent, {
              schemaVersion: 1,
              target: "c64",
              seed: `sha256:${"8".repeat(64)}`,
              configuration: {
                caseCount: 56,
                maxInvalidCases: 0,
                enabledRuleIds: [
                  "rule.ch12.3-1-memory-access.peek-addr.signature.word",
                  "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
                  "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
                  "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
                ],
                spellings: ["literal"],
                budget: {
                  maxModules: 4,
                  maxDeclarations: 128,
                  maxIrNodes: 512,
                  maxStatements: 256,
                  maxExpressionDepth: 16,
                  maxLoopWork: 1n,
                  maxSourceBytes: 65_536,
                  maxAttempts: 128,
                },
              },
            }),
          )
        : options.subjectTier === "vice"
          ? success(
              call<Result<object>>(campaignIdentity, "createPublishedExecutionCampaignV1", parent, {
                schemaVersion: 1,
                target: "c64",
                seed: `sha256:${"7".repeat(64)}`,
                configuration: {
                  caseCount: 26,
                  maxInvalidCases: 0,
                  enabledRuleIds: [
                    "rule.ch12.3-1-memory-access.peek-addr.signature.word",
                    "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
                    "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
                    "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
                  ],
                  spellings: ["literal", "parameter"],
                  budget: {
                    maxModules: 4,
                    maxDeclarations: 128,
                    maxIrNodes: 512,
                    maxStatements: 256,
                    maxExpressionDepth: 16,
                    maxLoopWork: 1n,
                    maxSourceBytes: 65_536,
                    maxAttempts: 128,
                  },
                },
              }),
            )
          : orchestrationCampaign;
    const executionPolicy = Object.freeze({
      revision: "execution-policy-v1",
      budget: Object.freeze(
        options.subjectTier === "vice"
          ? {
              operationMs: 60_000,
              launchAttemptMs: 15_000,
              routeMs: 120_000,
              cleanupGraceMs: 3_000,
              outputBytes: 1_048_576,
              evidenceBytes: 16_777_216,
              instructions: 65_535,
              cycles: 100_000_000,
              launchAttempts: 2,
            }
          : {
              operationMs: 1_000,
              launchAttemptMs: 1_000,
              routeMs: 10_000,
              cleanupGraceMs: 3_000,
              outputBytes: 64,
              evidenceBytes: 16_777_216,
              instructions: 100,
              cycles: 1_000,
              launchAttempts: 2,
            },
      ),
    });
    const composite = success(
      call<Result<object>>(readiness, "resolveCompositeReadinessSnapshot", parent, catalog.release),
    );
    const parentProjection = success(
      call<Result<Data>>(readiness, "getCompositeReadinessProjectionV1", composite),
    );
    const campaignProjection = success(
      call<Result<Data>>(readiness, "projectExecutionCampaignV1", campaign),
    );
    const routePlan = success(
      call<Result<Data>>(executionApi, "planExecutionRoutesV1", {
        parent: parentProjection,
        campaign: campaignProjection,
        oracleDigest: catalog.parentDigest,
        policy: executionPolicy,
      }),
    );
    const routeItems = Reflect.get(routePlan, "items");
    if (!Array.isArray(routeItems) || routeItems.length < failingPosition) {
      throw new TypeError("fixture route plan does not contain the selected report position");
    }
    const campaignSummary = recordValue(Reflect.get(campaign, "summary"), "campaign summary");
    const totalCaseCount = Number(Reflect.get(campaignSummary, "totalCaseCount"));
    if (!Number.isSafeInteger(totalCaseCount) || totalCaseCount < 1 || totalCaseCount > 128) {
      throw new TypeError("fixture bounded campaign case count");
    }
    for (let ordinal = 0; ordinal < totalCaseCount; ordinal += 1) {
      const authorityResult = call<Result<object>>(
        published,
        "createPublishedDiagnosticCaseV1",
        oracle,
        campaign,
        ordinal,
      );
      if (!authorityResult.ok) continue;
      const projection = success(
        call<Result<Data>>(
          published,
          "getPublishedDiagnosticCaseProjectionV1",
          authorityResult.value,
        ),
      );
      const sourceCaseDigest = projection.sourceCaseDigest;
      const expected = recordValue(
        projection.expectedDiagnostic,
        "fixture published diagnostic tuple",
      );
      if (
        typeof sourceCaseDigest !== "string" ||
        !/^sha256:[0-9a-f]{64}$/u.test(sourceCaseDigest) ||
        typeof expected.code !== "string" ||
        !["lexer", "parser", "semantic", "sfa"].includes(String(expected.phase)) ||
        expected.severity !== "error"
      ) {
        throw new TypeError("fixture published diagnostic projection");
      }
      const diagnostic: DiagnosticOutcomeV1 = Object.freeze({
        code: expected.code,
        phase: expected.phase as DiagnosticOutcomeV1["phase"],
        severity: "error",
      });
      const existing = controller.diagnosticOutcomes.get(sourceCaseDigest);
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(diagnostic)) {
        throw new TypeError("fixture conflicting published diagnostic tuple");
      }
      controller.diagnosticOutcomes.set(sourceCaseDigest, diagnostic);
      if (controller.diagnosticOutcomes.size > totalCaseCount) {
        throw new TypeError("fixture diagnostic outcome capacity");
      }
    }
    const resolveSourceAuthority = (
      selectedRoute: unknown,
      family: "typed-valid" | "typed-invalid",
    ): object | undefined => {
      const selectedCaseIdentity = String(
        Reflect.get(recordValue(selectedRoute, "candidate-family route"), "caseIdentity"),
      );
      for (let ordinal = 0; ordinal < totalCaseCount; ordinal += 1) {
        const authorityResult =
          family === "typed-valid"
            ? call<Result<object>>(readiness, "createExecutionCaseV1", campaign, ordinal, {
                kind: "scalar-bytes",
                byteLength: 1,
              })
            : call<Result<object>>(
                published,
                "createPublishedDiagnosticCaseV1",
                oracle,
                campaign,
                ordinal,
              );
        if (!authorityResult.ok) continue;
        const projectionResult = call<Result<Data>>(
          family === "typed-valid" ? readiness : published,
          family === "typed-valid"
            ? "getExecutionCaseProjectionV1"
            : "getPublishedDiagnosticCaseProjectionV1",
          authorityResult.value,
        );
        if (
          !projectionResult.ok ||
          projectionResult.value.sourceCaseDigest !== selectedCaseIdentity
        ) {
          continue;
        }
        return authorityResult.value;
      }
      return undefined;
    };
    const routeMatches = (left: Data, right: Data): boolean =>
      left.ruleId === right.ruleId &&
      left.obligation === right.obligation &&
      left.terminalTier === right.terminalTier &&
      JSON.stringify(left.prerequisiteTiers) === JSON.stringify(right.prerequisiteTiers);
    const sameContractPair = (tier: "acme" | "vice") => {
      const candidates = routeItems.flatMap((item, index) => {
        if (
          typeof item !== "object" ||
          item === null ||
          Reflect.get(item, "terminalTier") !== tier
        ) {
          return [];
        }
        const authority = resolveSourceAuthority(item, "typed-valid");
        if (authority === undefined) return [];
        const projection = success(
          call<Result<Data>>(readiness, "getExecutionCaseProjectionV1", authority),
        );
        return [
          { index, route: recordValue(item, "controlled route"), fixture: projection.fixture },
        ];
      });
      return candidates
        .flatMap((left) =>
          candidates
            .map((right) => ({ left, right }))
            .filter(({ right }) => left.index < 64 && right.index > left.index),
        )
        .find(
          ({ left, right }) =>
            routeMatches(left.route, right.route) &&
            JSON.stringify(left.fixture) === JSON.stringify(right.fixture),
        );
    };
    let subjectIndex = failingPosition - 1;
    let matchedControlIndex: number | undefined;
    if (scenario === "sequence-only" && options.subjectTier !== "vice") {
      if (routeItems.length !== 68) {
        throw new TypeError("fixture fixed sequence route-plan cardinality");
      }
      if (![2, 3, 4, 5, 6, 7, 8, 9, 64].includes(failingPosition)) {
        throw new TypeError("fixture unsupported fixed sequence position");
      }
      matchedControlIndex = failingPosition;
      const subjectRoute = recordValue(routeItems[subjectIndex], "fixed sequence failure route");
      const controlRoute = recordValue(
        routeItems[matchedControlIndex],
        "fixed sequence control route",
      );
      const expectedRuleId =
        failingPosition === 64
          ? "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word"
          : "rule.ch12.3-1-memory-access.peek-addr.signature.word";
      if (
        subjectRoute.ruleId !== expectedRuleId ||
        subjectRoute.obligation !== "compiler-api" ||
        subjectRoute.terminalTier !== "compiler-api" ||
        JSON.stringify(subjectRoute.prerequisiteTiers) !== JSON.stringify(["frontend"]) ||
        subjectRoute.caseIdentity === controlRoute.caseIdentity ||
        !routeMatches(subjectRoute, controlRoute)
      ) {
        throw new TypeError("fixture fixed sequence control projection");
      }
      controller.failingPosition = subjectIndex + 1;
    } else if (options.subjectTier === "vice") {
      if (routeItems.length !== 62)
        throw new TypeError("fixture fixed VICE route-plan cardinality");
      subjectIndex = 10;
      matchedControlIndex = 11;
      const subjectRoute = recordValue(routeItems[subjectIndex], "fixed VICE failure route");
      const controlRoute = recordValue(routeItems[matchedControlIndex], "fixed VICE control route");
      if (
        subjectRoute.terminalTier !== "vice" ||
        subjectRoute.caseIdentity === controlRoute.caseIdentity ||
        !routeMatches(subjectRoute, controlRoute)
      ) {
        throw new TypeError("fixture fixed VICE route pair");
      }
      controller.failingPosition = subjectIndex + 1;
    } else if (
      scenario === "infrastructure-with-passing-control" &&
      options.subjectTier === "acme"
    ) {
      const pair = sameContractPair(options.subjectTier);
      if (pair === undefined) {
        throw new TypeError("fixture route plan lacks a distinct same-contract control");
      }
      subjectIndex = pair.left.index;
      matchedControlIndex = pair.right.index;
      controller.failingPosition = subjectIndex + 1;
    } else if (
      scenario === "direct-shrink-stable" ||
      options.subjectTier !== undefined ||
      options.candidateFamily !== undefined
    ) {
      subjectIndex = routeItems.findIndex((item) => {
        if (
          typeof item !== "object" ||
          item === null ||
          (options.subjectTier !== undefined &&
            Reflect.get(item, "terminalTier") !== options.subjectTier)
        ) {
          return false;
        }
        const authority = resolveSourceAuthority(item, candidateFamily);
        return authority !== undefined;
      });
      if (subjectIndex < 0) throw new TypeError("fixture route plan lacks selected subject tier");
      controller.failingPosition = subjectIndex + 1;
    }
    const selectedSequenceLength = Math.max(sequenceLength, subjectIndex + 1);
    if (selectedSequenceLength > 64) {
      throw new TypeError("selected report position exceeds sequence hard maximum");
    }
    const route = recordValue(routeItems[subjectIndex], "subject route");
    const caseIdentity = String(Reflect.get(route, "caseIdentity"));
    const routeTier = String(Reflect.get(route, "terminalTier"));
    if (!["frontend", "compiler-api", "cli", "emit", "acme", "vice"].includes(routeTier)) {
      throw new TypeError("fixture route terminal tier");
    }
    controller.subjectTier = routeTier as ExecutionTierV1;
    controller.reportFailureIdentity = caseIdentity;

    const { report, confirmationControlPosition, localViceEvidence } =
      await createFailureExecutionSpecReportV1({
        localVice: options.subjectTier === "vice",
        controller,
        executionApi,
        internals,
        parent,
        execution,
        oracle,
        campaign,
        executionPolicy,
        routeItems,
        subjectIndex,
        ...(matchedControlIndex === undefined ? {} : { controlIndex: matchedControlIndex }),
      });
    const {
      reportPositions,
      reportRecords,
      subjectPosition,
      originalRequest,
      controlRequest,
      origin,
      candidate,
      budget,
      mismatchAuthorities,
      expectedDisposition,
    } = await finalizeFailureExecutionSpecFixtureV1({
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
      ...(matchedControlIndex === undefined ? {} : { matchedControlIndex }),
      selectedSequenceLength,
      candidateFamily,
    });
    return {
      get apis() {
        if (controller.protocolApis === undefined) {
          throw new TypeError("fixture protocol APIs are closed");
        }
        return controller.protocolApis;
      },
      parent,
      execution,
      originalRequest,
      ...(controlRequest === undefined ? {} : { controlRequest }),
      ...(confirmationControlPosition === undefined ? {} : { confirmationControlPosition }),
      report,
      reportPositions,
      subjectPosition,
      subjectIndex,
      originatingCaseIdentities: reportRecords
        .slice(0, subjectIndex + 1)
        .map((record) => String(recordValue(record, "originating route record").caseIdentity)),
      origin,
      candidate,
      budget,
      mismatchAuthorities,
      expectedDisposition,
      ...(scenario === "sequence-only" ? { expectedFailingPosition: subjectIndex + 1 } : {}),
      activity,
      ...(localViceEvidence === undefined ? {} : { localViceEvidence }),
      async cleanup() {
        if (options.subjectTier === "vice") {
          await closeFailureCandidateViceControllerV1(controller);
        } else {
          await cleanupControlledFailureExecutionAdaptersV1(controller);
        }
        controller.diagnosticOutcomes.clear();
        delete controller.selectedDiagnosticOutcome;
        controller.selectedWorkerTiers.length = 0;
        controller.selectedProcessTrace.length = 0;
        delete controller.selectedEmitCompletion;
        delete controller.protocolApis;
        await catalog.cleanup();
      },
    };
  } catch (error) {
    controller.diagnosticOutcomes.clear();
    delete controller.selectedDiagnosticOutcome;
    controller.selectedWorkerTiers.length = 0;
    controller.selectedProcessTrace.length = 0;
    delete controller.selectedEmitCompletion;
    delete controller.protocolApis;
    await catalog.cleanup();
    if (options.subjectTier === "vice") {
      await closeFailureCandidateViceControllerV1(controller);
    } else {
      await cleanupControlledFailureExecutionAdaptersV1(controller);
    }
    throw error;
  }
}
