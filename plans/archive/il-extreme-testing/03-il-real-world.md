# IL Generator Real-World Tests

> **Document**: 03-il-real-world.md
> **Parent**: [Index](00-index.md)

## Overview

Real-world C64 game development patterns that the IL Generator must handle correctly. These tests verify that actual game code compiles to proper IL instructions.

## Test Files

### File 1: `il/e2e/real-world/game-loop.test.ts`

**Purpose**: Game loop and frame timing patterns

**Tests (8-10)**:
1. Basic game loop with running flag
2. Frame counter increment pattern
3. Init-loop-cleanup pattern (setup, main, teardown)
4. Input-update-render frame structure
5. State machine main loop (menu → game → pause → gameover)
6. Frame-locked timing (wait for frame)
7. Delta accumulation pattern
8. Subsystem update ordering
9. Game tick timing with comparison
10. Infinite loop with break condition

**Verification**: Check for JUMP, COMPARE, CALL, LOAD/STORE opcodes

---

### File 2: `il/e2e/real-world/sprite-handling.test.ts`

**Purpose**: Sprite manipulation patterns common in C64 games

**Tests (8-10)**:
1. Sprite enable/disable via mapped register
2. Sprite X position setting (0-255)
3. Sprite Y position setting (0-255)
4. Sprite MSB handling for X > 255
5. Sprite color setting
6. Sprite priority (behind/in-front)
7. Sprite animation frame cycling
8. Sprite collision flag reading
9. Multiple sprite coordinate update
10. Sprite pool pattern (enable nth sprite)

**Verification**: Check for STORE_BYTE to mapped addresses, bitwise operations

---

### File 3: `il/e2e/real-world/hardware-registers.test.ts`

**Purpose**: VIC-II, SID, and CIA register manipulation

**Tests (8-10)**:
1. Border color change ($D020)
2. Background color change ($D021)
3. Raster line reading ($D012)
4. Raster compare setup ($D012 MSB in $D011)
5. Screen memory pointer ($D018)
6. IRQ enable/disable
7. Smooth scroll X ($D016)
8. Smooth scroll Y ($D011)
9. SID frequency setting (16-bit)
10. CIA timer setup

**Verification**: Check STORE_BYTE/LOAD_BYTE with correct mapped addresses

---

### File 4: `il/e2e/real-world/memory-operations.test.ts`

**Purpose**: Memory block operations common in games

**Tests (8-10)**:
1. Screen clear (1000 bytes loop)
2. Color memory fill ($D800 range)
3. Byte-by-byte memory copy
4. Memory fill with constant
5. Screen row copy
6. Character data copy to RAM
7. Bitmap clear (8000 bytes pattern)
8. Zero page variable block init
9. Double buffer swap (pointer update)
10. Memory block compare

**Verification**: Check loop structure with STORE_BYTE, proper counter handling

---

### File 5: `il/e2e/real-world/joystick-keyboard.test.ts`

**Purpose**: Input handling patterns

**Tests (8-10)**:
1. Joystick port 1 reading ($DC00)
2. Joystick port 2 reading ($DC01)
3. Up direction extraction (bit 0)
4. Down direction extraction (bit 1)
5. Left direction extraction (bit 2)
6. Right direction extraction (bit 3)
7. Fire button detection (bit 4)
8. Diagonal movement (combined bits)
9. Debounce pattern (last vs current)
10. Input buffer pattern

**Verification**: Check LOAD_BYTE, AND_IMM for bit extraction, COMPARE

---

### File 6: `il/e2e/real-world/raster-timing.test.ts`

**Purpose**: Raster-synchronized code patterns

**Tests (8-10)**:
1. Wait for specific raster line
2. Raster compare loop
3. Top of screen detection (line 0)
4. Bottom of screen detection (line 255)
5. Raster bar color change
6. Split screen boundary detection
7. Raster interrupt trigger line
8. Stable raster wait pattern
9. Cycle-counted delay loop
10. Vertical blank detection

**Verification**: Check LOAD_BYTE from $D012, COMPARE_IMM, JUMP patterns

---

### File 7: `il/e2e/real-world/sound-music.test.ts`

**Purpose**: SID music and sound effect patterns

**Tests (8-10)**:
1. Single voice note trigger
2. Frequency table lookup
3. ADSR envelope setting
4. Waveform selection
5. Volume control
6. Filter frequency sweep
7. Multi-voice note trigger
8. Sound effect trigger pattern
9. Volume fade in
10. Volume fade out

**Verification**: Check STORE_BYTE to SID addresses ($D400+)

---

## Implementation Pattern

All tests follow this structure:

```typescript
/**
 * IL Generator E2E Test: [Category] Patterns
 * Real-world C64 [category] patterns
 */
import { describe, it, expect } from 'vitest';
import { compileToIL, countOpcode, hasOpcode } from '../../helpers/il-test-utils.js';
import { ILOpcode } from '../../../../il/enums.js';

describe('[Category] Patterns', () => {
  describe('[subcategory]', () => {
    it('should generate IL for [specific pattern]', () => {
      const source = `
        module Test;
        // C64-realistic code here
      `;
      
      const program = compileToIL(source);
      
      // Verify correct IL generation
      expect(program).toBeDefined();
      expect(hasOpcode(program.functions[0].instructions, ILOpcode.XXX)).toBe(true);
    });
  });
});
```

## Verification Strategies

| Pattern Type | Key Opcodes to Verify |
|--------------|----------------------|
| Game loops | JUMP, COMPARE, LOAD_BYTE |
| Sprite handling | STORE_BYTE, OR_IMM, AND_IMM |
| Hardware registers | STORE_BYTE, LOAD_BYTE (mapped) |
| Memory operations | STORE_BYTE, ADD_IMM (loop) |
| Input handling | LOAD_BYTE, AND_IMM, COMPARE |
| Raster timing | LOAD_BYTE, COMPARE_IMM, JUMP |
| Sound/music | STORE_BYTE, STORE_WORD |

## C64 Memory Addresses Reference

For realistic tests:

| Address | Purpose |
|---------|---------|
| $D020 | Border color |
| $D021 | Background color |
| $D012 | Raster line (low) |
| $D011 | VIC control (raster MSB) |
| $D015 | Sprite enable |
| $D000-$D00F | Sprite X/Y positions |
| $D010 | Sprite X MSB |
| $D01E | Sprite-sprite collision |
| $D01F | Sprite-background collision |
| $DC00 | Joystick port 1 |
| $DC01 | Joystick port 2 |
| $D400-$D418 | SID registers |