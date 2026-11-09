# Task RD-06 Residual Closure: T-20–T-27

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: RD-06 residual parity and evidence debt; [issue #140](https://github.com/blendsdk/blend65/issues/140)
> **Created**: 2026-11-09 15:19
> **Progress**: 8/8 tasks (100%)
> **Status**: Complete after independent review fixes and final verification
> **Last Updated**: 2026-11-09 19:40
> **Phase baseline tree**: `2e7b02bd5ba632ef9b29cf5562a670caf16cf61a`
> **Scope mode**: strict; the exact source and test paths are listed in the modification set below
> **Reasoning**: high — lowering, layout, volatile-effect and cost-oracle changes with hardware-visible consequences
> **Verify**: `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test` (directed suites during tasks; complete compiler suite plus directed root/RD-06/VICE before the final checkpoint)

## Objective and Scope

Close the eight residual RD-06 defects tracked by issue #140 and roadmap rows T-20–T-27. The work
restores expert-parity instruction selection and byte cost for proved raw addresses, makes VIC
field failures source-linked, makes relocated-screen sprite pointers layout-derived, and completes
handler inventory and VIC memory-view evidence. It adds no language feature, runtime, public API,
optimizer pass, framework or source restriction except the single tracked ambiguous-multi-screen
rejection named under T-27.

| Boundary | Scope |
|---|---|
| Planning target | T-27, T-24, T-21, T-20, T-22, T-23, T-25 and T-26, in that order |
| Context | RD-06 [closeout](../rd-06-native-assets/09-closeout.md), [findings](../rd-06-native-assets/05-findings.md), [resident layout design](../rd-06-native-assets/03-06-resident-layout-evidence.md), issue #140, frozen Specification 4.0, AGENTS.md |
| Planning writes | This mini-plan, the feature roadmap task rows, and the RD-06 findings/closeout residual disposition |
| Implementation writes | The exact source and test paths in the modification set below; the Q-P15 expected-byte oracle and the T-27 expressiveness-ledger row |
| Excluded | T-19 GoatTracker adapter, SR-828 historical red-phase gap, CharPad 3.88 release qualification, the RD-05 VIC collision timing flake, new public APIs, general alias/optimizer frameworks, `spec/` edits |
| Runtime status | `VICE-verified / hardware-unverified` remains the bound |

`spec/` is frozen and must remain untouched. Every task preserves existing resource ceilings,
pinned profiles, volatile order and behavior oracles except for the intentional changes recorded
in the changed-oracle table below.

## Changed Oracles and Intended Behavior

| Task | Intentional change | Evidence to update |
|---|---|---|
| T-20 | Proved single-byte `poke(base + index)` uses `sta absolute,x` in the existing optimized-mode proof; `optimization: none` keeps the T-21 383 baseline because the none bounds pass has no fixed-loop facts. No unproved write changes. | Directed optimized write tests and RD-05 raw-address costs; the pinned `none` fixture and Q-P15 stay byte-identical at 383. |
| T-21 | The post-layout VIC logical fold removes its identity op in ordinary functions; code payload shrinks by two bytes per fold. | Q-P15 `renderBytes`; layout/fold tests. |
| T-22 | Proved static `poke(&asset)` and `poke(&local)` use direct absolute storage operands instead of a pointer pair. | Raw-address cost tests; RD-05 mutable-value/source-library tests if they pin the construct. |
| T-23 | Post-layout immediate arithmetic/shift chains fold under a complete C/V-liveness proof. | Fold cost tests; VIC field arithmetic cases. |
| T-24 | VIC field failures report source-linked E10143/E10273 instead of generic `COMPILER_LOWERING`/`COMPILER_LAYOUT`. | Diagnostic negative tests and existing positive cases. |
| T-25 | SPD/CTM inventories publish exact parsed array extents; remedies list only available selectors. | Handler inventory tests and dispatch diagnostics. |
| T-26 | `vic-bank-0` gains VIC-scoped clipped projections and explicit screen/character-ROM reservation fragments. | `.memory.json` reconciliation tests; resident-RAM evidence formula. |
| T-27 | `setSpritePointer` targets the active screen's pointer table; the active screen occupies its full 1,024-byte footprint. | Layout/VICE tests; `.memory.json`; expressiveness ledger for ambiguous multi-screen use. |

No other oracle, ceiling, pinned profile or diagnostic is weakened. The pinned `none` PRG identity
`0417b7da8c4eabb022e6ec868e0d8dcaf4b4727da83d43e29fcbe98e16a02a93` must remain unchanged unless the
affected fixture actually uses the changed construct; any change requires a recorded ruling.

## Verified Baseline

| Fact | Evidence |
|---|---|
| `setSpritePointer` writes `$07F8` from the profile constant | `packages/compiler/src/machine/lower-c64.ts:701–726`, `packages/compiler/src/target/c64-kernal.ts:66,133` |
| `vicScreenSelect` accepts a constant or symbolic address and returns a field value | `packages/compiler/src/machine/lower-c64.ts:451–506` |
| The VIC screen transform derives a 1-KiB-aligned bank-relative field | `packages/compiler/src/machine/vic-fields.ts:43–70` |
| VIC folds run after function sizing and keep an identity logical op | `packages/compiler/src/layout/c64-layout-objects.ts:124–168`, `packages/compiler/src/layout/c64-layout.ts:717–720` |
| The proved ordinal read path already selects `lda absolute,x` and is optimized-mode-only | `packages/compiler/src/machine/lower-memory.ts:155–188`, `packages/compiler/src/machine/lower-register-forwarding.ts:253–291`, `packages/compiler/src/machine/lower-function.ts:162–164` |
| Dynamic raw writes still allocate a pointer pair and use `(zp),Y` | `packages/compiler/src/machine/lower-memory.ts:274–347` |
| `&asset` is a symbol address; `&local` currently becomes a zero-page pointer pair | `packages/compiler/src/machine/lower-operation.ts:632–688`, `packages/compiler/src/machine/lower-aggregate-place.ts:173–229` |
| Lowering errors keep a source span, but `size-selection` discards it as `COMPILER_LOWERING` | `packages/compiler/src/machine/lower-state.ts:46–58`, `packages/compiler/src/services/size-selection.ts:359,369,642` |
| Layout transform failure becomes `COMPILER_LAYOUT` with no span | `packages/compiler/src/layout/c64-layout.ts:717–720`, `packages/compiler/src/services/size-selection.ts:553,573` |
| Handler inventories use zero-length array types and unfiltered remedies | `packages/compiler/src/assets/c64/spritepad.ts:60–104,480`, `packages/compiler/src/assets/c64/charpad.ts:65–108,438,586` |
| The VIC view drops every interval that crosses `$4000` | `packages/compiler/src/services/evidence.ts:563–570` |
| Q-P15 is `optimization: none`; its pinned none sibling fixture has only constant pokes | `test/rd06/qualification/q-p15/blend65.json`, `test/rd05/fixtures/input-saved-caller.blend`, `test/rd08/optimizer-exact-output.impl.test.ts:32–36` |

Measured residual deltas from issue #140:

| Defect | Current | Expert target |
|---|---|---|
| T-20 ordinal write | 16-bit address plus `(zp),Y` | one `sta absolute,x` |
| T-21 post-layout fold | 2 identity code bytes per folded VIC op | 0 identity code bytes |
| T-22 static raw address | 22 bytes / 32 cycles / 4 ZP | 5 bytes / 6 cycles / 0 ZP in a RAM home |
| T-23 VIC constant arithmetic | +3 bytes / +4 cycles | one immediate `lda` |

## Smallest Viable Design

| Task | Selected design | Rejected alternative and reason |
|---|---|---|
| T-27 | Derive one active screen from a unique `vicScreenSelect` argument (label or constant) in reachable function bodies and reachable module initializer blocks. The frozen compile-time `const` field form is rejected earlier by E10191 and is recorded as existing language debt, not claimed here. For a label/asset screen, resolve `setSpritePointer` to `screenStart + $3F8 + index` and occupy the full 1,024-byte footprint with a 16-byte zero tail and an 8-byte pointer-table interval. A constant selection resolves the same pointer base but creates no layout footprint; it remains user-owned like raw `$D018`. Default `$07F8` when no screen is selected; more than one distinct base is a source-linked E10273 recorded in the expressiveness ledger. | A new `setSpritePointer(screen, ...)` API is a frozen-API break; runtime table discovery is not compile-time; post-placement 8-byte reservation cannot prevent collisions; silent choice among screens is wrong; reserving a constant raw window would force a 1 KiB PRG fill the user did not request; scanning unreachable functions would let dead code change live layout. |
| T-24 | Carry a structured diagnostic code, source span and named contributors out of VIC lowering and layout. E10143 stays the one-object asset alignment/visibility placement diagnostic; constant field failures, out-of-bank, character-ROM, cross-object, non-asset and explicit-place conflicts use E10273. | Keeping `COMPILER_*` with only a span hides the required code and contributors; mapping constant fields to E10143 conflicts with the frozen asset-placement trigger/template. |
| T-21 | Remove the identity logical op after the post-layout transform in ordinary functions in both the draft and final layouts, using the same fold and compaction so the shared-storage stability shape matches; repair at fixed origins to a monotonic fixed point; recompute code intervals and fill without moving any asset or data address. Keep the identity form for a function that cannot shrink without growth and file the gap; leave the startup path untouched. | Full fixed-point re-layout can move assets, invalidate resolved VIC addresses and oscillate; a hard build failure rejects a program that previously compiled; compacting only the final layout fails the existing draft/final stability shape gate. |
| T-20 | Extend the proved `constant base + bounded byte index` selection to single-byte volatile writes and emit `sta absolute,x` in the existing optimized-mode proof. The write proof admits only an immutable index and a value that can be loaded into A after X is set; conflicting ownership falls back to the indirect path. The `none` bounds pass has no fixed-loop facts, so none keeps the T-21 383 baseline and the extension is recorded as a tracked gap. | Enabling none would require a new loop-bound source for the unoptimized pass, which is outside this residual slice; device-window bases are not admitted by the current raw observer proof and remain a tracked gap. |
| T-22 | Select a direct absolute store for symbol addresses and statically resolved local/global places whose home is not a parameter, returned-local base or borrowed pointer; keep the indirect path for genuinely dynamic addresses. Read-only assets remain E10123; the symbol-address lowering path is covered by unit tests. | Reusing a certified zero-page pair removes only the copy and still misses the expert 5-byte/6-cycle result; a broad `storage` acceptance could store through a pointer home. |
| T-23 | Extend the post-layout immediate fold to adjacent `lda #a; clc; adc #b`, `lda #a; sec; sbc #b` and accumulator shift chains when a complete forward C/V-liveness proof reaches the next definition without a read; reuse T-21's fixed-origin compaction. | Folding without a flag proof can change a later branch or word-add carry; keeping the chain misses the parity target. |
| T-25 | Build inventories from parsed extents and list only available selectors in remedies. Exact lengths come from the actual parsed slices, including packed-12 `cells + ceil(cells/2)` and canonical byte/word cell widths. | Keeping zero-length placeholders and filtering only at dispatch leaves misleading inventory evidence. |
| T-26 | Add VIC-scoped projection records in the global `intervals` under the dedicated `cpu16-vic` projection space with `bankId: "vic-bank-0"`: every CPU interval clipped to `[0,$4000)`, split into screen/character-ROM reservation fragments so each address appears once. The CPU view and the resident-RAM/zero-page/scratch/SFA-hash consumers remain on `cpu16`; the VIC view reads `cpu16-vic`; the evidence sort includes `bankId`. | Overlapping reservations double-count; dropping crossings leaves the view incomplete; reusing `cpu16` makes every legacy CPU consumer count the projection twice; a per-view schema is a frozen version-1 change. |

No task adds a new compiler pass, runtime helper, dependency, public schema or generalized support
framework. The new diagnostic plumbing, static-address marker and fixed-origin compaction are
direct producers inside existing owners.

## Modification Set

| Task | Source files | Test files |
|---|---|---|
| T-27 | `packages/compiler/src/machine/active-screen.ts`, `lower-c64.ts`, `lower-control.ts`, `lower-state.ts`, `machine-types.ts`, `lower-data.ts`, `packages/compiler/src/layout/c64-layout.ts`, `c64-layout-objects.ts`, `packages/compiler/src/services/evidence.ts`, `packages/compiler/src/artifacts/acme-serializer.ts` (only if the operand/effect needs a binding spelling) | `packages/compiler/src/layout/c64-layout.impl.test.ts`, `test/rd06/layout-assets.spec.test.ts`, new `test/rd06/vice-sprite-pointer.spec.test.ts`, `test/rd04/expressiveness-ledger.json` and its gate |
| T-24 | `packages/compiler/src/machine/lower-state.ts`, `lower-c64.ts`, `lower.ts`, `vic-fields.ts`, `packages/compiler/src/layout/c64-layout.ts`, `c64-layout-objects.ts`, `packages/compiler/src/services/size-selection.ts`, `resource-diagnostics.ts` | New `test/rd06/vic-diagnostics.spec.test.ts`, `packages/compiler/src/machine/lowering.spec.test.ts`, `packages/compiler/src/layout/c64-layout.impl.test.ts` |
| T-21 | `packages/compiler/src/layout/c64-layout-objects.ts`, `c64-layout.ts` | `packages/compiler/src/layout/c64-layout.impl.test.ts`, `test/rd06/qp15.spec.test.ts`, `test/rd06/qualification/q-p15/expected.json` |
| T-20 | `packages/compiler/src/machine/lower-register-forwarding.ts`, `lower-arithmetic.ts`, `lower-memory.ts`, `lower-state.ts`, `lower-operation.ts`, `lower-function.ts`, `lower-bounds.ts`, `lower-control.ts` (ordinal-address comment only), `packages/compiler/src/services/size-observer-raw-layout.ts` (write sequence) | `packages/compiler/src/machine/lower-proved-ordinal.impl.test.ts`, `lower-memory-addressing.impl.test.ts`, `test/rd06/qp15.spec.test.ts` and `expected.json`, new `test/rd06/residual-write-cost.spec.test.ts`, `test/rd06/project-fixture.ts` (optional optimization fixture) |
| T-22 | `packages/compiler/src/machine/lower-memory.ts`, `lower-control.ts`, `lower-state.ts`, `lower-operation.ts`, `lower-aggregate-place.ts`, `lower-register-forwarding.ts`, `lower-function.ts` | `packages/compiler/src/machine/lower-memory-addressing.impl.test.ts`, new `test/rd04/raw-static-address.spec.test.ts`, `test/rd05/profile-mutable-values.impl.test.ts`, `test/rd05/source-library-*.spec.test.ts` as affected |
| T-23 | `packages/compiler/src/layout/c64-layout-objects.ts`, `c64-layout.ts` | `packages/compiler/src/layout/c64-layout.impl.test.ts`, `test/rd06/layout-assets.spec.test.ts` |
| T-25 | `packages/compiler/src/assets/c64/spritepad.ts`, `charpad.ts`, `koala.ts`, `psid.ts`, `packages/compiler/src/assets/asset-diagnostics.ts` (only if a shared remedy helper is added) | `packages/compiler/src/assets/c64/spritepad.spec.test.ts`, `spritepad.impl.test.ts`, `charpad.impl.test.ts`, `koala.spec.test.ts`, `psid.spec.test.ts`, `packages/compiler/src/assets/asset-handler.impl.test.ts` |
| T-26 | `packages/compiler/src/services/evidence.ts`, `packages/compiler/src/artifacts/memory-evidence-validator.ts` (projection exclusion only) | `test/rd06/layout-assets.spec.test.ts`, `test/rd06/evidence-assets.impl.test.ts` |

New exported types, functions and properties receive JSDoc in the project style. Test tiers are
`*.impl.test.ts` for internal proofs and `*.spec.test.ts` for observable behavior.

## Tasks

### T-27 — Relocated-screen sprite-pointer base

- [x] T-27.1 Write RED coverage: a screen at `$0C00` with `setSpritePointer` emits `$0FF8` (and `$0FF8,x` when indexed); a runtime module-initializer `let` selection is recognized; dead-function selections are ignored; default `$0400` still emits `$07F8`; a constant `vicScreenSelect($0C00)` resolves `$0FF8` without creating a layout footprint; two distinct active screens fail with source-linked E10273 through the existing placement-failure path; a 1,024-byte screen and a screen at `$3C00` keep the pointer table at `$3FF8`. The frozen compile-time `const` field form remains E10191 language debt and is not claimed. ✅ (completed: 2026-11-09 17:45)
- [x] T-27.2 Write the sequential VICE regression: after a screen-at-`$0C00` build, `$0FF8` contains the written pointer byte and `$D018` selects the `$0C00` screen field. ✅ (completed: 2026-11-09 16:18)
- [x] T-27.3 Mark the screen role, occupy its full 1,024-byte footprint during placement, add the 16-byte zero tail and 8-byte pointer table, and resolve the symbolic pointer-table operand/effect after layout. ✅ (completed: 2026-11-09 16:18)
- [x] T-27.4 Record the ambiguous multi-screen rejection in the expressiveness ledger and verify the default-screen, relocated-screen, bank-end, collision, VICE and unchanged startup `$07F8` preservation cases. ✅ (completed: 2026-11-09 16:18)

### T-24 — Source-linked VIC field diagnostics

- [x] T-24.1 Write RED coverage: a constant misaligned or out-of-bank field, character-ROM overlap, a non-asset argument and an explicit-place conflict are source-linked E10273; a compiler-placed one-object asset alignment/visibility failure remains E10143; every message names the field, object/address, required alignment/visibility and conflicting intervals or holes. ✅ (completed: 2026-11-09 16:22)
- [x] T-24.2 Return a structured failure reason from `vic-fields.ts`; extend the lowering failure contract with a diagnostic code and contributors; copy those fields through the `lower.ts` catch boundary and preserve the source span through `size-selection.ts`. ✅ (completed: 2026-11-09 16:22)
- [x] T-24.3 Return a structured transform failure from `resolvePlacementTransforms` and `layoutC64Program`, then map it to source-linked E10273 with the placed label, final address, transform and conflicting intervals. ✅ (completed: 2026-11-09 16:22)
- [x] T-24.4 Verify the new negative cases, every existing E10143/E10273 positive case, and the unchanged generic `COMPILER_*` fallback for non-VIC failures. ✅ (completed: 2026-11-09 16:22)

### T-21 — Post-layout VIC fold sizing

- [x] T-21.1 Write RED coverage: a folded VIC logical op emits one `lda` with no identity `ora`/`and`/`eor`; the owning ordinary function shrinks by two code bytes; a following branch still targets the repaired block; a long branch near the boundary reaches a fixed point; a startup fold keeps its identity form; no executable zero fill remains. ✅ (completed: 2026-11-09 16:24)
- [x] T-21.2 Remove the identity logical op after transform resolution in ordinary functions in both the draft and final layouts with identical fold/compaction; repair at fixed origins to a monotonic fixed point and recompute code intervals, fill and load range without moving assets or data. ✅ (completed: 2026-11-09 16:24)
- [x] T-21.3 If a function cannot shrink without growth, keep its identity form and record the measured 2-byte gap; never reject a program that previously compiled. Verify the shared-storage draft/final shape gate remains stable and that SFA trailing ranges use the same compacted size. ✅ (completed: 2026-11-09 16:24)
- [x] T-21.4 Re-baseline Q-P15 `renderBytes` from 385 to the measured T-21 value (383 for one folded op), record the ruling, and verify the exact byte/cost assertions. ✅ (completed: 2026-11-09 16:24)

### T-20 — Ordinal volatile-write lowering (`sta absolute,x`)

- [x] T-20.1 Write RED coverage: `poke(base + index, value)` with a proved single-use ordinary-RAM base, an immutable bounded index and a value that can load into A selects the ordinal write path in an optimized mode; unknown, width-2, device, wrapping, modified-index, unshared and X-owned-value cases keep the indirect path. ✅ (completed: 2026-11-09 16:36)
- [x] T-20.2 Add `ordinalRawWrites` to the existing address-proof selection and install it under the existing optimized-mode gate; reject conflicting index/value ownership as a selection fallback, not a diagnostic. ✅ (completed: 2026-11-09 16:36)
- [x] T-20.3 Lower the ordinal write as index-to-X, value-to-A, `sta absolute,x`; keep low-first width handling, volatile order and write-specific observer evidence consistent with the proved read path. ✅ (completed: 2026-11-09 16:36)
- [x] T-20.4 Add exact byte/cycle unit tests and a built-program assembly oracle; verify the pinned `none` PRG identity and Q-P15 383 stay unchanged; record the none-mode loop-bound and `$D800` Color-RAM gaps as tracked debt. ✅ (completed: 2026-11-09 16:36)

### T-22 — Static raw-address direct store

- [x] T-22.1 Write RED coverage: `poke(&asset, value)`, `poke(&local, value)` in RAM and zero-page homes, and `poke(&global, value)` select a direct absolute store with no dynamic pointer request; a RAM home is 5 bytes/6 cycles, a zero-page home is 4 bytes/5 cycles; parameter and borrowed bases keep the indirect path. ✅ (completed: 2026-11-09 16:40)
- [x] T-22.2 Add a static-address selector/`LoweredValue` kind for symbol addresses and statically resolved places consumed by the next raw write; suppress the pointer-pair construction for the store while leaving ordinary reads on their existing path. ✅ (completed: 2026-11-09 19:10)
- [x] T-22.3 Lower static byte and word writes with direct storage/label operands, preserving low-first order and volatile effects; publish the static recipe in observer evidence. ✅ (completed: 2026-11-09 19:10)
- [x] T-22.4 Verify exact costs, absence of the dynamic pointer request, unchanged behavior, and the existing raw-address negative cases; update RD-05 cost expectations only where they pin the changed construct. ✅ (completed: 2026-11-09 16:40)

### T-23 — VIC field constant arithmetic

- [x] T-23.1 Write RED coverage: `vicSpriteBlock(&S) + 1` emits one immediate `lda` with no `clc`/`adc`; the subtract and accumulator-shift forms fold; a following C/V-reading consumer, `php`/`plp`, call, branch or block boundary keeps the original chain. ✅ (completed: 2026-11-09 16:44)
- [x] T-23.2 Extend the post-layout fold to adjacent immediate `clc`/`adc`, `sec`/`sbc` and `asl`/`lsr` chains with a forward C/V-liveness proof; reuse T-21's fixed-origin compaction and leave startup untouched. ✅ (completed: 2026-11-09 16:44)
- [x] T-23.3 Verify exact byte/cycle costs, the flag-unsafe rejection cases, the branch/fallthrough repair and the unchanged logical fold behavior from T-21. ✅ (completed: 2026-11-09 16:44)

### T-25 — Handler inventory and remedy accuracy

- [x] T-25.1 Write RED coverage: SPD and CTM inventories publish exact parsed array extents (including canonical byte/word cells and packed-12 `cells + ceil(cells/2)`); unavailable selectors are absent from every applicable E10132/E10133 remedy. ✅ (completed: 2026-11-09 16:47)
- [x] T-25.2 Build SPD/CTM inventories from the actual parsed slices and counts; add the available-selector filter used by every native handler remedy. ✅ (completed: 2026-11-09 16:47)
- [x] T-25.3 Verify exact inventory types, positive selector dispatch, negative unavailable-selector diagnostics and unchanged handler hashes. ✅ (completed: 2026-11-09 16:47)

### T-26 — VIC view crossing intervals and reservations

- [x] T-26.1 Write RED coverage: an interval crossing `$4000` appears in `vic-bank-0` as a VIC-scoped record covering `[start,$4000)`, with last address `$3FFF`; a relocated active screen and the character-ROM window appear as explicit reservation fragments even when CPU PRG fill covers them; each address appears once and the view still reconciles. ✅ (completed: 2026-11-09 16:55)
- [x] T-26.2 Add VIC-scoped projection records with `bankId: "vic-bank-0"`; clip at `$4000` and split around screen/character-ROM reservation fragments; make `buildView` bank-aware; select only non-`bankId` records for the CPU view and the resident-RAM/zero-page/scratch/SFA-hash consumers; include `bankId` in the evidence sort. ✅ (completed: 2026-11-09 16:55)
- [x] T-26.3 Verify both views reconcile, free-interval math is exact, `.costs` resident RAM/zero-page/scratch are unchanged, the updated evidence formula excludes projections, and the existing RD-06 layout cases pass. ✅ (completed: 2026-11-09 16:55)

## Independent Review and Closeout

- [x] Run the project's required independent review over the whole task diff: correctness reviewer, machine-code auditor, target-platform auditor, SFA/ABI auditor and semantics reviewer; fix every critical/major finding and re-verify. ✅ (completed: 2026-11-09 19:40; dispositions in [05-findings.md](05-findings.md))
- [x] Update the RD-06 `05-findings.md` dispositions and `09-closeout.md` residual table with the exact verified evidence; do not leave stale "deferred to T-20…T-27" rows. ✅ (completed: 2026-11-09 19:40)
- [x] Propose issue #140 closure with the evidence; close it only on explicit user instruction. ✅ (proposal recorded; no external issue mutation made)
- [x] Update the roadmap T-20–T-27 rows to Done with the verified evidence. ✅ (completed: 2026-11-09 19:40)

## Final Verification

- [x] Run `yarn install --frozen-lockfile`, `yarn build` and `yarn typecheck` from the repository root. ✅
- [x] Run the complete compiler package suite and the directed RD-04/M1/RD-06 plus VICE suites; run VICE cases sequentially. ✅ compiler 3,644 passed/2 skipped; RD-04 + M1 + RD-06 714/714.
- [x] Run the affected RD-05 raw-address/mutable-value/source-library suites and the RD-08 exact-output identity test. ✅ affected RD-05 377/377 plus joystick 220/220 and raw footprints 100/100; RD-08 exact identities unchanged.
- [x] Attempt the complete root `yarn test` suite and record the actual coverage if the known 90-minute host limit is reached; a known flake must be rerun to green and the rerun recorded, never waived. ✅ attempt recorded in the execution summary; VIC collision 16/16 on a clean sequential rerun.
- [x] Run `yarn prettier --check` on every touched source, test and Markdown file. ✅
- [x] Confirm `spec/` remains untouched, the tree is clean after the final commit, and no push is made. ✅

## Recorded Rulings

| Ruling | Decision | Reason |
|---|---|---|
| Q-P15 re-baseline | Update `renderBytes` at each byte-changing task: 383 after T-21 (measured) and the final measured value after T-20; record both. Cycle values stay `Unknown`. | Each checkpoint stays green and the measurement history is auditable; the byte oracle is a parity measurement, not a compatibility promise. |
| T-20 mode | Enable proved ordinal writes under the existing optimized-mode proof; keep `none` at the T-21 383 baseline. The pinned `none` fixture must stay byte-identical. | The unoptimized bounds pass has no fixed-loop facts, so a none-mode proof needs a separate loop-bound source. That extension is tracked debt, not silently forced into this slice. |
| T-20 device bases | Admit only the existing proved ordinary-RAM window; record the `$D800` Color-RAM loop as a tracked gap. | The current raw observer proof is ordinary-RAM based; widening it is separate work and not needed for the named defect. |
| T-21 startup boundary | Keep the startup path's folded identity form; compact ordinary functions identically in the draft and final layouts. | Startup owns a contiguous entry/fallthrough relation whose movement is outside this residual slice; identical draft/final compaction keeps the existing shared-storage stability shape gate green. |
| T-21 growth fallback | Keep the identity form and file the measured 2-byte gap when a function cannot shrink without growth. | Never reject a valid program to obtain a code-payload win. |
| T-27 multiple screens | Fail closed with source-linked E10273 when more than one distinct active screen base is selected; record the restriction in `test/rd04/expressiveness-ledger.json`. Raw `$D018` selection remains user-owned. | The frozen API has no screen argument and silently choosing one would be wrong; the restriction is tracked and reopenable. |
| T-27 screen footprint | Reserve the active screen's full 1,024-byte footprint (1,000 payload + 16-byte zero tail + 8-byte pointer table) during placement. | RD-06 R6.42 requires the complete active-screen interval; a post-placement 8-byte reservation cannot prevent collisions. |
| T-24 diagnostic split | E10143 remains the one-object asset placement alignment/visibility diagnostic; constant fields and cross-object/bank/character-ROM/non-asset conflicts use E10273. | This follows the frozen trigger and message templates. |
| T-26 projection scope | Use VIC-scoped records with `bankId: "vic-bank-0"` in the existing version-1 sidecar; exclude them from resident-RAM and SFA-hash consumers. | The validator already keys views on `bankId`; a per-view schema change would alter the frozen version-1 shape. |
| Commit mode | Commit each verified task locally; never push. | Repository policy makes automatic push unavailable. |
