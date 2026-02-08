# Flag Patterns Pass: ASM-IL Optimizer

> **Document**: 04-flag-patterns.md
> **Parent**: [Index](00-index.md)
> **Pass**: `FlagPatternsPass`
> **Enabled**: O1, O2, O3, Os, Oz

## Overview

The Flag Patterns Pass removes redundant CPU flag operations that are common in compiler-generated 6502 code. It targets:

1. **Dead CLC/SEC** - Carry set/clear with no subsequent read
2. **Redundant CMP #0** - Compare with zero after load (load sets Z flag)
3. **Duplicate flag operations** - Multiple consecutive CLC or SEC

## Patterns

### Pattern 1: Dead CLC (Carry Clear)

```asm
; BEFORE - CLC with no carry read before next carry modification
CLC                         ; Clears carry
LDA value                   ; Does not read carry
STA result                  ; Does not read carry
ADC #5                      ; READS carry - but...

; IF next ADC/SBC/ROL/ROR is after another CLC/SEC/carry-modifier:
CLC                         ; ← DEAD - carry reset before use
LDA value
STA result
CLC                         ; Another CLC
ADC #5                      ; This one uses the second CLC

; AFTER
LDA value
STA result
CLC                         ; Keep only the one that matters
ADC #5
```

**Rule**: Remove CLC if:
- No carry-reading instruction (ADC, SBC, ROL, ROR, BCC, BCS) before:
  - Another CLC/SEC, or
  - A carry-modifying instruction (ASL, LSR, ADC, SBC, etc.)

### Pattern 2: Dead SEC (Carry Set)

```asm
; BEFORE - SEC with no carry read
SEC                         ; Sets carry
LDA value                   ; Does not read carry
STA result                  ; Does not read carry
SEC                         ; Another SEC - first is dead

; AFTER
LDA value
STA result
SEC                         ; Keep only the last one
```

**Rule**: Same as CLC - remove if carry not read before reset.

### Pattern 3: Redundant CMP #0

```asm
; BEFORE - CMP #0 after LDA (LDA already sets Z flag!)
LDA counter                 ; Sets Z=1 if counter==0, Z=0 otherwise
CMP #0                      ; REDUNDANT - Z flag already correct
BEQ done                    ; Branch on Z flag

; AFTER
LDA counter                 ; Z flag already set correctly
BEQ done                    ; Works the same!
```

**Rule**: Remove `CMP #0` if:
- Immediately follows LDA/LDX/LDY (which set Z flag)
- No intervening instructions that modify Z flag
- The Z flag is what's being tested (not carry)

**Important**: CMP also sets the Carry flag for `<` and `>` comparisons. Only remove if testing for equality (BEQ/BNE).

### Pattern 4: Duplicate CLC/SEC

```asm
; BEFORE - Multiple consecutive CLCs
CLC
CLC                         ; REDUNDANT
CLC                         ; REDUNDANT

; AFTER
CLC                         ; Keep only one
```

**Rule**: Remove consecutive duplicate flag instructions.

### Pattern 5: CLC/SEC followed by opposite

```asm
; BEFORE
CLC
SEC                         ; CLC is dead, this is what matters

; AFTER
SEC
```

**Rule**: If SEC follows CLC (or vice versa) with no intervening carry use, remove the first.

## Implementation

