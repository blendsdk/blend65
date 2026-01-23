# Task 9.1b2: VIC-II VSP/AGSP Techniques

> **Task**: 9.1b2 of Phase 09 (Target-Specific Optimizations)  
> **Session**: 4.1b2  
> **Time**: ~2 hours  
> **Tests**: ~30 tests  
> **Prerequisites**: 09-01a1 (Badline Timing), 09-01b1 (FLD/FLI)

---

## Overview

Implement optimization support for VSP (Variable Screen Position) and AGSP (Any Given Screen Position) techniques. These VIC-II tricks enable hardware-assisted smooth scrolling and screen positioning. This task provides:

- VSP timing and safety analysis
- AGSP implementation support
- Line crunch detection and handling
- Compiler support for scrolling effects

---

## VSP (Variable Screen Position)

VSP creates smooth vertical scrolling by manipulating when the VIC-II starts fetching screen data. It's dangerous but powerful when done correctly.

### How VSP Works

1. Change $D011 YSCROLL value at specific cycle
2. This shifts when VIC-II thinks the "first badline" occurs
3. Results in screen appearing shifted up or down
4. **DANGER**: Can cause "line crunch" crash if timing is wrong!

### VSP Timing (Critical!)

| Step | Cycle | Action |
|------|-------|--------|
| 1 | ~55-57 | Write new YSCROLL to $D011 |
| 2 | 58 | VIC reads YSCROLL for badline compare |
| 3 | After | Screen position affected |

### VSP Crash ("Line Crunch")

**WARNING**: If VSP write hits at the wrong time, it causes "line crunch":
- VIC gets confused about display state
- Screen data corrupts
- System may crash
- Certain YSCROLL values are "safe", others are dangerous

---

## AGSP (Any Given Screen Position)

AGSP is a safer evolution of VSP that allows arbitrary vertical screen positioning without the crash risk, by careful badline manipulation.

### How AGSP Works

1. Use FLD to skip lines at the top of screen
2. Use controlled YSCROLL changes
3. Result: Screen can start at any raster line
4. Safer than raw VSP because badlines are managed

### AGSP vs VSP

| Feature | VSP | AGSP |
|---------|-----|------|
| Difficulty | High | Medium |
| Crash risk | Yes | Low |
| Lines of scroll | Limited | Flexible |
| CPU cost | Low | Medium |
| Precision | 1 pixel | 1 pixel |

---

## Directory Structure

```
packages/compiler/src/optimizer/target/vic-ii/
├── index.ts           # Exports
├── badline.ts         # From 09-01a1
├── fld.ts             # From 09-01b1
├── vsp.ts             # VSP analysis and safety (THIS TASK)
├── agsp.ts            # AGSP implementation (THIS TASK)
└── types.ts           # Extended types
```

---

## Implementation

### File: `vic-ii/types.ts` (Extended)

```typescript
/**
 * VSP configuration
 */
export interface VSPConfig {
  /** Target scroll position (0-7) */
  readonly targetYscroll: number;
  /** Base $D011 value */
  readonly baseD011: number;
  /** Whether to use safe mode (slower but crash-proof) */
  readonly safeMode: boolean;
}

/**
 * AGSP configuration
 */
export interface AGSPConfig {
  /** First visible raster line */
  readonly firstVisibleLine: number;
  /** Number of visible lines */
  readonly visibleLines: number;
  /** Base YSCROLL for display */
  readonly baseYscroll: number;
}

/**
 * VSP safety state
 */
export enum VSPSafetyLevel {
  /** Known safe YSCROLL transition */
  Safe = 'safe',
  /** Potentially dangerous transition */
  Warning = 'warning',
  /** Known crash-inducing transition */
  Dangerous = 'dangerous',
}

/**
 * VSP timing constants
 */
export const VSP_TIMING = {
  /** Earliest safe write cycle */
  earliestWriteCycle: 54,
  /** Latest safe write cycle */
  latestWriteCycle: 57,
  /** Cycle where VIC samples YSCROLL */
  sampleCycle: 58,
  /** Dangerous cycles to avoid */
  dangerousCycles: [14, 15, 55] as readonly number[],
} as const;

/**
 * Known safe VSP transitions
 * Matrix of [from][to] YSCROLL values
 * true = safe, false = dangerous
 */
export const VSP_SAFE_TRANSITIONS: readonly boolean[][] = [
  // From YSCROLL 0
  [true,  true,  true,  true,  false, false, false, true],
  // From YSCROLL 1
  [true,  true,  true,  true,  true,  false, false, false],
  // From YSCROLL 2
  [false, true,  true,  true,  true,  true,  false, false],
  // From YSCROLL 3
  [false, false, true,  true,  true,  true,  true,  false],
  // From YSCROLL 4
  [false, false, false, true,  true,  true,  true,  true],
  // From YSCROLL 5
  [true,  false, false, false, true,  true,  true,  true],
  // From YSCROLL 6
  [true,  true,  false, false, false, true,  true,  true],
  // From YSCROLL 7
  [true,  true,  true,  false, false, false, true,  true],
];
```

