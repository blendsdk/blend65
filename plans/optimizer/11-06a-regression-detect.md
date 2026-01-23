# 11-06a: Regression Detection System

> **Document ID**: 11-06a-regression-detect
> **Phase**: 11 - Testing Framework
> **Task**: 11.6a - Regression detection system
> **Priority**: High
> **Estimated LOC**: 300-350

---

## Overview

This document specifies the regression detection system for identifying performance and correctness regressions in the optimizer. The system compares current results against historical baselines.

### Goals

1. Detect performance regressions automatically
2. Track correctness regressions
3. Identify pattern effectiveness changes
4. Monitor optimization quality over time
5. Generate detailed regression reports

---

## Type Definitions

```typescript
/**
 * Regression detection configuration
 */
interface RegressionConfig {
  /** Performance regression threshold (percentage) */
  performanceThreshold: number;
  /** Size regression threshold (percentage) */
  sizeThreshold: number;
  /** Cycle count threshold (percentage) */
  cycleThreshold: number;
  /** Fail on any regression */
  failOnRegression: boolean;
  /** Minimum sample size for significance */
  minSampleSize: number;
  /** Statistical confidence level */
  confidenceLevel: number;
}

/**
 * Regression detection result
 */
interface RegressionResult {
  /** Overall status */
  status: RegressionStatus;
  /** Detected regressions */
  regressions: Regression[];
  /** Improvements (optional) */
  improvements: Improvement[];
  /** Unchanged items */
  unchanged: string[];
  /** Missing baselines */
  missingBaselines: string[];
  /** Summary statistics */
  summary: RegressionSummary;
}

type RegressionStatus = 'pass' | 'fail' | 'warning';

/**
 * Individual regression
 */
interface Regression {
  /** Test/benchmark identifier */
  id: string;
  /** Regression type */
  type: RegressionType;
  /** Severity */
  severity: RegressionSeverity;
  /** Baseline value */
  baselineValue: number;
  /** Current value */
  currentValue: number;
  /** Change percentage */
  changePercent: number;
  /** Statistical significance */
  significant: boolean;
  /** Description */
  description: string;
  /** Context */
  context?: RegressionContext;
}

type RegressionType =
  | 'performance'     // Compilation time regression
  | 'cycles'          // Cycle count regression
  | 'size'            // Code size regression
  | 'correctness'     // Correctness failure
  | 'pattern'         // Pattern effectiveness
  | 'memory';         // Memory usage regression

type RegressionSeverity = 'critical' | 'major' | 'minor' | 'info';

/**
 * Regression context
 */
interface RegressionContext {
  /** Related patterns */
  patterns?: string[];
  /** Related passes */
  passes?: string[];
  /** Commit info */
  commit?: string;
  /** File changes */
  filesChanged?: string[];
}

/**
 * Improvement (inverse of regression)
 */
interface Improvement {
  id: string;
  type: RegressionType;
  baselineValue: number;
  currentValue: number;
  improvementPercent: number;
}

/**
 * Regression summary
 */
interface RegressionSummary {
  totalTests: number;
  regressions: number;
  improvements: number;
  unchanged: number;
  missingBaselines: number;
  averageChange: number;
  worstRegression?: Regression;
  bestImprovement?: Improvement;
}

/**
 * Baseline data
 */
interface BaselineData {
  /** Baseline version */
  version: string;
  /** Timestamp */
  timestamp: Date;
  /** Test results */
  results: Map<string, BaselineEntry>;
  /** Metadata */
  metadata: BaselineMetadata;
}

/**
 * Baseline entry
 */
interface BaselineEntry {
  /** Mean value */
  mean: number;
  /** Standard deviation */
  stdDev: number;
  /** Sample count */
  sampleCount: number;
  /** Raw values (optional) */
  values?: number[];
}

/**
 * Baseline metadata
 */
interface BaselineMetadata {
  gitCommit: string;
  gitBranch: string;
  nodeVersion: string;
  platform: string;
  optimizer: {
    version: string;
    patterns: number;
    passes: number;
  };
}
```

