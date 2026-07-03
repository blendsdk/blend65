# Preflight Report — RD-12: Test Harness & Emulator Verification (requirements)

> **Status**: ✅ PREFLIGHT PASSED — all 8 findings resolved (0 critical, 0 major, 6 minor,
> 2 observations; user accepted all recommendations 2026-07-03 and **all fixes applied**
> to RD-12: PF-001 §3.1 interim-interpreter note + R5, PF-002 §5 RD-17 row + AC-14
> disambiguation, PF-004 R19 label keys, PF-005 R27/R28 `BuildResult`, PF-006 §5 RD-10 row
> + new R7a registry, PF-007 R32 note, PF-008 new R28a, PF-009 header Depends-On).
> Iteration 2 re-scan clean — no duplicate R-ids, no regressions. Ready for `make_plan`.
> (Path convention: this file holds the *latest*
> requirements-level audit; the prior RD-11 audit is preserved in git history. PF
> numbering restarts per artifact.)
> **Artifact**: `codeops/features/blend65-ri/requirements/RD-12-test-harness.md`
> **Type**: Requirements document (single RD) · **Scan date**: 2026-07-03 · **Iteration**: 1
> **Same-session**: NO — RD-12 authored 2026-05-31; this is a fresh-eyes, codebase-grounded scan.
> **Hardening**: the advisor tool was unavailable; the two initially-MAJOR findings
> (PF-001, PF-002) were hardened with an **independent blind challenger** (instructed to
> refute, blind to the original reasoning). The challenger **REFUTED PF-001 as MAJOR**
> and **downgraded PF-002 to MINOR**, and surfaced a blind spot the lead missed (the
> interpreter's own file header). Both are re-recorded below at corrected severity with
> the challenger's evidence folded in. Net: **no MAJOR findings survived hardening.**

---

## Codebase Context Summary

Grounded against the post-RD-09/10/11/15/17 tree. Files read: `packages/test-harness/*`,
`packages/compiler/src/testing/mos6502-interpreter.ts` (incl. header), `.../runtime-asm.impl.test.ts`,
`packages/compiler/src/acme/label-file.ts`, `packages/compiler/src/api/results.ts`,
`.github/workflows/ci.yml`, RD-17 doc + its ambiguity register (AR-P4/AR-P17).

| Claim in RD-12 | Reality in the code | Status |
|---|---|---|
| `@blend65/test-harness` is the owning package (AR-24) | Exists but is a **stub** — `src/index.ts` exports only `VERSION="0.1.0"`. Clean slate. | ✅ |
| Three-tier taxonomy (unit / golden / VICE-emulator); emulator local-only (R4/R5, AR-27) | Correct and **not** stale. RD-17's `mos6502-interpreter.ts` is a self-declared *interim, test-support-only* tool whose header says "**RD-12 supersedes this**"; its test is `skipIf(ACME===null)` and CI documents ACME ≠ emulator (not an AR-27 violation). The taxonomy is the intended target arch. | ✅ (PF-001 ↓ MINOR) |
| RD-12 owns RD-17's deferred AC-14 (AR-P4) | RD-12 §5 omits RD-17 entirely and doesn't acknowledge the *inherited* AC-14 (distinct from RD-12's own AC-14 = "publishable package"). Back-propagation gap (RD-12 predates AR-P4 by 5 weeks). | 🟡 PF-002 |
| `runUntilLabel`/symbolic `assertMemory` via label file (AR-67) | `parseLabelFile` keys on the raw label — no leading `.`, no `C:` (e.g. `_main`, `__zp_c`). RD-12 §4.3 example `_main.score` may not be a real key form. | 🟡 PF-004 |
| Harness accepts a `BuildResult` (R27/R28) | RD-15 `BuildResult` (`api/results.ts`) carries `symbolMap?`, `binary?`, `binaryPath?` — aligns; RD-12 predates it and doesn't bind to the concrete fields. | 🟡 PF-005 |
| `setupEmulator({platform})` picks the emulator | RD-10 profiles carry **no** emulator exe/port/config. No platform→emulator source of truth. | 🟡 PF-006 |
| `Depends On: RD-01` | Also consumes RD-09/10/15 and discharges RD-17. | 🟡 PF-009 |
| Golden tier `assertGolden` + `--update-golden` (R29-R32) | Net-new; 7 existing `*.golden.spec.test.ts` use inline expectations. | 🔵 PF-007 |
| Tier-3 loads a `.prg` in VICE | DEF-1 (RD-15/AR-V23) made the c64 PRG header-bearing/loadable; interpreter tier loads a headerless `$8000` bin — dual artifact shapes. | 🔵 PF-008 |

---

## Findings

### 🟡 PF-001 (MINOR — downgraded from MAJOR by challenger) — Disposition of the interim in-process interpreter
`packages/compiler/src/testing/mos6502-interpreter.ts` (223 LOC, AR-P17) is a
*self-declared interim* 6502 executor whose header states "**RD-12 supersedes this with
the real test-harness/emulator tier.**" It is **not** a hidden 4th tier and does **not**
make RD-12's taxonomy or CI policy stale (the challenger confirmed: it's ACME-gated
`skipIf`, CI documents ACME ≠ emulator, R4/R5 gate VICE/display specifically). The only
real question is a *planning disposition*: when RD-12 builds the real harness, does it
**retire** the interpreter, **relocate/absorb** it into `@blend65/test-harness` as a
CI-eligible routine-level driver, or **leave it in place** as a compiler-internal test?
**Recommendation:** leave it in place for now and add one sentence to RD-12 noting the
interpreter as the interim mechanism RD-12's emulator tier supersedes (so the linkage is
explicit); optionally, later, expose a routine-level driver in the harness. Not blocking.

