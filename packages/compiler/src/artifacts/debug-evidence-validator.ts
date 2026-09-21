import type { DebugEvidence } from "./evidence-types.js";
import { debugContextKey } from "./debug-context-order.js";
import { validateDebugReverseIndexes } from "./debug-evidence-references.js";
import { symbolShapeMatchesType } from "./debug-symbol-width.js";
import {
  areEvidenceIndexes,
  areEvidenceStringsOrdered,
  canonicalEvidenceJson,
  compareEvidenceText,
  hasExactEvidenceKeys,
  isEvidenceCount,
  isEvidenceHash,
  isEvidenceHex,
  isEvidenceOrdered,
  isEvidencePath,
  isEvidenceRecord,
  isEvidenceText,
} from "./evidence-validation.js";

const OPTIMIZATION = new Set(["none", "balanced", "speed", "size"]);
const ADDRESS_SPACE_KINDS = new Set(["cpu", "banked", "overlay", "transfer"]);
const SYMBOL_KINDS = new Set([
  "function",
  "parameter",
  "return",
  "local",
  "temporary",
  "global",
  "constant",
  "asset",
  "helperScratch",
]);
const CONTEXT_SYMBOLS = new Set(["parameter", "return", "local", "temporary"]);
const CONTEXT_FREE_SYMBOLS = new Set(["function", "global", "constant", "asset"]);
const GENERATED_CAUSES = new Set([
  "startup",
  "helper",
  "loader",
  "branchRepair",
  "safetyStop",
  "platform",
  "asset",
]);
const OPTIMIZATION_RESULTS = new Set([
  "retained",
  "inlined",
  "eliminated",
  "rematerialized",
  "split",
]);

/** Validate one portable identity. */
function identity(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["name", "version", "sha256"]) &&
    isEvidenceText(value.name) &&
    isEvidenceText(value.version) &&
    isEvidenceHash(value.sha256)
  );
}

/** Validate one portable output-affecting tool record. */
function tool(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["name", "version", "semanticOptions"]) &&
    isEvidenceText(value.name) &&
    isEvidenceText(value.version) &&
    Array.isArray(value.semanticOptions) &&
    value.semanticOptions.every(isEvidenceText)
  );
}

/** Validate one generation-relative artifact identity. */
function artifact(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "kind", "sha256"]) &&
    isEvidencePath(value.path) &&
    isEvidenceText(value.kind) &&
    isEvidenceHash(value.sha256)
  );
}

/** Validate one source-indexed half-open byte span. */
function span(value: unknown, sources: readonly Record<string, unknown>[]): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, ["sourceIndex", "startByte", "endByte"]) ||
    !isEvidenceCount(value.sourceIndex) ||
    value.sourceIndex >= sources.length ||
    !isEvidenceCount(value.startByte) ||
    !isEvidenceCount(value.endByte) ||
    value.startByte > value.endByte
  ) {
    return false;
  }
  return value.endByte <= (sources[value.sourceIndex]!.byteLength as number);
}

/** Validate one source or generated origin. */
function origin(value: unknown, sources: readonly Record<string, unknown>[]): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "source") {
    return hasExactEvidenceKeys(value, ["kind", "span"]) && span(value.span, sources);
  }
  return (
    value.kind === "generated" &&
    hasExactEvidenceKeys(value, ["kind", "cause"], ["sourceSpan"]) &&
    GENERATED_CAUSES.has(String(value.cause)) &&
    (value.sourceSpan === undefined || span(value.sourceSpan, sources))
  );
}

/** Validate one indexed machine range against address-space and load-unit tables. */
function machineRange(
  value: unknown,
  addressSpaces: readonly Record<string, unknown>[],
  loadUnitCount: number,
): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(
      value,
      ["addressSpaceIndex", "start", "end"],
      ["bankIndex", "loadUnitIndex"],
    ) ||
    !isEvidenceCount(value.addressSpaceIndex) ||
    value.addressSpaceIndex >= addressSpaces.length ||
    !isEvidenceCount(value.start) ||
    !isEvidenceCount(value.end) ||
    value.start >= value.end
  ) {
    return false;
  }
  const addressSpace = addressSpaces[value.addressSpaceIndex]!;
  const banks = addressSpace.banks as Record<string, unknown>[];
  if (value.end > (addressSpace.sizeBytes as number)) return false;
  if (banks.length === 0 ? value.bankIndex !== undefined : !isEvidenceCount(value.bankIndex)) {
    return false;
  }
  if (
    value.bankIndex !== undefined &&
    (!isEvidenceCount(value.bankIndex) || value.bankIndex >= banks.length)
  )
    return false;
  return (
    value.loadUnitIndex === undefined ||
    (isEvidenceCount(value.loadUnitIndex) && value.loadUnitIndex < loadUnitCount)
  );
}

