# Execution Plan: ASM-IL Mandatory

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

## Implementation Phases

| Phase | Title                           | Sessions | Est. Time   |
| ----- | ------------------------------- | -------- | ----------- |
| 1     | Baseline & Preparation          | 1        | 20 min      |
| 2     | AsmModuleBuilder Enhancements   | 1-2      | 30-40 min   |
| 3     | BaseCodeGenerator Refactor      | 1-2      | 30-40 min   |
| 4     | InstructionGenerator Refactor   | 2        | 40-60 min   |
| 5     | CodeGenerator & Emitter Updates | 1        | 20-30 min   |
| 6     | Testing & Validation            | 1        | 20-30 min   |

**Total: 7-9 sessions, ~3-4 hours**

---

## Phase 1: Baseline & Preparation

### Session 1.1: Capture Baseline & Setup

**Reference**: [02-current-state.md](02-current-state.md)

**Objective**: Document current output and prepare for refactoring

**Tasks**:

| #     | Task                                            | File                              |
| ----- | ----------------------------------------------- | --------------------------------- |
| 1.1.1 | Create baseline assembly snapshots              | `fixtures/baseline/`              |
| 1.1.2 | Document AssemblyWriter usage in CodeGenerator  | (analysis only)                   |
| 1.1.3 | Verify current test pass rate                   | Run `./compiler-test`             |

**Deliverables**:
- [ ] Baseline assembly files saved
- [ ] Current test status documented
- [ ] List of all files requiring changes

**Verify**: `./compiler-test`

---

## Phase 2: AsmModuleBuilder Enhancements

### Session 2.1: Add Source Location Support

**Reference**: [04-asm-il-builder.md](04-asm-il-builder.md)

**Objective**: Add source location parameter to all builder methods

**Tasks**:

| #     | Task                                             | File                                      |
| ----- | ------------------------------------------------ | ----------------------------------------- |
| 2.1.1 | Add `sourceLocation` param to all LDA methods    | `asm-il/builder/load-store-builder.ts`    |
| 2.1.2 | Add `sourceLocation` param to all STA methods    | `asm-il/builder/load-store-builder.ts`    |
| 2.1.3 | Add `sourceLocation` param to branch/jump        | `asm-il/builder/branch-jump-builder.ts`   |
| 2.1.4 | Add `sourceLocation` param to arithmetic         | `asm-il/builder/arithmetic-builder.ts`    |
| 2.1.5 | Add `sourceLocation` param to logical            | `asm-il/builder/logical-builder.ts`       |
| 2.1.6 | Add unit tests for source location preservation | `__tests__/asm-il/builder/`               |

**Deliverables**:
- [ ] All builder methods accept `sourceLocation`
- [ ] Unit tests for location preservation
- [ ] All ASM-IL tests pass

**Verify**: `./compiler-test asm-il`

### Session 2.2: Add Missing Instructions (if needed)

**Reference**: [04-asm-il-builder.md](04-asm-il-builder.md)

**Objective**: Add any missing instruction methods to builder

**Tasks**:

| #     | Task                                      | File                                      |
| ----- | ----------------------------------------- | ----------------------------------------- |
| 2.2.1 | Add missing transfer instructions (TXA, etc) | `asm-il/builder/transfer-stack-builder.ts`|
| 2.2.2 | Add missing stack instructions (PHA, etc)   | `asm-il/builder/transfer-stack-builder.ts`|
| 2.2.3 | Add generic `instruction()` method          | `asm-il/builder/module-builder.ts`        |
| 2.2.4 | Add tests for new methods                   | `__tests__/asm-il/builder/`               |

**Deliverables**:
- [ ] All 6502 instructions supported
- [ ] Generic instruction method available
- [ ] Tests for new methods

**Verify**: `./compiler-test asm-il`

---

## Phase 3: BaseCodeGenerator Refactor

### Session 3.1: Remove Legacy Path

**Reference**: [03-codegen-refactor.md](03-codegen-refactor.md)

**Objective**: Remove AssemblyWriter and useAsmIL flag

**Tasks**:

| #     | Task                                           | File                           |
| ----- | ---------------------------------------------- | ------------------------------ |
| 3.1.1 | Remove `useAsmIL` property                     | `codegen/base-generator.ts`    |
| 3.1.2 | Remove `assemblyWriter` property               | `codegen/base-generator.ts`    |
| 3.1.3 | Update all emit methods to use only asmBuilder | `codegen/base-generator.ts`    |
| 3.1.4 | Add `currentSourceLocation` property           | `codegen/base-generator.ts`    |
| 3.1.5 | Run codegen tests, fix compilation errors      | Fix any broken imports         |

