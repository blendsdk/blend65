# RD-18 Slice 5a — User Functions, Parameters & Calls — Implementation Plan

> **Feature**: Build user-defined functions end-to-end — parameter collection + call typing
> (arg count/type, not-callable, interrupt-call, main-call), return-statement completion,
> the call graph + recursion rejection (one E10174 per cycle), minimal cross-module imported
> calls (E10012), the SFA parameter/callee feed (params-first frames, argument-window
> interference), and the SFA calling convention in codegen (caller stores args into the
> callee's static frame → `JSR` → result in A/A:X) — so a multi-function, two-module program
> compiles and VICE-verifies computed results. Module merging, `Module.fn` qualified access,
> and module-var initializers + init order (E10194) are Slice 5b (AR-1/AR-15); RD-18 AC-4
> closes there.
> **Status**: Planning Complete · Zero-Ambiguity Gate ✅ PASSED (2026-07-10, `00-ambiguity-register.md`; AR-1…AR-16)
> **Created**: 2026-07-10
> **Implements**: blend65-ri/RD-18 (Slice 5a — the calling-convention half of the Slice-5 row; AC-4 partial, closes at 5b)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 5 row; AC-4)
> **CodeOps Skills Version**: 3.3.1

## Overview

Slice 4a/4b shipped the multi-block CFG keystone; every prior slice program is a single
`main()`. Slice 5a turns on **user functions**. Three-agent recon (2026-07-10) established
that the machinery is far closer than the RD-18 row suggests:

- **SFA is complete and starved.** Params-first frame layout, by-ref slot sizing, the
  call-graph interference graph, interval frame coloring, and stack analysis all exist and
  are fixture-tested (`packages/frontend/src/sfa/`, `packages/core/src/sfa/`) — but
  `modelToFunctionInfo` hardcodes `parameters: []` and `callees: []`
  (`model-adapter.ts:50,55`).
- **Codegen is 90% done.** The IL `call` op + `ret` terminator exist (`instruction.ts:51,
  126-132,163`); the callee-side return ABI (value → A/A:X, `RTS`/`RTI`) is implemented
  (`translate.ts:364-370`); params already lower as frame-slot reads; multi-function
  lowering/translation/emission loop all functions. Gaps: `lowerCall` ICEs on user calls
  (`lower.ts:602`) and translate has no `case "call"` (`translate.ts:254-307`).
- **The frontend is the bulk.** Parameters are never collected; a user `CallExpr` poisons
  silently with no diagnostic (`expression-typing.ts:89-92`); `callGraph.edges` is empty and
  `findCycles()` is a stub (`analyze.ts:123-127`); imports resolve nothing beyond the T4
  intrinsic boundary.

Two correctness hazards were surfaced by the independent challenger and are resolved at the
gate: sibling-frame coloring can alias a callee's frame with a function called from its own
argument list (AR-3 → argument-window interference edges), and a value live across a user
call dies in the shared `__zp_tmp` pool (AR-4 → detect + defer). A third standing hazard —
the 13-byte data ceiling at `$0800` — is retired as Phase 0 (AR-2: data base → `$2000` + a
mandatory post-ACME code/data overlap check).

## Scope (locked — see the Ambiguity Register)

**In:** parameter symbols + FN-13 shadowing (E10101) + duplicate params (E10003); call
typing — E10170 wrong count, E10171 arg type (strict same-type, AR-5), E10175 `NotCallable`
(repurposed, AR-9), E10051 `CallToInterruptFunction` (minted, AR-10), E10023 main-call
(AR-11); return completion — E10172 + assignment-family mismatch (AR-6); call graph + one
E10174 per cycle with full path (AR-7), poisoning before SFA; imports of exported functions
with E10012 + user-module-wins path precedence (AR-14); SFA feed (params, callees,
argument-window interference — AR-3); `lowerCall`/`translateCall` per the store-per-arg
convention (AR-3) with the AR-3/AR-4 ICE guards; data-region relocation + overlap check
(AR-2); two-module fixture + golden + VICE (AR-16).

**Named deferrals (gate):** same-callee-in-later-arg marshalling (ICE, AR-3); values live
across a user call — `f()+g()` (ICE, AR-4); W10181 unused-function (AR-11); import aliasing
`as` (AR-13); fall-through startup = Slice 8's non-terminating variant (AR-12).

**Out (→ Slice 5b, AR-1/AR-15):** module merging (R20), `Module.fn` qualified access (R17),
module-var initializers + per-variable init order + E10194. **Out (elsewhere):** promotion
in argument position (Slice 6, AR-5); by-ref struct/array params (Slice 7); `&fn`,
interrupts, non-terminating main (Slice 8).

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — AR-1…AR-16 (✅ PASSED) |
| [01-requirements.md](01-requirements.md) | Requirements delta, scope, plan-local decisions |
| [02-current-state.md](02-current-state.md) | Grounded current-state map (3-agent recon + challenger) |
| [03-01-call-semantics.md](03-01-call-semantics.md) | Frontend: params, call/return typing, call graph + E10174, imports, registry edits |
| [03-02-sfa-wiring.md](03-02-sfa-wiring.md) | Adapter params/callees, argument-window interference, Phase-0 data-base move + overlap check |
| [03-03-call-codegen.md](03-03-call-codegen.md) | `lowerCall` store-per-arg convention, translate `call` case, AR-3/AR-4 ICE guards |
| [03-04-acceptance-fixtures.md](03-04-acceptance-fixtures.md) | The 3-part-bar fixture (two modules) + golden + VICE + negatives |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-*) + verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, Master Progress Checklist |

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Slice split | 5a calling-convention vertical / 5b module-system completion (AR-1) |
| Data region | `ramStart` → `$2000` + mandatory post-ACME overlap check, Phase 0 (AR-2) |
| Arg marshalling | store-per-arg into callee frame slots + argument-window interference edges (AR-3) |
| Call-crossing temps | detect at translate → explicit ICE; scratch slots deferred (AR-4) |
| Recursion | one E10174 per SCC, full cycle path, poisons before SFA (AR-7) |
| Not-callable | E10175 repurposed `TooManyParameters` → `NotCallable` (AR-9) |

## Verify command (confirmed — AR-16)

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```
