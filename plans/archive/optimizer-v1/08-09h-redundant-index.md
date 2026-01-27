# 8.9h: Index Register Redundancy Patterns

> **Document**: `08-09h-redundant-index.md`
> **Phase**: 08-peephole
> **Task**: 8.9h - Index register redundancy (X/Y)
> **Focus**: Eliminating redundant loads and operations on X and Y registers

---

## Overview

The X and Y index registers are used for indexed addressing, loop counters, and general data. Redundant loads and operations on these registers waste cycles. This document covers patterns where X or Y already contains the needed value.

---

## Pattern Categories - X Register

### Category 1: Consecutive LDX with Same Value

```
Pattern: LDX #n → LDX #n
Result:  LDX #n
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects consecutive LDX with same immediate value
 */
export const consecutiveLdxImmediatePattern: PeepholePattern = {
  name: 'consecutive-ldx-immediate',
  description: 'Remove consecutive LDX with same immediate value',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    if (first.opcode !== Opcode.LDX) return false;
    if (second.opcode !== Opcode.LDX) return false;
    if (first.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (second.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    return first.operand === second.operand;
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

### Category 2: LDX After STX to Same Address

```
Pattern: STX $addr → LDX $addr
Result:  STX $addr (X unchanged)
Savings: 3-4 cycles, 2-3 bytes
```

```typescript
/**
 * Detects LDX after STX to same address
 */
