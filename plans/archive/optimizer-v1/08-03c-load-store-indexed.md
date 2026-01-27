# Task 8.3c: Load-Store Indexed Addressing Patterns

> **Task**: 8.3c of 14 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~25 tests  
> **Prerequisites**: Tasks 8.1-8.3b (Pattern Framework + Core + ZP Load-Store)

---

## Overview

Implement indexed addressing peephole patterns for the 6502. Indexed addressing modes use X or Y registers as offsets for array access and pointer operations.

**Key optimizations:**
- Absolute indexed → Zero page indexed conversion
- Redundant indexed load elimination
- Index register selection optimization
- Common array access pattern optimization

---

## 6502 Indexed Addressing Modes

| Mode | Syntax | Bytes | Cycles | Notes |
|------|--------|-------|--------|-------|
| Absolute,X | `$nnnn,X` | 3 | 4-5 | +1 if page boundary crossed |
| Absolute,Y | `$nnnn,Y` | 3 | 4-5 | +1 if page boundary crossed |
| Zero Page,X | `$nn,X` | 2 | 4 | Wraps within zero page |
| Zero Page,Y | `$nn,Y` | 2 | 4 | LDX/STX only |
| Indexed Indirect | `($nn,X)` | 2 | 6 | Rarely used |
| Indirect Indexed | `($nn),Y` | 2 | 5-6 | Common for arrays |

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                   # Pattern exports
├── load-store-core.ts         # Task 8.3a
├── load-store-zeropage.ts     # Task 8.3b
└── load-store-indexed.ts      # THIS TASK
```

---

## Implementation

### File: `load-store-indexed.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode, ILValue } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Check if an address is in zero page range ($00-$FF)
 */
function isZeroPageAddress(value: ILValue | undefined): boolean {
  if (!value) return false;
  if (value.isConstant()) {
    const addr = value.getConstantValue();
    return typeof addr === 'number' && addr >= 0x00 && addr <= 0xFF;
  }
  if (value.metadata?.has('resolvedAddress')) {
    const addr = value.metadata.get('resolvedAddress') as number;
    return addr >= 0x00 && addr <= 0xFF;
  }
  return false;
}

/**
 * Get the index register (X or Y) from addressing mode
 */
function getIndexRegister(addressingMode: string | undefined): 'X' | 'Y' | null {
  if (!addressingMode) return null;
  if (addressingMode.includes('X') || addressingMode === 'indexedIndirect') return 'X';
  if (addressingMode.includes('Y') || addressingMode === 'indirectIndexed') return 'Y';
  return null;
}

/**
 * Pattern: Convert absolute indexed to zero page indexed
 * 
 * Before:
 *   LDA $00nn,X   ; Absolute,X (4-5 cycles, 3 bytes)
 * 
 * After:
 *   LDA $nn,X     ; Zero Page,X (4 cycles, 2 bytes)
 * 
 * Saves: 0-1 cycles, 1 byte
 */
export class AbsoluteIndexedToZpIndexedPattern extends BasePattern {
  readonly id = 'abs-indexed-to-zp-indexed';
  readonly description = 'Convert absolute indexed to zero page indexed when address fits';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    // Check: Is a load or store
    if (!this.isLoadOrStore(inst)) {
      return null;
    }
    
    // Check: Uses absolute indexed addressing
    const addrMode = inst.metadata?.get('addressingMode') as string;
    if (addrMode !== 'absoluteX' && addrMode !== 'absoluteY') {
      return null;
    }
    
    // Check: Base address is in zero page range
    const baseAddr = this.getBaseAddress(inst);
    if (!isZeroPageAddress(baseAddr)) {
      return null;
    }
    
