# 11-01b: Unit Test Assertions Library

> **Document ID**: 11-01b-unit-assertions
> **Phase**: 11 - Testing Framework
> **Task**: 11.1b - Unit test assertions library
> **Priority**: Critical
> **Estimated LOC**: 400-500

---

## Overview

This document specifies the assertions library for optimizer unit tests. The library provides specialized assertions for verifying IL programs, 6502 code, optimization results, and cycle counts.

### Goals

1. IL-specific assertions for program structure
2. 6502-specific assertions for instruction verification
3. Cycle and size assertions for optimization verification
4. Clear, descriptive failure messages
5. Chainable assertion API

---

## Type Definitions

```typescript
/**
 * Main assertions class for optimizer testing
 */
interface OptimizerAssertions {
  /** Assert IL program properties */
  il: ILAssertions;
  /** Assert 6502 code properties */
  asm: AsmAssertions;
  /** Assert optimization metrics */
  metrics: MetricsAssertions;
  /** Assert CFG structure */
  cfg: CFGAssertions;
}

/**
 * IL-specific assertions
 */
interface ILAssertions {
  /** Assert instruction count */
  instructionCount(program: ILProgram, expected: number): void;
  /** Assert block count */
  blockCount(program: ILProgram, expected: number): void;
  /** Assert instruction exists */
  hasInstruction(program: ILProgram, opcode: ILOpcode): void;
  /** Assert instruction doesn't exist */
  noInstruction(program: ILProgram, opcode: ILOpcode): void;
  /** Assert instruction in specific block */
  instructionInBlock(program: ILProgram, blockLabel: string, opcode: ILOpcode): void;
  /** Assert SSA form validity */
  isValidSSA(program: ILProgram): void;
  /** Assert phi node count */
  phiNodeCount(program: ILProgram, expected: number): void;
  /** Assert variable definition */
  hasDefinition(program: ILProgram, varName: string): void;
  /** Assert variable usage */
  hasUse(program: ILProgram, varName: string): void;
}

/**
 * 6502 assembly assertions
 */
interface AsmAssertions {
  /** Assert instruction sequence contains opcode */
  hasOpcode(instructions: Asm6502Instruction[], opcode: string): void;
  /** Assert instruction sequence doesn't contain opcode */
  noOpcode(instructions: Asm6502Instruction[], opcode: string): void;
  /** Assert exact sequence */
  exactSequence(actual: Asm6502Instruction[], expected: Asm6502Instruction[]): void;
  /** Assert instructions are semantically equivalent */
  semanticallyEqual(a: Asm6502Instruction[], b: Asm6502Instruction[]): void;
  /** Assert addressing mode used */
  usesAddressingMode(instructions: Asm6502Instruction[], mode: AddressingMode): void;
  /** Assert zero page usage */
  usesZeroPage(instructions: Asm6502Instruction[]): void;
}

/**
 * Optimization metrics assertions
 */
interface MetricsAssertions {
  /** Assert cycles saved */
  cyclesSaved(before: number, after: number, minSaved: number): void;
  /** Assert cycles not increased */
  cyclesNotIncreased(before: number, after: number): void;
  /** Assert size reduced */
  sizeReduced(before: number, after: number): void;
  /** Assert optimization ratio */
  optimizationRatio(before: number, after: number, minRatio: number): void;
}

/**
 * CFG structure assertions
 */
interface CFGAssertions {
  /** Assert block exists */
  hasBlock(program: ILProgram, label: string): void;
  /** Assert edge exists */
  hasEdge(program: ILProgram, from: string, to: string): void;
  /** Assert dominator relationship */
  dominates(program: ILProgram, dominator: string, dominated: string): void;
  /** Assert back edge exists (for loops) */
  hasBackEdge(program: ILProgram, from: string, to: string): void;
  /** Assert reachable from entry */
  isReachable(program: ILProgram, blockLabel: string): void;
}

/**
 * Assertion failure with context
 */
interface AssertionError {
  message: string;
  expected?: unknown;
  actual?: unknown;
  context?: Record<string, unknown>;
}
```

