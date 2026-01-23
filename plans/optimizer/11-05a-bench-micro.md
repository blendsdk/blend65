# 11-05a: Micro Benchmarks

> **Document ID**: 11-05a-bench-micro
> **Phase**: 11 - Testing Framework
> **Task**: 11.5a - Micro benchmarks (instruction-level)
> **Priority**: High
> **Estimated LOC**: 300-350

---

## Overview

This document specifies micro-benchmarks for measuring optimizer performance at the instruction and pattern level. These benchmarks provide fine-grained performance metrics for individual optimizations.

### Goals

1. Measure individual pattern performance
2. Track optimization pass timing
3. Benchmark instruction processing speed
4. Identify performance bottlenecks
5. Enable optimization comparisons

---

## Type Definitions

```typescript
/**
 * Micro benchmark configuration
 */
interface MicroBenchmarkConfig {
  /** Number of warmup iterations */
  warmupIterations: number;
  /** Number of measured iterations */
  measureIterations: number;
  /** Timeout per benchmark (ms) */
  timeout: number;
  /** Collect memory metrics */
  collectMemory: boolean;
  /** Statistical outlier removal */
  removeOutliers: boolean;
  /** Outlier threshold (std devs) */
  outlierThreshold: number;
}

/**
 * Benchmark result
 */
interface MicroBenchmarkResult {
  /** Benchmark identifier */
  benchmarkId: string;
  /** Category */
  category: BenchmarkCategory;
  /** Timing statistics */
  timing: TimingStats;
  /** Throughput metrics */
  throughput: ThroughputMetrics;
  /** Memory metrics (if collected) */
  memory?: MemoryMetrics;
  /** Raw measurements */
  rawData: number[];
}

type BenchmarkCategory =
  | 'pattern_match'       // Pattern matching speed
  | 'pattern_transform'   // Transformation speed
  | 'analysis_pass'       // Analysis pass speed
  | 'optimization_pass'   // Optimization pass speed
  | 'instruction_process' // Instruction processing
  | 'cfg_operation';      // CFG operations

/**
 * Timing statistics
 */
interface TimingStats {
  /** Mean time in microseconds */
  mean: number;
  /** Median time */
  median: number;
  /** Standard deviation */
  stdDev: number;
  /** Minimum time */
  min: number;
  /** Maximum time */
  max: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
}

/**
 * Throughput metrics
 */
interface ThroughputMetrics {
  /** Operations per second */
  opsPerSecond: number;
  /** Instructions per second */
  instructionsPerSecond: number;
  /** Patterns per second */
  patternsPerSecond?: number;
  /** Blocks per second */
  blocksPerSecond?: number;
}

/**
 * Memory metrics
 */
interface MemoryMetrics {
  /** Peak heap usage in bytes */
  peakHeap: number;
  /** Heap growth during benchmark */
  heapGrowth: number;
  /** Allocations count */
  allocations: number;
}

/**
 * Benchmark suite result
 */
interface BenchmarkSuiteResult {
  /** Suite name */
  suiteName: string;
  /** Individual results */
  results: MicroBenchmarkResult[];
  /** Total duration */
  totalDuration: number;
  /** Environment info */
  environment: EnvironmentInfo;
  /** Comparison with baseline (if available) */
  comparison?: BaselineComparison[];
}

/**
 * Environment information
 */
interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  cpuModel: string;
  memoryTotal: number;
  timestamp: Date;
}

/**
 * Baseline comparison
 */
interface BaselineComparison {
  benchmarkId: string;
  baselineMean: number;
  currentMean: number;
  changePercent: number;
  significant: boolean;
}
```

---

## Implementation

### Micro Benchmark Runner

