# 8.9i: Dead Store Elimination Patterns

> **Document**: `08-09i-redundant-store.md`
> **Phase**: 08-peephole
> **Task**: 8.9i - Dead store elimination
> **Focus**: Eliminating stores to memory that are never read or immediately overwritten

---

## Overview

Dead store elimination removes memory writes whose values are never read. This includes stores immediately overwritten by subsequent stores to the same address, and stores to variables that are never subsequently used.

---

## Pattern Categories

### Category 1: Consecutive Stores to Same Address

```
Pattern: STA $addr → STA $addr
Result:  STA $addr (keep second)
Savings: 3-4 cycles, 2-3 bytes
```

#### Implementation

```typescript
/**
 * Detects consecutive STA to same address
 */
export const consecutiveStaPattern: PeepholePattern = {
  name: 'consecutive-sta',
  description: 'Remove first STA when immediately overwritten',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    if (first.opcode !== Opcode.STA) return false;
    if (second.opcode !== Opcode.STA) return false;
    if (first.addressingMode !== second.addressingMode) return false;
    if (first.operand !== second.operand) return false;
    
    // Safe to remove first - value immediately overwritten
    const address = first.effectiveAddress ?? first.operand as number;
    return isSafeForDeadStore(address);
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

### Category 2: Consecutive STX to Same Address

```
Pattern: STX $addr → STX $addr
Result:  STX $addr (keep second)
```

```typescript
export const consecutiveStxPattern: PeepholePattern = {
  name: 'consecutive-stx',
  description: 'Remove first STX when immediately overwritten',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    if (first.opcode !== Opcode.STX) return false;
    if (second.opcode !== Opcode.STX) return false;
    if (first.addressingMode !== second.addressingMode) return false;
    if (first.operand !== second.operand) return false;
    
    const address = first.effectiveAddress ?? first.operand as number;
    return isSafeForDeadStore(address);
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

### Category 3: Consecutive STY to Same Address

```
Pattern: STY $addr → STY $addr
Result:  STY $addr (keep second)
```

```typescript
export const consecutiveStyPattern: PeepholePattern = {
  name: 'consecutive-sty',
  description: 'Remove first STY when immediately overwritten',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    if (first.opcode !== Opcode.STY) return false;
    if (second.opcode !== Opcode.STY) return false;
    if (first.addressingMode !== second.addressingMode) return false;
    if (first.operand !== second.operand) return false;
    
    const address = first.effectiveAddress ?? first.operand as number;
    return isSafeForDeadStore(address);
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

### Category 4: Store with Gap Before Overwrite

```
Pattern: STA $addr → (no-read-of-addr) → STA $addr
Result:  (no-read-of-addr) → STA $addr
```

```typescript
/**
 * Detects store overwritten without being read
 */
export const storeGapOverwritePattern: PeepholePattern = {
  name: 'store-gap-overwrite',
  description: 'Remove store when overwritten without being read',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    if (first.opcode !== Opcode.STA) return false;
    
    const storeAddress = first.effectiveAddress ?? first.operand;
    
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      
      // Found another store to same address - first is dead
      if (instr.opcode === Opcode.STA &&
          (instr.effectiveAddress ?? instr.operand) === storeAddress) {
        return isSafeForDeadStore(storeAddress as number);
      }
      
      // Check if this instruction reads from the address
      if (readsFromAddress(instr, storeAddress as number)) {
        return false;
      }
    }
    
    return false;
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
  
  priority: PatternPriority.MEDIUM,
  category: PatternCategory.DEAD_CODE
};
```

---

### Category 5: Store to Local Never Read

Store to local variable that is never read before function return.

```
Pattern: STA localVar → ... → RTS (localVar never read)
Result:  ... → RTS
```

```typescript
/**
 * Detects store to local variable never read
 */
