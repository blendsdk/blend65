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

## Scenario 13: Keyboard Scanner (Tests Classes 3, 7, 9)

**Real-world pattern:** Reading the C64 keyboard matrix via CIA#1 ports, testing bits for specific keys, and using switch-like if chains to dispatch actions.

```js
module KeyScanner;

const CIA1_PORTA: word = $DC00;
const CIA1_PORTB: word = $DC01;
const SCREEN_RAM: word = $0400;
const BORDER: word = $D020;

function selectRow(row: byte): void {
    poke(CIA1_PORTA, ~(1 << row));
}

function readColumn(): byte {
    return peek(CIA1_PORTB);
}

function scanKey(row: byte, colMask: byte): byte {
    selectRow(row);
    let cols: byte = readColumn();
    if (cols & colMask) {
        return 0;
    }
    return 1;
}

export function main(): void {
    let lastKey: byte = 0;
    let cursorPos: byte = 0;

    while (true) {
        let keyPressed: byte = 0;

        if (scanKey(7, $04)) {
            keyPressed = 1;
            poke(BORDER, 1);
        }
        if (scanKey(1, $04)) {
            keyPressed = 2;
            poke(BORDER, 2);
        }
        if (scanKey(2, $01)) {
            keyPressed = 3;
            poke(BORDER, 6);
        }
        if (scanKey(0, $10)) {
            keyPressed = 4;
            poke(BORDER, 7);
        }

        if (keyPressed != lastKey) {
            if (keyPressed > 0) {
                poke(SCREEN_RAM + cursorPos, keyPressed + 64);
                cursorPos += 1;
                if (cursorPos > 39) {
                    cursorPos = 0;
                }
            }
            lastKey = keyPressed;
        }

        for (_debounce = 0 to 254) {
            barrier();
        }
    }
}
```

**Verifications:**
- ✅ `peek(CIA1_PORTB)` reads CIA port (Class 9: intrinsic)
- ✅ `cols & colMask` bitwise AND in if condition (Class 7: complex expression)
- ✅ Multiple if-blocks in sequence — switch-like pattern (Class 3: control flow)
- ✅ `keyPressed != lastKey` comparison and nested if (Class 3)
- ✅ Function return value used in if condition (Class 10: return values)
- ✅ `cursorPos += 1` compound assignment (Bug 4)
- ✅ `cursorPos = 0` literal assignment in if-body (Bug 5)
- ✅ `barrier()` preserved in delay loop (Class 9)
- ✅ No false unused warnings (Bug 1)

---

## Scenario 14: Timer-Based Music (Tests Classes 6, 9, 10)

**Real-world pattern:** Using CIA timer to pace SID music playback across a note sequence.

```js
module TimerMusic;

const SID_V1_FREQ_LO: word = $D400;
const SID_V1_FREQ_HI: word = $D401;
const SID_V1_CONTROL: word = $D404;
const SID_V1_AD: word = $D405;
const SID_V1_SR: word = $D406;
const SID_VOLUME: word = $D418;
const CIA2_TIMER_A_LO: word = $DD04;
const CIA2_TIMER_A_HI: word = $DD05;
const CIA2_ICR: word = $DD0D;
const CIA2_CRA: word = $DD0E;

function initSID(): void {
    poke(SID_VOLUME, 15);
    poke(SID_V1_AD, $09);
    poke(SID_V1_SR, $00);
}

function playFreq(freqHi: byte, freqLo: byte): void {
    poke(SID_V1_FREQ_LO, freqLo);
    poke(SID_V1_FREQ_HI, freqHi);
    poke(SID_V1_CONTROL, $11);
}

function gateOff(): void {
    poke(SID_V1_CONTROL, $10);
}

function startTimer(lo: byte, hi: byte): void {
    poke(CIA2_CRA, 0);
    poke(CIA2_TIMER_A_LO, lo);
    poke(CIA2_TIMER_A_HI, hi);
    poke(CIA2_ICR, $81);
    poke(CIA2_CRA, $01);
}

function waitTimer(): void {
    while ((peek(CIA2_ICR) & $01) == 0) {
        barrier();
    }
}

export function main(): void {
    initSID();
    startTimer($00, $40);

    let noteIndex: byte = 0;
    while (noteIndex < 16) {
        let freq: byte = noteIndex * 8 + 16;
        playFreq(freq, 0);
        waitTimer();
        gateOff();
        waitTimer();
        noteIndex += 1;
    }
    poke(SID_VOLUME, 0);
}
```

