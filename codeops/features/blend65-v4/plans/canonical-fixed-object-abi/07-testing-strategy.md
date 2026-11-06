# Testing strategy: Canonical fixed-object ABI

> **CodeOps Artifact Schema**: 1
> **Authority**: C-1–C-11, AR-P6–AR-P9; frozen language/CPU semantics

## Independent specification cases

Use new independently authored
`test/rd05/canonical-fixed-object-abi.spec.test.ts` and, if separation is needed,
`canonical-fixed-object-abi-fallback.spec.test.ts`. Authors get this contract and
public interfaces, never implementation/review answers. Old spec files stay fixed.

| Case | Input → independent expectation |
| --- | --- |
| ST-1 | One completed returned local and one caller destination → exact constructed/updated bytes, no final copy/runtime hidden pointer, one source callee body. |
| ST-2 | Same returned object used by a borrowed helper → correct elements/results/effects without an added aggregate pointer; caller state survives. |
| ST-3 | Borrower called with returned object and another object → both read correctly; generic borrower fallback, never a globally hard-wired first origin. |
| ST-4 | Two destinations/nested aggregate calls → independent values and source order; no guessed unique destination or overwritten outer staging. |
| ST-5 | Raw/escaped/async observation prevents a necessary proof → existing legal generic behavior or existing authorized diagnostic; no new restriction/unsafe publication. |
| ST-6 | No eligible return group but ordinary borrowed calls → no unrelated specialization; existing saved `none` fixture stays exact. |
| ST-7 | Unchanged four-profile ordinary/acquisition sources → all existing function/startup/BSS/resource gates pass with truthful preservation and unchanged source hashes. |
| ST-8 | Native consumers and varied incoming state → independently computed aggregate bytes, ordered MMIO, A/X/Y/P/SP and bank/device restoration. No input-device/unrestricted-NMI qualification claim. |

Pointer absence must follow real resource/machine/debug evidence, not a label
spelling. Establish RED on output/resource obligations where generic behavior
already passes; do not manufacture a source failure.

## Implementation/corruption cases

| Case | Obligation |
| --- | --- |
| IT-1 | Complete restricted recipes; reject pruning/stale source/call/owner/parameter/result |
| IT-2 | Mixed origins and different result roots never specialize incorrectly |
| IT-3 | Removed pointer has no surviving access; backing stays declared/live and cannot be omitted |
| IT-4 | Corrupt physical backing, width, binding, result row, lifetime or interrupt overlap fails; numeric equality is insufficient |
| IT-5 | Direct/Original and absent optimization facts stay explicit; unrelated passes cannot activate |
| IT-6 | Generic fallback preserves diagnostics, startup retry, failure categories and atomic publication |
| IT-7 | Metadata-only generic construction preserves baseline operations, demand, data and startup; both actual layouts have authentic associations; stronger bounds/folding/global removal stay inert and optimized output stays exact |
| IT-8 | Byte-loop/MMIO correspondence rejects changed predicate/direction, initialization/update, bypass entry, stale index/flags, wrong source-block membership, uncertified ABI difference and changed raw/dummy/pointer access or order/count in either layout |

IT-7 is a prerequisite to final-observer integration, not a post-publication
check. IT-8 qualifies the existing residual owner only; passing it grants no
source/typed/physical exemption. Independent semantics review covers evaluation,
snapshots, aliases, nested calls and acceptance, with semantic preservation and
modern-source developer experience reported separately.

## Existing gates and full verification

Run unchanged returned-local output/runtime/destination cases, borrow/storage/
provenance/startup/BASIC-save and import-boundary guards, plus complete
`optimizer-exact-output.impl.test.ts`. Preserve saved709, acquisition943,
none2163/hash and every ceiling. Use real ACME; VICE runs sequentially. Separate
behavior and assembly/resource expectations; differential execution is supporting.

Before checkpoint run install, build, typecheck, complete owned tests and
complete `yarn test` to exit zero; targeted Prettier and frozen-authority checks
also pass. Runtime status is VICE-verified/hardware-unverified. The root and
remaining RD-05 checklists retain their own completion gates.
