# Real-World E2E Test Scenarios

> **Document**: 04-test-scenarios.md
> **Parent**: [Index](00-index.md)
> **CRITICAL**: Every test MUST use full pipeline (source → assembly). Every test represents a real C64 game/demo scenario.

## Test Architecture

Every test follows this pattern:
1. Write realistic Blend source code (as if writing a real game)
2. Compile through full pipeline (lexer → parser → semantic → frame → IL → optimizer → codegen → emit)
3. Verify compilation succeeds (no crashes, no false warnings)
4. Verify assembly output contains expected instructions
5. Verify assembly output does NOT contain wrong patterns
6. Test at MULTIPLE optimization levels: O0, O1, O2, O3

---

## Scenario 1: Sprite Loader (Tests Bugs 1, 2 + Classes 1, 2, 7, 9)

**Real-world pattern:** Loading sprite data from a table into VIC-II sprite memory.

```js
module SpriteLoader

const SPRITE_DATA_BASE: word = $2000;
const VIC_SPRITE_PTR: word = $07F8;
const VIC_SPRITE_ENABLE: word = $D015;

function loadSprite(spriteNum: byte, dataPtr: word): void {
    let offset: word = spriteNum * 64;
    for (let i: byte = 0 to 62 step 1) {
        poke(SPRITE_DATA_BASE + offset + i, peek(dataPtr + i));
    }
    poke(VIC_SPRITE_PTR + spriteNum, (SPRITE_DATA_BASE / 64) + spriteNum);
}

export function main(): void {
    poke(VIC_SPRITE_ENABLE, $FF);
    loadSprite(0, $3000);
    loadSprite(1, $3040);
}
```

**Verifications:**
- ✅ No "unused variable 'i'" warning (Bug 1)
- ✅ `poke(SPRITE_DATA_BASE + offset + i, ...)` compiles (Bug 2 — dynamic address)
- ✅ `peek(dataPtr + i)` compiles (Bug 2 — dynamic address in peek)
- ✅ Assembly contains loop with indexed store (STA)
- ✅ Assembly contains loop counter increment (INC or INX/INY)
- ✅ `spriteNum * 64` produces correct multiplication
- ✅ `i` variable correctly tracked as used (Class 1: scope tracking)

---

## Scenario 2: Border Color Cycling (Tests Bugs 3, 4, 5, 6 + Classes 2, 3, 6)

**Real-world pattern:** Cycling border colors with a delay loop.

```js
module BorderCycle

const BORDER_COLOR: word = $D020;

function delay(): void {
    for (_outer = 0 to 254) {
        for (_inner = 0 to 254) {
            barrier();
        }
    }
}

export function main(): void {
    let color: byte = 0;
    while (true) {
        poke(BORDER_COLOR, color);
        delay();
        color += 1;
        if (color > 15) {
            color = 0;
        }
    }
}
```

**Verifications at O3:**
- ✅ `delay()` body NOT present as standalone function (Bug 3 — DFE after inline)
- ✅ `color += 1` produces INC or ADC instruction in the while loop (Bug 4)
- ✅ `color = 0` produces `LDA #$00; STA slot` (Bug 5 — literal load before store)
- ✅ Inlined for-loop counters re-initialized every while iteration (Bug 6)
- ✅ Assembly has correct loop structure (for inside while)

**Verifications at O0 (no optimization):**
- ✅ `JSR delay` call present (not inlined)
- ✅ `color += 1` produces correct increment
- ✅ `color = 0` produces correct literal store

---

## Scenario 3: Screen Fill with Color Attributes (Tests Classes 1, 2, 4, 7)

**Real-world pattern:** Clearing screen memory and setting color attributes.

```js
module ScreenFill

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;

function fillScreen(char: byte, color: byte): void {
    for (let i: word = 0 to 999 step 1) {
        poke(SCREEN_RAM + i, char);
        poke(COLOR_RAM + i, color);
    }
}

function clearScreen(): void {
    fillScreen(32, 14);
}

export function main(): void {
    clearScreen();
    let row: byte = 0;
    while (row < 25) {
        let offset: word = row * 40;
        for (let col: byte = 0 to 39 step 1) {
            poke(SCREEN_RAM + offset + col, 65 + col);
        }
        row += 1;
    }
}
```

