# Execution Plan: Codegen Audit Fixes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-16 00:29
> **Progress**: 3/12 tasks (25%)

## Overview

This document defines the execution phases and AI chat sessions for fixing
all 12 code generation bugs discovered by the spinning-line assembly audit.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time | Bugs Fixed |
|-------|-------|----------|-----------|------------|
| 1 | Core Codegen Fixes | 1 | 30 min | C1, C2, C3 |
| 2 | Loop Unroller Fixes | 1-2 | 45 min | L1, L2, L3, O1, O2 |
| 3 | Inlining Verification & Fixes | 1 | 30 min | I3, I4, I1 |
| 4 | Code Quality | 1 | 15 min | I2 |

**Total: 4 phases, 4-5 sessions, ~2 hours**

---

## Phase 1: Core Codegen Fixes (P0 Critical)

### Session 1.1: Fix Multi-Arg Passing + Const Condition Resolution

**Reference**: [03-core-codegen.md](03-core-codegen.md)

**Objective**: Fix the two P0 bugs that affect ALL optimization levels.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Fix `generateCallArguments()` to store args[1..N] to param slots before generating args[0] | `il/generator/expressions.ts` |
| 1.1.2 | Fix `generateConditionWithBranch()` to resolve constant identifiers via `tryResolveConstantIdentifier()` | `il/generator/control-flow.ts` |
| 1.1.3 | Run `./compiler-test` — all existing tests must pass | — |
| 1.1.4 | Compile spinning-line at all 6 levels, verify C1 + C2 are fixed | `scripts/debug-spinning-line-all-opts.ts` |

**Deliverables**:
- [ ] Multi-arg function calls pass all arguments
- [ ] Constant identifiers in if-conditions resolve to immediates
- [ ] All existing tests pass
- [ ] Spinning-line O0 shows `STA $02` before JSR and `CMP #$04`

**Verify**: `./compiler-test`

---

## Phase 2: Loop Unroller Fixes (P1)

### Session 2.1: Safety Guard + Body Extraction Fix

**Reference**: [04-loop-unroller.md](04-loop-unroller.md)

**Objective**: Fix the loop unroller to produce correct code at O2/O3.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Add BARRIER check in `analyzeCandidate()` — reject loops containing barrier() | `optimizer/passes/loop-unroll/analysis.ts` |
| 2.1.2 | Fix `extractBodyInstructions()` to exclude counter increment/decrement and termination check | `optimizer/passes/loop-unroll/base.ts` |
| 2.1.3 | Update `performFullUnroll()` and `performPartialUnroll()` to pass counterSlot to body extraction | `optimizer/passes/loop-unroll/loop-unroll-pass.ts` |
| 2.1.4 | Fix `cloneInstructions()` to remap labels with unique copy suffix `_u{N}` | `optimizer/passes/loop-unroll/base.ts` |
| 2.1.5 | Update full/partial unroll callers to pass copy index to `cloneInstructions()` | `optimizer/passes/loop-unroll/loop-unroll-pass.ts` |
| 2.1.6 | Run `./compiler-test` — all existing tests must pass | — |
| 2.1.7 | Compile spinning-line at O2 and O3, verify loop structure is correct | `scripts/debug-spinning-line-all-opts.ts` |

**Deliverables**:
- [ ] Loops containing `barrier()` are not unrolled
- [ ] Partial unrolling produces 1 counter increment per copy
- [ ] Full unrolling produces unique labels for each copy
- [ ] O3 output assembles without duplicate label errors
- [ ] All existing tests pass

**Verify**: `./compiler-test`

---

## Phase 3: Inlining Verification & Fixes (P2)

### Session 3.1: Verify I3/I4 Status, Fix I1

**Reference**: [05-inlining.md](05-inlining.md)

