# Task 9.1b1: VIC-II FLD/FLI Techniques

> **Task**: 9.1b1 of Phase 09 (Target-Specific Optimizations)  
> **Session**: 4.1b1  
> **Time**: ~2 hours  
> **Tests**: ~35 tests  
> **Prerequisites**: 09-01a1 (Badline Timing), 09-01a3 (Border Timing)

---

## Overview

Implement optimization support for FLD (Flexible Line Distance) and FLI (Flexible Line Interpretation) techniques. These advanced VIC-II tricks manipulate badlines to create visual effects. This task provides:

- FLD timing calculations and code generation
- FLI timing requirements and constraints
- Badline manipulation analysis
- Compiler support for timing-critical FLD/FLI code

---

## FLD (Flexible Line Distance)

FLD delays badlines by manipulating YSCROLL ($D011 bits 0-2), allowing smooth vertical scrolling beyond the normal 8-pixel limit and creating visual effects like "stretching" the screen.

### How FLD Works

1. On each raster line, check if it would be a badline
2. If so, change YSCROLL to prevent the badline condition
3. This "skips" the character row fetch, repeating the previous row

### FLD Timing Requirements

| Operation | Cycle | Requirement |
|-----------|-------|-------------|
| Read raster line | Early | Know current line |
| Calculate YSCROLL | - | New value to avoid badline |
| Write $D011 | Before cycle 14 | Must happen before VIC check |

### FLD Effect on Cycles

- **Without FLD**: Badline steals 40-43 cycles
- **With FLD**: Full 63 cycles available (badline prevented)
- **Cost**: ~8-12 cycles for the FLD routine itself

---

## FLI (Flexible Line Interpretation)

FLI forces a badline on every raster line by toggling YSCROLL, allowing unique color RAM for each line (1-pixel vertical color resolution).

### How FLI Works

1. On each raster line, force a badline condition
2. VIC fetches new character pointers every line
3. Color RAM can be different for each raster line

### FLI Bug

Due to timing constraints, the first 3 characters of each line display garbage colors (the "FLI bug"). Code must account for this.

### FLI Timing Requirements

| Operation | Cycle | Requirement |
|-----------|-------|-------------|
| Set YSCROLL | Before cycle 14 | Trigger badline |
| Restore YSCROLL | After cycle 14 | Prevent double badline |
| Total per line | ~20-25 cycles | Timing-critical loop |

---

## Directory Structure

```
packages/compiler/src/optimizer/target/vic-ii/
├── index.ts           # Exports
├── badline.ts         # From 09-01a1
├── timing.ts          # From 09-01a1
├── border-timing.ts   # From 09-01a3
├── fld.ts             # FLD analysis and generation (THIS TASK)
├── fli.ts             # FLI analysis and generation (THIS TASK)
└── types.ts           # Extended types
```

---

## Implementation

### File: `vic-ii/types.ts` (Extended)

```typescript
/**
 * FLD configuration
 */
export interface FLDConfig {
  /** Starting raster line */
  readonly startLine: number;
  /** Number of lines to stretch */
  readonly stretchLines: number;
  /** Base YSCROLL value */
  readonly baseYscroll: number;
}

/**
 * FLI configuration
 */
export interface FLIConfig {
  /** Starting raster line (typically 50) */
  readonly startLine: number;
  /** Number of FLI lines (typically 200) */
  readonly lineCount: number;
  /** Memory bank for color data */
  readonly colorBank: number;
  /** Whether to use IFLI (interlaced FLI) */
  readonly interlaced: boolean;
}

/**
 * FLI bug workaround options
 */
export enum FLIBugWorkaround {
  /** No workaround - accept 3 garbage columns */
  None = 'none',
  /** Use sprites to cover garbage */
  SpriteCover = 'sprite-cover',
  /** Position graphics to hide garbage */
  LayoutAdjust = 'layout-adjust',
}

/**
 * Timing constants for FLD/FLI
 */
export const FLD_FLI_TIMING = {
  /** Cycle by which $D011 must be written for badline control */
  yscrollDeadline: 14,
  /** Cycles for typical FLD routine */
  fldCyclesPerLine: 10,
  /** Cycles for typical FLI routine */
  fliCyclesPerLine: 23,
  /** FLI bug columns */
  fliBugColumns: 3,
} as const;
```

