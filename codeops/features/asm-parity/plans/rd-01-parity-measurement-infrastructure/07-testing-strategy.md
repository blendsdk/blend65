# Testing Strategy: RD-01 Parity Measurement Infrastructure

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Timing table, loader, summarizer, parser (core logic) | 90% |
| measureCycles / driver changes / scripts | 80% |
| Renderer layout, CI glue | 60% |

- Test names state behavior: `should [expected behavior] when [condition]`.
- Tier placement: CI-safe tests run everywhere; emulator-dependent STs are
  `skipIf(!hasVice())` (+ `!hasAcme()` where ACME assembles the fixture) per req-AR #5 —
  both tiers are first-class.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-01, the 03-XX specs, and the Ambiguity Registers (req-AR / plan-AR).
> **IMMUTABLE ORACLE RULE:** if the implementation does not match a spec test, the
> implementation is wrong — never the test.
> The `Source` column lives in this document only; in-code traceability comments quote the
> behavior in plain language, never an ST/AR id or a planning path.

### Timing Table (03-01) — `packages/core/src/timing/nmos-table.spec.test.ts` (+ the coverage test in codegen)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | `getTiming("LDA", "AbsoluteX")` | `{ bytes: 3, baseCycles: 4, pageCrossPenalty: 1, branchTakenPenalty: 0 }` | RD AC-2 · PF-011 (PascalCase `AddressingMode` literals) |
| ST-2 | `getTiming("STA", "AbsoluteX")` | `{ bytes: 3, baseCycles: 5, pageCrossPenalty: 0, branchTakenPenalty: 0 }` | RD AC-2 |
| ST-3 | `getTiming("BNE", "Relative")` (and each branch) | `{ bytes: 2, baseCycles: 2, branchTakenPenalty: 1, pageCrossPenalty: 1 }` — reads as 2, +1 taken, +2 taken-across-page | RD AC-2 |
| ST-4 | `getTiming("JSR", "Absolute")` / `getTiming("RTS", "Implied")` | `baseCycles` 6 / 6 | RD AC-2 |
| ST-5 | Every legal NMOS (opcode, mode) pair in codegen's legality table; plus a 65C02-only opcode lookup | Exactly one timing entry per legal pair (test iterates the legality table — lives in codegen, importing core); the 65C02 lookup is a compile-time type error (`@ts-expect-error`), never a silent 0 | RD AC-2 · PF-002/PF-006 |

### Cycle Measurement (03-02) — `measure.spec.test.ts`, `text-monitor.spec.test.ts` (test-harness)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-6 | `advanceInstructions(30000)` from a booted machine, then immediately `readRegisters()` (emulator tier) | Registers reflect all 30000 instructions executed (raster advanced > 1 frame) — the advance is not aborted by the follow-up command | plan-AR #8 |
| ST-7 | Canned reply `"Stopwatch:       3567\n(C:$ea31) "`; and a buffer polluted by a checkpoint break banner whose register line ends in a raw number, followed by the real reply | Parser returns 3567 in both cases — only an anchored `^Stopwatch:` line in the post-send segment is accepted | plan-AR #1 |
| ST-8 | Reply with no parseable `Stopwatch:` line | Error carrying the raw reply bytes | plan-AR #1 |
| ST-9 | `measureCycles` over the IRQ demo fixture's window, two fresh emulator processes, same binary (emulator+ACME tier) | Identical cycle counts (phase-locked window) | RD AC-1 · plan-AR #10 |
| ST-10 | The same demo window, which contains ≥1 raster IRQ | Count equals the hand-computed instruction sum INCLUDING the IRQ entry + handler cycles | RD AC-1 · req-AR #2 · plan-AR #2 |
| ST-11 | `measureCycles` with a `toLabel` the program never reaches | `withTimeout` rejection within the given timeout | RD F2 |

### Budget Tier & Rasterpoll Fixture (03-03) — `golden-rasterpoll.spec.test.ts`, `budgets.spec.test.ts` (test-harness)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-12 | `emitAsm` of the rasterpoll fixture | Byte-exact match against committed `rasterpoll.asm.golden` | RD AC-3 · PF-001 |
| ST-13 | The emitted rasterpoll asm | Contains the `$D012` poll landmark and the labels budgets.json's windows name | plan-AR #4 |
| ST-14 | budgets.json with an unknown key / missing `bytes` / `kind:"span"` lacking `staticMaxCycles` | Loader error naming file + JSON path, before any assertion runs | plan-AR #3 |
| ST-15 | A program whose assembled size exceeds its `bytes` budget | Tier failure naming program, actual bytes, budget bytes (CI) | RD AC-3 |
| ST-16 | Assembled size exactly equal to the budget | Passes (ratchet boundary) | req-AR #12 |
| ST-17 | slice8b `copyLoop` static window; then the budget lowered 1 below current static max | Static min–max computed via the table asserts in CI; the lowered budget fails the tier | RD AC-4 |
| ST-18 | rasterpoll `pollIter` perIteration window | Static per-iteration cycles equal the hand-computed poll-body sum; asserts in CI | RD AC-4 · PF-003 |
| ST-19 | balloon `frameUpdate` measured window under **quiesce** (I-flag mask at the from-stop; no display blank — the window runs at raster ≥251), two fresh emulator processes | Identical measurements ≤ `measuredMaxCycles`; lowering the budget below current fails | RD AC-4 · plan-AR #10 · PF-009 |

