import type { CostsEvidence } from "./evidence-types.js";
import {
  areEvidenceStringsOrdered,
  canonicalEvidenceJson,
  hasExactEvidenceKeys,
  isEvidenceCount,
  isEvidenceOrdered,
  isEvidencePath,
  isEvidenceRecord,
  isEvidenceText,
} from "./evidence-validation.js";

const OPTIMIZATION = new Set(["none", "balanced", "speed", "size"]);
const OWNER_KINDS = new Set([
  "function",
  "symbol",
  "asset",
  "compiler",
  "platform",
  "loadUnit",
  "candidate",
]);
const COMPONENTS = new Set([
  "code",
  "initializedData",
  "bss",
  "global",
  "sfa",
  "zeroPage",
  "hardwareStack",
  "asset",
  "helper",
  "table",
  "loader",
  "scratch",
  "padding",
  "reservation",
  "diskFile",
  "diskMetadata",
  "sectorOverhead",
  "existingRom",
  "callSite",
  "startup",
  "exit",
  "branchRepair",
  "replication",
  "platform",
]);
const PROGRAM_COMPONENTS = new Set([
  "code",
  "initializedData",
  "asset",
  "helper",
  "table",
  "loader",
  "padding",
  "callSite",
  "startup",
  "exit",
  "branchRepair",
  "replication",
  "platform",
]);
const RESIDENT_COMPONENTS = new Set([
  ...PROGRAM_COMPONENTS,
  "bss",
  "global",
  "sfa",
  "zeroPage",
  "hardwareStack",
  "scratch",
  "reservation",
]);
const DISK_FORBIDDEN = new Set([
  "bss",
  "sfa",
  "zeroPage",
  "hardwareStack",
  "scratch",
  "reservation",
  "existingRom",
]);
const REJECTION_KINDS = new Set([
  "semantics",
  "timing",
  "memory",
  "zeroPage",
  "stack",
  "sfa",
  "scratch",
  "layout",
  "banking",
  "loading",
  "packaging",
  "cpu",
  "safety",
  "unknownCost",
]);
const CLOSURE_POINTS = new Set([
  "local",
  "function",
  "wholeProgram",
  "postLayout",
  "postPackaging",
]);
const STANDARD_RESOURCES = ["zeroPage", "residentRam", "hardwareStack", "scratch"] as const;

/** Validate one source site used by cost attribution. */
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

/** Validate a canonical source-site array. */
function sourceSites(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(sourceSite) &&
    isEvidenceOrdered(
      value as Record<string, unknown>[],
      (site) =>
        `${String(site.path)}\0${String(site.startByte).padStart(16, "0")}\0${String(site.endByte).padStart(16, "0")}`,
    )
  );
}

/** Validate one closed measured-value union. */
function measuredValue(value: unknown): boolean {
  if (!isEvidenceRecord(value)) return false;
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
  return (
    value.kind === "symbolic" &&
    hasExactEvidenceKeys(value, ["kind", "expression", "variables"]) &&
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

/** Validate one exact cost owner. */
function owner(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["kind", "id"]) &&
    OWNER_KINDS.has(String(value.kind)) &&
    isEvidenceText(value.id)
  );
}

/** Return whether one byte accounting/component pair is admitted. */
function admittedPair(accounting: unknown, component: unknown): boolean {
  if (!isEvidenceText(accounting) || !COMPONENTS.has(String(component))) return false;
  switch (accounting) {
    case "program":
      return PROGRAM_COMPONENTS.has(String(component));
    case "residentRam":
      return RESIDENT_COMPONENTS.has(String(component));
    case "zeroPage":
      return new Set(["sfa", "zeroPage", "scratch", "reservation"]).has(String(component));
    case "sfa":
      return component === "sfa";
    case "hardwareStack":
      return component === "hardwareStack";
    case "scratch":
      return component === "scratch";
    case "diskFile":
    case "diskContainer":
      return !DISK_FORBIDDEN.has(String(component));
    case "existingRom":
      return component === "existingRom";
    default:
      return false;
  }
}

/** Validate one exact machine-traffic entry. */
function traffic(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["kind", "target", "count"]) &&
    new Set(["read", "write", "rmw", "bankSwitch", "loaderTransfer"]).has(String(value.kind)) &&
    isEvidenceText(value.target) &&
    measuredValue(value.count)
  );
}

