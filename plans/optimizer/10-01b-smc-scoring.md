# Task 10.1b: SMC Opportunity Scoring

> **Session**: 5.1b
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2-3 hours
> **Tests**: 20-25 unit tests
> **Prerequisites**: 10-01a2-smc-opportunity-id.md

---

## Overview

This document specifies the **SMC opportunity scoring system** that ranks identified opportunities to prioritize the most beneficial transformations.

### Why Scoring Matters

Not all SMC opportunities are equal. Scoring helps:
1. **Prioritize** high-value transformations
2. **Limit** total SMC to avoid code complexity
3. **Balance** speed vs size trade-offs
4. **Guide** developers on optimization impact

### Scoring Factors

```
┌─────────────────────────────────────────────────────────────┐
│                    SMC Scoring Factors                       │
├─────────────────────────────────────────────────────────────┤
│  Performance Impact (40%)                                    │
│  ├─ Cycles saved per execution                              │
│  ├─ Execution frequency (hot path bonus)                    │
│  └─ Break-even analysis                                     │
├─────────────────────────────────────────────────────────────┤
│  Resource Impact (30%)                                       │
│  ├─ Registers freed                                         │
│  ├─ Code size delta                                         │
│  └─ RAM usage for modification                              │
├─────────────────────────────────────────────────────────────┤
│  Risk Adjustment (20%)                                       │
│  ├─ Complexity penalty                                      │
│  ├─ Safety concerns                                         │
│  └─ Debug impact                                            │
├─────────────────────────────────────────────────────────────┤
│  Context Bonus (10%)                                         │
│  ├─ Loop nesting depth                                      │
│  ├─ Critical section presence                               │
│  └─ User hints (@smc annotations)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### Scoring Types

```typescript
/**
 * Complete score for an SMC opportunity
 */
interface SMCScore {
  /** The opportunity being scored */
  readonly opportunity: SMCOpportunity;
  
  /** Final composite score (0-100) */
  readonly finalScore: number;
  
  /** Individual component scores */
  readonly components: ScoreComponents;
  
  /** Ranking among all opportunities */
  readonly rank: number;
  
  /** Score tier classification */
  readonly tier: ScoreTier;
  
  /** Recommendation based on score */
  readonly recommendation: ScoreRecommendation;
}

/**
 * Individual scoring components
 */
interface ScoreComponents {
  /** Performance impact score (0-40) */
  readonly performance: PerformanceScore;
  
  /** Resource impact score (0-30) */
  readonly resource: ResourceScore;
  
  /** Risk adjustment score (-20 to 0) */
  readonly risk: RiskScore;
  
  /** Context bonus score (0-10) */
  readonly context: ContextScore;
}

/**
 * Performance scoring breakdown
 */
interface PerformanceScore {
  /** Total performance points (0-40) */
  readonly total: number;
  
  /** Cycles saved component */
  readonly cyclesSaved: number;
  
  /** Execution frequency component */
  readonly frequencyBonus: number;
  
  /** Break-even component */
  readonly breakEvenBonus: number;
}

/**
 * Resource scoring breakdown
 */
interface ResourceScore {
  /** Total resource points (0-30) */
  readonly total: number;
  
  /** Register pressure relief */
  readonly registerBonus: number;
  
  /** Code size impact */
  readonly sizeImpact: number;
  
  /** RAM efficiency */
  readonly ramEfficiency: number;
}

/**
 * Risk scoring breakdown
 */
interface RiskScore {
  /** Total risk penalty (-20 to 0) */
  readonly total: number;
  
  /** Complexity penalty */
  readonly complexityPenalty: number;
  
  /** Safety concern penalty */
  readonly safetyPenalty: number;
  
  /** Debug impact penalty */
  readonly debugPenalty: number;
}

/**
 * Context scoring breakdown
 */
interface ContextScore {
  /** Total context bonus (0-10) */
  readonly total: number;
  
