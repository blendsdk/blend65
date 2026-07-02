# Current State: RD-09 ACME Emitter & Assembler Integration

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

RD-09 builds on a substantial existing base from RD-07a/b/c and RD-05. The per-entry
rendering and the platform preamble already exist; RD-09 adds whole-program orchestration
and the external-process layer.

### What Exists

| File | Symbol | Relevance to RD-09 |
| ---- | ------ | ------------------ |
| `packages/codegen/src/instr/print-instr.ts` | `printInstr(stream)`, `instrByteSize(entry)` | **Reused.** Canonical per-`InstrStream` ACME serializer (R6–R9, R22–R27 already done, golden-tested). `serializeToAcme` calls this per stream. |
| `packages/codegen/src/instr/instr-program.ts` | `InstrProgram`, `generateInstr`, `assembleProgram`, `programByteSize` | **Input + reused.** `InstrProgram = { preamble, streams, allocationPlan }`. `assembleProgram` fills the preamble from the plugin. `programByteSize` gives the pre-ACME size. |
| `packages/core/src/instr-model/stream.ts` | `InstrStream`, `StreamEntry`, `AcmeDirective`, segment `"code"\|"data"\|"zp"` | **Input.** Stream shape + the segment enum that drives AR-94/2A ordering. |
| `packages/core/src/sfa/allocation-plan.ts` | `AllocationPlan`, `SymbolDefinition` | **Input.** `symbolDefinitions: readonly {name,value}[]` is the AR-94/1A symbol source. |
| `packages/frontend/src/sfa/symbols.ts` | `generateSymbolDefinitions` | Confirms `symbolDefinitions` ordering (frames→vars→ZP, ST-A4). Not called by RD-09 — the array is pre-built. |
| `packages/compiler/src/assemble.golden.spec.test.ts` | ST-AG1 golden | **Pattern.** Already renders preamble + body to exact gate `.asm`, but by hand-composing `printInstr` calls — exactly what `serializeToAcme` replaces. |
| `packages/core/src/diagnostics/diagnostic-codes.ts` | `DiagCode.BinaryTooLarge = "E10034"`, `IceCode.Unexpected = "E90001"` | **Reused.** Budget error + ICE codes already defined. A new `E_ACME_NOT_FOUND` user code is added (see Gap 4). |

### Key Code Analysis

`printInstr(stream: InstrStream): string` already renders instr/label/directive entries with
correct ACME syntax, indentation, and all 13 addressing modes (exhaustive `switch` with
`never` guards). `serializeToAcme` is therefore an **orchestrator** over `printInstr`, not a
re-implementation:

```
serializeToAcme(program):
  1. emit !to (the outputFile directive from preamble) at top
  2. emit "; --- symbol definitions ---" + each program.allocationPlan.symbolDefinitions
     entry as "name = $XXXX"   (AR-94/1A)
  3. emit the rest of preamble (origin, BASIC stub, startup shim) via printInstr
  4. emit code-segment streams via printInstr, each under a "; --- function: X ---" header
  5. emit data-segment streams via printInstr, each under a "; --- const data: X ---" header
     (zp streams skipped; no bss — AR-94/2A)
  return lines joined with "\n" + trailing "\n"
```

## Gaps Identified

### Gap 1: No whole-program serializer
**Current:** only per-stream `printInstr`; whole-program assembly is hand-composed in tests.
**Required:** `serializeToAcme(program)` orchestrates symbol defs + preamble + segments (R3/R14).
**Fix:** new `packages/codegen/src/instr/serialize-acme.ts`.

### Gap 2: No `--emit-asm` write path
**Current:** nothing writes `.asm` to disk.
**Required:** write `serializeToAcme` output to `<outDir>/<name>.asm` and stop (R34).
**Fix:** `@blend65/compiler` `emit-binary.ts` (emit-asm-only branch).

### Gap 3: No ACME discovery / invocation / label parsing
**Current:** ACME is never invoked.
**Required:** 3-tier discovery, child-process invocation, label-file parse, budget check
(R28–R47).
**Fix:** new `packages/compiler/src/acme/` module.

### Gap 4: No `E_ACME_NOT_FOUND` user diagnostic code
**Current:** `diagnostic-codes.ts` has `BinaryTooLarge`/ICE but no ACME-not-found code.
**Required:** an actionable user error when ACME can't be located (R29).
**Fix:** add one `DiagCode` entry (next free code in the resource/tooling band) — a minimal,
additive change to `@blend65/core`.

> **Decision per AR-94:** the serializer reads `allocationPlan.symbolDefinitions` (verbatim,
> 1A) and orders segments `code → data` with `zp` skipped and no `bss` (2A). The RD §4.2
> pseudocode field names are illustrative.

## Dependencies

### Internal
- `@blend65/codegen`: `printInstr`, `InstrProgram` — present.
- `@blend65/core`: `AllocationPlan.symbolDefinitions`, `DiagnosticBag`, `DiagCode`/`IceCode` — present.
- `@blend65/platforms`: real `c64Plugin` for the integration golden (via `@blend65/compiler`).

### External
- Node `node:child_process` (`spawn`/`execFile`) and `node:fs`/`node:path` — process layer only.
- ACME assembler executable — runtime dependency, **not** present in CI (AR-27). Phase-4/6
  tests mock the spawn; no test requires a real ACME binary.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Golden churn: `serializeToAcme` output overlaps the existing ST-AG1 hand-composed golden | Med | Low | Phase 1 asserts `serializeToAcme` output equals the same gate text; ST-AG1 stays as the integration anchor. Reconcile if drift. |
| Spawning ACME in unit tests would make CI depend on ACME | Med | High | Mock `child_process` in Phase 4/6; only the (future) RD-12 tier runs real ACME. |
| `E_ACME_NOT_FOUND` code collision | Low | Med | Pick the next free code in the tooling band; assert uniqueness via the existing diagnostic-codes spec test. |
| R15/AR-20 boundary violation | Low | High | Serializer in `codegen`, process layer in `compiler`; neither imported by frontend/LSP. Enforced by ESLint + `test/boundary.spec.test.ts`. |