/** Validate one closed cost-entry union. */
function entry(value: unknown): boolean {
  if (!isEvidenceRecord(value) || !isEvidenceText(value.id) || !owner(value.owner)) return false;
  if (value.kind === "bytes") {
    return (
      hasExactEvidenceKeys(value, [
        "kind",
        "id",
        "owner",
        "component",
        "accounting",
        "bytes",
        "sourceSites",
        "dependencyIds",
      ]) &&
      admittedPair(value.accounting, value.component) &&
      isEvidenceCount(value.bytes) &&
      sourceSites(value.sourceSites) &&
      areEvidenceStringsOrdered(value.dependencyIds)
    );
  }
  if (value.kind === "blocks") {
    return (
      hasExactEvidenceKeys(value, [
        "kind",
        "id",
        "owner",
        "component",
        "blocks",
        "sourceSites",
        "dependencyIds",
      ]) &&
      new Set(["diskFile", "diskMetadata", "sectorOverhead"]).has(String(value.component)) &&
      isEvidenceCount(value.blocks) &&
      sourceSites(value.sourceSites) &&
      areEvidenceStringsOrdered(value.dependencyIds)
    );
  }
  return (
    value.kind === "cycles" &&
    hasExactEvidenceKeys(value, [
      "kind",
      "id",
      "owner",
      "pathId",
      "cycles",
      "traffic",
      "sourceSites",
      "dependencyIds",
    ]) &&
    isEvidenceText(value.pathId) &&
    measuredValue(value.cycles) &&
    Array.isArray(value.traffic) &&
    value.traffic.every(traffic) &&
    isEvidenceOrdered(
      value.traffic as Record<string, unknown>[],
      (item) => `${String(item.kind)}\0${String(item.target)}`,
    ) &&
    sourceSites(value.sourceSites) &&
    areEvidenceStringsOrdered(value.dependencyIds)
  );
}

/** Return the required canonical order key for cost entries. */
function entryKey(value: Record<string, unknown>): string {
  const itemOwner = value.owner as Record<string, unknown>;
  const discriminator =
    value.kind === "bytes"
      ? `${String(value.accounting)}\0${String(value.component)}`
      : value.kind === "blocks"
        ? String(value.component)
        : String(value.pathId);
  return `${String(value.kind)}\0${discriminator}\0${String(itemOwner.kind)}\0${String(itemOwner.id)}\0${String(value.id)}`;
}

/** Validate one optimizer cost vector. */
function costVector(value: unknown): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, ["programBytes", "pathCycles", "resources"]) ||
    !isEvidenceCount(value.programBytes) ||
    !Array.isArray(value.pathCycles) ||
    !value.pathCycles.every(
      (path) =>
        isEvidenceRecord(path) &&
        hasExactEvidenceKeys(path, ["pathId", "cycles"]) &&
        isEvidenceText(path.pathId) &&
        measuredValue(path.cycles),
    ) ||
    new Set(value.pathCycles.map((path) => (path as Record<string, unknown>).pathId)).size !==
      value.pathCycles.length ||
    !Array.isArray(value.resources) ||
    value.resources.length < STANDARD_RESOURCES.length
  ) {
    return false;
  }
  for (let index = 0; index < STANDARD_RESOURCES.length; index += 1) {
    const resource = value.resources[index];
    if (
      !isEvidenceRecord(resource) ||
      !hasExactEvidenceKeys(resource, ["kind", "id", "value"]) ||
      resource.kind !== "standard" ||
      resource.id !== STANDARD_RESOURCES[index] ||
      !isEvidenceCount(resource.value)
    ) {
      return false;
    }
  }
  const pathCycles = value.pathCycles as Record<string, unknown>[];
  const profile = value.resources.slice(STANDARD_RESOURCES.length);
  const numericWorst = (measured: unknown): number | null => {
    if (!isEvidenceRecord(measured)) return null;
    if (measured.kind === "exact") return measured.value as number;
    if (measured.kind === "range") return measured.maximum as number;
    return null;
  };
  let priorKnownWorst: number | null = null;
  for (const path of pathCycles) {
    const current = numericWorst(path.cycles);
    if (current === null) continue;
    if (priorKnownWorst !== null && priorKnownWorst < current) return false;
    priorKnownWorst = current;
  }
  return (
    profile.every(
      (resource) =>
        isEvidenceRecord(resource) &&
        hasExactEvidenceKeys(resource, ["kind", "id", "value"]) &&
        resource.kind === "profile" &&
        isEvidenceText(resource.id) &&
        isEvidenceCount(resource.value),
    ) &&
    new Set(value.resources.map((resource) => (resource as Record<string, unknown>).id)).size ===
      value.resources.length
  );
}

