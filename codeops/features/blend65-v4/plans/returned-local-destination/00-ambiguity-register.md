# Returned-local destination — decisions

> **Status**: ❌ BLOCKED — AR-6 assessment complete; observer-contract ruling pending
> **Last Updated**: 2026-10-10 00:24 CEST
> **CodeOps Artifact Schema**: 1

## Scope contract

Target: T-14, the bounded ordinary aggregate-return prerequisite for
`blend65-v4/RD-05`. Context: frozen value, evaluation, address, return and SFA
contracts; existing destination, whole-program, storage and machine consumers;
the isolated ordinary artifact in the upstream discovery. Modification set:
this standalone plan, upstream decision status, the feature roadmap, necessary
existing producer/consumer changes and new tests. Frozen spec/expert, public
artifact schemas and every existing specification test are excluded.

## Authorized resolution

| ID   | Category                                      | Resolution                                                                   | Authority                                                                                                                                                                     |
| ---- | --------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-1 | Technical (complexity escalation) / sensitive | Import the exact narrowed whole-function correction and unchanged fallbacks. | User “I approve”, 2026-10-09, to [keyboard AR-P11's narrower packet](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p11-approval--conservative-whole-function-boundary). |

The upstream eight-field packet is the durable approval owner; do not duplicate
it here. Its fresh native SFA/semantics analysis and independent **Simplify**
verdict establish the planning boundary, not implementation qualification.
AR-1 does not approve per-call variants, forced temporaries, a general solver or
new pass/IR/runtime/API/harness. Unknowns preserve the complete current function.

All twelve ambiguity categories were reviewed. This task adds no language form,
diagnostic, public user choice, security boundary or dependency. Names below are
internal implementation details within AR-1, not new product decisions. Existing
generated interrupt/storage contracts remain unchanged. No new persistent format,
ABI version, mixed-version object or migration path is introduced: whole-program
builds regenerate their existing artifacts.

Verification imports the previously user-confirmed RD-05 project rule: directed
tests during tasks; `yarn install --frozen-lockfile`, `yarn build`, `yarn
typecheck`, `yarn test` at the phase checkpoint; sequential VICE. Formatting and
link/source-key checks cover these documents. The workflow prime directive owns
green local commits and automatic roadmap updates; pushing needs a separate
user request. The confirmed RD-05 xhigh effort waiver remains in effect.

No proof is silently assumed: applicability, binding, costs and runtime are
implementation obligations. If satisfying them needs machinery outside AR-1,
reopen the upstream decision and stop; do not add a second support decision file
or narrow legal source behavior. Positive keyboard qualification remains separate.

## AR-2 (runtime) — retain the actual nested-construction consumer

**Category:** Technical, necessary producer/consumer correction inside AR-1.
**Status:** Resolved by the implementation owner under the workflow prime
directive's compiler/plan-owned decision rule; no new user approval is inferred.

**Best option:** include only `machine/lower-aggregate-build.ts` alongside the
already named construction consumers. Its existing large-member path is selected
in `lower-function.ts:423` before `lower-operation.ts` runs. Even when a completed
nested child is omitted, its remaining scalar fields currently create a separate
target pointer for every write (`lower-aggregate-build.ts:425`). The approved
indirect-root binding therefore needs that real consumer to write scalar bytes
through the certified pointer at their existing offsets, rather than hiding the
removed return copy in extra pointer work.

The correction is guarded by the same certificate and stays in the current
construction owner. No selection pass, alternate entry, operation kind, general
profitability rule, runtime or schema is introduced. The former twelve-module
list becomes thirteen existing/new approved modules. All old spec tests and the
three frozen new oracles stay unchanged. Task 1.2.7a prepares four machine
consumers; 1.2.7b still publishes the fact and omits its matching inventory together.
The exact byte/cycle/resource and selected-source gates remain binding.

Moving the decision into a new optimizer or bypassing the existing large-member
owner was rejected: neither is needed to satisfy the original correction.

## AR-3 (runtime) — use the actual package test locations

**Category:** Technical, necessary test-location correction inside AR-1.
**Status:** Resolved by the implementation owner under the workflow prime directive.

**Best option:** put the two already-approved internal test files beside the
semantic helpers under `packages/compiler/src/semantic`. The compiler's
`vitest.config.ts:4` includes only `src/**/*.test.ts`; the original proposed
`packages/compiler/test` paths would never run. This matches existing package
tests and their relative imports. No configuration or new harness is needed.
Split authoring by the two existing concerns before execution; eligibility,
production scope, all oracles and qualification gates are unchanged.

## AR-4 (runtime) — avoid new constant-construction size growth

**Category:** Technical, necessary emitted-output correction inside AR-1.
**Status:** Resolved by the implementation owner under the workflow prime directive.

**Best option:** correct only the existing `appendConstantConstruction` consumer
in `machine/lower-aggregate-members.ts`. Independent actual-byte qualification
finds that the identical-source `word[129]` witness grows from 829 to 1,086 bytes
in `make`, despite removing its copy and reducing nominal cycles. Repeated
two-byte immediate Y loads replace direct stores. This is MC-001, not a permitted
performance trade-off or a parity pass.

Within one certified private construction only, select one-byte `INY` instead
of `LDY #next` when the preceding known Y value proves the exact next byte offset.
Both take two cycles and produce the same Y/N/Z state while preserving carry.
Retain the existing A-only constant fact across increment/decrement of this same
private hidden pointer's high byte; those instructions do not change A or Y.
Clear both facts at any unrelated instruction; do not carry Y between construction
selections or control-flow blocks. The original direct-target barriers stay intact.

This reuses the already approved emitter and hidden-result guard. No additional
production module, pass, IR, runtime, solver, general register tracker, public
API, or old/specification-test edit is needed. New focused internal checks use
the existing approved returned-local test file. Rebuild retained same-source
artifacts, rerun the independent behavior/output oracles and full checkpoint,
and require independent output review before qualification. A general word-fill
optimizer is unnecessary to remove this new regression and remains excluded.

## AR-5 (runtime) — include persistent caller-established hardware observation

**Category:** Technical, necessary observer-proof correction inside AR-1.
**Status:** Resolved by the implementation owner under the workflow prime directive.

**Best option:** retain one whole-reached-program hardware-publication flag in
the existing certificate helper, including executable global initializer bodies.
SM-001's independent semantic review finds that unsafe callee-to-caller propagation
misses hardware configured before the call. The platform auditor corroborates an
actual overlap: `poke($D018,$28)` selects bank-zero screen `$0800–$0BFF`, which
includes the retained ordinary caller result at `$0AE8–$0AF2`. The VIC continues
fetching during construction; SEI does not exclude it.

Unknown or RAM-selecting writes, CPU-port visibility changes and unproved platform
effects therefore keep every returned-local certificate absent when complete fetch
disjointness is unproved. Reuse the existing device/raw-footprint facts; retain
the current local/helper/asynchronous checks for other observers. This is a
conservative eligibility guard, not a source restriction, lifetime variant,
new state analysis, solver or hardware-layout system.

Three new focused internal cases for caller, prior helper and initializer contexts
reproduce the wrong certificate before the fix. Keep every existing test and all
three frozen specification oracles unchanged. Reverify the corrected guard and
final artifacts, then restart the full checkpoint against the consistent final
code; require the same independent reviewers' one bounded fix-only check.

## AR-6 (runtime) — incoming bitmap display invalidates hardware disjointness

**Category:** Observer-contract ruling; possible startup/layout scope expansion.
**Status:** Open. The separately offered bounded assessment is user-approved
and complete; see [T-16 assessment](09-entry-observation-assessment.md). TP-001
remains a MAJOR plan-proof gap, not an established semantic failure. Final
qualification and closeout stop pending the exact plan ruling. Assessment
approval is not implementation or protected-oracle amendment authority.

**Finding:** the hardware-publication flag in
`packages/compiler/src/semantic/returned-local-destination.ts:358` accounts for
source operations, not incoming device state. Existing startup establishes
bank zero and writes `$14` to D018, but leaves D011 BMM/DEN unchanged
(`packages/compiler/src/layout/startup.ts:244–269`). With incoming BMM=1 and
DEN=1, bitmap fetches can observe bank-zero RAM below the VIC character-ROM
overlay at `$1000–$1FFF`. The retained
ordinary caller result `$0AE8–$0AF2` overlaps it. SEI does not stop VIC fetches.
Neither the frozen cooperative entry contract nor AR-1 grants bitmap-off entry.
The missing disjointness proof is established; an alternate-entry pixel/timing
runtime witness has not been run and remains Unknown.

AR-5 fixes persistent source-established publications, not this independent
entry-state boundary. An absent source write cannot certify physical hardware
invisibility. The initial ruling required declining the optional certificate
under the literal physical-observer promise, leaving A-1/A-5/A-6 unqualified.
The assessment now distinguishes that promise from specified source/platform
observations: no inspected frozen clause establishes an invariant pixel trace
of unnamed compiler-private bytes. This is an inference from explicit allocation
and copy-elision latitude, not authority to discard a source effect. The broad
plan wording remains binding until a named ruling; no source or entry restriction
is introduced.

**Scope decision needed:** approve the assessment's narrow observer-contract
clarification, or retain the literal physical-fetch promise and separately
authorize placement work. No remedy is selected by assessment approval alone.
Any future startup/layout design must preserve
non-owned interrupt/device state and report complete bytes, RAM, cycles and
placement costs. The exact remedy is not yet proved. D011 is absent from the
49-byte saved-device state; reading bit 7 returns the current raster position,
not the hidden raster-compare latch written through that bit. A generic
save/mask/restore therefore cannot be presumed correct. Placement must likewise
prove visibility, collisions and complete artifact cost rather than add hidden
padding or merely move a live object.

No startup edit, new layout mechanism, new state byte, protected-test change,
baseline rebase or frozen-authority amendment is authorized here. RD-05 T-16
owns the completed bounded assessment and pending plan ruling, not an authorized fix. The measured
ordinary payload improvement is only 17 bytes; a future common startup cost
must not be silently cancelled against a changed baseline. The initial challenger
supported withholding qualification and investigating startup/layout. The fresh
assessment and challenge change the recommended next direction to a precise
plan-observer ruling: preserve all current source/raw/asynchronous/publication
guards without adding startup or placement machinery. Confidence: medium; an
explicit private-display promise or missed defined observer would change that
direction. Hardening separates physical overlap from semantic obligations;
challenger converged conditionally on named approval. RD-05/DEF-7 and keyboard
qualification remain open; the implementation is not a green checkpoint. The
assessment adds no runtime proof and clears no review gate.
