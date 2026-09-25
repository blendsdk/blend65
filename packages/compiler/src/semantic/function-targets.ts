import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, FunctionType, SemanticType } from "../frontend/semantic-types.js";
import type {
  IndirectCallOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticPlace,
  SemanticProgram,
  ValueId,
} from "./operations.js";

/** Finite source targets proved for every indirect call in a closed semantic program. */
export type IndirectTargetSets = ReadonlyMap<IndirectCallOperation, readonly BindingId[]>;

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

/** A dynamic index may select any element; named fields never alias each other. */
function placePath(place: SemanticPlace): string {
  return place.path
    .map((part) => (part.kind === "field" ? `field:${part.name}` : "index:*"))
    .join("\0");
}

/** Attach a child aggregate path without confusing a field with its similarly named sibling. */
function joinPath(parent: string, child: string): string {
  return parent.length === 0 ? child : child.length === 0 ? parent : `${parent}\0${child}`;
}

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

/** Enumerate only callable leaves, without allocating a path for every array element. */
function callablePaths(type: SemanticType): readonly string[] {
  if (type.kind === "function") return [""];
  if (type.kind === "struct") {
    return type.fields.flatMap((field) =>
      callablePaths(field.type).map((path) => joinPath(`field:${field.name}`, path)),
    );
  }
  if (type.kind === "array" && type.length > 0) {
    return callablePaths(type.element).map((path) => joinPath("index:*", path));
  }
  return [];
}

/** Whole-object writes cover child paths; a field write covers only that field. */
function assignmentKey(place: SemanticPlace): string | null {
  if (place.path.some((part) => part.kind === "index")) return null;
  return joinPath(bindingIdentityKey(place.root), placePath(place));
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

/** Must-assignment facts at reads and calls within one executable CFG. */
function assignmentFacts(
  entry: string,
  blocks: readonly SemanticBlock[],
  initial: ReadonlySet<string>,
): {
  readonly unknown: ReadonlyMap<SemanticOperation, readonly string[]>;
  readonly beforeCalls: ReadonlyMap<SemanticOperation, ReadonlySet<string>>;
} {
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
        const key = assignmentKey(operation.place);
        if (key !== null) allAssigned.add(key);
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
          const key = assignmentKey(operation.place);
          if (key !== null) after.add(key);
        }
      }
      const previous = output.get(block.id)!;
      if (after.size !== previous.size || [...after].some((key) => !previous.has(key))) {
        output.set(block.id, after);
        changed = true;
      }
    }
  }
  const unknown = new Map<SemanticOperation, readonly string[]>();
  const beforeCalls = new Map<SemanticOperation, ReadonlySet<string>>();
  for (const block of active) {
    const assigned = new Set(input.get(block.id));
    for (const operation of block.operations) {
      if (operation.kind === "load" || operation.kind === "place-address") {
        const root = bindingIdentityKey(operation.place.root);
        const path = placePath(operation.place);
        const missing = callablePaths(operation.type).filter(
          (leaf) => !isAssigned(assigned, root, joinPath(path, leaf)),
        );
        if (missing.length > 0) unknown.set(operation, missing);
      } else if (operation.kind === "store") {
        const key = assignmentKey(operation.place);
        if (key !== null) assigned.add(key);
      } else if (operation.kind === "call" || operation.kind === "indirect-call") {
        beforeCalls.set(operation, new Set(assigned));
      }
    }
  }
  return { unknown, beforeCalls };
}

/** Infer callable provenance through values, typed storage, parameters and returns. */
export function resolveFunctionTargets(program: SemanticProgram): IndirectTargetSets {
  const functions = new Map(
    program.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const addressTaken = new Map<string, FunctionType>();
  const bindingTargets = new Map<string, Set<string>>();
  const valueTargets = new Map<string, Set<string>>();
  const returnTargets = new Map<string, Set<string>>();
  const bindingPaths = new Map<string, PathTargets>();
  const valuePaths = new Map<string, PathTargets>();
  const returnPaths = new Map<string, PathTargets>();
  /** Places still borrowed by aggregate values, used to return callee writes to their callers. */
  const valueAliases = new Map<string, SemanticPlace[]>();
  const indirectTargets = new Map<IndirectCallOperation, Set<string>>();
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
        if (operation.kind === "function-address" && operation.type.kind === "function") {
          addressTaken.set(bindingIdentityKey(operation.function), operation.type);
        }
      }
    }
  }
  // A direct callee starts with the globals assigned on every route to each
  // call site. Address-taken and exported functions remain independent entries.
  const globalRoots = new Set(program.globals.map((global) => bindingIdentityKey(global.id)));
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
  const independent = new Set([
    bindingIdentityKey(program.main),
    ...program.functions.filter((fn) => fn.exported).map((fn) => bindingIdentityKey(fn.id)),
    ...addressTaken.keys(),
  ]);
  const entryAssigned = new Map(
    program.functions.map(
      (fn) =>
        [
          bindingIdentityKey(fn.id),
          new Set(
            independent.has(bindingIdentityKey(fn.id)) ? initializedGlobals : allGlobalAssignments,
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
          ? context.initial
          : new Set([
              ...entryAssigned.get(context.owner)!,
              ...fn.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
            ]);
      for (const [operation, assigned] of assignmentFacts(context.entry, context.blocks, initial)
        .beforeCalls) {
        if (operation.kind !== "call") continue;
        const callee = bindingIdentityKey(operation.callee);
        if (!functions.has(callee)) continue;
        const globals = new Set(
          [...assigned].filter((key) =>
            [...globalRoots].some((root) => key === root || key.startsWith(`${root}\0`)),
          ),
        );
        const callers = incoming.get(callee) ?? [];
        callers.push(globals);
        incoming.set(callee, callers);
      }
    }
    for (const fn of program.functions) {
      const key = bindingIdentityKey(fn.id);
      const next = new Set(independent.has(key) ? initializedGlobals : allGlobalAssignments);
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
        ? context.initial
        : new Set([
            ...entryAssigned.get(context.owner)!,
            ...fn.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
          ]);
    for (const [operation, paths] of assignmentFacts(context.entry, context.blocks, initial)
      .unknown) {
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
      if (output === null || operation.type.kind !== "function") return false;
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
  return new Map(
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
}
