# Execution Plan: Fix All Critical Oversights

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementing the oversight fixes.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Value Tracking Infrastructure | 1-2 | 2-3 hours |
| 2 | Binary Operation Fixes | 1-2 | 2-3 hours |
| 3 | PHI Node Lowering | 1-2 | 2-3 hours |
| 4 | Missing Operations (MUL, Shift, Arrays) | 2-3 | 3-5 hours |
| 5 | Label Generation Fixes | 1 | 1-2 hours |
| 6 | Semantic Member Access | 1-2 | 2-3 hours |
| 7 | Testing & Verification | 1-2 | 2-3 hours |

**Total: 8-14 sessions, ~14-22 hours**

---

## Phase 1: Value Tracking Infrastructure

### Session 1.1: Add Value Location Types and Tracking

**Reference**: [04-codegen-operands.md](04-codegen-operands.md)

**Objective**: Add infrastructure to track where IL values are stored

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add `ValueLocation` enum to types | `codegen/types.ts` |
| 1.1.2 | Add `TrackedValue` interface | `codegen/types.ts` |
| 1.1.3 | Add `valueLocations` map to BaseCodeGenerator | `codegen/base-generator.ts` |
| 1.1.4 | Add `trackValue()` method | `codegen/base-generator.ts` |
| 1.1.5 | Add `getValueLocation()` method | `codegen/base-generator.ts` |
| 1.1.6 | Add `loadValueToA()` method | `codegen/base-generator.ts` |
| 1.1.7 | Add unit tests for value tracking | `__tests__/codegen/value-tracking.test.ts` |

**Deliverables**:
- [ ] ValueLocation enum with all location types
- [ ] TrackedValue interface
- [ ] Value tracking methods working
- [ ] Unit tests passing

**Verify**: `./compiler-test codegen`

---

## Phase 2: Binary Operation Fixes

### Session 2.1: Fix ADD, SUB, Comparisons

**Reference**: [04-codegen-operands.md](04-codegen-operands.md)

**Objective**: Make binary operations use actual operand values instead of `#$00`

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Update `generateConst()` to track values | `codegen/instruction-generator.ts` |
| 2.1.2 | Add `formatOperand()` method | `codegen/instruction-generator.ts` |
| 2.1.3 | Fix `generateBinaryOp()` for ADD | `codegen/instruction-generator.ts` |
| 2.1.4 | Fix `generateBinaryOp()` for SUB | `codegen/instruction-generator.ts` |
| 2.1.5 | Fix all CMP_* operations | `codegen/instruction-generator.ts` |
| 2.1.6 | Update `generateStoreVar()` to track | `codegen/instruction-generator.ts` |
| 2.1.7 | Add tests for binary operations | `__tests__/codegen/binary-ops.test.ts` |

**Deliverables**:
- [ ] ADD generates `ADC` with actual operand
- [ ] SUB generates `SBC` with actual operand
- [ ] CMP_* generates `CMP` with actual operand
- [ ] No `#$00` placeholders in simple arithmetic
- [ ] Tests passing

**Verify**: `./compiler-test codegen`

---

## Phase 3: PHI Node Lowering

### Session 3.1: Implement PHI Resolution

**Reference**: [05-codegen-missing-ops.md](05-codegen-missing-ops.md)

**Objective**: Convert SSA PHI nodes to explicit moves

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add `allocatePhiMergeVariable()` method | `codegen/instruction-generator.ts` |
| 3.1.2 | Add `handlePhiMovesForSuccessors()` method | `codegen/instruction-generator.ts` |
| 3.1.3 | Modify `generateBasicBlock()` to call PHI handler | `codegen/instruction-generator.ts` |
| 3.1.4 | Add `generatePhiNode()` to load merged value | `codegen/instruction-generator.ts` |
| 3.1.5 | Add tests for PHI lowering | `__tests__/codegen/phi-lowering.test.ts` |

**Deliverables**:
- [ ] PHI nodes generate actual moves (not NOP)
- [ ] if/else merge works correctly
- [ ] Loop header merge works correctly
- [ ] Tests passing

**Verify**: `./compiler-test codegen`