**Deliverables**:
- [ ] `useAsmIL` completely removed
- [ ] `assemblyWriter` removed from inheritance chain
- [ ] All emit methods use `asmBuilder` only
- [ ] Code compiles without errors

**Verify**: `yarn build && ./compiler-test codegen`

### Session 3.2: Fix BaseCodeGenerator Tests

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Fix any failing tests after refactor

**Tasks**:

| #     | Task                                     | File                                |
| ----- | ---------------------------------------- | ----------------------------------- |
| 3.2.1 | Update tests expecting AssemblyWriter    | `__tests__/codegen/`                |
| 3.2.2 | Add tests for new source location flow   | `__tests__/codegen/base-generator.test.ts` |
| 3.2.3 | Verify all emit methods work correctly   | `__tests__/codegen/`                |

**Deliverables**:
- [ ] All codegen unit tests pass
- [ ] New source location tests added

**Verify**: `./compiler-test codegen`

---

## Phase 4: InstructionGenerator Refactor

### Session 4.1: Update Tier 1 Instructions

**Reference**: [03-codegen-refactor.md](03-codegen-refactor.md)

**Objective**: Update fully translated instructions to pass source locations

**Tasks**:

| #     | Task                                           | File                                  |
| ----- | ---------------------------------------------- | ------------------------------------- |
| 4.1.1 | Update `generateConst()` to pass location      | `codegen/instruction-generator.ts`    |
| 4.1.2 | Update `generateHardwareWrite()` to pass location | `codegen/instruction-generator.ts` |
| 4.1.3 | Update `generateHardwareRead()` to pass location  | `codegen/instruction-generator.ts` |
| 4.1.4 | Update `generateReturnVoid/Return()`           | `codegen/instruction-generator.ts`    |
| 4.1.5 | Update `generateJump()`                        | `codegen/instruction-generator.ts`    |
| 4.1.6 | Run targeted tests                             | `./compiler-test codegen`             |

**Deliverables**:
- [ ] All Tier 1 instructions pass source locations
- [ ] Codegen tests pass

**Verify**: `./compiler-test codegen`

### Session 4.2: Update Tier 2 & 3 Instructions

**Reference**: [03-codegen-refactor.md](03-codegen-refactor.md)

**Objective**: Update remaining instructions to use ASM-IL only

**Tasks**:

| #     | Task                                           | File                                  |
| ----- | ---------------------------------------------- | ------------------------------------- |
| 4.2.1 | Update `generateBranch()`                      | `codegen/instruction-generator.ts`    |
| 4.2.2 | Update `generateLoadVar/StoreVar()`            | `codegen/instruction-generator.ts`    |
| 4.2.3 | Update `generateCall/CallVoid()`               | `codegen/instruction-generator.ts`    |
| 4.2.4 | Update `generateBinaryOp()`                    | `codegen/instruction-generator.ts`    |
| 4.2.5 | Update `generateUnaryOp()`                     | `codegen/instruction-generator.ts`    |
| 4.2.6 | Update `generateCpuInstruction()`              | `codegen/instruction-generator.ts`    |
| 4.2.7 | Update all intrinsic generators                | `codegen/instruction-generator.ts`    |
| 4.2.8 | Update `generatePlaceholder()`                 | `codegen/instruction-generator.ts`    |
| 4.2.9 | Run full codegen tests                         | `./compiler-test codegen`             |

**Deliverables**:
- [ ] All instruction generators use ASM-IL only
- [ ] Source locations passed to all instructions
- [ ] All codegen tests pass

**Verify**: `./compiler-test codegen`

---

## Phase 5: CodeGenerator & Emitter Updates

### Session 5.1: Update CodeGenerator Flow

**Reference**: [03-codegen-refactor.md](03-codegen-refactor.md), [05-source-location.md](05-source-location.md)

**Objective**: Update generate() to use ASM-IL → Emitter flow

**Tasks**:

| #     | Task                                             | File                              |
| ----- | ------------------------------------------------ | --------------------------------- |
| 5.1.1 | Update `generate()` to always build AsmModule    | `codegen/code-generator.ts`       |
| 5.1.2 | Add AcmeEmitter usage for text output            | `codegen/code-generator.ts`       |
| 5.1.3 | Implement `generateViceLabelsFromAsmIL()`        | `codegen/code-generator.ts`       |
| 5.1.4 | Implement `extractSourceMapFromAsmIL()`          | `codegen/code-generator.ts`       |
| 5.1.5 | Remove `generateWithAsmIL()` method              | `codegen/code-generator.ts`       |
| 5.1.6 | Update AcmeEmitter for source comments           | `asm-il/emitters/acme-emitter.ts` |
| 5.1.7 | Run integration tests                            | `./compiler-test codegen e2e`     |

