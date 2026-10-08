/** Raw VIC-II and CIA2 fields that determine the observed M1 display. */
export interface M1DisplayFields {
  /** VIC-II vertical mode and display-enable register. */
  readonly vicControl1: number;
  /** VIC-II horizontal mode register. */
  readonly vicControl2: number;
  /** VIC-II screen and character-memory selection register. */
  readonly vicMemory: number;
  /** Physical CIA2 port-A pins, not the unreadable output latch. */
  readonly cia2Port: number;
  /** Exact CIA2 port-A input/output directions. */
  readonly cia2Direction: number;
}

/**
 * Compare generated input-mode bank zero with the frozen expert's output-mode bank zero.
 * Only the low direction-bit representation differs; all other observed fields remain exact.
 * The caller must apply this check to every generated frame, including pixel-transition frames.
 * @param display Unmodified generated display observation.
 * @returns A fresh copy with the equivalent expert low-direction representation.
 * @throws If generated bank pins or low directions violate the fixed-bank startup contract.
 * @example
 * displayForExpertComparison({ vicControl1: 27, vicControl2: 8, vicMemory: 20,
 *   cia2Port: 211, cia2Direction: 60 }); // Same fields, cia2Direction: 63.
 */
export function displayForExpertComparison(display: M1DisplayFields): M1DisplayFields {
  if ((display.cia2Direction & 3) !== 0 || (display.cia2Port & 3) !== 3) {
    throw new Error("Generated M1 display requires input-mode CIA2 bank-zero pins");
  }
  return { ...display, cia2Direction: display.cia2Direction | 3 };
}