### File: `vic-ii/vsp.ts`

```typescript
import { 
  VSPConfig, 
  VSPSafetyLevel, 
  VSP_TIMING, 
  VSP_SAFE_TRANSITIONS 
} from './types.js';

/**
 * VSP analysis result
 */
export interface VSPAnalysis {
  /** Safety level of the operation */
  readonly safetyLevel: VSPSafetyLevel;
  /** Required write cycle */
  readonly writeCycle: number;
  /** Warning message if applicable */
  readonly warning?: string;
  /** Alternative safe approach */
  readonly safeAlternative?: string;
}

/**
 * VSP code generation result
 */
export interface VSPCode {
  /** Generated assembly */
  readonly assembly: string[];
  /** Critical timing notes */
  readonly timingNotes: string[];
  /** Whether code is crash-safe */
  readonly crashSafe: boolean;
}

/**
 * VSP (Variable Screen Position) analyzer
 */
export class VSPAnalyzer {
  protected videoSystem: 'PAL' | 'NTSC';

  constructor(videoSystem: 'PAL' | 'NTSC' = 'PAL') {
    this.videoSystem = videoSystem;
  }

  /**
   * Check if a YSCROLL transition is safe
   */
  isTransitionSafe(fromYscroll: number, toYscroll: number): boolean {
    if (fromYscroll < 0 || fromYscroll > 7 || toYscroll < 0 || toYscroll > 7) {
      return false;
    }
    return VSP_SAFE_TRANSITIONS[fromYscroll][toYscroll];
  }

  /**
   * Get safety level for a VSP operation
   */
  getSafetyLevel(fromYscroll: number, toYscroll: number): VSPSafetyLevel {
    if (this.isTransitionSafe(fromYscroll, toYscroll)) {
      return VSPSafetyLevel.Safe;
    }
    
    // Some transitions are only dangerous at specific times
    const diff = Math.abs(fromYscroll - toYscroll);
    if (diff <= 2) {
      return VSPSafetyLevel.Warning;
    }
    
    return VSPSafetyLevel.Dangerous;
  }

  /**
   * Analyze a VSP operation
   */
  analyze(
    currentYscroll: number,
    config: VSPConfig
  ): VSPAnalysis {
    const safetyLevel = this.getSafetyLevel(currentYscroll, config.targetYscroll);
    
    let warning: string | undefined;
    let safeAlternative: string | undefined;
    
    if (safetyLevel === VSPSafetyLevel.Dangerous) {
      warning = `VSP transition from ${currentYscroll} to ${config.targetYscroll} may cause line crunch crash!`;
      safeAlternative = 'Use AGSP technique or transition through intermediate YSCROLL values';
    } else if (safetyLevel === VSPSafetyLevel.Warning) {
      warning = 'VSP transition requires precise cycle timing to be safe';
    }
    
    return {
      safetyLevel,
      writeCycle: VSP_TIMING.earliestWriteCycle + 2, // Conservative
      warning,
      safeAlternative,
    };
  }

  /**
   * Find a safe transition path between YSCROLL values
   */
  findSafeTransitionPath(
    fromYscroll: number,
    toYscroll: number
  ): number[] | null {
    // Direct transition?
    if (this.isTransitionSafe(fromYscroll, toYscroll)) {
      return [fromYscroll, toYscroll];
    }
    
    // Try single intermediate step
    for (let mid = 0; mid < 8; mid++) {
      if (
        this.isTransitionSafe(fromYscroll, mid) &&
        this.isTransitionSafe(mid, toYscroll)
      ) {
        return [fromYscroll, mid, toYscroll];
      }
    }
    
    // Try two intermediate steps
    for (let mid1 = 0; mid1 < 8; mid1++) {
      for (let mid2 = 0; mid2 < 8; mid2++) {
        if (
          this.isTransitionSafe(fromYscroll, mid1) &&
          this.isTransitionSafe(mid1, mid2) &&
          this.isTransitionSafe(mid2, toYscroll)
        ) {
          return [fromYscroll, mid1, mid2, toYscroll];
        }
      }
    }
    
    return null; // No safe path found
  }

  /**
   * Generate VSP code (with safety considerations)
   */
  generateCode(
    currentYscroll: number,
    config: VSPConfig
  ): VSPCode {
    const analysis = this.analyze(currentYscroll, config);
    const assembly: string[] = [];
    const timingNotes: string[] = [];
    
    assembly.push('; VSP (Variable Screen Position)');
    assembly.push('; WARNING: Timing-critical code!');
    assembly.push('');
    
    if (analysis.safetyLevel === VSPSafetyLevel.Dangerous && config.safeMode) {
      // Use safe transition path
      const path = this.findSafeTransitionPath(currentYscroll, config.targetYscroll);
      
      if (path && path.length > 2) {
        assembly.push('; Using safe multi-step transition');
        for (let i = 1; i < path.length; i++) {
          const d011Value = (config.baseD011 & 0xF8) | path[i];
          assembly.push(`    LDA #$${d011Value.toString(16).padStart(2, '0')}`);
          assembly.push('    STA $D011');
          if (i < path.length - 1) {
            assembly.push('    ; Wait for next frame');
          }
        }
        timingNotes.push('Multi-step transition spans multiple frames');
        return { assembly, timingNotes, crashSafe: true };
      }
    }
    
    // Direct VSP (potentially dangerous)
    const d011Value = (config.baseD011 & 0xF8) | config.targetYscroll;
    
    assembly.push(`    ; Target cycle: ${analysis.writeCycle}`);
    assembly.push('    ; Must execute at exact cycle position!');
    assembly.push('');
    assembly.push(`    LDA #$${d011Value.toString(16).padStart(2, '0')}    ; New YSCROLL value`);
    assembly.push('    STA $D011         ; Write at cycle 55-57');
    
    timingNotes.push(`Safety level: ${analysis.safetyLevel}`);
    if (analysis.warning) {
      timingNotes.push(analysis.warning);
    }
    
    return {
      assembly,
      timingNotes,
      crashSafe: analysis.safetyLevel === VSPSafetyLevel.Safe,
    };
  }

  /**
   * Calculate optimal write cycle for VSP
   */
  getOptimalWriteCycle(): number {
    // Cycle 56 is generally safest
    return 56;
  }
}
```

### File: `vic-ii/agsp.ts`

```typescript
import { AGSPConfig } from './types.js';
import { FLDAnalyzer } from './fld.js';

