# Execution Plan: Global Variables & Storage Classes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-02 06:55
> **Progress**: 21/55 tasks (38%)

## Overview

This document defines the execution phases and AI chat sessions for implementing global variable support with storage classes.

**🚨 PREREQUISITE: optimizer-v2 Phase 4 must be complete before starting!**

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time | Reference |
|-------|-------|----------|-----------|-----------|
| 1 | Foundation & Language Spec | 2 | 3-4 hr | 02, 03 |
| 2 | Global Allocator | 3 | 5-7 hr | 03 |
| 3 | IL Generator (Phase 7c) | 3 | 5-7 hr | 05 |
| 4 | Codegen & Data Segment | 3 | 5-7 hr | 04, 06 |
| 5 | Optimizer Protection | 2 | 2-4 hr | 07 |
| 6 | E2E Integration & Polish | 2 | 3-4 hr | 08 |

**Total: ~15 sessions, ~23-33 hours**

---

## Phase 1: Foundation & Language Spec

### Session 1.1: Enum Extensions + Semantic Metadata

**Reference**: [03-global-allocator.md](03-global-allocator.md)

**Objective**: Extend enums, types, and semantic analyzer to support all storage classes.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add `Data` variant to `ZpDirective` enum | `frame/enums.ts` |
| 1.1.2 | Add `GlobalSlot` and `GlobalAllocationResult` types | `frame/types.ts` or new file |
| 1.1.3 | Update `symbol-table-builder.ts` to store ALL storage class metadata | `semantic/visitors/symbol-table-builder.ts` |
| 1.1.4 | Add `@data` validation: must be const + have initializer | `semantic/visitors/symbol-table-builder.ts` or `type-checker` |
| 1.1.5 | Update `frame-calculator.ts` `getZpDirective()` to handle `@data` | `frame/allocator/frame-calculator.ts` |
| 1.1.6 | Write unit tests for enum + metadata changes (~15 tests) | `__tests__/` |

**Verify**: `./compiler-test semantic` then `./compiler-test`

---

### Session 1.2: Language Specification Update

**Reference**: [00-index.md](00-index.md)

**Objective**: Update language spec to document storage class rules.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.2.1 | Update `03-variables.md` with storage class section | `docs/language-specification-v2/03-variables.md` |
| 1.2.2 | Add `@data` rules, examples, EBNF grammar | `docs/language-specification-v2/03-variables.md` |
| 1.2.3 | Document module-level only restriction | `docs/language-specification-v2/03-variables.md` |
| 1.2.4 | Add cross-module @zp export/import docs | `docs/language-specification-v2/07-modules.md` |
| 1.2.5 | Update README table of contents | `docs/language-specification-v2/README.md` |

**Verify**: Review documents for consistency

---

## Phase 2: Global Allocator

### Session 2.1: GlobalAllocator Core

**Reference**: [03-global-allocator.md](03-global-allocator.md)

**Objective**: Create the GlobalAllocator class that assigns addresses.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Create `GlobalAllocator` class skeleton | `frame/allocator/global-allocator.ts` |
| 2.1.2 | Implement `collectGlobals()` — walk programs for module-level VariableDecls | `frame/allocator/global-allocator.ts` |
| 2.1.3 | Implement `categorizeByStorageClass()` — separate @zp/@ram/@data/default | `frame/allocator/global-allocator.ts` |
| 2.1.4 | Implement `allocateZpGlobals()` — ZP pool allocation | `frame/allocator/global-allocator.ts` |
| 2.1.5 | Write unit tests for core allocation (~15 tests) | `__tests__/frame/` |

**Verify**: `./compiler-test`

---

### Session 2.2: RAM + Data Segment Allocation

**Reference**: [03-global-allocator.md](03-global-allocator.md), [04-data-segment.md](04-data-segment.md)

**Objective**: Complete RAM and data segment address assignment.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.2.1 | Implement `allocateRamGlobals()` — RAM region addresses | `frame/allocator/global-allocator.ts` |
| 2.2.2 | Implement `allocateDataGlobals()` — data segment addresses | `frame/allocator/global-allocator.ts` |
| 2.2.3 | Implement `allocate()` — full orchestration method | `frame/allocator/global-allocator.ts` |
| 2.2.4 | Add error handling and diagnostics | `frame/allocator/global-allocator.ts` |
| 2.2.5 | Write tests for RAM + data allocation (~10 tests) | `__tests__/frame/` |

**Verify**: `./compiler-test`

---

### Session 2.3: Pipeline Integration + ZP Pool Sharing

**Reference**: [03-global-allocator.md](03-global-allocator.md)

