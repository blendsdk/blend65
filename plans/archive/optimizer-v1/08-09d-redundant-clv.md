# 8.9d: CLV Overflow Flag Redundancy Patterns

> **Document**: `08-09d-redundant-clv.md`
> **Phase**: 08-peephole
> **Task**: 8.9d - CLV overflow flag patterns
> **Focus**: Clear Overflow flag redundancy detection and elimination

---

## Overview

The CLV (Clear oVerflow) instruction clears the V (overflow) flag. Unlike carry and zero flags, the overflow flag is less commonly used - primarily for signed arithmetic overflow detection. This makes CLV redundancy patterns both rarer and potentially more impactful when found.

**Important**: The 6502 has CLV but **no SEV instruction** (set overflow). This asymmetry affects pattern design.

---

## Pattern Categories

### Category 1: Consecutive CLV Instructions

Multiple CLV instructions in sequence are always redundant.

```
Pattern: CLV → CLV → ...
Result:  CLV (single)
Savings: 2 cycles, 1 byte per eliminated CLV
```

#### Implementation

```typescript
/**
 * Detects consecutive CLV instructions
 * 
 * @pattern CLV CLV+ → CLV
 * @safety Always safe - overflow flag only cleared once
 * @savings 2 cycles, 1 byte per removed CLV
 */
export const consecutiveCLVPattern: PeepholePattern = {
  name: 'consecutive-clv',
  description: 'Remove consecutive CLV instructions',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return first.opcode === Opcode.CLV && 
           second.opcode === Opcode.CLV;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    let removeCount = 0;
    let index = 1;
    
    while (index < window.size && 
           window.get(index).opcode === Opcode.CLV) {
      removeCount++;
      index++;
    }
    
    return {
      remove: createRangeArray(1, removeCount + 1),
      insert: [],
      cyclesSaved: removeCount * 2,
      bytesSaved: removeCount
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 2: CLV When Overflow Known Clear

If a previous operation is known to clear the overflow flag, subsequent CLV is redundant.

```
Pattern: (overflow-clearing-op) → CLV
Result:  (overflow-clearing-op)
Savings: 2 cycles, 1 byte
```

#### Overflow-Affecting Operations

| Instruction | Effect on V Flag |
|-------------|------------------|
| `CLV`       | Always clears |
| `ADC`       | Sets based on signed overflow |
| `SBC`       | Sets based on signed overflow |
| `BIT`       | Copies bit 6 of memory to V |
| `PLP`       | Restores from stack |

**Note**: Unlike most flags, the overflow flag is only affected by a few instructions. Most instructions (LDA, STA, AND, ORA, etc.) do NOT affect the V flag.

```typescript
/**
 * Instructions that affect the overflow flag
 */
const AFFECTS_OVERFLOW = new Set([
  Opcode.CLV,  // Clears V
  Opcode.ADC,  // Sets V based on signed overflow
  Opcode.SBC,  // Sets V based on signed overflow
  Opcode.BIT,  // Copies bit 6 to V
  Opcode.PLP,  // Restores V from stack
  Opcode.RTI   // Restores V from stack
]);

/**
 * Instructions that unconditionally clear overflow
 */
const ALWAYS_CLEARS_OVERFLOW = new Set([Opcode.CLV]);
```

#### Implementation

```typescript
/**
 * Detects CLV after operation that already cleared overflow
 * 
 * @pattern (clears-V) CLV → (clears-V)
 * @safety Requires overflow state tracking
 * @savings 2 cycles, 1 byte
 */
export const clvAfterOverflowClearPattern: PeepholePattern = {
  name: 'clv-after-overflow-clear',
  description: 'Remove CLV when overflow already known to be clear',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.CLV) return false;
    
    // Check if overflow is already known to be clear
    return state.overflow === FlagState.CLEAR;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  requiresState: true,
  priority: PatternPriority.MEDIUM,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 3: CLV Before Overflow-Setting Operations

CLV followed by an operation that sets overflow is redundant - the new value overwrites.

```
Pattern: CLV → ADC → ...
Result:  ADC → ...  (if V from ADC is what matters)
```

```
Pattern: CLV → BIT $addr → ...
Result:  BIT $addr → ...  (if V from BIT is what matters)
```

