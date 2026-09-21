import type { AssetsEvidence } from "./evidence-types.js";
import {
  areEvidenceStringsOrdered,
  canonicalEvidenceHash,
  canonicalEvidenceJson,
  hasExactEvidenceKeys,
  isEvidenceCount,
  isEvidenceHash,
  isEvidenceOrdered,
  isEvidencePath,
  isEvidencePowerOfTwo,
  isEvidenceRecord,
  isEvidenceText,
} from "./evidence-validation.js";

const ORIGINS = new Set(["source", "handler", "profile"]);
const CONSUMERS = new Set(["cpu", "vic", "player", "loader"]);

/** Validate one closed measured-value union. */
function measuredValue(value: unknown): boolean {
  if (!isEvidenceRecord(value) || !isEvidenceText(value.kind)) return false;
  if (value.kind === "unknown") return hasExactEvidenceKeys(value, ["kind"]);
  if (value.kind === "exact") {
    return hasExactEvidenceKeys(value, ["kind", "value"]) && isEvidenceCount(value.value);
  }
  if (value.kind === "range") {
    return (
      hasExactEvidenceKeys(value, ["kind", "minimum", "maximum"]) &&
      isEvidenceCount(value.minimum) &&
      isEvidenceCount(value.maximum) &&
      value.minimum <= value.maximum
    );
  }
  if (
    value.kind !== "symbolic" ||
    !hasExactEvidenceKeys(value, ["kind", "expression", "variables"])
  ) {
    return false;
  }
  return (
    isEvidenceText(value.expression) &&
    Array.isArray(value.variables) &&
    value.variables.every(
      (variable) =>
        isEvidenceRecord(variable) &&
        hasExactEvidenceKeys(variable, ["name", "minimum", "maximum"]) &&
        isEvidenceText(variable.name) &&
        isEvidenceCount(variable.minimum) &&
        isEvidenceCount(variable.maximum) &&
        variable.minimum <= variable.maximum,
    ) &&
    isEvidenceOrdered(value.variables as Record<string, unknown>[], (variable) =>
      String(variable.name),
    )
  );
}

/** Validate one exact selected-asset input. */
function assetInput(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "bytes", "sha256"]) &&
    isEvidencePath(value.path) &&
    isEvidenceCount(value.bytes) &&
    isEvidenceHash(value.sha256)
  );
}

/** Validate one closed placement constraint. */
function constraint(value: unknown): boolean {
  if (
    !isEvidenceRecord(value) ||
    !isEvidenceText(value.kind) ||
    !ORIGINS.has(String(value.origin))
  ) {
    return false;
  }
  switch (value.kind) {
    case "at":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "addressSpaceId", "start"], ["bankId"]) &&
        isEvidenceText(value.addressSpaceId) &&
        isEvidenceCount(value.start) &&
        value.start <= 0xffff &&
        (value.bankId === undefined || isEvidenceText(value.bankId))
      );
    case "align":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "bytes"]) &&
        isEvidencePowerOfTwo(value.bytes)
      );
    case "noCross":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "boundaryBytes"]) &&
        typeof value.boundaryBytes === "number" &&
        isEvidenceCount(value.boundaryBytes) &&
        value.boundaryBytes > 0
      );
    case "region":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "regionId"]) &&
        isEvidenceText(value.regionId)
      );
    case "visibility":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "consumer", "conditionId"]) &&
        CONSUMERS.has(String(value.consumer)) &&
        isEvidenceText(value.conditionId)
      );
    case "writable":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "startOffset", "endOffset"]) &&
        isEvidenceCount(value.startOffset) &&
        isEvidenceCount(value.endOffset) &&
        value.startOffset < value.endOffset
      );
    case "contiguous":
      return hasExactEvidenceKeys(value, ["kind", "origin"]);
    default:
      return false;
  }
}

/** Validate one payload-relative writable byte interval. */
function byteRange(value: unknown, payloadBytes: number): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["start", "end"]) &&
    isEvidenceCount(value.start) &&
    isEvidenceCount(value.end) &&
    value.start < value.end &&
    value.end <= payloadBytes
  );
}

