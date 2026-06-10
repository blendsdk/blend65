# Canonical ACME Serializer (`printInstr`) & Byte Sizing

> **Document**: 03-03-serializer.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-07 R52–R54, R58 (support), §3.8 · FR-17..FR-20

## Overview

This component renders an `InstrStream` to **canonical ACME-syntax assembly text** —
`printInstr(stream): string`. Per decision **D4 / AR-60**, this is the **single** serializer
in the toolchain: `--emit-asm` output and the actual text fed to ACME (RD-09) come from this
exact function, so they can never drift. RD-09 imports and reuses `printInstr`; it does not
re-implement serialization.

It also ships `instrByteSize(entry): number`, the per-entry assembled byte size used to
estimate ROM size for the resource report (R58 support; the summation lives in 07b/RD-11).

The serializer is **pure and deterministic** (R53): same `InstrStream` → identical string,
byte-for-byte. This is what makes golden-snapshot testing (AR-22 tier 2) meaningful.

## Architecture

`printInstr` walks `stream.entries` in order and renders each `StreamEntry` to one text
line (or, for multi-value directives, one line), joined by `\n`. There is exactly **one**
rendering path per entry kind and per operand kind — mirroring `il/print-il.ts`'s
single-path discipline.

### Rendering rules (ACME syntax, R54)

**Instr entries** — `<INDENT><MNEMONIC><space><operand-text>`:

- Mnemonic: uppercase (the `Opcode` values already are).
- Indentation: instructions and directives are indented (e.g. one tab / 4 spaces); labels
  sit at column 0. (Exact indent fixed by the golden; chosen once, deterministic.)
- Operand text is a function of `(mode, operand)`:

| AddressingMode | Operand text pattern | Example |
| -------------- | -------------------- | ------- |
| `Implied` | *(empty)* | `RTS` |
| `Accumulator` | `A` | `ASL A` |
| `Immediate` | `#<operand>` | `LDA #$42`, `LDA #<buffer` |
| `ZeroPage` | `<operand>` | `LDA ptr`, `STA $02` |
| `ZeroPageX` | `<operand>,X` | `LDA ptr,X` |
| `ZeroPageY` | `<operand>,Y` | `LDX ptr,Y` |
| `Absolute` | `<operand>` | `LDA scr`, `JSR main` |
| `AbsoluteX` | `<operand>,X` | `LDA scr,X` |
| `AbsoluteY` | `<operand>,Y` | `LDA scr,Y` |
| `Indirect` | `(<operand>)` | `JMP (vec)` |
| `IndirectX` | `(<operand>,X)` | `LDA (ptr,X)` |
| `IndirectY` | `(<operand>),Y` | `LDA (ptr),Y` |
| `Relative` | `<operand>` | `BNE loop` |
| `ZeroPageIndirect` | `(<operand>)` | `LDA (ptr)` — 65C02 `(zp)`, distinct from `Indirect` (D8) |

**Operand text** is a function of operand kind:

| InstrOperand | Text | Notes |
| ------------ | ---- | ----- |
| `none` | *(empty)* | implied / accumulator carry no operand text |
| `immediate` | `$XX` (hex) | uppercase hex, `$` prefix; 8-bit `$XX`, larger `$XXXX` |
| `symbolRef` (byteSelect `none`) | `name` or `name + offset` | `+offset` only when `offset` present |
| `symbolRef` (byteSelect `low`) | `<name` | ACME low-byte select (R13) |
| `symbolRef` (byteSelect `high`) | `>name` | ACME high-byte select (R13) |
| `labelRef` | `label` | bare label name |
| `zpSlot` | `name` | the ACME symbol for that ZP byte |

> **Why hex for immediates, bare for symbols:** immediates are concrete numbers → ACME `$`
> hex (R54). Symbol/label/zp operands stay *symbolic names* (R8 — addresses are resolved by
> ACME, RD-09), so they render as identifiers, not numbers. This matches how the IL printer
> keeps locations symbolic.

**Label entries** — `name:` at column 0 (R5).

**Directive entries** — ACME pseudo-ops (R6), at instruction indent except origin/output:

| AcmeDirective | Text |
| ------------- | ---- |
| `origin` | `* = $XXXX` |
| `symbolDef` | `name = $XXXX` |
| `byte` | `!byte $XX, $XX, …` |
| `word` | `!word $XXXX, $XXXX, …` |
| `text` | `!text "…"` (encoding rendered as a comment or ACME encoding pragma if present) |
| `fill` | `!fill count, $XX` |
| `outputFile` | `!to "name", format` |

### Public surface

```typescript
import type { InstrStream, StreamEntry } from "./stream.js";

/**
 * Render an instruction stream to canonical ACME-syntax assembly text.
 *
 * Deterministic (R53): identical input → identical output. This is the single
 * serializer shared by `--emit-asm` and the RD-09 ACME emitter (D4/AR-60) — RD-09
 * reuses this function rather than re-implementing rendering.
 *
 * @param stream The instruction stream to serialize.
 * @returns The ACME assembly text (newline-separated, no trailing newline).
 */
export function printInstr(stream: InstrStream): string;

/**
 * Assembled byte size of a single stream entry (R58 support).
 *
 * - instr: 1 byte (opcode) + operand bytes by addressing mode
 *   (Implied/Accumulator = 0; Immediate/ZeroPage*/IndirectX/IndirectY/Relative/
 *   ZeroPageIndirect = 1; Absolute*/Indirect = 2).
 * - directive: payload size (`byte` = values.length; `word` = 2×values.length;
 *   `text` = encoded length; `fill` = count; `origin`/`symbolDef`/`outputFile` = 0).
 * - label: 0.
 *
 * @param entry The stream entry to size.
 * @returns The number of bytes this entry contributes to the assembled binary.
 */
export function instrByteSize(entry: StreamEntry): number;
```

## Integration Points

- **03-01 model** — consumes `InstrStream`/`StreamEntry`/`InstrOperand`/`AcmeDirective`.
- **No diagnostics** — the serializer assumes a validated stream; it never reports errors
  (validation is 03-02's job). It is total over any well-typed `InstrStream`.
- **RD-09 (ACME emitter)** — imports `printInstr` verbatim; adds only the ACME process
  invocation and final numeric address resolution. **No second serializer** (AR-60/AR-63).
- **`--emit-asm` CLI surface (RD-15)** — calls `printInstr` on the program's streams.

## Code Examples

### Example 1: the 8-bit add stream renders to canonical ACME

Input (`add8` from 03-01, stream `symbol: "add"`):

```
add:
    LDA a
    CLC
    ADC b
    STA dest
```

### Example 2: pointer setup with byte-select + indirect-indexed

```
    LDA #<buffer
    STA ptr
    LDA #>buffer
    STA ptr+1
loop:
    LDA (ptr),Y
    BNE loop
```

### Example 3: a data block with directives

```
palette:
    !byte $00, $01, $02, $03
```

### Example 4: an immediate and a struct-field offset

```
    LDA #$42          ; immediate → hex
    LDA player+2      ; symbolRef with offset 2
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Unknown operand/mode/directive kind | **Unreachable** by exhaustive `switch` over the typed unions; TypeScript `never` check in the default arm guarantees compile-time totality (no runtime throw needed) | R53/H5 |
| Stream with an illegal instr | Out of scope — serializer renders whatever it is given; legality is the validator's job (03-02). A pipeline runs `validateStream` *before* `printInstr` | AR D6 |

> Determinism is the load-bearing property: no `Map`/`Set` iteration whose order could vary,
> no timestamps, no locale-dependent formatting. Hex uses a fixed uppercase format with
> stable width rules. (Same discipline as `il/print-il.ts`.)

## Testing Requirements

- Spec tests ST-S* (07-testing-strategy): each addressing mode renders its documented
  operand pattern; `immediate` renders uppercase hex; `byteSelect` renders `<`/`>` (R13);
  `symbolRef` offset renders `+N`; labels at column 0 with `:`; every directive kind renders
  its ACME pseudo-op; `printInstr` is byte-identical across repeated calls (determinism,
  R53). `instrByteSize` returns the documented size for each mode and directive.
- Golden snapshots (ST-G*): the three example streams above are snapshotted as full ACME
  text (AR-22 tier 2 / RD-07 AC-18); the snapshot file is the immutable oracle.
- Impl tests: empty stream → empty string; a stream of only labels/directives; the `never`
  exhaustiveness arms are covered.
