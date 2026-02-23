# Diagnostic Tool Improvements — Implementation Plan

> **Feature**: Transform `diag_app` from compile/assemble checker into full-spectrum diagnostic tool with VICE emulator integration, automated assembly analysis, and batch testing
> **Status**: Planning Complete
> **Created**: 2025-02-22

## Overview

The Blend65 compiler passes all 9000+ unit/integration tests, yet compiled programs don't work correctly in the emulator. This reveals a critical gap: tests verify individual compiler phases in isolation, but don't validate the final binary's runtime behavior on real C64 hardware (or emulators).

This plan transforms the existing `diag_app.sh` diagnostic tool into a comprehensive diagnostic suite that:

1. **Analyzes assembly output automatically** — metrics, PHA/PLA balance, redundancies, size regressions
2. **Extracts ACME label addresses** — reveals data alignment and address computation issues
3. **Validates PRG binaries** — load address, BASIC stub, data content verification
4. **Runs programs in VICE emulator** — warp speed, cycle-limited, with memory/register dumps
5. **Compares runtime state against expected values** — automated pass/fail verification
6. **Processes multiple programs in batch** — central reporting across test suite
7. **Provides targeted test programs** — each exercising specific C64/6502 features

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current `diag_app.sh` implementation |
| 03 | [ACME Labels & PRG Analysis](03-acme-labels-prg-analysis.md) | ACME label file extraction + PRG binary validation |
| 04 | [Assembly Analysis](04-assembly-analysis.md) | Automated assembly metrics and pattern detection |
| 05 | [VICE Integration](05-vice-integration.md) | VICE emulator runtime verification |
| 06 | [Batch Mode](06-batch-mode.md) | Cross-program batch diagnostic mode |
| 07 | [Test Programs](07-test-programs.md) | Targeted test program suite design |
| 08 | [Diagnose.md Update](08-diagnose-md-update.md) | AI diagnostic protocol update |
| 09 | [Testing Strategy](09-testing-strategy.md) | Verification of the diagnostic tools themselves |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### VICE Command-Line Integration

```bash
# Path to VICE x64sc on this machine:
/Users/gevik/workdir/vice/VICE.app/Contents/Resources/bin/x64sc

# Key flags for automated testing:
x64sc -warp \
      -limitcycles 5000000 \
      -moncommands verify.mon \
      -exitscreenshot screenshot.png \
      -autostart output.prg \
      +confirmonexit
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| VICE emulator path | `/Users/gevik/workdir/vice/VICE.app/Contents/Resources/bin/x64sc` |
| ACME label file | Add `-l output.labels` to all ACME invocations |
| Test result protocol | Memory sentinel at `$02` + specific memory checks |
| Test program location | `examples/test-suite/` directory |
| Expected values format | JSON files alongside test programs |
| Batch report format | Central markdown report |

## Related Files

### Existing
- `scripts/diag_app.sh` — Current diagnostic script (to be enhanced)
- `.clinerules/diagnose.md` — AI diagnostic protocol (to be updated)

### New (to be created)
- `scripts/diag_vice.sh` — VICE runtime verification script
- `scripts/diag_batch.sh` — Batch diagnostic runner
- `scripts/diag_analyze_asm.sh` — Assembly analysis helper
- `examples/test-suite/` — Targeted test programs
