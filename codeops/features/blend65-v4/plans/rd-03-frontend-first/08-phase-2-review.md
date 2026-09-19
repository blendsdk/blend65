# Phase 2 Qualification: Admitted Syntax and Parser Recovery

> **Date**: 2026-09-19
> **Result**: Qualified; parser only, not semantic acceptance or complete RD-03
> **Baseline tree**: 6887414fd1ec5317d9ebc85f7b097ae28b0fc383

## Independent Review

The correctness reviewer examined the complete Phase 2 worktree under strict
scope, with correctness, maintainability, standards, internal API surface and
untrusted-input handling lenses. One focused re-review examined the corrections.

| Finding | Severity | Correction and evidence | Status |
|---|---|---|---|
| RV-001: deeply nested blocks exhausted the host stack | Major | Bound block recursion and retain the excess balanced region as unchecked. A 5,000-block case completes without a host exception or invented language diagnostic. | Resolved |
| RV-002: a long unary prefix chain exhausted the host stack | Major | Collect prefix operators iteratively and fold them right-to-left. A 20,000-prefix case parses without a host exception. | Resolved |
| RV-003: missing parameter and field annotations used generic syntax diagnostics | Major | Emit canonical E10150 and retain a null type only for recovery. Both containing declarations and safe siblings survive. | Resolved |
| RV-004: module-statement recovery swallowed a later declaration | Major | Stop at a balanced statement boundary or a safe module-item start. The following function is retained. | Resolved |
| RV-005: unsupported do-while and loadable forms were split | Major | Retain each whole do-while, local loadable declaration and loadable-for form as one exact unchecked region. | Resolved |
| RV-006: header discovery lost or exposed lexical evidence across its boundary | Major | Filter diagnostics at the header boundary, retain prefix lexical poison and merge no-header lexical evidence with E10001. Body-only failures remain excluded. | Resolved after the sole re-review |
| RV-007: the direct parser class exceeds the preferred class-size guideline | Minor | No extra parser framework or delegation layer was introduced during this bounded syntax phase. The concern is recorded rather than obscured by a structure-only refactor. | Report only |
| RV-008: late-module detection ignored brace nesting | Major | Detect a later module only at brace depth zero. A nested `module` keyword no longer suppresses mandatory E10001. | Resolved after the sole re-review |

No critical or major finding remains. The sole re-review found RV-006 still open
and raised RV-008; both received direct regression cases and passed inline
verification. Per the review protocol, no third review was claimed. No applicable
web/auth/financial/tenant/MCP security profile or performance-critical machine
path exists in this phase; specialist auditor dispatches were therefore skipped.
Typed semantics review belongs to the later semantic phases.

## Verification

| Check | Result |
|---|---|
| Initial independent oracles | 29 behavioral cases executed and failed before implementation |
| Final parser-focused tests | 49 pass: 29 specification and 20 implementation cases |
| Compiler qualification | Build and typecheck pass; 23 test files pass |
| Import-boundary qualification | 24 tests pass |
| Touched formatting and diff whitespace | Pass |
| Frozen specification and expert skill | Unchanged |

Final verification log: `/tmp/blend65-parser-phase2-final-green.log`. The parser
uses the existing lexer, source records and project diagnostics. No compiler-root
export, CLI change, dependency, backend, target conversion or generalized parser
framework was added.

The immutable expression and parser specification tests have respective SHA-256
values `9bdd248c56e1ea071d96019a0a5dce5a527ecefca5c2168ba69c790546eb9985`
and `f4399cae257d1b3a96f5be889bf39ff1c45b24b950b383f9c3c767a5d72e4c3e`.
Their independent authors did not read production frontend implementations.

## Authority and Limits

Specification 4.0 and expert 2.0.0 remain frozen. This phase proves admitted
syntax, exact spans, bounded recovery and explicit unchecked regions. It makes
no binding, type, effect, lowering, assembly-parity or hardware claim.
Next: phase 3, module graph and declaration bindings.
