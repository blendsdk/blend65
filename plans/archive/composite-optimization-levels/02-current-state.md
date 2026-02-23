# Current State: Composite Optimization Levels

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### Architecture Overview

The optimization level flows through 3 layers:

```
CLI (-O flag) → CompilerOptions.optimization → IL Optimizer + AsmIL Optimizer
```

1. **CLI** (`packages/cli/src/commands/build.ts`) — Accepts bare values (`0`, `1`, `s`, `z`) and prepends `O` prefix
2. **Config** (`packages/compiler/src/config/types.ts`) — `OptimizationLevelId` type union
3. **Compiler** (`packages/compiler/src/compiler.ts`) — Casts to `OptimizationLevel`, passes to IL optimizer
4. **IL Optimizer** (`packages/compiler/src/optimizer/options.ts`) — Looks up function + program pass sets per level
5. **AsmIL Optimizer** (`packages/compiler/src/codegen/asm-il/optimizer/`) — Separate `OptimizationLevel` enum + pass factory

**Important**: The IL optimizer and AsmIL optimizer have **separate** level definitions that must be kept in sync.

### Current Levels (6)

```
OptimizationLevelId = 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz'
```

### Current Pass Configuration

**IL Optimizer — Function Passes:**

| Pass | O0 | O1 | O2 | O3 | Os | Oz |
|------|----|----|----|----|----|----|
| dce | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| constant-fold | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| constant-prop | - | - | ✓ | ✓ | ✓ | ✓ |
| copy-prop | - | - | ✓ | ✓ | ✓ | ✓ |
| il-peephole | - | - | ✓ | ✓ | ✓ | ✓ |
| cse | - | - | ✓ | ✓ | ✓ | ✓ |
| licm | - | - | ✓ | ✓ | ✓ | ✓ |
| loop-unroll | - | - | ✓ | ✓ | - | - |

**IL Optimizer — Program Passes:**

| Pass | O0 | O1 | O2 | O3 | Os | Oz |
|------|----|----|----|----|----|----|
| dead-function-elim | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| dead-global-elim | - | - | ✓ | ✓ | ✓ | ✓ |
| function-inline + DFE | - | ✓ | ✓ | ✓ | - | - |

**AsmIL Optimizer:**

| Pass | O0 | O1 | O2 | O3 | Os | Oz |
|------|----|----|----|----|----|----|
| FlagPatterns | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| StoreLoad | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| BranchOpt | - | - | ✓ | ✓ | ✓ | ✓ |
| TransferOpt | - | - | ✓ | ✓ | ✓ | ✓ |
| CompareBranch | - | - | ✓ | ✓ | ✓ | ✓ |
| IndexedAddr | - | - | ✓ | ✓ | ✓ | ✓ |
| RegisterPromote | - | - | ✓ | ✓ | ✓ | ✓ |
| ZPPromotion | - | - | - | ✓ | ✓ | ✓ |
| Strength6502 | - | - | - | ✓ | - | - |
| StackOpt | - | - | - | ✓ | ✓ | ✓ |
| SizeOpt | - | - | - | - | ✓ | ✓ |

**AsmIL Config:**

| Config | O0 | O1 | O2 | O3 | Os | Oz |
|--------|----|----|----|----|----|----|
| ZP slots | 0 | 0 | 0 | 8 | 4 | 4 |
| Max iterations | 1 | 1 | 1 | 5 | 1 | 5 |

## Relevant Files

| File | Purpose | Changes Needed |
|------|---------|---------------|
| `packages/compiler/src/config/types.ts` | `OptimizationLevelId` type | Add O1s, O1z, O3s, O3z |
| `packages/compiler/src/optimizer/options.ts` | IL pass maps | Add entries for 4 new levels |
| `packages/compiler/src/codegen/asm-il/optimizer/options.ts` | AsmIL enum + defaults | Add 4 enum values + defaults |
| `packages/compiler/src/codegen/asm-il/optimizer/pass-factory.ts` | AsmIL pass selection | Handle new levels |
| `packages/cli/src/commands/build.ts` | CLI flag handling | Accept new values, update help |
| `packages/compiler/src/compiler.ts` | Level resolution | May need alias normalization |
| `scripts/diag_app.sh` | Diagnostic tool | Expand LEVELS array |
| `packages/compiler/src/config/index.ts` | Config exports | May need validation function |

## Gaps Identified

### Gap 1: No Composite Level Support

**Current:** Levels are flat enum — no concept of base+modifier composition
**Required:** 4 new composite levels with correct pass selection
**Fix:** Add new entries to all pass maps and enum definitions

### Gap 2: No Input Validation for Invalid Combos

**Current:** CLI uses yargs `choices` which rejects anything not in the list
**Required:** O0s/O0z rejected with helpful message; O2s/O2z silently aliased
**Fix:** Custom validation in `resolveOptimizationLevel()` function

### Gap 3: CLI Help Doesn't Show Two-Dimensional Model

**Current:** Help lists levels linearly without explaining the base+modifier concept
**Required:** Clear presentation showing aggressiveness + goal dimensions
**Fix:** Update epilog in build command

### Gap 4: diag_app Only Tests 6 Levels

**Current:** `LEVELS=("O0" "O1" "O2" "O3" "Os" "Oz")`
**Required:** `LEVELS=("O0" "O1" "O1s" "O1z" "O2" "Os" "Oz" "O3" "O3s" "O3z")`
**Fix:** Update LEVELS array in diag_app.sh
