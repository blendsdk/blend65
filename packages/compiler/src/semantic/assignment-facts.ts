import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticPlace,
  SemanticProgram,
} from "./operations.js";
import { argumentOrigins, joinPath, placePath } from "./callable-paths.js";
import {
  addRawWrite,
  allDynamicIndicesBounded,
  callableLeaves,
  constantValue,
  definitionsOf,
  hasDynamicIndex,
  indexUpperBound,
  killFlow,
  placeBoundKey,
  placeByteRange,
  possibleCallableRanges,
  rangeIsKilled,
  subtractStore,
} from "./raw-write-kills.js";
import type { AliasRelations, IndexBounds, KilledFacts, PlacedRange } from "./raw-write-kills.js";

export { callablePaths, joinPath, placePath } from "./callable-paths.js";

/** Must-assignment facts at each block entry and after its operations. */
interface AssignmentFlow {
  /** Keys definitely assigned on entry to each reachable block. */
  readonly input: ReadonlyMap<string, ReadonlySet<string>>;
  /** Keys definitely assigned after each reachable block's operations. */
  readonly output: ReadonlyMap<string, ReadonlySet<string>>;
}

/** One definite write key, the parameter index that roots it, and its sources. */
export interface CallWriteKey {
  /** Assignment key rooted at a callee parameter or global. */
  readonly key: string;
  /** Parameter index for a parameter-rooted key, or null for a global key. */
  readonly parameter: number | null;
}

/** Definite writes proved by one directly called function. */
export interface CallWriteSummary {
  /** One entry per definitely written key. */
  readonly keys: readonly CallWriteKey[];
}

/** Definite writes keyed by the directly called function identity. */
export type CallWriteEffects = ReadonlyMap<string, CallWriteSummary>;

/** Ordered startup facts: what is assigned before main and at each initializer entry. */
export interface StartupAssignmentFacts {
  /** Keys definitely assigned after every ordered startup initializer completes. */
  readonly startup: ReadonlySet<string>;
  /** Keys definitely assigned before each global initializer runs. */
  readonly initializerEntry: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Immutable empty fact set shared by every analysis that proves no assignment. */
const NO_ASSIGNMENTS: ReadonlySet<string> = Object.freeze(new Set<string>());

/** Whole-object writes cover child paths; a field write covers only that field. */
export function assignmentKey(place: SemanticPlace): string | null {
  if (place.path.some((part) => part.kind === "index")) return null;
  return joinPath(bindingIdentityKey(place.root), placePath(place));
}

/**
 * Encode one assignment path with constant indices distinguished from a runtime
 * index. A runtime index returns null because one element store cannot prove a
 * must-assignment for every possible element.
 */
export function assignmentKeyWith(
  place: SemanticPlace,
  definitions: ReadonlyMap<string, SemanticOperation>,
): string | null {
  const parts: string[] = [];
  for (const part of place.path) {
    if (part.kind === "field") {
      parts.push(`field:${part.name}`);
      continue;
    }
    const index = constantValue(definitions.get(part.value), definitions);
    if (index === null) return null;
    parts.push(`index:${index}`);
  }
  return joinPath(bindingIdentityKey(place.root), parts.join("\0"));
}

/** The constant-aware assignment path, with a runtime index kept collapsed. */
function assignmentPathWith(
  place: SemanticPlace,
  definitions: ReadonlyMap<string, SemanticOperation>,
): string {
  return place.path
    .map((part) => {
      if (part.kind === "field") return `field:${part.name}`;
      const index = constantValue(definitions.get(part.value), definitions);
      return index === null ? "index:*" : `index:${index}`;
    })
    .join("\0");
}

/** An assigned ancestor contains every one of its descendants. */
function isAssigned(assigned: ReadonlySet<string>, root: string, path: string): boolean {
  if (assigned.has(root)) return true;
  let prefix = "";
  for (const part of path.split("\0")) {
    if (part.length === 0) continue;
    prefix = joinPath(prefix, part);
    if (assigned.has(joinPath(root, prefix))) return true;
  }
  return false;
}

/** Add the keys a directly called function definitely writes on every returning path. */
function applyCallWrite(
  assigned: Set<string>,
  operation: Extract<SemanticOperation, { readonly kind: "call" | "indirect-call" }>,
  effects: CallWriteEffects,
  definitions: ReadonlyMap<string, SemanticOperation>,
): void {
  // An indirect call contributes no guarantee: its finite target set is proved
  // separately and may contain functions with different write behavior.
  if (operation.kind !== "call") return;
  const summary = effects.get(bindingIdentityKey(operation.callee));
  if (summary === undefined) return;
  for (const entry of summary.keys) {
    if (entry.parameter === null) {
      assigned.add(entry.key);
      continue;
    }
    // A whole-parameter store rebinds the borrowed reference, not the caller's
    // object, so only a field path under the parameter transfers.
    const boundary = entry.key.indexOf("\0");
    if (boundary < 0) continue;
    const path = entry.key.slice(boundary + 1);
    const origins = argumentOrigins(operation.arguments[entry.parameter], definitions);
    if (origins === null || origins.length !== 1) continue;
    const origin = origins[0]!;
    // A dynamic or constant index is not a definite single destination for a
    // must-assignment fact; keep it conservative. A merged origin is a choice
    // between objects, not a definite write to both.
    if (origin.path.some((part) => part.kind === "index")) continue;
    if (origin.rootType?.kind !== "struct" && origin.rootType?.kind !== "array") continue;
    assigned.add(joinPath(bindingIdentityKey(origin.root), joinPath(placePath(origin), path)));
  }
}

/**
 * Values whose callable identity is a direct source function address, possibly
 * selected by a conditional merge. A load, parameter, call result or conversion
 * carries provenance the summary cannot re-prove, so it is not transferable.
 */
export function callableValuePredicate(
  blocks: readonly SemanticBlock[],
): (value: string) => boolean {
  const definitions = new Map<string, SemanticOperation>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      const result = "result" in operation ? operation.result : null;
      if (result !== null && result !== undefined) definitions.set(result, operation);
    }
  }
  const memo = new Map<string, boolean>();
  const isCallable = (value: string): boolean => {
    const known = memo.get(value);
    if (known !== undefined) return known;
    const definition = definitions.get(value);
    let safe = false;
    if (definition?.kind === "function-address") safe = true;
    else if (definition?.kind === "merge")
      safe = definition.incoming.every(({ value: incoming }) => isCallable(incoming));
    memo.set(value, safe);
    return safe;
  };
  return isCallable;
}

