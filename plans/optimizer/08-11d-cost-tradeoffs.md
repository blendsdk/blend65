# Task 8.11d: Size vs Speed Tradeoff Configuration

> **Task**: 8.11d of 12 (Peephole Phase - Cost Model)  
> **Time**: ~2 hours  
> **Tests**: ~30 tests  
> **Prerequisites**: Task 8.11c (Branch Cycle Analysis)

---

## Overview

Implement the configuration system for size vs speed tradeoffs in optimization decisions. Different use cases prioritize different metrics: game loops need speed, utility code needs small size, and library code may need balance. This task provides configurable weighting for optimization decisions.

---

## Directory Structure

```
packages/compiler/src/optimizer/cost/
├── index.ts              # Exports
├── types.ts              # Cost model types
├── cycle-table.ts        # Base cycle counts
├── instruction-cost.ts   # Per-instruction costing
├── cost-calculator.ts    # Total cost computation
├── memory-cost.ts        # Memory access costing
├── addressing-cost.ts    # Addressing mode analysis
├── page-analysis.ts      # Page boundary analysis
├── branch-cost.ts        # Branch cycle analysis
├── conditional-cost.ts   # Conditional sequence analysis
├── control-flow-cost.ts  # Control flow costing
├── tradeoff-config.ts    # Tradeoff configuration (THIS TASK)
├── weighted-cost.ts      # Weighted cost calculation (THIS TASK)
└── optimization-policy.ts # Optimization policies (THIS TASK)
```

---

## Implementation

### File: `tradeoff-config.ts`

```typescript
/**
 * Optimization priority configuration
 */
export interface TradeoffConfig {
  /** Weight for cycle savings (0-1) */
  readonly speedWeight: number;
  /** Weight for byte savings (0-1) */
  readonly sizeWeight: number;
  /** Minimum cycles saved to justify size increase */
  readonly minCyclesForSizeIncrease: number;
  /** Minimum bytes saved to justify cycle increase */
  readonly minBytesForCycleIncrease: number;
  /** Maximum acceptable size increase (bytes) */
  readonly maxSizeIncrease: number;
  /** Maximum acceptable cycle increase */
  readonly maxCycleIncrease: number;
}

/**
 * Predefined optimization profiles
 */
export enum OptimizationProfile {
  /** Maximum speed, ignore size */
  Speed = 'speed',
  /** Maximum size reduction, ignore speed */
  Size = 'size',
  /** Balanced optimization */
  Balanced = 'balanced',
  /** Favor speed but respect size limits */
  SpeedWithLimits = 'speed-with-limits',
  /** Favor size but respect speed limits */
  SizeWithLimits = 'size-with-limits',
  /** Custom configuration */
  Custom = 'custom',
}

/**
 * Predefined profile configurations
 */
export const PROFILE_CONFIGS: Record<OptimizationProfile, TradeoffConfig> = {
  [OptimizationProfile.Speed]: {
    speedWeight: 1.0,
    sizeWeight: 0.0,
    minCyclesForSizeIncrease: 0,
    minBytesForCycleIncrease: Infinity,
    maxSizeIncrease: Infinity,
    maxCycleIncrease: 0,
  },
  
  [OptimizationProfile.Size]: {
    speedWeight: 0.0,
    sizeWeight: 1.0,
    minCyclesForSizeIncrease: Infinity,
    minBytesForCycleIncrease: 0,
    maxSizeIncrease: 0,
    maxCycleIncrease: Infinity,
  },
  
  [OptimizationProfile.Balanced]: {
    speedWeight: 0.5,
    sizeWeight: 0.5,
    minCyclesForSizeIncrease: 2,
    minBytesForCycleIncrease: 2,
    maxSizeIncrease: 4,
    maxCycleIncrease: 2,
  },
  
  [OptimizationProfile.SpeedWithLimits]: {
    speedWeight: 0.8,
    sizeWeight: 0.2,
    minCyclesForSizeIncrease: 1,
    minBytesForCycleIncrease: 4,
    maxSizeIncrease: 8,
    maxCycleIncrease: 1,
  },
  
  [OptimizationProfile.SizeWithLimits]: {
    speedWeight: 0.2,
    sizeWeight: 0.8,
    minCyclesForSizeIncrease: 4,
    minBytesForCycleIncrease: 1,
    maxSizeIncrease: 2,
    maxCycleIncrease: 4,
  },
  
  [OptimizationProfile.Custom]: {
    speedWeight: 0.5,
    sizeWeight: 0.5,
    minCyclesForSizeIncrease: 2,
    minBytesForCycleIncrease: 2,
    maxSizeIncrease: 4,
    maxCycleIncrease: 2,
  },
};

/**
 * Manager for tradeoff configuration
 */
export class TradeoffConfigManager {
  protected config: TradeoffConfig;
  protected profile: OptimizationProfile;
  
  constructor(profile: OptimizationProfile = OptimizationProfile.Balanced) {
    this.profile = profile;
    this.config = { ...PROFILE_CONFIGS[profile] };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): TradeoffConfig {
    return this.config;
  }
  
  /**
   * Get current profile
   */
  getProfile(): OptimizationProfile {
    return this.profile;
  }
  
  /**
   * Set profile
   */
  setProfile(profile: OptimizationProfile): void {
    this.profile = profile;
    this.config = { ...PROFILE_CONFIGS[profile] };
  }
  
  /**
   * Set custom configuration
   */
  setCustomConfig(config: Partial<TradeoffConfig>): void {
    this.profile = OptimizationProfile.Custom;
    this.config = { ...PROFILE_CONFIGS[OptimizationProfile.Custom], ...config };
    this.validateConfig();
  }
  
  /**
   * Validate configuration values
   */
  protected validateConfig(): void {
    // Ensure weights sum to 1.0
    const totalWeight = this.config.speedWeight + this.config.sizeWeight;
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      // Normalize weights
      this.config = {
        ...this.config,
        speedWeight: this.config.speedWeight / totalWeight,
        sizeWeight: this.config.sizeWeight / totalWeight,
      };
    }
    
    // Clamp values to valid ranges
    this.config = {
      ...this.config,
      speedWeight: Math.max(0, Math.min(1, this.config.speedWeight)),
      sizeWeight: Math.max(0, Math.min(1, this.config.sizeWeight)),
      minCyclesForSizeIncrease: Math.max(0, this.config.minCyclesForSizeIncrease),
      minBytesForCycleIncrease: Math.max(0, this.config.minBytesForCycleIncrease),
      maxSizeIncrease: Math.max(0, this.config.maxSizeIncrease),
      maxCycleIncrease: Math.max(0, this.config.maxCycleIncrease),
    };
  }
  
  /**
   * Create config for specific code region
   */
  createRegionConfig(
    regionType: 'hot' | 'cold' | 'normal'
  ): TradeoffConfig {
    switch (regionType) {
      case 'hot':
        // Hot code: prioritize speed
        return {
          ...this.config,
          speedWeight: Math.min(1, this.config.speedWeight * 1.5),
          sizeWeight: this.config.sizeWeight * 0.5,
        };
      case 'cold':
        // Cold code: prioritize size
        return {
          ...this.config,
          speedWeight: this.config.speedWeight * 0.5,
          sizeWeight: Math.min(1, this.config.sizeWeight * 1.5),
        };
      default:
        return this.config;
    }
  }
}

/** Default tradeoff config manager */
export const tradeoffConfig = new TradeoffConfigManager();
```