---

## Implementation

### Regression Detector

```typescript
/**
 * Detects regressions by comparing against baselines
 */
export class RegressionDetector {
  protected config: RegressionConfig;
  protected baseline: BaselineData | null = null;
  
  constructor(config: RegressionConfig) {
    this.config = config;
  }
  
  /**
   * Load baseline data
   */
  loadBaseline(data: BaselineData): void {
    this.baseline = data;
  }
  
  /**
   * Detect regressions in results
   */
  detect(
    currentResults: Map<string, TestResult>,
    type: RegressionType
  ): RegressionResult {
    if (!this.baseline) {
      return {
        status: 'warning',
        regressions: [],
        improvements: [],
        unchanged: [],
        missingBaselines: Array.from(currentResults.keys()),
        summary: this.createEmptySummary(currentResults.size)
      };
    }
    
    const regressions: Regression[] = [];
    const improvements: Improvement[] = [];
    const unchanged: string[] = [];
    const missingBaselines: string[] = [];
    
    for (const [id, current] of currentResults) {
      const baselineEntry = this.baseline.results.get(id);
      
      if (!baselineEntry) {
        missingBaselines.push(id);
        continue;
      }
      
      const analysis = this.analyzeChange(id, baselineEntry, current, type);
      
      if (analysis.isRegression) {
        regressions.push(analysis.regression!);
      } else if (analysis.isImprovement) {
        improvements.push(analysis.improvement!);
      } else {
        unchanged.push(id);
      }
    }
    
    const summary = this.calculateSummary(
      currentResults.size,
      regressions,
      improvements,
      unchanged,
      missingBaselines
    );
    
    const status = this.determineStatus(regressions);
    
    return {
      status,
      regressions,
      improvements,
      unchanged,
      missingBaselines,
      summary
    };
  }
  
  /**
   * Analyze change between baseline and current
   */
  protected analyzeChange(
    id: string,
    baseline: BaselineEntry,
    current: TestResult,
    type: RegressionType
  ): ChangeAnalysis {
    const threshold = this.getThreshold(type);
    const changePercent = ((current.value - baseline.mean) / baseline.mean) * 100;
    
    // Check statistical significance
    const significant = this.isStatisticallySignificant(
      baseline,
      current.value,
      current.samples || 1
    );
    
    // Determine if it's a regression (higher is worse for most metrics)
    const isHigherWorse = this.isHigherWorse(type);
    const isRegression = isHigherWorse 
      ? changePercent > threshold && significant
      : changePercent < -threshold && significant;
    
    const isImprovement = isHigherWorse
      ? changePercent < -threshold && significant
      : changePercent > threshold && significant;
    
    if (isRegression) {
      return {
        isRegression: true,
        isImprovement: false,
        regression: {
          id,
          type,
          severity: this.determineSeverity(Math.abs(changePercent)),
          baselineValue: baseline.mean,
          currentValue: current.value,
          changePercent,
          significant,
          description: this.createDescription(id, type, changePercent)
        }
      };
    }
    
    if (isImprovement) {
      return {
        isRegression: false,
        isImprovement: true,
        improvement: {
          id,
          type,
          baselineValue: baseline.mean,
          currentValue: current.value,
          improvementPercent: Math.abs(changePercent)
        }
      };
    }
    
    return { isRegression: false, isImprovement: false };
  }
  
  /**
   * Check statistical significance using t-test
   */
  protected isStatisticallySignificant(
    baseline: BaselineEntry,
    currentMean: number,
    currentSamples: number
  ): boolean {
    if (baseline.sampleCount < this.config.minSampleSize) {
      // Not enough samples, assume significant if threshold exceeded
      return true;
    }
    
    // Simplified t-test
    const pooledStdErr = baseline.stdDev / Math.sqrt(baseline.sampleCount);
    const tStatistic = Math.abs(currentMean - baseline.mean) / pooledStdErr;
    
    // Critical t-value for 95% confidence with large df
    const criticalT = 1.96;
    
    return tStatistic > criticalT;
  }
  
  /**
   * Get threshold for regression type
   */
  protected getThreshold(type: RegressionType): number {
    switch (type) {
      case 'performance':
        return this.config.performanceThreshold;
      case 'cycles':
        return this.config.cycleThreshold;
      case 'size':
        return this.config.sizeThreshold;
      case 'correctness':
        return 0; // Any correctness failure is a regression
      case 'memory':
        return this.config.performanceThreshold;
      case 'pattern':
        return this.config.cycleThreshold;
      default:
        return 5;
    }
  }
  
  /**
   * Determine if higher values are worse
   */
  protected isHigherWorse(type: RegressionType): boolean {
    switch (type) {
      case 'performance':
      case 'cycles':
      case 'size':
      case 'memory':
        return true; // Higher time/cycles/size/memory is worse
      case 'correctness':
      case 'pattern':
        return false; // Higher correctness/pattern effectiveness is better
      default:
        return true;
    }
  }
  
  /**
   * Determine severity based on change percentage
   */
  protected determineSeverity(changePercent: number): RegressionSeverity {
    if (changePercent > 50) return 'critical';
    if (changePercent > 20) return 'major';
    if (changePercent > 10) return 'minor';
    return 'info';
  }
  
  /**
   * Create human-readable description
   */
  protected createDescription(
    id: string,
    type: RegressionType,
    changePercent: number
  ): string {
    const direction = changePercent > 0 ? 'increased' : 'decreased';
    const absChange = Math.abs(changePercent).toFixed(1);
    
    const typeDescriptions: Record<RegressionType, string> = {
      performance: 'compilation time',
      cycles: 'cycle count',
      size: 'code size',
      correctness: 'correctness score',
      pattern: 'pattern effectiveness',
      memory: 'memory usage'
    };
    
    return `${id}: ${typeDescriptions[type]} ${direction} by ${absChange}%`;
  }
  
  /**
   * Determine overall status
   */
  protected determineStatus(regressions: Regression[]): RegressionStatus {
    if (regressions.length === 0) {
      return 'pass';
    }
    
    const hasCritical = regressions.some(r => r.severity === 'critical');
    const hasMajor = regressions.some(r => r.severity === 'major');
    
    if (this.config.failOnRegression && (hasCritical || hasMajor)) {
      return 'fail';
    }
    
    return hasCritical || hasMajor ? 'fail' : 'warning';
  }
  
  /**
   * Calculate summary statistics
   */
  protected calculateSummary(
    total: number,
    regressions: Regression[],
    improvements: Improvement[],
    unchanged: string[],
    missing: string[]
  ): RegressionSummary {
    const allChanges = [
      ...regressions.map(r => r.changePercent),
      ...improvements.map(i => -i.improvementPercent)
    ];
    
    const averageChange = allChanges.length > 0
      ? allChanges.reduce((a, b) => a + b, 0) / allChanges.length
      : 0;
    
    return {
      totalTests: total,
      regressions: regressions.length,
      improvements: improvements.length,
      unchanged: unchanged.length,
      missingBaselines: missing.length,
      averageChange,
      worstRegression: regressions.length > 0
        ? regressions.reduce((worst, r) => 
            Math.abs(r.changePercent) > Math.abs(worst.changePercent) ? r : worst
          )
        : undefined,
      bestImprovement: improvements.length > 0
        ? improvements.reduce((best, i) => 
            i.improvementPercent > best.improvementPercent ? i : best
          )
        : undefined
    };
  }
  
  /**
   * Create empty summary
   */
  protected createEmptySummary(total: number): RegressionSummary {
    return {
      totalTests: total,
      regressions: 0,
      improvements: 0,
      unchanged: 0,
      missingBaselines: total,
      averageChange: 0
    };
  }
}
```

