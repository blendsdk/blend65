import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type {
  BlockId,
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  SemanticOperation,
} from "./operations.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { InterruptRoute, WholeProgram } from "./whole-program.js";
import { interruptDepthAt, interruptPredecessorSlot } from "./interrupt-contexts.js";
import {
  walkInterruptExecutionContexts,
  projectInterruptBlocks,
  interruptRetainedBlocks,
  independentInterruptCallableBodies,
} from "./interrupt-context-walk.js";
export {
  interruptRetainedBlocks,
  functionEntryContext,
  interruptCodeContexts,
} from "./interrupt-context-walk.js";
import type {
  InterruptExecutionContext,
  InterruptExecutionContexts,
} from "./interrupt-contexts.js";
import { cia2FactsKey } from "./cia2-ownership-facts.js";
import type { Cia2Facts } from "./cia2-ownership-facts.js";

/** One entry's body and immutable continuation binding, never a runtime selector. */
export interface SelectedEntry {
  /** Canonical identity includes the incoming word only when the entry reads it. */
  readonly id: string;
  /** Selected callback and hardware ABI. */
  readonly route: InterruptRoute;
  /** Invocation-local homes are owned by this exact entry, not just its source handler. */
  readonly context: InterruptExecutionContext;
  /** Word read by the wrapper's normal chain exit; absent for an exclusive exit. */
  readonly tail?: string;
}

/** Select an entry's identity and only the predecessor word its returning body reads. */
export function interruptEntrySelection(
  route: InterruptRoute,
  slot: string,
  program: WholeProgram,
): Pick<SelectedEntry, "id" | "tail"> {
  const tail =
    route.variant.staticLinkBytes === 2 &&
    program.interruptOwnership?.returningBodies?.get(bindingIdentityKey(route.handler)) !== false
      ? slot
      : undefined;
  return Object.freeze({
    id: JSON.stringify([bindingIdentityKey(route.handler), route.variant.id, tail ?? null]),
    ...(tail === undefined ? {} : { tail }),
  });
}

/** The value a physical word must retain, with the path which established it. */
export interface LinkCapture {
  /** Null is the selected stock predecessor, not an unknown function. */
  readonly entry: SelectedEntry | null;
  /** Source installs/calls in execution order, independent of analysis identity spelling. */
  readonly path: readonly SourceSpan[];
}

/** Logical ownership can end before the physical capture's final reader ends. */
export interface LinkOwner {
  /** Exact two-byte word read by this owner's restore. */
  readonly slot: string;
  /** Capture expected by the suspended restore. */
  readonly capture: LinkCapture;
}

/** Only vector, link and source-mask relations are evaluated; general values are not. */
export interface VectorState {
  /** Current published entries, including the selected stock predecessor. */
  readonly vectors: Readonly<Record<"irq" | "nmi", SelectedEntry | null>>;
  /** Last complete capture in each physical link. */
  readonly words: ReadonlyMap<string, LinkCapture>;
  /** LIFO owners belonging to this execution, never borrowed from an interrupt's parent. */
  readonly owners: Readonly<Record<"irq" | "nmi", readonly LinkOwner[]>>;
  /** Current source I-bit eligibility; hardware/firmware interrupt entry starts masked. */
  readonly enabled: boolean;
  /** NMOS eligibility sampled before the previous source control instruction. */
  readonly eligible: boolean;
  /** Balanced source PHP/PLP saves, separate from hardware interrupt frames. */
  readonly saved: readonly boolean[];
  /** First concrete source path reaching these facts; excluded from equality keys. */
  readonly path: readonly SourceSpan[];
  /** Raw vector provenance cannot be silently reused by a later qualified installation. */
  readonly rawVectors?: ReadonlyMap<"irq" | "nmi", SourceSpan>;
  /** Suspended low/high IRQ update whose incomplete word must remain unobservable. */
  readonly irqTransition?: SourceSpan;
  /** Optional device relation exists only when an exclusive CIA2 candidate is present. */
  readonly cia2?: Cia2Facts;
  /** Possible home writes since this invocation or local vector transaction began. */
  readonly writesHomes?: boolean;
}

