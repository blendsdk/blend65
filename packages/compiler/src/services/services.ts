import { randomUUID } from "node:crypto";
import { lstat, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { serializeAcme } from "../artifacts/acme-serializer.js";
import { analyzeProjectWithAssets } from "../frontend/service.js";
import { layoutC64Program } from "../layout/c64-layout.js";
import { bindMachineProgram } from "../machine/bind.js";
import { lowerMachineProgram } from "../machine/lower.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import { loadProjectWithControls } from "../project/snapshot.js";
import type { ProjectDiagnostic, ProjectSnapshot } from "../project/types.js";
import { identifyPublicationRoot, publicationRootMatches } from "../publication/lock.js";
import { releaseGenerationPin } from "../publication/pins.js";
import { publishGeneration } from "../publication/publication.js";
import type { GenerationPin, PublishedGeneration } from "../publication/publication.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { closeStorage } from "../storage/closure.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectTargetProfile } from "../target/profile.js";
import type { TargetProfile } from "../target/profile.js";
import { runAcme } from "../tools/acme.js";
import { discoverAcme } from "../tools/discovery.js";
import { prepareEvidence } from "./evidence.js";
import type {
  BuildOptions,
  BuildResult,
  CheckOptions,
  CheckResult,
  FailureCategory,
  RunOptions,
  RunResult,
  ServiceFailure,
  ServiceMeasurements,
} from "./types.js";
import { findVice, launchVice, probeVice } from "./vice.js";

interface CheckedPipeline {
  readonly snapshot: ProjectSnapshot;
  readonly profile: TargetProfile;
  readonly program: ReturnType<typeof closeWholeProgram> extends infer Result
    ? Result extends { readonly kind: "complete"; readonly program: infer Program }
      ? Program
      : never
    : never;
  readonly certificate: Extract<ReturnType<typeof closeStorage>, { readonly kind: "complete" }>;
  readonly machine: Extract<ReturnType<typeof bindMachineProgram>, { readonly kind: "complete" }>;
  readonly diagnostics: readonly ProjectDiagnostic[];
}

interface PreparedBuild {
  readonly generation: PublishedGeneration;
  readonly pin: GenerationPin | null;
  readonly diagnostics: readonly ProjectDiagnostic[];
}

type PipelineResult =
  | { readonly kind: "complete"; readonly value: CheckedPipeline }
  | { readonly kind: "failure"; readonly failure: ServiceFailure };

type PreparedBuildResult =
  | { readonly kind: "complete"; readonly value: PreparedBuild }
  | { readonly kind: "failure"; readonly failure: ServiceFailure };

interface OwnedDirectoryIdentity {
  readonly device: bigint;
  readonly inode: bigint;
}

/** Return one safe service diagnostic without leaking native errors or absolute paths. */
function serviceDiagnostic(code: string, message: string): ProjectDiagnostic {
  return projectDiagnostic(code, message, null);
}

/** Return one expected service failure as immutable data. */
function failure(
  category: FailureCategory,
  diagnostics: readonly ProjectDiagnostic[],
): ServiceFailure {
  return Object.freeze({ kind: "failure", category, diagnostics: Object.freeze([...diagnostics]) });
}

/** Report elapsed time while avoiding a platform-dependent peak-memory claim. */
function measurements(started: number): ServiceMeasurements {
  return Object.freeze({
    durationMilliseconds: Math.max(0, performance.now() - started),
    peakRssBytes: "Unknown",
  });
}

/** Return a typed cancellation result at a safe service boundary. */
function cancelled(): ServiceFailure {
  return failure("cancelled", [serviceDiagnostic("SERVICE_CANCELLED", "Operation was cancelled")]);
}

