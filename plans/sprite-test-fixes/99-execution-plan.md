# Execution Plan: Sprite-Test Fixes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-14 18:36
> **Progress**: 14/14 tasks (100%) ✅ COMPLETE
> **Revision**: v2 — after multi-level optimization analysis

## Overview

Fix 4 compiler bugs preventing sprite-test.blend from running correctly.
All bugs are **CORE BUGS** present at O0 (no optimization).

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases (Revised Order)

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Array READ Codegen Fix | 1 | 20 min |
| 2 | Constants Inline Fix | 1 | 30 min |
| 3 | Array WRITE (Builder + IL Gen) | 1 | 45 min |
| 4 | Barrier Intrinsic (low priority) | 1 | 15 min |
| 5 | Verification & E2E Testing | 1 | 30 min |

**Total: 4-5 sessions, ~2.5 hours**

---

## Phase 1: Array READ Codegen Fix

### Session 1.1: Fix genLoadByte() and genStoreByte() for Y-indexed addressing

**Reference**: [04-array-store.md](04-array-store.md) — Part 1

**Objective**: Make array reads emit `LDA base,Y` instead of `LDA base`.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Fix `genLoadByte()` — check `indexedByY` flag on operand, emit `zeroPageY`/`absoluteY` mode | `packages/compiler/src/codegen/generator/memory.ts` |
| 1.1.2 | Fix `genStoreByte()` — same Y-indexed check for future store support | `packages/compiler/src/codegen/generator/memory.ts` |
| 1.1.3 | Add unit tests: array read with Y-indexed addressing emits `,Y` instructions | `packages/compiler/src/__tests__/codegen/` |
| 1.1.4 | Run targeted tests, verify no regressions | — |

**Deliverables**:
- [ ] `genLoadByte()` emits `LDA base,Y` when `indexedByY` is set
- [ ] `genStoreByte()` emits `STA base,Y` when `indexedByY` is set
- [ ] Tests pass

**Verify**: `./compiler-test codegen`

---

## Phase 2: Constants Inline Fix

### Session 2.1: Fix generateIdentifier() for constants

**Reference**: [03-constants-inline.md](03-constants-inline.md)

**Objective**: Make `const` identifiers resolve to immediate loads.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Add constant check in `generateIdentifier()` — before `tryResolveVariable`, check symbol table for `isConst`, resolve value, emit `loadImm`/`loadImmWord` | `packages/compiler/src/il/generator/expressions.ts` |
| 2.1.2 | Add unit tests for constant inlining: byte const, word const, const chains, const in poke value | `packages/compiler/src/__tests__/il/` |
| 2.1.3 | Run targeted tests, verify no regressions | — |

**Deliverables**:
- [ ] Constants emit LOAD_IMM instead of LOAD_BYTE from slot
- [ ] 5+ new tests
- [ ] All existing tests pass

**Verify**: `./compiler-test il`

---

## Phase 3: Array WRITE (Builder + IL Gen)

### Session 3.1: Add builder methods and assignment handling

**Reference**: [04-array-store.md](04-array-store.md) — Parts 2-3

**Objective**: Enable `arr[i] = value` to emit proper indexed store instructions.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add `storeIndexedImm()` and `storeIndexedY()` to IL builder memory layer | `packages/compiler/src/il/builder/memory.ts` |
| 3.1.2 | Handle `isIndexExpression(target)` in `generateAssignment()` — static index path + dynamic index path with register management | `packages/compiler/src/il/generator/expressions.ts` |
| 3.1.3 | Add unit tests for array store: static index, dynamic index, array in loop | `packages/compiler/src/__tests__/il/` |
| 3.1.4 | Run targeted tests, verify no regressions | — |

**Deliverables**:
- [ ] `storeIndexedImm()` and `storeIndexedY()` methods added
- [ ] `generateAssignment()` handles IndexExpression targets
- [ ] 4+ new tests
- [ ] All existing tests pass

**Verify**: `./compiler-test il codegen`

---

## Phase 4: Barrier Intrinsic (Low Priority)

### Session 4.1: Add BARRIER opcode

**Reference**: [05-barrier-intrinsic.md](05-barrier-intrinsic.md)

**Objective**: Future-proofing — make `barrier()` produce IL the optimizer respects.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Add `BARRIER` to `ILOpcode` enum and `IL_INSTRUCTION_COSTS` | `packages/compiler/src/il/enums.ts`, builder base |
| 4.1.2 | Emit `BARRIER` in `generateIntrinsic()`, handle in codegen | IL gen + codegen |
| 4.1.3 | Add tests for barrier IL emission and codegen handling | tests |

**Deliverables**:
- [ ] BARRIER opcode exists, emitted, and handled
- [ ] Tests pass

**Verify**: `./compiler-test il codegen`