**Verifications:**
- ✅ Multiple sequential function calls (initSID, startTimer, playFreq, waitTimer, gateOff)
- ✅ `peek(CIA2_ICR) & $01` bitwise AND in while condition (Class 9 + Class 7)
- ✅ `barrier()` preserved in timer wait loop (Class 9)
- ✅ `noteIndex * 8 + 16` compound expression (Class 7)
- ✅ `noteIndex += 1` compound assignment (Bug 4)
- ✅ `noteIndex < 16` while condition (Class 3)
- ✅ At O3: small functions inlined, originals removed (Bug 3)
- ✅ At O3: inlined loops re-init correctly (Bug 6)
- ✅ Function parameters passed correctly across calls (Class 10)

---

## Scenario 15: Multiplexed Sprites (Tests Classes 1, 2, 7)

**Real-world pattern:** Sorting sprites by Y-coordinate for raster multiplexing — a common C64 demo technique.

```js
module SpriteMux;

const VIC_SPRITE_ENABLE: word = $D015;
const VIC_SPRITE_X_BASE: word = $D000;
const VIC_SPRITE_Y_BASE: word = $D001;
const VIC_RASTER: word = $D012;
const BORDER: word = $D020;

function setSpriteY(num: byte, y: byte): void {
    let regOffset: byte = num * 2;
    poke(VIC_SPRITE_Y_BASE + regOffset, y);
}

function setSpriteX(num: byte, x: byte): void {
    let regOffset: byte = num * 2;
    poke(VIC_SPRITE_X_BASE + regOffset, x);
}

function enableSprite(num: byte): void {
    let current: byte = peek(VIC_SPRITE_ENABLE);
    let mask: byte = 1;
    for (let i: byte = 0 to num - 1 step 1) {
        mask = mask * 2;
    }
    let result: byte = current | mask;
    poke(VIC_SPRITE_ENABLE, result);
}

function waitRasterLine(line: byte): void {
    while (peek(VIC_RASTER) != line) {
        barrier();
    }
}

function sortAndDisplay(y0: byte, y1: byte, y2: byte, y3: byte): void {
    if (y0 < y1) {
        setSpriteY(0, y0);
        setSpriteY(1, y1);
    } else {
        setSpriteY(0, y1);
        setSpriteY(1, y0);
    }
    if (y2 < y3) {
        setSpriteY(2, y2);
        setSpriteY(3, y3);
    } else {
        setSpriteY(2, y3);
        setSpriteY(3, y2);
    }
}

export function main(): void {
    enableSprite(0);
    enableSprite(1);
    enableSprite(2);
    enableSprite(3);

    let frame: byte = 0;
    while (true) {
        waitRasterLine(250);
        let offset: byte = frame;
        sortAndDisplay(50 + offset, 80 + offset, 120 + offset, 160 + offset);
        setSpriteX(0, 50);
        setSpriteX(1, 100);
        setSpriteX(2, 150);
        setSpriteX(3, 200);
        frame += 1;
        if (frame > 40) {
            frame = 0;
        }
    }
}
```

