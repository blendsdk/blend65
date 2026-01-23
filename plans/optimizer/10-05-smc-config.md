# Task 10.5: SMC Configuration Options

> **Session**: 5.5
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2 hours
> **Tests**: 15-20 unit tests
> **Prerequisites**: 10-04b-smc-safety-validation.md

---

## Overview

This document specifies **SMC configuration options** that control how the optimizer applies self-modifying code transformations.

---

## Type Definitions

```typescript
/**
 * Global SMC configuration
 */
interface SMCConfig {
  /** Master enable/disable for SMC */
  enabled: boolean;
  
  /** Aggressiveness level (1-5) */
  aggressiveness: 1 | 2 | 3 | 4 | 5;
  
  /** Enabled SMC categories */
  enabledCategories: SMCPatternCategory[];
  
  /** Minimum score to apply SMC */
  minScore: number;
  
  /** Maximum SMC sites per function */
  maxPerFunction: number;
  
  /** Maximum total SMC sites */
  maxTotal: number;
  
  /** Safety settings */
  safety: SMCSafetyConfig;
  
  /** Reporting settings */
  reporting: SMCReportingConfig;
}

/**
 * Safety configuration
 */
interface SMCSafetyConfig {
  /** Require interrupt safety */
  requireInterruptSafe: boolean;
  
  /** Auto-insert SEI/CLI wrappers */
  autoProtect: boolean;
  
  /** Validate all addresses */
  validateAddresses: boolean;
  
  /** Allowed memory regions */
  allowedRegions: AddressRange[];
}

/**
 * Reporting configuration
 */
interface SMCReportingConfig {
  /** Generate SMC report */
  generateReport: boolean;
  
  /** Report verbosity */
  verbosity: 'minimal' | 'normal' | 'detailed';
  
  /** Include rejected opportunities */
  includeRejected: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_SMC_CONFIG: SMCConfig = {
  enabled: true,
  aggressiveness: 3,
  enabledCategories: [
    SMCPatternCategory.LOOP_COUNTER,
    SMCPatternCategory.ADDRESS_MODIFICATION,
    SMCPatternCategory.COMPUTED_JUMP
  ],
  minScore: 40,
  maxPerFunction: 5,
  maxTotal: 20,
  safety: {
    requireInterruptSafe: false,
    autoProtect: true,
    validateAddresses: true,
    allowedRegions: [
      { start: 0x0800, end: 0x9FFF },
      { start: 0xC000, end: 0xCFFF }
    ]
  },
  reporting: {
    generateReport: false,
    verbosity: 'normal',
    includeRejected: false
  }
};
```

---

## Implementation

```typescript
/**
 * SMC configuration manager
 */
class SMCConfigManager {
  protected config: SMCConfig;
  
  constructor(config: Partial<SMCConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_SMC_CONFIG, config);
  }
  
  /**
   * Check if SMC category is enabled
   */
  isCategoryEnabled(category: SMCPatternCategory): boolean {
    return this.config.enabled && 
           this.config.enabledCategories.includes(category);
  }
  
  /**
   * Check if score meets threshold
   */
  meetsThreshold(score: number): boolean {
    return score >= this.config.minScore;
  }
  
  /**
   * Check limits
   */
  withinLimits(perFunction: number, total: number): boolean {
    return perFunction <= this.config.maxPerFunction &&
           total <= this.config.maxTotal;
  }
}
```

---

## Blend65 Integration

```js
// Project configuration (blend65.config.json)
{
  "optimization": {
    "smc": {
      "enabled": true,
      "aggressiveness": 4,
      "categories": ["loop_counter", "computed_jump"],
      "minScore": 50,
      "safety": {
        "autoProtect": true
      }
    }
  }
}

// Per-function override
@smc(enabled: true, aggressive: true)
function hotPath(): void { }

@smc(disabled)
function safeCritical(): void { }
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Config Parsing | 4 | Load and validate config |
| Category Filtering | 4 | Enable/disable categories |
| Threshold Checks | 4 | Score and limit validation |
| Config Merging | 4 | Defaults + overrides |

**Total: ~16 tests**

---

## Task Checklist

- [ ] Define SMCConfig interface
- [ ] Define SMCSafetyConfig interface  
- [ ] Define DEFAULT_SMC_CONFIG
- [ ] Implement SMCConfigManager
- [ ] Create unit tests

---

## Next Document

**10-06a-smc-usage-docs.md** - SMC usage documentation