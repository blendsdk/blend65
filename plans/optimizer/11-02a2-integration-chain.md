# 11-02a2: Multi-Pass Chain Integration Tests

> **Document ID**: 11-02a2-integration-chain
> **Phase**: 11 - Testing Framework
> **Task**: 11.2a2 - Multi-pass chain integration
> **Priority**: High
> **Estimated LOC**: 350-400

---

## Overview

This document specifies integration testing for multi-pass optimization chains. These tests verify that optimization passes work correctly together, that pass ordering produces optimal results, and that passes don't interfere with each other.

### Goals

1. Test pass composition and ordering
2. Verify passes enable each other's optimizations
3. Detect pass interference and conflicts
4. Validate fixed-point iteration behavior
5. Measure cumulative optimization effectiveness

---

## Type Definitions

```typescript
/**
 * Multi-pass chain test configuration
 */
interface ChainTestConfig {
  /** Test identifier */
  testId: string;
  /** Ordered list of passes to run */
  passes: PassSpec[];
  /** Test input program */
  input: ILProgram;
  /** Maximum iterations for fixed-point */
  maxIterations?: number;
  /** Enable fixed-point iteration */
  fixedPoint?: boolean;
  /** Assertions for final output */
  assertions: ChainAssertion[];
  /** Optional intermediate checkpoints */
  checkpoints?: Checkpoint[];
}

/**
 * Pass specification in a chain
 */
interface PassSpec {
  /** Pass constructor */
  passClass: new (config?: PassConfig) => OptimizationPass;
  /** Pass configuration */
  config?: PassConfig;
  /** Pass name for logging */
  name: string;
}

/**
 * Checkpoint for intermediate verification
 */
interface Checkpoint {
  /** After which pass index (0-based) */
  afterPass: number;
  /** Assertions at this checkpoint */
  assertions: ChainAssertion[];
  /** Checkpoint description */
  description: string;
}

/**
 * Chain-specific assertions
 */
interface ChainAssertion {
  type: ChainAssertionType;
  params: Record<string, unknown>;
  description: string;
}

/**
 * Types of chain assertions
 */
type ChainAssertionType =
  | 'cumulative_improvement'  // Total cycles saved across chain
  | 'no_regression'           // No pass increased code size/cycles
  | 'fixed_point_reached'     // Iteration converged
  | 'pass_order_matters'      // Different order produces worse result
  | 'pass_enabled'            // One pass enabled another's optimization
  | 'final_instruction_count' // Final instruction count
  | 'final_cycle_count'       // Final cycle count
  | 'custom';                 // Custom assertion

/**
 * Chain test result
 */
interface ChainTestResult {
  testId: string;
  passed: boolean;
  duration: number;
  /** Results from each pass */
  passResults: PassRunResult[];
  /** Fixed-point iterations if applicable */
  iterations?: number;
  /** Checkpoint results */
  checkpointResults?: CheckpointResult[];
  /** Final assertion results */
  assertionResults: AssertionResult[];
  /** Error if failed */
  error?: Error;
}

/**
 * Result of running a single pass in the chain
 */
interface PassRunResult {
  passName: string;
  instructionsBefore: number;
  instructionsAfter: number;
  cyclesBefore: number;
  cyclesAfter: number;
  duration: number;
  changed: boolean;
}

/**
 * Checkpoint verification result
 */
interface CheckpointResult {
  description: string;
  afterPass: number;
  assertionResults: AssertionResult[];
  passed: boolean;
}
```

---

## Implementation

### Chain Test Runner

