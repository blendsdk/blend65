# Task 8.11a: Basic Instruction Cycle Counting

> **Task**: 8.11a of 12 (Peephole Phase - Cost Model)  
> **Time**: ~2 hours  
> **Tests**: ~40 tests  
> **Prerequisites**: Task 8.10 (Pattern DSL)

---

## Overview

Implement basic instruction cycle counting for all 6502 opcodes. This forms the foundation of the cost model used to evaluate whether pattern replacements improve performance. Every optimization decision ultimately depends on accurate cycle counting.

---

## Directory Structure

```
packages/compiler/src/optimizer/cost/
├── index.ts              # Exports
├── types.ts              # Cost model types
├── cycle-table.ts        # Base cycle counts (THIS TASK)
├── instruction-cost.ts   # Per-instruction costing (THIS TASK)
└── cost-calculator.ts    # Total cost computation (THIS TASK)
```

---

## Implementation

### File: `types.ts`

```typescript
/**
 * Cost breakdown for a single instruction or sequence
 */
export interface InstructionCost {
  /** Base cycle count (minimum cycles) */
  readonly baseCycles: number;
  /** Additional cycles for page crossing */
  readonly pageCrossPenalty: number;
  /** Size in bytes */
  readonly bytes: number;
  /** Whether cycles vary based on operand */
  readonly isVariable: boolean;
}

/**
 * Total cost for an instruction sequence
 */
export interface SequenceCost {
  /** Minimum cycles (best case) */
  readonly minCycles: number;
  /** Maximum cycles (worst case with page crosses) */
  readonly maxCycles: number;
  /** Average cycles (for comparison) */
  readonly avgCycles: number;
  /** Total bytes */
  readonly totalBytes: number;
  /** Number of instructions */
  readonly instructionCount: number;
}

/**
 * Cost comparison result
 */
export interface CostComparison {
  /** Cycles saved (positive = faster) */
  readonly cyclesSaved: number;
  /** Bytes saved (positive = smaller) */
  readonly bytesSaved: number;
  /** Is this a beneficial transformation? */
  readonly isBeneficial: boolean;
  /** Confidence level (0-1) */
  readonly confidence: number;
}

/**
 * Addressing mode for cycle calculation
 */
export enum AddressingMode {
  Implied = 'implied',
  Accumulator = 'accumulator',
  Immediate = 'immediate',
  ZeroPage = 'zero-page',
  ZeroPageX = 'zero-page-x',
  ZeroPageY = 'zero-page-y',
  Absolute = 'absolute',
  AbsoluteX = 'absolute-x',
  AbsoluteY = 'absolute-y',
  IndirectX = 'indirect-x',
  IndirectY = 'indirect-y',
  Relative = 'relative',
  Indirect = 'indirect',
}
```

### File: `cycle-table.ts`

