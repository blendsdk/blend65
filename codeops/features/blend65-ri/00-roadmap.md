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
> **Last Updated**: 2026-07-02 15:25


---

## Current Position


- **Last completed**: **RD-09** (ACME emitter & assembler integration). Plan preflight ✅ PASS
  (2026-06-10; AR-95 + AR-96 runtime resolved), executed to 100%
  (`codeops/features/blend65-ri/plans/rd-09-acme-emitter/99-execution-plan.md`, 25/25 tasks): `serializeToAcme` (the single
  canonical whole-program serializer, `@blend65/codegen`) + the `@blend65/compiler` ACME process
  layer (`discoverAcme`, `parseLabelFile`, `invokeAcme`, `emitBinary` with the post-ACME
  `E10034` budget check), new `DiagCode.AcmeNotFound` (E10035), ST-AG1 migrated to the canonical
  serializer (AR-95/A), all spec + impl tiers green, full verify passing.
- **Next up**: **RD-17** (intrinsics & runtime ABI) — declared dependencies RD-04 (✅), RD-10 (✅);
  the MVP gate `poke` lives here. **RD preflight ✅ PASSED 2026-07-02** (13 findings resolved,
  runtime AR-97..AR-101). **Plan created 2026-07-02**
  (`codeops/features/blend65-ri/plans/rd-17-intrinsics-runtime-abi/`, 6 phases / 47 tasks,
  gate register AR-P1..P14 passed). Workflow position:
  ~~preflight~~ → ~~make_plan~~ → **preflight (plan)** → exec_plan.



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

---

## Status — Pending


> Ordered along the MVP critical path (Phase A first, then Phase B). "Plan dir" shows
> whether an implementation plan already exists or still needs `make_plan`.

| Order | RD | Title | Depends on | Plan dir | Phase | Status |
|-------|----|-------|-----------|----------|-------|--------|
| 1 | RD-17 | Intrinsics & runtime ABI | RD-04, RD-10 | `codeops/features/blend65-ri/plans/rd-17-intrinsics-runtime-abi/` | A | 📋 Plan created (2026-07-02) |
| 2 | RD-16 | Compiler configuration (`blend65.json`) | RD-01 | ❌ needs `make_plan` | A | ⬜ Not started |
| 3 | RD-15 | Programmatic + CLI API | RD-01 (+ RD-09, RD-16) | ❌ needs `make_plan` | A | ⬜ Not started |
| 4 | RD-12 | Test harness & emulator verification | RD-01 (+ RD-09, RD-15) | ❌ needs `make_plan` | A | ⬜ Not started |
| 5 | RD-11b | Resource reporter (RD-11 remainder) | RD-11a (+ RD-09) | ❌ needs `make_plan` | A | ⬜ Not started |
| 6 | RD-13 | Non-functional requirements (cross-cutting sweep) | — | ❌ needs `make_plan` | A | ⬜ Not started |
| 7 | RD-14 | VS Code extension & Language Server | RD-03, RD-04 | ❌ needs `make_plan` | B | ⬜ Not started |


> **Why RD-17 leads now:** RD-09 (ACME emitter) is ✅ done, so the `Instr` stream now reaches a
> runnable binary. RD-17 (intrinsics & runtime ABI) is next on the MVP critical path — the gate
> program's `poke` intrinsic lives here, and its declared dependencies RD-04/RD-10 are both ✅.
> RD-08's full 11-rule optimization catalog remains genuine Phase-B work to be layered in later.
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
                     └── RD-16 + RD-15 (config + CLI/programmatic API to drive the pipeline)
                           └── RD-12 (emulator verification — proves the gate program runs)
                                 └── RD-11b (resource reporter / build summary)
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
