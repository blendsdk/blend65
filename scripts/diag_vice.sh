#!/usr/bin/env bash
# =============================================================================
# diag_vice.sh — VICE Runtime Verification for Blend65 Diagnostics
# =============================================================================
#
# Runs a compiled PRG file in the VICE C64 emulator, dumps memory and
# registers, and compares runtime state against expected values from a
# JSON specification file.
#
# This is the most impactful diagnostic tool: it verifies ACTUAL runtime
# behavior, catching bugs that static analysis cannot detect.
#
# Usage:
#   ./scripts/diag_vice.sh <prg-file> <expected.json> [output-dir] [cycles]
#
# Arguments:
#   <prg-file>        Path to the .prg file to run in VICE
#   <expected.json>   Path to expected values JSON file
#   [output-dir]      Output directory (default: alongside prg-file)
#   [cycles]          Cycle limit (default: 10000000 = ~10 sec at 1MHz)
#
# Optional:
#   --labels <file>   Path to ACME label file (to find main address)
#   --help            Show this help text
#
# Examples:
#   ./scripts/diag_vice.sh build/diag/border/O0/output.prg examples/border-cycle/expected.json
#   ./scripts/diag_vice.sh output.prg expected.json build/vice-test 15000000
#   ./scripts/diag_vice.sh output.prg expected.json --labels output.labels
#
# Exit Codes:
#   0 — All verification checks passed
#   1 — One or more verification checks failed
#   2 — Invalid arguments or missing dependencies
#   3 — VICE not available
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve script directory and source modules
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/vice/env.sh"
source "$SCRIPT_DIR/vice/mon.sh"
source "$SCRIPT_DIR/vice/run.sh"
source "$SCRIPT_DIR/vice/verify.sh"

# ---------------------------------------------------------------------------
# Argument Parsing
# ---------------------------------------------------------------------------

show_help() {
  echo "Usage: ./scripts/diag_vice.sh <prg-file> <expected.json> [output-dir] [cycles]"
  echo ""
  echo "Arguments:"
  echo "  <prg-file>        Path to the .prg file to run in VICE"
  echo "  <expected.json>   Path to expected values JSON file"
  echo "  [output-dir]      Output directory (default: alongside prg-file)"
  echo "  [cycles]          Cycle limit (default: 10000000)"
  echo ""
  echo "Options:"
  echo "  --labels <file>   Path to ACME label file (for main address)"
  echo "  --help            Show this help text"
  echo ""
  echo "Expected JSON format:"
  echo "  See plans/diag-app-improvements/05-vice-integration.md"
}

# Parse arguments
PRG_FILE=""
EXPECTED_JSON=""
OUTPUT_DIR=""
CYCLES=""
LABELS_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      show_help
      exit 0
      ;;
    --labels)
      LABELS_FILE="$2"
      shift 2
      ;;
    *)
      # Positional arguments in order: prg, json, output-dir, cycles
      if [[ -z "$PRG_FILE" ]]; then
        PRG_FILE="$1"
      elif [[ -z "$EXPECTED_JSON" ]]; then
        EXPECTED_JSON="$1"
      elif [[ -z "$OUTPUT_DIR" ]]; then
        OUTPUT_DIR="$1"
      elif [[ -z "$CYCLES" ]]; then
        CYCLES="$1"
      fi
      shift
      ;;
  esac
done

# Validate required arguments
if [[ -z "$PRG_FILE" || -z "$EXPECTED_JSON" ]]; then
  echo -e "${VICE_RED}Error: Missing required arguments${VICE_NC}"
  echo ""
  show_help
  exit 2
fi

if [[ ! -f "$PRG_FILE" ]]; then
  echo -e "${VICE_RED}Error: PRG file not found: $PRG_FILE${VICE_NC}"
  exit 2
fi

if [[ ! -f "$EXPECTED_JSON" ]]; then
  echo -e "${VICE_RED}Error: Expected JSON not found: $EXPECTED_JSON${VICE_NC}"
  exit 2
fi

# Validate JSON syntax
if ! jq empty "$EXPECTED_JSON" 2>/dev/null; then
  echo -e "${VICE_RED}Error: Invalid JSON in $EXPECTED_JSON${VICE_NC}"
  exit 2
fi

# Default output directory: same directory as PRG file
if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="$(dirname "$PRG_FILE")/vice"
fi