### File: `vic-ii/fld.ts`

```typescript
import { FLDConfig, FLD_FLI_TIMING } from './types.js';
import { BadlineAnalyzer } from './badline.js';

/**
 * FLD effect analysis result
 */
export interface FLDAnalysis {
  /** Lines affected by FLD */
  readonly affectedLines: number[];
  /** YSCROLL values to use per line */
  readonly yscrollSequence: number[];
  /** Total cycles consumed by FLD routine */
  readonly totalCycles: number;
  /** Cycles saved by preventing badlines */
  readonly cyclesSaved: number;
  /** Net cycle gain/loss */
  readonly netCycleChange: number;
}

/**
 * FLD code generation result
 */
export interface FLDCode {
  /** Generated assembly instructions */
  readonly assembly: string[];
  /** Required zero page locations */
  readonly zeroPageNeeded: number;
  /** Self-modifying code locations */
  readonly smcLocations: number[];
  /** Total bytes of code */
  readonly codeBytes: number;
}

/**
 * FLD (Flexible Line Distance) analyzer and generator
 */
export class FLDAnalyzer {
  protected badlineAnalyzer: BadlineAnalyzer;
  protected videoSystem: 'PAL' | 'NTSC';

  constructor(videoSystem: 'PAL' | 'NTSC' = 'PAL') {
    this.videoSystem = videoSystem;
    this.badlineAnalyzer = new BadlineAnalyzer({ videoSystem });
  }

  /**
   * Analyze FLD effect requirements
   */
  analyze(config: FLDConfig): FLDAnalysis {
    const affectedLines: number[] = [];
    const yscrollSequence: number[] = [];
    
    let currentYscroll = config.baseYscroll;
    
    for (let i = 0; i < config.stretchLines; i++) {
      const line = config.startLine + i;
      affectedLines.push(line);
      
      // Calculate YSCROLL to avoid badline
      // Badline occurs when (rasterline & 7) == (YSCROLL & 7)
      // So we set YSCROLL to something that doesn't match
      const rasterLow = line & 0x07;
      let newYscroll = (rasterLow + 1) & 0x07; // One ahead, never matches
      
      // Preserve other bits of $D011 (screen on, 25 rows, etc.)
      newYscroll = (config.baseYscroll & 0xF8) | newYscroll;
      
      yscrollSequence.push(newYscroll);
      currentYscroll = newYscroll;
    }
    
    // Calculate timing
    const cyclesPerFLD = FLD_FLI_TIMING.fldCyclesPerLine;
    const totalCycles = config.stretchLines * cyclesPerFLD;
    
    // Badlines would have stolen ~40 cycles each
    // FLD prevents (stretchLines / 8) badlines approximately
    const preventedBadlines = Math.floor(config.stretchLines / 8);
    const cyclesSaved = preventedBadlines * 40;
    
    return {
      affectedLines,
      yscrollSequence,
      totalCycles,
      cyclesSaved,
      netCycleChange: cyclesSaved - totalCycles,
    };
  }

  /**
   * Calculate YSCROLL value to prevent badline on given raster line
   */
  calculatePreventYscroll(rasterLine: number, baseYscroll: number): number {
    const rasterLow = rasterLine & 0x07;
    // Choose a value that doesn't match
    let newLow = (rasterLow + 1) & 0x07;
    return (baseYscroll & 0xF8) | newLow;
  }

  /**
   * Generate FLD routine code
   */
  generateCode(config: FLDConfig): FLDCode {
    const analysis = this.analyze(config);
    const assembly: string[] = [];
    
    assembly.push('; FLD (Flexible Line Distance) Routine');
    assembly.push('; Prevents badlines to stretch display');
    assembly.push('');
    assembly.push('fld_start:');
    assembly.push(`    LDX #${config.stretchLines}  ; Number of lines to stretch`);
    assembly.push('fld_loop:');
    assembly.push('    LDA $D012          ; Get current raster line');
    assembly.push('    AND #$07           ; Get low 3 bits');
    assembly.push('    CLC');
    assembly.push('    ADC #$01           ; Add 1 to avoid badline');
    assembly.push('    AND #$07           ; Wrap to 0-7');
    assembly.push(`    ORA #$${(config.baseYscroll & 0xF8).toString(16).padStart(2, '0')}  ; Combine with base`);
    assembly.push('    STA $D011          ; Set new YSCROLL');
    assembly.push('    DEX');
    assembly.push('    BNE fld_loop');
    assembly.push('');
    assembly.push(`    LDA #$${config.baseYscroll.toString(16).padStart(2, '0')}  ; Restore original`);
    assembly.push('    STA $D011');
    
    return {
      assembly,
      zeroPageNeeded: 0,
      smcLocations: [],
      codeBytes: assembly.length * 3, // Rough estimate
    };
  }

  /**
   * Generate unrolled FLD code for specific line count
   * More cycles but deterministic timing
   */
  generateUnrolledCode(config: FLDConfig): FLDCode {
    const analysis = this.analyze(config);
    const assembly: string[] = [];
    
    assembly.push('; Unrolled FLD Routine');
    assembly.push('; Precise timing, no loops');
    assembly.push('');
    
    for (let i = 0; i < analysis.yscrollSequence.length; i++) {
      const yscroll = analysis.yscrollSequence[i];
      assembly.push(`    LDA #$${yscroll.toString(16).padStart(2, '0')}           ; Line ${config.startLine + i}`);
      assembly.push('    STA $D011');
      
      // Wait for next line (63 cycles PAL - ~6 cycles used = ~57 NOPs/2 = ~28 NOPs)
      assembly.push('    ; ... timing delay ...');
    }
    
    assembly.push('');
    assembly.push(`    LDA #$${config.baseYscroll.toString(16).padStart(2, '0')}           ; Restore`);
    assembly.push('    STA $D011');
    
    return {
      assembly,
      zeroPageNeeded: 0,
      smcLocations: [],
      codeBytes: analysis.yscrollSequence.length * 10 + 6,
    };
  }

  /**
   * Check if FLD is beneficial for given scenario
   */
  isBeneficial(config: FLDConfig): {
    beneficial: boolean;
    reason: string;
    netCycles: number;
  } {
    const analysis = this.analyze(config);
    
    if (analysis.netCycleChange > 0) {
      return {
        beneficial: true,
        reason: `Net gain of ${analysis.netCycleChange} cycles by preventing badlines`,
        netCycles: analysis.netCycleChange,
      };
    } else if (analysis.netCycleChange === 0) {
      return {
        beneficial: false,
        reason: 'No net cycle change - FLD overhead equals badline cost',
        netCycles: 0,
      };
    } else {
      return {
        beneficial: false,
        reason: `Net loss of ${-analysis.netCycleChange} cycles - FLD overhead too high`,
        netCycles: analysis.netCycleChange,
      };
    }
  }
}
```

### File: `vic-ii/fli.ts`

```typescript
import { FLIConfig, FLIBugWorkaround, FLD_FLI_TIMING } from './types.js';

