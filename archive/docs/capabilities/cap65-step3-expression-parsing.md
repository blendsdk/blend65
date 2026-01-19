# Step 3: Expression Parsing Analysis

**Status**: In Progress
**Part of**: cap65 Comprehensive Analysis
**Date**: December 1, 2026

## What This Step Covers

Focus ONLY on expression parsing capabilities - what expressions can be parsed and how the Pratt parser algorithm works.

## Pratt Parser Implementation

The Blend65 compiler uses a **complete Pratt parser** (precedence climbing) for expression parsing, which automatically handles:

- **13 precedence levels** from assignment (lowest) to postfix (highest)
- **Right and left associativity** correctly
- **Operator precedence** without manual precedence tables
- **Error recovery** that never crashes

### Precedence Ladder (Lowest → Highest)

```js
1.  Assignment      = += -= *= /= %= &= |= ^= <<= >>=  (right-associative)
2.  Logical OR      ||                                 (left-associative)
3.  Logical AND     &&                                 (left-associative)
4.  Bitwise OR      |                                  (left-associative)
5.  Bitwise XOR     ^                                  (left-associative)
6.  Bitwise AND     &                                  (left-associative)
7.  Equality        == !=                              (left-associative)
8.  Relational      < <= > >=                          (left-associative)
9.  Shift           << >>                              (left-associative)
10. Additive        + -                                (left-associative)
11. Multiplicative  * / %                              (left-associative)
12. Unary           ! ~ + - @                          (right-associative)
13. Postfix         () [] .                            (left-associative)
```

## Expression Types Supported

### 1. Literal Expressions

**Number Literals (All Formats)**:

```js
// Decimal numbers
42; // Small integers
255; // Byte range
65535; // Word range
0; // Zero

// Hexadecimal with $ prefix (C64 style)
$00; // Zero in hex
$FF; // 255 in hex
$D000; // 53248 in hex (VIC-II base)
$FFFE; // 65534 in hex (IRQ vector)

// Hexadecimal with 0x prefix (standard)
0x00; // Zero
0xff; // 255
0xd000; // VIC-II base
0xd400; // SID base

// Binary with 0b prefix
0b0; // Zero in binary
0b1; // One in binary
0b1111; // 15 in binary
0b11111111; // 255 in binary (full byte)
```

**String Literals**:

```js
'hello world'; // Double quotes
'hello world'; // Single quotes
'line 1\nline 2'; // With newline escape
'tab\there'; // With tab escape
"quote: \"text\""; // With quote escapes
'apostrophe: \'text\''; // With apostrophe escapes
'backslash: \\path'; // With backslash escape
```

**Boolean Literals**:

```js
true; // Boolean true
false; // Boolean false
```

### 2. Identifier Expressions

```js
// Simple identifiers
counter; // Variable reference
playerX; // Game variables
gameState; // State variables
MAX_SIZE; // Constants (by convention)

// C64-specific identifiers
borderColor; // Hardware register names
spriteX; // Sprite coordinates
frameCount; // Timing variables
```

### 3. Unary Expressions (Prefix Operators)

**Logical NOT (`!`)**:

```js
!gameOver; // Logical negation
!flag; // Boolean inversion
!!value; // Double negation (convert to boolean)
!(x > 10); // Negated comparison
```

**Bitwise NOT (`~`)**:

```js
~mask; // Bitwise complement
~0xff; // Flip all bits of 255
~flags; // Invert flag bits
~(sprite & 0x07); // Complement of masked value
```

**Unary Plus (`+`)**:

```js
+value; // Explicit positive (rarely used)
+42; // Positive literal
+(x - y); // Force positive result
```

**Unary Minus (`-`)**:

```js
-speed; // Negate speed
-42; // Negative literal
-offset; // Negative offset
-(x + y); // Negate expression result
```

**Address-of (`@`) - C64 Specific**:

