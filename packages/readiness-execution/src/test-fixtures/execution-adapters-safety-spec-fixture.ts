import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INVENTORY_V1_LIMITS,
  boundaryVariantsHandler,
  createCampaignPlan,
  createExecutionCaseV1,
  createModeledGeneratorSuite,
  deriveConfigurationIdentity,
  deriveImplementationRevision,
  generateCampaignCase,
  generateFrontendCase,
  generateRuntimeCase,
  getCampaignPlanItem,
  getExecutionCaseProjectionV1,
  parseInventoryJson,
  prepareIncrementalBindingPublication,
  prepareIncrementalBindingPublicationReview,
  registerFreshCandidateBinding,
  renderGeneratedCase,
  resolvePublishedSnapshotByDigest,
  validateImplementationRevision,
  validateInventorySchema,
  type CampaignDependenciesV1,
  type CampaignIdentityInput,
  type CampaignResult,
  type CaseRendererV1,
  type ExecutableBindingInput,
  type ExecutionCaseV1,
  type ExecutionOperationResultV1,
  type ExecutionPolicyV1,
  type ExecutionResultV1,
  type ExecutionRoutePlanItemV1,
  type ExecutionTierV1,
  type FreshCandidateRegistration,
  type GenerationConfiguration,
  type GeneratorCaseResult,
  type PreparedCampaign,
  type PublishedOracleContext,
  type ReplayEnvelopeV1,
  type Sha256Digest,
} from "@blend65/readiness";
import { createPublishedOracleContext } from "@blend65/readiness/published-oracle";

type WorkerTier = "frontend" | "compiler-api" | "cli" | "emit";

export interface Cancellation {
  readonly signal: AbortSignal;
  readonly deadlineMonotonicMs: number;
}

export interface WorkerSource {
  readonly revision: "execution-worker-source-v1";
  readonly relativePath: string;
  readonly bytes: Uint8Array;
  readonly digest: string;
}

export type WorkerRequest =
  | WorkerRequestBase<"frontend", "frontend-pipeline-v1">
  | WorkerRequestBase<"compiler-api", "compiler-evidence-facade-v1">
  | (WorkerRequestBase<"cli", "blendc-cli-v1"> & { readonly argv: readonly string[] })
  | WorkerRequestBase<"emit", "assembly-emitter-v1">;

interface WorkerRequestBase<TTier extends WorkerTier, TContract extends string> {
  readonly revision: "execution-worker-request-v1";
  readonly tier: TTier;
  readonly caseKind?: "valid-envelope" | "invalid-diagnostic";
  readonly contract: TContract;
  readonly caseIdentity: string;
  readonly caseRoot: string;
  readonly source: WorkerSource;
}

interface DiagnosticEvidence {
  readonly revision: "compiler-diagnostic-evidence-v1";
  readonly entries: readonly unknown[];
}

interface WorkerEmission {
  readonly il: boolean;
  readonly assembly: boolean;
  readonly binary: boolean;
}

export type WorkerResponse =
  | {
      readonly revision: "execution-worker-response-v1";
      readonly tier: "frontend";
      readonly contract: "frontend-pipeline-v1";
      readonly caseIdentity: string;
      readonly diagnostics: DiagnosticEvidence;
      readonly semanticModelPresent: boolean;
      readonly allocationPlanPresent: boolean;
      readonly emission: WorkerEmission;
    }
  | {
      readonly revision: "execution-worker-response-v1";
      readonly tier: "compiler-api";
      readonly contract: "compiler-evidence-facade-v1";
      readonly caseIdentity: string;
      readonly hasErrors: boolean;
      readonly diagnostics: DiagnosticEvidence;
      readonly emission: WorkerEmission;
    }
  | {
      readonly revision: "execution-worker-response-v1";
      readonly tier: "cli";
      readonly contract: "blendc-cli-v1";
      readonly caseIdentity: string;
      readonly exitCode: 0 | 1 | 2 | 3;
      readonly stdout: Uint8Array;
      readonly stderr: Uint8Array;
      readonly diagnostics: DiagnosticEvidence;
      readonly emission: WorkerEmission;
    }
  | {
      readonly revision: "execution-worker-response-v1";
      readonly tier: "emit";
      readonly contract: "assembly-emitter-v1";
      readonly caseIdentity: string;
      readonly hasErrors: boolean;
      readonly assemblyBytes: Uint8Array;
      readonly diagnostics: DiagnosticEvidence;
      readonly emission: WorkerEmission;
    };

export type WorkerCompletion =
  | { readonly kind: "message"; readonly value: unknown }
  | { readonly kind: "crash"; readonly exitCode: number | null };

export interface WorkerHandle {
  readonly completion: Promise<WorkerCompletion>;
  terminate(): Promise<void>;
}

export interface WorkerExecutor {
  start(
    request: WorkerRequest,
    cancellation: Cancellation,
  ): Promise<ExecutionOperationResultV1<WorkerHandle>>;
}

export interface RouteRequest {
  readonly route: ExecutionRoutePlanItemV1;
  readonly executionCase: ExecutionCaseV1;
  readonly oracle: PublishedOracleContext;
  readonly policy: ExecutionPolicyV1;
}

export interface PublishedDiagnosticCase {
  readonly diagnosticCaseBrand?: never;
}

export interface DiagnosticCaseProjection {
  readonly schemaVersion: 1;
  readonly kind: "invalid-source-transform";
  readonly sourceCaseDigest: Sha256Digest;
  readonly sourceBytes: Uint8Array;
  readonly expectedDiagnostic: {
    readonly kind: "diagnostic";
    readonly ruleId: string;
    readonly neighborId: string;
    readonly code: string;
    readonly phase: "lexer" | "parser" | "semantic" | "sfa";
    readonly severity: "error";
  };
  readonly authority: {
    readonly joinPolicyRevision: "published-diagnostic-case-equivalence-v1";
    readonly selectedReleaseDigest: Sha256Digest;
    readonly selectedCampaignDigest: Sha256Digest;
    readonly selectedSourceCaseDigest: Sha256Digest;
    readonly evaluationIdentity: Sha256Digest;
    readonly sourceContentIdentity: Sha256Digest;
  };
}

export interface DiagnosticRouteRequest {
  readonly kind: "invalid-diagnostic";
  readonly route: ExecutionRoutePlanItemV1 & {
    readonly terminalTier: "frontend" | "compiler-api" | "cli";
  };
  readonly diagnosticCase: PublishedDiagnosticCase;
  readonly policy: ExecutionPolicyV1;
}

export interface RouteHandler {
  execute(request: RouteRequest, cancellation: Cancellation): Promise<ExecutionResultV1>;
}

export type RouteHandlers = Readonly<Record<ExecutionTierV1, RouteHandler>>;

export interface RouteApi {
  readonly createExecutionRouteRequestV1: (
    input: RouteRequest,
  ) => ExecutionOperationResultV1<RouteRequest>;
}

export interface DiagnosticRouteApi {
  readonly createExecutionRouteRequestV1: (
    input: unknown,
  ) => ExecutionOperationResultV1<DiagnosticRouteRequest>;
}

type OracleResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly diagnostics: readonly { readonly code: string; readonly path: string }[];
    };

export interface PublishedDiagnosticApi {
  readonly createPublishedDiagnosticCaseV1: (
    context: unknown,
    campaign: PreparedCampaign,
    ordinal: number,
  ) => OracleResult<PublishedDiagnosticCase>;
  readonly getPublishedDiagnosticCaseProjectionV1: (
    value: unknown,
  ) => OracleResult<DiagnosticCaseProjection>;
}

export interface GenuineRouteFixture {
  readonly requests: Readonly<Record<ExecutionTierV1, RouteRequest>>;
  cleanup(): Promise<void>;
}

