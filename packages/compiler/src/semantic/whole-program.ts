import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type {
  InterruptProfileFacts,
  InterruptSinkFacts,
  InterruptVariantFacts,
} from "../target/profile.js";
import { semanticTypeName } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, EffectSummary, FunctionType } from "../frontend/semantic-types.js";
import type {
  BlockId,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticProgram,
  ValueId,
} from "./operations.js";
import {
  resolveTargetSets,
  type HandlerTargetSets,
  type IndirectTargetSets,
} from "./function-targets.js";
import { checkInterruptOwnership, type InterruptOwnershipAnalysis } from "./interrupt-ownership.js";
import { analyzeInterruptDomains, type FunctionDomains } from "./interrupt-domains.js";

/** One whole-program entry source. */
export type ProgramRoot =
  | { readonly kind: "startup" }
  | { readonly kind: "initializer"; readonly binding: BindingId }
  | { readonly kind: "main"; readonly function: BindingId }
  | { readonly kind: "callable"; readonly function: BindingId }
  | {
      readonly kind: "interrupt";
      readonly function: BindingId;
      readonly variant: string;
      readonly domain: "irq" | "nmi";
    };

/** One reachable handler/entry-variant pair selected by a typed sink. */
export interface InterruptRoute {
  /** Source callback-only handler. */
  readonly handler: BindingId;
  /** Typed platform sink selecting this route. */
  readonly sink: InterruptSinkFacts;
  /** Exact selected entry and terminal contract. */
  readonly variant: InterruptVariantFacts;
  /** Platform operation whose retained handler value selected this route. */
  readonly installation: Extract<SemanticOperation, { readonly kind: "platform" }>;
}

/** Closed direct-call edges for one reachable source function. */
export interface CallGraphNode {
  /** Calling source function. */
  readonly function: BindingId;
  /** Distinct direct callees in semantic identity order. */
  readonly callees: readonly BindingId[];
}

/** Executable global-initializer facts retained for storage and stack proof. */
export interface InitializerExecution {
  /** Global binding whose initializer owns this execution context. */
  readonly binding: BindingId;
  /** Distinct direct callees in semantic identity order. */
  readonly callees: readonly BindingId[];
  /** Exact initializer-local value lifetimes. */
  readonly lifetimes: readonly ValueLifetime[];
}

/** Frontend-proved transitive behavior retained for one reachable function. */
export type WholeProgramEffect = EffectSummary;

/** Exact position of an operation or block terminator in semantic control flow. */
export interface SemanticPosition {
  /** Owning basic block. */
  readonly block: BlockId;
  /** Operation index; the block terminator is one past the final operation. */
  readonly operation: number;
}

/** Exact value lifetime consumed by later static storage planning. */
export interface ValueLifetime {
  /** Function which owns the value. */
  readonly function: BindingId;
  /** Function-local semantic value identity. */
  readonly value: ValueId;
  /** Defining operation. */
  readonly definition: SemanticPosition;
  /** Operation boundaries at which the value is live. */
  readonly liveAt: readonly SemanticPosition[];
  /** Calls which execute while the value remains live. */
  readonly callsCrossed: readonly SourceSpan[];
}

/** Complete closed target-neutral program admitted for storage planning. */
export interface WholeProgram {
  /** Original semantic program. */
  readonly semantic: SemanticProgram;
  /** Startup, ordered initializer, main, and independently callable roots. */
  readonly roots: readonly ProgramRoot[];
  /** Direct call graph for reachable functions. */
  readonly callGraph: readonly CallGraphNode[];
  /** Closed source-function candidates for each typed indirect call. */
  readonly indirectTargets?: IndirectTargetSets;
  /** Reachable typed handler routes; no runtime dispatch table is implied. */
  readonly interruptRoutes?: readonly InterruptRoute[];
  /** Maximum live predecessor words proved by the install/restore analysis. */
  readonly interruptOwnership?: InterruptOwnershipAnalysis;
  /** Entry domains that can overlap while entering each source function. */
  readonly executionDomains?: readonly FunctionDomains[];
  /** Non-fatal shared-state warnings found during whole-program closure. */
  readonly diagnostics?: readonly ProjectDiagnostic[];
  /** Ordered executable initializer contexts, when retained by whole-program closure. */
  readonly initializers?: readonly InitializerExecution[];
  /** Transitive effects for reachable functions. */
  readonly effects: readonly WholeProgramEffect[];
  /** Function-local value lifetimes. */
  readonly lifetimes: readonly ValueLifetime[];
  /** Reachable source functions in semantic identity order. */
  readonly reachableFunctions: readonly BindingId[];
  /** Reachable immutable assets in semantic asset order. */
  readonly reachableAssets: readonly string[];
}

