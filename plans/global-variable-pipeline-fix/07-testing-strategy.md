# Testing Strategy: Global Variable Pipeline Fix

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: All new code paths in expressions.ts and global-allocator.ts
- Integration tests: GlobalAllocator → FrameAllocator ZP pool sharing with default globals
- E2E tests: sprite-test produces correct assembly

## Test Categories

### Unit Tests — Constant Inlining (expressions.ts)

| Test | Description | Priority |
|------|-------------|----------|
| Const right operand in byte multiply | `y * CONST` emits MUL_IMM not MUL_BYTE | High |
| Const right operand in byte add | `x + CONST` emits ADD_IMM not ADD_BYTE | High |
| Const right operand in byte compare | `x > CONST` emits CMP_IMM not CMP_BYTE | High |
| Const right operand in word add | `addr + CONST` emits ADD_WORD_BYTE_IMM | High |
| Non-const identifier uses slot path | `y * mutableVar` still emits MUL_BYTE | High |
| Const with complex initializer | `const X = A + B` resolves to folded value | Medium |
| Const left operand (already works via generateExpression→generateIdentifier) | Verify no regression | Medium |
| tryResolveConstantIdentifier returns undefined for non-const | Edge case | Medium |

### Unit Tests — Global Allocation (global-allocator.ts)

| Test | Description | Priority |
|------|-------------|----------|
| Const globals skipped from allocation | No address assigned, not in ZP pool | High |
| Default mutable globals use ZpPool | Arrays get real ZP addresses | High |
| Default globals don't overlap each other | Distinct address ranges | High |
| ZpPool tracks default global allocations | Pool stats reflect global usage | Medium |
| Large array that exceeds ZP falls back to frame region | Graceful degradation | Medium |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| ZpPool sharing prevents overlap | GlobalAllocator + FrameAllocator | Globals and function locals get non-overlapping ZP addresses |
| End-to-end constant inlining | Parser → Semantic → Frame → IL → Codegen | Const in binary expr produces immediate in assembly |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Sprite-test compilation | Compile sprite-test.blend at O0 | Assembly shows: (1) `LDA #$28` for SCREEN_WIDTH, (2) arrays at unique ZP addrs, (3) no overlap with locals |

## Verification Checklist

- [ ] All new unit tests pass
- [ ] All 8840+ existing tests pass (zero regressions)
- [ ] Sprite-test assembly manually inspected for correctness
- [ ] No ZP address overlaps between globals and locals in sprite-test output
