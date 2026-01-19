# Step 6: @map System Analysis (Deep Dive)

**Status**: In Progress
**Part of**: cap65 Comprehensive Analysis
**Date**: December 1, 2026

## What This Step Covers

Focus ONLY on the @map memory-mapped system - Blend65's most powerful and unique C64-specific feature. Deep analysis of all 4 forms and their real-world applications.

## Why @map is Revolutionary for C64 Development

The @map system solves the fundamental problem of C64 programming: **direct hardware register access with type safety and structured organization**.

**Traditional C64 Assembly/BASIC Problems**:

- Magic numbers everywhere: `POKE 53280, 1`
- No structure or organization
- Easy to make addressing mistakes
- No type safety or validation
- Poor code readability and maintenance

**Blend65 @map Solution**:

- Named register access: `vic.borderColor = 1`
- Structured hardware organization
- Compile-time address validation
- Type-safe register access
- Self-documenting code

## The Four @map Forms (Complete Analysis)

### Form 1: Simple @map (Single Register)

**Grammar**: `@map identifier at address : type ;`

**Use Case**: Individual hardware registers that need direct access

**Memory Layout**: Single memory location mapped to typed variable

```js
// VIC-II Individual Registers
@map borderColor at $D020: byte;      // Border color (0-15)
@map backgroundColor at $D021: byte;  // Background color (0-15)
@map rasterLine at $D012: byte;       // Current raster line (0-255)
@map spriteEnable at $D015: byte;     // Sprite enable bits (8 bits for 8 sprites)

// SID Individual Registers
@map masterVolume at $D418: byte;     // Master volume (0-15 in low nibble)
@map voice1Control at $D404: byte;    // Voice 1 control register
@map filterCutoff at $D415: byte;     // Filter cutoff frequency low

// CIA Individual Registers
@map joystick1 at $DC00: byte;        // Joystick port 1 data
@map joystick2 at $DC01: byte;        // Joystick port 2 data
@map timerALow at $DC04: byte;        // CIA Timer A low byte

// Usage - Clean and Readable
borderColor = BLUE;                   // Set border to blue
backgroundColor = BLACK;              // Set background to black

if (rasterLine == 250) {             // Check raster position
  borderColor = RED;                 // Raster bar effect
}

let joyState: byte = joystick1;       // Read joystick
if (joyState & $10) {                // Check fire button
  fireBullet();
}
```

**Advantages of Simple Form**:

- **Minimal overhead**: Direct 1:1 memory mapping
- **Clear semantics**: One name = one register
- **Easy debugging**: Register names match hardware documentation
- **Type safety**: Prevents wrong data types being assigned

### Form 2: Range @map (Contiguous Memory Block)

**Grammar**: `@map identifier from startAddress to endAddress : type ;`

**Use Case**: Arrays of data or large contiguous memory areas

**Memory Layout**: Contiguous block treated as typed array

```js
// Screen and Color Memory
@map screenRAM from $0400 to $07FF: byte;    // 1024 bytes of screen memory
@map colorRAM from $D800 to $DBE7: byte;     // 1000 bytes of color memory
@map spritePointers from $07F8 to $07FF: byte; // 8 sprite pointer bytes

// Character Set Data
@map characterROM from $D000 to $DFFF: byte; // 4KB character ROM (when visible)
@map characterRAM from $2000 to $2FFF: byte; // 4KB custom character set

// User Memory Areas
@map gameData from $C000 to $CFFF: byte;     // 4KB game data area
@map soundBuffer from $5000 to $5FFF: byte;  // 4KB sound sample buffer
@map spriteData from $3000 to $33FF: byte;   // 1KB sprite graphics data

// Usage - Array-like Access
// Clear screen memory
for i = 0 to 999
  screenRAM[i] = 32;  // 32 = space character
  colorRAM[i] = 14;   // 14 = light blue
next i

// Set sprite pointers
for sprite = 0 to 7
  spritePointers[sprite] = (SPRITE_DATA_BASE + sprite * 64) / 64;
next sprite

// Load character set
for i = 0 to 2047
  characterRAM[i] = customCharacterData[i];
next i

// Screen positioning calculations
let screenPos: word = y * 40 + x;        // Calculate screen position
screenRAM[screenPos] = characterCode;    // Place character
colorRAM[screenPos] = characterColor;    // Set color
```