/** Whole-program closure or terminal proving diagnostics. */
export type WholeProgramResult =
  | { readonly kind: "complete"; readonly program: WholeProgram }
  | { readonly kind: "error"; readonly diagnostics: readonly ProjectDiagnostic[] };

/** Compare source identities without locale-sensitive ordering. */
function compareBindings(left: BindingId, right: BindingId): number {
  return (
    Buffer.compare(Buffer.from(left.sourceId), Buffer.from(right.sourceId)) ||
    left.span.start - right.span.start ||
    left.span.end - right.span.end
  );
}

/** Return blocks reachable through explicit semantic terminators. */
function reachableBlocks(
  entry: BlockId,
  blocks: readonly SemanticBlock[],
): readonly SemanticBlock[] {
  const byId = new Map(blocks.map((block) => [block.id, block] as const));
  const reached = new Set<BlockId>();
  const pending: BlockId[] = [entry];
  while (pending.length > 0) {
    const id = pending.shift()!;
    if (reached.has(id)) continue;
    const block = byId.get(id);
    if (block === undefined) throw new Error(`Semantic CFG references missing block '${id}'`);
    reached.add(id);
    if (block.terminator.kind === "jump") pending.push(block.terminator.target);
    else if (block.terminator.kind === "branch") {
      pending.push(block.terminator.whenTrue, block.terminator.whenFalse);
    }
  }
  return Object.freeze(blocks.filter(({ id }) => reached.has(id)));
}

/** Only edge facts needed after direct and indirect calls are closed. */
interface CallEdge {
  readonly callee: BindingId;
  readonly span: SourceSpan;
  readonly targetDisplay?: string;
  readonly signature?: FunctionType;
}

/** Explain the exact source expression and callable type that could not be proved. */
function unresolvedCallDiagnostic(call: CallEdge): ProjectDiagnostic {
  return projectDiagnostic(
    "E10277",
    `Cannot prove a finite source-function target set for call through '${call.targetDisplay ?? "<unknown>"}' of type '${call.signature === undefined ? "<unknown>" : semanticTypeName(call.signature)}' — keep the value within closed-program typed storage`,
    call.span,
  );
}

/** Return direct call operations from a block list in stable block/operation order. */
function callsIn(
  blocks: readonly SemanticBlock[],
  indirectTargets: IndirectTargetSets,
): readonly CallEdge[] {
  return Object.freeze(
    blocks.flatMap((block) =>
      block.operations.flatMap((operation): readonly CallEdge[] => {
        if (operation.kind === "call") return [operation];
        if (operation.kind !== "indirect-call") return [];
        const targets = indirectTargets.get(operation) ?? [];
        const candidates =
          targets.length > 0
            ? targets
            : [Object.freeze({ sourceId: "unresolved-indirect", span: operation.span })];
        return candidates.map((callee) =>
          Object.freeze({ ...operation, kind: "call" as const, callee }),
        );
      }),
    ),
  );
}

/** Build one finite direct-edge list for every semantic function. */
function functionCalls(
  functions: readonly SemanticFunction[],
  indirectTargets: IndirectTargetSets,
): ReadonlyMap<string, readonly CallEdge[]> {
  return new Map(
    functions.map((fn) => [
      bindingIdentityKey(fn.id),
      callsIn(reachableBlocks(fn.entry, fn.blocks), indirectTargets),
    ]),
  );
}

