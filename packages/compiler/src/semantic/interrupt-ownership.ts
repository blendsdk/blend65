import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { IndirectTargetSets } from "./function-targets.js";
import type { InterruptRoute } from "./whole-program.js";
import { checkCiaOwnership } from "./cia-ownership.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  SemanticProgram,
  SemanticOperation,
} from "./operations.js";
import {
  interruptClobberedGlobals,
  interruptWriteAddresses,
  interruptWriteTouches,
} from "./interrupt-address-facts.js";
import type { InterruptDepthChange } from "./interrupt-address-facts.js";
import type { TargetProfile } from "../target/profile.js";

/** The two independently owned firmware vector stacks. */
type InterruptSink = "irq" | "nmi";

/** A caller-visible stack action retained after locally balanced installs cancel. */
type OwnershipEvent =
  | { readonly kind: "push"; readonly sites: readonly string[] }
  | { readonly kind: "pop"; readonly span: SourceSpan }
  | { readonly kind: "raw"; readonly span: SourceSpan };

/** Each sink has an independent symbolic effect, with no runtime ownership bytes. */
interface OwnershipState {
  irq: OwnershipEvent[];
  nmi: OwnershipEvent[];
}

/** A function's one agreed transformation at every returning exit. */
interface OwnershipSummary {
  readonly state: OwnershipState;
  readonly returns: boolean;
  /** Largest install depth relative to this function's entry. */
  readonly peak: Readonly<Record<InterruptSink, number>>;
}

/** Resource demand proved while checking the existing ownership effects. */
export interface InterruptOwnershipAnalysis {
  /** Terminal diagnostics; no binding facts are consumed when nonempty. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Source restores with one proved final-exclusive CIA1 stock handback on every call path. */
  readonly cia1Handbacks: ReadonlySet<SemanticOperation>;
  /** Maximum simultaneously live predecessor words for each vector. */
  readonly maxDepth: Readonly<Record<InterruptSink, number>>;
  /** Install depth relative to the enclosing function's entry at each operation. */
  readonly relativeDepths: ReadonlyMap<SemanticOperation, Readonly<Record<InterruptSink, number>>>;
  /** Ownership depth at the start of the main function, after initializers. */
  readonly mainEntryDepth: Readonly<Record<InterruptSink, number>>;
  /** Ownership depth at the start of each ordered initializer. */
  readonly initializerEntryDepths: ReadonlyMap<string, Readonly<Record<InterruptSink, number>>>;
  /** Actual reachable returning exits; a nonreturning call has no caller successor. */
  readonly returningBodies?: ReadonlyMap<string, boolean>;
  /** Returning source-call lifetime effects, reused by exact-address recovery. */
  readonly returningDepthChanges?: ReadonlyMap<string, InterruptDepthChange>;
  /** Returning bodies which neither consume nor export any caller-owned vector prefix. */
  readonly locallyBalancedBodies?: ReadonlySet<string>;
}

const EMPTY: OwnershipState = { irq: [], nmi: [] };

/** Net install depth represented by a symbolic caller-visible effect. */
function relativeDepth(events: readonly OwnershipEvent[]): number {
  return events.reduce(
    (depth, event) => depth + (event.kind === "push" ? 1 : event.kind === "pop" ? -1 : 0),
    0,
  );
}

/** Copy each stack so a branch never mutates its sibling's proof state. */
function copyState(state: OwnershipState): OwnershipState {
  return { irq: [...state.irq], nmi: [...state.nmi] };
}

/** Ownership joins compare actions; selected route choices remain separate facts. */
function sameState(left: OwnershipState, right: OwnershipState): boolean {
  return sameSink(left, right, "irq") && sameSink(left, right, "nmi");
}

/** Name the first sink whose ownership differs between two paths. */
function differingSink(left: OwnershipState, right: OwnershipState): InterruptSink {
  return sameSink(left, right, "irq") ? "nmi" : "irq";
}

/** Compare one independent interrupt sink's ownership. */
function sameSink(left: OwnershipState, right: OwnershipState, sink: InterruptSink): boolean {
  return (
    left[sink].length === right[sink].length &&
    left[sink].every((event, index) => {
      const other = right[sink][index]!;
      return event.kind === other.kind;
    })
  );
}

