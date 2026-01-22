# Task 8.8d.2a: Swap and Rotation Idiom Patterns

> **Task**: 8.8d.2a of 29 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~15 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement peephole patterns for swap and rotation idioms on the 6502. These patterns optimize common register/memory exchange operations and bit rotation sequences.

**Patterns in this document:**
- XOR swap optimization
- Register swap via stack
- Multi-byte rotation idioms

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                       # Pattern exports
└── combining-idioms-swap.ts       # THIS TASK
```

---

## 6502 Instruction Background

### Stack Instructions
| Instruction | Bytes | Cycles | Flags |
|-------------|-------|--------|-------|
| PHA         | 1     | 3      | -     |
| PLA         | 1     | 4      | N, Z  |
| PHP         | 1     | 3      | -     |
| PLP         | 1     | 4      | All   |

### Rotation Instructions
| Instruction | Bytes | Cycles | Flags |
|-------------|-------|--------|-------|
| ROL A       | 1     | 2      | N, Z, C |
| ROR A       | 1     | 2      | N, Z, C |
| ROL zp      | 2     | 5      | N, Z, C |
| ROR zp      | 2     | 5      | N, Z, C |
| ASL A       | 1     | 2      | N, Z, C |
| LSR A       | 1     | 2      | N, Z, C |

### Logical Instructions
| Instruction | Bytes | Cycles | Flags |
|-------------|-------|--------|-------|
| EOR #imm    | 2     | 2      | N, Z  |
| EOR zp      | 2     | 3      | N, Z  |

---

## Implementation

### File: `combining-idioms-swap.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: XOR swap using three EOR operations
 * 
 * XOR swap algorithm swaps A and memory without temporary:
 * 
 * Before:
 *   LDA $a
 *   EOR $b        ; A = A ^ B
 *   STA $a        ; a = A ^ B
 *   EOR $b        ; A = (A ^ B) ^ B = A
 *   STA $b        ; b = original A
 *   LDA $a
 *   EOR $b        ; A = (A ^ B) ^ A = B
 *   STA $a        ; a = original B
 * 
 * The XOR swap is rarely better than temp-based swap on 6502.
 * Detect and replace with more efficient stack-based swap.
 * 
 * After (stack-based, more efficient):
 *   LDA $a
 *   PHA           ; Save A on stack
 *   LDA $b
 *   STA $a        ; a = b
 *   PLA
 *   STA $b        ; b = original a
 * 
 * Saves: ~8 cycles (XOR swap: ~26 cycles → Stack swap: ~18 cycles)
 */
export class XorSwapIdiomPattern extends BasePattern {
  readonly id = 'xor-swap-idiom';
  readonly description = 'Replace XOR swap with stack-based swap';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 8;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 8) return null;
    
    // Match XOR swap pattern: LDA/EOR/STA/EOR/STA/LDA/EOR/STA
    const [lda1, eor1, sta1, eor2, sta2, lda2, eor3, sta3] = instructions;
    
    // Check: LDA $a
    if (!this.isLoadAccumulator(lda1)) return null;
    const addrA = this.getAddress(lda1);
    
    // Check: EOR $b
    if (!this.isExclusiveOr(eor1)) return null;
    const addrB = this.getAddress(eor1);
    if (addrA === addrB) return null; // Must be different addresses
    
    // Check: STA $a
    if (!this.isStoreAccumulator(sta1)) return null;
    if (this.getAddress(sta1) !== addrA) return null;
    
    // Check: EOR $b
    if (!this.isExclusiveOr(eor2)) return null;
    if (this.getAddress(eor2) !== addrB) return null;
    
    // Check: STA $b
    if (!this.isStoreAccumulator(sta2)) return null;
    if (this.getAddress(sta2) !== addrB) return null;
    
    // Check: LDA $a
    if (!this.isLoadAccumulator(lda2)) return null;
    if (this.getAddress(lda2) !== addrA) return null;
    
    // Check: EOR $b
    if (!this.isExclusiveOr(eor3)) return null;
    if (this.getAddress(eor3) !== addrB) return null;
    
    // Check: STA $a
    if (!this.isStoreAccumulator(sta3)) return null;
    if (this.getAddress(sta3) !== addrA) return null;
    
    const modeA = lda1.metadata?.get('addressingMode');
    const modeB = eor1.metadata?.get('addressingMode');
    
    return {
      matched: [lda1, eor1, sta1, eor2, sta2, lda2, eor3, sta3],
      captures: this.capture([
        ['addrA', addrA],
        ['addrB', addrB],
        ['modeA', modeA],
        ['modeB', modeB],
      ]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const addrA = match.captures.get('addrA') as string;
    const addrB = match.captures.get('addrB') as string;
    const modeA = match.captures.get('modeA') as string;
    const modeB = match.captures.get('modeB') as string;
    
    // Stack-based swap: LDA a / PHA / LDA b / STA a / PLA / STA b
    const lda1 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: modeA,
      address: addrA,
    });
    
    const pha = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'PHA',
    });
    
    const lda2 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: modeB,
      address: addrB,
    });
    
    const sta1 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'STA',
      addressingMode: modeA,
      address: addrA,
    });
    
    const pla = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'PLA',
    });
    
    const sta2 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'STA',
      addressingMode: modeB,
      address: addrB,
    });
    
    return {
      instructions: [lda1, pha, lda2, sta1, pla, sta2],
      cyclesSaved: 8,  // XOR: ~26 cycles → Stack: ~18 cycles
      bytesSaved: 2,   // XOR: 16 bytes → Stack: 14 bytes (zp mode)
    };
  }
  
  protected isLoadAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isExclusiveOr(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'EOR') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
}