**Objective**: Integrate GlobalAllocator into Frame Phase and share ZP pool.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.3.1 | Modify `FrameAllocator` to accept pre-used ZP pool | `frame/allocator/frame-allocator.ts` |
| 2.3.2 | Update `FramePhase.execute()` to run GlobalAllocator first | `pipeline/frame-phase.ts` |
| 2.3.3 | Pass GlobalAllocationResult through pipeline | `pipeline/types.ts` |
| 2.3.4 | Extend `GlobalSymbolTable` to carry allocated addresses | `semantic/global-symbol-table.ts` |
| 2.3.5 | Write integration tests for pipeline flow (~10 tests) | `__tests__/pipeline/` |

**Verify**: `./compiler-test`

---

## Phase 3: IL Generator (Phase 7c)

### Session 3.1: Global Slot Resolution

**Reference**: [05-il-generator-globals.md](05-il-generator-globals.md)

**Objective**: IL generator can resolve global variable references.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add `globalSlots` map to ILGenerator constructor | `il/generator/base.ts` |
| 3.1.2 | Implement global variable resolution in `resolveVariable()` | `il/generator/base.ts` |
| 3.1.3 | Update `ILPhase` to pass GlobalAllocationResult to ILGenerator | `pipeline/il-phase.ts` |
| 3.1.4 | Write tests for global slot resolution (~10 tests) | `__tests__/il/` |

**Verify**: `./compiler-test il`

---

### Session 3.2: Global Initialization IL

**Reference**: [05-il-generator-globals.md](05-il-generator-globals.md)

**Objective**: Generate proper IL for global variable initialization.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.2.1 | Complete `generateGlobalInit()` for @zp/@ram globals | `il/generator/generator.ts` |
| 3.2.2 | Skip @data globals in generateGlobalInit (no init IL) | `il/generator/generator.ts` |
| 3.2.3 | Add volatile flag to @zp global instructions | `il/generator/generator.ts` |
| 3.2.4 | Write tests for global init IL (~10 tests) | `__tests__/il/` |

**Verify**: `./compiler-test il`

---

### Session 3.3: Global Access Expressions

**Reference**: [05-il-generator-globals.md](05-il-generator-globals.md)

**Objective**: Generate load/store IL for global variable access in expressions.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.3.1 | Implement global load in expression visitor | `il/generator/expressions.ts` |
| 3.3.2 | Implement global store in assignment handling | `il/generator/statements.ts` or `expressions.ts` |
| 3.3.3 | Handle global in binary expressions, conditions, function args | `il/generator/expressions.ts` |
| 3.3.4 | Write tests for global access IL (~15 tests) | `__tests__/il/` |

**Verify**: `./compiler-test il` then `./compiler-test`

---

## Phase 4: Codegen & Data Segment

### Session 4.1: Global Addressing in Codegen

**Reference**: [06-codegen-globals.md](06-codegen-globals.md)

**Objective**: Generate 6502 instructions for global variable access.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Fix `getAddressOperand()` to handle global addresses | `codegen/generator/base.ts` |
| 4.1.2 | Implement ZP-mode instruction selection for @zp globals | `codegen/generator/` |
| 4.1.3 | Implement absolute-mode for @ram globals | `codegen/generator/` |
| 4.1.4 | Write codegen tests for global addressing (~10 tests) | `__tests__/codegen/` |

**Verify**: `./compiler-test codegen`

---

### Session 4.2: Data Segment Builder

**Reference**: [04-data-segment.md](04-data-segment.md)

**Objective**: Build data segment with raw bytes for @data blocks.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.2.1 | Create `DataSegmentBuilder` class | `codegen/data-segment.ts` |
| 4.2.2 | Implement constant evaluation for initializers | `codegen/data-segment.ts` |
| 4.2.3 | Implement byte packing for arrays | `codegen/data-segment.ts` |
| 4.2.4 | Write tests for data segment building (~15 tests) | `__tests__/codegen/` |

**Verify**: `./compiler-test codegen`

---

### Session 4.3: Binary Layout Integration

**Reference**: [04-data-segment.md](04-data-segment.md), [06-codegen-globals.md](06-codegen-globals.md)

**Objective**: Integrate data segment into binary output.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.3.1 | Update binary emitter to append data segment | `codegen/` |
| 4.3.2 | Generate global init code that runs before main() | `codegen/generator/` |
| 4.3.3 | Integrate GlobalAllocationResult into codegen pipeline | `pipeline/` |
| 4.3.4 | Write binary layout tests (~10 tests) | `__tests__/codegen/` |

**Verify**: `./compiler-test codegen` then `./compiler-test`

---

## Phase 5: Optimizer Protection

### Session 5.1: Dead Global Elim + Volatile Flags

