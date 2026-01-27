# Phase 1.3: Optimization Options

> **Document**: 03-options.md  
> **Phase**: 1 - Foundation  
> **Est. Time**: ~1.5 hours  
> **Tests**: ~25 tests

---

## Overview

This document specifies the **OptimizationOptions** and **OptimizationLevel** types that control which passes run and how aggressive they are.

---

## File Location

```
packages/compiler/src/optimizer/options.ts
```

---

## Type Definitions

### OptimizationLevel Enum

```typescript
/**
 * Optimization level presets.
 * 
 * Each level enables a specific set of optimization passes.
 * Higher levels enable more aggressive optimizations but may
 * increase compile time.
 */
export enum OptimizationLevel {
  /** No optimization - for debugging, fastest compile */
  O0 = 0,
  
  /** Basic optimizations - DCE, constant folding/propagation */
  O1 = 1,
  
  /** Standard optimizations - O1 + peephole (default for release) */
  O2 = 2,
  
  /** Aggressive optimizations - O2 + loops + advanced */
  O3 = 3,
  
  /** Size optimization - like O2 but favors smaller code */
  Os = 10,
  
  /** Minimum size - aggressive size reduction */
  Oz = 11,
}
```

### OptimizationOptions Interface

```typescript
/**
 * Configuration options for the optimizer.
 * 
 * @example
 * ```typescript
 * const options: OptimizationOptions = {
 *   level: OptimizationLevel.O2,
 *   enableDCE: true,
 *   verbose: false,
 * };
 * ```
 */
export interface OptimizationOptions {
  /** Base optimization level */
  level: OptimizationLevel;
  
  // ─────────────────────────────────────────────────
  // Per-Pass Enable/Disable Overrides
  // ─────────────────────────────────────────────────
  
  /** Dead Code Elimination (default: enabled at O1+) */
  enableDCE?: boolean;
  
  /** Constant Folding (default: enabled at O1+) */
  enableConstantFold?: boolean;
  
  /** Constant Propagation (default: enabled at O1+) */
  enableConstantProp?: boolean;
  
  /** Copy Propagation (default: enabled at O1+) */
  enableCopyProp?: boolean;
  
  /** Common Subexpression Elimination (default: enabled at O2+) */
  enableCSE?: boolean;
  
  /** IL Peephole patterns (default: enabled at O2+) */
  enablePeephole?: boolean;
  
  /** ASM Peephole patterns (default: enabled at O2+) */
  enableAsmPeephole?: boolean;
  
  /** Loop optimizations (default: enabled at O3) */
  enableLoopOpt?: boolean;
  
  // ─────────────────────────────────────────────────
  // Target Options
  // ─────────────────────────────────────────────────
  
  /** Target platform ID (c64, c128, x16) */
  targetId?: string;
  
  /** Enable zero-page aggressive optimization */
  enableZeroPageOpt?: boolean;
  
  // ─────────────────────────────────────────────────
  // Debug Options
  // ─────────────────────────────────────────────────
  
  /** Print optimization statistics */
  verbose?: boolean;
  
  /** Dump IL after each pass (for debugging) */
  dumpAfterEachPass?: boolean;
  
  /** Validate IL after each transform */
  validateAfterTransform?: boolean;
}
```

---

## Helper Functions

### Create Default Options

```typescript
/**
 * Create default optimization options for a level.
 * 
 * @param level - The optimization level
 * @returns Complete options with defaults filled in
 * 
 * @example
 * ```typescript
 * const opts = createDefaultOptions(OptimizationLevel.O2);
 * // opts.enableDCE === true
 * // opts.enablePeephole === true
 * ```
 */
export function createDefaultOptions(
  level: OptimizationLevel
): Required<OptimizationOptions> {
  return {
    level,
    
    // O1+ passes
    enableDCE: level >= OptimizationLevel.O1,
    enableConstantFold: level >= OptimizationLevel.O1,
    enableConstantProp: level >= OptimizationLevel.O1,
    enableCopyProp: level >= OptimizationLevel.O1,
    
    // O2+ passes
    enableCSE: level >= OptimizationLevel.O2,
    enablePeephole: level >= OptimizationLevel.O2,
    enableAsmPeephole: level >= OptimizationLevel.O2,
    
    // O3 passes
    enableLoopOpt: level >= OptimizationLevel.O3,
    
    // Target
    targetId: 'c64',
    enableZeroPageOpt: level >= OptimizationLevel.O2,
    
    // Debug
    verbose: false,
    dumpAfterEachPass: false,
    validateAfterTransform: level === OptimizationLevel.O0,
  };
}
```

### Merge Options

```typescript
/**
 * Merge user options with defaults.
 * 
 * @param userOptions - Partial options from user
 * @returns Complete options with defaults for unspecified fields
 */
export function mergeOptions(
  userOptions: OptimizationOptions
): Required<OptimizationOptions> {
  const defaults = createDefaultOptions(userOptions.level);
  
  return {
    ...defaults,
    ...userOptions,
  };
}
```

### Get Passes for Level

