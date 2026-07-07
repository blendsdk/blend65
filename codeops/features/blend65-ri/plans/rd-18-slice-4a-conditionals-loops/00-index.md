# RD-18 Slice 4a — Conditionals, Loops & the CFG Codegen Keystone — Implementation Plan

> **Feature**: Build control flow for conditionals and loops (`if`/`else`, `while`, `do-while`,
> `for` with `to`/`downto`/`step`) end-to-end — real semantic validation (boolean-condition,
> loop-context, all-paths-return, for-bound/step safety) **and** the first-ever multi-block CFG
> codegen (IL `br`/`brcond` lowering + multi-block IL→Instr translation) — so a program using nested
> loops, conditionals, and `break`/`continue` compiles and VICE-verifies a computed result. `switch`
> is out of scope (→ Slice 4b, AR-1).
> **Status**: Planning Complete · Zero-Ambiguity Gate ✅ PASSED (2026-07-06, `00-ambiguity-register.md`; AR-1…AR-15)
> **Created**: 2026-07-06
> **Implements**: blend65-ri/RD-18 (Slice 4a — the conditional/loop portion of the Slice-4 row + AC-3)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 4 row; AC-3; Parked Q3)
> **CodeOps Skills Version**: 3.2.0

## Overview

Slice 3b shipped the scalar **type engine** (Passes 1/3/4 for scalars) and width-aware lowering.
Every control-flow statement is currently a **skipped no-op** in the analyzer and an **ICE** in
lowering (`lower.ts:196` default arm). Slice 4a turns the first four control-flow constructs on,
end-to-end, and lands the **multi-block CFG codegen keystone** that every later control-flow slice
(4b switch, and beyond) builds on.

Current-state recon (four parallel agents, 2026-07-06) established that:

- **Parser/AST are complete.** `IfStmt`/`WhileStmt`/`DoWhileStmt`/`ForStmt` (+ `Break`/`Continue`)
  are fully parsed with spans (`packages/core/src/ast/nodes.ts`, `parse-stmt.ts`). `ForStmtNode`
  carries `varName`/`varNameSpan`/`varType`/`init`/`direction:"to"|"downto"`/`bound`/`step`/`body`.
  `until` is **not** parsed (E10309) — deferred (AR-3).
- **Semantics do nothing** for control flow: `statement-typing.ts` skips all these kinds; scopes are
  module+function only (no block scopes, no for-counter); no boolean-condition, loop-context, or
  all-paths-return checks. The `Scope` model already has a `"block"` kind, and E10130/E10131 are
  registered but **unused**.
- **Codegen scaffolding is ready, wiring absent.** `br`/`brcond`/`ret`/`unreachable` terminators and
  multi-block `ILFunction` are already typed (`instruction.ts`, `cfg.ts`), and the builder has
  `openBlock`/`reserveLabel`/`terminate`/`isTerminated` (`builder.ts`). The three gaps: `lower.ts`
  has no control-flow cases (all ICE), `translate.ts` consumes only `blocks[0]` and ICEs on non-`ret`
  terminators, and the reusable `label()`/`_cmp`-counter branch pattern lives in `translateComparison`.

So Slice 4a is **semantics + CFG wiring**, not a from-scratch build. The load-bearing new work is the
multi-block lowering/translation keystone (AR-11/AR-12) — the reason this is a keystone slice.

## Scope (locked — see the Ambiguity Register)

**In:** `if`/`else` (+ `else if` chains), `while`, `do-while`, `for` (`to`/`downto`/`step`),
`break`/`continue`; boolean-condition (E10134), loop-context (E10130/E10131), all-paths-return
(E10102), for end-bound range (E10064), `step` positivity (E10061); multi-block CFG lowering +
translation; nested block/for-counter locals collected into the function frame (flat-recurse, AR-9).

**Out:** `switch`/`case`/`default`/`fallthrough` (→ 4b, AR-1); `until` (AR-3); loop-var read-only
(E10060), nested for-var reuse (E10062), no-shadowing (E10101) (AR-2/AR-5); full-range `to <type-max>`
wrap codegen — Pattern B (AR-6); user function **calls** (still Slice 5).

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — AR-1…AR-15 (✅ PASSED) |
| [01-requirements.md](01-requirements.md) | Requirements, scope, success criteria |
| [02-current-state.md](02-current-state.md) | Grounded current-state map (4-agent recon) |
| [03-01-control-flow-semantics.md](03-01-control-flow-semantics.md) | Passes: scope/for-counter, condition typing, loop-context, all-paths-return, new codes |
| [03-02-cfg-lowering.md](03-02-cfg-lowering.md) | `lower.ts` — multi-block CFG + `br`/`brcond`, loop-context stack |
| [03-03-multiblock-translate.md](03-03-multiblock-translate.md) | `translate.ts` — all-blocks loop, block labels, branch terminators |
| [03-04-acceptance-fixtures.md](03-04-acceptance-fixtures.md) | The 3-part-bar fixture + golden + VICE + negative |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-*) + verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, Master Progress Checklist |

## Verify command (confirmed — AR-inherited)

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```
