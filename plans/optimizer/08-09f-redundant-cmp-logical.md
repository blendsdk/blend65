# 8.9f: Redundant CMP After Logical Operations

> **Document**: `08-09f-redundant-cmp-logical.md`
> **Phase**: 08-peephole
> **Task**: 8.9f - Redundant CMP after AND/ORA/EOR
> **Focus**: Eliminating unnecessary comparisons after logical operations

---

## Overview

The logical operations AND, ORA, and EOR set the N (negative) and Z (zero) flags based on the result. Unlike ADC/SBC, these operations do NOT affect the carry flag. A CMP #0 after these operations is redundant because N and Z are already correctly set for zero-comparison.

---

## Flag Effects Summary

### Logical Operation Flag Effects

| Instruction | N Flag | Z Flag | C Flag | V Flag |
|-------------|--------|--------|--------|--------|
| AND         | Result bit 7 | Result = 0 | Unchanged | Unchanged |
| ORA         | Result bit 7 | Result = 0 | Unchanged | Unchanged |
| EOR         | Result bit 7 | Result = 0 | Unchanged | Unchanged |

### CMP #0 Flag Effects

| Flag | Effect |
|------|--------|
| N    | Set if A bit 7 is set |
| Z    | Set if A is zero |
| C    | Always set (A >= 0) |

**Key Insight**: For CMP #0, only N and Z matter for BEQ/BNE/BMI/BPL branches. Since logical operations set these correctly, CMP #0 is redundant.

---

## Pattern Categories

### Category 1: CMP #0 After AND

CMP #0 immediately after AND is redundant.

```
Pattern: AND #n → CMP #0
Result:  AND #n
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects redundant CMP #0 after AND
 * 
 * @pattern AND CMP #0 → AND
 * @safety Always safe - N and Z flags identical
 * @savings 2 cycles, 2 bytes
 */
export const cmpZeroAfterAndPattern: PeepholePattern = {
  name: 'cmp-zero-after-and',
  description: 'Remove CMP #0 after AND (N/Z already set)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const and = window.get(0);
    const cmp = window.get(1);
    
    if (and.opcode !== Opcode.AND) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    return cmp.operand === 0;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [1],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 2: CMP #0 After ORA

CMP #0 immediately after ORA is redundant.

```
Pattern: ORA #n → CMP #0
Result:  ORA #n
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects redundant CMP #0 after ORA
 * 
 * @pattern ORA CMP #0 → ORA
 * @safety Always safe - N and Z flags identical
 * @savings 2 cycles, 2 bytes
 */