**Deliverables**:
- [ ] `generate()` always produces AsmModule
- [ ] Text output comes from AcmeEmitter
- [ ] Source location comments in debug mode
- [ ] VICE labels from ASM-IL

**Verify**: `./compiler-test codegen e2e`

---

## Phase 6: Testing & Validation

### Session 6.1: Full Validation

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Verify complete system works correctly

**Tasks**:

| #     | Task                                        | File                    |
| ----- | ------------------------------------------- | ----------------------- |
| 6.1.1 | Run full test suite                         | `./compiler-test`       |
| 6.1.2 | Compare output to baseline snapshots        | (manual comparison)     |
| 6.1.3 | Fix any remaining regressions               | Various                 |
| 6.1.4 | Update documentation (remove useAsmIL refs) | `README.md`, JSDoc      |
| 6.1.5 | Update GAP-REPORT.md                        | `GAP-REPORT.md`         |
| 6.1.6 | Final verification                          | `./compiler-test`       |

**Deliverables**:
- [ ] All 7,000+ tests pass
- [ ] Assembly output matches or improves baseline
- [ ] Documentation updated
- [ ] No regressions

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Baseline & Preparation
- [ ] 1.1.1 Create baseline assembly snapshots
- [ ] 1.1.2 Document AssemblyWriter usage
- [ ] 1.1.3 Verify current test pass rate

### Phase 2: AsmModuleBuilder Enhancements
- [ ] 2.1.1 Add sourceLocation to LDA methods
- [ ] 2.1.2 Add sourceLocation to STA methods
- [ ] 2.1.3 Add sourceLocation to branch/jump
- [ ] 2.1.4 Add sourceLocation to arithmetic
- [ ] 2.1.5 Add sourceLocation to logical
- [ ] 2.1.6 Add unit tests for source location
- [ ] 2.2.1 Add missing transfer instructions
- [ ] 2.2.2 Add missing stack instructions
- [ ] 2.2.3 Add generic instruction() method
- [ ] 2.2.4 Add tests for new methods

### Phase 3: BaseCodeGenerator Refactor
- [ ] 3.1.1 Remove useAsmIL property
- [ ] 3.1.2 Remove assemblyWriter property
- [ ] 3.1.3 Update emit methods to asmBuilder only
- [ ] 3.1.4 Add currentSourceLocation property
- [ ] 3.1.5 Fix compilation errors
- [ ] 3.2.1 Update tests expecting AssemblyWriter
- [ ] 3.2.2 Add source location flow tests
- [ ] 3.2.3 Verify emit methods work

### Phase 4: InstructionGenerator Refactor
- [ ] 4.1.1-4.1.5 Update Tier 1 instructions
- [ ] 4.1.6 Run targeted tests
- [ ] 4.2.1-4.2.8 Update Tier 2 & 3 instructions
- [ ] 4.2.9 Run full codegen tests

### Phase 5: CodeGenerator & Emitter
- [ ] 5.1.1 Update generate() for AsmModule
- [ ] 5.1.2 Add AcmeEmitter usage
- [ ] 5.1.3 Implement VICE labels from ASM-IL
- [ ] 5.1.4 Implement source map extraction
- [ ] 5.1.5 Remove generateWithAsmIL()
- [ ] 5.1.6 Update AcmeEmitter for source comments
- [ ] 5.1.7 Run integration tests

### Phase 6: Testing & Validation
- [ ] 6.1.1 Run full test suite
- [ ] 6.1.2 Compare to baseline
- [ ] 6.1.3 Fix regressions
- [ ] 6.1.4 Update documentation
- [ ] 6.1.5 Update GAP-REPORT.md
- [ ] 6.1.6 Final verification

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/asm-il-mandatory/99-execution-plan.md"
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
Phase 1 (Baseline)
    ↓
Phase 2 (AsmBuilder)
    ↓
Phase 3 (BaseCodeGenerator)
    ↓
Phase 4 (InstructionGenerator)
    ↓
Phase 5 (CodeGenerator)
    ↓
Phase 6 (Validation)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ All phases completed
2. ✅ `useAsmIL` flag removed
3. ✅ `AssemblyWriter` removed from CodeGenerator chain
4. ✅ All code generation uses ASM-IL exclusively
5. ✅ Source locations on all ASM-IL nodes
6. ✅ All 7,000+ tests passing
7. ✅ Assembly output equivalent or improved
8. ✅ Documentation updated