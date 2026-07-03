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
> **Last Updated**: 2026-07-03 (RD-11b plan preflight ✅ PASSED WITH NOTES — 6 findings: 4 minor resolved & fixes applied (incl. the RD-11 R51 wording amendment, AR-105 addendum), 2 observations open-optional; `plans/rd-11b-diagnostics-reporting/00-preflight-report.md`; next: exec_plan)


---

## Current Position


- **Last completed**: **RD-16** (compiler configuration, `blend65.json`), executed to 100% on
  2026-07-02 (`codeops/features/blend65-ri/plans/rd-16-compiler-configuration/99-execution-plan.md`,
  36/36 tasks, 4 phases): `@blend65/config` ships `loadConfig()` — walk-up discovery (R4),
  tolerant JSONC parsing via the workspace's first external runtime dep `jsonc-parser@3.3.1`
  (AR-P1, byte-offset conversion PF-017), schema shape + semantic validation over the
  E10240–E10246/W10240–41 band (AR-P3) with synthetic-span dedup survival (AR-P2/PF-019),
  defaults←file←overrides merge (R23–R25), and PF-020 local `hasErrors` tracking. AC-01..AC-14
  all ticked with ST evidence; AC-13 data-only audit PASS; 96 config tests + full workspace
  verify green. One runtime register entry: AR-P10 (BOM strip, provisional — flagged for review).
- **Preflighted**: **RD-11** (diagnostics & resource reporting) requirements preflight
  ✅ PASSED 2026-07-03 — 14 findings (3 major, 7 minor, 4 observations), all
  recommendations accepted and fixes applied (see `requirements/00-preflight-report.md`).
  Highlights: `--report=json` semantics deferred to RD-15 (PF-001); `ResourceReport`
  rebuilt on the shipped `SfaResourceData` with `PeepholeStats` core-resident (PF-002);
  the Ch 11 §6 build-summary layout made normative with render-as-zero staging — runtime
  **AR-102** (PF-003, incl. an RD-15 §4.4 cascade fix); RD-11a/11b split + true deps now
  recorded in the RD header. RD-15's requirements preflight passed earlier the same day
  (10 findings; its PF-001 reordered RD-11b ahead of RD-15).
- **Next up**: **RD-11b** (diagnostics remainder & resource reporter) — dependencies
  RD-11a (✅), RD-09 (✅) all met; its aggregator inputs (`AllocationPlan`, ACME label
  file, profile budgets) are all shipped. Workflow position: **exec_plan** — the
  implementation plan (created 2026-07-03 at
  `codeops/features/blend65-ri/plans/rd-11b-diagnostics-reporting/`, 4 phases /
  12 sessions / 39 tasks; Zero-Ambiguity Gate PASSED with 16 items; plan-gate
  amendments AR-103..AR-105 back-propagated into RD-11 §4.2/§4.6–§4.8) passed its
  plan preflight ✅ WITH NOTES the same day (6 findings: 4 minor resolved per
  recommendation and fixes applied — ST-12 caret span, export-list bookkeeping,
  RD R51 degraded-path wording amendment (AR-105 addendum), gutter-width pinning;
  2 open-optional observations — see `00-preflight-report.md`). RD-15 follows at
  **make_plan** (requirements already preflighted).



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

---

## Status — Pending


> Ordered along the MVP critical path (Phase A first, then Phase B). "Plan dir" shows
> whether an implementation plan already exists or still needs `make_plan`.

| Order | RD | Title | Depends on | Plan dir | Phase | Status |
|-------|----|-------|-----------|----------|-------|--------|
| 1 | RD-11b | Diagnostics remainder & resource reporter (severity policy, renderers, `SourceMap`, `ResourceReport`) | RD-11a (+ RD-09) | `codeops/features/blend65-ri/plans/rd-11b-diagnostics-reporting/` | A | 🔄 Executing (started 2026-07-03) |
| 2 | RD-15 | Programmatic + CLI API | RD-01, RD-09, RD-10, RD-11, RD-16 | ❌ needs `make_plan` | A | 🔎 RD preflighted (2026-07-03) |
| 3 | RD-12 | Test harness & emulator verification (incl. RD-17 AC-14 emulator tier — AR-P4) | RD-01 (+ RD-09, RD-15) | ❌ needs `make_plan` | A | ⬜ Not started |
| 4 | RD-13 | Non-functional requirements (cross-cutting sweep) | — | ❌ needs `make_plan` | A | ⬜ Not started |
| 5 | RD-14 | VS Code extension & Language Server | RD-03, RD-04 | ❌ needs `make_plan` | B | ⬜ Not started |


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