---

## Implementation

### Optimizer Assertions

```typescript
import { expect } from 'vitest';

/**
 * Comprehensive assertions for optimizer testing
 * 
 * Provides specialized assertions for IL programs, 6502 code,
 * and optimization metrics with detailed failure messages.
 */
export class OptimizerAssertions {
  public readonly il: ILAssertions;
  public readonly asm: AsmAssertions;
  public readonly metrics: MetricsAssertions;
  public readonly cfg: CFGAssertions;
  
  constructor() {
    this.il = new ILAssertionsImpl();
    this.asm = new AsmAssertionsImpl();
    this.metrics = new MetricsAssertionsImpl();
    this.cfg = new CFGAssertionsImpl();
  }
}

/**
 * IL program assertions implementation
 */
class ILAssertionsImpl implements ILAssertions {
  /**
   * Assert total instruction count
   */
  instructionCount(program: ILProgram, expected: number): void {
    const actual = this.countInstructions(program);
    if (actual !== expected) {
      throw this.createError(
        `Expected ${expected} instructions but found ${actual}`,
        expected,
        actual,
        { blocks: program.blocks.map(b => ({ label: b.label, count: b.instructions.length })) }
      );
    }
  }
  
  /**
   * Assert block count
   */
  blockCount(program: ILProgram, expected: number): void {
    const actual = program.blocks.length;
    if (actual !== expected) {
      throw this.createError(
        `Expected ${expected} blocks but found ${actual}`,
        expected,
        actual,
        { blockLabels: program.blocks.map(b => b.label) }
      );
    }
  }
  
  /**
   * Assert instruction exists anywhere in program
   */
  hasInstruction(program: ILProgram, opcode: ILOpcode): void {
    const found = program.blocks.some(block =>
      block.instructions.some(instr => instr.opcode === opcode)
    );
    
    if (!found) {
      throw this.createError(
        `Expected to find instruction ${opcode} but it was not present`,
        opcode,
        null,
        { opcodes: this.collectOpcodes(program) }
      );
    }
  }
  
  /**
   * Assert instruction doesn't exist
   */
  noInstruction(program: ILProgram, opcode: ILOpcode): void {
    const locations: string[] = [];
    
    for (const block of program.blocks) {
      for (let i = 0; i < block.instructions.length; i++) {
        if (block.instructions[i].opcode === opcode) {
          locations.push(`${block.label}[${i}]`);
        }
      }
    }
    
    if (locations.length > 0) {
      throw this.createError(
        `Expected no ${opcode} instructions but found ${locations.length}`,
        0,
        locations.length,
        { locations }
      );
    }
  }
  
  /**
   * Assert instruction exists in specific block
   */
  instructionInBlock(program: ILProgram, blockLabel: string, opcode: ILOpcode): void {
    const block = program.blocks.find(b => b.label === blockLabel);
    
    if (!block) {
      throw this.createError(
        `Block '${blockLabel}' not found`,
        blockLabel,
        null,
        { availableBlocks: program.blocks.map(b => b.label) }
      );
    }
    
    const found = block.instructions.some(instr => instr.opcode === opcode);
    
    if (!found) {
      throw this.createError(
        `Expected ${opcode} in block '${blockLabel}' but not found`,
        opcode,
        null,
        { blockOpcodes: block.instructions.map(i => i.opcode) }
      );
    }
  }
  
  /**
   * Assert valid SSA form
   */
  isValidSSA(program: ILProgram): void {
    const definitions = new Map<string, string>();
    const errors: string[] = [];
    
    // Check single definition per variable
    for (const block of program.blocks) {
      for (const instr of block.instructions) {
        if (instr.dest) {
          if (definitions.has(instr.dest)) {
            errors.push(
              `Variable '${instr.dest}' defined in both ` +
              `'${definitions.get(instr.dest)}' and '${block.label}'`
            );
          }
          definitions.set(instr.dest, block.label);
        }
      }
    }
    
    // Check uses have reaching definitions
    for (const block of program.blocks) {
      for (const instr of block.instructions) {
        if (instr.opcode !== ILOpcode.PHI) {
          for (const operand of instr.operands || []) {
            if (typeof operand === 'string' && /^[a-z]/i.test(operand)) {
              if (!definitions.has(operand) && !this.isParameter(operand)) {
                errors.push(`Use of undefined variable '${operand}' in '${block.label}'`);
              }
            }
          }
        }
      }
    }
    
    if (errors.length > 0) {
      throw this.createError(
        `Invalid SSA form: ${errors.length} violations`,
        'valid SSA',
        'invalid SSA',
        { violations: errors }
      );
    }
  }
  
  /**
   * Assert phi node count
   */
  phiNodeCount(program: ILProgram, expected: number): void {
    let actual = 0;
    for (const block of program.blocks) {
      for (const instr of block.instructions) {
        if (instr.opcode === ILOpcode.PHI) {
          actual++;
        }
      }
    }
    
    if (actual !== expected) {
      throw this.createError(
        `Expected ${expected} phi nodes but found ${actual}`,
        expected,
        actual
      );
    }
  }
  
  /**
   * Assert variable has definition
   */
  hasDefinition(program: ILProgram, varName: string): void {
    for (const block of program.blocks) {
      for (const instr of block.instructions) {
        if (instr.dest === varName) {
          return; // Found
        }
      }
    }
    
    throw this.createError(
      `Variable '${varName}' has no definition`,
      varName,
      null,
      { definitions: this.collectDefinitions(program) }
    );
  }
  
  /**
   * Assert variable is used somewhere
   */
  hasUse(program: ILProgram, varName: string): void {
    for (const block of program.blocks) {
      for (const instr of block.instructions) {
        if (instr.operands?.includes(varName)) {
          return; // Found
        }
      }
      // Check terminator
      if (block.terminator?.condition === varName || 
          block.terminator?.value === varName) {
        return;
      }
    }
    
    throw this.createError(
      `Variable '${varName}' is never used`,
      varName,
      null
    );
  }
  
  /**
   * Count total instructions
   */
  protected countInstructions(program: ILProgram): number {
    return program.blocks.reduce((sum, block) => sum + block.instructions.length, 0);
  }
  
  /**
   * Collect all opcodes in program
   */
  protected collectOpcodes(program: ILProgram): ILOpcode[] {
    const opcodes = new Set<ILOpcode>();
    for (const block of program.blocks) {
      for (const instr of block.instructions) {
        opcodes.add(instr.opcode);
      }
    }
    return [...opcodes];
  }
  
  /**
   * Collect all definitions
   */
  protected collectDefinitions(program: ILProgram): string[] {
    const defs: string[] = [];
    for (const block of program.blocks) {
      for (const instr of block.instructions) {
        if (instr.dest) {
          defs.push(instr.dest);
        }
      }
    }
    return defs;
  }
  
  /**
   * Check if operand is a parameter (not requiring definition)
   */
  protected isParameter(name: string): boolean {
    // Parameters typically start with specific patterns
    return name.startsWith('param') || name.startsWith('arg');
  }
  
  /**
   * Create assertion error with context
   */
  protected createError(
    message: string,
    expected: unknown,
    actual: unknown,
    context?: Record<string, unknown>
  ): Error {
    const err = new Error(message);
    (err as any).expected = expected;
    (err as any).actual = actual;
    (err as any).context = context;
    return err;
  }
}

/**
 * 6502 assembly assertions implementation
 */
class AsmAssertionsImpl implements AsmAssertions {
  /**
   * Assert opcode exists in sequence
   */
  hasOpcode(instructions: Asm6502Instruction[], opcode: string): void {
    const found = instructions.some(i => i.opcode === opcode);
    if (!found) {
      throw new Error(
        `Expected to find opcode '${opcode}' but it was not present. ` +
        `Available: ${[...new Set(instructions.map(i => i.opcode))].join(', ')}`
      );
    }
  }
  
  /**
   * Assert opcode doesn't exist in sequence
   */
  noOpcode(instructions: Asm6502Instruction[], opcode: string): void {
    const index = instructions.findIndex(i => i.opcode === opcode);
    if (index !== -1) {
      throw new Error(
        `Expected no '${opcode}' but found at index ${index}`
      );
    }
  }
  
  /**
   * Assert exact instruction sequence
   */
  exactSequence(actual: Asm6502Instruction[], expected: Asm6502Instruction[]): void {
    if (actual.length !== expected.length) {
      throw new Error(
        `Sequence length mismatch: expected ${expected.length}, got ${actual.length}`
      );
    }
    
    for (let i = 0; i < expected.length; i++) {
      if (!this.instructionsEqual(actual[i], expected[i])) {
        throw new Error(
          `Instruction mismatch at index ${i}:\n` +
          `  Expected: ${this.formatInstruction(expected[i])}\n` +
          `  Actual:   ${this.formatInstruction(actual[i])}`
        );
      }
    }
  }
  
  /**
   * Assert semantic equivalence (same effect, possibly different instructions)
   */
  semanticallyEqual(a: Asm6502Instruction[], b: Asm6502Instruction[]): void {
    // This is a simplified check - in reality, semantic equivalence
    // requires simulation or formal verification
    const aEffects = this.computeEffects(a);
    const bEffects = this.computeEffects(b);
    
    if (!this.effectsEqual(aEffects, bEffects)) {
      throw new Error(
        `Sequences are not semantically equivalent:\n` +
        `  A effects: ${JSON.stringify(aEffects)}\n` +
        `  B effects: ${JSON.stringify(bEffects)}`
      );
    }
  }
  
  /**
   * Assert addressing mode is used
   */
  usesAddressingMode(instructions: Asm6502Instruction[], mode: AddressingMode): void {
    const found = instructions.some(i => i.mode === mode);
    if (!found) {
      throw new Error(
        `Expected addressing mode '${mode}' but not found. ` +
        `Used modes: ${[...new Set(instructions.map(i => i.mode))].join(', ')}`
      );
    }
  }
  
  /**
   * Assert zero page is used
   */
  usesZeroPage(instructions: Asm6502Instruction[]): void {
    const zpModes: AddressingMode[] = ['zeropage', 'zeropage_x', 'zeropage_y'];
    const found = instructions.some(i => zpModes.includes(i.mode));
    if (!found) {
      throw new Error('Expected zero page addressing but not found');
    }
  }
  
  /**
   * Check instruction equality
   */
  protected instructionsEqual(a: Asm6502Instruction, b: Asm6502Instruction): boolean {
    return a.opcode === b.opcode && a.mode === b.mode && a.operand === b.operand;
  }
  
  /**
   * Format instruction for error message
   */
  protected formatInstruction(instr: Asm6502Instruction): string {
    return `${instr.opcode} ${instr.mode} ${instr.operand ?? ''}`.trim();
  }
  
  /**
   * Compute abstract effects of instruction sequence
   */
  protected computeEffects(instructions: Asm6502Instruction[]): Record<string, unknown> {
    // Simplified effect computation
    const stores: Array<{ addr: number | string; source: string }> = [];
    
    for (const instr of instructions) {
      if (['STA', 'STX', 'STY'].includes(instr.opcode) && instr.operand !== undefined) {
        stores.push({ addr: instr.operand, source: instr.opcode[2] });
      }
    }
    
    return { stores };
  }
  
  /**
   * Check if effects are equal
   */
  protected effectsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}

/**
 * Metrics assertions implementation
 */
class MetricsAssertionsImpl implements MetricsAssertions {
  /**
   * Assert minimum cycles saved
   */
  cyclesSaved(before: number, after: number, minSaved: number): void {
    const saved = before - after;
    if (saved < minSaved) {
      throw new Error(
        `Expected at least ${minSaved} cycles saved but got ${saved} ` +
        `(before: ${before}, after: ${after})`
      );
    }
  }
  
  /**
   * Assert cycles didn't increase
   */
  cyclesNotIncreased(before: number, after: number): void {
    if (after > before) {
      throw new Error(
        `Cycles increased from ${before} to ${after} (diff: +${after - before})`
      );
    }
  }
  
  /**
   * Assert size was reduced
   */
  sizeReduced(before: number, after: number): void {
    if (after >= before) {
      throw new Error(
        `Size not reduced: before=${before}, after=${after}`
      );
    }
  }
  
  /**
   * Assert optimization ratio achieved
   */
  optimizationRatio(before: number, after: number, minRatio: number): void {
    if (before === 0) {
      throw new Error('Cannot compute ratio with zero baseline');
    }
    
    const ratio = (before - after) / before;
    if (ratio < minRatio) {
      throw new Error(
        `Optimization ratio ${(ratio * 100).toFixed(1)}% is below minimum ${(minRatio * 100).toFixed(1)}%`
      );
    }
  }
}

/**
 * CFG assertions implementation
 */
class CFGAssertionsImpl implements CFGAssertions {
  /**
   * Assert block exists
   */
  hasBlock(program: ILProgram, label: string): void {
    const found = program.blocks.some(b => b.label === label);
    if (!found) {
      throw new Error(
        `Block '${label}' not found. Available: ${program.blocks.map(b => b.label).join(', ')}`
      );
    }
  }
  
  /**
   * Assert CFG edge exists
   */
  hasEdge(program: ILProgram, from: string, to: string): void {
    const fromBlock = program.blocks.find(b => b.label === from);
    if (!fromBlock) {
      throw new Error(`Source block '${from}' not found`);
    }
    
    if (!fromBlock.successors.includes(to)) {
      throw new Error(
        `Edge ${from} -> ${to} not found. ` +
        `${from} successors: ${fromBlock.successors.join(', ') || 'none'}`
      );
    }
  }
  
  /**
   * Assert dominance relationship
   */
  dominates(program: ILProgram, dominator: string, dominated: string): void {
    const dominators = this.computeDominators(program);
    const doms = dominators.get(dominated);
    
    if (!doms?.has(dominator)) {
      throw new Error(
        `'${dominator}' does not dominate '${dominated}'. ` +
        `Dominators of ${dominated}: ${doms ? [...doms].join(', ') : 'none'}`
      );
    }
  }
  
  /**
   * Assert back edge exists (indicates loop)
   */
  hasBackEdge(program: ILProgram, from: string, to: string): void {
    const dominators = this.computeDominators(program);
    const fromDoms = dominators.get(from);
    
    // Back edge: target dominates source
    if (!fromDoms?.has(to)) {
      throw new Error(
        `${from} -> ${to} is not a back edge (${to} does not dominate ${from})`
      );
    }
    
    this.hasEdge(program, from, to);
  }
  
  /**
   * Assert block is reachable from entry
   */
  isReachable(program: ILProgram, blockLabel: string): void {
    const reachable = this.computeReachable(program);
    
    if (!reachable.has(blockLabel)) {
      throw new Error(
        `Block '${blockLabel}' is not reachable from entry`
      );
    }
  }
  
  /**
   * Compute dominator sets
   */
  protected computeDominators(program: ILProgram): Map<string, Set<string>> {
    const dominators = new Map<string, Set<string>>();
    const allBlocks = new Set(program.blocks.map(b => b.label));
    
    // Initialize: entry dominated only by itself, others by all
    for (const block of program.blocks) {
      if (block.label === program.entry) {
        dominators.set(block.label, new Set([block.label]));
      } else {
        dominators.set(block.label, new Set(allBlocks));
      }
    }
    
    // Fixed-point iteration
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const block of program.blocks) {
        if (block.label === program.entry) continue;
        
        const newDoms = new Set(allBlocks);
        
        for (const pred of block.predecessors) {
          const predDoms = dominators.get(pred)!;
          for (const dom of newDoms) {
            if (!predDoms.has(dom)) {
              newDoms.delete(dom);
            }
          }
        }
        
        newDoms.add(block.label);
        
        const currentDoms = dominators.get(block.label)!;
        if (newDoms.size !== currentDoms.size) {
          dominators.set(block.label, newDoms);
          changed = true;
        }
      }
    }
    
    return dominators;
  }
  
  /**
   * Compute reachable blocks from entry
   */
  protected computeReachable(program: ILProgram): Set<string> {
    const reachable = new Set<string>();
    const worklist = [program.entry];
    
    while (worklist.length > 0) {
      const label = worklist.pop()!;
      if (reachable.has(label)) continue;
      
      reachable.add(label);
      const block = program.blocks.find(b => b.label === label);
      if (block) {
        worklist.push(...block.successors);
      }
    }
    
    return reachable;
  }
}
```