**CAUTION**: This is only valid if the cleared overflow state isn't tested between CLV and the overflow-setting operation.

#### Implementation

```typescript
/**
 * Detects CLV immediately before overflow-setting instruction
 * 
 * @pattern CLV (ADC|SBC|BIT) → (ADC|SBC|BIT)
 * @safety Safe if no BVC/BVS between
 * @savings 2 cycles, 1 byte
 */
export const clvBeforeOverflowSetPattern: PeepholePattern = {
  name: 'clv-before-overflow-set',
  description: 'Remove CLV when next instruction sets overflow',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const clv = window.get(0);
    const next = window.get(1);
    
    if (clv.opcode !== Opcode.CLV) return false;
    
    // Check if next instruction sets overflow
    return next.opcode === Opcode.ADC ||
           next.opcode === Opcode.SBC ||
           next.opcode === Opcode.BIT;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

#### Extended: CLV with Gap Before Overflow-Set

```typescript
/**
 * Detects CLV followed by overflow-setting with non-overflow code between
 * 
 * @pattern CLV (non-V-ops)* (ADC|SBC|BIT) → (non-V-ops)* (ADC|SBC|BIT)
 * @safety Safe if no BVC/BVS between
 * @savings 2 cycles, 1 byte
 */
export const clvGapOverflowSetPattern: PeepholePattern = {
  name: 'clv-gap-overflow-set',
  description: 'Remove CLV before overflow-set when V not tested between',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    if (first.opcode !== Opcode.CLV) return false;
    
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      
      // Found an overflow-setting instruction
      if (instr.opcode === Opcode.ADC ||
          instr.opcode === Opcode.SBC ||
          instr.opcode === Opcode.BIT) {
        return true;
      }
      
      // Overflow flag is tested - CLV matters
      if (instr.opcode === Opcode.BVC ||
          instr.opcode === Opcode.BVS) {
        return false;
      }
      
      // PLP restores overflow - pattern doesn't apply
      if (instr.opcode === Opcode.PLP) {
        return false;
      }
    }
    
    return false;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  priority: PatternPriority.MEDIUM,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 4: Dead CLV (Overflow Never Tested)

CLV followed by code that never tests the overflow flag is redundant.

```
Pattern: CLV → (no BVC/BVS) → (function return)
Result:  (no BVC/BVS) → (function return)
Savings: 2 cycles, 1 byte
```

#### Implementation

```typescript
/**
 * Instructions that read the overflow flag
 */
const READS_OVERFLOW = new Set([
  Opcode.BVC,  // Branch if overflow clear
  Opcode.BVS,  // Branch if overflow set
  Opcode.PHP   // Push status (includes V)
]);

/**
 * Detects CLV that is never used before being overwritten or ignored
 * 
 * @pattern CLV (non-V-readers)* (overwrites-V | end-of-block)
 * @safety Requires control flow analysis
 * @savings 2 cycles, 1 byte
 */
export const deadCLVPattern: PeepholePattern = {
  name: 'dead-clv',
  description: 'Remove CLV when overflow value is never used',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.CLV) return false;
    
    // Check if overflow is used before being overwritten
    return !cfg.isOverflowLiveAfter(instr);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.DEAD_CODE
};
```

---

### Category 5: CLV in Non-Signed Arithmetic Context

CLV is often inserted before ADC/SBC even when signed overflow isn't being checked. If the code never uses BVC/BVS, the CLV serves no purpose.

```
Pattern: CLV → ADC → ... (no BVC/BVS ever)
Result:  ADC → ...
```

#### Implementation

```typescript
/**
 * Detects CLV in unsigned arithmetic context (V never tested)
 * 
 * @pattern CLV ADC/SBC ... (no BVC/BVS in function)
 * @safety Requires function-level analysis
 * @savings 2 cycles, 1 byte
 */
export const clvUnsignedContextPattern: PeepholePattern = {
  name: 'clv-unsigned-context',
  description: 'Remove CLV when function never tests overflow',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.CLV) return false;
    
    // Check if function ever uses BVC/BVS
    const func = cfg.getContainingFunction(instr);
    return !func.usesOverflowBranch();
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.DEAD_CODE
};
```

---

### Category 6: BIT for CLV Side Effect

