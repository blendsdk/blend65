# Task 10.1a2: SMC Opportunity Identification

> **Session**: 5.1a2
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2-3 hours
> **Tests**: 20-25 unit tests
> **Prerequisites**: 10-01a1-smc-pattern-detect.md

---

## Overview

This document specifies the **SMC opportunity identification system** that analyzes detected patterns and determines which represent genuine optimization opportunities.

### Identification vs Detection

- **Detection** (10-01a1): Finds potential SMC patterns structurally
- **Identification** (this doc): Validates patterns are actually beneficial

### Identification Criteria

```
┌─────────────────────────────────────────────────────────────┐
│              SMC Opportunity Validation Criteria             │
├─────────────────────────────────────────────────────────────┤
│  1. Location Validity   - Code must be in RAM (not ROM)     │
│  2. Safety Analysis     - No aliasing/race conditions       │
│  3. Benefit Analysis    - Cycles saved > modification cost  │
│  4. Frequency Analysis  - Hot path vs cold path             │
│  5. Register Pressure   - SMC frees registers when needed   │
└─────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### Opportunity Types

```typescript
/**
 * A validated SMC opportunity ready for scoring
 */
interface SMCOpportunity {
  /** Original detected pattern */
  readonly pattern: SMCPattern;
  
  /** Unique opportunity identifier */
  readonly id: string;
  
  /** Validation results */
  readonly validation: OpportunityValidation;
  
  /** Benefit analysis results */
  readonly benefit: BenefitAnalysis;
  
  /** Risk assessment */
  readonly risk: RiskAssessment;
  
  /** Estimated execution frequency */
  readonly frequency: ExecutionFrequency;
  
  /** Whether this opportunity is recommended */
  readonly recommended: boolean;
}

/**
 * Validation results for an opportunity
 */
interface OpportunityValidation {
  /** Is the code located in RAM? */
  readonly inRAM: boolean;
  
  /** RAM region containing the code */
  readonly ramRegion: AddressRange | null;
  
  /** Are there any aliasing concerns? */
  readonly aliasingSafe: boolean;
  
  /** Aliasing issues if any */
  readonly aliasingIssues: AliasingIssue[];
  
  /** Is the modification thread/interrupt safe? */
  readonly interruptSafe: boolean;
  
  /** Overall validation passed */
  readonly valid: boolean;
  
  /** Validation failure reasons */
  readonly failureReasons: string[];
}

/**
 * Benefit analysis for applying SMC
 */
interface BenefitAnalysis {
  /** Cycles saved per execution */
  readonly cyclesSaved: number;
  
  /** Cycles cost for modification */
  readonly modificationCost: number;
  
  /** Net cycles saved (per invocation) */
  readonly netCyclesSaved: number;
  
  /** Bytes saved (negative = bytes added) */
  readonly bytesDelta: number;
  
  /** Registers freed */
  readonly registersFreed: Register[];
  
  /** Break-even point (executions needed) */
  readonly breakEvenExecutions: number;
}

/**
 * Risk assessment for SMC transformation
 */
interface RiskAssessment {
  /** Overall risk level */
  readonly level: 'low' | 'medium' | 'high';
  
  /** Individual risk factors */
  readonly factors: RiskFactor[];
  
  /** Mitigations available */
  readonly mitigations: Mitigation[];
}

/**
 * Individual risk factor
 */
interface RiskFactor {
  /** Risk type */
  readonly type: RiskType;
  
  /** Description */
  readonly description: string;
  
  /** Severity (1-10) */
  readonly severity: number;
}

/**
 * Types of risks in SMC
 */
enum RiskType {
  /** Code may be in ROM at runtime */
  ROM_EXECUTION = 'rom_execution',
  
  /** Interrupt may fire during modification */
  INTERRUPT_RACE = 'interrupt_race',
  
  /** Multiple code paths modify same location */
  WRITE_CONFLICT = 'write_conflict',
  
  /** Modified instruction may be cached */
  INSTRUCTION_CACHE = 'instruction_cache',
  
  /** Modification visible to debugger */
  DEBUG_CONFUSION = 'debug_confusion'
}

/**
 * Execution frequency estimation
 */
interface ExecutionFrequency {
  /** Estimated executions per frame */
  readonly perFrame: number | 'unknown';
  
  /** Estimated total executions */
  readonly total: number | 'unknown';
  
  /** Is this in a hot path? */
  readonly hotPath: boolean;
  
  /** Frequency source */
  readonly source: 'profile' | 'static' | 'heuristic';
}
```

### Identification Context

```typescript
/**
 * Context for opportunity identification
 */
interface IdentificationContext {
  /** Detected patterns to analyze */
  readonly patterns: SMCPattern[];
  
