# Task 9.1b3: VIC-II Side/Vertical Border Opening Effects

> **Task**: 9.1b3 of Phase 09 (Target-Specific Optimizations)  
> **Session**: 4.1b3  
> **Time**: ~2 hours  
> **Tests**: ~35 tests  
> **Prerequisites**: 09-01a3 (Border Timing), 09-01b1 (FLD/FLI)

---

## Overview

Implement comprehensive border opening effect support. Border opening allows displaying graphics in normally hidden screen areas, used for fullscreen demos and games. This task provides:

- Side border opening (left/right) implementation
- Vertical border opening (top/bottom) implementation  
- Full border opening (all four sides)
- Sprite-in-border techniques
- Compiler support for border effects

---

## Border Opening Fundamentals

The VIC-II displays borders by comparing current pixel position with configured screen boundaries. By changing boundary configuration at precise moments, the border can be "tricked" into staying off.

### Border Types

| Border | Register | Bit | Technique |
|--------|----------|-----|-----------|
| Left/Right | $D016 | CSEL (bit 3) | Toggle 38/40 column mode |
| Top/Bottom | $D011 | RSEL (bit 3) | Toggle 24/25 row mode |

### Requirements for Border Opening

| Effect | Timing Precision | CPU Cost/Line |
|--------|------------------|---------------|
| Side border | Cycle-exact | ~12 cycles |
| Top border | Line-exact | ~8 cycles |
| Bottom border | Line-exact | ~8 cycles |
| Full border | Both | ~20 cycles |

---

## Directory Structure

```
packages/compiler/src/optimizer/target/vic-ii/
├── index.ts               # Exports
├── border-timing.ts       # From 09-01a3
├── cycle-position.ts      # From 09-01a3
├── side-border.ts         # Side border effects (THIS TASK)
├── vertical-border.ts     # Top/bottom border (THIS TASK)
├── full-border.ts         # Combined effects (THIS TASK)
├── sprite-border.ts       # Sprites in border (THIS TASK)
└── types.ts               # Extended types
```

---

## Implementation

### File: `vic-ii/types.ts` (Extended)

```typescript
/**
 * Border opening mode
 */
export enum BorderMode {
  /** Normal borders visible */
  Normal = 'normal',
  /** Side borders open (sprites visible) */
  SideOpen = 'side-open',
  /** Top border open */
  TopOpen = 'top-open',
  /** Bottom border open */
  BottomOpen = 'bottom-open',
  /** All borders open */
  FullOpen = 'full-open',
}

/**
 * Border effect configuration
 */
export interface BorderEffectConfig {
  /** Which borders to open */
  readonly mode: BorderMode;
  /** Starting raster line */
  readonly startLine: number;
  /** Ending raster line */
  readonly endLine: number;
  /** Whether to display sprites in border */
  readonly spritesInBorder: boolean;
  /** Sprite indices to show in border */
  readonly borderSprites?: number[];
}

/**
 * Side border timing constants (PAL)
 */
export const SIDE_BORDER_TIMING = {
  /** Cycle to write CSEL=0 (38 columns) */
  csel0WriteCycle: 55,
  /** Cycle to write CSEL=1 (40 columns) */
  csel1WriteCycle: 58,
  /** Value for 38-column mode */
  d016_38col: 0xC0,
  /** Value for 40-column mode */
  d016_40col: 0xC8,
} as const;

/**
 * Vertical border timing constants (PAL)
 */
export const VERTICAL_BORDER_TIMING = {
  /** Line to write RSEL=0 for top border open */
  topBorderLine: 50,
  /** Line to write RSEL=1 to restore */
  topRestoreLine: 51,
  /** Line to write RSEL=0 for bottom border open */
  bottomBorderLine: 250,
  /** Value for 24-row mode */
  d011_24row: 0x13,
  /** Value for 25-row mode */
  d011_25row: 0x1B,
} as const;
```

### File: `vic-ii/side-border.ts`

