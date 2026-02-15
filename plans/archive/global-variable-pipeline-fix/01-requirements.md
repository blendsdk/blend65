# Requirements: Global Variable Pipeline Fix

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix three interconnected code generation bugs in the global variable pipeline that prevent any program with module-level variables from working correctly at runtime.

## Functional Requirements

### Must Have

- [ ] Constants used in binary expressions must be inlined as immediate values (not loaded from memory)
- [ ] Default (non-annotated) global variables must not overlap with function-local ZP allocations
- [ ] The sprite-test example must compile and run correctly (visible starfield animation)
- [ ] All existing 8840+ tests must continue to pass (zero regressions)

### Should Have

- [ ] Const globals should not consume any runtime memory (pure compile-time inlining)
- [ ] Mutable globals should be allocated through ZpPool for fast ZP access and overlap prevention

### Won't Have (Out of Scope)

- Global variable initialization at startup (complex — requires init routine generation)
- Word-indexed poke with 16-bit offsets (separate codegen enhancement)
- @data segment globals (already stub-implemented, separate concern)
- Cross-module global variable resolution improvements

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Const handling | A: Allocate + init, B: Skip allocation + inline | **B** | Constants are compile-time values; no runtime storage needed |
| Default global placement | A: Frame region, B: ZpPool, C: Manual ZP offset | **B** | ZpPool prevents overlap with SFA locals automatically |
| Mutable global init | A: Full init routine, B: Defer to future | **B** | Current sprite-test uses arrays with no initializers — init code not needed yet |

## Acceptance Criteria

1. [ ] `SCREEN_WIDTH * y` emits `LDA #$28` (immediate) not `LDA $06` (memory load)
2. [ ] Global arrays get ZP addresses that don't overlap with any function-local variables
3. [ ] Sprite-test compiles and produces correct assembly with distinct, non-overlapping addresses
4. [ ] All 8840+ existing tests pass
5. [ ] New tests cover constant inlining in binary expressions and global/local non-overlap
