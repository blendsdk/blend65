# 11-04a: IL Instruction Fuzzer

> **Document ID**: 11-04a-fuzzing-il
> **Phase**: 11 - Testing Framework
> **Task**: 11.4a - IL instruction fuzzer
> **Priority**: High
> **Estimated LOC**: 350-400

---

## Overview

This document specifies a fuzzing framework for IL instructions to discover edge cases, crashes, and incorrect optimizations. The fuzzer generates random but valid IL programs and runs them through the optimizer.

### Goals

1. Generate random valid IL programs
2. Detect optimizer crashes and hangs
3. Find incorrect transformations
4. Discover edge cases in patterns
5. Achieve high coverage of optimizer paths

---

## Type Definitions

```typescript
/**
 * Fuzzer configuration
 */
interface ILFuzzerConfig {
  /** Random seed for reproducibility */
  seed: number;
  /** Maximum instructions per program */
  maxInstructions: number;
  /** Maximum blocks per program */
  maxBlocks: number;
  /** Maximum variables */
  maxVariables: number;
  /** Instruction type distribution */
  distribution: InstructionDistribution;
  /** Timeout per test (ms) */
  timeout: number;
  /** Enable semantic validation */
  validateSemantics: boolean;
}

/**
 * Instruction type distribution weights
 */
interface InstructionDistribution {
  arithmetic: number;    // ADD, SUB, MUL, DIV
  bitwise: number;       // AND, OR, XOR, NOT
  compare: number;       // CMP, TEST
  load_store: number;    // LOAD, STORE
  branch: number;        // BR, BEQ, BNE, etc.
  call: number;          // CALL, RET
  move: number;          // MOV, PHI
}

/**
 * Fuzz test result
 */
interface FuzzResult {
  /** Unique test case ID */
  testId: string;
  /** Seed used */
  seed: number;
  /** Generated program */
  program: ILProgram;
  /** Outcome */
  outcome: FuzzOutcome;
  /** Error if any */
  error?: Error;
  /** Duration in ms */
  duration: number;
  /** Coverage metrics */
  coverage?: CoverageMetrics;
}

type FuzzOutcome =
  | 'pass'              // Optimization completed correctly
  | 'crash'             // Optimizer threw exception
  | 'timeout'           // Exceeded timeout
  | 'hang'              // Infinite loop detected
  | 'invalid_output'    // Output failed validation
  | 'semantic_change';  // Semantics changed incorrectly

/**
 * Coverage tracking
 */
interface CoverageMetrics {
  patternsTriggered: Set<string>;
  blocksVisited: number;
  instructionsProcessed: number;
  branchesTaken: number;
  pathsExplored: number;
}

/**
 * Minimization result
 */
interface MinimizedTestCase {
  original: ILProgram;
  minimized: ILProgram;
  reductionRatio: number;
  outcome: FuzzOutcome;
}
```

---

## Implementation

### IL Fuzzer Core

