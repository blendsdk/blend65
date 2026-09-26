import type { MemoryEvidence } from "./evidence-types.js";
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

const OWNER_KINDS = new Set([
  "function",
  "helper",
  "symbol",
  "asset",
  "compiler",
  "platform",
  "loadUnit",
]);
const MEMORY_KINDS = new Set([
  "code",
  "initializedData",
  "bss",
  "global",
  "sfa",
  "zeroPage",
  "hardwareStack",
  "asset",
  "helper",
  "loader",
  "scratch",
  "padding",
  "reservation",
  "vector",
  "deviceShadow",
  "replica",
  "existingRom",
  "loadDestination",
]);
const MUTABILITY = new Set(["immutable", "mutable", "reserved"]);
const RESOURCE_CLASSES = new Set(["general", "zeroPage", "hardwareStack", "device"]);

/** Validate one exact source site. */
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

/** Validate one interval owner. */
function owner(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["kind", "id"]) &&
    OWNER_KINDS.has(String(value.kind)) &&
    isEvidenceText(value.id, invalid, ["id"])
  );
}

/** Validate one closed memory origin. */
function origin(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (!isEvidenceRecord(value)) return false;
  switch (value.kind) {
    case "source":
      return (
        hasExactEvidenceKeys(value, ["kind", "site"]) &&
        sourceSite(value.site, (path, detail) => invalid?.(["site", ...path], detail))
      );
    case "asset":
      return (
        hasExactEvidenceKeys(value, ["kind", "assetId"]) &&
        isEvidenceText(value.assetId, invalid, ["assetId"])
      );
    case "import":
      return (
        hasExactEvidenceKeys(value, ["kind", "path", "sha256"]) &&
        isEvidencePath(value.path, invalid, ["path"]) &&
        isEvidenceHash(value.sha256, invalid, ["sha256"])
      );
    case "generated":
      return (
        hasExactEvidenceKeys(value, ["kind", "identity"]) &&
        isEvidenceText(value.identity, invalid, ["identity"])
      );
    default:
      return false;
  }
}

/** Validate one closed contiguity record. */
function contiguity(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "single") return hasExactEvidenceKeys(value, ["kind"]);
  return (
    value.kind === "group" &&
    hasExactEvidenceKeys(value, ["kind", "id", "index", "count"]) &&
    isEvidenceText(value.id, invalid, ["id"]) &&
    isEvidenceCount(value.index, invalid, ["index"]) &&
    isEvidenceCount(value.count, invalid, ["count"]) &&
    value.count > 0 &&
    value.index < value.count
  );
}

/** Validate one exact residency declaration. */
function residency(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (!isEvidenceRecord(value)) return false;
  if (value.kind === "always") {
    return hasExactEvidenceKeys(value, ["kind", "id"]) && isEvidenceText(value.id, invalid, ["id"]);
  }
  return (
    value.kind === "exclusive" &&
    hasExactEvidenceKeys(value, ["kind", "id", "group"]) &&
    isEvidenceText(value.id, invalid, ["id"]) &&
    isEvidenceText(value.group, invalid, ["group"])
  );
}

