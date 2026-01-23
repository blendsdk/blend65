# 11-03a: E2E Compile→Optimize Tests

> **Document ID**: 11-03a-e2e-compile
> **Phase**: 11 - Testing Framework
> **Task**: 11.3a - E2E compile→optimize tests
> **Priority**: High
> **Estimated LOC**: 300-350

---

## Overview

This document specifies end-to-end testing from Blend65 source compilation through optimization. Tests verify the complete path from source code to optimized IL, ensuring the compiler and optimizer work together correctly.

### Goals

1. Test source-to-IL compilation correctness
2. Verify optimizer processes compiled IL correctly
3. Test realistic Blend65 programs
4. Validate optimization effectiveness on real code
5. Detect compiler-optimizer integration issues

---

## Type Definitions

```typescript
/**
 * E2E compile-optimize test configuration
 */
interface CompileOptimizeTestConfig {
  /** Test identifier */
  testId: string;
  /** Blend65 source code */
  source: string;
  /** Source file name for error reporting */
  fileName?: string;
  /** Compiler options */
  compilerOptions?: CompilerOptions;
  /** Optimization level */
  optimizationLevel: OptimizationLevel;
  /** Assertions on final IL */
  assertions: E2EAssertion[];
  /** Expected compilation errors (for negative tests) */
  expectedErrors?: ExpectedError[];
}

/**
 * Optimization levels
 */
type OptimizationLevel = 'none' | 'basic' | 'standard' | 'aggressive';

/**
 * E2E assertion types
 */
interface E2EAssertion {
  type: E2EAssertionType;
  params: Record<string, unknown>;
  description: string;
}

type E2EAssertionType =
  | 'compiles_successfully'   // Source compiles without errors
  | 'no_optimization_errors'  // Optimizer runs without errors
  | 'function_exists'         // Function exists in output
  | 'variable_exists'         // Variable exists in output
  | 'cycles_under'            // Total cycles under threshold
  | 'size_under'              // Total size under threshold
  | 'optimization_applied'    // Specific optimization was applied
  | 'hardware_access_correct' // VIC/SID access patterns correct
  | 'custom';

/**
 * Expected compilation error
 */
interface ExpectedError {
  type: 'lexer' | 'parser' | 'semantic' | 'codegen';
  messageContains?: string;
  line?: number;
}

/**
 * E2E test result
 */
interface CompileOptimizeResult {
  testId: string;
  passed: boolean;
  duration: number;
  compilationResult?: CompilationResult;
  optimizationResult?: OptimizationResult;
  assertionResults: AssertionResult[];
  error?: Error;
}

/**
 * Compilation result details
 */
interface CompilationResult {
  success: boolean;
  errors: CompilerError[];
  warnings: CompilerWarning[];
  ilProgram?: ILProgram;
  duration: number;
}

/**
 * Optimization result details
 */
interface OptimizationResult {
  success: boolean;
  errors: Error[];
  optimizedProgram: ILProgram;
  metrics: OptimizationMetrics;
  duration: number;
}

/**
 * Optimization metrics
 */
interface OptimizationMetrics {
  originalInstructions: number;
  optimizedInstructions: number;
  originalCycles: number;
  optimizedCycles: number;
  passesRun: string[];
  passMetrics: Map<string, PassMetrics>;
}
```

---

## Implementation

### E2E Compile-Optimize Test Runner

