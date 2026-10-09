# Current state — direct constant nested construction

> **Parent**: [Index](00-index.md)
> **Baseline**: 4d99f58f

| Existing path                         | Fact / smallest required change                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `semantic/cfg.ts:196`                 | Local initialization already selects the final root place; distinguish that fresh lifetime from assignment/global/caller destinations.                                 |
| `semantic/lower-expressions.ts:480`   | Only the outer literal receives the destination. Preserve its existing effect-capture path; forward nested constants only after whole-tree purity and ownership proof. |
| `semantic/operations.ts:66`           | Existing destination union and field/index paths suffice; proof metadata may enrich a place arm, without a new operation or destination kind.                          |
| `semantic/value-lifetimes.ts:64`      | Aggregate uses omit destination indices; retain generated constant-path value dependencies through liveness.                                                           |
| `machine/lower-aggregate.ts:579`      | Nonempty destination paths currently allocate pointers. Existing constant address plans and offset homes permit direct fresh-local subhomes.                           |
| `machine/lower-aggregate-build.ts:36` | Declared member offsets already exist; both builders stage/copy child values. Omit only exact already-completed final member intervals.                                |
| `machine/lower-function.ts:127`       | Include destination-index uses in existing machine value accounting; keep literal-load reuse confined to proved construction.                                          |
| `storage/closure.ts:333`              | Existing bounded binder/closure certifies discovered homes; no replacement or bypass is needed.                                                                        |

Paths above are under `packages/compiler/src/`. A small focused helper module is
permitted if needed to avoid enlarging the existing large expression/build modules;
it owns only this construction logic, not a new layer or generalized mechanism.

Discovery and exact ordinary-source artifact identities remain in
[keyboard AR-P9](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p9--ordinary-nested-constant-construction-prerequisite).
The measured initializer uses a redundant eight-byte temporary and two ZP pairs.
Its prior calculated reference is analytical, not an executed golden.
