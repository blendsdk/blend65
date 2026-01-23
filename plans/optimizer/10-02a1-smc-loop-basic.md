# Task 10.2a1: SMC Basic Loop Unrolling

> **Session**: 5.2a1
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 3-4 hours
> **Tests**: 25-30 unit tests
> **Prerequisites**: 10-01b-smc-scoring.md

---

## Overview

This document specifies **basic SMC loop unrolling** patterns where loop counters are embedded directly in instruction operands.

### Basic Loop SMC Concept

Traditional loop:
```asm
        LDX #7
loop:   LDA table,X     ; Indexed load (4-5 cycles)
        STA dest,X      ; Indexed store (5 cycles)
        DEX             ; Decrement (2 cycles)
        BPL loop        ; Branch (2-3 cycles)
```

SMC unrolled:
```asm
loop:   LDA table+7     ; Absolute load (4 cycles) - operand modified
        STA dest+7      ; Absolute store (4 cycles) - operand modified
        DEC loop+1      ; Modify LDA operand (6 cycles)
        DEC loop+4      ; Modify STA operand (6 cycles)
        BPL loop        ; Branch (2-3 cycles)
```

### When to Use Basic SMC Unrolling

```
┌─────────────────────────────────────────────────────────────┐
│              Basic SMC Unrolling Criteria                    │
├─────────────────────────────────────────────────────────────┤
│  ✅ Good Candidates:                                         │
│  ├─ Small, fixed iteration count (4-16)                     │
│  ├─ Multiple indexed accesses per iteration                 │
│  ├─ Register pressure (X/Y needed elsewhere)                │
│  └─ Hot path code                                           │
├─────────────────────────────────────────────────────────────┤
│  ❌ Poor Candidates:                                         │
│  ├─ Large iteration count (>32)                             │
│  ├─ Single indexed access per iteration                     │
│  ├─ Variable iteration count                                │
│  └─ Cold path / initialization code                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### Loop Unrolling Types

```typescript
/**
 * Configuration for basic loop unrolling
 */
interface BasicLoopUnrollConfig {
  /** Loop to unroll */
  readonly loop: LoopInfo;
  
  /** Iteration count (must be known) */
  readonly iterations: number;
  
  /** Instructions to modify per iteration */
  readonly modifiedInstructions: ModifiedInstruction[];
  
  /** Direction: count up or down */
  readonly direction: 'up' | 'down';
  
  /** Starting value */
  readonly startValue: number;
  
  /** Step size */
  readonly step: number;
}

/**
 * Instruction to be modified during loop
 */
interface ModifiedInstruction {
  /** Original IL instruction */
  readonly instruction: ILInstruction;
  
  /** Offset within instruction to modify */
  readonly offset: number;
  
  /** Size of modification (1 or 2 bytes) */
  readonly size: 1 | 2;
  
  /** Modification type */
  readonly type: 'low_byte' | 'high_byte' | 'full_address';
}

/**
 * Generated SMC code for loop
 */
interface SMCLoopCode {
  /** Initialization code (sets initial values) */
  readonly init: ILInstruction[];
  
  /** Loop body with SMC modifications */
  readonly body: ILInstruction[];
  
  /** Reset code (restores for next use) */
  readonly reset: ILInstruction[];
  
  /** Labels for the generated code */
  readonly labels: Map<string, number>;
  
  /** Total bytes generated */
  readonly totalBytes: number;
  
  /** Cycles per iteration */
  readonly cyclesPerIteration: number;
}

/**
 * Unrolling strategy selection
 */
enum UnrollStrategy {
  /** Modify counter in instructions */
  COUNTER_IN_OPERAND = 'counter_in_operand',
  
  /** Fully unroll all iterations */
  FULL_UNROLL = 'full_unroll',
  
  /** Partial unroll with residual loop */
  PARTIAL_UNROLL = 'partial_unroll',
  
  /** Duff's device style */
  DUFFS_DEVICE = 'duffs_device'
}
```

### Analysis Results

```typescript
/**
 * Analysis of a loop for unrolling potential
 */
interface LoopUnrollAnalysis {
  /** Can this loop be unrolled with SMC? */
  readonly canUnroll: boolean;
  
  /** Reason if cannot unroll */
  readonly reason?: string;
  
  /** Recommended strategy */
  readonly strategy: UnrollStrategy;
  
  /** Estimated benefit */
  readonly benefit: UnrollBenefit;
  
  /** Required modifications */
  readonly modifications: ModifiedInstruction[];
  
  /** Constraints that apply */
  readonly constraints: UnrollConstraint[];
}

/**
 * Benefit estimation for unrolling
 */
interface UnrollBenefit {
  /** Cycles saved per full execution */
  readonly cyclesSaved: number;
  
  /** Percentage speedup */
  readonly speedupPercent: number;
  
