# Phase 7: 6502-Specific Optimizations

> **Phase**: 7 of 11  
> **Est. Time**: ~28 hours  
> **Tasks**: 14  
> **Tests**: ~500  
> **Prerequisites**: Phase 6 (Register Allocation)

---

## Overview

This phase implements **6502-specific optimizations** that exploit the unique characteristics of the 6502 processor. These are the optimizations that make Blend65 produce code competitive with hand-written assembly.

---

## Why 6502-Specific Optimization Matters

The 6502 is unlike modern processors:

| Feature | Modern CPUs | 6502 |
|---------|-------------|------|
| Registers | 16-32 general purpose | 3 (A, X, Y) |
| Stack | Large, fast | 256 bytes, slow |
| Zero Page | N/A | 256 bytes fast RAM |
| Addressing | Uniform | Mode-dependent cycles |
| Flags | Many | C, Z, N, V, D, I |
| Multiply | 1-3 cycles | Software (50+ cycles) |

**A generic optimizer will produce mediocre 6502 code. 6502-specific optimizations are ESSENTIAL.**

---

## Directory Structure Created

```
packages/compiler/src/optimizer/m6502/
├── index.ts                    # 6502 optimization exports
├── strength-reduce.ts          # 6502 strength reduction
├── zp-promotion.ts             # Zero-page promotion
├── indexed-mode.ts             # Indexed addressing optimization
├── flag-optimization.ts        # Carry/Zero/Negative flag optimization
├── branch-distance.ts          # Branch distance optimization
├── page-crossing.ts            # Page boundary optimization
├── decimal-mode.ts             # Decimal mode handling
├── accumulator.ts              # Accumulator-centric transforms
├── index-register.ts           # Index register selection
├── stack-frame.ts              # Stack frame optimization
├── instruction-schedule.ts     # Instruction scheduling
└── patterns.ts                 # 6502-specific patterns
```

---

## Task 7.1: 6502 Strength Reduction

**Time**: 2 hours  
**Tests**: 40 tests

**Key Concepts**:
- Replace expensive operations with cheaper ones
- `x * 2` → `ASL` (shift left)
- `x / 2` → `LSR` (shift right)
- `x * 256` → store in high byte

**File**: `packages/compiler/src/optimizer/m6502/strength-reduce.ts`

```typescript
/**
 * 6502 Strength Reduction
 * 
 * Replaces expensive operations with cheaper 6502 equivalents.
 */
export class M6502StrengthReductionPass extends TransformPass {
  readonly name = 'm6502-strength-reduce';
  readonly requires = [];
  readonly invalidates = ['use-def'];
  readonly levels = [O2, O3, Os, Oz];
  
  /** Multiplication strength reductions */
  protected multiplyReductions: Map<number, ILInstruction[]> = new Map([
    [2, [new ShlInstruction(1)]],           // x * 2 = x << 1
    [4, [new ShlInstruction(2)]],           // x * 4 = x << 2
    [8, [new ShlInstruction(3)]],           // x * 8 = x << 3
    [3, [new ShlInstruction(1), new AddInstruction()]], // x * 3 = (x << 1) + x
    [5, [new ShlInstruction(2), new AddInstruction()]], // x * 5 = (x << 2) + x
    [10, [new ShlInstruction(1), new ShlInstruction(2), new AddInstruction()]], // x * 10
  ]);
  
  /** Division strength reductions */
  protected divideReductions: Map<number, ILInstruction[]> = new Map([
    [2, [new LsrInstruction(1)]],           // x / 2 = x >> 1
    [4, [new LsrInstruction(2)]],           // x / 4 = x >> 2
    [8, [new LsrInstruction(3)]],           // x / 8 = x >> 3
    [256, [/* take high byte */]],          // x / 256 = high byte
  ]);
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (inst.isMul() && inst.getOperand(1).isConstant()) {
          const multiplier = inst.getOperand(1).getConstantValue();
          if (this.multiplyReductions.has(multiplier)) {
            this.applyReduction(block, inst, this.multiplyReductions.get(multiplier)!);
            changed = true;
          }
        }
        
        if (inst.isDiv() && inst.getOperand(1).isConstant()) {
          const divisor = inst.getOperand(1).getConstantValue();
          if (this.divideReductions.has(divisor)) {
            this.applyReduction(block, inst, this.divideReductions.get(divisor)!);
            changed = true;
          }
        }
      }
    }
    
    return changed;
  }
}
```

