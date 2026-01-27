# 11-05b: Macro Benchmarks

> **Document ID**: 11-05b-bench-macro
> **Phase**: 11 - Testing Framework
> **Task**: 11.5b - Macro benchmarks (program-level)
> **Priority**: High
> **Estimated LOC**: 300-350

---

## Overview

This document specifies macro-benchmarks for measuring optimizer performance at the program and pipeline level. These benchmarks test complete optimization workflows on realistic programs.

### Goals

1. Benchmark complete optimization pipeline
2. Measure end-to-end compilation time
3. Track optimization effectiveness on real programs
4. Compare different optimization levels
5. Monitor performance over time

---

## Type Definitions

```typescript
/**
 * Macro benchmark configuration
 */
interface MacroBenchmarkConfig {
  /** Number of iterations */
  iterations: number;
  /** Timeout per benchmark (ms) */
  timeout: number;
  /** Optimization levels to test */
  optimizationLevels: OptimizationLevel[];
  /** Collect detailed metrics */
  collectDetailedMetrics: boolean;
  /** Compare with baseline */
  compareBaseline: boolean;
}

type OptimizationLevel = 'none' | 'minimal' | 'standard' | 'aggressive';

/**
 * Macro benchmark result
 */
interface MacroBenchmarkResult {
  /** Benchmark identifier */
  benchmarkId: string;
  /** Program name */
  programName: string;
  /** Optimization level */
  optimizationLevel: OptimizationLevel;
  /** Compilation metrics */
  compilation: CompilationMetrics;
  /** Optimization metrics */
  optimization: OptimizationMetrics;
  /** Code quality metrics */
  quality: CodeQualityMetrics;
  /** Timing breakdown */
  phases: PhaseTimingBreakdown;
}

/**
 * Compilation metrics
 */
interface CompilationMetrics {
  /** Total compilation time (ms) */
  totalTime: number;
  /** Lines of source code */
  sourceLines: number;
  /** Compilation rate (lines/sec) */
  linesPerSecond: number;
  /** Peak memory usage (bytes) */
  peakMemory: number;
}

/**
 * Optimization metrics
 */
interface OptimizationMetrics {
  /** Total optimization passes */
  passCount: number;
  /** Fixed-point iterations */
  fixedPointIterations: number;
  /** Patterns applied */
  patternsApplied: number;
  /** Transformations made */
  transformations: number;
  /** Optimization time (ms) */
  optimizationTime: number;
}

/**
 * Code quality metrics
 */
interface CodeQualityMetrics {
  /** Original instruction count */
  originalInstructions: number;
  /** Optimized instruction count */
  optimizedInstructions: number;
  /** Instruction reduction percentage */
  instructionReduction: number;
  /** Original cycle count */
  originalCycles: number;
  /** Optimized cycle count */
  optimizedCycles: number;
  /** Cycle reduction percentage */
  cycleReduction: number;
  /** Original code size (bytes) */
  originalSize: number;
  /** Optimized code size (bytes) */
  optimizedSize: number;
  /** Size reduction percentage */
  sizeReduction: number;
}

/**
 * Phase timing breakdown
 */
interface PhaseTimingBreakdown {
  lexer: number;
  parser: number;
  semantic: number;
  ilGeneration: number;
  optimization: number;
  codeGeneration: number;
  emitter: number;
}

/**
 * Benchmark program definition
 */
interface BenchmarkProgram {
  /** Program name */
  name: string;
  /** Category */
  category: ProgramCategory;
  /** Source code or file path */
  source: string | { file: string };
  /** Expected characteristics */
  expected: ProgramCharacteristics;
}

type ProgramCategory =
  | 'minimal'       // Tiny programs
  | 'small'         // Small utilities
  | 'medium'        // Medium complexity
  | 'large'         // Large programs
  | 'complex'       // Complex algorithms
  | 'hardware'      // Hardware-intensive
  | 'real_world';   // Real-world examples

/**
 * Program characteristics
 */
interface ProgramCharacteristics {
  approximateLines: number;
  approximateFunctions: number;
  hasLoops: boolean;
  hasHardwareAccess: boolean;
  hasInterrupts: boolean;
}
```

---

## Implementation

### Macro Benchmark Runner

