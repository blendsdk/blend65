# Armenian Charset Example Implementation Plan

> **Feature**: Armenian alphabet custom charset for C64 with snake animation
> **Status**: Planning Complete
> **Created**: 2025-02-17

## Overview

Create a Blend65 example program that demonstrates custom character set creation using the `@charset` storage class. The program loads an Armenian alphabet charset, displays "Բարև Աշխարհ" (Hello World in Armenian), and animates the full 38-letter alphabet in a growing serpentine snake pattern across the screen. Colors use the Armenian national flag palette (red, blue, orange).

This example showcases several Blend65 features:
- `@charset` sugar keyword for 2048-byte aligned character data
- `@` address-of operator with division for VIC-II charset pointer calculation
- `lo()` intrinsic for word-to-byte narrowing
- VIC-II character generator switching via `$D018`
- Screen memory direct access via `poke()`
- For/while loops for animation
- Delay loops using `barrier()`

## Document Index

| #  | Document                                     | Description                                   |
|----|----------------------------------------------|-----------------------------------------------|
| 00 | [Index](00-index.md)                         | This document — overview and navigation       |
| 01 | [Requirements](01-requirements.md)           | Feature requirements and scope                |
| 02 | [Current State](02-current-state.md)         | Analysis of existing examples and patterns    |
| 03 | [Charset Design](03-charset-design.md)       | Armenian glyph 8×8 bitmap specifications      |
| 04 | [Program Architecture](04-program-architecture.md) | main.blend structure and logic          |
| 07 | [Testing Strategy](07-testing-strategy.md)   | Verification via diag_app                     |
| 99 | [Execution Plan](99-execution-plan.md)       | Phases, sessions, and task checklist          |

## Quick Reference

### Usage

```bash
# Compile and run
blend65 examples/armenian-charset/main.blend -o output.asm

# Verify at all optimization levels
./scripts/diag_app.sh examples/armenian-charset/main.blend
```

### Key Decisions

| Decision              | Outcome                                        |
|-----------------------|------------------------------------------------|
| Letter case           | Uppercase only (38 letters)                    |
| Hello World phrase    | Բարև Աշխարհ (Barev Ashkharh)                  |
| Color scheme          | Armenian flag: red, blue, orange               |
| Storage class         | `@charset` (2048-byte aligned)                 |
| Animation             | Serpentine snake growing 1 letter at a time    |
| Charset pointer       | `lo(@armenianFont / 2048)` via `$D018`         |

## Related Files

| File | Purpose |
|------|---------|
| `examples/armenian-charset/main.blend` | Main program (to be created) |
| `examples/armenian-charset/README.md` | Documentation (to be created) |
