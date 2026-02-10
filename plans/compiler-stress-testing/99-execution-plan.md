# Execution Plan: Compiler Stress Testing & Bug Fixes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-10-02 23:07
> **Progress**: 31/30 tasks (100% Track A + Phase 5 complete)

## Overview

**🚨 IMPORTANT: Update this document after EACH completed task!**

This plan has two tracks that run in parallel:
- **Track A: Bug Fixes** — Fix all 6 confirmed bugs
- **Track B: Real-World E2E Tests** — Create 20 comprehensive test scenarios

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Bug 1 Fix: UsageWalker Scope Tracking | 1 | 30 min |
| 2 | Bug 2 Fix: Dynamic Address POKE/PEEK | 1-2 | 45 min |
| 3 | Bug 3 Fix: DFE After Inlining | 1 | 30 min |
| 4 | Bugs 4-6 Investigation & Fix: Assembly Correctness | 2-3 | 90 min |
| 5 | E2E Test Scenarios 1-4 (Sprite, Border, Screen, Raster) | 1-2 | 60 min |
| 6 | E2E Test Scenarios 5-8 (Animation, Sound, MemCopy, GameState) | 1-2 | 60 min |
| 7 | E2E Test Scenarios 9-12 (Scroll, Charset, Collision, MultiModule) | 1-2 | 60 min |
| 8 | E2E Test Scenarios 13-20 + Optimization Level Matrix | 2-3 | 90 min |
| 9 | Remaining plan docs (01, 03, 07) + Final verification | 1 | 30 min |

**Total: ~10-15 sessions, ~8-10 hours**

---

## Phase 1: Bug 1 Fix — UsageWalker Scope Tracking

### Session 1.1: Add scope tracking to UsageWalker

**Reference**: [02-current-state.md](02-current-state.md) — Bug 1

**Objective**: Fix false "unused variable" warnings by making UsageWalker enter/exit child scopes for all 7 scope-creating constructs.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Add scope-tracking state (`currentScope`, `enterChildScope`, `exitScope`) to UsageWalker | `semantic/analysis/advanced-analyzer.ts` |
| 1.1.2 | Override `visitForStatement` to enter loop scope before walking body | `semantic/analysis/advanced-analyzer.ts` |
| 1.1.3 | Override `visitWhileStatement`, `visitDoWhileStatement` for loop scopes | `semantic/analysis/advanced-analyzer.ts` |
| 1.1.4 | Override `visitIfStatement` for then/else branch scopes | `semantic/analysis/advanced-analyzer.ts` |
| 1.1.5 | Override `visitBlockStatement` for block scopes | `semantic/analysis/advanced-analyzer.ts` |
| 1.1.6 | Run existing tests to verify no regressions | `./compiler-test semantic` |

**Deliverables**:
- [ ] UsageWalker correctly enters/exits scopes for all 7 constructs
- [ ] All existing semantic tests pass
- [ ] No false "unused variable" warnings for for-loop variables used in body

**Verify**: `./compiler-test semantic`

---

## Phase 2: Bug 2 Fix — Dynamic Address POKE/PEEK

### Session 2.1: IL Generator dynamic address handling

**Reference**: [02-current-state.md](02-current-state.md) — Bug 2

**Objective**: Make IL generator emit proper operands for dynamic-address poke/peek, and codegen handle them.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Analyze current `generatePokeIntrinsic` dynamic path — understand what IL should be emitted | `il/generator/expressions.ts` |
| 2.1.2 | Fix IL generator to emit POKE with stack-based or slot-based operands for dynamic addresses | `il/generator/expressions.ts` |
| 2.1.3 | Fix codegen `genPoke`/`genPeek` to handle dynamic-address operand patterns | `codegen/generator/intrinsics.ts` |
| 2.1.4 | Fix `genPokew`/`genPeekw` similarly | `codegen/generator/intrinsics.ts` |
| 2.1.5 | Run tests | `./compiler-test il codegen` |

**Deliverables**:
- [ ] `poke(baseAddr + variable, value)` compiles without crash
- [ ] `peek(baseAddr + variable)` compiles without crash
- [ ] Assembly output contains correct indexed addressing (STA base,X or indirect)
- [ ] All existing tests pass

**Verify**: `./compiler-test il codegen e2e`

---

## Phase 3: Bug 3 Fix — DFE After Inlining

### Session 3.1: Post-inlining dead function cleanup

