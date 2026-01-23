# 11-01a2: Unit Test Helper Utilities

> **Document ID**: 11-01a2-unit-helpers
> **Phase**: 11 - Testing Framework
> **Task**: 11.1a2 - Unit test helper utilities
> **Priority**: Critical
> **Estimated LOC**: 350-450

---

## Overview

This document specifies helper utilities for unit testing the Blend65 optimizer. These utilities provide convenient methods for creating test data, manipulating IL programs, and performing common test operations.

### Goals

1. Simplify IL program construction for tests
2. Provide 6502-specific test helpers
3. Enable easy comparison of optimization results
4. Support cycle-accurate timing verification
5. Facilitate snapshot testing

---

## Type Definitions

```typescript
/**
 * Helper for creating 6502-specific test instructions
 */
interface M6502TestHelper {
  /** Create LDA instruction variants */
  lda(mode: AddressingMode, operand: number | string): Asm6502Instruction;
  /** Create STA instruction variants */
  sta(mode: AddressingMode, operand: number | string): Asm6502Instruction;
  /** Create arithmetic instruction */
  arithmetic(op: 'ADC' | 'SBC', mode: AddressingMode, operand: number | string): Asm6502Instruction;
  /** Create logical instruction */
  logical(op: 'AND' | 'ORA' | 'EOR', mode: AddressingMode, operand: number | string): Asm6502Instruction;
  /** Create branch instruction */
  branch(op: BranchOpcode, target: string): Asm6502Instruction;
  /** Create transfer instruction */
  transfer(op: TransferOpcode): Asm6502Instruction;
  /** Create flag instruction */
  flag(op: FlagOpcode): Asm6502Instruction;
}

/**
 * Addressing modes for 6502
 */
type AddressingMode = 
  | 'immediate'      // #$XX
  | 'zeropage'       // $XX
  | 'zeropage_x'     // $XX,X
  | 'zeropage_y'     // $XX,Y
  | 'absolute'       // $XXXX
  | 'absolute_x'     // $XXXX,X
  | 'absolute_y'     // $XXXX,Y
  | 'indirect'       // ($XXXX)
  | 'indirect_x'     // ($XX,X)
  | 'indirect_y'     // ($XX),Y
  | 'accumulator'    // A
  | 'implied';       // (no operand)

/**
 * Branch opcodes
 */
type BranchOpcode = 'BEQ' | 'BNE' | 'BCS' | 'BCC' | 'BMI' | 'BPL' | 'BVS' | 'BVC';

/**
 * Transfer opcodes
 */
type TransferOpcode = 'TAX' | 'TXA' | 'TAY' | 'TYA' | 'TXS' | 'TSX';

/**
 * Flag opcodes
 */
type FlagOpcode = 'CLC' | 'SEC' | 'CLI' | 'SEI' | 'CLV' | 'CLD' | 'SED';

/**
 * 6502 instruction representation for tests
 */
interface Asm6502Instruction {
  opcode: string;
  mode: AddressingMode;
  operand?: number | string;
  cycles: number;
  bytes: number;
  label?: string;
}

/**
 * Comparison result for optimization testing
 */
interface OptimizationComparison {
  /** Original instruction count */
  originalCount: number;
  /** Optimized instruction count */
  optimizedCount: number;
  /** Instructions removed */
  removed: number;
  /** Instructions added */
  added: number;
  /** Cycle difference */
  cycleDiff: number;
  /** Size difference in bytes */
  sizeDiff: number;
  /** Detailed changes */
  changes: InstructionChange[];
}

/**
 * Individual instruction change
 */
interface InstructionChange {
  type: 'removed' | 'added' | 'modified';
  original?: Asm6502Instruction;
  replacement?: Asm6502Instruction;
  reason?: string;
}

/**
 * Snapshot configuration
 */
interface SnapshotConfig {
  /** Snapshot name */
  name: string;
  /** Include cycle counts */
  includeCycles: boolean;
  /** Include byte sizes */
  includeSizes: boolean;
  /** Normalize labels */
  normalizeLabels: boolean;
  /** Strip comments */
  stripComments: boolean;
}
```

---

## Implementation