/** Keep externally visible and address-taken source functions as independent entries. */
function callableRoots(
  semantic: SemanticProgram,
  functions: readonly SemanticFunction[],
): readonly BindingId[] {
  const known = new Map(functions.map((fn) => [bindingIdentityKey(fn.id), fn.id] as const));
  const roots = new Map<string, BindingId>();
  for (const fn of functions) {
    if (fn.exported && fn.entryKind !== "interrupt") roots.set(bindingIdentityKey(fn.id), fn.id);
  }
  for (const owner of [...functions, ...semantic.globals]) {
    for (const block of owner.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "function-address") continue;
        const key = bindingIdentityKey(operation.function);
        const target = known.get(key);
        if (
          target !== undefined &&
          functions.find((fn) => bindingIdentityKey(fn.id) === key)?.entryKind !== "interrupt"
        )
          roots.set(key, target);
      }
    }
  }
  return Object.freeze([...roots.values()].sort(compareBindings));
}

/** Keep a raw handler address alive when reachable code explicitly materializes it. */
function addressedInterruptHandlers(
  semantic: SemanticProgram,
  functions: readonly SemanticFunction[],
  reached: ReadonlySet<string>,
): readonly BindingId[] {
  const handlers = new Map(
    functions
      .filter((fn) => fn.entryKind === "interrupt")
      .map((fn) => [bindingIdentityKey(fn.id), fn.id] as const),
  );
  const selected = new Map<string, BindingId>();
  const owners = [
    ...functions.filter((fn) => reached.has(bindingIdentityKey(fn.id))),
    ...semantic.globals.filter((global) =>
      semantic.initializerOrder.some(
        (id) => bindingIdentityKey(id) === bindingIdentityKey(global.id),
      ),
    ),
  ];
  for (const owner of owners) {
    for (const block of owner.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "function-address") continue;
        const key = bindingIdentityKey(operation.function);
        const handler = handlers.get(key);
        if (handler !== undefined) selected.set(key, handler);
      }
    }
  }
  return Object.freeze([...selected.values()].sort(compareBindings));
}

/** Reachable function identities plus unknown edges encountered from program roots. */
interface ReachabilityResult {
  readonly functions: ReadonlySet<string>;
  readonly diagnostics: readonly ProjectDiagnostic[];
}

/** Close roots while rejecting only unknown call edges that can execute. */
function closeReachableFunctions(
  semantic: SemanticProgram,
  functions: readonly SemanticFunction[],
  calls: ReadonlyMap<string, readonly CallEdge[]>,
  indirectTargets: IndirectTargetSets,
  callable: readonly BindingId[],
): ReachabilityResult {
  const known = new Map(functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const));
  const diagnostics: ProjectDiagnostic[] = [];
  if (!known.has(bindingIdentityKey(semantic.main))) {
    throw new Error("Selected main root does not resolve to a semantic function");
  }
  const globals = new Map(
    semantic.globals.map((global) => [bindingIdentityKey(global.id), global]),
  );
  const pending: BindingId[] = [semantic.main, ...callable];
  for (const initializer of semantic.initializerOrder) {
    const global = globals.get(bindingIdentityKey(initializer));
    if (global === undefined || global.entry === null) {
      throw new Error("Initializer root does not resolve to executable semantic control flow");
    }
    for (const call of callsIn(reachableBlocks(global.entry, global.blocks), indirectTargets)) {
      if (!known.has(bindingIdentityKey(call.callee))) {
        diagnostics.push(unresolvedCallDiagnostic(call));
      } else {
        pending.push(call.callee);
      }
    }
  }

  const reached = new Set<string>();
  while (pending.length > 0) {
    const functionId = pending.shift()!;
    const key = bindingIdentityKey(functionId);
    if (reached.has(key)) continue;
    if (!known.has(key)) throw new Error("A root references a missing semantic function");
    reached.add(key);
    for (const call of calls.get(key) ?? []) {
      if (!known.has(bindingIdentityKey(call.callee))) {
        diagnostics.push(unresolvedCallDiagnostic(call));
      } else {
        pending.push(call.callee);
      }
    }
  }
  return Object.freeze({ functions: reached, diagnostics: Object.freeze(diagnostics) });
}

