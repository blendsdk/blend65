# Current State: Optimization Pass 2

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The compiler already has substantial optimization infrastructure from the completed `compiler-wide-optimizations` plan:

1. **IL Peephole (`il-peephole.ts`)** — 7 pattern transformations:
   - Identity elimination, strength reduction, load-store elimination
   - Redundant jump elimination, modulo-to-bitmask
   - Address expression folding (LOAD_ADDRESS+SHR_WORD+LO → LOAD_ADDRESS_EXPR)
   - SHR_WORD+LO narrowing for **N≥8 only** (HI+SHR_BYTE)

2. **Function Inliner (`function-inlining.ts`)** — Two strategies:
   - Single-call-site inlining at O1+ (always profitable)
   - Small-function inlining at O2/O3 (size-budget limited)
   - **NOT enabled at Os/Oz** — size levels skip all inlining

3. **Constant Propagation (`constant-prop.ts`)** — Propagates known constants:
   - Handles LOAD_IMM+STORE_BYTE → replaces uses with immediate
   - **Stops at LABEL instructions** (control-flow boundaries)

4. **Copy Propagation (`copy-prop.ts`)** — Forwards copies:
   - Handles LOAD_BYTE+STORE_BYTE → replaces uses with source slot
   - **May not handle all post-inlining patterns**

5. **SHR_WORD Codegen (`bitwise.ts`)** — Two strategies:
   - N≥8: TXA + LSR×(N-8) + LDX#0 (optimized)
   - N=1-7: PHA/TXA/LSR/TAX/PLA/ROR repeated N times (expensive)

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `optimizer/passes/il-peephole.ts` | IL peephole patterns | Extend `shrWordLoNarrowing` for N=3-7 |
| `optimizer/options.ts` | Pass config per level | Add `il-peephole` to O1; add `function-inline` to Os/Oz |
| `optimizer/passes/function-inlining.ts` | Inliner | Add profitable-only mode for size levels |
| `optimizer/passes/constant-prop.ts` | Const prop | Handle inline continuation labels |
| `optimizer/passes/copy-prop.ts` | Copy prop | Forward param slot copies |
| `codegen/generator/bitwise.ts` | SHR_WORD codegen | Add shift-left technique for new IL pattern |
| `il/enums.ts` | IL opcodes | Potentially add SHR_WORD_LO opcode |

## Gaps Identified

### Gap 1: SHR_WORD+LO for N<8

**Current:** `shrWordLoNarrowing()` only matches N≥8. For N=3-7, the full SHR_WORD codegen runs (6N bytes).
**Required:** For N=3-7 with LO following, use shift-left technique (2+(8-N)×2 instructions).
**Impact:** For spinning-line's `/ 64` (N=6): 36 bytes → ~9 bytes per occurrence.

### Gap 2: No Inlining at Os/Oz

**Current:** `PROGRAM_LEVEL_PASSES` for Os/Oz is `['dead-function-elim', 'dead-global-elim']` — no `function-inline`.
**Required:** Enable profitable-only inlining that only inlines when net size decreases.
**Impact:** Enables address-expr folding at Os/Oz, eliminating size regression.

### Gap 3: IL Peephole Not in O1

**Current:** `LEVEL_PASSES` for O1 is `['dce', 'constant-fold']` — no `il-peephole`.
**Required:** Add `il-peephole` to O1 passes to catch store/reload patterns after inlining.
**Impact:** Eliminates redundant STORE_WORD/LOAD_WORD pairs at O1.

### Gap 4: Copy Prop Doesn't Forward Through Param Slots

**Current:** After inlining, `LOAD_BYTE frame / STORE_BYTE $02 / ... / ADD_BYTE $02` keeps the round-trip.
**Required:** Copy-prop should replace `ADD_BYTE $02` with `ADD_BYTE frame` when $02 is just a copy.
**Impact:** Eliminates 2 bytes + 3 cycles per param slot shuffle occurrence.

### Gap 5: Const Prop Stops at Inline Labels

**Current:** Constant-prop treats ALL labels as control-flow boundaries, killing known-constant state.
**Required:** Inline continuation labels (matching `_inline_*_cont` pattern) should not kill state.
**Impact:** Enables constant folding of `ADC $02` where $02=0 → ADC_IMM 0 → eliminated by identity.

## Optimization Level Pass Matrix (Current)

| Pass | O0 | O1 | O1s | O1z | O2 | Os | Oz | O3 | O3s | O3z |
|------|----|----|-----|-----|----|----|----|----|----|-----|
| **Program-level:** | | | | | | | | | | |
| dead-function-elim | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| dead-global-elim | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| function-inline | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Function-level:** | | | | | | | | | | |
| dce | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| constant-fold | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| constant-prop | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| copy-prop | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| il-peephole | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| cse | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| licm | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| loop-unroll | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Shift-left codegen incorrect for edge cases | Low | High | Extensive unit tests for all N=3-7 values |
| Profitable inlining miscalculates savings | Medium | Medium | Conservative heuristic, verify with diag_app |
| Adding il-peephole to O1 causes regressions | Low | Medium | Run full test suite, compare assembly output |
| Const-prop through inline labels is unsafe | Medium | High | Only skip labels matching `_inline_*_cont` pattern |
| Copy-prop forwarding invalidated by aliasing | Low | Medium | Only forward when no intervening writes |
