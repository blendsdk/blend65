# Testing Strategy: RD-07a Instr Model, CPU Table & Serializer

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

RD-07a is a **pure-data + pure-function** layer: a typed model, a static legality table +
validator, and a deterministic serializer. There is no external/user input, so the testing
focus is **specification conformance** (the model shapes and serializer output match RD-07
§4.1–§4.8 exactly) and **determinism** (golden snapshots). All tests run under Vitest in
`@blend65/codegen`.

### Coverage Goals

- Core model/table/serializer logic: 90%+ (code.md §2).
- Golden snapshots for the canonical streams (AR-22 tier 2 / RD-07 AC-18).
- Every addressing mode, every operand kind, every directive kind exercised.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived **exclusively** from `requirements/RD-07-codegen-instr.md` (R1–R16, R52–R54),
> the component specs (03-01..03-03), and the Ambiguity Register (D1–D9). These are
> **immutable oracles** — if the implementation disagrees, the implementation is wrong
> (testing.md Rule 10). The serializer ST-cases below specify expected output text derived
> from RD-07 §4 + ACME syntax, **not** from any implementation.

### Component 1 — Instr Model (`instr/opcode.ts`, `addressing-mode.ts`, `operand.ts`, `stream.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-M1 | `OPCODES` tuple | 64 entries (56 NMOS + 8 65C02), no duplicates | R3 / 03-01 |
| ST-M2 | `NMOS_OPCODES` / `W65C02_OPCODES` | 56 / 8 entries; disjoint; `STZ`/`BRA` only in 65C02 set | R3 / D3 |
| ST-M3 | `ADDRESSING_MODES` tuple | exactly the 14 modes of R4 + D8 (incl. `ZeroPageIndirect`), in the documented order | R4 / D8 |
| ST-M4 | `imm8(0x42)` | `{ kind: "immediate", value: 0x42 }` | R9 / 03-01 |
| ST-M5 | `symbolRef("a")` | `{ kind: "symbolRef", name: "a", byteSelect: "none" }` — no `offset` key | R10 / 03-01 |
| ST-M6 | `symbolRef("p", { offset: 2 })` | record includes `offset: 2`; `byteSelect: "none"` | R10 |
| ST-M7 | `symbolRef("b", { byteSelect: "low" })` | `byteSelect: "low"` | R13 |
| ST-M8 | `labelRef("loop")` / `zpSlot("ptr")` / `none()` | the documented `labelRef`/`zpSlot`/`none` records | R8/R11/R12 |
| ST-M9 | `instr("LDA","Absolute",symbolRef("a"))` | `{ type:"instr", opcode:"LDA", mode:"Absolute", operand:{…}, }` — no `sourceSpan` key | R2 / 03-01 |
| ST-M10 | `instr(...)` with a `SourceSpan` arg | record includes `sourceSpan` | R2/R50 |
| ST-M11 | `label("x")` / `directive({kind:"byte",values:[1]})` | the documented `label`/`directive` `StreamEntry` records | R5/R6 |
| ST-M12 | guards `isInstr`/`isLabel`/`isDirective`, `isImmediate`/`isSymbolRef`/`isLabelRef`/`isZpSlot` | each narrows correctly and returns boolean for every entry/operand kind | 03-01 |