export const deadLocalStorePattern: PeepholePattern = {
  name: 'dead-local-store',
  description: 'Remove store to local variable never read',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const store = window.get(0);
    if (store.opcode !== Opcode.STA &&
        store.opcode !== Opcode.STX &&
        store.opcode !== Opcode.STY) {
      return false;
    }
    
    const address = store.effectiveAddress ?? store.operand as number;
    
    // Check if address is a local variable
    if (!isLocalVariable(address)) return false;
    
    // Check if value is read before function ends
    return !cfg.isAddressLiveAfter(store, address);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    const store = window.get(0);
    return {
      remove: [0],
      insert: [],
      cyclesSaved: getCycleCount(store),
      bytesSaved: getByteCount(store)
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.DEAD_CODE
};
```

---

### Category 6: Store Before Return (Non-Observable)

Store immediately before function return when the stored value isn't a return value or observable.

```
Pattern: STA tempVar → RTS (tempVar not needed)
Result:  RTS
```

```typescript
/**
 * Detects useless store before return
 */
export const storeBeforeReturnPattern: PeepholePattern = {
  name: 'store-before-return',
  description: 'Remove store immediately before RTS when not needed',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 2) return false;
    
    const store = window.get(0);
    const ret = window.get(1);
    
    if (ret.opcode !== Opcode.RTS && ret.opcode !== Opcode.RTI) {
      return false;
    }
    
    if (store.opcode !== Opcode.STA &&
        store.opcode !== Opcode.STX &&
        store.opcode !== Opcode.STY) {
      return false;
    }
    
    const address = store.effectiveAddress ?? store.operand as number;
    
    // Must be local/temp variable, not global or return value
    if (!isLocalVariable(address)) return false;
    
    // Check if caller expects value at this address
    return !cfg.isReturnValue(address);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    const store = window.get(0);
    return {
      remove: [0],
      insert: [],
      cyclesSaved: getCycleCount(store),
      bytesSaved: getByteCount(store)
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.DEAD_CODE
};
```

---

## Safety Checks

### Safe Address Detection

```typescript
/**
 * Checks if address is safe for dead store elimination
 * NOT safe: I/O registers, interrupt vectors, etc.
 */
function isSafeForDeadStore(address: number): boolean {
  // Hardware I/O writes may have side effects
  if (address >= 0xD000 && address < 0xE000) return false;
  
  // Interrupt vectors must not be optimized
  if (address >= 0xFFFA && address <= 0xFFFF) return false;
  
  // Zero page is generally safe
  if (address < 0x100) return true;
  
  // RAM is safe
  if (address >= 0x0200 && address < 0xD000) return true;
  
  return false;
}

/**
 * Checks if instruction reads from specific address
 */
function readsFromAddress(instr: Instruction, address: number): boolean {
  // Check if operand matches address
  const instrAddress = instr.effectiveAddress ?? instr.operand;
  if (instrAddress !== address) return false;
  
  // These instructions read from memory
  const readInstructions = new Set([
    Opcode.LDA, Opcode.LDX, Opcode.LDY,
    Opcode.ADC, Opcode.SBC,
    Opcode.AND, Opcode.ORA, Opcode.EOR,
    Opcode.CMP, Opcode.CPX, Opcode.CPY,
    Opcode.BIT, Opcode.ASL, Opcode.LSR,
    Opcode.ROL, Opcode.ROR, Opcode.INC, Opcode.DEC
  ]);
  
  return readInstructions.has(instr.opcode);
}

/**
 * Checks if address is a local variable (stack-relative or ZP temp)
 */
function isLocalVariable(address: number): boolean {
  // Zero page temporaries (compiler-allocated)
  if (address >= 0x02 && address < 0x10) return true;
  
  // Additional temp area
  if (address >= 0xFB && address < 0xFF) return true;
  
  return false;
}
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('Dead Store Elimination', () => {
  describe('Consecutive STA', () => {
    it('should remove first STA when immediately overwritten', () => {
      const input = [
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE },
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE }
      ];
      
      const result = applyPattern(consecutiveStaPattern, input);
      
      expect(result.instructions.length).toBe(1);
      expect(result.cyclesSaved).toBe(4);
    });
    
    it('should NOT remove STA to I/O address', () => {
      const input = [
        { opcode: Opcode.STA, operand: 0xD020, addressingMode: AddressingMode.ABSOLUTE },
        { opcode: Opcode.STA, operand: 0xD020, addressingMode: AddressingMode.ABSOLUTE }
      ];
      
      const result = applyPattern(consecutiveStaPattern, input);
      expect(result.matched).toBe(false);
    });
  });
  
  describe('Store with gap', () => {
    it('should remove first store when not read before overwrite', () => {
      const input = [
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE },
        { opcode: Opcode.INX },
        { opcode: Opcode.INY },
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE }
      ];
      
      const result = applyPattern(storeGapOverwritePattern, input);
      expect(result.instructions.length).toBe(3);
    });
    
    it('should NOT remove when value is read', () => {
      const input = [
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE },
        { opcode: Opcode.LDA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE },
        { opcode: Opcode.STA, operand: 0x1000, addressingMode: AddressingMode.ABSOLUTE }
      ];
      
      const result = applyPattern(storeGapOverwritePattern, input);
      expect(result.matched).toBe(false);
    });
  });
});
```

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| Consecutive STA | Moderate | 3-4 | 2-3 |
| Consecutive STX | Rare | 3-4 | 2-3 |
| Consecutive STY | Rare | 3-4 | 2-3 |
| Store with gap | Moderate | 3-4 | 2-3 |
| Dead local store | Moderate | 3-4 | 2-3 |
| Store before return | Rare | 3-4 | 2-3 |

---

## Summary

This document covers six categories of dead store elimination:

1. **Consecutive STA** - Immediate overwrite
2. **Consecutive STX** - Immediate overwrite
3. **Consecutive STY** - Immediate overwrite
4. **Store with gap** - Overwrite without read
5. **Dead local store** - Never read before function end
6. **Store before return** - Useless store at function exit

Total potential savings: 3-4 cycles per occurrence.