**Generated 6502 Assembly Examples**:

```asm
; x * 2 (before: JSR multiply - 50+ cycles)
ASL A           ; 2 cycles - 25x faster!

; x * 3
ASL A           ; x * 2
CLC
ADC original    ; + x = x * 3

; x / 4 (before: JSR divide - 100+ cycles)
LSR A
LSR A           ; 4 cycles - 25x faster!
```

**Tests**:
- Multiply by powers of 2
- Multiply by 3, 5, 10
- Divide by powers of 2
- Word operations
- Signed vs unsigned

---

## Task 7.2: Zero-Page Promotion

**Time**: 2.5 hours  
**Tests**: 45 tests

**Key Concepts**:
- Zero page ($00-$FF) is fast memory on 6502
- 1-2 cycles faster than regular RAM
- Promote frequently accessed variables to ZP

**File**: `packages/compiler/src/optimizer/m6502/zp-promotion.ts`

```typescript
/**
 * Zero-Page Promotion
 * 
 * Promotes frequently accessed variables to zero page
 * for faster access.
 */
export class ZPPromotionPass extends TransformPass {
  readonly name = 'zp-promotion';
  readonly requires = ['block-frequency', 'liveness', 'use-def'];
  readonly invalidates = [];
  readonly levels = [O2, O3, Ozp];
  
  /** Available zero-page bytes (configured by target) */
  protected availableZP: Set<number>;
  
  /** Minimum access count to consider for promotion */
  protected minAccessCount = 10;
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const blockFreq = this.getAnalysis<BlockFrequencyInfo>('block-frequency', func);
    const useDef = this.getAnalysis<UseDefInfo>('use-def', func);
    
    // 1. Calculate weighted access count for each variable
    const accessCounts = this.calculateAccessCounts(func, blockFreq);
    
    // 2. Sort by access count (descending)
    const candidates = [...accessCounts.entries()]
      .filter(([_, count]) => count >= this.minAccessCount)
      .sort((a, b) => b[1] - a[1]);
    
    // 3. Promote top candidates that fit in available ZP
    for (const [variable, _] of candidates) {
      const size = this.getVariableSize(variable);
      const zpAddr = this.allocateZP(size);
      
      if (zpAddr !== null) {
        this.promoteToZP(func, variable, zpAddr);
        changed = true;
      }
    }
    
    return changed;
  }
  
  /** Calculate access count weighted by block frequency */
  protected calculateAccessCounts(
    func: ILFunction, 
    blockFreq: BlockFrequencyInfo
  ): Map<Variable, number> {
    const counts = new Map<Variable, number>();
    
    for (const block of func.getBlocks()) {
      const freq = blockFreq.getFrequency(block);
      
      for (const inst of block.getInstructions()) {
        for (const variable of this.getAccessedVariables(inst)) {
          const current = counts.get(variable) || 0;
          counts.set(variable, current + freq);
        }
      }
    }
    
    return counts;
  }
}
```

**Cycle Savings Example**:

```asm
; Regular RAM access
LDA $1000      ; 4 cycles (absolute addressing)

; Zero-page access
LDA $10        ; 3 cycles (zero-page addressing)
               ; 25% faster!

; In a loop running 1000 times:
; Regular: 4000 cycles
; ZP:      3000 cycles
; Savings: 1000 cycles!
```

**Tests**:
- High-frequency variable promoted
- Low-frequency variable not promoted
- Loop variable prioritized
- ZP exhaustion handling
- Multi-byte variable alignment

