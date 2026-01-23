# Task 9.1a3: VIC-II Border Open/Close Timing

> **Task**: 9.1a3 of Phase 09 (Target-Specific Optimizations)  
> **Session**: 4.1a3  
> **Time**: ~2 hours  
> **Tests**: ~30 tests  
> **Prerequisites**: 09-01a1 (Badline Timing), 09-01a2 (Sprite DMA)

---

## Overview

Implement timing analysis for VIC-II border operations. Border opening/closing requires cycle-exact code execution at specific horizontal positions. This task provides:

- Horizontal cycle position tracking
- Border open/close timing windows
- Side border vs. vertical border timing
- Cycle-exact position calculation

---

## Border Timing Fundamentals

The VIC-II draws borders when the electron beam is outside the display area. By writing to `$D016` (horizontal) or `$D011` (vertical) at precise moments, the border can be "opened" to display sprites or graphics in normally hidden areas.

### Horizontal Timing (Per Raster Line)

| Video System | Cycles per Line | Visible Cycles | Border Cycles |
|--------------|-----------------|----------------|---------------|
| PAL | 63 | 40 | 23 |
| NTSC | 65 | 40 | 25 |

### Critical Cycle Positions (PAL)

| Cycle | Event |
|-------|-------|
| 0-11 | Right border |
| 12-15 | Horizontal blanking |
| 16-55 | Display area / Left border |
| 56-62 | Right border setup |
| 57-58 | Side border compare (critical!) |
| 58 | VIC reads $D016 for CSEL |
| 62 | End of line |

---

## Directory Structure

```
packages/compiler/src/optimizer/target/vic-ii/
├── index.ts           # Exports
├── badline.ts         # From 09-01a1
├── timing.ts          # From 09-01a1
├── sprite-dma.ts      # From 09-01a2
├── sprite-timing.ts   # From 09-01a2
├── border-timing.ts   # Border timing analysis (THIS TASK)
├── cycle-position.ts  # Horizontal position (THIS TASK)
└── types.ts           # Extended types
```

---

## Implementation

### File: `vic-ii/types.ts` (Extended)

```typescript
/**
 * Border configuration state
 */
export interface BorderConfig {
  /** 38/40 column mode ($D016 bit 3 - CSEL) */
  readonly csel: boolean;
  /** 24/25 row mode ($D011 bit 3 - RSEL) */
  readonly rsel: boolean;
  /** Screen enabled ($D011 bit 4 - DEN) */
  readonly den: boolean;
}

/**
 * Border timing constants for PAL
 */
export const BORDER_TIMING_PAL = {
  /** Cycle where left border ends (CSEL=1) */
  leftBorderEnd40: 16,
  /** Cycle where left border ends (CSEL=0) */
  leftBorderEnd38: 17,
  /** Cycle where right border starts (CSEL=1) */
  rightBorderStart40: 56,
  /** Cycle where right border starts (CSEL=0) */
  rightBorderStart38: 55,
  /** Cycle where VIC compares CSEL for side border */
  cselCompareCycle: 58,
  /** Cycle where VIC compares RSEL for vertical border */
  rselCompareFirst: 55,
  rselCompareLast: 56,
  /** Total cycles per line */
  cyclesPerLine: 63,
} as const;

/**
 * Border timing constants for NTSC
 */
export const BORDER_TIMING_NTSC = {
  leftBorderEnd40: 18,
  leftBorderEnd38: 19,
  rightBorderStart40: 58,
  rightBorderStart38: 57,
  cselCompareCycle: 60,
  rselCompareFirst: 57,
  rselCompareLast: 58,
  cyclesPerLine: 65,
} as const;

/**
 * Raster lines for vertical border
 */
export const VERTICAL_BORDER_LINES = {
  PAL: {
    /** First visible line (RSEL=1) */
    topStart25: 51,
    /** First visible line (RSEL=0) */
    topStart24: 55,
    /** Last visible line (RSEL=1) */
    bottomEnd25: 250,
    /** Last visible line (RSEL=0) */
    bottomEnd24: 246,
    /** Top border compare line */
    topCompareLine: 51,
    /** Bottom border compare line */
    bottomCompareLine: 250,
  },
  NTSC: {
    topStart25: 51,
    topStart24: 55,
    bottomEnd25: 250,
    bottomEnd24: 246,
    topCompareLine: 51,
    bottomCompareLine: 250,
  },
} as const;
```

