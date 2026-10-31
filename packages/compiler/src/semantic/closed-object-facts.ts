import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import {
  FIXED_C64_CAPABILITIES,
  literalResolver,
  ordinalBoundResolver,
  placeMayEscapeRoot,
  placeUses,
  platformIsDisjoint,
  profileFor,
  rawAccessFootprint,
  rawMaySelectHardwareRam,
  valueDefinitions,
} from "./aggregate-place-proof.js";
import type { AddressSpace } from "./aggregate-place-proof.js";
import type { StorageRange } from "../storage/storage-types.js";
import type { FixedLoopFacts } from "./fixed-loop-facts.js";
import type {
  CallOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticPlace,
  ValueId,
} from "./operations.js";
import { reachableBlocks } from "./value-lifetimes.js";
import type { SemanticPosition, WholeProgram } from "./whole-program.js";

/** Fixed packed aggregate type whose complete object identity may be retained. */
export type FixedObjectType = Extract<SemanticType, { readonly kind: "array" | "struct" }>;

/** A source object, not a concrete address or a promise of physical observability. */
export interface ClosedObjectOrigin {
  /** Whole source binding, with no member/index selection. */
  readonly place: SemanticPlace;
  /** Exact nominal or structural packed type of that binding. */
  readonly type: FixedObjectType;
  /** Owning source function for a private object, or null for resident program data. */
  readonly owner: BindingId | null;
}

/** One unchanged direct call, retained for later effect and publication proof. */
export interface ClosedObjectCall {
  /** Calling function or executable initializer identity. */
  readonly owner: BindingId;
  /** Actual operation object; identities cannot be reused after a source rewrite. */
  readonly operation: CallOperation;
  /** Exact call boundary in its source control-flow graph. */
  readonly position: SemanticPosition;
}

/** A unique whole-object origin shared by every admitted direct caller. */
export interface ClosedParameterObject {
  /** Unchanged callee object, retained as a stale-fact identity check. */
  readonly function: SemanticFunction;
  /** Borrowed aggregate parameter which resolves to the origin. */
  readonly parameter: BindingId;
  /** Same complete source object at every call. */
  readonly origin: ClosedObjectOrigin;
  /** Every direct entry which must retain this identity and source order. */
  readonly calls: readonly ClosedObjectCall[];
}

/** A unique caller destination; early construction is not proved by this identity alone. */
export interface ClosedResultObject {
  /** Unchanged aggregate-returning callee. */
  readonly function: SemanticFunction;
  /** Complete destination selected before all calls to this callee. */
  readonly origin: ClosedObjectOrigin;
  /** All direct callers, including forwarding through another caller destination. */
  readonly calls: readonly ClosedObjectCall[];
}

/** Source-associated observation retained until both reference and candidate placement close. */
export interface ClosedObjectObservation {
  /** Source function or initializer which owns this observation. */
  readonly owner: BindingId;
  /** Original operation, including its access order, width and source span. */
  readonly operation: SemanticOperation;
  /** Logical effect; an address can expose an identity even without reading its contents. */
  readonly access: "read" | "write" | "address" | "platform";
  /** Original number of touched bytes; platform effects retain their separate target contract. */
  readonly width: number;
  /** Complete logical footprint, never guessed physical private homes. */
  readonly target:
    | { readonly kind: "place"; readonly place: SemanticPlace; readonly withinRoot: boolean }
    | { readonly kind: "raw"; readonly ranges: readonly StorageRange[] | null }
    | { readonly kind: "platform"; readonly envelopeDisjoint: boolean };
}

/** Source maxima bound to this program, with any remaining loop observer premises retained. */
export interface ClosedObjectValueBounds {
  /** Program whose induction proof established every maximum. */
  readonly program: WholeProgram;
  /** Actual source-function objects prevent stale value IDs from crossing a rebuild. */
  readonly owners: ReadonlyMap<SemanticFunction, ReadonlyMap<ValueId, bigint>>;
  /** Conditional induction premises must reach final counter-home/visibility validation. */
  readonly observerLoops?: readonly FixedLoopFacts[];
}