A clever 6502 trick uses BIT to set/clear flags via its side effects. If BIT is used only for its CLV-like effect, but the CLV already precedes it, the pattern can be simplified.

```
; BIT sets V to bit 6 of memory
; If memory has bit 6 clear, BIT acts like CLV
CLV
BIT $someAddr  ; If only V matters and bit 6 is 0

; Could become:
BIT $someAddr  ; Already clears V if bit 6 = 0
```

```typescript
/**
 * Detects CLV before BIT when BIT also clears V
 * 
 * @pattern CLV BIT $addr (where addr bit 6 = 0) → BIT $addr
 * @safety Requires constant value analysis
 * @savings 2 cycles, 1 byte
 */
export const clvBeforeBitClearPattern: PeepholePattern = {
  name: 'clv-before-bit-clear',
  description: 'Remove CLV when BIT will also clear V',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 2) return false;
    
    const clv = window.get(0);
    const bit = window.get(1);
    
    if (clv.opcode !== Opcode.CLV || bit.opcode !== Opcode.BIT) {
      return false;
    }
    
    // Check if BIT operand has bit 6 clear
    const bitOperandValue = state.getMemoryValue(bit.effectiveAddress);
    if (bitOperandValue === undefined) return false;
    
    return (bitOperandValue & 0x40) === 0;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  requiresState: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.REDUNDANCY
};
```

---

## Overflow State Tracking

### State Tracking

```typescript
/**
 * Tracks known overflow flag state
 */
export interface OverflowState {
  /** Overflow flag value */
  overflow: FlagState;
  
  /** Last instruction that affected overflow */
  lastOverflowSource: Instruction | null;
}

/**
 * Initial overflow state
 */
export const INITIAL_OVERFLOW_STATE: OverflowState = {
  overflow: FlagState.UNKNOWN,
  lastOverflowSource: null
};
```

### State Update Functions