### M6502 Test Helper

```typescript
/**
 * Helper for creating 6502 test instructions
 * 
 * Provides convenient methods for constructing 6502 instructions
 * with correct cycle counts and sizes for testing.
 */
export class M6502TestHelper implements M6502TestHelper {
  /**
   * Cycle count table by opcode and addressing mode
   */
  protected static readonly CYCLES: Record<string, Record<AddressingMode, number>> = {
    'LDA': { immediate: 2, zeropage: 3, zeropage_x: 4, absolute: 4, absolute_x: 4, absolute_y: 4, indirect_x: 6, indirect_y: 5 },
    'STA': { zeropage: 3, zeropage_x: 4, absolute: 4, absolute_x: 5, absolute_y: 5, indirect_x: 6, indirect_y: 6 },
    'LDX': { immediate: 2, zeropage: 3, zeropage_y: 4, absolute: 4, absolute_y: 4 },
    'STX': { zeropage: 3, zeropage_y: 4, absolute: 4 },
    'LDY': { immediate: 2, zeropage: 3, zeropage_x: 4, absolute: 4, absolute_x: 4 },
    'STY': { zeropage: 3, zeropage_x: 4, absolute: 4 },
    'ADC': { immediate: 2, zeropage: 3, zeropage_x: 4, absolute: 4, absolute_x: 4, absolute_y: 4, indirect_x: 6, indirect_y: 5 },
    'SBC': { immediate: 2, zeropage: 3, zeropage_x: 4, absolute: 4, absolute_x: 4, absolute_y: 4, indirect_x: 6, indirect_y: 5 },
    'AND': { immediate: 2, zeropage: 3, zeropage_x: 4, absolute: 4, absolute_x: 4, absolute_y: 4, indirect_x: 6, indirect_y: 5 },
    'ORA': { immediate: 2, zeropage: 3, zeropage_x: 4, absolute: 4, absolute_x: 4, absolute_y: 4, indirect_x: 6, indirect_y: 5 },
    'EOR': { immediate: 2, zeropage: 3, zeropage_x: 4, absolute: 4, absolute_x: 4, absolute_y: 4, indirect_x: 6, indirect_y: 5 },
    'INC': { zeropage: 5, zeropage_x: 6, absolute: 6, absolute_x: 7 },
    'DEC': { zeropage: 5, zeropage_x: 6, absolute: 6, absolute_x: 7 },
    'INX': { implied: 2 },
    'DEX': { implied: 2 },
    'INY': { implied: 2 },
    'DEY': { implied: 2 },
    'TAX': { implied: 2 },
    'TXA': { implied: 2 },
    'TAY': { implied: 2 },
    'TYA': { implied: 2 },
    'TXS': { implied: 2 },
    'TSX': { implied: 2 },
    'CLC': { implied: 2 },
    'SEC': { implied: 2 },
    'CLI': { implied: 2 },
    'SEI': { implied: 2 },
    'CLV': { implied: 2 },
    'CLD': { implied: 2 },
    'SED': { implied: 2 },
    'NOP': { implied: 2 },
    'JMP': { absolute: 3, indirect: 5 },
    'JSR': { absolute: 6 },
    'RTS': { implied: 6 },
    'RTI': { implied: 6 },
    'BEQ': { relative: 2 },  // +1 if taken, +1 if page cross
    'BNE': { relative: 2 },
    'BCS': { relative: 2 },
    'BCC': { relative: 2 },
    'BMI': { relative: 2 },
    'BPL': { relative: 2 },
    'BVS': { relative: 2 },
    'BVC': { relative: 2 },
    'CMP': { immediate: 2, zeropage: 3, zeropage_x: 4, absolute: 4, absolute_x: 4, absolute_y: 4, indirect_x: 6, indirect_y: 5 },
    'CPX': { immediate: 2, zeropage: 3, absolute: 4 },
    'CPY': { immediate: 2, zeropage: 3, absolute: 4 },
    'BIT': { zeropage: 3, absolute: 4 },
    'ASL': { accumulator: 2, zeropage: 5, zeropage_x: 6, absolute: 6, absolute_x: 7 },
    'LSR': { accumulator: 2, zeropage: 5, zeropage_x: 6, absolute: 6, absolute_x: 7 },
    'ROL': { accumulator: 2, zeropage: 5, zeropage_x: 6, absolute: 6, absolute_x: 7 },
    'ROR': { accumulator: 2, zeropage: 5, zeropage_x: 6, absolute: 6, absolute_x: 7 },
    'PHA': { implied: 3 },
    'PLA': { implied: 4 },
    'PHP': { implied: 3 },
    'PLP': { implied: 4 },
  };
  
  /**
   * Byte sizes by addressing mode
   */
  protected static readonly SIZES: Record<AddressingMode, number> = {
    immediate: 2,
    zeropage: 2,
    zeropage_x: 2,
    zeropage_y: 2,
    absolute: 3,
    absolute_x: 3,
    absolute_y: 3,
    indirect: 3,
    indirect_x: 2,
    indirect_y: 2,
    accumulator: 1,
    implied: 1,
    relative: 2
  };
  
  /**
   * Create LDA instruction
   */
  lda(mode: AddressingMode, operand: number | string): Asm6502Instruction {
    return this.createInstruction('LDA', mode, operand);
  }
  
  /**
   * Create STA instruction
   */
  sta(mode: AddressingMode, operand: number | string): Asm6502Instruction {
    return this.createInstruction('STA', mode, operand);
  }
  
  /**
   * Create LDX instruction
   */
  ldx(mode: AddressingMode, operand: number | string): Asm6502Instruction {
    return this.createInstruction('LDX', mode, operand);
  }
  
  /**
   * Create STX instruction
   */
  stx(mode: AddressingMode, operand: number | string): Asm6502Instruction {
    return this.createInstruction('STX', mode, operand);
  }
  
  /**
   * Create LDY instruction
   */
  ldy(mode: AddressingMode, operand: number | string): Asm6502Instruction {
    return this.createInstruction('LDY', mode, operand);
  }
  
  /**
   * Create STY instruction
   */
  sty(mode: AddressingMode, operand: number | string): Asm6502Instruction {
    return this.createInstruction('STY', mode, operand);
  }
  
  /**
   * Create arithmetic instruction
   */
  arithmetic(op: 'ADC' | 'SBC', mode: AddressingMode, operand: number | string): Asm6502Instruction {
    return this.createInstruction(op, mode, operand);
  }
  
  /**
   * Create logical instruction
   */
  logical(op: 'AND' | 'ORA' | 'EOR', mode: AddressingMode, operand: number | string): Asm6502Instruction {
    return this.createInstruction(op, mode, operand);
  }
  
  /**
   * Create branch instruction
   */
  branch(op: BranchOpcode, target: string): Asm6502Instruction {
    return {
      opcode: op,
      mode: 'relative' as AddressingMode,
      operand: target,
      cycles: 2,  // Base cycles, +1 if taken, +1 if page cross
      bytes: 2
    };
  }
  
  /**
   * Create transfer instruction
   */
  transfer(op: TransferOpcode): Asm6502Instruction {
    return {
      opcode: op,
      mode: 'implied',
      cycles: 2,
      bytes: 1
    };
  }
  
  /**
   * Create flag instruction
   */
  flag(op: FlagOpcode): Asm6502Instruction {
    return {
      opcode: op,
      mode: 'implied',
      cycles: 2,
      bytes: 1
    };
  }
  
  /**
   * Create shift instruction
   */
  shift(op: 'ASL' | 'LSR' | 'ROL' | 'ROR', mode: AddressingMode, operand?: number | string): Asm6502Instruction {
    return this.createInstruction(op, mode, operand);
  }
  
  /**
   * Create increment/decrement instruction
   */
  incDec(op: 'INC' | 'DEC' | 'INX' | 'DEX' | 'INY' | 'DEY', mode?: AddressingMode, operand?: number | string): Asm6502Instruction {
    const m = mode || 'implied';
    return this.createInstruction(op, m, operand);
  }
  
  /**
   * Create comparison instruction
   */
  compare(op: 'CMP' | 'CPX' | 'CPY', mode: AddressingMode, operand: number | string): Asm6502Instruction {
    return this.createInstruction(op, mode, operand);
  }
  
  /**
   * Create JMP instruction
   */
  jmp(mode: 'absolute' | 'indirect', target: number | string): Asm6502Instruction {
    return this.createInstruction('JMP', mode, target);
  }
  
  /**
   * Create JSR instruction
   */
  jsr(target: number | string): Asm6502Instruction {
    return this.createInstruction('JSR', 'absolute', target);
  }
  
  /**
   * Create RTS instruction
   */
  rts(): Asm6502Instruction {
    return { opcode: 'RTS', mode: 'implied', cycles: 6, bytes: 1 };
  }
  
  /**
   * Create NOP instruction
   */
  nop(): Asm6502Instruction {
    return { opcode: 'NOP', mode: 'implied', cycles: 2, bytes: 1 };
  }
  
  /**
   * Create instruction with correct cycles and bytes
   */
  protected createInstruction(opcode: string, mode: AddressingMode, operand?: number | string): Asm6502Instruction {
    const cycles = M6502TestHelper.CYCLES[opcode]?.[mode] ?? 2;
    const bytes = M6502TestHelper.SIZES[mode] ?? 1;
    
    return { opcode, mode, operand, cycles, bytes };
  }
  
  /**
   * Create instruction sequence
   */
  sequence(...instructions: Asm6502Instruction[]): Asm6502Instruction[] {
    return instructions;
  }
  
  /**
   * Calculate total cycles for instruction sequence
   */
  totalCycles(instructions: Asm6502Instruction[]): number {
    return instructions.reduce((sum, instr) => sum + instr.cycles, 0);
  }
  
  /**
   * Calculate total bytes for instruction sequence
   */
  totalBytes(instructions: Asm6502Instruction[]): number {
    return instructions.reduce((sum, instr) => sum + instr.bytes, 0);
  }
}
```

