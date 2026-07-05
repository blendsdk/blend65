# RD-18 Slice 3a — Model-Seam Proof — Implementation Plan

> **Feature**: Wire a *populated* `SemanticModel` through the `modelToFunctionInfo` seam so the SFA
> planner emits real `__frame_*` symbols and the existing gate + one local `byte` assemble → PRG →
> VICE through the real model path.
> **Status**: Planning Complete
> **Created**: 2026-07-05
> **Implements**: blend65-ri/RD-18 (Slice 3a)
> **CodeOps Skills Version**: 3.2.0

## Overview

The Blend65 compiler is a walking skeleton at "slice 2": every pipeline stage exists, but the
semantic analyzer returns an **empty** `SemanticModel`, so `modelToFunctionInfo` returns `[]`, the
SFA planner is starved of `FunctionInfo`, and nothing beyond the constant-`poke` gate assembles.
The entire downstream — SFA passes, `__frame_*` symbol generation, ACME serialization, PRG build,
and the RD-12 VICE harness — is already implemented and wired; the **only** stub is the single
`modelToFunctionInfo` seam (`model-adapter.ts:34`) plus the empty-model `analyze()` upstream.

Slice 3a is the **keystone** of the RD-18 vertical-slice rollout: it proves the model→SFA→symbol→
ACME→PRG→VICE path end-to-end with the smallest possible real payload — one function (`main`) with
one local `byte`. It does exactly three things: (1) populate a **minimal real** `SemanticModel`
(per-module scopes + function symbols declared in them + ordered locals in function body scopes +
`mainFunction`) as a reusable slice of RD-04 Pass 1; (2) implement `modelToFunctionInfo` to project
that model into `FunctionInfo[]` (deriving the FQN module from `fn.scope.node.name`, AR-13); (3) add a
`.blend` example and the three-part per-slice acceptance bar (CI assemble-clean + CI ASM golden +
local VICE runtime). No new language rules, no new diagnostic codes, no parked questions, no `spec/`
edits — pure plumbing that de-risks the type engine (Slice 3b) behind a proven seam.

When 3a lands, the empty-model starvation is gone: any program whose surface is already lowerable
(local `byte` declare/read/assign, same-width arithmetic, `poke`/`peek`) assembles the moment the
model carries its functions and locals — because IL lowering is already name-and-frame-keyed
(`lower.ts` resolves locals via `frameSymbol(fqName, name)` + the SFA `FunctionFrame`), not
model-keyed.

## Document Index

| #   | Document                                                     | Description                                     |
| --- | ------------------------------------------------------------ | ----------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)               | Zero-Ambiguity Gate decisions (audit trail)     |
| 00  | [Index](00-index.md)                                         | This document — overview and navigation         |
| 01  | [Requirements](01-requirements.md)                           | Slice 3a requirements and scope                 |
| 02  | [Current State](02-current-state.md)                         | The seam today + starved-SFA analysis           |
| 03-01 | [Model Population](03-01-model-population.md)               | `function-collection.ts` + `analyze()` wiring   |
| 03-02 | [Model Adapter](03-02-model-adapter.md)                    | `modelToFunctionInfo` projection                |
| 03-03 | [Acceptance Fixtures](03-03-acceptance-fixtures.md)       | `.blend` example, ASM golden, VICE, gate re-mint |
| 07  | [Testing Strategy](07-testing-strategy.md)                   | Spec test cases (ST-*) and verification         |
| 99  | [Execution Plan](99-execution-plan.md)                       | Phases, sessions, and task checklist            |

## Quick Reference

### Usage Example — the Slice 3a fixture (AR-2)

```blend
module Main;
function main(): void {
    let x: byte = 5;
    poke(0xD020, x);   // read the local's frame slot into the VIC-II border register
}
```

After Slice 3a this compiles through the real populated-model path to a loadable c64 PRG whose
symbol block contains `__frame_Main_main` (base) and `__frame_Main_main_x` (slot); VICE asserts
`$D020 == 0xF5`.

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| Plan scope | Slice 3a only | AR-1 |
| Acceptance fixture | Use-the-local (`let x:byte=5; poke($D020,x)`) | AR-2 |
| Verify command | Full workspace verify | AR-3 |
| Adapter source | Reads the populated model, never the AST | AR-4 |
| Population home | Reusable RD-04 Pass-1 slice in new `function-collection.ts`; extended by 3b | AR-5 |
| Local ordering | `Scope.symbols` Map insertion order | AR-6 |
| `FunctionInfo.name` | `"<Module>.<function>"` (`Main.main`) | AR-7 |
| Gate golden | Re-minted (gains `__frame_Main_main`) + VICE re-verified | AR-8 |
| FQN module carrier | Build a per-module `Scope`; adapter reads `fn.scope.node.name` (model-only, no core change) | AR-13 |

## Related Files

**Modified**
- `packages/frontend/src/semantics/analyze.ts` — invoke `collectFunctions` alongside `collectDeclarations`; assemble the populated model (PF-002 — `passes.ts` untouched)
- `packages/frontend/src/sfa/model-adapter.ts` — implement `modelToFunctionInfo`
- `packages/test-harness/test/golden/gate.asm.golden` — re-minted (adds `__frame_Main_main`)
- existing `analyze`/`passes` tests that assumed the empty-population passthrough (AR-9)

**Created**
- `packages/frontend/src/semantics/function-collection.ts` — the Pass-1 module-scope + function/local collector (AR-13)
- `packages/frontend/src/semantics/function-collection.spec.test.ts` / `.impl.test.ts`
- `packages/frontend/src/sfa/model-adapter.spec.test.ts` / `.impl.test.ts`
- `examples/slice3a/main.blend` — the local-byte fixture
- `packages/test-harness/test/golden/slice3a.asm.golden` — the fixture's ASM golden
- `packages/test-harness/src/slice3a.spec.test.ts` — assemble-clean + VICE (local)
- `packages/test-harness/src/golden-slice3a.spec.test.ts` — ASM golden (CI)
