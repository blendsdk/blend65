# Execution Plan: IL Generator ↔ Codegen Operand Fixes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-14 13:36
> **Progress**: 14/14 Phase 1-3 tasks (100% — Phase 4 remaining)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|---|---|---|---|
| 1 | IL Infrastructure (enums + builder) | 1 | 15 min |
| 2 | Codegen Handlers (DIV_IMM + MOD_IMM) | 1 | 15 min |
| 3 | IL Generator Fixes (expressions.ts) | 1 | 25 min |
| 4 | Tests + Verification | 1 | 25 min |

**Total: 4 sessions, ~1.5 hours**

---

## Phase 1: IL Infrastructure

### Session 1.1: Add DIV_IMM/MOD_IMM to IL Layer

**Reference**: [03-il-generator-fixes.md](03-il-generator-fixes.md) — Fix A

**Objective**: Add new IL opcodes and builder methods for divide/modulo with immediates

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Run baseline test suite — capture pass count | (terminal) |
| 1.1.2 | Add `DIV_IMM` and `MOD_IMM` to IL enums | `il/enums.ts` |
| 1.1.3 | Add `divImm()` and `modImm()` to IL builder | `il/builder/arithmetic.ts` |
| 1.1.4 | Add cost metadata for new opcodes in builder base | `il/builder/base.ts` |
| 1.1.5 | Add new opcodes to IL guards if needed | `il/guards.ts` |
| 1.1.6 | Run tests — verify zero regression | (terminal) |

**Deliverables**:
- [ ] Two new IL opcodes (DIV_IMM, MOD_IMM)
- [ ] Two new builder methods (divImm, modImm)
- [ ] All existing tests still passing

**Verify**: `./compiler-test il`

---

## Phase 2: Codegen Handlers

### Session 2.1: Add Codegen for DIV_IMM and MOD_IMM

**Reference**: [03-il-generator-fixes.md](03-il-generator-fixes.md) — Fix A (codegen section)

**Objective**: Add codegen handlers that translate DIV_IMM/MOD_IMM to 6502 assembly

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Add `genDivImm()` handler method | `codegen/generator/arithmetic.ts` |
| 2.1.2 | Add `genModImm()` handler method | `codegen/generator/arithmetic.ts` |
| 2.1.3 | Add dispatch cases for DIV_IMM/MOD_IMM in `generateInstruction()` | `codegen/generator/arithmetic.ts` |
| 2.1.4 | Run tests — verify zero regression | (terminal) |

**Deliverables**:
- [ ] DIV_IMM codegen generates: STA $FE / LDA #val / STA $FF / LDA $FE / JSR __div8
- [ ] MOD_IMM codegen generates: STA $FE / LDA #val / STA $FF / LDA $FE / JSR __mod8
- [ ] All existing tests still passing

**Verify**: `./compiler-test codegen`

---

## Phase 3: IL Generator Expression Fixes

### Session 3.1: Fix All Expression Paths

**Reference**: [03-il-generator-fixes.md](03-il-generator-fixes.md) — Fixes A, B, C + [04-compound-assignment-fixes.md](04-compound-assignment-fixes.md) — Fixes D, E

**Objective**: Fix all broken code paths in expressions.ts

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add `createZpTempSlot()` helper method | `il/generator/expressions.ts` |
| 3.1.2 | Add DIVIDE and MODULO cases in `generateBinaryImmediate()` | `il/generator/expressions.ts` |
| 3.1.3 | Add LEFT_SHIFT and RIGHT_SHIFT cases in `generateBinaryImmediate()` | `il/generator/expressions.ts` |
| 3.1.4 | Add LEFT_SHIFT and RIGHT_SHIFT cases in `generateBinarySlot()` | `il/generator/expressions.ts` |
| 3.1.5 | Rewrite `generateBinaryComplexOp()` to use ZP temp slot | `il/generator/expressions.ts` |
| 3.1.6 | Add missing compound assignment literal cases (Fix D) | `il/generator/expressions.ts` |
| 3.1.7 | Rewrite `generateCompoundOperation()` with ZP temp slot (Fix E) | `il/generator/expressions.ts` |
| 3.1.8 | Run full test suite — verify zero regression | (terminal) |

