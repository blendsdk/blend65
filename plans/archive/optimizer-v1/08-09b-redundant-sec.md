# 8.9b: SEC Redundancy Elimination Patterns

> **Document**: `08-09b-redundant-sec.md`
> **Phase**: 08-peephole
> **Task**: 8.9b - SEC consecutive/opposite patterns
> **Focus**: Set Carry flag redundancy detection and elimination

---

## Overview

The SEC (Set Carry) instruction sets the carry flag to 1. It's required before SBC operations for proper subtraction on the 6502. This document covers redundancy patterns specific to SEC that mirror and complement the CLC patterns.

---

## Pattern Categories

### Category 1: Consecutive SEC Instructions

Multiple SEC instructions in sequence are always redundant.

```
Pattern: SEC → SEC → ...
Result:  SEC (single)
Savings: 2 cycles, 1 byte per eliminated SEC
```

#### Implementation

```typescript
/**
 * Detects consecutive SEC instructions
 * 
 * @pattern SEC SEC+ → SEC
 * @safety Always safe - carry flag only set once
 * @savings 2 cycles, 1 byte per removed SEC
 */
export const consecutiveSECPattern: PeepholePattern = {
  name: 'consecutive-sec',
  description: 'Remove consecutive SEC instructions',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return first.opcode === Opcode.SEC && 
           second.opcode === Opcode.SEC;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    // Keep first SEC, remove subsequent consecutive SECs
    let removeCount = 0;
    let index = 1;
    
    while (index < window.size && 
           window.get(index).opcode === Opcode.SEC) {
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

### Category 2: SEC Before CLC (Opposite Operations)

SEC followed by CLC is completely redundant - only CLC takes effect.

```
Pattern: SEC → CLC
Result:  CLC
Savings: 2 cycles, 1 byte
```

```
Pattern: SEC → ... (no carry use) → CLC
Result:  CLC (SEC removed if carry not read between)
```

#### Implementation

```typescript
/**
 * Detects SEC immediately followed by CLC
 * 
 * @pattern SEC CLC → CLC
 * @safety Always safe - CLC overwrites SEC effect
 * @savings 2 cycles, 1 byte
 */
export const secFollowedByClcPattern: PeepholePattern = {
  name: 'sec-followed-by-clc',
  description: 'Remove SEC when immediately followed by CLC',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return first.opcode === Opcode.SEC && 
           second.opcode === Opcode.CLC;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0], // Remove the SEC
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

#### Extended: SEC...CLC with Non-Carry Instructions

```typescript
/**
 * Detects SEC followed by CLC with intervening non-carry instructions
 * 
 * @pattern SEC (non-carry-ops)* CLC → (non-carry-ops)* CLC
 * @safety Safe if no instruction between reads carry
 * @savings 2 cycles, 1 byte
 */
export const secGapClcPattern: PeepholePattern = {
  name: 'sec-gap-clc',
  description: 'Remove SEC before CLC when carry not used between',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    if (first.opcode !== Opcode.SEC) return false;
    
    // Look for CLC within window, checking no carry use
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      
      if (instr.opcode === Opcode.CLC) {
        return true; // Found CLC, SEC is redundant
      }
      
      if (readsCarryFlag(instr) || writesCarryFlag(instr)) {
        return false; // Carry used before CLC found
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

### Category 3: SEC When Carry Known Set

If a previous operation is known to set carry, subsequent SEC is redundant.

```
Pattern: (carry-setting-op) → SEC
Result:  (carry-setting-op)
Savings: 2 cycles, 1 byte
```

#### Carry-Setting Operations

Operations that always set the carry flag:

| Instruction | Condition |
|-------------|-----------|
| `SEC`       | Always    |
| `CMP #n`    | When A >= n (known values) |
| `CPX #n`    | When X >= n (known values) |
| `CPY #n`    | When Y >= n (known values) |
| `ASL`       | When bit 7 was 1 (if known) |
| `LSR`       | When bit 0 was 1 (if known) |

```typescript
/**
 * Instructions that unconditionally set carry
 */
const ALWAYS_SETS_CARRY = new Set([Opcode.SEC]);

/**
 * Instructions that set carry under certain conditions
 */
const CONDITIONALLY_SETS_CARRY = new Map<Opcode, (state: ValueState, operand: number) => boolean>([
  [Opcode.CMP, (state, operand) => {
    // CMP #n sets carry if A >= n
    return state.knownValue !== undefined && state.knownValue >= operand;
  }],
  [Opcode.CPX, (state, operand) => {
    return state.knownValue !== undefined && state.knownValue >= operand;
  }],
  [Opcode.CPY, (state, operand) => {
    return state.knownValue !== undefined && state.knownValue >= operand;
  }],
  [Opcode.ASL, (state) => {
    // ASL sets carry if bit 7 of operand was 1
    return state.knownValue !== undefined && (state.knownValue & 0x80) !== 0;
  }],
  [Opcode.LSR, (state) => {
    // LSR sets carry if bit 0 of operand was 1
    return state.knownValue !== undefined && (state.knownValue & 0x01) !== 0;
  }]
]);
```