/** Context closure either proves finite bindings or retains one canonical failure. */
export interface InterruptContextAnalysis {
  /** Shared selected source/helper contexts for inventory and machine lowering. */
  readonly contexts: InterruptExecutionContexts;
  /** Physical words and their correlated, observer-checked capture choices. */
  readonly bindings: ReadonlyMap<string, InterruptLinkBinding>;
  /** Actually reached operation/terminator indexes, unioned for each source/context. */
  readonly reached: ReadonlyMap<string, ReadonlyMap<BlockId, ReadonlySet<number>>>;
  /** Terminal failures prohibit consuming any discovered binding. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Source restores proved to end a typed epoch, separately for each emitted context. */
  readonly cia2Restores?: ReadonlyMap<string, ReadonlySet<SemanticOperation>>;
  /** Actual ordinary call selections share the same finite code policy as their caller. */
  readonly cia2Calls?: ReadonlyMap<
    string,
    ReadonlyMap<SemanticOperation, ReadonlyMap<string, InterruptExecutionContext>>
  >;
}

/** Closed source invocation facts, projected into code without replaying control flow. */
export interface InterruptCodeInvocation {
  /** The source body already traversed by the ordered context worklist. */
  readonly body: SemanticFunction | SemanticGlobal;
  /** Existing physical/ABI descriptor, before a finite code-policy suffix. */
  readonly context: InterruptExecutionContext;
  /** Source points actually reached by this invocation. */
  readonly reached: ReadonlyMap<BlockId, ReadonlySet<number>>;
  /** Already discovered ordinary direct/finite-target edges only. */
  readonly calls: ReadonlyMap<SemanticOperation, ReadonlySet<InterruptCodeInvocation>>;
  /** Exact release alternatives; only final stock alternatives can safely share shutdown. */
  readonly restores: ReadonlyMap<
    SemanticOperation,
    ReadonlySet<"ordinary" | "stock-clean" | "stock-typed">
  >;
}

/** One memoized source invocation; its return alternatives grow monotonically. */
export interface InterruptContextInvocation extends InterruptCodeInvocation {
  /** Existing semantic body, including ordered executable initializers. */
  readonly body: SemanticFunction | SemanticGlobal;
  /** Concrete caller/entry vector depths used by the existing fixed-home consumers. */
  readonly context: InterruptExecutionContext;
  /** Entry relation, not a general value or CPU snapshot. */
  readonly input: VectorState;
  /** Exact actual scalar inputs distinguish ownership proofs, never emitted function homes. */
  readonly arguments: readonly (bigint | undefined)[];
  /** Readers belonging to suspended executions; returning cannot discard them. */
  readonly protectedReaders: ReadonlyMap<string, LinkCapture>;
  /** Current wrapper's continuation, propagated through ordinary helpers. */
  readonly activeEntry?: SelectedEntry;
  /** Active selected handlers used only to identify a growing continuation recurrence. */
  readonly ancestors: ReadonlyMap<string, SelectedEntry>;
  /** Complete returning relations, kept separate at CFG joins. */
  readonly exits: Map<string, VectorState>;
  /** Callers to revisit when a new returning relation is discovered. */
  readonly callers: Set<InterruptContextInvocation>;
  /** Already reached source points used by finite code projection after proof closure. */
  readonly reached: Map<string, Set<number>>;
  /** Actual ordinary call edges, never hypothetical interrupt or CFG edges. */
  readonly calls: Map<SemanticOperation, Set<InterruptContextInvocation>>;
  /** Complete proved release alternatives at each source operation. */
  readonly restores: Map<SemanticOperation, Set<"ordinary" | "stock-clean" | "stock-typed">>;
}

