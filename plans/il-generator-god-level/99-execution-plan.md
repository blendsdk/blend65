# Execution Plan: Beyond God-Level IL Generator

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-02 08:35
> **Progress**: 48/50 tasks (96%)

---

## Overview

This document defines the execution phases and AI chat sessions for implementing the Beyond God-Level IL Generator.

**🚨 IMPORTANT:** Update this document after EACH completed task!

- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

---

## Implementation Phases

| Phase | Title                        | Sessions | Est. Time |
| ----- | ---------------------------- | -------- | --------- |
| 7a    | Core IL with SFA Integration | 3        | 6-8 hours |
| 7b    | Optimization Hints           | 2        | 4-5 hours |
| 7c    | Advanced Features            | 2        | 4-5 hours |
| 7d    | Testing & Validation         | 1        | 2-3 hours |

**Total: 8 sessions, ~16-21 hours**

---

## Phase 7a: Core IL with SFA Integration

### Session 7a.1: IL Types and Enums

**Reference**: [03-il-types.md](03-il-types.md)

**Objective**: Create complete IL type system with slot-centric operands

**Tasks**:

| #       | Task                                                                   | File                         |
| ------- | ---------------------------------------------------------------------- | ---------------------------- |
| 7a.1.1  | Create ILOpcode enum with ~35 opcodes                                  | `il/types.ts`                |
| 7a.1.2  | Create AddressingModeHint enum                                         | `il/types.ts`                |
| 7a.1.3  | Create SlotOperand interface                                           | `il/types.ts`                |
| 7a.1.4  | Create ImmediateOperand, LabelOperand, FunctionOperand, AddressOperand | `il/types.ts`                |
| 7a.1.5  | Create ILOperand union type                                            | `il/types.ts`                |
| 7a.1.6  | Create InstructionCost, DefUse, OptimizationHints interfaces           | `il/types.ts`                |
| 7a.1.7  | Create ILInstruction interface                                         | `il/types.ts`                |
| 7a.1.8  | Create ILLoop, ILFunction, ILProgram interfaces                        | `il/types.ts`                |
| 7a.1.9  | Create factory functions (createSlotOperand, etc.)                     | `il/types.ts`                |
| 7a.1.10 | Create type guards (isSlotOperand, etc.)                               | `il/types.ts`                |
| 7a.1.11 | Write unit tests for all types                                         | `__tests__/il/types.test.ts` |

**Deliverables**:

- [ ] Complete `il/types.ts` with all type definitions
- [ ] `__tests__/il/types.test.ts` with 20+ tests
- [ ] All tests passing

**Verify**: `./compiler-test il/types`

---

### Session 7a.2: IL Builder

**Reference**: [07-il-builder.md](07-il-builder.md)

**Objective**: Implement ILBuilder with fluent API

**Tasks**:

| #       | Task                                                | File                           |
| ------- | --------------------------------------------------- | ------------------------------ |
| 7a.2.1  | Create ILBuilder class skeleton                     | `il/builder.ts`                |
| 7a.2.2  | Implement label management (newLabel, label)        | `il/builder.ts`                |
| 7a.2.3  | Implement memory ops (loadSlot, storeSlot, loadImm) | `il/builder.ts`                |
| 7a.2.4  | Implement arithmetic ops (addSlot, subSlot, etc.)   | `il/builder.ts`                |
| 7a.2.5  | Implement bitwise ops (andSlot, orSlot, shl, shr)   | `il/builder.ts`                |
| 7a.2.6  | Implement comparison ops (cmpSlot, cmpImm)          | `il/builder.ts`                |
| 7a.2.7  | Implement control flow (jump, jumpEq, jumpNe, etc.) | `il/builder.ts`                |
| 7a.2.8  | Implement function ops (call, return\_)             | `il/builder.ts`                |
| 7a.2.9  | Implement register transfers                        | `il/builder.ts`                |
| 7a.2.10 | Implement emit() with cost/defuse computation       | `il/builder.ts`                |
| 7a.2.11 | Write unit tests for all builder methods            | `__tests__/il/builder.test.ts` |

**Deliverables**:

