# Execution Plan: Compiler-Wide Optimization Initiative

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-16 16:14
> **Progress**: 4/24 tasks (17%)

## Overview

**🚨 IMPORTANT: Update this document after EACH completed task!**

Implementation is organized by compiler stage (bottom-up) so each phase is independently testable. The order ensures foundational improvements benefit all subsequent optimizations.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Codegen Quality (Theme CG) | 1-2 | 1-2 hours |
| 2 | IL Peephole: Store/Reload & Modulo (Themes F, C) | 2-3 | 2-3 hours |
| 3 | IL Peephole: Address Expression Folding (Theme A) | 1-2 | 1-2 hours |
| 4 | ASM Optimizer: Register Promotion (Theme H) | 1-2 | 1-2 hours |
| 5 | Test Programs & Verification | 1-2 | 1-2 hours |
| 6 | Should-Have Optimizations (Themes G, J) | 1-2 | 1-2 hours |

**Total: 7-13 sessions, ~7-13 hours**

---

## Phase 1: Codegen Quality (Theme CG)

**Reference**: [03-codegen-quality.md](03-codegen-quality.md)
**Applies to**: ALL optimization levels (O0-Oz)

### Session 1.1: SHR_WORD Codegen Improvement

**Objective**: Improve `genShrWord()` to use smarter strategies based on shift count.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Read and analyze current `genShrWord()` implementation | `codegen/generator/bitwise.ts` |
| 1.1.2 | Implement shift≥8 optimization (TXA + remaining LSRs) | `codegen/generator/bitwise.ts` |
| 1.1.3 | Add unit tests for SHR_WORD shift counts 1, 6, 8, 10, 15 | `__tests__/codegen/` |
| 1.1.4 | Run `./compiler-test` — verify zero regressions | — |

**Verify**: `./compiler-test`

---

## Phase 2: IL Peephole — Store/Reload & Modulo (Themes F, C)

**Reference**: [06-inliner.md](06-inliner.md), [04-il-optimizer.md](04-il-optimizer.md)
**Applies to**: O1+ optimization levels

### Session 2.1: Store/Reload Elimination for Word Params (Theme F)

**Objective**: Extend IL peephole to eliminate STORE_WORD→LOAD_WORD pairs created by inlining.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Analyze current `loadStoreElimination()` — check if WORD variant handled | `optimizer/passes/il-peephole.ts` |
| 2.1.2 | Add STORE_WORD→LOAD_WORD elimination pattern | `optimizer/passes/il-peephole.ts` |
| 2.1.3 | Add unit tests for word store/reload elimination | `__tests__/optimizer/` |
| 2.1.4 | Run `./compiler-test` — verify zero regressions | — |

**Verify**: `./compiler-test`

### Session 2.2: Investigate ASM-Level Store/Load Gap (Theme F continued)

**Objective**: Understand why `StoreLoadPass` misses the STA $07/STX $08/LDA $07/LDX $08 pattern.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.2.1 | Read `StoreLoadPass.isRedundantLoad()` — understand detection logic | `codegen/asm-il/optimizer/passes/store-load.ts` |
| 2.2.2 | Determine if STX between STA/LDA breaks the pattern | Same file |
| 2.2.3 | Fix or extend the pass to handle interleaved STA/STX pairs | Same file |
| 2.2.4 | Add unit tests for word-param store/load pattern | `__tests__/asm-il/` |
| 2.2.5 | Run `./compiler-test` — verify zero regressions | — |

**Verify**: `./compiler-test`

### Session 2.3: Power-of-2 Modulo → AND Bitmask (Theme C)

**Objective**: Add modulo-to-bitmask pattern to IL peephole.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.3.1 | Implement `moduloToBitmask()` pattern detection | `optimizer/passes/il-peephole.ts` |
| 2.3.2 | Add positive tests (mod 2, 4, 8, 16 → AND) | `__tests__/optimizer/` |
| 2.3.3 | Add negative test (mod 5 → NOT optimized) | `__tests__/optimizer/` |
| 2.3.4 | Run `./compiler-test` — verify zero regressions | — |

**Verify**: `./compiler-test`

---

## Phase 3: IL Peephole — Address Expression Folding (Theme A)

**Reference**: [04-il-optimizer.md](04-il-optimizer.md)
**Applies to**: O1+ optimization levels

### Session 3.1: Label Arithmetic Folding Post-Inlining

**Objective**: Detect LOAD_ADDRESS→SHR_WORD pattern in IL and fold to LOAD_ADDRESS_EXPR.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Analyze IL output of spinning-line at O3 (post-inlining) | Debug script |
| 3.1.2 | Implement `addressExprFolding()` in IL peephole | `optimizer/passes/il-peephole.ts` |
| 3.1.3 | Handle STORE_WORD/LOAD_WORD gap between LOAD_ADDRESS and SHR_WORD | Same file |
| 3.1.4 | Add unit tests for label arithmetic folding | `__tests__/optimizer/` |
| 3.1.5 | Run `./compiler-test` and `diag_app spinning-line` | — |

**Verify**: `./compiler-test` + `diag_app`

---

## Phase 4: ASM Optimizer — Register Promotion (Theme H)

**Reference**: [05-asm-optimizer.md](05-asm-optimizer.md)
**Applies to**: O1+ optimization levels

### Session 4.1: Investigate RegisterPromotePass

**Objective**: Determine why RegisterPromotePass isn't converting for-loop counters.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Read RegisterPromotePass implementation thoroughly | `codegen/asm-il/optimizer/passes/register-promote.ts` |
| 4.1.2 | Check if barrier() blocks loop body analysis | Same file |
| 4.1.3 | Check count-up vs count-down detection | Same file |
| 4.1.4 | Implement fix based on findings | Same file |
| 4.1.5 | Add tests for promoted for-loops | `__tests__/asm-il/` |
| 4.1.6 | Run `./compiler-test` — verify zero regressions | — |

