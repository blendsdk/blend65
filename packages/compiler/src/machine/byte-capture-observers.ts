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
