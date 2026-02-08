# Blend65

> **⚠️ DEVELOPMENT STATUS: ~90% COMPLETE**
>
> The full compiler pipeline is functional: lexer, parser, semantic analyzer, IL generator,
> code generator, IL optimizer, and ASM-IL optimizer. The compiler can compile Blend65 programs
> to 6502 assembly that runs on real Commodore 64 hardware.
>
> **Current milestone**: 7,800+ tests passing | Next phase: Bug fixes and polish

## Overview

Blend65 is a modern programming language compiler targeting 6502-based systems including the Commodore 64, VIC-20, and Commander X16. The language provides modern programming constructs while generating efficient assembly code for vintage hardware.

## Quick Examples

### Border Color Cycle (Real Working Example)

```js
module BorderCycle;

const BORDER_COLOR: word = $D020;

export function main(): void {
    while (true) {
        poke(BORDER_COLOR, peek(BORDER_COLOR) + 1);
    }
}
```

### Variables and Types

```js
// Integer types
let counter: byte = 0;          // 8-bit unsigned (0-255)
let health: word = 1000;        // 16-bit unsigned (0-65535)

// Constants
const SCREEN_RAM: word = $0400;
const SPRITE_ENABLE: word = $D015;

// Arrays with initializers
let data: byte[5] = [1, 2, 3, 4, 5];
let positions: word[8];

// Storage classes for memory placement
@zp let fastCounter: byte = 0;  // Zero-page (fastest access)
@ram let buffer: byte[256];     // Standard RAM (default)
```

### Expressions

```js
// Arithmetic
let result: byte = (a + b) * 2;
let shifted: byte = value << 2;     // Shift left
let masked: byte = value & $0F;     // Bitwise AND

// Comparisons
let isGreater: byte = score > highScore;

// Ternary operator
let max: byte = (a > b) ? a : b;

// Compound assignment
color += 1;
score -= 10;
```

### Functions

```js
// Function with parameters and return value
function add(a: byte, b: byte): byte {
    return a + b;
}

// Void function
function clearScreen(): void {
    for (i = 0 to 999) {
        poke($0400 + i, 32);  // Space character
    }
}

// Exported function (visible to other modules)
export function main(): void {
    clearScreen();
    let sum: byte = add(3, 7);
}
```

### Hardware Access with Intrinsics

```js
// Define hardware addresses as constants
const BORDER_COLOR: word = $D020;
const BACKGROUND: word = $D021;

// Read/write hardware using peek/poke
let currentColor: byte = peek(BORDER_COLOR);
poke(BORDER_COLOR, 14);       // Set to light blue
poke(BACKGROUND, 6);          // Blue background

// Word (16-bit) access
let timer: word = peekw($DC04);
pokew($DC04, $4000);

// Byte manipulation
let lowByte: byte = lo(timer);
let highByte: byte = hi(timer);

// Array length
let data: byte[10] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
let size: word = length(data);
```

### Low-Level CPU Control via ASM Functions

```js
// Disable interrupts during critical section
asm_sei();
poke($D020, 0);
poke($D021, 0);
asm_cli();

// Direct 6502 instructions (all 56 opcodes available)
asm_lda_imm(14);
asm_sta_abs($D020);
asm_nop();
```

### Control Flow

```js
// If-else
if (score > highScore) {
    highScore = score;
} else {
    poke($D020, 2);  // Red flash
}

// While loops
while (running) {
    updateGame();
}

// For loops with range syntax
for (i = 0 to 7) {
    poke($D027 + i, i + 1);  // Set sprite colors
}

// For loops with step and downto
for (i = 0 to 100 step 2) {
    poke($0400 + i, 42);
}

for (i = 255 downto 0) {
    poke($0400 + i, 32);
}

// Do-while loops
do {
    color = peek($D012);
} while (color != 255);

// Switch statements
switch (direction) {
    case 0: moveUp();
    case 1: moveDown();
    case 2: moveLeft();
    case 3: moveRight();
}

// Ternary expressions
let color: byte = isHit ? 2 : 5;
```

### Multi-Module Programs

```js
// hardware.blend
module Hardware;

const BORDER: word = $D020;
const BACKGROUND: word = $D021;

export function setBorder(color: byte): void {
    poke(BORDER, color);
}

export function setBackground(color: byte): void {
    poke(BACKGROUND, color);
}
```

```js
// main.blend
module Main;

import { setBorder, setBackground } from hardware;

export function main(): void {
    setBorder(14);       // Light blue
    setBackground(6);    // Blue
}
```

## Language Features

### Storage Classes

Variables can be declared with specific memory allocation strategies:

| Storage Class | Syntax | Description |
|---------------|--------|-------------|
| Default | `let x: byte` | Standard RAM allocation |
| Zero Page | `@zp let x: byte` | Fastest 6502 access (limited to 256 bytes) |
| RAM | `@ram let x: byte` | Explicit standard RAM |
| Data | `@data let x: byte` | Initialized data section |

### Built-in Intrinsics

| Function | Description |
|----------|-------------|
| `peek(addr)` | Read byte from memory address |
| `poke(addr, val)` | Write byte to memory address |
| `peekw(addr)` | Read 16-bit word from memory |
| `pokew(addr, val)` | Write 16-bit word to memory |
| `lo(val)` | Get low byte of a word |
| `hi(val)` | Get high byte of a word |
| `length(arr)` | Get length of an array |
| `barrier()` | Prevent optimizer from reordering across this point |

