# Task 10.3a: SMC Static Jump Tables

> **Session**: 5.3a
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2-3 hours
> **Tests**: 20-25 unit tests
> **Prerequisites**: 10-02b-smc-loop-dynamic.md

---

## Overview

This document specifies **SMC static jump tables** for optimizing switch statements and dispatch tables with known, fixed targets.

### Static vs Computed Jump Tables

- **Static**: Jump targets known at compile time
- **Computed**: Jump targets calculated at runtime

### Why SMC Jump Tables?

Traditional 6502 dispatch:
```asm
    ; Indirect jump through table
    LDA index
    ASL A           ; *2 for word addresses
    TAX
    LDA table,X
    STA ptr
    LDA table+1,X
    STA ptr+1
    JMP (ptr)       ; 5 cycles for indirect jump
```

SMC approach:
```asm
    ; Modify JMP operand directly
    LDA index
    ASL A
    TAX
    LDA table,X
    STA jmp_inst+1
    LDA table+1,X
    STA jmp_inst+2
jmp_inst:
    JMP $0000       ; 3 cycles for absolute jump
```

---

## Type Definitions

### Static Jump Table Types

```typescript
/**
 * Configuration for static jump table
 */
interface StaticJumpTableConfig {
  /** Table identifier */
  readonly id: string;
  
  /** Number of entries */
  readonly entryCount: number;
  
  /** Jump targets (known at compile time) */
  readonly targets: JumpTarget[];
  
  /** Index source */
  readonly indexSource: IndexSource;
  
  /** Whether table is exhaustive (all cases covered) */
  readonly exhaustive: boolean;
  
  /** Default target if not exhaustive */
  readonly defaultTarget?: JumpTarget;
}

/**
 * Jump target entry
 */
interface JumpTarget {
  /** Index value for this target */
  readonly index: number;
  
  /** Target label or address */
  readonly target: string | number;
  
  /** Estimated execution frequency */
  readonly frequency?: number;
}

/**
 * Source of the jump index
 */
interface IndexSource {
  /** Source type */
  readonly type: 'variable' | 'register' | 'expression';
  
  /** Variable name or register */
  readonly source: string;
  
  /** Range of valid values */
  readonly range: IndexRange;
  
  /** Whether bounds checking is needed */
  readonly needsBoundsCheck: boolean;
}

/**
 * Valid index range
 */
interface IndexRange {
  readonly min: number;
  readonly max: number;
}

/**
 * Generated jump table code
 */
interface StaticJumpTableCode {
  /** Table data (addresses) */
  readonly tableData: number[];
  
  /** Dispatch code */
  readonly dispatchCode: ILInstruction[];
  
  /** Bounds check code (if needed) */
  readonly boundsCheck?: ILInstruction[];
  
  /** Total bytes for table and code */
  readonly totalBytes: number;
  
  /** Cycles for dispatch */
  readonly dispatchCycles: number;
}
```

---

## Implementation

### Static Jump Table Generator