**Verifications:**
- ✅ `num * 2` byte multiplication for register offsets (Class 7)
- ✅ `peek(VIC_SPRITE_ENABLE) | mask` R-M-W with temp var (Class 9 + workaround)
- ✅ `y0 < y1` comparisons for sorting (Class 1: byte comparison)
- ✅ if-else blocks with function calls in both branches (Class 3)
- ✅ `50 + offset` expressions as function arguments (Class 7)
- ✅ `frame += 1` compound assignment (Bug 4)
- ✅ `frame = 0` literal assignment (Bug 5)
- ✅ `barrier()` in raster wait loop (Class 9)
- ✅ 4-parameter function `sortAndDisplay` (Class 10)
- ✅ Multiple enableSprite calls building up bitmask incrementally

---

## Scenario 16: Screen Editor (Tests Classes 3, 4, 5)

**Real-world pattern:** Text cursor management with joystick movement, screen RAM character editing.

**Module A: input.blend**
```js
module Input;

const JOY2: word = $DC00;

export function readJoy(): byte {
    return peek(JOY2) & $1F;
}

export function joyUp(joy: byte): byte {
    if (joy & $01) {
        return 0;
    }
    return 1;
}

export function joyDown(joy: byte): byte {
    if (joy & $02) {
        return 0;
    }
    return 1;
}

export function joyLeft(joy: byte): byte {
    if (joy & $04) {
        return 0;
    }
    return 1;
}

export function joyRight(joy: byte): byte {
    if (joy & $08) {
        return 0;
    }
    return 1;
}

export function joyFire(joy: byte): byte {
    if (joy & $10) {
        return 0;
    }
    return 1;
}
```

**Module B: editor.blend**
```js
module Editor;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;
const BORDER: word = $D020;

export function main(): void {
    let cursorX: byte = 0;
    let cursorY: byte = 0;
    let curChar: byte = 65;

    while (true) {
        let joy: byte = peek($DC00) & $1F;
        let moved: byte = 0;

        if ((joy & $01) == 0) {
            if (cursorY > 0) {
                cursorY -= 1;
                moved = 1;
            }
        }
        if ((joy & $02) == 0) {
            if (cursorY < 24) {
                cursorY += 1;
                moved = 1;
            }
        }
        if ((joy & $04) == 0) {
            if (cursorX > 0) {
                cursorX -= 1;
                moved = 1;
            }
        }
        if ((joy & $08) == 0) {
            if (cursorX < 39) {
                cursorX += 1;
                moved = 1;
            }
        }

        if ((joy & $10) == 0) {
            let pos: word = cursorY * 40 + cursorX;
            poke(SCREEN_RAM + pos, curChar);
            curChar += 1;
            if (curChar > 90) {
                curChar = 65;
            }
        }

        if (moved == 1) {
            let cursorAddr: word = cursorY * 40 + cursorX;
            poke(COLOR_RAM + cursorAddr, 1);
            poke(BORDER, cursorX);
        }

        for (_delay = 0 to 254) {
            barrier();
        }
    }
}
```

**Verifications:**
- ✅ Multi-module compilation: Input + Editor modules (Class 5)
- ✅ `joy & $01`, `joy & $02`, etc. — bit testing patterns (Class 7)
- ✅ Nested if-blocks with boundary checking (Class 3)
- ✅ `cursorY * 40 + cursorX` address calculation (Class 7)
- ✅ `cursorX += 1`, `cursorY -= 1` compound assignments (Bug 4)
- ✅ `curChar = 65`, `cursorX = 0` literal assignments (Bug 5)
- ✅ `moved == 1` flag-based conditional (Class 3)
- ✅ Multiple variables in same scope (Class 4: memory layout)
- ✅ `barrier()` in delay loop (Class 9)
- ✅ Word computation `cursorY * 40 + cursorX` for screen position (Class 1)

---

## Scenario 17: High Score Table (Tests Classes 1, 4, 7)

**Real-world pattern:** Managing high scores with word comparisons, bubble-sort logic, and screen display using multiple variables.

