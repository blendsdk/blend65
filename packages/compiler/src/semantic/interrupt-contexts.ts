import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticBlock } from "./operations.js";
import type { WholeProgram } from "./whole-program.js";

/** The vector depth at one statically selected function entry. */
export interface InterruptExecutionContext {
  /** Independently entering mainline or interrupt execution. */
  readonly domain: "main" | "irq" | "nmi";
  /** Live IRQ predecessor words on entry. */
  readonly irq: number;
  /** Live NMI predecessor words on entry. */
  readonly nmi: number;
}

/** Source-function identities mapped to their finite entry contexts. */
export type InterruptExecutionContexts = ReadonlyMap<string, readonly InterruptExecutionContext[]>;

/** Add the locally proved ownership depth to one caller's concrete entry depth. */
export function interruptDepthAt(
  context: InterruptExecutionContext,
  operation: SemanticOperation,
  program: WholeProgram,
): InterruptExecutionContext {
  const relative = program.interruptOwnership?.relativeDepths.get(operation);
  return Object.freeze({
    domain: context.domain,
    irq: context.irq + (relative?.irq ?? 0),
    nmi: context.nmi + (relative?.nmi ?? 0),
  });
}

/**
 * Close the finite vector-depth contexts reached by calls and installed entries.
 * This gives each helper that changes a vector the right fixed predecessor slot.
 */
export function interruptExecutionContexts(program: WholeProgram): InterruptExecutionContexts {
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
    const selected = usesVectorDepth(key)
      ? context
      : Object.freeze({ domain: context.domain, irq: 0, nmi: 0 });
    const list = contexts.get(key) ?? [];
    if (
      list.some(
        (existing) =>
          existing.domain === selected.domain &&
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
          add(
            route.handler,
            Object.freeze({
              domain: route.sink.domain,
              irq: atOperation.irq + (route.sink.domain === "irq" ? 1 : 0),
              nmi: atOperation.nmi + (route.sink.domain === "nmi" ? 1 : 0),
            }),
          );
        }
      }
    }
  };
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
  while (pending.length > 0) {
    const current = pending.shift()!;
    const fn = byFunction.get(bindingIdentityKey(current.function));
    if (fn !== undefined) visit(fn.blocks, current.context);
  }
  for (const [key, list] of contexts) {
    contexts.set(
      key,
      list.sort(
        (left, right) =>
          ["main", "irq", "nmi"].indexOf(left.domain) -
            ["main", "irq", "nmi"].indexOf(right.domain) ||
          left.irq - right.irq ||
          left.nmi - right.nmi,
      ),
    );
  }
  return contexts;
}

/** Exact predecessor depth reached at each installed handler source site. */
export function interruptRouteDepths(
  program: WholeProgram,
  contexts: InterruptExecutionContexts,
): ReadonlyMap<SemanticOperation, readonly number[]> {
  const depths = new Map<SemanticOperation, readonly number[]>();
  for (const route of program.interruptRoutes ?? []) {
    const owner = program.semantic.functions.find((fn) =>
      fn.blocks.some((block) => block.operations.includes(route.installation)),
    );
    const entries =
      owner === undefined
        ? program.semantic.globals.flatMap((global) =>
            global.blocks.some((block) => block.operations.includes(route.installation))
              ? [
                  Object.freeze({
                    domain: "main" as const,
                    irq:
                      program.interruptOwnership?.initializerEntryDepths.get(
                        bindingIdentityKey(global.id),
                      )?.irq ?? 0,
                    nmi:
                      program.interruptOwnership?.initializerEntryDepths.get(
                        bindingIdentityKey(global.id),
                      )?.nmi ?? 0,
                  }),
                ]
              : [],
          )
        : (contexts.get(bindingIdentityKey(owner.id)) ?? []);
    depths.set(
      route.installation,
      Object.freeze(
        [
          ...new Set(
            entries.map(
              (entry) => interruptDepthAt(entry, route.installation, program)[route.sink.domain],
            ),
          ),
        ].sort((left, right) => left - right),
      ),
    );
  }
  return depths;
}
