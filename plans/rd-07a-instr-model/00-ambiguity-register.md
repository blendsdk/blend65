# RD-07a Instr Model, CPU Table & Serializer — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED — D1–D9 resolved at planning / D10 added during execution
> **Last Updated**: 2026-06-06

> **Purpose**: Plan-level Zero-Ambiguity Gate. Every RD-07a plan decision that is *not*
> already fixed by the frozen `spec/` (Ch 04, 05, 06, 11) or by the (authored, non-frozen)
> `requirements/RD-07-codegen-instr.md` is recorded here, with its resolution, before any
> document or code depends on it.

## Scope of this register

RD-07 (`requirements/RD-07-codegen-instr.md`) specifies the **whole** 6502 code generator:
the `Instr`/`Label`/`Directive` stream model (R1–R13), CPU validation (R14–R16),
IL→`Instr` translation (R17–R39), register binding (R40–R45), platform codegen hooks
(R46–R49), source-span propagation (R50–R51), the canonical serializer (R52–R54),
`InstrProgram` assembly (R55–R58), and diagnostics (R59–R61). Its public entry point is
`generateInstr(ilProgram, profile, bag): InstrProgram` (§4.7), and it declares
`Depends On: RD-06, RD-10`.

Two of those inputs are **not yet built**:

1. **RD-10 (platform plugin system) does not exist.** `@blend65/platforms` is still the
   empty `VERSION = "0.1.0"` stub — there is **no `PlatformProfile` type**, no CPU-variant
   declaration, and no platform plugins (startup stub, binary format, char encoding). The
   profile-coupled requirements (R14 CPU variant; R46–R49 hooks) therefore have no concrete
   input to consume.
2. **RD-06's lowering is a walking-skeleton slice** (RD-06 plan D1/D5): `lowerToIL` only
   emits IL for the gate/slice-2 surface; the wider IL op space is model-complete but not
   yet produced by any live lowering. So the *consumer-coupled* half of RD-07 (translation
   + register binding) has nothing to translate end-to-end yet.

This is the same "feature sits between two empty stages" situation the **AR-38
walking-skeleton methodology** governs, which the project already resolved twice by
splitting a large RD into a stable-core slice + a consumer-coupled follow-on
(RD-04→RD-04b, RD-11→RD-11a). RD-07 splits the same way along its natural coupling fault
line:

- **RD-07a (this plan)** — the **self-contained, zero-dependency, zero-throwaway** third:
  the `Instr`/`Label`/`Directive` model (R1–R13), the **full NMOS-6502 CPU validation
  table** + validator (R14–R16), and the **canonical ACME-syntax serializer** (R52–R54).
  None of this needs RD-10 *or* the lowering slice — it is pure typed reference data + a
  pure deterministic serializer, golden-snapshot-testable on hand-built `Instr` fixtures.
  Built **completely** and never reworked.
- **RD-07b (immediate follow-on, separate plan)** — the **consumer-coupled** third:
  IL→`Instr` translation (R17–R39), register binding (R40–R45), platform-hook seam
  (R46–R49), `InstrProgram` assembly (R55–R58), and `generateInstr`. Grows per slice
  alongside the lowering + codegen it serves.

Items D1–D7 below were presented to the user and resolved on 2026-06-06 before any plan
document was authored; D8–D9 were surfaced during the 2026-06-06 plan preflight and
resolved the same day before execution. The user's explicit strategic direction was *"I
don't want to come back and refactor — give me the best, no-rework path."* The gate is
**PASSED**.

