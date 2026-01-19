# Bit Manipulation Operators - Research Document

**Feature**: Bit Manipulation Operators  
**Priority**: ⭐⭐⭐⭐⭐ Critical (Priority 1)  
**Status**: Research Complete  
**Date**: January 8, 2026

---

## Executive Summary

Bit Manipulation Operators is listed as a **Priority 1 Critical Feature** for Blend65. Research shows that Blend65 **already has basic bitwise operators** (`&`, `|`, `^`, `~`, `<<`, `>>`), but lacks **advanced bit manipulation operations** commonly needed for C64/6502 hardware programming.

**Key Finding**: Most advanced bit operations can be implemented as **library functions**, with optional compiler optimizations later. Only specialized syntax features require language-level changes.

---

## Current State: What's Already Implemented

Blend65 currently supports these bitwise operators (per `docs/language-specification/06-expressions-statements.md`):

### Basic Bitwise Operators ✅

| Operator | Description | Example |
|----------|-------------|---------|
| `&` | Bitwise AND | `value & 0b11110000` |
| `\|` | Bitwise OR | `flags \| 0b00000001` |
| `^` | Bitwise XOR | `state ^ 0b00000100` |
| `~` | Bitwise NOT | `~mask` |
| `<<` | Left shift | `value << 1` |
| `>>` | Right shift | `value >> 1` |

### Compound Assignment Operators ✅

| Operator | Equivalent |
|----------|------------|
| `&=` | `a = a & b` |
| `\|=` | `a = a \| b` |
| `^=` | `a = a ^ b` |
| `<<=` | `a = a << b` |
| `>>=` | `a = a >> b` |

**Example:**
```js
let masked = value & 0b11110000;
let combined = flags | 0b00000001;
let toggled = state ^ 0b00000100;
let inverted = ~mask;
let shifted = value << 1;
```

---

## What's Missing: Advanced Bit Operations

The feature request states: **"Bit test/set/clear, bitfields for hardware"**

### 1. Individual Bit Test/Set/Clear Operations

Common in C64/6502 programming for hardware register manipulation:

```js
// Current approach (verbose):
if (vic.spriteEnable & 0b00001000) != 0 then  // Test bit 3
vic.spriteEnable = vic.spriteEnable | 0b00100000;  // Set bit 5
vic.spriteEnable = vic.spriteEnable & 0b11111011;  // Clear bit 2
vic.spriteEnable = vic.spriteEnable ^ 0b10000000;  // Toggle bit 7

// Desired approach (function-based):
if testBit(vic.spriteEnable, 3) then
vic.spriteEnable = setBit(vic.spriteEnable, 5);
vic.spriteEnable = clearBit(vic.spriteEnable, 2);
vic.spriteEnable = toggleBit(vic.spriteEnable, 7);
```

### 2. Bitfield Access

Extract and manipulate bit ranges within bytes/words:

```js
// Current approach:
let color: byte = 0x5C;
let highNibble = (color >> 4) & 0x0F;
let lowNibble = color & 0x0F;

// Desired approach:
let highNibble = highNibble(color);
let lowNibble = lowNibble(color);
// Or: let highNibble = extractBits(color, 4, 7);
```

### 3. Bit Rotation

Useful for graphics and encryption:

```js
// Desired:
value = rotateLeft(value, 2);   // Rotate left 2 bits
value = rotateRight(value, 1);  // Rotate right 1 bit
```

### 4. Bit Counting

Count set bits, find first set bit, etc.:

```js
// Desired:
let count = countBits(value);     // Count number of 1s
let pos = findFirstBit(value);    // Position of first 1
let pos = findLastBit(value);     // Position of last 1
```

---

## Why This Is Critical for C64/6502 Development

### 1. Hardware Register Manipulation

C64 hardware registers are **bit-packed** with multiple flags:

```js
// VIC-II Sprite Enable Register ($D015)
// Bit 0: Sprite 0 enabled
// Bit 1: Sprite 1 enabled
// ...
// Bit 7: Sprite 7 enabled

@map spriteEnable at $D015: byte;

// Need to manipulate individual bits frequently:
spriteEnable = setBit(spriteEnable, 3);  // Enable sprite 3
spriteEnable = clearBit(spriteEnable, 5);  // Disable sprite 5
```

