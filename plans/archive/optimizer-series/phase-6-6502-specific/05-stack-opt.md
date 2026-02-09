# Phase 6.5: Stack Optimization

> **Phase**: 6.5  
> **Parent**: [Phase 6 Index](00-phase-index.md)  
> **Est. Lines**: ~250  
> **Focus**: Eliminate unnecessary PHA/PLA and optimize stack usage

---

## Overview

The 6502 stack operations are expensive:
- `PHA` (Push Accumulator): 3 cycles
- `PLA` (Pull Accumulator): 4 cycles
- Round-trip `PHA; ... PLA`: 7+ cycles

Naive code generation often pushes/pulls registers that don't need saving, or saves registers that are immediately overwritten. This pass eliminates unnecessary stack operations.

---

## Why Stack Optimization Matters

### Cost Analysis

| Operation | Cycles | Bytes |
|-----------|--------|-------|
| PHA | 3 | 1 |
| PLA | 4 | 1 |
| PHP | 3 | 1 |
| PLP | 4 | 1 |
| Round-trip save/restore | 7 | 2 |

### Common Wasteful Patterns

```asm
; Pattern 1: Save but never restore (or vice versa)
    PHA
    LDA #5          ; Overwrites A anyway!
    ; ... never PLA ...

; Pattern 2: Save, do nothing, restore
    PHA
    PLA             ; Pointless round-trip

; Pattern 3: Save across code that doesn't touch A
    PHA
    INX             ; Doesn't affect A
    INY             ; Doesn't affect A  
    PLA             ; Unnecessary save

; Pattern 4: Multiple redundant saves
    PHA
    PHA             ; Second PHA redundant (same value)
```

---

## Architecture

### Pass Structure

```typescript
/**
 * Stack Optimization Pass
 * 
 * Eliminates unnecessary PHA/PLA pairs and optimizes stack usage.
 * 
 * Dependencies:
 * - Liveness analysis (to know when values are dead)
 * - Use-def analysis (to track register values)
 */
export class StackOptimizationPass implements Pass<AsmProgram> {
  readonly name = 'stack-optimization';
  readonly dependencies = ['liveness-asm', 'use-def-asm'];
  
  run(program: AsmProgram, context: PassContext): AsmProgram {
    let result = program;
    
    // Apply optimizations in order of safety/impact
    result = this.removeDeadPush(result, context);
    result = this.removePushPop(result, context);
    result = this.removeUnnecessarySave(result, context);
    
    return result;
  }
}
```

### Stack State Tracking

```typescript
/**
 * Track what's on the stack at each program point.
 */
interface StackEntry {
  /** What register was pushed */
  register: 'A' | 'P' | 'X' | 'Y';
  
  /** Instruction that pushed it */
  pushInst: AsmInstruction;
  
  /** Value if known */
  value?: number;
  
  /** Is this entry still needed? */
  isLive: boolean;
}

/**
 * Track stack state through instruction.
 */
protected updateStackState(
  inst: AsmInstruction,
  stack: StackEntry[],
  context: AnalysisContext
): StackEntry[] {
  const newStack = [...stack];
  
  switch (inst.opcode) {
    case Opcode.PHA:
      newStack.push({
        register: 'A',
        pushInst: inst,
        value: context.getRegisterValue('A'),
        isLive: true,
      });
      break;
      
    case Opcode.PHP:
      newStack.push({
        register: 'P',
        pushInst: inst,
        isLive: true,
      });
      break;
      
    case Opcode.PLA:
      if (newStack.length > 0 && 
          newStack[newStack.length - 1].register === 'A') {
        newStack.pop();
      }
      break;
      
    case Opcode.PLP:
      if (newStack.length > 0 &&
          newStack[newStack.length - 1].register === 'P') {
        newStack.pop();
      }
      break;
      
    case Opcode.JSR:
      // JSR pushes return address (2 bytes)
      // Mark all prior pushes as potentially needed
      for (const entry of newStack) {
        entry.isLive = true;
      }
      break;
      
    case Opcode.RTS:
    case Opcode.RTI:
      // Stack should be balanced at return
      break;
  }
  
  return newStack;
}
```

