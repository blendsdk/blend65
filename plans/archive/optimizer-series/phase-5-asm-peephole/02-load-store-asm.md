# Phase 5.2: Load-Store ASM Patterns

> **Document**: 02-load-store-asm.md  
> **Phase**: 5 - ASM Peephole  
> **Focus**: STA/LDA elimination - **FIXES main.asm!**  
> **Est. Implementation**: ~350 lines

---

## Overview

This is the **most critical optimization document** for fixing the current compiler output. Load-Store patterns eliminate redundant memory operations that the naive code generator produces.

**This Document Fixes Your main.asm:**

```asm
; CURRENT BROKEN OUTPUT
LDA _data                   ; ← DEAD LOAD (overwritten immediately)
LDA #$05                    
STA $50                     ; Store len
LDA $50                     ; ← REDUNDANT (A already has $05!)

; AFTER OPTIMIZATION
LDA #$05                    ; v2 = 5
STA $50                     ; Store len (A still has $05)
```

---

## 1. Store-Load Elimination (PRIMARY FIX)

### The Problem

The code generator stores a value then immediately loads it back:

```asm
; Pattern: STA addr; LDA addr (same address)
STA $50                     ; Store value (A = X)
LDA $50                     ; Load value back (A = X) ← REDUNDANT!
```

**After the STA, A still contains the value we just stored!**

### Implementation

```typescript
// packages/compiler/src/asm-il/optimizer/passes/load-store.ts

import { AsmInstruction, AsmOpcode } from '../../types.js';
import { Pattern, MatchResult, PatternContext } from '../pattern-framework.js';

/**
 * Pattern: Store-Load Elimination
 * 
 * Match: STA addr; LDA addr (same address, no intervening writes)
 * Replace: STA addr (A already has the value)
 * 
 * THIS IS THE #1 PATTERN FOR FIXING main.asm
 */
export class StoreLoadEliminationPattern implements Pattern<AsmInstruction> {
  readonly name = 'store-load-elimination';
  readonly priority = 100;  // HIGHEST PRIORITY - most impactful
  readonly category = 'load-store';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 1 >= instructions.length) return null;

    const store = instructions[index];
    const load = instructions[index + 1];

    // Match STA followed by LDA
    if (store.opcode !== AsmOpcode.STA) return null;
    if (load.opcode !== AsmOpcode.LDA) return null;

    // Must be same address
    if (!this.sameAddress(store, load)) return null;

    // Load must not be a jump target
    if (load.label) return null;

    // Verify no A modification between (should be immediate for this pattern)
    // In STA; LDA sequence, nothing modifies A

    return {
      matchedInstructions: [store, load],
      startIndex: index,
      length: 2,
      metadata: {
        patternName: this.name,
        reason: 'LDA after STA to same address - A already has value',
        cyclesSaved: this.getCyclesSaved(load),
        bytesSaved: this.getBytesSaved(load),
        address: store.operand,
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    // Keep only the STA - A still has the correct value
    return [match.matchedInstructions[0]];
  }

  /**
   * Check if two instructions reference the same memory address
   */
  protected sameAddress(a: AsmInstruction, b: AsmInstruction): boolean {
    // Must have same addressing mode
    if (a.addressingMode !== b.addressingMode) return false;

    // Compare operands
    if (a.operand !== b.operand) return false;

    // For indexed modes, must have same index register
    // (zeroPage,X vs zeroPage,Y would be different)
    if (a.addressingMode.includes(',')) {
      // Both have same mode already, so same index register
      return true;
    }

    return true;
  }

  protected getCyclesSaved(load: AsmInstruction): number {
    switch (load.addressingMode) {
      case 'zeroPage': return 3;
      case 'absolute': return 4;
      case 'zeroPageX':
      case 'zeroPageY': return 4;
      case 'absoluteX':
      case 'absoluteY': return 4; // +1 if page crossed
      default: return 3;
    }
  }

  protected getBytesSaved(load: AsmInstruction): number {
    switch (load.addressingMode) {
      case 'zeroPage':
      case 'zeroPageX':
      case 'zeroPageY': return 2;
      case 'absolute':
      case 'absoluteX':
      case 'absoluteY': return 3;
      default: return 2;
    }
  }
}
```

### Test Cases

