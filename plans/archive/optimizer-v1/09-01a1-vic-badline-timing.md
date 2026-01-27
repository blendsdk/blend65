# Task 9.1a1: VIC-II Badline Mechanics & Timing

> **Task**: 9.1a1 of Phase 09 (Target-Specific Optimizations)  
> **Session**: 4.1a1  
> **Time**: ~2 hours  
> **Tests**: ~40 tests  
> **Prerequisites**: Phase 08 (Peephole), 07-6502-specific.md

---

## Overview

Implement badline-aware code generation. VIC-II badlines steal 40-43 CPU cycles per raster line, which can disrupt cycle-critical code. This task provides:

- Badline detection and prediction
- Cycle budget calculations accounting for badlines
- Code placement strategies to avoid badline interference
- Compiler hints for badline-sensitive regions

---

## What Are Badlines?

On the C64, the VIC-II chip steals CPU cycles on specific raster lines to fetch character pointers. A "badline" occurs when:

```
(rasterline AND $07) == (YSCROLL AND $07)
```

Where `YSCROLL` is the lower 3 bits of `$D011`.

### Badline Cycle Stealing

| Situation | Cycles Available | Cycles Stolen |
|-----------|-----------------|---------------|
| Normal line | 63 cycles | 0 |
| Badline | 20-23 cycles | 40-43 |
| Screen off ($D011 bit 4=0) | 63 cycles | 0 |
| 38-column mode | +1 cycle | -1 |

### When Badlines Occur

With default `$D011 = $1B` (YSCROLL = 3):

```
Raster lines 51, 59, 67, ..., 243 (every 8th line starting at 51)
```

---

## Directory Structure

```
packages/compiler/src/optimizer/target/
├── index.ts               # Exports
├── vic-ii/
│   ├── index.ts           # VIC-II exports
│   ├── badline.ts         # Badline detection (THIS TASK)
│   ├── timing.ts          # Cycle timing with badlines (THIS TASK)
│   └── types.ts           # VIC-II specific types
```

---

## Implementation

### File: `vic-ii/types.ts`

```typescript
/**
 * VIC-II timing context
 */
export interface VICTimingContext {
  /** Current raster line (0-311 PAL, 0-262 NTSC) */
  readonly rasterLine: number | 'unknown';
  /** Current YSCROLL value (0-7) */
  readonly yscroll: number;
  /** Whether screen is enabled ($D011 bit 4) */
  readonly screenEnabled: boolean;
  /** Whether sprites are enabled */
  readonly spritesEnabled: number;  // Bitmask $D015
  /** Column mode (38 or 40) */
  readonly columnMode: 38 | 40;
  /** Video system */
  readonly videoSystem: 'PAL' | 'NTSC';
}

/**
 * Default VIC timing context
 */
export const DEFAULT_VIC_CONTEXT: VICTimingContext = {
  rasterLine: 'unknown',
  yscroll: 3,  // Default $D011 = $1B
  screenEnabled: true,
  spritesEnabled: 0,
  columnMode: 40,
  videoSystem: 'PAL',
};

/**
 * Cycles per raster line by video system
 */
export const CYCLES_PER_LINE = {
  PAL: 63,
  NTSC: 65,
} as const;

/**
 * Raster lines in visible area
 */
export const VISIBLE_AREA = {
  PAL: { start: 51, end: 250 },
  NTSC: { start: 51, end: 250 },
} as const;

/**
 * Badline cycle cost
 */
export const BADLINE_STOLEN_CYCLES = {
  base: 40,      // Minimum stolen
  max: 43,       // Maximum with sprites
  withSprite: 2, // Additional per enabled sprite on line
} as const;
```

### File: `vic-ii/badline.ts`

