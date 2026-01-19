# Step 4: Declaration Parsing Analysis

**Status**: In Progress
**Part of**: cap65 Comprehensive Analysis
**Date**: December 1, 2026

## What This Step Covers

Focus ONLY on declaration parsing - variable declarations and the complete @map memory-mapped system (all 4 forms).

## Variable Declaration Parsing

The Blend65 parser supports comprehensive variable declarations with C64-specific storage classes and modern language features.

### Basic Variable Declaration Syntax

**Grammar**: `[export] [StorageClass] (let | const) identifier [: type] [= expression] ;`

### Storage Classes (C64-Specific)

```js
// Zero Page (@zp) - Fastest access, limited space
@zp let counter: byte = 0;
@zp const FAST_TEMP: byte = $80;

// RAM (@ram) - Default storage, general purpose
@ram let gameState: word = MENU_STATE;
@ram const buffer: byte[256] = [0, 1, 2];
let scoreDisplay: word = 0; // Defaults to @ram

// Data Section (@data) - Initialized read-only data
@data const SPRITE_DATA: byte[64] = [
  $00, $7E, $81, $A5, $81, $BD, $99, $81,
  $81, $7E, $00, $00, $00, $00, $00, $00
];

@data const MUSIC_NOTES: word[8] = [262, 294, 330, 349, 392, 440, 494, 523];
```

### Mutability Modifiers

```js
// Mutable variables (let)
let playerX: byte = 120;          // Can be reassigned
let lives: byte = 3;              // Game state that changes
let currentLevel: byte;           // Uninitialized, can be assigned later

// Immutable constants (const)
const MAX_SPRITES: byte = 8;      // Cannot be reassigned
const SCREEN_WIDTH: word = 320;   // Fixed values
const GAME_VERSION: string = "1.0"; // String constants

// Constants REQUIRE initializers
const PI: word = 314;             // ✅ Valid
const UNINITIALIZED: byte;        // ❌ ERROR: const must have initializer
```

### Export Modifiers

```js
// Export for use in other modules
export let globalScore: word = 0;
export const MAX_LEVEL: byte = 10;
export @zp let frameCounter: byte = 0;

// Combinations work in any order
export @ram const GAME_DATA: byte[100] = [...];
@data export const SOUND_TABLE: word[16] = [...];
```

### Type Annotations

```js
// Primitive types
let position: byte = 0;           // 8-bit unsigned integer
let address: word = $C000;        // 16-bit unsigned integer
let name: string = "Player";      // String type
let ready: boolean = false;       // Boolean type
let callback: callback = myFunc;  // Function pointer type

// Type inference (optional annotations)
let auto1 = 42;                  // Inferred as number
let auto2 = "text";              // Inferred as string
let auto3 = true;                // Inferred as boolean

// Arrays (not fully implemented yet, but syntax parsed)
let buffer: byte[256];           // Array type annotation
let matrix: word[10][10];        // Multi-dimensional arrays
```

### Complete Variable Declaration Examples

```js
// Simple variable declarations
let x: byte = 10;
const MAX: word = 1000;
@zp let fast: byte;

// Complex declarations with all features
export @zp const RASTER_LINE: byte = 250;
@ram let spritePositions: byte[16] = [0, 0, 50, 50, 100, 100];
export @data const CHARACTER_SET: byte[2048] = [...];

// Multiple declarations (each needs its own statement)
let playerX: byte = 160;
let playerY: byte = 100;
let playerSpeed: byte = 2;

// Expressions in initializers
let screenCenter: byte = SCREEN_WIDTH / 2;
let randomStart: byte = randomByte() % 200;
let gameTitle: string = "Super Game " + VERSION_NUMBER;
```

## @map Declaration Parsing (All 4 Forms)

The Blend65 compiler supports ALL FOUR @map declaration forms for memory-mapped hardware access - this is one of its most powerful C64-specific features.

### Form 1: Simple @map Declaration

**Grammar**: `@map identifier at address : type ;`

**Use Case**: Single hardware registers

