# Current State: Optimizer V2

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The optimizer has **two tiers** implemented in different locations:

**Tier 1 — IL-Level Optimizer** (`packages/compiler/src/optimizer/`)
- `pass.ts` — `OptimizationPass` interface, `PassResult`, `PassStats`, helper functions
- `pass-manager.ts` — `PassManager` with dependency resolution, iterative optimization
- `options.ts` — `OptimizationLevel` type, `LEVEL_PASSES` config, resolution functions
- `il-optimizer.ts` — `ILOptimizer` entry point, program/function optimization
- `passes/dce.ts` — Dead stores + unreachable code elimination
- `passes/constant-fold.ts` — `LOAD_IMM a; OP_IMM b → LOAD_IMM result`
- `passes/constant-prop.ts` — Track constants through slots, replace loads
- `passes/copy-prop.ts` — Track copy relationships, replace uses with originals
- `passes/il-peephole.ts` — Identity elimination, strength reduction (partial), load-store elimination

**Tier 2 — ASM-Level Optimizer** (`packages/compiler/src/codegen/asm-il/optimizer/`)
- `base-optimizer.ts` → `asm-optimizer.ts` → `asm-il-optimizer.ts` — Inheritance chain
- `types.ts` — `AsmOptimizationPass` interface
- `options.ts` — ASM optimizer options per level
- `pass-factory.ts` — Creates passes for optimization levels
- `analysis/register-tracker.ts` — CPU register state tracking
- `analysis/flag-state.ts` — CPU flag analysis
- `analysis/address-analyzer.ts` — Address pattern analysis
- `passes/flag-patterns.ts` — Redundant CMP #0, duplicate flags
- `passes/store-load.ts` — STA x; LDA x → remove LDA
- `passes/branch-opt.ts` — JMP chain collapse, branch-over-JMP, unreachable code
- `passes/transfer-opt.ts` — Redundant TAX/TXA pairs
- `passes/zp-promotion.ts` — Hot variable promotion to zero page
- `passes/strength-6502.ts` — MUL/DIV/MOD via shifts at ASM level
- `passes/stack-opt.ts` — PHA/PLA pair elimination
- `passes/size-opt.ts` — Tail call optimization, sequence factoring

**IL Analysis** (`packages/compiler/src/il/analysis.ts`)
- `computeLiveRanges()` — Backward dataflow liveness analysis
- `isDeadStore()` — Check if store target is not live
- `computeHints()` — Hot path, frequency, coalescing hints
- `runAnalysisPasses()` — Combined analysis entry point

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|---------------|
| `optimizer/pass.ts` | Pass interfaces | Add `ProgramOptimizationPass` interface |
| `optimizer/pass-manager.ts` | Pass orchestration | Add program-level pass support |
| `optimizer/il-optimizer.ts` | Entry point | Run program passes before/after function passes |
| `optimizer/options.ts` | Level config | Add new passes to `LEVEL_PASSES` |
| `optimizer/passes/il-peephole.ts` | IL peephole | Fix MUL/DIV strength reduction stubs |
| `il/analysis.ts` | Liveness analysis | No changes needed |

### New Files Needed

| File | Purpose |
|------|---------|
| `optimizer/analysis/call-graph.ts` | Call graph construction and queries |
| `optimizer/analysis/loop-tree.ts` | Loop tree construction from ILLoop |
| `optimizer/passes/dead-function-elim.ts` | Program-level dead function elimination |
| `optimizer/passes/dead-global-elim.ts` | Program-level dead global elimination |
| `optimizer/passes/function-inlining.ts` | Function inlining (single-call-site + small) |
| `optimizer/passes/cse.ts` | Common subexpression elimination |
| `optimizer/passes/licm.ts` | Loop invariant code motion |
| `optimizer/passes/loop-unroll.ts` | Loop unrolling |
| `codegen/asm-il/optimizer/passes/compare-branch.ts` | Compare+Branch simplification |
| `codegen/asm-il/optimizer/passes/indexed-addr.ts` | Indexed addressing optimization |

## Gaps Identified

### GAP-1: No Program-Level Pass Infrastructure

**Current Behavior:** `PassManager.optimize()` takes a single `ILFunction`. `ILOptimizer.optimizeProgram()` iterates functions individually — no cross-function visibility.

**Required Behavior:** A `ProgramOptimizationPass` interface that receives the entire `ILProgram` and can add/remove/modify functions.

**Fix Required:** New interface + extend `ILOptimizer` to run program passes.

### GAP-2: No Call Graph Analysis

**Current Behavior:** No concept of which functions call which. Cannot determine reachability or call counts.

**Required Behavior:** Build directed graph from `CALL` instructions. Support queries: `isReachable(func)`, `getCallCount(func)`, `getCallers(func)`, `getCallees(func)`.

**Fix Required:** New `CallGraph` class in `optimizer/analysis/`.

### GAP-3: Dead Function Elimination

**Current Behavior:** All functions in `ILProgram.functions` are emitted to assembly, even if never called.

**Required Behavior:** BFS from entry point using call graph → remove unreachable functions.

**Fix Required:** New `DeadFunctionElimPass` (program-level pass).

### GAP-5 + GAP-6: Function Inlining

**Current Behavior:** All function calls emit JSR/RTS (12 cycles overhead per call on 6502).

**Required Behavior:** 
- O1: Inline functions called from exactly 1 site (always profitable)
- O2: Inline small functions (≤ N instructions) even with multiple call sites

**Fix Required:** New `FunctionInliningPass` (program-level pass), depends on call graph.

### GAP-7: MUL/DIV Strength Reduction Stub

**Current Behavior:** `il-peephole.ts` has `tryReduceMultiply()` and `tryReduceDivide()` that return `null` — completely non-functional.

**Required Behavior:** `MUL_BYTE` by power-of-2 → `SHL_BYTE`, `DIV_BYTE` by power-of-2 → `SHR_BYTE`.

**Fix Required:** Implement the existing stub methods in `il-peephole.ts`.

### GAP-8: No CSE

**Current Behavior:** Redundant computations are repeated.

**Required Behavior:** Track expression results, replace duplicate computations with previously computed value.

**Fix Required:** New `CSEPass` (function-level pass).

### GAP-9 + GAP-10: Loop Analysis and LICM

**Current Behavior:** `ILFunction.loops` has `ILLoop` structures with header/exit labels, but no loop tree or depth analysis in optimizer context.

**Required Behavior:** Build loop tree, identify invariant instructions, hoist them to preheader.

**Fix Required:** New `LoopTree` analysis + `LICMPass`.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Inlining increases code size too much | Medium | Medium | Size budget per inlining decision |
| LICM moves side-effecting code | Low | High | Strict side-effect analysis |
| Call graph wrong for indirect calls | Low | High | Blend65 has no indirect calls currently |
| Breaking existing tests | Low | High | Run full test suite after each change |
