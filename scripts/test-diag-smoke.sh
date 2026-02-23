#!/usr/bin/env bash
# =============================================================================
# test-diag-smoke.sh — Smoke Test for Diagnostic Tool Infrastructure
# =============================================================================
#
# Verifies that all diagnostic scripts work end-to-end:
#   1. diag_app.sh — Single-program compile+assemble+analyze
#   2. diag_vice.sh — VICE runtime verification (if VICE available)
#   3. diag_batch.sh — Batch mode with 3 test programs
#
# Usage:
#   ./scripts/test-diag-smoke.sh
#
# Exit Codes:
#   0 — All smoke tests passed
#   1 — One or more tests failed
#
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

header() {
  echo ""
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════${NC}"
  echo ""
}

pass() {
  echo -e "  ${GREEN}✅ PASS: $1${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "  ${RED}❌ FAIL: $1${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

skip() {
  echo -e "  ${YELLOW}⏭️  SKIP: $1${NC}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

# ---------------------------------------------------------------------------
# Pre-check: Build compiler once
# ---------------------------------------------------------------------------
header "Pre-check: Building compiler"

if yarn build > /dev/null 2>&1; then
  pass "Compiler built successfully"
else
  fail "Compiler build failed — cannot continue"
  exit 1
fi

SMOKE_DIR="build/diag/smoke-test"
rm -rf "$SMOKE_DIR"

# ---------------------------------------------------------------------------
# Test 1: diag_app.sh — Single program diagnostic
# ---------------------------------------------------------------------------
header "Test 1: diag_app.sh (single program)"

DIAG_OUT="$SMOKE_DIR/border-cycle"
BLEND65_SKIP_BUILD=1 ./scripts/diag_app.sh examples/border-cycle/main.blend "$DIAG_OUT" > /dev/null 2>&1 || true

# Check key outputs exist
if [[ -f "$DIAG_OUT/summary.txt" ]]; then
  pass "summary.txt generated"
else
  fail "summary.txt missing"
fi

if [[ -f "$DIAG_OUT/O0/output.asm" ]]; then
  pass "O0/output.asm generated"
else
  fail "O0/output.asm missing"
fi

if [[ -f "$DIAG_OUT/O0/output.prg" ]]; then
  pass "O0/output.prg generated"
else
  fail "O0/output.prg missing"
fi

if [[ -f "$DIAG_OUT/O0/output.labels" ]]; then
  pass "O0/output.labels generated"
else
  fail "O0/output.labels missing"
fi

if [[ -f "$DIAG_OUT/O0/output-debug.asm" ]]; then
  pass "O0/output-debug.asm generated"
else
  fail "O0/output-debug.asm missing"
fi

if [[ -d "$DIAG_OUT/analysis" ]]; then
  pass "analysis/ directory generated"
else
  fail "analysis/ directory missing"
fi

if [[ -f "$DIAG_OUT/label-map.txt" ]]; then
  pass "label-map.txt generated"
else
  fail "label-map.txt missing"
fi

# Check that summary contains metrics table
if grep -q "Assembly Metrics" "$DIAG_OUT/summary.txt" 2>/dev/null; then
  pass "Summary contains Assembly Metrics section"
else
  fail "Summary missing Assembly Metrics section"
fi

# Check that VICE verification ran (border-cycle has expected.json)
if [[ -d "$DIAG_OUT/O0/vice" ]]; then
  pass "VICE verification directory created"
  if [[ -f "$DIAG_OUT/O0/vice/vice-summary.txt" ]]; then
    pass "VICE summary generated"
  else
    skip "VICE summary missing (VICE may not be available)"
  fi
else
  skip "VICE verification skipped (VICE not available)"
fi

# ---------------------------------------------------------------------------
# Test 2: diag_analyze_asm.sh — Standalone metrics
# ---------------------------------------------------------------------------
header "Test 2: diag_analyze_asm.sh (standalone)"

METRICS_OUT="$SMOKE_DIR/test-metrics.txt"
if [[ -f "$DIAG_OUT/O0/output.asm" ]]; then
  bash ./scripts/diag_analyze_asm.sh metrics "$DIAG_OUT/O0/output.asm" "$METRICS_OUT"
  if grep -q "jsr=" "$METRICS_OUT" 2>/dev/null; then
    pass "Metrics extraction works (JSR count found)"
  else
    fail "Metrics extraction failed — no JSR count"
  fi

  STACK_OUT="$SMOKE_DIR/test-stack.txt"
  bash ./scripts/diag_analyze_asm.sh stack "$DIAG_OUT/O0/output.asm" "$STACK_OUT"
  if grep -q "stack_imbalances=" "$STACK_OUT" 2>/dev/null; then
    pass "Stack balance check works"
  else
    fail "Stack balance check failed"
  fi

  REDUN_OUT="$SMOKE_DIR/test-redun.txt"
  bash ./scripts/diag_analyze_asm.sh redundancies "$DIAG_OUT/O0/output.asm" "$REDUN_OUT"
  if grep -q "redundancies=" "$REDUN_OUT" 2>/dev/null; then
    pass "Redundancy detection works"
  else
    fail "Redundancy detection failed"
  fi
else
  skip "No O0/output.asm — skipping analyze tests"
fi

# ---------------------------------------------------------------------------
# Test 3: diag_batch.sh — Batch mode (3 test programs)
# ---------------------------------------------------------------------------
header "Test 3: diag_batch.sh (batch mode — first 3 tests)"

BATCH_OUT="$SMOKE_DIR/batch"
# Run batch on first 3 test programs only (fast)
BATCH_DIR=$(mktemp -d)
cp -r examples/test-suite/01-byte-arithmetic "$BATCH_DIR/"
cp -r examples/test-suite/03-bitwise-ops "$BATCH_DIR/"
cp -r examples/test-suite/06-memory-ops "$BATCH_DIR/"

BLEND65_SKIP_BUILD=1 ./scripts/diag_batch.sh "$BATCH_DIR" "$BATCH_OUT" > /dev/null 2>&1 || true

if [[ -f "$BATCH_OUT/batch-report.md" ]]; then
  pass "batch-report.md generated"
else
  fail "batch-report.md missing"
fi

if [[ -f "$BATCH_OUT/batch-summary.txt" ]]; then
  pass "batch-summary.txt generated"
else
  fail "batch-summary.txt missing"
fi

# Check that at least one test output exists
if [[ -d "$BATCH_OUT/01-byte-arithmetic" ]]; then
  pass "Per-test output directory created (01-byte-arithmetic)"
else
  fail "Per-test output directory missing"
fi

# Cleanup temp directory
rm -rf "$BATCH_DIR"

# ---------------------------------------------------------------------------
# Final Report
# ---------------------------------------------------------------------------
header "Smoke Test Results"

TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))
echo -e "  ${GREEN}Passed:${NC}  $PASS_COUNT"
echo -e "  ${RED}Failed:${NC}  $FAIL_COUNT"
echo -e "  ${YELLOW}Skipped:${NC} $SKIP_COUNT"
echo -e "  ${BOLD}Total:${NC}   $TOTAL"
echo ""

if [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✅ All smoke tests passed!${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}❌ $FAIL_COUNT smoke test(s) failed.${NC}"
  exit 1
fi
