# Testing Strategy: RD-08 Peephole Optimizer (passthrough v1)

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Spec tests: every Must-Have FR + every in-scope AC has a concrete ST-case.
- Impl tests: edge cases (empty program, multi-stream, labels/directives present, null entry,
  explicit `enabled: true`).
- This is a back-end compiler stage — the E2E workflow is `IL → generateInstr → optimizeInstr`
  and asserting byte-identity through the peephole stage (AC-16).

### Test framework / location

Vitest, co-located in `packages/codegen/src/instr/`:
- `peephole.spec.test.ts` — specification tests (ST-*), written FIRST (red phase).
- `peephole.impl.test.ts` — implementation tests, written AFTER.

### Fixtures

Reuse the existing `packages/codegen/src/instr/test-fixtures.ts` (used by
`instr-program.spec.test.ts`) to build a small `InstrProgram` via `generateInstr`, plus the
`instr`/`label`/`directive` constructors and `programByteSize`/`printInstr` for byte-identity
assertions. No new fixture infrastructure is introduced (Rule 7 — use existing).

## 🚨 Specification Test Cases (MANDATORY)

> Derived EXCLUSIVELY from `01-requirements.md`, `03-01-peephole-passthrough.md`,
> `requirements/RD-08-peephole-optimizer.md`, and the preflight resolutions. Immutable oracles
> — if the implementation disagrees, the implementation is wrong.

### Feature: `optimizeInstr` passthrough contract

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|---------------------------|--------|
| ST-1 | Call `optimizeInstr(program, "nmos6502", bag)` on a non-empty `InstrProgram` from `generateInstr` | Returns an `InstrProgram`; `result.streams.length === program.streams.length`; `programByteSize(result) === programByteSize(program)` | FR-1/FR-3, AC-01/AC-02/AC-10 |
| ST-2 | Compare serialized output: `printInstr` over every entry of `optimizeInstr(program, cpu, bag)` vs `program` | Byte-identical sequence (same opcodes/modes/operands/labels/directives, in order) | FR-3, AC-16 |
| ST-3 | Call with `options = { enabled: false }` | Returns the **same** `InstrProgram` reference (`result === program`); `bag` has zero diagnostics (no validation run) | FR-4, AC-03 |
| ST-4 | Call with `options = { enabled: true }` (explicit) and again with `options` omitted | Both run the validate-then-return path; both return structurally identical programs; `bag` has zero diagnostics for a well-formed program | FR-5, AC-04 |
| ST-5 | Inspect `result.preamble` and `result.allocationPlan` after passthrough on a program with a non-empty preamble (via `assembleProgram`) | `result.preamble` deep-equals input `preamble`; `result.allocationPlan === program.allocationPlan` (verbatim) | FR-3, AC-PA (PF-004) |
| ST-6 | Inspect the exported `PeepholeRule` contract + `V1_RULES` | A value satisfying `{ name, windowSize, priority, cpuCompat, match, replace }` typechecks as `PeepholeRule`; `V1_RULES` is an empty array (`.length === 0`) | FR-6, AC-05 |
| ST-7 | Run `optimizeInstr` twice on the same input | Both results are structurally identical (determinism) | FR-3, AC-13 |
| ST-8 | Program whose streams contain `label` and `directive` entries | Those entries appear unchanged and in the same positions in the result | FR-3, AC-08/AC-09 |

### Feature: `validateProgramStructure` (structural well-formedness, R6/PF-006)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|---------------------------|--------|
| ST-9 | `validateProgramStructure(wellFormedProgram, bag)` | `bag` has zero diagnostics | FR-5, AC-SV |
| ST-10 | A program with a `null` entry spliced into a stream's `entries` | `bag` records an ICE with code `E90001` (`IceCode.Unexpected`); no user-band (`E10xxx`/`W10xxx`) diagnostic is added | FR-8, AC-SV (PF-006, RD R30) |
| ST-11 | A program whose `streams` is not an array (forced malformed input) | `bag` records an ICE `E90001`; function returns without throwing | FR-8, AC-SV |
| ST-12 | `optimizeInstr` on the malformed (null-entry) program with default options | The structural ICE is surfaced on `bag` (validation runs before return) | FR-5/FR-8, AC-SV |

> **Source-derived note:** ST expectations come from the requirement/spec docs, NOT from the
> implementation. The byte-identity oracle (ST-2/ST-16-equivalent) is the RD's AC-16 contract.

## Test Categories

### Specification Tests (red-first)

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `peephole.spec.test.ts` | ST-1 … ST-12 | `optimizeInstr` + `validateProgramStructure` |

### Implementation Tests (after green)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `peephole.impl.test.ts` | Empty program (`streams: []`) passthrough; single-stream; multi-stream ordering preserved; mixed instr/label/directive stream; explicit `enabled: true` vs omitted equivalence; `cpuVariant` value does not affect output in v1 (`nmos6502` vs `wdc65c02` give identical results) | High |

## Verification Checklist

- [ ] All ST-cases (ST-1..ST-12) defined with concrete input/output pairs ✅ (this doc)
- [ ] Every ST traces to an FR/AC/PF/RD source ✅
- [ ] Spec tests written BEFORE implementation
- [ ] Spec tests verified to FAIL before implementation (red phase)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Implementation tests written for edge cases
- [ ] `yarn build && yarn typecheck && yarn lint && yarn test` all pass
- [ ] No regressions in existing `instr/` tests
- [ ] R15 boundary intact (no codegen import added to frontend/language-server)
