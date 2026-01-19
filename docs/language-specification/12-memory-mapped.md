# Memory-Mapped Variables

> **Status**: Lexer-Derived Specification  
> **Last Updated**: January 8, 2026  
> **Related Documents**: [Variables](10-variables.md), [6502 Features](13-6502-features.md), [Type System](05-type-system.md)

## Overview

Memory-mapped variables (`@map`) provide **direct access to hardware registers** at fixed memory addresses without runtime overhead. This is a critical feature for 6502 development, enabling type-safe access to VIC-II, SID, CIA, and other hardware registers.

## Concept

Traditional 6502 programming uses `PEEK` and `POKE` for hardware register access:

```basic
POKE 53280, 5     REM Set border color
X = PEEK(53280)   REM Read border color
```

Blend65's `@map` feature provides a **zero-overhead, type-safe alternative**:

```js
@map vicBorderColor at $D020: byte;
vicBorderColor = 5;       // Compiles to: STA $D020
let x = vicBorderColor;   // Compiles to: LDA $D020
```

## Four Declaration Forms

Blend65 provides four forms of memory-mapped declarations to handle different hardware layout patterns:

1. **Simple** - Single register at fixed address
2. **Range** - Contiguous array of registers
3. **Sequential Struct** - Auto-laid-out fields (packed, no gaps)
4. **Explicit Struct** - Manually specified field addresses (allows gaps)

---

## Form 1: Simple Memory-Mapped Variable

Maps a single variable to a specific memory address.

### Syntax

```ebnf
simple_map_decl = "@map" , identifier , "at" , address , ":" , type_name , ";" ;
```

### Examples

```js
// VIC-II border color register
@map vicBorderColor at $D020: byte;

// VIC-II background color register
@map vicBackgroundColor at $D021: byte;

// IRQ vector (word = 2 bytes at $FFFE-$FFFF)
@map irqVector at $FFFE: word;

// SID volume register
@map soundVolume at $D418: byte;
```

### Usage

```js
// Write to hardware register
vicBorderColor = 0;           // Set border to black

// Read from hardware register
let currentColor = vicBorderColor;

// Compound assignment
vicBorderColor += 1;          // Cycle through colors
```

### Generated Assembly

```asm
; vicBorderColor = 0
LDA #$00
STA $D020         ; Direct write to register
```

---

## Form 2: Range Memory-Mapped Array

Maps a contiguous memory range to an array-like accessor.

### Syntax

```ebnf
range_map_decl = "@map" , identifier , "from" , address , "to" , address , ":" , type_name , ";" ;
```

### Examples

```js
// VIC-II sprite position registers ($D000-$D02E = 47 bytes)
@map spriteRegisters from $D000 to $D02E: byte;

// Color RAM (1000 bytes)
@map colorRAM from $D800 to $DBE7: byte;

// Screen memory (1000 bytes)
@map screenRAM from $0400 to $07E7: byte;

// SID chip registers
@map sidRegisters from $D400 to $D41C: byte;
```

### Usage

```js
// Constant index (address computed at compile time)
spriteRegisters[0] = 100;     // Sprite 0 X position ($D000)
spriteRegisters[1] = 50;      // Sprite 0 Y position ($D001)
spriteRegisters[2] = 200;     // Sprite 1 X position ($D002)

// Dynamic index (uses indexed addressing mode)
for i = 0 to 39
  colorRAM[i] = 14;           // Light blue
next i

// Read access
let sprite0X = spriteRegisters[0];
```

### Generated Assembly

```asm
; spriteRegisters[0] = 100 (constant index)
LDA #$64
STA $D000         ; Compile-time address: $D000 + 0

; colorRAM[i] = 14 (dynamic index)
LDX ZP_I          ; Index in X register
LDA #$0E
STA $D800,X       ; Indexed addressing: $D800 + X
```

---

## Form 3: Sequential Struct Memory Mapping

Maps fields sequentially from a base address, like a C struct. Fields are automatically laid out with no gaps.

### Syntax

```ebnf
sequential_struct_map_decl = "@map" , identifier , "at" , address , "type"
                           , { NEWLINE }
                           , field_list
                           , "end" , "@map" ;

field_list = field_decl , { [ "," ] , { NEWLINE } , field_decl } ;
field_decl = identifier , ":" , type_expr ;
type_expr  = type_name | type_name , "[" , integer , "]" ;
```

