# Preflight Report — Bounded NMI Retention

> **Status**: PASS WITH FIXES; every finding dispositioned
> **Date**: 2026-11-13

An independent read-only auditor reviewed the proof, lowering, accounting, oracles and VICE case.

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| PA-001 | Major | The eight-byte cap was applied to the register-only elision as well as the stack proof, so nine adjacent single-use pairs would lose their elision. | Fixed: the cap now applies only to `nmiStackRetainedLocals`; the register-only proof has no cap. |
| PA-002 | Major | The stack proof admitted ordinary NMI-domain helpers, but a callee's `stackBytes` was not in the call-stack depth, so the published peak could understate a helper's pushes. | Fixed: the proof requires `entryKind === "interrupt"`, so only the handler body is retained. A helper's retained local is rejected and owned by #150. |
| PA-003 | Major | `TSX` was emitted before every stack load; an expert reuses X across a run of loads. Five-sample body 20 bytes/30 cycles versus 17/26. | Fixed: one `TSX` serves the run; the body drops to 64 bytes and the shared body to 38. The oracle pins the new counts. |
| PA-004 | Minor | A stack value as a right-hand arithmetic/bitwise operand passed the proof and then threw a lowering error instead of `E10245`. | Fixed: the proof admits only stores, constant-address memory writes, left zero tests, and left bitwise with a constant/direct peer. Unrelated block code rejects the whole proof. |
| PA-005 | Minor | The testing strategy said "calling handler"; the implemented negative is a branch join. | Fixed: the strategy names the branch join; the calling-handler case is recorded in the ledger row and #150. |
| PA-006 | Minor | All new cases used optimization `none`. | Fixed: one shared-form `balanced` build/storage case is pinned. |

The auditor confirmed the proof bounds, `PHA`/`TSX`-relative/`PLA` offsets, wrapper X save, private-home proof non-relaxation, VICE genuineness and the zero-extension elision.
