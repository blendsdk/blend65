# 11-02b: Analysis Combination Tests

> **Document ID**: 11-02b-integration-analysis
> **Phase**: 11 - Testing Framework
> **Task**: 11.2b - Analysis combination tests
> **Priority**: High
> **Estimated LOC**: 300-350

---

## Overview

This document specifies integration testing for analysis passes and their combination with optimization passes. Tests verify that analysis results are correct, that multiple analyses work together, and that optimizations properly use analysis information.

### Goals

1. Test individual analysis passes for correctness
2. Verify multiple analyses produce consistent results
3. Test optimization passes use analysis data correctly
4. Validate analysis caching and invalidation
5. Measure analysis overhead and efficiency

---

## Type Definitions

```typescript
/**
 * Analysis integration test configuration
 */
interface AnalysisTestConfig {
  /** Test identifier */
  testId: string;
  /** Analyses to run */
  analyses: AnalysisSpec[];
  /** Test input program */
  input: ILProgram;
  /** Assertions for analysis results */
  assertions: AnalysisAssertion[];
  /** Optional optimization passes that use analyses */
  optimizations?: PassSpec[];
}

/**
 * Analysis specification
 */
interface AnalysisSpec {
  /** Analysis constructor */
  analysisClass: new () => Analysis;
  /** Analysis name */
  name: string;
  /** Expected to be computed before this */
  dependsOn?: string[];
}

/**
 * Analysis assertion types
 */
interface AnalysisAssertion {
  type: AnalysisAssertionType;
  params: Record<string, unknown>;
  description: string;
}

type AnalysisAssertionType =
  | 'dominators_correct'      // Dominator tree is correct
  | 'liveness_correct'        // Live variables are correct
  | 'reaching_defs_correct'   // Reaching definitions correct
  | 'loop_detected'           // Loop was identified
  | 'alias_analysis'          // Alias information correct
  | 'analysis_cached'         // Analysis was cached
  | 'analysis_invalidated'    // Analysis was properly invalidated
  | 'analysis_used'           // Optimization used analysis
  | 'custom';

/**
 * Analysis test result
 */
interface AnalysisTestResult {
  testId: string;
  passed: boolean;
  duration: number;
  analysisResults: AnalysisRunResult[];
  assertionResults: AssertionResult[];
  error?: Error;
}

/**
 * Individual analysis run result
 */
interface AnalysisRunResult {
  analysisName: string;
  duration: number;
  cached: boolean;
  dependenciesSatisfied: boolean;
}
```

---

## Implementation

### Analysis Test Runner

