import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import { interruptDepthAt } from "../semantic/interrupt-contexts.js";
import type { InterruptExecutionContext } from "../semantic/interrupt-contexts.js";
import {
  functionEntryContext,
  interruptExecutedBlocks,
  interruptExecutionKey,
} from "../semantic/interrupt-context-facts.js";
import type {
  HelperCallDemand,
  NmiEntryStackDemand,
  NmiEntryStackPeak,
  StorageInventory,
} from "./storage-types.js";

/** Compare stable identities without locale-dependent collation. */
function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

/** One bounded call/status route, separate from unrestricted external arrivals. */
export interface HardwareStackRoute {
  /** Return-address and helper bytes retained on this program route. */
  readonly bytes: number;
  /** Stable execution identities from the selected root to its deepest point. */
  readonly route: readonly string[];
}

/** Select the larger stack route, using its stable identity to break equal-cost ties. */
export function deeperStackRoute(
  left: HardwareStackRoute,
  right: HardwareStackRoute,
): HardwareStackRoute {
  if (left.bytes !== right.bytes) return left.bytes > right.bytes ? left : right;
  return compareText(JSON.stringify(left.route), JSON.stringify(right.route)) <= 0 ? left : right;
}

/** Retain the live source-save depth at each operation, rather than summing unrelated maxima. */
function operationStackDepths(fn: SemanticFunction): ReadonlyMap<SemanticOperation, number> {
  const blocks = new Map(fn.blocks.map((block) => [block.id, block]));
  const entries = new Map([[fn.entry, 0]]);
  const pending = [fn.entry];
  const depths = new Map<SemanticOperation, number>();
  for (let index = 0; index < pending.length; index += 1) {
    const id = pending[index]!;
    const block = blocks.get(id);
    if (block === undefined) continue;
    let depth = entries.get(id)!;
    for (const operation of block.operations) {
      depths.set(operation, depth);
      if (operation.kind === "cpu-control") {
        if (operation.control === "asm_php") depth += 1;
        else if (operation.control === "asm_plp") depth -= 1;
      }
    }
    const terminator = block.terminator;
    const successors =
      terminator.kind === "jump"
        ? [terminator.target]
        : terminator.kind === "branch"
          ? [terminator.whenTrue, terminator.whenFalse]
          : [];
    for (const successor of successors) {
      // Frontend status proof has already required equal depths at joins and
      // backedges; one traversal therefore fixes every reachable entry depth.
      if (!entries.has(successor)) {
        entries.set(successor, depth);
        pending.push(successor);
      }
    }
  }
  return depths;
}