### Example

```js
// SID voice 1 registers (tightly packed)
@map sidVoice1 at $D400 type
  frequencyLo: byte,      // $D400 (computed)
  frequencyHi: byte,      // $D401 (computed)
  pulseLo: byte,          // $D402 (computed)
  pulseHi: byte,          // $D403 (computed)
  waveform: byte,         // $D404 (computed)
  attackDecay: byte,      // $D405 (computed)
  sustainRelease: byte    // $D406 (computed)
end @map
```

### Usage

```js
// Set frequency to 440 Hz (triangle wave)
sidVoice1.frequencyLo = 0x5C;
sidVoice1.frequencyHi = 0x11;

// Triangle wave + gate on
sidVoice1.waveform = 0x11;

// Full ADSR envelope
sidVoice1.attackDecay = 0x00;
sidVoice1.sustainRelease = 0xF0;
```

### Generated Assembly

```asm
; sidVoice1.waveform = 0x11
LDA #$11
STA $D404         ; Address computed: $D400 + 4 bytes
```

**Note:** Compiler automatically computes each field's address based on sequential layout and field sizes.

---

## Form 4: Explicit Struct Memory Mapping

Maps fields with explicitly specified addresses. Allows gaps and non-sequential layouts.

### Syntax

```ebnf
explicit_struct_map_decl = "@map" , identifier , "at" , address , "layout"
                         , { NEWLINE }
                         , explicit_field_list
                         , "end" , "@map" ;

explicit_field_list = explicit_field , { [ "," ] , { NEWLINE } , explicit_field } ;
explicit_field = identifier , ":" , field_address_spec , ":" , type_name ;

field_address_spec = "at" , address                      (* single address *)
                   | "from" , address , "to" , address ; (* range *)
```

### Example

```js
// VIC-II registers (many gaps and reserved registers)
@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  control1: at $D011: byte,
  raster: at $D012: byte,
  spriteEnable: at $D015: byte,
  control2: at $D016: byte,
  interruptStatus: at $D019: byte,
  interruptEnable: at $D01A: byte,
  borderColor: at $D020: byte,
  backgroundColor0: at $D021: byte,
  backgroundColor1: at $D022: byte,
  backgroundColor2: at $D023: byte,
  backgroundColor3: at $D024: byte,
  spriteColors: from $D027 to $D02E: byte
end @map
```

### Usage

```js
// Set border and background
vic.borderColor = 0;              // Black border
vic.backgroundColor0 = 6;         // Blue background

// Enable sprites 0-2
vic.spriteEnable = 0b00000111;    // Bits 0, 1, 2 = sprites 0, 1, 2

// Set sprite positions
vic.sprites[0] = 100;             // Sprite 0 X position
vic.sprites[1] = 50;              // Sprite 0 Y position

// Raster interrupt setup
vic.raster = 250;                 // Trigger at raster line 250
vic.interruptEnable = 0x01;       // Enable raster interrupt
```

### Generated Assembly

```asm
; vic.borderColor = 0
LDA #$00
STA $D020         ; Explicitly specified field address

; vic.sprites[0] = 100
LDA #$64
STA $D000         ; Field range base + index 0
```

**Note:** Explicit layout allows documenting hardware with gaps (e.g., skipping $D013-$D014, $D01B-$D01F, etc.)

---

## Complete Grammar

```ebnf
(* @map declarations - module scope only *)
map_declaration = simple_map_decl 
                | range_map_decl 
                | sequential_struct_map_decl 
                | explicit_struct_map_decl ;

(* 1. Simple: single address mapping *)
simple_map_decl = "@map" , identifier , "at" , address , ":" , type_name , ";" ;

(* 2. Range: contiguous memory array *)
range_map_decl = "@map" , identifier , "from" , address , "to" , address , ":" , type_name , ";" ;

(* 3. Sequential struct: fields auto-laid-out sequentially *)
sequential_struct_map_decl = "@map" , identifier , "at" , address , "type"
                           , { NEWLINE }
                           , field_list
                           , "end" , "@map" ;

field_list = field_decl , { [ "," ] , { NEWLINE } , field_decl } ;
field_decl = identifier , ":" , type_expr ;

(* 4. Explicit struct: fields with explicit addresses *)
explicit_struct_map_decl = "@map" , identifier , "at" , address , "layout"
                         , { NEWLINE }
                         , explicit_field_list
                         , "end" , "@map" ;

explicit_field_list = explicit_field , { [ "," ] , { NEWLINE } , explicit_field } ;
explicit_field = identifier , ":" , field_address_spec , ":" , type_name ;

field_address_spec = "at" , address                      (* single address *)
                   | "from" , address , "to" , address ; (* range *)

(* Common definitions *)
type_expr  = type_name | type_name , "[" , integer , "]" ;
type_name  = "byte" | "word" ;
address    = hex_literal | decimal_literal ;
```

