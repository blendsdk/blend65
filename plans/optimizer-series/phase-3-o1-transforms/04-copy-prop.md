# Phase 3.4: Copy Propagation

> **Document**: 04-copy-prop.md  
> **Phase**: 3 - O1 Transforms  
> **Focus**: Replace copies with original values  
> **Est. Lines**: ~250  
> **Session**: 3.4

---

## Overview

**Copy Propagation** replaces uses of a copied value with the original value. This eliminates redundant moves and enables further optimizations.

### What is Copy Propagation?

```typescript
// Before Copy Propagation
v1 = load addr
v2 = copy v1          // v2 is just a copy of v1
v3 = add v2, 5        // Uses the copy

// After Copy Propagation
v1 = load addr
v2 = copy v1          // May become dead
v3 = add v1, 5        // Uses original v1 instead!
```

**Benefits:**
- Reduces register pressure
- Enables dead code elimination of copy instructions
- Simplifies code for other optimizations
- Works synergistically with SSA construction

---

## Algorithm

### Copy Propagation Process

```
1. Build use-def information
2. Find all copy instructions: v2 = copy v1
3. For each copy:
   a. Get the source value (v1)
   b. Get all uses of the destination (v2)
   c. Replace uses of v2 with v1
4. After all replacements, DCE removes dead copies
```

### What is a Copy?

A "copy" instruction transfers a value without modification:
- `v2 = copy v1` (explicit copy)
- `v2 = move v1` (move instruction)
- `v2 = phi [v1, bb1]` (phi with single predecessor)

---

## Data Structures

### Copy Information

```typescript
/**
 * Information about a copy instruction.
 */
interface CopyInfo {
  /** The copy instruction */
  instruction: ILInstruction;
  
  /** Source value being copied */
  source: ILValue;
  
  /** Destination value (copy result) */
  destination: ILValue;
}

/**
 * Copy propagation statistics.
 */
interface CopyPropStats {
  /** Number of copies found */
  copiesFound: number;
  
  /** Number of uses replaced */
  usesReplaced: number;
  
  /** Number of copies that became dead */
  copiesEliminated: number;
}
```

---

## Implementation

### CopyPropagation Class

```typescript
import { TransformPass } from '../passes/transform-pass.js';
import { UseDefAnalysis, UseDefInfo } from '../analysis/use-def.js';
import { ILFunction, BasicBlock, ILInstruction, ILValue } from '../../il/index.js';

/**
 * Copy Propagation pass.
 * 
 * Replaces uses of copied values with the original source.
 * Eliminates redundant copy/move instructions.
 * 
 * @example
 * ```typescript
 * const copyProp = new CopyPropagation();
 * copyProp.runOnFunction(func);
 * ```
 */
export class CopyPropagation extends TransformPass {
  static override readonly passName = 'copy-prop';
  static override readonly description = 'Copy Propagation';
  static override readonly preserves = ['cfg'];
  static override readonly requires = [UseDefAnalysis];
  
  /** Use-def information */
  protected useDef!: UseDefInfo;
  
  /** Map from copy destination to source */
  protected copyMap = new Map<ILValue, ILValue>();
  
  /** Statistics */
  protected stats: CopyPropStats = {
    copiesFound: 0,
    usesReplaced: 0,
    copiesEliminated: 0
  };
  
  /**
   * Run copy propagation on a function.
   */
  override runOnFunction(func: ILFunction): boolean {
    this.useDef = this.manager.getAnalysis(UseDefAnalysis, func);
    
    // Phase 1: Find all copies
    this.findCopies(func);
    
    // Phase 2: Propagate through copy chains
    this.resolveCopyChains();
    
    // Phase 3: Replace uses
    const changed = this.replaceUses(func);
    
    return changed;
  }
  
  /**
   * Find all copy instructions.
   */
  protected findCopies(func: ILFunction): void {
    this.copyMap.clear();
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (this.isCopy(inst)) {
          const source = inst.getOperand(0);
          const dest = inst.getResult();
          
          if (source && dest) {
            this.copyMap.set(dest, source);
            this.stats.copiesFound++;
          }
        }
      }
    }
  }
  
  /**
   * Check if an instruction is a copy.
   */
  protected isCopy(inst: ILInstruction): boolean {
    const opcode = inst.getOpcode();
    
    // Explicit copy/move instructions
    if (opcode === 'copy' || opcode === 'move') {
      return true;
    }
    
    // Phi with single predecessor is effectively a copy
    if (opcode === 'phi' && inst.getOperandCount() === 1) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Resolve copy chains: if v2 = copy v1 and v3 = copy v2,
   * then v3 should map to v1, not v2.
   */
  protected resolveCopyChains(): void {
    // Keep resolving until fixed point
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const [dest, source] of this.copyMap) {
        // If source is also a copy destination, follow the chain
        const transitiveSource = this.copyMap.get(source);
        if (transitiveSource) {
          this.copyMap.set(dest, transitiveSource);
          changed = true;
        }
      }
    }
  }
  
  /**
   * Replace uses of copy destinations with sources.
   */
  protected replaceUses(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        const operands = inst.getOperands();
        
        for (let i = 0; i < operands.length; i++) {
          const source = this.copyMap.get(operands[i]);
          
          if (source) {
            // Replace with original source
            inst.replaceOperand(i, source);
            this.stats.usesReplaced++;
            changed = true;
          }
        }
      }
    }
    
    return changed;
  }
  
  /**
   * Get statistics.
   */
  getStats(): CopyPropStats {
    return { ...this.stats };
  }
}
```

