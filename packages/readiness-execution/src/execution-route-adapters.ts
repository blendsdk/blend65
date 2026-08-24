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
  PublishedOracleContext,
} from "@blend65/readiness";
import {
  getExecutionCaseProjectionV1,
  isExecutionDigestV1,
  isExecutionTierV1,
} from "@blend65/readiness/execution-runtime";
import { createPublishedOracleRequest } from "@blend65/readiness/published-oracle";
import {
  getPublishedDiagnosticCaseProjectionV1,
  type PublishedDiagnosticCaseV1,
} from "@blend65/readiness/published-oracle";

import { createExecutionBudgetScopeV1 } from "./execution-budget.js";
import { executeAcmeArtifactPipelineV1 } from "./execution-acme-artifacts.js";
import { renderExecutionEnvelopeV1 } from "./execution-envelope.js";
import { classifyInvalidCaseEmissionV1 } from "./execution-evidence-classifiers.js";
import { getExecutionPrerequisiteTiersV1 } from "./execution-route-tiers.js";
import {
  executionSupervisorOwnsWorkerExecutorV1,
  type ExecutionSupervisorV1,
  type ExecutionWorkerParentEvidenceIdentityV1,
} from "./execution-supervisor.js";
import {
  type ExecutionCancellationV1,
  type ExecutionWorkerExecutorV1,
  type ExecutionWorkerRequestV1,
  type ExecutionWorkerResponseV1,
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
  | DiagnosticExecutionRouteRequestV1<"cli">;

/** Input to the genuine-case route-request constructor. */
export type CreateExecutionRouteRequestInputV1 =
  | {
      readonly kind?: "valid-envelope";
      readonly route: ExecutionRoutePlanItemV1;
      readonly executionCase: ExecutionCaseV1;
      readonly oracle: PublishedOracleContext;
      readonly policy: ExecutionPolicyV1;
    }
  | DiagnosticExecutionRouteRequestV1<ExecutionDiagnosticTierV1>;

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
const DIRECT_DIAGNOSTIC_KEYS = ["revision", "sourceCaseDigest", "diagnostics", "emission"] as const;
const DIAGNOSTIC_KEYS = ["revision", "entries"] as const;
const DIAGNOSTIC_ENTRY_KEYS = ["acceptedEntryId", "code", "phase", "finalSeverity"] as const;
const EMISSION_KEYS = ["il", "assembly", "binary"] as const;

/** Direct parent-side classification result for one invalid diagnostic route. */
export type DiagnosticExecutionResultV1 =
  | { readonly status: "pass"; readonly code: "pass" }
  | {
      readonly status: "failure";
      readonly code: "diagnostic-mismatch" | "unexpected-emission";
    };

/** Worker evidence that intentionally carries no expected diagnostic truth. */
export interface DirectDiagnosticEvidenceV1 {
  readonly revision: "direct-diagnostic-evidence-v1";
  readonly sourceCaseDigest: string;
  readonly diagnostics: ExecutionWorkerResponseV1["diagnostics"];
  readonly emission: ExecutionWorkerResponseV1["emission"];
}

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

function exactRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const result: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

/**
 * Classifies hostile direct diagnostic evidence against opaque published truth.
 *
 * @param authority Authentic published diagnostic-case authority.
 * @param observed Worker-derived source identity, diagnostics and artifact presence.
 * @returns A closed classification or invalid-input issue.
 *
 * @example
 * ```ts
 * const classified = classifyDiagnosticRouteEvidenceV1(authority, observed);
 * ```
 */
export function classifyDiagnosticRouteEvidenceV1(
  authority: unknown,
  observed: unknown,
): ExecutionOperationResultV1<DiagnosticExecutionResultV1> {
  const projection = getPublishedDiagnosticCaseProjectionV1(authority as PublishedDiagnosticCaseV1);
  if (!projection.ok) {
    return failure("/authority", "Published diagnostic case authority is invalid.");
  }
  const record = exactRecord(observed, DIRECT_DIAGNOSTIC_KEYS);
  const diagnostics = exactRecord(record?.diagnostics, DIAGNOSTIC_KEYS);
  const emission = exactRecord(record?.emission, EMISSION_KEYS);
  if (
    record?.revision !== "direct-diagnostic-evidence-v1" ||
    !isExecutionDigestV1(record.sourceCaseDigest) ||
    diagnostics?.revision !== "compiler-diagnostic-evidence-v1" ||
    !Array.isArray(diagnostics.entries) ||
    Object.getPrototypeOf(diagnostics.entries) !== Array.prototype ||
    Reflect.ownKeys(diagnostics.entries).length !== diagnostics.entries.length + 1 ||
    emission === undefined ||
    typeof emission.il !== "boolean" ||
    typeof emission.assembly !== "boolean" ||
    typeof emission.binary !== "boolean"
  ) {
    return failure("/observed", "Direct diagnostic evidence is malformed.");
  }
  const entries: Readonly<Record<string, unknown>>[] = [];
  for (let index = 0; index < diagnostics.entries.length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(diagnostics.entries, String(index));
    const entry =
      descriptor !== undefined && "value" in descriptor && descriptor.enumerable
        ? exactRecord(descriptor.value, DIAGNOSTIC_ENTRY_KEYS)
        : undefined;
    if (
      entry === undefined ||
      typeof entry.acceptedEntryId !== "string" ||
      entry.acceptedEntryId.length === 0 ||
      typeof entry.code !== "string" ||
      typeof entry.phase !== "string" ||
      typeof entry.finalSeverity !== "string"
    ) {
      return failure("/observed/diagnostics", "Diagnostic evidence entries are malformed.");
    }
    entries.push(entry);
  }
  const expected = projection.value.expectedDiagnostic;
  const exact =
    record.sourceCaseDigest === projection.value.sourceCaseDigest &&
    entries.length === 1 &&
    entries[0]?.code === expected.code &&
    entries[0]?.phase === expected.phase &&
    entries[0]?.finalSeverity === expected.severity;
  if (!exact) return success(Object.freeze({ status: "failure", code: "diagnostic-mismatch" }));
  const emissionClassification = classifyInvalidCaseEmissionV1(record.emission);
  return emissionClassification === "pass"
    ? success(Object.freeze({ status: "pass", code: "pass" }))
    : success(Object.freeze({ status: "failure", code: "unexpected-emission" }));
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
    return success(
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
      return success<ExecutionRouteRequestV1>(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "frontend" as const }),
        }),
      );
    case "compiler-api":
      return success<ExecutionRouteRequestV1>(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "compiler-api" as const }),
        }),
      );
    case "cli":
      return success<ExecutionRouteRequestV1>(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "cli" as const }),
        }),
      );
    case "emit":
      return success<ExecutionRouteRequestV1>(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "emit" as const }),
        }),
      );
    case "acme":
      return success<ExecutionRouteRequestV1>(
        Object.freeze({
          ...input,
          kind: "valid-envelope" as const,
          route: Object.freeze({ ...route, terminalTier: "acme" as const }),
        }),
      );
    case "vice":
      return success<ExecutionRouteRequestV1>(
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
function workerRequest(
  request: ExecutionRouteRequestV1,
  tier: ExecutionWorkerTierV1,
  caseRoot: string,
): ExecutionWorkerRequestV1 | undefined {
  const diagnosticProjection =
    request.kind === "invalid-diagnostic"
      ? getPublishedDiagnosticCaseProjectionV1(request.diagnosticCase)
      : undefined;
  if (diagnosticProjection !== undefined && !diagnosticProjection.ok) return undefined;
  const rendered =
    request.kind === "invalid-diagnostic"
      ? undefined
      : renderExecutionEnvelopeV1(request.executionCase);
  if (rendered !== undefined && !rendered.ok) return undefined;
  const sourceBytes =
    diagnosticProjection?.ok === true
      ? diagnosticProjection.value.sourceBytes
      : ENCODER.encode(rendered?.value ?? "");
  const source = Object.freeze({
    revision: "execution-worker-source-v1" as const,
    relativePath: "main.blend",
    bytes: sourceBytes,
    digest:
      diagnosticProjection?.ok === true
        ? diagnosticProjection.value.authority.sourceContentIdentity
        : `sha256:${createHash("sha256").update(sourceBytes).digest("hex")}`,
  });
  const common = {
    revision: "execution-worker-request-v1" as const,
    caseKind:
      request.kind === "invalid-diagnostic"
        ? ("invalid-diagnostic" as const)
        : ("valid-envelope" as const),
    caseIdentity: request.route.caseIdentity,
    caseRoot,
    source,
  };
  switch (tier) {
    case "frontend":
      return Object.freeze({ ...common, tier, contract: "frontend-pipeline-v1" });
    case "compiler-api":
      return Object.freeze({ ...common, tier, contract: "compiler-evidence-facade-v1" });
    case "cli":
      return Object.freeze({
        ...common,
        tier,
        contract: "blendc-cli-v1",
        argv: Object.freeze(["check", "main.blend", "--platform", "c64"]),
      });
    case "emit":
      return Object.freeze({ ...common, tier, contract: "assembly-emitter-v1" });
  }
}

function diagnosticParentEvidence(
  request: ExecutionRouteRequestV1,
): ExecutionWorkerParentEvidenceIdentityV1 | undefined {
  if (request.kind !== "invalid-diagnostic") return undefined;
  const projection = getPublishedDiagnosticCaseProjectionV1(request.diagnosticCase);
  if (!projection.ok) return undefined;
  return Object.freeze({
    revision: "execution-worker-parent-evidence-v1",
    joinPolicyRevision: projection.value.authority.joinPolicyRevision,
    callerSourceCaseDigest: projection.value.sourceCaseDigest,
    selectedReleaseDigest: projection.value.authority.selectedReleaseDigest,
    selectedCampaignDigest: projection.value.authority.selectedCampaignDigest,
    selectedSourceCaseDigest: projection.value.authority.selectedSourceCaseDigest,
    evaluationIdentity: projection.value.authority.evaluationIdentity,
    sourceContentIdentity: projection.value.authority.sourceContentIdentity,
  });
}

/** Requires the tier's positive evidence while rejecting every later artifact. */
function validWorkerSuccess(response: ExecutionWorkerResponseV1): boolean {
  if (response.diagnostics.entries.some((entry) => entry.finalSeverity === "error")) return false;
  switch (response.tier) {
    case "frontend":
      return (
        response.semanticModelPresent &&
        response.allocationPlanPresent &&
        !response.emission.il &&
        !response.emission.assembly &&
        !response.emission.binary
      );
    case "compiler-api":
      return (
        !response.hasErrors &&
        !response.emission.il &&
        !response.emission.assembly &&
        !response.emission.binary
      );
    case "cli":
      return (
        response.exitCode === 0 &&
        !response.emission.il &&
        !response.emission.assembly &&
        !response.emission.binary
      );
    case "emit":
      return (
        !response.hasErrors &&
        response.assemblyBytes.byteLength > 0 &&
        !response.emission.il &&
        !response.emission.assembly &&
        !response.emission.binary
      );
  }
}

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
    const worker = workerRequest(request, tier, workspace.value.root);
    if (worker === undefined)
      return failed(tier, tier, "compiler-ice", request.route.caseIdentity, supervisor);
    const parentEvidence = diagnosticParentEvidence(request);
    if (request.kind === "invalid-diagnostic" && parentEvidence === undefined) {
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
    if (response.value.diagnostics.entries.some((entry) => entry.finalSeverity === "error")) {
      return failed(tier, tier, "diagnostic-mismatch", request.route.caseIdentity, supervisor);
    }
    return validWorkerSuccess(response.value)
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
        request.route.terminalTier !== "acme" ||
        cancellation.signal.aborted
      ) {
        return failed("acme", "input", "invalid-evidence-input", request.route.caseIdentity);
      }
      const outcome = await executeAcmeArtifactPipelineV1(
        supervisor,
        (caseRoot) => workerRequest(request, "emit", caseRoot),
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