**Reference**: [02-current-state.md](02-current-state.md) — Bug 3

**Objective**: Ensure fully-inlined functions are removed from the program.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Option A: Have inlining pass remove fully-inlined non-exported functions after all inlines complete | `optimizer/passes/function-inlining.ts` |
| 3.1.2 | OR Option B: Add `dead-function-elim` after `function-inline` in pass lists | `optimizer/options.ts` |
| 3.1.3 | Run optimizer tests | `./compiler-test optimizer` |

**Deliverables**:
- [ ] At -O3, inlined functions no longer appear in assembly output
- [ ] Non-inlined and exported functions still appear correctly
- [ ] All optimizer tests pass

**Verify**: `./compiler-test optimizer e2e`

---

## Phase 4: Bugs 4-6 Investigation & Fix — Assembly Correctness

### Session 4.1: Investigate root cause of assembly corruption

**Objective**: Deep-dive into why `color += 1` is missing, `color = 0` stores wrong value, and inlined loop counters don't re-init.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Create debug script that compiles border-cycle at O0 and dumps IL + assembly | `scripts/debug-border-cycle-o0.ts` |
| 4.1.2 | Create debug script that compiles border-cycle at O3 and dumps IL + assembly | `scripts/debug-border-cycle-o3.ts` |
| 4.1.3 | Compare O0 vs O3 IL to identify which optimizer pass removes/corrupts instructions | analysis |
| 4.1.4 | Identify whether Bug 4 (missing `+=`) is codegen or optimizer issue | analysis |
| 4.1.5 | Identify whether Bug 5 (wrong literal store) is codegen or optimizer issue | analysis |
| 4.1.6 | Identify whether Bug 6 (re-init) is inlining or LICM issue | analysis |

### Session 4.2: Fix assembly correctness bugs

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.2.1 | Fix Bug 4: compound assignment codegen/optimization | TBD after investigation |
| 4.2.2 | Fix Bug 5: literal assignment codegen/optimization | TBD after investigation |
| 4.2.3 | Fix Bug 6: inlined loop re-initialization | TBD after investigation |
| 4.2.4 | Verify border-cycle compiles correctly at O0, O1, O2, O3 | manual verification |
| 4.2.5 | Run full test suite | `./compiler-test` |

**Deliverables**:
- [ ] `color += 1` generates INC or ADC instruction at all optimization levels
- [ ] `color = 0` generates `LDA #$00; STA slot` at all levels
- [ ] Inlined loop counters re-initialize on every iteration
- [ ] Border-cycle produces correct assembly at O0, O1, O2, O3
- [ ] All tests pass

**Verify**: `./compiler-test`

---

## Phase 5: E2E Test Scenarios 1-4

### Session 5.1: Implement test scenarios 1-4

**Reference**: [04-test-scenarios.md](04-test-scenarios.md) — Scenarios 1-4

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Create E2E test file for real-world stress tests | `__tests__/e2e/pipeline/real-world-stress.test.ts` |
| 5.1.2 | Implement Scenario 1: Sprite Loader (all verifications) | test file |
| 5.1.3 | Implement Scenario 2: Border Color Cycling (all verifications, multi-opt-level) | test file |
| 5.1.4 | Implement Scenario 3: Screen Fill (all verifications) | test file |
| 5.1.5 | Implement Scenario 4: Raster Bars (all verifications) | test file |
| 5.1.6 | Run tests | `./compiler-test e2e` |

**Deliverables**:
- [ ] 4 real-world scenarios with full pipeline verification
- [ ] Assembly output checked for correctness patterns
- [ ] Tests at O0 and O3 minimum
- [ ] All tests pass

---

## Phase 6: E2E Test Scenarios 5-8

### Session 6.1: Implement test scenarios 5-8

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.1.1 | Implement Scenario 5: Multi-Sprite Animation | test file |
| 6.1.2 | Implement Scenario 6: Sound Effect Player | test file |
| 6.1.3 | Implement Scenario 7: Memory Copy Utility | test file |
| 6.1.4 | Implement Scenario 8: Game State Machine | test file |
| 6.1.5 | Run tests | `./compiler-test e2e` |

---

## Phase 7: E2E Test Scenarios 9-12

### Session 7.1: Implement test scenarios 9-12

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.1.1 | Implement Scenario 9: Scrolling Text | test file |
| 7.1.2 | Implement Scenario 10: Character Set Animation | test file |
| 7.1.3 | Implement Scenario 11: Collision Detection | test file |
| 7.1.4 | Implement Scenario 12: Multi-Module Game | test file |
| 7.1.5 | Run tests | `./compiler-test e2e` |

