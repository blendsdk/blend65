import type { BuildEvidence } from "./evidence-types.js";
import {
  areEvidenceStringsOrdered,
  hasExactEvidenceKeys,
  isEvidenceCount,
  isEvidenceHash,
  isEvidenceHex,
  isEvidenceOrdered,
  isEvidencePath,
  isEvidenceRecord,
  isEvidenceText,
} from "./evidence-validation.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const OPTIMIZATION = new Set(["none", "balanced", "speed", "size"]);
const ARTIFACT_KINDS = new Set([
  "primary",
  "assembly",
  "labels",
  "assets",
  "memory",
  "costs",
  "debug",
]);
const OVERRIDE_ORDER = [
  "target",
  "entry",
  "optimization",
  "boundsCheck",
  "divisionZeroCheck",
] as const;

/** Validate a path/size/hash record used by build inputs. */
function digest(value: unknown): value is { path: string; bytes: number; sha256: string } {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "bytes", "sha256"]) &&
    isEvidencePath(value.path) &&
    isEvidenceCount(value.bytes) &&
    isEvidenceHash(value.sha256)
  );
}

/** Validate a portable content identity used by build inputs. */
function identity(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["name", "version", "sha256"]) &&
    isEvidenceText(value.name) &&
    isEvidenceText(value.version) &&
    isEvidenceHash(value.sha256)
  );
}

/** Validate a source location retained by a disk-component call record. */
function sourceSite(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "startByte", "endByte"]) &&
    isEvidencePath(value.path) &&
    isEvidenceCount(value.startByte) &&
    isEvidenceCount(value.endByte) &&
    value.startByte <= value.endByte
  );
}

/** Validate one exact CLI override and its tag-dependent value type. */
function override(value: unknown): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, ["name", "value"]) ||
    !OVERRIDE_ORDER.includes(value.name as (typeof OVERRIDE_ORDER)[number])
  ) {
    return false;
  }
  if (value.name === "boundsCheck" || value.name === "divisionZeroCheck") {
    return typeof value.value === "boolean";
  }
  if (value.name === "optimization") return OPTIMIZATION.has(String(value.value));
  return isEvidenceText(value.value);
}

/** Validate one disk component source union. */
function componentSource(value: unknown): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "input") {
    return (
      hasExactEvidenceKeys(value, ["kind", "path", "sha256"]) &&
      isEvidencePath(value.path) &&
      isEvidenceHash(value.sha256)
    );
  }
  return (
    value.kind === "generated" &&
    hasExactEvidenceKeys(value, ["kind", "identity", "sha256"]) &&
    isEvidenceText(value.identity) &&
    isEvidenceHash(value.sha256)
  );
}

/** Validate one exact ordered D64 component record. */
function diskComponent(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, [
      "id",
      "logicalSha256",
      "source",
      "outputSha256",
      "directoryNamePetsciiHex",
      "fileType",
      "loadAddress",
      "startTrack",
      "startSector",
      "endTrack",
      "endSector",
      "blocks",
      "bytes",
      "destinationCalls",
      "aliases",
    ]) &&
    isEvidenceText(value.id) &&
    isEvidenceHash(value.logicalSha256) &&
    componentSource(value.source) &&
    isEvidenceHash(value.outputSha256) &&
    isEvidenceHex(value.directoryNamePetsciiHex) &&
    value.directoryNamePetsciiHex.length > 0 &&
    value.fileType === "PRG" &&
    isEvidenceCount(value.loadAddress) &&
    value.loadAddress <= 0xffff &&
    isEvidenceCount(value.startTrack) &&
    isEvidenceCount(value.startSector) &&
    isEvidenceCount(value.endTrack) &&
    isEvidenceCount(value.endSector) &&
    isEvidenceCount(value.blocks) &&
    isEvidenceCount(value.bytes) &&
    Array.isArray(value.destinationCalls) &&
    value.destinationCalls.every(sourceSite) &&
    areEvidenceStringsOrdered(value.aliases)
  );
}

