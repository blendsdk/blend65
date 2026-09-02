import { createHash } from "node:crypto";

import type { BoundedAcmeRunnerV1 } from "@blend65/compiler";
import type {
  ExecutionCaseV1,
  ExecutionOperationResultV1,
  ExecutionPolicyV1,
  ExecutionResultCodeV1,
  ExecutionResultV1,
  ExecutionRoutePlanItemV1,
  ExecutionStageV1,
  ExecutionTierV1,
  MalformedDiagnosticCaseV1,
  PublishedOracleContext,
} from "@blend65/readiness";
import {
  getExecutionCaseProjectionV1,
  getMalformedDiagnosticCaseProjectionV1,
  isExecutionDigestV1,
  isExecutionTierV1,
} from "@blend65/readiness/execution-runtime";
import { createPublishedOracleRequest } from "@blend65/readiness/published-oracle";
import {
  getPublishedDiagnosticCaseProjectionV1,
  type PublishedDiagnosticCaseV1,
} from "@blend65/readiness/published-oracle";

import { createExecutionBudgetScopeV1 } from "./execution-budget.js";
import { getCandidateExecutionRouteStateV1 } from "./failure-candidate-route-state.js";
export {
  createCandidateExecutionRouteRequestV1,
  getCandidateExecutionRouteStateV1,
  type CreateCandidateExecutionRouteRequestInputV1,
} from "./failure-candidate-route-state.js";
import { registerExecutionRouteRequestV1 } from "./execution-route-authority.js";
export {
  getExecutionRouteRequestForSourceAuthorityV1,
  isGenuineExecutionRouteRequestV1,
} from "./execution-route-authority.js";
import { executeAcmeArtifactPipelineV1 } from "./execution-acme-artifacts.js";
import { classifyDiagnosticRouteEvidenceV1 } from "./execution-diagnostic-classifier.js";
export {
  classifyDiagnosticRouteEvidenceV1,
  type DiagnosticExecutionResultV1,
  type DirectDiagnosticEvidenceV1,
} from "./execution-diagnostic-classifier.js";
import { getExecutionPrerequisiteTiersV1 } from "./execution-route-tiers.js";
import {
  executionSupervisorOwnsWorkerExecutorV1,
  type ExecutionSupervisorV1,
} from "./execution-supervisor.js";
import {
  createExecutionWorkerRequestV1,
  getExecutionWorkerDiagnosticParentEvidenceV1,
  isValidExecutionWorkerSuccessV1,
} from "./execution-route-worker-request.js";
import {
  type ExecutionCancellationV1,
  type ExecutionWorkerExecutorV1,
  type ExecutionWorkerTierV1,
} from "./execution-worker-protocol.js";

/** Valid executable-envelope route request whose terminal tier remains visible. */
export interface ValidExecutionRouteRequestV1<TTier extends ExecutionTierV1> {
  /** Closed case discriminator; omitted only on legacy callers. */
  readonly kind?: "valid-envelope";
  /** Selected route and exact terminal tier. */
  readonly route: ExecutionRoutePlanItemV1 & { readonly terminalTier: TTier };
  /** Opaque genuine generated-case authority. */
  readonly executionCase: ExecutionCaseV1;
  /** Opaque selected oracle authority. */
  readonly oracle: PublishedOracleContext;
  /** Closed cumulative execution policy. */
  readonly policy: ExecutionPolicyV1;
}

/** Backward-compatible name for the valid executable-envelope request branch. */
export type ExecutionRouteRequestBaseV1<TTier extends ExecutionTierV1> =
  ValidExecutionRouteRequestV1<TTier>;

/** Diagnostic tiers that may compile invalid source without later artifacts. */
export type ExecutionDiagnosticTierV1 = "frontend" | "compiler-api" | "cli";

/** Invalid-source route bound to opaque published diagnostic authority. */
export interface DiagnosticExecutionRouteRequestV1<TTier extends ExecutionDiagnosticTierV1> {
  /** Closed invalid-source discriminator. */
  readonly kind: "invalid-diagnostic";
  /** Selected diagnostic tier and identity-bound plan item. */
  readonly route: ExecutionRoutePlanItemV1 & { readonly terminalTier: TTier };
  /** Opaque parent-side expected-diagnostic authority. */
  readonly diagnosticCase: PublishedDiagnosticCaseV1;
  /** Closed cumulative execution policy. */
  readonly policy: ExecutionPolicyV1;
}

