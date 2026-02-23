#!/usr/bin/env bash
# =============================================================================
# batch/report.sh — Central report generation for batch diagnostics
# =============================================================================
#
# Generates a comprehensive markdown report from batch diagnostic results.
# Includes a summary table of all tests, cross-program analysis of common
# warnings and failure patterns, and size comparison data.
#
# Requires: batch/env.sh and batch/runner.sh to be sourced first
#   (uses global BATCH_* arrays populated by runner.sh)
#
# =============================================================================

# ---------------------------------------------------------------------------
# generate_batch_report() — Create the central markdown report
#
# Writes a complete batch diagnostic report to the specified file. The
# report includes:
#   - Summary table with compile/assemble/VICE status per test
#   - Cross-program analysis (common warnings, failure patterns)
#   - Size comparison table (O0 vs O3)
#   - Detailed per-test data
#
# Arguments:
#   $1 — Output file path for the markdown report
#   $2 — Suite directory (for display in report header)
#
# Globals read:
#   BATCH_TESTS, BATCH_TEST_NAMES, BATCH_TEST_COUNT
#   BATCH_BLEND_PASS, BATCH_BLEND_TOTAL
#   BATCH_ACME_PASS, BATCH_ACME_TOTAL
#   BATCH_VICE_STATUS, BATCH_VICE_DETAIL
#   BATCH_O0_PRG_SIZE, BATCH_O3_PRG_SIZE
#   BATCH_SIZE_REGRESSIONS, BATCH_WARNINGS
#   BATCH_TOTAL_PASS, BATCH_TOTAL_FAIL
# ---------------------------------------------------------------------------
generate_batch_report() {
  local report_file="$1"
  local suite_dir="$2"

  {
    _write_report_header "$suite_dir"
    _write_summary_table
    _write_cross_program_analysis "$3"
    _write_size_comparison
    _write_report_footer
  } > "$report_file"

  batch_ok "Report written to: $report_file"
}

# ---------------------------------------------------------------------------
# _write_report_header() — Write the report title and metadata
# ---------------------------------------------------------------------------
_write_report_header() {
  local suite_dir="$1"

  cat <<EOF
# Blend65 Batch Diagnostic Report

> **Generated**: $(batch_timestamp)
> **Test Suite**: $suite_dir
> **Tests Run**: $BATCH_TEST_COUNT
> **Passed**: $BATCH_TOTAL_PASS / $BATCH_TEST_COUNT
> **Failed**: $BATCH_TOTAL_FAIL / $BATCH_TEST_COUNT

---

EOF
}

# ---------------------------------------------------------------------------
# _write_summary_table() — Write the per-test summary table
#
# Creates a markdown table with one row per test showing compile status,
# assembly status, VICE verification status, and warning count.
# ---------------------------------------------------------------------------
_write_summary_table() {
  cat <<EOF
## Summary

| # | Test | Compile | Assemble | VICE | Warnings |
|---|------|---------|----------|------|----------|
EOF

  for i in "${!BATCH_TESTS[@]}"; do
    local idx=$((i + 1))
    local name="${BATCH_TEST_NAMES[$i]}"

    # Format compile status: "✅ 10/10" or "❌ 8/10"
    local blend_p="${BATCH_BLEND_PASS[$i]:-0}"
    local blend_t="${BATCH_BLEND_TOTAL[$i]:-0}"
    local compile_str
    if [[ "$blend_p" -eq "$blend_t" && "$blend_t" -gt 0 ]]; then
      compile_str="✅ $blend_p/$blend_t"
    elif [[ "$blend_t" -eq 0 ]]; then
      compile_str="—"
    else
      compile_str="❌ $blend_p/$blend_t"
    fi

    # Format assemble status
    local acme_p="${BATCH_ACME_PASS[$i]:-0}"
    local acme_t="${BATCH_ACME_TOTAL[$i]:-0}"
    local assemble_str
    if [[ "$acme_p" -eq "$acme_t" && "$acme_t" -gt 0 ]]; then
      assemble_str="✅ $acme_p/$acme_t"
    elif [[ "$acme_t" -eq 0 ]]; then
      assemble_str="—"
    else
      assemble_str="❌ $acme_p/$acme_t"
    fi

    # Format VICE status
    local vice_s="${BATCH_VICE_STATUS[$i]:-skip}"
    local vice_d="${BATCH_VICE_DETAIL[$i]:-—}"
    local vice_str
    case "$vice_s" in
      pass) vice_str="✅ $vice_d" ;;
      fail) vice_str="❌ $vice_d" ;;
      skip) vice_str="⏭️ $vice_d" ;;
      *)    vice_str="—" ;;
    esac

    # Format warnings (guard against non-numeric values)
    local warn="${BATCH_WARNINGS[$i]:-0}"
    warn="${warn%%[^0-9]*}"
    [[ -z "$warn" ]] && warn=0
    local warn_str
    if [[ "$warn" -eq 0 ]]; then
      warn_str="0"
    else
      warn_str="⚠️ $warn"
    fi

    echo "| $idx | $name | $compile_str | $assemble_str | $vice_str | $warn_str |"
  done

  echo ""
}

