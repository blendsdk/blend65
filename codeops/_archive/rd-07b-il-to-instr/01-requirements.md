# Requirements: RD-07b IL→Instr Translation, Register Binding & `generateInstr`

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-07](../../requirements/RD-07-codegen-instr.md) (R17–R45, R50–R51, R55–R61) · [RD-07a plan](../rd-07a-instr-model/00-index.md) · spec Ch 04/06

## Feature Overview

RD-07b delivers the **consumer-coupled** half of the 6502 code generator: it *produces*
`Instr` streams (RD-07a's model) from real IL (RD-06's `il/` model), binds IL virtual temps
to physical 6502 registers + ZP scratch (from the carried `AllocationPlan`), and assembles
the result into an `InstrProgram` via the `generateInstr` entry point.

Scoped as a **slice matching RD-06's live lowering** (D1): RD-07b translates exactly the IL
ops `lowerToIL` emits today and defers the rest — plus the RD-10 platform-hook seam — to a
later **RD-07c**. It takes a `cpuVariant` primitive (D2), not the (still absent) RD-10
`PlatformProfile`, so nothing built here is reworked when RD-10 lands.

This document scopes RD-07b precisely against the parent RD-07 requirements: which `R`/`AC`
items land here, and which are explicitly deferred to RD-07c.

## Functional Requirements

### Must Have (RD-07b — in scope)

#### IL→Instr translation — live op set (RD-07 §3.4)

- [ ] **FR-1 (R17)** — Each translated IL instruction maps deterministically to one or more
  `StreamEntry` `instr` records (same IL → same `Instr` sequence). Translation is driven by a
  `switch (instr.op)` with per-op emitters.
- [ ] **FR-2 (R18/R20)** — 8-bit `add` → `LDA left; CLC; ADC right; STA dest`; 8-bit `sub` →
  `LDA left; SEC; SBC right; STA dest`.
- [ ] **FR-3 (R19)** — 16-bit `add`/`sub` → lo-byte op then hi-byte op-with-carry/borrow,
  selected when the op's `ILType` is `IL_WORD`/`IL_SWORD` (D5).
- [ ] **FR-4 (R19, bitwise)** — `and`/`or`/`xor` → `LDA left; AND/ORA/EOR right; STA dest`
  (8-bit); 16-bit applies the op per byte.