/**
 * FLI analysis result
 */
export interface FLIAnalysis {
  /** Total raster lines in FLI mode */
  readonly totalLines: number;
  /** Cycles consumed per line */
  readonly cyclesPerLine: number;
  /** Total CPU overhead */
  readonly totalCPUOverhead: number;
  /** Memory required for color data */
  readonly colorMemoryRequired: number;
  /** Whether FLI bug will be visible */
  readonly fliBugVisible: boolean;
  /** Recommended workaround */
  readonly recommendedWorkaround: FLIBugWorkaround;
}

/**
 * FLI code generation result
 */
export interface FLICode {
  /** Main FLI loop assembly */
  readonly mainLoop: string[];
  /** IRQ setup code */
  readonly irqSetup: string[];
  /** Required tables */
  readonly tables: Map<string, number[]>;
  /** Zero page locations needed */
  readonly zeroPageNeeded: number;
  /** Total code size in bytes */
  readonly codeBytes: number;
}

/**
 * FLI (Flexible Line Interpretation) analyzer and generator
 */
export class FLIAnalyzer {
  protected videoSystem: 'PAL' | 'NTSC';

  constructor(videoSystem: 'PAL' | 'NTSC' = 'PAL') {
    this.videoSystem = videoSystem;
  }

  /**
   * Analyze FLI mode requirements
   */
  analyze(config: FLIConfig): FLIAnalysis {
    const cyclesPerLine = FLD_FLI_TIMING.fliCyclesPerLine;
    const totalCPUOverhead = config.lineCount * cyclesPerLine;
    
    // FLI needs unique color RAM per line
    // 40 characters * lineCount bytes
    const colorMemoryRequired = 40 * config.lineCount;
    
    return {
      totalLines: config.lineCount,
      cyclesPerLine,
      totalCPUOverhead,
      colorMemoryRequired,
      fliBugVisible: true, // Always present in standard FLI
      recommendedWorkaround: FLIBugWorkaround.SpriteCover,
    };
  }

