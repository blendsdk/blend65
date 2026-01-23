# Task 10.2b: SMC Dynamic Addressing

> **Session**: 5.2b
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2-3 hours
> **Tests**: 20-25 unit tests
> **Prerequisites**: 10-02a2-smc-loop-param.md

---

## Overview

This document specifies **SMC dynamic addressing** patterns where base addresses are modified at runtime to simulate advanced addressing modes not directly supported by the 6502.

### Why Dynamic Addressing?

The 6502 has limited addressing modes:
- No `LDA (ptr),Y` with 16-bit offset
- No `LDA base,X,Y` (double indexing)
- No `LDA [ptr]` (indirect without index)

SMC can simulate these by modifying instruction operands.

### Dynamic Addressing Patterns

```
┌─────────────────────────────────────────────────────────────┐
│              SMC Dynamic Addressing Patterns                 │
├─────────────────────────────────────────────────────────────┤
│  1. Pointer Dereferencing  - Replace (zp),Y with direct    │
│  2. Multi-dimensional      - table[row][col] access        │
│  3. Sliding Window         - Moving base address           │
│  4. Bank Switching         - Change high byte only         │
│  5. Stride Access          - Non-sequential element access │
└─────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### Dynamic Address Types

```typescript
/**
 * Dynamic address pattern configuration
 */
interface DynamicAddressConfig {
  /** Pattern type */
  readonly pattern: DynamicAddressPattern;
  
  /** Base address source */
  readonly baseSource: AddressSource;
  
  /** Offset source (if applicable) */
  readonly offsetSource?: AddressSource;
  
  /** Instructions to modify */
  readonly targets: DynamicTarget[];
  
  /** Update frequency */
  readonly updateFrequency: 'per_access' | 'per_iteration' | 'per_call';
}

/**
 * Types of dynamic addressing patterns
 */
enum DynamicAddressPattern {
  /** Replace indirect with absolute */
  INDIRECT_TO_ABSOLUTE = 'indirect_to_absolute',
  
  /** 2D array access optimization */
  MULTI_DIMENSIONAL = 'multi_dimensional',
  
  /** Moving window over data */
  SLIDING_WINDOW = 'sliding_window',
  
  /** Modify high byte for bank selection */
  BANK_SELECT = 'bank_select',
  
  /** Access elements with stride */
  STRIDE_ACCESS = 'stride_access'
}

/**
 * Source of an address value
 */
interface AddressSource {
  /** Source type */
  readonly type: 'constant' | 'variable' | 'computed' | 'pointer';
  
  /** Value or location */
  readonly value?: number;
  readonly variable?: string;
  readonly computation?: string;
  
  /** Size of address (1 or 2 bytes) */
  readonly size: 1 | 2;
}

/**
 * Target instruction for address modification
 */
interface DynamicTarget {
  /** Instruction to modify */
  readonly instruction: ILInstruction;
  
  /** Offset within instruction */
  readonly operandOffset: number;
  
  /** Which byte to modify */
  readonly byteSelect: 'low' | 'high' | 'both';
  
  /** Original addressing mode */
  readonly originalMode: AddressingMode;
  
  /** New addressing mode after SMC */
  readonly newMode: AddressingMode;
}

/**
 * Generated dynamic address code
 */
interface DynamicAddressCode {
  /** Address calculation code */
  readonly addressCalc: ILInstruction[];
  
  /** Modified access instructions */
  readonly accessCode: ILInstruction[];
  
  /** Address update code (for iterations) */
  readonly updateCode: ILInstruction[];
  
  /** Cycles for address calculation */
  readonly calcCycles: number;
  
  /** Cycles per access */
  readonly accessCycles: number;
}
```

---

## Implementation

### Dynamic Address Generator

```typescript
/**
 * Generates SMC code for dynamic addressing patterns
 * 
 * Transforms indirect and complex addressing into SMC patterns
 * that modify instruction operands at runtime.
 * 
 * @example
 * ```typescript
 * const generator = new DynamicAddressGenerator();
 * const code = generator.generate({
 *   pattern: DynamicAddressPattern.INDIRECT_TO_ABSOLUTE,
 *   baseSource: { type: 'pointer', variable: 'ptr', size: 2 },
 *   targets: [{ instruction: loadInst, ... }],
 *   updateFrequency: 'per_call'
 * });
 * ```
 */
class DynamicAddressGenerator {
  protected readonly config: DynamicGenConfig;
  
  constructor(config: Partial<DynamicGenConfig> = {}) {
    this.config = { ...DEFAULT_DYNAMIC_CONFIG, ...config };
  }
  