/** Validate the selected PRG or D64 package contract against published artifacts. */
function packageValue(value: unknown, artifacts: readonly Record<string, unknown>[]): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "prg") {
    if (
      !hasExactEvidenceKeys(value, ["kind", "artifactPath", "loadAddress", "endAddress"]) ||
      !isEvidencePath(value.artifactPath) ||
      !isEvidenceCount(value.loadAddress) ||
      !isEvidenceCount(value.endAddress) ||
      value.loadAddress > value.endAddress ||
      value.endAddress > 0x10000
    ) {
      return false;
    }
  } else if (value.kind === "d64") {
    if (
      !hasExactEvidenceKeys(value, [
        "kind",
        "artifactPath",
        "imageBytes",
        "dosType",
        "diskLabelPetsciiHex",
        "diskIdPetsciiHex",
        "bamSha256",
        "directorySha256",
        "allocationPolicyId",
        "freeBlocks",
        "bootComponentId",
        "components",
      ]) ||
      !isEvidencePath(value.artifactPath) ||
      value.imageBytes !== 174848 ||
      value.dosType !== "2A" ||
      !isEvidenceHex(value.diskLabelPetsciiHex) ||
      !isEvidenceHex(value.diskIdPetsciiHex) ||
      !isEvidenceHash(value.bamSha256) ||
      !isEvidenceHash(value.directorySha256) ||
      !isEvidenceText(value.allocationPolicyId) ||
      !isEvidenceCount(value.freeBlocks) ||
      !isEvidenceText(value.bootComponentId) ||
      !Array.isArray(value.components) ||
      value.components.length === 0 ||
      !value.components.every(diskComponent)
    ) {
      return false;
    }
    const components = value.components as Record<string, unknown>[];
    if (
      new Set(components.map(({ id }) => id)).size !== components.length ||
      new Set(components.map(({ directoryNamePetsciiHex }) => directoryNamePetsciiHex)).size !==
        components.length ||
      new Set(components.map(({ startTrack, startSector }) => `${startTrack}:${startSector}`))
        .size !== components.length ||
      components.filter(({ id }) => id === value.bootComponentId).length !== 1
    ) {
      return false;
    }
  } else {
    return false;
  }
  return artifacts.some(
    (artifact) => artifact.kind === "primary" && artifact.path === value.artifactPath,
  );
}