### ASM Functions (All 56 Opcodes)

Every 6502 instruction is available as a typed function:

```js
asm_sei();              // Set interrupt disable
asm_cli();              // Clear interrupt disable
asm_lda_imm(value);     // Load accumulator immediate
asm_sta_abs(addr);      // Store accumulator absolute
asm_jmp_abs(addr);      // Jump absolute
asm_nop();              // No operation
// ... all 56 opcodes with all addressing modes
```

### No Recursion (By Design)

Blend65 uses **Static Frame Allocation (SFA)** — each function gets a fixed memory frame at compile time. This means recursion is forbidden (detected at compile time), but code generation is simpler and more predictable with zero stack overhead.

```js
// ❌ COMPILE ERROR: Recursion not allowed
function countdown(n: byte): void {
    if (n > 0) {
        countdown(n - 1);  // ERROR: direct recursion detected
    }
}

// ✅ Use iteration instead
function countdown(n: byte): void {
    for (i = n downto 0) {
        poke($0400 + i, i);
    }
}
```

## Target Platforms

- **Commodore 64** — Full VIC-II, SID, and CIA support via peek/poke
- **VIC-20** — VIA and basic graphics support
- **Commander X16** — VERA graphics and enhanced features
- **Generic 6502** — Basic instruction set compatibility

## Building & Running

```bash
# Compile a Blend65 program
./packages/cli/bin/blend65.js build ./examples/border-cycle/main.blend

# Output: build/main.asm (ACME-compatible assembly)

# Assemble with ACME to create .prg file
acme -o ./build/main.prg -f cbm ./build/main.asm

# Run in VICE emulator
x64sc ./build/main.prg
```

### Optimization Levels

```bash
blend65 build main.blend -O1     # Basic optimizations
blend65 build main.blend -O2     # Standard optimizations
blend65 build main.blend -O3     # Aggressive optimizations
blend65 build main.blend -Os     # Optimize for size
```

## Implementation Status

**Compiler Pipeline:**

```
Source → Lexer ✅ → Parser ✅ → Semantic ✅ → IL ✅ → CodeGen ✅ → Optimizer ✅ → ASM ✅
```

| Component | Tests | Status |
|-----------|-------|--------|
| **Lexer** | 150+ | ✅ Production-ready |
| **Parser** | 400+ | ✅ Production-ready |
| **AST System** | 180+ | ✅ Production-ready |
| **Semantic Analyzer** | 3,500+ | ✅ Production-ready |
| **IL Generator** | 500+ | ✅ Production-ready |
| **Code Generator** | 700+ | ✅ Production-ready |
| **IL Optimizer** | 800+ | ✅ Complete (5 passes) |
| **ASM-IL Optimizer** | 700+ | ✅ Complete (8 passes) |
| **E2E & Integration** | 800+ | ✅ All passing |
| **Total** | **7,800+** | **✅ All Passing** |

### Known Issues

See [bug-list.md](bug-list.md) for current known bugs and their status.

## Development

This project uses TypeScript and is organized as a monorepo with Yarn workspaces.

```bash
# Install dependencies
yarn install

# Build all packages
yarn build

# Run all tests
./compiler-test

# Run tests for specific component
./compiler-test parser
./compiler-test semantic
./compiler-test codegen

# Clean build artifacts
yarn clean
```

**Requirements:**

- Node.js >= 22.0.0
- Yarn 1.x (< 2.0.0)

## Project Structure

```
blend65/
├── packages/
│   ├── compiler/              # Main compiler package
│   │   └── src/
│   │       ├── lexer/         # Tokenization
│   │       ├── parser/        # Syntax parsing (Pratt parser)
│   │       ├── ast/           # AST nodes, walkers, type guards
│   │       ├── semantic/      # Type checking, control flow, call graph
│   │       ├── frame/         # Static Frame Allocator (SFA)
│   │       ├── il/            # Intermediate Language generator
│   │       ├── codegen/       # 6502 code generation + ASM-IL
│   │       ├── optimizer/     # IL optimizer (DCE, const fold, etc.)
│   │       ├── pipeline/      # Compiler pipeline orchestration
│   │       └── __tests__/     # 7,800+ tests
│   └── cli/                   # Command-line interface
├── docs/
│   └── language-specification-v2/  # Complete language specification
├── examples/                  # Example Blend65 programs
└── plans/                     # Development roadmap
```

## Documentation

- [Language Specification](docs/language-specification-v2/README.md) — Complete syntax and semantics reference
- [Bug List](bug-list.md) — Known issues and their status

## License

> **📜 Elastic License 2.0 (ELv2)**
>
> This software is licensed under the Elastic License 2.0. You are free to use it to create
> games and software, but you cannot sell the compiler itself or offer it as a service.
> See [LICENSE](LICENSE.md) for full details.

| Use Case | Allowed |
|----------|---------|
| Create open-source games/software | ✅ Yes |
| Create commercial games/software | ✅ Yes |
| Modify Blend65 for your own use | ✅ Yes |
| Contribute improvements back | ✅ Yes |
| Sell Blend65 as a product | ❌ No |
| Include Blend65 in a commercial tool | ❌ No |
| Offer Blend65 as a hosted service | ❌ No |
| Fork to create competing compiler | ❌ No |

## Contributing

The project is under active development. See the [plans/](plans/) directory for current priorities and implementation roadmaps.
