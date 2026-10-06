import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SemanticBlock, SemanticOperation, ValueId } from "../semantic/operations.js";
import type { InterruptRoute, WholeProgram } from "../semantic/whole-program.js";
import type {
  HelperCallDemand,
  IrqOverlapFacts,
  StorageBinder,
  StorageRequest,
} from "./storage-types.js";

/** The two simultaneously live portions of one winning stack route. */
export interface SimultaneousStackPeak {
  /** Mainline or initializer bytes retained at the interruption point. */
  readonly program: number;
  /** Handler entry, body and helper bytes above those program bytes. */
  readonly system: number;
  /** Source and selected-entry identities explaining this one feasible peak. */
  readonly route: readonly string[];
  /** Conflicts accumulated across every reachable IRQ path, not only the peak. */
  readonly irqOverlap?: IrqOverlapFacts;
}

/** Compile-time state only; source ownership and status-depth checks already prove balance. */
interface StackState {
  /** Selected handler/entry sets, oldest first; repeated installations retain separate slots. */
  irq: string[];
  /** Exact saved-link requests parallel to installed IRQ entries. */
  links: string[];
  /** Suspended handler roots plus the currently running root, oldest first. */
  activeRoots: string[];
  /** IRQ vector depth on entry to the currently running handler root. */
  rootBase: number;
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

/** Only literal scalar facts proved from one call's staged arguments. */
type ScalarFact = bigint | boolean;

/** Resolve a small, side-effect-free value expression without guessing runtime state. */
function scalarFact(
  value: ValueId,
  definitions: ReadonlyMap<ValueId, SemanticOperation>,
  parameters: ReadonlyMap<string, ScalarFact>,
  written: ReadonlySet<string>,
  active = new Set<ValueId>(),
): ScalarFact | undefined {
  if (active.has(value)) return undefined;
  active.add(value);
  const operation = definitions.get(value);
  let result: ScalarFact | undefined;
  if (operation?.kind === "constant") result = operation.value;
  else if (operation?.kind === "load" && operation.place.path.length === 0) {
    const key = bindingIdentityKey(operation.place.root);
    if (!written.has(key)) result = parameters.get(key);
  } else if (operation?.kind === "convert" && operation.conversion === "identity") {
    result = scalarFact(operation.operand, definitions, parameters, written, active);
  } else if (operation?.kind === "binary") {
    const left = scalarFact(operation.left, definitions, parameters, written, active);
    const right = scalarFact(operation.right, definitions, parameters, written, active);
    if (left !== undefined && right !== undefined) {
      if (operation.operator === "==") result = left === right;
      else if (operation.operator === "!=") result = left !== right;
    }
  }
  active.delete(value);
  return result;
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
  return {
    ...state,
    irq: [...state.irq],
    links: [...state.links],
    activeRoots: [...state.activeRoots],
    saved: [...state.saved],
  };
}

/** Merge only flag possibilities; ownership identities and save depths must already agree. */
function merge(
  left: StackState,
  right: StackState,
  combineInstallations: (left: string, right: string) => string,
): StackState {
  if (
    left.irq.length !== right.irq.length ||
    left.links.length !== right.links.length ||
    left.links.some((link, index) => link !== right.links[index]) ||
    left.activeRoots.length !== right.activeRoots.length ||
    left.activeRoots.some((root, index) => root !== right.activeRoots[index]) ||
    left.rootBase !== right.rootBase ||
    left.saved.length !== right.saved.length
  ) {
    throw new Error("Stack analysis requires proved interrupt ownership and status balance");
  }
  return {
    irq: left.irq.map((token, index) => combineInstallations(token, right.irq[index]!)),
    links: left.links,
    activeRoots: left.activeRoots,
    rootBase: left.rootBase,
    enabled: left.enabled || right.enabled,
    eligible: left.eligible || right.eligible,
    saved: left.saved.map((enabled, index) => enabled || right.saved[index]!),
  };
}

/** Status possibilities form a finite monotone lattice, so CFG loops need no execution bound. */
function sameMasks(left: StackState, right: StackState): boolean {
  return (
    left.irq.every((token, index) => token === right.irq[index]) &&
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
  requests: readonly StorageRequest[] = [],
): SimultaneousStackPeak {
  const functions = new Map(
    program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn]),
  );
  const routesBySite = new Map<string, InterruptRoute[]>();
  for (const route of program.interruptRoutes ?? []) {
    // NMI arrivals are externally unbounded and belong to a separate per-entry
    // proof. They must not become entries in this finite IRQ ownership stack.
    if (route.sink.domain !== "irq") continue;
    // A conditional handler argument may lower to two arms of the same
    // source installation. Ownership agrees by source site, not object identity.
    const site = sourceKey(route.installation.span);
    const selected = routesBySite.get(site) ?? [];
    selected.push(route);
    routesBySite.set(site, selected);
  }
  const installationTokens = new Map<string, string>();
  const installations = new Map<string, readonly InterruptRoute[]>();
  for (const [site, routes] of routesBySite) {
    const choices = new Map(
      routes.map((route) => [
        JSON.stringify([bindingIdentityKey(route.handler), route.variant.id]),
        route,
      ]),
    );
    const keys = [...choices.keys()].sort();
    const token = JSON.stringify(keys);
    // Source ownership and link storage were already proved upstream. Stack demand
    // depends on the selected handlers and entry contracts, not the spelling of the
    // install site. Equivalent branches therefore share summaries without collapsing
    // distinct handlers, entry variants, stack order or repeated live installations.
    installationTokens.set(site, token);
    if (!installations.has(token)) {
      installations.set(
        token,
        keys.map((key) => choices.get(key)!),
      );
    }
  }
  /** Union the finite handler choices at an equal-ownership control-flow join. */
  const combineInstallations = (left: string, right: string): string => {
    if (left === right) return left;
    const choices = new Map(
      [...(installations.get(left) ?? []), ...(installations.get(right) ?? [])].map((route) => [
        JSON.stringify([bindingIdentityKey(route.handler), route.variant.id]),
        route,
      ]),
    );
    const keys = [...choices.keys()].sort();
    const token = JSON.stringify(keys);
    if (!installations.has(token))
      installations.set(
        token,
        keys.map((key) => choices.get(key)!),
      );
    return token;
  };
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
  const knownLinks = new Set(
    requests.filter((request) => request.id.startsWith("interrupt-link:irq:")).map(({ id }) => id),
  );
  const rootPairs = new Map<string, readonly [string, string]>();
  const linkPairs = new Map<string, readonly [string, string]>();
  const linkRootPairs = new Map<string, readonly [string, string]>();