    // Check: ZP,Y only valid for LDX/STX
    const indexReg = getIndexRegister(addrMode);
    if (indexReg === 'Y' && !this.isLdxOrStx(inst)) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([
        ['baseAddress', baseAddr],
        ['indexRegister', indexReg],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const inst = match.matched[0];
    const indexReg = match.captures.get('indexRegister') as string;
    
    const newMode = indexReg === 'X' ? 'zeropageX' : 'zeropageY';
    const newInst = this.cloneInstruction(inst, {
      addressingMode: newMode,
    });
    
    return {
      instructions: [newInst],
      cyclesSaved: 0, // Same cycles but smaller code
      bytesSaved: 1,
    };
  }
  
  protected getBaseAddress(inst: ILInstruction): ILValue | undefined {
    return inst.opcode === ILOpcode.Store 
      ? inst.operands[1] 
      : inst.operands[0];
  }
  
  protected isLoadOrStore(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Load || inst.opcode === ILOpcode.Store;
  }
  
  protected isLdxOrStx(inst: ILInstruction): boolean {
    const reg = inst.metadata?.get('register');
    return reg === 'X';
  }
}

/**
 * Pattern: Redundant indexed load after indexed store (same base + index)
 * 
 * Before:
 *   STA $addr,X
 *   LDA $addr,X
 * 
 * After:
 *   STA $addr,X
 *   (LDA eliminated - A still has value)
 * 
 * Saves: 4-5 cycles, 2-3 bytes
 */
export class IndexedStaLdaSamePattern extends BasePattern {
  readonly id = 'indexed-sta-lda-same';
  readonly description = 'Remove indexed LDA after STA to same address+index';
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
    
    // Check: Both use indexed addressing
    const staMode = sta.metadata?.get('addressingMode') as string;
    const ldaMode = lda.metadata?.get('addressingMode') as string;
    
    if (!this.isIndexedMode(staMode) || !this.isIndexedMode(ldaMode)) {
      return null;
    }
    
    // Check: Same addressing mode (same index register)
    if (staMode !== ldaMode) {
      return null;
    }
    
    // Check: Same base address
    const staAddr = sta.operands[1]?.toString();
    const ldaAddr = lda.operands[0]?.toString();
    
    if (!staAddr || staAddr !== ldaAddr) {
      return null;
    }
    
