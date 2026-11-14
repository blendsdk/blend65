import { semanticTypeSize, semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, FunctionType } from "../frontend/semantic-types.js";
import {
  assignmentFacts,
  assignmentKey,
  callWriteSummaries,
  callablePaths,
  callableValuePredicate,
  joinPath,
  placePath,
  startupAssignmentFacts,
} from "./assignment-facts.js";
import type {
  IndirectCallOperation,
  PlatformOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticPlace,
  SemanticProgram,
  ValueId,
} from "./operations.js";

/** Finite source targets proved for every indirect call in a closed semantic program. */
export type IndirectTargetSets = ReadonlyMap<IndirectCallOperation, readonly BindingId[]>;

/** Finite source handlers proved for each recognized platform sink operation. */
export type HandlerTargetSets = ReadonlyMap<PlatformOperation, readonly BindingId[]>;

/** Ordinary indirect-call and interrupt-sink targets from one fixed-point proof. */
export interface ResolvedTargetSets {
  /** Exact candidates for ordinary indirect calls. */
  readonly indirect: IndirectTargetSets;
  /** Exact candidates for recognized handler sinks. */
  readonly handlers: HandlerTargetSets;
}

/** Marks a callable value that may still contain uninitialized bytes. */
const UNKNOWN_TARGET = "\0unknown";

/** Retain a newly discovered target without depending on discovery order. */
function addTargets<Key>(
  facts: Map<Key, Set<string>>,
  key: Key,
  targets: Iterable<string>,
): boolean {
  const known = facts.get(key) ?? new Set<string>();
  const before = known.size;
  for (const target of targets) known.add(target);
  facts.set(key, known);
  return known.size !== before;
}

/** Function identities retained separately for each aggregate member path. */
type PathTargets = Map<string, Set<string>>;

/** Add all known member targets from one value to another value or storage binding. */
function addPathTargets<Key>(
  facts: Map<Key, PathTargets>,
  key: Key,
  source: PathTargets | undefined,
  prefix = "",
): boolean {
  if (source === undefined) return false;
  const known = facts.get(key) ?? new Map<string, Set<string>>();
  let changed = false;
  for (const [path, targets] of source) {
    changed = addTargets(known, joinPath(prefix, path), targets) || changed;
  }
  facts.set(key, known);
  return changed;
}

/** Select one field subtree, preserving all array candidates at a dynamic index. */
function selectPathTargets(source: PathTargets | undefined, path: string): PathTargets {
  const selected = new Map<string, Set<string>>();
  if (source === undefined) return selected;
  for (const [candidate, targets] of source) {
    if (
      path.length === 0 ||
      candidate === path ||
      candidate.startsWith(`${path}\0`) ||
      (candidate === "" && targets.has(UNKNOWN_TARGET)) ||
      (path.endsWith("index:*") && candidate.startsWith(path.slice(0, -1)))
    ) {
      addTargets(
        selected,
        path.length === 0 || candidate === ""
          ? candidate
          : candidate.slice(path.length).replace(/^\0/u, ""),
        targets,
      );
    }
  }
  return selected;
}

