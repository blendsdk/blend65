# Execution Plan: Diagnostic Tool Improvements

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-23 21:00
> **Progress**: 56/56 tasks (100% — ALL PHASES COMPLETE)

## Overview

This document defines the execution phases and AI chat sessions for implementing the diagnostic tool improvements.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | ACME Labels + PRG Validation | 1 | 30 min |
| 2 | Assembly Analysis Script | 1-2 | 45 min |
| 3 | VICE Integration — Prototype & Test | 1-2 | 45 min |
| 4 | VICE Integration — Full Script | 1 | 30 min |
| 5 | Batch Mode Script | 1 | 30 min |
| 6 | Test Programs — Wave 1 (Basic) | 2-3 | 60 min |
| 7 | Test Programs — Wave 2 (C64 Hardware) | 2-3 | 60 min |
| 8 | Diagnose.md Update + Smoke Test | 1 | 30 min |

**Total: 10-14 sessions, ~5-6 hours**

---

## Phase 1: ACME Labels + PRG Validation

**Reference**: [03-acme-labels-prg-analysis.md](03-acme-labels-prg-analysis.md)

### Session 1.1: Add ACME Label File + PRG Validation to diag_app.sh

**Objective**: Modify `diag_app.sh` to generate ACME label files and validate PRG binaries.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add `-l output.labels` to ACME invocation | `scripts/diag_app.sh` |
| 1.1.2 | Add `validate_labels()` function — parse labels, check @charset alignment, check address ranges | `scripts/diag_app.sh` |
| 1.1.3 | Add `validate_prg()` function — check load address ($0801), check BASIC SYS stub | `scripts/diag_app.sh` |
| 1.1.4 | Add label map and PRG validation sections to summary.txt output | `scripts/diag_app.sh` |
| 1.1.5 | Test by running `diag_app.sh` on border-cycle and armenian-charset | Manual verification |

**Deliverables**:
- [ ] ACME label files generated for all optimization levels
- [ ] Label alignment validation working
- [ ] PRG binary validation working
- [ ] Summary includes label map and PRG validation sections

**Verify**: `clear && ./scripts/diag_app.sh examples/border-cycle/main.blend build/diag/test-phase1`

---

## Phase 2: Assembly Analysis Script

**Reference**: [04-assembly-analysis.md](04-assembly-analysis.md)

### Session 2.1: Create diag_analyze_asm.sh

**Objective**: Create standalone assembly analysis script and integrate into diag_app.sh.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Create `diag_analyze_asm.sh` with metrics extraction (JSR/JMP/PHA/PLA/LDA/STA/RTS counts) | `scripts/diag_analyze_asm.sh` |
| 2.1.2 | Add PHA/PLA balance check per function | `scripts/diag_analyze_asm.sh` |
| 2.1.3 | Add redundancy detection (STA/LDA pairs, JMP-to-next) | `scripts/diag_analyze_asm.sh` |
| 2.1.4 | Add size regression detection to `diag_app.sh` | `scripts/diag_app.sh` |
| 2.1.5 | Integrate analysis into diag_app.sh as Step 6, add cross-level metrics table to summary | `scripts/diag_app.sh` |
| 2.1.6 | Test with border-cycle and armenian-charset | Manual verification |

**Deliverables**:
- [ ] Assembly analysis script producing correct metrics
- [ ] PHA/PLA balance reported per function
- [ ] Redundancy patterns detected
- [ ] Size regressions flagged in summary
- [ ] Cross-level metrics table in summary.txt

**Verify**: `clear && ./scripts/diag_app.sh examples/armenian-charset/main.blend build/diag/test-phase2`

---

## Phase 3: VICE Integration — Prototype & Test

**Reference**: [05-vice-integration.md](05-vice-integration.md)

### Session 3.1: VICE Feasibility Test

**Objective**: Verify VICE works from command line with autostart, warp, limitcycles, and monitor commands.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Test VICE launches from CLI with `-warp -limitcycles 1000000 +confirmonexit` | Manual test |
| 3.1.2 | Test `-autostart` with border-cycle.prg (compile first with diag_app) | Manual test |
| 3.1.3 | Test `-moncommands` with a simple .mon file that dumps screen memory | Manual test |
| 3.1.4 | Test `-exitscreenshot` — verify if screenshots work on macOS | Manual test |
| 3.1.5 | Test monitor `save` command — verify binary dump files are created | Manual test |
| 3.1.6 | Document findings: what works, what doesn't, any workarounds needed | `plans/diag-app-improvements/vice-test-results.md` |