---

## Optimization Patterns

### Pattern 1: Dead Push Elimination

Remove PHA when the pushed value is never retrieved.

```asm
; Before
    PHA             ; Save A
    LDA #5          ; Load new value
    STA dest
    RTS             ; Return without PLA - A is dead!

; After
    LDA #5
    STA dest
    RTS
```

```typescript
/**
 * Remove PHA when there's no matching PLA (value is dead).
 */
protected removeDeadPush(
  program: AsmProgram,
  context: PassContext
): AsmProgram {
  const liveness = context.getAnalysis<LivenessInfo>('liveness-asm');
  
  return this.mapBlocks(program, block => {
    const newInsts: AsmInstruction[] = [];
    const pendingPushes: Map<number, AsmInstruction> = new Map();
    
    for (let i = 0; i < block.instructions.length; i++) {
      const inst = block.instructions[i];
      
      if (inst.opcode === Opcode.PHA) {
        // Check if there's a matching PLA
        const hasPla = this.findMatchingPull(block.instructions, i, 'A');
        if (!hasPla) {
          // Check if value is live at block exit
          if (!liveness.isLiveAtExit(block.label, 'stack:A')) {
            continue;  // Dead push - remove
          }
        }
      }
      
      newInsts.push(inst);
    }
    
    return { ...block, instructions: newInsts };
  });
}
```

### Pattern 2: Push-Pop Elimination

Remove adjacent or near-adjacent PHA/PLA pairs.

```asm
; Before (adjacent)
    PHA
    PLA             ; Completely pointless

; Before (near-adjacent)
    PHA
    NOP             ; Or other instructions not affecting A
    NOP
    PLA

; After
    ; (removed entirely)
    NOP
    NOP
```

```typescript
/**
 * Remove PHA/PLA pairs where A is not modified between them.
 */
protected removePushPop(
  program: AsmProgram,
  context: PassContext
): AsmProgram {
  return this.mapBlocks(program, block => {
    const newInsts: AsmInstruction[] = [];
    
    for (let i = 0; i < block.instructions.length; i++) {
      const inst = block.instructions[i];
      
      if (inst.opcode === Opcode.PHA) {
        // Find matching PLA
        const plaIndex = this.findMatchingPull(block.instructions, i, 'A');
        
        if (plaIndex !== -1) {
          // Check if A is modified between PHA and PLA
          const modified = this.isRegisterModified(
            block.instructions, i + 1, plaIndex, 'A'
          );
          
          if (!modified) {
            // Safe to remove both PHA and PLA
            // Mark PLA for removal
            this.markForRemoval(plaIndex);
            continue;  // Skip PHA
          }
        }
      }
      
      if (!this.isMarkedForRemoval(i)) {
        newInsts.push(inst);
      }
    }
    
    return { ...block, instructions: newInsts };
  });
}

/**
 * Check if register is modified between two points.
 */
protected isRegisterModified(
  instructions: AsmInstruction[],
  start: number,
  end: number,
  register: 'A' | 'X' | 'Y'
): boolean {
  const modifiers = this.getRegisterModifiers(register);
  
  for (let i = start; i < end; i++) {
    if (modifiers.includes(instructions[i].opcode)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get opcodes that modify a register.
 */
protected getRegisterModifiers(register: 'A' | 'X' | 'Y'): Opcode[] {
  switch (register) {
    case 'A':
      return [
        Opcode.LDA, Opcode.PLA, Opcode.TXA, Opcode.TYA,
        Opcode.ADC, Opcode.SBC, Opcode.AND, Opcode.ORA, Opcode.EOR,
        Opcode.ASL, Opcode.LSR, Opcode.ROL, Opcode.ROR,
      ];
    case 'X':
      return [Opcode.LDX, Opcode.TAX, Opcode.TSX, Opcode.INX, Opcode.DEX];
    case 'Y':
      return [Opcode.LDY, Opcode.TAY, Opcode.INY, Opcode.DEY];
  }
}
```

