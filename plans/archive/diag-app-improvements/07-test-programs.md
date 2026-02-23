# Targeted Test Program Suite

> **Document**: 07-test-programs.md
> **Parent**: [Index](00-index.md)

## Overview

Create a comprehensive suite of minimal `.blend` test programs, each targeting a specific C64/6502 feature. Every program writes results to known memory locations for VICE verification.

## Test Result Protocol

### Completion Sentinel

Every test program MUST write `$42` to address `$02` when it completes successfully:

```js
// At the end of every test program:
poke($0002, $42);  // Completion sentinel

// Then halt
while (true) { barrier(); }
```

VICE checks: if `$02 != $42` after the cycle limit, the program either crashed or didn't complete.

### Result Reporting Convention

Programs write test results to screen memory starting at `$0400`:
- First byte: number of tests run
- Second byte: number of tests passed
- Screen row 0: test status values (one byte per test, `$01` = pass, `$00` = fail)

## Test Program Catalog

### Wave 1: Basic Operations (6 programs)

| # | Name | Tests | Features Exercised |
|---|------|-------|-------------------|
| 01 | `byte-arithmetic` | Byte +, -, *, /, %, shifts | Basic ALU operations |
| 02 | `word-arithmetic` | Word +, -, comparisons | 16-bit operations |
| 03 | `bitwise-ops` | AND, OR, XOR, NOT, shifts | Bitwise operations on byte/word |
| 04 | `control-flow` | if/else, while, for, nested loops, break | All control structures |
| 05 | `function-calls` | Params, returns, nested calls | Function calling convention |
| 06 | `memory-ops` | poke, peek, address-of (@) | Memory access patterns |

### Wave 2: C64 Hardware (8 programs)

| # | Name | Tests | Features Exercised |
|---|------|-------|-------------------|
| 07 | `vic-border-bg` | Border/background color writes | VIC-II $D020/$D021 |
| 08 | `screen-fill` | Screen memory fill patterns | Screen RAM $0400-$07E7 |
| 09 | `color-ram` | Color RAM writes | Color RAM $D800-$DBE7 |
| 10 | `charset-switch` | @charset, VIC charset pointer | $D018 manipulation, 2048-byte alignment |
| 11 | `sprite-enable` | Sprite enable, position, data | VIC sprite registers |
| 12 | `data-arrays` | @data byte/word arrays, indexing | Data segment, array access |
| 13 | `large-data` | @charset 2048 bytes, @data arrays | Data alignment, large segments |
| 14 | `address-compute` | lo(), hi(), @var, word indexing | Address computation chain |

### Wave 3: Integration (4 programs)

| # | Name | Tests | Features Exercised |
|---|------|-------|-------------------|
| 15 | `multi-function` | Multiple functions calling each other | Complex call graphs |
| 16 | `loop-memory` | Loop + poke patterns | Real-world memory fill |
| 17 | `word-index-array` | Word-indexed array access with poke | Common C64 pattern |
| 18 | `full-pipeline` | All features combined | End-to-end integration |

## Example Test Program: `01-byte-arithmetic`

```js
module Test.ByteArithmetic;

// Test results stored at screen memory
const SCREEN: word = $0400;
const SENTINEL: word = $0002;

export function main(): void {
    let testNum: byte = 0;
    let passed: byte = 0;

    // Test 1: Addition
    let a: byte = 10;
    let b: byte = 20;
    let result: byte = a + b;
    if (result == 30) {
        poke(SCREEN + 2 + testNum, 1);  // pass
        passed = passed + 1;
    } else {
        poke(SCREEN + 2 + testNum, 0);  // fail
    }
    testNum = testNum + 1;

    // Test 2: Subtraction
    result = b - a;
    if (result == 10) {
        poke(SCREEN + 2 + testNum, 1);
        passed = passed + 1;
    } else {
        poke(SCREEN + 2 + testNum, 0);
    }
    testNum = testNum + 1;

    // Test 3: Multiplication
    result = a * 3;
    if (result == 30) {
        poke(SCREEN + 2 + testNum, 1);
        passed = passed + 1;
    } else {
        poke(SCREEN + 2 + testNum, 0);
    }
    testNum = testNum + 1;

    // Test 4: Byte overflow wrapping
    let big: byte = 250;
    result = big + 10;  // Should wrap to 4
    if (result == 4) {
        poke(SCREEN + 2 + testNum, 1);
        passed = passed + 1;
    } else {
        poke(SCREEN + 2 + testNum, 0);
    }
    testNum = testNum + 1;

    // Write summary
    poke(SCREEN, testNum);   // total tests
    poke(SCREEN + 1, passed); // passed tests

    // Completion sentinel
    poke(SENTINEL, $42);

    // Halt
    while (true) { barrier(); }
}
```

