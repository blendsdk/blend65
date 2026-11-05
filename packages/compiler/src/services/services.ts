import { randomUUID } from "node:crypto";
import { lstat, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { serializeAcme } from "../artifacts/acme-serializer.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { deriveOptimizationFacts } from "../machine/optimization-facts.js";
import {
  compareOptimizationCosts,
  selectOptimizationCandidate,
} from "../machine/optimization-cost.js";
import { analyzeProjectWithAssets } from "../frontend/service.js";
import type { C64KernalProfileId } from "../profile/c64-kernal.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import { loadProjectWithControls } from "../project/snapshot.js";
import type { ProjectDiagnostic, ProjectSnapshot, SourceSpan } from "../project/types.js";
import { identifyPublicationRoot, publicationRootMatches } from "../publication/lock.js";
import { releaseGenerationPin } from "../publication/pins.js";
import { publishGeneration } from "../publication/publication.js";
import type { GenerationPin, PublishedGeneration } from "../publication/publication.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { collectSourceLoopNesting } from "../semantic/fixed-loop-facts.js";
import { selectTargetProfile } from "../target/profile.js";
import { runAcme } from "../tools/acme.js";
import { discoverAcme } from "../tools/discovery.js";
import { prepareEvidence } from "./evidence.js";
import type {
  SizeCostSourceSite,
  SizeCostVector,
  SizeEvidenceCandidate,
  SizeEvidenceDecision,
} from "./evidence.js";
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
import { resourceSourceSpans } from "./resource-diagnostics.js";
import {
  closeCanonicalReference,
  closeCanonicalStorage,
  closeSizeCandidate,
  sizeSelectionPlans,
} from "./size-selection.js";
import type {
  CanonicalPipeline,
  CanonicalReferenceOutcome,
  CheckedSourceInput,
  ClosedSizeCandidate,
} from "./size-selection.js";

interface PreparedBuild {
  /** Identity from the same checked snapshot that produced the published generation. */
  readonly profileId: C64KernalProfileId;
  readonly generation: PublishedGeneration;
  readonly pin: GenerationPin | null;
  readonly diagnostics: readonly ProjectDiagnostic[];
}

type PipelineResult =
  | { readonly kind: "complete"; readonly value: CanonicalPipeline }
  | { readonly kind: "failure"; readonly failure: ServiceFailure };

/** Source/type/effect checks complete independently of a successful resource reference. */
type CheckedSourceResult =
  | { readonly kind: "complete"; readonly value: CheckedSourceInput }
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
    (optimization !== undefined &&
      optimization !== "none" &&
      optimization !== "balanced" &&
      optimization !== "speed" &&
      optimization !== "size") ||
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

/** Retain checked source before any optional representation depends on allocation success. */
async function checkSource(options: BuildOptions): Promise<CheckedSourceResult> {
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
  const closed = closeWholeProgram(
    semantic.program,
    selected.profile.interrupts,
    selected.profile.storage,
  );
  if (closed.kind === "error") {
    return { kind: "failure", failure: failure("compiler", closed.diagnostics) };
  }
  return Object.freeze({
    kind: "complete",
    value: Object.freeze({
      snapshot: Object.freeze({ ...selectedSnapshot, ...analyzed.inputs }),
      resourceSpans: resourceSourceSpans(analyzed.program),
      profile: selected.profile,
      program: closed.program,
      ...(selectedSnapshot.manifest.optimization !== "none"
        ? { loopNesting: collectSourceLoopNesting(closed.program, analyzed.program) }
        : {}),
      bindingNames: new Map(
        analyzed.program.bindings.map((binding) => [
          bindingIdentityKey(binding.id),
          binding.qualifiedName ?? binding.name,
        ]),
      ),
      sourceText: (span: SourceSpan) => {
        const source = analyzed.inputs.sources.find(({ sourceId }) => sourceId === span.sourceId);
        return source === undefined
          ? ""
          : Buffer.from(source.text, "utf8").subarray(span.start, span.end).toString("utf8");
      },
      diagnostics: Object.freeze([...loaded.observations, ...analyzed.diagnostics]),
    }),
  });
}

/** Checking keeps the direct pre-layout storage proof regardless of manifest preference. */
async function checkPipeline(options: BuildOptions): Promise<PipelineResult> {
  const source = await checkSource(options);
  if (source.kind === "failure") return source;
  const canonical = closeCanonicalStorage(source.value);
  return canonical.kind === "resource-rejected"
    ? { kind: "failure", failure: canonical.failure }
    : canonical;
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

/** Map one source span to the costs-evidence source-site shape. */
function costSourceSites(span: SourceSpan | null): readonly SizeCostSourceSite[] {
  return span === null
    ? []
    : Object.freeze([{ path: span.sourceId, startByte: span.start, endByte: span.end }]);
}

/** Map one reference stage to the costs validator's allowed hard-reason family. */
function referenceRejectionKind(stage: string): string {
  if (stage === "zero-page") return "zeroPage";
  if (stage === "storage") return "sfa";
  if (stage === "stack") return "stack";
  if (stage === "payload") return "memory";
  if (stage === "layout") return "layout";
  return "memory";
}

/** Convert one rejected canonical reference into an exact rejected candidate. */
function referenceRejection(
  reference: Extract<CanonicalReferenceOutcome, { readonly kind: "resource-rejected" }>,
): SizeEvidenceCandidate {
  const detail =
    reference.failure.diagnostics
      .map(({ message }) => message)
      .filter((message) => message.length > 0)
      .join("; ") || `${reference.stage} resource rejection`;
  return Object.freeze({
    id: "reference",
    feasibility: Object.freeze({
      kind: "rejected" as const,
      reasons: Object.freeze([
        Object.freeze({
          kind: referenceRejectionKind(reference.stage),
          detail,
          sourceSites: Object.freeze([]),
        }),
      ]),
    }),
  });
}

/** Compile, assemble, reconcile and publish one fresh generation. */
async function buildFresh(options: BuildOptions, pinForRun: boolean): Promise<PreparedBuildResult> {
  const source = await checkSource(options);
  if (source.kind === "failure") return source;
  const mode = source.value.snapshot.manifest.optimization;
  const optimized = mode !== "none";
  // The canonical reference is the same rule pipeline's baseline: optimized
  // candidates must be compared against an equally cleaned reference, never
  // against an unoptimized fallback that would make ordinary cleanup look like a
  // representation win.
  const optimizationFacts = optimized
    ? deriveOptimizationFacts({ checked: source.value, mode })
    : undefined;
  const storage = closeCanonicalStorage(source.value, optimizationFacts);
  if (storage.kind === "failure") return storage;
  if (!optimized && storage.kind === "resource-rejected")
    return { kind: "failure", failure: storage.failure };
  // Keep the original checkpoint after direct storage proof and before layout.
  // A cancelled size attempt must not enter the later candidate constructor.
  if (isCancelled(options.signal)) return { kind: "failure", failure: cancelled() };
  const reference =
    storage.kind === "resource-rejected" ? storage : closeCanonicalReference(storage.value);
  if (reference.kind === "failure") return reference;
  let selectedPipeline: CanonicalPipeline | null =
    reference.kind === "feasible" ? reference.checked : null;
  let selectedShared: ClosedSizeCandidate["shared"] | null =
    reference.kind === "feasible" ? reference.shared : null;
  let selectedDiagnostics: readonly ProjectDiagnostic[] | null =
    reference.kind === "feasible" ? reference.diagnostics : null;
  let sizeDecision: SizeEvidenceDecision | undefined;
  if (optimized) {
    const evidenceCandidates: SizeEvidenceCandidate[] = [];
    const feasible = new Map<
      string,
      {
        readonly pipeline: CanonicalPipeline;
        readonly shared: ClosedSizeCandidate["shared"];
        readonly diagnostics: readonly ProjectDiagnostic[];
        readonly cost: SizeCostVector;
      }
    >();
    if (reference.kind !== "feasible") evidenceCandidates.push(referenceRejection(reference));
    const baseFacts = optimizationFacts ?? deriveOptimizationFacts({ checked: source.value, mode });
    // Every tuple receives the reference's exact dead-home set. This keeps the
    // canonical and selected layouts structurally identical after cleanup.
    const referenceDeadHomes =
      reference.kind === "feasible" ? reference.checked.deadHomes : undefined;
    const sizeFacts =
      referenceDeadHomes === undefined
        ? baseFacts
        : Object.freeze({ ...baseFacts, deadHomes: referenceDeadHomes });
    let baselineRecipe: string | undefined;
    for (const plan of sizeSelectionPlans({ checked: source.value })) {
      if (isCancelled(options.signal)) return { kind: "failure", failure: cancelled() };
      const candidate = closeSizeCandidate({
        checked: source.value,
        reference,
        plan,
        optimizationFacts: sizeFacts,
      });
      if (candidate.kind === "failure") return { kind: "failure", failure: candidate.failure };
      if (candidate.kind === "complete") {
        evidenceCandidates.push(
          Object.freeze({
            id: plan.id,
            feasibility: Object.freeze({
              kind: "feasible" as const,
              vector: candidate.value.cost,
            }),
          }),
        );
        feasible.set(plan.id, {
          pipeline: candidate.value.pipeline,
          shared: candidate.value.shared,
          diagnostics: candidate.value.pipeline.diagnostics,
          cost: candidate.value.cost,
        });
        if (
          plan.nonLoopBundle === "closed" &&
          plan.loopPolicy === "original" &&
          plan.startupPolicy === "full"
        )
          baselineRecipe = plan.id;
      } else {
        evidenceCandidates.push(
          Object.freeze({
            id: plan.id,
            feasibility: Object.freeze({
              kind: "rejected" as const,
              reasons: Object.freeze([
                Object.freeze({
                  kind: candidate.rejectionKind,
                  detail: candidate.reason,
                  sourceSites: costSourceSites(candidate.source),
                }),
              ]),
            }),
          }),
        );
      }
    }
    if (feasible.size === 0) {
      if (reference.kind === "resource-rejected")
        return { kind: "failure", failure: reference.failure };
      return { kind: "failure", failure: incompleteStage("size cost selection") };
    }
    // The canonical direct reference is not publishable in an optimized mode:
    // rules change its machine code, so it must pass the same final-observer gate
    // as a candidate. The Closed Original/full recipe is its validated form and
    // is therefore the baseline that balanced/speed may retain.
    const fallbackBaseline = [...feasible.keys()].sort((left, right) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right)),
    )[0]!;
    const baselineId =
      baselineRecipe !== undefined && feasible.has(baselineRecipe)
        ? baselineRecipe
        : fallbackBaseline;
    // The size-quality recipe is the production baseline for balanced/speed:
    // it is a validated candidate, so the default mode never publishes a larger
    // canonical recipe merely because the canonical shape is a Pareto tradeoff.
    // Size itself still compares against the Closed Original/full canonical.
    const sizeWinnerId = [...feasible.entries()].sort(([leftId, left], [rightId, right]) => {
      const bytes = left.cost.programBytes - right.cost.programBytes;
      if (bytes !== 0) return bytes;
      for (let index = 0; index < left.cost.resources.length; index += 1) {
        const difference = left.cost.resources[index]!.value - right.cost.resources[index]!.value;
        if (difference !== 0) return difference;
      }
      return Buffer.compare(Buffer.from(leftId), Buffer.from(rightId));
    })[0]![0];
    const selectionBaselineId = mode === "size" ? baselineId : sizeWinnerId;
    const baselineEntry = feasible.get(selectionBaselineId)!;
    // The evidence baseline is the actual canonical reference shape for size.
    // Balanced/speed record the validated size-quality recipe they start from.
    const recordedBaselineId =
      mode !== "size"
        ? selectionBaselineId
        : reference.kind === "feasible"
          ? baselineId
          : "reference";
    const selection = selectOptimizationCandidate(
      mode,
      { id: selectionBaselineId, cost: baselineEntry.cost },
      [...feasible.entries()]
        .filter(([id]) => id !== selectionBaselineId)
        .map(([id, value]) => ({ id, cost: value.cost })),
    );
    const selectedEntry =
      selection.kind === "selected" ? feasible.get(selection.candidateId) : undefined;
    const chosen =
      selection.kind === "selected" && selectedEntry !== undefined
        ? ([selection.candidateId, selectedEntry] as const)
        : ([selectionBaselineId, baselineEntry] as const);
    const incomparableComponents =
      selection.kind === "selected" ? [] : selection.incomparableComponents;
    const tiedIds =
      selection.kind === "selected" && selection.tieBreak === "stableId"
        ? [...feasible.entries()]
            .filter(
              ([, value]) =>
                compareOptimizationCosts(mode, chosen[1].cost, value.cost).kind === "equal",
            )
            .map(([id]) => id)
            .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
        : [];
    const main = source.value.program.semantic.main;
    sizeDecision = Object.freeze({
      id: `${mode}.whole-program`,
      scope: `${main.span.sourceId}::main`,
      mode,
      sourceSites: costSourceSites(main.span),
      closurePoint: "postLayout",
      baselineCandidateId: recordedBaselineId,
      selectedCandidateId: chosen[0],
      candidates: Object.freeze(
        evidenceCandidates.sort((left, right) =>
          Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
        ),
      ),
      incomparableComponents: Object.freeze(
        [...incomparableComponents].sort((left, right) => left.localeCompare(right)),
      ),
      tieBreak:
        tiedIds.length > 1
          ? Object.freeze({ kind: "stableId" as const, candidateIds: Object.freeze([...tiedIds]) })
          : Object.freeze({ kind: "none" as const }),
    });
    selectedPipeline = chosen[1].pipeline;
    selectedShared = chosen[1].shared;
    selectedDiagnostics = chosen[1].diagnostics;
    // Only the selected tuple is published; release every losing tree before
    // artifact assembly and evidence preparation begin.
    feasible.clear();
  }
  if (selectedPipeline === null || selectedShared === null || selectedDiagnostics === null)
    return { kind: "failure", failure: incompleteStage("size cost selection") };
  const { snapshot, profile } = selectedPipeline;
  if (isCancelled(options.signal)) return { kind: "failure", failure: cancelled() };
  const { layout, certificate } = selectedShared;
  const diagnostics = selectedDiagnostics;
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
      program: selectedPipeline.program,
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
      ...(sizeDecision === undefined ? {} : { sizeDecision }),
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
      profileId: profile.id,
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
        built.value.profileId,
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
