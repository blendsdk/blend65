# 8.9j: Context-Aware Redundancy Patterns

> **Document**: `08-09j-redundant-context.md`
> **Phase**: 08-peephole
> **Task**: 8.9j - Context-aware redundancy
> **Focus**: Advanced redundancy detection using control flow and data flow context

---

## Overview

Context-aware redundancy patterns require understanding the broader program context beyond a simple instruction window. These patterns leverage control flow analysis, data flow analysis, and value range tracking to find redundancies that local peephole patterns cannot detect.

---

## Pattern Categories

### Category 1: Post-Branch Redundancy

After a conditional branch, certain values are known based on the branch condition.

```
; After BEQ taken, we know Z=1 (value was zero)
BEQ zeroPath
; Here: value was NOT zero
...
zeroPath:
; Here: value WAS zero - LDA #0 redundant if A still has value
LDA #0  ; Redundant - A is already 0 (that's why we branched)
```

#### Implementation

```typescript
/**
 * Detects redundant LDA #0 at branch target when value known zero
 */
export const postBranchZeroPattern: PeepholePattern = {
  name: 'post-branch-zero',
  description: 'Remove LDA #0 when value known zero from branch',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const lda = window.get(0);
    if (lda.opcode !== Opcode.LDA) return false;
    if (lda.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (lda.operand !== 0) return false;
    
    // Check if this is a BEQ target and A was tested
    const block = cfg.getBlockContaining(lda);
    const predecessors = cfg.getPredecessors(block);
    
    for (const pred of predecessors) {
      const lastInstr = pred.getLastInstruction();
      if (lastInstr.opcode === Opcode.BEQ && 
          pred.branchesTo(block) &&
          state.wasAccumulatorTested()) {
        return true;
      }
    }
    
    return false;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 2: Loop-Invariant Redundancy

Values loaded inside loops that don't change can be hoisted outside.

```
; Loop with redundant load
loop:
  LDA constantValue  ; Same value every iteration
  ...
  BNE loop

; Better:
LDA constantValue    ; Load once before loop
loop:
  ...
  BNE loop
```

#### Implementation

```typescript
/**
 * Detects loop-invariant loads
 */