**Deliverables**:
- [ ] VICE CLI execution verified (warp + limitcycles)
- [ ] Autostart verified with PRG file
- [ ] Monitor commands verified (memory dump)
- [ ] Screenshot capability determined (works/fallback)
- [ ] Findings documented

**Verify**: Check dump files exist and contain expected data

---

## Phase 4: VICE Integration — Full Script

**Reference**: [05-vice-integration.md](05-vice-integration.md)

### Session 4.1: Create diag_vice.sh

**Objective**: Create the complete VICE verification script.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Create `diag_vice.sh` scaffold — argument parsing, VICE binary detection, help text | `scripts/diag_vice.sh` |
| 4.1.2 | Add `generate_mon_script()` — create .mon file with all memory region dumps | `scripts/diag_vice.sh` |
| 4.1.3 | Add `run_vice()` — launch VICE with autostart, warp, limitcycles, moncommands | `scripts/diag_vice.sh` |
| 4.1.4 | Add `verify_memory_checks()` — parse expected.json, compare against dump files | `scripts/diag_vice.sh` |
| 4.1.5 | Add `verify_registers()` — parse VICE register output, check stack pointer | `scripts/diag_vice.sh` |
| 4.1.6 | Add VICE step integration into `diag_app.sh` (optional Step 7 when expected.json exists) | `scripts/diag_app.sh` |
| 4.1.7 | Test with border-cycle using a simple expected.json | Manual verification |

**Deliverables**:
- [ ] `diag_vice.sh` runs PRG in VICE and exits cleanly
- [ ] Memory dumps produced and compared against expected values
- [ ] Register state captured and validated
- [ ] Integration with diag_app.sh working (optional Step 7)

**Verify**: `clear && ./scripts/diag_vice.sh build/diag/test/O0/output.prg expected.json build/diag/test/O0`

---

## Phase 5: Batch Mode Script

**Reference**: [06-batch-mode.md](06-batch-mode.md)

### Session 5.1: Create diag_batch.sh

**Objective**: Create batch diagnostic runner with central reporting.

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.1.1 | Create `diag_batch.sh` scaffold — argument parsing, test discovery, help text | `scripts/diag_batch.sh` |
| 5.1.2 | Add test discovery (find */main.blend in suite directory) | `scripts/diag_batch.sh` |
| 5.1.3 | Add per-test execution loop (call diag_app.sh + optionally diag_vice.sh) | `scripts/diag_batch.sh` |
| 5.1.4 | Add central report generation (markdown summary table) | `scripts/diag_batch.sh` |
| 5.1.5 | Add cross-program analysis (common warnings, failure patterns) | `scripts/diag_batch.sh` |
| 5.1.6 | Test with existing examples (border-cycle + at least 2 others) | Manual verification |

**Deliverables**:
- [ ] Batch discovers and processes multiple test programs
- [ ] Central report generated with summary table
- [ ] Cross-program analysis identifies common patterns
- [ ] Continues after individual test failures

**Verify**: `clear && ./scripts/diag_batch.sh examples/ build/diag/batch-test`

---

## Phase 6: Test Programs — Wave 1 (Basic Operations)

**Reference**: [07-test-programs.md](07-test-programs.md)

### Session 6.1: Basic Arithmetic & Control Flow Tests

**Objective**: Create first 3 test programs with expected.json files.

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.1.1 | Create `examples/test-suite/README.md` with suite overview | `examples/test-suite/README.md` |
| 6.1.2 | Create `01-byte-arithmetic/main.blend` + `expected.json` | `examples/test-suite/01-byte-arithmetic/` |
| 6.1.3 | Create `02-word-arithmetic/main.blend` + `expected.json` | `examples/test-suite/02-word-arithmetic/` |
| 6.1.4 | Create `03-bitwise-ops/main.blend` + `expected.json` | `examples/test-suite/03-bitwise-ops/` |
| 6.1.5 | Run diag_batch on these 3 tests, verify results | Manual verification |