### Component 2 — CPU Validation (`instr/cpu-table.ts`, `instr/validate.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-V1 | `validateStream({… LDA Absolute / CLC Implied / ADC Absolute / STA Absolute}, "nmos6502", bag)` | `bag.hasErrors() === false` | R14 / AC-04 |
| ST-V2 | `validateStream({… JSR ZeroPage}, "nmos6502", bag)` | one error, code `E90001`, message `illegal opcode+mode for nmos6502: JSR ZeroPage` | R15/R61 / D6 |
| ST-V3 | `validateStream({… LDA Implied}, "nmos6502", bag)` | `E90001` ICE (LDA has no Implied mode) | R14/R15 |
| ST-V4 | `validateStream({… STZ Absolute}, "nmos6502", bag)` | `E90001` ICE — STZ illegal on NMOS | R16 |
| ST-V5 | `validateStream({… STZ Absolute}, "wdc65c02", bag)` | `bag.hasErrors() === false` — STZ legal on 65C02 | R16 / D3 |
| ST-V6 | `validateStream` over a stream of only labels + directives | no diagnostics (non-instr entries skipped) | R5/R6 |
| ST-V7 | illegal instr carries a `sourceSpan` | the emitted ICE's primary span equals that span | R50 |
| ST-V8 | `isLegalMode("LDA","Immediate","nmos6502")` / `isLegalMode("JSR","ZeroPage","nmos6502")` | `true` / `false` | §4.8 |
| ST-V9 | `isLegalMode("BRA","Relative","nmos6502")` / `("BRA","Relative","wdc65c02")` | `false` / `true` | R16/D3 |
| ST-V10 | `isLegalMode("LDA","ZeroPageIndirect","nmos6502")` / `("LDA","ZeroPageIndirect","wdc65c02")` | `false` / `true` — 65C02 `(zp)` gated | R16/D8 |

### Component 3 — Canonical Serializer (`instr/print-instr.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-S1 | `instr("RTS","Implied",none())` | line `RTS` (no operand text) | R54 / 03-03 |
| ST-S2 | `instr("ASL","Accumulator",none())` | line `ASL A` | R54 |
| ST-S3 | `instr("LDA","Immediate",imm8(0x42))` | line `LDA #$42` (uppercase hex) | R54 |
| ST-S4 | `instr("LDA","Immediate",symbolRef("buf",{byteSelect:"low"}))` | line `LDA #<buf` | R13 |
| ST-S5 | `instr("LDA","Immediate",symbolRef("buf",{byteSelect:"high"}))` | line `LDA #>buf` | R13 |
| ST-S6 | `instr("LDA","Absolute",symbolRef("scr"))` | line `LDA scr` (symbolic name, not hex) | R8/R54 |
| ST-S7 | `instr("LDA","AbsoluteX",symbolRef("scr"))` | line `LDA scr,X` | R54 |
| ST-S8 | `instr("LDA","IndirectY",zpSlot("ptr"))` | line `LDA (ptr),Y` | R54 |
| ST-S9 | `instr("LDA","IndirectX",zpSlot("ptr"))` | line `LDA (ptr,X)` | R54 |
| ST-S10 | `instr("JMP","Indirect",symbolRef("vec"))` | line `JMP (vec)` | R54 |
| ST-S11 | `instr("LDA","Absolute",symbolRef("player",{offset:2}))` | line `LDA player+2` | R10 |
| ST-S12 | `instr("BNE","Relative",labelRef("loop"))` | line `BNE loop` | R54 |
| ST-S12b | `instr("LDA","ZeroPageIndirect",zpSlot("ptr"))` | line `LDA (ptr)` (65C02 `(zp)`, distinct from `Indirect`) | R54 / D8 |
| ST-S13 | `label("loop")` | line `loop:` at column 0 | R5 |
| ST-S14 | `directive({kind:"byte",values:[0,1,2,3]})` | line `!byte $00, $01, $02, $03` | R6 |
| ST-S15 | `directive({kind:"word",values:[0x0801]})` | line `!word $0801` | R6 |
| ST-S16 | `directive({kind:"origin",address:0x0801})` | line `* = $0801` | R6 |
| ST-S17 | `directive({kind:"symbolDef",name:"vic",value:0xD000})` | line `vic = $D000` | R6 |
| ST-S18 | `directive({kind:"fill",count:256,value:0})` | line `!fill 256, $00` | R6 |
| ST-S19 | `directive({kind:"text",text:"HI"})` | line `!text "HI"` | R6 |
| ST-S20 | `directive({kind:"outputFile",name:"out.prg",format:"cbm"})` | line `!to "out.prg", cbm` | R6 |
| ST-S21 | `printInstr(stream)` called twice | byte-identical strings (determinism) | R53 |
| ST-S22 | `instrByteSize` for `LDA Immediate` / `LDA Absolute` / `RTS Implied` | `2` / `3` / `1` | R58 |
| ST-S22b | `instrByteSize` for `LDA ZeroPageIndirect` / `JMP Indirect` | `2` / `3` — `(zp)` is 2 bytes vs `Indirect` 3 | R58 / D8 |
| ST-S23 | `instrByteSize` for `!byte [a,b,c]` / `!word [x,y]` / `!fill 256,0` / `label` | `3` / `4` / `256` / `0` | R58 |

