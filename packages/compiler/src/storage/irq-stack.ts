import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SemanticBlock } from "../semantic/operations.js";
import type { InterruptRoute, WholeProgram } from "../semantic/whole-program.js";
import type { HelperCallDemand, StorageBinder } from "./storage-types.js";

/** The two simultaneously live portions of one winning stack route. */
export interface SimultaneousStackPeak {
  /** Mainline or initializer bytes retained at the interruption point. */
  readonly program: number;
  /** Handler entry, body and helper bytes above those program bytes. */
  readonly system: number;
  /** Source and selected-entry identities explaining this one feasible peak. */
  readonly route: readonly string[];
}

/** Compile-time state only; source ownership and status-depth checks already prove balance. */
interface StackState {
  /** Installation identities, oldest first; each may select several proved handlers. */
  irq: string[];
  /** Architectural interrupt-enable state (the inverse of the status I bit). */
  enabled: boolean;
  /** IRQ recognition at the current boundary, before a delayed I-bit change takes effect. */
  eligible: boolean;
  /** Saved architectural states for this function's live source PHP operations. */
  saved: boolean[];
}

/** A body's relative peak and agreed ownership/mask at returning exits. */
interface StackSummary {
  readonly peak: SimultaneousStackPeak;
  readonly exit: StackState | null;
}

/** Keep byte accounting and its explanation together, including deterministic ties. */
function deeper(left: SimultaneousStackPeak, right: SimultaneousStackPeak): SimultaneousStackPeak {
  const a = left.program + left.system;
  const b = right.program + right.system;
  if (a !== b) return a > b ? left : right;
  return JSON.stringify(left.route) <= JSON.stringify(right.route) ? left : right;
}

/** Branches and callees must not mutate their caller's saved-status proof. */
function copy(state: StackState): StackState {
  return { ...state, irq: [...state.irq], saved: [...state.saved] };
}

/** Merge only flag possibilities; ownership identities and save depths must already agree. */
function merge(left: StackState, right: StackState): StackState {
  if (
    left.irq.length !== right.irq.length ||
    left.irq.some((operation, index) => operation !== right.irq[index]) ||
    left.saved.length !== right.saved.length
  ) {
    throw new Error("Stack analysis requires proved interrupt ownership and status balance");
  }
  return {
    irq: left.irq,
    enabled: left.enabled || right.enabled,
    eligible: left.eligible || right.eligible,
    saved: left.saved.map((enabled, index) => enabled || right.saved[index]!),
  };
}

/** Status possibilities form a finite monotone lattice, so CFG loops need no execution bound. */
function sameMasks(left: StackState, right: StackState): boolean {
  return (
    left.enabled === right.enabled &&
    left.eligible === right.eligible &&
    left.saved.every((value, i) => value === right.saved[i])
  );
}

/** Match selected helper demands without repeatedly scanning all operations. */
function sourceKey(operation: {
  readonly sourceId: string;
  readonly start: number;
  readonly end: number;
}): string {
  return JSON.stringify([operation.sourceId, operation.start, operation.end]);
}

/**
 * Measure qualified NMOS IRQ overlap, rather than adding independent maxima.
 * Calls reuse summaries keyed by active installations and the incoming I-bit possibility.
 * No machine state, storage request, instruction or runtime dispatcher is introduced.
 */
