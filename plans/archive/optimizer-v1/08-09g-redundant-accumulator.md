# 8.9g: Accumulator Value Redundancy Patterns

> **Document**: `08-09g-redundant-accumulator.md`
> **Phase**: 08-peephole
> **Task**: 8.9g - Accumulator value redundancy
> **Focus**: Eliminating redundant loads and operations on the accumulator

---

## Overview

The accumulator (A register) is the most frequently used register on the 6502. Redundant loads, stores, and operations on the accumulator waste cycles. This document covers patterns where the accumulator already contains the needed value.

---

## Pattern Categories

### Category 1: Consecutive LDA with Same Value

Loading the same immediate value twice is redundant.

```
Pattern: LDA #n → LDA #n
Result:  LDA #n
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects consecutive LDA with same immediate value
 * 
 * @pattern LDA #n LDA #n → LDA #n
 * @safety Always safe
 * @savings 2 cycles, 2 bytes
 */
export const consecutiveLdaImmediatePattern: PeepholePattern = {
  name: 'consecutive-lda-immediate',
  description: 'Remove consecutive LDA with same immediate value',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    if (first.opcode !== Opcode.LDA) return false;
    if (second.opcode !== Opcode.LDA) return false;
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

### Category 2: Consecutive LDA from Same Address

Loading from the same memory address twice (without intervening stores) is redundant.

```
Pattern: LDA $addr → LDA $addr
Result:  LDA $addr
Savings: 3-4 cycles, 2-3 bytes (depending on addressing mode)
```

**CAUTION**: Only safe if address is not hardware I/O that changes on read.

#### Implementation

```typescript
/**
 * Memory regions that are safe to eliminate duplicate reads
 */
function isSafeForDuplicateRead(address: number): boolean {
  // Zero page is generally safe
  if (address < 0x100) return true;
  
  // RAM is safe
  if (address >= 0x0200 && address < 0xD000) return true;
  
  // Hardware I/O is NOT safe ($D000-$DFFF on C64)
  if (address >= 0xD000 && address < 0xE000) return false;
  
  // ROM is safe
  if (address >= 0xE000) return true;
  
  return false;
}

/**
 * Detects consecutive LDA from same address
 * 
 * @pattern LDA addr LDA addr → LDA addr
 * @safety Only for non-I/O addresses
 * @savings 3-4 cycles, 2-3 bytes
 */
