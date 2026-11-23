import { bindingIdentityKey } from "../frontend/semantic-types.js";
import {
  FIXED_C64_CAPABILITIES,
  literalResolver,
  ordinalBoundResolver,
  placeMayEscapeRoot,
  placeUses,
  platformIsDisjoint,
  rawMayObserve,
  rawMaySelectHardwareRam,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import type {
  MemoryReadOperation,
  MemoryWriteOperation,
  SemanticFunction,
} from "../semantic/operations.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import type { InterferenceEdge } from "../storage/storage-types.js";
import type { MachineInstruction, MachineLoweringInput } from "./machine-types.js";

/** Exact source publications whose complete hardware fetches stay in immutable asset storage. */
export interface ByteCapturePublicationProof {
  /** Closed program from which the publication proof was derived. */
  readonly program: WholeProgram;
  /** Actual exclusively-main source owner, not an equal-looking replacement. */
  readonly source: SemanticFunction;
  /** Original source writes proved to publish only disjoint immutable asset bytes. */
  readonly writes: ReadonlySet<MemoryWriteOperation>;
}

/**
 * Exclude observers before an exact fresh byte capture remains in A instead of its home.
 *
 * A named local with no address uses can still be observed through raw addresses
 * or unchecked array selections. Reuse the closed domains and existing bounded
 * address/place queries, checking every reachable owner and executable initializer.
 * The complete admitted SFA windows remain valid when final layout moves homes;
 * one provisional address would not establish that property.
 *
 * Only this exclusively-main owner's exact initial read is exempt. It precedes
 * the original private store. If its fixed RAM address eventually equals the
 * home, that store merely writes back the same byte. Other raw/indexed observers,
 * asynchronous writes, unknown banking and persistent hardware RAM publication
 * retain the old selection. Nothing here changes source acceptance or allocation.
 * @param input Existing closed program and complete selected-profile storage windows.
 * @param source The actual source owner of the selected main-domain capture.
 * @param capture The unique fresh, fixed-address one-byte read before its save.
 * @param publicationProof Optional exact asset-publication proof for an anonymous value only.
 * @returns Whether the existing facts exclude relevant observers, without guessing.
 */
export function hasUnobservedByteCapture(
  input: MachineLoweringInput,
  source: SemanticFunction,
  capture: MemoryReadOperation,
  publicationProof?: ByteCapturePublicationProof,
): boolean {
  const program = input.program;
  if (
    !program.semantic.functions.includes(source) ||
    program.executionDomains === undefined ||
    program.interruptContextAnalysis === undefined ||
    program.interruptContextAnalysis.diagnostics.length !== 0 ||
    capture.width !== 1
  )
    return false;
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  const domains = new Map(
    program.executionDomains.map((entry) => [bindingIdentityKey(entry.function), entry.domains]),
  );
  const key = bindingIdentityKey(source.id);
  const ownDomains = domains.get(key);
  if (!reached.has(key) || ownDomains?.length !== 1 || ownDomains[0] !== "main") return false;
  const ownBlocks = reachableBlocks(source.entry, source.blocks);
  if (ownBlocks.flatMap(({ operations }) => operations).filter((op) => op === capture).length !== 1)
    return false;
  if (literalResolver(valueDefinitions(ownBlocks))(capture.address) === undefined) return false;
  const functions = program.semantic.functions.filter(({ id }) =>
    reached.has(bindingIdentityKey(id)),
  );
  if (
    functions.length !== reached.size ||
    functions.some(({ id }) => (domains.get(bindingIdentityKey(id))?.length ?? 0) === 0)
  )
    return false;
  const windows = [...input.profile.storage.ram, ...input.profile.storage.zeroPage];
  const platformDisjoint = platformIsDisjoint(input.profile.storage, input.profile);
  const bodies = [...functions, ...program.semantic.globals.filter(({ entry }) => entry !== null)];
  for (const body of bodies) {
    if (body.entry === null) continue;
    const asynchronous =
      domains.get(bindingIdentityKey(body.id))?.some((domain) => domain !== "main") ?? false;
    const blocks = reachableBlocks(body.entry, body.blocks);
    const definitions = valueDefinitions(blocks);
    const literal = literalResolver(definitions);
    const bound = ordinalBoundResolver(definitions, literal);
    for (const { operations } of blocks) {
      for (const operation of operations) {
        if (
          placeUses(operation).some(
            (use) =>
              use.place.path.some(({ kind }) => kind === "index") && placeMayEscapeRoot(use, bound),
          )
        )
          return false;
        if (operation.kind === "memory-read" || operation.kind === "memory-write") {
          const address = literal(operation.address);
          const initialRead = body === source && operation === capture && !asynchronous;
          if (
            !initialRead &&
            (operation.kind === "memory-read" || asynchronous) &&
            rawMayObserve(address, operation.width, windows)
          )
            return false;
          if (operation.kind === "memory-write") {
            const provedPublication =
              publicationProof?.program === program &&
              publicationProof.source === source &&
              body === source &&
              !asynchronous &&
              publicationProof.writes.has(operation);
            if (
              address === undefined ||
              (rawMaySelectHardwareRam(address, operation.width, input.profile) &&
                !provedPublication)
            )
              return false;
            // Processor-port writes can change the address space, including a
            // word wrapping from $FFFF onto $0000. Check every written byte.
            for (let offset = 0; offset < operation.width; offset += 1)
              if (BigInt.asUintN(16, address + BigInt(offset)) <= 1n) return false;
          }
        }
        if (
          operation.kind === "platform" &&
          (!FIXED_C64_CAPABILITIES.has(operation.capability) || !platformDisjoint)
        )
          return false;
      }
    }
  }
  return true;
}

/**
 * Prove that nothing can run between a private store and the instruction after it.
 *
 * Omitting a reload of the byte just stored replaces a memory read with the
 * register the store left untouched. The two instructions are adjacent, so no
 * other generated code intervenes; the only way the home could change in between
 * is an interrupt whose handler writes it. When every reachable body and every
 * executable initializer belongs to the main domain alone, no author code runs
 * asynchronously at all and the question cannot arise.
 *
 * This is deliberately narrower than the raw-capture proof beside it rather than
 * a reuse of it. That proof must also exclude a fixed raw address aliasing the
 * home it is about to fill, which a typed load cannot do because it names its
 * source through the type system and performs no raw access. A program that does
 * install a handler keeps its reload; proving a handler cannot reach one
 * particular compiler-chosen home is a separate question from this one.
 * @param input Existing closed program and execution-domain facts.
 * @param source The actual source owner of the adjacent store.
 * @returns Whether no author code can execute between the store and the next instruction.
 */
export function hasNoAsynchronousInterleaving(
  input: MachineLoweringInput,
  source: SemanticFunction,
): boolean {
  const program = input.program;
  if (
    !program.semantic.functions.includes(source) ||
    program.executionDomains === undefined ||
    program.interruptContextAnalysis === undefined ||
    program.interruptContextAnalysis.diagnostics.length !== 0
  )
    return false;
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  if (!reached.has(bindingIdentityKey(source.id)) || source.entryKind === "interrupt") return false;
  const domains = new Map(
    program.executionDomains.map((entry) => [bindingIdentityKey(entry.function), entry.domains]),
  );
  // Every reachable function must be classified. An unclassified one is not
  // evidence of a main-only program; it means the analysis never described it.
  const functions = program.semantic.functions.filter(({ id }) =>
    reached.has(bindingIdentityKey(id)),
  );
  if (functions.length !== reached.size) return false;
  for (const body of functions) {
    const own = domains.get(bindingIdentityKey(body.id));
    if (own === undefined || own.length === 0) return false;
    if (own.some((domain) => domain !== "main")) return false;
    if (body.entryKind === "interrupt") return false;
  }
  // An initializer runs once from startup, which is the main domain by
  // construction, so it is classified only when something else also reaches it.
  return program.semantic.globals.every(
    ({ id, entry }) =>
      entry === null ||
      (domains.get(bindingIdentityKey(id)) ?? ["main"]).every((domain) => domain === "main"),
  );
}

/** Direct addressing modes that name one fixed byte without an index register. */
const DIRECT_MODES = new Set(["absolute", "zero-page", "storage"]);

/** One named data byte addressed plainly, with no layout relation of its own. */
function plainNamedByte(
  operand: MachineInstruction["operand"],
): { readonly label: string; readonly offset: number } | undefined {
  return operand?.kind === "label" &&
    operand.addressByte === undefined &&
    operand.transform === undefined &&
    operand.addressTransform === undefined
    ? Object.freeze({ label: operand.label, offset: operand.offset ?? 0 })
    : undefined;
}

/** One plainly addressed byte: declared module data, or a compiler-chosen home. */
type SourceByte =
  | { readonly kind: "named"; readonly label: string; readonly offset: number }
  | { readonly kind: "home"; readonly requestId: string; readonly offset: number };

/** The byte one operand addresses plainly, or nothing when it addresses no single byte. */
function plainSourceByte(operand: MachineInstruction["operand"]): SourceByte | undefined {
  const named = plainNamedByte(operand);
  if (named !== undefined) return Object.freeze({ kind: "named" as const, ...named });
  return operand?.kind === "storage" && operand.addressByte === undefined
    ? Object.freeze({
        kind: "home" as const,
        requestId: operand.requestId,
        offset: operand.offset ?? 0,
      })
    : undefined;
}

/** Whether two plain operands address the very same byte. */
function sameSourceByte(read: SourceByte, again: SourceByte): boolean {
  if (read.kind === "named")
    return again.kind === "named" && read.label === again.label && read.offset === again.offset;
  return (
    again.kind === "home" && read.requestId === again.requestId && read.offset === again.offset
  );
}

/** Whether allocation was told these two requests can never share one address. */
function cannotShareAddress(
  edges: readonly InterferenceEdge[],
  one: string,
  other: string,
): boolean {
  return edges.some(
    ({ left, right }) => (left === one && right === other) || (left === other && right === one),
  );
}

/**
 * Whether one store writes somewhere the source byte provably is not.
 *
 * Three of the four pairings are settled by allocation's own partitioning: a
 * compiler-chosen home is placed away from declared data, so neither can ever be
 * the byte the other names, and two different declared names are two different
 * objects. The same name is the source itself, and ends the window.
 *
 * Two homes are the case that needs a fact from outside these instructions,
 * because nothing stops the allocator from giving one address to two homes whose
 * lifetimes do not overlap. The statement that these two cannot is exactly an
 * interference edge, so it is read off the graph the allocator was handed rather
 * than inferred from no conflict having been reported.
 */
function writesElsewhere(
  store: MachineInstruction,
  read: SourceByte,
  interference: readonly InterferenceEdge[],
): boolean {
  const written = plainSourceByte(store.operand);
  if (written === undefined) return false;
  if (read.kind !== written.kind) return true;
  if (read.kind === "named") return written.kind === "named" && written.label !== read.label;
  return (
    written.kind === "home" &&
    read.requestId !== written.requestId &&
    cannotShareAddress(interference, read.requestId, written.requestId)
  );
}

/**
 * Prove that a source byte already in A is the same byte a second load would fetch.
 *
 * `LDA source; STA elsewhere; LDA source` reads memory twice for one value. The
 * store writes neither the accumulator nor any flag, so by the time the second
 * load would run, A already holds the byte and N and Z already describe it: the
 * load is architecturally a complete no-op, not merely a value the consumer could
 * have taken from a register. That is why no separate flag proof is needed here,
 * unlike an omission whose producer sets different flags from the load it replaces.
 *
 * What remains is the one thing generated code cannot settle on its own — whether
 * anything can write the source between the two instructions. Only an interrupt
 * can run there, so the adjacency proof beside this one carries the whole weight.
 *
 * Deliberately narrow. The two loads must address one plain byte directly, which
 * excludes an indexed form whose byte depends on a register, a layout-resolved
 * address relation, and any raw or volatile access, because a volatile read is two
 * bus accesses by contract. The source may be declared data or a compiler-chosen
 * home; what differs between the two is only how the store is proved to write
 * somewhere else. This is not a widening of the capture window above: that
 * one removes a reload of the home a store just filled, and is proved from the store,
 * while this one removes a repeat of a read and is proved from the earlier load.
 *
 * Only the optimized-candidate construction omits the load. Canonical direct
 * lowering is the reference a build is measured against, so improving it would
 * move the baseline rather than meet it.
 * @param input Existing closed source/domain/profile facts.
 * @param source The actual function body, absent for a generated initializer.
 * @param instructions The already-selected prefix, ending with the intervening store.
 * @param selected The operation's own instructions, which may open with the repeat.
 * @returns Whether this one repeated source load can be dropped outright.
 */
export function canOmitRepeatedSourceLoad(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  instructions: readonly MachineInstruction[],
  selected: readonly MachineInstruction[],
): boolean {
  if (source === undefined || input.optimizationFacts === undefined) return false;
  // Dropping the head of a lone instruction would leave the operation with no
  // generated code at all, which is a different claim from the one made here.
  if (selected.length < 2) return false;
  const repeated = selected[0];
  const store = instructions.at(-1);
  const producer = instructions.at(-2);
  if (repeated?.opcode !== "lda" || producer?.opcode !== "lda" || store?.opcode !== "sta")
    return false;
  // A typed access carries no memory effect at all; a raw or volatile one does.
  if (repeated.memory.length !== 0 || producer.memory.length !== 0 || store.memory.length !== 0)
    return false;
  if (!DIRECT_MODES.has(repeated.mode) || repeated.mode !== producer.mode) return false;
  if (!DIRECT_MODES.has(store.mode)) return false;
  const read = plainSourceByte(producer.operand);
  const again = plainSourceByte(repeated.operand);
  if (read === undefined || again === undefined) return false;
  if (!sameSourceByte(read, again)) return false;
  if (!writesElsewhere(store, read, input.storageInterference ?? [])) return false;
  return hasNoAsynchronousInterleaving(input, source);
}

/**
 * Tie an adjacent comparison reload to its actual fresh source read and private save.
 * Missing or ambiguous instruction/source ownership keeps the original reload.
 * This grants no general accumulator availability across instructions or calls.
 *
 * Two producers qualify, proved separately rather than by one relaxed test. A
 * volatile raw read keeps the existing observer proof unchanged. An ordinary
 * typed byte load performs no raw access, so it is held to the adjacency proof
 * above instead; neither case weakens the other's barriers.
 *
 * Only the optimized-candidate construction omits the reload. Canonical direct
 * lowering is the reference a build is measured against, so improving it would
 * move the baseline rather than meet it.
 * @param input Existing closed source/domain/profile facts.
 * @param source The actual function body, absent for a generated initializer.
 * @param instructions The already-selected prefix ending with the private save.
 * @returns Whether this one comparison capture has no relevant external observer.
 */
export function canOmitComparisonCaptureReload(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  instructions: readonly MachineInstruction[],
): boolean {
  const producer = instructions.at(-2);
  const store = instructions.at(-1);
  if (
    source === undefined ||
    producer?.opcode !== "lda" ||
    !["absolute", "zero-page"].includes(producer.mode) ||
    store?.opcode !== "sta"
  )
    return false;
  const effect = producer.memory[0];
  const volatileRead =
    producer.memory.length === 1 &&
    effect?.kind === "read" &&
    effect.width === 1 &&
    effect.volatile === true;
  // A typed load reads its named source directly. Carrying no memory effect at
  // all is what distinguishes it from the raw window above.
  const ordinaryLoad =
    producer.memory.length === 0 &&
    producer.operand?.kind === "label" &&
    input.optimizationFacts !== undefined;
  if (!volatileRead && !ordinaryLoad) return false;
  const operations = source.blocks.flatMap(({ operations }) => operations);
  const stores = operations.filter(
    (operation) => operation.kind === "store" && operation.span === store.source,
  );
  const save = stores[0];
  if (
    stores.length !== 1 ||
    save?.kind !== "store" ||
    save.place.path.length !== 0 ||
    save.type.kind !== "scalar" ||
    save.type.name !== "byte"
  )
    return false;
  if (volatileRead) {
    const captures = operations.filter(
      (operation) => operation.kind === "memory-read" && operation.span === producer.source,
    );
    const capture = captures[0];
    return (
      captures.length === 1 &&
      capture?.kind === "memory-read" &&
      save.value === capture.result &&
      hasUnobservedByteCapture(input, source, capture)
    );
  }
  // The instruction carries the whole declaration's span while the load carries
  // only the read's, so the two are tied through the stored value instead. That
  // is the stronger link in any case: it names the exact value this store wrote.
  const definitions = operations.filter(
    (operation) => "result" in operation && operation.result === save.value,
  );
  const load = definitions[0];
  return (
    definitions.length === 1 &&
    load?.kind === "load" &&
    // One whole named byte. A component read or a wider type would not be the
    // value this single instruction leaves in the accumulator.
    load.place.path.length === 0 &&
    load.type.kind === "scalar" &&
    load.type.name === "byte" &&
    hasNoAsynchronousInterleaving(input, source)
  );
}