```typescript
/**
 * Generates SMC static jump tables
 * 
 * Creates optimized dispatch code for switch statements and
 * function tables where all targets are known at compile time.
 * 
 * @example
 * ```typescript
 * const generator = new StaticJumpTableGenerator();
 * const code = generator.generate({
 *   id: 'command_dispatch',
 *   entryCount: 8,
 *   targets: [
 *     { index: 0, target: 'cmd_move' },
 *     { index: 1, target: 'cmd_fire' },
 *     // ...
 *   ],
 *   indexSource: { type: 'variable', source: 'command', ... }
 * });
 * ```
 */
class StaticJumpTableGenerator {
  protected readonly config: JumpTableGenConfig;
  
  constructor(config: Partial<JumpTableGenConfig> = {}) {
    this.config = { ...DEFAULT_JUMP_CONFIG, ...config };
  }
  
  /**
   * Analyze switch/dispatch for jump table conversion
   */
  analyze(pattern: SMCPattern, context: SMCContext): JumpTableAnalysis {
    // Extract case values and targets
    const cases = this.extractCases(pattern, context);
    
    // Check if suitable for jump table
    const suitable = this.isSuitable(cases);
    
    // Calculate metrics
    const density = this.calculateDensity(cases);
    const benefit = this.calculateBenefit(cases, pattern);
    
    return {
      suitable,
      cases,
      density,
      benefit,
      recommendation: suitable && benefit.netCycles > 0
        ? 'apply' : 'skip'
    };
  }
  
  /**
   * Generate static jump table code
   */
  generate(config: StaticJumpTableConfig): StaticJumpTableCode {
    const tableData: number[] = [];
    const dispatchCode: ILInstruction[] = [];
    
    // Build table data
    for (let i = 0; i <= config.indexSource.range.max; i++) {
      const target = config.targets.find(t => t.index === i);
      if (target) {
        tableData.push(this.resolveTarget(target));
      } else if (config.defaultTarget) {
        tableData.push(this.resolveTarget(config.defaultTarget));
      } else {
        tableData.push(0); // Invalid entry
      }
    }
    
    // Generate bounds check if needed
    let boundsCheck: ILInstruction[] | undefined;
    if (config.indexSource.needsBoundsCheck) {
      boundsCheck = this.generateBoundsCheck(config);
    }
    
    // Generate dispatch code
    this.generateDispatch(config, dispatchCode);
    
    const totalBytes = tableData.length * 2 + this.countBytes(dispatchCode);
    const dispatchCycles = this.countCycles(dispatchCode);
    
    return {
      tableData,
      dispatchCode,
      boundsCheck,
      totalBytes,
      dispatchCycles
    };
  }
  
  /**
   * Generate dispatch code
   */
  protected generateDispatch(
    config: StaticJumpTableConfig,
    code: ILInstruction[]
  ): void {
    // Load index
    if (config.indexSource.type === 'variable') {
      code.push(this.createLoad(config.indexSource.source));
    } else if (config.indexSource.type === 'register') {
      // Index already in register
      if (config.indexSource.source !== 'A') {
        code.push(this.createTransfer(config.indexSource.source, 'A'));
      }
    }
    
    // Multiply by 2 for word addresses
    code.push(this.createASL());
    code.push(this.createTAX());
    
    // Load target address from table
    code.push(this.createLoadTableLow(config.id));
    code.push(this.createStoreJumpLow());
    code.push(this.createLoadTableHigh(config.id));
    code.push(this.createStoreJumpHigh());
    
    // SMC jump instruction (operand modified above)
    code.push(this.createSMCJump());
  }
  
  /**
   * Generate bounds checking code
   */
  protected generateBoundsCheck(
    config: StaticJumpTableConfig
  ): ILInstruction[] {
    const code: ILInstruction[] = [];
    const range = config.indexSource.range;
    
    // Check lower bound
    if (range.min > 0) {
      code.push(this.createCompareImmediate(range.min));
      code.push(this.createBranchCarryClear('out_of_bounds'));
    }
    
    // Check upper bound
    code.push(this.createCompareImmediate(range.max + 1));
    code.push(this.createBranchCarrySet('out_of_bounds'));
    
    return code;
  }
  
  /**
   * Check if cases are suitable for jump table
   */
  protected isSuitable(cases: CaseInfo[]): boolean {
    if (cases.length < this.config.minCases) {
      return false;
    }
    
    // Check density (too sparse = waste of memory)
    const density = this.calculateDensity(cases);
    if (density < this.config.minDensity) {
      return false;
    }
    
    // Check range (too large = too much memory)
    const range = this.calculateRange(cases);
    if (range > this.config.maxRange) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculate table density
   */
  protected calculateDensity(cases: CaseInfo[]): number {
    if (cases.length === 0) return 0;
    
    const min = Math.min(...cases.map(c => c.index));
    const max = Math.max(...cases.map(c => c.index));
    const range = max - min + 1;
    
    return cases.length / range;
  }
  
  /**
   * Calculate benefit of using jump table
   */
  protected calculateBenefit(
    cases: CaseInfo[],
    pattern: SMCPattern
  ): JumpTableBenefit {
    // Compare chain: CMP #n, BEQ target, CMP #m, BEQ target2, ...
    // Average cycles: (n/2) * (2 + 2 + 3) = 3.5n
    const compareCycles = cases.length * 3.5;
    
    // Jump table: ~20 cycles fixed
    const tableCycles = 20;
    
    // Memory cost: 2 bytes per entry
    const range = this.calculateRange(cases);
    const memoryCost = range * 2 + 15; // Table + dispatch code
    
    return {
      originalCycles: compareCycles,
      tableCycles,
      netCycles: compareCycles - tableCycles,
      memoryCost,
      breakEvenCases: Math.ceil(tableCycles / 3.5)
    };
  }
  
  /**
   * Create SMC jump instruction
   */
  protected createSMCJump(): ILInstruction {
    return {
      opcode: ILOpcode.JUMP,
      operands: [{ kind: 'address', value: 0 }], // Modified by SMC
      metadata: {
        smc: true,
        addressingMode: AddressingMode.ABSOLUTE,
        cycles: 3,
        bytes: 3
      }
    };
  }
}
```

---

## Blend65 Integration

### Switch Statement Optimization

```js
// Switch statement - converted to jump table
function handleCommand(cmd: byte): void {
    switch (cmd) {
        case 0: movePlayer(); break;
        case 1: fireWeapon(); break;
        case 2: jumpAction(); break;
        case 3: useItem(); break;
        case 4: openMenu(); break;
        case 5: saveGame(); break;
        case 6: loadGame(); break;
        case 7: quitGame(); break;
    }
}

// Generated SMC jump table:
/*
cmd_table:
    .word movePlayer
    .word fireWeapon
    .word jumpAction
    .word useItem
    .word openMenu
    .word saveGame
    .word loadGame
    .word quitGame

handleCommand:
    LDA cmd
    ASL A               ; *2 for word table
    TAX
    LDA cmd_table,X     ; Load low byte
    STA jmp+1
    LDA cmd_table+1,X   ; Load high byte
    STA jmp+2
jmp:
    JMP $0000           ; Modified target
*/
```

### Function Dispatch Tables

```js
// Function pointer table
const handlers: array<word, 4> = [
    &handleIdle,
    &handleRun,
    &handleJump,
    &handleFall
];

function dispatchState(state: byte): void {
    // Optimized to SMC jump table
    handlers[state]();
}
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Suitability Check | 4 | Density, range, case count |
| Table Generation | 5 | Data layout, entry order |
| Dispatch Code | 5 | Index handling, SMC jump |
| Bounds Checking | 4 | Range validation |
| Benefit Calculation | 4 | Cycle comparison |

**Total: ~22 tests**

---

## Task Checklist

- [ ] Define StaticJumpTableConfig interface
- [ ] Define JumpTarget interface
- [ ] Define IndexSource interface
- [ ] Define StaticJumpTableCode interface
- [ ] Implement StaticJumpTableGenerator class
- [ ] Implement suitability analysis
- [ ] Implement table data generation
- [ ] Implement dispatch code generation
- [ ] Implement bounds checking
- [ ] Implement benefit calculation
- [ ] Create comprehensive unit tests

---

## Next Document

**10-03b-smc-jumptable-computed.md** - SMC computed jump targets