### Optimization Comparator

```typescript
/**
 * Compare optimization results
 * 
 * Provides detailed comparison between original and optimized
 * instruction sequences for verification.
 */
export class OptimizationComparator {
  protected helper: M6502TestHelper;
  
  constructor() {
    this.helper = new M6502TestHelper();
  }
  
  /**
   * Compare two instruction sequences
   */
  compare(
    original: Asm6502Instruction[],
    optimized: Asm6502Instruction[]
  ): OptimizationComparison {
    const changes = this.detectChanges(original, optimized);
    
    return {
      originalCount: original.length,
      optimizedCount: optimized.length,
      removed: original.length - optimized.length + changes.filter(c => c.type === 'added').length,
      added: changes.filter(c => c.type === 'added').length,
      cycleDiff: this.helper.totalCycles(optimized) - this.helper.totalCycles(original),
      sizeDiff: this.helper.totalBytes(optimized) - this.helper.totalBytes(original),
      changes
    };
  }
  
  /**
   * Detect individual changes between sequences
   */
  protected detectChanges(
    original: Asm6502Instruction[],
    optimized: Asm6502Instruction[]
  ): InstructionChange[] {
    const changes: InstructionChange[] = [];
    
    // Use LCS-based diff algorithm
    const lcs = this.longestCommonSubsequence(original, optimized);
    
    let origIdx = 0;
    let optIdx = 0;
    let lcsIdx = 0;
    
    while (origIdx < original.length || optIdx < optimized.length) {
      if (lcsIdx < lcs.length && 
          origIdx < original.length && 
          this.instructionsEqual(original[origIdx], lcs[lcsIdx])) {
        // Matching instruction
        origIdx++;
        optIdx++;
        lcsIdx++;
      } else if (optIdx < optimized.length && 
                 (lcsIdx >= lcs.length || !this.instructionsEqual(optimized[optIdx], lcs[lcsIdx]))) {
        // Added instruction
        changes.push({
          type: 'added',
          replacement: optimized[optIdx]
        });
        optIdx++;
      } else if (origIdx < original.length) {
        // Removed instruction
        changes.push({
          type: 'removed',
          original: original[origIdx]
        });
        origIdx++;
      }
    }
    
    return changes;
  }
  
  /**
   * Compute longest common subsequence
   */
  protected longestCommonSubsequence(
    a: Asm6502Instruction[],
    b: Asm6502Instruction[]
  ): Asm6502Instruction[] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (this.instructionsEqual(a[i - 1], b[j - 1])) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    // Backtrack to find LCS
    const result: Asm6502Instruction[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (this.instructionsEqual(a[i - 1], b[j - 1])) {
        result.unshift(a[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    
    return result;
  }
  
  /**
   * Check if two instructions are equal
   */
  protected instructionsEqual(a: Asm6502Instruction, b: Asm6502Instruction): boolean {
    return a.opcode === b.opcode && 
           a.mode === b.mode && 
           a.operand === b.operand;
  }
  
  /**
   * Assert optimization improved cycles
   */
  assertImprovesCycles(comparison: OptimizationComparison, minImprovement: number = 1): void {
    if (comparison.cycleDiff >= 0) {
      throw new Error(
        `Expected cycle improvement but got: ${comparison.cycleDiff} ` +
        `(original: ${comparison.originalCount}, optimized: ${comparison.optimizedCount})`
      );
    }
    if (-comparison.cycleDiff < minImprovement) {
      throw new Error(
        `Expected at least ${minImprovement} cycles saved but got: ${-comparison.cycleDiff}`
      );
    }
  }
  
  /**
   * Assert optimization maintains semantics (no unexpected changes)
   */
  assertPreservesSemantics(comparison: OptimizationComparison): void {
    // Check for suspicious patterns
    const suspiciousAdds = comparison.changes.filter(c => 
      c.type === 'added' && 
      ['STA', 'STX', 'STY'].includes(c.replacement?.opcode || '')
    );
    
    if (suspiciousAdds.length > 0) {
      throw new Error(
        `Optimization added store instructions which may change semantics: ` +
        suspiciousAdds.map(c => c.replacement?.opcode).join(', ')
      );
    }
  }
}
```

