import type { MemoryWriteOperation } from "./operations.js";
import { interruptWriteTouches } from "./interrupt-address-facts.js";
import type { InterruptWriteAddress } from "./interrupt-address-facts.js";

/** Configuration history of one physical exclusive lease, not an interrupt frame. */
export type Cia2Mutation = "clean" | "typed" | "raw";

/** The finite device obligations attached to an existing physical vector binding. */
export interface Cia2Lease {
  /** Only exclusive entries own the device; chain entries forward to their continuation. */
  readonly exclusive: boolean;
  /** Changes charged to this lease, including returning selected-handler effects. */
  readonly mutation: Cia2Mutation;
  /** Timer phase/latch changes cannot be undone by merely restoring a source mask. */
  readonly timerChanged: boolean;
  /** Exact prior software-proved mask, when a clean inner pop can be established. */
  readonly priorMask: number | null;
}

/** Source facts carried by the existing ordered vector/context worklist. */
export interface Cia2Facts {
  /** Qualified idle firmware provenance has not been invalidated by source writes. */
  readonly idleStock: boolean;
  /** A full typed clear has established the otherwise unreadable source mask. */
  readonly maskKnown: boolean;
  /** False after dynamic changes; possibleSources then denotes an upper bound. */
  readonly maskExact: boolean;
  /** Five source bits that may be enabled, never a read of the hardware mask. */
  readonly possibleSources: number;
  /** Existing finite physical bindings; external reentry never pushes another frame. */
  readonly leases: ReadonlyMap<string, Cia2Lease>;
}

/**
 * Idle entry is a qualified platform precondition, not a runtime probe. Software
 * still needs a full typed disable before its first source enable is accepted.
 */
export const INITIAL_CIA2_FACTS: Cia2Facts = Object.freeze({
  idleStock: true,
  maskKnown: false,
  maskExact: false,
  possibleSources: 0x1f,
  leases: new Map(),
});

/** Only these existing public operations participate in CIA2 ownership. */
export type Cia2OperationKind = "counter" | "consume" | "latch" | "control" | "enable" | "disable";

/** Classify existing operation names without recognizing arbitrary prefix lookalikes. */
export function cia2OperationKind(capability: string): Cia2OperationKind | null {
  switch (capability) {
    case "c64.cia2.readTimerACounter":
    case "c64.cia2.readTimerBCounter":
      return "counter";
    case "c64.cia2.readAndClearPendingSources":
      return "consume";
    case "c64.cia2.writeTimerALatch":
    case "c64.cia2.writeTimerBLatch":
      return "latch";
    case "c64.cia2.configureTimerA":
    case "c64.cia2.configureTimerB":
      return "control";
    case "c64.cia2.enableInterruptSources":
      return "enable";
    case "c64.cia2.disableInterruptSources":
      return "disable";
    default:
      return null;
  }
}

/** Compare finite device relations by value; source paths do not split worklist states. */
export function cia2FactsKey(facts: Cia2Facts): string {
  return JSON.stringify([
    facts.idleStock,
    facts.maskKnown,
    facts.maskExact,
    facts.possibleSources,
    [...facts.leases]
      .map(([slot, lease]) => [
        slot,
        lease.exclusive,
        lease.mutation,
        lease.timerChanged,
        lease.priorMask,
      ])
      .sort(),
  ]);
}

/** Raw history dominates typed history and cannot be repaired by a later typed clear. */
export function cia2Mutation(left: Cia2Mutation, right: Cia2Mutation): Cia2Mutation {
  if (left === "raw" || right === "raw") return "raw";
  return left === "typed" || right === "typed" ? "typed" : "clean";
}

/** Charge a write to its actual downstream owner, never to all older saved links. */
export function mutateCia2Owner(
  facts: Cia2Facts,
  slot: string,
  mutation: Cia2Mutation,
  timerChanged = false,
): Cia2Facts {
  const lease = facts.leases.get(slot);
  if (lease === undefined || !lease.exclusive) throw new Error("CIA2 mutation lacks its lease");
  const leases = new Map(facts.leases);
  leases.set(slot, {
    ...lease,
    mutation: cia2Mutation(lease.mutation, mutation),
    timerChanged: lease.timerChanged || timerChanged,
  });
  return { ...facts, leases };
}

/** CIA registers repeat sixteen-byte windows throughout the selected CIA2 page. */
const DEVICE_BYTES: ReadonlySet<bigint> = new Set(
  Array.from({ length: 16 }, (_, mirror) =>
    [4, 5, 6, 7, 13, 14, 15].map((register) => BigInt(0xdd00 + mirror * 16 + register)),
  ).flat(),
);
/** The KERNAL RS-232 enable byte is separate from device registers and source masks. */
const FIRMWARE_ENABLE: ReadonlySet<bigint> = new Set([0x02a1n]);

/** Classify proved raw device or firmware changes, preserving unrelated raw access. */
export function rawCia2Effect(
  operation: MemoryWriteOperation,
  address: InterruptWriteAddress | undefined,
  value: bigint | undefined,
): {
  /** Timer/latch/control/mask bytes are outside the reconstructible typed epoch. */
  readonly device: boolean;
  /** A nonzero or unknown written firmware-enable byte destroys idle provenance. */
  readonly firmware: boolean;
} {
  const device = interruptWriteTouches(operation, address, DEVICE_BYTES, false);
  let firmware = interruptWriteTouches(operation, address, FIRMWARE_ENABLE, false);
  if (firmware && typeof address === "bigint" && value !== undefined) {
    const offset = Number((0x02a1n - address) & 0xffffn);
    if (offset < operation.width && ((value >> BigInt(offset * 8)) & 0xffn) === 0n)
      firmware = false;
  }
  // Unknown raw addresses retain the existing vector-proof boundary. They do
  // not establish device ownership, and no new blanket raw-memory ban is added.
  return { device, firmware };
}