### Pattern 3: Unnecessary Save Elimination

Remove PHA when the register value is not used after PLA.

```asm
; Before
    PHA             ; Save A
    JSR subroutine  ; Call function
    PLA             ; Restore A
    LDA #0          ; Immediately overwrite A!

; After
    JSR subroutine
    LDA #0          ; A overwritten anyway
```

```typescript
/**
 * Remove PHA/PLA when restored value is immediately overwritten.
 */
protected removeUnnecessarySave(
  program: AsmProgram,
  context: PassContext
): AsmProgram {
  return this.mapBlocks(program, block => {
    const newInsts: AsmInstruction[] = [];
    
    for (let i = 0; i < block.instructions.length; i++) {
      const inst = block.instructions[i];
      
      if (inst.opcode === Opcode.PLA) {
        // Check if next instruction overwrites A
        const next = block.instructions[i + 1];
        if (next && this.overwritesRegister(next, 'A')) {
          // Find and remove matching PHA
          const phaIndex = this.findMatchingPush(newInsts, 'A');
          if (phaIndex !== -1) {
            newInsts.splice(phaIndex, 1);  // Remove PHA
            continue;  // Skip PLA
          }
        }
      }
      
      newInsts.push(inst);
    }
    
    return { ...block, instructions: newInsts };
  });
}
```

---

## Special Cases

### JSR/RTS Handling

Function calls require special care:

```asm
; Before a JSR, we might need to save A
    PHA             ; Save A across call
    JSR function    ; Might clobber A
    PLA             ; Restore A

; BUT if A is not used after PLA:
    JSR function    ; Don't need to save
    ; A not used
```

```typescript
/**
 * Analyze function calls for necessary saves.
 */
protected analyzeCallSaves(
  inst: AsmInstruction,
  context: AnalysisContext
): Register[] {
  if (inst.opcode !== Opcode.JSR) {
    return [];
  }
  
  // Get function info if available
  const funcInfo = context.getFunctionInfo(inst.operand);
  
  // Registers that function might clobber
  const clobbered = funcInfo?.clobbers ?? ['A', 'X', 'Y'];
  
  // Registers we're using after the call
  const liveAfter = context.getLiveRegistersAfter(inst);
  
  // Need to save: clobbered AND live after
  return clobbered.filter(r => liveAfter.includes(r));
}
```

### Interrupt Handlers

Interrupt handlers must preserve all registers:

```asm
; IRQ handler - must save everything
irq_handler:
    PHA             ; Required
    TXA
    PHA             ; Required
    TYA
    PHA             ; Required
    
    ; ... handler code ...
    
    PLA
    TAY
    PLA
    TAX
    PLA
    RTI
```

