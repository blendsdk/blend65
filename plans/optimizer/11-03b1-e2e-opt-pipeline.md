# 11-03b1: E2E Optimization Pipeline Tests

> **Document ID**: 11-03b1-e2e-opt-pipeline
> **Phase**: 11 - Testing Framework
> **Task**: 11.3b1 - E2E optimization pipeline tests
> **Priority**: High
> **Estimated LOC**: 280-320

---

## Overview

This document specifies end-to-end testing for the complete optimization pipeline. Tests verify that the optimizer processes programs correctly through all phases, from IL input through final optimized output.

### Goals

1. Test complete optimization pipeline execution
2. Verify all optimization phases work together
3. Test pipeline configuration options
4. Validate optimization metrics reporting
5. Detect pipeline integration issues

---

## Type Definitions

```typescript
/**
 * Optimization pipeline test configuration
 */
interface OptPipelineTestConfig {
  /** Test identifier */
  testId: string;
  /** Input IL program */
  input: ILProgram;
  /** Pipeline configuration */
  pipelineConfig: PipelineConfig;
  /** Assertions on output */
  assertions: PipelineAssertion[];
  /** Expected metrics thresholds */
  metricsThresholds?: MetricsThresholds;
}

/**
 * Pipeline configuration
 */
interface PipelineConfig {
  /** Optimization level preset */
  level?: OptimizationLevel;
  /** Custom pass ordering */
  passes?: PassSpec[];
  /** Analysis to run */
  analyses?: AnalysisSpec[];
  /** Enable fixed-point iteration */
  fixedPoint?: boolean;
  /** Maximum iterations */
  maxIterations?: number;
  /** Enable debug output */
  debug?: boolean;
}

/**
 * Pipeline assertion types
 */
interface PipelineAssertion {
  type: PipelineAssertionType;
  params: Record<string, unknown>;
  description: string;
}

type PipelineAssertionType =
  | 'pipeline_completes'      // Pipeline runs without error
  | 'all_passes_run'          // All configured passes executed
  | 'metrics_improved'        // Overall metrics improved
  | 'fixed_point_converged'   // Iteration converged
  | 'no_pass_errors'          // No pass threw errors
  | 'output_valid'            // Output IL is valid
  | 'semantic_preserved'      // Program semantics preserved
  | 'custom';

/**
 * Metrics thresholds for pass/fail
 */
interface MetricsThresholds {
  /** Minimum cycle improvement ratio */
  minCycleImprovement?: number;
  /** Minimum size reduction ratio */
  minSizeReduction?: number;
  /** Maximum pipeline duration (ms) */
  maxDuration?: number;
  /** Maximum iterations */
  maxIterations?: number;
}

/**
 * Pipeline test result
 */
interface OptPipelineResult {
  testId: string;
  passed: boolean;
  duration: number;
  pipelineMetrics: PipelineMetrics;
  assertionResults: AssertionResult[];
  error?: Error;
}

/**
 * Pipeline execution metrics
 */
interface PipelineMetrics {
  /** Total duration */
  totalDuration: number;
  /** Passes executed */
  passesExecuted: string[];
  /** Iterations (if fixed-point) */
  iterations?: number;
  /** Input metrics */
  inputMetrics: ProgramMetrics;
  /** Output metrics */
  outputMetrics: ProgramMetrics;
  /** Per-pass metrics */
  passMetrics: PassMetrics[];
}

/**
 * Program metrics
 */
interface ProgramMetrics {
  instructions: number;
  blocks: number;
  cycles: number;
  bytes: number;
}
```

---

## Implementation

### Optimization Pipeline Test Runner

