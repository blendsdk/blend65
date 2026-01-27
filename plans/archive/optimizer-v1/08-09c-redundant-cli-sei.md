# 8.9c: CLI/SEI Interrupt Flag Redundancy Patterns

> **Document**: `08-09c-redundant-cli-sei.md`
> **Phase**: 08-peephole
> **Task**: 8.9c - CLI/SEI interrupt flag patterns
> **Focus**: Interrupt enable/disable flag redundancy detection and elimination

---

## Overview

CLI (Clear Interrupt disable) and SEI (Set Interrupt disable) control whether the CPU responds to IRQ interrupts. These instructions are critical for interrupt handling and critical sections. Redundant interrupt flag manipulation wastes cycles and can lead to confusion about interrupt state.

---

## Pattern Categories

### Category 1: Consecutive CLI Instructions

Multiple CLI instructions in sequence are always redundant.

```
Pattern: CLI → CLI → ...
Result:  CLI (single)
Savings: 2 cycles, 1 byte per eliminated CLI
```

#### Implementation

```typescript
/**
 * Detects consecutive CLI instructions
 * 
 * @pattern CLI CLI+ → CLI
 * @safety Always safe - interrupt flag only cleared once
 * @savings 2 cycles, 1 byte per removed CLI
 */
export const consecutiveCLIPattern: PeepholePattern = {
  name: 'consecutive-cli',
  description: 'Remove consecutive CLI instructions',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return first.opcode === Opcode.CLI && 
           second.opcode === Opcode.CLI;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    let removeCount = 0;
    let index = 1;
    
    while (index < window.size && 
           window.get(index).opcode === Opcode.CLI) {
      removeCount++;
      index++;
    }
    
    return {
      remove: createRangeArray(1, removeCount + 1),
      insert: [],
      cyclesSaved: removeCount * 2,
      bytesSaved: removeCount
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 2: Consecutive SEI Instructions

Multiple SEI instructions in sequence are always redundant.

```
Pattern: SEI → SEI → ...
Result:  SEI (single)
Savings: 2 cycles, 1 byte per eliminated SEI
```

#### Implementation

```typescript
/**
 * Detects consecutive SEI instructions
 * 
 * @pattern SEI SEI+ → SEI
 * @safety Always safe - interrupt flag only set once
 * @savings 2 cycles, 1 byte per removed SEI
 */
