# Requirements: Sprite Function Codegen Bugs

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix three codegen bugs in the IL generator that prevent `getSpriteFrame()` from working
as a library-style function, and update the spinning-line example to use a multi-frame
sprite sheet matching real-world sprite editor export format.

## Functional Requirements

### Must Have

- [ ] **Bug #1 Fix**: `@variable` passed as function argument must not have its high byte destroyed
- [ ] **Bug #2 Fix**: Word division (`word_param / 64`) inside functions must produce correct 16-bit result
- [ ] **Bug #3 Fix**: `for (let i: byte = 0 to 255)` must not overflow the exit condition
- [ ] **getSpriteFrame() works**: `getSpriteFrame(@lineFrames, frameIndex)` produces correct VIC-II sprite pointer
- [ ] **Multi-frame sprite**: spinning-line uses single `@sprite` with 4 × 64-byte frames
- [ ] **All optimization levels**: O0, O1, O2, O3 must produce correct output
- [ ] **ACME assembly**: Generated .asm must assemble without errors

### Should Have

- [ ] **Existing tests pass**: No regressions in the full test suite
- [ ] **Updated README**: spinning-line README documents the multi-frame pattern
- [ ] **Division shift optimization**: `/ 64` on word values should generate shift-right (>>6) not call `__div16`

### Won't Have (Out of Scope)

- Full type checker / type annotation pass (bugs are fixed with targeted pattern detection)
- Generic word arithmetic improvements beyond division
- New language features or specification changes
- Multi-module sprite library (just the single-file example)

## Technical Requirements

### Performance

- `getSpriteFrame()` must compile to efficient 6502 code (shift + add, no JSR to runtime division)
- `@sprite` alignment must use single `!align` directive (not one per frame)

### Compatibility

- Fixes must not break any existing tests
- Fixes must work at all optimization levels (O0, O1, O2, O3)
- Generated assembly must be valid ACME syntax

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Fix approach for Bug #1 | A) Full type checker, B) Pattern-match @var args | B | Targeted fix within current architecture |
| Fix approach for Bug #2 | A) Full type inference, B) Slot-size inference + add DIVIDE case | B | Minimal change, leverages existing slot info |
| Fix approach for Bug #3 | A) Always use != instead of <, B) Special-case end=255 | B | Preserves efficient CMP+BCS for non-255 cases |
| Multi-frame vs separate | A) Keep 4 separate @sprite, B) Single multi-frame @sprite | B | Matches sprite editor exports, simpler pointer math |

## Acceptance Criteria

1. [ ] `getSpriteFrame(@lineFrames, 0)` returns correct sprite pointer value
2. [ ] Spinning-line compiles and assembles at O0, O1, O2, O3
3. [ ] Full test suite passes with no regressions
4. [ ] Generated assembly for `getSpriteFrame` contains shift-right pattern (LSR chain), not `JSR __div16`
5. [ ] For-loop `0 to 255` with byte counter generates valid 6502 code
6. [ ] Example uses single `@sprite` with 4 × 64-byte frames
