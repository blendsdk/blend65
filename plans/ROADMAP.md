# Blend65 Compiler — Implementation Roadmap

> **Purpose**: The single living tracker of *what is implemented* and *what comes next*
> for the Blend65 compiler (`blendc`). This is the implementation counterpart to
> `requirements/README.md` (the RD index) and `spec/build-plan.md` (the spec build plan,
> already complete).
>
> **This file lives at `plans/ROADMAP.md` and is authoritative for implementation status.**
> It is governed by the mandatory rule `.clinerules/roadmap.md` — read it at the start of
> every task and update it whenever an RD reaches 100%.
>
> **Last Updated**: 2026-06-10

---

## Current Position

- **Last completed**: RD-07c (codegen platform preamble — Half A; uncommitted pending user `git`).
- **Next up**: **RD-09** (ACME emitter & assembler integration) — needs `make_plan`, then preflight.

---

## Per-RD Workflow (mandatory sequence)

Every RD is taken through this exact sequence:

```
preflight  →  make_plan  →  preflight  →  exec_plan
```

1. **preflight** — validate the RD requirements document against the preflight checklist
   (`requirements/01-preflight-checklist.md`) *before* planning. Verdict must be PASS.
2. **make_plan** — author the implementation plan under `plans/<rd-slug>/` (only if no plan
   directory exists yet; otherwise review/refresh the existing plan).
3. **preflight** — re-run preflight against the *authored plan* to confirm it is coherent
   and complete before any code is written. Verdict must be PASS.
4. **exec_plan** — execute the plan phase-by-phase (spec-tests-first), updating the plan's
   `99-execution-plan.md` progress header as each task lands.

When `exec_plan` reaches 100%, **update this roadmap** (see Update Protocol below).

---

## Status — Done

> Completed plans are archived under `plans/_archive/` to keep the active `plans/`
> directory clean. The `Plan dir` paths below point at their archived locations.

| RD | Title | Plan dir | Status |
|----|-------|----------|--------|
| RD-01 | Project scaffolding & toolchain | `plans/_archive/rd-01-project-scaffolding-toolchain/` | ✅ COMPLETE |
| RD-02 | Lexer | `plans/_archive/rd-02-lexer/` | ✅ COMPLETE |
| RD-03 | Parser & AST | `plans/_archive/rd-03-parser-ast/` | ✅ COMPLETE |
| RD-04 | Semantic analysis & type system | `plans/_archive/rd-04-semantic-analysis/` | ✅ COMPLETE |
| RD-05 | SFA frame planner & ZP allocator | `plans/_archive/rd-05-sfa-frame-planner/` | ✅ COMPLETE |
| RD-06 | IL & IL optimizer (walking-skeleton slice) | `plans/_archive/rd-06-il-optimizer/` | ✅ COMPLETE |
| RD-07a | Structured `Instr` model | `plans/_archive/rd-07a-instr-model/` | ✅ COMPLETE |
| RD-07b | IL→Instr live-op-set slice | `plans/_archive/rd-07b-il-to-instr/` | ✅ COMPLETE |
| RD-07c | Codegen platform preamble (Half A) | `plans/_archive/rd-07c-codegen-platform-preamble/` | ✅ COMPLETE (uncommitted) |
| RD-10 | Platform plugin system (slice) | `plans/_archive/rd-10-platform-plugin-system/` | ✅ COMPLETE (uncommitted) |
| RD-11a | Diagnostics core | `plans/_archive/rd-11a-diagnostics-core/` | ✅ COMPLETE |

---

## Status — Pending

> Ordered along the MVP critical path (Phase A first, then Phase B). "Plan dir" shows
> whether an implementation plan already exists or still needs `make_plan`.

| Order | RD | Title | Depends on | Plan dir | Phase | Status |
|-------|----|-------|-----------|----------|-------|--------|
| 1 | RD-09 | ACME emitter & assembler integration | RD-07, RD-08, RD-10 | ❌ needs `make_plan` | A | ⬜ Not started |
| 2 | RD-17 | Intrinsics & runtime ABI | RD-04, RD-10 | ❌ needs `make_plan` | A | ⬜ Not started |
| 3 | RD-16 | Compiler configuration (`blend65.json`) | RD-01 | ❌ needs `make_plan` | A | ⬜ Not started |
| 4 | RD-15 | Programmatic + CLI API | RD-01 (+ pipeline) | ❌ needs `make_plan` | A | ⬜ Not started |
| 5 | RD-12 | Test harness & emulator verification | RD-01 | ❌ needs `make_plan` | A | ⬜ Not started |
| 6 | RD-11b | Resource reporter (RD-11 remainder) | RD-11a | ❌ needs `make_plan` | A | ⬜ Not started |
| 7 | RD-13 | Non-functional requirements (cross-cutting sweep) | — | ❌ needs `make_plan` | A | ⬜ Not started |
| 8 | RD-08 | Peephole optimizer | RD-07 | ❌ needs `make_plan` | B | ⬜ Not started |
| 9 | RD-14 | VS Code extension & Language Server | RD-03, RD-04 | ❌ needs `make_plan` | B | ⬜ Not started |

> **MVP gate (AR-43/44):** the Phase-A chain (through RD-12) exists to compile the gate
> program — `poke` a constant on c64 → `.prg` → VICE asserts the result — and prove a
> terminating `main`. Slice 2 brings a local `byte` online (SFA + ZP allocator already done).

---

## MVP Critical Path (why this order)

```
RD-07c (finish codegen; consumes RD-10 plugins)
   └── RD-09 (Instr stream → ACME .asm → binary)
         └── RD-17 (intrinsics/runtime ABI — the gate `poke` lives here)
               └── RD-16 + RD-15 (config + CLI/programmatic API to drive the pipeline)
                     └── RD-12 (emulator verification — proves the gate program runs)
                           └── RD-11b (resource reporter / build summary)
                                 └── RD-13 (non-functional sweep)
Phase B: RD-08 (peephole), RD-14 (LSP), additional platforms.
```

---

## Update Protocol

This roadmap MUST NOT drift from the plan headers. Whenever work changes status:

1. When an RD's `plans/<rd-slug>/99-execution-plan.md` progress header reaches **100%**,
   move its row from **Pending** to **Done** in the same change set.
2. Update **Current Position** (last completed + next up).
3. If a new plan directory is created via `make_plan`, flip that RD's "Plan dir" cell from
   `❌ needs make_plan` to the path.
4. Bump **Last Updated**.
5. Keep the ordering/dependencies consistent with `requirements/README.md`. If they
   diverge, reconcile — `requirements/README.md` owns dependencies; this file owns status.