```typescript
import { 
  VICTimingContext, 
  DEFAULT_VIC_CONTEXT,
  VISIBLE_AREA,
  BADLINE_STOLEN_CYCLES 
} from './types.js';

/**
 * Badline detection and analysis
 */
export class BadlineAnalyzer {
  protected context: VICTimingContext;

  constructor(context: Partial<VICTimingContext> = {}) {
    this.context = { ...DEFAULT_VIC_CONTEXT, ...context };
  }

  /**
   * Check if a specific raster line is a badline
   * @param rasterLine - The raster line to check
   * @param yscroll - Optional YSCROLL override
   */
  isBadline(rasterLine: number, yscroll?: number): boolean {
    const scroll = yscroll ?? this.context.yscroll;
    
    // Badlines only occur in visible area when screen is on
    if (!this.context.screenEnabled) {
      return false;
    }
    
    const visible = VISIBLE_AREA[this.context.videoSystem];
    if (rasterLine < visible.start || rasterLine > visible.end) {
      return false;
    }
    
    // Badline condition: (rasterline AND $07) == (YSCROLL AND $07)
    return (rasterLine & 0x07) === (scroll & 0x07);
  }

  /**
   * Get all badline raster numbers for current YSCROLL
   */
  getBadlines(yscroll?: number): number[] {
    const scroll = yscroll ?? this.context.yscroll;
    const visible = VISIBLE_AREA[this.context.videoSystem];
    const badlines: number[] = [];
    
    if (!this.context.screenEnabled) {
      return badlines;
    }
    
    for (let line = visible.start; line <= visible.end; line++) {
      if ((line & 0x07) === (scroll & 0x07)) {
        badlines.push(line);
      }
    }
    
    return badlines;
  }

  /**
   * Calculate cycles stolen by a badline
   * @param spriteMask - Active sprites on this line ($D015 style)
   */
  getStolenCycles(spriteMask: number = 0): number {
    if (!this.context.screenEnabled) {
      return 0;
    }
    
    let stolen = BADLINE_STOLEN_CYCLES.base;
    
    // Each enabled sprite costs additional cycles
    for (let i = 0; i < 8; i++) {
      if (spriteMask & (1 << i)) {
        stolen += BADLINE_STOLEN_CYCLES.withSprite;
      }
    }
    
    return Math.min(stolen, BADLINE_STOLEN_CYCLES.max);
  }

  /**
   * Get available CPU cycles on a raster line
   */
  getAvailableCycles(rasterLine: number, spriteMask?: number): number {
    const totalCycles = this.context.columnMode === 38 
      ? 64  // 38-column mode gives 1 extra cycle
      : 63;
    
    if (this.isBadline(rasterLine)) {
      const stolen = this.getStolenCycles(spriteMask ?? this.context.spritesEnabled);
      return totalCycles - stolen;
    }
    
    return totalCycles;
  }

  /**
   * Check if code will cross a badline
   * @param startLine - Starting raster line
   * @param cycles - Total cycles the code takes
   */
  willCrossBadline(startLine: number, cycles: number): {
    crosses: boolean;
    affectedLines: number[];
    cyclesLost: number;
  } {
    if (typeof startLine !== 'number' || this.context.rasterLine === 'unknown') {
      // Cannot determine without known raster position
      return { crosses: false, affectedLines: [], cyclesLost: 0 };
    }
    
    const totalCycles = this.context.columnMode === 38 ? 64 : 63;
    let currentLine = startLine;
    let remainingCycles = cycles;
    const affectedLines: number[] = [];
    let cyclesLost = 0;
    
    while (remainingCycles > 0) {
      const available = this.getAvailableCycles(currentLine);
      
      if (this.isBadline(currentLine)) {
        affectedLines.push(currentLine);
        cyclesLost += this.getStolenCycles();
      }
      
      remainingCycles -= available;
      currentLine++;
      
      // Wrap around for PAL (312 lines) / NTSC (263 lines)
      const maxLines = this.context.videoSystem === 'PAL' ? 312 : 263;
      if (currentLine >= maxLines) {
        currentLine = 0;
      }
    }
    
    return {
      crosses: affectedLines.length > 0,
      affectedLines,
      cyclesLost,
    };
  }

  /**
   * Update timing context
   */
  setContext(context: Partial<VICTimingContext>): void {
    this.context = { ...this.context, ...context };
  }
}
```

### File: `vic-ii/timing.ts`

