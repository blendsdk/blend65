# Task 10.3b: SMC Computed Jump Targets

> **Session**: 5.3b
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2-3 hours
> **Tests**: 20-25 unit tests
> **Prerequisites**: 10-03a-smc-jumptable-static.md

---

## Overview

This document specifies **SMC computed jump targets** where jump addresses are calculated at runtime rather than looked up from a static table.

### When to Use Computed Jumps

- Function pointers stored in variables
- Callbacks and event handlers
- Coroutine-style programming
- Return address manipulation

---

## Type Definitions

```typescript
/**
 * Computed jump configuration
 */
interface ComputedJumpConfig {
  /** Source of the computed address */
  readonly source: ComputedAddressSource;
  
  /** Whether address needs validation */
  readonly validate: boolean;
  
  /** Valid address ranges (if validation enabled) */
  readonly validRanges?: AddressRange[];
}

/**
 * Source of computed address
 */
interface ComputedAddressSource {
  /** Source type */
  readonly type: 'variable' | 'expression' | 'callback';
  
  /** Variable holding address */
  readonly variable?: string;
  
  /** Expression computing address */
  readonly expression?: string;
  
  /** Storage location (zero page preferred) */
  readonly location: 'zeropage' | 'absolute';
}

/**
 * Generated computed jump code
 */
interface ComputedJumpCode {
  /** Address loading code */
  readonly loadCode: ILInstruction[];
  
  /** SMC jump instruction */
  readonly jumpCode: ILInstruction[];
  
  /** Validation code (if enabled) */
  readonly validationCode?: ILInstruction[];
  
  /** Cycles for complete dispatch */
  readonly totalCycles: number;
}
```

---

## Implementation

```typescript
/**
 * Generates SMC computed jump code
 */
class ComputedJumpGenerator {
  /**
   * Generate computed jump code
   */
  generate(config: ComputedJumpConfig): ComputedJumpCode {
    const loadCode: ILInstruction[] = [];
    const jumpCode: ILInstruction[] = [];
    let validationCode: ILInstruction[] | undefined;
    
    // Load address from source
    if (config.source.type === 'variable') {
      if (config.source.location === 'zeropage') {
        // Load from zero page (faster)
        loadCode.push(this.createLoadZP(config.source.variable!, 0));
        loadCode.push(this.createStoreJumpLow());
        loadCode.push(this.createLoadZP(config.source.variable!, 1));
        loadCode.push(this.createStoreJumpHigh());
      } else {
        // Load from absolute address
        loadCode.push(this.createLoadAbs(config.source.variable!, 0));
        loadCode.push(this.createStoreJumpLow());
        loadCode.push(this.createLoadAbs(config.source.variable!, 1));
        loadCode.push(this.createStoreJumpHigh());
      }
    }
    
    // Add validation if needed
    if (config.validate && config.validRanges) {
      validationCode = this.generateValidation(config.validRanges);
    }
    
    // SMC jump
    jumpCode.push(this.createSMCJump());
    
    return {
      loadCode,
      jumpCode,
      validationCode,
      totalCycles: this.calculateCycles(loadCode, jumpCode, validationCode)
    };
  }
  
  /**
   * Generate address validation code
   */
  protected generateValidation(ranges: AddressRange[]): ILInstruction[] {
    const code: ILInstruction[] = [];
    
    // Check high byte against valid ranges
    for (const range of ranges) {
      const lowPage = range.start >> 8;
      const highPage = range.end >> 8;
      
      code.push(this.createLoadJumpHigh());
      code.push(this.createCompareImmediate(lowPage));
      code.push(this.createBranchCarryClear('invalid_jump'));
      code.push(this.createCompareImmediate(highPage + 1));
      code.push(this.createBranchCarrySet('invalid_jump'));
    }
    
    return code;
  }
}
```

---

## Blend65 Examples

```js
// Function pointer call
let callback: word = &defaultHandler;

function setCallback(handler: word): void {
    callback = handler;
}

function invokeCallback(): void {
    // SMC: Modifies JMP operand with callback value
    callback();
}

// Event dispatch system
let eventHandlers: array<word, 8>;

function dispatchEvent(eventId: byte): void {
    let handler = eventHandlers[eventId];
    if (handler != 0) {
        handler();  // SMC computed jump
    }
}
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Address Loading | 5 | ZP vs absolute sources |
| SMC Generation | 4 | Jump instruction setup |
| Validation | 4 | Range checking |
| Integration | 4 | Complete dispatch |

**Total: ~17 tests**

---

## Task Checklist

- [ ] Define ComputedJumpConfig interface
- [ ] Define ComputedAddressSource interface
- [ ] Implement ComputedJumpGenerator class
- [ ] Implement address loading
- [ ] Implement validation generation
- [ ] Create unit tests

---

## Next Document

**10-04a1-smc-ram-rom.md** - SMC RAM vs ROM analysis