/** Compute must-assignment facts over one executable control-flow graph. */
function assignmentFlow(
  entry: string,
  blocks: readonly SemanticBlock[],
  initial: ReadonlySet<string>,
  callEffects: CallWriteEffects,
  acceptStore: (value: string) => boolean = () => true,
): AssignmentFlow {
  const definitions = definitionsOf(blocks);
  const byId = new Map(blocks.map((block) => [block.id, block] as const));
  const reachable = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (reachable.has(id)) continue;
    const block = byId.get(id);
    if (block === undefined) throw new Error(`Semantic CFG references missing block '${id}'`);
    reachable.add(id);
    if (block.terminator.kind === "jump") pending.push(block.terminator.target);
    else if (block.terminator.kind === "branch") {
      pending.push(block.terminator.whenTrue, block.terminator.whenFalse);
    }
  }
  const active = blocks.filter((block) => reachable.has(block.id));
  const predecessors = new Map(active.map((block) => [block.id, new Set<string>()] as const));
  const allAssigned = new Set(initial);
  for (const block of active) {
    for (const operation of block.operations) {
      if (operation.kind === "store") {
        const key = assignmentKeyWith(operation.place, definitions);
        if (key !== null && acceptStore(operation.value)) allAssigned.add(key);
      } else if (operation.kind === "call") {
        applyCallWrite(allAssigned, operation, callEffects, definitions);
      }
    }
    const successors =
      block.terminator.kind === "jump"
        ? [block.terminator.target]
        : block.terminator.kind === "branch"
          ? [block.terminator.whenTrue, block.terminator.whenFalse]
          : [];
    for (const successor of successors) predecessors.get(successor)?.add(block.id);
  }
  const output = new Map(active.map((block) => [block.id, new Set(allAssigned)] as const));
  const input = new Map<string, Set<string>>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of active) {
      const before = block.id === entry ? new Set(initial) : new Set(allAssigned);
      if (block.id !== entry) {
        for (const predecessor of predecessors.get(block.id) ?? []) {
          const facts = output.get(predecessor)!;
          for (const key of before) if (!facts.has(key)) before.delete(key);
        }
      }
      input.set(block.id, before);
      const after = new Set(before);
      for (const operation of block.operations) {
        if (operation.kind === "store") {
          const key = assignmentKeyWith(operation.place, definitions);
          if (key !== null && acceptStore(operation.value)) after.add(key);
        } else if (operation.kind === "call") {
          applyCallWrite(after, operation, callEffects, definitions);
        }
      }
      const previous = output.get(block.id)!;
      if (after.size !== previous.size || [...after].some((key) => !previous.has(key))) {
        output.set(block.id, after);
        changed = true;
      }
    }
  }
  return { input, output };
}