  /**
   * Analyze pattern for dynamic addressing
   */
  analyze(
    pattern: SMCPattern,
    context: SMCContext
  ): DynamicAddressAnalysis {
    // Identify addressing pattern
    const dynPattern = this.identifyPattern(pattern, context);
    
    // Find address sources
    const sources = this.findAddressSources(pattern, context);
    
    // Identify target instructions
    const targets = this.identifyTargets(pattern, context);
    
    // Calculate benefit
    const benefit = this.calculateBenefit(dynPattern, targets);
    
    return {
      pattern: dynPattern,
      sources,
      targets,
      benefit,
      recommended: benefit.cyclesSaved > benefit.overhead
    };
  }
  
  /**
   * Generate dynamic address SMC code
   */
  generate(config: DynamicAddressConfig): DynamicAddressCode {
    switch (config.pattern) {
      case DynamicAddressPattern.INDIRECT_TO_ABSOLUTE:
        return this.generateIndirectToAbsolute(config);
      case DynamicAddressPattern.MULTI_DIMENSIONAL:
        return this.generateMultiDimensional(config);
      case DynamicAddressPattern.SLIDING_WINDOW:
        return this.generateSlidingWindow(config);
      case DynamicAddressPattern.BANK_SELECT:
        return this.generateBankSelect(config);
      case DynamicAddressPattern.STRIDE_ACCESS:
        return this.generateStrideAccess(config);
      default:
        return this.generateIndirectToAbsolute(config);
    }
  }
  
  /**
   * Generate indirect-to-absolute conversion
   */
  protected generateIndirectToAbsolute(
    config: DynamicAddressConfig
  ): DynamicAddressCode {
    const addressCalc: ILInstruction[] = [];
    const accessCode: ILInstruction[] = [];
    const updateCode: ILInstruction[] = [];
    
    const baseSource = config.baseSource;
    
    // Calculate/load base address
    if (baseSource.type === 'pointer') {
      // Load pointer value and store in operand
      addressCalc.push(this.createLoadZP(baseSource.variable!, 0)); // Low byte
      addressCalc.push(this.createStoreOperand(config.targets[0], 'low'));
      addressCalc.push(this.createLoadZP(baseSource.variable!, 1)); // High byte
      addressCalc.push(this.createStoreOperand(config.targets[0], 'high'));
    } else if (baseSource.type === 'computed') {
      // Generate computation code
      addressCalc.push(...this.generateComputation(baseSource.computation!));
      addressCalc.push(this.createStoreOperand(config.targets[0], 'both'));
    }
    
    // Generate access instructions (now absolute instead of indirect)
    for (const target of config.targets) {
      accessCode.push(this.convertToAbsolute(target));
    }
    
    // Generate update code if needed per iteration
    if (config.updateFrequency === 'per_iteration') {
      updateCode.push(...this.generateAddressIncrement(config));
    }
    
    return {
      addressCalc,
      accessCode,
      updateCode,
      calcCycles: this.calculateCalcCycles(addressCalc),
      accessCycles: this.calculateAccessCycles(accessCode)
    };
  }
  
  /**
   * Generate multi-dimensional array access
   */
  protected generateMultiDimensional(
    config: DynamicAddressConfig
  ): DynamicAddressCode {
    const addressCalc: ILInstruction[] = [];
    const accessCode: ILInstruction[] = [];
    const updateCode: ILInstruction[] = [];
    
    // For table[row][col], compute row_base = table + row * row_size
    // Then access row_base + col
    
    // Assume baseSource has row info, offsetSource has col
    const rowSource = config.baseSource;
    const colSource = config.offsetSource!;
    
    // Calculate row base address
    // This is typically: base + row * stride
    addressCalc.push(this.createLoadVariable(rowSource));
    addressCalc.push(...this.generateMultiply(40)); // Assume 40-column rows
    addressCalc.push(this.createAddConstant(this.getTableBase(config)));
    
    // Store in access instruction operand
    addressCalc.push(this.createStoreOperand(config.targets[0], 'low'));
    // High byte calculation if needed
    
    // Access uses absolute,X where X = column
    for (const target of config.targets) {
      accessCode.push(this.convertToAbsoluteX(target));
    }
    
    return {
      addressCalc,
      accessCode,
      updateCode,
      calcCycles: this.calculateCalcCycles(addressCalc),
      accessCycles: this.calculateAccessCycles(accessCode)
    };
  }
  