```typescript
/**
 * IL instruction fuzzer for optimizer testing
 */
export class ILFuzzer {
  protected rng: SeededRandom;
  protected config: ILFuzzerConfig;
  protected optimizer: Optimizer;
  protected validator: ILValidator;
  
  constructor(config: ILFuzzerConfig) {
    this.config = config;
    this.rng = new SeededRandom(config.seed);
    this.optimizer = new Optimizer();
    this.validator = new ILValidator();
  }
  
  /**
   * Run fuzzing campaign
   */
  async runCampaign(iterations: number): Promise<FuzzCampaignResult> {
    const results: FuzzResult[] = [];
    const failures: FuzzResult[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await this.fuzzOnce(i);
      results.push(result);
      
      if (result.outcome !== 'pass') {
        failures.push(result);
      }
    }
    
    return {
      totalTests: iterations,
      passed: results.filter(r => r.outcome === 'pass').length,
      failed: failures.length,
      failures,
      coverage: this.aggregateCoverage(results),
      duration: results.reduce((sum, r) => sum + r.duration, 0)
    };
  }
  
  /**
   * Run single fuzz test
   */
  async fuzzOnce(iteration: number): Promise<FuzzResult> {
    const testId = `fuzz_${this.config.seed}_${iteration}`;
    const program = this.generateProgram();
    const startTime = Date.now();
    
    try {
      // Run with timeout
      const optimized = await this.runWithTimeout(
        () => this.optimizer.optimize(program),
        this.config.timeout
      );
      
      // Validate output
      const validationResult = this.validateOutput(program, optimized);
      
      return {
        testId,
        seed: this.config.seed,
        program,
        outcome: validationResult.outcome,
        duration: Date.now() - startTime,
        coverage: this.collectCoverage()
      };
    } catch (error) {
      return {
        testId,
        seed: this.config.seed,
        program,
        outcome: error instanceof TimeoutError ? 'timeout' : 'crash',
        error: error as Error,
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Generate random IL program
   */
  protected generateProgram(): ILProgram {
    const numBlocks = this.rng.int(1, this.config.maxBlocks);
    const blocks: ILBlock[] = [];
    const variables = this.generateVariables();
    
    // Generate blocks
    for (let i = 0; i < numBlocks; i++) {
      const block = this.generateBlock(`block_${i}`, variables, blocks);
      blocks.push(block);
    }
    
    // Ensure valid CFG
    this.ensureValidCFG(blocks);
    
    return {
      name: 'fuzz_program',
      blocks,
      entryBlock: blocks[0].label,
      variables
    };
  }
  
  /**
   * Generate random block
   */
  protected generateBlock(
    label: string,
    variables: Map<string, ILType>,
    existingBlocks: ILBlock[]
  ): ILBlock {
    const numInstructions = this.rng.int(1, this.config.maxInstructions);
    const instructions: ILInstruction[] = [];
    
    for (let i = 0; i < numInstructions - 1; i++) {
      instructions.push(this.generateInstruction(variables));
    }
    
    // Last instruction is always terminator
    instructions.push(this.generateTerminator(existingBlocks));
    
    return { label, instructions };
  }
  
  /**
   * Generate random instruction
   */
  protected generateInstruction(variables: Map<string, ILType>): ILInstruction {
    const type = this.selectInstructionType();
    const varNames = Array.from(variables.keys());
    
    switch (type) {
      case 'arithmetic':
        return this.generateArithmetic(varNames);
      case 'bitwise':
        return this.generateBitwise(varNames);
      case 'compare':
        return this.generateCompare(varNames);
      case 'load_store':
        return this.generateLoadStore(varNames);
      case 'move':
        return this.generateMove(varNames);
      default:
        return this.generateNop();
    }
  }
  
  /**
   * Generate arithmetic instruction
   */
  protected generateArithmetic(vars: string[]): ILInstruction {
    const ops: ILOpcode[] = ['ADD', 'SUB', 'MUL', 'DIV'];
    const op = this.rng.pick(ops);
    const dest = this.rng.pick(vars);
    const src1 = this.rng.pick(vars);
    const src2 = this.rng.bool() ? this.rng.pick(vars) : this.rng.int(0, 255);
    
    return {
      opcode: op,
      dest: { kind: 'var', name: dest },
      operands: [
        { kind: 'var', name: src1 },
        typeof src2 === 'string' 
          ? { kind: 'var', name: src2 }
          : { kind: 'imm', value: src2 }
      ]
    };
  }
  
  /**
   * Generate bitwise instruction
   */
  protected generateBitwise(vars: string[]): ILInstruction {
    const ops: ILOpcode[] = ['AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR'];
    const op = this.rng.pick(ops);
    const dest = this.rng.pick(vars);
    const src1 = this.rng.pick(vars);
    
    const operands: ILOperand[] = [{ kind: 'var', name: src1 }];
    
    if (op !== 'NOT') {
      const src2 = this.rng.bool() ? this.rng.pick(vars) : this.rng.int(0, 7);
      operands.push(
        typeof src2 === 'string'
          ? { kind: 'var', name: src2 }
          : { kind: 'imm', value: src2 }
      );
    }
    
    return {
      opcode: op,
      dest: { kind: 'var', name: dest },
      operands
    };
  }
  
  /**
   * Generate compare instruction
   */
  protected generateCompare(vars: string[]): ILInstruction {
    const dest = this.rng.pick(vars);
    const src1 = this.rng.pick(vars);
    const src2 = this.rng.bool() ? this.rng.pick(vars) : this.rng.int(0, 255);
    
    return {
      opcode: 'CMP',
      dest: { kind: 'var', name: dest },
      operands: [
        { kind: 'var', name: src1 },
        typeof src2 === 'string'
          ? { kind: 'var', name: src2 }
          : { kind: 'imm', value: src2 }
      ]
    };
  }
  
  /**
   * Generate load/store instruction
   */
  protected generateLoadStore(vars: string[]): ILInstruction {
    const isLoad = this.rng.bool();
    const varName = this.rng.pick(vars);
    const addr = this.rng.int(0, 0xFFFF);
    
    if (isLoad) {
      return {
        opcode: 'LOAD',
        dest: { kind: 'var', name: varName },
        operands: [{ kind: 'addr', address: addr }]
      };
    } else {
      return {
        opcode: 'STORE',
        operands: [
          { kind: 'addr', address: addr },
          { kind: 'var', name: varName }
        ]
      };
    }
  }
  
  /**
   * Generate move instruction
   */
  protected generateMove(vars: string[]): ILInstruction {
    const dest = this.rng.pick(vars);
    const src = this.rng.bool() ? this.rng.pick(vars) : this.rng.int(0, 255);
    
    return {
      opcode: 'MOV',
      dest: { kind: 'var', name: dest },
      operands: [
        typeof src === 'string'
          ? { kind: 'var', name: src }
          : { kind: 'imm', value: src }
      ]
    };
  }
  
  /**
   * Generate terminator instruction
   */
  protected generateTerminator(existingBlocks: ILBlock[]): ILInstruction {
    if (existingBlocks.length === 0 || this.rng.float() < 0.2) {
      return { opcode: 'RET', operands: [] };
    }
    
    const targetLabel = this.rng.pick(existingBlocks).label;
    
    if (this.rng.bool()) {
      // Unconditional branch
      return {
        opcode: 'BR',
        operands: [{ kind: 'label', name: targetLabel }]
      };
    } else {
      // Conditional branch
      const altLabel = existingBlocks.length > 1
        ? this.rng.pick(existingBlocks.filter(b => b.label !== targetLabel)).label
        : targetLabel;
      
      return {
        opcode: this.rng.pick(['BEQ', 'BNE', 'BLT', 'BGE']),
        operands: [
          { kind: 'label', name: targetLabel },
          { kind: 'label', name: altLabel }
        ]
      };
    }
  }
  
  /**
   * Generate NOP instruction
   */
  protected generateNop(): ILInstruction {
    return { opcode: 'NOP', operands: [] };
  }
  
  /**
   * Select instruction type based on distribution
   */
  protected selectInstructionType(): keyof InstructionDistribution {
    const dist = this.config.distribution;
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    const r = this.rng.float() * total;
    
    let cumulative = 0;
    for (const [type, weight] of Object.entries(dist)) {
      cumulative += weight;
      if (r <= cumulative) {
        return type as keyof InstructionDistribution;
      }
    }
    
    return 'arithmetic';
  }
  
  /**
   * Generate variable set
   */
  protected generateVariables(): Map<string, ILType> {
    const vars = new Map<string, ILType>();
    const numVars = this.rng.int(1, this.config.maxVariables);
    
    for (let i = 0; i < numVars; i++) {
      vars.set(`v${i}`, this.rng.pick(['i8', 'u8', 'i16', 'u16']));
    }
    
    return vars;
  }
  
  /**
   * Ensure CFG is valid
   */
  protected ensureValidCFG(blocks: ILBlock[]): void {
    // Ensure entry block exists and all blocks are reachable
    const reachable = new Set<string>();
    const worklist = [blocks[0].label];
    
    while (worklist.length > 0) {
      const label = worklist.pop()!;
      if (reachable.has(label)) continue;
      reachable.add(label);
      
      const block = blocks.find(b => b.label === label);
      if (block) {
        const terminator = block.instructions[block.instructions.length - 1];
        for (const op of terminator.operands) {
          if (op.kind === 'label') {
            worklist.push(op.name);
          }
        }
      }
    }
    
    // Remove unreachable blocks
    blocks.splice(0, blocks.length, ...blocks.filter(b => reachable.has(b.label)));
    
    // Ensure at least one exit
    if (!blocks.some(b => {
      const term = b.instructions[b.instructions.length - 1];
      return term.opcode === 'RET';
    })) {
      blocks[blocks.length - 1].instructions[
        blocks[blocks.length - 1].instructions.length - 1
      ] = { opcode: 'RET', operands: [] };
    }
  }
  
  /**
   * Validate optimized output
   */
  protected validateOutput(
    original: ILProgram,
    optimized: ILProgram
  ): { outcome: FuzzOutcome; errors: string[] } {
    const errors: string[] = [];
    
    // Structural validation
    const structuralErrors = this.validator.validate(optimized);
    if (structuralErrors.length > 0) {
      return { outcome: 'invalid_output', errors: structuralErrors };
    }
    
    // Semantic validation
    if (this.config.validateSemantics) {
      const semanticErrors = this.validateSemantics(original, optimized);
      if (semanticErrors.length > 0) {
        return { outcome: 'semantic_change', errors: semanticErrors };
      }
    }
    
    return { outcome: 'pass', errors: [] };
  }
  
  /**
   * Validate semantic equivalence
   */
  protected validateSemantics(
    original: ILProgram,
    optimized: ILProgram
  ): string[] {
    // Simplified semantic check - ensure same observable effects
    const errors: string[] = [];
    
    // Check stores are preserved
    const originalStores = this.collectStores(original);
    const optimizedStores = this.collectStores(optimized);
    
    for (const [addr, _] of originalStores) {
      if (!optimizedStores.has(addr)) {
        errors.push(`Store to ${addr.toString(16)} removed`);
      }
    }
    
    return errors;
  }
  
  /**
   * Collect store addresses
   */
  protected collectStores(program: ILProgram): Map<number, ILInstruction> {
    const stores = new Map<number, ILInstruction>();
    
    for (const block of program.blocks) {
      for (const instr of block.instructions) {
        if (instr.opcode === 'STORE' && instr.operands[0].kind === 'addr') {
          stores.set(instr.operands[0].address, instr);
        }
      }
    }
    
    return stores;
  }
  
  /**
   * Run with timeout
   */
  protected async runWithTimeout<T>(
    fn: () => T,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(`Exceeded ${timeout}ms`));
      }, timeout);
      
      try {
        const result = fn();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }
  
  /**
   * Collect coverage metrics
   */
  protected collectCoverage(): CoverageMetrics {
    return {
      patternsTriggered: this.optimizer.getTriggeredPatterns(),
      blocksVisited: this.optimizer.getBlocksVisited(),
      instructionsProcessed: this.optimizer.getInstructionsProcessed(),
      branchesTaken: 0,
      pathsExplored: 0
    };
  }
  
  /**
   * Aggregate coverage from multiple results
   */
  protected aggregateCoverage(results: FuzzResult[]): CoverageMetrics {
    const allPatterns = new Set<string>();
    let blocks = 0;
    let instructions = 0;
    
    for (const result of results) {
      if (result.coverage) {
        result.coverage.patternsTriggered.forEach(p => allPatterns.add(p));
        blocks += result.coverage.blocksVisited;
        instructions += result.coverage.instructionsProcessed;
      }
    }
    
    return {
      patternsTriggered: allPatterns,
      blocksVisited: blocks,
      instructionsProcessed: instructions,
      branchesTaken: 0,
      pathsExplored: 0
    };
  }
}
```

