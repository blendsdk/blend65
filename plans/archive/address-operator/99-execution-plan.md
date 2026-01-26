# Execution Plan: Address-of Operator & Callback

> **Document**: 99-execution-plan.md  
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementing the address-of operator and callback functionality.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | IL Infrastructure | 1 | 30 min |
| 2 | IL Builder | 1 | 20 min |
| 3 | IL Generator - Address-of | 1 | 45 min |
| 4 | IL Generator - Callbacks | 1 | 30 min |
| 5 | ASM-IL Layer | 1 | 45 min |
| 6 | CodeGen Layer | 1 | 45 min |
| 7 | End-to-End Testing | 1 | 30 min |

**Total: 7 sessions, ~4-5 hours**

---

## Phase 1: IL Infrastructure

### Session 1.1: Add LOAD_ADDRESS Opcode and Instruction

**Reference**: [03-il-infrastructure.md](03-il-infrastructure.md)

**Objective**: Add the LOAD_ADDRESS opcode and LoadAddressInstruction class.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Add `LOAD_ADDRESS` to `ILOpcode` enum | `il/instructions.ts` |
| 1.1.2 | Create `LoadAddressInstruction` class | `il/instructions.ts` |
| 1.1.3 | Add `isLoadAddressInstruction` type guard | `il/instructions.ts` |
| 1.1.4 | Export new types from index | `il/index.ts` |
| 1.1.5 | Write unit tests | `__tests__/il/load-address-instruction.test.ts` |

**Deliverables**:
- [ ] LOAD_ADDRESS opcode defined
- [ ] LoadAddressInstruction class implemented
- [ ] Type guard function added
- [ ] All tests passing

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 2: IL Builder

### Session 2.1: Add emitLoadAddress Method

**Reference**: [03-il-infrastructure.md](03-il-infrastructure.md)

**Objective**: Add builder method to emit LOAD_ADDRESS instructions.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Add `emitLoadAddress` method to ILBuilder | `il/builder.ts` |
| 2.1.2 | Import LoadAddressInstruction | `il/builder.ts` |
| 2.1.3 | Write unit tests | `__tests__/il/builder-load-address.test.ts` |

**Deliverables**:
- [ ] emitLoadAddress method implemented
- [ ] All tests passing

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 3: IL Generator - Address-of Operator

### Session 3.1: Fix Address-of Operator (`@`)

**Reference**: [04-il-generator.md](04-il-generator.md)

**Objective**: Replace placeholder `@` operator handling with proper implementation.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Add `lookupFunction` helper method | `il/generator/expressions.ts` |
| 3.1.2 | Add `lookupVariable` helper method | `il/generator/expressions.ts` |
| 3.1.3 | Replace ADDRESS case in `generateUnaryExpression` | `il/generator/expressions.ts` |
| 3.1.4 | Handle variable address (`@variable`) | `il/generator/expressions.ts` |
| 3.1.5 | Handle function address (`@function`) | `il/generator/expressions.ts` |
| 3.1.6 | Add error handling for invalid operands | `il/generator/expressions.ts` |
| 3.1.7 | Write tests for `@variable` | `__tests__/il/generator-address-of.test.ts` |
| 3.1.8 | Write tests for `@function` | `__tests__/il/generator-address-of.test.ts` |
| 3.1.9 | Write error case tests | `__tests__/il/generator-address-of.test.ts` |

**Deliverables**:
- [ ] Address-of operator emits LOAD_ADDRESS
- [ ] Works for variables (local, global, param)
- [ ] Works for functions
- [ ] Error handling for invalid operands
- [ ] All tests passing

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 4: IL Generator - Callback Parameters

### Session 4.1: Handle Function References

**Reference**: [04-il-generator.md](04-il-generator.md)

**Objective**: Fix `generateIdentifierExpression` to handle function names.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Add function lookup to `generateIdentifierExpression` | `il/generator/expressions.ts` |
| 4.1.2 | Emit LOAD_ADDRESS for function identifiers | `il/generator/expressions.ts` |
| 4.1.3 | Write tests for callback parameter passing | `__tests__/il/generator-callback.test.ts` |

**Deliverables**:
- [ ] Function names resolve to LOAD_ADDRESS
- [ ] Callback parameters receive function addresses
- [ ] All tests passing

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 5: ASM-IL Layer

### Session 5.1: Convert LOAD_ADDRESS to ASM-IL

**Reference**: [05-asm-il-layer.md](05-asm-il-layer.md)

**Objective**: Add LOAD_ADDRESS handling in ASM-IL emitter.

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Add LOAD_ADDRESS case to instruction emitter | `asm-il/emitters/instruction-emitter.ts` |
| 5.1.2 | Implement `emitLoadAddress` method | `asm-il/emitters/instruction-emitter.ts` |
| 5.1.3 | Add `resolveSymbolLabel` helper | `asm-il/emitters/instruction-emitter.ts` |
| 5.1.4 | Add new ASM-IL instruction types (if needed) | `asm-il/builder/` |
| 5.1.5 | Write ASM-IL conversion tests | `__tests__/asm-il/load-address-emitter.test.ts` |