```typescript
import type { AsmModule, AsmInstruction, AsmItem } from '../../types.js';
import type { AsmOptimizationPass } from '../types.js';
import { isAsmInstruction } from '../../types.js';
import { FlagStateAnalyzer } from '../analysis/flag-state.js';

/**
 * Removes redundant flag operations
 * 
 * Patterns:
 * - Dead CLC/SEC (carry not read before modification)
 * - Redundant CMP #0 after LDA (LDA sets Z flag)
 * - Duplicate consecutive flag instructions
 */
export class FlagPatternsPass implements AsmOptimizationPass {
  readonly name = 'flag-patterns';
  readonly isTransform = true;

  protected readonly flagAnalyzer = new FlagStateAnalyzer();

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

      // Pattern 3: Redundant CMP #0
      if (this.isRedundantCmpZero(item, items, i)) {
        changed = true;
        continue; // Skip this instruction
      }

      // Pattern 4 & 5: Duplicate/opposite flag instructions
      if (this.isDuplicateOrOppositeFlag(item, items, i)) {
        changed = true;
        continue; // Skip this instruction
      }

      // Pattern 1 & 2: Dead CLC/SEC
      if (this.isDeadFlagSet(item, items, i)) {
        changed = true;
        continue; // Skip this instruction
      }

      newItems.push(item);
    }

    if (!changed) {
      return module; // No changes, return same reference
    }

    // Return new module with filtered items
    return {
      ...module,
      items: newItems,
    };
  }

  /**
   * Check if CMP #0 is redundant after a load
   */
  protected isRedundantCmpZero(
    instr: AsmInstruction,
    items: readonly AsmItem[],
    index: number
  ): boolean {
    // Must be CMP #0
    if (instr.mnemonic !== 'CMP') return false;
    if (instr.mode !== 'immediate') return false;
    if (instr.operand !== 0) return false;

    // Look backwards for a load instruction
    for (let i = index - 1; i >= 0; i--) {
      const prev = items[i];
      if (!isAsmInstruction(prev)) continue;

      // If we hit a load, CMP #0 is redundant
      if (['LDA', 'LDX', 'LDY'].includes(prev.mnemonic)) {
        return true;
      }

      // If we hit anything that modifies Z flag, stop
      if (this.modifiesZeroFlag(prev)) {
        return false;
      }

      // If we hit a label or branch target, stop (control flow)
      // Labels break the analysis
      break;
    }

    return false;
  }

  /**
   * Check if this is a duplicate or opposite flag instruction
   */
  protected isDuplicateOrOppositeFlag(
    instr: AsmInstruction,
    items: readonly AsmItem[],
    index: number
  ): boolean {
    if (!['CLC', 'SEC', 'CLV'].includes(instr.mnemonic)) {
      return false;
    }

    // Look forward for next flag-related instruction
    for (let i = index + 1; i < items.length; i++) {
      const next = items[i];
      if (!isAsmInstruction(next)) continue;

      // Same instruction = duplicate, first is dead
      if (next.mnemonic === instr.mnemonic) {
        return true;
      }

      // Opposite instruction = first is dead
      if (instr.mnemonic === 'CLC' && next.mnemonic === 'SEC') {
        return true;
      }
      if (instr.mnemonic === 'SEC' && next.mnemonic === 'CLC') {
        return true;
      }

      // If we hit an instruction that reads carry, stop
      if (instr.mnemonic !== 'CLV' && this.flagAnalyzer.isCarryRead(next)) {
        return false;
      }

      // If we hit a control flow instruction, stop
      if (this.isControlFlow(next)) {
        return false;
      }

      // If something else modifies carry, first is dead
      if (instr.mnemonic !== 'CLV' && this.modifiesCarry(next)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if CLC/SEC is dead (carry not read before modification)
   */
  protected isDeadFlagSet(
    instr: AsmInstruction,
    items: readonly AsmItem[],
    index: number
  ): boolean {
    if (!['CLC', 'SEC'].includes(instr.mnemonic)) {
      return false;
    }

    // Look forward for carry usage
    for (let i = index + 1; i < items.length; i++) {
      const next = items[i];
      if (!isAsmInstruction(next)) continue;

      // If carry is read, not dead
      if (this.flagAnalyzer.isCarryRead(next)) {
        return false;
      }

      // If carry is modified, this set is dead
      if (this.modifiesCarry(next)) {
        return true;
      }

      // Control flow = stop analysis (conservative)
      if (this.isControlFlow(next)) {
        return false;
      }
    }

    // Reached end without carry use = dead
    return true;
  }

  protected modifiesZeroFlag(instr: AsmInstruction): boolean {
    return [
      'LDA', 'LDX', 'LDY',
      'TAX', 'TAY', 'TXA', 'TYA', 'TSX',
      'AND', 'ORA', 'EOR',
      'ADC', 'SBC',
      'INC', 'INX', 'INY',
      'DEC', 'DEX', 'DEY',
      'ASL', 'LSR', 'ROL', 'ROR',
      'CMP', 'CPX', 'CPY',
      'BIT', 'PLA',
    ].includes(instr.mnemonic);
  }

  protected modifiesCarry(instr: AsmInstruction): boolean {
    return [
      'ADC', 'SBC',
      'ASL', 'LSR', 'ROL', 'ROR',
      'CMP', 'CPX', 'CPY',
      'CLC', 'SEC',
    ].includes(instr.mnemonic);
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

### Case 1: CLC before conditional branch

```asm
; DO NOT remove - carry used by BCS
CLC                         ; Intentional clear
BCS somewhere               ; Tests carry!
```

### Case 2: CLC in loop

```asm
loop:
  CLC                       ; Each iteration needs this
  ADC value
  BNE loop
```

### Case 3: CMP for greater-than comparison

```asm
; DO NOT remove CMP - it sets carry for > comparison
LDA score
CMP #100                    ; Sets C=1 if score >= 100
BCS high_score              ; Branch if >= 100
```

Only remove `CMP #0` when followed by BEQ/BNE (equality test).

## Testing Requirements

### Unit Tests

```typescript
describe('FlagPatternsPass', () => {
  describe('redundant CMP #0', () => {
    it('removes CMP #0 after LDA', () => {
      const input = createModule([
        instr('LDA', 'zeroPage', 0x50),
        instr('CMP', 'immediate', 0),
        instr('BEQ', 'relative', 'done'),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(2); // CMP removed
    });

    it('keeps CMP #0 after ADC', () => {
      const input = createModule([
        instr('ADC', 'immediate', 5),
        instr('CMP', 'immediate', 0),
        instr('BEQ', 'relative', 'done'),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(3); // CMP kept
    });

    it('keeps CMP #n where n != 0', () => {
      const input = createModule([
        instr('LDA', 'zeroPage', 0x50),
        instr('CMP', 'immediate', 10),
        instr('BEQ', 'relative', 'done'),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(3); // CMP kept
    });
  });

  describe('dead CLC/SEC', () => {
    it('removes CLC when carry not read', () => {
      const input = createModule([
        instr('CLC'),
        instr('LDA', 'immediate', 5),
        instr('STA', 'zeroPage', 0x50),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(2); // CLC removed
    });

    it('keeps CLC when followed by ADC', () => {
      const input = createModule([
        instr('CLC'),
        instr('LDA', 'immediate', 5),
        instr('ADC', 'immediate', 3),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(3); // CLC kept
    });
  });

  describe('duplicate flags', () => {
    it('removes consecutive CLC', () => {
      const input = createModule([
        instr('CLC'),
        instr('CLC'),
        instr('ADC', 'immediate', 5),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(2); // One CLC removed
    });

    it('removes CLC before SEC', () => {
      const input = createModule([
        instr('CLC'),
        instr('SEC'),
        instr('SBC', 'immediate', 5),
      ]);
      const output = pass.run(input);
      expect(output.items).toHaveLength(2); // CLC removed
    });
  });
});
```

## Performance Impact

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| Dead CLC | Common | 2 | 1 |
| Dead SEC | Common | 2 | 1 |
| Redundant CMP #0 | Very Common | 2 | 2 |
| Duplicate CLC/SEC | Rare | 2 | 1 |

**Expected Impact**: 5-15% reduction in flag-related instructions.