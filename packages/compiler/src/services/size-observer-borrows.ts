import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import { literalResolver, valueDefinitions } from "../semantic/aggregate-place-proof.js";
import { bindingLabel } from "../machine/lower-control.js";
import { operationValueUses } from "../semantic/lower-control.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import { validObjectStorageSelection } from "../storage/selection.js";
import type { StorageRequest, StorageRange } from "../storage/storage-types.js";
import type {
  CallOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticPlace,
} from "../semantic/operations.js";
import { failure } from "./size-observer-raw-layout.js";
import type { ResidualFailure } from "./size-observer-raw-layout.js";
import type { FinalObserverInput } from "./size-observers.js";
import { findNamedObjectBacking } from "./size-observer-backing.js";
import type { ObjectRoot, Backing } from "./size-observer-backing.js";
import { validateCapturedAggregates } from "./size-observer-captures.js";

/** Invocation-local source premises; this is neither a receipt nor whole-tuple acceptance. */
export type BorrowValidation =
  | ResidualFailure
  | {
      /** Only these source operations and entry obligations have closed. */
      readonly kind: "complete";
      /** Exact aggregate transport operations whose every consumer was checked. */
      readonly operations: ReadonlySet<SemanticOperation>;
      /** Original parameter binding keys with checked backing through every direct entry. */
      readonly parameters: ReadonlySet<string>;
    };

/** One exact operation position in the unchanged source graph. */
interface Site {
  /** Exact checked function whose positions own this operation. */
  readonly fn: SemanticFunction;
  /** Original source block, not its scheduled machine position. */
  readonly block: SemanticBlock;
  /** Zero-based source operation position. */
  readonly index: number;
  /** Actual immutable source operation. */
  readonly operation: SemanticOperation;
}

/** A source argument occurrence; repeated arguments remain separate obligations. */
interface BorrowCall {
  /** Caller and exact source call position. */
  readonly site: Site;
  /** Unchanged call object used by the installed recipe. */
  readonly call: CallOperation;
  /** Exact checked callee owning the formal parameter. */
  readonly callee: SemanticFunction;
  /** Source parameter key, or null for delivery into a caller-owned result object. */
  readonly parameter: string | null;
  /** Concrete object bytes, not the formal pointer home. */
  readonly root: ObjectRoot;
}

/** Complete roots use source identities, not generated request spellings or source display names. */
function rootKey(root: ObjectRoot): string {
  return bindingIdentityKey(root.binding);
}

/** Exact inclusive-range exclusion; partial overlaps are not harmless ownership. */
function disjoint(left: StorageRange, right: StorageRange): boolean {
  return left.end < right.start || right.end < left.start;
}

/** Match source positions/spans without assuming object identity survived closure. */
function occupied(
  request: StorageRequest,
  site: Site,
  cache: Map<StorageRequest, ReadonlySet<string>>,
): boolean {
  if (bindingIdentityKey(request.lifetime.function) !== bindingIdentityKey(site.fn.id))
    return false;
  let positions = cache.get(request);
  if (positions === undefined) {
    positions = new Set(
      request.lifetime.liveAt.map((position) => `${position.block}\0${position.operation}`),
    );
    cache.set(request, positions);
  }
  return positions.has(`${site.block.id}\0${site.index}`);
}

/** A crossed source call includes the whole child execution, not just pointer delivery. */
function crosses(request: StorageRequest, call: CallOperation): boolean {
  return request.lifetime.callsCrossed.some(
    (span) =>
      span.sourceId === call.span.sourceId &&
      span.start === call.span.start &&
      span.end === call.span.end,
  );
}

/**
 * Discharge bounded whole-object transport using named backing and existing closed constructors.
 * Direct returned locals and evaluated captures require their complete destination/copy proofs.
 * Numeric addresses and unresolved replacements remain unsupported. No instruction
 * is marked footprint-covered by this proof.
 * @param input Authenticated source and actual final reference/candidate constructions.
 * @returns Exact discharged source operations/parameters or a whole-tuple failure.
 * @example const borrows = validateNamedBorrows(input);
 */