### File: `weighted-cost.ts`

```typescript
import { TradeoffConfig, tradeoffConfig, TradeoffConfigManager } from './tradeoff-config.js';
import { CostComparison } from './types.js';

/**
 * Weighted cost score
 */
export interface WeightedScore {
  /** Combined score (higher = better optimization) */
  readonly score: number;
  /** Speed component of score */
  readonly speedComponent: number;
  /** Size component of score */
  readonly sizeComponent: number;
  /** Is this transformation acceptable? */
  readonly isAcceptable: boolean;
  /** Reason if not acceptable */
  readonly rejectReason?: string;
}

/**
 * Calculator for weighted cost comparisons
 */
export class WeightedCostCalculator {
  protected configManager: TradeoffConfigManager;
  
  constructor(manager: TradeoffConfigManager = tradeoffConfig) {
    this.configManager = manager;
  }
  
  /**
   * Calculate weighted score for a transformation
   */
  calculateScore(comparison: CostComparison): WeightedScore {
    const config = this.configManager.getConfig();
    
    // Check hard limits first
    const limitCheck = this.checkLimits(comparison, config);
    if (!limitCheck.passes) {
      return {
        score: -Infinity,
        speedComponent: 0,
        sizeComponent: 0,
        isAcceptable: false,
        rejectReason: limitCheck.reason,
      };
    }
    
    // Calculate weighted components
    const speedComponent = comparison.cyclesSaved * config.speedWeight;
    const sizeComponent = comparison.bytesSaved * config.sizeWeight;
    const score = speedComponent + sizeComponent;
    
    // Check if transformation is acceptable
    const isAcceptable = this.isTransformationAcceptable(comparison, config);
    
    return {
      score,
      speedComponent,
      sizeComponent,
      isAcceptable,
      rejectReason: isAcceptable ? undefined : 'Does not meet minimum requirements',
    };
  }
  
  /**
   * Compare two transformations
   */
  compareTransformations(
    a: CostComparison,
    b: CostComparison
  ): number {
    const scoreA = this.calculateScore(a);
    const scoreB = this.calculateScore(b);
    
    // Both acceptable: compare scores
    if (scoreA.isAcceptable && scoreB.isAcceptable) {
      return scoreB.score - scoreA.score;
    }
    
    // Only one acceptable: prefer it
    if (scoreA.isAcceptable) return -1;
    if (scoreB.isAcceptable) return 1;
    
    // Neither acceptable: compare scores anyway
    return scoreB.score - scoreA.score;
  }
  
  /**
   * Check if transformation meets hard limits
   */
  protected checkLimits(
    comparison: CostComparison,
    config: TradeoffConfig
  ): { passes: boolean; reason?: string } {
    // Check maximum size increase
    if (comparison.bytesSaved < 0) {
      const sizeIncrease = -comparison.bytesSaved;
      if (sizeIncrease > config.maxSizeIncrease) {
        return {
          passes: false,
          reason: `Size increase ${sizeIncrease} exceeds limit ${config.maxSizeIncrease}`,
        };
      }
      
      // Check if cycle savings justify size increase
      if (comparison.cyclesSaved < config.minCyclesForSizeIncrease) {
        return {
          passes: false,
          reason: `Cycle savings ${comparison.cyclesSaved} too small for size increase`,
        };
      }
    }
    
    // Check maximum cycle increase
    if (comparison.cyclesSaved < 0) {
      const cycleIncrease = -comparison.cyclesSaved;
      if (cycleIncrease > config.maxCycleIncrease) {
        return {
          passes: false,
          reason: `Cycle increase ${cycleIncrease} exceeds limit ${config.maxCycleIncrease}`,
        };
      }
      
      // Check if byte savings justify cycle increase
      if (comparison.bytesSaved < config.minBytesForCycleIncrease) {
        return {
          passes: false,
          reason: `Byte savings ${comparison.bytesSaved} too small for cycle increase`,
        };
      }
    }
    
    return { passes: true };
  }
  
  /**
   * Check if transformation is acceptable based on config
   */
  protected isTransformationAcceptable(
    comparison: CostComparison,
    config: TradeoffConfig
  ): boolean {
    // At least one metric should improve (or stay same)
    if (comparison.cyclesSaved < 0 && comparison.bytesSaved < 0) {
      return false; // Both got worse
    }
    
    // Calculate net benefit
    const netBenefit = 
      (comparison.cyclesSaved * config.speedWeight) +
      (comparison.bytesSaved * config.sizeWeight);
    
    return netBenefit > 0;
  }
  
  /**
   * Get minimum required improvement
   */
  getMinimumImprovement(): { cycles: number; bytes: number } {
    const config = this.configManager.getConfig();
    return {
      cycles: config.speedWeight > 0 ? 1 : 0,
      bytes: config.sizeWeight > 0 ? 1 : 0,
    };
  }
}

/** Default weighted cost calculator */
export const weightedCost = new WeightedCostCalculator();
```