---

## Phase 8: E2E Test Scenarios 13-20

### Session 8.1: Write and implement remaining scenarios

**Tasks**:
| # | Task | File |
|---|------|------|
| 8.1.1 | Write full source for Scenarios 13-16 in 04-test-scenarios.md | plan doc |
| 8.1.2 | Implement Scenarios 13-16 as tests | test file |
| 8.1.3 | Write full source for Scenarios 17-20 in 04-test-scenarios.md | plan doc |
| 8.1.4 | Implement Scenarios 17-20 as tests | test file |
| 8.1.5 | Run full test suite | `./compiler-test` |

---

## Phase 9: Documentation & Final Verification

### Session 9.1: Complete remaining plan documents

**Tasks**:
| # | Task | File |
|---|------|------|
| 9.1.1 | Create 01-requirements.md | plan doc |
| 9.1.2 | Create 03-bug-fixes.md with final fix details | plan doc |
| 9.1.3 | Create 07-testing-strategy.md | plan doc |
| 9.1.4 | Run complete test suite and verify 0 failures | `./compiler-test` |
| 9.1.5 | Update PROJECT_STATUS.md with results | root doc |

---

## Task Checklist (All Phases)

### Phase 1: UsageWalker Scope Fix
- [x] 1.1.1 Add scope-tracking state to UsageWalker ✅ (completed: 2025-10-02 14:43)
- [x] 1.1.2 Override visitForStatement for loop scope ✅ (completed: 2025-10-02 14:45)
- [x] 1.1.3 Override visitWhileStatement, visitDoWhileStatement ✅ (completed: 2025-10-02 14:45)
- [x] 1.1.4 Override visitIfStatement for then/else scopes ✅ (completed: 2025-10-02 14:45)
- [x] 1.1.5 Override visitBlockStatement ✅ (completed: 2025-10-02 14:45)
- [x] 1.1.6 Run semantic tests ✅ (completed: 2025-10-02 14:47 — 2644 pass, 0 fail)

### Phase 2: Dynamic Address POKE/PEEK
- [x] 2.1.1 Analyze current dynamic address IL emission ✅ (completed: 2025-10-02 17:30)
- [x] 2.1.2 Fix IL generator for dynamic addresses ✅ (completed: 2025-10-02 17:45 — added tryDecomposeIndexedAddress + indexed addressing)
- [x] 2.1.3 Fix codegen genPoke/genPeek ✅ (completed: 2025-10-02 18:00 — updated getAddressMode for indexRegister)
- [x] 2.1.4 Fix codegen genPokew/genPeekw ✅ (completed: 2025-10-02 18:00 — type assertions for LDA/STA modes)
- [x] 2.1.5 Run IL + codegen tests ✅ (completed: 2025-10-02 19:30 — 8322 pass, 0 fail)

### Phase 3: DFE After Inlining
- [x] 3.1.1 Implement post-inlining dead function removal ✅ (completed: 2025-10-02 15:25 — Option B: added post-inline DFE pass in options.ts)
- [x] 3.1.2 Updated tests for new pass counts ✅ (completed: 2025-10-02 15:26)
- [x] 3.1.3 Run optimizer tests ✅ (completed: 2025-10-02 15:27 — 1433 pass, 0 fail)

### Phase 4: Assembly Correctness (Bugs 4-6)
- [x] 4.1.1 Debug script: border-cycle at O0 ✅ (completed: 2025-10-02 20:15 — created debug-border-cycle-o0-vs-o3.ts)
- [x] 4.1.2 Debug script: border-cycle at O3 ✅ (completed: 2025-10-02 20:15 — combined O0+O3 in single script)
- [x] 4.1.3 Compare O0 vs O3 IL ✅ (completed: 2025-10-02 20:30 — identified LICM hoisting as root cause)
- [x] 4.1.4 Root cause Bug 4 (missing +=) ✅ (completed: 2025-10-02 21:40 — LICM hoisted ADD_IMM out of loop)
- [x] 4.1.5 Root cause Bug 5 (wrong literal store) ✅ (completed: 2025-10-02 21:35 — LICM hoisted LOAD_IMM out of loop)
- [x] 4.1.6 Root cause Bug 6 (re-init) ✅ (completed: 2025-10-02 21:35 — LICM hoisted LOAD_IMM for loop init)
- [x] 4.2.1 Fix Bug 4 ✅ (completed: 2025-10-02 21:40 — excluded accumulator-only instructions from LICM hoisting)
- [x] 4.2.2 Fix Bug 5 ✅ (completed: 2025-10-02 21:36 — added hasNoExplicitSlotReads check in isInvariant)
- [x] 4.2.3 Fix Bug 6 ✅ (completed: 2025-10-02 21:36 — same fix as Bug 5)
- [x] 4.2.4 Verify border-cycle at all opt levels ✅ (completed: 2025-10-02 21:41 — O3 IL now matches O0 structure)
- [x] 4.2.5 Run full test suite ✅ (completed: 2025-10-02 21:52 — 8322 pass, 0 fail)