/** Validate one hard candidate rejection. */
function hardRejection(value: unknown): boolean {
  return (
    isEvidenceRecord(value) &&
    hasExactEvidenceKeys(value, ["kind", "detail", "sourceSites"]) &&
    REJECTION_KINDS.has(String(value.kind)) &&
    isEvidenceText(value.detail) &&
    sourceSites(value.sourceSites)
  );
}

/** Validate one exact optimization candidate. */
function candidate(value: unknown): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, ["id", "feasibility"]) ||
    !isEvidenceText(value.id) ||
    !isEvidenceRecord(value.feasibility)
  ) {
    return false;
  }
  if (value.feasibility.kind === "feasible") {
    return (
      hasExactEvidenceKeys(value.feasibility, ["kind", "vector"]) &&
      costVector(value.feasibility.vector)
    );
  }
  return (
    value.feasibility.kind === "rejected" &&
    hasExactEvidenceKeys(value.feasibility, ["kind", "reasons"]) &&
    Array.isArray(value.feasibility.reasons) &&
    value.feasibility.reasons.length > 0 &&
    value.feasibility.reasons.every(hardRejection)
  );
}

/** Validate one exact optimizer decision and all local references. */
function decision(value: unknown): boolean {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, [
      "id",
      "scope",
      "mode",
      "sourceSites",
      "closurePoint",
      "baselineCandidateId",
      "selectedCandidateId",
      "candidates",
      "incomparableComponents",
      "tieBreak",
    ]) ||
    !isEvidenceText(value.id) ||
    !isEvidenceText(value.scope) ||
    !new Set(["balanced", "speed", "size"]).has(String(value.mode)) ||
    !sourceSites(value.sourceSites) ||
    !CLOSURE_POINTS.has(String(value.closurePoint)) ||
    !isEvidenceText(value.baselineCandidateId) ||
    !isEvidenceText(value.selectedCandidateId) ||
    !Array.isArray(value.candidates) ||
    value.candidates.length === 0 ||
    !value.candidates.every(candidate) ||
    !isEvidenceOrdered(value.candidates as Record<string, unknown>[], (item) => String(item.id)) ||
    !areEvidenceStringsOrdered(value.incomparableComponents) ||
    !(value.incomparableComponents as string[]).every(
      (component) => component === "B" || component.startsWith("T:") || component.startsWith("R:"),
    ) ||
    !isEvidenceRecord(value.tieBreak)
  ) {
    return false;
  }
  const candidates = value.candidates as Record<string, unknown>[];
  const feasible = new Map(
    candidates
      .filter((item) => (item.feasibility as Record<string, unknown>).kind === "feasible")
      .map((item) => [String(item.id), item.feasibility as Record<string, unknown>]),
  );
  if (!feasible.has(value.baselineCandidateId) || !feasible.has(value.selectedCandidateId)) {
    return false;
  }
  const baseline = feasible.get(value.baselineCandidateId)!.vector as Record<string, unknown>;
  const admittedComponents = new Set<string>(["B"]);
  for (const path of baseline.pathCycles as Record<string, unknown>[]) {
    admittedComponents.add(`T:${String(path.pathId)}`);
  }
  for (const resource of baseline.resources as Record<string, unknown>[]) {
    admittedComponents.add(`R:${String(resource.id)}`);
  }
  if (
    (value.incomparableComponents as string[]).some(
      (component) => !admittedComponents.has(component),
    )
  ) {
    return false;
  }
  if (value.tieBreak.kind === "none") {
    return hasExactEvidenceKeys(value.tieBreak, ["kind"]);
  }
  if (
    value.tieBreak.kind !== "stableId" ||
    !hasExactEvidenceKeys(value.tieBreak, ["kind", "candidateIds"]) ||
    !areEvidenceStringsOrdered(value.tieBreak.candidateIds) ||
    value.tieBreak.candidateIds.length < 2 ||
    !(value.tieBreak.candidateIds as string[]).includes(String(value.selectedCandidateId)) ||
    !(value.tieBreak.candidateIds as string[]).every((id) => feasible.has(id))
  ) {
    return false;
  }
  const vectors = (value.tieBreak.candidateIds as string[]).map((id) =>
    canonicalEvidenceJson(feasible.get(id)!.vector),
  );
  return vectors.every((vector) => vector === vectors[0]);
}

