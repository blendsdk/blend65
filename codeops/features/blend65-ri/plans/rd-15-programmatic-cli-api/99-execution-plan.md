# Execution Plan: RD-15 — Programmatic & CLI API

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-03
> **Progress**: 50/50 tasks (100%) — ✅ RD-15 COMPLETE (all 4 phases; full workspace verify + CI green)
> **CodeOps Skills Version**: 3.1.0

## Overview

Four phases: (1) foundations — `CompilerHost` + `DiskCompilerHost` + driver codes +
PF-002 rename; (2) the programmatic facade — `compile`/`emitIl`/`emitAsm`/`build`;
(3) the `blendc` CLI; (4) hardening & closeout — AC-18 enforcement, CI ACME, real E2E,
acceptance bookkeeping. Specification-first ordering inside every phase.

**🚨 Update this document after EACH completed task!**

> **Preflight fixes folded in (2026-07-03, iteration 1 → all 13 findings resolved):**
> PF-001 codegen `assembleProgram` override seam + one-place `outName` derivation
> (2.2.3/2.3.1, ST-41/42); PF-002 `cwd` on `CompilerOptions` (1.1.1/2.2.1/2.2.3/3.3.1);
> PF-003 exit-3 = `isIceCode` band, `E10035`→1 (1.1.1/3.3.1, ST-43); PF-004 ST-40 →
> cli/ (4.1.4); PF-005 cli vitest include (3.1.1); PF-006 globSync API (1.2.4); PF-007
> GATE_SRC verbatim (07); PF-008 config-caret deferral AR-V22 (1.1.1); PF-009 yargs
> callback routing (3.2.2); PF-010 no CLI re-derivation (2.2.2); PF-011 `apt-get update`
> (4.1.3); PF-013 CLAUDE.md edge table (4.2.4). Task count unchanged (50) — fixes
> enriched existing tasks. See `00-preflight-report.md`.

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
| ----- | ----- | -------- | --------- |
| 1 | Foundations: host, codes, rename | 3 | 4–5 h |
| 2 | Programmatic API (facade) | 4 | 7–9 h |
| 3 | CLI (`blendc`) | 4 | 7–9 h |
| 4 | Hardening & closeout | 2 | 3–4 h |

**Total: 13 sessions, ~21–27 hours**

---

## Phase 1: Foundations

### Session 1.1: Docs back-propagation, deps & spec tests
**Reference**: [03-01](03-01-compiler-host.md) · [07 §Component 1](07-testing-strategy.md)
**Objective**: AR-V2 amendment recorded; ST-1..ST-4 + ST-7 red.

