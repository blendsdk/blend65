# Requirements: Optimizer V2

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Complete the Blend65 optimizer by implementing all 14 identified gaps. The optimizer currently handles function-level IL optimization and ASM-level peephole patterns, but lacks inter-procedural analysis, function inlining, and advanced loop optimizations.

## Functional Requirements

### Must Have (CRITICAL + HIGH)

- [ ] **GAP-1**: Program-level pass infrastructure — `ProgramOptimizationPass` interface that operates on `ILProgram` (not just `ILFunction`)
- [ ] **GAP-2**: Call graph analysis — Build who-calls-whom graph from `ILProgram`, support reachability queries
- [ ] **GAP-3**: Dead function elimination — Remove functions unreachable from entry point (e.g., `speedy()` in border-cycle)
- [ ] **GAP-5**: Single-call-site function inlining — Inline functions called from exactly 1 site (always profitable on 6502: saves 12 cycles JSR+RTS)
- [ ] **GAP-6**: Small function inlining — Inline functions ≤ N instructions at O2+ (saves JSR/RTS overhead)
- [ ] **GAP-9**: Loop analysis — Build loop tree from existing `ILLoop` structures, compute loop depth per instruction
- [ ] **GAP-10**: LICM (Loop Invariant Code Motion) — Move invariant computations out of loops

### Should Have (MEDIUM)

- [ ] **GAP-4**: Dead global/constant elimination — Remove module-level variables/constants never referenced
- [ ] **GAP-7**: Fix MUL/DIV IL strength reduction — Currently stubbed out (returns null) in `il-peephole.ts`
- [ ] **GAP-8**: CSE (Common Subexpression Elimination) — Eliminate redundant computations within a function
- [ ] **GAP-11**: Loop unrolling — Unroll small constant-count loops for performance
- [ ] **GAP-12**: Register allocation improvements — Better A/X/Y usage patterns
- [ ] **GAP-14**: Indexed addressing optimization — Use LDA addr,X / LDA addr,Y patterns

### Nice to Have (LOW)

- [ ] **GAP-13**: Compare+Branch simplification — `CMP #$0F; BCC .x; BEQ .x` → `CMP #$10; BCC .x`

## Technical Requirements

### Architecture

- Program-level passes must coexist with existing function-level passes
- `ILOptimizer.optimizeProgram()` must run program passes before/after function passes
- Call graph must be incrementally updatable after inlining

### Performance

- Program-level analysis should complete in < 10ms for typical programs
- Inlining should not increase code size by more than 20% at O2

### Compatibility

- All existing tests must continue to pass
- O0 mode must remain unaffected (pass-through)
- Existing pass ordering and dependencies must be preserved

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Program pass location | New PassManager vs extend existing | Extend existing | Less disruption, reuse infrastructure |
| Call graph scope | Module-level vs whole-program | Whole-program | Blend65 compiles all modules together |
| Inlining at O1 | Single-call-site only | Yes | Always profitable on 6502 |
| Loop analysis basis | Build from scratch vs use ILLoop | Use existing ILLoop | Already computed by IL generator |

## Acceptance Criteria

1. [ ] `speedy()` eliminated from border-cycle output with `-O1`
2. [ ] `delay()` inlined into `main()` with `-O1` (single call site)
3. [ ] All 14 gaps addressed with implementations and tests
4. [ ] All existing tests pass (no regressions)
5. [ ] New tests cover all new passes (target: 200+ new tests)
6. [ ] Documentation updated (JSDoc on all public APIs)