```typescript
describe('StoreLoadEliminationPattern', () => {
  it('removes LDA after STA to same zero-page address', () => {
    const input = [
      { opcode: AsmOpcode.LDA, addressingMode: 'immediate', operand: 0x05 },
      { opcode: AsmOpcode.STA, addressingMode: 'zeroPage', operand: 0x50 },
      { opcode: AsmOpcode.LDA, addressingMode: 'zeroPage', operand: 0x50 },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2);
    expect(result[0].opcode).toBe(AsmOpcode.LDA);
    expect(result[1].opcode).toBe(AsmOpcode.STA);
    // LDA $50 removed!
  });

  it('removes LDA after STA to same absolute address', () => {
    const input = [
      { opcode: AsmOpcode.STA, addressingMode: 'absolute', operand: 0x1000 },
      { opcode: AsmOpcode.LDA, addressingMode: 'absolute', operand: 0x1000 },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(1);
  });

  it('preserves LDA from different address', () => {
    const input = [
      { opcode: AsmOpcode.STA, addressingMode: 'zeroPage', operand: 0x50 },
      { opcode: AsmOpcode.LDA, addressingMode: 'zeroPage', operand: 0x51 },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2); // No change
  });

  it('preserves LDA with label (jump target)', () => {
    const input = [
      { opcode: AsmOpcode.STA, addressingMode: 'zeroPage', operand: 0x50 },
      { opcode: AsmOpcode.LDA, addressingMode: 'zeroPage', operand: 0x50, label: 'reload' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2); // Preserve - it's a jump target
  });
});
```

---

## 2. Dead Load Elimination

### The Problem

A load is immediately overwritten by another load:

```asm
; CURRENT BROKEN OUTPUT
LDA _data                   ; ← DEAD! Immediately overwritten
LDA #$05                    ; This is the real value we want
```

### Implementation

```typescript
/**
 * Pattern: Dead Load Elimination
 * 
 * Match: LDA x; LDA y (second load overwrites first)
 * Replace: LDA y
 * 
 * THIS FIXES THE FIRST LINE OF main.asm
 */
export class DeadLoadPattern implements Pattern<AsmInstruction> {
  readonly name = 'dead-load';
  readonly priority = 95;
  readonly category = 'load-store';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 1 >= instructions.length) return null;

    const first = instructions[index];
    const second = instructions[index + 1];

    // Both must be LDA
    if (first.opcode !== AsmOpcode.LDA) return null;
    if (second.opcode !== AsmOpcode.LDA) return null;

    // First must not be a jump target
    if (first.label) return null;

    // Second must not have a label (it will inherit any important label from first)
    // Actually, we remove first, so second's label status is fine

    return {
      matchedInstructions: [first, second],
      startIndex: index,
      length: 2,
      metadata: {
        patternName: this.name,
        reason: 'First LDA immediately overwritten by second LDA',
        cyclesSaved: this.getCycles(first),
        bytesSaved: this.getBytes(first),
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    const first = match.matchedInstructions[0];
    const second = match.matchedInstructions[1];

    // Keep only second, but preserve first's label if any
    if (first.label && !second.label) {
      return [{ ...second, label: first.label }];
    }
    return [second];
  }

  protected getCycles(inst: AsmInstruction): number {
    switch (inst.addressingMode) {
      case 'immediate': return 2;
      case 'zeroPage': return 3;
      case 'absolute': return 4;
      default: return 3;
    }
  }

  protected getBytes(inst: AsmInstruction): number {
    switch (inst.addressingMode) {
      case 'immediate':
      case 'zeroPage': return 2;
      case 'absolute': return 3;
      default: return 2;
    }
  }
}
```

### Test Cases

```typescript
describe('DeadLoadPattern', () => {
  it('removes first LDA when immediately followed by another LDA', () => {
    // This is exactly the main.asm pattern!
    const input = [
      { opcode: AsmOpcode.LDA, addressingMode: 'absolute', operand: '_data' },
      { opcode: AsmOpcode.LDA, addressingMode: 'immediate', operand: 0x05 },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(1);
    expect(result[0].operand).toBe(0x05);
  });

  it('preserves label on first LDA by moving to second', () => {
    const input = [
      { opcode: AsmOpcode.LDA, addressingMode: 'immediate', operand: 0, label: 'start' },
      { opcode: AsmOpcode.LDA, addressingMode: 'immediate', operand: 5 },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('start');
    expect(result[0].operand).toBe(5);
  });
});
```

---

## 3. Load-Load Elimination (Same Value)

### The Problem

Loading the same value twice:

```asm
LDA $50                     ; Load counter
...                         ; (no A modification)
LDA $50                     ; ← REDUNDANT if A unchanged
```

### Implementation

