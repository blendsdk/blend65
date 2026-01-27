# Task 8.11b: Memory Access & Addressing Costs

> **Task**: 8.11b of 12 (Peephole Phase - Cost Model)  
> **Time**: ~2 hours  
> **Tests**: ~35 tests  
> **Prerequisites**: Task 8.11a (Basic Cycle Counting)

---

## Overview

Extend the cost model to account for memory access patterns and addressing mode costs. This includes zero page optimization benefits, page boundary effects, and memory hierarchy considerations specific to 6502 systems.

---

## Directory Structure

```
packages/compiler/src/optimizer/cost/
├── index.ts              # Exports
├── types.ts              # Cost model types
├── cycle-table.ts        # Base cycle counts
├── instruction-cost.ts   # Per-instruction costing
├── cost-calculator.ts    # Total cost computation
├── memory-cost.ts        # Memory access costing (THIS TASK)
├── addressing-cost.ts    # Addressing mode analysis (THIS TASK)
└── page-analysis.ts      # Page boundary analysis (THIS TASK)
```

---

## Implementation

### File: `memory-cost.ts`

```typescript
import { AddressingMode } from './types.js';

/**
 * Memory region with cost characteristics
 */
export interface MemoryRegion {
  /** Start address */
  readonly start: number;
  /** End address (exclusive) */
  readonly end: number;
  /** Region name for documentation */
  readonly name: string;
  /** Access speed multiplier (1.0 = normal) */
  readonly speedFactor: number;
  /** Whether region is zero page */
  readonly isZeroPage: boolean;
}

/**
 * Memory access cost breakdown
 */
export interface MemoryAccessCost {
  /** Base access cycles */
  readonly baseCycles: number;
  /** Additional cycles from region characteristics */
  readonly regionPenalty: number;
  /** Addressing mode overhead */
  readonly addressingOverhead: number;
  /** Total cycles for this access */
  readonly totalCycles: number;
}

/**
 * Standard C64 memory regions
 */
export const C64_MEMORY_REGIONS: MemoryRegion[] = [
  // Zero page - fastest access
  { start: 0x0000, end: 0x0100, name: 'zero-page', speedFactor: 1.0, isZeroPage: true },
  
  // Stack - also fast (in zero page range but special)
  { start: 0x0100, end: 0x0200, name: 'stack', speedFactor: 1.0, isZeroPage: false },
  
  // BASIC RAM
  { start: 0x0200, end: 0x0800, name: 'basic-ram', speedFactor: 1.0, isZeroPage: false },
  
  // Screen RAM (default location)
  { start: 0x0400, end: 0x0800, name: 'screen-ram', speedFactor: 1.0, isZeroPage: false },
  
  // Main RAM
  { start: 0x0800, end: 0xA000, name: 'main-ram', speedFactor: 1.0, isZeroPage: false },
  
  // BASIC ROM / RAM (bank switchable)
  { start: 0xA000, end: 0xC000, name: 'basic-rom', speedFactor: 1.0, isZeroPage: false },
  
  // I/O area (VIC, SID, CIA)
  { start: 0xD000, end: 0xE000, name: 'io-area', speedFactor: 1.0, isZeroPage: false },
  
  // Kernal ROM / RAM
  { start: 0xE000, end: 0x10000, name: 'kernal-rom', speedFactor: 1.0, isZeroPage: false },
];

/**
 * Calculator for memory access costs
 */
export class MemoryAccessCostCalculator {
  protected regions: MemoryRegion[];
  
  constructor(regions: MemoryRegion[] = C64_MEMORY_REGIONS) {
    this.regions = regions;
  }
  
  /**
   * Calculate cost to access a specific memory address
   */
  calculateAccess(
    address: number,
    mode: AddressingMode
  ): MemoryAccessCost {
    const region = this.findRegion(address);
    const baseCycles = this.getBaseCycles(mode);
    const regionPenalty = this.getRegionPenalty(region);
    const addressingOverhead = this.getAddressingOverhead(mode, address);
    
    return {
      baseCycles,
      regionPenalty,
      addressingOverhead,
      totalCycles: baseCycles + regionPenalty + addressingOverhead,
    };
  }
  
  /**
   * Find memory region for an address
   */
  findRegion(address: number): MemoryRegion | undefined {
    return this.regions.find(r => address >= r.start && address < r.end);
  }
  
  /**
   * Check if address is in zero page
   */
  isZeroPage(address: number): boolean {
    return address >= 0x00 && address < 0x100;
  }
  
  /**
   * Get base cycles for addressing mode
   */
  protected getBaseCycles(mode: AddressingMode): number {
    const cycles: Record<AddressingMode, number> = {
      [AddressingMode.Implied]: 0,
      [AddressingMode.Accumulator]: 0,
      [AddressingMode.Immediate]: 0,
      [AddressingMode.ZeroPage]: 1,
      [AddressingMode.ZeroPageX]: 2,
      [AddressingMode.ZeroPageY]: 2,
      [AddressingMode.Absolute]: 2,
      [AddressingMode.AbsoluteX]: 2,
      [AddressingMode.AbsoluteY]: 2,
      [AddressingMode.IndirectX]: 4,
      [AddressingMode.IndirectY]: 3,
      [AddressingMode.Relative]: 0,
      [AddressingMode.Indirect]: 2,
    };
    return cycles[mode];
  }
  
  /**
   * Get penalty for specific memory region
   */
  protected getRegionPenalty(region: MemoryRegion | undefined): number {
    if (!region) return 0;
    // Currently all regions have same speed, but framework supports differences
    return Math.round((1.0 / region.speedFactor - 1.0) * 2);
  }
  
  /**
   * Get overhead for addressing mode + address combination
   */
  protected getAddressingOverhead(mode: AddressingMode, address: number): number {
    // Zero page savings
    if (this.isZeroPage(address)) {
      if (mode === AddressingMode.Absolute) {
        // Could use zero page mode instead - this is a missed optimization
        return 1; // Penalty for not using ZP mode
      }
    }
    return 0;
  }
  
  /**
   * Calculate zero page savings for using ZP instead of absolute
   */
  calculateZeroPageSavings(instruction: string): number {
    // Most instructions save 1 cycle and 1 byte with ZP mode
    const zeroPageInstructions = [
      'LDA', 'LDX', 'LDY', 'STA', 'STX', 'STY',
      'ADC', 'SBC', 'AND', 'ORA', 'EOR',
      'CMP', 'CPX', 'CPY', 'BIT',
      'INC', 'DEC', 'ASL', 'LSR', 'ROL', 'ROR',
    ];
    
    if (zeroPageInstructions.includes(instruction.toUpperCase())) {
      return 1; // 1 cycle saved
    }
    return 0;
  }
}

/** Default memory cost calculator */
export const memoryCost = new MemoryAccessCostCalculator();
```