```typescript
import { VICTimingContext, CYCLES_PER_LINE } from './types.js';
import { BadlineAnalyzer } from './badline.js';

/**
 * Code region timing constraints
 */
export interface TimingConstraint {
  /** Region identifier */
  readonly id: string;
  /** Maximum cycles allowed */
  readonly maxCycles: number;
  /** Whether badlines should be avoided */
  readonly avoidBadlines: boolean;
  /** Specific raster lines (if known) */
  readonly rasterLines?: number[];
}

/**
 * Timing analysis result
 */
export interface TimingAnalysis {
  /** Total cycles without badline interference */
  readonly baseCycles: number;
  /** Total cycles with worst-case badline interference */
  readonly worstCaseCycles: number;
  /** Whether timing constraint is met */
  readonly constraintMet: boolean;
  /** Suggested optimizations */
  readonly suggestions: TimingSuggestion[];
}

/**
 * Timing optimization suggestion
 */
export interface TimingSuggestion {
  readonly type: 'move-code' | 'split-loop' | 'unroll' | 'use-irq' | 'disable-screen';
  readonly description: string;
  readonly cyclesSaved: number;
}

/**
 * Timing analyzer for badline-aware code generation
 */
export class BadlineTimingAnalyzer {
  protected badlineAnalyzer: BadlineAnalyzer;

  constructor(context?: Partial<VICTimingContext>) {
    this.badlineAnalyzer = new BadlineAnalyzer(context);
  }

  /**
   * Analyze code timing with badline awareness
   */
  analyzeRegion(
    instructions: { cycles: number }[],
    constraint: TimingConstraint
  ): TimingAnalysis {
    const baseCycles = instructions.reduce((sum, i) => sum + i.cycles, 0);
    
    // Calculate worst-case with badlines
    let worstCaseCycles = baseCycles;
    const cyclesPerLine = CYCLES_PER_LINE[this.badlineAnalyzer['context'].videoSystem];
    
    if (constraint.avoidBadlines) {
      // Assume code might cross badlines
      const linesSpanned = Math.ceil(baseCycles / cyclesPerLine);
      const badlinesInRange = Math.ceil(linesSpanned / 8); // Badline every 8 lines
      const stolenPerBadline = 40; // Conservative estimate
      worstCaseCycles = baseCycles + (badlinesInRange * stolenPerBadline);
    }
    
    const constraintMet = worstCaseCycles <= constraint.maxCycles;
    const suggestions = this.generateSuggestions(
      baseCycles, 
      worstCaseCycles, 
      constraint
    );
    
    return {
      baseCycles,
      worstCaseCycles,
      constraintMet,
      suggestions,
    };
  }

  /**
   * Calculate safe cycle budget for a raster region
   * @param startLine - First raster line
   * @param endLine - Last raster line
   */
  getSafeCycleBudget(startLine: number, endLine: number): number {
    let totalCycles = 0;
    
    for (let line = startLine; line <= endLine; line++) {
      totalCycles += this.badlineAnalyzer.getAvailableCycles(line);
    }
    
    return totalCycles;
  }

  /**
   * Find optimal code placement to avoid badlines
   * @param requiredCycles - Cycles needed for code
   * @param preferredStart - Preferred starting line
   */
  findOptimalPlacement(
    requiredCycles: number,
    preferredStart?: number
  ): { startLine: number; endLine: number; totalCycles: number } | null {
    const context = this.badlineAnalyzer['context'];
    const visible = context.videoSystem === 'PAL' 
      ? { start: 51, end: 250 }
      : { start: 51, end: 250 };
    
    // Try starting from preferred line or top of screen
    const startSearch = preferredStart ?? visible.start;
    
    // Look for a region with enough cycles
    for (let start = startSearch; start <= visible.end; start++) {
      let accumulated = 0;
      let line = start;
      
      while (accumulated < requiredCycles && line <= visible.end) {
        accumulated += this.badlineAnalyzer.getAvailableCycles(line);
        line++;
      }
      
      if (accumulated >= requiredCycles) {
        return {
          startLine: start,
          endLine: line - 1,
          totalCycles: accumulated,
        };
      }
    }
    
    return null; // Cannot fit in visible area
  }

  /**
   * Generate optimization suggestions
   */
  protected generateSuggestions(
    baseCycles: number,
    worstCase: number,
    constraint: TimingConstraint
  ): TimingSuggestion[] {
    const suggestions: TimingSuggestion[] = [];
    const excess = worstCase - constraint.maxCycles;
    
    if (excess <= 0) {
      return suggestions; // No optimization needed
    }
    
    // Suggest disabling screen for large cycle requirements
    if (excess > 200) {
      suggestions.push({
        type: 'disable-screen',
        description: 'Disable screen ($D011 bit 4=0) during operation to eliminate badlines',
        cyclesSaved: Math.ceil(excess * 0.8),
      });
    }
    
    // Suggest IRQ-based approach
    if (baseCycles > 100) {
      suggestions.push({
        type: 'use-irq',
        description: 'Split operation across multiple IRQ handlers between badlines',
        cyclesSaved: excess,
      });
    }
    
    // Suggest code movement
    if (excess < 100) {
      suggestions.push({
        type: 'move-code',
        description: 'Move critical section to start after badline for maximum cycles',
        cyclesSaved: Math.min(40, excess),
      });
    }
    
    // Suggest loop unrolling to avoid branch overhead
    if (baseCycles > 50 && baseCycles < 200) {
      suggestions.push({
        type: 'unroll',
        description: 'Unroll loop to reduce branch overhead and improve timing predictability',
        cyclesSaved: Math.ceil(baseCycles * 0.1),
      });
    }
    
    return suggestions;
  }

  /**
   * Update timing context
   */
  setContext(context: Partial<VICTimingContext>): void {
    this.badlineAnalyzer.setContext(context);
  }
}
```

