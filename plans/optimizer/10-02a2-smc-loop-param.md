# Task 10.2a2: SMC Parameterized Loop Unrolling

> **Session**: 5.2a2
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2-3 hours
> **Tests**: 20-25 unit tests
> **Prerequisites**: 10-02a1-smc-loop-basic.md

---

## Overview

This document specifies **parameterized SMC loop unrolling** where loop parameters (start, end, step) can be passed at runtime while still benefiting from SMC optimizations.

### Parameterized vs Basic Unrolling

- **Basic**: Fixed iteration count known at compile time
- **Parameterized**: Variable bounds, but fixed structure allows SMC

### Use Cases

```
┌─────────────────────────────────────────────────────────────┐
│           Parameterized Loop Unrolling Use Cases             │
├─────────────────────────────────────────────────────────────┤
│  1. Variable-Length Copies   - memcpy with runtime length   │
│  2. Partial Screen Updates   - Update n rows/columns        │
│  3. Dynamic Array Processing - Process first n elements     │
│  4. Configurable Routines    - Same code, different params  │
└─────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### Parameterized Unrolling Types

```typescript
/**
 * Configuration for parameterized loop unrolling
 */
interface ParameterizedUnrollConfig {
  /** Loop to unroll */
  readonly loop: LoopInfo;
  
  /** Start parameter (may be runtime value) */
  readonly startParam: LoopParameter;
  
  /** End parameter (may be runtime value) */
  readonly endParam: LoopParameter;
  
  /** Step parameter (usually constant) */
  readonly stepParam: LoopParameter;
  
  /** Maximum expected iterations (for buffer sizing) */
  readonly maxIterations: number;
}

/**
 * Loop parameter that may be constant or runtime
 */
interface LoopParameter {
  /** Parameter kind */
  readonly kind: 'constant' | 'variable' | 'argument';
  
  /** Constant value (if kind is 'constant') */
  readonly value?: number;
  
  /** Variable name (if kind is 'variable' or 'argument') */
  readonly name?: string;
  
  /** Zero page location for fast access */
  readonly zpLocation?: number;
}

/**
 * Generated parameterized SMC code
 */
interface ParameterizedSMCCode {
  /** Setup code (copies params to SMC locations) */
  readonly setup: ILInstruction[];
  
  /** Loop body with parameterized SMC */
  readonly body: ILInstruction[];
  
  /** Cleanup code (restores original values) */
  readonly cleanup: ILInstruction[];
  
  /** Parameter locations in generated code */
  readonly paramLocations: ParameterLocation[];
  
  /** Estimated cycles (depends on actual iterations) */
  readonly cyclesPerIteration: number;
  
  /** Setup overhead cycles */
  readonly setupCycles: number;
}

/**
 * Location of a parameter in SMC code
 */
interface ParameterLocation {
  /** Parameter name */
  readonly param: string;
  
  /** Offset in code where parameter is stored */
  readonly offset: number;
  
  /** Size in bytes */
  readonly size: 1 | 2;
  
  /** Whether this is start, end, or current value */
  readonly role: 'start' | 'end' | 'current' | 'step';
}
```

### Runtime Interface

```typescript
/**
 * Interface for calling parameterized SMC routine
 */
interface SMCRoutineCall {
  /** Routine entry point */
  readonly entryPoint: number;
  
  /** Parameter setup sequence */
  readonly parameters: SMCParameter[];
  
  /** Whether routine modifies itself (needs reset) */
  readonly selfModifying: boolean;
  
  /** Reset entry point (if different from main) */
  readonly resetPoint?: number;
}

/**
 * Runtime parameter for SMC routine
 */
interface SMCParameter {
  /** Parameter name */
  readonly name: string;
  
  /** How to pass the parameter */
  readonly passMethod: 'register' | 'stack' | 'direct_store';
  
  /** Register to use (if passMethod is 'register') */
  readonly register?: 'A' | 'X' | 'Y';
  
  /** Address to store to (if passMethod is 'direct_store') */
  readonly address?: number;
}
```

---

## Implementation

### Parameterized Loop Unroller

```typescript
/**
 * Implements parameterized SMC loop unrolling
 * 
 * Generates SMC code that can handle variable loop bounds
 * while still benefiting from operand modification.
 * 
 * @example
 * ```typescript
 * const unroller = new ParameterizedLoopUnroller();
 * const code = unroller.generate(loop, {
 *   startParam: { kind: 'constant', value: 0 },
 *   endParam: { kind: 'argument', name: 'length' },
 *   stepParam: { kind: 'constant', value: 1 },
 *   maxIterations: 256
 * });
 * ```
 */
