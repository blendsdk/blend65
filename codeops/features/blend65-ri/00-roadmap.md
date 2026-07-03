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
> **Last Updated**: 2026-07-03 (RD-15 **exec_plan Phase 1/4 COMPLETE** 🔄 — 11/50 tasks: `@blend65/core` ships the `CompilerHost` interface + host barrel; `@blend65/compiler` ships `DiskCompilerHost` (tinyglobby R47 globs + projectRoot containment + lexicographic sort); driver codes E10250/E10251 added; PF-002 `BuildResult`→`EmitBinaryResult` rename landed with the AR-V5 cross-ref; AR-V2/V20/V21/V22 back-propagated to the requirements register as AR-106..109. Full workspace verify green. Earlier: RD-15 plan **preflighted** 🔬 — iteration 1: 13 findings (3 major/7 minor/3 observation) all resolved on the recommended option & applied to the plan docs; register grew to 22 items (V20 `cwd`, V21 exit-3 ICE band, V22 caret deferral); next: exec_plan. Earlier same day: RD-15 plan created — 4 phases / 13 sessions / 50 tasks, gate PASSED with 19 items. Earlier same day: RD-11b ✅ COMPLETE — exec_plan 39/39 tasks, 4 phases: `SourceMap` registry, severity policy, terminal/JSON diagnostic renderers (Ch 14 §1 goldens + R52 security tier), `ResourceReport` builder + `checkBinaryBudget` + Ch 11 §6 build-summary renderers; RD-11 §6 boxes AC-08/09/11–15/17–20 closed, AC-16 flag half → RD-15; full workspace verify green, core 237 tests; next: RD-15 make_plan)


---

## Current Position


- **Last completed**: **RD-11b** (diagnostics remainder & resource reporter), executed to
  100% on 2026-07-03
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
- **Next up**: **RD-15** (programmatic + CLI API) — workflow position: **plan
  preflighted ✅ — ready for `exec_plan`** (2026-07-03: preflight iteration 1 found
  13 findings — 3 major, 7 minor, 3 observation — all resolved on the recommended
  option and applied to the plan docs; see `plans/rd-15-programmatic-cli-api/00-preflight-report.md`.
  Notable: codegen `assembleProgram` override seam wired for `--startup`/`--out-name`
  (PF-001); `cwd` added to `CompilerOptions` (AR-V20); exit-3 keyed on the `isIceCode`
  band with ACME-not-found→exit 1 (AR-V21)). The implementation plan was created via
  make_plan on 2026-07-03 at
  `codeops/features/blend65-ri/plans/rd-15-programmatic-cli-api/` (4 phases / 13
  sessions / 50 tasks; Zero-Ambiguity Gate PASSED — 19 items V1–V19, one independent
  challenger on the high-stakes cluster, user-ratified). Key gate outcomes: yargs@17
  (no v18 types exist), **zero-dependency CLI color amending requirements AR-17**
  (back-propagation is execution task 1.1.1), tinyglobby for R47 globs, injectable
  `BuildDeps` + skipIf real-ACME E2E + **ACME added to CI**, E10034 via core
  `checkBinaryBudget`, driver codes E10250/E10251. RD-15 also owns the deferred RD-11
  AC-16 flag half (`--quiet`) and the PF-002 `EmitBinaryResult` rename. RD-12
  (emulator tier) follows.



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
| RD-17 | Intrinsics & runtime ABI (all four tiers; AC-14 emulator tier → RD-12, AR-P4/AR-P17) | `codeops/features/blend65-ri/plans/rd-17-intrinsics-runtime-abi/` | ✅ COMPLETE |
| RD-16 | Compiler configuration (`blend65.json` loader) | `codeops/features/blend65-ri/plans/rd-16-compiler-configuration/` | ✅ COMPLETE |
| RD-11b | Diagnostics remainder & resource reporter (`SourceMap`, severity policy, renderers, `ResourceReport`) | `codeops/features/blend65-ri/plans/rd-11b-diagnostics-reporting/` | ✅ COMPLETE |

---

## Status — Pending


> Ordered along the MVP critical path (Phase A first, then Phase B). "Plan dir" shows
> whether an implementation plan already exists or still needs `make_plan`.

| Order | RD | Title | Depends on | Plan dir | Phase | Status |
|-------|----|-------|-----------|----------|-------|--------|
| 1 | RD-15 | Programmatic + CLI API | RD-01, RD-09, RD-10, RD-11, RD-16 | `codeops/features/blend65-ri/plans/rd-15-programmatic-cli-api/` | A | 🔄 Executing (2026-07-03 — Phase 1/4 COMPLETE: 11/50 tasks; core `CompilerHost` + `DiskCompilerHost` + E10250/E10251 + PF-002 `EmitBinaryResult` rename shipped & verified) |
| 2 | RD-12 | Test harness & emulator verification (incl. RD-17 AC-14 emulator tier — AR-P4) | RD-01 (+ RD-09, RD-15) | ❌ needs `make_plan` | A | ⬜ Not started |
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