```typescript
/**
 * Runner for micro-level benchmarks
 */
export class MicroBenchmarkRunner {
  protected config: MicroBenchmarkConfig;
  protected baseline: Map<string, number> = new Map();
  
  constructor(config: MicroBenchmarkConfig) {
    this.config = config;
  }
  
  /**
   * Run a single micro benchmark
   */
  async runBenchmark(
    id: string,
    category: BenchmarkCategory,
    setup: () => unknown,
    fn: (context: unknown) => void,
    teardown?: (context: unknown) => void
  ): Promise<MicroBenchmarkResult> {
    // Setup
    const context = setup();
    const measurements: number[] = [];
    
    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      fn(context);
    }
    
    // Force GC if available
    this.forceGC();
    
    // Measure
    const memBefore = this.config.collectMemory ? this.getMemoryUsage() : null;
    
    for (let i = 0; i < this.config.measureIterations; i++) {
      const start = this.getHighResTime();
      fn(context);
      const end = this.getHighResTime();
      measurements.push(end - start);
    }
    
    const memAfter = this.config.collectMemory ? this.getMemoryUsage() : null;
    
    // Teardown
    if (teardown) {
      teardown(context);
    }
    
    // Process results
    const filtered = this.config.removeOutliers 
      ? this.removeOutliers(measurements) 
      : measurements;
    
    const timing = this.calculateTimingStats(filtered);
    const throughput = this.calculateThroughput(timing.mean);
    const memory = memBefore && memAfter 
      ? this.calculateMemoryMetrics(memBefore, memAfter) 
      : undefined;
    
    return {
      benchmarkId: id,
      category,
      timing,
      throughput,
      memory,
      rawData: measurements
    };
  }
  
  /**
   * Run benchmark suite
   */
  async runSuite(
    suiteName: string,
    benchmarks: BenchmarkDefinition[]
  ): Promise<BenchmarkSuiteResult> {
    const startTime = Date.now();
    const results: MicroBenchmarkResult[] = [];
    
    for (const bench of benchmarks) {
      const result = await this.runBenchmark(
        bench.id,
        bench.category,
        bench.setup,
        bench.fn,
        bench.teardown
      );
      results.push(result);
    }
    
    // Calculate comparisons if baseline exists
    const comparisons = this.calculateComparisons(results);
    
    return {
      suiteName,
      results,
      totalDuration: Date.now() - startTime,
      environment: this.getEnvironmentInfo(),
      comparison: comparisons.length > 0 ? comparisons : undefined
    };
  }
  
  /**
   * Calculate timing statistics
   */
  protected calculateTimingStats(measurements: number[]): TimingStats {
    const sorted = [...measurements].sort((a, b) => a - b);
    const n = sorted.length;
    
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    
    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    return {
      mean: mean * 1000, // Convert to microseconds
      median: sorted[Math.floor(n / 2)] * 1000,
      stdDev: stdDev * 1000,
      min: sorted[0] * 1000,
      max: sorted[n - 1] * 1000,
      p95: sorted[Math.floor(n * 0.95)] * 1000,
      p99: sorted[Math.floor(n * 0.99)] * 1000
    };
  }
  
  /**
   * Calculate throughput metrics
   */
  protected calculateThroughput(meanMicros: number): ThroughputMetrics {
    const opsPerSecond = 1_000_000 / meanMicros;
    
    return {
      opsPerSecond,
      instructionsPerSecond: opsPerSecond, // Default 1:1
      patternsPerSecond: undefined,
      blocksPerSecond: undefined
    };
  }
  
  /**
   * Calculate memory metrics
   */
  protected calculateMemoryMetrics(
    before: NodeJS.MemoryUsage,
    after: NodeJS.MemoryUsage
  ): MemoryMetrics {
    return {
      peakHeap: after.heapUsed,
      heapGrowth: after.heapUsed - before.heapUsed,
      allocations: 0 // Would need V8 profiling
    };
  }
  
  /**
   * Remove statistical outliers
   */
  protected removeOutliers(measurements: number[]): number[] {
    const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const stdDev = Math.sqrt(
      measurements.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / measurements.length
    );
    
    const threshold = this.config.outlierThreshold * stdDev;
    
    return measurements.filter(m => Math.abs(m - mean) <= threshold);
  }
  
  /**
   * Get high resolution time in milliseconds
   */
  protected getHighResTime(): number {
    const [seconds, nanoseconds] = process.hrtime();
    return seconds * 1000 + nanoseconds / 1_000_000;
  }
  
  /**
   * Get memory usage
   */
  protected getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }
  
  /**
   * Force garbage collection
   */
  protected forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }
  
  /**
   * Get environment info
   */
  protected getEnvironmentInfo(): EnvironmentInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      cpuModel: 'Unknown', // Would need os module
      memoryTotal: process.memoryUsage().heapTotal,
      timestamp: new Date()
    };
  }
  
  /**
   * Load baseline
   */
  loadBaseline(data: Map<string, number>): void {
    this.baseline = data;
  }
  
  /**
   * Save current results as baseline
   */
  saveBaseline(results: MicroBenchmarkResult[]): Map<string, number> {
    const baseline = new Map<string, number>();
    for (const result of results) {
      baseline.set(result.benchmarkId, result.timing.mean);
    }
    return baseline;
  }
  
  /**
   * Calculate comparisons with baseline
   */
  protected calculateComparisons(results: MicroBenchmarkResult[]): BaselineComparison[] {
    const comparisons: BaselineComparison[] = [];
    
    for (const result of results) {
      const baselineValue = this.baseline.get(result.benchmarkId);
      if (baselineValue !== undefined) {
        const changePercent = ((result.timing.mean - baselineValue) / baselineValue) * 100;
        comparisons.push({
          benchmarkId: result.benchmarkId,
          baselineMean: baselineValue,
          currentMean: result.timing.mean,
          changePercent,
          significant: Math.abs(changePercent) > 5
        });
      }
    }
    
    return comparisons;
  }
}
```

