# Blend65 Compiler — Status Snapshot

**Date:** 2026-07-12
**Branch:** v3
**Source:** `codeops/features/blend65-ri/00-roadmap.md` (authoritative) + RD-18 requirements

---

## 1. What we have — the 18 requirement documents

| RD | Area | Status |
|----|------|--------|
| RD-01 | Project scaffolding & toolchain | ✅ Complete |
| RD-02 | Lexer | ✅ Complete |
| RD-03 | Parser & AST | ✅ Complete |
| RD-04 | Semantic analysis & type system | ✅ Complete *(scalar+aggregate+pointer scope driven to completion by RD-18 slices)* |
| RD-05 | SFA frame planner & ZP allocator | ✅ Complete |
| RD-06 | IL & IL optimizer (skeleton) | ✅ Complete *(optimizer passes = Phase B)* |
| RD-07a/b/c | Codegen `Instr` model, IL→Instr, platform preamble | ✅ Complete |
| RD-08 | Peephole optimizer | ✅ Complete *(passthrough v1 — real rule catalog is Phase B)* |
| RD-09 | ACME emitter & assembler integration | ✅ Complete |
| RD-10 | Platform plugin system | ✅ Complete |
| RD-11a/b | Diagnostics & resource reporting | ✅ Complete |
| RD-12 | Test harness & emulator (VICE) verification | ✅ Complete |
| RD-15 | Programmatic + CLI API (`blendc`) | ✅ Complete |
| RD-16 | Compiler configuration (`blend65.json`) | ✅ Complete |
| RD-17 | Intrinsics & runtime ABI (all 4 tiers) | ✅ Complete |
| **RD-18** | **Codegen language-feature completion** | **🚧 In progress — 8 of 9 slices done** |
| RD-13 | Non-functional requirements sweep | ⬜ Not started (needs `make_plan`) |
| RD-14 | VS Code extension & Language Server | ⬜ Not started (needs `make_plan`) |

### RD-18 slice breakdown

Vertical-slice rollout that lights up the frozen language, each gated by CI-assemble + CI-golden + real-VICE:

| Slice | Feature surface | Status |
|-------|-----------------|--------|
| 3a | `modelToFunctionInfo` seam | ✅ 21/21 |
| 3b | Scalar type/scope engine | ✅ 45/45 |
| 4a | Conditionals + loops + multi-block CFG keystone | ✅ 35/35 |
| 4b | `switch`/`case`/`default`/`fallthrough` | ✅ 26/26 |
| 5a | Functions/params/calls/recursion/imports | ✅ 46/46 |
| 5b | Module system (merging, qualified access, init order, consts) | ✅ 42/42 |
| 6 | Full expression system + mixed-width promotion | ✅ 52/52 |
| 7a | Arrays/structs/enums — direct addressing | ✅ 64/64 |
| 7b | Pointer surface (by-ref/const params, `(zp),Y`, unsized params) | ✅ 58/58 |
| **8** | **Hardware & advanced** — `&` address-of, `interrupt`, `zeropage {}`, strings/`embed()`, non-terminating `main` | ⬜ **Next (needs `make_plan`)** |

---

## 2. What you can build with it today

Every item below compiles frontend→SFA→IL→6502→ACME→loadable **c64 `.prg`** and is **VICE-verified**:

| Capability | Working today |
|------------|---------------|
| Scalar types | `byte`/`sbyte`/`word`/`sword`; module vars, locals, consts |
| Expressions | Full operator matrix — arithmetic, comparisons, logical (`&&`/`\|\|` with real short-circuit **guarantee**), bitwise, shifts, unary `- ! ~`, casts, ternary, compound assignment, mixed-width promotion |
| Control flow | `if`/`else`, `while`, `do-while`, `for` (`to`/`downto`/`step`), `break`/`continue`, `switch`/`case`/`default`/`fallthrough` |
| Functions | Params, calls, recursion (cycle detection), all-paths-return checking |
| Modules | Multi-file, imports, qualified access, module-var initializers with correct init order, module consts |
| Aggregates | Arrays, structs, enums — literals, indexing (incl. >256-byte arrays via `(zp),Y`), member access, enum dispatch, `sizeof`/`offsetof`/`length` folds, in-image const data |
| Pointers | by-ref & `const` params, unsized array params, runtime pointer formation |
| Intrinsics | `poke`/`pokew`/`lo`/`hi` + runtime math (`__rt_mul8/16`, …) |
| Toolchain | `blendc` CLI, `blend65.json` config, full diagnostics + resource reports, ACME assembly, VICE emulator test harness |

**Not yet buildable:** hardware `interrupt`s, `&` address-of, `zeropage {}` blocks, strings/`embed()` (all → **Slice 8**); optimized codegen (Phase B); editor tooling/LSP (RD-14).

---

## 3. What's next & 4. Distance to the finish line

Foundation is **done** — 17 of 18 RDs complete. Remaining work is **three items**:

| # | Remaining work | Size signal | Path to done |
|---|----------------|-------------|--------------|
| 1 | **RD-18 Slice 8** (last codegen slice: `&`, interrupts, `zeropage`, strings/`embed`) | Comparable to prior large slices (~40–60 tasks) | `make_plan` → preflight → `exec_plan` |
| 2 | **RD-18 rollout closure + security** (items 8–9: tick parent ACs, retire phantom RD-04b, per-slice security verification) | Bookkeeping, follows Slice 8 | Part of / just after Slice 8 |
| 3 | **RD-13** — non-functional sweep (perf, portability, determinism, security, maintainability) | Cross-cutting, moderate | `make_plan` → preflight → `exec_plan` |
| 4 | **RD-14** — VS Code extension + Language Server (diagnostics, completion, hover, go-to-def, symbols) | Largest remaining — a whole new package surface | `make_plan` → preflight → `exec_plan` |

**Finish-line read:** the hard part is behind. The compiler is functionally complete for the whole non-hardware language and produces verified running c64 binaries. What's left:

- **Slice 8** finishes the *language*.
- **Slice 8 + RD-13** finishes the *compiler*.
- **RD-14** finishes the *product* (editor tooling) — the heaviest single remaining chunk.

Three planned slices/RDs stand between here and the end.
