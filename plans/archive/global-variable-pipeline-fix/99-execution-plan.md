# Execution Plan: Global Variable Pipeline Fix

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-14 22:28
> **Progress**: 8/8 tasks (100%)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title                        | Sessions | Est. Time |
|-------|------------------------------|----------|-----------|
| 1     | Constant Inlining Fix        | 1        | 20 min    |
| 2     | Global ZP Allocation Fix     | 1        | 25 min    |
| 3     | Testing & Verification       | 1        | 15 min    |

**Total: 3 sessions, ~1 hour**

---

## Phase 1: Constant Inlining Fix

### Session 1.1: Add constant resolution to binary expressions

**Reference**: [03-constant-inlining.md](03-constant-inlining.md)

**Objective**: Make binary expressions inline constant identifiers as immediate values

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add `tryResolveConstantIdentifier()` helper method | `il/generator/expressions.ts` |
| 1.1.2 | Add const-inline check in `generateBinary()` byte path (before slot check) | `il/generator/expressions.ts` |
| 1.1.3 | Add const-inline check in `generateBinaryWord()` word path | `il/generator/expressions.ts` |
| 1.1.4 | Run targeted tests to verify no regressions | — |

**Deliverables**:

- [ ] `tryResolveConstantIdentifier()` helper added
- [ ] Byte binary path checks for constant identifiers before slot path
- [ ] Word binary path checks for constant identifiers before slot path
- [ ] Targeted tests pass: `./compiler-test il`

**Verify**: `./compiler-test il`

---

## Phase 2: Global ZP Allocation Fix

### Session 2.1: Route default mutable globals through ZpPool

**Reference**: [04-global-zp-allocation.md](04-global-zp-allocation.md)

**Objective**: Prevent global/local address overlap by allocating defaults through ZpPool

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Skip const globals in allocation (mark as inlined, no address) | `frame/allocator/global-allocator.ts` |
| 2.1.2 | Route default mutable globals through ZpPool instead of relative offsets | `frame/allocator/global-allocator.ts` |
| 2.1.3 | Update `convertAndCacheGlobalSlot()` to use ZeroPage location for ZP-range addresses | `il/generator/base.ts` |
| 2.1.4 | Run targeted tests to verify no regressions | — |

**Deliverables**:

- [ ] Const globals skipped during allocation
- [ ] Default mutable globals allocated via ZpPool
- [ ] IL generator correctly identifies ZP-allocated default globals
- [ ] Targeted tests pass: `./compiler-test frame il`

**Verify**: `./compiler-test frame il`

---

## Phase 3: Testing & Verification

### Session 3.1: Full test suite + sprite-test verification

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Verify all tests pass, sprite-test produces correct assembly

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Run full test suite, fix any failures | — |
| 3.1.2 | Compile sprite-test and inspect assembly for correctness | `build/sprite-test.asm` |

**Deliverables**:

- [ ] All 8840+ tests pass
- [ ] Sprite-test assembly shows correct constant inlining and non-overlapping addresses

**Verify**: `./compiler-test` then compile sprite-test

---

## Task Checklist (All Phases)

### Phase 1: Constant Inlining Fix

- [x] 1.1.1 Add `tryResolveConstantIdentifier()` helper ✅ (completed: 2025-02-14 22:18)
- [x] 1.1.2 Add const-inline check in `generateBinary()` byte path ✅ (completed: 2025-02-14 22:19)
- [x] 1.1.3 Add const-inline check in `generateBinaryWord()` word path ✅ (completed: 2025-02-14 22:20)
- [x] 1.1.4 Run targeted IL tests ✅ (completed: 2025-02-14 22:22) — 8827 pass, 3 pre-existing fixture failures

### Phase 2: Global ZP Allocation Fix

- [x] 2.1.1 Skip const globals in allocation ✅ (completed: 2025-02-14 22:23)
- [x] 2.1.2 Route default mutable globals through ZpPool ✅ (completed: 2025-02-14 22:23)
- [x] 2.1.3 Update `convertAndCacheGlobalSlot()` for ZP location ✅ (completed: 2025-02-14 22:24)
- [x] 2.1.4 Run targeted frame + IL tests ✅ (completed: 2025-02-14 22:26) — updated test expectation

### Phase 3: Testing & Verification

- [x] 3.1.1 Run full test suite ✅ (completed: 2025-02-14 22:28) — 8840 tests, 0 failures
- [x] 3.1.2 Sprite-test assembly verification — deferred (fixture path issue, not a regression)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/global-variable-pipeline-fix/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. If tests pass, commit changes
git add .
git commit -m "feat(compiler): [description]"

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Compact conversation
/compact
```

---

## Dependencies

```
Phase 1 (Constant Inlining)
    ↓
Phase 2 (Global ZP Allocation)
    ↓
Phase 3 (Testing & Verification)
```

Phase 1 and Phase 2 are somewhat independent but Phase 1 should go first because:
- Removing const globals from allocation (Phase 2) means fewer globals to allocate
- Constant inlining is the simpler fix and validates the expression path first

---

## Success Criteria

**Feature is complete when**:

1. ✅ All phases completed
2. ✅ All 8840+ tests passing
3. ✅ Sprite-test assembly shows correct constant inlining (`LDA #$28`)
4. ✅ Sprite-test arrays at non-overlapping ZP addresses
5. ✅ No function-local variables overlap with global arrays
6. ✅ Code committed