**Real-World C64 Applications**:

```js
// Text rendering system
function renderText(text: string, x: byte, y: byte, color: byte): void
  let pos: word = y * 40 + x;

  for i = 0 to text.length - 1
    screenRAM[pos + i] = text[i];
    colorRAM[pos + i] = color;
  next i
end function

// Sprite animation system
function animateSprite(spriteNum: byte, frameData: byte[], frameCount: byte): void
  let baseAddr: word = SPRITE_AREA_BASE + spriteNum * 64;
  let currentFrame: byte = (frameCounter / ANIMATION_SPEED) % frameCount;

  for i = 0 to 63
    spriteData[baseAddr + i] = frameData[currentFrame * 64 + i];
  next i
end function
```

### Form 3: Sequential Struct @map (Automatic Layout)

**Grammar**: `@map identifier at baseAddress type field : type [, field : type]* end @map`

**Use Case**: Hardware register blocks where registers are sequential in memory

**Memory Layout**: Fields are automatically laid out sequentially from base address

```js
// Complete SID Chip (Sequential Layout)
@map sid at $D400 type
  // Voice 1 ($D400-$D406)
  voice1FreqLo: byte,           // $D400 - Frequency low byte
  voice1FreqHi: byte,           // $D401 - Frequency high byte
  voice1PulseWidthLo: byte,     // $D402 - Pulse width low
  voice1PulseWidthHi: byte,     // $D403 - Pulse width high
  voice1Control: byte,          // $D404 - Control register
  voice1AttackDecay: byte,      // $D405 - Attack/decay
  voice1SustainRelease: byte,   // $D406 - Sustain/release

  // Voice 2 ($D407-$D40D)
  voice2FreqLo: byte,           // $D407
  voice2FreqHi: byte,           // $D408
  voice2PulseWidthLo: byte,     // $D409
  voice2PulseWidthHi: byte,     // $D40A
  voice2Control: byte,          // $D40B
  voice2AttackDecay: byte,      // $D40C
  voice2SustainRelease: byte,   // $D40D

  // Voice 3 ($D40E-$D414)
  voice3FreqLo: byte,           // $D40E
  voice3FreqHi: byte,           // $D40F
  voice3PulseWidthLo: byte,     // $D410
  voice3PulseWidthHi: byte,     // $D411
  voice3Control: byte,          // $D412
  voice3AttackDecay: byte,      // $D413
  voice3SustainRelease: byte,   // $D414

  // Global SID controls ($D415-$D418)
  filterCutoffLo: byte,         // $D415
  filterCutoffHi: byte,         // $D416
  filterResonance: byte,        // $D417
  volumeAndFilter: byte         // $D418
end @map

// Sequential with Array Fields
@map gameStats at $C000 type
  playerLevel: byte,            // $C000 - Player level (1 byte)
  playerScore: word,            // $C001-$C002 - Score (2 bytes)
  lives: byte,                  // $C003 - Lives remaining
  powerUpFlags: byte,           // $C004 - Power-up status bits
  inventory: byte[16],          // $C005-$C014 - 16-item inventory
  playerName: byte[10],         // $C015-$C01E - Player name (10 chars)
  highScores: word[8]           // $C01F-$C02E - Top 8 high scores (16 bytes)
end @map
```

**Advanced Sequential Usage**:

```js
// SID Music System
function playNote(voice: byte, frequency: word, waveform: byte): void
  match voice
    case 1:
      sid.voice1FreqLo = frequency & $FF;
      sid.voice1FreqHi = (frequency >> 8) & $FF;
      sid.voice1Control = waveform | $01;  // Gate on

    case 2:
      sid.voice2FreqLo = frequency & $FF;
      sid.voice2FreqHi = (frequency >> 8) & $FF;
      sid.voice2Control = waveform | $01;

    case 3:
      sid.voice3FreqLo = frequency & $FF;
      sid.voice3FreqHi = (frequency >> 8) & $FF;
      sid.voice3Control = waveform | $01;
  end match
end function

// Game Statistics Management
function updatePlayerStats(newScore: word, newLevel: byte): void
  gameStats.playerScore = newScore;
  gameStats.playerLevel = newLevel;

  // Check for power-up unlocks based on level
  if newLevel >= 5 then
    gameStats.powerUpFlags |= SHIELD_POWERUP;
  end if

  if newLevel >= 10 then
    gameStats.powerUpFlags |= SPEED_POWERUP;
  end if
end function
```

### Form 4: Explicit Struct @map (Manual Layout)

**Grammar**: `@map identifier at baseAddress layout field : (at address | from start to end) : type [, ...]* end @map`

**Use Case**: Hardware where registers are NOT sequential (most real hardware)

**Memory Layout**: Each field specifies its exact memory location

```js
// Complete VIC-II Chip (Non-Sequential Layout)
@map vic at $D000 layout
  // Sprite coordinates ($D000-$D00F)
  spriteCoords: from $D000 to $D00F: byte,

  // Control registers (scattered addresses)
  spriteXMSB: at $D010: byte,           // X coordinate MSB bits
  screenControl1: at $D011: byte,       // Screen control register #1
  rasterCounter: at $D012: byte,        // Raster line counter
  lightPenX: at $D013: byte,           // Light pen X coordinate
  lightPenY: at $D014: byte,           // Light pen Y coordinate
  spriteEnable: at $D015: byte,         // Sprite enable register
  screenControl2: at $D016: byte,       // Screen control register #2
  spriteYExpand: at $D017: byte,        // Sprite Y expansion
  memoryPointers: at $D018: byte,       // Memory setup register
  interruptStatus: at $D019: byte,      // Interrupt status register
  interruptEnable: at $D01A: byte,      // Interrupt enable register
  spritePriority: at $D01B: byte,       // Sprite priority register
  spriteMulticolor: at $D01C: byte,     // Sprite multicolor enable
  spriteXExpand: at $D01D: byte,        // Sprite X expansion
  spriteCollision: at $D01E: byte,      // Sprite-sprite collision
  bgCollision: at $D01F: byte,          // Sprite-background collision

  // Colors (specific addresses)
  borderColor: at $D020: byte,          // Border color
  backgroundColor0: at $D021: byte,     // Background color 0
  backgroundColor1: at $D022: byte,     // Background color 1
  backgroundColor2: at $D023: byte,     // Background color 2
  backgroundColor3: at $D024: byte,     // Background color 3
  spriteMulticolor0: at $D025: byte,    // Sprite multicolor 0
  spriteMulticolor1: at $D026: byte,    // Sprite multicolor 1

  // Individual sprite colors ($D027-$D02E)
  spriteColors: from $D027 to $D02E: byte
end @map

// CIA 1 Complex Interface (Non-Sequential)
@map cia1 at $DC00 layout
  dataPortA: at $DC00: byte,            // Data port A
  dataPortB: at $DC01: byte,            // Data port B
  dataDirectionA: at $DC02: byte,       // Data direction register A
  dataDirectionB: at $DC03: byte,       // Data direction register B
  timerALo: at $DC04: byte,            // Timer A low byte
  timerAHi: at $DC05: byte,            // Timer A high byte
  timerBLo: at $DC06: byte,            // Timer B low byte
  timerBHi: at $DC07: byte,            // Timer B high byte
  realTimeClockTenths: at $DC08: byte, // RTC tenths of seconds
  realTimeClockSeconds: at $DC09: byte, // RTC seconds
  realTimeClockMinutes: at $DC0A: byte, // RTC minutes
  realTimeClockHours: at $DC0B: byte,   // RTC hours
  serialShiftReg: at $DC0C: byte,       // Serial shift register
  interruptControl: at $DC0D: byte,     // Interrupt control register
  controlRegA: at $DC0E: byte,          // Control register A
  controlRegB: at $DC0F: byte           // Control register B
end @map
```

