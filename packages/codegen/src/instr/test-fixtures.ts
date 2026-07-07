/**
 * Hand-built `InstrStream` fixtures for the Instr model's tests.
 *
 * These model the canonical translation targets the IL→Instr translator generates
 * from real IL; here they are built by hand so the model can be validated and
 * serialized end-to-end independently of the translator. They are **test-only** and
 * intentionally NOT re-exported from `index.ts` (mirroring `il/test-fixtures.ts`).
 */

import type { InstrStream } from "./stream.js";
import { instr, label, directive } from "./stream.js";
import { none, symbolRef, labelRef, zpSlot } from "./operand.js";

/**
 * The canonical 8-bit add sequence: `LDA a / CLC / ADC b / STA dest`.
 *
 * Used by the clean-NMOS-validation and golden-stream tests.
 */
export const add8Stream: InstrStream = {
  symbol: "add",
  segment: "code",
  entries: [
    // Leading `add:` label: printInstr renders entries, not the stream `symbol`,
    // so the label must be an explicit entry — consistent with the pointer-setup
    // fixture below, which has no leading symbol label.
    label("add"),
    instr("LDA", "Absolute", symbolRef("a")),
    instr("CLC", "Implied", none()),
    instr("ADC", "Absolute", symbolRef("b")),
    instr("STA", "Absolute", symbolRef("dest")),
  ],
};

/**
 * Pointer setup with byte-select + indirect-indexed load + branch.
 *
 * Exercises `#<sym`/`#>sym` byte-select, a ZP slot with `+1`, a label, and
 * `LDA (ptr),Y` / `BNE loop`. Used by the golden-stream tests.
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
 * A const-data block: a label followed by a `!byte` directive.
 *
 * Used by the golden-stream tests and by the validator test that checks
 * non-instr entries are skipped.
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
 * An illegal NMOS stream: `JSR ZeroPage` (JSR is Absolute-only).
 */
export const illegalJsrStream: InstrStream = {
  symbol: "bug",
  segment: "code",
  entries: [instr("JSR", "ZeroPage", symbolRef("f"))],
};

/**
 * A `STZ Absolute` stream — illegal on NMOS, legal on 65C02.
 */
export const stzStream: InstrStream = {
  symbol: "clear",
  segment: "code",
  entries: [instr("STZ", "Absolute", symbolRef("scr"))],
};