```typescript
/**
 * Integration test runner for multi-pass optimization chains
 * 
 * Tests that optimization passes work correctly together,
 * verifies pass ordering, and detects interference.
 */
export class ChainTestRunner {
  protected assertions: OptimizerAssertions;
  protected cycleCounter: CycleCounter;
  
  constructor() {
    this.assertions = new OptimizerAssertions();
    this.cycleCounter = new CycleCounter();
  }
  
  /**
   * Run a chain integration test
   */
  async runTest(config: ChainTestConfig): Promise<ChainTestResult> {
    const startTime = Date.now();
    const passResults: PassRunResult[] = [];
    const checkpointResults: CheckpointResult[] = [];
    let program = this.cloneProgram(config.input);
    let iterations = 0;
    
    try {
      if (config.fixedPoint) {
        // Fixed-point iteration mode
        const result = await this.runFixedPoint(
          program,
          config.passes,
          config.maxIterations || 10,
          passResults
        );
        program = result.program;
        iterations = result.iterations;
      } else {
        // Single pass through chain
        program = await this.runChainOnce(
          program,
          config.passes,
          passResults,
          config.checkpoints,
          checkpointResults
        );
      }
      
      // Run final assertions
      const assertionResults = this.runChainAssertions(
        config.input,
        program,
        config.assertions,
        passResults,
        iterations
      );
      
      const allPassed = assertionResults.every(r => r.passed) &&
                       checkpointResults.every(r => r.passed);
      
      return {
        testId: config.testId,
        passed: allPassed,
        duration: Date.now() - startTime,
        passResults,
        iterations: config.fixedPoint ? iterations : undefined,
        checkpointResults: checkpointResults.length > 0 ? checkpointResults : undefined,
        assertionResults
      };
    } catch (error) {
      return {
        testId: config.testId,
        passed: false,
        duration: Date.now() - startTime,
        passResults,
        assertionResults: [],
        error: error as Error
      };
    }
  }
  
  /**
   * Run chain once through all passes
   */
  protected async runChainOnce(
    input: ILProgram,
    passes: PassSpec[],
    passResults: PassRunResult[],
    checkpoints?: Checkpoint[],
    checkpointResults?: CheckpointResult[]
  ): Promise<ILProgram> {
    let program = input;
    
    for (let i = 0; i < passes.length; i++) {
      const spec = passes[i];
      const before = this.computeMetrics(program);
      const passStart = Date.now();
      
      const pass = new spec.passClass(spec.config);
      const output = pass.run(program);
      
      const after = this.computeMetrics(output);
      
      passResults.push({
        passName: spec.name,
        instructionsBefore: before.instructions,
        instructionsAfter: after.instructions,
        cyclesBefore: before.cycles,
        cyclesAfter: after.cycles,
        duration: Date.now() - passStart,
        changed: !this.programsEqual(program, output)
      });
      
      program = output;
      
      // Check for checkpoint
      if (checkpoints && checkpointResults) {
        const checkpoint = checkpoints.find(c => c.afterPass === i);
        if (checkpoint) {
          const results = checkpoint.assertions.map(a =>
            this.runSingleChainAssertion(input, program, a, passResults, 0)
          );
          checkpointResults.push({
            description: checkpoint.description,
            afterPass: i,
            assertionResults: results,
            passed: results.every(r => r.passed)
          });
        }
      }
    }
    
    return program;
  }
  
  /**
   * Run chain in fixed-point iteration mode
   */
  protected async runFixedPoint(
    input: ILProgram,
    passes: PassSpec[],
    maxIterations: number,
    passResults: PassRunResult[]
  ): Promise<{ program: ILProgram; iterations: number }> {
    let program = input;
    let iterations = 0;
    let changed = true;
    
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      for (const spec of passes) {
        const before = this.computeMetrics(program);
        const passStart = Date.now();
        
        const pass = new spec.passClass(spec.config);
        const output = pass.run(program);
        
        const after = this.computeMetrics(output);
        const passChanged = !this.programsEqual(program, output);
        
        passResults.push({
          passName: `${spec.name}[${iterations}]`,
          instructionsBefore: before.instructions,
          instructionsAfter: after.instructions,
          cyclesBefore: before.cycles,
          cyclesAfter: after.cycles,
          duration: Date.now() - passStart,
          changed: passChanged
        });
        
        if (passChanged) {
          changed = true;
        }
        
        program = output;
      }
    }
    
    return { program, iterations };
  }
  
  /**
   * Run chain assertions
   */
  protected runChainAssertions(
    input: ILProgram,
    output: ILProgram,
    assertions: ChainAssertion[],
    passResults: PassRunResult[],
    iterations: number
  ): AssertionResult[] {
    return assertions.map(a =>
      this.runSingleChainAssertion(input, output, a, passResults, iterations)
    );
  }
  
  /**
   * Run single chain assertion
   */
  protected runSingleChainAssertion(
    input: ILProgram,
    output: ILProgram,
    assertion: ChainAssertion,
    passResults: PassRunResult[],
    iterations: number
  ): AssertionResult {
    try {
      switch (assertion.type) {
        case 'cumulative_improvement':
          return this.assertCumulativeImprovement(input, output, assertion);
        
        case 'no_regression':
          return this.assertNoRegression(passResults, assertion);
        
        case 'fixed_point_reached':
          return this.assertFixedPointReached(passResults, iterations, assertion);
        
        case 'final_instruction_count':
          return this.assertFinalInstructionCount(output, assertion);
        
        case 'final_cycle_count':
          return this.assertFinalCycleCount(output, assertion);
        
        case 'pass_enabled':
          return this.assertPassEnabled(passResults, assertion);
        
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
   * Assert cumulative cycle improvement
   */
  protected assertCumulativeImprovement(
    input: ILProgram,
    output: ILProgram,
    assertion: ChainAssertion
  ): AssertionResult {
    const minImprovement = assertion.params.minCycles as number;
    const beforeCycles = this.cycleCounter.count(input);
    const afterCycles = this.cycleCounter.count(output);
    const saved = beforeCycles - afterCycles;
    
    return {
      description: assertion.description,
      passed: saved >= minImprovement,
      message: saved < minImprovement
        ? `Expected ${minImprovement}+ cycles saved, got ${saved}`
        : undefined
    };
  }
  
  /**
   * Assert no pass caused regression
   */
  protected assertNoRegression(
    passResults: PassRunResult[],
    assertion: ChainAssertion
  ): AssertionResult {
    const checkCycles = assertion.params.checkCycles !== false;
    const checkSize = assertion.params.checkSize !== false;
    
    for (const result of passResults) {
      if (checkCycles && result.cyclesAfter > result.cyclesBefore) {
        return {
          description: assertion.description,
          passed: false,
          message: `${result.passName} increased cycles: ${result.cyclesBefore} -> ${result.cyclesAfter}`
        };
      }
      if (checkSize && result.instructionsAfter > result.instructionsBefore) {
        return {
          description: assertion.description,
          passed: false,
          message: `${result.passName} increased size: ${result.instructionsBefore} -> ${result.instructionsAfter}`
        };
      }
    }
    
    return { description: assertion.description, passed: true };
  }
  
  /**
   * Assert fixed-point was reached
   */
  protected assertFixedPointReached(
    passResults: PassRunResult[],
    iterations: number,
    assertion: ChainAssertion
  ): AssertionResult {
    const maxExpected = (assertion.params.maxIterations as number) || 10;
    
    // Check if last iteration had no changes
    if (passResults.length === 0) {
      return {
        description: assertion.description,
        passed: false,
        message: 'No pass results'
      };
    }
    
    const lastIterationChanged = passResults
      .slice(-passResults.length / iterations)
      .some(r => r.changed);
    
    if (lastIterationChanged && iterations >= maxExpected) {
      return {
        description: assertion.description,
        passed: false,
        message: `Fixed-point not reached after ${iterations} iterations`
      };
    }
    
    return { description: assertion.description, passed: true };
  }
  
  /**
   * Assert final instruction count
   */
  protected assertFinalInstructionCount(
    output: ILProgram,
    assertion: ChainAssertion
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
   * Assert final cycle count
   */
  protected assertFinalCycleCount(
    output: ILProgram,
    assertion: ChainAssertion
  ): AssertionResult {
    const expected = assertion.params.count as number;
    const actual = this.cycleCounter.count(output);
    
    return {
      description: assertion.description,
      passed: actual <= expected,
      message: actual > expected
        ? `Expected max ${expected} cycles, got ${actual}`
        : undefined
    };
  }
  
  /**
   * Assert one pass enabled another's optimization
   */
  protected assertPassEnabled(
    passResults: PassRunResult[],
    assertion: ChainAssertion
  ): AssertionResult {
    const enablerPass = assertion.params.enabler as string;
    const enabledPass = assertion.params.enabled as string;
    
    const enablerIdx = passResults.findIndex(r => r.passName === enablerPass);
    const enabledIdx = passResults.findIndex(r => r.passName === enabledPass);
    
    if (enablerIdx === -1 || enabledIdx === -1) {
      return {
        description: assertion.description,
        passed: false,
        message: 'Pass not found in results'
      };
    }
    
    // Enabled pass should have made changes
    if (!passResults[enabledIdx].changed) {
      return {
        description: assertion.description,
        passed: false,
        message: `${enabledPass} did not make any changes`
      };
    }
    
    return { description: assertion.description, passed: true };
  }
  
  /**
   * Compute program metrics
   */
  protected computeMetrics(program: ILProgram): { instructions: number; cycles: number } {
    return {
      instructions: this.countInstructions(program),
      cycles: this.cycleCounter.count(program)
    };
  }
  
  /**
   * Count instructions
   */
  protected countInstructions(program: ILProgram): number {
    return program.blocks.reduce((sum, b) => sum + b.instructions.length, 0);
  }
  
  /**
   * Check program equality
   */
  protected programsEqual(a: ILProgram, b: ILProgram): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  
  /**
   * Clone program
   */
  protected cloneProgram(program: ILProgram): ILProgram {
    return JSON.parse(JSON.stringify(program));
  }
}
```