  /** Size cost in bytes */
  readonly sizeIncrease: number;
  
  /** Registers freed */
  readonly registersFreed: Register[];
}

/**
 * Constraint on unrolling
 */
interface UnrollConstraint {
  /** Constraint type */
  readonly type: 'address_range' | 'page_crossing' | 'alignment';
  
  /** Description */
  readonly description: string;
  
  /** Whether it's blocking */
  readonly blocking: boolean;
}
```

---

## Implementation

### Basic Loop Unroller

```typescript
/**
 * Implements basic SMC loop unrolling
 * 
 * Transforms indexed loops into SMC loops where the loop counter
 * is embedded directly in instruction operands.
 * 
 * @example
 * ```typescript
 * const unroller = new BasicLoopUnroller();
 * const analysis = unroller.analyze(loop, context);
 * if (analysis.canUnroll) {
 *   const code = unroller.generate(loop, analysis);
 * }
 * ```
 */
class BasicLoopUnroller {
  /** Configuration options */
  protected readonly config: BasicUnrollerConfig;
  
  constructor(config: Partial<BasicUnrollerConfig> = {}) {
    this.config = { ...DEFAULT_UNROLLER_CONFIG, ...config };
  }
  
  /**
   * Analyze loop for unrolling potential
   */
  analyze(loop: LoopInfo, context: SMCContext): LoopUnrollAnalysis {
    // Check basic eligibility
    const eligibility = this.checkEligibility(loop);
    if (!eligibility.eligible) {
      return {
        canUnroll: false,
        reason: eligibility.reason,
        strategy: UnrollStrategy.COUNTER_IN_OPERAND,
        benefit: this.zeroBenefit(),
        modifications: [],
        constraints: []
      };
    }
    
    // Find instructions to modify
    const modifications = this.findModifiableInstructions(loop, context);
    if (modifications.length === 0) {
      return {
        canUnroll: false,
        reason: 'No instructions benefit from SMC modification',
        strategy: UnrollStrategy.COUNTER_IN_OPERAND,
        benefit: this.zeroBenefit(),
        modifications: [],
        constraints: []
      };
    }
    
    // Select strategy
    const strategy = this.selectStrategy(loop, modifications);
    
    // Estimate benefit
    const benefit = this.estimateBenefit(loop, modifications, strategy);
    
    // Identify constraints
    const constraints = this.identifyConstraints(loop, modifications);
    
    return {
      canUnroll: !constraints.some(c => c.blocking),
      strategy,
      benefit,
      modifications,
      constraints
    };
  }
  
  /**
   * Check basic eligibility for unrolling
   */
  protected checkEligibility(loop: LoopInfo): { eligible: boolean; reason?: string } {
    // Must have known iteration count
    if (loop.iterationCount === 'unknown') {
      return { eligible: false, reason: 'Unknown iteration count' };
    }
    
    // Must have reasonable iteration count
    const count = loop.iterationCount as number;
    if (count > this.config.maxIterations) {
      return { eligible: false, reason: `Too many iterations: ${count}` };
    }
    if (count < this.config.minIterations) {
      return { eligible: false, reason: `Too few iterations: ${count}` };
    }
    
    // Must have single exit
    if (loop.exits.length > 1) {
      return { eligible: false, reason: 'Multiple loop exits' };
    }
    
    // Must not contain function calls (unless marked safe)
    if (this.containsUnsafeCalls(loop)) {
      return { eligible: false, reason: 'Contains unsafe function calls' };
    }
    
    return { eligible: true };
  }
  
  /**
   * Find instructions that can be modified
   */
  protected findModifiableInstructions(
    loop: LoopInfo,
    context: SMCContext
  ): ModifiedInstruction[] {
    const modifications: ModifiedInstruction[] = [];
    
    for (const block of loop.blocks) {
      for (const inst of block.instructions) {
        // Check for indexed addressing that uses loop counter
        if (this.usesLoopCounter(inst, loop, context)) {
          const mod = this.createModification(inst, loop);
          if (mod) {
            modifications.push(mod);
          }
        }
      }
    }
    
    return modifications;
  }
  
  /**
   * Check if instruction uses loop counter for indexing
   */
  protected usesLoopCounter(
    inst: ILInstruction,
    loop: LoopInfo,
    context: SMCContext
  ): boolean {
    // Must be a load or store
    if (inst.opcode !== ILOpcode.LOAD && inst.opcode !== ILOpcode.STORE) {
      return false;
    }
    
    // Must use indexed addressing
    const mode = inst.metadata?.addressingMode;
    if (mode !== AddressingMode.ABSOLUTE_X && 
        mode !== AddressingMode.ABSOLUTE_Y &&
        mode !== AddressingMode.ZERO_PAGE_X &&
        mode !== AddressingMode.ZERO_PAGE_Y) {
      return false;
    }
    
    // Index register must be loop counter
    const indexReg = mode.includes('X') ? 'X' : 'Y';
    return this.isLoopCounter(inst.operands, indexReg, loop, context);
  }
  