/** Keep every possible install site when equal ownership paths meet. */
function mergeSites(left: OwnershipState, right: OwnershipState): OwnershipState | null {
  const merged = copyState(left);
  let changed = false;
  for (const sink of ["irq", "nmi"] as const) {
    for (const [index, event] of left[sink].entries()) {
      const other = right[sink][index];
      if (event.kind !== "push" || other?.kind !== "push") continue;
      const sites = [...new Set([...event.sites, ...other.sites])];
      if (sites.length === event.sites.length) continue;
      merged[sink][index] = { kind: "push", sites };
      changed = true;
    }
  }
  return changed ? merged : null;
}

/** Replay one source action, preserving the order of raw writes and caller-owned pops. */
function applyEvent(
  state: OwnershipState,
  sink: InterruptSink,
  event: OwnershipEvent,
  span: SourceSpan,
  callerMayOwn: boolean,
): ProjectDiagnostic | null {
  const events = state[sink];
  if (event.kind === "push") {
    events.push(event);
    return null;
  }
  if (event.kind === "raw") {
    if (sink === "nmi" && events.some((candidate) => candidate.kind === "push")) {
      // A possible live-vector overwrite fails at the writer, not at a later
      // restore which merely reveals the already-invalid predecessor.
      return invalidOwnership(sink, "raw vector write", event.span);
    }
    if (!callerMayOwn && !events.some((candidate) => candidate.kind === "push")) return null;
    // Consecutive raw writes have the same ownership effect, even though both
    // volatile writes remain in the semantic program and emitted code.
    if (events.at(-1)?.kind !== "raw") events.push(event);
    return null;
  }
  const lastPush = events.findLastIndex((candidate) => candidate.kind === "push");
  if (lastPush >= 0) {
    if (events.slice(lastPush + 1).some((candidate) => candidate.kind === "raw")) {
      return invalidOwnership(sink, "restore after raw vector write", span);
    }
    events.splice(lastPush, 1);
    return null;
  }
  if (events.some((candidate) => candidate.kind === "raw")) {
    return invalidOwnership(sink, "restore after raw vector write", span);
  }
  events.push(event);
  return null;
}

/** Apply a callee's ordered symbolic effect to a caller's current ownership. */
function compose(
  state: OwnershipState,
  effect: OwnershipState,
  span: SourceSpan,
  callerMayOwn: boolean,
  handlerRoot = false,
): { readonly state: OwnershipState; readonly diagnostic: ProjectDiagnostic | null } {
  const result = copyState(state);
  for (const sink of ["irq", "nmi"] as const) {
    for (const event of effect[sink]) {
      const diagnostic = applyEvent(result, sink, event, span, callerMayOwn);
      if (diagnostic !== null) return { state: result, diagnostic };
      if (handlerRoot && relativeDepth(result[sink]) < 0) {
        return {
          state: result,
          diagnostic: invalidOwnership(sink, "restore below handler prefix", span),
        };
      }
    }
  }
  return { state: result, diagnostic: null };
}

/** Stable source identity distinguishes two otherwise equal nested installs. */
function site(span: SourceSpan): string {
  return `${span.sourceId}:${span.start}:${span.end}`;
}

/** Recognize only profile-declared vector ownership operations. */
function ownershipOperation(
  capability: string,
): { sink: InterruptSink; action: "push" | "pop" } | null {
  if (capability === "c64.system.setIRQ" || capability === "c64.system.setIRQExclusive") {
    return { sink: "irq", action: "push" };
  }
  if (capability === "c64.system.setNMI" || capability === "c64.system.setNMIExclusive") {
    return { sink: "nmi", action: "push" };
  }
  if (capability === "c64.system.restoreIRQ") return { sink: "irq", action: "pop" };
  if (capability === "c64.system.restoreNMI") return { sink: "nmi", action: "pop" };
  return null;
}

/** Explain an ownership proof failure at the operation that made it visible. */
function invalidOwnership(
  sink: InterruptSink,
  operation: string,
  span: SourceSpan,
): ProjectDiagnostic {
  return projectDiagnostic(
    "E10278",
    `Interrupt ownership for sink 'c64.system.${sink === "irq" ? "setIRQ" : "setNMI"}' is invalid at '${operation}' — installs and restores must agree on every path`,
    span,
  );
}

