# Instr Model: Opcode, AddressingMode, Operand & Stream

> **Document**: 03-01-instr-model.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-07 R1–R13, §4.1–§4.3 · FR-1..FR-13

## Overview

This component defines the **typed, in-memory representation of real 6502 machine code** —
the `StreamEntry` discriminated union (`Instr` | `Label` | `Directive`), the symbolic
`InstrOperand` union, the `Opcode`/`AddressingMode` value-tuples, the `CpuVariant`
primitive, and the per-function `InstrStream` container. It is **pure data + trivial
constructors/guards** — no behavior beyond shaping records (validation lives in 03-02,
serialization in 03-03).

The model is transcribed verbatim from RD-07 §4.1–§4.3 and follows the exact conventions
the RD-06 IL model already established (`kind`-discriminated readonly unions, `as const`
value tuples that keep the string union from drifting, small constructor functions, type
guards).

## Architecture

### Module layout (decision D5)

```
packages/codegen/src/instr/
  opcode.ts            # Opcode tuple + type (56 NMOS + 8 65C02), NMOS/65C02 partition
  addressing-mode.ts   # AddressingMode tuple + type (14 modes; ZeroPageIndirect gated to 65C02)
  operand.ts           # InstrOperand union + constructors + guards
  stream.ts            # CpuVariant, AcmeDirective, StreamEntry, InstrStream + constructors
  index.ts             # barrel (added incrementally across 03-01..03-03)
```

Each file is well under the 500-line split threshold (code.md rule 21). `opcode.ts` and
`addressing-mode.ts` are split from `stream.ts` because the CPU table (03-02) imports the
opcode/mode value sets without needing the stream records.

## Implementation Details

### `opcode.ts` — the mnemonic set (R3)