  /** Keep one deterministic pair regardless of route discovery order. */
  const pair = (
    pairs: Map<string, readonly [string, string]>,
    left: string,
    right: string,
    ordered = false,
  ): void => {
    if (left === right) return;
    const values: readonly [string, string] =
      ordered || Buffer.compare(Buffer.from(left), Buffer.from(right)) <= 0
        ? [left, right]
        : [right, left];
    pairs.set(JSON.stringify(values), values);
  };

  /** Record conflicts from every visited state, including non-peak paths. */
  const recordOverlap = (state: StackState): void => {
    for (let index = 0; index < state.activeRoots.length; index += 1) {
      for (const other of state.activeRoots.slice(index + 1)) {
        pair(rootPairs, state.activeRoots[index]!, other);
      }
    }
    const liveLinks = state.links.filter((id) => knownLinks.has(id));
    for (let index = 0; index < liveLinks.length; index += 1) {
      const link = liveLinks[index]!;
      for (const other of liveLinks.slice(index + 1)) pair(linkPairs, link, other);
      for (const root of state.activeRoots) pair(linkRootPairs, link, root, true);
    }
  };

  /** Follow chained predecessors sequentially: a tail jump does not stack another IRQ frame. */
  function interruptPeak(state: StackState): { bytes: number; route: readonly string[] } {
    let peak: SimultaneousStackPeak = { program: 0, system: 0, route: [] };
    for (let index = state.irq.length - 1; index >= 0; index -= 1) {
      const selected = installations.get(state.irq[index]!) ?? [];
      let chains = false;
      for (const route of selected) {
        const root = bindingIdentityKey(route.handler);
        if (state.activeRoots.includes(root)) {
          return {
            bytes: Infinity,
            route: [...state.activeRoots, `reentered:${root}`],
          };
        }
        const body = summarize(route.handler, {
          irq: state.irq,
          links: state.links,
          activeRoots: [...state.activeRoots, root],
          rootBase: state.irq.length,
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
  function summarize(
    id: BindingId,
    input: StackState,
    parameters: ReadonlyMap<string, ScalarFact> = new Map(),
  ): StackSummary {
    const key = bindingIdentityKey(id);
    const context = JSON.stringify([
      key,
      input.irq,
      input.links,
      input.activeRoots,
      input.rootBase,
      input.enabled,
      input.eligible,
      [...parameters]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => [name, typeof value === "bigint" ? `i:${value}` : `b:${value}`]),
    ]);
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
    const result = analyze(key, fn.entry, fn.blocks, input, parameters);
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
    parameters: ReadonlyMap<string, ScalarFact> = new Map(),
  ): StackSummary {
    const byId = new Map(blocks.map((block) => [block.id, block]));
    const definitions = new Map<ValueId, SemanticOperation>();
    const written = new Set<string>();
    for (const block of blocks) {
      for (const operation of block.operations) {
        if ("result" in operation && operation.result !== null)
          definitions.set(operation.result, operation);
        if (operation.kind === "store") written.add(bindingIdentityKey(operation.place.root));
      }
    }
    const entries = new Map([[entry, copy(input)]]);
    const pending = [entry];
    const helperSources = helpersByOwner.get(owner);
    let peak: SimultaneousStackPeak = { program: 0, system: 0, route: [owner] };
    let returned: StackState | null = null;
    /** Retain one feasible simultaneous peak and the route which explains its bytes. */
    const observe = (state: StackState, extra = 0, suffix: readonly string[] = []): void => {
      recordOverlap(state);
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
          const installation = installationTokens.get(site);
          const restores = operation.capability === "c64.system.restoreIRQ";
          if (installation !== undefined || restores) {
            // PHP/PHA precede SEI in the existing vector update. The previous
            // handler can therefore overlap those two saves; the new handler
            // becomes eligible only after both saves have been pulled.
            observe({ ...state, eligible: state.enabled }, 2, ["interrupt-vector-update"]);
            if (installation !== undefined) {
              const root = state.activeRoots.at(-1);
              const depth =
                root === undefined ? state.irq.length : state.irq.length - state.rootBase;
              state.links.push(
                root === undefined
                  ? `interrupt-link:irq:${depth}`
                  : `interrupt-link:irq:${root}:${depth}`,
              );
              state.irq.push(installation);
            } else {
              state.irq.pop();
              state.links.pop();
            }
            // The final PLP restores the caller's I bit. That instruction still
            // samples the masked state established inside the vector update.
            state.eligible = false;
          } else if (
            operation.capability === "c64.system.setNMI" ||
            operation.capability === "c64.system.restoreNMI"
          ) {
            // The NMI transaction preserves A/P without changing IRQ ownership.
            // Those two temporary saves can overlap an eligible generated IRQ.
            observe({ ...state, eligible: state.enabled }, 2, ["nmi-vector-update"]);
            state.eligible = state.enabled;
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
            const callee = functions.get(bindingIdentityKey(target));
            const argumentsByParameter = new Map<string, ScalarFact>();
            for (const [index, parameter] of (callee?.parameters ?? []).entries()) {
              const argument = operation.arguments[index];
              if (argument === undefined) continue;
              const fact = scalarFact(argument, definitions, parameters, written);
              if (fact !== undefined)
                argumentsByParameter.set(bindingIdentityKey(parameter.id), fact);
            }
            const body = summarize(
              target,
              {
                irq: state.irq,
                links: state.links,
                activeRoots: state.activeRoots,
                rootBase: state.rootBase,
                enabled: state.enabled,
                eligible: state.enabled,
                saved: [],
              },
              argumentsByParameter,
            );
            peak = deeper(peak, {
              program: state.saved.length + 2 + body.peak.program,
              system: body.peak.system,
              route: [owner, ...body.peak.route],
            });
            if (body.exit !== null)
              exit = exit === null ? body.exit : merge(exit, body.exit, combineInstallations);
          }
          if (exit === null) {
            returns = false;
            break;
          }
          // RTS has pulled its two-byte return before its IRQ boundary. A callee
          // ending in CLI cannot count that return address as live at this point.
          state = {
            irq: [...exit.irq],
            links: [...exit.links],
            activeRoots: state.activeRoots,
            rootBase: state.rootBase,
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
        returned = returned === null ? state : merge(returned, state, combineInstallations);
      }
      const condition =
        terminal.kind === "branch"
          ? scalarFact(terminal.condition, definitions, parameters, written)
          : undefined;
      const successors =
        terminal.kind === "jump"
          ? [terminal.target]
          : terminal.kind === "branch"
            ? condition === true
              ? [terminal.whenTrue]
              : condition === false
                ? [terminal.whenFalse]
                : [terminal.whenTrue, terminal.whenFalse]
            : [];
      for (const successor of successors) {
        const previous = entries.get(successor);
        const next =
          previous === undefined ? copy(state) : merge(previous, state, combineInstallations);
        if (previous === undefined || !sameMasks(previous, next)) {
          entries.set(successor, next);
          pending.push(successor);
        }
      }
    }
    return { peak, exit: returned };
  }

  let peak: SimultaneousStackPeak = { program: startupBytes, system: 0, route: ["startup"] };
  let state: StackState = {
    irq: [],
    links: [],
    activeRoots: [],
    rootBase: 0,
    enabled: true,
    eligible: true,
    saved: [],
  };
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
        summarize(root.function, {
          irq: [],
          links: [],
          activeRoots: [],
          rootBase: 0,
          enabled: true,
          eligible: true,
          saved: [],
        }).peak,
      );
    }
  }
  const canonical = (pairs: ReadonlyMap<string, readonly [string, string]>) =>
    Object.freeze(
      [...pairs.values()].sort((left, right) =>
        Buffer.compare(Buffer.from(JSON.stringify(left)), Buffer.from(JSON.stringify(right))),
      ),
    );
  return (program.interruptRoutes?.length ?? 0) === 0
    ? peak
    : Object.freeze({
        ...peak,
        irqOverlap: Object.freeze({
          rootPairs: canonical(rootPairs),
          linkPairs: canonical(linkPairs),
          linkRootPairs: canonical(linkRootPairs),
        }),
      });
}
