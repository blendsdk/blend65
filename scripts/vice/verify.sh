#!/usr/bin/env bash
# =============================================================================
# vice/verify.sh — Memory and register verification against expected values
# =============================================================================
#
# Compares VICE memory dumps and register state against expected values
# defined in an expected.json file.
#
# Usage: source scripts/vice/verify.sh
#
# After sourcing, the following are available:
#   verify_memory_checks()   — Compare memory dumps against expected.json
#   verify_registers()       — Parse register state and check stack pointer
#   verify_screen_checks()   — Compare screen memory regions
#   verify_dump_files()      — Check that all dump files were created
#
# Requires:
#   - scripts/vice/env.sh sourced (provides vice_ok, vice_fail, etc.)
#   - `jq` command available for JSON parsing
#
# =============================================================================

# ---------------------------------------------------------------------------
# VICE Dump File Offset Convention
# ---------------------------------------------------------------------------
# VICE `save` command creates files with a 2-byte little-endian load address
# header. When reading a value at address $XXXX from a dump that starts at
# $YYYY, the file offset is:
#
#   file_offset = (target_address - region_start_address) + 2
#
# Example: $D020 in a dump starting at $D000:
#   offset = ($D020 - $D000) + 2 = $20 + 2 = 34 (decimal)
# ---------------------------------------------------------------------------
VICE_DUMP_HEADER_SIZE=2

# ---------------------------------------------------------------------------
# VIC-II Color Register Masking
# ---------------------------------------------------------------------------
# VIC-II color registers ($D020-$D02E) only use bits 0-3 for the color value.
# Bits 4-7 are undefined on readback and contain random garbage.
# Always mask with & $0F when comparing color register values.
#
# Affected addresses: $D020 (border), $D021 (background), $D022-$D026 (extra bg)
# ---------------------------------------------------------------------------
VIC_COLOR_MASK=0x0F

# Color register address range (decimal equivalents of $D020-$D02E)
VIC_COLOR_START=$((0xD020))
VIC_COLOR_END=$((0xD02E))