```typescript
/**
 * Pattern: Redundant Load of Same Address
 * 
 * Match: LDA addr; ...(no A mod)...; LDA addr
 * Replace: LDA addr; ...
 * 
 * Note: This requires tracking A modifications between loads
 */
export class RedundantLoadPattern implements Pattern<AsmInstruction> {
  readonly name = 'redundant-load';
  readonly priority = 85;
  readonly category = 'load-store';

  /** Instructions that modify the accumulator */
  protected readonly A_MODIFIERS = new Set([
    AsmOpcode.LDA, AsmOpcode.TXA, AsmOpcode.TYA,
    AsmOpcode.PLA, AsmOpcode.AND, AsmOpcode.ORA,
    AsmOpcode.EOR, AsmOpcode.ADC, AsmOpcode.SBC,
    AsmOpcode.ASL, AsmOpcode.LSR, AsmOpcode.ROL,
    AsmOpcode.ROR, AsmOpcode.INC, AsmOpcode.DEC,
  ]);

  /** Instructions that might modify memory */
  protected readonly MEM_WRITERS = new Set([
    AsmOpcode.STA, AsmOpcode.STX, AsmOpcode.STY,
    AsmOpcode.INC, AsmOpcode.DEC,
    AsmOpcode.ASL, AsmOpcode.LSR, AsmOpcode.ROL, AsmOpcode.ROR,
  ]);

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    const first = instructions[index];
    if (first.opcode !== AsmOpcode.LDA) return null;

    // Look for another LDA to the same address without A modification
    for (let i = index + 1; i < Math.min(index + 10, instructions.length); i++) {
      const inst = instructions[i];

      // Stop at control flow
      if (this.isControlFlow(inst.opcode)) break;

      // Stop at labels (jump targets)
      if (inst.label) break;

      // If A is modified, we can't optimize
      if (this.A_MODIFIERS.has(inst.opcode)) break;

      // If the memory location might be modified, we can't optimize
      if (this.mightModifyLocation(inst, first)) break;

      // Found another LDA to same address!
      if (inst.opcode === AsmOpcode.LDA && this.sameAddress(first, inst)) {
        const between = instructions.slice(index, i + 1);
        return {
          matchedInstructions: between,
          startIndex: index,
          length: between.length,
          metadata: {
            patternName: this.name,
            reason: 'Redundant reload of same address with no A modification',
            cyclesSaved: this.getCycles(inst),
            bytesSaved: this.getBytes(inst),
          }
        };
      }
    }

    return null;
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    // Remove the last instruction (the redundant LDA)
    return match.matchedInstructions.slice(0, -1);
  }

  protected isControlFlow(opcode: AsmOpcode): boolean {
    return opcode === AsmOpcode.JMP || opcode === AsmOpcode.JSR ||
           opcode === AsmOpcode.RTS || opcode === AsmOpcode.RTI ||
           opcode.toString().startsWith('B');
  }

  protected mightModifyLocation(inst: AsmInstruction, load: AsmInstruction): boolean {
    if (!this.MEM_WRITERS.has(inst.opcode)) return false;
    return this.sameAddress(inst, load);
  }

  protected sameAddress(a: AsmInstruction, b: AsmInstruction): boolean {
    return a.addressingMode === b.addressingMode && a.operand === b.operand;
  }

  protected getCycles(inst: AsmInstruction): number {
    switch (inst.addressingMode) {
      case 'immediate': return 2;
      case 'zeroPage': return 3;
      case 'absolute': return 4;
      default: return 3;
    }
  }

  protected getBytes(inst: AsmInstruction): number {
    switch (inst.addressingMode) {
      case 'immediate':
      case 'zeroPage': return 2;
      case 'absolute': return 3;
      default: return 2;
    }
  }
}
```

---

## 4. Store-Store Elimination

### The Problem

Storing to the same location twice without an intervening load:

```asm
STA $50                     ; Store value 1
...                         ; (no LDA $50)
STA $50                     ; ← First store is dead!
```

### Implementation