### 🟡 PF-002 (MINOR — downgraded from MAJOR by challenger) — RD-17 linkage + inherited AC-14 unacknowledged
RD-12 "owns" RD-17's deferred AC-14 (emulator verification of the `__rt_*` runtime math
routines; AR-P4), but RD-12 §5 (Interactions) **omits RD-17 entirely** and the body never
acknowledges the inheritance. **Disambiguation (challenger's key correction):** RD-12 has
its *own* AC-14 (line 340, "publishable npm package") — a different criterion; the finding
is specifically about the *inherited* RD-17 AC-14, not RD-12's. RD-12's Tier-3 machinery
(R3/R20/R22/R17/R19) is already the generic discharge mechanism; it simply isn't tied to
RD-17 by name. Chronology explains it (RD-12 predates AR-P4 by 5 weeks → back-propagation
task per the runtime-ambiguity protocol).
**Recommendation:** add an RD-17 row to §5 ("Discharges RD-17's deferred AC-14 — Tier-3
emulator tests must include vectors verifying the runtime multiply/divide routines") and
a one-line note in §2/§6, disambiguated from RD-12's own AC-14.

### 🟡 PF-004 (MINOR) — R19 symbolic-assertion example vs. real label keys
§4.3 / R19 show `assertMemory('_main.score', 42)`. The real `symbolMap` (from
`parseLabelFile`, `acme/label-file.ts:28,47`) strips the leading `.` and `C:` — keys are
raw labels like `_main`. `_main.score` may not be an emitted form.
**Recommendation:** bind R19 to the actual key format `parseLabelFile` produces and
cross-reference the codegen label-naming convention.

### 🟡 PF-005 (MINOR) — R27/R28 should bind to RD-15's concrete `BuildResult`
**Recommendation:** update R27/R28 to cite `@blend65/compiler`'s `BuildResult` and its
fields (`symbolMap`, `binaryPath`, `binary`); note `EmitBinaryResult` is the *ACME
aggregate*, not this type.

### 🟡 PF-006 (MINOR) — No source of truth for platform→emulator mapping
`setupEmulator({platform})` implies a platform→emulator+launch-args lookup; RD-10
profiles hold none.
**Recommendation:** harness-internal registry (VICE/`x64sc` only for the MVP); note a
future platform-profile extension for the other emulators.

### 🟡 PF-009 (MINOR) — Understated `Depends On`
**Recommendation:** `Depends On: RD-01, RD-09, RD-10, RD-15, RD-17` (overlaps PF-002 on RD-17).

### 🔵 PF-007 (OBSERVATION) — Golden helper is net-new
R29-R32 introduce committed-`.golden` + `assertGolden` + `--update-golden`; the 7 existing
`*.golden.spec.test.ts` use inline expectations. Recommend: leave existing ones; new
helper for new tests.

### 🔵 PF-008 (OBSERVATION) — Dual artifact shapes across tiers
VICE tier loads the header-bearing `.prg` (DEF-1 fix); interpreter/routine tier loads a
headerless `$8000` bin. Worth a one-line note so the plan wires each tier to the right artifact.

---

## Outcome
No CRITICAL/MAJOR findings survived hardening. All 6 MINOR + 2 OBSERVATION carry
recommendations. Pending user decisions → expected tier: **✅ PASSED** (if MINORs
applied) or **PASSED WITH NOTES** (if any accepted as-is).
