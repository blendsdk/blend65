# Phase 4 Review: Scalar Expressions, Direct Calls and Structured Flow

> **Date**: 2026-09-19
> **Result**: Qualified after the user-approved focused corrections
> **Phase baseline tree**: `03bbad73ce2362dee92750691fae70625ff7e6de`
> **Implementation-review baseline tree**: `ad4176c326e9115efa167ceea90d28238b3f50b1`
> **Accepted-fix baseline tree**: `dfea4cb67f7ebdae114419f7ed7008a1216bd3e7`

## Initial Independent Review

The correctness and semantics reviewers examined the Phase 4 implementation
under strict scope. The user accepted all blocking corrections and approved
AR-P11's one bounded project-owned diagnostic for three predicates only.

| Finding | Correction applied before re-review |
|---|---|
| SEM-001 / RV-004: void used as a value | Reject and poison void value expressions with AR-P11's fixed diagnostic. |
| SEM-002: chained runtime arithmetic used pre-wrap facts | Feed the wrapped child value to its runtime parent. |
| SEM-003 / RV-001: path facts leaked or used the wrong order | Snapshot, restore and merge direct branch, conditional, short-circuit and loop facts. |
| SEM-004 / RV-003: compile-time eligibility used runtime-known facts | Reject assignment/calls in constant context and enforce local-const eligibility. |
| SEM-005 / RV-002: source order and shared mutable globals changed results | Order constant dependencies and clear mutable facts at function entry and calls. |
| SEM-006 / RV-005: unsupported body forms exposed partial typed declarations | Retain the owning declaration as unchecked when it adds obligations. |
| SEM-007 / RV-006: function bindings acted as writable scalar places | Keep function names callable-only and reject bare function values under AR-P11. |
| SEM-008: invalid calls produced typed results and recursion edges | Check every argument but emit neither result nor edge for an invalid call. |
| SEM-009: contextual literal overflow used conversion diagnostics | Emit E10084 at the contextual literal boundary. |
| SEM-010: return completeness ignored known-infinite loops | Add direct structured-loop return summaries. |
| SEM-011 / RV-007: widening was absent from typed children | Apply same-sign widening to binary children. |
| SEM-012: invalid expressions disappeared silently | Diagnose non-place assignment, Boolean bitwise complement and other rejected admitted forms. |
| SEM-013: byte-loop proof missed strides and nested exits | Simulate fixed-width induction and distinguish exits from nested loops. |
| SEM-014: compound warnings were missing | Emit the existing signed-wrap and wide-shift warnings. |

## Sole Focused Re-review

The protocol permits one re-review after major fixes. It inspected only the
accepted-fix diff and found these surviving defects. The user approved their
direct correction; no third independent review is claimed.

| Finding | Severity | Smallest direct correction | Status |
|---|---|---|---|
| RV-001 / SEM-RR-002: mutable conditions were treated as invariant infinite loops | Major | Prove non-fallthrough only for literal `true` or an omitted `for` condition in this phase. | Corrected and verified |
| RV-002: conditional arms did not widen symmetrically | Major | Analyze both arms naturally, compute their common type, then apply that type to both children. | Corrected and verified |
| RV-003: constant-expression operands narrowed before the final result | Major | Keep constant intermediates exact and apply the destination range only at the complete initializer boundary. | Corrected and verified |
| RV-004: address-of entered ordinary name/unary analysis | Major | Recognize `&` first, retain address-taking as an unchecked later-phase obligation, and reserve AR-P11 for genuinely bare function names. | Corrected and verified |
| SEM-RR-001: short-circuit continuation facts always restored the baseline | Major | Keep RHS facts when execution is certain; keep baseline when skipped; intersect both when conditional. | Corrected and verified |

The user approved all five bounded corrections. They were applied directly:
short-circuit facts now select or merge the reachable continuation, mutable
conditions no longer prove infinite loops, both conditional arms widen after
their natural types are known, constant intermediates stay exact until the
initializer boundary, and address-taking remains an unchecked later-phase
obligation. No framework, pass, dependency, CFG/IR layer or public API was added.

The protocol permits no third independent review, so none is claimed. The exact
reviewer counterexamples now have direct implementation regressions and passed
the full phase and repository qualification commands.

## Final Verification

| Check | Result |
|---|---|
| Focused scalar/flow tests | 50 pass: 23 scalar specification, 7 flow specification and 20 implementation cases |
| Phase qualification | Compiler build/typecheck pass; 751 compiler tests and 24 import-boundary tests pass |
| Root checkpoint | Build/typecheck/test pass; 61 package, 751 compiler and 43 root tests pass |
| Touched formatting, diff whitespace and source-file size | Pass; implementation files remain below 700 lines |
| Frozen specification and expert skill | Unchanged |

The scalar and flow specification-test SHA-256 values remain
`248ebdac03d109471e364bcbbac1c6f79618ecef435ea379ab3c02073d65ed89`
and `44efb6453db86726ec6be146c8650efc080a8d2364e6956b04eb13066fc15945`.

## Authority and Limits

Specification 4.0 and expert 2.0.0 remain frozen. This phase proves the admitted
scalar, direct-call and structured-flow boundary only. It makes no backend, SFA,
assembly-parity, artifact or hardware claim.
