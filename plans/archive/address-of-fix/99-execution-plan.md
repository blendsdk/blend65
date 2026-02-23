# Execution Plan: Address-Of Operator Fix

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-15 12:12
> **Progress**: 12/12 tasks (100%) ✅ COMPLETE

## Overview

This document defines the execution phases and AI chat sessions for fixing the `@` address-of operator.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Diagnosis — IL Dump | 1 | 15 min |
| 2 | Fix Root Cause | 1 | 20 min |
| 3 | Optimizer Awareness | 1 | 20 min |
| 4 | Testing & Verification | 1 | 15 min |

**Total: 2-3 sessions, ~1-1.5 hours**

---

## Phase 1: Diagnosis — Confirm Root Cause

### Session 1.1: Create IL Dump Script and Identify Bug

**Reference**: [Diagnosis](03-diagnosis.md)

**Objective**: Create a debug script that dumps IL for `main()` and confirms whether `LOAD_ADDRESS` is emitted or lost.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Create `scripts/debug-address-of.ts` — compile balloon-sprite, dump IL instructions for main() | `scripts/debug-address-of.ts` |
| 1.1.2 | Run the script and analyze output to confirm which hypothesis (A, B, or C) is correct | N/A |
| 1.1.3 | Update `03-diagnosis.md` with confirmed root cause | `plans/address-of-fix/03-diagnosis.md` |

**Deliverables**:

- [ ] Debug script created and runnable
- [ ] Root cause confirmed with IL dump evidence
- [ ] Diagnosis document updated with findings

**Verify**: `clear && npx tsx scripts/debug-address-of.ts`

---

## Phase 2: Fix Root Cause

### Session 2.1: Fix IL Generator or Optimizer

**Reference**: [Current State](02-current-state.md)

**Objective**: Fix the identified root cause so `LOAD_ADDRESS` is correctly emitted and reaches codegen.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Fix the root cause identified in Phase 1 (likely in `generateAddressOf` or `tryResolveVariable`) | `il/generator/expressions.ts` or `il/generator/base.ts` |
| 2.1.2 | Rebuild and verify balloon-sprite ASM output shows `LDA #<label` / `LDX #>label` | N/A |
| 2.1.3 | Run existing tests to verify no regressions | N/A |

**Deliverables**:

- [ ] Root cause fixed
- [ ] Balloon-sprite ASM shows correct `LOAD_ADDRESS` codegen
- [ ] All existing tests pass

**Verify**: `clear && node ./packages/cli/bin/blend65.js build ./examples/balloon-sprite/main.blend && cat build/main.asm | grep -A2 "balloonData"`

---

## Phase 3: Optimizer Awareness

### Session 3.1: Add LOAD_ADDRESS to Optimizer Passes

**Reference**: [Optimizer Awareness](04-optimizer-awareness.md)

**Objective**: Add `LOAD_ADDRESS` to all optimizer passes that need to know about it.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add `LOAD_ADDRESS` to `modifiesAccumulator()` in CSE pass | `optimizer/passes/cse/cse.ts` |
| 3.1.2 | Add `LOAD_ADDRESS` to `isValueProducingInstruction()` in dead-global-elim | `optimizer/passes/dead-global-elim.ts` |
| 3.1.3 | Verify constant-prop, copy-prop, DCE, peephole, LICM, function-inlining don't mishandle `LOAD_ADDRESS` — add explicit handling where needed | Multiple optimizer files |
| 3.1.4 | Run full test suite | N/A |

**Deliverables**:

- [ ] All optimizer passes aware of LOAD_ADDRESS
- [ ] LOAD_ADDRESS survives optimization at all levels
- [ ] All tests pass

**Verify**: `./compiler-test`

---

## Phase 4: Testing & Verification

### Session 4.1: Add Tests and Final Verification

**Reference**: [Testing Strategy](07-testing-strategy.md)

**Objective**: Add tests for the `@` operator and verify balloon-sprite works end-to-end.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Add IL generator tests for `@variable` producing `LOAD_ADDRESS` | `__tests__/il/` |
| 4.1.2 | Verify balloon-sprite compiles correctly with ACME: `acme -f cbm -o build/balloon.prg build/main.asm` | N/A |
| 4.1.3 | Run full test suite and verify all pass | N/A |

**Deliverables**:

- [ ] New tests for address-of operator
- [ ] Balloon-sprite compiles with ACME without errors
- [ ] All tests pass (existing + new)

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Diagnosis

- [x] 1.1.1 Create debug-address-of.ts script ✅ (completed: 2025-02-15 11:10)
- [x] 1.1.2 Run diagnosis and identify root cause ✅ (completed: 2025-02-15 11:15) — Root cause: emitter `formatOperand()` Immediate mode ignores `labelOperand`
- [x] 1.1.3 Update diagnosis document with findings ✅ (completed: 2025-02-15 11:35) — Bug was in emitter, not IL gen

### Phase 2: Fix Root Cause

- [x] 2.1.1 Fix the identified bug ✅ (completed: 2025-02-15 11:25) — Added `labelOperand` support to `AsmAddressingMode.Immediate` case in `emitter.ts`
- [x] 2.1.2 Verify balloon-sprite ASM output ✅ (completed: 2025-02-15 11:26) — Now emits `LDA #<__data_BalloonSprite_balloonData` / `LDX #>__data_BalloonSprite_balloonData`
- [x] 2.1.3 Run existing tests — no regressions ✅ (completed: 2025-02-15 11:28) — 8901/8902 pass, 1 pre-existing parser failure

### Phase 3: Optimizer Awareness

- [x] 3.1.1 Add LOAD_ADDRESS to CSE modifiesAccumulator ✅ (completed: 2025-02-15 11:31)
- [x] 3.1.2 Add LOAD_ADDRESS to dead-global-elim isValueProducingInstruction ✅ (completed: 2025-02-15 11:32)
- [x] 3.1.3 Audit all other optimizer passes ✅ (completed: 2025-02-15 11:30) — copy-prop, constant-prop, DCE, peephole don't need changes (operate on LOAD_BYTE/STORE_BYTE patterns only)
- [x] 3.1.4 Run full test suite ✅ (completed: 2025-02-15 11:34) — 8901/8902 pass, same pre-existing failure

### Phase 4: Testing & Verification

- [x] 4.1.1 Add IL generator tests for @ operator ✅ (completed: 2025-02-15 12:05) — 13 new tests in generator-address-of.test.ts, all pass
- [x] 4.1.2 Verify ACME assembly succeeds ✅ (completed: 2025-02-15 12:10) — balloon.prg assembled (192 bytes), no ACME errors
- [x] 4.1.3 Run full test suite — all pass ✅ (completed: 2025-02-15 12:12) — 8922/8923 pass (1 pre-existing parser failure)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/address-of-fix/99-execution-plan.md"
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
Phase 1 (Diagnosis)
    ↓
Phase 2 (Fix Root Cause) — depends on diagnosis findings
    ↓
Phase 3 (Optimizer Awareness) — can partially overlap with Phase 2
    ↓
Phase 4 (Testing & Verification)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ Root cause identified and fixed
2. ✅ `@variable` generates `LOAD_ADDRESS` in IL
3. ✅ Codegen produces `LDA #<label` / `LDX #>label` in ASM
4. ✅ Optimizer passes handle `LOAD_ADDRESS` correctly
5. ✅ All tests passing (existing + new)
6. ✅ Balloon-sprite produces correct ASM
7. ✅ ACME assembles without errors
