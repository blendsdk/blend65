import type { EvidenceFieldFailure } from "./evidence-diagnostics.js";
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
export function identity(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["name", "version", "sha256"]) &&
    isEvidenceText(value.name, invalid, ["name"]) &&
    isEvidenceText(value.version, invalid, ["version"]) &&
    isEvidenceHash(value.sha256, invalid, ["sha256"])
  );
}

/** Validate one portable output-affecting tool record. */
export function tool(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["name", "version", "semanticOptions"]) &&
    isEvidenceText(value.name, invalid, ["name"]) &&
    isEvidenceText(value.version, invalid, ["version"]) &&
    Array.isArray(value.semanticOptions) &&
    value.semanticOptions.every((item, index) =>
      isEvidenceText(item, invalid, ["semanticOptions", index]),
    )
  );
}

/** Validate one generation-relative artifact identity. */
export function artifact(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "kind", "sha256"]) &&
    isEvidencePath(value.path, invalid, ["path"]) &&
    isEvidenceText(value.kind, invalid, ["kind"]) &&
    isEvidenceHash(value.sha256, invalid, ["sha256"])
  );
}

/** Validate one source-indexed half-open byte span. */
function span(
  value: unknown,
  sources: readonly Record<string, unknown>[],
  invalid?: EvidenceFieldFailure,
): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, ["sourceIndex", "startByte", "endByte"]) ||
    !isEvidenceCount(value.sourceIndex, invalid, ["sourceIndex"]) ||
    value.sourceIndex >= sources.length ||
    !isEvidenceCount(value.startByte, invalid, ["startByte"]) ||
    !isEvidenceCount(value.endByte, invalid, ["endByte"]) ||
    value.startByte > value.endByte
  ) {
    return false;
  }
  return value.endByte <= (sources[value.sourceIndex]!.byteLength as number);
}

/** Validate one source or generated origin. */
function origin(
  value: unknown,
  sources: readonly Record<string, unknown>[],
  invalid?: EvidenceFieldFailure,
): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "source") {
    return (
      hasExactEvidenceKeys(value, ["kind", "span"]) &&
      span(value.span, sources, (path, detail) => invalid?.(["span", ...path], detail))
    );
  }
  return (
    value.kind === "generated" &&
    hasExactEvidenceKeys(value, ["kind", "cause"], ["sourceSpan"]) &&
    GENERATED_CAUSES.has(String(value.cause)) &&
    (value.sourceSpan === undefined ||
      span(value.sourceSpan, sources, (path, detail) => invalid?.(["sourceSpan", ...path], detail)))
  );
}

/** Validate one indexed machine range against address-space and load-unit tables. */
function machineRange(
  value: unknown,
  addressSpaces: readonly Record<string, unknown>[],
  loadUnitCount: number,
  invalid?: EvidenceFieldFailure,
): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(
      value,
      ["addressSpaceIndex", "start", "end"],
      ["bankIndex", "loadUnitIndex"],
    ) ||
    !isEvidenceCount(value.addressSpaceIndex, invalid, ["addressSpaceIndex"]) ||
    value.addressSpaceIndex >= addressSpaces.length ||
    !isEvidenceCount(value.start, invalid, ["start"]) ||
    !isEvidenceCount(value.end, invalid, ["end"]) ||
    value.start >= value.end
  ) {
    return false;
  }
  const addressSpace = addressSpaces[value.addressSpaceIndex]!;
  const banks = addressSpace.banks as Record<string, unknown>[];
  if (value.end > (addressSpace.sizeBytes as number)) return false;
  if (
    banks.length === 0
      ? value.bankIndex !== undefined
      : !isEvidenceCount(value.bankIndex, invalid, ["bankIndex"])
  ) {
    return false;
  }
  if (
    value.bankIndex !== undefined &&
    (!isEvidenceCount(value.bankIndex, invalid, ["bankIndex"]) || value.bankIndex >= banks.length)
  )
    return false;
  return (
    value.loadUnitIndex === undefined ||
    (isEvidenceCount(value.loadUnitIndex, invalid, ["loadUnitIndex"]) &&
      value.loadUnitIndex < loadUnitCount)
  );
}

/** Validate one source inventory record. */
export function source(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, ["path", "byteLength", "sha256"], ["lineStarts"]) ||
    !isEvidencePath(value.path, invalid, ["path"]) ||
    !isEvidenceCount(value.byteLength, invalid, ["byteLength"]) ||
    !isEvidenceHash(value.sha256, invalid, ["sha256"])
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
export function assetInput(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "sha256", "handler", "handlerVersion", "selector"]) &&
    isEvidencePath(value.path, invalid, ["path"]) &&
    isEvidenceHash(value.sha256, invalid, ["sha256"]) &&
    isEvidenceText(value.handler, invalid, ["handler"]) &&
    isEvidenceText(value.handlerVersion, invalid, ["handlerVersion"]) &&
    isEvidenceText(value.selector, invalid, ["selector"]) &&
    (value.handler !== "raw" || (value.handlerVersion === "1" && value.selector === "raw"))
  );
}

