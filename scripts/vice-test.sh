#!/usr/bin/env bash
# vice-test.sh — VICE feasibility test script for Phase 3
# Tests various VICE CLI features to determine what works on macOS
set -euo pipefail

# ─── VICE App Bundle Setup ───────────────────────────────────────────────
VICE_APP="/Users/gevik/workdir/vice/VICE.app"
BUNDLE_RESOURCES="$VICE_APP/Contents/Resources"
VICE_BIN="$BUNDLE_RESOURCES/bin/x64sc"

# Set up macOS app bundle environment (required for VICE to find its resources)
export XDG_CONFIG_DIRS="$BUNDLE_RESOURCES/etc/xdg"
export XDG_DATA_DIRS="$BUNDLE_RESOURCES/share"
export GTK_DATA_PREFIX="$BUNDLE_RESOURCES"
export GTK_EXE_PREFIX="$BUNDLE_RESOURCES"
export GTK_PATH="$BUNDLE_RESOURCES"
export GDK_PIXBUF_MODULE_FILE="$BUNDLE_RESOURCES/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache"
export GTK_IM_MODULE_FILE="$BUNDLE_RESOURCES/lib/gtk-3.0/3.0.0/immodules.cache"

# ─── Configuration ───────────────────────────────────────────────────────
# Cycle limit for VICE execution (default ~10 seconds at 1MHz)
# C64 KERNAL boot + BASIC init + autostart needs ~5M cycles minimum
# Using 10M to give programs time to execute after autostart
VICE_CYCLES="${VICE_CYCLES:-10000000}"
# Startup delay in seconds — give VICE time to initialize (important on slow machines)
VICE_STARTUP_DELAY="${VICE_STARTUP_DELAY:-3}"

# ─── Output Directory ────────────────────────────────────────────────────
OUTPUT_DIR="/tmp/vice-test-$$"
mkdir -p "$OUTPUT_DIR"

# ─── Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✅ $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "  ${CYAN}ℹ️  $1${NC}"; }

# ─── Test Functions ──────────────────────────────────────────────────────

# Test 1: Basic launch with warp + limitcycles + confirmonexit (no PRG)
test_basic_launch() {
  echo ""
  echo -e "${CYAN}═══ Test 1: Basic VICE Launch (warp + limitcycles) ═══${NC}"
  echo ""

  local log="$OUTPUT_DIR/test1-vice.log"
  local exit_code=0

  info "Launching VICE with: -warp -limitcycles 500000 +confirmonexit -silent"

  "$VICE_BIN" \
    -warp \
    -limitcycles 500000 \
    +confirmonexit \
    -silent \
    > "$log" 2>&1 || exit_code=$?

  echo "  Exit code: $exit_code"

  if [[ $exit_code -eq 0 || $exit_code -eq 1 ]]; then
    ok "VICE launched and exited (exit code: $exit_code)"
  else
    fail "VICE failed with exit code: $exit_code"
    echo "  Log (last 10 lines):"
    tail -10 "$log" 2>/dev/null | sed 's/^/    /'
  fi

  echo "  Log file: $log ($(wc -l < "$log") lines)"
}

# Test 2: Autostart with a PRG file
test_autostart() {
  local prg_file="${1:-}"
  if [[ -z "$prg_file" || ! -f "$prg_file" ]]; then
    echo ""
    echo -e "${CYAN}═══ Test 2: Autostart (SKIPPED — no PRG file) ═══${NC}"
    warn "Provide PRG path as first argument"
    return 0
  fi

  echo ""
  echo -e "${CYAN}═══ Test 2: Autostart with PRG ═══${NC}"
  echo ""

  local log="$OUTPUT_DIR/test2-vice.log"
  local exit_code=0

  info "PRG: $prg_file"
  info "Launching VICE with: -autostart <prg> -warp -autostart-warp -limitcycles $VICE_CYCLES +confirmonexit -silent -autostartprgmode 1"

  "$VICE_BIN" \
    -autostart "$prg_file" \
    -warp \
    -autostart-warp \
    -limitcycles "$VICE_CYCLES" \
    +confirmonexit \
    -silent \
    -autostartprgmode 1 \
    > "$log" 2>&1 || exit_code=$?

  echo "  Exit code: $exit_code"

  if [[ $exit_code -eq 0 || $exit_code -eq 1 ]]; then
    ok "VICE launched with autostart and exited (exit code: $exit_code)"
  else
    fail "VICE autostart failed with exit code: $exit_code"
    echo "  Log (last 10 lines):"
    tail -10 "$log" 2>/dev/null | sed 's/^/    /'
  fi

  echo "  Log file: $log ($(wc -l < "$log") lines)"
}