class ParameterizedLoopUnroller {
  protected readonly config: ParameterizedUnrollerConfig;
  
  constructor(config: Partial<ParameterizedUnrollerConfig> = {}) {
    this.config = { ...DEFAULT_PARAM_CONFIG, ...config };
  }
  
  /**
   * Analyze loop for parameterized unrolling
   */
  analyze(
    loop: LoopInfo,
    context: SMCContext
  ): ParameterizedAnalysis {
    // Identify loop parameters
    const params = this.identifyParameters(loop, context);
    
    // Check if parameterization is beneficial
    const beneficial = this.isBeneficial(loop, params, context);
    
    // Estimate maximum iterations
    const maxIter = this.estimateMaxIterations(params, context);
    
    // Calculate overhead
    const overhead = this.calculateSetupOverhead(params);
    
    return {
      canParameterize: beneficial,
      parameters: params,
      maxIterations: maxIter,
      setupOverhead: overhead,
      breakEvenIterations: this.calculateBreakEven(overhead, loop)
    };
  }
  
  /**
   * Generate parameterized SMC code
   */
  generate(
    loop: LoopInfo,
    config: ParameterizedUnrollConfig
  ): ParameterizedSMCCode {
    const setup: ILInstruction[] = [];
    const body: ILInstruction[] = [];
    const cleanup: ILInstruction[] = [];
    const paramLocations: ParameterLocation[] = [];
    
    // Generate setup code
    this.generateSetup(config, setup, paramLocations);
    
    // Generate parameterized loop body
    this.generateBody(loop, config, body, paramLocations);
    
    // Generate cleanup/reset code
    this.generateCleanup(config, cleanup, paramLocations);
    
    const cyclesPerIteration = this.calculateCyclesPerIteration(body);
    const setupCycles = this.calculateSetupCycles(setup);
    
    return {
      setup,
      body,
      cleanup,
      paramLocations,
      cyclesPerIteration,
      setupCycles
    };
  }
  
  /**
   * Generate setup code that initializes SMC operands
   */
  protected generateSetup(
    config: ParameterizedUnrollConfig,
    setup: ILInstruction[],
    paramLocations: ParameterLocation[]
  ): void {
    // Initialize start value in operands
    if (config.startParam.kind === 'constant') {
      // Constant start: embed directly
      setup.push(this.createLoadImmediate(config.startParam.value!));
    } else {
      // Variable start: load from parameter
      setup.push(this.createLoadVariable(config.startParam));
    }
    
    // Store to SMC operand location
    const startLocation = this.allocateParamLocation('start');
    setup.push(this.createStoreAbsolute(startLocation.offset));
    paramLocations.push(startLocation);
    
    // Initialize end value for comparison
    if (config.endParam.kind !== 'constant') {
      setup.push(this.createLoadVariable(config.endParam));
      const endLocation = this.allocateParamLocation('end');
      setup.push(this.createStoreAbsolute(endLocation.offset));
      paramLocations.push(endLocation);
    }
  }
  
  /**
   * Generate parameterized loop body
   */
  protected generateBody(
    loop: LoopInfo,
    config: ParameterizedUnrollConfig,
    body: ILInstruction[],
    paramLocations: ParameterLocation[]
  ): void {
    const loopLabel = `param_loop_${loop.header.id}`;
    
    // Loop body with SMC operands
    for (const block of loop.blocks) {
      for (const inst of block.instructions) {
        if (this.isModifiableInstruction(inst)) {
          body.push(this.convertToSMC(inst, paramLocations));
        } else if (!this.isLoopControl(inst)) {
          body.push(inst);
        }
      }
    }
    
    // Update SMC operands
    if (config.stepParam.kind === 'constant' && config.stepParam.value === 1) {
      // Simple increment
      body.push(this.createIncOperand(paramLocations[0]));
    } else {
      // General step
      body.push(this.createAddStep(config.stepParam, paramLocations[0]));
    }
    
    // Loop condition
    if (config.endParam.kind === 'constant') {
      body.push(this.createCompareImmediate(config.endParam.value!));
    } else {
      const endLoc = paramLocations.find(p => p.role === 'end')!;
      body.push(this.createCompareAbsolute(endLoc.offset));
    }
    body.push(this.createBranchNotEqual(loopLabel));
  }
  