export interface GenuineDiagnosticFixture {
  readonly context: PublishedOracleContext;
  readonly campaign: PreparedCampaign;
  readonly diagnosticCase: PublishedDiagnosticCase;
  readonly projection: DiagnosticCaseProjection;
  readonly ordinals: {
    readonly valid: number;
    readonly invalidSource: number;
    readonly invalidParameter: number;
  };
  readonly ambientMismatchCases: Readonly<
    Record<DiagnosticAmbientAxis, { readonly campaign: PreparedCampaign; readonly ordinal: number }>
  >;
  readonly constructionGateResults: Readonly<
    Record<DiagnosticConstructionGateAxis, { readonly ok: boolean }>
  >;
  readonly sourceMismatchCase: {
    readonly campaign: PreparedCampaign;
    readonly ordinal: number;
  };
  readonly modeledMismatchCases: Readonly<
    Record<
      DiagnosticModeledMismatchAxis,
      { readonly campaign: PreparedCampaign; readonly ordinal: number }
    >
  >;
  readonly runtimeCase: {
    readonly campaign: PreparedCampaign;
    readonly ordinal: number;
    readonly diagnosticCase: PublishedDiagnosticCase;
    readonly projection: DiagnosticCaseProjection;
  };
  readonly seedCases: {
    readonly repeated: {
      readonly campaign: PreparedCampaign;
      readonly ordinal: number;
      readonly diagnosticCase: PublishedDiagnosticCase;
      readonly projection: DiagnosticCaseProjection;
    };
    readonly different: {
      readonly campaign: PreparedCampaign;
      readonly ordinal: number;
      readonly diagnosticCase: PublishedDiagnosticCase;
      readonly projection: DiagnosticCaseProjection;
    };
    readonly replayBytes: Uint8Array;
    readonly hostileReplayBytes: Uint8Array;
  };
  readonly configurationCase: {
    readonly campaign: PreparedCampaign;
    readonly ordinal: number;
    readonly diagnosticCase: PublishedDiagnosticCase;
    readonly projection: DiagnosticCaseProjection;
    readonly hostileReplayBytes: Uint8Array;
  };
  readonly requests: Readonly<Record<"frontend" | "compiler-api" | "cli", DiagnosticRouteRequest>>;
  cleanup(): Promise<void>;
}

export type DiagnosticAmbientAxis =
  | "inventory-version"
  | "inventory-digest"
  | "spec-revision"
  | "target";

export type DiagnosticConstructionGateAxis =
  | "inventory-schema-version"
  | "prng-algorithm"
  | "generator-handler-id"
  | "generator-contract-version"
  | "boundary-handler-id"
  | "boundary-contract-version"
  | "rule-model-version"
  | "rule-model-digest";

export type DiagnosticModeledMismatchAxis =
  | "validity"
  | "transform"
  | "bindings"
  | "rule"
  | "neighbor";

export interface OwnershipProbe {
  readonly workspaces: Set<string>;
  readonly workers: Set<string>;
  readonly children: Set<number>;
  readonly monitors: Set<string>;
  readonly checkpoints: Set<string>;
}

export interface ScriptedWorker extends WorkerExecutor {
  readonly requests: WorkerRequest[];
  readonly terminations: string[];
}

export interface ProcessIdentity {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: bigint;
  readonly processGroupId: number;
}

export interface ProcessRequest {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly deadline: {
    readonly hardDeadlineMs: number;
    readonly workDeadlineMs: number;
    readonly cleanupGraceMs: number;
  };
}

export interface ProcessSink {
  onStdout(bytes: Uint8Array): void;
  onStderr(bytes: Uint8Array): void;
}

export interface ProcessHandle {
  readonly identity: ProcessIdentity;
  readonly completion: Promise<{ readonly exitCode: number | null; readonly signal: null }>;
  revalidateIdentity(): Promise<boolean>;
  terminate(signal: NodeJS.Signals): Promise<void>;
}

export interface ProcessRuntime {
  start(
    request: ProcessRequest,
    sink: ProcessSink,
    cancellation: Cancellation,
  ): Promise<ExecutionOperationResultV1<ProcessHandle>>;
}

export interface ProcessScript {
  readonly chunks: readonly {
    readonly stream: "stdout" | "stderr";
    readonly bytes: Uint8Array;
  }[];
  readonly completes: boolean;
}

export interface ScriptedProcess extends ProcessRuntime {
  readonly requests: ProcessRequest[];
  readonly terminations: NodeJS.Signals[];
}

export interface HostProcessIdentity {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: bigint;
  readonly processGroupId: number;
  readonly sessionId: number;
}

export type HostProcessExit =
  | { readonly kind: "exit"; readonly exitCode: number }
  | { readonly kind: "signal"; readonly signal: NodeJS.Signals }
  | { readonly kind: "crash"; readonly code: "spawn" | "io"; readonly message: string };

export type ControlRead =
  | { readonly kind: "frame"; readonly bytes: Uint8Array }
  | { readonly kind: "eof" }
  | { readonly kind: "crash"; readonly code: "io"; readonly message: string };

export interface ProcessControlTransport {
  sendFrame(
    bytes: Uint8Array,
    cancellation: Cancellation,
  ): Promise<ExecutionOperationResultV1<void>>;
  receiveFrame(cancellation: Cancellation): Promise<ControlRead>;
  close(cancellation: Cancellation): Promise<ExecutionOperationResultV1<void>>;
}

export interface ProcessAnchorTransport extends ProcessControlTransport, ProcessSink {}

export type GroupMembership =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly witness: HostProcessIdentity }
  | { readonly kind: "recycled"; readonly witness: HostProcessIdentity }
  | { readonly kind: "unknown"; readonly reason: "io" | "permission" | "limit" | "malformed" };

export interface GroupMembershipQuery {
  readonly revision: "execution-group-membership-query-v1";
  readonly anchor: HostProcessIdentity;
  readonly scope: "including-anchor" | "excluding-anchor";
}

export interface ProcessEnvironment {
  readonly LANG: "C";
  readonly LC_ALL: "C";
  readonly TZ: "UTC";
}

export interface AnchorSpawnInput {
  readonly revision: "execution-anchor-spawn-v1";
  readonly executable: string;
  readonly argv: readonly [string];
  readonly cwd: string;
  readonly environment: ProcessEnvironment;
  readonly detached: true;
  readonly shell: false;
  readonly stdio: "ignore-output-control-pipes";
}

export interface SpawnedAnchor {
  readonly identity: HostProcessIdentity;
  readonly control: ProcessControlTransport;
  readonly completion: Promise<HostProcessExit>;
}

export interface ProcessParentHost {
  randomBytes(byteLength: 32): Uint8Array;
  spawnAnchor(
    input: AnchorSpawnInput,
    sink: ProcessSink,
    cancellation: Cancellation,
  ): Promise<ExecutionOperationResultV1<SpawnedAnchor>>;
  observeGroup(input: GroupMembershipQuery, cancellation: Cancellation): Promise<GroupMembership>;
}

export interface TargetSpawnInput {
  readonly revision: "execution-target-spawn-v1";
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly environment: ProcessEnvironment;
  readonly detached: false;
  readonly shell: false;
  readonly stdio: "ignore-output-pipes";
}

export interface SpawnedTarget {
  readonly identity: HostProcessIdentity;
  readonly completion: Promise<HostProcessExit>;
}

export interface SelfGroupSignal {
  readonly revision: "execution-self-group-signal-v1";
  readonly target: "self-process-group";
  readonly signal: "SIGTERM" | "SIGKILL";
}

export interface ProcessAnchorHost {
  observeSelf(cancellation: Cancellation): Promise<ExecutionOperationResultV1<HostProcessIdentity>>;
  spawnTarget(
    input: TargetSpawnInput,
    sink: ProcessSink,
    cancellation: Cancellation,
  ): Promise<ExecutionOperationResultV1<SpawnedTarget>>;
  signalSelfProcessGroup(input: SelfGroupSignal): Promise<ExecutionOperationResultV1<void>>;
  observeGroup(input: GroupMembershipQuery, cancellation: Cancellation): Promise<GroupMembership>;
}

