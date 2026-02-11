# Execution Plan: Dynamic Poke/Peek Addressing

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-11 07:45
> **Progress**: 0/16 tasks (0%)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Constant Folding | 1 | 20 min |
| 2 | Constant Folding Tests | 1 | 20 min |
| 3 | Word Offset Detection & Indirect Addressing | 1 | 30 min |
| 4 | Word Offset Tests & E2E Verification | 1 | 25 min |

**Total: 4 sessions, ~1.5 hours**

---

## Phase 1: Constant Folding Implementation

### Session 1.1: Implement Constant Folding in tryResolveConstantAddress

**Reference**: [03-constant-folding.md](03-constant-folding.md)

**Objective**: Extend `tryResolveConstantAddress()` to evaluate binary expressions where both sides are compile-time constants, enabling `poke(SCREEN_BASE + 250 + i, value)`.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add BinaryExpression case to `tryResolveConstantAddress()` — handle `+` and `-` with recursive constant resolution and 16-bit masking | `packages/compiler/src/il/generator/expressions.ts` |
| 1.1.2 | Add necessary imports (`isBinaryExpression`, `BinaryExpression`, `TokenType`) if not already imported | `packages/compiler/src/il/generator/expressions.ts` |
| 1.1.3 | Update JSDoc on `tryResolveConstantAddress()` to document the new Case 3 | `packages/compiler/src/il/generator/expressions.ts` |
| 1.1.4 | Verify the fix compiles cleanly: `yarn build` | — |
| 1.1.5 | Quick smoke test: compile `examples/sprite-test/sprite-test.blend` at -O3 to verify the constant folding fix resolves the original error | — |

**Deliverables**:

- [ ] `tryResolveConstantAddress()` handles BinaryExpression with `+` and `-`
- [ ] JSDoc updated
- [ ] Build passes
- [ ] sprite-test.blend compiles (at least past the clearScreen constant folding issue)

**Verify**: `./compiler-test il`

---

## Phase 2: Constant Folding Tests

### Session 2.1: Add Tests for Constant Folding

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Add comprehensive tests for the new constant folding capability.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Add unit tests for `tryResolveConstantAddress` with binary constant expressions (CONST+literal, CONST+CONST, nested, overflow, unsupported ops) | `packages/compiler/src/__tests__/il/generator-*.test.ts` (or new file) |
| 2.1.2 | Add integration tests for `poke(CONST + CONST + byte_var, value)` pattern through full IL pipeline | `packages/compiler/src/__tests__/il/generator-*.test.ts` |
| 2.1.3 | Add integration test for `peek(CONST + CONST + byte_var)` pattern | `packages/compiler/src/__tests__/il/generator-*.test.ts` |
| 2.1.4 | Run targeted tests to verify all pass | — |

**Deliverables**:

- [ ] 8+ unit tests for constant folding
- [ ] 2+ integration tests for poke/peek with folded constants
- [ ] All new tests pass
- [ ] All existing tests pass

**Verify**: `./compiler-test il`

---

## Phase 3: Word Offset Detection & Indirect Addressing

### Session 3.1: Detect Word Offsets and Implement Indirect Addressing

**Reference**: [04-word-offset-addressing.md](04-word-offset-addressing.md)

**Objective**: Detect word-type offsets in `tryDecomposeIndexedAddress` and implement indirect addressing via `STA ($ptr),Y` for 16-bit dynamic offsets.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add `indirect?: boolean` field to `AddressOperand` interface | `packages/compiler/src/il/operands.ts` |
| 3.1.2 | Add `createIndirectAddressOperand()` factory function | `packages/compiler/src/il/factories.ts` |
| 3.1.3 | Export new factory from IL index | `packages/compiler/src/il/index.ts` |
| 3.1.4 | Add word-offset detection in `generatePokeIntrinsic()` — check offset type, branch to indirect path | `packages/compiler/src/il/generator/expressions.ts` |
| 3.1.5 | Implement `generateIndirectPoke()` method — compute 16-bit address, store in ZP pointer, emit indirect POKE | `packages/compiler/src/il/generator/expressions.ts` |
| 3.1.6 | Add word-offset detection in `generatePeekIntrinsic()` — same pattern for reads | `packages/compiler/src/il/generator/expressions.ts` |
| 3.1.7 | Implement `generateIndirectPeek()` method | `packages/compiler/src/il/generator/expressions.ts` |
| 3.1.8 | Update `getAddressMode()` in codegen base to handle `indirect` flag → return `'indirectY'` | `packages/compiler/src/codegen/generator/base.ts` |
| 3.1.9 | Verify build compiles cleanly, run quick test | — |