/** Raw malformed-source route that never acquires typed intermediate representation. */
export interface RawDiagnosticExecutionRouteRequestV1<TTier extends ExecutionDiagnosticTierV1> {
  /** Closed raw-source discriminator. */
  readonly kind: "raw-malformed";
  /** Selected diagnostic route and exact terminal tier. */
  readonly route: ExecutionRoutePlanItemV1 & { readonly terminalTier: TTier };
  /** Opaque exact-byte malformed source authority. */
  readonly malformedCase: MalformedDiagnosticCaseV1;
  /** Closed cumulative execution policy. */
  readonly policy: ExecutionPolicyV1;
}

/** Candidate-relative request accepted only from the private failure-route adapter. */
export interface CandidateExecutionRouteRequestV1<TTier extends ExecutionTierV1> {
  /** Private candidate-route discriminator. */
  readonly kind: "reduction-candidate-internal";
  /** Original route semantics with only the case identity replaced. */
  readonly route: ExecutionRoutePlanItemV1 & { readonly terminalTier: TTier };
  /** Exact original execution policy. */
  readonly policy: ExecutionPolicyV1;
}

/** Genuine valid or invalid route request union accepted by real adapters. */
export type ExecutionRouteRequestV1 =
  | ValidExecutionRouteRequestV1<"frontend">
  | ValidExecutionRouteRequestV1<"compiler-api">
  | ValidExecutionRouteRequestV1<"cli">
  | ValidExecutionRouteRequestV1<"emit">
  | ValidExecutionRouteRequestV1<"acme">
  | ValidExecutionRouteRequestV1<"vice">
  | DiagnosticExecutionRouteRequestV1<"frontend">
  | DiagnosticExecutionRouteRequestV1<"compiler-api">
  | DiagnosticExecutionRouteRequestV1<"cli">
  | RawDiagnosticExecutionRouteRequestV1<ExecutionDiagnosticTierV1>
  | CandidateExecutionRouteRequestV1<ExecutionTierV1>;

/** Input to the genuine-case route-request constructor. */
export type CreateExecutionRouteRequestInputV1 =
  | {
      readonly kind?: "valid-envelope";
      readonly route: ExecutionRoutePlanItemV1;
      readonly executionCase: ExecutionCaseV1;
      readonly oracle: PublishedOracleContext;
      readonly policy: ExecutionPolicyV1;
    }
  | DiagnosticExecutionRouteRequestV1<ExecutionDiagnosticTierV1>
  | RawDiagnosticExecutionRouteRequestV1<ExecutionDiagnosticTierV1>;

/** One terminal route adapter. */
export interface ExecutionRouteHandlerV1 {
  /** Executes a genuine request under caller-owned cancellation. */
  execute(
    request: ExecutionRouteRequestV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionResultV1>;
}

/** Complete real route-handler table consumed by campaign orchestration. */
export type PublishedExecutionHandlersV1 = Readonly<
  Record<ExecutionTierV1, ExecutionRouteHandlerV1>
>;

/** Production dependencies used without parent-side compiler fallbacks. */
export interface ExecutionAdapterDependenciesV1 {
  /** Single worker boundary shared by all synchronous compiler tiers. */
  readonly worker: { readonly executor: ExecutionWorkerExecutorV1 };
  /** Bounded assembler process seam. */
  readonly acme: {
    readonly runner?: BoundedAcmeRunnerV1;
    /** Pre-resolved executable used by controlled hosts; ordinary production discovers it. */
    readonly executable?: string;
  };
  /** Route-wide resource owner. */
  readonly lifecycle: { readonly supervisor: ExecutionSupervisorV1 };
  /** Cancellable emulator route supplied by the emulator-control phase. */
  readonly vice: {
    readonly execute: (
      request: ExecutionRouteRequestV1,
      cancellation: ExecutionCancellationV1,
    ) => Promise<ExecutionResultV1>;
  };
}

const ENCODER = new TextEncoder();
function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "invalid-evidence-input" as const, path, message }),
    ]) as readonly [
      { readonly code: "invalid-evidence-input"; readonly path: string; readonly message: string },
    ],
  });
}