---

## Scope Rules

**`@map` declarations are module-scope only.**

```js
// ✅ ALLOWED: Module scope
module Hardware.VIC

@map vicBorderColor at $D020: byte;

@map vic at $D000 type
  borderColor: byte
end @map

function main(): void
  vic.borderColor = 5;    // USE the mapped memory
end function

// ❌ FORBIDDEN: Inside function
function foo(): void
  @map illegal at $D020: byte;    // Compile error!
end function
```

**Error:**
```
Memory-mapped declarations (@map) must be at module scope.
Cannot declare @map inside functions.
```

**Rationale:**
- Hardware registers have global scope (not local to functions)
- Prevents shadowing and scope confusion
- Simpler symbol table implementation
- Clearer semantic intent

---

## Semicolon Rules

Following Blend65's semicolon rules:

| Form | Syntax | Semicolon Required? |
|------|--------|-------------------|
| Simple | `@map x at $D020: byte` | **YES** (single-line) |
| Range | `@map x from $D000 to $D02E: byte` | **YES** (single-line) |
| Sequential struct | `@map x at $D type ... end @map` | **NO** (block construct) |
| Explicit struct | `@map x at $D layout ... end @map` | **NO** (block construct) |

**Examples:**

```js
// Simple and range require semicolons
@map borderColor at $D020: byte;
@map sprites from $D000 to $D02E: byte;

// Struct forms are self-terminating (no semicolon)
@map vic at $D000 type
  field: byte
end @map

@map vic at $D000 layout
  field: at $D020: byte
end @map
```

---

## Use Cases

### Individual Hardware Registers

```js
@map vicBorderColor at $D020: byte;
@map vicBackgroundColor at $D021: byte;
@map sidVolume at $D418: byte;
@map cia1DataPortA at $DC00: byte;
```

### Sprite Positions (Contiguous)

```js
@map spritePositions from $D000 to $D00F: byte;

// Set sprite 0 position
spritePositions[0] = 100;  // X position
spritePositions[1] = 50;   // Y position
```

### Screen and Color Memory

```js
@map screenRAM from $0400 to $07E7: byte;
@map colorRAM from $D800 to $DBE7: byte;

// Clear screen
for i = 0 to 999
  screenRAM[i] = 32;   // Space character
  colorRAM[i] = 14;    // Light blue
next i
```

### Complete VIC-II Mapping

```js
@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  control1: at $D011: byte,
  raster: at $D012: byte,
  spriteEnable: at $D015: byte,
  interruptStatus: at $D019: byte,
  interruptEnable: at $D01A: byte,
  borderColor: at $D020: byte,
  backgroundColor: at $D021: byte
end @map

// Usage: Clean, type-safe hardware access
vic.borderColor = 0;
vic.spriteEnable = 0xFF;  // Enable all 8 sprites
let currentRaster = vic.raster;
```

---

## Type Safety and Validation

**Compile-time checks:**
- Address overlap detection
- Field existence validation  
- Array bounds checking (constant indices)
- Type compatibility verification

**Examples:**

```js
// ❌ Error: Overlapping memory ranges
@map region1 from $D000 to $D0FF: byte;
@map region2 from $D080 to $D100: byte;  // Overlaps with region1!

// ❌ Error: Invalid field access
@map vic at $D000 layout
  borderColor: at $D020: byte
end @map

vic.invalidField = 5;  // Error: Field 'invalidField' does not exist

// ❌ Error: Type mismatch
@map byteReg at $D020: byte;
let x: word = byteReg;  // Warning: Assigning byte to word
```

---

## Code Generation

Memory-mapped variables compile to **direct memory access** with zero runtime overhead:

**Source:**

