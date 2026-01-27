# Task 8.7b: Status Flag Patterns

> **Task**: 8.7b of 25 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~24 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement status flag manipulation peephole patterns for the 6502:
- CLI (Clear Interrupt Disable)
- SEI (Set Interrupt Disable)
- CLV (Clear Overflow Flag)

These patterns identify and eliminate redundant, dead, or unnecessary status flag operations.

---

## 6502 Status Flag Instruction Reference

| Instruction | Operation | Cycles | Bytes | Flags Affected |
|-------------|-----------|--------|-------|----------------|
| CLI | I ← 0 | 2 | 1 | I only |
| SEI | I ← 1 | 2 | 1 | I only |
| CLV | V ← 0 | 2 | 1 | V only |

**Key Properties:**
- All instructions are 2 cycles, 1 byte
- Each instruction affects only ONE flag
- No memory access required
- **Note**: There is NO SEV instruction on the 6502!

**Interrupt Flag (I) Usage:**
- SEI: Disables maskable interrupts (IRQ)
- CLI: Re-enables maskable interrupts
- Interrupt flag does NOT affect NMI (non-maskable)
- Critical sections use SEI...CLI pairs

**Overflow Flag (V) Usage:**
- Set by ADC/SBC when signed overflow occurs
- Set by BIT instruction (V ← M6, bit 6 of memory)
- Tested by BVC (Branch if Overflow Clear) and BVS (Branch if Overflow Set)
- CLV is the ONLY way to explicitly clear V (no arithmetic resets it)

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                   # Pattern exports
├── flag-carry.ts              # Carry flag patterns (8.7a)
└── flag-status.ts             # THIS TASK
```

---

## Implementation

### File: `flag-status.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';
import { PatternRegistry } from '../registry.js';

/**
 * Status flag instruction types
 */
export enum StatusFlagType {
  CLI = 'CLI', // Clear Interrupt Disable (I ← 0, enables IRQ)
  SEI = 'SEI', // Set Interrupt Disable (I ← 1, disables IRQ)
  CLV = 'CLV', // Clear Overflow (V ← 0)
}

/**
 * Get status flag instruction type
 */
export function getStatusFlagType(inst: ILInstruction): StatusFlagType | null {
  if (inst.opcode !== ILOpcode.FlagOp) {
    return null;
  }
  
  const op = inst.metadata?.get('flagOp') as string;
  
  if (op === 'CLI') return StatusFlagType.CLI;
  if (op === 'SEI') return StatusFlagType.SEI;
  if (op === 'CLV') return StatusFlagType.CLV;
  
  return null;
}

/**
 * Check if instruction reads the interrupt flag
 * 
 * Note: No 6502 instruction directly reads the I flag.
 * The I flag affects interrupt handling behavior, not instruction execution.
 */
export function readsInterruptFlag(_inst: ILInstruction): boolean {
  // No instruction reads I flag - it's a processor behavior flag
  return false;
}

/**
 * Check if instruction writes the interrupt flag
 */
export function writesInterruptFlag(inst: ILInstruction): boolean {
  if (inst.opcode !== ILOpcode.FlagOp) {
    return false;
  }
  
  const op = inst.metadata?.get('flagOp') as string;
  return op === 'CLI' || op === 'SEI';
}

/**
 * Check if instruction reads the overflow flag
 */
export function readsOverflowFlag(inst: ILInstruction): boolean {
  // BVC and BVS branch based on overflow flag
  if (inst.opcode === ILOpcode.Branch) {
    const condition = inst.metadata?.get('condition');
    return condition === 'BVC' || condition === 'BVS';
  }
  
  return false;
}

/**
 * Check if instruction writes the overflow flag
 */
export function writesOverflowFlag(inst: ILInstruction): boolean {
  const opcode = inst.opcode;
  
  // ADC and SBC set overflow based on signed arithmetic
  if (opcode === ILOpcode.Add || opcode === ILOpcode.Sub) {
    return true;
  }
  
  // BIT sets V from bit 6 of memory operand
  if (opcode === ILOpcode.BitTest) {
    return true;
  }
  
  // CLV explicitly clears overflow
  if (opcode === ILOpcode.FlagOp) {
    const op = inst.metadata?.get('flagOp') as string;
    return op === 'CLV';
  }
  
  return false;
}

// ============================================================
// Interrupt Flag Patterns (CLI/SEI)
// ============================================================

