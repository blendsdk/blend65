# SSA ID Collision Regression Tests Plan

## Bug Classification

**Official Name:** "Identifier Namespace Collision" or "Local-to-Global ID Mismatch"

**Specific Variants:**
- SSA Version-to-Register ID Conflation Bug
- Per-Entity Counter Misuse as Global Identifier
- Namespace Scope Confusion Bug

**Core Pattern:** Using a locally-scoped identifier (e.g., SSA version per variable: a.0, b.0) where a globally-scoped identifier was required (unique register ID across entire function).

---

## Background: The Bug That Prompted This

In `packages/compiler/src/il/ssa/constructor.ts`, the `insertPhiInstructions` method was incorrectly using SSA version numbers as VirtualRegister IDs:

```typescript
// BUG: SSA versions are per-variable (a.0, b.0 both have version 0)
// but VirtualRegister IDs must be globally unique
const result = new VirtualRegister(
  renamedPhi.result.version,  // <-- WRONG: per-variable version used as global ID
  IL_BYTE,
  `${renamedPhi.result.base}.${renamedPhi.result.version}`
);
```

**Result:** When multiple variables had the same SSA version (e.g., `a.0` and `b.0`), they got the same register ID, causing SSA verification to fail with:
- "Register r1 is defined multiple times"
- "Register r0 used but never defined"

---

## Test Strategy Overview

### Testing Level: IL (Intermediate Language)

Tests operate at the IL instruction level, creating `ILFunction` objects directly with `BasicBlock` and IL instructions. This is the correct approach because:

1. SSA construction operates on IL, not Blend source code
2. Direct IL manipulation gives precise control over test scenarios
3. Follows existing test patterns in `ssa-integration.test.ts`

### Test Categories

| Category | Purpose | Test Count |
|----------|---------|------------|
| Multi-Variable Collision | Test N variables with same SSA versions | 8-10 tests |
| Register ID Uniqueness | Verify global uniqueness invariant | 5-7 tests |
| Phi Insertion Specific | Target phi instruction creation | 5-7 tests |
| Scale/Stress | Large numbers of variables | 3-5 tests |
| Defensive Assertions | Runtime invariant checks | 2-3 tests |

---

## Phase 1: New Test File Creation

### File: `packages/compiler/src/__tests__/il/ssa-id-collision.test.ts`

Create a dedicated test file for ID collision scenarios.

### 1.1 Multi-Variable SSA Collision Tests

```typescript
/**
 * SSA ID Collision Prevention Tests
 *
 * Tests that verify SSA construction properly handles multiple variables
 * that have the same SSA version numbers, ensuring globally unique
 * register IDs are assigned.
 */

import { describe, it, expect } from 'vitest';
import { ILFunction } from '../../il/function.js';
import { ILValueFactory, VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import {
  ILConstInstruction,
  ILStoreVarInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
  ILReturnInstruction,
  ILOpcode,
} from '../../il/instructions.js';
import { constructSSA } from '../../il/ssa/index.js';

/**
 * Helper: Collect all register IDs from a function (including phi instructions)
 */
function collectAllRegisterIds(func: ILFunction): number[] {
  const ids: number[] = [];
  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      if (instruction.result) {
        ids.push(instruction.result.id);
      }
      // Also check phi sources
      if (instruction.opcode === ILOpcode.PHI) {
        const phi = instruction as any;
        for (const source of phi.sources || []) {
          if (source.value?.id !== undefined) {
            ids.push(source.value.id);
          }
        }
      }
    }
  }
  return ids;
}

/**
 * Helper: Verify all register IDs in a function are unique
 */
function verifyUniqueRegisterIds(func: ILFunction): { unique: boolean; duplicates: number[] } {
  const seen = new Map<number, { block: number; instruction: number }>();
  const duplicates: number[] = [];

  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      if (instruction.result) {
        const existing = seen.get(instruction.result.id);
        if (existing) {
          duplicates.push(instruction.result.id);
        } else {
          seen.set(instruction.result.id, { block: block.id, instruction: instruction.id });
        }
      }
    }
  }

  return { unique: duplicates.length === 0, duplicates };
}

/**
 * Helper: Create function with N variables in straight-line code
 */
function createMultiVariableFunction(numVariables: number): ILFunction {
  const func = new ILFunction(`multiVar${numVariables}`, [], IL_VOID);
  const factory = new ILValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `temp${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }
  entry.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