/** Validate one exact physical copy of a selected value. */
function placedRange(value: unknown, payloadBytes: number): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(
      value,
      [
        "addressSpaceId",
        "start",
        "end",
        "alignmentBytes",
        "paddingBeforeBytes",
        "residencyId",
        "visibility",
        "writableRanges",
      ],
      ["bankId"],
    ) ||
    !isEvidenceText(value.addressSpaceId) ||
    !isEvidenceCount(value.start) ||
    !isEvidenceCount(value.end) ||
    payloadBytes === 0 ||
    value.start >= value.end ||
    value.end > 0x10000 ||
    value.end - value.start !== payloadBytes ||
    !isEvidencePowerOfTwo(value.alignmentBytes) ||
    value.start % value.alignmentBytes !== 0 ||
    !isEvidenceCount(value.paddingBeforeBytes) ||
    !isEvidenceText(value.residencyId) ||
    (value.bankId !== undefined && !isEvidenceText(value.bankId)) ||
    !areEvidenceStringsOrdered(value.visibility) ||
    !Array.isArray(value.writableRanges) ||
    !value.writableRanges.every((range) => byteRange(range, payloadBytes))
  ) {
    return false;
  }
  const ranges = value.writableRanges as Record<string, number>[];
  return ranges.every((range, index) => index === 0 || range.start >= ranges[index - 1]!.end);
}

/** Validate that each physical range directly satisfies locally checkable constraints. */
function constraintsMatch(
  constraints: readonly Record<string, unknown>[],
  ranges: readonly Record<string, unknown>[],
): boolean {
  return ranges.every((range) =>
    constraints.every((item) => {
      switch (item.kind) {
        case "at":
          return (
            range.addressSpaceId === item.addressSpaceId &&
            range.start === item.start &&
            range.bankId === item.bankId
          );
        case "align":
          return (range.start as number) % (item.bytes as number) === 0;
        case "noCross": {
          const boundary = item.boundaryBytes as number;
          return (
            Math.floor((range.start as number) / boundary) ===
            Math.floor(((range.end as number) - 1) / boundary)
          );
        }
        case "visibility":
          return (range.visibility as string[]).includes(item.conditionId as string);
        case "writable":
          return (range.writableRanges as Record<string, unknown>[]).some(
            (candidate) => candidate.start === item.startOffset && candidate.end === item.endOffset,
          );
        default:
          return true;
      }
    }),
  );
}

