# Blend65 Compiler — Implementation Roadmap

> **Purpose**: The single living tracker of *what is implemented* and *what comes next*
> for the Blend65 compiler (`blendc`). This is the implementation counterpart to
> `requirements/README.md` (the RD index) and `spec/build-plan.md` (the spec build plan,
> already complete).
>
> **This file lives at `codeops/features/blend65-ri/00-roadmap.md` and is authoritative for
> implementation status** (rolled up into the portfolio roadmap `codeops/00-roadmap.md`).
> It is governed by the `roadmap` skill — read it at the start of every task and update it
> whenever an RD reaches 100%.
>
> **Last Updated**: 2026-07-03 (**RD-12 Plan Preflighted 🔬** — plan preflight iteration 1:
> 0 critical / 0 major / 2 minor / 2 observation; all 4 findings fixed & applied to the plan
> docs. An independent challenger lowered the top finding (undeclared `@blend65/codegen`
> test-scope dep + omitted tsconfig refs + AR-H11/dep-table inaccuracy) from MAJOR to MINOR by
> refuting "build-blocking" — Yarn-classic hoisting resolves the import (`eslint.config.mjs`
> is the real R15 gate). Also fixed: gate/RD-17 suites now `skipIf(!hasVice() || !hasAcme())`
> since they compile via ACME (PF-002); ST-02's exact `$0819`/`$080d` moved to a
> build-sensitive impl smoke test, ST-01 keeps the immutable DEF-2 oracle (PF-003); `runFrames`
> frame-approximation documented (PF-004). DEF-2 independently re-verified live (`acme
> --vicelabels` emits `al C:0002 .__zp_arg_0` — 4-hex-digit ZP, regex matches). Report at
> `plans/rd-12-test-harness/00-preflight-report.md`. Next: exec_plan. Earlier same day:
> **RD-12 Plan Created 📋** — `make_plan` produced
> `plans/rd-12-test-harness/`: 4 phases / 10 sessions / 44 tasks, gate PASSED (17 items,
> AR-H1..H17). Full-RD scope. Grounding surfaced blocking RD-09 defect **DEF-2** (empty
> `symbolMap` — `-l` vs `--vicelabels`), fixed as Phase 0 with a regression oracle. VICE 3.10
> + ACME present locally. Next: plan preflight → exec_plan. Earlier same day: **RD-12
> RD-Preflighted 🔎** — requirements preflight iteration 1: 0 critical / 0 major / 6 minor / 2 observations, all applied to the RD-12 doc; both initially-MAJOR findings knocked down by a blind challenger (the interim `mos6502-interpreter.ts` self-declares "RD-12 supersedes this" & is ACME-gated, not an AR-27 violation; RD-12 has its own AC-14 distinct from RD-17's inherited one). RD-12 now cross-references the interim interpreter, discharges RD-17's AC-14 (§5), binds R27/R28 to RD-15 `BuildResult`, pins R19 keys to `parseLabelFile`, adds R7a platform→emulator registry. Ready for `make_plan`. Earlier same day: **RD-15 ✅ COMPLETE** — exec_plan 50/50 tasks, 4 phases, full workspace verify + CI green. Phase 4: AC-18 no-print enforcement (ESLint no-console/no-restricted-properties + ST-39 root witness), CI ACME install, the ST-40 real-ACME build E2E (header-bearing c64 PRG), AC-01..20 ticked with ST evidence + the AC-19 traceability audit, and RD-11 AC-16/AC-10/AC-21 closed. Surfaced & fixed a latent RD-09 defect (DEF-1/AR-V23): `invokeAcme` dropped `-o` so the `!to ...,cbm` directive drives a loadable header-bearing PRG. Phase 3: `@blend65/cli` ships the full `blendc` command — yargs@17 parsing (default-build alias, `check`, PF-009 help/version routing), zero-dependency color (AR-V2), stderr/stdout split, `--emit-*` writes, and the R50 exit ladder. Phase 2: `@blend65/compiler` now ships the `api/` facade — `compile` (frontend-only, the LSP path), `emitIl`/`emitAsm` (partial pipelines with the PF-001 `assembleProgram` override seam threading `--out-name`/`--startup`), and `build` (full ACME pipeline: injectable `BuildDeps`, canonical `checkBinaryBudget` E10034, binary read-back) — all over one `runFrontend` core with two-bag config/pipeline diagnostics and a single R21 `outName` derivation. Full workspace verify green. Earlier Phase 1/4: `@blend65/core` ships the `CompilerHost` interface + host barrel; `@blend65/compiler` ships `DiskCompilerHost` (tinyglobby R47 globs + projectRoot containment + lexicographic sort); driver codes E10250/E10251 added; PF-002 `BuildResult`→`EmitBinaryResult` rename landed with the AR-V5 cross-ref; AR-V2/V20/V21/V22 back-propagated to the requirements register as AR-106..109. Full workspace verify green. Earlier: RD-15 plan **preflighted** 🔬 — iteration 1: 13 findings (3 major/7 minor/3 observation) all resolved on the recommended option & applied to the plan docs; register grew to 22 items (V20 `cwd`, V21 exit-3 ICE band, V22 caret deferral); next: exec_plan. Earlier same day: RD-15 plan created — 4 phases / 13 sessions / 50 tasks, gate PASSED with 19 items. Earlier same day: RD-11b ✅ COMPLETE — exec_plan 39/39 tasks, 4 phases: `SourceMap` registry, severity policy, terminal/JSON diagnostic renderers (Ch 14 §1 goldens + R52 security tier), `ResourceReport` builder + `checkBinaryBudget` + Ch 11 §6 build-summary renderers; RD-11 §6 boxes AC-08/09/11–15/17–20 closed, AC-16 flag half → RD-15; full workspace verify green, core 237 tests; next: RD-15 make_plan)


---

## Current Position


- **Last completed**: **RD-15** (programmatic + CLI API), executed to 100% on 2026-07-03
  (`codeops/features/blend65-ri/plans/rd-15-programmatic-cli-api/99-execution-plan.md`,
  50/50 tasks, 4 phases). `@blend65/compiler` ships the `api/` facade — `compile`
  (frontend-only, the LSP path), `emitIl`/`emitAsm` (partial pipelines with the PF-001
  `assembleProgram` override seam for `--out-name`/`--startup`), and `build` (full ACME
  pipeline: injectable `BuildDeps`, canonical `checkBinaryBudget` E10034, binary
  read-back) over one `runFrontend` core (two-bag config/pipeline diagnostics, single R21
  `outName` derivation) — plus the core `CompilerHost` + compiler `DiskCompilerHost`
  (tinyglobby R47 globs + projectRoot containment) and driver codes E10250/E10251.
  `@blend65/cli` ships the full `blendc` command (yargs@17, zero-dependency color per AR-V2,
  stderr/stdout split, `--emit-*` writes, the R50 exit ladder). AC-18 no-print is
  ESLint-enforced + ST-39-witnessed; CI installs ACME so the ST-40 real-ACME build E2E runs
  live. Discharged the deferred RD-11 items (AC-16 `--quiet` half via ST-30; AC-10/AC-21
  bookkeeping) and the PF-002 `EmitBinaryResult` rename. **Fixed a latent RD-09 defect
  (DEF-1/AR-V23):** `invokeAcme` dropped `-o` so the `!to ...,cbm` directive drives a
  header-bearing, loadable c64 PRG. Full workspace verify + CI green.
- **Previously**: **RD-11b** (diagnostics remainder & resource reporter), 100% on 2026-07-03
  (`codeops/features/blend65-ri/plans/rd-11b-diagnostics-reporting/99-execution-plan.md`,
  39/39 tasks, 4 phases): `@blend65/core` ships the `SourceMap` registry (path-keyed intern,
  cached `LineMap`s, AR-104 `has()`), the R50-precedence severity policy
  (`createSeverityPolicy`/`applySeverityPolicy`, W-code preserved on promotion per AR-Q8),
  the Ch 14 §1 terminal renderer (per-excerpt gutters PF-004, byte-column carets, R51
  degradation, R52 sanitize-then-caret security tier ST-18, AR-Q9 hand-rolled ANSI) +
  verbatim-span JSON renderer, and the `report/` module (`ResourceReport` on the shipped
  `SfaResourceData` per AR-103/PF-002, `buildResourceReport` with by-reference embedding,
  post-ACME `checkBinaryBudget` E10034, Ch 11 §6 build-summary goldens with AR-102
  zero-staging, PF-012 sorted-entries JSON). RD-11 §6: AC-11..13/15/18/19/20 ticked with ST
  evidence, AC-08/09/14/17 audit-closed (AR-Q12), AC-16 core half noted (flag → RD-15).
  Full workspace verify green (core 237 tests).
- **Previously**: **RD-16** (compiler configuration) 100% on 2026-07-02 — `@blend65/config`
  ships `loadConfig()` (walk-up discovery, tolerant JSONC via `jsonc-parser`, E10240–E10246/
  W10240–41 validation, defaults←file←overrides merge); AC-01..AC-14 ticked.
- **Preflighted**: **RD-11** (diagnostics & resource reporting) requirements preflight
  ✅ PASSED 2026-07-03 — 14 findings (3 major, 7 minor, 4 observations), all
  recommendations accepted and fixes applied (see `requirements/00-preflight-report.md`).
  Highlights: `--report=json` semantics deferred to RD-15 (PF-001); `ResourceReport`
  rebuilt on the shipped `SfaResourceData` with `PeepholeStats` core-resident (PF-002);
  the Ch 11 §6 build-summary layout made normative with render-as-zero staging — runtime
  **AR-102** (PF-003, incl. an RD-15 §4.4 cascade fix); RD-11a/11b split + true deps now
  recorded in the RD header. RD-15's requirements preflight passed earlier the same day
  (10 findings; its PF-001 reordered RD-11b ahead of RD-15).
- **Next up**: **RD-13** (non-functional requirements sweep) — needs `make_plan`.
  **RD-12 ✅ COMPLETE (2026-07-03)** — exec_plan 44/44 tasks, 4 phases; `@blend65/test-harness`
  ships the full emulator-verification framework (driver + VICE codec + strategies + assertions
  + fixture + golden), all 16 own ACs ticked + RD-17 inherited AC-14 discharged on real VICE,
  DEF-2 closed, full workspace verify green. Historical planning detail below. Plan at
  `codeops/features/blend65-ri/plans/rd-12-test-harness/` — 4 phases / 10 sessions / 44
  tasks, Zero-Ambiguity Gate PASSED with 17 items (AR-H1..H17). Scope: full RD (all 16 ACs),
  phased. Locked decisions: depend on `@blend65/compiler` and reuse `parseLabelFile` +
  `BuildResult` (H2); prove emulator/RD-17 tests green **locally on VICE 3.10** while
  `skipIf` keeps CI green (H3); hand-rolled zero-dep PNG screenshots (H4); bounded RD-17
  AC-14 vectors (H5); relaunch VICE per binary (H6). **Grounding surfaced a blocking latent
  RD-09 defect — DEF-2:** `invokeAcme` passes `-l` (ACME-native `name = $addr`) instead of
  `--vicelabels`, so `parseLabelFile` yields an **empty `symbolMap`** for every real build
  (verified: gate build → `symbolMap.size === 0`); RD-12's label sync + symbolic
  `assertMemory` need it, so the plan fixes it as **Phase 0** with a regression oracle
  (verified live: `--vicelabels` → `al C:0819 ._main`, `al C:080d .__startup`). Real gate
  symbols pinned: `_main=$0819`, `__startup=$080d`, `__zp_arg_0..3=$02..$05`. VICE 3.10 +
  ACME both installed locally → every tier buildable now. Next: plan preflight → exec_plan.



---

## Per-RD Workflow (mandatory sequence)

Every RD is taken through this exact sequence:

```
preflight  →  make_plan  →  preflight  →  exec_plan
```

1. **preflight** — validate the RD requirements document against the preflight checklist
   (`requirements/01-preflight-checklist.md`) *before* planning. Verdict must be PASS.
2. **make_plan** — author the implementation plan under
   `codeops/features/blend65-ri/plans/<rd-slug>/` (only if no plan directory exists yet;
   otherwise review/refresh the existing plan).
3. **preflight** — re-run preflight against the *authored plan* to confirm it is coherent
   and complete before any code is written. Verdict must be PASS.
4. **exec_plan** — execute the plan phase-by-phase (spec-tests-first), updating the plan's
   `99-execution-plan.md` progress header as each task lands.

When `exec_plan` reaches 100%, **update this roadmap** (see Update Protocol below).

---

## Status — Done

> Completed plans are archived under `codeops/_archive/` to keep the active `plans/`
> directory clean. The `Plan dir` paths below point at their archived locations.

| RD | Title | Plan dir | Status |
|----|-------|----------|--------|
| RD-01 | Project scaffolding & toolchain | `codeops/_archive/rd-01-project-scaffolding-toolchain/` | ✅ COMPLETE |
| RD-02 | Lexer | `codeops/_archive/rd-02-lexer/` | ✅ COMPLETE |
| RD-03 | Parser & AST | `codeops/_archive/rd-03-parser-ast/` | ✅ COMPLETE |
| RD-04 | Semantic analysis & type system | `codeops/_archive/rd-04-semantic-analysis/` | ✅ COMPLETE |
| RD-05 | SFA frame planner & ZP allocator | `codeops/_archive/rd-05-sfa-frame-planner/` | ✅ COMPLETE |
| RD-06 | IL & IL optimizer (walking-skeleton slice) | `codeops/_archive/rd-06-il-optimizer/` | ✅ COMPLETE |
| RD-07a | Structured `Instr` model | `codeops/_archive/rd-07a-instr-model/` | ✅ COMPLETE |
| RD-07b | IL→Instr live-op-set slice | `codeops/_archive/rd-07b-il-to-instr/` | ✅ COMPLETE |
| RD-07c | Codegen platform preamble (Half A) | `codeops/_archive/rd-07c-codegen-platform-preamble/` | ✅ COMPLETE |
| RD-10 | Platform plugin system (slice) | `codeops/_archive/rd-10-platform-plugin-system/` | ✅ COMPLETE |
| RD-11a | Diagnostics core | `codeops/_archive/rd-11a-diagnostics-core/` | ✅ COMPLETE |
| RD-08 | Peephole optimizer (passthrough v1, AR-38) | `codeops/features/blend65-ri/plans/rd-08-peephole-optimizer/` | ✅ COMPLETE |
| RD-09 | ACME emitter & assembler integration | `codeops/features/blend65-ri/plans/rd-09-acme-emitter/` | ✅ COMPLETE |
| RD-17 | Intrinsics & runtime ABI (all four tiers; AC-14 emulator tier ✅ discharged by RD-12 on real VICE, AR-P4/AR-P17) | `codeops/features/blend65-ri/plans/rd-17-intrinsics-runtime-abi/` | ✅ COMPLETE |
| RD-16 | Compiler configuration (`blend65.json` loader) | `codeops/features/blend65-ri/plans/rd-16-compiler-configuration/` | ✅ COMPLETE |
| RD-11b | Diagnostics remainder & resource reporter (`SourceMap`, severity policy, renderers, `ResourceReport`) | `codeops/features/blend65-ri/plans/rd-11b-diagnostics-reporting/` | ✅ COMPLETE |

---

## Status — Pending


> Ordered along the MVP critical path (Phase A first, then Phase B). "Plan dir" shows
> whether an implementation plan already exists or still needs `make_plan`.

| Order | RD | Title | Depends on | Plan dir | Phase | Status |
|-------|----|-------|-----------|----------|-------|--------|
| 1 | RD-15 | Programmatic + CLI API | RD-01, RD-09, RD-10, RD-11, RD-16 | `codeops/features/blend65-ri/plans/rd-15-programmatic-cli-api/` | A | ✅ COMPLETE (2026-07-03 — 50/50 tasks, 4 phases: host + driver codes + PF-002 rename; the full compile/emitIl/emitAsm/build facade (PF-001 codegen seam); the full `blendc` CLI (yargs, zero-dep color, R50 exit codes); AC-18 no-print enforcement + ST-39; CI ACME + ST-40 real-ACME E2E. AC-01..20 ticked; RD-11 AC-16/10/21 closed. Fixed RD-09 DEF-1 (headerless PRG → `!to`-driven cbm). Full verify + CI green.) |
| 2 | RD-12 | Test harness & emulator verification (incl. RD-17 AC-14 emulator tier — AR-P4) | RD-01, RD-09, RD-10, RD-15, RD-17 | `codeops/features/blend65-ri/plans/rd-12-test-harness/` | A | ✅ COMPLETE (2026-07-03 — 44/44 tasks, 4 phases. `@blend65/test-harness` ships the abstract `EmulatorDriver`, the pure VICE binary-monitor codec (CI byte-exact) + `ViceDriver` (real VICE 3.10), zero-dep PNG, the 3 timeout-guarded strategies, register/memory assertions, R7a registry, `setupEmulator` fixture (+`hasVice`/`hasAcme`), and `assertGolden`. All 16 own ACs ticked with ST evidence; **RD-17 inherited AC-14 discharged on real silicon** (ST-30..33, `__rt_*` math on VICE); DEF-2 closed (Phase 0 `--vicelabels` fix). Gate program pokes $D020 on real VICE (ST-29). Full workspace verify green (17/17 turbo, harness 71 tests). Runtime findings: AR-H18 (`advanceInstructions` 10th driver method), AR-H19 ($D020 reads 0xF5). Local emulator suites `skipIf` in CI (AC-13), run sequentially (`fileParallelism:false`). Earlier: Phase 2 COMPLETE 29/44: the three timeout-guarded run strategies (`runUntilLabel`/`runFrames`/`runUntilMemory`), register/memory assertions (numeric + symbolic), the R7a registry, and the `setupEmulator` fixture (+`hasVice`/`hasAcme`); ST-14..23/28 green (CI fake-driver + real VICE gate). Runtime findings: AR-H18 (added `advanceInstructions` 10th driver method) + AR-H19 (`$D020` reads back `0xF5` not `0x05` — VIC-II unused-nibble; AR-H9 value corrected). Full verify green (test-harness 54 tests). Next: Phase 3 golden/barrel/gate/RD-17 vectors. Earlier: Phase 1 COMPLETE 17/44: `@blend65/test-harness` ships the `EmulatorDriver` interface, the pure VICE binary-monitor codec (byte-exact, live-pinned vs VICE 3.10, CI-tested), the `ViceDriver` (spawn + loopback socket + REGISTERS_AVAILABLE id map, ST-09..13 green on real VICE), and the zero-dep truecolor PNG encoder. compiler dep + codegen devDep + tsconfig refs wired (PF-001). Full verify green. Earlier: Phase 0 — DEF-2 fixed (`--vicelabels` → populated `symbolMap`, oracle green). Next: Phase 2 strategies/assertions/registry/fixture. Earlier: 🔬 Plan Preflighted — preflight iteration 1: 0 critical / 0 major / 2 minor / 2 observation, all 4 fixed & applied; report `plans/rd-12-test-harness/00-preflight-report.md`. Top finding lowered MAJOR→MINOR by a challenger (undeclared `@blend65/codegen` test-scope dep + tsconfig refs — not build-blocking under Yarn hoisting). Also: gate/RD-17 suites skipIf VICE+ACME (PF-002); ST-02 exact addrs → impl smoke, ST-01 keeps DEF-2 oracle (PF-003); runFrames approximation documented (PF-004). DEF-2 re-verified live. Earlier: 📋 Plan Created — 4 phases / 10 sessions / 44 tasks; gate PASSED with 17 items (AR-H1..H17); DEF-2 fixed as Phase 0. Next: exec_plan.) |
| 3 | RD-13 | Non-functional requirements (cross-cutting sweep) | — | ❌ needs `make_plan` | A | ⬜ Not started |
| 4 | RD-14 | VS Code extension & Language Server | RD-03, RD-04 | ❌ needs `make_plan` | B | ⬜ Not started |


> **Why RD-11b leads now (RD-15 preflight PF-001, 2026-07-03):** RD-15's own text consumes
> six RD-11-remainder deliverables that don't exist yet — `SeverityPolicy`, `renderTerminal`,
> `renderJson`, `renderReportTerminal`, `ResourceReport`, and the `SourceMap` registry
> (`core/src/diagnostics/source-span.ts:16` defers it to RD-11b) — and AR-83/AR-84 pin the
> default build summary to the MVP gate, so RD-15 cannot ship without them. RD-11b is
> unblocked today (RD-11a ✅, RD-09 ✅). RD-15 then wires finished pieces into a runnable
> `blendc` (consuming RD-16's config + RD-09's process layer), and RD-12 proves the gate
> program in VICE (including RD-17's deferred AC-14 emulator tier — AR-P4). RD-08's full
> 11-rule optimization catalog remains Phase-B work.
>
> **MVP gate (AR-43/44):** the Phase-A chain (through RD-12) exists to compile the gate
> program — `poke` a constant on c64 → `.prg` → VICE asserts the result — and prove a
> terminating `main`. Slice 2 brings a local `byte` online (SFA + ZP allocator already done).


---

## MVP Critical Path (why this order)

```
RD-07c (finish codegen; consumes RD-10 plugins)
   └── RD-08 (peephole passthrough v1 — completes the Instr pipeline)
         └── RD-09 (Instr stream → ACME .asm → binary)
               └── RD-17 (intrinsics/runtime ABI — the gate `poke` lives here)
                     └── RD-16 (config) → RD-11b (severity policy, renderers, resource reporter)
                           └── RD-15 (CLI/programmatic API to drive the pipeline)
                                 └── RD-12 (emulator verification — proves the gate program runs)
                                       └── RD-13 (non-functional sweep)
Phase B: RD-08 rule catalog (real peephole rules), RD-14 (LSP), additional platforms.
```


---

## Update Protocol

This roadmap MUST NOT drift from the plan headers. Whenever work changes status:

1. When an RD's `codeops/features/blend65-ri/plans/<rd-slug>/99-execution-plan.md` progress
   header reaches **100%**, move its row from **Pending** to **Done** in the same change set.
2. Update **Current Position** (last completed + next up).
3. If a new plan directory is created via `make_plan`, flip that RD's "Plan dir" cell from
   `❌ needs make_plan` to the path.
4. Bump **Last Updated**.
5. Keep the ordering/dependencies consistent with `requirements/README.md`. If they
   diverge, reconcile — `requirements/README.md` owns dependencies; this file owns status.
