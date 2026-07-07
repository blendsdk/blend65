# RD-18 Slice 4b — The `switch` Sub-Machine — Implementation Plan

> **Feature**: Build the `switch`/`case`/`default`/`fallthrough` statement end-to-end — real
> semantic validation (operand-type, const case values, case-type-match, duplicate cases, one
> default, fallthrough position/no-effect) **and** codegen (a `brcond` compare-chain dispatch over
> the Slice-4a multi-block CFG keystone, with multi-value cases + explicit `fallthrough`) — so an
> integer `switch` program compiles and VICE-verifies a computed result. Enum switches +
> exhaustiveness are out of scope (→ Slice 7, AR-2). Closes RD-18 AC-3.
> **Status**: Planning Complete · Zero-Ambiguity Gate ✅ PASSED (2026-07-07, `00-ambiguity-register.md`; AR-1…AR-14)
> **Created**: 2026-07-07
> **Implements**: blend65-ri/RD-18 (Slice 4b — the `switch` portion of the Slice-4 row; closes AC-3; Parked Q4)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 4 row; AC-3; Parked Q4)
> **CodeOps Skills Version**: 3.2.0

## Overview

Slice 4a shipped the multi-block CFG codegen keystone (`br`/`brcond` IL lowering + multi-block
IL→Instr translation) for conditionals and loops. `switch` was **split out** (4a AR-1) because it is
a separable sub-machine (multi-value cases, `fallthrough`, ~8 validators, and the `E10072` code
collision). Slice 4b turns it on, reusing the keystone — it is a **wire-semantics-and-codegen** slice,
not a from-scratch build.

Current-state recon (three parallel agents, 2026-07-07) established that:

- **Parser/AST/visitor/walk are complete.** `SwitchStmtNode`/`CaseClauseNode`/`DefaultClauseNode`/
  `FallthroughStmtNode` are fully parsed with spans (`packages/core/src/ast/nodes.ts:254-294`,
  `parse-stmt.ts:220-370`), members of the `StmtNode` union, and traversed by `walk.ts:276-306`.
  `CaseClauseNode.values` is a **multi-value** `ExprNode[]`; `SwitchStmtNode.defaultClause` is
  **non-nullable** (the parser synthesizes an empty one + emits `E10072` when absent — AR-5).
- **Semantics do nothing** for `switch`: `type-check/statement-typing.ts:138` skips it at the
  dispatch `default:` arm, and `function-collection.ts:165` skips its case-body locals. Codes
  `E10132 DuplicateCaseValue` / `E10133 NonExhaustiveSwitch` are **registered but unemitted**
  (`diagnostic-codes.ts:106-107`); `E10075`/`E10076`/`E10073`/`E10074`/`E10071` are free/registered
  semantics to wire.
- **Codegen ICEs.** `lower.ts:234` (default arm) ICEs on `SwitchStmt` **and** `FallthroughStmt`
  (`E90001`, never throws) — `fallthrough` is the current "still-unsupported" fixture
  (`il/test-fixtures.ts:271-277`). The IL terminator set (`br`/`brcond`) **suffices** for the
  compare-chain (AR-1): `translate.ts` needs **zero** new work (its `run()` already loops all
  `fn.blocks` and dispatches `br`/`brcond`, `:366-382`).

So Slice 4b is **semantics (typing + validators + case-body locals) + one new IL lowering case
(`lowerSwitch`)**. No parser work, no translate work, no new IL terminator.

## Scope (locked — see the Ambiguity Register)

**In:** `switch` on `byte`/`sbyte`/`word`/`sword`; multi-value cases; explicit `fallthrough`
(auto-break default); `default` (RD-03-required, AR-5); validators E10075 (operand type), E10071
(const case value), **E10077** (case-type-match, new — AR-4), E10132 (duplicate case), E10076
(one default), E10073 (fallthrough no-effect warning), E10074 (fallthrough position); `brcond`
compare-chain lowering (AR-1); case/default body locals collected flat into the function frame
(AR-12). Closes RD-18 AC-3 (AR-14).

**Out:** enum-typed switches + exhaustiveness **E10133** (→ Slice 7, AR-2); jump-table codegen
(→ Phase B, AR-1); the parser's `E10072`/default-required reconciliation (AR-5); `until`, loop-var
read-only/shadowing checks (still 4a AR-2/AR-3/AR-5 — a later cleanup slice, AR-14); user function
**calls** (still Slice 5).

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — AR-1…AR-14 (✅ PASSED) |
| [01-requirements.md](01-requirements.md) | Requirements, scope, success criteria |
| [02-current-state.md](02-current-state.md) | Grounded current-state map (3-agent recon) |
| [03-01-switch-semantics.md](03-01-switch-semantics.md) | `statement-typing.ts` + `function-collection.ts` — discriminant/case typing, the 6 validators, new code E10077 |
| [03-02-switch-lowering.md](03-02-switch-lowering.md) | `lower.ts` — `lowerSwitch` compare-chain, multi-value, `fallthrough`, break-transparency |
| [03-03-acceptance-fixtures.md](03-03-acceptance-fixtures.md) | The 3-part-bar fixture + golden + VICE + negatives |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-*) + verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, Master Progress Checklist |

## Verify command (confirmed — AR-inherited)

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```
