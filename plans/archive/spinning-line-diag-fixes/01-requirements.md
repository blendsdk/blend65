# Requirements: Spinning-Line Diagnostic Fixes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix 4 compiler bugs discovered by `diag_app examples/spinning-line/main.blend`. Bug #1 is a **Critical correctness bug** that causes incorrect program output at O1/Os/Oz. Bugs #2-#3 are **High severity** code quality bugs that produce redundant/wasted assembly instructions.

## Bug Descriptions

### Bug #1: DCE Removes Parameter Stores Before Function Calls (Critical — REG)

**Affected levels:** O1, Os, Oz
**Not affected:** O0 (no optimization), O2/O3 (function inlined — parameter store preserved)

The DCE pass removes `STORE_BYTE` instructions to parameter slots (e.g., `frameIndex` at `$02`) because the liveness analysis doesn't see them as "live" — the read happens inside the called function, not the caller. This causes `getSpriteFrame()` to operate on stale/garbage data.

**Observed behavior:** The `STA $02` instruction (storing `frameIndex` argument) is removed at O1/Os/Oz, while `getSpriteFrame` still reads from `$02` via `ADC $02`.

### Bug #2: Redundant Store/Reload in getSpriteFrame (High — REDUN)

**Affected levels:** All (O0 through Oz)

The `spriteAddr` word parameter is stored to `$07/$08` and immediately reloaded into A/X — the values are already in the registers. This wastes 4 bytes and 6 cycles per occurrence, and occurs twice per animation loop iteration (hot path).

### Bug #3: Jump-to-Next-Instruction After Inlining (High — REDUN)

**Affected levels:** O1

After inlining `delay()`, the inliner's `replaceReturnsWithJump()` emits `JMP ._inline_delay_0_cont` targeting the immediately following label. This wastes 3 bytes and 3 cycles. The pattern does NOT appear at O2+ (the IL peephole pass removes it), but O1 doesn't run `il-peephole`.

### Bug #4: Dead Loads (High — REDUN, auto-fixed)

**Affected levels:** O1, Os, Oz

Secondary effect of Bug #1. Because `STA $02` was removed, the preceding `LDA` instructions that prepare the frameIndex value are now dead code (values immediately overwritten). **Fixing Bug #1 automatically fixes Bug #4.**

## Functional Requirements

### Must Have

- [ ] Fix Bug #1: DCE must NOT remove stores to parameter slots that are read by subsequent CALL instructions
- [ ] Fix Bug #2: Redundant store/reload in `getSpriteFrame` must be eliminated by the asm-il StoreLoadPass
- [ ] Fix Bug #3: JMP-to-next-instruction pattern must be eliminated at O1
- [ ] All existing tests continue to pass after fixes
- [ ] `diag_app spinning-line` shows no Critical or High bugs after fixes

### Should Have

- [ ] Regression tests that prevent re-introduction of each bug
- [ ] The fix for Bug #1 is general-purpose (protects ALL parameter stores, not just this specific case)

### Won't Have (Out of Scope)

- Further optimization of the word-shift chain (`spriteAddr / 64`) — that's a separate optimization task
- Loop unrolling improvements for the delay function
- New optimization passes beyond fixing these specific patterns

## Acceptance Criteria

1. [ ] `diag_app examples/spinning-line/main.blend` reports 0 Critical bugs
2. [ ] Assembly at O1/Os/Oz contains `STA $02` before `JSR getSpriteFrame`
3. [ ] Assembly at all levels does NOT contain `STA $07; STX $08; LDA $07; LDX $08` pattern
4. [ ] Assembly at O1 does NOT contain `JMP` to immediately following label
5. [ ] All compiler tests pass (`./compiler-test`)
6. [ ] New regression tests added for each fixed bug
