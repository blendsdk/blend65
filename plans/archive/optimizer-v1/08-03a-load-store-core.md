# Task 8.3a: Load-Store Core Patterns

> **Task**: 8.3a of 14 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~25 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement core load-store peephole patterns for redundant instruction elimination:
- Redundant LDA after STA (same location)
- Redundant STA after STA (same location)
- Store-Load elimination
- Dead store removal

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                   # Pattern exports
└── load-store-core.ts         # THIS TASK
```

---

## Implementation

### File: `load-store-core.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode, ILValue } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: STA followed by LDA from same location
 * 
 * Before:
 *   STA $addr
 *   LDA $addr
 * 
 * After:
 *   STA $addr
 *   (LDA eliminated - A already has the value)
 * 
 * Saves: 3-4 cycles, 2-3 bytes
 */
export class StaLdaSamePattern extends BasePattern {
  readonly id = 'sta-lda-same';
  readonly description = 'Remove LDA after STA to same address';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check: STA followed by LDA
    if (!this.isStore(first) || !this.isLoad(second)) {
      return null;
    }
    
    // Check: Same address
    if (!this.sameAddress(first, second)) {
      return null;
    }
    
    // Check: Same register (must be A for STA/LDA)
    if (!this.isAccumulatorOp(first) || !this.isAccumulatorOp(second)) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([
        ['store', first.operands[0]],
        ['address', first.operands[1]],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Keep only the STA
    return {
      instructions: [match.matched[0]],
      cyclesSaved: 3, // LDA abs = 4 cycles, we remove it
      bytesSaved: 3,  // LDA abs = 3 bytes
    };
  }
  
  /** Check if both instructions reference same address */
  protected sameAddress(a: ILInstruction, b: ILInstruction): boolean {
    const addrA = this.getAddress(a);
    const addrB = this.getAddress(b);
    if (!addrA || !addrB) return false;
    return addrA === addrB;
  }
  
  /** Get address operand from instruction */
  protected getAddress(inst: ILInstruction): string | null {
    // Address is typically second operand for store, first for load
    const operand = inst.opcode === ILOpcode.Store 
      ? inst.operands[1] 
      : inst.operands[0];
    return operand?.toString() ?? null;
  }
  
  /** Check if instruction operates on accumulator */
  protected isAccumulatorOp(inst: ILInstruction): boolean {
    // Check metadata or register field
    return inst.metadata?.get('register') === 'A';
  }
}

/**
 * Pattern: Consecutive STA to same location
 * 
 * Before:
 *   STA $addr
 *   STA $addr
 * 
 * After:
 *   STA $addr
 *   (first STA eliminated - overwritten immediately)
 * 
 * Saves: 3-4 cycles, 2-3 bytes
 */
export class StaStaSamePattern extends BasePattern {
  readonly id = 'sta-sta-same';
  readonly description = 'Remove first STA when followed by STA to same address';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check: Both are stores
    if (!this.isStore(first) || !this.isStore(second)) {
      return null;
    }
    
    // Check: Same address
    if (!this.sameAddress(first, second)) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([
        ['address', first.operands[1]],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Keep only the second STA
    return {
      instructions: [match.matched[1]],
      cyclesSaved: 4,
      bytesSaved: 3,
    };
  }
  
  protected sameAddress(a: ILInstruction, b: ILInstruction): boolean {
    const addrA = a.operands[1]?.toString();
    const addrB = b.operands[1]?.toString();
    return addrA !== undefined && addrA === addrB;
  }
}

/**
 * Pattern: LDA followed by STA, then another LDA from STA target
 * 
 * Before:
 *   LDA $src
 *   STA $dst
 *   LDA $dst
 * 
 * After:
 *   LDA $src
 *   STA $dst
 *   (third LDA eliminated)
 * 
 * Saves: 3-4 cycles, 2-3 bytes
 */
export class LdaStaLdaPattern extends BasePattern {
  readonly id = 'lda-sta-lda';
  readonly description = 'Remove LDA after STA when A still has value';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [first, second, third] = instructions;
    