```typescript
/**
 * End-to-end test runner for compile→optimize pipeline
 * 
 * Tests the complete path from Blend65 source to optimized IL,
 * verifying compiler and optimizer integration.
 */
export class CompileOptimizeTestRunner {
  protected compiler: Blend65Compiler;
  protected optimizer: Optimizer;
  
  constructor() {
    this.compiler = new Blend65Compiler();
    this.optimizer = new Optimizer();
  }
  
  /**
   * Run E2E compile-optimize test
   */
  async runTest(config: CompileOptimizeTestConfig): Promise<CompileOptimizeResult> {
    const startTime = Date.now();
    
    try {
      // Phase 1: Compile source to IL
      const compilationResult = await this.compile(config);
      
      // Check for expected errors
      if (config.expectedErrors) {
        return this.handleExpectedErrors(config, compilationResult, startTime);
      }
      
      // Check compilation success
      if (!compilationResult.success || !compilationResult.ilProgram) {
        return {
          testId: config.testId,
          passed: false,
          duration: Date.now() - startTime,
          compilationResult,
          assertionResults: [{
            description: 'Compilation should succeed',
            passed: false,
            message: `Compilation failed: ${compilationResult.errors.map(e => e.message).join(', ')}`
          }]
        };
      }
      
      // Phase 2: Optimize IL
      const optimizationResult = await this.optimize(
        compilationResult.ilProgram,
        config.optimizationLevel
      );
      
      if (!optimizationResult.success) {
        return {
          testId: config.testId,
          passed: false,
          duration: Date.now() - startTime,
          compilationResult,
          optimizationResult,
          assertionResults: [{
            description: 'Optimization should succeed',
            passed: false,
            message: optimizationResult.errors.map(e => e.message).join(', ')
          }]
        };
      }
      
      // Phase 3: Run assertions
      const assertionResults = this.runAssertions(
        config.assertions,
        compilationResult,
        optimizationResult
      );
      
      return {
        testId: config.testId,
        passed: assertionResults.every(r => r.passed),
        duration: Date.now() - startTime,
        compilationResult,
        optimizationResult,
        assertionResults
      };
    } catch (error) {
      return {
        testId: config.testId,
        passed: false,
        duration: Date.now() - startTime,
        assertionResults: [],
        error: error as Error
      };
    }
  }
  
  /**
   * Compile source to IL
   */
  protected async compile(config: CompileOptimizeTestConfig): Promise<CompilationResult> {
    const startTime = Date.now();
    
    try {
      const result = this.compiler.compile(config.source, {
        fileName: config.fileName || 'test.blend',
        ...config.compilerOptions
      });
      
      return {
        success: result.errors.length === 0,
        errors: result.errors,
        warnings: result.warnings,
        ilProgram: result.il,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        errors: [{ type: 'internal', message: (error as Error).message }],
        warnings: [],
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Optimize IL program
   */
  protected async optimize(
    program: ILProgram,
    level: OptimizationLevel
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const originalMetrics = this.computeMetrics(program);
    
    try {
      const passConfig = this.getPassConfig(level);
      const passesRun: string[] = [];
      const passMetrics = new Map<string, PassMetrics>();
      
      let optimized = program;
      for (const pass of passConfig.passes) {
        const passStart = Date.now();
        const beforeMetrics = this.computeMetrics(optimized);
        
        const passInstance = new pass.passClass(pass.config);
        optimized = passInstance.run(optimized);
        
        const afterMetrics = this.computeMetrics(optimized);
        passesRun.push(pass.name);
        passMetrics.set(pass.name, {
          instructionsBefore: beforeMetrics.instructions,
          instructionsAfter: afterMetrics.instructions,
          cyclesBefore: beforeMetrics.cycles,
          cyclesAfter: afterMetrics.cycles,
          duration: Date.now() - passStart
        });
      }
      
      const optimizedMetrics = this.computeMetrics(optimized);
      
      return {
        success: true,
        errors: [],
        optimizedProgram: optimized,
        metrics: {
          originalInstructions: originalMetrics.instructions,
          optimizedInstructions: optimizedMetrics.instructions,
          originalCycles: originalMetrics.cycles,
          optimizedCycles: optimizedMetrics.cycles,
          passesRun,
          passMetrics
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        errors: [error as Error],
        optimizedProgram: program,
        metrics: {
          originalInstructions: originalMetrics.instructions,
          optimizedInstructions: originalMetrics.instructions,
          originalCycles: originalMetrics.cycles,
          optimizedCycles: originalMetrics.cycles,
          passesRun: [],
          passMetrics: new Map()
        },
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Get pass configuration for optimization level
   */
  protected getPassConfig(level: OptimizationLevel): { passes: PassSpec[] } {
    switch (level) {
      case 'none':
        return { passes: [] };
      
      case 'basic':
        return {
          passes: [
            { name: 'constant_folding', passClass: ConstantFolding },
            { name: 'dead_code_elimination', passClass: DeadCodeElimination }
          ]
        };
      
      case 'standard':
        return {
          passes: [
            { name: 'constant_folding', passClass: ConstantFolding },
            { name: 'copy_propagation', passClass: CopyPropagation },
            { name: 'dead_code_elimination', passClass: DeadCodeElimination },
            { name: 'common_subexpr_elim', passClass: CommonSubexpressionElimination },
            { name: 'strength_reduction', passClass: StrengthReduction }
          ]
        };
      
      case 'aggressive':
        return {
          passes: [
            { name: 'constant_folding', passClass: ConstantFolding },
            { name: 'copy_propagation', passClass: CopyPropagation },
            { name: 'dead_code_elimination', passClass: DeadCodeElimination },
            { name: 'common_subexpr_elim', passClass: CommonSubexpressionElimination },
            { name: 'strength_reduction', passClass: StrengthReduction },
            { name: 'loop_invariant_motion', passClass: LoopInvariantCodeMotion },
            { name: 'peephole', passClass: PeepholeOptimizer }
          ]
        };
    }
  }
  
  /**
   * Handle expected errors test
   */
  protected handleExpectedErrors(
    config: CompileOptimizeTestConfig,
    compilationResult: CompilationResult,
    startTime: number
  ): CompileOptimizeResult {
    const assertionResults: AssertionResult[] = [];
    
    for (const expected of config.expectedErrors!) {
      const found = compilationResult.errors.some(e => {
        if (expected.messageContains && !e.message.includes(expected.messageContains)) {
          return false;
        }
        if (expected.line !== undefined && e.line !== expected.line) {
          return false;
        }
        return true;
      });
      
      assertionResults.push({
        description: `Should have ${expected.type} error${expected.messageContains ? ` containing "${expected.messageContains}"` : ''}`,
        passed: found,
        message: found ? undefined : 'Expected error not found'
      });
    }
    
    return {
      testId: config.testId,
      passed: assertionResults.every(r => r.passed),
      duration: Date.now() - startTime,
      compilationResult,
      assertionResults
    };
  }
  
  /**
   * Run assertions
   */
  protected runAssertions(
    assertions: E2EAssertion[],
    compilationResult: CompilationResult,
    optimizationResult: OptimizationResult
  ): AssertionResult[] {
    return assertions.map(a => this.runAssertion(a, compilationResult, optimizationResult));
  }
  
  /**
   * Run single assertion
   */
  protected runAssertion(
    assertion: E2EAssertion,
    compilationResult: CompilationResult,
    optimizationResult: OptimizationResult
  ): AssertionResult {
    switch (assertion.type) {
      case 'compiles_successfully':
        return {
          description: assertion.description,
          passed: compilationResult.success
        };
      
      case 'no_optimization_errors':
        return {
          description: assertion.description,
          passed: optimizationResult.success
        };
      
      case 'cycles_under':
        const maxCycles = assertion.params.cycles as number;
        return {
          description: assertion.description,
          passed: optimizationResult.metrics.optimizedCycles <= maxCycles,
          message: optimizationResult.metrics.optimizedCycles > maxCycles
            ? `Cycles ${optimizationResult.metrics.optimizedCycles} exceeds ${maxCycles}`
            : undefined
        };
      
      case 'size_under':
        const maxSize = assertion.params.instructions as number;
        return {
          description: assertion.description,
          passed: optimizationResult.metrics.optimizedInstructions <= maxSize,
          message: optimizationResult.metrics.optimizedInstructions > maxSize
            ? `Size ${optimizationResult.metrics.optimizedInstructions} exceeds ${maxSize}`
            : undefined
        };
      
      case 'optimization_applied':
        const passName = assertion.params.pass as string;
        const wasRun = optimizationResult.metrics.passesRun.includes(passName);
        const hadEffect = optimizationResult.metrics.passMetrics.get(passName)?.instructionsAfter !==
                         optimizationResult.metrics.passMetrics.get(passName)?.instructionsBefore;
        return {
          description: assertion.description,
          passed: wasRun && hadEffect
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
   * Compute program metrics
   */
  protected computeMetrics(program: ILProgram): { instructions: number; cycles: number } {
    const instructions = program.blocks.reduce((sum, b) => sum + b.instructions.length, 0);
    // Simplified cycle counting - real implementation would be more accurate
    const cycles = instructions * 3;
    return { instructions, cycles };
  }
}
```

