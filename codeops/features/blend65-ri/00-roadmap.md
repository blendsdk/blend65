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
> **Last Updated**: 2026-07-17
>
> Full per-slice/per-phase history — preflight findings, ambiguity-register decisions, and
> phase narratives — lives in the plan directories under `plans/`, the completed-plan
> archive `codeops/_archive/`, and git history. This file keeps only the current position,
> a short milestone log, and the status tables.

## Current status

**RD-18 Slice 7b ✅ COMPLETE (2026-07-12, exec_plan 58/58) — SLICE 7 CLOSED, RD-18 acceptance
item 6 ticked.** The pointer surface ships end-to-end: by-ref struct/array params (caller stores
the address into the callee's 2-byte frame home; SFA chain-max-colors per-param
`__zp_ptr_<Module_fn>_<param>` pairs over the dormant pool + one-time prologue frame→pair copy;
dead/pass-through params skip both), `const` params (E10122/E10123), unsized array params
(`ArrayType.size: null`, both index widths, `length()`→E10080) + element-list size inference
(E10126 otherwise), tier-2 >256-byte arrays via `(zp),Y` with runtime pointer formation through
the conditional `__zp_ptr_scratch`, the IL `addr` operand (store source + ALU right operand), and
the translate `(zp),Y` framings + regY mirror. 3-part bar GREEN on real VICE 3.10 first run:
`examples/slice7b/` → `$C000..$C006 = 00 2A 0F 1D 11 0B 16`; 212-line golden; nine prior goldens
byte-exact. **Next: Slice 8 was split 8a/8b at its gate (2026-07-17) — the 8a hardware plan is
authored and PREFLIGHTED 🔬 (`plans/rd-18-slice-8-hardware/`, 29-row register + preflight
amendments, 60 tasks; 17-finding preflight resolved 2026-07-17, see its
`00-preflight-report.md`): exec_plan 8a next; 8b (strings/encoding + `embed()`, carries RD-18
closure) needs `make_plan` after; RD-13/RD-14 queued.**

## Recent milestones

- 2026-07-17 — **RD-18 Slice 8a plan preflighted 🔬** — 17 findings resolved (incl. the AR-15
  mainline-root-set fix without which `irqOnly` was empty in every real program, the call-free
  init-parity correction, and the aggregate-initializer parser fix); plan hardened to 60 tasks.
- 2026-07-17 — **RD-18 Slice 8 gate** — split 8a/8b; 8a hardware plan created (`make_plan`, 29-row
  register — incl. the $0314→raw-vector fixture correction and two SFA interrupt-path miscompile fixes).
- 2026-07-12 — **RD-18 Slice 7b ✅** (58/58) — pointer surface; SLICE 7 CLOSED, RD-18 item 6 ticked.
- 2026-07-12 — **RD-18 Slice 7a ✅** (64/64) — aggregates (arrays/structs/enums), direct addressing.
- 2026-07-11 — **RD-18 Slice 6 ✅** (52/52) — full expression system + mixed-width promotion; closes AC-5.
- 2026-07-11 — **RD-18 Slice 5b ✅** (42/42) — module system (merging, qualified access, init order, consts); closes AC-4.
- 2026-07-10 — **RD-18 Slice 5a ✅** (46/46) — functions/params/calls/recursion/imports; data base `$0800`→`$2000`.
- 2026-07-07 — **RD-18 Slice 4b ✅** (26/26) — `switch`/`case`/`fallthrough`; closes AC-3.
- 2026-07-07 — **RD-18 Slice 4a ✅** (35/35) — conditionals + loops + first multi-block CFG keystone.
- 2026-07-06 — **RD-18 Slice 3b ✅** (45/45) — scalar type/scope engine end-to-end.
- 2026-07-05 — **RD-18 Slice 3a ✅** (21/21) — `modelToFunctionInfo` model seam.
- 2026-07-03 — **RD-12 ✅** (44/44) test harness/VICE · **RD-15 ✅** (50/50) CLI/API · **RD-11b ✅** (39/39) diagnostics remainder.

---

## Current Position

- **Active**: **RD-18** (codegen language-feature completion) — a thin vertical-slice rollout
  that lights up the frozen language, each slice gated by CI assemble-clean + CI golden + local
  VICE. Slices 3a/3b/4a/4b/5a/5b/6/7a/7b ✅ complete (Slice 7 closed, RD-18 item 6 ticked).
  **Slice 8** (the last codegen slice) is split 8a/8b: **8a hardware** (`&` address-of, `interrupt`
  functions, `zeropage {}` blocks, non-terminating `main`, T1 E2E) — 🔬 plan preflighted
  (`plans/rd-18-slice-8-hardware/`, 60 tasks); **8b data** (strings/encoding, `embed()`, RD-18
  closure) — needs `make_plan`.
- **Last completed non-RD-18 work**: **RD-12** (test harness & emulator verification) and
  **RD-15** (programmatic + CLI API), both 2026-07-03. The full pipeline compiles
  frontend→SFA→IL→6502→ACME→loadable c64 `.prg` and is VICE-verified; `blendc` ships with config,
  diagnostics, and resource reports.
- **Next up**: RD-18 Slice 8a — 🔄 EXECUTING (exec_plan started 2026-07-17), then Slice 8b (`make_plan`), then **RD-13**
  (non-functional sweep) and **RD-14** (VS Code extension & Language Server) — both need `make_plan`.

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
> directory clean. The `Plan dir` paths below point at their current locations.

