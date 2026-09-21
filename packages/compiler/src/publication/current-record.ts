import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  validateAssetsEvidence,
  validateBuildEvidence,
  validateCostsEvidence,
  validateDebugEvidence,
  validateMemoryEvidence,
} from "../artifacts/evidence.js";
import { canonicalEvidenceJson } from "../artifacts/evidence-validation.js";
import type { ProjectSnapshot } from "../project/types.js";
import { identifyPublicationRoot } from "./lock.js";
import { sidecarReferencesAgree } from "./sidecar-consistency.js";
import type {
  PublicationControls,
  PublicationLookupResult,
  PublishedFileExpectation,
  PublishedGeneration,
} from "./publication.js";

const HASH = /^[0-9a-f]{64}$/u;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** Native identity and stable metadata for one ordinary filesystem object. */
export interface PublicationFileIdentity {
  /** Device containing the object. */
  readonly device: bigint;
  /** Inode identity within the device. */
  readonly inode: bigint;
  /** Exact byte size captured during validation. */
  readonly size: bigint;
  /** Nanosecond modification timestamp captured during validation. */
  readonly modified: bigint;
}

/** Stable ordinary-file bytes plus native identity. */
export interface IdentifiedPublicationFile {
  /** Bytes read between matching metadata observations. */
  readonly bytes: Uint8Array;
  /** Native identity retained until the authorizing mutation. */
  readonly identity: PublicationFileIdentity;
}

/** Full validated generation plus every identity needed before rename or deletion. */
export interface IdentifiedGeneration {
  /** Public immutable generation facts. */
  readonly generation: PublishedGeneration;
  /** Directory device/inode identity. */
  readonly directoryIdentity: Pick<PublicationFileIdentity, "device" | "inode">;
  /** Exact bytes and identities of all eight ordinary files. */
  readonly files: ReadonlyMap<string, IdentifiedPublicationFile>;
}

/** Canonical current-record value stored outside immutable generations. */
export interface CurrentGenerationRecord {
  /** Current-record schema major. */
  readonly schemaVersion: 1;
  /** Canonical immutable generation identity. */
  readonly generationId: string;
  /** SHA-256 of that generation's build sidecar. */
  readonly buildJsonSha256: string;
}

/** Encode the one canonical current-record byte spelling. */
export function encodeCurrentRecord(record: CurrentGenerationRecord): Uint8Array {
  return Buffer.from(
    `{"buildJsonSha256":${JSON.stringify(record.buildJsonSha256)},"generationId":${JSON.stringify(record.generationId)},"schemaVersion":1}\n`,
    "utf8",
  );
}

/** Parse canonical current bytes without accepting extensions or alternate encodings. */
export function parseCurrentRecord(bytes: Uint8Array): CurrentGenerationRecord | null {
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value: unknown = JSON.parse(source);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).sort().join("\0") !==
        ["buildJsonSha256", "generationId", "schemaVersion"].sort().join("\0") ||
      record.schemaVersion !== 1 ||
      typeof record.generationId !== "string" ||
      !UUID_V4.test(record.generationId) ||
      typeof record.buildJsonSha256 !== "string" ||
      !HASH.test(record.buildJsonSha256)
    ) {
      return null;
    }
    const parsed = Object.freeze({
      schemaVersion: 1 as const,
      generationId: record.generationId,
      buildJsonSha256: record.buildJsonSha256,
    });
    return source === new TextDecoder().decode(encodeCurrentRecord(parsed)) ? parsed : null;
  } catch {
    return null;
  }
}

/** Read one ordinary file and prove it retained its filesystem identity. */
export async function identifyPublicationFile(
  path: string,
): Promise<IdentifiedPublicationFile | null> {
  try {
    const before = await lstat(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) return null;
    const bytes = await readFile(path);
    const after = await lstat(path, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs
    )
      return null;
    return Object.freeze({
      bytes,
      identity: Object.freeze({
        device: before.dev,
        inode: before.ino,
        size: before.size,
        modified: before.mtimeNs,
      }),
    });
  } catch {
    return null;
  }
}

/** Recheck one exact ordinary-file identity without following symbolic links. */
export async function publicationFileMatches(
  path: string,
  identity: PublicationFileIdentity,
): Promise<boolean> {
  try {
    const metadata = await lstat(path, { bigint: true });
    return (
      metadata.isFile() &&
      !metadata.isSymbolicLink() &&
      metadata.dev === identity.device &&
      metadata.ino === identity.inode &&
      metadata.size === identity.size &&
      metadata.mtimeNs === identity.modified
    );
  } catch {
    return false;
  }
}

