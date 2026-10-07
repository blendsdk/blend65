import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type {
  SemanticOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  BlockId,
} from "./operations.js";
import type { WholeProgram } from "./whole-program.js";
import { interruptDepthAt, interruptPredecessorSlot } from "./interrupt-contexts.js";
import { interruptRetainedEntryRoot } from "./interrupt-context-facts.js";
import { interruptExecutionKey } from "./interrupt-context-facts.js";
import type {
  SelectedEntry,
  VectorState,
  InterruptLinkBinding,
} from "./interrupt-context-facts.js";
import type { SourceSpan } from "../project/types.js";
import type {
  InterruptExecutionContext,
  InterruptExecutionContexts,
} from "./interrupt-contexts.js";

/** Preserve NMOS old-I eligibility and balanced source saves across one CPU-control operation. */
export function interruptCpuControlState(
  state: VectorState,
  operation: Extract<SemanticOperation, { readonly kind: "cpu-control" }>,
): VectorState {
  return {
    ...state,
    eligible: state.enabled,
    enabled:
      operation.control === "asm_sei"
        ? false
        : operation.control === "asm_cli"
          ? true
          : operation.control === "asm_plp"
            ? state.saved.at(-1)!
            : state.enabled,
    saved:
      operation.control === "asm_php"
        ? [...state.saved, state.enabled]
        : operation.control === "asm_plp"
          ? state.saved.slice(0, -1)
          : state.saved,
    path:
      state.irqTransition !== undefined && operation.control === "asm_cli"
        ? [...state.path, operation.span]
        : state.path,
  };
}

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
            ...(context.releaseVariant === undefined
              ? {}
              : { releaseVariant: context.releaseVariant }),
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
          existing.releaseVariant === selected.releaseVariant &&
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

/**
 * Select the emitted callee's ABI descriptor, including compatible reuse of an
 * observed mainline body. Code labels and incoming homes must use this same
 * descriptor; an external retained caller does not own the callee's parameters.
 * @param key Stable source-function identity to select.
 * @param context Caller depth at the call site, before compatible ABI reuse.
 * @param contexts Existing observed and retained emission descriptors.
 * @param rootAware Whether lowering distinguishes activation-root variants.
 * @returns The exact selected descriptor, without changing execution evidence.
 */
export function functionEntryContext(
  key: string,
  context: InterruptExecutionContext,
  contexts: InterruptExecutionContexts,
  rootAware: boolean,
): InterruptExecutionContext {
  if (!rootAware || context.activationRoot === undefined) return context;
  const entries = contexts.get(key) ?? [];
  const selected = entries.filter(
    (entry) =>
      entry.domain === context.domain &&
      entry.activationRoot === context.activationRoot &&
      entry.releaseVariant === context.releaseVariant,
  );
  if (context.domain === "main" && selected.length === 0) {
    const observed = entries.find(
      (entry) =>
        entry.domain === "main" &&
        entry.activationRoot === undefined &&
        entry.releaseVariant === context.releaseVariant,
    );
    if (observed !== undefined) return observed;
  }
  return (
    selected.find(
      (entry) =>
        (entry.localIrqDepth ?? 0) === (context.localIrqDepth ?? 0) &&
        (entry.localNmiDepth ?? 0) === (context.localNmiDepth ?? 0),
    ) ?? (selected.length === 1 ? selected[0]! : context)
  );
}

/**
 * Merge ABI demand descriptors for emission only. Never use this catalogue as
 * an execution/reentrancy proof or to project reached source operations.
 */
export function interruptCodeContexts(
  executed: InterruptExecutionContexts,
  retained: InterruptExecutionContexts,
): InterruptExecutionContexts {
  const result = new Map(executed);
  for (const [owner, contexts] of retained) {
    const entries = new Map(
      (result.get(owner) ?? []).map((context) => [interruptExecutionKey(owner, context), context]),
    );
    for (const context of contexts) {
      const key = interruptExecutionKey(owner, context);
      if (!entries.has(key)) entries.set(key, context);
    }
    result.set(owner, Object.freeze([...entries.values()]));
  }
  return result;
}