/** Compute the deepest reachable direct-call chain and retain the exact winning route. */
export function hardwareCallRoutes(
  inventory: StorageInventory,
  helperCalls: readonly HelperCallDemand[],
  nmiEntries: readonly NmiEntryStackDemand[] = [],
): {
  /** Existing program call/status route, before bounded IRQ overlap. */
  readonly program: HardwareStackRoute;
  /** Existing profile-baseline interrupt route for graph-only clients. */
  readonly interrupt: HardwareStackRoute;
  /** Actual selected generated NMI entries, scoped independently of arrival count. */
  readonly nmiEntries: readonly NmiEntryStackPeak[];
} {
  const proof = inventory.program.interruptContextAnalysis;
  const graph = new Map(
    inventory.program.callGraph.map(
      (entry) =>
        [bindingIdentityKey(entry.function), entry.callees.map(bindingIdentityKey)] as const,
    ),
  );
  const helperStackByCaller = new Map<string, number>();
  for (const helper of helperCalls) {
    const caller = bindingIdentityKey(helper.caller);
    helperStackByCaller.set(
      caller,
      Math.max(helperStackByCaller.get(caller) ?? 0, helper.stackBytes),
    );
  }
  const helperByCaller = new Map<string, HelperCallDemand>();
  for (const helper of helperCalls) {
    const caller = bindingIdentityKey(helper.caller);
    const previous = helperByCaller.get(caller);
    if (
      previous === undefined ||
      helper.stackBytes > previous.stackBytes ||
      (helper.stackBytes === previous.stackBytes && compareText(helper.id, previous.id) < 0)
    ) {
      helperByCaller.set(caller, helper);
    }
  }
  const memo = new Map<string, HardwareStackRoute>();
  const active = new Set<string>();
  const vectorUpdates = new Set([
    "c64.system.setIRQ",
    "c64.system.setIRQExclusive",
    "c64.system.restoreIRQ",
    "c64.system.setNMI",
    "c64.system.setNMIExclusive",
    "c64.system.restoreNMI",
  ]);
  const depth = (functionKey: string, context?: InterruptExecutionContext): HardwareStackRoute => {
    const memoKey =
      context === undefined ? functionKey : interruptExecutionKey(functionKey, context);
    const known = memo.get(memoKey);
    if (known !== undefined) return known;
    if (active.has(memoKey)) {
      return Object.freeze({
        bytes: Number.POSITIVE_INFINITY,
        route: Object.freeze([functionKey]),
      });
    }
    active.add(memoKey);
    const fn = inventory.program.semantic.functions.find(
      ({ id }) => bindingIdentityKey(id) === functionKey,
    );
    if (context !== undefined && (fn === undefined || proof === undefined))
      throw new Error("Selected NMI stack route has no proved source body");
    const selected =
      fn !== undefined && context !== undefined && proof !== undefined
        ? { ...fn, blocks: interruptExecutedBlocks(fn, [context], proof) }
        : fn;
    const depths =
      selected === undefined
        ? new Map<SemanticOperation, number>()
        : operationStackDepths(selected);
    // The declaration's peak can include a suffix which this entry never executes.
    // Include each selected PHP's post-push depth, not just pre-operation depths.
    const statusStackPeak =
      context === undefined
        ? (fn?.statusStackPeak ?? 0)
        : Math.max(
            0,
            ...[...depths].map(
              ([operation, live]) =>
                live + Number(operation.kind === "cpu-control" && operation.control === "asm_php"),
            ),
          );
    // Index each operation once. A helper source may match several lowered operations;
    // retain their maximum live depth without rescanning the function for every call.
    const sourceDepths = new Map<string, number>();
    const callDepths = new Map<string, number>();
    const selectedCalls: {
      callee: string;
      live: number;
      context: InterruptExecutionContext;
    }[] = [];
    for (const [operation, live] of depths) {
      const key = JSON.stringify([
        operation.span.sourceId,
        operation.span.start,
        operation.span.end,
      ]);
      sourceDepths.set(key, Math.max(sourceDepths.get(key) ?? 0, live));
      const targets =
        operation.kind === "call"
          ? [operation.callee]
          : operation.kind === "indirect-call"
            ? (inventory.program.indirectTargets?.get(operation) ?? [])
            : [];
      for (const target of targets) {
        const callee = bindingIdentityKey(target);
        callDepths.set(callee, Math.max(callDepths.get(callee) ?? 0, live));
        if (context !== undefined && proof !== undefined) {
          selectedCalls.push({
            callee,
            live,
            context: functionEntryContext(
              callee,
              interruptDepthAt(context, operation, inventory.program),
              proof.contexts,
              true,
            ),
          });
        }
      }
    }
    let functionDepth: HardwareStackRoute = Object.freeze({
      bytes: statusStackPeak,
      route: Object.freeze([functionKey]),
    });
    for (const helper of helperCalls) {
      if (bindingIdentityKey(helper.caller) !== functionKey) continue;
      const sourceKey =
        helper.source === undefined
          ? null
          : JSON.stringify([helper.source.sourceId, helper.source.start, helper.source.end]);
      if (context !== undefined && sourceKey !== null && !sourceDepths.has(sourceKey)) continue;
      const live =
        (sourceKey === null ? undefined : sourceDepths.get(sourceKey)) ?? statusStackPeak;
      functionDepth = deeperStackRoute(functionDepth, {
        bytes: live + helper.stackBytes,
        route: Object.freeze([functionKey, `helper:${helper.id}`]),
      });
    }
    for (const [operation, live] of depths) {
      if (operation.kind === "platform" && vectorUpdates.has(operation.capability)) {
        functionDepth = deeperStackRoute(functionDepth, {
          bytes: live + 2,
          route: Object.freeze([functionKey, "interrupt-vector-update"]),
        });
      }
    }
    const calls =
      context === undefined
        ? (graph.get(functionKey) ?? []).map((callee) => ({
            callee,
            live: callDepths.get(callee) ?? statusStackPeak,
            context: undefined,
          }))
        : selectedCalls;
    for (const call of calls) {
      const calleeDepth = depth(call.callee, call.context);
      // Graph-only storage clients have no operation positions. Keep their
      // conservative summary; real calls use the status depth at the call site.
      const liveSaves = call.live;
      const candidate = Object.freeze({
        bytes:
          calleeDepth.bytes === Number.POSITIVE_INFINITY
            ? calleeDepth.bytes
            : liveSaves + calleeDepth.bytes + 2,
        route: Object.freeze([functionKey, ...calleeDepth.route]),
      });
      functionDepth = deeperStackRoute(functionDepth, candidate);
    }
    active.delete(memoKey);
    memo.set(memoKey, functionDepth);
    return functionDepth;
  };

  let deepest: HardwareStackRoute = Object.freeze({ bytes: 0, route: Object.freeze(["main"]) });
  for (const root of inventory.program.roots) {
    if (root.kind === "main" || root.kind === "callable") {
      deepest = deeperStackRoute(deepest, depth(bindingIdentityKey(root.function)));
      continue;
    }
    if (root.kind === "initializer") {
      const key = bindingIdentityKey(root.binding);
      const helper = helperByCaller.get(key);
      let initializerDepth: HardwareStackRoute = Object.freeze({
        bytes: 2 + (helperStackByCaller.get(key) ?? 0),
        route: Object.freeze(
          helper === undefined
            ? ["startup", `initializer:${key}`]
            : ["startup", `initializer:${key}`, `helper:${helper.id}`],
        ),
      });
      const initializer = (inventory.program.initializers ?? []).find(
        ({ binding }) => bindingIdentityKey(binding) === key,
      );
      for (const callee of initializer?.callees ?? []) {
        const calleeDepth = depth(bindingIdentityKey(callee));
        initializerDepth = deeperStackRoute(
          initializerDepth,
          Object.freeze({
            bytes:
              calleeDepth.bytes === Number.POSITIVE_INFINITY
                ? calleeDepth.bytes
                : calleeDepth.bytes + 4,
            route: Object.freeze(["startup", `initializer:${key}`, ...calleeDepth.route]),
          }),
        );
      }
      deepest = deeperStackRoute(deepest, initializerDepth);
    }
  }
  let interrupt: HardwareStackRoute = Object.freeze({ bytes: 0, route: Object.freeze([]) });
  for (const route of inventory.program.interruptRoutes ?? []) {
    const body = depth(bindingIdentityKey(route.handler));
    interrupt = deeperStackRoute(
      interrupt,
      Object.freeze({
        bytes: route.variant.handlerEntryStackBytes + body.bytes,
        route: Object.freeze([`interrupt:${route.variant.id}`, ...body.route]),
      }),
    );
  }
  const entryPeaks = nmiEntries
    .map((entry) => {
      let body: HardwareStackRoute = Object.freeze({ bytes: 0, route: Object.freeze([]) });
      for (const context of entry.contexts) {
        body = deeperStackRoute(body, depth(bindingIdentityKey(entry.handler), context));
      }
      return Object.freeze({
        id: entry.id,
        bytes: entry.entryStackBytes + body.bytes,
        route: body.route,
        entryStackBytes: entry.entryStackBytes,
      });
    })
    .sort((left, right) => compareText(left.id, right.id));
  return Object.freeze({ program: deepest, interrupt, nmiEntries: Object.freeze(entryPeaks) });
}