```typescript
import { AddressingMode, InstructionCost } from './types.js';

/**
 * Base cycle counts for all 6502 instructions
 * 
 * Format: [baseCycles, pageCrossPenalty, bytes]
 * 
 * Page cross penalty applies when:
 * - Absolute,X or Absolute,Y crosses page boundary
 * - Indirect,Y crosses page boundary
 * - Branch instructions cross page boundary
 */
type CycleEntry = [baseCycles: number, pageCross: number, bytes: number];

/**
 * Complete 6502 instruction cycle table
 * Organized by mnemonic and addressing mode
 */
export const CYCLE_TABLE: Record<string, Partial<Record<AddressingMode, CycleEntry>>> = {
  // Load/Store Operations
  LDA: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteX]: [4, 1, 3],
    [AddressingMode.AbsoluteY]: [4, 1, 3],
    [AddressingMode.IndirectX]: [6, 0, 2],
    [AddressingMode.IndirectY]: [5, 1, 2],
  },
  LDX: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageY]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteY]: [4, 1, 3],
  },
  LDY: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteX]: [4, 1, 3],
  },
  STA: {
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteX]: [5, 0, 3], // No page cross penalty on stores
    [AddressingMode.AbsoluteY]: [5, 0, 3],
    [AddressingMode.IndirectX]: [6, 0, 2],
    [AddressingMode.IndirectY]: [6, 0, 2],
  },
  STX: {
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageY]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
  },
  STY: {
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
  },

  // Arithmetic Operations
  ADC: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteX]: [4, 1, 3],
    [AddressingMode.AbsoluteY]: [4, 1, 3],
    [AddressingMode.IndirectX]: [6, 0, 2],
    [AddressingMode.IndirectY]: [5, 1, 2],
  },
  SBC: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteX]: [4, 1, 3],
    [AddressingMode.AbsoluteY]: [4, 1, 3],
    [AddressingMode.IndirectX]: [6, 0, 2],
    [AddressingMode.IndirectY]: [5, 1, 2],
  },

  // Increment/Decrement
  INC: {
    [AddressingMode.ZeroPage]: [5, 0, 2],
    [AddressingMode.ZeroPageX]: [6, 0, 2],
    [AddressingMode.Absolute]: [6, 0, 3],
    [AddressingMode.AbsoluteX]: [7, 0, 3],
  },
  DEC: {
    [AddressingMode.ZeroPage]: [5, 0, 2],
    [AddressingMode.ZeroPageX]: [6, 0, 2],
    [AddressingMode.Absolute]: [6, 0, 3],
    [AddressingMode.AbsoluteX]: [7, 0, 3],
  },
  INX: { [AddressingMode.Implied]: [2, 0, 1] },
  DEX: { [AddressingMode.Implied]: [2, 0, 1] },
  INY: { [AddressingMode.Implied]: [2, 0, 1] },
  DEY: { [AddressingMode.Implied]: [2, 0, 1] },

  // Logical Operations
  AND: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteX]: [4, 1, 3],
    [AddressingMode.AbsoluteY]: [4, 1, 3],
    [AddressingMode.IndirectX]: [6, 0, 2],
    [AddressingMode.IndirectY]: [5, 1, 2],
  },
  ORA: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteX]: [4, 1, 3],
    [AddressingMode.AbsoluteY]: [4, 1, 3],
    [AddressingMode.IndirectX]: [6, 0, 2],
    [AddressingMode.IndirectY]: [5, 1, 2],
  },
  EOR: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteX]: [4, 1, 3],
    [AddressingMode.AbsoluteY]: [4, 1, 3],
    [AddressingMode.IndirectX]: [6, 0, 2],
    [AddressingMode.IndirectY]: [5, 1, 2],
  },

  // Shift/Rotate Operations
  ASL: {
    [AddressingMode.Accumulator]: [2, 0, 1],
    [AddressingMode.ZeroPage]: [5, 0, 2],
    [AddressingMode.ZeroPageX]: [6, 0, 2],
    [AddressingMode.Absolute]: [6, 0, 3],
    [AddressingMode.AbsoluteX]: [7, 0, 3],
  },
  LSR: {
    [AddressingMode.Accumulator]: [2, 0, 1],
    [AddressingMode.ZeroPage]: [5, 0, 2],
    [AddressingMode.ZeroPageX]: [6, 0, 2],
    [AddressingMode.Absolute]: [6, 0, 3],
    [AddressingMode.AbsoluteX]: [7, 0, 3],
  },
  ROL: {
    [AddressingMode.Accumulator]: [2, 0, 1],
    [AddressingMode.ZeroPage]: [5, 0, 2],
    [AddressingMode.ZeroPageX]: [6, 0, 2],
    [AddressingMode.Absolute]: [6, 0, 3],
    [AddressingMode.AbsoluteX]: [7, 0, 3],
  },
  ROR: {
    [AddressingMode.Accumulator]: [2, 0, 1],
    [AddressingMode.ZeroPage]: [5, 0, 2],
    [AddressingMode.ZeroPageX]: [6, 0, 2],
    [AddressingMode.Absolute]: [6, 0, 3],
    [AddressingMode.AbsoluteX]: [7, 0, 3],
  },

  // Compare Operations
  CMP: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.ZeroPageX]: [4, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
    [AddressingMode.AbsoluteX]: [4, 1, 3],
    [AddressingMode.AbsoluteY]: [4, 1, 3],
    [AddressingMode.IndirectX]: [6, 0, 2],
    [AddressingMode.IndirectY]: [5, 1, 2],
  },
  CPX: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
  },
  CPY: {
    [AddressingMode.Immediate]: [2, 0, 2],
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
  },

  // Transfer Operations
  TAX: { [AddressingMode.Implied]: [2, 0, 1] },
  TXA: { [AddressingMode.Implied]: [2, 0, 1] },
  TAY: { [AddressingMode.Implied]: [2, 0, 1] },
  TYA: { [AddressingMode.Implied]: [2, 0, 1] },
  TXS: { [AddressingMode.Implied]: [2, 0, 1] },
  TSX: { [AddressingMode.Implied]: [2, 0, 1] },

  // Stack Operations
  PHA: { [AddressingMode.Implied]: [3, 0, 1] },
  PLA: { [AddressingMode.Implied]: [4, 0, 1] },
  PHP: { [AddressingMode.Implied]: [3, 0, 1] },
  PLP: { [AddressingMode.Implied]: [4, 0, 1] },

  // Branch Operations (cycles vary if taken/page cross)
  BCC: { [AddressingMode.Relative]: [2, 1, 2] }, // +1 if taken, +1 if page cross
  BCS: { [AddressingMode.Relative]: [2, 1, 2] },
  BEQ: { [AddressingMode.Relative]: [2, 1, 2] },
  BNE: { [AddressingMode.Relative]: [2, 1, 2] },
  BMI: { [AddressingMode.Relative]: [2, 1, 2] },
  BPL: { [AddressingMode.Relative]: [2, 1, 2] },
  BVC: { [AddressingMode.Relative]: [2, 1, 2] },
  BVS: { [AddressingMode.Relative]: [2, 1, 2] },

  // Jump Operations
  JMP: {
    [AddressingMode.Absolute]: [3, 0, 3],
    [AddressingMode.Indirect]: [5, 0, 3],
  },
  JSR: { [AddressingMode.Absolute]: [6, 0, 3] },
  RTS: { [AddressingMode.Implied]: [6, 0, 1] },
  RTI: { [AddressingMode.Implied]: [6, 0, 1] },

  // Flag Operations
  CLC: { [AddressingMode.Implied]: [2, 0, 1] },
  SEC: { [AddressingMode.Implied]: [2, 0, 1] },
  CLI: { [AddressingMode.Implied]: [2, 0, 1] },
  SEI: { [AddressingMode.Implied]: [2, 0, 1] },
  CLV: { [AddressingMode.Implied]: [2, 0, 1] },
  CLD: { [AddressingMode.Implied]: [2, 0, 1] },
  SED: { [AddressingMode.Implied]: [2, 0, 1] },

  // Bit Test
  BIT: {
    [AddressingMode.ZeroPage]: [3, 0, 2],
    [AddressingMode.Absolute]: [4, 0, 3],
  },

  // No Operation
  NOP: { [AddressingMode.Implied]: [2, 0, 1] },

  // Break
  BRK: { [AddressingMode.Implied]: [7, 0, 1] }, // Actually uses 2 bytes
};

/**
 * Get cycle information for a mnemonic and addressing mode
 */
export function getCycleInfo(
  mnemonic: string,
  mode: AddressingMode
): CycleEntry | undefined {
  const upper = mnemonic.toUpperCase();
  return CYCLE_TABLE[upper]?.[mode];
}

/**
 * Check if instruction has page cross penalty
 */
export function hasPageCrossPenalty(mode: AddressingMode): boolean {
  return [
    AddressingMode.AbsoluteX,
    AddressingMode.AbsoluteY,
    AddressingMode.IndirectY,
    AddressingMode.Relative,
  ].includes(mode);
}
```