/** Re-read one file and require both its retained identity and exact expected bytes. */
export async function publicationFileContentMatches(
  path: string,
  identified: IdentifiedPublicationFile,
  expectedBytes: Uint8Array,
): Promise<boolean> {
  const current = await identifyPublicationFile(path);
  return (
    current !== null &&
    current.identity.device === identified.identity.device &&
    current.identity.inode === identified.identity.inode &&
    current.identity.size === identified.identity.size &&
    current.identity.modified === identified.identity.modified &&
    Buffer.from(current.bytes).equals(Buffer.from(expectedBytes))
  );
}

/** Compare two JSON-safe values through their already canonical evidence spelling. */
function sameValue(left: unknown, right: unknown): boolean {
  return canonicalEvidenceJson(left) === canonicalEvidenceJson(right);
}

/** Return whether build evidence describes the supplied immutable project snapshot. */
function buildMatchesSnapshot(
  build: Extract<ReturnType<typeof validateBuildEvidence>, { readonly kind: "complete" }>["value"],
  snapshot: ProjectSnapshot,
): boolean {
  const semantic = build.semanticInputs;
  const expectedOverrides: { readonly name: "target" | "entry"; readonly value: string }[] = [];
  if (
    snapshot.overrides.target !== null &&
    snapshot.overrides.target !== snapshot.manifest.target
  ) {
    expectedOverrides.push({ name: "target", value: snapshot.overrides.target });
  }
  if (snapshot.overrides.entry !== null && snapshot.overrides.entry !== snapshot.manifest.entry) {
    expectedOverrides.push({ name: "entry", value: snapshot.overrides.entry });
  }
  return (
    semantic.projectName === snapshot.manifest.name &&
    semantic.sourceRoot === snapshot.manifest.sourceRoot &&
    semantic.entryModule === snapshot.effectiveEntry &&
    sameValue(semantic.assetSearchPaths, snapshot.manifest.assetPaths) &&
    semantic.manifest.path === snapshot.manifestSource.sourceId &&
    semantic.manifest.bytes === snapshot.manifestSource.byteLength &&
    semantic.manifest.sha256 === snapshot.manifestSource.sha256 &&
    semantic.sources.length === snapshot.sources.length &&
    semantic.sources.every((source, index) => {
      const expected = snapshot.sources[index];
      return (
        expected !== undefined &&
        source.path === expected.sourceId &&
        source.bytes === expected.byteLength &&
        source.sha256 === expected.sha256
      );
    }) &&
    semantic.target.profileId === snapshot.effectiveTarget &&
    semantic.options.optimization === snapshot.manifest.optimization &&
    semantic.options.boundsCheck === snapshot.manifest.boundsCheck &&
    semantic.options.divisionZeroCheck === snapshot.manifest.divisionZeroCheck &&
    sameValue(semantic.overrides, expectedOverrides)
  );
}