/**
 * Pattern: Inefficient register swap using temp variable
 * 
 * Before (using temp):
 *   STA $temp
 *   TXA
 *   TAY          ; or STX somewhere
 *   LDA $temp
 *   TAX
 * 
 * After (direct stack swap):
 *   PHA
 *   TXA
 *   TAY
 *   PLA
 *   TAX
 * 
 * Or for A/X swap specifically:
 *   TAY          ; Save A in Y
 *   TXA          ; Move X to A
 *   TAX          ; Now X has original A value? No...
 * 
 * Better: Use stack
 *   PHA          ; Save A
 *   TXA          ; A = X
 *   TAX          ; Put in temp
 *   PLA          ; Get original A
 *   
 * Best for A↔X swap:
 *   STA $temp
 *   TXA
 *   LDX $temp
 * 
 * Saves: Variable (depends on addressing mode of temp)
 */
export class RegisterSwapStackPattern extends BasePattern {
  readonly id = 'reg-swap-stack';
  readonly description = 'Optimize A/memory swap using stack';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 5;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 5) return null;
    
    // Pattern: STA temp / LDA other / STA original / LDA temp / STA other
    const [sta1, lda1, sta2, lda2, sta3] = instructions;
    
    // Check: STA $temp
    if (!this.isStoreAccumulator(sta1)) return null;
    const tempAddr = this.getAddress(sta1);
    
    // Check: LDA $other
    if (!this.isLoadAccumulator(lda1)) return null;
    const otherAddr = this.getAddress(lda1);
    if (tempAddr === otherAddr) return null;
    
    // Check: STA to original location (where we loaded from originally)
    // This would be complex to track - simplified pattern
    if (!this.isStoreAccumulator(sta2)) return null;
    
    // Check: LDA $temp
    if (!this.isLoadAccumulator(lda2)) return null;
    if (this.getAddress(lda2) !== tempAddr) return null;
    
    // Check: STA $other
    if (!this.isStoreAccumulator(sta3)) return null;
    if (this.getAddress(sta3) !== otherAddr) return null;
    
    const originalAddr = this.getAddress(sta2);
    const tempMode = sta1.metadata?.get('addressingMode');
    const otherMode = lda1.metadata?.get('addressingMode');
    const origMode = sta2.metadata?.get('addressingMode');
    
    return {
      matched: [sta1, lda1, sta2, lda2, sta3],
      captures: this.capture([
        ['tempAddr', tempAddr],
        ['otherAddr', otherAddr],
        ['originalAddr', originalAddr],
        ['tempMode', tempMode],
        ['otherMode', otherMode],
        ['origMode', origMode],
      ]),
      confidence: 0.75,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const otherAddr = match.captures.get('otherAddr') as string;
    const originalAddr = match.captures.get('originalAddr') as string;
    const otherMode = match.captures.get('otherMode') as string;
    const origMode = match.captures.get('origMode') as string;
    
    // Stack-based: PHA / LDA other / STA original / PLA / STA other
    const pha = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'PHA',
    });
    
    const lda = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: otherMode,
      address: otherAddr,
    });
    
    const sta1 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'STA',
      addressingMode: origMode,
      address: originalAddr,
    });
    
    const pla = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'PLA',
    });
    
    const sta2 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'STA',
      addressingMode: otherMode,
      address: otherAddr,
    });
    
    return {
      instructions: [pha, lda, sta1, pla, sta2],
      cyclesSaved: 2,  // Saves temp variable access
      bytesSaved: 2,   // Removes temp STA/LDA (varies by mode)
    };
  }
  
  protected isLoadAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
}

