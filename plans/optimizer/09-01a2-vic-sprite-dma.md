# Task 9.1a2: VIC-II Sprite DMA Cycle Stealing

> **Task**: 9.1a2 of Phase 09 (Target-Specific Optimizations)  
> **Session**: 4.1a2  
> **Time**: ~2 hours  
> **Tests**: ~35 tests  
> **Prerequisites**: 09-01a1 (Badline Timing)

---

## Overview

Implement sprite DMA-aware cycle accounting. VIC-II steals additional CPU cycles when sprites are enabled, independent of badlines. This task provides:

- Sprite DMA timing analysis
- Per-sprite cycle cost calculations
- Sprite-aware code scheduling
- Multiplexer-friendly timing hints

---

## Sprite DMA Fundamentals

The VIC-II fetches sprite data via DMA, stealing CPU cycles in the process. Unlike badlines, sprite DMA occurs on every raster line where a sprite is vertically present.

### Sprite DMA Cycle Cost

| Sprites Active | Additional Cycles Stolen |
|----------------|-------------------------|
| 0 sprites | 0 cycles |
| 1 sprite | 2 cycles |
| 2 sprites | 4 cycles |
| 3 sprites | 6 cycles |
| ... | ... |
| 8 sprites | 16 cycles |

**Note**: DMA occurs for a sprite on lines where `(rasterline >= sprite_Y) && (rasterline < sprite_Y + 21)`

### When Sprite DMA Occurs

Sprite DMA happens in two phases:
1. **P-access** (pointer fetch): 1 cycle per sprite, during horizontal blanking
2. **S-access** (sprite data): 2 cycles per sprite per line

```
Per-sprite cost per line: 3 cycles total (1 pointer + 2 data)
But VIC design: ~2 cycles effectively stolen per enabled sprite
```

---

## Directory Structure

```
packages/compiler/src/optimizer/target/vic-ii/
├── index.ts           # Exports
├── badline.ts         # From 09-01a1
├── timing.ts          # From 09-01a1
├── sprite-dma.ts      # Sprite DMA analysis (THIS TASK)
├── sprite-timing.ts   # Combined timing (THIS TASK)
└── types.ts           # Extended types
```

---

## Implementation

### File: `vic-ii/types.ts` (Extended)

```typescript
/**
 * Sprite configuration for timing analysis
 */
export interface SpriteConfig {
  /** Sprite index (0-7) */
  readonly index: number;
  /** Y position ($D001, $D003, etc.) */
  readonly y: number;
  /** Whether sprite is enabled in $D015 */
  readonly enabled: boolean;
  /** Whether sprite is expanded vertically ($D017) */
  readonly expandY: boolean;
}

/**
 * Sprite DMA timing constants
 */
export const SPRITE_DMA_CYCLES = {
  /** Cycles stolen per enabled sprite per line */
  perSprite: 2,
  /** Maximum sprites */
  maxSprites: 8,
  /** Sprite height in lines (normal) */
  normalHeight: 21,
  /** Sprite height in lines (Y-expanded) */
  expandedHeight: 42,
} as const;

/**
 * Default sprite configuration (all disabled)
 */
export const DEFAULT_SPRITES: SpriteConfig[] = Array.from(
  { length: 8 },
  (_, i) => ({
    index: i,
    y: 0,
    enabled: false,
    expandY: false,
  })
);
```

### File: `vic-ii/sprite-dma.ts`

