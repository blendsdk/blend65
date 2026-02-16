#!/usr/bin/env bash
# =============================================================================
# diag_app.sh — Blend65 Application Diagnostic Tool
# =============================================================================
#
# Compiles a Blend application at ALL 6 optimization levels and assembles
# each output with ACME. Captures all compiler and assembler output for
# AI-assisted diagnosis of compiler bugs, optimization regressions, and
# assembly errors.
#
# Usage:
#   ./scripts/diag_app.sh <entry-file> [output-dir]
#
# Arguments:
#   <entry-file>  Path to the main .blend source file (required)
#   [output-dir]  Output directory (default: build/diag/<basename>/)
#
# Examples:
#   ./scripts/diag_app.sh examples/spinning-line/main.blend
#   ./scripts/diag_app.sh examples/balloon-sprite/main.blend build/diag/balloon
#
# Output Structure:
#   <output-dir>/
#   ├── sources/              # Copy of all .blend source files
#   ├── O0/
#   │   ├── output.asm        # Blend compiler assembly output
#   │   ├── output-debug.asm  # With inline debug comments (O0 only)
#   │   ├── output.prg        # ACME assembled binary
#   │   ├── blend65.log       # Blend compiler stdout+stderr
#   │   └── acme.log          # ACME assembler stdout+stderr
#   ├── O1/ ... O2/ ... O3/ ... Os/ ... Oz/
#   ├── diffs/
#   │   ├── O0-vs-O1.diff    # Assembly diffs between optimization levels
#   │   ├── O0-vs-O2.diff
#   │   └── ...
#   └── summary.txt           # Pass/fail overview with file sizes
#
# Exit Codes:
#   0 — All compilations and assemblies succeeded
#   1 — One or more steps failed
#   2 — Invalid arguments or missing dependencies
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LEVELS=("O0" "O1" "O2" "O3" "Os" "Oz")
ACME_BIN="/usr/local/bin/acme"
ACME_FLAGS="--cpu 6510 --format cbm"
BLEND65_BIN="./packages/cli/bin/blend65.js"

# ANSI colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

# Print a styled header
header() {
  echo ""
  echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo ""
}

# Print a sub-header
subheader() {
  echo -e "${BOLD}── $1 ──${NC}"
}

# Print success message
ok() {
  echo -e "  ${GREEN}✅ $1${NC}"
}

# Print failure message
fail() {
  echo -e "  ${RED}❌ $1${NC}"
}

# Print info message
info() {
  echo -e "  ${GRAY}$1${NC}"
}

# Print warning message
warn() {
  echo -e "  ${YELLOW}⚠️  $1${NC}"
}

# Get file size in bytes (cross-platform)
filesize() {
  if [[ -f "$1" ]]; then
    wc -c < "$1" | tr -d ' '
  else
    echo "0"
  fi
}

# ---------------------------------------------------------------------------
# Argument Validation
# ---------------------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  echo -e "${RED}Error: Missing required argument <entry-file>${NC}"
  echo ""
  echo "Usage: ./scripts/diag_app.sh <entry-file> [output-dir]"
  echo ""
  echo "Examples:"
  echo "  ./scripts/diag_app.sh examples/spinning-line/main.blend"
  echo "  ./scripts/diag_app.sh examples/balloon-sprite/main.blend build/diag/balloon"
  exit 2
fi

ENTRY_FILE="$1"

if [[ ! -f "$ENTRY_FILE" ]]; then
  echo -e "${RED}Error: File not found: ${ENTRY_FILE}${NC}"
  exit 2
fi

# Derive application name from entry file (e.g., "spinning-line" from path)
APP_DIR=$(dirname "$ENTRY_FILE")
APP_NAME=$(basename "$APP_DIR")
ENTRY_BASENAME=$(basename "$ENTRY_FILE" .blend)

# If the parent dir is "examples", use the entry file name instead
if [[ "$APP_NAME" == "." || "$APP_NAME" == "examples" ]]; then
  APP_NAME="$ENTRY_BASENAME"
fi

# Output directory: use provided argument or default
OUTPUT_DIR="${2:-build/diag/${APP_NAME}}"

# ---------------------------------------------------------------------------
# Dependency Checks
# ---------------------------------------------------------------------------

if [[ ! -x "$ACME_BIN" ]] && ! command -v acme &> /dev/null; then
  echo -e "${RED}Error: ACME assembler not found at ${ACME_BIN} or in PATH${NC}"
  echo "Install ACME: brew install acme or visit https://sourceforge.net/projects/acme-crossass/"
  exit 2
fi

# Use PATH acme if the hardcoded path doesn't exist
if [[ ! -x "$ACME_BIN" ]]; then
  ACME_BIN=$(command -v acme)