  /**
   * Calculate YSCROLL sequence for FLI
   */
  calculateYscrollSequence(
    startLine: number,
    lineCount: number,
    baseYscroll: number = 0x1B
  ): { line: number; yscroll: number }[] {
    const sequence: { line: number; yscroll: number }[] = [];
    
    for (let i = 0; i < lineCount; i++) {
      const line = startLine + i;
      // Force badline by matching YSCROLL to raster line
      const forceBadline = (baseYscroll & 0xF8) | (line & 0x07);
      
      sequence.push({
        line,
        yscroll: forceBadline,
      });
    }
    
    return sequence;
  }

  /**
   * Generate FLI loop code
   */
  generateCode(config: FLIConfig): FLICode {
    const mainLoop: string[] = [];
    const irqSetup: string[] = [];
    const tables = new Map<string, number[]>();
    
    // Generate YSCROLL table
    const yscrollTable: number[] = [];
    for (let i = 0; i < config.lineCount; i++) {
      const line = config.startLine + i;
      yscrollTable.push(0x18 | (line & 0x07)); // $D011 value to force badline
    }
    tables.set('fli_d011_table', yscrollTable);
    
    // Generate $D018 table (video matrix address for each line)
    const d018Table: number[] = [];
    for (let i = 0; i < config.lineCount; i++) {
      // Alternate between banks for different color data
      const bank = (i & 0x07) << 4;
      d018Table.push(bank | 0x08); // Char ROM at $2000
    }
    tables.set('fli_d018_table', d018Table);
    
    // IRQ setup
    irqSetup.push('; FLI IRQ Setup');
    irqSetup.push('    SEI');
    irqSetup.push('    LDA #<fli_irq');
    irqSetup.push('    STA $0314');
    irqSetup.push('    LDA #>fli_irq');
    irqSetup.push('    STA $0315');
    irqSetup.push(`    LDA #${config.startLine - 1}`);
    irqSetup.push('    STA $D012');
    irqSetup.push('    LDA $D011');
    irqSetup.push('    AND #$7F');
    irqSetup.push('    STA $D011         ; Clear raster bit 8');
    irqSetup.push('    LDA #$01');
    irqSetup.push('    STA $D01A         ; Enable raster IRQ');
    irqSetup.push('    CLI');
    
    // Main FLI loop
    mainLoop.push('; FLI Main Loop');
    mainLoop.push('fli_irq:');
    mainLoop.push('    PHA');
    mainLoop.push('    TXA');
    mainLoop.push('    PHA');
    mainLoop.push('    TYA');
    mainLoop.push('    PHA');
    mainLoop.push('');
    mainLoop.push('    LDX #$00          ; Line counter');
    mainLoop.push('fli_loop:');
    mainLoop.push('    LDA $D012         ; Wait for raster');
    mainLoop.push('fli_wait:');
    mainLoop.push('    CMP $D012');
    mainLoop.push('    BEQ fli_wait');
    mainLoop.push('');
    mainLoop.push('    LDA fli_d011_table,X  ; Get YSCROLL value');
    mainLoop.push('    STA $D011            ; Force badline');
    mainLoop.push('    LDA fli_d018_table,X  ; Get video bank');
    mainLoop.push('    STA $D018            ; Set video matrix');
    mainLoop.push('');
    mainLoop.push('    INX');
    mainLoop.push(`    CPX #${config.lineCount}`);
    mainLoop.push('    BNE fli_loop');
    mainLoop.push('');
    mainLoop.push('    ; Restore normal mode');
    mainLoop.push('    LDA #$1B');
    mainLoop.push('    STA $D011');
    mainLoop.push('    LDA #$08');
    mainLoop.push('    STA $D018');
    mainLoop.push('');
    mainLoop.push('    PLA');
    mainLoop.push('    TAY');
    mainLoop.push('    PLA');
    mainLoop.push('    TAX');
    mainLoop.push('    PLA');
    mainLoop.push('    ASL $D019         ; Acknowledge IRQ');
    mainLoop.push('    RTI');
    
    return {
      mainLoop,
      irqSetup,
      tables,
      zeroPageNeeded: 1, // Loop counter
      codeBytes: mainLoop.length * 3 + irqSetup.length * 3,
    };
  }