```js
module HighScore;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;
const BORDER: word = $D020;

function displayDigit(pos: word, value: byte): void {
    poke(SCREEN_RAM + pos, value + 48);
    poke(COLOR_RAM + pos, 1);
}

function displayScore(row: byte, score: word): void {
    let base: word = row * 40 + 10;
    let thousands: byte = 0;
    let hundreds: byte = 0;
    let tens: byte = 0;
    let remaining: word = score;

    while (remaining >= 1000) {
        thousands += 1;
        remaining -= 1000;
    }
    while (remaining >= 100) {
        hundreds += 1;
        remaining -= 100;
    }
    while (remaining >= 10) {
        tens += 1;
        remaining -= 10;
    }
    let ones: byte = lo(remaining);

    displayDigit(base, thousands);
    displayDigit(base + 1, hundreds);
    displayDigit(base + 2, tens);
    displayDigit(base + 3, ones);
}

function sortScores(s0: word, s1: word, s2: word): void {
    if (s0 < s1) {
        displayScore(2, s1);
        displayScore(4, s0);
    } else {
        displayScore(2, s0);
        displayScore(4, s1);
    }
    displayScore(6, s2);
}

export function main(): void {
    let score1: word = 1500;
    let score2: word = 2300;
    let score3: word = 800;
    sortScores(score1, score2, score3);
    poke(BORDER, 6);
}
```

**Verifications:**
- ✅ Word variables `score`, `remaining` with word comparisons (Class 1)
- ✅ `remaining >= 1000`, `remaining >= 100` word comparisons in while (Class 1 + Class 3)
- ✅ `remaining -= 1000`, `remaining -= 100` word compound assignments (Bug 4 + Class 1)
- ✅ Multiple local variables in same function (Class 4: memory layout)
- ✅ `row * 40 + 10` word address calculation (Class 7)
- ✅ `lo(remaining)` byte extraction from word (Class 1: type coercion)
- ✅ `s0 < s1` word comparison in if-else (Class 1 + Class 3)
- ✅ `value + 48` expression as poke argument (Class 7)
- ✅ No false unused warnings (Bug 1)

---

## Scenario 18: Parallax Scroller (Tests Classes 2, 6, 9)

**Real-world pattern:** Multi-layer parallax scrolling using VIC-II scroll registers with different speeds per layer.

```js
module ParallaxScroll;

const VIC_SCROLL_X: word = $D016;
const VIC_RASTER: word = $D012;
const BORDER: word = $D020;
const SCREEN_RAM: word = $0400;

function waitRaster(line: byte): void {
    while (peek(VIC_RASTER) != line) {
        barrier();
    }
}

function setHScroll(offset: byte): void {
    let reg: byte = peek(VIC_SCROLL_X) & $F8;
    let masked: byte = offset & $07;
    let combined: byte = reg | masked;
    poke(VIC_SCROLL_X, combined);
}

function drawLayer(row: byte, offset: byte): void {
    let base: word = row * 40;
    for (let col: byte = 0 to 39 step 1) {
        let charVal: byte = col + offset;
        poke(SCREEN_RAM + base + col, charVal);
    }
}

export function main(): void {
    let fastScroll: byte = 0;
    let medScroll: byte = 0;
    let slowScroll: byte = 0;
    let frameCount: byte = 0;

    while (true) {
        waitRaster(250);

        // Fast layer — every frame
        fastScroll += 1;
        if (fastScroll > 7) {
            fastScroll = 0;
            drawLayer(0, frameCount);
        }

        // Medium layer — every 2nd frame
        if (frameCount & $01) {
            medScroll += 1;
            if (medScroll > 7) {
                medScroll = 0;
                drawLayer(12, frameCount);
            }
        }

        // Slow layer — every 4th frame
        if (frameCount & $03) {
            slowScroll += 1;
            if (slowScroll > 7) {
                slowScroll = 0;
                drawLayer(22, frameCount);
            }
        }

        setHScroll(fastScroll);
        poke(BORDER, fastScroll);
        frameCount += 1;
    }
}
```