/** Every producer/consumer of one saved word uses this same proved request identity. */
export interface InterruptLinkBinding {
  /** Actual two-byte request consumed by inventory, capture, restore and chain exit. */
  readonly requestId: string;
  /** Complete correlated alternatives; no Cartesian join of unrelated predecessors. */
  readonly captures: readonly {
    /** Exact installing source/helper context. */
    readonly installer: InterruptExecutionContext;
    /** Selected body/ABI/continuation identity published by this capture. */
    readonly entryIdentity: string;
    /** Published ABI selection exists even when masking prevents every invocation. */
    readonly entry: SelectedEntry;
    /** Actual predecessor identity, including the selected stock route. */
    readonly predecessor: string;
    /** A still-live reader requires explicitly equal reuse rather than dead-word reuse. */
    readonly equalLiveCapture: boolean;
  }[];
}

/**
 * Match a source/context by value, not object identity: distinct vector states
 * can reach the same generated body through separately allocated context objects.
 */
export function interruptExecutionKey(
  owner: BindingId | string,
  context: InterruptExecutionContext,
): string {
  return JSON.stringify([
    typeof owner === "string" ? owner : bindingIdentityKey(owner),
    context.domain,
    context.activationRoot ?? null,
    context.localIrqDepth ?? null,
    context.localNmiDepth ?? null,
    context.entrySlot ?? null,
    context.irq,
    context.nmi,
    ...(context.releaseVariant === undefined ? [] : [context.releaseVariant]),
  ]);
}

/**
 * Project the union of actual executions sharing one emitted body. A reached
 * call remains, but an absent return edge ends its block without reviving the
 * source suffix. Merge values retain only real predecessor edges.
 */
export function interruptExecutedBlocks(
  body: SemanticFunction | SemanticGlobal,
  contexts: readonly InterruptExecutionContext[],
  proof: InterruptContextAnalysis,
): readonly SemanticBlock[] {
  const reached = new Map<BlockId, Set<number>>();
  for (const context of contexts) {
    for (const [block, indexes] of proof.reached.get(interruptExecutionKey(body.id, context)) ??
      []) {
      const union = reached.get(block) ?? new Set<number>();
      for (const index of indexes) union.add(index);
      reached.set(block, union);
    }
  }
  return projectInterruptBlocks(body, reached);
}

/**
 * Keep independently exposed raw handlers and their ordinary code dependencies.
 * A direct typed sink selects its own ABI without exposing the raw address;
 * every other use which materializes address bytes retains the source body.
 * This set records emission dependencies, never an interrupt arrival or an
 * external caller's ownership/reentrancy guarantee.
 */
export function interruptRawDependencies(
  program: WholeProgram,
  retainedBlocks: readonly SemanticBlock[] = [],
): ReadonlySet<string> {
  const proof = program.interruptContextAnalysis;
  if (proof === undefined) return new Set();
  const selectedSinks = new Set(program.interruptRoutes?.map((route) => route.installation));
  const pending: string[] = [];
  /** Address exposure belongs to retained code, even when that body never runs here. */
  const collectAddresses = (blocks: readonly SemanticBlock[]): void => {
    const operations = blocks.flatMap((block) => block.operations);
    for (const address of operations) {
      if (address.kind !== "function-address" || address.type.kind !== "interrupt-handler")
        continue;
      const value = address.result;
      const exposed =
        operations.some((operation) => {
          if (operation.kind === "platform" && selectedSinks.has(operation)) return false;
          if ("operand" in operation && operation.operand === value) return true;
          if ("arguments" in operation && operation.arguments.includes(value)) return true;
          if ("left" in operation && (operation.left === value || operation.right === value))
            return true;
          if ("value" in operation && operation.value === value) return true;
          if (operation.kind === "merge")
            return operation.incoming.some((edge) => edge.value === value);
          return (
            operation.kind === "aggregate" &&
            (operation.elements.some((element) => element.value === value) ||
              operation.fill === value)
          );
        }) ||
        blocks.some(
          (block) => block.terminator.kind === "return" && block.terminator.value === value,
        );
      if (exposed) pending.push(bindingIdentityKey(address.function));
    }
  };
  for (const body of [...program.semantic.functions, ...program.semantic.globals]) {
    const contexts = proof.contexts.get(bindingIdentityKey(body.id)) ?? [];
    collectAddresses(interruptExecutedBlocks(body, contexts, proof));
  }
  collectAddresses(retainedBlocks);
  const retained = new Set<string>();
  const functions = new Map(
    program.semantic.functions.map((body) => [bindingIdentityKey(body.id), body]),
  );
  const dependencies = new Map(
    program.callGraph.map((node) => [bindingIdentityKey(node.function), node.callees]),
  );
  for (let index = 0; index < pending.length; index += 1) {
    const key = pending[index]!;
    if (retained.has(key)) continue;
    retained.add(key);
    const body = functions.get(key);
    if (body !== undefined) collectAddresses(body.blocks);
    pending.push(...(dependencies.get(key) ?? []).map(bindingIdentityKey));
  }
  return retained;
}

