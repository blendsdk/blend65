# RD-18 Slice 7a — Aggregates (direct surface) Implementation Plan

> **Feature**: Arrays, structs, and enums end-to-end through the direct-addressing surface — typing → SFA → IL → 6502 → data section → real VICE
> **Status**: Planning Complete — preflight passed (13/13 resolved), accepted fixes applied 2026-07-11
> **Created**: 2026-07-11
> **Implements**: blend65-ri/RD-18 (acceptance item 6 — 7a half; closes at 7b)
> **CodeOps Skills Version**: 3.3.1

## Overview

Slices 3a–6 completed the scalar language: types, control flow, functions/modules, and the full
expression system all run on real VICE. Slice 7 brings the aggregate surface — fixed arrays,
structs, enums, `length`/`sizeof`/`offsetof`, and const aggregates baked into the binary's data
section. Per AR-1 it ships in two plans split along the addressing-mode seam: **this plan (7a)**
covers everything reachable with direct absolute/`abs,X` addressing; **7b** follows with the
pointer surface (by-ref aggregate params, const params, tier-2 `(ZP),Y` indexing, unsized array
params).

The recon's headline: the aggregate vocabulary already exists end-to-end (AST, semantic types,
IL ops, addressing modes, const-data channel, intrinsic folds, diagnostic codes) — 7a is mostly
wiring six well-marked seams. The genuinely new work: array-literal parsing (nothing parses
`[1,2,3]` today), the unified lazy const/type engine (mutually recursive array sizes ⇄ struct
layouts ⇄ module consts, with exact path-carrying cycle diagnostics), and the first real data
emission. It also fixes a verified latent defect: bare-name-keyed declaration tables silently
collide across modules.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate — 26 resolved decisions (audit trail) |
| 00 | [Index](00-index.md) | This document |
| 01 | [Requirements](01-requirements.md) | Thin delta view onto RD-18 (in/out of 7a) |
| 02 | [Current State](02-current-state.md) | Recon @ `e1e1bdd`; the six gaps |
| 03-01 | [Parser & Array Literals](03-01-parser-array-literals.md) | `ArrayLitExpr`, fill form, contexts |
| 03-02 | [Declarations & Pass 2](03-02-declarations-pass2.md) | Module-keyed tables (defect fix), validation, type resolution |
| 03-03 | [Const/Type Engine](03-03-const-engine.md) | Unified lazy evaluation, images, cycles |
| 03-04 | [Aggregate Typing](03-04-aggregate-typing.md) | Index/member/literal/enum/switch policy |
| 03-05 | [SFA & Lowering](03-05-sfa-lowering.md) | `lowerPlace`, scaling, init stores, `constData` |
| 03-06 | [Translate & Data](03-06-translate-data.md) | `abs,X` framings, `!byte` streams |
| 03-07 | [Acceptance Fixtures](03-07-acceptance-fixtures.md) | Two-file fixture, golden, VICE, negatives |
| 07 | [Testing Strategy](07-testing-strategy.md) | ST-1..ST-66 spec cases + impl catalog |
| 99 | [Execution Plan](99-execution-plan.md) | 8 phases / 64 tasks |

## Quick Reference

### Usage example (the surface this plan makes real)

```blend65
module Gfx;
export struct Point { x: byte; y: byte; }
export enum Direction { UP, DOWN = 3, LEFT, RIGHT }
export const DIM: byte = 4;
export const TABLE: byte[DIM + sizeof(Point)] = [10, 20, 30; 5];
```

```blend65
module Main;
import { Point, Direction, TABLE } from Gfx;

function main(): void {
  let pts: Point[2] = [Point { x: 1, y: 2 }, Point { x: 3, y: 4 }];
  let i: byte = 1;
  pts[i].x = pts[i].x + length(TABLE);   // scaled runtime index + folded length
  let d: Direction = Direction.DOWN;
  switch (d) { case Direction.DOWN: poke($C003, <byte>(d)); }
}
```

### Key decisions (full table in the register)

| Decision | Outcome |
|----------|---------|
| Slice shape | 7a direct / 7b pointer split (AR-1) |
| Array literals | New parser surface; Ch-08 fill semantics (AR-2/3) |
| Registry contradictions | Chapters win — E10133/E10142/E10141 stay unwired (AR-4) |
| Cycles | One lazy engine, exact path-carrying diagnostics E10165/E10194 (AR-5/6/23) |
| Cross-module types | In 7a, incl. the table-collision defect fix (AR-7) |
| New codes | E10093/E10097/E10117/E10118/E10119/E10120/E10121/E10126/E10156/E10157/E10165/E10230 + W10140/W10141 (AR-13/21/26; E10164→E10097 per PF-008) |
| Scaling & intrinsic typing | Lowering owns index scaling; value-dependent fold typing (AR-15/16) |

## Related Files

- `packages/core`: `ast/node-kind.ts`, `ast/nodes.ts`, `semantics/type-utils.ts`, `semantics/const-value.ts`, `diagnostics/diagnostic-codes.ts`
- `packages/frontend`: `parser/pratt.ts`, `parser/parse-stmt.ts`, `semantics/declaration-collection.ts`, `semantics/const-eval.ts`, `semantics/const-type-engine.ts` (new), `semantics/type-check/*`, `sfa/model-adapter.ts`
- `packages/codegen`: `il/lower.ts`, `instr/translate.ts`, `instr/instr-program.ts`, `instr/print-instr.ts`, `instr/serialize-acme.ts`
- `packages/test-harness`: `src/testing/slice7.ts` (new), `src/slice7*.spec.test.ts` (new), `packages/test-harness/test/golden/slice7.asm.golden` (new — package-local `test/golden/`, NOT repo-root)
- `examples/slice7/{main,gfx}.blend` (new)

**To begin implementation:** use the exec_plan skill on `rd-18-slice-7-aggregates`.