```typescript
/**
 * Pattern: Dead Store Elimination
 * 
 * Match: STA addr; ...(no load from addr)...; STA addr
 * Replace: ...; STA addr (remove first store)
 */
export class DeadStorePattern implements Pattern<AsmInstruction> {
  readonly name = 'dead-store';
  readonly priority = 80;
  readonly category = 'load-store';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    const first = instructions[index];
    if (first.opcode !== AsmOpcode.STA) return null;
    if (first.label) return null; // Don't remove jump targets

    // Look for another STA to the same address without intervening read
    for (let i = index + 1; i < Math.min(index + 15, instructions.length); i++) {
      const inst = instructions[i];

      // Stop at control flow
      if (this.isControlFlow(inst.opcode)) break;

      // Stop at labels
      if (inst.label) break;

      // If we read from this address, first store is needed
      if (this.readsFromAddress(inst, first)) break;

      // Found another STA to same address!
      if (inst.opcode === AsmOpcode.STA && this.sameAddress(first, inst)) {
        const between = instructions.slice(index, i + 1);
        return {
          matchedInstructions: between,
          startIndex: index,
          length: between.length,
          metadata: {
            patternName: this.name,
            reason: 'First store overwritten without intervening read',
            cyclesSaved: this.getCycles(first),
            bytesSaved: this.getBytes(first),
          }
        };
      }
    }

    return null;
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    // Remove the first instruction (the dead store)
    return match.matchedInstructions.slice(1);
  }

  protected isControlFlow(opcode: AsmOpcode): boolean {
    return opcode === AsmOpcode.JMP || opcode === AsmOpcode.JSR ||
           opcode === AsmOpcode.RTS || opcode === AsmOpcode.RTI ||
           opcode.toString().startsWith('B');
  }

  protected readsFromAddress(inst: AsmInstruction, store: AsmInstruction): boolean {
    const READERS = new Set([
      AsmOpcode.LDA, AsmOpcode.LDX, AsmOpcode.LDY,
      AsmOpcode.CMP, AsmOpcode.CPX, AsmOpcode.CPY,
      AsmOpcode.AND, AsmOpcode.ORA, AsmOpcode.EOR,
      AsmOpcode.ADC, AsmOpcode.SBC, AsmOpcode.BIT,
    ]);
    if (!READERS.has(inst.opcode)) return false;
    return this.sameAddress(inst, store);
  }

  protected sameAddress(a: AsmInstruction, b: AsmInstruction): boolean {
    return a.addressingMode === b.addressingMode && a.operand === b.operand;
  }

  protected getCycles(inst: AsmInstruction): number {
    switch (inst.addressingMode) {
      case 'zeroPage': return 3;
      case 'absolute': return 4;
      default: return 3;
    }
  }

  protected getBytes(inst: AsmInstruction): number {
    switch (inst.addressingMode) {
      case 'zeroPage': return 2;
      case 'absolute': return 3;
      default: return 2;
    }
  }
}
```

---

## 5. X/Y Register Load-Store Patterns

### STX/LDX and STY/LDY Elimination

The same patterns apply to X and Y registers:

```typescript
/**
 * Pattern: STX followed by LDX from same address
 */
export class StoreLoadXPattern implements Pattern<AsmInstruction> {
  readonly name = 'store-load-x';
  readonly priority = 98;
  readonly category = 'load-store';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 1 >= instructions.length) return null;

    const store = instructions[index];
    const load = instructions[index + 1];

    if (store.opcode !== AsmOpcode.STX) return null;
    if (load.opcode !== AsmOpcode.LDX) return null;
    if (store.addressingMode !== load.addressingMode) return null;
    if (store.operand !== load.operand) return null;
    if (load.label) return null;

    return {
      matchedInstructions: [store, load],
      startIndex: index,
      length: 2,
      metadata: {
        patternName: this.name,
        reason: 'LDX after STX to same address - X already has value',
        cyclesSaved: 3,
        bytesSaved: 2,
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    return [match.matchedInstructions[0]];
  }
}

/**
 * Pattern: STY followed by LDY from same address
 */
export class StoreLoadYPattern implements Pattern<AsmInstruction> {
  readonly name = 'store-load-y';
  readonly priority = 98;
  readonly category = 'load-store';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 1 >= instructions.length) return null;

    const store = instructions[index];
    const load = instructions[index + 1];

    if (store.opcode !== AsmOpcode.STY) return null;
    if (load.opcode !== AsmOpcode.LDY) return null;
    if (store.addressingMode !== load.addressingMode) return null;
    if (store.operand !== load.operand) return null;
    if (load.label) return null;

    return {
      matchedInstructions: [store, load],
      startIndex: index,
      length: 2,
      metadata: {
        patternName: this.name,
        reason: 'LDY after STY to same address - Y already has value',
        cyclesSaved: 3,
        bytesSaved: 2,
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    return [match.matchedInstructions[0]];
  }
}
```

---

## 6. Hardware Register Awareness

### The Problem

Hardware registers can change between reads (VIC, SID, CIA). We must NOT optimize loads from these:

```asm
LDA $D012                   ; Read raster line
...
LDA $D012                   ; ← NOT REDUNDANT! Raster line changed!
```

### Implementation