---

### Test Case Minimizer

```typescript
/**
 * Minimizes failing test cases for easier debugging
 */
export class TestCaseMinimizer {
  protected optimizer: Optimizer;
  protected originalOutcome: FuzzOutcome;
  
  /**
   * Minimize a failing test case
   */
  async minimize(
    program: ILProgram,
    outcome: FuzzOutcome
  ): Promise<MinimizedTestCase> {
    this.originalOutcome = outcome;
    let current = this.cloneProgram(program);
    let improved = true;
    
    while (improved) {
      improved = false;
      
      // Try removing blocks
      for (let i = current.blocks.length - 1; i >= 1; i--) {
        const reduced = this.tryRemoveBlock(current, i);
        if (reduced && this.stillFails(reduced)) {
          current = reduced;
          improved = true;
        }
      }
      
      // Try removing instructions
      for (const block of current.blocks) {
        for (let i = block.instructions.length - 2; i >= 0; i--) {
          const reduced = this.tryRemoveInstruction(current, block.label, i);
          if (reduced && this.stillFails(reduced)) {
            current = reduced;
            improved = true;
          }
        }
      }
      
      // Try simplifying operands
      for (const block of current.blocks) {
        for (let i = 0; i < block.instructions.length; i++) {
          const reduced = this.trySimplifyInstruction(current, block.label, i);
          if (reduced && this.stillFails(reduced)) {
            current = reduced;
            improved = true;
          }
        }
      }
    }
    
    return {
      original: program,
      minimized: current,
      reductionRatio: 1 - (this.countInstructions(current) / this.countInstructions(program)),
      outcome
    };
  }
  
  /**
   * Check if program still fails with same outcome
   */
  protected stillFails(program: ILProgram): boolean {
    try {
      this.optimizer.optimize(program);
      return false;
    } catch {
      return true;
    }
  }
  
  /**
   * Try removing a block
   */
  protected tryRemoveBlock(program: ILProgram, index: number): ILProgram | null {
    if (index === 0) return null; // Can't remove entry
    
    const clone = this.cloneProgram(program);
    const removedLabel = clone.blocks[index].label;
    
    // Check if any other block references this one
    for (const block of clone.blocks) {
      const term = block.instructions[block.instructions.length - 1];
      for (const op of term.operands) {
        if (op.kind === 'label' && op.name === removedLabel) {
          return null; // Can't remove - it's referenced
        }
      }
    }
    
    clone.blocks.splice(index, 1);
    return clone;
  }
  
  /**
   * Try removing an instruction
   */
  protected tryRemoveInstruction(
    program: ILProgram,
    blockLabel: string,
    index: number
  ): ILProgram | null {
    const clone = this.cloneProgram(program);
    const block = clone.blocks.find(b => b.label === blockLabel);
    
    if (!block || index >= block.instructions.length - 1) {
      return null; // Can't remove terminator
    }
    
    block.instructions.splice(index, 1);
    return clone;
  }
  
  /**
   * Try simplifying an instruction
   */
  protected trySimplifyInstruction(
    program: ILProgram,
    blockLabel: string,
    index: number
  ): ILProgram | null {
    const clone = this.cloneProgram(program);
    const block = clone.blocks.find(b => b.label === blockLabel);
    
    if (!block) return null;
    
    const instr = block.instructions[index];
    
    // Try replacing variables with immediates
    for (let i = 0; i < instr.operands.length; i++) {
      if (instr.operands[i].kind === 'var') {
        instr.operands[i] = { kind: 'imm', value: 0 };
        return clone;
      }
    }
    
    return null;
  }
  
  /**
   * Clone program
   */
  protected cloneProgram(program: ILProgram): ILProgram {
    return JSON.parse(JSON.stringify(program));
  }
  
  /**
   * Count instructions
   */
  protected countInstructions(program: ILProgram): number {
    return program.blocks.reduce((sum, b) => sum + b.instructions.length, 0);
  }
}
```

