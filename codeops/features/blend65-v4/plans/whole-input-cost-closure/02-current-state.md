# Current state: whole-input cost closure

> **Parent**: [Index](00-index.md)
> **Observed**: 2026-10-12; no production/test change or compiler run in this planning task

The retained measured endpoint and full analytical ledger are owned by the
[decision register](00-ambiguity-register.md#investigation-baseline). Current
capability is **Verified partial**: ordinary behavior passes, complete costs do
not. New implementation sufficiency is **Unknown**.

## Existing seams

| Location | Observed distinction | Required consumer |
| --- | --- | --- |
| `semantic/operations.ts:54,192` and `whole-program.ts:56` | Symbolic roots/paths and exact direct-call arguments survive; the aggregate graph alone lacks actual object forwarding/stability facts. | 03-01 object analysis |
| `machine/lower-startup.ts:94,135` | Forwarded parameter roots and raw RAM writes keep full startup; raw addresses use literal-only lookup. | 03-03 final display/observer proof |
| `semantic/value-lifetimes.ts:105`, `storage/inventory.ts:54,448` | Computed values have CFG lifetimes; declared locals/parameters currently reserve conservative whole-function homes. | 03-01 local lives and 03-02 selected recipes |
| `storage/interference.ts:249,294`, `machine/lower.ts:592` | Call/helper edges exist; helper descriptors conservatively list all caller requests. | Actual call-site live requests |
| `machine/lower-comparison.ts:98`, `lower-register-forwarding.ts:478` | Equality can clobber A; returned A availability is not callee Z ownership. | Exact CMP/edge and selected-exit rules |
| `semantic/guarded-place-proof.ts:62` | Use-site bounds exist but deliberately do not infer recurrence or narrow counters. | Recognized fixed-induction proof |
| `services/shared-storage.ts:77` | Initial homes are provisional; trailing RAM is reclosed and code shape revalidated. | Final baseline/candidate observer validation |
| `storage/storage-types.ts:108,168` | Startup-held stack and a finite binder request universe already exist. | Compact held-P startup and closed recipes |
| `services/types.ts:31`, `services/services.ts:123`, `cli/src/args.ts:98` | Public/CLI overrides support only none; manifests already accept four goals. | Explicit size plumbing without full four-mode claim |
| `services/evidence.ts:350,429` | Costs/debug have mode and decision/optimization fields; current decisions are empty and complete-path cycles are Unknown. | Honest closed candidate evidence, not fabricated timing |
| `services/services.ts:231,311,413,427` | Canonical allocation/closure/resource failure currently stops before selected alternatives; checked source input is not retained as a nonterminal reference outcome. | Approved PF-002 reference/result separation |
| `artifacts/costs-evidence-validator.ts:461,464` | Both decision IDs currently require feasible records and the component check reads the baseline vector. | Approved existing-v1 rejected-baseline validation correction |

Locations above are relative to `packages/compiler/src/`, except the explicitly
named CLI path, which is `packages/cli/src/`. Existing code is an audit subject,
not a source-language authority.

## Source consumers

`packages/compiler/stdlib/c64/input.blend` has five ordinary routines: acquisition,
key query, joystick query, compatibility and sole-source. The actual source has
word counters, byte shifts/complements, nested fixed loops and a saved byte used
after a pure helper. The callback is separate and callback-only. The component
proof map in 03-02 accounts for each pattern; none becomes a compiler intrinsic.

## Dependencies and evidence limits

RD-04 supplies the correct generic fallback and existing closure/emitter. AR-P4
explicitly permits this partial RD-08 prerequisite before RD-06/RD-07, without
qualifying their unavailable asset/delivery consumers. The inherited keyboard
work is preserved, not presumed committed or fully qualified. Historical
pre-AR-P33 exception integrity remains Unknown in its owner; this design does
not re-clear it. Current compiler/build/typecheck results are retained evidence,
not fresh verification for this plan. VICE remains the execution oracle; physical
revision/edge QA belongs to RD-10.

PF-001–PF-003 were explicitly approved on 2026-10-12. Their document corrections
do not implement the new facts or validator. The fixed recipe constructor avoids
a new regional composition engine. Its numerical sufficiency, including retained
matchingColumns storage and the looped saved caller, remains an implementation
qualification obligation under unchanged original limits.
