# Ambiguity Register: RD-05 NMI and CIA2

> **Status**: 🔄 PLANNING RESUMED — AR-P10/T-08 authority maintenance complete; expert 2.0.3 qualified and bound; compiler and keyboard proof gates remain open
> **Last Updated**: 2026-10-03
> **CodeOps Artifact Schema**: 1

| Planning boundary | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target            | The next bounded `blend65-v4/RD-05` NMI/CIA2 planning task, including DEF-7. The user confirmed xhigh effort and continuation on 2026-09-30. This is not implementation authority or whole-RD closeout.                                                                                                                                                                                                                                                                                  |
| Context artifacts | Frozen Specification 4; RD-05 R5.15–R5.18/R5.20; the RD-04 DEF-7 decision; completed IRQ, CIA and CIA1-return plans; qualified expert 2.0.3; primary CPU/CIA/KERNAL evidence; current profile, semantic, storage and machine code.                                                                                                                                                                                                                                                       |
| Modification set  | AR-P6 approved this register and the feature roadmap for reconciliation. AR-P8 additionally approves the T-05 diagnostic mini-plan and existing keyboard register. A temporary assembly hook is diagnostic evidence only. T-06 separately completed AR-P7/AR-P9 authority maintenance and identity guards; its mini-plan records that exact scope. No production hook, NMI-acceptance test or new API is authorized by this planning register. Earlier discovery is retained as history. |

| #      | Category                                             | Ambiguity / Gap                                                                                                                                                                                       | Options Presented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | User Decision                                                                                                                                                                                                                                                                                     | Status                                                     |
| ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| AR-P1  | Planning target / effort                             | Which next work item is authorized?                                                                                                                                                                   | The named RD-05 NMI/CIA2 planning task, with xhigh effort.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | User: “xhigh effor is confirmed, proceed further” on 2026-09-30, replying to the explicitly named planning task.                                                                                                                                                                                  | ✅ Resolved                                                |
| AR-P2  | Scope / source safety (complex)                      | What is the smallest scope that can progress DEF-7 without inventing hardware guarantees or a runtime manager?                                                                                        | **Recommended:** a bounded proof-first slice on the four existing cooperative PRG profiles, using existing NMI/CIA2 APIs. Close permitted-source and live-handler re-entry facts first, then safe vector replacement and exact CIA2 handoff. If a permitted source remains unbounded or unknown, stop with the exact missing fact and retain the existing guard; do not invent a profile, promise a positive implementation, or silently defer the obligation. Raw takeover remains a separate RD-05 slice. | User: “Make sure we are not overcomplicating or overengineering. proceed further.” on 2026-10-01, accepting the sole scope recommendation presented immediately before the reply.                                                                                                                 | ✅ Resolved                                                |
| AR-P3  | Verification / inherited project rule                | Which existing verification policy applies if this plan becomes executable?                                                                                                                           | Directed specification, assembly/cost and implementation tests; frozen-lockfile install, build, typecheck and complete tests at phase checkpoints; sequential four-profile VICE cases; revision-sensitive physical QA at RD-10. Planning-only documents use link, authority and consistency checks.                                                                                                                                                                                                         | Import the unchanged approved CIA1-return AR-P4 verification policy and current AGENTS.md impact-based rules; no new verification surface.                                                                                                                                                        | ✅ Resolved                                                |
| AR-P4  | Upstream profile qualification                       | The unchanged profile admits unbounded NMI nesting, which cannot fit a finite hardware stack. What qualified source contract could justify a finite bound?                                            | Reopen positive planning only with a qualified all-source nesting bound, or complete edge-spacing and worst-case route-time proof. Any correction to the frozen profile needs separate authority. Retain the existing DEF-7 guards meanwhile.                                                                                                                                                                                                                                                               | The original no-bound result remains true. Qualified AR-P7/AR-P9 maintenance now supersedes blanket rejection only for the approved reentrant, private-home-free generated route. Positive implementation proofs remain; DEF-7 stays RD-05-owned.                                                 | ✅ Resolved — blanket gate superseded; no bound proved     |
| AR-P5  | Scope / bounded source investigation                 | May the keyboard prerequisite return to its existing DEF-7 owner for one new evidence check?                                                                                                          | Inspect missing RESTORE/all-source guarantees, not another T-04 replay or repetition of the completed unbounded-profile check. Exit with new qualifying evidence or the specific user-owned source-contract fork. No compiler/spec edits or new subsystem.                                                                                                                                                                                                                                                  | User: “proceed” on 2026-10-03, replying to the named high-effort, docs/evidence-only RESTORE investigation and its exact modification set.                                                                                                                                                        | ✅ Resolved — investigation only; original result retained |
| AR-P6  | Product / source-contract reconciliation (sensitive) | Should positive NMI planning retain the unrestricted arrival guarantee, or seek explicit supported-machine/source conditions while preserving ordinary RESTORE behavior?                              | **Best option:** authorize one separate, bounded source-contract reconciliation task under DEF-7. Produce a concrete candidate and its remaining proof obligations for user decision; do not invent a finite number, assert that the frozen hardware fact is false, disable RESTORE, or add a hook/framework. The immediate safe alternative is to retain the unchanged contract and keep positive NMI/keyboard planning blocked.                                                                           | User: “I approve, proceed until all RD-05 is done, do not stop or pause, unless absolut;y neccssary. The effort level is set and confirmed.” on 2026-10-03. This approves the named reconciliation deliverable, not a yet-unpresented frozen-contract correction or source restriction.           | ✅ Resolved — reconciliation only; AR-P7 now active        |
| AR-P7  | Product / frozen proof-scope correction (sensitive)  | May a proved reentrant, invocation-private-storage-free generated NMI route remain expressible when the external aggregate stack and retained-firmware completion guarantees are explicitly unproved? | **Best option:** the narrow proof-scope candidate below. Retain real unbounded NMI facts, strict private-storage safety and all ABI/device/vector obligations; stop claiming universal external stack/completion safety. No assumed nesting number, event suppression, new profile or runtime guard. Keeping the unchanged blanket rejection is the safe alternative, but cannot complete this positive slice.                                                                                              | User explicitly approved the correction on 2026-10-03 and requested saving/pushing first. T-06 owns the separate frozen-authority maintenance and expert requalification; compiler/API/spec-test changes remain separate gates.                                                                   | ✅ Resolved — authority maintenance complete               |
| AR-P8  | Scope / developer experience / bounded proof         | May the approved ordinary-input direction be tested through one minimal internal scan-aware ingress?                                                                                                  | One temporary assembly proof under DEF-7, with explicit stock behavior, transition, state and cost expectations. Keep ordinary saved-data interpretation in Blend65 libraries. No production subsystem or frozen-authority change.                                                                                                                                                                                                                                                                          | User: “I approve” on 2026-10-03, replying to the deeper assessment's focused contract-and-proof recommendation. [T-05](../keyboard-ingress-proof/99-execution-plan.md) owns the diagnostic proof; AR-P7 was open at that decision; T-06 authority maintenance and AR-P9 binding are now complete. | ✅ Resolved — proof only                                   |
| AR-P9  | Runtime / active identity synchronization            | May T-06 update the three public identity fields and corresponding foundation guards before binding the approved authority?                                                                           | **Best option:** the exact two-file extension below, retaining historical negatives and byte-exact candidate/active checks in two green checkpoints. No generated-code or NMI-acceptance change.                                                                                                                                                                                                                                                                                                            | User explicitly approved the bounded identity synchronization on 2026-10-03.                                                                                                                                                                                                                      | ✅ Resolved — exact two-file extension                     |
| AR-P10 | Product / machine-entry proof (sensitive)            | May NMI-using programs on the four cooperative PRG profiles require the stock NMINV predecessor at entry, without an independent resident vector owner?                                               | **Best option:** qualify the exact stock-entry condition below, then prove matching-low placement and one-byte publication through the existing compiler owners. No new API, runtime guard, source-form ban or finite NMI bound. Broader arbitrary-predecessor support needs a separately costed direct publication scheme.                                                                                                                                                                                 | User: “go with the best possible option, and proceed further” on 2026-10-03, accepting the exact entry condition and bounded authority-maintenance scope presented.                                                                                                                               | ✅ Resolved — authority qualified and bound                |