**Deliverables**:
- [ ] `i % 3` and `i / 3` compile without crash
- [ ] `x << 1` and `x >> 2` generate correct shift IL
- [ ] `a + (b * c)` compiles without crash
- [ ] `x *= 2`, `x /= 3`, `x %= 5` generate correct IL
- [ ] All existing tests still passing

**Verify**: `./compiler-test`

---

## Phase 4: Tests and Final Verification

### Session 4.1: Write Tests and Verify sprite-test.blend

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Add comprehensive tests and verify the original trigger program

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Create E2E test file for binary operand fixes | `__tests__/e2e/pipeline/binary-operand-fixes.test.ts` |
| 4.1.2 | Add E2E tests: modulo/divide with literal compiles | (same file) |
| 4.1.3 | Add E2E tests: shift operators compile correctly | (same file) |
| 4.1.4 | Add E2E tests: complex right operand compiles | (same file) |
| 4.1.5 | Add E2E tests: compound assignments compile | (same file) |
| 4.1.6 | Add E2E test: sprite-test.blend compiles at O0 and O3 | (same file) |
| 4.1.7 | Run full test suite — ALL tests pass | (terminal) |
| 4.1.8 | Verify sprite-test.blend with CLI | (terminal) |

**Deliverables**:
- [ ] New E2E test file with 10+ test cases
- [ ] All 6500+ existing tests passing
- [ ] All new tests passing
- [ ] sprite-test.blend compiles at O0 and O3

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: IL Infrastructure
- [x] 1.1.1 Run baseline test suite ✅ (8766 pass, 0 fail)
- [x] 1.1.2 Add DIV_IMM/MOD_IMM enums ✅
- [x] 1.1.3 Add divImm()/modImm() builder methods ✅
- [x] 1.1.4 Add cost metadata for new opcodes ✅
- [x] 1.1.5 Update IL guards ✅
- [x] 1.1.6 Verify zero regression ✅ (8766 pass, 0 fail)

### Phase 2: Codegen Handlers
- [x] 2.1.1 Add genDivImm() handler ✅
- [x] 2.1.2 Add genModImm() handler ✅
- [x] 2.1.3 Add dispatch cases ✅
- [x] 2.1.4 Verify zero regression ✅ (2477 codegen pass, 0 fail)

### Phase 3: IL Generator Expression Fixes
- [x] 3.1.1 Add createZpTempSlot() helper ✅
- [x] 3.1.2 Add DIVIDE/MODULO immediate cases ✅
- [x] 3.1.3 Add LEFT_SHIFT/RIGHT_SHIFT immediate cases ✅
- [x] 3.1.4 LEFT_SHIFT/RIGHT_SHIFT slot cases (handled by default fallback) ✅
- [x] 3.1.5 Rewrite generateBinaryComplexOp() with ZP temp ✅
- [x] 3.1.6 Add compound assignment literal cases ✅
- [x] 3.1.7 Rewrite generateCompoundOperation() with ZP temp ✅
- [x] 3.1.8 Verify zero regression ✅ (8766 pass, 0 fail)

### Phase 4: Tests + Verification
- [ ] 4.1.1 Create E2E test file
- [ ] 4.1.2 Add modulo/divide E2E tests
- [ ] 4.1.3 Add shift E2E tests
- [ ] 4.1.4 Add complex operand E2E tests
- [ ] 4.1.5 Add compound assignment E2E tests
- [ ] 4.1.6 Add sprite-test.blend E2E test
- [ ] 4.1.7 Run full test suite
- [ ] 4.1.8 Verify sprite-test.blend with CLI

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/il-codegen-operand-fixes/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. If tests pass, commit changes
git add .
git commit -m "fix(il-gen): [description]"

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Call attempt_completion
# 5. User runs /compact
```

---

## Dependencies

```
Phase 1: IL Infrastructure (enums + builder)
    ↓
Phase 2: Codegen Handlers (needs new opcodes)
    ↓
Phase 3: IL Generator Fixes (needs builder + codegen)
    ↓
Phase 4: Tests + Verification (needs all fixes)
```

---

## Success Criteria

**Feature is complete when**:
1. ✅ All phases completed
2. ✅ All 6500+ tests passing
3. ✅ New tests cover all 6 bug categories
4. ✅ sprite-test.blend compiles at O0 and O3
5. ✅ No new warnings/errors
6. ✅ Code committed