export const loopInvariantLoadPattern: PeepholePattern = {
  name: 'loop-invariant-load',
  description: 'Identify loads that can be hoisted from loops',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const load = window.get(0);
    if (load.opcode !== Opcode.LDA &&
        load.opcode !== Opcode.LDX &&
        load.opcode !== Opcode.LDY) {
      return false;
    }
    
    // Check if in a loop
    const loop = cfg.getContainingLoop(load);
    if (!loop) return false;
    
    // Check if address is loop-invariant (not modified in loop)
    const address = load.effectiveAddress ?? load.operand;
    return !loop.modifiesAddress(address as number);
  },
  
  // This pattern suggests hoisting rather than removal
  apply(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): PeepholeResult {
    const load = window.get(0);
    const loop = cfg.getContainingLoop(load)!;
    
    return {
      remove: [0],
      insert: [],
      hoistTo: loop.getPreheader(),
      cyclesSaved: getCycleCount(load) * (loop.estimatedIterations - 1),
      bytesSaved: 0 // Code moves, not removed
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.LOOP_OPTIMIZATION
};
```

---

### Category 3: Dominator-Based Redundancy

If a value is loaded in all paths leading to a point, reloading is redundant.

```
; All paths load same value
  BCS pathA
pathB:
  LDA #5
  JMP merge
pathA:
  LDA #5
merge:
  LDA #5  ; Redundant - already loaded on all paths
```

#### Implementation

```typescript
/**
 * Detects redundant load when all dominators already load same value
 */
export const dominatorLoadPattern: PeepholePattern = {
  name: 'dominator-load',
  description: 'Remove load when all paths already loaded same value',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const load = window.get(0);
    if (load.opcode !== Opcode.LDA) return false;
    if (load.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    const value = load.operand;
    const block = cfg.getBlockContaining(load);
    
    // Check if all predecessors guarantee A has this value
    return cfg.allPathsGuarantee(block, (state) => {
      return state.accumulator.knownValue === value;
    });
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 4: Dead Code After Unconditional Branch

Code immediately after JMP (before any label) is unreachable.

```
  JMP somewhere
  LDA #5        ; Dead - unreachable
  STA $1000     ; Dead - unreachable
somewhere:
```

#### Implementation

```typescript
/**
 * Detects unreachable code after unconditional jump
 */
export const deadCodeAfterJumpPattern: PeepholePattern = {
  name: 'dead-code-after-jump',
  description: 'Remove unreachable code after JMP',
  
  match(window: InstructionWindow, cfg: CFGAnalysis): boolean {
    if (window.size < 2) return false;
    
    const jump = window.get(0);
    if (jump.opcode !== Opcode.JMP) return false;
    
    const next = window.get(1);
    
    // Check if next instruction is a branch target
    return !cfg.isLabelTarget(next);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    // Find all unreachable instructions until next label
    const toRemove: number[] = [];
    let totalCycles = 0;
    let totalBytes = 0;
    
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      if (cfg.isLabelTarget(instr)) break;
      
      toRemove.push(i);
      totalCycles += getCycleCount(instr);
      totalBytes += getByteCount(instr);
    }
    
    return {
      remove: toRemove,
      insert: [],
      cyclesSaved: totalCycles,
      bytesSaved: totalBytes
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.HIGH,
  category: PatternCategory.DEAD_CODE
};
```

---

### Category 5: Value Range Redundancy

When value range is known, some operations become redundant.

```
; If we know A is in range 0-15
AND #$0F      ; Redundant if A already 0-15
```

#### Implementation

```typescript
/**
 * Detects redundant AND when value already in mask range
 */
export const valueRangeMaskPattern: PeepholePattern = {
  name: 'value-range-mask',
  description: 'Remove AND when value already within mask',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const and = window.get(0);
    if (and.opcode !== Opcode.AND) return false;
    if (and.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    const mask = and.operand as number;
    const maxValue = state.accumulator.maxValue;
    
    if (maxValue === undefined) return false;
    
    // If max value fits within mask, AND is redundant
    return maxValue <= mask;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  requiresState: true,
  priority: PatternPriority.MEDIUM,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 6: Calling Convention Redundancy

After JSR to known function, register states may be known.

```
JSR clearAccumulator  ; Known to set A=0
LDA #0                ; Redundant - JSR already set A=0
```

#### Implementation

```typescript
/**
 * Function signatures for known functions
 */
const KNOWN_FUNCTION_EFFECTS = new Map<string, RegisterEffects>([
  ['clearAccumulator', { a: 0 }],
  ['setXtoZero', { x: 0 }],
  // ... more known functions
]);

/**
 * Detects redundant operations after JSR with known effects
 */
export const postCallRedundancyPattern: PeepholePattern = {
  name: 'post-call-redundancy',
  description: 'Remove redundant ops after JSR with known effects',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 2) return false;
    
    const jsr = window.get(0);
    const next = window.get(1);
    
    if (jsr.opcode !== Opcode.JSR) return false;
    
    const funcName = cfg.getFunctionName(jsr.operand as number);
    const effects = KNOWN_FUNCTION_EFFECTS.get(funcName);
    
    if (!effects) return false;
    
    // Check if next instruction is redundant given effects
    if (next.opcode === Opcode.LDA &&
        next.addressingMode === AddressingMode.IMMEDIATE &&
        effects.a === next.operand) {
      return true;
    }
    
    return false;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [1],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.REDUNDANCY
};
```

---

## Testing Requirements

```typescript
describe('Context-Aware Redundancy', () => {
  describe('Post-branch patterns', () => {
    it('should remove LDA #0 at BEQ target when A was tested', () => {
      // Test implementation
    });
  });
  
  describe('Dead code after jump', () => {
    it('should remove unreachable code after JMP', () => {
      // Test implementation
    });
  });
  
  describe('Value range patterns', () => {
    it('should remove AND when value in range', () => {
      // Test implementation
    });
  });
});
```

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| Post-branch | Rare | 2+ | 2+ |
| Loop-invariant | Moderate | n×cycles | 0 |
| Dominator | Rare | 2 | 2 |
| Dead after JMP | Rare | varies | varies |
| Value range | Rare | 2 | 2 |
| Post-call | Rare | 2 | 2 |

---

## Summary

This document covers six context-aware redundancy patterns:

1. **Post-branch** - Values known from branch condition
2. **Loop-invariant** - Loads that can be hoisted
3. **Dominator-based** - All paths guarantee value
4. **Dead after JMP** - Unreachable code removal
5. **Value range** - Operations redundant for known ranges
6. **Post-call** - Known function effects

These patterns require CFG analysis and are more expensive but find redundancies that simpler patterns miss.