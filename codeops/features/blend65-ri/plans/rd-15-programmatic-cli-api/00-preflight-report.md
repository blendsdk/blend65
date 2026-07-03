# Preflight Report: RD-15 — Programmatic & CLI API (implementation plan)

> **Status**: ✅ PASSED — all 13 findings resolved (0 critical, 3 major, 7 minor, 3 observation); fixes applied to the plan documents 2026-07-03
> **Iteration**: 1 (first scan) — resolved & applied; no regressions found on the iteration-2 coherence pass (see bottom)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-15-programmatic-cli-api/`
> **Codebase Grounded**: 40+ source files examined across all 6 compile-path packages, tooling & CI; ~60 document references verified against code
> **Last Updated**: 2026-07-03
> **CodeOps Skills Version**: 3.1.0

## Decision Log (2026-07-03 — user accepted the recommendation on every finding)

| Finding | Decision | Applied to |
|---|---|---|
| PF-001 🟠 | **Option A** — wire the codegen `assembleProgram` override seam + derive `outName` once in `runFrontend` + `toShimVariant` mapping (RD-16 R18) + ST-41/42 | 03-02, 07, 99 (2.2.3/2.3.1), 00-index |
| PF-002 🟠 | **Option A** — add `cwd?: string` routing field to `CompilerOptions` (AR-V20) | 03-02, 03-03, register, 99 (1.1.1/2.2.1/2.2.3/3.3.1) |
| PF-003 🟠 | **Decision 1 = Option A** (`isIceCode` band) + **Decision 2 = Option A** (`E10035`→exit 1) (AR-V21) | 03-03, 07 (ST-43), register, 99 (1.1.1/3.3.1) |
| PF-004 🟡 | Relocate ST-40 → `cli/src/build-e2e.spec.test.ts` | 07, 99 (4.1.4) |
| PF-005 🟡 | Widen `cli/vitest.config.ts` include to `{spec,impl}` | 07, 99 (3.1.1) |
| PF-006 🟡 | Use tinyglobby's current `globSync(patterns, options)` API | 03-01, 99 (1.2.4) |
| PF-007 🟡 | `GATE_SRC` = verbatim `examples/gate/main.blend`; ST-15 → `Main.main` | 07 |
| PF-008 🟡 | Accept header-only config diagnostics for v1 + runtime AR-V22 (AR-P2 follow-up) | 03-03, register, 99 (1.1.1) |
| PF-009 🟡 | Pin yargs parse-callback `(err, argv, output)` routing through `CliIo` | 03-03, 99 (3.2.2) |
| PF-010 🟡 | Auto-resolved by PF-001's one-place `outName`; results expose the effective name | 03-02, 03-03, 99 (2.2.2) |
| PF-011 🔵 | `sudo apt-get update && … install -y acme` | 99 (4.1.3) |
| PF-012 🔵 | Noted (AR-V15 rationale aspirational) — no doc change required | — |
| PF-013 🔵 | Update CLAUDE.md package-edge table when cli gains `core` | 99 (4.2.4) |

Task count unchanged (50) — every fix enriched an existing task rather than adding one.

> ⚠️ **SAME-DAY REVIEW**: this plan was authored 2026-07-03 by the same model
> (in a prior session; context was cleared before this review). Same-agent bias
> risk is elevated. Mitigations applied: every `file:line` claim re-verified
> against the actual code by independent reconnaissance agents; one independent
> challenger (blind to the reviewer's picks) stress-tested all high-stakes
> findings before recording.
>
> ⚠️ **Numbering disambiguation**: `PF-NNN` below are **plan-preflight**
> findings. The plan text also cites `PF-002`/`PF-005`/`PF-009` etc. from the
> earlier **requirements**-preflight of RD-15 — those are a different series
> (see `requirements/` report). Cross-references here always say which series.
>
> **Unverifiable-offline note**: AR-V1's registry evidence ("yargs@18 ships no
> root-export types; no `@types/yargs@18` exists") could not be re-verified in
> this offline review; it is register-recorded challenger evidence and is
> respected, not re-litigated.

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM NodeNext, ES2023, strict), Yarn v1 workspaces + Turborepo, Vitest, ESLint v9 flat config, Node 22.
**Architecture:** 10-package monorepo; pipeline stages (lex → parse → analyze → SFA → IL → Instr → serialize → ACME) all shipped and hand-wired end-to-end in `compiler/src/t4-pipeline.spec.test.ts`. No facade, no `CompilerHost`, CLI is a `VERSION` stub — exactly as the plan's 02-current-state records.
**Key Files Examined:** `core/src/diagnostics/{diagnostic-codes,diagnostic-bag,source-map,severity-policy,render-terminal,render-json,ansi}.ts`, `core/src/report/*`, `core/src/intrinsics/registry.ts`, `core/src/platform/platform-plugin.ts`, `compiler/src/acme/{emit-binary,invoke-acme,discover-acme}.ts`, `compiler/src/{index,t4-pipeline.spec.test,runtime-asm.spec.test}.ts`, `frontend/src/semantics/analyze.ts`, `frontend/src/sfa/{plan-allocation,model-adapter}.ts`, `codegen/src/il/{index,lower}.ts`, `codegen/src/instr/{index,instr-program,serialize-acme,peephole,print-instr}.ts`, `codegen/src/runtime/embed.ts`, `platforms/src/registry.ts`, `config/src/{load-config,types,defaults,validate,discovery,index}.ts`, `packages/cli/*`, `eslint.config.js`, `.github/workflows/ci.yml`, `test/boundary.spec.test.ts`, root + per-package `vitest.config.ts`, `node_modules/tinyglobby/dist/index.d.mts`, `examples/gate/main.blend`, source RD `requirements/RD-15-programmatic-cli-api.md`.

**Reference Verification:** ~60 references mapped — the overwhelming majority VERIFIED exactly (all integration-table entries in 02-current-state: `loadConfig` shape incl. sync + `cwd`/`sourceId` options, `emitBinary`/`EmitDeps`/inline E10034 at the cited lines, `BuildResult` at `emit-binary.ts:47`, `checkBinaryBudget` JSDoc "RD-15 calls this after `emitBinary`", `buildResourceReport` input field names, severity-policy suppression-wins + W-code preservation, `renderTerminal`/`renderJson` names & signatures, null-span R51 degradation, `SourceMap.has/intern` (ids start at 0), platform registry & `loadPlatform` throw, `PlanInput` fields, `LowerInput.program` being an **array** (multi-file lowering safe), `modelToFunctionInfo` deferral, skipIf-ACME precedent, config band E10240–E10246 + W10240/41, `CONFIG_DEFAULTS`, clean no-print scan, no bin/shebang precedent, cli deps gap for `@blend65/core`). Mismatches found are the findings below.

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 (PF-012) | 🔵 |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 4 (PF-002, PF-008, PF-010, PF-013) | 🟠 |
| 5 | Dependency Issues | 1 (PF-004) | 🟡 |
| 6 | Feasibility Concerns | 2 (PF-009, PF-011) | 🟡 |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 (PF-007) | 🟡 |
| 13 | Codebase Alignment | 4 (PF-001, PF-003, PF-005, PF-006) | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 3 | ✅ all resolved (recommendation accepted) |
| MINOR | 7 | ✅ all resolved (recommendation accepted) |
| OBSERVATION | 3 | ✅ all resolved/noted |

---

## 🟠 MAJOR

### PF-001: `--startup` is behaviorally inert and the emitted `.asm`'s `!to` name is always `main` — the codegen seam the code itself promised to RD-15 is missing from the plan 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Impact Blindness)
**Location:** `03-02-compiler-facade.md` §`api/emit.ts`/`api/build.ts` (bare `assembleProgram(il, plugin, bag)` call); `99-execution-plan.md` (no codegen task in any of the 50 tasks)
**Codebase Evidence:** `codegen/src/instr/instr-program.ts:157` — `projectName: "main", // FR-3: the RD-15 driver overrides this; no live driver yet.` and `:158` `shimVariant: "terminating"`; `assembleProgram(ilProgram, plugin, bag)` (`instr-program.ts:117-120`) exposes **no override parameter**. Nothing anywhere consumes `config.startup`. `ShimVariant` is `"terminating" | "non-terminating" | "bare"` (`core/src/platform/platform-plugin.ts:27`); the binary/artifact *paths* stay correct only because `invokeAcme` passes `-o` (`invoke-acme.ts:93-94`) and `emitBinary` names files from its `projectName` param.
**The Problem:** The plan wires `--out-name` and `--startup` into the resolved config and stops. Consequences: (1) with `--out-name game`, the emitted `game.asm` **contains `!to "main.prg"`** — an internally inconsistent artifact that breaks R22's manual-assembly/golden use case and shadows ST-16/ST-37 content expectations; (2) `--startup <variant>` (R46) and `config.startup` are consumed by **nothing**, yet task 4.2.2 ticks AC-20 which explicitly names `--startup`. The `FR-3` comment is direct evidence the shipped code expected RD-15 to thread these — the plan misses the seam entirely.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Additive seam: `assembleProgram(il, plugin, bag, overrides?: Partial<Pick<PreambleOptions,"projectName"\|"shimVariant">>)` merged over `derivePreambleOptions`; hoist the R21 `outName` derivation into `runFrontend` (shared by `emitAsm`/`build`/CLI — also resolves PF-010); facade maps `startup`: `terminating→terminating`, `minimal→non-terminating`, `bare→bare`, `auto→undefined` (Half-A default; the AR-69 CFG-analysis deferral). Add STs: `--out-name game` ⇒ asm contains `!to "game.prg"`; `startup:'bare'` ⇒ no shim | Honors the recorded FR-3 seam contract; non-breaking for RD-08/09 consumers; all platforms already implement all three shim variants (`platforms/src/shared-hooks.ts`); makes AC-20's startup tick honest | One small codegen file joins the change set (plan claimed codegen untouched); +2 ST cases |
| B | v1-defer: accept inert `--startup` + stale `!to`; record a runtime AR; amend R46/AC-20 wording | Zero codegen change | Contradicts the FR-3 comment's recorded intent; requires a requirements amendment to avoid a dishonest AC-20 tick; `.asm` artifact stays inconsistent for ~20 lines of saving |

Considered and dropped: facade calling `generateInstr` + `plugin.emitPreamble` directly — duplicates the Half-A derivation logic across packages, violating R2 thin-wiring.

**Recommendation:** Option A — the seam is additive, cheap, was explicitly promised to RD-15 by the shipped code, and note the `minimal→non-terminating` mapping is already pinned by RD-16 R18 (no new design decision needed).
**Confidence:** High. **Hardening:** independent challenger converged on A, corrected the reviewer's "mapping undecided" overstatement, and supplied the outName-hoisting refinement.

**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-002: `CompilerOptions` has no `cwd` — `CliIo.cwd` is a dead seam and the temp-dir CLI spec tests are unimplementable as specified 🟠 MAJOR

**Dimension:** 4 — Completeness Gaps (codebase-grounded)
**Location:** `03-02-compiler-facade.md` §`api/options.ts` + `runFrontend` step 1; `03-03-cli.md` `CliIo.cwd` ("→ process.cwd() (config discovery)"); `07-testing-strategy.md` ST-6, ST-22..ST-38 ("project fixture in a temp dir")
**Codebase Evidence:** `config/src/load-config.ts:80` — `const cwd = resolve(options.cwd ?? process.cwd())`; `LoadConfigOptions.cwd?` exists (`config/src/types.ts`); `projectRoot` falls back to this cwd when no config file is found (`load-config.ts:144`).
**The Problem:** The plan's `loadConfig` call passes no `cwd`, and `CompilerOptions` (per RD §4.1 and 03-02) has no field to carry it — so `CliIo.cwd` is documented but consumed by nothing (dead code by the repo's own standard). Under vitest, discovery and `projectRoot` bind to the test process cwd (`packages/cli`), not the fixture: ST-6's expected `project root: '<temp root>'` message is wrong, ST-38's config-discovery scenario can't find the fixture's `blend65.json`, ST-37's relative `custom/` out-dir lands inside the package tree. The RD-14 LSP faces the same gap (`configPath` doesn't cover walk-up discovery).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `cwd?: string` to `CompilerOptions` (a **routing** option like `configPath`, not a config override; default `process.cwd()`): `runFrontend` passes it to `loadConfig`; tier-1 `sourceFiles` and CLI-side relative writes resolve against it; CLI maps `io.cwd` → `options.cwd`. Additive RD §4.1 amendment back-propagated via the existing task-1.1.1 pattern | Fixes tests, `projectRoot` correctness, and the LSP embedding case in one field; the config package already supports it | Small RD amendment (runtime AR) |
| B | Delete `CliIo.cwd`; tests use `process.chdir()` (vitest forks pool allows it) and/or explicit `--config` + absolute paths | No API change | Fragile coupling to vitest pool config (chdir throws under threads); doesn't fix ST-6's projectRoot message or relative outDir; leaves the RD-14 discovery gap |

**Recommendation:** Option A — one additive field, already supported downstream at `load-config.ts:80`, resolves the test strategy, the dead seam, and the LSP case together.
**Confidence:** High. **Hardening:** challenger converged; corrected an overclaim ("impossible to test" → "unimplementable as specified without fragile workarounds") and added the relative-outDir/ST-6 failure specifics.

**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-003: Exit-3 classification rests on a false premise — there is no ACME-specific ICE code, ACME-not-found is E10035 (normal band), and E90001 is emitted by 6+ non-ACME sites 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption)
**Location:** `03-03-cli.md` §Exit-code classification ("The ICE code is the one `invokeAcme`/`discoverAcme` emit … it is in the E9xxx ICE band")
**Codebase Evidence:** `discover-acme.ts:85` emits `DiagCode.AcmeNotFound = "E10035"` via `addError` (normal band — `core/src/diagnostics/diagnostic-codes.ts:45`); only `invoke-acme.ts:122-128` emits `IceCode.Unexpected = "E90001"` — the **sole** ICE constant, and a generic one already emitted by `frontend/src/semantics/intrinsic-validation.ts:123`, `codegen/src/il/lower.ts:528`, `codegen/src/instr/register-binding.ts:147/173/211`, `translate.ts:843`, `validate.ts:68`, `peephole.ts:99+`. `isIceCode()` (band test `/^E9\d{4}/`) ships at `diagnostic-codes.ts:225`.
**The Problem:** Both halves of the plan's sentence are wrong: `discoverAcme` does not emit an ICE code, and keying exit 3 on "the ACME ICE code" (E90001) classifies **any** frontend/codegen ICE as an ACME error today. The plan also leaves undecided what `blendc build` exits with when ACME is not installed (E10035): 1, 2, or 3 are each arguable — an unratified decision on the CLI's public contract, with no ST covering the path (ST-26 covers invoke failure only).

**Options (two decisions):**

*Decision 1 — what triggers exit 3:*

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Band test: any diagnostic with `isIceCode(code)` → exit 3; clarify R44/R50 wording ("exit 3 = internal compiler error; ACME failure is the canonical instance") via the runtime-ambiguity protocol | Matches R44's own rationale ("internal compiler error, AR-68"); zero shipped-code change; robust as ICEs appear; uses the shipped helper | Broadens R44's literal "ACME errors" — needs the one-line wording clarification |
| B | Mint `IceCode.AcmeAssemblerFailed = "E90002"` in core, emit from `invokeAcme`, key exit 3 strictly on it | Keeps exit 3 ACME-only per AC-16's literal text | Touches shipped RD-09 code + its immutable spec test (`invoke-acme.spec.test.ts:69` asserts `IceCode.Unexpected` — amendment needs approval); genuine compiler bugs then exit 1, mislabeled as user errors |

*Decision 2 — `E10035` (ACME not found) exit class:*

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Exit **1** (R50-literal: it's an ordinary error diagnostic, deliberately user-actionable per RD-09) | No requirements change; matches R50 exactly as written | CI scripts can't distinguish "code broken" from "toolchain missing" |
| B | Exit **2** (amend R50: environment/configuration class — `acmePath` *is* a config key, R30) | Semantically cleaner for automation | Requires an R50 amendment (runtime AR) |

Either way: correct the 03-03 text and add an ST for the ACME-not-found path.

**Recommendation:** Decision 1 → Option A (band test); Decision 2 → Option A (exit 1, R50-literal), with B as a defensible alternative if the user prefers environment-vs-code separation.
**Confidence:** High on Decision 1; Medium on Decision 2 (genuinely user-preference). **Hardening:** challenger converged on the band test, strengthened the evidence (6+ non-ACME E90001 emitters), and correctly pushed E10035 from the reviewer's initial "exit 2" lean to a surfaced user decision.

**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

---

## 🟡 MINOR

### PF-004: ST-40 is placed in `compiler` but its scenario calls `runCli` — a compiler → cli dependency cycle 🟡 MINOR

**Dimension:** 5 — Dependency Issues
**Location:** `07-testing-strategy.md` ST-40 + file table (`compiler/src/api/build-e2e.spec.test.ts`); `99-execution-plan.md` task 4.1.4
**Codebase Evidence:** `runCli` will live in `@blend65/cli`, which depends on `@blend65/compiler` (`packages/cli/package.json`); the reverse import cannot resolve.
**The Problem:** As written the task is unimplementable — though it fails fast at first typecheck, hence MINOR (challenger-recalibrated from MAJOR).
**Recommendation (single viable path):** relocate ST-40 to `cli/src/build-e2e.spec.test.ts`, keep the `runCli` scenario (AC-07 is "**blendc** build produces a `.prg`" — CLI-level is the right altitude; `discoverAcme` for the skipIf guard imports from compiler, which cli already depends on). Update 07's file table + task 4.1.4. Considered and dropped: rewriting ST-40 against facade `build()` — loses the AC-07 wording; fake-deps STs already transit the facade.
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-005: cli's vitest config only includes `*.spec.test.ts` — the plan's cli impl tests would silently never run 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Test Impact)
**Location:** `99-execution-plan.md` tasks 3.4.1/3.4.2 (`cli/src/args.impl.test.ts`, `cli/src/render.impl.test.ts`)
**Codebase Evidence:** `packages/cli/vitest.config.ts` — `include: ["src/**/*.spec.test.ts"]`; compiler and core already use `src/**/*.{spec,impl}.test.ts`.
**The Problem:** Both cli impl-test files would be dead weight — never executed, no failure signal.
**Recommendation (single viable path):** extend cli's include to `src/**/*.{spec,impl}.test.ts`; fold into task 3.1.1 (package setup) or 3.4.1. No alternatives worth presenting.
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-006: The plan's normative `globSync({patterns, ignore, cwd, absolute})` call uses tinyglobby's deprecated overload 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Dependency Reality)
**Location:** `03-01-compiler-host.md` §`listSourceFiles()` normative step 1
**Codebase Evidence:** `node_modules/tinyglobby@0.2.17/dist/index.d.mts:142` — current API is `globSync(patterns, options)`; the single-object form is a deprecated overload (`:143-146`).
**Recommendation (single viable path):** change the normative call to `globSync(include, { ignore: exclude, cwd: projectRoot, absolute: true })` and pin `tinyglobby@^0.2` in task 1.1.2.
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-007: `GATE_SRC` claims to mirror `examples/gate/main.blend` but differs (module casing, poke args) — and ST-15's expected FQ name follows the wrong variant 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `07-testing-strategy.md` §Shared fixtures + ST-15
**Codebase Evidence:** `examples/gate/main.blend:1-4` — `module Main;` … `poke(0xD020, 5)`; the plan sketch says `module main; … poke(53280, 0)`; ST-15 expects IL header for `main.main` (would be `Main.main`).
**Recommendation (single viable path):** define `GATE_SRC` as the verbatim example content (single source of truth) and fix ST-15's expected header to `Main.main`.
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-008: `blend65.json` diagnostics will render header-only (no `--> blend65.json:line:col`) despite RD-16's shipped span support 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-03-cli.md` §Error Handling ("sentinel/null spans degrade per R51")
**Codebase Evidence:** config diagnostics carry real spans under `CONFIG_SOURCE_ID = -2` (`config/src/types.ts:18`); `SourceMap.has()` requires id ≥ 0 (`core/src/diagnostics/source-map.ts:110`) → `renderTerminal` degrades (`render-terminal.ts:161`). The AR-P2 seam (`LoadConfigOptions.sourceId`, `validate.ts:47`) anticipated RD-15 supplying a real interned id, but `findConfigUpwards` is not exported (`config/src/index.ts:8-10`) and `LoadConfigResult` doesn't return the config text — the facade cannot intern first.
**The Problem:** A conscious-looking degradation in the plan that no register entry actually decided; config-file errors lose their caret/line context.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Accept degraded rendering for v1; record a runtime AR noting the AR-P2 seam as the follow-up | Zero scope change; RD-16 surface untouched (in-scope per the register's OUT list) | Config-error UX loses line/col until a later RD |
| B | Partial: when `configPath` is explicit, pre-read + intern + pass a real `sourceId` | Carets for the explicit-path case | Discovery case still degraded; asymmetric behavior |

Considered and dropped: exporting discovery / returning text from `loadConfig` — a `@blend65/config` API change, explicitly out of scope ("any blend65.json schema change — RD-16 shipped").

**Recommendation:** Option A — record the deferral honestly; B's asymmetry isn't worth it.
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-009: yargs help/version/`.fail()` output routing through `CliIo` is undesigned — with a naive `parseSync()`, ST-35 cannot pass 🟡 MINOR

**Dimension:** 6 — Feasibility Concerns
**Location:** `03-03-cli.md` §Argument Parsing; `07-testing-strategy.md` ST-35
**Codebase Evidence:** N/A (library behavior): with `.exitProcess(false)`, yargs prints help/version via its own console binding, not through the plan's `io.writeOut` — ST-35 asserts fakeIo-captured stdout contains `VERSION`.
**Recommendation (single viable path):** pin the mechanism in 03-03: `args.ts` uses the parse-callback form (`(err, argv, output)`) and `main.ts` writes `output` through `CliIo` (stdout for help/version, stderr for `.fail()`). This is yargs' documented seam for exactly this case.
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-010: The CLI-side `outName` re-derivation for `--emit-asm`/`--emit-il` has no data source — the result exposes no discovered-file list 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-03-cli.md` §Dispatch ("for `emitAsm`/`emitIl` … the CLI re-derives: config value, else basename of the first sorted discovered file")
**Codebase Evidence:** `EmitResult` (plan `api/results.ts`) carries `config` + `sourceMap` + `text` — no file list; `result.config.outName` remains `""` in the auto case.
**Recommendation:** resolved by PF-001 Option A's outName hoisting — `runFrontend` derives the name once and the facade exposes it (e.g. the returned `config.outName` carries the derived effective value, documented under R51 "effective settings"). If PF-001 goes Option B, this needs its own fix (expose the derived name on results).
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

---

## 🔵 OBSERVATION

### PF-011: CI task should run `apt-get update` before `apt-get install -y acme` 🔵 OBSERVATION

**Dimension:** 6 — Feasibility. **Location:** task 4.1.3. ubuntu-latest package lists are routinely stale; also note there is no existing `sudo` precedent in `.github/` (verified) — fine on GitHub runners, just new. Suggested step: `sudo apt-get update && sudo apt-get install -y acme`.
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-012: AR-V15's justification overstates — `VERSION` consts have no manifest-sync mechanism 🔵 OBSERVATION

**Dimension:** 2 — Implicit Assumptions. **Codebase Evidence:** per-package spec tests assert a hardcoded literal (`packages/cli/src/index.spec.test.ts:6` — `expect(VERSION).toBe("0.1.0")`); nothing reads `package.json.version`. The AR-V15 *decision* (explicit `.version(VERSION)`) still stands; only its "synced to its manifest" rationale is aspirational. Optional: add a manifest-sync impl test in cli.
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

### PF-013: cli gaining a `@blend65/core` dependency staleness — CLAUDE.md/RD-01 package-edge tables not in the change set 🔵 OBSERVATION

**Dimension:** 4 — Completeness Gaps. **Codebase Evidence:** CLAUDE.md's package table row reads `@blend65/cli | compiler, config`; task 3.1.1 adds core (correctly — verified absent today), but only task 4.2.4's "CLAUDE.md status paragraph" touches docs. Suggested: fold the dep-table row update into 4.2.4.
**User Decision:** ✅ Resolved — user accepted the recommendation (2026-07-03); fix applied to the plan per the Decision Log above.

---

## Adversarial-question checklist (same-agent safeguard)

- *Assumption unconsciously confirmed?* The plan's integration table was authored from the same codebase reading this review repeats — mitigated by delegating verification to independent agents with claim-lists rather than the plan text's framing; three mismatches surfaced anyway (PF-001/003/006 evidence).
- *External standard risk?* yargs behavior (PF-009) is cited from library-documented behavior, not verified against a live install (yargs is absent from node_modules) — flagged inside the finding.
- *What would a disagreeing expert flag?* The E10035 exit-class call (PF-003 Decision 2) is genuinely contestable — surfaced as a user decision rather than settled.

---

## Iteration 2 — fix verification & regression pass (2026-07-03)

All 13 resolutions were applied to the plan documents and re-scanned for coherence
and regressions. **No new findings** (numbering would have continued at PF-014).

**Fix verification (each resolved finding actually applied):**

| Finding | Verified in | Check |
|---|---|---|
| PF-001 | 03-02 (`FrontendRun.outName`, `assembleProgram` override note, `toShimVariant`), 07 (ST-41/42), 99 (2.2.3/2.3.1), 00-index Modified list (`codegen/src/instr/instr-program.ts`) | seam + one-place derivation + mapping all present and consistent |
| PF-002 | 03-02 (`cwd?` field + `loadConfig` call + tier-1 resolution), 03-03 (`io.cwd`→`options.cwd`; `CliIo.cwd` now consumed), register V20, 99 (1.1.1/2.2.1/2.2.3/3.3.1) | dead seam eliminated; discovery base threaded |
| PF-003 | 03-03 (exit block rewritten to `isIceCode` band + E10035→1), 07 (ST-43), register V21, 99 (1.1.1/3.3.1) | false premise removed; band test + exit-1 consistent across doc & test |
| PF-004 | 07 file table + ST-40 row (`cli/src/build-e2e.spec.test.ts`), 99 (4.1.4) | cycle removed |
| PF-005 | 07 note, 99 (3.1.1) | vitest include widened |
| PF-006 | 03-01 normative step, 99 (1.2.4) | current globSync API |
| PF-007 | 07 GATE_SRC + ST-15 (`Main.main`) | verbatim example |
| PF-008 | 03-03 error-handling row, register V22, 99 (1.1.1) | deferral logged |
| PF-009 | 03-03 parse-callback note, 99 (3.2.2) | output routing pinned |
| PF-010 | 03-02 (effective `config.outName`), 03-03 (no re-derive) | single source |
| PF-011 | 99 (4.1.3) | `apt-get update &&` added |
| PF-013 | 99 (4.2.4) | CLAUDE.md edge-table update wired |

**Regression check:** no fix contradicts another. Cross-cutting couplings verified by
grep: `run.outName` consumed by emitAsm/build/CLI with no competing derivation; `cwd`
present on the field list, the `loadConfig` call, tier-1 resolution, and the CLI map;
exit-3 `isIceCode` wording identical in 03-03 and ST-43; register item count (22) matches
the header. Task count held at 50 (fixes enriched existing tasks). `spec/` untouched (D3).

**Residual follow-ups (tracked, not blocking — become execution work):**
- The three RD-amending ARs (V20 `cwd` on §4.1; V21 R44/R50 wording; V22 caret deferral)
  are back-propagated by task 1.1.1 at execution start — not yet written into
  `requirements/RD-15-*.md` (consistent with how AR-V2's amendment is a Phase-1 task).
- Config-diagnostic carets remain header-only until the AR-P2 seam (PF-008/V22) — a
  post-RD-15 improvement, not a defect.

## Outcome

**✅ PREFLIGHT PASSED — all 13 findings resolved** (3 major, 7 minor, 3 observation;
every one via the accepted recommendation), fixes applied, iteration-2 coherence pass
clean. The plan is ready for `exec_plan`. Roadmap advanced to **Plan Preflighted (🔬)**.
