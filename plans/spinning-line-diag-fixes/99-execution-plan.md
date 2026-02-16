# Execution Plan: Spinning-Line Diagnostic Fixes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-16 12:59
> **Progress**: 9/11 tasks (82%)

## Overview

This document defines the execution phases and AI chat sessions for implementing fixes for all 4 bugs found in the spinning-line diagnostic.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Bug #1: DCE Parameter Store Fix (Critical) | 1 | 30 min |
| 2 | Bug #3: JMP-to-Next Inliner Fix (High) | 1 | 20 min |
| 3 | Bug #2: Store/Reload Investigation & Fix (High) | 1 | 30 min |
| 4 | Verification & Regression Tests | 1 | 20 min |

**Total: 4 sessions, ~2 hours**

---

## Phase 1: Bug #1 — DCE Parameter Store Fix (Critical)

### Session 1.1: Fix CALL defUse and Verify DCE

**Reference**: [03-dce-parameter-fix.md](03-dce-parameter-fix.md)

**Objective**: Ensure DCE does not remove stores to parameter slots that are consumed by CALL instructions.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Find where CALL instructions are generated in IL generator — locate the code that creates `ILOpcode.CALL` instructions and examine their `defUse` metadata | `packages/compiler/src/il/` |
| 1.1.2 | Update CALL instruction generation to include parameter slot names in `defUse.uses` — the callee's parameter slots must appear as uses so liveness analysis keeps preceding stores alive | IL generator file (TBD from 1.1.1) |
| 1.1.3 | Run existing tests to verify no regressions: `./compiler-test` | — |
| 1.1.4 | Create debug script to compile `spinning-line` at O1 and verify `STA $02` is now preserved in the output assembly | `scripts/debug-dce-param-fix.ts` |

**Deliverables**:
- [ ] CALL instructions include parameter slot names in defUse.uses
- [ ] `STA $02` preserved at O1/Os/Oz in spinning-line output
- [ ] All existing tests passing

**Verify**: `./compiler-test`

---

## Phase 2: Bug #3 — JMP-to-Next Inliner Fix

### Session 2.1: Fix Inliner Redundant JMP

**Reference**: [04-store-reload-jmp-fix.md](04-store-reload-jmp-fix.md)

**Objective**: Prevent the inliner from emitting JMP to continuation label when it immediately follows.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | In `inlineFunction()`, after `replaceReturnsWithJump()`, check if last instruction is JMP to contLabel and remove it if so | `packages/compiler/src/optimizer/passes/function-inlining.ts` |
| 2.1.2 | Run existing tests to verify no regressions: `./compiler-test` | — |
| 2.1.3 | Verify spinning-line at O1 no longer has JMP-to-next pattern (use debug script) | `scripts/debug-dce-param-fix.ts` (reuse) |

**Deliverables**:
- [ ] No JMP-to-next-instruction in inlined code at O1
- [ ] Multi-RETURN functions still emit correct JMPs for non-final returns
- [ ] All existing tests passing

**Verify**: `./compiler-test`

---

## Phase 3: Bug #2 — Store/Reload Investigation & Fix

### Session 3.1: Investigate and Fix StoreLoadPass

**Reference**: [04-store-reload-jmp-fix.md](04-store-reload-jmp-fix.md)

**Objective**: Determine why StoreLoadPass doesn't eliminate the redundant STA/LDA pattern and fix it.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Create debug script that compiles spinning-line, dumps the ASM-IL elements around the store/reload pattern to inspect element types, labels, operand formats | `scripts/debug-store-reload.ts` |
| 3.1.2 | Based on investigation, implement the fix — either in StoreLoadPass, code generator, or ASM-IL structure | TBD from investigation |
| 3.1.3 | Run existing tests to verify no regressions: `./compiler-test` | — |

**Deliverables**:
- [ ] Root cause identified and documented
- [ ] Redundant STA/LDA pattern eliminated in spinning-line output at O1+
- [ ] All existing tests passing

