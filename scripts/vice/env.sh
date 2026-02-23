#!/usr/bin/env bash
# =============================================================================
# vice/env.sh — VICE environment setup and binary detection
# =============================================================================
#
# Provides VICE binary path detection, macOS app bundle environment variables,
# and shared utility functions for all VICE diagnostic scripts.
#
# Usage: source scripts/vice/env.sh
#
# After sourcing, the following are available:
#   VICE_BIN          — Path to x64sc binary
#   VICE_AVAILABLE    — "yes" or "no"
#   vice_ok()         — Print green success message
#   vice_fail()       — Print red failure message
#   vice_warn()       — Print yellow warning message
#   vice_info()       — Print gray info message
#   setup_vice_env()  — Configure environment for VICE app bundle
#   detect_vice()     — Detect VICE binary and set VICE_AVAILABLE
#   parse_label_address() — Extract address from ACME label file
#
# =============================================================================

# ---------------------------------------------------------------------------
# ANSI Colors
# ---------------------------------------------------------------------------
VICE_RED='\033[0;31m'
VICE_GREEN='\033[0;32m'
VICE_YELLOW='\033[1;33m'
VICE_CYAN='\033[0;36m'
VICE_GRAY='\033[0;90m'
VICE_BOLD='\033[1m'
VICE_NC='\033[0m'

# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

vice_ok()   { echo -e "  ${VICE_GREEN}✅ $1${VICE_NC}"; }
vice_fail() { echo -e "  ${VICE_RED}❌ $1${VICE_NC}"; }
vice_warn() { echo -e "  ${VICE_YELLOW}⚠️  $1${VICE_NC}"; }
vice_info() { echo -e "  ${VICE_GRAY}$1${VICE_NC}"; }

vice_header() {
  echo ""
  echo -e "${VICE_BOLD}${VICE_CYAN}── $1 ──${VICE_NC}"
  echo ""
}

# ---------------------------------------------------------------------------
# setup_vice_env() — Configure macOS app bundle environment for VICE
#
# VICE on macOS runs as an app bundle and needs XDG/GTK environment
# variables to find its ROM files, keymaps, and GTK resources.
# Without these, VICE fails silently or produces incomplete output.
#
# These are benign warnings that can be ignored after setup:
#   - "Error - failed to retrieve executable path"
#   - "DriveROM: Error - 2000/4000/CMDHD ROM image not found"
#   - "Filesystem Image Probe: Error - Import GCR"
# ---------------------------------------------------------------------------
setup_vice_env() {
  local vice_app="${1:-/Users/gevik/workdir/vice/VICE.app}"
  local resources="$vice_app/Contents/Resources"

  export XDG_CONFIG_DIRS="$resources/etc/xdg"
  export XDG_DATA_DIRS="$resources/share"
  export GTK_DATA_PREFIX="$resources"
  export GTK_EXE_PREFIX="$resources"
  export GTK_PATH="$resources"
  export GDK_PIXBUF_MODULE_FILE="$resources/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache"
  export GTK_IM_MODULE_FILE="$resources/lib/gtk-3.0/3.0.0/immodules.cache"
}

# ---------------------------------------------------------------------------
# detect_vice() — Find and validate the VICE x64sc binary
#
# Checks the default macOS app bundle location first, then falls back
# to PATH lookup. Sets VICE_BIN and VICE_AVAILABLE globals.
#
# Returns:
#   0 if VICE found, 1 if not found
# ---------------------------------------------------------------------------
detect_vice() {
  local default_path="/Users/gevik/workdir/vice/VICE.app/Contents/Resources/bin/x64sc"

  if [[ -x "$default_path" ]]; then
    VICE_BIN="$default_path"
    VICE_AVAILABLE="yes"
    setup_vice_env "/Users/gevik/workdir/vice/VICE.app"
    return 0
  elif command -v x64sc &> /dev/null; then
    VICE_BIN=$(command -v x64sc)
    VICE_AVAILABLE="yes"
    return 0
  else
    VICE_BIN=""
    VICE_AVAILABLE="no"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# parse_label_address() — Extract a symbol address from ACME label file
#
# ACME label files have the format:
#   name = $XXXX ; comment
#   name\t= $XXXX\t; comment
#
# Arguments:
#   $1 — Path to the ACME label file (output.labels)
#   $2 — Symbol name to find (e.g., "main")
#
# Output:
#   Prints the hex address (without $) to stdout, or empty if not found.
#   Example: "0810"
#
# Returns:
#   0 if found, 1 if not found
# ---------------------------------------------------------------------------
parse_label_address() {
  local labels_file="$1"
  local symbol_name="$2"

  if [[ ! -f "$labels_file" ]]; then
    return 1
  fi

  # Search for the symbol name at the start of a line (possibly with leading whitespace/tab)
  # ACME format: "name\t= $XXXX\t; comment" or "name = $XXXX ; comment"
  local line
  line=$(grep -E "^[[:space:]]*${symbol_name}[[:space:]]*=" "$labels_file" | head -1)

  if [[ -z "$line" ]]; then
    return 1
  fi

  # Extract hex address: everything after '= $', strip trailing comment and whitespace
  local addr
  addr=$(echo "$line" | sed 's/.*=.*\$\([0-9a-fA-F]*\).*/\1/' | tr -d ' \t')

  if [[ -n "$addr" ]]; then
    echo "$addr"
    return 0
  fi

  return 1
}

# ---------------------------------------------------------------------------
# Default cycle count for VICE execution
# C64 KERNAL boot + autostart needs ~3M cycles before main() executes.
# 10M gives programs ~7 seconds of C64 runtime after boot.
# ---------------------------------------------------------------------------
VICE_DEFAULT_CYCLES=20000000

# ---------------------------------------------------------------------------
# Initialize VICE detection on source
# ---------------------------------------------------------------------------
VICE_BIN=""
VICE_AVAILABLE="no"
