import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticFunction, SemanticGlobal } from "./operations.js";
import type { InterruptRoute, WholeProgram } from "./whole-program.js";
import {
  interruptExecutionContexts,
  interruptDepthAt,
  interruptPredecessorSlot,
} from "./interrupt-contexts.js";
import type { InterruptExecutionContext } from "./interrupt-contexts.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import {
  interruptClobberedGlobals,
  interruptWriteAddresses,
  interruptWriteTouches,
} from "./interrupt-address-facts.js";
import type { InterruptWriteAddress } from "./interrupt-address-facts.js";
import type { TargetProfile } from "../target/profile.js";

import {
  interruptVectorStateKey,
  interruptLinkObservers,
  interruptCaptureFailure,
  interruptIrqTransitionFailure,
  interruptEntrySelection,
  interruptExecutionKey,
} from "./interrupt-context-facts.js";
import type {
  SelectedEntry,
  LinkCapture,
  VectorState,
  InterruptContextAnalysis,
  InterruptLinkBinding,
} from "./interrupt-context-facts.js";
export type { InterruptContextAnalysis } from "./interrupt-context-facts.js";
export {
  interruptVectorStateKey,
  interruptLinkObservers,
  interruptCaptureFailure,
} from "./interrupt-context-facts.js";

/** One memoized source invocation; its return alternatives grow monotonically. */
interface ContextInvocation {
  /** Existing semantic body, including ordered executable initializers. */
  readonly body: SemanticFunction | SemanticGlobal;
  /** Concrete caller/entry vector depths used by the existing fixed-home consumers. */
  readonly context: InterruptExecutionContext;
  /** Entry relation, not a general value or CPU snapshot. */
  readonly input: VectorState;
  /** Readers belonging to suspended executions; returning cannot discard them. */
  readonly protectedReaders: ReadonlyMap<string, LinkCapture>;
  /** Current wrapper's continuation, propagated through ordinary helpers. */
  readonly activeEntry?: SelectedEntry;
  /** Active selected handlers used only to identify a growing continuation recurrence. */
  readonly ancestors: ReadonlyMap<string, SelectedEntry>;
  /** Complete returning relations, kept separate at CFG joins. */
  readonly exits: Map<string, VectorState>;
  /** Callers to revisit when a new returning relation is discovered. */
  readonly callers: Set<ContextInvocation>;
}

/**
 * Close ordered vector/link relations using the existing context worklist owner.
 * Calls consume only their actual returning alternatives. Equal states close
 * CFG loops without a source-iteration budget or a general value interpreter.
 */
