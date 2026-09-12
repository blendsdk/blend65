# Core Language Reconciliation: Specification 4.0 and Expert Authority Freeze

> **Document**: 03-02-core-language-reconciliation.md
> **Parent**: [Index](00-index.md)

## Overview

This component reconciles control flow, lexical scope, fixed-width integers, fixed arrays,
aggregates, and addressable places. RD-01 R1.5–R1.9 own observable behavior; this document owns the
edit topology and consistency boundaries.

## Architecture

### Current Architecture

The behavior is distributed across summaries, core chapters, feature evaluations, the formal
grammar, diagnostics, and expert-derived references. P3 also retains several compiler-shaped
restrictions that the accepted v4 decisions classify as expressiveness debt.

### Proposed Changes

Reconcile one semantic family at a time and update its normative clause, evaluation, grammar
production, examples, and diagnostic owner as one review unit. The phase-level RED oracle exists
before any normative edit. See AR-P2 and AR-P3.

## Implementation Details

### File and Section Ownership

| Semantic family | Primary normative owners | Derived/consistency owners |
|---|---|---|
| Three-clause loops and exit order | `spec/05-statements-control-flow.md`; `spec/evaluations/F008-for-loop.md` | Loop productions in `grammar.ebnf.md`; relevant `spec/14-diagnostics.md` entries |
| Lexical shadowing and declaration identity | `spec/03-variables.md`; `spec/evaluations/F019-variables.md` | Declaration productions; E10003/E10101 registry state |
| Fixed-width and ordinal contexts | `spec/02-type-system.md`; `spec/04-expressions-operators.md` | `F010`, `F014`, `F016`, and `F017` evaluations |
| Fixed arrays and queries | `spec/08-arrays-strings.md`; `spec/evaluations/F014-arrays.md` | Array/type/query productions; related diagnostics |
| Aggregate assignment and return | `spec/06-functions.md`; `spec/07-structs.md` | `F011` and `F018`; ABI obligations in `spec/11-memory-model.md` |
| Addressable places and local lifetime | `spec/11-memory-model.md`; `spec/evaluations/F006-address-of.md` | Address/query expressions and related diagnostics |

Shared files have disjoint ownership in this phase: the grammar task edits only loop, declaration,
type, array, aggregate-return, and address productions; the diagnostics task edits only codes
required by R1.6–R1.9. Phase 3 owns function-value, comptime, placement/loadable, intrinsic, and
safety productions/codes. Phase 4 owns platform/profile productions and final global integrity.

### Reconciliation Rule

For each family, preserve every unchanged P3 clause and apply only the behavior named by RD-01 and
its cited v4 AR decisions. Remove contradictory summaries and invalid examples rather than leaving
them as historical alternatives. Existing compiler behavior cannot narrow the result.

### Examples

Each changed area receives one modern-developer example and one C64-game example in its primary
normative owner. Examples state source behavior; code-generation advice belongs only in
non-normative expert knowledge. See RD-01 R1.27.

### Diagnostic Ownership

Every invalid form introduced or changed here has one normative owner and one registry entry.
E10101 becomes reserved, legal shadowing has no diagnostic, and same-scope duplication remains with
its existing owner. The final whole-registry set comparison is deferred to Phase 4.

## Integration Points

| Component | Contract |
|---|---|
| Closed-program semantics | Uses the reconciled value/place/type model without redefining it |
| Grammar | One production per syntax form; no legacy range-loop production |
| Guard | Each changed family receives all 23 results |
| Expert skill | Later mirrors only the frozen clauses and their compiler obligations |
| Compiler RDs | Consume stable declaration, place, aggregate-return, and array obligations |

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Normative conflict with an approved v4 ruling | Stop and treat the approved v4 ruling as authority | AR-P1 |
| New semantic choice not determined by RD-01 | Add the next AR-P item and reopen the gate | AR-P1 |
| Grammar/example disagreement | Keep RED; repair the normative candidate, never weaken the oracle | AR-P3 |
| Shared-file edit crosses another phase's section ownership | Split or move the edit to its owning phase | AR-P2 |

## Testing Requirements

- ST-07–ST-12 cover concrete valid, boundary, invalid, ordering, alias, and lifetime cases.
- `tests/core-language.spec.test.md` is authored from those cases without reading candidate edits.
- `tests/core-language.impl.test.md` records duplicate-production, stale-syntax, diagnostic, link,
  and example/grammar checks after the normative work.
