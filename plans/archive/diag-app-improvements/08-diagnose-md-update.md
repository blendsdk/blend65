# Diagnose.md AI Protocol Update

> **Document**: 08-diagnose-md-update.md
> **Parent**: [Index](00-index.md)

## Overview

Update `.clinerules/diagnose.md` to incorporate the new automated diagnostic capabilities. The updated protocol should reference automated analysis results rather than requiring manual counting/inspection.

## Changes Required

### 1. Phase 1 Update: Script Execution

**Add** to the script command:
```bash
# If expected.json exists alongside the blend file, VICE verification runs automatically
clear && ./scripts/diag_app.sh <path-to-blend-file>
```

### 2. Phase 3 Update: Summary Analysis

**Replace** manual metrics collection with references to automated output:
- Assembly metrics table is now in `summary.txt` automatically
- PHA/PLA balance check results are in `summary.txt`
- Size regression warnings are in `summary.txt`
- Label addresses are in `output.labels` files

### 3. NEW Phase: VICE Runtime Verification

**Add** a new phase between source analysis and diagnosis:

```markdown
## Phase 4b: VICE Runtime Verification

If `expected.json` exists alongside the source, `diag_app.sh` automatically
runs VICE verification. Review the results:

### Read VICE Results
Read: build/diag/<app-name>/O0/vice_results.txt

### Check Completion
- Did the program reach the completion sentinel ($02 = $42)?
- If not, the program crashed or hung before completing

### Check Memory Values
- Are all expected memory locations correct?
- Which checks failed?
- What were the actual vs expected values?

### Check Stack Pointer
- Is SP near $FF (top of stack)?
- If SP is low, there's a stack leak

### Review Screenshot
View: build/diag/<app-name>/O0/screenshot.png
- Does the visual output look correct?
```

### 4. Phase 4.5 Update: Assembly Quality Audit

**Replace** manual counting instructions with:

```markdown
### Assembly Analysis (Automated)

The following checks are now performed automatically by `diag_app.sh`:

✅ **Automated** — Assembly metrics (JSR/JMP/PHA/PLA/LDA counts)
✅ **Automated** — PHA/PLA stack balance per function
✅ **Automated** — Size regression detection (Ox > O0)
✅ **Automated** — STA/LDA redundancy detection
✅ **Automated** — JMP-to-next-instruction detection
✅ **Automated** — Label address validation (@charset alignment)
✅ **Automated** — PRG binary validation (load address, BASIC stub)

**Still requires AI analysis:**
- Codegen strategy audit (shift lowering, canonical patterns)
- Optimization pipeline gating analysis
- Strength reduction opportunities
- Complex redundancy patterns spanning multiple instructions
```

### 5. Phase 8 Update: Batch Testing

**Add** batch diagnostic trigger:

```markdown
## Batch Diagnostic Triggers

| Trigger | Behavior |
|---------|----------|
| `diag_app <file>` | Full diagnostic for one program |
| `diag_batch` | Run all test suite programs (examples/test-suite/) |
```

### 6. Updated Output Structure

```
build/diag/<app-name>/
├── sources/
├── O0/
│   ├── output.asm
│   ├── output-debug.asm
│   ├── output.prg
│   ├── output.labels          # NEW: ACME label file
│   ├── blend65.log
│   ├── acme.log
│   ├── analysis.txt           # NEW: Assembly analysis results
│   ├── vice.log               # NEW: VICE execution log
│   ├── screenshot.png         # NEW: VICE exit screenshot
│   ├── vice_results.txt       # NEW: Memory check results
│   ├── screen.bin             # NEW: Screen memory dump
│   ├── color.bin              # NEW: Color RAM dump
│   ├── vic.bin                # NEW: VIC-II register dump
│   └── zeropage.bin           # NEW: Zero page dump
├── O1/ ... (same structure)
├── diffs/
└── summary.txt                # ENHANCED: includes metrics, warnings, VICE results
```

## Testing Requirements

- Verify updated diagnose.md is internally consistent
- Verify all referenced file paths match actual output structure
- Verify automated/manual responsibility split is clear
