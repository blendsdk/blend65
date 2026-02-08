# ASM Optimizer: Compiler v2

> **Document**: 10-asm-optimizer.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete

## Overview

The ASM Optimizer performs peephole optimization on the generated assembly code. It's the only active optimizer in v2 (the IL optimizer slot is empty for future O2 work).

## Optimizer Architecture

### Two-Slot Design

```
IL Program
    ↓
┌───────────────────┐
│ IL Optimizer (O2) │  ← EMPTY (future)
│ - Constant fold   │
│ - Dead code elim  │
└───────────────────┘
    ↓
Code Generator
    ↓
ASM-IL
    ↓
┌───────────────────┐
│ ASM Optimizer (O1)│  ← ACTIVE
│ - Peephole        │
│ - Redundant load  │
│ - Dead store      │
└───────────────────┘
    ↓
ACME Output
```

### Optimization Levels

| Level | IL Opt | ASM Opt | Description |
|-------|--------|---------|-------------|
| O0 | ❌ | ❌ | No optimization (debug) |
| O1 | ❌ | ✅ | ASM peephole only |
| O2 | ✅ | ✅ | Full optimization (future) |

---

## Peephole Optimization Patterns

### Pattern 1: Redundant Load Elimination

**Before:**
```asm
LDA value
STA temp
LDA value    ; ← redundant, A still has value
```

**After:**
```asm
LDA value
STA temp
; (removed)
```

**Implementation:**
```typescript
class RedundantLoadPass implements OptimizerPass {
  name = 'redundant-load';

  run(instructions: AsmInstruction[]): AsmInstruction[] {
    const result: AsmInstruction[] = [];
    let aContains: string | null = null;

    for (const instr of instructions) {
      // Track what A contains after LDA
      if (instr.opcode === 'LDA') {
        // Skip if A already has this value
        if (aContains === instr.operand) {
          continue; // Skip redundant load
        }
        aContains = instr.operand;
      }
      // STA doesn't change A
      else if (instr.opcode === 'STA') {
        // A still has same value
      }
      // Most other instructions clobber A tracking
      else if (this.clobbersA(instr)) {
        aContains = null;
      }
      // Labels/jumps invalidate tracking
      else if (this.isControlFlow(instr)) {
        aContains = null;
      }

      result.push(instr);
    }

    return result;
  }

  protected clobbersA(instr: AsmInstruction): boolean {
    const clobbers = ['ADC', 'SBC', 'AND', 'ORA', 'EOR', 'ASL', 'LSR', 
                      'ROL', 'ROR', 'PLA', 'TXA', 'TYA'];
    return clobbers.includes(instr.opcode);
  }

  protected isControlFlow(instr: AsmInstruction): boolean {
    return instr.isLabel || 
           instr.opcode.startsWith('B') || 
           instr.opcode === 'JMP' ||
           instr.opcode === 'JSR' ||
           instr.opcode === 'RTS';
  }
}
```

---

### Pattern 2: Dead Store Elimination

**Before:**
```asm
STA temp    ; ← dead, overwritten before read
LDA other
STA temp    ; overwrites
```

**After:**
```asm
; (removed)
LDA other
STA temp
```

**Implementation:**
```typescript
class DeadStorePass implements OptimizerPass {
  name = 'dead-store';

  run(instructions: AsmInstruction[]): AsmInstruction[] {
    // Build def-use chains
    const uses = this.analyzeUses(instructions);
    const result: AsmInstruction[] = [];

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      if (instr.opcode === 'STA') {
        // Check if this store is read before next store
        if (!this.isRead(instr.operand, i + 1, instructions)) {
          continue; // Skip dead store
        }
      }

      result.push(instr);
    }

    return result;
  }

  protected isRead(addr: string, startIndex: number, instructions: AsmInstruction[]): boolean {
    for (let i = startIndex; i < instructions.length; i++) {
      const instr = instructions[i];
      
      // If we hit a label or branch, conservatively assume read
      if (this.isControlFlow(instr)) {
        return true;
      }

      // If we load from this address, it's read
      if (this.readsFrom(instr, addr)) {
        return true;
      }

      // If we store to this address, previous store was dead
      if (instr.opcode === 'STA' && instr.operand === addr) {
        return false;
      }
    }

    // If we reach end, assume it might be read externally
    return true;
  }

  protected readsFrom(instr: AsmInstruction, addr: string): boolean {
    const reads = ['LDA', 'ADC', 'SBC', 'AND', 'ORA', 'EOR', 'CMP', 
                   'BIT', 'INC', 'DEC', 'ASL', 'LSR', 'ROL', 'ROR'];
    return reads.includes(instr.opcode) && instr.operand === addr;
  }
}
```

