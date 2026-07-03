# Current State: RD-15 — Programmatic & CLI API

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Analyzed**: 2026-07-03 (post-RD-11b; all RD-15 consumables shipped)

## Existing Implementation

### What Exists

Every pipeline stage RD-15 wires is shipped and green (core 237 tests; full workspace
verify passing). The integration shape is proven end-to-end by
`compiler/src/t4-pipeline.spec.test.ts`, which hand-wires
lex → parse → analyze → lowerToIL → assembleProgram → runtime section → serializeToAcme.
What does NOT exist: any facade function, any `CompilerHost`, any CLI beyond a
`VERSION` stub.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/compiler/src/index.ts` | Barrel: RD-09 ACME layer only | Add `api/` + `host/` exports; re-export renamed `EmitBinaryResult` |
| `packages/compiler/src/acme/emit-binary.ts` | `emitBinary` orchestration; exports `BuildResult`, inline E10034 (l.124–141) | PF-002 rename `BuildResult` → `EmitBinaryResult`; cross-ref comment to `checkBinaryBudget` (AR-V5); otherwise untouched |
| `packages/cli/src/index.ts` | `VERSION` stub only | Rewrite: export `runCli` + `VERSION` |
| `packages/cli/package.json` | No `bin`, deps only compiler+config | Add `bin`, `yargs`, `@types/yargs` (dev) |
| `packages/compiler/package.json` | 5 workspace deps | Add `tinyglobby` |
| `packages/core/src/diagnostics/diagnostic-codes.ts` | Code registry; RD-16 band ends E10246 | Add `DriverSourceFileNotFound: "E10250"`, `DriverNoSourceFiles: "E10251"` |
| `packages/core/src/index.ts` | Core barrel | Add `export * from "./host/index.js"` |
| `eslint.config.js` (root) | Flat config; AR-P7 boundary rules | Add AC-18 no-print rules for compile-path `src/` |
| `.github/workflows/*.yml` | install→typecheck→lint→build→test, no ACME | Add `apt-get install -y acme` step (AR-V4) |

### Integration evidence (the facade's call surface, all verified)

| Stage | Entry point | Evidence |
| ----- | ----------- | -------- |
| Config | `loadConfig(options): LoadConfigResult` — sync; overrides `ConfigOverrides`; `knownPlatforms`; `CONFIG_SOURCE_ID` | `config/src/load-config.ts:72`, `config/src/types.ts` |
| Lex/Parse | `lex(sourceId, source, bag)`; `parse({tokens, source, sourceId, bag})` | `t4-pipeline.spec.test.ts:127-128` |
| Semantic | `analyze({programs, bag, profile, registry?, targetProfile?})` | `frontend/src/semantics/analyze.ts:44-55` |
| SFA | `planAllocation(input, profile, bag): AllocationPlan`; `modelToFunctionInfo(model)` | `frontend/src/sfa/plan-allocation.ts:83`, `model-adapter.ts:34` |
| Intrinsics | `createIntrinsicRegistry(plugin.intrinsics, plugin.id)` — core catalog auto-included | `core/src/intrinsics/registry.ts:120-139` |
| Platform | `PLATFORM_REGISTRY`, `loadPlatform(id)` (throws on unknown — pre-guarded via `knownPlatforms`) | `platforms/src/registry.ts:42-51` |
| IL | `lowerToIL({program, model, plan, registry}, bag)`; `optimizeIL`; `printIL` (for `emitIl`) | `codegen/src/il/index.ts:42-49` |
| Instr | `assembleProgram(il, plugin, bag)`; `optimizeInstr` (peephole); `serializeToAcme(program, {runtimeSection})` | `codegen/src/instr/index.ts:53-62` |
| Runtime | `collectReferencedRoutines`, `buildRuntimeSection`, `RT_ROUTINES` | `t4-pipeline.spec.test.ts:140-147` |
| ACME | `emitBinary(asmText, opts, bag, deps=defaultEmitDeps)` — injectable `EmitDeps` | `compiler/src/acme/emit-binary.ts:91-96` |
| Diagnostics | `createDiagnosticBag({maxErrors?})`; `createSourceMap()`; `createSeverityPolicy`/`applySeverityPolicy`; `renderTerminal(diags, sourceMap, {color})`; `renderJson` | `core/src/diagnostics/` (RD-11b) |
| Report | `buildResourceReport(inputs)`; `checkBinaryBudget(report, bag)`; `renderReportTerminal(report)` (uncolored by design); `renderReportJson` | `core/src/report/build-resource-report.ts` |

## Gaps Identified

### Gap 1: No public API surface
**Current:** `@blend65/compiler` exports only the ACME process layer.
**Required:** `compile`/`build`/`emitAsm`/`emitIl` + options/result types (R1–R11).
**Fix:** new `api/` module (03-02).

### Gap 2: No `CompilerHost` anywhere
**Current:** zero hits for `CompilerHost` outside a lexer doc comment.
**Required:** interface in core (R14), disk implementation + discovery in compiler (R12/R13/R47).
**Fix:** new `core/src/host/` + `compiler/src/host/` (03-01).

### Gap 3: CLI is a stub
**Current:** `cli/src/index.ts` is one line; no bin, no parser.
**Required:** full `blendc` (R15–R50).
**Fix:** 03-03.

### Gap 4: `BuildResult` name collision (PF-002)
**Current:** `compiler/src/acme/emit-binary.ts:47` exports `BuildResult`.
**Required:** RD-15's public `BuildResult` owns the name; internal aggregate renamed
`EmitBinaryResult`, `symbols` mapped to `symbolMap` in the facade.

### Gap 5: E10034 not wired on the build path
**Current:** `emitBinary` checks only when the caller passes `maxBinarySize`; nothing
passes it in production. `checkBinaryBudget` (core) is unused.
**Required:** AR-V5 — facade builds the report, threads `acme.binarySize`, calls
`checkBinaryBudget(report, bag)`.

### Known limitation (accepted, not a gap)

`modelToFunctionInfo` returns `[]` (RD-05's documented deferral to RD-04b —
`frontend/src/sfa/model-adapter.ts:20-27`). Consequence: `AllocationPlan.frames` is
empty; `lowerToIL` tolerates this (`codegen/src/il/lower.ts:154` optional-chains), the
MVP gate program (no params/locals) compiles correctly, and SFA numbers in the build
summary render as zeros per AR-102. Documented in the register's Pre-resolved context.

## Dependencies

### Internal
- All of: core (diagnostics/report/intrinsics/platform/sfa types), frontend, codegen,
  platforms, config — already declared in `compiler/package.json`.
- cli depends on compiler + config (already declared) + core? — **No**: cli imports
  renderers from `@blend65/core`; core must be added to `cli/package.json` dependencies.
  (Verified absent: current deps are compiler + config only.)

### External (new)
- `yargs@^17` + `@types/yargs` (dev) — cli (AR-V1)
- `tinyglobby` — compiler (AR-V3)

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Ubuntu's ACME version differs from dev's (golden .prg drift in CI E2E) | Med | Low | ST-40 asserts structural facts (file exists, non-empty, load address), not byte-golden |
| yargs typing friction under `exactOptionalPropertyTypes` | Med | Med | Isolate all yargs interaction in `args.ts`; map to a clean `ParsedArgs` type at the boundary |
| Two E10034 emitters drift (emitBinary inline vs checkBinaryBudget) | Low | Low | Cross-referencing comments both sites (AR-V5 obligation) |
| tinyglobby semantics differ from expectation (dotfiles, symlinks) | Low | Med | ST-3/ST-4 pin the contract; containment filter is ours regardless |
| `process.stdout.isTTY` undefined in tests | High | Low | `runCli` receives `io` with explicit `isTTY` (AR-V13/V16 seam) |