# ---------------------------------------------------------------------------
# _write_cross_program_analysis() — Analyze common patterns across tests
#
# Scans all test output directories for common warnings, size regressions,
# and failure patterns. Groups them by category.
#
# Arguments:
#   $1 — Batch output directory (to scan for summary.txt files)
# ---------------------------------------------------------------------------
_write_cross_program_analysis() {
  local batch_output="$1"

  cat <<EOF
---

## Cross-Program Analysis

EOF

  # --- Size Regressions ---
  echo "### Size Regressions"
  echo ""

  local has_regressions=0
  for i in "${!BATCH_TESTS[@]}"; do
    local reg="${BATCH_SIZE_REGRESSIONS[$i]:-0}"
    # Ensure reg is a clean integer (guard against multi-line values)
    reg="${reg%%[^0-9]*}"
    [[ -z "$reg" ]] && reg=0
    if [[ "$reg" -gt 0 ]]; then
      has_regressions=1
      break
    fi
  done

  if [[ "$has_regressions" -eq 1 ]]; then
    echo "| Test | Regressions | Details |"
    echo "|------|-------------|---------|"

    for i in "${!BATCH_TESTS[@]}"; do
      local name="${BATCH_TEST_NAMES[$i]}"
      local reg="${BATCH_SIZE_REGRESSIONS[$i]:-0}"

      if [[ "$reg" -gt 0 ]]; then
        # Try to extract regression details from the test's summary
        local detail=""
        local test_summary="$batch_output/$name/summary.txt"
        if [[ -f "$test_summary" ]]; then
          detail=$(grep "SIZE REGRESSION" "$test_summary" 2>/dev/null | head -3 | sed 's/^[[:space:]]*//' | tr '\n' '; ')
        fi
        echo "| $name | $reg | ${detail:-see summary} |"
      fi
    done
  else
    echo "✅ No size regressions detected across any test program."
  fi
  echo ""

  # --- Common Warnings ---
  echo "### Common Warnings"
  echo ""

  if [[ -d "$batch_output" ]]; then
    # Collect all warnings from all summary files and count occurrences
    local warning_tmp
    warning_tmp=$(mktemp)

    find "$batch_output" -name "summary.txt" -exec grep "⚠" {} \; 2>/dev/null | \
      sed 's/^[[:space:]]*//' | \
      sort | uniq -c | sort -rn > "$warning_tmp"

    if [[ -s "$warning_tmp" ]]; then
      echo "| Count | Warning Pattern |"
      echo "|-------|-----------------|"
      while IFS= read -r line; do
        local count pattern
        count=$(echo "$line" | awk '{print $1}')
        pattern=$(echo "$line" | sed 's/^[[:space:]]*[0-9]*[[:space:]]*//')
        echo "| $count | $pattern |"
      done < "$warning_tmp"
    else
      echo "✅ No warnings found across any test program."
    fi

    rm -f "$warning_tmp"
  else
    echo "No output directory available for analysis."
  fi
  echo ""

  # --- VICE Failure Summary ---
  local vice_failures=0
  for i in "${!BATCH_TESTS[@]}"; do
    if [[ "${BATCH_VICE_STATUS[$i]:-skip}" == "fail" ]]; then
      vice_failures=$((vice_failures + 1))
    fi
  done

  if [[ "$vice_failures" -gt 0 ]]; then
    echo "### VICE Verification Failures"
    echo ""
    echo "| Test | VICE Result | Details |"
    echo "|------|-------------|---------|"

    for i in "${!BATCH_TESTS[@]}"; do
      if [[ "${BATCH_VICE_STATUS[$i]:-skip}" == "fail" ]]; then
        local name="${BATCH_TEST_NAMES[$i]}"
        local detail="${BATCH_VICE_DETAIL[$i]:-unknown}"
        echo "| $name | ❌ FAIL | $detail |"
      fi
    done
    echo ""
  fi

  # --- Compilation Failures ---
  local compile_failures=0
  for i in "${!BATCH_TESTS[@]}"; do
    local bp="${BATCH_BLEND_PASS[$i]:-0}"
    local bt="${BATCH_BLEND_TOTAL[$i]:-0}"
    if [[ "$bp" -lt "$bt" && "$bt" -gt 0 ]]; then
      compile_failures=$((compile_failures + 1))
    fi
  done

  if [[ "$compile_failures" -gt 0 ]]; then
    echo "### Compilation Failures"
    echo ""
    echo "| Test | Pass/Total | Notes |"
    echo "|------|------------|-------|"

    for i in "${!BATCH_TESTS[@]}"; do
      local bp="${BATCH_BLEND_PASS[$i]:-0}"
      local bt="${BATCH_BLEND_TOTAL[$i]:-0}"
      if [[ "$bp" -lt "$bt" && "$bt" -gt 0 ]]; then
        local name="${BATCH_TEST_NAMES[$i]}"
        echo "| $name | $bp/$bt | See $name/blend65.log |"
      fi
    done
    echo ""
  fi
}

