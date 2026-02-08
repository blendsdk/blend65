# Type System

> **Status**: Draft
> **Related Documents**: [Variables](03-variables.md), [Functions](06-functions.md), [Lexical Structure](01-lexical-structure.md)

## Overview

Blend65 provides a simple, practical type system designed for 6502 programming. The type system is **static** (types are checked at compile time) and **explicit** (types must be declared).

## Primitive Types

Blend65 provides five core primitive types:

### byte

An **8-bit unsigned integer** (0-255).

```ebnf
type_keyword = "byte" ;
```

**Examples:**
```js
let x: byte = 255;
let color: byte = $FF;
let mask: byte = 0b11110000;
```

**Properties:**
- Size: 8 bits (1 byte)
- Range: 0 to 255
- Unsigned
- Maps directly to 6502 8-bit registers (A, X, Y)

### word

A **16-bit unsigned integer** (0-65535).

```ebnf
type_keyword = "word" ;
```

**Examples:**
```js
let addr: word = $D000;
let score: word = 65535;
let offset: word = 1000;
```

**Properties:**
- Size: 16 bits (2 bytes)
- Range: 0 to 65535
- Unsigned
- Little-endian storage on 6502
- Used for memory addresses and larger values

### void

Represents **no value** (used for function return types).

```ebnf
type_keyword = "void" ;
```

**Example:**
```js
function clearScreen(): void {
  // No return value
}
```

### boolean

A **logical type** with two values: `true` or `false`.

```ebnf
type_keyword = "boolean" ;
```

**Examples:**
```js
let running: boolean = true;
let gameOver: boolean = false;
```

**Properties:**
- Logical values: `true` or `false`
- Implementation: Stored as byte (0 = false, non-zero = true)
- Used in conditionals and logic

### string

A **string literal type** for text data.

```ebnf
type_keyword = "string" ;
```

**Examples:**
```js
let title: string = "Snake Game";
let message: string = 'Press Start';
```

**Properties:**
- Immutable string literals
- Encoded as null-terminated byte sequences
- Used for compile-time text constants

## Type Aliases

Type aliases create **new names for existing types**.

### Syntax

```ebnf
type_decl = "type" , identifier , "=" , type_expr , ";" ;
```

### Examples

**Simple aliases:**
```js
type SpriteId = byte;
type Address = word;
type Flag = boolean;
```

**Array type aliases:**
```js
type ScreenBuffer = byte[1000];
type ColorMap = byte[256];
```

### Usage

Once defined, type aliases can be used anywhere the original type would be valid:

```js
type SpriteId = byte;

let sprite0: SpriteId = 0;
let sprite1: SpriteId = 1;

function setSpritePosition(id: SpriteId, x: byte, y: byte): void {
  // ...
}
```

### Built-in Type Aliases

Blend65 provides several **built-in type aliases** that are automatically available:

#### @address

`@address` is a built-in type alias for `word`, used specifically for memory addresses.

```js
// Built-in type alias (no declaration needed):
// type @address = word;
```

**Usage:**
```js
// Function parameters - clearly indicates memory addresses
function copyMemory(src: @address, dst: @address, len: byte): void {
  for (let i: byte = 0; i < len; i += 1) {
    poke(dst + i, peek(src + i));
  }
}

// Variables
let screenAddr: @address = 0x0400;         // Screen RAM base address
let spriteAddr: @address = @spriteData;    // From address-of operator

// Type compatibility with word
let wordValue: word = screenAddr;          // ✅ Valid - same type
let addrValue: @address = 0xD020;          // ✅ Valid - can assign word
```

**Properties:**
- **Type equivalence**: `@address ≡ word` (completely interchangeable)
- **Self-documenting**: Makes it clear when a parameter expects a memory address
- **Zero cost**: Pure alias with no runtime overhead
- **Built-in**: Available automatically, no declaration required

**Used with Address-Of Operator:**
```js
@ram let buffer: byte[256];

// Address-of operator returns @address type
let bufferAddr: @address = @buffer;

// Pass to functions expecting addresses
copyMemory(@source, @buffer, 100);
```

### Type Alias Properties

- **Compile-time only** - Type aliases exist only during compilation
- **Transparent** - `SpriteId` and `byte` are completely interchangeable
- **No overhead** - Zero runtime cost
- **Documentation** - Improves code readability

## Enums

Enums define **named constant sets**.

### Syntax

```ebnf
enum_decl = "enum" , identifier , "{" , { enum_member , [ "," ] } , "}" ;

enum_member = identifier , [ "=" , integer ] ;
```

