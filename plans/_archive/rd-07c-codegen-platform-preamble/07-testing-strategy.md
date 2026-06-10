# Testing Strategy: RD-07c Codegen Platform Preamble

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit (spec) tests: `assembleProgram` preamble population + entry-label + sanitization +
  determinism — written BEFORE implementation, verified red.
- End-to-end golden: gate IL → `assembleProgram(c64Plugin)` → `printInstr` = exact ACME text.
- Impl tests: `programByteSize` over the populated preamble; multi-function sanitization edges.
- No regressions: the three RD-07b goldens are updated (label change, D4) and stay green; the
  R15 boundary tier stays green.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived **exclusively** from `01-requirements.md`, `03-01-*`, the Ambiguity Register, the
> frozen ST-C64-2 preamble text, and the verified `printInstr` rendering rules — **NOT** by
> running `assembleProgram`. IMMUTABLE ORACLE RULE applies (testing.md Rule 10).

### `assembleProgram` — preamble & program shape

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-A1 | `assembleProgram(lowerToIL(gateFixture), c64Plugin, bag)` → `.preamble` | deep-equals `c64Plugin.emitPreamble({projectName:"main",shimVariant:"terminating",needsBssZero:false,needsDataInit:false})` (non-empty) | FR-1/FR-2/FR-4/FR-5, AC-01 |
| ST-A2 | same call → `.streams` | identical to `generateInstr(il,"nmos6502",bag).streams` (wrapper does not alter streams) | FR-1, AC-05 |
| ST-A3 | same call → `.allocationPlan` | identical reference to `il.allocationPlan` | FR-1 |
| ST-A4 | `assembleProgram` called twice on the same IL+plugin | the two programs render to byte-identical `printInstr` output (determinism) | FR-8, AC-03 |
| ST-A5 | `bag.hasErrors()` after assembling the gate program | `false` (no ICE; live ops only) | FR-1, AC-01 |

### Entry label & sanitization

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-A6 | gate program entry stream → first entry of `streams[0]` | a `label` entry whose name is `_main` (not `Main.main`) | FR-6, AC-02 |
| ST-A7 | a fixture function `Math.add` (non-entry) → its stream label | `Math_add` (`.`→`_`) | FR-7, AC-02 |
| ST-A8 | `printInstr(streams[0])` for the gate | first line is `_main:` | FR-6, FR-10 |

### End-to-end golden

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-AG1 | gate IL → `assembleProgram(c64Plugin)` → `printInstr(preamble-stream)` + `"\n"` + `printInstr(streams[0])` | the exact text below | FR-10, AC-04 |

**ST-AG1 expected ACME text** (preamble from ST-C64-2 + the `_main` body — the RD-07b ST-G2
body with the entry relabelled `_main`):

```
!to "main.prg", cbm
* = $0801
    !word $080B
    !word $000A
    !byte $9E
    !text "2061"
    !byte $00
    !word $0000
__startup:
    LDA #$36
    STA $01
    JSR _main
    LDA #$37
    STA $01
    RTS
_main:
    LDA #$05
    STA __frame_Main_main_c
    LDA __frame_Main_main_c
    STA $D020
    RTS
```

> The preamble half is rendered by serializing a stream `{symbol:"_pre", segment:"code",
> entries: program.preamble}` through `printInstr` (the same technique ST-C64-2 uses). The
> body half is `printInstr(program.streams[0])`. The test joins them with a single newline.

> **⚠️ AUTHORING RULE honoured:** every expected value above is taken from the documented
> hook output (ST-C64-2, already green) + the RD-07b ST-G2 body + the D4 relabel rule. None
> is guessed from a not-yet-written implementation.

## Test Categories

### Specification Tests (from ST-cases above)

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `codegen … instr/assemble.spec.test.ts` | ST-A1..A8 | `assembleProgram` + entry label/sanitize — driven by an **inline fake** `PlatformPlugin` (D10) |
| `compiler … assemble.golden.spec.test.ts` | ST-AG1 | end-to-end gate ACME golden with the **real `c64Plugin`** — lives in `@blend65/compiler` (D10) |

> **D10 (package boundary):** the real-`c64Plugin` golden moved from `@blend65/codegen` to
> `@blend65/compiler` to avoid a `codegen → platforms` build cycle (platforms already
> dev-depends on codegen). Codegen tests use a minimal inline fake plugin; the `PlatformPlugin`
> interface lives in `@blend65/core`, so no cross-package edge is added.

### Implementation Tests (edge cases, internals)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `instr/assemble.impl.test.ts` | `programByteSize` counts the populated preamble; `needsDataInit` true when `constData` present; multi-function fixture sanitizes all non-entry labels; a function literally named `main` in a non-`Main` module still maps to `_main` | High |

### Updated existing tests (regression, traced to D4)

| Test File | Change | Reason |
| --------- | ------ | ------ |
| `instr/generate.golden.spec.test.ts` | ST-G1 `Math.add:`→`Math_add:`; ST-G2 `Main.main:`→`_main:`; ST-G3 `Math.eq:`→`Math_eq:` | D4 relabel supersedes the RD-07b label oracle; bodies unchanged |
| `instr/translate.spec.test.ts` | all `M.f:` label oracles → `M_f:` (18 occurrences) | D4 relabel: the fixture function `M.f` is a non-entry function → `M_f`; bodies unchanged. Found during execution (D9) — the same mechanical D4 regression as the goldens, under-enumerated at planning |

## Test Data

### Fixtures Needed

- `gateFixture` / `slice2Fixture` (existing, `il/test-fixtures.ts`) — the gate program.
- `addFixture` / `eqFixture` (existing) — non-entry function sanitization.
- `c64Plugin` (existing, `@blend65/platforms`) — the live plugin for golden + preamble.

### Mock Requirements

- None — real `lowerToIL`, real `c64Plugin`, real `printInstr`.

## Verification Checklist

- [ ] ST-A1..A8 + ST-AG1 defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement/AR/frozen ST-C64-2
- [ ] Spec tests written BEFORE implementation
- [ ] Spec tests verified to FAIL before implementation (red phase)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Impl tests written for edge cases
- [ ] RD-07b goldens updated for the D4 relabel and green
- [ ] R15 boundary tier (`test/boundary.spec.test.ts`) green
- [ ] `git status --porcelain spec/` empty
- [ ] Full verification passes
