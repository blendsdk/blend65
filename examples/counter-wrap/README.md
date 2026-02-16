# Counter Wrap Example

Tests the **modulo-to-bitmask optimization** (Theme C).

## What It Does

Cycles the C64 border and background colors using counter wrapping patterns. The increment-compare-reset pattern should be optimized to AND bitmask operations for power-of-2 wrap values.

## Optimization Themes Tested

- **Theme C**: Power-of-2 modulo → AND bitmask (mod 2, 4, 8, 16)
- **Negative test**: mod 5 must NOT be optimized

## Build & Run

```bash
./scripts/diag_app.sh examples/counter-wrap/main.blend
```