```typescript
/**
 * Integration test runner for analysis passes
 * 
 * Tests that analysis passes produce correct results and
 * integrate properly with optimization passes.
 */
export class AnalysisTestRunner {
  protected analysisManager: AnalysisManager;
  
  constructor() {
    this.analysisManager = new AnalysisManager();
  }
  
  /**
   * Run analysis integration test
   */
  async runTest(config: AnalysisTestConfig): Promise<AnalysisTestResult> {
    const startTime = Date.now();
    const analysisResults: AnalysisRunResult[] = [];
    
    try {
      // Reset analysis manager
      this.analysisManager.reset();
      
      // Run all analyses
      for (const spec of config.analyses) {
        const analysisStart = Date.now();
        const wasCached = this.analysisManager.isCached(spec.name);
        
        // Check dependencies
        const depsSatisfied = this.checkDependencies(spec, config.analyses);
        
        // Run analysis
        const analysis = new spec.analysisClass();
        const result = analysis.analyze(config.input);
        this.analysisManager.store(spec.name, result);
        
        analysisResults.push({
          analysisName: spec.name,
          duration: Date.now() - analysisStart,
          cached: wasCached,
          dependenciesSatisfied: depsSatisfied
        });
      }
      
      // Run optimizations if specified
      let optimizedProgram = config.input;
      if (config.optimizations) {
        for (const opt of config.optimizations) {
          const pass = new opt.passClass(opt.config);
          pass.setAnalysisManager(this.analysisManager);
          optimizedProgram = pass.run(optimizedProgram);
        }
      }
      
      // Run assertions
      const assertionResults = this.runAssertions(
        config.input,
        optimizedProgram,
        config.assertions,
        this.analysisManager
      );
      
      return {
        testId: config.testId,
        passed: assertionResults.every(r => r.passed),
        duration: Date.now() - startTime,
        analysisResults,
        assertionResults
      };
    } catch (error) {
      return {
        testId: config.testId,
        passed: false,
        duration: Date.now() - startTime,
        analysisResults,
        assertionResults: [],
        error: error as Error
      };
    }
  }
  
  /**
   * Check if analysis dependencies are satisfied
   */
  protected checkDependencies(spec: AnalysisSpec, allSpecs: AnalysisSpec[]): boolean {
    if (!spec.dependsOn) return true;
    
    for (const dep of spec.dependsOn) {
      if (!this.analysisManager.isCached(dep)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Run all assertions
   */
  protected runAssertions(
    input: ILProgram,
    output: ILProgram,
    assertions: AnalysisAssertion[],
    manager: AnalysisManager
  ): AssertionResult[] {
    return assertions.map(a => this.runAssertion(input, output, a, manager));
  }
  
  /**
   * Run single assertion
   */
  protected runAssertion(
    input: ILProgram,
    output: ILProgram,
    assertion: AnalysisAssertion,
    manager: AnalysisManager
  ): AssertionResult {
    try {
      switch (assertion.type) {
        case 'dominators_correct':
          return this.assertDominatorsCorrect(input, manager, assertion);
        
        case 'liveness_correct':
          return this.assertLivenessCorrect(input, manager, assertion);
        
        case 'reaching_defs_correct':
          return this.assertReachingDefsCorrect(input, manager, assertion);
        
        case 'loop_detected':
          return this.assertLoopDetected(input, manager, assertion);
        
        case 'analysis_cached':
          return this.assertAnalysisCached(manager, assertion);
        
        case 'analysis_used':
          return this.assertAnalysisUsed(input, output, manager, assertion);
        
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
   * Assert dominator analysis is correct
   */
  protected assertDominatorsCorrect(
    program: ILProgram,
    manager: AnalysisManager,
    assertion: AnalysisAssertion
  ): AssertionResult {
    const doms = manager.get<DominatorInfo>('dominators');
    if (!doms) {
      return {
        description: assertion.description,
        passed: false,
        message: 'Dominator analysis not found'
      };
    }
    
    // Verify entry dominates all blocks
    for (const block of program.blocks) {
      if (!doms.dominates(program.entry, block.label)) {
        return {
          description: assertion.description,
          passed: false,
          message: `Entry does not dominate ${block.label}`
        };
      }
    }
    
    // Verify reflexivity (block dominates itself)
    for (const block of program.blocks) {
      if (!doms.dominates(block.label, block.label)) {
        return {
          description: assertion.description,
          passed: false,
          message: `${block.label} does not dominate itself`
        };
      }
    }
    
    return { description: assertion.description, passed: true };
  }
  
  /**
   * Assert liveness analysis is correct
   */
  protected assertLivenessCorrect(
    program: ILProgram,
    manager: AnalysisManager,
    assertion: AnalysisAssertion
  ): AssertionResult {
    const liveness = manager.get<LivenessInfo>('liveness');
    if (!liveness) {
      return {
        description: assertion.description,
        passed: false,
        message: 'Liveness analysis not found'
      };
    }
    
    // Verify specific variable if provided
    const varName = assertion.params.variable as string | undefined;
    const blockLabel = assertion.params.block as string | undefined;
    const shouldBeLive = assertion.params.live as boolean;
    
    if (varName && blockLabel) {
      const isLive = liveness.isLiveOut(blockLabel, varName);
      if (isLive !== shouldBeLive) {
        return {
          description: assertion.description,
          passed: false,
          message: `Variable ${varName} ${shouldBeLive ? 'should be' : 'should not be'} live at ${blockLabel}`
        };
      }
    }
    
    return { description: assertion.description, passed: true };
  }
  
  /**
   * Assert reaching definitions analysis is correct
   */
  protected assertReachingDefsCorrect(
    program: ILProgram,
    manager: AnalysisManager,
    assertion: AnalysisAssertion
  ): AssertionResult {
    const reachingDefs = manager.get<ReachingDefsInfo>('reaching_definitions');
    if (!reachingDefs) {
      return {
        description: assertion.description,
        passed: false,
        message: 'Reaching definitions analysis not found'
      };
    }
    
    // Verify specific reaching definition if provided
    const varName = assertion.params.variable as string | undefined;
    const blockLabel = assertion.params.block as string | undefined;
    const expectedDefs = assertion.params.definitions as string[] | undefined;
    
    if (varName && blockLabel && expectedDefs) {
      const actualDefs = reachingDefs.getDefinitions(blockLabel, varName);
      const defsMatch = expectedDefs.every(d => actualDefs.includes(d)) &&
                       actualDefs.every(d => expectedDefs.includes(d));
      
      if (!defsMatch) {
        return {
          description: assertion.description,
          passed: false,
          message: `Reaching defs mismatch: expected [${expectedDefs}], got [${actualDefs}]`
        };
      }
    }
    
    return { description: assertion.description, passed: true };
  }
  
  /**
   * Assert loop was detected
   */
  protected assertLoopDetected(
    program: ILProgram,
    manager: AnalysisManager,
    assertion: AnalysisAssertion
  ): AssertionResult {
    const loops = manager.get<LoopInfo>('loops');
    if (!loops) {
      return {
        description: assertion.description,
        passed: false,
        message: 'Loop analysis not found'
      };
    }
    
    const headerBlock = assertion.params.header as string;
    const found = loops.getLoops().some(l => l.header === headerBlock);
    
    return {
      description: assertion.description,
      passed: found,
      message: found ? undefined : `Loop with header ${headerBlock} not found`
    };
  }
  
  /**
   * Assert analysis was cached
   */
  protected assertAnalysisCached(
    manager: AnalysisManager,
    assertion: AnalysisAssertion
  ): AssertionResult {
    const analysisName = assertion.params.analysis as string;
    const cached = manager.isCached(analysisName);
    
    return {
      description: assertion.description,
      passed: cached,
      message: cached ? undefined : `${analysisName} was not cached`
    };
  }
  
  /**
   * Assert analysis was used by optimization
   */
  protected assertAnalysisUsed(
    input: ILProgram,
    output: ILProgram,
    manager: AnalysisManager,
    assertion: AnalysisAssertion
  ): AssertionResult {
    const analysisName = assertion.params.analysis as string;
    const wasAccessed = manager.wasAccessed(analysisName);
    
    return {
      description: assertion.description,
      passed: wasAccessed,
      message: wasAccessed ? undefined : `${analysisName} was not accessed`
    };
  }
}
```

