# Execution Plan: RD-18 Slice 6 — Full Expressions & Mixed Width

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-11 17:48 (Phase 2 COMPLETE — width-aware const evaluation green, 22/52)
> **Progress**: 22/52 tasks (42%)
> **CodeOps Skills Version**: 3.3.1

## Overview

Full expression typing + promotion, width-aware const folding, synthetic-slot
CFG lowering for `&&`/`||`/ternary, the remaining unary/conversion/comparison/shift
codegen, and the AC-5 acceptance bar. Design owned by 03-01…03-05; expectations by
07-testing-strategy (ST-1…ST-34); decisions by 00-ambiguity-register (AR-1…AR-14).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
|-------|-------|-------|
| 1 | Codes, core policy & full expression typing (frontend) | 14 |
| 2 | Width-aware const evaluation (frontend) | 8 |
| 3 | Synthetic slots + IL lowering (frontend adapter + codegen) | 11 |
| 4 | Translate — conversions, comparisons, shifts (codegen) | 9 |
| 5 | Acceptance — fixture, golden, ACME, VICE, negatives | 6 |
| 6 | Rollout bookkeeping | 4 |

**Total: 52 tasks across 6 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every
> task line appears exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp —
>    `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` —
>    `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header and Last Updated stamp after EVERY task** — never
>    batch. Only `[x]` counts.
> 4. **Resume** top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

> **Standing constraints:** `spec/` frozen (D3 — `git status --porcelain spec/`
> empty). No plan-artifact references (AR/ST/DEF ids, plan paths) in shipped code or
> doc comments — restate rationale in plain language. Immutable oracle: never edit a
> spec test to match the implementation. **Supersession exception (AR-3):** the 5a/3b
> spec tests that pin strict same-type rejection of SAME-SIGN WIDENING shapes assert
> an interim rule the spec contradicts — task 1.2.6 replaces exactly those
> assertions, each with a written justification in its completion note (5b ST-6
> precedent). Nothing else in any prior spec test may change.

---

## Phase 1: Codes, core policy & full expression typing (frontend)

### Step 1.1: Specification tests

**Reference**: 07 ST-1…ST-18 · 03-01 · AR-1/3/4/10/14
**Objective**: pin the operator matrix, promotion, casts, ternary, compound
assignment, and warnings before any code.

- [x] 1.1.1 Write matrix/promotion/cast/ternary/compound spec tests (ST-1…ST-15) — `packages/frontend/src/semantics/type-check/expression-matrix.spec.test.ts` ✅ (completed: 2026-07-11 16:48)
- [x] 1.1.2 Write warning spec tests (ST-16 + ST-18's W10174 case; ST-17 and ST-18's W10101 case are Phase-2 — they consume the width folds) — `packages/frontend/src/semantics/type-check/expression-warnings.spec.test.ts` ✅ (completed: 2026-07-11 16:48)
- [x] 1.1.3 RED phase: run both files; document any pre-passer with justification ✅ (completed: 2026-07-11 16:48 — 27 failed / 5 passed of 32. Pre-passers, all justified negatives: (1) compound `b += w` E10154 + (2) compound `CONST += 1` E10191 — today's STRICTER interim same-type rule already rejects these shapes (right outcome, coarser reason; must survive the rewrite); (3–5) the three "should not warn" W10160/W10174 non-trigger cases pass vacuously until the warnings exist — they become load-bearing at green)

### Step 1.2: Implementation

**Reference**: 03-01 §1–§8 · AR-3, AR-10, AR-14
**Objective**: codes + core policy + the `typeBinary`/`typeUnary`/`typeCast`/
`typeConditional`/compound machinery + W-emissions.

- [x] 1.2.1 Mint/rename diagnostic codes per the 03-01 table (E10086/E10087/E10088 new; E10083 key rename; W10101/W10160/W10161/W10174 new) — `packages/core/src/diagnostics/diagnostic-codes.ts` ✅ (completed: 2026-07-11 16:53 — registry + impl-test pins green; W10100/W10173 non-registration guarded)
- [x] 1.2.2 Core policy: TS-4 promotion in `commonType` + same-sign widening in `isAssignableTo` (doc comments updated) — `packages/core/src/semantics/type-utils.ts` ✅ (completed: 2026-07-11 17:20)
- [x] 1.2.3 `typeBinary` class dispatch (arithmetic/bitwise/shift/comparison/logical) + literal adaptation across classes — `packages/frontend/src/semantics/type-check/expression-typing.ts` ✅ (completed: 2026-07-11 17:20)
- [x] 1.2.4 `typeUnary` + `typeCast` (FR-40) + `typeConditional` — `expression-typing.ts` ✅ (completed: 2026-07-11 17:20 — note: identity casts `<T>(t)` of the same primitive type as the target, including `<boolean>(flag)`, follow TS-12's diagonal and type as the target)
- [x] 1.2.5 Compound-assignment expansion in `typeAssign` + `lo`/`hi` argument contexts in `typeIntrinsicCall` — `expression-typing.ts` ✅ (completed: 2026-07-11 17:20)
- [x] 1.2.6 AR-3 supersession: replace the 5a strict-arg / 3b strict-assign spec assertions for same-sign-widening shapes (each with a completion-note justification) — `packages/frontend/src/semantics/*.spec.test.ts` AND `packages/core/src/semantics/type-utils.spec.test.ts` (the value-shaped pins: `isAssignableTo(byte,word)→false` at :89, `commonType(byte,word)→null` at :107; audit via grep for E10171/E10154 pins PLUS `toBe(false)`/`toBeNull()` assertions on `isAssignableTo`/`commonType`) ✅ (completed: 2026-07-11 17:14 — JUSTIFICATION: the two core pins asserted the 3b/5a deliberately-stricter INTERIM same-type-only rule; spec §5.3 + TS-4 mandate implicit same-sign widening, and the immutable-oracle rule binds tests to the SPEC — exactly those two assertions flipped (plus added sword/both-order coverage), narrowing/cross-sign/boolean pins untouched; supersession note written into the suite header. Audit: full frontend suite ALREADY GREEN (465 passed) — the 5a/3b frontend pins only cover narrowing/cross-sign shapes, none superseded; the E10171 grep hits are range/field/narrowing cases, all still valid; one stale "strict same-type" header phrase in call-typing.spec.test.ts reworded, no expectation changed)
- [x] 1.2.7 `checkIntermediateOverflow` (W10160/W10161) wired at init/assign/arg/return sites — `expression-typing.ts`, `statement-typing.ts` ✅ (completed: 2026-07-11 17:20— also wired at the module-let init site for local-parity; W10161's fold branch uses today's plain fold and upgrades automatically when the Phase-2 width folds land)
- [x] 1.2.8 W10174 emission point (literal shift-amount check — no width folds needed; the W10101 emission point moves to Phase 2 with the cast fold it consumes) — `expression-typing.ts` ✅ (completed: 2026-07-11 17:20)
- [x] 1.2.9 GREEN phase: ST-1…ST-16 + ST-18's W10174 case pass (ST-17 + ST-18's W10101 case go green in Phase 2; fix implementation only) ✅ (completed: 2026-07-11 17:20 — both spec files 32/32 green; FULL workspace suite green incl. codegen/compiler/harness; doc-standard self-check clean on all added code)

### Step 1.3: Implementation tests & hardening

- [x] 1.3.1 Impl tests: 25-pair matrix sweep per class, adaptation, compound internals, W-trigger/non-trigger boundaries — `expression-matrix.impl.test.ts` (07 impl table) ✅ (completed: 2026-07-11 17:26 — 152 tests: arithmetic/bitwise + ordered-comparison 25-pair sweeps, logical + shift matrices, adaptation per class, compound dispatch + write-back internals, W10160/W10161/W10174 trigger & non-trigger boundaries incl. all four wired sites)
- [x] 1.3.2 Full verify ✅ (completed: 2026-07-11 17:26 — install+build+typecheck+lint+test ALL GREEN; `spec/` clean)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Width-aware const evaluation (frontend)

### Step 2.1: Specification tests

**Reference**: 07 ST-19…ST-22 · 03-02 · AR-7
**Objective**: pin const-decl folding of the new operator surface.

- [x] 2.1.1 Write const-width spec tests (ST-17, ST-18's W10101 case, ST-19…ST-22) — `packages/frontend/src/semantics/const-eval-widths.spec.test.ts` ✅ (completed: 2026-07-11 17:34)
- [x] 2.1.2 RED phase: verify failures; document pre-passers ✅ (completed: 2026-07-11 17:34 — 6 failed / 1 passed of 7; the sole pre-passer is the "no W10101 when the constant fits" negative, vacuous until the warning exists — load-bearing at green)

### Step 2.2: Implementation

**Reference**: 03-02 §1–§5 · AR-7
**Objective**: `typeOf` param + two's-complement helpers + the new folds.

- [x] 2.2.1 `ConstTypeLookup` param + `toBits`/`fromBits` + bitwise/shift/cast folds — `packages/frontend/src/semantics/const-eval.ts` ✅ (completed: 2026-07-11 17:44 — toBits/fromBits exported as the ONE wrap definition; typing's W10101/W10161 reuse them)
- [x] 2.2.2 Comparison/logical(lazy)/ternary(selected-arm) folds + failure propagation — `const-eval.ts` ✅ (completed: 2026-07-11 17:44)
- [x] 2.2.3 Thread `typeOf` through `checkConstRange` + the module-const evaluator; the W10161 + W10101 emission points land here, consuming the width folds — `expression-typing.ts`, `statement-typing.ts` ✅ (completed: 2026-07-11 17:44 — checkConstRange/checkIntermediateOverflow/W10174-amount/module-const evaluation all pass `(e) => ctx.typeMap.get(e)`; W10101 emitted by `warnNarrowingCastTruncation` in typeCast, 16→8-bit const-operand shapes only)
- [x] 2.2.4 GREEN phase: ST-17…ST-22 pass (incl. ST-18's W10101 case) ✅ (completed: 2026-07-11 17:44 — 7/7 green; full frontend 624 green, no regressions)

### Step 2.3: Implementation tests & hardening

- [x] 2.3.1 Impl tests: bit-helper boundaries, lazy folds, 16 cast pairs — `const-eval-widths.impl.test.ts` (07 impl table) ✅ (completed: 2026-07-11 17:48 — 33 tests: toBits/fromBits ±0/0x7F/0x80/0xFF/0x8000/0xFFFF boundaries, negative-operand bitwise, ~ at operand width, << overflow-out, signed >> arithmetic fill + saturation, lazy &&/||/ternary (divByZero in the unevaluated side does NOT surface), all 16 cast pairs, named-target nonConst)
- [x] 2.3.2 Full verify ✅ (completed: 2026-07-11 17:48 — install+build+typecheck+lint+test ALL GREEN; `spec/` clean; doc-standard self-check clean)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 3: Synthetic slots + IL lowering (frontend adapter + codegen)

### Step 3.1: Specification tests

**Reference**: 07 ST-23…ST-27 · 03-03 · AR-2/5/6/8/9
**Objective**: pin the IL shapes (slots, coercions, comparison operand type, guards).

- [ ] 3.1.1 Write lowering spec tests (ST-23…ST-27) — `packages/codegen/src/il/lower-expressions.spec.test.ts`
- [ ] 3.1.2 RED phase: verify failures; document pre-passers

### Step 3.2: Implementation

**Reference**: 03-03 §1–§10 · AR-2, AR-6, AR-8, AR-9
**Objective**: adapter slots + every new lowering arm.

- [ ] 3.2.1 Synthetic `0sc<N>` slot collection (preorder walk; per-function + `__init` pseudo-`FunctionInfo`) — `packages/frontend/src/sfa/model-adapter.ts`
- [ ] 3.2.2 `coerce` helper (zext/sext/trunc quadrants) + binary-operand/assign/arg/ret/arm call sites — `packages/codegen/src/il/lower.ts`
- [ ] 3.2.3 Comparison operand-type stamping at ALL THREE emission sites (`lowerBinary`; the for-loop predicate `compareCounter` — stamp `counterType`; the switch dispatch `eq` chain — stamp the discriminant type) + signed div/mod loud ICE; refresh the comparison-shape doc comments (`instruction.ts` comparison note, `lower.ts` `COMPARISON_RESULT_OPS` note) to state `type` = operand type — `lower.ts`, `packages/codegen/src/il/instruction.ts`
- [ ] 3.2.4 `lowerUnary` (neg/not/eq-0; `&` ICE) + `lowerCast` — `lower.ts`
- [ ] 3.2.5 `lowerShortCircuit` + `lowerConditional` (slot diamonds, `scCounter`, frame-miss + slot-size-parity ICE guard) — `lower.ts`
- [ ] 3.2.6 Compound-assignment desugar in `lowerAssign` + non-const `lo`/`hi` emitters + `__init` slot threading in `lowerInitCode` — `lower.ts`
- [ ] 3.2.7 GREEN phase: ST-23…ST-27 pass

### Step 3.3: Implementation tests & hardening

- [ ] 3.3.1 Impl tests: slot-count + slot-size parity on nested shapes, coerce quadrants, compound single-store, `__init` frame presence/absence, switch-discriminant-with-slot-site loud-ICE witness — `lower-expressions.impl.test.ts` (07 impl table)
- [ ] 3.3.2 Full verify

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 4: Translate — conversions, comparisons, shifts (codegen)

### Step 4.1: Specification tests

**Reference**: 07 translate spec row · 03-04 tables · AR-1/5/9
**Objective**: pin instruction streams for the new ops from hand-built IL.

- [ ] 4.1.1 Write translate spec tests (framing tables: neg/not/zext/sext/trunc + 4 comparison framings + shifts) — `packages/codegen/src/instr/translate-expressions.spec.test.ts`
- [ ] 4.1.2 RED phase: verify failures (deferred-op ICEs today); document pre-passers

### Step 4.2: Implementation

**Reference**: 03-04 §1–§5 · AR-1, AR-9
**Objective**: retire the deferred-op ICEs for the Slice-6 op set.

- [ ] 4.2.1 `neg`/`not` (8+16 via store-fold) + `zext`/`sext`/`trunc` — `packages/codegen/src/instr/translate.ts`
- [ ] 4.2.2 Comparison rework: dispatch on operand type; byte-signed + word-unsigned + word-signed framings (byte-unsigned byte-exact-unchanged) — `translate.ts`
- [ ] 4.2.3 Word const-count shifts + signed arithmetic `shr` + variable-count loops — `translate.ts`
- [ ] 4.2.4 Module doc header refresh (live-op list) — `translate.ts`
- [ ] 4.2.5 GREEN phase: translate spec tests pass

### Step 4.3: Implementation tests & hardening

- [ ] 4.3.1 Impl tests incl. the **DEF-1 regression witness** (word `lt`, high-byte-only difference) + sext sweep + framing boundary quads — `translate-expressions.impl.test.ts` (07 impl table)
- [ ] 4.3.2 Full verify

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 5: Acceptance — fixture, golden, ACME, VICE, negatives

**Reference**: 07 ST-28…ST-34 · 03-05 · AR-12; RD-18 AC-5

- [ ] 5.1.1 Write the fixture + shared builder — `examples/slice6/main.blend`, `packages/test-harness/src/testing/slice6.ts`
- [ ] 5.1.2 Write acceptance spec suites (ST-28/29/31/32) — `packages/test-harness/src/golden-slice6.spec.test.ts`, `slice6.spec.test.ts` (RED against missing golden documented)
- [ ] 5.1.3 Write negative/warning suite (ST-33/34, N1–N9) — `packages/test-harness/src/slice6-negatives.spec.test.ts`
- [ ] 5.1.4 **ST-30 gate**: full suite green with all prior goldens byte-exact (NO re-mint) BEFORE minting
- [ ] 5.1.5 Mint `test/golden/slice6.asm.golden` (`UPDATE_GOLDEN=1`), inspect the diff semantically (03-05 landmarks), assemble-clean via real ACME
- [ ] 5.1.6 Run the VICE suite on real VICE 3.10 (ST-32 memory table) + full verify

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 6: Rollout bookkeeping

**Reference**: RD-18 §Must-Have (AC closure + roadmap reconciliation); 01 §AC-4

- [ ] 6.1.1 Ledger rows advanced (R31/R32/R33-family notes, R40–R43, R49-extension, R50–R55) + Slice-6 banner — `codeops/_archive/rd-04-semantic-analysis/08-deferred-semantics-ledger.md`
- [ ] 6.1.2 RD-18 AC-5 ticked with the slice paragraph (+ resource-report delta noted) — `codeops/features/blend65-ri/requirements/RD-18-codegen-language-completion.md`
- [ ] 6.1.3 Feature roadmap Slice-6 narrative + portfolio cascade — `codeops/features/blend65-ri/00-roadmap.md`, `codeops/00-roadmap.md`
- [ ] 6.1.4 Memory + project CLAUDE.md refresh notes (auto-memory update; CLAUDE.md via the post-completion re-analysis hook)

---

## Dependencies

```
Phase 1 (typing)  →  Phase 2 (const-eval, needs typeMap semantics)
                  →  Phase 3 (lowering, trusts typeMap + adapter)
Phase 3           →  Phase 4 (translate consumes the new IL)
Phase 4           →  Phase 5 (acceptance)  →  Phase 6 (bookkeeping)
```

Phases run strictly in order; each ends with the full verify gate.

---

## Success Criteria

**Slice 6 is complete when:**

1. ✅ All 6 phases complete; full verify green
2. ✅ RD-18 AC-5's three-part bar GREEN (assemble-clean + golden + real VICE with the
   short-circuit suppression witness)
3. ✅ All prior goldens byte-exact, no re-mint (01 §AC-1)
4. ✅ DEF-1 regression witness in the suite (01 §AC-2)
5. ✅ No dead code; doc-standard self-check clean before every `[x]`
6. ✅ `spec/` untouched (01 §AC-3)
7. ✅ Ledger/RD/roadmaps reconciled (01 §AC-4)
8. ✅ Post-completion project re-analysis (exec_plan hook)
