# Phase 5 Review: Fixed Aggregates, Places and Memory Intrinsics

> **Date**: 2026-09-19
> **Result**: Qualified after the user-approved focused corrections
> **Phase baseline tree**: `283265299b5cf27e490aa1b2b2c543a88ebc9332`
> **Domain lineage**: `blend65-domain-expert` 2.0.0, content commit `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`

## Initial Independent Review

The correctness and semantics reviewers examined the complete Phase 5 diff.
The user approved all eight major correction clusters. AR-P12 and AR-P13
resolve the two frozen-registry diagnostic gaps without adding public E-codes.

| Finding cluster | Correction applied before re-review |
|---|---|
| RV-001 / SEM-RR-003: loop-only initialization survived zero iterations | Join the loop-entry facts with the body/update facts. |
| RV-002 / RV-005 / SEM-RR-006: pending aggregate copies, returns and unsized parameters were accepted or poisoned | Retain valid unsupported ABI/copy forms as explicit unchecked obligations. |
| RV-003 / SEM-RR-002: ordinal promotion missed unary and barrier boundaries | Promote direct ordinal operators and stop promotion at assignment, call and built-in boundaries. |
| RV-004 / SEM-RR-005: extents used a second syntax-only evaluator | Evaluate named constants and admitted constant/query forms without host-width truncation. |
| RV-007 / SEM-RR-004: field writes marked too much or too little initialized | Track exact field paths and array-element coverage independently. |
| RV-008 / SEM-RR-001: imported type aliases were unresolved and type bindings entered value lookup | Resolve type imports by binding identity and keep type/value namespaces separate. |
| RV-006 / SEM-RR-007: invalid aggregate types failed silently | Diagnose empty/oversized/void storage and defer valid later-slice field forms. |
| SEM-RR-008: `lo`/`hi` rejected or mis-evaluated signed and narrow integers | Admit all integer widths and sign-extend `sbyte` before high-byte extraction. |

The related minor findings were corrected in the same touched logic: exact
half-open range intersection, zero-length initialization, fixed-query codes,
const aggregate argument/root diagnostics and focused file-size splits.

## Sole Focused Re-review

The protocol permits one focused re-review after major corrections. It found
three remaining major cases and two small edge cases. The user approved all
five corrections and AR-P13. No third independent review is claimed.

| Finding | Severity | Direct correction | Status |
|---|---|---|---|
| RV-RR-001: nested unary operands cleared ordinal context | Major | Preserve ordinal context through unbarriered unary operands; casts, calls and assignments remain barriers. | Corrected and verified |
| SEM-RR2-001: local constants and nested query failures were lost in extents | Major | Pass the active lexical scope to extent evaluation and preserve E10266/E10202/E10203 query diagnostics. | Corrected and verified |
| SEM-RR2-002: aggregate conditional/copy boundaries hid source semantics | Major | Analyze operands first, defer exact-type aggregate conditionals/copies, and retain independent source errors. | Corrected and verified |
| RV-RR-003: complete field coverage never promoted its parent | Minor | Promote a struct or array element after every declared scalar field is definitely initialized. | Corrected and verified |
| RV-RR-002 / SEM-RR2-003: recursive void checks used the wrong exact predicate | Minor | Distinguish bare parameters, bare struct fields and nested array elements under AR-P12/AR-P13. | Corrected and verified |

Direct regressions cover every re-review counterexample. The conditional helper
is a mechanical responsibility split which keeps the expression analyzer below
the source-file limit; it adds no semantic layer or public package surface.

## Final Verification

| Check | Result |
|---|---|
| Focused scalar/aggregate/flow tests | 79 pass across six suites |
| Phase qualification | Compiler build/typecheck pass; 780 compiler tests and 24 import-boundary tests pass |
| Touched formatting and diff whitespace | Pass |
| Touched implementation file size | Pass; all are at or below 699 lines |
| Specification-test integrity | Pass; Phase 5 oracles remain 9 aggregate and 2 intrinsic cases |
| Frozen specification | Unchanged |

The Phase 5 specification-test SHA-256 values are
`439a9529ae1c22ce7e04a30b63c76b8253203560502d08690ee8823195c7f42a`
and `1497911c0a7d74e0f8cddbf2bfa319e36a216b7a93ec148161a26092b27de4b4`.

## Authority and Limits

Specification 4.0 and expert 2.0.0 remain frozen. This phase proves the admitted
fixed-aggregate, place, initialization and memory-intrinsic frontend boundary.
Whole aggregate copy/return ABI, unsized-parameter ABI, nested aggregate layout,
backend lowering, SFA, assembly parity and hardware behavior remain outside this
phase and are retained as explicit obligations rather than source restrictions.
