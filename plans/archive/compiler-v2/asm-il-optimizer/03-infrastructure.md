# Infrastructure: ASM-IL Optimizer

> **Document**: 03-infrastructure.md
> **Parent**: [Index](00-index.md)

## Overview

The ASM-IL Optimizer infrastructure is largely inherited from compiler-v1, with extensions for optimization level handling and CPU state analysis.

## Architecture

### Current Architecture (compiler-v1)

```
┌─────────────────────────────────────────────────┐
│            AsmOptimizer (Pass Manager)          │
│  ┌─────────────────────────────────────────┐   │
│  │  config: AsmOptimizerConfig             │   │
│  │    - enabled: boolean                    │   │
│  │    - passes: AsmOptimizationPass[]       │   │
│  │    - maxIterations: number               │   │
│  │    - debug: boolean                      │   │
│  └─────────────────────────────────────────┘   │
│                      │                          │
│                      ▼                          │
│  ┌─────────────────────────────────────────┐   │
│  │  optimize(module: AsmModule)            │   │
│  │    → Run passes in order                │   │
│  │    → Fixed-point iteration              │   │
│  │    → Return AsmOptimizationResult       │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Extended Architecture (compiler-v2)

```
┌─────────────────────────────────────────────────┐
│            AsmILOptimizer (Extended)            │
│  ┌─────────────────────────────────────────┐   │
│  │  AsmOptimizerOptions                     │   │
│  │    - level: OptimizationLevel           │   │
│  │    - sizePreference: boolean            │   │
│  │    - debug: boolean                     │   │
│  │    - zpSlots: number[]                  │   │
│  └─────────────────────────────────────────┘   │
│                      │                          │
│                      ▼                          │
│  ┌─────────────────────────────────────────┐   │
│  │  createPassesForLevel(level)            │   │
│  │    → Return configured passes           │   │
│  └─────────────────────────────────────────┘   │
│                      │                          │
│                      ▼                          │
│  ┌─────────────────────────────────────────┐   │
│  │  Analysis Utilities                      │   │
│  │    - FlagStateAnalyzer                  │   │
│  │    - RegisterTracker                    │   │
│  │    - AddressAnalyzer                    │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Implementation Details

### New Types/Interfaces

```typescript
/**
 * Optimization level enum matching CLI flags
 */
export enum OptimizationLevel {
  O0 = 'O0',  // No optimization
  O1 = 'O1',  // Basic optimization
  O2 = 'O2',  // Standard optimization
  O3 = 'O3',  // Aggressive optimization
  Os = 'Os',  // Size-optimized
  Oz = 'Oz',  // Minimum size
}

/**
 * Options for ASM-IL optimizer
 */
export interface AsmOptimizerOptions {
  /** Optimization level */
  level: OptimizationLevel;
  
  /** Debug output enabled */
  debug: boolean;
  
  /** Available zero-page slots for promotion */
  zpSlots: number[];
  
  /** Maximum fixed-point iterations */
  maxIterations: number;
}

/**
 * Default options for each optimization level
 */
export const DEFAULT_OPTIONS: Record<OptimizationLevel, AsmOptimizerOptions> = {
  [OptimizationLevel.O0]: {
    level: OptimizationLevel.O0,
    debug: false,
    zpSlots: [],
    maxIterations: 1,
  },
  [OptimizationLevel.O1]: {
    level: OptimizationLevel.O1,
    debug: false,
    zpSlots: [],
    maxIterations: 1,
  },
  [OptimizationLevel.O2]: {
    level: OptimizationLevel.O2,
    debug: false,
    zpSlots: [],
    maxIterations: 1,
  },
  [OptimizationLevel.O3]: {
    level: OptimizationLevel.O3,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57],
    maxIterations: 5,
  },
  [OptimizationLevel.Os]: {
    level: OptimizationLevel.Os,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53],
    maxIterations: 1,
  },
  [OptimizationLevel.Oz]: {
    level: OptimizationLevel.Oz,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53],
    maxIterations: 5,
  },
};
```