**Deliverables**:
- [ ] 3 test programs created with expected values
- [ ] All compile and assemble at all optimization levels
- [ ] VICE verification passes for all 3 (if VICE integration working)

### Session 6.2: Function Calls & Memory Tests

**Objective**: Create remaining Wave 1 test programs.

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.2.1 | Create `04-control-flow/main.blend` + `expected.json` | `examples/test-suite/04-control-flow/` |
| 6.2.2 | Create `05-function-calls/main.blend` + `expected.json` | `examples/test-suite/05-function-calls/` |
| 6.2.3 | Create `06-memory-ops/main.blend` + `expected.json` | `examples/test-suite/06-memory-ops/` |
| 6.2.4 | Run diag_batch on all 6 Wave 1 tests | Manual verification |

**Deliverables**:
- [ ] 6 Wave 1 test programs complete
- [ ] All compile, assemble, and pass VICE verification

---

## Phase 7: Test Programs — Wave 2 (C64 Hardware)

**Reference**: [07-test-programs.md](07-test-programs.md)

### Session 7.1: VIC-II & Screen Tests

**Objective**: Create C64 hardware test programs (VIC-II focus).

**Tasks**:

| # | Task | File |
|---|------|------|
| 7.1.1 | Create `07-vic-border-bg/main.blend` + `expected.json` | `examples/test-suite/07-vic-border-bg/` |
| 7.1.2 | Create `08-screen-fill/main.blend` + `expected.json` | `examples/test-suite/08-screen-fill/` |
| 7.1.3 | Create `09-color-ram/main.blend` + `expected.json` | `examples/test-suite/09-color-ram/` |
| 7.1.4 | Run diag_batch on VIC tests | Manual verification |

### Session 7.2: Data Segments & Advanced Tests

**Objective**: Create data segment and integration test programs.

**Tasks**:

| # | Task | File |
|---|------|------|
| 7.2.1 | Create `10-charset-switch/main.blend` + `expected.json` | `examples/test-suite/10-charset-switch/` |
| 7.2.2 | Create `11-sprite-enable/main.blend` + `expected.json` | `examples/test-suite/11-sprite-enable/` |
| 7.2.3 | Create `12-data-arrays/main.blend` + `expected.json` | `examples/test-suite/12-data-arrays/` |
| 7.2.4 | Create `13-large-data/main.blend` + `expected.json` | `examples/test-suite/13-large-data/` |
| 7.2.5 | Create `14-address-compute/main.blend` + `expected.json` | `examples/test-suite/14-address-compute/` |

### Session 7.3: Integration Tests

**Tasks**:

| # | Task | File |
|---|------|------|
| 7.3.1 | Create `15-multi-function/main.blend` + `expected.json` | `examples/test-suite/15-multi-function/` |
| 7.3.2 | Create `16-loop-memory/main.blend` + `expected.json` | `examples/test-suite/16-loop-memory/` |
| 7.3.3 | Create `17-word-index-array/main.blend` + `expected.json` | `examples/test-suite/17-word-index-array/` |
| 7.3.4 | Create `18-full-pipeline/main.blend` + `expected.json` | `examples/test-suite/18-full-pipeline/` |
| 7.3.5 | Run full diag_batch on all 18 tests, collect report | Manual verification |

**Deliverables**:
- [ ] 18 test programs complete
- [ ] Full batch report generated
- [ ] Failures identified and documented

---

## Phase 8: Diagnose.md Update + Smoke Test

**Reference**: [08-diagnose-md-update.md](08-diagnose-md-update.md)

### Session 8.1: Update AI Protocol + Final Verification

**Objective**: Update diagnose.md and run smoke test.

**Tasks**:

| # | Task | File |
|---|------|------|
| 8.1.1 | Update `.clinerules/diagnose.md` with new automated capabilities | `.clinerules/diagnose.md` |
| 8.1.2 | Create `scripts/test-diag-smoke.sh` smoke test script | `scripts/test-diag-smoke.sh` |
| 8.1.3 | Run smoke test and verify all components work together | Manual verification |
| 8.1.4 | Run full batch on all 18 test programs and analyze results | Final verification |

