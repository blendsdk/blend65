# Requirements: RD-09 ACME Emitter & Assembler Integration

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-09](../../requirements/RD-09-acme-emitter.md)

## Feature Overview

Turn the structured `InstrProgram` (RD-07/RD-08) into a runnable platform binary in two
halves: a pure, deterministic **serializer** (`InstrProgram → .asm` text) in
`@blend65/codegen`, and an **assembler-integration** process layer (discover + invoke ACME,
capture artifacts, parse the label file, budget check) in `@blend65/compiler`.

All requirement IDs (R1–R47) and acceptance criteria (AC-01..AC-20) below are defined in the
source RD. This document records the scope and the plan-level decisions; it does not restate
every RD row.

## Functional Requirements

### Must Have — Serializer (`@blend65/codegen`)

- [ ] `serializeToAcme(program: InstrProgram): string` — single canonical whole-program
      serializer (R3, R4, AC-01)
- [ ] Deterministic output: same `InstrProgram` → byte-identical `.asm` (R5, AC-02)
- [ ] Segment order: `!to` → symbol defs → origin/preamble → code streams → const-data
      streams (R14, AC-17) — per **AR-94/2A** (no `bss` emission; `zp` streams skipped)
- [ ] Symbol definitions emitted verbatim from `allocationPlan.symbolDefinitions` under one
      `; --- symbol definitions ---` header (R11–R13 via **AR-94/1A**, AC-05)
- [ ] Section-separator comments for readability (R10)
- [ ] Reuse `printInstr` for every `StreamEntry` (instr/label/directive) — no
      re-implementation of per-entry rendering (R22–R27, AC-07/08/09; D4/AR-60)

### Must Have — Process Layer (`@blend65/compiler`)

- [ ] `--emit-asm`: write the `.asm` file and stop (no ACME invocation) (R34, AC-03/04)
- [ ] ACME discovery: explicit path → PATH probe → hard error `E_ACME_NOT_FOUND` (R28/R29, AC-10)
- [ ] ACME invocation as child process with label-file + report flags; exit-code check
      (R30–R33, AC-11)
- [ ] ACME failure → ICE (`E9xxxx`) with stderr included; `.asm` retained (R35–R38, AC-12/13)
- [ ] Parse VICE label file → `Map<string, number>`; unparseable lines skipped as warnings
      (R45–R47, AC-15)
- [ ] Post-ACME binary-size budget check → `E10034` when exceeded (R43/R44, AC-14)
- [ ] Build artifacts (binary, `.asm`, label file) written to output dir (R39–R42, AC-16)

### Should Have

- [ ] `BuildResult` aggregates: success flag, diagnostics, binary/asm/label paths, symbol
      map, binary size (RD §4.7)

### Won't Have (Out of Scope — lives elsewhere)

- `Instr` model / `InstrProgram` structure → RD-07
- Peephole optimization → RD-08
- Platform profile data, startup-shim content/variant logic → RD-10
- Pre-ACME ZP/RAM budget checks → RD-05
- Resource-report rendering → RD-11
- CLI flag wiring (`--emit-asm`, `--acme-path` surface) → RD-15
- `blend65.json` config (`acmePath`, `outDir`) → RD-16
- Real emulator/ACME CI tier → RD-12 (CI has none yet, AR-27)

## Technical Requirements

### Determinism

- The serializer must be pure: no `Map`/`Set` iteration whose order could vary, no
  timestamps, `\n` line endings, fixed uppercase hex. Required for golden-snapshot testing
  (R5; mirrors `printInstr`).

### Compatibility

- Targets ACME's stable directive subset (`!byte`, `!word`, `!text`, `!fill`, `!to`, `* =`).
- R15/AR-20 boundary preserved: serializer stays in `@blend65/codegen`; process layer in
  `@blend65/compiler`. Neither is imported by `frontend`/`language-server`.

### Security

- ACME is spawned with an explicit argv array (no shell string interpolation) — avoids
  command injection via paths/filenames. The `.asm` path and output dir are compiler-derived,
  not user-controlled free text.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Symbol-def source | verbatim array / reconstruct groups / prefix-sniff comments | verbatim (1A) | least coupling to RD-05 naming; additive | AR-94 |
| Segment mapping | code→data no bss / empty BSS placeholder | code→data, no bss (2A) | no dead code; additive BSS later | AR-94 |
| Whole RD in one plan | one plan / serializer-first slice | one plan, 6 phases | user choice; phased for testability | — |
| Serializer file | extend `print-instr.ts` / new `serialize-acme.ts` | new file | keeps per-stream vs whole-program concerns separate | Design |

> **Traceability:** Every plan decision references AR-94 (the only runtime ambiguity) or the
> source RD's own AR citations (AR-55..AR-69, AR-80, AR-81). See `00-ambiguity-register.md`.

## Acceptance Criteria

The RD's AC-01..AC-20 are the authoritative acceptance set. Plan-level rollup:

1. [ ] `serializeToAcme` returns valid, deterministic ACME text (AC-01/02)
2. [ ] `--emit-asm` writes and stops; byte-identical to build feed (AC-03/04)
3. [ ] Symbol defs + preamble + all addressing modes serialize correctly (AC-05..09)
4. [ ] ACME discovery 3-tier; invocation produces binary + label file (AC-10/11)
5. [ ] ACME failure → ICE w/ stderr; `.asm` retained (AC-12/13)
6. [ ] Budget check `E10034`; label file parsed to symbol map; artifacts written (AC-14/15/16)
7. [ ] Segment order matches R14 (AC-17)
8. [ ] Unit + golden-snapshot tiers present (AC-18/19); all decisions trace to AR (AC-20)
9. [ ] All tests pass; no dead code; R15 boundary intact