/** Source-identity facts only; no pending observer or lifetime obligation is discharged here. */
export interface ClosedObjectFacts {
  /** Exact checked source program from which these facts were derived. */
  readonly program: WholeProgram;
  /** Parameter binding keys with one proved whole-object origin. */
  readonly parameters: ReadonlyMap<string, ClosedParameterObject>;
  /** Function binding keys with one possible caller-owned result destination. */
  readonly results: ReadonlyMap<string, ClosedResultObject>;
  /** Reachable direct calls in stable source/body order. */
  readonly calls: readonly ClosedObjectCall[];
  /** Complete source observations; final layout must still validate physical obligations. */
  readonly observations: readonly ClosedObjectObservation[];
  /** Parameter keys with no possible source/async write during the callee's execution. */
  readonly stableParameters: ReadonlySet<string>;
  /** Function keys with no source/async observation of early result construction. */
  readonly earlyResults: ReadonlySet<string>;
  /** No range-dependent rewrite is valid until these counter observer premises close. */
  readonly rangeObservers: readonly FixedLoopFacts[];
}

/** Finite roots grow monotonically; unknown is contagious and never guessed away. */
interface OriginState {
  readonly roots: Set<string>;
  unknown: boolean;
}

/** One source body whose value definitions are indexed exactly once. */
interface ObjectBody {
  readonly owner: BindingId;
  readonly function: SemanticFunction | null;
  readonly blocks: readonly SemanticBlock[];
  readonly definitions: ReadonlyMap<ValueId, SemanticOperation>;
}

/** Closed direct dependencies between parameter/result identities, not an alias relation. */
interface OriginEdge {
  readonly source: OriginState;
  readonly target: OriginState;
}

/** Accept fixed, nonempty packed types only; an unsized outer borrow is checked separately. */
function fixedObjectType(type: SemanticType): type is FixedObjectType {
  return (type.kind === "array" || type.kind === "struct") && type.size > 0;
}

/** Find origins through finite direct edges without a source-depth or iteration cutoff. */
function propagateOrigins(edges: readonly OriginEdge[]): void {
  const consumers = new Map<OriginState, Set<OriginState>>();
  for (const edge of edges) {
    const targets = consumers.get(edge.source) ?? new Set<OriginState>();
    targets.add(edge.target);
    consumers.set(edge.source, targets);
  }
  const pending = [...consumers.keys()].filter((state) => state.unknown || state.roots.size > 0);
  const queued = new Set(pending);
  for (let head = 0; head < pending.length; head += 1) {
    const source = pending[head]!;
    queued.delete(source);
    for (const target of consumers.get(source) ?? []) {
      let changed = false;
      if (source.unknown && !target.unknown) {
        target.unknown = true;
        changed = true;
      }
      for (const root of source.roots) {
        if (!target.roots.has(root)) {
          target.roots.add(root);
          changed = true;
        }
      }
      if (changed && !queued.has(target)) {
        pending.push(target);
        queued.add(target);
      }
    }
  }
}

/**
 * Close source effects conservatively while keeping all physical observer obligations.
 * Typed roots can be distinguished only after complete containment/borrow proof;
 * unknown raw addresses, indirect effects and persistent hardware selectors block
 * the affected rewrite instead of treating an absent interval as empty storage.
 */