/** Select only handlers installed by reachable source paths. */
function reachableInterruptRoutes(
  semantic: SemanticProgram,
  reached: ReadonlySet<string>,
  targets: HandlerTargetSets,
  profile: InterruptProfileFacts | undefined,
): {
  readonly routes: readonly InterruptRoute[];
  readonly diagnostics: readonly ProjectDiagnostic[];
} {
  if (profile === undefined) return { routes: [], diagnostics: [] };
  const sinks = new Map(profile.sinks.map((sink) => [sink.capability, sink] as const));
  const variants = new Map(profile.variants.map((variant) => [variant.id, variant] as const));
  const functions = new Map(
    semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const globals = new Map(
    semantic.globals.map((global) => [bindingIdentityKey(global.id), global] as const),
  );
  const owners = [
    ...semantic.functions.filter((fn) => reached.has(bindingIdentityKey(fn.id))),
    ...semantic.initializerOrder.flatMap((id) => {
      const global = globals.get(bindingIdentityKey(id));
      return global === undefined ? [] : [global];
    }),
  ];
  const routes = new Map<string, InterruptRoute>();
  const diagnostics: ProjectDiagnostic[] = [];
  for (const owner of owners) {
    if (owner.entry === null) continue;
    for (const block of reachableBlocks(owner.entry, owner.blocks)) {
      for (const operation of block.operations) {
        if (operation.kind !== "platform") continue;
        const sink = sinks.get(operation.capability);
        if (sink === undefined) continue;
        if (!sink.masksSelfOnEntry && sink.externalReentryBound === "unbounded") {
          diagnostics.push(
            projectDiagnostic(
              "E10245",
              `Interrupt source '${sink.source}' can re-enter without a finite stack bound on the selected profile`,
              operation.span,
            ),
          );
          continue;
        }
        const handlers = targets.get(operation) ?? [];
        if (handlers.length === 0) {
          diagnostics.push(
            projectDiagnostic(
              "E10247",
              `Cannot prove the entry ABI of the value passed to function-address sink '${sink.capability}' — pass a provenance-preserving handler address`,
              operation.span,
            ),
          );
          continue;
        }
        for (const handler of handlers) {
          const fn = functions.get(bindingIdentityKey(handler));
          if (fn?.entryKind !== "interrupt") {
            diagnostics.push(
              projectDiagnostic(
                "E10244",
                `Ordinary function cannot be installed in interrupt-handler sink '${sink.capability}' — use an interrupt function`,
                operation.span,
              ),
            );
            continue;
          }
          routes.set(
            `${bindingIdentityKey(handler)}\0${sink.variant}\0${operation.span.sourceId}:${operation.span.start}`,
            Object.freeze({
              handler,
              sink,
              variant: variants.get(sink.variant)!,
              installation: operation,
            }),
          );
        }
      }
    }
  }
  return Object.freeze({
    routes: Object.freeze([...routes.values()]),
    diagnostics: Object.freeze(diagnostics),
  });
}

/** Find the first direct or indirect recursion cycle in stable semantic order. */
function recursionDiagnostic(
  functions: readonly SemanticFunction[],
  calls: ReadonlyMap<string, readonly CallEdge[]>,
): ProjectDiagnostic | null {
  for (const fn of functions) {
    const self = (calls.get(bindingIdentityKey(fn.id)) ?? []).find(
      (call) => bindingIdentityKey(call.callee) === bindingIdentityKey(fn.id),
    );
    if (self !== undefined) {
      return projectDiagnostic(
        "E10180",
        `Direct recursion — function '${fn.name ?? "<function>"}' calls itself; use iteration or an explicit fixed-capacity work structure`,
        self.span,
      );
    }
  }

  const state = new Map<string, "visiting" | "done">();
  const stack: { readonly key: string; readonly via: SourceSpan | null }[] = [];
  const byKey = new Map(functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const));
  const visit = (key: string, via: SourceSpan | null): ProjectDiagnostic | null => {
    const activeIndex = stack.findIndex((item) => item.key === key);
    if (activeIndex >= 0) {
      const cycle = [...stack.slice(activeIndex), { key, via }];
      const spans = cycle.slice(1).flatMap((item) => (item.via === null ? [] : [item.via]));
      const names = cycle.map(
        ({ key: item }) => byKey.get(item)?.name?.split(".").at(-1) ?? "<function>",
      );
      return Object.freeze({
        ...projectDiagnostic(
          "E10181",
          `Indirect recursion detected — cycle: ${names.join(" → ")}`,
          spans[0] ?? byKey.get(key)?.source ?? null,
        ),
        related: Object.freeze(
          spans.map((span) => Object.freeze({ span, message: "Call edge in recursive cycle" })),
        ),
      });
    }
    if (state.get(key) === "done") return null;
    state.set(key, "visiting");
    stack.push({ key, via });
    for (const call of calls.get(key) ?? []) {
      const diagnostic = visit(bindingIdentityKey(call.callee), call.span);
      if (diagnostic !== null) return diagnostic;
    }
    stack.pop();
    state.set(key, "done");
    return null;
  };
  for (const fn of functions) {
    const diagnostic = visit(bindingIdentityKey(fn.id), null);
    if (diagnostic !== null) return diagnostic;
  }
  return null;
}