  /** Loop depth bonus */
  readonly loopBonus: number;
  
  /** Critical section bonus */
  readonly criticalBonus: number;
  
  /** User hint bonus */
  readonly hintBonus: number;
}

/**
 * Score tier classification
 */
enum ScoreTier {
  /** Score 80-100: Highly recommended */
  EXCELLENT = 'excellent',
  
  /** Score 60-79: Recommended */
  GOOD = 'good',
  
  /** Score 40-59: Consider with caution */
  MODERATE = 'moderate',
  
  /** Score 20-39: Low priority */
  LOW = 'low',
  
  /** Score 0-19: Not recommended */
  MINIMAL = 'minimal'
}

/**
 * Score-based recommendation
 */
interface ScoreRecommendation {
  /** Should this SMC be applied? */
  readonly apply: boolean;
  
  /** Recommendation reason */
  readonly reason: string;
  
  /** Conditions for application */
  readonly conditions: string[];
  
  /** Alternative suggestions */
  readonly alternatives: string[];
}
```

### Scoring Configuration

```typescript
/**
 * Configuration for the scoring system
 */
interface SMCScoringConfig {
  /** Weight for performance component (default 0.4) */
  performanceWeight: number;
  
  /** Weight for resource component (default 0.3) */
  resourceWeight: number;
  
  /** Weight for risk component (default 0.2) */
  riskWeight: number;
  
  /** Weight for context component (default 0.1) */
  contextWeight: number;
  
  /** Minimum score to recommend (default 40) */
  recommendThreshold: number;
  
  /** Maximum SMC opportunities per function */
  maxPerFunction: number;
  
  /** Maximum total SMC opportunities */
  maxTotal: number;
  
  /** Optimization mode affects scoring */
  optimizationMode: 'speed' | 'size' | 'balanced';
}

/**
 * Default scoring configuration
 */
const DEFAULT_SCORING_CONFIG: SMCScoringConfig = {
  performanceWeight: 0.4,
  resourceWeight: 0.3,
  riskWeight: 0.2,
  contextWeight: 0.1,
  recommendThreshold: 40,
  maxPerFunction: 5,
  maxTotal: 20,
  optimizationMode: 'balanced'
};
```

---

## Implementation

### SMC Opportunity Scorer

```typescript
/**
 * Scores and ranks SMC opportunities
 * 
 * Evaluates each opportunity against multiple criteria to produce
 * a composite score used for prioritization and filtering.
 * 
 * @example
 * ```typescript
 * const scorer = new SMCOpportunityScorer(config);
 * const scores = scorer.scoreAll(opportunities);
 * const topOpportunities = scores.filter(s => s.tier === ScoreTier.EXCELLENT);
 * ```
 */
class SMCOpportunityScorer {
  /** Scoring configuration */
  protected readonly config: SMCScoringConfig;
  
  constructor(config: Partial<SMCScoringConfig> = {}) {
    this.config = { ...DEFAULT_SCORING_CONFIG, ...config };
  }
  
  /**
   * Score all opportunities and rank them
   */
  scoreAll(opportunities: SMCOpportunity[]): SMCScore[] {
    // Score each opportunity
    const scores = opportunities.map(opp => this.scoreOpportunity(opp));
    
    // Sort by final score descending
    scores.sort((a, b) => b.finalScore - a.finalScore);
    
    // Assign ranks
    for (let i = 0; i < scores.length; i++) {
      (scores[i] as any).rank = i + 1;
    }
    
    return scores;
  }
  
  /**
   * Score a single opportunity
   */
  scoreOpportunity(opportunity: SMCOpportunity): SMCScore {
    // Calculate component scores
    const performance = this.scorePerformance(opportunity);
    const resource = this.scoreResource(opportunity);
    const risk = this.scoreRisk(opportunity);
    const context = this.scoreContext(opportunity);
    
    // Calculate weighted final score
    const finalScore = this.calculateFinalScore(
      performance, resource, risk, context
    );
    
    // Determine tier
    const tier = this.determineTier(finalScore);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(
      opportunity, finalScore, tier
    );
    
    return {
      opportunity,
      finalScore,
      components: { performance, resource, risk, context },
      rank: 0, // Set by scoreAll
      tier,
      recommendation
    };
  }
  