```typescript
/**
 * Pass definitions for each optimization level.
 */
const LEVEL_PASSES: Record<OptimizationLevel, readonly string[]> = {
  [OptimizationLevel.O0]: [],
  [OptimizationLevel.O1]: [
    'dce',
    'constant-fold',
    'constant-prop',
    'copy-prop',
  ],
  [OptimizationLevel.O2]: [
    'dce',
    'constant-fold',
    'constant-prop',
    'copy-prop',
    'cse',
    'peephole',
    'asm-peephole',
  ],
  [OptimizationLevel.O3]: [
    'dce',
    'constant-fold',
    'constant-prop',
    'copy-prop',
    'cse',
    'peephole',
    'asm-peephole',
    'licm',
    'loop-unroll',
  ],
  [OptimizationLevel.Os]: [
    'dce',
    'constant-fold',
    'constant-prop',
    'copy-prop',
    'cse',
    'peephole',
    'asm-peephole',
    'tail-merge',
  ],
  [OptimizationLevel.Oz]: [
    'dce',
    'constant-fold',
    'constant-prop',
    'copy-prop',
    'peephole',
    'asm-peephole',
    'tail-merge',
    'code-dedup',
  ],
};

/**
 * Get the list of pass names enabled for an optimization level.
 * 
 * @param level - The optimization level
 * @returns Array of pass names enabled for this level
 */
export function getPassesForLevel(level: OptimizationLevel): readonly string[] {
  return LEVEL_PASSES[level] ?? [];
}
```

### Check if Pass Enabled

```typescript
/**
 * Check if a specific pass is enabled for the given options.
 * 
 * @param passName - Name of the pass
 * @param options - Optimization options
 * @returns true if pass should run
 */
export function isPassEnabled(
  passName: string,
  options: Required<OptimizationOptions>
): boolean {
  // Check explicit overrides first
  switch (passName) {
    case 'dce':
      return options.enableDCE;
    case 'constant-fold':
      return options.enableConstantFold;
    case 'constant-prop':
      return options.enableConstantProp;
    case 'copy-prop':
      return options.enableCopyProp;
    case 'cse':
      return options.enableCSE;
    case 'peephole':
      return options.enablePeephole;
    case 'asm-peephole':
      return options.enableAsmPeephole;
    default:
      // Check if pass is in level's pass list
      return getPassesForLevel(options.level).includes(passName);
  }
}
```

---

## Test Requirements

### Unit Tests (~25 tests)

| Test Category | Tests | Description |
|---------------|-------|-------------|
| OptimizationLevel | 6 | Enum values |
| createDefaultOptions | 8 | Default creation |
| mergeOptions | 4 | Option merging |
| getPassesForLevel | 4 | Level → passes |
| isPassEnabled | 3 | Pass enable check |

### Test Cases

```typescript
describe('OptimizationLevel', () => {
  it('should have O0 value 0');
  it('should have O1 value 1');
  it('should have O2 value 2');
  it('should have O3 value 3');
  it('should have Os value 10');
  it('should have Oz value 11');
});

describe('createDefaultOptions', () => {
  it('should disable all passes for O0');
  it('should enable DCE for O1');
  it('should enable peephole for O2');
  it('should enable loop opts for O3');
  it('should enable tail-merge for Os');
  it('should enable code-dedup for Oz');
});

describe('mergeOptions', () => {
  it('should use defaults for unspecified options');
  it('should override defaults with user values');
  it('should allow disabling passes at higher levels');
});

describe('getPassesForLevel', () => {
  it('should return empty for O0');
  it('should return O1 passes');
  it('should return O2 passes (superset of O1)');
  it('should return O3 passes (superset of O2)');
});

describe('isPassEnabled', () => {
  it('should respect explicit enable overrides');
  it('should respect explicit disable overrides');
  it('should fall back to level default');
});
```

---

## Usage Examples

### Basic Usage

```typescript
import { OptimizationLevel, createDefaultOptions } from './options.js';

// Use O2 defaults
const opts = createDefaultOptions(OptimizationLevel.O2);
```

### Custom Options

```typescript
import { OptimizationLevel, mergeOptions } from './options.js';

// O2 but disable peephole
const opts = mergeOptions({
  level: OptimizationLevel.O2,
  enablePeephole: false,
  verbose: true,
});
```

### CLI Integration

```typescript
// From CLI: blend65 compile -O2 --no-peephole source.blend
const cliOptions = {
  level: OptimizationLevel.O2,
  enablePeephole: false,
};
```

---

## Task Checklist

| Task | Status |
|------|--------|
| Create `options.ts` file | [ ] |
| Implement OptimizationLevel enum | [ ] |
| Implement OptimizationOptions interface | [ ] |
| Implement createDefaultOptions | [ ] |
| Implement mergeOptions | [ ] |
| Implement getPassesForLevel | [ ] |
| Implement isPassEnabled | [ ] |
| Add JSDoc to all exports | [ ] |
| Write unit tests (~25) | [ ] |
| Verify 100% coverage | [ ] |

---

**Previous**: [02-pass-manager.md](02-pass-manager.md)  
**Next**: [04-pipeline.md](04-pipeline.md)