    return {
      matched: [sta, lda],
      captures: this.capture([
        ['baseAddress', staAddr],
        ['addressingMode', staMode],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mode = match.captures.get('addressingMode') as string;
    const isZp = mode.startsWith('zeropage');
    
    return {
      instructions: [match.matched[0]],
      cyclesSaved: isZp ? 4 : 4, // Both ZP,X and abs,X are 4 cycles for LDA
      bytesSaved: isZp ? 2 : 3,
    };
  }
  
  protected isIndexedMode(mode: string | undefined): boolean {
    if (!mode) return false;
    return ['absoluteX', 'absoluteY', 'zeropageX', 'zeropageY'].includes(mode);
  }
}

/**
 * Pattern: Consecutive indexed stores to same location
 * 
 * Before:
 *   STA $addr,X
 *   STA $addr,X
 * 
 * After:
 *   STA $addr,X
 *   (first STA eliminated - immediately overwritten)
 * 
 * Saves: 4-5 cycles, 2-3 bytes
 */
export class IndexedStaStaSamePattern extends BasePattern {
  readonly id = 'indexed-sta-sta-same';
  readonly description = 'Remove first indexed STA when followed by STA to same address+index';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check: Both are stores
    if (!this.isStore(first) || !this.isStore(second)) {
      return null;
    }
    
    // Check: Both use same indexed addressing mode
    const mode1 = first.metadata?.get('addressingMode') as string;
    const mode2 = second.metadata?.get('addressingMode') as string;
    
    if (!this.isIndexedMode(mode1) || mode1 !== mode2) {
      return null;
    }
    
    // Check: Same base address
    const addr1 = first.operands[1]?.toString();
    const addr2 = second.operands[1]?.toString();
    
    if (!addr1 || addr1 !== addr2) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([
        ['baseAddress', addr1],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mode = match.matched[0].metadata?.get('addressingMode') as string;
    const isZp = mode?.startsWith('zeropage');
    
    return {
      instructions: [match.matched[1]],
      cyclesSaved: isZp ? 4 : 4,
      bytesSaved: isZp ? 2 : 3,
    };
  }
  
  protected isIndexedMode(mode: string | undefined): boolean {
    if (!mode) return false;
    return ['absoluteX', 'absoluteY', 'zeropageX', 'zeropageY'].includes(mode);
  }
}

/**
 * Pattern: Array copy with redundant reload
 * 
 * Before:
 *   LDA $src,X
 *   STA $dst,X
 *   LDA $dst,X    ; Redundant - A still has the value
 * 
 * After:
 *   LDA $src,X
 *   STA $dst,X
 *   (third LDA eliminated)
 * 
 * Saves: 4-5 cycles, 2-3 bytes
 */
export class IndexedCopyReloadPattern extends BasePattern {
  readonly id = 'indexed-copy-reload';
  readonly description = 'Eliminate redundant indexed load after array copy';
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
    
    // Check: All use same indexed mode (same index register)
    const mode1 = lda1.metadata?.get('addressingMode') as string;
    const mode2 = sta.metadata?.get('addressingMode') as string;
    const mode3 = lda2.metadata?.get('addressingMode') as string;
    
    if (!this.isIndexedMode(mode1) || !this.isIndexedMode(mode2) || !this.isIndexedMode(mode3)) {
      return null;
    }
    
    // All must use same index register
    const reg1 = getIndexRegister(mode1);
    const reg2 = getIndexRegister(mode2);
    const reg3 = getIndexRegister(mode3);
    
    if (reg1 !== reg2 || reg2 !== reg3) {
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
        ['srcAddr', lda1.operands[0]],
        ['dstAddr', sta.operands[1]],
        ['indexRegister', reg1],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mode = match.matched[0].metadata?.get('addressingMode') as string;
    const isZp = mode?.startsWith('zeropage');
    
    return {
      instructions: [match.matched[0], match.matched[1]],
      cyclesSaved: isZp ? 4 : 4,
      bytesSaved: isZp ? 2 : 3,
    };
  }
  
  protected isIndexedMode(mode: string | undefined): boolean {
    if (!mode) return false;
    return ['absoluteX', 'absoluteY', 'zeropageX', 'zeropageY',
            'indirectIndexed', 'indexedIndirect'].includes(mode);
  }
}

/**
 * Pattern: Indirect indexed redundant load
 * 
 * Before:
 *   LDA ($ptr),Y
 *   STA $temp
 *   LDA ($ptr),Y   ; Redundant if Y and $ptr unchanged
 * 
 * After:
 *   LDA ($ptr),Y
 *   STA $temp
 *   (second LDA eliminated)
 * 
 * Saves: 5-6 cycles, 2 bytes
 */
export class IndirectIndexedRedundantPattern extends BasePattern {
  readonly id = 'indirect-indexed-redundant';
  readonly description = 'Remove redundant indirect indexed load when pointer and Y unchanged';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [lda1, middle, lda2] = instructions;
    
    // Check: First is indirect indexed load
    if (!this.isLoad(lda1)) return null;
    const mode1 = lda1.metadata?.get('addressingMode');
    if (mode1 !== 'indirectIndexed') return null;
    
    // Check: Third is indirect indexed load
    if (!this.isLoad(lda2)) return null;
    const mode2 = lda2.metadata?.get('addressingMode');
    if (mode2 !== 'indirectIndexed') return null;
    
    // Check: Same ZP pointer
    const ptr1 = lda1.operands[0]?.toString();
    const ptr2 = lda2.operands[0]?.toString();
    if (!ptr1 || ptr1 !== ptr2) return null;
    
    // Check: Middle instruction doesn't modify A, Y, or the pointer
    if (this.modifiesAccumulator(middle) ||
        this.modifiesYRegister(middle) ||
        this.modifiesAddress(middle, ptr1)) {
      return null;
    }
    
    return {
      matched: [lda1, middle, lda2],
      captures: this.capture([
        ['pointer', ptr1],
      ]),
      confidence: 0.95,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[0], match.matched[1]],
      cyclesSaved: 5, // ($nn),Y = 5-6 cycles
      bytesSaved: 2,
    };
  }
  
  protected modifiesAccumulator(inst: ILInstruction): boolean {
    const modifies = inst.metadata?.get('modifiesRegisters') as string[] | undefined;
    return modifies?.includes('A') ?? this.isLoad(inst);
  }
  
  protected modifiesYRegister(inst: ILInstruction): boolean {
    const modifies = inst.metadata?.get('modifiesRegisters') as string[] | undefined;
    return modifies?.includes('Y') ?? false;
  }
  
  protected modifiesAddress(inst: ILInstruction, addr: string): boolean {
    if (!this.isStore(inst)) return false;
    const storeAddr = inst.operands[1]?.toString();
    // Check both the exact address and address+1 (for 16-bit pointers)
    return storeAddr === addr || storeAddr === `${addr}+1`;
  }
}

/**
 * Pattern: Index register swap for better addressing
 * 
 * Some operations work better with X vs Y. This pattern
 * identifies opportunities to swap index registers when:
 * - Current register is suboptimal
 * - A swap + transfer is still beneficial
 * 
 * Before:
 *   LDX index
 *   LDA table,X   ; X-indexed
 *   TAY           ; Transfer to Y (for later use)
 * 
 * After:
 *   LDY index
 *   LDA table,Y   ; Y-indexed (if valid)
 *   (TAY eliminated - value already in Y)
 */
export class IndexRegisterSwapPattern extends BasePattern {
  readonly id = 'index-register-swap';
  readonly description = 'Swap index register when beneficial for subsequent operations';
  readonly category = PatternCategory.LoadStore;
  readonly levels = [OptimizationLevel.O3]; // Advanced optimization
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [ldIndex, ldaIndexed, transfer] = instructions;
    