```typescript
/**
 * Runner for program-level benchmarks
 */
export class MacroBenchmarkRunner {
  protected config: MacroBenchmarkConfig;
  protected compiler: Blend65Compiler;
  protected baseline: Map<string, MacroBenchmarkResult> = new Map();
  
  constructor(config: MacroBenchmarkConfig) {
    this.config = config;
    this.compiler = new Blend65Compiler();
  }
  
  /**
   * Run benchmark on a program
   */
  async runBenchmark(program: BenchmarkProgram): Promise<MacroBenchmarkResult[]> {
    const results: MacroBenchmarkResult[] = [];
    
    for (const level of this.config.optimizationLevels) {
      const result = await this.benchmarkProgram(program, level);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Run benchmark suite
   */
  async runSuite(programs: BenchmarkProgram[]): Promise<BenchmarkSuiteReport> {
    const allResults: MacroBenchmarkResult[] = [];
    const startTime = Date.now();
    
    for (const program of programs) {
      const results = await this.runBenchmark(program);
      allResults.push(...results);
    }
    
    return {
      timestamp: new Date(),
      totalDuration: Date.now() - startTime,
      programCount: programs.length,
      results: allResults,
      summary: this.calculateSummary(allResults),
      comparison: this.config.compareBaseline 
        ? this.compareWithBaseline(allResults) 
        : undefined
    };
  }
  
  /**
   * Benchmark a single program at a specific optimization level
   */
  protected async benchmarkProgram(
    program: BenchmarkProgram,
    level: OptimizationLevel
  ): Promise<MacroBenchmarkResult> {
    const source = typeof program.source === 'string' 
      ? program.source 
      : await this.loadProgramFile(program.source.file);
    
    const measurements: BenchmarkMeasurement[] = [];
    
    // Run multiple iterations
    for (let i = 0; i < this.config.iterations; i++) {
      const measurement = await this.measureCompilation(source, level);
      measurements.push(measurement);
    }
    
    // Aggregate measurements
    return this.aggregateMeasurements(program.name, level, measurements);
  }
  
  /**
   * Measure single compilation
   */
  protected async measureCompilation(
    source: string,
    level: OptimizationLevel
  ): Promise<BenchmarkMeasurement> {
    // Force GC before measurement
    this.forceGC();
    const memBefore = process.memoryUsage().heapUsed;
    
    const phaseTimings: Partial<PhaseTimingBreakdown> = {};
    
    // Lexer phase
    let start = Date.now();
    const tokens = this.compiler.lex(source);
    phaseTimings.lexer = Date.now() - start;
    
    // Parser phase
    start = Date.now();
    const ast = this.compiler.parse(tokens);
    phaseTimings.parser = Date.now() - start;
    
    // Semantic phase
    start = Date.now();
    const analyzed = this.compiler.analyze(ast);
    phaseTimings.semantic = Date.now() - start;
    
    // IL generation phase
    start = Date.now();
    const il = this.compiler.generateIL(analyzed);
    phaseTimings.ilGeneration = Date.now() - start;
    
    // Get original metrics
    const originalMetrics = this.measureCode(il);
    
    // Optimization phase
    start = Date.now();
    const optimized = this.compiler.optimize(il, { level });
    phaseTimings.optimization = Date.now() - start;
    
    // Get optimized metrics
    const optimizedMetrics = this.measureCode(optimized.program);
    
    // Code generation phase
    start = Date.now();
    const asm = this.compiler.generateCode(optimized.program);
    phaseTimings.codeGeneration = Date.now() - start;
    
    // Emitter phase
    start = Date.now();
    const output = this.compiler.emit(asm, 'asm');
    phaseTimings.emitter = Date.now() - start;
    
    const memAfter = process.memoryUsage().heapUsed;
    
    return {
      phases: phaseTimings as PhaseTimingBreakdown,
      peakMemory: memAfter - memBefore,
      originalMetrics,
      optimizedMetrics,
      optimizationStats: optimized.stats,
      sourceLines: source.split('\n').length
    };
  }
  
  /**
   * Measure code metrics
   */
  protected measureCode(program: ILProgram): CodeMetrics {
    let instructions = 0;
    let cycles = 0;
    let size = 0;
    
    for (const block of program.blocks) {
      instructions += block.instructions.length;
      for (const instr of block.instructions) {
        cycles += this.estimateCycles(instr);
        size += this.estimateSize(instr);
      }
    }
    
    return { instructions, cycles, size };
  }
  
  /**
   * Estimate cycles for instruction
   */
  protected estimateCycles(instr: ILInstruction): number {
    // Simplified cycle estimation
    const baseCycles: Record<string, number> = {
      'MOV': 2,
      'ADD': 2,
      'SUB': 2,
      'MUL': 10,
      'DIV': 20,
      'LOAD': 4,
      'STORE': 4,
      'BR': 3,
      'BEQ': 3,
      'BNE': 3,
      'CALL': 6,
      'RET': 6,
      'NOP': 2
    };
    return baseCycles[instr.opcode] || 3;
  }
  
  /**
   * Estimate size for instruction
   */
  protected estimateSize(instr: ILInstruction): number {
    // Simplified size estimation
    const baseSizes: Record<string, number> = {
      'MOV': 2,
      'ADD': 2,
      'SUB': 2,
      'MUL': 3,
      'DIV': 3,
      'LOAD': 3,
      'STORE': 3,
      'BR': 3,
      'BEQ': 2,
      'BNE': 2,
      'CALL': 3,
      'RET': 1,
      'NOP': 1
    };
    return baseSizes[instr.opcode] || 2;
  }
  
  /**
   * Aggregate measurements
   */
  protected aggregateMeasurements(
    programName: string,
    level: OptimizationLevel,
    measurements: BenchmarkMeasurement[]
  ): MacroBenchmarkResult {
    const avgPhases = this.averagePhaseTimings(measurements.map(m => m.phases));
    const totalTime = Object.values(avgPhases).reduce((a, b) => a + b, 0);
    
    const firstMeasurement = measurements[0];
    const avgOriginal = this.averageCodeMetrics(measurements.map(m => m.originalMetrics));
    const avgOptimized = this.averageCodeMetrics(measurements.map(m => m.optimizedMetrics));
    
    return {
      benchmarkId: `${programName}_${level}`,
      programName,
      optimizationLevel: level,
      compilation: {
        totalTime,
        sourceLines: firstMeasurement.sourceLines,
        linesPerSecond: firstMeasurement.sourceLines / (totalTime / 1000),
        peakMemory: Math.max(...measurements.map(m => m.peakMemory))
      },
      optimization: {
        passCount: measurements[0].optimizationStats?.passCount || 0,
        fixedPointIterations: measurements[0].optimizationStats?.iterations || 0,
        patternsApplied: measurements[0].optimizationStats?.patternsApplied || 0,
        transformations: measurements[0].optimizationStats?.transformations || 0,
        optimizationTime: avgPhases.optimization
      },
      quality: {
        originalInstructions: avgOriginal.instructions,
        optimizedInstructions: avgOptimized.instructions,
        instructionReduction: ((avgOriginal.instructions - avgOptimized.instructions) / avgOriginal.instructions) * 100,
        originalCycles: avgOriginal.cycles,
        optimizedCycles: avgOptimized.cycles,
        cycleReduction: ((avgOriginal.cycles - avgOptimized.cycles) / avgOriginal.cycles) * 100,
        originalSize: avgOriginal.size,
        optimizedSize: avgOptimized.size,
        sizeReduction: ((avgOriginal.size - avgOptimized.size) / avgOriginal.size) * 100
      },
      phases: avgPhases
    };
  }
  
  /**
   * Average phase timings
   */
  protected averagePhaseTimings(timings: PhaseTimingBreakdown[]): PhaseTimingBreakdown {
    const n = timings.length;
    return {
      lexer: timings.reduce((a, t) => a + t.lexer, 0) / n,
      parser: timings.reduce((a, t) => a + t.parser, 0) / n,
      semantic: timings.reduce((a, t) => a + t.semantic, 0) / n,
      ilGeneration: timings.reduce((a, t) => a + t.ilGeneration, 0) / n,
      optimization: timings.reduce((a, t) => a + t.optimization, 0) / n,
      codeGeneration: timings.reduce((a, t) => a + t.codeGeneration, 0) / n,
      emitter: timings.reduce((a, t) => a + t.emitter, 0) / n
    };
  }
  
  /**
   * Average code metrics
   */
  protected averageCodeMetrics(metrics: CodeMetrics[]): CodeMetrics {
    const n = metrics.length;
    return {
      instructions: metrics.reduce((a, m) => a + m.instructions, 0) / n,
      cycles: metrics.reduce((a, m) => a + m.cycles, 0) / n,
      size: metrics.reduce((a, m) => a + m.size, 0) / n
    };
  }
  
  /**
   * Calculate summary
   */
  protected calculateSummary(results: MacroBenchmarkResult[]): BenchmarkSummary {
    const byLevel = new Map<OptimizationLevel, MacroBenchmarkResult[]>();
    
    for (const result of results) {
      const level = result.optimizationLevel;
      if (!byLevel.has(level)) {
        byLevel.set(level, []);
      }
      byLevel.get(level)!.push(result);
    }
    
    const levelSummaries: LevelSummary[] = [];
    
    for (const [level, levelResults] of byLevel) {
      levelSummaries.push({
        level,
        avgCompilationTime: levelResults.reduce((a, r) => a + r.compilation.totalTime, 0) / levelResults.length,
        avgInstructionReduction: levelResults.reduce((a, r) => a + r.quality.instructionReduction, 0) / levelResults.length,
        avgCycleReduction: levelResults.reduce((a, r) => a + r.quality.cycleReduction, 0) / levelResults.length,
        avgSizeReduction: levelResults.reduce((a, r) => a + r.quality.sizeReduction, 0) / levelResults.length
      });
    }
    
    return {
      totalPrograms: results.length / this.config.optimizationLevels.length,
      levelSummaries
    };
  }
  
  /**
   * Compare with baseline
   */
  protected compareWithBaseline(results: MacroBenchmarkResult[]): BaselineComparisonReport {
    const comparisons: MacroBaselineComparison[] = [];
    
    for (const result of results) {
      const baseline = this.baseline.get(result.benchmarkId);
      if (baseline) {
        comparisons.push({
          benchmarkId: result.benchmarkId,
          compilationTimeChange: ((result.compilation.totalTime - baseline.compilation.totalTime) / baseline.compilation.totalTime) * 100,
          instructionReductionChange: result.quality.instructionReduction - baseline.quality.instructionReduction,
          cycleReductionChange: result.quality.cycleReduction - baseline.quality.cycleReduction,
          sizeReductionChange: result.quality.sizeReduction - baseline.quality.sizeReduction,
          regression: result.quality.cycleReduction < baseline.quality.cycleReduction - 1
        });
      }
    }
    
    return {
      comparisonsCount: comparisons.length,
      regressions: comparisons.filter(c => c.regression).length,
      comparisons
    };
  }
  
  /**
   * Load program file
   */
  protected async loadProgramFile(path: string): Promise<string> {
    const fs = await import('fs/promises');
    return fs.readFile(path, 'utf-8');
  }
  
  /**
   * Force GC
   */
  protected forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }
  
  /**
   * Load baseline
   */
  loadBaseline(results: MacroBenchmarkResult[]): void {
    for (const result of results) {
      this.baseline.set(result.benchmarkId, result);
    }
  }
}
```