/** Validate one source inventory record. */
function source(value: unknown): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, ["path", "byteLength", "sha256"], ["lineStarts"]) ||
    !isEvidencePath(value.path) ||
    !isEvidenceCount(value.byteLength) ||
    !isEvidenceHash(value.sha256)
  ) {
    return false;
  }
  if (value.lineStarts === undefined) return true;
  const byteLength = value.byteLength as number;
  const lineStarts = value.lineStarts;
  return (
    Array.isArray(lineStarts) &&
    lineStarts.length > 0 &&
    lineStarts[0] === 0 &&
    lineStarts.every(
      (offset, index) =>
        isEvidenceCount(offset) &&
        offset <= byteLength &&
        (index === 0 || offset > lineStarts[index - 1]!),
    )
  );
}

/** Validate one selected asset input record. */
function assetInput(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "sha256", "handler", "handlerVersion", "selector"]) &&
    isEvidencePath(value.path) &&
    isEvidenceHash(value.sha256) &&
    isEvidenceText(value.handler) &&
    isEvidenceText(value.handlerVersion) &&
    isEvidenceText(value.selector) &&
    (value.handler !== "raw" || (value.handlerVersion === "1" && value.selector === "raw"))
  );
}

/** Validate one machine address-space record. */
function addressSpace(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["id", "kind", "sizeBytes", "banks"]) &&
    isEvidenceText(value.id) &&
    ADDRESS_SPACE_KINDS.has(String(value.kind)) &&
    isEvidenceCount(value.sizeBytes) &&
    value.sizeBytes > 0 &&
    Array.isArray(value.banks) &&
    value.banks.every(
      (bank) =>
        isEvidenceRecord(bank) &&
        hasExactEvidenceKeys(bank, ["id", "visibility"]) &&
        isEvidenceText(bank.id) &&
        areEvidenceStringsOrdered(bank.visibility),
    ) &&
    isEvidenceOrdered(value.banks as Record<string, unknown>[], (bank) => String(bank.id)) &&
    ((value.kind === "cpu" && value.banks.length === 0) || value.kind !== "cpu") &&
    ((value.kind === "banked" && value.banks.length > 0) || value.kind !== "banked")
  );
}

/** Validate one function and its entry variants before resolving range references. */
function functionRecord(value: unknown, sources: readonly Record<string, unknown>[]): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, [
      "qualifiedName",
      "kind",
      "declaration",
      "entryVariants",
      "rangeIndexes",
    ]) &&
    isEvidenceText(value.qualifiedName) &&
    (value.kind === "ordinary" || value.kind === "interrupt") &&
    span(value.declaration, sources) &&
    Array.isArray(value.entryVariants) &&
    value.entryVariants.length > 0 &&
    value.entryVariants.every(
      (variant) =>
        isEvidenceRecord(variant) &&
        hasExactEvidenceKeys(variant, ["id", "kind", "label", "rangeIndexes"]) &&
        isEvidenceText(variant.id) &&
        isEvidenceText(variant.kind) &&
        isEvidenceText(variant.label) &&
        Array.isArray(variant.rangeIndexes),
    ) &&
    isEvidenceOrdered(value.entryVariants as Record<string, unknown>[], (variant) =>
      String(variant.id),
    ) &&
    Array.isArray(value.rangeIndexes)
  );
}

