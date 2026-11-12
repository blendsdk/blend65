import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType, StructFieldType } from "../frontend/semantic-types.js";
import type { ClosedObjectFacts } from "./closed-object-facts.js";
import type { FixedLoopFacts } from "./fixed-loop-facts.js";
import type { SemanticFunction } from "./operations.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type { StorageRange } from "../storage/storage-types.js";
import { selectTargetProfile } from "../target/profile.js";
import type { TargetProfile } from "../target/profile.js";
import type {
  ConvertOperation,
  SemanticBlock,
  SemanticOperation,
  SemanticPlace,
  ValueId,
} from "./operations.js";

/** Inventory each reachable body's value definitions once for both proof queries. */
export function valueDefinitions(
  blocks: readonly SemanticBlock[],
): ReadonlyMap<ValueId, SemanticOperation> {
  const definitions = new Map<ValueId, SemanticOperation>();
  for (const block of blocks)
    for (const operation of block.operations)
      if ("result" in operation && operation.result !== null)
        definitions.set(operation.result, operation);
  return definitions;
}

/**
 * Resolve body-local integer literals/conversions without executing arithmetic or
 * following mutable storage. Memoization handles definition order and shared chains;
 * iterative traversal keeps long chains off the host stack. Cycles remain unknown.
 */