function closeObjectObservations(
  facts: Pick<ClosedObjectFacts, "program" | "parameters" | "results">,
  bodies: readonly ObjectBody[],
  addressSpace: AddressSpace | undefined,
  valueBounds: ClosedObjectValueBounds | undefined,
): Pick<ClosedObjectFacts, "observations" | "stableParameters" | "earlyResults"> {
  const observations: ClosedObjectObservation[] = [];
  const profile = profileFor(addressSpace);
  const disjointPlatform = platformIsDisjoint(addressSpace, profile);
  let hardwareUnknown = false;
  const parameterKeys = new Set(
    bodies.flatMap(
      (body) =>
        body.function?.parameters.map((parameter) => bindingIdentityKey(parameter.id)) ?? [],
    ),
  );
  for (const body of bodies) {
    const literal = literalResolver(body.definitions);
    const ordinaryBound = ordinalBoundResolver(body.definitions, literal);
    const supplied = body.function === null ? undefined : valueBounds?.owners.get(body.function);
    const bound = (value: ValueId) => supplied?.get(value) ?? ordinaryBound(value);
    for (const block of body.blocks)
      for (const operation of block.operations) {
        for (const use of placeUses(operation))
          observations.push(
            Object.freeze({
              owner: body.owner,
              operation,
              access:
                operation.kind === "store" ||
                operation.kind === "aggregate" ||
                operation.kind === "call" ||
                operation.kind === "indirect-call"
                  ? "write"
                  : operation.kind === "place-address" && operation.captureValue !== true
                    ? "address"
                    : "read",
              width: use.width,
              target: Object.freeze({
                kind: "place",
                place: use.place,
                withinRoot: !placeMayEscapeRoot(use, bound),
              }),
            }),
          );
        if (operation.kind === "memory-read" || operation.kind === "memory-write") {
          const ranges = rawAccessFootprint(operation, body.definitions, literal, bound);
          observations.push(
            Object.freeze({
              owner: body.owner,
              operation,
              access: operation.kind === "memory-read" ? "read" : "write",
              width: operation.width,
              target: Object.freeze({ kind: "raw", ranges }),
            }),
          );
          if (operation.kind === "memory-write") {
            const exact = literal(operation.address);
            if (profile === undefined || ranges === null) hardwareUnknown = true;
            else {
              const { machine, cpu } = profile;
              const controls = [
                { start: cpu.portDirectionAddress, end: cpu.portDataAddress },
                { start: machine.spritePointerBase, end: machine.spritePointerBase + 7 },
                { start: machine.spritePositionBase, end: machine.spritePositionBase + 0x3ff },
                { start: machine.cia2Base, end: machine.cia2Base + 0xff },
              ];
              const ports = ranges.some(
                (range) =>
                  range.start <= cpu.portDataAddress && range.end >= cpu.portDirectionAddress,
              );
              const selectsRam =
                exact === undefined
                  ? ranges.some((range) =>
                      controls.some(
                        (control) => range.start <= control.end && range.end >= control.start,
                      ),
                    )
                  : rawMaySelectHardwareRam(exact, operation.width, profile);
              hardwareUnknown ||= ports || selectsRam;
            }
          }
        }
        if (operation.kind === "platform") {
          const envelopeDisjoint =
            FIXED_C64_CAPABILITIES.has(operation.capability) && disjointPlatform;
          observations.push(
            Object.freeze({
              owner: body.owner,
              operation,
              access: "platform",
              width: 0,
              target: Object.freeze({ kind: "platform", envelopeDisjoint }),
            }),
          );
          hardwareUnknown ||= !envelopeDisjoint;
        }
      }
  }
  const byOwner = new Map<string, ClosedObjectObservation[]>();
  for (const observation of observations) {
    const key = bindingIdentityKey(observation.owner);
    const list = byOwner.get(key) ?? [];
    list.push(observation);
    byOwner.set(key, list);
  }
  const children = new Map(
    facts.program.callGraph.map((node) => [
      bindingIdentityKey(node.function),
      node.callees.map(bindingIdentityKey),
    ]),
  );
  const asyncOwners = new Set(
    (facts.program.executionDomains ?? []).flatMap((entry) =>
      entry.domains.some((domain) => domain !== "main") ? [bindingIdentityKey(entry.function)] : [],
    ),
  );
  const asyncUnknown =
    facts.program.executionDomains === undefined &&
    (facts.program.interruptRoutes?.length ?? 0) > 0;
  const globals = new Map(
    facts.program.semantic.globals.map((global) => [bindingIdentityKey(global.id), global]),
  );

  /** Unknown private placement is its permitted envelope, not address zero or an empty set. */
  function originRanges(origin: ClosedObjectOrigin): readonly StorageRange[] | undefined {
    const at = globals.get(bindingIdentityKey(origin.place.root))?.placement?.at;
    if (
      at !== undefined &&
      at !== null &&
      Number.isInteger(at) &&
      at >= 0 &&
      at + origin.type.size <= 0x10000
    )
      return [{ start: at, end: at + origin.type.size - 1 }];
    return addressSpace === undefined ? undefined : [...addressSpace.ram, ...addressSpace.zeroPage];
  }

  /** Test a source observation against one whole binding without assuming readonly means stable. */
  function mayObserve(origin: ClosedObjectOrigin, observation: ClosedObjectObservation): boolean {
    const target = observation.target;
    if (target.kind === "platform") return !target.envelopeDisjoint;
    if (target.kind === "raw") {
      const permitted = originRanges(origin);
      return (
        target.ranges === null ||
        permitted === undefined ||
        target.ranges.some((range) =>
          permitted.some((home) => range.start <= home.end && range.end >= home.start),
        )
      );
    }
    if (!target.withinRoot) return true;
    const key = bindingIdentityKey(target.place.root);
    const actual = parameterKeys.has(key)
      ? facts.parameters.get(key)?.origin.place.root
      : target.place.root;
    return (
      actual === undefined || bindingIdentityKey(actual) === bindingIdentityKey(origin.place.root)
    );
  }

  /** Include the full direct/closed-indirect subtree and every possible source preemption domain. */
  function sourceSafe(
    fn: SemanticFunction,
    origin: ClosedObjectOrigin,
    writesOnly: boolean,
  ): boolean {
    if (hardwareUnknown || asyncUnknown) return false;
    const pending = [bindingIdentityKey(fn.id), ...asyncOwners];
    const reached = new Set<string>();
    for (let head = 0; head < pending.length; head += 1) {
      const owner = pending[head]!;
      if (reached.has(owner)) continue;
      reached.add(owner);
      for (const observation of byOwner.get(owner) ?? []) {
        if (writesOnly && observation.access !== "write" && observation.access !== "platform")
          continue;
        if (mayObserve(origin, observation)) return false;
      }
      pending.push(...(children.get(owner) ?? []));
    }
    return true;
  }
  return {
    observations: Object.freeze(observations),
    stableParameters: new Set(
      [...facts.parameters]
        .filter(([, fact]) => sourceSafe(fact.function, fact.origin, true))
        .map(([key]) => key),
    ),
    earlyResults: new Set(
      [...facts.results]
        .filter(([, fact]) => sourceSafe(fact.function, fact.origin, false))
        .map(([key]) => key),
    ),
  };
}

