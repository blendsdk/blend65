import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { assignmentFacts, assignmentKey, callableValuePredicate } from "./assignment-facts.js";
import type { CallWriteEffects } from "./assignment-facts.js";
import type { KilledFacts } from "./raw-write-kills.js";
import {
  addKilledInterval,
  addPlacedWrite,
  allDynamicIndicesBounded,
  definitionsOf,
  hasDynamicIndex,
  normalizeKills,
  OPAQUE_ROOT,
  opaqueKill,
  placeByteRange,
  possiblePlaceRanges,
  subtractStore,
  unionKills,
} from "./raw-write-kills.js";
import type {
  AliasRelations,
  AliasTarget,
  Definitions,
  KilledRange,
  PlacedRange,
} from "./raw-write-kills.js";
import { reachableBlocks } from "./value-lifetimes.js";
import { argumentOrigins } from "./callable-paths.js";
import type {
  BlockId,
  IndirectCallOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticPlace,
  SemanticProgram,
  StorageValue,
} from "./operations.js";

/** One ordinary or indirect call operation. */
export type CallLike = Extract<SemanticOperation, { readonly kind: "call" | "indirect-call" }>;

/** One executable body analysed for entry kills and produced-kill summaries. */
export interface InterproceduralKillContext {
  /** Function or initializer binding key. */
  readonly owner: string;
  /** Entry block identity. */
  readonly entry: BlockId;
  /** Reachable body blocks. */
  readonly blocks: readonly SemanticBlock[];
  /** Must-assignment facts at entry, used only by the shared read analysis. */
  readonly initial: ReadonlySet<string>;
  /** Declared parameters; empty for a global initializer. */
  readonly parameters: readonly StorageValue[];
  /** Whether this body runs as an ordered global initializer. */
  readonly initializer: boolean;
}

/** Inputs for one whole-program kill closure. */
export interface InterproceduralKillInput {
  /** Analyzed semantic program. */
  readonly program: SemanticProgram;
  /** Executable bodies in program order; initializers keep their execution order. */
  readonly contexts: readonly InterproceduralKillContext[];
  /** Provisional indirect targets per call, as binding keys. */
  readonly indirectTargets: ReadonlyMap<IndirectCallOperation, readonly string[]>;
  /** Proved absolute intervals of explicitly placed globals. */
  readonly placed: ReadonlyMap<string, PlacedRange>;
  /** Whether later compilation inserts runtime bounds guards. */
  readonly boundsChecked: boolean;
  /** Roots a runtime raw write can name. */
  readonly opaqueRoots: ReadonlySet<string>;
  /** Must-assignment summaries already proved for direct calls. */
  readonly callWriteEffects: CallWriteEffects;
}

/** Closed per-body kill facts plus the call effect used by the final read pass. */
export interface InterproceduralKillResult {
  /** Kills that may be present on entry to each function and initializer. */
  readonly entryKills: ReadonlyMap<string, KilledFacts>;
  /** Apply one call's translated produced kills and definite restores. */
  readonly callEffect: (operation: CallLike, kills: KilledFacts) => KilledFacts;
  /** May-alias relations per function body. */
  readonly aliases: ReadonlyMap<string, AliasRelations>;
  /** Bodies where an unresolved borrowed actual keeps every write opaque. */
  readonly opaqueAliases: ReadonlySet<string>;
}

/** One prepared analysis context with its value definitions. */
interface PreparedContext {
  readonly context: InterproceduralKillContext;
  readonly definitions: Definitions;
  readonly parameterKeys: ReadonlySet<string>;
}

/** Stable empty fact set shared by every analysis with no kills. */
const NO_KILLS: KilledFacts = Object.freeze([]);

/** Whether a parameter is passed by reference and can expose caller storage. */
function isBorrowed(type: StorageValue["type"]): boolean {
  return type.kind === "struct" || type.kind === "array";
}

/** Serialize killed facts for a stable change comparison. */
function factKey(facts: KilledFacts): string {
  return JSON.stringify(facts);
}

/** Add a translated kill to one callee's entry facts. */
function addEntryKill(
  entries: Map<string, KilledFacts>,
  owner: string,
  kills: KilledFacts,
): boolean {
  const previous = entries.get(owner) ?? NO_KILLS;
  const next = unionKills(previous, kills);
  if (factKey(next) === factKey(previous)) return false;
  entries.set(owner, next);
  return true;
}

