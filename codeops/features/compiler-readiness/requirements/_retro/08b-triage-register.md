# Bug-or-Feature Triage Register: Blend65 Compiler Readiness

> Status: ❌ GATE BLOCKED — 5 items unresolved
> Last Updated: 2026-07-23
>
> `--auto-design` does not resolve this gate: retro-requirements is not on the supported-workflow
> allowlist, and product behavior/language semantics are reserved authority.

## 🔴 Suspicious Items

| ID | Source | Item | What the code/artifact does | Why suspicious | User decision | Status |
|---|---|---|---|---|---|---|
| T-001 | LANG-03 | Literal-only memory addresses | Rejects variables, parameters and computed addresses for `peek`/`poke`/`peekw`/`pokew` with E10045 | Frozen spec uses ordinary `word` addresses and demonstrates loop-computed addresses | **A — bug.** User identified ordinary variables/parameters as the defect that invalidated the old direction and selected spec-based readiness. | ✅ Resolved |
| T-002 | EVID-03 | Static cost labeled cycles | Sums each emitted instruction's maximum cycle cost once | Does not model branch frequency, loops, calls or runtime paths | — | ❌ Open |
| T-003 | EVID-04 | Compiler-authored examples as readiness baseline | Uses slices/demos written within current compiler constraints | Unsupported language forms are absent by construction | **A — invalid as the readiness authority.** User explicitly rejected `boing-ball` as representative because it was created under the same defect. Existing examples remain regression evidence only. | ✅ Resolved |
| T-004 | BR-DOM-05 | Universal per-routine expert parity | Requires no routine to exceed a 1.0 hand-assembly ratio | Lacks an equivalence domain, cost function and exception/variance policy | — | ❌ Open |
| T-005 | BR-DOM-06 | Whole-program “beat expert” readiness rule | Requires generated whole programs to outperform expert assembly | Presently undecidable and mixes language correctness with optimization | — | ❌ Open |

## ⚠️ Inferred Items

| ID | Source | Item | Observed behavior | Confidence notes | User decision | Status |
|---|---|---|---|---|---|---|
| T-006 | EXEC-03 | Current VICE coverage is insufficient for readiness | Runtime checks cover selected authored fixtures | No machine-readable spec-to-runtime coverage target exists | — | ❌ Open |
| T-007 | BR-DOM-07 | Existing examples remain useful only as regressions | They detect drift in paths they exercise | Their authority after a generated baseline is a product decision | — | ❌ Open |
| T-008 | Architecture | The frozen v3.0 spec should remain the sole semantic baseline | Current policy freezes it during implementation | A new readiness feature could alternatively discover spec ambiguities requiring an errata process | **B — intentional.** User selected compiler readiness based on the language spec. Ambiguities must enter an explicit errata/ruling process; implementation behavior does not resolve them. | ✅ Resolved |

## Decision Codes

- **A — Bug/invalid rule:** exclude from the reconstruction requirements and record under known
  bugs or evidence debt.
- **B — Intentional:** retain as a confirmed requirement with the user's rationale.
- **C — Unsure:** retain prominently flagged and reopen during requirements discovery.