#### Implementation

```typescript
/**
 * Detects SEC after operation that already set carry
 * 
 * @pattern (sets-carry) SEC → (sets-carry)
 * @safety Requires carry state tracking
 * @savings 2 cycles, 1 byte
 */
export const secAfterCarrySetPattern: PeepholePattern = {
  name: 'sec-after-carry-set',
  description: 'Remove SEC when carry already known to be set',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.SEC) return false;
    
    // Check if carry is already known to be set
    return state.carry === FlagState.SET;
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

### Category 4: SEC Before Non-Carry Operations (Dead SEC)

SEC followed only by operations that don't use carry is redundant until a carry-using operation appears.

```
Pattern: SEC → (no-carry-ops) → (branch/return/etc)
Result:  (no-carry-ops) → (branch/return/etc)
Savings: 2 cycles, 1 byte
```

#### Implementation

```typescript
/**
 * Detects SEC that is never used before being overwritten
 * 
 * @pattern SEC (non-carry-ops)* (overwrites-carry | end-of-block)
 * @safety Requires control flow analysis
 * @savings 2 cycles, 1 byte
 */
export const deadSECPattern: PeepholePattern = {
  name: 'dead-sec',
  description: 'Remove SEC when carry value is never used',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.SEC) return false;
    
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
  priority: PatternPriority.LOW,
  category: PatternCategory.DEAD_CODE
};
```

---

### Category 5: SEC in Subtraction Sequences

In unrolled loops with subtractions, SECs may appear repeatedly when only one is needed at the start.

```
Before:
  SEC
  SBC #1
  SEC       ; Redundant if no borrow out
  SBC #1
  SEC       ; Redundant if no borrow out
  SBC #1

After (if no underflow):
  SEC
  SBC #1
  SBC #1
  SBC #1
```

**Note**: This is different from CLC/ADC because SBC with borrow is more complex. The borrow (inverted carry) affects whether subsequent SECs can be removed.

#### Implementation

```typescript
/**
 * Detects redundant SEC in SBC sequences when no borrow possible
 * 
 * @pattern SEC SBC #n SEC SBC #m ... → SEC SBC #n SBC #m ...
 * @safety Requires value analysis to ensure no borrow underflow
 * @savings 2 cycles, 1 byte per removed SEC
 */