/** Validate exact artifact names, roles and sidecar relationships. */
function evidenceAgrees(
  build: Extract<ReturnType<typeof validateBuildEvidence>, { readonly kind: "complete" }>["value"],
  files: ReadonlyMap<string, IdentifiedPublicationFile>,
): boolean {
  const rolePaths = new Map(build.artifacts.map(({ kind, path }) => [kind, path] as const));
  const requiredRoles = [
    "primary",
    "assembly",
    "labels",
    "assets",
    "memory",
    "costs",
    "debug",
  ] as const;
  if (
    rolePaths.size !== requiredRoles.length ||
    requiredRoles.some((role) => !rolePaths.has(role)) ||
    rolePaths.get("assembly") !== ".asm" ||
    rolePaths.get("labels") !== ".labels" ||
    rolePaths.get("assets") !== ".assets.json" ||
    rolePaths.get("memory") !== ".memory.json" ||
    rolePaths.get("costs") !== ".costs.json" ||
    rolePaths.get("debug") !== ".debug.json"
  ) {
    return false;
  }
  const primary = build.artifacts.find(({ kind }) => kind === "primary");
  if (primary === undefined || !primary.path.endsWith(".prg")) return false;
  const assets = validateAssetsEvidence(files.get(".assets.json")!.bytes);
  const memory = validateMemoryEvidence(files.get(".memory.json")!.bytes);
  const costs = validateCostsEvidence(files.get(".costs.json")!.bytes);
  const debug = validateDebugEvidence(files.get(".debug.json")!.bytes);
  if (
    assets.kind !== "complete" ||
    memory.kind !== "complete" ||
    costs.kind !== "complete" ||
    debug.kind !== "complete"
  ) {
    return false;
  }
  const primaryBytes = files.get(primary.path)?.bytes;
  const packageValue = build.package;
  const debugSources = debug.value.sources as readonly Record<string, unknown>[];
  const debugAssets = debug.value.assets as readonly Record<string, unknown>[];
  const selectedAssetInputs = (assets.value.assets as readonly Record<string, unknown>[])
    .flatMap((asset) => asset.inputs as readonly Record<string, unknown>[])
    .map((input) => ({ path: input.path, bytes: input.bytes, sha256: input.sha256 }))
    .sort((left, right) =>
      Buffer.compare(
        Buffer.from(`${String(left.path)}\0${String(left.sha256)}`),
        Buffer.from(`${String(right.path)}\0${String(right.sha256)}`),
      ),
    );
  const semanticAssets = build.semanticInputs.assets.map(({ path, bytes, sha256 }) => ({
    path,
    bytes,
    sha256,
  }));
  const loadAddress =
    primaryBytes === undefined || primaryBytes.byteLength < 2
      ? -1
      : primaryBytes[0]! | (primaryBytes[1]! << 8);
  return (
    primaryBytes !== undefined &&
    packageValue.kind === "prg" &&
    packageValue.artifactPath === primary.path &&
    packageValue.loadAddress === loadAddress &&
    packageValue.endAddress === loadAddress + primaryBytes.byteLength - 2 &&
    sameValue(selectedAssetInputs, semanticAssets) &&
    sidecarReferencesAgree(build, assets.value, memory.value, costs.value, debug.value) &&
    memory.value.profileId === build.semanticInputs.target.profileId &&
    costs.value.mode === build.semanticInputs.options.optimization &&
    costs.value.totals.programBytes === Math.max(0, primaryBytes.byteLength - 2) &&
    debug.value.profileId === build.semanticInputs.target.profileId &&
    debug.value.cpuId === build.semanticInputs.target.cpuId &&
    debug.value.optimization === build.semanticInputs.options.optimization &&
    debug.value.safety.boundsCheck === build.semanticInputs.options.boundsCheck &&
    debug.value.safety.divisionZeroCheck === build.semanticInputs.options.divisionZeroCheck &&
    debug.value.primaryArtifact.path === primary.path &&
    debug.value.primaryArtifact.kind === primary.kind &&
    debug.value.primaryArtifact.sha256 === primary.sha256 &&
    sameValue(debug.value.compiler, build.semanticInputs.compiler) &&
    sameValue(debug.value.specification, build.semanticInputs.specification) &&
    sameValue(debug.value.expertSkill, build.semanticInputs.expertSkill) &&
    sameValue(debug.value.tools, build.portableTools) &&
    sameValue(
      debugSources.map(({ path, byteLength, sha256 }) => ({ path, bytes: byteLength, sha256 })),
      build.semanticInputs.sources,
    ) &&
    sameValue(
      debugAssets.map(({ path, sha256 }) => ({ path, sha256 })),
      build.semanticInputs.assets.map(({ path, sha256 }) => ({ path, sha256 })),
    )
  );
}

