# Task 8.3b: Load-Store Zero Page Patterns

> **Task**: 8.3b of 14 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~25 tests  
> **Prerequisites**: Tasks 8.1-8.3a (Pattern Framework + Core Load-Store)

---

## Overview

Implement zero page-specific load-store peephole patterns. The 6502 zero page ($00-$FF) provides:
- **Faster access**: 3 cycles vs 4 for absolute addressing
- **Smaller instructions**: 2 bytes vs 3 bytes
- **Special addressing modes**: ZP,X, ZP,Y, (ZP,X), (ZP),Y

---

## 6502 Zero Page Addressing Modes

| Mode | Syntax | Bytes | Cycles | Example |
|------|--------|-------|--------|---------|
| Zero Page | `$nn` | 2 | 3 | `LDA $10` |
| Zero Page,X | `$nn,X` | 2 | 4 | `LDA $10,X` |
| Zero Page,Y | `$nn,Y` | 2 | 4 | `LDX $10,Y` |
| Indirect,X | `($nn,X)` | 2 | 6 | `LDA ($10,X)` |
| Indirect,Y | `($nn),Y` | 2 | 5-6 | `LDA ($10),Y` |

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                   # Pattern exports
├── load-store-core.ts         # Task 8.3a
└── load-store-zeropage.ts     # THIS TASK
```

---

## Implementation

### File: `load-store-zeropage.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode, ILValue } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Check if an address is in zero page range ($00-$FF)
 */
function isZeroPageAddress(value: ILValue | undefined): boolean {
  if (!value) return false;
  
  // Handle immediate/constant values
  if (value.isConstant()) {
    const addr = value.getConstantValue();
    return typeof addr === 'number' && addr >= 0x00 && addr <= 0xFF;
  }
  
  // Handle symbolic addresses with known values
  if (value.metadata?.has('resolvedAddress')) {
    const addr = value.metadata.get('resolvedAddress') as number;
    return addr >= 0x00 && addr <= 0xFF;
  }
  
  return false;
}

/**
 * Pattern: Convert absolute addressing to zero page
 * 
 * Before:
 *   LDA $00nn   ; Absolute addressing (4 cycles, 3 bytes)
 * 
 * After:
 *   LDA $nn     ; Zero page addressing (3 cycles, 2 bytes)
 * 
 * Saves: 1 cycle, 1 byte per instruction
 */
export class AbsoluteToZeroPagePattern extends BasePattern {
  readonly id = 'abs-to-zp';
  readonly description = 'Convert absolute addressing to zero page when address fits';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    // Check: Is a load or store with absolute addressing
    if (!this.isLoadOrStore(inst)) {
      return null;
    }
    
    // Check: Currently using absolute addressing mode
    const addrMode = inst.metadata?.get('addressingMode');
    if (addrMode !== 'absolute') {
      return null;
    }
    
    // Check: Address is in zero page range
    const address = this.getAddressOperand(inst);
    if (!isZeroPageAddress(address)) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([
        ['address', address],
        ['opcode', inst.opcode],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const inst = match.matched[0];
    
    // Create new instruction with zero page addressing mode
    const newInst = this.cloneInstruction(inst, {
      addressingMode: 'zeropage',
    });
    
    return {
      instructions: [newInst],
      cyclesSaved: 1,
      bytesSaved: 1,
    };
  }
  
  /** Get the address operand from load/store instruction */
  protected getAddressOperand(inst: ILInstruction): ILValue | undefined {
    // For loads: address is first operand
    // For stores: address is second operand
    return inst.opcode === ILOpcode.Store 
      ? inst.operands[1] 
      : inst.operands[0];
  }
  
  protected isLoadOrStore(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Load || inst.opcode === ILOpcode.Store;
  }
}

/**
 * Pattern: Zero page STA followed by LDA (same location)
 * 
 * Before:
 *   STA $nn     ; ZP store
 *   LDA $nn     ; ZP load from same address
 * 
 * After:
 *   STA $nn     ; Keep store only
 *   (LDA eliminated - A already has value)
 * 
 * Saves: 3 cycles, 2 bytes
 */
export class ZpStaLdaSamePattern extends BasePattern {
  readonly id = 'zp-sta-lda-same';
  readonly description = 'Remove zero page LDA after STA to same address';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [sta, lda] = instructions;
    