### File: `addressing-cost.ts`

```typescript
import { AddressingMode, InstructionCost } from './types.js';

/**
 * Addressing mode comparison for optimization
 */
export interface AddressingModeComparison {
  /** Original addressing mode */
  readonly original: AddressingMode;
  /** Alternative addressing mode */
  readonly alternative: AddressingMode;
  /** Cycles saved (positive = faster) */
  readonly cyclesSaved: number;
  /** Bytes saved (positive = smaller) */
  readonly bytesSaved: number;
  /** Is conversion possible? */
  readonly isPossible: boolean;
  /** Reason if not possible */
  readonly reason?: string;
}

/**
 * Addressing mode characteristics
 */
interface ModeCharacteristics {
  /** Typical cycle count */
  cycles: number;
  /** Instruction size in bytes */
  bytes: number;
  /** Can access any address? */
  fullRange: boolean;
  /** Requires index register? */
  indexed: boolean;
  /** Which index register (if any) */
  indexRegister?: 'X' | 'Y';
}

/**
 * Addressing mode characteristics table
 */
const MODE_CHARACTERISTICS: Record<AddressingMode, ModeCharacteristics> = {
  [AddressingMode.Implied]: { cycles: 2, bytes: 1, fullRange: false, indexed: false },
  [AddressingMode.Accumulator]: { cycles: 2, bytes: 1, fullRange: false, indexed: false },
  [AddressingMode.Immediate]: { cycles: 2, bytes: 2, fullRange: false, indexed: false },
  [AddressingMode.ZeroPage]: { cycles: 3, bytes: 2, fullRange: false, indexed: false },
  [AddressingMode.ZeroPageX]: { cycles: 4, bytes: 2, fullRange: false, indexed: true, indexRegister: 'X' },
  [AddressingMode.ZeroPageY]: { cycles: 4, bytes: 2, fullRange: false, indexed: true, indexRegister: 'Y' },
  [AddressingMode.Absolute]: { cycles: 4, bytes: 3, fullRange: true, indexed: false },
  [AddressingMode.AbsoluteX]: { cycles: 4, bytes: 3, fullRange: true, indexed: true, indexRegister: 'X' },
  [AddressingMode.AbsoluteY]: { cycles: 4, bytes: 3, fullRange: true, indexed: true, indexRegister: 'Y' },
  [AddressingMode.IndirectX]: { cycles: 6, bytes: 2, fullRange: true, indexed: true, indexRegister: 'X' },
  [AddressingMode.IndirectY]: { cycles: 5, bytes: 2, fullRange: true, indexed: true, indexRegister: 'Y' },
  [AddressingMode.Relative]: { cycles: 2, bytes: 2, fullRange: false, indexed: false },
  [AddressingMode.Indirect]: { cycles: 5, bytes: 3, fullRange: true, indexed: false },
};

/**
 * Analyzer for addressing mode optimizations
 */
export class AddressingModeAnalyzer {
  /**
   * Compare two addressing modes for potential optimization
   */
  compare(
    original: AddressingMode,
    alternative: AddressingMode,
    targetAddress?: number
  ): AddressingModeComparison {
    const origChar = MODE_CHARACTERISTICS[original];
    const altChar = MODE_CHARACTERISTICS[alternative];
    
    // Check if conversion is possible
    const possibility = this.checkConversionPossibility(
      original,
      alternative,
      targetAddress
    );
    
    if (!possibility.isPossible) {
      return {
        original,
        alternative,
        cyclesSaved: 0,
        bytesSaved: 0,
        isPossible: false,
        reason: possibility.reason,
      };
    }
    
    return {
      original,
      alternative,
      cyclesSaved: origChar.cycles - altChar.cycles,
      bytesSaved: origChar.bytes - altChar.bytes,
      isPossible: true,
    };
  }
  
  /**
   * Find best addressing mode for a given address
   */
  findBestMode(
    address: number,
    needsIndexing: boolean,
    indexRegister?: 'X' | 'Y'
  ): AddressingMode {
    const isZP = address < 0x100;
    
    if (!needsIndexing) {
      return isZP ? AddressingMode.ZeroPage : AddressingMode.Absolute;
    }
    
    if (indexRegister === 'X') {
      return isZP ? AddressingMode.ZeroPageX : AddressingMode.AbsoluteX;
    }
    
    if (indexRegister === 'Y') {
      return isZP ? AddressingMode.ZeroPageY : AddressingMode.AbsoluteY;
    }
    
    return AddressingMode.Absolute;
  }
  
  /**
   * Get all possible modes for an instruction
   */
  getPossibleModes(
    mnemonic: string,
    address?: number
  ): AddressingMode[] {
    // Instruction-specific mode availability
    const modesByInstruction: Record<string, AddressingMode[]> = {
      LDA: [
        AddressingMode.Immediate,
        AddressingMode.ZeroPage, AddressingMode.ZeroPageX,
        AddressingMode.Absolute, AddressingMode.AbsoluteX, AddressingMode.AbsoluteY,
        AddressingMode.IndirectX, AddressingMode.IndirectY,
      ],
      LDX: [
        AddressingMode.Immediate,
        AddressingMode.ZeroPage, AddressingMode.ZeroPageY,
        AddressingMode.Absolute, AddressingMode.AbsoluteY,
      ],
      LDY: [
        AddressingMode.Immediate,
        AddressingMode.ZeroPage, AddressingMode.ZeroPageX,
        AddressingMode.Absolute, AddressingMode.AbsoluteX,
      ],
      STA: [
        AddressingMode.ZeroPage, AddressingMode.ZeroPageX,
        AddressingMode.Absolute, AddressingMode.AbsoluteX, AddressingMode.AbsoluteY,
        AddressingMode.IndirectX, AddressingMode.IndirectY,
      ],
      STX: [
        AddressingMode.ZeroPage, AddressingMode.ZeroPageY,
        AddressingMode.Absolute,
      ],
      STY: [
        AddressingMode.ZeroPage, AddressingMode.ZeroPageX,
        AddressingMode.Absolute,
      ],
      // Add more as needed...
    };
    
    const modes = modesByInstruction[mnemonic.toUpperCase()] || [];
    
    // Filter by address if provided
    if (address !== undefined) {
      const isZP = address < 0x100;
      return modes.filter(m => {
        const char = MODE_CHARACTERISTICS[m];
        if (isZP) return true; // ZP can use any mode
        return char.fullRange; // Non-ZP needs full range mode
      });
    }
    
    return modes;
  }
  
  /**
   * Check if conversion between modes is possible
   */
  protected checkConversionPossibility(
    from: AddressingMode,
    to: AddressingMode,
    address?: number
  ): { isPossible: boolean; reason?: string } {
    const fromChar = MODE_CHARACTERISTICS[from];
    const toChar = MODE_CHARACTERISTICS[to];
    
    // Can't convert non-indexed to indexed without free register
    if (toChar.indexed && !fromChar.indexed) {
      return {
        isPossible: false,
        reason: `Requires ${toChar.indexRegister} register`,
      };
    }
    
    // Can't convert to zero page if address >= 256
    if (address !== undefined && address >= 0x100) {
      if (to === AddressingMode.ZeroPage ||
          to === AddressingMode.ZeroPageX ||
          to === AddressingMode.ZeroPageY) {
        return {
          isPossible: false,
          reason: 'Address not in zero page',
        };
      }
    }
    
    // Can't convert from different index register
    if (fromChar.indexed && toChar.indexed &&
        fromChar.indexRegister !== toChar.indexRegister) {
      return {
        isPossible: false,
        reason: `Cannot change index from ${fromChar.indexRegister} to ${toChar.indexRegister}`,
      };
    }
    
    return { isPossible: true };
  }
}

/** Default addressing mode analyzer */
export const addressingAnalyzer = new AddressingModeAnalyzer();
```