/** Validate one execution context and its tag-dependent fields. */
function contextRecord(
  value: unknown,
  index: number,
  functions: readonly Record<string, unknown>[],
  sources: readonly Record<string, unknown>[],
): boolean {
  if (
    !isEvidenceRecord(value) ||
    !isEvidenceCount(value.functionIndex) ||
    value.functionIndex >= functions.length
  ) {
    return false;
  }
  if (value.kind === "entry") {
    return (
      hasExactEvidenceKeys(value, ["kind", "functionIndex", "entryVariantIndex"]) &&
      isEvidenceCount(value.entryVariantIndex) &&
      value.entryVariantIndex <
        (functions[value.functionIndex]!.entryVariants as Record<string, unknown>[]).length
    );
  }
  return (
    (value.kind === "call" || value.kind === "inlined") &&
    hasExactEvidenceKeys(value, ["kind", "functionIndex", "parentContextIndex", "callSite"]) &&
    isEvidenceCount(value.parentContextIndex) &&
    value.parentContextIndex < index &&
    span(value.callSite, sources)
  );
}

/** Validate one source or generated symbol before resolving its locations. */
function symbolRecord(value: unknown, sources: readonly Record<string, unknown>[]): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, [
      "name",
      "qualifiedName",
      "kind",
      "type",
      "byteWidth",
      "shape",
      "scope",
      "origin",
      "linkage",
      "labels",
      "locationIndexes",
    ]) &&
    isEvidenceText(value.name) &&
    isEvidenceText(value.qualifiedName) &&
    SYMBOL_KINDS.has(String(value.kind)) &&
    isEvidenceText(value.type) &&
    isEvidenceCount(value.byteWidth) &&
    Array.isArray(value.shape) &&
    value.shape.every((extent) => isEvidenceCount(extent) || extent === "unsized") &&
    value.shape.every(
      (extent, index) => extent !== "unsized" || (value.kind === "parameter" && index === 0),
    ) &&
    symbolShapeMatchesType(value) &&
    isEvidenceText(value.scope) &&
    origin(value.origin, sources) &&
    new Set(["internal", "exported", "platform"]).has(String(value.linkage)) &&
    areEvidenceStringsOrdered(value.labels) &&
    Array.isArray(value.locationIndexes)
  );
}

/** Validate one storage availability union before resolving referenced symbols. */
function availability(
  value: unknown,
  symbol: Record<string, unknown>,
  addressSpaces: readonly Record<string, unknown>[],
  loadUnitCount: number,
  symbolCount: number,
): boolean {
  if (!isEvidenceRecord(value)) return false;
  const representedWidth = symbol.byteWidth as number;
  if (value.kind === "available" || value.kind === "split") {
    if (
      !hasExactEvidenceKeys(value, ["kind", "pieces"]) ||
      !Array.isArray(value.pieces) ||
      value.pieces.length < (value.kind === "split" ? 2 : 1) ||
      !value.pieces.every((piece) => {
        if (!isEvidenceRecord(piece)) return false;
        if (piece.kind === "memory") {
          return (
            hasExactEvidenceKeys(piece, ["kind", "machine", "valueOffset", "byteLength"]) &&
            machineRange(piece.machine, addressSpaces, loadUnitCount) &&
            isEvidenceCount(piece.valueOffset) &&
            isEvidenceCount(piece.byteLength) &&
            piece.byteLength > 0 &&
            (piece.machine as Record<string, number>).end -
              (piece.machine as Record<string, number>).start ===
              piece.byteLength
          );
        }
        return (
          piece.kind === "register" &&
          hasExactEvidenceKeys(piece, ["kind", "register", "valueOffset", "byteLength"]) &&
          new Set(["A", "X", "Y", "SP", "P"]).has(String(piece.register)) &&
          isEvidenceCount(piece.valueOffset) &&
          isEvidenceCount(piece.byteLength) &&
          piece.byteLength > 0
        );
      })
    ) {
      return false;
    }
    const pieces = value.pieces as Record<string, unknown>[];
    let expectedOffset = 0;
    for (const piece of pieces) {
      if (piece.valueOffset !== expectedOffset) return false;
      expectedOffset += piece.byteLength as number;
    }
    const memoryPieces = pieces.filter(({ kind }) => kind === "memory");
    return (
      expectedOffset === representedWidth &&
      memoryPieces.every((piece, index) => {
        if (index === 0) return true;
        const key = (item: Record<string, unknown>): string => {
          const machine = item.machine as Record<string, unknown>;
          return `${String(machine.addressSpaceIndex).padStart(10, "0")}\0${String(machine.bankIndex ?? "").padStart(10, "0")}\0${String(machine.loadUnitIndex ?? "").padStart(10, "0")}\0${String(machine.start).padStart(16, "0")}\0${String(machine.end).padStart(16, "0")}`;
        };
        return compareEvidenceText(key(memoryPieces[index - 1]!), key(piece)) < 0;
      })
    );
  }
  if (value.kind === "constant") {
    return (
      hasExactEvidenceKeys(value, ["kind", "bytesHex"]) &&
      isEvidenceHex(value.bytesHex) &&
      value.bytesHex.length === representedWidth * 2
    );
  }
  if (value.kind === "rematerializable") {
    return (
      hasExactEvidenceKeys(value, ["kind", "rule", "operandSymbolIndexes"]) &&
      isEvidenceText(value.rule) &&
      areEvidenceIndexes(value.operandSymbolIndexes, symbolCount)
    );
  }
  if (value.kind === "optimizedAway") {
    return hasExactEvidenceKeys(value, ["kind", "rule"]) && isEvidenceText(value.rule);
  }
  return (
    value.kind === "unavailable" &&
    hasExactEvidenceKeys(value, ["kind", "reason"]) &&
    new Set(["notLive", "notResident", "notMaterialized", "notRepresentable"]).has(
      String(value.reason),
    )
  );
}