### 2. Memory Efficiency

6502 systems have very limited RAM (64KB on C64). Bitfields pack multiple values:

```js
// Pack 8 boolean flags into 1 byte
let gameFlags: byte = 0;
// Bit 0: Player alive
// Bit 1: Game paused
// Bit 2: Music enabled
// Bit 3: Sound enabled
// ...

if testBit(gameFlags, 0) then  // Player alive?
```

### 3. Graphics Operations

Common in sprite manipulation and pixel operations:

```js
// Sprite collision detection (hardware register $D01E)
@map spriteCollision at $D01E: byte;

// Check if sprite 2 collided with anything
if testBit(spriteCollision, 2) then
  handleCollision(2);
end if
```

### 4. Performance

The 6502 has specific instructions for bit operations:
- `BIT` - Test bits
- `ROL` - Rotate left
- `ROR` - Rotate right
- `ASL` - Arithmetic shift left
- `LSR` - Logical shift right

High-level bit operators should compile to these efficient instructions.

---

## Library vs Language Features

### ✅ Library Functions (Recommended - Phase 1)

These can be implemented as **regular functions** using existing bitwise operators:

#### Basic Bit Operations

```js
// Module: system.bits

/**
 * Test if a bit is set
 * @param value - The byte or word to test
 * @param bit - Bit position (0-7 for byte, 0-15 for word)
 * @return true if bit is set, false otherwise
 */
export function testBit(value: byte, bit: byte): boolean
  return (value & (1 << bit)) != 0;
end function

/**
 * Set a bit to 1
 * @param value - The byte or word to modify
 * @param bit - Bit position to set
 * @return Modified value with bit set
 */
export function setBit(value: byte, bit: byte): byte
  return value | (1 << bit);
end function

/**
 * Clear a bit to 0
 * @param value - The byte or word to modify
 * @param bit - Bit position to clear
 * @return Modified value with bit cleared
 */
export function clearBit(value: byte, bit: byte): byte
  return value & ~(1 << bit);
end function

/**
 * Toggle a bit (flip 0->1 or 1->0)
 * @param value - The byte or word to modify
 * @param bit - Bit position to toggle
 * @return Modified value with bit toggled
 */
export function toggleBit(value: byte, bit: byte): byte
  return value ^ (1 << bit);
end function
```

#### Bitfield Extraction

```js
/**
 * Extract a bit range
 * @param value - Source value
 * @param startBit - First bit (inclusive)
 * @param endBit - Last bit (inclusive)
 * @return Extracted bits shifted to bit 0
 */
export function extractBits(value: byte, startBit: byte, endBit: byte): byte
  let mask: byte = ((1 << (endBit - startBit + 1)) - 1);
  return (value >> startBit) & mask;
end function

/**
 * Get high nibble (bits 4-7)
 */
export function highNibble(value: byte): byte
  return (value >> 4) & 0x0F;
end function

/**
 * Get low nibble (bits 0-3)
 */
export function lowNibble(value: byte): byte
  return value & 0x0F;
end function

/**
 * Pack two nibbles into a byte
 */
export function packNibbles(high: byte, low: byte): byte
  return ((high & 0x0F) << 4) | (low & 0x0F);
end function
```

#### Bit Rotation

```js
/**
 * Rotate bits left
 * @param value - Value to rotate
 * @param amount - Number of positions to rotate
 */
export function rotateLeft(value: byte, amount: byte): byte
  amount = amount & 7;  // Modulo 8
  return (value << amount) | (value >> (8 - amount));
end function

/**
 * Rotate bits right
 */
export function rotateRight(value: byte, amount: byte): byte
  amount = amount & 7;  // Modulo 8
  return (value >> amount) | (value << (8 - amount));
end function
```

#### Bit Counting