/**
 * Pattern: Double SEI
 * 
 * Before:
 *   SEI
 *   SEI
 * 
 * After:
 *   SEI
 *   (second SEI eliminated - interrupts already disabled)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DoubleSEIPattern extends BasePattern {
  readonly id = 'double-sei';
  readonly description = 'Remove consecutive SEI instructions';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getStatusFlagType(first);
    const t2 = getStatusFlagType(second);
    
    if (t1 !== StatusFlagType.SEI || t2 !== StatusFlagType.SEI) {
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
 * Pattern: Double CLI
 * 
 * Before:
 *   CLI
 *   CLI
 * 
 * After:
 *   CLI
 *   (second CLI eliminated - interrupts already enabled)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DoubleCLIPattern extends BasePattern {
  readonly id = 'double-cli';
  readonly description = 'Remove consecutive CLI instructions';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getStatusFlagType(first);
    const t2 = getStatusFlagType(second);
    
    if (t1 !== StatusFlagType.CLI || t2 !== StatusFlagType.CLI) {
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
 * Pattern: SEI immediately followed by CLI (dead SEI)
 * 
 * Before:
 *   SEI
 *   CLI
 * 
 * After:
 *   CLI
 *   (SEI eliminated - immediately re-enabled)
 * 
 * WARNING: This is potentially DANGEROUS! The SEI...CLI pair may
 * exist to protect a critical section. Only match if we can prove
 * no critical section exists between them.
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DeadSEIBeforeCLIPattern extends BasePattern {
  readonly id = 'dead-sei-before-cli';
  readonly description = 'Remove SEI immediately followed by CLI';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getStatusFlagType(first);
    const t2 = getStatusFlagType(second);
    
    // Must be directly adjacent SEI → CLI
    if (t1 !== StatusFlagType.SEI || t2 !== StatusFlagType.CLI) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([]),
      confidence: 0.8, // Lower confidence due to potential critical section
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[1]], // Keep only CLI
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Pattern: CLI immediately followed by SEI (dead CLI)
 * 
 * Before:
 *   CLI
 *   SEI
 * 
 * After:
 *   SEI
 *   (CLI eliminated - immediately disabled again)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DeadCLIBeforeSEIPattern extends BasePattern {
  readonly id = 'dead-cli-before-sei';
  readonly description = 'Remove CLI immediately followed by SEI';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getStatusFlagType(first);
    const t2 = getStatusFlagType(second);
    
    if (t1 !== StatusFlagType.CLI || t2 !== StatusFlagType.SEI) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [match.matched[1]], // Keep only SEI
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
}

/**
 * Pattern: Redundant SEI when interrupts known disabled
 * 
 * Before:
 *   SEI
 *   ... code that doesn't enable interrupts ...
 *   SEI         ; Redundant
 * 
 * After:
 *   SEI
 *   ... code ...
 *   (second SEI eliminated)
 * 
 * Requires interrupt state tracking.
 * Saves: 2 cycles, 1 byte
 */
export class RedundantSEIPattern extends BasePattern {
  readonly id = 'redundant-sei';
  readonly description = 'Remove SEI when interrupts known disabled';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (getStatusFlagType(inst) !== StatusFlagType.SEI) {
      return null;
    }
    
    // Check: Are interrupts known to be disabled from analysis?
    const intKnown = inst.metadata?.get('interruptKnown');
    const intDisabled = inst.metadata?.get('interruptDisabled');
    