### Pass Factory Function

```typescript
import { FlagPatternsPass } from './passes/flag-patterns.js';
import { StoreLoadPass } from './passes/store-load.js';
import { BranchOptPass } from './passes/branch-opt.js';
import { TransferOptPass } from './passes/transfer-opt.js';
import { ZPPromotionPass } from './passes/zp-promotion.js';
import { Strength6502Pass } from './passes/strength-6502.js';
import { StackOptPass } from './passes/stack-opt.js';
import { SizeOptPass } from './passes/size-opt.js';

/**
 * Creates the appropriate passes for an optimization level
 * 
 * @param options - Optimizer options
 * @returns Array of optimization passes
 */
export function createPassesForLevel(
  options: AsmOptimizerOptions
): AsmOptimizationPass[] {
  const passes: AsmOptimizationPass[] = [];
  const level = options.level;

  // O0: No optimization
  if (level === OptimizationLevel.O0) {
    return [];
  }

  // O1+: Basic patterns
  passes.push(new FlagPatternsPass());
  passes.push(new StoreLoadPass());

  // O2+: Standard patterns
  if (level !== OptimizationLevel.O1) {
    passes.push(new BranchOptPass());
    passes.push(new TransferOptPass());
  }

  // O3: Aggressive optimization
  if (level === OptimizationLevel.O3) {
    passes.push(new ZPPromotionPass(options.zpSlots));
    passes.push(new Strength6502Pass());
    passes.push(new StackOptPass());
  }

  // Os/Oz: Size optimization
  if (level === OptimizationLevel.Os || level === OptimizationLevel.Oz) {
    passes.push(new ZPPromotionPass(options.zpSlots));
    passes.push(new StackOptPass());
    passes.push(new SizeOptPass(level === OptimizationLevel.Oz));
  }

  return passes;
}
```

### Main Optimizer Class

```typescript
/**
 * ASM-IL Optimizer for compiler-v2
 * 
 * Extends the base optimizer with:
 * - Optimization level support
 * - Automatic pass selection
 * - Analysis utilities
 */
export class AsmILOptimizer {
  protected readonly options: AsmOptimizerOptions;
  protected readonly optimizer: AsmOptimizer;

  constructor(options: Partial<AsmOptimizerOptions> = {}) {
    // Merge with defaults for the specified level
    const level = options.level ?? OptimizationLevel.O2;
    this.options = {
      ...DEFAULT_OPTIONS[level],
      ...options,
    };

    // Create passes for the level
    const passes = createPassesForLevel(this.options);

    // Configure the underlying optimizer
    this.optimizer = createAsmOptimizer({
      enabled: this.options.level !== OptimizationLevel.O0,
      passes,
      maxIterations: this.options.maxIterations,
      debug: this.options.debug,
    });
  }

  /**
   * Optimize an ASM module
   * 
   * @param module - The module to optimize
   * @returns Optimized module and statistics
   */
  optimize(module: AsmModule): AsmOptimizationResult {
    return this.optimizer.optimize(module);
  }

  /**
   * Get the configured optimization level
   */
  getLevel(): OptimizationLevel {
    return this.options.level;
  }

  /**
   * Get the list of enabled passes
   */
  getPasses(): readonly AsmOptimizationPass[] {
    return this.optimizer.config.passes;
  }
}

/**
 * Factory function for creating optimizer
 */
export function createAsmILOptimizer(
  level: OptimizationLevel = OptimizationLevel.O2,
  options: Partial<AsmOptimizerOptions> = {}
): AsmILOptimizer {
  return new AsmILOptimizer({ level, ...options });
}
```

## Analysis Utilities

### Flag State Analyzer