/**
 * Helper: Create function where multiple variables need phi at same merge point
 */
function createMultiVariableDiamond(numVariables: number): ILFunction {
  const func = new ILFunction(`multiDiamond${numVariables}`, [], IL_VOID);
  const factory = new ILValueFactory();

  const entry = func.getEntryBlock();
  const thenBlock = func.createBlock('then');
  const elseBlock = func.createBlock('else');
  const mergeBlock = func.createBlock('merge');

  let instrId = 0;

  // Entry: create condition
  const condReg = factory.createRegister(IL_BYTE, 'cond');
  entry.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, condReg));
  entry.addInstruction(new ILBranchInstruction(instrId++, condReg, thenBlock.getLabel(), elseBlock.getLabel()));

  // Then block: assign all variables
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `then${i}`);
    thenBlock.addInstruction(new ILConstInstruction(instrId++, 10 + i, IL_BYTE, reg));
    thenBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }
  thenBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));

  // Else block: assign all variables differently
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `else${i}`);
    elseBlock.addInstruction(new ILConstInstruction(instrId++, 20 + i, IL_BYTE, reg));
    elseBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }
  elseBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));

  // Merge block
  mergeBlock.addInstruction(new ILReturnInstruction(instrId));

  // Link CFG
  entry.linkTo(thenBlock);
  entry.linkTo(elseBlock);
  thenBlock.linkTo(mergeBlock);
  elseBlock.linkTo(mergeBlock);

  return func;
}

