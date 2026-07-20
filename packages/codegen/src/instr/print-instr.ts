/**
 * Canonical ACME serializer — `printInstr` + `instrByteSize`.
 *
 * Renders an {@link InstrStream} to **canonical ACME-syntax assembly text**. This
 * is the **single** serializer in the toolchain: `--emit-asm` output and the text
 * fed to ACME both come from this exact function, so they can never drift. The
 * whole-program ACME serializer imports and reuses `printInstr`.
 *
 * The serializer is **pure and deterministic**: identical input → identical
 * output, byte-for-byte. No `Map`/`Set` iteration whose order could vary, no
 * timestamps, no locale-dependent formatting; line endings are always `\n` and
 * hex uses a fixed uppercase format. This determinism is what makes golden
 * snapshot testing meaningful. Mirrors the single-path discipline of
 * `il/print-il.ts`.
 */

import type { AddressingMode } from "./addressing-mode.js";
import type { InstrOperand } from "./operand.js";
import type { AcmeDirective, InstrStream, StreamEntry } from "./stream.js";

/** Indentation for instruction and most directive lines (labels sit at col 0). */
const INDENT = "    ";

/**
 * Format a byte value as ACME 2-digit uppercase hex (`$0F`). Values are masked
 * to 8 bits so a stray sign or overflow renders deterministically.
 *
 * @param value The numeric value to format.
 * @returns The `$XX` hex string.
 */
