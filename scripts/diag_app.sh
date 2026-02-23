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

LEVELS=("O0" "O1" "O1s" "O1z" "O2" "Os" "Oz" "O3" "O3s" "O3z")
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
# validate_labels() — Parse ACME label file and check for alignment issues
#
# Checks performed:
#   - @charset / font labels must be 2048-byte aligned (VIC-II requirement)
#   - All labels must be within valid C64 user RAM ($0801-$CFFF)
#   - Reports label address map for diagnostic review
#
# Arguments:
#   $1 — Path to the ACME label file (output.labels)
#   $2 — Optimization level name (e.g., "O0") for display
#   $3 — Path to output file for label map (appended)
#
# Returns:
#   Number of warnings found (0 = clean)
# ---------------------------------------------------------------------------
validate_labels() {
  local labels_file="$1"
  local level="$2"
  local output_file="$3"
  local warnings=0

  if [[ ! -f "$labels_file" ]]; then
    warn "$level: No label file found — skipping label validation"
    return 0
  fi

  # Count non-comment, non-empty lines to check if labels exist
  local label_count
  label_count=$(grep -cv '^\s*;' "$labels_file" 2>/dev/null | tr -d ' ' || echo "0")
  # Subtract empty lines
  label_count=$(grep -v '^\s*;' "$labels_file" 2>/dev/null | grep -c '[^ ]' || echo "0")

  if [[ "$label_count" -eq 0 ]]; then
    warn "$level: Label file is empty — no symbols exported"
    return 0
  fi

  # Parse each label line: "name = $XXXX"
  while IFS= read -r line; do
    # Skip comment lines (start with ;) and empty lines
    [[ "$line" =~ ^[[:space:]]*\; ]] && continue
    [[ -z "${line// /}" ]] && continue

    # Extract name and hex address from ACME label format: "name\t= $XXX\t; comment"
    # ACME uses tabs, optional leading tabs, and trailing "; comment" metadata
    local name addr_hex addr_dec
    name=$(echo "$line" | cut -d'=' -f1 | tr -d ' \t')
    # Get everything after '=', strip tabs/spaces/$, then remove trailing comment ("; ...")
    addr_hex=$(echo "$line" | cut -d'=' -f2 | sed 's/;.*//' | tr -d ' \t$')

    # Skip if we couldn't parse properly
    [[ -z "$name" || -z "$addr_hex" ]] && continue

    # Convert hex to decimal for arithmetic checks
    addr_dec=$((16#$addr_hex))

    # --- Check @charset / font alignment (must be 2048-byte / $800 aligned) ---
    # VIC-II character set pointer ($D018) requires 2KB-aligned character data.
    # Common label patterns: __armenianFont, __myCharset, *Font*, *charset*
    if [[ "$name" == *"Font"* || "$name" == *"font"* || "$name" == *"Charset"* || "$name" == *"charset"* ]]; then
      if (( addr_dec % 2048 == 0 )); then
        echo "    ✅ $name = \$$addr_hex (2048-byte aligned)" >> "$output_file"
      else
        local remainder=$((addr_dec % 2048))
        echo "    ❌ $name = \$$addr_hex (NOT aligned! off by $remainder bytes)" >> "$output_file"
        warn "$level: @charset '$name' at \$$addr_hex is NOT 2048-byte aligned (off by $remainder)"
        warnings=$((warnings + 1))
      fi
    # --- Check address is in valid C64 user RAM range ($0801-$CFFF) ---
    # Addresses below $0801 overlap BASIC/zero-page; above $CFFF overlaps I/O
    elif [[ "$name" != "__basic"* ]]; then
      if (( addr_dec < 0x0801 || addr_dec > 0xCFFF )); then
        echo "    ⚠️  $name = \$$addr_hex (outside user RAM $0801-$CFFF)" >> "$output_file"
        warn "$level: Label '$name' at \$$addr_hex is outside user RAM range"
        warnings=$((warnings + 1))
      else
        echo "    $name = \$$addr_hex" >> "$output_file"
      fi
    else
      echo "    $name = \$$addr_hex" >> "$output_file"
    fi

  done < "$labels_file"

  return $warnings
}

# ---------------------------------------------------------------------------
# validate_prg() — Validate PRG binary structure for C64 compatibility
#
# Checks performed:
#   - Minimum size (must have load address + BASIC stub)
#   - Load address must be $0801 (standard C64 BASIC start)
#   - BASIC SYS stub must be present ($9E token) for autostart
#   - Extracts SYS target address from ASCII digits after $9E
#
# Arguments:
#   $1 — Path to the PRG file (output.prg)
#   $2 — Optimization level name (e.g., "O0") for display
#   $3 — Path to result file (pipe-separated result written here)
#
# Result file format:
#   "load_addr|has_stub|sys_target|warning_count"
#   Example: "$0801|yes|2144|0"
#
# Returns:
#   Number of warnings found (0 = clean)
# ---------------------------------------------------------------------------
validate_prg() {
  local prg_file="$1"
  local level="$2"
  local result_file="$3"
  local warnings=0
  local load_addr="?"
  local has_stub="no"
  local sys_target="-"

  if [[ ! -f "$prg_file" ]]; then
    echo "?|no|-|1" > "$result_file"
    return 1
  fi

  # --- Check minimum size ---
  # A valid PRG needs at least: 2 bytes load address + ~13 bytes BASIC stub = 15 bytes min
  local prg_size
  prg_size=$(wc -c < "$prg_file" | tr -d ' ')
  if (( prg_size < 15 )); then
    fail "$level: PRG too small ($prg_size bytes) — likely corrupted"
    echo "?|no|-|1" > "$result_file"
    return 1
  fi

  # --- Check load address (first 2 bytes, little-endian) ---
  # Standard C64 programs load at $0801 (BASIC program area start)
  local load_lo load_hi
  load_lo=$(xxd -p -l 1 -s 0 "$prg_file")
  load_hi=$(xxd -p -l 1 -s 1 "$prg_file")
  load_addr="\$${load_hi}${load_lo}"

  if [[ "$load_lo" != "01" || "$load_hi" != "08" ]]; then
    fail "$level: PRG load address is $load_addr, expected \$0801"
    warnings=$((warnings + 1))
  else
    ok "$level: PRG load address $load_addr ✓"
  fi

  # --- Check for BASIC SYS stub ($9E token) ---
  # The SYS token ($9E) should appear in the first ~20 bytes after load address.
  # Format: [next-line-ptr] [line-number] $9E [ASCII digits of SYS addr] $00 $00 $00
  local basic_hex
  basic_hex=$(xxd -p -l 20 -s 2 "$prg_file" | tr -d '\n')

  if [[ "$basic_hex" == *"9e"* ]]; then
    has_stub="yes"

    # Extract SYS target address from ASCII digits after the $9E token
    # $9E is followed by a space ($20) then ASCII digit chars ($30-$39)
    local after_sys
    after_sys="${basic_hex#*9e}"

    # Skip optional space ($20) after SYS token
    if [[ "$after_sys" == "20"* ]]; then
      after_sys="${after_sys:2}"
    fi

    # Read ASCII digit bytes until we hit a non-digit (< $30 or > $39)
    local digit_chars=""
    local pos=0
    while (( pos < ${#after_sys} - 1 )); do
      local byte_hex="${after_sys:$pos:2}"
      local byte_dec=$((16#$byte_hex))
      # ASCII digits are $30-$39 (0-9)
      if (( byte_dec >= 0x30 && byte_dec <= 0x39 )); then
        # Convert hex byte to ASCII character
        digit_chars+=$(printf "\\x${byte_hex}")
        pos=$((pos + 2))
      else
        break
      fi
    done

    if [[ -n "$digit_chars" ]]; then
      sys_target="$digit_chars"
      ok "$level: BASIC SYS $sys_target stub found ✓"
    else
      ok "$level: BASIC SYS stub found ✓ (address not parsed)"
    fi
  else
    fail "$level: No BASIC SYS stub ($9E token) found — program won't autostart!"
    warnings=$((warnings + 1))
  fi

  # Write pipe-separated result to result file (avoids subshell stdout capture issues)
  echo "${load_addr}|${has_stub}|${sys_target}|${warnings}" > "$result_file"
  return $warnings
}

# ---------------------------------------------------------------------------
# detect_size_regressions() — Flag optimized levels larger than O0
#
# An optimized level producing LARGER code than O0 (unoptimized) is always
# a compiler bug — the optimizer is making code worse, not better.
#
# Arguments:
#   None (uses global PRG_SIZES and LEVELS arrays)
#
# Output:
#   Prints warnings to terminal for each regression found.
#   Writes regression details to the file specified by $1 (if provided).
#
# Returns:
#   Number of regressions found (0 = clean)
# ---------------------------------------------------------------------------
detect_size_regressions() {
  local output_file="${1:-}"
  local regressions=0
  local o0_size="${PRG_SIZES[0]:-0}"

  # Can't check if O0 didn't produce a valid PRG
  if [[ "$o0_size" -eq 0 ]]; then
    warn "Cannot check size regressions — O0 PRG size is 0"
    return 0
  fi

  for i in "${!LEVELS[@]}"; do
    # Skip O0 itself (index 0)
    if [[ "$i" -eq 0 ]]; then continue; fi

    local level="${LEVELS[$i]}"
    local size="${PRG_SIZES[$i]:-0}"

    # Skip levels that didn't produce a PRG
    if [[ "$size" -eq 0 ]]; then continue; fi

    if (( size > o0_size )); then
      local delta=$((size - o0_size))
      warn "SIZE REGRESSION: $level ($size B) is $delta bytes LARGER than O0 ($o0_size B)"
      if [[ -n "$output_file" ]]; then
        echo "  ⚠️  $level: $size B (+$delta vs O0 $o0_size B)" >> "$output_file"
      fi
      regressions=$((regressions + 1))
    fi
  done

  return $regressions
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

# BLEND65_SKIP_BUILD=1 allows callers (e.g., diag_batch.sh) to pre-build
# the compiler once and skip redundant builds for each test program.
if [[ "${BLEND65_SKIP_BUILD:-}" == "1" ]]; then
  ok "Skipping build (BLEND65_SKIP_BUILD=1, pre-built by caller)"
else
  if yarn build > "$BUILD_LOG" 2>&1; then
    ok "Compiler built successfully"
  else
    fail "Compiler build failed — see $BUILD_LOG"
    cat "$BUILD_LOG"
    exit 1
  fi
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
    LABELS_FILE="$LEVEL_DIR/output.labels"

    if $ACME_BIN $ACME_FLAGS -l "$LABELS_FILE" -o "$PRG_FILE" "$ASM_FILE" > "$ACME_LOG" 2>&1; then
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
# Step 5: Label & PRG Validation
# ---------------------------------------------------------------------------

header "Step 5: Label & PRG binary validation"

# Collect validation results for summary
LABEL_MAP_FILE="$OUTPUT_DIR/label-map.txt"
PRG_VALIDATION_FILE="$OUTPUT_DIR/prg-validation.txt"
: > "$LABEL_MAP_FILE"
: > "$PRG_VALIDATION_FILE"

# Track PRG validation results per level (pipe-separated: load_addr|has_stub|sys_target|warnings)
declare -a PRG_RESULTS=()
TOTAL_LABEL_WARNINGS=0
TOTAL_PRG_WARNINGS=0

for i in "${!LEVELS[@]}"; do
  level="${LEVELS[$i]}"
  acme="${ACME_STATUS[$i]:-skip}"

  # Only validate levels where ACME succeeded
  if [[ "$acme" != "pass" ]]; then
    PRG_RESULTS+=("-|-|-|-")
    continue
  fi

  LEVEL_DIR="$OUTPUT_DIR/$level"

  # --- Label validation ---
  LABELS_FILE="$LEVEL_DIR/output.labels"
  if [[ -f "$LABELS_FILE" ]]; then
    # Only write the full label map for O0 (labels are typically identical across levels)
    if [[ "$level" == "O0" ]]; then
      echo "  Labels from O0:" >> "$LABEL_MAP_FILE"
      # validate_labels appends to the output file and prints warnings to terminal
      # Use || to capture non-zero return (warning count) without triggering set -e
      label_warn=0
      validate_labels "$LABELS_FILE" "$level" "$LABEL_MAP_FILE" || label_warn=$?
      TOTAL_LABEL_WARNINGS=$((TOTAL_LABEL_WARNINGS + label_warn))
    else
      # For other levels, just run validation checks (output to temp file)
      local_label_tmp=$(mktemp)
      label_warn=0
      validate_labels "$LABELS_FILE" "$level" "$local_label_tmp" || label_warn=$?
      TOTAL_LABEL_WARNINGS=$((TOTAL_LABEL_WARNINGS + label_warn))
      rm -f "$local_label_tmp"
    fi
  fi

  # --- PRG binary validation ---
  PRG_FILE="$LEVEL_DIR/output.prg"
  if [[ -f "$PRG_FILE" ]]; then
    # validate_prg writes pipe-separated result to a temp file, prints ok/fail to terminal
    prg_result_file=$(mktemp)
    prg_warn=0
    validate_prg "$PRG_FILE" "$level" "$prg_result_file" || prg_warn=$?
    prg_result=$(cat "$prg_result_file" 2>/dev/null || echo "-|-|-|-")
    rm -f "$prg_result_file"
    PRG_RESULTS+=("$prg_result")
    TOTAL_PRG_WARNINGS=$((TOTAL_PRG_WARNINGS + prg_warn))
  else
    PRG_RESULTS+=("-|-|-|-")
  fi
done

# Report totals
if [[ "$TOTAL_LABEL_WARNINGS" -eq 0 && "$TOTAL_PRG_WARNINGS" -eq 0 ]]; then
  ok "All label and PRG validations passed"
else
  if [[ "$TOTAL_LABEL_WARNINGS" -gt 0 ]]; then
    warn "Label validation: $TOTAL_LABEL_WARNINGS warning(s)"
  fi
  if [[ "$TOTAL_PRG_WARNINGS" -gt 0 ]]; then
    warn "PRG validation: $TOTAL_PRG_WARNINGS warning(s)"
  fi
fi

echo ""

# ---------------------------------------------------------------------------
# Step 6: Assembly Analysis
# ---------------------------------------------------------------------------

header "Step 6: Assembly analysis"

ANALYSIS_DIR="$OUTPUT_DIR/analysis"
mkdir -p "$ANALYSIS_DIR"
ANALYZE_SCRIPT="./scripts/diag_analyze_asm.sh"

# --- 6a: Extract metrics for each level and build cross-level arrays ---
# These arrays are indexed by level position (same as LEVELS array)
declare -a M_ASM_LINES=()
declare -a M_JSR=()
declare -a M_JMP=()
declare -a M_LDA_IMM=()
declare -a M_STA=()
declare -a M_LDA=()
declare -a M_PHA=()
declare -a M_PLA=()
declare -a M_BRANCHES=()
declare -a M_RTS=()
declare -a M_DATA=()

for i in "${!LEVELS[@]}"; do
  level="${LEVELS[$i]}"
  ASM_FILE="$OUTPUT_DIR/$level/output.asm"

  if [[ -f "$ASM_FILE" ]]; then
    # Run metrics extraction, writing key=value pairs to a temp file
    metrics_file="$ANALYSIS_DIR/${level}-metrics.txt"
    bash "$ANALYZE_SCRIPT" metrics "$ASM_FILE" "$metrics_file"

    # Parse metrics from key=value output
    M_ASM_LINES+=("$(grep '^asm_lines=' "$metrics_file" | cut -d= -f2)")
    M_JSR+=("$(grep '^jsr=' "$metrics_file" | cut -d= -f2)")
    M_JMP+=("$(grep '^jmp=' "$metrics_file" | cut -d= -f2)")
    M_LDA_IMM+=("$(grep '^lda_imm=' "$metrics_file" | cut -d= -f2)")
    M_STA+=("$(grep '^sta=' "$metrics_file" | cut -d= -f2)")
    M_LDA+=("$(grep '^lda=' "$metrics_file" | cut -d= -f2)")
    M_PHA+=("$(grep '^pha=' "$metrics_file" | cut -d= -f2)")
    M_PLA+=("$(grep '^pla=' "$metrics_file" | cut -d= -f2)")
    M_BRANCHES+=("$(grep '^branches=' "$metrics_file" | cut -d= -f2)")
    M_RTS+=("$(grep '^rts=' "$metrics_file" | cut -d= -f2)")
    M_DATA+=("$(grep '^data_directives=' "$metrics_file" | cut -d= -f2)")

    info "$level: metrics extracted"
  else
    # Fill with dashes for levels that have no assembly
    M_ASM_LINES+=("-")
    M_JSR+=("-")
    M_JMP+=("-")
    M_LDA_IMM+=("-")
    M_STA+=("-")
    M_LDA+=("-")
    M_PHA+=("-")
    M_PLA+=("-")
    M_BRANCHES+=("-")
    M_RTS+=("-")
    M_DATA+=("-")
    info "$level: no assembly — skipping metrics"
  fi
done

# --- 6b: Size regression detection ---
subheader "Size Regression Check"

SIZE_REG_FILE="$ANALYSIS_DIR/size-regressions.txt"
: > "$SIZE_REG_FILE"
size_reg_count=0
detect_size_regressions "$SIZE_REG_FILE" || size_reg_count=$?

if [[ "$size_reg_count" -eq 0 ]]; then
  ok "No size regressions detected"
else
  warn "$size_reg_count size regression(s) found"
fi

# --- 6c: Stack balance check (O0 only — stack structure is architecture, not optimization) ---
subheader "Stack Balance Check (O0)"

STACK_FILE="$ANALYSIS_DIR/stack-balance-O0.txt"
O0_ASM_FILE="$OUTPUT_DIR/O0/output.asm"
STACK_IMBALANCES=0

if [[ -f "$O0_ASM_FILE" ]]; then
  bash "$ANALYZE_SCRIPT" stack "$O0_ASM_FILE" "$STACK_FILE"
  # Extract the machine-readable imbalance count from output
  STACK_IMBALANCES=$(grep '^stack_imbalances=' "$STACK_FILE" | cut -d= -f2 || echo "0")

  if [[ "$STACK_IMBALANCES" -eq 0 ]]; then
    ok "All functions have balanced PHA/PLA"
  else
    warn "$STACK_IMBALANCES function(s) with PHA/PLA imbalance!"
  fi
else
  warn "No O0 assembly — skipping stack balance check"
fi

# --- 6d: Redundancy detection (O0 as baseline) ---
subheader "Redundancy Detection (O0)"

REDUN_FILE="$ANALYSIS_DIR/redundancies-O0.txt"
REDUNDANCY_COUNT=0

if [[ -f "$O0_ASM_FILE" ]]; then
  bash "$ANALYZE_SCRIPT" redundancies "$O0_ASM_FILE" "$REDUN_FILE"
  # Extract the machine-readable redundancy count from output
  REDUNDANCY_COUNT=$(grep '^redundancies=' "$REDUN_FILE" | cut -d= -f2 || echo "0")

  if [[ "$REDUNDANCY_COUNT" -eq 0 ]]; then
    ok "No redundancy patterns found in O0"
  else
    warn "$REDUNDANCY_COUNT redundancy pattern(s) found in O0"
  fi
else
  warn "No O0 assembly — skipping redundancy detection"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 7: VICE Runtime Verification (optional)
# ---------------------------------------------------------------------------
# Only runs if expected.json exists alongside the source files AND VICE is
# available. Runs diag_vice.sh for each optimization level that produced a PRG.

VICE_SCRIPT="./scripts/diag_vice.sh"
EXPECTED_JSON="$APP_DIR/expected.json"
VICE_TOTAL_PASS=0
VICE_TOTAL_FAIL=0
VICE_LEVELS_TESTED=0

if [[ -f "$EXPECTED_JSON" && -f "$VICE_SCRIPT" ]]; then
  header "Step 7: VICE Runtime Verification"

  # Source VICE env to check availability (don't run the full script yet)
  source "./scripts/vice/env.sh"
  if detect_vice; then
    ok "VICE found: $VICE_BIN"

    for i in "${!LEVELS[@]}"; do
      level="${LEVELS[$i]}"
      acme="${ACME_STATUS[$i]:-skip}"

      # Only test levels where ACME succeeded and PRG exists
      if [[ "$acme" != "pass" ]]; then continue; fi

      PRG_FILE_VICE="$OUTPUT_DIR/$level/output.prg"
      LABELS_FILE_VICE="$OUTPUT_DIR/$level/output.labels"
      VICE_OUT_DIR="$OUTPUT_DIR/$level/vice"

      if [[ ! -f "$PRG_FILE_VICE" ]]; then continue; fi

      subheader "VICE: $level"

      # Build diag_vice.sh arguments
      VICE_ARGS=("$PRG_FILE_VICE" "$EXPECTED_JSON" "$VICE_OUT_DIR")
      if [[ -f "$LABELS_FILE_VICE" ]]; then
        VICE_ARGS+=("--labels" "$LABELS_FILE_VICE")
      fi

      vice_exit=0
      bash "$VICE_SCRIPT" "${VICE_ARGS[@]}" > "$OUTPUT_DIR/$level/vice-run.log" 2>&1 || vice_exit=$?

      VICE_LEVELS_TESTED=$((VICE_LEVELS_TESTED + 1))

      # Read results from vice-summary.txt
      if [[ -f "$VICE_OUT_DIR/vice-summary.txt" ]]; then
        if grep -q "ALL CHECKS PASSED" "$VICE_OUT_DIR/vice-summary.txt" 2>/dev/null; then
          ok "$level: VICE checks passed"
          VICE_TOTAL_PASS=$((VICE_TOTAL_PASS + 1))
        else
          fail "$level: VICE checks failed — see $VICE_OUT_DIR/"
          VICE_TOTAL_FAIL=$((VICE_TOTAL_FAIL + 1))
        fi
      else
        warn "$level: VICE ran but no summary produced"
        VICE_TOTAL_FAIL=$((VICE_TOTAL_FAIL + 1))
      fi
    done

    echo ""
    if [[ "$VICE_TOTAL_FAIL" -eq 0 ]]; then
      ok "VICE: All $VICE_LEVELS_TESTED levels passed"
    else
      warn "VICE: $VICE_TOTAL_FAIL/$VICE_LEVELS_TESTED levels failed"
    fi
  else
    warn "VICE not available — skipping runtime verification"
    info "Install VICE (x64sc) for runtime memory/register verification"
  fi
else
  if [[ ! -f "$EXPECTED_JSON" ]]; then
    info "No expected.json found — skipping VICE verification"
    info "Create $EXPECTED_JSON for runtime verification"
  fi
fi

echo ""

# ---------------------------------------------------------------------------
# Step 8: Generate Summary
# ---------------------------------------------------------------------------

header "Step 8: Generating summary"

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
  echo "  Label Address Map (O0)"
  echo "=============================================================================="
  echo ""

  # Include the label map generated during Step 5 validation
  if [[ -s "$LABEL_MAP_FILE" ]]; then
    cat "$LABEL_MAP_FILE"
  else
    echo "  No labels available (O0 compilation or assembly failed)"
  fi

  echo ""
  echo "=============================================================================="
  echo "  PRG Binary Validation"
  echo "=============================================================================="
  echo ""

  printf "  %-6s | %-10s | %-10s | %-12s | %-8s\n" \
    "Level" "Load Addr" "SYS Stub" "SYS Target" "Warnings"
  printf "  %-6s-+-%-10s-+-%-10s-+-%-12s-+-%-8s\n" \
    "------" "----------" "----------" "------------" "--------"

  for i in "${!LEVELS[@]}"; do
    level="${LEVELS[$i]}"
    prg_result="${PRG_RESULTS[$i]:--|-|-|-}"

    # Parse pipe-separated result: load_addr|has_stub|sys_target|warnings
    local_load=$(echo "$prg_result" | cut -d'|' -f1)
    local_stub=$(echo "$prg_result" | cut -d'|' -f2)
    local_sys=$(echo "$prg_result" | cut -d'|' -f3)
    local_warns=$(echo "$prg_result" | cut -d'|' -f4)

    # Format stub status
    if [[ "$local_stub" == "yes" ]]; then
      stub_str="✅ yes"
    elif [[ "$local_stub" == "no" ]]; then
      stub_str="❌ no"
    else
      stub_str="-"
    fi

    # Format load address status
    if [[ "$local_load" == *"0801"* ]]; then
      load_str="$local_load ✅"
    elif [[ "$local_load" == "-" || "$local_load" == "?" ]]; then
      load_str="-"
    else
      load_str="$local_load ❌"
    fi

    # Format warnings
    if [[ "$local_warns" == "0" ]]; then
      warns_str="0 ✅"
    elif [[ "$local_warns" == "-" ]]; then
      warns_str="-"
    else
      warns_str="$local_warns ⚠️"
    fi

    printf "  %-6s | %-10s | %-10s | %-12s | %-8s\n" \
      "$level" "$load_str" "$stub_str" "$local_sys" "$warns_str"
  done

  if [[ "$TOTAL_LABEL_WARNINGS" -gt 0 || "$TOTAL_PRG_WARNINGS" -gt 0 ]]; then
    echo ""
    echo "  ⚠️  Validation warnings: $TOTAL_LABEL_WARNINGS label, $TOTAL_PRG_WARNINGS PRG"
  fi

  echo ""
  echo "=============================================================================="
  echo "  Assembly Metrics (Cross-Level)"
  echo "=============================================================================="
  echo ""

  # Build the cross-level metrics table using arrays populated in Step 6
  # Header row with all optimization level names
  printf "  %-14s" "Metric"
  for level in "${LEVELS[@]}"; do
    printf " %5s" "$level"
  done
  echo ""

  printf "  %-14s" "──────────────"
  for level in "${LEVELS[@]}"; do
    printf " %5s" "─────"
  done
  echo ""

  # Print each metric row
  _print_metric_row() {
    local label="$1"
    shift
    local -a values=("$@")
    printf "  %-14s" "$label"
    for val in "${values[@]}"; do
      printf " %5s" "$val"
    done
    echo ""
  }

  _print_metric_row "ASM lines" "${M_ASM_LINES[@]}"
  _print_metric_row "PRG bytes" "${PRG_SIZES[@]}"
  _print_metric_row "JSR calls" "${M_JSR[@]}"
  _print_metric_row "JMP instrs" "${M_JMP[@]}"
  _print_metric_row "LDA #imm" "${M_LDA_IMM[@]}"
  _print_metric_row "STA stores" "${M_STA[@]}"
  _print_metric_row "LDA loads" "${M_LDA[@]}"
  _print_metric_row "PHA pushes" "${M_PHA[@]}"
  _print_metric_row "PLA pulls" "${M_PLA[@]}"
  _print_metric_row "Branches" "${M_BRANCHES[@]}"
  _print_metric_row "RTS returns" "${M_RTS[@]}"
  _print_metric_row "Data dirs" "${M_DATA[@]}"

  echo ""
  echo "=============================================================================="
  echo "  Size Regression Check"
  echo "=============================================================================="
  echo ""

  if [[ -s "$SIZE_REG_FILE" ]]; then
    cat "$SIZE_REG_FILE"
  elif [[ "$size_reg_count" -gt 0 ]]; then
    echo "  ⚠️  $size_reg_count size regression(s) detected"
  else
    echo "  ✅ No size regressions — all optimized levels ≤ O0 (${PRG_SIZES[0]:-0} B)"
  fi

  echo ""
  echo "=============================================================================="
  echo "  Stack Balance Check (O0)"
  echo "=============================================================================="
  echo ""

  if [[ -s "$STACK_FILE" ]]; then
    # Include the stack balance table (skip the machine-readable line)
    grep -v '^stack_imbalances=' "$STACK_FILE" || true
  else
    echo "  No stack balance data available"
  fi

  echo ""
  echo "=============================================================================="
  echo "  Redundancy Detection (O0)"
  echo "=============================================================================="
  echo ""

  if [[ -s "$REDUN_FILE" ]]; then
    # Include redundancy findings (skip the machine-readable line)
    grep -v '^redundancies=' "$REDUN_FILE" || true
  else
    echo "  No redundancy data available"
  fi

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