/** Intersect every returning block's facts into an entry-independent call summary. */
function definiteExit(flow: AssignmentFlow, blocks: readonly SemanticBlock[]): ReadonlySet<string> {
  let summary: Set<string> | null = null;
  for (const block of blocks) {
    if (block.terminator.kind !== "return") continue;
    const facts = flow.output.get(block.id);
    if (facts === undefined) continue;
    if (summary === null) summary = new Set(facts);
    else for (const key of [...summary]) if (!facts.has(key)) summary.delete(key);
  }
  return summary === null ? NO_ASSIGNMENTS : summary;
}

/** State and callbacks for one must-assignment and kill analysis pass. */
export interface AssignmentFactOptions {
  /** Kills already present on entry, for a callee analysed at a call site. */
  readonly initialKills?: KilledFacts | undefined;
  /** Apply a call's translated kill summary to the state after the call. */
  readonly callEffect?:
    | ((
        operation: Extract<SemanticOperation, { readonly kind: "call" | "indirect-call" }>,
        kills: KilledFacts,
      ) => KilledFacts)
    | undefined;
  /** May-alias relations for this body's parameters and globals. */
  readonly aliases?: AliasRelations | undefined;
  /** Whether an unresolved parameter forces every raw write to stay opaque. */
  readonly opaqueAliases?: boolean | undefined;
  /** Proved absolute intervals of explicitly placed globals. */
  readonly placed?: ReadonlyMap<string, PlacedRange> | undefined;
  /** Whether later compilation inserts runtime bounds guards. */
  readonly boundsChecked?: boolean | undefined;
  /** Roots a runtime raw write can name; private locals and by-value scalars are excluded. */
  readonly opaqueRoots?: ReadonlySet<string> | undefined;
}

/** One call's killed facts immediately before its argument effects. */
export type CallKillFacts = ReadonlyMap<
  Extract<SemanticOperation, { readonly kind: "call" | "indirect-call" }>,
  KilledFacts
>;