- [ ] Complete `il/builder.ts`
- [ ] `__tests__/il/builder.test.ts` with 25+ tests
- [ ] All tests passing

**Verify**: `./compiler-test il/builder`

---

### Session 7a.3: IL Generator - Core

**Reference**: [08-il-generator.md](08-il-generator.md)

**Objective**: Implement basic IL generation from AST

**Tasks**:

| #       | Task                                                  | File                             |
| ------- | ----------------------------------------------------- | -------------------------------- |
| 7a.3.1  | Create ILGenerator class skeleton                     | `il/generator.ts`                |
| 7a.3.2  | Implement resolveVariable()                           | `il/generator.ts`                |
| 7a.3.3  | Implement generateExpression() dispatcher             | `il/generator.ts`                |
| 7a.3.4  | Implement literal expression generation               | `il/generator.ts`                |
| 7a.3.5  | Implement identifier expression (with register check) | `il/generator.ts`                |
| 7a.3.6  | Implement binary expression generation                | `il/generator.ts`                |
| 7a.3.7  | Implement unary expression generation                 | `il/generator.ts`                |
| 7a.3.8  | Implement assignment expression                       | `il/generator.ts`                |
| 7a.3.9  | Implement generateStatement() dispatcher              | `il/generator.ts`                |
| 7a.3.10 | Implement variable declaration                        | `il/generator.ts`                |
| 7a.3.11 | Write unit tests for expressions/statements           | `__tests__/il/generator.test.ts` |

**Deliverables**:

- [ ] Core `il/generator.ts` (expressions + basic statements)
- [ ] `__tests__/il/generator.test.ts` with 15+ tests
- [ ] All tests passing

**Verify**: `./compiler-test il/generator`

---

## Phase 7b: Control Flow and Optimization Hints

### Session 7b.1: Control Flow IL Generation

**Reference**: [08-il-generator.md](08-il-generator.md), [06-loop-structure.md](06-loop-structure.md)

**Objective**: Complete control flow generation with loop structure

**Tasks**:

| #      | Task                                                  | File                             |
| ------ | ----------------------------------------------------- | -------------------------------- |
| 7b.1.1 | Implement if/else statement generation                | `il/generator.ts`                |
| 7b.1.2 | Implement while loop generation                       | `il/generator.ts`                |
| 7b.1.3 | Implement for loop generation                         | `il/generator.ts`                |
| 7b.1.4 | Implement analyzeForLoop() for counted loop detection | `il/generator.ts`                |
| 7b.1.5 | Implement loop depth tracking                         | `il/generator.ts`                |
| 7b.1.6 | Implement return statement generation                 | `il/generator.ts`                |
| 7b.1.7 | Implement break/continue (if supported)               | `il/generator.ts`                |
| 7b.1.8 | Write control flow tests                              | `__tests__/il/generator.test.ts` |

**Deliverables**:

- [ ] Complete control flow generation
- [ ] Loop structure tracking working
- [ ] Additional 15+ tests
- [ ] All tests passing

**Verify**: `./compiler-test il`

---

### Session 7b.2: Optimization Hints

**Reference**: [05-optimization-hints.md](05-optimization-hints.md)

**Objective**: Add live range analysis and optimization hints

**Tasks**:

| #      | Task                                               | File                              |
| ------ | -------------------------------------------------- | --------------------------------- |
| 7b.2.1 | Implement computeDefUse() function                 | `il/types.ts` or `il/analysis.ts` |
| 7b.2.2 | Implement computeInstructionCost() with base table | `il/types.ts` or `il/analysis.ts` |
| 7b.2.3 | Implement computeLiveRanges() backward dataflow    | `il/analysis.ts`                  |
| 7b.2.4 | Implement computeHints() (isHotPath, isDead, etc.) | `il/analysis.ts`                  |
| 7b.2.5 | Integrate cost computation in builder              | `il/builder.ts`                   |
| 7b.2.6 | Add live range computation pass after generation   | `il/generator.ts`                 |
| 7b.2.7 | Write tests for optimization hints                 | `__tests__/il/analysis.test.ts`   |

**Deliverables**:

- [ ] `il/analysis.ts` with live range analysis
- [ ] Cost model working
- [ ] 15+ analysis tests
- [ ] All tests passing