```js
/**
 * Count the number of set bits (population count)
 */
export function countBits(value: byte): byte
  let count: byte = 0;
  for i = 0 to 7
    if (value & (1 << i)) != 0 then
      count += 1;
    end if
  next i
  return count;
end function

/**
 * Find first set bit (0-7), returns 255 if none set
 */
export function findFirstBit(value: byte): byte
  for i = 0 to 7
    if (value & (1 << i)) != 0 then
      return i;
    end if
  next i
  return 255;  // No bit set
end function

/**
 * Find last set bit (7-0), returns 255 if none set
 */
export function findLastBit(value: byte): byte
  for i = 7 to 0
    if (value & (1 << i)) != 0 then
      return i;
    end if
  next i
  return 255;  // No bit set
end function
```

#### Word (16-bit) Versions

```js
// Overloaded versions for word type
export function testBit(value: word, bit: byte): boolean
  return (value & (1 << bit)) != 0;
end function

export function setBit(value: word, bit: byte): word
  return value | (1 << bit);
end function

export function clearBit(value: word, bit: byte): word
  return value & ~(1 << bit);
end function

export function toggleBit(value: word, bit: byte): word
  return value ^ (1 << bit);
end function
```

### 🔧 Language Features (Optional - Phase 2+)

These require compiler/parser changes:

#### 1. Compiler Intrinsics (Phase 2 - Performance Optimization)

Mark library functions as `@intrinsic` so compiler can:
- Inline them (no function call overhead)
- Constant-fold when bit index is known at compile time
- Generate optimal 6502 code

```js
// In standard library:
@intrinsic
export function setBit(value: byte, bit: byte): byte
  return value | (1 << bit);
end function
```

**Example code generation:**
```js
// Source:
spriteEnable = setBit(spriteEnable, 3);

// With @intrinsic optimization:
LDA $D015      ; Load spriteEnable
ORA #%00001000 ; Set bit 3 (mask computed at compile time)
STA $D015      ; Store back

// Without @intrinsic (function call overhead):
LDA $D015
PHA           ; Push value
LDA #3
PHA           ; Push bit number
JSR _setBit   ; Call function
PLA           ; Get result
STA $D015     ; Much slower!
```

#### 2. Named Bitfields in @map (Phase 3 - Advanced Syntax)

Extend `@map` to support bit-level fields:

```js
@map vic at $D000 layout
  spriteEnable: at $D015: byte layout
    sprite0: bit 0,
    sprite1: bit 1,
    sprite2: bit 2,
    sprite3: bit 3,
    sprite4: bit 4,
    sprite5: bit 5,
    sprite6: bit 6,
    sprite7: bit 7
  end layout,
  
  spriteXMSB: at $D010: byte layout
    sprite0X: bit 0,
    sprite1X: bit 1,
    // ...
  end layout
end @map

// Usage:
if vic.spriteEnable.sprite2 then  // Test bit
vic.spriteEnable.sprite3 = true;  // Set bit
vic.spriteEnable.sprite5 = false; // Clear bit
```

**Why it needs compiler support:**
- Extended `@map` grammar to support bit fields
- New AST nodes for bit-level fields
- Type checking (bit fields are boolean)
- Generate efficient bit test/set/clear code

---

## Usage Examples

### Example 1: Sprite Management

```js
import { setBit, clearBit, testBit } from "system.bits"

@map spriteEnable at $D015: byte;

function enableSprite(num: byte): void
  spriteEnable = setBit(spriteEnable, num);
end function

function disableSprite(num: byte): void
  spriteEnable = clearBit(spriteEnable, num);
end function

function isSpriteEnabled(num: byte): boolean
  return testBit(spriteEnable, num);
end function
```

### Example 2: Game State Flags

