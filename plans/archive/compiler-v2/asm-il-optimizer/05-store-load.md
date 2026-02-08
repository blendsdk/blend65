# Store-Load Elimination Pass: ASM-IL Optimizer

> **Document**: 05-store-load.md
> **Parent**: [Index](00-index.md)
> **Pass**: `StoreLoadPass`
> **Enabled**: O1, O2, O3, Os, Oz

## Overview

The Store-Load Elimination Pass removes redundant load instructions when the value is already in a register. This is one of the most impactful optimizations for compiler-generated code.

**The #1 pattern that FIXES compiler output quality!**

## Patterns

### Pattern 1: STA/LDA Same Address

```asm
; BEFORE - Load immediately after store to same address
STA $50                     ; Store A to memory
LDA $50                     ; REDUNDANT - A still has the value!

; AFTER
STA $50                     ; A still has the value
```

**Rule**: Remove `LDA addr` if:
- Immediately follows `STA addr` (same address)
- No intervening instructions that modify A or the memory address

### Pattern 2: STX/LDX Same Address

```asm
; BEFORE
STX $50                     ; Store X to memory
LDX $50                     ; REDUNDANT - X still has the value!

; AFTER
STX $50
```

### Pattern 3: STY/LDY Same Address

```asm
; BEFORE
STY $50                     ; Store Y to memory
LDY $50                     ; REDUNDANT - Y still has the value!

; AFTER
STY $50
```

### Pattern 4: Store-Other-Load Pattern

```asm
; BEFORE - Load after store with intervening non-aliasing instructions
STA $50
INX                         ; Doesn't affect A or $50
INY                         ; Doesn't affect A or $50
LDA $50                     ; REDUNDANT - A unchanged, $50 unchanged

; AFTER
STA $50
INX
INY
; LDA removed
```

### Pattern 5: Cross-Register Store-Load

```asm
; BEFORE - Different register loads same address
STA $50
LDX $50                     ; NOT REDUNDANT - different register!

; Keep as-is (unless we track that X = A)
```

## Implementation

```typescript
import type { AsmModule, AsmInstruction, AsmItem } from '../../types.js';
import type { AsmOptimizationPass } from '../types.js';
import { isAsmInstruction, AddressingMode } from '../../types.js';
import { AddressAnalyzer } from '../analysis/address-analyzer.js';

/**
 * Eliminates redundant loads after stores
 * 
 * Pattern: STA $addr; LDA $addr → STA $addr
 * (when A hasn't been modified and $addr hasn't been written)
 */
export class StoreLoadPass implements AsmOptimizationPass {
  readonly name = 'store-load';
  readonly isTransform = true;

  protected readonly addressAnalyzer = new AddressAnalyzer();

  run(module: AsmModule): AsmModule {
    const items = module.items;
    const newItems: AsmItem[] = [];
    let changed = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Only process instructions
      if (!isAsmInstruction(item)) {
        newItems.push(item);
        continue;
      }

      // Check if this is a redundant load
      if (this.isRedundantLoad(item, items, i)) {
        changed = true;
        continue; // Skip this instruction
      }

      newItems.push(item);
    }

    if (!changed) {
      return module; // No changes
    }

    return {
      ...module,
      items: newItems,
    };
  }

  /**
   * Check if a load instruction is redundant
   */
  protected isRedundantLoad(
    instr: AsmInstruction,
    items: readonly AsmItem[],
    index: number
  ): boolean {
    // Must be a load instruction with memory operand
    if (!['LDA', 'LDX', 'LDY'].includes(instr.mnemonic)) {
      return false;
    }

    // Must be a memory-addressing mode (not immediate)
    if (instr.mode === AddressingMode.Immediate) {
      return false;
    }

    // Get the register being loaded
    const register = instr.mnemonic.charAt(2); // 'A', 'X', or 'Y'
    const storeOp = 'ST' + register; // 'STA', 'STX', or 'STY'

    // Look backwards for a matching store
    for (let i = index - 1; i >= 0; i--) {
      const prev = items[i];

      // Skip non-instructions
      if (!isAsmInstruction(prev)) {
        // Labels break the analysis (could be jumped to)
        if (prev.kind === 'label') {
          return false;
        }
        continue;
      }

      // Found matching store to same address?
      if (prev.mnemonic === storeOp && this.sameOperand(prev, instr)) {
        return true; // Redundant!
      }

      // Does this instruction modify the register?
      if (this.modifiesRegister(prev, register)) {
        return false; // Register changed, not redundant
      }

      // Does this instruction modify the memory address?
      if (this.couldModifyAddress(prev, instr.operand)) {
        return false; // Memory might have changed
      }

      // Control flow breaks analysis
      if (this.isControlFlow(prev)) {
        return false;
      }
    }

    return false; // No matching store found
  }

  /**
   * Check if two instructions have the same operand
   */
  protected sameOperand(a: AsmInstruction, b: AsmInstruction): boolean {
    // Mode must match
    if (a.mode !== b.mode) return false;

    // Operand must match
    return a.operand === b.operand;
  }

  /**
   * Check if an instruction modifies a register
   */
  protected modifiesRegister(instr: AsmInstruction, register: string): boolean {
    switch (register) {
      case 'A':
        return [
          'LDA', 'TXA', 'TYA', 'PLA',
          'ADC', 'SBC', 'AND', 'ORA', 'EOR',
          'ASL', 'LSR', 'ROL', 'ROR',
        ].includes(instr.mnemonic) ||
        (instr.mnemonic === 'ASL' && instr.mode === AddressingMode.Accumulator) ||
        (instr.mnemonic === 'LSR' && instr.mode === AddressingMode.Accumulator) ||
        (instr.mnemonic === 'ROL' && instr.mode === AddressingMode.Accumulator) ||
        (instr.mnemonic === 'ROR' && instr.mode === AddressingMode.Accumulator);

      case 'X':
        return ['LDX', 'TAX', 'TSX', 'INX', 'DEX'].includes(instr.mnemonic);

      case 'Y':
        return ['LDY', 'TAY', 'INY', 'DEY'].includes(instr.mnemonic);

      default:
        return false;
    }
  }

  /**
   * Check if an instruction could modify a memory address
   */
  protected couldModifyAddress(
    instr: AsmInstruction,
    addr: number | string | undefined
  ): boolean {
    if (addr === undefined) return false;

    // Store instructions modify memory
    const storeOps = ['STA', 'STX', 'STY', 'INC', 'DEC', 'ASL', 'LSR', 'ROL', 'ROR'];
    if (!storeOps.includes(instr.mnemonic)) {
      return false;
    }

    // For memory-modify ops (INC, DEC, etc.), check if same address
    if (instr.operand === undefined) return false;
    
    return this.addressAnalyzer.couldAlias(instr.operand, addr);
  }

  protected isControlFlow(instr: AsmInstruction): boolean {
    return [
      'JMP', 'JSR', 'RTS', 'RTI', 'BRK',
      'BCC', 'BCS', 'BEQ', 'BNE',
      'BMI', 'BPL', 'BVC', 'BVS',
    ].includes(instr.mnemonic);
  }
}
```