```typescript
import { BorderEffectConfig, SIDE_BORDER_TIMING } from './types.js';
import { CyclePositionTracker } from './cycle-position.js';

/**
 * Side border effect analysis
 */
export interface SideBorderAnalysis {
  /** Lines where side border is opened */
  readonly affectedLines: number[];
  /** CPU cycles required per line */
  readonly cyclesPerLine: number;
  /** Total CPU overhead */
  readonly totalCycles: number;
  /** Whether stable loop is possible */
  readonly stableLoopPossible: boolean;
}

/**
 * Side border code generation result
 */
export interface SideBorderCode {
  /** IRQ handler code */
  readonly irqHandler: string[];
  /** Stable loop code (if applicable) */
  readonly stableLoop: string[];
  /** Setup code */
  readonly setup: string[];
  /** Code size in bytes */
  readonly codeBytes: number;
}

/**
 * Side border opening analyzer and generator
 */
export class SideBorderAnalyzer {
  protected cycleTracker: CyclePositionTracker;
  protected videoSystem: 'PAL' | 'NTSC';

  constructor(videoSystem: 'PAL' | 'NTSC' = 'PAL') {
    this.videoSystem = videoSystem;
    this.cycleTracker = new CyclePositionTracker(videoSystem);
  }

  /**
   * Analyze side border effect requirements
   */
  analyze(config: BorderEffectConfig): SideBorderAnalysis {
    const lineCount = config.endLine - config.startLine + 1;
    
    // Side border opening needs ~12 cycles per line
    // LDA #$C0 (2) + STA $D016 (4) + LDA #$C8 (2) + STA $D016 (4) = 12
    const cyclesPerLine = 12;
    const totalCycles = lineCount * cyclesPerLine;
    
    // Stable loop requires exactly 63 cycles per iteration (PAL)
    // Current code uses 12 cycles, need 51 more for stable
    const stableLoopPossible = true; // Can pad with NOPs
    
    const affectedLines: number[] = [];
    for (let line = config.startLine; line <= config.endLine; line++) {
      affectedLines.push(line);
    }
    
    return {
      affectedLines,
      cyclesPerLine,
      totalCycles,
      stableLoopPossible,
    };
  }

  /**
   * Generate side border opening code
   */
  generateCode(config: BorderEffectConfig): SideBorderCode {
    const analysis = this.analyze(config);
    const irqHandler: string[] = [];
    const stableLoop: string[] = [];
    const setup: string[] = [];
    
    // Setup code
    setup.push('; Side Border Setup');
    setup.push('    SEI');
    setup.push('    LDA #<side_border_irq');
    setup.push('    STA $0314');
    setup.push('    LDA #>side_border_irq');
    setup.push('    STA $0315');
    setup.push(`    LDA #${config.startLine - 1}`);
    setup.push('    STA $D012');
    setup.push('    LDA $D011');
    setup.push('    AND #$7F');
    setup.push('    STA $D011');
    setup.push('    LDA #$01');
    setup.push('    STA $D01A');
    setup.push('    CLI');
    
    // IRQ handler with stable loop
    irqHandler.push('; Side Border IRQ Handler');
    irqHandler.push('side_border_irq:');
    irqHandler.push('    PHA');
    irqHandler.push('    TXA');
    irqHandler.push('    PHA');
    irqHandler.push('    TYA');
    irqHandler.push('    PHA');
    irqHandler.push('');
    irqHandler.push('    ; Stabilize raster (double IRQ technique)');
    irqHandler.push('    LDA #<side_border_stable');
    irqHandler.push('    STA $0314');
    irqHandler.push('    LDA #>side_border_stable');
    irqHandler.push('    STA $0315');
    irqHandler.push('    INC $D012');
    irqHandler.push('    ASL $D019');
    irqHandler.push('    TSX');
    irqHandler.push('    CLI');
    irqHandler.push('    NOP');
    irqHandler.push('    NOP');
    irqHandler.push('    NOP');
    irqHandler.push('    NOP');
    
    // Stable entry point
    stableLoop.push('; Stable Side Border Loop');
    stableLoop.push('side_border_stable:');
    stableLoop.push('    TXS');
    stableLoop.push('    ; Now at exact cycle position');
    stableLoop.push('');
    stableLoop.push(`    LDX #${config.endLine - config.startLine + 1}`);
    stableLoop.push('    LDA #$C0          ; CSEL=0 (38 columns)');
    stableLoop.push('    LDY #$C8          ; CSEL=1 (40 columns)');
    stableLoop.push('');
    stableLoop.push('side_loop:');
    stableLoop.push('    ; Wait for cycle 55');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    NOP               ; 2 cycles');
    stableLoop.push('    ; At cycle ~55');
    stableLoop.push('    STA $D016         ; CSEL=0 @ cycle 55-58');
    stableLoop.push('    STY $D016         ; CSEL=1 @ cycle 59-62');
    stableLoop.push('    DEX');
    stableLoop.push('    BNE side_loop');
    stableLoop.push('');
    stableLoop.push('    ; Restore and exit');
    stableLoop.push('    LDA #<side_border_irq');
    stableLoop.push('    STA $0314');
    stableLoop.push('    LDA #>side_border_irq');
    stableLoop.push('    STA $0315');
    stableLoop.push(`    LDA #${config.startLine - 1}`);
    stableLoop.push('    STA $D012');
    stableLoop.push('');
    stableLoop.push('    PLA');
    stableLoop.push('    TAY');
    stableLoop.push('    PLA');
    stableLoop.push('    TAX');
    stableLoop.push('    PLA');
    stableLoop.push('    ASL $D019');
    stableLoop.push('    RTI');
    
    return {
      irqHandler,
      stableLoop,
      setup,
      codeBytes: (irqHandler.length + stableLoop.length + setup.length) * 3,
    };
  }

  /**
   * Generate optimized unrolled side border code
   * Faster but uses more memory
   */
  generateUnrolledCode(lineCount: number): string[] {
    const code: string[] = [];
    
    code.push('; Unrolled Side Border (one line)');
    code.push('; Total: 63 cycles per iteration');
    
    for (let i = 0; i < lineCount; i++) {
      code.push(`line_${i}:`);
      code.push('    LDA #$C0           ; 2 cycles');
      code.push('    STA $D016          ; 4 cycles - CSEL=0');
      code.push('    LDA #$C8           ; 2 cycles');
      code.push('    STA $D016          ; 4 cycles - CSEL=1');
      // Pad to 63 cycles
      code.push('    ; ... 51 cycles padding (NOPs) ...');
    }
    
    return code;
  }
}
```

### File: `vic-ii/vertical-border.ts`

```typescript
import { BorderEffectConfig, VERTICAL_BORDER_TIMING } from './types.js';

