# Execution Plan: Go-Intrinsics

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementing the missing intrinsics in the code generator.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Add CPU_BRK and OPT_BARRIER | 1 | 15 min |
| 2 | Add Lo/Hi Byte Extraction | 1 | 20 min |
| 3 | Add Volatile Operations | 1 | 20 min |
| 4 | Add Tests | 1 | 30 min |
| 5 | Verify All Tests Pass | 1 | 15 min |

**Total: 1-2 sessions, ~2 hours**

---

## Phase 1: Add CPU_BRK and OPT_BARRIER

### Session 1.1: Simple Intrinsics

**Reference**: [Codegen Implementation](03-codegen-implementation.md)

**Objective**: Add the two simplest intrinsics - BRK instruction and optimization barrier

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Add CPU_BRK to CPU instruction case list | `instruction-generator.ts` |
| 1.1.2 | Add CPU_BRK handler in generateCpuInstruction() | `instruction-generator.ts` |
| 1.1.3 | Add OPT_BARRIER case to generateInstruction() | `instruction-generator.ts` |

**Deliverables**:
- [ ] CPU_BRK generates `BRK` instruction
- [ ] OPT_BARRIER generates comment only
- [ ] Build succeeds

**Verify**: `clear && yarn clean && yarn build`

---

## Phase 2: Add Lo/Hi Byte Extraction

### Session 2.1: Byte Extraction Intrinsics

**Reference**: [Codegen Implementation](03-codegen-implementation.md)

**Objective**: Add lo() and hi() byte extraction intrinsics

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Add required imports (ILLoInstruction, ILHiInstruction) | `instruction-generator.ts` |
| 2.1.2 | Add INTRINSIC_LO case to switch | `instruction-generator.ts` |
| 2.1.3 | Add INTRINSIC_HI case to switch | `instruction-generator.ts` |
| 2.1.4 | Implement generateLo() method | `instruction-generator.ts` |
| 2.1.5 | Implement generateHi() method | `instruction-generator.ts` |

**Deliverables**:
- [ ] INTRINSIC_LO generates low byte extraction code
- [ ] INTRINSIC_HI generates high byte extraction code
- [ ] Build succeeds

**Verify**: `clear && yarn clean && yarn build`

---

## Phase 3: Add Volatile Operations

### Session 3.1: Volatile Memory Intrinsics

**Reference**: [Codegen Implementation](03-codegen-implementation.md)

**Objective**: Add volatile_read() and volatile_write() intrinsics

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Add required imports (ILVolatileReadInstruction, etc.) | `instruction-generator.ts` |
| 3.1.2 | Add VOLATILE_READ case to switch | `instruction-generator.ts` |
| 3.1.3 | Add VOLATILE_WRITE case to switch | `instruction-generator.ts` |
| 3.1.4 | Implement generateVolatileRead() method | `instruction-generator.ts` |
| 3.1.5 | Implement generateVolatileWrite() method | `instruction-generator.ts` |

**Deliverables**:
- [ ] VOLATILE_READ generates forced LDA with volatile marker
- [ ] VOLATILE_WRITE generates forced STA with volatile marker
- [ ] Build succeeds

**Verify**: `clear && yarn clean && yarn build`

---

## Phase 4: Add Tests

### Session 4.1: Test Coverage

**Reference**: [Testing Strategy](07-testing-strategy.md)

**Objective**: Add comprehensive tests for all 6 new intrinsic handlers

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Create test file | `__tests__/codegen/instruction-generator-intrinsics.test.ts` |
| 4.1.2 | Add CPU_BRK tests | Same file |
| 4.1.3 | Add OPT_BARRIER tests | Same file |
| 4.1.4 | Add INTRINSIC_LO tests | Same file |
| 4.1.5 | Add INTRINSIC_HI tests | Same file |
| 4.1.6 | Add VOLATILE_READ tests | Same file |
| 4.1.7 | Add VOLATILE_WRITE tests | Same file |

**Deliverables**:
- [ ] All 6 intrinsics have unit tests
- [ ] Tests verify correct assembly output
- [ ] New tests pass

**Verify**: `./compiler-test codegen`

---

## Phase 5: Final Verification

### Session 5.1: Full Test Suite

**Reference**: [Testing Strategy](07-testing-strategy.md)

**Objective**: Verify all 6,500+ tests pass with no regressions

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Run full test suite | - |
| 5.1.2 | Fix any regressions | As needed |
| 5.1.3 | Update plan completion status | `99-execution-plan.md` |

**Deliverables**:
- [ ] All 6,500+ tests pass
- [ ] No regressions
- [ ] Implementation complete

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: CPU_BRK and OPT_BARRIER
- [ ] 1.1.1 Add CPU_BRK to case list
- [ ] 1.1.2 Add CPU_BRK handler
- [ ] 1.1.3 Add OPT_BARRIER case

### Phase 2: Lo/Hi Byte Extraction
- [ ] 2.1.1 Add imports
- [ ] 2.1.2 Add INTRINSIC_LO case
- [ ] 2.1.3 Add INTRINSIC_HI case
- [ ] 2.1.4 Implement generateLo()
- [ ] 2.1.5 Implement generateHi()

### Phase 3: Volatile Operations
- [ ] 3.1.1 Add imports
- [ ] 3.1.2 Add VOLATILE_READ case
- [ ] 3.1.3 Add VOLATILE_WRITE case
- [ ] 3.1.4 Implement generateVolatileRead()
- [ ] 3.1.5 Implement generateVolatileWrite()

### Phase 4: Tests
- [ ] 4.1.1 Create test file
- [ ] 4.1.2 Add CPU_BRK tests
- [ ] 4.1.3 Add OPT_BARRIER tests
- [ ] 4.1.4 Add INTRINSIC_LO tests
- [ ] 4.1.5 Add INTRINSIC_HI tests
- [ ] 4.1.6 Add VOLATILE_READ tests
- [ ] 4.1.7 Add VOLATILE_WRITE tests

### Phase 5: Final Verification
- [ ] 5.1.1 Run full test suite
- [ ] 5.1.2 Fix regressions
- [ ] 5.1.3 Update completion status

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/go-intrinsics/99-execution-plan.md"
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

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with [x]
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 1 (BRK, Barrier)
    ↓
Phase 2 (Lo/Hi) 
    ↓
Phase 3 (Volatile)
    ↓
Phase 4 (Tests)
    ↓
Phase 5 (Verification)
```

Note: Phases 1-3 can be done in any order, but Phase 4 requires Phases 1-3 complete, and Phase 5 requires Phase 4 complete.

---

## Success Criteria

**Feature is complete when**:

1. ✅ All 6 intrinsics have switch cases in generateInstruction()
2. ✅ Each intrinsic generates correct 6502 assembly
3. ✅ No placeholder/NOP generation for any intrinsic
4. ✅ All new tests pass
5. ✅ All 6,500+ existing tests pass
6. ✅ Code follows project standards (JSDoc, protected methods)

---

## Notes

- This is a simple implementation task - no complex architecture needed
- The IL generator layer is already complete - we're just adding codegen
- Follow existing patterns in instruction-generator.ts
- Use the ZP_PTR ($FB/$FC) for indirect addressing as established