export interface ProcessKernelApi {
  readonly createExecutionProcessRuntimeV1: (host?: ProcessParentHost) => ProcessRuntime;
  readonly runExecutionProcessAnchorV1: (
    host: ProcessAnchorHost,
    transport: ProcessAnchorTransport,
    cancellation: Cancellation,
  ) => Promise<ExecutionOperationResultV1<void>>;
  readonly defaultExecutionProcessRuntimeV1: ProcessRuntime;
  readonly EXECUTION_PROCESS_KERNEL_LIMITS_V1: Readonly<{
    controlFrameBytes: 8_388_608;
    controlBytesPerDirection: 16_777_216;
    controlFramesPerDirection: 16;
    nonceBytes: 32;
    argvItems: 1_024;
    argumentBytes: 65_536;
    argvBytes: 524_288;
    executableBytes: 65_536;
    cwdBytes: 65_536;
    environmentEntries: 3;
    environmentBytes: 131_072;
    protocolMessageBytes: 4_096;
  }>;
}

export type RawFrameMutation = (
  bytes: Uint8Array,
  ordinal: number,
) => ControlRead | readonly ControlRead[];

export interface ProcessKernelHarnessOptions {
  readonly mutateParentFrame?: RawFrameMutation;
  readonly mutateAnchorFrame?: RawFrameMutation;
  readonly targetStreams?: readonly {
    readonly stream: "stdout" | "stderr";
    readonly bytes: Uint8Array;
  }[];
}

export interface ProcessKernelHarness {
  readonly parentHost: ProcessParentHost;
  readonly anchorIdentity: HostProcessIdentity;
  readonly targetIdentity: HostProcessIdentity;
  readonly anchorSpawns: AnchorSpawnInput[];
  readonly targetSpawns: TargetSpawnInput[];
  readonly parentFrames: Uint8Array[];
  readonly anchorFrames: Uint8Array[];
  readonly signals: SelfGroupSignal[];
  readonly parentMembershipQueries: GroupMembershipQuery[];
  readonly anchorMembershipQueries: GroupMembershipQuery[];
  readonly events: readonly (
    | { readonly kind: "parent-frame"; readonly bytes: Uint8Array }
    | { readonly kind: "anchor-frame"; readonly bytes: Uint8Array }
    | { readonly kind: "self-group-signal"; readonly signal: SelfGroupSignal }
  )[];
  readonly sentinel: { alive: boolean };
  completeTarget(exit: HostProcessExit): void;
  enqueueMembership(value: GroupMembership): void;
  failParentControl(value: Extract<ControlRead, { readonly kind: "eof" | "crash" }>): void;
  crashAnchor(
    exit?: HostProcessExit,
    controlFailure?: Extract<ControlRead, { readonly kind: "eof" | "crash" }>,
  ): void;
}

const ENCODER = new TextEncoder();
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const BASE_PUBLICATION_DIGEST =
  "sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403";
const ORACLE_HANDLER_IDS = [
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
] as const;
const RULE_ID = "rule.ch02.2-primitive-types.word.range.0-65535";
const RUNTIME_RULE_ID = "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte";

/** Policy small enough for fast deterministic safety tests. */
export const SPEC_POLICY: ExecutionPolicyV1 = Object.freeze({
  revision: "execution-policy-v1",
  budget: Object.freeze({
    operationMs: 1_000,
    launchAttemptMs: 1_000,
    routeMs: 10_000,
    cleanupGraceMs: 1_000,
    outputBytes: 64,
    evidenceBytes: 16_777_216,
    instructions: 100,
    cycles: 1_000,
    launchAttempts: 2,
  }),
});

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return { ok: true, value };
}

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function requireSuccess<T>(result: ExecutionOperationResultV1<T>): T {
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.issues));
  }
  return result.value;
}

function requireOracleSuccess<T>(result: OracleResult<T>): T {
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.diagnostics));
  }
  return result.value;
}

function deriveRevision(name: string) {
  const path = `fixtures/${name}.ts`;
  const metadata = {
    contractVersion: "1.0.0",
    entryPath: path,
    files: [{ path, content: ENCODER.encode(`export const fixture = "${name}";\n`) }],
  } as const;
  const derived = deriveImplementationRevision(metadata);
  if (!derived.ok) throw new TypeError("fixture revision derivation failed");
  return { metadata, revision: derived.revision };
}

function freshRegistration(
  name: string,
  binding: Omit<ExecutableBindingInput, "implementationRevision">,
): FreshCandidateRegistration {
  const derived = deriveRevision(name);
  const freshness = validateImplementationRevision({
    claimedRevision: derived.revision,
    metadata: derived.metadata,
  });
  if (!freshness.ok) throw new TypeError("fixture freshness proof failed");
  const registered = registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: derived.revision },
    freshness,
  });
  if (!registered.ok) throw new TypeError("fixture registration failed");
  return registered.registration;
}

function freshRegistrationGate(
  name: string,
  binding: Omit<ExecutableBindingInput, "implementationRevision">,
): { readonly ok: boolean } {
  const derived = deriveRevision(name);
  const freshness = validateImplementationRevision({
    claimedRevision: derived.revision,
    metadata: derived.metadata,
  });
  if (!freshness.ok) return { ok: false };
  const registered = registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: derived.revision },
    freshness,
  });
  return { ok: registered.ok };
}

interface CampaignOptions {
  readonly caseCount?: number;
  readonly maxInvalidCases?: number;
  readonly spellings?: GenerationConfiguration["spellings"];
  readonly ruleId?: string;
  readonly generatorHandlerId?: string;
  readonly generatorContractVersion?: string;
  readonly generatorName?: string;
  readonly generatorImplementation?: typeof generateFrontendCase;
  readonly boundaryHandlerId?: string;
  readonly boundaryContractVersion?: string;
  readonly boundaryName?: string;
  readonly rendererName?: string;
  readonly rendererImplementation?: CaseRendererV1;
  readonly inventoryVersion?: string;
  readonly inventoryDigest?: Sha256Digest;
  readonly specRevision?: string;
  readonly ruleModelVersion?: string;
  readonly ruleModelDigest?: Sha256Digest;
  readonly target?: CampaignIdentityInput["target"];
  readonly seed?: Sha256Digest;
  readonly inventoryBytes?: Uint8Array;
}

interface CampaignPlanInput {
  readonly campaign: CampaignIdentityInput;
  readonly configuration: GenerationConfiguration;
  readonly dependencies: CampaignDependenciesV1;
}