```typescript
/**
 * Tracks CPU flag state through instruction sequence
 */
export interface FlagState {
  /** Carry flag: true=set, false=clear, undefined=unknown */
  carry?: boolean;
  /** Zero flag: true=set, false=clear, undefined=unknown */
  zero?: boolean;
  /** Negative flag: true=set, false=clear, undefined=unknown */
  negative?: boolean;
  /** Overflow flag: true=set, false=clear, undefined=unknown */
  overflow?: boolean;
}

/**
 * Analyzes flag state across instructions
 */
export class FlagStateAnalyzer {
  /**
   * Get flag state after an instruction
   * 
   * @param instr - The instruction
   * @param stateBefore - Flag state before instruction
   * @returns Flag state after instruction
   */
  analyze(instr: AsmInstruction, stateBefore: FlagState): FlagState {
    // Clone the state
    const state: FlagState = { ...stateBefore };

    switch (instr.mnemonic) {
      // Flag set/clear instructions
      case 'CLC': state.carry = false; break;
      case 'SEC': state.carry = true; break;
      case 'CLV': state.overflow = false; break;
      
      // Instructions that set Z, N
      case 'LDA': case 'LDX': case 'LDY':
      case 'AND': case 'ORA': case 'EOR':
      case 'INC': case 'INX': case 'INY':
      case 'DEC': case 'DEX': case 'DEY':
      case 'TAX': case 'TAY': case 'TXA': case 'TYA':
      case 'TSX': case 'PLA':
        state.zero = undefined;
        state.negative = undefined;
        break;
      
      // Instructions that set C, Z, N
      case 'ADC': case 'SBC':
      case 'CMP': case 'CPX': case 'CPY':
      case 'ASL': case 'LSR': case 'ROL': case 'ROR':
        state.carry = undefined;
        state.zero = undefined;
        state.negative = undefined;
        break;
      
      // BIT sets Z, N, V
      case 'BIT':
        state.zero = undefined;
        state.negative = undefined;
        state.overflow = undefined;
        break;
    }

    return state;
  }

  /**
   * Check if a flag is read by an instruction
   */
  isCarryRead(instr: AsmInstruction): boolean {
    return ['ADC', 'SBC', 'ROL', 'ROR', 'BCC', 'BCS'].includes(instr.mnemonic);
  }

  isZeroRead(instr: AsmInstruction): boolean {
    return ['BEQ', 'BNE'].includes(instr.mnemonic);
  }

  isNegativeRead(instr: AsmInstruction): boolean {
    return ['BMI', 'BPL'].includes(instr.mnemonic);
  }

  isOverflowRead(instr: AsmInstruction): boolean {
    return ['BVC', 'BVS'].includes(instr.mnemonic);
  }
}
```

### Register Tracker

```typescript
/**
 * Tracks register contents through instruction sequence
 */
export interface RegisterState {
  /** A register: known value or undefined */
  a?: number | string;
  /** X register: known value or undefined */
  x?: number | string;
  /** Y register: known value or undefined */
  y?: number | string;
}

/**
 * Tracks what values are in A, X, Y registers
 */
export class RegisterTracker {
  /**
   * Update register state after an instruction
   */
  update(instr: AsmInstruction, state: RegisterState): RegisterState {
    const newState = { ...state };

    switch (instr.mnemonic) {
      // Loads - set register to operand
      case 'LDA':
        newState.a = instr.mode === AddressingMode.Immediate 
          ? instr.operand as number 
          : undefined;
        break;
      case 'LDX':
        newState.x = instr.mode === AddressingMode.Immediate 
          ? instr.operand as number 
          : undefined;
        break;
      case 'LDY':
        newState.y = instr.mode === AddressingMode.Immediate 
          ? instr.operand as number 
          : undefined;
        break;

      // Transfers - copy between registers
      case 'TAX': newState.x = state.a; break;
      case 'TAY': newState.y = state.a; break;
      case 'TXA': newState.a = state.x; break;
      case 'TYA': newState.a = state.y; break;

      // Stack operations
      case 'PLA': newState.a = undefined; break;
      case 'TSX': newState.x = undefined; break;

      // Arithmetic - result unknown
      case 'ADC': case 'SBC':
      case 'AND': case 'ORA': case 'EOR':
      case 'ASL': case 'LSR': case 'ROL': case 'ROR':
        if (instr.mode === AddressingMode.Accumulator) {
          newState.a = undefined;
        }
        break;

      // Increments/decrements
      case 'INX': case 'DEX':
        newState.x = undefined;
        break;
      case 'INY': case 'DEY':
        newState.y = undefined;
        break;
    }

    return newState;
  }
}
```