| RD | Title | Plan dir | Status |
|----|-------|----------|--------|
| RD-01 | Project scaffolding & toolchain | `codeops/_archive/rd-01-project-scaffolding-toolchain/` | ✅ COMPLETE |
| RD-02 | Lexer | `codeops/_archive/rd-02-lexer/` | ✅ COMPLETE |
| RD-03 | Parser & AST | `codeops/_archive/rd-03-parser-ast/` | ✅ COMPLETE |
| RD-04 | Semantic analysis & type system | `codeops/_archive/rd-04-semantic-analysis/` | ✅ COMPLETE *(scalar+aggregate+pointer scope driven to completion by the RD-18 slices; see `08-deferred-semantics-ledger.md`)* |
| RD-05 | SFA frame planner & ZP allocator | `codeops/_archive/rd-05-sfa-frame-planner/` | ✅ COMPLETE *(RD-18 Slice 3a implemented `modelToFunctionInfo` for populated models; empty model still → `[]`)* |
| RD-06 | IL & IL optimizer (walking-skeleton slice) | `codeops/_archive/rd-06-il-optimizer/` | ✅ COMPLETE *(IL core + multi-block CFG done by RD-18; IL-optimizer passes = Phase B)* |
| RD-07a | Structured `Instr` model | `codeops/_archive/rd-07a-instr-model/` | ✅ COMPLETE |
| RD-07b | IL→Instr live-op-set slice | `codeops/_archive/rd-07b-il-to-instr/` | ✅ COMPLETE |
| RD-07c | Codegen platform preamble (Half A) | `codeops/_archive/rd-07c-codegen-platform-preamble/` | ✅ COMPLETE |
| RD-10 | Platform plugin system (slice) | `codeops/_archive/rd-10-platform-plugin-system/` | ✅ COMPLETE |
| RD-11a | Diagnostics core | `codeops/_archive/rd-11a-diagnostics-core/` | ✅ COMPLETE |
| RD-08 | Peephole optimizer (passthrough v1; real rule catalog = Phase B) | `codeops/features/blend65-ri/plans/rd-08-peephole-optimizer/` | ✅ COMPLETE |
| RD-09 | ACME emitter & assembler integration | `codeops/features/blend65-ri/plans/rd-09-acme-emitter/` | ✅ COMPLETE |
| RD-17 | Intrinsics & runtime ABI (all four tiers; AC-14 emulator tier discharged by RD-12 on real VICE) | `codeops/features/blend65-ri/plans/rd-17-intrinsics-runtime-abi/` | ✅ COMPLETE |
| RD-16 | Compiler configuration (`blend65.json` loader) | `codeops/features/blend65-ri/plans/rd-16-compiler-configuration/` | ✅ COMPLETE |
| RD-11b | Diagnostics remainder & resource reporter (`SourceMap`, severity policy, renderers, `ResourceReport`) | `codeops/features/blend65-ri/plans/rd-11b-diagnostics-reporting/` | ✅ COMPLETE |
| RD-15 | Programmatic + CLI API (`compile`/`emitIl`/`emitAsm`/`build` facade + `blendc`) | `codeops/features/blend65-ri/plans/rd-15-programmatic-cli-api/` | ✅ COMPLETE (2026-07-03, 50/50) |
| RD-12 | Test harness & emulator verification (VICE) | `codeops/features/blend65-ri/plans/rd-12-test-harness/` | ✅ COMPLETE (2026-07-03, 44/44) |

---

## Status — Pending

> Ordered along the MVP critical path (Phase A first, then Phase B). "Plan dir" shows
> whether an implementation plan already exists or still needs `make_plan`.

| Order | RD | Title | Depends on | Plan dir | Phase | Status |
|-------|----|-------|-----------|----------|-------|--------|
| 1 | RD-18 | Codegen language-feature completion (thin vertical-slice rollout, whole frozen language, _unoptimized_) | RD-04, RD-05, RD-06, RD-07, RD-09, RD-10, RD-11, RD-12, RD-17 | `plans/rd-18-slice-*/` — 3a–7b ✅, 8a `rd-18-slice-8-hardware/` 🔬, 8b needs `make_plan` | A→B | 🚧 In progress — Slices 3a–7b ✅ (Slice 7 closed, item 6 ticked); Slice 8 (last) split 8a hardware 🔬 preflighted (60 tasks) / 8b data needs `make_plan` |
| 2 | RD-13 | Non-functional requirements (cross-cutting sweep) | — | ❌ needs `make_plan` | A | ⬜ Not started |
| 3 | RD-14 | VS Code extension & Language Server | RD-03, RD-04 | ❌ needs `make_plan` | B | ⬜ Not started |

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
                                       └── RD-18 (codegen language completion, sliced)
                                             └── RD-13 (non-functional sweep)
Phase B: RD-08 rule catalog (real peephole rules), RD-14 (LSP), additional platforms.
```

The MVP gate (Phase A through RD-12) exists to compile the gate program — `poke` a constant on
c64 → `.prg` → VICE asserts the result — and prove a terminating `main`. RD-18 then lights up the
rest of the frozen language, slice by slice, over that proven pipeline.

---

## Update Protocol

This roadmap MUST NOT drift from the plan headers. Whenever work changes status:

1. When an RD's `codeops/features/blend65-ri/plans/<rd-slug>/99-execution-plan.md` progress
   header reaches **100%**, move its row from **Pending** to **Done** in the same change set.
2. Update **Current status**, **Recent milestones**, and **Current Position**.
3. If a new plan directory is created via `make_plan`, flip that RD's "Plan dir" cell from
   `❌ needs make_plan` to the path.
4. Bump **Last Updated**.
5. Keep the ordering/dependencies consistent with `requirements/README.md`. If they
   diverge, reconcile — `requirements/README.md` owns dependencies; this file owns status.