    if (!intKnown || !intDisabled) {
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
 * Pattern: Redundant CLI when interrupts known enabled
 * 
 * Before:
 *   CLI
 *   ... code that doesn't disable interrupts ...
 *   CLI         ; Redundant
 * 
 * After:
 *   CLI
 *   ... code ...
 *   (second CLI eliminated)
 * 
 * Requires interrupt state tracking.
 * Saves: 2 cycles, 1 byte
 */
export class RedundantCLIPattern extends BasePattern {
  readonly id = 'redundant-cli';
  readonly description = 'Remove CLI when interrupts known enabled';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (getStatusFlagType(inst) !== StatusFlagType.CLI) {
      return null;
    }
    
    // Check: Are interrupts known to be enabled from analysis?
    const intKnown = inst.metadata?.get('interruptKnown');
    const intEnabled = inst.metadata?.get('interruptEnabled');
    
    if (!intKnown || !intEnabled) {
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

// ============================================================
// Overflow Flag Patterns (CLV)
// ============================================================

/**
 * Pattern: Double CLV
 * 
 * Before:
 *   CLV
 *   CLV
 * 
 * After:
 *   CLV
 *   (second CLV eliminated - overflow already clear)
 * 
 * Saves: 2 cycles, 1 byte
 */
export class DoubleCLVPattern extends BasePattern {
  readonly id = 'double-clv';
  readonly description = 'Remove consecutive CLV instructions';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    const t1 = getStatusFlagType(first);
    const t2 = getStatusFlagType(second);
    
    if (t1 !== StatusFlagType.CLV || t2 !== StatusFlagType.CLV) {
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
 * Pattern: Redundant CLV when overflow known clear
 * 
 * Before:
 *   CLV
 *   LDA #$42     ; Doesn't affect V
 *   STA $10      ; Doesn't affect V
 *   CLV          ; Redundant - V still clear
 * 
 * After:
 *   CLV
 *   LDA #$42
 *   STA $10
 *   (second CLV eliminated)
 * 
 * Requires overflow state tracking.
 * Saves: 2 cycles, 1 byte
 */
export class RedundantCLVPattern extends BasePattern {
  readonly id = 'redundant-clv';
  readonly description = 'Remove CLV when overflow known clear';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (getStatusFlagType(inst) !== StatusFlagType.CLV) {
      return null;
    }
    
    // Check: Is overflow known to be clear from analysis?
    const overflowKnown = inst.metadata?.get('overflowKnown');
    const overflowClear = inst.metadata?.get('overflowClear');
    
    if (!overflowKnown || !overflowClear) {
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
 * Pattern: Dead CLV (overflow never read)
 * 
 * Before:
 *   CLV
 *   ... operations ...
 *   ADC #$10     ; Overwrites V anyway
 * 
 * After:
 *   ... operations ...
 *   ADC #$10     ; CLV was dead
 * 
 * Requires liveness analysis.
 * Saves: 2 cycles, 1 byte
 */
export class DeadCLVPattern extends BasePattern {
  readonly id = 'dead-clv';
  readonly description = 'Remove CLV when overflow is dead';
  readonly category = PatternCategory.Flag;
  readonly levels = [OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (getStatusFlagType(inst) !== StatusFlagType.CLV) {
      return null;
    }
    
    // Check: Is overflow dead (from liveness analysis)?
    if (!inst.metadata?.get('overflowIsDead')) {
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
 * Register all status flag patterns
 */
export function registerStatusFlagPatterns(registry: PatternRegistry): void {
  // Interrupt flag patterns
  registry.register(new DoubleSEIPattern());
  registry.register(new DoubleCLIPattern());
  registry.register(new DeadSEIBeforeCLIPattern());
  registry.register(new DeadCLIBeforeSEIPattern());
  registry.register(new RedundantSEIPattern());
  registry.register(new RedundantCLIPattern());
  
  // Overflow flag patterns
  registry.register(new DoubleCLVPattern());
  registry.register(new RedundantCLVPattern());
  registry.register(new DeadCLVPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `getStatusFlagType CLI` | Correctly identifies CLI |
| `getStatusFlagType SEI` | Correctly identifies SEI |
| `getStatusFlagType CLV` | Correctly identifies CLV |
| `getStatusFlagType non-flag` | Returns null for non-flag ops |
| `readsOverflowFlag BVC` | BVC reads overflow |
| `readsOverflowFlag BVS` | BVS reads overflow |
| `readsOverflowFlag LDA` | LDA doesn't read overflow |
| `writesOverflowFlag ADC` | ADC writes overflow |
| `writesOverflowFlag SBC` | SBC writes overflow |
| `writesOverflowFlag BIT` | BIT writes overflow |
| `writesOverflowFlag CLV` | CLV writes overflow |
| `DoubleSEI match` | Matches SEI SEI |
| `DoubleSEI replace` | Keeps first SEI |
| `DoubleCLI match` | Matches CLI CLI |
| `DoubleCLI replace` | Keeps first CLI |
| `DeadSEIBeforeCLI match` | Matches SEI CLI |
| `DeadSEIBeforeCLI replace` | Keeps only CLI |
| `DeadCLIBeforeSEI match` | Matches CLI SEI |
| `DeadCLIBeforeSEI replace` | Keeps only SEI |
| `RedundantSEI match` | Matches when ints disabled |
| `RedundantCLI match` | Matches when ints enabled |
| `DoubleCLV match` | Matches CLV CLV |
| `DoubleCLV replace` | Keeps first CLV |
| `RedundantCLV match` | Matches when V known clear |
| `DeadCLV match` | Matches when V is dead |
| `register all` | All patterns registered correctly |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerStatusFlagPatterns } from './patterns/flag-status.js';

// Register all status flag patterns
registerStatusFlagPatterns(patternRegistry);
```

### Analysis Dependencies

| Pattern | Required Analysis |
|---------|-------------------|
| RedundantSEIPattern | Interrupt state tracking |
| RedundantCLIPattern | Interrupt state tracking |
| RedundantCLVPattern | Overflow flag tracking |
| DeadCLVPattern | Liveness analysis (V flag) |

---

## Optimization Examples

### Example 1: Double SEI Elimination

```asm
; Before (perhaps from nested critical sections)
  SEI
  SEI       ; Redundant

; After
  SEI
```

### Example 2: Critical Section Optimization

```asm
; Before (empty critical section)
  SEI       ; Disable interrupts
  CLI       ; Enable interrupts (no code between!)

; After (both removed if pattern matches)
  ; Empty - no critical section needed
```

### Example 3: Dead SEI Before CLI

```asm
; Before
  SEI           ; Start critical section
  ; oops, nothing to protect here
  CLI           ; End critical section

; After (SEI was pointless)
  CLI
```

### Example 4: CLV After Known Clear

```asm
; Before
  CLV           ; Clear overflow
  LDA #$42      ; Load (doesn't affect V)
  STA score     ; Store (doesn't affect V)
  CLV           ; Redundant - V is still clear!

; After
  CLV
  LDA #$42
  STA score
              ; Second CLV removed
```

### Example 5: Dead CLV Before Arithmetic

```asm
; Before
  CLV           ; Clear overflow
  LDA num1
  ADC num2      ; This SETS overflow anyway!

; After
  LDA num1
  ADC num2      ; CLV was dead
```

---

## Safety Considerations

### Interrupt Safety: Critical Sections

**CAUTION**: SEI/CLI patterns require special care:

```asm
; DO NOT optimize this - it's a critical section!
  SEI
  LDA hardware_reg
  STA buffer
  CLI

; This IS safe to optimize:
  SEI
  CLI         ; Empty critical section
```

The optimizer should be conservative with SEI/CLI:
- Only optimize ADJACENT SEI/CLI pairs
- Never remove SEI if there's code between SEI and CLI
- Flag critical sections in metadata for protection

### Overflow Flag Considerations

The V flag has unique properties:
1. **No SEV**: Unlike carry (SEC) or interrupt (SEI), there's no "Set Overflow" instruction
2. **V is only set by**: ADC, SBC, and BIT instructions
3. **BIT's special behavior**: BIT copies memory bit 6 to V, bit 7 to N

```asm
; BIT's unique V behavior
  BIT $D012   ; V ← bit 6 of memory at $D012
              ; N ← bit 7 of memory at $D012
              ; Z ← result of A AND memory
```

### Interrupt Timing

When optimizing interrupt-related code:
- NMI is non-maskable (SEI has no effect on NMI)
- IRQ is blocked when I=1
- An interrupt occurring between SEI and CLI is delayed, not lost

```asm
; IRQ timing consideration:
  SEI           ; Block IRQ
  ; If IRQ occurs here, it's held pending
  CLI           ; IRQ fires immediately after CLI
```

---

## Flag State Tracking

For advanced patterns, track flag states:

```typescript
interface InterruptFlagState {
  /** Is interrupt state known? */
  known: boolean;
  /** Are interrupts disabled (I=1)? */
  disabled?: boolean;
}

interface OverflowFlagState {
  /** Is overflow state known? */
  known: boolean;
  /** Is overflow clear (V=0)? */
  clear?: boolean;
  /** Is overflow live (will be read)? */
  live: boolean;
}
```

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `flag-status.ts` | [ ] |
| Implement getStatusFlagType helper | [ ] |
| Implement readsInterruptFlag helper | [ ] |
| Implement writesInterruptFlag helper | [ ] |
| Implement readsOverflowFlag helper | [ ] |
| Implement writesOverflowFlag helper | [ ] |
| Implement DoubleSEIPattern | [ ] |
| Implement DoubleCLIPattern | [ ] |
| Implement DeadSEIBeforeCLIPattern | [ ] |
| Implement DeadCLIBeforeSEIPattern | [ ] |
| Implement RedundantSEIPattern | [ ] |
| Implement RedundantCLIPattern | [ ] |
| Implement DoubleCLVPattern | [ ] |
| Implement RedundantCLVPattern | [ ] |
| Implement DeadCLVPattern | [ ] |
| Implement registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.7a → `08-07a-flag-carry.md`  
**Next Task**: 8.8a → `08-08a-combining-core.md`