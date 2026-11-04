import { bindingIdentityKey, semanticTypeKey } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import { operationValueUses } from "../semantic/lower-control.js";
import { guardedOrdinalBounds } from "../semantic/guarded-place-proof.js";
import {
  FIXED_C64_CAPABILITIES,
  literalResolver,
  ordinalBoundResolver,
  placeMayEscapeRoot,
  placeUses,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";

/**
 * Make one conservative startup choice using facts already closed for lowering.
 * No new effect solver is introduced: missing call, alias or address facts keep
 * the full startup. Declared handlers count even when no installation is reached.
 * @param program Closed source identities and complete-place proof inputs.
 * @param allowOrdinaryWrites Permit fixed ordinary-RAM writes for a selected size
 *        candidate; none and the canonical reference keep the stricter choice.
 * @returns Whether every examined source owner is independent of display defaults.
 */
export function hasDisplayIndependentStartup(
  program: WholeProgram,
  allowOrdinaryWrites = false,
): boolean {
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  const bodies = [
    ...program.semantic.functions.filter(
      ({ id, entryKind }) => reached.has(bindingIdentityKey(id)) || entryKind === "interrupt",
    ),
    ...program.semantic.globals.filter(({ entry }) => entry !== null),
  ];
  const examined = new Set(bodies.map(({ id }) => bindingIdentityKey(id)));
  const globals = new Map(
    program.semantic.globals.map(({ id, type }) => [bindingIdentityKey(id), type]),
  );
  const functions = new Map(
    program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn]),
  );
  const unstable = new Set(program.semantic.globals.map(({ id }) => bindingIdentityKey(id)));
  /**
   * A certified returned-local destination is a caller-owned aggregate whose
   * address is used only to construct or return its own bytes. That private
   * capture cannot carry display state into an unrelated owner, so it does not
   * make the program display-dependent.
   */
  const returnedLocals = new Set(
    (program.returnedLocalDestinations ?? []).map(
      ({ function: owner, local }) => `${bindingIdentityKey(owner)}\0${bindingIdentityKey(local)}`,
    ),
  );
  if (program.semantic.globals.some(({ zeropage, placement }) => !zeropage && placement != null))
    return false;
  for (const body of bodies) {
    if (body.entry === null) continue;
    const blocks = reachableBlocks(body.entry, body.blocks);
    // Count existing semantic uses once. This only distinguishes a whole global
    // borrowed at one ordinary call from an address that can escape elsewhere;
    // it does not infer any callee effects. Every reached body is still checked.
    const uses = new Map<string, number>();
    const argumentsAtCalls = new Map<
      string,
      {
        readonly call: Extract<SemanticOperation, { readonly kind: "call" }>;
        readonly index: number;
      }
    >();
    for (const block of blocks) {
      for (const operation of block.operations) {
        for (const value of operationValueUses(operation))
          uses.set(value, (uses.get(value) ?? 0) + 1);
        if (operation.kind === "call")
          operation.arguments.forEach((value, index) =>
            argumentsAtCalls.set(value, { call: operation, index }),
          );
      }
      const value =
        block.terminator.kind === "branch"
          ? block.terminator.condition
          : block.terminator.kind === "return"
            ? block.terminator.value
            : null;
      if (value !== null) uses.set(value, (uses.get(value) ?? 0) + 1);
    }
    const definitions = valueDefinitions(blocks);
    const literal = literalResolver(definitions);
    const ordinalBound = ordinalBoundResolver(definitions, literal);
    const parameterRoots = new Map(
      ("parameters" in body ? body.parameters : []).map(
        (parameter) => [bindingIdentityKey(parameter.id), parameter] as const,
      ),
    );
    // A raw address may be a literal base plus a bounded unsigned index. The guard
    // proof reports the exact inclusive maximum; every possible byte is checked below.
    const rawAddressBounds = new Map<
      Extract<SemanticOperation, { readonly kind: "memory-read" | "memory-write" }>,
      { readonly base: bigint; readonly maximum: bigint }
    >();
    const guarded = guardedOrdinalBounds(
      body.entry,
      blocks,
      definitions,
      unstable,
      literal,
      ordinalBound,
      (operation) => operation.kind === "memory-write",
      (operation, bound) => {
        if (operation.kind !== "memory-read" && operation.kind !== "memory-write") return;
        const address = definitions.get(operation.address);
        if (
          address?.kind !== "binary" ||
          address.operator !== "+" ||
          address.integer?.signed !== false
        )
          return;
        const base = literal(address.left) ?? literal(address.right);
        const maximum = bound(operation.address);
        if (base !== undefined && maximum !== undefined && maximum >= base)
          rawAddressBounds.set(operation, { base, maximum });
      },
    );
    for (const block of blocks) {
      for (const operation of block.operations) {
        if (operation.kind === "place-address") {
          const returnedAddress =
            operation.place.path.length === 0 &&
            returnedLocals.has(
              `${bindingIdentityKey(body.id)}\0${bindingIdentityKey(operation.place.root)}`,
            );
          if (returnedAddress) continue;
          if (operation.captureValue === true) return false;
          const globalType = globals.get(bindingIdentityKey(operation.place.root));
          // A const aggregate parameter is a compiler-owned whole object whose type is
          // fixed at its call sites. Passing it onward borrows the same bytes and cannot
          // introduce display state; the caller's root is checked in its own body.
          const parameterRoot = parameterRoots.get(bindingIdentityKey(operation.place.root));
          const rootType = globalType ?? parameterRoot?.type;
          const argument = argumentsAtCalls.get(operation.result);
          const callee =
            argument === undefined
              ? undefined
              : functions.get(bindingIdentityKey(argument.call.callee));
          const parameter = argument === undefined ? undefined : callee?.parameters[argument.index];
          if (
            operation.place.asset !== undefined ||
            operation.place.path.length !== 0 ||
            operation.place.rootType === undefined ||
            (operation.type.kind !== "array" && operation.type.kind !== "struct") ||
            rootType === undefined ||
            parameterRoot?.outerUnsized === true ||
            uses.get(operation.result) !== 1 ||
            callee === undefined ||
            callee.entryKind === "interrupt" ||
            !examined.has(bindingIdentityKey(callee.id)) ||
            parameter === undefined ||
            parameter.outerUnsized === true ||
            semanticTypeKey(rootType) !== semanticTypeKey(operation.type) ||
            semanticTypeKey(operation.place.rootType) !== semanticTypeKey(operation.type) ||
            semanticTypeKey(parameter.type) !== semanticTypeKey(operation.type)
          )
            return false;
        }
        if (operation.kind === "embedded-address" || operation.kind === "indirect-call")
          return false;
        if (operation.kind === "call" && !examined.has(bindingIdentityKey(operation.callee)))
          return false;
        for (const use of placeUses(operation)) {
          // The returned-local certificate already proves every indexed use of
          // its own root stays inside the source object.
          const certifiedReturnedLocal = returnedLocals.has(
            `${bindingIdentityKey(body.id)}\0${bindingIdentityKey(use.place.root)}`,
          );
          if (
            !certifiedReturnedLocal &&
            use.place.path.some(({ kind }) => kind === "index") &&
            placeMayEscapeRoot(
              use,
              (value) => guarded.get(operation)?.get(value) ?? ordinalBound(value),
            )
          )
            return false;
        }
        if (
          operation.kind === "platform" &&
          (!FIXED_C64_CAPABILITIES.has(operation.capability) ||
            operation.capability.startsWith("c64.vic.") ||
            operation.capability.startsWith("c64.video."))
        )
          return false;
        if (operation.kind === "memory-read" || operation.kind === "memory-write") {
          const address = literal(operation.address);
          const bounded = rawAddressBounds.get(operation);
          if (
            address !== undefined
              ? !rawAccessIndependent(
                  address,
                  operation.width,
                  operation.kind === "memory-write",
                  allowOrdinaryWrites,
                )
              : bounded === undefined ||
                !boundedRawAccessIndependent(
                  bounded.base,
                  bounded.maximum,
                  operation.width,
                  operation.kind === "memory-write",
                  allowOrdinaryWrites,
                )
          )
            return false;
        }
      }
    }
  }
  return true;
}