/** Build the reachable direct graph in semantic identity order. */
function closeCallGraph(
  functions: readonly SemanticFunction[],
  calls: ReadonlyMap<string, readonly CallEdge[]>,
  reachable: ReadonlySet<string>,
): readonly CallGraphNode[] {
  return Object.freeze(
    functions
      .filter((fn) => reachable.has(bindingIdentityKey(fn.id)))
      .map((fn) => {
        const unique = new Map<string, BindingId>();
        for (const call of calls.get(bindingIdentityKey(fn.id)) ?? []) {
          unique.set(bindingIdentityKey(call.callee), call.callee);
        }
        return Object.freeze({
          function: fn.id,
          callees: Object.freeze([...unique.values()].sort(compareBindings)),
        });
      }),
  );
}

/** Retain the frontend's proved transitive effects for reachable functions only. */
function closeEffects(
  functions: readonly SemanticFunction[],
  effects: readonly EffectSummary[],
  reachable: ReadonlySet<string>,
): readonly WholeProgramEffect[] {
  const byFunction = new Map(
    effects.map((effect) => [bindingIdentityKey(effect.function), effect] as const),
  );
  return Object.freeze(
    functions.flatMap((fn) => {
      if (!reachable.has(bindingIdentityKey(fn.id))) return [];
      const effect = byFunction.get(bindingIdentityKey(fn.id));
      if (effect !== undefined) return [effect];
      const hasUnprovedEffect = reachableBlocks(fn.entry, fn.blocks).some((block) =>
        block.operations.some((operation) =>
          ["call", "load", "store", "memory-read", "memory-write", "platform"].includes(
            operation.kind,
          ),
        ),
      );
      if (hasUnprovedEffect) {
        throw new Error("Reachable semantic effects are missing their frontend proof");
      }
      return [
        Object.freeze({
          function: fn.id,
          reads: Object.freeze([]),
          writes: Object.freeze([]),
          operationEffects: Object.freeze([]),
          opaque: false,
        }),
      ];
    }),
  );
}

/** Return the value defined by an operation, when it defines one. */
function operationResult(operation: SemanticOperation): ValueId | null {
  return "result" in operation ? operation.result : null;
}

/** Return every existing value used by one operation. */
function operationUses(operation: SemanticOperation): readonly ValueId[] {
  switch (operation.kind) {
    case "convert":
    case "unary":
      return [operation.operand];
    case "binary":
    case "bcd":
      return [operation.left, operation.right];
    case "store":
      return [
        operation.value,
        ...operation.place.path.flatMap((part) => (part.kind === "index" ? [part.value] : [])),
      ];
    case "load":
    case "place-address":
      return operation.place.path.flatMap((part) => (part.kind === "index" ? [part.value] : []));
    case "call":
    case "platform":
      return operation.arguments;
    case "indirect-call":
      return [operation.target, ...operation.arguments];
    case "memory-read":
      return [operation.address];
    case "memory-write":
      return [operation.address, operation.value];
    case "aggregate":
      return [
        ...operation.elements.map(({ value }) => value),
        ...(operation.fill === null ? [] : [operation.fill]),
      ];
    case "merge":
      return [];
    default:
      return [];
  }
}

