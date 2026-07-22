# Execution Plan: RD-01 Silent miscompiles

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-22 12:20
> **Progress**: 0/49 tasks (0%)
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
| 1 | M-01 — gated `brcmp` wrap exit + bound stamp | 14 | complex/sensitive |
| 2 | M-02 — `E10154` poke value-width diagnostic | 9 | standard |
| 3 | M-03 — widest-slot sizing + per-declaration types | 11 | complex |
| 4 | M-04 — `W10182` IRQ/mainline shared-frame warning | 9 | complex/sensitive |
| 5 | Closeout — discharge (deferral gate, AC-15, scoreboard) | 6 | standard |

**Total: 49 tasks across 5 phases** (scope bounded by the task-size criteria, not hour estimates)

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

> **Phase ref**: _(recorded by exec_plan at phase start)_
> **Lenses**: api-surface, correctness (codegen terminator + IL invariants)
> **Spec**: [03-01](03-01-loop-exit.md) · **ST**: ST-1…ST-16, ST-36…ST-38 · **AR**: RD AR-1/AR-2/AR-10, AR-P3/AR-P5/AR-P8

### Step 1.1: Specification tests

**Objective**: pin termination, wrap-form, gating, and the moved corpus/ledger pins before any code.

- [ ] 1.1.1 [spec-author] Write M-01 IL/asm spec tests from ST-1…ST-15 — `control-flow-lowering.spec.test.ts` (codegen)
- [ ] 1.1.2 [spec-author] Write the gated-emission byte-identity pin ST-16 (slice4a/slice7 unchanged) into the golden/spec tier
- [ ] 1.1.3 Author the `[local]` VICE termination + visit-count suite (ST-16L, ST-16C) — `describe.skipIf(!hasVice()||!hasAcme())`
- [ ] 1.1.4 Run the new spec tests — verify they FAIL (red phase); document any that pass and why

### Step 1.2: Implementation — two commits (AR-P8)

**Objective**: land P1 as two green commits — **P1-a** behaviour-neutral frontend stamp, then
**P1-b** the atomic codegen fix bundled with its forced re-goldens/retirement. Commit mechanics
are owned by exec_plan (`/gitcm`); the tasks below fix the two boundaries and their green-ness.

**Commit P1-a — behaviour-neutral (byte-identical output):**

- [ ] 1.2.1 Stamp the const-evaluated bound + `wrapSafe` bit into the for-loop model (reuse the discarded `evalConst` at `statement-typing.ts:798`); nothing consumes it yet — per 03-01 §Proposed-Changes-1, AR-P5
- [ ] 1.2.2 Verify P1-a is byte-identical: all goldens unchanged, ledger still green (defect still present), only model-shape impl tests updated — this green-ness is the P1-a commit boundary

**Commit P1-b — atomic behaviour change (fix + forced re-goldens/retirement together):**

- [ ] 1.2.3 Emit the gated wrap exit in `incr`: `brcmp lt/gt(next, current)` reusing the live in-block temps; drop the `:717-726` full-range ICE guard — `lower.ts` (`lowerFor`, `incrementCounter`, new `wrapExitBranch`), AR-P3
- [ ] 1.2.4 **X-08 red-perturbation GATE (before retirement):** retighten X-08's signature to the wrap form and watch it actually go **red** against the fixed output — proving the forcing function fired; update the stale carry-exit note — `expressiveness-ledger.json`, AR-P8
- [ ] 1.2.5 Retire ledger X-07 and X-08, re-golden slice8b `copyBytes` to the wrap-safe idiom (ST-36), and re-derive the scoreboard/ratchet — **all in the P1-b commit** (AC-14 "same change"; the ledger gate goes red until this lands)
- [ ] 1.2.6 Run all M-01 spec tests — verify they PASS (green phase); if any fail, fix the implementation, never the test — this green-ness is the P1-b commit boundary

### Step 1.3: Implementation tests & hardening

- [ ] 1.3.1 Update the moved unit pins: `control-flow-lowering.impl.test.ts:62-70` (+boundary), `:72-78` ICE-flip (`:76-77`)
- [ ] 1.3.2 Record the +1 load/compare per-guarded-iteration scoreboard row (Prime-Directive cost) in the phase's scoreboard delta **and file the beat-shortfall GitHub issue** — the guarded loop meets rather than beats the expert (whose `ADC` carry-out is the wrap flag, free); the fused increment-and-branch-on-wrap terminator is the beat path — document it with the measured cost delta (beat-first directive; issue filing durably authorised, no push)
- [ ] 1.3.3 AC-15: perturb each new M-01 assertion once (fail observed), restore
- [ ] 1.3.4 Full verify

**Deliverables**: gated wrap exit; stamped bound; full-range compiles; slice8b re-goldened; X-07/X-08 retired & X-08 red-perturbed; slice4a/slice7 byte-identical.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: M-02 — `E10154` poke value-width diagnostic

> **Phase ref**: _(recorded by exec_plan at phase start)_
> **Lenses**: api-surface (diagnostic surface + accepted-type contract)
> **Spec**: [03-02](03-02-poke-width.md) · **ST**: ST-17…ST-24 · **AR**: RD AR-4/AR-5, AR-P6

### Step 2.1: Specification tests

- [ ] 2.1.1 [spec-author] Write the four wide-spelling diagnostic tests ST-17…ST-20 — poke-width frontend spec (`frontend`)
- [ ] 2.1.2 [spec-author] Write the `emitAsm` single-store assertion ST-20A — poke-width emit spec (`test-harness`, R15 split)
- [ ] 2.1.3 [spec-author] Write the four accepted-type negative controls ST-21…ST-24 (`byte`/`sbyte`/enum/literal)
- [ ] 2.1.4 Run — verify FAIL (red phase)