**Verifications:**
- ✅ Word loop counter (`i: word`) handles 0-999 range correctly (Class 1: type width)
- ✅ `row * 40` word multiplication correct (Class 7: complex expression)
- ✅ `offset + col` byte+word addition correct (Class 1: type promotion)
- ✅ Dynamic double-offset `SCREEN_RAM + offset + col` compiles (Bug 2)
- ✅ `row += 1` in while loop generates correct increment (Bug 4)
- ✅ `col` used inside nested for body → no false unused warning (Bug 1)
- ✅ `65 + col` arithmetic in poke value correct (Class 7)

---

## Scenario 4: Raster Interrupt Handler (Tests Classes 3, 9, 2)

**Real-world pattern:** Waiting for raster line and changing colors at specific lines.

```js
module RasterBars

const VIC_RASTER: word = $D012;
const VIC_CONTROL1: word = $D011;
const BORDER_COLOR: word = $D020;
const BG_COLOR: word = $D021;

function waitRaster(line: byte): void {
    while (peek(VIC_RASTER) != line) {
        barrier();
    }
}

function setColors(border: byte, background: byte): void {
    poke(BORDER_COLOR, border);
    poke(BG_COLOR, background);
}

export function main(): void {
    while (true) {
        waitRaster(50);
        setColors(1, 1);
        waitRaster(100);
        setColors(2, 2);
        waitRaster(150);
        setColors(6, 6);
        waitRaster(200);
        setColors(0, 0);
    }
}
```

**Verifications:**
- ✅ `peek(VIC_RASTER) != line` comparison with parameter correct (Class 2: register state)
- ✅ `barrier()` inside while loop not eliminated by optimizer (Class 9: intrinsic edge)
- ✅ While loop with peek condition generates correct branch logic (Class 3: control flow)
- ✅ Multiple function calls in sequence preserve correct state (Class 10: calling convention)
- ✅ At O3: small functions inlined AND originals removed (Bugs 3, 6)

---

## Scenario 5: Multi-Sprite Animation (Tests Classes 1, 2, 4, 7, 10)

**Real-world pattern:** Moving 8 sprites with independent velocities.

```js
module SpriteAnimation

const VIC_SPRITE_X_BASE: word = $D000;
const VIC_SPRITE_Y_BASE: word = $D001;
const VIC_SPRITE_ENABLE: word = $D015;
const VIC_SPRITE_XMSB: word = $D010;

function setSpritePos(num: byte, x: word, y: byte): void {
    let regOffset: byte = num * 2;
    poke(VIC_SPRITE_X_BASE + regOffset, lo(x));
    poke(VIC_SPRITE_Y_BASE + regOffset, y);
    if (x > 255) {
        poke(VIC_SPRITE_XMSB, peek(VIC_SPRITE_XMSB) | (1 << num));
    } else {
        poke(VIC_SPRITE_XMSB, peek(VIC_SPRITE_XMSB) & ~(1 << num));
    }
}

export function main(): void {
    poke(VIC_SPRITE_ENABLE, $FF);
    let baseX: word = 24;
    while (true) {
        for (let s: byte = 0 to 7 step 1) {
            let x: word = baseX + s * 48;
            let y: byte = 100 + s * 20;
            setSpritePos(s, x, y);
        }
        baseX += 1;
        if (baseX > 344) {
            baseX = 24;
        }
    }
}
```

