#!/usr/bin/env bash
# =============================================================================
# vice/run.sh — VICE emulator execution
# =============================================================================
#
# Launches VICE with proper arguments for automated diagnostic testing.
# Handles autostart, warp mode, cycle limits, monitor commands, and
# screenshot capture.
#
# Usage: source scripts/vice/run.sh
#
# After sourcing, the following are available:
#   run_vice()          — Launch VICE with full diagnostic configuration
#   run_vice_simple()   — Simplified launch (just run + screenshot)
#
# Requires: scripts/vice/env.sh must be sourced first (provides VICE_BIN)
#
# =============================================================================

# ---------------------------------------------------------------------------
# run_vice() — Launch VICE with full diagnostic configuration
#
# Uses the -initbreak approach discovered in Phase 3 testing:
#   -initbreak <addr> defers -moncommands until the specified address
#   is reached, ensuring dumps capture post-boot program state.
#
# Arguments:
#   $1 — Path to the PRG file to run
#   $2 — Path to the .mon file (monitor commands)
#   $3 — Output directory (VICE writes dump files relative to CWD)
#   $4 — Break address in hex (e.g., "0810" for main entry)
#   $5 — Cycle limit (default: $VICE_DEFAULT_CYCLES = 10000000)
#
# Output files created in $output_dir:
#   vice.log        — VICE stdout/stderr
#   monitor.log     — Monitor command output (register state from `r`)
#   screenshot.png  — Exit screenshot (384x272 PNG)
#   dump_*.bin      — Memory region dumps from .mon save commands
#
# Returns:
#   0 if VICE exited cleanly (monitor quit), 1 if cycle limit reached,
#   other values indicate VICE errors.
#
# Exit code semantics (from Phase 3 testing):
#   0 = monitor `quit` command → clean exit
#   1 = -limitcycles reached → program didn't complete in time
# ---------------------------------------------------------------------------
run_vice() {
  local prg_file="$1"
  local mon_file="$2"
  local output_dir="$3"
  local break_addr="$4"
  local cycles="${5:-$VICE_DEFAULT_CYCLES}"

  local vice_log="$output_dir/vice.log"
  local monlog="$output_dir/monitor.log"
  local screenshot="$output_dir/screenshot.png"

  # Validate inputs
  if [[ ! -f "$prg_file" ]]; then
    vice_fail "PRG file not found: $prg_file"
    return 2
  fi

  if [[ ! -f "$mon_file" ]]; then
    vice_fail "Monitor script not found: $mon_file"
    return 2
  fi

  if [[ -z "$VICE_BIN" || "$VICE_AVAILABLE" != "yes" ]]; then
    vice_fail "VICE not available — call detect_vice() first"
    return 2
  fi

  # Ensure output directory exists
  mkdir -p "$output_dir"

  # Convert output_dir to absolute path BEFORE cd — relative paths break after cd
  output_dir="$(cd "$output_dir" && pwd)"
  vice_log="$output_dir/vice.log"
  monlog="$output_dir/monitor.log"
  screenshot="$output_dir/screenshot.png"

  # Save original directory — VICE monitor `save` commands write relative to CWD
  local original_dir
  original_dir=$(pwd)

  # Change to output dir so dump files are written there
  cd "$output_dir" || return 2

  local exit_code=0

  # Build VICE command line based on Phase 3 findings:
  # - -initbreak defers moncommands until break address is reached
  # - -monlog + -monlogname captures register output from `r` command
  # - -exitscreenshot captures visual state at exit
  # - -autostartprgmode 1 uses inject mode (direct memory injection)
  # - -autostart-warp speeds up KERNAL boot
  if [[ -n "$break_addr" ]]; then
    # Use -initbreak to defer moncommands until program reaches break_addr
    # VICE expects 0x prefix for hex addresses (not $ prefix)
    "$VICE_BIN" \
      -autostart "$prg_file" \
      -initbreak "0x${break_addr}" \
      -moncommands "$mon_file" \
      -monlog \
      -monlogname "$monlog" \
      -exitscreenshot "$screenshot" \
      -warp \
      -autostart-warp \
      -limitcycles "$cycles" \
      +confirmonexit \
      -silent \
      -autostartprgmode 1 \
      > "$vice_log" 2>&1 || exit_code=$?
  else
    # No break address — moncommands run at VICE startup (less useful for diagnostics)
    "$VICE_BIN" \
      -autostart "$prg_file" \
      -moncommands "$mon_file" \
      -monlog \
      -monlogname "$monlog" \
      -exitscreenshot "$screenshot" \
      -warp \
      -autostart-warp \
      -limitcycles "$cycles" \
      +confirmonexit \
      -silent \
      -autostartprgmode 1 \
      > "$vice_log" 2>&1 || exit_code=$?
  fi

  # Return to original directory
  cd "$original_dir" || true

  return $exit_code
}

# ---------------------------------------------------------------------------
# run_vice_simple() — Simplified VICE launch (just run + screenshot)
#
# Runs a PRG file in VICE without monitor commands. Useful for quick
# visual verification via exit screenshot only.
#
# Arguments:
#   $1 — Path to the PRG file
#   $2 — Output directory
#   $3 — Cycle limit (default: $VICE_DEFAULT_CYCLES)
#
# Output files:
#   vice.log        — VICE stdout/stderr
#   screenshot.png  — Exit screenshot
#
# Returns:
#   VICE exit code (0 = clean, 1 = cycle limit)
# ---------------------------------------------------------------------------
run_vice_simple() {
  local prg_file="$1"
  local output_dir="$2"
  local cycles="${3:-$VICE_DEFAULT_CYCLES}"

  local vice_log="$output_dir/vice.log"
  local screenshot="$output_dir/screenshot.png"

  mkdir -p "$output_dir"

  local exit_code=0

  "$VICE_BIN" \
    -autostart "$prg_file" \
    -exitscreenshot "$screenshot" \
    -warp \
    -autostart-warp \
    -limitcycles "$cycles" \
    +confirmonexit \
    -silent \
    -autostartprgmode 1 \
    > "$vice_log" 2>&1 || exit_code=$?

  return $exit_code
}