### Parity Scripts (03-04) — repo-root `test/twin-diff.spec.test.ts`, `test/annotate-cycles.spec.test.ts`

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-20 | `yarn twin:diff` on the balloon pair | Markdown report with parity ratios rendered to two decimals (generated ÷ hand-written): bytes from assembled PRG sizes, cycles as **max-sum ÷ max-sum** of the straight-line spans; the JSON output carries min and max sums per side | RD AC-5 · req-AR #9 · PF-015 |
| ST-21 | Every divergence row in that report | Carries exactly one of: instruction selection, layout, data placement, addressing modes, register usage | RD AC-5 · req-AR #9 |
| ST-22 | Goldens with no twin present | Listed as "unpaired"; exit code 0 | RD AC-5 |
| ST-23 | `--json out.json` | File contains the same content as stdout, as JSON | RD AC-5 · req-AR #11 |
| ST-24 | An input path resolving outside the repo root (both scripts) | Rejected with a named error before any FS read/write; exit ≠ 0 | RD AC-9 |
| ST-25 | `yarn annotate:cycles` on an ACME report of a golden containing one page-cross case | Every instruction line annotated (`min–max` where variable); per-block sums; the hand-computed reference block matches, page-cross detected from final addresses | RD AC-6 · req-AR #8 |
| ST-26 | The convenience flag with a `.asm` input | ACME is invoked (argv array) with report output first; annotation proceeds from that report | RD F9 · req-AR #8 |

### ACME Report Parser (03-04 §Shared acquisition) — `compiler/src/acme/report-file.spec.test.ts`

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-32 | A canned ACME report containing an absolute and a zeropage instruction with syntactically identical operand shapes (symbolic operands) | Parser returns `(opcode, mode, address, bytes)` records with the modes disambiguated from the emitted operand bytes/addresses — never from the operand text | PF-010 |
| ST-33 | A malformed report line (unparseable bytes/mnemonic column) | Error naming the file and line, before any records are returned | PF-010 · RD §Technical Requirements |

### Resource Report (03-05) — core report spec tests + a compiler-level build test

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-27 | Building `examples/balloon/main.blend` (c64) | Terminal summary shows a per-function section: bytes + `min–max` cycles per function, labeled as straight-line estimates | RD AC-7 · req-AR #7 |
| ST-28 | The same build with `--report json` / `--emit-report` | The identical per-function data appears in both JSON outputs | RD AC-7 |
| ST-29 | A `wdc65c02` build (Commander X16 target) | Cycle columns omitted with the "no timing data for this CPU variant" label; byte sizes remain | RD F7 · PF-002 |
| ST-30 | A c64 build | `startupCycles` is non-zero and equals the timing-table sum over the startup shim | RD AC-8 · req-AR #14 |
| ST-31 | Terminal renderer golden | Regenerated golden matches — the new section is stable | RD F7 |

> **⚠️ AUTHORING RULE:** expectations above derive from RD-01/AR entries only. If an expected
> output cannot be determined from spec, STOP — register it (surface-during-authoring) before
> writing the test.

## Test Categories

### Specification Tests

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `core/src/timing/nmos-table.spec.test.ts` | ST-1…ST-4 | 03-01 |
| `codegen/src/instr/timing-coverage.spec.test.ts` | ST-5 | 03-01 |
| `test-harness/src/run/measure.spec.test.ts` | ST-9…ST-11 | 03-02 |
| `test-harness/src/emulator/vice/text-monitor.spec.test.ts` | ST-7, ST-8 | 03-02 |
| `test-harness/src/emulator/vice/advance.spec.test.ts` | ST-6 | 03-02 |
| `test-harness/src/golden-rasterpoll.spec.test.ts` | ST-12, ST-13 | 03-03 |
| `test-harness/src/budgets.spec.test.ts` | ST-14…ST-19 | 03-03 |
| repo-root `test/twin-diff.spec.test.ts` | ST-20…ST-24 | 03-04 |
| repo-root `test/annotate-cycles.spec.test.ts` | ST-24…ST-26 | 03-04 |
| `compiler/src/acme/report-file.spec.test.ts` | ST-32, ST-33 | 03-04 §Shared acquisition |
| `core/src/report/*.spec.test.ts` + compiler build test | ST-27…ST-31 | 03-05 |

### Implementation Tests (after implementation)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `nmos-table.impl.test.ts` | Table invariants (bytes vs instr-model, penalty placement) | High |
| `text-monitor.impl.test.ts` | Split TCP frames, banner interleaving, stop-state invariant | High |
| measure/driver impl tests | Checkpoint cleanup on both exit paths (PF-017); quiesce writes (I flag; DEN only when requested) | High |
| `report-file.impl.test.ts` (compiler) | ACME-report parser edge cases (column drift, data lines, `!fill` regions) | Med |
| `budget-loader.impl.test.ts` | Schema edge cases, span math variance | Med |
| script internals via root `test/*.impl.test.ts` | Classifier, ratio rounding, report parser | Med |
| summarizer/renderer impl tests (core/codegen) | Directive skipping, layout edges | Med |

### Integration / E2E
- The budget tier IS the integration test (compiler → ACME → table → emulator).
- E2E: full verify + local emulator suites (Phase 7); AC-10.

## Test Data / Fixtures
- `test/asm/measure-irq-demo.asm` (03-02; own-raster-IRQ, phase-locked, hand-computed window).
- `examples/rasterpoll/` + golden (03-03).
- Malformed budgets/manifest fixtures inline in the spec tests (tmp dirs).
- Mocks: none — real compiler, real ACME, real VICE (per project standards; the text-monitor
  parser tests use canned byte buffers, not a mocked VICE).

## Verification Checklist
- [ ] All ST cases defined with concrete input/output pairs
- [ ] Every ST traces to RD-01 / an AR entry
- [ ] Spec tests written BEFORE implementation; red phase verified per phase
- [ ] Green phase verified per phase; impl tests after
- [ ] No regressions (12 existing goldens + full suite)
- [ ] Emulator-tier STs proven green locally (CI skips them by design, req-AR #5)
