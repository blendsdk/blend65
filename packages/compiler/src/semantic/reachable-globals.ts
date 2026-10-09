import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType, StructFieldType } from "../frontend/semantic-types.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type { StorageRange } from "../storage/storage-types.js";
import { selectTargetProfile } from "../target/profile.js";
import type { TargetProfile } from "../target/profile.js";
import type {
  ConvertOperation,
  SemanticBlock,
  SemanticGlobal,
  SemanticOperation,
  SemanticPlace,
  SemanticProgram,
  ValueId,
} from "./operations.js";
import { reachableBlocks } from "./value-lifetimes.js";

/** Inclusive allocation windows already supplied to whole-program closure. */
type AddressSpace = Pick<TargetProfile["storage"], "ram" | "zeroPage">;

/**
 * Only these current C64 operations have proved scalar/handler inputs and fixed
 * device/vector effects. A new capability is deliberately unknown until its
 * memory contract is checked; profile membership alone does not grant an exemption.
 */
const FIXED_C64_CAPABILITIES: ReadonlySet<string> = new Set([
  "c64.cia1.configureTimerA",
  "c64.cia1.configureTimerB",
  "c64.cia1.disableInterruptSources",
  "c64.cia1.enableInterruptSources",
  "c64.cia1.readAndClearPendingSources",
  "c64.cia1.readTimerACounter",
  "c64.cia1.readTimerBCounter",
  "c64.cia1.writeTimerALatch",
  "c64.cia1.writeTimerBLatch",
  "c64.cia2.configureTimerA",
  "c64.cia2.configureTimerB",
  "c64.cia2.disableInterruptSources",
  "c64.cia2.enableInterruptSources",
  "c64.cia2.readAndClearPendingSources",
  "c64.cia2.readTimerACounter",
  "c64.cia2.readTimerBCounter",
  "c64.cia2.writeTimerALatch",
  "c64.cia2.writeTimerBLatch",
  "c64.input.joystickDown",
  "c64.input.joystickFire",
  "c64.input.joystickLeft",
  "c64.input.joystickRight",
  "c64.input.joystickUp",
  "c64.input.readJoystick1",
  "c64.input.readJoystick2",
  "c64.system.restoreIRQ",
  "c64.system.restoreNMI",
  "c64.system.setIRQ",
  "c64.system.setIRQExclusive",
  "c64.system.setNMI",
  "c64.system.setNMIExclusive",
  "c64.vic.readAndClearSpriteBackgroundCollisions",
  "c64.vic.readAndClearSpriteSpriteCollisions",
  "c64.vic.setBorderColor",
  "c64.vic.setSpriteColor",
  "c64.vic.setSpriteEnabled",
  "c64.vic.setSpritePointer",
  "c64.vic.setSpritePosition",
  "c64.vic.vicSpriteBlock",
  "c64.video.waitNextFrame",
]);

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
 * Resolve body-local integer literals/conversions without executing arithmetic or
 * following mutable storage. Memoization handles definition order and shared chains;
 * iterative traversal keeps long chains off the host stack. Cycles remain unknown.
 */
function literalResolver(blocks: readonly SemanticBlock[]): (value: ValueId) => bigint | undefined {
  const definitions = new Map<ValueId, SemanticOperation>();
  for (const block of blocks)
    for (const operation of block.operations)
      if ("result" in operation && operation.result !== null)
        definitions.set(operation.result, operation);
  const memo = new Map<ValueId, bigint | undefined>();
  return (value) => {
    let cursor = value;
    let result: bigint | undefined;
    const seen = new Set<ValueId>();
    const conversions: ConvertOperation[] = [];
    while (!memo.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      const operation = definitions.get(cursor);
      if (operation?.kind === "constant" && typeof operation.value === "bigint") {
        result = operation.value;
        break;
      }
      if (operation?.kind !== "convert" || operation.integer === null) break;
      conversions.push(operation);
      cursor = operation.operand;
    }
    if (memo.has(cursor)) result = memo.get(cursor);
    else memo.set(cursor, result);
    for (const conversion of conversions.reverse()) {
      if (result !== undefined && conversion.integer !== null) {
        const { width, signed } = conversion.integer;
        result = signed ? BigInt.asIntN(width, result) : BigInt.asUintN(width, result);
      }
      memo.set(conversion.result, result);
    }
    return result;
  };
}

/** Test every accessed byte independently, including a word crossing $FFFF to $0000. */
function rawMayObserve(
  address: bigint | undefined,
  width: number,
  windows: readonly StorageRange[] | undefined,
): boolean {
  if (address === undefined || windows === undefined) return true;
  for (let offset = 0; offset < width; offset += 1) {
    const byte = Number(BigInt.asUintN(16, address + BigInt(offset)));
    if (windows.some(({ start, end }) => byte >= start && byte <= end)) return true;
  }
  return false;
}

