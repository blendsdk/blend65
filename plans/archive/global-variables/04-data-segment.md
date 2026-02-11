# Data Segment: @data Static Data Implementation

> **Document**: 04-data-segment.md
> **Parent**: [Index](00-index.md)

## Overview

The `@data` storage class places initialized constant data in a dedicated data segment at the end of the binary. This is for static data like sprite shapes, sin tables, character maps, SID music, and text strings.

## Design

### Binary Layout

```
$0801          BASIC SYS stub (SYS 2061)
$080D-$xxxx   Code segment (all functions)
$xxxx-$yyyy   Global RAM region (@ram and default globals)
$yyyy-$zzzz   Data segment (@data const blocks, packed sequentially)
```

### Data Segment Builder

**File**: `packages/compiler/src/codegen/data-segment.ts`

Collects all `@data const` declarations and:
1. Evaluates constant initializers at compile time
2. Packs raw bytes sequentially
3. Assigns absolute addresses based on segment base
4. Produces a byte array for binary output

### @data Rules

| Rule | Enforcement |
|------|-------------|
| Must use `const` | Parser/semantic error if `let` |
| Must have initializer | Semantic error if missing |
| Module-level only | Parser blocks inside functions |
| Initializer must be constant | Semantic error for non-constant |
| Arrays: raw byte packing | Each element evaluated and packed |
| Scalars: single value | Single byte/word in data segment |

### IL Strategy for @data

`@data const` arrays do NOT generate initialization IL (no STORE instructions). Instead:
- The data is embedded directly in the output binary
- References use the assigned data segment address
- The IL generator emits `LOAD_ADDR` for the base address

```
// For: @data const spriteData: byte[63] = [0, 0, 0, 255, ...]
// NO globalInit IL generated
// Instead: raw bytes at data segment address $yyyy
// References: LOAD_IMM_WORD $yyyy  (loads base address)
```

### Constant Evaluation

The data segment builder needs to evaluate initializer expressions at compile time:
- Integer literals: direct value
- Hex literals ($FF): convert to byte
- Binary literals (%10101010): convert to byte
- Enum values: resolve to integer
- Simple expressions (2 + 3): evaluate
- Array literals: evaluate each element

## Testing Requirements

- Data segment byte packing for various types (~10 tests)
- Large arrays (sprite 63 bytes, sin table 256 bytes) (~5 tests)
- Address assignment for multiple @data blocks (~5 tests)
- Constant evaluation for various literal types (~10 tests)
- Error: @data without const, without initializer (~5 tests)