---

### Baseline Manager

```typescript
/**
 * Manages baseline data storage and retrieval
 */
export class BaselineManager {
  protected storagePath: string;
  
  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }
  
  /**
   * Save baseline data
   */
  async saveBaseline(data: BaselineData): Promise<void> {
    const fs = await import('fs/promises');
    const json = JSON.stringify(data, (key, value) => {
      if (value instanceof Map) {
        return { __type: 'Map', entries: Array.from(value.entries()) };
      }
      return value;
    }, 2);
    
    await fs.writeFile(
      `${this.storagePath}/baseline-${data.version}.json`,
      json
    );
    
    // Also save as latest
    await fs.writeFile(
      `${this.storagePath}/baseline-latest.json`,
      json
    );
  }
  
  /**
   * Load baseline data
   */
  async loadBaseline(version?: string): Promise<BaselineData | null> {
    const fs = await import('fs/promises');
    const filename = version 
      ? `baseline-${version}.json` 
      : 'baseline-latest.json';
    
    try {
      const json = await fs.readFile(`${this.storagePath}/${filename}`, 'utf-8');
      return JSON.parse(json, (key, value) => {
        if (value && value.__type === 'Map') {
          return new Map(value.entries);
        }
        if (key === 'timestamp') {
          return new Date(value);
        }
        return value;
      });
    } catch {
      return null;
    }
  }
  
  /**
   * Create baseline from test results
   */
  createBaseline(
    results: Map<string, TestResult[]>,
    metadata: BaselineMetadata
  ): BaselineData {
    const entries = new Map<string, BaselineEntry>();
    
    for (const [id, samples] of results) {
      const values = samples.map(s => s.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, val) => 
        acc + Math.pow(val - mean, 2), 0
      ) / values.length;
      
      entries.set(id, {
        mean,
        stdDev: Math.sqrt(variance),
        sampleCount: values.length,
        values
      });
    }
    
    return {
      version: this.generateVersion(),
      timestamp: new Date(),
      results: entries,
      metadata
    };
  }
  
  /**
   * Generate version string
   */
  protected generateVersion(): string {
    const date = new Date();
    return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${Date.now() % 100000}`;
  }
}
```

---

## Usage Examples

```typescript
// Configure detector
const detector = new RegressionDetector({
  performanceThreshold: 10,
  sizeThreshold: 5,
  cycleThreshold: 5,
  failOnRegression: true,
  minSampleSize: 5,
  confidenceLevel: 0.95
});

// Load baseline
const manager = new BaselineManager('./baselines');
const baseline = await manager.loadBaseline();
if (baseline) {
  detector.loadBaseline(baseline);
}

// Run tests and detect regressions
const results = await runTestSuite();
const detection = detector.detect(results, 'cycles');

// Report results
if (detection.status === 'fail') {
  console.error('🚨 Regressions detected!');
  for (const reg of detection.regressions) {
    console.error(`  ${reg.severity}: ${reg.description}`);
  }
  process.exit(1);
}
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| regress-detect-simple | Simple regression detected | ⏳ |
| regress-significance | Statistical significance works | ⏳ |
| regress-baseline-save | Baseline saves correctly | ⏳ |
| regress-baseline-load | Baseline loads correctly | ⏳ |
| regress-improvement | Improvements tracked | ⏳ |

---

## Task Checklist

- [ ] 11.6a.1: Implement `RegressionDetector`
- [ ] 11.6a.2: Implement `BaselineManager`
- [ ] 11.6a.3: Add statistical significance testing
- [ ] 11.6a.4: Create regression reports
- [ ] 11.6a.5: Write unit tests

---

## References

- `11-06b-regression-ci.md`, `11-05a-bench-micro.md`, `11-05b-bench-macro.md`