**Verifications:**
- ✅ `num * 2` byte multiplication correct (Class 7)
- ✅ `lo(x)` extracts low byte of word (Class 1: type coercion)
- ✅ `1 << num` bit shift with variable correct (Class 7: complex expression)
- ✅ `~(1 << num)` bitwise NOT correct (Class 7)
- ✅ `peek(VIC_SPRITE_XMSB) | mask` read-modify-write pattern (Class 9: intrinsic)
- ✅ `peek(VIC_SPRITE_XMSB) & ~mask` read-modify-write pattern (Class 9)
- ✅ Function with 3 parameters (byte, word, byte) correct (Class 10: calling convention)
- ✅ `x > 255` word comparison in if-else (Class 1: type width + Class 3: control flow)
- ✅ `baseX += 1` word compound assignment (Bug 4 + Class 1)
- ✅ `s * 48` and `s * 20` in loop body (Class 7)
- ✅ `s` not warned as unused (Bug 1)

---

## Scenario 6: Sound Effect Player (Tests Classes 3, 6, 9, 10)

**Real-world pattern:** Playing a sound effect through the SID chip with decay.

```js
module SoundFX

const SID_FREQ_LO: word = $D400;
const SID_FREQ_HI: word = $D401;
const SID_PULSE_LO: word = $D402;
const SID_PULSE_HI: word = $D403;
const SID_CONTROL: word = $D404;
const SID_ATTACK_DECAY: word = $D405;
const SID_SUSTAIN_RELEASE: word = $D406;
const SID_VOLUME: word = $D418;

function initSID(): void {
    poke(SID_VOLUME, 15);
    poke(SID_ATTACK_DECAY, $09);
    poke(SID_SUSTAIN_RELEASE, $00);
}

function playNote(freqHi: byte, freqLo: byte): void {
    poke(SID_FREQ_LO, freqLo);
    poke(SID_FREQ_HI, freqHi);
    poke(SID_CONTROL, $11);
}

function stopNote(): void {
    poke(SID_CONTROL, $10);
}

function shortDelay(): void {
    for (_d = 0 to 254) {
        barrier();
    }
}

export function main(): void {
    initSID();
    let noteIndex: byte = 0;
    while (noteIndex < 8) {
        playNote(noteIndex * 4 + 16, 0);
        shortDelay();
        stopNote();
        shortDelay();
        noteIndex += 1;
    }
}
```

**Verifications:**
- ✅ Multiple function calls in sequence (initSID, playNote, shortDelay, stopNote)
- ✅ `noteIndex * 4 + 16` compound expression as function argument (Class 7)
- ✅ `noteIndex += 1` compound assignment in while loop (Bug 4)
- ✅ `noteIndex < 8` while condition with variable (Class 3: control flow)
- ✅ At O3: shortDelay inlined, original removed (Bug 3), barrier preserved (Class 9)
- ✅ At O3: inlined loop counters re-init each call (Bug 6)
- ✅ Multiple poke calls with constant addresses all generate correct STA (Class 9)

---

## Scenario 7: Memory Copy Utility (Tests Classes 1, 2, 4, 9)

**Real-world pattern:** Copying blocks of memory (charset loading, screen backup).

```js
module MemCopy

function memcpy(dst: word, src: word, length: word): void {
    for (let i: word = 0 to length - 1 step 1) {
        poke(dst + i, peek(src + i));
    }
}

function memset(dst: word, value: byte, length: word): void {
    for (let i: word = 0 to length - 1 step 1) {
        poke(dst + i, value);
    }
}

export function main(): void {
    memset($0400, 32, 1000);
    memcpy($2000, $A000, 4096);
    memset($D800, 14, 1000);
}
```

**Verifications:**
- ✅ Word loop counter with word limit (`length - 1`) (Class 1: type width)
- ✅ `dst + i` and `src + i` dynamic word-address poke/peek (Bug 2)
- ✅ `peek(src + i)` as poke value argument (Class 9: nested intrinsics)
- ✅ `length - 1` expression as loop bound (Class 7)
- ✅ Function with word parameters (Class 10: calling convention)
- ✅ `i` variable not warned as unused in either function (Bug 1)
- ✅ Large constant addresses ($A000, $D800) handled correctly (Class 4)

---

## Scenario 8: Game State Machine (Tests Classes 3, 5, 6, 7, 10)

