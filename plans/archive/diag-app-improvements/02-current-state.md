# Current State: Diagnostic Tool Improvements

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### `scripts/diag_app.sh` — Current Diagnostic Script (310 lines)

The current script performs compile-and-assemble diagnostics at all optimization levels.

**What It Does:**

| Step | Description | Status |
|------|-------------|--------|
| Step 1 | Copy source files to output directory | ✅ Working |
| Step 2 | Build the compiler (`yarn build`) | ✅ Working |
| Step 3 | Compile at 10 optimization levels (O0, O1, O1s, O1z, O2, Os, Oz, O3, O3s, O3z) | ✅ Working |
| Step 3b | Generate O0 debug build with inline source comments | ✅ Working |
| Step 3c | Assemble each with ACME (`--cpu 6510 --format cbm`) | ✅ Working |
| Step 4 | Generate unified diffs (O0 vs all others) | ✅ Working |
| Step 5 | Generate summary with pass/fail and file sizes | ✅ Working |

**What It Does NOT Do:**

| Gap | Description | Impact |
|-----|-------------|--------|
| No ACME label files | Doesn't use `-l` flag to extract symbol addresses | Can't verify data alignment |
| No PRG validation | Doesn't check binary structure (load address, BASIC stub) | Can't detect header corruption |
| No assembly analysis | Doesn't count JSR/JMP/PHA/PLA or detect patterns | Manual counting required |
| No stack balance check | Doesn't verify PHA/PLA pairing per function | Stack bugs go undetected |
| No size regression check | Doesn't flag when Ox PRG > O0 PRG | Optimization regressions missed |
| No redundancy detection | Doesn't find STA/LDA pairs, JMP-to-next, dead code | Code quality issues hidden |
| No runtime verification | Doesn't run programs in an emulator | Can't verify runtime behavior |
| No expected value checking | No mechanism to verify correct output | No automated pass/fail |
| No batch mode | Processes one program at a time only | Can't test multiple programs efficiently |

### `.clinerules/diagnose.md` — AI Diagnostic Protocol

The `diagnose.md` file provides a comprehensive AI protocol for manually analyzing `diag_app` output. It describes:

- 8 phases of analysis (run script → read summary → investigate failures → source analysis → diagnose → classify → report → next steps)
- Assembly quality audit patterns (redundant STA/LDA, JMP-to-next, dead code, etc.)
- Bug classification system (SRC, FE, IL, OPT, CG, EMIT, REG, REDUN, MISSOPT)
- Codegen strategy audit (shift lowering, busy-wait loops, constant address operations)
- PHA/PLA stack discipline audit
- Cross-level ASM metrics collection

**Key insight:** The `diagnose.md` protocol describes what the AI should do MANUALLY, but these checks could be AUTOMATED in the diagnostic scripts.

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `scripts/diag_app.sh` | Main diagnostic script | Add ACME labels, PRG validation, assembly analysis, size regression |
| `.clinerules/diagnose.md` | AI diagnostic protocol | Update with new automated capabilities |
| (new) `scripts/diag_vice.sh` | VICE runtime verification | Create from scratch |
| (new) `scripts/diag_batch.sh` | Batch diagnostic runner | Create from scratch |
| (new) `scripts/diag_analyze_asm.sh` | Assembly analysis helper | Create from scratch |
| (new) `examples/test-suite/` | Targeted test programs | Create from scratch |

## VICE Emulator Analysis

### Available Tools

Located at `/Users/gevik/workdir/vice/VICE.app/Contents/Resources/bin/`:

| Tool | Purpose |
|------|---------|
| `x64sc` | C64 emulator (cycle-accurate) |
| `c1541` | Disk image utility |
| `cartconv` | Cartridge image converter |
| `petcat` | BASIC tokenizer/detokenizer |

### Key x64sc Command-Line Flags

| Flag | Description | Use Case |
|------|-------------|----------|
| `-autostart <file>` | Load and auto-run a PRG | Start test program |
| `-warp` | Run at maximum speed | No real-time delay |
| `-limitcycles <N>` | Quit after N cycles | Prevent infinite loops |
| `-moncommands <file>` | Execute monitor commands from file | Dump memory/registers |
| `-exitscreenshot <file>` | Save screenshot on exit | Visual verification |
| `-nativemonitor` | Monitor on terminal | Capture monitor output |
| `+confirmonexit` | Don't ask before quitting | Automated operation |
| `-autostart-warp` | Warp during autostart | Fast BASIC loading |

### VICE Monitor Commands (for `.mon` files)

| Command | Description | Example |
|---------|-------------|---------|
| `save "<file>" 0 <start> <end>` | Save memory range to file | `save "screen.bin" 0 0400 07e7` |
| `m <start> <end>` | Display memory range | `m d020 d021` |
| `r` | Show CPU registers | Shows A, X, Y, SP, PC, flags |
| `quit` | Exit emulator | Required at end of script |

### Known Issues

- Error message: `Requested graphics output driver PNG not found` — May affect screenshot capability
- Headless operation on macOS needs testing — VICE may require a display

## Gaps Identified

### Gap 1: No ACME Label File Generation

**Current Behavior:** ACME invoked with `--cpu 6510 --format cbm -o output.prg output.asm`
**Required Behavior:** Add `-l output.labels` to generate label file with all symbol addresses
**Fix Required:** One-line change to the ACME invocation in `diag_app.sh`

### Gap 2: No PRG Binary Validation

**Current Behavior:** PRG is assembled and its size is recorded, nothing else
**Required Behavior:** Verify first 2 bytes are `$01 $08` (load address), verify BASIC stub at $0801
**Fix Required:** Add binary analysis step using `xxd` or `od`

### Gap 3: No Automated Assembly Analysis

**Current Behavior:** Assembly output is generated but not analyzed
**Required Behavior:** Extract metrics (instruction counts), detect patterns (redundancies, imbalances)
**Fix Required:** Add analysis step using `grep`/`awk` on `.asm` files

### Gap 4: No Runtime Verification

**Current Behavior:** No emulator execution at all
**Required Behavior:** Run PRG in VICE, dump memory, compare against expected values
**Fix Required:** New `diag_vice.sh` script with VICE integration

### Gap 5: No Batch Processing

**Current Behavior:** One program per invocation, no central reporting
**Required Behavior:** Process multiple programs, generate cross-program report
**Fix Required:** New `diag_batch.sh` script

### Gap 6: No Golden Reference / Expected Values

**Current Behavior:** No mechanism to define what a program should produce
**Required Behavior:** JSON-based expected values for memory locations after execution
**Fix Required:** Define format, create verification logic, create expected files for test programs

## Dependencies

### Internal Dependencies

- Blend65 compiler must be buildable (`yarn build`)
- ACME assembler must be installed and in PATH
- Existing `diag_app.sh` provides foundation for enhancements

### External Dependencies

- VICE C64 emulator at known path
- `jq` for JSON processing in shell scripts
- `xxd` or `od` for binary analysis (standard macOS tools)

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| VICE headless operation fails on macOS | Medium | High | Test early; fallback to memory dumps without screenshots |
| VICE monitor commands have version-specific syntax | Low | Medium | Test with installed version; document exact syntax |
| Cycle limit too low/high for test programs | Medium | Low | Make configurable per test; document guidelines |
| Test programs are correct but expected values are wrong | Medium | High | Derive expected values carefully; manual verification |
| Assembly analysis regex patterns miss edge cases | Medium | Medium | Start with simple patterns; iterate based on real output |