### File: `instruction-cost.ts`

```typescript
import { AddressingMode, InstructionCost } from './types.js';
import { getCycleInfo, hasPageCrossPenalty } from './cycle-table.js';

/**
 * Calculator for individual instruction costs
 */
export class InstructionCostCalculator {
  /**
   * Calculate cost for a single instruction
   */
  calculate(mnemonic: string, mode: AddressingMode): InstructionCost {
    const entry = getCycleInfo(mnemonic, mode);
    
    if (!entry) {
      throw new Error(
        `Unknown instruction: ${mnemonic} with mode ${mode}`
      );
    }
    
    const [baseCycles, pageCross, bytes] = entry;
    
    return {
      baseCycles,
      pageCrossPenalty: pageCross,
      bytes,
      isVariable: hasPageCrossPenalty(mode) || this.isBranch(mnemonic),
    };
  }
  
  /**
   * Calculate cost from IL instruction
   */
  calculateFromIL(instruction: ILInstruction): InstructionCost {
    const mnemonic = this.getMnemonic(instruction);
    const mode = this.getAddressingMode(instruction);
    return this.calculate(mnemonic, mode);
  }
  
  /**
   * Check if mnemonic is a branch instruction
   */
  protected isBranch(mnemonic: string): boolean {
    const branches = ['BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS'];
    return branches.includes(mnemonic.toUpperCase());
  }
  
  /**
   * Extract mnemonic from IL instruction
   */
  protected getMnemonic(instruction: ILInstruction): string {
    // Map IL opcode to 6502 mnemonic
    return instruction.metadata?.mnemonic || 
           this.opcodeToMnemonic(instruction.opcode);
  }
  
  /**
   * Map IL opcode to 6502 mnemonic
   */
  protected opcodeToMnemonic(opcode: ILOpcode): string {
    const mapping: Partial<Record<ILOpcode, string>> = {
      [ILOpcode.Load]: 'LDA',
      [ILOpcode.Store]: 'STA',
      [ILOpcode.Add]: 'ADC',
      [ILOpcode.Sub]: 'SBC',
      [ILOpcode.And]: 'AND',
      [ILOpcode.Or]: 'ORA',
      [ILOpcode.Xor]: 'EOR',
      [ILOpcode.ShiftLeft]: 'ASL',
      [ILOpcode.ShiftRight]: 'LSR',
      [ILOpcode.Compare]: 'CMP',
      [ILOpcode.Branch]: 'BEQ',
      [ILOpcode.Jump]: 'JMP',
      [ILOpcode.Call]: 'JSR',
      [ILOpcode.Return]: 'RTS',
    };
    
    const mnemonic = mapping[opcode];
    if (!mnemonic) {
      throw new Error(`Cannot map IL opcode ${opcode} to mnemonic`);
    }
    return mnemonic;
  }
  
  /**
   * Determine addressing mode from IL instruction
   */
  protected getAddressingMode(instruction: ILInstruction): AddressingMode {
    // Check for explicit mode in metadata
    if (instruction.metadata?.addressingMode) {
      return instruction.metadata.addressingMode as AddressingMode;
    }
    
    // Infer from operands
    const operands = instruction.operands;
    
    if (operands.length === 0) {
      return AddressingMode.Implied;
    }
    
    const first = operands[0];
    
    // Immediate value
    if (first.type === 'immediate') {
      return AddressingMode.Immediate;
    }
    
    // Memory reference
    if (first.type === 'memory') {
      const addr = first.address;
      const indexed = first.indexed;
      
      // Zero page: address < 256
      if (addr !== undefined && addr < 256) {
        if (indexed === 'x') return AddressingMode.ZeroPageX;
        if (indexed === 'y') return AddressingMode.ZeroPageY;
        return AddressingMode.ZeroPage;
      }
      
      // Absolute
      if (indexed === 'x') return AddressingMode.AbsoluteX;
      if (indexed === 'y') return AddressingMode.AbsoluteY;
      return AddressingMode.Absolute;
    }
    
    // Indirect
    if (first.type === 'indirect') {
      if (first.indexed === 'x') return AddressingMode.IndirectX;
      if (first.indexed === 'y') return AddressingMode.IndirectY;
      return AddressingMode.Indirect;
    }
    
    // Default to implied
    return AddressingMode.Implied;
  }
}

/** Singleton calculator instance */
export const instructionCost = new InstructionCostCalculator();
```

