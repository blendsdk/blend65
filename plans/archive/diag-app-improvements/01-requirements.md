# Requirements: Diagnostic Tool Improvements

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Transform the Blend65 diagnostic toolchain from a simple compile-and-assemble checker into a comprehensive, multi-layer diagnostic suite capable of:

1. Static analysis of generated assembly code
2. Binary validation of assembled PRG files
3. Runtime verification using the VICE C64 emulator
4. Batch processing across multiple test programs
5. Central reporting with cross-program issue correlation

## Problem Statement

The Blend65 compiler passes all 9000+ unit and integration tests, yet compiled programs produce incorrect results when run in the C64 emulator. This indicates bugs that exist at the integration boundary — where individual compiler phases work correctly in isolation but produce incorrect combined output.

Current `diag_app.sh` only verifies:
- ✅ Does the source compile without errors?
- ✅ Does ACME assemble without errors?
- ✅ What are the file sizes?

It does NOT verify:
- ❌ Is the generated assembly semantically correct?
- ❌ Are data segments placed at correct addresses?
- ❌ Is the PRG binary structurally valid?
- ❌ Does the program produce correct runtime behavior?
- ❌ Are memory locations set to expected values after execution?

## Functional Requirements

### Must Have

- [ ] **ACME label file extraction** — Generate label files showing all symbol addresses
- [ ] **PRG binary validation** — Verify load address ($0801), BASIC stub, data integrity
- [ ] **Assembly metrics extraction** — JSR/JMP/PHA/PLA/LDA counts per optimization level
- [ ] **PHA/PLA balance check** — Automated per-function stack balance verification
- [ ] **Size regression detection** — Automatic flagging when optimized code > O0 code
- [ ] **Redundancy detection** — STA/LDA pairs, JMP-to-next, dead code after unconditional jumps
- [ ] **VICE runtime execution** — Autostart PRG, run at warp speed with cycle limit
- [ ] **Memory dump after execution** — Dump screen, color RAM, VIC registers, zero page
- [ ] **Register state capture** — Capture A, X, Y, SP, PC, flags after execution
- [ ] **Exit screenshot** — Save emulator screenshot when execution completes
- [ ] **Expected value comparison** — Compare memory dumps against JSON-defined expected values
- [ ] **Batch mode** — Process multiple programs with central reporting
- [ ] **Test result protocol** — Convention for how test programs signal completion ($02 sentinel)
- [ ] **Targeted test programs** — Suite of programs testing specific C64/6502 features

### Should Have

- [ ] **Label address validation** — Cross-reference label addresses against alignment requirements
- [ ] **Data content verification** — Compare emitted data bytes against source declarations
- [ ] **Cross-program issue correlation** — Identify common failure patterns across test suite
- [ ] **Regression tracking** — Save results to detect new regressions over time
- [ ] **AI protocol update** — Updated `diagnose.md` incorporating new capabilities

### Won't Have (Out of Scope)

- SID audio testing (no way to verify audio output automatically)
- Timing-critical tests (cycle-exact timing verification)
- Multi-frame animation verification (single-point-in-time memory check only)
- VICE GUI interaction (headless operation only)
- Continuous integration pipeline (manual/AI-triggered only)

## Technical Requirements

### Performance

- VICE execution in warp mode (maximum speed, no real-time sync)
- Cycle limit prevents infinite loops from hanging the diagnostic
- Batch processing should complete all test programs within minutes

### Compatibility

- macOS Ventura (current development machine)
- VICE x64sc at `/Users/gevik/workdir/vice/VICE.app/Contents/Resources/bin/x64sc`
- ACME assembler (already installed and working)
- Bash 3.2+ (macOS default)
- Node.js for any TypeScript analysis helpers

### Dependencies

- VICE C64 emulator (installed ✅)
- ACME cross-assembler (installed ✅)
- Blend65 compiler (built from source ✅)
- `jq` for JSON processing (available ✅)

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| VICE headless operation | GUI mode vs headless | Headless with `-exitscreenshot` | Automation requires no manual interaction |
| Test result protocol | Screen pattern / Memory sentinel / File output | Memory sentinel ($02) + memory checks | Simplest to verify, works with VICE monitor |
| Expected values format | JSON / TOML / Shell vars | JSON | Structured, parseable with `jq`, human-readable |
| Test program location | `tests/` / `examples/test-suite/` / `fixtures/` | `examples/test-suite/` | Consistent with existing examples structure |
| Assembly analysis | Shell (grep/awk) / TypeScript / Python | Shell (grep/awk) | No extra dependencies, fast, composable |
| Batch report format | JSON / Markdown / HTML | Markdown | Human-readable, version-controllable |

## Acceptance Criteria

1. [ ] `diag_app.sh` generates ACME label files for all optimization levels
2. [ ] `diag_app.sh` validates PRG binary structure (load address + BASIC stub)
3. [ ] `diag_app.sh` extracts and displays assembly metrics table
4. [ ] `diag_app.sh` detects and reports PHA/PLA imbalances
5. [ ] `diag_app.sh` flags size regressions (Ox > O0)
6. [ ] `diag_vice.sh` runs a PRG in VICE with warp + cycle limit
7. [ ] `diag_vice.sh` dumps memory regions and captures screenshot
8. [ ] `diag_vice.sh` compares memory against expected values (JSON)
9. [ ] `diag_batch.sh` processes multiple programs and generates central report
10. [ ] At least 10 targeted test programs created covering major C64 subsystems
11. [ ] `.clinerules/diagnose.md` updated with new diagnostic capabilities
12. [ ] All diagnostic scripts are documented with usage examples
