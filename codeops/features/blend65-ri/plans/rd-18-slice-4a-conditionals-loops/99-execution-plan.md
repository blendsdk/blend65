# RD-18 Slice 4a — Execution Plan

> **Implements**: blend65-ri/RD-18 (Slice 4a) · **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md)
> **Gate**: `00-ambiguity-register.md` (AR-1…AR-15, ✅ PASSED 2026-07-06)
> **CodeOps Skills Version**: 3.2.0
> **Last Updated**: 2026-07-07 (Phase 1 complete)
> **Progress**: 12/35 tasks (34%)

Spec-first ordering per phase: **spec tests → verify red → implement → verify green → impl tests →
full verify**. Two-stage marks: `[~]` implemented, `[x]` verified. Commit per the active mode
(`/gitcmp`). `spec/` stays frozen (D3).

Verify command:
`yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 1 — Control-flow semantics (`03-01`)

### 1.1 Spec tests (red)
- [x] 1.1.1 `type-check/control-flow.spec.test.ts` — ST-1/2/3 (boolean-condition E10134 for if/while/do-while) via `analyze()`.
- [x] 1.1.2 Same file — ST-4/5 (break/continue loop-context E10130/E10131), ST-9/10 (for-counter in scope; nested-body typing).
- [x] 1.1.3 `for-loop.spec.test.ts` — ST-6 (end-bound E10064), ST-7 (step E10061), ST-24 (counter type E10065 — null + non-integer; AR-15).
- [x] 1.1.4 `post-check.spec.test.ts` — ST-8 (all-paths-return E10102). **Verify red** ✅ (12 positive-half tests red; `for (let i = 0 to 5)` parsed clean).

### 1.2 Implement
- [x] 1.2.1 Register `NonBooleanCondition:"E10134"`, `StepValueNotPositive:"E10061"`, `ForCounterTypeNotInteger:"E10065"`, `NotAllPathsReturn:"E10102"` in `diagnostic-codes.ts` (provenance comments; AR-7/AR-8/AR-15/AR-4); extend `diagnostic-codes.impl.test.ts` presence checks.
- [x] 1.2.2 `function-collection.ts` — recurse into control-flow bodies collecting nested `let` locals + the for-counter into the function scope (flat, AR-9); counter symbol `mutable:false`.
- [x] 1.2.3 `statement-typing.ts` — real `IfStmt`/`WhileStmt`/`DoWhileStmt` cases: `typeCondition` (E10134) + `typeBody` recursion (FR-1/FR-2).
- [x] 1.2.4 `statement-typing.ts` — `ForStmt` case: counter-type guard (**`integerRange(counterType) === null` → E10065**, covers null-annotation + non-integer; poison; AR-15), init/bound typing, end-bound range (E10064), step positivity (E10061), body typing (FR-3/FR-4).
- [x] 1.2.5 `statement-typing.ts` — loop-context (depth counter) + `BreakStmt`/`ContinueStmt` cases (E10130/E10131) (FR-5).
- [x] 1.2.6 `post-check.ts` — `checkAllPathsReturn` + `definitelyReturns` structural analysis (E10102); wire into `postCheck` (FR-6).

### 1.3 Green + impl tests
- [x] 1.3.1 **Verify green** (ST-1…ST-10); fix until green. ✅ 28 spec tests green; full frontend suite 330 green (no regression).
- [x] 1.3.2 `control-flow.impl.test.ts` + `post-check` impl — all-paths edge cases, nested-loop depth, non-const bound skip (AR-10). Targeted verify. ✅ 12 impl tests green.

---

## Phase 2 — CFG lowering (`03-02`)

### 2.1 Spec tests (red)
- [ ] 2.1.1 `il/control-flow-lowering.spec.test.ts` — ST-11 (if/else blocks + brcond), ST-12 (while back-edge), via a real-frontend `lowerRealSource` helper.
- [ ] 2.1.2 Same file — ST-13 (do-while ordering), ST-14 (for Pattern A: init/cond `le`/incr `add`), ST-15 (break/continue targets). **Verify red** (all ICE today).

### 2.2 Implement
- [ ] 2.2.1 `lower.ts` — add `loopStack` to `LowerCtx`; `lowerBlock` terminated-guard (stop on `isTerminated()`).
- [ ] 2.2.2 `lowerIf` (+ else-if nesting) and `lowerWhile` (FR-7 §2.1/§2.2).
- [ ] 2.2.3 `lowerDoWhile` and `lowerFor` (Pattern A; full-range `to <type-max>` → `iceUnsupported`, AR-6) (FR-7 §2.3/§2.4).
- [ ] 2.2.4 `lowerBreak`/`lowerContinue` (FR-8 §2.5); wire all six cases into `lowerStmt`.

### 2.3 Green + impl tests
- [ ] 2.3.1 **Verify green** (ST-11…ST-15).
- [ ] 2.3.2 `control-flow-lowering.impl.test.ts` — nested loops, `else if` chains, `downto` (ge/sub), Pattern-B guard records ICE never throws. Targeted verify.

---

## Phase 3 — Multi-block translate (`03-03`)

### 3.1 Spec tests (red)
- [ ] 3.1.1 `il/multiblock-translate.spec.test.ts` — ST-16 (if/else → labels + JMP + branch), ST-17 (while back-edge JMP), ST-18 (straight-line non-regression), via `emitAsm`. **Verify red** (br/brcond ICE today).

### 3.2 Implement
- [ ] 3.2.1 `translate.ts` — `run()` loops all `fn.blocks`, emits non-entry block labels via `blockLabel` (function-name-prefixed); **`prescanAll()` over every block + `resetBlockState()` (`clearRegs()` + `skipIndex=-1` + `leadSpan=undefined` + clear `loadSource`) at each block boundary — MANDATORY, correctness** (03-03 §1a) (FR-9 §1/§1a/§4).
- [ ] 3.2.2 `translate.ts` — `translateTerminator`: `br`→`JMP`, `brcond`→condition-load + conditional branch + `JMP` to false target, `unreachable`→no-op (FR-9 §2/§3).

### 3.3 Green + impl tests
- [ ] 3.3.1 **Verify green** (ST-16…ST-18); confirm gate/slice3a/slice3b goldens unchanged (ST-18 non-regression).
- [ ] 3.3.2 `multiblock-translate.impl.test.ts` — cross-function label uniqueness, `unreachable` no-ICE; **per-block-reset correctness (03-03 §1a): a non-entry block that reads one temp twice folds correctly (no dropped second consumer); a word-ALU immediately before a branch does not drop the next block's instruction via a stale `skipIndex`)**. Targeted verify.

---

## Phase 4 — Acceptance (3-part bar, `03-04`)

### 4.1 Fixture + spec tests (red)
- [ ] 4.1.1 `examples/slice4a/main.blend` (AR-13) + `testing/slice4a.ts` (`buildSlice4a`/`emitAsmSlice4a`).
- [ ] 4.1.2 `slice4a.spec.test.ts` (ST-19 assemble-clean + ST-21 VICE) + `golden-slice4a.spec.test.ts` (ST-20).
- [ ] 4.1.3 `slice4a-missing-return.spec.test.ts` (ST-22, E10102 via `compile()`). **Verify red/green split** (negative green once Phase 1 lands; golden pending mint).

### 4.2 Green
- [ ] 4.2.1 Mint `test/golden/slice4a.asm.golden` (`UPDATE_GOLDEN=1`); inspect loop labels + Pattern-A compare/increment + branches + `__var_Main_result`.
- [ ] 4.2.2 CI tiers green: assemble-clean (ST-19) + golden (ST-20) + negative (ST-22) + regression (ST-23, gate/slice3a/slice3b unchanged).
- [ ] 4.2.3 **VICE (local, real 3.10)** — ST-21 `$C000==$15`, `$C001==$01` on x64sc.

---

## Phase 5 — Rollout bookkeeping (`01-requirements` §4)

- [ ] 5.1.1 RD-04 deferred ledger — annotate the Ch-05 loop/conditional rows advanced by 4a (condition typing, loop-context E10130/E10131, all-paths-return, for-bound/step); note switch rows still deferred (4b).
- [ ] 5.1.2 RD-18 requirements — annotate **AC-3** "4a partial (conditionals/loops) ✅; closes at 4b (switch)"; register the four new codes (E10061/E10065/E10102/E10134) in the AR-11 provenance note.
- [ ] 5.1.3 SR-2 (resource delta: multi-block code size vs 3b; no new ZP) + SR-3 (Pattern-B / `until` / switch deferrals) closeout in this plan.
- [ ] 5.1.4 Roadmap sync (feature + portfolio cascade) → Slice 4a ✅; `git status --porcelain spec/` empty; final full verify green.

---

## Master Progress Checklist

- [x] **Phase 1** — Control-flow semantics (1.1.1–1.3.2, 12 tasks) ✅
- [ ] **Phase 2** — CFG lowering (2.1.1–2.3.2, 8 tasks)
- [ ] **Phase 3** — Multi-block translate (3.1.1–3.3.2, 5 tasks)
- [ ] **Phase 4** — Acceptance (4.1.1–4.2.3, 6 tasks)
- [ ] **Phase 5** — Bookkeeping (5.1.1–5.1.4, 4 tasks)

> Task count: **35** granular steps across 5 phases (12 + 8 + 5 + 6 + 4); the checklist is
> authoritative and updated live during exec.

## Dependencies

Phase 1 (semantics: scopes/for-counter + condition/loop-context/all-paths + new codes) unblocks
Phase 2 (lowering needs the for-counter symbol + typed conditions). Phase 2 (multi-block IL) unblocks
Phase 3 (translate consumes br/brcond). Phase 4 needs 1–3. Phase 5 after 4. No cycles. The Pattern-B
wrap, `until`, and all deferred validators (E10060/E10062/E10101) are **not** on this critical path.