### File: `vic-ii/cycle-position.ts`

```typescript
import { 
  BORDER_TIMING_PAL, 
  BORDER_TIMING_NTSC 
} from './types.js';

/**
 * Horizontal cycle position within a raster line
 */
export interface CyclePosition {
  /** Cycle number (0-62 PAL, 0-64 NTSC) */
  readonly cycle: number;
  /** Which region of the line */
  readonly region: 'left-border' | 'display' | 'right-border' | 'hblank';
  /** Cycles until next region */
  readonly cyclesUntilNextRegion: number;
  /** Is this in the critical border compare window? */
  readonly inBorderCompareWindow: boolean;
}

/**
 * Instruction timing for cycle-exact placement
 */
export interface InstructionTiming {
  /** Cycles the instruction takes */
  readonly cycles: number;
  /** Cycle where side effect occurs (e.g., store hits bus) */
  readonly effectCycle: number;
  /** Whether instruction has page-cross penalty */
  readonly pageWrap: boolean;
}

/**
 * Cycle position tracker for border timing
 */
export class CyclePositionTracker {
  protected videoSystem: 'PAL' | 'NTSC';
  protected timing: typeof BORDER_TIMING_PAL;
  protected csel: boolean;

  constructor(videoSystem: 'PAL' | 'NTSC' = 'PAL', csel: boolean = true) {
    this.videoSystem = videoSystem;
    this.timing = videoSystem === 'PAL' ? BORDER_TIMING_PAL : BORDER_TIMING_NTSC;
    this.csel = csel;
  }

  /**
   * Get information about a specific cycle position
   */
  getCycleInfo(cycle: number): CyclePosition {
    const normalizedCycle = cycle % this.timing.cyclesPerLine;
    
    const leftEnd = this.csel 
      ? this.timing.leftBorderEnd40 
      : this.timing.leftBorderEnd38;
    const rightStart = this.csel 
      ? this.timing.rightBorderStart40 
      : this.timing.rightBorderStart38;
    
    let region: CyclePosition['region'];
    let cyclesUntilNextRegion: number;
    
    if (normalizedCycle < leftEnd) {
      region = 'left-border';
      cyclesUntilNextRegion = leftEnd - normalizedCycle;
    } else if (normalizedCycle < rightStart) {
      region = 'display';
      cyclesUntilNextRegion = rightStart - normalizedCycle;
    } else if (normalizedCycle < this.timing.cyclesPerLine - 1) {
      region = 'right-border';
      cyclesUntilNextRegion = this.timing.cyclesPerLine - normalizedCycle;
    } else {
      region = 'hblank';
      cyclesUntilNextRegion = this.timing.cyclesPerLine + leftEnd - normalizedCycle;
    }
    
    // Border compare window is cycle 57-58 (PAL)
    const compareWindow = [
      this.timing.cselCompareCycle - 1,
      this.timing.cselCompareCycle,
    ];
    const inBorderCompareWindow = 
      normalizedCycle >= compareWindow[0] && 
      normalizedCycle <= compareWindow[1];
    
    return {
      cycle: normalizedCycle,
      region,
      cyclesUntilNextRegion,
      inBorderCompareWindow,
    };
  }

  /**
   * Calculate cycle position after executing instructions
   */
  advanceCycles(startCycle: number, cycles: number): number {
    return (startCycle + cycles) % this.timing.cyclesPerLine;
  }

  /**
   * Find the start cycle to hit a target cycle at effect time
   * @param targetCycle - When the store effect should happen
   * @param instruction - Instruction timing info
   */
  findStartCycleForTarget(
    targetCycle: number,
    instruction: InstructionTiming
  ): number {
    // Effect happens effectCycle cycles into the instruction
    const startCycle = targetCycle - instruction.effectCycle;
    
    // Handle wrap-around
    if (startCycle < 0) {
      return startCycle + this.timing.cyclesPerLine;
    }
    
    return startCycle;
  }

  /**
   * Calculate NOP padding needed to reach a target cycle
   */
  calculateNOPPadding(
    currentCycle: number,
    targetCycle: number
  ): { nop2Count: number; extraNop: boolean; totalCycles: number } {
    let cyclesToWait = targetCycle - currentCycle;
    
    // Handle wrap-around
    if (cyclesToWait < 0) {
      cyclesToWait += this.timing.cyclesPerLine;
    }
    
    // NOP takes 2 cycles
    const nop2Count = Math.floor(cyclesToWait / 2);
    const extraNop = cyclesToWait % 2 === 1;
    
    // If odd cycles, we might need different approach
    // (BIT $EA or similar for 3 cycles)
    
    return {
      nop2Count,
      extraNop,  // Need a 3-cycle instruction if true
      totalCycles: cyclesToWait,
    };
  }

  /**
   * Get cycles per line for current video system
   */
  getCyclesPerLine(): number {
    return this.timing.cyclesPerLine;
  }

  /**
   * Set CSEL mode (38/40 columns)
   */
  setCSEL(csel: boolean): void {
    this.csel = csel;
  }
}
```

