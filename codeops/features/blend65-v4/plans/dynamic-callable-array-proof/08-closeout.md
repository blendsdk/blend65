# Dynamic callable array proof — closeout

> **Issue**: [#167](https://github.com/blendsdk/blend65/issues/167)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done
> **Recorded**: 2026-11-16

## Delivered

The RD-04 acceptance now proves its dynamic index in bounds while keeping the same runtime behavior:

```blend65
let which: byte = peek($0440) & 1;
let third: byte = callbacks[word(which)](10);
```

The VICE program still returns `[7, 9, 12, 5, 1, 2, 4, 3, 4]`.

The first attempt relaxed the opaque-kill reach in the unchecked/unbounded branch. Independent
semantics review rejected it (SM-001): an out-of-bounds index can leave the array and land on
another nameable opaque root, so the certified target set can be incomplete. AR-8 forbids assuming
a runtime index stays in bounds, and `test/rd04/bounded-local-index.spec.test.ts` already pins that
class as E10277. The conservative rule is retained and the oracle conflict was resolved with the
user-authorized bounded-index edit on 2026-11-16.

## Sound rule

- An opaque runtime write reaches only roots it can name through the source alias model: globals,
  borrowed aggregate parameters and address-taken storage.
- A non-aggregate `place-address` (`&local`, `word(&local)`) and an aggregate place passed as a call
  argument join `opaqueRoots`. Aggregate materialization and ordinary local copies do not, so a
  `let copy = box;` is not poisoned.
- An unchecked, unbounded dynamic read still treats any known kill as reachable. Checked and
  proved-bounded reads keep their element-range proof.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/semantic/function-targets.ts` | Address-taken roots join `opaqueRoots` (non-aggregate `place-address`, aggregate call arguments) |
| `packages/compiler/src/semantic/assignment-facts.ts` | Conservative unchecked rule retained; comments and options documented; leftover debug block removed |
| `packages/compiler/src/semantic/raw-write-kills.ts` | Opaque-reach documentation includes address-taken storage |
| `packages/compiler/src/semantic/interprocedural-kills.impl.test.ts` | Escaped-address, unbounded-array, concrete-placed-kill rejections and aggregate-copy/scalar acceptances |
| `test/rd04/function-values.spec.test.ts` | User-authorized bounded index `& 1`; observations unchanged |
| `test/rd05/canonical-fixed-object-abi-fallback.spec.test.ts` | Verified #166 artifact identity 2163→2161 |

## Independent review

| Finding | Severity | Resolution |
| --- | --- | --- |
| SM-001 unbounded opaque reach is unsound | MAJOR | Fixed by retaining the conservative rule and bounding the RD-04 index. |
| SM-002 aggregate materialization is not address-taking | MINOR | Fixed with the type/call-argument discriminator + copy regression. |
| SM-003 comments, stale PF and evidence | MINOR | Fixed; the #156 "any kill" row is accurate again. |

Review lineage: semantics reviewer, expert skill `2.0.4` (content commit `0e2a6280…`),
specification identity `BLEND65-SPEC-4-038b70e9…`.

## Verification

| Tier | Result |
| --- | --- |
| Implementation | 26/26 in `interprocedural-kills.impl.test.ts` |
| RD-04 VICE acceptance | Pass; observed `[7, 9, 12, 5, 1, 2, 4, 3, 4]` |
| #163 bounded-index oracle | 16/16; the unbounded class still rejects |
| Compiler package | 236 files / 3,939 passed / 2 skipped |
| Host checkpoint | 243 files / 5,111 passed |
| Complete `yarn test:full` | Host and compiler green; the only failure is the known host-load `vic-collision-vice` timing case (1373/2378 root tests passed, 4 skipped, 1 failed), which passed 16/16 on an isolated serialized rerun. |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Volatile raw-memory forwarding for `poke($addr, c); peek($addr)` | separate slice; asynchronous-writer proof required |
| Hidden aggregate-return destination | unresolved boundary, no observed source escape |
| Cross-block bounds | existing #163 precision debt |

## Deferral-expiry check

No deferral's reason is invalidated. The sound escape rule sharpens the existing `opaqueRoots`
model; the conservative unbounded rule, the #163 precision debt, the checked-index path and the
callable-invalidation tests keep their owners. The #161 residual that named #167 is satisfied by the
bounded RD-04 witness and the delivered escape rule.