**Deliverables**:
- [ ] `diagnose.md` updated with all new capabilities
- [ ] Smoke test passes
- [ ] Full batch report analyzed
- [ ] Bug patterns documented

---

## Task Checklist (All Phases)

### Phase 1: ACME Labels + PRG Validation
- [x] 1.1.1 Add `-l output.labels` to ACME invocation ✅ (completed: 2026-02-22 21:45)
- [x] 1.1.2 Add `validate_labels()` function ✅ (completed: 2026-02-22 21:48)
- [x] 1.1.3 Add `validate_prg()` function ✅ (completed: 2026-02-22 21:48)
- [x] 1.1.4 Add label map + PRG validation to summary.txt ✅ (completed: 2026-02-22 22:00)
- [x] 1.1.5 Test with border-cycle and armenian-charset ✅ (completed: 2026-02-22 22:10)

### Phase 2: Assembly Analysis
- [x] 2.1.1 Create `diag_analyze_asm.sh` with metrics extraction ✅ (completed: 2026-02-22 22:47)
- [x] 2.1.2 Add PHA/PLA balance check ✅ (completed: 2026-02-22 22:47)
- [x] 2.1.3 Add redundancy detection ✅ (completed: 2026-02-22 22:47)
- [x] 2.1.4 Add size regression detection to diag_app.sh ✅ (completed: 2026-02-22 22:50)
- [x] 2.1.5 Integrate analysis into diag_app.sh Step 6 + summary ✅ (completed: 2026-02-22 22:54)
- [x] 2.1.6 Test with border-cycle and armenian-charset ✅ (completed: 2026-02-22 22:57)

### Phase 3: VICE Prototype
- [x] 3.1.1 Test VICE CLI launch with warp + limitcycles ✅ (completed: 2026-02-22 23:13)
- [x] 3.1.2 Test autostart with border-cycle.prg ✅ (completed: 2026-02-22 23:13)
- [x] 3.1.3 Test moncommands with screen memory dump ✅ (completed: 2026-02-22 23:13)
- [x] 3.1.4 Test exitscreenshot on macOS ✅ (completed: 2026-02-22 23:13)
- [x] 3.1.5 Test monitor save command for binary dumps ✅ (completed: 2026-02-22 23:24)
- [x] 3.1.6 Document VICE test findings ✅ (completed: 2026-02-22 23:47)

### Phase 4: VICE Full Script
- [x] 4.1.1 Create diag_vice.sh scaffold (modular: env.sh, mon.sh, run.sh, verify.sh) ✅ (completed: 2026-02-23 00:20)
- [x] 4.1.2 Add generate_mon_script() ✅ (completed: 2026-02-23 00:20)
- [x] 4.1.3 Add run_vice() ✅ (completed: 2026-02-23 00:24)
- [x] 4.1.4 Add verify_memory_checks() ✅ (completed: 2026-02-23 00:38)
- [x] 4.1.5 Add verify_registers() ✅ (completed: 2026-02-23 00:38)
- [x] 4.1.6 Add VICE integration into diag_app.sh (Step 7) ✅ (completed: 2026-02-23 01:00)
- [x] 4.1.7 Test with border-cycle + expected.json — ALL 4/4 CHECKS PASSED ✅ (completed: 2026-02-23 00:58)

### Phase 5: Batch Mode
- [x] 5.1.1 Create diag_batch.sh scaffold ✅ (completed: 2026-02-23 01:30)
- [x] 5.1.2 Add test discovery ✅ (completed: 2026-02-23 01:30)
- [x] 5.1.3 Add per-test execution loop ✅ (completed: 2026-02-23 01:30)
- [x] 5.1.4 Add central report generation ✅ (completed: 2026-02-23 01:30)
- [x] 5.1.5 Add cross-program analysis ✅ (completed: 2026-02-23 01:30)
- [x] 5.1.6 Test with existing examples ✅ (completed: 2026-02-23 10:38)