/** Validate one machine address-space record. */
export function addressSpace(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["id", "kind", "sizeBytes", "banks"]) &&
    isEvidenceText(value.id, invalid, ["id"]) &&
    ADDRESS_SPACE_KINDS.has(String(value.kind)) &&
    isEvidenceCount(value.sizeBytes, invalid, ["sizeBytes"]) &&
    value.sizeBytes > 0 &&
    Array.isArray(value.banks) &&
    value.banks.every(
      (bank, itemIndex) =>
        isEvidenceRecord(bank) &&
        hasExactEvidenceKeys(bank, ["id", "visibility"]) &&
        isEvidenceText(bank.id, invalid, ["banks", itemIndex, "id"]) &&
        areEvidenceStringsOrdered(bank.visibility),
    ) &&
    isEvidenceOrdered(value.banks as Record<string, unknown>[], (bank) => String(bank.id)) &&
    ((value.kind === "cpu" && value.banks.length === 0) || value.kind !== "cpu") &&
    ((value.kind === "banked" && value.banks.length > 0) || value.kind !== "banked")
  );
}

/** Validate one function and its entry variants before resolving range references. */
export function functionRecord(
  value: unknown,
  sources: readonly Record<string, unknown>[],
  invalid?: EvidenceFieldFailure,
): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, [
      "qualifiedName",
      "kind",
      "declaration",
      "entryVariants",
      "rangeIndexes",
    ]) &&
    isEvidenceText(value.qualifiedName, invalid, ["qualifiedName"]) &&
    (value.kind === "ordinary" || value.kind === "interrupt") &&
    span(value.declaration, sources, (path, detail) =>
      invalid?.(["declaration", ...path], detail),
    ) &&
    Array.isArray(value.entryVariants) &&
    value.entryVariants.length > 0 &&
    value.entryVariants.every(
      (variant, itemIndex) =>
        isEvidenceRecord(variant) &&
        hasExactEvidenceKeys(variant, ["id", "kind", "label", "rangeIndexes"]) &&
        isEvidenceText(variant.id, invalid, ["entryVariants", itemIndex, "id"]) &&
        isEvidenceText(variant.kind, invalid, ["entryVariants", itemIndex, "kind"]) &&
        isEvidenceText(variant.label, invalid, ["entryVariants", itemIndex, "label"]) &&
        Array.isArray(variant.rangeIndexes),
    ) &&
    isEvidenceOrdered(value.entryVariants as Record<string, unknown>[], (variant) =>
      String(variant.id),
    ) &&
    Array.isArray(value.rangeIndexes)
  );
}

/** Validate one execution context and its tag-dependent fields. */
export function contextRecord(
  value: unknown,
  index: number,
  functions: readonly Record<string, unknown>[],
  sources: readonly Record<string, unknown>[],
  invalid?: EvidenceFieldFailure,
): boolean {
  if (
    !isEvidenceRecord(value) ||
    !isEvidenceCount(value.functionIndex, invalid, ["functionIndex"]) ||
    value.functionIndex >= functions.length
  ) {
    return false;
  }
  if (value.kind === "entry") {
    return (
      hasExactEvidenceKeys(value, ["kind", "functionIndex", "entryVariantIndex"]) &&
      isEvidenceCount(value.entryVariantIndex, invalid, ["entryVariantIndex"]) &&
      value.entryVariantIndex <
        (functions[value.functionIndex]!.entryVariants as Record<string, unknown>[]).length
    );
  }
  return (
    (value.kind === "call" || value.kind === "inlined") &&
    hasExactEvidenceKeys(value, ["kind", "functionIndex", "parentContextIndex", "callSite"]) &&
    isEvidenceCount(value.parentContextIndex, invalid, ["parentContextIndex"]) &&
    value.parentContextIndex < index &&
    span(value.callSite, sources, (path, detail) => invalid?.(["callSite", ...path], detail))
  );
}