export const consecutiveLdaAddressPattern: PeepholePattern = {
  name: 'consecutive-lda-address',
  description: 'Remove consecutive LDA from same non-I/O address',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    if (first.opcode !== Opcode.LDA) return false;
    if (second.opcode !== Opcode.LDA) return false;
    
    // Must be same addressing mode and operand
    if (first.addressingMode !== second.addressingMode) return false;
    if (first.operand !== second.operand) return false;
    
    // Skip immediate (handled separately)
    if (first.addressingMode === AddressingMode.IMMEDIATE) return false;
    
    // Check if safe for duplicate read
    const address = first.effectiveAddress ?? first.operand as number;
    return isSafeForDuplicateRead(address);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    const first = window.get(0);
    const cycles = getCycleCount(first);
    const bytes = getByteCount(first);
    
    return {
      remove: [1],
      insert: [],
      cyclesSaved: cycles,
      bytesSaved: bytes
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 3: LDA After STA to Same Address

Loading from an address immediately after storing to it returns the same value.

```
Pattern: STA $addr → LDA $addr
Result:  STA $addr (A already has the value)
Savings: 3-4 cycles, 2-3 bytes
```

**CAUTION**: Not safe for hardware I/O registers.

#### Implementation

```typescript
/**
 * Detects LDA after STA to same address
 * 
 * @pattern STA addr LDA addr → STA addr
 * @safety Only for non-I/O addresses
 * @savings 3-4 cycles, 2-3 bytes
 */
export const ldaAfterStaSameAddressPattern: PeepholePattern = {
  name: 'lda-after-sta-same',
  description: 'Remove LDA after STA to same address (A unchanged)',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const sta = window.get(0);
    const lda = window.get(1);
    
    if (sta.opcode !== Opcode.STA) return false;
    if (lda.opcode !== Opcode.LDA) return false;
    
    // Must be same addressing mode and operand
    if (sta.addressingMode !== lda.addressingMode) return false;
    if (sta.operand !== lda.operand) return false;
    
    // Check if safe
    const address = sta.effectiveAddress ?? sta.operand as number;
    return isSafeForDuplicateRead(address);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    const lda = window.get(1);
    const cycles = getCycleCount(lda);
    const bytes = getByteCount(lda);
    
    return {
      remove: [1],
      insert: [],
      cyclesSaved: cycles,
      bytesSaved: bytes
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 4: LDA with Gap After STA

LDA from address after STA with flag-preserving operations between.

```
Pattern: STA $addr → (A-preserving) → LDA $addr
Result:  STA $addr → (A-preserving)
Savings: 3-4 cycles, 2-3 bytes
```

#### Implementation

```typescript
/**
 * Instructions that preserve accumulator value
 */
const A_PRESERVING_INSTRUCTIONS = new Set([
  Opcode.STX,
  Opcode.STY,
  Opcode.INX,
  Opcode.DEX,
  Opcode.INY,
  Opcode.DEY,
  Opcode.TAX,  // Copies A to X, A unchanged
  Opcode.TAY,  // Copies A to Y, A unchanged
  Opcode.NOP,
  Opcode.CLC,
  Opcode.SEC,
  Opcode.CLI,
  Opcode.SEI,
  Opcode.CLV,
  Opcode.PHP,
  Opcode.PLP
]);

/**
 * Detects LDA after STA with A-preserving gap
 * 
 * @pattern STA addr (A-preserving)* LDA addr → STA addr (A-preserving)*
 */
export const ldaAfterStaGapPattern: PeepholePattern = {
  name: 'lda-after-sta-gap',
  description: 'Remove LDA after STA with A-preserving gap',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const sta = window.get(0);
    if (sta.opcode !== Opcode.STA) return false;
    
    const staAddress = sta.effectiveAddress ?? sta.operand;
    
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      
      if (instr.opcode === Opcode.LDA) {
        // Check if same address
        const ldaAddress = instr.effectiveAddress ?? instr.operand;
        if (ldaAddress === staAddress &&
            instr.addressingMode === sta.addressingMode) {
          return isSafeForDuplicateRead(staAddress as number);
        }
        return false; // Different LDA
      }
      
      if (!A_PRESERVING_INSTRUCTIONS.has(instr.opcode)) {
        return false; // A was modified
      }
      
      // Check for STA to same address (would make LDA valid)
      if (instr.opcode === Opcode.STA) {
        const otherAddress = instr.effectiveAddress ?? instr.operand;
        if (otherAddress === staAddress) {
          // Another STA to same address - restart pattern
          continue;
        }
      }
    }
    
    return false;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    // Find the LDA to remove
    for (let i = 1; i < window.size; i++) {
      if (window.get(i).opcode === Opcode.LDA) {
        const lda = window.get(i);
        return {
          remove: [i],
          insert: [],
          cyclesSaved: getCycleCount(lda),
          bytesSaved: getByteCount(lda)
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

### Category 5: LDA #0 When A Known Zero

Loading zero when accumulator is already zero is redundant.

```
Pattern: LDA #0 → (A=0 preserving) → LDA #0
Result:  LDA #0 → (A=0 preserving)
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects LDA #0 when A already known to be zero
 * 
 * @pattern (A=0) LDA #0 → nothing
 * @safety Requires value tracking
 * @savings 2 cycles, 2 bytes
 */
export const ldaZeroWhenZeroPattern: PeepholePattern = {
  name: 'lda-zero-when-zero',
  description: 'Remove LDA #0 when A already zero',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const lda = window.get(0);
    
    if (lda.opcode !== Opcode.LDA) return false;
    if (lda.addressingMode !== AddressingMode.IMMEDIATE) return false;
    if (lda.operand !== 0) return false;
    
    return state.accumulator.knownValue === 0;
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

### Category 6: LDA When A Already Has Value

Loading any known value when A already has that value.

```
Pattern: LDA #5 → ... → LDA #5 (when A still 5)
Result:  LDA #5 → ...
Savings: 2 cycles, 2 bytes
```

#### Implementation

```typescript
/**
 * Detects LDA when A already has the value
 * 
 * @pattern (A=n) LDA #n → nothing
 * @safety Requires value tracking
 * @savings 2 cycles, 2 bytes
 */
export const ldaWhenKnownPattern: PeepholePattern = {
  name: 'lda-when-known',
  description: 'Remove LDA when A already has the value',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const lda = window.get(0);
    
    if (lda.opcode !== Opcode.LDA) return false;
    if (lda.addressingMode !== AddressingMode.IMMEDIATE) return false;
    
    const knownA = state.accumulator.knownValue;
    if (knownA === undefined) return false;
    
    return knownA === lda.operand;
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

### Category 7: TXA/TYA After LDA

Transfer from X/Y to A after loading A with same value from X/Y-sourced location.

```
Pattern: LDA value → TAX → ... → TXA
Result:  LDA value → TAX → ... (if A unchanged)
Savings: 2 cycles, 1 byte
```

#### Implementation

```typescript
/**
 * Detects TXA when A already equals X
 * 
 * @pattern (A=X) TXA → nothing
 * @safety Requires value tracking
 * @savings 2 cycles, 1 byte
 */
export const txaWhenEqualPattern: PeepholePattern = {
  name: 'txa-when-equal',
  description: 'Remove TXA when A already equals X',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const txa = window.get(0);
    if (txa.opcode !== Opcode.TXA) return false;
    
    // Check if A and X have same known value
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

/**
 * Detects TYA when A already equals Y
 */
export const tyaWhenEqualPattern: PeepholePattern = {
  name: 'tya-when-equal',
  description: 'Remove TYA when A already equals Y',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const tya = window.get(0);
    if (tya.opcode !== Opcode.TYA) return false;
    
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

### Category 8: Dead LDA (Value Never Used)

LDA followed by another LDA (or other A-overwriting operation) without using the first value.

```
Pattern: LDA #5 → LDA #10 (first value never used)
Result:  LDA #10
Savings: 2+ cycles, 2+ bytes
```

#### Implementation

```typescript
/**
 * Detects LDA where value is immediately overwritten
 * 
 * @pattern LDA (A-overwriting) → (A-overwriting)
 * @safety Always safe
 * @savings Varies by instruction
 */
export const deadLdaPattern: PeepholePattern = {
  name: 'dead-lda',
  description: 'Remove LDA when value immediately overwritten',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    if (first.opcode !== Opcode.LDA) return false;
    
    // Check if second instruction overwrites A
    const overwritesA = 
      second.opcode === Opcode.LDA ||
      second.opcode === Opcode.TXA ||
      second.opcode === Opcode.TYA ||
      second.opcode === Opcode.PLA;
    
    return overwritesA;
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

## Value State Tracking

### Accumulator State

```typescript
/**
 * Tracks known accumulator state
 */
export interface AccumulatorState {
  /** Known value (if constant) */
  knownValue?: number;
  
  /** Minimum possible value */
  minValue?: number;
  
  /** Maximum possible value */
  maxValue?: number;
  
  /** Source of current value */
  source?: InstructionSource;
}

/**
 * Source information for value tracking
 */
export interface InstructionSource {
  instruction: Instruction;
  address?: number;
}

/**
 * Initial accumulator state
 */
export const INITIAL_A_STATE: AccumulatorState = {
  knownValue: undefined,
  minValue: 0,
  maxValue: 255,
  source: undefined
};
```

### State Update Functions

```typescript
/**
 * Updates accumulator state after LDA immediate
 */
function updateStateAfterLdaImmediate(value: number): AccumulatorState {
  return {
    knownValue: value,
    minValue: value,
    maxValue: value,
    source: undefined
  };
}

/**
 * Updates accumulator state after LDA from memory
 */
function updateStateAfterLdaMemory(address: number): AccumulatorState {
  return {
    knownValue: undefined,  // Unknown unless we track memory
    minValue: 0,
    maxValue: 255,
    source: { instruction: currentInstruction, address }
  };
}

/**
 * Updates accumulator state after arithmetic/logical op
 */
function updateStateAfterArithmetic(op: Opcode, operand: number, state: AccumulatorState): AccumulatorState {
  if (state.knownValue === undefined) {
    return { ...state, knownValue: undefined };
  }
  
  switch (op) {
    case Opcode.ADC:
      // Would need carry state for accurate result
      return { ...state, knownValue: undefined };
    case Opcode.AND:
      return {
        knownValue: state.knownValue & operand,
        minValue: 0,
        maxValue: operand
      };
    case Opcode.ORA:
      return {
        knownValue: state.knownValue | operand,
        minValue: operand,
        maxValue: 255
      };
    case Opcode.EOR:
      return {
        knownValue: state.knownValue ^ operand,
        minValue: 0,
        maxValue: 255
      };
    default:
      return { ...state, knownValue: undefined };
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('Accumulator Redundancy', () => {
  describe('Consecutive LDA immediate', () => {
    it('should remove second LDA #n when same value', () => {
      const input = [
        { opcode: Opcode.LDA, operand: 5, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.LDA, operand: 5, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(consecutiveLdaImmediatePattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.LDA, operand: 5, addressingMode: AddressingMode.IMMEDIATE }
      ]);
    });
    
    it('should NOT remove when different values', () => {
      const input = [
        { opcode: Opcode.LDA, operand: 5, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.LDA, operand: 10, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(consecutiveLdaImmediatePattern, input);
      expect(result.matched).toBe(false);
    });
  });
  
  describe('LDA after STA same address', () => {
    it('should remove LDA after STA to same address', () => {
      const input = [
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE },
        { opcode: Opcode.LDA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE }
      ];
      
      const result = applyPattern(ldaAfterStaSameAddressPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE }
      ]);
    });
    
    it('should NOT remove for I/O addresses', () => {
      const input = [
        { opcode: Opcode.STA, operand: 0xD020, addressingMode: AddressingMode.ABSOLUTE },
        { opcode: Opcode.LDA, operand: 0xD020, addressingMode: AddressingMode.ABSOLUTE }
      ];
      
      const result = applyPattern(ldaAfterStaSameAddressPattern, input);
      expect(result.matched).toBe(false);
    });
  });
  
  describe('LDA when A known', () => {
    it('should remove LDA #0 when A already zero', () => {
      const state: CPUState = {
        accumulator: { knownValue: 0 }
      };
      
      const input = [
        { opcode: Opcode.LDA, operand: 0, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(ldaZeroWhenZeroPattern, input, state);
      
      expect(result.instructions).toEqual([]);
    });
    
    it('should remove LDA #n when A already n', () => {
      const state: CPUState = {
        accumulator: { knownValue: 42 }
      };
      
      const input = [
        { opcode: Opcode.LDA, operand: 42, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(ldaWhenKnownPattern, input, state);
      
      expect(result.instructions).toEqual([]);
    });
  });
  
  describe('Dead LDA', () => {
    it('should remove LDA when immediately overwritten', () => {
      const input = [
        { opcode: Opcode.LDA, operand: 5, addressingMode: AddressingMode.IMMEDIATE },
        { opcode: Opcode.LDA, operand: 10, addressingMode: AddressingMode.IMMEDIATE }
      ];
      
      const result = applyPattern(deadLdaPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.LDA, operand: 10, addressingMode: AddressingMode.IMMEDIATE }
      ]);
    });
  });
});
```

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| Consecutive LDA #n | Common | 2 | 2 |
| Consecutive LDA addr | Moderate | 3-4 | 2-3 |
| LDA after STA | Common | 3-4 | 2-3 |
| LDA with gap | Moderate | 3-4 | 2-3 |
| LDA #0 when zero | Rare | 2 | 2 |
| LDA when known | Rare | 2 | 2 |
| TXA/TYA when equal | Rare | 2 | 1 |
| Dead LDA | Moderate | 2+ | 2+ |

---

## Integration Notes

### Pattern Ordering

Accumulator redundancy patterns should run:
1. **After** value propagation (for known value patterns)
2. **After** dead code elimination (may expose more patterns)
3. **Before** final instruction scheduling
4. **With** index register patterns (similar logic)

### Dependencies

- Requires: `ValueStateTracker`
- Requires: `MemoryAccessAnalysis` (for I/O detection)
- Related: `08-09h-redundant-index.md` (X/Y patterns)
- Related: `08-03a-load-store-core.md` (load/store patterns)

---

## Summary

This document covers eight categories of accumulator redundancy:

1. **Consecutive LDA #n** - Same immediate value
2. **Consecutive LDA addr** - Same address
3. **LDA after STA** - Store then load same
4. **LDA with gap** - Store, operations, load same
5. **LDA #0 when zero** - A already zero
6. **LDA when known** - A already has value
7. **TXA/TYA when equal** - Registers already equal
8. **Dead LDA** - Value immediately overwritten

Total potential savings: 2-6+ cycles per occurrence.