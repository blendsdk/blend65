# Preflight report — function-frame callable-proof repair

> **CodeOps Artifact Schema**: 1
> **Audit target**: `codeops/features/blend65-v4/plans/local-callable-proof/99-execution-plan.md`
> **Blob after remediation**: `55e8f2dfe32d6c5596d7807e62e9e6e29166794a`
> **Baseline**: `1f608f3c`, clean `feature/v4-rebuild`
> **Run**: 2026-11-19 17:05, iteration 1

⚠️ **Same-session review.** The plan was authored in this session, so the scan was split across two
independent read-only auditors with separate packets, and every code claim was re-checked directly
rather than accepted from the plan's own wording.

## Verdict

**✅ PASSED — all 14 findings resolved.** No finding was accepted as-is or deferred.

Context documents read but not audited: the diagnosis
(`../local-callable-placement-check/99-execution-plan.md`) and the completed sibling unit
(`../final-global-callable-proof/99-execution-plan.md`).

## Codebase context

The plan extends machinery that already ships. Everything it asserts about that machinery was
checked against the source:

| Claim | Verdict |
| --- | --- |
| Requests carry a source binding and storage class; homes carry an address and width | Holds — `storage-types.ts:49,57,271–280` |
| Only `local` and `parameter` carry a source-declared binding | Holds — every other request is `binding: null` |
| The re-closed storage for the representation under test is reachable at both proof sites and differs from the provisional closure | Holds — `shared-storage.ts:203–279`, used at `size-selection.ts:621` and `services.ts:610` |
| Layout intervals merge overlapping homes | Holds — `c64-layout-objects.ts:101–122` |
| The two call-summary filters discard a caller's local root | Holds — `interprocedural-kills.ts:472–484` and `:565–589` |
| A definite typed store removes exactly the bytes it writes | Holds — `raw-write-kills.ts:415–435` |

Deterministic checks: links resolve, specification anchors exist, the six task identifiers are
unique and unchecked, the progress header matches, every referenced existing test file is present,
and the one new specification file is correctly absent. No phantom references.

## Findings

### Resolved — MAJOR

| ID | Finding | Resolution |
| --- | --- | --- |
| PF-001 | A struct or array parameter is borrowed: its home holds a two-byte address, not the object. Projecting leaf offsets onto it would compute addresses that are not the callable's bytes, and nothing in the plan excluded it | Added an admission guard — a binding is admitted only when its home is exactly as wide as its declared type — plus the named exclusion and an oracle row |
| PF-002 | The oracle lost the sibling unit's branch clause, so a write on one arm of a branch, and a write reached again by a loop back edge, were untested in the unsafe direction | Added a reaching-branches row and a loop-back-edge row |
| PF-003 | The shared-home argument was only exercised for same-body sharing, while the diagnosis named cross-function sharing as the open question | Added an accepted-control row for a write in a function whose activation cannot overlap the callable's live range, in all four modes |
| PF-004 | A restore performed inside a callee is translated back only for globals and borrowed parameters, so a caller-owned destination or a by-reference fill could be wrongly rejected | Named the limit in the design, required T-34.2 to determine it rather than assume it, and added both shapes as accepted controls |
| PF-005 | The publication row asserted only that no generation changed, repeating the gap that became a MAJOR review finding in the sibling unit — an error the author cannot act on | The row now requires the canonical error, the call as primary site, a storage-declaration note and a write note naming the chosen bytes, including the helper case |
| PF-006 | The target-capture row generalized "the global" to "the storage", which would have frozen an unsafe expectation about machine-created staging into an immutable oracle | Qualified to the named binding's own home, with staging explicitly outside the claim |
| PF-007 | Two exclusions contradicted the residue list: a helper shared between the main program and a handler gets one home per domain, and machine-created storage can hold a callable copy. Both are plain #164, silently accepted | Both added to the not-claimed list with the behaviour an author observes, and the dual-domain helper assigned to an implementation test rather than the oracle |

### Resolved — MINOR and observations

| ID | Finding | Resolution |
| --- | --- | --- |
| PF-008 | "Either the error or a disjoint home" passes when the home merely moved, and frame homes demonstrably drift between modes | The test must read the home from the build under judgment and assert the intersection as a precondition |
| PF-009 | No coverage for address-taken storage or a runtime-address write, where no constant cause exists to name | Added a row asserting the outcome and that a cause is still named if it rejects |
| PF-010 | Broad evidence only existed at the final gate, after the reviews that would rule on over-rejection risk | T-34.4 now runs the whole `test/rd04` integration directory |
| PF-011 | The homeless-local exclusion said it was normal but not why it is safe, and was silent on the register-copy converse | Both stated |
| PF-012 | The helper row covered only a direct write, while transitivity depends on two edits sharing one invariant; initializers were missing | Extended to two frames deep and added an ordered-initializer row |
| PF-013 | "A single request's address cannot be recovered" was over-general — a non-overlapped home keeps its own id | Reworded to the accurate reason |
| PF-014 | "Three places iterate module variables for exactly root, type and declaration span" — no single site uses all three | Reworded; the union is what the descriptor carries |

## Unknowns carried into execution

| # | Unknown | Closed by |
| --- | --- | --- |
| U-1 | Whether the semantic form of an aggregate-returning initializer presents a caller-visible store, which decides whether PF-004 is a live over-rejection or already safe | A probe during T-34.2, not a review-time argument |
| U-2 | Whether opaque kills on address-taken locals already reject before this unit, which decides whether PF-009 is new exposure or inherited posture | A probe during T-34.2 |

Both are recorded as probes rather than assumptions, because the sibling unit's two inferred MAJOR
findings were each settled only by running them.

## Scope

The audit target is the plan alone. The diagnosis was corrected in the same pass to record the
parameter case confirmed during reconnaissance, which is evidence the diagnosis owns rather than a
finding against this plan. No compiler source, specification file, oracle or release record was
touched, and the plan remains unexecuted at 0/6.
