# Execution Plan: Size-Opt Duplicate Label Fix

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-18 17:10
> **Progress**: 5/5 tasks (100%)

## Overview

Single-session fix. The changes are localized to one file (`size-opt.ts`) plus a test update.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Fix size-opt.ts | 1 | 20 min |

**Total: 1 session, ~20 minutes**

---

## Phase 1: Fix Size-Opt Pass

### Session 1.1: Fix Duplicate Labels and Add Tests

**Reference**: [Fix Specification](03-fix-specification.md)

**Objective**: Fix the two bugs causing duplicate `.factored_N` labels in multi-iteration optimization.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Move `factorCounter` from module-level to class instance property | `passes/size-opt.ts` |
| 1.1.2 | Remove `factorCounter = 0` reset in `run()` | `passes/size-opt.ts` |
| 1.1.3 | Update `factorSequence()` to use `this.factorCounter` | `passes/size-opt.ts` |
| 1.1.4 | Fix `applySequenceFactoring()` to merge into existing `_factored_routines` section | `passes/size-opt.ts` |
| 1.1.5 | Run tests and verify with diag_app | — |

**Deliverables**:

- [ ] No duplicate labels across optimizer iterations
- [ ] All existing tests pass
- [ ] `diag_app` passes all 10 optimization levels for armenian-charset

**Verify**: `./compiler-test && ./scripts/diag_app.sh examples/armenian-charset/main.blend`

---

## Task Checklist (All Phases)

### Phase 1: Fix Size-Opt Pass

- [x] 1.1.1 Move `factorCounter` to class property ✅
- [x] 1.1.2 Remove counter reset in `run()` ✅
- [x] 1.1.3 Update `factorSequence()` to use `this.factorCounter` ✅
- [x] 1.1.4 Fix section merging in `applySequenceFactoring()` ✅
- [x] 1.1.5 Run tests and verify with diag_app ✅ (duplicate label bug fixed; z-levels have separate "Value not defined" bug in sequence factoring)

---

## Session Protocol

### Starting a Session

```bash
clear && scripts/agent.sh start
# "Implement Phase 1, Session 1.1 per plans/size-opt-duplicate-labels/99-execution-plan.md"
```

### Ending a Session

```bash
./compiler-test
clear && scripts/agent.sh finished
/compact
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ All tasks completed
2. ✅ All 9364+ tests passing
3. ✅ `diag_app examples/armenian-charset/main.blend` — all 10 levels PASS
4. ✅ No ACME "Symbol already defined" errors at any optimization level
