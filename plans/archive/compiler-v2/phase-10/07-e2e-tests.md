# End-to-End Pipeline Tests

> **Document**: 07-e2e-tests.md
> **Parent**: [Index](00-index.md)

## Overview

Create comprehensive end-to-end tests that exercise the complete compilation pipeline from Blend65 source code through to assembly output. These tests prove the entire system works together.

## Test Categories

### 1. Simple Programs (Basic Pipeline)

| Test | Description |
|------|-------------|
| Hello world | `export function main(): void { poke($0400, 65); }` → valid assembly |
| Variable declarations | `let x: byte = 42;` in main function |
| Arithmetic | `let result: byte = a + b * 2;` |
| Control flow | if/else, while, for loops |
| Function calls | Multi-function programs with calls |

### 2. Intrinsic Programs

| Test | Description |
|------|-------------|
| peek/poke | Read/write memory addresses |
| peekw/pokew | 16-bit memory access |
| hi/lo | Byte extraction from words |
| volatile_read/write | Forced memory access |
| barrier | Optimization barrier |
| length | Compile-time array length |

### 3. ASM Function Programs

| Test | Description |
|------|-------------|
| Implied ops | `asm_sei(); asm_cli(); asm_nop();` → `SEI / CLI / NOP` |
| Immediate ops | `asm_lda_imm(0);` → `LDA #$00` |
| ZP/Absolute ops | `asm_sta_abs($D020);` → `STA $D020` |
| Register transfers | `asm_tax(); asm_tya();` → `TAX / TYA` |
| Stack ops | `asm_pha(); asm_pla();` → `PHA / PLA` |
| Flag ops | `asm_clc(); asm_sec();` → `CLC / SEC` |
| Mixed asm + high-level | Blend of asm_* calls and normal code |

### 4. Multi-Module Programs

| Test | Description |
|------|-------------|
| Import/export | Module A exports function, Module B imports and calls |
| Library loading | system.blend intrinsics available automatically |
| asm.blend loading | asm_* functions available automatically |
| Multiple modules | 3+ module program compiles correctly |

### 5. Real-World C64 Patterns

| Test | Description |
|------|-------------|
| Screen fill | Fill screen memory with characters |
| Border color | Set VIC-II border/background colors |
| Raster wait | Wait for specific raster line |
| Critical section | sei/poke/cli pattern |
| Hardware init | Initialize C64 hardware via asm_* |

### 6. Error Cases

| Test | Description |
|------|-------------|
| Type errors | Produces diagnostics, no output |
| Undefined variables | Error in semantic phase |
| Invalid target | Error in target validation |
| Missing main | No entry point error |

## Test Infrastructure

### Pipeline Test Helper

```typescript
function compileSource(source: string, options?: Partial<CompileOptions>): CompilationResult {
  const compiler = new Compiler();
  const sources = new Map([['test.blend', source]]);
  return compiler.compileSource(sources, defaultConfig, options?.stopAfterPhase);
}

function expectAssemblyContains(result: CompilationResult, ...patterns: string[]): void {
  expect(result.success).toBe(true);
  for (const pattern of patterns) {
    expect(result.output?.assembly).toContain(pattern);
  }
}
```

## File Organization

```
packages/compiler-v2/src/__tests__/e2e/
├── pipeline/
│   ├── simple-programs.test.ts     (~20 tests)
│   ├── intrinsics.test.ts          (~15 tests)
│   ├── asm-functions.test.ts       (~20 tests)
│   ├── multi-module.test.ts        (~10 tests)
│   ├── c64-patterns.test.ts        (~15 tests)
│   └── error-cases.test.ts         (~10 tests)
```

## Dependencies

- Compiler class (06-pipeline-compiler.md)
- All library files (system.blend, asm.blend, hardware.blend)
- All asm_* support (04, 05)
