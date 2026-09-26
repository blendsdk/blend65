import type { AssetsEvidence } from "./evidence-types.js";
import type { EvidenceFieldFailure } from "./evidence-diagnostics.js";
import {
  areEvidenceStringsOrdered,
  evidenceItems,
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
function measuredValue(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (!isEvidenceRecord(value) || !isEvidenceText(value.kind, invalid, ["kind"])) return false;
  if (value.kind === "unknown") return hasExactEvidenceKeys(value, ["kind"]);
  if (value.kind === "exact") {
    return (
      hasExactEvidenceKeys(value, ["kind", "value"]) &&
      isEvidenceCount(value.value, invalid, ["value"])
    );
  }
  if (value.kind === "range") {
    return (
      hasExactEvidenceKeys(value, ["kind", "minimum", "maximum"]) &&
      isEvidenceCount(value.minimum, invalid, ["minimum"]) &&
      isEvidenceCount(value.maximum, invalid, ["maximum"]) &&
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
    isEvidenceText(value.expression, invalid, ["expression"]) &&
    Array.isArray(value.variables) &&
    value.variables.every(
      (variable, itemIndex) =>
        isEvidenceRecord(variable) &&
        hasExactEvidenceKeys(variable, ["name", "minimum", "maximum"]) &&
        isEvidenceText(variable.name, invalid, ["variables", itemIndex, "name"]) &&
        isEvidenceCount(variable.minimum, invalid, ["variables", itemIndex, "minimum"]) &&
        isEvidenceCount(variable.maximum, invalid, ["variables", itemIndex, "maximum"]) &&
        variable.minimum <= variable.maximum,
    ) &&
    isEvidenceOrdered(value.variables as Record<string, unknown>[], (variable) =>
      String(variable.name),
    )
  );
}

/** Validate one exact selected-asset input. */
function assetInput(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["path", "bytes", "sha256"]) &&
    isEvidencePath(value.path, invalid, ["path"]) &&
    isEvidenceCount(value.bytes, invalid, ["bytes"]) &&
    isEvidenceHash(value.sha256, invalid, ["sha256"])
  );
}

/** Validate one closed placement constraint. */
function constraint(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (
    !isEvidenceRecord(value) ||
    !isEvidenceText(value.kind, invalid, ["kind"]) ||
    !ORIGINS.has(String(value.origin))
  ) {
    return false;
  }
  switch (value.kind) {
    case "at":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "addressSpaceId", "start"], ["bankId"]) &&
        isEvidenceText(value.addressSpaceId, invalid, ["addressSpaceId"]) &&
        isEvidenceCount(value.start, invalid, ["start"]) &&
        value.start <= 0xffff &&
        (value.bankId === undefined || isEvidenceText(value.bankId, invalid, ["bankId"]))
      );
    case "align":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "bytes"]) &&
        isEvidencePowerOfTwo(value.bytes, invalid, ["bytes"])
      );
    case "noCross":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "boundaryBytes"]) &&
        typeof value.boundaryBytes === "number" &&
        isEvidenceCount(value.boundaryBytes, invalid, ["boundaryBytes"]) &&
        value.boundaryBytes > 0
      );
    case "region":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "regionId"]) &&
        isEvidenceText(value.regionId, invalid, ["regionId"])
      );
    case "visibility":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "consumer", "conditionId"]) &&
        CONSUMERS.has(String(value.consumer)) &&
        isEvidenceText(value.conditionId, invalid, ["conditionId"])
      );
    case "writable":
      return (
        hasExactEvidenceKeys(value, ["kind", "origin", "startOffset", "endOffset"]) &&
        isEvidenceCount(value.startOffset, invalid, ["startOffset"]) &&
        isEvidenceCount(value.endOffset, invalid, ["endOffset"]) &&
        value.startOffset < value.endOffset
      );
    case "contiguous":
      return hasExactEvidenceKeys(value, ["kind", "origin"]);
    default:
      return false;
  }
}