```typescript
/**
 * Detect if we're in an interrupt handler.
 */
protected isInterruptHandler(block: BasicBlock): boolean {
  // Check for RTI (return from interrupt)
  const hasRti = block.instructions.some(
    inst => inst.opcode === Opcode.RTI
  );
  
  // Check for known interrupt labels
  const interruptLabels = ['irq', 'nmi', 'brk', 'interrupt'];
  const isInterruptLabel = interruptLabels.some(
    l => block.label.toLowerCase().includes(l)
  );
  
  return hasRti || isInterruptLabel;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('StackOptimizationPass', () => {
  describe('dead push removal', () => {
    it('removes PHA with no matching PLA', () => {
      const program = parseAsm(`
        PHA             ; Dead push
        LDA #5
        RTS
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).not.toContainEqual(
        expect.objectContaining({ opcode: Opcode.PHA })
      );
    });
    
    it('preserves PHA with matching PLA', () => {
      const program = parseAsm(`
        PHA
        JSR func
        PLA
        RTS
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).toContainEqual(
        expect.objectContaining({ opcode: Opcode.PHA })
      );
    });
  });
  
  describe('push-pop elimination', () => {
    it('removes adjacent PHA/PLA', () => {
      const program = parseAsm(`
        PHA
        PLA
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).toHaveLength(0);
    });
    
    it('removes PHA/PLA with non-modifying code between', () => {
      const program = parseAsm(`
        PHA
        INX             ; Doesn't affect A
        INY             ; Doesn't affect A
        PLA
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).toHaveLength(2);  // Just INX, INY
    });
    
    it('preserves PHA/PLA when A is modified between', () => {
      const program = parseAsm(`
        PHA
        LDA #5          ; Modifies A
        STA dest
        PLA             ; Need to restore original
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).toHaveLength(4);  // All preserved
    });
  });
  
  describe('unnecessary save removal', () => {
    it('removes save when value immediately overwritten', () => {
      const program = parseAsm(`
        PHA
        JSR func
        PLA
        LDA #0          ; Immediately overwrites
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).toHaveLength(2);  // JSR, LDA
    });
    
    it('preserves save when value used', () => {
      const program = parseAsm(`
        PHA
        JSR func
        PLA
        STA dest        ; Uses restored value
      `);
      
      const result = pass.run(program, context);
      
      expect(result.blocks[0].instructions).toHaveLength(4);  // All preserved
    });
  });
  
  describe('interrupt handlers', () => {
    it('preserves all saves in IRQ handlers', () => {
      const program = parseAsm(`
      irq_handler:
        PHA
        TXA
        PHA
        TYA
        PHA
        ; ... code ...
        PLA
        TAY
        PLA
        TAX
        PLA
        RTI
      `);
      
      const result = pass.run(program, context);
      
      // All stack operations preserved
      const stackOps = result.blocks[0].instructions.filter(i =>
        [Opcode.PHA, Opcode.PLA].includes(i.opcode)
      );
      expect(stackOps.length).toBe(6);  // 3 PHA + 3 PLA
    });
  });
});
```

### Integration Tests

```typescript
describe('Stack Optimization Integration', () => {
  it('optimizes function with unnecessary saves', () => {
    const blend = `
      function process(): byte {
        let temp: byte = getValue();
        return transform(temp);
      }
    `;
    
    const result = compile(blend, { optimize: true });
    
    // Should minimize stack operations
    const phaCount = result.asm.filter(i => i.opcode === 'PHA').length;
    const plaCount = result.asm.filter(i => i.opcode === 'PLA').length;
    
    // Ideally balanced and minimal
    expect(phaCount).toBe(plaCount);
  });
  
  it('preserves necessary saves across calls', () => {
    const blend = `
      function caller(): byte {
        let a: byte = 5;
        doSomething();
        return a;  // Needs a after call
      }
    `;
    
    const result = compile(blend, { optimize: true });
    
    // Should have save/restore around call
    expect(result.asm.some(i => i.opcode === 'PHA')).toBe(true);
  });
});
```

---

## Configuration

```typescript
interface StackOptimizationOptions {
  /** Remove dead pushes */
  removeDeadPush: boolean;
  
  /** Remove push-pop pairs */
  removePushPop: boolean;
  
  /** Remove unnecessary saves */
  removeUnnecessarySave: boolean;
  
  /** Preserve all saves in interrupt handlers */
  preserveInterruptSaves: boolean;
}

export const DEFAULT_STACK_OPTIONS: StackOptimizationOptions = {
  removeDeadPush: true,
  removePushPop: true,
  removeUnnecessarySave: true,
  preserveInterruptSaves: true,
};
```

---

## Summary

**Stack Optimization** saves significant cycles:

| Pattern | Savings |
|---------|---------|
| Dead push removal | 3 cycles |
| Push-pop elimination | 7 cycles |
| Unnecessary save removal | 7 cycles |

**Key principles**:
1. Don't save if value is not restored
2. Don't save if value isn't modified
3. Don't save if restored value is immediately overwritten
4. Always preserve interrupt handler saves

---

**Previous**: [6502 Strength Reduction](04-6502-strength.md)  
**Next**: [Phase 6 Tasks](99-phase-tasks.md)