### File: `vic-ii/border-timing.ts`

```typescript
import { 
  BorderConfig,
  BORDER_TIMING_PAL,
  BORDER_TIMING_NTSC,
  VERTICAL_BORDER_LINES,
} from './types.js';
import { CyclePositionTracker, InstructionTiming } from './cycle-position.js';

/**
 * Border opening technique
 */
export type BorderTechnique = 
  | 'side-border-open'      // Open left/right borders
  | 'top-border-open'       // Open top border
  | 'bottom-border-open'    // Open bottom border
  | 'full-border-open';     // Open all borders

/**
 * Border timing requirement
 */
export interface BorderTimingRequirement {
  /** The technique being used */
  readonly technique: BorderTechnique;
  /** Raster lines where timing is critical */
  readonly criticalLines: number[];
  /** Critical cycle positions per line */
  readonly criticalCycles: number[];
  /** Instructions that must execute at these positions */
  readonly requiredInstructions: string[];
}

/**
 * Code placement for border operations
 */
export interface BorderCodePlacement {
  /** Starting cycle position */
  readonly startCycle: number;
  /** NOP padding before critical instruction */
  readonly nopPadding: number;
  /** Critical instruction (e.g., STA $D016) */
  readonly criticalInstruction: string;
  /** Total cycles used */
  readonly totalCycles: number;
}

/**
 * Border timing analyzer
 */
export class BorderTimingAnalyzer {
  protected videoSystem: 'PAL' | 'NTSC';
  protected cycleTracker: CyclePositionTracker;
  protected timing: typeof BORDER_TIMING_PAL;
  protected verticalTiming: typeof VERTICAL_BORDER_LINES.PAL;

  constructor(videoSystem: 'PAL' | 'NTSC' = 'PAL') {
    this.videoSystem = videoSystem;
    this.timing = videoSystem === 'PAL' ? BORDER_TIMING_PAL : BORDER_TIMING_NTSC;
    this.verticalTiming = VERTICAL_BORDER_LINES[videoSystem];
    this.cycleTracker = new CyclePositionTracker(videoSystem);
  }

  /**
   * Get timing requirements for side border opening
   */
  getSideBorderRequirements(): BorderTimingRequirement {
    // Side border opening requires:
    // 1. Set CSEL=0 ($D016 = $C0) before cycle 57
    // 2. Set CSEL=1 ($D016 = $C8) at or after cycle 58
    
    return {
      technique: 'side-border-open',
      criticalLines: [], // Any line in visible area
      criticalCycles: [
        this.timing.cselCompareCycle - 2,  // Must be CSEL=0 before this
        this.timing.cselCompareCycle,       // Restore CSEL=1 here
      ],
      requiredInstructions: [
        'STA $D016  ; CSEL=0 ($C0)',
        'STA $D016  ; CSEL=1 ($C8)',
      ],
    };
  }

  /**
   * Get timing requirements for top border opening
   */
  getTopBorderRequirements(): BorderTimingRequirement {
    // Top border opening requires:
    // 1. RSEL=0 ($D011 = $13) before line 51
    // 2. RSEL=1 ($D011 = $1B) after line 51
    
    return {
      technique: 'top-border-open',
      criticalLines: [
        this.verticalTiming.topCompareLine - 1,
        this.verticalTiming.topCompareLine,
      ],
      criticalCycles: [
        this.timing.rselCompareFirst,
        this.timing.rselCompareLast,
      ],
      requiredInstructions: [
        'STA $D011  ; RSEL=0 ($13)',
        'STA $D011  ; RSEL=1 ($1B)',
      ],
    };
  }

  /**
   * Get timing requirements for bottom border opening  
   */
  getBottomBorderRequirements(): BorderTimingRequirement {
    // Bottom border opening requires:
    // 1. RSEL=0 ($D011 = $13) on or before line 250
    // 2. The VIC must "miss" the bottom border condition
    
    return {
      technique: 'bottom-border-open',
      criticalLines: [
        this.verticalTiming.bottomCompareLine - 1,
        this.verticalTiming.bottomCompareLine,
      ],
      criticalCycles: [
        this.timing.rselCompareFirst,
        this.timing.rselCompareLast,
      ],
      requiredInstructions: [
        'STA $D011  ; RSEL=0 ($13) - must happen before compare',
      ],
    };
  }

  /**
   * Calculate code placement for side border opening
   */
  calculateSideBorderPlacement(
    entryRasterLine: number,
    entryCycle: number
  ): BorderCodePlacement[] {
    const placements: BorderCodePlacement[] = [];
    
    // We need two STA $D016 instructions:
    // First: CSEL=0 before cycle 57
    // Second: CSEL=1 at cycle 58+
    
    const staD016Timing: InstructionTiming = {
      cycles: 4,
      effectCycle: 3, // Write happens on 4th cycle
      pageWrap: false,
    };
    
    // First STA needs to complete (write) before cycle 57
    // So start at cycle 57 - 4 = 53 at latest
    const firstStaTarget = this.timing.cselCompareCycle - 2;
    const firstStaStart = this.cycleTracker.findStartCycleForTarget(
      firstStaTarget, 
      staD016Timing
    );
    
    const nopPadding1 = this.cycleTracker.calculateNOPPadding(
      entryCycle,
      firstStaStart
    );
    
    placements.push({
      startCycle: firstStaStart,
      nopPadding: nopPadding1.nop2Count,
      criticalInstruction: 'STA $D016  ; CSEL=0 ($C0)',
      totalCycles: nopPadding1.totalCycles + staD016Timing.cycles,
    });
    
    // Second STA should write at or after cycle 58
    const secondStaStart = firstStaStart + staD016Timing.cycles;
    
    placements.push({
      startCycle: secondStaStart,
      nopPadding: 0, // Follows immediately
      criticalInstruction: 'STA $D016  ; CSEL=1 ($C8)',
      totalCycles: staD016Timing.cycles,
    });
    
    return placements;
  }

  /**
   * Generate assembly code for side border opening
   */
  generateSideBorderCode(entryOffset: number = 0): string[] {
    const code: string[] = [];
    
    // Calculate required timing
    const targetCycle = this.timing.cselCompareCycle - 5; // STA writes on cycle 4
    
    // Add padding NOPs if needed
    if (entryOffset > 0) {
      const padding = this.cycleTracker.calculateNOPPadding(0, targetCycle - entryOffset);
      for (let i = 0; i < padding.nop2Count; i++) {
        code.push('    NOP                ; 2 cycles - timing alignment');
      }
      if (padding.extraNop) {
        code.push('    BIT $EA            ; 3 cycles - fine alignment');
      }
    }
    
    // The actual border opening sequence
    code.push('    LDA #$C0           ; 2 cycles - CSEL=0 value');
    code.push('    STA $D016          ; 4 cycles - write must be before cycle 57');
    code.push('    LDA #$C8           ; 2 cycles - CSEL=1 value');
    code.push('    STA $D016          ; 4 cycles - write at or after cycle 58');
    
    return code;
  }

  /**
   * Calculate if a code sequence fits within timing constraints
   */
  fitsWithinTiming(
    startCycle: number,
    instructionCycles: number[],
    deadline: number
  ): boolean {
    let currentCycle = startCycle;
    
    for (const cycles of instructionCycles) {
      currentCycle += cycles;
    }
    
    return currentCycle <= deadline;
  }

  /**
   * Verify border technique feasibility
   */
  verifyTechniqueFeasibility(
    technique: BorderTechnique,
    availableCycles: number
  ): { feasible: boolean; reason?: string } {
    const requirements: Record<BorderTechnique, number> = {
      'side-border-open': 12,    // LDA + STA + LDA + STA
      'top-border-open': 8,      // LDA + STA (timing simpler)
      'bottom-border-open': 8,   // LDA + STA
      'full-border-open': 20,    // Multiple STAs
    };
    
    const required = requirements[technique];
    
    if (availableCycles < required) {
      return {
        feasible: false,
        reason: `Need ${required} cycles, only ${availableCycles} available`,
      };
    }
    
    return { feasible: true };
  }

  /**
   * Get cycle tracker for advanced calculations
   */
  getCycleTracker(): CyclePositionTracker {
    return this.cycleTracker;
  }
}
```

