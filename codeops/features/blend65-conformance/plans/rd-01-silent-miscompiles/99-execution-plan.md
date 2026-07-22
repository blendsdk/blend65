# Execution Plan: RD-01 Silent miscompiles

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-22 17:23
> **Progress**: 13/52 tasks (25%)
> **CodeOps Skills Version**: 3.11.0

## Overview

Five phases. M-01 (the loop-exit mechanism) first because its instances are one mechanism and its
change forces the goldens/ledger that gate the rest; then the three independent codegen surfaces
(M-02, M-03, M-04) in any order; then a closeout that discharges the deferral gate, the AC-15
attestation, and the final scoreboard/ratchet verification. Every feature phase is
specification-tests-first (`spec → red → implement → green → impl → verify`). Mechanical
re-goldens land in their **forcing** phase (P1), not the closeout (AR-P8).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks | Tag |
| ----- | ----- | ----- | --- |
| 1 | M-01 — gated `brcmp` wrap exit (reconstruction-immediate) + bound stamp | 16 | complex/sensitive |
| 2 | M-02 — `E10154`/`E10152` poke value-width diagnostic | 10 | standard |
| 3 | M-03 — per-declaration types + widest-slot sizing | 11 | complex |
| 4 | M-04 — `W10182` IRQ/mainline shared-frame warning | 9 | complex/sensitive |
| 5 | Closeout — discharge (deferral gate, AC-15, scoreboard) | 6 | standard |

**Total: 52 tasks across 5 phases** (scope bounded by the task-size criteria, not hour estimates)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress; each task line
> appears exactly once. The executing agent MUST:
> 1. **On implementation:** `- [~] N.M Task ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** `- [x] N.M Task ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated after EVERY task** — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps from `date '+%Y-%m-%d %H:%M'` — never invented.
>
> **Verify cadence (AR-P2):** during a task, `yarn workspace @blend65/<pkg> test`; at each phase
> close, the full root verify (the phase **Verify** line). **AC-15 discipline:** every new
> assertion is perturbed once and watched to FAIL before being trusted, then restored.

---

## Phase 1: M-01 — gated `brcmp` wrap exit + bound stamp

> **Phase ref**: b8c91cfee32e1dd6c0a75049d26a7b6dcae37ea8
> **Lenses**: api-surface, correctness (codegen terminator + IL invariants)
> **Spec**: [03-01](03-01-loop-exit.md) · **ST**: ST-1…ST-16 (incl. ST-5b/5c/6b/9b), ST-16L/16C, ST-36…ST-38 · **AR**: RD AR-1/AR-2/AR-10, AR-P3/AR-P5/AR-P8 · **Packages**: frontend, codegen, **core** (PF-003)

### Step 1.1: Specification tests

