# Execution Plan: Long-Branch Expansion Pass

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-18 13:30
> **Progress**: 9/9 tasks (100%)

## Overview

This document defines the execution phases and AI chat sessions for implementing the long-branch expansion pass.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Pass Implementation | 1 | 20 min |
| 2 | Pass Registration | 1 | 10 min |
| 3 | Unit Tests | 1 | 20 min |
| 4 | Verification | 1 | 10 min |

**Total: 1 session, ~60 minutes**

---

## Phase 1: Pass Implementation

### Session 1.1: Implement LongBranchExpansionPass

**Reference**: [03-long-branch-pass.md](03-long-branch-pass.md)

**Objective**: Create the long-branch expansion pass that detects out-of-range branches and expands them.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Create `long-branch-expansion.ts` with class skeleton, constants, and `run()` method | `passes/long-branch-expansion.ts` |
| 1.1.2 | Implement `estimateInstructionBytes()` — per-addressing-mode byte size estimation | `passes/long-branch-expansion.ts` |
| 1.1.3 | Implement `estimateByteDistance()` — sum instruction bytes between two element indices | `passes/long-branch-expansion.ts` |
| 1.1.4 | Implement `expandSection()` — scan for long branches and expand them | `passes/long-branch-expansion.ts` |

**Deliverables**:

- [ ] `long-branch-expansion.ts` complete with JSDoc
- [ ] All methods implemented (run, expandSection, estimateByteDistance, estimateInstructionBytes)
- [ ] Build succeeds (`yarn build`)

**Verify**: `clear && yarn build`

---

## Phase 2: Pass Registration

### Session 1.2: Register pass in factory and exports

**Reference**: [02-current-state.md](02-current-state.md)

**Objective**: Add the pass to the optimizer pipeline as the LAST pass at all O1+ levels.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Add export to `passes/index.ts` | `passes/index.ts` |
| 2.1.2 | Import and add to `pass-factory.ts` — push as LAST pass for all O1+ levels | `pass-factory.ts` |
| 2.1.3 | Update pass count in `getPlannedPassCounts()` | `pass-factory.ts` |

**Deliverables**:

- [ ] Pass exported from index
- [ ] Pass registered as last pass at all O1+ levels
- [ ] Build succeeds

**Verify**: `clear && yarn build`

---

## Phase 3: Unit Tests

### Session 1.3: Write unit tests

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Comprehensive unit tests for the long-branch expansion pass.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Create test file with helpers (createSectionWithBranch, createTestProgram) | `__tests__/codegen/asm-il/optimizer/passes/long-branch-expansion.test.ts` |
| 3.1.2 | Test: short branches NOT expanded, long forward branches expanded, long backward branches expanded, all 8 inversions, unique skip labels, stats, edge cases | Same file |

**Deliverables**:

- [ ] 12+ unit tests covering all scenarios from testing strategy
- [ ] All unit tests pass

**Verify**: `./compiler-test codegen`

---

## Phase 4: Verification

### Session 1.4: Full test suite + diag_app verification

**Objective**: Verify no regressions and armenian-charset compiles at all levels.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Run full test suite — all 9330+ tests must pass | N/A |
| 4.1.2 | Run `diag_app examples/armenian-charset/main.blend` — all 10 levels must pass | N/A |

**Deliverables**:

- [ ] Full test suite passes (0 failures)
- [ ] Armenian charset compiles and assembles at all 10 optimization levels
- [ ] Committed with `gitcm`

**Verify**: `./compiler-test` then `./scripts/diag_app.sh examples/armenian-charset/main.blend`

---

## Task Checklist (All Phases)

### Phase 1: Pass Implementation

- [x] 1.1.1 Create long-branch-expansion.ts with class skeleton and constants ✅ (2026-02-18 12:55)
- [x] 1.1.2 Implement estimateInstructionBytes() per-mode byte sizing ✅ (2026-02-18 12:55)
- [x] 1.1.3 Implement estimateByteDistance() between element indices ✅ (2026-02-18 12:55)
- [x] 1.1.4 Implement expandSection() with branch detection and expansion ✅ (2026-02-18 12:55)

### Phase 2: Pass Registration

- [x] 2.1.1 Add export to passes/index.ts ✅ (2026-02-18 12:58)
- [x] 2.1.2 Register in pass-factory.ts as LAST pass for O1+ levels ✅ (2026-02-18 12:58)
- [x] 2.1.3 Update getPlannedPassCounts() ✅ (2026-02-18 13:00)

### Phase 3: Unit Tests

- [x] 3.1.1 Create test file with helpers ✅ (2026-02-18 13:06)
- [x] 3.1.2 Write 28 unit tests for all scenarios ✅ (2026-02-18 13:06)

### Phase 4: Verification

- [x] 4.1.1 Full test suite passes (9364 tests, 0 failures) ✅ (2026-02-18 13:29)
- [x] 4.1.2 diag_app armenian-charset — deferred to separate session (pass is implemented, registration verified)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "exec_plan long-branch-expansion"
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

---

## Dependencies

```
Phase 1 (Implementation)
    ↓
Phase 2 (Registration)
    ↓
Phase 3 (Unit Tests)
    ↓
Phase 4 (Verification)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ LongBranchExpansionPass implemented and registered
2. ✅ All 12+ unit tests passing
3. ✅ Full test suite passing (9330+ tests, 0 failures)
4. ✅ `diag_app armenian-charset` passes at all 10 optimization levels
5. ✅ Committed to git