/** Collect the definition map and parameter keys of one executable body. */
function prepare(context: InterproceduralKillContext): PreparedContext {
  return {
    context,
    definitions: definitionsOf(context.blocks),
    parameterKeys: new Set(context.parameters.map((parameter) => bindingIdentityKey(parameter.id))),
  };
}

/**
 * Resolve one borrowed place to every byte interval it may occupy. A checked or
 * proved-bounded runtime index expands to its declared elements; an unchecked
 * unbounded index leaves the object and stays unresolved.
 */
function originRanges(
  place: SemanticPlace,
  definitions: Definitions,
  boundsChecked: boolean,
): readonly KilledRange[] | null {
  // An any-size array parameter carries a runtime element count, not a fixed
  // extent. A forwarded whole array must keep an unknown extent instead of
  // collapsing to the zero-size placeholder in the type.
  if (place.path.length === 0 && place.rootType?.kind === "array" && place.rootType.length === 0)
    return null;
  if (!hasDynamicIndex(place, definitions)) {
    const exact = placeByteRange(place, definitions);
    return exact === null ? null : [exact];
  }
  if (!boundsChecked && !allDynamicIndicesBounded(place, definitions)) return null;
  return possiblePlaceRanges(place, definitions);
}

/** Resolve every possible byte interval of one call argument. */
function actualRanges(
  value: string | undefined,
  definitions: Definitions,
  boundsChecked: boolean,
): readonly KilledRange[] | null {
  const origins = argumentOrigins(value, definitions);
  if (origins === null) return null;
  const ranges: KilledRange[] = [];
  for (const origin of origins) {
    const possible = originRanges(origin, definitions, boundsChecked);
    if (possible === null) return null;
    ranges.push(...possible);
  }
  return ranges;
}

/** Add one displacement relation without duplicating an existing target. */
function addAlias(graph: Map<string, AliasTarget[]>, source: string, target: AliasTarget): boolean {
  const targets = graph.get(source) ?? [];
  const known = targets.some(
    (candidate) =>
      ("all" in candidate && "all" in target) ||
      ("root" in candidate &&
        "root" in target &&
        candidate.root === target.root &&
        candidate.delta === target.delta),
  );
  if (known) return false;
  targets.push(target);
  graph.set(source, targets);
  return true;
}

/** Add the symmetric form of one displaced relation, reporting any new edge. */
function addSymmetricAlias(
  graph: Map<string, AliasTarget[]>,
  left: string,
  right: string,
  delta: number,
): boolean {
  const forward = addAlias(graph, left, { root: right, delta });
  const backward = addAlias(graph, right, { root: left, delta: -delta });
  return forward || backward;
}

/** Reachable roots and accumulated displacements from one source root. */
function aliasClosure(
  graph: ReadonlyMap<string, readonly AliasTarget[]>,
  source: string,
): readonly { readonly root: string; readonly delta: number }[] | null {
  const reached = new Map<string, number>();
  const pending: { readonly root: string; readonly delta: number }[] = [{ root: source, delta: 0 }];
  while (pending.length > 0) {
    const current = pending.pop()!;
    const key = `${current.root}\0${current.delta}`;
    if (reached.has(key)) continue;
    if (reached.size >= 256) return null;
    reached.set(key, current.delta);
    for (const target of graph.get(current.root) ?? []) {
      if ("all" in target) continue;
      pending.push({ root: target.root, delta: current.delta + target.delta });
    }
  }
  return [...reached].map(([key, delta]) => {
    const boundary = key.indexOf("\0");
    return { root: boundary < 0 ? key : key.slice(0, boundary), delta };
  });
}

/** Displacements between two roots in one body, or null when unresolved. */
function aliasRelation(
  graph: ReadonlyMap<string, readonly AliasTarget[]>,
  left: string,
  right: string,
): readonly number[] | null {
  const closure = aliasClosure(graph, left);
  if (closure === null) return null;
  if (left === right) return [0];
  return closure.filter((entry) => entry.root === right).map((entry) => entry.delta);
}

/** One call site that contributes parameter alias facts to its callee. */
interface AliasCallSite {
  /** Callee binding key. */
  readonly callee: string;
  /** The ordinary or indirect call operation. */
  readonly operation: CallLike;
  /** Caller body binding key. */
  readonly caller: string;
  /** Caller value definitions, used for argument origins. */
  readonly definitions: Definitions;
}