**Verifications:**
- ✅ `peek(VIC_SCROLL_X) & $F8` R-M-W with temp vars (Class 9 + workaround)
- ✅ `peek(VIC_RASTER) != line` volatile hardware read in while (Class 9)
- ✅ `barrier()` preserved in raster wait (Class 9)
- ✅ `frameCount & $01`, `frameCount & $03` bitwise tests (Class 7)
- ✅ Multiple compound assignments: `fastScroll += 1`, `medScroll += 1`, `slowScroll += 1` (Bug 4)
- ✅ Multiple literal assignments: `fastScroll = 0`, `medScroll = 0`, etc. (Bug 5)
- ✅ Nested if-blocks inside while loop (Class 3)
- ✅ At O3: waitRaster, setHScroll, drawLayer inlined (Bug 3, Bug 6)
- ✅ `col + offset` expression in poke value (Class 7)
- ✅ `row * 40` address calculation (Class 7)

---

## Scenario 19: Particle System (Tests Classes 1, 4, 10)

**Real-world pattern:** Simple particle effect using multiple parallel variables to track position and velocity of particles.

```js
module Particles;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;
const BORDER: word = $D020;

function clearParticle(x: byte, y: byte): void {
    let pos: word = y * 40 + x;
    poke(SCREEN_RAM + pos, 32);
}

function drawParticle(x: byte, y: byte, char: byte): void {
    let pos: word = y * 40 + x;
    poke(SCREEN_RAM + pos, char);
    poke(COLOR_RAM + pos, 1);
}

function updateVelocity(vel: byte, accel: byte): byte {
    let newVel: byte = vel + accel;
    if (newVel > 200) {
        return 0;
    }
    return newVel;
}

function bounceCheck(pos: byte, limit: byte): byte {
    if (pos >= limit) {
        return 1;
    }
    return 0;
}

export function main(): void {
    // Particle 0 state
    let p0x: byte = 20;
    let p0y: byte = 12;
    let p0vx: byte = 1;
    let p0vy: byte = 0;

    // Particle 1 state
    let p1x: byte = 10;
    let p1y: byte = 5;
    let p1vx: byte = 2;
    let p1vy: byte = 1;

    let frame: byte = 0;

    while (true) {
        // Clear old positions
        clearParticle(p0x, p0y);
        clearParticle(p1x, p1y);

        // Update particle 0
        p0vx = updateVelocity(p0vx, 0);
        p0vy = updateVelocity(p0vy, 1);
        p0x += p0vx;
        p0y += p0vy;
        if (bounceCheck(p0x, 39)) {
            p0x = 39;
            p0vx = 0;
        }
        if (bounceCheck(p0y, 24)) {
            p0y = 24;
            p0vy = 0;
        }

        // Update particle 1
        p1vx = updateVelocity(p1vx, 0);
        p1vy = updateVelocity(p1vy, 1);
        p1x += p1vx;
        p1y += p1vy;
        if (bounceCheck(p1x, 39)) {
            p1x = 39;
            p1vx = 0;
        }
        if (bounceCheck(p1y, 24)) {
            p1y = 24;
            p1vy = 0;
        }

        // Draw new positions
        drawParticle(p0x, p0y, 81);
        drawParticle(p1x, p1y, 87);

        poke(BORDER, frame & $0F);
        frame += 1;

        for (_delay = 0 to 254) {
            barrier();
        }
    }
}
```

**Verifications:**
- ✅ Many local variables (p0x, p0y, p0vx, p0vy, p1x, p1y, ...) (Class 4: memory layout)
- ✅ `y * 40 + x` word address calculation (Class 1 + Class 7)
- ✅ `p0x += p0vx` compound assignment with variable (Bug 4)
- ✅ `p0x = 39`, `p0vy = 0` literal assignments in if-body (Bug 5)
- ✅ Function return values assigned to variables (Class 10)
- ✅ Function return values used in if-conditions (Class 10)
- ✅ `frame & $0F` bitwise expression in poke value (Class 7)
- ✅ `newVel > 200` comparison with early return (Class 3)
- ✅ `pos >= limit` parameterized comparison (Class 10)
- ✅ No false unused warnings for any particle state variables (Bug 1)

