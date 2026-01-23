# 11-02a1: Single Pass Integration Tests

> **Document ID**: 11-02a1-integration-single
> **Phase**: 11 - Testing Framework
> **Task**: 11.2a1 - Single pass integration tests
> **Priority**: High
> **Estimated LOC**: 350-400

---

## Overview

This document specifies integration testing for individual optimization passes. Each pass is tested in isolation with realistic IL inputs to verify correct transformation behavior and proper integration with the optimizer infrastructure.

### Goals

1. Test each optimization pass independently
2. Verify pass produces correct IL transformations
3. Ensure passes integrate properly with infrastructure
4. Validate pass configuration and options
5. Measure pass effectiveness on realistic inputs

---

## Type Definitions

```typescript
/**
 * Single pass integration test configuration
 */
interface SinglePassTestConfig {
  /** Pass identifier */
  passId: string;
  /** Pass constructor */
  passClass: new (config?: PassConfig) => OptimizationPass;
  /** Test input program */
  input: ILProgram;
  /** Expected output (if exact match required) */
  expectedOutput?: ILProgram;
  /** Pass configuration options */
  passConfig?: PassConfig;
  /** Assertions to run on output */
  assertions: PassAssertion[];
}

/**
 * Assertion for pass output verification
 */
interface PassAssertion {
  /** Assertion type */
  type: PassAssertionType;
  /** Assertion parameters */
  params: Record<string, unknown>;
  /** Human-readable description */
  description: string;
}

/**
 * Types of pass assertions
 */
type PassAssertionType =
  | 'instruction_removed'      // Specific instruction was removed
  | 'instruction_added'        // Specific instruction was added
  | 'instruction_replaced'     // Instruction was replaced
  | 'instruction_count'        // Total instruction count
  | 'block_count'              // Total block count
  | 'cycles_improved'          // Cycles reduced
  | 'size_improved'            // Size reduced
  | 'invariant_preserved'      // Program invariant maintained
  | 'ssa_valid'                // SSA form is valid
  | 'cfg_valid'                // CFG is valid
  | 'custom';                  // Custom assertion function

/**
 * Pass test result
 */
interface SinglePassTestResult {
  /** Pass identifier */
  passId: string;
  /** Test name */
  testName: string;
  /** Pass/fail status */
  passed: boolean;
  /** Duration in ms */
  duration: number;
  /** Assertions results */
  assertionResults: AssertionResult[];
  /** Error if failed */
  error?: Error;
  /** Before/after metrics */
  metrics?: PassMetrics;
}

/**
 * Individual assertion result
 */
interface AssertionResult {
  /** Assertion description */
  description: string;
  /** Pass/fail */
  passed: boolean;
  /** Failure message if failed */
  message?: string;
}

/**
 * Pass performance metrics
 */
interface PassMetrics {
  instructionsBefore: number;
  instructionsAfter: number;
  blocksBefore: number;
  blocksAfter: number;
  cyclesBefore: number;
  cyclesAfter: number;
}
```

---

## Implementation

### Single Pass Test Runner