---

## Task 7.3: Indexed Addressing Optimization

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- 6502 has indexed addressing modes: `LDA addr,X` and `LDA addr,Y`
- Use X/Y for array indexing
- Prefer indexed modes over computed addresses

**File**: `packages/compiler/src/optimizer/m6502/indexed-mode.ts`

```typescript
/**
 * Indexed Addressing Optimization
 * 
 * Optimizes array access to use 6502 indexed addressing modes.
 */
export class IndexedModePass extends TransformPass {
  readonly name = 'indexed-mode';
  readonly requires = ['loop-info', 'liveness'];
  readonly invalidates = [];
  readonly levels = [O2, O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    
    // Find array access patterns in loops
    for (const loop of loopInfo.getLoops()) {
      const inductionVar = this.findInductionVariable(loop);
      if (!inductionVar) continue;
      
      // Find array accesses using induction variable
      for (const block of loop.blocks) {
        for (const inst of block.getInstructions()) {
          if (this.isArrayAccess(inst, inductionVar)) {
            changed = this.convertToIndexedMode(inst, inductionVar) || changed;
          }
        }
      }
    }
    
    return changed;
  }
}
```

**Before/After Example**:

```asm
; Before (computed address - slow)
LDA index
CLC
ADC #<array
STA ptr
LDA #>array
ADC #0
STA ptr+1
LDA (ptr),Y    ; Many instructions!

; After (indexed mode - fast)
LDX index
LDA array,X    ; Single instruction!
```

**Tests**:
- Simple array access
- Array in loop
- Nested array access
- Index out of X/Y range handling

---

## Task 7.4: Carry Flag Optimization

**Time**: 2 hours  
**Tests**: 40 tests

**Key Concepts**:
- Carry flag (C) set by arithmetic, shifts, comparisons
- Reuse carry instead of recomputing
- Eliminate redundant CLC/SEC

**File**: `packages/compiler/src/optimizer/m6502/flag-optimization.ts`

```typescript
/**
 * Carry Flag Optimization
 * 
 * Optimizes usage of the 6502 carry flag.
 */
export class CarryFlagOptimizationPass extends TransformPass {
  readonly name = 'carry-flag-opt';
  readonly requires = [];
  readonly invalidates = [];
  readonly levels = [O2, O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      let carryState: 'unknown' | 'set' | 'clear' = 'unknown';
      
      for (const inst of block.getInstructions()) {
        // Check if carry is needed
        if (this.needsCarryClear(inst) && carryState === 'clear') {
          // Remove redundant CLC
          this.removePrecedingCLC(block, inst);
          changed = true;
        }
        
        if (this.needsCarrySet(inst) && carryState === 'set') {
          // Remove redundant SEC
          this.removePrecedingSEC(block, inst);
          changed = true;
        }
        
        // Track carry state
        carryState = this.updateCarryState(inst, carryState);
      }
    }
    
    return changed;
  }
}
```

**Example Optimization**:

```asm
; Before (redundant CLC)
CLC
ADC #1
...
CLC          ; Redundant - carry already clear from ADC not overflowing
ADC #2

; After
CLC
ADC #1
...
ADC #2       ; CLC removed!
```

**Tests**:
- Redundant CLC removal
- Redundant SEC removal
- Carry across branches
- Carry after comparison
- Carry after shift

---

## Task 7.5: Zero Flag Optimization

**Time**: 1.5 hours  
**Tests**: 35 tests

**Key Concepts**:
- Zero flag (Z) set when result is zero
- LDA/LDX/LDY set Z flag
- Eliminate redundant CMP #0

**File**: `packages/compiler/src/optimizer/m6502/flag-optimization.ts` (extension)