```js
import { setBit, clearBit, testBit } from "system.bits"

// Pack multiple flags into one byte
@zp let gameFlags: byte = 0;

const FLAG_PLAYER_ALIVE: byte = 0;
const FLAG_PAUSED: byte = 1;
const FLAG_MUSIC_ON: byte = 2;
const FLAG_SOUND_ON: byte = 3;
const FLAG_DEBUG_MODE: byte = 4;

function setPlayerAlive(alive: boolean): void
  if alive then
    gameFlags = setBit(gameFlags, FLAG_PLAYER_ALIVE);
  else
    gameFlags = clearBit(gameFlags, FLAG_PLAYER_ALIVE);
  end if
end function

function isPlayerAlive(): boolean
  return testBit(gameFlags, FLAG_PLAYER_ALIVE);
end function

function togglePause(): void
  gameFlags = toggleBit(gameFlags, FLAG_PAUSED);
end function
```

### Example 3: Color Manipulation

```js
import { highNibble, lowNibble, packNibbles } from "system.bits"

// C64 color RAM: high nibble unused, low nibble is color
let colorByte: byte = 0x0C;  // Color 12 (medium gray)

// Extract color
let color = lowNibble(colorByte);

// Set new color
colorByte = packNibbles(0, 5);  // Color 5 (green)
```

### Example 4: Hardware Register Testing

```js
import { testBit, countBits } from "system.bits"

@map spriteCollision at $D01E: byte;

function checkCollisions(): void
  // Check each sprite for collisions
  for i = 0 to 7
    if testBit(spriteCollision, i) then
      handleSpriteCollision(i);
    end if
  next i
  
  // Count total collisions
  let numCollisions = countBits(spriteCollision);
  if numCollisions > 3 then
    triggerMultiCollisionEffect();
  end if
end function
```

### Example 5: Bit Rotation for Graphics

```js
import { rotateLeft, rotateRight } from "system.bits"

// Rotate sprite pattern for animation
function rotateSpriteLine(pattern: byte, direction: byte): byte
  if direction == 0 then
    return rotateLeft(pattern, 1);
  else
    return rotateRight(pattern, 1);
  end if
end function
```

---

## Implementation Roadmap

### Phase 1: Standard Library (Immediate)

**Deliverable**: `system.bits` module with all bit manipulation functions

**Tasks**:
1. Create `packages/compiler/src/stdlib/system.bits.b65` (or equivalent)
2. Implement all functions:
   - `testBit`, `setBit`, `clearBit`, `toggleBit`
   - `highNibble`, `lowNibble`, `packNibbles`, `extractBits`
   - `rotateLeft`, `rotateRight`
   - `countBits`, `findFirstBit`, `findLastBit`
3. Provide both `byte` and `word` versions
4. Write comprehensive tests
5. Document with JSDoc comments and examples

**Benefits**:
- Available immediately with zero compiler changes
- Works with existing language features
- Provides immediate value to developers

**Estimated Effort**: 1-2 days

### Phase 2: Compiler Intrinsics (Performance - Future)

**Deliverable**: `@intrinsic` attribute support for inline optimization

**Tasks**:
1. Add `@intrinsic` keyword to lexer
2. Parser support for `@intrinsic` function attribute
3. Code generator recognizes intrinsic functions
4. Inline intrinsic functions instead of generating calls
5. Constant folding for known bit indices
6. Mark hot-path bit functions as intrinsic

**Benefits**:
- Library functions become zero-cost abstractions
- Significant performance improvement
- No syntax changes required

**Estimated Effort**: 1-2 weeks

### Phase 3: Named Bitfields (Advanced - Future)

**Deliverable**: Bit-level fields in `@map` declarations

**Tasks**:
1. Extend `@map` grammar to support `bit N` field declarations
2. Parser support for bitfield syntax
3. New AST nodes for bit-level fields
4. Type system: bit fields are boolean type
5. Code generation for bit field access
6. Validation (bit ranges, conflicts, etc.)

**Benefits**:
- Most readable and self-documenting
- Type-safe bit access
- Perfect for hardware registers

**Estimated Effort**: 2-4 weeks

---

## Comparison with Other Systems

### C Language
```c
// C provides basic operators
value & 0x0F
value | 0x80

// Programmers use macros:
#define SET_BIT(reg, bit) ((reg) |= (1 << (bit)))
#define CLEAR_BIT(reg, bit) ((reg) &= ~(1 << (bit)))
#define TEST_BIT(reg, bit) ((reg) & (1 << (bit)))
```

