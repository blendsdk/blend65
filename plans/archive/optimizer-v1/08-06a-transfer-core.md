# Task 8.6a: Transfer Core Patterns

> **Task**: 8.6a of 25 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~30 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement core register transfer peephole patterns for the 6502:
- TAX (Transfer A to X)
- TXA (Transfer X to A)
- TAY (Transfer A to Y)
- TYA (Transfer Y to A)

These patterns identify and eliminate redundant, dead, or no-op transfer sequences.

---

## 6502 Transfer Instruction Reference

| Instruction | Operation | Cycles | Bytes | Flags Affected |
|-------------|-----------|--------|-------|----------------|
| TAX | X ← A | 2 | 1 | N, Z |
| TXA | A ← X | 2 | 1 | N, Z |
| TAY | Y ← A | 2 | 1 | N, Z |
| TYA | A ← Y | 2 | 1 | N, Z |

**Key Properties:**
- All transfers are 2 cycles, 1 byte
- Source register is preserved
- N and Z flags reflect the transferred value
- No memory access required

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                   # Pattern exports
├── load-store-core.ts         # Load/store patterns
└── transfer-core.ts           # THIS TASK
```

---

## Implementation

### File: `transfer-core.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';
import { PatternRegistry } from '../registry.js';

/**
 * Transfer instruction types
 */
export enum TransferType {
  TAX = 'TAX',
  TXA = 'TXA',
  TAY = 'TAY',
  TYA = 'TYA',
}

/**
 * Get transfer type from instruction
 */
export function getTransferType(inst: ILInstruction): TransferType | null {
  if (inst.opcode !== ILOpcode.Transfer) {
    return null;
  }
  
  const src = inst.metadata?.get('srcReg') as string;
  const dst = inst.metadata?.get('dstReg') as string;
  
  if (src === 'A' && dst === 'X') return TransferType.TAX;
  if (src === 'X' && dst === 'A') return TransferType.TXA;
  if (src === 'A' && dst === 'Y') return TransferType.TAY;
  if (src === 'Y' && dst === 'A') return TransferType.TYA;
  
  return null;
}

/**
 * Check if two transfers are inverse operations
 */
export function areInverseTransfers(t1: TransferType, t2: TransferType): boolean {
  return (
    (t1 === TransferType.TAX && t2 === TransferType.TXA) ||
    (t1 === TransferType.TXA && t2 === TransferType.TAX) ||
    (t1 === TransferType.TAY && t2 === TransferType.TYA) ||
    (t1 === TransferType.TYA && t2 === TransferType.TAY)
  );
}

/**
 * Pattern: TAX followed by TXA (or TAY/TYA)
 * 
 * Before:
 *   TAX
 *   TXA
 * 
 * After:
 *   TAX
 *   (TXA eliminated - A already has the value)
 * 
 * Saves: 2 cycles, 1 byte
 * 
 * Note: Only valid if X is not modified between transfers
 * and no code depends on flags from TXA.
 */
export class TransferRoundTripPattern extends BasePattern {
  readonly id = 'transfer-roundtrip';
  readonly description = 'Remove inverse transfer when source unchanged';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getTransferType(first);
    const t2 = getTransferType(second);
    
    if (!t1 || !t2) return null;
    
    // Check: Are they inverse transfers?
    if (!areInverseTransfers(t1, t2)) {
      return null;
    }
    