---

## Usage Examples

### Basic Compile-Optimize Test

```typescript
const runner = new CompileOptimizeTestRunner();

const result = await runner.runTest({
  testId: 'simple_loop',
  source: `
    let counter: byte = 0;
    while (counter < 10) {
      counter = counter + 1;
    }
  `,
  optimizationLevel: 'standard',
  assertions: [
    { type: 'compiles_successfully', params: {}, description: 'Should compile' },
    { type: 'no_optimization_errors', params: {}, description: 'Should optimize' },
    { type: 'cycles_under', params: { cycles: 100 }, description: 'Under 100 cycles' }
  ]
});
```

### Testing C64 Hardware Access

```typescript
const result = await runner.runTest({
  testId: 'sprite_update',
  source: `
    @map sprite0X at $D000: byte;
    @map sprite0Y at $D001: byte;
    
    function updateSprite(x: byte, y: byte): void {
      sprite0X = x;
      sprite0Y = y;
    }
  `,
  optimizationLevel: 'aggressive',
  assertions: [
    { type: 'compiles_successfully', params: {}, description: 'Compiles' },
    { type: 'function_exists', params: { name: 'updateSprite' }, description: 'Function exists' }
  ]
});
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| e2e-simple-compile | Simple program compiles | ⏳ |
| e2e-loop-optimize | Loop optimization works | ⏳ |
| e2e-hardware-access | VIC/SID access correct | ⏳ |
| e2e-error-handling | Compilation errors work | ⏳ |
| e2e-optimization-levels | All opt levels work | ⏳ |

---

## Task Checklist

- [ ] 11.3a.1: Implement `CompileOptimizeTestRunner`
- [ ] 11.3a.2: Implement compilation integration
- [ ] 11.3a.3: Implement optimization level configs
- [ ] 11.3a.4: Add E2E assertions
- [ ] 11.3a.5: Create test suite for Blend65 programs
- [ ] 11.3a.6: Write unit tests for runner

---

## References

- **Related Documents**:
  - `11-03b1-e2e-opt-pipeline.md` - Optimization pipeline tests
  - `11-03b2-e2e-full-pipeline.md` - Full pipeline tests
  - `01-architecture.md` - Optimizer architecture