/** Validate one exact occupied or reserved memory interval. */
function interval(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(
      value,
      [
        "id",
        "addressSpaceId",
        "start",
        "end",
        "size",
        "owner",
        "kind",
        "origin",
        "mutability",
        "alignmentBytes",
        "contiguity",
        "residencyIds",
        "cpuMappings",
        "resourceClass",
        "payloadBytes",
        "paddingBytes",
        "reservedBytes",
      ],
      ["bankId", "noCrossBytes", "vic", "loadUnitId"],
    ) ||
    !isEvidenceText(value.id, invalid, ["id"]) ||
    !isEvidenceText(value.addressSpaceId, invalid, ["addressSpaceId"]) ||
    !isEvidenceCount(value.start, invalid, ["start"]) ||
    !isEvidenceCount(value.end, invalid, ["end"]) ||
    value.start >= value.end ||
    value.end > 0x10000 ||
    !isEvidenceCount(value.size, invalid, ["size"]) ||
    value.size !== value.end - value.start ||
    !owner(value.owner, (path, detail) => invalid?.(["owner", ...path], detail)) ||
    !MEMORY_KINDS.has(String(value.kind)) ||
    !origin(value.origin, (path, detail) => invalid?.(["origin", ...path], detail)) ||
    !MUTABILITY.has(String(value.mutability)) ||
    !isEvidencePowerOfTwo(value.alignmentBytes, invalid, ["alignmentBytes"]) ||
    value.start % value.alignmentBytes !== 0 ||
    !contiguity(value.contiguity, (path, detail) => invalid?.(["contiguity", ...path], detail)) ||
    !areEvidenceStringsOrdered(value.residencyIds) ||
    value.residencyIds.length === 0 ||
    !areEvidenceStringsOrdered(value.cpuMappings) ||
    !RESOURCE_CLASSES.has(String(value.resourceClass)) ||
    !isEvidenceCount(value.payloadBytes, invalid, ["payloadBytes"]) ||
    !isEvidenceCount(value.paddingBytes, invalid, ["paddingBytes"]) ||
    !isEvidenceCount(value.reservedBytes, invalid, ["reservedBytes"]) ||
    value.payloadBytes + value.paddingBytes + value.reservedBytes !== value.size ||
    (value.bankId !== undefined && !isEvidenceText(value.bankId, invalid, ["bankId"])) ||
    (value.loadUnitId !== undefined && !isEvidenceText(value.loadUnitId, invalid, ["loadUnitId"]))
  ) {
    return false;
  }
  if (value.noCrossBytes !== undefined) {
    if (
      !isEvidenceCount(value.noCrossBytes, invalid, ["noCrossBytes"]) ||
      value.noCrossBytes === 0 ||
      Math.floor(value.start / value.noCrossBytes) !==
        Math.floor((value.end - 1) / value.noCrossBytes)
    ) {
      return false;
    }
  }
  if (value.vic !== undefined) {
    if (
      !isEvidenceRecord(value.vic) ||
      !hasExactEvidenceKeys(value.vic, ["bankId", "visibility"]) ||
      !isEvidenceText(value.vic.bankId, invalid, ["vic", "bankId"]) ||
      !areEvidenceStringsOrdered(value.vic.visibility) ||
      (value.bankId !== undefined && value.vic.bankId !== value.bankId)
    ) {
      return false;
    }
  }
  return true;
}

/** Validate one honest low-level unbounded effect. */
function unboundedEffect(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (
    !isEvidenceRecord(value) ||
    !sourceSite(value.site, (path, detail) => invalid?.(["site", ...path], detail))
  )
    return false;
  if (value.kind === "dynamicRead" || value.kind === "dynamicWrite") {
    return (
      hasExactEvidenceKeys(value, ["kind", "site", "addressSpaceId", "accessBytes"]) &&
      isEvidenceText(value.addressSpaceId, invalid, ["addressSpaceId"]) &&
      (isEvidenceCount(value.accessBytes, invalid, ["accessBytes"]) ||
        value.accessBytes === "Unknown")
    );
  }
  return (
    (value.kind === "machineState" || value.kind === "importedCode") &&
    hasExactEvidenceKeys(value, ["kind", "site", "effectClass"]) &&
    isEvidenceText(value.effectClass, invalid, ["effectClass"])
  );
}

/** Validate one free half-open interval. */
function freeInterval(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["start", "end", "size"]) &&
    isEvidenceCount(value.start, invalid, ["start"]) &&
    isEvidenceCount(value.end, invalid, ["end"]) &&
    value.start < value.end &&
    value.end <= 0x10000 &&
    isEvidenceCount(value.size, invalid, ["size"]) &&
    value.size === value.end - value.start
  );
}