  /**
   * Score performance impact
   */
  protected scorePerformance(opportunity: SMCOpportunity): PerformanceScore {
    const benefit = opportunity.benefit;
    const frequency = opportunity.frequency;
    
    // Cycles saved component (0-20 points)
    // 1 cycle = 1 point, max 20
    const cyclesSaved = Math.min(20, benefit.cyclesSaved * 2);
    
    // Frequency bonus (0-15 points)
    let frequencyBonus = 0;
    if (frequency.hotPath) {
      frequencyBonus = 15;
    } else if (typeof frequency.perFrame === 'number') {
      if (frequency.perFrame > 100) frequencyBonus = 12;
      else if (frequency.perFrame > 50) frequencyBonus = 8;
      else if (frequency.perFrame > 10) frequencyBonus = 4;
    }
    
    // Break-even bonus (0-5 points)
    // Lower break-even = higher bonus
    let breakEvenBonus = 0;
    if (benefit.breakEvenExecutions <= 1) breakEvenBonus = 5;
    else if (benefit.breakEvenExecutions <= 5) breakEvenBonus = 3;
    else if (benefit.breakEvenExecutions <= 10) breakEvenBonus = 1;
    
    const total = cyclesSaved + frequencyBonus + breakEvenBonus;
    
    return {
      total: Math.min(40, total),
      cyclesSaved,
      frequencyBonus,
      breakEvenBonus
    };
  }
  
  /**
   * Score resource impact
   */
  protected scoreResource(opportunity: SMCOpportunity): ResourceScore {
    const benefit = opportunity.benefit;
    
    // Register bonus (0-15 points)
    // Freeing a register is very valuable on 6502
    const registerBonus = benefit.registersFreed.length * 7;
    
    // Size impact (0-10 points)
    // Positive = saves bytes, negative = costs bytes
    let sizeImpact = 0;
    if (benefit.bytesDelta > 0) {
      sizeImpact = Math.min(10, benefit.bytesDelta * 2);
    } else if (benefit.bytesDelta < 0) {
      // Penalty for size increase (but not huge)
      sizeImpact = Math.max(-5, benefit.bytesDelta);
    }
    
    // Adjust for optimization mode
    if (this.config.optimizationMode === 'size') {
      sizeImpact *= 2; // Size matters more
    } else if (this.config.optimizationMode === 'speed') {
      sizeImpact *= 0.5; // Size matters less
    }
    
    // RAM efficiency (0-5 points)
    // Based on modification cost relative to benefit
    let ramEfficiency = 5;
    if (benefit.modificationCost > benefit.cyclesSaved * 10) {
      ramEfficiency = 0;
    } else if (benefit.modificationCost > benefit.cyclesSaved * 5) {
      ramEfficiency = 2;
    }
    
    const total = registerBonus + sizeImpact + ramEfficiency;
    
    return {
      total: Math.max(0, Math.min(30, total)),
      registerBonus: Math.min(15, registerBonus),
      sizeImpact,
      ramEfficiency
    };
  }
  
  /**
   * Score risk (penalty)
   */
  protected scoreRisk(opportunity: SMCOpportunity): RiskScore {
    const risk = opportunity.risk;
    
    // Complexity penalty (-10 to 0)
    let complexityPenalty = 0;
    if (opportunity.pattern.category === SMCPatternCategory.COMPOSITE) {
      complexityPenalty = -10;
    } else if (opportunity.pattern.category === SMCPatternCategory.OPCODE_MODIFICATION) {
      complexityPenalty = -5;
    }
    
    // Safety penalty (-8 to 0)
    let safetyPenalty = 0;
    if (risk.level === 'high') {
      safetyPenalty = -8;
    } else if (risk.level === 'medium') {
      safetyPenalty = -4;
    }
    
    // Debug penalty (-2 to 0)
    // SMC always has some debug impact
    const debugPenalty = -2;
    
    const total = complexityPenalty + safetyPenalty + debugPenalty;
    
    return {
      total: Math.max(-20, total),
      complexityPenalty,
      safetyPenalty,
      debugPenalty
    };
  }
  