/** A finite source/ABI body namespace, not an invocation or correlated tail identity. */
export function interruptRetainedEntryRoot(route: InterruptRoute): string {
  return JSON.stringify([
    "retained",
    route.sink.domain,
    bindingIdentityKey(route.handler),
    route.variant.id,
  ]);
}

/** Code demand for one saved word at an uncertified raw execution boundary. */
export interface RetainedInterruptLink {
  /** Same physical request for capture, restore and every selected tail. */
  readonly requestId: string;
  /** Source which contains this installation, not an invented caller. */
  readonly owner: BindingId;
  /** Fixed ABI/ownership depths used solely to construct retained code. */
  readonly context: InterruptExecutionContext;
  /** Explicitly not stock or a proved predecessor/capture. */
  readonly predecessor: "uncertified-external";
  /** Complete selected wrapper demands, each retaining its exact tail word. */
  readonly entries: readonly SelectedEntry[];
}

/** Finite retained code and storage demands, separate from executed contexts and captures. */
export interface InterruptMaterializations {
  /** Numeric raw handler addresses and their ordinary source dependencies. */
  readonly raw: ReadonlySet<string>;
  /** ABI descriptors only; these do not populate the execution proof. */
  readonly contexts: InterruptExecutionContexts;
  /** Source/site-owned physical demands whose external lifetime is uncertified. */
  readonly links: ReadonlyMap<string, RetainedInterruptLink>;
}

/**
 * Collect complete raw-source artifacts with the existing structural ownership
 * walk. Selected entries use finite source/ABI body namespaces; wrapper identity
 * separately retains the tail word. No vector state, arrival or capture is seeded.
 */
export function interruptMaterializations(program: WholeProgram): InterruptMaterializations {
  let raw = interruptRawDependencies(program);
  let contexts: InterruptExecutionContexts = new Map();
  const functions = new Map(
    program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn]),
  );
  while (raw.size > 0) {
    contexts = walkInterruptExecutionContexts(
      program,
      program.semantic.functions
        .filter((fn) => fn.entryKind === "interrupt" && raw.has(bindingIdentityKey(fn.id)))
        .map((fn) => fn.id),
    );
    const blocks = [...contexts.keys()].flatMap((key) => functions.get(key)?.blocks ?? []);
    const closed = interruptRawDependencies(program, blocks);
    if (closed.size === raw.size) break;
    raw = closed;
  }
  const links = new Map<string, RetainedInterruptLink>();
  for (const [key, bodies] of contexts) {
    const owner = functions.get(key);
    if (owner === undefined) throw new Error("Retained interrupt body has no source");
    const blocks = interruptRetainedBlocks(owner, program);
    for (const context of bodies) {
      for (const route of program.interruptRoutes ?? []) {
        if (!blocks.some((block) => block.operations.includes(route.installation))) continue;
        const at = interruptDepthAt(context, route.installation, program);
        const slot = interruptPredecessorSlot(at, route.sink.domain);
        const selection = interruptEntrySelection(route, slot, program);
        const entryContext = contexts
          .get(bindingIdentityKey(route.handler))
          ?.find(
            (entry) =>
              entry.domain === route.sink.domain &&
              entry.entrySlot === slot &&
              entry.activationRoot === interruptRetainedEntryRoot(route),
          );
        if (entryContext === undefined)
          throw new Error("Retained selected entry has no ABI demand");
        const entries = links.get(slot)?.entries ?? [];
        if (entries.some((entry) => entry.id === selection.id)) continue;
        links.set(
          slot,
          Object.freeze({
            requestId: slot,
            owner: owner.id,
            context: at,
            predecessor: "uncertified-external",
            entries: Object.freeze([
              ...entries,
              Object.freeze({ ...selection, route, context: entryContext }),
            ]),
          }),
        );
      }
    }
  }
  return Object.freeze({ raw, contexts, links });
}

