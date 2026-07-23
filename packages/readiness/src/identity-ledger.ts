import { createHash } from "node:crypto";
import { parseTree } from "jsonc-parser";
import { createDiagnostic } from "./diagnostics.js";
import type { InventoryLimits } from "./limits.js";
import type { InventoryDiagnostic, RuleIdentityEvent } from "./model.js";

export const IDENTITY_GENESIS =
  "sha256:9aeecea544992e64dcac88c5d625cc43b036424482397cd72b56705abc46ca23";

const EVENT_KEYS = [
  "schemaVersion",
  "sequence",
  "operation",
  "ruleId",
  "predecessorRuleIds",
  "successorRuleIds",
  "previousHash",
  "eventHash",
] as const;

export interface IdentityLedgerResult {
  readonly events: readonly RuleIdentityEvent[];
  readonly diagnostics: readonly InventoryDiagnostic[];
}

function diagnostic(message: string, path = "$.identityLedger"): InventoryDiagnostic {
  return createDiagnostic({
    phase: "ledger",
    code: "identity.invalid",
    path,
    message,
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isLexicalUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

function isEvent(value: unknown): value is RuleIdentityEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === EVENT_KEYS.length &&
    EVENT_KEYS.every((key) => Object.hasOwn(record, key)) &&
    record.schemaVersion === 1 &&
    Number.isInteger(record.sequence) &&
    (record.operation === "allocate" || record.operation === "retire") &&
    typeof record.ruleId === "string" &&
    isStringArray(record.predecessorRuleIds) &&
    isStringArray(record.successorRuleIds) &&
    typeof record.previousHash === "string" &&
    typeof record.eventHash === "string"
  );
}

function calculateEventHash(event: RuleIdentityEvent): string {
  const payload = JSON.stringify({
    schemaVersion: event.schemaVersion,
    sequence: event.sequence,
    operation: event.operation,
    ruleId: event.ruleId,
    predecessorRuleIds: event.predecessorRuleIds,
    successorRuleIds: event.successorRuleIds,
    previousHash: event.previousHash,
  });
  return `sha256:${createHash("sha256")
    .update("blend65.rule-identity-event")
    .update(Buffer.from([0]))
    .update(payload)
    .digest("hex")}`;
}

function hasDuplicateKeys(text: string): boolean {
  const tree = parseTree(text);
  if (tree?.type !== "object" || tree.children === undefined) return true;
  const names = tree.children.map((property) => property.children?.[0]?.value);
  return names.some((name, index) => names.indexOf(name) !== index);
}

function maximumTreeDepth(text: string): number {
  const root = parseTree(text);
  if (root === undefined) return Number.MAX_SAFE_INTEGER;
  let maximum = 0;
  const pending = [{ node: root, depth: 1 }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    maximum = Math.max(maximum, current.depth);
    for (const child of current.node.children ?? []) {
      pending.push({ node: child, depth: current.depth + 1 });
    }
  }
  return maximum;
}

/**
 * Parses and authenticates a bounded append-only identity stream.
 *
 * The function rejects the whole stream on the first malformed event so no
 * caller can accidentally consume a valid prefix of corrupted authority.
 */
export function parseIdentityLedger(
  bytes: Uint8Array,
  limits: InventoryLimits,
): IdentityLedgerResult {
  if (bytes.byteLength > limits.maxInputBytes) {
    return { events: [], diagnostics: [diagnostic("Identity ledger exceeds the byte limit.")] };
  }
  if (bytes.byteLength === 0) return { events: [], diagnostics: [] };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { events: [], diagnostics: [diagnostic("Identity ledger must not contain a BOM.")] };
  }
  const lineRanges: Array<readonly [number, number]> = [];
  let lineStart = 0;
  for (let offset = 0; offset < bytes.byteLength; offset += 1) {
    const byte = bytes[offset];
    if (byte === 0x0d) {
      return { events: [], diagnostics: [diagnostic("Identity ledger must use LF newlines.")] };
    }
    if (byte !== 0x0a) continue;
    if (offset === lineStart) {
      return {
        events: [],
        diagnostics: [diagnostic("Identity ledger must not contain blank lines.")],
      };
    }
    if (offset - lineStart > limits.maxStringBytes * 4) {
      return {
        events: [],
        diagnostics: [diagnostic("Identity ledger line exceeds the byte limit.")],
      };
    }
    lineRanges.push([lineStart, offset]);
    if (lineRanges.length > limits.maxRules * 2) {
      return { events: [], diagnostics: [diagnostic("Identity ledger has too many events.")] };
    }
    lineStart = offset + 1;
  }
  if (lineStart !== bytes.byteLength) {
    return { events: [], diagnostics: [diagnostic("Identity ledger must end with LF.")] };
  }
  const events: RuleIdentityEvent[] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const [index, [start, end]] of lineRanges.entries()) {
    let line: string;
    try {
      line = decoder.decode(bytes.subarray(start, end));
    } catch {
      return { events: [], diagnostics: [diagnostic("Identity ledger is not valid UTF-8.")] };
    }
    if (maximumTreeDepth(line) > limits.maxDepth) {
      return {
        events: [],
        diagnostics: [diagnostic(`Identity event ${index} exceeds a resource limit.`)],
      };
    }
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return {
        events: [],
        diagnostics: [diagnostic(`Identity event ${index} is malformed JSON.`)],
      };
    }
    if (hasDuplicateKeys(line) || !isEvent(value)) {
      return {
        events: [],
        diagnostics: [diagnostic(`Identity event ${index} has an invalid shape.`)],
      };
    }
    events.push(value);
  }
  return { events, diagnostics: validateChain(events, limits) };
}

