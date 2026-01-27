# Phase 6.3: Flag Optimization

> **Phase**: 6.3  
> **Parent**: [Phase 6 Index](00-phase-index.md)  
> **Est. Lines**: ~350  
> **Focus**: Track CPU flags to eliminate redundant flag operations

---

## Overview

The 6502 CPU has limited status flags (C, Z, N, V) that are implicitly set by many instructions. Naive code generation often includes redundant flag operations like `CMP #0` after `LDA` (which already sets Z/N flags) or `CLC` before additions that don't need carry.

This pass tracks flag state across instructions and eliminates redundant flag operations.

---

## Why Flag Optimization Matters

### Common Redundancies

| Pattern | Problem | Fix |
|---------|---------|-----|
| `LDA x; CMP #0` | LDA already sets Z flag | Remove CMP |
| `CLC; ADC #0` | Adding 0 doesn't overflow | Remove CLC |
| `SEC; SBC x; SEC` | Second SEC redundant | Remove second SEC |
| `LDA #0; CLC` | Loading 0 won't overflow | Remove CLC |

### Real-World Impact

```asm
; Naive compiler output (before)
    LDA counter
    CMP #0          ; Redundant! Z already correct
    BEQ done
    CLC             ; Maybe redundant depending on context
    ADC #1
    CMP #100        ; Sets Z/N/C
    BCC continue
    
; After flag optimization
    LDA counter     ; Sets Z
    BEQ done        ; Use Z from LDA
    ADC #1          ; CLC may be needed or not
    CMP #100
    BCC continue
```

---

## 6502 Flag Behavior Reference

### Flags Affected by Instructions

| Instruction | C | Z | N | V | Notes |
|-------------|---|---|---|---|-------|
| **Load/Store** |
| LDA, LDX, LDY | - | ✓ | ✓ | - | Z=1 if value=0, N=bit7 |
| STA, STX, STY | - | - | - | - | No flags affected |
| **Arithmetic** |
| ADC | ✓ | ✓ | ✓ | ✓ | Full flag update |
| SBC | ✓ | ✓ | ✓ | ✓ | Full flag update |
| **Compare** |
| CMP, CPX, CPY | ✓ | ✓ | ✓ | - | C=1 if A≥M |
| **Logic** |
| AND, ORA, EOR | - | ✓ | ✓ | - | Only Z and N |
| BIT | - | ✓ | ✓ | ✓ | Z from AND, N=bit7, V=bit6 |
| **Shift** |
| ASL, LSR | ✓ | ✓ | ✓ | - | C gets shifted bit |
| ROL, ROR | ✓ | ✓ | ✓ | - | C rotated through |
| **Inc/Dec** |
| INC, DEC | - | ✓ | ✓ | - | Memory inc/dec |
| INX, INY, DEX, DEY | - | ✓ | ✓ | - | Register inc/dec |
| **Flag** |
| CLC, SEC | ✓ | - | - | - | Explicit carry |
| CLV | - | - | - | ✓ | Clear overflow |
| CLI, SEI | - | - | - | - | Interrupt flag |
| **Transfer** |
| TAX, TAY, TXA, TYA | - | ✓ | ✓ | - | Sets Z/N from value |
| TXS | - | - | - | - | No flags! |
| TSX | - | ✓ | ✓ | - | Sets Z/N |
| **Stack** |
| PHA, PHP | - | - | - | - | No flags |
| PLA | - | ✓ | ✓ | - | Sets Z/N |
| PLP | ✓ | ✓ | ✓ | ✓ | Restores all flags |
| **Branch** |
| Bxx | - | - | - | - | No flags (just tests) |
| **Jump** |
| JMP, JSR | - | - | - | - | No flags |
| RTS, RTI | * | * | * | * | RTI restores flags |

---

## Architecture

### Pass Structure

```typescript
/**
 * Flag Optimization Pass
 * 
 * Tracks CPU flag state and eliminates redundant flag operations.
 */
export class FlagOptimizationPass implements Pass<AsmProgram> {
  readonly name = 'flag-optimization';
  readonly dependencies = [];  // No dependencies - works on raw ASM
  
  run(program: AsmProgram, context: PassContext): AsmProgram {
    let result = program;
    
    // Apply optimizations
    result = this.removeRedundantCmp(result);
    result = this.removeRedundantClc(result);
    result = this.removeRedundantSec(result);
    result = this.optimizeBranchOnFlags(result);
    
    return result;
  }
}
```