### Address Analyzer

```typescript
/**
 * Analyzes memory addresses for aliasing
 */
export class AddressAnalyzer {
  /**
   * Check if two addresses could alias
   */
  couldAlias(addr1: number | string, addr2: number | string): boolean {
    // Different types = no alias
    if (typeof addr1 !== typeof addr2) return false;
    
    // Same address = definite alias
    if (addr1 === addr2) return true;
    
    // Labels could alias if we don't know their addresses
    if (typeof addr1 === 'string' || typeof addr2 === 'string') {
      return true; // Conservative
    }
    
    return false;
  }

  /**
   * Check if an instruction could modify a given address
   */
  couldModify(instr: AsmInstruction, addr: number | string): boolean {
    // Store instructions modify memory
    if (!['STA', 'STX', 'STY', 'INC', 'DEC', 'ASL', 'LSR', 'ROL', 'ROR'].includes(instr.mnemonic)) {
      return false;
    }

    // Check if operand could alias
    if (instr.operand === undefined) return false;
    return this.couldAlias(instr.operand, addr);
  }
}
```

## Integration Points

### Pipeline Integration

```typescript
// In compilation pipeline
async function compile(source: string, options: CompilerOptions): Promise<CompilationResult> {
  // ... parse, semantic, IL generation ...
  
  // Stage 1: IL Optimization
  const ilOptimizer = createILOptimizer(options.optimizationLevel);
  const optimizedIL = ilOptimizer.optimize(ilModule);
  
  // Code generation
  const codeGen = new CodeGenerator();
  const asmModule = codeGen.generate(optimizedIL.module);
  
  // Stage 2: ASM-IL Optimization
  const asmOptimizer = createAsmILOptimizer(options.optimizationLevel);
  const optimizedAsm = asmOptimizer.optimize(asmModule);
  
  // Emit
  const emitter = new AcmeEmitter();
  const output = emitter.emit(optimizedAsm.module);
  
  return { output, stats: { ilStats: optimizedIL.passStats, asmStats: optimizedAsm.passStats } };
}
```

## Directory Structure

```
packages/compiler-v2/src/asm-il/
├── types.ts                    # ASM-IL types (migrated)
├── index.ts                    # Exports
├── optimizer/
│   ├── types.ts                # Optimizer types
│   ├── options.ts              # OptimizationLevel, options
│   ├── base-optimizer.ts       # Base class
│   ├── asm-optimizer.ts        # Pass manager
│   ├── asm-il-optimizer.ts     # Main v2 optimizer
│   ├── index.ts                # Optimizer exports
│   ├── analysis/
│   │   ├── flag-state.ts       # Flag state analyzer
│   │   ├── register-tracker.ts # Register tracker
│   │   ├── address-analyzer.ts # Address aliasing
│   │   └── index.ts            # Analysis exports
│   └── passes/
│       ├── flag-patterns.ts    # CLC/SEC/CMP
│       ├── store-load.ts       # STA/LDA
│       ├── branch-opt.ts       # Branch chains
│       ├── transfer-opt.ts     # TAX/TXA
│       ├── zp-promotion.ts     # Zero-page
│       ├── strength-6502.ts    # 6502 strength
│       ├── stack-opt.ts        # PHA/PLA
│       ├── size-opt.ts         # Size optimization
│       └── index.ts            # Pass exports
```

## Testing Requirements

### Unit Tests

- `options.test.ts` - Optimization level configuration
- `pass-factory.test.ts` - Pass creation for each level
- `flag-state.test.ts` - Flag analyzer correctness
- `register-tracker.test.ts` - Register tracking
- `address-analyzer.test.ts` - Alias detection

### Integration Tests

- `asm-il-optimizer.test.ts` - Full optimizer flow
- `level-comparison.test.ts` - Output differs by level