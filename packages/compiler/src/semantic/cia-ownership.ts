import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { IndirectTargetSets } from "./function-targets.js";
import {
  INITIAL_CIA_STATE,
  handlerCiaMutation,
  isFinalCiaRelease,
  joinCiaState,
  literalValues,
  mutateCiaState,
  rawCia1Effect,
  restoreCiaState,
  sameCiaState,
  typedMutation,
  type CiaMutation,
  type CiaState,
} from "./cia-ownership-facts.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  SemanticOperation,
  SemanticProgram,
} from "./operations.js";
import type { InterruptRoute } from "./whole-program.js";
import { reachableBlocks } from "./value-lifetimes.js";

/** One call analysis result, including the caller history the body never reached. */
interface CiaCallResult {
  /** Returning ownership facts; null denotes a path that cannot return. */
  readonly state: CiaState | null;
  /** Older mutation frames that were neither read, changed nor removed by the call. */
  readonly untouchedPrefix: number;
  /** Entry mutation suffix that must agree before this proof can be reused. */
  readonly entryMutations: readonly CiaMutation[];
}

/** Preserve one source-linked ownership error without claiming a hardware reset. */
function invalid(operation: string, detail: string, span: SourceSpan): ProjectDiagnostic {
  return projectDiagnostic(
    "E10278",
    `Interrupt ownership for sink 'c64.system.setIRQ' is invalid at '${operation}' — ${detail}`,
    span,
  );
}

/**
 * Check CIA1 ownership without a runtime shadow. The optional output collection
 * is replaced with only source restores proved to require the same final stock handback
 * at every call site; unsafe diagnostics prevent consuming any lowering facts.
 */