**Real-world pattern:** Main game loop with state machine (menu, playing, game over).

```js
module GameState

const SCREEN_RAM: word = $0400;
const BORDER: word = $D020;
const BG: word = $D021;
const JOY2: word = $DC00;

function drawTitle(): void {
    for (let i: byte = 0 to 39 step 1) {
        poke(SCREEN_RAM + i, i + 1);
    }
}

function drawGameOver(): void {
    for (let i: byte = 0 to 39 step 1) {
        poke(SCREEN_RAM + 480 + i, i + 65);
    }
}

function readJoystick(): byte {
    return peek(JOY2) & $1F;
}

export function main(): void {
    let state: byte = 0;
    let score: word = 0;
    let lives: byte = 3;

    while (true) {
        if (state == 0) {
            poke(BORDER, 0);
            drawTitle();
            let joy: byte = readJoystick();
            if (joy & $10) {
                state = 1;
                score = 0;
                lives = 3;
            }
        }
        if (state == 1) {
            poke(BORDER, 6);
            score += 10;
            let joy: byte = readJoystick();
            if (joy & $01) {
                lives -= 1;
                if (lives == 0) {
                    state = 2;
                }
            }
        }
        if (state == 2) {
            poke(BORDER, 2);
            drawGameOver();
            let joy: byte = readJoystick();
            if (joy & $10) {
                state = 0;
            }
        }
    }
}
```

**Verifications:**
- ✅ Multiple if-branches in while loop with variable state (Class 3: control flow)
- ✅ Variable assignments inside nested if-blocks (`state = 1`, `lives -= 1`) (Bug 5)
- ✅ Compound assignments: `score += 10`, `lives -= 1` (Bug 4)
- ✅ Word variable `score` compound assignment (Class 1: type width)
- ✅ Bitwise AND in if-condition: `joy & $10` (Class 7: complex expression)
- ✅ `readJoystick()` return value used in expression (Class 10: return values)
- ✅ Deeply nested: while → if → if → assignment (Class 3: nested control flow)
- ✅ Multiple `let joy` in different if-blocks (same name, different scopes) (Class 4: scope)
- ✅ No false unused warnings for any variables (Bug 1)

---

## Scenario 9: Scrolling Text (Tests Classes 1, 2, 4, 7, 9)

**Real-world pattern:** Horizontal scrolling text on screen.

```js
module ScrollText

const SCREEN_RAM: word = $0400;
const VIC_SCROLL: word = $D016;
const SCREEN_WIDTH: byte = 40;
const SCREEN_HEIGHT: byte = 25;

function shiftScreenLeft(): void {
    for (let row: byte = 0 to 24 step 1) {
        let rowBase: word = SCREEN_RAM + row * SCREEN_WIDTH;
        for (let col: byte = 0 to 38 step 1) {
            poke(rowBase + col, peek(rowBase + col + 1));
        }
    }
}

function setScrollRegister(offset: byte): void {
    let current: byte = peek(VIC_SCROLL) & $F8;
    poke(VIC_SCROLL, current | (offset & $07));
}

export function main(): void {
    let scrollOffset: byte = 7;
    let charIndex: byte = 0;

    while (true) {
        setScrollRegister(scrollOffset);
        if (scrollOffset == 0) {
            shiftScreenLeft();
            for (let row: byte = 0 to 24 step 1) {
                poke(SCREEN_RAM + row * 40 + 39, charIndex + 65);
            }
            charIndex += 1;
            if (charIndex > 25) {
                charIndex = 0;
            }
            scrollOffset = 7;
        } else {
            scrollOffset -= 1;
        }
    }
}
```