**Complex Hardware Control Examples**:

```js
// Advanced VIC-II Graphics Setup
function initializeGraphicsMode(): void
  // Set up basic text mode
  vic.screenControl1 = $1B;    // Standard text mode, 25 rows
  vic.screenControl2 = $C8;    // 40 columns, multicolor off

  // Set memory layout
  vic.memoryPointers = $15;    // Screen at $0400, charset at $1000

  // Configure colors
  vic.borderColor = BLACK;
  vic.backgroundColor0 = BLACK;
  vic.backgroundColor1 = WHITE;
  vic.backgroundColor2 = RED;
  vic.backgroundColor3 = CYAN;

  // Enable raster interrupt at line 250
  vic.rasterCounter = 250;
  vic.interruptEnable = $01;   // Enable raster interrupt
end function

// Sprite Management System
function configureSprite(spriteNum: byte, x: word, y: byte, color: byte): void
  // Set sprite position (handling 9-bit X coordinate)
  vic.spriteCoords[spriteNum * 2] = x & $FF;        // X low byte
  vic.spriteCoords[spriteNum * 2 + 1] = y;          // Y coordinate

  if x >= 256 then
    vic.spriteXMSB |= (1 << spriteNum);            // Set X MSB bit
  else
    vic.spriteXMSB &= ~(1 << spriteNum);           // Clear X MSB bit
  end if

  // Set sprite color
  vic.spriteColors[spriteNum] = color;

  // Enable the sprite
  vic.spriteEnable |= (1 << spriteNum);
end function

// CIA Timer System for Precise Timing
function setupTimerInterrupt(frequency: word): void
  // Calculate timer value for desired frequency
  let timerValue: word = 19656 / frequency;  // PAL C64 frequency

  cia1.timerALo = timerValue & $FF;
  cia1.timerAHi = (timerValue >> 8) & $FF;

  // Configure timer A for continuous operation
  cia1.controlRegA = $11;  // Timer A: continuous, start

  // Enable timer A interrupt
  cia1.interruptControl = $81;  // Enable timer A interrupt
end function
```

## @map System Features and Validation

### Compile-Time Address Validation

The parser validates @map addresses at parse time:

```js
// ✅ Valid addresses
@map vic at $D000: byte;      // Standard VIC-II base
@map sid at $D400: byte;      // Standard SID base
@map cia1 at $DC00: byte;     // Standard CIA1 base

// ❌ Invalid addresses (parser catches these)
@map invalid at $ZZZZ: byte;  // ERROR: Invalid hex format
@map overlap at $D020 layout
  field1: at $D020: byte,
  field2: at $D020: byte;     // ERROR: Address conflict detected
end @map
```

### Type Safety and Range Checking

```js
// Type-safe register access
@map borderColor at $D020: byte;

borderColor = 5;              // ✅ Valid: byte value
borderColor = 255;            // ✅ Valid: max byte value
borderColor = $FF;            // ✅ Valid: hex byte value
borderColor = playerLevel + 3; // ✅ Valid: expression result

// The following would be caught by semantic analysis (future phases):
// borderColor = 256;         // ERROR: Value exceeds byte range
// borderColor = "red";       // ERROR: Wrong type
// borderColor = someWord;    // ERROR: Implicit narrowing conversion
```

### Member Access Validation

```js
@map vic at $D000 layout
  borderColor: at $D020: byte,
  backgroundColor: at $D021: byte
end @map

// ✅ Valid member access
vic.borderColor = RED;
vic.backgroundColor = BLUE;

// ❌ Invalid member access (parser catches)
vic.invalidField = 0;         // ERROR: Unknown field
vic = someValue;              // ERROR: Cannot assign to entire struct
let x = vic;                  // ERROR: Cannot read entire struct
```