```typescript
/**
 * Integration test runner for single optimization passes
 * 
 * Tests each optimization pass in isolation with realistic
 * IL inputs to verify correct transformation behavior.
 */
export class SinglePassTestRunner {
  protected assertions: OptimizerAssertions;
  protected cycleCounter: CycleCounter;
  
  constructor() {
    this.assertions = new OptimizerAssertions();
    this.cycleCounter = new CycleCounter();
  }
  
  /**
   * Run a single pass integration test
   */
  async runTest(config: SinglePassTestConfig): Promise<SinglePassTestResult> {
    const startTime = Date.now();
    const assertionResults: AssertionResult[] = [];
    
    try {
      // Create pass instance
      const pass = new config.passClass(config.passConfig);
      
      // Compute before metrics
      const beforeMetrics = this.computeMetrics(config.input);
      
      // Run pass
      const output = pass.run(config.input);
      
      // Compute after metrics
      const afterMetrics = this.computeMetrics(output);
      
      // Run assertions
      for (const assertion of config.assertions) {
        const result = this.runAssertion(assertion, config.input, output);
        assertionResults.push(result);
      }
      
      // Check for exact match if expected output provided
      if (config.expectedOutput) {
        const matchResult = this.checkExactMatch(output, config.expectedOutput);
        assertionResults.push(matchResult);
      }
      
      const allPassed = assertionResults.every(r => r.passed);
      
      return {
        passId: config.passId,
        testName: `${config.passId}_integration`,
        passed: allPassed,
        duration: Date.now() - startTime,
        assertionResults,
        metrics: {
          instructionsBefore: beforeMetrics.instructions,
          instructionsAfter: afterMetrics.instructions,
          blocksBefore: beforeMetrics.blocks,
          blocksAfter: afterMetrics.blocks,
          cyclesBefore: beforeMetrics.cycles,
          cyclesAfter: afterMetrics.cycles
        }
      };
    } catch (error) {
      return {
        passId: config.passId,
        testName: `${config.passId}_integration`,
        passed: false,
        duration: Date.now() - startTime,
        assertionResults,
        error: error as Error
      };
    }
  }
  
  /**
   * Run individual assertion
   */
  protected runAssertion(
    assertion: PassAssertion,
    input: ILProgram,
    output: ILProgram
  ): AssertionResult {
    try {
      switch (assertion.type) {
        case 'instruction_removed':
          return this.assertInstructionRemoved(output, assertion);
        
        case 'instruction_added':
          return this.assertInstructionAdded(output, assertion);
        
        case 'instruction_count':
          return this.assertInstructionCount(output, assertion);
        
        case 'block_count':
          return this.assertBlockCount(output, assertion);
        
        case 'cycles_improved':
          return this.assertCyclesImproved(input, output, assertion);
        
        case 'size_improved':
          return this.assertSizeImproved(input, output, assertion);
        
        case 'ssa_valid':
          return this.assertSSAValid(output, assertion);
        
        case 'cfg_valid':
          return this.assertCFGValid(output, assertion);
        
        case 'custom':
          return this.runCustomAssertion(input, output, assertion);
        
        default:
          return {
            description: assertion.description,
            passed: false,
            message: `Unknown assertion type: ${assertion.type}`
          };
      }
    } catch (error) {
      return {
        description: assertion.description,
        passed: false,
        message: (error as Error).message
      };
    }
  }
  
  /**
   * Assert specific instruction was removed
   */
  protected assertInstructionRemoved(
    output: ILProgram,
    assertion: PassAssertion
  ): AssertionResult {
    const opcode = assertion.params.opcode as ILOpcode;
    const found = output.blocks.some(b =>
      b.instructions.some(i => i.opcode === opcode)
    );
    
    return {
      description: assertion.description,
      passed: !found,
      message: found ? `Instruction ${opcode} still present` : undefined
    };
  }
  
  /**
   * Assert specific instruction was added
   */
  protected assertInstructionAdded(
    output: ILProgram,
    assertion: PassAssertion
  ): AssertionResult {
    const opcode = assertion.params.opcode as ILOpcode;
    const found = output.blocks.some(b =>
      b.instructions.some(i => i.opcode === opcode)
    );
    
    return {
      description: assertion.description,
      passed: found,
      message: found ? undefined : `Instruction ${opcode} not found`
    };
  }
  
  /**
   * Assert instruction count
   */
  protected assertInstructionCount(
    output: ILProgram,
    assertion: PassAssertion
  ): AssertionResult {
    const expected = assertion.params.count as number;
    const actual = this.countInstructions(output);
    
    return {
      description: assertion.description,
      passed: actual === expected,
      message: actual !== expected 
        ? `Expected ${expected} instructions, got ${actual}` 
        : undefined
    };
  }
  
  /**
   * Assert block count
   */
  protected assertBlockCount(
    output: ILProgram,
    assertion: PassAssertion
  ): AssertionResult {
    const expected = assertion.params.count as number;
    const actual = output.blocks.length;
    
    return {
      description: assertion.description,
      passed: actual === expected,
      message: actual !== expected
        ? `Expected ${expected} blocks, got ${actual}`
        : undefined
    };
  }
  
  /**
   * Assert cycles improved
   */
  protected assertCyclesImproved(
    input: ILProgram,
    output: ILProgram,
    assertion: PassAssertion
  ): AssertionResult {
    const minImprovement = (assertion.params.minCycles as number) || 1;
    const beforeCycles = this.cycleCounter.count(input);
    const afterCycles = this.cycleCounter.count(output);
    const saved = beforeCycles - afterCycles;
    
    return {
      description: assertion.description,
      passed: saved >= minImprovement,
      message: saved < minImprovement
        ? `Expected at least ${minImprovement} cycles saved, got ${saved}`
        : undefined
    };
  }
  
  /**
   * Assert size improved
   */
  protected assertSizeImproved(
    input: ILProgram,
    output: ILProgram,
    assertion: PassAssertion
  ): AssertionResult {
    const beforeSize = this.countInstructions(input);
    const afterSize = this.countInstructions(output);
    
    return {
      description: assertion.description,
      passed: afterSize < beforeSize,
      message: afterSize >= beforeSize
        ? `Size not reduced: before=${beforeSize}, after=${afterSize}`
        : undefined
    };
  }
  
  /**
   * Assert SSA form is valid
   */
  protected assertSSAValid(
    output: ILProgram,
    assertion: PassAssertion
  ): AssertionResult {
    try {
      this.assertions.il.isValidSSA(output);
      return {
        description: assertion.description,
        passed: true
      };
    } catch (error) {
      return {
        description: assertion.description,
        passed: false,
        message: (error as Error).message
      };
    }
  }
  
  /**
   * Assert CFG is valid
   */
  protected assertCFGValid(
    output: ILProgram,
    assertion: PassAssertion
  ): AssertionResult {
    // Verify all blocks have proper terminators
    for (const block of output.blocks) {
      if (!block.terminator && block !== output.blocks[output.blocks.length - 1]) {
        return {
          description: assertion.description,
          passed: false,
          message: `Block '${block.label}' missing terminator`
        };
      }
    }
    
    // Verify edges are consistent
    for (const block of output.blocks) {
      for (const succ of block.successors) {
        const succBlock = output.blocks.find(b => b.label === succ);
        if (!succBlock) {
          return {
            description: assertion.description,
            passed: false,
            message: `Block '${block.label}' has edge to non-existent block '${succ}'`
          };
        }
      }
    }
    
    return {
      description: assertion.description,
      passed: true
    };
  }
  
  /**
   * Run custom assertion function
   */
  protected runCustomAssertion(
    input: ILProgram,
    output: ILProgram,
    assertion: PassAssertion
  ): AssertionResult {
    const fn = assertion.params.fn as (input: ILProgram, output: ILProgram) => boolean;
    try {
      const passed = fn(input, output);
      return {
        description: assertion.description,
        passed
      };
    } catch (error) {
      return {
        description: assertion.description,
        passed: false,
        message: (error as Error).message
      };
    }
  }
  
  /**
   * Check exact match with expected output
   */
  protected checkExactMatch(actual: ILProgram, expected: ILProgram): AssertionResult {
    const match = this.programsEqual(actual, expected);
    return {
      description: 'Output matches expected exactly',
      passed: match,
      message: match ? undefined : 'Output does not match expected program'
    };
  }
  
  /**
   * Check if two programs are equal
   */
  protected programsEqual(a: ILProgram, b: ILProgram): boolean {
    if (a.blocks.length !== b.blocks.length) return false;
    
    for (let i = 0; i < a.blocks.length; i++) {
      if (!this.blocksEqual(a.blocks[i], b.blocks[i])) return false;
    }
    
    return true;
  }
  
  /**
   * Check if two blocks are equal
   */
  protected blocksEqual(a: ILBlock, b: ILBlock): boolean {
    if (a.label !== b.label) return false;
    if (a.instructions.length !== b.instructions.length) return false;
    
    for (let i = 0; i < a.instructions.length; i++) {
      if (!this.instructionsEqual(a.instructions[i], b.instructions[i])) return false;
    }
    
    return true;
  }
  
  /**
   * Check if two instructions are equal
   */
  protected instructionsEqual(a: ILInstruction, b: ILInstruction): boolean {
    return a.opcode === b.opcode &&
           a.dest === b.dest &&
           JSON.stringify(a.operands) === JSON.stringify(b.operands);
  }
  
  /**
   * Count total instructions in program
   */
  protected countInstructions(program: ILProgram): number {
    return program.blocks.reduce((sum, b) => sum + b.instructions.length, 0);
  }
  
  /**
   * Compute program metrics
   */
  protected computeMetrics(program: ILProgram): { instructions: number; blocks: number; cycles: number } {
    return {
      instructions: this.countInstructions(program),
      blocks: program.blocks.length,
      cycles: this.cycleCounter.count(program)
    };
  }
}
```

