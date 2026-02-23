#!/usr/bin/env bash
# =============================================================================
# batch/env.sh — Shared environment for batch diagnostic scripts
# =============================================================================
#
# Provides constants, ANSI colors, and utility functions used by all batch
# diagnostic modules. Sourced by diag_batch.sh and sibling modules.
#
# Usage (from another script):
#   source "$(dirname "${BASH_SOURCE[0]}")/batch/env.sh"
#
# =============================================================================

# ---------------------------------------------------------------------------
# Ensure node/yarn are available (NVM environments)
# ---------------------------------------------------------------------------
# When scripts are invoked from non-interactive shells (e.g., AI agents,
# cron jobs), NVM may not be loaded. Source it if node isn't in PATH.
if ! command -v node &> /dev/null; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    source "$NVM_DIR/nvm.sh"
    # Activate latest stable node if no version is selected
    if ! command -v node &> /dev/null; then
      nvm use node &> /dev/null || true
    fi
  fi
fi

# ---------------------------------------------------------------------------
# ANSI Colors (matching diag_app.sh for visual consistency)
# ---------------------------------------------------------------------------

BATCH_RED='\033[0;31m'
BATCH_GREEN='\033[0;32m'
BATCH_YELLOW='\033[1;33m'
BATCH_CYAN='\033[0;36m'
BATCH_GRAY='\033[0;90m'
BATCH_BOLD='\033[1m'
BATCH_NC='\033[0m'

# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

# Print a styled header banner
batch_header() {
  echo ""
  echo -e "${BATCH_BOLD}${BATCH_CYAN}════════════════════════════════════════════════════════════${BATCH_NC}"
  echo -e "${BATCH_BOLD}${BATCH_CYAN}  $1${BATCH_NC}"
  echo -e "${BATCH_BOLD}${BATCH_CYAN}════════════════════════════════════════════════════════════${BATCH_NC}"
  echo ""
}

# Print a sub-header
batch_subheader() {
  echo -e "${BATCH_BOLD}── $1 ──${BATCH_NC}"
}

# Print success message
batch_ok() {
  echo -e "  ${BATCH_GREEN}✅ $1${BATCH_NC}"
}

# Print failure message
batch_fail() {
  echo -e "  ${BATCH_RED}❌ $1${BATCH_NC}"
}

# Print info message
batch_info() {
  echo -e "  ${BATCH_GRAY}$1${BATCH_NC}"
}

# Print warning message
batch_warn() {
  echo -e "  ${BATCH_YELLOW}⚠️  $1${BATCH_NC}"
}

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Default output directory for batch runs
BATCH_DEFAULT_OUTPUT="build/diag/batch"

# Scripts that batch mode delegates to (relative to project root)
DIAG_APP_SCRIPT="./scripts/diag_app.sh"
DIAG_VICE_SCRIPT="./scripts/diag_vice.sh"

# Optimization levels (must match diag_app.sh)
BATCH_LEVELS=("O0" "O1" "O1s" "O1z" "O2" "Os" "Oz" "O3" "O3s" "O3z")

# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

# Get file size in bytes (cross-platform macOS/Linux)
batch_filesize() {
  if [[ -f "$1" ]]; then
    wc -c < "$1" | tr -d ' '
  else
    echo "0"
  fi
}

# Get current timestamp in ISO-like format for report generation
batch_timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

# Make a path absolute (resolve relative paths)
# Arguments:
#   $1 — Path to resolve
# Output:
#   Absolute path printed to stdout
batch_abspath() {
  local path="$1"
  if [[ "$path" == /* ]]; then
    echo "$path"
  else
    echo "$(cd "$(dirname "$path")" 2>/dev/null && pwd)/$(basename "$path")"
  fi
}
