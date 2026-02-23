#!/usr/bin/env bash
# =============================================================================
# diag_batch.sh — Batch Diagnostic Runner for Blend65
# =============================================================================
#
# Runs diag_app.sh (and optionally diag_vice.sh) across multiple Blend test
# programs in a suite directory. Produces a central markdown report with
# per-test results and cross-program analysis.
#
# This is the top-level orchestrator — delegates to modular scripts in
# scripts/batch/ for discovery, execution, and reporting.
#
# Usage:
#   ./scripts/diag_batch.sh <suite-dir> [output-dir]
#
# Arguments:
#   <suite-dir>    Directory containing test programs (each in a subfolder)
#   [output-dir]   Output directory (default: build/diag/batch/)
#
# Examples:
#   ./scripts/diag_batch.sh examples/
#   ./scripts/diag_batch.sh examples/ build/diag/batch-test
#   ./scripts/diag_batch.sh examples/test-suite/
#
# Output:
#   <output-dir>/
#   ├── <test-name>/       # Per-test diag_app.sh output
#   │   ├── summary.txt
#   │   ├── O0/ O1/ ...
#   │   └── ...
#   ├── batch-report.md    # Central markdown report
#   └── batch-summary.txt  # Plain-text summary
#
# Exit Codes:
#   0 — All tests passed
#   1 — One or more tests failed
#   2 — Invalid arguments or missing dependencies
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve script directory and source modules
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/batch/env.sh"
source "$SCRIPT_DIR/batch/discover.sh"
source "$SCRIPT_DIR/batch/runner.sh"
source "$SCRIPT_DIR/batch/report.sh"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

# Handle --help flag
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: ./scripts/diag_batch.sh <suite-dir> [output-dir]"
  echo ""
  echo "Arguments:"
  echo "  <suite-dir>    Directory containing test programs (subfolders with main.blend)"
  echo "  [output-dir]   Output directory (default: build/diag/batch/)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/diag_batch.sh examples/"
  echo "  ./scripts/diag_batch.sh examples/ build/diag/batch-test"
  echo "  ./scripts/diag_batch.sh examples/test-suite/"
  echo ""
  echo "Each subfolder in <suite-dir> should contain:"
  echo "  main.blend      — Entry file (required)"
  echo "  expected.json   — VICE verification spec (optional)"
  echo ""
  echo "Output:"
  echo "  <output-dir>/batch-report.md   — Central markdown report"
  echo "  <output-dir>/<test>/           — Per-test diagnostic output"
  exit 0
fi