### Pass Test Suite Builder

```typescript
/**
 * Builder for creating pass test suites
 */
export class PassTestSuiteBuilder {
  protected tests: SinglePassTestConfig[] = [];
  protected passId: string = '';
  protected passClass: new (config?: PassConfig) => OptimizationPass;
  
  /**
   * Set the pass under test
   */
  forPass<T extends OptimizationPass>(
    passId: string,
    passClass: new (config?: PassConfig) => T
  ): this {
    this.passId = passId;
    this.passClass = passClass;
    return this;
  }
  
  /**
   * Add a test case
   */
  addTest(
    name: string,
    input: ILProgram,
    assertions: PassAssertion[],
    config?: PassConfig
  ): this {
    this.tests.push({
      passId: `${this.passId}_${name}`,
      passClass: this.passClass,
      input,
      assertions,
      passConfig: config
    });
    return this;
  }
  
  /**
   * Add test expecting instruction removal
   */
  addRemovalTest(
    name: string,
    input: ILProgram,
    removedOpcode: ILOpcode,
    config?: PassConfig
  ): this {
    return this.addTest(name, input, [
      {
        type: 'instruction_removed',
        params: { opcode: removedOpcode },
        description: `Should remove ${removedOpcode} instruction`
      },
      {
        type: 'ssa_valid',
        params: {},
        description: 'Output should maintain valid SSA'
      }
    ], config);
  }
  
  /**
   * Add test expecting cycle improvement
   */
  addCycleTest(
    name: string,
    input: ILProgram,
    minCycles: number,
    config?: PassConfig
  ): this {
    return this.addTest(name, input, [
      {
        type: 'cycles_improved',
        params: { minCycles },
        description: `Should save at least ${minCycles} cycles`
      }
    ], config);
  }
  
  /**
   * Build and return test configurations
   */
  build(): SinglePassTestConfig[] {
    return [...this.tests];
  }
}
```