async function createCampaignPlanInput(options: CampaignOptions = {}): Promise<CampaignPlanInput> {
  const inventoryUrl = new URL(
    "../../../../readiness/inventory/compiler-readiness-v1.json",
    import.meta.url,
  );
  const modelUrl = new URL(
    "../../../../readiness/rule-models/rule-models-v1.json",
    import.meta.url,
  );
  const seedUrl = new URL(
    "../../../../readiness/rule-models/rule-model-seed-v1.json",
    import.meta.url,
  );
  const reviewUrl = new URL(
    "../../../../readiness/reviews/rule-models-v1-review.json",
    import.meta.url,
  );
  const [workspaceInventoryBytes, ruleModelBytes, seedContractBytes, reviewEvidenceBytes] =
    await Promise.all([
      readFile(inventoryUrl),
      readFile(modelUrl),
      readFile(seedUrl),
      readFile(reviewUrl),
    ]);
  const inventoryBytes = options.inventoryBytes ?? workspaceInventoryBytes;
  const parsed = parseInventoryJson(inventoryBytes, INVENTORY_V1_LIMITS);
  if (!parsed.ok || parsed.inventory === undefined) throw new TypeError("inventory parse failed");
  const validated = validateInventorySchema(parsed.inventory);
  if (!validated.ok || validated.inventory === undefined) {
    throw new TypeError("inventory validation failed");
  }
  const modeled = createModeledGeneratorSuite({
    inventory: validated.inventory,
    seedContractBytes,
    ruleModelBytes,
    reviewEvidenceBytes,
  });
  if (!modeled.ok) throw new TypeError("modeled authority creation failed");
  const configuration: GenerationConfiguration = {
    caseCount: options.caseCount ?? 16,
    maxInvalidCases: options.maxInvalidCases ?? 0,
    enabledRuleIds: [options.ruleId ?? RULE_ID],
    spellings: options.spellings ?? ["parameter"],
    budget: {
      maxModules: 2,
      maxDeclarations: 128,
      maxIrNodes: 512,
      maxStatements: 128,
      maxExpressionDepth: 16,
      maxLoopWork: 1n,
      maxSourceBytes: 65_536,
      maxAttempts: 32,
    },
  };
  const configurationIdentity = deriveConfigurationIdentity(configuration);
  if (!configurationIdentity.ok) throw new TypeError("configuration identity failed");
  const generator = freshRegistration(options.generatorName ?? "adapter-safety-generator", {
    handlerId: options.generatorHandlerId ?? "generator.frontend-cases",
    kind: "generator",
    contractVersion: options.generatorContractVersion ?? "1.0.0",
    implementation: options.generatorImplementation ?? generateFrontendCase,
  });
  const boundaryTransform = freshRegistration(options.boundaryName ?? "adapter-safety-boundary", {
    handlerId: options.boundaryHandlerId ?? "transform.boundary-variants",
    kind: "transform",
    contractVersion: options.boundaryContractVersion ?? "1.0.0",
    implementation: boundaryVariantsHandler,
  });
  const rendererRevision = deriveRevision(
    options.rendererName ?? "adapter-safety-renderer",
  ).revision;
  const dependencies: CampaignDependenciesV1 = {
    inventory: {
      schemaVersion: 1,
      inventoryVersion: options.inventoryVersion ?? validated.inventory.inventoryVersion,
      inventoryDigest: options.inventoryDigest ?? sha256(inventoryBytes),
      specRevision: options.specRevision ?? "spec-v3.0",
    },
    ruleModel: {
      schemaVersion: 1,
      ruleModelVersion: options.ruleModelVersion ?? "rule-model-v1",
      ruleModelDigest: options.ruleModelDigest ?? modeled.ruleModelDigest,
      suite: modeled.suite,
    },
    generator,
    boundaryTransform,
    renderer: {
      implementationRevision: rendererRevision,
      implementation: options.rendererImplementation ?? renderGeneratedCase,
    },
  };
  const campaign: CampaignIdentityInput = {
    inventorySchemaVersion: 1,
    inventoryVersion: dependencies.inventory.inventoryVersion,
    inventoryDigest: dependencies.inventory.inventoryDigest,
    specRevision: dependencies.inventory.specRevision,
    ruleModelVersion: dependencies.ruleModel.ruleModelVersion,
    ruleModelDigest: dependencies.ruleModel.ruleModelDigest,
    generator: {
      handlerId: generator.binding.handlerId,
      contractVersion: generator.binding.contractVersion,
      implementationRevision: generator.binding.implementationRevision,
    },
    boundaryTransform: {
      handlerId: boundaryTransform.binding.handlerId,
      contractVersion: boundaryTransform.binding.contractVersion,
      implementationRevision: boundaryTransform.binding.implementationRevision,
    },
    rendererRevision,
    target: options.target ?? "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: options.seed ?? `sha256:${"9".repeat(64)}`,
    configurationDigest: configurationIdentity.identity,
  };
  return { campaign, configuration, dependencies };
}

async function createFrontendCampaign(options: CampaignOptions = {}): Promise<PreparedCampaign> {
  const prepared = createCampaignPlan(await createCampaignPlanInput(options));
  if (!prepared.ok) {
    throw new TypeError(`campaign creation failed: ${JSON.stringify(prepared.diagnostics)}`);
  }
  return prepared.value;
}

function findCampaignOrdinals(campaign: PreparedCampaign): {
  readonly valid: number;
  readonly invalidSource: number;
  readonly invalidParameter?: number;
} {
  let valid: number | undefined;
  let invalidSource: number | undefined;
  let invalidParameter: number | undefined;
  for (let ordinal = 0; ordinal < campaign.summary.totalCaseCount; ordinal += 1) {
    const generated = generateCampaignCase(campaign, ordinal);
    if (!generated.ok) continue;
    const rendered = renderGeneratedCase(
      generated.value.modeledCase,
      generated.value.planItem.renderOptions,
    );
    if (!rendered.ok) continue;
    if (rendered.kind === "valid" && valid === undefined) valid = ordinal;
    if (rendered.kind === "invalid-source-transform" && invalidSource === undefined) {
      invalidSource = ordinal;
    }
    if (rendered.kind === "invalid-parameter-binding" && invalidParameter === undefined) {
      invalidParameter = ordinal;
    }
  }
  if (valid === undefined || invalidSource === undefined) {
    throw new TypeError("campaign did not produce the required diagnostic authority strata");
  }
  return invalidParameter === undefined
    ? { valid, invalidSource }
    : { valid, invalidSource, invalidParameter };
}

function mutateGeneratedCase(axis: "validity" | "transform" | "bindings" | "rule" | "neighbor") {
  return (
    suite: Parameters<typeof generateFrontendCase>[0],
    input: unknown,
  ): GeneratorCaseResult => {
    const generated = generateFrontendCase(suite, input);
    if (!generated.ok || generated.outcome !== "generated") return generated;
    const modeled = generated.case;
    switch (axis) {
      case "validity":
        return { ...generated, case: { ...modeled, validity: { kind: "valid" } } };
      case "transform":
        return modeled.projection.kind === "invalid"
          ? {
              ...generated,
              case: {
                ...modeled,
                projection: {
                  ...modeled.projection,
                  transform: {
                    kind: "scalar-expression-replace",
                    expressionPath: "/functions/0/body/0/value",
                    replacement: { kind: "integer-literal", value: 65_537n },
                  },
                },
              },
            }
          : generated;
      case "bindings":
        return {
          ...generated,
          case: {
            ...modeled,
            parameterBindings: [
              ...modeled.parameterBindings,
              { kind: "parameter-value", parameterPath: "/functions/0/parameters/0", value: 0n },
            ],
          },
        };
      case "rule":
        return {
          ...generated,
          case: { ...modeled, primaryRuleId: `${modeled.primaryRuleId}.mutant` },
        };
      case "neighbor":
        return modeled.validity.kind === "invalid"
          ? {
              ...generated,
              case: {
                ...modeled,
                validity: {
                  ...modeled.validity,
                  neighborId: `${modeled.validity.neighborId}.mutant`,
                },
              },
            }
          : generated;
    }
  };
}

const sourceMutatingRenderer: CaseRendererV1 = (generatedCase, options) => {
  const rendered = renderGeneratedCase(generatedCase, options);
  if (!rendered.ok) return rendered;
  const source = `${rendered.source}\n`;
  return { ...rendered, source, sourceBytes: ENCODER.encode(source) };
};

async function createDiagnosticCampaign(options: CampaignOptions = {}): Promise<{
  readonly campaign: PreparedCampaign;
  readonly ordinal: number;
  readonly replayEnvelope: ReplayEnvelopeV1;
}> {
  const input = await createCampaignPlanInput({
    caseCount: 48,
    maxInvalidCases: 24,
    spellings: ["literal", "parameter"],
    ...options,
  });
  const prepared = createCampaignPlan(input);
  if (!prepared.ok) {
    throw new TypeError(`campaign creation failed: ${JSON.stringify(prepared.diagnostics)}`);
  }
  const campaign = prepared.value;
  const ordinal = findCampaignOrdinals(campaign).invalidSource;
  const generated = generateCampaignCase(campaign, ordinal);
  if (!generated.ok) throw new TypeError("diagnostic replay case generation failed");
  return {
    campaign,
    ordinal,
    replayEnvelope: {
      schemaVersion: 1,
      campaign: input.campaign,
      campaignDigest: campaign.summary.campaignDigest,
      caseIdentity: generated.value.identity,
      configuration: input.configuration,
    },
  };
}

