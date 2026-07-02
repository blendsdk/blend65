# Testing Strategy: RD-09 ACME Emitter & Assembler Integration

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Two test surfaces: (1) the **pure serializer** (`serializeToAcme`) — fully golden/unit
testable, no external dependency; (2) the **process layer** — unit tested with **mocked**
`child_process`/fs, so no test requires a real ACME binary (AR-27; CI has no ACME tier until
RD-12). Spec tests are immutable oracles derived from the RD and AR-94 (testing.md Rule 10).

### Coverage Goals
- Serializer: golden-snapshot of representative programs + unit coverage of every branch.
- Process layer: each module's success + error paths via mocks.
- No regressions: `assemble.golden.spec.test.ts` (ST-AG1) is **migrated** to call
  `serializeToAcme` (AR-95/A) and must stay green with its updated header-bearing golden; the
  serializer's ST-S8 golden and the migrated ST-AG1 golden are the same canonical text.

## 🚨 Specification Test Cases (MANDATORY — IMMUTABLE ORACLES)

> Derived from `requirements/RD-09-acme-emitter.md` (R-rows, AC-rows) and `00-ambiguity-register.md`
> (AR-94). Expected outputs are composed from the RD's §4.8 worked example and the live
> `printInstr` format — NOT by running `serializeToAcme`.

### Serializer (`serialize-acme.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-S1 | Program with a `!to` outputFile directive in preamble | First line of output is `!to "main.prg", cbm` (hoisted above symbol header) | R14, §4.8 |
| ST-S2 | Program with non-empty `allocationPlan.symbolDefinitions` `[{name:"__zp_a",value:2},{name:"__frame_main",value:0x0820}]` | Lines: `; --- symbol definitions ---`, then `__zp_a = $0002`, then `__frame_main = $0820` (verbatim array order) | AR-94/1A, R11 |
| ST-S3 | Program with **empty** `symbolDefinitions` | `; --- symbol definitions ---` header present with no symbol lines beneath it | AR-94/1A |
| ST-S4 | Program with a `code` stream `symbol:"_main"` | `; --- function: _main ---` precedes that stream's `printInstr` output | R14, R15 |
| ST-S5 | Program with both a `code` and a `data` stream | code section emitted entirely before data section; data under `; --- const data: <sym> ---` | AR-94/2A, R14, R16 |
| ST-S6 | Program containing a `zp`-segment stream | the `zp` stream body is **not** emitted (skipped) | AR-94/2A |
| ST-S7 | Output ends with exactly one trailing `\n`; identical input twice → identical string | deterministic, newline-terminated | R5, AC-02 |
| ST-S8 | Full gate program (c64 preamble + `_main` body, as ST-AG1) | exact `.asm` text equals the **header-bearing** §4.8 golden: `; --- symbol definitions ---` header (empty for the gate) + `; --- function: _main ---` before the `_main` body, otherwise identical preamble/instruction bytes. Per **AR-95/A**, `serializeToAcme` is the single canonical output and `assemble.golden.spec.test.ts` (ST-AG1) is migrated to call it (see task 1.1.8). | §4.8, AC-01/17, AR-95 |

### ACME Discovery (`discover-acme.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-D1 | `acmePath` set to an executable file | returns that path; no diagnostic | R28 |
| ST-D2 | `acmePath` unset, `acme` present on PATH | returns the PATH-resolved path | R28 |
| ST-D3 | `acmePath` unset, not on PATH | returns null; bag has `AcmeNotFound` with the R29 actionable message | R29, AC-10 |

### ACME Invocation (`invoke-acme.spec.test.ts`, mocked child_process)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-I1 | Mocked ACME exits 0, writes binary | `success:true`, `binaryPath`/`labelFilePath` set, `binarySize` read | R30/R33, AC-11 |
| ST-I2 | Mocked ACME exits non-zero, stderr "Error: x" | `success:false`; bag has ICE `E90001` containing the stderr | R35/R37, AC-12 |
| ST-I3 | After failure | the `.asm` file is not deleted (retained) | R36, AC-13 |

### Label-File Parser (`label-file.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-L1 | `al C:080d ._main\nal C:0820 .__frame_main` | Map `{ _main: 0x080d, __frame_main: 0x0820 }` | R45, AC-15 |
| ST-L2 | Mixed: one valid line + one garbage line | valid entry parsed; garbage skipped; no throw | R47 |
| ST-L3 | Empty content | empty Map | R47 |

### Emit Orchestration (`emit-binary.spec.test.ts`, mocked invoke/fs)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-E1 | `emitAsmOnly:true` | `.asm` written; `success:true`; ACME never invoked; `binaryPath` undefined | R34, AC-03 |
| ST-E2 | Full run, mocked ACME success | `BuildResult` has binaryPath, asmPath, symbols map, binarySize | R39, AC-16 |
| ST-E3 | `binarySize > maxBinarySize` | bag has `E10034`; `success:false` | R43, AC-14 |

## Test Categories

### Specification Tests (written BEFORE implementation)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/codegen/src/instr/serialize-acme.spec.test.ts` | ST-S1..S8 | Serializer |
| `packages/compiler/src/acme/discover-acme.spec.test.ts` | ST-D1..D3 | Discovery |
| `packages/compiler/src/acme/invoke-acme.spec.test.ts` | ST-I1..I3 | Invocation |
| `packages/compiler/src/acme/label-file.spec.test.ts` | ST-L1..L3 | Label parser |
| `packages/compiler/src/acme/emit-binary.spec.test.ts` | ST-E1..E3 | Orchestration |

### Implementation Tests (written AFTER implementation)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `serialize-acme.impl.test.ts` | Edge cases: preamble-only, data-only, multi-stream order, hex padding | High |
| `discover-acme.impl.test.ts` | Windows `.exe`, non-executable path message | Med |
| `invoke-acme.impl.test.ts` | argv array shape (no shell), report flag present | Med |
| `label-file.impl.test.ts` | Whitespace tolerance, 4-hex-digit boundary | Med |
| `emit-binary.impl.test.ts` | outDir creation, asmPath retained on failure | High |

## Verification Checklist

- [ ] All ST cases defined with concrete input/output pairs (done above)
- [ ] Every ST case traces to an R/AC/AR source (done above)
- [ ] Spec tests written BEFORE implementation; verified to FAIL (red) per phase
- [ ] All spec tests pass after implementation (green)
- [ ] Impl tests cover edge cases and internals
- [ ] No regressions: ST-AG1 + full suite green
- [ ] `yarn build && yarn typecheck && yarn lint && yarn test` all pass
- [ ] R15 boundary tier (`test/boundary.spec.test.ts`) intact