Opcodes are exported as an `as const` tuple (mirroring IL's `IL_OPS`) so the string union
is generated from the runtime value set and can never drift. The NMOS and 65C02 subsets are
exported separately so the CPU table (03-02) can partition legality by variant.

```typescript
/** The 56 NMOS 6502 mnemonics (R3), in canonical alphabetical order. */
export const NMOS_OPCODES = [
  "ADC", "AND", "ASL", "BCC", "BCS", "BEQ", "BIT", "BMI", "BNE", "BPL",
  "BRK", "BVC", "BVS", "CLC", "CLD", "CLI", "CLV", "CMP", "CPX", "CPY",
  "DEC", "DEX", "DEY", "EOR", "INC", "INX", "INY", "JMP", "JSR", "LDA",
  "LDX", "LDY", "LSR", "NOP", "ORA", "PHA", "PHP", "PLA", "PLP", "ROL",
  "ROR", "RTI", "RTS", "SBC", "SEC", "SED", "SEI", "STA", "STX", "STY",
  "TAX", "TAY", "TSX", "TXA", "TXS", "TYA",
] as const;

/** The 65C02-only mnemonics (R3) — legal only when cpuVariant === "wdc65c02". */
export const W65C02_OPCODES = [
  "BRA", "PHX", "PHY", "PLX", "PLY", "STZ", "TRB", "TSB",
] as const;

/** Every opcode the model can represent (NMOS ∪ 65C02). */
export const OPCODES = [...NMOS_OPCODES, ...W65C02_OPCODES] as const;

/** The typed union of all 6502 mnemonics. */
export type Opcode = (typeof OPCODES)[number];
```

> **Note on 65C02 indirect `(zp)` mode:** R16 also calls out the 65C02 `(zp)`
> indirect-without-index addressing mode as NMOS-illegal. That is an *addressing-mode*
> gating concern, handled in the CPU table (03-02), not a separate opcode here.

### `addressing-mode.ts` — the addressing-mode set (R4)

```typescript
/** The 14 addressing modes the model represents (R4 + D8). */
export const ADDRESSING_MODES = [
  "Implied",          // CLC, RTS, ...
  "Accumulator",      // ASL A
  "Immediate",        // LDA #$42
  "ZeroPage",         // LDA $02
  "ZeroPageX",        // LDA $02,X
  "ZeroPageY",        // LDX $02,Y
  "Absolute",         // LDA $D020
  "AbsoluteX",        // LDA $0400,X
  "AbsoluteY",        // LDA $0400,Y
  "Indirect",         // JMP ($FFFC)         — 16-bit absolute indirect (3 bytes)
  "IndirectX",        // LDA ($02,X)
  "IndirectY",        // LDA ($02),Y
  "Relative",         // BEQ label
  "ZeroPageIndirect", // LDA ($02)           — 65C02 (zp), 8-bit indirect (2 bytes); gated (D8)
] as const;

/** The typed union of all addressing modes. */
export type AddressingMode = (typeof ADDRESSING_MODES)[number];
```

### `operand.ts` — the symbolic operand union (R8–R13)

Mirrors `il/operand.ts`: a `kind`-discriminated readonly union, small constructors, type
guards. **No hard `$xxxx` addresses** — everything is symbolic (R8); ACME resolves symbols
to numbers later (RD-09).

```typescript
export type InstrOperand =
  | { readonly kind: "none" }                                                   // implied/accumulator (R8)
  | { readonly kind: "immediate"; readonly value: number }                      // LDA #$42 (R9)
  | {
      readonly kind: "symbolRef";                                               // named symbol (R10)
      readonly name: string;
      readonly offset?: number;                                                 // struct/array field (R10)
      readonly byteSelect: "low" | "high" | "none";                             // <sym / >sym (R13)
    }
  | { readonly kind: "labelRef"; readonly label: string }                       // branch target (R11)
  | { readonly kind: "zpSlot"; readonly name: string };                         // ZP allocation (R12)

export function none(): InstrOperand;
export function imm8(value: number): InstrOperand;                              // { kind:"immediate", value }
export function symbolRef(
  name: string,
  opts?: { offset?: number; byteSelect?: "low" | "high" | "none" },
): InstrOperand;                                                                // byteSelect defaults to "none"
export function labelRef(label: string): InstrOperand;
export function zpSlot(name: string): InstrOperand;

export function isImmediate(o: InstrOperand): o is Extract<InstrOperand, { kind: "immediate" }>;
export function isSymbolRef(o: InstrOperand): o is Extract<InstrOperand, { kind: "symbolRef" }>;
export function isLabelRef(o: InstrOperand): o is Extract<InstrOperand, { kind: "labelRef" }>;
export function isZpSlot(o: InstrOperand): o is Extract<InstrOperand, { kind: "zpSlot" }>;
```

**Constructor detail (mirrors `loc`'s offset handling in `il/operand.ts`):** `symbolRef`
only attaches `offset` when it is supplied, so two symbol refs without offsets compare
equal under `toEqual` and serialize identically. `byteSelect` is always present (defaults
to `"none"`) because the serializer branches on it unconditionally.

### `stream.ts` — `CpuVariant`, directives, stream entries, container (R5–R7)

```typescript
import type { SourceSpan } from "@blend65/core";
import type { Opcode } from "./opcode.js";
import type { AddressingMode } from "./addressing-mode.js";
import type { InstrOperand } from "./operand.js";

/** The CPU variant a stream targets (decision D2). The ONLY profile primitive 07a needs. */
export type CpuVariant = "nmos6502" | "wdc65c02";

/** ACME assembler directives that appear inline in the stream (R6). */
export type AcmeDirective =
  | { readonly kind: "origin"; readonly address: number }                        // * = $0801
  | { readonly kind: "symbolDef"; readonly name: string; readonly value: number } // sym = $XXXX
  | { readonly kind: "byte"; readonly values: readonly number[] }                 // !byte $01, $02
  | { readonly kind: "word"; readonly values: readonly number[] }                 // !word $0801
  | { readonly kind: "text"; readonly text: string; readonly encoding?: string }  // !text "hi"
  | { readonly kind: "fill"; readonly count: number; readonly value: number }     // !fill 256, $00
  | { readonly kind: "outputFile"; readonly name: string; readonly format: string }; // !to "out.prg", cbm

/** One entry in an instruction stream — instr, label, or directive (R5/R6). */
export type StreamEntry =
  | {
      readonly type: "instr";
      readonly opcode: Opcode;
      readonly mode: AddressingMode;
      readonly operand: InstrOperand;
      readonly sourceSpan?: SourceSpan;   // model surface; propagation is RD-07b (R50/R51)
    }
  | { readonly type: "label"; readonly name: string }
  | { readonly type: "directive"; readonly directive: AcmeDirective };

/** A per-function (or per-data-block) instruction stream (R7). */
export interface InstrStream {
  readonly symbol: string;                 // function or data label
  readonly segment: "code" | "data" | "zp";
  readonly entries: readonly StreamEntry[];
}

/** Construct an instr entry. sourceSpan is attached only when supplied (stable equality). */
export function instr(
  opcode: Opcode,
  mode: AddressingMode,
  operand: InstrOperand,
  sourceSpan?: SourceSpan,
): StreamEntry;
export function label(name: string): StreamEntry;
export function directive(d: AcmeDirective): StreamEntry;

/** Type guards over StreamEntry. */
export function isInstr(e: StreamEntry): e is Extract<StreamEntry, { type: "instr" }>;
export function isLabel(e: StreamEntry): e is Extract<StreamEntry, { type: "label" }>;
export function isDirective(e: StreamEntry): e is Extract<StreamEntry, { type: "directive" }>;
```

## Integration Points

- **`@blend65/core`** — `SourceSpan` (the optional `Instr.sourceSpan` field). Imported as a
  type only.
- **03-02 (CPU table/validation)** — imports `Opcode`, `AddressingMode`, `CpuVariant`, and
  the `NMOS_OPCODES`/`W65C02_OPCODES` partitions.
- **03-03 (serializer)** — imports the whole model to render it.
- **RD-07b** — constructs `StreamEntry[]` from IL; 07a's constructors are its building
  blocks.

## Code Examples

### Example 1: an 8-bit add sequence (the canonical translation target, built by hand here)

```typescript
import { instr } from "./stream.js";
import { symbolRef, none } from "./operand.js";

// LDA a / CLC / ADC b / STA dest  (R18 — 07b will generate this; 07a models + validates it)
const add8: StreamEntry[] = [
  instr("LDA", "Absolute", symbolRef("a")),
  instr("CLC", "Implied", none()),
  instr("ADC", "Absolute", symbolRef("b")),
  instr("STA", "Absolute", symbolRef("dest")),
];
```

### Example 2: a labelled branch + pointer setup with byte-select

```typescript
const ptrSetup: StreamEntry[] = [
  instr("LDA", "Immediate", symbolRef("buffer", { byteSelect: "low" })),   // LDA #<buffer
  instr("STA", "ZeroPage", zpSlot("ptr")),
  instr("LDA", "Immediate", symbolRef("buffer", { byteSelect: "high" })),  // LDA #>buffer
  instr("STA", "ZeroPage", zpSlot("ptr+1")),
  label("loop"),
  instr("LDA", "IndirectY", zpSlot("ptr")),                                // LDA (ptr),Y
  instr("BNE", "Relative", labelRef("loop")),
];
```

### Example 3: a const-data block

```typescript
const dataBlock: InstrStream = {
  symbol: "palette",
  segment: "data",
  entries: [
    label("palette"),
    directive({ kind: "byte", values: [0x00, 0x01, 0x02, 0x03] }),
  ],
};
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Illegal opcode+mode pair on a `StreamEntry` | Detected by the validator (03-02), **not** the model — the model is pure data and cannot reject a record | AR D6 |
| Out-of-range immediate (e.g. `imm8(300)`) | **Not** rejected at model level — operand value range is a translation concern; 07b/peephole own range checks. 07a's `imm8` documents the 8-bit expectation but stores verbatim | spec Ch 04 |

> The model layer is intentionally **total** (every constructor always succeeds) — all
> rejection happens in the validator (03-02), keeping data and policy separate (H5: defined
> behavior, no exceptions thrown from data constructors, mirroring `il/operand.ts`).

## Testing Requirements

- Unit tests: each constructor produces the exact record shape; guards narrow correctly;
  `symbolRef` omits `offset` when absent and includes it when present; `byteSelect` defaults
  to `"none"`; the `OPCODES` tuple has 64 entries (56 + 8) with no duplicates; the
  `ADDRESSING_MODES` tuple has 14 entries (incl. `ZeroPageIndirect`, D8).
- Spec tests ST-M* (03-07) assert the documented shapes from RD-07 §4.1–§4.3.