### Analysis Manager

```typescript
/**
 * Manages analysis results and caching
 */
export class AnalysisManager {
  protected cache: Map<string, unknown>;
  protected accessLog: Set<string>;
  
  constructor() {
    this.cache = new Map();
    this.accessLog = new Set();
  }
  
  store<T>(name: string, result: T): void {
    this.cache.set(name, result);
  }
  
  get<T>(name: string): T | undefined {
    this.accessLog.add(name);
    return this.cache.get(name) as T | undefined;
  }
  
  isCached(name: string): boolean {
    return this.cache.has(name);
  }
  
  wasAccessed(name: string): boolean {
    return this.accessLog.has(name);
  }
  
  invalidate(name: string): void {
    this.cache.delete(name);
  }
  
  reset(): void {
    this.cache.clear();
    this.accessLog.clear();
  }
}
```

---

## Usage Examples

### Testing Dominator Analysis

```typescript
const runner = new AnalysisTestRunner();

const result = await runner.runTest({
  testId: 'dominator_analysis',
  analyses: [
    { analysisClass: DominatorAnalysis, name: 'dominators' }
  ],
  input: diamondCFG,
  assertions: [
    {
      type: 'dominators_correct',
      params: {},
      description: 'Dominator tree is correct'
    }
  ]
});
```

### Testing Analysis Chain

```typescript
const result = await runner.runTest({
  testId: 'analysis_chain',
  analyses: [
    { analysisClass: DominatorAnalysis, name: 'dominators' },
    { analysisClass: LoopAnalysis, name: 'loops', dependsOn: ['dominators'] },
    { analysisClass: LivenessAnalysis, name: 'liveness' }
  ],
  input: loopProgram,
  assertions: [
    { type: 'loop_detected', params: { header: 'loop' }, description: 'Loop detected' },
    { type: 'analysis_cached', params: { analysis: 'dominators' }, description: 'Dominators cached' }
  ],
  optimizations: [
    { name: 'licm', passClass: LoopInvariantCodeMotion }
  ]
});
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| dom-analysis | Dominator analysis correct | ⏳ |
| liveness-analysis | Liveness analysis correct | ⏳ |
| reaching-defs | Reaching definitions correct | ⏳ |
| loop-detection | Loop detection correct | ⏳ |
| analysis-caching | Analysis results cached | ⏳ |
| analysis-invalidation | Invalidation works | ⏳ |
| analysis-chain | Multiple analyses work together | ⏳ |

---

## Task Checklist

- [ ] 11.2b.1: Implement `AnalysisTestRunner`
- [ ] 11.2b.2: Implement `AnalysisManager`
- [ ] 11.2b.3: Add analysis-specific assertions
- [ ] 11.2b.4: Create analysis correctness tests
- [ ] 11.2b.5: Create analysis chain tests
- [ ] 11.2b.6: Write unit tests for runner

---

## References

- **Related Documents**:
  - `11-02a1-integration-single.md` - Single pass tests
  - `11-02a2-integration-chain.md` - Chain tests
  - `02-analysis-passes.md` - Analysis passes