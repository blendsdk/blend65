# Testing Strategy: Diagnostic Tool Improvements

> **Document**: 09-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

The diagnostic tools are shell scripts, so testing focuses on:
1. **Functional verification** — do the scripts produce correct output?
2. **Integration testing** — do the scripts work together (diag_app → diag_vice → diag_batch)?
3. **Edge case testing** — do they handle failures gracefully?

### Coverage Goals

- All new shell functions tested with at least one known-good and one known-bad input
- VICE integration tested with border-cycle (known working program)
- Batch mode tested with at least 3 test programs
- All error paths tested (missing files, VICE not found, ACME failure)

## Test Categories

### Manual Verification Tests

Since these are shell scripts, testing is primarily manual/semi-automated:

| Test | Description | How to Verify |
|------|-------------|---------------|
| ACME label generation | `-l` flag produces label file | Check `output.labels` exists and has content |
| Label alignment check | @charset alignment validation | Run with armenian-charset, check warning for misalignment |
| PRG validation | Load address and BASIC stub check | Run with border-cycle, verify $0801 and SYS detected |
| Assembly metrics | Instruction counting | Run with border-cycle, manually verify counts against `grep -c` |
| PHA/PLA balance | Stack balance per function | Run with known-balanced and intentionally-imbalanced programs |
| Size regression | Ox > O0 flagging | Compare PRG sizes, verify warnings appear when appropriate |
| Redundancy detection | STA/LDA pair finding | Run with known-redundant assembly, verify detection |
| VICE execution | Autostart + warp + limitcycles | Run border-cycle, check VICE exits cleanly |
| Memory dumps | Monitor commands produce .bin files | Check screen.bin, vic.bin etc. exist after VICE run |
| Screenshot | Exit screenshot generation | Check screenshot.png exists (or graceful fallback) |
| Memory comparison | Expected vs actual values | Run byte-arithmetic test, verify all checks pass |
| Batch mode | Multiple tests with central report | Run batch on 3+ tests, verify report generated |

### Smoke Test Script

Create a simple smoke test that validates the basic pipeline:

```bash
# scripts/test-diag-smoke.sh
# Quick smoke test for diagnostic tools

echo "=== Smoke Test: diag_app.sh ==="
./scripts/diag_app.sh examples/border-cycle/main.blend build/diag/smoke-test

echo ""
echo "=== Verify Output Files ==="
[ -f build/diag/smoke-test/O0/output.asm ] && echo "✅ ASM generated" || echo "❌ No ASM"
[ -f build/diag/smoke-test/O0/output.prg ] && echo "✅ PRG generated" || echo "❌ No PRG"
[ -f build/diag/smoke-test/O0/output.labels ] && echo "✅ Labels generated" || echo "❌ No labels"
[ -f build/diag/smoke-test/summary.txt ] && echo "✅ Summary generated" || echo "❌ No summary"

echo ""
echo "=== Verify ACME Labels ==="
cat build/diag/smoke-test/O0/output.labels 2>/dev/null | head -10

echo ""
echo "=== Smoke Test: diag_vice.sh ==="
if [ -f build/diag/smoke-test/O0/output.prg ]; then
  # Create minimal expected.json for border-cycle
  cat > /tmp/smoke-expected.json << 'EOF'
{
  "description": "Border cycle smoke test",
  "cycles": 1000000,
  "memory_checks": [
    {
      "address": "D020",
      "expected": "00",
      "description": "Border color should have been written",
      "source": "vic.bin",
      "offset": 32
    }
  ],
  "stack_check": { "sp_min": "F0" }
}
EOF
  ./scripts/diag_vice.sh build/diag/smoke-test/O0/output.prg /tmp/smoke-expected.json build/diag/smoke-test/O0
fi

echo ""
echo "=== Smoke Test Complete ==="
```

## Verification Checklist

- [ ] `diag_app.sh` generates label files for all optimization levels
- [ ] `diag_app.sh` validates PRG binary (load address check)
- [ ] `diag_app.sh` extracts assembly metrics (at least JSR/PHA/PLA counts)
- [ ] `diag_app.sh` detects PHA/PLA imbalance (test with known case)
- [ ] `diag_app.sh` flags size regressions when Ox > O0
- [ ] `diag_app.sh` detects STA/LDA redundancy patterns
- [ ] `diag_vice.sh` launches VICE and exits cleanly with limitcycles
- [ ] `diag_vice.sh` produces memory dump files (screen.bin, vic.bin)
- [ ] `diag_vice.sh` compares memory against expected.json
- [ ] `diag_vice.sh` handles VICE not found gracefully
- [ ] `diag_batch.sh` discovers all tests in suite directory
- [ ] `diag_batch.sh` produces central report
- [ ] `diag_batch.sh` continues after individual test failures
- [ ] All scripts have `--help` usage information
- [ ] Updated `diagnose.md` references correct file paths