### File: `optimization-policy.ts`

```typescript
import { TradeoffConfig, OptimizationProfile, tradeoffConfig, TradeoffConfigManager } from './tradeoff-config.js';
import { WeightedCostCalculator, weightedCost, WeightedScore } from './weighted-cost.js';
import { CostComparison } from './types.js';

/**
 * Optimization decision
 */
export interface OptimizationDecision {
  /** Should apply the optimization? */
  readonly apply: boolean;
  /** Score for this optimization */
  readonly score: WeightedScore;
  /** Priority (for ordering multiple optimizations) */
  readonly priority: number;
  /** Human-readable reason for decision */
  readonly reason: string;
}

/**
 * Region-specific optimization settings
 */
export interface RegionSettings {
  /** Region identifier */
  readonly regionId: string;
  /** Profile for this region */
  readonly profile: OptimizationProfile;
  /** Custom overrides */
  readonly overrides?: Partial<TradeoffConfig>;
}

/**
 * Policy manager for optimization decisions
 */
export class OptimizationPolicyManager {
  protected globalConfig: TradeoffConfigManager;
  protected weightedCalc: WeightedCostCalculator;
  protected regionSettings: Map<string, RegionSettings> = new Map();
  
  constructor(
    configManager: TradeoffConfigManager = tradeoffConfig,
    calculator: WeightedCostCalculator = weightedCost
  ) {
    this.globalConfig = configManager;
    this.weightedCalc = calculator;
  }
  
  /**
   * Make optimization decision
   */
  decide(
    comparison: CostComparison,
    regionId?: string
  ): OptimizationDecision {
    // Get appropriate config
    const config = this.getConfigForRegion(regionId);
    const tempManager = new TradeoffConfigManager();
    tempManager.setCustomConfig(config);
    const tempCalc = new WeightedCostCalculator(tempManager);
    
    // Calculate score
    const score = tempCalc.calculateScore(comparison);
    
    // Make decision
    const apply = score.isAcceptable && score.score > 0;
    const priority = this.calculatePriority(score, comparison);
    const reason = this.generateReason(score, comparison, apply);
    
    return {
      apply,
      score,
      priority,
      reason,
    };
  }
  
  /**
   * Rank multiple optimizations
   */
  rankOptimizations(
    comparisons: CostComparison[],
    regionId?: string
  ): Array<{ index: number; decision: OptimizationDecision }> {
    const decisions = comparisons.map((c, i) => ({
      index: i,
      decision: this.decide(c, regionId),
    }));
    
    // Sort by: applicable first, then by priority
    decisions.sort((a, b) => {
      if (a.decision.apply && !b.decision.apply) return -1;
      if (!a.decision.apply && b.decision.apply) return 1;
      return b.decision.priority - a.decision.priority;
    });
    
    return decisions;
  }
  
  /**
   * Set region-specific settings
   */
  setRegionSettings(settings: RegionSettings): void {
    this.regionSettings.set(settings.regionId, settings);
  }
  
  /**
   * Clear region settings
   */
  clearRegionSettings(regionId: string): void {
    this.regionSettings.delete(regionId);
  }
  
  /**
   * Get configuration for a region
   */
  protected getConfigForRegion(regionId?: string): TradeoffConfig {
    if (!regionId) {
      return this.globalConfig.getConfig();
    }
    
    const settings = this.regionSettings.get(regionId);
    if (!settings) {
      return this.globalConfig.getConfig();
    }
    
    // Start with profile config
    const baseConfig = { ...PROFILE_CONFIGS[settings.profile] };
    
    // Apply overrides
    return { ...baseConfig, ...settings.overrides };
  }
  
  /**
   * Calculate priority for ordering optimizations
   */
  protected calculatePriority(
    score: WeightedScore,
    comparison: CostComparison
  ): number {
    if (!score.isAcceptable) return -Infinity;
    
    // Base priority from score
    let priority = score.score * 100;
    
    // Bonus for improving both metrics
    if (comparison.cyclesSaved > 0 && comparison.bytesSaved > 0) {
      priority += 50;
    }
    
    // Bonus for significant improvements
    if (comparison.cyclesSaved >= 4) priority += 20;
    if (comparison.bytesSaved >= 2) priority += 10;
    
    // Penalty for any degradation
    if (comparison.cyclesSaved < 0) priority -= 30;
    if (comparison.bytesSaved < 0) priority -= 20;
    
    return priority;
  }
  
  /**
   * Generate human-readable reason
   */
  protected generateReason(
    score: WeightedScore,
    comparison: CostComparison,
    apply: boolean
  ): string {
    if (!apply) {
      if (score.rejectReason) {
        return `Rejected: ${score.rejectReason}`;
      }
      return 'Rejected: Net negative benefit';
    }
    
    const parts: string[] = [];
    
    if (comparison.cyclesSaved > 0) {
      parts.push(`saves ${comparison.cyclesSaved} cycles`);
    } else if (comparison.cyclesSaved < 0) {
      parts.push(`costs ${-comparison.cyclesSaved} cycles`);
    }
    
    if (comparison.bytesSaved > 0) {
      parts.push(`saves ${comparison.bytesSaved} bytes`);
    } else if (comparison.bytesSaved < 0) {
      parts.push(`costs ${-comparison.bytesSaved} bytes`);
    }
    
    return `Applied: ${parts.join(', ')} (score: ${score.score.toFixed(2)})`;
  }
}

// Import for PROFILE_CONFIGS reference
import { PROFILE_CONFIGS } from './tradeoff-config.js';

/** Default policy manager */
export const optimizationPolicy = new OptimizationPolicyManager();
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `tradeoff-config.getConfig` | Return correct profile config |
| `tradeoff-config.setProfile` | Switch between profiles |
| `tradeoff-config.setCustomConfig` | Custom configuration |
| `tradeoff-config.validateConfig` | Weight normalization |
| `tradeoff-config.createRegionConfig` | Hot/cold region configs |
| `weighted-cost.calculateScore` | Weighted score calculation |
| `weighted-cost.checkLimits` | Hard limit enforcement |
| `weighted-cost.compareTransformations` | Compare two options |
| `policy.decide` | Make optimization decision |
| `policy.rankOptimizations` | Order multiple options |
| `policy.setRegionSettings` | Region-specific config |
| `policy.generateReason` | Human-readable explanations |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `tradeoff-config.ts` | [ ] |
| Create `weighted-cost.ts` | [ ] |
| Create `optimization-policy.ts` | [ ] |
| Update `index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.12a → `08-12a-ordering-deps.md`