  /**
   * Create modification descriptor for instruction
   */
  protected createModification(
    inst: ILInstruction,
    loop: LoopInfo
  ): ModifiedInstruction | null {
    const mode = inst.metadata?.addressingMode;
    
    // Determine offset and size based on addressing mode
    let offset: number;
    let size: 1 | 2;
    let type: 'low_byte' | 'high_byte' | 'full_address';
    
    if (mode === AddressingMode.ZERO_PAGE_X || 
        mode === AddressingMode.ZERO_PAGE_Y) {
      // Zero page: 1 byte operand at offset 1
      offset = 1;
      size = 1;
      type = 'low_byte';
    } else {
      // Absolute: 2 byte operand at offset 1
      // Usually only modify low byte for loop counter
      offset = 1;
      size = 1;
      type = 'low_byte';
    }
    
    return { instruction: inst, offset, size, type };
  }
  
  /**
   * Select unrolling strategy
   */
  protected selectStrategy(
    loop: LoopInfo,
    modifications: ModifiedInstruction[]
  ): UnrollStrategy {
    const count = loop.iterationCount as number;
    
    // Very small loops: full unroll
    if (count <= 4 && modifications.length <= 2) {
      return UnrollStrategy.FULL_UNROLL;
    }
    
    // Standard case: counter in operand
    if (count <= 16) {
      return UnrollStrategy.COUNTER_IN_OPERAND;
    }
    
    // Larger loops: partial unroll
    return UnrollStrategy.PARTIAL_UNROLL;
  }
  
  /**
   * Generate SMC code for loop
   */
  generate(loop: LoopInfo, analysis: LoopUnrollAnalysis): SMCLoopCode {
    switch (analysis.strategy) {
      case UnrollStrategy.COUNTER_IN_OPERAND:
        return this.generateCounterInOperand(loop, analysis);
      case UnrollStrategy.FULL_UNROLL:
        return this.generateFullUnroll(loop, analysis);
      case UnrollStrategy.PARTIAL_UNROLL:
        return this.generatePartialUnroll(loop, analysis);
      default:
        return this.generateCounterInOperand(loop, analysis);
    }
  }
  
  /**
   * Generate counter-in-operand SMC
   */
  protected generateCounterInOperand(
    loop: LoopInfo,
    analysis: LoopUnrollAnalysis
  ): SMCLoopCode {
    const init: ILInstruction[] = [];
    const body: ILInstruction[] = [];
    const reset: ILInstruction[] = [];
    const labels = new Map<string, number>();
    
    const count = loop.iterationCount as number;
    const mods = analysis.modifications;
    
    // Initialization: set starting values in operands
    for (const mod of mods) {
      const startAddr = this.getBaseAddress(mod.instruction) + (count - 1);
      init.push(this.createStoreImmediate(
        mod.instruction,
        mod.offset,
        startAddr & 0xFF
      ));
    }
    
    // Loop body label
    const loopLabel = `smc_loop_${loop.header.id}`;
    labels.set(loopLabel, body.length);
    
    // Modified instructions (no index register)
    for (const mod of mods) {
      body.push(this.convertToAbsolute(mod.instruction));
    }
    
    // Decrement operands
    for (const mod of mods) {
      body.push(this.createDecOperand(mod, loopLabel));
    }
    
    // Loop condition
    body.push(this.createBranchPositive(loopLabel));
    
    // Reset: restore original values for next invocation
    for (const mod of mods) {
      const startAddr = this.getBaseAddress(mod.instruction) + (count - 1);
      reset.push(this.createStoreImmediate(
        mod.instruction,
        mod.offset,
        startAddr & 0xFF
      ));
    }
    
    const totalBytes = this.calculateTotalBytes(init, body, reset);
    const cyclesPerIteration = this.calculateCyclesPerIteration(body);
    
    return { init, body, reset, labels, totalBytes, cyclesPerIteration };
  }
  
  /**
   * Generate fully unrolled code
   */
  protected generateFullUnroll(
    loop: LoopInfo,
    analysis: LoopUnrollAnalysis
  ): SMCLoopCode {
    const init: ILInstruction[] = [];
    const body: ILInstruction[] = [];
    const reset: ILInstruction[] = [];
    const labels = new Map<string, number>();
    
    const count = loop.iterationCount as number;
    
    // Generate code for each iteration
    for (let i = count - 1; i >= 0; i--) {
      for (const mod of analysis.modifications) {
        const addr = this.getBaseAddress(mod.instruction) + i;
        body.push(this.createAbsoluteAccess(mod.instruction, addr));
      }
    }
    
    const totalBytes = body.length * 3; // Approximate
    const cyclesPerIteration = 4; // Absolute access
    
    return { init, body, reset, labels, totalBytes, cyclesPerIteration };
  }
  