function schemaFailure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "execution.invalid-schema" as const, path, message }),
    ]) as readonly [
      {
        readonly code: "execution.invalid-schema";
        readonly path: string;
        readonly message: string;
      },
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function routeSuccess<T extends ExecutionRouteRequestV1>(
  value: T,
): ExecutionOperationResultV1<ExecutionRouteRequestV1> {
  registerExecutionRouteRequestV1(value);
  return success<ExecutionRouteRequestV1>(value);
}

function sameTiers(left: readonly ExecutionTierV1[], right: readonly ExecutionTierV1[]): boolean {
  return left.length === right.length && left.every((tier, index) => tier === right[index]);
}

/**
 * Authenticates the opaque oracle through its genuine WeakMap-backed request boundary.
 * An intentionally invalid intent distinguishes authentic authority from a forged record without
 * evaluating a case or accepting caller-supplied oracle facts.
 */
function authenticOracle(context: PublishedOracleContext): boolean {
  const probe = createPublishedOracleRequest(context, {});
  return !probe.ok && probe.diagnostics[0]?.code !== "oracle.authority.missing";
}

/** Validates the only supported obligation-to-terminal projection for invalid source. */
function diagnosticObligationMatchesTerminal(
  obligation: string,
  terminalTier: ExecutionDiagnosticTierV1,
): boolean {
  return terminalTier === "compiler-api"
    ? obligation === "compiler-api" ||
        obligation === "emit" ||
        obligation === "acme" ||
        obligation === "vice"
    : obligation === terminalTier;
}

/**
 * Binds a route item to genuine generated-case and published-oracle authority.
 *
 * @param input Route, opaque authorities and selected policy.
 * @returns A frozen tier-discriminated request or one stable validation issue.
 */
export function createExecutionRouteRequestV1(
  input: CreateExecutionRouteRequestInputV1,
): ExecutionOperationResultV1<ExecutionRouteRequestV1> {
  if (input.kind === "raw-malformed") {
    const projection = getMalformedDiagnosticCaseProjectionV1(input.malformedCase);
    const tier = input.route.terminalTier;
    if (!projection.ok) return projection;
    if (tier !== "frontend" && tier !== "compiler-api" && tier !== "cli") {
      return schemaFailure("/route/terminalTier", "Raw diagnostics support compiler tiers only.");
    }
    if (
      input.route.caseIdentity !== projection.value.textDigest ||
      input.route.ruleId !== projection.value.ruleId ||
      input.route.obligation !== projection.value.obligation ||
      !isExecutionDigestV1(input.route.rankDigest) ||
      !sameTiers(input.route.prerequisiteTiers, getExecutionPrerequisiteTiersV1(tier))
    ) {
      return failure("/route", "Raw diagnostic route does not match its exact-byte authority.");
    }
    const policy = createExecutionBudgetScopeV1(input.policy, 0);
    if (!policy.ok) return policy;
    return routeSuccess(
      Object.freeze({
        kind: "raw-malformed" as const,
        route: Object.freeze({
          ...input.route,
          prerequisiteTiers: Object.freeze([...input.route.prerequisiteTiers]),
        }),
        malformedCase: input.malformedCase,
        policy: input.policy,
      }),
    );
  }
  if (input.kind === "invalid-diagnostic") {
    const projection = getPublishedDiagnosticCaseProjectionV1(input.diagnosticCase);
    if (!projection.ok) {
      return failure("/diagnosticCase", "Published diagnostic case authority is invalid.");
    }
    const tier = input.route.terminalTier;
    if (tier !== "frontend" && tier !== "compiler-api" && tier !== "cli") {
      return schemaFailure(
        "/route/terminalTier",
        "Diagnostic routes support only compiler diagnostic tiers.",
      );
    }
    if (
      input.route.caseIdentity !== projection.value.sourceCaseDigest ||
      input.route.ruleId !== projection.value.expectedDiagnostic.ruleId ||
      !diagnosticObligationMatchesTerminal(input.route.obligation, tier) ||
      !isExecutionDigestV1(input.route.rankDigest) ||
      !sameTiers(input.route.prerequisiteTiers, getExecutionPrerequisiteTiersV1(tier))
    ) {
      return failure(
        "/route",
        "Diagnostic route does not match its genuine case and supported tier graph.",
      );
    }
    const policy = createExecutionBudgetScopeV1(input.policy, 0);
    if (!policy.ok) return policy;
    return routeSuccess(
      Object.freeze({
        kind: "invalid-diagnostic" as const,
        route: Object.freeze({
          ...input.route,
          prerequisiteTiers: Object.freeze([...input.route.prerequisiteTiers]),
        }),
        diagnosticCase: input.diagnosticCase,
        policy: input.policy,
      }) as ExecutionRouteRequestV1,
    );
  }
  const projection = getExecutionCaseProjectionV1(input.executionCase);
  if (!projection.ok) return projection;
  if (
    !isExecutionTierV1(input.route.terminalTier) ||
    !isExecutionDigestV1(input.route.caseIdentity) ||
    input.route.caseIdentity !== projection.value.sourceCaseDigest ||
    !isExecutionDigestV1(input.route.rankDigest) ||
    typeof input.route.ruleId !== "string" ||
    input.route.ruleId.length === 0 ||
    typeof input.route.obligation !== "string" ||
    input.route.obligation.length === 0 ||
    !sameTiers(
      input.route.prerequisiteTiers,
      getExecutionPrerequisiteTiersV1(input.route.terminalTier),
    )
  ) {
    return failure("/route", "Route does not match the genuine execution case and tier graph.");
  }
  if (!authenticOracle(input.oracle)) {
    return failure("/oracle", "Published oracle authority is not authentic.");
  }
  const policy = createExecutionBudgetScopeV1(input.policy, 0);
  if (!policy.ok) return policy;
  const route = Object.freeze({
    ...input.route,
    prerequisiteTiers: Object.freeze([...input.route.prerequisiteTiers]),
  });
  switch (input.route.terminalTier) {
    case "frontend":
      return routeSuccess(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "frontend" as const }),
        }),
      );
    case "compiler-api":
      return routeSuccess(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "compiler-api" as const }),
        }),
      );
    case "cli":
      return routeSuccess(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "cli" as const }),
        }),
      );
    case "emit":
      return routeSuccess(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "emit" as const }),
        }),
      );
    case "acme":
      return routeSuccess(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "acme" as const }),
        }),
      );
    case "vice":
      return routeSuccess(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "vice" as const }),
        }),
      );
  }
}