/**
 * Vertical border effect analysis
 */
export interface VerticalBorderAnalysis {
  /** Whether top border can be opened */
  readonly topBorderOpen: boolean;
  /** Whether bottom border can be opened */
  readonly bottomBorderOpen: boolean;
  /** Critical raster lines */
  readonly criticalLines: number[];
  /** Total CPU overhead */
  readonly totalCycles: number;
}

/**
 * Vertical border code generation result
 */
export interface VerticalBorderCode {
  /** Top border IRQ code */
  readonly topBorderCode: string[];
  /** Bottom border IRQ code */
  readonly bottomBorderCode: string[];
  /** Combined setup code */
  readonly setup: string[];
}

/**
 * Vertical border (top/bottom) analyzer and generator
 */
export class VerticalBorderAnalyzer {
  protected videoSystem: 'PAL' | 'NTSC';
  protected timing: typeof VERTICAL_BORDER_TIMING;

  constructor(videoSystem: 'PAL' | 'NTSC' = 'PAL') {
    this.videoSystem = videoSystem;
    this.timing = VERTICAL_BORDER_TIMING;
  }

  /**
   * Analyze vertical border requirements
   */
  analyze(config: BorderEffectConfig): VerticalBorderAnalysis {
    const topBorderOpen = config.startLine < this.timing.topRestoreLine;
    const bottomBorderOpen = config.endLine >= this.timing.bottomBorderLine;
    
    const criticalLines: number[] = [];
    if (topBorderOpen) {
      criticalLines.push(this.timing.topBorderLine);
    }
    if (bottomBorderOpen) {
      criticalLines.push(this.timing.bottomBorderLine);
    }
    
    // Vertical border opening is simpler than side border
    // Just needs one STA per border section
    const totalCycles = criticalLines.length * 8;
    
    return {
      topBorderOpen,
      bottomBorderOpen,
      criticalLines,
      totalCycles,
    };
  }

  /**
   * Generate top border opening code
   */
  generateTopBorderCode(): string[] {
    const code: string[] = [];
    
    code.push('; Top Border Opening');
    code.push('; Must execute on line 50 (before line 51)');
    code.push('');
    code.push('open_top_border:');
    code.push('    ; Wait for line 50');
    code.push('wait_line_50:');
    code.push(`    LDA #${this.timing.topBorderLine}`);
    code.push('    CMP $D012');
    code.push('    BNE wait_line_50');
    code.push('');
    code.push(`    LDA #$${this.timing.d011_24row.toString(16)}  ; RSEL=0 (24 rows)`);
    code.push('    STA $D011');
    code.push('');
    code.push('    ; Wait for line 51 then restore');
    code.push('wait_line_51:');
    code.push(`    LDA #${this.timing.topRestoreLine}`);
    code.push('    CMP $D012');
    code.push('    BNE wait_line_51');
    code.push('');
    code.push(`    LDA #$${this.timing.d011_25row.toString(16)}  ; RSEL=1 (25 rows)`);
    code.push('    STA $D011');
    
    return code;
  }