---

### Pattern 3: Branch Chain Optimization

**Before:**
```asm
BEQ .skip
JMP .target
.skip:
```

**After:**
```asm
BNE .target
```

**Implementation:**
```typescript
class BranchChainPass implements OptimizerPass {
  name = 'branch-chain';

  run(instructions: AsmInstruction[]): AsmInstruction[] {
    const result: AsmInstruction[] = [];

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      // Look for: Bxx .skip; JMP .target; .skip:
      if (this.isBranch(instr) && i + 2 < instructions.length) {
        const jmp = instructions[i + 1];
        const label = instructions[i + 2];

        if (jmp.opcode === 'JMP' && 
            label.isLabel && 
            instr.operand === label.label) {
          // Invert branch and target JMP destination
          result.push({
            ...instr,
            opcode: this.invertBranch(instr.opcode),
            operand: jmp.operand,
          });
          i += 2; // Skip JMP and label
          continue;
        }
      }

      result.push(instr);
    }

    return result;
  }

  protected invertBranch(opcode: string): string {
    const inversions: Record<string, string> = {
      'BEQ': 'BNE', 'BNE': 'BEQ',
      'BCC': 'BCS', 'BCS': 'BCC',
      'BMI': 'BPL', 'BPL': 'BMI',
      'BVC': 'BVS', 'BVS': 'BVC',
    };
    return inversions[opcode] || opcode;
  }
}
```

---

### Pattern 4: Transfer Elimination

**Before:**
```asm
TAX
TXA    ; ← redundant, A unchanged
```

**After:**
```asm
TAX
; (removed)
```

**Implementation:**
```typescript
class TransferEliminationPass implements OptimizerPass {
  name = 'transfer-elimination';

  run(instructions: AsmInstruction[]): AsmInstruction[] {
    const result: AsmInstruction[] = [];

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      // Skip TXA after TAX (or TYA after TAY)
      if (i > 0) {
        const prev = instructions[i - 1];
        if ((prev.opcode === 'TAX' && instr.opcode === 'TXA') ||
            (prev.opcode === 'TAY' && instr.opcode === 'TYA')) {
          continue; // Skip redundant transfer back
        }
      }

      result.push(instr);
    }

    return result;
  }
}
```

---

### Pattern 5: Increment/Decrement Optimization

**Before:**
```asm
LDA value
CLC
ADC #1
STA value
```

**After:**
```asm
INC value
```

**Conditions:** Only when value is in zero page or absolute (not accumulator).

**Implementation:**
```typescript
class IncDecOptPass implements OptimizerPass {
  name = 'inc-dec-opt';

  run(instructions: AsmInstruction[]): AsmInstruction[] {
    const result: AsmInstruction[] = [];

    for (let i = 0; i < instructions.length; i++) {
      // Look for: LDA addr; CLC; ADC #1; STA addr
      if (i + 3 < instructions.length) {
        const lda = instructions[i];
        const clc = instructions[i + 1];
        const adc = instructions[i + 2];
        const sta = instructions[i + 3];

        if (lda.opcode === 'LDA' && 
            clc.opcode === 'CLC' &&
            adc.opcode === 'ADC' && adc.operand === '#1' &&
            sta.opcode === 'STA' && sta.operand === lda.operand) {
          // Replace with INC
          result.push({ opcode: 'INC', operand: lda.operand });
          i += 3; // Skip the sequence
          continue;
        }

        // Also check for decrement: LDA addr; SEC; SBC #1; STA addr
        const sec = instructions[i + 1];
        const sbc = instructions[i + 2];

        if (lda.opcode === 'LDA' && 
            sec.opcode === 'SEC' &&
            sbc.opcode === 'SBC' && sbc.operand === '#1' &&
            sta.opcode === 'STA' && sta.operand === lda.operand) {
          // Replace with DEC
          result.push({ opcode: 'DEC', operand: lda.operand });
          i += 3;
          continue;
        }
      }

      result.push(instructions[i]);
    }

    return result;
  }
}
```

---

## Optimizer Infrastructure

### Pass Interface

```typescript
// optimizer/types.ts

export interface OptimizerPass {
  /** Pass name for logging */
  name: string;
  /** Run the pass on instructions */
  run(instructions: AsmInstruction[]): AsmInstruction[];
}

export interface OptimizerOptions {
  /** Optimization level */
  level: 0 | 1 | 2;
  /** Passes to run (if empty, use defaults for level) */
  passes?: string[];
  /** Enable debug output */
  debug?: boolean;
}
```

### Optimizer Class