**Verifications:**
- ✅ Nested for-loops with different counters (`row`, `col`) (Bug 1: scope tracking)
- ✅ `row * SCREEN_WIDTH` multiplication (Class 7)
- ✅ `rowBase + col` dynamic address computation (Bug 2)
- ✅ `peek(rowBase + col + 1)` triple-addition dynamic address in peek (Bug 2)
- ✅ `peek(VIC_SCROLL) & $F8` read-modify-write pattern (Class 9)
- ✅ `current | (offset & $07)` compound bitwise expression (Class 7)
- ✅ `scrollOffset -= 1` and `charIndex += 1` compound assignments (Bug 4)
- ✅ `charIndex = 0` and `scrollOffset = 7` literal assignments in if-body (Bug 5)
- ✅ if/else inside while with for-loop inside if-branch (Class 3: complex control flow)

---

## Scenario 10: Character Set Animation (Tests Classes 4, 6, 7, 9)

**Real-world pattern:** Custom charset with animated characters.

```js
module CharsetAnim

const CHAR_ROM: word = $D000;
const CHAR_RAM: word = $3000;
const VIC_MEMCTL: word = $D018;

function copyCharset(): void {
    poke($0001, peek($0001) & $FB);
    for (let i: word = 0 to 2047 step 1) {
        poke(CHAR_RAM + i, peek(CHAR_ROM + i));
    }
    poke($0001, peek($0001) | $04);
}

function animateChar(charNum: byte, frame: byte): void {
    let charAddr: word = CHAR_RAM + charNum * 8;
    for (let row: byte = 0 to 7 step 1) {
        let data: byte = peek(charAddr + row);
        if (frame & $01) {
            data = (data << 1) | (data >> 7);
        }
        poke(charAddr + row, data);
    }
}

export function main(): void {
    copyCharset();
    poke(VIC_MEMCTL, (peek(VIC_MEMCTL) & $F0) | $0C);
    let frame: byte = 0;
    while (true) {
        animateChar(65, frame);
        animateChar(66, frame);
        frame += 1;
        for (_delay = 0 to 254) {
            barrier();
        }
    }
}
```

**Verifications:**
- ✅ `peek($0001) & $FB` and `peek($0001) | $04` — R-M-W on CPU port (Class 9)
- ✅ Word loop 0 to 2047 (Class 1: word counter)
- ✅ `charNum * 8` calculation (Class 7)
- ✅ `(data << 1) | (data >> 7)` rotate pattern (Class 7: bitwise)
- ✅ Variable `data` modified and re-used inside if-block (Bug 1, Bug 5)
- ✅ `frame & $01` bitwise test in if condition (Class 7)
- ✅ `frame += 1` compound assignment (Bug 4)
- ✅ At O3: animateChar inlined, delay loop inlined, originals removed (Bug 3, Bug 6)
- ✅ Memory layout: large word loop counter doesn't collide with byte vars (Class 4)

---

## Scenario 11: Collision Detection (Tests Classes 1, 3, 7, 10)

```js
module Collision

function abs_diff(a: byte, b: byte): byte {
    if (a > b) {
        return a - b;
    }
    return b - a;
}

function checkCollision(x1: byte, y1: byte, x2: byte, y2: byte, size: byte): byte {
    let dx: byte = abs_diff(x1, x2);
    let dy: byte = abs_diff(y1, y2);
    if (dx < size) {
        if (dy < size) {
            return 1;
        }
    }
    return 0;
}

export function main(): void {
    let playerX: byte = 100;
    let playerY: byte = 150;
    let enemyX: byte = 120;
    let enemyY: byte = 140;

    while (true) {
        playerX += 1;
        if (playerX > 200) {
            playerX = 24;
        }
        let hit: byte = checkCollision(playerX, playerY, enemyX, enemyY, 16);
        if (hit == 1) {
            poke($D020, 2);
        } else {
            poke($D020, 0);
        }
    }
}
```

**Verifications:**
- ✅ Function with 5 byte parameters (Class 10: calling convention)
- ✅ Function return value used in comparison (Class 10: return values)
- ✅ Early return in `abs_diff` (Class 3: control flow)
- ✅ Nested if-blocks in `checkCollision` (Class 3)
- ✅ `playerX += 1` compound assignment (Bug 4)
- ✅ `playerX = 24` literal assignment in if-body (Bug 5)
- ✅ All local variables used correctly, no false warnings (Bug 1)
- ✅ At O3: abs_diff inlined, checkCollision inlined (Bugs 3, 6)