# ---------------------------------------------------------------------------
# _write_size_comparison() — Write O0 vs O3 size comparison table
#
# Shows how effective the optimizer is across all test programs by
# comparing the unoptimized (O0) and fully optimized (O3) PRG sizes.
# ---------------------------------------------------------------------------
_write_size_comparison() {
  cat <<EOF
---

## Size Comparison (O0 vs O3)

| Test | O0 Size | O3 Size | Delta | Change |
|------|---------|---------|-------|--------|
EOF

  for i in "${!BATCH_TESTS[@]}"; do
    local name="${BATCH_TEST_NAMES[$i]}"
    local o0="${BATCH_O0_PRG_SIZE[$i]:-0}"
    local o3="${BATCH_O3_PRG_SIZE[$i]:-0}"

    if [[ "$o0" -eq 0 && "$o3" -eq 0 ]]; then
      echo "| $name | — | — | — | — |"
      continue
    fi

    local o0_str="${o0} B"
    local o3_str="${o3} B"

    if [[ "$o0" -eq 0 ]]; then
      o0_str="—"
    fi
    if [[ "$o3" -eq 0 ]]; then
      o3_str="—"
    fi

    # Calculate delta
    local delta_str="—"
    local change_str="—"
    if [[ "$o0" -gt 0 && "$o3" -gt 0 ]]; then
      local delta=$((o3 - o0))
      if [[ "$delta" -lt 0 ]]; then
        delta_str="${delta} B"
        change_str="✅ smaller"
      elif [[ "$delta" -eq 0 ]]; then
        delta_str="0 B"
        change_str="= same"
      else
        delta_str="+${delta} B"
        change_str="⚠️ LARGER"
      fi
    fi

    echo "| $name | $o0_str | $o3_str | $delta_str | $change_str |"
  done

  echo ""
}

# ---------------------------------------------------------------------------
# _write_report_footer() — Write the closing section of the report
# ---------------------------------------------------------------------------
_write_report_footer() {
  cat <<EOF
---

## Overall Result

EOF

  if [[ "$BATCH_TOTAL_FAIL" -eq 0 ]]; then
    echo "✅ **ALL $BATCH_TEST_COUNT TESTS PASSED** — No compilation, assembly, or runtime failures."
  else
    echo "❌ **$BATCH_TOTAL_FAIL / $BATCH_TEST_COUNT tests FAILED** — See details above."
  fi

  echo ""
  echo "---"
  echo ""
  echo "*Report generated by \`diag_batch.sh\` on $(batch_timestamp)*"
}

# ---------------------------------------------------------------------------
# print_batch_summary() — Print a brief terminal summary after all tests
#
# Displays a compact summary of batch results to the terminal, separate
# from the full markdown report file.
#
# Arguments: None (uses global BATCH_* counters)
# ---------------------------------------------------------------------------
print_batch_summary() {
  batch_header "Batch Results Summary"

  echo -e "  ${BATCH_BOLD}Tests Run:${BATCH_NC}    $BATCH_TEST_COUNT"
  echo -e "  ${BATCH_GREEN}Passed:${BATCH_NC}       $BATCH_TOTAL_PASS"
  echo -e "  ${BATCH_RED}Failed:${BATCH_NC}       $BATCH_TOTAL_FAIL"
  echo ""

  # List failed tests
  if [[ "$BATCH_TOTAL_FAIL" -gt 0 ]]; then
    echo -e "  ${BATCH_RED}${BATCH_BOLD}Failed tests:${BATCH_NC}"
    for i in "${!BATCH_TESTS[@]}"; do
      local diag="${BATCH_DIAG_EXIT[$i]:-0}"
      local vice="${BATCH_VICE_STATUS[$i]:-skip}"
      if [[ "$diag" -ne 0 || "$vice" == "fail" ]]; then
        local name="${BATCH_TEST_NAMES[$i]}"
        local reasons=""
        if [[ "$diag" -ne 0 ]]; then
          reasons="compile/assemble"
        fi
        if [[ "$vice" == "fail" ]]; then
          [[ -n "$reasons" ]] && reasons+=", "
          reasons+="VICE"
        fi
        echo -e "    ${BATCH_RED}❌ $name${BATCH_NC} ($reasons)"
      fi
    done
    echo ""
  fi
}