/** Validate one symbol location and its context rule. */
function locationRecord(
  value: unknown,
  symbols: readonly Record<string, unknown>[],
  contexts: readonly Record<string, unknown>[],
  addressSpaces: readonly Record<string, unknown>[],
  rangeCount: number,
  loadUnitCount: number,
): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(
      value,
      ["symbolIndex", "liveRangeIndexes", "availability"],
      ["contextIndex"],
    ) ||
    !isEvidenceCount(value.symbolIndex) ||
    value.symbolIndex >= symbols.length ||
    !areEvidenceIndexes(value.liveRangeIndexes, rangeCount) ||
    (value.contextIndex !== undefined &&
      (!isEvidenceCount(value.contextIndex) || value.contextIndex >= contexts.length)) ||
    !availability(
      value.availability,
      symbols[value.symbolIndex]!,
      addressSpaces,
      loadUnitCount,
      symbols.length,
    )
  ) {
    return false;
  }
  const kind = String(symbols[value.symbolIndex]!.kind);
  if (CONTEXT_SYMBOLS.has(kind) && value.contextIndex === undefined) return false;
  if (CONTEXT_FREE_SYMBOLS.has(kind) && value.contextIndex !== undefined) return false;
  return value.liveRangeIndexes.length > 0 || value.contextIndex === undefined;
}

/** Validate one range owner and its referenced index. */
function rangeOwner(value: unknown, functionCount: number, symbolCount: number): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "function") {
    return (
      hasExactEvidenceKeys(value, ["kind", "functionIndex"]) &&
      isEvidenceCount(value.functionIndex) &&
      value.functionIndex < functionCount
    );
  }
  if (value.kind === "symbol") {
    return (
      hasExactEvidenceKeys(value, ["kind", "symbolIndex"]) &&
      isEvidenceCount(value.symbolIndex) &&
      value.symbolIndex < symbolCount
    );
  }
  return (
    value.kind === "platform" &&
    hasExactEvidenceKeys(value, ["kind", "name"]) &&
    isEvidenceText(value.name)
  );
}