/** Validate one exact selected asset including identity and placement arithmetic. */
function asset(value: unknown): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, [
      "id",
      "inputs",
      "handler",
      "handlerVersion",
      "selector",
      "logicalType",
      "shape",
      "outputSha256",
      "payloadBytes",
      "emittedBytes",
      "aliases",
      "constraints",
      "placement",
    ]) ||
    !isEvidenceHash(value.id) ||
    !Array.isArray(value.inputs) ||
    !value.inputs.every(assetInput) ||
    !isEvidenceOrdered(
      value.inputs as Record<string, unknown>[],
      (input) => `${String(input.path)}\0${String(input.sha256)}`,
    ) ||
    !isEvidenceText(value.handler) ||
    !isEvidenceText(value.handlerVersion) ||
    !isEvidenceText(value.selector) ||
    !isEvidenceText(value.logicalType) ||
    !Array.isArray(value.shape) ||
    !value.shape.every(isEvidenceCount) ||
    !isEvidenceHash(value.outputSha256) ||
    !isEvidenceCount(value.payloadBytes) ||
    !isEvidenceCount(value.emittedBytes) ||
    !areEvidenceStringsOrdered(value.aliases) ||
    !Array.isArray(value.constraints) ||
    !value.constraints.every(constraint) ||
    !isEvidenceOrdered(
      value.constraints as Record<string, unknown>[],
      (item) => `${String(item.kind)}\0${String(item.origin)}\0${canonicalEvidenceJson(item)}`,
    ) ||
    !isEvidenceRecord(value.placement)
  ) {
    return false;
  }
  const expectedId = canonicalEvidenceHash({
    handler: value.handler,
    handlerVersion: value.handlerVersion,
    selector: value.selector,
    logicalType: value.logicalType,
    shape: value.shape,
    outputSha256: value.outputSha256,
  });
  if (value.id !== expectedId) return false;
  if (
    value.handler === "raw" &&
    (value.handlerVersion !== "1" ||
      value.selector !== "raw" ||
      value.logicalType !== "const byte[]" ||
      value.shape.length !== 1 ||
      value.shape[0] !== value.payloadBytes)
  ) {
    return false;
  }
  const constraints = value.constraints as Record<string, unknown>[];
  const writable = constraints.filter(({ kind }) => kind === "writable");
  if (
    writable.some(
      (range, index) =>
        (range.endOffset as number) > (value.payloadBytes as number) ||
        (index > 0 && (range.startOffset as number) < (writable[index - 1]!.endOffset as number)),
    )
  ) {
    return false;
  }

  const placement = value.placement;
  const payloadBytes = value.payloadBytes as number;
  let ranges: Record<string, unknown>[];
  if (placement.kind === "single") {
    if (
      !hasExactEvidenceKeys(placement, ["kind", "range"]) ||
      !placedRange(placement.range, payloadBytes) ||
      value.emittedBytes !== value.payloadBytes
    ) {
      return false;
    }
    ranges = [placement.range as Record<string, unknown>];
  } else if (placement.kind === "replicated") {
    if (
      !hasExactEvidenceKeys(placement, [
        "kind",
        "copies",
        "consumer",
        "hardwareConstraint",
        "extraBytes",
        "cycleBenefit",
      ]) ||
      !Array.isArray(placement.copies) ||
      placement.copies.length < 2 ||
      !placement.copies.every((range) => placedRange(range, payloadBytes)) ||
      !isEvidenceOrdered(
        placement.copies as Record<string, unknown>[],
        (range) =>
          `${String(range.addressSpaceId)}\0${String(range.bankId ?? "")}\0${String(range.start).padStart(5, "0")}\0${String(range.end).padStart(5, "0")}`,
      ) ||
      !isEvidenceText(placement.consumer) ||
      !isEvidenceText(placement.hardwareConstraint) ||
      !isEvidenceCount(placement.extraBytes) ||
      !measuredValue(placement.cycleBenefit) ||
      value.emittedBytes !== value.payloadBytes * placement.copies.length ||
      placement.extraBytes !== value.emittedBytes - value.payloadBytes
    ) {
      return false;
    }
    ranges = placement.copies as Record<string, unknown>[];
  } else if (placement.kind === "loadable") {
    if (
      !hasExactEvidenceKeys(placement, ["kind", "loadUnitId", "artifactPath", "destinations"]) ||
      !isEvidenceText(placement.loadUnitId) ||
      !isEvidencePath(placement.artifactPath) ||
      !Array.isArray(placement.destinations) ||
      placement.destinations.length === 0 ||
      !placement.destinations.every((range) => placedRange(range, payloadBytes)) ||
      !isEvidenceOrdered(
        placement.destinations as Record<string, unknown>[],
        (range) =>
          `${String(range.addressSpaceId)}\0${String(range.bankId ?? "")}\0${String(range.start).padStart(5, "0")}\0${String(range.end).padStart(5, "0")}`,
      ) ||
      value.emittedBytes !== value.payloadBytes
    ) {
      return false;
    }
    ranges = placement.destinations as Record<string, unknown>[];
  } else {
    return false;
  }
  return constraintsMatch(constraints, ranges);
}

/** Validate the complete closed assets-evidence version-1 value. */
export function assetsEvidenceValue(value: unknown): value is AssetsEvidence {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["kind", "schemaVersion", "assets"]) &&
    value.kind === "blend65.assets" &&
    value.schemaVersion === 1 &&
    Array.isArray(value.assets) &&
    value.assets.every(asset) &&
    isEvidenceOrdered(value.assets as Record<string, unknown>[], (item) => String(item.id))
  );
}