---

## Compiler Hints

### Blend65 Syntax for Badline-Aware Code

```js
// Mark a function as timing-critical with badline awareness
@timing(maxCycles: 63, avoidBadlines: true)
function updateSprite() {
    // Compiler ensures this fits in one raster line
    @map sprite0X at $D000: byte;
    sprite0X = playerX;
}

// Specify raster region constraints
@rasterRegion(start: 51, end: 58)
function drawTopBar() {
    // Code placed to avoid badlines 51, 59
}

// Hint that screen will be disabled
@screenDisabled
function decrunch() {
    // Compiler knows badlines won't occur
}
```

---

## IL Metadata for Badline Awareness

```typescript
/**
 * Metadata keys for badline-aware optimization
 */
export enum BadlineMetadataKey {
  /** Maximum cycles allowed */
  MaxCycles = 'vic.maxCycles',
  /** Avoid badlines flag */
  AvoidBadlines = 'vic.avoidBadlines',
  /** Specific raster line */
  RasterLine = 'vic.rasterLine',
  /** Screen enabled state */
  ScreenEnabled = 'vic.screenEnabled',
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `isBadline` basic | Lines 51, 59, 67... are badlines with YSCROLL=3 |
| `isBadline` yscroll | Different YSCROLL values shift badlines |
| `isBadline` screen off | No badlines when screen disabled |
| `getBadlines` | Returns correct list of badline numbers |
| `getStolenCycles` base | 40 cycles minimum on badline |
| `getStolenCycles` sprites | Additional cycles per sprite |
| `getAvailableCycles` normal | 63 cycles on normal line |
| `getAvailableCycles` badline | 20-23 cycles on badline |
| `getAvailableCycles` 38col | 64 cycles in 38-column mode |
| `willCrossBadline` | Detect when code spans badline |
| `analyzeRegion` constraint | Verify timing constraint checks |
| `getSafeCycleBudget` | Correct total for raster range |
| `findOptimalPlacement` | Find safe region for code |
| `suggestions` screen off | Suggest disabling screen for large ops |
| `suggestions` IRQ | Suggest IRQ split for moderate ops |
| PAL vs NTSC | Different line counts handled |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `vic-ii/types.ts` | [ ] |
| Create `vic-ii/badline.ts` | [ ] |
| Create `vic-ii/timing.ts` | [ ] |
| Create `vic-ii/index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 9.1a2 → `09-01a2-vic-sprite-dma.md` (Sprite DMA cycle stealing)