/** Validate an exact eight-file directory and retain every native identity. */
export async function identifyGenerationDirectory(
  directory: string,
  generationId: string,
  buildJsonSha256: string,
  expectedFiles?: readonly PublishedFileExpectation[],
  snapshot?: ProjectSnapshot,
): Promise<IdentifiedGeneration | null> {
  try {
    const metadata = await lstat(directory, { bigint: true });
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const names = (await readdir(directory)).sort();
    if (names.length !== 8 || !names.includes(".build.json")) return null;
    if (expectedFiles !== undefined) {
      const expectedNames = expectedFiles.map(({ path }) => path).sort();
      if (names.join("\0") !== expectedNames.join("\0")) return null;
    }
    const found = await Promise.all(
      names.map(
        async (name) => [name, await identifyPublicationFile(join(directory, name))] as const,
      ),
    );
    if (found.some(([, file]) => file === null)) return null;
    const identities = new Set(
      found.map(([, file]) => `${file!.identity.device}:${file!.identity.inode}`),
    );
    if (identities.size !== found.length) return null;
    const files = new Map(found.map(([name, file]) => [name, file!] as const));
    const buildBytes = files.get(".build.json")!.bytes;
    if (createHash("sha256").update(buildBytes).digest("hex") !== buildJsonSha256) return null;
    const build = validateBuildEvidence(buildBytes);
    if (
      build.kind !== "complete" ||
      build.value.generationId !== generationId ||
      build.value.artifacts.length !== 7 ||
      (snapshot !== undefined && !buildMatchesSnapshot(build.value, snapshot))
    )
      return null;
    for (const artifact of build.value.artifacts) {
      const file = files.get(artifact.path);
      if (
        file === undefined ||
        file.bytes.byteLength !== artifact.bytes ||
        createHash("sha256").update(file.bytes).digest("hex") !== artifact.sha256
      )
        return null;
    }
    if (!evidenceAgrees(build.value, files)) return null;
    if (expectedFiles !== undefined) {
      for (const expected of expectedFiles) {
        const file = files.get(expected.path);
        if (
          file === undefined ||
          file.bytes.byteLength !== expected.bytes ||
          createHash("sha256").update(file.bytes).digest("hex") !== expected.sha256
        )
          return null;
      }
    }
    const primary = build.value.artifacts.find(({ kind }) => kind === "primary");
    if (primary === undefined) return null;
    return Object.freeze({
      generation: Object.freeze({
        generationId,
        directory,
        buildJsonSha256,
        primaryArtifact: primary.path,
      }),
      directoryIdentity: Object.freeze({ device: metadata.dev, inode: metadata.ino }),
      files,
    });
  } catch {
    return null;
  }
}

/** Recheck a generation directory and all eight files immediately before mutation. */
export async function generationIdentityMatches(
  identified: IdentifiedGeneration,
  directory = identified.generation.directory,
): Promise<boolean> {
  try {
    const metadata = await lstat(directory, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.dev !== identified.directoryIdentity.device ||
      metadata.ino !== identified.directoryIdentity.inode
    ) {
      return false;
    }
    const names = (await readdir(directory)).sort();
    if (names.join("\0") !== [...identified.files.keys()].sort().join("\0")) return false;
    const checks = await Promise.all(
      [...identified.files].map(([name, file]) =>
        publicationFileContentMatches(join(directory, name), file, file.bytes),
      ),
    );
    return checks.every(Boolean);
  } catch {
    return false;
  }
}

/** Validate an exact generation and return its public facts. */
export async function validateGenerationDirectory(
  directory: string,
  generationId: string,
  buildJsonSha256: string,
  expectedFiles?: readonly PublishedFileExpectation[],
  snapshot?: ProjectSnapshot,
): Promise<PublishedGeneration | null> {
  const identified = await identifyGenerationDirectory(
    directory,
    generationId,
    buildJsonSha256,
    expectedFiles,
    snapshot,
  );
  return identified?.generation ?? null;
}

/** Read and verify current, optionally binding its build inputs to the caller's live snapshot. */
async function readCurrentGenerationRecord(
  snapshot: ProjectSnapshot,
  bindSnapshot: boolean,
): Promise<PublicationLookupResult> {
  const root = await identifyPublicationRoot(snapshot);
  if (root === null)
    return Object.freeze({
      kind: "error",
      reason: "invalid-path",
      diagnostic: "The current publication root is invalid",
    });
  const current = await identifyPublicationFile(join(root.outputRoot, "current.json"));
  if (current === null)
    return Object.freeze({
      kind: "error",
      reason: "current",
      diagnostic: "The current record is missing or not an ordinary stable file",
    });
  const record = parseCurrentRecord(current.bytes);
  if (record === null)
    return Object.freeze({
      kind: "error",
      reason: "current",
      diagnostic: "The current record is malformed or noncanonical",
    });
  const generation = await validateGenerationDirectory(
    join(root.outputRoot, record.generationId),
    record.generationId,
    record.buildJsonSha256,
    undefined,
    bindSnapshot ? snapshot : undefined,
  );
  return generation === null
    ? Object.freeze({
        kind: "error",
        reason: "current",
        diagnostic: "The current generation does not match its record",
      })
    : Object.freeze({ kind: "complete", generation });
}

/** Read current for a build/run request and require its evidence to match that project snapshot. */
export async function readCurrentGeneration(
  snapshot: ProjectSnapshot,
  _controls?: PublicationControls,
): Promise<PublicationLookupResult> {
  return readCurrentGenerationRecord(snapshot, true);
}

/** Read current under the publication lock without requiring obsolete inputs to match a new build. */
export async function readCurrentGenerationForMutation(
  snapshot: ProjectSnapshot,
): Promise<PublicationLookupResult> {
  return readCurrentGenerationRecord(snapshot, false);
}