---

### Pattern Micro Benchmarks

```typescript
/**
 * Micro benchmarks for peephole patterns
 */
export class PatternMicroBenchmarks {
  protected runner: MicroBenchmarkRunner;
  protected matcher: PatternMatcher;
  
  constructor(runner: MicroBenchmarkRunner) {
    this.runner = runner;
    this.matcher = new PatternMatcher();
  }
  
  /**
   * Create pattern matching benchmarks
   */
  createPatternMatchBenchmarks(): BenchmarkDefinition[] {
    return [
      {
        id: 'pattern_match_load_store',
        category: 'pattern_match',
        setup: () => this.createLoadStoreSequence(100),
        fn: (seq) => this.matcher.findMatches(seq as Asm6502Instruction[])
      },
      {
        id: 'pattern_match_arithmetic',
        category: 'pattern_match',
        setup: () => this.createArithmeticSequence(100),
        fn: (seq) => this.matcher.findMatches(seq as Asm6502Instruction[])
      },
      {
        id: 'pattern_match_transfer',
        category: 'pattern_match',
        setup: () => this.createTransferSequence(100),
        fn: (seq) => this.matcher.findMatches(seq as Asm6502Instruction[])
      },
      {
        id: 'pattern_match_branch',
        category: 'pattern_match',
        setup: () => this.createBranchSequence(100),
        fn: (seq) => this.matcher.findMatches(seq as Asm6502Instruction[])
      },
      {
        id: 'pattern_match_mixed',
        category: 'pattern_match',
        setup: () => this.createMixedSequence(100),
        fn: (seq) => this.matcher.findMatches(seq as Asm6502Instruction[])
      }
    ];
  }
  
  /**
   * Create pattern transformation benchmarks
   */
  createPatternTransformBenchmarks(): BenchmarkDefinition[] {
    return [
      {
        id: 'pattern_transform_redundant_load',
        category: 'pattern_transform',
        setup: () => ({
          seq: this.createRedundantLoadSequence(),
          match: { patternId: 'redundant_load', startIndex: 0, endIndex: 2 }
        }),
        fn: (ctx: { seq: Asm6502Instruction[], match: PatternMatch }) =>
          this.matcher.applyTransformation(ctx.seq, ctx.match)
      },
      {
        id: 'pattern_transform_consecutive_flag',
        category: 'pattern_transform',
        setup: () => ({
          seq: this.createConsecutiveFlagSequence(),
          match: { patternId: 'consecutive_clc', startIndex: 0, endIndex: 2 }
        }),
        fn: (ctx: { seq: Asm6502Instruction[], match: PatternMatch }) =>
          this.matcher.applyTransformation(ctx.seq, ctx.match)
      }
    ];
  }
  
  /**
   * Create sequence generators
   */
  protected createLoadStoreSequence(length: number): Asm6502Instruction[] {
    const seq: Asm6502Instruction[] = [];
    for (let i = 0; i < length; i++) {
      seq.push({ opcode: i % 2 === 0 ? 'LDA' : 'STA', addressingMode: 'zeropage', operand: i % 256 });
    }
    return seq;
  }
  
  protected createArithmeticSequence(length: number): Asm6502Instruction[] {
    const seq: Asm6502Instruction[] = [];
    const ops = ['ADC', 'SBC', 'INC', 'DEC'];
    for (let i = 0; i < length; i++) {
      seq.push({ opcode: ops[i % ops.length], addressingMode: 'immediate', operand: i % 256 });
    }
    return seq;
  }
  
  protected createTransferSequence(length: number): Asm6502Instruction[] {
    const seq: Asm6502Instruction[] = [];
    const ops = ['TAX', 'TXA', 'TAY', 'TYA'];
    for (let i = 0; i < length; i++) {
      seq.push({ opcode: ops[i % ops.length], addressingMode: 'implied' });
    }
    return seq;
  }
  
  protected createBranchSequence(length: number): Asm6502Instruction[] {
    const seq: Asm6502Instruction[] = [];
    const ops = ['BEQ', 'BNE', 'BCS', 'BCC'];
    for (let i = 0; i < length; i++) {
      seq.push({ opcode: ops[i % ops.length], addressingMode: 'relative', operand: `label_${i}` });
    }
    return seq;
  }
  
  protected createMixedSequence(length: number): Asm6502Instruction[] {
    const seq: Asm6502Instruction[] = [];
    const templates = [
      { opcode: 'LDA', addressingMode: 'immediate' as AddressingMode, operand: 0 },
      { opcode: 'ADC', addressingMode: 'zeropage' as AddressingMode, operand: 0x10 },
      { opcode: 'STA', addressingMode: 'absolute' as AddressingMode, operand: 0x0400 },
      { opcode: 'TAX', addressingMode: 'implied' as AddressingMode },
      { opcode: 'BNE', addressingMode: 'relative' as AddressingMode, operand: 'loop' }
    ];
    for (let i = 0; i < length; i++) {
      seq.push({ ...templates[i % templates.length] });
    }
    return seq;
  }
  
  protected createRedundantLoadSequence(): Asm6502Instruction[] {
    return [
      { opcode: 'LDA', addressingMode: 'zeropage', operand: 0x10 },
      { opcode: 'LDA', addressingMode: 'zeropage', operand: 0x10 }
    ];
  }
  
  protected createConsecutiveFlagSequence(): Asm6502Instruction[] {
    return [
      { opcode: 'CLC', addressingMode: 'implied' },
      { opcode: 'CLC', addressingMode: 'implied' }
    ];
  }
}
```

