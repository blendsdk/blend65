# Dynamic callable array proof — blocked closeout

> **Issue**: [#167](https://github.com/blendsdk/blend65/issues/167)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Blocked — public-oracle conflict; sound escape slice delivered
> **Recorded**: 2026-11-16

## Outcome

The RD-04 acceptance `callbacks[word(which)](10)` remains **E10277** when `which` is an unbounded
raw-memory byte and an opaque call preceded the read. The first attempt relaxed the opaque reach in
the unchecked/unbounded branch; the independent semantics review rejected it (SM-001) with a
counterexample in which the out-of-bounds read lands on another nameable opaque root. The
conservative rule is restored.

The same read class is pinned as a **rejection** by `test/rd04/bounded-local-index.spec.test.ts`.
The two public oracles conflict, and the frozen spec supports the rejection
(`spec/08-arrays-strings.md` AR-8; `spec/06-functions.md` §4.3; E10277). A specification-test edit
needs explicit user authorization, so #167 stays open.

## Delivered sound slice

- Address-taken storage joins `opaqueRoots`: a non-aggregate `place-address` (`&local`,
  `word(&local)`) and an aggregate place passed as a call argument. Aggregate materialization and
  local copies are excluded.
- The unchecked/unbounded dynamic read keeps `killed.length > 0`: any known kill rejects. Checked
  and proved-bounded reads keep their element-range proof.
- Implementation tests: escaped-address rejection, concrete-placed-kill rejection, private-local
  scalar acceptance after an opaque write, aggregate-copy acceptance, and the unbounded-array
  rejection at `boundsCheck=false`.
- `test/rd05/canonical-fixed-object-abi-fallback.spec.test.ts` follows the verified #166 artifact
  change: 2163→2161 (`74b9d6b8…`).

## Independent review

| Finding | Severity | Resolution |
| --- | --- | --- |
| SM-001 unbounded opaque reach is unsound | MAJOR | **Blocking**; conservative rule restored, oracle decision requested. |
| SM-002 aggregate materialization is not address-taking | MINOR | Fixed: type/call-argument discriminator + copy regression. |
| SM-003 comments, stale PF and evidence | MINOR | Fixed in this record; the #156 "any kill" row is accurate again. |

Review lineage: semantics reviewer, expert skill `2.0.4` (content commit `0e2a6280…`),
specification identity `BLEND65-SPEC-4-038b70e9…`.

## Verification

| Tier | Result |
| --- | --- |
| Implementation | 26/26 in `interprocedural-kills.impl.test.ts` |
| Compiler package | 236 files / 3,939 passed / 2 skipped |
| Host checkpoint | 243 files / 5,111 passed |
| RD-04 VICE acceptance | **Red by design**: E10277 pending the oracle ruling |
| #163 bounded-index oracle | Green: the same unbounded class rejects |
| `spec/` and ledger | Byte-identical |

## Decision requested

**Recommended**: authorize the minimal oracle edit so the RD-04 acceptance proves its index in
bounds while keeping the dynamic-index intent and observation bytes:

```blend65
let which: byte = peek($0440) & 1;
let third: byte = callbacks[word(which)](10);
```

This aligns the test with the #163 contract; the unbounded class stays rejected.

**Alternative** (not recommended): rule that an unchecked out-of-bounds callable read is outside the
typed target contract. That contradicts AR-8 and the #163 oracle and needs a spec/ambiguity decision
record.

## Residuals

| Residual | Owner |
| --- | --- |
| RD-04 acceptance for an unbounded callable-array read | user oracle ruling |
| Volatile raw-memory constant forwarding | separate slice; interrupt-writer proof required |
| Hidden aggregate-return destination | unresolved boundary, no observed source escape |

## Deferral-expiry check

No deferral's reason is invalidated. The change narrows `opaqueRoots` precision and restores the
signed-off AR-8 conservative behavior. The #161 residual that named #167 remains open with this
clear blocker.
