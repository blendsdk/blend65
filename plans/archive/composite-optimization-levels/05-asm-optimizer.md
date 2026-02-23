# AsmIL Optimizer: Composite Optimization Levels

> **Document**: 05-asm-optimizer.md
> **Parent**: [Index](00-index.md)

## Overview

The AsmIL optimizer uses an `OptimizationLevel` enum and `DEFAULT_OPTIONS` record map.
The pass factory (`createPassesForLevel`) uses level-based branching to select passes.

## Files to Modify

1. `packages/compiler/src/codegen/asm-il/optimizer/options.ts` — Enum + defaults
2. `packages/compiler/src/codegen/asm-il/optimizer/pass-factory.ts` — Pass selection logic

## File: `options.ts` — Enum + Defaults

### Enum Expansion

```typescript
export enum OptimizationLevel {
  O0 = 'O0',
  O1 = 'O1',
  O1s = 'O1s',
  O1z = 'O1z',
  O2 = 'O2',
  Os = 'Os',
  Oz = 'Oz',
  O3 = 'O3',
  O3s = 'O3s',
  O3z = 'O3z',
}
```

### DEFAULT_OPTIONS Expansion

New entries follow these rules:
- **s suffix**: 4 ZP slots, 1 max iteration, SizeOpt enabled
- **z suffix**: 4 ZP slots, 5 max iterations, SizeOpt aggressive

```typescript
// O1s: Basic + size — SizeOpt, ZP promotion, no inlining
[OptimizationLevel.O1s]: {
  level: OptimizationLevel.O1s,
  debug: false,
  zpSlots: [0x50, 0x51, 0x52, 0x53],
  maxIterations: 1,
},

// O1z: Basic + min-size — like O1s but multi-iteration
[OptimizationLevel.O1z]: {
  level: OptimizationLevel.O1z,
  debug: false,
  zpSlots: [0x50, 0x51, 0x52, 0x53],
  maxIterations: 5,
},

// O3s: Aggressive + size — ZP promotion, SizeOpt, no Strength6502
[OptimizationLevel.O3s]: {
  level: OptimizationLevel.O3s,
  debug: false,
  zpSlots: [0x50, 0x51, 0x52, 0x53],
  maxIterations: 1,
},

// O3z: Aggressive + min-size — like O3s but multi-iteration
[OptimizationLevel.O3z]: {
  level: OptimizationLevel.O3z,
  debug: false,
  zpSlots: [0x50, 0x51, 0x52, 0x53],
  maxIterations: 5,
},
```

### Helper Function Updates

**`isOptimizationEnabled()`** — unchanged logic (O0 is the only disabled level)

**`getAllLevels()`** — return all 10 levels:
```typescript
export function getAllLevels(): OptimizationLevel[] {
  return [
    OptimizationLevel.O0,
    OptimizationLevel.O1, OptimizationLevel.O1s, OptimizationLevel.O1z,
    OptimizationLevel.O2, OptimizationLevel.Os, OptimizationLevel.Oz,
    OptimizationLevel.O3, OptimizationLevel.O3s, OptimizationLevel.O3z,
  ];
}
```

## File: `pass-factory.ts` — Pass Selection

The pass factory uses level-based branching. Key changes:

### Helper concept: Use `getBaseLevel()` and `isSizeLevel()` patterns

Refactor the pass factory to use compositional logic instead of hardcoded level checks:

```typescript
export function createPassesForLevel(options: AsmOptimizerOptions): AsmOptimizationPass[] {
  const passes: AsmOptimizationPass[] = [];
  const level = options.level;

  // O0: No optimization
  if (level === OptimizationLevel.O0) return passes;

  // ── All levels O1+: Basic passes ──
  passes.push(new FlagPatternsPass());
  passes.push(new StoreLoadPass());

  // ── O2+ base: Standard passes ──
  // Includes: O2, Os, Oz, O3, O3s, O3z (NOT O1, O1s, O1z)
  const isO2Plus = level !== OptimizationLevel.O1 &&
                   level !== OptimizationLevel.O1s &&
                   level !== OptimizationLevel.O1z;
  if (isO2Plus) {
    passes.push(new BranchOptPass());
    passes.push(new TransferOptPass());
    passes.push(new CompareBranchPass());
    passes.push(new IndexedAddrPass());
    passes.push(new RegisterPromotePass());
  }

  // ── Size-focused levels: ZP promotion + StackOpt + SizeOpt ──
  const isSizeLevel = level === OptimizationLevel.Os || level === OptimizationLevel.Oz ||
                      level === OptimizationLevel.O1s || level === OptimizationLevel.O1z ||
                      level === OptimizationLevel.O3s || level === OptimizationLevel.O3z;

  // ── O3 speed: ZP promotion + Strength6502 + StackOpt ──
  if (level === OptimizationLevel.O3) {
    passes.push(new ZPPromotionPass(options.zpSlots));
    passes.push(new Strength6502Pass());
    passes.push(new StackOptPass());
  }

  // ── Size levels: ZP promotion + StackOpt + SizeOpt ──
  if (isSizeLevel) {
    passes.push(new ZPPromotionPass(options.zpSlots));
    passes.push(new StackOptPass());
    const isAggressive = level === OptimizationLevel.Oz ||
                         level === OptimizationLevel.O1z ||
                         level === OptimizationLevel.O3z;
    passes.push(new SizeOptPass(isAggressive));
  }

  return passes;
}
```

### Updated `getPlannedPassCounts()`

```typescript
export function getPlannedPassCounts(): Record<OptimizationLevel, number> {
  return {
    [OptimizationLevel.O0]: 0,
    [OptimizationLevel.O1]: 2,
    [OptimizationLevel.O1s]: 5,   // O1(2) + ZPPromotion + StackOpt + SizeOpt
    [OptimizationLevel.O1z]: 5,   // Same passes, more iterations
    [OptimizationLevel.O2]: 7,
    [OptimizationLevel.Os]: 10,
    [OptimizationLevel.Oz]: 10,
    [OptimizationLevel.O3]: 10,
    [OptimizationLevel.O3s]: 10,  // O2(7) + ZPPromotion + StackOpt + SizeOpt
    [OptimizationLevel.O3z]: 10,  // Same passes, more iterations
  };
}
```

## Complete AsmIL Pass Matrix (10 levels)

| Pass | O0 | O1 | O1s | O1z | O2 | Os | Oz | O3 | O3s | O3z |
|------|----|----|-----|-----|----|----|----|----|-----|-----|
| FlagPatterns | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| StoreLoad | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| BranchOpt | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| TransferOpt | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CompareBranch | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| IndexedAddr | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RegisterPromote | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ZPPromotion | - | - | ✓ | ✓ | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Strength6502 | - | - | - | - | - | - | - | ✓ | - | - |
| StackOpt | - | - | ✓ | ✓ | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| SizeOpt | - | - | ✓ | ✓(agg) | - | ✓ | ✓(agg) | - | ✓ | ✓(agg) |

| Config | O0 | O1 | O1s | O1z | O2 | Os | Oz | O3 | O3s | O3z |
|--------|----|----|-----|-----|----|----|----|----|-----|-----|
| ZP slots | 0 | 0 | 4 | 4 | 0 | 4 | 4 | 8 | 4 | 4 |
| Max iter | 1 | 1 | 1 | 5 | 1 | 1 | 5 | 5 | 1 | 5 |
