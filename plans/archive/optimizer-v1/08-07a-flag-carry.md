# Task 8.7a: Carry Flag Patterns

> **Task**: 8.7a of 25 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~26 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement carry flag manipulation peephole patterns for the 6502:
- CLC (Clear Carry Flag)
- SEC (Set Carry Flag)

These patterns identify and eliminate redundant, dead, or unnecessary carry flag operations.

---

## 6502 Carry Flag Instruction Reference

| Instruction | Operation | Cycles | Bytes | Flags Affected |
|-------------|-----------|--------|-------|----------------|
| CLC | C ← 0 | 2 | 1 | C only |
| SEC | C ← 1 | 2 | 1 | C only |

**Key Properties:**
- Both instructions are 2 cycles, 1 byte
- Only the Carry (C) flag is modified
- N, Z, V flags are NOT affected
- No memory access required
- Carry flag is used by ADC, SBC, ROL, ROR, and branch instructions (BCC, BCS)

**Carry Flag Usage:**
- ADC: Uses carry as input, produces carry as output
- SBC: Uses carry (as borrow complement) as input, produces carry
- ROL/ROR: Rotates through carry
- ASL/LSR: Shifts into carry (but doesn't read it as input)
- BCC/BCS: Branch based on carry state

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                   # Pattern exports
├── transfer-core.ts           # Transfer patterns
├── transfer-stack.ts          # Stack transfer patterns
└── flag-carry.ts              # THIS TASK
```

---

## Implementation

### File: `flag-carry.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';
import { PatternRegistry } from '../registry.js';

/**
 * Carry flag instruction types
 */
export enum CarryFlagType {
  CLC = 'CLC', // Clear Carry (C ← 0)
  SEC = 'SEC', // Set Carry (C ← 1)
}

/**
 * Get carry flag instruction type
 */
export function getCarryFlagType(inst: ILInstruction): CarryFlagType | null {
  if (inst.opcode !== ILOpcode.FlagOp) {
    return null;
  }
  
  const op = inst.metadata?.get('flagOp') as string;
  
  if (op === 'CLC') return CarryFlagType.CLC;
  if (op === 'SEC') return CarryFlagType.SEC;
  
  return null;
}

/**
 * Check if instruction reads the carry flag
 */
export function readsCarryFlag(inst: ILInstruction): boolean {
  const opcode = inst.opcode;
  
  // ADC and SBC use carry as input
  if (opcode === ILOpcode.Add || opcode === ILOpcode.Sub) {
    return inst.metadata?.get('withCarry') === true;
  }
  
  // ROL and ROR rotate through carry
  if (opcode === ILOpcode.RotateLeft || opcode === ILOpcode.RotateRight) {
    return true;
  }
  
  // Branch on carry instructions
  if (opcode === ILOpcode.Branch) {
    const condition = inst.metadata?.get('condition');
    return condition === 'BCC' || condition === 'BCS';
  }
  
  return false;
}

/**
 * Check if instruction writes the carry flag
 */
export function writesCarryFlag(inst: ILInstruction): boolean {
  const opcode = inst.opcode;
  
  // Arithmetic operations set carry
  if (opcode === ILOpcode.Add || opcode === ILOpcode.Sub) {
    return true;
  }
  
  // Shift and rotate operations set carry
  if (opcode === ILOpcode.ShiftLeft || opcode === ILOpcode.ShiftRight ||
      opcode === ILOpcode.RotateLeft || opcode === ILOpcode.RotateRight) {
    return true;
  }
  
  // Compare operations set carry
  if (opcode === ILOpcode.Compare) {
    return true;
  }
  
  // Flag manipulation
  if (opcode === ILOpcode.FlagOp) {
    const op = inst.metadata?.get('flagOp') as string;
    return op === 'CLC' || op === 'SEC';
  }
  
  return false;
}

/**
 * Pattern: Double CLC or Double SEC
 * 
 * Before:
 *   CLC
 *   CLC
 * 
 * After:
 *   CLC
 *   (second CLC eliminated - carry already clear)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DoubleCLCPattern extends BasePattern {
  readonly id = 'double-clc';
  readonly description = 'Remove consecutive CLC instructions';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getCarryFlagType(first);
    const t2 = getCarryFlagType(second);
    
    if (t1 !== CarryFlagType.CLC || t2 !== CarryFlagType.CLC) {
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
      instructions: [match.matched[0]],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Pattern: Double SEC
 * 
 * Before:
 *   SEC
 *   SEC
 * 
 * After:
 *   SEC
 *   (second SEC eliminated - carry already set)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DoubleSECPattern extends BasePattern {
  readonly id = 'double-sec';
  readonly description = 'Remove consecutive SEC instructions';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getCarryFlagType(first);
    const t2 = getCarryFlagType(second);
    
    if (t1 !== CarryFlagType.SEC || t2 !== CarryFlagType.SEC) {
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
      instructions: [match.matched[0]],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Pattern: CLC immediately followed by SEC (dead CLC)
 * 
 * Before:
 *   CLC
 *   SEC
 * 
 * After:
 *   SEC
 *   (CLC eliminated - immediately overwritten)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DeadCLCBeforeSECPattern extends BasePattern {
  readonly id = 'dead-clc-before-sec';
  readonly description = 'Remove CLC immediately followed by SEC';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getCarryFlagType(first);
    const t2 = getCarryFlagType(second);
    
    if (t1 !== CarryFlagType.CLC || t2 !== CarryFlagType.SEC) {
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
      instructions: [match.matched[1]], // Keep only SEC
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Pattern: SEC immediately followed by CLC (dead SEC)
 * 
 * Before:
 *   SEC
 *   CLC
 * 
 * After:
 *   CLC
 *   (SEC eliminated - immediately overwritten)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DeadSECBeforeCLCPattern extends BasePattern {
  readonly id = 'dead-sec-before-clc';
  readonly description = 'Remove SEC immediately followed by CLC';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getCarryFlagType(first);
    const t2 = getCarryFlagType(second);
    
    if (t1 !== CarryFlagType.SEC || t2 !== CarryFlagType.CLC) {
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
      instructions: [match.matched[1]], // Keep only CLC
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Pattern: CLC when carry already known to be clear
 * 
 * Before:
 *   CMP #$00   ; Carry = 1 if A >= 0 (always for unsigned)
 *   BCC skip   ; Carry was 0 here (branch taken path)
 *   ...
 *   CLC        ; Redundant - we know carry is 0
 * 
 * After:
 *   (CLC eliminated)
 * 
 * Requires carry flag tracking analysis.
 * Saves: 2 cycles, 1 byte
 */
export class RedundantCLCPattern extends BasePattern {
  readonly id = 'redundant-clc';
  readonly description = 'Remove CLC when carry already clear';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (getCarryFlagType(inst) !== CarryFlagType.CLC) {
      return null;
    }
    
    // Check: Is carry known to be clear from analysis?
    const carryKnown = inst.metadata?.get('carryKnown');
    const carryValue = inst.metadata?.get('carryValue');
    
    if (!carryKnown || carryValue !== 0) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([]),
      confidence: 0.9, // Relies on carry tracking analysis
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
 * Pattern: SEC when carry already known to be set
 * 
 * Before:
 *   CMP #$80   ; If A >= $80, carry is set
 *   BCS skip   ; Carry was 1 here (branch taken path)
 *   ...
 *   SEC        ; Redundant - we know carry is 1
 * 
 * After:
 *   (SEC eliminated)
 * 
 * Requires carry flag tracking analysis.
 * Saves: 2 cycles, 1 byte
 */
export class RedundantSECPattern extends BasePattern {
  readonly id = 'redundant-sec';
  readonly description = 'Remove SEC when carry already set';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (getCarryFlagType(inst) !== CarryFlagType.SEC) {
      return null;
    }
    
    // Check: Is carry known to be set from analysis?
    const carryKnown = inst.metadata?.get('carryKnown');
    const carryValue = inst.metadata?.get('carryValue');
    
    if (!carryKnown || carryValue !== 1) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([]),
      confidence: 0.9, // Relies on carry tracking analysis
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
 * Pattern: Dead CLC (carry never read before being overwritten)
 * 
 * Before:
 *   CLC
 *   ... operations that don't read carry ...
 *   CMP #$10   ; Overwrites carry without reading it
 * 
 * After:
 *   (CLC eliminated)
 *   ... operations ...
 *   CMP #$10
 * 
 * Requires liveness analysis on carry flag.
 * Saves: 2 cycles, 1 byte
 */
export class DeadCLCPattern extends BasePattern {
  readonly id = 'dead-clc';
  readonly description = 'Remove CLC when carry is dead';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (getCarryFlagType(inst) !== CarryFlagType.CLC) {
      return null;
    }
    
    // Check: Is carry dead (from liveness analysis)?
    if (!inst.metadata?.get('carryIsDead')) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([]),
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
 * Pattern: Dead SEC (carry never read before being overwritten)
 * 
 * Before:
 *   SEC
 *   ... operations that don't read carry ...
 *   ASL A      ; Overwrites carry (shifts into carry)
 * 
 * After:
 *   (SEC eliminated)
 *   ... operations ...
 *   ASL A
 * 
 * Requires liveness analysis on carry flag.
 * Saves: 2 cycles, 1 byte
 */
export class DeadSECPattern extends BasePattern {
  readonly id = 'dead-sec';
  readonly description = 'Remove SEC when carry is dead';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (getCarryFlagType(inst) !== CarryFlagType.SEC) {
      return null;
    }
    
    // Check: Is carry dead (from liveness analysis)?
    if (!inst.metadata?.get('carryIsDead')) {
      return null;
    }
    
    return {
      matched: [inst],
      captures: this.capture([]),
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
 * Register all carry flag patterns
 */
export function registerCarryFlagPatterns(registry: PatternRegistry): void {
  registry.register(new DoubleCLCPattern());
  registry.register(new DoubleSECPattern());
  registry.register(new DeadCLCBeforeSECPattern());
  registry.register(new DeadSECBeforeCLCPattern());
  registry.register(new RedundantCLCPattern());
  registry.register(new RedundantSECPattern());
  registry.register(new DeadCLCPattern());
  registry.register(new DeadSECPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `getCarryFlagType CLC` | Correctly identifies CLC |
| `getCarryFlagType SEC` | Correctly identifies SEC |
| `getCarryFlagType non-flag` | Returns null for non-flag ops |
| `readsCarryFlag ADC` | ADC reads carry |
| `readsCarryFlag SBC` | SBC reads carry |
| `readsCarryFlag ROL` | ROL reads carry |
| `readsCarryFlag ROR` | ROR reads carry |
| `readsCarryFlag BCC` | BCC reads carry |
| `readsCarryFlag BCS` | BCS reads carry |
| `readsCarryFlag LDA` | LDA doesn't read carry |
| `writesCarryFlag ADC` | ADC writes carry |
| `writesCarryFlag CMP` | CMP writes carry |
| `writesCarryFlag ASL` | ASL writes carry |
| `DoubleCLC match` | Matches CLC CLC |
| `DoubleCLC no match` | No match for CLC SEC |
| `DoubleCLC replace` | Keeps first CLC |
| `DoubleSEC match` | Matches SEC SEC |
| `DoubleSEC no match` | No match for SEC CLC |
| `DoubleSEC replace` | Keeps first SEC |
| `DeadCLCBeforeSEC match` | Matches CLC SEC |
| `DeadCLCBeforeSEC replace` | Keeps only SEC |
| `DeadSECBeforeCLC match` | Matches SEC CLC |
| `DeadSECBeforeCLC replace` | Keeps only CLC |
| `RedundantCLC match` | Matches when carry known 0 |
| `RedundantCLC no match` | No match without known carry |
| `RedundantSEC match` | Matches when carry known 1 |
| `RedundantSEC no match` | No match without known carry |
| `DeadCLC match` | Matches when carry is dead |
| `DeadCLC no match` | No match when carry is live |
| `DeadSEC match` | Matches when carry is dead |
| `DeadSEC no match` | No match when carry is live |
| `register all` | All patterns registered correctly |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerCarryFlagPatterns } from './patterns/flag-carry.js';

// Register all carry flag patterns
registerCarryFlagPatterns(patternRegistry);
```

### Analysis Dependencies

| Pattern | Required Analysis |
|---------|-------------------|
| RedundantCLCPattern | Carry flag tracking |
| RedundantSECPattern | Carry flag tracking |
| DeadCLCPattern | Liveness analysis (carry) |
| DeadSECPattern | Liveness analysis (carry) |

### Carry Flag Tracking

For advanced patterns, the optimizer needs to track carry flag state:

```typescript
interface CarryFlagState {
  /** Is the carry value known? */
  known: boolean;
  /** Carry value (0 or 1) if known */
  value?: 0 | 1;
  /** Is carry live (will be read)? */
  live: boolean;
}

// Example: After CMP instruction
// - known: depends on operands
// - value: can be determined with constant propagation
// - live: depends on subsequent instructions
```

---

## Optimization Examples

### Example 1: Double CLC Elimination

```asm
; Before optimization (perhaps from macro expansion)
  CLC
  CLC       ; Redundant

; After optimization
  CLC
```

### Example 2: Dead CLC Before SEC

```asm
; Before (perhaps from separate code sections)
  CLC       ; Preparing for ADC
  ; Oops, we actually need subtraction:
  SEC       ; CLC was pointless

; After
  SEC
```

### Example 3: Redundant CLC After Known State

```asm
; Before
  CMP #$00    ; Carry = 1 (A >= 0 always true for unsigned)
  BCC error   ; Never taken since carry is always set
  CLC         ; But wait, if BCC was taken, carry WAS 0
              ; This CLC is redundant on the fall-through path!

; After (on fall-through path, carry is known to be 1)
  CMP #$00
  BCC error
              ; CLC removed (wasn't needed if we know context)
```

### Example 4: ADC Chain with Single CLC

```asm
; Before
  CLC
  LDA num1
  ADC num2
  CLC         ; Redundant if we want multi-byte add!
  LDA num1+1
  ADC num2+1  ; This needs carry from previous ADC!

; After (assuming single-byte add, both CLCs correct)
; OR (if multi-byte add intended, second CLC is a BUG)

; Pattern detects: if liveness shows carry is live into
; second ADC, CLC cannot be removed
```

### Example 5: Dead Carry Before Overwrite

```asm
; Before
  SEC
  LDA #$42
  STA $10
  CMP #$20    ; Overwrites carry anyway

; After
  LDA #$42
  STA $10
  CMP #$20    ; SEC was dead
```

---

## Safety Considerations

### Interrupt Safety

Carry flag manipulation is interrupt-safe:
- CLC and SEC are atomic (single instruction)
- Carry flag is saved/restored by interrupt handlers via PHP/PLP
- No special considerations needed

### Branch Path Analysis

When analyzing carry state across branches:
- BCC taken: carry was 0
- BCC not taken: carry was 1
- BCS taken: carry was 1
- BCS not taken: carry was 0

This enables path-sensitive optimization:

```typescript
// After BCC (branch if carry clear)
// Taken path: carry is known to be 0
// Fall-through path: carry is known to be 1
```

### Preserving Semantics

Never remove CLC/SEC if:
1. Carry is subsequently read by ADC, SBC, ROL, ROR
2. Carry is tested by BCC or BCS
3. Carry state is not definitively known
4. Intervening code could modify carry in unknown ways

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `flag-carry.ts` | [ ] |
| Implement getCarryFlagType helper | [ ] |
| Implement readsCarryFlag helper | [ ] |
| Implement writesCarryFlag helper | [ ] |
| Implement DoubleCLCPattern | [ ] |
| Implement DoubleSECPattern | [ ] |
| Implement DeadCLCBeforeSECPattern | [ ] |
| Implement DeadSECBeforeCLCPattern | [ ] |
| Implement RedundantCLCPattern | [ ] |
| Implement RedundantSECPattern | [ ] |
| Implement DeadCLCPattern | [ ] |
| Implement DeadSECPattern | [ ] |
| Implement registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.6b → `08-06b-transfer-stack.md`  
**Next Task**: 8.7b → `08-07b-flag-status.md`