/** Return whether entry dependencies resolve and contain no cycle. */
function dependenciesAreClosed(entries: readonly Record<string, unknown>[]): boolean {
  const byId = new Map(entries.map((item) => [String(item.id), item]));
  if (byId.size !== entries.length) return false;
  for (const item of entries) {
    const dependencies = item.dependencyIds as string[];
    if (dependencies.some((id) => !byId.has(id) || id === item.id)) return false;
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const dependency of byId.get(id)!.dependencyIds as string[]) {
      if (!visit(dependency)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  return [...byId.keys()].every(visit);
}

/** Compose directly comparable exact/range cycle entries for one semantic path. */
function composedCycles(
  entries: readonly Record<string, unknown>[],
): Record<string, unknown> | null {
  const values = entries.map(({ cycles }) => cycles as Record<string, unknown>);
  if (values.length === 0) return null;
  if (values.some(({ kind }) => kind === "unknown")) return { kind: "unknown" };
  if (values.some(({ kind }) => kind === "symbolic")) {
    return values.length === 1 ? values[0]! : null;
  }
  const minimum = values.reduce(
    (sum, item) =>
      sum + (item.kind === "exact" ? (item.value as number) : (item.minimum as number)),
    0,
  );
  const maximum = values.reduce(
    (sum, item) =>
      sum + (item.kind === "exact" ? (item.value as number) : (item.maximum as number)),
    0,
  );
  return minimum === maximum
    ? { kind: "exact", value: minimum }
    : { kind: "range", minimum, maximum };
}

/** Validate the complete closed costs-evidence version-1 value. */
export function costsEvidenceValue(value: unknown): value is CostsEvidence {
  if (
    !isEvidenceRecord(value) ||
    !hasExactEvidenceKeys(value, [
      "kind",
      "schemaVersion",
      "mode",
      "totals",
      "entries",
      "decisions",
    ]) ||
    value.kind !== "blend65.costs" ||
    value.schemaVersion !== 1 ||
    !OPTIMIZATION.has(String(value.mode)) ||
    !costVector(value.totals) ||
    !Array.isArray(value.entries) ||
    !value.entries.every(entry) ||
    !isEvidenceOrdered(value.entries as Record<string, unknown>[], entryKey) ||
    !dependenciesAreClosed(value.entries as Record<string, unknown>[]) ||
    !Array.isArray(value.decisions) ||
    !value.decisions.every(decision) ||
    !isEvidenceOrdered(value.decisions as Record<string, unknown>[], (item) => String(item.id)) ||
    (value.mode === "none" && value.decisions.length !== 0) ||
    (value.decisions as Record<string, unknown>[]).some(({ mode }) => mode !== value.mode)
  ) {
    return false;
  }
  const totals = value.totals as Record<string, unknown>;
  const entries = value.entries as Record<string, unknown>[];
  const programBytes = entries
    .filter((item) => item.kind === "bytes" && item.accounting === "program")
    .reduce((sum, item) => sum + (item.bytes as number), 0);
  if (programBytes !== totals.programBytes) return false;
  const pathCycles = totals.pathCycles as Record<string, unknown>[];
  if (
    pathCycles.some((path) => {
      const matching = entries.filter(
        (item) => item.kind === "cycles" && item.pathId === path.pathId,
      );
      const composed = composedCycles(matching);
      return (
        composed === null || canonicalEvidenceJson(composed) !== canonicalEvidenceJson(path.cycles)
      );
    }) ||
    entries.some(
      (item) => item.kind === "cycles" && !pathCycles.some(({ pathId }) => pathId === item.pathId),
    )
  ) {
    return false;
  }
  const dimensions = new Set<string>();
  for (const item of entries.filter(({ kind }) => kind === "bytes")) {
    const itemOwner = item.owner as Record<string, unknown>;
    const identity = `${String(itemOwner.kind)}\0${String(itemOwner.id)}\0${String(item.component)}\0${String(item.accounting)}`;
    if (dimensions.has(identity)) return false;
    dimensions.add(identity);
  }
  return true;
}