/**
 * Equality ignores trace history. When a complete reader closure is supplied,
 * inactive words cannot distinguish states, but actual observed captures still do.
 * The operational word map and physical binding catalogue remain unchanged.
 */
export function interruptVectorStateKey(
  state: VectorState,
  readers?: ReadonlyMap<string, LinkCapture>,
): string {
  return JSON.stringify([
    state.vectors.irq?.id ?? null,
    state.vectors.nmi?.id ?? null,
    [...state.words]
      .filter(([slot]) => readers === undefined || readers.has(slot))
      .map(([slot, capture]) => [slot, capture.entry?.id ?? null])
      .sort(),
    ...(["irq", "nmi"] as const).map((sink) =>
      state.owners[sink].map(({ slot, capture }) => [slot, capture.entry?.id ?? null]),
    ),
    state.enabled,
    state.eligible,
    state.saved,
    [...(state.rawVectors?.keys() ?? [])].sort(),
    state.irqTransition === undefined
      ? null
      : [state.irqTransition.sourceId, state.irqTransition.start, state.irqTransition.end],
    ...(state.cia2 === undefined
      ? []
      : [
          cia2FactsKey(state.cia2),
          state.writesHomes ?? false,
          state.vectors.nmi?.context.entrySlot ?? null,
          [...state.words]
            .filter(([slot]) => readers === undefined || readers.has(slot))
            .map(([slot, capture]) => [slot, capture.entry?.context.entrySlot ?? null])
            .sort(),
        ]),
  ]);
}

/** Attribute an observable incomplete IRQ word to the transaction which created it. */
export function interruptIrqTransitionFailure(
  state: VectorState,
  cause?: SourceSpan,
): ProjectDiagnostic {
  if (state.irqTransition === undefined) throw new Error("Incomplete IRQ transaction is missing");
  return projectDiagnostic(
    "E10245",
    "Execution path 'c64.system.setIRQ' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy",
    state.irqTransition,
    null,
    [...state.path, ...(cause === undefined ? [] : [cause])].map((span) => ({
      span,
      message: "Incomplete IRQ publication can be observed here",
    })),
  );
}

/**
 * Retain inherited readers independently of this invocation's logical owners.
 * Chained entries can also read their predecessor's words later, so follow the
 * actual immutable continuation. A nonreturning body has no unused tail reader.
 */
export function interruptLinkObservers(
  state: VectorState,
  protectedReaders: ReadonlyMap<string, LinkCapture>,
  activeEntry: SelectedEntry | undefined,
  program: WholeProgram,
): ReadonlyMap<string, LinkCapture> {
  const readers = new Map(protectedReaders);
  const visited = new Set<string>();
  const entry = (selected: SelectedEntry | null | undefined): void => {
    if (selected === null || selected === undefined || visited.has(selected.id)) return;
    visited.add(selected.id);
    if (
      selected.tail === undefined ||
      program.interruptOwnership?.returningBodies?.get(
        bindingIdentityKey(selected.route.handler),
      ) === false
    )
      return;
    const capture = state.words.get(selected.tail);
    if (capture === undefined) throw new Error("Selected interrupt predecessor is missing");
    if (!readers.has(selected.tail)) readers.set(selected.tail, capture);
    entry(capture.entry);
  };
  // A suspended capture can itself select a chained predecessor. Its tail
  // remains a reader even if that entry is no longer published or locally owned.
  for (const capture of protectedReaders.values()) entry(capture.entry);
  entry(state.vectors.irq);
  entry(state.vectors.nmi);
  entry(activeEntry);
  for (const sink of ["irq", "nmi"] as const) {
    for (const owner of state.owners[sink]) {
      if (!readers.has(owner.slot)) readers.set(owner.slot, owner.capture);
      entry(owner.capture.entry);
    }
  }
  return readers;
}

