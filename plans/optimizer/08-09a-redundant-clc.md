# 8.9a: CLC Redundancy Elimination Patterns

> **Document**: `08-09a-redundant-clc.md`
> **Phase**: 08-peephole
> **Task**: 8.9a - CLC consecutive/opposite patterns
> **Focus**: Clear Carry flag redundancy detection and elimination

---

## Overview

The CLC (Clear Carry) instruction is one of the most commonly used flag manipulation instructions on the 6502. It's required before ADC operations when you want pure addition. However, consecutive CLCs or CLC followed by operations that set carry create redundancy opportunities.

---

## Pattern Categories

### Category 1: Consecutive CLC Instructions

Multiple CLC instructions in sequence are always redundant.

```
Pattern: CLC → CLC → ...
Result:  CLC (single)
Savings: 2 cycles, 1 byte per eliminated CLC
```

#### Implementation

```typescript
/**
 * Detects consecutive CLC instructions
 * 
 * @pattern CLC CLC+ → CLC
 * @safety Always safe - carry flag only cleared once
 * @savings 2 cycles, 1 byte per removed CLC
 */
export const consecutiveCLCPattern: PeepholePattern = {
  name: 'consecutive-clc',
  description: 'Remove consecutive CLC instructions',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return first.opcode === Opcode.CLC && 
           second.opcode === Opcode.CLC;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    // Keep first CLC, remove subsequent consecutive CLCs
    let removeCount = 0;
    let index = 1;
    
    while (index < window.size && 
           window.get(index).opcode === Opcode.CLC) {
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

### Category 2: CLC Before SEC (Opposite Operations)

CLC followed by SEC is completely redundant - only SEC takes effect.

```
Pattern: CLC → SEC
Result:  SEC
Savings: 2 cycles, 1 byte
```

```
Pattern: CLC → ... (no carry use) → SEC
Result:  SEC (CLC removed if carry not read between)
```

#### Implementation

```typescript
/**
 * Detects CLC immediately followed by SEC
 * 
 * @pattern CLC SEC → SEC
 * @safety Always safe - SEC overwrites CLC effect
 * @savings 2 cycles, 1 byte
 */
export const clcFollowedBySecPattern: PeepholePattern = {
  name: 'clc-followed-by-sec',
  description: 'Remove CLC when immediately followed by SEC',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return first.opcode === Opcode.CLC && 
           second.opcode === Opcode.SEC;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0], // Remove the CLC
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

#### Extended: CLC...SEC with Non-Carry Instructions

```typescript
/**
 * Detects CLC followed by SEC with intervening non-carry instructions
 * 
 * @pattern CLC (non-carry-ops)* SEC → (non-carry-ops)* SEC
 * @safety Safe if no instruction between reads carry
 * @savings 2 cycles, 1 byte
 */
export const clcGapSecPattern: PeepholePattern = {
  name: 'clc-gap-sec',
  description: 'Remove CLC before SEC when carry not used between',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    if (first.opcode !== Opcode.CLC) return false;
    
    // Look for SEC within window, checking no carry use
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      
      if (instr.opcode === Opcode.SEC) {
        return true; // Found SEC, CLC is redundant
      }
      
      if (readsCarryFlag(instr) || writesCarryFlag(instr)) {
        return false; // Carry used before SEC found
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

### Category 3: CLC When Carry Known Clear

If a previous operation is known to clear carry, subsequent CLC is redundant.

```
Pattern: (carry-clearing-op) → CLC
Result:  (carry-clearing-op)
Savings: 2 cycles, 1 byte
```

#### Carry-Clearing Operations

Operations that always clear the carry flag:

| Instruction | Condition |
|-------------|-----------|
| `CLC`       | Always    |
| `ASL`       | When bit 7 was 0 (if known) |
| `LSR`       | When bit 0 was 0 (if known) |
| `ROL`       | Depends on input |
| `ROR`       | Depends on input |
| `CMP #0`    | When A >= 0 (always true unsigned) |

