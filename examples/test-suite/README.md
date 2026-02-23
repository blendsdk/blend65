# Blend65 Diagnostic Test Suite

> **Purpose**: Targeted test programs for automated VICE runtime verification
> **Status**: Wave 1 — Basic Operations

## Overview

This test suite contains minimal `.blend` programs, each targeting a specific feature category. Every program writes results to known memory locations that are verified by the VICE diagnostic pipeline (`diag_batch.sh` → `diag_app.sh` → `diag_vice.sh`).

## Test Result Protocol

### Completion Sentinel

Every test program writes `$42` to address `$C000` when it completes successfully. VICE watches for this write to trigger memory dumps. If `$C000 != $42` after the cycle limit, the program either crashed or didn't complete.

### Result Reporting Convention

Programs write test results to screen memory starting at `$0400`:

| Offset | Content |
|--------|---------|
| `$0400` | Number of tests run |
| `$0401` | Number of tests passed |
| `$0402+` | Per-test status: `$01` = pass, `$00` = fail |

### Expected Values

Each test program has an `expected.json` file that defines:
- Completion sentinel check
- Memory checks for test results at screen memory
- Stack pointer health check

## Running Tests

### Full Batch Run

```bash
# Run all test-suite programs through the diagnostic pipeline
./scripts/diag_batch.sh examples/test-suite/ build/diag/test-suite
```

### Individual Test

```bash
# Compile + assemble + analyze a single test
./scripts/diag_app.sh examples/test-suite/01-byte-arithmetic/main.blend

# Run VICE verification (after diag_app)
./scripts/diag_vice.sh build/diag/01-byte-arithmetic/O0/output.prg \
  examples/test-suite/01-byte-arithmetic/expected.json
```

## Test Programs

### Wave 1: Basic Operations

| # | Name | Tests | Features Exercised |
|---|------|-------|-------------------|
| 01 | `byte-arithmetic` | 8 | Byte +, -, *, /, %, <<, >>, overflow wrap |
| 02 | `word-arithmetic` | 8 | Word +, -, comparisons, hi(), lo() |
| 03 | `bitwise-ops` | 8 | AND, OR, XOR, NOT, shifts on bytes |

### Wave 1b: Control Flow & Functions (planned)

| # | Name | Tests | Features Exercised |
|---|------|-------|-------------------|
| 04 | `control-flow` | — | if/else, while, for, nested loops, break |
| 05 | `function-calls` | — | Params, returns, nested calls |
| 06 | `memory-ops` | — | poke, peek, address-of (@) |

### Wave 2: C64 Hardware (planned)

| # | Name | Tests | Features Exercised |
|---|------|-------|-------------------|
| 07-14 | Various | — | VIC-II, sprites, charset, data arrays |

### Wave 3: Integration (planned)

| # | Name | Tests | Features Exercised |
|---|------|-------|-------------------|
| 15-18 | Various | — | Multi-function, loops + memory, full pipeline |

## Design Guidelines

1. **Minimal** — Test ONE feature category per program
2. **Self-verifying** — Write pass/fail to screen memory
3. **Deterministic** — Same result every run (no random, no timing)
4. **Fast** — Complete within 2-5 million cycles
5. **Sentinel** — Always write `$42` to `$C000` on completion
6. **Documented** — README explains what's tested and expected behavior
7. **Spec-compliant** — Only use documented Blend language features
