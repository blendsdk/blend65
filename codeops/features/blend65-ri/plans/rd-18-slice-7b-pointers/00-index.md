# RD-18 Slice 7b — Pointer Surface Implementation Plan

> **Feature**: By-reference struct/array parameters (+ `const` params), unsized array parameters,
> and tier-2 (>256-byte) arrays via `(zp),Y` indirect addressing — completing RD-18 Slice 7
> **Status**: Planning Complete
> **Created**: 2026-07-12
> **Implements**: blend65-ri/RD-18 (slice map row 7 "pointer surface" + acceptance item 6 — closes it)
> **CodeOps Skills Version**: 3.3.1

## Overview

Slice 7a shipped the aggregate DIRECT surface: arrays/structs/enums declared, typed, laid out,
const-imaged, and addressed with absolute / `abs,X` framings. It deliberately left two loud
E90001 rejections marking the pointer tier: aggregate function parameters
(`annotation-resolution.ts:121-131`) and arrays larger than 256 bytes
(`type-check/type-resolution.ts:72-81`). This plan retires both.

7b implements everything that needs a zero-page pointer + `(zp),Y`: struct/array parameters
passed by reference per FN-3 (caller stores the base address into the callee's 2-byte frame
slot; the callee's entry block copies it once into a dedicated, interference-colored ZP pair —
AR-2), the `const` parameter surface (CP-1..5: E10122/E10123, zero runtime cost), unsized array
parameters (`T[]`, byte AND word indexes — AR-5), tier-2 arrays with runtime pointer formation
through one conditionally-reserved scratch pair (AR-4), and the `load_indirect`/`store_indirect`
IL→Instr translation that 7a left as the documented ICE. The slice closes RD-18 acceptance
item 6 under the standard 3-part bar (CI assemble-clean + CI golden + local VICE).

Most of the underlying machinery already ships dark: `Symbol.byRef`, the 2-byte pointer frame
slot rule, the `__zp_ptr_N` pool and `computePeakPointers`, the indirect IL ops with correct
prescan liveness, the `IndirectY` addressing mode, its CPU legality rows, and the ACME
`(sym),Y` rendering. The genuinely new pieces are the parser/typing surface, the IL `addr`
operand (AR-12), the SFA pair binding, the lowering place extension, and the translate framings.

## Document Index

| #   | Document                                            | Description                                       |
| --- | --------------------------------------------------- | ------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)       | Zero-Ambiguity Gate — 14 decisions (audit trail)  |
| 00  | [Index](00-index.md)                                 | This document — overview and navigation           |
| 01  | [Requirements](01-requirements.md)                   | Scope delta view over RD-18                       |
| 02  | [Current State](02-current-state.md)                 | The seams 7a left; shipped-but-dark machinery     |
| 03-01 | [Parser & AST](03-01-parser-params.md)             | `const` params, unsized `T[]`, ParameterNode flag |
| 03-02 | [Param semantics](03-02-param-semantics.md)        | Typing: by-ref types, const rules, tiers, W10112  |
| 03-03 | [SFA pointers](03-03-sfa-pointers.md)              | byRef threading, pair coloring, scratch predicate |
| 03-04 | [Lowering](03-04-lowering-indirect.md)             | `addr` operand, marshalling, prologue, tier-2     |
| 03-05 | [Translate](03-05-translate-indirect.md)           | `(zp),Y` framings, regY mirror, staging, backstop |
| 03-06 | [Acceptance fixtures](03-06-acceptance-fixtures.md)| `examples/slice7b/`, byte contract, goldens       |
| 07  | [Testing Strategy](07-testing-strategy.md)           | ST-cases and verification                         |
| 99  | [Execution Plan](99-execution-plan.md)               | Phases and task checklist                         |

## Quick Reference

### Usage Examples

```blend65
module Main;
import { Enemy, resetEnemy, sum } from Game;

struct Point { x: byte; y: byte; }

let boss: Enemy;
let big: byte[300];              // tier-2 — W10142 advisory

function main(): void {
  resetEnemy(boss);              // by-ref: boss really changes
  big[260] = 7;                  // word index required (E10118 if byte)
  poke($C000, sum(TABLE, length(TABLE)));  // unsized const param
}
```

```blend65
module Game;
export struct Enemy { pos: Point; hp: byte; }
export function resetEnemy(e: Enemy): void { e.hp = 0; }          // by-ref (FN-3)
export function sum(data: const byte[], len: byte): byte { ... }  // const + unsized
```

### Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Pointer placement / calling convention | Frame home + dedicated colored pair + one prologue copy (AR-2, challenger-confirmed) |
| By-ref argument forms | Statically-addressable places + whole pass-through only; the rest ICE loudly (AR-3) |
| Scratch-pair reservation | Hardened conditional predicate + translate ICE backstop (AR-4) |
| Unsized params | `size: null`, byte AND word indexes (AR-5) |
| Const params | `isConst` field + `mutable:false`, one root-symbol predicate (AR-6) |
| New codes | E10122/E10123 registered, W10112/W10142/W10143 minted, E10118 wired (AR-9) |
| IL address form | New `addr` operand kind, store-source-only (AR-12) |

## Related Files

Created: `packages/frontend/src/semantics/…` (param typing extensions), `examples/slice7b/*.blend`,
`packages/test-harness/src/{testing/slice7b.ts, slice7b*.spec.test.ts}`,
`packages/test-harness/test/golden/slice7b.asm.golden`.
Modified: `parse-decl.ts`/`parse-type.ts` (+AST `ParameterNode`), `symbol.ts`/`type.ts`/
`type-utils.ts` (core), `function-collection.ts`, `annotation-resolution.ts`,
`type-check/{type-resolution,expression-typing,statement-typing}.ts`, `sfa/{model-adapter,
zp-allocator,plan-allocation,symbols}.ts`, `codegen/src/il/{operand,lower}.ts`,
`codegen/src/instr/translate.ts`, `diagnostic-codes.ts`.