function replayWireBytes(envelope: ReplayEnvelopeV1): Uint8Array {
  return ENCODER.encode(
    `${JSON.stringify(envelope, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    )}\n`,
  );
}

function invokeCampaignPreparation(input: unknown): CampaignResult<PreparedCampaign> {
  return Reflect.apply(createCampaignPlan, undefined, [input]);
}

async function createConstructionGateResults(
  inventoryBytes: Uint8Array,
): Promise<Readonly<Record<DiagnosticConstructionGateAxis, { readonly ok: boolean }>>> {
  const base = await createCampaignPlanInput({
    caseCount: 48,
    maxInvalidCases: 24,
    spellings: ["literal", "parameter"],
    inventoryBytes,
  });
  const [generatorHandler, boundaryHandler, ruleModelVersion, ruleModelDigest] = await Promise.all([
    createCampaignPlanInput({
      generatorHandlerId: "generator.compiler-cases",
      inventoryBytes,
    }),
    createCampaignPlanInput({
      boundaryHandlerId: "transform.not-boundary-variants",
      inventoryBytes,
    }),
    createCampaignPlanInput({
      ruleModelVersion: "rule-model-v1-mismatch",
      inventoryBytes,
    }),
    createCampaignPlanInput({
      ruleModelDigest: `sha256:${"2".repeat(64)}`,
      inventoryBytes,
    }),
  ]);
  return {
    "inventory-schema-version": invokeCampaignPreparation({
      ...base,
      campaign: { ...base.campaign, inventorySchemaVersion: 2 },
    }),
    "prng-algorithm": invokeCampaignPreparation({
      ...base,
      campaign: { ...base.campaign, prngAlgorithm: "unversioned-random" },
    }),
    "generator-handler-id": createCampaignPlan(generatorHandler),
    "generator-contract-version": freshRegistrationGate("adapter-safety-generator-contract", {
      handlerId: "generator.frontend-cases",
      kind: "generator",
      contractVersion: "2.0.0",
      implementation: generateFrontendCase,
    }),
    "boundary-handler-id": createCampaignPlan(boundaryHandler),
    "boundary-contract-version": freshRegistrationGate("adapter-safety-boundary-contract", {
      handlerId: "transform.boundary-variants",
      kind: "transform",
      contractVersion: "2.0.0",
      implementation: boundaryVariantsHandler,
    }),
    "rule-model-version": createCampaignPlan(ruleModelVersion),
    "rule-model-digest": createCampaignPlan(ruleModelDigest),
  };
}

async function createModeledMismatchCases(
  inventoryBytes: Uint8Array,
): Promise<
  Readonly<
    Record<
      DiagnosticModeledMismatchAxis,
      { readonly campaign: PreparedCampaign; readonly ordinal: number }
    >
  >
> {
  const axes: readonly DiagnosticModeledMismatchAxis[] = [
    "validity",
    "transform",
    "bindings",
    "rule",
    "neighbor",
  ];
  const settled = await Promise.allSettled(
    axes.map((axis) =>
      createDiagnosticCampaign({
        inventoryBytes,
        generatorName: `adapter-safety-${axis}-mutant`,
        generatorImplementation: mutateGeneratedCase(axis),
      }),
    ),
  );
  const rejected = settled.flatMap((result, index) =>
    result.status === "rejected" ? [`${axes[index]}: ${String(result.reason)}`] : [],
  );
  if (rejected.length > 0) {
    throw new TypeError(`modeled mismatch campaigns are not constructible: ${rejected.join("; ")}`);
  }
  const entries = settled.map((result) => {
    if (result.status !== "fulfilled") throw new TypeError("modeled mismatch setup failed");
    return result.value;
  });
  const [validity, transform, bindings, rule, neighbor] = entries;
  if (
    validity === undefined ||
    transform === undefined ||
    bindings === undefined ||
    rule === undefined ||
    neighbor === undefined
  ) {
    throw new TypeError("modeled mismatch setup was incomplete");
  }
  return { validity, transform, bindings, rule, neighbor };
}

async function createAmbientMismatchCases(
  inventoryBytes: Uint8Array,
): Promise<
  Readonly<
    Record<DiagnosticAmbientAxis, { readonly campaign: PreparedCampaign; readonly ordinal: number }>
  >
> {
  const axes: readonly DiagnosticAmbientAxis[] = [
    "inventory-version",
    "inventory-digest",
    "spec-revision",
    "target",
  ];
  const settled = await Promise.allSettled([
    createDiagnosticCampaign({
      inventoryVersion: "compiler-readiness-v1-mismatch",
      inventoryBytes,
    }),
    createDiagnosticCampaign({ inventoryDigest: `sha256:${"1".repeat(64)}`, inventoryBytes }),
    createDiagnosticCampaign({ specRevision: "spec-v3.0-mismatch", inventoryBytes }),
    createDiagnosticCampaign({ target: "c64u", inventoryBytes }),
  ]);
  const rejected = settled.flatMap((result, index) =>
    result.status === "rejected" ? [`${axes[index]}: ${String(result.reason)}`] : [],
  );
  if (rejected.length > 0) {
    throw new TypeError(`ambient mismatch campaigns are not constructible: ${rejected.join("; ")}`);
  }
  const entries = settled.map((result) => {
    if (result.status !== "fulfilled") throw new TypeError("ambient mismatch setup failed");
    return result.value;
  });
  const [inventoryVersion, inventoryDigest, specRevision, target] = entries;
  if (
    inventoryVersion === undefined ||
    inventoryDigest === undefined ||
    specRevision === undefined ||
    target === undefined
  ) {
    throw new TypeError("ambient mismatch setup was incomplete");
  }
  return {
    "inventory-version": inventoryVersion,
    "inventory-digest": inventoryDigest,
    "spec-revision": specRevision,
    target,
  };
}

function acceptedReviewBytes(request: {
  readonly specRevision: string;
  readonly reviewUnits: readonly {
    readonly unitId: string;
    readonly semanticDigest: string;
    readonly dependencyDigests: Readonly<Record<string, string>>;
  }[];
}): Uint8Array {
  return ENCODER.encode(
    `${JSON.stringify({
      schemaVersion: 1,
      reviews: request.reviewUnits.map((unit) => ({
        unitId: unit.unitId,
        reviewer: "adapter-safety-spec-reviewer",
        specRevision: request.specRevision,
        semanticDigest: unit.semanticDigest,
        dependencyDigests: unit.dependencyDigests,
        outcome: "accepted",
        resolvedDisagreementIds: [],
      })),
    })}\n`,
  );
}