export function simultaneousIRQStackPeak(
  program: WholeProgram,
  helpers: readonly HelperCallDemand[],
  startupBytes: number,
  instructionSites: StorageBinder["instructionSites"],
): SimultaneousStackPeak {
  const functions = new Map(
    program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn]),
  );
  const installations = new Map<string, InterruptRoute[]>();
  for (const route of program.interruptRoutes ?? []) {
    // A conditional handler argument may lower to two arms of the same
    // source installation. Ownership agrees by source site, not object identity.
    const site = sourceKey(route.installation.span);
    const selected = installations.get(site) ?? [];
    selected.push(route);
    installations.set(site, selected);
  }
  const helpersByOwner = new Map<string, Map<string, HelperCallDemand[]>>();
  for (const helper of helpers) {
    const owner = bindingIdentityKey(helper.caller);
    const bySource = helpersByOwner.get(owner) ?? new Map<string, HelperCallDemand[]>();
    const key = helper.source === undefined ? "" : sourceKey(helper.source);
    bySource.set(key, [...(bySource.get(key) ?? []), helper]);
    helpersByOwner.set(owner, bySource);
  }
  const memo = new Map<string, StackSummary>();
  const active = new Set<string>();

  /** Follow chained predecessors sequentially: a tail jump does not stack another IRQ frame. */
  function interruptPeak(state: StackState): { bytes: number; route: readonly string[] } {
    let peak: SimultaneousStackPeak = { program: 0, system: 0, route: [] };
    for (let index = state.irq.length - 1; index >= 0; index -= 1) {
      const selected = installations.get(state.irq[index]!) ?? [];
      let chains = false;
      for (const route of selected) {
        const body = summarize(route.handler, {
          irq: state.irq,
          enabled: false,
          eligible: false,
          saved: [],
        });
        // Both qualified firmware tails execute instructions before unwinding the
        // IRQ frame. A final CLI therefore permits unbounded re-entry even when
        // its first eligible boundary is in that tail rather than the source body.
        if (body.exit?.enabled === true) {
          return { bytes: Infinity, route: [`interrupt:${route.variant.id}`, ...body.peak.route] };
        }
        peak = deeper(peak, {
          program: 0,
          system: route.variant.handlerEntryStackBytes + body.peak.program + body.peak.system,
          route: [`interrupt:${route.variant.id}`, ...body.peak.route],
        });
        chains ||= body.exit !== null && route.variant.terminal === "jump-saved-vector";
      }
      if (!chains) break;
    }
    return { bytes: peak.system, route: peak.route };
  }

  /** A body summary is independent of the caller's live PHP bytes and JSR return address. */
  function summarize(id: BindingId, input: StackState): StackSummary {
    const key = bindingIdentityKey(id);
    const context = JSON.stringify([key, input.irq, input.enabled, input.eligible]);
    const known = memo.get(context);
    if (known !== undefined) return known;
    if (active.has(context)) {
      // Ordinary recursion is rejected earlier. Re-entering here means an IRQ
      // body enabled its still-active source, for which no finite bound exists.
      return { peak: { program: Infinity, system: 0, route: [key] }, exit: null };
    }
    const fn = functions.get(key);
    if (fn === undefined) throw new Error("Stack call target is absent from the closed program");
    active.add(context);
    const result = analyze(key, fn.entry, fn.blocks, input);
    active.delete(context);
    memo.set(context, result);
    return result;
  }

  /** Walk the existing CFG, replaying only stack, mask and vector-ownership effects. */
  function analyze(
    owner: string,
    entry: string,
    blocks: readonly SemanticBlock[],
    input: StackState,
  ): StackSummary {
    const byId = new Map(blocks.map((block) => [block.id, block]));
    const entries = new Map([[entry, copy(input)]]);
    const pending = [entry];
    const helperSources = helpersByOwner.get(owner);
    let peak: SimultaneousStackPeak = { program: 0, system: 0, route: [owner] };
    let returned: StackState | null = null;
    /** Retain one feasible simultaneous peak and the route which explains its bytes. */
    const observe = (state: StackState, extra = 0, suffix: readonly string[] = []): void => {
      const interrupt = state.eligible ? interruptPeak(state) : { bytes: 0, route: [] };
      peak = deeper(peak, {
        program: state.saved.length + extra,
        system: interrupt.bytes,
        route: [owner, ...suffix, ...interrupt.route],
      });
    };
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const block = byId.get(pending[cursor]!)!;
      let state = copy(entries.get(block.id)!);
      let returns = true;
      observe(state);
      for (const operation of block.operations) {
        for (const helper of [
          ...(helperSources?.get(sourceKey(operation.span)) ?? []),
          ...(helperSources?.get("") ?? []),
        ]) {
          observe({ ...state, eligible: state.enabled }, helper.stackBytes, [
            `helper:${helper.id}`,
          ]);
        }
        if (operation.kind === "cpu-control") {
          // NMOS samples the old I bit for CLI, SEI and PLP. For PHP/NOP the
          // architectural state is unchanged, so the same rule covers each opcode.
          state.eligible = state.enabled;
          if (operation.control === "asm_php") state.saved.push(state.enabled);
          else if (operation.control === "asm_plp") state.enabled = state.saved.pop()!;
          else if (operation.control === "asm_sei") state.enabled = false;
          else if (operation.control === "asm_cli") state.enabled = true;
        } else if (operation.kind === "platform") {
          const site = sourceKey(operation.span);
          const installs = installations.has(site);
          const restores = operation.capability === "c64.system.restoreIRQ";
          if (installs || restores) {
            // PHP/PHA precede SEI in the existing vector update. The previous
            // handler can therefore overlap those two saves; the new handler
            // becomes eligible only after both saves have been pulled.
            observe({ ...state, eligible: state.enabled }, 2, ["interrupt-vector-update"]);
            if (installs) state.irq.push(site);
            else state.irq.pop();
            // The final PLP restores the caller's I bit. That instruction still
            // samples the masked state established inside the vector update.
            state.eligible = false;
          } else if (instructionSites === undefined || instructionSites.has(operation)) {
            state.eligible = state.enabled;
          }
        } else if (operation.kind === "call" || operation.kind === "indirect-call") {
          const targets =
            operation.kind === "call"
              ? [operation.callee]
              : (program.indirectTargets?.get(operation) ?? []);
          let exit: StackState | null = null;
          for (const target of targets) {
            const body = summarize(target, {
              irq: state.irq,
              enabled: state.enabled,
              eligible: state.enabled,
              saved: [],
            });
            peak = deeper(peak, {
              program: state.saved.length + 2 + body.peak.program,
              system: body.peak.system,
              route: [owner, ...body.peak.route],
            });
            if (body.exit !== null) exit = exit === null ? body.exit : merge(exit, body.exit);
          }
          if (exit === null) {
            returns = false;
            break;
          }
          // RTS has pulled its two-byte return before its IRQ boundary. A callee
          // ending in CLI cannot count that return address as live at this point.
          state = {
            irq: [...exit.irq],
            enabled: exit.enabled,
            eligible: exit.enabled,
            saved: state.saved,
          };
        } else if (instructionSites === undefined || instructionSites.has(operation)) {
          state.eligible = state.enabled;
        }
        observe(state);
      }
      if (!returns) continue;
      const terminal = block.terminator;
      if (
        terminal.kind !== "return" ||
        instructionSites === undefined ||
        instructionSites.has(terminal)
      ) {
        // A branch/jump, or emitted return-value setup, consumes the delay.
        // A bare RTS does not: its post-pull boundary belongs to the caller.
        state.eligible = state.enabled;
        observe(state);
      }
      if (terminal.kind === "return") {
        returned = returned === null ? state : merge(returned, state);
      }
      const successors =
        terminal.kind === "jump"
          ? [terminal.target]
          : terminal.kind === "branch"
            ? [terminal.whenTrue, terminal.whenFalse]
            : [];
      for (const successor of successors) {
        const previous = entries.get(successor);
        const next = previous === undefined ? copy(state) : merge(previous, state);
        if (previous === undefined || !sameMasks(previous, next)) {
          entries.set(successor, next);
          pending.push(successor);
        }
      }
    }
    return { peak, exit: returned };
  }

  let peak: SimultaneousStackPeak = { program: startupBytes, system: 0, route: ["startup"] };
  let state: StackState = { irq: [], enabled: true, eligible: true, saved: [] };
  const globals = new Map(
    program.semantic.globals.map((global) => [bindingIdentityKey(global.id), global]),
  );
  let reachesMain = true;
  for (const id of program.semantic.initializerOrder) {
    const key = bindingIdentityKey(id);
    const global = globals.get(key);
    if (global === undefined || global.entry === null) continue;
    const inline = global.runtimeInitialBytes !== null;
    const inlineIRQ = inline && state.enabled ? interruptPeak(state) : { bytes: 0, route: [] };
    const body = inline
      ? {
          peak: {
            program: 0,
            system: inlineIRQ.bytes,
            route: [key, ...inlineIRQ.route],
          },
          exit: { ...state, eligible: state.enabled },
        }
      : analyze(key, global.entry, global.blocks, { ...state, eligible: state.enabled });
    peak = deeper(peak, {
      ...body.peak,
      program: body.peak.program + (inline ? 0 : 2),
      route: [
        "startup",
        `${inline ? "inline-initializer" : "initializer"}:${key}`,
        ...body.peak.route.slice(1),
      ],
    });
    if (body.exit === null) {
      reachesMain = false;
      break;
    }
    state = { ...body.exit, eligible: body.exit.enabled };
  }
  if (reachesMain) peak = deeper(peak, summarize(program.semantic.main, state).peak);
  for (const root of program.roots) {
    if (root.kind === "callable") {
      peak = deeper(
        peak,
        summarize(root.function, { irq: [], enabled: true, eligible: true, saved: [] }).peak,
      );
    }
  }
  return peak;
}
