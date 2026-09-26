import type { DebugEvidence } from "./evidence-types.js";
import type { EvidenceFieldFailure } from "./evidence-diagnostics.js";
import { debugContextKey } from "./debug-context-order.js";
import { validateDebugReverseIndexes } from "./debug-evidence-references.js";
import {
  identity,
  tool,
  artifact,
  source,
  assetInput,
  addressSpace,
  functionRecord,
  contextRecord,
  symbolRecord,
  locationRecord,
  rangeRecord,
  optimizationRecord,
  loadUnitRecord,
  rangeKey,
} from "./debug-evidence-records.js";
import {
  evidenceItems,
  canonicalEvidenceJson,
  hasExactEvidenceKeys,
  isEvidenceOrdered,
  isEvidenceRecord,
  isEvidenceText,
} from "./evidence-validation.js";

const OPTIMIZATION = new Set(["none", "balanced", "speed", "size"]);

/** Validate the complete closed debug-evidence version-1 value. */
export function debugEvidenceValue(
  value: unknown,
  invalid?: EvidenceFieldFailure,
): value is DebugEvidence {
  if (!isEvidenceRecord(value)) {
    invalid?.([], "record must be an object record");
    return false;
  }
  if (
    !hasExactEvidenceKeys(value, [
      "kind",
      "schemaVersion",
      "compiler",
      "specification",
      "expertSkill",
      "profileId",
      "cpuId",
      "optimization",
      "safety",
      "primaryArtifact",
      "tools",
      "sources",
      "assets",
      "addressSpaces",
      "functions",
      "contexts",
      "symbols",
      "locations",
      "ranges",
      "optimizations",
      "loadUnits",
    ])
  ) {
    invalid?.([], "record must contain exactly its required and optional fields");
    return false;
  }
  if (value.kind !== "blend65.debug") {
    invalid?.(["kind"], "kind must identify this artifact family");
    return false;
  }
  if (value.schemaVersion !== 1) {
    invalid?.(["schemaVersion"], "schemaVersion must equal 1");
    return false;
  }
  if (!identity(value.compiler, (path, detail) => invalid?.(["compiler", ...path], detail))) {
    invalid?.(["compiler"], "compiler must be a named, versioned SHA-256 identity record");
    return false;
  }
  if (
    !identity(value.specification, (path, detail) => invalid?.(["specification", ...path], detail))
  ) {
    invalid?.(
      ["specification"],
      "specification must be a named, versioned SHA-256 identity record",
    );
    return false;
  }
  if (!identity(value.expertSkill, (path, detail) => invalid?.(["expertSkill", ...path], detail))) {
    invalid?.(["expertSkill"], "expertSkill must be a named, versioned SHA-256 identity record");
    return false;
  }
  if (!isEvidenceText(value.profileId, invalid, ["profileId"])) {
    invalid?.(["profileId"], "profileId must contain nonempty text");
    return false;
  }
  if (!isEvidenceText(value.cpuId, invalid, ["cpuId"])) {
    invalid?.(["cpuId"], "cpuId must contain nonempty text");
    return false;
  }
  if (!OPTIMIZATION.has(String(value.optimization))) {
    invalid?.(
      ["optimization"],
      "optimization mode must be supported and agree with decision records; none has no decisions",
    );
    return false;
  }
  if (!isEvidenceRecord(value.safety)) {
    invalid?.(["safety"], "safety must be an object record");
    return false;
  }
  if (!hasExactEvidenceKeys(value.safety, ["boundsCheck", "divisionZeroCheck"])) {
    invalid?.(["safety"], "safety must contain exactly its required and optional fields");
    return false;
  }
  if (typeof value.safety.boundsCheck !== "boolean") {
    invalid?.(["safety", "boundsCheck"], "safety.boundsCheck has an invalid primitive type");
    return false;
  }
  if (typeof value.safety.divisionZeroCheck !== "boolean") {
    invalid?.(
      ["safety", "divisionZeroCheck"],
      "safety.divisionZeroCheck has an invalid primitive type",
    );
    return false;
  }
  if (
    !artifact(value.primaryArtifact, (path, detail) =>
      invalid?.(["primaryArtifact", ...path], detail),
    )
  ) {
    invalid?.(
      ["primaryArtifact"],
      "primaryArtifact records must have valid required fields, unique identities and in-bounds references",
    );
    return false;
  }
  if (!Array.isArray(value.tools)) {
    invalid?.(["tools"], "tools must be an array of valid records");
    return false;
  }
  if (
    !evidenceItems(
      value.tools,
      (item, _index, report) => tool(item, report),
      invalid,
      ["tools"],
      "expected a tool name, version and text semantic options",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(
      value.tools as Record<string, unknown>[],
      (item) => `${String(item.name)}\0${String(item.version)}`,
    )
  ) {
    invalid?.(["tools"], "tools must be unique and in canonical order");
    return false;
  }
  if (
    !evidenceItems(
      value.sources,
      (item, _index, report) => source(item, report),
      invalid,
      ["sources"],
      "expected a source record with ordered line offsets within byteLength",
    )
  ) {
    return false;
  }
  if (!isEvidenceOrdered(value.sources as Record<string, unknown>[], (item) => String(item.path))) {
    invalid?.(["sources"], "sources must be unique and in canonical order");
    return false;
  }
  if (!Array.isArray(value.assets)) {
    invalid?.(["assets"], "assets must be an array of valid records");
    return false;
  }
  if (
    !evidenceItems(
      value.assets,
      (item, _index, report) => assetInput(item, report),
      invalid,
      ["assets"],
      "expected a source asset path, handler, selector and digest",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(
      value.assets as Record<string, unknown>[],
      (item) => `${String(item.path)}\0${String(item.handler)}\0${String(item.selector)}`,
    )
  ) {
    invalid?.(["assets"], "assets must be unique and in canonical order");
    return false;
  }
  if (!Array.isArray(value.addressSpaces)) {
    invalid?.(["addressSpaces"], "addressSpaces must be an array of valid records");
    return false;
  }
  if (
    !evidenceItems(
      value.addressSpaces,
      (item, _index, report) => addressSpace(item, report),
      invalid,
      ["addressSpaces"],
      "expected an address-space record with valid size and banks",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(value.addressSpaces as Record<string, unknown>[], (item) => String(item.id))
  ) {
    invalid?.(["addressSpaces"], "addressSpaces must be unique and in canonical order");
    return false;
  }
  if (
    !evidenceItems(
      value.functions,
      () => true,
      invalid,
      ["functions"],
      "expected a function record",
    )
  ) {
    return false;
  }
  if (!Array.isArray(value.contexts)) {
    invalid?.(["contexts"], "contexts must be an array of valid records");
    return false;
  }
  if (!Array.isArray(value.symbols)) {
    invalid?.(["symbols"], "symbols must be an array of valid records");
    return false;
  }
  if (!Array.isArray(value.locations)) {
    invalid?.(["locations"], "locations must be an array of valid records");
    return false;
  }
  if (!Array.isArray(value.ranges)) {
    invalid?.(["ranges"], "ranges must be an array of valid records");
    return false;
  }
  if (!Array.isArray(value.optimizations)) {
    invalid?.(["optimizations"], "optimizations must be an array of valid records");
    return false;
  }
  if (!Array.isArray(value.loadUnits)) {
    invalid?.(["loadUnits"], "loadUnits must be an array of valid records");
    return false;
  }

  const sources = value.sources as Record<string, unknown>[];
  const addressSpaces = value.addressSpaces as Record<string, unknown>[];
  const functions = value.functions as Record<string, unknown>[];
  const contexts = value.contexts as Record<string, unknown>[];
  const symbols = value.symbols as Record<string, unknown>[];
  const locations = value.locations as Record<string, unknown>[];
  const ranges = value.ranges as Record<string, unknown>[];
  const optimizations = value.optimizations as Record<string, unknown>[];
  const loadUnits = value.loadUnits as Record<string, unknown>[];
  if (
    !evidenceItems(
      functions,
      (item, _index, report) => functionRecord(item, sources, report),
      invalid,
      ["functions"],
      "expected a function record with valid source span, entries and range indexes",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(
      functions,
      (item) => `${String(item.qualifiedName)}\0${canonicalEvidenceJson(item.declaration)}`,
    )
  ) {
    invalid?.(["functions"], "functions must be unique and in canonical order");
    return false;
  }
  if (
    !evidenceItems(
      contexts,
      (item, index, report) => contextRecord(item, index, functions, sources, report),
      invalid,
      ["contexts"],
      "expected a context with valid parent/function/source references",
    )
  ) {
    return false;
  }
  if (!isEvidenceOrdered(contexts, debugContextKey)) {
    invalid?.(["contexts"], "contexts must be unique and in canonical order");
    return false;
  }
  if (new Set(contexts.map(canonicalEvidenceJson)).size !== contexts.length) {
    invalid?.(
      ["contexts"],
      "contexts records must have valid required fields, unique identities and in-bounds references",
    );
    return false;
  }
  if (
    !evidenceItems(
      symbols,
      (item, _index, report) => symbolRecord(item, sources, report),
      invalid,
      ["symbols"],
      "expected a typed symbol with a valid origin, labels and storage shape",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(
      symbols,
      (item) =>
        `${String(item.qualifiedName)}\0${String(item.kind)}\0${canonicalEvidenceJson(item.origin)}`,
    )
  ) {
    invalid?.(["symbols"], "symbols must be unique and in canonical order");
    return false;
  }
  if (
    !evidenceItems(
      locations,
      (item, _index, report) =>
        locationRecord(
          item,
          symbols,
          contexts,
          addressSpaces,
          ranges.length,
          loadUnits.length,
          report,
        ),
      invalid,
      ["locations"],
      "expected a location with valid symbol/context/range references and storage description",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(locations, (item) => {
      const contextIndex =
        item.contextIndex === undefined ? "" : String(item.contextIndex).padStart(10, "0");
      const firstRange = (item.liveRangeIndexes as number[])[0];
      const firstRangeIndex = firstRange === undefined ? "" : String(firstRange).padStart(10, "0");
      return `${String(item.symbolIndex).padStart(10, "0")}\0${contextIndex}\0${firstRangeIndex}`;
    })
  ) {
    invalid?.(["locations"], "locations must be unique and in canonical order");
    return false;
  }
  if (
    !evidenceItems(
      ranges,
      (item, _index, report) =>
        rangeRecord(
          item,
          functions,
          symbols,
          contexts,
          sources,
          addressSpaces,
          optimizations.length,
          loadUnits.length,
          report,
        ),
      invalid,
      ["ranges"],
      "expected an in-bounds machine range with valid owner, origin and context references",
    )
  ) {
    return false;
  }
  if (!isEvidenceOrdered(ranges, rangeKey)) {
    invalid?.(["ranges"], "ranges must be unique and in canonical order");
    return false;
  }
  if (
    !evidenceItems(
      optimizations,
      (item, _index, report) => optimizationRecord(item, sources, ranges.length, report),
      invalid,
      ["optimizations"],
      "expected an optimization record with valid source spans, result and range indexes",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(
      optimizations,
      (item) =>
        `${String(item.stage)}\0${String(item.rule)}\0${canonicalEvidenceJson(item.sourceSpans)}`,
    )
  ) {
    invalid?.(["optimizations"], "optimizations must be unique and in canonical order");
    return false;
  }
  if (value.optimization === "none" && optimizations.length !== 0) {
    invalid?.(
      ["optimizations"],
      "optimization mode must be supported and agree with decision records; none has no decisions",
    );
    return false;
  }
  if (
    !evidenceItems(
      loadUnits,
      (item, _index, report) => loadUnitRecord(item, addressSpaces, loadUnits.length, report),
      invalid,
      ["loadUnits"],
      "expected a named load unit with valid publication, artifact and residence ranges",
    )
  ) {
    return false;
  }
  if (!isEvidenceOrdered(loadUnits, (item) => String(item.name))) {
    invalid?.(["loadUnits"], "loadUnits must be unique and in canonical order");
    return false;
  }
  if (
    loadUnits.some((item, loadUnitIndex) =>
      (item.residence as Record<string, unknown>[]).some(
        (range) => range.loadUnitIndex !== loadUnitIndex,
      ),
    )
  ) {
    invalid?.(
      ["loadUnits"],
      "load-unit records and residence indexes must refer to the same valid unit",
    );
    return false;
  }
  if (
    !validateDebugReverseIndexes(
      functions,
      contexts,
      symbols,
      locations,
      ranges,
      optimizations,
      invalid,
    )
  ) {
    return false;
  }
  const labels = symbols.flatMap((item) => item.labels as string[]);
  if (new Set(labels).size !== labels.length) {
    invalid?.(["symbols"], "labels must be globally unique across symbols");
    return false;
  }
  const firstChild = contexts.findIndex(({ kind }) => kind !== "entry");
  if (firstChild >= 0 && contexts.slice(firstChild).some(({ kind }) => kind === "entry")) {
    invalid?.(["contexts"], "entry contexts must precede all child contexts");
    return false;
  }
  return true;
}