**Reference**: [07-optimizer-protection.md](07-optimizer-protection.md)

**Objective**: Protect @zp and @data globals from optimization.

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.1.1 | Add @zp/@data protection to `DeadGlobalElimPass` | `optimizer/passes/dead-global-elim.ts` |
| 5.1.2 | Add volatile awareness to `CSEPass` for @zp globals | `optimizer/passes/cse.ts` |
| 5.1.3 | Add volatile awareness to `LICMPass` for @zp globals | `optimizer/passes/licm.ts` |
| 5.1.4 | Write optimizer protection tests (~15 tests) | `__tests__/optimizer/` |

**Verify**: `./compiler-test optimizer` then `./compiler-test`

---

### Session 5.2: Optimizer Regression Testing

**Reference**: [08-testing-strategy.md](08-testing-strategy.md)

**Objective**: Ensure no optimizer regressions with new global support.

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.2.1 | Run full test suite, fix any regressions | All |
| 5.2.2 | Write optimizer E2E tests with globals (~10 tests) | `__tests__/optimizer/` |
| 5.2.3 | Verify border-cycle and existing examples still compile | `examples/` |

**Verify**: `./compiler-test`

---

## Phase 6: E2E Integration & Polish

### Session 6.1: E2E Pipeline Tests

**Reference**: [08-testing-strategy.md](08-testing-strategy.md)

**Objective**: End-to-end testing of complete global variable support.

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.1.1 | Create E2E test: sprite-test.blend compilation | `__tests__/e2e/` |
| 6.1.2 | Create E2E test: cross-module @zp sharing | `__tests__/e2e/` |
| 6.1.3 | Create E2E test: @data sprite data in binary | `__tests__/e2e/` |
| 6.1.4 | Create E2E test: mixed storage classes | `__tests__/e2e/` |
| 6.1.5 | Create E2E test: ZP overflow error handling | `__tests__/e2e/` |
| 6.1.6 | Write remaining edge case tests (~10 tests) | `__tests__/` |

**Verify**: `./compiler-test`

---

### Session 6.2: Parser Error Messages + Final Polish

**Objective**: Clear error messages and final cleanup.

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.2.1 | Add clear error for storage class inside functions | `parser/statements.ts` |
| 6.2.2 | Add clear ZP overflow error with usage stats | `frame/allocator/global-allocator.ts` |
| 6.2.3 | Final review: all JSDoc, comments, code quality | All new files |
| 6.2.4 | Run full test suite: verify all 8000+ existing + ~140 new tests pass | All |

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Foundation & Language Spec

- [x] 1.1.1 Add Data to ZpDirective enum ✅ (completed: 2026-10-02 03:14)
- [x] 1.1.2 Add GlobalSlot and GlobalAllocationResult types ✅ (completed: 2026-10-02 03:14)
- [x] 1.1.3 Update symbol-table-builder for all storage class metadata ✅ (completed: 2026-10-02 03:14)
- [x] 1.1.4 Add @data validation (const + initializer) ✅ (completed: 2026-10-02 03:14)
- [x] 1.1.5 Update getZpDirective() for @data ✅ (completed: 2026-10-02 03:14)
- [x] 1.1.6 Write foundation tests (~29 tests) ✅ (completed: 2026-10-02 03:14)
- [x] 1.2.1 Update 03-variables.md with storage class section ✅ (completed: 2026-10-02 06:44)
- [x] 1.2.2 Add @data rules and EBNF grammar ✅ (completed: 2026-10-02 06:44)
- [x] 1.2.3 Document module-level only restriction ✅ (completed: 2026-10-02 06:44)
- [x] 1.2.4 Add cross-module @zp docs to 07-modules.md ✅ (completed: 2026-10-02 06:45)
- [x] 1.2.5 Update README table of contents ✅ (completed: 2026-10-02 06:45 — already up to date)

### Phase 2: Global Allocator