```typescript
// optimizer/optimizer.ts

export class AsmOptimizer {
  protected passes: OptimizerPass[] = [];
  protected options: OptimizerOptions;

  constructor(options: OptimizerOptions = { level: 1 }) {
    this.options = options;
    this.setupPasses();
  }

  protected setupPasses(): void {
    if (this.options.level === 0) {
      // No optimization
      return;
    }

    // O1: Basic peephole
    this.passes.push(new RedundantLoadPass());
    this.passes.push(new DeadStorePass());
    this.passes.push(new TransferEliminationPass());
    this.passes.push(new IncDecOptPass());

    if (this.options.level >= 2) {
      // O2: More aggressive (future)
      this.passes.push(new BranchChainPass());
      // ... additional passes
    }
  }

  optimize(program: AsmILProgram): AsmILProgram {
    if (this.options.level === 0) {
      return program;
    }

    const result = { ...program };
    
    for (const func of result.functions) {
      let instructions = func.instructions;
      
      for (const pass of this.passes) {
        const before = instructions.length;
        instructions = pass.run(instructions);
        
        if (this.options.debug) {
          const removed = before - instructions.length;
          if (removed > 0) {
            console.log(`[${pass.name}] Removed ${removed} instructions`);
          }
        }
      }

      func.instructions = instructions;
    }

    return result;
  }
}
```

---

## Migration Tasks

### Session 9.1: Optimizer Infrastructure

| # | Task | File | Description |
|---|------|------|-------------|
| 9.1.1 | Create types.ts | `optimizer/types.ts` | Pass interface, options |
| 9.1.2 | Create optimizer.ts | `optimizer/optimizer.ts` | AsmOptimizer class |
| 9.1.3 | Add pass registration | `optimizer/optimizer.ts` | Pass management |
| 9.1.4 | Add base tests | `__tests__/optimizer/base.test.ts` | Infrastructure tests |

### Session 9.2: Peephole Passes

| # | Task | File | Description |
|---|------|------|-------------|
| 9.2.1 | Create redundant-load.ts | `optimizer/passes/` | Load elimination |
| 9.2.2 | Create dead-store.ts | `optimizer/passes/` | Store elimination |
| 9.2.3 | Create transfer-elim.ts | `optimizer/passes/` | Transfer optimization |
| 9.2.4 | Create inc-dec-opt.ts | `optimizer/passes/` | INC/DEC patterns |
| 9.2.5 | Add pass tests | `__tests__/optimizer/passes/` | Pass unit tests |

### Session 9.3: Integration

| # | Task | File | Description |
|---|------|------|-------------|
| 9.3.1 | Wire into pipeline | `compiler.ts` | Call optimizer |
| 9.3.2 | Add optimization options | `compiler.ts` | -O0, -O1 flags |
| 9.3.3 | Create index.ts | `optimizer/index.ts` | Exports |
| 9.3.4 | Add integration tests | `__tests__/optimizer/` | Pipeline tests |
| 9.3.5 | Run all tests | - | Verify |

---

## Expected Results

### Before Optimization (Example)

```asm
function_example:
  LDA #$00
  STA $0200
  LDA #$00           ; redundant
  CLC
  ADC #$01
  STA $0200
  LDA $0200          ; redundant
  RTS
```

### After O1 Optimization

```asm
function_example:
  LDA #$00
  STA $0200
  ; (removed LDA #$00)
  INC $0200          ; replaced 4 instructions with INC
  ; (removed LDA $0200)
  RTS
```

**Result:** 8 instructions → 4 instructions (50% reduction)

---

## Verification Checklist

- [ ] Optimizer infrastructure works
- [ ] O0 produces no changes
- [ ] Redundant load elimination works
- [ ] Dead store elimination works
- [ ] Transfer elimination works
- [ ] INC/DEC optimization works
- [ ] Optimized code still correct
- [ ] No regressions in output
- [ ] All tests pass

---

## Future Work (O2)

The IL optimizer slot is reserved for future O2 work:

| Pass | Description |
|------|-------------|
| Constant folding | Evaluate constant expressions at compile time |
| Constant propagation | Replace variables with known constants |
| Dead code elimination | Remove unreachable code |
| Common subexpression | Reuse computed values |
| Loop invariant motion | Move unchanging code out of loops |

These would operate on IL before code generation, enabling more powerful optimizations.

---

## Related Documents

| Document | Description |
|----------|-------------|
| [09-code-generator.md](09-code-generator.md) | Code generator (input) |
| [99-execution-plan.md](99-execution-plan.md) | Full task list |
| [Language Spec: 10-compiler.md](../../docs/language-specification-v2/10-compiler.md) | Optimizer architecture |