# Test 3: Monitor commands with -moncommands
test_moncommands() {
  local prg_file="${1:-}"
  if [[ -z "$prg_file" || ! -f "$prg_file" ]]; then
    echo ""
    echo -e "${CYAN}═══ Test 3: Monitor Commands (SKIPPED — no PRG file) ═══${NC}"
    warn "Provide PRG path as first argument"
    return 0
  fi

  echo ""
  echo -e "${CYAN}═══ Test 3: Monitor Commands (-moncommands) ═══${NC}"
  echo ""

  local mon_file="$OUTPUT_DIR/test3.mon"
  local log="$OUTPUT_DIR/test3-vice.log"
  local exit_code=0

  # Create a simple monitor script that dumps screen memory and quits
  cat > "$mon_file" << 'MON'
; Test monitor script — dump screen memory and quit
; save "filename" device start end
save "screen.bin" 0 0400 07e7
save "vic.bin" 0 d000 d030
save "zeropage.bin" 0 0000 00ff
r
quit
MON

  info "Monitor script: $mon_file"
  info "Launching VICE with: -autostart <prg> -moncommands <mon> -warp -autostart-warp -limitcycles 2000000 +confirmonexit -silent -autostartprgmode 1"

  # Run from output dir so save commands write files there
  pushd "$OUTPUT_DIR" > /dev/null

  "$VICE_BIN" \
    -autostart "$prg_file" \
    -moncommands "$mon_file" \
    -warp \
    -autostart-warp \
    -limitcycles 2000000 \
    +confirmonexit \
    -silent \
    -autostartprgmode 1 \
    > "$log" 2>&1 || exit_code=$?

  popd > /dev/null

  echo "  Exit code: $exit_code"

  if [[ $exit_code -eq 0 || $exit_code -eq 1 ]]; then
    ok "VICE launched with moncommands and exited (exit code: $exit_code)"
  else
    fail "VICE moncommands failed with exit code: $exit_code"
    echo "  Log (last 10 lines):"
    tail -10 "$log" 2>/dev/null | sed 's/^/    /'
  fi

  # Check if dump files were created
  echo ""
  info "Checking dump files:"
  for dump_file in screen.bin vic.bin zeropage.bin; do
    local path="$OUTPUT_DIR/$dump_file"
    if [[ -f "$path" ]]; then
      local size
      size=$(wc -c < "$path")
      ok "$dump_file exists ($size bytes)"
    else
      fail "$dump_file NOT found"
    fi
  done

  echo "  Log file: $log ($(wc -l < "$log") lines)"
}

# Test 4: Exit screenshot
test_exitscreenshot() {
  local prg_file="${1:-}"
  if [[ -z "$prg_file" || ! -f "$prg_file" ]]; then
    echo ""
    echo -e "${CYAN}═══ Test 4: Exit Screenshot (SKIPPED — no PRG file) ═══${NC}"
    warn "Provide PRG path as first argument"
    return 0
  fi

  echo ""
  echo -e "${CYAN}═══ Test 4: Exit Screenshot (-exitscreenshot) ═══${NC}"
  echo ""

  local screenshot="$OUTPUT_DIR/screenshot.png"
  local log="$OUTPUT_DIR/test4-vice.log"
  local exit_code=0

  info "Screenshot target: $screenshot"
  info "Launching VICE with: -autostart <prg> -exitscreenshot <png> -warp -autostart-warp -limitcycles 2000000 +confirmonexit -silent -autostartprgmode 1"

  "$VICE_BIN" \
    -autostart "$prg_file" \
    -exitscreenshot "$screenshot" \
    -warp \
    -autostart-warp \
    -limitcycles 2000000 \
    +confirmonexit \
    -silent \
    -autostartprgmode 1 \
    > "$log" 2>&1 || exit_code=$?

  echo "  Exit code: $exit_code"

  if [[ -f "$screenshot" ]]; then
    local size
    size=$(wc -c < "$screenshot")
    if [[ $size -gt 0 ]]; then
      ok "Screenshot created: $screenshot ($size bytes)"
    else
      fail "Screenshot file exists but is empty"
    fi
  else
    warn "Screenshot NOT created — -exitscreenshot may not work on macOS CLI"
    info "This is expected — memory dumps are more important"
  fi

  echo "  Log file: $log ($(wc -l < "$log") lines)"
}

