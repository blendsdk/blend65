import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { IndirectTargetSets } from "./function-targets.js";
import {
  INITIAL_CIA_STATE,
  joinCiaState,
  literalValues,
  rawCia1Effect,
  sameCiaState,
  typedMutation,
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

/** Preserve one source-linked ownership error without claiming a hardware reset. */
function invalid(operation: string, detail: string, span: SourceSpan): ProjectDiagnostic {
  return projectDiagnostic(
    "E10278",
    `Interrupt ownership for sink 'c64.system.setIRQ' is invalid at '${operation}' — ${detail}`,
    span,
  );
}

/** Check CIA1 timer/mask/source ownership without introducing a runtime mask shadow. */
export function checkCiaOwnership(
  program: SemanticProgram,
  reachable: ReadonlySet<string>,
  indirectTargets: IndirectTargetSets,
  routes: readonly InterruptRoute[],
): readonly ProjectDiagnostic[] {
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
  const mayInvalidateMask = new Set<string>();
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
          if (operation.capability === "c64.cia1.enableInterruptSources") {
            const argument = operation.arguments[0];
            const exact = argument === undefined ? undefined : values.get(argument);
            mayEnable.set(key, (mayEnable.get(key) ?? 0) | Number((exact ?? 0x03n) & 0x03n));
          }
          for (const handler of handlers.get(operation) ?? []) {
            callees.add(bindingIdentityKey(handler.id));
          }
        } else if (operation.kind === "memory-write") {
          const raw = rawCia1Effect(operation, values);
          if (raw.dirty) mayMutate.add(key);
          if (raw.icr) mayInvalidateMask.add(key);
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
        const enabled = (mayEnable.get(caller) ?? 0) | (mayEnable.get(callee) ?? 0);
        if (enabled !== (mayEnable.get(caller) ?? 0)) {
          mayEnable.set(caller, enabled);
          changed = true;
        }
      }
    }
  }

  const diagnostics: ProjectDiagnostic[] = [];
  const visited = new Set<string>();
  const active = new Set<string>();
  const successful = new Map<string, CiaState | null>();
  const handlerEntries = new Map<string, Map<string, CiaState>>();

  /** Include an IRQ's possible CIA writes at every source point where it can run. */
  const interruptEntry = (state: CiaState): CiaState => {
    const keys = state.irqMayRun ? (state.handlerKeys.at(-1) ?? []) : [];
    if (keys.length === 0) return state;
    const unknown = keys.some((key) => mayInvalidateMask.has(key));
    const enabled = keys.reduce((bits, key) => bits | (mayEnable.get(key) ?? 0), 0);
    const entry: CiaState = {
      ...state,
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
  ): CiaState | null => {
    if (active.has(key)) return null; // The preceding whole-program check rejects recursion.
    visited.add(key);
    // A helper's result depends only on its entry facts. Shared acyclic helper
    // diamonds otherwise cause the same body to be checked once per call path.
    const memoKey = JSON.stringify([
      key,
      input.routes,
      input.handlerKeys,
      input.irqMayRun,
      input.maskKnown,
      input.possibleSources,
      input.dirty,
    ]);
    if (successful.has(memoKey)) return successful.get(memoKey) ?? null;
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
            state = {
              routes: [...state.routes, exclusive ? "exclusive" : "chained"],
              handlerKeys: [
                ...state.handlerKeys,
                (handlers.get(operation) ?? []).map((fn) => bindingIdentityKey(fn.id)).sort(),
              ],
              irqMayRun: state.irqMayRun,
              maskKnown: exclusive && state.routes.at(-1) !== "exclusive" ? false : state.maskKnown,
              possibleSources:
                exclusive && state.routes.at(-1) !== "exclusive" ? 0x1f : state.possibleSources,
              dirty:
                state.dirty ||
                (handlers.get(operation) ?? []).some((fn) =>
                  mayMutate.has(bindingIdentityKey(fn.id)),
                ),
            };
          } else if (name === "c64.system.restoreIRQ") {
            if (state.dirty) {
              diagnostics.push(
                invalid(
                  name,
                  "CIA1 timer or interrupt-mask state may have changed, including selected handler writes; restoring the vector cannot restore device state",
                  operation.span,
                ),
              );
              break;
            }
            state = {
              ...state,
              routes: state.routes.slice(0, -1),
              handlerKeys: state.handlerKeys.slice(0, -1),
            };
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
                ...state,
                dirty: true,
                possibleSources:
                  state.possibleSources | Number(exact === undefined ? 0x03n : exact & 0x03n),
              };
            } else if (name.endsWith("disableInterruptSources")) {
              const clear = exact === undefined ? 0 : Number(exact & 0x1fn);
              state = {
                ...state,
                dirty: true,
                maskKnown: state.maskKnown || clear === 0x1f,
                possibleSources: state.possibleSources & ~clear,
              };
            } else {
              state = { ...state, dirty: true };
            }
          }
        } else if (operation.kind === "cpu-control") {
          if (operation.control === "asm_sei") state = { ...state, irqMayRun: false };
          if (operation.control === "asm_cli" || operation.control === "asm_plp") {
            state = { ...state, irqMayRun: true };
          }
        } else if (operation.kind === "memory-write") {
          const raw = rawCia1Effect(operation, values);
          if (raw.dirty && state.routes.includes("exclusive")) {
            state = {
              ...state,
              dirty: true,
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
            const output = analyze(
              bindingIdentityKey(fn.id),
              fn.entry,
              fn.blocks,
              fn.source,
              state,
            );
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
    if (diagnostics.length === 0) successful.set(memoKey, returned);
    return returned;
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
    );
  }
  const main = functions.get(bindingIdentityKey(program.main));
  if (main === undefined) throw new Error("Selected main function is missing");
  if (state !== null && diagnostics.length === 0) {
    state = analyze(bindingIdentityKey(main.id), main.entry, main.blocks, main.source, state);
    if (state?.dirty && diagnostics.length === 0) {
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
