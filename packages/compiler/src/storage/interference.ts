import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { IndirectTargetSets } from "../semantic/function-targets.js";
import type {
  HelperCallDemand,
  InterferenceEdge,
  StorageInventory,
  StorageRequest,
} from "./storage-types.js";

/** Compare stable identities without locale-dependent collation. */
function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

/** Render a semantic position as a set key. */
function positionKey(position: { readonly block: string; readonly operation: number }): string {
  return `${position.block}:${position.operation}`;
}

/** Check whether two spans identify the same source operation. */
function sameSpan(left: SourceSpan, right: SourceSpan): boolean {
  return left.sourceId === right.sourceId && left.start === right.start && left.end === right.end;
}

/** Check whether two requests can be live together inside one function. */
function lifetimesOverlap(left: StorageRequest, right: StorageRequest): boolean {
  if (bindingIdentityKey(left.owner) !== bindingIdentityKey(right.owner)) return false;
  const leftPositions = new Set(left.lifetime.liveAt.map(positionKey));
  return right.lifetime.liveAt.some((position) => leftPositions.has(positionKey(position)));
}

/** Find every proved callee at one direct or indirect call site. */
function calleesAtSpan(
  fn: Pick<SemanticFunction, "blocks">,
  span: SourceSpan,
  indirectTargets: IndirectTargetSets | undefined,
): readonly BindingId[] {
  for (const block of fn.blocks) {
    for (const operation of block.operations) {
      if (!sameSpan(operation.span, span)) continue;
      if (operation.kind === "call") return [operation.callee];
      if (operation.kind === "indirect-call") return indirectTargets?.get(operation) ?? [];
    }
  }
  return [];
}

/** Collect a callee and every function it may call. */
function reachableCallees(
  start: BindingId,
  callGraph: ReadonlyMap<string, readonly BindingId[]>,
): ReadonlySet<string> {
  const found = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    const key = bindingIdentityKey(current);
    if (found.has(key)) continue;
    found.add(key);
    for (const callee of callGraph.get(key) ?? []) pending.push(callee);
  }
  return found;
}

/** Add one canonical undirected edge unless it already exists. */
function addEdge(
  edges: Map<string, InterferenceEdge>,
  leftId: string,
  rightId: string,
  reason: InterferenceEdge["reason"],
): void {
  if (leftId === rightId) return;
  const [left, right] = compareText(leftId, rightId) <= 0 ? [leftId, rightId] : [rightId, leftId];
  const key = `${left}\u0000${right}`;
  const existing = edges.get(key);
  if (existing?.reason === "lifetime") return;
  edges.set(key, Object.freeze({ left, right, reason }));
}

/**
 * Build exact same-function lifetime conflicts and caller/callee overlap conflicts.
 *
 * A value which crosses a call conflicts with storage owned by the direct callee and its
 * transitive callees. This prevents a nested call from overwriting a still-live caller value.
 */
export function buildInterference(
  inventory: StorageInventory,
  helperCalls: readonly HelperCallDemand[] = [],
): readonly InterferenceEdge[] {
  const edges = new Map<string, InterferenceEdge>();
  const executions = new Map<string, Pick<SemanticFunction, "blocks">>(
    inventory.program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn]),
  );
  const globals = new Map(
    inventory.program.semantic.globals.map((global) => [bindingIdentityKey(global.id), global]),
  );
  for (const initializer of inventory.program.initializers ?? []) {
    const global = globals.get(bindingIdentityKey(initializer.binding));
    if (global !== undefined) executions.set(bindingIdentityKey(initializer.binding), global);
  }
  const callGraph = new Map(
    inventory.program.callGraph.map(
      (entry) => [bindingIdentityKey(entry.function), entry.callees] as const,
    ),
  );
  for (const initializer of inventory.program.initializers ?? []) {
    callGraph.set(bindingIdentityKey(initializer.binding), initializer.callees);
  }

  for (let leftIndex = 0; leftIndex < inventory.requests.length; leftIndex += 1) {
    const left = inventory.requests[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < inventory.requests.length; rightIndex += 1) {
      const right = inventory.requests[rightIndex]!;
      if (lifetimesOverlap(left, right)) addEdge(edges, left.id, right.id, "lifetime");
    }
  }

  for (const callerRequest of inventory.requests) {
    const owner = executions.get(bindingIdentityKey(callerRequest.owner));
    if (owner === undefined) continue;
    for (const callSpan of callerRequest.lifetime.callsCrossed) {
      for (const callee of calleesAtSpan(owner, callSpan, inventory.program.indirectTargets)) {
        const activeCallees = reachableCallees(callee, callGraph);
        for (const calleeRequest of inventory.requests) {
          if (activeCallees.has(bindingIdentityKey(calleeRequest.owner))) {
            addEdge(edges, callerRequest.id, calleeRequest.id, "call-overlap");
          }
        }
      }
    }
  }

  const requestsById = new Set(inventory.requests.map(({ id }) => id));
  for (const helper of helperCalls) {
    for (const liveRequestId of helper.liveRequestIds) {
      if (!requestsById.has(liveRequestId)) continue;
      for (const helperRequestId of helper.helperRequestIds) {
        if (requestsById.has(helperRequestId)) {
          addEdge(edges, liveRequestId, helperRequestId, "call-overlap");
        }
      }
    }
  }

  return Object.freeze(
    [...edges.values()].sort(
      (left, right) => compareText(left.left, right.left) || compareText(left.right, right.right),
    ),
  );
}
