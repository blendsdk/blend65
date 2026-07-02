# Current State: RD-17 — Intrinsic Functions & Runtime-Routine ABI

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Grounded by the 2026-07-02 preflight reconnaissance (~25 source files examined;
see `../../requirements/00-preflight-report.md` Codebase Context Summary).

## Existing Implementation

### What Exists (seams already placed)

- **Reserved-name set (syntactic gate only)** — `packages/core/src/ast/reserved-builtins.ts:18-43`: `RESERVED_BUILTINS` with exactly 22 names (13 CPU-control + 9 memory). Size-locked by `reserved-builtins.impl.test.ts:34`. No `asm_wai`.
- **Parser support** — `packages/frontend/src/parser/pratt.ts:330-433` produces `IntrinsicCallExprNode` (`core/src/ast/nodes.ts:390-397`) with `typeArg`/`fieldArg` for `sizeof`/`offsetof`. `parseImport()` exists (`parser.ts:194`) → `ImportStmtNode`.
- **Passthrough analyzer** — `packages/frontend/src/semantics/analyze.ts`: extensible `AnalyzeInput { programs, bag, profile }`; four no-op pass seams in `passes.ts:32-76` with intrinsic validation listed `DEFERRED(RD-04-checker)`.
- **IL `intrinsic` op + placeholder descriptor** — `packages/codegen/src/il/instruction.ts:53,135-141`; placeholder `{name, tier?: number, clobbers?}` in `il/intrinsic-descriptor.ts:23-30` (header: authoritative type "owned by RD-17").
- **Partial T2 lowering** — `codegen/src/il/lower.ts:270-300`: `poke`→`store`, `peek`→`load`, literal addresses only (`addressLocation` ICEs otherwise); every other intrinsic name ICEs.
- **T3 call sites already emitted** — `codegen/src/instr/translate.ts:539-624`: three-tier mul (fold / shift / `JSR __rt_mul8|__rt_mul16` + W10170/W10172); div AND mod → `JSR __rt_div8|__rt_div16` (+W10171); `emitRuntimeCall` marshals ONLY `left`→A (`void right` at :621 — explicitly the RD-17/AR-33 gap).
- **Plugin fields waiting** — `core/src/platform/platform-plugin.ts:81-99`: `intrinsics: readonly IntrinsicDescriptor[]` where `IntrinsicDescriptor = unknown` (DEFERRED RD-17); `RuntimeModule {name, asmPath, exports}` with a dead-strip comment. All 5 plugins ship `intrinsics: []` and stub `runtimeModules` for mul8/mul16/div8/div16 (`platforms/src/c64.ts:82-88`, spec-locked by `c64.spec.test.ts:157-163`).
- **Profiles** — canonical `PlatformProfile.zpArgBlockSize` (`core/src/platform/platform-profile.ts:89`; all 5 = 8) + `cpu: CpuVariant` (`"nmos6502" | "wdc65c02"`); interim frontend profile has `zpArgBlockMin` default **0** (`core/src/semantics/platform-profile.ts:49,68-84`).
- **Diagnostics** — one registry (`core/src/diagnostics/diagnostic-codes.ts`): intrinsic band E10040-E10042 occupied; `NameShadows: E10101`; E10212 deliberately absent (comment retired by this plan). `DiagnosticBag.addError/addICE`.
- **Serializer** — `codegen/src/instr/serialize-acme.ts:78-120` renders the single `.asm` (hoisted `!to`, symbol defs, preamble, code streams, const data). `AcmeDirective` union (`core/src/instr-model/stream.ts:37-46`) has no include kind — and needs none under AR-100 textual embedding.
- **Semantic type machinery** — `core/src/semantics/type.ts` (`StructType` with `fields`/`offset`/`byteSize`), tested `type-utils` — the raw material for AR-P13 folding.
- **ACME process layer (RD-09)** — `compiler/src/acme/*` + `assemble.golden.spec.test.ts` — the pattern AC-19's end-to-end test extends.

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `core/src/intrinsics/` (new) | Descriptor, registry, catalog | Create (AR-P8) |
| `core/src/diagnostics/diagnostic-codes.ts` | Diag registry | +E10043/44/45; retire E10212 comment |
| `core/src/ast/reserved-builtins.ts` | Reserved names | +`asm_wai` (22→23) |
| `core/src/instr-model/opcode.ts` | Opcode sets | +`WAI` to `W65C02_OPCODES` |
| `core/src/platform/platform-plugin.ts` | Plugin contract | `IntrinsicDescriptor = unknown` → real type |
| `core/src/platform/validate-profile.ts` | Profile checks | +`zpArgBlockSize >= 4` floor |
| `core/src/semantics/platform-profile.ts` | Interim profile | `zpArgBlockMin` default 0→4 (AR-P10) |
| `frontend/src/semantics/analyze.ts`, `passes.ts` | Analyzer | +optional `registry`; wire validation pass |
| `frontend/src/semantics/intrinsic-validation.ts` (new) | The pass | Create |
| `codegen/src/il/intrinsic-descriptor.ts` | Placeholder | Re-export core type; migrate `tier` |
| `codegen/src/il/lower.ts` | IL lowering | Descriptor-driven dispatch; folds; E10045 |
| `codegen/src/instr/translate.ts` | Instr emission | T1 opcodes; T2 inline; marshalling rewrite |
| `codegen/runtime/*.asm` (new) | T3 bodies | Create ×4 |
| `codegen/src/runtime/embed.ts` (new) | Embedding + dead-strip | Create |
| `codegen/src/instr/serialize-acme.ts` | Serializer | Append embedded runtime section |
| `platforms/src/*.ts` (×5) | Plugins | `runtimeModules` migration; fixture in tests |