/** Validate one payload-relative writable byte interval. */
function byteRange(value: unknown, payloadBytes: number, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["start", "end"]) &&
    isEvidenceCount(value.start, invalid, ["start"]) &&
    isEvidenceCount(value.end, invalid, ["end"]) &&
    value.start < value.end &&
    value.end <= payloadBytes
  );
}

/** Validate one exact physical copy of a selected value. */
function placedRange(
  value: unknown,
  payloadBytes: number,
  invalid?: EvidenceFieldFailure,
): boolean {
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
    !isEvidenceText(value.addressSpaceId, invalid, ["addressSpaceId"]) ||
    !isEvidenceCount(value.start, invalid, ["start"]) ||
    !isEvidenceCount(value.end, invalid, ["end"]) ||
    payloadBytes === 0 ||
    value.start >= value.end ||
    value.end > 0x10000 ||
    value.end - value.start !== payloadBytes ||
    !isEvidencePowerOfTwo(value.alignmentBytes, invalid, ["alignmentBytes"]) ||
    value.start % value.alignmentBytes !== 0 ||
    !isEvidenceCount(value.paddingBeforeBytes, invalid, ["paddingBeforeBytes"]) ||
    !isEvidenceText(value.residencyId, invalid, ["residencyId"]) ||
    (value.bankId !== undefined && !isEvidenceText(value.bankId, invalid, ["bankId"])) ||
    !areEvidenceStringsOrdered(value.visibility) ||
    !Array.isArray(value.writableRanges) ||
    !value.writableRanges.every((range, itemIndex) =>
      byteRange(range, payloadBytes, (path, detail) =>
        invalid?.(["writableRanges", itemIndex, ...path], detail),
      ),
    )
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
function asset(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (!isEvidenceRecord(value)) {
    invalid?.([], "record must be an object record");
    return false;
  }
  if (
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
    ])
  ) {
    invalid?.([], "record must contain exactly its required and optional fields");
    return false;
  }
  if (!isEvidenceHash(value.id, invalid, ["id"])) {
    invalid?.(["id"], "id must be a lowercase SHA-256 digest");
    return false;
  }
  if (!Array.isArray(value.inputs)) {
    invalid?.(["inputs"], "inputs must be an array of valid records");
    return false;
  }
  if (
    !value.inputs.every((item, index) =>
      assetInput(item, (path, detail) => invalid?.(["inputs", index, ...path], detail)),
    )
  ) {
    invalid?.(
      ["inputs"],
      "inputs records must have valid required fields, unique identities and in-bounds references",
    );
    return false;
  }
  if (
    !isEvidenceOrdered(
      value.inputs as Record<string, unknown>[],
      (input) => `${String(input.path)}\0${String(input.sha256)}`,
    )
  ) {
    invalid?.(["inputs"], "inputs must be unique and in canonical order");
    return false;
  }
  if (!isEvidenceText(value.handler, invalid, ["handler"])) {
    invalid?.(["handler"], "handler must contain nonempty text");
    return false;
  }
  if (!isEvidenceText(value.handlerVersion, invalid, ["handlerVersion"])) {
    invalid?.(["handlerVersion"], "handlerVersion must contain nonempty text");
    return false;
  }
  if (!isEvidenceText(value.selector, invalid, ["selector"])) {
    invalid?.(["selector"], "selector must contain nonempty text");
    return false;
  }
  if (!isEvidenceText(value.logicalType, invalid, ["logicalType"])) {
    invalid?.(["logicalType"], "logicalType must contain nonempty text");
    return false;
  }
  if (!Array.isArray(value.shape)) {
    invalid?.(["shape"], "shape must be an array of valid records");
    return false;
  }
  if (!value.shape.every((item, index) => isEvidenceCount(item, invalid, ["shape", index]))) {
    invalid?.(["shape"], "shape must be a nonnegative safe integer");
    return false;
  }
  if (!isEvidenceHash(value.outputSha256, invalid, ["outputSha256"])) {
    invalid?.(["outputSha256"], "outputSha256 must be a lowercase SHA-256 digest");
    return false;
  }
  if (!isEvidenceCount(value.payloadBytes, invalid, ["payloadBytes"])) {
    invalid?.(["payloadBytes"], "payloadBytes must be a nonnegative safe integer");
    return false;
  }
  if (!isEvidenceCount(value.emittedBytes, invalid, ["emittedBytes"])) {
    invalid?.(["emittedBytes"], "emittedBytes must be a nonnegative safe integer");
    return false;
  }
  if (!areEvidenceStringsOrdered(value.aliases)) {
    invalid?.(
      ["aliases"],
      "aliases records must have valid required fields, unique identities and in-bounds references",
    );
    return false;
  }
  if (!Array.isArray(value.constraints)) {
    invalid?.(["constraints"], "constraints must be an array of valid records");
    return false;
  }
  if (
    !value.constraints.every((item, index) =>
      constraint(item, (path, detail) => invalid?.(["constraints", index, ...path], detail)),
    )
  ) {
    invalid?.(
      ["constraints"],
      "constraints records must have valid required fields, unique identities and in-bounds references",
    );
    return false;
  }
  if (
    !isEvidenceOrdered(
      value.constraints as Record<string, unknown>[],
      (item) => `${String(item.kind)}\0${String(item.origin)}\0${canonicalEvidenceJson(item)}`,
    )
  ) {
    invalid?.(["constraints"], "constraints must be unique and in canonical order");
    return false;
  }
  if (!isEvidenceRecord(value.placement)) {
    invalid?.(["placement"], "placement must be an object record");
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
  if (value.id !== expectedId) {
    invalid?.(
      ["id"],
      "asset ID must equal the canonical hash of its handler, selector, type, shape and output digest",
    );
    return false;
  }
  if (
    value.handler === "raw" &&
    (value.handlerVersion !== "1" ||
      value.selector !== "raw" ||
      value.logicalType !== "const byte[]" ||
      value.shape.length !== 1 ||
      value.shape[0] !== value.payloadBytes)
  ) {
    invalid?.(
      [],
      "raw asset version, selector, type and one-dimensional shape must match its payload byte count",
    );
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
    invalid?.(
      ["constraints"],
      "writable ranges must be non-overlapping and lie within payloadBytes",
    );
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
      invalid?.(
        [],
        "single placement must have a valid payload range and emittedBytes must equal payloadBytes",
      );
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
      invalid?.(
        [],
        "replicated placement must have ordered valid copies and emitted/extra bytes must reconcile with payloadBytes and copy count",
      );
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
      invalid?.(
        [],
        "loadable placement must have a valid load unit, artifact path and destinations; emittedBytes must equal payloadBytes",
      );
      return false;
    }
    ranges = placement.destinations as Record<string, unknown>[];
  } else {
    invalid?.(["placement", "kind"], "placement must be single, replicated or loadable");
    return false;
  }
  if (!constraintsMatch(constraints, ranges)) {
    invalid?.([], "physical placement ranges must satisfy every declared asset constraint");
    return false;
  }
  return true;
}

/** Validate the complete closed assets-evidence version-1 value. */
export function assetsEvidenceValue(
  value: unknown,
  invalid?: EvidenceFieldFailure,
): value is AssetsEvidence {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, ["kind", "schemaVersion", "assets"]) ||
    value.kind !== "blend65.assets" ||
    value.schemaVersion !== 1
  ) {
    invalid?.([], "expected an assets record with exactly kind, schemaVersion and assets");
    return false;
  }
  if (
    !evidenceItems(
      value.assets,
      (item, _index, report) => asset(item, report),
      invalid,
      ["assets"],
      "expected an asset record",
    )
  )
    return false;
  if (!isEvidenceOrdered(value.assets as Record<string, unknown>[], (item) => String(item.id))) {
    invalid?.(["assets"], "asset IDs must be unique and in canonical order");
    return false;
  }
  return true;
}