---

## Blend65 Syntax for Border Operations

```js
// Mark function as requiring cycle-exact border timing
@borderOpen(side: true)
function openSideBorder() {
    // Compiler generates timing-critical code
    @map d016 at $D016: byte;
    d016 = $C0;  // CSEL=0 - must hit before cycle 57
    d016 = $C8;  // CSEL=1 - must hit at/after cycle 58
}

// Specify exact cycle entry point
@cycleExact(entry: 50)
function timedRoutine() {
    // Code assumes entry at cycle 50 of raster line
}

// Request NOP padding for alignment
@alignToCycle(target: 57)
function alignedCode() {
    // Compiler inserts NOPs to reach cycle 57
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `getCycleInfo` left border | Cycles 0-15 are left border (PAL) |
| `getCycleInfo` display | Cycles 16-55 are display area |
| `getCycleInfo` right border | Cycles 56-62 are right border |
| `getCycleInfo` compare window | Cycles 57-58 are border compare |
| `advanceCycles` wrap | Correctly wraps at line end |
| `findStartCycleForTarget` | Calculates correct start position |
| `calculateNOPPadding` even | Correct NOP count for even cycles |
| `calculateNOPPadding` odd | Handles odd cycle requirement |
| Side border requirements | Correct cycles for CSEL manipulation |
| Top border requirements | Correct line for RSEL manipulation |
| Bottom border requirements | Correct timing for bottom open |
| `calculateSideBorderPlacement` | Valid placement calculations |
| `generateSideBorderCode` | Correct assembly output |
| `fitsWithinTiming` pass | Returns true when fits |
| `fitsWithinTiming` fail | Returns false when doesn't fit |
| PAL vs NTSC timing | Different cycle counts handled |

---

## Task Checklist

| Item | Status |
|------|--------|
| Extend `vic-ii/types.ts` with border types | [ ] |
| Create `vic-ii/cycle-position.ts` | [ ] |
| Create `vic-ii/border-timing.ts` | [ ] |
| Update `vic-ii/index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 9.1b1 → `09-01b1-vic-fld-fli.md` (FLD/FLI techniques)