/** Validate one reconciled consumer view's direct arithmetic. */
function view(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(
      value,
      [
        "id",
        "consumer",
        "addressSpaceId",
        "start",
        "end",
        "activeResidencyIds",
        "visibility",
        "capacityBytes",
        "occupiedBytes",
        "payloadBytes",
        "paddingBytes",
        "reservedBytes",
        "zeroPageBytes",
        "freeBytes",
        "freeIntervals",
        "largestFreeBytes",
      ],
      ["bankId"],
    ) ||
    !isEvidenceText(value.id, invalid, ["id"]) ||
    (value.consumer !== "cpu" && value.consumer !== "vic") ||
    !isEvidenceText(value.addressSpaceId, invalid, ["addressSpaceId"]) ||
    !isEvidenceCount(value.start, invalid, ["start"]) ||
    !isEvidenceCount(value.end, invalid, ["end"]) ||
    value.start >= value.end ||
    value.end > 0x10000 ||
    !areEvidenceStringsOrdered(value.activeResidencyIds) ||
    !areEvidenceStringsOrdered(value.visibility) ||
    !isEvidenceCount(value.capacityBytes, invalid, ["capacityBytes"]) ||
    value.capacityBytes !== value.end - value.start ||
    !isEvidenceCount(value.occupiedBytes, invalid, ["occupiedBytes"]) ||
    !isEvidenceCount(value.payloadBytes, invalid, ["payloadBytes"]) ||
    !isEvidenceCount(value.paddingBytes, invalid, ["paddingBytes"]) ||
    !isEvidenceCount(value.reservedBytes, invalid, ["reservedBytes"]) ||
    value.payloadBytes + value.paddingBytes + value.reservedBytes !== value.occupiedBytes ||
    !isEvidenceCount(value.zeroPageBytes, invalid, ["zeroPageBytes"]) ||
    !isEvidenceCount(value.freeBytes, invalid, ["freeBytes"]) ||
    value.occupiedBytes + value.freeBytes !== value.capacityBytes ||
    !Array.isArray(value.freeIntervals) ||
    !value.freeIntervals.every((item, index) =>
      freeInterval(item, (path, detail) => invalid?.(["freeIntervals", index, ...path], detail)),
    ) ||
    !isEvidenceOrdered(
      value.freeIntervals as Record<string, unknown>[],
      (item) => `${String(item.start).padStart(5, "0")}\0${String(item.end).padStart(5, "0")}`,
    ) ||
    !isEvidenceCount(value.largestFreeBytes, invalid, ["largestFreeBytes"]) ||
    (value.bankId !== undefined && !isEvidenceText(value.bankId, invalid, ["bankId"]))
  ) {
    return false;
  }
  const free = value.freeIntervals as Record<string, number>[];
  return (
    free.every(
      (item, index) =>
        item.start >= (value.start as number) &&
        item.end <= (value.end as number) &&
        (index === 0 || item.start >= free[index - 1]!.end),
    ) &&
    free.reduce((sum, item) => sum + item.size, 0) === value.freeBytes &&
    Math.max(0, ...free.map(({ size }) => size)) === value.largestFreeBytes
  );
}

/** Validate one bounded stack route. */
function stackDomain(value: unknown, invalid?: EvidenceFieldFailure): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["id", "route", "capacityBytes", "peakBytes", "headroomBytes"]) &&
    isEvidenceText(value.id, invalid, ["id"]) &&
    Array.isArray(value.route) &&
    value.route.length > 0 &&
    value.route.every((item, index) => isEvidenceText(item, invalid, ["route", index])) &&
    isEvidenceCount(value.capacityBytes, invalid, ["capacityBytes"]) &&
    isEvidenceCount(value.peakBytes, invalid, ["peakBytes"]) &&
    isEvidenceCount(value.headroomBytes, invalid, ["headroomBytes"]) &&
    value.peakBytes + value.headroomBytes === value.capacityBytes
  );
}

