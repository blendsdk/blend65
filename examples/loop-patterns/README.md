# Loop Patterns Example

Tests the **ASM register promotion optimization** (Theme H).

## What It Does

Runs various for-loop patterns to exercise the RegisterPromotePass, which converts memory-based loop counters (INC $addr / CMP #N) to register operations (INX / CPX #N).

## Optimization Themes Tested

- **Theme H**: Register promotion for simple count-up loops
- **Theme H**: Nested loops (both counters promoted)
- **Theme H negative**: Loops with JSR (blocks promotion)

## Build & Run

```bash
./scripts/diag_app.sh examples/loop-patterns/main.blend
```