  /**
   * Generate code for FLI bug workaround using sprites
   */
  generateBugWorkaroundSprites(): string[] {
    const code: string[] = [];
    
    code.push('; FLI Bug Workaround - Sprite Cover');
    code.push('; Uses sprites 0-2 to cover the 3 garbage columns');
    code.push('');
    code.push('    ; Enable sprites 0-2');
    code.push('    LDA #$07');
    code.push('    STA $D015');
    code.push('');
    code.push('    ; Position sprites at left edge');
    code.push('    LDA #$18            ; X position');
    code.push('    STA $D000           ; Sprite 0 X');
    code.push('    STA $D002           ; Sprite 1 X');
    code.push('    STA $D004           ; Sprite 2 X');
    code.push('');
    code.push('    ; Expand sprites vertically');
    code.push('    LDA #$07');
    code.push('    STA $D017');
    code.push('');
    code.push('    ; Set sprite color to background');
    code.push('    LDA $D021           ; Get background color');
    code.push('    STA $D027           ; Sprite 0 color');
    code.push('    STA $D028           ; Sprite 1 color');
    code.push('    STA $D029           ; Sprite 2 color');
    
    return code;
  }

  /**
   * Check if FLI is feasible given CPU requirements
   */
  isFeasible(config: FLIConfig): {
    feasible: boolean;
    reason: string;
    cpuUsagePercent: number;
  } {
    const analysis = this.analyze(config);
    
    // FLI consumes most CPU time during display
    // ~23 cycles per line out of 63 = ~36% baseline
    // Plus the IRQ overhead
    const cpuUsagePercent = (analysis.cyclesPerLine / 63) * 100;
    
    if (cpuUsagePercent > 50) {
      return {
        feasible: true,
        reason: 'FLI is feasible but leaves limited CPU for game logic',
        cpuUsagePercent,
      };
    }
    
    return {
      feasible: true,
      reason: 'FLI is feasible with acceptable CPU overhead',
      cpuUsagePercent,
    };
  }
}
```

---

## Blend65 Syntax for FLD/FLI

```js
// Enable FLD effect
@fld(startLine: 100, stretchLines: 16)
function stretchEffect() {
    // Compiler generates FLD timing code
}

// Enable FLI mode
@fli(startLine: 50, lineCount: 200, bugWorkaround: "sprite-cover")
function fliDisplay() {
    // Compiler sets up FLI with sprite cover for bug
}

// Manual FLD control
@inlineAsm
function customFLD() {
    asm {
        LDA #$18
        STA $D011   ; Prevent badline
    }
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| FLD `analyze` basic | Correct line and YSCROLL sequence |
| FLD `calculatePreventYscroll` | Correct avoidance value |
| FLD `generateCode` | Valid assembly output |
| FLD `generateUnrolledCode` | Unrolled timing correct |
| FLD `isBeneficial` positive | Identifies beneficial cases |
| FLD `isBeneficial` negative | Identifies non-beneficial cases |
| FLI `analyze` | Correct cycle and memory calculations |
| FLI `calculateYscrollSequence` | Correct forcing values |
| FLI `generateCode` mainLoop | Valid FLI loop |
| FLI `generateCode` irqSetup | Valid IRQ configuration |
| FLI `generateCode` tables | Correct D011/D018 tables |
| FLI bug workaround | Sprite cover code correct |
| FLI `isFeasible` | Correct CPU usage calculation |
| PAL vs NTSC | Different timing constants |

---

## Task Checklist

| Item | Status |
|------|--------|
| Extend `vic-ii/types.ts` with FLD/FLI types | [ ] |
| Create `vic-ii/fld.ts` | [ ] |
| Create `vic-ii/fli.ts` | [ ] |
| Update `vic-ii/index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 9.1b2 → `09-01b2-vic-vsp-agsp.md` (VSP/AGSP techniques)