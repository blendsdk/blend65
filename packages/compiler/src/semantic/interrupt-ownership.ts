import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { IndirectTargetSets } from "./function-targets.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  SemanticProgram,
  SemanticOperation,
  ValueId,
} from "./operations.js";

/** The two independently owned firmware vector stacks. */
type InterruptSink = "irq" | "nmi";

/** A caller-visible stack action retained after locally balanced installs cancel. */
type OwnershipEvent =
  | { readonly kind: "push"; readonly site: string }
  | { readonly kind: "pop" }
  | { readonly kind: "raw" };

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
  /** Maximum simultaneously live predecessor words for each vector. */
  readonly maxDepth: Readonly<Record<InterruptSink, number>>;
  /** Install depth relative to the enclosing function's entry at each operation. */
  readonly relativeDepths: ReadonlyMap<SemanticOperation, Readonly<Record<InterruptSink, number>>>;
  /** Ownership depth at the start of the main function, after initializers. */
  readonly mainEntryDepth: Readonly<Record<InterruptSink, number>>;
  /** Ownership depth at the start of each ordered initializer. */
  readonly initializerEntryDepths: ReadonlyMap<string, Readonly<Record<InterruptSink, number>>>;
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

/** Equality includes the exact predecessor identity, not just the stack depth. */
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
      return (
        event.kind === other.kind &&
        (event.kind !== "push" || (other.kind === "push" && event.site === other.site))
      );
    })
  );
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
): { readonly state: OwnershipState; readonly diagnostic: ProjectDiagnostic | null } {
  const result = copyState(state);
  for (const sink of ["irq", "nmi"] as const) {
    for (const event of effect[sink]) {
      const diagnostic = applyEvent(result, sink, event, span, callerMayOwn);
      if (diagnostic !== null) return { state: result, diagnostic };
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
    `Interrupt ownership for sink '${sink}' is invalid at '${operation}' — installs and restores must agree on every path`,
    span,
  );
}

/** Find exact literal addresses without treating computed addresses as constants. */
function constantAddresses(blocks: readonly SemanticBlock[]): ReadonlyMap<ValueId, bigint> {
  const values = new Map<ValueId, bigint>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (operation.kind === "constant" && typeof operation.value === "bigint") {
        values.set(operation.result, operation.value);
      } else if (operation.kind === "convert") {
        const value = values.get(operation.operand);
        if (value !== undefined) values.set(operation.result, value & 0xffffn);
      }
    }
  }
  return values;
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
): InterruptOwnershipAnalysis {
  const functions = new Map(
    program.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const summaries = new Map<string, OwnershipSummary>();
  const active = new Set<string>();
  const diagnostics: ProjectDiagnostic[] = [];
  const maximum = { irq: 0, nmi: 0 };
  const relativeDepths = new Map<SemanticOperation, Readonly<Record<InterruptSink, number>>>();
  const initializerEntryDepths = new Map<string, Readonly<Record<InterruptSink, number>>>();

  // A handler can interrupt an earlier handler while its predecessor link is
  // still live. Reusing the mainline link for an install in that context would
  // overwrite the earlier predecessor, even if both installs are balanced.
  const visitedIRQFunctions = new Set<string>();
  const checkIRQHandlerCalls = (fn: SemanticFunction): void => {
    const key = bindingIdentityKey(fn.id);
    if (visitedIRQFunctions.has(key)) return;
    visitedIRQFunctions.add(key);
    for (const block of fn.blocks) {
      for (const operation of block.operations) {
        if (
          operation.kind === "platform" &&
          ownershipOperation(operation.capability)?.sink === "irq"
        ) {
          diagnostics.push(
            projectDiagnostic(
              "E10245",
              "IRQ vector installation or restoration is not supported during interrupt execution",
              operation.span,
            ),
          );
        }
        if (operation.kind !== "call" && operation.kind !== "indirect-call") continue;
        const targets =
          operation.kind === "call" ? [operation.callee] : (indirectTargets.get(operation) ?? []);
        for (const target of targets) {
          const callee = functions.get(bindingIdentityKey(target));
          if (callee !== undefined) checkIRQHandlerCalls(callee);
        }
      }
    }
  };
  for (const fn of program.functions) {
    if (fn.entryKind === "interrupt" && reachable.has(bindingIdentityKey(fn.id))) {
      checkIRQHandlerCalls(fn);
    }
  }
  if (diagnostics.length > 0) {
    return Object.freeze({
      diagnostics: Object.freeze(diagnostics),
      maxDepth: Object.freeze(maximum),
      relativeDepths,
      mainEntryDepth: Object.freeze({ irq: 0, nmi: 0 }),
      initializerEntryDepths,
    });
  }

  /** Analyze a callable body or one startup initializer through the same CFG proof. */
  const analyze = (
    key: string,
    name: string,
    source: SourceSpan,
    entry: string,
    blocks: readonly SemanticBlock[],
    callerMayOwn: boolean,
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
    const addresses = constantAddresses(blocks);
    const atEntry = new Map<string, OwnershipState>([[entry, EMPTY]]);
    const pending = [entry];
    let returned: OwnershipState | null = null;
    const peak = { irq: 0, nmi: 0 };
    let steps = 0;
    while (pending.length > 0 && diagnostics.length === 0) {
      const blockId = pending.shift()!;
      const block = byId.get(blockId);
      if (block === undefined) throw new Error(`Missing semantic block '${blockId}'`);
      let state = copyState(atEntry.get(blockId)!);
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
                { kind: "push", site: site(operation.span) },
                operation.span,
                callerMayOwn,
              );
              peak[sink] = Math.max(peak[sink], relativeDepth(state[sink]));
            } else {
              const diagnostic = applyEvent(
                state,
                sink,
                { kind: "pop" },
                operation.span,
                callerMayOwn,
              );
              if (diagnostic !== null) diagnostics.push(diagnostic);
            }
          }
        } else if (operation.kind === "memory-write") {
          const address = addresses.get(operation.address);
          if (address !== undefined) {
            const written = [address & 0xffffn];
            if (operation.width === 2) written.push((address + 1n) & 0xffffn);
            if (written.includes(0x0314n) || written.includes(0x0315n)) {
              applyEvent(state, "irq", { kind: "raw" }, operation.span, callerMayOwn);
            }
            if (written.includes(0x0318n) || written.includes(0x0319n)) {
              applyEvent(state, "nmi", { kind: "raw" }, operation.span, callerMayOwn);
            }
          }
        } else if (operation.kind === "call" || operation.kind === "indirect-call") {
          const targets =
            operation.kind === "call" ? [operation.callee] : (indirectTargets.get(operation) ?? []);
          let next: OwnershipState | null = null;
          for (const target of targets) {
            const callee = functions.get(bindingIdentityKey(target));
            if (callee === undefined) continue;
            const effect = summarize(callee);
            if (!effect.returns) continue;
            for (const sink of ["irq", "nmi"] as const) {
              peak[sink] = Math.max(peak[sink], relativeDepth(state[sink]) + effect.peak[sink]);
            }
            const composed = compose(state, effect.state, operation.span, callerMayOwn);
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
          if (next !== null) state = next;
        }
        if (diagnostics.length > 0) break;
      }
      if (diagnostics.length > 0) break;
      const terminal = block.terminator;
      if (terminal.kind === "return") {
        if (returned !== null && !sameState(returned, state)) {
          diagnostics.push(
            invalidOwnership(differingSink(returned, state), "function return", source),
          );
        }
        returned = state;
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
        }
      }
      steps += 1;
      if (steps > blocks.length * 2) {
        diagnostics.push(
          projectDiagnostic(
            "E10245",
            `Execution path '${name}' has no static interrupt bound`,
            source,
          ),
        );
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
    });
  for (const sink of ["irq", "nmi"] as const) {
    if (state[sink].some((event) => event.kind !== "raw")) {
      diagnostics.push(invalidOwnership(sink, "program return", main.source));
    }
  }
  for (const fn of program.functions) {
    if (!reachable.has(bindingIdentityKey(fn.id)) || fn.entryKind !== "interrupt") continue;
    const effect = summarize(fn);
    // An interrupt root can run again after it returns. A net install or
    // restore would change the vector depth on every entry, so no fixed set of
    // predecessor words could serve all executions.
    if ((["irq", "nmi"] as const).some((sink) => relativeDepth(effect.state[sink]) !== 0)) {
      diagnostics.push(
        projectDiagnostic(
          "E10245",
          `Interrupt handler '${fn.name ?? "<handler>"}' changes vector ownership across repeated entries`,
          fn.source,
        ),
      );
    }
  }
  return Object.freeze({
    diagnostics: Object.freeze(diagnostics),
    maxDepth: Object.freeze(maximum),
    relativeDepths,
    mainEntryDepth,
    initializerEntryDepths,
  });
}