/** A physical overwrite is legal only after its readers end or its complete capture agrees. */
export function interruptCaptureFailure(
  slot: string,
  next: LinkCapture,
  readers: ReadonlyMap<string, LinkCapture>,
  route: InterruptRoute,
): ProjectDiagnostic | null {
  const previous = readers.get(slot);
  if (previous === undefined || previous.entry?.id === next.entry?.id) return null;
  return projectDiagnostic(
    "E10245",
    `Execution path '${route.sink.source}' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy`,
    route.installation.span,
    null,
    next.path.map((span) => ({ span, message: "Live predecessor capture is reached here" })),
  );
}

/** Compare emitted ABI contexts without turning an incoming physical word into a new home. */
function emissionContextKey(node: Pick<InterruptCodeInvocation, "body" | "context">): string {
  const { context } = node;
  return JSON.stringify([
    bindingIdentityKey(node.body.id),
    context.domain,
    context.activationRoot ?? null,
    context.activationRoot === undefined ? context.irq : (context.localIrqDepth ?? 0),
    context.activationRoot === undefined ? context.nmi : (context.localNmiDepth ?? 0),
  ]);
}

/**
 * Canonicalize the already-closed restore/call policies in the existing emission
 * descriptors. This visits proved ordinary call edges, not source CFGs or new
 * incoming states. The closed ordinary call graph is acyclic; external interrupt
 * recurrence is deliberately absent from these edges. No runtime selector or
 * storage frame is produced. Only differing machine policies create variants.
 */
export function closeInterruptCodeVariants(
  nodes: readonly InterruptCodeInvocation[],
  program: WholeProgram,
): Required<
  Pick<
    InterruptContextAnalysis,
    "contexts" | "reached" | "cia2Restores" | "cia2Calls" | "diagnostics"
  >