```js
@counter;               // Get address of counter variable
@buffer;                // Get address of buffer
@screenMemory;          // Get address of screen memory
@spriteData;           // Get address of sprite data array
```

**Nested Unary Operators**:

```js
!!gameReady;           // Double logical NOT
~-value;               // Bitwise NOT of negative
-~flags;               // Negative of bitwise NOT
@buffer[0];            // Address of array element (ERROR: @ can only be applied to identifiers)
```

### 4. Binary Expressions (All Operators)

**Arithmetic Operators**:

```js
// Addition and subtraction
x + y; // Add two values
playerX + speed; // Move player
offset - 1; // Decrement offset
width - borderSize * 2; // Calculate inner width

// Multiplication, division, modulo
width * height; // Calculate area
pixels / 8; // Convert to bytes
frameCount % 60; // Get seconds component
x * 40 + y; // Screen offset calculation (C64 specific)
```

**Comparison Operators**:

```js
// Equality
x == y; // Test equality
color != BLACK; // Test inequality
playerX == screenEdge; // Position check

// Relational
x < width; // Less than
speed <= maxSpeed; // Less than or equal
lives > 0; // Greater than
score >= highScore; // Greater than or equal
```

**Logical Operators**:

```js
// Logical AND/OR
gameRunning && !paused; // Both conditions true
x < 0 || x >= screenWidth; // Either condition true
ready && initialized && !error; // Multiple AND conditions
win || (lives > 0 && timeLeft > 0); // Complex logic
```

**Bitwise Operators**:

```js
// Bitwise AND/OR/XOR
flags & SPRITE_ENABLE; // Test flag bits
color | BRIGHT_FLAG; // Set brightness bit
data ^ 0xff; // XOR with mask
(status & READY) != 0; // Test specific bit

// Bit shifting
value << 1; // Left shift (multiply by 2)
data >> 3; // Right shift (divide by 8)
colorIndex << 4; // Shift to high nibble
(sprite << 1) | (sprite >> 7); // Rotate bits
```

### 5. Assignment Expressions

**Simple Assignment**:

```js
x = 10; // Basic assignment
playerHealth = maxHealth; // Copy value
vic.borderColor = RED; // Hardware register assignment
```

**Compound Assignment**:

```js
// Arithmetic compound assignment
score += points; // Add to score
lives -= 1; // Decrement lives
speed *= acceleration; // Multiply speed
health /= 2; // Halve health
frameCount %= 3600; // Wrap at hour mark

// Bitwise compound assignment
flags &= ~SPRITE_COLLISION; // Clear collision bit
status |= READY_FLAG; // Set ready bit
data ^= INVERT_MASK; // Toggle bits
spriteX <<= 1; // Double X coordinate
value >>= 2; // Quarter the value
```

**Right-Associative Assignment**:

```js
a = b = c = 0; // Parses as: a = (b = (c = 0))
x = y = getValue(); // Chain assignment
playerX = targetX = screenCenter; // Multiple assignment
```

### 6. Postfix Expressions (Highest Precedence)

**Function Calls**:

```js
// Zero-argument calls
clearScreen(); // Clear the screen
initializeGraphics(); // Setup graphics
playSound(); // Trigger sound

// Single-argument calls
setPixel(color); // Set pixel with color
delay(frames); // Wait specified frames
playNote(frequency); // Play musical note

// Multiple-argument calls
setPixel(x, y, color); // Set pixel at position
drawLine(x1, y1, x2, y2); // Draw line between points
fillRect(x, y, width, height); // Fill rectangle

// Complex argument expressions
calculateDistance(
  player.x + offsetX, // Complex expression as argument
  player.y + offsetY, // Another complex expression
  target.x, // Simple member access
  target.y // Simple member access
);
```

**Array/Index Access**:

```js
// Simple indexing
buffer[0]; // First element
screen[position]; // Screen memory access
sprites[playerIndex]; // Sprite data

// Expression indexing
screenRAM[y * 40 + x]; // 2D to 1D conversion (C64 screen)
colorRAM[row * SCREEN_WIDTH + col]; // Color memory
data[index + offset]; // Offset indexing

// Chained indexing (multi-dimensional arrays)
matrix[row][col]; // 2D matrix access
levelData[world][level][section]; // 3D array access
```

**Member Access (SPECIFICATION COMPLIANT)**:

```js
// @map member access ONLY (per specification)
vic.borderColor; // VIC-II register access
vic.backgroundColor; // VIC-II background
sid.voice1Freq; // SID frequency register
sid.volume; // SID volume control

// Complex member expressions
!vic.spriteCollision; // Logical NOT of member
vic.borderColor + 1; // Member in expression
vic.sprites[spriteIndex]; // Member with index access
```

## Complex Expression Examples

### Real C64 Programming Patterns

**Screen Memory Calculations**:

```js
// Convert 2D coordinates to screen memory offset
let screenOffset: word = y * 40 + x;
let colorOffset: word = screenOffset + $D800;

// Sprite positioning with bounds checking
let newX: byte = (playerX + deltaX) % SCREEN_WIDTH;
let spriteEnabled: boolean = x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT;
```

**Hardware Register Manipulation**:

```js
// Enable specific sprites
vic.spriteEnable = vic.spriteEnable | (1 << spriteIndex);

// Set sprite collision detection
let collision: boolean = (vic.spriteCollision & PLAYER_SPRITE_MASK) != 0;

// Configure SID voice
sid.voice1Freq = baseFrequency + (vibrato << 2);
```

**Game Logic Expressions**:

```js
// Complex conditional logic
let canMove: boolean = !wallCollision &&
                      (stamina > 0 || hasBoost) &&
                      !frozen;

// Score calculation with bonuses
let finalScore: word = baseScore * multiplier +
                      timeBonus +
                      (perfectRun ? PERFECT_BONUS : 0);

// Health system with damage resistance
let actualDamage: byte = incomingDamage > defense ?
                        incomingDamage - defense :
                        1; // Minimum 1 damage
```

## Expression Parsing Error Recovery

The parser NEVER crashes and always returns valid AST with diagnostics:

**Error Examples with Recovery**:

```js
// Invalid address-of usage (@ can only be applied to identifiers)
@(x + y);              // ERROR: Creates dummy expression, reports diagnostic
@42;                   // ERROR: Creates dummy expression, reports diagnostic

// Invalid assignment targets
5 = x;                 // ERROR: Creates assignment anyway, reports invalid lvalue
func() = value;        // ERROR: Creates assignment anyway, reports invalid lvalue

// Missing operands or operators
x + ;                  // ERROR: Uses dummy operand, reports missing expression
* y;                   // ERROR: Uses dummy left operand, reports unexpected operator
```

## What Expressions CANNOT Be Parsed

**Object-Oriented Features (Not in Specification)**:

```js
// ❌ Method calls
player.move(); // ERROR: Chaining after member access not supported
obj.method().result; // ERROR: Complex chaining not supported

// ❌ Complex chaining
array[index].prop; // ERROR: Member access on index result not supported
func().property; // ERROR: Member access on function result not supported
obj.prop.subprop; // ERROR: Nested member access not supported
```

**Advanced Features Not Yet Implemented**:

```js
// ❌ Ternary operator
x > 0 ? positive : negative; // Not implemented

// ❌ Increment/decrement
x++; // Not supported (use x += 1)
--y; // Not supported (use y -= 1)

// ❌ Function literals/lambdas
let fn = () => value; // Not supported

// ❌ Object/array literals
let obj = { x: 1, y: 2 }; // Not supported
let arr = [1, 2, 3]; // Not supported (use separate declarations)
```

## Next Steps

This completes Step 3. The expression parser can handle ALL documented Blend65 expressions with proper precedence, associativity, and error recovery. It strictly enforces specification compliance while providing excellent diagnostics.

**Ready for**: Step 4 - Declaration Parsing Analysis