# Test 5: Monitor save command with -monlog for register capture
test_monitor_save() {
  local prg_file="${1:-}"
  if [[ -z "$prg_file" || ! -f "$prg_file" ]]; then
    echo ""
    echo -e "${CYAN}═══ Test 5: Monitor Save (SKIPPED — no PRG file) ═══${NC}"
    warn "Provide PRG path as first argument"
    return 0
  fi

  echo ""
  echo -e "${CYAN}═══ Test 5: Monitor Save Command — Binary Dumps + Register Capture ═══${NC}"
  echo ""

  local mon_file="$OUTPUT_DIR/test5.mon"
  local log="$OUTPUT_DIR/test5-vice.log"
  local monlog="$OUTPUT_DIR/test5-monitor.log"
  local exit_code=0

  # More comprehensive dump — includes sprite pointers and CIA
  # Also uses `r` to dump registers (output goes to monlog file)
  cat > "$mon_file" << 'MON'
; Comprehensive memory dump
save "dump_zeropage.bin" 0 0000 00ff
save "dump_screen.bin" 0 0400 07e7
save "dump_colorram.bin" 0 d800 dbe7
save "dump_vic.bin" 0 d000 d030
save "dump_sid.bin" 0 d400 d41c
save "dump_sprite_ptrs.bin" 0 07f8 07ff
save "dump_cia1.bin" 0 dc00 dc0f
save "dump_cia2.bin" 0 dd00 dd0f
r
quit
MON

  info "Monitor script: $mon_file"
  info "Monitor log: $monlog"

  # Run from output dir so save commands write files there
  pushd "$OUTPUT_DIR" > /dev/null

  # Use -monlog and -monlogname to capture register output from `r` command
  "$VICE_BIN" \
    -autostart "$prg_file" \
    -moncommands "$mon_file" \
    -monlog \
    -monlogname "$monlog" \
    -warp \
    -autostart-warp \
    -limitcycles "$VICE_CYCLES" \
    +confirmonexit \
    -silent \
    -autostartprgmode 1 \
    > "$log" 2>&1 || exit_code=$?

  popd > /dev/null

  echo "  Exit code: $exit_code"
  echo ""
  info "Dump file inventory:"

  local found=0
  local missing=0
  for dump_file in dump_zeropage.bin dump_screen.bin dump_colorram.bin dump_vic.bin dump_sid.bin dump_sprite_ptrs.bin dump_cia1.bin dump_cia2.bin; do
    local path="$OUTPUT_DIR/$dump_file"
    if [[ -f "$path" ]]; then
      local size
      size=$(wc -c < "$path")
      ok "$dump_file ($size bytes)"
      found=$((found + 1))
    else
      fail "$dump_file NOT found"
      missing=$((missing + 1))
    fi
  done

  echo ""
  info "Found: $found/8 dump files, Missing: $missing/8"

  # If VIC dump exists, show border/background color
  # NOTE: VICE dump files have a 2-byte load address header!
  # So $D020 (offset 0x20 from $D000) is at file offset 0x22 (34)
  if [[ -f "$OUTPUT_DIR/dump_vic.bin" ]]; then
    echo ""
    info "VIC-II register sample (with 2-byte header offset correction):"
    local border_hex
    border_hex=$(xxd -p -l 1 -s 34 "$OUTPUT_DIR/dump_vic.bin" 2>/dev/null || echo "??")
    local bg_hex
    bg_hex=$(xxd -p -l 1 -s 35 "$OUTPUT_DIR/dump_vic.bin" 2>/dev/null || echo "??")
    info "  \$D020 (border): \$$border_hex (lower nibble: \$$(printf '%02x' $((0x${border_hex} & 0x0F))))"
    info "  \$D021 (background): \$$bg_hex (lower nibble: \$$(printf '%02x' $((0x${bg_hex} & 0x0F))))"
  fi

  # Parse register output from monitor log file (-monlog)
  echo ""
  info "Register state from monitor log:"
  if [[ -f "$monlog" ]]; then
    info "Monitor log contents:"
    cat "$monlog" | sed 's/^/    /'

    # Try to extract register values
    if grep -q "ADDR\|\.C:" "$monlog" 2>/dev/null; then
      ok "Register output captured in monitor log"
    else
      warn "Monitor log exists but no register data found"
    fi
  else
    warn "Monitor log file not created"
    info "Checking VICE stderr log for register info:"
    if grep -q "ADDR\|\.C:" "$log" 2>/dev/null; then
      grep -E "ADDR|\.C:" "$log" | head -3 | sed 's/^/    /'
      ok "Register output found in stderr log"
    else
      warn "No register output found anywhere"
    fi
  fi

  echo "  VICE log: $log ($(wc -l < "$log") lines)"
}

