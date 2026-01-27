# Execution Plan: Skipped Tests Fixes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementing fixes to enable 13 skipped tests.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Array Initializers | 1 | 45-60 min |
| 2 | Data Directives | 1 | 30-45 min |
| 3 | Local Variables | 1 | 60-90 min |
| 4 | Branch Selection | 1 | 45-60 min |

**Total: 4 sessions, ~3-4 hours**

---

## Phase 1: Array Initializers

### Session 1.1: Fix IL Generator Array Value Extraction

**Reference**: [03-array-initializers.md](03-array-initializers.md)

**Objective**: Extract array literal values in IL generator so code generator can emit correct bytes.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Read IL generator to find VariableDecl processing | `packages/compiler/src/il/generator.ts` |
| 1.1.2 | Add `extractArrayLiteralValues()` helper method | `packages/compiler/src/il/generator.ts` |
| 1.1.3 | Integrate extraction into global variable processing | `packages/compiler/src/il/generator.ts` |
| 1.1.4 | Test IL output includes initialValue array | Manual test script |
| 1.1.5 | Enable and verify 3 array initializer tests | `smoke.test.ts`, `literals.test.ts` |

**Deliverables**:
- [ ] `extractArrayLiteralValues()` method added
- [ ] IL globals have correct `initialValue` arrays
- [ ] 3 tests enabled and passing

**Verify**: `./compiler-test e2e/smoke e2e/literals`

---

## Phase 2: Data Directives

### Session 2.1: Fix Data Section Generation

**Reference**: [06-data-directives.md](06-data-directives.md)

**Objective**: Ensure uninitialized arrays generate proper `!fill` directives.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Investigate actual output for `let buffer: byte[10]` | Debug script |
| 2.1.2 | Compare output with test expectations | `variables.test.ts` |
| 2.1.3 | Fix code or update test expectations as needed | `globals-generator.ts` or tests |
| 2.1.4 | Verify word array size calculation (N*2) | `globals-generator.ts` |
| 2.1.5 | Enable and verify 4 data directive tests | `variables.test.ts`, `literals.test.ts` |

**Deliverables**:
- [ ] Arrays generate correct `!fill` directives
- [ ] Word arrays calculate size correctly
- [ ] 4 tests enabled and passing

**Verify**: `./compiler-test e2e/variables e2e/literals`

---

## Phase 3: Local Variables

### Session 3.1: Implement Local Variable Allocation

**Reference**: [04-local-variables.md](04-local-variables.md)

**Objective**: Track and allocate zero-page memory for function-local variables.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Add `LocalVariableAllocation` interface | `instruction-generator.ts` |
| 3.1.2 | Add `localAllocations` map and ZP range constants | `instruction-generator.ts` |
| 3.1.3 | Add `resetLocalAllocations()` method | `instruction-generator.ts` |
| 3.1.4 | Add `allocateLocalVariable()` method | `instruction-generator.ts` |
| 3.1.5 | Add `lookupLocalVariable()` method | `instruction-generator.ts` |
| 3.1.6 | Modify `generateFunction()` to allocate locals | `instruction-generator.ts` |
| 3.1.7 | Modify `generateLoadVar()` to check locals first | `instruction-generator.ts` |
| 3.1.8 | Modify `generateStoreVar()` to check locals first | `instruction-generator.ts` |
| 3.1.9 | Test local variable output | Debug script |
| 3.1.10 | Enable and verify 3-4 local variable tests | `smoke.test.ts`, `variables.test.ts` |

**Deliverables**:
- [ ] Local variable allocation working
- [ ] No more STUB comments for local variables
- [ ] 3-4 tests enabled and passing

**Verify**: `./compiler-test e2e/smoke e2e/variables`

---

## Phase 4: Branch Selection

### Session 4.1: Implement Conditional Branch Instructions

**Reference**: [05-branch-selection.md](05-branch-selection.md)

**Objective**: Generate proper BNE/BEQ/BCS/BCC based on comparison type.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Add `comparisonTypes` tracking map | `instruction-generator.ts` |
| 4.1.2 | Add `isComparisonOp()` helper | `instruction-generator.ts` |
| 4.1.3 | Modify `generateBinaryOp()` to track comparison types | `instruction-generator.ts` |
| 4.1.4 | Replace `generateBranch()` stub with proper implementation | `instruction-generator.ts` |
| 4.1.5 | Test branch output for equality/inequality | Debug script |
| 4.1.6 | Enable and verify 2 branch selection tests | `control-flow.test.ts` |

**Deliverables**:
- [ ] BNE generated for equality comparisons
- [ ] BEQ generated for inequality comparisons
- [ ] 2 tests enabled and passing

**Verify**: `./compiler-test e2e/control-flow`

---

## Task Checklist (All Phases)

### Phase 1: Array Initializers
- [ ] 1.1.1 Read IL generator VariableDecl processing
- [ ] 1.1.2 Add `extractArrayLiteralValues()` helper
- [ ] 1.1.3 Integrate into global variable processing
- [ ] 1.1.4 Test IL output
- [ ] 1.1.5 Enable 3 tests

### Phase 2: Data Directives
- [ ] 2.1.1 Investigate actual output
- [ ] 2.1.2 Compare with test expectations
- [ ] 2.1.3 Fix code or tests
- [ ] 2.1.4 Verify word array size
- [ ] 2.1.5 Enable 4 tests

### Phase 3: Local Variables
- [ ] 3.1.1 Add LocalVariableAllocation interface
- [ ] 3.1.2 Add localAllocations map
- [ ] 3.1.3 Add resetLocalAllocations()
- [ ] 3.1.4 Add allocateLocalVariable()
- [ ] 3.1.5 Add lookupLocalVariable()
- [ ] 3.1.6 Modify generateFunction()
- [ ] 3.1.7 Modify generateLoadVar()
- [ ] 3.1.8 Modify generateStoreVar()
- [ ] 3.1.9 Test local variable output
- [ ] 3.1.10 Enable 3-4 tests

### Phase 4: Branch Selection
- [ ] 4.1.1 Add comparisonTypes map
- [ ] 4.1.2 Add isComparisonOp() helper
- [ ] 4.1.3 Modify generateBinaryOp()
- [ ] 4.1.4 Replace generateBranch()
- [ ] 4.1.5 Test branch output
- [ ] 4.1.6 Enable 2 tests

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Verify baseline
./compiler-test 2>&1 | tail -20

# 3. Reference this plan
# "Implement Phase X, Session X.X per plans/multiple-fixes/99-execution-plan.md"
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
Phase 1 (Array Initializers)
    ↓ (partially independent)
Phase 2 (Data Directives) ← may depend on Phase 1 for initialized arrays
    ↓ (independent)
Phase 3 (Local Variables)
    ↓ (independent)  
Phase 4 (Branch Selection)
```

**Note**: Phases 1-2 relate to data section, Phases 3-4 relate to code generation. They can potentially be done in parallel but are presented sequentially for clarity.

---

## Success Criteria

**Plan is complete when**:

1. ✅ All 4 phases completed
2. ✅ All 13 targeted tests enabled and passing
3. ✅ No regressions in 6963 existing tests
4. ✅ Total tests: 6976 (6963 + 13)
5. ✅ Skipped tests reduced from 18 to 5

---

## Execution Commands

```bash
# Quick start for each session
clear && scripts/agent.sh start

# Verify baseline
./compiler-test 2>&1 | tail -20

# Test specific component
./compiler-test e2e/smoke
./compiler-test e2e/literals
./compiler-test e2e/variables
./compiler-test e2e/control-flow

# Full test suite
./compiler-test

# End session
clear && scripts/agent.sh finished
```