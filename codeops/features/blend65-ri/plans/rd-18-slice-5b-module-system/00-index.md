# RD-18 Slice 5b — Module System Completion — Implementation Plan

> **Feature**: Complete the module system — module merging (same module name across
> files → one merged scope, cross-file duplicates → E10003), the full qualified-access
> value surface (`Module.fn()` calls, `Module.v` reads, `Module.v = x` writes — all
> exported-only, no import needed), call-free module-variable initializers executed
> before `main` in per-variable topological order (cycle → one E10194 per cycle with
> path), and scalar module-`const` completion (const-eval + use-site inlining + E10193,
> closing a verified latent mis-lowering hole) — lowered through the previously-dead
> `ILProgram.initCode` seam into a synthetic `__init` stream the startup shim `JSR`s
> only when initializers exist. Closes **RD-18 AC-4**.
> **Status**: Planning Complete · Zero-Ambiguity Gate ✅ PASSED (2026-07-10, `00-ambiguity-register.md`; AR-1…AR-13 + imported I-1…I-3)
> **Created**: 2026-07-10
> **Implements**: blend65-ri/RD-18 (Slice 5b — the module-system half of the Slice-5 row; closes AC-4)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 5 row; AC-4)
> **CodeOps Skills Version**: 3.3.1

## Overview

Slice 5a shipped the calling convention end-to-end (params, call typing, recursion
rejection, imports, store-per-arg codegen). 5b finishes the Slice-5 row. Three-agent
recon (2026-07-10) established the ground truth:

- **Merging is a deliberate ICE today.** Two files declaring the same module name hit
  the E90001 "not supported yet" guard placed by 5a exactly for this slice
  (`import-resolution.ts:51-63`); module scopes are created unconditionally per file
  (`function-collection.ts:89`) and `collectModuleVariables` finds them by node
  identity (`module-variable-collection.ts:40-42`) — both change under one shared
  scope per module name.
- **Qualified access silently poisons.** `Math.add(1,2)` parses as
  `CallExpr{callee: FieldAccessExpr}` and poisons with no diagnostic in typing
  (`expression-typing.ts:236-242`) — and poison makes lowering silently SKIP the whole
  function (`lower.ts:146-148`), a no-diagnostic miscompile path the AR-1 rider closes.
- **Initializers are parsed but never executed.** The AST carries them
  (`nodes.ts:172/182`); Pass 3 never types them, lowering never emits them,
  `SemanticModel.initOrder`/`constValues` exist but are always empty. E10192/E10193/
  **E10194** are minted with zero emit sites. `ILProgram.initCode` is typed but
  frozen-empty with zero consumers (`cfg.ts:82-91`, `lower.ts:155`).
- **A verified latent hole:** module-`const` references type clean but mis-lower to an
  unallocated `__frame_*` symbol (`lower.ts:745-756` + `slotIlType` default) — ACME
  undefined-symbol at build, NO error under `emitAsm`. AR-7 closes it properly.

The independent challenger converged on all five high-stakes gate picks and surfaced
the `--startup bare` hole (AR-12) plus the `hasInitCode`-flag and consume-time-wrapper
amendments (AR-8).

## Scope (locked — see the Ambiguity Register)

**In:** module merging bundle (AR-9); full qualified-access value surface — calls,
reads, writes, exported-only, value-first head resolution, E10100/E10012 reuse
(AR-1/2/3); call-free `let` initializers typed like local `let`s with the loud
call-rejection ICE (AR-4); ONE global per-variable init graph + spec-literal two-level
order (AR-5) + one E10194 per cycle with path (AR-6); scalar const completion —
const-eval, `constValues`, E10193, use-site inlining (AR-7); `initCode` → synthetic
`__init` stream + additive `PreambleOptions.hasInitCode` + conditional `JSR __init`
(AR-8); 3-file fixture + golden + VICE + negatives (AR-10).

**Named deferrals (gate):** call-bearing initializers (I-1); import aliasing `as`
(I-2); qualified function references — value reads/writes of `Math.fn` → ICE until
Slice 8 `&fn` (AR-13); bare-startup `__init` invocation is user-owned, documented
(AR-12); W10190 use-before-init stays deferred (AR-5 note).

**Out (elsewhere):** type-position qualified access `Math.SomeType` (Slice 7);
promotion/casts (Slice 6); zeropage initializers + `&fn` + non-terminating main
(Slice 8).

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — AR-1…AR-13 + I-1…I-3 (✅ PASSED) |
| [01-requirements.md](01-requirements.md) | Requirements delta, scope, plan-local decisions |
| [02-current-state.md](02-current-state.md) | Grounded current-state map (3-agent recon + challenger) |
| [03-01-merging-qualified-access.md](03-01-merging-qualified-access.md) | Frontend: merged scopes, `resolveQualified`, typing arms, call-graph/SFA parity |
| [03-02-initializers-init-order.md](03-02-initializers-init-order.md) | Frontend: initializer typing, const-eval completion, init-order pass, E10193/E10194 |
| [03-03-init-codegen.md](03-03-init-codegen.md) | Codegen: `initCode` lowering, `__init` translate wrapper, `hasInitCode` shim wiring |
| [03-04-acceptance-fixtures.md](03-04-acceptance-fixtures.md) | The 3-part-bar fixture (three files, merged Math) + golden + VICE + negatives |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-*) + verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, progress checklist |

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Qualified-access surface | Full value surface — calls + reads + writes, exported-only (AR-1) |
| Head resolution | Value-first; unresolved head → module map → E10100 (AR-2) |
| Failure codes | Reuse E10100 (head) + E10012 (member missing/non-exported) (AR-3) |
| Call in `let` initializer | Explicit unsupported ICE (AR-4) |
| Init order | Spec-literal two-level: import-edge module order, then per-variable stable topo (AR-5) |
| E10194 | ONE per cycle, first-declared anchor, spec message + path (AR-6) |
| Module consts | Full scalar completion: const-eval + inlining + E10193 (AR-7) |
| `initCode` realization | Seam populated at lowering; `__init` stream first; additive `hasInitCode`; conditional `JSR __init` — prior goldens stay byte-exact (AR-8) |

## Verify command (confirmed — AR-10)

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```
