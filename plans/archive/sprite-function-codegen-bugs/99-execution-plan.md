# Execution Plan: Sprite Function Codegen Bugs

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-15 22:11
> **Progress**: 16/16 tasks (100%) ✅ COMPLETE

## Overview

This document defines the execution phases and AI chat sessions for implementation.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Bug #1: Address-of Argument Promotion | 1 | 30 min |
| 2 | Bug #2: Word Division | 1 | 45 min |
| 3 | Bug #3: For-Loop Byte Overflow | 1 | 30 min |
| 4 | Example Update + Final Verification | 1 | 30 min |

**Total: 4 sessions, ~2-2.5 hours**

---

## Phase 1: Bug #1 — Address-of Argument Promotion Fix

### Session 1.1: Fix generateCallArguments() and Add Tests

**Reference**: [03-expressions-fixes.md](03-expressions-fixes.md) — Bug #1 section

**Objective**: Prevent `PROMOTE_BYTE_WORD` from destroying the high byte when `@variable` is passed as a word argument.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Read `generateCallArguments()` in expressions.ts, understand exact code structure | `packages/compiler/src/il/generator/expressions.ts` |
| 1.1.2 | Add `isAddressOfExpression()` helper method (protected, with JSDoc) | `packages/compiler/src/il/generator/expressions.ts` |
| 1.1.3 | Modify promotion guard in `generateCallArguments()` to skip for @var args | `packages/compiler/src/il/generator/expressions.ts` |
| 1.1.4 | Add unit tests: @var skips promotion, byte/literal still promotes | `packages/compiler/src/__tests__/il/generator-address-of.test.ts` |
| 1.1.5 | Run targeted tests and verify | — |

**Deliverables**:

- [ ] `isAddressOfExpression()` helper added
- [ ] `generateCallArguments()` no longer emits PROMOTE_BYTE_WORD for @var args
- [ ] Tests proving @var args preserve A:X, byte args still promote
- [ ] `./compiler-test il` passes

**Verify**: `./compiler-test il`

---

## Phase 2: Bug #2 — Word Division Fix

### Session 2.1: Add Word Division to IL Generator

**Reference**: [03-expressions-fixes.md](03-expressions-fixes.md) — Bug #2 section

**Objective**: Make `wordParam / 64` generate correct 16-bit shift-right instead of 8-bit `__div8`.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Read `generateBinary()` and `generateBinaryWordImmediate()` — understand dispatch logic | `packages/compiler/src/il/generator/expressions.ts` |
| 2.1.2 | Check what word-shift primitives the IL builder already supports | `packages/compiler/src/il/builder/` |
| 2.1.3 | Add `inferWordWidthFromExpression()` helper (slot-size fallback) | `packages/compiler/src/il/generator/expressions.ts` |
| 2.1.4 | Add word-width inference fallback in `generateBinary()` type dispatch | `packages/compiler/src/il/generator/expressions.ts` |
| 2.1.5 | Add DIVIDE case to `generateBinaryWordImmediate()` (power-of-2 → shift) | `packages/compiler/src/il/generator/expressions.ts` |
| 2.1.6 | Add/verify `lsrWord` builder primitive if needed | `packages/compiler/src/il/builder/` |
| 2.1.7 | Add unit tests: word/64 shift, word/10 runtime, byte/64 unchanged | `packages/compiler/src/__tests__/il/` |
| 2.1.8 | Run targeted tests and verify | — |

**Deliverables**:

- [ ] `inferWordWidthFromExpression()` helper added
- [ ] Word-width inference fallback in `generateBinary()`
- [ ] DIVIDE case in `generateBinaryWordImmediate()` with shift optimization
- [ ] Tests proving word division generates shifts, byte division unchanged
- [ ] `./compiler-test il` passes

**Verify**: `./compiler-test il`

---

## Phase 3: Bug #3 — For-Loop Byte Overflow Fix

### Session 3.1: Fix generateForCondition() for end=255

**Reference**: [04-control-flow-fix.md](04-control-flow-fix.md)

**Objective**: Make `for (let i: byte = 0 to 255)` generate valid assembly without `CMP #256`.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Read `generateForCondition()` and `generateForStatement()` — understand loop structure | `packages/compiler/src/il/generator/control-flow.ts` |
| 3.1.2 | Implement special-case for constEnd=255 with byte counter | `packages/compiler/src/il/generator/control-flow.ts` |
| 3.1.3 | Add unit tests: 0-to-255, 100-to-255, 0-to-254 (regression), 0-to-0 (edge) | `packages/compiler/src/__tests__/il/` |
| 3.1.4 | Run targeted tests and verify | — |

**Deliverables**:

- [ ] Special case for byte loop end=255 in `generateForCondition()`
- [ ] No `CMP #256` in generated assembly
- [ ] Tests for boundary conditions
- [ ] `./compiler-test il` passes

**Verify**: `./compiler-test il`