**Deliverables**:
- [ ] LOAD_ADDRESS converted to low/high byte instructions
- [ ] Symbol labels resolved correctly
- [ ] All tests passing

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 6: CodeGen Layer

### Session 6.1: Generate 6502 Assembly

**Reference**: [06-codegen-layer.md](06-codegen-layer.md)

**Objective**: Generate `LDA #<symbol` / `LDA #>symbol` for address loading.

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.1.1 | Handle address low byte instruction | `codegen/instruction-generator.ts` |
| 6.1.2 | Handle address high byte instruction | `codegen/instruction-generator.ts` |
| 6.1.3 | Generate proper label references | `codegen/instruction-generator.ts` |
| 6.1.4 | Write CodeGen tests | `__tests__/codegen/address-generation.test.ts` |

**Deliverables**:
- [ ] Generates `LDA #<symbol` for low byte
- [ ] Generates `LDA #>symbol` for high byte
- [ ] Correct storage to 16-bit variables
- [ ] All tests passing

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 7: End-to-End Testing

### Session 7.1: Integration and E2E Tests

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Verify complete compilation pipeline works.

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.1.1 | Create E2E test for `@variable` | `__tests__/e2e/address-operator.test.ts` |
| 7.1.2 | Create E2E test for `@function` | `__tests__/e2e/address-operator.test.ts` |
| 7.1.3 | Create E2E test for callback parameters | `__tests__/e2e/address-operator.test.ts` |
| 7.1.4 | Verify all examples from requirements | Manual verification |
| 7.1.5 | Archive old design doc | Move `plans/features/address-of-operator-design.md` |

**Deliverables**:
- [ ] All E2E tests passing
- [ ] Full pipeline verified
- [ ] Old design doc archived

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Task Checklist (All Phases)

### Phase 1: IL Infrastructure
- [x] 1.1.1 Add LOAD_ADDRESS to ILOpcode enum
- [x] 1.1.2 Create LoadAddressInstruction class
- [x] 1.1.3 Add isLoadAddressInstruction type guard
- [x] 1.1.4 Export new types from index
- [ ] 1.1.5 Write unit tests (deferred to Phase 7)

### Phase 2: IL Builder
- [x] 2.1.1 Add emitLoadAddress method
- [x] 2.1.2 Import LoadAddressInstruction
- [ ] 2.1.3 Write unit tests (deferred to Phase 7)

### Phase 3: IL Generator - Address-of
- [x] 3.1.1 Add lookupFunction helper
- [x] 3.1.2 Add lookupVariable helper
- [x] 3.1.3 Replace ADDRESS case
- [x] 3.1.4 Handle variable address
- [x] 3.1.5 Handle function address
- [x] 3.1.6 Add error handling
- [ ] 3.1.7 Write @variable tests (deferred to Phase 7)
- [ ] 3.1.8 Write @function tests (deferred to Phase 7)
- [ ] 3.1.9 Write error case tests (deferred to Phase 7)

### Phase 4: IL Generator - Callbacks
- [x] 4.1.1 Add function lookup to generateIdentifierExpression
- [x] 4.1.2 Emit LOAD_ADDRESS for functions
- [ ] 4.1.3 Write callback tests (deferred to Phase 7)

### Phase 5: ASM-IL Layer (merged with Phase 6)
- [x] 5.1.1 Add LOAD_ADDRESS case
- [x] 5.1.2 Implement emitLoadAddress
- [x] 5.1.3 Add resolveSymbolLabel
- [x] 5.1.4 Add new ASM-IL types (if needed) - N/A
- [ ] 5.1.5 Write ASM-IL tests (deferred to Phase 7)

### Phase 6: CodeGen Layer (merged into Phase 5)
- [x] 6.1.1 Handle address low byte
- [x] 6.1.2 Handle address high byte
- [x] 6.1.3 Generate label references
- [ ] 6.1.4 Write CodeGen tests (deferred to Phase 7)

### Phase 7: End-to-End Testing
- [x] 7.1.1 E2E test for @variable ✅ (in address-operator-integration.test.ts)
- [x] 7.1.2 E2E test for @function ✅ (in address-operator-integration.test.ts)
- [x] 7.1.3 E2E test for callbacks ✅ (in address-operator-integration.test.ts)
- [x] 7.1.4 Verify all examples ✅ (C64 patterns: IRQ, buffers, tables)
- [x] 7.1.5 Archive old design doc ✅ (moved to plans/archive/features/)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/address-operator/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
clear && yarn clean && yarn build && yarn test

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
Phase 1 (IL Infrastructure)
    ↓
Phase 2 (IL Builder)
    ↓
Phase 3 (IL Generator - Address-of)
    ↓
Phase 4 (IL Generator - Callbacks)
    ↓
Phase 5 (ASM-IL Layer)
    ↓
Phase 6 (CodeGen Layer)
    ↓
Phase 7 (E2E Testing)
```

All phases must be completed in order. Each phase depends on the previous.

---

## Success Criteria

**Feature is complete when**:

1. ✅ All 7 phases completed
2. ✅ All tests passing (`yarn test`)
3. ✅ No compiler warnings
4. ✅ E2E tests verify full pipeline
5. ✅ Documentation updated
6. ✅ Old design doc archived