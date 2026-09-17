import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import {
  checkLimit,
  escapeDiagnosticText,
  projectDiagnostic,
  PROJECT_CODES,
  ProjectChanged,
  ProjectFailure,
  sortDiagnostics,
  throwReadFailure,
} from "./diagnostics.js";
import { discoverProject } from "./discovery.js";
import { inventorySources } from "./inventory.js";
import { parseManifest, PROFILES, validEntry } from "./manifest.js";
import { sameIdentity, sameMetadata, validatePaths } from "./paths.js";
import type { ProjectPaths, ResolvedInput } from "./paths.js";
import { checkpoint, DEFAULT_LIMITS, guardPath, readInput } from "./reads.js";
import type { LoadContext } from "./reads.js";
import { RESULT_KIND } from "./types.js";
import type {
  ProjectDiagnostic,
  ProjectLimits,
  ProjectLoadControls,
  ProjectLoadOptions,
  ProjectLoadResult,
  ProjectSnapshot,
  SourceRecord,
} from "./types.js";

/** Classify primitive host identities without pretending best-effort hosts are qualified. */
export function hostObservations(
  nodeMajor: number,
  os: string,
  arch: string,
): readonly ProjectDiagnostic[] {
  const label = escapeDiagnosticText(nodeMajor + "/" + os + "/" + arch);
  if (nodeMajor !== 22 || !["x64", "arm64", "ppc64", "s390x", "riscv64", "loong64"].includes(arch))
    throw new ProjectFailure([
      projectDiagnostic(PROJECT_CODES.unsupported, "Unsupported project host: " + label),
    ]);
  if (arch === "x64" && (os === "linux" || os === "win32")) return Object.freeze([]);
  return Object.freeze([
    Object.freeze({
      ...projectDiagnostic(PROJECT_CODES.bestEffort, "Project host is best-effort: " + label),
      severity: "warning" as const,
    }),
  ]);
}

/** Trusted private controls must reduce finite limits, never disable a production safeguard. */
function reducedLimits(controls: ProjectLoadControls): ProjectLimits {
  const limits = { ...DEFAULT_LIMITS, ...controls.limits };
  for (const name of [
    "manifestBytes",
    "sourceBytes",
    "totalBytes",
    "sourceFiles",
    "visitedEntries",
    "depth",
    "attempts",
  ] as const) {
    const value = limits[name];
    if (
      !Number.isInteger(value) ||
      value < (name === "attempts" ? 1 : 0) ||
      value > DEFAULT_LIMITS[name]
    )
      throw new RangeError("Invalid private project limit: " + name);
  }
  return Object.freeze(limits);
}

/** Validate invocation selections separately, without repairing an invalid manifest. */
function overrideDiagnostics(options: ProjectLoadOptions): readonly ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = [];
  if (options.target !== undefined && !PROFILES.includes(options.target))
    diagnostics.push(
      projectDiagnostic(
        PROJECT_CODES.profile,
        "Target profile '" +
          escapeDiagnosticText(options.target) +
          "' is not a complete qualified profile ID — choose one of: " +
          PROFILES.join(", "),
        null,
        "--target",
      ),
    );
  if (options.entry !== undefined && !validEntry(options.entry))
    diagnostics.push(
      projectDiagnostic(
        PROJECT_CODES.field,
        "Invalid project field '--entry': expected a qualified ASCII module identifier",
        null,
        "--entry",
      ),
    );
  return sortDiagnostics(diagnostics);
}

/** Canonical directory identity and output exclusion must survive complete revalidation. */
function samePaths(left: ProjectPaths, right: ProjectPaths): boolean {
  const sameDirectory = (a: ResolvedInput, b: ResolvedInput): boolean =>
    a.resolvedPath === b.resolvedPath && sameIdentity(a.metadata, b.metadata);
  return (
    left.root === right.root &&
    left.output === right.output &&
    sameDirectory(left.source, right.source) &&
    left.assets.length === right.assets.length &&
    left.assets.every((asset, index) => sameDirectory(asset, right.assets[index]!))
  );
}

/** Metadata and exact source names bind the initial and repeated inventories. */
function sameInventory(left: readonly ResolvedInput[], right: readonly ResolvedInput[]): boolean {
  return (
    left.length === right.length &&
    left.every((input, index) => {
      const next = right[index]!;
      return (
        input.sourceId === next.sourceId &&
        input.resolvedPath === next.resolvedPath &&
        sameMetadata(input.metadata, next.metadata)
      );
    })
  );
}

