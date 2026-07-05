# RD-18 Slice 3b — Scalar Type Engine — Implementation Plan

> **Feature**: Build the RD-04 scalar type engine (real Passes 1/3/4 for scalars) + module-level
> scalar allocation + width-aware lowering, so a program using local **and** module-level scalars
> with same-type `+ - * / %`, `=`, and `peek`/`poke(w)` compiles and VICE-verifies a computed result,
> and mixed-signedness is rejected with **E10081**.
> **Status**: Planning Complete · Preflight ✅ PASSED (2026-07-05, `00-preflight-report.md`; AR-11 code-reconciliation applied)
> **Created**: 2026-07-05
> **Implements**: blend65-ri/RD-18 (Slice 3b)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 3b row + AC-2)
> **CodeOps Skills Version**: 3.2.0

## Overview

Slice 3a proved the **seam** (a populated `SemanticModel` flows model→SFA→symbol→ACME→PRG→VICE) with
one local `byte`. Slice 3b is the RD-18 **tent-pole**: it builds the scalar **type engine** on top of
that seam — roughly 20 RD-04 requirements across Passes 1/3/4 — and widens the working surface to
local **and module-level** scalars (`byte`/`sbyte`/`word`/`sword`/`boolean`), same-type `+ - * / %`,
assignment, and `peek`/`poke(w)`.

Current-state recon (three parallel agents, 2026-07-05) established that Slice 3b is mostly a
**semantic-analysis + wiring** problem, not a codegen rebuild:

- **Codegen already lowers + translates** the whole 3b statement/expression surface end-to-end:
  `let`, `=`, `return`, same-width `+ - * / %` (with `*`/`/`/`%` routed to `__rt_mul8/div8/mul16/div16`),
  `peek`/`poke`/`pokew`/`peekw`, const `lo`/`hi`. The **one** codegen gap is width: `lowerNumericLit`
  hardcodes `IL_BYTE` (`lower.ts:262`), so word literals aren't width-aware until lowering consumes the
  model's `typeMap`.
- **SFA module-variable infrastructure already exists and is unit-tested** (`ModuleVariableAllocation`,
  `layoutModuleVariables`, `__var_*` emission, `AllocationPlan.moduleVariables`); it is simply never
  fed — `run-frontend.ts:158` hardcodes `moduleVars: []`.
- **The type engine does not exist**: `isAssignableTo`→`true` / `commonType`→`null` are stubs; there is
  **no** expression/literal typing; `typeMap`/`symbolMap` are empty; top-level `let`/`const`
  variables are collected nowhere. This is the bulk of the build.

Per the Zero-Ambiguity Gate (see the [Ambiguity Register](00-ambiguity-register.md)), Slice 3b is
scoped **same-type only** (widening/casts/promotion → Slice 6), module vars are **declared + assigned
in-body** (initializers deferred), signed `*`/`/`/`%` is out-of-surface (unsigned fixture), and the
RAM region stays within the proven-safe `$0800–$080C` dead-BASIC-stub shadow (the `>13-byte`
variable/code collision is a documented, deferred memory-layout fix).

## Document Index

| #   | Document                                                        | Description                                        |
| --- | -------------------------------------------------------------- | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                  | Zero-Ambiguity Gate decisions (AR-1..AR-11) ✅      |
| 01  | [Requirements](01-requirements.md)                              | Functional requirements + scope (from RD-18 AC-2)  |
| 02  | [Current State](02-current-state.md)                            | Recon: what exists vs must-build across 4 stages   |
| 03-01 | [Type Engine](03-01-type-engine.md)                           | Pass 3 typing + Pass 4 `main()` + minimal const-eval |
| 03-02 | [Module-Level Scalars](03-02-module-scalars.md)               | Pass 1 collection + `modelToModuleVars` + SFA feed |
| 03-03 | [Width-Aware Lowering](03-03-width-aware-lowering.md)         | `typeMap`→`LowerCtx`; word literals; `__var_*` lowering |
| 03-04 | [Acceptance Fixtures](03-04-acceptance-fixtures.md)          | Fixture + 3-part bar (assemble-clean/golden/VICE)  |
| 07  | [Testing Strategy](07-testing-strategy.md)                      | Specification test cases (ST-*) + verification     |
| 99  | [Execution Plan](99-execution-plan.md)                          | 5 phases, task checklist, Master Progress Checklist |

## The three-part acceptance bar (RD-18, per slice)

1. **CI assemble-clean** — the fixture builds through ACME to a loadable c64 PRG with zero undefined symbols.
2. **CI golden** — a committed `--emit-asm` golden (`assertGolden`), emulator-independent.
3. **Local VICE** — `skipIf(!(hasVice && hasAcme))`; asserts the exact computed bytes at `$C000–$C002`.

## Parent ACs this slice advances

- **RD-18 AC-2** (Slice 3b) — the whole slice.
- **RD-04** AC-02 (gate typing), AC-03 (E10100), AC-05 (E10081 mixed-sign), AC-06 (E10152 assign),
  AC-08 (E10020/E10021 main), AC-14 (`typeMap` correctness, scalar subset) — ticked as the checks land.
- **RD-04 deferred ledger** rows R7–R16, R30/R31→same-type, R36, R44–R49, R54, R61, R63, R66, R80–R81, R114.