```typescript
/**
 * Instructions that unconditionally clear carry
 */
const ALWAYS_CLEARS_CARRY = new Set([Opcode.CLC]);

/**
 * Instructions that clear carry under certain conditions
 * Requires value tracking to determine
 */
const CONDITIONALLY_CLEARS_CARRY = new Map<Opcode, (state: ValueState) => boolean>([
  [Opcode.CMP, (state) => {
    // CMP #n clears carry if A < n
    // CMP #0 with unsigned A always sets carry (A >= 0)
    return false; // Conservative - needs value analysis
  }],
  [Opcode.ASL, (state) => {
    // ASL clears carry if bit 7 of operand was 0
    return state.knownValue !== undefined && (state.knownValue & 0x80) === 0;
  }],
  [Opcode.LSR, (state) => {
    // LSR clears carry if bit 0 of operand was 0
    return state.knownValue !== undefined && (state.knownValue & 0x01) === 0;
  }]
]);
```

#### Implementation

```typescript
/**
 * Detects CLC after operation that already cleared carry
 * 
 * @pattern (clears-carry) CLC → (clears-carry)
 * @safety Requires carry state tracking
 * @savings 2 cycles, 1 byte
 */
export const clcAfterCarryClearPattern: PeepholePattern = {
  name: 'clc-after-carry-clear',
  description: 'Remove CLC when carry already known to be clear',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.CLC) return false;
    
    // Check if carry is already known to be clear
    return state.carry === FlagState.CLEAR;
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

### Category 4: CLC Before Non-Carry Operations

CLC followed only by operations that don't use carry is redundant until a carry-using operation appears.

```
Pattern: CLC → (no-carry-ops) → (branch/return/etc)
Result:  (no-carry-ops) → (branch/return/etc)
Savings: 2 cycles, 1 byte
```

#### Non-Carry Operations

| Category | Instructions |
|----------|-------------|
| Loads    | LDA, LDX, LDY |
| Stores   | STA, STX, STY |
| Transfers| TAX, TXA, TAY, TYA, TSX, TXS |
| Logic    | AND, ORA, EOR |
| Compare  | CMP, CPX, CPY (read only) |
| Inc/Dec  | INC, DEC, INX, DEX, INY, DEY |
| Branches | BEQ, BNE, BMI, BPL, BVS, BVC |
| Stack    | PHA, PHP, PLA, PLP |

```typescript
/**
 * Instructions that don't use carry flag
 */
const NON_CARRY_INSTRUCTIONS = new Set([
  // Loads
  Opcode.LDA, Opcode.LDX, Opcode.LDY,
  // Stores
  Opcode.STA, Opcode.STX, Opcode.STY,
  // Transfers
  Opcode.TAX, Opcode.TXA, Opcode.TAY, Opcode.TYA,
  Opcode.TSX, Opcode.TXS,
  // Logic (don't affect carry)
  Opcode.AND, Opcode.ORA, Opcode.EOR,
  // Inc/Dec (don't affect carry)
  Opcode.INC, Opcode.DEC, 
  Opcode.INX, Opcode.DEX,
  Opcode.INY, Opcode.DEY,
  // Bit test
  Opcode.BIT,
  // Non-carry branches
  Opcode.BEQ, Opcode.BNE,
  Opcode.BMI, Opcode.BPL,
  Opcode.BVS, Opcode.BVC,
  // Stack (PLP affects carry but as restore)
  Opcode.PHA
]);

/**
 * Instructions that read carry flag
 */
const CARRY_READERS = new Set([
  Opcode.ADC,  // Add with carry
  Opcode.SBC,  // Subtract with borrow
  Opcode.ROL,  // Rotate left through carry
  Opcode.ROR,  // Rotate right through carry
  Opcode.BCC,  // Branch if carry clear
  Opcode.BCS   // Branch if carry set
]);
```

#### Implementation

```typescript
/**
 * Detects CLC that is never used before being overwritten
 * 
 * @pattern CLC (non-carry-ops)* (overwrites-carry | end-of-block)
 * @safety Requires control flow analysis
 * @savings 2 cycles, 1 byte
 */
export const deadCLCPattern: PeepholePattern = {
  name: 'dead-clc',
  description: 'Remove CLC when carry value is never used',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.CLC) return false;
    
    // Check if carry is used before being overwritten
    return !cfg.isCarryLiveAfter(instr);
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
  priority: PatternPriority.LOW, // Expensive analysis
  category: PatternCategory.DEAD_CODE
};
```

---

### Category 5: Double CLC in Loops

In unrolled loops, CLCs may appear repeatedly when only one is needed at the start.

```
Before:
  CLC
  ADC #1
  CLC       ; Redundant if no carry out
  ADC #1
  CLC       ; Redundant if no carry out
  ADC #1