# Test 6: Breakpoint approach — break + g + save (commands run AFTER program starts)
test_breakpoint_approach() {
  local prg_file="${1:-}"
  if [[ -z "$prg_file" || ! -f "$prg_file" ]]; then
    echo ""
    echo -e "${CYAN}═══ Test 6: Breakpoint Approach (SKIPPED — no PRG file) ═══${NC}"
    warn "Provide PRG path as first argument"
    return 0
  fi

  echo ""
  echo -e "${CYAN}═══ Test 6: Breakpoint + Go + Save (post-execution capture) ═══${NC}"
  echo ""

  local mon_file="$OUTPUT_DIR/test6.mon"
  local log="$OUTPUT_DIR/test6-vice.log"
  local monlog="$OUTPUT_DIR/test6-monitor.log"
  local exit_code=0

  # This tests whether: break addr → g → (program runs until breakpoint) → save → quit
  # This is CRITICAL for Phase 4 — we need to dump state AFTER the program executes
  # Using $0810 = main() entry point (known from label file)
  cat > "$mon_file" << 'MON'
; Set breakpoint at main() entry — program must reach here after BASIC SYS
break $0810
; Continue execution — KERNAL boot + autostart + SYS will reach $0810
g
; These commands run AFTER breakpoint hits (program has started)
save "bp_vic.bin" 0 d000 d030
save "bp_screen.bin" 0 0400 07e7
save "bp_zeropage.bin" 0 0000 00ff
r
quit
MON

  info "Testing: break \$0810 → g → save (captures state at main entry)"
  info "Monitor script: $mon_file"

  pushd "$OUTPUT_DIR" > /dev/null

  "$VICE_BIN" \
    -autostart "$prg_file" \
    -moncommands "$mon_file" \
    -monlog \
    -monlogname "$monlog" \
    -warp \
    -autostart-warp \
    -limitcycles "$VICE_CYCLES" \
    +confirmonexit \
    -silent \
    -autostartprgmode 1 \
    > "$log" 2>&1 || exit_code=$?

  popd > /dev/null

  echo "  Exit code: $exit_code"

  # Check if dump files exist (proves break+g+save pattern works)
  local bp_found=0
  for f in bp_vic.bin bp_screen.bin bp_zeropage.bin; do
    if [[ -f "$OUTPUT_DIR/$f" ]]; then
      bp_found=$((bp_found + 1))
    fi
  done

  if [[ $bp_found -eq 3 ]]; then
    ok "All 3 post-breakpoint dump files created ($bp_found/3)"
  elif [[ $bp_found -gt 0 ]]; then
    warn "Partial: $bp_found/3 dump files created"
  else
    fail "No post-breakpoint dump files — break+g+save pattern may not work"
  fi

  # Check monitor log for register state at breakpoint
  if [[ -f "$monlog" ]]; then
    echo ""
    info "Monitor log at breakpoint:"
    cat "$monlog" | sed 's/^/    /'

    # Check if PC is at our breakpoint ($0810) — proves program reached main
    if grep -q "0810\|\.C:0810" "$monlog" 2>/dev/null; then
      ok "PC at \$0810 — program reached main() entry point"
    else
      warn "PC not at \$0810 — check if breakpoint was hit"
    fi
  else
    warn "No monitor log created"
  fi

  echo "  Log file: $log"
}

# ─── Main ────────────────────────────────────────────────────────────────
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           VICE Feasibility Test Suite — Phase 3              ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  VICE binary: $VICE_BIN"
echo "  Output dir:  $OUTPUT_DIR"
echo "  PRG file:    ${1:-<none>}"

PRG_FILE="${1:-}"

# Run all tests
test_basic_launch
test_autostart "$PRG_FILE"
test_moncommands "$PRG_FILE"
test_exitscreenshot "$PRG_FILE"
test_monitor_save "$PRG_FILE"
test_breakpoint_approach "$PRG_FILE"

echo ""
echo -e "${CYAN}═══ Summary ═══${NC}"
echo "  Output directory: $OUTPUT_DIR"
echo "  All test artifacts saved there."
echo ""
echo "Done."