### Basic Enums

```js
enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT
}
```

**Auto-numbering:**
- `UP` = 0
- `DOWN` = 1
- `LEFT` = 2
- `RIGHT` = 3

### Explicit Values

```js
enum GameState {
  MENU = 0,
  PLAYING = 1,
  PAUSED = 2,
  GAME_OVER = 3
}
```

### Mixed Explicit and Implicit

```js
enum Color {
  BLACK = 0,
  WHITE = 1,
  RED = 2,
  CYAN,        // 3 (auto-incremented)
  PURPLE,      // 4
  GREEN = 5,
  BLUE,        // 6
  YELLOW       // 7
}
```

### Using Enums

```js
enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3
}

let currentDirection: byte = Direction.UP;

switch (currentDirection) {
  case Direction.UP:
    moveUp();
  case Direction.DOWN:
    moveDown();
  case Direction.LEFT:
    moveLeft();
  case Direction.RIGHT:
    moveRight();
}
```

### Enum Properties

- **Compile-time constants** - Enum values are resolved at compile time
- **Type is byte** - Enum members are byte constants
- **Scoped names** - Access via `EnumName.MEMBER`
- **Zero overhead** - No runtime cost

## Array Types

Arrays represent **fixed-size sequences** of elements.

### Syntax

```ebnf
type_expr = type_name
          | type_name , "[" , [ integer ] , "]" ;
```

**Note**: The array size is optional if an initializer is provided (size will be inferred).

### Examples

**Explicit size:**
```js
let buffer: byte[256];          // 256-byte array
let screenRAM: byte[1000];      // 1000-byte array
let positions: word[10];        // 10-word array (20 bytes total)
```

**Inferred size from initializer:**
```js
let colors: byte[] = [2, 5, 6];             // Size 3 inferred
let values: word[] = [100, 200, 300];       // Size 3 inferred
let matrix: byte[][] = [[1, 2], [3, 4]];    // Size [2][2] inferred
```

### Array Properties

- **Fixed size** - Size must be a compile-time constant (explicit or inferred)
- **Zero-indexed** - First element is index 0
- **Bounds checking** - Compile-time checking for constant indices
- **Contiguous** - Elements stored sequentially in memory
- **Size inference** - Size can be inferred from array literal initializers

### Array Indexing

```js
let buffer: byte[10];

buffer[0] = 5;               // Set first element
buffer[9] = 255;             // Set last element
let x = buffer[3];           // Read element

// With variables (dynamic indexing)
for (let i: byte = 0; i < 10; i += 1) {
  buffer[i] = 0;
}
```

### Array Size Inference

When an array is initialized with an array literal, the size can be omitted and will be **inferred from the initializer**:

```js
// Basic inference
let colors: byte[] = [2, 5, 6];              // Size 3 inferred
let empty: byte[] = [];                      // Size 0 inferred
let single: byte[] = [42];                   // Size 1 inferred

// Multi-dimensional inference
let matrix: byte[][] = [[1, 2], [3, 4]];     // Size [2][2] inferred
let cube: byte[][][] = [
  [[1, 2], [3, 4]],
  [[5, 6], [7, 8]]
];                                            // Size [2][2][2] inferred

// With storage classes
@zp let fast: byte[] = [0, 0, 0];            // Size 3 inferred, zero-page
@data const lookup: byte[] = [1, 2, 4, 8];   // Size 4 inferred, data section

// With expressions
let positions: byte[] = [x, y + 1, z * 2];   // Size 3 inferred
```

**Rules for size inference:**

1. ✅ **Requires array literal initializer** - Cannot infer without `[...]`
   ```js
   let arr: byte[] = [1, 2, 3];  // ✅ OK - size 3 inferred
   let buf: byte[];              // ❌ ERROR - cannot infer size without initializer
   ```

2. ✅ **Nested arrays must have consistent dimensions**
   ```js
   let good: byte[][] = [[1, 2], [3, 4]];     // ✅ OK - all rows have 2 elements
   let bad: byte[][] = [[1, 2], [3, 4, 5]];   // ❌ ERROR - inconsistent sizes
   ```

3. ✅ **Inferred size is compile-time constant**
   ```js
   let arr: byte[] = [1, 2, 3];
   // Compiler treats this as: let arr: byte[3] = [1, 2, 3];
   ```

4. ❌ **Cannot infer from non-literal expressions**
   ```js
   let other: byte[3];
   let arr: byte[] = other;  // ❌ ERROR - cannot infer from variable
   ```

## callback Type

