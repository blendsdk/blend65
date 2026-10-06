import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticBlock } from "./operations.js";
import type { WholeProgram } from "./whole-program.js";
import { interruptDepthAt, interruptPredecessorSlot } from "./interrupt-contexts.js";
import { interruptRetainedBlocks, interruptRetainedEntryRoot } from "./interrupt-context-facts.js";
import type {
  InterruptExecutionContext,
  InterruptExecutionContexts,
} from "./interrupt-contexts.js";

/**
 * Close the finite vector-depth contexts reached by calls and installed entries.
 * This gives each helper that changes a vector the right fixed predecessor slot.
 * An explicit retained-root list replaces executable roots and collects only
 * code/ABI demands. It never proves an arrival, predecessor or live-link lifetime.
 */
export function walkInterruptExecutionContexts(
  program: WholeProgram,
  retainedRoots?: readonly BindingId[],
): InterruptExecutionContexts {
  const byFunction = new Map(
    program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const callees = new Map(
    program.callGraph.map((node) => [bindingIdentityKey(node.function), node.callees] as const),
  );
  const depthSensitive = new Map<string, boolean>();
  const usesVectorDepth = (key: string): boolean => {
    const known = depthSensitive.get(key);
    if (known !== undefined) return known;
    const fn = byFunction.get(key);
    const local =
      fn?.entryKind === "interrupt" ||
      fn?.blocks.some((block) =>
        block.operations.some(
          (operation) =>
            operation.kind === "platform" &&
            [
              "c64.system.setIRQ",
              "c64.system.setIRQExclusive",
              "c64.system.restoreIRQ",
              "c64.system.setNMI",
              "c64.system.setNMIExclusive",
              "c64.system.restoreNMI",
            ].includes(operation.capability),
        ),
      ) === true;
    const result =
      local ||
      (callees.get(key) ?? []).some((callee) => usesVectorDepth(bindingIdentityKey(callee)));
    depthSensitive.set(key, result);
    return result;
  };
  const contexts = new Map<string, InterruptExecutionContext[]>();
  const hasNmiRoutes = program.interruptRoutes?.some(({ sink }) => sink.domain === "nmi") === true;
  const pending: { function: BindingId; context: InterruptExecutionContext }[] = [];
  const routes = new Map<
    SemanticOperation,
    NonNullable<WholeProgram["interruptRoutes"]>[number][]
  >();
  for (const route of program.interruptRoutes ?? []) {
    const current = routes.get(route.installation) ?? [];
    current.push(route);
    routes.set(route.installation, current);
  }
  const add = (fn: BindingId, context: InterruptExecutionContext): void => {
    const key = bindingIdentityKey(fn);
    // Only a wholly local ownership transformation can reuse a mainline ABI
    // from a different prefix. Equal net depth does not preserve word identity.
    const observed =
      retainedRoots !== undefined &&
      context.domain === "main" &&
      context.activationRoot !== undefined &&
      program.interruptOwnership?.locallyBalancedBodies?.has(key) &&
      byFunction.get(key)?.entryKind !== "interrupt"
        ? program.interruptContextAnalysis?.contexts
            .get(key)
            ?.find((entry) => entry.domain === "main")
        : undefined;
    const selected: InterruptExecutionContext =
      observed ??
      (byFunction.get(key)?.entryKind === "interrupt"
        ? context
        : Object.freeze({
            domain: context.domain,
            ...(context.activationRoot === undefined
              ? {}
              : { activationRoot: context.activationRoot }),
            ...(context.activationRoot === undefined
              ? {}
              : { localIrqDepth: usesVectorDepth(key) ? context.localIrqDepth : 0 }),
            ...(context.localNmiDepth === undefined
              ? {}
              : { localNmiDepth: usesVectorDepth(key) ? context.localNmiDepth : 0 }),
            irq: usesVectorDepth(key)
              ? context.activationRoot === undefined
                ? context.irq
                : (context.localIrqDepth ?? 0)
              : 0,
            nmi: usesVectorDepth(key) ? (context.localNmiDepth ?? context.nmi) : 0,
          }));
    const list = contexts.get(key) ?? [];
    if (
      list.some(
        (existing) =>
          existing.domain === selected.domain &&
          existing.activationRoot === selected.activationRoot &&
          existing.localIrqDepth === selected.localIrqDepth &&
          existing.localNmiDepth === selected.localNmiDepth &&
          existing.entrySlot === selected.entrySlot &&
          existing.irq === selected.irq &&
          existing.nmi === selected.nmi,
      )
    )
      return;
    list.push(selected);
    contexts.set(key, list);
    pending.push({ function: fn, context: selected });
  };
  const visit = (blocks: readonly SemanticBlock[], context: InterruptExecutionContext): void => {
    for (const block of blocks) {
      for (const operation of block.operations) {
        const atOperation = interruptDepthAt(context, operation, program);
        if (operation.kind === "call") add(operation.callee, atOperation);
        else if (operation.kind === "indirect-call") {
          for (const target of program.indirectTargets?.get(operation) ?? []) {
            add(target, atOperation);
          }
        }
        for (const route of routes.get(operation) ?? []) {
          // A retained body's namespace is finite by source/ABI, while its
          // wrapper still carries the exact tail word. Hypothetical recursive
          // installations must not grow a new namespace for every arrival.
          const activationRoot =
            retainedRoots === undefined
              ? bindingIdentityKey(route.handler)
              : interruptRetainedEntryRoot(route);
          add(
            route.handler,
            Object.freeze({
              domain: route.sink.domain,
              activationRoot,
              localIrqDepth: 0,
              ...(hasNmiRoutes ? { localNmiDepth: 0 } : {}),
              entrySlot: interruptPredecessorSlot(atOperation, route.sink.domain),
              // A newly entered handler starts a fresh local ownership stack. Its
              // predecessor belongs to the installing context, not this root.
              irq:
                route.sink.domain === "irq"
                  ? atOperation.activationRoot === undefined
                    ? atOperation.irq + 1
                    : 1
                  : atOperation.irq,
              nmi:
                route.sink.domain === "nmi"
                  ? atOperation.activationRoot === undefined
                    ? atOperation.nmi + 1
                    : 1
                  : atOperation.nmi,
            }),
          );
        }
      }
    }
  };
  if (retainedRoots !== undefined) {
    for (const root of retainedRoots)
      add(
        root,
        Object.freeze({
          domain: "main",
          activationRoot: JSON.stringify(["retained", "raw", bindingIdentityKey(root)]),
          localIrqDepth: 0,
          localNmiDepth: 0,
          irq: 0,
          nmi: 0,
        }),
      );
  } else {
    const main = program.semantic.main;
    const mainEntry = program.interruptOwnership?.mainEntryDepth ?? { irq: 0, nmi: 0 };
    add(main, Object.freeze({ domain: "main", ...mainEntry }));
    for (const root of program.roots) {
      if (root.kind === "callable") {
        add(root.function, Object.freeze({ domain: "main", irq: 0, nmi: 0 }));
      }
    }
    for (const initializer of program.semantic.initializerOrder) {
      const global = program.semantic.globals.find(
        ({ id }) => bindingIdentityKey(id) === bindingIdentityKey(initializer),
      );
      const entry = program.interruptOwnership?.initializerEntryDepths.get(
        bindingIdentityKey(initializer),
      );
      if (global?.entry !== null && global !== undefined) {
        visit(
          global.blocks,
          Object.freeze({ domain: "main", irq: entry?.irq ?? 0, nmi: entry?.nmi ?? 0 }),
        );
      }
    }
  }
  while (pending.length > 0) {
    const current = pending.shift()!;
    const fn = byFunction.get(bindingIdentityKey(current.function));
    if (fn !== undefined)
      visit(
        retainedRoots === undefined ? fn.blocks : interruptRetainedBlocks(fn, program),
        current.context,
      );
  }
  for (const [key, list] of contexts) {
    contexts.set(
      key,
      list.sort(
        (left, right) =>
          ["main", "irq", "nmi"].indexOf(left.domain) -
            ["main", "irq", "nmi"].indexOf(right.domain) ||
          left.irq - right.irq ||
          left.nmi - right.nmi ||
          (left.activationRoot ?? "").localeCompare(right.activationRoot ?? "") ||
          (left.entrySlot ?? "").localeCompare(right.entrySlot ?? ""),
      ),
    );
  }
  return contexts;
}