export function literalResolver(
  definitions: ReadonlyMap<ValueId, SemanticOperation>,
): (value: ValueId) => bigint | undefined {
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

/**
 * Prove only a nonnegative inclusive maximum for array containment. AND clears all
 * bits outside a constant mask; a signed mask must also clear the sign bit. A later
 * conversion preserves the proof only when every possible value fits unchanged.
 * This is not an exact value and must never resolve a raw CPU or hardware address.
 * Memoized iterative conversion walks keep shared tails and long chains inexpensive;
 * missing facts, other arithmetic and cycles deliberately remain unknown.
 */
export function ordinalBoundResolver(
  definitions: ReadonlyMap<ValueId, SemanticOperation>,
  literal: (value: ValueId) => bigint | undefined,
): (value: ValueId) => bigint | undefined {
  const memo = new Map<ValueId, bigint | undefined>();
  return (value) => {
    let cursor = value;
    let bound: bigint | undefined;
    const seen = new Set<ValueId>();
    const conversions: ConvertOperation[] = [];
    while (!memo.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      const exact = literal(cursor);
      if (exact !== undefined) {
        bound = exact >= 0n ? exact : undefined;
        break;
      }
      const operation = definitions.get(cursor);
      if (operation?.kind === "convert" && operation.integer !== null) {
        conversions.push(operation);
        cursor = operation.operand;
        continue;
      }
      if (
        operation?.kind === "binary" &&
        operation.operator === "&" &&
        operation.integer !== null
      ) {
        const { width, signed } = operation.integer;
        const maximum = (1n << BigInt(width - (signed ? 1 : 0))) - 1n;
        for (const operand of [operation.left, operation.right]) {
          const mask = literal(operand);
          if (mask !== undefined && mask >= 0n && mask <= maximum)
            bound = bound === undefined || mask < bound ? mask : bound;
        }
      }
      break;
    }
    if (memo.has(cursor)) bound = memo.get(cursor);
    else memo.set(cursor, bound);
    for (const conversion of conversions.reverse()) {
      if (bound !== undefined && conversion.integer !== null) {
        const { width, signed } = conversion.integer;
        const maximum = (1n << BigInt(width - (signed ? 1 : 0))) - 1n;
        if (bound > maximum) bound = undefined;
      }
      memo.set(conversion.result, bound);
    }
    return bound;
  };
}

/** Test every accessed byte independently, including a word crossing $FFFF to $0000. */
export function rawMayObserve(
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

/**
 * Retain every byte touched by a raw access over one proved unsigned address interval.
 * The maximum displacement describes possible addresses, not an assumed exact value.
 * Word arithmetic and a second accessed byte both wrap in the 16-bit address domain.
 * @param start First mathematical address before 16-bit wrapping.
 * @param displacement Nonnegative inclusive distance to the last possible address.
 * @param width Original access width, whose order/count remain attached to the source operation.
 * @returns One or two inclusive logical ranges, or the full address domain.
 */
function wrappedRawRanges(
  start: bigint,
  displacement: bigint,
  width: 1 | 2,
): readonly StorageRange[] {
  const extent = displacement + BigInt(width - 1);
  if (extent >= 0xffffn) return Object.freeze([Object.freeze({ start: 0, end: 0xffff })]);
  const first = Number(BigInt.asUintN(16, start));
  const end = first + Number(extent);
  return Object.freeze(
    end <= 0xffff
      ? [Object.freeze({ start: first, end })]
      : [
          Object.freeze({ start: first, end: 0xffff }),
          Object.freeze({ start: 0, end: end & 0xffff }),
        ],
  );
}

/**
 * Prove a literal address, an existing unsigned bound, or a literal-plus-bounded ordinal.
 * No mutable load or source array extent supplies a bound by itself. Unknown inputs
 * remain unknown; this query does not change the operation or its volatile effects.
 * @param operation Original raw read/write with modulo-65536 addresses.
 * @param definitions Once-indexed source value definitions for this body.
 * @param literal Existing exact literal/conversion query.
 * @param upperBound Existing use-site unsigned maximum, including supplied induction facts.
 * @returns Complete inclusive access footprint, or null when it cannot be bounded.
 */
export function rawAccessFootprint(
  operation: Extract<SemanticOperation, { readonly kind: "memory-read" | "memory-write" }>,
  definitions: ReadonlyMap<ValueId, SemanticOperation>,
  literal: (value: ValueId) => bigint | undefined,
  upperBound: (value: ValueId) => bigint | undefined,
): readonly StorageRange[] | null {
  const exact = literal(operation.address);
  if (exact !== undefined) return wrappedRawRanges(exact, 0n, operation.width);
  const address = definitions.get(operation.address);
  if (
    address?.kind === "binary" &&
    address.operator === "+" &&
    address.integer?.width === 16 &&
    address.integer.signed === false
  ) {
    for (const [base, ordinal] of [
      [address.left, address.right],
      [address.right, address.left],
    ]) {
      const start = literal(base);
      const bound = upperBound(ordinal);
      if (start !== undefined && bound !== undefined && bound >= 0n)
        return wrappedRawRanges(start, bound, operation.width);
    }
  }
  const maximum = upperBound(operation.address);
  return maximum !== undefined && maximum >= 0n
    ? wrappedRawRanges(0n, maximum, operation.width)
    : null;
}

/**
 * Prove generated constant indices safe before expanding a loop. Unknown or
 * out-of-extent counter expressions retain ordinary guards; unrelated runtime
 * indices remain untouched by the specialization.
 * @param loop Immutable source loop and its nonnegative range premises.
 * @param ordinals Counter-dependent source values that expansion may fold.
 * @returns Whether no new constant can bypass a required runtime bounds stop.
 */
export function derivedIndicesAreInBounds(
  loop: FixedLoopFacts,
  ordinals: ReadonlySet<string>,
): boolean {
  for (const operation of loop.body.operations)
    for (const { place } of placeUses(operation)) {
      if (!place.path.some((part) => part.kind === "index" && ordinals.has(part.value))) continue;
      const rootType = place.rootType;
      if (rootType === undefined) return false;
      let type: SemanticType = rootType;
      let outer = true;
      const parameter = loop.function.parameters.find(
        (value) => bindingIdentityKey(value.id) === bindingIdentityKey(place.root),
      );
      for (const part of place.path) {
        if (part.kind === "field") {
          if (type.kind !== "struct") return false;
          const field: StructFieldType | undefined = type.fields.find(
            (value) => value.name === part.name,
          );
          if (field === undefined) return false;
          type = field.type;
        } else {
          if (type.kind !== "array") return false;
          if (ordinals.has(part.value)) {
            const maximum = loop.valueBounds.get(part.value);
            if (
              (outer && parameter?.outerUnsized === true) ||
              maximum === undefined ||
              maximum < 0n ||
              maximum >= BigInt(type.length)
            )
              return false;
          }
          outer = false;
          type = type.element;
        }
      }
    }
  return true;
}

/** Inclusive allocation windows already supplied to whole-program closure. */
export type AddressSpace = Pick<TargetProfile["storage"], "ram" | "zeroPage">;

/**
 * Only these current C64 operations have proved scalar/handler inputs and fixed
 * device/vector effects. A new capability is deliberately unknown until its
 * memory contract is checked; profile membership alone does not grant an exemption.
 */
export const FIXED_C64_CAPABILITIES: ReadonlySet<string> = new Set([
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
  "c64.system.restoreRawIRQ",
  "c64.system.restoreNMI",
  "c64.system.setIRQ",
  "c64.system.setIRQExclusive",
  "c64.system.setRawIRQ",
  "c64.system.setNMI",
  "c64.system.setNMIExclusive",
  "c64.vic.readAndClearSpriteBackgroundCollisions",
  "c64.vic.readAndClearSpriteSpriteCollisions",
  "c64.vic.setBorderColor",
  "c64.vic.setSpriteColor",
  "c64.vic.setSpritePosition",
  "c64.vic.vicSpriteBlock",
  "c64.video.waitNextFrame",
]);

/** Resolve selected machine facts once; unproved target identity grants no exemption. */
export function profileFor(addressSpace: AddressSpace | undefined): TargetProfile | undefined {
  if (
    addressSpace === undefined ||
    !("profileId" in addressSpace) ||
    typeof addressSpace.profileId !== "string"
  )
    return undefined;
  const selected = selectTargetProfile(addressSpace.profileId);
  return selected.kind === "complete" ? selected.profile : undefined;
}

/**
 * A device can read RAM indirectly after a CPU write outside the allocation windows.
 * Without a complete fetch proof, retain data for sprite pointers and VIC mode,
 * enable, memory-selector or CIA2 bank writes. Decode every byte and register mirror;
 * color and position writes alone do not select a RAM consumer.
 */
export function rawMaySelectHardwareRam(
  address: bigint | undefined,
  width: number,
  profile: TargetProfile | undefined,
): boolean {
  if (address === undefined || profile === undefined) return true;
  const { machine } = profile;
  const displayControl = machine.spritePositionBase + 0x11;
  for (let offset = 0; offset < width; offset += 1) {
    const byte = Number(BigInt.asUintN(16, address + BigInt(offset)));
    if (byte >= machine.spritePointerBase && byte < machine.spritePointerBase + 8) return true;
    // The VIC's 64-register decode repeats through its entire 1 KiB I/O window.
    if (byte >= machine.spritePositionBase && byte < machine.spritePositionBase + 0x400) {
      const register = machine.spritePositionBase + ((byte - machine.spritePositionBase) & 0x3f);
      if (
        register === displayControl ||
        register === machine.spriteEnable ||
        register === machine.vicMemoryPointer
      )
        return true;
    }
    // CIA2's 16-register decode repeats through its entire 256-byte I/O window.
    if (byte >= machine.cia2Base && byte < machine.cia2Base + 0x100) {
      const register = machine.cia2Base + ((byte - machine.cia2Base) & 0x0f);
      if (register === machine.cia2PortA || register === machine.cia2DataDirection) return true;
    }
  }
  return false;
}

/** One explicit source place and the complete width consumed at that place. */
export interface PlaceUse {
  /** Root identity and already evaluated field/index path. */
  readonly place: SemanticPlace;
  /** All bytes read/written; an uncaptured address only selects a location. */
  readonly width: number;
}

/** Include hidden aggregate destinations as well as ordinary explicit place operations. */
export function placeUses(operation: SemanticOperation): readonly PlaceUse[] {
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
export function placeMayEscapeRoot(
  use: PlaceUse,
  ordinalBound: (value: ValueId) => bigint | undefined,
): boolean {
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
      const index = ordinalBound(selection.value);
      if (index === undefined || index < 0n || index >= BigInt(type.length)) return true;
      offset += Number(index) * semanticTypeSize(type.element);
      type = type.element;
    }
  }
  return offset < 0 || use.width > semanticTypeSize(type) || offset + use.width > rootSize;
}

/**
 * Index conditional source stability for scalar byte globals sampled inside one function.
 * Typed/root/range premises and every physical/firmware/A/P observer remain
 * obligations of the final candidate. This query never treats absent homes as empty.
 * @param fn Actual immutable source function whose entry can initialize the sample.
 * @param facts Existing source effects, whole-object origins and range premises.
 * @param profile Selected target and permitted placement envelope.
 * @returns A memoized source-only predicate; unsupported mutation keeps ordinary loads.
 */
export function createGlobalByteStabilityQuery(
  fn: SemanticFunction,
  facts: ClosedObjectFacts,
  profile: TargetProfile,
): (root: BindingId) => boolean {
  const program = facts.program;
  const globals = new Map(
    program.semantic.globals.map((global) => [bindingIdentityKey(global.id), global]),
  );
  const entry = new Set(fn.blocks.find((block) => block.id === fn.entry)?.operations ?? []);
  const async = new Set(
    (program.executionDomains ?? []).flatMap((value) =>
      value.domains.some((domain) => domain !== "main") ? [bindingIdentityKey(value.function)] : [],
    ),
  );
  const borrowed = new Set(
    program.semantic.functions.flatMap((value) =>
      value.parameters
        .filter((parameter) => parameter.type.kind === "array" || parameter.type.kind === "struct")
        .map((parameter) => bindingIdentityKey(parameter.id)),
    ),
  );
  const unknown =
    (program.executionDomains === undefined && (program.interruptRoutes?.length ?? 0) > 0) ||
    fn.blocks.some((block) =>
      block.operations.some(
        (operation) =>
          operation.kind === "call" ||
          operation.kind === "indirect-call" ||
          operation.kind === "platform",
      ),
    ) ||
    facts.observations.some(
      (observation) =>
        observation.access === "write" &&
        observation.target.kind === "raw" &&
        (observation.target.ranges === null ||
          observation.target.ranges.some(
            (range) =>
              range.start <= profile.cpu.portDataAddress &&
              range.end >= profile.cpu.portDirectionAddress,
          )),
    );
  const relevant = facts.observations.filter(
    (observation) =>
      bindingIdentityKey(observation.owner) === bindingIdentityKey(fn.id) ||
      async.has(bindingIdentityKey(observation.owner)),
  );
  const memo = new Map<string, boolean>();
  return (root) => {
    const key = bindingIdentityKey(root);
    const previous = memo.get(key);
    if (previous !== undefined) return previous;
    const global = globals.get(key);
    let stable = !unknown && global?.type.kind === "scalar" && global.type.name === "byte";
    const envelope =
      global?.placement?.at == null
        ? [...profile.storage.ram, ...profile.storage.zeroPage]
        : [{ start: global.placement.at, end: global.placement.at }];
    for (const observation of relevant) {
      const target = observation.target;
      if (target.kind === "platform" && !target.envelopeDisjoint) stable = false;
      if (observation.access !== "write") continue;
      if (
        target.kind === "raw" &&
        (target.ranges === null ||
          target.ranges.some((range) =>
            envelope.some((home) => range.start <= home.end && range.end >= home.start),
          ))
      )
        stable = false;
      if (target.kind !== "place") continue;
      const targetKey = bindingIdentityKey(target.place.root);
      const origin = facts.parameters.get(targetKey)?.origin.place.root;
      if (!target.withinRoot || (borrowed.has(targetKey) && origin === undefined)) stable = false;
      if (
        bindingIdentityKey(origin ?? target.place.root) === key &&
        !(observation.owner === fn.id && entry.has(observation.operation))
      )
        stable = false;
    }
    memo.set(key, stable);
    return stable;
  };
}

/** Producer-owned marker; its instance is carried by each fact, never stored in a registry. */
const FIXED_LOOP_FACT_SEAL = Symbol("fixed-loop-source-facts");

/** Opaque finite snapshot checks both field identity and mutable container contents. */
class FixedLoopFactSeal {
  /** Original source fields, including exact operations, domains and frozen exit records. */
  readonly fields: readonly (readonly [PropertyKey, unknown])[];
  /** Membership is a source CFG premise, not just a Set object's identity. */
  readonly members: readonly string[];
  /** Retained range premises must not be changed by editing the original Map. */
  readonly bounds: readonly (readonly [string, bigint])[];

  /** Capture only this already-derived fact; no source analysis or global cache is introduced. */
  constructor(facts: FixedLoopFacts) {
    this.fields = Object.freeze(
      Reflect.ownKeys(facts).map((key) => {
        const value: unknown = Reflect.get(facts, key);
        return Object.freeze([key, value] as const);
      }),
    );
    this.members = Object.freeze([...facts.members]);
    this.bounds = Object.freeze([...facts.valueBounds].map((entry) => Object.freeze(entry)));
    Object.freeze(this);
  }

  /** A copied equal packet is safe; a changed field, missing member or edited bound is not. */
  matches(facts: FixedLoopFacts): boolean {
    return (
      Reflect.ownKeys(facts).length === this.fields.length + 1 &&
      this.fields.every(
        ([key, value]) => Reflect.has(facts, key) && Reflect.get(facts, key) === value,
      ) &&
      facts.members.size === this.members.length &&
      this.members.every((member) => facts.members.has(member)) &&
      facts.valueBounds.size === this.bounds.length &&
      this.bounds.every(([value, maximum]) => facts.valueBounds.get(value) === maximum)
    );
  }
}

/** Bind one derived immutable loop packet without re-running its source proof. */
export function sealFixedLoopFacts(facts: FixedLoopFacts): FixedLoopFacts {
  return Object.freeze({ ...facts, [FIXED_LOOP_FACT_SEAL]: new FixedLoopFactSeal(facts) });
}

/** Reject stale/copied premises or edited containers before machine consumers use a loop fact. */
export function validFixedLoopFacts(facts: FixedLoopFacts): boolean {
  const seal: unknown = Reflect.get(facts, FIXED_LOOP_FACT_SEAL);
  return seal instanceof FixedLoopFactSeal && seal.matches(facts);
}

/**
 * Check the current capabilities' complete fixed-address union against the actual
 * supplied allocation windows. Sprite pointers are screen RAM, not MMIO. Missing
 * selected-profile identity or any overlap leaves platform observability unknown.
 */
export function platformIsDisjoint(
  addressSpace: AddressSpace | undefined,
  profile: TargetProfile | undefined,
): boolean {
  if (addressSpace === undefined || profile === undefined) return false;
  const { machine, interrupts } = profile;
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