  /** Memory map information */
  readonly memoryMap: MemoryMap;
  
  /** Interrupt analysis results */
  readonly interruptInfo: InterruptAnalysis;
  
  /** Profile data if available */
  readonly profileData: ProfileData | null;
  
  /** Configuration options */
  readonly config: SMCIdentificationConfig;
}

/**
 * Memory map for the target platform
 */
interface MemoryMap {
  /** RAM regions */
  readonly ramRegions: AddressRange[];
  
  /** ROM regions */
  readonly romRegions: AddressRange[];
  
  /** I/O regions */
  readonly ioRegions: AddressRange[];
  
  /** Check if address is in RAM */
  isRAM(address: number): boolean;
  
  /** Get region containing address */
  getRegion(address: number): MemoryRegion | null;
}
```

---

## Implementation

### Opportunity Identifier

```typescript
/**
 * Identifies valid SMC opportunities from detected patterns
 * 
 * Validates each pattern against multiple criteria to determine
 * if it represents a genuine optimization opportunity.
 * 
 * @example
 * ```typescript
 * const identifier = new SMCOpportunityIdentifier(memoryMap);
 * const opportunities = identifier.identify(patterns, context);
 * ```
 */
class SMCOpportunityIdentifier {
  /** Memory map for location validation */
  protected readonly memoryMap: MemoryMap;
  
  /** Configuration options */
  protected readonly config: SMCIdentificationConfig;
  
  constructor(memoryMap: MemoryMap, config: Partial<SMCIdentificationConfig> = {}) {
    this.memoryMap = memoryMap;
    this.config = { ...DEFAULT_IDENTIFICATION_CONFIG, ...config };
  }
  
  /**
   * Identify valid opportunities from patterns
   */
  identify(
    patterns: SMCPattern[],
    context: IdentificationContext
  ): SMCOpportunity[] {
    const opportunities: SMCOpportunity[] = [];
    
    for (const pattern of patterns) {
      const opportunity = this.analyzePattern(pattern, context);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    }
    
    return opportunities;
  }
  
  /**
   * Analyze a single pattern for opportunity
   */
  protected analyzePattern(
    pattern: SMCPattern,
    context: IdentificationContext
  ): SMCOpportunity | null {
    // Step 1: Validate location
    const validation = this.validateLocation(pattern, context);
    
    // Step 2: Analyze benefit
    const benefit = this.analyzeBenefit(pattern, context);
    
    // Step 3: Assess risk
    const risk = this.assessRisk(pattern, validation, context);
    
    // Step 4: Estimate frequency
    const frequency = this.estimateFrequency(pattern, context);
    
    // Step 5: Determine if recommended
    const recommended = this.shouldRecommend(
      validation, benefit, risk, frequency
    );
    
    // Skip if validation failed and not forced
    if (!validation.valid && !this.config.includeInvalid) {
      return null;
    }
    
    return {
      pattern,
      id: `opp_${pattern.id}`,
      validation,
      benefit,
      risk,
      frequency,
      recommended
    };
  }
  
  /**
   * Validate that pattern is in modifiable memory
   */
  protected validateLocation(
    pattern: SMCPattern,
    context: IdentificationContext
  ): OpportunityValidation {
    const failureReasons: string[] = [];
    const aliasingIssues: AliasingIssue[] = [];
    
    // Check RAM location
    const codeAddress = this.getCodeAddress(pattern);
    const inRAM = this.memoryMap.isRAM(codeAddress);
    const ramRegion = inRAM ? this.memoryMap.getRegion(codeAddress) : null;
    
    if (!inRAM) {
      failureReasons.push(`Code at $${codeAddress.toString(16)} is not in RAM`);
    }
    
    // Check aliasing safety
    const aliasingSafe = this.checkAliasingSafety(pattern, context, aliasingIssues);
    if (!aliasingSafe) {
      failureReasons.push('Aliasing concerns detected');
    }
    
    // Check interrupt safety
    const interruptSafe = this.checkInterruptSafety(pattern, context);
    if (!interruptSafe && this.config.requireInterruptSafety) {
      failureReasons.push('May be unsafe with interrupts');
    }
    
    return {
      inRAM,
      ramRegion: ramRegion as AddressRange | null,
      aliasingSafe,
      aliasingIssues,
      interruptSafe,
      valid: failureReasons.length === 0,
      failureReasons
    };
  }
  
  /**
   * Check for aliasing issues
   */
  protected checkAliasingSafety(
    pattern: SMCPattern,
    context: IdentificationContext,
    issues: AliasingIssue[]
  ): boolean {
    // Check if modification target could be accessed through other pointers
    const modifiedAddresses = this.getModifiedAddresses(pattern);
    
    for (const addr of modifiedAddresses) {
      // Check for other references to this address
      const aliases = this.findAliases(addr, pattern, context);
      
      for (const alias of aliases) {
        issues.push({
          address: addr,
          aliasSource: alias,
          description: `Address $${addr.toString(16)} also accessed via ${alias}`
        });
      }
    }
    
    return issues.length === 0;
  }
  
