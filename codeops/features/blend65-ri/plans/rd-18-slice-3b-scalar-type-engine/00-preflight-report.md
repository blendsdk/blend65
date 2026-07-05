# Preflight Report — RD-18 Slice 3b (Scalar Type Engine)

> **Artifact**: `plans/rd-18-slice-3b-scalar-type-engine/` (10 documents)
> **Scan date**: 2026-07-05 · **Git ref at scan**: `c0fa61a` (branch `v3`)
> **Reviewer**: preflight (CodeOps 3.2.0), codebase-grounded, 4 parallel recon agents + 1 adversarial challenger
> **Same-session review?** No — plan authored in a prior session; independent fresh-eyes review.
> **Outcome (iter 1)**: ❌ BLOCKED — 2 CRITICAL + 3 MAJOR (diagnostic-code integrity).
> **Outcome (iter 2, after fixes applied 2026-07-05)**: ✅ **PASSED** — all 10 findings resolved
> (user chose "register + realign"; AR-11 added; plan docs corrected; re-scan clean).

## Codebase Context Summary

The plan's structural recon is **excellent and almost entirely accurate** — every `file:line`
citation about the type-engine stubs, SFA infrastructure, and codegen lowering was verified true:

- **Frontend semantics** — `isAssignableTo→true` / `commonType→null` stubs (`type-utils.ts:165,182`),
  `resolveTypes`/`postCheck` no-ops (`passes.ts:42,83`), no expression typing anywhere,
  `function-collection.ts` (Slice 3a) collects no top-level `let` — all VERIFIED.
- **SFA / model-adapter** — `ModuleVariableAllocation`/`ModuleVarInput`/`layoutModuleVariables`/`__var_*`
  emission all exist + unit-tested; the only feed gap is `run-frontend.ts:159 moduleVars: []` — VERIFIED.
  **Both load-bearing symbol formats match exactly**: SFA `__var_${mod}_${name}` (`symbols.ts:77`) and
  codegen `__frame_${fqName}_${var}` (`lower.ts:539`).
- **Codegen** — `lowerNumericLit` `IL_BYTE` hardcode (`lower.ts:264`), width auto-engages `__rt_mul16`
  once tagged `IL_WORD`, `word` locals already round-trip via `slotIlType` — all VERIFIED.

**The failure is not structural — it is the diagnostic-code layer.** The plan's Zero-Ambiguity Gate
asserts (register §"No new diagnostic codes") that *all* codes 3b emits already exist in
`diagnostic-codes.ts` and that 3b mints **no** new codes. That premise is **false**, and several codes
are transcribed from a **stale section of the frozen spec** whose numbers collide with the authoritative
registry. The core VICE fixture (AC-1/2/3/4/6) is unaffected — it uses only codes that exist and agree
(E10081, E10100, E10020, E10021, E10150). The drift lives in the broader negative-diagnostic surface
(FR-1/2/6, ST-2/5/8, FR-5).

---

## Findings

### 🔴 PF-001 — CRITICAL — Codes the plan emits do not exist in the registry (E10084, E10086, E10022)

The register (§"No new codes") lists **E10084** as already-defined, and `02-current-state.md:94`
repeats "E10084 (range)" among present codes. **E10084 is absent** from
`packages/core/src/diagnostics/diagnostic-codes.ts` (band jumps E10083 `ShiftAmountOutOfRange` → E10080)
and from `spec/14-diagnostics.md`; it appears **only** in `spec/02-type-system.md` and plan docs.
Same for **E10086** (boolean↔integer, FR-2) and **E10022** (main-signature, FR-5/AR-7 — it *is*
designated in `spec/00-feature-index.md:82` + `F004-entry-point.md:30`, but **not registered**).

- **Blast radius**: FR-1/FR-6 literal-range check (ST-2 `let b: byte = 256`), FR-2 boolean cast,
  FR-5 `main` signature validity.
- **Consequence**: these checks cannot reference a `DiagCode.*` constant. `diagnostic-codes.ts:1-8`
  declares itself the single source of truth; emitting a bare `"E10084"` string violates that and the
  plan's own "no new codes" gate. RD-18 §223/AR-115 routes *new* codes through a Language-Guard-approved
  registry addition (nominally at Slice 4).
- **Options**: **(A, recommended)** register E10084/E10086/E10022 as an explicit *code-reconciliation*
  task in 3b (they are spec-defined, so this is transcription, not language design — but still must pass
  the Language Guard per AR-115 and be recorded in the register); **(B)** scope the affected checks
  (literal-range, boolean-cast, main-signature) *out* of 3b into the slice that mints its codes, shrinking
  FR-1/FR-5/FR-6 and dropping ST-2. Correct `02-current-state.md:94` and the register's code list either way.

### 🔴 PF-002 — CRITICAL — Assignment-compat codes transcribed from a stale spec section collide with the registry