# Validate required argument
if [[ $# -lt 1 ]]; then
  echo -e "${BATCH_RED}Error: Missing required argument <suite-dir>${BATCH_NC}"
  echo ""
  echo "Usage: ./scripts/diag_batch.sh <suite-dir> [output-dir]"
  echo "Run with --help for full usage information."
  exit 2
fi

SUITE_DIR="$1"
OUTPUT_DIR="${2:-$BATCH_DEFAULT_OUTPUT}"

# Validate suite directory exists
if [[ ! -d "$SUITE_DIR" ]]; then
  echo -e "${BATCH_RED}Error: Suite directory not found: $SUITE_DIR${BATCH_NC}"
  exit 2
fi

# Validate diag_app.sh exists
if [[ ! -f "$DIAG_APP_SCRIPT" ]]; then
  echo -e "${BATCH_RED}Error: diag_app.sh not found at $DIAG_APP_SCRIPT${BATCH_NC}"
  echo "Run from the project root directory."
  exit 2
fi

# ---------------------------------------------------------------------------
# Step 1: Setup
# ---------------------------------------------------------------------------

batch_header "Blend65 Batch Diagnostic Runner"

echo -e "  ${BATCH_BOLD}Suite Dir:${BATCH_NC}    $SUITE_DIR"
echo -e "  ${BATCH_BOLD}Output Dir:${BATCH_NC}   $OUTPUT_DIR"
echo ""

# Clean and recreate output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Make output dir absolute (runner.sh may change directories)
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"

# ---------------------------------------------------------------------------
# Step 1b: Build compiler once (shared across all tests)
# ---------------------------------------------------------------------------

batch_subheader "Building compiler (once for all tests)"

BUILD_LOG="$OUTPUT_DIR/build.log"
if yarn build > "$BUILD_LOG" 2>&1; then
  batch_ok "Compiler built successfully"
else
  batch_fail "Compiler build failed — see $BUILD_LOG"
  cat "$BUILD_LOG"
  exit 1
fi

# Tell diag_app.sh to skip its own build step (we already built)
export BLEND65_SKIP_BUILD=1

echo ""

# ---------------------------------------------------------------------------
# Step 2: Discover test programs
# ---------------------------------------------------------------------------

batch_header "Step 1: Discovering test programs"

if ! discover_tests "$SUITE_DIR"; then
  exit 2
fi

print_discovered_tests

# ---------------------------------------------------------------------------
# Step 3: Execute all tests
# ---------------------------------------------------------------------------

batch_header "Step 2: Running diagnostics"

BATCH_START_TIME=$(date +%s)

all_pass=0
run_all_tests "$OUTPUT_DIR" || all_pass=$?

BATCH_END_TIME=$(date +%s)
BATCH_ELAPSED=$((BATCH_END_TIME - BATCH_START_TIME))

echo ""
batch_info "Batch execution completed in ${BATCH_ELAPSED}s"

# ---------------------------------------------------------------------------
# Step 4: Generate reports
# ---------------------------------------------------------------------------

batch_header "Step 3: Generating reports"

REPORT_FILE="$OUTPUT_DIR/batch-report.md"
SUMMARY_FILE="$OUTPUT_DIR/batch-summary.txt"

# Generate markdown report (pass output_dir as $3 for cross-program analysis)
generate_batch_report "$REPORT_FILE" "$SUITE_DIR" "$OUTPUT_DIR"

# Generate plain-text summary for quick reference
{
  echo "Blend65 Batch Diagnostic Summary"
  echo "================================"
  echo ""
  echo "Suite:    $SUITE_DIR"
  echo "Output:   $OUTPUT_DIR"
  echo "Time:     ${BATCH_ELAPSED}s"
  echo "Tests:    $BATCH_TEST_COUNT"
  echo "Passed:   $BATCH_TOTAL_PASS"
  echo "Failed:   $BATCH_TOTAL_FAIL"
  echo ""

  for i in "${!BATCH_TESTS[@]}"; do
    local_name="${BATCH_TEST_NAMES[$i]}"
    local_diag="${BATCH_DIAG_EXIT[$i]:-0}"
    local_vice="${BATCH_VICE_STATUS[$i]:-skip}"

    local_status="PASS"
    if [[ "$local_diag" -ne 0 || "$local_vice" == "fail" ]]; then
      local_status="FAIL"
    fi

    printf "  %-30s %s\n" "$local_name" "$local_status"
  done
} > "$SUMMARY_FILE"

batch_ok "Summary written to: $SUMMARY_FILE"

# ---------------------------------------------------------------------------
# Step 5: Print terminal summary
# ---------------------------------------------------------------------------

print_batch_summary

echo -e "  ${BATCH_BOLD}Report:${BATCH_NC}  $REPORT_FILE"
echo -e "  ${BATCH_BOLD}Output:${BATCH_NC}  $OUTPUT_DIR/"
echo ""

# ---------------------------------------------------------------------------
# Exit with appropriate code
# ---------------------------------------------------------------------------

if [[ "$all_pass" -eq 0 ]]; then
  echo -e "${BATCH_GREEN}${BATCH_BOLD}✅ All $BATCH_TEST_COUNT tests passed.${BATCH_NC}"
  exit 0
else
  echo -e "${BATCH_RED}${BATCH_BOLD}❌ $BATCH_TOTAL_FAIL/$BATCH_TEST_COUNT tests failed.${BATCH_NC}"
  exit 1
fi