/** Keep only recorded operations and real successor/merge edges in one body. */
export function projectInterruptBlocks(
  body: SemanticFunction | SemanticGlobal,
  reached: ReadonlyMap<BlockId, ReadonlySet<number>>,
): readonly SemanticBlock[] {
  const selected = body.blocks.filter((block) => reached.has(block.id));
  const predecessors = new Map(selected.map((block) => [block.id, new Set<BlockId>()]));
  for (const block of selected) {
    if (!reached.get(block.id)!.has(block.operations.length)) continue;
    const terminal = block.terminator;
    const successors =
      terminal.kind === "jump"
        ? [terminal.target]
        : terminal.kind === "branch"
          ? [terminal.whenTrue, terminal.whenFalse]
          : [];
    for (const target of successors) {
      const incoming = predecessors.get(target);
      if (incoming === undefined) throw new Error("Reached interrupt edge lacks its successor");
      incoming.add(block.id);
    }
  }
  return Object.freeze(
    selected.map((block) => {
      const indexes = reached.get(block.id)!;
      const terminator = indexes.has(block.operations.length)
        ? block.terminator
        : Object.freeze({ kind: "unreachable" as const });
      const length = Math.min(block.operations.length, Math.max(...indexes) + 1);
      const operations = block.operations.slice(0, length).map((operation) => {
        if (operation.kind !== "merge") return operation;
        const incoming = operation.incoming.filter((edge) =>
          predecessors.get(block.id)!.has(edge.block),
        );
        if (incoming.length === 0)
          throw new Error("Reached interrupt merge lacks an incoming edge");
        return incoming.length === operation.incoming.length
          ? operation
          : Object.freeze({ ...operation, incoming: Object.freeze(incoming) });
      });
      return Object.freeze({ ...block, operations: Object.freeze(operations), terminator });
    }),
  );
}

/**
 * Retain executable source paths without inventing interrupt arrivals. Only a
 * closed call whose every target is proved nonreturning removes its suffix and
 * successor edges. Returning, mixed and unknown targets remain conservative.
 * Independent raw-address retention is deliberately handled separately.
 */
export function interruptRetainedBlocks(
  body: SemanticFunction,
  program: WholeProgram,
): readonly SemanticBlock[] {
  const blocks = new Map(body.blocks.map((block) => [block.id, block]));
  const reached = new Map<BlockId, Set<number>>();
  const pending = [body.entry];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (reached.has(id)) continue;
    const block = blocks.get(id);
    if (block === undefined) throw new Error("Retained interrupt edge lacks its successor");
    const indexes = new Set<number>();
    reached.set(id, indexes);
    let returns = true;
    for (const [index, operation] of block.operations.entries()) {
      indexes.add(index);
      const targets =
        operation.kind === "call"
          ? [operation.callee]
          : operation.kind === "indirect-call"
            ? (program.indirectTargets?.get(operation) ?? [])
            : [];
      if (
        targets.length > 0 &&
        targets.every(
          (target) =>
            program.interruptOwnership?.returningBodies?.get(bindingIdentityKey(target)) === false,
        )
      ) {
        returns = false;
        break;
      }
    }
    if (!returns) continue;
    indexes.add(block.operations.length);
    const terminal = block.terminator;
    if (terminal.kind === "jump") pending.push(terminal.target);
    else if (terminal.kind === "branch") pending.push(terminal.whenTrue, terminal.whenFalse);
  }
  return projectInterruptBlocks(body, reached);
}

/** A new continuation grows only when it contains an active instance of itself. */
export function extendsActiveInterruptChain(
  selected: SelectedEntry,
  state: VectorState,
  ancestors: ReadonlyMap<string, SelectedEntry>,
  program: WholeProgram,
): boolean {
  if (ancestors.has(selected.id)) return false;
  const handler = bindingIdentityKey(selected.route.handler);
  const visited = new Set<string>();
  let current: SelectedEntry | null = selected;
  while (current !== null && !visited.has(current.id)) {
    visited.add(current.id);
    if (
      current !== selected &&
      ancestors.has(current.id) &&
      bindingIdentityKey(current.route.handler) === handler
    )
      return true;
    if (
      current.tail === undefined ||
      program.interruptOwnership?.returningBodies?.get(
        bindingIdentityKey(current.route.handler),
      ) === false
    )
      return false;
    current = state.words.get(current.tail)?.entry ?? null;
  }
  return false;
}