# Default cycles from JSON or fallback
if [[ -z "$CYCLES" ]]; then
  CYCLES=$(jq -r '.cycles // empty' "$EXPECTED_JSON" 2>/dev/null || true)
  if [[ -z "$CYCLES" ]]; then
    CYCLES="$VICE_DEFAULT_CYCLES"
  fi
fi

# Auto-detect label file if not provided
if [[ -z "$LABELS_FILE" ]]; then
  # Look for output.labels alongside the PRG file
  local_labels="$(dirname "$PRG_FILE")/output.labels"
  if [[ -f "$local_labels" ]]; then
    LABELS_FILE="$local_labels"
  fi
fi

# Make all paths absolute — VICE execution changes CWD, so relative paths break
PRG_FILE="$(cd "$(dirname "$PRG_FILE")" && pwd)/$(basename "$PRG_FILE")"
EXPECTED_JSON="$(cd "$(dirname "$EXPECTED_JSON")" && pwd)/$(basename "$EXPECTED_JSON")"
if [[ -n "$LABELS_FILE" && -f "$LABELS_FILE" ]]; then
  LABELS_FILE="$(cd "$(dirname "$LABELS_FILE")" && pwd)/$(basename "$LABELS_FILE")"
fi
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"

# ---------------------------------------------------------------------------
# Dependency Checks
# ---------------------------------------------------------------------------

if ! command -v jq &> /dev/null; then
  echo -e "${VICE_RED}Error: jq not found — required for JSON parsing${VICE_NC}"
  echo "Install: brew install jq"
  exit 2
fi

if ! command -v xxd &> /dev/null; then
  echo -e "${VICE_RED}Error: xxd not found — required for binary dump reading${VICE_NC}"
  exit 2
fi

# ---------------------------------------------------------------------------
# Detect VICE
# ---------------------------------------------------------------------------

if ! detect_vice; then
  echo -e "${VICE_RED}Error: VICE emulator (x64sc) not found${VICE_NC}"
  echo "Expected at: /Users/gevik/workdir/vice/VICE.app/Contents/Resources/bin/x64sc"
  echo "Or install VICE and ensure x64sc is in PATH"
  exit 3
fi

# ---------------------------------------------------------------------------
# Main Execution
# ---------------------------------------------------------------------------

echo ""
echo -e "${VICE_BOLD}${VICE_CYAN}╔═══════════════════════════════════════════════════════════════╗${VICE_NC}"
echo -e "${VICE_BOLD}${VICE_CYAN}║          VICE Runtime Verification — diag_vice.sh            ║${VICE_NC}"
echo -e "${VICE_BOLD}${VICE_CYAN}╚═══════════════════════════════════════════════════════════════╝${VICE_NC}"
echo ""
echo -e "  ${VICE_BOLD}PRG File:${VICE_NC}      $PRG_FILE"
echo -e "  ${VICE_BOLD}Expected:${VICE_NC}      $EXPECTED_JSON"
echo -e "  ${VICE_BOLD}Output Dir:${VICE_NC}    $OUTPUT_DIR"
echo -e "  ${VICE_BOLD}Cycles:${VICE_NC}        $CYCLES"
echo -e "  ${VICE_BOLD}Labels:${VICE_NC}        ${LABELS_FILE:-<none>}"
echo -e "  ${VICE_BOLD}VICE:${VICE_NC}          $VICE_BIN"

# Prepare output directory
mkdir -p "$OUTPUT_DIR"

# Track overall pass/fail
TOTAL_PASS=0
TOTAL_FAIL=0

# ---------------------------------------------------------------------------
# Step 1: Determine break address from labels or expected.json
# ---------------------------------------------------------------------------

vice_header "Step 1: Determine break address"

BREAK_ADDR=""

# Try label file first — look for 'main' symbol
if [[ -n "$LABELS_FILE" && -f "$LABELS_FILE" ]]; then
  BREAK_ADDR=$(parse_label_address "$LABELS_FILE" "main") || true
  if [[ -n "$BREAK_ADDR" ]]; then
    vice_ok "Break address from labels: main = \$$BREAK_ADDR"
  fi
fi

# Fall back to expected.json break_address field
if [[ -z "$BREAK_ADDR" ]]; then
  BREAK_ADDR=$(jq -r '.break_address // empty' "$EXPECTED_JSON" 2>/dev/null || true)
  if [[ -n "$BREAK_ADDR" ]]; then
    vice_ok "Break address from expected.json: \$$BREAK_ADDR"
  fi