```typescript
/**
 * Zero Flag Optimization
 * 
 * Eliminates redundant zero checks when Z flag already set.
 */
export class ZeroFlagOptimizationPass extends TransformPass {
  readonly name = 'zero-flag-opt';
  readonly requires = [];
  readonly invalidates = [];
  readonly levels = [O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        // Pattern: LDA x; CMP #0; BEQ/BNE
        // The CMP #0 is redundant - LDA already set Z
        if (this.isCmpZero(inst)) {
          const prev = this.getPreviousInstruction(block, inst);
          if (prev && this.setsZeroFlag(prev)) {
            this.removeInstruction(block, inst);
            changed = true;
          }
        }
      }
    }
    
    return changed;
  }
}
```

**Example**:

```asm
; Before
LDA counter
CMP #0       ; Redundant! LDA already set Z flag
BEQ done

; After
LDA counter
BEQ done     ; Direct branch, CMP removed
```

**Tests**:
- LDA + CMP #0 → LDA
- LDX + CPX #0 → LDX
- LDY + CPY #0 → LDY
- INC/DEC set Z flag
- AND/ORA/EOR set Z flag

---

## Task 7.6: Negative Flag Optimization

**Time**: 1 hour  
**Tests**: 25 tests

**Key Concepts**:
- Negative flag (N) set when bit 7 is 1
- Useful for signed comparisons
- Can test sign without explicit comparison

**File**: `packages/compiler/src/optimizer/m6502/flag-optimization.ts` (extension)

```typescript
/**
 * Negative Flag Optimization
 * 
 * Optimizes signed comparisons using N flag.
 */
// Similar pattern to zero flag optimization
```

**Tests**:
- Signed comparison optimization
- BMI/BPL after arithmetic
- Sign test without CMP

---

## Task 7.7: Branch Distance Optimization

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- 6502 branches limited to -128 to +127 bytes
- Must use JMP for far targets (3 bytes vs 2)
- Optimize block ordering to minimize long branches

**File**: `packages/compiler/src/optimizer/m6502/branch-distance.ts`

```typescript
/**
 * Branch Distance Optimization
 * 
 * Reorders blocks to minimize long branches.
 */
export class BranchDistancePass extends TransformPass {
  readonly name = 'branch-distance';
  readonly requires = [];
  readonly invalidates = [];
  readonly levels = [Os, Oz];  // Size optimization
  
  transform(func: ILFunction): boolean {
    // 1. Calculate block sizes
    const sizes = this.calculateBlockSizes(func);
    
    // 2. Build branch distance graph
    const branchTargets = this.analyzeBranches(func);
    
    // 3. Reorder blocks to minimize distance
    const newOrder = this.optimizeBlockOrder(func.getBlocks(), sizes, branchTargets);
    
    // 4. Apply new order
    return this.applyBlockOrder(func, newOrder);
  }
}
```

**Tests**:
- Short branch preserved
- Long branch converted to JMP
- Block reordering helps
- Loop body placement

---

## Task 7.8: Page Crossing Elimination

**Time**: 1.5 hours  
**Tests**: 30 tests

**Key Concepts**:
- Page crossing (address $xxFF → $xx00+1) adds 1 cycle
- Align hot code/data to avoid page crossings
- Important for tight loops

**File**: `packages/compiler/src/optimizer/m6502/page-crossing.ts`

```typescript
/**
 * Page Crossing Elimination
 * 
 * Aligns code and data to minimize page crossing penalties.
 */
export class PageCrossingPass extends TransformPass {
  readonly name = 'page-crossing';
  readonly requires = ['block-frequency'];
  readonly invalidates = [];
  readonly levels = [O3];  // Aggressive only
  
  transform(func: ILFunction): boolean {
    // Insert alignment directives before hot code
    // Pad data to avoid crossing in indexed access
    return false; // Placeholder
  }
}
```

**Tests**:
- Loop aligned to page start
- Data array alignment
- Branch target alignment

---

## Task 7.9: Decimal Mode Handling

**Time**: 1 hour  
**Tests**: 20 tests