- [ ] **FR-5 (R19, shift)** — `shl`/`shr` → `ASL`/`LSR` sequences (per-bit for a constant
  shift count; the live lowering's shift count is an operand).
- [ ] **FR-6 (R23/Ch 04 §5)** — Comparison ops (`eq`/`ne`/`lt`/`le`/`gt`/`ge`) → `CMP`-based
  flag test materialising a 0/1 `IL_BYTE` result into `dest` (unsigned form for the slice;
  the result type is already `IL_BYTE` per RD-06 R20).
- [ ] **FR-7 (R21, mul)** — `mul` call-site: (1) both operands constant → fold to a `const`
  (no code); (2) constant power-of-2 → `ASL` shift sequence; (3) otherwise
  `JSR __rt_mul8`/`__rt_mul16` + emit W10170 (or W10172 for the shift-and-add path) (D4).
- [ ] **FR-8 (R22, div/mod)** — `div`/`mod` call-site: `JSR __rt_div8`/`__rt_div16` (mod uses
  the remainder return) + emit W10171 (D4). Routine **bodies** are RD-17 (out of scope).
- [ ] **FR-9 (R27)** — `load` → `LDA` (8-bit) or `LDA`+`LDX` (16-bit) from the source
  `Location` (→ `SymbolRef`); ZP-resident locations use a zero-page addressing mode.
- [ ] **FR-10 (R28)** — `store` → `STA` (8-bit) or `STA`+`STX` (16-bit) to the destination
  `Location`.
- [ ] **FR-11 (R28, const)** — `const` (materialise) → `LDA #imm` (8-bit) / `LDA #<imm` +
  `LDX #>imm` (16-bit) into the destination temp's bound register.
- [ ] **FR-12 (R32)** — `ret` terminator → place the value in A (8-bit) or A/X (16-bit) then
  `RTS`; void `ret` → `RTS` (Ch 06 FN-4). Interrupt functions use `RTI` (R33) — **deferred**
  unless an interrupt body lowers in the live set; if `ILFunction.isInterrupt` is set, the
  `RTS`→`RTI` swap is applied (the prologue/epilogue save sequence is RD-07c).

#### Register binding (RD-07 §3.5)

- [ ] **FR-13 (R40)** — IL virtual temps are bound to A/X/Y + ZP scratch at codegen time. The
  binder reads `category: "temp"` ZP runs from the carried `AllocationPlan.zpAllocations`.
- [ ] **FR-14 (R41/R42)** — A is the primary accumulator (ALU ops); X holds the 16-bit
  return/secondary high byte; Y is reserved for indexed/indirect (unused in the live set).
- [ ] **FR-15 (R43)** — When registers are exhausted, temps spill to ZP scratch bytes
  (`__zp_tmp_N`) from the plan; the binder minimises spills by reusing registers.
- [ ] **FR-16 (R44)** — Per-block register-state tracking suppresses a redundant `LDA x` when
  A already holds `x`.
- [ ] **FR-17 (R45/R69)** — Register state is **reset at every block boundary** (label, branch
  target). For the single-block live functions this is the entry-block reset; multi-block
  reset is correct-by-construction for RD-07c.

#### `InstrProgram` & entry point (RD-07 §3.9)

- [ ] **FR-18 (R55)** — `generateInstr(ilProgram, cpuVariant, bag)` returns an `InstrProgram`
  `{ preamble, streams, allocationPlan }` with one `InstrStream` per translated function.
- [ ] **FR-19 (R56)** — The `InstrProgram` is consumable by RD-08 (peephole) and RD-09
  (emitter): `streams` are RD-07a `InstrStream`s; serialization is `printInstr` (RD-07a).
- [ ] **FR-20 (R57)** — The `InstrProgram` carries the `AllocationPlan` reference
  (`ilProgram.allocationPlan`) for the emitter's symbol definitions.
- [ ] **FR-21 (R59)** — Functions with no IL (skipped during lowering, error tolerance)
  produce no `InstrStream`.
- [ ] **FR-22 (R61, validation)** — `generateInstr` runs RD-07a `validateStream` over each
  emitted stream; any illegal opcode+mode raises an `E90001` ICE (a codegen bug, never user
  error).
- [ ] **FR-23 (R60, cost warnings)** — W10170/W10171/W10172 are emitted during instruction
  selection (mul/div), into the provided `DiagnosticBag`.

#### Source-span propagation (RD-07 §3.7)

- [ ] **FR-24 (R50/R51)** — The "lead" `Instr` of each translated IL instruction carries the
  IL instruction's `SourceSpan` when available (RD-06 threads spans via the `source_span` IL
  op / instruction provenance). Not every `Instr` needs a span.

### Should Have