/**
 * Derive whole-object origins from unchanged direct calls and result destinations.
 * A unique identity is not permission to reload a captured value, construct early,
 * remove a home or choose an absolute indexed bus access. Those require separate
 * effects, lifetime and final-layout proofs. Missing facts retain ordinary lowering.
 * @param program Checked closed source, before optional storage or machine selection.
 * @param addressSpace Existing permitted storage envelope and selected profile identity.
 * @param valueBounds Source maxima and retained induction premises; an omitted fact remains unknown.
 * @returns Immutable source-associated parameter/result facts and their actual calls.
 * @throws {Error} If supplied bounds do not belong to the current source program and functions.
 */
export function deriveClosedObjectFacts(
  program: WholeProgram,
  addressSpace?: AddressSpace,
  valueBounds?: ClosedObjectValueBounds,
): ClosedObjectFacts {
  if (
    valueBounds !== undefined &&
    (valueBounds.program !== program ||
      [...valueBounds.owners.keys()].some((fn) => !program.semantic.functions.includes(fn)) ||
      valueBounds.observerLoops?.some(
        (loop) => loop.program !== program || !program.semantic.functions.includes(loop.function),
      ))
  )
    throw new Error("Object bounds do not belong to the checked source program");
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  const functions = program.semantic.functions.filter((fn) =>
    reached.has(bindingIdentityKey(fn.id)),
  );
  const byFunction = new Map(functions.map((fn) => [bindingIdentityKey(fn.id), fn]));
  const globals = new Map(
    program.semantic.globals.map((global) => [bindingIdentityKey(global.id), global]),
  );
  const excluded = new Set(
    program.roots.flatMap((root) =>
      root.kind === "main" || root.kind === "callable" || root.kind === "interrupt"
        ? [bindingIdentityKey(root.function)]
        : [],
    ),
  );
  const bodies: ObjectBody[] = [];
  for (const fn of functions) {
    const blocks = reachableBlocks(fn.entry, fn.blocks);
    bodies.push({ owner: fn.id, function: fn, blocks, definitions: valueDefinitions(blocks) });
  }
  for (const global of program.semantic.globals) {
    if (global.entry === null) continue;
    const blocks = reachableBlocks(global.entry, global.blocks);
    bodies.push({
      owner: global.id,
      function: null,
      blocks,
      definitions: valueDefinitions(blocks),
    });
  }
  for (const body of bodies)
    for (const block of body.blocks)
      for (const operation of block.operations) {
        if (operation.kind === "function-address")
          excluded.add(bindingIdentityKey(operation.function));
        if (operation.kind === "indirect-call")
          for (const target of program.indirectTargets?.get(operation) ?? [])
            excluded.add(bindingIdentityKey(target));
      }
  const parameterStates = new Map<string, OriginState>();
  const resultStates = new Map<string, OriginState>();
  for (const fn of functions) {
    const unknown = excluded.has(bindingIdentityKey(fn.id)) || fn.entryKind === "interrupt";
    for (const parameter of fn.parameters)
      if (fixedObjectType(parameter.type))
        parameterStates.set(bindingIdentityKey(parameter.id), {
          roots: new Set(),
          unknown: unknown || parameter.outerUnsized === true,
        });
    if (fixedObjectType(fn.result))
      resultStates.set(bindingIdentityKey(fn.id), { roots: new Set(), unknown });
  }
  const unknown: OriginState = { roots: new Set(), unknown: true };
  const origins = new Map<string, ClosedObjectOrigin>();
  const concreteStates = new Map<string, OriginState>();

  /** Retain only a complete binding; members and unknown borrowed extents stay generic. */
  function placeOrigin(place: SemanticPlace, type: SemanticType, body: ObjectBody): OriginState {
    if (
      !fixedObjectType(type) ||
      place.asset !== undefined ||
      place.path.length !== 0 ||
      place.rootType === undefined ||
      !semanticTypesEqual(place.rootType, type)
    )
      return unknown;
    const key = bindingIdentityKey(place.root);
    if (body.function?.parameters.some((parameter) => bindingIdentityKey(parameter.id) === key))
      return parameterStates.get(key) ?? unknown;
    const global = globals.get(key);
    if (global !== undefined && !semanticTypesEqual(global.type, type)) return unknown;
    const existing = concreteStates.get(key);
    if (existing !== undefined) {
      const origin = origins.get(key)!;
      return semanticTypesEqual(origin.type, type) ? existing : unknown;
    }
    origins.set(
      key,
      Object.freeze({
        place: Object.freeze({ root: place.root, rootType: type, path: Object.freeze([]) }),
        type,
        owner: global === undefined ? body.owner : null,
      }),
    );
    const state: OriginState = { roots: new Set([key]), unknown: false };
    concreteStates.set(key, state);
    return state;
  }

  /** Follow only identity conversions and uncaptured whole-place addresses. */
  function valueOrigin(value: ValueId, type: SemanticType, body: ObjectBody): OriginState {
    const seen = new Set<ValueId>();
    let cursor = value;
    while (!seen.has(cursor)) {
      seen.add(cursor);
      const operation = body.definitions.get(cursor);
      if (
        operation?.kind === "place-address" &&
        operation.captureValue !== true &&
        semanticTypesEqual(operation.type, type)
      )
        return placeOrigin(operation.place, type, body);
      if (
        operation?.kind !== "convert" ||
        operation.conversion !== "identity" ||
        !semanticTypesEqual(operation.type, type)
      )
        return unknown;
      cursor = operation.operand;
    }
    return unknown;
  }

  const calls: ClosedObjectCall[] = [];
  const byCallee = new Map<string, ClosedObjectCall[]>();
  const edges: OriginEdge[] = [];
  for (const body of bodies)
    for (const block of body.blocks) {
      for (const [index, operation] of block.operations.entries()) {
        if (operation.kind !== "call") continue;
        const call: ClosedObjectCall = Object.freeze({
          owner: body.owner,
          operation,
          position: Object.freeze({ block: block.id, operation: index }),
        });
        calls.push(call);
        const key = bindingIdentityKey(operation.callee);
        const sites = byCallee.get(key) ?? [];
        sites.push(call);
        byCallee.set(key, sites);
        const fn = byFunction.get(key);
        if (fn === undefined) continue;
        for (const [parameterIndex, parameter] of fn.parameters.entries()) {
          const target = parameterStates.get(bindingIdentityKey(parameter.id));
          if (target === undefined) continue;
          const value = operation.arguments[parameterIndex];
          edges.push({
            target,
            source: value === undefined ? unknown : valueOrigin(value, parameter.type, body),
          });
        }
        const target = resultStates.get(key);
        if (target === undefined) continue;
        const destination = operation.aggregateDestination;
        const source =
          destination?.kind === "place"
            ? placeOrigin(destination.place, fn.result, body)
            : destination?.kind === "caller" &&
                body.function !== null &&
                semanticTypesEqual(body.function.result, fn.result)
              ? (resultStates.get(bindingIdentityKey(body.function.id)) ?? unknown)
              : unknown;
        edges.push({ source, target });
      }
    }
  propagateOrigins(edges);

  /** A unique root is useful only if at least one actual closed entry supplied it. */
  function uniqueOrigin(state: OriginState | undefined): ClosedObjectOrigin | undefined {
    if (state === undefined || state.unknown || state.roots.size !== 1) return undefined;
    const key = state.roots.values().next().value;
    return key === undefined ? undefined : origins.get(key);
  }
  const parameters = new Map<string, ClosedParameterObject>();
  const results = new Map<string, ClosedResultObject>();
  for (const fn of functions) {
    const key = bindingIdentityKey(fn.id);
    const sites = Object.freeze(byCallee.get(key) ?? []);
    if (sites.length === 0 || excluded.has(key) || fn.entryKind === "interrupt") continue;
    for (const parameter of fn.parameters) {
      const origin = uniqueOrigin(parameterStates.get(bindingIdentityKey(parameter.id)));
      if (origin !== undefined)
        parameters.set(
          bindingIdentityKey(parameter.id),
          Object.freeze({
            function: fn,
            parameter: parameter.id,
            origin,
            calls: sites,
          }),
        );
    }
    const origin = uniqueOrigin(resultStates.get(key));
    if (origin !== undefined)
      results.set(key, Object.freeze({ function: fn, origin, calls: sites }));
  }
  return Object.freeze({
    program,
    parameters,
    results,
    calls: Object.freeze(calls),
    rangeObservers: Object.freeze([...(valueBounds?.observerLoops ?? [])]),
    ...closeObjectObservations({ program, parameters, results }, bodies, addressSpace, valueBounds),
  });
}
