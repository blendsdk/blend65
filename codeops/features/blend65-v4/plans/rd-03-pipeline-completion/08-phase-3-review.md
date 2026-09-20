# Phase 3 Review: SFA and ABI Closure Engine

> **Status**: ✅ Complete
> **Phase baseline tree**: `03757f7c2e99514d3fa8162720ab2167a257601a`
> **Scope mode**: strict
> **Reviewed**: 2026-09-20

## Verification Before Review

| Check | Result |
|---|---|
| Compiler typecheck | PASS |
| Focused storage suites | PASS — 12 tests |
| Full compiler suite | PASS — 47 files, 875 tests |
| Immutable `sfa.spec.test.ts` | PASS — `9c325b9fa5a042fadc604a3b92e6da23ea997b8bac13c2b1aa9f72ad05e316cc` |
| Immutable `closure.spec.test.ts` | PASS — `2f1c36987150876e0cf04e3b968c304ac0c382b651a4eb3213aa42f092bb6609` |
| Frozen `spec/` | Clean |

## Independent Review

The correctness reviewer and semantics reviewer independently inspected the uncommitted Phase 3
implementation. Both found the first four major issues. The semantics review found two further
major issues and one minor evidence issue. Neither review found overengineering or an unnecessary
support surface.

| ID | Severity | Finding | Smallest direct correction | Ruling |
|---|---|---|---|---|
| RV-001 / SR-001 | 🟠 Major | Executable initializer values have no lifetimes or SFA inventory. | Retain initializer execution contexts, lifetimes and call edges; keep the destination global outside SFA. | Accepted and implemented |
| RV-002 / SR-002 | 🟠 Major | Hardware-stack depth starts only from `main`, omitting initializer call chains. | Take the maximum across `main` and executable initializer roots. | Accepted and implemented |
| RV-003 / SR-003 | 🟠 Major | `peakBytes` sums all logical requests rather than simultaneous demand. | Compute truthful simultaneous demand and keep any logical total separately named. | Accepted and implemented |
| RV-004 / SR-004 | 🟠 Major | The arbitrary 64-round bound can reject a valid finite candidate set. | Require declared finite candidate identities; allow at most the remaining candidates plus one stability round. | Accepted and implemented |
| SR-005 | 🟠 Major | Greedy first-fit can report exhaustion even when a valid overlay exists. | Run deterministic complete fallback only after first-fit fails. | Accepted and implemented |
| SR-006 | 🟠 Major | Late selected helpers cannot add call/stack edges or reliable scratch conflicts. | Let the finite binder result add direct helper overlap and stack facts beside storage requests. | Accepted and implemented |
| SR-007 | 🟡 Minor | `inventoryHash` omits ABI result locations. | Include ordered result-location records in the inventory hash. | Implemented with accepted corrections |

## Fix-Only Re-review

The single permitted correction re-review confirmed that the original seven findings were fixed
without added architecture. It found two new direct correctness defects in the correction diff:

| ID | Severity | Finding | Smallest direct correction | Ruling |
|---|---|---|---|---|
| RR-001 | 🟠 Major | Stack depth adds two return-address bytes to root `main`, although startup falls through into `main` without `JSR`. | Count two bytes on actual call edges, not on the root function. Correct the focused expectations. | Accepted and implemented |
| RR-002 | 🟠 Major | Greedy placement can fail before a later malformed request is validated, allowing the exact fallback to process invalid width/alignment. | Validate every ordered request once before either placement path. | Accepted and implemented |

## Simplicity Check

The recommended correction remains a direct data-and-functions design:

1. extend the existing whole-program records with initializer execution facts;
2. make the existing certificate fields truthful;
3. add a fallback search inside the existing allocator only when greedy placement fails; and
4. replace the request-only callback with one small finite binder result containing candidate and
   helper facts.

Rejected as unnecessary: an allocator framework, generic execution-context hierarchy, pass
manager, helper registry, runtime service, software stack, heap, or general graph library.

## Gate

The user accepted the original grouped corrections and RR-001/RR-002 on 2026-09-20. The single
permitted re-review is complete, the final direct fixes pass verification, and Phase 3 closes. No
further re-review is permitted.

## Final Verification

| Check | Result |
|---|---|
| Focused semantic/storage suites | PASS — 37 tests |
| Frozen specification oracles | PASS — hashes unchanged |
| `yarn install --frozen-lockfile` | PASS |
| `yarn build` | PASS — compiler and CLI |
| `yarn typecheck` | PASS — compiler and CLI |
| `yarn test` | PASS — compiler 884, CLI 61, root 52 |
| Prettier and whitespace | PASS |
| Frozen `spec/` | Clean |

All accepted findings are resolved. The implementation remains the direct four-function SFA design
with finite binder facts and no added framework, registry, runtime, heap or software stack.
