import type { BuildEvidence } from "./evidence-types.js";
import type { EvidenceFieldFailure } from "./evidence-diagnostics.js";
import {
  areEvidenceStringsOrdered,
  evidenceItems,
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
function digest(
  value: unknown,
  invalid?: EvidenceFieldFailure,
): value is { path: string; bytes: number; sha256: string } {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "bytes", "sha256"]) &&
    isEvidencePath(value.path, invalid, ["path"]) &&
    isEvidenceCount(value.bytes, invalid, ["bytes"]) &&
    isEvidenceHash(value.sha256, invalid, ["sha256"])
  );
}

/** Validate a portable content identity used by build inputs. */
function identity(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["name", "version", "sha256"]) &&
    isEvidenceText(value.name, invalid, ["name"]) &&
    isEvidenceText(value.version, invalid, ["version"]) &&
    isEvidenceHash(value.sha256, invalid, ["sha256"])
  );
}

/** Validate a source location retained by a disk-component call record. */
function sourceSite(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "startByte", "endByte"]) &&
    isEvidencePath(value.path, invalid, ["path"]) &&
    isEvidenceCount(value.startByte, invalid, ["startByte"]) &&
    isEvidenceCount(value.endByte, invalid, ["endByte"]) &&
    value.startByte <= value.endByte
  );
}

/** Validate one exact CLI override and its tag-dependent value type. */
function override(value: unknown, invalid?: EvidenceFieldFailure): boolean {
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
  return isEvidenceText(value.value, invalid, ["value"]);
}

/** Validate one disk component source union. */
function componentSource(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "input") {
    return (
      hasExactEvidenceKeys(value, ["kind", "path", "sha256"]) &&
      isEvidencePath(value.path, invalid, ["path"]) &&
      isEvidenceHash(value.sha256, invalid, ["sha256"])
    );
  }
  return (
    value.kind === "generated" &&
    hasExactEvidenceKeys(value, ["kind", "identity", "sha256"]) &&
    isEvidenceText(value.identity, invalid, ["identity"]) &&
    isEvidenceHash(value.sha256, invalid, ["sha256"])
  );
}

/** Validate one exact ordered D64 component record. */
function diskComponent(value: unknown, invalid?: EvidenceFieldFailure): boolean {
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
    isEvidenceText(value.id, invalid, ["id"]) &&
    isEvidenceHash(value.logicalSha256, invalid, ["logicalSha256"]) &&
    componentSource(value.source, (path, detail) => invalid?.(["source", ...path], detail)) &&
    isEvidenceHash(value.outputSha256, invalid, ["outputSha256"]) &&
    isEvidenceHex(value.directoryNamePetsciiHex, invalid, ["directoryNamePetsciiHex"]) &&
    value.directoryNamePetsciiHex.length > 0 &&
    value.fileType === "PRG" &&
    isEvidenceCount(value.loadAddress, invalid, ["loadAddress"]) &&
    value.loadAddress <= 0xffff &&
    isEvidenceCount(value.startTrack, invalid, ["startTrack"]) &&
    isEvidenceCount(value.startSector, invalid, ["startSector"]) &&
    isEvidenceCount(value.endTrack, invalid, ["endTrack"]) &&
    isEvidenceCount(value.endSector, invalid, ["endSector"]) &&
    isEvidenceCount(value.blocks, invalid, ["blocks"]) &&
    isEvidenceCount(value.bytes, invalid, ["bytes"]) &&
    Array.isArray(value.destinationCalls) &&
    value.destinationCalls.every((item, index) =>
      sourceSite(item, (path, detail) => invalid?.(["destinationCalls", index, ...path], detail)),
    ) &&
    areEvidenceStringsOrdered(value.aliases)
  );
}