---

### Benchmark Programs

```typescript
/**
 * Standard benchmark programs
 */
export const BENCHMARK_PROGRAMS: BenchmarkProgram[] = [
  {
    name: 'empty_main',
    category: 'minimal',
    source: `function main(): void { }`,
    expected: { approximateLines: 1, approximateFunctions: 1, hasLoops: false, hasHardwareAccess: false, hasInterrupts: false }
  },
  {
    name: 'counter_loop',
    category: 'small',
    source: `
      @zp counter: byte;
      function main(): void {
        counter = 0;
        while (counter < 100) {
          counter = counter + 1;
        }
      }
    `,
    expected: { approximateLines: 10, approximateFunctions: 1, hasLoops: true, hasHardwareAccess: false, hasInterrupts: false }
  },
  {
    name: 'screen_fill',
    category: 'hardware',
    source: `
      @map screen at $0400: byte[1000];
      function main(): void {
        let i: word = 0;
        while (i < 1000) {
          screen[i] = 160;
          i = i + 1;
        }
      }
    `,
    expected: { approximateLines: 15, approximateFunctions: 1, hasLoops: true, hasHardwareAccess: true, hasInterrupts: false }
  },
  {
    name: 'multiply_8bit',
    category: 'complex',
    source: `
      function multiply(a: byte, b: byte): byte {
        let result: byte = 0;
        while (b > 0) {
          if ((b & 1) != 0) {
            result = result + a;
          }
          a = a << 1;
          b = b >> 1;
        }
        return result;
      }
      function main(): void {
        let x: byte = multiply(7, 6);
      }
    `,
    expected: { approximateLines: 20, approximateFunctions: 2, hasLoops: true, hasHardwareAccess: false, hasInterrupts: false }
  }
];
```