## Gaps Identified

### Gap 1: No registry, no validation
**Current:** zero semantic checks; unknown intrinsics ICE deep in codegen.
**Required:** registry-driven validation before lowering (AC-02..06, AC-15, AC-17).
**Fix:** 03-01 + 03-02.

### Gap 2: Unresolved runtime symbols
**Current:** `JSR __rt_div16` etc. emitted with no bodies anywhere; assembling any `*`/`/`/`%` program would fail.
**Required:** AC-19.
**Fix:** 03-04 (bodies + embedding).

### Gap 3: Marshalling stub
**Current:** only `left`→A; `right` ignored (`translate.ts:621`).
**Required:** AR-33/AR-98/AR-P7 full marshalling.
**Fix:** 03-04.

### Gap 4: T2 coverage
**Current:** `peekw/pokew/lo/hi/sizeof/offsetof/length` + all T1 names ICE.
**Required:** AC-07/08/09.
**Fix:** 03-03 (+ AR-P13 decl collection in 03-02).

## Dependencies

### Internal
- RD-04 (passthrough seams), RD-05 (SFA slots for marshalling), RD-06 (IL ops), RD-07b/c (translate/assemble), RD-09 (serializer + ACME layer), RD-10 (plugin contract) — all ✅ complete.

### External
- ACME binary for the AC-19 golden test — follows RD-09's existing discover/skip pattern; no new external dependency.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AR-P13 decl-collection deeper than expected (creeps toward RD-04b) | Med | Med | Strict scope: only what folding needs; STOP + new AR-PN if it grows |
| Hand-written 6502 division/multiply bugs ship unverified math (AC-14 deferred) | Med | Med | Reference algorithms; ABI comment blocks; RD-12 verifies functionally (AR-P4) |
| Marshalling interacts with live register binding (`register-binding.ts`) in unforeseen ways | Low | Med | Spec tests on generated Instr sequences before touching translate.ts |
| `RESERVED_BUILTINS` growth breaks size-locked tests unexpectedly elsewhere | Low | Low | Update the locked tests deliberately in the same phase |
| Embedding breaks the RD-09 golden serializer tests | Low | Med | Embedding appends a discrete section; existing goldens unchanged unless a runtime routine is referenced |