---

## Scenario 12: Multi-Module Game (Tests Class 5: Multi-Module)

**Module A: hardware.blend**
```js
module Hardware

const BORDER: word = $D020;
const BG: word = $D021;
const RASTER: word = $D012;

export function setBorder(color: byte): void {
    poke(BORDER, color);
}

export function setBackground(color: byte): void {
    poke(BG, color);
}

export function waitVBlank(): void {
    while (peek(RASTER) != 250) {
        barrier();
    }
}
```

**Module B: main.blend**
```js
module Main

import { setBorder, setBackground, waitVBlank } from "hardware"

export function main(): void {
    let color: byte = 0;
    while (true) {
        waitVBlank();
        setBorder(color);
        setBackground(color);
        color += 1;
        if (color > 15) {
            color = 0;
        }
    }
}
```

**Verifications:**
- ✅ Cross-module function calls resolve correctly (Class 5)
- ✅ Imported functions generate correct JSR or inline (Class 5)
- ✅ Cross-module constants not needed (functions encapsulate) (Class 5)
- ✅ `color += 1` and `color = 0` correct across module boundary (Bugs 4, 5)
- ✅ `barrier()` in imported function preserved (Class 9)

---

## Scenarios 13-20: Additional Test Programs (Summary)

| # | Name | Primary Bug/Class Coverage | Key Pattern |
|---|------|---------------------------|-------------|
| 13 | **Keyboard Scanner** | Classes 3, 7, 9 | CIA read + bit test + switch-like if chains |
| 14 | **Timer-Based Music** | Classes 6, 9, 10 | CIA timer + SID + function call sequences |
| 15 | **Multiplexed Sprites** | Classes 1, 2, 7 | Word comparisons + raster sorting + bit manipulation |
| 16 | **Screen Editor** | Classes 3, 4, 5 | Cursor movement + screen RAM + state management |
| 17 | **High Score Table** | Classes 1, 4, 7 | Array operations + word comparison + sorting logic |
| 18 | **Parallax Scroller** | Classes 2, 6, 9 | Multiple scroll registers + timing + volatile reads |
| 19 | **Particle System** | Classes 1, 4, 10 | Array of structs pattern + word math + function calls |
| 20 | **Boot Sequence** | All classes | Full game startup: charset + sprites + SID + screen init |

Each of scenarios 13-20 will be fully written out during implementation with the same level of detail as scenarios 1-12.

---

## Optimization Level Matrix

**EVERY scenario MUST be tested at multiple optimization levels:**

| Level | What It Tests | Key Bugs/Classes |
|-------|--------------|------------------|
| O0 | Raw codegen correctness (no optimizer) | Bugs 2, 4, 5 + Classes 2, 7, 10 |
| O1 | Single-site inlining + DFE | Bugs 3, 6 + Class 6 |
| O2 | Small function inlining + DCE + const-prop | Bugs 3, 4, 5, 6 + Classes 6, 8 |
| O3 | Aggressive optimization (all passes) | ALL bugs + ALL classes |
| Os | Size optimization (no inlining) | Classes 6, 8 (verify no over-elimination) |

---

## Assembly Verification Patterns

For each test, verify assembly contains/doesn't contain specific patterns:

| Pattern | Expected | Indicates |
|---------|----------|-----------|
| `INC slot` or `ADC #$01` | Present for `x += 1` | Bug 4 fixed |
| `LDA #$00` before `STA slot` | Present for `x = 0` | Bug 5 fixed |
| Dead function label | Absent at O3 | Bug 3 fixed |
| `LDA #$00` inside loop for init | Present per iteration | Bug 6 fixed |
| `STA $XXXX` with address | Present for poke | Bug 2 fixed |
| No false warnings in diagnostics | Zero warnings for used vars | Bug 1 fixed |
