# Execution Plan: Code Generator

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-04-02 17:38
> **Progress**: Implementation COMPLETE, CGT1-CGT6 COMPLETE

## Current Status

### ✅ Implementation COMPLETE

The code generator implementation uses an **inheritance chain architecture**:

```
CodeGeneratorBase → MemoryOps → ArithmeticOps → BitwiseOps
→ ComparisonOps → ControlFlowOps → FunctionOps → IntrinsicsOps → CodeGenerator
```

**Files Created:**

| File | Purpose | Status |
|------|---------|--------|
| `asm-il/types.ts` | ASM-IL types, enums, interfaces, type guards | ✅ |
| `asm-il/builder.ts` | ASM-IL builder with fluent API | ✅ |
| `asm-il/index.ts` | ASM-IL exports | ✅ |
| `generator/base.ts` | Accumulator tracking, operand helpers, label mgmt | ✅ |
| `generator/memory.ts` | LOAD_BYTE, STORE_BYTE, LOAD_WORD, STORE_WORD, LOAD_IMM | ✅ |
| `generator/arithmetic.ts` | ADD, SUB, MUL, DIV, MOD, NEG, INC, DEC | ✅ |
| `generator/bitwise.ts` | AND, OR, XOR, NOT, SHL, SHR | ✅ |
| `generator/comparison.ts` | CMP, CMPW | ✅ |
| `generator/control.ts` | LABEL, JUMP, JUMP_EQ/NE/LT/LE/GE/GT, NOP, transfers | ✅ |
| `generator/functions.ts` | CALL, RETURN | ✅ |
| `generator/intrinsics.ts` | PEEK, POKE, PEEKW, POKEW, HI, LO | ✅ |
| `generator/generator.ts` | Final CodeGenerator class | ✅ |
| `generator/index.ts` | Generator exports | ✅ |
| `index.ts` | Main codegen exports | ✅ |

### ❌ Tests MISSING

No test files exist in `__tests__/codegen/`.

---

## Remaining Work: Add Tests

### Phase CGT1: ASM-IL Tests

**Objective**: Test ASM-IL types and builder

| # | Task | File |
|---|------|------|
| CGT1.1 | Create ASM-IL types tests | `__tests__/codegen/asm-il/types.test.ts` |
| CGT1.2 | Create ASM-IL builder tests | `__tests__/codegen/asm-il/builder.test.ts` |

**Test Coverage:**
- All AsmAddressingMode enum values
- All factory functions (createInstructionElement, etc.)
- All type guards (isInstructionElement, etc.)
- AsmILBuilder methods (instruction, label, directive, comment, blank)
- AsmILBuilder instruction helpers (lda, sta, ldx, stx, etc.)
- Build method produces valid AsmILProgram

---

### Phase CGT2: Base Generator Tests

**Objective**: Test base generator infrastructure

| # | Task | File |
|---|------|------|
| CGT2.1 | Create accumulator state tests | `__tests__/codegen/generator/accumulator.test.ts` |
| CGT2.2 | Create operand extraction tests | `__tests__/codegen/generator/operands.test.ts` |
| CGT2.3 | Create address mode tests | `__tests__/codegen/generator/address-mode.test.ts` |

**Test Coverage:**
- AccumulatorState tracking (createUnknownAState, createSlotAState, etc.)
- aHasSlot, aHasImmediate checks
- Operand extraction (getSlotOperand, getImmediateOperand, etc.)
- Address mode selection (getLoadMode, getStoreMode)
- Label management (uniqueLabel, localLabel)

---

### Phase CGT3: Unit Tests - Memory Operations

**Objective**: Test memory operation code generation

| # | Task | File |
|---|------|------|
| CGT3.1 | Create LOAD_BYTE tests | `__tests__/codegen/unit/memory-ops.test.ts` |
| CGT3.2 | Create STORE_BYTE tests | `__tests__/codegen/unit/memory-ops.test.ts` |
| CGT3.3 | Create LOAD_WORD tests | `__tests__/codegen/unit/memory-ops.test.ts` |
| CGT3.4 | Create STORE_WORD tests | `__tests__/codegen/unit/memory-ops.test.ts` |
| CGT3.5 | Create LOAD_IMM tests | `__tests__/codegen/unit/memory-ops.test.ts` |
| CGT3.6 | Create LOAD_IMM_WORD tests | `__tests__/codegen/unit/memory-ops.test.ts` |
| CGT3.7 | Test ZP vs ABS addressing | `__tests__/codegen/unit/memory-ops.test.ts` |
| CGT3.8 | Test accumulator tracking optimization | `__tests__/codegen/unit/memory-ops.test.ts` |

---

### Phase CGT4: Unit Tests - Arithmetic Operations

**Objective**: Test arithmetic operation code generation