```js
@map vic at $D000 layout
  borderColor: at $D020: byte,
  sprites: from $D000 to $D00F: byte
end @map

vic.borderColor = 0;
vic.sprites[0] = 100;
let x = vic.sprites[i];
```

**Generated Assembly:**

```asm
; vic.borderColor = 0
LDA #$00
STA $D020         ; Direct absolute addressing

; vic.sprites[0] = 100
LDA #$64
STA $D000         ; Constant index: compile-time address

; let x = vic.sprites[i]
LDX ZP_I          ; Load index into X
LDA $D000,X       ; Indexed addressing mode
STA ZP_X
```

**No peek/poke function calls!** Direct hardware access at assembly level.

---

## Best Practices

### Choose the Right Form

**Use Simple** when mapping individual registers:

```js
@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;
```

**Use Range** for contiguous register blocks:

```js
@map colorRAM from $D800 to $DBE7: byte;
```

**Use Sequential Struct** for tightly-packed hardware (no gaps):

```js
@map sidVoice1 at $D400 type
  frequencyLo: byte,
  frequencyHi: byte,
  pulseLo: byte,
  pulseHi: byte
end @map
```

**Use Explicit Struct** for sparse hardware with gaps:

```js
@map vic at $D000 layout
  raster: at $D012: byte,
  borderColor: at $D020: byte  // Gap from $D013-$D01F
end @map
```

### Naming Conventions

```js
// ✅ GOOD: Descriptive names
@map vicBorderColor at $D020: byte;
@map sidVoice1Frequency at $D400: word;

// ❌ AVOID: Cryptic abbreviations
@map vbc at $D020: byte;
@map s1f at $D400: word;
```

### Documentation

```js
// Document register purpose and bit meanings
@map vic at $D000 layout
  // Bits: 7=RST8, 6=ECM, 5=BMM, 4=DEN, 3=RSEL, 2-0=YSCROLL
  control1: at $D011: byte,
  
  // Current raster line (read) or target line (write)
  raster: at $D012: byte,
  
  // Bits 7-0: sprites 7-0 enable
  spriteEnable: at $D015: byte
end @map
```

---

## Comparison with Other Languages

**C (volatile pointers):**

```c
#define VIC_BORDER (*((volatile uint8_t*)0xD020))
VIC_BORDER = 5;
```

**Rust (unsafe):**

```rust
unsafe {
    let ptr = 0xD020 as *mut u8;
    *ptr = 5;
}
```

**Blend65:**

```js
@map vicBorderColor at $D020: byte;
vicBorderColor = 5;
```

**Blend65 advantages:**
- More elegant and readable
- Type-safe without `unsafe` blocks
- Integrated with language type system
- Zero overhead (same generated code)

---

## Complete Example

```js
module C64.Hardware

// Individual registers
@map vicBorderColor at $D020: byte;
@map vicBackgroundColor at $D021: byte;

// Range mapping for color memory
@map colorRAM from $D800 to $DBE7: byte;

// Sequential struct for SID voice
@map sidVoice1 at $D400 type
  frequencyLo: byte,
  frequencyHi: byte,
  pulseLo: byte,
  pulseHi: byte,
  waveform: byte,
  attackDecay: byte,
  sustainRelease: byte
end @map

// Explicit struct for VIC-II (with gaps)
@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  control1: at $D011: byte,
  raster: at $D012: byte,
  spriteEnable: at $D015: byte,
  borderColor: at $D020: byte,
  backgroundColor0: at $D021: byte
end @map

export function initGraphics(): void
  // Use simple mappings
  vicBorderColor = 0;
  vicBackgroundColor = 0;
  
  // Use struct mapping
  vic.spriteEnable = 0xFF;
  
  // Use range mapping
  for i = 0 to 999
    colorRAM[i] = 14;
  next i
  
  // Use sequential struct
  sidVoice1.waveform = 0x11;
end function
```

---

## Implementation Notes

Memory-mapped declarations are parsed and validated in:
- `packages/compiler/src/parser/` - Parser implementation
- `packages/compiler/src/lexer/` - Lexer tokenization
- `packages/compiler/src/__tests__/lexer/map-declarations.test.ts` - Test suite

See [Variables](10-variables.md) for storage classes and [6502 Features](13-6502-features.md) for hardware-specific guidelines.