/** Must-assignment facts at reads and calls within one executable control-flow graph. */
export function assignmentFacts(
  entry: string,
  blocks: readonly SemanticBlock[],
  initial: ReadonlySet<string>,
  callEffects: CallWriteEffects,
  options: AssignmentFactOptions = {},
): {
  readonly unknown: ReadonlyMap<SemanticOperation, readonly string[]>;
  readonly beforeCalls: ReadonlyMap<SemanticOperation, ReadonlySet<string>>;
  readonly beforeCallKills: CallKillFacts;
  readonly exitKills: ReadonlyMap<string, KilledFacts>;
} {
  const flow = assignmentFlow(entry, blocks, initial, callEffects);
  const definitions = definitionsOf(blocks);
  const placed = options.placed ?? new Map<string, PlacedRange>();
  const killedFlow = killFlow(entry, blocks, definitions, placed, {
    initial: options.initialKills,
    aliases: options.aliases,
    opaqueAliases: options.opaqueAliases,
    boundsChecked: options.boundsChecked,
    callEffect: options.callEffect,
  });
  const unknown = new Map<SemanticOperation, readonly string[]>();
  const beforeCalls = new Map<SemanticOperation, ReadonlySet<string>>();
  const beforeCallKills = new Map<
    Extract<SemanticOperation, { readonly kind: "call" | "indirect-call" }>,
    KilledFacts
  >();
  const exitKills = new Map<string, KilledFacts>();
  for (const block of blocks) {
    const facts = flow.input.get(block.id);
    if (facts === undefined) continue;
    const assigned = new Set(facts);
    const bounds: Map<string, number> = new Map();
    let killed = killedFlow.input.get(block.id) ?? Object.freeze([]);
    for (const operation of block.operations) {
      if (operation.kind === "load" || operation.kind === "place-address") {
        const root = bindingIdentityKey(operation.place.root);
        const assignedPath = assignmentPathWith(operation.place, definitions);
        const base = placeByteRange(operation.place, definitions);
        const dynamic = hasDynamicIndex(operation.place, definitions);
        const possible = dynamic
          ? possibleCallableRanges(operation.place, definitions, bounds)
          : null;
        const boundedDynamic =
          dynamic && allDynamicIndicesBounded(operation.place, definitions, bounds);
        const missing = callableLeaves(operation.type).flatMap((leaf) => {
          // An unchecked, unbounded index may leave the object entirely, so any
          // known kill can be reachable. A checked or proved-bounded index stays
          // within the declared elements and is matched by possible leaf ranges.
          // An any-size array parameter has no fixed extent, so a dynamic read
          // cannot enumerate its elements. Any known kill may reach the selected
          // element; treat the read conservatively instead of empty.
          const unsizedDynamic =
            dynamic &&
            operation.place.rootType?.kind === "array" &&
            operation.place.rootType.length === 0;
          const corrupted = dynamic
            ? unsizedDynamic
              ? rangeIsKilled(
                  killed,
                  { root, start: 0, end: Number.MAX_SAFE_INTEGER },
                  options.opaqueRoots,
                )
              : boundsChecked(options) || boundedDynamic
                ? possible !== null &&
                  possible.some((range) =>
                    range.path === leaf.path
                      ? rangeIsKilled(killed, range, options.opaqueRoots)
                      : false,
                  )
                : killed.length > 0
            : base !== null &&
              rangeIsKilled(
                killed,
                {
                  root: base.root,
                  start: base.start + leaf.start,
                  end: base.start + leaf.end,
                },
                options.opaqueRoots,
              );
          // The unknown path is relative to the loaded value, not the source
          // place; an aggregate copy selects it again at its own prefix.
          const assignedNow = isAssigned(assigned, root, joinPath(assignedPath, leaf.path));
          if (process.env.BLEND65_DEBUG_167 === "1" && root.includes("711:769"))
            console.error(
              "cb",
              corrupted,
              assignedNow,
              JSON.stringify([...assigned]),
              options.opaqueRoots === undefined
                ? "no-roots"
                : String(options.opaqueRoots.has(root)),
            );
          return corrupted || !assignedNow ? [leaf.path] : [];
        });
        if (missing.length > 0) unknown.set(operation, missing);
      } else if (operation.kind === "store") {
        const key = assignmentKeyWith(operation.place, definitions);
        if (key !== null) assigned.add(key);
        const range = placeByteRange(operation.place, definitions);
        if (range !== null) killed = subtractStore(killed, range);
        const bound = indexUpperBound(operation.value, definitions, bounds as IndexBounds);
        const boundKey = placeBoundKey(operation.place);
        if (bound === null) bounds.delete(boundKey);
        else bounds.set(boundKey, bound);
      } else if (operation.kind === "memory-write") {
        killed = addRawWrite(
          killed,
          operation,
          definitions,
          placed,
          options.aliases,
          options.opaqueAliases,
          boundsChecked(options),
        );
      } else if (operation.kind === "call" || operation.kind === "indirect-call") {
        beforeCalls.set(operation, new Set(assigned));
        beforeCallKills.set(operation, killed);
        applyCallWrite(assigned, operation, callEffects, definitions);
        killed = options.callEffect?.(operation, killed) ?? killed;
      }
    }
    exitKills.set(block.id, killed);
  }
  return { unknown, beforeCalls, beforeCallKills, exitKills };
}

/** Read the selected bounds-check mode with the compiler default. */
function boundsChecked(options: AssignmentFactOptions): boolean {
  return options.boundsChecked ?? true;
}