### Flag State Tracking

```typescript
/**
 * Represents known state of a CPU flag.
 */
type FlagState = 
  | { known: true; value: boolean }   // Known 0 or 1
  | { known: false }                  // Unknown
  | { known: 'from-result'; source: string };  // Set from previous result

/**
 * Complete CPU flag state.
 */
interface FlagStates {
  carry: FlagState;      // C
  zero: FlagState;       // Z
  negative: FlagState;   // N  
  overflow: FlagState;   // V
}

/**
 * Track flag state through instruction.
 */
protected updateFlagState(
  inst: AsmInstruction,
  state: FlagStates
): FlagStates {
  const newState = { ...state };
  
  switch (inst.opcode) {
    // Loads set Z and N from loaded value
    case Opcode.LDA:
    case Opcode.LDX:
    case Opcode.LDY:
      newState.zero = { known: 'from-result', source: inst.toString() };
      newState.negative = { known: 'from-result', source: inst.toString() };
      break;
      
    // Stores don't affect flags
    case Opcode.STA:
    case Opcode.STX:
    case Opcode.STY:
      // No change
      break;
      
    // ADC/SBC affect all flags
    case Opcode.ADC:
    case Opcode.SBC:
      newState.carry = { known: false };  // Result-dependent
      newState.zero = { known: 'from-result', source: inst.toString() };
      newState.negative = { known: 'from-result', source: inst.toString() };
      newState.overflow = { known: false };
      break;
      
    // CMP sets C, Z, N
    case Opcode.CMP:
    case Opcode.CPX:
    case Opcode.CPY:
      newState.carry = { known: false };  // A >= M
      newState.zero = { known: false };   // A == M
      newState.negative = { known: false };  // (A - M) bit 7
      break;
      
    // CLC/SEC set known carry
    case Opcode.CLC:
      newState.carry = { known: true, value: false };
      break;
    case Opcode.SEC:
      newState.carry = { known: true, value: true };
      break;
      
    // CLV clears overflow
    case Opcode.CLV:
      newState.overflow = { known: true, value: false };
      break;
      
    // Logic operations set Z/N
    case Opcode.AND:
    case Opcode.ORA:
    case Opcode.EOR:
      newState.zero = { known: 'from-result', source: inst.toString() };
      newState.negative = { known: 'from-result', source: inst.toString() };
      break;
      
    // Shifts affect C, Z, N
    case Opcode.ASL:
    case Opcode.LSR:
    case Opcode.ROL:
    case Opcode.ROR:
      newState.carry = { known: false };
      newState.zero = { known: 'from-result', source: inst.toString() };
      newState.negative = { known: 'from-result', source: inst.toString() };
      break;
      
    // Inc/Dec set Z/N
    case Opcode.INC:
    case Opcode.DEC:
    case Opcode.INX:
    case Opcode.INY:
    case Opcode.DEX:
    case Opcode.DEY:
      newState.zero = { known: 'from-result', source: inst.toString() };
      newState.negative = { known: 'from-result', source: inst.toString() };
      break;
      
    // PLP restores all flags (unknown)
    case Opcode.PLP:
    case Opcode.RTI:
      newState.carry = { known: false };
      newState.zero = { known: false };
      newState.negative = { known: false };
      newState.overflow = { known: false };
      break;
      
    // Transfers set Z/N
    case Opcode.TAX:
    case Opcode.TAY:
    case Opcode.TXA:
    case Opcode.TYA:
    case Opcode.TSX:
    case Opcode.PLA:
      newState.zero = { known: 'from-result', source: inst.toString() };
      newState.negative = { known: 'from-result', source: inst.toString() };
      break;
  }
  
  return newState;
}
```

---

## Optimization Patterns

### Pattern 1: Redundant CMP #0

After LDA/LDX/LDY, the Z flag is already set for zero comparison.