  /**
   * Score context bonus
   */
  protected scoreContext(opportunity: SMCOpportunity): ContextScore {
    const pattern = opportunity.pattern;
    
    // Loop depth bonus (0-4 points)
    let loopBonus = 0;
    if (pattern.metadata.kind === 'loop_counter') {
      const loopMeta = pattern.metadata as LoopCounterMetadata;
      // Deeper loops = more iterations = more benefit
      // This is approximated by pattern confidence
      loopBonus = Math.min(4, Math.floor(pattern.confidence * 4));
    }
    
    // Critical section bonus (0-3 points)
    // If already in critical section, no interrupt overhead
    let criticalBonus = 0;
    if (opportunity.validation.interruptSafe) {
      criticalBonus = 3;
    }
    
    // User hint bonus (0-3 points)
    let hintBonus = 0;
    if (this.hasUserHint(pattern, 'prefer')) {
      hintBonus = 3;
    } else if (this.hasUserHint(pattern, 'allow')) {
      hintBonus = 1;
    } else if (this.hasUserHint(pattern, 'deny')) {
      hintBonus = -10; // Strong penalty for denied
    }
    
    const total = loopBonus + criticalBonus + hintBonus;
    
    return {
      total: Math.max(0, Math.min(10, total)),
      loopBonus,
      criticalBonus,
      hintBonus
    };
  }
  
  /**
   * Calculate weighted final score
   */
  protected calculateFinalScore(
    performance: PerformanceScore,
    resource: ResourceScore,
    risk: RiskScore,
    context: ContextScore
  ): number {
    const score = 
      performance.total * this.config.performanceWeight +
      resource.total * this.config.resourceWeight +
      (20 + risk.total) * this.config.riskWeight + // Convert -20..0 to 0..20
      context.total * this.config.contextWeight;
    
    // Normalize to 0-100
    return Math.max(0, Math.min(100, score * 2.5));
  }
  
  /**
   * Determine score tier
   */
  protected determineTier(score: number): ScoreTier {
    if (score >= 80) return ScoreTier.EXCELLENT;
    if (score >= 60) return ScoreTier.GOOD;
    if (score >= 40) return ScoreTier.MODERATE;
    if (score >= 20) return ScoreTier.LOW;
    return ScoreTier.MINIMAL;
  }
  
  /**
   * Generate recommendation
   */
  protected generateRecommendation(
    opportunity: SMCOpportunity,
    score: number,
    tier: ScoreTier
  ): ScoreRecommendation {
    const conditions: string[] = [];
    const alternatives: string[] = [];
    
    // Determine if should apply
    const apply = score >= this.config.recommendThreshold && 
                  opportunity.recommended;
    
    // Build reason
    let reason: string;
    if (tier === ScoreTier.EXCELLENT) {
      reason = 'Excellent candidate - high benefit, low risk';
    } else if (tier === ScoreTier.GOOD) {
      reason = 'Good candidate - solid benefit-to-risk ratio';
    } else if (tier === ScoreTier.MODERATE) {
      reason = 'Moderate candidate - consider if performance critical';
      conditions.push('Apply only in performance-critical code');
    } else if (tier === ScoreTier.LOW) {
      reason = 'Low priority - marginal benefit';
      alternatives.push('Consider manual optimization instead');
    } else {
      reason = 'Not recommended - insufficient benefit or high risk';
      alternatives.push('Use standard optimization techniques');
    }
    
    // Add conditions based on validation
    if (!opportunity.validation.interruptSafe) {
      conditions.push('Wrap in SEI/CLI if interrupts active');
    }
    
    return { apply, reason, conditions, alternatives };
  }
  
