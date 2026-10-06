import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { IndirectTargetSets } from "../semantic/function-targets.js";
import { interruptDepthAt, interruptExecutionContexts } from "../semantic/interrupt-contexts.js";
import type {
  InterruptExecutionContext,
  InterruptExecutionContexts,
} from "../semantic/interrupt-contexts.js";
import {
  functionEntryContext,
  interruptCodeContexts,
  interruptExecutedBlocks,
  interruptExecutionKey,
  interruptMaterializations,
  interruptRetainedBlocks,
} from "../semantic/interrupt-context-facts.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import { hasHandlerSideIrqInstall } from "./inventory.js";
import type {
  HelperCallDemand,
  InterferenceEdge,
  IrqOverlapFacts,
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
  if (left.domain !== right.domain) return false;
  if (left.activationRoot !== right.activationRoot) return false;
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

/** Identify a source body's storage instance without conflating separate roots. */
function storageInstanceKey(
  owner: string,
  context: Pick<StorageRequest, "domain" | "activationRoot">,
): string {
  return JSON.stringify([owner, context.domain ?? null, context.activationRoot ?? null]);
}

/**
 * Follow the actual fixed callee ABI, not the original caller's root. A retained
 * caller may reuse an observed helper; that helper's own descriptor then governs
 * its nested calls. Emission demands select code, never certify an invocation.
 */
function selectedReachableCallees(
  start: BindingId,
  context: InterruptExecutionContext,
  program: WholeProgram,
  contexts: InterruptExecutionContexts,
  retained: InterruptExecutionContexts,
  functions: ReadonlyMap<string, SemanticFunction>,
): ReadonlySet<string> {
  // Executed-block facts apply only to NMI programs. IRQ-only analysis has no
  // reached-block proof, so its ordinary transitive calls must stay visible.
  const hasNmiRoute = program.interruptRoutes?.some(({ sink }) => sink.domain === "nmi") === true;
  const proof = hasNmiRoute ? program.interruptContextAnalysis : undefined;
  const found = new Set<string>();
  const visited = new Set<string>();
  const pending = [{ key: bindingIdentityKey(start), context }];
  while (pending.length > 0) {
    const current = pending.pop()!;
    const selected = functionEntryContext(current.key, current.context, contexts, true);
    const execution = interruptExecutionKey(current.key, selected);
    if (visited.has(execution)) continue;
    visited.add(execution);
    found.add(storageInstanceKey(current.key, selected));
    const body = functions.get(current.key);
    if (body === undefined) continue;
    const retainedBody = (retained.get(current.key) ?? []).some(
      (entry) => interruptExecutionKey(current.key, entry) === execution,
    );
    const blocks = retainedBody
      ? interruptRetainedBlocks(body, program)
      : proof === undefined
        ? body.blocks
        : interruptExecutedBlocks(
            body,
            (proof.contexts.get(current.key) ?? []).filter(
              (entry) =>
                entry.domain === selected.domain &&
                entry.activationRoot === selected.activationRoot,
            ),
            proof,
          );
    for (const block of blocks) {
      for (const operation of block.operations) {
        const targets =
          operation.kind === "call"
            ? [operation.callee]
            : operation.kind === "indirect-call"
              ? (program.indirectTargets?.get(operation) ?? [])
              : [];
        for (const target of targets) {
          pending.push({
            key: bindingIdentityKey(target),
            context: interruptDepthAt(selected, operation, program),
          });
        }
      }
    }
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
  irqOverlap?: IrqOverlapFacts,
): readonly InterferenceEdge[] {
  const edges = new Map<string, InterferenceEdge>();
  const functions = new Map(
    inventory.program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn]),
  );
  const executions = new Map<string, Pick<SemanticFunction, "blocks">>(functions);
  const hasNmiRoutes = inventory.program.interruptRoutes?.some(({ sink }) => sink.domain === "nmi");
  const executed =
    (inventory.program.interruptRoutes?.length ?? 0) > 0
      ? interruptExecutionContexts(inventory.program)
      : new Map();
  const retained = hasNmiRoutes ? interruptMaterializations(inventory.program).contexts : new Map();
  const contexts = interruptCodeContexts(executed, retained);
  const rootAware = hasNmiRoutes || hasHandlerSideIrqInstall(inventory.program, contexts);
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
      if (left.persistent === true || right.persistent === true) {
        addEdge(edges, left.id, right.id, "lifetime");
      }
      // IRQ can interrupt any mainline instruction. Private homes from those two
      // invocations must not overlay, even when they belong to the same source helper.
      if (
        left.domain !== undefined &&
        right.domain !== undefined &&
        left.domain !== right.domain &&
        (left.domain === "main" ||
          right.domain === "main" ||
          left.domain === "nmi" ||
          right.domain === "nmi")
      ) {
        addEdge(edges, left.id, right.id, "call-overlap");
      }
    }
  }

  for (const callerRequest of inventory.requests) {
    const owner = executions.get(bindingIdentityKey(callerRequest.owner));
    if (owner === undefined) continue;
    const entries = rootAware
      ? (contexts.get(bindingIdentityKey(callerRequest.owner)) ?? []).filter(
          (entry) =>
            entry.domain === (callerRequest.domain ?? "main") &&
            entry.activationRoot === callerRequest.activationRoot,
        )
      : [];
    for (const callSpan of callerRequest.lifetime.callsCrossed) {
      const call =
        entries.length === 0
          ? undefined
          : owner.blocks
              .flatMap((block) => block.operations)
              .find(
                (operation) =>
                  (operation.kind === "call" || operation.kind === "indirect-call") &&
                  sameSpan(operation.span, callSpan),
              );
      for (const callee of calleesAtSpan(owner, callSpan, inventory.program.indirectTargets)) {
        const activeCallees =
          entries.length === 0 || call === undefined
            ? reachableCallees(callee, callGraph)
            : new Set(
                entries.flatMap((entry) => [
                  ...selectedReachableCallees(
                    callee,
                    interruptDepthAt(entry, call, inventory.program),
                    inventory.program,
                    contexts,
                    retained,
                    functions,
                  ),
                ]),
              );
        for (const calleeRequest of inventory.requests) {
          if (
            entries.length > 0 && call !== undefined
              ? activeCallees.has(
                  storageInstanceKey(bindingIdentityKey(calleeRequest.owner), calleeRequest),
                )
              : activeCallees.has(bindingIdentityKey(calleeRequest.owner)) &&
                callerRequest.domain === calleeRequest.domain &&
                callerRequest.activationRoot === calleeRequest.activationRoot
          ) {
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

  if (irqOverlap !== undefined) {
    const requestsByRoot = new Map<string, StorageRequest[]>();
    for (const request of inventory.requests) {
      if (request.activationRoot === undefined || request.id.startsWith("interrupt-link:"))
        continue;
      const members = requestsByRoot.get(request.activationRoot) ?? [];
      members.push(request);
      requestsByRoot.set(request.activationRoot, members);
    }
    const byId = new Set(inventory.requests.map(({ id }) => id));
    for (const [left, right] of irqOverlap.rootPairs) {
      for (const first of requestsByRoot.get(left) ?? []) {
        for (const second of requestsByRoot.get(right) ?? []) {
          addEdge(edges, first.id, second.id, "call-overlap");
        }
      }
    }
    for (const [left, right] of irqOverlap.linkPairs) {
      if (byId.has(left) && byId.has(right)) addEdge(edges, left, right, "call-overlap");
    }
    for (const [link, root] of irqOverlap.linkRootPairs) {
      if (!byId.has(link)) continue;
      for (const request of requestsByRoot.get(root) ?? []) {
        addEdge(edges, link, request.id, "call-overlap");
      }
    }
  }

  return Object.freeze(
    [...edges.values()].sort(
      (left, right) => compareText(left.left, right.left) || compareText(left.right, right.right),
    ),
  );
}