/**
 * Publish only after a complete capture. The supplied existing arrival relation
 * protects the intermediate IRQ word and keeps NMI's single high-byte publication
 * distinct; this helper does not discover calls, arrivals or new proof states.
 */
export function publishInterruptVector(
  captured: VectorState,
  destination: SelectedEntry | null,
  sink: "irq" | "nmi",
  source: SourceSpan,
  caller: VectorState,
  arrivals: (state: VectorState) => readonly VectorState[],
): VectorState[] {
  const completed: VectorState[] = [];
  for (const before of arrivals(captured)) {
    const changed = sink === "irq" && before.vectors.irq?.id !== destination?.id;
    const between = changed ? { ...before, irqTransition: source } : before;
    for (const resumed of changed ? arrivals(between) : [between]) {
      const { irqTransition: inherited, ...withoutTransition } = resumed;
      completed.push({
        ...withoutTransition,
        ...(captured.irqTransition === undefined ? {} : { irqTransition: captured.irqTransition }),
        vectors: { ...resumed.vectors, [sink]: destination },
        enabled: caller.enabled,
        eligible: false,
      });
    }
  }
  return completed;
}

/**
 * Bind code-policy descriptors back to the same physical captures. Variant
 * selection never changes a slot, predecessor, equality witness or ABI root.
 * Reference-only entries retain their existing unexecuted descriptor.
 */
export function interruptVariantBindings(
  bindings: ReadonlyMap<string, InterruptLinkBinding>,
  contexts: InterruptExecutionContexts,
  program: WholeProgram,
): ReadonlyMap<string, InterruptLinkBinding> {
  /** Remove only the code suffix when matching an unchanged physical capture. */
  const physicalKey = (owner: string, context: InterruptExecutionContext): string => {
    const { releaseVariant, ...physical } = context;
    return interruptExecutionKey(owner, physical);
  };
  const owners = new Map<SemanticOperation, string>();
  for (const body of [...program.semantic.functions, ...program.semantic.globals])
    for (const block of body.blocks)
      for (const operation of block.operations) owners.set(operation, bindingIdentityKey(body.id));
  return new Map(
    [...bindings].map(([slot, binding]) => [
      slot,
      {
        ...binding,
        captures: binding.captures.flatMap((capture) => {
          const operation = capture.entry.route.installation;
          const owner = owners.get(operation)!;
          const original = interruptExecutionKey(owner, capture.installer);
          const installers = (contexts.get(owner) ?? [])
            .map((context) => interruptDepthAt(context, operation, program))
            .filter((context) => physicalKey(owner, context) === original);
          const handler = bindingIdentityKey(capture.entry.route.handler);
          const selected = (contexts.get(handler) ?? []).find(
            (context) =>
              physicalKey(handler, context) ===
              interruptExecutionKey(handler, capture.entry.context),
          );
          return (installers.length === 0 ? [capture.installer] : installers).map((installer) => ({
            ...capture,
            installer,
            entry: { ...capture.entry, context: selected ?? capture.entry.context },
          }));
        }),
      },
    ]),
  );
}

/**
 * Select independent callable roots without manufacturing calls to closed
 * finite source targets. Address-taking retains their code; actual source call
 * edges supply the only proved incoming ownership. Other callable roots keep
 * their existing independent entry model. No reachability root is removed.
 */
export function independentInterruptCallableBodies(
  program: WholeProgram,
  bodies: ReadonlyMap<string, SemanticFunction | SemanticGlobal>,
  finiteCia2Calls: boolean,
): readonly (SemanticFunction | SemanticGlobal)[] {
  const finite = new Set(
    [...(program.indirectTargets?.values() ?? [])].flat().map(bindingIdentityKey),
  );
  return program.roots.flatMap((root) => {
    if (root.kind !== "callable") return [];
    const key = bindingIdentityKey(root.function);
    if (finiteCia2Calls && finite.has(key)) return [];
    const body = bodies.get(key);
    return body === undefined ? [] : [body];
  });
}