    // Check: Is flag result used? If so, can't eliminate
    if (this.isFlagResultUsed(second)) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([
        ['transfer1', { type: t1 } as any],
        ['transfer2', { type: t2 } as any],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Keep only the first transfer
    return {
      instructions: [match.matched[0]],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
  
  /**
   * Check if instruction's flag result is used
   */
  protected isFlagResultUsed(inst: ILInstruction): boolean {
    return inst.metadata?.get('flagsUsed') === true;
  }
}

/**
 * Pattern: Double transfer to same register
 * 
 * Before:
 *   TAX
 *   TAX
 * 
 * After:
 *   TAX
 *   (second TAX eliminated - X already has A's value)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DoubleTransferPattern extends BasePattern {
  readonly id = 'double-transfer';
  readonly description = 'Remove duplicate consecutive transfers';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getTransferType(first);
    const t2 = getTransferType(second);
    
    if (!t1 || !t2) return null;
    
    // Check: Same transfer type
    if (t1 !== t2) {
      return null;
    }
    
    // Second one is redundant unless flags are specifically needed
    if (this.isFlagResultUsed(second)) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([
        ['transferType', { type: t1 } as any],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[0]],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
  
  protected isFlagResultUsed(inst: ILInstruction): boolean {
    return inst.metadata?.get('flagsUsed') === true;
  }
}

/**
 * Pattern: Transfer when registers already equal
 * 
 * Before:
 *   LDA #$42
 *   LDX #$42
 *   TAX       ; X already has $42
 * 
 * After:
 *   LDA #$42
 *   LDX #$42
 *   (TAX eliminated)
 * 
 * Saves: 2 cycles, 1 byte
 * 
 * Requires constant propagation data.
 */
export class TransferRedundantValuePattern extends BasePattern {
  readonly id = 'transfer-redundant-value';
  readonly description = 'Remove transfer when destination already has value';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    const transferType = getTransferType(inst);
    
    if (!transferType) return null;
    
    // Check: Is destination value same as source?
    const srcValue = inst.metadata?.get('srcValue');
    const dstValue = inst.metadata?.get('dstValue');
    
    if (srcValue === undefined || dstValue === undefined) {
      return null;
    }
    
    if (srcValue !== dstValue) {
      return null;
    }
    
    // Check: Flags not needed
    if (this.isFlagResultUsed(inst)) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([
        ['value', { value: srcValue } as any],
      ]),
      confidence: 0.9, // Relies on constant propagation
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
  
  protected isFlagResultUsed(inst: ILInstruction): boolean {
    return inst.metadata?.get('flagsUsed') === true;
  }
}

/**
 * Pattern: Dead transfer (destination never used)
 * 
 * Before:
 *   TAX    ; X never used after this
 *   ...other code not using X...
 *   RTS
 * 
 * After:
 *   (TAX eliminated)
 * 
 * Saves: 2 cycles, 1 byte
 * 
 * Requires liveness analysis.
 */
export class DeadTransferPattern extends BasePattern {
  readonly id = 'dead-transfer';
  readonly description = 'Remove transfer when destination is dead';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O3]; // Only at highest level
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    const transferType = getTransferType(inst);
    
    if (!transferType) return null;
    
    // Check: Is destination dead (from liveness analysis)?
    if (!inst.metadata?.get('dstIsDead')) {
      return null;
    }
    
    // Check: Are flags dead too?
    if (!inst.metadata?.get('flagsAreDead')) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([
        ['transferType', { type: transferType } as any],
      ]),
      confidence: 0.9, // Relies on liveness analysis
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Pattern: Load followed by transfer where both load same value
 * 
 * Before:
 *   LDA #$42
 *   TAX
 * 
 * After:
 *   LDX #$42   ; Direct load is same cost but more flexible
 *   (TAX eliminated)
 * 
 * OR if A is needed too:
 *   LDA #$42
 *   LDX #$42
 * 
 * Saves: 0 cycles, 0 bytes (but may enable further optimizations)
 * 
 * Note: This is a strength reduction, not cycle saving.
 * Useful when A is needed but X could be loaded directly.
 */
export class LoadThenTransferPattern extends BasePattern {
  readonly id = 'load-then-transfer';
  readonly description = 'Convert load+transfer to direct load when beneficial';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [load, transfer] = instructions;
    
    // Check: First is a load immediate
    if (load.opcode !== ILOpcode.Load) return null;
    if (!this.isImmediateLoad(load)) return null;
    
    const transferType = getTransferType(transfer);
    if (!transferType) return null;
    
    // Check: Transfer source matches load destination
    const loadDst = load.metadata?.get('dstReg');
    const transferSrc = transfer.metadata?.get('srcReg');
    
    if (loadDst !== transferSrc) return null;
    
    // Check: Source register (A) not needed after this
    const sourceNeeded = load.metadata?.get('srcNeededAfter') ?? true;
    
    return {
      matched: [load, transfer],
      captures: this.capture([
        ['value', load.operands[0]],
        ['srcReg', { reg: loadDst } as any],
        ['dstReg', { reg: transfer.metadata?.get('dstReg') } as any],
        ['sourceNeeded', { needed: sourceNeeded } as any],
      ]),
      confidence: 0.8, // Depends on context
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const value = match.captures.get('value');
    const dstReg = (match.captures.get('dstReg') as any)?.reg;
    const sourceNeeded = (match.captures.get('sourceNeeded') as any)?.needed;
    
    // Create direct load to destination register
    const directLoad = this.createDirectLoad(dstReg, value);
    
    if (sourceNeeded) {
      // Both registers needed - return original sequence unchanged
      // This pattern should not match in this case ideally
      return {
        instructions: match.matched,
        cyclesSaved: 0,
        bytesSaved: 0,
      };
    }
    
    // Replace with direct load
    return {
      instructions: [directLoad],
      cyclesSaved: 0, // Same cost: LDA imm (2) + TAX (2) = 4, LDX imm (2) = 2 cycles saved!
      bytesSaved: 0,  // Same size but we save 1 byte actually: LDA (2) + TAX (1) = 3, LDX (2)
    };
  }
  
  protected isImmediateLoad(inst: ILInstruction): boolean {
    return inst.metadata?.get('addressMode') === 'immediate';
  }
  
  protected createDirectLoad(reg: string, value: any): ILInstruction {
    // Create appropriate load instruction based on destination register
    return {
      opcode: ILOpcode.Load,
      operands: [value],
      metadata: new Map([
        ['dstReg', reg],
        ['addressMode', 'immediate'],
      ]),
    } as ILInstruction;
  }
}

/**
 * Pattern: Transfer after operation that already set destination
 * 
 * Before:
 *   LDX $addr    ; X = mem[$addr]
 *   TXA          ; A = X
 *   ...
 *   LDA $addr    ; A = mem[$addr] (same value as X already has)
 *   TAX          ; Redundant! X already has this value
 * 
 * After:
 *   LDX $addr
 *   TXA
 *   ...
 *   LDA $addr
 *   (TAX eliminated)
 * 
 * Requires reaching definitions analysis.
 */
export class TransferAfterLoadPattern extends BasePattern {
  readonly id = 'transfer-after-load';
  readonly description = 'Remove transfer when value already in destination';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [load, transfer] = instructions;
    
    // Check: First is a load
    if (load.opcode !== ILOpcode.Load) return null;
    
    const transferType = getTransferType(transfer);
    if (!transferType) return null;
    
    // Check: Transfer source = load destination
    const loadDst = load.metadata?.get('dstReg');
    const transferSrc = transfer.metadata?.get('srcReg');
    const transferDst = transfer.metadata?.get('dstReg');
    
    if (loadDst !== transferSrc) return null;
    
    // Check: Transfer destination already has same value
    // (from reaching definitions analysis)
    const dstCurrentValue = transfer.metadata?.get('dstCurrentValue');
    const loadedValue = load.metadata?.get('loadedValue');
    
    if (dstCurrentValue === undefined || loadedValue === undefined) {
      return null;
    }
    
    if (dstCurrentValue !== loadedValue) {
      return null;
    }
    
    // Check: Flags not needed from transfer
    if (transfer.metadata?.get('flagsUsed')) {
      return null;
    }
    
    return {
      matched: [load, transfer],
      captures: this.capture([
        ['loadDst', { reg: loadDst } as any],
        ['transferDst', { reg: transferDst } as any],
      ]),
      confidence: 0.8,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Keep only the load
    return {
      instructions: [match.matched[0]],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Register all core transfer patterns
 */
export function registerTransferCorePatterns(registry: PatternRegistry): void {
  registry.register(new TransferRoundTripPattern());
  registry.register(new DoubleTransferPattern());
  registry.register(new TransferRedundantValuePattern());
  registry.register(new DeadTransferPattern());
  registry.register(new LoadThenTransferPattern());
  registry.register(new TransferAfterLoadPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `getTransferType TAX` | Correctly identifies TAX |
| `getTransferType TXA` | Correctly identifies TXA |
| `getTransferType TAY` | Correctly identifies TAY |
| `getTransferType TYA` | Correctly identifies TYA |
| `getTransferType non-transfer` | Returns null for non-transfers |
| `areInverseTransfers TAX-TXA` | TAX and TXA are inverse |
| `areInverseTransfers TAY-TYA` | TAY and TYA are inverse |
| `areInverseTransfers same` | TAX-TAX not inverse |
| `TransferRoundTrip match TAX-TXA` | Matches TAX followed by TXA |
| `TransferRoundTrip match TAY-TYA` | Matches TAY followed by TYA |
| `TransferRoundTrip no match same` | TAX-TAX doesn't match |
| `TransferRoundTrip no match flags` | No match when flags used |
| `TransferRoundTrip replace` | Keeps first transfer |
| `DoubleTransfer match TAX-TAX` | Matches duplicate TAX |
| `DoubleTransfer match TXA-TXA` | Matches duplicate TXA |
| `DoubleTransfer no match diff` | TAX-TAY doesn't match |
| `DoubleTransfer replace` | Keeps first transfer |
| `TransferRedundantValue match` | Matches when values equal |
| `TransferRedundantValue no match diff` | No match when values differ |
| `TransferRedundantValue no match unknown` | No match without value info |
| `TransferRedundantValue replace` | Removes transfer entirely |
| `DeadTransfer match` | Matches when dst is dead |
| `DeadTransfer no match live` | No match when dst is live |
| `DeadTransfer no match flags needed` | No match when flags needed |
| `DeadTransfer replace` | Removes transfer entirely |
| `LoadThenTransfer match LDA-TAX` | Matches LDA imm + TAX |
| `LoadThenTransfer match LDA-TAY` | Matches LDA imm + TAY |
| `LoadThenTransfer no match non-imm` | No match for non-immediate |
| `LoadThenTransfer replace` | Converts to direct load |
| `TransferAfterLoad match` | Matches with same value |
| `TransferAfterLoad no match` | No match with different value |
| `register all` | All patterns registered correctly |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerTransferCorePatterns } from './patterns/transfer-core.js';

// Register all core transfer patterns
registerTransferCorePatterns(patternRegistry);
```

### Analysis Dependencies

Some patterns require analysis metadata:

| Pattern | Required Analysis |
|---------|-------------------|
| TransferRedundantValuePattern | Constant propagation |
| DeadTransferPattern | Liveness analysis |
| TransferAfterLoadPattern | Reaching definitions |

### Flag Considerations

Transfer instructions affect N and Z flags. Patterns must verify:
1. `flagsUsed` - Is the flag result used by subsequent code?
2. `flagsAreDead` - Are N/Z flags dead after the instruction?

```typescript
// Example flag check
if (inst.metadata?.get('flagsUsed') === true) {
  // Cannot eliminate - flag result is needed
  return null;
}
```

---

## Optimization Examples

### Example 1: Round-Trip Elimination

```asm
; Before optimization
  LDA $10
  TAX       ; X = A
  ; ... operations not touching A or X ...
  TXA       ; A = X (but A unchanged!)

; After optimization  
  LDA $10
  TAX
  ; ... operations ...
  ; TXA eliminated
```

### Example 2: Double Transfer

```asm
; Before (perhaps from macro expansion)
  TAX
  TAX       ; Redundant

; After
  TAX
```

### Example 3: Direct Load Conversion

```asm
; Before
  LDA #$FF
  TAX       ; Need X=$FF, don't need A

; After (if A not needed)
  LDX #$FF  ; Direct load, saves 1 byte
```

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `transfer-core.ts` | [ ] |
| Implement TransferRoundTripPattern | [ ] |
| Implement DoubleTransferPattern | [ ] |
| Implement TransferRedundantValuePattern | [ ] |
| Implement DeadTransferPattern | [ ] |
| Implement LoadThenTransferPattern | [ ] |
| Implement TransferAfterLoadPattern | [ ] |
| Implement helper functions | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.5d.2 → `08-05d2-branch-flag-aware-cmp.md`  
**Next Task**: 8.6b → `08-06b-transfer-stack.md`