export function validateNamedBorrows(input: FinalObserverInput): BorrowValidation {
  const operations = new Set<SemanticOperation>();
  const parameters = new Set<string>();
  /** Source bindings written by an asynchronous handler closure. */
  const asyncWrites = new Set<string>();
  /** Literal raw bytes written by an asynchronous handler closure. */
  const asyncRawWrites: { start: number; end: number }[] = [];
  const facts = input.candidate.lowered.program.storageSelection?.sourceFacts;
  const reached = new Set(input.checked.program.reachableFunctions.map(bindingIdentityKey));
  const functions = input.checked.program.semantic.functions.filter((fn) =>
    reached.has(bindingIdentityKey(fn.id)),
  );
  const sites: Site[] = functions.flatMap((fn) =>
    reachableBlocks(fn.entry, fn.blocks).flatMap((block) =>
      block.operations.map((operation, index) => ({ fn, block, index, operation })),
    ),
  );
  const constructors = sites.filter((site) => site.operation.kind === "place-address");
  if (constructors.length === 0) return Object.freeze({ kind: "complete", operations, parameters });
  if (facts?.program !== input.checked.program)
    return failure("error", "Borrow facts belong to another checked source");
  if (facts.nonLoopBundle !== "closed" || input.reference.kind !== "feasible")
    return failure(
      "rejected",
      "Named borrowing needs active Closed recipes and both actual layouts",
    );
  /**
   * An address-taken function is admissible only when it is itself a selected
   * interrupt handler. Any other callable root could run at an arbitrary point
   * and would invalidate the loan without an entry contract.
   */
  const asyncHandlers = new Set(
    [
      ...(input.checked.program.interruptRoutes ?? []).map((route) => route.handler),
      ...input.checked.program.roots.flatMap((root) =>
        root.kind === "interrupt" ? [root.function] : [],
      ),
    ].map(bindingIdentityKey),
  );
  if (
    input.checked.program.roots.some(
      (root) => root.kind === "callable" && !asyncHandlers.has(bindingIdentityKey(root.function)),
    )
  )
    return failure("rejected", "Borrowed backing needs a complete asynchronous entry proof");
  if (asyncHandlers.size > 0) {
    /**
     * Close the handlers' direct-call descendants. An indirect call has no
     * entry contract. Every ordinary-RAM write must be a literal or a named
     * binding so the loan can be compared byte-for-byte with it; typed platform
     * sinks stay device/vector accesses outside the compiler's RAM allocation.
     */
    const active = new Set(asyncHandlers);
    for (let size = -1; size !== active.size; ) {
      size = active.size;
      for (const edge of input.checked.program.callGraph)
        if (active.has(bindingIdentityKey(edge.function)))
          edge.callees.forEach((callee) => active.add(bindingIdentityKey(callee)));
    }
    for (const fn of input.checked.program.semantic.functions) {
      if (!active.has(bindingIdentityKey(fn.id))) continue;
      const blocks = reachableBlocks(fn.entry, fn.blocks);
      const definitions = valueDefinitions(blocks),
        literal = literalResolver(definitions);
      for (const block of blocks)
        for (const operation of block.operations) {
          if (operation.kind === "indirect-call" || operation.kind === "memory-write") {
            if (operation.kind === "indirect-call")
              return failure("rejected", "Asynchronous entry has an indirect call", operation.span);
            const address = literal(operation.address);
            if (address === undefined || address < 0n || address > 0xffffn)
              return failure(
                "rejected",
                "Asynchronous entry has an unproved raw write",
                operation.span,
              );
            asyncRawWrites.push({
              start: Number(address),
              end: Number(address) + operation.width - 1,
            });
          } else if (operation.kind === "store") {
            asyncWrites.add(bindingIdentityKey(operation.place.root));
          } else if (operation.kind === "aggregate" && operation.destination?.kind === "place") {
            asyncWrites.add(bindingIdentityKey(operation.destination.place.root));
          }
        }
    }
  }
  const layouts = [input.reference.shared, input.candidate.shared];
  const homes = layouts.map(
    (shared) => new Map(shared.certificate.certificate.homes.map((home) => [home.requestId, home])),
  );
  const lifetimePositions = new Map<StorageRequest, ReadonlySet<string>>();
  const globals = new Map(
    input.checked.program.semantic.globals.map((global) => [bindingIdentityKey(global.id), global]),
  );
  const byFunction = new Map(functions.map((fn) => [bindingIdentityKey(fn.id), fn]));
  const packets = facts.functions;
  for (const [fn, packet] of packets) {
    if (
      packet.storage !== undefined &&
      !validObjectStorageSelection(packet.storage, packet.objects, fn)
    )
      return failure("error", "A borrow storage recipe is stale", fn.source);
  }
  const captures = validateCapturedAggregates(input);
  if (captures.kind !== "complete") return captures;
  for (const operation of captures.operations) operations.add(operation);
  /** A redirected local has no independent object home, even if its ABI pointer has storage. */
  const replacedRoots = new Set<string>();
  for (const shared of layouts)
    for (const result of shared.certificate.inventory.program.returnedLocalDestinations ?? [])
      replacedRoots.add(bindingIdentityKey(result.local));
  for (const packet of packets.values()) {
    for (const key of packet.storage?.resultRoots.keys() ?? []) replacedRoots.add(key);
    if (packet.storage?.resultLocal != null)
      replacedRoots.add(bindingIdentityKey(packet.storage.resultLocal));
  }
  const calls: BorrowCall[] = [];
  const allCalls = new Map(
    [...packets.values()].flatMap((packet) =>
      packet.objects.calls.map((call) => [call.operation, call] as const),
    ),
  );
  const graph = new Map(
    input.checked.program.callGraph.map((entry) => [
      bindingIdentityKey(entry.function),
      entry.callees.map(bindingIdentityKey),
    ]),
  );
  const children = new Map<string, ReadonlySet<string>>();
  /** Include the callee itself and all source descendants, cached only for this invocation. */
  const descendants = (id: string): ReadonlySet<string> => {
    const cached = children.get(id);
    if (cached !== undefined) return cached;
    const seen = new Set<string>();
    const pending = [id];
    for (let index = 0; index < pending.length; index += 1) {
      const next = pending[index]!;
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(...(graph.get(next) ?? []));
    }
    children.set(id, seen);
    return seen;
  };
  const sameRoot = (left: ObjectRoot, right: ObjectRoot) =>
    rootKey(left) === rootKey(right) &&
    (left.owner === null
      ? right.owner === null
      : right.owner !== null &&
        bindingIdentityKey(left.owner) === bindingIdentityKey(right.owner)) &&
    semanticTypesEqual(left.type, right.type);

  /** Resolve only whole named roots; pointer-backed result representations are deliberately out. */
  const resolve = (
    fn: SemanticFunction,
    place: SemanticPlace,
    type: SemanticType,
  ): ObjectRoot | null => {
    if (
      (type.kind !== "array" && type.kind !== "struct") ||
      type.size <= 0 ||
      place.path.length !== 0 ||
      place.asset !== undefined ||
      place.rootType === undefined ||
      !semanticTypesEqual(place.rootType, type)
    )
      return null;
    let root: ObjectRoot = {
      binding: place.root,
      owner: globals.has(bindingIdentityKey(place.root)) ? null : fn.id,
      type,
    };
    if (fn.parameters.some((parameter) => bindingIdentityKey(parameter.id) === rootKey(root))) {
      const parameter = packets.get(fn)?.storage?.parameters.get(rootKey(root));
      if (
        parameter === undefined ||
        parameter.origin.place.path.length !== 0 ||
        parameter.origin.place.asset !== undefined ||
        !semanticTypesEqual(parameter.origin.type, type)
      )
        return null;
      root = { binding: parameter.origin.place.root, owner: parameter.origin.owner, type };
    }
    const key = rootKey(root);
    if (root.owner === null) {
      const global = globals.get(key);
      return global !== undefined && semanticTypesEqual(global.type, type) ? root : null;
    }
    if (!byFunction.has(bindingIdentityKey(root.owner))) return null;
    if (replacedRoots.has(key)) return null;
    return root;
  };

  const backingCache = layouts.map(() => new Map<string, Backing | null>());
  /** Look up actual complete data extents, never an estimate or an address-bearing pointer. */
  const backing = (root: ObjectRoot, side: number): Backing | null => {
    const cache = backingCache[side]!;
    const key = rootKey(root);
    if (cache.has(key)) return cache.get(key)!;
    const result = findNamedObjectBacking(root, layouts[side]!, homes[side]!);
    cache.set(key, result);
    return result;
  };
  const conflicts = layouts.map(
    (shared) =>
      new Set(
        shared.certificate.certificate.interference.map((edge) =>
          edge.left < edge.right ? `${edge.left}\0${edge.right}` : `${edge.right}\0${edge.left}`,
        ),
      ),
  );
  const conflict = (side: number, left: string, right: string) =>
    conflicts[side]!.has(left < right ? `${left}\0${right}` : `${right}\0${left}`);
  const usesByFunction = new Map<SemanticFunction, Map<string, (Site | SemanticBlock)[]>>();
  const sitesByFunction = new Map<SemanticFunction, Site[]>();
  for (const site of sites) {
    const list = sitesByFunction.get(site.fn) ?? [];
    list.push(site);
    sitesByFunction.set(site.fn, list);
  }
  for (const fn of functions) {
    const uses = new Map<string, (Site | SemanticBlock)[]>();
    const add = (value: string, site: Site | SemanticBlock) => {
      const list = uses.get(value) ?? [];
      list.push(site);
      uses.set(value, list);
    };
    for (const site of sitesByFunction.get(fn) ?? [])
      for (const value of operationValueUses(site.operation)) add(value, site);
    for (const block of reachableBlocks(fn.entry, fn.blocks)) {
      if (block.terminator.kind === "branch") add(block.terminator.condition, block);
      if (block.terminator.kind === "return" && block.terminator.value !== null)
        add(block.terminator.value, block);
    }
    usesByFunction.set(fn, uses);
  }

  /**
   * Admit only existing direct redirection into a named caller object. The canonical result's
   * storage row names an ABI pointer; its object bytes are looked up independently on each side.
   * All recorded calls subsequently retain the same occupancy and interference checks as borrows.
   */
  const returnedRoot = (site: Site): ObjectRoot | null => {
    const operation = site.operation;
    const selection = packets.get(site.fn)?.storage;
    const result = selection?.result;

    if (
      operation.kind !== "place-address" ||
      (operation.type.kind !== "array" && operation.type.kind !== "struct") ||
      operation.place.path.length !== 0 ||
      operation.place.asset !== undefined ||
      selection?.resultLocal == null ||
      result == null ||
      bindingIdentityKey(selection.resultLocal) !== bindingIdentityKey(operation.place.root) ||
      selection.resultRoots.get(bindingIdentityKey(selection.resultLocal)) !== result.origin ||
      !semanticTypesEqual(operation.type, site.fn.result) ||
      !semanticTypesEqual(result.origin.type, operation.type) ||
      result.calls.length === 0 ||
      // A caller-owned destination has an owner. A resident global has none;
      // it is admitted only when the origin really is a declared global, so an
      // unowned local can never be treated as a resident backing.
      (result.origin.owner === null &&
        !globals.has(bindingIdentityKey(result.origin.place.root))) ||
      result.origin.place.path.length !== 0
    )
      return null;
    const root: ObjectRoot = {
      binding: result.origin.place.root,
      owner: result.origin.owner,
      type: operation.type,
    };
    for (const [side, shared] of layouts.entries()) {
      if (
        !shared.certificate.inventory.program.returnedLocalDestinations?.some(
          (entry) =>
            bindingIdentityKey(entry.function) === bindingIdentityKey(site.fn.id) &&
            bindingIdentityKey(entry.local) === bindingIdentityKey(selection.resultLocal!),
        )
      )
        return null;
      const data = backing(root, side);
      const rows = shared.certificate.inventory.results.filter(
        (row) =>
          bindingIdentityKey(row.function) === bindingIdentityKey(site.fn.id) &&
          row.domain === "main" &&
          row.activationRoot === undefined,
      );
      if (data === null || rows.length !== 1) return null;
      const location = rows[0]!.location;
      if (side === 0) {
        if (location.kind !== "storage") return null;
        const pointer = shared.certificate.inventory.requests.find(
          (request) => request.id === location.requestId,
        );
        if (
          pointer?.storageClass !== "pointer" ||
          pointer.bytes !== 2 ||
          bindingIdentityKey(pointer.owner) !== bindingIdentityKey(site.fn.id) ||
          homes[side]!.get(pointer.id)?.bytes !== 2
        )
          return null;
      } else if (
        location.kind !== "fixed-object" ||
        bindingIdentityKey(location.objectBindingId) !== rootKey(root) ||
        !(root.owner === null
          ? location.owner === null && globals.has(rootKey(root))
          : location.owner !== null &&
            bindingIdentityKey(location.owner) === bindingIdentityKey(root.owner)) ||
        location.bytes !== root.type.size ||
        (data.request === null
          ? location.backingRequestId !== null
          : location.backingRequestId !== data.request.id)
      )
        return null;
    }
    for (const recorded of result.calls) {
      const fn = byFunction.get(bindingIdentityKey(recorded.owner));
      const block = fn?.blocks.find((block) => block.id === recorded.position.block);
      const call = recorded.operation;
      const destination = call.aggregateDestination;
      if (
        fn === undefined ||
        block === undefined ||
        block.operations[recorded.position.operation] !== call ||
        allCalls.get(call) !== recorded ||
        bindingIdentityKey(call.callee) !== bindingIdentityKey(site.fn.id) ||
        destination?.kind !== "place" ||
        !semanticTypesEqual(call.type, root.type)
      )
        return null;
      const target = resolve(fn, destination.place, root.type);
      if (
        target === null ||
        !sameRoot(root, target) ||
        (target.owner === null
          ? !globals.has(rootKey(root))
          : bindingIdentityKey(target.owner) !== bindingIdentityKey(fn.id))
      )
        return null;
      calls.push({
        site: { fn, block, index: recorded.position.operation, operation: call },
        call,
        callee: site.fn,
        parameter: null,
        root,
      });
    }
    return root;
  };
  for (const constructor of constructors) {
    const operation = constructor.operation;
    if (operation.kind !== "place-address") continue;
    if (operation.captureValue === true) continue;
    const returned = returnedRoot(constructor);
    const root = returned ?? resolve(constructor.fn, operation.place, operation.type);
    if (root === null) {
      return failure(
        "rejected",
        "Address transport has no complete named aggregate backing",
        operation.span,
      );
    }
    if (layouts.some((_, side) => backing(root, side) === null))
      return failure(
        "rejected",
        "A named aggregate has no actual complete backing in both layouts",
        operation.span,
      );
    const uses = usesByFunction.get(constructor.fn)!;
    const pending = [operation.result];
    const visited = new Set<string>();
    let sinks = 0;
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const value = pending[cursor]!;
      if (visited.has(value))
        return failure(
          "rejected",
          "Aggregate transport contains an unresolved value cycle",
          operation.span,
        );
      visited.add(value);
      for (const use of uses.get(value) ?? []) {
        if (!("operation" in use)) {
          if (
            returned !== null &&
            use === constructor.block &&
            use.terminator.kind === "return" &&
            use.terminator.value === operation.result &&
            value === operation.result
          ) {
            sinks += 1;
            continue;
          }
          return failure(
            "rejected",
            "Return or branch address transport remains unproved",
            operation.span,
          );
        }
        const consumer = use.operation;
        if (
          consumer.kind === "convert" &&
          consumer.conversion === "identity" &&
          semanticTypesEqual(consumer.type, root.type)
        ) {
          pending.push(consumer.result);
          continue;
        }
        if (consumer.kind === "call") {
          const callee = byFunction.get(bindingIdentityKey(consumer.callee));
          const selected = callee === undefined ? undefined : packets.get(callee)?.storage;
          const recorded = allCalls.get(consumer);
          if (
            callee === undefined ||
            selected === undefined ||
            recorded === undefined ||
            bindingIdentityKey(recorded.owner) !== bindingIdentityKey(use.fn.id) ||
            recorded.position.block !== use.block.id ||
            recorded.position.operation !== use.index
          )
            return failure(
              "rejected",
              "Borrow consumer has no active recorded fixed-object call",
              consumer.span,
            );
          for (const [index, argument] of consumer.arguments.entries()) {
            if (argument !== value) continue;
            const parameter = callee.parameters[index];
            const fact =
              parameter === undefined
                ? undefined
                : selected.parameters.get(bindingIdentityKey(parameter.id));
            if (
              parameter === undefined ||
              fact === undefined ||
              !semanticTypesEqual(parameter.type, root.type) ||
              !sameRoot(root, {
                binding: fact.origin.place.root,
                owner: fact.origin.owner,
                type: fact.origin.type,
              })
            )
              return failure(
                "rejected",
                "Borrow argument has no matching installed whole-object replacement",
                consumer.span,
              );
            calls.push({
              site: use,
              call: consumer,
              callee,
              parameter: bindingIdentityKey(parameter.id),
              root,
            });
            sinks += 1;
          }
          continue;
        }
        if (
          consumer.kind !== "store" ||
          consumer.value !== value ||
          !semanticTypesEqual(consumer.type, root.type) ||
          use.block !== constructor.block ||
          use.index <= constructor.index
        )
          return failure(
            "rejected",
            "Aggregate address has an unsupported publication or capture consumer",
            consumer.span,
          );
        const target = resolve(use.fn, consumer.place, consumer.type);
        const localToBody = (object: ObjectRoot) =>
          object.owner === null ||
          bindingIdentityKey(object.owner) === bindingIdentityKey(use.fn.id);
        if (
          target === null ||
          !localToBody(root) ||
          !localToBody(target) ||
          use.block.operations
            .slice(constructor.index + 1, use.index)
            .some(
              (op) =>
                op.kind !== "constant" && !(op.kind === "convert" && op.conversion === "identity"),
            )
        )
          return failure(
            "rejected",
            "Whole-object copy needs an immediate named backing proof",
            consumer.span,
          );
        for (const [side] of layouts.entries()) {
          const from = backing(root, side),
            to = backing(target, side);
          if (
            from === null ||
            to === null ||
            !disjoint(from.range, to.range) ||
            (from.request !== null &&
              (!occupied(from.request, constructor, lifetimePositions) ||
                !occupied(from.request, use, lifetimePositions))) ||
            (to.request !== null && !occupied(to.request, use, lifetimePositions)) ||
            (from.request !== null &&
              to.request !== null &&
              !conflict(side, from.request.id, to.request.id))
          )
            return failure(
              "rejected",
              "Complete copy backing or copy-point separation is unproved",
              consumer.span,
            );
        }
        sinks += 1;
      }
    }
    if (sinks === 0)
      return failure(
        "rejected",
        "Aggregate address has no bounded transport consumer",
        operation.span,
      );
    operations.add(operation);
  }

  const entries = new Map<string, Set<CallOperation>>();
  const forwarding = new Map<string, ReadonlySet<string>>();
  for (const borrow of calls) {
    if (borrow.parameter === null) continue;
    const set = entries.get(borrow.parameter) ?? new Set();
    set.add(borrow.call);
    entries.set(borrow.parameter, set);
  }
  for (const borrow of calls) {
    const parameter =
      borrow.parameter === null
        ? undefined
        : packets.get(borrow.callee)!.storage!.parameters.get(borrow.parameter)!;
    if (
      parameter !== undefined &&
      !parameter.calls.every((call) => entries.get(borrow.parameter!)?.has(call.operation))
    )
      return failure(
        "rejected",
        "A fixed aggregate entry has an unchecked caller",
        borrow.call.span,
      );
    const owners = descendants(bindingIdentityKey(borrow.callee.id));
    const directOwner =
      borrow.root.owner !== null &&
      bindingIdentityKey(borrow.root.owner) === bindingIdentityKey(borrow.site.fn.id);
    if (borrow.root.owner !== null && !directOwner) {
      let reachedOwners = forwarding.get(rootKey(borrow.root));
      if (reachedOwners === undefined) {
        const reached = new Set([bindingIdentityKey(borrow.root.owner)]);
        for (let changed = true; changed; ) {
          changed = false;
          for (const edge of calls)
            if (
              sameRoot(edge.root, borrow.root) &&
              reached.has(bindingIdentityKey(edge.site.fn.id)) &&
              !reached.has(bindingIdentityKey(edge.callee.id))
            ) {
              reached.add(bindingIdentityKey(edge.callee.id));
              changed = true;
            }
        }
        forwarding.set(rootKey(borrow.root), reached);
        reachedOwners = reached;
      }
      if (!reachedOwners.has(bindingIdentityKey(borrow.site.fn.id)))
        return failure(
          "rejected",
          "Private backing has no closed forwarding path from its owner",
          borrow.call.span,
        );
    }
    for (const [side, shared] of layouts.entries()) {
      const data = backing(borrow.root, side)!;
      if (
        directOwner &&
        data.request !== null &&
        (!occupied(data.request, borrow.site, lifetimePositions) ||
          !crosses(data.request, borrow.call))
      )
        return failure(
          "rejected",
          "Private object occupancy does not cover its complete borrow call",
          borrow.call.span,
        );
      // An ancestor-owned object is protected at its outer call. Every forwarded
      // occurrence is still compared with the complete descendant request set.
      const helperIds = new Set(
        shared.certificate.certificate.helperCalls
          .filter((helper) => owners.has(bindingIdentityKey(helper.caller)))
          .flatMap((helper) => helper.helperRequestIds),
      );
      for (const request of shared.certificate.inventory.requests) {
        if (
          request.id === data.request?.id ||
          !(
            owners.has(bindingIdentityKey(request.owner)) ||
            helperIds.has(request.id) ||
            asyncHandlers.has(bindingIdentityKey(request.owner)) ||
            (directOwner && occupied(request, borrow.site, lifetimePositions))
          )
        )
          continue;
        const home = homes[side]!.get(request.id);
        if (
          home === undefined ||
          !disjoint(data.range, { start: home.address, end: home.address + home.bytes - 1 }) ||
          (data.request !== null && !conflict(side, data.request.id, request.id))
        )
          return failure(
            "rejected",
            "Borrowed object overlaps or lacks conflict proof against live call storage",
            borrow.call.span,
            request.id,
          );
      }
      /**
       * Every asynchronous write must be byte-disjoint from the borrowed object.
       * Named bindings resolve through the same layout backing as the loan; raw
       * writes were already reduced to literal byte ranges.
       */
      for (const binding of asyncWrites) {
        const global = globals.get(binding);
        if (global === undefined)
          return failure(
            "rejected",
            "Asynchronous entry writes an unproved binding",
            borrow.call.span,
          );
        // A global is emitted data, not an SFA request; resolve its interval directly.
        const id = bindingLabel("global", global.id);
        const intervals = shared.layout.intervals.filter(
          (interval) =>
            interval.id === id && ["global", "bss", "immutable"].includes(interval.kind),
        );
        const written = intervals.length === 1 ? intervals[0]! : null;
        if (written === null || !disjoint(data.range, written))
          return failure(
            "rejected",
            "Borrowed object overlaps an asynchronous write",
            borrow.call.span,
          );
      }
      for (const range of asyncRawWrites)
        if (!disjoint(data.range, range))
          return failure(
            "rejected",
            "Borrowed object overlaps an asynchronous raw write",
            borrow.call.span,
          );
    }
    if (borrow.parameter !== null) parameters.add(borrow.parameter);
  }
  return Object.freeze({ kind: "complete", operations, parameters });
}