### File: `page-analysis.ts`

```typescript
/**
 * Page boundary analysis for cycle penalty calculation
 */

/**
 * Page crossing analysis result
 */
export interface PageCrossingResult {
  /** Does the access cross a page boundary? */
  readonly crossesPage: boolean;
  /** Source page (base address) */
  readonly sourcePage: number;
  /** Target page (effective address) */
  readonly targetPage: number;
  /** Cycle penalty for crossing */
  readonly penalty: number;
}

/**
 * Branch range analysis result
 */
export interface BranchRangeResult {
  /** Is target within branch range? (-128 to +127) */
  readonly inRange: boolean;
  /** Distance to target */
  readonly distance: number;
  /** Would branch cross page boundary? */
  readonly crossesPage: boolean;
  /** Penalty if branch is taken */
  readonly takenPenalty: number;
}

/**
 * Analyzer for page boundary effects
 */
export class PageBoundaryAnalyzer {
  /** Page size (256 bytes) */
  protected readonly PAGE_SIZE = 0x100;
  
  /**
   * Check if indexed access crosses page boundary
   */
  checkIndexedAccess(
    baseAddress: number,
    indexValue: number
  ): PageCrossingResult {
    const effectiveAddress = (baseAddress + indexValue) & 0xFFFF;
    const sourcePage = Math.floor(baseAddress / this.PAGE_SIZE);
    const targetPage = Math.floor(effectiveAddress / this.PAGE_SIZE);
    const crossesPage = sourcePage !== targetPage;
    
    return {
      crossesPage,
      sourcePage,
      targetPage,
      penalty: crossesPage ? 1 : 0,
    };
  }
  
  /**
   * Check branch instruction page crossing
   */
  checkBranch(
    branchAddress: number,
    targetAddress: number
  ): BranchRangeResult {
    // Branch is relative to instruction AFTER the branch
    const nextInstruction = branchAddress + 2;
    const distance = targetAddress - nextInstruction;
    const inRange = distance >= -128 && distance <= 127;
    
    const sourcePage = Math.floor(nextInstruction / this.PAGE_SIZE);
    const targetPage = Math.floor(targetAddress / this.PAGE_SIZE);
    const crossesPage = sourcePage !== targetPage;
    
    // Penalty: +1 if taken, +1 more if page cross
    const takenPenalty = 1 + (crossesPage ? 1 : 0);
    
    return {
      inRange,
      distance,
      crossesPage,
      takenPenalty,
    };
  }
  
  /**
   * Estimate page cross probability for indexed access
   */
  estimatePageCrossProbability(
    baseAddress: number,
    maxIndex: number
  ): number {
    // Calculate how many index values would cause page cross
    const baseOffset = baseAddress & 0xFF; // Position within page
    const remainingInPage = this.PAGE_SIZE - baseOffset;
    
    if (maxIndex <= remainingInPage) {
      return 0; // Never crosses
    }
    
    // Probability = (values that cross) / (total values)
    const crossingValues = maxIndex - remainingInPage;
    return Math.min(1.0, crossingValues / maxIndex);
  }
  
  /**
   * Get page number for an address
   */
  getPage(address: number): number {
    return Math.floor(address / this.PAGE_SIZE);
  }
  
  /**
   * Check if address is at page boundary
   */
  isAtPageBoundary(address: number): boolean {
    return (address & 0xFF) === 0;
  }
  
  /**
   * Calculate aligned address for page start
   */
  alignToPageStart(address: number): number {
    return address & 0xFF00;
  }
  
  /**
   * Calculate next page start
   */
  nextPageStart(address: number): number {
    return this.alignToPageStart(address) + this.PAGE_SIZE;
  }
}

/** Default page boundary analyzer */
export const pageAnalyzer = new PageBoundaryAnalyzer();
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `memory-cost.findRegion` | Find correct region for addresses |
| `memory-cost.isZeroPage` | Identify zero page addresses |
| `memory-cost.calculateAccess` | Compute access cost for modes |
| `memory-cost.calculateZeroPageSavings` | ZP savings per instruction |
| `addressing-cost.compare` | Compare mode costs |
| `addressing-cost.findBestMode` | Select optimal mode |
| `addressing-cost.getPossibleModes` | List modes per instruction |
| `addressing-cost.checkConversion` | Validate mode conversion |
| `page-analysis.checkIndexedAccess` | Detect indexed page cross |
| `page-analysis.checkBranch` | Analyze branch penalties |
| `page-analysis.estimatePageCrossProbability` | Probability calculation |
| `page-analysis.getPage` | Extract page number |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `memory-cost.ts` | [ ] |
| Create `addressing-cost.ts` | [ ] |
| Create `page-analysis.ts` | [ ] |
| Update `index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.11c → `08-11c-cost-branch.md`