---

## Usage Examples

```typescript
// Configure fuzzer
const fuzzer = new ILFuzzer({
  seed: 12345,
  maxInstructions: 10,
  maxBlocks: 3,
  maxVariables: 5,
  distribution: {
    arithmetic: 30,
    bitwise: 20,
    compare: 10,
    load_store: 20,
    branch: 10,
    call: 5,
    move: 5
  },
  timeout: 1000,
  validateSemantics: true
});

// Run fuzzing campaign
const result = await fuzzer.runCampaign(1000);

console.log(`Passed: ${result.passed}/${result.totalTests}`);
console.log(`Failures: ${result.failures.length}`);
console.log(`Patterns triggered: ${result.coverage.patternsTriggered.size}`);

// Minimize failures
const minimizer = new TestCaseMinimizer();
for (const failure of result.failures) {
  const minimized = await minimizer.minimize(failure.program, failure.outcome);
  console.log(`Reduced by ${(minimized.reductionRatio * 100).toFixed(1)}%`);
}
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| fuzz-basic | Basic fuzzing works | ⏳ |
| fuzz-coverage | Coverage tracking works | ⏳ |
| fuzz-minimize | Minimizer reduces test cases | ⏳ |
| fuzz-reproducible | Same seed = same results | ⏳ |
| fuzz-timeout | Timeouts detected | ⏳ |

---

## Task Checklist

- [ ] 11.4a.1: Implement `ILFuzzer` core
- [ ] 11.4a.2: Implement instruction generators
- [ ] 11.4a.3: Implement `TestCaseMinimizer`
- [ ] 11.4a.4: Add coverage tracking
- [ ] 11.4a.5: Write unit tests

---

## References

- `11-01a2-unit-helpers.md`, `11-02a1-integration-single.md`, `02-analysis-passes.md`