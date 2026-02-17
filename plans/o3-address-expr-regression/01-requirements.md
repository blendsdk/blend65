# Requirements: O3 Address-Expr Folding Regression Fix

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix the O3 optimization regression (385→449 B on spinning-line) caused by a pass ordering interaction between `loadStoreElimination`, `addressExprFolding`, and the new `shrWordLoNarrowing`. Additionally, improve the general robustness of `loadStoreElimination` to handle inline continuation labels.

## Functional Requirements

### Must Have

- [ ] O3 spinning-line returns to ≤385 B (regression eliminated)
- [ ] `addressExprFolding` handles "store-gap" pattern: `LOAD_ADDRESS, STORE_WORD, SHR_WORD, LO`
- [ ] Safety: Forward-scan verifies STORE_WORD target is dead before removing
- [ ] `loadStoreElimination` handles `STORE_WORD x; LABEL _inline_*_cont; LOAD_WORD x` pattern
- [ ] `loadStoreElimination` handles `STORE_BYTE x; LABEL _inline_*_cont; LOAD_BYTE x` pattern
- [ ] All existing 9204+ tests pass with zero regressions
- [ ] No regressions at other optimization levels (O0, O1, O2, Os, Oz, O3z, etc.)

### Should Have

- [ ] Unit tests for each new pattern variant (positive + negative cases)
- [ ] Diagnostic verification: `diag_app spinning-line` all 10 levels pass
- [ ] Diagnostic verification: `diag_app balloon-sprite` all 10 levels pass

### Won't Have (Out of Scope)

- General dead-code elimination improvements (handled by DCE pass)
- Function inliner restructuring (the inliner output is correct, just suboptimal for peephole matching)
- New optimization levels or level configuration changes

## Technical Requirements

### Correctness

- Forward-scan MUST verify no subsequent LOAD_WORD/LOAD_BYTE reads from the dead slot
- Inline continuation label detection MUST use existing `isInlineContinuationLabel()` guard
- Pattern matching MUST be conservative — skip optimization if uncertain

### Performance

- Forward-scan bounded to prevent O(n²) behavior (max scan distance)
- No compile-time regression for large programs

## Acceptance Criteria

1. [ ] O3 spinning-line PRG ≤ 385 B
2. [ ] All 10 spinning-line optimization levels compile and assemble
3. [ ] All 10 balloon-sprite optimization levels compile and assemble
4. [ ] All compiler tests pass (9204+)
5. [ ] Unit tests for store-gap pattern (positive + negative)
6. [ ] Unit tests for inline-label load-store elimination (positive + negative)
