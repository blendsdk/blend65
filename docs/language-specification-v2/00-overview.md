# Overview

> **Status**: Draft  
> **Architecture**: Static Frame Allocation (SFA)  
> **Related Documents**: [Lexical Structure](01-lexical-structure.md), [Types](02-types.md)

## Introduction

Blend65 is a modern programming language designed to compile to 6502-family systems, including:
- Commodore 64
- VIC-20
- Commander X16
- Other 6502-based platforms

The language aims to provide **structured programming**, **modularity**, and a **practical type system** while still enabling fine-grained memory placement and low-level control necessary for 6502 development.

## Design Goals

### 1. Modern Syntax with Low-Level Control

Blend65 combines modern programming language features with direct hardware access:
- Structured control flow (if/while/for/switch)
- Type safety (byte/word/boolean/string types)
- Module system (import/export)
- Direct memory access via `peek()`/`poke()` intrinsics
- Fine-grained memory placement (storage classes)
- Full 6502 instruction access via `asm_*()` functions

### 2. 6502-Specific Features

The language is designed specifically for 6502 systems and includes:
- **Storage classes** (`@zp`, `@ram`, `@data`) for memory placement control
- **Intrinsic functions** (`peek`, `poke`, `hi`, `lo`) for hardware access
- **ASM functions** (`asm_sei`, `asm_cli`, etc.) for all 56 6502 instructions
- **Callback functions** for interrupt handlers
- **Zero-overhead abstractions** that compile to efficient 6502 assembly

### 3. Static Frame Allocation (SFA)

Blend65 uses **Static Frame Allocation** instead of SSA:
- Each function gets a static memory frame at compile-time
- Parameters and locals have fixed addresses
- **Recursion is not allowed** (compile-time error)
- Simpler, more predictable code generation

### 4. Readable and Maintainable

Unlike traditional 6502 assembly or BASIC:
- Clear variable and function names
- Block-structured syntax with curly braces
- Type annotations for clarity
- Comments for documentation

### 5. Predictable Compilation

The language is designed for **predictable code generation**:
- No hidden allocations or runtime overhead
- Explicit memory placement
- Direct mapping to 6502 instructions
- Transparent compilation model

## Key Language Characteristics

### Case-Sensitive Keywords

All keywords are **case-sensitive**:
- `break` is a keyword
- `Break` is an identifier

### Semicolon-Terminated Statements

Blend65 uses **semicolons** (`;`) to separate statements:
```js
let x: byte = 5;
let y: byte = 10;
```

### C-Style Block Structure

Control flow and declarations use **curly braces** for blocks:
```js
function main(): void {
  if (x > 5) {
    doSomething();
  }
}
```

### Explicit Memory Control

Variables can be explicitly placed in different memory regions:
```js
@zp let counter: byte = 0;        // Zero page (fast)
@ram let buffer: byte[1000];      // General RAM (default)
@data const table: byte[256];     // Initialized data section
```

### No Recursion

Due to Static Frame Allocation, **recursion is forbidden**:
```js
// ❌ COMPILE ERROR: Recursion not allowed
function factorial(n: byte): word {
  if (n <= 1) return 1;
  return n * factorial(n - 1);  // ERROR!
}

// ✅ Use iteration instead
function factorial(n: byte): word {
  let result: word = 1;
  for (let i: byte = 2; i <= n; i += 1) {
    result = result * i;
  }
  return result;
}
```

## Quick Syntax Examples

### Module Declaration
```js
module Game.Main;
```

### Import Statement
```js
import { clearScreen, setPixel } from c64.graphics;
```

### Function Declaration
```js
export function add(a: byte, b: byte): byte {
  return a + b;
}
```

### Control Flow
```js
if (score > 100) {
  showBonus();
} else {
  continueGame();
}

while (running) {
  updateGame();
}

for (let i: byte = 0; i < 10; i += 1) {
  buffer[i] = 0;
}

switch (state) {
  case GameState.MENU:
    showMenu();
  case GameState.PLAYING:
    updateGame();
  default:
    reset();
}
```

### Hardware Access via Intrinsics
```js
// Define hardware addresses as constants
const BORDER_COLOR: word = $D020;
const BACKGROUND_COLOR: word = $D021;

// Read/write hardware using peek/poke
let currentColor = peek(BORDER_COLOR);
poke(BORDER_COLOR, 14);  // Set to light blue

// Word (16-bit) access
let timer = peekw($DC04);
pokew($DC04, $4000);
```

### Low-Level CPU Control via ASM Functions
```js
// Disable interrupts during critical section
asm_sei();
poke($D020, 0);
poke($D021, 0);
asm_cli();

// Direct 6502 instructions
asm_lda_imm(14);
asm_sta_abs($D020);
```

## Language Philosophy

Blend65 is designed around these core principles:

1. **Explicit over Implicit** - Memory placement, types, and control flow are always explicit
2. **Zero Cost Abstractions** - High-level constructs compile to efficient 6502 code
3. **Hardware First** - Language features map directly to 6502 capabilities
4. **Type Safety Where Possible** - Catch errors at compile time, not runtime
5. **Readable Assembly Alternative** - More maintainable than raw assembly, as efficient as hand-written code

## What Makes Blend65 Different?

### Compared to C64 BASIC:
- ✅ Structured programming (no GOTO spaghetti)
- ✅ Type safety
- ✅ Module system
- ✅ Compiles to native 6502 code (not interpreted)

### Compared to CC65 (C compiler):
- ✅ 6502-specific storage classes
- ✅ Simpler syntax for hardware access
- ✅ No pointer arithmetic confusion
- ✅ Designed for 6502, not ported from another architecture

### Compared to 6502 Assembly:
- ✅ High-level control flow
- ✅ Type checking
- ✅ Variables with meaningful names
- ✅ Module system and code organization
- ⚠️ Still compiles to equivalent assembly code

## Restrictions

Blend65 has intentional restrictions to keep the language simple and efficient:

1. **No recursion** - Direct or indirect recursion is a compile error
2. **No dynamic allocation** - All memory is static
3. **Fixed array sizes** - Array sizes must be known at compile time
4. **No nested functions** - Functions at module level only
5. **No function overloading** - One function per name
6. **Pass by value only** - No references or pointers to locals

## Next Steps

To understand Blend65 in detail, read the specification documents in order:

1. **[Lexical Structure](01-lexical-structure.md)** - Tokens, keywords, and literals
2. **[Types](02-types.md)** - Type system
3. **[Variables](03-variables.md)** - Variable declarations and storage classes
4. **[Expressions](04-expressions.md)** - Operators and precedence
5. **[Statements](05-statements.md)** - Control flow
6. **[Functions](06-functions.md)** - Function declarations and callbacks
7. **[Modules](07-modules.md)** - Import/export system
8. **[Intrinsics](08-intrinsics.md)** - Built-in functions
9. **[ASM Functions](09-asm-functions.md)** - 6502 instruction functions
10. **[Compiler](10-compiler.md)** - SFA architecture and pipeline