The same instruction explicitly covers the effort-confirmation handoffs for the
named remaining RD-05 batch. Recommendations still precede distinct tasks;
another effort pause is not required unless the scope or risk materially changes.
Verified local commits remain automatic. This continuation is not push authority.

## AR-P10 — Initial NMINV predecessor contract

**Smallest missing fact:** Reset initializes NMINV to the pinned stock `$FE47`
handler, but the selected cooperative contract does not establish that value at
PRG/SYS entry. Its custom-resident-service exclusion names IRQ/CIA1 and expressly
does not broaden NMI. The primary [KERNAL initialization source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/init),
lines 13–27 and 43–69, establishes reset initialization and exposes user vector
replacement; it is not a stock-NMINV-at-every-later-entry guarantee. This is a
machine-entry product decision, not missing reset-timing research.

**Best option:** For programs using generated NMINV installation on the four
existing cooperative PRG profiles, require that program entry selects stock
901227-03 NMINV `$FE47`, with no independently resident NMI vector owner. Programs
not using that installation acquire no new NMINV-entry condition. The compiler
must then prove the complete low-byte `$47` invariant through every permitted
generated or retained-stock transition; it may not assume it after an unproved
writer. Place reachable generated entries at that low byte and publish/restore
only the high byte. Capture the exact predecessor before publication and keep
each saved link immutable while any live route can observe it. This is a
conditional lowering direction, not a proven implementation.

The trade-off is explicit: custom pre-existing resident NMI service is outside
this qualification envelope for NMI-using programs. Ordinary keyboard, both
joystick ports and RESTORE remain in scope. No new source API, local/helper ban,
reset operation, RESTORE suppression, depth guard, scheduler or event policy is
proposed. Source-defined shared effects, full ABI/status/D, CIA2 ICR ownership,
banking, terminal behavior and the approved private-home-free route proof remain
mandatory. External stack/firmware guarantees stay unproved.

**Real alternative:** An arbitrary preserved low byte can land in a full NOP page
followed by a jump. Its analytical cost is 259 bytes plus alignment and 5–515
entry cycles before the existing wrapper. Coherent capture, external ownership
and saved-link lifetime still need proof. This is not selected or authorized;
any larger support surface requires its own measured cost/complexity decision.
No writable-code bridge or generalized publication framework is proposed.

An independent blind challenger confirmed the missing base case and the
conditional matching-low direction. Removing the existing immediate low-byte
load/store would nominally save 5 bytes/6 cycles per install; removing the RAM
low-byte restore would save 6 bytes/8 cycles. These are analytical instruction
costs, not generated-output qualification. Padding, total links, handler-side
contexts and final program cost remain Unknown. Existing wrapper and CPU/ROM
terms must remain separate from unrestricted external peak/headroom.

**Approved boundary:** A separate bounded authority-maintenance
task updates only the Chapter-15/Appendix-C64 cooperative NMI entry contract,
the specification identity record, RD-05 R5.17/AC-14, and the matching expert
version/knowledge/qualification/release record. It includes the necessary
three public identity values and existing foundation authority/freeze guards,
preserving all historical/current negative fixtures and complete raw-byte
protection through the same two ordinary green checkpoints. No compiler
lowering, NMI-acceptance expectation, new API, dependency or release framework is
authorized by that maintenance scope. Those implementation gates remain separate.
The qualified content and binding checkpoints now pass. Expert 2.0.3 is selected
and bound to the exact content below. All current compiler guards remain unchanged.