    // Check: LDX or LDY followed by indexed load
    if (!this.isIndexLoad(ldIndex)) return null;
    if (!this.isLoad(ldaIndexed)) return null;
    
    // Check: Transfer instruction (TAX, TAY, TXA, TYA, etc.)
    if (!this.isTransfer(transfer)) return null;
    
    // Check: Can swap to other register
    const currentReg = this.getIndexRegFromLoad(ldIndex);
    const targetReg = this.getTransferTarget(transfer);
    
    if (!currentReg || !targetReg) return null;
    if (currentReg === targetReg) return null; // Already optimal
    
    // Check: Indexed load uses the loaded index
    const ldaMode = ldaIndexed.metadata?.get('addressingMode') as string;
    if (!this.usesIndexRegister(ldaMode, currentReg)) return null;
    
    // Check: Can use alternate addressing mode
    if (!this.canUseAlternateIndex(ldaIndexed, targetReg)) return null;
    
    return {
      matched: [ldIndex, ldaIndexed, transfer],
      captures: this.capture([
        ['currentReg', currentReg],
        ['targetReg', targetReg],
      ]),
      confidence: 0.85,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const [ldIndex, ldaIndexed, _transfer] = match.matched;
    const targetReg = match.captures.get('targetReg') as string;
    
    // Create new index load (LDX→LDY or LDY→LDX)
    const newIndexLoad = this.cloneInstruction(ldIndex, {
      register: targetReg,
    });
    
    // Create new indexed load with swapped register
    const newMode = targetReg === 'Y' 
      ? ldaIndexed.metadata?.get('addressingMode')?.toString().replace('X', 'Y')
      : ldaIndexed.metadata?.get('addressingMode')?.toString().replace('Y', 'X');
    
    const newIndexedLoad = this.cloneInstruction(ldaIndexed, {
      addressingMode: newMode,
    });
    
    return {
      instructions: [newIndexLoad, newIndexedLoad],
      cyclesSaved: 2, // TAX/TAY = 2 cycles
      bytesSaved: 1,
    };
  }
  
  protected isIndexLoad(inst: ILInstruction): boolean {
    const reg = inst.metadata?.get('register');
    return this.isLoad(inst) && (reg === 'X' || reg === 'Y');
  }
  
  protected getIndexRegFromLoad(inst: ILInstruction): 'X' | 'Y' | null {
    const reg = inst.metadata?.get('register');
    if (reg === 'X' || reg === 'Y') return reg;
    return null;
  }
  
  protected isTransfer(inst: ILInstruction): boolean {
    const opcode = inst.opcode;
    return opcode === ILOpcode.Transfer;
  }
  
  protected getTransferTarget(inst: ILInstruction): 'X' | 'Y' | 'A' | null {
    return inst.metadata?.get('targetRegister') as 'X' | 'Y' | 'A' | null;
  }
  
  protected usesIndexRegister(mode: string | undefined, reg: string): boolean {
    if (!mode) return false;
    return mode.includes(reg);
  }
  