The `callback` keyword is used for **function pointers** (primarily for interrupt handlers).

### Syntax

```ebnf
type_keyword = "callback" ;
```

### As Function Modifier

```js
callback function rasterIRQ(): void {
  // Interrupt handler
}
```

### As Type Annotation

```js
let handler: callback = myFunction;
```

### Callback Properties

- **Function pointer** - References a function
- **6502-specific** - Used for interrupt vectors (IRQ, NMI)
- **No parameters** - Callback functions typically have no parameters
- **Zero overhead** - Compiles to direct JSR or vector assignment

See [Functions](06-functions.md) for details on callback functions.

## Type Annotations

All declarations can (and should) include **explicit type annotations**.

### Variable Type Annotations

```js
let x: byte = 10;
let addr: word = $D000;
let running: boolean = true;
```

### Function Parameter Type Annotations

```js
function add(a: byte, b: byte): byte {
  return a + b;
}
```

### Function Return Type Annotations

```js
function calculateScore(): word {
  return 1000;
}

function update(): void {
  // No return value
}
```

## Type Inference (Limited)

Blend65 has **limited type inference**:

### Literals Have Implicit Types

```js
let x = 10;        // Inferred as byte or word (context-dependent)
let s = "hello";   // Inferred as string
let b = true;      // Inferred as boolean
```

### Explicit Types Are Preferred

For clarity and safety, **always use explicit type annotations**:

```js
// ✅ GOOD: Explicit types
let x: byte = 10;
let addr: word = $D000;

// ⚠️ ACCEPTABLE: Inferred, but less clear
let x = 10;
```

## Type Compatibility

### Assignment Compatibility

```js
let b: byte = 255;      // OK
let w: word = 65535;    // OK

// ❌ Type mismatch (word to byte may lose data)
let b2: byte = w;       // Warning or error

// ✅ Explicit narrowing (future feature)
let b3: byte = byte(w); // Cast (not yet implemented)
```

### Function Parameter Compatibility

```js
function takeByte(x: byte): void {
}

let w: word = 1000;
takeByte(w);  // ❌ Error: Cannot pass word where byte expected
```

## Type Checking

Blend65 performs **static type checking** at compile time:

1. **Declaration checking** - Variables and functions must have valid types
2. **Assignment checking** - Values assigned must match variable types
3. **Function call checking** - Arguments must match parameter types
4. **Return type checking** - Returned values must match declared return type

### Type Errors

**Undeclared variable:**
```js
x = 5;  // Error: 'x' not declared
```

**Type mismatch:**
```js
let b: byte = 10;
let w: word = b + 1000;  // May overflow byte
```

**Wrong number of arguments:**
```js
function add(a: byte, b: byte): byte {
  return a + b;
}

add(5);  // Error: Expected 2 arguments, got 1
```

## Built-in Type Sizes

| Type | Size (bits) | Size (bytes) | Range |
|------|-------------|--------------|-------|
| `byte` | 8 | 1 | 0-255 |
| `word` | 16 | 2 | 0-65535 |
| `@address` | 16 | 2 | 0-65535 |
| `boolean` | 8* | 1 | true/false |
| `void` | 0 | 0 | N/A |
| `string` | Variable | Variable | Text |
| `callback` | 16* | 2 | Function address |

\* Implementation detail: `boolean` stored as byte, `callback` as word address

## Complete Example

```js
module Game.Types;

// Type aliases for clarity
export type SpriteId = byte;
export type Position = word;
export type Color = byte;

// Enum for game states
export enum GameState {
  MENU = 0,
  PLAYING = 1,
  PAUSED = 2,
  GAME_OVER = 3
}

// Enum for colors
export enum C64Color {
  BLACK = 0,
  WHITE = 1,
  RED = 2,
  CYAN = 3,
  PURPLE = 4,
  GREEN = 5,
  BLUE = 6,
  YELLOW = 7
}

// Variables with explicit types
@zp let currentState: byte = GameState.MENU;
@zp let playerX: byte = 10;
@zp let playerY: byte = 10;
@ram let buffer: byte[256];

// Function with type annotations
export function setColor(color: Color): void {
  poke($D020, color);
}

export function getPosition(): Position {
  return playerX + playerY * 40;
}
```

## Type System Design Principles

1. **Explicit over Implicit** - Types should be declared explicitly
2. **Simple and Predictable** - Types map directly to 6502 concepts
3. **Zero Overhead** - Type checking is compile-time only
4. **Hardware-Aligned** - Types match 6502 register sizes
5. **Safety Where Possible** - Catch type errors at compile time