```asm
; Before
    LDA value       ; Sets Z=1 if value=0
    CMP #0          ; Redundant!
    BEQ zero_case

; After
    LDA value
    BEQ zero_case   ; Z already correct
```

```typescript
/**
 * Remove CMP #0 after instructions that set Z flag.
 */
protected removeRedundantCmp(program: AsmProgram): AsmProgram {
  return this.mapBlocks(program, block => {
    const newInsts: AsmInstruction[] = [];
    
    for (let i = 0; i < block.instructions.length; i++) {
      const inst = block.instructions[i];
      const prev = newInsts[newInsts.length - 1];
      
      // Check for CMP #0 after Z-setting instruction
      if (this.isCmpZero(inst) && prev && this.setsZFlag(prev)) {
        // Check if Z flag is still valid (not modified between)
        // In this simple case, prev is immediately before
        continue;  // Skip redundant CMP #0
      }
      
      newInsts.push(inst);
    }
    
    return { ...block, instructions: newInsts };
  });
}

/**
 * Check if instruction is CMP #0 (or CPX #0, CPY #0).
 */
protected isCmpZero(inst: AsmInstruction): boolean {
  if (inst.opcode !== Opcode.CMP && 
      inst.opcode !== Opcode.CPX && 
      inst.opcode !== Opcode.CPY) {
    return false;
  }
  
  return inst.addressingMode === AddressingMode.Immediate &&
         this.getOperandValue(inst) === 0;
}

/**
 * Check if instruction sets Z flag based on result.
 */
protected setsZFlag(inst: AsmInstruction): boolean {
  const zSetters = [
    Opcode.LDA, Opcode.LDX, Opcode.LDY,
    Opcode.AND, Opcode.ORA, Opcode.EOR,
    Opcode.ADC, Opcode.SBC,
    Opcode.ASL, Opcode.LSR, Opcode.ROL, Opcode.ROR,
    Opcode.INC, Opcode.DEC,
    Opcode.INX, Opcode.INY, Opcode.DEX, Opcode.DEY,
    Opcode.TAX, Opcode.TAY, Opcode.TXA, Opcode.TYA,
    Opcode.PLA, Opcode.TSX,
  ];
  
  return zSetters.includes(inst.opcode);
}
```

### Pattern 2: Redundant CLC Before ADC

CLC is only needed if carry might be set. After LDA #n (where n < 128), carry is definitely clear from any prior operation that set it.

```asm
; Before
    LDA #0
    CLC             ; Redundant - carry doesn't matter for LDA
    ADC value       ; Would need CLC if prior instruction set C

; After (more careful analysis needed)
    LDA #0
    ADC value       ; Only if we know C is clear
```

```typescript
/**
 * Remove redundant CLC instructions.
 */
protected removeRedundantClc(program: AsmProgram): AsmProgram {
  return this.mapBlocks(program, block => {
    const newInsts: AsmInstruction[] = [];
    let flagState = this.initialFlagState();
    
    for (const inst of block.instructions) {
      // Check for redundant CLC
      if (inst.opcode === Opcode.CLC) {
        if (flagState.carry.known && flagState.carry.value === false) {
          // Carry already clear - skip CLC
          continue;
        }
      }
      
      newInsts.push(inst);
      flagState = this.updateFlagState(inst, flagState);
    }
    
    return { ...block, instructions: newInsts };
  });
}
```

### Pattern 3: Redundant SEC Before SBC

Similarly, SEC before SBC is only needed if carry might be clear.

```asm
; Before
    SEC             ; Set carry for subtraction
    SBC #1
    SEC             ; Redundant! SBC sets carry based on borrow
    SBC #1

; After
    SEC
    SBC #1
    ; Second SEC might be needed depending on use case
    SBC #1
```

```typescript
/**
 * Remove redundant SEC instructions.
 */
protected removeRedundantSec(program: AsmProgram): AsmProgram {
  return this.mapBlocks(program, block => {
    const newInsts: AsmInstruction[] = [];
    let flagState = this.initialFlagState();
    
    for (const inst of block.instructions) {
      // Check for redundant SEC
      if (inst.opcode === Opcode.SEC) {
        if (flagState.carry.known && flagState.carry.value === true) {
          // Carry already set - skip SEC
          continue;
        }
      }
      
      newInsts.push(inst);
      flagState = this.updateFlagState(inst, flagState);
    }
    
    return { ...block, instructions: newInsts };
  });
}
```