**Key Concepts**:
- 6502 has BCD (Binary Coded Decimal) mode
- SED enables, CLD disables
- Must ensure CLD before normal arithmetic

**File**: `packages/compiler/src/optimizer/m6502/decimal-mode.ts`

```typescript
/**
 * Decimal Mode Handling
 * 
 * Ensures binary mode for arithmetic, enables BCD when needed.
 */
export class DecimalModePass extends TransformPass {
  readonly name = 'decimal-mode';
  readonly requires = [];
  readonly invalidates = [];
  readonly levels = [O1, O2, O3, Os, Oz];  // Safety - all levels
  
  transform(func: ILFunction): boolean {
    // Insert CLD at function entry if not BCD function
    // Remove redundant CLD/SED pairs
    return false;
  }
}
```

**Tests**:
- CLD inserted at entry
- BCD arithmetic preserved
- Redundant CLD removal

---

## Task 7.10: Accumulator-Centric Transforms

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- A is the primary work register
- Many operations only work on A
- Minimize A spills to memory

**File**: `packages/compiler/src/optimizer/m6502/accumulator.ts`

```typescript
/**
 * Accumulator-Centric Transforms
 * 
 * Optimizes code to minimize accumulator spills.
 */
export class AccumulatorCentricPass extends TransformPass {
  readonly name = 'accumulator-centric';
  readonly requires = ['liveness'];
  readonly invalidates = [];
  readonly levels = [O2, O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    // Reorder operations to minimize STA/LDA pairs
    // Use TAX/TAY to preserve A when needed
    // Schedule A-dependent ops together
    
    return changed;
  }
}
```

**Tests**:
- Minimize STA/LDA sequences
- Use TAX/TXA efficiently
- A-centric expression ordering

---

## Task 7.11: Index Register Selection

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- X and Y have different capabilities
- Some addressing modes X-only, some Y-only
- Choose correct register for task

**File**: `packages/compiler/src/optimizer/m6502/index-register.ts`

```typescript
/**
 * Index Register Selection
 * 
 * Chooses optimal index register (X vs Y) for each use.
 */
export class IndexRegisterSelectionPass extends TransformPass {
  readonly name = 'index-register-selection';
  readonly requires = ['liveness'];
  readonly invalidates = [];
  readonly levels = [O2, O3];
  
  /** Addressing modes that require X */
  protected xOnlyModes = ['zeroPageX', 'absoluteX', 'indirectX'];
  
  /** Addressing modes that require Y */
  protected yOnlyModes = ['zeroPageY', 'absoluteY', 'indirectY'];
  
  transform(func: ILFunction): boolean {
    // Analyze which register is needed for each addressing mode
    // Assign indexes to minimize register transfers
    return false;
  }
}
```

**Tests**:
- X required for (zp,X) mode
- Y required for (zp),Y mode
- Minimize INX/INY conflicts
- Loop counter register choice

---

## Task 7.12: Stack Frame Optimization

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- 6502 stack is only 256 bytes
- Minimize stack frame size
- Eliminate frame when possible

**File**: `packages/compiler/src/optimizer/m6502/stack-frame.ts`

```typescript
/**
 * Stack Frame Optimization
 * 
 * Minimizes or eliminates stack frame usage.
 */
export class StackFrameOptimizationPass extends TransformPass {
  readonly name = 'stack-frame-opt';
  readonly requires = ['escape-analysis', 'call-graph'];
  readonly invalidates = [];
  readonly levels = [O2, O3];
  
  transform(func: ILFunction): boolean {
    // 1. Eliminate frame for leaf functions
    // 2. Use registers instead of stack for locals
    // 3. Combine frame setup with parameter passing
    return false;
  }
}
```

**Tests**:
- Leaf function frame elimination
- Register allocation for locals
- Minimal frame for non-leaf

---

## Task 7.13: Self-Modify Opportunity Detection

**Time**: 2 hours  
**Tests**: 30 tests

**Key Concepts**:
- Detect patterns suitable for SMC
- Mark for SMC pass (Phase 10)
- Must be in RAM (not ROM)

