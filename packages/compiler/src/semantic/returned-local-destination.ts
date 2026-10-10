import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import { semanticTypeSize, semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import {
  FIXED_C64_CAPABILITIES,
  literalResolver,
  ordinalBoundResolver,
  placeMayEscapeRoot,
  placeUses,
  platformIsDisjoint,
  profileFor,
  rawMayObserve,
  rawMaySelectHardwareRam,
  valueDefinitions,
} from "./aggregate-place-proof.js";
import type { AddressSpace } from "./aggregate-place-proof.js";
import type { WholeProgram } from "./whole-program.js";
import type {
  AggregateOperation,
  SemanticFunction,
  SemanticOperation,
  ValueId,
} from "./operations.js";
import { reachableBlocks } from "./value-lifetimes.js";

/** One proved whole-function destination binding, consumed before storage closure. */
export interface ReturnedLocalDestination {
  /** Source function whose every actual caller supplies the proved fresh destination. */
  readonly function: BindingId;
  /** Redundant complete local whose accesses resolve through the hidden result pointer. */
  readonly local: BindingId;
}

/**
 * Check every explicit member and fill without expanding a repeated array fill.
 * Entry definition order rules out cycles and late computations. Only constants
 * and complete nested literals qualify; purity alone never supplies missing bytes.
 */
function completeInitializer(
  initializer: AggregateOperation,
  operations: readonly SemanticOperation[],
): ReadonlySet<ValueId> | undefined {
  if (initializer.destination?.kind !== "place") return undefined;
  const root = bindingIdentityKey(initializer.destination.place.root);
  const definitions = new Map<ValueId, { operation: SemanticOperation; index: number }>();
  operations.forEach((operation, index) => {
    if ("result" in operation && operation.result !== null)
      definitions.set(operation.result, { operation, index });
  });
  const aggregates = new Set<ValueId>();
  const pending: { value: ValueId; type: SemanticType; before: number }[] = [
    { value: initializer.result, type: initializer.type, before: operations.length },
  ];
  while (pending.length > 0) {
    const { value, type, before } = pending.pop()!;
    const definition = definitions.get(value);
    if (definition === undefined || definition.index >= before || !("type" in definition.operation))
      return undefined;
    const operation = definition.operation;
    if (!semanticTypesEqual(operation.type, type)) return undefined;
    if (type.kind !== "array" && type.kind !== "struct") {
      if (operation.kind !== "constant" || (type.kind !== "scalar" && type.kind !== "enum"))
        return undefined;
      continue;
    }
    if (
      operation.kind !== "aggregate" ||
      operation.destination?.kind !== "place" ||
      operation.destination.freshConstant !== true ||
      bindingIdentityKey(operation.destination.place.root) !== root
    )
      return undefined;
    if (aggregates.has(value)) continue;
    aggregates.add(value);
    const members: { value: ValueId; type: SemanticType }[] = [];
    if (type.kind === "array") {
      if (
        operation.elements.length > type.length ||
        operation.elements.some(({ field }) => field !== null) ||
        (operation.elements.length < type.length && operation.fill === null)
      )
        return undefined;
      members.push(...operation.elements.map(({ value }) => ({ value, type: type.element })));
      if (operation.fill !== null) {
        if (type.element.kind !== "scalar" && type.element.kind !== "enum") return undefined;
        members.push({ value: operation.fill, type: type.element });
      }
    } else {
      if (operation.fill !== null || operation.elements.length !== type.fields.length)
        return undefined;
      const seen = new Set<string>();
      for (const member of operation.elements) {
        const field = type.fields.find(({ name }) => name === member.field);
        if (field === undefined || seen.has(field.name)) return undefined;
        seen.add(field.name);
        members.push({ value: member.value, type: field.type });
      }
    }
    pending.push(...members.map((member) => ({ ...member, before: definition.index })));
  }
  return aggregates;
}

/** Inventory address-bearing uses, including merges and hidden destination indexes. */
function objectValueInputs(operation: SemanticOperation): readonly ValueId[] {
  const values: ValueId[] = [];
  if ("operand" in operation) values.push(operation.operand);
  if ("left" in operation) values.push(operation.left, operation.right);
  if ("value" in operation && typeof operation.value === "string") values.push(operation.value);
  if ("arguments" in operation) values.push(...operation.arguments);
  if ("target" in operation) values.push(operation.target);
  if ("address" in operation) values.push(operation.address);
  if (operation.kind === "aggregate") {
    values.push(...operation.elements.map(({ value }) => value));
    if (operation.fill !== null) values.push(operation.fill);
  }
  if (operation.kind === "merge") values.push(...operation.incoming.map(({ value }) => value));
  for (const { place } of placeUses(operation))
    for (const selection of place.path)
      if (selection.kind === "index") values.push(selection.value);
  return values;
}

/**
 * Select one completely initialized returned local with no observable address use.
 * This is only body eligibility: callers and asynchronous/raw observers must still
 * be proved before any home can be removed. An absent proof changes no source rule.
 *
 * @param fn One unchanged semantic function.
 * @returns The candidate local identity, or undefined for the existing safe path.
 */
export function returnedLocalCandidate(fn: SemanticFunction): BindingId | undefined {
  if (
    fn.entryKind === "interrupt" ||
    (fn.result.kind !== "array" && fn.result.kind !== "struct") ||
    semanticTypeSize(fn.result) === 0
  )
    return undefined;
  const blocks = reachableBlocks(fn.entry, fn.blocks);
  const definitions = valueDefinitions(blocks);
  const terminalValues = new Set<ValueId>();
  let local: BindingId | undefined;
  for (const block of blocks) {
    if (block.terminator.kind !== "return") continue;
    if (block.terminator.value === null) return undefined;
    const value = definitions.get(block.terminator.value);
    if (
      value?.kind !== "place-address" ||
      value.captureValue === true ||
      value.place.asset !== undefined ||
      value.place.path.length !== 0 ||
      !semanticTypesEqual(value.type, fn.result)
    )
      return undefined;
    if (local !== undefined && bindingIdentityKey(local) !== bindingIdentityKey(value.place.root))
      return undefined;
    local = value.place.root;
    terminalValues.add(value.result);
  }
  if (
    local === undefined ||
    fn.parameters.some(({ id }) => bindingIdentityKey(id) === bindingIdentityKey(local))
  )
    return undefined;
  const root = bindingIdentityKey(local);
  const entry = blocks.find(({ id }) => id === fn.entry)!;
  const initializers = entry.operations.filter(
    (operation): operation is AggregateOperation =>
      operation.kind === "aggregate" &&
      operation.destination?.kind === "place" &&
      operation.destination.freshLocal === true &&
      operation.destination.freshConstant === true &&
      operation.destination.place.path.length === 0 &&
      bindingIdentityKey(operation.destination.place.root) === root &&
      semanticTypesEqual(operation.type, fn.result),
  );
  if (initializers.length !== 1) return undefined;
  const initializer = initializers[0]!;
  const constructed = completeInitializer(initializer, entry.operations);
  if (constructed === undefined) return undefined;
  const stores = entry.operations.filter(
    (operation) =>
      operation.kind === "store" &&
      operation.value === initializer.result &&
      operation.place.path.length === 0 &&
      bindingIdentityKey(operation.place.root) === root &&
      semanticTypesEqual(operation.type, fn.result),
  );
  if (stores.length !== 1) return undefined;
  const initializedAt = entry.operations.indexOf(stores[0]!);
  if (initializedAt <= entry.operations.indexOf(initializer)) return undefined;
  const objectValues = new Set([...terminalValues, ...constructed]);
  const bound = ordinalBoundResolver(definitions, literalResolver(definitions));
  for (const block of blocks) {
    for (const [index, operation] of block.operations.entries()) {
      const construction = operation.kind === "aggregate" && constructed.has(operation.result);
      const completedStore = operation === stores[0];
      if (
        !construction &&
        !completedStore &&
        objectValueInputs(operation).some((value) => objectValues.has(value))
      )
        return undefined;
      for (const use of placeUses(operation)) {
        if (bindingIdentityKey(use.place.root) !== root) continue;
        if (use.place.asset !== undefined) return undefined;
        if (block === entry && index <= initializedAt && !construction && !completedStore)
          return undefined;
        if (!construction && !completedStore) {
          if (operation.kind === "place-address") {
            if (!terminalValues.has(operation.result)) return undefined;
          } else if (operation.kind !== "load" && operation.kind !== "store") return undefined;
          else if (operation.type.kind === "array" || operation.type.kind === "struct")
            return undefined;
        }
        if (placeMayEscapeRoot({ ...use, place: { ...use.place, rootType: fn.result } }, bound))
          return undefined;
      }
    }
    if (block.terminator.kind === "branch" && objectValues.has(block.terminator.condition))
      return undefined;
  }
  return local;
}

/** Trace only a call's argument definitions; missing input facts cannot prove disjointness. */
function argumentsMayAlias(
  arguments_: readonly ValueId[],
  root: string,
  definitions: ReadonlyMap<ValueId, SemanticOperation>,
): boolean {
  const finished = new Set<ValueId>();
  const visiting = new Set<ValueId>();
  const pending = arguments_.map((value) => ({ value, exit: false }));
  while (pending.length > 0) {
    const { value, exit } = pending.pop()!;
    if (exit) {
      visiting.delete(value);
      finished.add(value);
      continue;
    }
    if (finished.has(value)) continue;
    if (visiting.has(value)) return true;
    visiting.add(value);
    const operation = definitions.get(value);
    if (operation === undefined) return true;
    if (placeUses(operation).some(({ place }) => bindingIdentityKey(place.root) === root))
      return true;
    pending.push({ value, exit: true });
    for (const input of objectValueInputs(operation)) pending.push({ value: input, exit: false });
  }
  return false;
}

/**
 * Require every reachable call to choose a new private whole local before entry.
 * One unproved use excludes the entire callee. Addressed/canonical entries remain
 * stable, and ordinary later borrowing of the completed caller object is irrelevant.
 *
 * @param program Closed source roots, bodies and actual call targets.
 * @returns Function identities with at least one call and no unproved caller.
 */
export function freshReturnedLocalCallers(program: WholeProgram): ReadonlySet<string> {
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  const globals = new Set(program.semantic.globals.map(({ id }) => bindingIdentityKey(id)));
  const rejected = new Set(
    program.roots.flatMap((root) =>
      root.kind === "callable" || root.kind === "interrupt" || root.kind === "main"
        ? [bindingIdentityKey(root.function)]
        : [],
    ),
  );
  const called = new Set<string>();
  const bodies = [
    ...program.semantic.functions.filter(({ id }) => reached.has(bindingIdentityKey(id))),
    ...program.semantic.globals.filter(({ entry }) => entry !== null),
  ];
  for (const body of bodies) {
    if (body.entry === null) continue;
    const blocks = reachableBlocks(body.entry, body.blocks);
    const definitions = valueDefinitions(blocks);
    const parameters =
      "parameters" in body
        ? new Set(body.parameters.map(({ id }) => bindingIdentityKey(id)))
        : undefined;
    for (const block of blocks) {
      for (const operation of block.operations) {
        if (operation.kind === "indirect-call") {
          for (const target of program.indirectTargets?.get(operation) ?? [])
            rejected.add(bindingIdentityKey(target));
          continue;
        }
        if (operation.kind !== "call") continue;
        const key = bindingIdentityKey(operation.callee);
        called.add(key);
        const destination = operation.aggregateDestination;
        if (
          operation.result === null ||
          destination?.kind !== "place" ||
          destination.freshLocal !== true ||
          destination.place.path.length !== 0 ||
          destination.place.asset !== undefined ||
          destination.place.rootType === undefined ||
          !semanticTypesEqual(destination.place.rootType, operation.type) ||
          parameters === undefined
        ) {
          rejected.add(key);
          continue;
        }
        const root = bindingIdentityKey(destination.place.root);
        if (
          globals.has(root) ||
          parameters.has(root) ||
          argumentsMayAlias(operation.arguments, root, definitions)
        )
          rejected.add(key);
      }
    }
  }
  return new Set([...called].filter((key) => !rejected.has(key)));
}

/**
 * Prepare one immutable whole-function binding using existing closed call/domain facts.
 * Unknown raw addresses, incomplete accesses and hardware-RAM publication retain
 * the old path. Hardware configuration persists beyond the configuring call, so
 * publication anywhere in reached functions or executable initializers excludes
 * sharing until its complete fetch interval is proved disjoint. Other unsafe
 * helper facts propagate once over reverse call edges. The
 * conservative generated IRQ/NMI union never treats I as protection from NMI.
 *
 * @param program Source/call/domain closure with its existing finite interrupt proof.
 * @param addressSpace Proved inclusive allocation windows and selected profile identity.
 * @returns Stable source-order certificates; consumers must activate them together.
 */
export function proveReturnedLocalDestinations(
  program: WholeProgram,
  addressSpace?: AddressSpace,
): readonly ReturnedLocalDestination[] {
  const profile = profileFor(addressSpace);
  if (
    profile === undefined ||
    addressSpace === undefined ||
    program.executionDomains === undefined ||
    program.interruptContextAnalysis === undefined ||
    program.interruptContextAnalysis.diagnostics.length !== 0
  )
    return Object.freeze([]);
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  const functions = new Map(
    program.semantic.functions
      .filter(({ id }) => reached.has(bindingIdentityKey(id)))
      .map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const windows = [...addressSpace.ram, ...addressSpace.zeroPage];
  const platformDisjoint = platformIsDisjoint(addressSpace, profile);
  const unsafe = new Set<string>();
  let hardwareMayObserve = false;
  const bodies = [
    ...functions.values(),
    ...program.semantic.globals.filter(({ entry }) => entry !== null),
  ];
  for (const body of bodies) {
    if (body.entry === null) continue;
    const key = bindingIdentityKey(body.id);
    const blocks = reachableBlocks(body.entry, body.blocks);
    const definitions = valueDefinitions(blocks);
    const literal = literalResolver(definitions);
    const bound = ordinalBoundResolver(definitions, literal);
    for (const block of blocks) {
      for (const operation of block.operations) {
        if (
          placeUses(operation).some(
            (use) =>
              use.place.path.some(({ kind }) => kind === "index") && placeMayEscapeRoot(use, bound),
          )
        )
          unsafe.add(key);
        if (operation.kind === "memory-read" || operation.kind === "memory-write") {
          const address = literal(operation.address);
          if (rawMayObserve(address, operation.width, windows)) unsafe.add(key);
          if (
            operation.kind === "memory-write" &&
            (rawMaySelectHardwareRam(address, operation.width, profile) ||
              address === undefined ||
              BigInt.asUintN(16, address) <= 1n ||
              (operation.width === 2 && BigInt.asUintN(16, address + 1n) <= 1n))
          ) {
            unsafe.add(key);
            hardwareMayObserve = true;
          }
        }
        if (
          operation.kind === "platform" &&
          (!FIXED_C64_CAPABILITIES.has(operation.capability) || !platformDisjoint)
        ) {
          unsafe.add(key);
          hardwareMayObserve = true;
        }
      }
    }
  }
  if (hardwareMayObserve) return Object.freeze([]);
  const parents = new Map<string, Set<string>>();
  for (const node of program.callGraph) {
    const caller = bindingIdentityKey(node.function);
    for (const callee of node.callees) {
      const key = bindingIdentityKey(callee);
      const incoming = parents.get(key) ?? new Set<string>();
      incoming.add(caller);
      parents.set(key, incoming);
      if (!functions.has(key)) unsafe.add(key);
    }
  }
  const pending = [...unsafe];
  for (let index = 0; index < pending.length; index += 1) {
    for (const caller of parents.get(pending[index]!) ?? []) {
      if (unsafe.has(caller)) continue;
      unsafe.add(caller);
      pending.push(caller);
    }
  }
  const unsafeAsync = program.executionDomains.some(
    ({ function: id, domains }) =>
      domains.some((domain) => domain !== "main") && unsafe.has(bindingIdentityKey(id)),
  );
  if (unsafeAsync) return Object.freeze([]);
  const callers = freshReturnedLocalCallers(program);
  const globals = new Set(program.semantic.globals.map(({ id }) => bindingIdentityKey(id)));
  const certificates: ReturnedLocalDestination[] = [];
  for (const id of program.reachableFunctions) {
    const key = bindingIdentityKey(id);
    const fn = functions.get(key);
    if (fn === undefined || unsafe.has(key) || !callers.has(key)) continue;
    const local = returnedLocalCandidate(fn);
    if (local !== undefined && !globals.has(bindingIdentityKey(local)))
      certificates.push(Object.freeze({ function: id, local }));
  }
  return Object.freeze(certificates);
}