  /**
   * Generate cleanup code
   */
  protected generateCleanup(
    config: ParameterizedUnrollConfig,
    cleanup: ILInstruction[],
    paramLocations: ParameterLocation[]
  ): void {
    // Reset SMC operands for next invocation
    // Only needed if routine will be called again
    
    for (const loc of paramLocations) {
      if (loc.role === 'current' || loc.role === 'start') {
        // Reset to initial value
        if (config.startParam.kind === 'constant') {
          cleanup.push(this.createLoadImmediate(config.startParam.value!));
          cleanup.push(this.createStoreAbsolute(loc.offset));
        }
        // For variable start, caller must re-setup
      }
    }
  }
  
  /**
   * Calculate setup overhead in cycles
   */
  protected calculateSetupOverhead(params: LoopParameter[]): number {
    let cycles = 0;
    
    for (const param of params) {
      if (param.kind === 'constant') {
        cycles += 2 + 4; // LDA #imm + STA abs
      } else if (param.zpLocation) {
        cycles += 3 + 4; // LDA zp + STA abs
      } else {
        cycles += 4 + 4; // LDA abs + STA abs
      }
    }
    
    return cycles;
  }
  
  /**
   * Calculate break-even point
   */
  protected calculateBreakEven(overhead: number, loop: LoopInfo): number {
    // How many iterations needed to recoup setup cost
    const savingsPerIter = 2; // Typical savings per iteration
    return Math.ceil(overhead / savingsPerIter);
  }
}
```

---

## Blend65 Integration

### Parameterized Routine Examples

```js
// Variable-length memory copy with SMC
@smc(parameterized)
function fastCopy(src: word, dst: word, len: byte): void {
    // len is parameterized - SMC adapts to runtime value
    for (let i: byte = 0; i < len; i++) {
        poke(dst + i, peek(src + i));
    }
}

// Generated SMC (conceptual):
/*
fastCopy:
    ; Setup - store parameters in SMC locations
    LDA param_len       ; Load length parameter
    STA loop_end+1      ; Store in compare operand
    LDA param_src       ; Load source low byte
    STA load_inst+1     ; Store in LDA operand
    LDA param_dst       ; Load dest low byte
    STA store_inst+1    ; Store in STA operand
    
loop:
load_inst:
    LDA $0000           ; Address modified by setup
store_inst:
    STA $0000           ; Address modified by setup
    INC load_inst+1     ; Increment source
    INC store_inst+1    ; Increment dest
loop_end:
    LDA load_inst+1     ; Current position
    CMP #00             ; Compare to end (modified)
    BNE loop
    RTS
*/

// Partial screen update with parameterized rows
@smc(parameterized)  
function updateRows(startRow: byte, endRow: byte): void {
    for (let row: byte = startRow; row < endRow; row++) {
        updateScreenRow(row);
    }
}
```

### Calling Parameterized Routines

```js
// Call with different parameters
function main(): void {
    // Copy 40 bytes (one screen row)
    fastCopy($0400, $0428, 40);
    
    // Copy 80 bytes (two screen rows)
    fastCopy($0450, $04C8, 80);
    
    // Update first 10 rows
    updateRows(0, 10);
    
    // Update rows 15-20
    updateRows(15, 20);
}
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Parameter Identification | 4 | Constant/variable/argument params |
| Setup Generation | 5 | Parameter loading, storage |
| Body Generation | 5 | SMC operand modification |
| Cleanup Generation | 3 | Reset for reuse |
| Overhead Calculation | 4 | Setup cycles, break-even |
| Integration | 4 | Full routine generation |

**Total: ~25 tests**

---

## Task Checklist

- [ ] Define ParameterizedUnrollConfig interface
- [ ] Define LoopParameter interface
- [ ] Define ParameterizedSMCCode interface
- [ ] Define ParameterLocation interface
- [ ] Implement ParameterizedLoopUnroller class
- [ ] Implement parameter identification
- [ ] Implement setup code generation
- [ ] Implement body code generation
- [ ] Implement cleanup generation
- [ ] Implement overhead calculation
- [ ] Create comprehensive unit tests

---

## Next Document

**10-02b-smc-loop-dynamic.md** - SMC dynamic addressing patterns