---

## Usage Examples

### Testing Dead Code Elimination

```typescript
const runner = new SinglePassTestRunner();

const result = await runner.runTest({
  passId: 'dead_code_elimination',
  passClass: DeadCodeElimination,
  input: builder
    .block('entry')
    .const('used', 1)
    .const('unused', 2)      // Dead code
    .store('result', 'used')
    .ret()
    .build(),
  assertions: [
    {
      type: 'instruction_removed',
      params: { opcode: ILOpcode.CONST },
      description: 'Removes unused constant'
    },
    {
      type: 'instruction_count',
      params: { count: 2 },
      description: 'Should have 2 instructions'
    }
  ]
});
```

### Using Test Suite Builder

```typescript
const suite = new PassTestSuiteBuilder()
  .forPass('constant_folding', ConstantFolding)
  .addTest('folds_addition', addProgram, [
    { type: 'instruction_count', params: { count: 1 }, description: 'Folds to single const' }
  ])
  .addCycleTest('improves_cycles', complexProgram, 5)
  .build();

for (const config of suite) {
  const result = await runner.runTest(config);
  console.log(`${result.passId}: ${result.passed ? 'PASS' : 'FAIL'}`);
}
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| dce-removes-dead | DCE removes dead code | ⏳ |
| dce-preserves-live | DCE keeps live code | ⏳ |
| cf-folds-constants | Constant folding works | ⏳ |
| cse-eliminates-common | CSE works correctly | ⏳ |
| licm-hoists-invariant | LICM hoists correctly | ⏳ |
| copy-prop-propagates | Copy propagation works | ⏳ |
| strength-reduces | Strength reduction works | ⏳ |
| pass-preserves-ssa | All passes preserve SSA | ⏳ |
| pass-preserves-cfg | All passes preserve CFG | ⏳ |

---

## Task Checklist

- [ ] 11.2a1.1: Implement `SinglePassTestRunner`
- [ ] 11.2a1.2: Implement assertion handlers
- [ ] 11.2a1.3: Implement `PassTestSuiteBuilder`
- [ ] 11.2a1.4: Add metrics computation
- [ ] 11.2a1.5: Create tests for each optimization pass
- [ ] 11.2a1.6: Write unit tests for runner

---

## References

- **Related Documents**:
  - `11-02a2-integration-chain.md` - Multi-pass chain tests
  - `11-02b-integration-analysis.md` - Analysis combination tests
  - `03-classical-optimizations.md` - Optimization passes