# Requirements: Compiler-Wide Optimization Initiative

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Implement systematic optimization improvements across all compiler stages (codegen, IL optimizer, ASM optimizer, inliner) to produce significantly better 6502 assembly output for all Blend programs at all relevant optimization levels.

## Functional Requirements

### Must Have

- [ ] **Theme CG**: Improved SHR_WORD codegen — smarter shift sequences at ALL optimization levels
- [ ] **Theme A**: Label arithmetic folding through inlined function parameters at O1+
- [ ] **Theme C**: Power-of-2 modulo → AND bitmask peephole at O1+
- [ ] **Theme F**: Post-inlining parameter store/reload elimination at O1+
- [ ] **Theme H**: For-loop register promotion investigation and fix at O1+
- [ ] All existing tests continue to pass (zero regressions)
- [ ] New test programs compile and assemble at ALL 6 optimization levels
- [ ] `diag_app` clean report on spinning-line and balloon-sprite

### Should Have

- [ ] **Theme G**: SHR_WORD + LO() narrowing (byte-only result skips high byte work)
- [ ] **Theme J**: Constant propagation through inlined literal arguments
- [ ] Dead label cleanup after inlining
- [ ] New example programs as ongoing benchmarks

### Won't Have (Out of Scope)

- General modulo optimization (non-power-of-2)
- 16-bit software divide (__div16 runtime)
- Raster sync delay replacement (changes program semantics)
- Variable-count shift support

## Technical Requirements

### Correctness

- Every optimization must preserve program semantics exactly
- Negative tests must verify unsafe optimizations are NOT applied
- All 6 optimization levels (O0-Oz) must produce correct code
- Theme C specifically requires negative test for non-power-of-2 (e.g., mod 5)

### Performance Targets (spinning-line at O3)

- Sprite pointer computation: from ~70 bytes/120 cycles → ~4 bytes/8 cycles
- Frame wrap: from 10 bytes/14 cycles → 5 bytes/6 cycles
- For-loop iteration: from ~13 bytes/14 cycles → ~3 bytes/5 cycles per iteration
- Inlined param overhead: from 6+ bytes/8+ cycles → 0 bytes/0 cycles

### Compatibility

- O0 output must remain unoptimized (debug-friendly) except for codegen quality
- All optimizations must respect `barrier()` semantics
- No new IL opcodes required (use existing infrastructure)
- ACME assembler compatibility maintained

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Implementation order | By theme / By compiler stage | By compiler stage | Minimizes cross-cutting changes, each stage is independently testable |
| Modulo optimization | All modulo / Power-of-2 only | Power-of-2 only | Safe and simple; general modulo needs runtime division |
| Delay optimization | Rewrite to DEX/BNE / Keep as-is | Keep structure, improve loop codegen | Rewriting changes timing semantics |
| SHR_WORD improvement | IL-level / Codegen-level | Both (codegen baseline + IL optimization) | Codegen improvement helps O0 too |

## Acceptance Criteria

1. [ ] `./compiler-test` passes with zero regressions
2. [ ] `diag_app spinning-line` shows improved assembly at O1-O3/Os/Oz
3. [ ] `diag_app balloon-sprite` passes cleanly
4. [ ] New test programs compile and assemble at all 6 levels
5. [ ] Power-of-2 modulo patterns emit AND instead of CMP/BNE/LDA/STA
6. [ ] Inlined function params don't produce redundant store/reload
7. [ ] Label/64 computations through inlined params fold to assembly-time constants
8. [ ] For-loop inner loops use register-counted patterns where possible