    // Check: STA followed by LDA
    if (!this.isStore(sta) || !this.isLoad(lda)) {
      return null;
    }
    
    // Check: Both use zero page addressing
    const staMode = sta.metadata?.get('addressingMode');
    const ldaMode = lda.metadata?.get('addressingMode');
    
    if (staMode !== 'zeropage' || ldaMode !== 'zeropage') {
      return null;
    }
    
    // Check: Same zero page address
    const staAddr = sta.operands[1]?.toString();
    const ldaAddr = lda.operands[0]?.toString();
    
    if (!staAddr || staAddr !== ldaAddr) {
      return null;
    }
    
    return {
      matched: [sta, lda],
      captures: this.capture([
        ['zpAddress', staAddr],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[0]],
      cyclesSaved: 3, // ZP LDA = 3 cycles
      bytesSaved: 2,  // ZP LDA = 2 bytes
    };
  }
}

/**
 * Pattern: Indirect ZP load-store-load elimination
 * 
 * Before:
 *   LDA ($nn),Y  ; Indirect Y load
 *   STA $mm      ; Store somewhere
 *   LDA ($nn),Y  ; Redundant indirect load
 * 
 * After:
 *   LDA ($nn),Y  ; Keep first load
 *   STA $mm      ; Keep store
 *   (second LDA eliminated)
 * 
 * Saves: 5-6 cycles, 2 bytes
 */
export class ZpIndirectLdaStaLdaPattern extends BasePattern {
  readonly id = 'zp-indirect-lda-sta-lda';
  readonly description = 'Remove redundant indirect ZP LDA after STA when Y unchanged';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [lda1, sta, lda2] = instructions;
    
    // Check: LDA-STA-LDA sequence
    if (!this.isLoad(lda1) || !this.isStore(sta) || !this.isLoad(lda2)) {
      return null;
    }
    
    // Check: First and third are indirect Y addressing
    const mode1 = lda1.metadata?.get('addressingMode');
    const mode2 = lda2.metadata?.get('addressingMode');
    
    if (mode1 !== 'indirectY' || mode2 !== 'indirectY') {
      return null;
    }
    
    // Check: Same ZP base address for indirection
    const baseAddr1 = lda1.operands[0]?.toString();
    const baseAddr2 = lda2.operands[0]?.toString();
    
    if (!baseAddr1 || baseAddr1 !== baseAddr2) {
      return null;
    }
    
    // Check: STA doesn't modify Y or the ZP pointer
    if (this.modifiesYRegister(sta) || this.modifiesAddress(sta, baseAddr1)) {
      return null;
    }
    
    return {
      matched: [lda1, sta, lda2],
      captures: this.capture([
        ['zpPointer', baseAddr1],
      ]),
      confidence: 0.95,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[0], match.matched[1]],
      cyclesSaved: 5, // Indirect Y = 5-6 cycles
      bytesSaved: 2,
    };
  }
  
  /** Check if instruction modifies Y register */
  protected modifiesYRegister(inst: ILInstruction): boolean {
    const modifies = inst.metadata?.get('modifiesRegisters') as string[] | undefined;
    return modifies?.includes('Y') ?? false;
  }
  
  /** Check if instruction modifies a specific address */
  protected modifiesAddress(inst: ILInstruction, addr: string): boolean {
    if (!this.isStore(inst)) return false;
    return inst.operands[1]?.toString() === addr;
  }
}

/**
 * Pattern: Zero page copy through accumulator
 * 
 * Before:
 *   LDA $nn     ; Load from ZP
 *   STA $mm     ; Store to ZP
 *   LDA $mm     ; Reload from destination
 * 
 * After:
 *   LDA $nn     ; Load from ZP
 *   STA $mm     ; Store to ZP
 *   (third LDA eliminated - A still has value)
 * 
 * Saves: 3 cycles, 2 bytes
 */