fi

# If still no address, warn and proceed without -initbreak
if [[ -z "$BREAK_ADDR" ]]; then
  vice_warn "No break address found — moncommands will run at VICE startup"
  vice_info "For post-execution dumps, provide --labels or add break_address to JSON"
fi

# ---------------------------------------------------------------------------
# Step 2: Check for completion sentinel (alternative to -initbreak)
# ---------------------------------------------------------------------------

SENTINEL_ADDR=""
SENTINEL_ADDR=$(jq -r '.completion_sentinel.address // empty' "$EXPECTED_JSON" 2>/dev/null || true)

if [[ -n "$SENTINEL_ADDR" ]]; then
  vice_info "Completion sentinel: \$$SENTINEL_ADDR"
fi

# ---------------------------------------------------------------------------
# Step 3: Generate monitor script
# ---------------------------------------------------------------------------

vice_header "Step 2: Generate monitor script"

MON_FILE="$OUTPUT_DIR/verify.mon"

if [[ -n "$SENTINEL_ADDR" ]]; then
  # Sentinel approach: watch store → g → save → quit
  # Preferred when completion_sentinel is defined, regardless of break_addr.
  # With -initbreak, moncommands are deferred until main entry, then:
  #   watch store $XXXX → g (continue) → program runs → sentinel write → dumps
  generate_mon_with_sentinel "$MON_FILE" "$SENTINEL_ADDR" > /dev/null
  vice_ok "Generated sentinel-based monitor script: $MON_FILE"
else
  # Standard approach: -initbreak defers moncommands, dumps at break address.
  # Used when no sentinel is defined (e.g., border-cycle with break_address).
  generate_mon_script "$MON_FILE" > /dev/null
  vice_ok "Generated monitor script: $MON_FILE"
fi

# ---------------------------------------------------------------------------
# Step 4: Run VICE
# ---------------------------------------------------------------------------

vice_header "Step 3: Run VICE"

vice_info "Launching VICE with $CYCLES cycles..."

VICE_EXIT=0

# When using sentinel approach, do NOT pass break_addr to run_vice.
# Without -initbreak, moncommands execute at VICE startup:
#   watch store $XXXX → g → (KERNAL boots, program runs) → sentinel write
#   → watchpoint fires → monitor re-enters → saves execute → quit
# With -initbreak, moncommands run at the break point and `g` causes the
# remaining commands (saves) to be discarded because `g` exits the monitor.
if [[ -n "$SENTINEL_ADDR" ]]; then
  run_vice "$PRG_FILE" "$MON_FILE" "$OUTPUT_DIR" "" "$CYCLES" || VICE_EXIT=$?
else
  run_vice "$PRG_FILE" "$MON_FILE" "$OUTPUT_DIR" "$BREAK_ADDR" "$CYCLES" || VICE_EXIT=$?
fi

case "$VICE_EXIT" in
  0)
    vice_ok "VICE exited cleanly (monitor quit)"
    ;;
  1)
    vice_warn "VICE cycle limit reached — program may not have completed"
    vice_info "Consider increasing cycles (current: $CYCLES)"
    ;;
  2)
    vice_fail "VICE execution error — check $OUTPUT_DIR/vice.log"
    exit 1
    ;;
  *)
    vice_warn "VICE exited with code $VICE_EXIT"
    ;;
esac

# Check for screenshot
if [[ -f "$OUTPUT_DIR/screenshot.png" ]]; then
  local_size=$(wc -c < "$OUTPUT_DIR/screenshot.png" | tr -d ' ')
  vice_ok "Screenshot captured ($local_size bytes)"
fi

# ---------------------------------------------------------------------------
# Step 5: Verify dump files exist
# ---------------------------------------------------------------------------

vice_header "Step 4: Verify dump files"

dump_missing=0
verify_dump_files "$OUTPUT_DIR" || dump_missing=$?

if [[ "$dump_missing" -gt 0 ]]; then
  vice_fail "$dump_missing dump files missing — VICE may not have reached break address"
  if [[ "$VICE_EXIT" -eq 1 ]]; then
    vice_info "Hint: cycle limit was reached. Increase cycles or check break address."
  fi
fi

