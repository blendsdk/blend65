# Current state: proved returned-local destination

> **Parent**: [Index](00-index.md)
> **Inspected baseline**: `3394f47b83d472ecdb16f67921777ca3e58e2cba`

## Producer-to-consumer facts

| Current owner                                                                                           | Reinspected fact                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [cfg.ts](../../../../../packages/compiler/src/semantic/cfg.ts:197)                                      | Local aggregate declarations supply a place; `freshConstant` marks pure literal construction, not fresh call ownership or full coverage.                                                                  |
| [lower-expressions.ts](../../../../../packages/compiler/src/semantic/lower-expressions.ts:126)          | A local-name return becomes a place address even when the return context supplies a caller destination.                                                                                                   |
| [operations.ts](../../../../../packages/compiler/src/semantic/operations.ts:65)                         | Existing destination kinds are place and caller; there is no whole returned-local certificate.                                                                                                            |
| [whole-program.ts](../../../../../packages/compiler/src/semantic/whole-program.ts:482)                  | Reachability, actual calls, canonical roots, effects and interrupt contexts close before storage inventory.                                                                                               |
| [reachable-globals.ts](../../../../../packages/compiler/src/semantic/reachable-globals.ts:99)           | Private bounded helpers already distinguish exact literals, nonnegative mask bounds, complete footprints, unknown raw addresses and hardware-RAM publication. They currently prove global retention only. |
| [services.ts](../../../../../packages/compiler/src/services/services.ts:199)                            | Whole-program closure precedes reservation, SFA inventory, provisional placement, lowering and final closure.                                                                                             |
| [inventory.ts](../../../../../packages/compiler/src/storage/inventory.ts:395)                           | The two-byte hidden aggregate-result pointer and a separate complete returned-local home are inventoried before emission.                                                                                 |
| [lower-state.ts](../../../../../packages/compiler/src/machine/lower-state.ts:230)                       | Root lookup expects a direct local/parameter home and otherwise assumes a global label; deleting the local request alone is unsafe.                                                                       |
| [lower-aggregate.ts](../../../../../packages/compiler/src/machine/lower-aggregate.ts:218)               | Borrowed parameter addresses and direct homes are distinct; a hidden result pointer cannot be treated as packed data.                                                                                     |
| [lower-aggregate.ts](../../../../../packages/compiler/src/machine/lower-aggregate.ts:549)               | Caller construction already uses the hidden pointer, but nested fresh-constant forwarding currently requires a direct private home.                                                                       |
| [lower-aggregate-return.ts](../../../../../packages/compiler/src/machine/lower-aggregate-return.ts:164) | Current calls also support borrowed/global/existing/forwarded destinations; their presence is not a freshness certificate.                                                                                |
| [lower-aggregate-return.ts](../../../../../packages/compiler/src/machine/lower-aggregate-return.ts:217) | Only already direct caller results avoid return delivery.                                                                                                                                                 |
| [interrupt-specialize.ts](../../../../../packages/compiler/src/machine/interrupt-specialize.ts:94)      | Existing variants concern domain/root/depth/policy, not caller-destination identity.                                                                                                                      |

## Decisive evidence and limits

The [upstream ordinary artifact](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p11--ordinary-aggregate-return-copy-not-an-input-workaround)
owns the exact sources, hashes and cost ledger: an eleven-byte result occupies
both caller and callee objects and has a 21-byte/208-nominal-cycle return tail,
including RTS and its actual read page crossings. No keyboard code is involved.
That is actual construction/byte evidence, not a transformed runtime result.

The [additional-analysis approval](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p11-approval--conservative-whole-function-boundary)
owns the alias counterexample, partial-initialization distinction and narrowed
fallback. Existing helpers make a bounded design plausible; they do not already
prove it. The older rebuilt scanner uses DDR-writing ingress and is not the
selected source. Applicability, pointer/access costs and physical behavior remain
unqualified; the technical contract and decisive tests are owned by
[03-01](03-01-destination.md) and [07](07-testing-strategy.md).

No new tool or dependency is needed. Reuse existing public build/evidence and
sequential VICE facilities; do not introduce a second harness. Any missing
consumer proof blocks its conclusion rather than changing the source contract.

## Independently reproduced baseline exception

Partial array initialization is frontend-legal, but its existing runtime path is
not complete. A public probe of `let result: byte[2] = [7]; return result;` produces
complete frontend analysis with W10140/W10190, then public check/build fails with
`COMPILER_LOWERING: Fixed array construction is missing an element` at this
baseline. [memberWrites](../../../../../packages/compiler/src/machine/lower-aggregate-members.ts:44)
expands the entire declared extent and rejects absent elements. The unchanged
fallback cannot repair that separate defect. T-15 owns its backend repair and
independent runtime expectation; T-14 proves only frontend legality and structural
noninterference on that ineligible path. The defect is not a source or SFA rule.