```typescript
/**
 * End-to-end test runner for optimization pipeline
 * 
 * Tests the complete optimization pipeline execution,
 * verifying all phases work together correctly.
 */
export class OptPipelineTestRunner {
  protected pipeline: OptimizationPipeline;
  
  constructor() {
    this.pipeline = new OptimizationPipeline();
  }
  
  /**
   * Run pipeline test
   */
  async runTest(config: OptPipelineTestConfig): Promise<OptPipelineResult> {
    const startTime = Date.now();
    
    try {
      // Configure pipeline
      this.configurePipeline(config.pipelineConfig);
      
      // Compute input metrics
      const inputMetrics = this.computeProgramMetrics(config.input);
      
      // Execute pipeline
      const pipelineResult = await this.pipeline.run(config.input);
      
      // Compute output metrics
      const outputMetrics = this.computeProgramMetrics(pipelineResult.output);
      
      // Build pipeline metrics
      const pipelineMetrics: PipelineMetrics = {
        totalDuration: Date.now() - startTime,
        passesExecuted: pipelineResult.passesExecuted,
        iterations: pipelineResult.iterations,
        inputMetrics,
        outputMetrics,
        passMetrics: pipelineResult.passMetrics
      };
      
      // Run assertions
      const assertionResults = this.runAssertions(
        config.assertions,
        pipelineResult,
        pipelineMetrics,
        config.metricsThresholds
      );
      
      return {
        testId: config.testId,
        passed: assertionResults.every(r => r.passed),
        duration: pipelineMetrics.totalDuration,
        pipelineMetrics,
        assertionResults
      };
    } catch (error) {
      return {
        testId: config.testId,
        passed: false,
        duration: Date.now() - startTime,
        pipelineMetrics: this.emptyMetrics(),
        assertionResults: [{
          description: 'Pipeline should complete',
          passed: false,
          message: (error as Error).message
        }],
        error: error as Error
      };
    }
  }
  
  /**
   * Configure pipeline from config
   */
  protected configurePipeline(config: PipelineConfig): void {
    if (config.level) {
      this.pipeline.setLevel(config.level);
    }
    
    if (config.passes) {
      this.pipeline.setPasses(config.passes);
    }
    
    if (config.analyses) {
      this.pipeline.setAnalyses(config.analyses);
    }
    
    if (config.fixedPoint !== undefined) {
      this.pipeline.setFixedPoint(config.fixedPoint, config.maxIterations || 10);
    }
    
    if (config.debug) {
      this.pipeline.enableDebug();
    }
  }
  
  /**
   * Run assertions
   */
  protected runAssertions(
    assertions: PipelineAssertion[],
    result: PipelineExecutionResult,
    metrics: PipelineMetrics,
    thresholds?: MetricsThresholds
  ): AssertionResult[] {
    const results: AssertionResult[] = [];
    
    for (const assertion of assertions) {
      results.push(this.runAssertion(assertion, result, metrics));
    }
    
    // Add threshold-based assertions
    if (thresholds) {
      results.push(...this.checkThresholds(metrics, thresholds));
    }
    
    return results;
  }
  
  /**
   * Run single assertion
   */
  protected runAssertion(
    assertion: PipelineAssertion,
    result: PipelineExecutionResult,
    metrics: PipelineMetrics
  ): AssertionResult {
    switch (assertion.type) {
      case 'pipeline_completes':
        return {
          description: assertion.description,
          passed: result.success
        };
      
      case 'all_passes_run':
        const expectedPasses = assertion.params.passes as string[];
        const allRun = expectedPasses.every(p => metrics.passesExecuted.includes(p));
        return {
          description: assertion.description,
          passed: allRun,
          message: allRun ? undefined : 
            `Missing passes: ${expectedPasses.filter(p => !metrics.passesExecuted.includes(p)).join(', ')}`
        };
      
      case 'metrics_improved':
        const cycleImproved = metrics.outputMetrics.cycles < metrics.inputMetrics.cycles;
        const sizeImproved = metrics.outputMetrics.instructions <= metrics.inputMetrics.instructions;
        return {
          description: assertion.description,
          passed: cycleImproved || sizeImproved
        };
      
      case 'fixed_point_converged':
        const maxIter = (assertion.params.maxIterations as number) || 10;
        return {
          description: assertion.description,
          passed: (metrics.iterations || 1) < maxIter,
          message: metrics.iterations && metrics.iterations >= maxIter
            ? `Did not converge within ${maxIter} iterations`
            : undefined
        };
      
      case 'output_valid':
        const valid = this.validateOutput(result.output);
        return {
          description: assertion.description,
          passed: valid.isValid,
          message: valid.errors.join(', ')
        };
      
      default:
        return {
          description: assertion.description,
          passed: false,
          message: `Unknown assertion type: ${assertion.type}`
        };
    }
  }
  
  /**
   * Check metrics thresholds
   */
  protected checkThresholds(
    metrics: PipelineMetrics,
    thresholds: MetricsThresholds
  ): AssertionResult[] {
    const results: AssertionResult[] = [];
    
    if (thresholds.minCycleImprovement !== undefined) {
      const improvement = 1 - (metrics.outputMetrics.cycles / metrics.inputMetrics.cycles);
      results.push({
        description: `Cycle improvement >= ${thresholds.minCycleImprovement * 100}%`,
        passed: improvement >= thresholds.minCycleImprovement,
        message: improvement < thresholds.minCycleImprovement
          ? `Actual: ${(improvement * 100).toFixed(1)}%`
          : undefined
      });
    }
    
    if (thresholds.minSizeReduction !== undefined) {
      const reduction = 1 - (metrics.outputMetrics.instructions / metrics.inputMetrics.instructions);
      results.push({
        description: `Size reduction >= ${thresholds.minSizeReduction * 100}%`,
        passed: reduction >= thresholds.minSizeReduction
      });
    }
    
    if (thresholds.maxDuration !== undefined) {
      results.push({
        description: `Duration <= ${thresholds.maxDuration}ms`,
        passed: metrics.totalDuration <= thresholds.maxDuration,
        message: metrics.totalDuration > thresholds.maxDuration
          ? `Actual: ${metrics.totalDuration}ms`
          : undefined
      });
    }
    
    return results;
  }
  
  /**
   * Validate output program
   */
  protected validateOutput(program: ILProgram): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check blocks have terminators
    for (const block of program.blocks) {
      if (!block.terminator && block.successors.length > 0) {
        errors.push(`Block ${block.label} missing terminator`);
      }
    }
    
    // Check CFG consistency
    for (const block of program.blocks) {
      for (const succ of block.successors) {
        const succBlock = program.blocks.find(b => b.label === succ);
        if (!succBlock) {
          errors.push(`Invalid successor ${succ} from ${block.label}`);
        }
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }
  
  /**
   * Compute program metrics
   */
  protected computeProgramMetrics(program: ILProgram): ProgramMetrics {
    return {
      instructions: program.blocks.reduce((sum, b) => sum + b.instructions.length, 0),
      blocks: program.blocks.length,
      cycles: this.estimateCycles(program),
      bytes: this.estimateBytes(program)
    };
  }
  
  /**
   * Estimate cycle count
   */
  protected estimateCycles(program: ILProgram): number {
    let cycles = 0;
    for (const block of program.blocks) {
      cycles += block.instructions.length * 3; // Average 3 cycles per IL instruction
    }
    return cycles;
  }
  
  /**
   * Estimate byte size
   */
  protected estimateBytes(program: ILProgram): number {
    let bytes = 0;
    for (const block of program.blocks) {
      bytes += block.instructions.length * 2; // Average 2 bytes per IL instruction
    }
    return bytes;
  }
  
  /**
   * Create empty metrics for error cases
   */
  protected emptyMetrics(): PipelineMetrics {
    return {
      totalDuration: 0,
      passesExecuted: [],
      inputMetrics: { instructions: 0, blocks: 0, cycles: 0, bytes: 0 },
      outputMetrics: { instructions: 0, blocks: 0, cycles: 0, bytes: 0 },
      passMetrics: []
    };
  }
}
```