async function createOracleAuthority(): Promise<{
  readonly root: string;
  readonly context: PublishedOracleContext;
  readonly inventoryBytes: Uint8Array;
}> {
  const root = await mkdtemp(join(tmpdir(), "blend65-adapter-authority-"));
  await cp(join(REPOSITORY_ROOT, "readiness"), join(root, "readiness"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "spec"), join(root, "spec"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "packages/readiness/src"), join(root, "packages/readiness/src"), {
    recursive: true,
  });
  await cp(
    join(REPOSITORY_ROOT, "packages/readiness/package.json"),
    join(root, "packages/readiness/package.json"),
  );
  await writeFile(
    join(root, "readiness/publications/current-publication.json"),
    ENCODER.encode(
      `${JSON.stringify({ schemaVersion: 1, publicationDigest: BASE_PUBLICATION_DIGEST })}\n`,
    ),
  );
  const base = await resolvePublishedSnapshotByDigest({
    repositoryRoot: root,
    publicationDigest: BASE_PUBLICATION_DIGEST,
  });
  if (!base.ok) throw new TypeError(`base publication failed: ${JSON.stringify(base.diagnostics)}`);
  const review = await prepareIncrementalBindingPublicationReview({
    repositoryRoot: root,
    baseSnapshot: base.value,
    targetHandlerIds: ORACLE_HANDLER_IDS,
  });
  if (!review.ok)
    throw new TypeError(`publication review failed: ${JSON.stringify(review.diagnostics)}`);
  const prepared = await prepareIncrementalBindingPublication({
    repositoryRoot: root,
    baseSnapshot: base.value,
    targetHandlerIds: ORACLE_HANDLER_IDS,
    semanticReviewBytes: acceptedReviewBytes(review.value.request),
  });
  if (!prepared.ok) {
    throw new TypeError(`publication preparation failed: ${JSON.stringify(prepared.diagnostics)}`);
  }
  const inventoryBytes = await readFile(
    join(
      root,
      "readiness/publications/releases",
      prepared.value.publicationDigest,
      "compiler-readiness-v1.json",
    ),
  );
  const context = createPublishedOracleContext(prepared.value.stagedSnapshot);
  if (!context.ok)
    throw new TypeError(`oracle context failed: ${JSON.stringify(context.diagnostics)}`);
  return { root, context: context.value, inventoryBytes };
}

const PREREQUISITES: Readonly<Record<ExecutionTierV1, readonly ExecutionTierV1[]>> = {
  frontend: [],
  "compiler-api": ["frontend"],
  cli: ["frontend"],
  emit: ["frontend", "compiler-api"],
  acme: ["frontend", "compiler-api", "emit"],
  vice: ["frontend", "compiler-api", "emit", "acme"],
};

/** Builds one genuine opaque execution case and a request for every terminal tier. */
export async function createGenuineRouteFixture(api: RouteApi): Promise<GenuineRouteFixture> {
  const [campaign, oracle] = await Promise.all([createFrontendCampaign(), createOracleAuthority()]);
  const plannedItem = getCampaignPlanItem(campaign, 0);
  if (!plannedItem.ok) throw new TypeError("campaign item lookup failed");
  const item = plannedItem.value;
  const executionCase = requireSuccess(
    createExecutionCaseV1(campaign, 0, { kind: "scalar-bytes", byteLength: 2 }),
  );
  const projection = requireSuccess(getExecutionCaseProjectionV1(executionCase));
  const tiers: readonly ExecutionTierV1[] = [
    "frontend",
    "compiler-api",
    "cli",
    "emit",
    "acme",
    "vice",
  ];
  const requests = Object.fromEntries(
    tiers.map((tier, index) => {
      const route: ExecutionRoutePlanItemV1 = {
        caseIdentity: projection.sourceCaseDigest,
        ruleId: item.request.choice.ruleId,
        obligation: tier,
        terminalTier: tier,
        prerequisiteTiers: PREREQUISITES[tier],
        rankDigest: `sha256:${index.toString(16).padStart(64, "0")}`,
      };
      return [
        tier,
        requireSuccess(
          api.createExecutionRouteRequestV1({
            route,
            executionCase,
            oracle: oracle.context,
            policy: SPEC_POLICY,
          }),
        ),
      ];
    }),
  ) as Readonly<Record<ExecutionTierV1, RouteRequest>>;
  return { requests, cleanup: () => rm(oracle.root, { recursive: true }) };
}

/** Builds genuine invalid diagnostic authority and its three legal route requests. */
export async function createGenuineDiagnosticFixture(
  routeApi: DiagnosticRouteApi,
  publishedApi: PublishedDiagnosticApi,
): Promise<GenuineDiagnosticFixture> {
  const oracle = await createOracleAuthority();
  const oracleRoot = oracle.root;
  try {
    const inventoryBytes = oracle.inventoryBytes;
    const [
      primary,
      ambientMismatchCases,
      constructionGateResults,
      modeledMismatchCases,
      sourceMismatchCase,
      runtime,
      repeatedSeed,
      differentSeed,
      differentConfiguration,
    ] = await Promise.all([
      createDiagnosticCampaign({ inventoryBytes }),
      createAmbientMismatchCases(inventoryBytes),
      createConstructionGateResults(inventoryBytes),
      createModeledMismatchCases(inventoryBytes),
      createDiagnosticCampaign({
        inventoryBytes,
        rendererName: "adapter-safety-source-mutant-renderer",
        rendererImplementation: sourceMutatingRenderer,
      }),
      createDiagnosticCampaign({
        inventoryBytes,
        ruleId: RUNTIME_RULE_ID,
        generatorHandlerId: "generator.runtime-cases",
        generatorName: "adapter-safety-runtime-generator",
        generatorImplementation: generateRuntimeCase,
      }),
      createDiagnosticCampaign({ inventoryBytes }),
      createDiagnosticCampaign({ inventoryBytes, seed: `sha256:${"8".repeat(64)}` }),
      createDiagnosticCampaign({ inventoryBytes, caseCount: 49 }),
    ]);
    const campaign = primary.campaign;
    const ordinals = findCampaignOrdinals(campaign);
    if (ordinals.invalidParameter === undefined) {
      throw new TypeError("campaign did not produce the external-binding stratum");
    }
    const diagnosticCase = requireOracleSuccess(
      publishedApi.createPublishedDiagnosticCaseV1(oracle.context, campaign, primary.ordinal),
    );
    const projection = requireOracleSuccess(
      publishedApi.getPublishedDiagnosticCaseProjectionV1(diagnosticCase),
    );
    const runtimeDiagnosticCase = requireOracleSuccess(
      publishedApi.createPublishedDiagnosticCaseV1(
        oracle.context,
        runtime.campaign,
        runtime.ordinal,
      ),
    );
    const runtimeProjection = requireOracleSuccess(
      publishedApi.getPublishedDiagnosticCaseProjectionV1(runtimeDiagnosticCase),
    );
    const repeatedSeedDiagnosticCase = requireOracleSuccess(
      publishedApi.createPublishedDiagnosticCaseV1(
        oracle.context,
        repeatedSeed.campaign,
        repeatedSeed.ordinal,
      ),
    );
    const repeatedSeedProjection = requireOracleSuccess(
      publishedApi.getPublishedDiagnosticCaseProjectionV1(repeatedSeedDiagnosticCase),
    );
    const differentSeedDiagnosticCase = requireOracleSuccess(
      publishedApi.createPublishedDiagnosticCaseV1(
        oracle.context,
        differentSeed.campaign,
        differentSeed.ordinal,
      ),
    );
    const differentSeedProjection = requireOracleSuccess(
      publishedApi.getPublishedDiagnosticCaseProjectionV1(differentSeedDiagnosticCase),
    );
    const differentConfigurationDiagnosticCase = requireOracleSuccess(
      publishedApi.createPublishedDiagnosticCaseV1(
        oracle.context,
        differentConfiguration.campaign,
        differentConfiguration.ordinal,
      ),
    );
    const differentConfigurationProjection = requireOracleSuccess(
      publishedApi.getPublishedDiagnosticCaseProjectionV1(differentConfigurationDiagnosticCase),
    );
    const tiers = ["frontend", "compiler-api", "cli"] as const;
    const requests = Object.fromEntries(
      tiers.map((tier, index) => {
        const route: ExecutionRoutePlanItemV1 & { readonly terminalTier: typeof tier } = {
          caseIdentity: projection.sourceCaseDigest,
          ruleId: projection.expectedDiagnostic.ruleId,
          obligation: tier,
          terminalTier: tier,
          prerequisiteTiers: PREREQUISITES[tier],
          rankDigest: `sha256:${(index + 16).toString(16).padStart(64, "0")}`,
        };
        const request = requireSuccess(
          routeApi.createExecutionRouteRequestV1({
            kind: "invalid-diagnostic",
            route,
            diagnosticCase,
            policy: SPEC_POLICY,
          }),
        );
        if (request.kind !== "invalid-diagnostic") {
          throw new TypeError("diagnostic route constructor returned the wrong request kind");
        }
        return [tier, request];
      }),
    ) as Readonly<Record<"frontend" | "compiler-api" | "cli", DiagnosticRouteRequest>>;
    return {
      context: oracle.context,
      campaign,
      diagnosticCase,
      projection,
      ordinals: {
        valid: ordinals.valid,
        invalidSource: primary.ordinal,
        invalidParameter: ordinals.invalidParameter,
      },
      ambientMismatchCases,
      constructionGateResults,
      modeledMismatchCases,
      sourceMismatchCase,
      runtimeCase: {
        campaign: runtime.campaign,
        ordinal: runtime.ordinal,
        diagnosticCase: runtimeDiagnosticCase,
        projection: runtimeProjection,
      },
      seedCases: {
        repeated: {
          campaign: repeatedSeed.campaign,
          ordinal: repeatedSeed.ordinal,
          diagnosticCase: repeatedSeedDiagnosticCase,
          projection: repeatedSeedProjection,
        },
        different: {
          campaign: differentSeed.campaign,
          ordinal: differentSeed.ordinal,
          diagnosticCase: differentSeedDiagnosticCase,
          projection: differentSeedProjection,
        },
        replayBytes: replayWireBytes(primary.replayEnvelope),
        hostileReplayBytes: replayWireBytes({
          ...primary.replayEnvelope,
          campaign: {
            ...primary.replayEnvelope.campaign,
            seed: `sha256:${"7".repeat(64)}`,
          },
        }),
      },
      configurationCase: {
        campaign: differentConfiguration.campaign,
        ordinal: differentConfiguration.ordinal,
        diagnosticCase: differentConfigurationDiagnosticCase,
        projection: differentConfigurationProjection,
        hostileReplayBytes: replayWireBytes({
          ...primary.replayEnvelope,
          configuration: {
            ...primary.replayEnvelope.configuration,
            caseCount: primary.replayEnvelope.configuration.caseCount + 1,
          },
        }),
      },
      requests,
      cleanup: () => rm(oracleRoot, { recursive: true }),
    };
  } catch (error) {
    await rm(oracleRoot, { recursive: true, force: true });
    throw error;
  }
}

