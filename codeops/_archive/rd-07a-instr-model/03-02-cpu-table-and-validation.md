# CPU Validation Table & Validator

> **Document**: 03-02-cpu-table-and-validation.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-07 R14–R16, R61, §4.8 · FR-14..FR-16

## Overview

This component answers one question for every `Instr`: *"is this opcode legal in this
addressing mode on the active CPU?"* It ships two files:

1. **`cpu-table.ts`** — the static `CpuTable` mapping each `Opcode` to its set of legal
   `AddressingMode`s, authored fully for the NMOS 6502 (56 mnemonics) with the 65C02
   extension set added as a gated superset (decision D3).
2. **`validate.ts`** — `validateStream(stream, cpuVariant, bag)` and the predicate
   `isLegalMode(opcode, mode, cpuVariant)`. A violation is an **internal compiler error**
   (R15/R61): the validator raises an `E90001` ICE via `bag.addICE` (decision D6).

This is the piece that makes "no undefined behavior" (H5) and "NMOS never emits 65C02-only
modes" (R16) *tested properties of 07a*, not promises deferred to 07b.

## Architecture

### `CpuTable` shape (§4.8)

```typescript
import type { Opcode } from "./opcode.js";
import type { AddressingMode } from "./addressing-mode.js";

/** Maps each opcode to the set of addressing modes legal for it on a given CPU. */
export type CpuTable = ReadonlyMap<Opcode, ReadonlySet<AddressingMode>>;
```

### Two tables, variant-selected (D3, R16)

- `NMOS_6502_TABLE: CpuTable` — the authoritative NMOS table (56 opcodes).
- `W65C02_TABLE: CpuTable` — the NMOS table **plus** the 65C02 extension opcodes
  (`BRA`/`STZ`/`PHX`/…) **and** the extra 65C02 addressing-mode capability: the
  `ZeroPageIndirect` (`(zp)`) mode added to the 8 `(zp)`-capable opcodes (D8). Built by
  cloning the NMOS table and layering the extensions, so the two never drift.

```typescript
/** Select the legality table for a CPU variant. */
export function cpuTableFor(cpuVariant: CpuVariant): CpuTable {
  return cpuVariant === "wdc65c02" ? W65C02_TABLE : NMOS_6502_TABLE;
}
```

### Table content — authoring source

The legal opcode+mode combinations are transcribed from the canonical NMOS 6502 opcode
matrix (the same data ACME, cc65, and every 6502 assembler encode). Representative rows
(the full table covers all 56 NMOS mnemonics):

| Opcode | Legal modes (NMOS) |
| ------ | ------------------ |
| `LDA` | Immediate, ZeroPage, ZeroPageX, Absolute, AbsoluteX, AbsoluteY, IndirectX, IndirectY |
| `STA` | ZeroPage, ZeroPageX, Absolute, AbsoluteX, AbsoluteY, IndirectX, IndirectY |
| `LDX` | Immediate, ZeroPage, ZeroPageY, Absolute, AbsoluteY |
| `LDY` | Immediate, ZeroPage, ZeroPageX, Absolute, AbsoluteX |
| `STX` | ZeroPage, ZeroPageY, Absolute |
| `STY` | ZeroPage, ZeroPageX, Absolute |
| `ADC`/`AND`/`CMP`/`EOR`/`ORA`/`SBC` | Immediate, ZeroPage, ZeroPageX, Absolute, AbsoluteX, AbsoluteY, IndirectX, IndirectY |
| `ASL`/`LSR`/`ROL`/`ROR` | Accumulator, ZeroPage, ZeroPageX, Absolute, AbsoluteX |
| `INC`/`DEC` | ZeroPage, ZeroPageX, Absolute, AbsoluteX |
| `CPX`/`CPY` | Immediate, ZeroPage, Absolute |
| `BIT` | ZeroPage, Absolute |
| `JMP` | Absolute, Indirect |
| `JSR` | Absolute |
| `BCC`/`BCS`/`BEQ`/`BMI`/`BNE`/`BPL`/`BVC`/`BVS` | Relative |
| `BRK`/`CLC`/`CLD`/`CLI`/`CLV`/`DEX`/`DEY`/`INX`/`INY`/`NOP`/`PHA`/`PHP`/`PLA`/`PLP`/`RTI`/`RTS`/`SEC`/`SED`/`SEI`/`TAX`/`TAY`/`TSX`/`TXA`/`TXS`/`TYA` | Implied |

65C02 superset additions (only in `W65C02_TABLE`):

| Opcode | Legal modes (65C02) |
| ------ | ------------------- |
| `BRA` | Relative |
| `STZ` | ZeroPage, ZeroPageX, Absolute, AbsoluteX |
| `PHX`/`PHY`/`PLX`/`PLY` | Implied |
| `TRB`/`TSB` | ZeroPage, Absolute |
| `ADC`/`AND`/`CMP`/`EOR`/`LDA`/`ORA`/`SBC`/`STA` *(gain the `(zp)` mode)* | `ZeroPageIndirect` (added to their existing NMOS modes) |

> **Authoring discipline:** the table is data, transcribed once from the canonical matrix.
> Spec tests (ST-V*) assert representative legal pairs *and* representative illegal pairs so
> a transcription slip is caught (e.g. `LDA Implied` must be illegal; `JSR ZeroPage` must be
> illegal; `STZ` must be illegal on NMOS, legal on 65C02).