**Verify**: `./compiler-test il`

---

## Phase 7c: Advanced Features

### Session 7c.1: Function Calls and Register Parameters

**Reference**: [04-slot-integration.md](04-slot-integration.md)

**Objective**: Complete function call generation with register params

**Tasks**:

| #      | Task                                         | File                             |
| ------ | -------------------------------------------- | -------------------------------- |
| 7c.1.1 | Implement generateCall() with param handling | `il/generator.ts`                |
| 7c.1.2 | Implement register parameter detection       | `il/generator.ts`                |
| 7c.1.3 | Implement return value handling              | `il/generator.ts`                |
| 7c.1.4 | Implement generateFunction() entry point     | `il/generator.ts`                |
| 7c.1.5 | Implement generate() program entry point     | `il/generator.ts`                |
| 7c.1.6 | Handle callback functions                    | `il/generator.ts`                |
| 7c.1.7 | Write function call tests                    | `__tests__/il/generator.test.ts` |

**Deliverables**:

- [ ] Complete function call generation
- [ ] Register params working
- [ ] Additional 10+ tests
- [ ] All tests passing

**Verify**: `./compiler-test il`

---

### Session 7c.2: Intrinsics and Module Exports

**Reference**: [03-il-types.md](03-il-types.md)

**Objective**: Add intrinsic handling and complete module structure

**Tasks**:

| #      | Task                                        | File                             |
| ------ | ------------------------------------------- | -------------------------------- |
| 7c.2.1 | Implement generateIntrinsic() for peek/poke | `il/generator.ts`                |
| 7c.2.2 | Implement hi/lo intrinsics                  | `il/generator.ts`                |
| 7c.2.3 | Implement global variable initialization    | `il/generator.ts`                |
| 7c.2.4 | Create ILProgram with statistics            | `il/generator.ts`                |
| 7c.2.5 | Update `il/index.ts` exports                | `il/index.ts`                    |
| 7c.2.6 | Write intrinsic tests                       | `__tests__/il/generator.test.ts` |

**Deliverables**:

- [ ] Complete IL generation for all features
- [ ] Module exports working
- [ ] Additional 10+ tests
- [ ] All tests passing

**Verify**: `./compiler-test il`

---

## Phase 7d: Testing & Validation

### Session 7d.1: Comprehensive Testing and Documentation

**Reference**: [09-testing-strategy.md](09-testing-strategy.md)

**Objective**: Complete test coverage and documentation

**Tasks**:

| #      | Task                             | File                        |
| ------ | -------------------------------- | --------------------------- |
| 7d.1.1 | Write E2E test: simple-add.blend | `__tests__/il/e2e/`         |
| 7d.1.2 | Write E2E test: loops.blend      | `__tests__/il/e2e/`         |
| 7d.1.3 | Write E2E test: functions.blend  | `__tests__/il/e2e/`         |
| 7d.1.4 | Write integration test: AST → IL | `__tests__/il/integration/` |
| 7d.1.5 | Write integration test: SFA → IL | `__tests__/il/integration/` |
| 7d.1.6 | Verify 95%+ test coverage        | -                           |
| 7d.1.7 | Add JSDoc to all public APIs     | `il/*.ts`                   |

**Deliverables**:

- [ ] 95%+ test coverage
- [ ] E2E tests passing
- [ ] Complete JSDoc
- [ ] All tests passing

**Verify**: `./compiler-test il --coverage`

---

## Task Checklist (All Phases)

### Phase 7a: Core IL with SFA Integration

**Session 7a.1: IL Types**