export const cmpZeroAfterOraPattern: PeepholePattern = {
  name: 'cmp-zero-after-ora',
  description: 'Remove CMP #0 after ORA (N/Z already set)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const ora = window.get(0);
    const cmp = window.get(1);
    
    if (ora.opcode !== Opcode.ORA) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    return cmp.operand === 0;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [1],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 3: CMP #0 After EOR

CMP #0 immediately after EOR is redundant.

```
Pattern: EOR #n → CMP #0
Result:  EOR #n
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects redundant CMP #0 after EOR
 * 
 * @pattern EOR CMP #0 → EOR
 * @safety Always safe - N and Z flags identical
 * @savings 2 cycles, 2 bytes
 */
export const cmpZeroAfterEorPattern: PeepholePattern = {
  name: 'cmp-zero-after-eor',
  description: 'Remove CMP #0 after EOR (N/Z already set)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const eor = window.get(0);
    const cmp = window.get(1);
    
    if (eor.opcode !== Opcode.EOR) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    return cmp.operand === 0;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [1],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 4: Unified Logical CMP #0 Pattern

A single pattern covering all three logical operations.

```typescript
/**
 * Detects redundant CMP #0 after any logical operation
 * 
 * @pattern (AND|ORA|EOR) CMP #0 → (AND|ORA|EOR)
 * @safety Always safe for N and Z
 * @savings 2 cycles, 2 bytes
 */
export const cmpZeroAfterLogicalPattern: PeepholePattern = {
  name: 'cmp-zero-after-logical',
  description: 'Remove CMP #0 after AND/ORA/EOR (N/Z already set)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const logical = window.get(0);
    const cmp = window.get(1);
    
    const isLogical = logical.opcode === Opcode.AND ||
                      logical.opcode === Opcode.ORA ||
                      logical.opcode === Opcode.EOR;
    
    if (!isLogical) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    return cmp.operand === 0;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [1],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 5: CMP #0 After Logical with Gap

CMP #0 after logical operation with flag-preserving instructions between.

```
Pattern: AND #n → (flag-preserving-ops) → CMP #0
Result:  AND #n → (flag-preserving-ops)
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Instructions that preserve N and Z flags
 * (Note: logical ops don't modify C, so C-preserving doesn't matter here)
 */
const NZ_PRESERVING_INSTRUCTIONS = new Set([
  Opcode.STA,
  Opcode.STX,
  Opcode.STY,
  Opcode.PHA,
  Opcode.NOP,
  Opcode.CLC,  // Only affects C, not N/Z
  Opcode.SEC,  // Only affects C, not N/Z
  Opcode.CLI,  // Only affects I
  Opcode.SEI,  // Only affects I
  Opcode.CLV,  // Only affects V
  Opcode.TXS   // Doesn't affect N/Z
]);

/**
 * Detects CMP #0 after logical with N/Z-preserving instructions between
 * 
 * @pattern (AND|ORA|EOR) (NZ-preserving)* CMP #0 → (AND|ORA|EOR) (NZ-preserving)*
 */
export const cmpZeroAfterLogicalGapPattern: PeepholePattern = {
  name: 'cmp-zero-after-logical-gap',
  description: 'Remove CMP #0 after logical with N/Z-preserving gap',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const isLogical = first.opcode === Opcode.AND ||
                      first.opcode === Opcode.ORA ||
                      first.opcode === Opcode.EOR;
    
    if (!isLogical) return false;
    
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      
      if (instr.opcode === Opcode.CMP &&
          instr.addressingMode === AddressingMode.IMMEDIATE &&
          instr.operand === 0) {
        return true;
      }
      
      if (!NZ_PRESERVING_INSTRUCTIONS.has(instr.opcode)) {
        return false;
      }
    }
    
    return false;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    for (let i = 1; i < window.size; i++) {
      if (window.get(i).opcode === Opcode.CMP) {
        return {
          remove: [i],
          insert: [],
          cyclesSaved: 2,
          bytesSaved: 2
        };
      }
    }
    return { remove: [], insert: [], cyclesSaved: 0, bytesSaved: 0 };
  },
  
  priority: PatternPriority.MEDIUM,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 6: AND #$80 for Sign Check

A common pattern is `AND #$80` followed by `BNE` to check the sign bit. CMP #0 is redundant here.

```
Pattern: AND #$80 → CMP #0 → BNE negative
Result:  AND #$80 → BNE negative
Savings: 2 cycles, 2 bytes
```

Actually, for sign checking, BMI is more efficient:

```
Pattern: AND #$80 → CMP #0 → BNE negative
Better:  LDA value → BMI negative
```

But that's a different optimization. For now, just remove the redundant CMP:

```typescript
/**
 * Detects redundant CMP #0 after AND #$80 (sign bit check)
 * 
 * @pattern AND #$80 CMP #0 → AND #$80
 * @safety Always safe
 * @note Could further optimize to just BMI if appropriate
 */
export const cmpZeroAfterAndSignPattern: PeepholePattern = {
  name: 'cmp-zero-after-and-sign',
  description: 'Remove CMP #0 after AND #$80 (sign bit check)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const and = window.get(0);
    const cmp = window.get(1);
    
    if (and.opcode !== Opcode.AND) return false;
    if (and.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (and.operand !== 0x80) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (cmp.operand !== 0) return false;
    
    return true;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [1],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 7: Known-Result Logical Operations

When logical operation result is known, CMP may be completely redundant.

```
Pattern: LDA #$FF → AND #$0F → CMP #$0F
Analysis: Result is always $0F, CMP #$0F always sets Z=1
Result:  LDA #$FF → AND #$0F (if only Z flag matters)
```

```
Pattern: LDA #0 → ORA #$FF → CMP #$FF
Analysis: Result is always $FF, CMP #$FF always sets Z=1
Result:  LDA #0 → ORA #$FF
```

#### Implementation

```typescript
/**
 * Detects redundant CMP when logical result matches compare value
 * 
 * @pattern (logical result known) CMP #(same value) → (logical)
 * @safety Requires value tracking
 * @savings 2 cycles, 2 bytes
 */
export const cmpKnownLogicalResultPattern: PeepholePattern = {
  name: 'cmp-known-logical-result',
  description: 'Remove CMP when comparing logical result to known equal value',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 2) return false;
    
    const logical = window.get(0);
    const cmp = window.get(1);
    
    const isLogical = logical.opcode === Opcode.AND ||
                      logical.opcode === Opcode.ORA ||
                      logical.opcode === Opcode.EOR;
    
    if (!isLogical) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    // Check if we know the accumulator value after logical op
    const resultValue = state.getAccumulatorValueAfter(logical);
    if (resultValue === undefined) return false;
    
    return resultValue === cmp.operand;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [1],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  requiresState: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 8: Bit Mask Check Patterns

Common patterns for checking specific bits:

```
; Check if bit 0 is set
AND #$01
CMP #0     ; Redundant - Z already set correctly
BNE bit_set

; Check if bit 7 is set
AND #$80
CMP #0     ; Redundant - Z already set, also N is set!
BNE bit_set
```

For bit 7, the AND #$80 sets N flag directly, so BMI could be used instead:

```typescript
/**
 * Detects bit check patterns with redundant CMP
 * 
 * @pattern AND #(single-bit) CMP #0 → AND #(single-bit)
 */
export const cmpZeroAfterBitMaskPattern: PeepholePattern = {
  name: 'cmp-zero-after-bit-mask',
  description: 'Remove CMP #0 after single-bit AND mask',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const and = window.get(0);
    const cmp = window.get(1);
    
    if (and.opcode !== Opcode.AND) return false;
    if (and.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (cmp.operand !== 0) return false;
    
    // Check if AND operand is a single-bit mask
    const mask = and.operand as number;
    const isSingleBit = mask !== 0 && (mask & (mask - 1)) === 0;
    
    return isSingleBit;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [1],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('Redundant CMP After Logical', () => {
  describe('CMP #0 after AND', () => {
    it('should remove CMP #0 immediately after AND', () => {
      const input = [
        { opcode: Opcode.AND, operand: 0x0F, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterAndPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.AND, operand: 0x0F, addressingMode: AddressingMode.IMMEDIATE }
      ]);
      expect(result.cyclesSaved).toBe(2);
      expect(result.bytesSaved).toBe(2);
    });
  });
  
  describe('CMP #0 after ORA', () => {
    it('should remove CMP #0 immediately after ORA', () => {
      const input = [
        { opcode: Opcode.ORA, operand: 0xF0, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterOraPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.ORA, operand: 0xF0, addressingMode: AddressingMode.IMMEDIATE }
      ]);
    });
  });
  
  describe('CMP #0 after EOR', () => {
    it('should remove CMP #0 immediately after EOR', () => {
      const input = [
        { opcode: Opcode.EOR, operand: 0xFF, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterEorPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.EOR, operand: 0xFF, addressingMode: AddressingMode.IMMEDIATE }
      ]);
    });
  });
  
  describe('Unified logical pattern', () => {
    it('should match AND', () => {
      const input = [
        { opcode: Opcode.AND, operand: 0x0F, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterLogicalPattern, input);
      expect(result.matched).toBe(true);
    });
    
    it('should match ORA', () => {
      const input = [
        { opcode: Opcode.ORA, operand: 0xF0, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterLogicalPattern, input);
      expect(result.matched).toBe(true);
    });
    
    it('should match EOR', () => {
      const input = [
        { opcode: Opcode.EOR, operand: 0xFF, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterLogicalPattern, input);
      expect(result.matched).toBe(true);
    });
    
    it('should NOT match CMP #5', () => {
      const input = [
        { opcode: Opcode.AND, operand: 0x0F, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 5, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterLogicalPattern, input);
      expect(result.matched).toBe(false);
    });
  });
  
  describe('CMP #0 with gap', () => {
    it('should remove CMP #0 with STA between', () => {
      const input = [
        { opcode: Opcode.AND, operand: 0x0F, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterLogicalGapPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.AND, operand: 0x0F, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE }
      ]);
    });
    
    it('should NOT remove CMP #0 with LDA between', () => {
      const input = [
        { opcode: Opcode.AND, operand: 0x0F, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.LDA, operand: 0x00, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterLogicalGapPattern, input);
      expect(result.matched).toBe(false);
    });
  });
  
  describe('Single-bit mask', () => {
    it('should remove CMP #0 after AND #$01', () => {
      const input = [
        { opcode: Opcode.AND, operand: 0x01, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterBitMaskPattern, input);
      expect(result.matched).toBe(true);
    });
    
    it('should remove CMP #0 after AND #$80', () => {
      const input = [
        { opcode: Opcode.AND, operand: 0x80, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterBitMaskPattern, input);
      expect(result.matched).toBe(true);
    });
  });
});
```

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| CMP #0 after AND | Very Common | 2 | 2 |
| CMP #0 after ORA | Common | 2 | 2 |
| CMP #0 after EOR | Moderate | 2 | 2 |
| CMP #0 with gap | Moderate | 2 | 2 |
| Known result | Rare | 2 | 2 |
| Bit mask check | Common | 2 | 2 |

---

## Integration Notes

### Pattern Ordering

CMP after logical patterns should run:
1. **After** value propagation (for known result patterns)
2. **Before** branch optimization (may affect branches)
3. **Before** dead code elimination
4. **Together with** arithmetic CMP patterns

### Advantages Over Arithmetic Patterns

Logical operation patterns are **simpler and safer** than arithmetic patterns because:

1. **No carry concerns** - Logical ops don't affect carry, so there's no carry caveat
2. **No overflow concerns** - Logical ops don't affect overflow
3. **Always safe** - CMP #0 can always be removed after AND/ORA/EOR

### Dependencies

- Requires: `FlagStateTracker` (minimal)
- Optional: `ValuePropagation` (for known result patterns)
- Related: `08-09e-redundant-cmp-arithmetic.md` (CMP after ADC/SBC)

---

## Summary

This document covers eight categories of redundant CMP after logical operations:

1. **CMP #0 after AND** - Basic pattern
2. **CMP #0 after ORA** - Basic pattern
3. **CMP #0 after EOR** - Basic pattern
4. **Unified pattern** - Single pattern for all three
5. **CMP #0 with gap** - N/Z-preserving operations between
6. **Sign check** - AND #$80 CMP #0
7. **Known result** - Constant propagation eliminates CMP
8. **Bit mask** - Single-bit AND mask patterns

Total potential savings: 2 cycles, 2 bytes per occurrence.

**Key Insight**: Unlike arithmetic operations, logical operations set N and Z without affecting C. This makes CMP #0 removal always safe, with no carry caveats to worry about.