```typescript
import { SpriteConfig, SPRITE_DMA_CYCLES, DEFAULT_SPRITES } from './types.js';

/**
 * Sprite DMA analysis result for a raster line
 */
export interface SpriteDMAResult {
  /** Raster line analyzed */
  readonly rasterLine: number;
  /** Sprites present on this line */
  readonly activeSprites: number[];
  /** Total DMA cycles stolen */
  readonly cyclesStolen: number;
  /** Available cycles after DMA */
  readonly availableCycles: number;
}

/**
 * Sprite range information
 */
export interface SpriteRange {
  /** Sprite index */
  readonly sprite: number;
  /** First raster line with DMA */
  readonly startLine: number;
  /** Last raster line with DMA */
  readonly endLine: number;
  /** Total lines affected */
  readonly lineCount: number;
}

/**
 * Sprite DMA cycle analyzer
 */
export class SpriteDMAAnalyzer {
  protected sprites: SpriteConfig[];
  protected baseCyclesPerLine: number;

  constructor(
    sprites: Partial<SpriteConfig>[] = [],
    baseCyclesPerLine: number = 63
  ) {
    this.sprites = this.mergeSprites(sprites);
    this.baseCyclesPerLine = baseCyclesPerLine;
  }

  /**
   * Merge provided sprites with defaults
   */
  protected mergeSprites(provided: Partial<SpriteConfig>[]): SpriteConfig[] {
    const result = [...DEFAULT_SPRITES];
    
    for (const sprite of provided) {
      if (sprite.index !== undefined && sprite.index >= 0 && sprite.index < 8) {
        result[sprite.index] = {
          ...result[sprite.index],
          ...sprite,
        };
      }
    }
    
    return result;
  }

  /**
   * Get sprites active on a specific raster line
   */
  getActiveSprites(rasterLine: number): number[] {
    const active: number[] = [];
    
    for (const sprite of this.sprites) {
      if (!sprite.enabled) continue;
      
      const height = sprite.expandY 
        ? SPRITE_DMA_CYCLES.expandedHeight 
        : SPRITE_DMA_CYCLES.normalHeight;
      
      const startY = sprite.y;
      const endY = sprite.y + height - 1;
      
      if (rasterLine >= startY && rasterLine <= endY) {
        active.push(sprite.index);
      }
    }
    
    return active;
  }

  /**
   * Calculate DMA cycles stolen on a raster line
   */
  getDMACycles(rasterLine: number): number {
    const active = this.getActiveSprites(rasterLine);
    return active.length * SPRITE_DMA_CYCLES.perSprite;
  }

  /**
   * Analyze DMA impact on a specific raster line
   */
  analyzeLine(rasterLine: number): SpriteDMAResult {
    const activeSprites = this.getActiveSprites(rasterLine);
    const cyclesStolen = activeSprites.length * SPRITE_DMA_CYCLES.perSprite;
    
    return {
      rasterLine,
      activeSprites,
      cyclesStolen,
      availableCycles: this.baseCyclesPerLine - cyclesStolen,
    };
  }

  /**
   * Analyze DMA impact across a range of raster lines
   */
  analyzeRange(startLine: number, endLine: number): SpriteDMAResult[] {
    const results: SpriteDMAResult[] = [];
    
    for (let line = startLine; line <= endLine; line++) {
      results.push(this.analyzeLine(line));
    }
    
    return results;
  }

  /**
   * Get the raster range where each sprite causes DMA
   */
  getSpriteRanges(): SpriteRange[] {
    const ranges: SpriteRange[] = [];
    
    for (const sprite of this.sprites) {
      if (!sprite.enabled) continue;
      
      const height = sprite.expandY 
        ? SPRITE_DMA_CYCLES.expandedHeight 
        : SPRITE_DMA_CYCLES.normalHeight;
      
      ranges.push({
        sprite: sprite.index,
        startLine: sprite.y,
        endLine: sprite.y + height - 1,
        lineCount: height,
      });
    }
    
    return ranges.sort((a, b) => a.startLine - b.startLine);
  }

  /**
   * Find raster lines with no sprite DMA (sprite-free zones)
   */
  findSpriteFreeZones(startLine: number, endLine: number): {
    start: number;
    end: number;
    length: number;
  }[] {
    const zones: { start: number; end: number; length: number }[] = [];
    let zoneStart: number | null = null;
    
    for (let line = startLine; line <= endLine; line++) {
      const active = this.getActiveSprites(line);
      
      if (active.length === 0) {
        if (zoneStart === null) {
          zoneStart = line;
        }
      } else {
        if (zoneStart !== null) {
          zones.push({
            start: zoneStart,
            end: line - 1,
            length: line - zoneStart,
          });
          zoneStart = null;
        }
      }
    }
    
    // Handle zone extending to end
    if (zoneStart !== null) {
      zones.push({
        start: zoneStart,
        end: endLine,
        length: endLine - zoneStart + 1,
      });
    }
    
    return zones;
  }

  /**
   * Calculate total cycles available in a region accounting for sprite DMA
   */
  getTotalAvailableCycles(startLine: number, endLine: number): number {
    let total = 0;
    
    for (let line = startLine; line <= endLine; line++) {
      const dmaCycles = this.getDMACycles(line);
      total += this.baseCyclesPerLine - dmaCycles;
    }
    
    return total;
  }

  /**
   * Update sprite configuration
   */
  setSprite(index: number, config: Partial<SpriteConfig>): void {
    if (index >= 0 && index < 8) {
      this.sprites[index] = {
        ...this.sprites[index],
        ...config,
        index, // Ensure index is correct
      };
    }
  }

  /**
   * Enable/disable a sprite
   */
  setSpriteEnabled(index: number, enabled: boolean): void {
    this.setSprite(index, { enabled });
  }

  /**
   * Set sprite Y position
   */
  setSpriteY(index: number, y: number): void {
    this.setSprite(index, { y });
  }

  /**
   * Get current sprite configuration
   */
  getSprites(): readonly SpriteConfig[] {
    return this.sprites;
  }
}
```