  /**
   * Generate bottom border opening code
   */
  generateBottomBorderCode(): string[] {
    const code: string[] = [];
    
    code.push('; Bottom Border Opening');
    code.push('; Must execute on or before line 250');
    code.push('');
    code.push('open_bottom_border:');
    code.push('    ; Wait for line 250');
    code.push('wait_line_250:');
    code.push(`    LDA #${this.timing.bottomBorderLine}`);
    code.push('    CMP $D012');
    code.push('    BNE wait_line_250');
    code.push('');
    code.push(`    LDA #$${this.timing.d011_24row.toString(16)}  ; RSEL=0 (24 rows)`);
    code.push('    STA $D011');
    code.push('    ; Bottom border stays open until next frame');
    
    return code;
  }

  /**
   * Generate complete vertical border code
   */
  generateCode(config: BorderEffectConfig): VerticalBorderCode {
    const analysis = this.analyze(config);
    
    const topBorderCode = analysis.topBorderOpen 
      ? this.generateTopBorderCode() 
      : [];
    const bottomBorderCode = analysis.bottomBorderOpen 
      ? this.generateBottomBorderCode() 
      : [];
    
    const setup: string[] = [];
    setup.push('; Vertical Border Setup');
    setup.push('    ; Set initial RSEL state');
    setup.push(`    LDA #$${this.timing.d011_25row.toString(16)}`);
    setup.push('    STA $D011');
    
    return {
      topBorderCode,
      bottomBorderCode,
      setup,
    };
  }
}
```

### File: `vic-ii/sprite-border.ts`

```typescript
import { BorderEffectConfig, SpriteConfig } from './types.js';

/**
 * Sprites in border analysis
 */
export interface SpriteBorderAnalysis {
  /** Which sprites can be displayed in border */
  readonly usableSprites: number[];
  /** Y positions for border sprites */
  readonly spritePositions: Map<number, number>;
  /** Additional DMA cycle cost */
  readonly dmaCycles: number;
}

/**
 * Sprites in border code generation
 */
export interface SpriteBorderCode {
  /** Sprite setup code */
  readonly setup: string[];
  /** Sprite positioning code (per line) */
  readonly positioning: string[];
  /** Multiplexer code (if needed) */
  readonly multiplexer?: string[];
}

/**
 * Sprites in border analyzer and generator
 */
export class SpriteBorderAnalyzer {
  protected videoSystem: 'PAL' | 'NTSC';

  constructor(videoSystem: 'PAL' | 'NTSC' = 'PAL') {
    this.videoSystem = videoSystem;
  }

  /**
   * Analyze sprite border requirements
   */
  analyze(
    config: BorderEffectConfig,
    sprites: SpriteConfig[]
  ): SpriteBorderAnalysis {
    const usableSprites = config.borderSprites || [0, 1, 2, 3, 4, 5, 6, 7];
    const spritePositions = new Map<number, number>();
    
    // In top border, sprites need Y < 50
    // In bottom border, sprites need Y > 250
    // In side borders, sprites can be at any Y but need X in border area
    
    for (const sprite of usableSprites) {
      if (config.startLine < 51) {
        // Top border - place sprites in top area
        spritePositions.set(sprite, 30);
      } else if (config.endLine > 250) {
        // Bottom border - place sprites in bottom area
        spritePositions.set(sprite, 260);
      }
    }
    
    // Each sprite in border adds 2 cycles DMA per line
    const dmaCycles = usableSprites.length * 2;
    
    return {
      usableSprites,
      spritePositions,
      dmaCycles,
    };
  }