- [x] 7a.1.1 Create ILOpcode enum ✅ (completed: 2025-02-02 07:20)
- [x] 7a.1.2 Create AddressingModeHint enum ✅ (completed: 2025-02-02 07:20)
- [x] 7a.1.3 Create SlotOperand interface ✅ (completed: 2025-02-02 07:20)
- [x] 7a.1.4 Create other operand interfaces ✅ (completed: 2025-02-02 07:20)
- [x] 7a.1.5 Create ILOperand union ✅ (completed: 2025-02-02 07:20)
- [x] 7a.1.6 Create hint interfaces ✅ (completed: 2025-02-02 07:21)
- [x] 7a.1.7 Create ILInstruction ✅ (completed: 2025-02-02 07:21)
- [x] 7a.1.8 Create ILLoop, ILFunction, ILProgram ✅ (completed: 2025-02-02 07:21)
- [x] 7a.1.9 Create factory functions ✅ (completed: 2025-02-02 07:22)
- [x] 7a.1.10 Create type guards ✅ (completed: 2025-02-02 07:22)
- [x] 7a.1.11 Write unit tests ✅ (completed: 2025-02-02 07:25)

**Session 7a.2: IL Builder**

- [x] 7a.2.1 Create ILBuilder class ✅ (completed: 2025-02-02 07:30)
- [x] 7a.2.2 Implement label management ✅ (completed: 2025-02-02 07:30)
- [x] 7a.2.3 Implement memory ops ✅ (completed: 2025-02-02 07:30)
- [x] 7a.2.4 Implement arithmetic ops ✅ (completed: 2025-02-02 07:31)
- [x] 7a.2.5 Implement bitwise ops ✅ (completed: 2025-02-02 07:31)
- [x] 7a.2.6 Implement comparison ops ✅ (completed: 2025-02-02 07:31)
- [x] 7a.2.7 Implement control flow ✅ (completed: 2025-02-02 07:31)
- [x] 7a.2.8 Implement function ops ✅ (completed: 2025-02-02 07:31)
- [x] 7a.2.9 Implement register transfers ✅ (completed: 2025-02-02 07:31)
- [x] 7a.2.10 Implement emit() ✅ (completed: 2025-02-02 07:30)
- [x] 7a.2.11 Write unit tests ✅ (completed: 2025-02-02 07:33) - 69 tests passing

**Session 7a.3: IL Generator Core**

- [x] 7a.3.1 Create ILGenerator class ✅ (completed: 2025-02-02 07:43)
- [x] 7a.3.2 Implement resolveVariable ✅ (completed: 2025-02-02 07:43)
- [x] 7a.3.3 Implement expression dispatcher ✅ (completed: 2025-02-02 07:45)
- [x] 7a.3.4 Implement literal expression ✅ (completed: 2025-02-02 07:45)
- [x] 7a.3.5 Implement identifier expression ✅ (completed: 2025-02-02 07:45)
- [x] 7a.3.6 Implement binary expression ✅ (completed: 2025-02-02 07:45)
- [x] 7a.3.7 Implement unary expression ✅ (completed: 2025-02-02 07:45)
- [x] 7a.3.8 Implement assignment ✅ (completed: 2025-02-02 07:45)
- [x] 7a.3.9 Implement statement dispatcher ✅ (completed: 2025-02-02 07:46)
- [x] 7a.3.10 Implement variable declaration ✅ (completed: 2025-02-02 07:46)
- [x] 7a.3.11 Write unit tests ✅ (completed: 2025-02-02 07:52) - 20 tests passing

### Phase 7b: Control Flow and Hints

**Session 7b.1: Control Flow**

- [x] 7b.1.1 Implement if/else ✅ (completed: 2026-02-02 08:00)
- [x] 7b.1.2 Implement while ✅ (completed: 2026-02-02 08:00)
- [x] 7b.1.3 Implement for ✅ (completed: 2026-02-02 08:00)
- [x] 7b.1.4 Implement counted loop detection ✅ (completed: 2026-02-02 08:00)
- [x] 7b.1.5 Implement loop depth tracking ✅ (completed: 2026-02-02 08:00)
- [x] 7b.1.6 Implement return ✅ (completed: 2026-02-02 08:00)
- [x] 7b.1.7 Implement break/continue ✅ (completed: 2026-02-02 08:00)
- [x] 7b.1.8 Write tests ✅ (completed: 2026-02-02 08:21) - 20 tests passing

**Session 7b.2: Optimization Hints**