### Rust
```rust
// Rust has powerful bit manipulation:
value.set_bit(3, true);
value.get_bit(5);
value.count_ones();
value.rotate_left(2);
```

### Kick Assembler (6502)
```asm
// Direct 6502 assembly
LDA value
ORA #%00001000    // Set bit 3
STA value
```

---

## Performance Considerations

### Library Functions (Phase 1)

**Function call overhead**:
```asm
; setBit(value, 3) generates:
JSR _setBit    ; ~6 cycles overhead
RTS            ; ~6 cycles
; Total: ~20-30 cycles
```

**Impact**: Acceptable for most code. Only critical in tight loops.

### With Intrinsics (Phase 2)

**Inlined code**:
```asm
; setBit(value, 3) with @intrinsic:
LDA value      ; 3 cycles
ORA #$08       ; 2 cycles (mask computed at compile time)
STA value      ; 3 cycles
; Total: ~8 cycles
```

**Impact**: 2-3x faster for hot code paths.

---

## Testing Strategy

### Unit Tests

```js
import { testBit, setBit, clearBit, toggleBit } from "system.bits"

// Test setBit
let value: byte = 0;
value = setBit(value, 3);
assert(value == 0b00001000);

// Test clearBit
value = 0xFF;
value = clearBit(value, 5);
assert(value == 0b11011111);

// Test testBit
value = 0b10101010;
assert(testBit(value, 1) == true);
assert(testBit(value, 0) == false);

// Test toggleBit
value = 0b00001000;
value = toggleBit(value, 3);
assert(value == 0);
```

### Hardware Register Tests

```js
// Test with actual hardware registers
@map testReg at $D020: byte;

testReg = 0;
testReg = setBit(testReg, 2);
assert(testReg == 4);
```

### Edge Cases

```js
// Test boundary conditions
assert(setBit(0xFF, 7) == 0xFF);  // Already set
assert(clearBit(0x00, 3) == 0x00);  // Already clear
assert(testBit(0x80, 7) == true);  // High bit
assert(testBit(0x01, 0) == true);  // Low bit
```

---

## Documentation Requirements

### API Documentation

Each function must have:
- Purpose description
- Parameter descriptions
- Return value description
- Usage examples
- Performance notes

### User Guide

Create guide sections:
1. Introduction to bit manipulation
2. Common patterns (flags, hardware registers)
3. Performance considerations
4. Real-world examples

### Code Examples

Provide complete examples:
- Sprite management
- Game state flags
- Hardware register manipulation
- Graphics operations

---

## Recommendations

### Immediate Action (Phase 1)

1. **Implement `system.bits` library module**
   - All bit manipulation functions
   - Both `byte` and `word` versions
   - Comprehensive documentation

2. **Create usage examples**
   - Real C64 hardware scenarios
   - Common patterns
   - Best practices

3. **Write tests**
   - Unit tests for all functions
   - Edge case testing
   - Hardware register tests

### Future Enhancements (Phase 2+)

4. **Profile real-world usage**
   - Identify hot code paths
   - Measure performance impact

5. **Consider `@intrinsic` support**
   - Only if profiling shows significant overhead
   - Focus on hot-path functions

6. **Evaluate named bitfields**
   - Based on developer feedback
   - Complexity vs readability trade-off

---

## Conclusion

Bit Manipulation Operators are essential for C64/6502 development. The good news is that **most functionality can be provided through library functions** using Blend65's existing bitwise operators.

**Key Decisions**:
- ✅ **Start with library** - Provides immediate value with zero compiler changes
- ⚠️ **Add intrinsics later** - Only if performance profiling justifies the effort
- 🔮 **Consider syntax features** - Based on real-world usage and feedback

**Next Steps**:
1. Implement `system.bits` standard library module
2. Document extensively with real examples
3. Use in actual C64 projects to validate design
4. Gather feedback and iterate

This approach provides immediate functionality while keeping the door open for future optimizations.

---

**Document Status**: Research Complete  
**Last Updated**: January 8, 2026  
**Next Action**: Implement `system.bits` library module