**Status:** Resolved — the user approved the best option and exact maintenance scope
on 2026-10-03. [T-08](../nmi-stock-entry-contract/99-execution-plan.md) owns the
expert 2.0.3 correction, qualification and identity binding, now complete. This
maintenance qualifies the authority only, not generated code or runtime behavior.
Confidence: High for the missing invariant; Medium for the minimum complete
implementation after approval. Hardening: independent challenger converged on
the entry-contract gate; no positive artifact/runtime claim follows.
Lineage: expert 2.0.3, content `22cc5f00f381c82d347cf342be4fcff16bc291c6`,
`c64-memory-and-runtime.md#revision-pinned-nmi-contracts-and-costs`,
`sfa-and-abi.md#interrupt-route-completion-gate`; CBM-C64-KERNAL-03 and MOS-PGM-1976.

## Current qualified binding — T-08 complete

Expert 2.0.3 is selected in the worktree, bound to qualified content
`22cc5f00f381c82d347cf342be4fcff16bc291c6` and specification
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
The [T-08 checkpoint](../nmi-stock-entry-contract/99-execution-plan.md#binding-checkpoint-verified)
preserves forty negative fixtures and every specification/non-release expert
byte. Actual RED, directed 12/12 GREEN and independent live binding review pass.
The second install/build/typecheck and full local suite pass: 3,422 tests with
the same two existing compiler skips. Independent draft/live binding reviews
are clear. This is authority maintenance, not generated NMI or keyboard qualification.

### Historical T-06 qualified binding

T-06 activated expert 2.0.2, bound to immutable content
`13b995d0ddacc304aa066e015c14c63678e99dcc` and specification
`BLEND65-SPEC-4-566da991146be7ef6a09efa63449421e27c4873cde9788c84220d187460586f7`.
[T-06](../nmi-proof-scope-correction/99-execution-plan.md) records 38 fresh and
75 unchanged-input documentary qualifications, exact content migration/binding,
all seven historical/eleven current negative fixtures, complete 3,422-test
verification with two existing skips, and independent reviews with no findings.
Only approved authority, identity and freeze guards changed. No generated NMI
route, keyboard API, compiler acceptance behavior or physical result is qualified.

AR-P4's blanket admission prerequisite is superseded, not its correct absence of
a finite external bound. Positive planning may now prove the approved complete
reentrant/private-home-free generated route. Vector publication/removal, ABI,
immutable predecessor lifetime and source/ICR ownership still need implementation
proof. Keyboard AR-P2/AR-P3 remain open; DEF-7 and RD-05 remain owned and open.
Exact obsolete NMI acceptance expectations still need their separate approval.

Earlier discovery and analytical sections below retain their original
pre-maintenance context. This binding record and current decision statuses
govern readiness; no historical unbounded-source fact changed.

## Discovery evidence

### AR-P9 — Active identity synchronization (runtime) — approved

**Necessary activation dependency (before T-06 binding):**
`packages/compiler/src/build-info.ts:6–11` published specification `1c2a2d75`,
expert `2.0.1` and content `1ce48520`.
`test/foundation.spec.test.ts:18–20,39–53,101–160` pins those identities and an exact
freeze checkpoint. The approved new normative identity/runtime cannot replace the old
baseline while those current-authority checks remain unchanged.

**Best option:** extend T-06 only to the three public build-identity fields and the existing
foundation active-authority/freeze checks. Preserve historical identities, every negative
case and exact-byte protection; respect the existing content-checkpoint/binding sequence.
No generated-code behavior, new API/schema, dependency, release service or compiler
spec-test expectation for NMI acceptance changes. Exact test and binding design must be
reviewed before use; this is not permission to bypass the foundation guard.

Independent challenge confirmed the existing two-checkpoint route is viable only
with an exact qualified-but-inactive candidate check before binding. The old
historical byte checks and negative fixtures remain; the candidate's full raw
specification/expert bytes receive separate fixed expectations. Once the content
commit exists, the final active checks replace that temporary candidate state and
bind all three public identity fields. Both checkpoints must be green. This
proposal includes the narrow identity/test bookkeeping exception at binding;
it does not introduce a generic pending switch or accept self-declared hashes.

**Status:** Resolved — the user replied “Yes, approve this bounded identity synchronization”
on 2026-10-03. Only the three public identity fields and existing foundation authority/freeze
checks are added to T-06. Every historical negative case and exact-byte protection remains.
No NMI acceptance expectation, generated-code behavior, API or release framework is approved.
Both green checkpoints and exact binding are complete in T-06; its current
record above names the actual content and preserved guards. This does not
authorize a compiler/NMI-acceptance change.

### AR-P8 developer-facing direction and bounded ingress proof

The user approved the deeper assessment's **best option**: keep input operations
ordinary and library-facing, with exact hardware/firmware coordination behind the
minimum existing platform boundary. AR-P7 remains a candidate admission mechanism,
not a public NMI programming model. No general NMI manager, event policy, dynamic
activation storage or arbitrary storage-bearing callback promise follows.

[T-05 results](../keyboard-ingress-proof/99-execution-plan.md#results) record a new,
bounded PAL VICE diagnostic. Its 23-byte ingress avoids the observed false-STOP
control, invalidates an interrupted acquisition, survives two overlapping generated
entries, preserves the tested architectural state and retains the genuine STOP
branch. It leaves CIA2's consuming read with stock firmware. This is **Verified
partial — VICE-verified / hardware-unverified**, not generated-code qualification.
The diagnostic has two deliberate shared flag bytes and one immutable link, with
no invocation-private RAM/ZP storage. Complete source/ROM/stack guarantees remain
Unknown; the linked resource ledger keeps them separate from component costs.

The proof is an independent reason to retain the small internal seam, not to accept
new language semantics silently. Positive planning now needs AR-P7's exact frozen
proof-scope authority and the eventual public keyboard certainty contract. The
unchanged E10245/E10278 guards stay active; no spec-test expectation is amended.
T-05 replaces no earlier negative source-bound conclusion and does not close DEF-7.

The prior independent developer-experience challenge selected this same narrow
direction. No new support surface was added, so another architecture interview is
not needed for the isolated proof. Its post-task review still applies independently.

### Current capability — Verified partial / Fact

The four selected cooperative profiles expose NMI sink facts but deliberately
leave external re-entry unbounded and self-masking false in
[`target/profile.ts`](../../../../../packages/compiler/src/target/profile.ts).
[`whole-program.ts`](../../../../../packages/compiler/src/semantic/whole-program.ts)
rejects such reachable sinks with E10245 before emission.
[`cia-ownership.ts`](../../../../../packages/compiler/src/semantic/cia-ownership.ts)
allows CIA2 counter observation but rejects its state-changing and consuming
operations with E10278. These guards are not positive NMI qualification.

The existing
[`lower-c64-interrupt.ts`](../../../../../packages/compiler/src/machine/lower-c64-interrupt.ts)
has exact entry wrappers and IRQ-safe two-byte vector transactions. Its
`PHP; PHA; SEI` transaction is not an NMI safety proof. The current
[`profile-interrupts.spec.test.ts`](../../../../../test/rd05/profile-interrupts.spec.test.ts)
requires NMI rejection. It may not be rewritten merely to make new code pass.

The common machine contract in
[`appendix-c64.md`](../../../../../spec/appendix-c64.md) already excludes
cartridges and expansions. Their absence needs no new product restriction.
The current
[`irq-stack.ts`](../../../../../packages/compiler/src/storage/irq-stack.ts)
measures IRQ overlap and I-bit eligibility. Existing NMI domain labels do not
make that algorithm an NMI nesting or whole-route stack proof.

### Bounded check result — negative certification, not hardware impossibility

The frozen source record in
[`appendix-c64.md`](../../../../../spec/appendix-c64.md), lines 877–886,
allows NMI to preempt NMI, does not mask it on entry, and leaves external
re-entry unbounded. Section 10's closed deltas retain these facts in all four
cooperative PRG profiles. This is normative contract evidence, not a restriction
inferred from current compiler code.

[`06-functions.md`](../../../../../spec/06-functions.md) §7.9 assigns three
CPU-stack bytes to each interrupt entry and accumulates overlapping live entries.
The profile supplies 256 bytes with a 20-byte reserve: 236 usable bytes. Just
79 simultaneously live CPU frames require 237 bytes, before caller, wrapper or
helper costs. The admitted unbounded nesting therefore cannot have a finite
certified peak. E10245 explicitly covers hardware-stack consumption even when
the application body needs no invocation-private storage.

A generated guard runs after CPU/ROM entry; it cannot bound arbitrary repeats
before it executes. Masking CIA2 alone does not cover independent RESTORE entry.
A matching-low-byte vector does not close this source obligation either. No
new guard, manager, profile, storage mechanism or compiler change is justified
by this result.

The [Commodore C64 service manual, PN 314001-02, printed page 12](https://oldcrap.org/wp-content/uploads/2023/04/commodore-c64-service-manual-314001-02.pdf)
describes RESTORE's U20/U8 NMI path but provides no qualified minimum RESTORE
edge-spacing guarantee there. Its half-second RESET description is not a RESTORE
bound. This supplemental primary-source probe does not activate a new expert
authority or qualify board-specific timing.

**Exact reopening fact:** a qualified finite simultaneous-entry bound covering
RESTORE and every admitted CIA2/retained firmware source over the complete
CPU/ROM/body/acknowledgement/exit route. A spacing argument also needs complete
worst-case route timing and coverage of admitted board variants. Such evidence
would require reconciliation with the frozen unbounded source row before code.
Physical feasibility remains **Unknown**; this result does not claim that real
RESTORE hardware can produce the abstract counterexample schedule.

The original bounded check is complete. The executable plan is not created,
DEF-7 remains unresolved, and RD-05 is not closed. Its then-next independent
PE-001 compiler-analysis memoization item has since completed as T-02/T-03; it
is not the current next task. AR-P5 authorizes the separate source investigation
recorded below, not another NMI support layer.

### AR-P5 source investigation — complete, 2026-10-03

**Result:** new board and firmware distinctions are verified, but a qualifying
all-source nesting bound is still **Unknown**. This is not another execution of
T-04 or the 79-frame contract counterexample. No physical pulse-rate or silicon
safety result is claimed.

| Evidence boundary                  | Status / claim kind                                                                      | Decisive observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Older RESTORE circuitry            | Verified complete / Fact for the identified drawings                                     | Original Commodore diagrams [326106 sheet 1](https://www.zimmers.net/anonftp/pub/cbm/c64/schematics/manual/c64-21r.gif), [251138 sheet 2](https://www.zimmers.net/anonftp/pub/cbm/c64/schematics/manual/c64-27r.gif), and [251469 sheet 2](https://www.zimmers.net/anonftp/pub/cbm/c64/schematics/manual/c64-32r.gif) use U20's pins 1/2/6 RESTORE section with R33 = 47 kΩ and C23 = 360 pF. Power-on RESET uses its other section with R34/C24. The RESET duration cannot be substituted for a RESTORE spacing guarantee.                                                                    |
| Board coverage                     | Verified complete / Fact for the 1985 identification table                               | [Printed page 17](https://www.zimmers.net/anonftp/pub/cbm/c64/schematics/manual-html/Page_17.html) maps 326298-01 to 326106, 250407-04 to 251138, and 250425/250441-01 to 251469. These mappings do not qualify every later board.                                                                                                                                                                                                                                                                                                                                                             |
| Later wiring distinction           | Verified complete / Fact for the inspected drawing; exact revision applicability Unknown | The original Commodore-64 BN/E scan archived as 252312 ([left](https://www.zimmers.net/anonftp/pub/cbm/schematics/computers/c64/252312-left.gif), [right](https://www.zimmers.net/anonftp/pub/cbm/schematics/computers/c64/252312-right.gif)) connects keyboard RESTORE to the shared CPU NMI/CIA2 interrupt net without the older U20 RESTORE timer section. Its visible title does not establish a complete assembly/revision qualification. No timing bound is transferred from the older boards. Third-party redraws and corrected scans were not used as authority.                       |
| Retained firmware completion time  | Verified complete / Fact at the source boundary                                          | Pinned [`time::UD60/UD70`](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/time), source lines 49–58, repeat paired CIA1 PB reads until they match, without an iteration limit. No input-settling guarantee was established. A short generated scan or bounded scan retries do not give this retained route a finite worst-case completion time.                                                                                                                                                                                        |
| CIA2 acknowledgement and re-enable | Verified complete / Fact at the source boundary                                          | [MOS 6526 printed page 7](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) defines Timer A, Timer B, TOD alarm, serial and FLAG sources and distinguishes consuming ICR reads from mask writes. Pinned [`rs232nmi::NNMI10/NMIRTI/T2NMI`](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi) clears masks, consumes ICR, and later re-enables sources; some paths re-enable before the terminal restore. A once-only RESTORE calculation or entry-side CIA2 mask does not close every admitted source or the complete live route. |
| Positive NMI/keyboard hook         | Unknown / Unknown                                                                        | No finite simultaneous-entry bound, complete source-spacing/route-time proof, safe publication/removal proof or complete cost was established. E10245/E10278 and keyboard AR-P2/AR-P3 remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                        |

Nominal component values are not a qualified minimum interval. Such a claim
would need the exact circuit, component tolerances, triggering/recovery behavior,
input conditions, shared-line effects and CPU acceptance, plus the full route's
worst-case time including firmware loops and bus stalls. The later drawing is
supplemental primary evidence, not a new active expert source or a qualified
replacement profile. No new numeric bound is proposed.

For CIA2, each admitted source must be individually owned, proved inactive, or
bounded through its acknowledgement and re-enable points. The stock/unexpanded
machine assumption already excludes cartridges and expansions; it does not by
itself establish all user-port or retained RS-232 source conditions. RESTORE
must be accounted for independently. These observations identify missing proof,
not new source restrictions.

**Complete relevant cost:** this documentation-only task emits no instructions,
data, SFA homes, links or stack frames and adds no runtime work. For a future
hook, output/ROM bytes, link/marker storage, SFA overlap, stack peak and complete
entry/body/acknowledgement/restore/exit timing remain **Unknown**. The existing
independent obligations below still apply, including callback-only identity,
reachable variants, full A/X/Y/status/D restoration and bank-safe links.

#### Reproducible source identities

The downloaded originals and renders are captured in
`/tmp/blend65-restore-safety.XTgULP/`; temporary files are not distribution assets.
The source URLs above and hashes below preserve identity after that capture expires.

| Source                                          | SHA-256                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| PN 314001-02 PDF, linked in the original check  | `cda2d51b995008660c592c66669c44c3340e2b86a990c2e9207d2c83555e43a0` |
| Original 326106 sheet 1                         | `841d3c318e302affe9c9e38253406ffeb362d4b0e4a4d1f9d6f48f9dfcf23677` |
| Original 251138 sheet 2                         | `7016c04aff5a85b7941769a8b6012c216424bfb274d2a679412e939265f01698` |
| Original 251469 sheet 2                         | `1c1459c4b06418201dc0370bcb5f184130e2ddafb78f5d602e14a383887721bc` |
| Supplemental BN/E left scan archived as 252312  | `3650bdae9630add7dafcf4ddd4adcfb6fd04f1c861d8083b159dc4bd80bda74b` |
| Supplemental BN/E right scan archived as 252312 | `a1b8b30a0457fde14fbfd021d720fdc64061ca95d52e93f79f0f4666ca527645` |
| MOS 6526 November 1981 PDF                      | `3c0e8403c3b46c0b74980e6cc7bec41a72d7aa82deabd58cc7884a11532ac78f` |
| Pinned KERNAL `time`                            | `f62d5bff4bdac9934c91d709ad0050ce3ba6b19b4bc755e5fd5005272fa2fbaf` |
| Pinned KERNAL `rs232nmi`                        | `48b51552deca6f181cd1257aa71041deb5781fd69fb8c9fcb6e44f88dbd8cd03` |

#### Historical AR-P5 exit and subsequent AR-P6 approval

**Best option — AR-P6:** a separate bounded source-contract reconciliation task,
not another identical source probe. The current frozen hardware row is not
proved false: NMI is not automatically self-masking. The unresolved product
choice is whether positive support must cover unrestricted repeated external
arrivals, or may depend on an explicit, qualified set of machine, peripheral and
source conditions. The latter could make a finite per-route proof possible;
it does not establish one now or authorize a silent source restriction.

The proposed next task's deliverable was one concrete contract candidate in this
register: exact admitted machines/sources, observable RESTORE/firmware behavior,
each proposed assumption or exclusion, evidence that can qualify it, and the
remaining entry/exit, resource and timing obligations. It must state any effect
on ordinary game input in plain language. If the candidate cannot support a
finite proof, it must return that specific product fork instead of starting
another open-ended investigation. Only this register and the feature roadmap
would change. Exact frozen-spec corrections, tests and implementation remain
separate approval boundaries.

Normal keyboard ergonomics, both joystick ports and ordinary RESTORE remain the
intended behavior. Neither a no-RESTORE rule nor raw/best-effort samples in place
of named-key results are approved. A duplicate keyboard NMI subsystem, general
interrupt manager or software guard that merely ignores already-entered nested
frames cannot satisfy the unchanged all-source requirement.

Confidence: **High** for this next decision boundary; positive safety remains
**Unknown**. Hardening: a fresh blind `design-challenger` independently inspected
the frozen contract, current guards, pinned firmware and original drawings and
converged on the bounded reconciliation task. Verdict: **Simplify** — one DEF-7
owner, no new support machinery. The strongest counterargument is that even
ordinary stock operation may not yield a defensible finite guarantee. A failed
candidate must finish blocked; more research is not the default exit.

### AR-P6 source-contract reconciliation — complete, 2026-10-03

**Result:** no qualified finite-arrival candidate was established. Restricting
the candidate to stock boards, leaving CIA2 to KERNAL, or excluding additional
peripherals does not supply a RESTORE bound or a completion bound for the stock
settling loops. Those restrictions cannot honestly reopen the unchanged gate.
There is no new source probe, numeric bound or physical qualification in this
task. The exit is the specific proof-scope decision in AR-P7, not more research.

**Best option — AR-P7:** distinguish correct generated interrupt code from a
universal guarantee against unrestricted physical arrivals. This is an explicit
relaxation of the frozen rejection policy, **not** a correction of a false
hardware fact. The proposal does not change the language's general SFA model.

#### Approved contract — authority active; implementation unproved

1. Keep `masks_self_on_entry: false` and `external_reentry_bound: unbounded` for
   NMI. Do not insert a finite depth, pulse interval, settling-iteration limit or
   “human input is slow” premise. No board is newly declared timing-qualified.
2. Permit an unbounded external NMI route only when its **complete transitive
   generated path** is proved reentrant without invocation-private RAM/ZP homes.
   This includes parameters, results, locals, staging, temporaries, spills and
   helper scratch after instruction selection and storage closure. An apparently
   empty source body or a body with no declared locals is not sufficient proof.
3. Retain E10245 for unbounded private-storage overlap, recursive calls,
   compiler-controlled growing stack cycles and incomplete generated reentrancy
   proof. A separately qualified finite source bound could still admit disjoint
   SFA instances through the existing model; none is supplied here. No shared
   private frame, heap, dynamic activation storage, runtime depth selector or
   nested-event guard is introduced.
4. Keep exact register/status/D restoration, callback-only identity, source-bit
   ownership and read counts, bank visibility, safe vector publication/removal,
   predecessor lifetimes and page-safe links mandatory. Fixed installation links
   are lifetime-owned objects, not private activation homes; handler-side changes
   must not overwrite a link still used by an interrupted route. Globals remain
   deliberately shared, with their existing hazard diagnostics. Reentrancy is not
   inferred merely from an absence of SFA homes.
5. Report unrestricted external aggregate hardware-stack use, retained-firmware
   reentrancy and firmware completion guarantees as **unproved** wherever they
   are not established. Never label a one-entry cost or a bounded generated
   component as the whole-program peak/headroom. Keep exact per-entry stack,
   output/ROM bytes, path costs and every bounded component visible. A claimed
   finite deadline still requires a real completion/arrival proof; raster and
   audio timing guarantees are not relaxed by this candidate.
6. Keep each accepted edge's selected handler/acknowledgement/terminal behavior.
   Do not drop or coalesce events, disable RESTORE, consume CIA2 ICR in a simple
   chain, or add a scan hook. Retained firmware stays the pinned predecessor;
   its uncontrolled external behavior is not relabelled safe. Any future hook
   still needs its own exact ownership, behavior and cost proof.

| Contract boundary              | Exact candidate coverage / remaining condition                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Machines                       | Only `c64-pal-prg-kernal-6581`, `c64-pal-prg-kernal-8580`, `c64-ntsc-prg-kernal-6581` and `c64-ntsc-prg-kernal-8580`, NMOS 6510 and pinned 901227-03. The existing stock/unexpanded contract remains. Raw takeover stays a separate RD-05 slice; no ninth profile or board whitelist.                                                                                               |
| Sources                        | RESTORE plus every admitted CIA2 Timer A/B, TOD-alarm, serial and FLAG source, including retained firmware re-enable paths. Every enabled source still needs an owner and exact acknowledgement/dispatch. No additional source is silently excluded or assumed inactive.                                                                                                            |
| Arrival/completion assumptions | No finite assumption is qualified. External aggregate stack exhaustion and retained-firmware completion/reentrancy remain unproved; physical safety is not a claim of this candidate.                                                                                                                                                                                               |
| Observable game input          | No key or joystick port is removed; RESTORE is not a matrix key and stock RESTORE+STOP behavior is not intentionally replaced. Arbitrary repeated external edges can still exhaust the real machine. Named-key correctness, ghosting/joystick ambiguity and port restoration remain required.                                                                                       |
| Exclusions                     | Cartridges/expansions remain excluded by the existing common contract. No new no-RESTORE, no-RS-232, quiet-user-port or stable-human-input restriction is approved or inferred.                                                                                                                                                                                                     |
| Qualification                  | Independent behavior and assembly/cost oracles must establish generated reentrancy, exact volatile effects, entry/exit state, vector transitions and bounded costs. VICE cases exercise bounded nested arrivals, simultaneous sources and interrupted installation/removal; they do not prove unrestricted electrical arrival safety. Revision-sensitive physical QA remains RD-10. |

#### Why this needs authority, and why it is not implementation permission

The prior blanket rejection is explicit in frozen
[`06-functions.md`](../../../../../spec/06-functions.md), lines 527–529 and the
E10245 table; [`11-memory-model.md`](../../../../../spec/11-memory-model.md),
lines 297–300/385; and
[`15-platform-profile.md`](../../../../../spec/15-platform-profile.md),
lines 266–269. `06-functions.md` §7.5 independently protects private SFA storage.
Changing only a TypeScript guard would contradict these authorities.

The concrete downstream authority correction would narrow only the external
hardware-stack/firmware guarantee and the corresponding blanket rejection:
consistent normative prose/diagnostic wording, RD-05 R5.17 and its complete-route
acceptance/target-safety claims, and the dependent expert qualification cases.
Private-storage/reentrancy safety and all other route proofs remain strict.
Any specification edit needs an explicit exception to D3 in a separate authority
maintenance checkpoint, with a new content identity. A substantive expert change
needs a version bump, qualification and dependent audit before activation.
Exact obsolete test expectations require a separately enumerated oracle change;
no test edit is authorized by this proposal. No executable plan is created now.

The existing code grounds a small direction rather than a new support system:
`whole-program.ts:348–358` currently rejects before considering a handler;
`storage/closure.ts:614–631` also rejects an unbounded stack result;
`artifacts/evidence-types.ts:120–130` already separates unproved effects from
bounded stack records. `artifacts/memory-evidence-validator.ts:210–234` has a
source-located `machineState` effect record, while its stack records require
finite peak/headroom arithmetic. `services/evidence.ts:234–236` currently emits
`proved` with no unbounded effects. These are existing ownership boundaries,
not approval to alter them. Reuse the current evidence surface if it can express
the exact claim; do not add a new reporter, schema field or policy service.

The R5.47 raw-memory `unproven` status is a useful comparison, **not** existing
authority to waive NMI safety. The candidate still needs an explicit user choice.
Its strongest counterargument is reduced proof coverage: the resulting build
would not certify whole-machine safety under all externally admitted schedules.
If that guarantee remains non-negotiable, keep the current rejection unchanged.

**Limits of the result:** even approval of AR-P7 would not admit arbitrary
storage-bearing NMI handlers, prove a finite source bound, clear keyboard AR-P2/
AR-P3 or close RD-05. The keyboard scan still must prevent false STOP before
firmware sees transient CIA1 columns and preserve correct row attribution. A
marker after the damage, event-dropping guard or source workaround is insufficient.
The narrower correction may enable a genuinely reentrant storage-free route;
no such generated route, scan hook or runtime result is claimed here.

This documentation-only task adds zero output bytes, cycles, SFA homes or stack
frames. Positive route costs and safety remain Unknown pending qualification.

Confidence: **High** that the candidate preserves the separate SFA obligation;
**Medium** that it enables a useful implementation. A proved transitive
storage-free route and the independent keyboard ownership proof would change
that implementation confidence. Hardening narrowed the correction to an exact
admission criterion, rather than a general safety waiver. Challenger:
**converged** on narrow B; the fresh blind `design-challenger` independently
confirmed the frozen rejection, current guard, complete storage inventory and
separate keyboard failure. No larger conditional-private-storage contract,
runtime guard or source restriction is part of this recommendation.

### Independent obligations — Unknown positive safety

1. **Vector replacement:** both bytes, every intermediate target, saved-link
   publication, handler-side updates and restoration must be safe even if an
   NMI arrives during the transaction. `SEI` alone is insufficient.
2. **Live-handler re-entry:** without a qualified finite overlap bound, the complete
   generated route must prove the approved reentrant/private-home-free exception.
   External aggregate stack and retained-firmware guarantees remain unproved.
   A finite whole-machine stack claim still needs a real all-source bound;
   human input being infrequent or vector placement is not that proof.
3. **CIA2 handoff:** assign the consuming ICR read and each enabled source to
   an exact owner; account for RESTORE and retained firmware behavior. Do not
   reconstruct write-only masks or timer latches from readback, or silently
   widen ownership of VIC-bank and serial-port fields.
4. **Observable behavior and cost:** retain callback-only identity, reachable
   entry variants, A/X/Y and full status restoration, binary body entry, exact
   predecessors and page-safe indirect links. Account separately for emitted
   bytes, existing ROM, SFA homes, hardware stack, volatile effects, and path
   costs. No generated NMI artifact or runtime pass is claimed at this stage.

The [pinned KERNAL NMI source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi)
dispatches through NMINV without saving registers first. Its stock handler
consumes CIA2 ICR and retains source-dependent RS-232/cartridge/RESTORE+STOP
behavior. The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf)
distinguishes consuming interrupt-data reads from write-only mask state and
timer counters from write-only reload latches. Both primary sources were
inspected during this planning task; neither supplies a universal RESTORE
re-entry bound or an arbitrary prior-device snapshot.

## Authority and scope guard

### AR-P7 approval and maintenance boundary — 2026-10-03

The user said: “commit and push all we have first. I approve the correction,
continue further.” All four pending commits were pushed through `29df7555` first.
[T-06](../nmi-proof-scope-correction/99-execution-plan.md) now owns the separate
approved Chapters 06/11/14/15 proof-scope correction, identity record, matching
R5.17 correction and expert 2.0.2 qualification, now complete at the binding above.
AR-P9 additionally approved only the three public metadata identities and the
existing foundation authority/freeze checks. No generated-code, public keyboard
API or NMI-acceptance specification-test change is included.
AR-P4's absence of a finite all-source bound remains a negative fact, not a new
finite qualification. Positive planning may now use the approved
reentrant-generated-route boundary, not the superseded blanket rejection.

Existing recursion diagnostics remain E10180/E10181; AR-P7's shorthand does not
reassign their canonical ownership to E10245. Shared-state warnings remain warnings.
DEF-7 and RD-05 remain open. Future commits are local unless another push is requested.

Historical pre-maintenance identity: `skillVersion=2.0.1`, qualified content
`1ce4852016e2a883cf1f733c6014c45e176bfc69`; specification identity
`BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`.
Governing expert boundaries are `sfa-and-abi.md#interrupt-route-completion-gate`,
`c64-memory-and-runtime.md#revision-pinned-nmi-contracts-and-costs`,
`c64-hardware.md#cia-register-effects-and-ownership`, and
`mos-6502-family.md#reset-interrupt-and-stack-behavior`.
Primary keys: MOS-PGM-1976, MOS-HW-1976, MOS-6510-1982, MOS-6526-1981,
CBM-C64-KERNAL-03. Revision-sensitive board claims additionally need an exact
CBM-C64-SVC-1985 schematic/model; emulator checks cannot replace physical QA.

No new profile, source restriction, language API, runtime trampoline/gate,
dispatcher, shadow manager, dependency or harness is approved. Any such
necessary proposal must be grounded and receive the applicable explicit
product/complexity decision before entering executable work. DEF-7 remains
owned by RD-05; this register does not close or silently re-defer it.

The complete 12-category scan, technical resolutions, specification-first test
cases and executable plan remain pending. Qualified authority maintenance
reopens planning, not executable work. Remaining proof obligations and material
decisions must clear before implementation; no production machinery is added
by this register.

## Independent simplicity and safety challenge

One blind `design-challenger` reviewed three candidate directions: immediate
direct implementation with derived proofs; a bounded proof-first cooperative
slice; or a separately approved source-restricted profile/runtime gate. It
selected the proof-first slice. No new profile/runtime system is justified by
the evidence now. Source/nesting closure is the first pass/fail condition, not
an open-ended research phase. A failure must identify the unclosed permitted
source and the missing fact, with DEF-7 still owned by RD-05.

A matching-low-byte layout (stock predecessor `$FE47`, generated entry `$xx47`)
is a real candidate for publishing only the vector's high byte. This is an
analytical possibility, not an approved or qualified lowering. Saved-link
publication, placement/padding, nesting and restore obligations still need
proof. It solves neither RESTORE re-entry nor CIA2 ownership by itself; no
placement mechanism or runtime gate is added by this register.

The strongest counterargument to the recommended order is that it may finish
without a new usable NMI capability. That is preferable to recording a false
finite bound or building unneeded support machinery: the gate returns a
specific fact to resolve, not a claim that NMI is permanently impossible.

The final bounded independent challenge confirmed that the normative unbounded
row makes certification fail under the unchanged contract. The strongest
counterargument is that actual RESTORE circuitry and source control may allow
a small direct implementation once their guarantees are qualified. That keeps
physical feasibility Unknown without invalidating the contract-level result.

Confidence: High for the negative certification result under the unchanged
contract. Hardening: two bounded independent challenges; no further research
or support machinery in this task. The user confirmed AR-P2 with an explicit
simplicity constraint. No new RESTORE behavior, source restriction or runtime
support approval is granted by that planning-scope confirmation.

## Historical verification — original bounded check

All 20 cases in `test/rd05/profile-interrupts.spec.test.ts` pass with one worker:
the existing four-profile NMI rejection cases and positive IRQ controls. Capture:
`/tmp/blend65-nmi-check-5H6m3D/profile-tests.log`. No oracle or compiler file
changed. Checks pass for 47 local links, six primary source keys, four expert
anchors, whitespace and frozen-authority cleanliness. Markdown retains the
project's authored-documentation formatter exclusion.

The roadmap engine confirms the feature's 2/10 counter. It reports the existing
portfolio mismatch (1/10 and its rolled-up status); that separate write remains
deferred on `feature/v4-rebuild` until integration, as the roadmap rule requires.
The portfolio is unchanged. No new assembly, VICE, physical-hardware or
whole-compiler qualification is claimed by this planning-only task.

## Verification — AR-P5 investigation

Artifact checks pass for the exact two-document modification set, 54 local
links, six primary source keys, four expert anchors, nine original-source hashes,
the pinned firmware instructions, blocked gates, whitespace and frozen-authority
cleanliness. Forced targeted Prettier passes for this register; the roadmap
retains its authored-documentation exclusion. Capture:
`/tmp/blend65-restore-safety.XTgULP/artifact-check.log`, `format-check.log` and
`roadmap-check.log`. Independent `correctness-reviewer` review returned **no
findings** across correctness, maintainability, standards, API surface and
concurrency; it also checked the captured originals and source hashes. The
review was read-only.

This is documentation and primary-source inspection only; no new compiler,
assembly, VICE or physical hardware qualification is claimed. Compiler tests
and performance/security auditors are not applicable to this docs-only change.
The feature remains 4/10 with RD-05 executing. The portfolio's existing 1/10
roll-up mismatch is deferred on this non-integration branch; the roadmap engine
reports no counter drift in the feature roadmap.

## Verification — AR-P6 reconciliation

Artifact checks pass for the exact two-document modification set, 57 local
links with their named anchors, six primary source keys, four expert anchors,
nine retained original-source hashes, pinned firmware patterns, current gate
states and frozen-authority/spec-test integrity. Forced targeted Prettier and
`git diff --check` pass. The feature remains 4/10 with RD-05 executing; the
roadmap engine reports only the known portfolio 1/10 versus 4/10 drift, whose
write is deferred on this non-integration branch. Captures:
`/tmp/blend65-nmi-contract.YY4wl7/artifact-check.log`, `format-check.log` and
`roadmap-check.log`. The roadmap retains its authored-documentation formatting
exclusion. Independent read-only `correctness-reviewer` review returned **no
findings** across correctness, maintainability, standards, API surface and
concurrency. It checked the exact two-document diff and validation commands.

This verifies a contract proposal, not the proposed behavior. No compiler,
specification test, frozen specification or expert file changed. No new generated
assembly, VICE or physical result is claimed. Compiler-suite execution and
security/performance auditors are not applicable to this documentation-only
checkpoint. All existing executable RD-05 slice/task checklists are complete;
the remaining keyboard/NMI registers are blocked, not executable plans.
