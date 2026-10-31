import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { TypedStatement } from "../frontend/semantic-types.js";
import type { TypedProgram } from "../frontend/service.js";
import type { SourceSpan } from "../project/types.js";
import {
  literalResolver,
  placeUses,
  valueDefinitions,
  sealFixedLoopFacts,
} from "./aggregate-place-proof.js";
import type {
  BinaryOperation,
  BlockId,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  StoreOperation,
  ValueId,
} from "./operations.js";
import { reachableBlocks } from "./value-lifetimes.js";
import type { WholeProgram } from "./whole-program.js";
import type { ClosedObjectValueBounds } from "./closed-object-facts.js";

/** Inclusive source domain; it does not change a counter's declared word type. */
export interface FixedLoopDomain {
  /** Smallest possible nonnegative source value. */
  readonly minimum: number;
  /** Largest possible source value. */
  readonly maximum: number;
}

/** Lexical source context already present in the checked frontend tree. */
export interface SourceLoopNesting {
  /** Exact semantic source paired with the checked declarations. */
  readonly program: WholeProgram;
  /** Immutable source conditions and depths; no CFG-label inference or reparse. */
  readonly loops: readonly {
    /** Actual immutable source function paired with the checked declaration. */
    readonly function: SemanticFunction;
    /** Original condition span, or null for a conditionless source for loop. */
    readonly condition: SourceSpan | null;
    /** Zero-based source nesting level, reset at each function. */
    readonly depth: number;
  }[];
}

/**
 * Retain lexical loop depth before CFG normalization can erase a non-repeating parent.
 * Only the existing checked AST is walked; no parsing or semantic analysis is repeated.
 * @param program Semantic program paired with this frontend result.
 * @param typed Already checked declarations, whose bindings identify the source functions.
 * @returns Source-only nesting context for deterministic X/Y policy selection.
 */
export function collectSourceLoopNesting(
  program: WholeProgram,
  typed: TypedProgram,
): SourceLoopNesting {
  const functions = new Map(
    program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn]),
  );
  const loops: { function: SemanticFunction; condition: SourceSpan | null; depth: number }[] = [];
  for (const declaration of typed.declarations) {
    const fn = functions.get(bindingIdentityKey(declaration.binding));
    if (fn === undefined || declaration.body === null) continue;
    const pending: { statement: TypedStatement; depth: number }[] = [
      { statement: declaration.body, depth: 0 },
    ];
    while (pending.length > 0) {
      const { statement, depth } = pending.pop()!;
      if (statement.kind === "for" || statement.kind === "while" || statement.kind === "do-while") {
        loops.push(
          Object.freeze({ function: fn, condition: statement.condition?.span ?? null, depth }),
        );
        pending.push({ statement: statement.body, depth: depth + 1 });
      } else if (statement.kind === "block") {
        for (const child of [...statement.statements].reverse())
          pending.push({ statement: child, depth });
      } else if (statement.kind === "if") {
        if (statement.otherwise !== null) pending.push({ statement: statement.otherwise, depth });
        pending.push({ statement: statement.then, depth });
      } else if (statement.kind === "switch") {
        for (const clause of [...statement.clauses].reverse())
          pending.push({ statement: clause.body, depth });
      }
    }
  }
  return Object.freeze({ program, loops: Object.freeze(loops) });
}

/** Initialization recognized without interprocedural evaluation or speculative execution. */
export type FixedLoopInitial =
  | {
      /** Initialization is one already evaluated source constant. */
      readonly kind: "constant";
      /** Exact initial counter value, not the later terminal value. */
      readonly value: number;
      /** Initialization values before the first condition test; not the body domain. */
      readonly domain: FixedLoopDomain;
    }
  | {
      /** Initialization uses the containing counter's value plus one. */
      readonly kind: "parent-next";
      /** Source binding read by that initializer, distinct from lexical depth. */
      readonly parent: BindingId;
      /** Possible initialization values, including a value which can make the loop zero-trip. */
      readonly domain: FixedLoopDomain;
    };

/** Original non-header control transfers which every selected representation must preserve. */
export interface FixedLoopExit {
  /** Actual source block containing the transfer. */
  readonly from: SemanticBlock;
  /** Update/exit destination, or null for an immediate function return. */
  readonly target: BlockId | null;
  /** Update edges include both ordinary fallthrough and source continue paths. */
  readonly kind: "update" | "break" | "return";
}