---

## Usage Examples

### Testing Pass Chain

```typescript
const runner = new ChainTestRunner();

const result = await runner.runTest({
  testId: 'standard_optimization_chain',
  passes: [
    { name: 'constant_folding', passClass: ConstantFolding },
    { name: 'copy_propagation', passClass: CopyPropagation },
    { name: 'dead_code_elimination', passClass: DeadCodeElimination }
  ],
  input: programWithDeadCode,
  assertions: [
    {
      type: 'cumulative_improvement',
      params: { minCycles: 10 },
      description: 'Should save at least 10 cycles total'
    },
    {
      type: 'no_regression',
      params: {},
      description: 'No pass should increase code size'
    }
  ]
});
```

### Testing Fixed-Point Iteration

```typescript
const result = await runner.runTest({
  testId: 'fixed_point_optimization',
  passes: [
    { name: 'constant_folding', passClass: ConstantFolding },
    { name: 'copy_propagation', passClass: CopyPropagation },
    { name: 'dead_code_elimination', passClass: DeadCodeElimination }
  ],
  input: complexProgram,
  fixedPoint: true,
  maxIterations: 5,
  assertions: [
    {
      type: 'fixed_point_reached',
      params: { maxIterations: 5 },
      description: 'Should reach fixed point within 5 iterations'
    }
  ]
});
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| chain-basic | Basic chain execution | ⏳ |
| chain-fixed-point | Fixed-point iteration | ⏳ |
| chain-no-regression | No pass regresses | ⏳ |
| chain-enablement | Passes enable each other | ⏳ |
| chain-checkpoints | Intermediate verification | ⏳ |
| chain-ordering | Order affects result | ⏳ |

---

## Task Checklist

- [ ] 11.2a2.1: Implement `ChainTestRunner`
- [ ] 11.2a2.2: Implement fixed-point iteration
- [ ] 11.2a2.3: Implement checkpoint verification
- [ ] 11.2a2.4: Add chain-specific assertions
- [ ] 11.2a2.5: Create standard chain tests
- [ ] 11.2a2.6: Write unit tests for runner

---

## References

- **Related Documents**:
  - `11-02a1-integration-single.md` - Single pass tests
  - `11-02b-integration-analysis.md` - Analysis tests
  - `03-classical-optimizations.md` - Optimization passes