/**
 * AGSP analysis result
 */
export interface AGSPAnalysis {
  /** Lines to skip using FLD */
  readonly fldSkipLines: number;
  /** YSCROLL sequence for positioning */
  readonly yscrollSequence: number[];
  /** Total CPU cycles required */
  readonly cpuCycles: number;
  /** Whether implementation is stable */
  readonly stable: boolean;
}

/**
 * AGSP code generation result
 */
export interface AGSPCode {
  /** FLD setup code */
  readonly fldSetup: string[];
  /** Position adjustment code */
  readonly positionCode: string[];
  /** Tables required */
  readonly tables: Map<string, number[]>;
  /** Total code size */
  readonly codeBytes: number;
}

/**
 * AGSP (Any Given Screen Position) analyzer and generator
 */
export class AGSPAnalyzer {
  protected fldAnalyzer: FLDAnalyzer;
  protected videoSystem: 'PAL' | 'NTSC';

  constructor(videoSystem: 'PAL' | 'NTSC' = 'PAL') {
    this.videoSystem = videoSystem;
    this.fldAnalyzer = new FLDAnalyzer(videoSystem);
  }

  /**
   * Analyze AGSP requirements
   */
  analyze(config: AGSPConfig): AGSPAnalysis {
    // Standard first visible line is 51 (PAL)
    const standardFirstLine = 51;
    const targetFirstLine = config.firstVisibleLine;
    
    // Calculate how many lines to skip using FLD
    const fldSkipLines = Math.max(0, targetFirstLine - standardFirstLine);
    
    // Calculate YSCROLL sequence for fine positioning
    const yscrollSequence: number[] = [];
    const finePosition = targetFirstLine % 8;
    
    // Build sequence to reach target position
    for (let i = 0; i < 8; i++) {
      const yscroll = (config.baseYscroll & 0xF8) | ((finePosition + i) & 0x07);
      yscrollSequence.push(yscroll);
    }
    
    // Calculate CPU cost
    // FLD costs ~10 cycles per skipped line
    // Plus setup and position adjustment
    const fldCycles = fldSkipLines * 10;
    const setupCycles = 50; // IRQ setup, etc.
    const cpuCycles = fldCycles + setupCycles;
    
    return {
      fldSkipLines,
      yscrollSequence,
      cpuCycles,
      stable: true, // AGSP is inherently stable unlike VSP
    };
  }