  /**
   * Generate sliding window access
   */
  protected generateSlidingWindow(
    config: DynamicAddressConfig
  ): DynamicAddressCode {
    const addressCalc: ILInstruction[] = [];
    const accessCode: ILInstruction[] = [];
    const updateCode: ILInstruction[] = [];
    
    // Initial window position
    addressCalc.push(this.createLoadImmediate(config.baseSource.value! & 0xFF));
    addressCalc.push(this.createStoreOperand(config.targets[0], 'low'));
    addressCalc.push(this.createLoadImmediate((config.baseSource.value! >> 8) & 0xFF));
    addressCalc.push(this.createStoreOperand(config.targets[0], 'high'));
    
    // Access at current window position
    for (const target of config.targets) {
      accessCode.push(this.convertToAbsolute(target));
    }
    
    // Slide window for next iteration
    updateCode.push(this.createIncOperandLow(config.targets[0]));
    updateCode.push(this.createBranchNotZero('skip_high'));
    updateCode.push(this.createIncOperandHigh(config.targets[0]));
    updateCode.push(this.createLabel('skip_high'));
    
    return {
      addressCalc,
      accessCode,
      updateCode,
      calcCycles: this.calculateCalcCycles(addressCalc),
      accessCycles: this.calculateAccessCycles(accessCode)
    };
  }
  
  /**
   * Convert indirect access to absolute
   */
  protected convertToAbsolute(target: DynamicTarget): ILInstruction {
    return {
      ...target.instruction,
      metadata: {
        ...target.instruction.metadata,
        addressingMode: AddressingMode.ABSOLUTE
      },
      operands: [{ kind: 'address', value: 0 }] // Will be modified by SMC
    };
  }
  
  /**
   * Calculate benefit of dynamic addressing
   */
  protected calculateBenefit(
    pattern: DynamicAddressPattern,
    targets: DynamicTarget[]
  ): DynamicBenefit {
    // Cycles for original indirect access
    const indirectCycles = 5; // LDA (zp),Y
    const absoluteCycles = 4; // LDA abs
    
    const cyclesSavedPerAccess = indirectCycles - absoluteCycles;
    const totalCyclesSaved = cyclesSavedPerAccess * targets.length;
    
    // Overhead for address setup
    const overhead = this.estimateSetupCycles(pattern);
    
    return {
      cyclesSaved: totalCyclesSaved,
      overhead,
      netBenefit: totalCyclesSaved - overhead,
      registersFreed: this.identifyFreedRegisters(targets)
    };
  }
}
```

---

## Blend65 Integration

### Dynamic Addressing Examples

```js
// Indirect-to-Absolute: Pointer dereferencing
function processBuffer(ptr: word): void {
    // Original uses (zp),Y - 5 cycles per access
    // SMC converts to absolute - 4 cycles per access
    for (let i: byte = 0; i < 8; i++) {
        let value = peek(ptr + i);  // Becomes LDA ptr_smc+i
        process(value);
    }
}

// Multi-dimensional: Screen access
function plotPixel(row: byte, col: byte, char: byte): void {
    // row * 40 + col calculation done once
    // Then use absolute addressing
    let screenAddr: word = $0400 + row * 40 + col;
    poke(screenAddr, char);
}

// Generated SMC:
/*
    ; Calculate row address
    LDA row
    ASL A           ; *2
    ASL A           ; *4
    ASL A           ; *8
    ... (multiply by 40)
    CLC
    ADC #<$0400     ; Add screen base
    STA plot_addr+1 ; Store in operand
    LDA #>$0400
    ADC #0
    STA plot_addr+2
    
plot_addr:
    LDA #$00        ; Operand modified
    STA $0400       ; Address modified
*/

// Sliding window: Scrolling display
@smc(sliding_window)
function scrollBuffer(): void {
    for (let i: word = 0; i < 960; i++) {
        let src = peek($0428 + i);  // SMC: address increments
        poke($0400 + i, src);
    }
}
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Pattern Recognition | 5 | Identify addressing patterns |
| Indirect-to-Absolute | 5 | Pointer conversion |
| Multi-Dimensional | 4 | 2D array access |
| Sliding Window | 4 | Progressive address update |
| Benefit Calculation | 4 | Cycle savings, overhead |

**Total: ~22 tests**

---

## Task Checklist

- [ ] Define DynamicAddressConfig interface
- [ ] Define DynamicAddressPattern enum
- [ ] Define AddressSource interface
- [ ] Define DynamicTarget interface
- [ ] Implement DynamicAddressGenerator class
- [ ] Implement indirect-to-absolute conversion
- [ ] Implement multi-dimensional access
- [ ] Implement sliding window
- [ ] Implement bank selection
- [ ] Implement benefit calculation
- [ ] Create comprehensive unit tests

---

## Next Document

**10-03a-smc-jumptable-static.md** - SMC static jump tables