---

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| D1 | Scope / Strategy | RD-07 declares `Depends On: RD-06, RD-10`; RD-10 does not exist (no `PlatformProfile`) and RD-06 lowering is a slice. How much of RD-07 to build now, and how to avoid building on the absent RD-10? | A: **Split RD-07 into 07a + 07b along the coupling fault line** — build 07a (Instr model + full NMOS-6502 CPU table + canonical serializer) **completely now** with zero RD-10/lowering dependency; scope 07b (IL→Instr translation + register binding + `generateInstr`) as the immediate consumer-coupled follow-on · B: one monolithic RD-07 walking-skeleton plan (model built fully, translation thin, fabricated minimal profile) · C: build RD-10 first, then RD-07 against a real profile | **A** — split into 07a (this plan) + 07b | ✅ Resolved |
| D2 | Dependency / API | RD-07 §4.7 entry point takes a `PlatformProfile` (RD-10). 07a's only profile need is the CPU variant (for the validation table). How does 07a obtain the variant without fabricating a profile type that RD-10 will later replace? | A: **`cpuVariant: CpuVariant` primitive input** — 07a's validator takes a `CpuVariant` string-union (`"nmos6502" \| "wdc65c02"`), a primitive that never changes; the full `PlatformProfile` + `generateInstr` profile-threading is an RD-07b/RD-10 concern. No placeholder profile type is created · B: define a minimal `PlatformProfile` stub in `@blend65/codegen` marked "superseded by RD-10" · C: stub a real `PlatformProfile` in `@blend65/platforms` now | **A** — `cpuVariant` primitive; no fabricated profile | ✅ Resolved |
| D3 | Scope / Data | The CPU validation table (R14–R16) maps each opcode to its legal addressing modes. Build the whole table now, or only the opcodes the slice emits? | A: **author the full NMOS-6502 opcode+mode table now** (56 mnemonics) — it is stable, well-known reference data with no churn risk; 65C02 extensions (R3) are included but **gated** behind `cpuVariant === "wdc65c02"` so NMOS targets can never emit them (R16) · B: only the subset of opcodes the gate/slice-2 lowering currently needs | **A** — full NMOS-6502 table + gated 65C02 set | ✅ Resolved |
| D4 | Scope / Serializer | RD-07 R52–R54 require one canonical Instr→text form (ACME syntax) shared by `--emit-asm` and the actual ACME build input (RD-09). Build the serializer in 07a, or defer all text serialization to RD-09? | A: **build the deterministic canonical serializer in 07a** — it is a pure `StreamEntry → string` function over the model, needed *now* for golden-snapshot testing of the model (AR-22 tier 2); RD-09 **reuses** this exact serializer and adds only ACME invocation + numeric resolution, never a second serializer (no drift, AR-60/AR-63) · B: defer all serialization to RD-09; test the model structurally only | **A** — serializer built in 07a; RD-09 reuses it | ✅ Resolved |
| D5 | Naming | Module layout inside `@blend65/codegen` for the Instr model, CPU table, and serializer. | A: **`instr/` directory** — `instr/opcode.ts`, `instr/addressing-mode.ts`, `instr/operand.ts`, `instr/stream.ts` (model), `instr/cpu-table.ts` + `instr/validate.ts` (validation), `instr/print-instr.ts` (serializer), `instr/index.ts` barrel — sibling to the existing `il/` directory (mirrors RD-06's domain-named `il/`) · B: flat `instr.ts` / `cpu-table.ts` / `print-instr.ts` at `src/` root · C: nest under `il/` | **A** — `instr/` directory, sibling to `il/` | ✅ Resolved |
| D6 | Process / Diagnostics | CPU validation failure is an internal compiler error (R15/R61) in the `E9xxxx` ICE band. Reuse the existing generic ICE code, or add a specific one? | A: **reuse `IceCode.Unexpected` (`E90001`)** via `bag.addICE` — consistent with RD-06 D6 and the one-registry rule; the validator's message text names the illegal `opcode + mode`. A more specific `E9xxxx` for illegal-opcode can be added by addition later if wanted (new runtime AR) · B: add a new `IceCode.IllegalOpcodeMode` now | **A** — reuse `IceCode.Unexpected`; no new code | ✅ Resolved |
| D7 | Process | Commit mode for execution. | ask / no-commit / auto-commit | **no-commit** (consistent with RD-01/02/03/04/05/06/11a) | ✅ Resolved |
| D8 | Scope / Data | RD-07 R16 / D3 promise to *gate* the 65C02 `(zp)` zero-page-indirect-without-index mode (`LDA ($nn)`), but the §4.3 `AddressingMode` enum (and the plan's 13-mode tuple) has no distinct mode for it — `Indirect` is the 16-bit absolute `JMP ($FFFC)` form (3 bytes), whereas `(zp)` is 2 bytes, so it cannot fold into `Indirect`. Add the mode now, or defer it? | A: **add a 14th `ZeroPageIndirect` mode now** to `ADDRESSING_MODES`, the gated `W65C02_TABLE` (8 opcodes `ADC/AND/CMP/EOR/LDA/ORA/SBC/STA`), the serializer (`(operand)`, 2-byte size), and the ST-cases — making R16's `(zp)` clause a *tested* property and covering the real Commander X16 target on first write · B: scope 65C02 `(zp)` out of 07a, edit D3/§4.8 line to drop it, defer to RD-07b | **A** — add `ZeroPageIndirect` now (lowest total rework; no foundational re-touch later; CX16 covered) | ✅ Resolved |
| D9 | Naming | RD-07 is self-contradictory on `StreamEntry`'s instr field names: **R2** says `mnemonic`/`addressingMode`; **§4.3** (the actual `type StreamEntry` definition) says `opcode`/`mode`. Which wins? | A: **`opcode`/`mode`** (follow §4.3 — the authoritative type definition; pairs with `Opcode`/`AddressingMode`; already used throughout the plan + `CpuTable` keying) · B: `mnemonic`/`addressingMode` (follow R2 prose) | **A** — `opcode`/`mode` (per §4.3) | ✅ Resolved |

---

## Resolution Notes

### D1 — Split RD-07 into 07a + 07b (the no-rework path)

The user's explicit requirement is **no rework**. The single largest rework risk in RD-07
is its `PlatformProfile` dependency on RD-10, which does not exist. Any plan that
fabricates a profile type now *guarantees* a future refactor when RD-10 lands and replaces
it (Option B). Building RD-10 first (Option C) is the inverse trap: designing a plugin
*extension-point system* with **no codegen consumer** to validate the hook shapes is
exactly the v2 "100%-before-a-consumer" mistake the AR-38 methodology exists to prevent.

The clean observation is that RD-07's 61 requirements split along a sharp coupling line:

- **Self-contained, zero-churn, zero-dependency:** the `Instr`/`Label`/`Directive` model
  (R1–R13), the NMOS-6502 CPU validation table + validator (R14–R16), and the canonical
  ACME serializer (R52–R54). This is pure reference data + a pure deterministic function.
  It depends on neither RD-10 nor the lowering slice and can be built 100% complete,
  golden-tested on hand-built `Instr` fixtures, and **never touched again**.
- **Consumer-coupled, churn-prone:** IL→`Instr` translation (R17–R39, blocked on the IL
  ops the lowering actually emits), register binding (R40–R45), platform hooks (R46–R49,
  blocked on RD-10), and `InstrProgram`/`generateInstr` assembly (R55–R58).

**Resolution:** split. RD-07a (this plan) builds the stable core fully and commits it as a
finished foundation. RD-07b consumes 07a's model and grows the translation per slice
alongside its lowering + codegen, taking a `cpuVariant` today and threading the real
`PlatformProfile` when RD-10 lands by *filling the empty hook seam* (not replacing a
placeholder). This is the same stable-core/consumer-remainder split the project already
used for RD-04→RD-04b and RD-11→RD-11a.

### D2 — `cpuVariant` primitive input, not a fabricated profile

Core codegen's *only* actual need from the platform profile in 07a is the **CPU variant**,
to pick the validation table (NMOS 6502 vs 65C02). Everything else profile-coupled in
RD-07 (startup stub, binary format, char encoding — R46–R49) is **platform-plugin output**,
not validation logic, and belongs to RD-07b/RD-10. So 07a models exactly one primitive:

```typescript
export type CpuVariant = "nmos6502" | "wdc65c02";
```

A string-union primitive never needs migration. When RD-10 introduces the real
`PlatformProfile`, it will expose `profile.cpuVariant: CpuVariant` and RD-07b will read it
— 07a's validator signature (`validateStream(stream, cpuVariant, bag)`) is unchanged.
**No throwaway type is created.** Filling RD-10's profile into the *caller* is additive;
rewriting a placeholder would have been rework. This is the decision that satisfies the
user's no-refactor requirement at its root.

### D3 — Full NMOS-6502 table now, 65C02 gated

The opcode→legal-modes table is **stable, finite, well-documented reference data** (the
NMOS 6502 has 56 mnemonics; the legal addressing-mode set for each is fixed by the CPU and
will never change). Authoring it partially (Option B) would mean returning to extend it
every time a new IL op is translated in 07b — needless churn on data that is cheap to
transcribe fully once. The 65C02 extensions (`BRA`, `STZ`, `PHX/PHY/PLX/PLY`, `TRB/TSB`,
and the extra `(zp)` modes — R3) are included in the table but **gated**: the validator
selects the NMOS table for `"nmos6502"` and the superset for `"wdc65c02"`, so an NMOS
target that somehow emitted `STZ` is flagged as an ICE (R16). This makes R16 a tested
property of 07a rather than a promise deferred to 07b.

### D4 — Canonical serializer built in 07a; RD-09 reuses it

R52–R54 demand exactly one canonical Instr→text form, byte-identical between `--emit-asm`
and the real ACME build input (AR-60/AR-63 — "same serializer, no drift"). 07a needs that
serializer **now** regardless: the model's correctness is best pinned by **golden ACME-text
snapshots** of hand-built `Instr` fixtures (AR-22 tier 2), which requires the serializer to
exist. Deferring it to RD-09 (Option B) would leave 07a's model testable only structurally
and would risk RD-09 inventing a *second* serializer later — the exact drift AR-60 forbids.

**Resolution:** 07a ships `printInstr(stream): string` (and `printInstrProgram` once 07b
adds the program container — 07a serializes at the `StreamEntry[]`/`InstrStream` level). It
emits ACME syntax (R54): uppercase mnemonics, `$` hex, `<sym`/`>sym` byte-select, labels
with colons, and the `!byte`/`!word`/`!text`/`!fill`/`!to`/`* =`/`sym = $XXXX` directives.
RD-09 imports and reuses this function and adds only the ACME process invocation and the
final numeric address resolution — it never re-serializes.

### D5 — `instr/` directory, sibling to `il/`

The existing back-end domain lives in `@blend65/codegen/src/il/`. The Instr layer is a
distinct domain (target-specific 6502, vs target-independent IL), so it gets its own
sibling `instr/` directory rather than nesting under `il/` (the IL must not depend on
Instr). This mirrors RD-06's domain-named `il/` and keeps each file under the 500-line
split threshold (code.md rule 21): `opcode.ts`, `addressing-mode.ts`, `operand.ts`,
`stream.ts`, `cpu-table.ts`, `validate.ts`, `print-instr.ts`, `index.ts`. The IL stays
strictly back-end and the language-server still never imports `@blend65/codegen`
(R15/AR-20) — `instr/` inherits that boundary unchanged.

### D6 — Reuse `IceCode.Unexpected` for validation failures

A `validateStream` failure means codegen produced an illegal opcode+mode for the target
CPU — a **compiler bug**, never a user error (R15). It belongs in the `E9xxxx` ICE band
(R61). The existing `IceCode.Unexpected` (`E90001`) + `DiagnosticBag.addICE` already cover
this, identical to RD-06 D6; the message text carries the specifics
(`"illegal opcode+mode for nmos6502: STZ Absolute"`). Adding a dedicated
`IceCode.IllegalOpcodeMode` is a future by-addition option (new runtime AR) if the band
ever needs finer granularity — not now.

### D7 — Commit mode: `--no-commit`

The agent implements, verifies, and updates the execution plan, but performs **no** git
operations. The user handles all commits. Identical to RD-01/02/03/04/05/06/11a.

### D8 — Add `ZeroPageIndirect` (65C02 `(zp)`) now, not deferred

Surfaced during plan preflight: D3 promises to *gate* the 65C02 `(zp)` mode, but the plan's
13-mode tuple (and RD-07 §4.3's own enum) has no mode that can represent `LDA ($nn)`. It is
**not** foldable into `Indirect`: `Indirect` is the 16-bit absolute `JMP ($FFFC)` form (3
bytes); `(zp)` takes an 8-bit zero-page operand (2 bytes), so byte-sizing and rendering both
require a distinct mode. Deferring it (Option B) would leave 07a unable to represent a real
instruction for a real first-class target (**Commander X16**, a 65C02), would make D3/R16's
`(zp)` clause an untested promise, and — worst against the user's no-rework requirement —
would force a later edit to the *foundational* `addressing-mode.ts`/`cpu-table.ts`/
`print-instr.ts` files after they are written.

**Resolution (Option A):** add a 14th `ZeroPageIndirect` mode now. It is purely additive at
planning time (no existing source exists yet to refactor) and bounded: `ADDRESSING_MODES`
14 entries; `W65C02_TABLE` gives the 8 `(zp)`-capable opcodes (`ADC`/`AND`/`CMP`/`EOR`/
`LDA`/`ORA`/`SBC`/`STA`) the mode (the NMOS table does **not**, so R16 rejects it on NMOS —
a tested property); the serializer renders `(operand)` and `instrByteSize` returns 2 (vs
`Indirect`'s 3). This keeps the "built completely, never reworked" promise literally true.

### D9 — `StreamEntry` instr fields are `opcode`/`mode` (per §4.3)

Surfaced during plan preflight: RD-07 contradicts itself — R2 prose says
`mnemonic`/`addressingMode`, while §4.3's actual `type StreamEntry` definition says
`opcode`/`mode`. **Resolution:** follow §4.3 (`opcode`/`mode`) — it is the authoritative
type definition, pairs naturally with the `Opcode`/`AddressingMode` type names, keys the
`CpuTable`, and is already used consistently throughout every plan document and ST-case. No
document churn results; this note simply records the resolution of the R2-vs-§4.3 conflict
so the choice is traceable.

### D10 (runtime) — Rename the Instr operand guard to `isImmediateOperand`

Surfaced during execution at the final full-verify (Phase 4): both `il/operand.ts` and
`instr/operand.ts` export a guard named `isImmediate` (the former narrows `ILOperand`, the
latter `InstrOperand`). The codegen top-level barrel (`packages/codegen/src/index.ts`)
re-exports **both** modules with `export *`, so TypeScript rejects the ambiguous re-export
(TS2308). The two operand families are used **together** in RD-07b's IL→Instr translator,
so a flat top-level `isImmediate` is ambiguous to readers as well as the compiler.

**Resolution (Option A):** rename the Instr guard `isImmediate → isImmediateOperand` in
`instr/operand.ts`, the `instr/` barrel (`instr/index.ts`), and the two tests that use it
(`instr-model.spec.test.ts`, `instr-model.impl.test.ts`). This is the smallest change; it
preserves the **flat** public API the plan's `00-index.md` documents (no namespacing, no
asymmetric exclusion), reads clearly next to IL's `isImmediate`, and the frozen spec only
mandates the operand *variant* name (`immediate`, §4.2), not the exported guard identifier.
The sibling Instr guards (`isSymbolRef`/`isLabelRef`/`isZpSlot`) do not collide and are
unchanged. The plan's documented API (`00-index.md` line listing `isImmediate` among the
operand guards) is back-propagated to `isImmediateOperand`.

---

## Surface-during-authoring rule

If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the
next `D-N` (tagged `(runtime)` if found during execution), resolve it with the user,
back-propagate the resolution into the affected plan documents, then resume. Do not fill
gaps by guessing.