# ---------------------------------------------------------------------------
# Step 6: Verify memory checks
# ---------------------------------------------------------------------------

mem_fail=0
verify_memory_checks "$EXPECTED_JSON" "$OUTPUT_DIR" || mem_fail=$?
TOTAL_FAIL=$((TOTAL_FAIL + mem_fail))

# Count passes from results file
if [[ -f "$OUTPUT_DIR/memory-results.txt" ]]; then
  mem_pass=$(grep '^memory_pass=' "$OUTPUT_DIR/memory-results.txt" | cut -d= -f2 || echo "0")
  TOTAL_PASS=$((TOTAL_PASS + mem_pass))
fi

# ---------------------------------------------------------------------------
# Step 7: Verify screen checks (if defined)
# ---------------------------------------------------------------------------

screen_count=$(jq '.screen_checks | length' "$EXPECTED_JSON" 2>/dev/null || echo "0")
if [[ "$screen_count" -gt 0 ]]; then
  screen_fail=0
  verify_screen_checks "$EXPECTED_JSON" "$OUTPUT_DIR" || screen_fail=$?
  TOTAL_FAIL=$((TOTAL_FAIL + screen_fail))
  TOTAL_PASS=$((TOTAL_PASS + (screen_count - screen_fail)))
fi

# ---------------------------------------------------------------------------
# Step 8: Verify registers
# ---------------------------------------------------------------------------

reg_fail=0
verify_registers "$OUTPUT_DIR/monitor.log" "$EXPECTED_JSON" "$OUTPUT_DIR" || reg_fail=$?
TOTAL_FAIL=$((TOTAL_FAIL + reg_fail))

# Count register passes (stack + pc checks)
if [[ -f "$OUTPUT_DIR/register-results.txt" ]]; then
  if grep -q 'stack_check=PASS' "$OUTPUT_DIR/register-results.txt" 2>/dev/null; then
    TOTAL_PASS=$((TOTAL_PASS + 1))
  fi
  if grep -q 'pc_check=PASS' "$OUTPUT_DIR/register-results.txt" 2>/dev/null; then
    TOTAL_PASS=$((TOTAL_PASS + 1))
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

TOTAL_CHECKS=$((TOTAL_PASS + TOTAL_FAIL))

echo ""
echo -e "${VICE_BOLD}${VICE_CYAN}════════════════════════════════════════════════════════════${VICE_NC}"
echo -e "${VICE_BOLD}${VICE_CYAN}  VICE Verification Summary${VICE_NC}"
echo -e "${VICE_BOLD}${VICE_CYAN}════════════════════════════════════════════════════════════${VICE_NC}"
echo ""

# Write summary to file
SUMMARY_FILE="$OUTPUT_DIR/vice-summary.txt"
{
  echo "VICE Verification Summary"
  echo "========================="
  echo "PRG:       $PRG_FILE"
  echo "Expected:  $EXPECTED_JSON"
  echo "Cycles:    $CYCLES"
  echo "VICE Exit: $VICE_EXIT"
  echo ""
  echo "Results: $TOTAL_PASS/$TOTAL_CHECKS passed, $TOTAL_FAIL failed"
  echo ""
  if [[ "$TOTAL_FAIL" -eq 0 ]]; then
    echo "VERDICT: ✅ ALL CHECKS PASSED"
  else
    echo "VERDICT: ❌ $TOTAL_FAIL CHECK(S) FAILED"
  fi
} > "$SUMMARY_FILE"

if [[ "$TOTAL_FAIL" -eq 0 ]]; then
  echo -e "  ${VICE_GREEN}${VICE_BOLD}✅ ALL CHECKS PASSED ($TOTAL_PASS/$TOTAL_CHECKS)${VICE_NC}"
  echo ""
  echo -e "  ${VICE_GRAY}Output: $OUTPUT_DIR${VICE_NC}"
  exit 0
else
  echo -e "  ${VICE_RED}${VICE_BOLD}❌ $TOTAL_FAIL CHECK(S) FAILED ($TOTAL_PASS/$TOTAL_CHECKS passed)${VICE_NC}"
  echo ""
  echo -e "  ${VICE_GRAY}Output: $OUTPUT_DIR${VICE_NC}"
  echo -e "  ${VICE_YELLOW}Review dump files and monitor.log for details${VICE_NC}"
  exit 1
fi