/** Return the values consumed by a block terminator. */
function terminatorUses(block: SemanticBlock): readonly ValueId[] {
  if (block.terminator.kind === "branch") return [block.terminator.condition];
  if (block.terminator.kind === "return" && block.terminator.value !== null) {
    return [block.terminator.value];
  }
  return [];
}

/** Return the successors selected by one terminator. */
function successors(block: SemanticBlock): readonly BlockId[] {
  if (block.terminator.kind === "jump") return [block.terminator.target];
  if (block.terminator.kind === "branch") {
    return [block.terminator.whenTrue, block.terminator.whenFalse];
  }
  return [];
}

/** Compare two value sets without depending on insertion order. */
function sameValues(left: ReadonlySet<ValueId>, right: ReadonlySet<ValueId>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/** Compute exact CFG liveness without imposing a false linear block order. */
function valueLifetimes(
  fn: Pick<SemanticFunction, "id" | "entry" | "blocks">,
): readonly ValueLifetime[] {
  const blocks = reachableBlocks(fn.entry, fn.blocks);
  const definitions = new Map<ValueId, SemanticPosition>();
  const definitionsByBlock = new Map<BlockId, ReadonlySet<ValueId>>();
  const usesByBlock = new Map<BlockId, ReadonlySet<ValueId>>();
  const mergeUses = new Map<string, ReadonlySet<ValueId>>();

  for (const block of blocks) {
    const defined = new Set<ValueId>();
    const usedBeforeDefinition = new Set<ValueId>();
    block.operations.forEach((op, operation) => {
      const result = operationResult(op);
      if (result !== null) {
        defined.add(result);
        definitions.set(result, Object.freeze({ block: block.id, operation }));
      }
      for (const value of operationUses(op)) {
        if (!defined.has(value)) usedBeforeDefinition.add(value);
      }
      if (op.kind === "merge") {
        for (const incoming of op.incoming) {
          const key = `${incoming.block}\0${block.id}`;
          mergeUses.set(key, new Set([...(mergeUses.get(key) ?? []), incoming.value]));
        }
      }
    });
    for (const value of terminatorUses(block)) {
      if (!defined.has(value)) usedBeforeDefinition.add(value);
    }
    definitionsByBlock.set(block.id, defined);
    usesByBlock.set(block.id, usedBeforeDefinition);
  }

  const liveIn = new Map(blocks.map(({ id }) => [id, new Set<ValueId>()] as const));
  const liveOut = new Map(blocks.map(({ id }) => [id, new Set<ValueId>()] as const));
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of [...blocks].reverse()) {
      const nextOut = new Set<ValueId>();
      for (const successor of successors(block)) {
        const successorLive = liveIn.get(successor);
        if (successorLive === undefined) {
          throw new Error(`Semantic CFG references missing block '${successor}'`);
        }
        const successorDefinitions = definitionsByBlock.get(successor) ?? new Set<ValueId>();
        for (const value of successorLive) {
          if (!successorDefinitions.has(value)) nextOut.add(value);
        }
        for (const value of mergeUses.get(`${block.id}\0${successor}`) ?? []) {
          nextOut.add(value);
        }
      }
      const nextIn = new Set(usesByBlock.get(block.id) ?? []);
      const localDefinitions = definitionsByBlock.get(block.id) ?? new Set<ValueId>();
      for (const value of nextOut) {
        if (!localDefinitions.has(value)) nextIn.add(value);
      }
      if (!sameValues(liveOut.get(block.id)!, nextOut)) {
        liveOut.set(block.id, nextOut);
        changed = true;
      }
      if (!sameValues(liveIn.get(block.id)!, nextIn)) {
        liveIn.set(block.id, nextIn);
        changed = true;
      }
    }
  }

  const positions = new Map<ValueId, Map<string, SemanticPosition>>();
  const calls = new Map<ValueId, SourceSpan[]>();
  const addPosition = (value: ValueId, block: BlockId, operation: number): void => {
    const position = Object.freeze({ block, operation });
    const byKey = positions.get(value) ?? new Map<string, SemanticPosition>();
    byKey.set(`${block}\0${operation}`, position);
    positions.set(value, byKey);
  };
  for (const [value, definition] of definitions) {
    addPosition(value, definition.block, definition.operation);
  }
  for (const block of blocks) {
    let live = new Set(liveOut.get(block.id) ?? []);
    for (const value of terminatorUses(block)) live.add(value);
    for (const value of live) addPosition(value, block.id, block.operations.length);
    for (let index = block.operations.length - 1; index >= 0; index -= 1) {
      const operation = block.operations[index]!;
      const after = new Set(live);
      const result = operationResult(operation);
      if (result !== null) live.delete(result);
      for (const value of operationUses(operation)) live.add(value);
      if (operation.kind === "call" || operation.kind === "indirect-call") {
        for (const value of live) {
          if (!after.has(value)) continue;
          const crossed = calls.get(value) ?? [];
          crossed.push(operation.span);
          calls.set(value, crossed);
        }
      }
      for (const value of live) addPosition(value, block.id, index);
    }
  }

  return Object.freeze(
    [...definitions].map(([value, definition]) =>
      Object.freeze({
        function: fn.id,
        value,
        definition,
        liveAt: Object.freeze([...(positions.get(value)?.values() ?? [])]),
        callsCrossed: Object.freeze(calls.get(value) ?? []),
      }),
    ),
  );
}