export const ldxAfterStxSameAddressPattern: PeepholePattern = {
  name: 'ldx-after-stx-same',
  description: 'Remove LDX after STX to same address',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const stx = window.get(0);
    const ldx = window.get(1);
    
    if (stx.opcode !== Opcode.STX) return false;
    if (ldx.opcode !== Opcode.LDX) return false;
    if (stx.addressingMode !== ldx.addressingMode) return false;
    if (stx.operand !== ldx.operand) return false;
    
    const address = stx.effectiveAddress ?? stx.operand as number;
    return isSafeForDuplicateRead(address);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    const ldx = window.get(1);
    return {
      remove: [1],
      insert: [],
      cyclesSaved: getCycleCount(ldx),
      bytesSaved: getByteCount(ldx)
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 3: LDX When X Already Has Value

```
Pattern: LDX #5 → ... → LDX #5 (when X still 5)
Result:  LDX #5 → ...
Savings: 2 cycles, 2 bytes
```

```typescript
/**
 * Detects LDX when X already has the value
 */
export const ldxWhenKnownPattern: PeepholePattern = {
  name: 'ldx-when-known',
  description: 'Remove LDX when X already has the value',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const ldx = window.get(0);
    
    if (ldx.opcode !== Opcode.LDX) return false;
    if (ldx.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    const knownX = state.xRegister.knownValue;
    if (knownX === undefined) return false;
    
    return knownX === ldx.operand;
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

### Category 4: TAX When A Equals X

```
Pattern: (A=X) TAX → nothing
Result:  (nothing)
Savings: 2 cycles, 1 byte
```

```typescript
/**
 * Detects TAX when A already equals X
 */
export const taxWhenEqualPattern: PeepholePattern = {
  name: 'tax-when-equal',
  description: 'Remove TAX when A already equals X',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const tax = window.get(0);
    if (tax.opcode !== Opcode.TAX) return false;
    
    const aValue = state.accumulator.knownValue;
    const xValue = state.xRegister.knownValue;
    
    if (aValue === undefined || xValue === undefined) return false;
    
    return aValue === xValue;
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

### Category 5: Dead LDX (Value Never Used)

```
Pattern: LDX #5 → LDX #10 (first value never used)
Result:  LDX #10
Savings: 2+ cycles, 2+ bytes
```

```typescript
/**
 * Detects LDX where value is immediately overwritten
 */
export const deadLdxPattern: PeepholePattern = {
  name: 'dead-ldx',
  description: 'Remove LDX when value immediately overwritten',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    if (first.opcode !== Opcode.LDX) return false;
    
    const overwritesX = 
      second.opcode === Opcode.LDX ||
      second.opcode === Opcode.TAX ||
      second.opcode === Opcode.TSX;
    
    return overwritesX;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    const first = window.get(0);
    return {
      remove: [0],
      insert: [],
      cyclesSaved: getCycleCount(first),
      bytesSaved: getByteCount(first)
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.DEAD_CODE
};
```

---

### Category 6: INX/DEX Cancellation

```
Pattern: INX → DEX
Result:  (nothing)
Savings: 4 cycles, 2 bytes
```

```
Pattern: DEX → INX
Result:  (nothing)
Savings: 4 cycles, 2 bytes
```

```typescript
/**
 * Detects INX followed by DEX (canceling)
 */
export const inxDexCancelPattern: PeepholePattern = {
  name: 'inx-dex-cancel',
  description: 'Remove INX DEX pair (no effect)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return (first.opcode === Opcode.INX && second.opcode === Opcode.DEX) ||
           (first.opcode === Opcode.DEX && second.opcode === Opcode.INX);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0, 1],
      insert: [],
      cyclesSaved: 4,
      bytesSaved: 2
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

## Pattern Categories - Y Register

### Category 7: Consecutive LDY with Same Value

```
Pattern: LDY #n → LDY #n
Result:  LDY #n
Savings: 2 cycles, 2 bytes
```

```typescript
/**
 * Detects consecutive LDY with same immediate value
 */
export const consecutiveLdyImmediatePattern: PeepholePattern = {
  name: 'consecutive-ldy-immediate',
  description: 'Remove consecutive LDY with same immediate value',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    if (first.opcode !== Opcode.LDY) return false;
    if (second.opcode !== Opcode.LDY) return false;
    if (first.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (second.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    return first.operand === second.operand;
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

### Category 8: LDY After STY to Same Address

```
Pattern: STY $addr → LDY $addr
Result:  STY $addr (Y unchanged)
Savings: 3-4 cycles, 2-3 bytes
```

```typescript
/**
 * Detects LDY after STY to same address
 */
export const ldyAfterStySameAddressPattern: PeepholePattern = {
  name: 'ldy-after-sty-same',
  description: 'Remove LDY after STY to same address',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const sty = window.get(0);
    const ldy = window.get(1);
    
    if (sty.opcode !== Opcode.STY) return false;
    if (ldy.opcode !== Opcode.LDY) return false;
    if (sty.addressingMode !== ldy.addressingMode) return false;
    if (sty.operand !== ldy.operand) return false;
    
    const address = sty.effectiveAddress ?? sty.operand as number;
    return isSafeForDuplicateRead(address);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    const ldy = window.get(1);
    return {
      remove: [1],
      insert: [],
      cyclesSaved: getCycleCount(ldy),
      bytesSaved: getByteCount(ldy)
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 9: TAY When A Equals Y

```
Pattern: (A=Y) TAY → nothing
Savings: 2 cycles, 1 byte
```

```typescript
/**
 * Detects TAY when A already equals Y
 */
export const tayWhenEqualPattern: PeepholePattern = {
  name: 'tay-when-equal',
  description: 'Remove TAY when A already equals Y',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const tay = window.get(0);
    if (tay.opcode !== Opcode.TAY) return false;
    
    const aValue = state.accumulator.knownValue;
    const yValue = state.yRegister.knownValue;
    
    if (aValue === undefined || yValue === undefined) return false;
    
    return aValue === yValue;
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

### Category 10: INY/DEY Cancellation

```
Pattern: INY → DEY
Result:  (nothing)
Savings: 4 cycles, 2 bytes
```

```typescript
/**
 * Detects INY followed by DEY (canceling)
 */
export const inyDeyCancelPattern: PeepholePattern = {
  name: 'iny-dey-cancel',
  description: 'Remove INY DEY pair (no effect)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return (first.opcode === Opcode.INY && second.opcode === Opcode.DEY) ||
           (first.opcode === Opcode.DEY && second.opcode === Opcode.INY);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0, 1],
      insert: [],
      cyclesSaved: 4,
      bytesSaved: 2
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

## Index Register State Tracking

```typescript
/**
 * Tracks known index register state
 */
export interface IndexRegisterState {
  knownValue?: number;
  minValue?: number;
  maxValue?: number;
  source?: InstructionSource;
}

/**
 * X-preserving instructions
 */
const X_PRESERVING_INSTRUCTIONS = new Set([
  Opcode.LDA, Opcode.STA,
  Opcode.LDY, Opcode.STY,
  Opcode.INY, Opcode.DEY,
  Opcode.TAY, Opcode.TYA,
  Opcode.AND, Opcode.ORA, Opcode.EOR,
  Opcode.ADC, Opcode.SBC,
  Opcode.CLC, Opcode.SEC, Opcode.CLI, Opcode.SEI, Opcode.CLV,
  Opcode.NOP, Opcode.PHA, Opcode.PLA, Opcode.PHP, Opcode.PLP
]);

/**
 * Y-preserving instructions
 */
const Y_PRESERVING_INSTRUCTIONS = new Set([
  Opcode.LDA, Opcode.STA,
  Opcode.LDX, Opcode.STX,
  Opcode.INX, Opcode.DEX,
  Opcode.TAX, Opcode.TXA, Opcode.TSX, Opcode.TXS,
  Opcode.AND, Opcode.ORA, Opcode.EOR,
  Opcode.ADC, Opcode.SBC,
  Opcode.CLC, Opcode.SEC, Opcode.CLI, Opcode.SEI, Opcode.CLV,
  Opcode.NOP, Opcode.PHA, Opcode.PLA, Opcode.PHP, Opcode.PLP
]);
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('Index Register Redundancy', () => {
  describe('X Register', () => {
    it('should remove second LDX #n when same value', () => {
      const input = [
        { opcode: Opcode.LDX, operand: 5, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.LDX, operand: 5, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(consecutiveLdxImmediatePattern, input);
      expect(result.instructions.length).toBe(1);
    });
    
    it('should remove INX DEX pair', () => {
      const input = [
        { opcode: Opcode.INX },
        { opcode: Opcode.DEX }
      ];
      
      const result = applyPattern(inxDexCancelPattern, input);
      expect(result.instructions).toEqual([]);
      expect(result.cyclesSaved).toBe(4);
    });
  });
  
  describe('Y Register', () => {
    it('should remove second LDY #n when same value', () => {
      const input = [
        { opcode: Opcode.LDY, operand: 10, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.LDY, operand: 10, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(consecutiveLdyImmediatePattern, input);
      expect(result.instructions.length).toBe(1);
    });
    
    it('should remove INY DEY pair', () => {
      const input = [
        { opcode: Opcode.INY },
        { opcode: Opcode.DEY }
      ];
      
      const result = applyPattern(inyDeyCancelPattern, input);
      expect(result.instructions).toEqual([]);
    });
  });
});
```

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| Consecutive LDX | Common | 2 | 2 |
| LDX after STX | Moderate | 3-4 | 2-3 |
| LDX when known | Rare | 2 | 2 |
| TAX when equal | Rare | 2 | 1 |
| Dead LDX | Moderate | 2+ | 2+ |
| INX/DEX cancel | Rare | 4 | 2 |
| Consecutive LDY | Common | 2 | 2 |
| LDY after STY | Moderate | 3-4 | 2-3 |
| TAY when equal | Rare | 2 | 1 |
| INY/DEY cancel | Rare | 4 | 2 |

---

## Summary

This document covers index register redundancy patterns for both X and Y:

**X Register (6 patterns):**
1. Consecutive LDX #n
2. LDX after STX same address
3. LDX when X known
4. TAX when A equals X
5. Dead LDX
6. INX/DEX cancellation

**Y Register (4 patterns):**
7. Consecutive LDY #n
8. LDY after STY same address
9. TAY when A equals Y
10. INY/DEY cancellation

Total potential savings: 2-6+ cycles per occurrence.