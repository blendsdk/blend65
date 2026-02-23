#!/usr/bin/env bash
# debug-vice-breakpoint.sh — Test VICE breakpoint + go + save pattern
# This tests whether we can set a breakpoint, continue execution,
# and then dump memory AFTER the program reaches the breakpoint.
set -euo pipefail

# ─── VICE App Bundle Setup ───────────────────────────────────────────────
VICE_APP="/Users/gevik/workdir/vice/VICE.app"
BUNDLE_RESOURCES="$VICE_APP/Contents/Resources"
VICE_BIN="$BUNDLE_RESOURCES/bin/x64sc"

export XDG_CONFIG_DIRS="$BUNDLE_RESOURCES/etc/xdg"
export XDG_DATA_DIRS="$BUNDLE_RESOURCES/share"
export GTK_DATA_PREFIX="$BUNDLE_RESOURCES"
export GTK_EXE_PREFIX="$BUNDLE_RESOURCES"
export GTK_PATH="$BUNDLE_RESOURCES"
export GDK_PIXBUF_MODULE_FILE="$BUNDLE_RESOURCES/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache"

# ─── Config ──────────────────────────────────────────────────────────────
PRG="${1:-$(pwd)/build/diag/test-phase2-border/O0/output.prg}"
OUTDIR="/tmp/vice-bp-test"
CYCLES=10000000

rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"

echo "═══ VICE Breakpoint Test ═══"
echo "PRG:    $PRG"
echo "Output: $OUTDIR"
echo "Cycles: $CYCLES"
echo ""

# ─── Test A: Simple moncommands (no breakpoint, runs at startup) ─────────
echo "--- Test A: Moncommands at startup (baseline) ---"
cat > "$OUTDIR/testA.mon" << 'MON'
save "a_vic.bin" 0 d000 d030
r
quit
MON

cd "$OUTDIR"
"$VICE_BIN" \
  -autostart "$PRG" \
  -moncommands "$OUTDIR/testA.mon" \
  -monlog -monlogname "$OUTDIR/testA-monitor.log" \
  -warp -autostart-warp \
  -limitcycles "$CYCLES" \
  +confirmonexit -silent \
  -autostartprgmode 1 \
  > "$OUTDIR/testA-vice.log" 2>&1 || true

echo "Files created:"
ls -la "$OUTDIR"/a_*.bin 2>/dev/null || echo "  (none)"
echo "Monitor log:"
cat "$OUTDIR/testA-monitor.log" 2>/dev/null || echo "  (none)"
echo ""

# ─── Test B: Breakpoint + go + save (the critical test) ─────────────────
echo "--- Test B: break + g + save (post-execution) ---"
cat > "$OUTDIR/testB.mon" << 'MON'
; Set breakpoint at main() — $0810 for border-cycle
break $0810
; Continue execution — KERNAL will boot, autostart will inject PRG, SYS runs
g
; These should execute AFTER breakpoint hits at $0810
save "b_vic.bin" 0 d000 d030
save "b_screen.bin" 0 0400 07e7
r
quit
MON

"$VICE_BIN" \
  -autostart "$PRG" \
  -moncommands "$OUTDIR/testB.mon" \
  -monlog -monlogname "$OUTDIR/testB-monitor.log" \
  -warp -autostart-warp \
  -limitcycles "$CYCLES" \
  +confirmonexit -silent \
  -autostartprgmode 1 \
  > "$OUTDIR/testB-vice.log" 2>&1 || true

echo "Files created:"
ls -la "$OUTDIR"/b_*.bin 2>/dev/null || echo "  (none)"
echo "Monitor log:"
cat "$OUTDIR/testB-monitor.log" 2>/dev/null || echo "  (none)"
echo ""

# ─── Test C: Try -initbreak approach ────────────────────────────────────
echo "--- Test C: -initbreak ready + moncommands (save after ready) ---"
cat > "$OUTDIR/testC.mon" << 'MON'
; These run when initbreak triggers (at BASIC ready)
save "c_vic.bin" 0 d000 d030
save "c_screen.bin" 0 0400 07e7
r
quit
MON

"$VICE_BIN" \
  -autostart "$PRG" \
  -initbreak ready \
  -moncommands "$OUTDIR/testC.mon" \
  -monlog -monlogname "$OUTDIR/testC-monitor.log" \
  -warp -autostart-warp \
  -limitcycles "$CYCLES" \
  +confirmonexit -silent \
  -autostartprgmode 1 \
  > "$OUTDIR/testC-vice.log" 2>&1 || true

echo "Files created:"
ls -la "$OUTDIR"/c_*.bin 2>/dev/null || echo "  (none)"
echo "Monitor log:"
cat "$OUTDIR/testC-monitor.log" 2>/dev/null || echo "  (none)"
echo ""

# ─── Test D: -initbreak at main address ─────────────────────────────────
echo "--- Test D: -initbreak \$0810 + moncommands (save at main entry) ---"
cat > "$OUTDIR/testD.mon" << 'MON'
; These run when initbreak triggers at $0810 (main entry)
save "d_vic.bin" 0 d000 d030
save "d_screen.bin" 0 0400 07e7
r
quit
MON

"$VICE_BIN" \
  -autostart "$PRG" \
  -initbreak 0x0810 \
  -moncommands "$OUTDIR/testD.mon" \
  -monlog -monlogname "$OUTDIR/testD-monitor.log" \
  -warp -autostart-warp \
  -limitcycles "$CYCLES" \
  +confirmonexit -silent \
  -autostartprgmode 1 \
  > "$OUTDIR/testD-vice.log" 2>&1 || true

echo "Files created:"
ls -la "$OUTDIR"/d_*.bin 2>/dev/null || echo "  (none)"
echo "Monitor log:"
cat "$OUTDIR/testD-monitor.log" 2>/dev/null || echo "  (none)"
echo ""

cd - > /dev/null

echo "═══ Summary ═══"
echo "All output in: $OUTDIR"
echo ""
echo "Test A (baseline): $(ls "$OUTDIR"/a_*.bin 2>/dev/null | wc -l | tr -d ' ') dump files"
echo "Test B (break+g):  $(ls "$OUTDIR"/b_*.bin 2>/dev/null | wc -l | tr -d ' ') dump files"
echo "Test C (initbreak ready): $(ls "$OUTDIR"/c_*.bin 2>/dev/null | wc -l | tr -d ' ') dump files"
echo "Test D (initbreak addr):  $(ls "$OUTDIR"/d_*.bin 2>/dev/null | wc -l | tr -d ' ') dump files"
echo ""
echo "Done."