/** Build every body's may-alias graph and its unresolved-parameter flag. */
function buildAliasRelations(
  prepared: readonly PreparedContext[],
  functions: ReadonlyMap<string, SemanticFunction>,
  globalRoots: ReadonlySet<string>,
  placed: ReadonlyMap<string, PlacedRange>,
  boundsChecked: boolean,
  indirectTargets: ReadonlyMap<IndirectCallOperation, readonly string[]>,
): {
  readonly aliases: ReadonlyMap<string, AliasRelations>;
  readonly opaque: ReadonlySet<string>;
} {
  const aliases = new Map<string, Map<string, AliasTarget[]>>();
  for (const { context } of prepared) aliases.set(context.owner, new Map());
  const opaque = new Set<string>();
  const sawCallSite = new Set<string>();
  // Physical placed-global adjacency is visible from every body. Unplaced
  // globals stay disjoint by the allocator's own contract.
  const placedEntries = [...placed].filter(([root]) => globalRoots.has(root));
  for (const graph of aliases.values()) {
    for (let left = 0; left < placedEntries.length; left += 1) {
      for (let right = left + 1; right < placedEntries.length; right += 1) {
        const [leftRoot, leftRange] = placedEntries[left]!;
        const [rightRoot, rightRange] = placedEntries[right]!;
        if (leftRange.start < rightRange.end && rightRange.start < leftRange.end + 1)
          addSymmetricAlias(graph, leftRoot, rightRoot, leftRange.start - rightRange.start);
      }
    }
  }
  const callSites: AliasCallSite[] = [];
  for (const { context, definitions } of prepared) {
    for (const block of context.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "call" && operation.kind !== "indirect-call") continue;
        const targets =
          operation.kind === "call"
            ? [bindingIdentityKey(operation.callee)]
            : (indirectTargets.get(operation) ?? []);
        for (const callee of targets) {
          if (functions.has(callee))
            callSites.push({ callee, operation, caller: context.owner, definitions });
        }
      }
    }
  }
  // The callee graph depends on the caller graph: two forwarded parameters alias
  // exactly when their caller-side actual roots alias. Grow both until stable.
  let changed = true;
  let rounds = 0;
  while (changed && rounds < 64) {
    rounds += 1;
    changed = false;
    for (const site of callSites) {
      const callee = functions.get(site.callee);
      const graph = aliases.get(site.callee);
      if (callee === undefined || graph === undefined) continue;
      sawCallSite.add(site.callee);
      const callerGraph = aliases.get(site.caller) ?? new Map<string, AliasTarget[]>();
      const actuals = callee.parameters.map((parameter, index) =>
        isBorrowed(parameter.type)
          ? actualRanges(site.operation.arguments[index], site.definitions, boundsChecked)
          : [],
      );
      actuals.forEach((ranges, index) => {
        const parameter = callee.parameters[index]!;
        if (!isBorrowed(parameter.type)) return;
        if (ranges === null) {
          // An unresolved actual may be any object, so keep every write in the
          // body opaque instead of inventing a relation.
          opaque.add(site.callee);
          return;
        }
        const parameterKey = bindingIdentityKey(parameter.id);
        for (const range of ranges) {
          if (addSymmetricAlias(graph, parameterKey, range.root, range.start)) changed = true;
          // A write to a caller global or forwarded parameter must reach this
          // callee's parameter, and a write to the parameter must reach the
          // same storage. Compose both directions of the caller's closure.
          const closure = aliasClosure(callerGraph, range.root);
          if (closure === null) {
            opaque.add(site.callee);
            continue;
          }
          for (const entry of closure) {
            if (entry.root === range.root) continue;
            const composed = range.start + entry.delta;
            if (addAlias(graph, entry.root, { root: parameterKey, delta: -composed }))
              changed = true;
            if (addAlias(graph, parameterKey, { root: entry.root, delta: composed }))
              changed = true;
          }
        }
      });
      for (let left = 0; left < actuals.length; left += 1) {
        const leftRanges = actuals[left];
        const leftParameter = callee.parameters[left]!;
        if (leftRanges === null || !isBorrowed(leftParameter.type)) continue;
        const leftKey = bindingIdentityKey(leftParameter.id);
        for (let right = left + 1; right < actuals.length; right += 1) {
          const rightRanges = actuals[right];
          const rightParameter = callee.parameters[right]!;
          if (rightRanges === null || !isBorrowed(rightParameter.type)) continue;
          const rightKey = bindingIdentityKey(rightParameter.id);
          for (const leftRange of leftRanges) {
            for (const rightRange of rightRanges) {
              const relations = aliasRelation(callerGraph, leftRange.root, rightRange.root);
              if (relations === null) {
                opaque.add(site.callee);
                continue;
              }
              for (const relation of relations) {
                const delta = leftRange.start - rightRange.start + relation;
                if (addSymmetricAlias(graph, leftKey, rightKey, delta)) changed = true;
              }
            }
          }
        }
      }
    }
  }
  // A relation graph that has not converged inside the bound is treated as
  // unresolved for every borrowed body: conservatism, not a proof claim.
  if (changed) {
    for (const [owner, fn] of functions) {
      if (fn.parameters.some((parameter) => isBorrowed(parameter.type))) opaque.add(owner);
    }
  }
  for (const [owner, fn] of functions) {
    if (fn.parameters.some((parameter) => isBorrowed(parameter.type)) && !sawCallSite.has(owner))
      opaque.add(owner);
  }
  const result = new Map<string, AliasRelations>();
  for (const [owner, graph] of aliases) result.set(owner, graph);
  return { aliases: result, opaque };
}