/** Infer callable and handler provenance through values, typed storage and calls. */
export function resolveTargetSets(
  program: SemanticProgram,
  handlerSinkCapabilities: ReadonlySet<string>,
): ResolvedTargetSets {
  const functions = new Map(
    program.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const addressTaken = new Map<string, FunctionType>();
  const handlerAddresses = new Set<string>();
  const bindingTargets = new Map<string, Set<string>>();
  const valueTargets = new Map<string, Set<string>>();
  const returnTargets = new Map<string, Set<string>>();
  const bindingPaths = new Map<string, PathTargets>();
  const valuePaths = new Map<string, PathTargets>();
  const returnPaths = new Map<string, PathTargets>();
  /** Places still borrowed by aggregate values, used to return callee writes to their callers. */
  const valueAliases = new Map<string, SemanticPlace[]>();
  const indirectTargets = new Map<IndirectCallOperation, Set<string>>();
  const handlerTargets = new Map<PlatformOperation, Set<string>>();
  const initializedGlobals = new Set(
    program.globals
      .filter((global) => global.initialBytes !== null || global.entry !== null)
      .map((global) => bindingIdentityKey(global.id)),
  );
  const contexts: readonly {
    readonly owner: string;
    readonly blocks: readonly SemanticBlock[];
    readonly entry: string;
    readonly initial: ReadonlySet<string>;
  }[] = [
    ...program.functions.map((fn) => ({
      owner: bindingIdentityKey(fn.id),
      blocks: fn.blocks,
      entry: fn.entry,
      initial: new Set([
        ...initializedGlobals,
        ...fn.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
      ]),
    })),
    ...program.globals
      .filter((global) => global.entry !== null)
      .map((global) => ({
        owner: bindingIdentityKey(global.id),
        blocks: global.blocks,
        entry: global.entry!,
        initial: new Set(
          [...initializedGlobals].filter((key) => key !== bindingIdentityKey(global.id)),
        ),
      })),
  ];
  for (const context of contexts) {
    for (const block of context.blocks) {
      for (const operation of block.operations) {
        if (operation.kind === "function-address") {
          if (operation.type.kind === "function") {
            addressTaken.set(bindingIdentityKey(operation.function), operation.type);
          } else if (operation.type.kind === "interrupt-handler") {
            handlerAddresses.add(bindingIdentityKey(operation.function));
          }
        }
      }
    }
  }
  // A direct callee starts with the globals assigned on every route to each
  // call site. Address-taken functions remain independent entries. Source export
  // controls visibility; it does not erase assignments made by an ordinary caller.
  const globalRoots = new Set(program.globals.map((global) => bindingIdentityKey(global.id)));
  // Explicitly placed storage has a proved absolute interval, so a constant
  // raw write can be checked for overlap before code generation.
  const placedRanges = new Map<string, { start: number; end: number }>();
  for (const global of program.globals) {
    const at = global.placement?.at;
    if (at === null || at === undefined) continue;
    placedRanges.set(bindingIdentityKey(global.id), {
      start: at,
      end: at + semanticTypeSize(global.type),
    });
  }
  const allGlobalAssignments = new Set(initializedGlobals);
  for (const root of globalRoots) allGlobalAssignments.add(root);
  for (const context of contexts) {
    for (const block of context.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "store") continue;
        if (!globalRoots.has(bindingIdentityKey(operation.place.root))) continue;
        const key = assignmentKey(operation.place);
        if (key !== null) allGlobalAssignments.add(key);
      }
    }
  }
  // A new call-write guarantee is limited to a bare callable global with no
  // placement and no taken address. Aggregate fields, placed globals and raw
  // aliases stay on the conservative pre-existing proof path. Corruption by an
  // arbitrary numeric raw write remains the separate target-proof boundary.
  const rawAddressRoots = new Set<string>();
  for (const context of contexts) {
    for (const block of context.blocks) {
      for (const operation of block.operations) {
        if (operation.kind === "place-address" && operation.type.kind === "scalar")
          rawAddressRoots.add(bindingIdentityKey(operation.place.root));
      }
    }
  }
  // A destination is transferable only when every compiler-visible store to it
  // assigns a direct callable source. One non-qualifying write anywhere means
  // the definite assignment no longer proves the stored function identity.
  const unsafeStoreRoots = new Set<string>();
  for (const context of contexts) {
    const safeValue = callableValuePredicate(context.blocks);
    for (const block of context.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "store") continue;
        const key = assignmentKey(operation.place);
        if (key === null || !safeValue(operation.value))
          unsafeStoreRoots.add(bindingIdentityKey(operation.place.root));
      }
    }
  }
  const transferableRoots = new Set(
    program.globals
      .filter(
        (global) =>
          global.type.kind === "function" &&
          (global.placement === null || global.placement === undefined),
      )
      .map((global) => bindingIdentityKey(global.id))
      .filter((root) => !rawAddressRoots.has(root) && !unsafeStoreRoots.has(root)),
  );
  const callEffects = callWriteSummaries(functions, transferableRoots);
  const startup = startupAssignmentFacts(
    program,
    initializedGlobals,
    callEffects,
    transferableRoots,
  );
  const mainKey = bindingIdentityKey(program.main);
  const independent = new Set([mainKey, ...addressTaken.keys(), ...handlerAddresses]);
  const independentEntry = (key: string): ReadonlySet<string> =>
    key === mainKey ? startup.startup : initializedGlobals;
  const entryAssigned = new Map(
    program.functions.map(
      (fn) =>
        [
          bindingIdentityKey(fn.id),
          new Set(
            independent.has(bindingIdentityKey(fn.id))
              ? independentEntry(bindingIdentityKey(fn.id))
              : allGlobalAssignments,
          ),
        ] as const,
    ),
  );
  let entryChanged = true;
  while (entryChanged) {
    entryChanged = false;
    const incoming = new Map<string, ReadonlySet<string>[]>();
    for (const context of contexts) {
      const fn = functions.get(context.owner);
      const initial =
        fn === undefined
          ? (startup.initializerEntry.get(context.owner) ?? context.initial)
          : new Set([
              ...entryAssigned.get(context.owner)!,
              ...fn.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
            ]);
      for (const [operation, assigned] of assignmentFacts(
        context.entry,
        context.blocks,
        initial,
        callEffects,
        placedRanges,
        program.boundsChecked ?? true,
      ).beforeCalls) {
        if (operation.kind !== "call") continue;
        const callee = bindingIdentityKey(operation.callee);
        if (!functions.has(callee)) continue;
        const globals = new Set(
          [...assigned].filter((key) => {
            // Native source paths exclude NUL; it separates the complete binding
            // identity from a field path, not one binding from a similar name.
            const boundary = key.indexOf("\0");
            return globalRoots.has(boundary < 0 ? key : key.slice(0, boundary));
          }),
        );
        const callers = incoming.get(callee) ?? [];
        callers.push(globals);
        incoming.set(callee, callers);
      }
    }
    for (const fn of program.functions) {
      const key = bindingIdentityKey(fn.id);
      const next = new Set(independent.has(key) ? independentEntry(key) : allGlobalAssignments);
      for (const caller of incoming.get(key) ?? []) {
        for (const assignment of next) if (!caller.has(assignment)) next.delete(assignment);
      }
      const previous = entryAssigned.get(key)!;
      if (
        next.size !== previous.size ||
        [...next].some((assignment) => !previous.has(assignment))
      ) {
        entryAssigned.set(key, next);
        entryChanged = true;
      }
    }
  }
  const unknownReads = new Map<SemanticOperation, readonly string[]>();
  for (const context of contexts) {
    const fn = functions.get(context.owner);
    const initial =
      fn === undefined
        ? (startup.initializerEntry.get(context.owner) ?? context.initial)
        : new Set([
            ...entryAssigned.get(context.owner)!,
            ...fn.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
          ]);
    for (const [operation, paths] of assignmentFacts(
      context.entry,
      context.blocks,
      initial,
      callEffects,
      placedRanges,
      program.boundsChecked ?? true,
    ).unknown) {
      unknownReads.set(operation, paths);
    }
  }
  const valueKey = (owner: string, value: ValueId): string => `${owner}\0${value}`;
  /** Preserve every possible source place when control flow merges aggregate borrows. */
  const addAliases = (key: string, places: readonly SemanticPlace[]): boolean => {
    const known = valueAliases.get(key) ?? [];
    let changed = false;
    for (const place of places) {
      const identity = `${bindingIdentityKey(place.root)}\0${placePath(place)}`;
      if (
        known.some(
          (candidate) =>
            `${bindingIdentityKey(candidate.root)}\0${placePath(candidate)}` === identity,
        )
      )
        continue;
      known.push(place);
      changed = true;
    }
    valueAliases.set(key, known);
    return changed;
  };
  const targetsOf = (owner: string, value: ValueId): ReadonlySet<string> =>
    valueTargets.get(valueKey(owner, value)) ?? new Set<string>();
  const returnsOf = (fn: SemanticFunction): ReadonlySet<string> =>
    returnTargets.get(bindingIdentityKey(fn.id)) ?? new Set<string>();
  const matchingAddresses = (signature: FunctionType): readonly string[] =>
    [...addressTaken]
      .filter(([, type]) => semanticTypesEqual(type, signature))
      .map(([key]) => key)
      .sort();

  /** Propagate one operation's sources to its destination facts. */
  const propagate = (owner: string, operation: SemanticOperation): boolean => {
    const output =
      "result" in operation && operation.result !== null ? valueKey(owner, operation.result) : null;
    if (operation.kind === "function-address") {
      if (output === null) return false;
      const target = bindingIdentityKey(operation.function);
      const paths = new Map([["", new Set([target])]]);
      const changed = addPathTargets(valuePaths, output, paths);
      return addTargets(valueTargets, output, [target]) || changed;
    }
    if (operation.kind === "store") {
      const root = bindingIdentityKey(operation.place.root);
      const changed = addPathTargets(
        bindingPaths,
        root,
        valuePaths.get(valueKey(owner, operation.value)),
        placePath(operation.place),
      );
      return addTargets(bindingTargets, root, targetsOf(owner, operation.value)) || changed;
    }
    if (operation.kind === "load" || operation.kind === "place-address") {
      if (output === null) return false;
      const aliasesChanged =
        (operation.type.kind === "struct" || operation.type.kind === "array") &&
        !(operation.kind === "place-address" && operation.captureValue === true)
          ? addAliases(output, [operation.place])
          : false;
      const root = bindingIdentityKey(operation.place.root);
      const path = placePath(operation.place);
      const selected = selectPathTargets(bindingPaths.get(root), path);
      for (const missing of unknownReads.get(operation) ?? []) {
        addTargets(selected, missing, [UNKNOWN_TARGET]);
      }
      const changed = addPathTargets(valuePaths, output, selected);
      // A member read must not inherit unrelated fields from its aggregate root.
      const candidates =
        path.length === 0 && selected.size === 0
          ? (bindingTargets.get(root) ?? [])
          : [...selected.values()].flatMap((targets) => [...targets]);
      return addTargets(valueTargets, output, candidates) || changed || aliasesChanged;
    }
    if (operation.kind === "convert" || operation.kind === "unary") {
      if (
        output === null ||
        (operation.type.kind !== "function" && operation.type.kind !== "interrupt-handler")
      )
        return false;
      const changed = addPathTargets(
        valuePaths,
        output,
        valuePaths.get(valueKey(owner, operation.operand)),
      );
      return addTargets(valueTargets, output, targetsOf(owner, operation.operand)) || changed;
    }
    if (operation.kind === "merge") {
      if (output === null) return false;
      let changed = false;
      for (const incoming of operation.incoming) {
        changed =
          addPathTargets(valuePaths, output, valuePaths.get(valueKey(owner, incoming.value))) ||
          changed;
        changed =
          addAliases(output, valueAliases.get(valueKey(owner, incoming.value)) ?? []) || changed;
      }
      return (
        addTargets(
          valueTargets,
          output,
          operation.incoming.flatMap(({ value }) => [...targetsOf(owner, value)]),
        ) || changed
      );
    }
    if (operation.kind === "aggregate") {
      if (output === null) return false;
      let changed = false;
      operation.elements.forEach((element) => {
        changed =
          addPathTargets(
            valuePaths,
            output,
            valuePaths.get(valueKey(owner, element.value)),
            element.field === null ? "index:*" : `field:${element.field}`,
          ) || changed;
      });
      if (operation.fill !== null) {
        changed =
          addPathTargets(
            valuePaths,
            output,
            valuePaths.get(valueKey(owner, operation.fill)),
            "index:*",
          ) || changed;
      }
      // A partial array initializer leaves the omitted elements with
      // indeterminate bytes. If a callable leaf can live in an omitted element,
      // the merged index path has no finite target and stays unknown. Without
      // this, a supplied element's target would be reused for an uninitialized
      // sibling because every array index shares the same proof path.
      if (
        operation.type.kind === "array" &&
        operation.fill === null &&
        operation.elements.length < operation.type.length
      ) {
        const callable = callablePaths(operation.type);
        if (callable.length > 0) {
          for (const path of callable) {
            changed =
              addPathTargets(valuePaths, output, new Map([[path, new Set([UNKNOWN_TARGET])]])) ||
              changed;
          }
          changed = addTargets(valueTargets, output, [UNKNOWN_TARGET]) || changed;
        }
      }
      return (
        addTargets(valueTargets, output, [
          ...operation.elements.flatMap(({ value }) => [...targetsOf(owner, value)]),
          ...(operation.fill === null ? [] : targetsOf(owner, operation.fill)),
        ]) || changed
      );
    }
    if (operation.kind === "call" || operation.kind === "indirect-call") {
      const callees =
        operation.kind === "call"
          ? [bindingIdentityKey(operation.callee)]
          : [...(indirectTargets.get(operation) ?? [])];
      let changed = false;
      for (const calleeKey of callees) {
        const callee = functions.get(calleeKey);
        if (callee === undefined) continue;
        for (let index = 0; index < operation.arguments.length; index += 1) {
          const parameter = callee.parameters[index];
          if (parameter === undefined) continue;
          changed =
            addPathTargets(
              bindingPaths,
              bindingIdentityKey(parameter.id),
              valuePaths.get(valueKey(owner, operation.arguments[index]!)),
            ) || changed;
          if (parameter.type.kind === "struct" || parameter.type.kind === "array") {
            for (const place of valueAliases.get(valueKey(owner, operation.arguments[index]!)) ??
              []) {
              changed =
                addPathTargets(
                  bindingPaths,
                  bindingIdentityKey(place.root),
                  bindingPaths.get(bindingIdentityKey(parameter.id)),
                  placePath(place),
                ) || changed;
            }
          }
          if (parameter.type.kind !== "function") continue;
          changed =
            addTargets(
              bindingTargets,
              bindingIdentityKey(parameter.id),
              targetsOf(owner, operation.arguments[index]!),
            ) || changed;
        }
        if (output !== null) {
          changed = addPathTargets(valuePaths, output, returnPaths.get(calleeKey)) || changed;
          changed = addTargets(valueTargets, output, returnsOf(callee)) || changed;
        }
      }
      if (operation.kind === "indirect-call") {
        const proved = targetsOf(owner, operation.target);
        changed =
          addTargets(
            indirectTargets,
            operation,
            [...proved].filter((target) => {
              if (target === UNKNOWN_TARGET) return true;
              const signature = addressTaken.get(target);
              return signature !== undefined && semanticTypesEqual(signature, operation.signature);
            }),
          ) || changed;
      }
      return changed;
    }
    if (operation.kind === "platform" && handlerSinkCapabilities.has(operation.capability)) {
      const target = operation.arguments[0];
      return target === undefined
        ? false
        : addTargets(handlerTargets, operation, targetsOf(owner, target));
    }
    return false;
  };

  /** Facts only grow, so this loop stops once every reachable target has propagated. */
  const settle = (): void => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const context of contexts) {
        for (const block of context.blocks) {
          for (const operation of block.operations) {
            changed = propagate(context.owner, operation) || changed;
          }
          if (block.terminator.kind === "return" && block.terminator.value !== null) {
            changed =
              addPathTargets(
                returnPaths,
                context.owner,
                valuePaths.get(valueKey(context.owner, block.terminator.value)),
              ) || changed;
            changed =
              addTargets(
                returnTargets,
                context.owner,
                targetsOf(context.owner, block.terminator.value),
              ) || changed;
          }
        }
      }
    }
  };
  settle();
  // An imprecise but still typed boundary can use every address-taken source function
  // with the exact signature. An empty set remains an opaque-call error downstream.
  for (const context of contexts) {
    for (const block of context.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "indirect-call" || operation.signature.kind !== "function") continue;
        if (indirectTargets.get(operation)?.has(UNKNOWN_TARGET)) continue;
        if ((indirectTargets.get(operation)?.size ?? 0) > 0) continue;
        addTargets(indirectTargets, operation, matchingAddresses(operation.signature));
      }
    }
  }
  settle();
  for (const context of contexts) {
    for (const block of context.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "platform" || !handlerSinkCapabilities.has(operation.capability))
          continue;
        if (handlerTargets.get(operation)?.has(UNKNOWN_TARGET)) continue;
        if ((handlerTargets.get(operation)?.size ?? 0) > 0) continue;
        addTargets(handlerTargets, operation, handlerAddresses);
      }
    }
  }
  settle();
  const indirect: IndirectTargetSets = new Map(
    [...indirectTargets].map(([call, targets]) => [
      call,
      Object.freeze(
        [...(targets.has(UNKNOWN_TARGET) ? [] : targets)].sort().flatMap((key) => {
          const functionId = functions.get(key)?.id;
          return functionId === undefined ? [] : [functionId];
        }),
      ),
    ]),
  );
  const handlers: HandlerTargetSets = new Map(
    [...handlerTargets].map(([sink, targets]) => [
      sink,
      Object.freeze(
        [...(targets.has(UNKNOWN_TARGET) ? [] : targets)]
          .filter((key) => handlerAddresses.has(key))
          .sort()
          .flatMap((key) => {
            const handler = functions.get(key)?.id;
            return handler === undefined ? [] : [handler];
          }),
      ),
    ]),
  );
  return Object.freeze({ indirect, handlers });
}

/** Preserve the ordinary-call API for direct provenance tests. */
export function resolveFunctionTargets(program: SemanticProgram): IndirectTargetSets {
  return resolveTargetSets(program, new Set()).indirect;
}
