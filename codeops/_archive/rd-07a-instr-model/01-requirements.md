# Requirements: RD-07a Instr Model, CPU Table & Canonical Serializer

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-07](../../requirements/RD-07-codegen-instr.md) (R1–R16, R52–R54) · spec Ch 04/05/06/11

## Feature Overview

RD-07a delivers the **stable, target-specific 6502 instruction substrate** that the rest
of the back end is built on: a typed `Instr`/`Label`/`Directive` stream model, a complete
NMOS-6502 CPU validation table + validator, and a canonical ACME-syntax serializer. These
three pieces are pure data + a pure deterministic function — they depend on neither the
absent RD-10 platform system nor the not-yet-widened RD-06 lowering, so they are built
**completely** and never reworked (AR per D1/D2).

This document scopes RD-07a precisely against the parent RD-07 requirements: which `R`/`AC`
items land here (the model, validation, and serializer), and which are explicitly deferred
to **RD-07b** (translation, register binding, hooks, `generateInstr`).

## Functional Requirements

### Must Have (RD-07a — in scope)

#### Instr Model (RD-07 §3.1–§3.2)

- [x] **FR-1 (R1)** — One `StreamEntry` of `type: "instr"` represents exactly one real
  6502 machine instruction. No macro-instructions, no pseudo-ops. (Multi-byte operations
  produce multiple `Instr` entries — but *producing* them is 07b's translation job; 07a
  only models the single-instruction shape.)
- [x] **FR-2 (R2)** — `Instr` is a typed discriminated record:
  `{ type: "instr"; opcode: Opcode; mode: AddressingMode; operand: InstrOperand; sourceSpan?: SourceSpan }`.
  No stringly-typed fields.
- [x] **FR-3 (R3)** — `Opcode` is a typed enum/tuple of all legal mnemonics: the 56 NMOS
  6502 mnemonics, plus the 65C02 extensions present but gated by CPU variant.
- [x] **FR-4 (R4)** — `AddressingMode` is a typed enum/tuple of **14** modes: `Implied`,
  `Accumulator`, `Immediate`, `ZeroPage`, `ZeroPageX`, `ZeroPageY`, `Absolute`,
  `AbsoluteX`, `AbsoluteY`, `Indirect`, `IndirectX`, `IndirectY`, `Relative`, and
  `ZeroPageIndirect` (the 65C02 `(zp)` mode — distinct from the 16-bit `Indirect`; gated to
  65C02 in the CPU table, D8).
- [x] **FR-5 (R5)** — Labels are first-class inline stream entries
  (`{ type: "label"; name }`); the stream is `Array<StreamEntry>`.
- [x] **FR-6 (R6)** — Directives are first-class inline stream entries
  (`{ type: "directive"; directive: AcmeDirective }`) covering `!byte`, `!word`, `!text`,
  `!fill`, `!to`, `* =` (origin), and symbol definition (`sym = $XXXX`).
- [x] **FR-7 (R7)** — The stream is organized per-function via
  `InstrStream = { symbol: string; segment: "code" | "data" | "zp"; entries: StreamEntry[] }`.
- [x] **FR-8 (R8)** — Operands are a symbolic union
  `InstrOperand = None | Immediate | SymbolRef | LabelRef | ZeroPageSlot`. No hard
  `$xxxx` addresses in the model.
- [x] **FR-9 (R9)** — `Immediate` holds a numeric literal `{ kind: "immediate"; value }`.
- [x] **FR-10 (R10)** — `SymbolRef` references a named symbol:
  `{ kind: "symbolRef"; name; offset?; byteSelect: "low" | "high" | "none" }`.
- [x] **FR-11 (R11)** — `LabelRef` references a code label `{ kind: "labelRef"; label }`.
- [x] **FR-12 (R12)** — `ZeroPageSlot` references a ZP allocation `{ kind: "zpSlot"; name }`.
- [x] **FR-13 (R13)** — `byteSelect` selects the hi/lo byte of a 16-bit symbol
  (`low` → ACME `<sym`; `high` → ACME `>sym`).

#### CPU Validation (RD-07 §3.3)

- [x] **FR-14 (R14)** — Every `Instr` is validated against the active CPU's opcode+mode
  table. `validateStream(stream, cpuVariant, bag)` checks each instr entry.
- [x] **FR-15 (R15/R61)** — An invalid opcode+mode is an internal compiler error: the
  validator calls `bag.addICE(IceCode.Unexpected, …)` (the `E9xxxx` band, D6).
- [x] **FR-16 (R16)** — The NMOS-6502 table never permits 65C02-only modes; with
  `cpuVariant === "nmos6502"`, `STZ`/`BRA`/`(zp)`-without-index/etc. are illegal and flagged.

#### Canonical Serializer (RD-07 §3.8)

- [x] **FR-17 (R52)** — `printInstr(stream)` produces the canonical pre-ACME text — the
  single serializer `--emit-asm` and the RD-09 ACME emitter both consume (no second
  serializer).
- [x] **FR-18 (R53)** — The text form is deterministic: same `InstrStream` → same string
  (required for golden snapshots).
- [x] **FR-19 (R54)** — The text form uses ACME syntax: uppercase mnemonics, `$` hex,
  labels with colons, `<sym`/`>sym` byte-select, and ACME directives.

#### Support for the resource report (RD-07 §3.9)