    // Check: LDA, STA, LDA sequence
    if (!this.isLoad(first) || !this.isStore(second) || !this.isLoad(third)) {
      return null;
    }
    
    // Check: Third LDA loads from where second STA stored
    const staAddr = second.operands[1]?.toString();
    const ldaAddr = third.operands[0]?.toString();
    
    if (!staAddr || !ldaAddr || staAddr !== ldaAddr) {
      return null;
    }
    
    return {
      matched: [first, second, third],
      captures: this.capture([
        ['src', first.operands[0]],
        ['dst', second.operands[1]],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Keep only LDA and STA
    return {
      instructions: [match.matched[0], match.matched[1]],
      cyclesSaved: 4,
      bytesSaved: 3,
    };
  }
}

/**
 * Pattern: Dead store (STA to location never read)
 * 
 * Note: This pattern requires liveness analysis.
 * Only matches when metadata indicates store is dead.
 * 
 * Before:
 *   STA $addr  ; where $addr is never read
 * 
 * After:
 *   (STA eliminated)
 */
export class DeadStorePattern extends BasePattern {
  readonly id = 'dead-store';
  readonly description = 'Remove stores to locations never read';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O3]; // Only at highest optimization
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    // Check: Is a store
    if (!this.isStore(inst)) {
      return null;
    }
    
    // Check: Marked as dead by liveness analysis
    if (!inst.metadata?.get('isDead')) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([
        ['address', inst.operands[1]],
      ]),
      confidence: 0.9, // Lower confidence - relies on analysis
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    // Remove the dead store entirely
    return {
      instructions: [],
      cyclesSaved: 4,
      bytesSaved: 3,
    };
  }
}

/**
 * Register all core load-store patterns
 */
export function registerLoadStoreCorePatterns(registry: PatternRegistry): void {
  registry.register(new StaLdaSamePattern());
  registry.register(new StaStaSamePattern());
  registry.register(new LdaStaLdaPattern());
  registry.register(new DeadStorePattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `StaLdaSame match` | Matches STA followed by LDA to same addr |
| `StaLdaSame no match diff addr` | No match when addresses differ |
| `StaLdaSame no match diff reg` | No match for STX/LDX etc |
| `StaLdaSame replace` | Correctly removes LDA |
| `StaLdaSame cycles saved` | Reports correct cycle savings |
| `StaStaSame match` | Matches consecutive STA to same addr |
| `StaStaSame no match diff addr` | No match when addresses differ |
| `StaStaSame replace` | Removes first STA, keeps second |
| `LdaStaLda match` | Matches LDA-STA-LDA pattern |
| `LdaStaLda no match diff addr` | No match when LDA addr != STA addr |
| `LdaStaLda replace` | Removes redundant third LDA |
| `DeadStore match` | Matches when isDead metadata set |
| `DeadStore no match` | No match without isDead metadata |
| `DeadStore replace` | Removes store entirely |
| `register all` | All patterns registered correctly |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerLoadStoreCorePatterns } from './patterns/load-store-core.js';

// Register all core load-store patterns
registerLoadStoreCorePatterns(patternRegistry);
```

### Pattern Usage

```typescript
// Patterns automatically used by PeepholeOptimizer
const optimizer = new PeepholeOptimizer(patternRegistry, {
  level: OptimizationLevel.O2,
});

const result = optimizer.optimize(module);
```

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `load-store-core.ts` | [ ] |
| Implement StaLdaSamePattern | [ ] |
| Implement StaStaSamePattern | [ ] |
| Implement LdaStaLdaPattern | [ ] |
| Implement DeadStorePattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.2 → `08-02-pattern-matcher.md`  
**Next Task**: 8.3b → `08-03b-load-store-zeropage.md`