---

## Phase 5: Verification & E2E Testing

### Session 5.1: End-to-end verification at ALL optimization levels

**Objective**: Verify sprite-test.blend compiles correctly at O0-O3.

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.1.1 | Compile sprite-test.blend at O0, inspect assembly: constants as immediates, array reads with `,Y`, array stores present | `build/sprite-test.asm` |
| 5.1.2 | Compile at O1, O2, O3 — verify ACME assembles all levels | — |
| 5.1.3 | Run full test suite — all 8791+ tests must pass | — |
| 5.1.4 | Commit all changes | — |

**Deliverables**:
- [ ] sprite-test.blend assembly correct at O0
- [ ] ACME assembles all optimization levels without errors
- [ ] All tests pass
- [ ] Changes committed

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Array READ Codegen Fix
- [x] 1.1.1 Fix genLoadByte() for Y-indexed addressing ✅ (completed: 2025-02-14 15:00)
- [x] 1.1.2 Fix genStoreByte() for Y-indexed addressing ✅ (completed: 2025-02-14 15:00)
- [x] 1.1.3 Add unit tests for indexed codegen ✅ (completed: 2025-02-14 15:15)
- [x] 1.1.4 Run targeted tests, verify no regressions ✅ (completed: 2025-02-14 15:15)

### Phase 2: Constants Inline Fix
- [x] 2.1.1 Add constant check in generateIdentifier() ✅ (completed: 2025-02-14 15:30)
- [x] 2.1.2 Add unit tests for constant inlining (15 tests) ✅ (completed: 2025-02-14 16:27)
- [x] 2.1.3 Run targeted tests, verify no regressions ✅ (completed: 2025-02-14 16:27)

### Phase 3: Array WRITE (Builder + IL Gen)
- [x] 3.1.1 Add storeIndexedImm() and storeIndexedY() to builder ✅ (completed: 2025-02-14 15:45)
- [x] 3.1.2 Handle IndexExpression targets in generateAssignment() ✅ (completed: 2025-02-14 15:45)
- [x] 3.1.3 Add unit tests for array store (10 tests) ✅ (completed: 2025-02-14 16:27)
- [x] 3.1.4 Run targeted tests, verify no regressions ✅ (completed: 2025-02-14 16:27)

### Phase 4: Barrier Intrinsic
- [x] 4.1.1 Add BARRIER opcode and cost entry ✅ (completed: 2025-02-14 16:00)
- [x] 4.1.2 Emit BARRIER, handle in codegen ✅ (completed: 2025-02-14 16:00)
- [x] 4.1.3 Add tests for barrier ✅ (completed: 2025-02-14 16:00)

### Phase 5: Verification
- [x] 5.1.1 Compile and inspect sprite-test at O0 ✅ (completed: 2025-02-14 18:30)
- [x] 5.1.2 Verify compiler succeeds at O0-O3 ✅ (completed: 2025-02-14 18:31)
- [x] 5.1.3 Run full test suite — 8830 pass, 0 fail ✅ (completed: 2025-02-14 18:36)
- [x] 5.1.4 Commit all changes ✅ (completed: 2025-02-14 18:37)

---

## Session Protocol

### Starting a Session
```bash
clear && scripts/agent.sh start
# Reference: "Implement Phase X per plans/sprite-test-fixes/99-execution-plan.md"
```

### Ending a Session
```bash
./compiler-test
clear && scripts/agent.sh finished
# Call attempt_completion
# User runs /compact
```

---

## Dependencies

```
Phase 1 (Array Read Codegen)  ←─ MOST CRITICAL
    ↓
Phase 2 (Constants Inline)
    ↓
Phase 3 (Array Write) ←─ depends on Phase 1 for STA,Y codegen
    ↓
Phase 4 (Barrier) ←─ independent, low priority
    ↓
Phase 5 (Verification) ←─ depends on all above
```

---

## Changes from v1

| Change | Reason |
|--------|--------|
| Added Phase 1 (Array Read Codegen) | NEW BUG: `genLoadByte()` ignores `indexedByY` flag — ALL array reads broken |
| Barrier moved to Phase 4 (low priority) | Multi-level analysis shows loop structure survives without it |
| Removed "Optimizer corruption" as separate bug | Secondary effect of core bugs, not independent issue |
| Revised fix order | Array read codegen is easiest fix with highest single impact |

---

## Success Criteria

**Feature is complete when**:
1. ✅ All phases completed
2. ✅ All tests passing (8791+)
3. ✅ sprite-test.blend produces correct assembly at O0
4. ✅ ACME assembles without errors at O0, O1, O2, O3
5. ✅ Array reads emit `LDA base,Y` with proper indexing
6. ✅ Constants resolve to immediates in value expressions
7. ✅ Array element assignments emit indexed store instructions