### File: `cost-calculator.ts`

```typescript
import { InstructionCost, SequenceCost, CostComparison } from './types.js';
import { instructionCost, InstructionCostCalculator } from './instruction-cost.js';

/**
 * Calculate total costs for instruction sequences
 */
export class CostCalculator {
  protected calculator: InstructionCostCalculator;
  
  constructor(calculator: InstructionCostCalculator = instructionCost) {
    this.calculator = calculator;
  }
  
  /**
   * Calculate total cost for a sequence of instructions
   */
  calculateSequence(instructions: ILInstruction[]): SequenceCost {
    let minCycles = 0;
    let maxCycles = 0;
    let totalBytes = 0;
    
    for (const inst of instructions) {
      const cost = this.calculator.calculateFromIL(inst);
      
      minCycles += cost.baseCycles;
      maxCycles += cost.baseCycles + cost.pageCrossPenalty;
      totalBytes += cost.bytes;
    }
    
    // Average assumes 50% page cross probability for variable instructions
    const avgCycles = (minCycles + maxCycles) / 2;
    
    return {
      minCycles,
      maxCycles,
      avgCycles,
      totalBytes,
      instructionCount: instructions.length,
    };
  }
  
  /**
   * Compare costs between original and replacement sequences
   */
  compare(
    original: ILInstruction[],
    replacement: ILInstruction[]
  ): CostComparison {
    const origCost = this.calculateSequence(original);
    const replCost = this.calculateSequence(replacement);
    
    const cyclesSaved = origCost.avgCycles - replCost.avgCycles;
    const bytesSaved = origCost.totalBytes - replCost.totalBytes;
    
    // Consider beneficial if:
    // 1. Saves cycles without increasing size
    // 2. Reduces size without increasing cycles
    // 3. Significantly improves one with minor degradation of other
    const isBeneficial = this.evaluateBenefit(cyclesSaved, bytesSaved);
    
    // Confidence based on how certain we are about cycle counts
    const confidence = this.calculateConfidence(original, replacement);
    
    return {
      cyclesSaved,
      bytesSaved,
      isBeneficial,
      confidence,
    };
  }
  
  /**
   * Evaluate if transformation is beneficial
   */
  protected evaluateBenefit(cyclesSaved: number, bytesSaved: number): boolean {
    // Clear win: both improve
    if (cyclesSaved > 0 && bytesSaved >= 0) return true;
    if (bytesSaved > 0 && cyclesSaved >= 0) return true;
    
    // Trade-off: significant cycle improvement worth small size increase
    if (cyclesSaved >= 2 && bytesSaved >= -1) return true;
    
    // Trade-off: significant size reduction worth small cycle increase
    if (bytesSaved >= 2 && cyclesSaved >= -1) return true;
    
    return false;
  }
  
  /**
   * Calculate confidence in the cost comparison
   */
  protected calculateConfidence(
    original: ILInstruction[],
    replacement: ILInstruction[]
  ): number {
    let variableCount = 0;
    let totalCount = original.length + replacement.length;
    
    for (const inst of [...original, ...replacement]) {
      const cost = this.calculator.calculateFromIL(inst);
      if (cost.isVariable) {
        variableCount++;
      }
    }
    
    // High confidence if few variable-cycle instructions
    if (totalCount === 0) return 1.0;
    const variableRatio = variableCount / totalCount;
    return 1.0 - (variableRatio * 0.3); // Max 30% reduction for all-variable
  }
}

/** Default cost calculator instance */
export const costCalculator = new CostCalculator();
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `cycle-table.getCycleInfo` | Return correct cycles for all mnemonics |
| `cycle-table.getCycleInfo` | Return undefined for unknown instruction |
| `cycle-table.hasPageCrossPenalty` | Identify penalty modes correctly |
| `instruction-cost.calculate` | Calculate cost for each addressing mode |
| `instruction-cost.calculateFromIL` | Extract info from IL instruction |
| `instruction-cost.isBranch` | Identify all branch mnemonics |
| `cost-calculator.calculateSequence` | Sum costs for instruction list |
| `cost-calculator.compare` | Compare original vs replacement |
| `cost-calculator.evaluateBenefit` | Correct benefit decisions |
| `cost-calculator.calculateConfidence` | Lower confidence for variable cycles |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `types.ts` | [ ] |
| Create `cycle-table.ts` | [ ] |
| Create `instruction-cost.ts` | [ ] |
| Create `cost-calculator.ts` | [ ] |
| Create `index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.11b → `08-11b-cost-memory.md`