  protected canUseAlternateIndex(inst: ILInstruction, targetReg: string): boolean {
    // Some modes don't support both registers
    const mode = inst.metadata?.get('addressingMode') as string;
    
    // ZP,Y only valid for LDX/STX
    if (targetReg === 'Y' && mode?.startsWith('zeropage')) {
      const reg = inst.metadata?.get('register');
      return reg === 'X';
    }
    
    return true;
  }
}

/**
 * Register all indexed load-store patterns
 */
export function registerLoadStoreIndexedPatterns(registry: PatternRegistry): void {
  registry.register(new AbsoluteIndexedToZpIndexedPattern());
  registry.register(new IndexedStaLdaSamePattern());
  registry.register(new IndexedStaStaSamePattern());
  registry.register(new IndexedCopyReloadPattern());
  registry.register(new IndirectIndexedRedundantPattern());
  registry.register(new IndexRegisterSwapPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `AbsIndexedToZp match X` | Matches abs,X when base addr in ZP |
| `AbsIndexedToZp match Y` | Matches abs,Y for LDX/STX |
| `AbsIndexedToZp no match high addr` | No match when base addr > $FF |
| `AbsIndexedToZp no match Y non-LDX` | No match ZP,Y for LDA |
| `AbsIndexedToZp replace` | Changes to zeropage indexed mode |
| `IndexedStaLda match` | Matches STA/LDA same addr+mode |
| `IndexedStaLda no match diff addr` | No match different base address |
| `IndexedStaLda no match diff mode` | No match abs,X vs abs,Y |
| `IndexedStaLda replace` | Removes redundant LDA |
| `IndexedStaSta match` | Matches consecutive indexed stores |
| `IndexedStaSta no match diff addr` | No match different addresses |
| `IndexedStaSta replace` | Keeps second store only |
| `IndexedCopyReload match` | Matches copy+reload pattern |
| `IndexedCopyReload no match diff index` | No match different index registers |
| `IndexedCopyReload no match diff dest` | No match when LDA addr != STA addr |
| `IndexedCopyReload replace` | Removes third instruction |
| `IndirectIndexed match` | Matches ($nn),Y redundant pattern |
| `IndirectIndexed no match A modified` | No match when A changes |
| `IndirectIndexed no match Y modified` | No match when Y changes |
| `IndirectIndexed no match ptr modified` | No match when pointer written |
| `IndirectIndexed replace` | Removes redundant load |
| `IndexSwap match` | Matches register swap opportunity |
| `IndexSwap no match same reg` | No match when already optimal |
| `IndexSwap replace` | Swaps register and removes transfer |
| `register all` | All patterns registered correctly |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerLoadStoreCorePatterns } from './patterns/load-store-core.js';
import { registerLoadStoreZeroPagePatterns } from './patterns/load-store-zeropage.js';
import { registerLoadStoreIndexedPatterns } from './patterns/load-store-indexed.js';

// Register all load-store patterns
registerLoadStoreCorePatterns(patternRegistry);
registerLoadStoreZeroPagePatterns(patternRegistry);
registerLoadStoreIndexedPatterns(patternRegistry);
```

### Array Access Optimization Flow

```
1. Absolute indexed → ZP indexed (when base fits)
2. Redundant indexed load elimination
3. Index register selection optimization
4. Loop-level optimizations (see loop patterns)
```

---

## Pattern Priority

| Pattern | Priority | Reason |
|---------|----------|--------|
| AbsoluteIndexedToZpIndexed | High | Enables other ZP patterns |
| IndexedStaLdaSame | High | Common array write+read |
| IndexedCopyReload | High | Common array copy pattern |
| IndexedStaStaSame | Medium | Less common duplicate stores |
| IndirectIndexedRedundant | Medium | Requires analysis |
| IndexRegisterSwap | Low | Complex, O3 only |

---

## 6502 Indexed Addressing Notes

### Zero Page Indexed Limitations

```
ZP,X - Available for: LDA, STA, LDY, STY, ADC, SBC, AND, ORA, EOR, CMP
ZP,Y - Available ONLY for: LDX, STX
```

### Page Boundary Crossing

Absolute indexed modes add +1 cycle when crossing page boundary:
```
; No extra cycle (same page)
LDA $1000,X    ; X=0..FF stays in page $10xx

; +1 cycle (crosses page)
LDA $10FF,X    ; X=1 crosses to page $11xx
```

### Indirect Indexed Notes

```
; ($nn),Y - Pointer at ZP, offset by Y
LDA ($10),Y    ; Load from address at ($10,$11) + Y

; ($nn,X) - Table of pointers at ZP
LDA ($10,X)    ; Load from address at ($10+X,$11+X)
```

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `load-store-indexed.ts` | [ ] |
| Implement isZeroPageAddress helper | [ ] |
| Implement getIndexRegister helper | [ ] |
| Implement AbsoluteIndexedToZpIndexedPattern | [ ] |
| Implement IndexedStaLdaSamePattern | [ ] |
| Implement IndexedStaStaSamePattern | [ ] |
| Implement IndexedCopyReloadPattern | [ ] |
| Implement IndirectIndexedRedundantPattern | [ ] |
| Implement IndexRegisterSwapPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.3b → `08-03b-load-store-zeropage.md`  
**Next Task**: 8.4 → `08-04-arithmetic-patterns.md`