# ---------------------------------------------------------------------------
# is_vic_color_register() — Check if an address is a VIC-II color register
#
# Arguments:
#   $1 — Address in hex (e.g., "D020")
#
# Returns:
#   0 if it's a color register (needs masking), 1 otherwise
# ---------------------------------------------------------------------------
is_vic_color_register() {
  local addr_hex="$1"
  local addr_dec=$((16#$addr_hex))

  if (( addr_dec >= VIC_COLOR_START && addr_dec <= VIC_COLOR_END )); then
    return 0
  fi
  return 1
}

# ---------------------------------------------------------------------------
# verify_dump_files() — Check that expected dump files were created by VICE
#
# Arguments:
#   $1 — Output directory containing dump files
#
# Output:
#   Prints status for each expected dump file.
#   Returns count of missing files.
# ---------------------------------------------------------------------------
verify_dump_files() {
  local output_dir="$1"
  local missing=0
  local found=0

  local dump_files=(
    "dump_zeropage.bin"
    "dump_screen.bin"
    "dump_colorram.bin"
    "dump_vic.bin"
    "dump_sid.bin"
    "dump_sprite_ptrs.bin"
    "dump_cia1.bin"
    "dump_cia2.bin"
  )

  for dump_file in "${dump_files[@]}"; do
    local path="$output_dir/$dump_file"
    if [[ -f "$path" ]]; then
      local size
      size=$(wc -c < "$path" | tr -d ' ')
      found=$((found + 1))
    else
      vice_fail "Missing dump: $dump_file"
      missing=$((missing + 1))
    fi
  done

  if [[ "$missing" -eq 0 ]]; then
    vice_ok "All $found/$((found + missing)) dump files created"
  else
    vice_warn "Dumps: $found found, $missing missing"
  fi

  return "$missing"
}

# ---------------------------------------------------------------------------
# read_dump_byte() — Read a single byte from a VICE dump file
#
# Accounts for the 2-byte load address header in VICE dump files.
# Optionally applies VIC-II color masking for color registers.
#
# Arguments:
#   $1 — Path to dump file
#   $2 — Target address in hex (e.g., "D020")
#   $3 — Region start address in hex (e.g., "D000")
#   $4 — (optional) "mask" to apply VIC color masking
#
# Output:
#   Prints the byte value in lowercase hex (e.g., "06"), or "??" on error.
# ---------------------------------------------------------------------------
read_dump_byte() {
  local dump_file="$1"
  local target_hex="$2"
  local region_start_hex="$3"
  local mask_flag="${4:-}"

  if [[ ! -f "$dump_file" ]]; then
    echo "??"
    return 1
  fi

  # Calculate file offset: (target - region_start) + 2 (header)
  local target_dec=$((16#$target_hex))
  local start_dec=$((16#$region_start_hex))
  local offset=$(( (target_dec - start_dec) + VICE_DUMP_HEADER_SIZE ))

  # Read the byte using xxd
  local raw_hex
  raw_hex=$(xxd -p -l 1 -s "$offset" "$dump_file" 2>/dev/null)

  if [[ -z "$raw_hex" ]]; then
    echo "??"
    return 1
  fi

  # Apply VIC color masking if requested or if address is a color register
  if [[ "$mask_flag" == "mask" ]] || is_vic_color_register "$target_hex"; then
    local raw_dec=$((16#$raw_hex))
    local masked=$((raw_dec & VIC_COLOR_MASK))
    printf '%02x' "$masked"
  else
    echo "$raw_hex"
  fi
}

# ---------------------------------------------------------------------------
# verify_memory_checks() — Compare memory dumps against expected.json
#
# Parses the memory_checks array from expected.json and compares each
# expected value against the corresponding byte in the VICE dump file.
#
# expected.json memory_checks format:
#   {
#     "memory_checks": [
#       {
#         "address": "D020",
#         "expected": "06",
#         "description": "Border color = blue",
#         "source": "dump_vic.bin",
#         "region_start": "D000"
#       }
#     ]
#   }
#
# Arguments:
#   $1 — Path to expected.json
#   $2 — Output directory containing dump files
#
# Output:
#   Prints pass/fail for each check.
#   Writes machine-readable results to $2/memory-results.txt
#
# Returns:
#   Number of failed checks (0 = all passed)
# ---------------------------------------------------------------------------
verify_memory_checks() {
  local expected_json="$1"
  local output_dir="$2"
  local pass=0
  local fail_count=0
  local total=0

  # Validate jq is available
  if ! command -v jq &> /dev/null; then
    vice_fail "jq not found — cannot parse expected.json"
    return 1
  fi

  # Validate expected.json exists and has memory_checks
  if [[ ! -f "$expected_json" ]]; then
    vice_fail "expected.json not found: $expected_json"
    return 1
  fi

  local check_count
  check_count=$(jq '.memory_checks | length' "$expected_json" 2>/dev/null || echo "0")

  if [[ "$check_count" -eq 0 ]]; then
    vice_info "No memory checks defined in expected.json"
    return 0
  fi

  # Results file for machine-readable output
  local results_file="$output_dir/memory-results.txt"
  : > "$results_file"

  vice_header "Memory Verification ($check_count checks)"

  for ((i=0; i<check_count; i++)); do
    local addr expected desc source region_start
    addr=$(jq -r ".memory_checks[$i].address" "$expected_json")
    expected=$(jq -r ".memory_checks[$i].expected" "$expected_json")
    desc=$(jq -r ".memory_checks[$i].description" "$expected_json")
    source=$(jq -r ".memory_checks[$i].source" "$expected_json")
    region_start=$(jq -r ".memory_checks[$i].region_start" "$expected_json")

    # Normalize to lowercase for comparison
    expected=$(echo "$expected" | tr '[:upper:]' '[:lower:]')
    addr=$(echo "$addr" | tr '[:upper:]' '[:lower:]')
    region_start=$(echo "$region_start" | tr '[:upper:]' '[:lower:]')

    local dump_file="$output_dir/$source"
    total=$((total + 1))

    if [[ ! -f "$dump_file" ]]; then
      vice_fail "\$$addr: dump file $source not found ($desc)"
      echo "FAIL|$addr|??|$expected|$desc|missing_dump" >> "$results_file"
      fail_count=$((fail_count + 1))
      continue
    fi

    # Read actual byte from dump (with auto VIC color masking)
    local actual
    actual=$(read_dump_byte "$dump_file" "$addr" "$region_start")

    # Also mask expected value if it's a VIC color register
    local compare_expected="$expected"
    if is_vic_color_register "$addr"; then
      local exp_dec=$((16#$expected))
      local exp_masked=$((exp_dec & VIC_COLOR_MASK))
      compare_expected=$(printf '%02x' "$exp_masked")
    fi

    if [[ "$actual" == "$compare_expected" ]]; then
      vice_ok "\$$addr = \$$actual ($desc)"
      echo "PASS|$addr|$actual|$expected|$desc" >> "$results_file"
      pass=$((pass + 1))
    else
      vice_fail "\$$addr = \$$actual, expected \$$compare_expected ($desc)"
      echo "FAIL|$addr|$actual|$expected|$desc|mismatch" >> "$results_file"
      fail_count=$((fail_count + 1))
    fi
  done

  echo ""
  echo "  Memory checks: $pass/$total passed, $fail_count failed"
  echo "memory_pass=$pass" >> "$results_file"
  echo "memory_fail=$fail_count" >> "$results_file"
  echo "memory_total=$total" >> "$results_file"

  return "$fail_count"
}

# ---------------------------------------------------------------------------
# verify_screen_checks() — Compare screen memory regions
#
# Verifies contiguous screen memory regions against expected hex strings.
# Useful for checking text output on the C64 screen.
#
# expected.json screen_checks format:
#   {
#     "screen_checks": [
#       {
#         "row": 3,
#         "col": 14,
#         "length": 12,
#         "expected": "01001F041D2600160C001F0F",
#         "description": "Message on row 3"
#       }
#     ]
#   }
#
# Arguments:
#   $1 — Path to expected.json
#   $2 — Output directory containing dump files
#
# Returns:
#   Number of failed checks (0 = all passed)
# ---------------------------------------------------------------------------
verify_screen_checks() {
  local expected_json="$1"
  local output_dir="$2"
  local pass=0
  local fail_count=0

  local check_count
  check_count=$(jq '.screen_checks | length' "$expected_json" 2>/dev/null || echo "0")

  if [[ "$check_count" -eq 0 ]]; then
    return 0
  fi

  local screen_dump="$output_dir/dump_screen.bin"
  if [[ ! -f "$screen_dump" ]]; then
    vice_fail "Screen dump not found: $screen_dump"
    return 1
  fi

  vice_header "Screen Verification ($check_count checks)"

  for ((i=0; i<check_count; i++)); do
    local row col length expected desc
    row=$(jq -r ".screen_checks[$i].row" "$expected_json")
    col=$(jq -r ".screen_checks[$i].col" "$expected_json")
    length=$(jq -r ".screen_checks[$i].length" "$expected_json")
    expected=$(jq -r ".screen_checks[$i].expected" "$expected_json")
    desc=$(jq -r ".screen_checks[$i].description" "$expected_json")

    # Screen memory starts at $0400, 40 chars per row
    # File offset = (row * 40 + col) + 2 (header)
    local screen_offset=$(( (row * 40 + col) + VICE_DUMP_HEADER_SIZE ))

    # Read bytes from dump
    local actual
    actual=$(xxd -p -l "$length" -s "$screen_offset" "$screen_dump" 2>/dev/null | tr -d '\n')

    # Normalize for comparison
    expected=$(echo "$expected" | tr '[:upper:]' '[:lower:]')
    actual=$(echo "$actual" | tr '[:upper:]' '[:lower:]')

    if [[ "$actual" == "$expected" ]]; then
      vice_ok "Screen[$row,$col] ($desc)"
      pass=$((pass + 1))
    else
      vice_fail "Screen[$row,$col]: got $actual, expected $expected ($desc)"
      fail_count=$((fail_count + 1))
    fi
  done

  echo ""
  echo "  Screen checks: $pass/$((pass + fail_count)) passed, $fail_count failed"

  return "$fail_count"
}

# ---------------------------------------------------------------------------
# verify_registers() — Parse VICE register output and check stack pointer
#
# Reads the monitor log file (-monlogname output) to extract register state.
# Checks the stack pointer against a minimum threshold to detect stack leaks.
#
# VICE register output format (from `r` command in monitor log):
#   .;ADDR AC XR YR SP 00 01 NV-BDIZC LIN CYC  STOPWATCH
#   .;0810 00 00 00 f6 2f 37 00100000 180 042    3038406
#
# expected.json register/stack checks:
#   {
#     "stack_check": {
#       "sp_min": "F0",
#       "description": "Stack pointer near top (no leak)"
#     },
#     "register_checks": {
#       "pc_range": ["0800", "CFFF"],
#       "description": "PC in user RAM"
#     }
#   }
#
# Arguments:
#   $1 — Path to monitor.log (from -monlogname)
#   $2 — Path to expected.json
#   $3 — Output directory (writes register-results.txt)
#
# Returns:
#   Number of failed checks (0 = all passed)
# ---------------------------------------------------------------------------
verify_registers() {
  local monlog="$1"
  local expected_json="$2"
  local output_dir="$3"
  local fail_count=0

  local results_file="$output_dir/register-results.txt"
  : > "$results_file"

  if [[ ! -f "$monlog" ]]; then
    vice_warn "No monitor log — register checks skipped"
    echo "register_status=skipped" >> "$results_file"
    return 0
  fi

  vice_header "Register Verification"

  # Extract register line — look for the ".;XXXX" format line
  # The register dump line starts with ".;" followed by the PC address
  local reg_line
  reg_line=$(grep '^\.\;' "$monlog" | tail -1)

  if [[ -z "$reg_line" ]]; then
    vice_warn "No register data found in monitor log"
    echo "register_status=no_data" >> "$results_file"
    return 0
  fi

  # Parse register values from the line:
  # Format: .;ADDR AC XR YR SP 00 01 NV-BDIZC LIN CYC  STOPWATCH
  # Remove the ".;" prefix and parse fields
  local fields
  fields=$(echo "$reg_line" | sed 's/^\.\;//')

  local pc ac xr yr sp zp00 zp01 flags
  pc=$(echo "$fields" | awk '{print $1}')
  ac=$(echo "$fields" | awk '{print $2}')
  xr=$(echo "$fields" | awk '{print $3}')
  yr=$(echo "$fields" | awk '{print $4}')
  sp=$(echo "$fields" | awk '{print $5}')
  zp00=$(echo "$fields" | awk '{print $6}')
  zp01=$(echo "$fields" | awk '{print $7}')
  flags=$(echo "$fields" | awk '{print $8}')

  vice_info "PC=\$$pc  A=\$$ac  X=\$$xr  Y=\$$yr  SP=\$$sp  Flags=$flags"
  echo "pc=$pc" >> "$results_file"
  echo "ac=$ac" >> "$results_file"
  echo "xr=$xr" >> "$results_file"
  echo "yr=$yr" >> "$results_file"
  echo "sp=$sp" >> "$results_file"
  echo "flags=$flags" >> "$results_file"

  # --- Stack pointer check ---
  if [[ -f "$expected_json" ]]; then
    local sp_min
    sp_min=$(jq -r '.stack_check.sp_min // empty' "$expected_json" 2>/dev/null)

    if [[ -n "$sp_min" ]]; then
      local sp_dec=$((16#$sp))
      local sp_min_dec=$((16#$sp_min))

      if (( sp_dec >= sp_min_dec )); then
        vice_ok "Stack pointer SP=\$$sp (>= \$$sp_min) — no stack leak"
        echo "stack_check=PASS" >> "$results_file"
      else
        vice_fail "Stack pointer SP=\$$sp (< \$$sp_min) — possible stack leak!"
        echo "stack_check=FAIL" >> "$results_file"
        fail_count=$((fail_count + 1))
      fi
    fi

    # --- PC range check ---
    local pc_low pc_high
    pc_low=$(jq -r '.register_checks.pc_range[0] // empty' "$expected_json" 2>/dev/null)
    pc_high=$(jq -r '.register_checks.pc_range[1] // empty' "$expected_json" 2>/dev/null)

    if [[ -n "$pc_low" && -n "$pc_high" ]]; then
      local pc_dec=$((16#$pc))
      local low_dec=$((16#$pc_low))
      local high_dec=$((16#$pc_high))

      if (( pc_dec >= low_dec && pc_dec <= high_dec )); then
        vice_ok "PC=\$$pc in range [\$$pc_low, \$$pc_high]"
        echo "pc_check=PASS" >> "$results_file"
      else
        vice_fail "PC=\$$pc outside range [\$$pc_low, \$$pc_high]"
        echo "pc_check=FAIL" >> "$results_file"
        fail_count=$((fail_count + 1))
      fi
    fi
  fi

  echo "register_status=complete" >> "$results_file"
  echo "register_fail=$fail_count" >> "$results_file"

  return "$fail_count"
}