  /**
   * Estimate benefit of unrolling
   */
  protected estimateBenefit(
    loop: LoopInfo,
    modifications: ModifiedInstruction[],
    strategy: UnrollStrategy
  ): UnrollBenefit {
    const count = loop.iterationCount as number;
    
    // Original cycles per iteration
    // LDA abs,X (4) + DEX (2) + BNE (3) = 9 cycles minimum
    const originalCyclesPerIter = 4 + 2 + 3;
    const originalTotal = originalCyclesPerIter * count;
    
    // SMC cycles per iteration (depends on strategy)
    let smcCyclesPerIter: number;
    let sizeIncrease: number;
    
    if (strategy === UnrollStrategy.FULL_UNROLL) {
      smcCyclesPerIter = 4; // Just absolute accesses
      sizeIncrease = count * 3 - 6; // Each access is 3 bytes
    } else {
      // Counter in operand: DEC mem (6) per modification
      smcCyclesPerIter = 4 + modifications.length * 6 + 3;
      sizeIncrease = modifications.length * 3; // DEC instructions
    }
    
    const smcTotal = smcCyclesPerIter * count;
    const cyclesSaved = originalTotal - smcTotal;
    const speedupPercent = (cyclesSaved / originalTotal) * 100;
    
    return {
      cyclesSaved,
      speedupPercent,
      sizeIncrease,
      registersFreed: ['X'] // Typically frees X register
    };
  }
  
  /**
   * Convert indexed instruction to absolute
   */
  protected convertToAbsolute(inst: ILInstruction): ILInstruction {
    // Create new instruction with absolute addressing
    return {
      ...inst,
      metadata: {
        ...inst.metadata,
        addressingMode: AddressingMode.ABSOLUTE
      },
      // Operand will be modified by SMC
      operands: [{ kind: 'address', value: 0 }] // Placeholder
    };
  }
  
  /**
   * Create DEC instruction for operand modification
   */
  protected createDecOperand(
    mod: ModifiedInstruction,
    loopLabel: string
  ): ILInstruction {
    // DEC loopLabel+offset
    return {
      opcode: ILOpcode.DEC,
      operands: [
        { kind: 'label_offset', label: loopLabel, offset: mod.offset }
      ],
      metadata: {
        addressingMode: AddressingMode.ABSOLUTE,
        cycles: 6,
        bytes: 3
      }
    };
  }
}
```

---

## Blend65 Integration

### Example Transformations

```js
// Before SMC unrolling
function copyRow(src: word, dst: word): void {
    for (let i: byte = 0; i < 40; i++) {
        poke(dst + i, peek(src + i));
    }
}

// After SMC unrolling (conceptually)
// The compiler generates equivalent to:
/*
    ; Initialize operands to src+39, dst+39
copy_loop:
    LDA src+39      ; Modified each iteration
    STA dst+39      ; Modified each iteration
    DEC copy_loop+1 ; Decrement LDA operand
    DEC copy_loop+4 ; Decrement STA operand
    BPL copy_loop
    ; Reset operands for next call
    LDA #39
    STA copy_loop+1
    STA copy_loop+4
*/
```

### Full Unroll Example

```js
// Small loop - fully unrolled
function updateSprites(): void {
    for (let i: byte = 0; i < 4; i++) {
        pokeVIC($D000 + i * 2, spriteX[i]);
    }
}

// Becomes (no loop at all):
/*
    LDA spriteX+0
    STA $D000
    LDA spriteX+1
    STA $D002
    LDA spriteX+2
    STA $D004
    LDA spriteX+3
    STA $D006
*/
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Eligibility Check | 5 | Iteration bounds, exit count, calls |
| Modification Finding | 5 | Index detection, addressing modes |
| Strategy Selection | 4 | Full/counter/partial selection |
| Code Generation | 6 | Init, body, reset generation |
| Benefit Estimation | 4 | Cycle/size calculations |
| Edge Cases | 4 | Boundary values, page crossings |

**Total: ~28 tests**

---

## Task Checklist

- [ ] Define BasicLoopUnrollConfig interface
- [ ] Define ModifiedInstruction interface
- [ ] Define SMCLoopCode interface
- [ ] Define UnrollStrategy enum
- [ ] Implement BasicLoopUnroller class
- [ ] Implement eligibility checking
- [ ] Implement modification finding
- [ ] Implement strategy selection
- [ ] Implement counter-in-operand generation
- [ ] Implement full unroll generation
- [ ] Implement benefit estimation
- [ ] Create comprehensive unit tests

---

## Next Document

**10-02a2-smc-loop-param.md** - SMC parameterized loop unrolling