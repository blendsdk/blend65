# Requirements: RD-15 — Programmatic & CLI API

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-15](../../requirements/RD-15-programmatic-cli-api.md)

## Feature Overview

Two public surfaces (AR-77 library-first): the `@blend65/compiler` facade returning
structured, never-throwing results, and the `@blend65/cli` `blendc` command wrapping it
with argument parsing, rendering, artifact writing, and exit codes. The RD's R-numbers
(R1–R51) are the authoritative requirement set; this document maps them to the plan and
records the scope decisions made at the Zero-Ambiguity Gate.

## Functional Requirements

### Must Have (traced to RD-15 R-numbers)

- [ ] **Facade architecture** — library-first, thin, no printing/process.exit (R1–R4)
- [ ] **`compile(options, host?)` → `CompileResult`** — frontend only: lex → parse →
      semantic → SFA; diagnostics + `config` + `sourceMap` + `semanticModel?` +
      `allocationPlan?` (R5, R51)
- [ ] **`build(options, host?, deps?)` → `Promise<BuildResult>`** — full pipeline through
      ACME; artifacts + `symbolMap` + `binary` + `resourceReport` (R6; deps seam per AR-V4)
- [ ] **`emitAsm()` / `emitIl()` → `EmitResult`** — partial pipelines returning text (R7, R8)
- [ ] **`CompilerOptions`** structured object covering every overridable `BlendConfig`
      property (R9); **injectable `CompilerHost`** (R10); **results never throw** (R11)
- [ ] **`CompilerHost`** minimal 3-method interface in `@blend65/core` (R14);
      **`DiskCompilerHost`** in `@blend65/compiler` (R12) with three-tier discovery (R13),
      R47 glob expansion (tinyglobby — AR-V3), E10250 missing-explicit-file (R48),
      E10251 empty-set (R49)
- [ ] **CLI**: `blendc build [files..]` (default command — AR-V14) and `blendc check`
      (R15–R18); target/output flags (R19–R21, R45, R46); emit flags (R22–R24);
      diagnostic flags (R25–R29); ACME/optimizer flags (R30, R31 — peephole only, AR-V19);
      informational flags (R32–R36)
- [ ] **Output behavior**: conditional color (R37, zero-dep per AR-V2, precedence AR-V16),
      summary on success unless `--quiet` (R38), diagnostics → stderr (R39), artifacts →
      out-dir (R40), error/warning trailer (AR-V11)
- [ ] **Exit codes** 0/1/2/3 with the R50 classification (custom yargs `.fail()` → 2;
      `process.exitCode`, AR-V13)
- [ ] **Deferred RD-11 items**: AC-16 `--quiet` half (R34); E10034 via `checkBinaryBudget`
      after `emitBinary` (AR-V5)
- [ ] **PF-002 rename**: RD-09's `BuildResult` → `EmitBinaryResult` (`symbols` field maps
      to the facade's `symbolMap`)

### Won't Have (Out of Scope)

- LSP buffer-overlay `CompilerHost` (RD-14; the interface ships, the overlay does not)
- Emulator verification of built binaries (RD-12)
- Peephole rule catalog (RD-08 Phase B) — `--optimize`/`--no-optimize` both produce
  identical output in v1 (R31)
- Any `blend65.json` schema/validation change (RD-16 shipped)
- Filling `modelToFunctionInfo` (RD-04b's documented deferral — see register
  "Pre-resolved context")

## Technical Requirements

### Performance
- No new performance targets; determinism (RD-13) governs: sorted file discovery
  (AR-V3), lexicographic `outName` derivation (R21), projectRoot-relative display
  paths (AR-V17).

### Compatibility
- Node 22, ESM NodeNext, strict TS. New deps: `yargs@^17` + `@types/yargs` (dev)
  in cli (AR-V1); `tinyglobby` in compiler (AR-V3). **No chalk** (AR-V2).
- R15 boundary unchanged: neither new package edge touches
  frontend/language-server → codegen.

### Security
- Input validation: R47 root-scope filter — every discovered path must resolve within
  `projectRoot` (RD-13 R37); explicit-file existence check (R48). Glob patterns are
  validated by `@blend65/config` (RD-16 R29); the host validates the *results*.
- No shell interpolation: ACME is invoked via the shipped RD-09 process layer
  (execFile-based, not shell).
- Compile-path packages never print (AC-18) — enforced by ESLint + root spec test (AR-V18).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| yargs major | 17 / 18 | 17 | No v18 types exist; strict NodeNext | AR-V1 |
| Color | chalk / zero-dep | zero-dep | CLI must own the boolean anyway; amends AR-17 (ratified) | AR-V2 |
| Glob engine | tinyglobby / fs.globSync / hand-rolled | tinyglobby | Experimental-warning noise; ownership cost | AR-V3 |
| Testing | seams / skipIf / CI ACME / defer | all of (i)(ii)(iii) | AC-07 CI-verified for one CI line | AR-V4 |
| E10034 | emitBinary opt-in / checkBinaryBudget | checkBinaryBudget | Shipped design intent; richer message | AR-V5 |
| Host wiring | config-first / factory | config-first | LSP needs no factory; resolves circularity | AR-V6 |
| Bags | two / one | two | Cap fixed at creation; bootstrap contract | AR-V7 |
| Trailer | (formats) | `error: N errors[, M warnings] emitted` | Fills rd-11b Q8's deferral | AR-V11 |

> **Traceability:** every remaining design decision carries its AR-V reference in the
> component documents; RD-sourced behavior cites the RD R-number directly.

## Acceptance Criteria

The RD's §6 list (AC-01..AC-20) is the acceptance oracle. Plan-level restatement:

1. [ ] AC-01..AC-06 — facade contract (results, injectable host, never-throw) — ST-8..ST-21
2. [ ] AC-07..AC-17, AC-20 — CLI behavior, flags, streams, exit codes — ST-22..ST-38
3. [ ] AC-18 — compile-path no-print, lint + root spec test — ST-39
4. [ ] AC-19 — traceability audit (every decision → AR-NN / spec / `Design`)
5. [ ] AC-07 additionally CI-verified via real ACME (AR-V4) — ST-40
6. [ ] Full workspace verify green; RD-11 AC-16 ticked (both halves now shipped)
