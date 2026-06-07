/**
 * RD-07b register binder — IL virtual temps → 6502 A/X/Y registers + ZP scratch
 * (RD-07 R40–R45; `plans/rd-07b-il-to-instr/03-02-register-binding.md`).
 *
 * The binder is the single owner of "where does temp `tN` live right now?" It
 * tracks which temp occupies each of A/X/Y, suppresses redundant `LDA`s when the
 * accumulator already holds the wanted temp (R44), and spills least-recently-used
 * temps to the `category: "temp"` zero-page runs (`__zp_tmp_N`) drawn from the
 * carried `AllocationPlan` when a register is needed (R43). State is cleared at
 * every block boundary via {@link RegisterBinder.reset} (R45).
 *
 * Per AR D9 a temp's location is a {@link TempLocation} union — a `reg` (A/X/Y,
 * implied by the opcode, never an `InstrOperand`) or a `zp` spill slot. The
 * separate {@link RegisterBinder.operandFor} converts a `zp` location to a
 * `zpSlot` operand for ALU-source use, and ICEs if asked to address a register
 * as memory (a codegen bug — H5, no undefined behavior).
 *
 * Determinism (R17/AC-06): register preference is fixed (A, then X) and ZP slots
 * are handed out in allocation order, so the same IL + same plan yields
 * byte-identical emissions every run. The translator names the temp to spill
 * explicitly (the caller owns liveness), so the binder needs no internal LRU.

 *
 * Consumes the `il/` operand model and the RD-07a `instr/` stream/operand model
 * read-only (D6); lives in `@blend65/codegen` (R15/AR-20: never imported by the
 * frontend/language-server).
 */

import type { AllocationPlan, DiagnosticBag } from "@blend65/core";

import { IceCode } from "@blend65/core";
import type { ILOperand } from "../il/operand.js";
import { isTemp } from "../il/operand.js";
import type { InstrOperand } from "./operand.js";
import { zpSlot } from "./operand.js";
import type { StreamEntry } from "./stream.js";
import { instr } from "./stream.js";

/**
 * Where an IL temp currently lives (AR D9).
 *
 * A `reg` location names one of the three 6502 registers — implied by the opcode,
 * never expressible as an `InstrOperand`. A `zp` location names a zero-page spill
 * slot, which *can* be addressed (via {@link RegisterBinder.operandFor}).
 */
export type TempLocation =
  | { readonly kind: "reg"; readonly reg: "A" | "X" | "Y" }
  | { readonly kind: "zp"; readonly slot: string };

/**
 * The binder seam the translator (03-01) drives. The translator owns the
 * `StreamEntry[]`; the binder emits spill/reload instructions through the passed
 * `emit` callback so they land in the correct stream position.
 */
export interface RegisterBinder {
  /**
   * Ensure `temp` is in the accumulator, emitting an `LDA` from its home only
   * when A does not already hold it (redundant-load suppression, R44).
   *
   * @param temp The temp operand to bring into A.
   * @param emit Sink for any emitted `LDA`.
   */
  ensureInA(temp: ILOperand, emit: (e: StreamEntry) => void): void;

  /**
   * Report where `temp` currently lives (AR D9).
   *
   * @param temp The temp operand to locate.
   * @returns The temp's {@link TempLocation} (`reg` or `zp`).
   */
  locationOf(temp: ILOperand): TempLocation;

  /**
   * Convert a temp's location to an addressable operand for ALU-source use
   * (AR D9): a `zp` location → `zpSlot`; a `reg` location → an `E90001` ICE.
   *
   * @param temp The temp operand to address.
   * @returns The addressable {@link InstrOperand} (a `zpSlot`).
   */
  operandFor(temp: ILOperand): InstrOperand;

  /**
   * Record that an emitted instruction has just produced `temp` in A (R41).
   *
   * @param temp The temp now resident in the accumulator.
   */
  bindResultToA(temp: ILOperand): void;

  /**
   * Record that `temp` (typically a word value's high byte) now lives in X
   * (R42/D5).
   *
   * @param temp The temp now resident in X.
   */
  bindResultToX(temp: ILOperand): void;

  /**
   * Spill `temp` from its register to a fresh `category: "temp"` ZP slot, emitting
   * the `STA` and relocating the temp's home (R43). Raises an `E90001` ICE if the
   * plan provides no remaining temp slot (a planner/codegen contract violation —
   * H5, never silent corruption).
   *
   * @param temp The register-resident temp to spill.
   * @param emit Sink for the emitted `STA`.
   */
  spill(temp: ILOperand, emit: (e: StreamEntry) => void): void;