> {
  const contexts = new Map<string, InterruptExecutionContext[]>();
  const reached = new Map<string, Map<BlockId, Set<number>>>();
  const restores = new Map<string, ReadonlySet<SemanticOperation>>();
  const calls = new Map<
    string,
    ReadonlyMap<SemanticOperation, ReadonlyMap<string, InterruptExecutionContext>>
  >();
  const diagnostics: ProjectDiagnostic[] = [];
  const identities = new Map(nodes.map((node, index) => [node, index]));
  const memo = new Map<string, InterruptExecutionContext>();
  const variants = new Map<string, string>();

  /** Group only ABI-compatible already-proved choices; no device facts are joined here. */
  const groups = (
    choices: Iterable<InterruptCodeInvocation>,
  ): Map<string, InterruptCodeInvocation[]> => {
    const grouped = new Map<string, InterruptCodeInvocation[]>();
    for (const node of choices) {
      const key = emissionContextKey(node);
      const current = grouped.get(key) ?? [];
      current.push(node);
      grouped.set(key, current);
    }
    return grouped;
  };
  /** A body cannot choose between incompatible device releases without source evidence. */
  const fail = (operation: SemanticOperation): void => {
    const source =
      operation.kind === "platform"
        ? operation.capability
        : operation.kind === "call" || operation.kind === "indirect-call"
          ? "ordinary call"
          : operation.kind;
    diagnostics.push(
      projectDiagnostic(
        "E10278",
        `Interrupt ownership for sink 'c64.system.setNMIExclusive' is invalid at '${source}' — release policy differs on unresolved paths of one emitted call/body`,
        operation.span,
      ),
    );
  };
  /** Project a finite set of observed choices and reuse its identical machine policy. */
  const project = (choices: readonly InterruptCodeInvocation[]): InterruptExecutionContext => {
    const key = JSON.stringify(choices.map((node) => identities.get(node)!).sort((a, b) => a - b));
    const previous = memo.get(key);
    if (previous !== undefined) return previous;
    const first = choices[0]!;
    const owner = bindingIdentityKey(first.body.id);
    const policies = new Map<SemanticOperation, Set<string>>();
    const edges = new Map<SemanticOperation, Set<InterruptCodeInvocation>>();
    for (const node of choices) {
      for (const [operation, alternatives] of node.restores) {
        const union = policies.get(operation) ?? new Set<string>();
        for (const policy of alternatives) union.add(policy);
        policies.set(operation, union);
      }
      for (const [operation, targets] of node.calls) {
        const union = edges.get(operation) ?? new Set<InterruptCodeInvocation>();
        for (const target of targets) union.add(target);
        edges.set(operation, union);
      }
    }
    const handbacks = new Set<SemanticOperation>();
    for (const [operation, alternatives] of policies) {
      if (!alternatives.has("stock-typed")) continue;
      if (alternatives.has("ordinary")) fail(operation);
      else handbacks.add(operation);
    }
    const selectedCalls = new Map<
      SemanticOperation,
      ReadonlyMap<string, InterruptExecutionContext>
    >();
    const childPolicies: string[] = [];
    for (const [operation, targets] of edges) {
      const selected = new Map<string, InterruptExecutionContext>();
      for (const children of groups(targets).values()) {
        const childOwner = bindingIdentityKey(children[0]!.body.id);
        const context = project(children);
        if (selected.has(childOwner)) fail(operation);
        selected.set(childOwner, context);
        if (context.releaseVariant !== undefined)
          childPolicies.push(
            JSON.stringify([
              operation.span,
              childOwner,
              emissionContextKey(children[0]!),
              context.releaseVariant,
            ]),
          );
      }
      selectedCalls.set(operation, selected);
    }
    const signature =
      handbacks.size === 0 && childPolicies.length === 0
        ? null
        : JSON.stringify([
            [...handbacks].map((operation) => JSON.stringify(operation.span)).sort(),
            childPolicies.sort(),
          ]);
    let variant = signature === null ? undefined : variants.get(signature);
    if (signature !== null && variant === undefined) {
      variant = `c${variants.size}`;
      variants.set(signature, variant);
    }
    const context = {
      ...first.context,
      ...(variant === undefined ? {} : { releaseVariant: variant }),
    };
    memo.set(key, context);
    const points = new Map<BlockId, Set<number>>();
    for (const node of choices)
      for (const [block, indexes] of node.reached) {
        const union = points.get(block) ?? new Set<number>();
        for (const index of indexes) union.add(index);
        points.set(block, union);
      }
    for (const node of choices) {
      const descriptor = {
        ...node.context,
        ...(variant === undefined ? {} : { releaseVariant: variant }),
      };
      const execution = interruptExecutionKey(owner, descriptor);
      const entries = contexts.get(owner) ?? [];
      if (!entries.some((entry) => interruptExecutionKey(owner, entry) === execution))
        entries.push(descriptor);
      contexts.set(owner, entries);
      const union = reached.get(execution) ?? new Map<BlockId, Set<number>>();
      for (const [block, indexes] of points) {
        const current = union.get(block) ?? new Set<number>();
        for (const index of indexes) current.add(index);
        union.set(block, current);
      }
      reached.set(execution, union);
      restores.set(execution, handbacks);
      calls.set(execution, selectedCalls);
    }
    return context;
  };
  const roots = new Set([
    bindingIdentityKey(program.semantic.main),
    ...program.semantic.initializerOrder.map(bindingIdentityKey),
    ...independentInterruptCallableBodies(
      program,
      new Map(nodes.map((node) => [bindingIdentityKey(node.body.id), node.body])),
      true,
    ).map((body) => bindingIdentityKey(body.id)),
  ]);
  for (const choices of groups(
    nodes.filter(
      (node) =>
        roots.has(bindingIdentityKey(node.body.id)) ||
        ("entryKind" in node.body && node.body.entryKind === "interrupt"),
    ),
  ).values())
    project(choices);
  return { contexts, reached, cia2Restores: restores, cia2Calls: calls, diagnostics };
}