/** Builds deterministic evidence for input rejected before supervisor acquisition. */
function inputEvidence(tier: ExecutionTierV1, caseIdentity: string, code: string) {
  const preimage = ENCODER.encode(`${tier}\u0000${caseIdentity}\u0000${code}`);
  return Object.freeze({
    digest: `sha256:${createHash("sha256").update(preimage).digest("hex")}`,
    retainedBytes: preimage.byteLength,
    truncated: false,
  });
}

function pass(
  tier: Exclude<ExecutionTierV1, "vice">,
  supervisor: ExecutionSupervisorV1,
  caseIdentity: string,
): ExecutionResultV1 {
  const stage: ExecutionStageV1 = tier;
  const snapshot = supervisor.snapshot();
  if (!snapshot.ok) {
    return failed(tier, stage, "wall-time-exhaustion", caseIdentity);
  }
  return Object.freeze({
    status: "pass",
    tier,
    stage,
    code: "pass",
    usage: snapshot.value.usage,
    evidence: snapshot.value.evidence,
  });
}

function failed(
  tier: ExecutionTierV1,
  stage: ExecutionStageV1,
  code: Exclude<ExecutionResultCodeV1, "pass">,
  caseIdentity: string,
  supervisor?: ExecutionSupervisorV1,
): ExecutionResultV1 {
  const state = supervisor?.snapshot();
  const resultCode = supervisor !== undefined && state?.ok !== true ? "wall-time-exhaustion" : code;
  const fallback = inputEvidence(tier, caseIdentity, resultCode);
  return Object.freeze({
    status: "failure",
    tier,
    stage,
    code: resultCode,
    usage:
      state?.ok === true
        ? state.value.usage
        : Object.freeze({
            wallMs: 0,
            outputBytes: 0,
            evidenceBytes: fallback.retainedBytes,
            instructions: 0,
            cycles: 0,
            launchAttempts: 0,
          }),
    evidence: state?.ok === true ? state.value.evidence : fallback,
  });
}