---

## Phase 4: Example Update + Final Verification

### Session 4.1: Update Spinning-Line + Verify All Levels

**Reference**: [05-example-update.md](05-example-update.md), [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Rewrite spinning-line to multi-frame sprite sheet with getSpriteFrame(), verify at O0-O3.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Rewrite spinning-line with multi-frame @sprite and getSpriteFrame() | `examples/spinning-line/main.blend` |
| 4.1.2 | Update spinning-line README | `examples/spinning-line/README.md` |
| 4.1.3 | Compile spinning-line at O0, verify assembly | — |
| 4.1.4 | Compile spinning-line at O1, O2, O3, verify assembly | — |
| 4.1.5 | Run full test suite — no regressions | — |

**Deliverables**:

- [ ] Spinning-line uses single multi-frame `@sprite` variable
- [ ] `getSpriteFrame()` function compiles correctly
- [ ] Assembly valid at O0, O1, O2, O3
- [ ] Full `./compiler-test` passes
- [ ] README updated

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Bug #1 — Address-of Promotion

- [x] 1.1.1 Read generateCallArguments() code structure ✅ (completed: 2025-02-15 16:39)
- [x] 1.1.2 Add isAddressOfExpression() helper ✅ (completed: 2025-02-15 16:41)
- [x] 1.1.3 Modify promotion guard to skip for @var args ✅ (completed: 2025-02-15 16:42)
- [x] 1.1.4 Add unit tests for promotion behavior ✅ (completed: 2025-02-15 16:45)
- [x] 1.1.5 Run ./compiler-test il — verify pass ✅ (completed: 2025-02-15 16:48)

### Phase 2: Bug #2 — Word Division

- [x] 2.1.1 Read generateBinary() and generateBinaryWordImmediate() dispatch ✅ (completed: 2025-02-15 18:04)
- [x] 2.1.2 Check existing word-shift builder primitives ✅ (completed: 2025-02-15 18:05)
- [x] 2.1.3 Add inferWordWidthFromExpression() helper ✅ (completed: 2025-02-15 18:09)
- [x] 2.1.4 Add word-width inference fallback in generateBinary() ✅ (completed: 2025-02-15 18:10)
- [x] 2.1.5 Add DIVIDE case to generateBinaryWordImmediate() ✅ (completed: 2025-02-15 18:11)
- [x] 2.1.6 Add SHR_WORD opcode + shrWord() builder + codegen handler ✅ (completed: 2025-02-15 18:08)
- [x] 2.1.7 Fix promotion bug + restrict inference to supported ops ✅ (completed: 2025-02-15 18:17)
- [x] 2.1.8 Run ./compiler-test il — 8916/8919 pass ✅ (completed: 2025-02-15 18:21)

### Phase 3: Bug #3 — For-Loop Overflow

- [x] 3.1.1 Read generateForCondition() loop structure ✅ (completed: 2025-02-15 20:30)
- [x] 3.1.2 Implement end=255 special case (post-body exit pattern) ✅ (completed: 2025-02-15 21:00)
- [x] 3.1.3 Add 12 unit tests for boundary conditions ✅ (completed: 2025-02-15 21:15)
- [x] 3.1.4 Run ./compiler-test — 8928/8928 pass ✅ (completed: 2025-02-15 21:30)

### Phase 4: Example + Final Verification

- [x] 4.1.1 Rewrite spinning-line with multi-frame @sprite + getSpriteFrame() ✅ (completed: 2025-02-15 22:05)
- [x] 4.1.2 Update spinning-line README ✅ (completed: 2025-02-15 22:09)
- [x] 4.1.3 Compile and verify at O0 (via test suite) ✅ (completed: 2025-02-15 22:11)
- [x] 4.1.4 Compile and verify at O1, O2, O3 (via test suite) ✅ (completed: 2025-02-15 22:11)
- [x] 4.1.5 Run full ./compiler-test — 8931/8931 pass, 0 failures ✅ (completed: 2025-02-15 22:11)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/sprite-function-codegen-bugs/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test il    # (or ./compiler-test for final session)

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
Phase 1 (Bug #1: address-of promotion)
    ↓
Phase 2 (Bug #2: word division)
    ↓
Phase 3 (Bug #3: for-loop overflow)
    ↓
Phase 4 (Example update + final verification)
```

Note: Phases 1, 2, 3 are mostly independent bug fixes but are ordered by complexity
(simplest first). Phase 4 depends on all three fixes being complete.

---

## Success Criteria

**Feature is complete when**:

1. ✅ All three bug fixes implemented and tested
2. ✅ getSpriteFrame(@lineFrames, frame) works correctly
3. ✅ Spinning-line uses multi-frame @sprite with 4×64-byte frames
4. ✅ Compiles and assembles at O0, O1, O2, O3
5. ✅ Full test suite passes (no regressions)
6. ✅ Documentation updated