- [x] 2.1.1 Create GlobalAllocator skeleton ✅ (completed: 2026-10-02 06:50)
- [x] 2.1.2 Implement collectGlobals() ✅ (completed: 2026-10-02 06:50)
- [x] 2.1.3 Implement categorizeByStorageClass() ✅ (completed: 2026-10-02 06:50)
- [x] 2.1.4 Implement allocateZpGlobals() ✅ (completed: 2026-10-02 06:50)
- [x] 2.1.5 Write core allocation tests (26 tests) ✅ (completed: 2026-10-02 06:55)
- [x] 2.2.1 Implement allocateRamGlobals() ✅ (completed: 2026-10-02 06:50 — included in initial implementation)
- [x] 2.2.2 Implement allocateDataGlobals() ✅ (completed: 2026-10-02 06:50 — included in initial implementation)
- [x] 2.2.3 Implement allocate() orchestration ✅ (completed: 2026-10-02 06:50 — included in initial implementation)
- [x] 2.2.4 Add error handling and diagnostics ✅ (completed: 2026-10-02 06:50 — ZP overflow diagnostics)
- [x] 2.2.5 Write RAM + data tests ✅ (completed: 2026-10-02 06:55 — included in 26-test suite)
- [ ] 2.3.1 Modify FrameAllocator for pre-used ZP pool
- [ ] 2.3.2 Update FramePhase.execute() for GlobalAllocator
- [ ] 2.3.3 Pass GlobalAllocationResult through pipeline
- [ ] 2.3.4 Extend GlobalSymbolTable for allocated addresses
- [ ] 2.3.5 Write pipeline integration tests (~10)

### Phase 3: IL Generator (Phase 7c)

- [ ] 3.1.1 Add globalSlots map to ILGenerator
- [ ] 3.1.2 Implement global variable resolution
- [ ] 3.1.3 Update ILPhase for GlobalAllocationResult
- [ ] 3.1.4 Write global slot resolution tests (~10)
- [ ] 3.2.1 Complete generateGlobalInit() for @zp/@ram
- [ ] 3.2.2 Skip @data in generateGlobalInit
- [ ] 3.2.3 Add volatile flag to @zp instructions
- [ ] 3.2.4 Write global init IL tests (~10)
- [ ] 3.3.1 Implement global load in expressions
- [ ] 3.3.2 Implement global store in assignments
- [ ] 3.3.3 Handle global in binary/conditions/args
- [ ] 3.3.4 Write global access IL tests (~15)

### Phase 4: Codegen & Data Segment

- [ ] 4.1.1 Fix getAddressOperand() for globals
- [ ] 4.1.2 ZP-mode instruction selection for @zp
- [ ] 4.1.3 Absolute-mode for @ram
- [ ] 4.1.4 Write codegen addressing tests (~10)
- [ ] 4.2.1 Create DataSegmentBuilder
- [ ] 4.2.2 Implement constant evaluation
- [ ] 4.2.3 Implement byte packing for arrays
- [ ] 4.2.4 Write data segment tests (~15)
- [ ] 4.3.1 Update binary emitter for data segment
- [ ] 4.3.2 Generate global init code before main()
- [ ] 4.3.3 Integrate into codegen pipeline
- [ ] 4.3.4 Write binary layout tests (~10)

### Phase 5: Optimizer Protection

- [ ] 5.1.1 Add @zp/@data protection to DeadGlobalElim
- [ ] 5.1.2 Add volatile awareness to CSEPass
- [ ] 5.1.3 Add volatile awareness to LICMPass
- [ ] 5.1.4 Write optimizer protection tests (~15)
- [ ] 5.2.1 Fix any regressions in full test suite
- [ ] 5.2.2 Write optimizer E2E tests with globals (~10)
- [ ] 5.2.3 Verify existing examples still compile

### Phase 6: E2E Integration & Polish

- [ ] 6.1.1 E2E test: sprite-test.blend
- [ ] 6.1.2 E2E test: cross-module @zp sharing
- [ ] 6.1.3 E2E test: @data sprite data in binary
- [ ] 6.1.4 E2E test: mixed storage classes
- [ ] 6.1.5 E2E test: ZP overflow error
- [ ] 6.1.6 Write remaining edge case tests (~10)
- [ ] 6.2.1 Add storage class in function error message
- [ ] 6.2.2 Add clear ZP overflow error with stats
- [ ] 6.2.3 Final review: JSDoc, comments, code quality
- [ ] 6.2.4 Full test suite verification

---

## Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (Global Allocator)
    ↓
Phase 3 (IL Generator) ──── Phase 4 (Codegen)
    ↓                           ↓
Phase 5 (Optimizer Protection)
    ↓
Phase 6 (E2E & Polish)
```

Phase 3 and Phase 4 can partially overlap (IL must come before codegen, but data segment builder is independent).

---

## Session Protocol

### Starting a Session

```bash
clear && scripts/agent.sh start
# "Implement Phase X, Session X.X per plans/global-variables/99-execution-plan.md"
```

### Ending a Session

```bash
./compiler-test
clear && scripts/agent.sh finished
# Call attempt_completion
# /compact
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ All 55 tasks completed
2. ✅ All ~140+ new tests passing
3. ✅ No regressions in existing 8000+ tests
4. ✅ sprite-test.blend compiles successfully
5. ✅ Language specification updated
6. ✅ JSDoc on all new public/protected APIs
7. ✅ Code follows project standards (code.md)
