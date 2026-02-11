# Testing Strategy: Optimizer V2

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: 100% coverage on new code
- Integration tests: All pass interactions verified
- E2E tests: border-cycle example verifies real-world behavior

## Test Categories

### Unit Tests — Phase 1 (Program Infrastructure)

| Test | Description | Priority |
|------|-------------|----------|
| ProgramOptimizationPass interface | Registration, execution, results | High |
| CallGraph.build() simple | 2 functions, 1 calls other | High |
| CallGraph.build() multi | 5 functions, chain of calls | High |
| CallGraph.build() recursive | Self-recursive function | High |
| CallGraph.build() mutual recursion | A calls B, B calls A | High |
| CallGraph.isReachable() | Reachable and unreachable functions | High |
| CallGraph.getCallCount() | Single site, multi site, zero | High |
| CallGraph.getCallers/Callees() | Verify edge queries | Medium |
| CallGraph.getReachableFunctions() | BFS correctness | High |
| ILOptimizer program pass ordering | Program passes run before function passes | High |

### Unit Tests — Phase 2 (Inter-Procedural)

| Test | Description | Priority |
|------|-------------|----------|
| DeadFunctionElim: single dead function | Remove 1 unreachable function | High |
| DeadFunctionElim: multiple dead functions | Remove 2+ unreachable | High |
| DeadFunctionElim: all reachable | No functions removed | High |
| DeadFunctionElim: chain reachability | A→B→C, all reachable | High |
| DeadFunctionElim: preserve entry | Entry point always kept | High |
| DeadGlobalElim: unused constant | Remove unused module constant | Medium |
| DeadGlobalElim: used constant | Preserve referenced constant | Medium |
| Inlining: single-call-site | Inline function called once | High |
| Inlining: multi-call-site skip at O1 | Don't inline at O1 if >1 site | High |
| Inlining: small function at O2 | Inline small function at O2 | High |
| Inlining: recursive skip | Don't inline recursive functions | High |
| Inlining: label remapping | Labels unique after inline | High |
| Inlining: slot remapping | Slots don't conflict | High |
| Inlining: RETURN→JUMP conversion | Callee RETURN becomes JUMP to cont | High |

### Unit Tests — Phase 3 (IL Improvements)

| Test | Description | Priority |
|------|-------------|----------|
| MUL strength: MUL_BYTE by 2,4,8 → SHL | Power-of-2 multiply | High |
| MUL strength: MUL_BYTE by 0 → LOAD_IMM 0 | Zero multiply | Medium |
| MUL strength: MUL_BYTE by 1 → nop | Identity multiply | Medium |
| MUL strength: MUL_BYTE by 3 → skip | Non-power-of-2, no change | Medium |
| DIV strength: DIV_BYTE by 2,4,8 → SHR | Power-of-2 divide | High |
| DIV strength: DIV_BYTE by 1 → nop | Identity divide | Medium |
| CSE: duplicate expression eliminated | Same computation twice | High |
| CSE: invalidation on write | Expression invalidated after store | High |
| CSE: block boundary clears | New block clears available set | High |
| Compare+Branch: CMP+BCC+BEQ → CMP+BCC | ASM pattern simplification | Medium |
| Indexed addr: array access → LDA base,X | ASM addressing optimization | Medium |

### Unit Tests — Phase 4 (Advanced Loops)

| Test | Description | Priority |
|------|-------------|----------|
| LoopTree.build() simple | Single while loop | High |
| LoopTree.build() nested | Nested for loops | High |
| LoopTree.getLoopFor() | Correct loop for instruction | High |
| LoopTree.getDepth() | Correct depth reporting | High |
| LICM: hoist LOAD_IMM | Constant load out of loop | High |
| LICM: hoist invariant computation | Expression with external defs | High |
| LICM: preserve side effects | Don't hoist stores | High |
| LICM: preserve control flow | Don't hoist jumps/labels | High |
| Loop unroll: constant count 4 | Unroll factor 2 | Medium |
| Loop unroll: unknown count skip | Don't unroll variable count | Medium |
| Register alloc: loop counter in X | INX/DEX pattern | Medium |

### Integration Tests

| Test | Components | Description |
|------|-----------|-------------|
| Program + Function passes | ILOptimizer | Program passes run first, then function passes |
| Dead func + Inlining | Both passes | Inline first, then clean up dead functions |
| Full O1 pipeline | All O1 passes | Complete O1 produces correct, smaller code |
| Full O2 pipeline | All O2 passes | Complete O2 produces correct, smaller code |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| border-cycle O1 | Compile `examples/border-cycle/` with `-O1` | `speedy()` not in output, `delay()` inlined |
| border-cycle O2 | Compile with `-O2` | All O2 optimizations applied |
| simple program O0 vs O1 | Compile same program at both levels | O1 output is smaller, same behavior |
| multi-function O1 | Program with 5 functions, 2 dead | Dead functions eliminated |

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No regressions in existing tests (`./compiler-test`)
- [ ] Test coverage meets goals (100% on new code)
- [ ] border-cycle `-O1` eliminates `speedy()` and inlines `delay()`