### Phase 5: E2E Tests 1-4
- [x] 5.1.1 Create real-world-stress.test.ts ✅ (completed: 2025-10-02 22:55)
- [x] 5.1.2 Scenario 1: Sprite Loader ✅ (completed: 2025-10-02 22:55)
- [x] 5.1.3 Scenario 2: Border Color Cycling ✅ (completed: 2025-10-02 22:55)
- [x] 5.1.4 Scenario 3: Screen Fill ✅ (completed: 2025-10-02 23:00)
- [x] 5.1.5 Scenario 4: Raster Bars ✅ (completed: 2025-10-02 22:55)
- [x] 5.1.6 Run E2E tests ✅ (completed: 2025-10-02 23:07 — 8365 pass, 0 fail)

### Phase 6: E2E Tests 5-8
- [ ] 6.1.1 Scenario 5: Multi-Sprite Animation
- [ ] 6.1.2 Scenario 6: Sound Effect Player
- [ ] 6.1.3 Scenario 7: Memory Copy Utility
- [ ] 6.1.4 Scenario 8: Game State Machine
- [ ] 6.1.5 Run E2E tests

### Phase 7: E2E Tests 9-12
- [ ] 7.1.1 Scenario 9: Scrolling Text
- [ ] 7.1.2 Scenario 10: Character Set Animation
- [ ] 7.1.3 Scenario 11: Collision Detection
- [ ] 7.1.4 Scenario 12: Multi-Module Game
- [ ] 7.1.5 Run E2E tests

### Phase 8: E2E Tests 13-20
- [ ] 8.1.1 Write Scenarios 13-16
- [ ] 8.1.2 Implement Scenarios 13-16
- [ ] 8.1.3 Write Scenarios 17-20
- [ ] 8.1.4 Implement Scenarios 17-20
- [ ] 8.1.5 Run full test suite

### Phase 9: Documentation & Final
- [ ] 9.1.1 Create 01-requirements.md
- [ ] 9.1.2 Create 03-bug-fixes.md
- [ ] 9.1.3 Create 07-testing-strategy.md
- [ ] 9.1.4 Full test suite verification
- [ ] 9.1.5 Update PROJECT_STATUS.md

---

## Session Protocol

### Starting a Session
```bash
clear && scripts/agent.sh start
# Reference: "Implement Phase X, Session X.X per plans/compiler-stress-testing/99-execution-plan.md"
```

### Ending a Session
```bash
./compiler-test
clear && scripts/agent.sh finished
# Call attempt_completion
# User runs /compact
```

---

## Dependencies

```
Phase 1 (Bug 1: UsageWalker)
    ↓
Phase 2 (Bug 2: Dynamic POKE)    ← Can run parallel with Phase 1
    ↓
Phase 3 (Bug 3: DFE)             ← Can run parallel with Phases 1-2
    ↓
Phase 4 (Bugs 4-6: Assembly)     ← May depend on Phase 3 findings
    ↓
Phase 5-8 (E2E Tests)            ← Depend on bug fixes (will reveal if fixes work)
    ↓
Phase 9 (Documentation)          ← Final cleanup
```

---

## Success Criteria

**Plan is complete when:**
1. ✅ All 6 confirmed bugs fixed
2. ✅ 20 real-world E2E test scenarios implemented
3. ✅ Every scenario tested at O0, O1, O2, O3 minimum
4. ✅ Assembly output verified for correctness patterns
5. ✅ Full test suite passes with 0 failures
6. ✅ sprite-test.blend and border-cycle compile correctly
7. ✅ All 10 bug classes have test coverage
