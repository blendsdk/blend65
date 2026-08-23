import { createHash } from "node:crypto";

import { parseLabelFile, parseReportFile, type ReportInstruction } from "@blend65/compiler";
import {
  getExecutionCaseProjectionV1,
  getPublishedRuntimeEvaluationProjectionV1,
  parseExecutionPolicyV1,
  type ExecutionCaseV1,
  type ExecutionCleanupBlockerV1,
  type ExecutionEmittedStoreV1,
  type ExecutionIssueV1,
  type ExecutionOperationResultV1,
  type ExecutionPolicyV1,
  type PublishedRuntimeEvaluationAuthorityV1,
} from "@blend65/readiness";

import { executeAcmeArtifactPipelineV1 } from "./execution-acme-artifacts.js";
import {
  deriveExecutionFixtureDigestV1,
  renderExecutionEnvelopeV1,
  validateRenderedExecutionSourceV1,
} from "./execution-envelope.js";
import {
  deriveFinalExecutionIdentityV1,
  derivePrebuildExecutionIdentityV1,
} from "./execution-identity.js";
import { resolveExecutionCaseObservationLayoutV1 } from "./execution-observation-layout.js";
import {
  createExecutionSupervisorV1,
  type ExecutionCleanupOutcomeV1,
} from "./execution-supervisor.js";
import {
  sealBoundViceRouteV1,
  type SealedViceBuildBaselineV1,
} from "./execution-vice-evaluation.js";
import {
  FIXED_EVALUATED_VICE_HANDLER_IDENTITIES_V1,
  FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1,
} from "./execution-vice-handler-identity.js";
import type {
  PreparedEvaluatedViceRouteV1,
  PreparedViceBuildEvidenceV1,
  ViceRouteRequestV1,
} from "./execution-vice-types.js";
import { defaultExecutionWorkerExecutorV1 } from "./execution-worker-executor.js";
import type {
  ExecutionCancellationV1,
  ExecutionWorkerRequestV1,
} from "./execution-worker-protocol.js";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
const STORE_OPCODES = new Set(["STA", "STX", "STY"]);

