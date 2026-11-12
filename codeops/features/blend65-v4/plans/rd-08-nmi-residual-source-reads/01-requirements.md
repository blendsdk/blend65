# Requirements Delta — NMI Residual Source Reads

> **Issue**: [#147](https://github.com/blendsdk/blend65/issues/147) — "close the remaining NMI
> source-read restrictions"
> **Parent**: RD-08 measured output debt; RD-05 NMI route; issue #100 delivered the first slice
> **Updated**: 2026-11-12

## Requirement mapping

| Source requirement | Current state | Plan deliverable |
|---|---|---|
| #147: `if (read() != 0)` compiles with no private home | Fails `E10245`; one retained-value temporary | Direct-read Z ownership for the adjacent zero test |
| #147: `flag = ((read() & 1) != 0)` compiles | Fails `E10245`; two retained-value temporaries | Boolean identity for the constant mask `1` |
| #147: `if ((read() & maskGlobal) != 0)` compiles | Fails `E10245`; one retained-value temporary | Direct-read forwarding into a directly addressable mask |
| #147: `let p = read(); ...` compiles with no local home | Fails `E10245`; one local request | Pre-SFA single-use local elision under NMI |
| #147: each delivered form meets or beats the expert sequence | Admission fails, so no cost exists | Exact expert sequences with measured bytes/cycles |
| #147: the NMI private-home proof is not relaxed | Existing proof rejects every non-installation request | No proof change; requests are removed, never exempted |
| #147: multi-retained samples remain a real negative | Existing negative passes | Keep the negative and record it in docs and tests |
| #147: independent spec oracles on four profiles plus VICE | None for these forms | Spec build/runtime oracles and impl tests |
| #147: exact user-visible restriction in the ledger | Row still covers delivered forms | Narrow the row to the forms that still fail, with a live owner |

## Explicit non-goals

- No NMI proof relaxation or allow-list for any private request.
- No general local elision outside the NMI execution domain.
- No Boolean identity for a mask other than `1`; no materialization larger than the expert.
- No runtime helper, dispatcher, shadow storage or new optimizer framework.
- No `spec/` edit and no takeover source-NMI work.
- No physical-hardware claim.

## Acceptance

1. All four forms build with optimization `none` on all four cooperative profiles.
2. Their memory evidence contains no NMI-private request; the read is a single volatile access and
   the destination is the declared global.
3. Emitted sequences match the expert targets; measured bytes/cycles/stack are recorded.
4. Multi-retained samples and a Boolean value from a non-`1` mask still fail `E10245`.
5. Sequential VICE cases prove representative handler values (bare zero and the single-use local)
   reach mainline; the Boolean and addressable-mask forms have four-profile assembled-byte oracles.
6. The ledger row is narrowed with a live owner; docs record the remaining boundary.
7. `yarn build`, `yarn typecheck`, the complete compiler suite and the affected root suites pass;
   `spec/` is clean.
