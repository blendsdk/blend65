# Phase 6 Review: Effects, Initializer Schedule and Service Acceptance

> **Date**: 2026-09-19
> **Result**: Qualified after the user-authorized corrections
> **Phase baseline tree**: `4778012d2db3710d7a1f8e1c93a26e9aaabf6e3c`
> **Domain lineage**: `blend65-domain-expert` 2.0.0, content commit `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`

## Specification Oracle

The implementation-blind author independently adopted three fixture-mechanics
corrections without changing an expected behavior: runtime `seed` is `let`, the
real-loader target is a valid C64 profile, and the forbidden-field serialization
handles `bigint`. The author then reproduced RED from the phase baseline and
GREEN from the completed worktree without opening production files.

| Evidence | Result |
|---|---|
| Baseline RED | Missing `frontend/service.js`; 2 suites failed collection, 0/17 executed; log SHA-256 `e3c27f31356ddc0f92d992ad3aa6ef7dc96ca06b2f246f619948655dc5322bfb` |
| Current GREEN | 17/17 pass across `effects.spec.test.ts` and `service.spec.test.ts`; log SHA-256 `7ec944d84e2836fe106cbe158cc7f21602bc244541029a3270d55dbadc3121df` |
| Oracle hashes | `effects.spec.test.ts`: `d4839acfc10f3d6d8c8fd6609e345cea57fc2ee8d4aac2216fcb253e554c212c`; `service.spec.test.ts`: `6084ac819f5d0efd9c97cf4929c95adfef48a230e0a9c89475b1959039f19972` |

## Initial Independent Review and Corrections

| Finding cluster | Authorized correction |
|---|---|
| RV-001: implementation-side fixture correction | Independent author adoption plus fresh isolated RED and current GREEN evidence. |
| RV-002: bare `embed` suppressed | Suppress lookup only inside a discovered `embed(...)` asset obligation. |
| RV-003 / SEM-002: warnings consumed the error ceiling | Count and truncate errors only; retain every warning. |
| RV-004 / SEM-005: initializer cycles lacked call/read proof | Carry direct and transitive read locations into E10194 related spans. |
| SEM-001: hostile deep binary tree could overflow | Use an iterative reference walk and stop semantic checking beyond the fixed expression-depth bound. |
| SEM-003: missing qualified dependency cascaded | Suppress E10239/E10241 only inside the root dependency obligation's proving span. |
| SEM-004: callee-local dynamic index escaped into caller effects | Widen that suffix conservatively to the caller aggregate place. |
| SEM-006: qualified callees lost their typed member shape | Retain `member`, binding and explicit source `qualifiedModule`, without fabricating a value object. |
| SEM-007: final diagnostic ordering was incomplete | Sort located spans by UTF-8 source, start, end and code; put null spans last and retain stable producer order. |

The direct regressions cover every counterexample. Moving the existing recursion
checker to `call-cycles.ts` is the only responsibility split; it keeps the effects
module below the project size limit and adds no layer or public API.

## Sole Focused Re-review

The correctness re-review marked RV-001 through RV-004 resolved and found no
correction-caused critical or major regression. The semantics re-review marked
SEM-001 through SEM-006 resolved. It found one minor SEM-007 tie-break detail:
equal span and code still sorted by message. The sorter now preserves producer
order after code, with a direct regression. Focused verification passes 31/31.
No third independent review is claimed.

## Final Verification

| Check | Result |
|---|---|
| Repository build and typecheck | Pass |
| Repository tests | 811 compiler, 61 CLI and 43 root tests pass |
| Full log | `/tmp/blend65-phase6-final-full.log`; SHA-256 `797b1af5c61ce709d6b5fb811110abfe1376fff0be401bc5372b5b0dc3300019` |
| Touched formatting and whitespace | Pass |
| Documentation-ban scan | Pass |
| Frozen Specification 4 | Unchanged |
| Touched implementation file size | Pass; focused modules remain below the approximate 700-line ceiling, apart from the pre-existing analyzer boundary at 703 lines |

## Authority and Limits

This phase proves target-neutral effects, runtime initializer scheduling and the
internal whole-analysis service. It does not claim selected-profile completion,
asset decoding, CFG/backend lowering, SFA, machine code, ACME artifacts, emulator
behavior, hardware behavior or public CLI/editor acceptance.
