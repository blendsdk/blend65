#!/bin/bash

# Agent script for managing VS Code settings during AI tasks
# Usage: agent.sh [start|finished]

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VSCODE_DIR="$PROJECT_ROOT/.vscode"

# Source and target files
SETTINGS_CLINE="$VSCODE_DIR/settings.json.cline"
SETTINGS_AUTO="$VSCODE_DIR/settings.json.auto"
SETTINGS_TARGET="$VSCODE_DIR/settings.json"

# Function to copy settings with validation
copy_settings() {
    local source="$1"
    local action="$2"

    if [[ ! -f "$source" ]]; then
        echo "Error: Source file not found: $source" >&2
        exit 1
    fi

    echo "Agent: Switching to $action mode..."
    cp "$source" "$SETTINGS_TARGET"
    echo "Agent: Settings updated successfully ($(basename "$source") → settings.json)"
}

# Main logic
case "${1:-}" in
    "start")
        copy_settings "$SETTINGS_CLINE" "development"
        ;;
    "finished")
        copy_settings "$SETTINGS_AUTO" "completion"
        ;;
    "")
        echo "Usage: $0 {start|finished}" >&2
        echo "" >&2
        echo "Commands:" >&2
        echo "  start    - Switch to development mode (settings.json.cline → settings.json)" >&2
        echo "  finished - Switch to completion mode (settings.json.auto → settings.json)" >&2
        exit 1
        ;;
    *)
        echo "Error: Invalid parameter '$1'" >&2
        echo "Usage: $0 {start|finished}" >&2
        exit 1
        ;;
esac