## Implementation Details — `validate.ts`

```typescript
import { IceCode } from "@blend65/core";
import type { DiagnosticBag } from "@blend65/core";
import type { Opcode } from "./opcode.js";
import type { AddressingMode } from "./addressing-mode.js";
import type { CpuVariant, InstrStream, StreamEntry } from "./stream.js";
import { cpuTableFor } from "./cpu-table.js";

/**
 * Returns whether `opcode` is legal in `mode` on `cpuVariant`.
 *
 * Pure predicate — used by both the validator and (later) RD-07b/RD-08 to check a
 * candidate instruction before emitting it.
 */
export function isLegalMode(
  opcode: Opcode,
  mode: AddressingMode,
  cpuVariant: CpuVariant,
): boolean {
  const legal = cpuTableFor(cpuVariant).get(opcode);
  return legal !== undefined && legal.has(mode);
}

/**
 * Validates every instr entry in `stream` against the active CPU's legality table.
 *
 * A violation means codegen produced an instruction the target CPU cannot execute —
 * a compiler bug, never a user error (R15). It is reported as an `E90001` ICE (D6);
 * the message names the offending opcode+mode+variant. Labels and directives are
 * skipped (they have no opcode). The validator never throws (it uses the bag).
 */
export function validateStream(
  stream: InstrStream,
  cpuVariant: CpuVariant,
  bag: DiagnosticBag,
): void {
  for (const entry of stream.entries) {
    if (entry.type !== "instr") {
      continue;
    }
    if (!isLegalMode(entry.opcode, entry.mode, cpuVariant)) {
      bag.addICE(
        IceCode.Unexpected,
        entry.sourceSpan ?? null,
        `illegal opcode+mode for ${cpuVariant}: ${entry.opcode} ${entry.mode}`,
      );
    }
  }
}
```

## Integration Points

- **`@blend65/core`** — `IceCode`, `DiagnosticBag` (value `IceCode`, type `DiagnosticBag`).
- **03-01 model** — `Opcode`, `AddressingMode`, `CpuVariant`, `InstrStream`, `StreamEntry`.
- **RD-07b** — calls `validateStream` on each generated stream before handing the
  `InstrProgram` to RD-08/RD-09; may call `isLegalMode` during instruction selection to
  pick a legal addressing mode.

## Code Examples

### Example 1: validating a legal NMOS stream (no diagnostics)

```typescript
const bag = createDiagnosticBag();
validateStream(
  { symbol: "add", segment: "code", entries: add8 },  // LDA/CLC/ADC/STA from 03-01
  "nmos6502",
  bag,
);
// bag.hasErrors() === false
```

### Example 2: an illegal pair raises an ICE

```typescript
const bag = createDiagnosticBag();
validateStream(
  { symbol: "bug", segment: "code", entries: [instr("JSR", "ZeroPage", symbolRef("f"))] },
  "nmos6502",
  bag,
);
// bag.getErrors()[0].code === "E90001"
// message: "illegal opcode+mode for nmos6502: JSR ZeroPage"
```

### Example 3: variant gating (R16)

```typescript
const stz = { symbol: "clear", segment: "code", entries: [instr("STZ", "Absolute", symbolRef("scr"))] };

const nmosBag = createDiagnosticBag();
validateStream(stz, "nmos6502", nmosBag);   // ICE — STZ illegal on NMOS
// nmosBag.hasErrors() === true

const cmosBag = createDiagnosticBag();
validateStream(stz, "wdc65c02", cmosBag);    // OK — STZ legal on 65C02
// cmosBag.hasErrors() === false
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Instr with opcode not in the table (impossible via typed `Opcode`, but defensively) | `isLegalMode` returns `false` (map `.get` is `undefined`) → ICE. No throw | AR D6 |
| Instr legal-mode violation | `bag.addICE(IceCode.Unexpected, span, message)` — `E90001` band (R61) | AR D6 |
| 65C02-only opcode/mode on NMOS target | Illegal under `NMOS_6502_TABLE` → ICE (R16) | AR D3 |
| Label / directive entry | Skipped — no opcode to validate | R5/R6 |

> The validator is **total and never throws** (H5, mirroring `DiagnosticBag.add*` which
> never throw): all failure surfaces as a recorded ICE the build can inspect.

## Testing Requirements

- Spec tests ST-V* (07-testing-strategy): representative legal pairs accepted with zero
  diagnostics; representative illegal pairs raise `E90001`; the message text names
  opcode+mode+variant; `STZ`/`BRA` etc. illegal on NMOS but legal on 65C02 (R16);
  labels/directives skipped; the ICE carries the entry's `sourceSpan` when present;
  `LDA ZeroPageIndirect` (`(zp)`) is illegal on NMOS but legal on 65C02 (R16/D8).
- Impl tests: every NMOS opcode has a non-empty legal-mode set; `isLegalMode` total over the
  full `OPCODES × ADDRESSING_MODES` grid returns a boolean (no throw); `W65C02_TABLE`
  is a strict superset of `NMOS_6502_TABLE` (every NMOS legal pair stays legal on 65C02).