---

## Special Cases

### Copy Chains

Multiple copies in sequence must resolve to the original:

```typescript
// Before
v1 = load addr
v2 = copy v1
v3 = copy v2
v4 = add v3, 5

// After (chains resolved)
v1 = load addr
v2 = copy v1      // Dead
v3 = copy v2      // Dead
v4 = add v1, 5    // Uses original v1!
```

### Phi Functions

Single-predecessor phi is effectively a copy:

```typescript
// Before
entry:
  v1 = const 5
  br bb1
bb1:
  v2 = phi [v1, entry]    // Only one incoming value
  v3 = add v2, 1

// After
v3 = add v1, 1    // phi bypassed
```

### Don't Propagate Across Redefinitions

If source is redefined between copy and use, don't propagate:

```typescript
v1 = const 5
v2 = copy v1
v1 = const 10     // v1 redefined!
v3 = add v2, 1    // MUST use v2, not v1
```

In SSA form, this situation cannot occur (each assignment creates a new value).

---

## Examples

### Basic Copy Elimination

```typescript
// Before
v1 = load $1000
v2 = copy v1
v3 = add v2, v2
return v3

// After copy propagation
v1 = load $1000
v2 = copy v1      // Dead - DCE will remove
v3 = add v1, v1   // Uses v1 directly
return v3
```

### Register Coalescing Opportunity

```typescript
// Before (after register allocation might assign different regs)
v1 = compute()
v2 = copy v1
use(v2)

// After copy propagation (same register can be used)
v1 = compute()
use(v1)
```

---

## Testing Strategy

### Test Categories

1. **Simple copies**: Single copy propagation
2. **Copy chains**: v3 = copy v2 = copy v1
3. **Multiple uses**: One copy, many uses
4. **Phi copies**: Single-predecessor phi functions
5. **Non-copies**: Don't propagate non-copy instructions
6. **SSA preservation**: Correct in SSA form

### Example Tests

```typescript
describe('CopyPropagation', () => {
  it('should replace copy uses with source', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = copy v1
      v3 = add v2, 1
      return v3
    `);
    
    const prop = new CopyPropagation(passManager);
    prop.runOnFunction(func);
    
    // v2 should be replaced with v1 in the add
    const addInst = findInstruction(func, 'add');
    expect(addInst.getOperand(0)).toBe(v1);
  });
  
  it('should resolve copy chains', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = copy v1
      v3 = copy v2
      v4 = add v3, 1
      return v4
    `);
    
    const prop = new CopyPropagation(passManager);
    prop.runOnFunction(func);
    
    // v3 should resolve to v1 (through v2)
    const addInst = findInstruction(func, 'add');
    expect(addInst.getOperand(0)).toBe(v1);
  });
  
  it('should handle phi as copy', () => {
    const func = createFunction(`
      entry:
        v1 = const 5
        br bb1
      bb1:
        v2 = phi [v1, entry]
        v3 = add v2, 1
        return v3
    `);
    
    const prop = new CopyPropagation(passManager);
    prop.runOnFunction(func);
    
    expect(prop.getStats().copiesFound).toBe(1);
  });
});
```

---

## File Location

```
packages/compiler/src/optimizer/transforms/copy-prop.ts
```

---

## Dependencies

| Dependency | From | Purpose |
|------------|------|---------|
| `TransformPass` | Phase 1 | Base class |
| `UseDefAnalysis` | Phase 2 | Find uses to replace |
| `ILFunction` | IL Generator | Function to optimize |
| `ILValue` | IL Generator | Value manipulation |

---

## Interaction with Other Passes

**Works well with:**
- **SSA Construction**: SSA produces many copies (phi functions)
- **DCE**: Removes dead copies after propagation
- **Register Allocation**: Enables coalescing

**Typical pipeline:**
```
SSA → CopyProp → ConstProp → ConstFold → DCE
```

---

## Performance Notes

**Time Complexity**: O(n × d) where:
- n = number of instructions
- d = maximum copy chain depth (usually small)

**Space Complexity**: O(c) where c = number of copies

---

**Parent**: [Phase 3 Index](00-phase-index.md)  
**Previous**: [Constant Propagation](03-constant-prop.md)  
**Next**: [Phase 3 Tasks](99-phase-tasks.md)