After (if no overflow):
  CLC
  ADC #1
  ADC #1
  ADC #1
```

#### Implementation

```typescript
/**
 * Detects redundant CLC in ADC sequences when no overflow possible
 * 
 * @pattern CLC ADC #n CLC ADC #m ... → CLC ADC #n ADC #m ...
 * @safety Requires value analysis to ensure no carry overflow
 * @savings 2 cycles, 1 byte per removed CLC
 */
export const loopCLCPattern: PeepholePattern = {
  name: 'loop-clc-elimination',
  description: 'Remove redundant CLCs in addition sequences',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    // Need at least: CLC ADC CLC ADC
    if (window.size < 4) return false;
    
    // First must be CLC
    if (window.get(0).opcode !== Opcode.CLC) return false;
    
    // Look for pattern: CLC ADC CLC ADC
    const first = window.get(0);
    const adc1 = window.get(1);
    const clc2 = window.get(2);
    const adc2 = window.get(3);
    
    if (adc1.opcode !== Opcode.ADC ||
        clc2.opcode !== Opcode.CLC ||
        adc2.opcode !== Opcode.ADC) {
      return false;
    }
    
    // Check if ADC can overflow (requires value tracking)
    // Conservative: only immediate values that can't overflow
    if (adc1.addressingMode !== AddressingMode.IMMEDIATE) {
      return false;
    }
    
    const value1 = adc1.operand as number;
    const maxA = state.accumulator.maxValue ?? 255;
    
    // If max A + value1 < 256, no carry overflow
    return maxA + value1 < 256;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    // Find all redundant CLCs in the sequence
    const toRemove: number[] = [];
    
    for (let i = 2; i < window.size; i++) {
      if (window.get(i).opcode === Opcode.CLC) {
        // Check next instruction is ADC and previous was ADC
        if (i + 1 < window.size &&
            window.get(i + 1).opcode === Opcode.ADC &&
            window.get(i - 1).opcode === Opcode.ADC) {
          toRemove.push(i);
        }
      }
    }
    
    return {
      remove: toRemove,
      insert: [],
      cyclesSaved: toRemove.length * 2,
      bytesSaved: toRemove.length
    };
  },
  
  requiresState: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.REDUNDANCY
};
```

---

## Carry State Tracking

### FlagState Enumeration

```typescript
/**
 * Represents the known state of a CPU flag
 */
export enum FlagState {
  /** Flag value is unknown */
  UNKNOWN = 'unknown',
  /** Flag is definitely set (1) */
  SET = 'set',
  /** Flag is definitely clear (0) */
  CLEAR = 'clear'
}

/**
 * Tracks CPU flag states for optimization
 */
export interface CPUFlagState {
  carry: FlagState;
  zero: FlagState;
  negative: FlagState;
  overflow: FlagState;
  interrupt: FlagState;
  decimal: FlagState;
}

/**
 * Initial flag state (all unknown)
 */
export const INITIAL_FLAG_STATE: CPUFlagState = {
  carry: FlagState.UNKNOWN,
  zero: FlagState.UNKNOWN,
  negative: FlagState.UNKNOWN,
  overflow: FlagState.UNKNOWN,
  interrupt: FlagState.UNKNOWN,
  decimal: FlagState.UNKNOWN
};
```

### State Update Functions

```typescript
/**
 * Updates flag state after CLC instruction
 */
function updateStateAfterCLC(state: CPUFlagState): CPUFlagState {
  return {
    ...state,
    carry: FlagState.CLEAR
  };
}

/**
 * Updates flag state after SEC instruction
 */
function updateStateAfterSEC(state: CPUFlagState): CPUFlagState {
  return {
    ...state,
    carry: FlagState.SET
  };
}

/**
 * Updates flag state based on instruction
 */