/** One explicit source place and the complete width consumed at that place. */
interface PlaceUse {
  /** Root identity and already evaluated field/index path. */
  readonly place: SemanticPlace;
  /** All bytes read/written; an uncaptured address only selects a location. */
  readonly width: number;
}

/** Include hidden aggregate destinations as well as ordinary explicit place operations. */
function placeUses(operation: SemanticOperation): readonly PlaceUse[] {
  if (operation.kind === "load" || operation.kind === "store")
    return [{ place: operation.place, width: semanticTypeSize(operation.type) }];
  if (operation.kind === "place-address")
    return [
      {
        place: operation.place,
        width: operation.captureValue ? semanticTypeSize(operation.type) : 0,
      },
    ];
  if (
    operation.kind === "aggregate" ||
    operation.kind === "call" ||
    operation.kind === "indirect-call"
  ) {
    const destination =
      operation.kind === "aggregate" ? operation.destination : operation.aggregateDestination;
    if (destination?.kind === "place")
      return [{ place: destination.place, width: semanticTypeSize(operation.type) }];
  }
  return [];
}

/**
 * A declared array extent is not an ordinal proof. Check every selection, packed
 * field offset, element stride and the final accessed width against the root.
 * Unknown local/borrowed indices can alias unnamed globals just like global indices.
 */
function indexedMayObserve(
  use: PlaceUse,
  literal: (value: ValueId) => bigint | undefined,
): boolean {
  if (!use.place.path.some(({ kind }) => kind === "index")) return false;
  const rootType = use.place.rootType;
  if (rootType === undefined) return true;
  let type: SemanticType = rootType;
  const rootSize = semanticTypeSize(type);
  let offset = 0;
  for (const selection of use.place.path) {
    if (selection.kind === "field") {
      if (type.kind !== "struct") return true;
      const field: StructFieldType | undefined = type.fields.find(
        ({ name }) => name === selection.name,
      );
      if (field === undefined) return true;
      offset += field.offset;
      type = field.type;
    } else {
      if (type.kind !== "array") return true;
      const index = literal(selection.value);
      if (index === undefined || index < 0n || index >= BigInt(type.length)) return true;
      offset += Number(index) * semanticTypeSize(type.element);
      type = type.element;
    }
  }
  return offset < 0 || use.width > semanticTypeSize(type) || offset + use.width > rootSize;
}

/**
 * Check the current capabilities' complete fixed-address union against the actual
 * supplied allocation windows. Sprite pointers are screen RAM, not MMIO. Missing
 * selected-profile identity or any overlap leaves platform observability unknown.
 */
function platformIsDisjoint(addressSpace: AddressSpace | undefined): boolean {
  if (
    addressSpace === undefined ||
    !("profileId" in addressSpace) ||
    typeof addressSpace.profileId !== "string"
  )
    return false;
  const selected = selectTargetProfile(addressSpace.profileId);
  if (selected.kind !== "complete") return false;
  const { machine, interrupts } = selected.profile;
  const effects = [
    { start: machine.spritePositionBase, end: machine.spriteColorBase + 7 },
    { start: machine.cia1Base, end: machine.cia1Base + 15 },
    { start: machine.cia2Base, end: machine.cia2Base + 15 },
    { start: machine.spritePointerBase, end: machine.spritePointerBase + 7 },
    ...interrupts.sinks.map(({ vector }) => ({ start: vector, end: vector + 1 })),
  ];
  const windows = [...addressSpace.ram, ...addressSpace.zeroPage];
  return effects.every((effect) =>
    windows.every(({ start, end }) => effect.end < start || effect.start > end),
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
  let platformDisjoint: boolean | undefined;
  const bodies = [
    ...semantic.functions.filter(({ id }) => reached.has(bindingIdentityKey(id))),
    ...semantic.globals.filter(({ entry }) => entry !== null),
  ];
  for (const body of bodies) {
    if (body.entry === null) continue;
    const blocks = reachableBlocks(body.entry, body.blocks);
    const literal = literalResolver(blocks);
    for (const block of blocks) {
      for (const operation of block.operations) {
        for (const use of placeUses(operation)) {
          retained.add(bindingIdentityKey(use.place.root));
          if (indexedMayObserve(use, literal)) return semantic;
        }
        if (
          (operation.kind === "memory-read" || operation.kind === "memory-write") &&
          rawMayObserve(literal(operation.address), operation.width, windows)
        )
          return semantic;
        if (operation.kind === "platform") {
          if (!FIXED_C64_CAPABILITIES.has(operation.capability)) return semantic;
          platformDisjoint ??= platformIsDisjoint(addressSpace);
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