```typescript
/**
 * Memory ranges that are volatile (hardware registers)
 * These MUST NOT be optimized for redundant loads
 */
export const VOLATILE_RANGES: Array<{ start: number; end: number; name: string }> = [
  { start: 0xD000, end: 0xD3FF, name: 'VIC-II' },
  { start: 0xD400, end: 0xD7FF, name: 'SID' },
  { start: 0xD800, end: 0xDBFF, name: 'Color RAM' },
  { start: 0xDC00, end: 0xDCFF, name: 'CIA1' },
  { start: 0xDD00, end: 0xDDFF, name: 'CIA2' },
];

/**
 * Check if an address is volatile (hardware register)
 */
export function isVolatileAddress(address: number): boolean {
  return VOLATILE_RANGES.some(range => 
    address >= range.start && address <= range.end
  );
}

/**
 * Pattern context with volatility awareness
 */
export interface AsmPatternContext extends PatternContext {
  /** Check if address is volatile (hardware) */
  isVolatile(address: number | string): boolean;
}

/**
 * Default context implementation
 */
export function createAsmPatternContext(): AsmPatternContext {
  return {
    isVolatile(address: number | string): boolean {
      if (typeof address === 'number') {
        return isVolatileAddress(address);
      }
      // Symbol names - check for known hardware patterns
      const volatileSymbols = ['_vic', '_sid', '_cia', 'VIC_', 'SID_', 'CIA_'];
      return volatileSymbols.some(prefix => 
        address.toUpperCase().includes(prefix.toUpperCase())
      );
    }
  };
}
```

### Updated RedundantLoadPattern with Volatility Check

```typescript
export class RedundantLoadPattern implements Pattern<AsmInstruction> {
  // ... existing code ...

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    const first = instructions[index];
    if (first.opcode !== AsmOpcode.LDA) return null;

    // CRITICAL: Don't optimize volatile (hardware) addresses!
    const asmContext = context as AsmPatternContext;
    if (asmContext.isVolatile?.(first.operand)) return null;

    // ... rest of matching logic ...
  }
}
```

---

## Pattern Summary

| Pattern | Match | Replace | Cycles | Bytes | Priority |
|---------|-------|---------|--------|-------|----------|
| `store-load-elimination` | STA $x; LDA $x | STA $x | 3-4 | 2-3 | 100 |
| `dead-load` | LDA x; LDA y | LDA y | 2-4 | 2-3 | 95 |
| `store-load-x` | STX $x; LDX $x | STX $x | 3 | 2 | 98 |
| `store-load-y` | STY $x; LDY $x | STY $x | 3 | 2 | 98 |
| `redundant-load` | LDA $x; ...; LDA $x | LDA $x; ... | 3-4 | 2-3 | 85 |
| `dead-store` | STA $x; ...; STA $x | ...; STA $x | 3-4 | 2-3 | 80 |

---

## main.asm Before and After

### Before Optimization

```asm
; main.asm (current broken output)
LDA _data                   ; DEAD - immediately overwritten
LDA #$05                    ; v2 = 5
STA $50                     ; Store len
LDA $50                     ; REDUNDANT - A already has $05
STA $D020                   ; Set border color
```

### After Phase 5 Optimization

```asm
; main.asm (optimized)
LDA #$05                    ; v2 = 5
STA $50                     ; Store len (A still = $05)
STA $D020                   ; Set border color
```

**Results:**
- **2 instructions removed**
- **6+ cycles saved**
- **4+ bytes saved**

---

## Test Count

| Category | Tests |
|----------|-------|
| StoreLoadEliminationPattern | 20 |
| DeadLoadPattern | 15 |
| StoreLoadXPattern | 10 |
| StoreLoadYPattern | 10 |
| RedundantLoadPattern | 15 |
| DeadStorePattern | 12 |
| Volatility handling | 8 |
| **Total** | **90** |

---

## Integration

```typescript
// packages/compiler/src/asm-il/optimizer/passes/index.ts

export { 
  StoreLoadEliminationPattern, 
  DeadLoadPattern,
  RedundantLoadPattern,
  DeadStorePattern,
} from './load-store.js';

export {
  StoreLoadXPattern,
  StoreLoadYPattern,
} from './load-store-xy.js';

export {
  isVolatileAddress,
  VOLATILE_RANGES,
  createAsmPatternContext,
} from './volatility.js';
```

---

**Parent Document**: [Phase Index](00-phase-index.md)  
**Previous Document**: [01 - Flag Patterns](01-flag-patterns.md)  
**Next Document**: [03 - Branch Patterns](03-branch-patterns.md)