/** Renders the canonical executable envelope into one closed tier-specific worker request. */
export { createSupervisedAcmeRunnerV1 } from "./execution-acme-artifacts.js";

/** Builds the six route handlers over injected production boundaries. */
export function createExecutionRouteHandlersV1(
  dependencies: ExecutionAdapterDependenciesV1,
): PublishedExecutionHandlersV1 {
  const supervisor = dependencies.lifecycle.supervisor;
  const workerBoundaryMatches = executionSupervisorOwnsWorkerExecutorV1(
    supervisor,
    dependencies.worker.executor,
  );
  const operationCode = (
    issueCode: string,
  ): "wall-time-exhaustion" | "output-exhaustion" | "evidence-exhaustion" | "compiler-ice" =>
    issueCode === "wall-time-exhaustion" ||
    issueCode === "output-exhaustion" ||
    issueCode === "evidence-exhaustion"
      ? issueCode
      : "compiler-ice";
  const executeWorker = async (
    tier: ExecutionWorkerTierV1,
    request: ExecutionRouteRequestV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionResultV1> => {
    if (
      !workerBoundaryMatches ||
      request.route.terminalTier !== tier ||
      cancellation.signal.aborted
    ) {
      return failed(tier, "input", "invalid-evidence-input", request.route.caseIdentity);
    }
    const workspace = await supervisor.createWorkspace(cancellation);
    if (!workspace.ok)
      return failed(tier, tier, "compiler-ice", request.route.caseIdentity, supervisor);
    const worker = createExecutionWorkerRequestV1(request, tier, workspace.value.root);
    if (worker === undefined)
      return failed(tier, tier, "compiler-ice", request.route.caseIdentity, supervisor);
    const candidate = getCandidateExecutionRouteStateV1(request);
    const parentEvidence = getExecutionWorkerDiagnosticParentEvidenceV1(request);
    if (
      (request.kind === "invalid-diagnostic" || candidate?.family === "typed-invalid") &&
      parentEvidence === undefined
    ) {
      return failed(tier, tier, "diagnostic-mismatch", request.route.caseIdentity, supervisor);
    }
    const response = await supervisor.runWorker(worker, cancellation, parentEvidence);
    if (!response.ok) {
      return failed(
        tier,
        tier,
        operationCode(response.issues[0].code),
        request.route.caseIdentity,
        supervisor,
      );
    }
    if (request.kind === "invalid-diagnostic") {
      const classified = classifyDiagnosticRouteEvidenceV1(request.diagnosticCase, {
        revision: "direct-diagnostic-evidence-v1",
        sourceCaseDigest: response.value.caseIdentity,
        diagnostics: response.value.diagnostics,
        emission: response.value.emission,
      });
      if (!classified.ok) {
        return failed(tier, tier, "diagnostic-mismatch", request.route.caseIdentity, supervisor);
      }
      return classified.value.status === "pass"
        ? pass(tier, supervisor, request.route.caseIdentity)
        : failed(tier, tier, classified.value.code, request.route.caseIdentity, supervisor);
    }
    if (request.kind === "raw-malformed") {
      return response.value.diagnostics.entries.length > 0
        ? pass(tier, supervisor, request.route.caseIdentity)
        : failed(tier, tier, "diagnostic-mismatch", request.route.caseIdentity, supervisor);
    }
    if (candidate?.family === "typed-invalid") {
      const original = candidate.originalRequest;
      if (original.kind !== "invalid-diagnostic") {
        return failed(tier, tier, "invalid-evidence-input", request.route.caseIdentity, supervisor);
      }
      const expected = getPublishedDiagnosticCaseProjectionV1(original.diagnosticCase);
      const entries = response.value.diagnostics.entries;
      const matched =
        expected.ok &&
        entries.length === 1 &&
        entries[0]?.code === expected.value.expectedDiagnostic.code &&
        entries[0]?.phase === expected.value.expectedDiagnostic.phase &&
        entries[0]?.finalSeverity === expected.value.expectedDiagnostic.severity;
      return matched
        ? pass(tier, supervisor, request.route.caseIdentity)
        : failed(tier, tier, "diagnostic-mismatch", request.route.caseIdentity, supervisor);
    }
    if (candidate?.family === "raw-malformed") {
      if (candidate.originalRequest.kind !== "raw-malformed") {
        return failed(tier, tier, "invalid-evidence-input", request.route.caseIdentity, supervisor);
      }
      return response.value.diagnostics.entries.length > 0
        ? pass(tier, supervisor, request.route.caseIdentity)
        : failed(tier, tier, "diagnostic-mismatch", request.route.caseIdentity, supervisor);
    }
    if (response.value.diagnostics.entries.some((entry) => entry.finalSeverity === "error")) {
      return failed(tier, tier, "diagnostic-mismatch", request.route.caseIdentity, supervisor);
    }
    return isValidExecutionWorkerSuccessV1(response.value)
      ? pass(tier, supervisor, request.route.caseIdentity)
      : failed(tier, tier, "unexpected-emission", request.route.caseIdentity, supervisor);
  };

  const acme: ExecutionRouteHandlerV1 = Object.freeze({
    async execute(
      request: ExecutionRouteRequestV1,
      cancellation: ExecutionCancellationV1,
    ): Promise<ExecutionResultV1> {
      if (
        !workerBoundaryMatches ||
        request.kind === "invalid-diagnostic" ||
        request.kind === "raw-malformed" ||
        (request.kind === "reduction-candidate-internal" &&
          getCandidateExecutionRouteStateV1(request)?.family !== "typed-valid") ||
        request.route.terminalTier !== "acme" ||
        cancellation.signal.aborted
      ) {
        return failed("acme", "input", "invalid-evidence-input", request.route.caseIdentity);
      }
      const outcome = await executeAcmeArtifactPipelineV1(
        supervisor,
        (caseRoot) => createExecutionWorkerRequestV1(request, "emit", caseRoot),
        cancellation,
        dependencies.acme,
      );
      if (!outcome.ok) {
        const issue = outcome.issues[0];
        const stage = issue.path === "/emit" ? "emit" : "acme";
        const code =
          issue.code === "wall-time-exhaustion" ||
          issue.code === "output-exhaustion" ||
          issue.code === "evidence-exhaustion" ||
          issue.code === "tier-unavailable" ||
          issue.code === "emission-failure" ||
          issue.code === "assembler-failure"
            ? issue.code
            : stage === "emit"
              ? "emission-failure"
              : "assembler-failure";
        return failed("acme", stage, code, request.route.caseIdentity, supervisor);
      }
      return pass("acme", supervisor, request.route.caseIdentity);
    },
  });

  return Object.freeze({
    frontend: Object.freeze({
      execute: (request: ExecutionRouteRequestV1, cancellation: ExecutionCancellationV1) =>
        executeWorker("frontend", request, cancellation),
    }),
    "compiler-api": Object.freeze({
      execute: (request: ExecutionRouteRequestV1, cancellation: ExecutionCancellationV1) =>
        executeWorker("compiler-api", request, cancellation),
    }),
    cli: Object.freeze({
      execute: (request: ExecutionRouteRequestV1, cancellation: ExecutionCancellationV1) =>
        executeWorker("cli", request, cancellation),
    }),
    emit: Object.freeze({
      execute: (request: ExecutionRouteRequestV1, cancellation: ExecutionCancellationV1) =>
        executeWorker("emit", request, cancellation),
    }),
    acme,
    vice: Object.freeze({ execute: dependencies.vice.execute }),
  });
}