export const loopSECPattern: PeepholePattern = {
  name: 'loop-sec-elimination',
  description: 'Remove redundant SECs in subtraction sequences',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    // Need at least: SEC SBC SEC SBC
    if (window.size < 4) return false;
    
    // First must be SEC
    if (window.get(0).opcode !== Opcode.SEC) return false;
    
    // Look for pattern: SEC SBC SEC SBC
    const first = window.get(0);
    const sbc1 = window.get(1);
    const sec2 = window.get(2);
    const sbc2 = window.get(3);
    
    if (sbc1.opcode !== Opcode.SBC ||
        sec2.opcode !== Opcode.SEC ||
        sbc2.opcode !== Opcode.SBC) {
      return false;
    }
    
    // Check if SBC can borrow (requires value tracking)
    // Conservative: only immediate values that can't borrow
    if (sbc1.addressingMode !== AddressingMode.IMMEDIATE) {
      return false;
    }
    
    const value1 = sbc1.operand as number;
    const minA = state.accumulator.minValue ?? 0;
    
    // If min A - value1 >= 0, no borrow (carry stays set after SBC)
    return minA >= value1;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    const toRemove: number[] = [];
    
    for (let i = 2; i < window.size; i++) {
      if (window.get(i).opcode === Opcode.SEC) {
        if (i + 1 < window.size &&
            window.get(i + 1).opcode === Opcode.SBC &&
            window.get(i - 1).opcode === Opcode.SBC) {
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

### Category 6: SEC After Compare Greater-Equal

CMP operations set carry when A >= operand, so SEC after such a compare is redundant if we know the condition held.

```
Pattern: CMP #n (when A >= n known) → SEC
Result:  CMP #n
Savings: 2 cycles, 1 byte
```

#### Implementation

```typescript
/**
 * Detects SEC after CMP when result known to set carry
 * 
 * @pattern CMP #n (A>=n) SEC → CMP #n
 * @safety Requires value tracking for accumulator
 * @savings 2 cycles, 1 byte
 */
export const secAfterCmpPattern: PeepholePattern = {
  name: 'sec-after-cmp',
  description: 'Remove SEC when previous CMP already set carry',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 2) return false;
    
    const cmp = window.get(0);
    const sec = window.get(1);
    
    if (cmp.opcode !== Opcode.CMP || sec.opcode !== Opcode.SEC) {
      return false;
    }
    
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) {
      return false;
    }
    
    const compareValue = cmp.operand as number;
    const minA = state.accumulator.minValue;
    
    // If min A >= compareValue, CMP always sets carry
    return minA !== undefined && minA >= compareValue;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [1], // Remove SEC
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

## Testing Requirements

### Unit Tests

```typescript
describe('SEC Redundancy Elimination', () => {
  describe('Consecutive SEC', () => {
    it('should remove second SEC in SEC SEC sequence', () => {
      const input = [
        { opcode: Opcode.SEC },
        { opcode: Opcode.SEC }
      ];
      
      const result = applyPattern(consecutiveSECPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.SEC }
      ]);
      expect(result.cyclesSaved).toBe(2);
      expect(result.bytesSaved).toBe(1);
    });
    
    it('should remove all but first SEC in multiple SEC sequence', () => {
      const input = [
        { opcode: Opcode.SEC },
        { opcode: Opcode.SEC },
        { opcode: Opcode.SEC }
      ];
      
      const result = applyPattern(consecutiveSECPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.SEC }
      ]);
      expect(result.cyclesSaved).toBe(4);
      expect(result.bytesSaved).toBe(2);
    });
  });
  
  describe('SEC followed by CLC', () => {
    it('should remove SEC when immediately followed by CLC', () => {
      const input = [
        { opcode: Opcode.SEC },
        { opcode: Opcode.CLC }
      ];
      
      const result = applyPattern(secFollowedByClcPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.CLC }
      ]);
    });
    
    it('should remove SEC with non-carry instructions before CLC', () => {
      const input = [
        { opcode: Opcode.SEC },
        { opcode: Opcode.LDA, operand: 0x00 },
        { opcode: Opcode.CLC }
      ];
      
      const result = applyPattern(secGapClcPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.LDA, operand: 0x00 },
        { opcode: Opcode.CLC }
      ]);
    });
    
    it('should NOT remove SEC when SBC appears before CLC', () => {
      const input = [
        { opcode: Opcode.SEC },
        { opcode: Opcode.SBC, operand: 0x01 },
        { opcode: Opcode.CLC }
      ];
      
      const result = applyPattern(secGapClcPattern, input);
      
      expect(result.matched).toBe(false);
    });
  });
  
  describe('SEC after carry set', () => {
    it('should remove SEC when carry already set', () => {
      const state: CPUFlagState = {
        ...INITIAL_FLAG_STATE,
        carry: FlagState.SET
      };
      
      const input = [
        { opcode: Opcode.SEC }
      ];
      
      const result = applyPattern(secAfterCarrySetPattern, input, state);
      
      expect(result.instructions).toEqual([]);
      expect(result.cyclesSaved).toBe(2);
    });
  });
  
  describe('SEC after CMP', () => {
    it('should remove SEC after CMP when A >= operand known', () => {
      const state: CPUState = {
        accumulator: { minValue: 10, maxValue: 255 }
      };
      
      const input = [
        { opcode: Opcode.CMP, operand: 5, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.SEC }
      ];
      
      const result = applyPattern(secAfterCmpPattern, input, state);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.CMP, operand: 5, addressingMode: AddressingMode.IMMEDIATE }
      ]);
    });
    
    it('should NOT remove SEC when A might be less than operand', () => {
      const state: CPUState = {
        accumulator: { minValue: 0, maxValue: 255 }
      };
      
      const input = [
        { opcode: Opcode.CMP, operand: 5, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.SEC }
      ];
      
      const result = applyPattern(secAfterCmpPattern, input, state);
      
      expect(result.matched).toBe(false);
    });
  });
});
```

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| Consecutive SEC | Common | 2/instance | 1/instance |
| SEC→CLC | Moderate | 2 | 1 |
| SEC (carry known) | Moderate | 2 | 1 |
| Dead SEC | Rare | 2 | 1 |
| Loop SEC | Rare | 2×n | n |
| SEC after CMP | Rare | 2 | 1 |

---

## Integration Notes

### Pattern Ordering

SEC redundancy patterns should run:
1. **After** value propagation (for known carry states)
2. **After** dead code elimination (for dead SEC detection)
3. **Together with** CLC patterns (complementary)
4. **Before** final instruction scheduling

### Dependencies

- Requires: `FlagStateTracker`
- Requires: `ValuePropagation` (for CMP/loop patterns)
- Optional: `CFGAnalysis` (for dead SEC pattern)
- Related: `08-09a-redundant-clc.md` (complementary patterns)

---

## Summary

This document covers six categories of SEC redundancy:

1. **Consecutive SEC** - Multiple SECs in sequence
2. **SEC→CLC** - Opposite flag operations
3. **SEC after set** - Carry already known set
4. **Dead SEC** - Carry never read before overwrite
5. **Loop SEC** - Redundant SECs in subtraction sequences
6. **SEC after CMP** - Carry set by comparison

Total potential savings: 2-12+ cycles per occurrence.