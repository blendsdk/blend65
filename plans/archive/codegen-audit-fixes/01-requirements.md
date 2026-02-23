# Requirements: Codegen Audit Fixes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix all 12 code generation bugs discovered by the comprehensive assembly audit of
`examples/spinning-line/main.blend` at O0, O1, O2, O3, Os, and Oz optimization levels.
After all fixes, the spinning-line example must produce correct, assemblable code at every level.

## Functional Requirements

### Must Have

- [x] Bug C1: Multi-argument function calls must pass ALL arguments to their parameter slots
- [x] Bug C2: Constant identifiers in if-condition comparisons must resolve to immediate values
- [x] Bug C3: Auto-resolves when C1 is fixed (function reads correct ZP for 2nd param)
- [x] Bug L1: Loop unrolling must not duplicate counter increments (1 per iteration, not 3)
- [x] Bug L2: Unrolled loop copies must use unique labels (no duplicate ACME labels)
- [x] Bug L3: Fully unrolled loops must preserve correct semantics (exit after N iterations)
- [x] Bug O1: `barrier()` intrinsic must prevent loop unrolling of loops containing it
- [x] Bug O2: Optimizer must not reorder instructions in ways that clobber CPU flags
- [x] Bug I1: Functions fully inlined at all call sites must be eliminated from output
- [x] Bug I3: Inlining must not produce ghost instructions between inline boundary and continuation
- [x] Bug I4: Optimizer must not remove CLC before ADC (carry flag is semantically required)

### Should Have

- [ ] Bug I2: Redundant `JMP label` where label is the next instruction should be eliminated

### Won't Have (Out of Scope)

- Full peephole optimizer rewrite
- New optimization passes
- Changes to the language specification
- Stack-based multi-argument ABI (use ZP parameter slots instead)

## Technical Requirements

### Correctness

- All 6 optimization levels must produce semantically correct assembly
- O3 assembly must assemble without errors (no duplicate labels)
- All existing tests must continue to pass after each change

### Regression Prevention

- Compile spinning-line at all 6 levels after each phase
- Compare assembly output to verify fixes and no regressions
- Add targeted unit tests for each bug fix

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Multi-arg ABI | Stack-based, ZP slots | ZP slots | 6502 has 256-byte stack limit; ZP is faster |
| Unroller fix approach | Patch existing, rewrite, disable | Patch + safety guards | Existing architecture is sound; bugs are in body extraction and label handling |
| Inlining ghost fix | Debug IL dump, manual trace | IL dump analysis | Need to see exactly which IL instructions are generated before/after inline |

## Acceptance Criteria

1. [ ] `examples/spinning-line/main.blend` compiles at O0 with correct arg passing and const comparison
2. [ ] O1 inlines correctly without ghost instructions
3. [ ] O2 unrolls correctly without triple increments or flag clobbering
4. [ ] O3 assembles without duplicate labels and produces correct logic
5. [ ] All existing compiler tests pass (`./compiler-test`)
6. [ ] New tests cover each of the 12 bugs specifically