/** Returns the only successful response shape for the request's tier contract. */
export function successfulWorkerResponse(request: WorkerRequest): WorkerResponse {
  const common = {
    revision: "execution-worker-response-v1" as const,
    tier: request.tier,
    contract: request.contract,
    caseIdentity: request.caseIdentity,
    diagnostics: { revision: "compiler-diagnostic-evidence-v1" as const, entries: [] },
    emission: { il: false, assembly: false, binary: false },
  };
  switch (request.tier) {
    case "frontend":
      return {
        ...common,
        tier: "frontend",
        contract: "frontend-pipeline-v1",
        semanticModelPresent: true,
        allocationPlanPresent: true,
      };
    case "compiler-api":
      return {
        ...common,
        tier: "compiler-api",
        contract: "compiler-evidence-facade-v1",
        hasErrors: false,
      };
    case "cli":
      return {
        ...common,
        tier: "cli",
        contract: "blendc-cli-v1",
        exitCode: 0,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
      };
    case "emit":
      return {
        ...common,
        tier: "emit",
        contract: "assembly-emitter-v1",
        hasErrors: false,
        assemblyBytes: ENCODER.encode("!cpu 6510\n"),
      };
  }
}

/** Creates a closed worker executor with observable parent-owned termination. */
export function scriptedWorker(
  mode: "success" | "crash" | "malformed" | "hang",
  probe: OwnershipProbe,
): ScriptedWorker {
  const requests: WorkerRequest[] = [];
  const terminations: string[] = [];
  return {
    requests,
    terminations,
    async start(request) {
      requests.push(structuredClone(request));
      probe.workers.add(request.caseIdentity);
      let completion: Promise<WorkerCompletion>;
      if (mode === "hang") {
        completion = new Promise(() => undefined);
      } else if (mode === "crash") {
        completion = Promise.resolve({ kind: "crash", exitCode: 1 });
      } else if (mode === "malformed") {
        completion = Promise.resolve({ kind: "message", value: { revision: "wrong" } });
      } else {
        completion = Promise.resolve({ kind: "message", value: successfulWorkerResponse(request) });
      }
      return success({
        completion,
        async terminate() {
          terminations.push(request.caseIdentity);
          probe.workers.delete(request.caseIdentity);
        },
      });
    },
  };
}

/** Creates observed invalid-source diagnostics without placing expectation fields on requests. */
export function scriptedDiagnosticWorker(
  projection: DiagnosticCaseProjection,
  probe: OwnershipProbe,
): ScriptedWorker {
  const requests: WorkerRequest[] = [];
  const terminations: string[] = [];
  return {
    requests,
    terminations,
    async start(request) {
      requests.push(structuredClone(request));
      probe.workers.add(request.caseIdentity);
      const response = {
        ...successfulWorkerResponse(request),
        ...(request.tier === "frontend"
          ? { semanticModelPresent: false, allocationPlanPresent: false }
          : {}),
        ...(request.tier === "compiler-api" ? { hasErrors: true } : {}),
        ...(request.tier === "cli" ? { exitCode: 1 as const } : {}),
        diagnostics: {
          revision: "compiler-diagnostic-evidence-v1" as const,
          entries: [
            {
              acceptedEntryId: "accepted-diagnostic-1",
              code: projection.expectedDiagnostic.code,
              phase: projection.expectedDiagnostic.phase,
              finalSeverity: projection.expectedDiagnostic.severity,
            },
          ],
        },
      };
      return success({
        completion: Promise.resolve({ kind: "message", value: response }),
        async terminate() {
          terminations.push(request.caseIdentity);
          probe.workers.delete(request.caseIdentity);
        },
      });
    },
  };
}

/** Creates a local ownership ledger used only to observe cleanup effects. */
export function createOwnershipProbe(): OwnershipProbe {
  return {
    workspaces: new Set(),
    workers: new Set(),
    children: new Set(),
    monitors: new Set(),
    checkpoints: new Set(),
  };
}