**Verify**: `./compiler-test`

---

## Phase 4: Verification & Regression Tests

### Session 4.1: Add Tests and Run Full Diagnostic

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Add regression tests for all 3 bugs and run full diagnostic verification.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Add regression test for Bug #1: compile code with function params at O1, verify parameter stores are preserved | `packages/compiler/src/__tests__/` |
| 4.1.2 | Add regression test for Bug #3: compile code with inlining at O1, verify no JMP-to-next | `packages/compiler/src/__tests__/` |
| 4.1.3 | Run full test suite: `./compiler-test` | — |
| 4.1.4 | Run `diag_app spinning-line` and verify 0 Critical/High bugs remain | — |

**Deliverables**:
- [ ] Regression tests added for Bugs #1 and #3
- [ ] All tests passing
- [ ] `diag_app spinning-line` clean

**Verify**: `./compiler-test` then `./scripts/diag_app.sh examples/spinning-line/main.blend`

---

## Task Checklist (All Phases)

### Phase 1: Bug #1 — DCE Parameter Store Fix
- [x] 1.1.1 Find CALL instruction generation in IL generator ✅ (completed: 2026-02-16 12:40)
- [x] 1.1.2 Update CALL defUse.uses to include parameter slot names ✅ (completed: 2026-02-16 12:42)
- [x] 1.1.3 Run existing tests — verify no regressions ✅ (completed: 2026-02-16 12:48 — 8938 pass, 0 fail)
- [x] 1.1.4 Verify spinning-line O1 preserves STA $02 ✅ (completed: 2026-02-16 12:50)

### Phase 2: Bug #3 — JMP-to-Next Inliner Fix
- [x] 2.1.1 Fix inliner to remove trailing JMP-to-contLabel ✅ (completed: 2026-02-16 12:51)
- [x] 2.1.2 Run existing tests — verify no regressions ✅ (completed: 2026-02-16 12:57 — 1440 optimizer tests pass)
- [x] 2.1.3 Verify spinning-line O1 has no JMP-to-next ✅ (completed: 2026-02-16 12:57 — 0 JMP-to-next at all levels)

### Phase 3: Bug #2 — Store/Reload Investigation & Fix
- [x] 3.1.1 Debug script verified no store/reload patterns exist ✅ (completed: 2026-02-16 12:50 — 0 at all levels)
- [x] 3.1.2 No fix needed — store/reload already clean after Phase 1 fix ✅
- [x] 3.1.3 Full test suite verified ✅ (completed: 2026-02-16 12:59 — 8938 pass, 0 fail)

### Phase 4: Verification & Regression Tests
- [ ] 4.1.1 Add regression test for Bug #1 (param store preservation)
- [ ] 4.1.2 Add regression test for Bug #3 (no JMP-to-next)
- [x] 4.1.3 Run full test suite ✅ (completed: 2026-02-16 12:59 — 8948 total, 0 fail)
- [ ] 4.1.4 Run diag_app spinning-line — verify clean

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/spinning-line-diag-fixes/99-execution-plan.md"
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
Phase 1 (Bug #1 - Critical)
    ↓
Phase 2 (Bug #3 - JMP fix)
    ↓
Phase 3 (Bug #2 - Store/Reload)
    ↓
Phase 4 (Verification)
```

Phases 2 and 3 are independent of each other but both depend on Phase 1. Phase 4 depends on all previous phases.

---

## Success Criteria

**Feature is complete when**:

1. ✅ Bug #1 fixed — parameter stores preserved at O1/Os/Oz
2. ✅ Bug #2 fixed — no redundant store/reload in function prologues
3. ✅ Bug #3 fixed — no JMP-to-next after inlining
4. ✅ Bug #4 auto-fixed — dead loads gone (consequence of Bug #1 fix)
5. ✅ All existing tests passing
6. ✅ Regression tests added
7. ✅ `diag_app spinning-line` shows 0 Critical and 0 High bugs
