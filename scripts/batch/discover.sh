#!/usr/bin/env bash
# =============================================================================
# batch/discover.sh — Test program discovery for batch diagnostics
# =============================================================================
#
# Discovers Blend test programs in a suite directory. Each test program is
# expected to be a subfolder containing a main.blend entry file, and
# optionally an expected.json for VICE runtime verification.
#
# Expected directory structure:
#   <suite-dir>/
#   ├── 01-byte-arithmetic/
#   │   ├── main.blend         # Required — entry file
#   │   ├── expected.json      # Optional — VICE verification spec
#   │   └── README.md          # Optional — test documentation
#   ├── 02-word-arithmetic/
#   │   ├── main.blend
#   │   └── expected.json
#   └── ...
#
# Also supports non-test-suite directories like examples/ where programs
# are organized by name rather than numbered prefix.
#
# Requires: batch/env.sh to be sourced first
#
# =============================================================================

# ---------------------------------------------------------------------------
# discover_tests() — Find all test programs in a suite directory
#
# Searches for */main.blend patterns in the given directory. Each match
# becomes a test entry. Results are stored in the global BATCH_TESTS array.
#
# Arguments:
#   $1 — Suite directory path to search
#
# Populates globals:
#   BATCH_TESTS         — Array of test entry file paths (absolute)
#   BATCH_TEST_NAMES    — Array of test names (directory basenames)
#   BATCH_TEST_DIRS     — Array of test directories (absolute)
#   BATCH_TEST_COUNT    — Number of tests discovered
#   BATCH_HAS_EXPECTED  — Array of "yes"/"no" for expected.json presence
#
# Returns:
#   0 if tests found, 1 if no tests found
# ---------------------------------------------------------------------------
discover_tests() {
  local suite_dir="$1"

  # Initialize global arrays
  BATCH_TESTS=()
  BATCH_TEST_NAMES=()
  BATCH_TEST_DIRS=()
  BATCH_HAS_EXPECTED=()
  BATCH_TEST_COUNT=0

  # Validate suite directory exists
  if [[ ! -d "$suite_dir" ]]; then
    batch_fail "Suite directory not found: $suite_dir"
    return 1
  fi

  # Make suite_dir absolute for consistent paths
  suite_dir="$(cd "$suite_dir" && pwd)"

  # Find all main.blend files in immediate subdirectories
  # Sort to ensure consistent ordering (numbered prefixes sort naturally)
  # Use -L to follow symlinks (batch test suites may use symlinks)
  local blend_files=()
  while IFS= read -r -d '' blend_file; do
    blend_files+=("$blend_file")
  done < <(find -L "$suite_dir" -maxdepth 2 -name "main.blend" -type f -print0 | sort -z)

  # Also check for *.blend files that aren't named main.blend but are the
  # only .blend file in their directory (for examples like sprite-test/)
  for dir in "$suite_dir"/*/; do
    [[ ! -d "$dir" ]] && continue

    # Skip if we already found main.blend here
    if [[ -f "${dir}main.blend" ]]; then
      continue
    fi

    # Check for a single .blend file as the entry point
    local blend_count
    blend_count=$(find "$dir" -maxdepth 1 -name "*.blend" -type f | wc -l | tr -d ' ')
    if [[ "$blend_count" -eq 1 ]]; then
      local single_blend
      single_blend=$(find "$dir" -maxdepth 1 -name "*.blend" -type f)
      blend_files+=("$single_blend")
    fi
  done

  # Deduplicate and sort (guard against empty array with set -u)
  local sorted_files=()
  if [[ ${#blend_files[@]} -gt 0 ]]; then
    while IFS= read -r f; do
      [[ -n "$f" ]] && sorted_files+=("$f")
    done < <(printf '%s\n' "${blend_files[@]}" | sort -u)
  fi

  # Populate result arrays (guard against empty array with set -u)
  for blend_file in ${sorted_files[@]+"${sorted_files[@]}"}; do
    local test_dir
    test_dir="$(dirname "$blend_file")"
    local test_name
    test_name="$(basename "$test_dir")"

    # Skip directories named "lib" (shared library files, not tests)
    if [[ "$test_name" == "lib" ]]; then
      continue
    fi

    BATCH_TESTS+=("$blend_file")
    BATCH_TEST_NAMES+=("$test_name")
    BATCH_TEST_DIRS+=("$test_dir")

    # Check if expected.json exists for VICE verification
    if [[ -f "$test_dir/expected.json" ]]; then
      BATCH_HAS_EXPECTED+=("yes")
    else
      BATCH_HAS_EXPECTED+=("no")
    fi
  done

  BATCH_TEST_COUNT=${#BATCH_TESTS[@]}

  if [[ "$BATCH_TEST_COUNT" -eq 0 ]]; then
    batch_fail "No test programs found in: $suite_dir"
    batch_info "Expected structure: <suite-dir>/<test-name>/main.blend"
    return 1
  fi

  return 0
}

# ---------------------------------------------------------------------------
# print_discovered_tests() — Display discovered tests in a formatted table
#
# Prints a summary table of all discovered test programs, including whether
# they have an expected.json for VICE verification.
#
# Arguments: None (uses global BATCH_* arrays)
#
# Output: Formatted table to stdout
# ---------------------------------------------------------------------------
print_discovered_tests() {
  batch_info "Discovered $BATCH_TEST_COUNT test program(s):"
  echo ""

  printf "  %-4s %-30s %-12s %s\n" "#" "Test Name" "VICE Spec" "Entry File"
  printf "  %-4s %-30s %-12s %s\n" "----" "------------------------------" "------------" "----------"

  for i in "${!BATCH_TESTS[@]}"; do
    local idx=$((i + 1))
    local name="${BATCH_TEST_NAMES[$i]}"
    local has_exp="${BATCH_HAS_EXPECTED[$i]}"
    local entry="${BATCH_TESTS[$i]}"

    local exp_str
    if [[ "$has_exp" == "yes" ]]; then
      exp_str="✅ yes"
    else
      exp_str="—"
    fi

    printf "  %-4s %-30s %-12s %s\n" "$idx" "$name" "$exp_str" "$entry"
  done

  echo ""
}