| # | Task | File |
|---|------|------|
| CGT4.1 | Create ADD tests | `__tests__/codegen/unit/arithmetic.test.ts` |
| CGT4.2 | Create SUB tests | `__tests__/codegen/unit/arithmetic.test.ts` |
| CGT4.3 | Create MUL tests | `__tests__/codegen/unit/arithmetic.test.ts` |
| CGT4.4 | Create DIV tests | `__tests__/codegen/unit/arithmetic.test.ts` |
| CGT4.5 | Create MOD tests | `__tests__/codegen/unit/arithmetic.test.ts` |
| CGT4.6 | Create NEG tests | `__tests__/codegen/unit/arithmetic.test.ts` |
| CGT4.7 | Create INC tests | `__tests__/codegen/unit/arithmetic.test.ts` |
| CGT4.8 | Create DEC tests | `__tests__/codegen/unit/arithmetic.test.ts` |

---

### Phase CGT5: Unit Tests - Bitwise Operations

**Objective**: Test bitwise operation code generation

| # | Task | File |
|---|------|------|
| CGT5.1 | Create AND tests | `__tests__/codegen/unit/bitwise.test.ts` |
| CGT5.2 | Create OR tests | `__tests__/codegen/unit/bitwise.test.ts` |
| CGT5.3 | Create XOR tests | `__tests__/codegen/unit/bitwise.test.ts` |
| CGT5.4 | Create NOT tests | `__tests__/codegen/unit/bitwise.test.ts` |
| CGT5.5 | Create SHL tests | `__tests__/codegen/unit/bitwise.test.ts` |
| CGT5.6 | Create SHR tests | `__tests__/codegen/unit/bitwise.test.ts` |

---

### Phase CGT6: Unit Tests - Comparison & Control Flow

**Objective**: Test comparison and control flow code generation

| # | Task | File |
|---|------|------|
| CGT6.1 | Create CMP tests | `__tests__/codegen/unit/comparison.test.ts` |
| CGT6.2 | Create CMPW tests | `__tests__/codegen/unit/comparison.test.ts` |
| CGT6.3 | Create LABEL tests | `__tests__/codegen/unit/control-flow.test.ts` |
| CGT6.4 | Create JUMP tests | `__tests__/codegen/unit/control-flow.test.ts` |
| CGT6.5 | Create JUMP_EQ tests | `__tests__/codegen/unit/control-flow.test.ts` |
| CGT6.6 | Create JUMP_NE tests | `__tests__/codegen/unit/control-flow.test.ts` |
| CGT6.7 | Create JUMP_LT tests | `__tests__/codegen/unit/control-flow.test.ts` |
| CGT6.8 | Create JUMP_GE tests | `__tests__/codegen/unit/control-flow.test.ts` |
| CGT6.9 | Create JUMP_LE tests | `__tests__/codegen/unit/control-flow.test.ts` |
| CGT6.10 | Create JUMP_GT tests | `__tests__/codegen/unit/control-flow.test.ts` |

---

### Phase CGT7: Unit Tests - Functions & Intrinsics

**Objective**: Test function and intrinsic code generation

| # | Task | File |
|---|------|------|
| CGT7.1 | Create CALL tests | `__tests__/codegen/unit/functions.test.ts` |
| CGT7.2 | Create RETURN tests | `__tests__/codegen/unit/functions.test.ts` |
| CGT7.3 | Create PEEK tests | `__tests__/codegen/unit/intrinsics.test.ts` |
| CGT7.4 | Create POKE tests | `__tests__/codegen/unit/intrinsics.test.ts` |
| CGT7.5 | Create PEEKW tests | `__tests__/codegen/unit/intrinsics.test.ts` |
| CGT7.6 | Create POKEW tests | `__tests__/codegen/unit/intrinsics.test.ts` |
| CGT7.7 | Create HI tests | `__tests__/codegen/unit/intrinsics.test.ts` |
| CGT7.8 | Create LO tests | `__tests__/codegen/unit/intrinsics.test.ts` |

---

### Phase CGT8: Integration Tests

**Objective**: Test code generation with real IL programs

| # | Task | File |
|---|------|------|
| CGT8.1 | Create expression integration tests | `__tests__/codegen/integration/expressions.test.ts` |
| CGT8.2 | Create assignment integration tests | `__tests__/codegen/integration/assignments.test.ts` |
| CGT8.3 | Create control structure tests | `__tests__/codegen/integration/control-structures.test.ts` |
| CGT8.4 | Create function chain tests | `__tests__/codegen/integration/function-chains.test.ts` |

---

### Phase CGT9: E2E Tests

**Objective**: Test complete pipeline from source to ASM-IL

| # | Task | File |
|---|------|------|
| CGT9.1 | Create E2E simple program tests | `__tests__/codegen/e2e/simple-programs.test.ts` |
| CGT9.2 | Create E2E control flow tests | `__tests__/codegen/e2e/control-flow.test.ts` |
| CGT9.3 | Create E2E function tests | `__tests__/codegen/e2e/functions.test.ts` |
| CGT9.4 | Create E2E intrinsic tests | `__tests__/codegen/e2e/intrinsics.test.ts` |

