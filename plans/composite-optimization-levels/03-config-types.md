# Config Types: Composite Optimization Levels

> **Document**: 03-config-types.md
> **Parent**: [Index](00-index.md)

## Overview

The `OptimizationLevelId` type is the single source of truth for valid optimization
levels throughout the compiler. It must be expanded to include the 4 new composite levels.

## Changes Required

### File: `packages/compiler/src/config/types.ts`

**Current:**
```typescript
export type OptimizationLevelId = 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz';
```

**New:**
```typescript
export type OptimizationLevelId =
  | 'O0'
  | 'O1' | 'O1s' | 'O1z'
  | 'O2' | 'Os' | 'Oz'     // Os = O2s alias, Oz = O2z alias
  | 'O3' | 'O3s' | 'O3z';
```

**JSDoc must be updated to document all 10 levels:**
```typescript
/**
 * Optimization level identifiers
 *
 * Two-dimensional model: base aggressiveness + optional size modifier.
 *
 * **Base Levels (aggressiveness):**
 * - 'O0': No optimization
 * - 'O1': Basic optimizations (DCE, constant folding)
 * - 'O2': Standard optimizations (all passes, single iteration)
 * - 'O3': Aggressive optimizations (ZP promotion, strength reduction, multi-pass)
 *
 * **Size Modifiers (append to base):**
 * - 's': Optimize for size (disables inlining/unrolling, adds SizeOpt)
 * - 'z': Optimize for minimum size (like 's' + multi-pass iterations)
 *
 * **Composite Levels:**
 * - 'O1s': Basic + size optimization
 * - 'O1z': Basic + minimum size
 * - 'Os': Standard + size (alias for O2s)
 * - 'Oz': Standard + minimum size (alias for O2z)
 * - 'O3s': Aggressive + size optimization
 * - 'O3z': Aggressive + minimum size
 *
 * **Invalid:** O0s, O0z (no optimization + size is contradictory)
 */
```

### Validation Helper

Add a validation/normalization function to `packages/compiler/src/config/types.ts`:

```typescript
/**
 * All valid optimization level IDs (canonical forms).
 * Used for validation and iteration.
 */
export const ALL_OPTIMIZATION_LEVELS: readonly OptimizationLevelId[] = [
  'O0', 'O1', 'O1s', 'O1z', 'O2', 'Os', 'Oz', 'O3', 'O3s', 'O3z',
] as const;

/**
 * Normalize and validate an optimization level string.
 *
 * - Converts aliases: 'O2s' → 'Os', 'O2z' → 'Oz'
 * - Rejects invalid combos: 'O0s', 'O0z'
 * - Returns the canonical OptimizationLevelId
 *
 * @param input - Raw optimization level string from CLI or config
 * @returns Normalized OptimizationLevelId
 * @throws Error if input is invalid
 */
export function normalizeOptimizationLevel(input: string): OptimizationLevelId {
  // Handle aliases
  if (input === 'O2s') return 'Os';
  if (input === 'O2z') return 'Oz';

  // Reject invalid combinations
  if (input === 'O0s' || input === 'O0z') {
    throw new Error(
      `Invalid optimization level '${input}': size optimization requires at least O1. ` +
      `Use O1s, Os, or O3s instead.`
    );
  }

  // Validate against known levels
  if (!ALL_OPTIMIZATION_LEVELS.includes(input as OptimizationLevelId)) {
    throw new Error(
      `Unknown optimization level '${input}'. ` +
      `Valid levels: ${ALL_OPTIMIZATION_LEVELS.join(', ')}`
    );
  }

  return input as OptimizationLevelId;
}
```

### Helper Functions

```typescript
/**
 * Check if a level uses size optimization.
 * @param level - Optimization level
 * @returns true if level targets code size
 */
export function isSizeLevel(level: OptimizationLevelId): boolean {
  return level === 'Os' || level === 'Oz' ||
         level === 'O1s' || level === 'O1z' ||
         level === 'O3s' || level === 'O3z';
}

/**
 * Check if a level uses minimum-size (z) optimization with iterations.
 * @param level - Optimization level
 * @returns true if level targets minimum code size
 */
export function isMinSizeLevel(level: OptimizationLevelId): boolean {
  return level === 'Oz' || level === 'O1z' || level === 'O3z';
}

/**
 * Get the base aggressiveness level (stripping size modifier).
 * @param level - Optimization level
 * @returns Base level: 'O0', 'O1', 'O2', or 'O3'
 */
export function getBaseLevel(level: OptimizationLevelId): 'O0' | 'O1' | 'O2' | 'O3' {
  if (level === 'O0') return 'O0';
  if (level === 'O1' || level === 'O1s' || level === 'O1z') return 'O1';
  if (level === 'O2' || level === 'Os' || level === 'Oz') return 'O2';
  return 'O3'; // O3, O3s, O3z
}
```

## Integration Points

The `normalizeOptimizationLevel()` function should be called:
1. In `compiler.ts` when reading `config.compilerOptions.optimization`
2. In CLI `resolveOptimizationLevel()` function
3. In test helpers that accept optimization levels

## Testing Requirements

- Unit tests for `normalizeOptimizationLevel()` — all valid inputs, aliases, invalid combos
- Unit tests for `isSizeLevel()`, `isMinSizeLevel()`, `getBaseLevel()` helpers
- Verify `ALL_OPTIMIZATION_LEVELS` contains exactly 10 entries