fi

if [[ ! -f "$BLEND65_BIN" ]]; then
  echo -e "${RED}Error: Blend65 CLI not found at ${BLEND65_BIN}${NC}"
  echo "Run 'yarn build' first to build the compiler."
  exit 2
fi

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

header "Blend65 Diagnostic Tool"

echo -e "  ${BOLD}Entry File:${NC}  $ENTRY_FILE"
echo -e "  ${BOLD}App Name:${NC}    $APP_NAME"
echo -e "  ${BOLD}Output Dir:${NC}  $OUTPUT_DIR"
echo -e "  ${BOLD}ACME:${NC}        $ACME_BIN"
echo -e "  ${BOLD}Levels:${NC}      ${LEVELS[*]}"
echo ""

# Clean and recreate output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# ---------------------------------------------------------------------------
# Step 1: Copy Source Files
# ---------------------------------------------------------------------------

subheader "Step 1: Collecting source files"

SOURCES_DIR="$OUTPUT_DIR/sources"
mkdir -p "$SOURCES_DIR"

# Copy the entry file
cp "$ENTRY_FILE" "$SOURCES_DIR/"
info "Copied: $ENTRY_FILE"

# Copy sibling .blend files from the same directory (multi-file projects)
for blend_file in "$APP_DIR"/*.blend; do
  if [[ -f "$blend_file" && "$blend_file" != "$ENTRY_FILE" ]]; then
    cp "$blend_file" "$SOURCES_DIR/"
    info "Copied: $blend_file"
  fi
done

# Copy lib/ subdirectory if it exists (library files)
if [[ -d "$APP_DIR/lib" ]]; then
  cp -r "$APP_DIR/lib" "$SOURCES_DIR/lib"
  info "Copied: $APP_DIR/lib/"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 2: Build the compiler (ensure fresh build)
# ---------------------------------------------------------------------------

subheader "Step 2: Building compiler"

BUILD_LOG="$OUTPUT_DIR/build.log"
if yarn build > "$BUILD_LOG" 2>&1; then
  ok "Compiler built successfully"
else
  fail "Compiler build failed — see $BUILD_LOG"
  cat "$BUILD_LOG"
  exit 1
fi

echo ""

# ---------------------------------------------------------------------------
# Step 3: Compile at all optimization levels
# ---------------------------------------------------------------------------

header "Step 3: Compiling at all optimization levels"

# Track results for summary
declare -a BLEND_STATUS=()
declare -a ACME_STATUS=()
declare -a ASM_SIZES=()
declare -a PRG_SIZES=()
declare -a ASM_LINES=()

HAS_FAILURES=0

for level in "${LEVELS[@]}"; do
  subheader "Optimization: $level"

  LEVEL_DIR="$OUTPUT_DIR/$level"
  mkdir -p "$LEVEL_DIR"

  # Extract the flag value (e.g., "O2" → "2", "Os" → "s")
  OPT_FLAG="${level:1}"

  # --- Blend65 Compilation ---
  BLEND_LOG="$LEVEL_DIR/blend65.log"
  ASM_FILE="$LEVEL_DIR/output.asm"

  # Compile with blend65 CLI
  # Use --outFile to control the output filename
  if node "$BLEND65_BIN" build "$ENTRY_FILE" \
      -O "$OPT_FLAG" \
      -o "$LEVEL_DIR" \
      --outFile output \
      > "$BLEND_LOG" 2>&1; then
    BLEND_STATUS+=("pass")

    if [[ -f "$ASM_FILE" ]]; then
      ASM_SIZE=$(filesize "$ASM_FILE")
      ASM_LINE_COUNT=$(wc -l < "$ASM_FILE" | tr -d ' ')
      ASM_SIZES+=("$ASM_SIZE")
      ASM_LINES+=("$ASM_LINE_COUNT")
      ok "Blend65 compiled → output.asm ($ASM_LINE_COUNT lines, $ASM_SIZE bytes)"
    else
      # Check if the file has a different name (based on entry file basename)
      ACTUAL_ASM=$(find "$LEVEL_DIR" -name "*.asm" -type f | head -1)
      if [[ -n "$ACTUAL_ASM" ]]; then
        mv "$ACTUAL_ASM" "$ASM_FILE"
        ASM_SIZE=$(filesize "$ASM_FILE")
        ASM_LINE_COUNT=$(wc -l < "$ASM_FILE" | tr -d ' ')
        ASM_SIZES+=("$ASM_SIZE")
        ASM_LINES+=("$ASM_LINE_COUNT")
        ok "Blend65 compiled → output.asm ($ASM_LINE_COUNT lines, $ASM_SIZE bytes)"
      else
        ASM_SIZES+=("0")
        ASM_LINES+=("0")
        warn "Compilation succeeded but no .asm file found"
      fi
    fi
  else
    BLEND_STATUS+=("fail")
    ASM_SIZES+=("0")
    ASM_LINES+=("0")
    HAS_FAILURES=1
    fail "Blend65 compilation FAILED — see $BLEND_LOG"
  fi

  # --- Debug build for O0 only (with inline source comments) ---
  if [[ "$level" == "O0" ]]; then
    DEBUG_LOG="$LEVEL_DIR/blend65-debug.log"
    DEBUG_ASM="$LEVEL_DIR/output-debug.asm"
    if node "$BLEND65_BIN" build "$ENTRY_FILE" \
        -O "0" -d inline \
        -o "$LEVEL_DIR" \
        --outFile output-debug \
        > "$DEBUG_LOG" 2>&1; then
      # Rename if needed
      if [[ ! -f "$DEBUG_ASM" ]]; then
        ACTUAL_DEBUG=$(find "$LEVEL_DIR" -name "*debug*.asm" -type f | head -1)
        if [[ -n "$ACTUAL_DEBUG" ]]; then
          mv "$ACTUAL_DEBUG" "$DEBUG_ASM"
        fi
      fi
      if [[ -f "$DEBUG_ASM" ]]; then
        ok "Debug build → output-debug.asm (with inline source comments)"
      fi
    else
      warn "Debug build failed (non-critical)"
    fi
  fi

  # --- ACME Assembly ---
  # Use length-based indexing for bash 3.2 compatibility (macOS)
  LAST_BLEND_IDX=$((${#BLEND_STATUS[@]} - 1))
  if [[ "${BLEND_STATUS[$LAST_BLEND_IDX]}" == "pass" && -f "$ASM_FILE" ]]; then
    ACME_LOG="$LEVEL_DIR/acme.log"
    PRG_FILE="$LEVEL_DIR/output.prg"

    if $ACME_BIN $ACME_FLAGS -o "$PRG_FILE" "$ASM_FILE" > "$ACME_LOG" 2>&1; then
      ACME_STATUS+=("pass")
      PRG_SIZE=$(filesize "$PRG_FILE")
      PRG_SIZES+=("$PRG_SIZE")
      ok "ACME assembled → output.prg ($PRG_SIZE bytes)"
    else
      ACME_STATUS+=("fail")
      PRG_SIZES+=("0")
      HAS_FAILURES=1
      fail "ACME assembly FAILED — see $ACME_LOG"
    fi
  else
    ACME_STATUS+=("skip")
    PRG_SIZES+=("0")
  fi

  echo ""
done

# ---------------------------------------------------------------------------
# Step 4: Generate diffs between optimization levels
# ---------------------------------------------------------------------------

header "Step 4: Generating optimization diffs"

DIFF_DIR="$OUTPUT_DIR/diffs"
mkdir -p "$DIFF_DIR"

O0_ASM="$OUTPUT_DIR/O0/output.asm"

if [[ -f "$O0_ASM" ]]; then
  for level in "${LEVELS[@]:1}"; do  # Skip O0 (first element)
    LEVEL_ASM="$OUTPUT_DIR/$level/output.asm"
    DIFF_FILE="$DIFF_DIR/O0-vs-${level}.diff"

    if [[ -f "$LEVEL_ASM" ]]; then
      # Generate unified diff (returns non-zero if files differ, which is expected)
      diff -u "$O0_ASM" "$LEVEL_ASM" > "$DIFF_FILE" 2>&1 || true

      if [[ -s "$DIFF_FILE" ]]; then
        DIFF_LINES=$(wc -l < "$DIFF_FILE" | tr -d ' ')
        info "O0 vs $level: $DIFF_LINES diff lines → $DIFF_FILE"
      else
        info "O0 vs $level: identical"
        rm -f "$DIFF_FILE"
      fi
    else
      info "O0 vs $level: skipped (no $level assembly)"
    fi
  done
else
  warn "No O0 assembly available — skipping diffs"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 5: Generate Summary
# ---------------------------------------------------------------------------

header "Step 5: Generating summary"

SUMMARY_FILE="$OUTPUT_DIR/summary.txt"

{
  echo "=============================================================================="
  echo "  Blend65 Diagnostic Report"
  echo "=============================================================================="
  echo ""
  echo "  Application:  $APP_NAME"
  echo "  Entry File:   $ENTRY_FILE"
  echo "  Generated:    $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  ACME Version: $($ACME_BIN --version 2>&1 | head -1)"
  echo ""
  echo "=============================================================================="
  echo "  Results by Optimization Level"
  echo "=============================================================================="
  echo ""
  printf "  %-6s | %-10s | %-10s | %-10s | %-10s | %-8s\n" \
    "Level" "Blend65" "ACME" "ASM Lines" "ASM Size" "PRG Size"
  printf "  %-6s-+-%-10s-+-%-10s-+-%-10s-+-%-10s-+-%-8s\n" \
    "------" "----------" "----------" "----------" "----------" "--------"

  for i in "${!LEVELS[@]}"; do
    level="${LEVELS[$i]}"
    blend="${BLEND_STATUS[$i]:-skip}"
    acme="${ACME_STATUS[$i]:-skip}"
    asm_lines="${ASM_LINES[$i]:-0}"
    asm_size="${ASM_SIZES[$i]:-0}"
    prg_size="${PRG_SIZES[$i]:-0}"

    # Format status with symbols
    case "$blend" in
      pass) blend_str="✅ PASS" ;;
      fail) blend_str="❌ FAIL" ;;
      *)    blend_str="⏭️  SKIP" ;;
    esac

    case "$acme" in
      pass) acme_str="✅ PASS" ;;
      fail) acme_str="❌ FAIL" ;;
      *)    acme_str="⏭️  SKIP" ;;
    esac

    # Format sizes
    if [[ "$asm_size" -gt 0 ]]; then
      asm_size_str="${asm_size} B"
    else
      asm_size_str="-"
    fi

    if [[ "$asm_lines" -gt 0 ]]; then
      asm_lines_str="$asm_lines"
    else
      asm_lines_str="-"
    fi

    if [[ "$prg_size" -gt 0 ]]; then
      prg_size_str="${prg_size} B"
    else
      prg_size_str="-"
    fi

    printf "  %-6s | %-10s | %-10s | %-10s | %-10s | %-8s\n" \
      "$level" "$blend_str" "$acme_str" "$asm_lines_str" "$asm_size_str" "$prg_size_str"
  done

  echo ""
  echo "=============================================================================="
  echo "  File Listing"
  echo "=============================================================================="
  echo ""

  # List all generated files with sizes
  find "$OUTPUT_DIR" -type f | sort | while read -r f; do
    rel_path="${f#$OUTPUT_DIR/}"
    size=$(filesize "$f")
    printf "  %-50s %8s B\n" "$rel_path" "$size"
  done

  echo ""
  echo "=============================================================================="
  echo "  Optimization Level Comparison"
  echo "=============================================================================="
  echo ""

  if [[ -d "$DIFF_DIR" ]]; then
    diff_count=$(find "$DIFF_DIR" -name "*.diff" -type f | wc -l | tr -d ' ')
    if [[ "$diff_count" -gt 0 ]]; then
      echo "  Diffs generated (O0 as baseline):"
      for diff_file in "$DIFF_DIR"/*.diff; do
        if [[ -f "$diff_file" ]]; then
          diff_name=$(basename "$diff_file")
          diff_lines=$(wc -l < "$diff_file" | tr -d ' ')
          echo "    $diff_name — $diff_lines lines changed"
        fi
      done
    else
      echo "  All optimization levels produced identical assembly."
    fi
  fi

  echo ""

  # Overall verdict
  if [[ "$HAS_FAILURES" -eq 0 ]]; then
    echo "  ✅ OVERALL: All compilations and assemblies PASSED"
  else
    echo "  ❌ OVERALL: One or more steps FAILED — see logs for details"
    echo ""
    echo "  Failed steps:"
    for i in "${!LEVELS[@]}"; do
      level="${LEVELS[$i]}"
      blend="${BLEND_STATUS[$i]:-skip}"
      acme="${ACME_STATUS[$i]:-skip}"
      if [[ "$blend" == "fail" ]]; then
        echo "    - $level: Blend65 compilation failed (see $OUTPUT_DIR/$level/blend65.log)"
      fi
      if [[ "$acme" == "fail" ]]; then
        echo "    - $level: ACME assembly failed (see $OUTPUT_DIR/$level/acme.log)"
      fi
    done
  fi

  echo ""
  echo "=============================================================================="
} > "$SUMMARY_FILE"

# Print summary to terminal too
cat "$SUMMARY_FILE"

# ---------------------------------------------------------------------------
# Final Status
# ---------------------------------------------------------------------------

echo ""
if [[ "$HAS_FAILURES" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✅ All diagnostic steps completed successfully.${NC}"
  echo -e "${GRAY}Output: $OUTPUT_DIR/${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}❌ Diagnostic completed with failures.${NC}"
  echo -e "${GRAY}Output: $OUTPUT_DIR/${NC}"
  echo -e "${YELLOW}Review the .log files in the failed level directories for details.${NC}"
  exit 1
fi