### Pattern 4: Branch Flag Awareness

Use the most appropriate branch based on what flags are available.

```asm
; If we know N flag is set from LDA:
    LDA value
    BMI negative    ; Test N flag directly

; Instead of:
    LDA value
    CMP #$80        ; Unnecessary comparison
    BCS negative    ; Tests C instead of N
```

```typescript
/**
 * Optimize branches to use available flags.
 */
protected optimizeBranchOnFlags(program: AsmProgram): AsmProgram {
  return this.mapBlocks(program, block => {
    const newInsts: AsmInstruction[] = [];
    let flagState = this.initialFlagState();
    
    for (let i = 0; i < block.instructions.length; i++) {
      const inst = block.instructions[i];
      
      // Check for comparison followed by branch
      if (this.isCompare(inst) && i + 1 < block.instructions.length) {
        const branch = block.instructions[i + 1];
        if (this.isBranch(branch)) {
          // Can we use existing flags instead?
          const optimized = this.tryOptimizeBranch(
            inst, branch, flagState
          );
          if (optimized) {
            // Skip compare, use optimized branch
            newInsts.push(optimized);
            i++;  // Skip branch in next iteration
            flagState = this.updateFlagState(optimized, flagState);
            continue;
          }
        }
      }
      
      newInsts.push(inst);
      flagState = this.updateFlagState(inst, flagState);
    }
    
    return { ...block, instructions: newInsts };
  });
}
```

---

## Advanced: Cross-Block Flag Analysis

For more complex optimizations, track flags across basic blocks.