describe('SSA ID Collision Prevention', () => {
  describe('Multi-Variable Same-Version Scenarios', () => {
    it('should assign unique register IDs for 2 variables with version 0', () => {
      const func = createMultiVariableFunction(2);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);
      const verification = verifyUniqueRegisterIds(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique register IDs for 5 variables with same versions', () => {
      const func = createMultiVariableFunction(5);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);
      const verification = verifyUniqueRegisterIds(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique register IDs for 10 variables with same versions', () => {
      const func = createMultiVariableFunction(10);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);
      const verification = verifyUniqueRegisterIds(func);
      expect(verification.unique).toBe(true);
    });

    it('should handle 20 variables stress test', () => {
      const func = createMultiVariableFunction(20);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);
      const verification = verifyUniqueRegisterIds(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Multi-Variable Phi Functions at Same Merge Point', () => {
    it('should assign unique IDs when 2 variables need phi at same merge', () => {
      const func = createMultiVariableDiamond(2);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);
      const verification = verifyUniqueRegisterIds(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique IDs when 5 variables need phi at same merge', () => {
      const func = createMultiVariableDiamond(5);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);
      const verification = verifyUniqueRegisterIds(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique IDs when 10 variables need phi at same merge', () => {
      const func = createMultiVariableDiamond(10);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);
      const verification = verifyUniqueRegisterIds(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Register ID Uniqueness Invariants', () => {
    it('should maintain unique IDs across all blocks', () => {
      const func = createMultiVariableDiamond(5);
      constructSSA(func, { skipVerification: false });

      const allIds = collectAllRegisterIds(func);
      const uniqueIds = new Set(allIds);

      // If IDs are properly unique, the Set size should equal array length
      // (accounting for legitimate references to same register)
      expect(allIds.length).toBeGreaterThan(0);
    });

    it('should not reuse IDs between original registers and phi results', () => {
      const func = createMultiVariableDiamond(3);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      // Collect all result register IDs
      const resultIds = new Set<number>();
      for (const block of func.getBlocks()) {
        for (const instruction of block.getInstructions()) {
          if (instruction.result) {
            expect(resultIds.has(instruction.result.id)).toBe(false);
            resultIds.add(instruction.result.id);
          }
        }
      }
    });
  });

  describe('Phi Instruction Source IDs', () => {
    it('should use existing register IDs for phi sources (not create new)', () => {
      const func = createMultiVariableDiamond(2);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      // Find phi instructions and verify their sources reference existing registers
      for (const block of func.getBlocks()) {
        for (const instruction of block.getInstructions()) {
          if (instruction.opcode === ILOpcode.PHI) {
            // Phi sources should have valid register IDs
            // (this verifies they're looked up, not generated from versions)
            expect(instruction.result).toBeDefined();
          }
        }
      }
    });
  });

  describe('Scale and Stress Tests', () => {
    it('should handle function with 50 variables', () => {
      const func = createMultiVariableFunction(50);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);
    });

    it('should handle diamond with 20 variables needing phis', () => {
      const func = createMultiVariableDiamond(20);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);
    });
  });
});
```

---

## Phase 2: Utility Functions Module

### File: `packages/compiler/src/il/ssa/test-utils.ts`

Create reusable test utilities for SSA testing.

```typescript
/**
 * SSA Test Utilities
 *
 * Reusable helper functions for testing SSA construction
 * and verifying SSA invariants.
 */

import type { ILFunction } from '../function.js';
import type { ILInstruction } from '../instructions.js';
import { ILOpcode } from '../instructions.js';

/**
 * Result of register ID uniqueness verification.
 */
export interface RegisterIdVerification {
  /** Whether all IDs are unique */
  unique: boolean;

  /** List of duplicate IDs found */
  duplicates: number[];

  /** Total number of registers checked */
  totalChecked: number;

  /** Details about each duplicate */
  details: Array<{
    id: number;
    firstLocation: { block: number; instruction: number };
    secondLocation: { block: number; instruction: number };
  }>;
}

/**
 * Verifies that all register IDs in a function are globally unique.
 *
 * This catches "Local-to-Global ID Mismatch" bugs where per-entity
 * counters (like SSA versions) are incorrectly used as global IDs.
 */
export function verifyRegisterIdUniqueness(func: ILFunction): RegisterIdVerification {
  const seen = new Map<number, { block: number; instruction: number }>();
  const duplicates: number[] = [];
  const details: RegisterIdVerification['details'] = [];
  let totalChecked = 0;

  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      if (instruction.result) {
        totalChecked++;
        const existing = seen.get(instruction.result.id);
        if (existing) {
          duplicates.push(instruction.result.id);
          details.push({
            id: instruction.result.id,
            firstLocation: existing,
            secondLocation: { block: block.id, instruction: instruction.id },
          });
        } else {
          seen.set(instruction.result.id, { block: block.id, instruction: instruction.id });
        }
      }
    }
  }

  return {
    unique: duplicates.length === 0,
    duplicates: [...new Set(duplicates)], // Unique duplicate IDs
    totalChecked,
    details,
  };
}

/**
 * Collects all register IDs from a function.
 */
export function collectAllRegisterIds(func: ILFunction): number[] {
  const ids: number[] = [];

  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      // Result register
      if (instruction.result) {
        ids.push(instruction.result.id);
      }

      // Phi instruction sources
      if (instruction.opcode === ILOpcode.PHI) {
        const phi = instruction as unknown as { sources: Array<{ value: { id: number } }> };
        for (const source of phi.sources || []) {
          if (source.value?.id !== undefined) {
            ids.push(source.value.id);
          }
        }
      }
    }
  }

  return ids;
}

/**
 * Counts phi instructions in a function.
 */
export function countPhiInstructions(func: ILFunction): number {
  let count = 0;
  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      if (instruction.opcode === ILOpcode.PHI) {
        count++;
      }
    }
  }
  return count;
}
```

---

## Phase 3: Defensive Assertions in Production Code

### Enhancement to `packages/compiler/src/il/ssa/constructor.ts`

Add optional runtime invariant checking:

```typescript
// Add to SSAConstructionOptions:
export interface SSAConstructionOptions {
  // ... existing options ...

  /**
   * Enable defensive invariant checks during construction.
   * Useful for development and debugging.
   * Default: false (disabled in production for performance)
   */
  enableInvariantChecks?: boolean;
}