/** Validate one final machine range before reverse-reference checks. */
function rangeRecord(
  value: unknown,
  functions: readonly Record<string, unknown>[],
  symbols: readonly Record<string, unknown>[],
  contexts: readonly Record<string, unknown>[],
  sources: readonly Record<string, unknown>[],
  addressSpaces: readonly Record<string, unknown>[],
  optimizationCount: number,
  loadUnitCount: number,
): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(
      value,
      ["machine", "origin", "owner", "optimizationIndexes"],
      ["contextIndex"],
    ) ||
    !machineRange(value.machine, addressSpaces, loadUnitCount) ||
    !origin(value.origin, sources) ||
    !rangeOwner(value.owner, functions.length, symbols.length) ||
    !areEvidenceIndexes(value.optimizationIndexes, optimizationCount) ||
    (value.contextIndex !== undefined &&
      (!isEvidenceCount(value.contextIndex) || value.contextIndex >= contexts.length))
  ) {
    return false;
  }
  const selectedOwner = value.owner as Record<string, unknown>;
  if (selectedOwner.kind === "function") return value.contextIndex !== undefined;
  if (selectedOwner.kind === "platform") return value.contextIndex === undefined;
  const selectedSymbol = symbols[selectedOwner.symbolIndex as number]!;
  return CONTEXT_SYMBOLS.has(String(selectedSymbol.kind))
    ? value.contextIndex !== undefined
    : value.contextIndex === undefined;
}

/** Validate one optimization trace record. */
function optimizationRecord(
  value: unknown,
  sources: readonly Record<string, unknown>[],
  rangeCount: number,
): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["stage", "rule", "result", "sourceSpans", "outputRangeIndexes"]) &&
    isEvidenceText(value.stage) &&
    isEvidenceText(value.rule) &&
    OPTIMIZATION_RESULTS.has(String(value.result)) &&
    Array.isArray(value.sourceSpans) &&
    value.sourceSpans.every((item) => span(item, sources)) &&
    isEvidenceOrdered(
      value.sourceSpans as Record<string, unknown>[],
      (item) =>
        `${String(item.sourceIndex).padStart(10, "0")}\0${String(item.startByte).padStart(16, "0")}\0${String(item.endByte).padStart(16, "0")}`,
    ) &&
    areEvidenceIndexes(value.outputRangeIndexes, rangeCount) &&
    (value.result !== "eliminated" || value.outputRangeIndexes.length === 0)
  );
}

/** Validate one separately published load unit. */
function loadUnitRecord(
  value: unknown,
  addressSpaces: readonly Record<string, unknown>[],
  loadUnitCount: number,
): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["name", "kind", "publication", "artifact", "residence"]) &&
    isEvidenceText(value.name) &&
    (value.kind === "resident" || value.kind === "loadable") &&
    (value.publication === "primary" || value.publication === "contained") &&
    artifact(value.artifact) &&
    Array.isArray(value.residence) &&
    value.residence.every((item) => machineRange(item, addressSpaces, loadUnitCount)) &&
    isEvidenceOrdered(
      value.residence as Record<string, unknown>[],
      (item) =>
        `${String(item.addressSpaceIndex).padStart(10, "0")}\0${String(item.bankIndex ?? "")}\0${String(item.start).padStart(16, "0")}`,
    )
  );
}

/** Return the canonical machine-range root sort key. */
function rangeKey(value: Record<string, unknown>): string {
  const machine = value.machine as Record<string, unknown>;
  const bankIndex =
    machine.bankIndex === undefined ? "" : String(machine.bankIndex).padStart(10, "0");
  const loadUnitIndex =
    machine.loadUnitIndex === undefined ? "" : String(machine.loadUnitIndex).padStart(10, "0");
  return `${String(machine.addressSpaceIndex).padStart(10, "0")}\0${bankIndex}\0${loadUnitIndex}\0${String(machine.start).padStart(16, "0")}\0${String(machine.end).padStart(16, "0")}\0${canonicalEvidenceJson(value.origin)}`;
}