/** Validate the selected PRG or D64 package contract against published artifacts. */
function packageValue(
  value: unknown,
  artifacts: readonly Record<string, unknown>[],
  invalid?: EvidenceFieldFailure,
): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "prg") {
    if (
      !hasExactEvidenceKeys(value, ["kind", "artifactPath", "loadAddress", "endAddress"]) ||
      !isEvidencePath(value.artifactPath, invalid, ["artifactPath"]) ||
      !isEvidenceCount(value.loadAddress, invalid, ["loadAddress"]) ||
      !isEvidenceCount(value.endAddress, invalid, ["endAddress"]) ||
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
      !isEvidencePath(value.artifactPath, invalid, ["artifactPath"]) ||
      value.imageBytes !== 174848 ||
      value.dosType !== "2A" ||
      !isEvidenceHex(value.diskLabelPetsciiHex, invalid, ["diskLabelPetsciiHex"]) ||
      !isEvidenceHex(value.diskIdPetsciiHex, invalid, ["diskIdPetsciiHex"]) ||
      !isEvidenceHash(value.bamSha256, invalid, ["bamSha256"]) ||
      !isEvidenceHash(value.directorySha256, invalid, ["directorySha256"]) ||
      !isEvidenceText(value.allocationPolicyId, invalid, ["allocationPolicyId"]) ||
      !isEvidenceCount(value.freeBlocks, invalid, ["freeBlocks"]) ||
      !isEvidenceText(value.bootComponentId, invalid, ["bootComponentId"]) ||
      !Array.isArray(value.components) ||
      value.components.length === 0 ||
      !value.components.every((item, index) =>
        diskComponent(item, (path, detail) => invalid?.(["components", index, ...path], detail)),
      )
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
export function buildEvidenceValue(
  value: unknown,
  invalid?: EvidenceFieldFailure,
): value is BuildEvidence {
  if (!isEvidenceRecord(value)) {
    invalid?.([], "record must be an object record");
    return false;
  }
  if (
    !hasExactEvidenceKeys(value, [
      "kind",
      "schemaVersion",
      "generationId",
      "semanticInputs",
      "portableTools",
      "hostProvenance",
      "package",
      "artifacts",
    ])
  ) {
    invalid?.([], "record must contain exactly its required and optional fields");
    return false;
  }
  if (value.kind !== "blend65.build") {
    invalid?.(["kind"], "kind must identify this artifact family");
    return false;
  }
  if (value.schemaVersion !== 1) {
    invalid?.(["schemaVersion"], "schemaVersion must equal 1");
    return false;
  }
  if (typeof value.generationId !== "string") {
    invalid?.(["generationId"], "generationId has an invalid primitive type");
    return false;
  }
  if (!UUID_V4.test(value.generationId)) {
    invalid?.(["generationId"], "generationId must be a lowercase version-4 UUID");
    return false;
  }
  if (!isEvidenceRecord(value.semanticInputs)) {
    invalid?.(["semanticInputs"], "semanticInputs must be an object record");
    return false;
  }
  if (!Array.isArray(value.portableTools)) {
    invalid?.(["portableTools"], "portableTools must be an array of valid records");
    return false;
  }
  if (!isEvidenceRecord(value.hostProvenance)) {
    invalid?.(["hostProvenance"], "hostProvenance must be an object record");
    return false;
  }
  if (
    !evidenceItems(
      value.artifacts,
      () => true,
      invalid,
      ["artifacts"],
      "expected an artifact record",
    )
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
    ])
  ) {
    invalid?.(
      ["semanticInputs"],
      "semanticInputs must contain exactly its required and optional fields",
    );
    return false;
  }
  if (!isEvidenceText(semantic.projectName, invalid, ["semanticInputs", "projectName"])) {
    invalid?.(
      ["semanticInputs", "projectName"],
      "semanticInputs.projectName must contain nonempty text",
    );
    return false;
  }
  if (!isEvidencePath(semantic.sourceRoot)) {
    invalid?.(
      ["semanticInputs", "sourceRoot"],
      "semanticInputs.sourceRoot must be a contained portable relative path",
    );
    return false;
  }
  if (!isEvidenceText(semantic.entryModule, invalid, ["semanticInputs", "entryModule"])) {
    invalid?.(
      ["semanticInputs", "entryModule"],
      "semanticInputs.entryModule must contain nonempty text",
    );
    return false;
  }
  if (!Array.isArray(semantic.assetSearchPaths)) {
    invalid?.(
      ["semanticInputs", "assetSearchPaths"],
      "semanticInputs.assetSearchPaths must be an array of valid records",
    );
    return false;
  }
  if (
    !semantic.assetSearchPaths.every((path, index) =>
      isEvidencePath(path, invalid, ["semanticInputs", "assetSearchPaths", index]),
    )
  ) {
    invalid?.(
      ["semanticInputs", "assetSearchPaths"],
      "semanticInputs.assetSearchPaths must be a contained portable relative path",
    );
    return false;
  }
  if (
    !digest(semantic.manifest, (path, detail) =>
      invalid?.(["semanticInputs", "manifest", ...path], detail),
    )
  ) {
    invalid?.(
      ["semanticInputs", "manifest"],
      "semanticInputs.manifest must contain path, nonnegative byte count and SHA-256",
    );
    return false;
  }
  if (
    !evidenceItems(
      semantic.sources,
      (item, _index, report) => digest(item, report),
      invalid,
      ["semanticInputs", "sources"],
      "expected a source record with path, byte count and SHA-256",
    )
  ) {
    return false;
  }
  if (!isEvidenceOrdered(semantic.sources, ({ path, sha256 }) => `${path}\0${sha256}`)) {
    invalid?.(
      ["semanticInputs", "sources"],
      "semanticInputs.sources must be unique and in canonical order",
    );
    return false;
  }
  if (
    !evidenceItems(
      semantic.assets,
      (item, _index, report) => digest(item, report),
      invalid,
      ["semanticInputs", "assets"],
      "expected an asset record with path, byte count and SHA-256",
    )
  ) {
    return false;
  }
  if (!isEvidenceOrdered(semantic.assets, ({ path, sha256 }) => `${path}\0${sha256}`)) {
    invalid?.(
      ["semanticInputs", "assets"],
      "semanticInputs.assets must be unique and in canonical order",
    );
    return false;
  }
  if (
    !identity(semantic.compiler, (path, detail) =>
      invalid?.(["semanticInputs", "compiler", ...path], detail),
    )
  ) {
    invalid?.(
      ["semanticInputs", "compiler"],
      "semanticInputs.compiler must be a named, versioned SHA-256 identity record",
    );
    return false;
  }
  if (
    !identity(semantic.specification, (path, detail) =>
      invalid?.(["semanticInputs", "specification", ...path], detail),
    )
  ) {
    invalid?.(
      ["semanticInputs", "specification"],
      "semanticInputs.specification must be a named, versioned SHA-256 identity record",
    );
    return false;
  }
  if (
    !identity(semantic.expertSkill, (path, detail) =>
      invalid?.(["semanticInputs", "expertSkill", ...path], detail),
    )
  ) {
    invalid?.(
      ["semanticInputs", "expertSkill"],
      "semanticInputs.expertSkill must be a named, versioned SHA-256 identity record",
    );
    return false;
  }
  if (!isEvidenceRecord(semantic.target)) {
    invalid?.(["semanticInputs", "target"], "semanticInputs.target must be an object record");
    return false;
  }
  if (!hasExactEvidenceKeys(semantic.target, ["profileId", "cpuId", "emitterId", "packagerId"])) {
    invalid?.(
      ["semanticInputs", "target"],
      "semanticInputs.target must contain exactly its required and optional fields",
    );
    return false;
  }
  if (
    !Object.values(semantic.target).every((item, index) => isEvidenceText(item, invalid, [index]))
  ) {
    invalid?.(["semanticInputs", "target"], "every target identity must contain nonempty text");
    return false;
  }
  if (!isEvidenceRecord(semantic.options)) {
    invalid?.(["semanticInputs", "options"], "semanticInputs.options must be an object record");
    return false;
  }
  if (
    !hasExactEvidenceKeys(semantic.options, ["optimization", "boundsCheck", "divisionZeroCheck"])
  ) {
    invalid?.(
      ["semanticInputs", "options"],
      "semanticInputs.options must contain exactly its required and optional fields",
    );
    return false;
  }
  if (!OPTIMIZATION.has(String(semantic.options.optimization))) {
    invalid?.(
      ["semanticInputs", "options", "optimization"],
      "semanticInputs.options.optimization must name a supported optimization mode",
    );
    return false;
  }
  if (typeof semantic.options.boundsCheck !== "boolean") {
    invalid?.(
      ["semanticInputs", "options", "boundsCheck"],
      "semanticInputs.options.boundsCheck has an invalid primitive type",
    );
    return false;
  }
  if (typeof semantic.options.divisionZeroCheck !== "boolean") {
    invalid?.(
      ["semanticInputs", "options", "divisionZeroCheck"],
      "semanticInputs.options.divisionZeroCheck has an invalid primitive type",
    );
    return false;
  }
  if (!Array.isArray(semantic.overrides)) {
    invalid?.(
      ["semanticInputs", "overrides"],
      "semanticInputs.overrides must be an array of valid records",
    );
    return false;
  }
  if (
    !semantic.overrides.every((item, index) =>
      override(item, (path, detail) =>
        invalid?.(["semanticInputs", "overrides", index, ...path], detail),
      ),
    )
  ) {
    invalid?.(
      ["semanticInputs", "overrides"],
      "semanticInputs.overrides records must have valid required fields, unique identities and in-bounds references",
    );
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
    invalid?.(
      ["semanticInputs", "overrides"],
      "semanticInputs.overrides must be unique and in canonical order",
    );
    return false;
  }

  if (
    !value.portableTools.every(
      (tool, itemIndex) =>
        isEvidenceRecord(tool) &&
        hasExactEvidenceKeys(tool, ["name", "version", "semanticOptions"]) &&
        isEvidenceText(tool.name, invalid, ["portableTools", itemIndex, "name"]) &&
        isEvidenceText(tool.version, invalid, ["portableTools", itemIndex, "version"]) &&
        Array.isArray(tool.semanticOptions) &&
        tool.semanticOptions.every((item, index) =>
          isEvidenceText(item, invalid, ["portableTools", itemIndex, "semanticOptions", index]),
        ),
    )
  ) {
    invalid?.(["portableTools"], "tools require name, version and text semantic options");
    return false;
  }
  if (
    !isEvidenceOrdered(
      value.portableTools as Record<string, unknown>[],
      (tool) => `${String(tool.name)}\0${String(tool.version)}`,
    )
  ) {
    invalid?.(["portableTools"], "portableTools must be unique and in canonical order");
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
    ])
  ) {
    invalid?.(
      ["hostProvenance"],
      "hostProvenance must contain exactly its required and optional fields",
    );
    return false;
  }
  if (host.platform !== "linux" && host.platform !== "win32") {
    invalid?.(["hostProvenance", "platform"], "host provenance must identify Linux or Windows x64");
    return false;
  }
  if (host.architecture !== "x64") {
    invalid?.(
      ["hostProvenance", "architecture"],
      "host provenance must identify Linux or Windows x64",
    );
    return false;
  }
  if (!isEvidenceText(host.nodeVersion, invalid, ["hostProvenance", "nodeVersion"])) {
    invalid?.(
      ["hostProvenance", "nodeVersion"],
      "hostProvenance.nodeVersion must contain nonempty text",
    );
    return false;
  }
  if (!Array.isArray(host.tools)) {
    invalid?.(
      ["hostProvenance", "tools"],
      "hostProvenance.tools must be an array of valid records",
    );
    return false;
  }
  if (
    !host.tools.every(
      (tool, itemIndex) =>
        isEvidenceRecord(tool) &&
        hasExactEvidenceKeys(tool, ["name", "canonicalPath", "sha256"]) &&
        isEvidenceText(tool.name, invalid, ["hostProvenance", "tools", itemIndex, "name"]) &&
        isEvidenceText(tool.canonicalPath, invalid, [
          "hostProvenance",
          "tools",
          itemIndex,
          "canonicalPath",
        ]) &&
        isEvidenceHash(tool.sha256, invalid, ["hostProvenance", "tools", itemIndex, "sha256"]),
    )
  ) {
    invalid?.(["hostProvenance", "tools"], "hostProvenance.tools must be an object record");
    return false;
  }
  if (
    !isEvidenceOrdered(
      host.tools as Record<string, unknown>[],
      (tool) => `${String(tool.name)}\0${String(tool.canonicalPath)}`,
    )
  ) {
    invalid?.(
      ["hostProvenance", "tools"],
      "hostProvenance.tools must be unique and in canonical order",
    );
    return false;
  }
  if (
    !(
      host.durationMilliseconds === "Unknown" ||
      isEvidenceCount(host.durationMilliseconds, invalid, [
        "hostProvenance",
        "durationMilliseconds",
      ])
    )
  ) {
    invalid?.(
      ["hostProvenance", "durationMilliseconds"],
      "hostProvenance.durationMilliseconds must be a nonnegative safe integer",
    );
    return false;
  }
  if (
    !(
      host.peakRssBytes === "Unknown" ||
      isEvidenceCount(host.peakRssBytes, invalid, ["hostProvenance", "peakRssBytes"])
    )
  ) {
    invalid?.(
      ["hostProvenance", "peakRssBytes"],
      "hostProvenance.peakRssBytes must be a nonnegative safe integer",
    );
    return false;
  }

  const artifacts = value.artifacts;
  if (
    !artifacts.every(
      (artifact, index) =>
        isEvidenceRecord(artifact) &&
        hasExactEvidenceKeys(artifact, ["path", "kind", "bytes", "sha256"]) &&
        isEvidencePath(artifact.path) &&
        artifact.path !== ".build.json" &&
        ARTIFACT_KINDS.has(String(artifact.kind)) &&
        isEvidenceCount(artifact.bytes, invalid, ["artifacts", index, "bytes"]) &&
        isEvidenceHash(artifact.sha256, invalid, ["artifacts", index, "sha256"]),
    )
  ) {
    invalid?.(["artifacts"], "artifacts must be an object record");
    return false;
  }
  if (
    !isEvidenceOrdered(artifacts as Record<string, unknown>[], (artifact) => String(artifact.path))
  ) {
    invalid?.(["artifacts"], "artifacts must be unique and in canonical order");
    return false;
  }
  if (
    new Set(artifacts.map((artifact) => (artifact as Record<string, unknown>).kind)).size !==
    artifacts.length
  ) {
    invalid?.(
      ["artifacts"],
      "artifact records need unique paths and kinds, nonnegative byte counts and SHA-256; the build report cannot list itself",
    );
    return false;
  }
  if (
    !packageValue(value.package, artifacts as Record<string, unknown>[], (path, detail) =>
      invalid?.(["package", ...path], detail),
    )
  ) {
    invalid?.(
      ["package"],
      "package record must have a valid load/end address range, package fields and matching primary artifact",
    );
    return false;
  }
  return true;
}