/** Return the canonical sort key for physical memory intervals. */
function intervalKey(value: Record<string, unknown>): string {
  const itemOwner = value.owner as Record<string, unknown>;
  return `${String(value.addressSpaceId)}\0${String(value.bankId ?? "")}\0${String(value.start).padStart(5, "0")}\0${String(value.end).padStart(5, "0")}\0${String(value.kind)}\0${String(itemOwner.kind)}\0${String(itemOwner.id)}\0${String(value.id)}`;
}

/** Validate contiguity groups have every index exactly once and adjacent ranges. */
function contiguityGroups(intervals: readonly Record<string, unknown>[]): boolean {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const item of intervals) {
    const record = item.contiguity as Record<string, unknown>;
    if (record.kind !== "group") continue;
    const members = groups.get(String(record.id)) ?? [];
    members.push(item);
    groups.set(String(record.id), members);
  }
  return [...groups.values()].every((members) => {
    const sorted = [...members].sort(
      (left, right) =>
        ((left.contiguity as Record<string, number>).index ?? 0) -
        ((right.contiguity as Record<string, number>).index ?? 0),
    );
    const expectedCount = (sorted[0]!.contiguity as Record<string, number>).count;
    return (
      sorted.length === expectedCount &&
      sorted.every((item, index) => {
        const group = item.contiguity as Record<string, number>;
        const prior = sorted[index - 1];
        return (
          group.count === expectedCount &&
          group.index === index &&
          (prior === undefined ||
            (prior.addressSpaceId === item.addressSpaceId &&
              prior.bankId === item.bankId &&
              prior.end === item.start))
        );
      })
    );
  });
}

/** Validate one view against its active occupied intervals and exact free partition. */
function reconcileView(
  selectedView: Record<string, unknown>,
  intervals: readonly Record<string, unknown>[],
): boolean {
  const activeIds = new Set(selectedView.activeResidencyIds as string[]);
  const occupied = intervals
    .filter(
      (item) =>
        item.addressSpaceId === selectedView.addressSpaceId &&
        item.bankId === selectedView.bankId &&
        (item.residencyIds as string[]).some((id) => activeIds.has(id)) &&
        (item.start as number) >= (selectedView.start as number) &&
        (item.end as number) <= (selectedView.end as number),
    )
    .sort((left, right) => (left.start as number) - (right.start as number));
  if (
    occupied.some(
      (item, index) => index > 0 && (item.start as number) < (occupied[index - 1]!.end as number),
    )
  ) {
    return false;
  }
  const free = selectedView.freeIntervals as Record<string, number>[];
  const combined = [
    ...occupied.map((item) => ({ start: item.start as number, end: item.end as number })),
    ...free.map(({ start, end }) => ({ start, end })),
  ].sort((left, right) => left.start - right.start);
  let cursor = selectedView.start as number;
  for (const range of combined) {
    if (range.start !== cursor || range.end <= range.start) return false;
    cursor = range.end;
  }
  return (
    cursor === selectedView.end &&
    occupied.reduce((sum, item) => sum + (item.size as number), 0) === selectedView.occupiedBytes &&
    occupied.reduce((sum, item) => sum + (item.payloadBytes as number), 0) ===
      selectedView.payloadBytes &&
    occupied.reduce((sum, item) => sum + (item.paddingBytes as number), 0) ===
      selectedView.paddingBytes &&
    occupied.reduce((sum, item) => sum + (item.reservedBytes as number), 0) ===
      selectedView.reservedBytes &&
    occupied
      .filter(({ resourceClass }) => resourceClass === "zeroPage")
      .reduce((sum, item) => sum + (item.size as number), 0) === selectedView.zeroPageBytes
  );
}

