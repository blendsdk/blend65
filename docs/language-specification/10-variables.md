# Variables

> **Status**: Lexer-Derived Specification  
> **Last Updated**: January 8, 2026  
> **Related Documents**: [Type System](05-type-system.md), [6502 Features](13-6502-features.md), [Program Structure](03-program-structure.md)

## Overview

Variables store data in memory. Blend65 provides explicit control over variable placement through **storage classes** and **mutability modifiers**.

## Variable Declaration Syntax

```ebnf
variable_decl = [ storage_class ] , mutability , identifier
              , [ ":" , type_expr ]
              , [ "=" , expression ] , ";" ;

storage_class = "@zp" | "@ram" | "@data" ;
mutability = "let" | "const" ;
type_expr = type_name | type_name , "[" , integer , "]" ;
```

## Mutability Modifiers

### let - Mutable Variables

Variables declared with `let` can be modified after initialization:

```js
let x: byte = 10;
x = 20;  // OK - can be changed

let buffer: byte[256];
buffer[0] = 255;  // OK - can be modified
```

### const - Immutable Constants

Variables declared with `const` cannot be modified after initialization:

```js
const MAX_SPRITES: byte = 8;
// MAX_SPRITES = 10;  // Error: Cannot assign to const

const SCREEN_BASE: word = $0400;
```

**Important**: `const` declarations **must** include an initializer (enforced by parser):

```js
const MAX: byte = 100;  // ✅ OK
const MIN: byte;        // ❌ Error: MissingConstInitializer
```

## Storage Classes

Storage classes control **where in memory** a variable is allocated. This is a crucial 6502-specific feature.

### @zp - Zero Page

Allocates variable in **zero page** ($0000-$00FF):

```js
@zp let fastCounter: byte = 0;
@zp let playerX: byte;
@zp let addr: word = $D000;
```

**Properties:**
- **Size**: 256 bytes total (shared with system/runtime)
- **Speed**: Fastest access (special 6502 addressing modes)
- **Use for**: Frequently accessed variables, loop counters, pointers

**Benefits:**
- Faster execution (2-3 cycles vs 4-5 cycles)
- Smaller code (2 bytes vs 3 bytes per access)
- Required for indirect addressing

**Limitations:**
- Very limited space (256 bytes total)
- Shared with BASIC, KERNAL, and runtime
- System may use $00-$8F on C64

### @ram - General RAM

Allocates variable in **general-purpose RAM**:

```js
@ram let buffer: byte[1000];
@ram let score: word = 0;
```

**Properties:**
- **Size**: Large (depends on system, typically 20KB+ available)
- **Speed**: Standard access speed
- **Use for**: General-purpose variables, large arrays

**This is the default** - when no storage class is specified, `@ram` is assumed:

```js
let buffer: byte[256];       // Equivalent to @ram let buffer: byte[256];
let score: word = 0;         // Equivalent to @ram let score: word = 0;
```

### @data - Initialized Data Section

Allocates variable in **initialized data section** (ROM-able):

```js
@data const lookupTable: byte[256] = [...];
@data const fontData: byte[2048] = [...];
@data const message: string = "Hello, World!";
```

**Properties:**
- **Size**: Depends on available memory
- **Speed**: Standard read access (no writes)
- **Use for**: Constant lookup tables, pre-initialized data

**Typically used with const:**
```js
@data const sinTable: byte[256] = [...];
@data const spriteData: byte[64] = [...];
```

### Default Storage Class

When **no storage class** is specified, variables use `@ram` by default:

```js
// These are equivalent:
let x: byte = 10;
@ram let x: byte = 10;

// These are equivalent:
let buffer: byte[256];
@ram let buffer: byte[256];
```

**Rationale:**
- `@zp` is precious and should be explicit
- `@data` is for constants and should be explicit
- `@ram` is the general-purpose choice

## Type Annotations

Variables should include explicit type annotations:

```js
let x: byte = 10;
let addr: word = $D000;
let running: boolean = true;
let name: string = "Player";
```

### Optional Type Inference

Types can sometimes be inferred from initializers, but **explicit types are preferred**:

```js
// ✅ GOOD: Explicit type
let x: byte = 10;

// ⚠️ ACCEPTABLE: Inferred type
let x = 10;
```

## Initialization

### With Initializer

```js
let x: byte = 10;
let addr: word = $D000;
@zp let counter: byte = 0;
```

### Without Initializer

```js
let x: byte;        // Uninitialized (undefined value)
let buffer: byte[256];  // Uninitialized array
```

> **Note**: Uninitialized variables have undefined values. Always initialize variables before use.

### Array Initialization

Future feature (not yet implemented):

```js
// Future syntax for array initialization
let values: byte[4] = [1, 2, 3, 4];
```

Currently, arrays must be initialized element-by-element:

```js
let buffer: byte[4];
buffer[0] = 1;
buffer[1] = 2;
buffer[2] = 3;
buffer[3] = 4;
```

## Scope

### Module-Level Variables

Variables declared at module scope are **global** to that module:

```js
module Game.Main

@zp let score: word = 0;        // Module-level global
@ram let buffer: byte[256];     // Module-level global

function updateScore(): void
  score += 10;  // Access module-level variable
end function
```

### Function-Level Variables

Variables declared inside functions are **local** to that function:

```js
function calculate(): byte
  let temp: byte = 10;  // Local to calculate()
  return temp * 2;
end function

// temp is not accessible here
```

### No Block-Level Scope

Variables are **function-scoped**, not block-scoped:

```js
function test(): void
  if true then
    let x: byte = 10;
  end if
  
  // x is still accessible here (function scope, not block scope)
  let y = x;
end function
```