```js
// VIC-II registers (Video Interface Chip)
@map borderColor at $D020: byte;       // Border color register
@map backgroundColor at $D021: byte;   // Background color register
@map rasterLine at $D012: byte;        // Current raster line

// SID registers (Sound Interface Device)
@map sidVolume at $D418: byte;         // Master volume
@map voice1Freq at $D400: word;        // Voice 1 frequency (16-bit)
@map voice1Control at $D404: byte;     // Voice 1 control register

// CIA registers (Complex Interface Adapter)
@map joystick1 at $DC00: byte;         // Joystick port 1
@map joystick2 at $DC01: byte;         // Joystick port 2

// Usage examples
borderColor = 1;                       // Set border to white
if (joystick1 & $10) {                // Check fire button
  shoot();
}
```

### Form 2: Range @map Declaration

**Grammar**: `@map identifier from startAddress to endAddress : type ;`

**Use Case**: Contiguous memory blocks

```js
// Large memory areas
@map spritePointers from $07F8 to $07FF: byte;    // 8 sprite pointers
@map colorRAM from $D800 to $DBE7: byte;          // 1000 bytes of color RAM
@map characterRAM from $0400 to $07FF: byte;      // 1024 bytes of screen memory

// Custom memory blocks
@map gameData from $C000 to $CFFF: byte;          // 4K game data area
@map soundBuffer from $1000 to $1FFF: byte;       // 4K sound sample buffer

// Usage examples - treated as arrays
spritePointers[0] = PLAYER_SPRITE_FRAME;           // Set sprite 0 pointer
colorRAM[y * 40 + x] = WHITE;                     // Set character color
characterRAM[position] = SPACE_CHARACTER;         // Clear screen position
```

### Form 3: Sequential Struct @map Declaration

**Grammar**: `@map identifier at baseAddress type field : type [, field : type]* end @map`

**Use Case**: Hardware registers with automatic sequential layout

```js
// SID chip registers (automatic layout)
@map sid at $D400 type
  voice1FreqLo: byte,      // $D400 - Voice 1 frequency low
  voice1FreqHi: byte,      // $D401 - Voice 1 frequency high
  voice1PulseWidthLo: byte, // $D402 - Voice 1 pulse width low
  voice1PulseWidthHi: byte, // $D403 - Voice 1 pulse width high
  voice1Control: byte,     // $D404 - Voice 1 control register
  voice1AttackDecay: byte, // $D405 - Voice 1 attack/decay
  voice1SustainRelease: byte, // $D406 - Voice 1 sustain/release
  voice2FreqLo: byte,      // $D407 - Voice 2 frequency low
  voice2FreqHi: byte       // $D408 - Voice 2 frequency high
end @map

// VIC-II sprite registers
@map sprites at $D000 type
  sprite0X: byte,          // $D000 - Sprite 0 X position
  sprite0Y: byte,          // $D001 - Sprite 0 Y position
  sprite1X: byte,          // $D002 - Sprite 1 X position
  sprite1Y: byte,          // $D003 - Sprite 1 Y position
  sprite2X: byte,          // $D004 - Sprite 2 X position
  sprite2Y: byte,          // $D005 - Sprite 2 Y position
  spriteXMSB: byte         // $D010 - Sprite X MSB register
end @map

// Array fields with automatic layout
@map gameRegisters at $C000 type
  lives: byte,             // $C000
  score: word,             // $C001-$C002 (word = 2 bytes)
  powerups: byte[8],       // $C003-$C00A (8 bytes)
  playerName: byte[10]     // $C00B-$C014 (10 bytes)
end @map

// Usage examples
sid.voice1FreqLo = frequency & $FF;              // Set low byte
sid.voice1FreqHi = (frequency >> 8) & $FF;      // Set high byte
sprites.sprite0X = playerX;                      // Position sprite
gameRegisters.lives = 3;                         // Set lives
gameRegisters.powerups[SHIELD_POWERUP] = 1;      // Enable shield
```

### Form 4: Explicit Struct @map Declaration

**Grammar**: `@map identifier at baseAddress layout field : (at address | from start to end) : type [, ...]* end @map`

**Use Case**: Non-sequential hardware registers with manual layout

