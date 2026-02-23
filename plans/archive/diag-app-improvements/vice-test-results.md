# VICE Feasibility Test Results

> **Date**: 2026-02-22
> **VICE Version**: 3.10 (x86_64, runs under Rosetta on Apple Silicon)
> **Binary**: `/Users/gevik/workdir/vice/VICE.app/Contents/Resources/bin/x64sc`
> **Test Scripts**: `scripts/vice-test.sh`, `scripts/debug-vice-breakpoint.sh`

## Executive Summary

**All critical VICE features work on macOS.** The diagnostic tool can:
- ✅ Launch VICE headlessly with warp mode and cycle limits
- ✅ Autostart PRG files (inject mode)
- ✅ Dump any memory region via monitor `save` command
- ✅ Capture register state via `-monlog`
- ✅ Take exit screenshots (PNG, 384×272)
- ✅ **Defer monitor commands until a specific address is reached** (`-initbreak`)
- ✅ **Execute commands after breakpoint** (`break + g + save` pattern)

## Environment Setup

VICE macOS app bundle requires environment variables to find its resources:

```bash
VICE_APP="/Users/gevik/workdir/vice/VICE.app"
BUNDLE_RESOURCES="$VICE_APP/Contents/Resources"
VICE_BIN="$BUNDLE_RESOURCES/bin/x64sc"

export XDG_CONFIG_DIRS="$BUNDLE_RESOURCES/etc/xdg"
export XDG_DATA_DIRS="$BUNDLE_RESOURCES/share"
export GTK_DATA_PREFIX="$BUNDLE_RESOURCES"
export GTK_EXE_PREFIX="$BUNDLE_RESOURCES"
export GTK_PATH="$BUNDLE_RESOURCES"
export GDK_PIXBUF_MODULE_FILE="$BUNDLE_RESOURCES/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache"
```

**Benign warnings** (can be ignored):
- `Error - failed to retrieve executable path, falling back to getcwd() + argv[0]`
- `DriveROM: Error - 2000/4000/CMDHD ROM image not found`
- `Error - Requested graphics output driver PNG not found`
- `Filesystem Image Probe: Error - Import GCR: Unknown GCR image version 50`

## Test Results

### Test 1: Basic Launch (`-warp -limitcycles +confirmonexit`)

| Feature | Status | Notes |
|---------|--------|-------|
| `-warp` | ✅ Works | Runs at max speed |
| `-limitcycles N` | ✅ Works | Exits when cycle count reached |
| `+confirmonexit` | ✅ Works | No confirmation dialog on exit |
| `-silent` | ✅ Works | Suppresses most log output |
| Exit code | 1 | Exit code 1 when cycle limit reached |

**Minimum cycles for KERNAL boot**: ~2M cycles to reach BASIC ready.

### Test 2: Autostart (`-autostart -autostartprgmode 1`)

| Feature | Status | Notes |
|---------|--------|-------|
| `-autostart <prg>` | ✅ Works | Loads and runs PRG file |
| `-autostartprgmode 1` | ✅ Works | Inject mode (direct memory injection) |
| `-autostart-warp` | ✅ Works | Warp during autostart for faster boot |
| Exit code | 1 | Cycle limit reached after program starts |

**Important**: The C64 KERNAL boot + autostart needs ~3M cycles before the program's `main()` executes. Use at least 5M cycles for programs that do work.

### Test 3: Monitor Commands (`-moncommands`)

| Feature | Status | Notes |
|---------|--------|-------|
| `save "file" device start end` | ✅ Works | Creates binary dump files |
| `r` (registers) | ✅ Works | Shows register state |
| `quit` | ✅ Works | Clean exit (exit code 0) |
| Exit code | 0 | `quit` in monitor = clean exit |

**⚠️ CRITICAL FINDING**: `-moncommands` executes at VICE startup (cycle 6, PC=$FCE2 KERNAL reset), NOT after the program loads. To dump post-execution state, use `-initbreak` or `break + g + save`.

### Test 4: Exit Screenshot (`-exitscreenshot`)

| Feature | Status | Notes |
|---------|--------|-------|
| `-exitscreenshot <file.png>` | ✅ Works | PNG screenshot on exit |
| Screenshot format | PNG | 384×272, 8-bit RGBA, ~832 bytes |
| Works on macOS CLI | ✅ Yes | No display server needed |

### Test 5: Comprehensive Memory Dumps + Register Capture

| Feature | Status | Notes |
|---------|--------|-------|
| `-monlog` | ✅ Works | Enables monitor output logging |
| `-monlogname <file>` | ✅ Works | Captures all monitor output to file |
| Register capture | ✅ Works | Full register state in monitor log |
| All 8 dump regions | ✅ 8/8 | zeropage, screen, colorram, VIC, SID, sprites, CIA1, CIA2 |

**Register output format** (from `-monlogname`):
```
  ADDR A  X  Y  SP 00 01 NV-BDIZC LIN CYC  STOPWATCH
.;0810 00 00 00 f6 2f 37 00100000 180 042    3038406
```