/**
 * Prove the global keys each function definitely writes on every returning path.
 * A caller may rely on those keys after the call returns. Summaries are
 * entry-independent, so the analysis starts every body with no assignments and
 * grows a worklist whenever a directly called function proves a new write. This
 * transfers a callee's definite writes back into its caller's facts without
 * assuming any particular call order or single caller.
 *
 * Only a whole bare callable global is transferable. A field or element keeps
 * its pre-existing conservative proof. The address-taken and placement status
 * no longer blocks the transfer: the store writes the complete callable bytes
 * with a direct source address, and a later raw write is carried by the
 * byte-interval kill analysis rather than by refusing the typed assignment.
 */
export function callWriteSummaries(
  functions: ReadonlyMap<string, SemanticFunction>,
  acceptKey: (key: string) => boolean,
): CallWriteEffects {
  const effects = new Map<string, CallWriteSummary>();
  const callers = new Map<string, Set<string>>();
  for (const [owner, fn] of functions) {
    const direct = new Set<string>();
    for (const block of fn.blocks) {
      for (const operation of block.operations) {
        if (operation.kind === "call") direct.add(bindingIdentityKey(operation.callee));
      }
    }
    for (const callee of direct) {
      const known = callers.get(callee) ?? new Set<string>();
      known.add(owner);
      callers.set(callee, known);
    }
  }
  const pending = new Set(functions.keys());
  while (pending.size > 0) {
    const owner = pending.values().next().value;
    if (owner === undefined) break;
    pending.delete(owner);
    const fn = functions.get(owner);
    if (fn === undefined) continue;
    const flow = assignmentFlow(
      fn.entry,
      fn.blocks,
      NO_ASSIGNMENTS,
      effects,
      callableValuePredicate(fn.blocks),
    );
    const parameters = new Map(
      fn.parameters.map((parameter, index) => [bindingIdentityKey(parameter.id), index] as const),
    );
    const keys: CallWriteKey[] = [];
    for (const key of definiteExit(flow, fn.blocks)) {
      if (!acceptKey(key)) continue;
      const boundary = key.indexOf("\0");
      const root = boundary < 0 ? key : key.slice(0, boundary);
      keys.push({ key, parameter: parameters.get(root) ?? null });
    }
    const previous = effects.get(owner);
    const serialized = keys.map((entry) => `${entry.parameter ?? "-"}\0${entry.key}`);
    if (
      previous !== undefined &&
      serialized.length === previous.keys.length &&
      serialized.every(
        (entry, index) =>
          entry === `${previous.keys[index]!.parameter ?? "-"}\0${previous.keys[index]!.key}`,
      )
    )
      continue;
    effects.set(owner, { keys });
    for (const caller of callers.get(owner) ?? []) pending.add(caller);
  }
  return effects;
}

/**
 * Carry definite writes through the ordered startup initializers. Every
 * initializer runs before main, so an assignment made by a called helper during
 * startup is visible at main's entry. Later initializers also see the writes of
 * earlier ones. A non-returning initializer contributes no post-startup fact.
 *
 * Newly transferred facts are limited to the same accepted keys as call
 * summaries. Already-initialized globals keep their pre-existing facts.
 */
export function startupAssignmentFacts(
  program: SemanticProgram,
  initializedGlobals: ReadonlySet<string>,
  callEffects: CallWriteEffects,
  acceptKey: (key: string) => boolean,
): StartupAssignmentFacts {
  const globals = new Map(
    program.globals.map((global) => [bindingIdentityKey(global.id), global] as const),
  );
  const startup = new Set(initializedGlobals);
  const initializerEntry = new Map<string, ReadonlySet<string>>();
  for (const binding of program.initializerOrder) {
    const owner = bindingIdentityKey(binding);
    const global = globals.get(owner);
    if (global === undefined || global.entry === null) continue;
    initializerEntry.set(owner, new Set(startup));
    const flow = assignmentFlow(
      global.entry,
      global.blocks,
      startup,
      callEffects,
      callableValuePredicate(global.blocks),
    );
    for (const key of definiteExit(flow, global.blocks)) {
      if (acceptKey(key)) startup.add(key);
    }
  }
  return { startup, initializerEntry };
}