/** Recall one function's global bare callable stores as a definite summary. */
function definiteRestorations(fn: SemanticFunction): readonly KilledRange[] {
  const safeValue = callableValuePredicate(fn.blocks);
  const definitions = definitionsOf(fn.blocks);
  const candidates = new Map<string, KilledRange>();
  for (const block of fn.blocks) {
    for (const operation of block.operations) {
      if (operation.kind !== "store" || !safeValue(operation.value)) continue;
      const key = assignmentKey(operation.place);
      if (key === null) continue;
      const range = placeByteRange(operation.place, definitions);
      if (range === null) continue;
      candidates.set(key, range);
    }
  }
  if (candidates.size === 0) return NO_KILLS;
  const active = reachableBlocks(fn.entry, fn.blocks);
  const predecessors = new Map(active.map((block) => [block.id, new Set<string>()] as const));
  for (const block of active) {
    const successors =
      block.terminator.kind === "jump"
        ? [block.terminator.target]
        : block.terminator.kind === "branch"
          ? [block.terminator.whenTrue, block.terminator.whenFalse]
          : [];
    for (const successor of successors) predecessors.get(successor)?.add(block.id);
  }
  // Top means "every candidate was stored". The entry starts empty and the
  // must-analysis only shrinks, so a reachable return never stays at top.
  const output = new Map<BlockId, ReadonlySet<string> | null>(
    active.map((block) => [block.id, block.id === fn.entry ? new Set<string>() : null]),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of active) {
      let before: Set<string> | null;
      if (block.id === fn.entry) before = new Set<string>();
      else {
        before = null;
        for (const predecessor of predecessors.get(block.id) ?? []) {
          const facts = output.get(predecessor) ?? null;
          if (facts === null) continue;
          if (before === null) before = new Set(facts);
          else for (const key of [...before]) if (!facts.has(key)) before.delete(key);
        }
      }
      const after: Set<string> | null = before === null ? null : new Set(before);
      if (after !== null) {
        for (const operation of block.operations) {
          if (operation.kind !== "store" || !safeValue(operation.value)) continue;
          const key = assignmentKey(operation.place);
          if (key !== null && candidates.has(key)) after.add(key);
        }
      }
      const previous = output.get(block.id) ?? null;
      const same =
        previous === null
          ? after === null
          : after !== null &&
            after.size === previous.size &&
            [...after].every((key) => previous.has(key));
      if (!same) {
        output.set(block.id, after);
        changed = true;
      }
    }
  }
  // A restoration is definite only when every returning path stored the key.
  // Unioning separate return facts would let an early return skip the repair.
  let restoredKeys: Set<string> | null = null;
  for (const block of active) {
    if (block.terminator.kind !== "return") continue;
    const facts = output.get(block.id);
    if (facts === null || facts === undefined) {
      restoredKeys = new Set();
      break;
    }
    if (restoredKeys === null) restoredKeys = new Set(facts);
    else for (const key of [...restoredKeys]) if (!facts.has(key)) restoredKeys.delete(key);
  }
  const restored: KilledRange[] = [];
  for (const key of restoredKeys ?? []) {
    const range = candidates.get(key);
    if (range !== undefined) restored.push(range);
  }
  return normalizeKills(restored);
}