## Real-World C64 Hardware Integration

### Complete Game Engine Hardware Layer

```js
// Comprehensive C64 Hardware Abstraction
@map vic at $D000 layout
  spriteCoords: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  screenControl1: at $D011: byte,
  rasterLine: at $D012: byte,
  spriteEnable: at $D015: byte,
  screenControl2: at $D016: byte,
  memorySetup: at $D018: byte,
  interruptStatus: at $D019: byte,
  borderColor: at $D020: byte,
  backgroundColor: at $D021: byte,
  spriteColors: from $D027 to $D02E: byte
end @map

@map sid at $D400 type
  voice1Freq: word,             // Combines FreqLo and FreqHi
  voice1PulseWidth: word,       // Combines PulseWidthLo and PulseWidthHi
  voice1Control: byte,
  voice1ADSR: word,            // Combines AttackDecay and SustainRelease
  voice2Freq: word,
  voice2PulseWidth: word,
  voice2Control: byte,
  voice2ADSR: word,
  voice3Freq: word,
  voice3PulseWidth: word,
  voice3Control: byte,
  voice3ADSR: word,
  filterCutoff: word,          // Combines CutoffLo and CutoffHi
  filterControl: byte,
  volume: byte
end @map

@map cia1 at $DC00 layout
  joystick1: at $DC00: byte,
  joystick2: at $DC01: byte,
  dataDirectionA: at $DC02: byte,
  dataDirectionB: at $DC03: byte,
  timerA: at $DC04: word,      // Combines TimerALo and TimerAHi
  timerB: at $DC06: word,      // Combines TimerBLo and TimerBHi
  interruptControl: at $DC0D: byte,
  controlA: at $DC0E: byte,
  controlB: at $DC0F: byte
end @map

// Memory Areas
@map screenRAM from $0400 to $07FF: byte;
@map colorRAM from $D800 to $DBE7: byte;
@map spriteData from $2000 to $2FFF: byte;
```

### Hardware Abstraction Functions

```js
// High-level hardware interface built on @map system
function initializeHardware(): void
  // VIC-II setup
  vic.borderColor = BLACK;
  vic.backgroundColor = BLACK;
  vic.screenControl1 = $1B;    // 25-line text mode
  vic.screenControl2 = $C8;    // 40-column mode
  vic.memorySetup = $15;       // Screen $0400, charset $1000
  vic.spriteEnable = $00;      // All sprites off initially

  // SID setup
  sid.volume = $0F;            // Maximum volume
  sid.filterControl = $00;     // Filter off initially

  // CIA setup
  cia1.dataDirectionA = $FF;   // Port A output
  cia1.dataDirectionB = $00;   // Port B input (joysticks)
end function

function updateDisplay(): void
  // Scroll text up one line
  for row = 0 to 23
    for col = 0 to 39
      let sourcePos: word = (row + 1) * 40 + col;
      let destPos: word = row * 40 + col;
      screenRAM[destPos] = screenRAM[sourcePos];
      colorRAM[destPos] = colorRAM[sourcePos];
    next col
  next row

  // Clear bottom line
  for col = 0 to 39
    screenRAM[24 * 40 + col] = 32;  // Space character
    colorRAM[24 * 40 + col] = WHITE;
  next col
end function

function playGameSound(soundType: byte): void
  match soundType
    case EXPLOSION_SOUND:
      sid.voice1Freq = 200;
      sid.voice1Control = $81;  // Noise waveform, gate on

    case LASER_SOUND:
      sid.voice2Freq = 1000;
      sid.voice2Control = $21;  // Sawtooth waveform, gate on

    case PICKUP_SOUND:
      sid.voice3Freq = 1500;
      sid.voice3Control = $41;  // Pulse waveform, gate on
  end match
end function
```

## @map vs Traditional C64 Programming

### Traditional Assembly/BASIC (Problems)

