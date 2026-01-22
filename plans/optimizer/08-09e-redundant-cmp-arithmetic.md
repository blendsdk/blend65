# 8.9e: Redundant CMP After Arithmetic Operations

> **Document**: `08-09e-redundant-cmp-arithmetic.md`
> **Phase**: 08-peephole
> **Task**: 8.9e - Redundant CMP after ADC/SBC
> **Focus**: Eliminating unnecessary comparisons after arithmetic operations

---

## Overview

The ADC (Add with Carry) and SBC (Subtract with Borrow) instructions set the N (negative), Z (zero), and C (carry) flags based on the result. A CMP #0 after these operations is redundant because the flags are already set correctly. Similarly, some CMP #n operations can be eliminated or simplified.

---

## Flag Effects Summary

### ADC Flag Effects

| Flag | Effect |
|------|--------|
| N    | Set if result bit 7 is set (negative in signed) |
| Z    | Set if result is zero |
| C    | Set if unsigned overflow (result > 255) |
| V    | Set if signed overflow |

### SBC Flag Effects

| Flag | Effect |
|------|--------|
| N    | Set if result bit 7 is set |
| Z    | Set if result is zero |
| C    | Clear if borrow needed (opposite of intuition) |
| V    | Set if signed overflow |

### CMP #0 Flag Effects

| Flag | Effect |
|------|--------|
| N    | Set if A bit 7 is set |
| Z    | Set if A is zero |
| C    | Always set (A >= 0 is always true) |

---

## Pattern Categories

### Category 1: CMP #0 After ADC (Basic)

CMP #0 immediately after ADC is redundant - N and Z are already correct.

```
Pattern: ADC #n → CMP #0
Result:  ADC #n
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects redundant CMP #0 after ADC
 * 
 * @pattern ADC CMP #0 → ADC
 * @safety Always safe for N and Z flags
 * @savings 2 cycles, 2 bytes
 * @caveat Carry flag differs: ADC sets C on overflow, CMP #0 always sets C
 */
export const cmpZeroAfterAdcPattern: PeepholePattern = {
  name: 'cmp-zero-after-adc',
  description: 'Remove CMP #0 after ADC (N/Z already set)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const adc = window.get(0);
    const cmp = window.get(1);
    
    if (adc.opcode !== Opcode.ADC) return false;
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
  
  // Warn if carry might be used
  flagWarning: 'CMP #0 sets carry unconditionally; ADC carry differs',
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

#### Carry Caveat

**Important**: After ADC, carry indicates overflow. After CMP #0, carry is always set. If subsequent code uses BCC/BCS:

```asm
; If checking for addition overflow:
CLC
ADC #10
BCS overflow    ; Uses ADC's carry - correct
; vs
CLC
ADC #10
CMP #0          ; Destroys overflow information!
BCS overflow    ; Always branches - WRONG!
```

```typescript
/**
 * Safe version that checks carry isn't used
 * 
 * @pattern ADC CMP #0 (no BCC/BCS) → ADC
 * @safety Requires carry usage analysis
 */
export const safeCmpZeroAfterAdcPattern: PeepholePattern = {
  name: 'safe-cmp-zero-after-adc',
  description: 'Remove CMP #0 after ADC when carry not subsequently used',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 2) return false;
    
    const adc = window.get(0);
    const cmp = window.get(1);
    
    if (adc.opcode !== Opcode.ADC) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (cmp.operand !== 0) return false;
    
    // Check if carry from CMP is used
    // If code only uses BEQ/BNE/BMI/BPL, it's safe
    return !cfg.isCarryUsedAfter(cmp);
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
  priority: PatternPriority.MEDIUM,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 2: CMP #0 After SBC (Basic)

CMP #0 immediately after SBC is redundant - N and Z are already correct.

```
Pattern: SBC #n → CMP #0
Result:  SBC #n
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects redundant CMP #0 after SBC
 * 
 * @pattern SBC CMP #0 → SBC
 * @safety Always safe for N and Z flags
 * @savings 2 cycles, 2 bytes
 * @caveat Carry flag differs: SBC sets C on no-borrow, CMP #0 always sets C
 */
export const cmpZeroAfterSbcPattern: PeepholePattern = {
  name: 'cmp-zero-after-sbc',
  description: 'Remove CMP #0 after SBC (N/Z already set)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const sbc = window.get(0);
    const cmp = window.get(1);
    
    if (sbc.opcode !== Opcode.SBC) return false;
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
  
  flagWarning: 'CMP #0 sets carry unconditionally; SBC carry indicates no-borrow',
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 3: CMP #0 After ADC/SBC with Gap

CMP #0 after ADC/SBC with intervening instructions that don't affect flags.

```
Pattern: ADC #n → (flag-preserving-ops) → CMP #0
Result:  ADC #n → (flag-preserving-ops)
Savings: 2 cycles, 2 bytes
```

#### Flag-Preserving Instructions

Instructions that don't affect N, Z, or C flags:

| Category | Instructions |
|----------|-------------|
| Stores   | STA, STX, STY |
| Transfers| TXS (doesn't affect N/Z on some variants) |
| Stack    | PHA |
| No-op    | NOP |

```typescript
/**
 * Instructions that preserve N, Z, and C flags
 */