### Golden snapshots (AR-22 tier 2)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-G1 | `printInstr` of the 8-bit add stream (03-01 Ex.1) | snapshot matches `add:` + LDA/CLC/ADC/STA block | AC-18 / 03-03 Ex.1 |
| ST-G2 | `printInstr` of the pointer-setup + branch stream (03-01 Ex.2) | snapshot matches byte-select + `LDA (ptr),Y` + `loop:`/`BNE loop` | AC-18 / 03-03 Ex.2 |
| ST-G3 | `printInstr` of the palette data block (03-01 Ex.3) | snapshot matches `palette:` + `!byte …` | AC-18 / 03-03 Ex.3 |

> **⚠️ AUTHORING RULE:** ST-S*/ST-G* expected text is derived from RD-07 §4 + ACME syntax
> conventions, NOT from running the serializer. If an expectation cannot be determined from
> the spec, it is an ambiguity → add to the register (surface-during-authoring rule).

## Test Categories

### Specification Tests (from ST-cases above)

> Written BEFORE implementation. `describe('Specification: …')`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `instr/instr-model.spec.test.ts` | ST-M1..M12 | Model |
| `instr/validate.spec.test.ts` | ST-V1..V10 | CPU table + validator |
| `instr/print-instr.spec.test.ts` | ST-S1..S23 (incl. ST-S12b/S22b) | Serializer |
| `instr/print-instr.golden.spec.test.ts` | ST-G1..G3 | Serializer goldens |

### Implementation Tests (edge cases, internals)

> Written AFTER implementation. `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `instr/instr-model.impl.test.ts` | constructor offset/sourceSpan omission; guard totality over all kinds; tuple uniqueness | High |
| `instr/validate.impl.test.ts` | every NMOS opcode has a non-empty mode set; `isLegalMode` total over the full grid (no throw); 65C02 ⊇ NMOS superset property | High |
| `instr/print-instr.impl.test.ts` | empty stream → `""`; labels/directives-only stream; `instrByteSize` per mode; `never` exhaustiveness arms | Med |

### Integration / E2E

- **E2E for 07a** (compiler-internal): build a hand-written `InstrStream` →
  `validateStream` (clean) → `printInstr` → assert exact ACME text. This is the
  "model → validate → serialize" mini-pipeline that RD-07b will drive from real IL. Covered
  by ST-G1..G3 (build fixture → validate → snapshot).

## Test Data

### Fixtures Needed (`instr/test-fixtures.ts`, NOT barrel-exported)

- `add8Stream` — the LDA/CLC/ADC/STA 8-bit add (ST-V1, ST-G1).
- `ptrSetupStream` — byte-select + indirect-indexed + branch (ST-G2).
- `paletteStream` — label + `!byte` data block (ST-G3).
- `illegalJsrStream`, `stzStream` — for validator ST-V2/V4/V5.

### Mock Requirements

- None — uses the **real** `createDiagnosticBag()` (code.md §29: prefer real objects). The
  bag exists and is the actual collaborator.

## Verification Checklist

- [ ] All ST-* defined with concrete input/output pairs (above)
- [ ] Every ST case traces to an R/AC/AR source (column filled)
- [ ] Spec tests written BEFORE implementation
- [ ] Spec tests verified to FAIL before implementation (red phase — via typecheck, symbols absent)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Impl tests written for edge cases and internals
- [ ] Golden snapshots committed (ST-G1..G3)
- [ ] No regressions; R15 boundary tier green; `spec/` clean
- [ ] Coverage meets goals; no dead code
