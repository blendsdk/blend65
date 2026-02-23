# Automated Assembly Analysis

> **Document**: 04-assembly-analysis.md
> **Parent**: [Index](00-index.md)

## Overview

Add automated static analysis of generated assembly code to `diag_app.sh`. This replaces manual AI counting/inspection described in `diagnose.md` with shell-based automated extraction.

## Components

### 1. Assembly Metrics Extraction

**New file: `scripts/diag_analyze_asm.sh`** — Standalone assembly analysis tool.

Takes an `.asm` file and outputs metrics in a structured format.

**Metrics to extract:**

| Metric | grep Pattern | Description |
|--------|-------------|-------------|
| Total lines | `wc -l` (excluding comments/blanks) | Code size |
| JSR count | `grep -c "JSR "` | Function call overhead |
| JMP count | `grep -c "JMP "` | Unconditional jumps |
| LDA #imm | `grep -c "LDA #"` | Immediate loads |
| STA count | `grep -c "STA "` | Store operations |
| LDA count | `grep -c "LDA "` | Load operations |
| PHA count | `grep -c "PHA"` | Stack pushes |
| PLA count | `grep -c "PLA"` | Stack pops |
| Branch count | `grep -c "B[CNEQPMIV][CSEQL]"` | Conditional branches |
| RTS count | `grep -c "RTS"` | Function returns |
| Data bytes | Count `!byte` / `!word` lines | Data segment size |

**Cross-level metrics table (added to summary.txt):**

```
==============================================================================
  Assembly Metrics (Cross-Level)
==============================================================================

  Metric         O0    O1    O1s   O1z   O2    Os    Oz    O3    O3s   O3z
  ─────────────  ────  ────  ────  ────  ────  ────  ────  ────  ────  ────
  ASM lines      450   420   415   410   400   395   390   380   375   370
  JSR calls      12    8     8     8     5     5     5     3     3     3
  JMP instrs     15    14    14    14    12    12    12    10    10    10
  LDA #imm       45    42    42    42    38    38    38    35    35    35
  PHA+PLA        8+8   6+6   6+6   6+6   4+4   4+4   4+4   2+2   2+2   2+2
  STA/LDA pairs  3     2     2     2     1     1     1     0     0     0
  Data bytes     2048  2048  2048  2048  2048  2048  2048  2048  2048  2048
```

### 2. PHA/PLA Balance Check

**Critical safety check** — stack imbalance causes random crashes on 6502.

**Algorithm:**

```bash
# For each function (between labels):
# 1. Count PHA instructions
# 2. Count PLA instructions
# 3. If PHA != PLA, report imbalance

analyze_stack_balance() {
  local asm_file="$1"
  local current_func=""
  local pha_count=0
  local pla_count=0

  while IFS= read -r line; do
    # Detect function labels (lines ending with : that aren't local labels)
    if [[ "$line" =~ ^[a-zA-Z_][a-zA-Z0-9_]*: ]]; then
      # Report previous function
      if [[ -n "$current_func" && $pha_count -ne $pla_count ]]; then
        echo "  ❌ STACK IMBALANCE: $current_func (PHA=$pha_count, PLA=$pla_count)"
      fi
      current_func="${line%%:*}"
      pha_count=0
      pla_count=0
    fi

    # Count PHA/PLA
    [[ "$line" =~ [[:space:]]PHA ]] && ((pha_count++))
    [[ "$line" =~ [[:space:]]PLA ]] && ((pla_count++))
  done < "$asm_file"

  # Report last function
  if [[ -n "$current_func" && $pha_count -ne $pla_count ]]; then
    echo "  ❌ STACK IMBALANCE: $current_func (PHA=$pha_count, PLA=$pla_count)"
  fi
}
```

**Output format:**

```
==============================================================================
  Stack Balance Check (O0)
==============================================================================

  Function        PHA  PLA  Balanced?
  ──────────────  ───  ───  ─────────
  main            2    2    ✅
  plotChar        4    4    ✅
  clearScreen     2    2    ✅
  copyCharset     3    2    ❌ IMBALANCE!
```

### 3. Size Regression Detection

**Automated flagging when optimized code is larger than O0:**

```bash
detect_size_regressions() {
  local o0_size="${PRG_SIZES[0]}"

  for i in "${!LEVELS[@]}"; do
    if (( i == 0 )); then continue; fi
    local level="${LEVELS[$i]}"
    local size="${PRG_SIZES[$i]}"

    if (( size > o0_size && size > 0 && o0_size > 0 )); then
      local delta=$((size - o0_size))
      echo "  ⚠️  SIZE REGRESSION: $level ($size B) is $delta bytes LARGER than O0 ($o0_size B)"
    fi
  done
}
```

### 4. Redundancy Pattern Detection

**Detect common assembly anti-patterns:**

| Pattern | Description | Detection |
|---------|-------------|-----------|
| STA/LDA pair | Store then immediately reload same address | Two consecutive lines: `STA $xx` followed by `LDA $xx` |
| JMP-to-next | Jump target is the next instruction | `JMP .label` followed by `.label:` |
| Dead code after JMP | Instructions after unconditional JMP before next label | Code between `JMP` and next label |
| Redundant LDA | Loading same value twice | Two `LDA #$xx` with same value, no intervening store |

```bash
detect_redundancies() {
  local asm_file="$1"
  local prev_line=""
  local redundancies=0

  while IFS= read -r line; do
    # STA/LDA pair detection
    if [[ "$prev_line" =~ STA[[:space:]]+(\$[0-9a-fA-F]+) ]]; then
      local sta_addr="${BASH_REMATCH[1]}"
      if [[ "$line" =~ LDA[[:space:]]+$sta_addr ]]; then
        echo "  ⚠️  REDUNDANT STA/LDA: $sta_addr"
        ((redundancies++))
      fi
    fi

    # JMP-to-next detection
    if [[ "$prev_line" =~ JMP[[:space:]]+(\.[a-zA-Z0-9_]+) ]]; then
      local jmp_target="${BASH_REMATCH[1]}"
      if [[ "$line" =~ ^${jmp_target}: ]]; then
        echo "  ⚠️  JMP-TO-NEXT: $jmp_target"
        ((redundancies++))
      fi
    fi

    prev_line="$line"
  done < "$asm_file"

  echo "  Total redundancies found: $redundancies"
}
```

## Integration into `diag_app.sh`

Add as **Step 6: Assembly Analysis** after compilation and assembly:

```bash
header "Step 6: Assembly Analysis"

for level in "${LEVELS[@]}"; do
  ASM_FILE="$OUTPUT_DIR/$level/output.asm"
  if [[ -f "$ASM_FILE" ]]; then
    subheader "$level Assembly Analysis"
    # Run analysis script
    bash scripts/diag_analyze_asm.sh "$ASM_FILE" "$level"
  fi
done

# Size regression check
subheader "Size Regression Check"
detect_size_regressions
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Assembly file empty or missing | Skip analysis for that level with warning |
| No functions found (no labels) | Report as warning — unusual assembly structure |
| Regex pattern doesn't match edge case | Log unmatched patterns for future improvement |

## Testing Requirements

- Test metrics extraction on known assembly files
- Test PHA/PLA balance detection with intentionally imbalanced code
- Test size regression detection with known size differences
- Test redundancy detection with each pattern type
- Verify output format matches expected table structure