/** Return the global place root referenced by an operation, when present. */
function operationPlaceRoot(operation: SemanticOperation): BindingId | null {
  if (
    operation.kind === "load" ||
    operation.kind === "store" ||
    operation.kind === "place-address"
  ) {
    return operation.place.root;
  }
  return null;
}

/** Close assets through reachable operations and the global values they reference. */
function reachableAssetIds(
  semantic: SemanticProgram,
  functions: readonly SemanticFunction[],
  reachable: ReadonlySet<string>,
): ReadonlySet<string> {
  const assets = new Set<string>();
  const globals = new Map(
    semantic.globals.map((global) => [bindingIdentityKey(global.id), global] as const),
  );
  const pendingGlobals: BindingId[] = [...semantic.initializerOrder];
  const scan = (blocks: readonly SemanticBlock[]): void => {
    for (const block of blocks) {
      for (const operation of block.operations) {
        if (operation.kind === "embedded-address") assets.add(operation.asset);
        const root = operationPlaceRoot(operation);
        if (root !== null && globals.has(bindingIdentityKey(root))) pendingGlobals.push(root);
      }
    }
  };
  for (const fn of functions) {
    if (reachable.has(bindingIdentityKey(fn.id))) scan(reachableBlocks(fn.entry, fn.blocks));
  }

  const scannedGlobals = new Set<string>();
  while (pendingGlobals.length > 0) {
    const id = pendingGlobals.shift()!;
    const key = bindingIdentityKey(id);
    if (scannedGlobals.has(key)) continue;
    scannedGlobals.add(key);
    const global = globals.get(key);
    if (global?.entry !== null && global?.entry !== undefined) {
      scan(reachableBlocks(global.entry, global.blocks));
    }
  }
  return assets;
}