**Objective**: Check if ghost instructions (I3) and missing CLC (I4) are resolved by Phase 1+2 fixes. Fix dead function elimination (I1).

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Compile spinning-line at O2, check if ghost CLC/ADC $02 still appears | `scripts/debug-spinning-line-all-opts.ts` |
| 3.1.2 | If I3 persists: dump IL before/after inlining pass, identify ghost source, fix | `optimizer/passes/function-inlining.ts` |
| 3.1.3 | Compile spinning-line at O2, check if CLC before ADC is present | ASM output |
| 3.1.4 | If I4 persists: check il-peephole.ts and dce.ts for CLC removal, add safety guard | `optimizer/passes/il-peephole.ts` or `optimizer/passes/dce.ts` |
| 3.1.5 | Investigate why dead-function-elim doesn't remove fully-inlined functions | `optimizer/passes/dead-function-elim.ts` |
| 3.1.6 | Fix DFE to correctly detect and remove fully-inlined functions | `optimizer/passes/dead-function-elim.ts` |
| 3.1.7 | Run `./compiler-test` — all existing tests must pass | — |

**Deliverables**:
- [ ] Ghost instructions verified resolved (or fixed if persisting)
- [ ] CLC before ADC verified present (or fixed if missing)
- [ ] Fully-inlined functions removed from assembly output
- [ ] All existing tests pass

**Verify**: `./compiler-test`

---

## Phase 4: Code Quality (P3)

### Session 4.1: Redundant JMP Elimination

**Reference**: [05-inlining.md](05-inlining.md)

**Objective**: Add peephole rule to eliminate redundant JMP to next instruction.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Add peephole rule: JUMP label + LABEL label → remove JUMP | `optimizer/passes/il-peephole.ts` |
| 4.1.2 | Run `./compiler-test` — all tests pass | — |
| 4.1.3 | Final compile of spinning-line at all 6 levels — verify all 12 bugs fixed | `scripts/debug-spinning-line-all-opts.ts` |

**Deliverables**:
- [ ] Redundant JMPs eliminated in O1+ output
- [ ] All 12 bugs verified fixed
- [ ] All existing tests pass

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Core Codegen Fixes

- [x] 1.1.1 Fix `generateCallArguments()` for multi-arg passing ✅ (completed: 2025-02-16 00:26)
- [x] 1.1.2 Fix `generateConditionWithBranch()` for const resolution ✅ (completed: 2025-02-16 00:27)
- [x] 1.1.3 Run full test suite ✅ (completed: 2025-02-16 00:29 — 8941 pass, 0 fail)
- [ ] 1.1.4 Verify spinning-line O0 output

### Phase 2: Loop Unroller Fixes

- [ ] 2.1.1 Add BARRIER guard in analyzeCandidate()
- [ ] 2.1.2 Fix extractBodyInstructions() to exclude counter ops
- [ ] 2.1.3 Update performFullUnroll/performPartialUnroll callers
- [ ] 2.1.4 Fix cloneInstructions() for unique label remapping
- [ ] 2.1.5 Update full/partial unroll to pass copy index
- [ ] 2.1.6 Run full test suite
- [ ] 2.1.7 Verify spinning-line O2/O3 output

### Phase 3: Inlining Verification & Fixes

- [ ] 3.1.1 Check I3 (ghost instructions) status after Phase 1+2
- [ ] 3.1.2 Fix I3 if still present
- [ ] 3.1.3 Check I4 (missing CLC) status after Phase 1+2
- [ ] 3.1.4 Fix I4 if still present
- [ ] 3.1.5 Investigate dead-function-elim for I1
- [ ] 3.1.6 Fix DFE for fully-inlined function removal
- [ ] 3.1.7 Run full test suite

### Phase 4: Code Quality

- [ ] 4.1.1 Add redundant JMP peephole rule
- [ ] 4.1.2 Run full test suite
- [ ] 4.1.3 Final all-levels verification

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/codegen-audit-fixes/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. If tests pass, commit using gitcm protocol
clear && git add .
# Follow gitcm protocol from .clinerules/git-commands.md

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Call attempt_completion
# 5. User runs /compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with [x]
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 1 (Core Codegen)
    ↓
Phase 2 (Loop Unroller)
    ↓
Phase 3 (Inlining — depends on Phase 1+2 for I3/I4 verification)
    ↓
Phase 4 (Code Quality)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ All 4 phases completed
2. ✅ All tests passing (`./compiler-test`)
3. ✅ Spinning-line compiles correctly at all 6 levels
4. ✅ O3 output assembles without errors
5. ✅ No ghost instructions, no missing CLC, no duplicate labels
6. ✅ Fully-inlined functions removed from output