/** Structural induction proof with explicit remaining physical-observer premises. */
export interface FixedLoopFacts {
  /** Immutable checked source whose identities own the fact. */
  readonly program: WholeProgram;
  /** Actual source function, never a name-based match. */
  readonly function: SemanticFunction;
  /** Private unsigned word binding updated by this loop. */
  readonly counter: BindingId;
  /** Original declared type retained for source/debug reconstruction. */
  readonly type: SemanticType;
  /** Existing initializer predecessor. */
  readonly preheader: SemanticBlock;
  /** Pure source comparison block. */
  readonly header: SemanticBlock;
  /** First block entered when the comparison succeeds. */
  readonly body: SemanticBlock;
  /** Unique canonical increment/backedge block. */
  readonly update: SemanticBlock;
  /** Original false-condition exit. */
  readonly exit: SemanticBlock;
  /** Exact initialization store after its RHS was evaluated. */
  readonly initialization: StoreOperation;
  /** Original less-than comparison. */
  readonly comparison: BinaryOperation;
  /** Original unit addition and final update store. */
  readonly increment: BinaryOperation;
  /** Actual store which advances the source counter. */
  readonly updateStore: StoreOperation;
  /** Literal or already recognized containing-counter successor. */
  readonly initial: FixedLoopInitial;
  /** Invariant exclusive literal bound, at most eight. */
  readonly bound: number;
  /** Body and update block identities, excluding this loop's header and exit. */
  readonly members: ReadonlySet<BlockId>;
  /** Values while the true body is entered, or null for a proved zero-trip loop. */
  readonly bodyDomain: FixedLoopDomain | null;
  /** Conditional normal-completion iteration interval, before abrupt exits. */
  readonly tripDomain: FixedLoopDomain;
  /** Exact normal-completion count when initialization is constant and exits are ordinary. */
  readonly exactIterations: number | null;
  /** Source update/break/return edges; none may be erased by counter narrowing. */
  readonly exits: readonly FixedLoopExit[];
  /** Recognized initialization dependency when the start uses another loop's counter. */
  readonly parent: FixedLoopFacts | null;
  /** Actual lexical depth, or unknown when no paired checked-source context was supplied. */
  readonly depth: number | null;
  /** Counter accesses outside this loop require retained homes or exact reconstruction. */
  readonly outsideAccesses: readonly SemanticOperation[];
  /** Incoming scalar ABI remains separate from any loop-local register view. */
  readonly parameter: boolean;
  /** Only this straight-line exact-eight shape may enter the expansion alternative. */
  readonly flatEight: boolean;
  /** Source value maxima under this fact's retained no-alias/visibility premises. */
  readonly valueBounds: ReadonlyMap<ValueId, bigint>;
  /** Raw/borrow/platform observations must still be checked at final reference/candidate homes. */
  readonly observerOperations: readonly SemanticOperation[];
}

/** Unresolved structure whose nested initialization may depend on an earlier recognized loop. */
interface LoopCandidate {
  readonly function: SemanticFunction;
  readonly counter: BindingId;
  readonly type: SemanticType;
  readonly preheader: SemanticBlock;
  readonly header: SemanticBlock;
  readonly body: SemanticBlock;
  readonly update: SemanticBlock;
  readonly exit: SemanticBlock;
  readonly initialization: StoreOperation;
  readonly comparison: BinaryOperation;
  readonly increment: BinaryOperation;
  readonly updateStore: StoreOperation;
  readonly bound: number;
  readonly members: ReadonlySet<BlockId>;
  readonly definitions: ReadonlyMap<ValueId, SemanticOperation>;
  readonly initial: number | BindingId;
  readonly exits: readonly FixedLoopExit[];
}

/** Existing CFG edges; source block labels and construction order are not induction evidence. */
function successors(block: SemanticBlock): readonly BlockId[] {
  const exit = block.terminator;
  return exit.kind === "jump"
    ? [exit.target]
    : exit.kind === "branch"
      ? [exit.whenTrue, exit.whenFalse]
      : [];
}

/** Match an actual whole unsigned-word load, not a bound guessed from a declaration name. */
function wordLoad(operation: SemanticOperation | undefined) {
  return operation?.kind === "load" &&
    operation.place.path.length === 0 &&
    operation.type.kind === "scalar" &&
    operation.type.name === "word"
    ? operation
    : undefined;
}