**Objective**: pin wrap-form, gating, and the diagnostics before any code. `[CI]` rows assert
**shape/gating only** (a CI codegen test can't observe termination); behaviour is `[local]`.
The Step-1.1 test files are red until 1.2.6, so they ride the **P1-b** commit, not P1-a (PF-021).

- [x] 1.1.1 [spec-author] Write M-01 `[CI]` shape/gating/diag spec tests ST-1…ST-5, ST-5b, **ST-5c** (signed-ascending immediate), ST-6, ST-6b, ST-7…ST-9, ST-9b, ST-10…ST-15 — `control-flow-lowering.spec.test.ts` (codegen). ST-14 asserts **exactly one** wrap-compare operand reads the counter slot, the other the immediate — never both (direction-tolerant, PF-034); ST-5c pins the ascending immediate as `typeMin+step` (PF-032) ✅ (completed: 2026-07-22 16:42) — IL rows via spec-test-author (16 red + 3 green-by-construction); ST-15 relaxation placed in the ACME-gated `[local]` tier (asm-level, R15) — see 1.1.3
- [x] 1.1.2 [spec-author] Designate the **existing** slice4a/slice7 golden suite as ST-16's no-added-guard oracle (gated-emission proof) — a permanently-green regression pin, documented per 1.1.4, not a new test (PF-024) ✅ (completed: 2026-07-22 16:42) — the wrap-safe interior loops slice4a `1 to 10`, slice7 `0 to 4` must stay byte-identical post-fix (no guard added); their existing goldens ARE the oracle
- [x] 1.1.3 Author the `[local]` VICE termination + visit-count suite (ST-16L incl. **sword**, ST-16C incl. the **256** and **10** headline counts) — `describe.skipIf(!hasVice()||!hasAcme())` ✅ (completed: 2026-07-22 16:42) — `loop-termination.spec.test.ts`, 12 cells across byte/word/sbyte/sword × to/downto × step × interior/zero-trip + the ACME-gated ST-15 relaxation probe
- [x] 1.1.4 Run the new spec tests — verify they FAIL (red phase); document any green-by-construction (the gating no-guard pins) and why ✅ (completed: 2026-07-22 16:42) — [CI]: 16 red, ST-9/ST-9b/ST-10 green-by-construction (they assert ABSENCE of a guard that doesn't exist yet); ST-15 red (build ICEs today). [local] VICE cells red-by-hang (known-infinite loops) — not burned to timeout; the load-bearing proof is the post-fix green run

### Step 1.2: Implementation — two commits (AR-P8)

**Objective**: land P1 as two green commits — **P1-a** behaviour-neutral frontend/core stamp, then
**P1-b** the atomic codegen fix + the red Step-1.1 test files + forced re-goldens/retirement.
Commit mechanics are owned by exec_plan (`/gitcm`).

**Commit P1-a — behaviour-neutral (byte-identical output AND identical accepted-program set):**

- [x] 1.2.1 Add the wrap-safe node-keyed map to `SemanticModel` (`packages/core`) + `createEmptyModel` mirror + `analyze.ts` threading; stamp `wrapSafe`/`evaluatedBound` in for-stmt typing using the **resolver-backed** `ctx.engine.evalExpr` (NOT the bare `evalConst` at `:798`, which returns `nonConst` for named consts — PF-010); nothing consumes it yet — 03-01 §Proposed-Changes-1, AR-P5, PF-003 ✅ (completed: 2026-07-22 16:56) — `ForLoopInfo` on core `SemanticModel`; `stampWrapAnalysis` in `typeFor` (resolver-backed); frontend impl test `for-loop-wrap-analysis.impl.test.ts` (7) covers the stamp incl. the named-const resolver case
- [x] 1.2.2 Verify P1-a is byte-identical: all goldens unchanged, ledger still green (defect still present), accepted-program set unchanged, only model-shape impl tests updated — the P1-a commit boundary ✅ (completed: 2026-07-22 16:56) — CI-equivalent verify green (build/typecheck/lint/test); all goldens byte-identical, expressiveness-ledger 13/13 green (defect still present), one model-shape impl test updated (`call-semantics.impl.test.ts` ctx literal)

**Commit P1-b — atomic behaviour change (fix + red spec tests + forced re-goldens/retirement):**

- [x] 1.2.3 Range-check the folded step against the counter type at `statement-typing.ts:810-825` → the `E10061` range case when `step > typeMax` (PF-009). **This lands in P1-b, not P1-a** (PF-033): `step 256` on a byte compiles today, so rejecting it *changes the accepted-program set* — a behaviour change that must ride with ST-6b, not the byte-identical stamp commit (it is corpus-neutral — no committed source uses an over-width step, so goldens/examples are unchanged; the program itself compiles-and-hangs today). Register the extended `E10061` + its comment in `packages/core/.../diagnostic-codes.ts`, **and add the narrowing note to `codeops/00-spec-errata.md`** (a real task, not implicit — PF-051; per AR-P10/PF-036) ✅ (completed: 2026-07-22 17:23) — E10061 extended (`> range.max` → out-of-range message); core registry comment updated; errata E-09 added
- [x] 1.2.4 Emit the gated wrap exit in `incr`: a **fresh single-use reload** of the counter, `brcmp` against a type/step **immediate** — asc `lt(next, imm(typeMin+step))`, desc `gt(next, imm(typeMax−step))` (the ascending immediate carries `typeMin` for signed correctness — PF-032; unsigned `typeMin=0`); drop the `:717-726` ICE guard — `lower.ts` (`lowerFor`, new `wrapExitBranch`), AR-P3 ✅ (completed: 2026-07-22 17:23) — `wrapExitBranch` + `ilTypeMin` added; ICE guard removed; gated on `ctx.model.forLoopInfo.get(stmt)?.wrapSafe`
- [x] 1.2.5 **`translate.ts`-seam verification (AR-P3):** prove the emitted `brcmp lt/gt(next, imm)` lowers cleanly at byte **and** word width (no `foldStoreHome`/`bindA` ICE) — no translator change expected, but the it.1 CRITICAL was invisible at IL level, so this is an explicit gate ✅ (completed: 2026-07-22 17:23) — proven on real VICE: all 13 `[local]` cells assembled+ran (byte/word/sbyte/sword), no ICE; no translator change needed
- [x] 1.2.6 **X-08 red-perturbation GATE (before retirement):** retighten X-08's signature to the wrap form, watch it go **red** against the fixed output; update X-08's stale carry note **and refresh `codeops/00-spec-errata.md` E-08** from the rejected carry design to the `brcmp` form (PF-023) — `expressiveness-ledger.json` ✅ (completed: 2026-07-22 17:23) — retightened to the old unconditional back-edge (`STA i / JMP L0`), observed RED (diff shows `-JMP Main_copyBytes_L0`... `-JMP Main_main_L0` gone); the original `CMP #$00 / BCC` was confounded (retained bound compare) as AR-P8 warned; errata E-08 refreshed to the brcmp form
- [x] 1.2.7 Retire ledger X-07 and X-08, re-golden `slice8b.asm.golden` to the wrap-safe idiom (ST-36; source `examples/slice8b/` stays frozen — PF-029), and re-derive the scoreboard/ratchet — **all in the P1-b commit** (AC-14 "same change"; the ledger gate is red until this lands) ✅ (completed: 2026-07-22 17:23) — X-07/X-08 deleted (ledger 9 entries, green); slice8b re-goldened (one line: JMP → wrap guard); budget raised 387→391 bytes / 54→60 cyc; SCOREBOARD.md regenerated (`yarn gen:scoreboard`, only slice8b row moved)
- [x] 1.2.8 Run all M-01 spec tests — verify they PASS (green phase); fix the implementation, never the test — the P1-b commit boundary ✅ (completed: 2026-07-22 17:23) — full `yarn test` green: all 17 per-package tiers (core 300, frontend 903, codegen 752, test-harness 398, …) + root tier (33); [CI] M-01 spec 35/35 + [local] VICE 13/13

### Step 1.3: Implementation tests & hardening

- [x] 1.3.1 Update the moved unit pins: `control-flow-lowering.impl.test.ts:62-70` (+boundary), `:72-78` ICE-flip (`:76-77`) ✅ (completed: 2026-07-22 17:23) — ICE-expectation flipped (`0 to 255` now compiles w/ `brcmp lt … 1`); added a `downto 0` boundary pin (`ge` retained + `brcmp gt … 254`)
- [ ] 1.3.2 Record the +1 load/compare per-guarded-iteration scoreboard row **and file the beat-shortfall GitHub issue** — the guarded loop meets rather than beats the expert (whose `ADC` carry-out is the wrap flag, free); the fused increment-and-branch-on-wrap terminator is the beat path — document it with the measured cost delta (beat-first directive; issue filing durably authorised, no push)
- [ ] 1.3.3 AC-15: perturb each new M-01 assertion once (fail observed), restore — including the **golden** perturbations: mutate one byte of the re-goldened `slice8b.asm.golden` (ST-36) **and** of an unchanged corpus golden (ST-38), observe each suite fail, restore (PF-024/PF-040)
- [ ] 1.3.4 Full verify

**Deliverables**: gated wrap exit (reconstruction-immediate, translator-verified); resolver-backed stamp; step range-check; full-range compiles; slice8b re-goldened; X-07/X-08 retired + E-08 refreshed; slice4a/slice7 + named-const interior byte-identical.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: M-02 — `E10154` poke value-width diagnostic

> **Phase ref**: _(recorded by exec_plan at phase start)_
> **Lenses**: api-surface (diagnostic surface + accepted-type contract)
> **Spec**: [03-02](03-02-poke-width.md) · **ST**: ST-17…ST-24, ST-24b, ST-20A · **AR**: RD AR-4/AR-5, AR-P6

### Step 2.1: Specification tests (+ R8 fixture audit, pre-wiring)

- [ ] 2.1.1 **R8 fixture audit (BEFORE wiring — PF-004):** scan committed fixtures for a wide/kind-mismatched poke value; enumerate any that the new diagnostic will turn red, so surprise reds at green-phase are pre-explained (an exposed fixture is *edited*, which the "never fix the test" rule otherwise forbids)
- [ ] 2.1.2 [spec-author] Write the four wide-spelling `E10154` tests ST-17…ST-20 + the boolean **`E10152`** kind-mismatch ST-24b — poke-width frontend spec (`frontend`)
- [ ] 2.1.3 [spec-author] Write ST-20A (test-harness): on the wide poke `emitAsm` yields **no text** (error blocks emission — PF-006); the one-store assertion rides the accepted `byte` control ST-21
- [ ] 2.1.4 [spec-author] Write the accepted-type negative controls ST-21…ST-24 (`byte`/`sbyte`/enum/literal)
- [ ] 2.1.5 Run — verify FAIL (red phase); document any negative-control that passes by construction (ST-21…ST-24 are green — no diagnostic exists yet) and why (PF-026)

### Step 2.2: Implementation

- [ ] 2.2.1 Add the value width/kind check in **`expression-typing.ts:1608-1620`** (the only viable seam — `intrinsic-validation` runs before typing, PF-028): `word`/`sword` → `E10154`, `boolean` → the `E10152` kind-mismatch family (PF-027); accept `byte`/`sbyte`/enum/in-range-literal. Do NOT reuse `checkAssignable` unmodified (AR-5)
- [ ] 2.2.2 Draft the messages following registry phrasing (AR-P6); no `codeops`/RD id in the string
- [ ] 2.2.3 Run — verify PASS (green phase)

### Step 2.3: Implementation tests & hardening

- [ ] 2.3.1 AC-15: perturb each new M-02 assertion once, restore
- [ ] 2.3.2 Full verify

**Deliverables**: `E10154` on all four wide spellings; `E10152` on boolean; accepted set compiles; wide poke blocks emission.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 3: M-03 — widest-slot sizing + per-declaration types

> **Phase ref**: _(recorded by exec_plan at phase start)_
> **Lenses**: api-surface, correctness (frame allocation must stay positional)
> **Spec**: [03-03](03-03-frame-slot.md) · **ST**: ST-25…ST-32, ST-30b, ST-30c · **AR**: RD AR-3/AR-6/AR-9, AR-P4 · **Packages**: frontend, **core** (`Symbol`, `E10062`)

### Step 3.1: Specification tests (+ R8 fixture audit, pre-wiring)

- [ ] 3.1.1 **R8 fixture + example audit (BEFORE wiring — PF-004/PF-044):** scan for nested reuse / shadowing / duplicate-`let` shapes the R5 diagnostics will turn red, **and** for differing-width same-name **sibling** shapes that widest-sizing/per-use width will change *bytes* on (no diagnostic fires, but a golden could shift) — so both the diagnostic and byte-neutrality exposures are pre-enumerated. (C-01 scanned only downto/step/word/poke, never sibling reuse; a fresh corpus scan found no local-name reuse today, but the audit makes P3's byte-neutrality verified, not assumed)
- [ ] 3.1.2 [spec-author] Write the five R5 diagnostic tests ST-25…ST-29 (`E10101`/`E10003`/`E10062`) + the sibling no-diagnostic ST-30 and **sibling for-counter** ST-30b (PF-012) — shadowing/reuse spec (`frontend`)
- [ ] 3.1.3 [spec-author] Write the pop-2 **layout** assertion ST-31 (frontend) + the pop-2 store-extent/pop-3 wide-read **value** assertion ST-32 and the **sibling-counter width** assertion ST-30c (codegen/`test-harness` — R15 keeps emitted width/extent out of the frontend tier, PF-025/PF-037)
- [ ] 3.1.4 Run — verify FAIL (red phase); document any negative control green by construction (ST-30/ST-30b)

### Step 3.2: Implementation — retention → diagnostics → sizing (PF-002 ordering)

- [ ] 3.2.1 **Retention (first):** retain per-declaration types on the `Symbol` (`packages/core/src/semantics/symbol.ts`) + sibling-distinguishing structure in `function-collection.ts`; resolve per-use width at **every** local consumer — `lower.ts:701` (counter), `:525` (let-store), `:1184` (read), `:1634` (store) — instead of name-keyed `slotIlType` (pop-3, PF-012, AR-P4). Allocation stays positional
- [ ] 3.2.2 **Diagnostics:** register `E10062` in `packages/core/src/diagnostics/diagnostic-codes.ts` (RD AR-6, PF-003) and wire R5 on the now-distinguishable scopes: `E10101` shadow, `E10003` duplicate, `E10062` nested counter — silent on siblings
- [ ] 3.2.3 **Sizing:** at the retention-layer projection into `FrameVar`s (`collectFrameVars`/`model-adapter.ts`, where colliding widths still exist — NOT `frame-computation.ts`, which never sees a collision, PF-002), collapse to the **widest**; `frame-computation` recomputes offsets over the resized slots (later slots shift by the delta — that shift IS the fix, PF-011)
- [ ] 3.2.4 Run — verify PASS (green phase)

### Step 3.3: Implementation tests & hardening

- [ ] 3.3.1 Impl tests: widest-sizing internals; **later-slot offsets equal the recomputed running sum, no overlap** (NOT offset identity — PF-011); per-use resolution edge cases incl. sibling for-counters
- [ ] 3.3.2 AC-15: perturb each new M-03 assertion once, restore
- [ ] 3.3.3 Full verify

**Deliverables**: R5 diagnostics; sibling reuse (incl. for-counters) compiles clean; widest slot; wide read/store emit full width.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 4: M-04 — `W10182` IRQ/mainline shared-frame warning

> **Phase ref**: _(recorded by exec_plan at phase start)_
> **Lenses**: api-surface, correctness (classification BFS must stay untouched)
> **Spec**: [03-04](03-04-irq-warning.md) · **ST**: ST-33, ST-33b, ST-34, ST-35 · **AR**: RD AR-7/AR-8, AR-P9 · **Packages**: sfa, **core** (`W10182`), **compiler** (seam)

### Step 4.1: Specification tests (+ R8 fixture audit, pre-wiring)

- [ ] 4.1.1 **R8 fixture audit (BEFORE wiring — PF-004):** enumerate the SFA fixtures that construct the IRQ∩mainline shape and will fire `W10182` by design (`irq-interference.spec.test.ts` builds exactly this) — assert that expectation in their suites (AC-12 "clean = zero errors"), so no surprise reds at green-phase
- [ ] 4.1.2 [spec-author] Write ST-33 (`W10182`, names both reachers) + **ST-33b mixed roots** (taken + never-taken handler → names the taken one, PF-031) — irq-interference spec
- [ ] 4.1.3 [spec-author] Write the two negatives ST-34 (never-address-taken callee), ST-35 (no frame state per the AR-P9 proxy)
- [ ] 4.1.4 Run — verify FAIL (red phase); document negatives green by construction (no warning exists yet) and why (PF-026)

### Step 4.2: Implementation

- [ ] 4.2.1 Thread provenance — the interrupt witness from the **taken-rooted closure** (not by filtering the every-handler witness, PF-031); add the `DiagnosticBag` emission seam at the caller **`packages/compiler/src/api/run-frontend.ts:185`** (`modelToFunctionInfo`, currently bagless — PF-030)
- [ ] 4.2.2 Register `W10182` in `packages/core/.../diagnostic-codes.ts` **and record it in `codeops/00-spec-errata.md`** as a minted code (PF-023); add a **separate** address-taken predicate over the classification output with the **AR-P9 spill-free-body proxy** for "no frame state"; **leave `computeIrqClassification`'s BFS untouched** (AR-8) — emit once per shared function
- [ ] 4.2.3 Run — verify PASS (green phase)

### Step 4.3: Implementation tests & hardening

- [ ] 4.3.1 AC-15: perturb each new M-04 assertion once, restore
- [ ] 4.3.2 Full verify

**Deliverables**: `W10182` once per shared function (registered + errata-logged); negatives silent per AR-P9; classification BFS + its ST-pins intact.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 5: Closeout — discharge

> **Phase ref**: _(recorded by exec_plan at phase start)_
> **Lenses**: api-surface
> **AR**: RD AC-12/AC-14/AC-15/AC-16, AR-P8 · Not a feature phase — discharge + narrative only

- [ ] 5.1 Verify all 14 corpus goldens byte-identical except slice8b; all 18 examples compile clean under the new diagnostics (AC-12)
- [ ] 5.2 **Verify** the P1-derived bytes ratchet + scoreboard still hold (P2–P4 are byte-neutral): re-derive and **assert identical** to the P1-b artifacts — any diff is a phase-attribution failure to investigate, not a closeout edit (PF-020; AR-P8 keeps mutation in the forcing phase). Record the single documented slice8b delta
- [ ] 5.3 AC-15 attestation: record, per new assertion, the mutation applied and the failure text observed — closeout document
- [ ] 5.4 Deferral-expiry gate (AC-16): answer "did this RD expire any deferral's rationale?"; discharge slice-4a AR-6, FUT-004, and the `function-collection.ts:192` code-comment deferral; confirm no orphaned deferral names a future RD-01 slice
- [ ] 5.5 Confirm the ledger gate is green only *after* X-07/X-08 retirement (verify the P1 retirement holds); expressiveness-ledger has no RD-01 defect entries left asserting a present defect
- [ ] 5.6 Roadmap sync: RD-01 → Done; update the tracker, progress count, and resume-here block (roadmap skill)

**Deliverables**: closeout document (AC-15 per-assertion + AC-16 deferral answer); scoreboard/ratchet refreshed; roadmap synced.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Dependencies

```
Phase 1 (M-01 — forces goldens/ledger)
    ↓
Phase 2 (M-02) ─┐
Phase 3 (M-03) ─┼─ independent surfaces, any order after P1
Phase 4 (M-04) ─┘
    ↓
Phase 5 (closeout — discharge)
```

M-01 first (RD Notes); M-02/M-03/M-04 independent; closeout last. Within P3, **retention (3.2.1) →
diagnostics (3.2.2) → sizing (3.2.3)** — the last two both consume the retained per-declaration
widths (PF-002). E10062 registration precedes its emission within 3.2.2. Each phase touching
`@blend65/core` (P1 model map, P3 `Symbol`/`E10062`, P4 `W10182`) lands that core edit first.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ Full root verify passing (build, typecheck, lint 10/10, all test tiers incl. R15 boundary)
3. ✅ No new errors; `W10182` fires only where intended; `spec/` untouched (`git status --porcelain spec/` empty)
4. ✅ No dead code
5. ✅ Security/robustness: input-shape diagnostics (E10154/E10062/E10101/E10003) validated; MMIO writes width-correct
6. ✅ Goldens byte-identical except slice8b; all 18 examples compile clean; X-07/X-08 retired
7. ✅ AC-1…AC-16 discharged; AC-15 per-assertion attestation recorded; AC-16 deferral gate answered
8. ✅ Post-completion re-analysis (exec_plan skill)