---

## Usage Examples

### IL Assertions

```typescript
const assertions = new OptimizerAssertions();

// Verify instruction removal
assertions.il.instructionCount(optimized, 5);
assertions.il.noInstruction(optimized, ILOpcode.STORE);

// Verify SSA form
assertions.il.isValidSSA(program);
assertions.il.phiNodeCount(program, 2);

// Verify variable handling
assertions.il.hasDefinition(program, 'counter');
assertions.il.hasUse(program, 'counter');
```

### Assembly Assertions

```typescript
// Verify optimization removed redundant loads
assertions.asm.noOpcode(optimized, 'LDA');

// Verify exact sequence
assertions.asm.exactSequence(result, [
  helper.flag('CLC'),
  helper.lda('zeropage', 0x10),
  helper.arithmetic('ADC', 'immediate', 1),
  helper.sta('zeropage', 0x10)
]);

// Verify zero page usage
assertions.asm.usesZeroPage(optimized);
```

### Metrics Assertions

```typescript
// Verify cycle improvement
assertions.metrics.cyclesSaved(originalCycles, optimizedCycles, 10);

// Verify no regression
assertions.metrics.cyclesNotIncreased(before, after);

// Verify optimization effectiveness
assertions.metrics.optimizationRatio(before, after, 0.15); // 15% improvement
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| il-instruction-count | Counts instructions correctly | ⏳ |
| il-has-instruction | Finds existing instructions | ⏳ |
| il-no-instruction | Detects absent instructions | ⏳ |
| il-ssa-valid | Validates SSA form | ⏳ |
| il-ssa-invalid | Detects SSA violations | ⏳ |
| asm-has-opcode | Finds opcodes | ⏳ |
| asm-exact-sequence | Matches exact sequences | ⏳ |
| metrics-cycles-saved | Verifies cycle savings | ⏳ |
| cfg-has-edge | Finds CFG edges | ⏳ |
| cfg-dominates | Verifies dominance | ⏳ |

---

## Task Checklist

- [ ] 11.1b.1: Implement `ILAssertions` class
- [ ] 11.1b.2: Implement `AsmAssertions` class
- [ ] 11.1b.3: Implement `MetricsAssertions` class
- [ ] 11.1b.4: Implement `CFGAssertions` class
- [ ] 11.1b.5: Add dominator computation
- [ ] 11.1b.6: Add reachability computation
- [ ] 11.1b.7: Write comprehensive unit tests

---

## References

- **Related Documents**:
  - `11-01a1-unit-runner.md` - Unit test runner
  - `11-01a2-unit-helpers.md` - Test helpers
  - `02-analysis-passes.md` - CFG analysis