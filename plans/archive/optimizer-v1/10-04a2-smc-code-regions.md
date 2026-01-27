# Task 10.4a2: SMC Code Region Analysis

> **Session**: 5.4a2
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2 hours
> **Tests**: 15-20 unit tests
> **Prerequisites**: 10-04a1-smc-ram-rom.md

---

## Overview

This document specifies **code region analysis** for SMC, tracking which code segments can be modified and their relationships.

---

## Type Definitions

```typescript
/**
 * Code region for SMC analysis
 */
interface CodeRegion {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly name: string;
  readonly attributes: RegionAttributes;
  readonly smcTargets: SMCTarget[];
}

/**
 * Region attributes
 */
interface RegionAttributes {
  readonly executable: boolean;
  readonly writable: boolean;
  readonly relocatable: boolean;
  readonly interruptSafe: boolean;
}

/**
 * SMC target within region
 */
interface SMCTarget {
  readonly offset: number;
  readonly size: number;
  readonly modifiedBy: string[];
  readonly safetyLevel: 'safe' | 'conditional' | 'unsafe';
}

/**
 * Region analysis result
 */
interface RegionAnalysis {
  readonly regions: CodeRegion[];
  readonly conflicts: RegionConflict[];
  readonly recommendations: string[];
}

/**
 * Conflict between regions
 */
interface RegionConflict {
  readonly type: 'overlap' | 'cross_reference' | 'bank_conflict';
  readonly regions: [string, string];
  readonly description: string;
}
```

---

## Implementation

```typescript
/**
 * Analyzes code regions for SMC compatibility
 */
class CodeRegionAnalyzer {
  /**
   * Analyze all code regions
   */
  analyze(program: ILProgram): RegionAnalysis {
    const regions = this.extractRegions(program);
    const conflicts = this.findConflicts(regions);
    const recommendations = this.generateRecommendations(regions, conflicts);
    
    return { regions, conflicts, recommendations };
  }
  
  /**
   * Extract code regions from program
   */
  protected extractRegions(program: ILProgram): CodeRegion[] {
    const regions: CodeRegion[] = [];
    
    for (const func of program.functions) {
      regions.push({
        id: func.name,
        start: func.address,
        end: func.address + func.size,
        name: func.name,
        attributes: this.analyzeAttributes(func),
        smcTargets: this.findSMCTargets(func)
      });
    }
    
    return regions;
  }
  
  /**
   * Find conflicts between regions
   */
  protected findConflicts(regions: CodeRegion[]): RegionConflict[] {
    const conflicts: RegionConflict[] = [];
    
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        if (this.overlaps(regions[i], regions[j])) {
          conflicts.push({
            type: 'overlap',
            regions: [regions[i].id, regions[j].id],
            description: 'Code regions overlap'
          });
        }
      }
    }
    
    return conflicts;
  }
}
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Region Extraction | 5 | Function to region mapping |
| Conflict Detection | 5 | Overlaps, cross-refs |
| Recommendations | 4 | Safety suggestions |

**Total: ~14 tests**

---

## Task Checklist

- [ ] Define CodeRegion interface
- [ ] Define RegionAttributes interface
- [ ] Implement CodeRegionAnalyzer
- [ ] Implement conflict detection
- [ ] Create unit tests

---

## Next Document

**10-04b-smc-safety-validation.md** - SMC runtime safety validation