### Corresponding `expected.json`

```json
{
  "description": "Byte arithmetic operations",
  "cycles": 2000000,
  "completion_sentinel": {
    "address": "0002",
    "value": "42",
    "description": "Program completed"
  },
  "memory_checks": [
    {
      "address": "0400",
      "expected": "04",
      "description": "4 tests run",
      "source": "screen.bin",
      "offset": 0
    },
    {
      "address": "0401",
      "expected": "04",
      "description": "4 tests passed",
      "source": "screen.bin",
      "offset": 1
    },
    {
      "address": "0402",
      "expected": "01",
      "description": "Test 1 (addition) passed",
      "source": "screen.bin",
      "offset": 2
    },
    {
      "address": "0403",
      "expected": "01",
      "description": "Test 2 (subtraction) passed",
      "source": "screen.bin",
      "offset": 3
    },
    {
      "address": "0404",
      "expected": "01",
      "description": "Test 3 (multiplication) passed",
      "source": "screen.bin",
      "offset": 4
    },
    {
      "address": "0405",
      "expected": "01",
      "description": "Test 4 (overflow wrap) passed",
      "source": "screen.bin",
      "offset": 5
    }
  ],
  "stack_check": {
    "sp_min": "F0",
    "description": "Stack should be near top"
  }
}
```

## Example Test Program: `10-charset-switch`

```js
module Test.CharsetSwitch;

const VIC_MEMORY_SETUP: word = $D018;
const SCREEN_BASE: word = $0400;
const SENTINEL: word = $0002;
const CHARSET_DEST: word = $2000;

// Simple 8-byte test character: letter 'A' with a known pattern
@charset const testFont: byte[2048] = [
    $7E,$81,$81,$FF,$81,$81,$81,$00,  // 0: Custom A
    $00,$00,$00,$00,$00,$00,$00,$00,  // 1: blank
    // ... remaining 2040 bytes zeros (padding)
    // (simplified for spec — real program would have full 2048)
];

function copyCharset(): void {
    for (let i: word = 0 to 2047) {
        poke(CHARSET_DEST + i, peek(@testFont + i));
    }
}

export function main(): void {
    let passed: byte = 0;
    let testNum: byte = 0;

    // Test 1: Copy charset to $2000
    copyCharset();

    // Verify first 8 bytes at $2000 match source
    let match: byte = 1;
    if (peek($2000) != $7E) { match = 0; }
    if (peek($2001) != $81) { match = 0; }
    if (peek($2007) != $00) { match = 0; }

    if (match == 1) {
        poke(SCREEN_BASE + 2 + testNum, 1);
        passed = passed + 1;
    } else {
        poke(SCREEN_BASE + 2 + testNum, 0);
    }
    testNum = testNum + 1;

    // Test 2: Switch VIC-II to charset at $2000
    let screenBits: byte = peek(VIC_MEMORY_SETUP) & $F0;
    poke(VIC_MEMORY_SETUP, screenBits | $08);

    // Verify $D018 has correct value
    let d018val: byte = peek(VIC_MEMORY_SETUP) & $0E;
    if (d018val == $08) {
        poke(SCREEN_BASE + 2 + testNum, 1);
        passed = passed + 1;
    } else {
        poke(SCREEN_BASE + 2 + testNum, 0);
    }
    testNum = testNum + 1;

    // Write summary
    poke(SCREEN_BASE, testNum);
    poke(SCREEN_BASE + 1, passed);

    // Completion sentinel
    poke(SENTINEL, $42);

    while (true) { barrier(); }
}
```

## Directory Structure

```
examples/test-suite/
├── README.md                    # Test suite overview
├── 01-byte-arithmetic/
│   ├── main.blend
│   ├── expected.json
│   └── README.md
├── 02-word-arithmetic/
│   ├── main.blend
│   ├── expected.json
│   └── README.md
├── ...
└── 18-full-pipeline/
    ├── main.blend
    ├── expected.json
    └── README.md
```

## Test Program Design Guidelines

1. **Minimal** — Test ONE feature category per program
2. **Self-verifying** — Write pass/fail to screen memory
3. **Deterministic** — Same result every run (no random, no timing)
4. **Fast** — Complete within 2-5 million cycles
5. **Sentinel** — Always write `$42` to `$02` on completion
6. **Documented** — README explains what's tested and expected behavior
7. **Spec-compliant** — Only use documented Blend language features

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Test program has syntax error | Compilation failure caught by diag_app |
| Test logic is wrong | Careful manual derivation of expected values |
| Cycle limit too low | Configurable per-test in expected.json |
| Feature not yet implemented in compiler | Skip test, document as known gap |