/** Recognize only source integer/conversion constants in the admitted small domain. */
function smallLiteral(value: bigint | undefined): number | undefined {
  return value !== undefined && value >= 0n && value <= 8n ? Number(value) : undefined;
}

/** Recover one canonical unit update without admitting any extra side effect in its block. */
function unitUpdate(
  block: SemanticBlock,
  counter: BindingId,
  definitions: ReadonlyMap<ValueId, SemanticOperation>,
) {
  const store = block.operations.at(-1);
  if (
    store?.kind !== "store" ||
    store.place.path.length !== 0 ||
    bindingIdentityKey(store.place.root) !== bindingIdentityKey(counter)
  )
    return undefined;
  const addition = definitions.get(store.value);
  if (
    addition?.kind !== "binary" ||
    addition.operator !== "+" ||
    addition.integer?.width !== 16 ||
    addition.integer.signed
  )
    return undefined;
  const literal = literalResolver(definitions);
  const left = wordLoad(definitions.get(addition.left));
  const right = wordLoad(definitions.get(addition.right));
  const step =
    left !== undefined && bindingIdentityKey(left.place.root) === bindingIdentityKey(counter)
      ? literal(addition.right)
      : right !== undefined && bindingIdentityKey(right.place.root) === bindingIdentityKey(counter)
        ? literal(addition.left)
        : undefined;
  if (
    step !== 1n ||
    block.operations.some(
      (operation) =>
        operation !== store &&
        operation.kind !== "constant" &&
        operation.kind !== "convert" &&
        !(
          operation.kind === "load" &&
          bindingIdentityKey(operation.place.root) === bindingIdentityKey(counter)
        ) &&
        operation !== addition,
    )
  )
    return undefined;
  return { store, addition };
}

/** Collect the exact body subgraph, stopping at this loop's own header and exit. */
function bodyMembers(
  body: BlockId,
  header: BlockId,
  exit: BlockId,
  blocks: ReadonlyMap<BlockId, SemanticBlock>,
) {
  const members = new Set<BlockId>();
  const pending = [body];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (id === header || id === exit || members.has(id)) continue;
    const block = blocks.get(id);
    if (block === undefined) throw new Error("Fixed-loop CFG has a missing body block");
    members.add(id);
    pending.push(...successors(block));
  }
  return members;
}

