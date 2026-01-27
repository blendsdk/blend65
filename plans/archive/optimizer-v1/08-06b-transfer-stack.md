# Task 8.6b: Transfer Stack Patterns

> **Task**: 8.6b of 25 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~25 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher), 8.6a (Transfer Core)

---

## Overview

Implement stack pointer transfer peephole patterns for the 6502:
- TXS (Transfer X to Stack Pointer)
- TSX (Transfer Stack Pointer to X)

These patterns optimize stack pointer operations which are critical for:
- Stack initialization
- Stack frame management
- Direct stack access patterns
- Interrupt handler setup

---

## 6502 Stack Transfer Instruction Reference

| Instruction | Operation | Cycles | Bytes | Flags Affected |
|-------------|-----------|--------|-------|----------------|
| TXS | S ← X | 2 | 1 | None |
| TSX | X ← S | 2 | 1 | N, Z |

**Key Properties:**
- TXS does NOT affect any flags (important distinction!)
- TSX affects N and Z based on stack pointer value
- Stack pointer (S) is 8-bit, addresses page $01xx
- TXS is commonly used for stack initialization
- TSX is used for stack inspection/manipulation

**Critical Safety Note:**
Stack pointer modifications must be handled with extreme care:
- Invalid stack pointer can crash the system
- Interrupt handlers depend on valid stack
- Patterns must never eliminate necessary stack setup

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                   # Pattern exports
├── transfer-core.ts           # Core transfers (8.6a)
└── transfer-stack.ts          # THIS TASK
```

---

## Implementation

### File: `transfer-stack.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';
import { PatternRegistry } from '../registry.js';

/**
 * Stack transfer instruction types
 */
export enum StackTransferType {
  TXS = 'TXS', // X → S (no flags)
  TSX = 'TSX', // S → X (affects N, Z)
}

/**
 * Get stack transfer type from instruction
 */
export function getStackTransferType(inst: ILInstruction): StackTransferType | null {
  if (inst.opcode !== ILOpcode.Transfer) {
    return null;
  }
  
  const src = inst.metadata?.get('srcReg') as string;
  const dst = inst.metadata?.get('dstReg') as string;
  
  if (src === 'X' && dst === 'S') return StackTransferType.TXS;
  if (src === 'S' && dst === 'X') return StackTransferType.TSX;
  
  return null;
}

/**
 * Check if instruction is TXS
 */
export function isTXS(inst: ILInstruction): boolean {
  return getStackTransferType(inst) === StackTransferType.TXS;
}

/**
 * Check if instruction is TSX
 */
export function isTSX(inst: ILInstruction): boolean {
  return getStackTransferType(inst) === StackTransferType.TSX;
}

/**
 * Check if two stack transfers are inverse operations
 */
export function areInverseStackTransfers(t1: StackTransferType, t2: StackTransferType): boolean {
  return (
    (t1 === StackTransferType.TXS && t2 === StackTransferType.TSX) ||
    (t1 === StackTransferType.TSX && t2 === StackTransferType.TXS)
  );
}

/**
 * Pattern: TXS followed by TSX (stack round-trip)
 * 
 * Before:
 *   TXS      ; S = X
 *   TSX      ; X = S (X already has this value!)
 * 
 * After:
 *   TXS
 *   (TSX eliminated)
 * 
 * Saves: 2 cycles, 1 byte
 * 
 * Note: Only valid if:
 *   1. X is not modified between transfers
 *   2. No interrupt can modify stack between operations
 *   3. N/Z flags from TSX are not needed
 */
export class StackRoundTripPattern extends BasePattern {
  readonly id = 'stack-roundtrip-txs-tsx';
  readonly description = 'Remove TSX after TXS when X unchanged';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Must be TXS followed by TSX
    if (!isTXS(first) || !isTSX(second)) {
      return null;
    }
    
    // Check: Are interrupts disabled or is this safe from interrupts?
    if (!this.isInterruptSafe(first, second)) {
      return null;
    }
    
    // Check: Are N/Z flags from TSX used?
    if (this.areFlagsUsed(second)) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([]),
      confidence: 0.85, // Lower confidence due to interrupt concerns
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[0]], // Keep TXS
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
  
  /**
   * Check if the instruction sequence is safe from interrupt interference
   */
  protected isInterruptSafe(first: ILInstruction, second: ILInstruction): boolean {
    // Safe if interrupts are disabled (SEI executed before)
    if (first.metadata?.get('interruptsDisabled') === true) {
      return true;
    }
    // Safe if explicitly marked as atomic sequence
    if (first.metadata?.get('atomicSequence') === true) {
      return true;
    }
    // Safe in NMI/IRQ handlers (interrupts naturally masked)
    if (first.metadata?.get('inInterruptHandler') === true) {
      return true;
    }
    return false;
  }
  
  protected areFlagsUsed(inst: ILInstruction): boolean {
    return inst.metadata?.get('flagsUsed') === true;
  }
}