### Snapshot Helper

```typescript
/**
 * Snapshot helper for golden tests
 * 
 * Creates and compares snapshots of optimization results.
 */
export class SnapshotHelper {
  protected snapshotDir: string;
  
  constructor(snapshotDir: string = '__snapshots__') {
    this.snapshotDir = snapshotDir;
  }
  
  /**
   * Create snapshot from instructions
   */
  createSnapshot(
    instructions: Asm6502Instruction[],
    config: Partial<SnapshotConfig> = {}
  ): string {
    const opts: SnapshotConfig = {
      name: 'snapshot',
      includeCycles: true,
      includeSizes: true,
      normalizeLabels: true,
      stripComments: false,
      ...config
    };
    
    const lines: string[] = [];
    let labelCounter = 0;
    const labelMap = new Map<string, string>();
    
    for (const instr of instructions) {
      let line = this.formatInstruction(instr);
      
      // Normalize labels if requested
      if (opts.normalizeLabels && instr.label) {
        if (!labelMap.has(instr.label)) {
          labelMap.set(instr.label, `L${labelCounter++}`);
        }
        line = `${labelMap.get(instr.label)}: ${line}`;
      }
      
      // Add cycle/size annotations
      if (opts.includeCycles || opts.includeSizes) {
        const annotations: string[] = [];
        if (opts.includeCycles) annotations.push(`${instr.cycles}c`);
        if (opts.includeSizes) annotations.push(`${instr.bytes}b`);
        line += ` ; ${annotations.join(', ')}`;
      }
      
      lines.push(line);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Format single instruction
   */
  protected formatInstruction(instr: Asm6502Instruction): string {
    if (instr.mode === 'implied' || instr.mode === 'accumulator') {
      return instr.opcode + (instr.mode === 'accumulator' ? ' A' : '');
    }
    
    const operandStr = typeof instr.operand === 'number' 
      ? `$${instr.operand.toString(16).toUpperCase().padStart(instr.mode.includes('zeropage') ? 2 : 4, '0')}`
      : instr.operand;
    
    switch (instr.mode) {
      case 'immediate': return `${instr.opcode} #${operandStr}`;
      case 'zeropage': return `${instr.opcode} ${operandStr}`;
      case 'zeropage_x': return `${instr.opcode} ${operandStr},X`;
      case 'zeropage_y': return `${instr.opcode} ${operandStr},Y`;
      case 'absolute': return `${instr.opcode} ${operandStr}`;
      case 'absolute_x': return `${instr.opcode} ${operandStr},X`;
      case 'absolute_y': return `${instr.opcode} ${operandStr},Y`;
      case 'indirect': return `${instr.opcode} (${operandStr})`;
      case 'indirect_x': return `${instr.opcode} (${operandStr},X)`;
      case 'indirect_y': return `${instr.opcode} (${operandStr}),Y`;
      default: return `${instr.opcode} ${operandStr}`;
    }
  }
  
  /**
   * Compare snapshot against expected
   */
  compareSnapshot(actual: string, expected: string): SnapshotDiff | null {
    if (actual === expected) return null;
    
    const actualLines = actual.split('\n');
    const expectedLines = expected.split('\n');
    
    const diffs: Array<{ line: number; expected: string; actual: string }> = [];
    
    const maxLines = Math.max(actualLines.length, expectedLines.length);
    for (let i = 0; i < maxLines; i++) {
      const actualLine = actualLines[i] || '';
      const expectedLine = expectedLines[i] || '';
      if (actualLine !== expectedLine) {
        diffs.push({ line: i + 1, expected: expectedLine, actual: actualLine });
      }
    }
    
    return { diffs, actualLines: actualLines.length, expectedLines: expectedLines.length };
  }
}

