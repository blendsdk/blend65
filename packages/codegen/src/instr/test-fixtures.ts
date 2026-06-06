/**
 * Hand-built `InstrStream` fixtures for RD-07a tests (07-testing-strategy.md).
 *
 * These model the canonical translation targets RD-07b will *generate* from real
 * IL; in 07a we build them by hand to validate (03-02) and serialize (03-03) the
 * model end-to-end. They are **test-only** and intentionally NOT re-exported from
 * `index.ts` (mirroring `il/test-fixtures.ts`).
 */

import type { InstrStream } from "./stream.js";
import { instr, label, directive } from "./stream.js";
import { none, symbolRef, labelRef, zpSlot } from "./operand.js";

/**
 * The canonical 8-bit add sequence: `LDA a / CLC / ADC b / STA dest` (03-01 Ex.1).
 *
 * Used by validator ST-V1 (clean NMOS validation) and golden ST-G1.
 */
export const add8Stream: InstrStream = {
  symbol: "add",
  segment: "code",
  entries: [
    // Leading `add:` label per 03-03 Ex.1 (printInstr renders entries, not the
    // stream `symbol`, so the label is an explicit entry — consistent with Ex.2
    // which has no leading symbol label).
    label("add"),
    instr("LDA", "Absolute", symbolRef("a")),
    instr("CLC", "Implied", none()),
    instr("ADC", "Absolute", symbolRef("b")),
    instr("STA", "Absolute", symbolRef("dest")),
  ],
};

/**
 * Pointer setup with byte-select + indirect-indexed load + branch (03-01 Ex.2).
 *
 * Exercises `#<sym`/`#>sym` byte-select (R13), a ZP slot with `+1`, a label, and
 * `LDA (ptr),Y` / `BNE loop`. Used by golden ST-G2.
 */
export const ptrSetupStream: InstrStream = {
  symbol: "ptrSetup",
  segment: "code",
  entries: [
    instr("LDA", "Immediate", symbolRef("buffer", { byteSelect: "low" })),
    instr("STA", "ZeroPage", zpSlot("ptr")),
    instr("LDA", "Immediate", symbolRef("buffer", { byteSelect: "high" })),
    instr("STA", "ZeroPage", zpSlot("ptr+1")),
    label("loop"),
    instr("LDA", "IndirectY", zpSlot("ptr")),
    instr("BNE", "Relative", labelRef("loop")),
  ],
};

/**
 * A const-data block: a label followed by a `!byte` directive (03-01 Ex.3).
 *
 * Used by golden ST-G3 and validator ST-V6 (non-instr entries skipped).
 */
export const paletteStream: InstrStream = {
  symbol: "palette",
  segment: "data",
  entries: [
    label("palette"),
    directive({ kind: "byte", values: [0x00, 0x01, 0x02, 0x03] }),
  ],
};

/**
 * An illegal NMOS stream: `JSR ZeroPage` (JSR is Absolute-only). For ST-V2.
 */
export const illegalJsrStream: InstrStream = {
  symbol: "bug",
  segment: "code",
  entries: [instr("JSR", "ZeroPage", symbolRef("f"))],
};

/**
 * A `STZ Absolute` stream — illegal on NMOS, legal on 65C02 (R16). For ST-V4/V5.
 */
export const stzStream: InstrStream = {
  symbol: "clear",
  segment: "code",
  entries: [instr("STZ", "Absolute", symbolRef("scr"))],
};