---

## Scenario 20: Boot Sequence (Tests All Classes)

**Real-world pattern:** Full game boot sequence initializing screen, SID, and sprites — the most comprehensive single-program stress test.

```js
module BootSequence;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;
const BORDER: word = $D020;
const BG: word = $D021;
const SID_VOLUME: word = $D418;
const SID_V1_AD: word = $D405;
const SID_V1_SR: word = $D406;
const SID_V1_FREQ_LO: word = $D400;
const SID_V1_FREQ_HI: word = $D401;
const SID_V1_CONTROL: word = $D404;
const VIC_SPRITE_ENABLE: word = $D015;
const VIC_RASTER: word = $D012;
const VIC_SPRITE_Y0: word = $D001;
const VIC_SPRITE_X0: word = $D000;

function clearScreen(): void {
    for (let i: word = 0 to 999 step 1) {
        poke(SCREEN_RAM + i, 32);
        poke(COLOR_RAM + i, 14);
    }
}

function initColors(): void {
    poke(BORDER, 6);
    poke(BG, 0);
}

function initSID(): void {
    poke(SID_VOLUME, 15);
    poke(SID_V1_AD, $09);
    poke(SID_V1_SR, $00);
}

function playBootSound(): void {
    poke(SID_V1_FREQ_LO, $00);
    poke(SID_V1_FREQ_HI, $10);
    poke(SID_V1_CONTROL, $11);
    for (_d = 0 to 254) {
        barrier();
    }
    poke(SID_V1_CONTROL, $10);
}

function initSprites(): void {
    poke(VIC_SPRITE_ENABLE, $01);
    poke(VIC_SPRITE_X0, 100);
    poke(VIC_SPRITE_Y0, 100);
}

function drawTitle(row: byte): void {
    let base: word = row * 40;
    for (let i: byte = 0 to 9 step 1) {
        poke(SCREEN_RAM + base + i, i + 1);
    }
}

function waitRaster(line: byte): void {
    while (peek(VIC_RASTER) != line) {
        barrier();
    }
}

export function main(): void {
    // Phase 1: Screen init
    clearScreen();
    initColors();

    // Phase 2: Sound init
    initSID();
    playBootSound();

    // Phase 3: Sprite init
    initSprites();

    // Phase 4: Title screen
    drawTitle(5);
    drawTitle(7);

    // Phase 5: Main loop
    let frame: byte = 0;
    while (true) {
        waitRaster(250);
        poke(BORDER, frame & $0F);
        frame += 1;
        if (frame > 15) {
            frame = 0;
        }
    }
}
```

**Verifications:**
- ✅ Word loop 0 to 999 (Class 1: word counter)
- ✅ Dynamic address poke in loops (Bug 2)
- ✅ Multiple function calls in sequence (Class 10: calling convention)
- ✅ `barrier()` preserved in delay and raster wait (Class 9)
- ✅ `frame & $0F` bitwise expression (Class 7)
- ✅ `frame += 1` compound assignment (Bug 4)
- ✅ `frame = 0` literal assignment (Bug 5)
- ✅ At O3: small functions inlined, originals removed (Bug 3, Bug 6)
- ✅ Many I/O register constants and poke calls (Class 4)
- ✅ `row * 40` address calculation (Class 7)
- ✅ `i + 1` expression in loop body (Class 7)
- ✅ `peek(VIC_RASTER) != line` hardware read comparison (Class 9)
- ✅ No false unused warnings (Bug 1)
- ✅ Exercises ALL bug classes and ALL feature classes in one program

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