  /**
   * Check for user hint annotation
   */
  protected hasUserHint(pattern: SMCPattern, hint: string): boolean {
    // Check pattern metadata for @smc annotations
    const annotations = pattern.block.metadata?.annotations || [];
    return annotations.some(a => 
      a.name === 'smc' && 
      (a.args.includes(hint) || a.args[0] === hint)
    );
  }
}
```

---

## Blend65 Integration

### Score Report Output

```js
// blend65 compile --smc-scores game.bl65

/*
SMC Opportunity Scores for game.bl65
=====================================

Rank | Score | Tier      | Location        | Type          | Recommendation
-----|-------|-----------|-----------------|---------------|---------------
  1  |  87   | EXCELLENT | renderSprites   | LOOP_COUNTER  | APPLY
  2  |  72   | GOOD      | updatePhysics   | ADDR_MOD      | APPLY
  3  |  65   | GOOD      | processInput    | COMPUTED_JUMP | APPLY
  4  |  48   | MODERATE  | drawHUD         | LOOP_COUNTER  | CONDITIONAL
  5  |  31   | LOW       | initLevel       | LOOP_COUNTER  | SKIP
  6  |  15   | MINIMAL   | loadConfig      | CONST_INJECT  | SKIP

Score Breakdown for #1 (renderSprites):
  Performance: 35/40
    - Cycles saved: 18 (+18)
    - Frequency: hot path (+15)
    - Break-even: 2 iterations (+2)
  Resource: 22/30
    - Registers freed: X (+7)
    - Size: +3 bytes (+6)
    - RAM efficiency: +5
  Risk: -4/0
    - Complexity: simple (0)
    - Safety: medium (-4)
    - Debug: standard (-2)
  Context: 8/10
    - Loop depth: 2 (+4)
    - Critical: no (+0)
    - Hint: @smc(prefer) (+3)

Total SMC Opportunities: 6
Recommended for Application: 3
Estimated Cycle Savings: ~450/frame
*/
```

### Example Scored Code

```js
// Score: 87 - EXCELLENT
@smc(prefer)
function renderSprites(): void {
    for (let i: byte = 0; i < 8; i++) {
        let x = spriteX[i];
        let y = spriteY[i];
        pokeVIC($D000 + i * 2, x);
        pokeVIC($D001 + i * 2, y);
    }
}

// Score: 48 - MODERATE (conditional recommendation)
function drawHUD(): void {
    for (let i: byte = 0; i < 4; i++) {
        drawDigit(scoreDigits[i], 100 + i * 8);
    }
}

// Score: 15 - MINIMAL (not recommended)
function loadConfig(): void {
    // Only runs once at startup
    configValue = configTable[selectedOption];
}
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Performance Scoring | 5 | Cycles, frequency, break-even |
| Resource Scoring | 5 | Registers, size, RAM efficiency |
| Risk Scoring | 4 | Complexity, safety, debug penalties |
| Context Scoring | 4 | Loops, critical sections, hints |
| Final Calculation | 3 | Weight combinations, normalization |
| Tier Classification | 3 | Boundary values, tier assignment |

**Total: ~24 tests**

---

## Task Checklist

- [ ] Define SMCScore interface
- [ ] Define ScoreComponents interfaces
- [ ] Define ScoreTier enum
- [ ] Define ScoreRecommendation interface
- [ ] Implement SMCOpportunityScorer class
- [ ] Implement performance scoring
- [ ] Implement resource scoring
- [ ] Implement risk scoring
- [ ] Implement context scoring
- [ ] Implement final score calculation
- [ ] Implement recommendation generation
- [ ] Create comprehensive unit tests

---

## Next Document

**10-02a1-smc-loop-basic.md** - SMC basic loop unrolling patterns