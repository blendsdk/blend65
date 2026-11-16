# Unreachable teardown — findings

> **Baseline**: `46292b77`; bounded production transformation and exact oracle exceptions reviewed.
> **Status**: RV-001 fixed under exact approval and independently fix-reviewed; all six transformation review lenses clear. Actual complete checkpoint passed.

## RV-001 — public sampler uses inclusive rather than exclusive ends — MAJOR

**Location:** `test/rd05/nonreturning-startup.spec.test.ts:70,95`.
**Authority:** public memory schema validator
`packages/compiler/src/artifacts/memory-evidence-validator.ts:160–165` requires
`size === end - start`. This is an artifact-adapter check, not a compiler transformation oracle.

The new public test consumes `.memory.json`, but uses internal-layout inclusive-end arithmetic.
Its 49-byte snapshot assertion consequently receives 50. Its PRG code slice also reads one byte
beyond a public code interval and may misclassify a boundary-crossing byte pattern or reject a
code interval ending at EOF. Independent review checked all remaining sampler assumptions and
reported no other sampler findings; this is not a full phase review.

**Smallest remedy:** exact two-expression change under plan AR-P2, preserving all behavior and
numeric expectations. Independent challenger agrees; strongest counterargument (editing a frozen
oracle to fit output) is refuted by the explicit existing public schema invariant, not by compiler
output alone. Correctness still does not grant edit authority. User approval is required first.

**Disposition:** fixed under the user's exact **Approve two fixes (Recommended)** decision in
AR-P2. The bounded independent fix review confirms both expressions now respect public half-open
intervals, all expectations remain, and no related findings survive. Public specifications pass
8/8, as execution-owner evidence, not reviewer execution. This is not transformation approval.
The earlier independently authored baseline is
SHA `653d026fc268b40f4ee30b8ae19c076883fe3bf1afb40c2a4d80ece716f5e783`.
AR-P1's approved sole `stub` → `startup` key change produces SHA
`022af7a2626aa841fee9c1fbbb143fe17683cc2fe45727b2522c84c85fec6694`.
Primary reverse-substitution/hash verification proves every other frozen byte unchanged after
AR-P1. The final active hash after AR-P2 is
`081dfc2979cfe1ad5c90facb224fa37d2ea928b4f5da696e86d055971b77dfdf`. Reviewers
did not execute hashing or tests. The challenger excluded incidentally read historical routing
smoke summaries from its decision; direct public-schema evidence is decisive.

## Independent transformation review

| Role                    | Disposition and endpoint                                                                                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| correctness-reviewer    | No findings in correctness/maintainability/docs/standards and oracle authority. Primary's exact reverse-diff/hash comparison checks all three approved root edits and unchanged other hashes; reviewer did not execute hashing. Denied external access was not retried.             |
| semantics-reviewer      | No semantic or DX findings. Closed nonreturnability plus actual selected CFG independently gate omission; no source rejection, workaround or new `none` search. Historical routing smoke summaries were excluded.                                                                   |
| sfa-abi-auditor         | No findings through selection, inventory/binder, binding and final placement. Captures, snapshot and held status are retained; platform state remains outside SFA. Authorized router/CPU/lowering excerpts clear its authority gap without new access.                              |
| target-platform-auditor | No findings: no executed MMIO/IRQ/stack/banking/asset work added or removed. Default/returning/takeover behavior and stale-reference rejection remain. PAL/6581 runtime is not represented as four-profile runtime proof.                                                           |
| machine-code-auditor    | No findings: 281 dead restore bytes plus 3 dead JMP bytes disappear; unreachable emits zero. Complete known code/padding/assets/stub/resources reported, no payload or executed-work win. Assembled measurements are primary-supplied; current address attestations remain bounded. |
| performance-auditor     | No findings. New work adds at most one unchanged publication query plus O(N+B+E) graph work, linear retained graph storage; two total queries at most, never per read. Constructor filtering is bounded to seven blocks and borrowed bytes to 142. No latency/RSS claim.            |

All are independent read-only assessments; no auditor executed verification. Expert lineage is
parent-authorized qualified `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
frozen Specification 4. Startup, final-storage closure, complete interrupt-route gate (no new
generated route), instruction effects and equivalent-work accounting govern. External aggregate
NMI/firmware stack/reentrancy/completion/deadlines, whole-frame timing and physical behavior remain
Unknown. No new `$FE47` condition follows for no-hook programs. The primary subsequently passed
the actual new complete checkpoint in 5,006.38 s; this is execution-owner evidence, not reviewer
execution. Predecessor GREEN is not substituted for this unit's result.