`03-01` (statement-typing), `01-requirements.md:38` (FR-2), and `07-testing-strategy.md:29` (ST-8) emit
**E10082 for word→byte narrowing** and **E10080 for byte↔sbyte cross-sign assignment**, citing
`spec/02-type-system.md §5.3` (:251-252). Those spec numbers are **stale**: the registry defines
`E10082 = ConstDivisionByZero` and `E10080 = InvalidOperandType`. The **registry and RD-04 agree** the
real codes are `E10154 = WidthNarrowingNoCast` (RD-04 AC-04) and `E10153 = SignedUnsignedMismatch`.
There is **no** code→message catalog (messages are free-form per call site, `diagnostic-bag.ts:41`), so
emitting E10082 for narrowing genuinely carries the `ConstDivisionByZero` identity.

- **Self-collision inside this plan**: ST-8 uses E10082 for narrowing (`:29`) while the security test
  uses E10082 for const `x/0` (`:71`) — one code, two meanings.
- **Recommended**: switch the assignment-compat codes to **E10154 (narrowing)** / **E10153 (cross-sign
  assignment)** — the registry+RD-04-aligned set — and record that frozen-spec §5.3's E10082/E10080/E10086
  numbers are stale (a documented spec-vs-registry deviation, à la RD-18 AR-115; `spec/` stays frozen per D3).

### 🟠 PF-003 — MAJOR — E10151 means `UnknownType` in the registry, not boolean-in-arithmetic

FR-2 / the `03-01` decision table / ST-5 emit **E10151** for a boolean operand in arithmetic
(`byte + boolean`). But `diagnostic-codes.ts:68` and `spec/14-diagnostics.md:89` both define
**E10151 = `UnknownType`**. (The frozen spec Ch 02 is itself inconsistent — it *reuses* E10151 for
boolean-in-arith at `02:176`.) Emitting E10151 for `byte + boolean` yields the wrong machine code /
"Unknown type" message. **Recommended**: pick the registry-correct code for "boolean not numeric in
arithmetic" (the registry's operand-type error is `E10080 InvalidOperandType`; confirm against Ch 14
during reconciliation) and record the spec Ch02↔Ch14 conflict. Same reconciliation task as PF-002.

### 🟠 PF-004 — MAJOR — Parent RD-04 ACs conflict with the plan's codes; Phase-5 "tick" is not mechanically consistent

Phase 5 task 5.1.1 ticks RD-04 **AC-02/03/05/06/08**. But **AC-05** (`RD-04:833`) says `byte + sbyte`
emits **E10153**, while the plan (correctly, per spec TS-5 `02:152` + registry `E10081`) emits **E10081**
for arithmetic mixing. **AC-04** (`:832`, word→byte → E10154) conflicts with the plan's §5.3-derived
E10082 (see PF-002). RD-04 is also internally inconsistent (R49 → E10081 vs R33/AC-05 → E10153). You
cannot tick AC-05/AC-04 as written without contradiction. **Recommended**: correct RD-04 AC-04/AC-05
(and R33) to the registry-aligned codes before ticking, and note the frozen-spec §5.3 drift; do not
silently tick.

### 🟠 PF-005 — MAJOR — The Zero-Ambiguity Gate's "codes verified / no new codes" premise is falsified

The register's gate closure rests on "All codes 3b emits already exist in `diagnostic-codes.ts`
(verified)" and "No new codes (RD-18 reserves those for Slice 4)". PF-001..004 show that verification
was incomplete (E10084/E10086/E10022 missing; E10082/E10080/E10151 mis-assessed). This is a gate-integrity
issue: the register must be re-verified against the *registry* (not the frozen spec), and a single
**code-reconciliation decision** (register the missing codes vs. scope the checks out) recorded as a new
AR before exec_plan. FR-9's "all codes already exist" line needs the same correction.

### 🟡 PF-006 — MINOR — `isPrimitive` used in `commonType` pseudocode does not exist

`03-01:41` writes `if (isPrimitive(a) && isPrimitive(b) && a.name === b.name)`. `isPrimitive` is
**not defined** anywhere in `@blend65/core` (helpers present: `isInteger`/`isSigned`/`isUnsigned`/
`bitWidth`/`byteSize`/`isError`/`typeName`). Implementable (branch on `Type.kind`/`typeName`), but the
pseudocode references a non-existent helper. Also note `commonType` must handle `boolean` (not a numeric).

### 🟡 PF-007 — MINOR — Redundant new `ilTypeOf` helper; `ilTypeOfType` already exists

`03-03:36` / task 3.2.2 add "`ilTypeOf(t: Type): ILType` (a pure helper)". `ilTypeOfType` already
exists (`codegen/src/il/il-type.ts`, word→IL_WORD) and is used by `slotIlType`. Reuse it (DRY) rather
than introduce a parallel helper.

### 🟡 PF-008 — MINOR — `model` is already on `LowerCtx`/`LowerInput`; task 3.2.1 overstates the seam work

Recon shows `LowerCtx` already carries `model: SemanticModel` and `LowerInput` already threads it
(`emit.ts:97-105`). So "add the model/typeOf to the lowering input type; thread it from the compiler
IL-stage seam" (task 3.2.1, AR-8) is largely **already done** — only *consumption* (`ctx.model.typeOf(expr)`,
once typeMap is populated) is new. Simplify the task to avoid re-plumbing.