```typescript
/**
 * Cross-block flag analysis.
 * 
 * At block boundaries:
 * - If all predecessors set same flag state, propagate it
 * - If any predecessor has different state, flag is unknown
 */
protected analyzeBlockFlags(
  program: AsmProgram
): Map<string, FlagStates> {
  const blockFlags = new Map<string, FlagStates>();
  
  // Initialize with unknown
  for (const block of program.blocks) {
    blockFlags.set(block.label, this.unknownFlagState());
  }
  
  // Entry block starts with unknown flags
  // (except for program conventions)
  
  // Iterate until fixed point
  let changed = true;
  while (changed) {
    changed = false;
    
    for (const block of program.blocks) {
      const predStates = this.getPredecessorFlagStates(
        block, program, blockFlags
      );
      
      // Merge predecessor states
      const entryState = this.mergeFlagStates(predStates);
      
      // Propagate through block
      const exitState = this.propagateThroughBlock(block, entryState);
      
      // Update if changed
      const oldExit = blockFlags.get(block.label);
      if (!this.flagStatesEqual(oldExit, exitState)) {
        blockFlags.set(block.label, exitState);
        changed = true;
      }
    }
  }
  
  return blockFlags;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('FlagOptimizationPass', () => {
  describe('CMP #0 removal', () => {
    it('removes CMP #0 after LDA', () => {
      const program = parseAsm(`
        LDA value
        CMP #0
        BEQ zero
      `);
      
      const result = pass.run(program, context);
      
      // CMP #0 should be removed
      expect(result.blocks[0].instructions).toHaveLength(2);
      expect(result.blocks[0].instructions[0].opcode).toBe(Opcode.LDA);
      expect(result.blocks[0].instructions[1].opcode).toBe(Opcode.BEQ);
    });
    
    it('removes CMP #0 after AND', () => {
      const program = parseAsm(`
        LDA value
        AND #$0F
        CMP #0
        BEQ zero
      `);
      
      const result = pass.run(program, context);
      
      // AND sets Z, CMP #0 redundant
      const instTypes = result.blocks[0].instructions.map(i => i.opcode);
      expect(instTypes).toEqual([Opcode.LDA, Opcode.AND, Opcode.BEQ]);
    });
    
    it('preserves CMP #0 when needed', () => {
      const program = parseAsm(`
        LDA value
        STA other       ; STA doesn't affect flags!
        CMP #0          ; Now needed - flags might be different
        BEQ zero
      `);
      
      const result = pass.run(program, context);
      
      // CMP #0 should be preserved (STA intervenes)
      expect(result.blocks[0].instructions).toHaveLength(4);
    });
    
    it('removes CPX #0 after LDX', () => {
      const program = parseAsm(`
        LDX counter
        CPX #0
        BEQ done
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).toHaveLength(2);
    });
  });
  
  describe('CLC removal', () => {
    it('removes redundant CLC when carry known clear', () => {
      const program = parseAsm(`
        CLC             ; First CLC needed
        ADC #1
        CLC             ; Redundant - ADC just set C based on result
        ADC #1          ; Unless we need C=0
      `);
      
      // This test is tricky - depends on interpretation
      // Conservative: keep all CLC
      // Aggressive: remove second if ADC didn't overflow
    });
    
    it('removes CLC after known C=0 instruction', () => {
      const program = parseAsm(`
        CLC
        CLC             ; Redundant
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).toHaveLength(1);
    });
  });
  
  describe('SEC removal', () => {
    it('removes redundant SEC when carry known set', () => {
      const program = parseAsm(`
        SEC
        SEC             ; Redundant
        SBC #1
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).toHaveLength(2);
    });
  });
  
  describe('flag state tracking', () => {
    it('tracks Z flag through LDA', () => {
      const state = pass.updateFlagState(
        { opcode: Opcode.LDA, ... },
        pass.initialFlagState()
      );
      
      expect(state.zero.known).toBe('from-result');
    });
    
    it('knows carry after CLC', () => {
      const state = pass.updateFlagState(
        { opcode: Opcode.CLC },
        pass.initialFlagState()
      );
      
      expect(state.carry).toEqual({ known: true, value: false });
    });
    
    it('resets flags after PLP', () => {
      let state = pass.initialFlagState();
      state.carry = { known: true, value: true };
      
      state = pass.updateFlagState(
        { opcode: Opcode.PLP },
        state
      );
      
      expect(state.carry.known).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
describe('Flag Optimization Integration', () => {
  it('optimizes comparison in loop', () => {
    const blend = `
      function countdown(n: byte): void {
        while (n != 0) {
          n = n - 1;
        }
      }
    `;
    
    const result = compile(blend, { optimize: true });
    
    // Loop should use DEX/BNE pattern without extra CMP
    const asm = result.asm.join('\n');
    expect(asm).not.toMatch(/CMP #0.*BNE/s);  // No CMP #0 before BNE
  });
  
  it('eliminates redundant flag operations', () => {
    const blend = `
      function add(a: byte, b: byte): byte {
        return a + b;
      }
    `;
    
    const result = compile(blend, { optimize: true });
    
    // Count CLC instructions
    const clcCount = result.asm.filter(i => i.opcode === 'CLC').length;
    expect(clcCount).toBe(1);  // Only one CLC needed
  });
});
```

---

## Configuration

```typescript
interface FlagOptimizationOptions {
  /** Remove CMP #0 after Z-setting instructions */
  removeCmpZero: boolean;
  
  /** Remove redundant CLC */
  removeRedundantClc: boolean;
  
  /** Remove redundant SEC */
  removeRedundantSec: boolean;
  
  /** Cross-block analysis (more aggressive) */
  crossBlockAnalysis: boolean;
}

export const DEFAULT_FLAG_OPTIONS: FlagOptimizationOptions = {
  removeCmpZero: true,
  removeRedundantClc: true,
  removeRedundantSec: true,
  crossBlockAnalysis: false,  // Conservative default
};
```

---

## Summary

**Flag Optimization** eliminates redundant flag operations:

| Pattern | Savings |
|---------|---------|
| Remove `CMP #0` | 2 bytes, 2 cycles |
| Remove `CLC` | 1 byte, 2 cycles |
| Remove `SEC` | 1 byte, 2 cycles |
| Optimize branches | Varies |

**Key insight**: Most 6502 instructions set flags as a side effect. Track this and eliminate explicit flag operations when the flag is already in the needed state.

---

**Previous**: [Indexed Addressing](02-indexed-addr.md)  
**Next**: [6502 Strength Reduction](04-6502-strength.md)