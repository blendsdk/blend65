import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticGlobal, SemanticProgram } from "./operations.js";
import { reachableBlocks } from "./value-lifetimes.js";
import {
  FIXED_C64_CAPABILITIES,
  literalResolver,
  ordinalBoundResolver,
  placeMayEscapeRoot,
  placeUses,
  platformIsDisjoint,
  profileFor,
  rawMayObserve,
  rawMaySelectHardwareRam,
  valueDefinitions,
} from "./aggregate-place-proof.js";
import type { AddressSpace } from "./aggregate-place-proof.js";

/** Only explicitly private, unconstrained, never-initialized module data is eligible. */
function removable(global: SemanticGlobal): boolean {
  return (
    global.storage === "module" &&
    global.exported === false &&
    global.entry === null &&
    global.initialBytes === null &&
    global.runtimeInitialBytes === null &&
    global.placement == null &&
    !global.zeropage
  );
}

/**
 * Select globals once, before reservation, function storage and layout consume them.
 * Unknown observers retain all candidates rather than adding errors or runtime checks.
 * No semantic operation, initializer or source identity is changed by this selection.
 *
 * @param semantic Original closed-program source bodies and visibility provenance.
 * @param reached Full identities of functions reached from actual executable roots.
 * @param addressSpace Selected inclusive RAM/ZP windows, when the caller has proved them.
 * @returns The original program when nothing can be removed, otherwise an immutable selection.
 */
export function retainObservableGlobals(
  semantic: SemanticProgram,
  reached: ReadonlySet<string>,
  addressSpace?: AddressSpace,
): SemanticProgram {
  const candidates = new Set(
    semantic.globals.filter(removable).map(({ id }) => bindingIdentityKey(id)),
  );
  if (candidates.size === 0) return semantic;
  const retained = new Set<string>();
  // An address can escape through a cold owner. It remains a source dependency,
  // even though that owner's executable body itself is not a root.
  for (const owner of [...semantic.functions, ...semantic.globals])
    for (const block of owner.blocks)
      for (const operation of block.operations)
        if (operation.kind === "place-address")
          retained.add(bindingIdentityKey(operation.place.root));

  const windows =
    addressSpace === undefined ? undefined : [...addressSpace.ram, ...addressSpace.zeroPage];
  const profile = profileFor(addressSpace);
  let platformDisjoint: boolean | undefined;
  const bodies = [
    ...semantic.functions.filter(({ id }) => reached.has(bindingIdentityKey(id))),
    ...semantic.globals.filter(({ entry }) => entry !== null),
  ];
  for (const body of bodies) {
    if (body.entry === null) continue;
    const blocks = reachableBlocks(body.entry, body.blocks);
    const definitions = valueDefinitions(blocks);
    const literal = literalResolver(definitions);
    const ordinalBound = ordinalBoundResolver(definitions, literal);
    for (const block of blocks) {
      for (const operation of block.operations) {
        for (const use of placeUses(operation)) {
          retained.add(bindingIdentityKey(use.place.root));
          if (
            use.place.path.some(({ kind }) => kind === "index") &&
            placeMayEscapeRoot(use, ordinalBound)
          )
            return semantic;
        }
        if (
          (operation.kind === "memory-read" || operation.kind === "memory-write") &&
          rawMayObserve(literal(operation.address), operation.width, windows)
        )
          return semantic;
        if (
          operation.kind === "memory-write" &&
          rawMaySelectHardwareRam(literal(operation.address), operation.width, profile)
        )
          return semantic;
        if (operation.kind === "platform") {
          if (!FIXED_C64_CAPABILITIES.has(operation.capability)) return semantic;
          platformDisjoint ??= platformIsDisjoint(addressSpace, profile);
          if (!platformDisjoint) return semantic;
        }
      }
    }
  }
  const globals = semantic.globals.filter(({ id }) => {
    const key = bindingIdentityKey(id);
    return !candidates.has(key) || retained.has(key);
  });
  return globals.length === semantic.globals.length
    ? semantic
    : Object.freeze({ ...semantic, globals: Object.freeze(globals) });
}