### 🟡 PF-009 — MINOR — Citation path/name/line drift (bundle)

Cosmetic but worth fixing so exec_plan lands on the right files: `zp-allocator.ts` & `symbols.ts` are
under `packages/frontend/src/sfa/`, **not** `core/` (`02-current-state.md §2`, AR-9); translator is
`instr/translate.ts`, **not** `il/translate.ts` (AR-5, `02-current-state.md`); planner input type is
`PlanInput`, not `PlanAllocationInput`; `ModuleVarInput.size` is **required**, not `size?` (`03-02:57`);
`moduleVars: []` is at `run-frontend.ts:159`, not `:158`.

### 🔵 PF-010 — OBSERVATION — Two consistent-but-worth-noting items

- RD-18 Slice-Map row for 3b lists "`ILProgram.initCode` allocation" as in-scope; the plan defers
  initializers/`initCode` (AR-2). This is **consistent** with RD-18 AC-2 (no initializer requirement)
  and spec VAR-2 — just a scope narrowing relative to the Slice-Map prose. No action needed; noted.
- `div` and `mod` both route to `__rt_div8`/`__rt_div16` (no `__rt_mod*` symbol; `translate.ts:690`).
  The AR-6 fixture uses only `*`, so unaffected — noted for a future `%` fixture.

---

## Disposition

| Severity | Count | IDs |
|---|---|---|
| 🔴 CRITICAL | 2 | PF-001, PF-002 |
| 🟠 MAJOR | 3 | PF-003, PF-004, PF-005 |
| 🟡 MINOR | 4 | PF-006, PF-007, PF-008, PF-009 |
| 🔵 OBSERVATION | 1 | PF-010 |

**Root cause (single theme):** the plan built its diagnostic-code strategy on the *frozen spec's* code
numbers and an incomplete registry check, when the **authoritative registry** (`diagnostic-codes.ts`) +
RD-04 are the alignment target. Fixing PF-001/002/003 is one **code-reconciliation decision** (register
E10084/E10086/E10022; switch narrowing/cross-sign/boolean to E10154/E10153/registry-correct; re-verify
the register list), which also resolves PF-004 (tick the corrected RD-04 ACs) and PF-005 (gate integrity).

**Recommendation**: hold exec_plan until the code-reconciliation decision is made and the register +
FR-9 + `02-current-state.md:94` + ST-8/FR-2 codes are corrected. The structural build (type engine,
module-var SFA feed, width-aware lowering, VICE fixture) is sound and ready once the code layer is fixed.

---

## Resolution log (iteration 2 — 2026-07-05)

User chose **"register + realign"** (Option A) and **apply fixes**. Applied:

- **AR-11 added** to `00-ambiguity-register.md` with the authoritative registry-grounded code table;
  header/checklist updated to AR-1..AR-11.
- **PF-001** → E10084 + E10022 registered as an additive `diagnostic-codes.ts` task (new exec task
  **1.2.1**, Language-Guard per RD-18 AR-115); `02-current-state.md` "present codes" list corrected
  (E10084 moved to REGISTER; the false claim removed). E10086 **dropped** (casts are Slice 6).
- **PF-002** → narrowing **E10082→E10154**, cross-sign **E10080→E10153** across FR-2, `03-01`
  (statement-typing + module-layout table), ST-8. Recorded frozen-spec §5.3 as the stale source.
- **PF-003** → boolean-in-arith **E10151→E10080** across FR-2, `03-01` (decision table + caller), ST-5.
- **PF-004** → Phase 5 task 5.1.1 now **corrects RD-04 AC-04/AC-05** (E10081 arithmetic / E10154
  narrowing) instead of ticking them as-worded; drops AC-05 from the blind-tick list.
- **PF-005** → gate-integrity note added to AR-11 + FR-9 rewritten (codes are the AR-11 canonical set).
- **PF-006** → `isPrimitive` replaced with `Type.kind === "primitive"` guard in `commonType` (`03-01`)
  and exec task 1.2.2.
- **PF-007** → `03-03` reuses existing `ilTypeOfType` (no new `ilTypeOf`).
- **PF-008** → `03-03` records `model` already on `LowerCtx`/`LowerInput`; edits-summary marks the
  seam rows "No change".
- **PF-009** → file-location note added to `02-current-state.md §2`; `03-02` `ModuleVarInput.size`
  already correct.
- **PF-010** → observations, no change needed.

Task count 44→**45** (new 1.2.1). Re-scan (grep sweep) confirms no stale E10151 / E10082-as-narrowing /
E10080-as-cross-sign / E10086-as-live references remain; all residual mentions are explanatory or the
legitimate E10082=ConstDivisionByZero. **Plan is exec-ready.**

**Confidence**: High. Every code claim verified directly against `diagnostic-codes.ts`, `spec/14`,
`spec/02 §5.3`, and RD-04 ACs; the two CRITICALs survived an adversarial challenger (which also caught
my initial overstatement on E10022 and on "only assignment drifts"). **Hardening**: challenger reconciled;
PF-004's headline corrected from "no code exists" to "spec-designated but unregistered."
