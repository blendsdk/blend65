# Requirements: Sprite-Test Fixes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix 5 compiler bugs that prevent the starfield simulation (`sprite-test.blend`) from producing correct output. The program should show 20 animated star dots on a black screen, but instead shows a garbled blue character pattern.

## Functional Requirements

### Must Have

- [ ] Constants used as values (not addresses) must resolve to immediate loads (`LDA #value`)
- [ ] Array element assignments (`starX[i] = seedX`) must emit indexed store instructions
- [ ] `barrier()` intrinsic must produce an IL instruction the optimizer respects
- [ ] All existing 8791 tests must continue to pass (zero regressions)
- [ ] sprite-test.blend must compile and assemble with ACME without errors

### Should Have

- [ ] Optimizer correctness: inlined functions, unrolled loops, and copy-propagated values must preserve program semantics
- [ ] byte×byte multiplication assigned to a word variable should produce 16-bit result

### Won't Have (Out of Scope)

- Multi-dimensional array support
- Signed array indexing
- Runtime bounds checking for arrays
- New optimizer passes

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Array store approach | New IL opcode vs reuse STORE_BYTE | Reuse STORE_BYTE with indexed slot | Consistent with existing loadIndexedY pattern |
| Constant resolution | Symbol table lookup vs constant propagation | Symbol table lookup in generateIdentifier | Matches existing tryResolveConstantAddress pattern |
| Barrier IL | New opcode vs NOP with metadata | New BARRIER opcode | Clean, explicit, optimizer can check for it |

## Acceptance Criteria

1. [ ] `sprite-test.blend` produces correct assembly (constants as immediates, array stores present)
2. [ ] All 8791 existing tests pass
3. [ ] New tests cover constant inlining, array store, barrier, and array read scenarios
4. [ ] ACME assembles the output without errors at O0 and O3