/** Validate the complete closed memory-evidence version-1 value. */
export function memoryEvidenceValue(
  value: unknown,
  invalid?: EvidenceFieldFailure,
): value is MemoryEvidence {
  if (!isEvidenceRecord(value)) {
    invalid?.([], "record must be an object record");
    return false;
  }
  if (
    !hasExactEvidenceKeys(value, [
      "kind",
      "schemaVersion",
      "profileId",
      "sfaClosureSha256",
      "acmeReconciled",
      "runtimeMemorySafety",
      "residencies",
      "unboundedEffects",
      "intervals",
      "views",
      "stackDomains",
    ])
  ) {
    invalid?.([], "record must contain exactly its required and optional fields");
    return false;
  }
  if (value.kind !== "blend65.memory") {
    invalid?.(["kind"], "kind must identify this artifact family");
    return false;
  }
  if (value.schemaVersion !== 1) {
    invalid?.(["schemaVersion"], "schemaVersion must equal 1");
    return false;
  }
  if (!isEvidenceText(value.profileId, invalid, ["profileId"])) {
    invalid?.(["profileId"], "profileId must contain nonempty text");
    return false;
  }
  if (!isEvidenceHash(value.sfaClosureSha256, invalid, ["sfaClosureSha256"])) {
    invalid?.(["sfaClosureSha256"], "sfaClosureSha256 must be a lowercase SHA-256 digest");
    return false;
  }
  if (value.acmeReconciled !== true) {
    invalid?.(["acmeReconciled"], "acmeReconciled must be true");
    return false;
  }
  if (value.runtimeMemorySafety !== "proved" && value.runtimeMemorySafety !== "unproven") {
    invalid?.(
      ["runtimeMemorySafety"],
      "runtimeMemorySafety must be proved or unproven and agree with unbounded effects",
    );
    return false;
  }
  if (
    !evidenceItems(
      value.residencies,
      (item, _index, report) => residency(item, report),
      invalid,
      ["residencies"],
      "expected an always/exclusive residency record",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(value.residencies as Record<string, unknown>[], (item) => String(item.id))
  ) {
    invalid?.(["residencies"], "residencies must be unique and in canonical order");
    return false;
  }
  if (
    !evidenceItems(
      value.unboundedEffects,
      (item, _index, report) => unboundedEffect(item, report),
      invalid,
      ["unboundedEffects"],
      "expected a source-located unbounded-effect record",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(
      value.unboundedEffects as Record<string, unknown>[],
      (item) => `${canonicalEvidenceJson(item.site)}\0${String(item.kind)}`,
    )
  ) {
    invalid?.(["unboundedEffects"], "unboundedEffects must be unique and in canonical order");
    return false;
  }
  if ((value.runtimeMemorySafety === "unproven") !== value.unboundedEffects.length > 0) {
    invalid?.(
      ["runtimeMemorySafety"],
      "runtimeMemorySafety must be proved or unproven and agree with unbounded effects",
    );
    return false;
  }
  if (
    !evidenceItems(
      value.intervals,
      (item, _index, report) => interval(item, report),
      invalid,
      ["intervals"],
      "expected an interval record with valid owner, range, size, alignment and payload/padding/reservation sum",
    )
  ) {
    return false;
  }
  if (!isEvidenceOrdered(value.intervals as Record<string, unknown>[], intervalKey)) {
    invalid?.(["intervals"], "intervals must be unique and in canonical order");
    return false;
  }
  if (
    !evidenceItems(
      value.views,
      (item, _index, report) => view(item, report),
      invalid,
      ["views"],
      "expected a view record with valid range and capacity/occupied/free byte equations",
    )
  ) {
    return false;
  }
  if (!isEvidenceOrdered(value.views as Record<string, unknown>[], (item) => String(item.id))) {
    invalid?.(["views"], "views must be unique and in canonical order");
    return false;
  }
  if (
    !evidenceItems(
      value.stackDomains,
      (item, _index, report) => stackDomain(item, report),
      invalid,
      ["stackDomains"],
      "expected a stack-domain record with peakBytes + headroomBytes = capacityBytes",
    )
  ) {
    return false;
  }
  if (
    !isEvidenceOrdered(value.stackDomains as Record<string, unknown>[], (item) => String(item.id))
  ) {
    invalid?.(["stackDomains"], "stackDomains must be unique and in canonical order");
    return false;
  }
  const residencies = value.residencies as Record<string, unknown>[];
  const residencyIds = new Set(residencies.map(({ id }) => String(id)));
  const always = residencies.filter(({ kind }) => kind === "always").map(({ id }) => String(id));
  const exclusiveGroup = new Map(
    residencies
      .filter(({ kind }) => kind === "exclusive")
      .map(({ id, group }) => [String(id), String(group)]),
  );
  const intervals = value.intervals as Record<string, unknown>[];
  if (new Set(intervals.map(({ id }) => id)).size !== intervals.length) {
    invalid?.(["intervals"], "interval IDs must be unique and residency references must exist");
    return false;
  }
  if (
    intervals.some((item) => (item.residencyIds as string[]).some((id) => !residencyIds.has(id)))
  ) {
    invalid?.(["intervals"], "interval IDs must be unique and residency references must exist");
    return false;
  }
  if (!contiguityGroups(intervals)) {
    invalid?.(
      ["intervals"],
      "interval contiguity groups must have complete unique indexes and adjacent ranges",
    );
    return false;
  }
  const views = value.views as Record<string, unknown>[];
  if (new Set(views.map(({ id }) => id)).size !== views.length) {
    invalid?.(
      ["views"],
      "views must reconcile occupied/free intervals, valid residencies and exclusive groups",
    );
    return false;
  }
  if (intervals.length > 0 && views.length === 0) {
    invalid?.(["views"], "nonempty intervals require at least one memory view");
    return false;
  }
  if (
    views.some((item) => {
      const active = item.activeResidencyIds as string[];
      if (always.some((id) => !active.includes(id)) || active.some((id) => !residencyIds.has(id))) {
        return true;
      }
      const groups = active
        .map((id) => exclusiveGroup.get(id))
        .filter((group): group is string => group !== undefined);
      return new Set(groups).size !== groups.length || !reconcileView(item, intervals);
    })
  ) {
    invalid?.(
      ["views"],
      "views must reconcile occupied/free intervals, valid residencies and exclusive groups",
    );
    return false;
  }
  if (
    intervals.some(
      (item) =>
        !views.some(
          (selectedView) =>
            selectedView.addressSpaceId === item.addressSpaceId &&
            selectedView.bankId === item.bankId &&
            (item.start as number) >= (selectedView.start as number) &&
            (item.end as number) <= (selectedView.end as number) &&
            (item.residencyIds as string[]).some((id) =>
              (selectedView.activeResidencyIds as string[]).includes(id),
            ),
        ),
    )
  ) {
    invalid?.(
      ["intervals"],
      "each interval must fit a view with a matching address space, bank and active residency",
    );
    return false;
  }
  const projection = intervals
    .filter(
      (item) =>
        new Set(["sfa", "zeroPage", "scratch"]).has(String(item.kind)) &&
        new Set(["function", "helper"]).has(String((item.owner as Record<string, unknown>).kind)),
    )
    .map((item) => {
      const projected: Record<string, unknown> = {
        id: item.id,
        addressSpaceId: item.addressSpaceId,
        start: item.start,
        end: item.end,
        owner: item.owner,
        kind: item.kind,
        resourceClass: item.resourceClass,
        residencyIds: item.residencyIds,
      };
      if (item.bankId !== undefined) projected.bankId = item.bankId;
      return projected;
    });
  if (canonicalEvidenceHash(projection) !== value.sfaClosureSha256) {
    invalid?.(
      ["sfaClosureSha256"],
      "SFA closure digest must match the canonical function/helper storage projection",
    );
    return false;
  }
  return true;
}