const FLAG_PRESERVING_INSTRUCTIONS = new Set([
  Opcode.STA,
  Opcode.STX,
  Opcode.STY,
  Opcode.PHA,
  Opcode.NOP
]);

/**
 * Detects CMP #0 after ADC with flag-preserving instructions between
 * 
 * @pattern ADC (flag-preserving)* CMP #0 → ADC (flag-preserving)*
 */
export const cmpZeroAfterAdcGapPattern: PeepholePattern = {
  name: 'cmp-zero-after-adc-gap',
  description: 'Remove CMP #0 after ADC with flag-preserving gap',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    if (first.opcode !== Opcode.ADC) return false;
    
    // Look for CMP #0, ensuring all between preserve flags
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      
      if (instr.opcode === Opcode.CMP &&
          instr.addressingMode === AddressingMode.IMMEDIATE &&
          instr.operand === 0) {
        return true;
      }
      
      if (!FLAG_PRESERVING_INSTRUCTIONS.has(instr.opcode)) {
        return false;
      }
    }
    
    return false;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    // Find the CMP instruction index
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      if (instr.opcode === Opcode.CMP) {
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

### Category 4: CMP After Known-Result ADC

When ADC result is known, CMP may be redundant or simplifiable.

```
Pattern: LDA #5 → CLC → ADC #3 → CMP #8
Result:  LDA #5 → CLC → ADC #3 → (nothing, result always equals 8)
```

#### Implementation

```typescript
/**
 * Detects redundant CMP when ADC result equals compare value
 * 
 * @pattern LDA #a CLC ADC #b CMP #(a+b) → LDA #a CLC ADC #b
 * @safety Requires value tracking
 * @savings 2 cycles, 2 bytes
 */
export const cmpKnownAdcResultPattern: PeepholePattern = {
  name: 'cmp-known-adc-result',
  description: 'Remove CMP when comparing ADC result to known equal value',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 2) return false;
    
    // Look for ADC followed by CMP
    const adc = window.get(0);
    const cmp = window.get(1);
    
    if (adc.opcode !== Opcode.ADC) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    // Check if we know the accumulator value after ADC
    const resultValue = state.getAccumulatorValueAfter(adc);
    if (resultValue === undefined) return false;
    
    // If comparing to the exact result, comparison is always equal
    return resultValue === cmp.operand;
  },
  
  apply(window: InstructionWindow, state: CPUState): PeepholeResult {
    // Result always equals compare value
    // Z=1, N=0 (assuming result < 128), C=1 (A >= operand)
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

### Category 5: SBC Result Comparison Simplification

SBC followed by CMP can sometimes be combined or simplified.

```
Pattern: SEC → SBC #5 → CMP #0
Result:  SEC → SBC #5 (Z flag already set correctly)
```

```
Pattern: SEC → SBC #5 → CMP #10
Analysis: If A was 15, result is 10, CMP #10 sets Z
          This is complex - often leave as-is
```

---

### Category 6: Comparison After Increment/Decrement Chains

ADC #1/SBC #1 are often used for increment/decrement. CMP after these follows similar rules.

```
Pattern: CLC → ADC #1 → CMP #0
Result:  CLC → ADC #1 (Z set if A wrapped from 255 to 0)
Savings: 2 cycles, 2 bytes
```

```
Pattern: SEC → SBC #1 → CMP #0
Result:  SEC → SBC #1 (Z set if A was 1, now 0)
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects redundant CMP #0 after increment (ADC #1)
 */
export const cmpZeroAfterIncrementPattern: PeepholePattern = {
  name: 'cmp-zero-after-increment',
  description: 'Remove CMP #0 after ADC #1 (increment)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 3) return false;
    
    const clc = window.get(0);
    const adc = window.get(1);
    const cmp = window.get(2);
    
    if (clc.opcode !== Opcode.CLC) return false;
    if (adc.opcode !== Opcode.ADC) return false;
    if (adc.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (adc.operand !== 1) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (cmp.operand !== 0) return false;
    
    return true;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [2],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 2
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};

/**
 * Detects redundant CMP #0 after decrement (SBC #1)
 */
export const cmpZeroAfterDecrementPattern: PeepholePattern = {
  name: 'cmp-zero-after-decrement',
  description: 'Remove CMP #0 after SBC #1 (decrement)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 3) return false;
    
    const sec = window.get(0);
    const sbc = window.get(1);
    const cmp = window.get(2);
    
    if (sec.opcode !== Opcode.SEC) return false;
    if (sbc.opcode !== Opcode.SBC) return false;
    if (sbc.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (sbc.operand !== 1) return false;
    if (cmp.opcode !== Opcode.CMP) return false;
    if (cmp.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (cmp.operand !== 0) return false;
    
    return true;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [2],
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
describe('Redundant CMP After Arithmetic', () => {
  describe('CMP #0 after ADC', () => {
    it('should remove CMP #0 immediately after ADC', () => {
      const input = [
        { opcode: Opcode.ADC, operand: 10, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterAdcPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.ADC, operand: 10, addressingMode: AddressingMode.IMMEDIATE }
      ]);
      expect(result.cyclesSaved).toBe(2);
      expect(result.bytesSaved).toBe(2);
    });
    
    it('should NOT remove CMP #5 after ADC', () => {
      const input = [
        { opcode: Opcode.ADC, operand: 10, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 5, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterAdcPattern, input);
      
      expect(result.matched).toBe(false);
    });
  });
  
  describe('CMP #0 after SBC', () => {
    it('should remove CMP #0 immediately after SBC', () => {
      const input = [
        { opcode: Opcode.SBC, operand: 5, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterSbcPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.SBC, operand: 5, addressingMode: AddressingMode.IMMEDIATE }
      ]);
    });
  });
  
  describe('CMP #0 after ADC with gap', () => {
    it('should remove CMP #0 with STA between', () => {
      const input = [
        { opcode: Opcode.ADC, operand: 10, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterAdcGapPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.ADC, operand: 10, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE }
      ]);
    });
    
    it('should NOT remove CMP #0 with LDA between (changes flags)', () => {
      const input = [
        { opcode: Opcode.ADC, operand: 10, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.LDA, operand: 0x00, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterAdcGapPattern, input);
      
      expect(result.matched).toBe(false);
    });
  });
  
  describe('CMP #0 after increment', () => {
    it('should remove CMP #0 after CLC ADC #1', () => {
      const input = [
        { opcode: Opcode.CLC },
        { opcode: Opcode.ADC, operand: 1, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterIncrementPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.CLC },
        { opcode: Opcode.ADC, operand: 1, addressingMode: AddressingMode.IMMEDIATE }
      ]);
    });
  });
  
  describe('CMP #0 after decrement', () => {
    it('should remove CMP #0 after SEC SBC #1', () => {
      const input = [
        { opcode: Opcode.SEC },
        { opcode: Opcode.SBC, operand: 1, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.CMP, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(cmpZeroAfterDecrementPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.SEC },
        { opcode: Opcode.SBC, operand: 1, addressingMode: AddressingMode.IMMEDIATE }
      ]);
    });
  });
});
```

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| CMP #0 after ADC | Common | 2 | 2 |
| CMP #0 after SBC | Common | 2 | 2 |
| CMP #0 with gap | Moderate | 2 | 2 |
| CMP known result | Rare | 2 | 2 |
| CMP #0 after INC | Moderate | 2 | 2 |
| CMP #0 after DEC | Moderate | 2 | 2 |

---

## Integration Notes

### Pattern Ordering

CMP after arithmetic patterns should run:
1. **After** value propagation (for known result patterns)
2. **After** carry analysis (for safe removal)
3. **Before** branch optimization (may affect branches)
4. **Before** dead code elimination

### Dependencies

- Requires: `FlagStateTracker`
- Requires: `ValuePropagation` (for known result patterns)
- Optional: `CFGAnalysis` (for carry usage analysis)
- Related: `08-09f-redundant-cmp-logical.md` (CMP after logical ops)

---

## Summary

This document covers six categories of redundant CMP after arithmetic:

1. **CMP #0 after ADC** - Basic pattern
2. **CMP #0 after SBC** - Basic pattern
3. **CMP #0 with gap** - Flag-preserving operations between
4. **Known result** - Constant propagation eliminates CMP
5. **After increment** - CLC ADC #1 CMP #0
6. **After decrement** - SEC SBC #1 CMP #0

Total potential savings: 2 cycles, 2 bytes per occurrence.

**Key Insight**: The Z and N flags after ADC/SBC already reflect the result for comparison with zero. Only remove CMP if the differing carry behavior won't break subsequent code.