export function analyzeInterruptContexts(
  program: WholeProgram,
  addressSpace?: Pick<TargetProfile["storage"], "ram" | "zeroPage">,
): InterruptContextAnalysis {
  if (program.interruptRoutes?.some(({ sink }) => sink.domain === "nmi") !== true) {
    return {
      contexts: interruptExecutionContexts(program),
      bindings: new Map(),
      reached: new Map(),
      diagnostics: [],
    };
  }
  const bodies = new Map<string, SemanticFunction | SemanticGlobal>(
    [...program.semantic.functions, ...program.semantic.globals].map((body) => [
      bindingIdentityKey(body.id),
      body,
    ]),
  );
  const routes = new Map<SemanticOperation, InterruptRoute[]>();
  for (const route of program.interruptRoutes ?? []) {
    routes.set(route.installation, [...(routes.get(route.installation) ?? []), route]);
  }
  const contexts = new Map<string, InterruptExecutionContext[]>();
  const invocations = new Map<string, ContextInvocation>();
  const pending: ContextInvocation[] = [];
  const dirty = new Set<ContextInvocation>();
  const diagnostics: ProjectDiagnostic[] = [];
  const bindings = new Map<string, InterruptLinkBinding>();
  const reached = new Map<string, Map<string, Set<number>>>();
  const clobbers = {
    irq: interruptClobberedGlobals(
      program.semantic,
      new Set(
        (program.interruptRoutes ?? [])
          .filter(({ sink }) => sink.domain === "irq")
          .map(({ handler }) => bindingIdentityKey(handler)),
      ),
      program.indirectTargets ?? new Map(),
      addressSpace,
    ),
    nmi: interruptClobberedGlobals(
      program.semantic,
      new Set(
        (program.interruptRoutes ?? [])
          .filter(({ sink }) => sink.domain === "nmi")
          .map(({ handler }) => bindingIdentityKey(handler)),
      ),
      program.indirectTargets ?? new Map(),
      addressSpace,
    ),
  };
  const addresses = new Map<string, ReadonlyMap<SemanticOperation, InterruptWriteAddress>>();
  const vectorBytes = { irq: new Set<bigint>(), nmi: new Set<bigint>() };
  for (const { sink } of program.interruptRoutes ?? []) {
    vectorBytes[sink.domain].add(BigInt(sink.vector));
    vectorBytes[sink.domain].add(BigInt((sink.vector + 1) & 0xffff));
  }
  const schedule = (invocation: ContextInvocation): void => {
    if (dirty.has(invocation)) return;
    dirty.add(invocation);
    pending.push(invocation);
  };
  /** Trace paths do not distinguish proof states; predecessor relations do. */
  const request = (
    body: SemanticFunction | SemanticGlobal,
    input: VectorState,
    context: InterruptExecutionContext,
    protectedReaders: ReadonlyMap<string, LinkCapture>,
    activeEntry?: SelectedEntry,
    ancestors: ReadonlyMap<string, SelectedEntry> = new Map(),
  ): ContextInvocation => {
    const owner = bindingIdentityKey(body.id);
    const key = JSON.stringify([
      owner,
      context,
      interruptVectorStateKey(
        input,
        interruptLinkObservers(input, protectedReaders, activeEntry, program),
      ),
      [...protectedReaders].map(([slot, capture]) => [slot, capture.entry?.id ?? null]).sort(),
      activeEntry?.id ?? null,
      [...ancestors].map(([handler, entry]) => [handler, entry.id]).sort(),
    ]);
    const previous = invocations.get(key);
    if (previous !== undefined) return previous;
    const invocation: ContextInvocation = {
      body,
      input,
      context,
      protectedReaders,
      ancestors,
      ...(activeEntry === undefined ? {} : { activeEntry }),
      exits: new Map(),
      callers: new Set(),
    };
    invocations.set(key, invocation);
    const selected = contexts.get(owner) ?? [];
    if (!selected.some((entry) => JSON.stringify(entry) === JSON.stringify(context))) {
      selected.push(context);
      contexts.set(owner, selected);
    }
    schedule(invocation);
    return invocation;
  };
  const initial: VectorState = {
    vectors: { irq: null, nmi: null },
    words: new Map(),
    owners: { irq: [], nmi: [] },
    enabled: true,
    eligible: true,
    saved: [],
    path: [],
  };
  const ordered = [
    ...program.semantic.initializerOrder.map((id) => bodies.get(bindingIdentityKey(id))!),
    bodies.get(bindingIdentityKey(program.semantic.main))!,
  ].filter((body) => body.entry !== null);
  const rootPositions = new Map<ContextInvocation, Set<number>>();
  /** Initializers run in order and pass their exact relation into main. */
  const seed = (index: number, state: VectorState): void => {
    const body = ordered[index];
    if (body === undefined) return;
    const node = request(
      body,
      state,
      {
        domain: "main",
        irq: state.owners.irq.length,
        nmi: state.owners.nmi.length,
      },
      new Map(),
    );
    const positions = rootPositions.get(node) ?? new Set<number>();
    if (positions.has(index)) return;
    positions.add(index);
    rootPositions.set(node, positions);
    for (const exit of node.exits.values()) seed(index + 1, exit);
  };
  seed(0, initial);
  for (const root of program.roots) {
    if (root.kind !== "callable") continue;
    const body = bodies.get(bindingIdentityKey(root.function));
    if (body !== undefined) request(body, initial, { domain: "main", irq: 0, nmi: 0 }, new Map());
  }
  /** A new continuation is growing only when it contains an active instance of itself. */
  const extendsActiveChain = (
    selected: SelectedEntry,
    state: VectorState,
    node: ContextInvocation,
  ): boolean => {
    if (node.ancestors.has(selected.id)) return false;
    const handler = bindingIdentityKey(selected.route.handler);
    const visited = new Set<string>();
    let current: SelectedEntry | null = selected;
    while (current !== null && !visited.has(current.id)) {
      visited.add(current.id);
      if (
        current !== selected &&
        node.ancestors.has(current.id) &&
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
  };
  /** Enter one actual installed/chain target, protecting the executions it suspends. */
  const enter = (
    selected: SelectedEntry,
    state: VectorState,
    node: ContextInvocation,
    chain: boolean,
  ): ContextInvocation | null => {
    if (extendsActiveChain(selected, state, node)) {
      diagnostics.push(
        projectDiagnostic(
          "E10245",
          `Execution path '${selected.route.sink.source}' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy`,
          selected.route.installation.span,
          null,
          state.path.map((span) => ({ span, message: "Generated continuation extends here" })),
        ),
      );
      return null;
    }
    const body = bodies.get(bindingIdentityKey(selected.route.handler));
    if (body === undefined) throw new Error("Selected interrupt body is missing");
    const called = request(
      body,
      { ...state, owners: { irq: [], nmi: [] }, enabled: false, eligible: false, saved: [] },
      selected.context,
      interruptLinkObservers(
        state,
        node.protectedReaders,
        chain ? undefined : node.activeEntry,
        program,
      ),
      selected,
      new Map([...node.ancestors, [selected.id, selected]]),
    );
    called.callers.add(node);
    return called;
  };
  /** Absence and every actual returning interrupt are separate feasible transitions. */
  const arrivals = (
    state: VectorState,
    node: ContextInvocation,
    nmiOnly = false,
    instructionPrelude = false,
  ): readonly VectorState[] => {
    // A source return or vector transaction contains real instructions after
    // CLI/PLP. Their old-I delay cannot suppress IRQ throughout that prelude.
    const irqEligible = state.eligible || (instructionPrelude && state.enabled);
    if (state.irqTransition !== undefined && !nmiOnly && irqEligible) {
      diagnostics.push(interruptIrqTransitionFailure(state));
      return [];
    }
    const states = [state];
    for (const sink of ["irq", "nmi"] as const) {
      const selected = state.vectors[sink];
      if (selected === null || (sink === "irq" && (nmiOnly || !irqEligible))) continue;
      const called = enter(selected, state, node, false);
      for (const returned of called?.exits.values() ?? []) {
        states.push({
          ...returned,
          owners: state.owners,
          saved: state.saved,
          enabled: state.enabled,
          eligible: state.eligible,
        });
      }
    }
    return states;
  };
  /**
   * The saved word is complete before either vector store. Between the IRQ
   * low/high stores, NMI may run, but must neither expose IRQ nor capture CINV.
   * Equal selected entries leave both bytes unchanged. The NMI publication
   * itself changes only one byte and retains any suspended parent IRQ phase.
   */
  const publish = (
    captured: VectorState,
    destination: SelectedEntry | null,
    sink: "irq" | "nmi",
    source: SourceSpan,
    caller: VectorState,
    node: ContextInvocation,
  ): VectorState[] => {
    const completed: VectorState[] = [];
    for (const before of arrivals(captured, node, true)) {
      const changed = sink === "irq" && before.vectors.irq?.id !== destination?.id;
      const between = changed ? { ...before, irqTransition: source } : before;
      for (const resumed of changed ? arrivals(between, node, true) : [between]) {
        const { irqTransition: inherited, ...withoutTransition } = resumed;
        completed.push({
          ...withoutTransition,
          ...(captured.irqTransition === undefined
            ? {}
            : { irqTransition: captured.irqTransition }),
          vectors: { ...resumed.vectors, [sink]: destination },
          enabled: caller.enabled,
          eligible: false,
        });
      }
    }
    return completed;
  };
  while (pending.length > 0 && diagnostics.length === 0) {
    const node = pending.shift()!;
    dirty.delete(node);
    if (node.body.entry === null) continue;
    const blocks = new Map(node.body.blocks.map((block) => [block.id, block]));
    const ownerKey = bindingIdentityKey(node.body.id);
    const executionKey = interruptExecutionKey(node.body.id, node.context);
    const executionPoints = reached.get(executionKey) ?? new Map<string, Set<number>>();
    reached.set(executionKey, executionPoints);
    if (!addresses.has(ownerKey))
      addresses.set(
        ownerKey,
        interruptWriteAddresses(
          program.semantic,
          node.body.entry,
          node.body.blocks,
          ownerKey === bindingIdentityKey(program.semantic.main),
          clobbers,
          addressSpace,
          program.indirectTargets,
          (target) => {
            const key = bindingIdentityKey(target);
            return program.interruptOwnership?.returningBodies?.get(key) === false
              ? null
              : program.interruptOwnership?.returningDepthChanges?.get(key);
          },
        ),
      );
    const points = [{ block: node.body.entry, index: 0, state: node.input }];
    const seen = new Set<string>();
    /** Store complete exits without joining unrelated current-vector choices. */
    const exit = (state: VectorState): void => {
      const key = interruptVectorStateKey(
        state,
        interruptLinkObservers(state, node.protectedReaders, node.activeEntry, program),
      );
      if (node.exits.has(key)) return;
      node.exits.set(key, state);
      for (const caller of node.callers) schedule(caller);
      for (const position of rootPositions.get(node) ?? []) seed(position + 1, state);
    };
    for (let cursor = 0; cursor < points.length && diagnostics.length === 0; cursor += 1) {
      const point = points[cursor]!;
      const key = JSON.stringify([
        point.block,
        point.index,
        interruptVectorStateKey(
          point.state,
          interruptLinkObservers(point.state, node.protectedReaders, node.activeEntry, program),
        ),
      ]);
      if (seen.has(key)) continue;
      seen.add(key);
      const block = blocks.get(point.block)!;
      const operation = block.operations[point.index];
      const indexes = executionPoints.get(point.block) ?? new Set<number>();
      indexes.add(point.index);
      executionPoints.set(point.block, indexes);
      const selected = operation === undefined ? [] : (routes.get(operation) ?? []);
      const transaction =
        selected.length > 0 ||
        (operation?.kind === "platform" &&
          (operation.capability === "c64.system.restoreIRQ" ||
            operation.capability === "c64.system.restoreNMI"));
      const returning = operation === undefined && block.terminator.kind === "return";
      for (const interrupted of arrivals(point.state, node, false, transaction || returning).slice(
        1,
      )) {
        points.push({ ...point, state: interrupted });
      }
      if (diagnostics.length > 0) break;
      let states = [point.state];
      if (operation === undefined) {
        const terminal = block.terminator;
        if (terminal.kind === "return") {
          const active = node.activeEntry;
          if (
            active !== undefined &&
            bindingIdentityKey(active.route.handler) === bindingIdentityKey(node.body.id) &&
            active.tail !== undefined
          ) {
            const predecessor = point.state.words.get(active.tail)?.entry;
            if (predecessor === undefined)
              throw new Error("Selected chain exit lacks its complete capture");
            if (predecessor === null) exit(point.state);
            else {
              const chained = enter(predecessor, point.state, node, true);
              for (const returned of chained?.exits.values() ?? []) exit(returned);
            }
          } else exit(point.state);
        } else
          for (const target of terminal.kind === "jump"
            ? [terminal.target]
            : terminal.kind === "branch"
              ? [terminal.whenTrue, terminal.whenFalse]
              : []) {
            points.push({ block: target, index: 0, state: point.state });
          }
        continue;
      }
      if (operation.kind === "call" || operation.kind === "indirect-call") {
        states = [];
        const targets =
          operation.kind === "call"
            ? [operation.callee]
            : (program.indirectTargets?.get(operation) ?? []);
        for (const target of targets) {
          const body = bodies.get(bindingIdentityKey(target));
          if (body === undefined) continue;
          const called = request(
            body,
            {
              ...point.state,
              eligible: point.state.enabled,
              path: [...point.state.path, operation.span],
            },
            interruptDepthAt(node.context, operation, program),
            node.protectedReaders,
            node.activeEntry,
            node.ancestors,
          );
          called.callers.add(node);
          states.push(...called.exits.values());
        }
      } else if (operation.kind === "cpu-control") {
        const state = point.state;
        states = [
          {
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
          },
        ];
      } else if (operation.kind === "platform") {
        if (selected.length > 0) {
          states = [];
          for (const route of selected) {
            const state = point.state;
            if (route.sink.domain === "irq" && state.irqTransition !== undefined) {
              diagnostics.push(interruptIrqTransitionFailure(state, operation.span));
              break;
            }
            const raw = state.rawVectors?.get(route.sink.domain);
            if (raw !== undefined && route.sink.domain === "nmi") {
              diagnostics.push(
                projectDiagnostic(
                  "E10278",
                  `Interrupt ownership for sink '${route.sink.source}' is invalid at 'raw vector write' — the predecessor before installation is unproved`,
                  raw,
                ),
              );
              break;
            }
            const context = interruptDepthAt(node.context, operation, program);
            const slot = interruptPredecessorSlot(context, route.sink.domain);
            const capture = {
              entry: state.vectors[route.sink.domain],
              path: [...state.path, operation.span],
            };
            const readers = interruptLinkObservers(
              state,
              node.protectedReaders,
              node.activeEntry,
              program,
            );
            const failure = interruptCaptureFailure(slot, capture, readers, route);
            if (failure !== null) {
              diagnostics.push(failure);
              break;
            }
            const { id, tail } = interruptEntrySelection(route, slot, program);
            const entry: SelectedEntry = {
              id,
              route,
              ...(tail === undefined ? {} : { tail }),
              context: {
                domain: route.sink.domain,
                activationRoot: id,
                localIrqDepth: 0,
                localNmiDepth: 0,
                entrySlot: slot,
                irq: route.sink.domain === "irq" ? 1 : context.irq,
                nmi: route.sink.domain === "nmi" ? 1 : context.nmi,
              },
            };
            const alternative = {
              installer: context,
              entryIdentity: id,
              predecessor: capture.entry?.id ?? `stock:${route.sink.domain}`,
              equalLiveCapture: readers.has(slot),
            };
            const existing = bindings.get(slot)?.captures ?? [];
            if (
              !existing.some(
                (choice) =>
                  choice.entryIdentity === id &&
                  choice.predecessor === alternative.predecessor &&
                  choice.equalLiveCapture === alternative.equalLiveCapture &&
                  JSON.stringify(choice.installer) === JSON.stringify(context),
              )
            ) {
              bindings.set(slot, {
                requestId: slot,
                captures: [...existing, { ...alternative, entry }],
              });
            }
            const captured: VectorState = {
              ...state,
              words: new Map([...state.words, [slot, capture]]),
              owners: {
                ...state.owners,
                [route.sink.domain]: [...state.owners[route.sink.domain], { slot, capture }],
              },
              enabled: false,
              eligible: false,
              path: capture.path,
            };
            states.push(
              ...publish(captured, entry, route.sink.domain, operation.span, state, node),
            );
          }
        } else if (
          operation.capability === "c64.system.restoreIRQ" ||
          operation.capability === "c64.system.restoreNMI"
        ) {
          const sink = operation.capability === "c64.system.restoreIRQ" ? "irq" : "nmi";
          if (sink === "irq" && point.state.irqTransition !== undefined) {
            diagnostics.push(interruptIrqTransitionFailure(point.state, operation.span));
            break;
          }
          const owner = point.state.owners[sink].at(-1);
          if (owner === undefined) throw new Error("Interrupt restore has no proved local owner");
          states = publish(
            {
              ...point.state,
              enabled: false,
              eligible: false,
              path: [...point.state.path, operation.span],
            },
            owner.capture.entry,
            sink,
            operation.span,
            point.state,
            node,
          ).map((state) => ({
            ...state,
            owners: { ...state.owners, [sink]: state.owners[sink].slice(0, -1) },
          }));
        } else states = [{ ...point.state, eligible: point.state.enabled }];
      } else if (operation.kind === "memory-write") {
        const address = addresses.get(ownerKey)!.get(operation);
        const rawVectors = new Map(point.state.rawVectors);
        const readers = interruptLinkObservers(
          point.state,
          node.protectedReaders,
          node.activeEntry,
          program,
        );
        for (const sink of ["irq", "nmi"] as const) {
          if (!interruptWriteTouches(operation, address, vectorBytes[sink], sink === "nmi"))
            continue;
          if (
            point.state.vectors[sink] !== null ||
            [...readers.keys()].some((slot) => slot.startsWith(`interrupt-link:${sink}:`))
          ) {
            diagnostics.push(
              projectDiagnostic(
                "E10278",
                `Interrupt ownership for sink 'c64.system.${sink === "irq" ? "setIRQ" : "setNMI"}' is invalid at 'raw vector write' — a live predecessor or publication may still be observed`,
                operation.span,
              ),
            );
            break;
          }
          rawVectors.set(sink, operation.span);
        }
        states = [{ ...point.state, rawVectors, eligible: point.state.enabled }];
      } else states = [{ ...point.state, eligible: point.state.enabled }];
      for (const state of states)
        points.push({ block: point.block, index: point.index + 1, state });
    }
  }
  return {
    contexts,
    bindings: diagnostics.length === 0 ? bindings : new Map(),
    reached: diagnostics.length === 0 ? reached : new Map(),
    diagnostics,
  };
}
