# Batch Diagnostic Mode

> **Document**: 06-batch-mode.md
> **Parent**: [Index](00-index.md)

## Overview

Create `scripts/diag_batch.sh` — runs `diag_app.sh` (and optionally `diag_vice.sh`) across multiple test programs and produces a central report with cross-program analysis.

## Architecture

### Script: `scripts/diag_batch.sh`

```
Usage: ./scripts/diag_batch.sh <test-suite-dir> [output-dir]

Arguments:
  <test-suite-dir>   Directory containing test programs (each in its own subfolder)
  [output-dir]       Output directory (default: build/diag/batch/)
```

### Test Suite Directory Structure

```
examples/test-suite/
├── 01-byte-arithmetic/
│   ├── main.blend
│   ├── expected.json        # Optional — for VICE verification
│   └── README.md
├── 02-word-arithmetic/
│   ├── main.blend
│   ├── expected.json
│   └── README.md
├── 03-control-flow/
│   ├── main.blend
│   ├── expected.json
│   └── README.md
└── ...
```

### Execution Flow

```
1. Discover all test programs (find */main.blend)
2. Build compiler once (shared across all tests)
3. For each test program:
   a. Run diag_app.sh (compile + assemble + analyze)
   b. If expected.json exists, run diag_vice.sh (runtime verification)
   c. Collect results (pass/fail, warnings, metrics)
4. Generate central batch report (markdown)
5. Generate cross-program analysis
```

## Implementation Details

### 1. Test Discovery

```bash
discover_tests() {
  local suite_dir="$1"
  local tests=()

  for blend_file in "$suite_dir"/*/main.blend; do
    if [[ -f "$blend_file" ]]; then
      tests+=("$blend_file")
    fi
  done

  echo "${tests[@]}"
}
```

### 2. Per-Test Execution

```bash
run_single_test() {
  local blend_file="$1"
  local batch_output="$2"
  local test_dir=$(dirname "$blend_file")
  local test_name=$(basename "$test_dir")
  local test_output="$batch_output/$test_name"

  # Run diag_app
  bash scripts/diag_app.sh "$blend_file" "$test_output"
  local diag_result=$?

  # Run VICE if expected.json exists
  local vice_result="skip"
  local expected="$test_dir/expected.json"
  if [[ -f "$expected" ]]; then
    # Run VICE on O0 build (unoptimized — baseline correctness)
    local prg="$test_output/O0/output.prg"
    if [[ -f "$prg" ]]; then
      bash scripts/diag_vice.sh "$prg" "$expected" "$test_output/O0"
      vice_result=$?
    fi
  fi

  echo "$test_name|$diag_result|$vice_result"
}
```

### 3. Central Report Format

```markdown
# Blend65 Batch Diagnostic Report

> **Generated**: 2025-02-22 21:00:00
> **Test Suite**: examples/test-suite/
> **Tests Run**: 15
> **Compiler Tests**: 9000+ passing

## Summary

| # | Test | Compile | Assemble | VICE | Warnings |
|---|------|---------|----------|------|----------|
| 1 | byte-arithmetic | ✅ 10/10 | ✅ 10/10 | ✅ 8/8 checks | 0 |
| 2 | word-arithmetic | ✅ 10/10 | ✅ 10/10 | ❌ 5/8 checks | 2 |
| 3 | control-flow | ✅ 10/10 | ✅ 10/10 | ✅ 6/6 checks | 1 |
| 4 | screen-fill | ✅ 10/10 | ✅ 10/10 | ❌ 0/4 checks | 3 |
...

## Cross-Program Analysis

### Failures by Feature
| Feature | Tests Failed | Test Names |
|---------|-------------|------------|
| Word arithmetic | 2 | word-arithmetic, address-of |
| @data arrays | 1 | data-arrays |
| Screen memory | 1 | screen-fill |

### Common Warnings
| Warning | Occurrences | Tests |
|---------|-------------|-------|
| PHA/PLA imbalance | 3 | word-arith, sprites, charset |
| Size regression O2>O0 | 5 | most optimized tests |
| STA/LDA redundancy | 8 | nearly all tests |

### Size Comparison (O0 vs O3)
| Test | O0 Size | O3 Size | Delta |
|------|---------|---------|-------|
| byte-arithmetic | 245 B | 230 B | -15 B ✅ |
| word-arithmetic | 380 B | 410 B | +30 B ⚠️ |
...
```

### 4. Cross-Program Analysis

```bash
generate_cross_analysis() {
  local batch_output="$1"

  # Collect all warnings across tests
  echo "### Common Warnings"
  find "$batch_output" -name "summary.txt" -exec grep "⚠️" {} \; | \
    sort | uniq -c | sort -rn

  # Collect all VICE failures
  echo "### VICE Failures"
  find "$batch_output" -name "vice_results.txt" -exec grep "❌" {} \;

  # Size regression analysis
  echo "### Size Regressions"
  find "$batch_output" -name "summary.txt" -exec grep "SIZE REGRESSION" {} \;
}
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Test program compilation fails | Record failure, continue to next test |
| VICE execution fails for one test | Record failure, continue to next test |
| Batch interrupted mid-run | Partial report generated from completed tests |
| No test programs found | Error message with instructions |

## Testing Requirements

- Verify batch discovers all test programs in suite directory
- Verify batch continues after individual test failures
- Verify central report contains all test results
- Verify cross-program analysis identifies common patterns
