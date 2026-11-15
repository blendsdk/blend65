# Preflight report — interprocedural raw-write callable invalidation

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Content hash**: `sha256:0cf678f0919bf39d4aa8bc2085773c3c94a525823993249bb650481794759dfd`
> **Git blob**: `1e8bff5c04bd04f7fc87342fafb229c824f2052d`
> **Scope mode**: strict
> **Verdict**: ✅ PASSED WITH NOTES — 11 critical/major resolved, 1 minor resolved, 0 accepted
> **Rounds**: iteration 1 (five-cluster fan-out), iteration 2 (fix-only re-review)

## Audit target and context

The target is the single execution-plan document. Context documents read as evidence:
the issue #161 contract, `raw-write-kills.ts`, `assignment-facts.ts`, `function-targets.ts`,
`whole-program.ts`, `operations.ts`, and the existing #156 oracles. They are not passed or
modified by this audit.

## Findings

| ID | Severity | Dimension | Finding | Resolution |
| --- | --- | --- | --- | --- |
| PF-001 | 🟠 MAJOR | Dependency | The plan relied on `callWriteSummaries` for restoration, but that summary excludes address-taken and placed globals (`assignment-facts.ts:309-314`, `function-targets.ts:194-226`). The promised restore after `pokew(&callback, 0)` was unavailable. | A dedicated definite-store restoration summary with its own eligibility rule; address-taken and placed whole bare callable globals are included. |
| PF-002 | 🟠 MAJOR | Edge case / security | A kill inside a callee was not projected onto a second parameter or a global that aliases it. `f(p,q){ pokew(&p.cb,0); q.cb(); }` called as `f(box,box)` could stay accepted. | Call-site alias relation with byte displacement, applied inside `killFlow`, in both directions. |
| PF-003 | 🟠 MAJOR | Codebase alignment | The opaque-destination fallback would reject the existing accepted control `poke(&box.data[index],0); box.cb()` (`raw-write-invalidation.impl.test.ts:348-360`). | Resolve exact, then possible checked/bounded place intervals, then constant overlaps, and only then the opaque kill. |
| PF-004 | 🟠 MAJOR | Edge case / security | A borrowed write that physically crosses into an adjacent placed callable was missed; translation stopped at the borrowed root. | Translation and alias construction expand through the actual root's proved placement plus one maximum write width. |
| PF-005 | 🟡 MINOR | Testability | The zero-cost claim had no measurement oracle. | Pin accepted controls' PRG, code, zero-page and scratch bytes before and after. |
| PF-006 | 🟠 MAJOR | Logical contradiction | Applying produced kills and then subtracting definite stores would hide a corruption produced *after* the store. | Update law is `(incoming − definiteRestores) ∪ producedKills`; the store-then-corrupt witness is an acceptance row. |
| PF-007 | 🟠 MAJOR | Dependency | The published indirect-target map empties a set that contains `UNKNOWN_TARGET`; using it as the carry input would lose the provisional superset. | Carry the unfiltered pre-poison candidate roots from the settle, not the published map. |
| PF-008 | 🟠 MAJOR | Completeness | The runtime-destination acceptance had no concrete resolution. | Precise destination resolution first; one conservative opaque kill only for a genuinely unresolvable destination; #163 owns further bounded-local recovery. |
| PF-009 | 🟠 MAJOR | Ordering | Field-level caller-kill restoration was implicitly assumed. | Explicitly #157's acceptance in the same wave; #161 stays sound without it (false rejection only). |
| PF-010 | 🟠 MAJOR | Dependency | The incoming-kill path through finite indirect calls was undefined. | Provisional target superset, monotone kill union; final poisoned sets may only shrink. |
| PF-011 | 🟠 MAJOR | Feasibility | Handler raw writes and post-layout constant overlaps were unowned. | Recorded as residual rows with the interrupt-ownership and post-layout owners. |

## Resolved residuals

| Residual | Owner |
| --- | --- |
| Field-level caller-kill restoration | #157 |
| Bounded local index ranges | #163 |
| Handler raw write overlapping an asynchronous callable read | interrupt ownership analysis |
| Constant address overlapping an automatically placed callable after layout | new post-layout conflict issue at closeout |
| Alias precision across different actuals | union relation, conservative by design |
| Unresolved runtime destination | accepted AR-P1 boundary, rejected after the write |

## Verification boundary

Iteration 2 verified the five fix areas against the code and found PF-006/PF-007; both are
corrected in the target and their arithmetic is directly checkable in the plan text. No test was
executed; the plan's own oracle-before-implementation task supplies RED evidence. Static review
does not prove the implementation.
