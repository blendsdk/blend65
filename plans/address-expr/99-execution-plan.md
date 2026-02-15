# Execution Plan: Assembly-Time Address Expressions

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-15 13:20
> **Progress**: 0/10 tasks (0%)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | IL Infrastructure | 1 | 20 min |
| 2 | IL Generator Pattern Detection | 1 | 20 min |
| 3 | Codegen Translation | 1 | 15 min |
| 4 | Testing & Balloon Fix | 1 | 25 min |

**Total: 2-3 sessions, ~1.5 hours**

---

## Phase 1: IL Infrastructure

### Session 1.1: Add LOAD_ADDRESS_EXPR Opcode and Builder

**Reference**: [03-il-codegen.md](03-il-codegen.md) sections 1, 2, 6

**Objective**: Add the new IL opcode, cost entry, and builder method.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add `LOAD_ADDRESS_EXPR` to `ILOpcode` enum with JSDoc | `packages/compiler/src/il/enums.ts` |
| 1.1.2 | Add cost entry in instruction cost map | `packages/compiler/src/il/builder/base.ts` |
| 1.1.3 | Add `loadAddressExpr()` builder method | `packages/compiler/src/il/builder/memory.ts` |

**Deliverables**:
- [ ] New opcode in enum
- [ ] Cost entry added
- [ ] Builder method implemented
- [ ] Builds without errors

**Verify**: `clear && yarn build`

---

## Phase 2: IL Generator Pattern Detection

### Session 2.1: Detect @variable / constant Pattern

**Reference**: [03-il-codegen.md](03-il-codegen.md) section 3

**Objective**: Add `tryGenerateAddressExpr()` to the IL generator and wire it into `generateBinary()`.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Add `tryGenerateAddressExpr()` method to ILGeneratorExpressions | `packages/compiler/src/il/generator/expressions.ts` |
| 2.1.2 | Wire pattern check into `generateBinary()` at the top | `packages/compiler/src/il/generator/expressions.ts` |

**Deliverables**:
- [ ] Pattern detection method implemented
- [ ] Called before byte/word dispatch in generateBinary
- [ ] Handles / and >> operators
- [ ] Constant-folds for numeric-address slots
- [ ] Falls through for non-matching patterns
- [ ] Builds without errors

**Verify**: `clear && yarn build`

---

## Phase 3: Codegen and Optimizer Awareness

### Session 3.1: Translate LOAD_ADDRESS_EXPR to Assembly

**Reference**: [03-il-codegen.md](03-il-codegen.md) sections 4, 5

**Objective**: Add the codegen translation case and make optimizer passes aware of the new opcode.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add `LOAD_ADDRESS_EXPR` case to IL→ASM-IL translation | `packages/compiler/src/codegen/code-generator.ts` |
| 3.1.2 | Add to CSE pass `modifiesAccumulator()` | `packages/compiler/src/optimizer/passes/cse/cse.ts` (or similar) |
| 3.1.3 | Add to dead-global-elim pass if needed | `packages/compiler/src/optimizer/passes/dead-global-elim.ts` |

**Deliverables**:
- [ ] Codegen emits `LDA #(label / N)` for label slots
- [ ] Codegen constant-folds for numeric-address slots
- [ ] Optimizer passes don't crash on new opcode
- [ ] Builds without errors

**Verify**: `clear && yarn build`

---

## Phase 4: Testing and Balloon Sprite Fix

### Session 4.1: Tests and Example Update

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Write comprehensive tests and update the balloon-sprite example.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Create E2E pipeline tests for address expressions | `packages/compiler/src/__tests__/e2e/pipeline/address-expr.test.ts` |
| 4.1.2 | Update balloon-sprite example to use `@balloonData / 64` | `examples/balloon-sprite/main.blend` |
| 4.1.3 | Compile balloon-sprite and verify ASM output | `build/main.asm` |
| 4.1.4 | Run full test suite — no regressions | All test files |

**Deliverables**:
- [ ] E2E tests pass (8+ test cases)
- [ ] Balloon sprite updated and compiles
- [ ] ASM contains `LDA #(label / 64)` (not runtime division)
- [ ] Full test suite passes (`./compiler-test`)

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: IL Infrastructure
- [ ] 1.1.1 Add LOAD_ADDRESS_EXPR to ILOpcode enum
- [ ] 1.1.2 Add cost entry in instruction cost map
- [ ] 1.1.3 Add loadAddressExpr() builder method

### Phase 2: IL Generator Pattern Detection
- [ ] 2.1.1 Add tryGenerateAddressExpr() method
- [ ] 2.1.2 Wire into generateBinary()

### Phase 3: Codegen and Optimizer Awareness
- [ ] 3.1.1 Add LOAD_ADDRESS_EXPR codegen case
- [ ] 3.1.2 Add to optimizer pass awareness (CSE, DGE)

### Phase 4: Testing and Balloon Fix
- [ ] 4.1.1 Create E2E pipeline tests
- [ ] 4.1.2 Update balloon-sprite example
- [ ] 4.1.3 Verify balloon-sprite ASM output
- [ ] 4.1.4 Run full test suite

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "exec_plan address-expr" or
# "Implement Phase X, Session X.X per plans/address-expr/99-execution-plan.md"
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
Phase 1 (IL infra)
    ↓
Phase 2 (IL generator)
    ↓
Phase 3 (Codegen + optimizer)
    ↓
Phase 4 (Tests + balloon fix)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ `@variable / N` emits `LDA #(label / N)` in assembly
2. ✅ `@variable >> N` emits `LDA #(label >> N)` in assembly
3. ✅ Balloon sprite example uses `@balloonData / 64`
4. ✅ All E2E tests pass
5. ✅ Full test suite passes (no regressions)
6. ✅ Compiles at all optimization levels (O0-O3)