/** Creates an argv-only process runtime with deterministic stream delivery. */
export function scriptedProcess(script: ProcessScript, probe: OwnershipProbe): ScriptedProcess {
  const requests: ProcessRequest[] = [];
  const terminations: NodeJS.Signals[] = [];
  return {
    requests,
    terminations,
    async start(request, sink) {
      requests.push(structuredClone(request));
      const identity: ProcessIdentity = {
        bootId: "spec-boot",
        pid: 6502,
        startTicks: 1n,
        processGroupId: 6502,
      };
      probe.children.add(identity.pid);
      probe.monitors.add("monitor");
      probe.checkpoints.add("checkpoint");
      for (const chunk of script.chunks) {
        (chunk.stream === "stdout" ? sink.onStdout : sink.onStderr)(chunk.bytes);
      }
      const completion = script.completes
        ? Promise.resolve({ exitCode: 0, signal: null })
        : new Promise<{ readonly exitCode: number | null; readonly signal: null }>(() => undefined);
      return success({
        identity,
        completion,
        async revalidateIdentity() {
          return true;
        },
        async terminate(signal) {
          terminations.push(signal);
          probe.children.delete(identity.pid);
          probe.monitors.clear();
          probe.checkpoints.clear();
        },
      });
    },
  };
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

class ScriptedQueue<T> {
  private readonly values: T[] = [];
  private readonly readers: ((value: T) => void)[] = [];

  push(value: T): void {
    const reader = this.readers.shift();
    if (reader === undefined) this.values.push(value);
    else reader(value);
  }

  async shift(signal?: AbortSignal, aborted?: () => T): Promise<T> {
    const value = this.values.shift();
    if (value !== undefined) return value;
    return new Promise<T>((resolve) => {
      const reader = (next: T) => {
        signal?.removeEventListener("abort", onAbort);
        resolve(next);
      };
      const onAbort = () => {
        const index = this.readers.indexOf(reader);
        if (index >= 0) this.readers.splice(index, 1);
        if (aborted !== undefined) resolve(aborted());
      };
      this.readers.push(reader);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}

function mutatedReads(
  mutation: RawFrameMutation | undefined,
  bytes: Uint8Array,
  ordinal: number,
): readonly ControlRead[] {
  if (mutation === undefined) return [{ kind: "frame", bytes }];
  const result = mutation(bytes, ordinal);
  return Array.isArray(result) ? result : [result as ControlRead];
}

/**
 * Couples the real parent and anchor kernels across raw byte queues while exposing only host facts.
 */
export function createProcessKernelHarness(
  api: ProcessKernelApi,
  options: ProcessKernelHarnessOptions = {},
): ProcessKernelHarness {
  const anchorIdentity: HostProcessIdentity = {
    bootId: "spec-kernel-boot",
    pid: 6_502,
    startTicks: 101n,
    processGroupId: 6_502,
    sessionId: 6_502,
  };
  const targetIdentity: HostProcessIdentity = {
    bootId: anchorIdentity.bootId,
    pid: 6_503,
    startTicks: 102n,
    processGroupId: anchorIdentity.processGroupId,
    sessionId: anchorIdentity.sessionId,
  };
  const parentIncoming = new ScriptedQueue<ControlRead>();
  const anchorIncoming = new ScriptedQueue<ControlRead>();
  const memberships = new ScriptedQueue<GroupMembership>();
  const targetCompletion = deferred<HostProcessExit>();
  const anchorCompletion = deferred<HostProcessExit>();
  const anchorSpawns: AnchorSpawnInput[] = [];
  const targetSpawns: TargetSpawnInput[] = [];
  const parentFrames: Uint8Array[] = [];
  const anchorFrames: Uint8Array[] = [];
  const signals: SelfGroupSignal[] = [];
  const parentMembershipQueries: GroupMembershipQuery[] = [];
  const anchorMembershipQueries: GroupMembershipQuery[] = [];
  const events: (
    | { readonly kind: "parent-frame"; readonly bytes: Uint8Array }
    | { readonly kind: "anchor-frame"; readonly bytes: Uint8Array }
    | { readonly kind: "self-group-signal"; readonly signal: SelfGroupSignal }
  )[] = [];
  const sentinel = { alive: true };
  let parentFrameOrdinal = 0;
  let anchorFrameOrdinal = 0;
  let anchorSettled = false;

  const parentControl: ProcessControlTransport = {
    async sendFrame(bytes) {
      const owned = Uint8Array.from(bytes);
      parentFrames.push(owned);
      events.push({ kind: "parent-frame", bytes: owned });
      for (const read of mutatedReads(options.mutateParentFrame, owned, parentFrameOrdinal)) {
        anchorIncoming.push(read);
      }
      parentFrameOrdinal += 1;
      return success(undefined);
    },
    async receiveFrame(cancellation) {
      if (cancellation.signal.aborted) {
        return { kind: "crash", code: "io", message: "cancelled" };
      }
      return parentIncoming.shift(cancellation.signal, () => ({
        kind: "crash",
        code: "io",
        message: "cancelled",
      }));
    },
    async close() {
      anchorIncoming.push({ kind: "eof" });
      return success(undefined);
    },
  };

  let parentSink: ProcessSink | undefined;
  const anchorControl: ProcessAnchorTransport = {
    async sendFrame(bytes) {
      const owned = Uint8Array.from(bytes);
      anchorFrames.push(owned);
      events.push({ kind: "anchor-frame", bytes: owned });
      for (const read of mutatedReads(options.mutateAnchorFrame, owned, anchorFrameOrdinal)) {
        parentIncoming.push(read);
      }
      anchorFrameOrdinal += 1;
      return success(undefined);
    },
    async receiveFrame(cancellation) {
      if (cancellation.signal.aborted) {
        return { kind: "crash", code: "io", message: "cancelled" };
      }
      return anchorIncoming.shift(cancellation.signal, () => ({
        kind: "crash",
        code: "io",
        message: "cancelled",
      }));
    },
    async close() {
      parentIncoming.push({ kind: "eof" });
      return success(undefined);
    },
    onStdout(bytes) {
      parentSink?.onStdout(Uint8Array.from(bytes));
    },
    onStderr(bytes) {
      parentSink?.onStderr(Uint8Array.from(bytes));
    },
  };

  const anchorHost: ProcessAnchorHost = {
    async observeSelf() {
      return success(anchorIdentity);
    },
    async spawnTarget(input, sink) {
      targetSpawns.push(structuredClone(input));
      for (const chunk of options.targetStreams ?? []) {
        (chunk.stream === "stdout" ? sink.onStdout : sink.onStderr)(chunk.bytes);
      }
      return success({ identity: targetIdentity, completion: targetCompletion.promise });
    },
    async signalSelfProcessGroup(input) {
      const owned = structuredClone(input);
      signals.push(owned);
      events.push({ kind: "self-group-signal", signal: owned });
      return success(undefined);
    },
    async observeGroup(query) {
      anchorMembershipQueries.push(structuredClone(query));
      return memberships.shift();
    },
  };

  const parentHost: ProcessParentHost = {
    randomBytes(byteLength) {
      if (byteLength !== 32) throw new TypeError("nonce request must be exactly 32 bytes");
      return new Uint8Array(32).fill(0xab);
    },
    async spawnAnchor(input, sink, cancellation) {
      anchorSpawns.push(structuredClone(input));
      parentSink = sink;
      void api
        .runExecutionProcessAnchorV1(anchorHost, anchorControl, cancellation)
        .then((result) => {
          if (anchorSettled) return;
          anchorSettled = true;
          anchorCompletion.resolve(
            result.ok
              ? { kind: "exit", exitCode: 0 }
              : { kind: "crash", code: "io", message: "anchor kernel rejected input" },
          );
        });
      return success({
        identity: anchorIdentity,
        control: parentControl,
        completion: anchorCompletion.promise,
      });
    },
    async observeGroup(query) {
      parentMembershipQueries.push(structuredClone(query));
      return memberships.shift();
    },
  };

  return {
    parentHost,
    anchorIdentity,
    targetIdentity,
    anchorSpawns,
    targetSpawns,
    parentFrames,
    anchorFrames,
    signals,
    parentMembershipQueries,
    anchorMembershipQueries,
    events,
    sentinel,
    completeTarget(exit) {
      targetCompletion.resolve(exit);
    },
    enqueueMembership(value) {
      memberships.push(value);
    },
    failParentControl(value) {
      parentIncoming.push(value);
    },
    crashAnchor(
      exit = { kind: "crash", code: "io", message: "anchor crashed" },
      controlFailure = { kind: "crash", code: "io", message: "anchor control lost" },
    ) {
      if (!anchorSettled) {
        anchorSettled = true;
        anchorCompletion.resolve(exit);
      }
      parentIncoming.push(controlFailure);
      anchorIncoming.push({ kind: "crash", code: "io", message: "parent control lost" });
    },
  };
}

/** Returns whether every resource class observed by the fixture is empty. */
export function ownsNothing(probe: OwnershipProbe): boolean {
  return (
    probe.workspaces.size === 0 &&
    probe.workers.size === 0 &&
    probe.children.size === 0 &&
    probe.monitors.size === 0 &&
    probe.checkpoints.size === 0
  );
}