/** Index one source function once, then recognize independent canonical loop structures. */
function loopCandidates(
  fn: SemanticFunction,
  globals: ReadonlySet<string>,
): readonly LoopCandidate[] {
  const reached = reachableBlocks(fn.entry, fn.blocks);
  const blocks = new Map(reached.map((block) => [block.id, block]));
  const definitions = valueDefinitions(reached);
  const literal = literalResolver(definitions);
  const predecessors = new Map(reached.map((block) => [block.id, [] as SemanticBlock[]]));
  for (const block of reached)
    for (const target of successors(block)) predecessors.get(target)!.push(block);
  const addressed = new Set(
    reached.flatMap((block) =>
      block.operations.flatMap((operation) =>
        operation.kind === "place-address" ? [bindingIdentityKey(operation.place.root)] : [],
      ),
    ),
  );
  const candidates: LoopCandidate[] = [];
  for (const header of reached) {
    if (header.terminator.kind !== "branch") continue;
    const comparison = definitions.get(header.terminator.condition);
    if (comparison?.kind !== "binary" || comparison.operator !== "<") continue;
    const counterLoad = wordLoad(definitions.get(comparison.left));
    const bound = smallLiteral(literal(comparison.right));
    if (counterLoad === undefined || bound === undefined) continue;
    const counter = counterLoad.place.root;
    const key = bindingIdentityKey(counter);
    if (
      globals.has(key) ||
      addressed.has(key) ||
      header.operations.some(
        (operation) =>
          operation.kind !== "load" &&
          operation.kind !== "constant" &&
          operation.kind !== "convert" &&
          operation !== comparison,
      )
    )
      continue;
    const incoming = predecessors.get(header.id)!;
    if (incoming.length !== 2) continue;
    const updates = incoming.flatMap((block) => {
      if (block.terminator.kind !== "jump" || block.terminator.target !== header.id) return [];
      const update = unitUpdate(block, counter, definitions);
      return update === undefined ? [] : [{ block, ...update }];
    });
    if (updates.length !== 1) continue;
    const update = updates[0]!;
    const preheader = incoming.find((block) => block !== update.block)!;
    if (preheader.terminator.kind !== "jump" || preheader.terminator.target !== header.id) continue;
    const initialization = preheader.operations
      .filter(
        (operation): operation is StoreOperation =>
          operation.kind === "store" &&
          operation.place.path.length === 0 &&
          bindingIdentityKey(operation.place.root) === key,
      )
      .at(-1);
    if (initialization === undefined) continue;
    let initial: number | BindingId | undefined = smallLiteral(literal(initialization.value));
    if (initial === undefined) {
      const value = definitions.get(initialization.value);
      if (
        value?.kind === "binary" &&
        value.operator === "+" &&
        value.integer?.width === 16 &&
        !value.integer.signed
      ) {
        const parent =
          literal(value.right) === 1n
            ? wordLoad(definitions.get(value.left))
            : literal(value.left) === 1n
              ? wordLoad(definitions.get(value.right))
              : undefined;
        initial = parent?.place.root;
      }
    }
    if (initial === undefined) continue;
    const body = blocks.get(header.terminator.whenTrue)!;
    const exit = blocks.get(header.terminator.whenFalse)!;
    const members = bodyMembers(body.id, header.id, exit.id, blocks);
    if (!members.has(update.block.id)) continue;
    let invalid = false;
    const exits: FixedLoopExit[] = [];
    for (const id of members) {
      const block = blocks.get(id)!;
      if (
        predecessors
          .get(id)!
          .some((previous) => !members.has(previous.id) && !(previous === header && id === body.id))
      )
        invalid = true;
      for (const target of successors(block)) {
        if (target === header.id && block !== update.block) invalid = true;
        if (target === exit.id) exits.push({ from: block, target, kind: "break" });
        else if (target === update.block.id && block !== update.block)
          exits.push({ from: block, target, kind: "update" });
      }
      if (block.terminator.kind === "return")
        exits.push({ from: block, target: null, kind: "return" });
      for (const operation of block.operations) {
        if (operation === update.store) continue;
        if (
          (operation.kind === "store" ||
            operation.kind === "aggregate" ||
            operation.kind === "call" ||
            operation.kind === "indirect-call") &&
          placeUses(operation).some((use) => bindingIdentityKey(use.place.root) === key)
        )
          invalid = true;
      }
    }
    if (invalid) continue;
    candidates.push({
      function: fn,
      counter,
      type: counterLoad.type,
      preheader,
      header,
      body,
      update: update.block,
      exit,
      initialization,
      comparison,
      increment: update.addition,
      updateStore: update.store,
      bound,
      members,
      definitions,
      initial,
      exits: Object.freeze(exits),
    });
  }
  return candidates;
}

/** Conditional maxima retain the actual load identities, not a binding-wide unproved range. */
function counterBounds(
  candidate: LoopCandidate,
  initial: FixedLoopDomain,
  active: boolean,
): ReadonlyMap<ValueId, bigint> {
  const bounds = new Map<ValueId, bigint>();
  const key = bindingIdentityKey(candidate.counter);
  const operations = candidate.function.blocks.flatMap((block) => block.operations);
  const literal = literalResolver(candidate.definitions);
  for (const operation of operations) {
    if (!("result" in operation) || operation.result === null) continue;
    const exact = literal(operation.result);
    if (exact !== undefined && exact >= 0n) bounds.set(operation.result, exact);
    else if (
      operation.type.kind === "enum" ||
      (operation.type.kind === "scalar" && operation.type.name === "byte")
    )
      bounds.set(operation.result, 255n);
  }
  for (const block of candidate.function.blocks)
    for (const operation of block.operations) {
      if (
        operation.kind !== "load" ||
        operation.place.path.length !== 0 ||
        bindingIdentityKey(operation.place.root) !== key
      )
        continue;
      if (block === candidate.header)
        bounds.set(operation.result, BigInt(Math.max(initial.maximum, candidate.bound)));
      else if (active && candidate.members.has(block.id))
        bounds.set(operation.result, BigInt(candidate.bound - 1));
    }
  // Only nonwrapping addition and value-preserving conversions add derived facts.
  // A wrapped address keeps its explicit interval/wrap proof in the observer query.
  let changed = true;
  while (changed) {
    changed = false;
    for (const operation of operations) {
      if (operation.kind !== "binary" && operation.kind !== "convert") continue;
      const integer = operation.integer;
      if (integer === null) continue;
      const limit = (1n << BigInt(integer.width - (integer.signed ? 1 : 0))) - 1n;
      let maximum: bigint | undefined;
      if (operation.kind === "convert") maximum = bounds.get(operation.operand);
      else if (operation.operator === "+") {
        const left = bounds.get(operation.left);
        const right = bounds.get(operation.right);
        if (left !== undefined && right !== undefined) maximum = left + right;
      }
      if (maximum === undefined || maximum > limit) continue;
      const previous = bounds.get(operation.result);
      if (previous === undefined || maximum < previous) {
        bounds.set(operation.result, maximum);
        changed = true;
      }
    }
  }
  return bounds;
}