---

## Usage Examples

### Basic Pipeline Test

```typescript
const runner = new OptPipelineTestRunner();

const result = await runner.runTest({
  testId: 'standard_pipeline',
  input: testProgram,
  pipelineConfig: {
    level: 'standard',
    fixedPoint: true,
    maxIterations: 5
  },
  assertions: [
    { type: 'pipeline_completes', params: {}, description: 'Pipeline completes' },
    { type: 'metrics_improved', params: {}, description: 'Metrics improved' },
    { type: 'output_valid', params: {}, description: 'Output is valid' }
  ],
  metricsThresholds: {
    minCycleImprovement: 0.1,
    maxDuration: 1000
  }
});
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| pipeline-basic | Basic pipeline execution | ⏳ |
| pipeline-fixed-point | Fixed-point convergence | ⏳ |
| pipeline-all-levels | All optimization levels | ⏳ |
| pipeline-custom-passes | Custom pass ordering | ⏳ |
| pipeline-metrics | Metrics reporting | ⏳ |

---

## Task Checklist

- [ ] 11.3b1.1: Implement `OptPipelineTestRunner`
- [ ] 11.3b1.2: Implement pipeline configuration
- [ ] 11.3b1.3: Implement metrics computation
- [ ] 11.3b1.4: Implement threshold checking
- [ ] 11.3b1.5: Create pipeline test suite
- [ ] 11.3b1.6: Write unit tests

---

## References

- **Related Documents**:
  - `11-03a-e2e-compile.md` - Compile-optimize tests
  - `11-03b2-e2e-full-pipeline.md` - Full pipeline tests
  - `01-architecture.md` - Pipeline architecture