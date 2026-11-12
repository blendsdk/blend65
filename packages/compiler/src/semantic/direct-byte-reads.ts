/**
 * Platform capabilities whose selected C64 recipe is one direct volatile byte load.
 *
 * The fact matters to register forwarding, not to source admission: a byte that arrives
 * in A through a single `lda` also owns Z from that load. Keeping the set explicit stops a
 * future platform operation with a computed or multi-instruction result from inheriting a
 * flag fact it never proved.
 */
export const DIRECT_VOLATILE_BYTE_READ_CAPABILITIES: ReadonlySet<string> = Object.freeze(
  new Set([
    "c64.cia1.readAndClearPendingSources",
    "c64.cia2.readAndClearPendingSources",
    "c64.input.readJoystick1",
    "c64.input.readJoystick2",
    "c64.vic.readAndClearSpriteSpriteCollisions",
    "c64.vic.readAndClearSpriteBackgroundCollisions",
  ]),
);

/**
 * Direct byte reads whose ordinary A-to-store/call path is already admitted.
 *
 * The CIA1 pending-source read is deliberately absent: the existing machine selection
 * keeps its stable retained-value path even though the read itself is a direct `lda`.
 * A local elision must use this narrower set, or it can omit a home that lowering will
 * never keep in A.
 */
export const FORWARDABLE_VOLATILE_BYTE_READ_CAPABILITIES: ReadonlySet<string> = Object.freeze(
  new Set(
    [...DIRECT_VOLATILE_BYTE_READ_CAPABILITIES].filter(
      (capability) => capability !== "c64.cia1.readAndClearPendingSources",
    ),
  ),
);

/**
 * Decide whether one platform capability lowers to a direct volatile byte read.
 * @param capability Selected profile capability name.
 * @returns True only for the explicit direct-load set.
 */
export function directVolatileByteRead(capability: string): boolean {
  return DIRECT_VOLATILE_BYTE_READ_CAPABILITIES.has(capability);
}

/**
 * Decide whether one direct byte read may feed an ordinary A-to-store/call path.
 * @param capability Selected profile capability name.
 * @returns True only for the narrower forwardable set.
 */
export function forwardableVolatileByteRead(capability: string): boolean {
  return FORWARDABLE_VOLATILE_BYTE_READ_CAPABILITIES.has(capability);
}