export const consecutiveSEIPattern: PeepholePattern = {
  name: 'consecutive-sei',
  description: 'Remove consecutive SEI instructions',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return first.opcode === Opcode.SEI && 
           second.opcode === Opcode.SEI;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    let removeCount = 0;
    let index = 1;
    
    while (index < window.size && 
           window.get(index).opcode === Opcode.SEI) {
      removeCount++;
      index++;
    }
    
    return {
      remove: createRangeArray(1, removeCount + 1),
      insert: [],
      cyclesSaved: removeCount * 2,
      bytesSaved: removeCount
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 3: CLI Before SEI (Opposite Operations)

CLI followed by SEI is completely redundant - only SEI takes effect.

```
Pattern: CLI → SEI
Result:  SEI
Savings: 2 cycles, 1 byte
```

**CAUTION**: This pattern must be applied carefully. Between CLI and SEI, an interrupt could occur. This is sometimes intentional (allowing one interrupt opportunity).

#### Implementation

```typescript
/**
 * Detects CLI immediately followed by SEI
 * 
 * @pattern CLI SEI → SEI
 * @safety CAUTION - may be intentional interrupt window
 * @savings 2 cycles, 1 byte
 */
export const cliFollowedBySeiPattern: PeepholePattern = {
  name: 'cli-followed-by-sei',
  description: 'Remove CLI when immediately followed by SEI',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return first.opcode === Opcode.CLI && 
           second.opcode === Opcode.SEI;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0], // Remove the CLI
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  // Mark as requiring confirmation due to interrupt window concerns
  requiresConfirmation: true,
  confirmationMessage: 'CLI immediately before SEI may be intentional interrupt window',
  priority: PatternPriority.MEDIUM,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 4: SEI Before CLI (Opposite Operations)

SEI followed by CLI is completely redundant - only CLI takes effect.

```
Pattern: SEI → CLI
Result:  CLI
Savings: 2 cycles, 1 byte
```

**Note**: This pattern is less common but can occur in code that tries to briefly disable then re-enable interrupts.

#### Implementation

```typescript
/**
 * Detects SEI immediately followed by CLI
 * 
 * @pattern SEI CLI → CLI
 * @safety Safe - SEI effect immediately overwritten
 * @savings 2 cycles, 1 byte
 */
export const seiFollowedByCliPattern: PeepholePattern = {
  name: 'sei-followed-by-cli',
  description: 'Remove SEI when immediately followed by CLI',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    const second = window.get(1);
    
    return first.opcode === Opcode.SEI && 
           second.opcode === Opcode.CLI;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  priority: PatternPriority.HIGH,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 5: CLI/SEI with Gap (Interrupt Flag Not Read)

CLI or SEI followed by the opposite operation with intervening non-interrupt-checking code.

```
Pattern: CLI → (no IRQ code) → SEI
Result:  SEI (if no interrupt opportunity matters)
```

```
Pattern: SEI → (no IRQ code) → CLI
Result:  CLI (if critical section had no purpose)
```

#### Implementation

```typescript
/**
 * Instructions that might depend on interrupt state or be
 * affected by interrupts executing
 */
const INTERRUPT_SENSITIVE_INSTRUCTIONS = new Set([
  // These could be interrupted or depend on interrupt state
  Opcode.WAI,  // Wait for interrupt (65C02)
  Opcode.RTI,  // Return from interrupt
  Opcode.BRK,  // Software interrupt
]);

/**
 * Detects CLI followed by SEI with no interrupt-sensitive code between
 * 
 * @pattern CLI (non-sensitive)* SEI → SEI
 * @safety Only if interrupt window not intentional
 * @savings 2 cycles, 1 byte
 */
export const cliGapSeiPattern: PeepholePattern = {
  name: 'cli-gap-sei',
  description: 'Remove CLI before SEI when interrupts not used between',
  
  match(window: InstructionWindow): boolean {
    if (window.size < 2) return false;
    
    const first = window.get(0);
    if (first.opcode !== Opcode.CLI) return false;
    
    for (let i = 1; i < window.size; i++) {
      const instr = window.get(i);
      
      if (instr.opcode === Opcode.SEI) {
        return true;
      }
      
      if (INTERRUPT_SENSITIVE_INSTRUCTIONS.has(instr.opcode)) {
        return false;
      }
      
      // Check for any instruction that might be intentionally interruptible
      if (isLongRunningOperation(instr)) {
        return false;
      }
    }
    
    return false;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  requiresConfirmation: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 6: CLI When Interrupts Already Enabled

If we know interrupts are already enabled, CLI is redundant.

```
Pattern: (interrupts enabled) → CLI
Result:  (nothing)
Savings: 2 cycles, 1 byte
```

#### Implementation

```typescript
/**
 * Detects CLI when interrupt flag already clear (interrupts enabled)
 * 
 * @pattern (I=0) CLI → nothing
 * @safety Requires interrupt state tracking
 * @savings 2 cycles, 1 byte
 */
export const cliWhenEnabledPattern: PeepholePattern = {
  name: 'cli-when-enabled',
  description: 'Remove CLI when interrupts already enabled',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.CLI) return false;
    
    return state.interruptDisable === FlagState.CLEAR;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  requiresState: true,
  priority: PatternPriority.MEDIUM,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 7: SEI When Interrupts Already Disabled

If we know interrupts are already disabled, SEI is redundant.

```
Pattern: (interrupts disabled) → SEI
Result:  (nothing)
Savings: 2 cycles, 1 byte
```

#### Implementation

```typescript
/**
 * Detects SEI when interrupt flag already set (interrupts disabled)
 * 
 * @pattern (I=1) SEI → nothing
 * @safety Requires interrupt state tracking
 * @savings 2 cycles, 1 byte
 */
export const seiWhenDisabledPattern: PeepholePattern = {
  name: 'sei-when-disabled',
  description: 'Remove SEI when interrupts already disabled',
  
  match(window: InstructionWindow, state: CPUState): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.SEI) return false;
    
    return state.interruptDisable === FlagState.SET;
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  requiresState: true,
  priority: PatternPriority.MEDIUM,
  category: PatternCategory.REDUNDANCY
};
```

---

### Category 8: Dead CLI/SEI (Never Reaches Interrupt-Dependent Code)

CLI or SEI followed by code that never actually depends on interrupt state.

```
Pattern: CLI → (no IRQ dependency) → (function return)
Result:  (no IRQ dependency) → (function return)
```

#### Implementation

```typescript
/**
 * Detects CLI that has no effect before function ends
 * 
 * @pattern CLI (non-IRQ-code)* RTS → (non-IRQ-code)* RTS
 * @safety Requires control flow and calling convention analysis
 * @savings 2 cycles, 1 byte
 */
export const deadCLIPattern: PeepholePattern = {
  name: 'dead-cli',
  description: 'Remove CLI when interrupt state not used before exit',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.CLI) return false;
    
    // Check if interrupt state matters for remainder of function
    return !cfg.isInterruptStateLiveAfter(instr);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.DEAD_CODE
};

/**
 * Detects SEI that has no effect before function ends
 */
export const deadSEIPattern: PeepholePattern = {
  name: 'dead-sei',
  description: 'Remove SEI when interrupt state not used before exit',
  
  match(window: InstructionWindow, state: CPUState, cfg: CFGAnalysis): boolean {
    if (window.size < 1) return false;
    
    const instr = window.get(0);
    if (instr.opcode !== Opcode.SEI) return false;
    
    return !cfg.isInterruptStateLiveAfter(instr);
  },
  
  apply(window: InstructionWindow): PeepholeResult {
    return {
      remove: [0],
      insert: [],
      cyclesSaved: 2,
      bytesSaved: 1
    };
  },
  
  requiresCFG: true,
  priority: PatternPriority.LOW,
  category: PatternCategory.DEAD_CODE
};
```

---

## Interrupt State Tracking

### State Enumeration

```typescript
/**
 * Tracks known interrupt disable flag state
 */
export interface InterruptState {
  /** Interrupt disable flag (I flag in status register) */
  interruptDisable: FlagState;
  
  /** Whether we're inside an interrupt handler */
  inInterruptHandler: boolean;
  
  /** Nesting depth of SEI calls */
  criticalSectionDepth: number;
}

/**
 * Initial interrupt state (usually unknown)
 */
export const INITIAL_INTERRUPT_STATE: InterruptState = {
  interruptDisable: FlagState.UNKNOWN,
  inInterruptHandler: false,
  criticalSectionDepth: 0
};

/**
 * Interrupt state after RESET (interrupts disabled)
 */
export const RESET_INTERRUPT_STATE: InterruptState = {
  interruptDisable: FlagState.SET,
  inInterruptHandler: false,
  criticalSectionDepth: 0
};
```

### State Update Functions

```typescript
/**
 * Updates interrupt state after CLI instruction
 */
function updateStateAfterCLI(state: InterruptState): InterruptState {
  return {
    ...state,
    interruptDisable: FlagState.CLEAR,
    criticalSectionDepth: 0
  };
}

/**
 * Updates interrupt state after SEI instruction
 */
function updateStateAfterSEI(state: InterruptState): InterruptState {
  return {
    ...state,
    interruptDisable: FlagState.SET,
    criticalSectionDepth: state.criticalSectionDepth + 1
  };
}

/**
 * Updates interrupt state after PLP instruction
 * (Restores flags from stack - interrupt state becomes unknown)
 */
function updateStateAfterPLP(state: InterruptState): InterruptState {
  return {
    ...state,
    interruptDisable: FlagState.UNKNOWN,
    criticalSectionDepth: 0
  };
}

/**
 * Updates interrupt state after RTI instruction
 * (Return from interrupt - restores flags, exits handler)
 */
function updateStateAfterRTI(state: InterruptState): InterruptState {
  return {
    ...state,
    interruptDisable: FlagState.UNKNOWN,
    inInterruptHandler: false,
    criticalSectionDepth: 0
  };
}
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('CLI/SEI Redundancy Elimination', () => {
  describe('Consecutive CLI', () => {
    it('should remove second CLI in CLI CLI sequence', () => {
      const input = [
        { opcode: Opcode.CLI },
        { opcode: Opcode.CLI }
      ];
      
      const result = applyPattern(consecutiveCLIPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.CLI }
      ]);
      expect(result.cyclesSaved).toBe(2);
    });
  });
  
  describe('Consecutive SEI', () => {
    it('should remove second SEI in SEI SEI sequence', () => {
      const input = [
        { opcode: Opcode.SEI },
        { opcode: Opcode.SEI }
      ];
      
      const result = applyPattern(consecutiveSEIPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.SEI }
      ]);
    });
  });
  
  describe('CLI followed by SEI', () => {
    it('should remove CLI when immediately followed by SEI', () => {
      const input = [
        { opcode: Opcode.CLI },
        { opcode: Opcode.SEI }
      ];
      
      const result = applyPattern(cliFollowedBySeiPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.SEI }
      ]);
      expect(result.requiresConfirmation).toBe(true);
    });
  });
  
  describe('SEI followed by CLI', () => {
    it('should remove SEI when immediately followed by CLI', () => {
      const input = [
        { opcode: Opcode.SEI },
        { opcode: Opcode.CLI }
      ];
      
      const result = applyPattern(seiFollowedByCliPattern, input);
      
      expect(result.instructions).toEqual([
        { opcode: Opcode.CLI }
      ]);
    });
  });
  
  describe('CLI when already enabled', () => {
    it('should remove CLI when interrupts already enabled', () => {
      const state: CPUState = {
        interruptDisable: FlagState.CLEAR
      };
      
      const input = [
        { opcode: Opcode.CLI }
      ];
      
      const result = applyPattern(cliWhenEnabledPattern, input, state);
      
      expect(result.instructions).toEqual([]);
    });
    
    it('should NOT remove CLI when interrupt state unknown', () => {
      const state: CPUState = {
        interruptDisable: FlagState.UNKNOWN
      };
      
      const input = [
        { opcode: Opcode.CLI }
      ];
      
      const result = applyPattern(cliWhenEnabledPattern, input, state);
      
      expect(result.matched).toBe(false);
    });
  });
  
  describe('SEI when already disabled', () => {
    it('should remove SEI when interrupts already disabled', () => {
      const state: CPUState = {
        interruptDisable: FlagState.SET
      };
      
      const input = [
        { opcode: Opcode.SEI }
      ];
      
      const result = applyPattern(seiWhenDisabledPattern, input, state);
      
      expect(result.instructions).toEqual([]);
    });
  });
});
```

---

## Safety Considerations

### Interrupt Window Intentionality

The CLI→SEI pattern sometimes represents an **intentional interrupt window**:

```asm
; Allow one IRQ to fire
SEI              ; Disable interrupts (initial state)
; ... setup code ...
CLI              ; Enable - IRQ can now fire
SEI              ; Disable again - small window closed
```

The optimizer should flag this pattern for review rather than automatically removing it.

### Interrupt Handler Context

Inside interrupt handlers, the interrupt disable flag is automatically set. Patterns involving CLI inside handlers may have different semantics (allowing nested interrupts).

### PLP Considerations

PLP restores all flags from stack, including interrupt disable. After PLP, the interrupt state becomes unknown, limiting optimization opportunities.

---

## Optimization Statistics

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| Consecutive CLI | Rare | 2/instance | 1/instance |
| Consecutive SEI | Rare | 2/instance | 1/instance |
| CLI→SEI | Moderate | 2 | 1 |
| SEI→CLI | Rare | 2 | 1 |
| CLI (enabled) | Rare | 2 | 1 |
| SEI (disabled) | Moderate | 2 | 1 |
| Dead CLI/SEI | Rare | 2 | 1 |

---

## Integration Notes

### Pattern Ordering

CLI/SEI redundancy patterns should run:
1. **After** control flow analysis (for dead code detection)
2. **After** interrupt handler identification
3. **With** confirmation prompts for CLI→SEI patterns
4. **Before** final instruction scheduling

### Dependencies

- Requires: `InterruptStateTracker`
- Optional: `CFGAnalysis` (for dead CLI/SEI patterns)
- Related: `08-07b-flag-status.md` (general flag patterns)

---

## Summary

This document covers eight categories of CLI/SEI redundancy:

1. **Consecutive CLI** - Multiple CLIs in sequence
2. **Consecutive SEI** - Multiple SEIs in sequence
3. **CLI→SEI** - Opposite operations (with caution)
4. **SEI→CLI** - Opposite operations
5. **CLI/SEI with gap** - Non-sensitive code between
6. **CLI when enabled** - Interrupts already on
7. **SEI when disabled** - Interrupts already off
8. **Dead CLI/SEI** - No downstream effect

Total potential savings: 2-8+ cycles per occurrence.