```js
// VIC-II registers with explicit addresses
@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,           // $D000-$D00F: Sprite positions
  spriteXMSB: at $D010: byte,                   // $D010: Sprite X MSB
  controlRegister1: at $D011: byte,             // $D011: Control register #1
  rasterCounter: at $D012: byte,                // $D012: Raster counter
  lightpenX: at $D013: byte,                    // $D013: Light pen X
  lightpenY: at $D014: byte,                    // $D014: Light pen Y
  spriteEnable: at $D015: byte,                 // $D015: Sprite enable
  controlRegister2: at $D016: byte,             // $D016: Control register #2
  spriteYExpand: at $D017: byte,                // $D017: Sprite Y expand
  memoryPointers: at $D018: byte,               // $D018: Memory pointers
  interruptStatus: at $D019: byte,              // $D019: Interrupt status
  backgroundColor: at $D021: byte,              // $D021: Background color
  borderColor: at $D020: byte,                  // $D020: Border color
  spriteColors: from $D027 to $D02E: byte       // $D027-$D02E: Sprite colors
end @map

// CIA timer registers (non-sequential)
@map cia1 at $DC00 layout
  dataPortA: at $DC00: byte,                    // $DC00: Data port A
  dataPortB: at $DC01: byte,                    // $DC01: Data port B
  dataDirectionA: at $DC02: byte,               // $DC02: Data direction A
  dataDirectionB: at $DC03: byte,               // $DC03: Data direction B
  timerALow: at $DC04: byte,                    // $DC04: Timer A low byte
  timerAHigh: at $DC05: byte,                   // $DC05: Timer A high byte
  timerBLow: at $DC06: byte,                    // $DC06: Timer B low byte
  timerBHigh: at $DC07: byte,                   // $DC07: Timer B high byte
  controlRegisterA: at $DC0E: byte,             // $DC0E: Control register A
  controlRegisterB: at $DC0F: byte              // $DC0F: Control register B
end @map

// Mixed single addresses and ranges
@map customChip at $E000 layout
  status: at $E000: byte,                       // Single register
  commands: from $E001 to $E003: byte,          // Command buffer
  data: at $E010: word,                         // 16-bit data register
  buffer: from $E100 to $E1FF: byte             // 256-byte buffer
end @map

// Usage examples
vic.borderColor = BLUE;                         // Set border color
vic.sprites[0] = playerX;                       // Set sprite position
vic.spriteEnable |= (1 << PLAYER_SPRITE);      // Enable sprite
cia1.timerALow = timer & $FF;                  // Set timer low byte
cia1.timerAHigh = timer >> 8;                  // Set timer high byte
```

## Real-World C64 Hardware Examples

### Complete VIC-II Setup

```js
// VIC-II Video Interface Chip - complete register mapping
@map vic at $D000 layout
  // Sprite positions ($D000-$D00F)
  spritePositions: from $D000 to $D00F: byte,

  // Control registers
  spriteXMSB: at $D010: byte,                   // X coordinate MSB
  controlReg1: at $D011: byte,                  // Screen control #1
  rasterLine: at $D012: byte,                   // Raster counter

  // Light pen
  lightPenX: at $D013: byte,
  lightPenY: at $D014: byte,

  // Sprite control
  spriteEnable: at $D015: byte,                 // Sprite enable register
  controlReg2: at $D016: byte,                  // Screen control #2
  spriteYExpand: at $D017: byte,                // Sprite Y expansion
  memorySetup: at $D018: byte,                  // Memory setup register

  // Interrupts
  interruptStatus: at $D019: byte,              // Interrupt status
  interruptEnable: at $D01A: byte,              // Interrupt enable

  // Colors
  borderColor: at $D020: byte,                  // Border color
  backgroundColor0: at $D021: byte,             // Background color 0
  backgroundColor1: at $D022: byte,             // Background color 1
  backgroundColor2: at $D023: byte,             // Background color 2
  backgroundColor3: at $D024: byte,             // Background color 3

  // Sprite multicolor
  spriteMulticolor0: at $D025: byte,            // Sprite multicolor 0
  spriteMulticolor1: at $D026: byte,            // Sprite multicolor 1

  // Individual sprite colors ($D027-$D02E)
  spriteColors: from $D027 to $D02E: byte
end @map

// Usage in game code
function initializeGraphics(): void
  vic.borderColor = BLACK;
  vic.backgroundColor0 = BLACK;
  vic.spriteEnable = 0;  // Disable all sprites initially
  vic.controlReg1 = $1B; // Standard text mode
  vic.controlReg2 = $C8; // Standard settings
end function
```