/** Validate the complete closed build-evidence version-1 value. */
export function buildEvidenceValue(value: unknown): value is BuildEvidence {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, [
      "kind",
      "schemaVersion",
      "generationId",
      "semanticInputs",
      "portableTools",
      "hostProvenance",
      "package",
      "artifacts",
    ]) ||
    value.kind !== "blend65.build" ||
    value.schemaVersion !== 1 ||
    typeof value.generationId !== "string" ||
    !UUID_V4.test(value.generationId) ||
    !isEvidenceRecord(value.semanticInputs) ||
    !Array.isArray(value.portableTools) ||
    !isEvidenceRecord(value.hostProvenance) ||
    !Array.isArray(value.artifacts)
  ) {
    return false;
  }

  const semantic = value.semanticInputs;
  if (
    !hasExactEvidenceKeys(semantic, [
      "projectName",
      "sourceRoot",
      "entryModule",
      "assetSearchPaths",
      "manifest",
      "sources",
      "assets",
      "compiler",
      "specification",
      "expertSkill",
      "target",
      "options",
      "overrides",
    ]) ||
    !isEvidenceText(semantic.projectName) ||
    !isEvidencePath(semantic.sourceRoot) ||
    !isEvidenceText(semantic.entryModule) ||
    !Array.isArray(semantic.assetSearchPaths) ||
    !semantic.assetSearchPaths.every(isEvidencePath) ||
    !digest(semantic.manifest) ||
    !Array.isArray(semantic.sources) ||
    !semantic.sources.every(digest) ||
    !isEvidenceOrdered(semantic.sources, ({ path, sha256 }) => `${path}\0${sha256}`) ||
    !Array.isArray(semantic.assets) ||
    !semantic.assets.every(digest) ||
    !isEvidenceOrdered(semantic.assets, ({ path, sha256 }) => `${path}\0${sha256}`) ||
    !identity(semantic.compiler) ||
    !identity(semantic.specification) ||
    !identity(semantic.expertSkill) ||
    !isEvidenceRecord(semantic.target) ||
    !hasExactEvidenceKeys(semantic.target, ["profileId", "cpuId", "emitterId", "packagerId"]) ||
    !Object.values(semantic.target).every(isEvidenceText) ||
    !isEvidenceRecord(semantic.options) ||
    !hasExactEvidenceKeys(semantic.options, ["optimization", "boundsCheck", "divisionZeroCheck"]) ||
    !OPTIMIZATION.has(String(semantic.options.optimization)) ||
    typeof semantic.options.boundsCheck !== "boolean" ||
    typeof semantic.options.divisionZeroCheck !== "boolean" ||
    !Array.isArray(semantic.overrides) ||
    !semantic.overrides.every(override)
  ) {
    return false;
  }
  const overrideIndexes = semantic.overrides.map((item) =>
    OVERRIDE_ORDER.indexOf(
      (item as Record<string, unknown>).name as (typeof OVERRIDE_ORDER)[number],
    ),
  );
  if (
    overrideIndexes.some(
      (index, position) => position > 0 && index <= overrideIndexes[position - 1]!,
    )
  ) {
    return false;
  }

  if (
    !value.portableTools.every(
      (tool) =>
        isEvidenceRecord(tool) &&
        hasExactEvidenceKeys(tool, ["name", "version", "semanticOptions"]) &&
        isEvidenceText(tool.name) &&
        isEvidenceText(tool.version) &&
        Array.isArray(tool.semanticOptions) &&
        tool.semanticOptions.every(isEvidenceText),
    ) ||
    !isEvidenceOrdered(
      value.portableTools as Record<string, unknown>[],
      (tool) => `${String(tool.name)}\0${String(tool.version)}`,
    )
  ) {
    return false;
  }

  const host = value.hostProvenance;
  if (
    !hasExactEvidenceKeys(host, [
      "platform",
      "architecture",
      "nodeVersion",
      "tools",
      "durationMilliseconds",
      "peakRssBytes",
    ]) ||
    (host.platform !== "linux" && host.platform !== "win32") ||
    host.architecture !== "x64" ||
    !isEvidenceText(host.nodeVersion) ||
    !Array.isArray(host.tools) ||
    !host.tools.every(
      (tool) =>
        isEvidenceRecord(tool) &&
        hasExactEvidenceKeys(tool, ["name", "canonicalPath", "sha256"]) &&
        isEvidenceText(tool.name) &&
        isEvidenceText(tool.canonicalPath) &&
        isEvidenceHash(tool.sha256),
    ) ||
    !isEvidenceOrdered(
      host.tools as Record<string, unknown>[],
      (tool) => `${String(tool.name)}\0${String(tool.canonicalPath)}`,
    ) ||
    !(isEvidenceCount(host.durationMilliseconds) || host.durationMilliseconds === "Unknown") ||
    !(isEvidenceCount(host.peakRssBytes) || host.peakRssBytes === "Unknown")
  ) {
    return false;
  }

  const artifacts = value.artifacts;
  if (
    !artifacts.every(
      (artifact) =>
        isEvidenceRecord(artifact) &&
        hasExactEvidenceKeys(artifact, ["path", "kind", "bytes", "sha256"]) &&
        isEvidencePath(artifact.path) &&
        artifact.path !== ".build.json" &&
        ARTIFACT_KINDS.has(String(artifact.kind)) &&
        isEvidenceCount(artifact.bytes) &&
        isEvidenceHash(artifact.sha256),
    ) ||
    !isEvidenceOrdered(artifacts as Record<string, unknown>[], (artifact) =>
      String(artifact.path),
    ) ||
    new Set(artifacts.map((artifact) => (artifact as Record<string, unknown>).kind)).size !==
      artifacts.length
  ) {
    return false;
  }
  return packageValue(value.package, artifacts as Record<string, unknown>[]);
}