/** Read live cancellation state without retaining stale control-flow narrowing across awaits. */
function isCancelled(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/** Replace only the three explicitly supported build settings on an immutable snapshot. */
function effectiveSnapshot(
  snapshot: ProjectSnapshot,
  options: BuildOptions,
): ProjectSnapshot | ServiceFailure {
  const optimization: unknown = Reflect.get(options, "optimization");
  const boundsCheck: unknown = Reflect.get(options, "boundsCheck");
  const divisionZeroCheck: unknown = Reflect.get(options, "divisionZeroCheck");
  if (
    (optimization !== undefined && optimization !== "none") ||
    (boundsCheck !== undefined && typeof boundsCheck !== "boolean") ||
    (divisionZeroCheck !== undefined && typeof divisionZeroCheck !== "boolean")
  ) {
    return failure("source", [
      serviceDiagnostic("SERVICE_INVALID_OPTION", "A compiler option has an unsupported value"),
    ]);
  }
  return Object.freeze({
    ...snapshot,
    manifest: Object.freeze({
      ...snapshot.manifest,
      optimization: options.optimization ?? snapshot.manifest.optimization,
      boundsCheck: options.boundsCheck ?? snapshot.manifest.boundsCheck,
      divisionZeroCheck: options.divisionZeroCheck ?? snapshot.manifest.divisionZeroCheck,
    }),
  });
}

/** Convert an incomplete admitted stage into one stable compiler failure. */
function incompleteStage(stage: string): ServiceFailure {
  return failure("compiler", [
    serviceDiagnostic("COMPILER_INCOMPLETE", `The ${stage} stage is not complete for this program`),
  ]);
}

/** Run every check-owned stage through final storage binding without platform layout. */
async function checkPipeline(options: BuildOptions): Promise<PipelineResult> {
  if (isCancelled(options.signal)) return { kind: "failure", failure: cancelled() };
  const loaded = await loadProjectWithControls({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.project === undefined ? {} : { project: options.project }),
    ...(options.target === undefined ? {} : { target: options.target }),
    ...(options.entry === undefined ? {} : { entry: options.entry }),
  });
  if (loaded.kind === "failure") {
    return { kind: "failure", failure: failure("source", loaded.diagnostics) };
  }
  if (isCancelled(options.signal)) return { kind: "failure", failure: cancelled() };
  const selectedSnapshot = effectiveSnapshot(loaded.snapshot, options);
  if ("category" in selectedSnapshot) {
    return { kind: "failure", failure: selectedSnapshot };
  }
  const selected = selectTargetProfile(selectedSnapshot.effectiveTarget);
  if (selected.kind === "error") {
    return { kind: "failure", failure: failure("source", selected.diagnostics) };
  }
  const analyzed = await analyzeProjectWithAssets(selectedSnapshot);
  if (analyzed.kind === "error") {
    return { kind: "failure", failure: failure("source", analyzed.diagnostics) };
  }
  if (analyzed.kind === "incomplete") {
    return {
      kind: "failure",
      failure:
        analyzed.diagnostics.length > 0
          ? failure("compiler", analyzed.diagnostics)
          : incompleteStage("frontend"),
    };
  }
  if (isCancelled(options.signal)) return { kind: "failure", failure: cancelled() };
  const semantic = buildSemanticProgram(analyzed);
  if (semantic.kind === "error") {
    return { kind: "failure", failure: failure("source", semantic.diagnostics) };
  }
  if (semantic.kind === "incomplete") {
    return { kind: "failure", failure: incompleteStage("semantic lowering") };
  }
  const closed = closeWholeProgram(semantic.program);
  if (closed.kind === "error") {
    return { kind: "failure", failure: failure("compiler", closed.diagnostics) };
  }
  const inventory = inventoryStorage(closed.program);
  const provisional = allocateStorage(
    inventory,
    buildInterference(inventory),
    selected.profile.storage,
  );
  if (provisional.kind === "error") {
    return { kind: "failure", failure: incompleteStage("static storage allocation") };
  }
  const lowered = lowerMachineProgram({
    program: closed.program,
    placement: provisional.placement,
    profile: selected.profile,
    divisionZeroCheck: selectedSnapshot.manifest.divisionZeroCheck,
    sourceText: (span) => {
      const source = selectedSnapshot.sources.find(({ sourceId }) => sourceId === span.sourceId);
      return source === undefined
        ? ""
        : Buffer.from(source.text, "utf8").subarray(span.start, span.end).toString("utf8");
    },
  });
  if (lowered.kind === "error") {
    return {
      kind: "failure",
      failure: failure("compiler", [serviceDiagnostic("COMPILER_LOWERING", lowered.reason)]),
    };
  }
  const certificate = closeStorage(inventory, selected.profile.storage, lowered.binder);
  if (certificate.kind === "error") {
    return { kind: "failure", failure: incompleteStage("static storage closure") };
  }
  const machine = bindMachineProgram(lowered.program, certificate.certificate);
  if (machine.kind === "error") {
    return { kind: "failure", failure: incompleteStage("machine storage binding") };
  }
  return Object.freeze({
    kind: "complete",
    value: Object.freeze({
      snapshot: selectedSnapshot,
      profile: selected.profile,
      program: closed.program,
      certificate,
      machine,
      diagnostics: Object.freeze([
        ...loaded.observations,
        ...analyzed.diagnostics,
        ...lowered.diagnostics,
      ]),
    }),
  });
}