### File: `vic-ii/sprite-timing.ts`

```typescript
import { VICTimingContext, DEFAULT_VIC_CONTEXT, SpriteConfig } from './types.js';
import { BadlineAnalyzer } from './badline.js';
import { SpriteDMAAnalyzer, SpriteDMAResult } from './sprite-dma.js';

/**
 * Combined timing analysis result (badlines + sprites)
 */
export interface CombinedTimingResult {
  /** Raster line */
  readonly rasterLine: number;
  /** Is this a badline? */
  readonly isBadline: boolean;
  /** Cycles stolen by badline */
  readonly badlineCycles: number;
  /** Active sprites on this line */
  readonly activeSprites: number[];
  /** Cycles stolen by sprite DMA */
  readonly spriteDMACycles: number;
  /** Total cycles stolen */
  readonly totalCyclesStolen: number;
  /** Available CPU cycles */
  readonly availableCycles: number;
}

/**
 * Timing window for code placement
 */
export interface TimingWindow {
  /** First usable raster line */
  readonly startLine: number;
  /** Last usable raster line */
  readonly endLine: number;
  /** Minimum cycles available per line in window */
  readonly minCyclesPerLine: number;
  /** Total cycles available in window */
  readonly totalCycles: number;
  /** Lines with badlines in window */
  readonly badlineCount: number;
  /** Maximum sprites on any line in window */
  readonly maxSpritesOnLine: number;
}

/**
 * Combined VIC-II timing analyzer (badlines + sprite DMA)
 */
export class CombinedVICTimingAnalyzer {
  protected badlineAnalyzer: BadlineAnalyzer;
  protected spriteDMAAnalyzer: SpriteDMAAnalyzer;
  protected context: VICTimingContext;

  constructor(
    context?: Partial<VICTimingContext>,
    sprites?: Partial<SpriteConfig>[]
  ) {
    this.context = { ...DEFAULT_VIC_CONTEXT, ...context };
    this.badlineAnalyzer = new BadlineAnalyzer(this.context);
    
    const baseCycles = this.context.columnMode === 38 ? 64 : 63;
    this.spriteDMAAnalyzer = new SpriteDMAAnalyzer(sprites, baseCycles);
  }

  /**
   * Analyze a single raster line for all timing impacts
   */
  analyzeLine(rasterLine: number): CombinedTimingResult {
    const baseCycles = this.context.columnMode === 38 ? 64 : 63;
    const isBadline = this.badlineAnalyzer.isBadline(rasterLine);
    const badlineCycles = isBadline 
      ? this.badlineAnalyzer.getStolenCycles() 
      : 0;
    
    const spriteDMA = this.spriteDMAAnalyzer.analyzeLine(rasterLine);
    
    // Badline and sprite DMA cycles compound
    const totalCyclesStolen = badlineCycles + spriteDMA.cyclesStolen;
    const availableCycles = Math.max(0, baseCycles - totalCyclesStolen);
    
    return {
      rasterLine,
      isBadline,
      badlineCycles,
      activeSprites: spriteDMA.activeSprites,
      spriteDMACycles: spriteDMA.cyclesStolen,
      totalCyclesStolen,
      availableCycles,
    };
  }

  /**
   * Analyze a range of raster lines
   */
  analyzeRange(startLine: number, endLine: number): CombinedTimingResult[] {
    const results: CombinedTimingResult[] = [];
    
    for (let line = startLine; line <= endLine; line++) {
      results.push(this.analyzeLine(line));
    }
    
    return results;
  }

  /**
   * Find the best timing window for code requiring specified cycles
   */
  findBestWindow(
    requiredCycles: number,
    searchStart: number = 51,
    searchEnd: number = 250
  ): TimingWindow | null {
    let bestWindow: TimingWindow | null = null;
    let bestScore = -1;
    
    for (let start = searchStart; start <= searchEnd; start++) {
      // Try windows of increasing size
      for (let end = start; end <= searchEnd; end++) {
        const window = this.analyzeWindow(start, end);
        
        if (window.totalCycles >= requiredCycles) {
          // Score: prefer fewer badlines and sprites
          const score = window.minCyclesPerLine * 10 
            - window.badlineCount * 5 
            - window.maxSpritesOnLine * 2;
          
          if (score > bestScore) {
            bestScore = score;
            bestWindow = window;
          }
          
          // Found a valid window, try next start position
          break;
        }
      }
    }
    
    return bestWindow;
  }

  /**
   * Analyze a timing window
   */
  analyzeWindow(startLine: number, endLine: number): TimingWindow {
    let totalCycles = 0;
    let minCyclesPerLine = Infinity;
    let badlineCount = 0;
    let maxSpritesOnLine = 0;
    
    for (let line = startLine; line <= endLine; line++) {
      const result = this.analyzeLine(line);
      
      totalCycles += result.availableCycles;
      minCyclesPerLine = Math.min(minCyclesPerLine, result.availableCycles);
      
      if (result.isBadline) {
        badlineCount++;
      }
      
      maxSpritesOnLine = Math.max(maxSpritesOnLine, result.activeSprites.length);
    }
    
    return {
      startLine,
      endLine,
      minCyclesPerLine: minCyclesPerLine === Infinity ? 0 : minCyclesPerLine,
      totalCycles,
      badlineCount,
      maxSpritesOnLine,
    };
  }

  /**
   * Estimate execution time for code with known cycle count
   */
  estimateExecutionLines(
    startLine: number,
    totalCycles: number
  ): { endLine: number; actualCycles: number; linesUsed: number } {
    let remainingCycles = totalCycles;
    let currentLine = startLine;
    let actualCycles = 0;
    
    const maxLine = this.context.videoSystem === 'PAL' ? 311 : 262;
    
    while (remainingCycles > 0 && currentLine <= maxLine) {
      const result = this.analyzeLine(currentLine);
      const usedCycles = Math.min(remainingCycles, result.availableCycles);
      
      actualCycles += usedCycles;
      remainingCycles -= result.availableCycles;
      currentLine++;
    }
    
    return {
      endLine: currentLine - 1,
      actualCycles,
      linesUsed: currentLine - startLine,
    };
  }

  /**
   * Update sprite configuration
   */
  setSprite(index: number, config: Partial<SpriteConfig>): void {
    this.spriteDMAAnalyzer.setSprite(index, config);
  }

  /**
   * Update VIC context
   */
  setContext(context: Partial<VICTimingContext>): void {
    this.context = { ...this.context, ...context };
    this.badlineAnalyzer.setContext(context);
  }
}
```