### Step 2.2: Implementation

- [ ] 2.2.1 Add the value-operand width check for non-literal spellings; emit `E10154`, block the second store — per 03-02 §Proposed-Changes (do NOT reuse `checkAssignable` unmodified — AR-5)
- [ ] 2.2.2 Draft the `E10154` message following registry phrasing (AR-P6); no `codeops`/RD id in the string
- [ ] 2.2.3 Run — verify PASS (green phase)

### Step 2.3: Implementation tests & hardening

- [ ] 2.3.1 AC-15: perturb each new M-02 assertion once, restore; audit committed fixtures for the two-byte-poke shape (R8)
- [ ] 2.3.2 Full verify

**Deliverables**: `E10154` on all four wide spellings; accepted set compiles; no second store.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 3: M-03 — widest-slot sizing + per-declaration types

> **Phase ref**: _(recorded by exec_plan at phase start)_
> **Lenses**: api-surface, correctness (frame allocation must stay positional)
> **Spec**: [03-03](03-03-frame-slot.md) · **ST**: ST-25…ST-32 · **AR**: RD AR-3/AR-6/AR-9, AR-P4

### Step 3.1: Specification tests

- [ ] 3.1.1 [spec-author] Write the five R5 diagnostic tests ST-25…ST-29 (`E10101`/`E10003`/`E10062`) — shadowing/reuse spec (`frontend`)
- [ ] 3.1.2 [spec-author] Write the sibling no-diagnostic + pop-2 neighbour-untouched tests ST-30, ST-31
- [ ] 3.1.3 [spec-author] Write the pop-3 wide-read **value** assertion ST-32 (`test-harness`, R15 split)
- [ ] 3.1.4 Run — verify FAIL (red phase)

### Step 3.2: Implementation

- [ ] 3.2.1 Register `E10062` (scoped to nested reuse — RD AR-6) and wire R5 diagnostics: `E10101` shadow, `E10003` duplicate, `E10062` nested counter — `function-collection.ts` / type-check
- [ ] 3.2.2 Size a name-collapsed slot to the **widest** colliding declaration; keep all offsets positional (width-only) — `frame-computation.ts:52-64` (pop-2, R6)
- [ ] 3.2.3 Retain per-declaration types and resolve read width per-use at the lowering site (not the name-keyed slot) — `function-collection.ts` + `lower.ts:1184` (pop-3, AR-P4); allocation stays positional
- [ ] 3.2.4 Run — verify PASS (green phase)

### Step 3.3: Implementation tests & hardening

- [ ] 3.3.1 Impl tests: widest-sizing internals + neighbour-offset stability; per-use resolution edge cases
- [ ] 3.3.2 AC-15: perturb each new M-03 assertion once, restore; audit committed fixtures for duplicate-`let` shapes (R8)
- [ ] 3.3.3 Full verify

**Deliverables**: R5 diagnostics; sibling reuse compiles clean; widest slot; wide read emits both bytes.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 4: M-04 — `W10182` IRQ/mainline shared-frame warning

> **Phase ref**: _(recorded by exec_plan at phase start)_
> **Lenses**: api-surface, correctness (classification BFS must stay untouched)
> **Spec**: [03-04](03-04-irq-warning.md) · **ST**: ST-33…ST-35 · **AR**: RD AR-7/AR-8

### Step 4.1: Specification tests

- [ ] 4.1.1 [spec-author] Write the positive warning test ST-33 (`W10182`, names both reachers) — irq-interference spec
- [ ] 4.1.2 [spec-author] Write the two negatives ST-34 (never-address-taken callee), ST-35 (no frame state)
- [ ] 4.1.3 Run — verify FAIL (red phase)

### Step 4.2: Implementation

- [ ] 4.2.1 Thread provenance (one interrupt entry + one mainline root per shared function) — retain the discarded `model-adapter.ts:473-481` witness; add the `DiagnosticBag` emission seam
- [ ] 4.2.2 Register/mint `W10182`; add a **separate** address-taken predicate over the classification output (+ no-frame-state exclusion); **leave `computeIrqClassification`'s BFS untouched** (AR-8) — emit once per shared function
- [ ] 4.2.3 Run — verify PASS (green phase)

### Step 4.3: Implementation tests & hardening

- [ ] 4.3.1 Enumerate the SFA fixtures that fire `W10182` by design (AC-12 "clean = zero errors") and assert that expectation in their suites (doubling as AC-11 probes)
- [ ] 4.3.2 AC-15: perturb each new M-04 assertion once, restore
- [ ] 4.3.3 Full verify

**Deliverables**: `W10182` once per shared function; negatives silent; classification BFS + ST-pins intact.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 5: Closeout — discharge

> **Phase ref**: _(recorded by exec_plan at phase start)_
> **Lenses**: api-surface
> **AR**: RD AC-12/AC-14/AC-15/AC-16, AR-P8 · Not a feature phase — discharge + narrative only

- [ ] 5.1 Verify all 14 corpus goldens byte-identical except slice8b; all 18 examples compile clean under the new diagnostics (AC-12)
- [ ] 5.2 Re-derive the bytes ratchet (on shrink too) and refresh the scoreboard in this commit; record the single documented slice8b delta (roadmap cross-cutting rule)
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

M-01 first (RD Notes); M-02/M-03/M-04 independent; closeout last. E10062 registration precedes its
emission within P3.

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