/** Ensure the compiler-owned output root is a stable direct child before staging begins. */
async function prepareOutputRoot(snapshot: ProjectSnapshot): Promise<boolean> {
  try {
    await mkdir(snapshot.outDir, { recursive: false });
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") return false;
  }
  return (await identifyPublicationRoot(snapshot)) !== null;
}

/** Retain the native identity of a compiler-created directory without following a link. */
async function identifyOwnedDirectory(path: string): Promise<OwnedDirectoryIdentity | null> {
  try {
    const metadata = await lstat(path, { bigint: true });
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    return Object.freeze({ device: metadata.dev, inode: metadata.ino });
  } catch {
    return null;
  }
}

/** Remove a compiler-created directory only while its retained native identity still matches. */
async function removeOwnedDirectory(
  path: string,
  identity: OwnedDirectoryIdentity,
): Promise<boolean> {
  try {
    const metadata = await lstat(path, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.dev !== identity.device ||
      metadata.ino !== identity.inode
    ) {
      return false;
    }
    await rm(path, { recursive: true, force: false });
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
}

/** Compile, assemble, reconcile and publish one fresh generation. */
async function buildFresh(options: BuildOptions, pinForRun: boolean): Promise<PreparedBuildResult> {
  const checked = await checkPipeline(options);
  if (checked.kind === "failure") return checked;
  const { snapshot, profile, program, certificate, machine, diagnostics } = checked.value;
  if (isCancelled(options.signal)) return { kind: "failure", failure: cancelled() };
  const layout = layoutC64Program({
    program: machine.program,
    certificate: certificate.certificate,
    profile,
  });
  if (layout.kind === "error") {
    return {
      kind: "failure",
      failure: failure("compiler", [
        serviceDiagnostic("COMPILER_LAYOUT", `Platform layout failed: ${layout.reason}`),
      ]),
    };
  }
  const serialization = serializeAcme({
    layout,
    certificate: certificate.certificate,
    profile,
  });
  if (serialization.kind === "error") {
    return {
      kind: "failure",
      failure: failure("compiler", [
        serviceDiagnostic("COMPILER_SERIALIZATION", serialization.diagnostic),
      ]),
    };
  }
  const discovered = await discoverAcme(
    options.signal === undefined ? {} : { signal: options.signal },
  );
  if (discovered.kind === "error") {
    const category = discovered.reason === "cancelled" ? "cancelled" : "tool-discovery";
    return {
      kind: "failure",
      failure: failure(category, [serviceDiagnostic("ACME_DISCOVERY", discovered.diagnostic)]),
    };
  }
  if (!(await prepareOutputRoot(snapshot))) {
    return {
      kind: "failure",
      failure: failure("packaging", [
        serviceDiagnostic("PUBLICATION_ROOT", "The output directory is not a stable project child"),
      ]),
    };
  }
  const rootIdentity = await identifyPublicationRoot(snapshot);
  if (rootIdentity === null) {
    return { kind: "failure", failure: incompleteStage("publication root") };
  }
  const generationId = randomUUID();
  const stagingDirectory = join(snapshot.outDir, `.staging-${generationId}`);
  const assembled = await runAcme({
    tool: discovered.tool,
    stagingDirectory,
    artifactName: snapshot.manifest.name,
    serialization,
    layout,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  if (assembled.kind === "error") {
    const category = assembled.reason === "cancelled" ? "cancelled" : "assembler";
    return {
      kind: "failure",
      failure: failure(category, [serviceDiagnostic("ACME_EXECUTION", assembled.diagnostic)]),
    };
  }
  const stagingIdentity = await identifyOwnedDirectory(stagingDirectory);
  if (stagingIdentity === null) {
    return {
      kind: "failure",
      failure: failure("recovery-required", [
        serviceDiagnostic(
          "ARTIFACT_STAGING_OWNERSHIP",
          "The compiler staging directory identity could not be retained",
        ),
      ]),
    };
  }
  if (!(await publicationRootMatches(rootIdentity))) {
    const cleaned = await removeOwnedDirectory(stagingDirectory, stagingIdentity);
    return {
      kind: "failure",
      failure: failure("recovery-required", [
        serviceDiagnostic(
          "PUBLICATION_OWNERSHIP",
          cleaned
            ? "The output directory changed while the generation was prepared"
            : "The output directory changed and staging cleanup requires recovery",
        ),
      ]),
    };
  }
  let evidence;
  try {
    evidence = await prepareEvidence({
      snapshot,
      program,
      inventory: certificate.inventory,
      certificate: certificate.certificate,
      layout,
      profile,
      tool: discovered.tool,
      artifacts: assembled.artifacts,
      stagingDirectory,
      generationId,
      measurements: Object.freeze({
        durationMilliseconds: "Unknown",
        peakRssBytes: "Unknown",
      }),
    });
  } catch {
    if (!(await removeOwnedDirectory(stagingDirectory, stagingIdentity))) {
      return {
        kind: "failure",
        failure: failure("recovery-required", [
          serviceDiagnostic(
            "ARTIFACT_EVIDENCE_CLEANUP",
            "Failed evidence left compiler-owned staging that requires recovery",
          ),
        ]),
      };
    }
    return {
      kind: "failure",
      failure: failure("packaging", [
        serviceDiagnostic("ARTIFACT_EVIDENCE", "Artifact evidence preparation failed"),
      ]),
    };
  }
  if (evidence.kind === "error") {
    if (!(await removeOwnedDirectory(stagingDirectory, stagingIdentity))) {
      return {
        kind: "failure",
        failure: failure("recovery-required", [
          serviceDiagnostic(
            "ARTIFACT_EVIDENCE_CLEANUP",
            "Failed evidence left compiler-owned staging that requires recovery",
          ),
        ]),
      };
    }
    return {
      kind: "failure",
      failure: failure("packaging", [serviceDiagnostic("ARTIFACT_EVIDENCE", evidence.diagnostic)]),
    };
  }
  const published = await publishGeneration({
    snapshot,
    generationId,
    stagingDirectory,
    files: evidence.files,
    primaryArtifact: evidence.primaryArtifact,
    buildJsonSha256: evidence.buildJsonSha256,
    pinForRun,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  if (published.kind === "error") {
    const category: FailureCategory =
      published.reason === "cancelled"
        ? "cancelled"
        : new Set([
              "committed-recovery",
              "current",
              "pin",
              "cleanup",
              "ownership",
              "lock-timeout",
            ]).has(published.reason)
          ? "recovery-required"
          : "packaging";
    return {
      kind: "failure",
      failure: failure(category, [serviceDiagnostic("PUBLICATION_FAILED", published.diagnostic)]),
    };
  }
  return Object.freeze({
    kind: "complete",
    value: Object.freeze({
      generation: published.generation,
      pin: published.pin,
      diagnostics,
    }),
  });
}

/** Check a fresh project through target binding and final static-storage closure. */
export async function checkProject(options: CheckOptions = {}): Promise<CheckResult> {
  const started = performance.now();
  const checked = await checkPipeline(options);
  if (checked.kind === "failure") return checked.failure;
  return Object.freeze({
    kind: "success",
    snapshotSha256: checked.value.snapshot.inputSha256,
    profileId: checked.value.profile.id,
    diagnostics: checked.value.diagnostics,
    measurements: measurements(started),
  });
}

/** Build and atomically publish one fresh, fully reconciled project generation. */
export async function buildProject(options: BuildOptions = {}): Promise<BuildResult> {
  const started = performance.now();
  const built = await buildFresh(options, false);
  if (built.kind === "failure") return built.failure;
  return Object.freeze({
    kind: "success",
    generation: built.value.generation,
    diagnostics: built.value.diagnostics,
    measurements: measurements(started),
  });
}

/** Build, pin and run this invocation's exact new generation in interactive VICE 3.10. */
export async function runProject(options: RunOptions = {}): Promise<RunResult> {
  const started = performance.now();
  const built = await buildFresh(options, true);
  if (built.kind === "failure") return built.failure;
  const pin = built.value.pin;
  if (pin === null) {
    return failure("recovery-required", [
      serviceDiagnostic("RUN_PIN", "The published run generation was not pinned"),
    ]);
  }
  let result: ServiceFailure | null = null;
  const executable = await findVice();
  if (executable === null) {
    result = failure("tool-discovery", [
      serviceDiagnostic("VICE_DISCOVERY", "VICE x64sc was not found on the ordered PATH"),
    ]);
  } else {
    const probe = await probeVice(executable, options.signal);
    if (probe === "cleanup-uncertain") {
      return failure("recovery-required", [
        serviceDiagnostic(
          "VICE_CLEANUP",
          "The owned VICE process could not be confirmed stopped; the generation pin was retained",
        ),
      ]);
    }
    if (probe !== true) {
      result =
        probe === "cancelled"
          ? cancelled()
          : failure("tool-discovery", [
              serviceDiagnostic("VICE_VERSION", "VICE x64sc 3.10 is required"),
            ]);
    } else {
      const launched = await launchVice(
        executable,
        join(pin.directory, pin.primaryArtifact),
        options.signal,
      );
      if (launched === "cleanup-uncertain") {
        return failure("recovery-required", [
          serviceDiagnostic(
            "VICE_CLEANUP",
            "The owned VICE process could not be confirmed stopped; the generation pin was retained",
          ),
        ]);
      }
      if (launched !== "complete") {
        result =
          launched === "cancelled"
            ? cancelled()
            : failure(launched === "start" ? "emulator-start" : "emulator-runtime", [
                serviceDiagnostic("VICE_EXECUTION", "The owned VICE process did not exit cleanly"),
              ]);
      }
    }
  }
  const released = await releaseGenerationPin(pin);
  if (released.kind === "error") {
    return failure("recovery-required", [
      serviceDiagnostic("RUN_PIN_RELEASE", released.diagnostic),
    ]);
  }
  if (result !== null) return result;
  return Object.freeze({
    kind: "success",
    generation: built.value.generation,
    status: "exited",
    verification: "interactive-unverified",
    diagnostics: built.value.diagnostics,
    measurements: measurements(started),
  });
}
