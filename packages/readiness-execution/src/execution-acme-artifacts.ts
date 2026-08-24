import { createHash } from "node:crypto";

import {
  discoverAcme,
  invokeBoundedAcmeV1,
  type AcmeInvocation,
  type AcmeProcessControlsV1,
  type AcmeRunOutput,
  type BoundedAcmeRunnerV1,
} from "@blend65/compiler";
import { createDiagnosticBag } from "@blend65/core";
import type { ExecutionOperationIssueCodeV1, ExecutionOperationResultV1 } from "@blend65/readiness";

import type { ExecutionProcessOutcomeV1 } from "./execution-process.js";
import type { ExecutionSupervisorV1 } from "./execution-supervisor.js";
import type {
  ExecutionCancellationV1,
  ExecutionWorkerRequestV1,
  ExecutionWorkerResponseV1,
} from "./execution-worker-protocol.js";

/** Exact non-authorizing artifacts returned by one supervised emit-and-assemble pipeline. */
export interface ExecutionAcmeArtifactsV1 {
  readonly emitted: Extract<ExecutionWorkerResponseV1, { readonly tier: "emit" }>;
  readonly binary: Uint8Array;
  readonly labels: Uint8Array;
  readonly report: Uint8Array;
}

/** Dependencies accepted only by the generic adapter compatibility seam. */
export interface ExecutionAcmeArtifactDependenciesV1 {
  readonly runner?: BoundedAcmeRunnerV1;
  readonly executable?: string;
  /** Selects stable descriptor validation only for sealed production evidence. */
  readonly evidenceProfile?: "adapter-raw-v1" | "sealed-vice-v1";
}

/** Constructs the emit request after the helper has created its private workspace. */
export type ExecutionAcmeEmitterRequestFactoryV1 = (
  caseRoot: string,
) => ExecutionWorkerRequestV1 | undefined;

const ENCODER = new TextEncoder();
const FATAL_DECODER = new TextDecoder("utf-8", { fatal: true });
const PROC_DESCRIPTOR_PATH = /^\/proc\/[1-9][0-9]*\/fd\/[1-9][0-9]*$/u;
const REPORT_SOURCE_HEADER = /^; \*{8} Source: ([^\r\n]+)(?=\r?$)/gmu;
const CANONICAL_REPORT_SOURCE_HEADER = "; ******** Source: <retained-assembly-proc-descriptor>";

/**
 * Removes one validated volatile proc descriptor from sealed report evidence.
 *
 * @example
 * ```ts
 * const stable = canonicalizeSealedAcmeReportEvidenceV1(report, retainedPath);
 * ```
 */
export function canonicalizeSealedAcmeReportEvidenceV1(
  report: Uint8Array,
  retainedAssemblyPath: string,
): Uint8Array | undefined {
  if (!PROC_DESCRIPTOR_PATH.test(retainedAssemblyPath)) return undefined;
  let text: string;
  try {
    text = FATAL_DECODER.decode(report);
  } catch {
    return undefined;
  }
  const matches = [...text.matchAll(REPORT_SOURCE_HEADER)];
  if (matches.length !== 1 || matches[0]?.[1] !== retainedAssemblyPath) return undefined;
  const canonical = text.replace(REPORT_SOURCE_HEADER, CANONICAL_REPORT_SOURCE_HEADER);
  return ENCODER.encode(canonical);
}