interface SnapshotDiff {
  diffs: Array<{ line: number; expected: string; actual: string }>;
  actualLines: number;
  expectedLines: number;
}
```

---

## Usage Examples

### Creating Test Instructions

```typescript
const helper = new M6502TestHelper();

// Create individual instructions
const loadA = helper.lda('immediate', 0x42);
const storeA = helper.sta('zeropage', 0x10);
const addWithCarry = helper.arithmetic('ADC', 'zeropage', 0x20);

// Create instruction sequence
const sequence = helper.sequence(
  helper.flag('CLC'),
  helper.lda('zeropage', 0x10),
  helper.arithmetic('ADC', 'immediate', 1),
  helper.sta('zeropage', 0x10)
);

// Calculate totals
console.log(`Cycles: ${helper.totalCycles(sequence)}`);  // 11 cycles
console.log(`Bytes: ${helper.totalBytes(sequence)}`);    // 7 bytes
```

### Comparing Optimizations

```typescript
const comparator = new OptimizationComparator();

const original = [
  helper.lda('zeropage', 0x10),
  helper.sta('zeropage', 0x20),
  helper.lda('zeropage', 0x10),  // Redundant reload
];

const optimized = [
  helper.lda('zeropage', 0x10),
  helper.sta('zeropage', 0x20),
  // LDA removed - value still in A
];

const result = comparator.compare(original, optimized);
comparator.assertImprovesCycles(result, 3);  // Saves 3 cycles
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| helper-lda-modes | All LDA addressing modes | ⏳ |
| helper-arithmetic | ADC/SBC instructions | ⏳ |
| helper-branches | Branch instructions | ⏳ |
| helper-cycle-counts | Correct cycle counts | ⏳ |
| comparator-basic | Basic comparison | ⏳ |
| comparator-changes | Detect changes | ⏳ |
| snapshot-create | Create snapshots | ⏳ |
| snapshot-compare | Compare snapshots | ⏳ |

---

## Task Checklist

- [ ] 11.1a2.1: Implement `M6502TestHelper` class
- [ ] 11.1a2.2: Add all instruction factory methods
- [ ] 11.1a2.3: Implement cycle/byte count tables
- [ ] 11.1a2.4: Implement `OptimizationComparator`
- [ ] 11.1a2.5: Implement `SnapshotHelper`
- [ ] 11.1a2.6: Write unit tests for all helpers

---

## References

- **Related Documents**:
  - `11-01a1-unit-runner.md` - Unit test runner infrastructure
  - `11-01b-unit-assertions.md` - Unit test assertions library
  - `07-6502-specific.md` - 6502 instruction reference