export class ZpCopyThroughPattern extends BasePattern {
  readonly id = 'zp-copy-through';
  readonly description = 'Eliminate reload after zero page copy';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [lda1, sta, lda2] = instructions;
    
    // Check: LDA-STA-LDA sequence
    if (!this.isLoad(lda1) || !this.isStore(sta) || !this.isLoad(lda2)) {
      return null;
    }
    
    // Check: All use zero page addressing
    const mode1 = lda1.metadata?.get('addressingMode');
    const mode2 = sta.metadata?.get('addressingMode');
    const mode3 = lda2.metadata?.get('addressingMode');
    
    if (mode1 !== 'zeropage' || mode2 !== 'zeropage' || mode3 !== 'zeropage') {
      return null;
    }
    
    // Check: Second LDA loads from where STA stored
    const staAddr = sta.operands[1]?.toString();
    const lda2Addr = lda2.operands[0]?.toString();
    
    if (!staAddr || staAddr !== lda2Addr) {
      return null;
    }
    
    return {
      matched: [lda1, sta, lda2],
      captures: this.capture([
        ['src', lda1.operands[0]],
        ['dst', sta.operands[1]],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[0], match.matched[1]],
      cyclesSaved: 3, // ZP LDA = 3 cycles
      bytesSaved: 2,
    };
  }
}

/**
 * Pattern: Redundant zero page load (with intervening non-interfering instructions)
 * 
 * Before:
 *   LDA $nn
 *   <non-interfering instructions>
 *   LDA $nn     ; Same ZP address, A not modified
 * 
 * After:
 *   LDA $nn
 *   <non-interfering instructions>
 *   (second LDA eliminated)
 * 
 * Note: Requires data flow analysis to verify safety.
 */
export class ZpRedundantLoadPattern extends BasePattern {
  readonly id = 'zp-redundant-load';
  readonly description = 'Remove redundant zero page loads with data flow analysis';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 5; // Larger window for intervening instructions
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    // Find first ZP load
    const firstLoad = instructions[0];
    if (!this.isLoad(firstLoad)) return null;
    if (firstLoad.metadata?.get('addressingMode') !== 'zeropage') return null;
    
    const zpAddr = firstLoad.operands[0]?.toString();
    if (!zpAddr) return null;
    
    // Search for redundant load
    for (let i = 1; i < instructions.length; i++) {
      const inst = instructions[i];
      
      // Found another load from same ZP address?
      if (this.isLoad(inst) 
          && inst.metadata?.get('addressingMode') === 'zeropage'
          && inst.operands[0]?.toString() === zpAddr) {
        
        // Verify no interference in between
        const intervening = instructions.slice(1, i);
        if (this.hasNoInterference(intervening, zpAddr)) {
          return {
            matched: instructions.slice(0, i + 1),
            captures: this.capture([
              ['zpAddress', zpAddr],
              ['redundantIndex', i],
            ]),
            confidence: 0.9,
          };
        }
        break; // Only consider first potential match
      }
      
      // If A is modified, stop searching
      if (this.modifiesAccumulator(inst)) {
        break;
      }
    }
    
    return null;
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const redundantIndex = match.captures.get('redundantIndex') as number;
    
    // Keep all except the redundant load
    const result = [...match.matched];
    result.splice(redundantIndex, 1);
    
    return {
      instructions: result,
      cyclesSaved: 3,
      bytesSaved: 2,
    };
  }
  
  /** Check if instructions don't interfere with ZP address or A register */
  protected hasNoInterference(instructions: ILInstruction[], zpAddr: string): boolean {
    for (const inst of instructions) {
      // Check if A is modified
      if (this.modifiesAccumulator(inst)) {
        return false;
      }
      
      // Check if ZP address is written
      if (this.isStore(inst) && inst.operands[1]?.toString() === zpAddr) {
        return false;
      }
    }
    return true;
  }
  
  /** Check if instruction modifies accumulator */
  protected modifiesAccumulator(inst: ILInstruction): boolean {
    const modifies = inst.metadata?.get('modifiesRegisters') as string[] | undefined;
    return modifies?.includes('A') ?? this.isLoad(inst);
  }
}