  /**
   * Generate sprite border setup code
   */
  generateCode(
    config: BorderEffectConfig,
    analysis: SpriteBorderAnalysis
  ): SpriteBorderCode {
    const setup: string[] = [];
    const positioning: string[] = [];
    
    setup.push('; Sprites in Border Setup');
    setup.push('');
    
    // Enable required sprites
    let spriteMask = 0;
    for (const sprite of analysis.usableSprites) {
      spriteMask |= (1 << sprite);
    }
    setup.push(`    LDA #$${spriteMask.toString(16).padStart(2, '0')}`);
    setup.push('    STA $D015           ; Enable border sprites');
    
    // Set sprite positions
    for (const [sprite, y] of analysis.spritePositions) {
      const xReg = 0xD000 + sprite * 2;
      const yReg = 0xD001 + sprite * 2;
      
      setup.push('');
      setup.push(`    ; Sprite ${sprite} position`);
      setup.push('    LDA #$A0           ; X position (center-ish)');
      setup.push(`    STA $${xReg.toString(16)}`);
      setup.push(`    LDA #${y}            ; Y position (in border)`);
      setup.push(`    STA $${yReg.toString(16)}`);
    }
    
    // Expand sprites if in border area for visibility
    setup.push('');
    setup.push('    ; Expand sprites for visibility');
    setup.push(`    LDA #$${spriteMask.toString(16).padStart(2, '0')}`);
    setup.push('    STA $D017           ; Y-expand');
    setup.push('    STA $D01D           ; X-expand');
    
    // Positioning code for moving sprites
    positioning.push('; Move sprites in border (call each frame)');
    positioning.push('move_border_sprites:');
    for (const sprite of analysis.usableSprites) {
      const xReg = 0xD000 + sprite * 2;
      positioning.push(`    INC $${xReg.toString(16)}    ; Move sprite ${sprite}`);
    }
    positioning.push('    RTS');
    
    return {
      setup,
      positioning,
    };
  }

  /**
   * Generate multiplexed sprites in border
   * Allows more than 8 sprites using vertical reuse
   */
  generateMultiplexerCode(
    topSprites: number[],
    bottomSprites: number[]
  ): string[] {
    const code: string[] = [];
    
    code.push('; Multiplexed Border Sprites');
    code.push('; Reuses sprites between top and bottom border');
    code.push('');
    code.push('border_mux_irq:');
    code.push('    ; Called after top border sprites displayed');
    code.push('');
    
    // Reprogram sprites for bottom border
    for (let i = 0; i < Math.min(topSprites.length, bottomSprites.length); i++) {
      const sprite = topSprites[i];
      const yReg = 0xD001 + sprite * 2;
      
      code.push(`    LDA #260            ; Move sprite ${sprite} to bottom`);
      code.push(`    STA $${yReg.toString(16)}`);
    }
    
    code.push('');
    code.push('    ASL $D019');
    code.push('    RTI');
    
    return code;
  }
}
```

---

## Blend65 Syntax for Border Effects

```js
// Open side borders with sprites
@borderEffect(mode: "side-open", startLine: 51, endLine: 250, spritesInBorder: true)
function sideBorderDemo() {
    // Compiler generates stable side border code
}

// Open all borders (fullscreen)
@borderEffect(mode: "full-open", startLine: 0, endLine: 311)
function fullscreenDemo() {
    // All borders open, sprites visible everywhere
}

// Top border only
@borderEffect(mode: "top-open", startLine: 30, endLine: 50)
function topBorderEffect() {
    // Just the top border opened
}

// Sprites in border
@spritesInBorder(sprites: [0, 1, 2], region: "top")
function topBorderSprites() {
    // Sprites displayed in top border area
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| Side `analyze` line count | Correct affected lines |
| Side `analyze` cycles | Correct cycle calculation |
| Side `generateCode` IRQ | Valid IRQ handler |
| Side `generateCode` stable | Valid stable loop |
| Side `generateUnrolledCode` | Valid unrolled code |
| Vertical `analyze` top | Top border detection |
| Vertical `analyze` bottom | Bottom border detection |
| Vertical `generateTopBorderCode` | Valid top border code |
| Vertical `generateBottomBorderCode` | Valid bottom border code |
| Sprite `analyze` positions | Correct Y positions |
| Sprite `analyze` DMA | Correct DMA calculation |
| Sprite `generateCode` setup | Valid sprite setup |
| Sprite `generateCode` positioning | Valid position update |
| Sprite `generateMultiplexerCode` | Valid mux code |
| Combined side+vertical | Full border works |
| PAL vs NTSC | Different line counts |

---

## Task Checklist

| Item | Status |
|------|--------|
| Extend `vic-ii/types.ts` with border effect types | [ ] |
| Create `vic-ii/side-border.ts` | [ ] |
| Create `vic-ii/vertical-border.ts` | [ ] |
| Create `vic-ii/sprite-border.ts` | [ ] |
| Create `vic-ii/full-border.ts` (integration) | [ ] |
| Update `vic-ii/index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 9.2a → `09-02a-sid-register-timing.md` (SID register write timing)