export function updateFlagState(
  state: CPUFlagState,
  instruction: Instruction
): CPUFlagState {
  switch (instruction.opcode) {
    case Opcode.CLC:
      return updateStateAfterCLC(state);
    case Opcode.SEC:
      return updateStateAfterSEC(state);
    case Opcode.ADC:
    case Opcode.SBC:
    case Opcode.ASL:
    case Opcode.LSR:
    case Opcode.ROL:
    case Opcode.ROR:
      // These affect carry but result depends on operand
      return { ...state, carry: FlagState.UNKNOWN };
    case Opcode.CMP:
    case Opcode.CPX:
    case Opcode.CPY:
      // Compare sets carry based on comparison result
      return { ...state, carry: FlagState.UNKNOWN };
    case Opcode.PLP:
      // Restore all flags from stack (unknown)
      return INITIAL_FLAG_STATE;
    default:
      return state;
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('CLC Redundancy Elimination', () => {
  describe('Consecutive CLC', () => {
    it('should remove second CLC in CLC CLC sequence', () => {
      const input = [
        { opcode: Opcode.CLC },
        { opcode: Opcode.CLC }
      ];
      
      const result = applyPattern(consecutiveCLCPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.CLC }
      ]);
      expect(result.cyclesSaved).toBe(2);
      expect(result.bytesSaved).toBe(1);
    });
    
    it('should remove all but first CLC in multiple CLC sequence', () => {
      const input = [
        { opcode: Opcode.CLC },
        { opcode: Opcode.CLC },
        { opcode: Opcode.CLC },
        { opcode: Opcode.CLC }
      ];
      
      const result = applyPattern(consecutiveCLCPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.CLC }
      ]);
      expect(result.cyclesSaved).toBe(6);
      expect(result.bytesSaved).toBe(3);
    });
  });
  
  describe('CLC followed by SEC', () => {
    it('should remove CLC when immediately followed by SEC', () => {
      const input = [
        { opcode: Opcode.CLC },
        { opcode: Opcode.SEC }
      ];
      
      const result = applyPattern(clcFollowedBySecPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.SEC }
      ]);
    });
    
    it('should remove CLC with non-carry instructions before SEC', () => {
      const input = [
        { opcode: Opcode.CLC },
        { opcode: Opcode.LDA, operand: 0x00 },
        { opcode: Opcode.STA, operand: 0x1000 },
        { opcode: Opcode.SEC }
      ];
      
      const result = applyPattern(clcGapSecPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.LDA, operand: 0x00 },
        { opcode: Opcode.STA, operand: 0x1000 },
        { opcode: Opcode.SEC }
      ]);
    });
    
    it('should NOT remove CLC when ADC appears before SEC', () => {
      const input = [
        { opcode: Opcode.CLC },
        { opcode: Opcode.ADC, operand: 0x01 },
        { opcode: Opcode.SEC }
      ];
      
      const result = applyPattern(clcGapSecPattern, input);
      
      expect(result.matched).toBe(false);
    });
  });
  
  describe('CLC after carry clear', () => {
    it('should remove CLC when carry already clear', () => {
      const state: CPUFlagState = {
        ...INITIAL_FLAG_STATE,
        carry: FlagState.CLEAR
      };
      
      const input = [
        { opcode: Opcode.CLC }
      ];
      
      const result = applyPattern(clcAfterCarryClearPattern, input, state);
      
      expect(result.instructions).toEqual([]);
      expect(result.cyclesSaved).toBe(2);
    });
    
    it('should NOT remove CLC when carry state unknown', () => {
      const state = INITIAL_FLAG_STATE;
      
      const input = [
        { opcode: Opcode.CLC }
      ];
      
      const result = applyPattern(clcAfterCarryClearPattern, input, state);
      
      expect(result.matched).toBe(false);
    });
  });
});
```

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| Consecutive CLC | Common | 2/instance | 1/instance |
| CLC→SEC | Moderate | 2 | 1 |
| CLC (carry known) | Moderate | 2 | 1 |
| Dead CLC | Rare | 2 | 1 |
| Loop CLC | Rare | 2×n | n |

---

## Integration Notes

### Pattern Ordering

CLC redundancy patterns should run:
1. **After** value propagation (for known carry states)
2. **After** dead code elimination (for dead CLC detection)
3. **Before** final instruction scheduling

### Dependencies

- Requires: `FlagStateTracker`
- Requires: `ValuePropagation` (for loop pattern)
- Optional: `CFGAnalysis` (for dead CLC pattern)

---

## Summary

This document covers five categories of CLC redundancy:

1. **Consecutive CLC** - Multiple CLCs in sequence
2. **CLC→SEC** - Opposite flag operations
3. **CLC after clear** - Carry already known clear
4. **Dead CLC** - Carry never read before overwrite
5. **Loop CLC** - Redundant CLCs in addition sequences

Total potential savings: 2-12+ cycles per occurrence.