### Phase 6: Test Programs Wave 1
- [x] 6.1.1 Create test-suite README ✅ (completed: 2026-02-23 02:00)
- [x] 6.1.2 Create 01-byte-arithmetic ✅ (completed: 2026-02-23 02:00)
- [x] 6.1.3 Create 02-word-arithmetic ✅ (completed: 2026-02-23 02:00)
- [x] 6.1.4 Create 03-bitwise-ops ✅ (completed: 2026-02-23 02:00)
- [x] 6.1.5 Verify Wave 1a (3 tests) ✅ (completed: 2026-02-23 10:38)
- [x] 6.2.1 Create 04-control-flow ✅ (completed: 2026-02-23 11:12 — simplified to while-only, C-style for/break/continue triggers parse cascade)
- [x] 6.2.2 Create 05-function-calls ✅ (completed: 2026-02-23 11:14 — replaced makeWord with getWordConst due to word-shift codegen bug)
- [x] 6.2.3 Create 06-memory-ops ✅ (completed: 2026-02-23 10:42)
- [x] 6.2.4 Verify all Wave 1 (6 tests) ✅ (completed: 2026-02-23 13:46 — 5/6 pass, 02-word-arithmetic fails VICE due to known Bug W1)

### Phase 7: Test Programs Wave 2
- [x] 7.1.1 Create 07-vic-border-bg ✅ (completed: 2026-02-23 14:28)
- [x] 7.1.2 Create 08-screen-fill ✅ (completed: 2026-02-23 14:30)
- [x] 7.1.3 Create 09-color-ram ✅ (completed: 2026-02-23 14:32)
- [x] 7.1.4 Verify VIC tests ✅ (completed: 2026-02-23 14:45 — all 3 pass compile+VICE, 8/9 overall)
- [x] 7.2.1 Create 10-charset-switch ✅ (completed: 2026-02-23 15:00)
- [x] 7.2.2 Create 11-sprite-enable ✅ (completed: 2026-02-23 15:03)
- [x] 7.2.3 Create 12-data-arrays ✅ (completed: 2026-02-23 15:06 — workaround for Bug D1: arr[const>0])
- [x] 7.2.4 Create 13-large-data ✅ (completed: 2026-02-23 15:09 — workaround for Bug D1: arr[const>0])
- [x] 7.2.5 Create 14-address-compute ✅ (completed: 2026-02-23 15:13)
- [x] 7.3.1 Create 15-multi-function ✅ (completed: 2026-02-23 16:00)
- [x] 7.3.2 Create 16-loop-memory ✅ (completed: 2026-02-23 16:00)
- [x] 7.3.3 Create 17-word-index-array ✅ (completed: 2026-02-23 16:00)
- [x] 7.3.4 Create 18-full-pipeline ✅ (completed: 2026-02-23 16:05)
- [x] 7.3.5 Full batch run on all 18 tests ✅ (completed: 2026-02-23 19:58 — 17/18 pass, Bugs W2/W3 discovered)

### Phase 8: Protocol Update + Final
- [x] 8.1.1 Update diagnose.md ✅ (completed: 2026-02-23 20:18)
- [x] 8.1.2 Create smoke test script ✅ (completed: 2026-02-23 20:24)
- [x] 8.1.3 Run smoke test — 17/17 passed ✅ (completed: 2026-02-23 20:29)
- [x] 8.1.4 Run full batch — 17/18 pass (Bug W1 known) ✅ (completed: 2026-02-23 21:00)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/diag-app-improvements/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify work is complete and functional
# Run diag_app.sh on a test program to verify

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with [x]
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 1 (ACME Labels + PRG)
    ↓
Phase 2 (Assembly Analysis)
    ↓
Phase 3 (VICE Prototype) ←── Must succeed before Phase 4
    ↓
Phase 4 (VICE Full Script)
    ↓
Phase 5 (Batch Mode) ←── Depends on Phase 1-4
    ↓
Phase 6 (Test Programs Wave 1) ←── Depends on Phase 5
    ↓
Phase 7 (Test Programs Wave 2)
    ↓
Phase 8 (Protocol Update + Final)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ `diag_app.sh` generates ACME labels, validates PRGs, extracts metrics, checks PHA/PLA balance
2. ✅ `diag_vice.sh` runs PRGs in VICE, dumps memory, compares against expected values
3. ✅ `diag_batch.sh` processes multiple programs with central reporting
4. ✅ 18 targeted test programs created with expected.json files
5. ✅ `.clinerules/diagnose.md` updated with new capabilities
6. ✅ Smoke test passes
7. ✅ Full batch report reveals specific compiler bugs for targeted fixing