---

### Analysis Micro Benchmarks

```typescript
/**
 * Micro benchmarks for analysis passes
 */
export class AnalysisMicroBenchmarks {
  protected runner: MicroBenchmarkRunner;
  
  constructor(runner: MicroBenchmarkRunner) {
    this.runner = runner;
  }
  
  /**
   * Create analysis benchmarks
   */
  createAnalysisBenchmarks(): BenchmarkDefinition[] {
    return [
      {
        id: 'analysis_dominator_small',
        category: 'analysis_pass',
        setup: () => this.createCFG(10),
        fn: (cfg) => new DominatorAnalysis().analyze(cfg as CFG)
      },
      {
        id: 'analysis_dominator_medium',
        category: 'analysis_pass',
        setup: () => this.createCFG(50),
        fn: (cfg) => new DominatorAnalysis().analyze(cfg as CFG)
      },
      {
        id: 'analysis_dominator_large',
        category: 'analysis_pass',
        setup: () => this.createCFG(200),
        fn: (cfg) => new DominatorAnalysis().analyze(cfg as CFG)
      },
      {
        id: 'analysis_liveness_small',
        category: 'analysis_pass',
        setup: () => this.createCFG(10),
        fn: (cfg) => new LivenessAnalysis().analyze(cfg as CFG)
      },
      {
        id: 'analysis_liveness_medium',
        category: 'analysis_pass',
        setup: () => this.createCFG(50),
        fn: (cfg) => new LivenessAnalysis().analyze(cfg as CFG)
      },
      {
        id: 'analysis_reaching_defs_small',
        category: 'analysis_pass',
        setup: () => this.createCFG(10),
        fn: (cfg) => new ReachingDefinitionsAnalysis().analyze(cfg as CFG)
      },
      {
        id: 'analysis_reaching_defs_medium',
        category: 'analysis_pass',
        setup: () => this.createCFG(50),
        fn: (cfg) => new ReachingDefinitionsAnalysis().analyze(cfg as CFG)
      }
    ];
  }
  
  /**
   * Create CFG for benchmarking
   */
  protected createCFG(blockCount: number): CFG {
    const blocks: BasicBlock[] = [];
    
    for (let i = 0; i < blockCount; i++) {
      const instructionCount = 5 + (i % 10);
      const instructions: ILInstruction[] = [];
      
      for (let j = 0; j < instructionCount; j++) {
        instructions.push({
          opcode: 'MOV',
          dest: { kind: 'var', name: `v${j}` },
          operands: [{ kind: 'imm', value: j }]
        });
      }
      
      // Add terminator
      if (i === blockCount - 1) {
        instructions.push({ opcode: 'RET', operands: [] });
      } else if (i % 3 === 0 && i + 2 < blockCount) {
        instructions.push({
          opcode: 'BEQ',
          operands: [
            { kind: 'label', name: `block_${i + 1}` },
            { kind: 'label', name: `block_${i + 2}` }
          ]
        });
      } else {
        instructions.push({
          opcode: 'BR',
          operands: [{ kind: 'label', name: `block_${i + 1}` }]
        });
      }
      
      blocks.push({ label: `block_${i}`, instructions });
    }
    
    return { entryBlock: 'block_0', blocks };
  }
}
```