export function checkCiaOwnership(
  program: SemanticProgram,
  reachable: ReadonlySet<string>,
  indirectTargets: IndirectTargetSets,
  routes: readonly InterruptRoute[],
  stockHandbacks: Set<SemanticOperation> = new Set(),
): readonly ProjectDiagnostic[] {
  stockHandbacks.clear();
  const restoreKinds = new Map<SemanticOperation, boolean>();
  const vectorBytes = new Set(
    routes
      .filter(({ sink }) => sink.domain === "irq")
      .flatMap(({ sink }) => [sink.vector, (sink.vector + 1) & 0xffff]),
  );
  const functions = new Map(
    program.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const globals = new Map(
    program.globals.map((item) => [bindingIdentityKey(item.id), item] as const),
  );
  const handlers = new Map<SemanticOperation, readonly SemanticFunction[]>();
  for (const route of routes) {
    const handler = functions.get(bindingIdentityKey(route.handler));
    if (handler !== undefined) {
      handlers.set(route.installation, [...(handlers.get(route.installation) ?? []), handler]);
    }
  }

  /** Include helper calls and temporary successor handlers in each handler's possible writes. */
  const mayMutate = new Set<string>();
  const mayMutateRaw = new Set<string>();
  const mayReplaceVector = new Set<string>();
  const mayInvalidateMask = new Set<string>();
  /** Calls that may allow another IRQ entry, including through helpers or successors. */
  const mayUnmaskIrq = new Set<string>();
  /** A restore can expose older owner mutations while validating a handler entry. */
  const mayRestoreIrq = new Set<string>();
  const mayEnable = new Map<string, number>();
  const edges = new Map<string, Set<string>>();
  for (const fn of program.functions) {
    const key = bindingIdentityKey(fn.id);
    if (!reachable.has(key)) continue;
    const values = literalValues(fn.blocks);
    const callees = new Set<string>();
    for (const block of reachableBlocks(fn.entry, fn.blocks)) {
      for (const operation of block.operations) {
        if (operation.kind === "platform") {
          if (typedMutation(operation.capability)) mayMutate.add(key);
          if (operation.capability === "c64.system.restoreIRQ") mayRestoreIrq.add(key);
          if (operation.capability === "c64.cia1.enableInterruptSources") {
            const argument = operation.arguments[0];
            const exact = argument === undefined ? undefined : values.get(argument);
            mayEnable.set(key, (mayEnable.get(key) ?? 0) | Number((exact ?? 0x03n) & 0x03n));
          }
          for (const handler of handlers.get(operation) ?? []) {
            callees.add(bindingIdentityKey(handler.id));
          }
        } else if (operation.kind === "cpu-control") {
          if (operation.control === "asm_cli" || operation.control === "asm_plp") {
            mayUnmaskIrq.add(key);
          }
        } else if (operation.kind === "memory-write") {
          const raw = rawCia1Effect(operation, values, vectorBytes);
          if (raw.dirty) {
            mayMutate.add(key);
            mayMutateRaw.add(key);
          }
          if (raw.icr) mayInvalidateMask.add(key);
          if (raw.vector) mayReplaceVector.add(key);
        } else if (operation.kind === "call" || operation.kind === "indirect-call") {
          const targets =
            operation.kind === "call" ? [operation.callee] : (indirectTargets.get(operation) ?? []);
          for (const target of targets) callees.add(bindingIdentityKey(target));
        }
      }
    }
    edges.set(key, callees);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [caller, callees] of edges) {
      for (const callee of callees) {
        if (!mayMutate.has(caller) && mayMutate.has(callee)) {
          mayMutate.add(caller);
          changed = true;
        }
        if (!mayInvalidateMask.has(caller) && mayInvalidateMask.has(callee)) {
          mayInvalidateMask.add(caller);
          changed = true;
        }
        for (const effects of [mayMutateRaw, mayReplaceVector, mayUnmaskIrq, mayRestoreIrq]) {
          if (!effects.has(caller) && effects.has(callee)) {
            effects.add(caller);
            changed = true;
          }
        }
        const enabled = (mayEnable.get(caller) ?? 0) | (mayEnable.get(callee) ?? 0);
        if (enabled !== (mayEnable.get(caller) ?? 0)) {
          mayEnable.set(caller, enabled);
          changed = true;
        }
      }
    }
  }

  // The preceding whole-program proof closes all helper and handler targets.
  // An absent handler inventory is not proof that its older owners are unused.
  const handlerMayRestoreIrq = routes.some(({ handler, sink }) => {
    const key = bindingIdentityKey(handler);
    return sink.domain === "irq" && (!edges.has(key) || mayRestoreIrq.has(key));
  });

  const diagnostics: ProjectDiagnostic[] = [];
  const visited = new Set<string>();
  const active = new Set<string>();
  const successful = new Map<string, readonly CiaCallResult[]>();
  const handlerEntries = new Map<string, Map<string, CiaState>>();

  /** Include an IRQ's possible CIA writes at every source point where it can run. */
  const interruptEntry = (state: CiaState): CiaState => {
    const keys = state.irqMayRun ? (state.handlerKeys.at(-1) ?? []) : [];
    if (keys.length === 0) return state;
    const unknown = keys.some((key) => mayInvalidateMask.has(key));
    const enabled = keys.reduce((bits, key) => bits | (mayEnable.get(key) ?? 0), 0);
    const entry: CiaState = {
      ...state,
      stockPredecessor: state.stockPredecessor && !keys.some((key) => mayReplaceVector.has(key)),
      maskKnown: state.maskKnown && !unknown,
      possibleSources: state.possibleSources | enabled | (unknown ? 0x1f : 0),
    };
    for (const key of keys) {
      const candidates = handlerEntries.get(key) ?? new Map<string, CiaState>();
      candidates.set(JSON.stringify(entry), entry);
      handlerEntries.set(key, candidates);
    }
    return entry;
  };

  /** Analyze one source callable with its caller's current IRQ and CIA facts. */
  const analyze = (
    key: string,
    entry: string,
    blocks: readonly SemanticBlock[],
    source: SourceSpan,
    input: CiaState,
  ): CiaCallResult => {
    if (active.has(key)) {
      // The preceding whole-program check rejects recursion.
      return { state: null, untouchedPrefix: 0, entryMutations: input.mutations };
    }
    visited.add(key);
    // Without a handler-side restore, IRQ validation cannot expose older owners.
    // The touched suffix still includes the current owner; only unused older
    // mutations may differ between shared discoveries. Otherwise retain complete
    // histories because a cached call does not replay handler-entry discovery.
    const exactMutations = handlerMayRestoreIrq && (input.irqMayRun || mayUnmaskIrq.has(key));
    const memoKey = JSON.stringify([
      key,
      input.routes,
      input.handlerKeys,
      input.irqMayRun,
      input.maskKnown,
      input.possibleSources,
      exactMutations ? input.mutations : [],
      input.stockPredecessor,
    ]);
    const cached = successful
      .get(memoKey)
      ?.find(({ untouchedPrefix, entryMutations }) =>
        entryMutations.every(
          (mutation, index) => mutation === input.mutations[untouchedPrefix + index],
        ),
      );
    if (cached !== undefined) {
      return {
        ...cached,
        state:
          cached.state === null
            ? null
            : {
                ...cached.state,
                mutations: [
                  ...input.mutations.slice(0, cached.untouchedPrefix),
                  ...cached.state.mutations.slice(cached.untouchedPrefix),
                ],
              },
      };
    }
    let untouchedPrefix = exactMutations ? 0 : input.mutations.length;
    /** Retain the current owner and any older owner exposed by a pop or callee. */
    const touchOwner = (state: CiaState): void => {
      untouchedPrefix = Math.min(untouchedPrefix, Math.max(0, state.routes.length - 1));
    };
    active.add(key);
    const byId = new Map(blocks.map((block) => [block.id, block] as const));
    const values = literalValues(blocks);
    const atEntry = new Map<string, CiaState>([[entry, input]]);
    const pending = [entry];
    let returned: CiaState | null = null;
    while (pending.length > 0 && diagnostics.length === 0) {
      const block = byId.get(pending.shift()!);
      if (block === undefined) throw new Error("Missing CIA semantic block");
      let state: CiaState | null = atEntry.get(block.id)!;
      for (const operation of block.operations) {
        if (state === null) break;
        touchOwner(state);
        state = interruptEntry(state);
        if (operation.kind === "platform") {
          const name = operation.capability;
          if (name === "c64.system.setIRQ" || name === "c64.system.setIRQExclusive") {
            if (
              name === "c64.system.setIRQ" &&
              state.routes.at(-1) === "exclusive" &&
              state.possibleSources !== 0
            ) {
              diagnostics.push(
                invalid(
                  name,
                  "enabled CIA1 sources cannot enter a chained IRQ route",
                  operation.span,
                ),
              );
              break;
            }
            const exclusive = name === "c64.system.setIRQExclusive";
            const keys = (handlers.get(operation) ?? [])
              .map((fn) => bindingIdentityKey(fn.id))
              .sort();
            state = {
              routes: [...state.routes, exclusive ? "exclusive" : "chained"],
              handlerKeys: [...state.handlerKeys, keys],
              irqMayRun: state.irqMayRun,
              maskKnown: exclusive && state.routes.at(-1) !== "exclusive" ? false : state.maskKnown,
              possibleSources:
                exclusive && state.routes.at(-1) !== "exclusive" ? 0x1f : state.possibleSources,
              mutations: [...state.mutations, handlerCiaMutation(keys, mayMutate, mayMutateRaw)],
              stockPredecessor: state.stockPredecessor,
            };
          } else if (name === "c64.system.restoreIRQ") {
            const final = isFinalCiaRelease(state);
            const restored = restoreCiaState(state);
            if (restored === null) {
              diagnostics.push(
                invalid(
                  name,
                  "CIA1 timer or interrupt-mask state cannot be restored to an inner or nonstock owner, including selected handler writes and known raw mutations",
                  operation.span,
                ),
              );
              break;
            }
            if (restoreKinds.has(operation) && restoreKinds.get(operation) !== final) {
              diagnostics.push(
                invalid(
                  name,
                  "CIA1 release classification differs between call paths",
                  operation.span,
                ),
              );
              break;
            }
            restoreKinds.set(operation, final);
            if (final) stockHandbacks.add(operation);
            state = restored;
          } else if (name.startsWith("c64.cia2.") && !name.includes("readTimer")) {
            diagnostics.push(
              invalid(
                name,
                "CIA2 state or pending sources remain owned by the KERNAL NMI route",
                operation.span,
              ),
            );
            break;
          } else if (name.startsWith("c64.cia1.") && !name.includes("readTimer")) {
            if (state.routes.at(-1) !== "exclusive") {
              diagnostics.push(
                invalid(
                  name,
                  "CIA1 state-changing and consuming operations require an exclusive IRQ route",
                  operation.span,
                ),
              );
              break;
            }
            if (name === "c64.cia1.readAndClearPendingSources") continue;
            const argument = operation.arguments[0];
            const exact = argument === undefined ? undefined : values.get(argument);
            const allowed = name.endsWith("configureTimerA")
              ? 0x19
              : name.endsWith("configureTimerB")
                ? 0x59
                : name.endsWith("enableInterruptSources")
                  ? 0x03
                  : name.endsWith("disableInterruptSources")
                    ? 0x1f
                    : null;
            if (allowed !== null && exact !== undefined && (exact & ~BigInt(allowed)) !== 0n) {
              diagnostics.push(
                invalid(
                  name,
                  `constant flags contain bits outside the owned $${allowed.toString(16).toUpperCase()} set`,
                  operation.span,
                ),
              );
              break;
            }
            if (name.endsWith("enableInterruptSources")) {
              if (!state.maskKnown) {
                diagnostics.push(
                  invalid(
                    name,
                    "CIA1's prior source mask is unreadable; disable all five sources before enabling a timer source",
                    operation.span,
                  ),
                );
                break;
              }
              state = {
                ...mutateCiaState(state, "typed"),
                possibleSources:
                  state.possibleSources | Number(exact === undefined ? 0x03n : exact & 0x03n),
              };
            } else if (name.endsWith("disableInterruptSources")) {
              const clear = exact === undefined ? 0 : Number(exact & 0x1fn);
              state = {
                ...mutateCiaState(state, "typed"),
                maskKnown: state.maskKnown || clear === 0x1f,
                possibleSources: state.possibleSources & ~clear,
              };
            } else {
              state = mutateCiaState(state, "typed");
            }
          }
        } else if (operation.kind === "cpu-control") {
          if (operation.control === "asm_sei") state = { ...state, irqMayRun: false };
          if (operation.control === "asm_cli" || operation.control === "asm_plp") {
            state = { ...state, irqMayRun: true };
          }
        } else if (operation.kind === "memory-write") {
          const raw = rawCia1Effect(operation, values, vectorBytes);
          // Source-known device changes outside an exclusive lease invalidate
          // stock service even before the first installation or between leases.
          if (raw.vector || (raw.dirty && !state.routes.includes("exclusive"))) {
            state = { ...state, stockPredecessor: false };
          }
          if (raw.dirty && state.routes.includes("exclusive")) {
            state = {
              ...mutateCiaState(state, "raw"),
              maskKnown: raw.icr ? false : state.maskKnown,
              possibleSources: raw.icr ? 0x1f : state.possibleSources,
            };
          }
        } else if (operation.kind === "call" || operation.kind === "indirect-call") {
          const targets =
            operation.kind === "call" ? [operation.callee] : (indirectTargets.get(operation) ?? []);
          let result: CiaState | null = null;
          let hasBody = false;
          for (const target of targets) {
            const fn = functions.get(bindingIdentityKey(target));
            if (fn === undefined) continue;
            hasBody = true;
            const callee = analyze(
              bindingIdentityKey(fn.id),
              fn.entry,
              fn.blocks,
              fn.source,
              state,
            );
            untouchedPrefix = Math.min(untouchedPrefix, callee.untouchedPrefix);
            const output = callee.state;
            if (output === null) continue;
            const merged: CiaState | null = result === null ? output : joinCiaState(result, output);
            if (merged === null) {
              diagnostics.push(
                invalid(
                  "indirect call",
                  "IRQ route ownership differs between possible call targets",
                  operation.span,
                ),
              );
              break;
            }
            result = merged;
          }
          if (diagnostics.length > 0) break;
          if (result !== null) state = result;
          else if (hasBody) state = null;
        }
      }
      if (diagnostics.length > 0 || state === null) continue;
      touchOwner(state);
      state = interruptEntry(state);
      const terminal = block.terminator;
      if (terminal.kind === "return") {
        const merged: CiaState | null = returned === null ? state : joinCiaState(returned, state);
        if (merged === null)
          diagnostics.push(
            invalid(
              "function return",
              "IRQ route ownership differs between returning paths",
              source,
            ),
          );
        else returned = merged;
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
        const merged = previous === undefined ? state : joinCiaState(previous, state);
        if (merged === null) {
          diagnostics.push(
            invalid("control-flow join", "IRQ route ownership differs between paths", source),
          );
          break;
        }
        if (previous === undefined || !sameCiaState(previous, merged)) {
          atEntry.set(successor, merged);
          pending.push(successor);
        }
      }
    }
    active.delete(key);
    const result: CiaCallResult = {
      state: returned,
      untouchedPrefix,
      entryMutations: input.mutations.slice(untouchedPrefix),
    };
    if (diagnostics.length === 0) {
      successful.set(memoKey, [...(successful.get(memoKey) ?? []), result]);
    }
    return result;
  };

  let state: CiaState | null = INITIAL_CIA_STATE;
  for (const id of program.initializerOrder) {
    const global: SemanticGlobal | undefined = globals.get(bindingIdentityKey(id));
    if (global?.entry === null || global === undefined || state === null) continue;
    state = analyze(
      bindingIdentityKey(global.id),
      global.entry,
      global.blocks,
      global.source,
      state,
    ).state;
  }
  const main = functions.get(bindingIdentityKey(program.main));
  if (main === undefined) throw new Error("Selected main function is missing");
  if (state !== null && diagnostics.length === 0) {
    state = analyze(bindingIdentityKey(main.id), main.entry, main.blocks, main.source, state).state;
    if (state?.mutations.some((mutation) => mutation !== "clean") && diagnostics.length === 0) {
      diagnostics.push(
        invalid(
          "program return",
          "CIA1 timer or interrupt-mask state may remain changed on return to BASIC",
          main.source,
        ),
      );
    }
  }
  // A handler may install a temporary successor. Visit newly discovered IRQ
  // entries until none remain, regardless of source declaration order.
  const checkedEntries = new Set<string>();
  const checkDiscoveredHandlers = (): void => {
    let newEntry = true;
    while (newEntry && diagnostics.length === 0) {
      newEntry = false;
      for (const route of routes) {
        const key = bindingIdentityKey(route.handler);
        const handler = functions.get(key);
        if (handler === undefined) continue;
        for (const entry of handlerEntries.get(key)?.values() ?? []) {
          const entryKey = JSON.stringify([key, entry]);
          if (checkedEntries.has(entryKey)) continue;
          checkedEntries.add(entryKey);
          newEntry = true;
          analyze(key, handler.entry, handler.blocks, handler.source, {
            ...entry,
            irqMayRun: false,
          });
          if (diagnostics.length > 0) break;
        }
        if (diagnostics.length > 0) break;
      }
    }
  };
  checkDiscoveredHandlers();
  for (const route of routes) {
    if (diagnostics.length > 0) break;
    const key = bindingIdentityKey(route.handler);
    if (handlerEntries.has(key)) continue;
    const handler = functions.get(key);
    if (handler === undefined) continue;
    const fallback: CiaState = {
      ...INITIAL_CIA_STATE,
      routes: [route.sink.capability === "c64.system.setIRQExclusive" ? "exclusive" : "chained"],
      handlerKeys: [[key]],
      mutations: [handlerCiaMutation([key], mayMutate, mayMutateRaw)],
      irqMayRun: false,
    };
    analyze(key, handler.entry, handler.blocks, handler.source, fallback);
  }
  checkDiscoveredHandlers();
  for (const fn of program.functions) {
    const key = bindingIdentityKey(fn.id);
    if (diagnostics.length > 0) break;
    if (reachable.has(key) && !visited.has(key) && fn.entryKind !== "interrupt") {
      analyze(key, fn.entry, fn.blocks, fn.source, INITIAL_CIA_STATE);
    }
  }
  return Object.freeze(diagnostics);
}