function validateChain(
  events: readonly RuleIdentityEvent[],
  limits: InventoryLimits,
): readonly InventoryDiagnostic[] {
  const allocated = new Set<string>();
  const retired = new Set<string>();
  let previousHash = IDENTITY_GENESIS;
  for (const [index, event] of events.entries()) {
    const relationships = event.predecessorRuleIds.length + event.successorRuleIds.length;
    const allocationShape = event.operation === "allocate" && event.successorRuleIds.length === 0;
    const retirementShape = event.operation === "retire" && event.predecessorRuleIds.length === 0;
    if (
      event.sequence !== index ||
      event.previousHash !== previousHash ||
      event.eventHash !== calculateEventHash(event) ||
      !/^sha256:[0-9a-f]{64}$/.test(event.previousHash) ||
      !/^sha256:[0-9a-f]{64}$/.test(event.eventHash) ||
      !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(event.ruleId) ||
      new TextEncoder().encode(event.ruleId).byteLength > limits.maxStringBytes ||
      [...event.predecessorRuleIds, ...event.successorRuleIds].some(
        (id) =>
          !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id) ||
          new TextEncoder().encode(id).byteLength > limits.maxStringBytes,
      ) ||
      !isLexicalUnique(event.predecessorRuleIds) ||
      !isLexicalUnique(event.successorRuleIds) ||
      relationships > limits.maxRelationshipsPerRule ||
      (!allocationShape && !retirementShape)
    ) {
      return [diagnostic(`Identity event ${index} breaks the chain contract.`)];
    }
    if (event.operation === "allocate") {
      if (allocated.has(event.ruleId) || retired.has(event.ruleId)) {
        return [diagnostic(`Rule identity ${event.ruleId} was allocated more than once.`)];
      }
      if (event.predecessorRuleIds.some((id) => !allocated.has(id) || retired.has(id))) {
        return [diagnostic(`Rule identity ${event.ruleId} has an inactive predecessor.`)];
      }
      allocated.add(event.ruleId);
    } else {
      if (!allocated.has(event.ruleId) || retired.has(event.ruleId)) {
        return [diagnostic(`Rule identity ${event.ruleId} cannot be retired.`)];
      }
      if (event.successorRuleIds.some((id) => !allocated.has(id) || retired.has(id))) {
        return [diagnostic(`Rule identity ${event.ruleId} has an inactive successor.`)];
      }
      retired.add(event.ruleId);
    }
    previousHash = event.eventHash;
  }
  const allocations = new Map(
    events
      .filter((event) => event.operation === "allocate")
      .map((event) => [event.ruleId, event] as const),
  );
  const retirements = new Map(
    events
      .filter((event) => event.operation === "retire")
      .map((event) => [event.ruleId, event] as const),
  );
  for (const allocation of allocations.values()) {
    for (const predecessor of allocation.predecessorRuleIds) {
      const retirement = retirements.get(predecessor);
      if (retirement === undefined || !retirement.successorRuleIds.includes(allocation.ruleId)) {
        return [diagnostic(`Rule identity ${allocation.ruleId} has non-reciprocal lineage.`)];
      }
    }
  }
  for (const retirement of retirements.values()) {
    for (const successor of retirement.successorRuleIds) {
      if (!allocations.get(successor)?.predecessorRuleIds.includes(retirement.ruleId)) {
        return [diagnostic(`Rule identity ${retirement.ruleId} has non-reciprocal lineage.`)];
      }
    }
  }
  const predecessorToSuccessors = new Map<string, readonly string[]>();
  const successorToPredecessors = new Map<string, readonly string[]>();
  for (const retirement of retirements.values()) {
    if (retirement.successorRuleIds.length > 0) {
      predecessorToSuccessors.set(retirement.ruleId, retirement.successorRuleIds);
    }
  }
  for (const allocation of allocations.values()) {
    if (allocation.predecessorRuleIds.length > 0) {
      successorToPredecessors.set(allocation.ruleId, allocation.predecessorRuleIds);
    }
  }
  const visitedPredecessors = new Set<string>();
  for (const firstPredecessor of predecessorToSuccessors.keys()) {
    if (visitedPredecessors.has(firstPredecessor)) continue;
    const component = { predecessors: new Set<string>(), successors: new Set<string>() };
    const pendingPredecessors = [firstPredecessor];
    while (pendingPredecessors.length > 0) {
      const predecessor = pendingPredecessors.pop();
      if (predecessor === undefined || component.predecessors.has(predecessor)) continue;
      component.predecessors.add(predecessor);
      visitedPredecessors.add(predecessor);
      for (const successor of predecessorToSuccessors.get(predecessor) ?? []) {
        if (component.successors.has(successor)) continue;
        component.successors.add(successor);
        for (const neighbor of successorToPredecessors.get(successor) ?? []) {
          if (!component.predecessors.has(neighbor)) pendingPredecessors.push(neighbor);
        }
      }
    }
    if (component.predecessors.size > 1 && component.successors.size > 1) {
      return [diagnostic("Many-to-many identity replacement requires staged events.")];
    }
  }
  return [];
}