function sha256Bytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256Json(value: unknown): string {
  return sha256Bytes(ENCODER.encode(JSON.stringify(value)));
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

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function cleanupBlocker(
  cleanup: ExecutionOperationResultV1<ExecutionCleanupOutcomeV1>,
): ExecutionCleanupBlockerV1 | undefined {
  if (cleanup.ok && cleanup.value.ok) return undefined;
  if (cleanup.ok && cleanup.value.blocker !== undefined) return cleanup.value.blocker;
  return Object.freeze({
    code: "emulator-lease-recovery-blocked",
    evidenceDigest: sha256Json({
      domain: "blend65-production-build-cleanup-failure-v1",
      issues: cleanup.ok ? [] : cleanup.issues,
    }),
  });
}

/**
 * Appends a bounded cleanup blocker without replacing an earlier preparation issue.
 *
 * @example
 * ```ts
 * const merged = mergeVicePreparationCleanupV1(prepared, cleanup);
 * ```
 */
export function mergeVicePreparationCleanupV1<T>(
  operation: ExecutionOperationResultV1<T>,
  cleanup: ExecutionOperationResultV1<ExecutionCleanupOutcomeV1>,
): ExecutionOperationResultV1<T> {
  const blocker = cleanupBlocker(cleanup);
  if (blocker === undefined) return operation;
  const issue: ExecutionIssueV1 = Object.freeze({
    code: blocker.code,
    path: "/cleanup",
    message: `Cleanup blocker evidence: ${blocker.evidenceDigest}`,
  });
  if (operation.ok) {
    const cleanupIssues: readonly [ExecutionIssueV1] = Object.freeze([issue]);
    return Object.freeze({ ok: false, issues: cleanupIssues });
  }
  const issues: readonly [ExecutionIssueV1, ...ExecutionIssueV1[]] = Object.freeze([
    operation.issues[0],
    ...operation.issues.slice(1),
    issue,
  ]);
  return Object.freeze({ ok: false, issues });
}

/**
 * Selects one unambiguous generated symbol by exact suffix within trusted label evidence.
 *
 * @example
 * ```ts
 * const result = selectUniqueViceBuildSymbolV1(labels, "___execution_completion");
 * ```
 */
export function selectUniqueViceBuildSymbolV1(
  symbols: ReadonlyMap<string, number>,
  suffix: string,
): string | undefined {
  const matches = [...symbols.keys()].filter((name) => name.endsWith(suffix));
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Selects the entry-through-return instruction window from trusted assembler report evidence.
 *
 * @example
 * ```ts
 * const window = selectViceEntryInstructionWindowV1(report, entryAddress);
 * ```
 */
export function selectViceEntryInstructionWindowV1(
  instructions: readonly ReportInstruction[],
  entryAddress: number,
): readonly ReportInstruction[] | undefined {
  const start = instructions.findIndex(({ address }) => address === entryAddress);
  if (start < 0) return undefined;
  const end = instructions.slice(start).findIndex(({ opcode }) => opcode === "RTS");
  return end < 0 ? undefined : instructions.slice(start, start + end + 1);
}

/** Exact visible-store timing proof derived from one bounded entry instruction window. */
export interface DerivedViceObservationStoresV1 {
  readonly stores: readonly ExecutionEmittedStoreV1[];
  readonly completionValueLoadInstructionAddress: number;
  readonly finalPostCallStoreInstructionAddress: number;
}

/**
 * Derives exact observation and completion stores while excluding semantic-address writes.
 *
 * @example
 * ```ts
 * const proof = deriveViceObservationStoresV1(report, ["result"], "complete", labels, []);
 * ```
 */
export function deriveViceObservationStoresV1(
  instructions: readonly ReportInstruction[],
  observationSymbols: readonly string[],
  completionSymbol: string,
  labels: ReadonlyMap<string, number>,
  semanticAddresses: readonly number[],
): DerivedViceObservationStoresV1 | undefined {
  const targets = [
    ...observationSymbols.map((symbol) => labels.get(symbol)),
    labels.get(completionSymbol),
  ];
  if (targets.some((target) => target === undefined)) return undefined;
  const stores: ExecutionEmittedStoreV1[] = [];
  for (let index = 0; index < targets.length; index += 1) {
    const targetAddress = targets[index];
    if (targetAddress === undefined) return undefined;
    const matches = instructions.filter(
      ({ opcode, operand }) => STORE_OPCODES.has(opcode) && operand === targetAddress,
    );
    if (matches.length !== 1 || matches[0] === undefined) return undefined;
    stores.push(
      index < observationSymbols.length
        ? Object.freeze({
            instructionAddress: matches[0].address,
            targetAddress,
            kind: "observation-byte" as const,
            byteIndex: index as 0 | 1,
          })
        : Object.freeze({
            instructionAddress: matches[0].address,
            targetAddress,
            kind: "completion" as const,
            value: 165 as const,
          }),
    );
  }
  const completion = stores.at(-1);
  if (completion?.kind !== "completion") return undefined;
  const completionIndex = instructions.findIndex(
    ({ address }) => address === completion.instructionAddress,
  );
  const preceding = instructions[completionIndex - 1];
  const callIndex = instructions.findLastIndex(({ opcode }) => opcode === "JSR");
  if (
    callIndex < 0 ||
    preceding?.opcode !== "LDA" ||
    preceding.mode !== "Immediate" ||
    preceding.operand !== 0xa5 ||
    stores.some(
      (store, index) =>
        index > 0 && store.instructionAddress <= stores[index - 1]!.instructionAddress,
    )
  ) {
    return undefined;
  }
  const postCallStores = instructions
    .slice(callIndex + 1)
    .filter(({ opcode }) => STORE_OPCODES.has(opcode));
  const visibleTargets = new Set(targets as number[]);
  const visibleStores = postCallStores.filter(
    ({ operand }) => operand !== null && visibleTargets.has(operand),
  );
  const forbiddenTargets = new Set(semanticAddresses);
  if (
    visibleStores.length !== stores.length ||
    !visibleStores.every(({ address }, index) => address === stores[index]?.instructionAddress) ||
    postCallStores.some(({ operand }) => operand !== null && forbiddenTargets.has(operand)) ||
    postCallStores.at(-1)?.address !== completion.instructionAddress
  ) {
    return undefined;
  }
  return Object.freeze({
    stores: Object.freeze(stores),
    completionValueLoadInstructionAddress: preceding.address,
    finalPostCallStoreInstructionAddress: completion.instructionAddress,
  });
}

function emitterRequest(
  caseIdentity: string,
  caseRoot: string,
  sourceBytes: Uint8Array,
): ExecutionWorkerRequestV1 {
  return Object.freeze({
    revision: "execution-worker-request-v1",
    tier: "emit",
    contract: "assembly-emitter-v1",
    caseKind: "valid-envelope",
    caseIdentity,
    caseRoot,
    source: Object.freeze({
      revision: "execution-worker-source-v1",
      relativePath: "main.blend",
      bytes: sourceBytes,
      digest: sha256Bytes(sourceBytes),
    }),
  });
}

interface PreparedViceBuildCandidateV1 {
  readonly sourceCaseDigest: string;
  readonly routeIdentity: string;
  readonly route: ViceRouteRequestV1;
  readonly evidence: Omit<PreparedViceBuildEvidenceV1, "buildEvidenceDigest">;
}

async function prepareWithinSupervisor(
  executionCase: ExecutionCaseV1,
  evaluation: PublishedRuntimeEvaluationAuthorityV1,
  policy: ExecutionPolicyV1,
  signal: AbortSignal,
): Promise<ExecutionOperationResultV1<PreparedEvaluatedViceRouteV1>> {
  const execution = getExecutionCaseProjectionV1(executionCase);
  const projectedEvaluation = getPublishedRuntimeEvaluationProjectionV1(evaluation);
  const rendered = renderExecutionEnvelopeV1(executionCase);
  if (!execution.ok || !projectedEvaluation.ok || !rendered.ok || signal.aborted) {
    return failure("/authority", "Genuine execution and evaluation authority is required.");
  }
  const sourceBytes = ENCODER.encode(rendered.value);
  const validatedSource = validateRenderedExecutionSourceV1(executionCase, sourceBytes);
  const parsedPolicy = parseExecutionPolicyV1(policy);
  if (!validatedSource.ok || !parsedPolicy.ok) {
    return failure("/policy", "Execution source or policy is invalid.");
  }
  const supervisorResult = createExecutionSupervisorV1(parsedPolicy.value, {
    workerExecutor: defaultExecutionWorkerExecutorV1,
  });
  if (!supervisorResult.ok) return supervisorResult;
  const supervisor = supervisorResult.value;
  const startedAtMonotonicMs =
    supervisor.deadline.hardDeadlineMs - parsedPolicy.value.budget.routeMs;
  const cancellation: ExecutionCancellationV1 = Object.freeze({
    signal,
    deadlineMonotonicMs: supervisor.deadline.hardDeadlineMs,
  });
  const prepared = await (async (): Promise<
    ExecutionOperationResultV1<PreparedViceBuildCandidateV1>
  > => {
    const built = await executeAcmeArtifactPipelineV1(
      supervisor,
      (caseRoot) => emitterRequest(execution.value.sourceCaseDigest, caseRoot, sourceBytes),
      cancellation,
      { evidenceProfile: "sealed-vice-v1" },
    );
    if (!built.ok) {
      return failure(built.issues[0].path, built.issues[0].message);
    }
    const emitted = built.value.emitted;
    if (emitted.layoutBasis === undefined) {
      return failure("/emit", "The real emitter did not return complete trusted build facts.");
    }
    const prg = built.value.binary;
    const labelBytes = built.value.labels;
    const reportBytes = built.value.report;
    if (prg.byteLength < 3) return failure("/artifacts", "ACME artifacts are incomplete.");
    let labelsText: string;
    let reportText: string;
    try {
      labelsText = DECODER.decode(labelBytes);
      reportText = DECODER.decode(reportBytes);
    } catch {
      return failure("/artifacts", "ACME text artifacts are not canonical UTF-8.");
    }
    let labels: ReadonlyMap<string, number>;
    let report: readonly ReportInstruction[];
    try {
      labels = parseLabelFile(labelsText);
      report = parseReportFile(reportText, "main.report");
    } catch {
      return failure("/artifacts", "ACME label or report evidence is malformed.");
    }
    const loadAddress = prg[0]! | (prg[1]! << 8);
    const binary = prg.slice(2);
    const entryAddress = labels.get("_main");
    if (
      entryAddress === undefined ||
      entryAddress < loadAddress ||
      entryAddress >= loadAddress + binary.byteLength
    ) {
      return failure("/artifacts/main.lbl", "The emitted entry is outside the exact binary range.");
    }
    const window = selectViceEntryInstructionWindowV1(report, entryAddress);
    if (
      window === undefined ||
      window.some(
        ({ address }) => address < loadAddress || address >= loadAddress + binary.byteLength,
      )
    ) {
      return failure(
        "/artifacts/main.report",
        "The entry report window is incomplete or outside the binary.",
      );
    }
    const observationSymbols =
      execution.value.observation.kind === "scalar-bytes"
        ? [
            selectUniqueViceBuildSymbolV1(labels, "___execution_result_low"),
            ...(execution.value.observation.byteLength === 2
              ? [selectUniqueViceBuildSymbolV1(labels, "___execution_result_high")]
              : []),
          ]
        : [];
    const completionSymbol = selectUniqueViceBuildSymbolV1(labels, "___execution_completion");
    if (
      observationSymbols.some((symbol) => symbol === undefined) ||
      completionSymbol === undefined
    ) {
      return failure(
        "/artifacts/main.lbl",
        "Required observation labels are missing or ambiguous.",
      );
    }
    const stores = deriveViceObservationStoresV1(
      window,
      observationSymbols as readonly string[],
      completionSymbol,
      labels,
      execution.value.fixture.cells.map(({ address }) => address),
    );
    if (stores === undefined)
      return failure(
        "/artifacts/main.report",
        "Observation stores are not exact or completion-last.",
      );
    const layout = resolveExecutionCaseObservationLayoutV1(executionCase, {
      labels,
      codeRanges: [{ start: loadAddress, length: binary.byteLength }],
      dataRanges: emitted.layoutBasis.dataRanges,
      semanticRanges: execution.value.fixture.cells.map(({ address }) => ({
        start: address,
        length: 1,
      })),
      stackRanges: [{ start: 0x0100, length: 0x0100 }],
      observationSymbols,
      completionSymbol,
      postEntryStores: stores.stores,
    });
    if (!layout.ok) return layout;
    const route: ViceRouteRequestV1 = Object.freeze({
      binary,
      loadAddress,
      entryAddress,
      fixture: execution.value.fixture,
      layout: layout.value,
      observation: execution.value.observation,
      policy: parsedPolicy.value,
    });
    const fixtureDigest = deriveExecutionFixtureDigestV1(route.fixture);
    if (!fixtureDigest.ok) return fixtureDigest;
    const prebuildIdentity = derivePrebuildExecutionIdentityV1({
      sourceCaseDigest: execution.value.sourceCaseDigest,
      renderedSourceDigest: validatedSource.value.sourceDigest,
      argumentsDigest: sha256Json(execution.value.envelope.arguments),
      envelopeRevision: execution.value.envelope.revision,
      selectorRevision: "execution-selector-v1",
      fixtureRevision: route.fixture.revision,
      fixtureDigest: fixtureDigest.value,
      ...(route.observation.projectionRevision === "c64-vic-color-observation-v1"
        ? { observationProjectionRevision: route.observation.projectionRevision }
        : {}),
      target: "c64",
      policyDigest: sha256Json(route.policy),
      handlers: FIXED_EVALUATED_VICE_HANDLER_IDENTITIES_V1,
      observation: route.observation,
    });
    const finalExecutionIdentity = deriveFinalExecutionIdentityV1(prebuildIdentity, route.layout);
    const binaryDigest = sha256Bytes(route.binary);
    const routeIdentity = sha256Json({
      domain: "blend65-sealed-evaluated-vice-route-v1",
      sourceCaseDigest: execution.value.sourceCaseDigest,
      sourceContentDigest: sha256Bytes(execution.value.sourceBytes),
      renderedSourceDigest: validatedSource.value.sourceDigest,
      selectedReleaseDigest: projectedEvaluation.value.selectedReleaseDigest,
      evaluationIdentity: projectedEvaluation.value.evaluationIdentity,
      binaryDigest,
      loadAddress,
      entryAddress,
      prebuildIdentity,
      finalExecutionIdentity,
    });
    const evidence: Omit<PreparedViceBuildEvidenceV1, "buildEvidenceDigest"> = Object.freeze({
      sourceCaseDigest: execution.value.sourceCaseDigest,
      binaryDigest,
      loadAddress,
      entryAddress,
      layoutDigest: layout.value.proofDigest,
      prebuildIdentity,
      finalExecutionIdentity,
      routeIdentity,
      postEntryStores: layout.value.postEntryStores,
      completionValueLoadInstructionAddress: stores.completionValueLoadInstructionAddress,
      finalPostCallStoreInstructionAddress: stores.finalPostCallStoreInstructionAddress,
    });
    return success(
      Object.freeze({
        sourceCaseDigest: execution.value.sourceCaseDigest,
        routeIdentity,
        route,
        evidence,
      }),
    );
  })().catch(() =>
    failure<PreparedViceBuildCandidateV1>(
      "/prepare",
      "Production evaluated-route preparation failed closed.",
    ),
  );
  const cleanup = await supervisor
    .cleanup()
    .catch(() =>
      failure<ExecutionCleanupOutcomeV1>("/cleanup", "Production build cleanup failed."),
    );
  const cleaned = mergeVicePreparationCleanupV1(prepared, cleanup);
  if (!cleaned.ok) return cleaned;
  const snapshot = supervisor.snapshot();
  if (!snapshot.ok) return snapshot;
  const baseline: SealedViceBuildBaselineV1 = Object.freeze({
    startedAtMonotonicMs,
    workDeadlineMonotonicMs: supervisor.deadline.workDeadlineMs,
    hardDeadlineMonotonicMs: supervisor.deadline.hardDeadlineMs,
    usage: snapshot.value.usage,
    evidence: snapshot.value.evidence,
  });
  const sealed = sealBoundViceRouteV1({
    sourceCaseDigest: cleaned.value.sourceCaseDigest,
    routeIdentity: cleaned.value.routeIdentity,
    handlerIdentityDigest: FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1,
    route: cleaned.value.route,
    evaluation,
    baseline,
  });
  const evidence: PreparedViceBuildEvidenceV1 = Object.freeze({
    ...cleaned.value.evidence,
    buildEvidenceDigest: snapshot.value.evidence.digest,
  });
  return sealed.ok ? success(Object.freeze({ request: sealed.value, evidence })) : sealed;
}

/**
 * Builds and seals one evaluated VICE route through the fixed production toolchain.
 *
 * No raw binary, layout, worker, assembler, workspace, handler list, or host is accepted.
 *
 * @example
 * ```ts
 * const prepared = await prepareEvaluatedViceRouteV1(caseAuthority, evaluation, policy, signal);
 * if (!prepared.ok) throw new TypeError("The evaluated route could not be prepared.");
 * ```
 */
export async function prepareEvaluatedViceRouteV1(
  executionCase: ExecutionCaseV1,
  evaluation: PublishedRuntimeEvaluationAuthorityV1,
  policy: ExecutionPolicyV1,
  signal: AbortSignal,
): Promise<ExecutionOperationResultV1<PreparedEvaluatedViceRouteV1>> {
  try {
    return await prepareWithinSupervisor(executionCase, evaluation, policy, signal);
  } catch {
    return failure("/prepare", "Production evaluated-route preparation failed closed.");
  }
}
