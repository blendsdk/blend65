# Task 10.4b: SMC Runtime Safety Validation

> **Session**: 5.4b
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2 hours
> **Tests**: 15-20 unit tests
> **Prerequisites**: 10-04a2-smc-code-regions.md

---

## Overview

This document specifies **runtime safety validation** for SMC, ensuring modifications don't corrupt executing code or cause race conditions.

---

## Type Definitions

```typescript
/**
 * Safety validation configuration
 */
interface SafetyValidationConfig {
  /** Check for interrupt races */
  readonly checkInterrupts: boolean;
  
  /** Check for instruction pipeline issues */
  readonly checkPipeline: boolean;
  
  /** Validate address ranges */
  readonly validateRanges: boolean;
  
  /** Insert runtime checks */
  readonly insertRuntimeChecks: boolean;
}

/**
 * Validation result
 */
interface ValidationResult {
  readonly safe: boolean;
  readonly issues: SafetyIssue[];
  readonly mitigations: Mitigation[];
}

/**
 * Safety issue detected
 */
interface SafetyIssue {
  readonly type: 'interrupt_race' | 'pipeline_hazard' | 'range_violation';
  readonly severity: 'error' | 'warning' | 'info';
  readonly location: SourceLocation;
  readonly description: string;
}

/**
 * Mitigation for safety issue
 */
interface Mitigation {
  readonly issue: SafetyIssue;
  readonly action: 'sei_cli' | 'nop_padding' | 'range_check';
  readonly code: ILInstruction[];
  readonly cost: number;
}
```

---

## Implementation

```typescript
/**
 * Validates SMC for runtime safety
 */
class SMCSafetyValidator {
  /**
   * Validate SMC modifications
   */
  validate(smcCode: SMCCode, context: ValidationContext): ValidationResult {
    const issues: SafetyIssue[] = [];
    const mitigations: Mitigation[] = [];
    
    // Check interrupt safety
    if (context.config.checkInterrupts) {
      issues.push(...this.checkInterruptSafety(smcCode, context));
    }
    
    // Check pipeline hazards (6502 doesn't have pipeline, but timing matters)
    if (context.config.checkPipeline) {
      issues.push(...this.checkTimingIssues(smcCode, context));
    }
    
    // Generate mitigations
    for (const issue of issues) {
      const mitigation = this.generateMitigation(issue, smcCode);
      if (mitigation) {
        mitigations.push(mitigation);
      }
    }
    
    return {
      safe: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      mitigations
    };
  }
  
  /**
   * Check for interrupt race conditions
   */
  protected checkInterruptSafety(
    smcCode: SMCCode,
    context: ValidationContext
  ): SafetyIssue[] {
    const issues: SafetyIssue[] = [];
    
    // Multi-byte modifications not atomic
    if (smcCode.modificationSize > 1 && context.interruptsEnabled) {
      issues.push({
        type: 'interrupt_race',
        severity: 'warning',
        location: smcCode.location,
        description: 'Multi-byte SMC may race with interrupt handler'
      });
    }
    
    return issues;
  }
  
  /**
   * Generate mitigation code
   */
  protected generateMitigation(
    issue: SafetyIssue,
    smcCode: SMCCode
  ): Mitigation | null {
    switch (issue.type) {
      case 'interrupt_race':
        return {
          issue,
          action: 'sei_cli',
          code: [
            this.createSEI(),
            ...smcCode.modificationCode,
            this.createCLI()
          ],
          cost: 4 // SEI (2) + CLI (2)
        };
      default:
        return null;
    }
  }
}
```

---

## Blend65 Examples

```js
// Compiler automatically wraps unsafe SMC
@smc(allow)
function unsafeModification(): void {
    // Multi-byte modification with interrupts
    // Compiler inserts SEI/CLI wrapper
}

// Generated code:
/*
    SEI             ; Disable interrupts
    LDA #<newAddr
    STA target+1
    LDA #>newAddr
    STA target+2
    CLI             ; Re-enable interrupts
*/
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Interrupt Safety | 5 | Race detection, atomic checks |
| Timing Validation | 4 | Modification timing |
| Mitigation Gen | 4 | SEI/CLI insertion |
| Integration | 3 | Full validation pipeline |

**Total: ~16 tests**

---

## Task Checklist

- [ ] Define SafetyValidationConfig
- [ ] Define ValidationResult interface
- [ ] Implement SMCSafetyValidator
- [ ] Implement interrupt checking
- [ ] Implement mitigation generation
- [ ] Create unit tests

---

## Next Document

**10-05-smc-config.md** - SMC configuration options