```typescript
/**
 * Updates overflow state after CLV instruction
 */
function updateStateAfterCLV(state: OverflowState, instr: Instruction): OverflowState {
  return {
    overflow: FlagState.CLEAR,
    lastOverflowSource: instr
  };
}

/**
 * Updates overflow state after ADC/SBC instruction
 * (Overflow becomes unknown - depends on operands)
 */
function updateStateAfterArithmetic(state: OverflowState, instr: Instruction): OverflowState {
  return {
    overflow: FlagState.UNKNOWN,
    lastOverflowSource: instr
  };
}

/**
 * Updates overflow state after BIT instruction
 * (Overflow = bit 6 of memory operand)
 */
function updateStateAfterBIT(
  state: OverflowState, 
  instr: Instruction,
  memoryValue: number | undefined
): OverflowState {
  if (memoryValue !== undefined) {
    return {
      overflow: (memoryValue & 0x40) ? FlagState.SET : FlagState.CLEAR,
      lastOverflowSource: instr
    };
  }
  return {
    overflow: FlagState.UNKNOWN,
    lastOverflowSource: instr
  };
}

/**
 * Updates overflow state based on instruction
 */
export function updateOverflowState(
  state: OverflowState,
  instruction: Instruction,
  memoryState?: MemoryState
): OverflowState {
  switch (instruction.opcode) {
    case Opcode.CLV:
      return updateStateAfterCLV(state, instruction);
    case Opcode.ADC:
    case Opcode.SBC:
      return updateStateAfterArithmetic(state, instruction);
    case Opcode.BIT:
      const memValue = memoryState?.getValueAt(instruction.effectiveAddress);
      return updateStateAfterBIT(state, instruction, memValue);
    case Opcode.PLP:
    case Opcode.RTI:
      return { overflow: FlagState.UNKNOWN, lastOverflowSource: instruction };
    default:
      // Most instructions don't affect overflow
      return state;
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('CLV Redundancy Elimination', () => {
  describe('Consecutive CLV', () => {
    it('should remove second CLV in CLV CLV sequence', () => {
      const input = [
        { opcode: Opcode.CLV },
        { opcode: Opcode.CLV }
      ];
      
      const result = applyPattern(consecutiveCLVPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.CLV }
      ]);
      expect(result.cyclesSaved).toBe(2);
      expect(result.bytesSaved).toBe(1);
    });
  });
  
  describe('CLV after overflow clear', () => {
    it('should remove CLV when overflow already clear', () => {
      const state: CPUState = {
        overflow: FlagState.CLEAR
      };
      
      const input = [
        { opcode: Opcode.CLV }
      ];
      
      const result = applyPattern(clvAfterOverflowClearPattern, input, state);
      
      expect(result.instructions).toEqual([]);
      expect(result.cyclesSaved).toBe(2);
    });
    
    it('should NOT remove CLV when overflow state unknown', () => {
      const state: CPUState = {
        overflow: FlagState.UNKNOWN
      };
      
      const input = [
        { opcode: Opcode.CLV }
      ];
      
      const result = applyPattern(clvAfterOverflowClearPattern, input, state);
      
      expect(result.matched).toBe(false);
    });
  });
  
  describe('CLV before overflow-setting', () => {
    it('should remove CLV immediately before ADC', () => {
      const input = [
        { opcode: Opcode.CLV },
        { opcode: Opcode.ADC, operand: 0x10 }
      ];
      
      const result = applyPattern(clvBeforeOverflowSetPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.ADC, operand: 0x10 }
      ]);
    });
    
    it('should remove CLV immediately before SBC', () => {
      const input = [
        { opcode: Opcode.CLV },
        { opcode: Opcode.SBC, operand: 0x10 }
      ];
      
      const result = applyPattern(clvBeforeOverflowSetPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.SBC, operand: 0x10 }
      ]);
    });
    
    it('should remove CLV immediately before BIT', () => {
      const input = [
        { opcode: Opcode.CLV },
        { opcode: Opcode.BIT, operand: 0x2000 }
      ];
      
      const result = applyPattern(clvBeforeOverflowSetPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.BIT, operand: 0x2000 }
      ]);
    });
  });
  
  describe('CLV with gap before overflow-set', () => {
    it('should remove CLV with non-V instructions before ADC', () => {
      const input = [
        { opcode: Opcode.CLV },
        { opcode: Opcode.LDA, operand: 0x00 },
        { opcode: Opcode.ADC, operand: 0x10 }
      ];
      
      const result = applyPattern(clvGapOverflowSetPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.LDA, operand: 0x00 },
        { opcode: Opcode.ADC, operand: 0x10 }
      ]);
    });
    
    it('should NOT remove CLV when BVS appears before ADC', () => {
      const input = [
        { opcode: Opcode.CLV },
        { opcode: Opcode.BVS, operand: 0x10 },
        { opcode: Opcode.ADC, operand: 0x10 }
      ];
      
      const result = applyPattern(clvGapOverflowSetPattern, input);
      
      expect(result.matched).toBe(false);
    });
  });
});
```

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| Consecutive CLV | Very Rare | 2/instance | 1/instance |
| CLV (V known) | Rare | 2 | 1 |
| CLV before ADC/SBC | Moderate | 2 | 1 |
| Dead CLV | Moderate | 2 | 1 |
| CLV unsigned ctx | Moderate | 2 | 1 |

---

## Integration Notes

### Pattern Ordering

CLV redundancy patterns should run:
1. **After** value propagation (for known overflow states)
2. **After** function-level analysis (for context patterns)
3. **Before** dead code elimination (may create more opportunities)
4. **Before** final instruction scheduling

### Dependencies

- Requires: `FlagStateTracker`
- Requires: `MemoryStateTracker` (for BIT patterns)
- Optional: `CFGAnalysis` (for dead CLV pattern)
- Related: `08-07b-flag-status.md` (general flag patterns)

---

## Summary

This document covers six categories of CLV redundancy:

1. **Consecutive CLV** - Multiple CLVs in sequence
2. **CLV (V known)** - Overflow already clear
3. **CLV before set** - Next instruction sets overflow
4. **Dead CLV** - Overflow never tested
5. **Unsigned context** - Function never uses BVC/BVS
6. **CLV before BIT** - BIT also clears V

Total potential savings: 2-6+ cycles per occurrence.

**Note**: CLV patterns are less common than carry flag patterns because:
- Overflow is rarely tested in typical 6502 code
- Most code uses unsigned arithmetic
- BVC/BVS are uncommon branch instructions