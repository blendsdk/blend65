# Task 10.4a1: SMC RAM vs ROM Analysis

> **Session**: 5.4a1
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2-3 hours
> **Tests**: 15-20 unit tests
> **Prerequisites**: 10-03b-smc-jumptable-computed.md

---

## Overview

This document specifies **RAM vs ROM analysis** for SMC safety, ensuring code targeted for modification resides in writable memory.

### C64 Memory Map

```
┌─────────────────────────────────────────────────────────────┐
│                   C64 Memory Layout                          │
├──────────┬──────────────────────────────────────────────────┤
│ $0000-   │ Zero Page - RAM (always writable)                │
│ $00FF    │                                                  │
├──────────┼──────────────────────────────────────────────────┤
│ $0100-   │ Stack - RAM (always writable)                    │
│ $01FF    │                                                  │
├──────────┼──────────────────────────────────────────────────┤
│ $0200-   │ User RAM - writable, SMC safe                    │
│ $9FFF    │                                                  │
├──────────┼──────────────────────────────────────────────────┤
│ $A000-   │ BASIC ROM / RAM (bank switchable)                │
│ $BFFF    │                                                  │
├──────────┼──────────────────────────────────────────────────┤
│ $C000-   │ Upper RAM (4K) - writable, SMC safe              │
│ $CFFF    │                                                  │
├──────────┼──────────────────────────────────────────────────┤
│ $D000-   │ I/O / Character ROM / RAM (bank switchable)      │
│ $DFFF    │                                                  │
├──────────┼──────────────────────────────────────────────────┤
│ $E000-   │ Kernal ROM / RAM (bank switchable)               │
│ $FFFF    │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

---

## Type Definitions

```typescript
/**
 * Memory region classification
 */
interface MemoryRegion {
  readonly start: number;
  readonly end: number;
  readonly type: MemoryType;
  readonly bankConfig: number;
  readonly smcSafe: boolean;
}

/**
 * Memory types
 */
enum MemoryType {
  RAM = 'ram',
  ROM = 'rom',
  IO = 'io',
  BANKED = 'banked'
}

/**
 * RAM/ROM analysis result
 */
interface RAMROMAnalysis {
  /** Is the code in RAM? */
  readonly inRAM: boolean;
  
  /** Memory region containing code */
  readonly region: MemoryRegion;
  
  /** Bank configuration required */
  readonly requiredBank: number;
  
  /** Is SMC safe at current bank? */
  readonly smcSafe: boolean;
  
  /** Actions needed to make safe */
  readonly actions: SafetyAction[];
}

/**
 * Action to make SMC safe
 */
interface SafetyAction {
  readonly type: 'bank_switch' | 'relocate' | 'copy_to_ram';
  readonly description: string;
  readonly cost: number;
}
```

---

## Implementation

```typescript
/**
 * Analyzes memory regions for SMC safety
 */
class RAMROMAnalyzer {
  protected readonly memoryMap: MemoryRegion[];
  
  constructor() {
    this.memoryMap = this.buildC64MemoryMap();
  }
  
  /**
   * Analyze address for SMC safety
   */
  analyze(address: number, bankConfig: number = 0x37): RAMROMAnalysis {
    const region = this.findRegion(address);
    const inRAM = this.isRAM(address, bankConfig);
    const smcSafe = inRAM && region.smcSafe;
    
    const actions: SafetyAction[] = [];
    if (!smcSafe) {
      actions.push(...this.suggestActions(address, region, bankConfig));
    }
    
    return {
      inRAM,
      region,
      requiredBank: this.getRequiredBank(region),
      smcSafe,
      actions
    };
  }
  
  /**
   * Build C64 memory map
   */
  protected buildC64MemoryMap(): MemoryRegion[] {
    return [
      { start: 0x0000, end: 0x00FF, type: MemoryType.RAM, bankConfig: 0xFF, smcSafe: true },
      { start: 0x0100, end: 0x01FF, type: MemoryType.RAM, bankConfig: 0xFF, smcSafe: true },
      { start: 0x0200, end: 0x9FFF, type: MemoryType.RAM, bankConfig: 0xFF, smcSafe: true },
      { start: 0xA000, end: 0xBFFF, type: MemoryType.BANKED, bankConfig: 0x37, smcSafe: false },
      { start: 0xC000, end: 0xCFFF, type: MemoryType.RAM, bankConfig: 0xFF, smcSafe: true },
      { start: 0xD000, end: 0xDFFF, type: MemoryType.BANKED, bankConfig: 0x37, smcSafe: false },
      { start: 0xE000, end: 0xFFFF, type: MemoryType.BANKED, bankConfig: 0x37, smcSafe: false }
    ];
  }
  
  /**
   * Check if address is RAM at given bank config
   */
  protected isRAM(address: number, bankConfig: number): boolean {
    // Always RAM
    if (address < 0xA000) return true;
    if (address >= 0xC000 && address < 0xD000) return true;
    
    // Bank-dependent
    if (address >= 0xA000 && address < 0xC000) {
      return (bankConfig & 0x03) === 0; // BASIC ROM switched out
    }
    if (address >= 0xD000 && address < 0xE000) {
      return (bankConfig & 0x04) === 0; // I/O switched out
    }
    if (address >= 0xE000) {
      return (bankConfig & 0x02) === 0; // Kernal ROM switched out
    }
    
    return false;
  }
  
  /**
   * Suggest actions to make SMC safe
   */
  protected suggestActions(
    address: number,
    region: MemoryRegion,
    bankConfig: number
  ): SafetyAction[] {
    const actions: SafetyAction[] = [];
    
    if (region.type === MemoryType.BANKED) {
      actions.push({
        type: 'bank_switch',
        description: `Switch bank to expose RAM at $${address.toString(16)}`,
        cost: 8 // LDA #xx, STA $01
      });
    }
    
    if (region.type === MemoryType.ROM) {
      actions.push({
        type: 'copy_to_ram',
        description: 'Copy code to RAM region before modification',
        cost: 100 // Depends on code size
      });
    }
    
    actions.push({
      type: 'relocate',
      description: 'Relocate code to always-RAM region ($0200-$9FFF)',
      cost: 0 // Compile-time change
    });
    
    return actions;
  }
}
```

---

## Blend65 Integration

```js
// Code placement directive for SMC
@segment("smc_code", $0800)  // Ensure in RAM
function smcRoutine(): void {
    // This code can safely use SMC
}

// Compiler warning if SMC in ROM region
@smc(allow)
@segment("rom_area", $E000)  // WARNING: SMC in ROM region!
function badPlacement(): void {
    // Compiler will warn about SMC in ROM
}
```

---

## Test Requirements

| Test Category | Test Cases | Description |
|--------------|------------|-------------|
| Region Detection | 5 | Address to region mapping |
| Bank Analysis | 4 | Bank configuration effects |
| Safety Actions | 4 | Suggested remediation |
| Edge Cases | 3 | Boundary addresses |

**Total: ~16 tests**

---

## Task Checklist

- [ ] Define MemoryRegion interface
- [ ] Define MemoryType enum
- [ ] Define RAMROMAnalysis interface
- [ ] Implement RAMROMAnalyzer class
- [ ] Implement C64 memory map
- [ ] Implement bank analysis
- [ ] Create unit tests

---

## Next Document

**10-04a2-smc-code-regions.md** - SMC code region analysis