function failure<T>(
  code: ExecutionOperationIssueCodeV1,
  path: "/emit" | "/acme",
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, path, message })]) as readonly [
      { readonly code: typeof code; readonly path: typeof path; readonly message: string },
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function validEmit(
  response: ExecutionWorkerResponseV1,
): response is Extract<ExecutionWorkerResponseV1, { readonly tier: "emit" }> {
  return (
    response.tier === "emit" &&
    !response.hasErrors &&
    response.assemblyBytes.byteLength > 0 &&
    !response.emission.il &&
    !response.emission.assembly &&
    !response.emission.binary &&
    !response.diagnostics.entries.some(({ finalSeverity }) => finalSeverity === "error")
  );
}

function boundedStderr(outcome: ExecutionProcessOutcomeV1): string {
  return new TextDecoder().decode(outcome.diagnosticStreams.stderr.head);
}

/**
 * Creates the production ACME runner over the supervisor's owned argv-only process boundary.
 *
 * @example
 * ```ts
 * const runner = createSupervisedAcmeRunnerV1(supervisor);
 * ```
 */
export function createSupervisedAcmeRunnerV1(
  supervisor: ExecutionSupervisorV1,
): BoundedAcmeRunnerV1 {
  return Object.freeze({
    async run(request: AcmeInvocation, controls: AcmeProcessControlsV1): Promise<AcmeRunOutput> {
      const outcome = await supervisor.runProcess(
        {
          executable: request.acmeExe,
          argv: [
            "--vicelabels",
            request.labelPath,
            "--report",
            request.reportPath,
            request.asmPath,
          ],
          cwd: request.cwd,
          deadline: {
            hardDeadlineMs: supervisor.deadline.hardDeadlineMs,
            workDeadlineMs: Math.min(
              supervisor.deadline.workDeadlineMs,
              controls.deadlineMonotonicMs,
            ),
            cleanupGraceMs: supervisor.deadline.cleanupGraceMs,
          },
        },
        controls,
        { onStdout: controls.onStdout, onStderr: controls.onStderr },
      );
      if (!outcome.ok) {
        const issue = outcome.issues[0];
        throw Object.assign(new Error(issue.message), { code: issue.code });
      }
      if (outcome.value.authority.kind === "terminated-output-exhaustion") {
        throw Object.assign(new Error("Assembler output limit was exceeded."), {
          code: "output-exhaustion",
        });
      }
      return { exitCode: outcome.value.exitCode ?? 1, stderr: boundedStderr(outcome.value) };
    },
  });
}

/**
 * Executes the single shared non-authorizing emit-to-ACME artifact pipeline.
 *
 * The helper owns the case workspace, retained assembly inode, process output/evidence charges,
 * descriptor-backed artifact reads, and workspace disposal. Returned bytes are evidence only.
 *
 * @example
 * ```ts
 * const result = await executeAcmeArtifactPipelineV1(
 *   supervisor,
 *   (caseRoot) => createEmitRequest(caseRoot),
 *   cancellation,
 * );
 * ```
 */
export async function executeAcmeArtifactPipelineV1(
  supervisor: ExecutionSupervisorV1,
  createEmitterRequest: ExecutionAcmeEmitterRequestFactoryV1,
  cancellation: ExecutionCancellationV1,
  dependencies: ExecutionAcmeArtifactDependenciesV1 = {},
): Promise<ExecutionOperationResultV1<ExecutionAcmeArtifactsV1>> {
  const workspace = await supervisor.createWorkspace(cancellation);
  if (!workspace.ok) return failure("assembler-failure", "/acme", "Workspace creation failed.");
  try {
    const injectedRunner = dependencies.runner;
    const acmeExe =
      injectedRunner === undefined
        ? (dependencies.executable ?? discoverAcme({}, createDiagnosticBag()))
        : "acme";
    if (acmeExe === null) return failure("tier-unavailable", "/acme", "ACME is unavailable.");
    const emitterRequest = createEmitterRequest(workspace.value.root);
    if (emitterRequest === undefined) {
      return failure("emission-failure", "/emit", "Emitter request creation failed.");
    }
    const emitted = await supervisor.runWorker(emitterRequest, cancellation);
    if (!emitted.ok || !validEmit(emitted.value)) {
      const code =
        !emitted.ok &&
        (emitted.issues[0].code === "wall-time-exhaustion" ||
          emitted.issues[0].code === "output-exhaustion" ||
          emitted.issues[0].code === "evidence-exhaustion")
          ? emitted.issues[0].code
          : "emission-failure";
      return failure(code, "/emit", "Emitter execution failed.");
    }
    if (
      workspace.value.writeFileExclusive === undefined ||
      workspace.value.retainRegularFile === undefined
    ) {
      return failure("emission-failure", "/emit", "Workspace write authority is unavailable.");
    }
    await workspace.value.writeFileExclusive("main.asm", emitted.value.assemblyBytes);
    const retainedAssembly = await workspace.value.retainRegularFile("main.asm");
    try {
      await retainedAssembly.revalidate();
      const invocation: AcmeInvocation = {
        acmeExe,
        asmPath: retainedAssembly.externalPath,
        binaryPath: `${workspace.value.root}/main.prg`,
        labelPath: `${workspace.value.root}/main.lbl`,
        reportPath: `${workspace.value.root}/main.report`,
        cwd: workspace.value.root,
      };
      const outputHash = createHash("sha256");
      const outputCapacity = supervisor.remainingOutputBytes();
      let streamedBytes = 0;
      let outputExhausted = false;
      const observe = (bytes: Uint8Array): void => {
        if (outputExhausted) return;
        if (!(bytes instanceof Uint8Array) || bytes.byteLength > outputCapacity - streamedBytes) {
          outputExhausted = true;
          return;
        }
        streamedBytes += bytes.byteLength;
        outputHash.update(bytes);
      };
      let outcome: AcmeRunOutput;
      try {
        outcome = await invokeBoundedAcmeV1(
          invocation,
          injectedRunner ?? createSupervisedAcmeRunnerV1(supervisor),
          {
            signal: cancellation.signal,
            deadlineMonotonicMs: Math.min(
              cancellation.deadlineMonotonicMs,
              supervisor.deadline.workDeadlineMs,
            ),
            onStdout: observe,
            onStderr: observe,
          },
        );
      } catch (error) {
        const observedCode =
          error instanceof Error && "code" in error && typeof error.code === "string"
            ? error.code
            : undefined;
        const code =
          observedCode === "ENOENT" ||
          (observedCode === "execution.io" &&
            error instanceof Error &&
            /ENOENT/u.test(error.message))
            ? "tier-unavailable"
            : observedCode === "output-exhaustion" ||
                observedCode === "evidence-exhaustion" ||
                observedCode === "wall-time-exhaustion"
              ? observedCode
              : "assembler-failure";
        const detail = error instanceof Error ? error.message : "unknown process failure";
        return failure(code, "/acme", `Supervised ACME execution failed: ${detail}`);
      }
      await retainedAssembly.revalidate();
      if (outputExhausted) {
        return failure("output-exhaustion", "/acme", "Assembler output limit was exceeded.");
      }
      if (injectedRunner !== undefined) {
        const charged = supervisor.recordOutput(streamedBytes);
        if (!charged.ok) return failure("output-exhaustion", "/acme", charged.issues[0].message);
        const streamEvidence = supervisor.recordEvidence(
          ENCODER.encode(`${streamedBytes}\u0000${outputHash.digest("hex")}`),
        );
        if (!streamEvidence.ok) {
          return failure("evidence-exhaustion", "/acme", streamEvidence.issues[0].message);
        }
      }
      if (outcome.exitCode !== 0) {
        return failure("assembler-failure", "/acme", "ACME returned a non-zero exit status.");
      }
      if (workspace.value.readRegularFile === undefined) {
        return failure("assembler-failure", "/acme", "Artifact read authority is unavailable.");
      }
      const artifacts = new Map<string, Uint8Array>();
      for (const [artifactName, minimumBytes] of [
        ["main.prg", 2],
        ["main.lbl", 1],
        ["main.report", 1],
      ] as const) {
        const remaining = supervisor.remainingEvidenceBytes();
        if (remaining <= 0) {
          return failure("evidence-exhaustion", "/acme", "Artifact evidence budget is exhausted.");
        }
        const artifact = await workspace.value.readRegularFile(artifactName, remaining);
        if (artifact.byteLength < minimumBytes) {
          return failure("assembler-failure", "/acme", "ACME artifact is incomplete.");
        }
        const evidenceArtifact =
          artifactName === "main.report" && dependencies.evidenceProfile === "sealed-vice-v1"
            ? canonicalizeSealedAcmeReportEvidenceV1(artifact, retainedAssembly.externalPath)
            : artifact;
        if (evidenceArtifact === undefined) {
          return failure(
            "assembler-failure",
            "/acme",
            "ACME report source identity is not the retained assembly descriptor.",
          );
        }
        const recorded = supervisor.recordEvidence(evidenceArtifact);
        if (!recorded.ok) {
          return failure("evidence-exhaustion", "/acme", recorded.issues[0].message);
        }
        artifacts.set(artifactName, artifact);
      }
      return success(
        Object.freeze({
          emitted: emitted.value,
          binary: artifacts.get("main.prg")!,
          labels: artifacts.get("main.lbl")!,
          report: artifacts.get("main.report")!,
        }),
      );
    } finally {
      await retainedAssembly.close();
    }
  } catch {
    return failure(
      cancellation.signal.aborted ? "wall-time-exhaustion" : "assembler-failure",
      "/acme",
      "ACME artifact pipeline failed closed.",
    );
  } finally {
    await workspace.value
      .dispose(performance.now() + supervisor.deadline.cleanupGraceMs)
      .catch(() => undefined);
  }
}