```assembly
; Assembly - Magic numbers everywhere
LDA #$01
STA $D020    ; What is $D020? Border color!
LDA $DC01    ; What is $DC01? Joystick 2!
AND #$10     ; What is #$10? Fire button!
BEQ NO_FIRE

; No structure, no type safety, hard to maintain
```

```basic
10 REM BASIC - Same problems
20 POKE 53280,1     : REM BORDER COLOR (WHO REMEMBERS 53280?)
30 J=PEEK(56321)    : REM JOYSTICK (WHO REMEMBERS 56321?)
40 IF J AND 16 THEN GOSUB 1000
```

### Blend65 @map Solution (Clean)

```js
// Clean, self-documenting, type-safe
@map vic at $D000 layout
  borderColor: at $D020: byte
end @map

@map cia1 at $DC00 layout
  joystick2: at $DC01: byte
end @map

// Usage - reads like natural language
vic.borderColor = 1;

if (cia1.joystick2 & FIRE_BUTTON) {
  fireBullet();
}
```

## Advanced @map Patterns

### Hardware State Management

```js
// Complete hardware state backup/restore
@map hardwareState at $C000 type
  vicBorderColor: byte,
  vicBackgroundColor: byte,
  vicSpriteEnable: byte,
  sidVolume: byte,
  sidVoice1Control: byte,
  sidVoice2Control: byte,
  sidVoice3Control: byte,
  cia1ControlA: byte,
  cia1ControlB: byte
end @map

function saveHardwareState(): void
  hardwareState.vicBorderColor = vic.borderColor;
  hardwareState.vicBackgroundColor = vic.backgroundColor;
  hardwareState.vicSpriteEnable = vic.spriteEnable;
  hardwareState.sidVolume = sid.volume;
  hardwareState.sidVoice1Control = sid.voice1Control;
  hardwareState.sidVoice2Control = sid.voice2Control;
  hardwareState.sidVoice3Control = sid.voice3Control;
  hardwareState.cia1ControlA = cia1.controlA;
  hardwareState.cia1ControlB = cia1.controlB;
end function

function restoreHardwareState(): void
  vic.borderColor = hardwareState.vicBorderColor;
  vic.backgroundColor = hardwareState.vicBackgroundColor;
  vic.spriteEnable = hardwareState.vicSpriteEnable;
  sid.volume = hardwareState.sidVolume;
  sid.voice1Control = hardwareState.sidVoice1Control;
  sid.voice2Control = hardwareState.sidVoice2Control;
  sid.voice3Control = hardwareState.sidVoice3Control;
  cia1.controlA = hardwareState.cia1ControlA;
  cia1.controlB = hardwareState.cia1ControlB;
end function
```

## What @map CANNOT Do (Current Limitations)

**Not Yet Implemented**:

```js
// ❌ Computed field addresses
@map dynamic at baseAddr layout
  field: at baseAddr + offset: byte;  // Not supported - no expressions in addresses

// ❌ Conditional fields
@map conditional at $D000 layout
  field1: if MODE_A at $D000: byte;   // Not supported - no conditional compilation

// ❌ Union/variant fields
@map variant at $D000 layout
  asBytes: from $D000 to $D001: byte[2];
  asWord: at $D000: word;             // Not supported - overlapping fields
end @map
```

**Specification Limitations**:

```js
// ❌ Bitfield access (would be useful for flag registers)
@map flags at $D015 layout
  sprite0Enable: bit 0: boolean;      // Not in specification
  sprite1Enable: bit 1: boolean;      // Would require bit-level access
end @map

// ❌ Volatile semantics (important for hardware registers)
@map volatile vic at $D000 layout    // Not supported - no volatile keyword
  rasterLine: at $D012: byte;         // Should be volatile (hardware changes it)
end @map
```

## Next Steps

This completes Step 6. The @map system is Blend65's most revolutionary feature, providing unprecedented C64 hardware access with modern language safety and organization. It transforms C64 development from magic-number-driven assembly into structured, readable, maintainable code.

**Ready for**: Step 7 - Control Flow Analysis (Integration Focus)
