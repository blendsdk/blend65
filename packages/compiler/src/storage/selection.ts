import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import type {
  ClosedObjectFacts,
  ClosedObjectOrigin,
  ClosedParameterObject,
  ClosedResultObject,
} from "../semantic/closed-object-facts.js";
import {
  literalResolver,
  ordinalBoundResolver,
  placeMayEscapeRoot,
  placeUses,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import type {
  AggregateOperation,
  SemanticFunction,
  SemanticPlace,
  ValueId,
} from "../semantic/operations.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import { inventoryStorage } from "./inventory.js";
import { storageInventoryHash } from "./closure.js";
import type {
  StorageInventory,
  StoragePlacement,
  StorageRequest,
  ResultLocation,
} from "./storage-types.js";
import type { MachineStorageProjection } from "./storage-types.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import { validFixedLoopFacts } from "../semantic/aggregate-place-proof.js";
import { machineStorageAccesses, coveredBindingRequests } from "./interference.js";
import type { MachineFunction, MachineLoweringInput } from "../machine/machine-types.js";

/** Logical declarations and genuine physical facts are separate lowering inputs. */
interface LoweringStorageInput {
  /** Source-associated canonical declarations, including original ABI obligations. */
  readonly logicalStorage?: StorageInventory | undefined;
  /** Physical facts may be absent until the selected inventory is allocated. */
  readonly placement?: StoragePlacement | undefined;
  /** Size mode may place ordinary function homes in spare zero-page bytes. */
  readonly preferZeroPage?: boolean | undefined;
}

/**
 * Find declared identity/width without manufacturing a physical home.
 * Existing allocation-first callers retain their exact home lookup order.
 * @param input Original declarations or existing actual placement.
 * @param matches Exact request identity or source-binding predicate.
 * @returns Identity and byte width only; never an address, region or page proof.
 */
export function declaredStorage(
  input: LoweringStorageInput,
  matches: (id: string) => boolean,
): Pick<StorageRequest, "id" | "bytes"> | undefined {
  if (input.logicalStorage !== undefined)
    return input.logicalStorage.requests.find((request) => matches(request.id));
  const home = input.placement?.homes.find((entry) => matches(entry.requestId));
  return home === undefined ? undefined : { id: home.requestId, bytes: home.bytes };
}

/** Return the actual declared request identities, not an allocation prerequisite. */
export function declaredStorageIds(input: LoweringStorageInput): readonly string[] {
  return (
    input.logicalStorage?.requests.map(({ id }) => id) ??
    input.placement?.homes.map(({ requestId }) => requestId) ??
    []
  );
}

/**
 * Require complete unchanged declarations before symbolic lowering begins.
 * The original inventory remains the baseline; selection removes demand later.
 * @param input Checked source plus optional allocation-independent declarations.
 * @returns The real canonical inventory, or null for missing/stale declarations.
 */
export function logicalStorageForLowering(
  input: LoweringStorageInput & { readonly program: StorageInventory["program"] },
): StorageInventory | null {
  const canonical = inventoryStorage(input.program, {
    preferZeroPage: input.preferZeroPage === true,
  });
  const logical = input.logicalStorage;
  if (logical === undefined) return input.placement === undefined ? null : canonical;
  return logical.program === input.program &&
    storageInventoryHash(logical) === storageInventoryHash(canonical)
    ? logical
    : null;
}

/** Private derivation identity; no registry or semantic reanalysis is needed at consumption. */
const STORAGE_SELECTION_SEAL = Symbol("storage-selection-seal");

/** Conditional object representation shared by call lowering and later storage closure. */
export interface FunctionStorageSelection {
  /** Producer-owned immutable references and complete canonical replacement content. */
  readonly [STORAGE_SELECTION_SEAL]: {
    /** Actual source function present when this recipe was derived. */
    readonly function: SemanticFunction;
    /** Actual source facts present when this recipe was derived. */
    readonly facts: ClosedObjectFacts;
    /** Explicit map entries and all fields which can change root replacement. */
    readonly content: string;
    /** Existing complete derived recipe map, shared rather than copied into a registry. */
    readonly entries: ReadonlyMap<SemanticFunction, FunctionStorageSelection>;
  };
  /** Exact immutable source function whose generic entry is being represented. */
  readonly function: SemanticFunction;
  /** Original source facts and every pending physical/range observer obligation. */
  readonly facts: ClosedObjectFacts;
  /** Parameter binding keys whose whole-object addresses need no runtime delivery. */
  readonly parameters: ReadonlyMap<string, ClosedParameterObject>;
  /** Unique caller-owned fixed result, only when early publication is source-safe. */
  readonly result: ClosedResultObject | null;
  /** Fresh complete returned local which may share that result, or null for direct construction. */
  readonly resultLocal: BindingId | null;
  /** Explicit returned-local replacements shared by all fixed caller/callee recipes. */
  readonly resultRoots: ReadonlyMap<string, ClosedObjectOrigin>;
}

/** Bind every replacement field; Maps must be represented by their actual ordered entries. */
function selectionContent(
  selection: Omit<FunctionStorageSelection, typeof STORAGE_SELECTION_SEAL>,
): string {
  return JSON.stringify({
    parameters: [...selection.parameters].map(([key, parameter]) => [
      key,
      parameter.parameter,
      parameter.origin,
    ]),
    result:
      selection.result === null ? null : [selection.result.function.id, selection.result.origin],
    resultLocal: selection.resultLocal,
    resultRoots: [...selection.resultRoots].sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  });
}

/** Verify full constant construction without expanding a repeated array fill. */
function completeConstruction(
  initial: AggregateOperation,
  definitions: ReturnType<typeof valueDefinitions>,
): boolean {
  const pending = [initial];
  const seen = new Set<ValueId>();
  while (pending.length > 0) {
    const aggregate = pending.pop()!;
    if (seen.has(aggregate.result)) continue;
    seen.add(aggregate.result);
    const type = aggregate.type;
    if (type.kind !== "array" && type.kind !== "struct") return false;
    if (type.kind === "array") {
      if (
        aggregate.elements.length > type.length ||
        (aggregate.fill === null && aggregate.elements.length !== type.length)
      )
        return false;
    } else if (
      aggregate.elements.length !== type.fields.length ||
      type.fields.some(
        (field) =>
          aggregate.elements.filter((element) => element.field === field.name).length !== 1,
      )
    )
      return false;
    for (const element of aggregate.elements) {
      const value = definitions.get(element.value);
      if (value?.kind === "aggregate") pending.push(value);
      else if (value?.kind !== "constant") return false;
    }
    if (aggregate.fill !== null && definitions.get(aggregate.fill)?.kind !== "constant")
      return false;
  }
  return true;
}

/**
 * Match only one fully initialized local returned unchanged as a whole object.
 * Its member contents may evolve, but its address cannot escape or become a
 * captured aggregate value. All containment bounds retain their loop premises.
 */
function resultLocal(
  fact: ClosedResultObject,
  facts: ClosedObjectFacts,
): BindingId | null | undefined {
  const fn = fact.function;
  const blocks = reachableBlocks(fn.entry, fn.blocks);
  const definitions = valueDefinitions(blocks);
  const terminal = new Set<ValueId>();
  let root: BindingId | undefined;
  for (const block of blocks) {
    if (block.terminator.kind !== "return") continue;
    const id = block.terminator.value;
    if (id === null) return undefined;
    const value = definitions.get(id);
    if (value?.kind === "aggregate" && value.destination?.kind === "caller") continue;
    if (value?.kind === "call" && value.aggregateDestination?.kind === "caller") continue;
    if (
      value?.kind !== "place-address" ||
      value.captureValue === true ||
      value.place.path.length !== 0 ||
      value.place.asset !== undefined ||
      !semanticTypesEqual(value.type, fn.result)
    )
      return undefined;
    if (root !== undefined && bindingIdentityKey(root) !== bindingIdentityKey(value.place.root))
      return undefined;
    root = value.place.root;
    terminal.add(id);
  }
  if (root === undefined) return null;
  const key = bindingIdentityKey(root);
  if (
    fn.parameters.some((parameter) => bindingIdentityKey(parameter.id) === key) ||
    facts.program.semantic.globals.some((global) => bindingIdentityKey(global.id) === key)
  )
    return undefined;
  const entry = blocks.find((block) => block.id === fn.entry)!;
  const initializers = entry.operations.filter(
    (operation): operation is AggregateOperation =>
      operation.kind === "aggregate" &&
      operation.destination?.kind === "place" &&
      operation.destination.freshLocal === true &&
      operation.destination.freshConstant === true &&
      operation.destination.place.path.length === 0 &&
      bindingIdentityKey(operation.destination.place.root) === key &&
      semanticTypesEqual(operation.type, fn.result),
  );
  if (initializers.length !== 1 || !completeConstruction(initializers[0]!, definitions))
    return undefined;
  const initialization = initializers[0]!;
  const stores = entry.operations.filter(
    (operation) =>
      operation.kind === "store" &&
      operation.value === initialization.result &&
      operation.place.path.length === 0 &&
      bindingIdentityKey(operation.place.root) === key,
  );
  if (stores.length !== 1) return undefined;
  const initializedAt = entry.operations.indexOf(stores[0]!);
  if (initializedAt <= entry.operations.indexOf(initialization)) return undefined;
  const ordinaryBound = ordinalBoundResolver(definitions, literalResolver(definitions));
  const conditional = new Map<ValueId, bigint>();
  for (const loop of facts.rangeObservers) {
    if (loop.function !== fn) continue;
    for (const [value, maximum] of loop.valueBounds) {
      const previous = conditional.get(value);
      if (previous === undefined || maximum < previous) conditional.set(value, maximum);
    }
  }
  const bound = (value: ValueId) => conditional.get(value) ?? ordinaryBound(value);
  for (const block of blocks)
    for (const [index, operation] of block.operations.entries()) {
      for (const use of placeUses(operation)) {
        if (bindingIdentityKey(use.place.root) !== key) continue;
        if (
          block === entry &&
          index <= initializedAt &&
          operation !== initialization &&
          operation !== stores[0] &&
          !(
            operation.kind === "aggregate" &&
            operation.destination?.kind === "place" &&
            operation.destination.freshConstant === true
          )
        )
          return undefined;
        if (
          operation.kind === "place-address"
            ? !terminal.has(operation.result)
            : operation.kind !== "load" &&
              operation.kind !== "store" &&
              operation.kind !== "aggregate"
        )
          return undefined;
        if (placeMayEscapeRoot(use, bound)) return undefined;
      }
    }
  return root;
}

/**
 * Select deterministic conditional object recipes from already derived source facts.
 * This does not prove final RAM/bus/alias visibility, remove inventory entries or
 * permit publication. The whole candidate must discharge the retained facts first.
 * @param facts Exact source object origins, source effects and pending range observers.
 * @returns Per-function recipes for the closed bundle; an absent match keeps generic ABI.
 */
export function selectClosedObjectStorage(
  facts: ClosedObjectFacts,
): ReadonlyMap<SemanticFunction, FunctionStorageSelection> {
  const pending = new Map<
    SemanticFunction,
    Omit<FunctionStorageSelection, typeof STORAGE_SELECTION_SEAL>
  >();
  const resultRoots = new Map<string, ClosedObjectOrigin>();
  const byFunction = new Map<SemanticFunction, Map<string, ClosedParameterObject>>();
  for (const [key, parameter] of facts.parameters) {
    const parameters =
      byFunction.get(parameter.function) ?? new Map<string, ClosedParameterObject>();
    parameters.set(key, parameter);
    byFunction.set(parameter.function, parameters);
  }
  for (const fn of facts.program.semantic.functions) {
    const parameters = byFunction.get(fn) ?? new Map<string, ClosedParameterObject>();
    const candidate = facts.earlyResults.has(bindingIdentityKey(fn.id))
      ? facts.results.get(bindingIdentityKey(fn.id))
      : undefined;
    const local = candidate === undefined ? undefined : resultLocal(candidate, facts);
    const selected = candidate !== undefined && local !== undefined ? candidate : null;
    if (parameters.size === 0 && selected === null) continue;
    if (selected !== null && local != null)
      resultRoots.set(bindingIdentityKey(local), selected.origin);
    pending.set(
      fn,
      Object.freeze({
        function: fn,
        facts,
        parameters,
        result: selected,
        resultLocal: local ?? null,
        resultRoots,
      }),
    );
  }
  // Finish the shared explicit replacements before any recipe is sealed. A
  // spread copy retains the private seal, but altered content will no longer match.
  const result = new Map<SemanticFunction, FunctionStorageSelection>();
  for (const [fn, selection] of pending)
    result.set(
      fn,
      Object.freeze({
        ...selection,
        [STORAGE_SELECTION_SEAL]: Object.freeze({
          function: fn,
          facts,
          content: selectionContent(selection),
          entries: result,
        }),
      }),
    );
  return result;
}

/** Validate the optional internal construction tag without coercing host values. */
export function validNonLoopBundleTag(value: unknown): boolean {
  return value === undefined || value === "direct" || value === "closed";
}

/**
 * Require a complete derived bundle so a missing caller cannot leave stale replacements.
 * @param functions Actual per-source function packets installed for this attempt.
 * @param allowSelection False for the explicit Direct bundle, which keeps canonical object ABI.
 * @returns Whether all installed object recipes belong to the same complete admitted bundle.
 */
export function validObjectStorageBundle(
  functions: ReadonlyMap<SemanticFunction, { readonly storage?: FunctionStorageSelection }>,
  allowSelection = true,
): boolean {
  const selected = [...functions].flatMap(([fn, entry]) =>
    entry.storage === undefined ? [] : [[fn, entry.storage] as const],
  );
  const expected = selected[0]?.[1][STORAGE_SELECTION_SEAL]?.entries;
  if (!allowSelection && selected.length > 0) return false;
  return expected === undefined
    ? selected.length === 0
    : expected.size === selected.length &&
        selected.every(([fn, entry]) => expected.get(fn) === entry);
}

/** Confirm that a selected recipe still references its original source facts and function. */
export function validObjectStorageSelection(
  selection: FunctionStorageSelection,
  facts: ClosedObjectFacts,
  fn: SemanticFunction,
): boolean {
  const seal = selection[STORAGE_SELECTION_SEAL];
  return (
    seal?.function === fn &&
    seal.entries.get(fn) === selection &&
    seal.facts === facts &&
    seal.content === selectionContent(selection) &&
    selection.function === fn &&
    selection.facts === facts &&
    [...selection.parameters].every(
      ([key, parameter]) => parameter.function === fn && facts.parameters.get(key) === parameter,
    ) &&
    (selection.result === null ||
      (selection.result.function === fn &&
        facts.results.get(bindingIdentityKey(fn.id)) === selection.result &&
        facts.earlyResults.has(bindingIdentityKey(fn.id))))
  );
}

/**
 * Resolve explicit selected root replacements, retaining the evaluated field/index path.
 * Returned-local forwarding follows only the finite unique recipe chain; it does
 * not infer aliases. The original source facts remain available to final observers.
 * @param place Source place before selected object representation.
 * @param selection Explicit function recipe, or undefined for ordinary lowering.
 * @returns The unchanged place or its symbolic selected root, never a provisional address.
 * @throws {Error} If explicit returned-local destination recipes form a cycle.
 */
export function selectedStoragePlace(
  place: SemanticPlace,
  selection: FunctionStorageSelection | undefined,
): SemanticPlace {
  if (selection === undefined) return place;
  const key = bindingIdentityKey(place.root);
  let origin =
    selection.parameters.get(key)?.origin ??
    (selection.resultLocal !== null && bindingIdentityKey(selection.resultLocal) === key
      ? selection.result?.origin
      : undefined);
  origin ??= selection.resultRoots.get(key);
  const seen = new Set([key]);
  while (origin !== undefined && selection.resultRoots.has(bindingIdentityKey(origin.place.root))) {
    const next = bindingIdentityKey(origin.place.root);
    if (seen.has(next)) throw new Error("Selected fixed object destinations form a cycle");
    seen.add(next);
    origin = selection.resultRoots.get(next);
  }
  return origin === undefined
    ? place
    : Object.freeze({ ...place, root: origin.place.root, rootType: origin.type });
}

/** Preserve the selection entry point while its result representation shares the storage type owner. */
export type { MachineStorageProjection } from "./storage-types.js";

/** Require exact source, context, declaration and finite-loop authority before omitting a counter. */
function replacedCounter(
  request: StorageRequest | undefined,
  loop: FixedLoopFacts,
  fn: MachineFunction,
  input: MachineLoweringInput,
): request is StorageRequest {
  return (
    request !== undefined &&
    request.storageClass === "local" &&
    request.bytes === 2 &&
    request.binding !== null &&
    bindingIdentityKey(request.binding) === bindingIdentityKey(loop.counter) &&
    bindingIdentityKey(request.owner) === bindingIdentityKey(loop.function.id) &&
    fn.sourceFunction === loop.function.id &&
    !loop.parameter &&
    loop.outsideAccesses.length === 0 &&
    input.sourceFacts?.functions.get(loop.function)?.loops.includes(loop) === true &&
    validFixedLoopFacts(loop)
  );
}

/** Resolve only explicit whole-object root chains; a private backing must be actual object data. */
function fixedResultLocation(
  selection: FunctionStorageSelection,
  row: StorageInventory["results"][number],
  inventory: StorageInventory,
): Extract<ResultLocation, { readonly kind: "fixed-object" }> | null {
  const result = selection.result;
  if (result === null) return null;
  const place = selectedStoragePlace(result.origin.place, selection);
  const key = bindingIdentityKey(place.root);
  const global = inventory.program.semantic.globals.find(
    (entry) => bindingIdentityKey(entry.id) === key,
  );
  const backing = inventory.requests.filter(
    (request) =>
      request.storageClass === "local" &&
      request.binding !== null &&
      bindingIdentityKey(request.binding) === key &&
      request.domain === row.domain &&
      request.activationRoot === row.activationRoot,
  );
  if (
    place.path.length !== 0 ||
    (global === undefined &&
      (backing.length !== 1 || backing[0]!.bytes !== result.origin.type.size))
  )
    return null;
  return Object.freeze({
    kind: "fixed-object",
    objectBindingId: place.root,
    owner: global === undefined ? backing[0]!.owner : null,
    bytes: result.origin.type.size,
    backingRequestId: global === undefined ? backing[0]!.id : null,
  });
}

/**
 * Project explicitly replaced demand only after actual symbolic selection finishes.
 * Allocation-independent attempts opt in through their logical declarations. Legacy
 * allocation-first qualification retains its canonical requests. An unused request
 * alone is never removable, and every removed access remains an observer obligation.
 * @param input Exact source, validated packets and selected target context.
 * @param canonical Complete original declarations, before any selected omission.
 * @param functions Every selected body, including context variants and helper blocks.
 * @param startup Actual selected startup; its operands and effects also retain demand.
 * @param late Machine-discovered requests, before any omission or allocation.
 * @returns One complete inventory and matching late discovery, or an invalid backing error.
 */
export function projectMachineStorage(
  input: MachineLoweringInput,
  canonical: StorageInventory,
  functions: readonly MachineFunction[],
  startup: MachineFunction,
  late: readonly StorageRequest[],
): MachineStorageProjection {
  const requests = Object.freeze(
    [...canonical.requests, ...late].sort((left, right) =>
      Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
    ),
  );
  const originalInventory = Object.freeze({ ...canonical, requests });
  const facts = input.sourceFacts;
  if (input.logicalStorage === undefined || facts === undefined)
    return {
      kind: "complete",
      inventory: originalInventory,
      lateRequests: Object.freeze([...late]),
    };
  const declarations = new Map(requests.map((request) => [request.id, request]));
  const accesses = machineStorageAccesses([startup, ...functions]);
  const permitted = new Set<string>();
  for (const fn of functions) {
    for (const proof of fn.fixedCounterProofs ?? []) {
      const request = declarations.get(proof.originalRequestId);
      const replacement = proof.requestId === null ? undefined : declarations.get(proof.requestId);
      if (proof.context !== fn.id || !replacedCounter(request, proof.loop, fn, input)) continue;
      if (
        proof.representation === "low-byte"
          ? replacement?.bytes === 1
          : (proof.representation === "x" || proof.representation === "y") &&
            proof.requestId === null
      )
        permitted.add(request.id);
    }
    for (const proof of fn.fixedLoopProofs ?? []) {
      const loop = proof.loop;
      const labels = new Set(fn.blocks.map((block) => block.label));
      if (
        proof.context !== fn.id ||
        !loop.flatEight ||
        proof.occurrences.length !== 8 ||
        !proof.occurrences.every(
          (entry, index) =>
            entry.iteration === index &&
            entry.blocks.length > 0 &&
            entry.blocks.every((label) => labels.has(label)),
        )
      )
        continue;
      for (const request of canonical.requests)
        if (
          (request.domain === undefined || request.domain === "main") &&
          request.activationRoot === undefined &&
          replacedCounter(request, loop, fn, input)
        )
          permitted.add(request.id);
    }
    for (const proof of fn.nativeStoreProofs ?? []) {
      const capture = declarations.get(proof.captureRequestId);
      const variable = declarations.get(proof.variableRequestId);
      const source = facts.program.semantic.functions.find(
        (entry) => entry.id === fn.sourceFunction,
      );
      const operations = source?.blocks.flatMap((block) => block.operations);
      if (
        proof.context !== fn.id ||
        proof.function !== fn.sourceFunction ||
        capture?.storageClass !== "temporary" ||
        capture.bytes !== 1 ||
        capture.owner !== proof.function ||
        variable?.bytes !== 1 ||
        variable.binding !== proof.write.place.root ||
        proof.captureRequestId === proof.variableRequestId ||
        !accesses.has(proof.variableRequestId) ||
        !operations?.includes(proof.arithmetic) ||
        !operations.includes(proof.write) ||
        !operations.includes(proof.read) ||
        !operations.includes(proof.consumer)
      )
        continue;
      const [write, reload] = proof.removed;
      if (
        write?.opcode === "sta" &&
        reload?.opcode === "lda" &&
        [write, reload].every(
          (instruction) =>
            instruction.operand?.kind === "storage" && instruction.operand.requestId === capture.id,
        )
      )
        permitted.add(capture.id);
    }
  }
  let results = canonical.results;
  if (facts.nonLoopBundle === "closed") {
    for (const [source, packet] of facts.functions) {
      const selection = packet.storage;
      if (selection === undefined) continue;
      const owner = bindingIdentityKey(source.id);
      for (const request of canonical.requests) {
        if (
          bindingIdentityKey(request.owner) !== owner ||
          (request.domain !== undefined && request.domain !== "main")
        )
          continue;
        if (
          request.storageClass === "parameter" &&
          request.binding !== null &&
          selection.parameters.has(bindingIdentityKey(request.binding))
        )
          permitted.add(request.id);
        if (request.storageClass === "local" && request.binding === selection.resultLocal)
          permitted.add(request.id);
      }
      if (selection.result === null) continue;
      const projected = [];
      for (const row of results) {
        if (
          bindingIdentityKey(row.function) !== owner ||
          (row.domain !== undefined && row.domain !== "main")
        ) {
          projected.push(row);
          continue;
        }
        const location = fixedResultLocation(selection, row, originalInventory);
        if (
          location === null ||
          row.location.kind !== "storage" ||
          !row.location.requestId.endsWith(":pointer:aggregate-return-destination")
        )
          return {
            kind: "error",
            reason: "Fixed result has no complete declared backing object",
            source: source.source,
          };
        permitted.add(row.location.requestId);
        projected.push(Object.freeze({ ...row, location }));
      }
      results = Object.freeze(projected);
    }
  }
  const omitted = Object.freeze(
    requests.filter(
      (request) =>
        permitted.has(request.id) &&
        !accesses.has(request.id) &&
        !request.persistent &&
        !request.pageSafeIndirect,
    ),
  );
  const removed = new Set(omitted.map((request) => request.id));
  for (const row of results)
    if (
      row.location.kind === "fixed-object" &&
      row.location.backingRequestId !== null &&
      (!declarations.has(row.location.backingRequestId) ||
        removed.has(row.location.backingRequestId))
    )
      return {
        kind: "error",
        reason: "Fixed result refers to omitted backing storage",
        source: row.function.span,
      };
  const inventory = Object.freeze({
    ...canonical,
    requests: Object.freeze(
      coveredBindingRequests(
        facts,
        requests.filter((request) => !removed.has(request.id)),
        accesses,
      ),
    ),
    results,
  });
  return Object.freeze({
    kind: "complete",
    inventory,
    lateRequests: Object.freeze(late.filter((request) => !removed.has(request.id))),
    evidence: Object.freeze({
      originalInventory,
      sourceFacts: facts,
      omitted,
      pendingObservers: true,
    }),
  });
}
