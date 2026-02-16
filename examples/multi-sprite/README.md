# Multi-Sprite Animation Example

Tests **combined optimization themes** (A, C, F) working together.

## What It Does

Animates 3 sprites simultaneously with different frame counts and speeds. Each sprite uses a shared `getSpriteFrame()` function, stressing the inliner and multiple optimization passes in a single program.

## Optimization Themes Tested

- **Theme A**: Address expression folding (`@spriteSheet / 64` through inlining)
- **Theme C**: Frame counter wrapping at power-of-2 boundaries (mod 2, 4)
- **Theme F**: Word parameter store/reload elimination from inlining

## Build & Run

```bash
./scripts/diag_app.sh examples/multi-sprite/main.blend
```