Fields: PC, Accumulator, X, Y, Stack Pointer, $00, $01, Status flags, Raster line, Cycle, Stopwatch.

### Test 6: Post-Execution Capture (Breakpoint Approaches)

**Four approaches tested — all successful:**

| Approach | Dump Files | PC at Dump | Cycles | Status |
|----------|-----------|------------|--------|--------|
| A: Plain moncommands | 1 | $FCE2 (KERNAL reset) | 6 | ✅ Baseline |
| B: `break + g + save` | 2 | $0810 (main entry) | 3,038,406 | ✅ Works |
| C: `-initbreak ready` | 2 | $E5CF (BASIC ready) | 2,142,506 | ✅ Works |
| D: `-initbreak $0810` | 2 | $0810 (main entry) | 3,138,397 | ✅ **Best** |

**Recommended approach for Phase 4: `-initbreak <address>` + `-moncommands`**

This is the cleanest approach because:
1. No `g` command needed in the .mon file
2. Moncommands are deferred until the address is reached
3. Address can be read from the ACME label file (e.g., `main` label)
4. Register state shows PC at the expected location

## Dump File Format

**VICE `save` command produces files with a 2-byte load address header:**

```
Byte 0-1: Start address (little-endian)
Byte 2+:  Actual memory contents
```

**Example — VIC-II registers ($D000-$D030):**
```
Offset 0:  $00 $D0  (= $D000, the start address)
Offset 2:  $D000 value (sprite 0 X position)
...
Offset 34: $D020 value (border color) = header(2) + $20
Offset 35: $D021 value (background color) = header(2) + $21
```

**⚠️ When reading values, always add +2 for the header offset:**
```
file_offset = (target_address - region_start_address) + 2
```

## VIC-II Color Register Behavior

**Upper nibble of color registers may contain garbage:**
```
$D020 reads as $F0 → actual color = $F0 & $0F = $00 (black)
```
The C64 VIC-II only uses bits 0-3 for color values. Bits 4-7 are undefined on readback. **Always mask with `& $0F`** when comparing color register values.

## Exit Code Behavior

| Scenario | Exit Code |
|----------|-----------|
| `-limitcycles` reached | 1 |
| Monitor `quit` command | 0 |
| Normal exit | 0 |

## Recommended VICE Command Line for Phase 4

### For dump at program entry (using ACME label for `main`):

```bash
"$VICE_BIN" \
  -autostart "$PRG_FILE" \
  -initbreak "$MAIN_ADDR" \
  -moncommands "$MON_FILE" \
  -monlog -monlogname "$MONLOG_FILE" \
  -exitscreenshot "$SCREENSHOT_FILE" \
  -warp -autostart-warp \
  -limitcycles "$CYCLES" \
  +confirmonexit -silent \
  -autostartprgmode 1
```

### For dump after program runs N cycles:

Use `break + g + save` pattern in the .mon file:
```
break $0810
g
; (program runs until breakpoint)
; ... then after breakpoint continues, use another break or watch:
; For completion sentinel:
watch store $0002
g
save "dump_vic.bin" 0 d000 d030
save "dump_screen.bin" 0 0400 07e7
r
quit
```

### For the simplest diagnostic (just run and screenshot):

```bash
"$VICE_BIN" \
  -autostart "$PRG_FILE" \
  -exitscreenshot "$SCREENSHOT_FILE" \
  -warp -autostart-warp \
  -limitcycles 10000000 \
  +confirmonexit -silent \
  -autostartprgmode 1
```

## Timing Reference

| Event | Approximate Cycles |
|-------|-------------------|
| KERNAL reset start | 0 |
| KERNAL initialization complete | ~1.5M |
| BASIC ready prompt | ~2.1M |
| Autostart inject + SYS | ~3.0M |
| Program main() entry | ~3.0-3.1M |
| 1 second of C64 time | ~1,000,000 |

**Recommendation**: Use 10M cycles minimum (gives program ~7M cycles = ~7 seconds of C64 runtime after boot).

## Limitations & Workarounds

| Limitation | Workaround |
|-----------|-----------|
| No `timeout` on macOS | Use a background process + `kill` pattern |
| `-moncommands` runs at startup | Use `-initbreak` to defer execution |
| VIC color upper nibble garbage | Always mask with `& $0F` |
| 2-byte header in dump files | Add +2 to all offsets |
| VICE executable path warning | Benign — can be ignored |

## Impact on Phase 4 Design

The `-initbreak + -moncommands` pattern enables:

1. **Program entry verification**: Break at `main()` and dump initial state
2. **Completion sentinel**: Use `watch store $0002` + `g` for post-execution dumps
3. **Register state**: Full register capture via `-monlogname`
4. **Screenshot**: Exit screenshot captures visual state at any point
5. **Memory comparison**: Binary dump files can be compared byte-by-byte with `xxd`

**Phase 4 `diag_vice.sh` should**:
1. Parse ACME label file to find `main` address
2. Generate .mon file with appropriate breaks and saves
3. Use `-initbreak` for reliable timing
4. Parse `-monlogname` output for register state
5. Compare dump bytes against `expected.json` values (with +2 offset and color masking)