  /**
   * Check interrupt safety
   */
  protected checkInterruptSafety(
    pattern: SMCPattern,
    context: IdentificationContext
  ): boolean {
    // If no interrupts are used, always safe
    if (!context.interruptInfo.interruptsEnabled) {
      return true;
    }
    
    // Check if modification is atomic (single byte)
    const modSize = this.getModificationSize(pattern);
    if (modSize === 1) {
      return true; // Single byte writes are atomic on 6502
    }
    
    // Check if modification is in a critical section
    const inCritical = this.isInCriticalSection(pattern, context);
    if (inCritical) {
      return true;
    }
    
    // Multi-byte modification outside critical section = unsafe
    return false;
  }
  
  /**
   * Analyze benefit of applying SMC
   */
  protected analyzeBenefit(
    pattern: SMCPattern,
    context: IdentificationContext
  ): BenefitAnalysis {
    // Calculate cycles saved per execution
    const originalCycles = this.calculateOriginalCycles(pattern);
    const smcCycles = this.calculateSMCCycles(pattern);
    const cyclesSaved = originalCycles - smcCycles;
    
    // Calculate modification cost
    const modificationCost = this.calculateModificationCost(pattern);
    
    // Calculate net benefit
    const netCyclesSaved = cyclesSaved - modificationCost;
    
    // Calculate size impact
    const originalBytes = this.calculateOriginalBytes(pattern);
    const smcBytes = this.calculateSMCBytes(pattern);
    const bytesDelta = originalBytes - smcBytes;
    
    // Identify freed registers
    const registersFreed = this.identifyFreedRegisters(pattern);
    
    // Calculate break-even point
    const breakEvenExecutions = modificationCost > 0 && cyclesSaved > 0
      ? Math.ceil(modificationCost / cyclesSaved)
      : 0;
    
    return {
      cyclesSaved,
      modificationCost,
      netCyclesSaved,
      bytesDelta,
      registersFreed,
      breakEvenExecutions
    };
  }
  
  /**
   * Calculate cycles for original (non-SMC) code
   */
  protected calculateOriginalCycles(pattern: SMCPattern): number {
    let cycles = 0;
    
    for (const inst of pattern.instructions) {
      cycles += this.getInstructionCycles(inst);
    }
    
    return cycles;
  }
  
  /**
   * Calculate cycles for SMC version
   */
  protected calculateSMCCycles(pattern: SMCPattern): number {
    // SMC typically replaces indexed with absolute addressing
    // LDA abs,X (4-5 cycles) → LDA abs (4 cycles)
    
    switch (pattern.category) {
      case SMCPatternCategory.LOOP_COUNTER:
        return this.calculateLoopCounterSMCCycles(pattern);
      case SMCPatternCategory.ADDRESS_MODIFICATION:
        return this.calculateAddressModSMCCycles(pattern);
      case SMCPatternCategory.COMPUTED_JUMP:
        return this.calculateComputedJumpSMCCycles(pattern);
      default:
        return this.calculateOriginalCycles(pattern);
    }
  }
  
  /**
   * Assess risks of SMC transformation
   */
  protected assessRisk(
    pattern: SMCPattern,
    validation: OpportunityValidation,
    context: IdentificationContext
  ): RiskAssessment {
    const factors: RiskFactor[] = [];
    const mitigations: Mitigation[] = [];
    
    // ROM execution risk
    if (!validation.inRAM) {
      factors.push({
        type: RiskType.ROM_EXECUTION,
        description: 'Code may execute from ROM',
        severity: 10
      });
    }
    
    // Interrupt race risk
    if (!validation.interruptSafe) {
      factors.push({
        type: RiskType.INTERRUPT_RACE,
        description: 'Modification may race with interrupt',
        severity: 7
      });
      mitigations.push({
        type: 'critical_section',
        description: 'Wrap modification in SEI/CLI'
      });
    }
    
    // Aliasing risk
    if (!validation.aliasingSafe) {
      factors.push({
        type: RiskType.WRITE_CONFLICT,
        description: 'Multiple paths may modify same location',
        severity: 8
      });
    }
    
    // Debug confusion (always present with SMC)
    factors.push({
      type: RiskType.DEBUG_CONFUSION,
      description: 'Debugger will show modified code',
      severity: 2
    });
    
    // Calculate overall level
    const maxSeverity = factors.reduce((max, f) => Math.max(max, f.severity), 0);
    const level: 'low' | 'medium' | 'high' = 
      maxSeverity >= 8 ? 'high' :
      maxSeverity >= 5 ? 'medium' : 'low';
    
    return { level, factors, mitigations };
  }
  