/**
 * Pattern: TSX followed by TXS (inverse round-trip)
 * 
 * Before:
 *   TSX      ; X = S
 *   TXS      ; S = X (S unchanged!)
 * 
 * After:
 *   TSX
 *   (TXS eliminated if S value not needed)
 * 
 * Saves: 2 cycles, 1 byte
 * 
 * Note: This is safer than TXS→TSX because:
 *   - Stack pointer doesn't change between instructions
 *   - TXS doesn't set flags, so flag preservation not an issue
 */
export class StackInverseRoundTripPattern extends BasePattern {
  readonly id = 'stack-roundtrip-tsx-txs';
  readonly description = 'Remove TXS after TSX when stack unchanged';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Must be TSX followed by TXS
    if (!isTSX(first) || !isTXS(second)) {
      return null;
    }
    
    // TXS after TSX: stack value doesn't change
    // Safe to remove TXS as S already has the same value
    
    return {
      matched: [first, second],
      captures: this.capture([]),
      confidence: 0.95, // Higher confidence - straightforward case
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[0]], // Keep TSX
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Pattern: Double TXS (redundant stack set)
 * 
 * Before:
 *   LDX #$FF
 *   TXS
 *   TXS       ; Redundant - S already set
 * 
 * After:
 *   LDX #$FF
 *   TXS
 *   (second TXS eliminated)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DoubleTXSPattern extends BasePattern {
  readonly id = 'double-txs';
  readonly description = 'Remove duplicate consecutive TXS';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Both must be TXS
    if (!isTXS(first) || !isTXS(second)) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[0]], // Keep first TXS
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Pattern: Double TSX (redundant stack read)
 * 
 * Before:
 *   TSX
 *   TSX       ; Redundant if X and flags don't matter
 * 
 * After:
 *   TSX
 *   (second TSX eliminated)
 * 
 * Saves: 2 cycles, 1 byte
 * 
 * Note: Must check if second TSX is for flag setting purposes
 */
export class DoubleTSXPattern extends BasePattern {
  readonly id = 'double-tsx';
  readonly description = 'Remove duplicate consecutive TSX';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Both must be TSX
    if (!isTSX(first) || !isTSX(second)) {
      return null;
    }
    
    // Check: Is second TSX specifically for flag setting?
    if (this.isForFlagSetting(second)) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[0]], // Keep first TSX
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
  
  protected isForFlagSetting(inst: ILInstruction): boolean {
    return inst.metadata?.get('forFlagSetting') === true;
  }
}

/**
 * Pattern: Dead TXS (stack set never used)
 * 
 * Before:
 *   TXS      ; Set stack pointer
 *   TXS      ; Immediately overwritten with different value
 * 
 * Or:
 *   LDX #$FE
 *   TXS
 *   LDX #$FF
 *   TXS      ; First TXS is dead
 * 
 * After:
 *   (first TXS eliminated)
 *   LDX #$FF
 *   TXS
 * 
 * Saves: 2 cycles, 1 byte
 * 
 * Note: Requires careful analysis - any stack operation between
 * the two TXS instructions invalidates this optimization.
 */