---

## Phase 4: Missing Operations

### Session 4.1: Implement MUL

**Reference**: [05-codegen-missing-ops.md](05-codegen-missing-ops.md)

**Objective**: Implement 8-bit multiplication

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Add `generateMul()` method | `codegen/instruction-generator.ts` |
| 4.1.2 | Add power-of-two optimization | `codegen/instruction-generator.ts` |
| 4.1.3 | Add `_mul8` subroutine generation | `codegen/base-generator.ts` |
| 4.1.4 | Add `loadValueToX()` helper | `codegen/base-generator.ts` |
| 4.1.5 | Add tests for multiplication | `__tests__/codegen/multiply.test.ts` |

### Session 4.2: Implement SHL/SHR

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.2.1 | Add `generateShl()` method | `codegen/instruction-generator.ts` |
| 4.2.2 | Add `generateShr()` method | `codegen/instruction-generator.ts` |
| 4.2.3 | Add constant shift unrolling | `codegen/instruction-generator.ts` |
| 4.2.4 | Add tests for shifts | `__tests__/codegen/shifts.test.ts` |

### Session 4.3: Implement Array Operations

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.3.1 | Add `generateLoadArray()` method | `codegen/instruction-generator.ts` |
| 4.3.2 | Add `generateStoreArray()` method | `codegen/instruction-generator.ts` |
| 4.3.3 | Add `loadValueToY()` helper | `codegen/base-generator.ts` |
| 4.3.4 | Add `resolveArrayLabel()` helper | `codegen/instruction-generator.ts` |
| 4.3.5 | Add tests for arrays | `__tests__/codegen/arrays.test.ts` |

**Deliverables**:
- [ ] MUL generates working multiply code
- [ ] SHL generates ASL chain
- [ ] SHR generates LSR chain
- [ ] LOAD_ARRAY generates `LDA array,Y`
- [ ] STORE_ARRAY generates `STA array,Y`
- [ ] All tests passing

**Verify**: `./compiler-test codegen`

---

## Phase 5: Label Generation Fixes

### Session 5.1: Fix Undefined and Double-Dot Labels

**Reference**: [06-label-generation.md](06-label-generation.md)

**Objective**: Fix label generation issues

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.1.1 | Audit function label generation | `codegen/code-generator.ts` |
| 5.1.2 | Ensure data labels emitted | `codegen/globals-generator.ts` |
| 5.1.3 | Fix double-dot prefix in emitter | `asm-il/emitters/acme-emitter.ts` |
| 5.1.4 | Fix `getBlockLabel()` naming | `codegen/label-generator.ts` |
| 5.1.5 | Add tests for labels | `__tests__/codegen/labels.test.ts` |

**Deliverables**:
- [ ] `main.blend` compiles without undefined labels
- [ ] No double-dot labels in output
- [ ] ACME accepts all labels

**Verify**: 
```bash
./packages/cli/bin/blend65.js build ./examples/simple/main.blend
# Should succeed without "undefined" errors
```

---

## Phase 6: Semantic Member Access

### Session 6.1: Fix Member Type Resolution

**Reference**: [03-semantic-fixes.md](03-semantic-fixes.md)

**Objective**: Fix "type unknown" for module member access

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.1.1 | Trace member resolution failure | `semantic/analyzer.ts` |
| 6.1.2 | Fix module member lookup | `semantic/analyzer.ts` |
| 6.1.3 | Handle @map member access | `semantic/analyzer.ts` |
| 6.1.4 | Fix imported symbol resolution | `semantic/symbol-table.ts` |
| 6.1.5 | Add tests for member access | `__tests__/semantic/member-access.test.ts` |

**Deliverables**:
- [ ] `vic.borderColor` resolves to byte type
- [ ] `hardware.blend` compiles without type errors
- [ ] Tests passing

**Verify**: 
```bash
./packages/cli/bin/blend65.js build ./examples/snake-game/hardware.blend
# Should succeed without "type unknown" errors
```

---

## Phase 7: Testing & Verification

### Session 7.1: Final Verification

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Verify all fixes work together

**Tasks**:

| # | Task | File |
|---|------|------|
| 7.1.1 | Run full test suite | - |
| 7.1.2 | Compile print-demo.blend | - |
| 7.1.3 | Compile main.blend | - |
| 7.1.4 | Compile hardware.blend | - |
| 7.1.5 | Add E2E tests for examples | `__tests__/e2e/examples.test.ts` |
| 7.1.6 | Update GAP-REPORT.md | `GAP-REPORT.md` |
| 7.1.7 | Update PROJECT_STATUS.md | `PROJECT_STATUS.md` |
| 7.1.8 | Update WHATS-LEFT.md | `WHATS-LEFT.md` |

**Deliverables**:
- [ ] All 7,059+ tests pass
- [ ] print-demo.blend produces working PRG
- [ ] main.blend produces working PRG
- [ ] hardware.blend compiles successfully
- [ ] Status documents updated

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Value Tracking Infrastructure
- [ ] 1.1.1 Add ValueLocation enum
- [ ] 1.1.2 Add TrackedValue interface
- [ ] 1.1.3 Add valueLocations map
- [ ] 1.1.4 Add trackValue() method
- [ ] 1.1.5 Add getValueLocation() method
- [ ] 1.1.6 Add loadValueToA() method
- [ ] 1.1.7 Add unit tests

### Phase 2: Binary Operation Fixes
- [ ] 2.1.1 Update generateConst() tracking
- [ ] 2.1.2 Add formatOperand() method
- [ ] 2.1.3 Fix ADD operation
- [ ] 2.1.4 Fix SUB operation
- [ ] 2.1.5 Fix all CMP_* operations
- [ ] 2.1.6 Update generateStoreVar() tracking
- [ ] 2.1.7 Add binary op tests

### Phase 3: PHI Node Lowering
- [ ] 3.1.1 Add allocatePhiMergeVariable()
- [ ] 3.1.2 Add handlePhiMovesForSuccessors()
- [ ] 3.1.3 Modify generateBasicBlock()
- [ ] 3.1.4 Add generatePhiNode()
- [ ] 3.1.5 Add PHI tests

### Phase 4: Missing Operations
- [ ] 4.1.1-5 Implement MUL
- [ ] 4.2.1-4 Implement SHL/SHR
- [ ] 4.3.1-5 Implement array operations

### Phase 5: Label Fixes
- [ ] 5.1.1 Audit function labels
- [ ] 5.1.2 Ensure data labels emitted
- [ ] 5.1.3 Fix double-dot prefix
- [ ] 5.1.4 Fix getBlockLabel()
- [ ] 5.1.5 Add label tests

### Phase 6: Semantic Fixes
- [ ] 6.1.1 Trace member resolution
- [ ] 6.1.2 Fix module member lookup
- [ ] 6.1.3 Handle @map members
- [ ] 6.1.4 Fix import resolution
- [ ] 6.1.5 Add semantic tests

### Phase 7: Verification
- [ ] 7.1.1 Run full test suite
- [ ] 7.1.2-4 Verify example programs
- [ ] 7.1.5 Add E2E tests
- [ ] 7.1.6-8 Update status documents

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/fix-oversight/99-execution-plan.md"
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
Phase 1 (Value Tracking)
    ↓
Phase 2 (Binary Ops) ─────────────────────┐
    ↓                                      │
Phase 3 (PHI Lowering)                     │
    ↓                                      │
Phase 4 (Missing Ops)                      │
    ↓                                      │
Phase 5 (Label Fixes) ←────────────────────┘
    ↓
Phase 6 (Semantic) [independent]
    ↓
Phase 7 (Verification)
```

---

## Success Criteria

**Implementation is complete when:**

1. ✅ All phases completed
2. ✅ All 7,059+ tests passing
3. ✅ `print-demo.blend` produces working PRG (no STUB/placeholder)
4. ✅ `main.blend` produces working PRG (no undefined labels)
5. ✅ `hardware.blend` compiles without semantic errors
6. ✅ GAP-REPORT.md updated
7. ✅ PROJECT_STATUS.md updated
8. ✅ WHATS-LEFT.md updated