**Verify**: `./compiler-test`

---

## Phase 5: Test Programs & Verification

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

### Session 5.1: Create New Test Programs

**Objective**: Create targeted example programs that stress-test each optimization theme.

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.1.1 | Create `examples/counter-wrap/main.blend` (Theme C) | New file |
| 5.1.2 | Create `examples/loop-patterns/main.blend` (Theme H) | New file |
| 5.1.3 | Create `examples/multi-sprite/main.blend` (Themes A, C, F) | New file |
| 5.1.4 | Run `diag_app` on each new example — verify all 6 levels pass | — |
| 5.1.5 | Run `diag_app` on spinning-line and balloon-sprite — final verification | — |

**Verify**: `diag_app` clean reports on all examples

---

## Phase 6: Should-Have Optimizations (Themes G, J)

**Reference**: [04-il-optimizer.md](04-il-optimizer.md)

### Session 6.1: SHR_WORD + LO Narrowing (Theme G)

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.1.1 | Implement SHR_WORD+LO detection in IL peephole | `optimizer/passes/il-peephole.ts` |
| 6.1.2 | For N≥8, replace with HI + SHR_BYTE (N-8) | Same file |
| 6.1.3 | Add unit tests | `__tests__/optimizer/` |

### Session 6.2: Constant Prop Investigation (Theme J)

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.2.1 | Check pass ordering — ensure ConstProp runs after Inlining | `optimizer/pass-manager.ts` |
| 6.2.2 | If ordering is wrong, fix it; if correct, investigate why pattern missed | Various |
| 6.2.3 | Add test for const prop through inlined args | `__tests__/optimizer/` |

---

## Task Checklist (All Phases)

### Phase 1: Codegen Quality
- [x] 1.1.1 Read and analyze current genShrWord() ✅ (completed: 2026-02-16 16:08)
- [x] 1.1.2 Implement shift≥8 optimization ✅ (completed: 2026-02-16 16:09)
- [x] 1.1.3 Add unit tests for SHR_WORD ✅ (completed: 2026-02-16 16:12)
- [x] 1.1.4 Run compiler-test — zero regressions ✅ (completed: 2026-02-16 16:14 — 9047 pass, 0 fail)

### Phase 2: IL Peephole — Store/Reload & Modulo
- [ ] 2.1.1 Analyze loadStoreElimination() for word support
- [ ] 2.1.2 Add STORE_WORD→LOAD_WORD elimination
- [ ] 2.1.3 Add unit tests for word store/reload
- [ ] 2.1.4 Run compiler-test — zero regressions
- [ ] 2.2.1 Read StoreLoadPass detection logic
- [ ] 2.2.2 Determine if STX breaks STA/LDA pattern
- [ ] 2.2.3 Fix or extend store-load pass
- [ ] 2.2.4 Add unit tests for word-param store/load
- [ ] 2.2.5 Run compiler-test — zero regressions
- [ ] 2.3.1 Implement moduloToBitmask()
- [ ] 2.3.2 Add positive tests (mod 2, 4, 8, 16)
- [ ] 2.3.3 Add negative test (mod 5)
- [ ] 2.3.4 Run compiler-test — zero regressions

### Phase 3: Address Expression Folding
- [ ] 3.1.1 Analyze IL output of spinning-line post-inlining
- [ ] 3.1.2 Implement addressExprFolding()
- [ ] 3.1.3 Handle STORE_WORD/LOAD_WORD gap
- [ ] 3.1.4 Add unit tests
- [ ] 3.1.5 Run compiler-test + diag_app

### Phase 4: ASM Register Promotion
- [ ] 4.1.1 Read RegisterPromotePass implementation
- [ ] 4.1.2 Check barrier() impact
- [ ] 4.1.3 Check count-up vs count-down
- [ ] 4.1.4 Implement fix
- [ ] 4.1.5 Add tests
- [ ] 4.1.6 Run compiler-test — zero regressions

### Phase 5: Test Programs
- [ ] 5.1.1 Create counter-wrap example
- [ ] 5.1.2 Create loop-patterns example
- [ ] 5.1.3 Create multi-sprite example
- [ ] 5.1.4 Run diag_app on new examples
- [ ] 5.1.5 Final verification on spinning-line + balloon-sprite

### Phase 6: Should-Have
- [ ] 6.1.1 Implement SHR_WORD+LO narrowing
- [ ] 6.1.2 Replace with HI+SHR_BYTE for N≥8
- [ ] 6.1.3 Add unit tests
- [ ] 6.2.1 Check pass ordering
- [ ] 6.2.2 Fix or investigate
- [ ] 6.2.3 Add tests

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/compiler-wide-optimizations/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Dependencies

```
Phase 1 (Codegen)
    ↓
Phase 2 (IL Store/Reload + Modulo)
    ↓
Phase 3 (Address Folding) — depends on Phase 2 (store/reload fix)
    ↓
Phase 4 (ASM Register Promotion) — independent, can run in parallel with 2-3
    ↓
Phase 5 (Test Programs) — depends on all above
    ↓
Phase 6 (Should-Have) — bonus improvements
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed (at minimum Phases 1-5)
2. ✅ All 6500+ existing tests passing
3. ✅ `diag_app` clean on spinning-line and balloon-sprite
4. ✅ New test programs compile at all 6 optimization levels
5. ✅ Assembly output shows measurable improvement at O1+
6. ✅ No regressions at O0 (debug builds unchanged except SHR_WORD quality)