/**
 * Recognize bounded source-word induction without rewriting its type, CFG or effects.
 * Domains are conditional on the retained observer premises: before any range is
 * used for another rewrite, final closure must exclude raw/borrow/firmware mutation
 * of both reference and selected counter homes. No pending premise is a certificate.
 * @param program Exact checked source program, independent of canonical allocation success.
 * @param nesting Optional paired checked-source context; missing depth is unknown, never guessed.
 * @returns Source-associated canonical loops; unsupported shapes keep ordinary lowering.
 * @throws {Error} If supplied nesting belongs to another source program or function.
 */
export function deriveFixedLoopFacts(
  program: WholeProgram,
  nesting?: SourceLoopNesting,
): readonly FixedLoopFacts[] {
  if (
    nesting !== undefined &&
    (nesting.program !== program ||
      nesting.loops.some(
        (loop) =>
          !program.semantic.functions.includes(loop.function) ||
          !Number.isInteger(loop.depth) ||
          loop.depth < 0 ||
          (loop.condition !== null &&
            (loop.condition.sourceId !== loop.function.source.sourceId ||
              loop.condition.start < loop.function.source.start ||
              loop.condition.end > loop.function.source.end)),
      ))
  )
    throw new Error("Loop nesting does not belong to the checked source program");
  const globals = new Set(program.semantic.globals.map((global) => bindingIdentityKey(global.id)));
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  const candidates = program.semantic.functions
    .filter((fn) => reached.has(bindingIdentityKey(fn.id)))
    .flatMap((fn) => loopCandidates(fn, globals));
  const facts = new Map<LoopCandidate, FixedLoopFacts>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of candidates) {
      if (facts.has(candidate)) continue;
      let parent: FixedLoopFacts | null = null;
      let initial: FixedLoopInitial;
      if (typeof candidate.initial === "number")
        initial = {
          kind: "constant",
          value: candidate.initial,
          domain: Object.freeze({ minimum: candidate.initial, maximum: candidate.initial }),
        };
      else {
        const parentCounter = candidate.initial;
        parent =
          [...facts.values()].find(
            (fact) =>
              fact.function === candidate.function &&
              bindingIdentityKey(fact.counter) === bindingIdentityKey(parentCounter) &&
              fact.members.has(candidate.preheader.id),
          ) ?? null;
        if (parent?.bodyDomain == null) continue;
        initial = {
          kind: "parent-next",
          parent: parent.counter,
          domain: Object.freeze({
            minimum: parent.bodyDomain.minimum + 1,
            maximum: parent.bodyDomain.maximum + 1,
          }),
        };
      }
      const active = initial.domain.minimum < candidate.bound;
      const bodyDomain = active
        ? Object.freeze({ minimum: initial.domain.minimum, maximum: candidate.bound - 1 })
        : null;
      const abrupt = candidate.exits.some(
        (exit) => exit.kind === "break" || exit.kind === "return",
      );
      const minimum = abrupt ? 0 : Math.max(0, candidate.bound - initial.domain.maximum);
      const maximum = Math.max(0, candidate.bound - initial.domain.minimum);
      const ordinary = candidate.function.blocks.flatMap((block) => block.operations);
      const outsideAccesses = candidate.function.blocks.flatMap((block) =>
        block === candidate.header || candidate.members.has(block.id)
          ? []
          : block.operations.filter(
              (operation) =>
                operation !== candidate.initialization &&
                placeUses(operation).some(
                  (use) =>
                    bindingIdentityKey(use.place.root) === bindingIdentityKey(candidate.counter),
                ),
            ),
      );
      const literal = literalResolver(candidate.definitions);
      const straight =
        candidate.members.size === 2 &&
        candidate.body.terminator.kind === "jump" &&
        candidate.body.terminator.target === candidate.update.id;
      const exact = initial.kind === "constant" && !abrupt ? maximum : null;
      const flatEight =
        exact === 8 &&
        straight &&
        candidate.body.operations.every(
          (operation) =>
            operation.kind !== "cpu-control" &&
            operation.kind !== "platform" &&
            ((operation.kind !== "memory-read" && operation.kind !== "memory-write") ||
              literal(operation.address) !== undefined),
        );
      const observerOperations = ordinary.filter(
        (operation) =>
          placeUses(operation).length > 0 ||
          operation.kind === "memory-read" ||
          operation.kind === "memory-write" ||
          operation.kind === "platform" ||
          operation.kind === "call" ||
          operation.kind === "indirect-call" ||
          operation.kind === "place-address",
      );
      facts.set(
        candidate,
        sealFixedLoopFacts({
          program,
          function: candidate.function,
          counter: candidate.counter,
          type: candidate.type,
          preheader: candidate.preheader,
          header: candidate.header,
          body: candidate.body,
          update: candidate.update,
          exit: candidate.exit,
          initialization: candidate.initialization,
          comparison: candidate.comparison,
          increment: candidate.increment,
          updateStore: candidate.updateStore,
          bound: candidate.bound,
          members: candidate.members,
          exits: Object.freeze(candidate.exits.map((exit) => Object.freeze(exit))),
          initial: Object.freeze(initial),
          bodyDomain,
          tripDomain: Object.freeze({ minimum, maximum }),
          exactIterations: exact,
          parent,
          depth:
            nesting?.loops.find(
              (loop) =>
                loop.function === candidate.function &&
                loop.condition !== null &&
                loop.condition.start <= candidate.comparison.span.start &&
                loop.condition.end >= candidate.comparison.span.end,
            )?.depth ?? null,
          outsideAccesses: Object.freeze(outsideAccesses),
          parameter: candidate.function.parameters.some(
            (parameter) =>
              bindingIdentityKey(parameter.id) === bindingIdentityKey(candidate.counter),
          ),
          flatEight,
          valueBounds: counterBounds(candidate, initial.domain, active),
          observerOperations: Object.freeze(observerOperations),
        }),
      );
      changed = true;
    }
  }
  return Object.freeze(
    candidates.flatMap((candidate) => {
      const fact = facts.get(candidate);
      return fact === undefined ? [] : [fact];
    }),
  );
}