/** One bounded attempt remains private until manifest, paths, inventory and content agree twice. */
async function loadAttempt(
  options: ProjectLoadOptions,
  controls: ProjectLoadControls,
  limits: ProjectLimits,
  attempt: number,
): Promise<ProjectSnapshot> {
  const selection = await discoverProject(options);
  const context: LoadContext = {
    ...selection,
    attempt,
    limits,
    onCheckpoint: controls.onCheckpoint,
  };
  checkLimit("manifestBytes", limits.manifestBytes, Number(selection.manifest.metadata.size));
  checkLimit("totalBytes", limits.totalBytes, Number(selection.manifest.metadata.size));
  const manifestSource = await readInput(selection.manifest, context, true);
  const parsed = parseManifest(manifestSource.text, manifestSource.sourceId);
  if (parsed.kind === RESULT_KIND.failure) throw new ProjectFailure(parsed.diagnostics);
  const overrides = overrideDiagnostics(options);
  if (overrides.length > 0) throw new ProjectFailure(overrides);
  const manifest = parsed.manifest;
  await checkpoint(context, "after-manifest");
  const paths = await validatePaths(
    selection.logicalRoot,
    selection.root,
    manifest,
    manifestSource,
  );
  await checkpoint(context, "after-paths");
  const inventory = await inventorySources(paths, selection.manifest, limits);
  await checkpoint(context, "after-inventory");
  const sources: SourceRecord[] = [];
  let total = manifestSource.byteLength;
  for (const input of inventory) {
    checkLimit("sourceBytes", limits.sourceBytes, Number(input.metadata.size));
    checkLimit("totalBytes", limits.totalBytes, total + Number(input.metadata.size));
    const source = await readInput(input, context, false);
    total += source.byteLength;
    checkLimit("totalBytes", limits.totalBytes, total);
    sources.push(source);
  }
  await checkpoint(context, "before-revalidation");
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(selection.logicalRoot);
  } catch (error) {
    throwReadFailure(error, manifestSource.sourceId, true);
  }
  if (canonicalRoot !== selection.root) throw new ProjectChanged();
  const repeatedManifest = await readInput(selection.manifest, context, true, true);
  if (repeatedManifest.sha256 !== manifestSource.sha256) throw new ProjectChanged();
  const repeatedPaths = await validatePaths(
    selection.logicalRoot,
    selection.root,
    manifest,
    manifestSource,
    true,
  );
  if (!samePaths(paths, repeatedPaths)) throw new ProjectChanged();
  total = repeatedManifest.byteLength;
  for (let index = 0; index < inventory.length; index++) {
    const input = inventory[index]!;
    checkLimit("totalBytes", limits.totalBytes, total + Number(input.metadata.size));
    const repeated = await readInput(input, context, false, true);
    total += repeated.byteLength;
    checkLimit("totalBytes", limits.totalBytes, total);
    if (repeated.sha256 !== sources[index]!.sha256) throw new ProjectChanged();
  }
  // Inventory last so files added while rereading cannot disappear from the accepted set.
  let repeatedInventory: readonly ResolvedInput[];
  try {
    repeatedInventory = await inventorySources(repeatedPaths, selection.manifest, limits, true);
  } catch (error) {
    if (
      error instanceof ProjectFailure &&
      error.diagnostics.some((diagnostic) => diagnostic.code === PROJECT_CODES.empty)
    )
      throw new ProjectChanged();
    throw error;
  }
  await checkpoint(context, "after-revalidation-inventory");
  if (!sameInventory(inventory, repeatedInventory)) throw new ProjectChanged();
  // Check earlier handles' paths too: a later read may have overlapped an editor's write.
  await guardPath(selection.manifest, context);
  for (const input of inventory) await guardPath(input, context);
  const invocation = Object.freeze({
    target: options.target ?? null,
    entry: options.entry ?? null,
  });
  const encoding = JSON.stringify([
    "blend65-project-input-v1",
    [manifestSource.sourceId, manifestSource.sha256],
    sources.map((source) => [source.sourceId, source.sha256]),
    invocation.target,
    invocation.entry,
  ]);
  return Object.freeze({
    manifest,
    manifestSource,
    sources: Object.freeze(sources),
    inputSha256: createHash("sha256").update(encoding, "utf8").digest("hex"),
    projectRoot: selection.root,
    sourceRoot: paths.source.resolvedPath,
    assetPaths: Object.freeze(paths.assets.map((asset) => asset.resolvedPath)),
    outDir: paths.output,
    overrides: invocation,
    effectiveTarget: invocation.target ?? manifest.target,
    effectiveEntry: invocation.entry ?? manifest.entry,
  });
}

/**
 * Load a complete contained project with trusted private limits/checkpoints.
 * Expected host/input failures are values. Observed changes retry the whole attempt.
 * Callback and invalid private-control errors propagate; no output is created.
 */
export async function loadProjectWithControls(
  options: ProjectLoadOptions = {},
  controls: ProjectLoadControls = {},
): Promise<ProjectLoadResult> {
  const limits = reducedLimits(controls);
  let observations: readonly ProjectDiagnostic[];
  try {
    observations = hostObservations(
      Number(process.versions.node.split(".")[0]),
      process.platform,
      process.arch,
    );
  } catch (error) {
    if (!(error instanceof ProjectFailure)) throw error;
    return Object.freeze({ kind: RESULT_KIND.failure, diagnostics: error.diagnostics });
  }
  for (let attempt = 1; attempt <= limits.attempts; attempt++) {
    try {
      const snapshot = await loadAttempt(options, controls, limits, attempt);
      return Object.freeze({ kind: RESULT_KIND.success, snapshot, observations });
    } catch (error) {
      if (error instanceof ProjectChanged) continue;
      if (!(error instanceof ProjectFailure)) throw error;
      return Object.freeze({ kind: RESULT_KIND.failure, diagnostics: error.diagnostics });
    }
  }
  return Object.freeze({
    kind: RESULT_KIND.failure,
    diagnostics: Object.freeze([
      projectDiagnostic(
        PROJECT_CODES.changed,
        "Project inputs changed during loading; all " + limits.attempts + " attempts failed",
      ),
    ]),
  });
}