---

## Sprite Multiplexer Considerations

When using sprite multiplexers, timing becomes critical:

```typescript
/**
 * Multiplexer timing requirements
 */
export interface MultiplexerTiming {
  /** Lines needed between reusing a sprite */
  readonly minGap: number;          // Typically 21 lines
  /** Cycles needed to reprogram sprite */
  readonly reprogramCycles: number;  // ~20-30 cycles for Y + pointer
  /** Safe zone after sprite ends */
  readonly safeZoneAfter: number;   // 1-2 lines
}

export const MULTIPLEXER_TIMING: MultiplexerTiming = {
  minGap: 21,
  reprogramCycles: 25,  // STA $D001 + STA pointer = ~8 cycles, with setup ~25
  safeZoneAfter: 2,
};
```

---

## Blend65 Syntax for Sprite-Aware Code

```js
// Mark function as sprite-timing sensitive
@spriteAware(sprites: [0, 1, 2])
function updateGameSprites() {
    // Compiler accounts for sprite 0, 1, 2 DMA
}

// Specify sprite-free region requirement
@spriteFree
function criticalTiming() {
    // Must execute in sprite-free zone
}

// Multiplexer-aware code
@multiplexer(maxSprites: 16, zones: 4)
function spriteMultiplexer() {
    // Compiler generates timing-safe mux code
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `getActiveSprites` single | One sprite active on line |
| `getActiveSprites` multiple | Multiple sprites overlapping |
| `getActiveSprites` expanded | Y-expanded sprites cover 42 lines |
| `getActiveSprites` none | No sprites on line |
| `getDMACycles` basic | 2 cycles per sprite |
| `getDMACycles` max | 16 cycles with 8 sprites |
| `analyzeLine` combined | Correct cycles calculation |
| `analyzeRange` | Correct results for range |
| `getSpriteRanges` | Correct start/end per sprite |
| `findSpriteFreeZones` | Identify gaps between sprites |
| `getTotalAvailableCycles` | Sum across range |
| Combined badline+sprite | Both effects compound |
| `findBestWindow` | Optimal window selection |
| `estimateExecutionLines` | Correct line count estimate |
| Multiplexer gap | Minimum 21-line gap respected |
| Enable/disable sprite | Configuration updates work |

---

## Task Checklist

| Item | Status |
|------|--------|
| Extend `vic-ii/types.ts` with sprite types | [ ] |
| Create `vic-ii/sprite-dma.ts` | [ ] |
| Create `vic-ii/sprite-timing.ts` | [ ] |
| Update `vic-ii/index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 9.1a3 → `09-01a3-vic-border-timing.md` (Border open/close timing)