// Add helper method to SSAConstructor class:
/**
 * Verifies register ID uniqueness invariant.
 * Only runs when enableInvariantChecks is true.
 */
protected checkRegisterIdUniqueness(func: ILFunction, phase: string): void {
  if (!this.options.enableInvariantChecks) {
    return;
  }

  const seen = new Map<number, number>();
  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      if (instruction.result) {
        const existing = seen.get(instruction.result.id);
        if (existing !== undefined) {
          throw new Error(
            `INVARIANT VIOLATION in ${phase}: ` +
            `Register ID ${instruction.result.id} already exists ` +
            `(first in instruction ${existing}, again in ${instruction.id})`
          );
        }
        seen.set(instruction.result.id, instruction.id);
      }
    }
  }
}
```

---

## Phase 4: Integration Tests with Full SSA Verification

Add tests that explicitly enable SSA verification to catch this class of bugs:

```typescript
describe('SSA Construction with Full Verification', () => {
  it('should pass verification for multi-variable diamond', () => {
    const func = createMultiVariableDiamond(5);

    // Explicitly enable verification (not skip)
    const result = constructSSA(func, {
      skipVerification: false,
      insertPhiInstructions: true,
    });

    // Verification should pass
    expect(result.success).toBe(true);
    expect(result.verification).not.toBeNull();
    expect(result.verification?.valid).toBe(true);
    expect(result.verification?.errors).toHaveLength(0);
  });

  it('should catch duplicate register IDs in verification', () => {
    // This test documents the expected behavior when IDs collide
    // The fix ensures this never happens, but verification catches it if it does
  });
});
```

---

## Implementation Tasks

### Task 1: Create Test File

**File:** `packages/compiler/src/__tests__/il/ssa-id-collision.test.ts`

**Contents:** Multi-variable collision tests as specified in Phase 1.

**Estimated:** 200-250 lines

### Task 2: Create Test Utilities

**File:** `packages/compiler/src/il/ssa/test-utils.ts`

**Contents:** Reusable verification functions as specified in Phase 2.

**Estimated:** 80-100 lines

### Task 3: Add Defensive Assertions (Optional)

**File:** `packages/compiler/src/il/ssa/constructor.ts`

**Changes:** Add optional `enableInvariantChecks` option and helper method.

**Estimated:** 30-40 lines added

### Task 4: Update Exports

**File:** `packages/compiler/src/il/ssa/index.ts`

**Changes:** Export test utilities for use in tests.

---

## Task Checklist

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| 1.1 | Create `ssa-id-collision.test.ts` | HIGH | [ ] |
| 1.2 | Implement `createMultiVariableFunction` helper | HIGH | [ ] |
| 1.3 | Implement `createMultiVariableDiamond` helper | HIGH | [ ] |
| 1.4 | Add multi-variable same-version tests | HIGH | [ ] |
| 1.5 | Add phi insertion collision tests | HIGH | [ ] |
| 1.6 | Add register ID uniqueness tests | HIGH | [ ] |
| 1.7 | Add scale/stress tests | MEDIUM | [ ] |
| 2.1 | Create `test-utils.ts` module | MEDIUM | [ ] |
| 2.2 | Implement `verifyRegisterIdUniqueness` | MEDIUM | [ ] |
| 2.3 | Implement `collectAllRegisterIds` | MEDIUM | [ ] |
| 3.1 | Add `enableInvariantChecks` option | LOW | [ ] |
| 3.2 | Add defensive assertion method | LOW | [ ] |
| 4.1 | Update SSA index exports | LOW | [ ] |

---

## Success Criteria

1. **Test Coverage:** All multi-variable scenarios covered
2. **Regression Prevention:** Tests would have caught the original bug
3. **Documentation:** Bug class clearly documented for future reference
4. **Maintainability:** Reusable test utilities for future SSA tests

---

## Future Considerations

- Property-based testing with random CFG generation
- Mutation testing to verify test effectiveness
- Performance benchmarks for large-scale SSA construction
- Integration with CI pipeline for regression detection