/** Validate the complete closed debug-evidence version-1 value. */
export function debugEvidenceValue(value: unknown): value is DebugEvidence {
  if (
    !isEvidenceRecord(value) ||
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
    ]) ||
    value.kind !== "blend65.debug" ||
    value.schemaVersion !== 1 ||
    !identity(value.compiler) ||
    !identity(value.specification) ||
    !identity(value.expertSkill) ||
    !isEvidenceText(value.profileId) ||
    !isEvidenceText(value.cpuId) ||
    !OPTIMIZATION.has(String(value.optimization)) ||
    !isEvidenceRecord(value.safety) ||
    !hasExactEvidenceKeys(value.safety, ["boundsCheck", "divisionZeroCheck"]) ||
    typeof value.safety.boundsCheck !== "boolean" ||
    typeof value.safety.divisionZeroCheck !== "boolean" ||
    !artifact(value.primaryArtifact) ||
    !Array.isArray(value.tools) ||
    !value.tools.every(tool) ||
    !isEvidenceOrdered(
      value.tools as Record<string, unknown>[],
      (item) => `${String(item.name)}\0${String(item.version)}`,
    ) ||
    !Array.isArray(value.sources) ||
    !value.sources.every(source) ||
    !isEvidenceOrdered(value.sources as Record<string, unknown>[], (item) => String(item.path)) ||
    !Array.isArray(value.assets) ||
    !value.assets.every(assetInput) ||
    !isEvidenceOrdered(
      value.assets as Record<string, unknown>[],
      (item) => `${String(item.path)}\0${String(item.handler)}\0${String(item.selector)}`,
    ) ||
    !Array.isArray(value.addressSpaces) ||
    !value.addressSpaces.every(addressSpace) ||
    !isEvidenceOrdered(value.addressSpaces as Record<string, unknown>[], (item) =>
      String(item.id),
    ) ||
    !Array.isArray(value.functions) ||
    !Array.isArray(value.contexts) ||
    !Array.isArray(value.symbols) ||
    !Array.isArray(value.locations) ||
    !Array.isArray(value.ranges) ||
    !Array.isArray(value.optimizations) ||
    !Array.isArray(value.loadUnits)
  ) {
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
    !functions.every((item) => functionRecord(item, sources)) ||
    !isEvidenceOrdered(
      functions,
      (item) => `${String(item.qualifiedName)}\0${canonicalEvidenceJson(item.declaration)}`,
    ) ||
    !contexts.every((item, index) => contextRecord(item, index, functions, sources)) ||
    !isEvidenceOrdered(contexts, debugContextKey) ||
    new Set(contexts.map(canonicalEvidenceJson)).size !== contexts.length ||
    !symbols.every((item) => symbolRecord(item, sources)) ||
    !isEvidenceOrdered(
      symbols,
      (item) =>
        `${String(item.qualifiedName)}\0${String(item.kind)}\0${canonicalEvidenceJson(item.origin)}`,
    ) ||
    !locations.every((item) =>
      locationRecord(item, symbols, contexts, addressSpaces, ranges.length, loadUnits.length),
    ) ||
    !isEvidenceOrdered(locations, (item) => {
      const contextIndex =
        item.contextIndex === undefined ? "" : String(item.contextIndex).padStart(10, "0");
      const firstRange = (item.liveRangeIndexes as number[])[0];
      const firstRangeIndex = firstRange === undefined ? "" : String(firstRange).padStart(10, "0");
      return `${String(item.symbolIndex).padStart(10, "0")}\0${contextIndex}\0${firstRangeIndex}`;
    }) ||
    !ranges.every((item) =>
      rangeRecord(
        item,
        functions,
        symbols,
        contexts,
        sources,
        addressSpaces,
        optimizations.length,
        loadUnits.length,
      ),
    ) ||
    !isEvidenceOrdered(ranges, rangeKey) ||
    !optimizations.every((item) => optimizationRecord(item, sources, ranges.length)) ||
    !isEvidenceOrdered(
      optimizations,
      (item) =>
        `${String(item.stage)}\0${String(item.rule)}\0${canonicalEvidenceJson(item.sourceSpans)}`,
    ) ||
    (value.optimization === "none" && optimizations.length !== 0) ||
    !loadUnits.every((item) => loadUnitRecord(item, addressSpaces, loadUnits.length)) ||
    !isEvidenceOrdered(loadUnits, (item) => String(item.name)) ||
    loadUnits.some((item, loadUnitIndex) =>
      (item.residence as Record<string, unknown>[]).some(
        (range) => range.loadUnitIndex !== loadUnitIndex,
      ),
    ) ||
    !validateDebugReverseIndexes(functions, contexts, symbols, locations, ranges, optimizations)
  ) {
    return false;
  }
  const labels = symbols.flatMap((item) => item.labels as string[]);
  if (new Set(labels).size !== labels.length) return false;
  const firstChild = contexts.findIndex(({ kind }) => kind !== "entry");
  return firstChild < 0 || contexts.slice(firstChild).every(({ kind }) => kind !== "entry");
}
