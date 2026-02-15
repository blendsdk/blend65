# Sprite Function Codegen Bugs — Implementation Plan

> **Feature**: Fix 3 codegen bugs blocking `getSpriteFrame()` library function + update spinning-line example to multi-frame sprite sheet
> **Status**: Planning Complete
> **Created**: 2025-02-15

## Overview

The spinning-line example demonstrates sprite animation on the C64. It should use a
`getSpriteFrame(spriteAddr: word, frameIndex: byte): byte` library-style function to
compute VIC-II sprite pointers. Three codegen bugs prevent this function from working:

1. **Bug #1**: Address-of (`@variable`) arguments get their high byte destroyed by spurious `PROMOTE_BYTE_WORD`
2. **Bug #2**: Word division (`spriteAddr / 64`) falls through to 8-bit `__div8` instead of generating a shift-right
3. **Bug #3**: For-loop with byte counter ending at 255 overflows: `CMP #(255+1)` = `CMP #256` (invalid 8-bit immediate)

Additionally, the spinning-line example should be updated to use a single multi-frame
`@sprite` variable (matching real-world sprite editor export format) instead of 4 separate
`@sprite` variables.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current compiler behavior |
| 03 | [Expression Fixes](03-expressions-fixes.md) | Bug #1 (address-of promotion) + Bug #2 (word division) |
| 04 | [Control Flow Fix](04-control-flow-fix.md) | Bug #3 (for-loop byte overflow at 255) |
| 05 | [Example Update](05-example-update.md) | Multi-frame sprite sheet + getSpriteFrame() |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Target Code (after all fixes)

```js
@sprite const lineFrames: byte[] = [
    // Frame 0: | (64 bytes) ... Frame 3: \ (64 bytes)
];

function getSpriteFrame(spriteAddr: word, frameIndex: byte): byte {
    return lo(spriteAddr / 64) + frameIndex;
}

// Usage:
poke(SPRITE0_POINTER, getSpriteFrame(@lineFrames, frame));
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Multi-frame vs separate sprites | Multi-frame (matches sprite editor exports) |
| Keep getSpriteFrame() | Yes — proves library-style sprite utilities work |
| Fix all 3 bugs | Yes — they're real compiler issues affecting general use |
| Test optimization levels | All: O0, O1, O2, O3 |

## Related Files

| File | Role |
|------|------|
| `packages/compiler/src/il/generator/expressions.ts` | Bug #1 + Bug #2 |
| `packages/compiler/src/il/generator/control-flow.ts` | Bug #3 |
| `examples/spinning-line/main.blend` | Example to update |
| `examples/spinning-line/README.md` | Documentation to update |