  /**
   * Generate AGSP implementation code
   */
  generateCode(config: AGSPConfig): AGSPCode {
    const analysis = this.analyze(config);
    const fldSetup: string[] = [];
    const positionCode: string[] = [];
    const tables = new Map<string, number[]>();
    
    // FLD setup for line skipping
    fldSetup.push('; AGSP - FLD Line Skip Setup');
    fldSetup.push(`; Skipping ${analysis.fldSkipLines} lines`);
    fldSetup.push('');
    
    if (analysis.fldSkipLines > 0) {
      fldSetup.push('agsp_fld:');
      fldSetup.push(`    LDX #${analysis.fldSkipLines}`);
      fldSetup.push('agsp_fld_loop:');
      fldSetup.push('    LDA $D012');
      fldSetup.push('agsp_wait:');
      fldSetup.push('    CMP $D012');
      fldSetup.push('    BEQ agsp_wait');
      fldSetup.push('');
      fldSetup.push('    LDA $D012');
      fldSetup.push('    AND #$07');
      fldSetup.push('    CLC');
      fldSetup.push('    ADC #$01');
      fldSetup.push('    AND #$07');
      fldSetup.push(`    ORA #$${(config.baseYscroll & 0xF8).toString(16).padStart(2, '0')}`);
      fldSetup.push('    STA $D011        ; Prevent badline');
      fldSetup.push('');
      fldSetup.push('    DEX');
      fldSetup.push('    BNE agsp_fld_loop');
    }
    
    // Position adjustment code
    positionCode.push('; AGSP - Fine Position Adjustment');
    positionCode.push('');
    positionCode.push('agsp_position:');
    positionCode.push(`    LDA #$${analysis.yscrollSequence[0].toString(16).padStart(2, '0')}`);
    positionCode.push('    STA $D011        ; Set final position');
    
    // Generate YSCROLL table
    tables.set('agsp_yscroll', analysis.yscrollSequence);
    
    return {
      fldSetup,
      positionCode,
      tables,
      codeBytes: fldSetup.length * 3 + positionCode.length * 3,
    };
  }

  /**
   * Calculate screen position from scroll values
   */
  calculateScreenPosition(
    yscroll: number,
    fldLines: number
  ): { firstLine: number; pixelOffset: number } {
    const baseFirstLine = 51; // Standard PAL
    const firstLine = baseFirstLine + fldLines;
    const pixelOffset = yscroll & 0x07;
    
    return {
      firstLine: firstLine + Math.floor(pixelOffset / 8),
      pixelOffset: pixelOffset % 8,
    };
  }

