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
  interruptContextWriteAddresses,
  interruptWriteTouches,
  interruptWriteMayTouchHomes,
} from "./interrupt-address-facts.js";
import type { InterruptWriteAddress } from "./interrupt-address-facts.js";
import type { TargetProfile } from "../target/profile.js";
import {
  publishInterruptVector,
  interruptVariantBindings,
  independentInterruptCallableBodies,
  interruptCpuControlState,
} from "./interrupt-context-walk.js";
import { INITIAL_CIA2_FACTS } from "./cia2-ownership-facts.js";
import { literalValues } from "./cia-ownership-facts.js";
import {
  requestInterruptContext,
  enterInterruptContext,
  requestInterruptCalls,
} from "./interrupt-context-invocations.js";
import {
  interruptArgumentInputs,
  interruptArgumentFactsKey,
  interruptArgumentValue,
  advanceInterruptArgumentFacts,
  enterInterruptArgumentBlock,
  forgetInterruptArgumentHomes,
  combineInterruptHomeWrites,
} from "./interrupt-argument-facts.js";
import {
  installCia2Lease,
  applyCia2Operation,
  applyCia2RawWrite,
  releaseCia2Lease,
} from "./cia2-ownership.js";

import {
  interruptVectorStateKey,
  interruptLinkObservers,
  interruptCaptureFailure,
  interruptIrqTransitionFailure,
  interruptEntrySelection,
  interruptExecutionKey,
  closeInterruptCodeVariants,
} from "./interrupt-context-facts.js";
import type {
  SelectedEntry,
  LinkCapture,
  VectorState,
  InterruptContextAnalysis,
  InterruptLinkBinding,
  InterruptContextInvocation as ContextInvocation,
} from "./interrupt-context-facts.js";
export type { InterruptContextAnalysis } from "./interrupt-context-facts.js";
export {
  interruptVectorStateKey,
  interruptLinkObservers,
  interruptCaptureFailure,
} from "./interrupt-context-facts.js";

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
  const cia2 = program.interruptRoutes.some(
    ({ sink }) => sink.variant === "c64_kernal_nminv_exclusive",
  );
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
  const literals = new Map([...bodies].map(([key, body]) => [key, literalValues(body.blocks)]));
  const bodyAddresses = (body: SemanticFunction | SemanticGlobal) => {
    const key = bindingIdentityKey(body.id);
    if (!addresses.has(key))
      addresses.set(key, interruptContextWriteAddresses(program, body, clobbers, addressSpace));
    return addresses.get(key)!;
  };
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
    arguments_: readonly (bigint | undefined)[] = [],
  ): ContextInvocation => {
    return requestInterruptContext(
      {
        body,
        input,
        context,
        protectedReaders,
        ancestors,
        arguments: arguments_,
        ...(activeEntry === undefined ? {} : { activeEntry }),
      },
      program,
      invocations,
      contexts,
      schedule,
    );
  };
  const initial: VectorState = {
    vectors: { irq: null, nmi: null },
    words: new Map(),
    owners: { irq: [], nmi: [] },
    enabled: true,
    eligible: true,
    saved: [],
    path: [],
    ...(cia2 ? { cia2: INITIAL_CIA2_FACTS } : {}),
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
  for (const body of independentInterruptCallableBodies(program, bodies, cia2))
    request(body, initial, { domain: "main", irq: 0, nmi: 0 }, new Map());
  /** Enter one actual installed/chain target, protecting the executions it suspends. */
  const enter = (
    selected: SelectedEntry,
    state: VectorState,
    node: ContextInvocation,
    chain: boolean,
  ): ContextInvocation | null => {
    return enterInterruptContext(
      selected,
      state,
      node,
      chain,
      program,
      bodies,
      diagnostics,
      request,
    );
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
          // RTI restores I early enough to end any preceding old-I polling delay.
          // Only an actual return changes eligibility; absence retains that delay.
          eligible: state.enabled,
          ...(cia2
            ? { writesHomes: state.writesHomes === true || returned.writesHomes === true }
            : {}),
        });
      }
    }
    return states;
  };
  /** Reuse the existing ordered arrival relation for each vector transaction. */
  const publish = (
    captured: VectorState,
    destination: SelectedEntry | null,
    sink: "irq" | "nmi",
    source: SourceSpan,
    caller: VectorState,
    node: ContextInvocation,
  ): VectorState[] =>
    publishInterruptVector(captured, destination, sink, source, caller, (state) =>
      arrivals(state, node, true),
    );
  while (pending.length > 0 && diagnostics.length === 0) {
    const node = pending.shift()!;
    dirty.delete(node);
    if (node.body.entry === null) continue;
    const blocks = new Map(node.body.blocks.map((block) => [block.id, block]));
    const ownerKey = bindingIdentityKey(node.body.id);
    const executionKey = interruptExecutionKey(node.body.id, node.context);
    const executionPoints = cia2
      ? node.reached
      : (reached.get(executionKey) ?? new Map<string, Set<number>>());
    if (!cia2) reached.set(executionKey, executionPoints);
    bodyAddresses(node.body);
    const bodyLiterals = literals.get(ownerKey)!;
    const parameterRoots = new Set(
      "parameters" in node.body ? node.body.parameters.map(({ id }) => bindingIdentityKey(id)) : [],
    );
    const points = [
      {
        block: node.body.entry,
        index: 0,
        state: node.input,
        arguments: interruptArgumentInputs(node.body, node.arguments),
      },
    ];
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
        interruptArgumentFactsKey(point.arguments),
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
      // Observe fresh effects even after an earlier write and a new exact assignment.
      const before = cia2 ? { ...point.state, writesHomes: false } : point.state;
      for (const interrupted of arrivals(before, node, false, transaction || returning).slice(1)) {
        points.push({
          ...point,
          state: combineInterruptHomeWrites(interrupted, point.state),
          arguments: interrupted.writesHomes
            ? forgetInterruptArgumentHomes(point.arguments)
            : point.arguments,
        });
      }
      if (diagnostics.length > 0) break;
      let states = [before];
      const argumentFacts = point.arguments;
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
              for (const returned of chained?.exits.values() ?? [])
                exit(combineInterruptHomeWrites(returned, point.state));
            }
          } else exit(point.state);
        } else
          for (const target of terminal.kind === "jump"
            ? [terminal.target]
            : terminal.kind === "branch"
              ? [terminal.whenTrue, terminal.whenFalse]
              : []) {
            points.push({
              block: target,
              index: 0,
              state: point.state,
              arguments: enterInterruptArgumentBlock(
                point.arguments,
                bodyLiterals,
                blocks.get(target)!,
                point.block,
              ),
            });
          }
        continue;
      }
      if (operation.kind === "call" || operation.kind === "indirect-call") {
        const called = requestInterruptCalls(
          operation,
          before,
          node,
          program,
          bodies,
          request,
          cia2
            ? operation.arguments.map((id) =>
                interruptArgumentValue(point.arguments, bodyLiterals, id),
              )
            : [],
        );
        states = called.flatMap(({ exits }) => [...exits.values()]);
      } else if (operation.kind === "cpu-control") {
        states = [interruptCpuControlState(before, operation)];
      } else if (operation.kind === "platform") {
        if (selected.length > 0) {
          states = [];
          for (const route of selected) {
            const state = before;
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
            const device =
              state.cia2 === undefined || route.sink.domain !== "nmi"
                ? null
                : installCia2Lease(
                    state.cia2,
                    slot,
                    route.variant.id === "c64_kernal_nminv_exclusive",
                    capture.entry === null,
                    operation,
                  );
            if (device?.diagnostic !== null && device?.diagnostic !== undefined) {
              diagnostics.push(device.diagnostic);
              break;
            }
            const captured: VectorState = {
              ...state,
              ...(device === null ? {} : { cia2: device.facts }),
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
          if (sink === "irq" && before.irqTransition !== undefined) {
            diagnostics.push(interruptIrqTransitionFailure(before, operation.span));
            break;
          }
          const owner = before.owners[sink].at(-1);
          if (owner === undefined) throw new Error("Interrupt restore has no proved local owner");
          states = publish(
            {
              ...before,
              enabled: false,
              eligible: false,
              path: [...before.path, operation.span],
            },
            owner.capture.entry,
            sink,
            operation.span,
            before,
            node,
          ).flatMap((state) => {
            const device =
              state.cia2 === undefined || sink !== "nmi"
                ? null
                : releaseCia2Lease(
                    state.cia2,
                    owner.slot,
                    owner.capture.entry === null,
                    operation,
                    node.protectedReaders.has(owner.slot) ||
                      state.owners.nmi.slice(0, -1).some(({ slot }) => slot === owner.slot),
                  );
            if (device?.diagnostic !== null && device?.diagnostic !== undefined) {
              diagnostics.push(device.diagnostic);
              return [];
            }
            if (device !== null) {
              const policies =
                node.restores.get(operation) ??
                new Set<"ordinary" | "stock-clean" | "stock-typed">();
              policies.add(
                device.stockHandback
                  ? "stock-typed"
                  : owner.capture.entry === null && state.cia2?.leases.get(owner.slot)?.exclusive
                    ? "stock-clean"
                    : "ordinary",
              );
              node.restores.set(operation, policies);
            }
            return [
              {
                ...state,
                ...(device === null ? {} : { cia2: device.facts }),
                owners: { ...state.owners, [sink]: state.owners[sink].slice(0, -1) },
              },
            ];
          });
        } else {
          const argument = operation.arguments[0];
          const exact =
            argument === undefined
              ? undefined
              : interruptArgumentValue(point.arguments, bodyLiterals, argument);
          const actualCall =
            exact !== undefined &&
            argument !== undefined &&
            !bodyLiterals.has(argument) &&
            node.arguments.length > 0
              ? node.input.path.at(-1)
              : undefined;
          const device =
            before.cia2 === undefined
              ? null
              : applyCia2Operation(
                  before.cia2,
                  before,
                  node.activeEntry,
                  operation,
                  exact,
                  actualCall,
                );
          if (device?.diagnostic !== null && device?.diagnostic !== undefined)
            diagnostics.push(device.diagnostic);
          states = [
            {
              ...before,
              ...(device === null ? {} : { cia2: device.facts }),
              eligible: before.enabled,
            },
          ];
        }
      } else if (operation.kind === "memory-write") {
        const address = addresses.get(ownerKey)!.get(operation);
        const rawVectors = new Map(before.rawVectors);
        const readers = interruptLinkObservers(
          before,
          node.protectedReaders,
          node.activeEntry,
          program,
        );
        for (const sink of ["irq", "nmi"] as const) {
          if (!interruptWriteTouches(operation, address, vectorBytes[sink], sink === "nmi"))
            continue;
          if (
            before.vectors[sink] !== null ||
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
        states = [
          {
            ...before,
            rawVectors,
            eligible: before.enabled,
            ...(before.cia2 === undefined
              ? {}
              : {
                  cia2: applyCia2RawWrite(
                    before.cia2,
                    before,
                    operation,
                    address,
                    interruptArgumentValue(point.arguments, bodyLiterals, operation.value),
                  ),
                  writesHomes: interruptWriteMayTouchHomes(operation, address, addressSpace),
                }),
          },
        ];
      } else states = [{ ...before, eligible: before.enabled }];
      for (const state of states)
        points.push({
          block: point.block,
          index: point.index + 1,
          state: combineInterruptHomeWrites(state, point.state),
          arguments: cia2
            ? advanceInterruptArgumentFacts(
                state.writesHomes ? forgetInterruptArgumentHomes(argumentFacts) : argumentFacts,
                bodyLiterals,
                operation,
                parameterRoots,
              )
            : argumentFacts,
        });
    }
  }
  const code =
    !cia2 || diagnostics.length > 0
      ? null
      : closeInterruptCodeVariants([...invocations.values()], program);
  if (code !== null) diagnostics.push(...code.diagnostics);
  return {
    contexts: code?.contexts ?? contexts,
    bindings:
      diagnostics.length === 0
        ? code === null
          ? bindings
          : interruptVariantBindings(bindings, code.contexts, program)
        : new Map(),
    reached: diagnostics.length === 0 ? (code?.reached ?? reached) : new Map(),
    diagnostics,
    ...(code === null || diagnostics.length > 0
      ? {}
      : { cia2Restores: code.cia2Restores, cia2Calls: code.cia2Calls }),
  };
}