**File**: `packages/compiler/src/optimizer/m6502/smc-detect.ts`

```typescript
/**
 * Self-Modify Opportunity Detection
 * 
 * Identifies code patterns that could benefit from
 * self-modifying code transformation.
 */
export class SMCDetectionPass extends AnalysisPass<SMCOpportunities> {
  readonly name = 'smc-detection';
  readonly requires = ['loop-info'];
  
  analyze(func: ILFunction): SMCOpportunities {
    const opportunities: SMCOpportunity[] = [];
    
    // Pattern 1: Loop with incrementing address
    // Pattern 2: Jump table with computed target
    // Pattern 3: Repeated memory copy with different source
    
    return { opportunities };
  }
}
```

**Tests**:
- Loop copy pattern detected
- Jump table pattern detected
- Non-SMC-suitable patterns rejected

---

## Task 7.14: Instruction Scheduling

**Time**: 2.5 hours  
**Tests**: 40 tests

**Key Concepts**:
- Reorder instructions for better performance
- Minimize pipeline stalls (minimal on 6502)
- Respect dependencies

**File**: `packages/compiler/src/optimizer/m6502/instruction-schedule.ts`

```typescript
/**
 * 6502 Instruction Scheduling
 * 
 * Reorders instructions for optimal execution.
 */
export class InstructionSchedulingPass extends TransformPass {
  readonly name = 'instruction-schedule';
  readonly requires = ['memory-deps', 'liveness'];
  readonly invalidates = [];
  readonly levels = [O3];
  
  transform(func: ILFunction): boolean {
    // 6502 has no pipeline, but scheduling still helps:
    // 1. Group memory operations
    // 2. Minimize register transfers
    // 3. Schedule independent ops for future parallel execution
    return false;
  }
}
```

**Tests**:
- Independent ops reordered
- Dependencies respected
- Memory ops grouped

---

## Phase 7 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 7.1 | 6502 strength reduction | 2 hr | 40 | [ ] |
| 7.2 | Zero-page promotion | 2.5 hr | 45 | [ ] |
| 7.3 | Indexed addressing | 2 hr | 35 | [ ] |
| 7.4 | Carry flag optimization | 2 hr | 40 | [ ] |
| 7.5 | Zero flag optimization | 1.5 hr | 35 | [ ] |
| 7.6 | Negative flag optimization | 1 hr | 25 | [ ] |
| 7.7 | Branch distance | 2 hr | 35 | [ ] |
| 7.8 | Page crossing | 1.5 hr | 30 | [ ] |
| 7.9 | Decimal mode | 1 hr | 20 | [ ] |
| 7.10 | Accumulator-centric | 2 hr | 35 | [ ] |
| 7.11 | Index register selection | 2 hr | 35 | [ ] |
| 7.12 | Stack frame opt | 2 hr | 35 | [ ] |
| 7.13 | SMC detection | 2 hr | 30 | [ ] |
| 7.14 | Instruction scheduling | 2.5 hr | 40 | [ ] |
| **Total** | | **28 hr** | **500** | |

---

## Success Criteria

- [ ] All 500 tests passing
- [ ] Multiply/divide strength reduced
- [ ] Hot variables in zero page
- [ ] Indexed modes used for arrays
- [ ] Redundant flag operations removed
- [ ] Stack usage minimized
- [ ] Code competitive with hand-written assembly

---

## Performance Targets

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| x * 2 | 50+ cycles | 2 cycles | 25x |
| x / 4 | 100+ cycles | 4 cycles | 25x |
| Array access in loop | 15+ cycles | 4-5 cycles | 3x |
| Redundant CMP #0 | 2 cycles | 0 cycles | Eliminated |
| ZP variable access | 4 cycles | 3 cycles | 25% |

---

**Previous**: [06-register-allocation.md](06-register-allocation.md)  
**Next**: [08-peephole.md](08-peephole.md)