/**
 * Check every byte of a proven address range. The range is accepted only when the
 * base is literal, the maximum is an inclusive guarded bound and both stay small
 * enough that exhaustive checking is finite.
 */
function boundedRawAccessIndependent(
  base: bigint,
  maximum: bigint,
  width: number,
  write: boolean,
  allowOrdinaryWrites: boolean,
): boolean {
  if (base < 0n || maximum < base || maximum - base > 255n || width < 1) return false;
  const last = maximum + BigInt(width) - 1n;
  if (last > 0xffffn) return false;
  for (let byte = base; byte <= last; byte += 1n)
    if (!rawAccessIndependent(byte, 1, write, allowOrdinaryWrites)) return false;
  return true;
}

/**
 * Only fixed non-display reads and named-device regions have a disjoint footprint.
 * RAM writes can change an alias or code; CPU/CIA2 bank writes can select new display
 * data. Those remain unknown here. Word accesses include wrap and both bytes.
 */
function rawAccessIndependent(
  address: bigint | undefined,
  width: number,
  write: boolean,
  allowOrdinaryWrites: boolean,
): boolean {
  if (address === undefined) return false;
  for (let offset = 0; offset < width; offset += 1) {
    const byte = Number(BigInt.asUintN(16, address + BigInt(offset)));
    const register = byte & 15;
    if (byte >= 0xdc00 && byte <= 0xdcff) continue;
    if (byte >= 0xdd00 && byte <= 0xddff && register !== 0 && register !== 2) continue;
    if (byte >= 0xd400 && byte <= 0xd7ff) continue;
    if (!write && ((byte >= 0x4000 && byte <= 0xcfff) || byte >= 0xe000)) continue;
    // A fixed ordinary-RAM write does not change the VIC/CIA/CPU bank view. The
    // size candidate still needs its final alias/code observer proof; this only
    // admits the startup construction axis.
    if (allowOrdinaryWrites && write && byte >= 0x0200 && byte <= 0xcfff) continue;
    return false;
  }
  return true;
}
