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
import type { MemoryReadOperation, SemanticFunction } from "../semantic/operations.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import type { MachineInstruction, MachineLoweringInput } from "./machine-types.js";

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
 * @returns Whether the existing facts exclude relevant observers, without guessing.
 */
export function hasUnobservedByteCapture(
  input: MachineLoweringInput,
  source: SemanticFunction,
  capture: MemoryReadOperation,
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
            if (
              address === undefined ||
              rawMaySelectHardwareRam(address, operation.width, input.profile)
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
 * Tie an adjacent comparison reload to its actual fresh source read and private save.
 * Missing or ambiguous instruction/source ownership keeps the original reload.
 * This grants no general accumulator availability across instructions or calls.
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
    producer.memory.length !== 1 ||
    producer.memory[0]!.kind !== "read" ||
    producer.memory[0]!.width !== 1 ||
    !producer.memory[0]!.volatile ||
    store?.opcode !== "sta"
  )
    return false;
  const operations = source.blocks.flatMap(({ operations }) => operations);
  const captures = operations.filter(
    (operation) => operation.kind === "memory-read" && operation.span === producer.source,
  );
  const stores = operations.filter(
    (operation) => operation.kind === "store" && operation.span === store.source,
  );
  const capture = captures[0];
  const save = stores[0];
  return (
    captures.length === 1 &&
    capture?.kind === "memory-read" &&
    stores.length === 1 &&
    save?.kind === "store" &&
    save.value === capture.result &&
    save.place.path.length === 0 &&
    save.type.kind === "scalar" &&
    save.type.name === "byte" &&
    hasUnobservedByteCapture(input, source, capture)
  );
}