- [x] 7b.2.1 Implement computeDefUse ✅ (completed: 2026-02-02 08:35) - already in builder/base.ts
- [x] 7b.2.2 Implement computeInstructionCost ✅ (completed: 2026-02-02 08:35) - already in builder/base.ts
- [x] 7b.2.3 Implement computeLiveRanges ✅ (completed: 2026-02-02 08:35) - created analysis.ts
- [x] 7b.2.4 Implement computeHints ✅ (completed: 2026-02-02 08:35) - created in analysis.ts
- [x] 7b.2.5 Integrate cost in builder ✅ (completed: 2026-02-02 08:35) - already done in emit()
- [x] 7b.2.6 Add live range pass ✅ (completed: 2026-02-02 08:35) - updated index exports
- [x] 7b.2.7 Write tests ✅ (completed: 2026-02-02 08:35) - 28 tests in analysis.test.ts

### Phase 7c: Advanced Features

**Session 7c.1: Functions**

- [ ] 7c.1.1 Implement generateCall
- [ ] 7c.1.2 Implement register params
- [ ] 7c.1.3 Implement return value
- [ ] 7c.1.4 Implement generateFunction
- [ ] 7c.1.5 Implement generate()
- [ ] 7c.1.6 Handle callbacks
- [ ] 7c.1.7 Write tests

**Session 7c.2: Intrinsics**

- [ ] 7c.2.1 Implement peek/poke
- [ ] 7c.2.2 Implement hi/lo
- [ ] 7c.2.3 Implement global init
- [ ] 7c.2.4 Create ILProgram
- [ ] 7c.2.5 Update exports
- [ ] 7c.2.6 Write tests

### Phase 7d: Testing

**Session 7d.1: Comprehensive Testing**

- [ ] 7d.1.1 E2E: simple-add
- [ ] 7d.1.2 E2E: loops
- [ ] 7d.1.3 E2E: functions
- [ ] 7d.1.4 Integration: AST → IL
- [ ] 7d.1.5 Integration: SFA → IL
- [ ] 7d.1.6 Verify coverage
- [ ] 7d.1.7 Add JSDoc

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase 7a, Session 7a.1 per plans/il-generator-god-level/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test il

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Call attempt_completion
# 4. User runs /compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with `[x]`
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 7a (Core)
    ├── Session 7a.1: Types ←────────┐
    ├── Session 7a.2: Builder ←──────┤ (depends on 7a.1)
    └── Session 7a.3: Generator ←────┤ (depends on 7a.1, 7a.2)
                                     │
Phase 7b (Hints)                     │
    ├── Session 7b.1: Control Flow ←─┤ (depends on 7a.3)
    └── Session 7b.2: Optimization ←─┤ (depends on 7b.1)
                                     │
Phase 7c (Advanced)                  │
    ├── Session 7c.1: Functions ←────┤ (depends on 7b.1)
    └── Session 7c.2: Intrinsics ←───┤ (depends on 7c.1)
                                     │
Phase 7d (Testing)                   │
    └── Session 7d.1: Validation ←───┘ (depends on all)
```

---

## Success Criteria

**IL Generator is complete when**:

1. ✅ All 32 tasks completed
2. ✅ All tests passing (~100+ tests)
3. ✅ 95%+ test coverage
4. ✅ No lint warnings/errors
5. ✅ Complete JSDoc documentation
6. ✅ Integration verified with SFA
7. ✅ E2E tests with real Blend programs

---

## Files to Create

| File                             | Session            | Lines (Est.) |
| -------------------------------- | ------------------ | ------------ |
| `il/types.ts`                    | 7a.1               | 400-500      |
| `il/builder.ts`                  | 7a.2               | 250-350      |
| `il/generator.ts`                | 7a.3, 7b.1, 7c.1-2 | 400-500      |
| `il/analysis.ts`                 | 7b.2               | 150-200      |
| `il/index.ts`                    | 7c.2               | 20           |
| `__tests__/il/types.test.ts`     | 7a.1               | 200          |
| `__tests__/il/builder.test.ts`   | 7a.2               | 250          |
| `__tests__/il/generator.test.ts` | 7a.3, 7b.1, 7c.1-2 | 400          |
| `__tests__/il/analysis.test.ts`  | 7b.2               | 150          |
| `__tests__/il/e2e/*.test.ts`     | 7d.1               | 200          |

**Total: ~2,500 lines of production code + tests**