---

## Usage Examples

```typescript
// Create runner
const runner = new MacroBenchmarkRunner({
  iterations: 5,
  timeout: 30000,
  optimizationLevels: ['none', 'standard', 'aggressive'],
  collectDetailedMetrics: true,
  compareBaseline: true
});

// Run suite
const report = await runner.runSuite(BENCHMARK_PROGRAMS);

// Print summary
console.log(`Benchmarked ${report.programCount} programs`);
for (const summary of report.summary.levelSummaries) {
  console.log(`${summary.level}: ${summary.avgCycleReduction.toFixed(1)}% cycle reduction`);
}

// Check regressions
if (report.comparison?.regressions > 0) {
  console.error(`⚠️ ${report.comparison.regressions} performance regressions detected!`);
}
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| macro-compilation-time | Compilation time measured | ⏳ |
| macro-quality-metrics | Quality metrics accurate | ⏳ |
| macro-level-comparison | Levels compared correctly | ⏳ |
| macro-baseline-compare | Baseline comparison works | ⏳ |
| macro-regression-detect | Regressions detected | ⏳ |

---

## Task Checklist

- [ ] 11.5b.1: Implement `MacroBenchmarkRunner`
- [ ] 11.5b.2: Create benchmark programs
- [ ] 11.5b.3: Add metrics calculation
- [ ] 11.5b.4: Implement baseline comparison
- [ ] 11.5b.5: Write unit tests

---

## References

- `11-05a-bench-micro.md`, `11-03b2-e2e-full-pipeline.md`, `01-architecture.md`