| # | Task | File |
| --- | ---- | ---- |
| 1.1.1 | Back-propagate AR-V2 (zero-dep color): amend RD-15 R35/R37/§4.5 chalk references. **Also record three preflight-derived runtime ARs:** **AR-V20** — add `cwd?: string` to `CompilerOptions` §4.1 (PF-002); **AR-V21** — clarify R44/R50 (exit 3 = ICE band via `isIceCode`; ACME-not-found `E10035` → exit 1) (PF-003); **AR-V22** — config-diagnostic caret rendering deferred to the AR-P2 seam (PF-008). Log all in `requirements/00-ambiguity-register.md` | `requirements/RD-15-*.md`, `requirements/00-ambiguity-register.md` |
| 1.1.2 | Add `tinyglobby` to compiler deps (AR-V3); `yarn install`, lockfile committed | `packages/compiler/package.json` |
| 1.1.3 | Write spec tests ST-1 (interface shape), ST-2..ST-4 (disk host), ST-7 (rename) — from 07 only, no implementation reading | `core/src/host/compiler-host.spec.test.ts`, `compiler/src/host/disk-host.spec.test.ts`, `compiler/src/index.spec.test.ts` |
| 1.1.4 | Red run: new spec tests fail (ST-7's import fails to compile = red); record result here | — |

### Session 1.2: Implementation
| # | Task | File |
| --- | ---- | ---- |
| 1.2.1 | Add `DriverSourceFileNotFound: "E10250"`, `DriverNoSourceFiles: "E10251"` + band comment (AR-V10) | `core/src/diagnostics/diagnostic-codes.ts` |
| 1.2.2 | Create `core/src/host/` (`compiler-host.ts`, barrel); re-export from core root (AR-V9) | `core/src/host/*`, `core/src/index.ts` |
| 1.2.3 | PF-002 rename `BuildResult` → `EmitBinaryResult` in the acme layer + barrel; add the AR-V5 cross-reference comment on the inline E10034 check | `compiler/src/acme/emit-binary.ts`, `compiler/src/index.ts` |
| 1.2.4 | Implement `createDiskCompilerHost` (tinyglobby `globSync(include, {ignore, cwd, absolute:true})` — the current API, NOT the deprecated single-object form (PF-006); projectRoot containment, sort — 03-01 normative order) | `compiler/src/host/disk-host.ts`, `compiler/src/host/index.ts` |
| 1.2.5 | Green run: ST-1..ST-4, ST-7 pass; existing RD-09 suites still green | — |

### Session 1.3: Impl tests & verify
| # | Task | File |
| --- | ---- | ---- |
| 1.3.1 | Disk-host impl tests: nested excludes, empty include, dotfile semantics, TOCTOU `readFile` → undefined | `compiler/src/host/disk-host.impl.test.ts` |
| 1.3.2 | Full workspace verify | — |

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Programmatic API

### Session 2.1: Spec tests
**Reference**: [03-02](03-02-compiler-facade.md) · [07 §Component 2](07-testing-strategy.md)

| # | Task | File |
| --- | ---- | ---- |
| 2.1.1 | Shared fixtures: `GATE_SRC`, `memHost`, `fakeBuildDeps` (test-local, per repo fixture precedent) | `compiler/src/api/__fixtures__/` or test-local helpers |
| 2.1.2 | Write spec tests ST-5/ST-6 (discovery errors), ST-8..ST-14 (`compile`), ST-15/ST-16/ST-41/ST-42 (emit — incl. `!to` out-name + startup seam, PF-001), ST-17..ST-21 (`build`) | `compiler/src/api/discovery.spec.test.ts`, `compile.spec.test.ts`, `emit.spec.test.ts`, `build.spec.test.ts` |
| 2.1.3 | Red run; record here | — |

### Session 2.2: `compile()` path
| # | Task | File |
| --- | ---- | ---- |
| 2.2.1 | `CompilerOptions` (incl. `cwd?` routing field, PF-002) + `optionsToOverrides` (R9; explicit-undefined semantics; `cwd`/`configPath`/`sourceFiles` are NOT config keys) | `compiler/src/api/options.ts` |
| 2.2.2 | Result types (`CompileResult`/`BuildResult`/`EmitResult`, R51 `config` — the returned `config.outName` carries the derived effective name, PF-010) | `compiler/src/api/results.ts` |
| 2.2.3 | `runFrontend` — 03-02's normative sequence (config **w/ `cwd`**→bags→host→files **+ derive `outName` once**→platform→intern→lex/parse→analyze→SFA); expose `outName` on `FrontendRun` (PF-001/PF-002/PF-010) | `compiler/src/api/run-frontend.ts` |
| 2.2.4 | `compile()` + the shared policy/merge result assembly (AR-V7 order, policy once) | `compiler/src/api/compile.ts` |
| 2.2.5 | Partial green: ST-5/6, ST-8..ST-14 pass | — |

### Session 2.3: emit & build paths
| # | Task | File |
| --- | ---- | ---- |
| 2.3.1 | **Codegen seam (PF-001):** add optional `overrides?: Partial<Pick<PreambleOptions,"projectName"\|"shimVariant">>` 4th param to `assembleProgram`, merged over `derivePreambleOptions` (additive; RD-08/09 consumers untouched). Then `emitIl`/`emitAsm` (AR-V19: `optimizeIL` always; peephole only when `config.optimize`); `emitAsm` passes `{projectName: run.outName, shimVariant: toShimVariant(config.startup)}` (`minimal→non-terminating` per RD-16 R18) | `codegen/src/instr/instr-program.ts`, `compiler/src/api/emit.ts` |
| 2.3.2 | `build()` + `BuildDeps`/`defaultBuildDeps` (AR-V4/V12); report assembly threading `binarySize`; `checkBinaryBudget` call (AR-V5); binary read-back | `compiler/src/api/build.ts` |
| 2.3.3 | `api/` barrel + package barrel exports | `compiler/src/api/index.ts`, `compiler/src/index.ts` |
| 2.3.4 | Green run: all Phase-2 STs pass | — |

### Session 2.4: Impl tests & verify
| # | Task | File |
| --- | ---- | ---- |
| 2.4.1 | `optionsToOverrides` mapping table impl tests | `compiler/src/api/options.impl.test.ts` |
| 2.4.2 | `build()` impl tests: outName edges, read-back on failure, report absence pre-stage | `compiler/src/api/build.impl.test.ts` |
| 2.4.3 | Full workspace verify | — |

**Verify**: as Phase 1.

---

## Phase 3: CLI

### Session 3.1: Deps & spec tests
**Reference**: [03-03](03-03-cli.md) · [07 §Component 3](07-testing-strategy.md)

| # | Task | File |
| --- | ---- | ---- |
| 3.1.1 | cli `package.json`: `bin` field, `yargs@^17`, dep `@blend65/core`; devDep `@types/yargs` (AR-V1); **widen `cli/vitest.config.ts` include to `src/**/*.{spec,impl}.test.ts` (PF-005 — else impl tests never run)**; `yarn install` | `packages/cli/package.json`, `packages/cli/vitest.config.ts` |
| 3.1.2 | `fakeIo` fixture + spec tests ST-22..ST-26, ST-34..ST-36, **ST-43** (commands/exit codes incl. ACME-not-found→1, PF-003) | `cli/src/main.spec.test.ts` |
| 3.1.3 | Spec tests ST-27..ST-31, ST-37, ST-38 (emit/output flags) | `cli/src/emit-flags.spec.test.ts` |
| 3.1.4 | Spec tests ST-24, ST-32, ST-33 (formats, trailer, color) | `cli/src/diagnostics-output.spec.test.ts` |
| 3.1.5 | Red run; record here | — |

### Session 3.2: Parsing & rendering
| # | Task | File |
| --- | ---- | ---- |
| 3.2.1 | `resolveColor` + SGR accent helpers (AR-V2/V16 precedence) | `cli/src/color.ts` |
| 3.2.2 | `parseArgs` — full flag table, no yargs defaults for config-backed flags, `.fail()`/`.exitProcess(false)` (AR-V13), **parse-callback form `(err, argv, output)` so help/version/fail text routes through `CliIo` (PF-009)**, warn-as-error coercion | `cli/src/args.ts` |
| 3.2.3 | `render.ts` — diagnostics/trailer (AR-V11 exact strings)/summary/JSON report/artifact writes | `cli/src/render.ts` |

### Session 3.3: Entry & dispatch
| # | Task | File |
| --- | ---- | ---- |
| 3.3.1 | `runCli` dispatch + R50 classification (03-03 order; exit 3 via `isIceCode` band, `E10035`→1 — PF-003); map `io.cwd`→`options.cwd` (PF-002) | `cli/src/main.ts` |
| 3.3.2 | `bin.ts` (shebang, `process.exitCode`) + `index.ts` rewrite (`runCli`, `CliIo`, `VERSION`) | `cli/src/bin.ts`, `cli/src/index.ts` |
| 3.3.3 | Green run: all Phase-3 STs pass | — |

### Session 3.4: Impl tests & verify
| # | Task | File |
| --- | ---- | ---- |
| 3.4.1 | args impl tests: coercion matrix, flag→option mapping | `cli/src/args.impl.test.ts` |
| 3.4.2 | render impl tests: pluralization matrix, color matrix, write-failure path | `cli/src/render.impl.test.ts` |
| 3.4.3 | Full workspace verify | — |

**Verify**: as Phase 1.

---

## Phase 4: Hardening & Closeout

### Session 4.1: Enforcement, CI & E2E
| # | Task | File |
| --- | ---- | ---- |
| 4.1.1 | ESLint AC-18 rules: `no-console` + `no-restricted-properties` (`process.stdout`/`stderr`) for compile-path packages' `src/`, tests excluded (AR-V18) | `eslint.config.js` |
| 4.1.2 | Root-tier spec test ST-39 (static no-print scan). Expected to PASS immediately — justification: it is an enforcement witness over an already-clean codebase (documented red-run exception, same class as boundary ST-R15) | `test/no-print.spec.test.ts` |
| 4.1.3 | CI: add ACME install step (AR-V4) — `sudo apt-get update && sudo apt-get install -y acme` (update first, PF-011) before the test job | `.github/workflows/*` |
| 4.1.4 | ST-40 real-ACME E2E (skipIf `discoverAcme` fails) — gate program → real `.prg`, PRG header asserted. **File in `cli/src/build-e2e.spec.test.ts` (CLI-level; a compiler-side file calling `runCli` = compiler→cli cycle, PF-004)** | `cli/src/build-e2e.spec.test.ts` |
| 4.1.5 | Full workspace verify (local: E2E runs; confirm CI run green with ACME) | — |

### Session 4.2: Acceptance & bookkeeping
| # | Task | File |
| --- | ---- | ---- |
| 4.2.1 | AC-19 traceability audit over the new code/docs; record the audit block below | this file |
| 4.2.2 | Tick RD-15 §6 AC-01..AC-20 with ST/file:line evidence | `requirements/RD-15-*.md` |
| 4.2.3 | Close RD-11 AC-16 (flag half now shipped — ST-30) + remaining RD-11 bookkeeping (AC-10/AC-21) | `requirements/RD-11-*.md` |
| 4.2.4 | Roadmap sync: feature row → Done, portfolio cascade, CLAUDE.md status paragraph **+ update the CLAUDE.md package-edge table row `@blend65/cli | compiler, config` to add `core` (PF-013)** | roadmaps, `CLAUDE.md` |
| 4.2.5 | Final full workspace verify | — |

**Verify**: as Phase 1.

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> 1. **After completing each task:** mark it `[x]` with a timestamp — e.g.,
>    `- [x] 1.1.1 Task ✅ (completed: YYYY-MM-DD HH:MM)`
> 2. **After completing each phase:** confirm every task in the phase is marked
> 3. **Update the Progress header** after every update
> 4. **This checklist MUST exist** — reconstruct from the phase details if missing
> 5. **Never batch updates**

### Phase 1: Foundations
- [x] 1.1.1 AR-V2 back-propagation (RD-15 text + requirements register) ✅ (completed: 2026-07-03) — AR-106..109 added to requirements register; RD-15 R35/R37/§2/§4.1/§4.3/§4.5/R44/R50 amended
- [x] 1.1.2 tinyglobby dependency ✅ (completed: 2026-07-03) — `tinyglobby@^0.2.10` (resolved 0.2.17) in compiler deps; lockfile updated
- [x] 1.1.3 Spec tests ST-1..ST-4, ST-7 ✅ (completed: 2026-07-03) — core/src/host/compiler-host.spec.test.ts (ST-1), compiler/src/host/disk-host.spec.test.ts (ST-2..ST-4), compiler/src/index.spec.test.ts extended (ST-7)
- [x] 1.1.4 Red run recorded ✅ (completed: 2026-07-03) — core typecheck fails `TS2305 has no exported member 'CompilerHost'`; disk-host spec fails (module `./disk-host.js` unresolved). ST-7 EmitBinaryResult import red on compiler typecheck.
- [x] 1.2.1 E10250/E10251 codes ✅ (completed: 2026-07-03) — DriverSourceFileNotFound/DriverNoSourceFiles + band comment in diagnostic-codes.ts
- [x] 1.2.2 core `host/` module + barrel ✅ (completed: 2026-07-03) — compiler-host.ts + index.ts; re-exported from core root
- [x] 1.2.3 PF-002 rename + AR-V5 cross-ref comment ✅ (completed: 2026-07-03) — BuildResult→EmitBinaryResult (emit-binary.ts + barrel); AR-V5 cross-ref on inline E10034 check
- [x] 1.2.4 `createDiskCompilerHost` ✅ (completed: 2026-07-03) — disk-host.ts (globSync + containment + sort) + host barrel; exported from compiler barrel
- [x] 1.2.5 Green run (ST-1..ST-4, ST-7) ✅ (completed: 2026-07-03) — ST-1/2/3/4/7 green; full compiler suite 46/46 (RD-09 intact)
- [x] 1.3.1 disk-host impl tests ✅ (completed: 2026-07-03) — disk-host.impl.test.ts (6 tests): nested excludes, empty include, dotfile default, TOCTOU/dir readFile→undefined, resolvePath
- [x] 1.3.2 Full verify ✅ (completed: 2026-07-03) — frozen install + build(10/10) + typecheck(17/17) + lint(0 errors; 3 pre-existing core warnings) green. Full test tier: one KNOWN-FLAKY frontend perf test (`elapsedMs < 50`, timing-dependent under parallel load) failed then passed 255/255 in isolation; not RD-15-related (frontend untouched).

### Phase 2: Programmatic API
- [x] 2.1.1 Shared fixtures ✅ (completed: 2026-07-03) — api/test-fixtures.ts: GATE_SRC (verbatim), memHost, fakeBuildDeps (in-mem fs + scripted ACME; failureCode seam for ST-43)
- [x] 2.1.2 Spec tests ST-5/6, ST-8..ST-21 ✅ (completed: 2026-07-03) — discovery.spec (ST-5/6), compile.spec (ST-8..14), emit.spec (ST-15/16/41/42), build.spec (ST-17..21)
- [x] 2.1.3 Red run recorded ✅ (completed: 2026-07-03) — 4 api spec files fail: `./compile.js`/`./emit.js`/`./build.js` unresolved (modules not yet created)
- [x] 2.2.1 options.ts ✅ (completed: 2026-07-03) — CompilerOptions (incl. cwd) + optionsToOverrides
- [x] 2.2.2 results.ts ✅ (completed: 2026-07-03) — CompileResult/EmitResult/BuildResult (config carries effective outName)
- [x] 2.2.3 run-frontend.ts ✅ (completed: 2026-07-03) — normative sequence; outName derived once; two-bag; three-tier discovery. **Deviation:** `planAllocation` receives interim `DEFAULT_PROFILE` (type-forced; plan doc said `plugin.profile` — the SFA/semantics `PlatformProfile` type differs from the canonical RD-10 profile; functionally equivalent for the empty-adapter gate slice; canonical `maxBinarySize` reaches the budget check via build.ts).
- [x] 2.2.4 compile.ts ✅ (completed: 2026-07-03) — compile() + shared finalizeRun/assembleCompileResult (policy once, config-first merge)
- [x] 2.2.5 Partial green (ST-5/6, ST-8..ST-14) ✅ (completed: 2026-07-03) — subsumed by 2.3.4 full green
- [x] 2.3.1 emit.ts ✅ (completed: 2026-07-03) — emitIl/emitAsm + toShimVariant; codegen PF-001 seam added to assembleProgram (additive 4th param, defined-only merge)
- [x] 2.3.2 build.ts (+ BuildDeps, checkBinaryBudget, read-back) ✅ (completed: 2026-07-03) — full pipeline; binarySize threaded; canonical E10034; binary read-back; defaultBuildDeps
- [x] 2.3.3 Barrels ✅ (completed: 2026-07-03) — api/index.ts + package barrel (facade only; internals private)
- [x] 2.3.4 Green run (all Phase-2 STs) ✅ (completed: 2026-07-03) — 18/18 api spec tests green (ST-5/6, ST-8..21, ST-41/42)
- [x] 2.4.1 options impl tests ✅ (completed: 2026-07-03) — options.impl.test.ts (3 tests): routing-keys-excluded, explicit-undefined, full mapping table
- [x] 2.4.2 build impl tests ✅ (completed: 2026-07-03) — build.impl.test.ts (6 tests): outName edges, read-back on failure/over-budget, report absence pre-stage
- [x] 2.4.3 Full verify ✅ (completed: 2026-07-03) — build 10/10, typecheck 17/17, lint 0 errors; full test tier green (frontend 255, compiler 79, codegen 329, root 3; no flake this run)

### Phase 3: CLI
- [x] 3.1.1 cli package.json (bin, yargs, core dep) ✅ (completed: 2026-07-03) — bin blendc, yargs@^17.7.2 (17.7.3), @types/yargs devDep, @blend65/core dep + tsconfig ref; vitest include widened to {spec,impl} (PF-005)
- [x] 3.1.2 Spec tests ST-22..ST-26, ST-34..ST-36, ST-43 ✅ (completed: 2026-07-03) — main.spec.test.ts + fakeIo/fakeCliBuildDeps fixtures (real-fs fake ACME)
- [x] 3.1.3 Spec tests ST-27..ST-31, ST-37, ST-38 ✅ (completed: 2026-07-03) — emit-flags.spec.test.ts
- [x] 3.1.4 Spec tests ST-24, ST-32, ST-33 ✅ (completed: 2026-07-03) — diagnostics-output.spec.test.ts (color matrix, JSON format, trailer)
- [x] 3.1.5 Red run recorded ✅ (completed: 2026-07-03) — all new cli spec files fail `runCli is not a function` (main/args/render not yet implemented)
- [x] 3.2.1 color.ts ✅ (completed: 2026-07-03) — resolveColor (AR-V16 precedence) + zero-dep SGR errorAccent/warningAccent
- [x] 3.2.2 args.ts ✅ (completed: 2026-07-03) — full flag table, no config-flag defaults, .fail() capture + parse-callback (PF-009), warn-as-error coercion; ParseOutcome discriminant. (VERSION extracted to version.ts to avoid an index↔args cycle; CliIo extracted to io.ts.)
- [x] 3.2.3 render.ts ✅ (completed: 2026-07-03) — renderDiagnostics (+ AR-V11 trailer), renderBuildSummary, renderJsonReport, writeTextArtifact
- [x] 3.3.1 main.ts (runCli + R50) ✅ (completed: 2026-07-03) — dispatch (build/check/emit-il/emit-asm), R50 classify (config/driver→2, ICE→3, error→1), io.cwd→options.cwd, artifact-write try/catch→2
- [x] 3.3.2 bin.ts + index.ts ✅ (completed: 2026-07-03) — bin.ts (shebang, realIo, process.exitCode); index.ts exports runCli/CliIo/VERSION
- [x] 3.3.3 Green run (all Phase-3 STs) ✅ (completed: 2026-07-03) — 23/23 cli tests green (ST-22..38, ST-43) first run
- [x] 3.4.1 args impl tests ✅ (completed: 2026-07-03) — args.impl.test.ts (12 tests): warn-as-error coercion, command resolution, flag→option mapping, --no-quiet, fail/help outcomes
- [x] 3.4.2 render impl tests ✅ (completed: 2026-07-03) — render.impl.test.ts (11 tests): pluralization matrix, color matrix, JSON-no-trailer, write-failure path
- [x] 3.4.3 Full verify ✅ (completed: 2026-07-03) — build/typecheck/lint clean; full test tier green (cli 46, compiler 79, codegen 329, frontend 255, config 96, platforms 40, root 3; no flake)

### Phase 4: Hardening & Closeout
- [x] 4.1.1 ESLint AC-18 rules ✅ (completed: 2026-07-03) — no-console + no-restricted-properties (process.stdout/stderr) on compile-path src/, tests excluded; negative-check confirmed the rule fires
- [x] 4.1.2 ST-39 root no-print spec test ✅ (completed: 2026-07-03) — test/no-print.spec.test.ts static scan; passes immediately (clean codebase, documented red-run exception)
- [x] 4.1.3 CI ACME install step ✅ (completed: 2026-07-03) — `sudo apt-get update && sudo apt-get install -y acme` before Test (PF-011); CI-green pending push
- [x] 4.1.4 ST-40 real-ACME E2E ✅ (completed: 2026-07-03) — cli/src/build-e2e.spec.test.ts (skipIf ACME undiscoverable); passes locally. **Surfaced RD-09 DEF-1** (headerless PRG via `-o`); user-approved fix applied (drop `-o`, `!to`-driven cbm output) — AR-V23; ST-40 now asserts the real `$01 $08` header.
- [x] 4.1.5 Full verify (+ CI green confirmation) ✅ (completed: 2026-07-03) — see below; CI-green confirmed on push
- [x] 4.2.1 AC-19 traceability audit ✅ (completed: 2026-07-03) — audit block above (PASS; every decision → AR-V*/spec/Design)
- [x] 4.2.2 RD-15 §6 ticked with evidence ✅ (completed: 2026-07-03) — AC-01..AC-20 ticked with ST/file evidence in RD-15-programmatic-cli-api.md §6
- [x] 4.2.3 RD-11 AC-16 closed + bookkeeping ✅ (completed: 2026-07-03) — AC-16 (--quiet via ST-30/ST-22/ST-38), AC-10 (band disjointness), AC-21 (traceability) closed in RD-11
- [x] 4.2.4 Roadmaps + CLAUDE.md sync ✅ (completed: 2026-07-03) — feature roadmap RD-15→✅ + RD-12 next; portfolio cascade 17/20; CLAUDE.md status paragraph + cli edge row `+core` (PF-013)
- [x] 4.2.5 Final full verify ✅ (completed: 2026-07-03) — see below

---

## AC-19 Traceability Audit (task 4.2.1)

> **Verdict: PASS (2026-07-03).** Every RD-15 implementation decision traces to an
> `AR-NN`, a frozen spec section, or an explicit `Design` mark (§2 traceability rule).

| Area | Decision | Traces to |
| ---- | -------- | --------- |
| Argument parser | yargs@17 + `@types/yargs` | AR-V1 · AR-16 |
| CLI color | zero-dependency (`resolveColor` + local SGR); no chalk | AR-V2 (amends AR-17) → requirements AR-106 |
| Glob engine | tinyglobby + sort + projectRoot containment | AR-V3 · R47 · RD-13 R37 |
| `build()`/CLI testing | injectable `BuildDeps` + skipIf real-ACME E2E + CI ACME | AR-V4 |
| E10034 wiring | facade `checkBinaryBudget(report, bag)` after `emitBinary` | AR-V5 |
| Host/discovery | config-first; injected host verbatim; `sourceFiles` bypass | AR-V6 |
| Diagnostic bags | two bags (config cap 20, pipeline `maxErrors`), policy once | AR-V7 |
| Module layouts | core `host/`, compiler `api/`+`host/`, cli 6-file layout | AR-V9 |
| Driver codes | `E10250`/`E10251` + messages | AR-V10 · R48/R49 |
| Trailer format | terminal-only, stderr, not `--quiet`-suppressed | AR-V11 |
| Binary read-back | facade-owned via `BuildDeps.readBinary` | AR-V12 |
| Exit mechanism | `process.exitCode` + custom `.fail()`→2 | AR-V13 |
| Default command | `$0`/`build` alias | AR-V14 |
| `--version` | explicit `.version(VERSION)` | AR-V15 |
| Color precedence | `--color`>`--no-color`>`NO_COLOR`>`isTTY` | AR-V16 |
| Path display | projectRoot-relative, forward slashes | AR-V17 |
| AC-18 enforcement | ESLint no-print + ST-39 witness | AR-V18 |
| `--optimize` scope | peephole only; `optimizeIL` always | AR-V19 |
| `cwd` routing | `CompilerOptions.cwd` → `loadConfig` | AR-V20 → requirements AR-107 |
| Exit-3 trigger | ICE band via `isIceCode`; `E10035`→1 | AR-V21 → requirements AR-108 |
| Config caret | header-only v1 (deferred) | AR-V22 → requirements AR-109 |
| Startup/`!to` seam | additive `assembleProgram` 4th param; `outName` once | PF-001 |
| `EmitBinaryResult` rename | acme aggregate renamed; facade owns `BuildResult` | PF-002 |
| **ACME `-o`→`!to`** | drop `-o`, `!to,cbm`-driven header-bearing PRG | AR-V23 (DEF-1) |
| `planAllocation` profile | interim `DEFAULT_PROFILE` (type-forced; = `analyze`'s profile) | Design (execution deviation, task 2.2.3) |
| Empty-platform override | `""` = config's no-platform marker → not forwarded | Design (`config/src/merge.ts` seeds `platform:""`) |
| `modelToFunctionInfo` `[]` | RD-05 documented deferral; gate compiles | Pre-resolved context (register) |

## Dependencies

```
Phase 1 (host, codes, rename)
    ↓
Phase 2 (facade — consumes host, codes, EmitBinaryResult)
    ↓
Phase 3 (CLI — consumes facade)
    ↓
Phase 4 (enforcement, E2E, closeout)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 50 tasks completed
2. ✅ Full workspace verify green (incl. the new CLI/facade suites; CI green with ACME)
3. ✅ RD-15 §6 AC-01..AC-20 ticked with evidence; RD-11 AC-16 closed
4. ✅ No dead code; new deps limited to yargs/@types/yargs/tinyglobby (AR-V1/V3; no chalk per AR-V2)
5. ✅ Security: R47 containment (ST-4), E10250/E10251 validation, no-shell ACME path, AC-18 no-print enforcement (ST-39)
6. ✅ AR-V2 back-propagation landed (RD-15 text + requirements register)
7. ✅ Roadmaps + CLAUDE.md synced (handled with the exec_plan skill's hooks)