/**
 * Register all zero page load-store patterns
 */
export function registerLoadStoreZeroPagePatterns(registry: PatternRegistry): void {
  registry.register(new AbsoluteToZeroPagePattern());
  registry.register(new ZpStaLdaSamePattern());
  registry.register(new ZpIndirectLdaStaLdaPattern());
  registry.register(new ZpCopyThroughPattern());
  registry.register(new ZpRedundantLoadPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `AbsToZp match` | Matches absolute addr when in ZP range |
| `AbsToZp no match high addr` | No match when addr > $FF |
| `AbsToZp no match already zp` | No match when already ZP mode |
| `AbsToZp replace` | Changes addressing mode to zeropage |
| `AbsToZp cycles saved` | Reports 1 cycle saved |
| `ZpStaLdaSame match` | Matches ZP STA followed by ZP LDA same addr |
| `ZpStaLdaSame no match abs` | No match for absolute addressing |
| `ZpStaLdaSame no match diff addr` | No match different addresses |
| `ZpStaLdaSame replace` | Removes redundant LDA |
| `ZpIndirect match` | Matches indirect Y pattern |
| `ZpIndirect no match Y modified` | No match when Y changes |
| `ZpIndirect no match diff base` | No match different ZP pointers |
| `ZpIndirect replace` | Removes third LDA |
| `ZpCopyThrough match` | Matches ZP copy pattern |
| `ZpCopyThrough no match mixed modes` | No match with absolute addressing |
| `ZpCopyThrough replace` | Eliminates reload |
| `ZpRedundant match` | Matches redundant load with interval |
| `ZpRedundant no match A modified` | No match when A changes |
| `ZpRedundant no match addr written` | No match when ZP written |
| `ZpRedundant replace` | Removes only redundant load |
| `isZeroPageAddress constant` | Helper works for constants |
| `isZeroPageAddress symbolic` | Helper works for resolved symbols |
| `isZeroPageAddress out of range` | Returns false for > $FF |
| `register all` | All patterns registered correctly |
| `integration` | All patterns work with PeepholeOptimizer |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerLoadStoreCorePatterns } from './patterns/load-store-core.js';
import { registerLoadStoreZeroPagePatterns } from './patterns/load-store-zeropage.js';

// Register all load-store patterns
registerLoadStoreCorePatterns(patternRegistry);
registerLoadStoreZeroPagePatterns(patternRegistry);
```

### Zero Page Allocation Coordination

These patterns work best when combined with zero page allocation:

```typescript
// Compiler allocates frequently-used variables to zero page
const zpAllocator = new ZeroPageAllocator({
  reserved: [0x00, 0x01, 0x02], // System reserved
  available: range(0x03, 0xFF),
});

// Variables are then eligible for ZP optimizations
@zp let counter: byte = 0;  // Allocated to zero page
```

---

## Pattern Priority

| Pattern | Priority | Reason |
|---------|----------|--------|
| AbsoluteToZeroPage | High | Enables other ZP patterns |
| ZpStaLdaSame | High | Common case, safe |
| ZpCopyThrough | Medium | Common copy pattern |
| ZpIndirectLdaStaLda | Medium | Indirect access optimization |
| ZpRedundantLoad | Low | Requires data flow analysis |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `load-store-zeropage.ts` | [ ] |
| Implement isZeroPageAddress helper | [ ] |
| Implement AbsoluteToZeroPagePattern | [ ] |
| Implement ZpStaLdaSamePattern | [ ] |
| Implement ZpIndirectLdaStaLdaPattern | [ ] |
| Implement ZpCopyThroughPattern | [ ] |
| Implement ZpRedundantLoadPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.3a → `08-03a-load-store-core.md`  
**Next Task**: 8.3c → `08-03c-load-store-indexed.md`