/**
 * Pattern: 16-bit rotation using separate ROL/ROR instructions
 * 
 * 16-bit left rotation (ROL):
 * Before:
 *   ASL $lo       ; Shift low byte left, bit 7 → carry
 *   ROL $hi       ; Rotate high byte left through carry
 * 
 * This is already optimal! But detect suboptimal variants:
 * 
 * Suboptimal Before:
 *   CLC
 *   LDA $lo
 *   ASL A
 *   STA $lo
 *   LDA $hi
 *   ROL A
 *   STA $hi
 * 
 * After (direct memory operations):
 *   ASL $lo
 *   ROL $hi
 * 
 * Saves: ~12 cycles, ~8 bytes
 */
export class Rotate16BitIdiomPattern extends BasePattern {
  readonly id = 'rot16-idiom';
  readonly description = 'Optimize 16-bit rotation to direct memory ops';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 7;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 6) return null;
    
    // Match suboptimal 16-bit left rotation
    const [ldaLo, aslA, staLo, ldaHi, rolA, staHi] = instructions;
    
    // Check: LDA $lo
    if (!this.isLoadAccumulator(ldaLo)) return null;
    const loAddr = this.getAddress(ldaLo);
    
    // Check: ASL A
    if (!this.isShiftLeftAccum(aslA)) return null;
    
    // Check: STA $lo
    if (!this.isStoreAccumulator(staLo)) return null;
    if (this.getAddress(staLo) !== loAddr) return null;
    
    // Check: LDA $hi
    if (!this.isLoadAccumulator(ldaHi)) return null;
    const hiAddr = this.getAddress(ldaHi);
    
    // Check: ROL A
    if (!this.isRotateLeftAccum(rolA)) return null;
    
    // Check: STA $hi
    if (!this.isStoreAccumulator(staHi)) return null;
    if (this.getAddress(staHi) !== hiAddr) return null;
    
    const addrMode = ldaLo.metadata?.get('addressingMode');
    
    return {
      matched: [ldaLo, aslA, staLo, ldaHi, rolA, staHi],
      captures: this.capture([
        ['loAddr', loAddr],
        ['hiAddr', hiAddr],
        ['addressingMode', addrMode],
      ]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const loAddr = match.captures.get('loAddr') as string;
    const hiAddr = match.captures.get('hiAddr') as string;
    const addrMode = match.captures.get('addressingMode') as string;
    
    // Direct memory: ASL $lo / ROL $hi
    const aslMem = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'ASL',
      addressingMode: addrMode,
      address: loAddr,
    });
    
    const rolMem = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'ROL',
      addressingMode: addrMode,
      address: hiAddr,
    });
    
    return {
      instructions: [aslMem, rolMem],
      cyclesSaved: 12,  // LDA+ASL+STA+LDA+ROL+STA = 18 → ASL+ROL = 10
      bytesSaved: 8,    // 12 bytes → 4 bytes (zp mode)
    };
  }
  
  protected isLoadAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isShiftLeftAccum(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'ASL' &&
           inst.metadata?.get('addressingMode') === 'accumulator';
  }
  
  protected isRotateLeftAccum(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'ROL' &&
           inst.metadata?.get('addressingMode') === 'accumulator';
  }
}

/**
 * Pattern: 16-bit right rotation using separate LSR/ROR
 * 
 * Suboptimal Before:
 *   LDA $hi
 *   LSR A
 *   STA $hi
 *   LDA $lo
 *   ROR A
 *   STA $lo
 * 
 * After (direct memory operations):
 *   LSR $hi
 *   ROR $lo
 * 
 * Saves: ~12 cycles, ~8 bytes
 */