**Deliverables**:

- [ ] AddressOperand supports indirect mode
- [ ] IL generator detects word offsets and emits indirect addressing
- [ ] Codegen correctly maps indirect operand to `indirectY` mode
- [ ] Build passes

**Verify**: `./compiler-test il codegen`

---

## Phase 4: Word Offset Tests & E2E Verification

### Session 4.1: Add Tests and Verify sprite-test.blend

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Add tests for word offset detection and indirect addressing, then verify the complete sprite-test.blend example compiles at all optimization levels.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Add unit tests for word offset detection (word offset → indirect path, byte offset → indexed path) | `packages/compiler/src/__tests__/il/generator-*.test.ts` |
| 4.1.2 | Add integration test for `poke(CONST + word_var, value)` indirect addressing through IL pipeline | `packages/compiler/src/__tests__/il/generator-*.test.ts` |
| 4.1.3 | Add E2E test: compile sprite-test.blend at O0, O1, O2, O3 — verify no errors | `packages/compiler/src/__tests__/e2e/pipeline/` |
| 4.1.4 | Run full test suite to verify zero regressions | — |
| 4.1.5 | Final verification: compile sprite-test.blend with CLI and assemble with ACME | — |

**Deliverables**:

- [ ] Unit tests for word offset detection pass
- [ ] Integration tests for indirect addressing pass
- [ ] E2E test for sprite-test.blend at all opt levels passes
- [ ] Full test suite (8578+) passes with zero regressions
- [ ] CLI build of sprite-test.blend succeeds

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Constant Folding Implementation

- [ ] 1.1.1 Add BinaryExpression case to `tryResolveConstantAddress()`
- [ ] 1.1.2 Add necessary imports
- [ ] 1.1.3 Update JSDoc
- [ ] 1.1.4 Verify build compiles
- [ ] 1.1.5 Smoke test sprite-test.blend

### Phase 2: Constant Folding Tests

- [ ] 2.1.1 Unit tests for constant folding (8+ tests)
- [ ] 2.1.2 Integration test for poke with folded constants
- [ ] 2.1.3 Integration test for peek with folded constants
- [ ] 2.1.4 Run targeted tests

### Phase 3: Word Offset Detection & Indirect Addressing

- [ ] 3.1.1 Add `indirect` field to AddressOperand
- [ ] 3.1.2 Add `createIndirectAddressOperand()` factory
- [ ] 3.1.3 Export from IL index
- [ ] 3.1.4 Word-offset detection in `generatePokeIntrinsic()`
- [ ] 3.1.5 Implement `generateIndirectPoke()`
- [ ] 3.1.6 Word-offset detection in `generatePeekIntrinsic()`
- [ ] 3.1.7 Implement `generateIndirectPeek()`
- [ ] 3.1.8 Update `getAddressMode()` for indirect flag
- [ ] 3.1.9 Verify build

### Phase 4: Word Offset Tests & E2E Verification

- [ ] 4.1.1 Unit tests for word offset detection
- [ ] 4.1.2 Integration test for indirect poke/peek
- [ ] 4.1.3 E2E test: sprite-test.blend at all opt levels
- [ ] 4.1.4 Full test suite regression check
- [ ] 4.1.5 Final CLI verification

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/dynamic-poke-addressing/99-execution-plan.md"
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
Phase 1: Constant Folding Implementation
    ↓
Phase 2: Constant Folding Tests
    ↓
Phase 3: Word Offset Detection & Indirect Addressing
    ↓
Phase 4: Word Offset Tests & E2E Verification
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ All phases completed
2. ✅ `examples/sprite-test/sprite-test.blend` compiles at -O0, -O1, -O2, -O3
3. ✅ All 8578+ tests passing (zero regressions)
4. ✅ New tests cover constant folding and indirect addressing
5. ✅ No warnings/errors in build
6. ✅ Execution plan updated (16/16 tasks complete)