- [x] **FR-20 (R58 support)** — `instrByteSize(entry)` returns the assembled byte size of a
  stream entry (1–3 bytes per instr by mode; directive sizes from their payload), so RD-07b
  / RD-11 can sum a ROM byte estimate. (The *summing into a `ResourceReport`* is 07b/RD-11;
  07a provides the per-entry size primitive.)

### Should Have

- [x] **FR-21** — Hand-built `Instr` test fixtures (`instr/test-fixtures.ts`) representing
  representative 6502 sequences (e.g. an 8-bit add `LDA/CLC/ADC/STA`, a labelled branch, a
  data block with directives) so the model, validator, and serializer are tested on
  realistic streams. Fixtures are **not** barrel-exported (test-only).

### Won't Have (Out of Scope — deferred to RD-07b)

- IL→`Instr` translation for any IL op (R17–R39) — RD-07b.
- Register binding / temp allocation (R40–R45) — RD-07b.
- Platform codegen hooks: startup stub, binary format, origin, encoding (R46–R49) — RD-07b
  + RD-10.
- `InstrProgram` container, `generateInstr`, preamble assembly (R55–R57) — RD-07b.
- Source-span *propagation* from IL (R50–R51) — RD-07b. (07a models the field only.)
- Cost warnings W10170/W10171/W10172 (R60) — emitted during translation — RD-07b.
- A real `PlatformProfile` type (RD-10).

## Technical Requirements

### Performance

- The serializer and validator are linear in the number of stream entries; no performance
  concern at compiler scale. Determinism (FR-18) is the binding constraint.

### Compatibility

- TypeScript ESM, NodeNext, ES2023, `strict`; relative imports use `.js` (project.md).
- Consumes `@blend65/core` (`SourceSpan`, `DiagnosticBag`, `IceCode`) via its public
  barrel; consumes nothing from `@blend65/il` translation (07a is independent of lowering).
- Respects R15/AR-20: `instr/` lives in `@blend65/codegen`; frontend/language-server never
  import it.

### Security

- N/A — compiler-internal data model + pure functions; no external/user input at this layer
  (per code.md §10 applicability note for pure-compute layers; documented, not skipped).

## Scope Decisions

| Decision   | Options Considered | Chosen | Rationale | AR Ref |
| ---------- | ------------------ | ------ | --------- | ------ |
| Build scope | Split 07a+07b / monolith / RD-10-first | **Split; 07a = model+table+serializer built fully** | No-rework: 07a depends on nothing unfinished | AR D1 |
| Profile input | `cpuVariant` primitive / stub profile / real RD-10 profile | **`cpuVariant` primitive** | A primitive never needs migration; RD-10 fills the caller additively | AR D2 |
| CPU table breadth | Full NMOS table / slice subset | **Full NMOS table; 65C02 gated** | Stable reference data, cheap to transcribe once, no churn | AR D3 |
| Serializer ownership | 07a / defer to RD-09 | **07a; RD-09 reuses** | Needed now for golden tests; one serializer, no drift (AR-60) | AR D4 |
| Module layout | `instr/` sibling / flat / nested under `il/` | **`instr/` sibling to `il/`** | Distinct 6502 domain; IL must not depend on Instr | AR D5 |
| Validation diagnostic | Reuse E90001 / new ICE code | **Reuse `IceCode.Unexpected`** | One-registry rule; consistent with RD-06 D6 | AR D6 |

> **Traceability:** Every scope decision references the Ambiguity Register entry that
> resolved it. See `00-ambiguity-register.md`.

## Acceptance Criteria

Maps to the RD-07 acceptance criteria that fall within the 07a scope:

1. [x] **AC-01 (RD-07 AC-03)** — Each `Instr` record uses typed `Opcode` and
   `AddressingMode` values (no strings). *(FR-2/3/4)*
2. [x] **AC-02 (RD-07 AC-04)** — All operands are symbolic — no hard-coded `$xxxx`
   addresses in the model. *(FR-8)*
3. [x] **AC-03 (RD-07 AC-05)** — Labels and directives are first-class `StreamEntry`
   values in the stream. *(FR-5/6)*
4. [x] **AC-04 (RD-07 AC-06)** — Every `Instr` in a fixture passes CPU validation against
   the active variant; an illegal opcode+mode raises an `E90001` ICE. *(FR-14/15/16)*
5. [x] **AC-05 (RD-07 AC-11)** — `byteSelect` renders as ACME `<sym`/`>sym`. *(FR-13/19)*
6. [x] **AC-06 (RD-07 AC-13)** — `printInstr` is deterministic: same stream → same text.
   *(FR-18)*
7. [x] **AC-07** — `printInstr` emits valid ACME syntax for instrs, labels, and every
   directive kind, verified by golden snapshots. *(FR-17/19, RD-07 AC-18)*
8. [x] **AC-08** — `instrByteSize` returns correct byte sizes per addressing mode and
   directive payload. *(FR-20)*
9. [x] **AC-09** — `validateStream` accepts a legal NMOS stream with no diagnostics, and
   accepts a 65C02-only instr only under `cpuVariant === "wdc65c02"`. *(FR-14/16)*
10. [x] **AC-10** — Unit tests cover the model, table, validator, and serializer at the
    lexer/semantic/codegen analog tiers (AR-22 tier 1) + golden snapshots (tier 2).
11. [x] **AC-11** — All decisions trace to an `AR-NN`/`D-N` or a frozen spec section.
12. [x] **AC-12** — All verification passing (canonical verify); R15 boundary tier green;
    `spec/` clean; no dead code.