/** A growing ownership state on a cycle is unbounded, unlike an unequal branch join. */
function pathReaches(
  blocks: ReadonlyMap<string, SemanticBlock>,
  from: string,
  to: string,
): boolean {
  const pending = [from];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const id = pending.shift()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const terminal = blocks.get(id)?.terminator;
    if (terminal?.kind === "jump") pending.push(terminal.target);
    else if (terminal?.kind === "branch") pending.push(terminal.whenTrue, terminal.whenFalse);
  }
  return false;
}

/** Check one complete program's install/restore effects across direct calls and CFG joins. */
export function checkInterruptOwnership(
  program: SemanticProgram,
  reachable: ReadonlySet<string>,
  indirectTargets: IndirectTargetSets,
  routes: readonly InterruptRoute[] = [],
  addressSpace?: Pick<TargetProfile["storage"], "ram" | "zeroPage">,
): InterruptOwnershipAnalysis {
  // Device-state failures must point at the CIA operation or unsafe hand-back
  // before the vector-only proof can report its broader unmatched-install error.
  const cia1Handbacks = new Set<SemanticOperation>();
  const ciaDiagnostics = checkCiaOwnership(
    program,
    reachable,
    indirectTargets,
    routes,
    cia1Handbacks,
  );
  if (ciaDiagnostics.length > 0) {
    const emptyDepth = Object.freeze({ irq: 0, nmi: 0 });
    return Object.freeze({
      diagnostics: ciaDiagnostics,
      cia1Handbacks: new Set<SemanticOperation>(),
      maxDepth: emptyDepth,
      relativeDepths: new Map(),
      mainEntryDepth: emptyDepth,
      initializerEntryDepths: new Map(),
    });
  }
  const functions = new Map(
    program.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const summaries = new Map<string, OwnershipSummary>();
  const active = new Set<string>();
  const diagnostics: ProjectDiagnostic[] = [];
  const maximum = { irq: 0, nmi: 0 };
  const relativeDepths = new Map<SemanticOperation, Readonly<Record<InterruptSink, number>>>();
  const initializerEntryDepths = new Map<string, Readonly<Record<InterruptSink, number>>>();
  // Only selected routes can own predecessor links. Their platform facts supply both
  // vector bytes; the shared ownership proof does not choose a machine memory map.
  const vectorBytes = { irq: new Set<bigint>(), nmi: new Set<bigint>() };
  const irqRoots = new Set<string>();
  const selectedHandlers = new Set(routes.map((route) => bindingIdentityKey(route.handler)));
  const clobbers = {
    irq: interruptClobberedGlobals(
      program,
      new Set(
        routes
          .filter(({ sink }) => sink.domain === "irq")
          .map(({ handler }) => bindingIdentityKey(handler)),
      ),
      indirectTargets,
      addressSpace,
    ),
    nmi: interruptClobberedGlobals(
      program,
      new Set(
        routes
          .filter(({ sink }) => sink.domain === "nmi")
          .map(({ handler }) => bindingIdentityKey(handler)),
      ),
      indirectTargets,
      addressSpace,
    ),
  };
  for (const route of routes) {
    const { sink } = route;
    const low = BigInt(sink.vector);
    vectorBytes[sink.domain].add(low);
    vectorBytes[sink.domain].add((low + 1n) & 0xffffn);
    if (route.sink.domain === "irq") irqRoots.add(bindingIdentityKey(route.handler));
  }

  /** Analyze a callable body or one startup initializer through the same CFG proof. */
  const analyze = (
    key: string,
    name: string,
    source: SourceSpan,
    entry: string,
    blocks: readonly SemanticBlock[],
    callerMayOwn: boolean,
    handlerRoot: boolean,
  ): OwnershipSummary => {
    const cached = summaries.get(key);
    if (cached !== undefined) return cached;
    if (active.has(key)) {
      diagnostics.push(
        projectDiagnostic(
          "E10245",
          `Execution path '${name}' has no static interrupt bound`,
          source,
        ),
      );
      return { state: EMPTY, returns: false, peak: { irq: 0, nmi: 0 } };
    }
    active.add(key);
    const byId = new Map(blocks.map((block) => [block.id, block] as const));
    const addresses = interruptWriteAddresses(
      program,
      entry,
      blocks,
      key === bindingIdentityKey(program.main),
      clobbers,
      addressSpace,
      indirectTargets,
      (target) => {
        const callee = functions.get(bindingIdentityKey(target));
        if (callee === undefined) return undefined;
        const effect = summarize(callee);
        return effect.returns
          ? { irq: relativeDepth(effect.state.irq), nmi: relativeDepth(effect.state.nmi) }
          : null;
      },
    );
    const atEntry = new Map<string, OwnershipState>([[entry, EMPTY]]);
    const pending = [entry];
    let returned: OwnershipState | null = null;
    const peak = { irq: 0, nmi: 0 };
    while (pending.length > 0 && diagnostics.length === 0) {
      const blockId = pending.shift()!;
      const block = byId.get(blockId);
      if (block === undefined) throw new Error(`Missing semantic block '${blockId}'`);
      let state = copyState(atEntry.get(blockId)!);
      let continues = true;
      for (const operation of block.operations) {
        relativeDepths.set(
          operation,
          Object.freeze({ irq: relativeDepth(state.irq), nmi: relativeDepth(state.nmi) }),
        );
        if (operation.kind === "platform") {
          const effect = ownershipOperation(operation.capability);
          if (effect !== null) {
            const sink = effect.sink;
            if (effect.action === "push") {
              applyEvent(
                state,
                sink,
                { kind: "push", sites: [site(operation.span)] },
                operation.span,
                callerMayOwn,
              );
              peak[sink] = Math.max(peak[sink], relativeDepth(state[sink]));
            } else {
              const diagnostic = applyEvent(
                state,
                sink,
                { kind: "pop", span: operation.span },
                operation.span,
                callerMayOwn,
              );
              if (diagnostic !== null) diagnostics.push(diagnostic);
            }
          }
        } else if (operation.kind === "memory-write") {
          const address = addresses.get(operation);
          for (const sink of ["irq", "nmi"] as const) {
            if (
              !interruptWriteTouches(
                operation,
                address,
                vectorBytes[sink],
                sink === "nmi" && vectorBytes.nmi.size > 0,
              )
            )
              continue;
            const diagnostic = applyEvent(
              state,
              sink,
              { kind: "raw", span: operation.span },
              operation.span,
              callerMayOwn,
            );
            if (diagnostic !== null) diagnostics.push(diagnostic);
          }
        } else if (operation.kind === "call" || operation.kind === "indirect-call") {
          const targets =
            operation.kind === "call" ? [operation.callee] : (indirectTargets.get(operation) ?? []);
          let next: OwnershipState | null = null;
          for (const target of targets) {
            const callee = functions.get(bindingIdentityKey(target));
            if (callee === undefined) continue;
            const effect = summarize(callee);
            for (const sink of ["irq", "nmi"] as const) {
              peak[sink] = Math.max(peak[sink], relativeDepth(state[sink]) + effect.peak[sink]);
            }
            if (!effect.returns) continue;
            const composed = compose(
              state,
              effect.state,
              operation.span,
              callerMayOwn,
              handlerRoot,
            );
            if (composed.diagnostic !== null) {
              diagnostics.push(composed.diagnostic);
              continue;
            }
            const candidate = composed.state;
            if (next !== null && !sameState(next, candidate)) {
              diagnostics.push(
                invalidOwnership(differingSink(next, candidate), "indirect call", operation.span),
              );
            }
            next = candidate;
          }
          if (next === null) {
            continues = false;
            break;
          }
          state = next;
        }
        // A helper may return a caller-owned pop, but an interrupt root has no
        // caller-owned vector frame. Its interrupted predecessor belongs to the
        // suspended execution and cannot be consumed by this handler.
        if (handlerRoot) {
          const borrowed = (["irq", "nmi"] as const).find((sink) => relativeDepth(state[sink]) < 0);
          if (borrowed !== undefined) {
            diagnostics.push(
              invalidOwnership(borrowed, "restore below handler prefix", operation.span),
            );
          }
        }
        if (diagnostics.length > 0) break;
      }
      if (diagnostics.length > 0) break;
      if (!continues) continue;
      const terminal = block.terminator;
      if (terminal.kind === "return") {
        if (returned !== null && !sameState(returned, state)) {
          diagnostics.push(
            invalidOwnership(differingSink(returned, state), "function return", source),
          );
        }
        returned = returned === null ? state : (mergeSites(returned, state) ?? returned);
        continue;
      }
      const successors =
        terminal.kind === "jump"
          ? [terminal.target]
          : terminal.kind === "branch"
            ? [terminal.whenTrue, terminal.whenFalse]
            : [];
      for (const successor of successors) {
        const previous = atEntry.get(successor);
        if (previous === undefined) {
          atEntry.set(successor, state);
          pending.push(successor);
        } else if (!sameState(previous, state)) {
          const growing =
            (["irq", "nmi"] as const).some((sink) => state[sink].length > previous[sink].length) &&
            pathReaches(byId, successor, blockId);
          diagnostics.push(
            growing
              ? projectDiagnostic(
                  "E10245",
                  `Execution path '${name}' can nest interrupt installs without a static bound`,
                  source,
                )
              : invalidOwnership(differingSink(previous, state), "control-flow join", source),
          );
        } else {
          const merged = mergeSites(previous, state);
          if (merged !== null) {
            atEntry.set(successor, merged);
            pending.push(successor);
          }
        }
      }
    }
    active.delete(key);
    const summary = Object.freeze({
      state: returned ?? EMPTY,
      returns: returned !== null,
      peak: Object.freeze(peak),
    });
    summaries.set(key, summary);
    return summary;
  };

  /** Source-call effects are finite because whole-program recursion is rejected first. */
  function summarize(fn: SemanticFunction): OwnershipSummary {
    return analyze(
      bindingIdentityKey(fn.id),
      fn.name ?? "<function>",
      fn.source,
      fn.entry,
      fn.blocks,
      bindingIdentityKey(fn.id) !== bindingIdentityKey(program.main),
      fn.entryKind === "interrupt" && selectedHandlers.has(bindingIdentityKey(fn.id)),
    );
  }

  const main = functions.get(bindingIdentityKey(program.main));
  if (main === undefined) throw new Error("Selected main function is missing");
  let state: OwnershipState = EMPTY;
  const globals = new Map(
    program.globals.map(
      (global: SemanticGlobal) => [bindingIdentityKey(global.id), global] as const,
    ),
  );
  for (const initializer of program.initializerOrder) {
    const global = globals.get(bindingIdentityKey(initializer));
    if (global === undefined || global.entry === null) continue;
    initializerEntryDepths.set(
      bindingIdentityKey(initializer),
      Object.freeze({ irq: relativeDepth(state.irq), nmi: relativeDepth(state.nmi) }),
    );
    const effect = analyze(
      bindingIdentityKey(global.id),
      "<initializer>",
      global.source,
      global.entry,
      global.blocks,
      false,
      false,
    );
    for (const sink of ["irq", "nmi"] as const) {
      maximum[sink] = Math.max(maximum[sink], relativeDepth(state[sink]) + effect.peak[sink]);
    }
    if (effect.returns) {
      const composed = compose(state, effect.state, global.source, false);
      if (composed.diagnostic !== null) diagnostics.push(composed.diagnostic);
      state = composed.state;
    }
    if (diagnostics.length > 0)
      return Object.freeze({
        diagnostics: Object.freeze(diagnostics),
        maxDepth: maximum,
        relativeDepths,
        mainEntryDepth: Object.freeze({ irq: 0, nmi: 0 }),
        initializerEntryDepths,
        cia1Handbacks: new Set<SemanticOperation>(),
      });
  }
  const mainEntryDepth = Object.freeze({
    irq: relativeDepth(state.irq),
    nmi: relativeDepth(state.nmi),
  });
  const mainSummary = summarize(main);
  if (diagnostics.length > 0)
    return Object.freeze({
      diagnostics: Object.freeze(diagnostics),
      maxDepth: maximum,
      relativeDepths,
      mainEntryDepth,
      initializerEntryDepths,
      cia1Handbacks: new Set<SemanticOperation>(),
    });
  for (const sink of ["irq", "nmi"] as const) {
    maximum[sink] = Math.max(maximum[sink], relativeDepth(state[sink]) + mainSummary.peak[sink]);
  }
  if (mainSummary.returns) {
    const composed = compose(state, mainSummary.state, main.source, false);
    if (composed.diagnostic !== null) diagnostics.push(composed.diagnostic);
    state = composed.state;
  }
  if (diagnostics.length > 0)
    return Object.freeze({
      diagnostics: Object.freeze(diagnostics),
      maxDepth: maximum,
      relativeDepths,
      mainEntryDepth,
      initializerEntryDepths,
      cia1Handbacks: new Set<SemanticOperation>(),
    });
  for (const sink of ["irq", "nmi"] as const) {
    if (state[sink].some((event) => event.kind !== "raw")) {
      const unmatched = state[sink].find((event) => event.kind === "pop");
      diagnostics.push(
        invalidOwnership(
          sink,
          unmatched === undefined
            ? "program return"
            : sink === "irq"
              ? "restoreIRQ()"
              : "restoreNMI()",
          unmatched?.span ?? main.source,
        ),
      );
    }
  }
  for (const fn of program.functions) {
    if (!reachable.has(bindingIdentityKey(fn.id)) || fn.entryKind !== "interrupt") continue;
    const effect = summarize(fn);
    // An interrupt root can run again after it returns. A leftover install is
    // an ownership error; a self-install additionally creates an unbounded
    // interrupt route if that newly selected entry can recur.
    if ((["irq", "nmi"] as const).some((sink) => relativeDepth(effect.state[sink]) !== 0)) {
      if (!irqRoots.has(bindingIdentityKey(fn.id))) {
        diagnostics.push(
          projectDiagnostic(
            "E10245",
            `Interrupt handler '${fn.name ?? "<handler>"}' changes vector ownership across repeated entries`,
            fn.source,
          ),
        );
        continue;
      }
      const sink = (["irq", "nmi"] as const).find(
        (candidate) => relativeDepth(effect.state[candidate]) !== 0,
      )!;
      // A helper may own the surviving push; its original source site remains in
      // the summary even though the installation is outside this handler body.
      const selfInstall = routes.find(
        (route) =>
          route.sink.domain === sink &&
          bindingIdentityKey(route.handler) === bindingIdentityKey(fn.id) &&
          effect.state[sink].some(
            (event) => event.kind === "push" && event.sites.includes(site(route.installation.span)),
          ),
      )?.installation;
      if (selfInstall !== undefined) {
        diagnostics.push(
          projectDiagnostic(
            "E10245",
            `Execution path '${fn.name ?? "<handler>"}' can overlap or consume hardware stack without a static bound — use a bounded interrupt/callback design`,
            selfInstall.span,
            null,
            routes
              .filter(
                (route) =>
                  bindingIdentityKey(route.handler) === bindingIdentityKey(fn.id) &&
                  route.installation !== selfInstall,
              )
              .map((route) => ({
                span: route.installation.span,
                message: "Handler is installed here",
              })),
          ),
        );
      } else {
        diagnostics.push(invalidOwnership(sink, "handler return", fn.source));
      }
    }
  }
  return Object.freeze({
    diagnostics: Object.freeze(diagnostics),
    cia1Handbacks: diagnostics.length === 0 ? cia1Handbacks : new Set<SemanticOperation>(),
    maxDepth: Object.freeze(maximum),
    relativeDepths,
    mainEntryDepth,
    initializerEntryDepths,
    returningBodies: new Map([...summaries].map(([key, summary]) => [key, summary.returns])),
    locallyBalancedBodies: new Set(
      [...summaries]
        .filter(([, s]) => s.returns && s.state.irq.length === 0 && s.state.nmi.length === 0)
        .map(([key]) => key),
    ),
    returningDepthChanges: new Map(
      [...summaries]
        .filter(([, summary]) => summary.returns)
        .map(([key, summary]) => [
          key,
          { irq: relativeDepth(summary.state.irq), nmi: relativeDepth(summary.state.nmi) },
        ]),
    ),
  });
}