## Storage Class Selection Guidelines

Choose the appropriate storage class based on usage patterns:

### Use @zp When:

- ✅ Variable is accessed **frequently** in performance-critical code
- ✅ Variable is a byte or word (8 or 16 bits)
- ✅ You need fast zero-page addressing modes
- ⚠️ **Warning**: Zero page is limited to 256 bytes total

**Examples:**
```js
@zp let frameCount: byte = 0;       // Updated every frame
@zp let playerX: byte;              // Accessed in game loop
@zp let tempPtr: word;              // Used for indirect addressing
```

### Use @ram (or omit) When:

- ✅ General-purpose variables
- ✅ Large arrays or buffers
- ✅ No special performance requirements
- ✅ This is the **default** and most common choice

**Examples:**
```js
let screenBuffer: byte[1000];      // Large buffer
let enemyHealth: byte[10];         // Array of values
let tempData: byte;                // Temporary storage
```

### Use @data When:

- ✅ Constant data that must be pre-initialized
- ✅ ROM-able constant tables
- ✅ Data that should not consume RAM
- ✅ Usually combined with `const`

**Examples:**
```js
@data const sinTable: byte[256] = [...];       // Lookup table
@data const tileData: byte[2048] = [...];      // Graphics data
@data const musicData: byte[1024] = [...];     // Sound data
```

## Complete Examples

### Basic Variable Declarations

```js
module Game.Main

// Constants
const MAX_ENEMIES: byte = 10;
const SCREEN_WIDTH: byte = 40;

// Zero-page variables (performance-critical)
@zp let playerX: byte = 10;
@zp let playerY: byte = 10;
@zp let frameCounter: byte = 0;

// General RAM variables (default)
let buffer: byte[256];
let enemyHealth: byte[10];
let score: word = 0;

// Initialized data
@data const levelData: byte[1024] = [...];
```

### Variable Usage

```js
function updateGame(): void
  // Modify mutable variables
  playerX += 1;
  score += 10;
  frameCounter += 1;
  
  // Use constants
  if enemyHealth[0] > MAX_ENEMIES then
    enemyHealth[0] = MAX_ENEMIES;
  end if
  
  // Array access
  buffer[0] = playerX;
  buffer[1] = playerY;
end function
```

### Storage Class Comparison

```js
module Performance.Test

// Fast access - zero page
@zp let zpCounter: byte = 0;

// Standard access - general RAM
let ramCounter: byte = 0;

// Read-only - data section
@data const dataValue: byte = 100;

function benchmark(): void
  // Zero page access (fastest)
  zpCounter += 1;     // 5 cycles
  
  // RAM access (standard)
  ramCounter += 1;    // 6 cycles
  
  // Data read (standard)
  let x = dataValue;  // 4 cycles (read-only)
end function
```

## Variable Naming Conventions

### Recommended Conventions

```js
// ✅ GOOD: Descriptive names
let playerHealth: byte;
let enemyPositionX: byte;
let screenBufferOffset: word;

// ✅ GOOD: Constants in UPPER_CASE
const MAX_SPRITES: byte = 8;
const SCREEN_BASE: word = $0400;

// ✅ GOOD: Short names for loop counters
for i = 0 to 10
  buffer[i] = 0;
next i
```

### Avoid

```js
// ❌ BAD: Single letter names (except loop counters)
let x: byte;
let z: word;

// ❌ BAD: Cryptic abbreviations
let plyrhlth: byte;
let scrbnfst: word;
```

## Best Practices

### 1. Use Explicit Storage Classes for Clarity

```js
// ✅ GOOD: Explicit intent
@zp let criticalCounter: byte = 0;
@ram let largeBuffer: byte[1000];
@data const lookupTable: byte[256] = [...];

// ⚠️ ACCEPTABLE: Default @ram
let buffer: byte[100];
```

### 2. Always Initialize Constants

```js
// ✅ GOOD: Initialized const
const MAX: byte = 100;

// ❌ ERROR: Missing initializer
const MIN: byte;  // Parser error!
```

### 3. Use Descriptive Names

```js
// ✅ GOOD: Clear purpose
let playerHealth: byte = 100;
let enemyCount: byte = 0;

// ❌ BAD: Unclear
let h: byte = 100;
let c: byte = 0;
```

### 4. Group Related Variables

```js
module Game.Player

// Player state
@zp let playerX: byte;
@zp let playerY: byte;
@zp let playerHealth: byte;

// Enemy state
let enemyX: byte[10];
let enemyY: byte[10];
let enemyHealth: byte[10];
```

### 5. Reserve Zero Page for Hot Variables

```js
// ✅ GOOD: Frequently accessed
@zp let loopCounter: byte;
@zp let frameCount: byte;

// ❌ BAD: Rarely accessed
@zp let configValue: byte = 5;  // Wastes zero page space
```

## Common Patterns

### Loop Counter in Zero Page

```js
@zp let i: byte;

for i = 0 to 255
  buffer[i] = 0;
next i
```

### Temporary Storage

```js
function calculate(): byte
  let temp: byte;
  temp = a + b;
  temp = temp * 2;
  return temp;
end function
```

### Large Data Structures

```js
// Screen buffer (1000 bytes)
let screenBuffer: byte[1000];

// Color memory mirror
let colorBuffer: byte[1000];
```

## Implementation Notes

Variable declarations are parsed in:
- `packages/compiler/src/parser/` - Parser implementation
- `packages/compiler/src/ast/nodes.ts` - AST node types

See [Type System](05-type-system.md) for type details and [6502 Features](13-6502-features.md) for storage class selection guidelines.