  /**
   * Estimate execution frequency
   */
  protected estimateFrequency(
    pattern: SMCPattern,
    context: IdentificationContext
  ): ExecutionFrequency {
    // Try profile data first
    if (context.profileData) {
      const profileFreq = this.getProfileFrequency(pattern, context.profileData);
      if (profileFreq !== null) {
        return {
          perFrame: profileFreq.perFrame,
          total: profileFreq.total,
          hotPath: profileFreq.perFrame > 100,
          source: 'profile'
        };
      }
    }
    
    // Fall back to static analysis
    const staticFreq = this.estimateStaticFrequency(pattern, context);
    
    return {
      perFrame: staticFreq,
      total: 'unknown',
      hotPath: staticFreq > 50,
      source: 'static'
    };
  }
  
  /**
   * Determine if opportunity should be recommended
   */
  protected shouldRecommend(
    validation: OpportunityValidation,
    benefit: BenefitAnalysis,
    risk: RiskAssessment,
    frequency: ExecutionFrequency
  ): boolean {
    // Must be valid
    if (!validation.valid) return false;
    
    // Must have net benefit
    if (benefit.netCyclesSaved <= 0) return false;
    
    // Risk must be acceptable
    if (risk.level === 'high') return false;
    
    // Must be in hot path or free registers
    if (!frequency.hotPath && benefit.registersFreed.length === 0) {
      return false;
    }
    
    // Check break-even against frequency
    if (typeof frequency.perFrame === 'number') {
      if (benefit.breakEvenExecutions > frequency.perFrame * 10) {
        return false; // Takes too long to pay off
      }
    }
    
    return true;
  }
}
```

---

## Blend65 Integration

### Diagnostic Output

```js
// Compiler reports identified opportunities
// blend65 compile --smc-report game.bl65

/*
SMC Opportunity Report for game.bl65
====================================

Opportunity #1: loop_counter_block_42
  Pattern: LOOP_COUNTER
  Location: $0850 (RAM, valid)
  Benefit: 
    - Cycles saved: 3 per iteration
    - Modification cost: 8 cycles
    - Break-even: 3 executions
  Risk: LOW
  Frequency: ~200/frame (hot path)
  Recommendation: APPLY

Opportunity #2: addr_mod_block_67
  Pattern: ADDRESS_MODIFICATION  
  Location: $0920 (RAM, valid)
  Benefit:
    - Cycles saved: 2 per access
    - Registers freed: Y
  Risk: MEDIUM (interrupt concern)
  Frequency: ~50/frame
  Recommendation: APPLY with SEI/CLI

Opportunity #3: computed_jump_block_89
  Pattern: COMPUTED_JUMP
  Location: $D000 (ROM, INVALID)
  Validation: FAILED - code in ROM region
  Recommendation: SKIP
*/
```

### Example Code

```js
// High-value opportunity: hot loop with indexing
function renderSprites(): void {
    for (let i: byte = 0; i < 8; i++) {
        let x = spriteX[i];    // Indexed load - SMC candidate
        let y = spriteY[i];    // Indexed load - SMC candidate
        pokeVIC($D000 + i * 2, x);
        pokeVIC($D001 + i * 2, y);
    }
}
// Identified: 2 SMC opportunities, both recommended

// Low-value opportunity: cold initialization
function initGame(): void {
    for (let i: byte = 0; i < 25; i++) {
        clearRow(i);  // Only runs once
    }
}
// Identified: 1 SMC opportunity, NOT recommended (cold path)
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Location Validation | 5 | RAM/ROM detection, region boundaries |
| Aliasing Analysis | 5 | Pointer aliasing, array overlap |
| Interrupt Safety | 4 | Atomic writes, critical sections |
| Benefit Calculation | 5 | Cycle counting, size impact |
| Risk Assessment | 4 | Risk factors, mitigation suggestions |
| Frequency Estimation | 3 | Profile data, static analysis |

**Total: ~26 tests**

---

## Task Checklist

- [ ] Define SMCOpportunity interface
- [ ] Define OpportunityValidation interface
- [ ] Define BenefitAnalysis interface
- [ ] Define RiskAssessment types
- [ ] Implement SMCOpportunityIdentifier class
- [ ] Implement location validation
- [ ] Implement aliasing analysis
- [ ] Implement interrupt safety checks
- [ ] Implement benefit calculation
- [ ] Implement risk assessment
- [ ] Create comprehensive unit tests

---

## Next Document

**10-01b-smc-scoring.md** - SMC opportunity scoring and prioritization