/** Close all roots, calls, effects, assets, and value lifetimes before storage allocation. */
export function closeWholeProgram(
  semantic: SemanticProgram,
  interrupts?: InterruptProfileFacts,
): WholeProgramResult {
  const functions = [...semantic.functions].sort((left, right) =>
    compareBindings(left.id, right.id),
  );
  const targets = resolveTargetSets(
    semantic,
    new Set(interrupts?.sinks.map(({ capability }) => capability) ?? []),
  );
  const indirectTargets = targets.indirect;
  const calls = functionCalls(functions, indirectTargets);
  const callable = callableRoots(semantic, functions);
  let reachability = closeReachableFunctions(semantic, functions, calls, indirectTargets, callable);
  if (reachability.diagnostics.length > 0) {
    return Object.freeze({ kind: "error", diagnostics: reachability.diagnostics });
  }
  let selected = reachableInterruptRoutes(
    semantic,
    reachability.functions,
    targets.handlers,
    interrupts,
  );
  while (selected.diagnostics.length === 0) {
    const next = closeReachableFunctions(semantic, functions, calls, indirectTargets, [
      ...callable,
      ...selected.routes.map(({ handler }) => handler),
      ...addressedInterruptHandlers(semantic, functions, reachability.functions),
    ]);
    if (next.diagnostics.length > 0)
      return Object.freeze({ kind: "error", diagnostics: next.diagnostics });
    if (next.functions.size === reachability.functions.size) break;
    reachability = next;
    selected = reachableInterruptRoutes(
      semantic,
      reachability.functions,
      targets.handlers,
      interrupts,
    );
  }
  if (selected.diagnostics.length > 0) {
    return Object.freeze({ kind: "error", diagnostics: selected.diagnostics });
  }
  const reachable = reachability.functions;
  const reachableFunctionRecords = functions.filter((fn) =>
    reachable.has(bindingIdentityKey(fn.id)),
  );
  const recursion = recursionDiagnostic(reachableFunctionRecords, calls);
  if (recursion !== null) {
    return Object.freeze({ kind: "error", diagnostics: Object.freeze([recursion]) });
  }
  const ownership =
    interrupts === undefined
      ? undefined
      : checkInterruptOwnership(semantic, reachable, indirectTargets);
  if (ownership !== undefined && ownership.diagnostics.length > 0) {
    return Object.freeze({ kind: "error", diagnostics: ownership.diagnostics });
  }

  const reachableFunctions = Object.freeze(reachableFunctionRecords.map(({ id }) => id));
  const globals = new Map(
    semantic.globals.map((global) => [bindingIdentityKey(global.id), global] as const),
  );
  const initializers = Object.freeze(
    semantic.initializerOrder.map((binding) => {
      const global = globals.get(bindingIdentityKey(binding));
      if (global === undefined || global.entry === null) {
        throw new Error("Initializer root does not resolve to executable semantic control flow");
      }
      const blocks = reachableBlocks(global.entry, global.blocks);
      const callees = new Map<string, BindingId>();
      for (const call of callsIn(blocks, indirectTargets)) {
        callees.set(bindingIdentityKey(call.callee), call.callee);
      }
      return Object.freeze({
        binding,
        callees: Object.freeze([...callees.values()].sort(compareBindings)),
        lifetimes: valueLifetimes({ id: binding, entry: global.entry, blocks }),
      });
    }),
  );
  const roots: ProgramRoot[] = [Object.freeze({ kind: "startup" })];
  roots.push(
    ...semantic.initializerOrder.map((binding) =>
      Object.freeze({ kind: "initializer" as const, binding }),
    ),
    Object.freeze({ kind: "main", function: semantic.main }),
    ...callable
      .filter((id) => bindingIdentityKey(id) !== bindingIdentityKey(semantic.main))
      .map((id) => Object.freeze({ kind: "callable" as const, function: id })),
    ...selected.routes.map(({ handler, sink }) =>
      Object.freeze({
        kind: "interrupt" as const,
        function: handler,
        variant: sink.variant,
        domain: sink.domain,
      }),
    ),
  );
  const reachableAssets = reachableAssetIds(semantic, functions, reachable);
  const callGraph = closeCallGraph(functions, calls, reachable);
  const domainAnalysis = analyzeInterruptDomains(semantic, roots, callGraph);

  return Object.freeze({
    kind: "complete",
    program: Object.freeze({
      semantic,
      roots: Object.freeze(roots),
      callGraph,
      indirectTargets,
      interruptRoutes: selected.routes,
      ...(ownership === undefined ? {} : { interruptOwnership: ownership }),
      executionDomains: domainAnalysis.functions,
      diagnostics: domainAnalysis.diagnostics,
      initializers,
      effects: closeEffects(functions, semantic.effects ?? [], reachable),
      lifetimes: Object.freeze(
        functions
          .filter((fn) => reachable.has(bindingIdentityKey(fn.id)))
          .flatMap((fn) => valueLifetimes(fn)),
      ),
      reachableFunctions,
      reachableAssets: Object.freeze(
        semantic.assets.filter(({ id }) => reachableAssets.has(id)).map(({ id }) => id),
      ),
    }),
  });
}