/** Validate one source or generated symbol before resolving its locations. */
export function symbolRecord(
  value: unknown,
  sources: readonly Record<string, unknown>[],
  invalid?: EvidenceFieldFailure,
): boolean {
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
    isEvidenceText(value.name, invalid, ["name"]) &&
    isEvidenceText(value.qualifiedName, invalid, ["qualifiedName"]) &&
    SYMBOL_KINDS.has(String(value.kind)) &&
    isEvidenceText(value.type, invalid, ["type"]) &&
    isEvidenceCount(value.byteWidth, invalid, ["byteWidth"]) &&
    Array.isArray(value.shape) &&
    value.shape.every(
      (extent, itemIndex) =>
        extent === "unsized" || isEvidenceCount(extent, invalid, ["shape", itemIndex]),
    ) &&
    value.shape.every(
      (extent, index) => extent !== "unsized" || (value.kind === "parameter" && index === 0),
    ) &&
    symbolShapeMatchesType(value) &&
    isEvidenceText(value.scope, invalid, ["scope"]) &&
    origin(value.origin, sources, (path, detail) => invalid?.(["origin", ...path], detail)) &&
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
  invalid?: EvidenceFieldFailure,
): boolean {
  if (!isEvidenceRecord(value)) return false;
  const representedWidth = symbol.byteWidth as number;
  if (value.kind === "available" || value.kind === "split") {
    if (
      !hasExactEvidenceKeys(value, ["kind", "pieces"]) ||
      !Array.isArray(value.pieces) ||
      value.pieces.length < (value.kind === "split" ? 2 : 1) ||
      !value.pieces.every((piece, itemIndex) => {
        if (!isEvidenceRecord(piece)) return false;
        if (piece.kind === "memory") {
          return (
            hasExactEvidenceKeys(piece, ["kind", "machine", "valueOffset", "byteLength"]) &&
            machineRange(piece.machine, addressSpaces, loadUnitCount, (path, detail) =>
              invalid?.(["pieces", itemIndex, "machine", ...path], detail),
            ) &&
            isEvidenceCount(piece.valueOffset, invalid, ["pieces", itemIndex, "valueOffset"]) &&
            isEvidenceCount(piece.byteLength, invalid, ["pieces", itemIndex, "byteLength"]) &&
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
          isEvidenceCount(piece.valueOffset, invalid, ["pieces", itemIndex, "valueOffset"]) &&
          isEvidenceCount(piece.byteLength, invalid, ["pieces", itemIndex, "byteLength"]) &&
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
      isEvidenceHex(value.bytesHex, invalid, ["bytesHex"]) &&
      value.bytesHex.length === representedWidth * 2
    );
  }
  if (value.kind === "rematerializable") {
    return (
      hasExactEvidenceKeys(value, ["kind", "rule", "operandSymbolIndexes"]) &&
      isEvidenceText(value.rule, invalid, ["rule"]) &&
      areEvidenceIndexes(value.operandSymbolIndexes, symbolCount)
    );
  }
  if (value.kind === "optimizedAway") {
    return (
      hasExactEvidenceKeys(value, ["kind", "rule"]) && isEvidenceText(value.rule, invalid, ["rule"])
    );
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
export function locationRecord(
  value: unknown,
  symbols: readonly Record<string, unknown>[],
  contexts: readonly Record<string, unknown>[],
  addressSpaces: readonly Record<string, unknown>[],
  rangeCount: number,
  loadUnitCount: number,
  invalid?: EvidenceFieldFailure,
): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(
      value,
      ["symbolIndex", "liveRangeIndexes", "availability"],
      ["contextIndex"],
    ) ||
    !isEvidenceCount(value.symbolIndex, invalid, ["symbolIndex"]) ||
    value.symbolIndex >= symbols.length ||
    !areEvidenceIndexes(value.liveRangeIndexes, rangeCount) ||
    (value.contextIndex !== undefined &&
      (!isEvidenceCount(value.contextIndex, invalid, ["contextIndex"]) ||
        value.contextIndex >= contexts.length)) ||
    !availability(
      value.availability,
      symbols[value.symbolIndex]!,
      addressSpaces,
      loadUnitCount,
      symbols.length,
      (path, detail) => invalid?.(["availability", ...path], detail),
    )
  ) {
    return false;
  }
  const kind = String(symbols[value.symbolIndex]!.kind);
  if (CONTEXT_SYMBOLS.has(kind) && value.contextIndex === undefined) return false;
  if (CONTEXT_FREE_SYMBOLS.has(kind) && value.contextIndex !== undefined) return false;
  // An erased zero-byte object still belongs to its valid execution context,
  // but cannot require an instruction or a nonempty physical memory range.
  const zeroByteMarker =
    symbols[value.symbolIndex]!.byteWidth === 0 &&
    isEvidenceRecord(value.availability) &&
    value.availability.kind === "optimizedAway";
  return value.liveRangeIndexes.length > 0 || value.contextIndex === undefined || zeroByteMarker;
}

/** Validate one range owner and its referenced index. */
function rangeOwner(
  value: unknown,
  functionCount: number,
  symbolCount: number,
  invalid?: EvidenceFieldFailure,
): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "function") {
    return (
      hasExactEvidenceKeys(value, ["kind", "functionIndex"]) &&
      isEvidenceCount(value.functionIndex, invalid, ["functionIndex"]) &&
      value.functionIndex < functionCount
    );
  }
  if (value.kind === "symbol") {
    return (
      hasExactEvidenceKeys(value, ["kind", "symbolIndex"]) &&
      isEvidenceCount(value.symbolIndex, invalid, ["symbolIndex"]) &&
      value.symbolIndex < symbolCount
    );
  }
  return (
    value.kind === "platform" &&
    hasExactEvidenceKeys(value, ["kind", "name"]) &&
    isEvidenceText(value.name, invalid, ["name"])
  );
}

/** Validate one final machine range before reverse-reference checks. */
export function rangeRecord(
  value: unknown,
  functions: readonly Record<string, unknown>[],
  symbols: readonly Record<string, unknown>[],
  contexts: readonly Record<string, unknown>[],
  sources: readonly Record<string, unknown>[],
  addressSpaces: readonly Record<string, unknown>[],
  optimizationCount: number,
  loadUnitCount: number,
  invalid?: EvidenceFieldFailure,
): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(
      value,
      ["machine", "origin", "owner", "optimizationIndexes"],
      ["contextIndex"],
    ) ||
    !machineRange(value.machine, addressSpaces, loadUnitCount, (path, detail) =>
      invalid?.(["machine", ...path], detail),
    ) ||
    !origin(value.origin, sources, (path, detail) => invalid?.(["origin", ...path], detail)) ||
    !rangeOwner(value.owner, functions.length, symbols.length, (path, detail) =>
      invalid?.(["owner", ...path], detail),
    ) ||
    !areEvidenceIndexes(value.optimizationIndexes, optimizationCount) ||
    (value.contextIndex !== undefined &&
      (!isEvidenceCount(value.contextIndex, invalid, ["contextIndex"]) ||
        value.contextIndex >= contexts.length))
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
export function optimizationRecord(
  value: unknown,
  sources: readonly Record<string, unknown>[],
  rangeCount: number,
  invalid?: EvidenceFieldFailure,
): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["stage", "rule", "result", "sourceSpans", "outputRangeIndexes"]) &&
    isEvidenceText(value.stage, invalid, ["stage"]) &&
    isEvidenceText(value.rule, invalid, ["rule"]) &&
    OPTIMIZATION_RESULTS.has(String(value.result)) &&
    Array.isArray(value.sourceSpans) &&
    value.sourceSpans.every((item, itemIndex) =>
      span(item, sources, (path, detail) => invalid?.(["sourceSpans", itemIndex, ...path], detail)),
    ) &&
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
export function loadUnitRecord(
  value: unknown,
  addressSpaces: readonly Record<string, unknown>[],
  loadUnitCount: number,
  invalid?: EvidenceFieldFailure,
): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["name", "kind", "publication", "artifact", "residence"]) &&
    isEvidenceText(value.name, invalid, ["name"]) &&
    (value.kind === "resident" || value.kind === "loadable") &&
    (value.publication === "primary" || value.publication === "contained") &&
    artifact(value.artifact, (path, detail) => invalid?.(["artifact", ...path], detail)) &&
    Array.isArray(value.residence) &&
    value.residence.every((item, itemIndex) =>
      machineRange(item, addressSpaces, loadUnitCount, (path, detail) =>
        invalid?.(["residence", itemIndex, ...path], detail),
      ),
    ) &&
    isEvidenceOrdered(
      value.residence as Record<string, unknown>[],
      (item) =>
        `${String(item.addressSpaceIndex).padStart(10, "0")}\0${String(item.bankIndex ?? "")}\0${String(item.start).padStart(16, "0")}`,
    )
  );
}

/** Return the canonical machine-range root sort key. */
export function rangeKey(value: Record<string, unknown>): string {
  const machine = value.machine as Record<string, unknown>;
  const bankIndex =
    machine.bankIndex === undefined ? "" : String(machine.bankIndex).padStart(10, "0");
  const loadUnitIndex =
    machine.loadUnitIndex === undefined ? "" : String(machine.loadUnitIndex).padStart(10, "0");
  return `${String(machine.addressSpaceIndex).padStart(10, "0")}\0${bankIndex}\0${loadUnitIndex}\0${String(machine.start).padStart(16, "0")}\0${String(machine.end).padStart(16, "0")}\0${canonicalEvidenceJson(value.origin)}`;
}