export class DeadTXSPattern extends BasePattern {
  readonly id = 'dead-txs';
  readonly description = 'Remove TXS when stack pointer is immediately overwritten';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O3]; // Only at highest level
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (!isTXS(inst)) return null;
    
    // Check: Is this TXS immediately overwritten?
    if (!inst.metadata?.get('isOverwritten')) {
      return null;
    }
    
    // Check: No stack operations between this and next TXS?
    if (inst.metadata?.get('stackUsedBefore')) {
      return null;
    }
    
    // Check: Are interrupts disabled? (critical for safety)
    if (!inst.metadata?.get('interruptSafe')) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([]),
      confidence: 0.7, // Lower confidence - risky optimization
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
 * Pattern: Dead TSX (X value never used)
 * 
 * Before:
 *   TSX      ; X = S, but X is never used after
 *   LDX #$42 ; X immediately overwritten
 * 
 * After:
 *   (TSX eliminated if flags also dead)
 *   LDX #$42
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DeadTSXPattern extends BasePattern {
  readonly id = 'dead-tsx';
  readonly description = 'Remove TSX when X and flags are dead';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (!isTSX(inst)) return null;
    
    // Check: Is X dead after this?
    if (!inst.metadata?.get('xIsDead')) {
      return null;
    }
    
    // Check: Are N/Z flags dead too?
    if (!inst.metadata?.get('flagsAreDead')) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([]),
      confidence: 0.9,
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
 * Pattern: Stack initialization with known value
 * 
 * Before:
 *   LDX #$FF
 *   TXS
 * 
 * After: (no change, but mark as "stack initialized")
 * 
 * This is not an elimination pattern but a recognition pattern
 * that marks stack as initialized for subsequent optimizations.
 */
export class StackInitPattern extends BasePattern {
  readonly id = 'stack-init-recognition';
  readonly description = 'Recognize and mark standard stack initialization';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [load, transfer] = instructions;
    
    // Check: First is LDX immediate
    if (load.opcode !== ILOpcode.Load) return null;
    if (load.metadata?.get('dstReg') !== 'X') return null;
    if (load.metadata?.get('addressMode') !== 'immediate') return null;
    
    // Check: Second is TXS
    if (!isTXS(transfer)) return null;
    
    // Get the initialization value
    const initValue = load.operands[0];
    
    return {
      matched: [load, transfer],
      captures: this.capture([
        ['initValue', initValue],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Don't change instructions, but add metadata
    const [load, transfer] = match.matched;
    
    // Mark transfer with stack init metadata
    const newTransfer = this.cloneWithMetadata(transfer, [
      ['stackInitialized', true],
      ['stackInitValue', match.captures.get('initValue')],
    ]);
    
    return {
      instructions: [load, newTransfer],
      cyclesSaved: 0,
      bytesSaved: 0,
    };
  }
  
  protected cloneWithMetadata(inst: ILInstruction, entries: [string, any][]): ILInstruction {
    const newMetadata = new Map(inst.metadata || []);
    for (const [key, value] of entries) {
      newMetadata.set(key, value);
    }
    return {
      ...inst,
      metadata: newMetadata,
    } as ILInstruction;
  }
}

/**
 * Pattern: Stack-relative access after TSX
 * 
 * Before:
 *   TSX
 *   LDA $0100,X   ; Load from stack
 * 
 * After: (recognize pattern, mark for potential optimization)
 * 
 * This recognizes the idiom for accessing stack contents directly.
 */
export class StackAccessPattern extends BasePattern {
  readonly id = 'stack-access-recognition';
  readonly description = 'Recognize stack-relative access pattern';
  readonly category = PatternCategory.Transfer;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [transfer, access] = instructions;
    
    // Check: First is TSX
    if (!isTSX(transfer)) return null;
    
    // Check: Second is indexed access to page $01
    if (access.opcode !== ILOpcode.Load && access.opcode !== ILOpcode.Store) {
      return null;
    }
    
    // Check for indexed addressing with X on stack page
    const addressMode = access.metadata?.get('addressMode');
    if (addressMode !== 'absolute-x' && addressMode !== 'indexed-x') {
      return null;
    }
    
    const baseAddr = access.metadata?.get('baseAddress') as number;
    if (baseAddr !== 0x0100) {
      return null;
    }
    
    return {
      matched: [transfer, access],
      captures: this.capture([
        ['accessType', { opcode: access.opcode } as any],
        ['offset', access.metadata?.get('offset') || 0],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Mark as stack access pattern but don't modify
    const [transfer, access] = match.matched;
    
    const newAccess = this.cloneWithMetadata(access, [
      ['isStackAccess', true],
      ['stackPointerSource', true],
    ]);
    
    return {
      instructions: [transfer, newAccess],
      cyclesSaved: 0,
      bytesSaved: 0,
    };
  }
  
  protected cloneWithMetadata(inst: ILInstruction, entries: [string, any][]): ILInstruction {
    const newMetadata = new Map(inst.metadata || []);
    for (const [key, value] of entries) {
      newMetadata.set(key, value);
    }
    return {
      ...inst,
      metadata: newMetadata,
    } as ILInstruction;
  }
}

/**
 * Register all stack transfer patterns
 */
export function registerStackTransferPatterns(registry: PatternRegistry): void {
  registry.register(new StackRoundTripPattern());
  registry.register(new StackInverseRoundTripPattern());
  registry.register(new DoubleTXSPattern());
  registry.register(new DoubleTSXPattern());
  registry.register(new DeadTXSPattern());
  registry.register(new DeadTSXPattern());
  registry.register(new StackInitPattern());
  registry.register(new StackAccessPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `getStackTransferType TXS` | Correctly identifies TXS |
| `getStackTransferType TSX` | Correctly identifies TSX |
| `getStackTransferType non-stack` | Returns null for TAX/TXA/etc |
| `isTXS positive` | Returns true for TXS |
| `isTXS negative` | Returns false for other transfers |
| `isTSX positive` | Returns true for TSX |
| `isTSX negative` | Returns false for other transfers |
| `areInverseStackTransfers TXS-TSX` | Correctly identifies as inverse |
| `areInverseStackTransfers TSX-TXS` | Correctly identifies as inverse |
| `areInverseStackTransfers same` | TXS-TXS not inverse |
| `StackRoundTrip match` | Matches TXS followed by TSX |
| `StackRoundTrip no match interrupt` | No match without interrupt safety |
| `StackRoundTrip no match flags` | No match when flags used |
| `StackInverseRoundTrip match` | Matches TSX followed by TXS |
| `StackInverseRoundTrip replace` | Keeps TSX |
| `DoubleTXS match` | Matches TXS-TXS |
| `DoubleTXS replace` | Keeps first TXS |
| `DoubleTSX match` | Matches TSX-TSX |
| `DoubleTSX no match flags` | No match if for flag setting |
| `DeadTXS match` | Matches when overwritten |
| `DeadTXS no match stack used` | No match if stack used |
| `DeadTSX match` | Matches when X and flags dead |
| `StackInit recognize` | Recognizes LDX #$FF + TXS |
| `StackInit metadata` | Adds initialization metadata |
| `StackAccess recognize` | Recognizes TSX + LDA $0100,X |
| `register all` | All patterns registered correctly |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerStackTransferPatterns } from './patterns/transfer-stack.js';

// Register all stack transfer patterns
registerStackTransferPatterns(patternRegistry);
```

### Safety Considerations

Stack pointer modifications require extra care:

| Consideration | Why Important |
|---------------|---------------|
| Interrupt safety | Interrupts push to stack |
| Stack underflow | Invalid S can crash system |
| Stack overflow | Overwrites zero page |
| JSR/RTS | Depend on valid stack |

```typescript
// Always check interrupt safety for TXS→TSX
if (!inst.metadata?.get('interruptsDisabled')) {
  // Cannot safely optimize - interrupt could modify stack
  return null;
}
```

### Flag Behavior Differences

| Instruction | Flags Affected | Pattern Implications |
|-------------|----------------|---------------------|
| TXS | None | Safe to eliminate if stack not used |
| TSX | N, Z | Must check flag usage |

```typescript
// TSX sets flags, TXS doesn't
if (isTSX(inst) && inst.metadata?.get('flagsUsed')) {
  // Cannot eliminate - flags are needed
  return null;
}
// TXS safe from flag perspective
```

---

## Optimization Examples

### Example 1: Round-Trip Elimination

```asm
; Before optimization (in interrupt-disabled context)
  SEI           ; Disable interrupts
  TSX           ; Save stack pointer to X
  ; ... modify stack ...
  TXS           ; Restore stack pointer from X
  TSX           ; Redundant! X already has S
  
; After optimization
  SEI
  TSX
  ; ... modify stack ...
  TXS
  ; TSX eliminated
```

### Example 2: Dead Stack Set

```asm
; Before (perhaps from redundant code)
  LDX #$FE
  TXS           ; Dead - immediately overwritten
  LDX #$FF
  TXS
  
; After (in safe context)
  LDX #$FF
  TXS
```

### Example 3: Stack Initialization Recognition

```asm
; Common C64 startup pattern
  LDX #$FF      ; Standard stack top
  TXS           ; Initialize stack
  ; Pattern marks stack as initialized at $FF
```

### Example 4: Stack Access Pattern

```asm
; Direct stack access idiom
  TSX           ; Get current stack pointer
  LDA $0100,X   ; Read from stack[0]
  LDA $0101,X   ; Read from stack[1]
  ; Pattern recognizes this as stack access
```

---

## Common 6502 Stack Patterns

### Stack Initialization (Reset Handler)

```asm
RESET:
  SEI           ; Disable IRQ
  CLD           ; Clear decimal mode
  LDX #$FF      ; Standard stack position
  TXS           ; Initialize stack pointer
```

### Parameter Passing via Stack

```asm
  ; Push parameter
  LDA #param
  PHA
  
  ; In subroutine: access parameter
  TSX           ; Get stack pointer
  LDA $0102,X   ; Parameter at SP+2 (after JSR)
```

### Local Variable Access

```asm
  ; Create stack frame
  TSX           ; Save stack position
  ; ... use X for stack-relative access ...
  ; LDA $0100,X  ; Local var at offset 0
  ; LDA $0101,X  ; Local var at offset 1
```

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `transfer-stack.ts` | [ ] |
| Implement StackRoundTripPattern | [ ] |
| Implement StackInverseRoundTripPattern | [ ] |
| Implement DoubleTXSPattern | [ ] |
| Implement DoubleTSXPattern | [ ] |
| Implement DeadTXSPattern | [ ] |
| Implement DeadTSXPattern | [ ] |
| Implement StackInitPattern | [ ] |
| Implement StackAccessPattern | [ ] |
| Implement helper functions | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.6a → `08-06a-transfer-core.md`  
**Next Task**: 8.7a → `08-07a-flag-carry.md`