---

## Usage Examples

```typescript
// Create runner with config
const runner = new MicroBenchmarkRunner({
  warmupIterations: 100,
  measureIterations: 1000,
  timeout: 10000,
  collectMemory: true,
  removeOutliers: true,
  outlierThreshold: 2.5
});

// Run pattern benchmarks
const patternBench = new PatternMicroBenchmarks(runner);
const patternResult = await runner.runSuite(
  'Pattern Micro Benchmarks',
  [
    ...patternBench.createPatternMatchBenchmarks(),
    ...patternBench.createPatternTransformBenchmarks()
  ]
);

// Report results
for (const result of patternResult.results) {
  console.log(`${result.benchmarkId}: ${result.timing.mean.toFixed(2)}µs ±${result.timing.stdDev.toFixed(2)}`);
}
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| bench-timing-accuracy | Timing measurements accurate | ⏳ |
| bench-outlier-removal | Outliers removed correctly | ⏳ |
| bench-baseline-compare | Baseline comparison works | ⏳ |
| bench-memory-tracking | Memory metrics collected | ⏳ |
| bench-suite-execution | Full suite runs | ⏳ |

---

## Task Checklist

- [ ] 11.5a.1: Implement `MicroBenchmarkRunner`
- [ ] 11.5a.2: Implement `PatternMicroBenchmarks`
- [ ] 11.5a.3: Implement `AnalysisMicroBenchmarks`
- [ ] 11.5a.4: Add baseline comparison
- [ ] 11.5a.5: Write unit tests

---

## References

- `11-05b-bench-macro.md`, `08-02-pattern-matcher.md`, `02-analysis-passes.md`