### Complete SID Sound Setup

```js
// SID Sound Interface Device - all voices
@map sid at $D400 type
  // Voice 1 ($D400-$D406)
  voice1FreqLo: byte,
  voice1FreqHi: byte,
  voice1PulseWidthLo: byte,
  voice1PulseWidthHi: byte,
  voice1Control: byte,
  voice1AttackDecay: byte,
  voice1SustainRelease: byte,

  // Voice 2 ($D407-$D40D)
  voice2FreqLo: byte,
  voice2FreqHi: byte,
  voice2PulseWidthLo: byte,
  voice2PulseWidthHi: byte,
  voice2Control: byte,
  voice2AttackDecay: byte,
  voice2SustainRelease: byte,

  // Voice 3 ($D40E-$D414)
  voice3FreqLo: byte,
  voice3FreqHi: byte,
  voice3PulseWidthLo: byte,
  voice3PulseWidthHi: byte,
  voice3Control: byte,
  voice3AttackDecay: byte,
  voice3SustainRelease: byte,

  // Global controls ($D415-$D418)
  filterCutoffLo: byte,
  filterCutoffHi: byte,
  filterResonance: byte,
  volumeAndFilter: byte
end @map

// Play a note on voice 1
function playNote(frequency: word): void
  sid.voice1FreqLo = frequency & $FF;
  sid.voice1FreqHi = (frequency >> 8) & $FF;
  sid.voice1Control = $41; // Sawtooth wave, gate on
end function
```

## Declaration Error Recovery

The parser provides excellent error recovery for declarations:

**Common Error Scenarios**:

```js
// Missing type after colon
let x: ;                    // ERROR: Reports "Expected type after colon"

// Missing semicolon
let y: byte = 5            // ERROR: Reports "Expected semicolon"
let z: word                // Next declaration continues

// Invalid storage class combinations
@invalid let x: byte;       // ERROR: Parses as @invalid token + let
@zp @ram let y: byte;      // ERROR: Multiple storage classes

// Invalid @map syntax
@map test;                 // ERROR: Expected identifier after @map
@map x at: byte;           // ERROR: Expected address after 'at'
@map y at $D000;           // ERROR: Expected ':' and type

// Missing end @map
@map sid at $D400 type
  freq: byte
// Missing end @map         // ERROR: Expected 'end @map'
```

## What Declarations CANNOT Be Parsed

**Not Yet Implemented**:

```js
// ❌ Function declarations (handled in final Parser class)
function myFunc(): void     // Not in DeclarationParser layer

// ❌ Type aliases
type MyType = byte | word;  // Parsing planned but not implemented

// ❌ Enum declarations
enum Color {               // Parsing planned but not implemented
  RED, GREEN, BLUE
}

// ❌ Class declarations (not in language spec)
class Player {             // Not supported - Blend65 has no OOP
  health: byte;
}

// ❌ Interface declarations (not in language spec)
interface Drawable {       // Not supported
  draw(): void;
}
```

**Specification Limitations**:

```js
// ❌ Object literals (not in spec)
let config = {             // Not supported
  width: 320,
  height: 200
};

// ❌ Array literals (limited support)
let arr = [1, 2, 3];      // Not supported - use individual assignments

// ❌ Destructuring (not in spec)
let [x, y] = getPosition(); // Not supported

// ❌ Default parameters (functions only)
let x: byte = 5 || 10;     // Not supported - use explicit if/else
```

## Next Steps

This completes Step 4. The declaration parser can handle ALL documented Blend65 variable declarations and @map forms, providing comprehensive C64 hardware access while maintaining type safety and modern language features.

**Ready for**: Step 5 - Statement Parsing Analysis