export class Rotate16BitRightIdiomPattern extends BasePattern {
  readonly id = 'rot16-right-idiom';
  readonly description = 'Optimize 16-bit right rotation to direct memory ops';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 6;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 6) return null;
    
    const [ldaHi, lsrA, staHi, ldaLo, rorA, staLo] = instructions;
    
    // Check: LDA $hi
    if (!this.isLoadAccumulator(ldaHi)) return null;
    const hiAddr = this.getAddress(ldaHi);
    
    // Check: LSR A
    if (!this.isShiftRightAccum(lsrA)) return null;
    
    // Check: STA $hi
    if (!this.isStoreAccumulator(staHi)) return null;
    if (this.getAddress(staHi) !== hiAddr) return null;
    
    // Check: LDA $lo
    if (!this.isLoadAccumulator(ldaLo)) return null;
    const loAddr = this.getAddress(ldaLo);
    
    // Check: ROR A
    if (!this.isRotateRightAccum(rorA)) return null;
    
    // Check: STA $lo
    if (!this.isStoreAccumulator(staLo)) return null;
    if (this.getAddress(staLo) !== loAddr) return null;
    
    const addrMode = ldaHi.metadata?.get('addressingMode');
    
    return {
      matched: [ldaHi, lsrA, staHi, ldaLo, rorA, staLo],
      captures: this.capture([
        ['hiAddr', hiAddr],
        ['loAddr', loAddr],
        ['addressingMode', addrMode],
      ]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const hiAddr = match.captures.get('hiAddr') as string;
    const loAddr = match.captures.get('loAddr') as string;
    const addrMode = match.captures.get('addressingMode') as string;
    
    const lsrMem = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LSR',
      addressingMode: addrMode,
      address: hiAddr,
    });
    
    const rorMem = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'ROR',
      addressingMode: addrMode,
      address: loAddr,
    });
    
    return {
      instructions: [lsrMem, rorMem],
      cyclesSaved: 12,
      bytesSaved: 8,
    };
  }
  
  protected isLoadAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isShiftRightAccum(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'LSR' &&
           inst.metadata?.get('addressingMode') === 'accumulator';
  }
  
  protected isRotateRightAccum(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'ROR' &&
           inst.metadata?.get('addressingMode') === 'accumulator';
  }
}

/**
 * Register all swap and rotation idiom patterns
 */
export function registerSwapRotationIdiomPatterns(registry: PatternRegistry): void {
  // Swap idioms
  registry.register(new XorSwapIdiomPattern());
  registry.register(new RegisterSwapStackPattern());
  
  // Rotation idioms
  registry.register(new Rotate16BitIdiomPattern());
  registry.register(new Rotate16BitRightIdiomPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `XorSwap match` | Matches full XOR swap sequence |
| `XorSwap no match partial` | No match for incomplete XOR swap |
| `XorSwap replace` | Creates stack-based swap |
| `XorSwap savings` | Reports 8 cycles, 2 bytes saved |
| `RegSwapStack match` | Matches temp-based swap |
| `RegSwapStack replace` | Creates stack-based swap |
| `RegSwapStack savings` | Reports correct savings |
| `Rot16Left match` | Matches LDA/ASL/STA/LDA/ROL/STA |
| `Rot16Left replace` | Creates ASL mem / ROL mem |
| `Rot16Left savings` | Reports 12 cycles, 8 bytes saved |
| `Rot16Right match` | Matches LDA/LSR/STA/LDA/ROR/STA |
| `Rot16Right replace` | Creates LSR mem / ROR mem |
| `Rot16Right savings` | Reports 12 cycles, 8 bytes saved |
| `register all` | All 4 patterns registered correctly |
| `integration` | Patterns work with matcher |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerSwapRotationIdiomPatterns } from './patterns/combining-idioms-swap.js';

registerSwapRotationIdiomPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| XorSwapIdiomPattern        | ❌ | ✅ | ✅ |
| RegisterSwapStackPattern   | ❌ | ✅ | ✅ |
| Rotate16BitIdiomPattern    | ❌ | ✅ | ✅ |
| Rotate16BitRightIdiomPattern | ❌ | ✅ | ✅ |

### Window Size Summary

| Pattern | Window | Notes |
|---------|--------|-------|
| XorSwap | 8 | Full XOR swap sequence |
| RegSwapStack | 5 | Temp-based swap sequence |
| Rot16Left | 7 | With optional CLC prefix |
| Rot16Right | 6 | LSR/STA/LDA/ROR/STA sequence |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `combining-idioms-swap.ts` | [ ] |
| Implement XorSwapIdiomPattern | [ ] |
| Implement RegisterSwapStackPattern | [ ] |
| Implement Rotate16BitIdiomPattern | [ ] |
| Implement Rotate16BitRightIdiomPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 3.8d.1 → `08-08d1-combining-idioms-core.md`  
**Next Task**: 3.8d.2b → `08-08d2b-combining-idioms-multiply.md`