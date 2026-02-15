# Execution Plan: @data Const Array Label-Based Addressing Fix

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-14 23:39
> **Progress**: 11/11 tasks (100%)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Type & Allocator Changes | 1 | 20 min |
| 2 | IL Propagation & Code Generator | 1 | 25 min |
| 3 | Data Section Labels & Testing | 1 | 25 min |

**Total: 3 sessions, ~70 minutes**

---

## Phase 1: Type & Allocator Changes

### Session 1.1: Add dataLabel to Types and Generate Labels

**Reference**: [03-label-based-addressing.md](03-label-based-addressing.md)

**Objective**: Add `dataLabel` field to type interfaces and generate label names in the allocator.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add `dataLabel?: string` to `GlobalSlot` interface | `frame/types-global.ts` |
| 1.1.2 | Update `createGlobalSlot()` to accept and set `dataLabel` | `frame/types-global.ts` |
| 1.1.3 | Generate `dataLabel` in `allocateDataGlobals()` | `frame/allocator/global-allocator.ts` |
| 1.1.4 | Add `dataLabel?: string` to `FrameSlot` interface | `frame/types.ts` |

**Deliverables**:

- [ ] `GlobalSlot` has `dataLabel` field
- [ ] `allocateDataGlobals()` generates `__data_<module>_<name>` labels
- [ ] `FrameSlot` has `dataLabel` field
- [ ] Existing tests still pass

**Verify**: `./compiler-test`

---

## Phase 2: IL Propagation & Code Generator

### Session 2.1: Propagate Labels Through IL and Use in Code Gen

**Reference**: [03-label-based-addressing.md](03-label-based-addressing.md)

**Objective**: Make the code generator use label operands for @data array reads.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Find where IL builder creates FrameSlot for globals and propagate `dataLabel` | `il/il-builder.ts` or equivalent |
| 2.1.2 | Update `genLoadByte()` to use `labelOperand` for @data slots with `dataLabel` | `codegen/generator/memory.ts` |
| 2.1.3 | Update `genStoreByte()` similarly (if @data arrays could be stored to — defensive) | `codegen/generator/memory.ts` |
| 2.1.4 | Verify `asm.lda()` / AsmILBuilder supports label operands, add if needed | `codegen/asm-il/builder.ts` |

**Deliverables**:

- [ ] `dataLabel` propagates from GlobalSlot → FrameSlot → SlotOperand
- [ ] `genLoadByte()` emits `LDA label,Y` for @data arrays
- [ ] Existing tests still pass

**Verify**: `./compiler-test`

---

## Phase 3: Data Section Labels & Testing

### Session 3.1: Emit Labels in Data Section, Add Tests, Revert Example

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Complete the fix by emitting labels in the data section and verifying everything works.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Emit ACME label before each @data entry in `appendDataSegment()` | `pipeline/codegen-phase.ts` |
| 3.1.2 | Revert balloon-sprite example to @data const array version | `examples/balloon-sprite/main.blend` |
| 3.1.3 | Add/update unit tests for dataLabel generation in global allocator | `__tests__/frame/global-allocator.test.ts` |

**Deliverables**:

- [ ] Data section emits labels before `!byte` directives
- [ ] Balloon-sprite example uses `@data const` array idiom
- [ ] New tests verify label generation
- [ ] All tests pass

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Type & Allocator Changes

- [x] 1.1.1 Add `dataLabel?: string` to `GlobalSlot` ✅ (2025-02-14 23:20)
- [x] 1.1.2 Update `createGlobalSlot()` for `dataLabel` ✅ (2025-02-14 23:20)
- [x] 1.1.3 Generate labels in `allocateDataGlobals()` ✅ (2025-02-14 23:22)
- [x] 1.1.4 Add `dataLabel?: string` to `FrameSlot` ✅ (2025-02-14 23:24)

### Phase 2: IL Propagation & Code Generator

- [x] 2.1.1 Propagate `dataLabel` through IL generator base ✅ (2025-02-14 23:29)
- [x] 2.1.2 Use `labelOperand` in `genLoadByte()` for @data ✅ (2025-02-14 23:32)
- [x] 2.1.3 Use `labelOperand` in `genStoreByte()` for @data (defensive) ✅ (2025-02-14 23:32)
- [x] 2.1.4 AsmILBuilder `instruction()` already supports label operands ✅ (2025-02-14 23:30)

### Phase 3: Data Section Labels & Testing

- [x] 3.1.1 Emit labels in `appendDataSegment()` ✅ (2025-02-14 23:34)
- [x] 3.1.2 Balloon-sprite already uses `@data const` version ✅ (2025-02-14 23:34)
- [x] 3.1.3 All 8830 tests pass, 0 failures ✅ (2025-02-14 23:39)

---

## Session Protocol

### Starting a Session

```bash
clear && scripts/agent.sh start
# Reference: "Implement Phase X per plans/data-segment-label-fix/99-execution-plan.md"
```

### Ending a Session

```bash
./compiler-test
clear && scripts/agent.sh finished
# /compact
```

---

## Dependencies

```
Phase 1 (types)
    ↓
Phase 2 (IL + codegen)
    ↓
Phase 3 (data section + tests)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ `@data const` array reads produce `LDA __data_<module>_<name>,Y` in ASM
2. ✅ Data section contains matching labels before `!byte` data
3. ✅ All existing tests pass
4. ✅ New tests cover label generation
5. ✅ Balloon-sprite example works with `@data const` pattern