/**
 * Hand conditional induction maxima to source queries without dropping their premises.
 * Every returned observer loop must be discharged for the whole selected tuple,
 * including when the range supports a non-loop rewrite and the loop stays original.
 * @param program Exact immutable source shared by the facts and downstream queries.
 * @param facts Recognized source induction facts, not final machine certificates.
 * @returns Source maxima plus all counter-home/visibility observer obligations.
 * @throws {Error} If a fact belongs to another source program or function.
 */
export function fixedLoopValueBounds(
  program: WholeProgram,
  facts: readonly FixedLoopFacts[],
): ClosedObjectValueBounds {
  const owners = new Map<SemanticFunction, Map<ValueId, bigint>>();
  for (const fact of facts) {
    if (fact.program !== program || !program.semantic.functions.includes(fact.function))
      throw new Error("Fixed-loop bounds do not belong to the checked source program");
    const values = owners.get(fact.function) ?? new Map<ValueId, bigint>();
    for (const [value, maximum] of fact.valueBounds) {
      if (typeof maximum !== "bigint" || maximum < 0n)
        throw new Error("Fixed-loop bounds contain an invalid unsigned maximum");
      const previous = values.get(value);
      if (previous === undefined || maximum < previous) values.set(value, maximum);
    }
    owners.set(fact.function, values);
  }
  return Object.freeze({ program, owners, observerLoops: Object.freeze([...facts]) });
}