- [ ] **FR-25** — End-to-end golden fixtures from **real** `.blend` source compiled through
  RD-02→RD-06, then `generateInstr` → `printInstr`, asserting the exact ACME text for a
  representative gate-level program (the slice's "runtime-verifiable" anchor).

### Won't Have (Out of Scope — deferred to RD-07c)

- IL ops no live lowering emits: `neg`/`not`, `load_indexed`/`store_indexed`,
  `load_indirect`/`store_indirect`, `copy`, `call`, `intrinsic`, `source_span` standalone;
  the `br`/`brcond`/`unreachable` terminators (multi-block CFG translation) (R24–R26, R29–R31,
  R34–R39). Each reaches an `E90001` ICE default arm.
- Calling-convention codegen (R31, parameter stores + `JSR` + return extraction) — needs
  `call` (not lowered).
- Interrupt prologue/epilogue save sequence (R33) — needs an interrupt body in the live set.
- For-loop Pattern A/B selection (R36/R37) — needs the lowered loop CFG.
- Platform codegen hooks: startup stub, binary format, origin, encoding (R46–R49) — RD-07c +
  RD-10. `InstrProgram.preamble` stays empty.
- `initCode` / `constData` translation (R64 data) — empty in the live IL.
- A real `PlatformProfile` type (RD-10); signed comparison N⊕V path (R23 signed) when signed
  comparison lowering is exercised.

## Technical Requirements

### Performance

- Translation and binding are linear in IL instruction count; no performance concern at
  compiler scale. Determinism (FR-1) is the binding constraint (golden snapshots).

### Compatibility

- TypeScript ESM, NodeNext, ES2023, `strict`; relative imports use `.js` (project.md).
- Consumes `@blend65/core` (`SourceSpan`, `DiagnosticBag`, `IceCode`, `AllocationPlan`) and
  the in-package RD-06 `il/` model + RD-07a `instr/` model; modifies neither.
- Respects R15/AR-20: all artifacts in `@blend65/codegen`; frontend/language-server never
  import it (verified by `test/boundary.spec.test.ts`).

### Security

- N/A — compiler-internal translation over already-validated IL; no external/user input at
  this layer (code.md §10 applicability note for pure-compute layers; documented, not
  skipped).

## Scope Decisions

| Decision   | Options Considered | Chosen | Rationale | AR Ref |
| ---------- | ------------------ | ------ | --------- | ------ |
| Build scope | Live-lowering slice / full R17–R39 / RD-10 first | **Live-lowering slice; defer rest to RD-07c** | No-rework; end-to-end verifiable on real IL | D1 |
| Entry-point input | `cpuVariant` primitive / interim profile stub / real RD-10 profile | **`cpuVariant` primitive; plan from `ilProgram`** | Primitive never migrates; RD-10 fills the caller additively | D2 |
| Translation set | Live ops only / whole model | **Live ops; ICE-default the rest** | Matches RD-06 R69 discipline; fails deterministically | D3 |
| mul/div/mod | Call-site now / defer | **Call-site now (fold/shift/`JSR __rt_*`)** | Spec-determined (R21/R22); routine bodies link later (RD-17) | D4 |
| Width | Both 8/16-bit / byte-only | **Both, per operand `ILType`** | Word slots already flow through live `load`/`store` | D5 |
| Module layout | Extend `instr/` / new dir / under `il/` | **Extend `instr/`; consume `il/` read-only** | Consumers of the RD-07a model; IL must not depend on Instr | D6 |
| Diagnostics | Reuse E90001 + W-codes / new codes | **Reuse `IceCode.Unexpected` + W10170/71/72** | One-registry rule; consistent with RD-06/RD-07a D6 | D7 |

> **Traceability:** Every scope decision references the Ambiguity Register entry that
> resolved it. See `00-ambiguity-register.md`.

## Acceptance Criteria

Maps to the RD-07 acceptance criteria that fall within the 07b slice scope:

1. [ ] **AC-01 (RD-07 AC-01)** — `generateInstr()` accepts an `ILProgram` + `cpuVariant` and
   returns an `InstrProgram`. *(FR-18)*
2. [ ] **AC-02 (RD-07 AC-02, slice)** — Every IL instruction kind **the live lowering emits**
   has a defined `Instr` translation; every other kind hits a documented `E90001` ICE arm.
   *(FR-1..FR-12, D3)*
3. [ ] **AC-03 (RD-07 AC-06)** — Every generated `Instr` passes RD-07a CPU validation for the
   active `cpuVariant`. *(FR-22)*
4. [ ] **AC-04 (RD-07 AC-10)** — `mul` generates fold / shift / software-call per Ch 04 §3.2,
   with W10170/W10172; `div`/`mod` generate the software-call with W10171. *(FR-7/FR-8/FR-23)*
5. [ ] **AC-05 (RD-07 AC-12)** — Source spans propagate from IL to the lead `Instr.sourceSpan`.
   *(FR-24)*
6. [ ] **AC-06 (RD-07 AC-13)** — `generateInstr` is deterministic: same IL → same
   `InstrProgram` → same `printInstr` text. *(FR-1/FR-25)*
7. [ ] **AC-07 (RD-07 AC-15)** — Functions with no IL produce no `InstrStream`. *(FR-21)*
8. [ ] **AC-08** — Register binding maps temps to A/X/Y + ZP scratch from the plan; redundant
   loads suppressed; state reset at block boundaries. *(FR-13..FR-17)*
9. [ ] **AC-09** — Both 8- and 16-bit sequences are generated per the operand `ILType` for the
   in-scope arithmetic/load/store ops. *(FR-3/FR-9/FR-10)*
10. [ ] **AC-10 (RD-07 AC-17/AC-18)** — Unit tests cover translation for every live IL op
    (tier 1) + golden ACME-text snapshots from real compiled IL (tier 2). *(FR-25)*
11. [ ] **AC-11** — All decisions trace to an `AR-NN`/`D-N` or a frozen spec section.
12. [ ] **AC-12** — All verification passing (canonical verify); R15 boundary tier green;
    `spec/` clean; no dead code (deferred arms documented as "RD-07c", not removed).