  /**
   * Generate smooth vertical scroll routine
   */
  generateScrollRoutine(
    scrollRange: number = 8
  ): { code: string[]; tables: Map<string, number[]> } {
    const code: string[] = [];
    const tables = new Map<string, number[]>();
    
    code.push('; AGSP Smooth Vertical Scroll');
    code.push('; Scrolls screen position smoothly');
    code.push('');
    code.push('agsp_scroll:');
    code.push('    LDX scroll_position ; Current scroll (0-7)');
    code.push('    LDA agsp_d011_table,X');
    code.push('    STA $D011');
    code.push('');
    code.push('    ; Update scroll position');
    code.push('    INC scroll_position');
    code.push('    LDA scroll_position');
    code.push(`    CMP #${scrollRange}`);
    code.push('    BCC agsp_done');
    code.push('    LDA #$00');
    code.push('    STA scroll_position');
    code.push('    ; Scroll screen memory here');
    code.push('agsp_done:');
    code.push('    RTS');
    
    // Generate D011 table for smooth scroll
    const d011Table: number[] = [];
    for (let i = 0; i < scrollRange; i++) {
      d011Table.push(0x18 | i); // YSCROLL 0-7
    }
    tables.set('agsp_d011_table', d011Table);
    
    return { code, tables };
  }

  /**
   * Check if AGSP is suitable for given requirements
   */
  isSuitable(
    scrollRange: number,
    cpuBudget: number
  ): { suitable: boolean; reason: string } {
    // AGSP needs CPU time for FLD operations
    const estimatedCycles = scrollRange * 10 + 50;
    
    if (estimatedCycles > cpuBudget) {
      return {
        suitable: false,
        reason: `AGSP needs ~${estimatedCycles} cycles, only ${cpuBudget} available`,
      };
    }
    
    return {
      suitable: true,
      reason: 'AGSP is suitable for the requirements',
    };
  }
}
```

---

## Blend65 Syntax for VSP/AGSP

```js
// Enable AGSP scrolling (safe)
@agsp(firstLine: 80, visibleLines: 180)
function scrollableArea() {
    // Compiler generates AGSP code
}

// VSP operation (advanced, use with caution)
@vsp(targetYscroll: 3, safeMode: true)
function vspEffect() {
    // Compiler uses safe transition path
}

// Smooth vertical scroll
@verticalScroll(range: 8, smooth: true)
function gameScroll() {
    // Uses AGSP for stable smooth scrolling
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| VSP `isTransitionSafe` safe | Safe transitions return true |
| VSP `isTransitionSafe` dangerous | Dangerous transitions return false |
| VSP `getSafetyLevel` | Correct safety classification |
| VSP `findSafeTransitionPath` direct | Single step paths |
| VSP `findSafeTransitionPath` indirect | Multi-step paths |
| VSP `generateCode` safe | Safe mode uses path |
| VSP `generateCode` direct | Direct mode warns |
| VSP `getOptimalWriteCycle` | Returns correct cycle |
| AGSP `analyze` skip | Correct FLD skip calculation |
| AGSP `analyze` fine | Correct YSCROLL sequence |
| AGSP `generateCode` FLD | Valid FLD loop |
| AGSP `generateCode` position | Valid position code |
| AGSP `calculateScreenPosition` | Correct position math |
| AGSP `generateScrollRoutine` | Valid scroll code |
| AGSP `isSuitable` pass | Returns true when suitable |
| AGSP `isSuitable` fail | Returns false when not suitable |

---

## Task Checklist

| Item | Status |
|------|--------|
| Extend `vic-ii/types.ts` with VSP/AGSP types | [ ] |
| Create `vic-ii/vsp.ts` | [ ] |
| Create `vic-ii/agsp.ts` | [ ] |
| Update `vic-ii/index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 9.1b3 → `09-01b3-vic-border-effects.md` (Side/Vertical border opening effects)