---

### Phase CGT10: ASM-IL Emitter (Still Needed!)

**Objective**: Create emitter to convert ASM-IL to ACME text output

| # | Task | File |
|---|------|------|
| CGT10.1 | Create AsmILEmitter class | `codegen/asm-il/emitter.ts` |
| CGT10.2 | Implement emit() for full program | `codegen/asm-il/emitter.ts` |
| CGT10.3 | Implement emitInstruction() | `codegen/asm-il/emitter.ts` |
| CGT10.4 | Implement emitLabel() | `codegen/asm-il/emitter.ts` |
| CGT10.5 | Implement emitDirective() | `codegen/asm-il/emitter.ts` |
| CGT10.6 | Add emitter unit tests | `__tests__/codegen/asm-il/emitter.test.ts` |
| CGT10.7 | Add E2E emit tests | `__tests__/codegen/e2e/emit.test.ts` |

---

## Task Checklist

### Implementation (COMPLETE)

- [x] ~~ASM-IL types~~ ✅
- [x] ~~ASM-IL builder~~ ✅
- [x] ~~CodeGeneratorBase~~ ✅
- [x] ~~MemoryOpsGenerator~~ ✅
- [x] ~~ArithmeticOpsGenerator~~ ✅
- [x] ~~BitwiseOpsGenerator~~ ✅
- [x] ~~ComparisonOpsGenerator~~ ✅
- [x] ~~ControlFlowOpsGenerator~~ ✅
- [x] ~~FunctionOpsGenerator~~ ✅
- [x] ~~IntrinsicsOpsGenerator~~ ✅
- [x] ~~CodeGenerator (final class)~~ ✅

### Tests (TODO)

**Phase CGT1: ASM-IL Tests**
- [x] CGT1.1 ASM-IL types tests ✅ (completed: 2026-04-02 14:46)
- [x] CGT1.2 ASM-IL builder tests ✅ (completed: 2026-04-02 14:46)

**Phase CGT2: Base Generator Tests**
- [x] CGT2.1 Accumulator state tests ✅ (completed: 2026-04-02 15:02)
- [x] CGT2.2 Operand extraction tests ✅ (completed: 2026-04-02 15:02)
- [x] CGT2.3 Address mode tests ✅ (completed: 2026-04-02 15:02)

**Phase CGT3: Memory Operations Tests**
- [x] CGT3.1-CGT3.8 Memory operation unit tests ✅ (completed: 2026-04-02 15:19)

**Phase CGT4: Arithmetic Operations Tests**
- [x] CGT4.1-CGT4.8 Arithmetic operation unit tests ✅ (completed: 2026-04-02 15:45)

**Phase CGT5: Bitwise Operations Tests**
- [x] CGT5.1-CGT5.6 Bitwise operation unit tests ✅ (completed: 2026-04-02 17:11)

**Phase CGT6: Comparison & Control Flow Tests**
- [x] CGT6.1-CGT6.10 Comparison and control flow unit tests ✅ (completed: 2026-04-02 17:38)

**Phase CGT7: Functions & Intrinsics Tests**
- [ ] CGT7.1-CGT7.8 Function and intrinsic unit tests

**Phase CGT8: Integration Tests**
- [ ] CGT8.1-CGT8.4 Integration tests

**Phase CGT9: E2E Tests**
- [ ] CGT9.1-CGT9.4 E2E tests

**Phase CGT10: ASM-IL Emitter**
- [ ] CGT10.1-CGT10.7 Emitter implementation and tests

---

## Recommended Session Breakdown

| Session | Phase | Est. Time | Tests Added |
|---------|-------|-----------|-------------|
| 1 | CGT1 + CGT2 | 2-3 hours | ~50 tests |
| 2 | CGT3 | 2-3 hours | ~40 tests |
| 3 | CGT4 + CGT5 | 2-3 hours | ~50 tests |
| 4 | CGT6 | 2-3 hours | ~40 tests |
| 5 | CGT7 | 2-3 hours | ~40 tests |
| 6 | CGT8 | 2-3 hours | ~30 tests |
| 7 | CGT9 | 2-3 hours | ~30 tests |
| 8 | CGT10 | 2-3 hours | ~30 tests |

**Total: 8 sessions, ~300+ tests**

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase CGTX per plans/compiler-v2/codegen/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test codegen

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Success Criteria

**Phase 8 (Code Generator) is COMPLETE when**:

1. ✅ All generator files implemented (DONE)
2. ❌ 300+ tests passing (TODO)
3. ❌ ASM-IL emitter implemented (TODO)
4. ❌ Full pipeline: Source → CodeGen → ASM-IL → Emitter → .asm file
5. ❌ Ready for Phase 9 (ASM-IL Optimizer)