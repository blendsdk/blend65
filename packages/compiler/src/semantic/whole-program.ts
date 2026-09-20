import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, EffectSummary } from "../frontend/semantic-types.js";
import type {
  BlockId,
  CallOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticProgram,
  ValueId,
} from "./operations.js";

/** One whole-program entry source. */
export type ProgramRoot =
  | { readonly kind: "startup" }
  | { readonly kind: "initializer"; readonly binding: BindingId }
  | { readonly kind: "main"; readonly function: BindingId };

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
  /** Startup, ordered initializer, and main roots. */
  readonly roots: readonly ProgramRoot[];
  /** Direct call graph for reachable functions. */
  readonly callGraph: readonly CallGraphNode[];
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

/** Return direct call operations from a block list in stable block/operation order. */
function callsIn(blocks: readonly SemanticBlock[]): readonly CallOperation[] {
  return Object.freeze(
    blocks.flatMap((block) =>
      block.operations.filter((operation): operation is CallOperation => operation.kind === "call"),
    ),
  );
}

/** Build one finite direct-edge list for every semantic function. */
function functionCalls(
  functions: readonly SemanticFunction[],
): ReadonlyMap<string, readonly CallOperation[]> {
  return new Map(
    functions.map((fn) => [
      bindingIdentityKey(fn.id),
      callsIn(reachableBlocks(fn.entry, fn.blocks)),
    ]),
  );
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
  calls: ReadonlyMap<string, readonly CallOperation[]>,
): ReachabilityResult {
  const known = new Map(functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const));
  const diagnostics: ProjectDiagnostic[] = [];
  if (!known.has(bindingIdentityKey(semantic.main))) {
    throw new Error("Selected main root does not resolve to a semantic function");
  }
  const globals = new Map(
    semantic.globals.map((global) => [bindingIdentityKey(global.id), global]),
  );
  const pending: BindingId[] = [semantic.main];
  for (const initializer of semantic.initializerOrder) {
    const global = globals.get(bindingIdentityKey(initializer));
    if (global === undefined || global.entry === null) {
      throw new Error("Initializer root does not resolve to executable semantic control flow");
    }
    for (const call of callsIn(reachableBlocks(global.entry, global.blocks))) {
      if (!known.has(bindingIdentityKey(call.callee))) {
        diagnostics.push(
          projectDiagnostic(
            "E10277",
            "Cannot prove a finite source-function target set for call through '<unknown>' of type '<unknown>' — keep the value within closed-program typed storage",
            call.span,
          ),
        );
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
        diagnostics.push(
          projectDiagnostic(
            "E10277",
            "Cannot prove a finite source-function target set for call through '<unknown>' of type '<unknown>' — keep the value within closed-program typed storage",
            call.span,
          ),
        );
      } else {
        pending.push(call.callee);
      }
    }
  }
  return Object.freeze({ functions: reached, diagnostics: Object.freeze(diagnostics) });
}

/** Find the first direct or indirect recursion cycle in stable semantic order. */
function recursionDiagnostic(
  functions: readonly SemanticFunction[],
  calls: ReadonlyMap<string, readonly CallOperation[]>,
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
      const names = cycle.map(({ key: item }) => byKey.get(item)?.name ?? "<function>");
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
  calls: ReadonlyMap<string, readonly CallOperation[]>,
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
      if (operation.kind === "call") {
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
export function closeWholeProgram(semantic: SemanticProgram): WholeProgramResult {
  const functions = [...semantic.functions].sort((left, right) =>
    compareBindings(left.id, right.id),
  );
  const calls = functionCalls(functions);
  const reachability = closeReachableFunctions(semantic, functions, calls);
  if (reachability.diagnostics.length > 0) {
    return Object.freeze({ kind: "error", diagnostics: reachability.diagnostics });
  }
  const reachable = reachability.functions;
  const reachableFunctionRecords = functions.filter((fn) =>
    reachable.has(bindingIdentityKey(fn.id)),
  );
  const recursion = recursionDiagnostic(reachableFunctionRecords, calls);
  if (recursion !== null) {
    return Object.freeze({ kind: "error", diagnostics: Object.freeze([recursion]) });
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
      for (const call of callsIn(blocks)) {
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
  );
  const reachableAssets = reachableAssetIds(semantic, functions, reachable);

  return Object.freeze({
    kind: "complete",
    program: Object.freeze({
      semantic,
      roots: Object.freeze(roots),
      callGraph: closeCallGraph(functions, calls, reachable),
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