function hex8(value: number): string {
  return `$${(value & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
}

/**
 * Format a word value as ACME 4-digit uppercase hex (`$0801`). Values are masked
 * to 16 bits for deterministic rendering.
 *
 * Exported so the whole-program serializer (`serialize-acme.ts`) renders
 * symbol-definition values with the exact same format — one hex implementation,
 * no duplication.
 *
 * @param value The numeric value to format.
 * @returns The `$XXXX` hex string.
 */
export function hex16(value: number): string {
  return `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Render the *symbol text* for a `symbolRef`/`zpSlot`/`labelRef` operand — the
 * bare identifier, plus a `+offset` suffix and `<`/`>` byte-select prefix when
 * present. Immediates and `none` are handled by {@link operandText}.
 *
 * @param o The operand to render the name portion of.
 * @returns The symbolic name text (without any `#` immediate prefix).
 */
function symbolText(o: InstrOperand): string {
  switch (o.kind) {
    case "symbolRef": {
      const base = o.offset === undefined ? o.name : `${o.name}+${o.offset}`;
      if (o.byteSelect === "low") {
        return `<${base}`;
      }
      if (o.byteSelect === "high") {
        return `>${base}`;
      }
      return base;
    }
    case "labelRef":
      return o.label;
    case "zpSlot":
      return o.name;
    case "immediate":
      return hex8(o.value);
    case "none":
      return "";
  }
}

/**
 * Render the *inner operand text* (without addressing-mode decoration) for an
 * operand: hex for immediates, symbolic text otherwise.
 *
 * @param o The operand.
 * @returns The inner operand text.
 */
function operandText(o: InstrOperand): string {
  return symbolText(o);
}

/**
 * Render the full operand text for an instruction, applying the addressing-mode
 * decoration: `#` for immediate, `,X`/`,Y` indexing, `(...)` indirection.
 *
 * One rendering path per mode — the `never` default arm makes the switch
 * exhaustive at compile time (no runtime fall-through).
 *
 * @param mode The addressing mode.
 * @param operand The instruction operand.
 * @returns The operand text (may be empty for Implied).
 */
function modeOperandText(mode: AddressingMode, operand: InstrOperand): string {
  switch (mode) {
    case "Implied":
      return "";
    case "Accumulator":
      // ACME's accumulator addressing is the bare mnemonic — an explicit "A"
      // operand parses as an (undefined) symbol and fails assembly.
      return "";
    case "Immediate":
      return `#${operandText(operand)}`;
    case "ZeroPage":
    case "Absolute":
    case "Relative":
      return operandText(operand);
    case "ZeroPageX":
    case "AbsoluteX":
      return `${operandText(operand)},X`;
    case "ZeroPageY":
    case "AbsoluteY":
      return `${operandText(operand)},Y`;
    case "Indirect":
    case "ZeroPageIndirect":
      return `(${operandText(operand)})`;
    case "IndirectX":
      return `(${operandText(operand)},X)`;
    case "IndirectY":
      return `(${operandText(operand)}),Y`;
    default: {
      // Exhaustiveness guard: adding a mode without a case is a compile error.
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/**
 * Render an ACME directive to its pseudo-op text. Origin and output-file
 * directives sit at column 0; the rest are indented (handled by {@link renderEntry}).
 *
 * One rendering path per directive kind; the `never` default arm enforces
 * exhaustiveness.
 *
 * @param d The directive to render.
 * @returns The directive's ACME text (without indentation).
 */
function directiveText(d: AcmeDirective): string {
  switch (d.kind) {
    case "origin":
      return `* = ${hex16(d.address)}`;
    case "symbolDef":
      return `${d.name} = ${hex16(d.value)}`;
    case "byte":
      return `!byte ${d.values.map(hex8).join(", ")}`;
    case "word":
      return `!word ${d.values.map(hex16).join(", ")}`;
    case "text":
      return `!text "${d.text}"`;
    case "fill":
      return `!fill ${d.count}, ${hex8(d.value)}`;
    case "align":
      // ACME's `!align` takes `andValue, equalValue [, fill]` — a BITMASK, not
      // a modulus: it pads until `PC & andValue == equalValue`. Writing the
      // boundary itself is the trap. `!align 256, 0` assembles cleanly and pads
      // only when bit 8 of the current address happens to be set, so it can look
      // correct from one address and do nothing from the next. `boundary` must
      // be a power of two, which is what makes `boundary - 1` the low-bit mask
      // that means "aligned"; it is derived here, in the one place that renders it.
      return `!align ${d.boundary - 1}, 0, ${d.fill}`;
    case "outputFile":
      return `!to "${d.name}", ${d.format}`;
    default: {
      const _exhaustive: never = d;
      return _exhaustive;
    }
  }
}

/**
 * Whether a directive renders at column 0 (origin / output-file / alignment)
 * rather than at instruction indent. These ACME pseudo-ops are conventionally
 * unindented.
 *
 * Note this is a plain predicate, not an exhaustive switch: a directive kind
 * left out of the list silently renders at instruction indent rather than
 * failing to compile. Adding a column-0 kind means adding it here by hand.
 *
 * @param d The directive.
 * @returns `true` if the directive sits at column 0.
 */
function isColumnZeroDirective(d: AcmeDirective): boolean {
  return (
    d.kind === "origin" || d.kind === "outputFile" || d.kind === "symbolDef" || d.kind === "align"
  );
}

/**
 * Render a single stream entry to one text line.
 *
 * Instructions render at {@link INDENT}; labels at column 0 with a `:`;
 * directives at indent except origin/symbolDef/output-file which sit at column 0.
 *
 * @param entry The stream entry.
 * @returns The rendered line (no trailing newline).
 */
function renderEntry(entry: StreamEntry): string {
  switch (entry.type) {
    case "instr": {
      const ops = modeOperandText(entry.mode, entry.operand);
      // Implied/Accumulator-empty operands render the mnemonic alone (no trailing space).
      return ops === "" ? `${INDENT}${entry.opcode}` : `${INDENT}${entry.opcode} ${ops}`;
    }
    case "label":
      return `${entry.name}:`;
    case "directive":
      return isColumnZeroDirective(entry.directive)
        ? directiveText(entry.directive)
        : `${INDENT}${directiveText(entry.directive)}`;
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}

/**
 * Render an instruction stream to canonical ACME-syntax assembly text.
 *
 * Deterministic: identical input → identical output. This is the single
 * serializer shared by `--emit-asm` and the whole-program ACME emitter — the
 * emitter reuses this function rather than re-implementing rendering. An empty
 * stream renders to the empty string.
 *
 * @param stream The instruction stream to serialize.
 * @returns The ACME assembly text (newline-separated, no trailing newline).
 */
export function printInstr(stream: InstrStream): string {
  return stream.entries.map(renderEntry).join("\n");
}

/**
 * Assembled byte size of a single stream entry.
 *
 * - **instr**: 1 byte (opcode) + operand bytes by addressing mode —
 *   Implied/Accumulator = 0; Absolute modes + Indirect = 2; everything else = 1.
 * - **directive**: payload size — `byte` = values.length; `word` =
 *   2×values.length; `text` = encoded length; `fill` = count;
 *   `origin`/`symbolDef`/`outputFile`/`align` = 0. `align` is 0 because its
 *   padding is address-dependent, which makes program totals a lower bound.
 * - **label**: 0.
 *
 * @param entry The stream entry to size.
 * @returns The number of bytes this entry contributes to the assembled binary.
 */
export function instrByteSize(entry: StreamEntry): number {
  switch (entry.type) {
    case "instr":
      return 1 + operandByteCount(entry.mode);
    case "label":
      return 0;
    case "directive":
      return directiveByteSize(entry.directive);
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}

/**
 * The number of operand bytes an addressing mode contributes (excluding the
 * 1-byte opcode). Absolute and 16-bit indirect take 2 operand bytes; the
 * zero-page, immediate, relative, and indexed-indirect modes take 1; implied and
 * accumulator take none.
 *
 * @param mode The addressing mode.
 * @returns The operand byte count (0, 1, or 2).
 */
function operandByteCount(mode: AddressingMode): number {
  switch (mode) {
    case "Implied":
    case "Accumulator":
      return 0;
    case "Absolute":
    case "AbsoluteX":
    case "AbsoluteY":
    case "Indirect":
      return 2;
    case "Immediate":
    case "ZeroPage":
    case "ZeroPageX":
    case "ZeroPageY":
    case "IndirectX":
    case "IndirectY":
    case "Relative":
    case "ZeroPageIndirect":
      return 1;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/**
 * The assembled byte size of a directive's payload.
 *
 * @param d The directive.
 * @returns The byte count the directive contributes to the binary.
 */
function directiveByteSize(d: AcmeDirective): number {
  switch (d.kind) {
    case "byte":
      return d.values.length;
    case "word":
      return d.values.length * 2;
    case "text":
      // Byte length of the text payload (encoding-independent UTF-8 length in v1).
      return d.text.length;
    case "fill":
      return d.count;
    case "align":
      // The padding an alignment inserts depends on the address it lands at,
      // which only the assembler knows. Reporting 0 keeps `programByteSize` a
      // documented lower bound rather than a confidently wrong number; the
      // live size budgets read the post-ACME binary, not this.
      return 0;
    case "origin":
    case "symbolDef":
    case "outputFile":
      return 0;
    default: {
      const _exhaustive: never = d;
      return _exhaustive;
    }
  }
}