/** Filter one produced summary to roots a caller can observe. */
function observables(
  facts: KilledFacts,
  globalRoots: ReadonlySet<string>,
  parameterKeys: ReadonlySet<string>,
): KilledFacts {
  return normalizeKills(
    facts.filter(
      (range) =>
        range.root === OPAQUE_ROOT || globalRoots.has(range.root) || parameterKeys.has(range.root),
    ),
  );
}

/** Union the exit facts of every returning block. */
function returningKills(
  exitKills: ReadonlyMap<string, KilledFacts>,
  blocks: readonly SemanticBlock[],
): KilledFacts {
  let summary = NO_KILLS;
  for (const block of blocks) {
    if (block.terminator.kind !== "return") continue;
    const facts = exitKills.get(block.id);
    if (facts !== undefined) summary = unionKills(summary, facts);
  }
  return summary;
}

/**
 * Close interprocedural raw-write kills. A monotone worklist grows each body's
 * entry kills and produced-kill summary until no call site can add a fact. The
 * startup chain runs in its declared order and seeds `main` with the kills that
 * survive every earlier initializer.
 */
export function analyzeInterproceduralKills(
  input: InterproceduralKillInput,
): InterproceduralKillResult {
  const functions = new Map(
    input.program.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const globalRoots = new Set(input.program.globals.map((global) => bindingIdentityKey(global.id)));
  const prepared = input.contexts.map(prepare);
  const byOwner = new Map(prepared.map((entry) => [entry.context.owner, entry] as const));
  const operationOwner = new Map<CallLike, PreparedContext>();
  for (const entry of prepared) {
    for (const block of entry.context.blocks) {
      for (const operation of block.operations) {
        if (operation.kind === "call" || operation.kind === "indirect-call")
          operationOwner.set(operation, entry);
      }
    }
  }
  const restorations = new Map<string, readonly KilledRange[]>();
  for (const [owner, fn] of functions) restorations.set(owner, definiteRestorations(fn));
  const aliasFacts = buildAliasRelations(
    prepared,
    functions,
    globalRoots,
    input.placed,
    input.boundsChecked,
    input.indirectTargets,
  );
  const aliases = aliasFacts.aliases;
  const opaque = aliasFacts.opaque;
  const summaries = new Map<string, KilledFacts>();
  const entryKills = new Map<string, KilledFacts>();
  for (const entry of prepared) {
    summaries.set(entry.context.owner, NO_KILLS);
    entryKills.set(entry.context.owner, NO_KILLS);
  }
  const targetsOf = (operation: CallLike): readonly string[] =>
    operation.kind === "call"
      ? [bindingIdentityKey(operation.callee)]
      : (input.indirectTargets.get(operation) ?? []);
  const callers = new Map<string, Set<string>>();
  for (const entry of prepared) {
    for (const block of entry.context.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "call" && operation.kind !== "indirect-call") continue;
        for (const target of targetsOf(operation)) {
          const known = callers.get(target) ?? new Set<string>();
          known.add(entry.context.owner);
          callers.set(target, known);
        }
      }
    }
  }

  /** Translate one callee summary into the caller's roots at one call site. */
  const outgoing = (
    operation: CallLike,
    calleeKey: string,
    entry: PreparedContext,
  ): KilledFacts => {
    const callee = functions.get(calleeKey);
    const summary = summaries.get(calleeKey) ?? NO_KILLS;
    if (callee === undefined || summary.length === 0) return NO_KILLS;
    let added = NO_KILLS;
    let opaqueResult = false;
    for (const range of summary) {
      if (range.root === OPAQUE_ROOT) {
        opaqueResult = true;
        continue;
      }
      if (globalRoots.has(range.root)) {
        added = unionKills(added, [range]);
        continue;
      }
      const index = callee.parameters.findIndex(
        (parameter) => bindingIdentityKey(parameter.id) === range.root,
      );
      const parameter = callee.parameters[index];
      if (index < 0 || parameter === undefined || !isBorrowed(parameter.type)) continue;
      const ranges = actualRanges(
        operation.arguments[index],
        entry.definitions,
        input.boundsChecked,
      );
      if (ranges === null) {
        opaqueResult = true;
        continue;
      }
      for (const origin of ranges) {
        const translated: KilledRange = {
          root: origin.root,
          start: origin.start + range.start,
          end: origin.start + range.end,
        };
        added = unionKills(added, [translated]);
        const base = input.placed.get(translated.root);
        if (base !== undefined)
          added = addPlacedWrite(
            added,
            base.start + translated.start,
            translated.end - translated.start,
            input.placed,
          );
      }
    }
    return opaqueResult ? unionKills(added, opaqueKill()) : added;
  };

  /** Translate a caller's kills into one callee's parameter roots. */
  const incoming = (
    callerKills: KilledFacts,
    operation: CallLike,
    calleeKey: string,
    caller: PreparedContext,
  ): KilledFacts => {
    const callee = functions.get(calleeKey);
    if (callee === undefined) return NO_KILLS;
    let translated = NO_KILLS;
    let unresolved = false;
    for (const kill of callerKills) {
      if (kill.root === OPAQUE_ROOT) {
        translated = unionKills(translated, [kill]);
        continue;
      }
      if (globalRoots.has(kill.root)) translated = unionKills(translated, [kill]);
      for (let index = 0; index < callee.parameters.length; index += 1) {
        const parameter = callee.parameters[index]!;
        if (!isBorrowed(parameter.type)) continue;
        const ranges = actualRanges(
          operation.arguments[index],
          caller.definitions,
          input.boundsChecked,
        );
        if (ranges === null) {
          unresolved = true;
          continue;
        }
        for (const range of ranges) {
          if (range.root !== kill.root) continue;
          const start = Math.max(kill.start, range.start);
          const end = Math.min(kill.end, range.end);
          if (start >= end) continue;
          translated = unionKills(translated, [
            {
              root: bindingIdentityKey(parameter.id),
              start: start - range.start,
              end: end - range.start,
            },
          ]);
        }
      }
    }
    if (unresolved && callerKills.length > 0) translated = unionKills(translated, opaqueKill());
    return translated;
  };

  /** Translate every possible callee's definite restores into a common set. */
  /** Translate one callee's definite field/global restores to the caller. */
  const translateRestores = (
    operation: CallLike,
    target: string,
    entry: PreparedContext,
  ): readonly KilledRange[] => {
    const callee = functions.get(target);
    if (callee === undefined) return NO_KILLS;
    const translated: KilledRange[] = [];
    for (const range of restorations.get(target) ?? []) {
      if (globalRoots.has(range.root)) {
        translated.push(range);
        continue;
      }
      const index = callee.parameters.findIndex(
        (parameter) => bindingIdentityKey(parameter.id) === range.root,
      );
      if (index < 0) continue;
      const ranges = actualRanges(
        operation.arguments[index],
        entry.definitions,
        input.boundsChecked,
      );
      // A definite restore needs a single definite actual object; a may-origin
      // union or an unresolved index cannot name the repaired bytes.
      if (ranges === null || ranges.length !== 1) continue;
      const origin = ranges[0]!;
      translated.push({
        root: origin.root,
        start: origin.start + range.start,
        end: origin.start + range.end,
      });
    }
    return translated;
  };
  const sharedRestores = (operation: CallLike, entry: PreparedContext): readonly KilledRange[] => {
    let common: Map<string, KilledRange> | null = null;
    for (const target of targetsOf(operation)) {
      const known = new Map(
        translateRestores(operation, target, entry).map((range) => [
          `${range.root}\0${range.start}\0${range.end}`,
          range,
        ]),
      );
      if (common === null) common = known;
      else for (const key of [...common.keys()]) if (!known.has(key)) common.delete(key);
    }
    return [...(common?.values() ?? [])];
  };

  const callEffect = (operation: CallLike, kills: KilledFacts): KilledFacts => {
    const entry = operationOwner.get(operation);
    const targets = targetsOf(operation);
    if (entry === undefined || targets.length === 0) return kills;
    // A definite restore repairs only the kills that entered the callee. A kill
    // the callee produces after its store survives this update.
    let next = kills;
    for (const restore of sharedRestores(operation, entry)) next = subtractStore(next, restore);
    let produced = NO_KILLS;
    for (const target of targets)
      produced = unionKills(produced, outgoing(operation, target, entry));
    // An unresolved borrowed actual in the caller may alias any produced root,
    // so a nested call's effect stays opaque in that body too.
    if (opaque.has(entry.context.owner) && produced.length > 0)
      produced = unionKills(produced, opaqueKill());
    // The produced kill names the caller's actual root. Project it through the
    // caller's own alias relation so a later read through a parameter of the
    // same object is also unproved.
    const callerAliases = aliases.get(entry.context.owner) ?? new Map();
    for (const range of produced)
      next = addKilledInterval(next, range, input.placed, callerAliases);
    return next;
  };

  const pending = new Set<string>();
  /** Run one body's facts with an explicit entry kill state. */
  const analyze = (entry: PreparedContext, initialKills: KilledFacts) => {
    const { context } = entry;
    return assignmentFacts(context.entry, context.blocks, context.initial, input.callWriteEffects, {
      initialKills,
      callEffect,
      aliases: aliases.get(context.owner),
      opaqueAliases: opaque.has(context.owner),
      placed: input.placed,
      boundsChecked: input.boundsChecked,
    });
  };
  /**
   * Refresh one function's produced-kill summary and propagate the kills that
   * reach its call sites. The summary starts from an empty entry state: a
   * read-only helper called with a corrupted global must not report that
   * corruption as its own write effect.
   */
  const refresh = (entry: PreparedContext): boolean => {
    const produced = analyze(entry, NO_KILLS);
    const summary = observables(
      returningKills(produced.exitKills, entry.context.blocks),
      globalRoots,
      entry.parameterKeys,
    );
    let changed = false;
    const previous = summaries.get(entry.context.owner) ?? NO_KILLS;
    if (factKey(summary) !== factKey(previous)) {
      summaries.set(entry.context.owner, summary);
      changed = true;
      for (const caller of callers.get(entry.context.owner) ?? []) pending.add(caller);
    }
    const informed = analyze(entry, entryKills.get(entry.context.owner) ?? NO_KILLS);
    for (const [operation, before] of informed.beforeCallKills) {
      for (const target of targetsOf(operation)) {
        if (addEntryKill(entryKills, target, incoming(before, operation, target, entry)))
          pending.add(target);
      }
    }
    return changed;
  };

  const runStartup = (): boolean => {
    let changed = false;
    let startup: KilledFacts = NO_KILLS;
    for (const context of input.contexts) {
      if (!context.initializer) continue;
      const entry = byOwner.get(context.owner);
      if (entry === undefined) continue;
      if (addEntryKill(entryKills, context.owner, startup)) {
        pending.add(context.owner);
        changed = true;
      }
      const before = entryKills.get(context.owner) ?? NO_KILLS;
      const result = assignmentFacts(
        context.entry,
        context.blocks,
        context.initial,
        input.callWriteEffects,
        {
          initialKills: before,
          callEffect,
          aliases: aliases.get(context.owner),
          opaqueAliases: opaque.has(context.owner),
          placed: input.placed,
          boundsChecked: input.boundsChecked,
          opaqueRoots: input.opaqueRoots,
        },
      );
      for (const [operation, kills] of result.beforeCallKills) {
        for (const target of targetsOf(operation)) {
          if (addEntryKill(entryKills, target, incoming(kills, operation, target, entry))) {
            pending.add(target);
            changed = true;
          }
        }
      }
      // The next initializer starts from this initializer's complete exit
      // state: a typed restore removes the earlier kill instead of being
      // masked by a union with the previous state.
      const exits = returningKills(result.exitKills, context.blocks);
      const returns = context.blocks.some(
        (block) => block.terminator.kind === "return" && result.exitKills.has(block.id),
      );
      if (returns) startup = observables(exits, globalRoots, new Set());
    }
    const mainKey = bindingIdentityKey(input.program.main);
    if (addEntryKill(entryKills, mainKey, startup)) {
      pending.add(mainKey);
      changed = true;
    }
    return changed;
  };

  for (const entry of prepared) pending.add(entry.context.owner);
  let summaryChanged = false;
  let startupPending = true;
  for (;;) {
    while (pending.size > 0) {
      const owner = pending.values().next().value;
      if (owner === undefined) break;
      pending.delete(owner);
      const entry = byOwner.get(owner);
      if (entry === undefined) continue;
      if (refresh(entry)) summaryChanged = true;
    }
    if (!startupPending && !summaryChanged) break;
    startupPending = false;
    summaryChanged = false;
    if (runStartup()) startupPending = true;
  }
  return { entryKills, callEffect, aliases, opaqueAliases: opaque };
}