## Edge Cases

### Case 1: Intervening Store to Same Address

```asm
; DO NOT remove - memory changed!
STA $50
STX $50                     ; Memory changed by STX!
LDA $50                     ; NOT redundant - value is now X, not A
```

### Case 2: Indexed Addressing

```asm
; Conservative - different modes might alias
STA $50
LDA $50,X                   ; Different addressing mode - might be different address
```

For safety, only optimize when modes match exactly.

### Case 3: Indirect Addressing

```asm
; Cannot optimize - indirect could point anywhere
STA ($50),Y
LDA ($50),Y                 ; Keep - pointer might have changed
```

### Case 4: JSR in Between

```asm
; DO NOT remove - JSR might modify memory
STA $50
JSR some_function           ; Could modify $50!
LDA $50                     ; NOT redundant
```

### Case 5: Register Modified

```asm
; DO NOT remove - A was modified
STA $50
ADC #1                      ; A changed!
LDA $50                     ; NOT redundant - restores original value
```

## Testing Requirements

### Unit Tests

```typescript
describe('StoreLoadPass', () => {
  describe('basic patterns', () => {
    it('removes LDA after STA to same address', () => {
      const input = createModule([
        instr('STA', 'zeroPage', 0x50),
        instr('LDA', 'zeroPage', 0x50),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(1);
      expect(getInstr(output, 0).mnemonic).toBe('STA');
    });

    it('removes LDX after STX to same address', () => {
      const input = createModule([
        instr('STX', 'zeroPage', 0x50),
        instr('LDX', 'zeroPage', 0x50),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(1);
    });

    it('removes LDY after STY to same address', () => {
      const input = createModule([
        instr('STY', 'absolute', 0x0400),
        instr('LDY', 'absolute', 0x0400),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(1);
    });
  });

  describe('intervening instructions', () => {
    it('removes load with non-aliasing instructions between', () => {
      const input = createModule([
        instr('STA', 'zeroPage', 0x50),
        instr('INX'),
        instr('INY'),
        instr('LDA', 'zeroPage', 0x50),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(3); // LDA removed
    });

    it('keeps load when register modified between', () => {
      const input = createModule([
        instr('STA', 'zeroPage', 0x50),
        instr('ADC', 'immediate', 1),
        instr('LDA', 'zeroPage', 0x50),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(3); // LDA kept
    });

    it('keeps load when memory modified between', () => {
      const input = createModule([
        instr('STA', 'zeroPage', 0x50),
        instr('INC', 'zeroPage', 0x50),
        instr('LDA', 'zeroPage', 0x50),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(3); // LDA kept
    });
  });

  describe('different addresses', () => {
    it('keeps load to different address', () => {
      const input = createModule([
        instr('STA', 'zeroPage', 0x50),
        instr('LDA', 'zeroPage', 0x51),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(2); // Different address
    });

    it('keeps load with different addressing mode', () => {
      const input = createModule([
        instr('STA', 'zeroPage', 0x50),
        instr('LDA', 'absolute', 0x0050),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(2); // Different mode
    });
  });

  describe('cross-register', () => {
    it('keeps LDX after STA (different registers)', () => {
      const input = createModule([
        instr('STA', 'zeroPage', 0x50),
        instr('LDX', 'zeroPage', 0x50),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(2); // Different registers
    });
  });

  describe('control flow', () => {
    it('keeps load after JSR', () => {
      const input = createModule([
        instr('STA', 'zeroPage', 0x50),
        instr('JSR', 'absolute', 'some_fn'),
        instr('LDA', 'zeroPage', 0x50),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(3); // JSR might modify memory
    });
  });
});
```

## Performance Impact

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| STA/LDA ZP | Very Common | 3 | 2 |
| STA/LDA Abs | Very Common | 4 | 3 |
| STX/LDX | Common | 3-4 | 2-3 |
| STY/LDY | Common | 3-4 | 2-3 |

**Expected Impact**: 10-25% reduction in load instructions.

**This is the optimization that fixes ugly compiler output!**