  /**
   * Clear all register knowledge at a block boundary (R45). Memory homes survive;
   * only the A/X/Y occupancy is forgotten, so the next {@link ensureInA} reloads.
   */
  reset(): void;
}

/** Internal mutable register-occupancy state (R44). */
interface RegisterState {
  a: number | null;
  x: number | null;
  y: number | null;
}

/**
 * Construct a {@link RegisterBinder} over the given allocation plan.
 *
 * The binder reads only the plan's `category: "temp"` ZP runs (the spill scratch
 * area, R43); every other plan field is owned by other phases. Diagnostics (the
 * over-budget ICE, D7) are written to `bag`.
 *
 * @param plan The carried allocation plan (`ilProgram.allocationPlan`, D2).
 * @param bag The diagnostic sink for the over-budget ICE (D7).
 * @returns A fresh, function-local register binder.
 */
export function createRegisterBinder(plan: AllocationPlan, bag: DiagnosticBag): RegisterBinder {
  // The ZP scratch slots available for spilling, in allocation order (R43).
  const tempSlots: readonly string[] = plan.zpAllocations
    .filter((z) => z.category === "temp")
    .map((z) => z.name);

  const state: RegisterState = { a: null, x: null, y: null };
  // Each temp's surviving memory home (set on spill); registers tracked in state.
  const homes = new Map<number, string>();
  let nextSlot = 0;

  function tempId(op: ILOperand): number {
    if (!isTemp(op)) {
      bag.addICE(
        IceCode.Unexpected,
        null,
        `register binder: expected a temp operand, got '${op.kind}'`,
      );

      return -1;
    }
    return op.id;
  }

  function locationOf(op: ILOperand): TempLocation {
    const id = tempId(op);
    if (state.a === id) return { kind: "reg", reg: "A" };
    if (state.x === id) return { kind: "reg", reg: "X" };
    if (state.y === id) return { kind: "reg", reg: "Y" };
    const home = homes.get(id);
    if (home !== undefined) return { kind: "zp", slot: home };
    // No known location: treat as accumulator-resident default (the producing
    // instruction is expected to have bound it). Conservative, total (H5).
    return { kind: "reg", reg: "A" };
  }

  function operandFor(op: ILOperand): InstrOperand {
    const loc = locationOf(op);
    if (loc.kind === "zp") return zpSlot(loc.slot);
    bag.addICE(
      IceCode.Unexpected,
      null,
      `register binder: cannot address register ${loc.reg} as memory`,
    );

    // Total fallback (H5): an inert slot reference; the ICE already failed the build.
    return zpSlot("__zp_invalid");
  }

  function ensureInA(op: ILOperand, emit: (e: StreamEntry) => void): void {
    const id = tempId(op);
    if (state.a === id) {
      return; // redundant-load suppression (R44)
    }
    const loc = locationOf(op);
    if (loc.kind === "zp") {
      emit(instr("LDA", "ZeroPage", zpSlot(loc.slot)));
    } else if (loc.reg === "X") {
      emit(instr("TXA", "Implied", { kind: "none" }));
    } else if (loc.reg === "Y") {
      emit(instr("TYA", "Implied", { kind: "none" }));
    }
    // loc.reg === "A" is impossible here (state.a !== id checked above).
    state.a = id;
  }

  function bindResultToA(op: ILOperand): void {
    state.a = tempId(op);
  }

  function bindResultToX(op: ILOperand): void {
    state.x = tempId(op);
  }

  function spill(op: ILOperand, emit: (e: StreamEntry) => void): void {
    const id = tempId(op);
    if (nextSlot >= tempSlots.length) {
      bag.addICE(
        IceCode.Unexpected,
        null,
        `register binder: spill demand exceeds the plan's ZP temp runs ` +
          `(${tempSlots.length} available)`,
      );
      return;
    }
    const slot = tempSlots[nextSlot++];
    emit(instr("STA", "ZeroPage", zpSlot(slot)));
    homes.set(id, slot);
    // The temp leaves the register file; clear whichever register held it.
    if (state.a === id) state.a = null;
    if (state.x === id) state.x = null;
    if (state.y === id) state.y = null;
  }

  function reset(): void {
    state.a = null;
    state.x = null;
    state.y = null;
  }

  return {
    ensureInA,
    locationOf,
    operandFor,
    bindResultToA,
    bindResultToX,
    spill,
    reset,
  };
}
