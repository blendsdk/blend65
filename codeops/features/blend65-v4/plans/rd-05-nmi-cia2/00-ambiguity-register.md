# Ambiguity Register: RD-05 NMI and CIA2

> **Status**: ✅ SCOPE GATE PASSED — AR-P1–AR-P31 approved; necessary AR-P32–AR-P36 corrections verified
> **Last Updated**: 2026-10-06
> **CodeOps Artifact Schema**: 1

| Planning boundary | Scope                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target            | The next bounded `blend65-v4/RD-05` NMI/CIA2 planning task, including DEF-7. The user confirmed xhigh effort and continuation on 2026-09-30. This is not implementation authority or whole-RD closeout.                                                                                                                                                                                                                           |
| Context artifacts | Frozen Specification 4; RD-05 R5.15–R5.18/R5.20; the RD-04 DEF-7 decision; completed IRQ, CIA and CIA1-return plans; qualified expert 2.0.3; primary CPU/CIA/KERNAL evidence; current profile, semantic, storage and machine code.                                                                                                                                                                                                |
| Modification set  | This plan folder and the feature roadmap. AR-P11 approves only its named three existing specification-test files and ledger JSON during later specification-first execution. New tests prove the existing qualified contract. T-06/T-08 separately completed frozen-authority maintenance. No new API, profile, specification edit, runtime manager or whole-RD closeout is authorized. Earlier discovery is retained as history. |

| #      | Category                                                            | Ambiguity / Gap                                                                                                                                                                                                                                                                                                     | Options Presented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | User Decision                                                                                                                                                                                                                                                                                                            | Status                                                                       |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| AR-P1  | Planning target / effort                                            | Which next work item is authorized?                                                                                                                                                                                                                                                                                 | The named RD-05 NMI/CIA2 planning task, with xhigh effort.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | User: “xhigh effor is confirmed, proceed further” on 2026-09-30, replying to the explicitly named planning task.                                                                                                                                                                                                         | ✅ Resolved                                                                  |
| AR-P2  | Scope / source safety (complex)                                     | What is the smallest scope that can progress DEF-7 without inventing hardware guarantees or a runtime manager?                                                                                                                                                                                                      | **Recommended:** a bounded proof-first slice on the four existing cooperative PRG profiles, using existing NMI/CIA2 APIs. Close permitted-source and live-handler re-entry facts first, then safe vector replacement and exact CIA2 handoff. If a permitted source remains unbounded or unknown, stop with the exact missing fact and retain the existing guard; do not invent a profile, promise a positive implementation, or silently defer the obligation. Raw takeover remains a separate RD-05 slice. | User: “Make sure we are not overcomplicating or overengineering. proceed further.” on 2026-10-01, accepting the sole scope recommendation presented immediately before the reply.                                                                                                                                        | ✅ Resolved                                                                  |
| AR-P3  | Verification / inherited project rule                               | Which existing verification policy applies if this plan becomes executable?                                                                                                                                                                                                                                         | Directed specification, assembly/cost and implementation tests; frozen-lockfile install, build, typecheck and complete tests at phase checkpoints; sequential four-profile VICE cases; revision-sensitive physical QA at RD-10. Planning-only documents use link, authority and consistency checks.                                                                                                                                                                                                         | Import the unchanged approved CIA1-return AR-P4 verification policy and current AGENTS.md impact-based rules; no new verification surface.                                                                                                                                                                               | ✅ Resolved                                                                  |
| AR-P4  | Upstream profile qualification                                      | The unchanged profile admits unbounded NMI nesting, which cannot fit a finite hardware stack. What qualified source contract could justify a finite bound?                                                                                                                                                          | Reopen positive planning only with a qualified all-source nesting bound, or complete edge-spacing and worst-case route-time proof. Any correction to the frozen profile needs separate authority. Retain the existing DEF-7 guards meanwhile.                                                                                                                                                                                                                                                               | The original no-bound result remains true. Qualified AR-P7/AR-P9 maintenance now supersedes blanket rejection only for the approved reentrant, private-home-free generated route. Positive implementation proofs remain; DEF-7 stays RD-05-owned.                                                                        | ✅ Resolved — blanket gate superseded; no bound proved                       |
| AR-P5  | Scope / bounded source investigation                                | May the keyboard prerequisite return to its existing DEF-7 owner for one new evidence check?                                                                                                                                                                                                                        | Inspect missing RESTORE/all-source guarantees, not another T-04 replay or repetition of the completed unbounded-profile check. Exit with new qualifying evidence or the specific user-owned source-contract fork. No compiler/spec edits or new subsystem.                                                                                                                                                                                                                                                  | User: “proceed” on 2026-10-03, replying to the named high-effort, docs/evidence-only RESTORE investigation and its exact modification set.                                                                                                                                                                               | ✅ Resolved — investigation only; original result retained                   |
| AR-P6  | Product / source-contract reconciliation (sensitive)                | Should positive NMI planning retain the unrestricted arrival guarantee, or seek explicit supported-machine/source conditions while preserving ordinary RESTORE behavior?                                                                                                                                            | **Best option:** authorize one separate, bounded source-contract reconciliation task under DEF-7. Produce a concrete candidate and its remaining proof obligations for user decision; do not invent a finite number, assert that the frozen hardware fact is false, disable RESTORE, or add a hook/framework. The immediate safe alternative is to retain the unchanged contract and keep positive NMI/keyboard planning blocked.                                                                           | User: “I approve, proceed until all RD-05 is done, do not stop or pause, unless absolut;y neccssary. The effort level is set and confirmed.” on 2026-10-03. This approves the named reconciliation deliverable, not a yet-unpresented frozen-contract correction or source restriction.                                  | ✅ Resolved — reconciliation only; AR-P7 now active                          |
| AR-P7  | Product / frozen proof-scope correction (sensitive)                 | May a proved reentrant, invocation-private-storage-free generated NMI route remain expressible when the external aggregate stack and retained-firmware completion guarantees are explicitly unproved?                                                                                                               | **Best option:** the narrow proof-scope candidate below. Retain real unbounded NMI facts, strict private-storage safety and all ABI/device/vector obligations; stop claiming universal external stack/completion safety. No assumed nesting number, event suppression, new profile or runtime guard. Keeping the unchanged blanket rejection is the safe alternative, but cannot complete this positive slice.                                                                                              | User explicitly approved the correction on 2026-10-03 and requested saving/pushing first. T-06 owns the separate frozen-authority maintenance and expert requalification; compiler/API/spec-test changes remain separate gates.                                                                                          | ✅ Resolved — authority maintenance complete                                 |
| AR-P8  | Scope / developer experience / bounded proof                        | May the approved ordinary-input direction be tested through one minimal internal scan-aware ingress?                                                                                                                                                                                                                | One temporary assembly proof under DEF-7, with explicit stock behavior, transition, state and cost expectations. Keep ordinary saved-data interpretation in Blend65 libraries. No production subsystem or frozen-authority change.                                                                                                                                                                                                                                                                          | User: “I approve” on 2026-10-03, replying to the deeper assessment's focused contract-and-proof recommendation. [T-05](../keyboard-ingress-proof/99-execution-plan.md) owns the diagnostic proof; AR-P7 was open at that decision; T-06 authority maintenance and AR-P9 binding are now complete.                        | ✅ Resolved — proof only                                                     |
| AR-P9  | Runtime / active identity synchronization                           | May T-06 update the three public identity fields and corresponding foundation guards before binding the approved authority?                                                                                                                                                                                         | **Best option:** the exact two-file extension below, retaining historical negatives and byte-exact candidate/active checks in two green checkpoints. No generated-code or NMI-acceptance change.                                                                                                                                                                                                                                                                                                            | User explicitly approved the bounded identity synchronization on 2026-10-03.                                                                                                                                                                                                                                             | ✅ Resolved — exact two-file extension                                       |
| AR-P10 | Product / machine-entry proof (sensitive)                           | May NMI-using programs on the four cooperative PRG profiles require the stock NMINV predecessor at entry, without an independent resident vector owner?                                                                                                                                                             | **Best option:** qualify the exact stock-entry condition below, then prove matching-low placement and one-byte publication through the existing compiler owners. No new API, runtime guard, source-form ban or finite NMI bound. Broader arbitrary-predecessor support needs a separately costed direct publication scheme.                                                                                                                                                                                 | User: “go with the best possible option, and proceed further” on 2026-10-03, accepting the exact entry condition and bounded authority-maintenance scope presented.                                                                                                                                                      | ✅ Resolved — authority qualified and bound                                  |
| AR-P11 | Specification-test authority (planning)                             | Old empty chained-NMI fixtures require blanket rejection despite the qualified reentrant-route exception. Which exact oracle updates may enter the next plan?                                                                                                                                                       | **Best option:** convert only the balanced empty chained fixture to success; split its ledger probe from the still-deferred exclusive fixture; retarget the old canonical E10245 diagnostic to a balanced, genuinely storage-bearing handler. Preserve every other fixture, negative assertion and artifact-schema guard. No implementation is authorized before its plan/proof gates.                                                                                                                      | User: “I approve, proceed” on 2026-10-03, accepting the exact three specification-test files and ledger JSON described below.                                                                                                                                                                                            | ✅ Resolved — exact fixture exception                                        |
| AR-P12 | Technical / bounded publication and lifetime proof                  | Which direct compiler design satisfies AR-P2/AR-P7/AR-P10 without assuming a nesting limit or introducing support machinery?                                                                                                                                                                                        | Reuse existing ownership/context, selected storage, wrapper and layout owners; require the observer-lifetime invariant below. Direct low-$47 entry where possible; an ordinary three-byte JMP entry only when source placement needs it. Preserve canonical diagnostics and use existing unproven evidence fields.                                                                                                                                                                                          | Internal compiler decision under the user's AGENTS.md workflow prime directive §4, within AR-P2/AR-P7/AR-P10; independently challenged. No new product condition or complexity surface.                                                                                                                                  | ✅ Resolved — analytical direction, not runtime qualification                |
| AR-P13 | Technical / runtime test endpoints                                  | Which existing endpoints cover helper/link output, changed-capture diagnostic provenance and word wrap without inventing public projections?                                                                                                                                                                        | Keep admission assertions in 2.1.1; assign actual bytes/calls/links to 2.1.2. Use Chapter 14's existing primary/related spans for the concrete changed-capture route. Public writer cases cover second-byte overlap and computed unsigned wrap into NMINV; physical second-byte wrap belongs to 2.3.1.                                                                                                                                                                                                      | Primary technical ruling under AGENTS.md workflow Prime Directive §4. No user acceptance is inferred; no API, source rule, public schema or support surface changes.                                                                                                                                                     | ✅ Resolved — bounded endpoint clarification                                 |
| AR-P14 | Specification-test authority (runtime)                              | AR-P11 preserves an E10245 message assertion that predates the current frozen registry.                                                                                                                                                                                                                             | **Best option:** update only that one regex in `test/rd04/diagnostics-alternate-placement.spec.test.ts` to Chapter 14's current template. Preserve every other field/assertion and the approved fixture correction.                                                                                                                                                                                                                                                                                         | User explicitly approved this exact additional message assertion correction on 2026-10-04.                                                                                                                                                                                                                               | ✅ Resolved — one-assertion exception                                        |
| AR-P15 | Technical / execution-to-emission preservation (runtime)            | A selected but never-entered IRQ entry has no wrapper label; emission also resurrects unreachable vector effects after a proved nonreturning call.                                                                                                                                                                  | **Best option:** qualify a bounded correction using the existing proof's reached-path facts for inventory/lowering and the ordinary entry ABI for reference-only selected labels. Preserve source identity/placement, real execution contexts and frozen oracles. No fabricated arrival, source ban, placeholder alias, new evaluator, runtime or general optimizer.                                                                                                                                        | User: “I do” on 2026-10-04, replying to the explicit bounded test-first correction recommendation. Existing proof, inventory and lowering owners only; new independent cases, no old-oracle changes.                                                                                                                     | ✅ Resolved — bounded correction approved                                    |
| AR-P16 | Technical / raw-only typed installer binding (runtime)              | A retained raw handler's never-observed helper contains a typed NMI installation. Source code must remain materialized, but no actual capture/context exists to satisfy its current machine binding consumer.                                                                                                       | **Best option:** qualify a bounded noncertifying entry/link retention contract in the existing owners, separate from actual execution/capture proof. No fabricated stock capture, external guarantee, source ban, new API or runtime manager.                                                                                                                                                                                                                                                               | User: “proceed” on 2026-10-04, approving qualification first and implementation only after the narrow contract passes. Independent SFA/semantics assessment below qualifies retention only; test-first correction may proceed.                                                                                           | ✅ Resolved — conditional retention only; no admission claim                 |
| AR-P17 | Technical / retained-call ABI and continuation correction (runtime) | Independent review reproduces three MAJOR consumer defects in the AR-P16 implementation: callee code/data context mismatch, a source-address indirect thunk bypassing the selected retained variant, and emission after a proved nonreturning call.                                                                 | **Best option:** correct these three existing call/context consumers test-first, using the existing emission catalogue, finite-target dispatch and return summaries. New independent regressions precede correction. No existing oracle change, API, runtime, source ban, new evaluator or second registry.                                                                                                                                                                                                 | User: “I approve” on 2026-10-04, accepting the sole AR-P17 bounded correction and new regression recommendation. No existing-oracle size/split exception or new support machinery is approved.                                                                                                                           | ✅ Resolved — bounded correction approved; verification pending              |
| AR-P18 | Technical / selected-call lifetime interference (runtime)           | Reused canonical callee homes can overlay a retained caller value live across that call because existing call-overlap requires equal activation roots. Final native witness confirms both homes at $0bbd.                                                                                                           | **Best option:** extend only the existing interference owner, share the existing pure descriptor selector and resolve transitive calls from the selected context; new independent caller-lifetime regressions first. No blanket variant separation, runtime, source rule or new analysis framework.                                                                                                                                                                                                         | User: “I approve” on 2026-10-04, accepting this exact interference-owner extension, shared selector and one new independent regression file.                                                                                                                                                                             | ✅ Resolved — bounded correction approved; verification pending              |
| AR-P19 | Technical / IRQ applicability and exact oracle mechanics (runtime)  | The new selected-callee walk consumes an empty NMI reached map in IRQ-only programs, dropping transitive call conflicts. Two frozen test files also assume lexical debug names; the new lifetime test conflates code-entry count with canonical storage reuse.                                                      | **Best option:** correct only the NMI-proof applicability condition in the existing interference owner; independently author one focused IRQ regression; approve only the two named declaration-lookup corrections and the new lifetime test's selected-entry/home checks. Preserve source fixtures, behavior, widths, native ABI and allocation expectations. No new API, fact model, runtime or source restriction.                                                                                       | User: “I approve” on 2026-10-04, accepting the sole exact AR-P19 recommendation and its four named code/test paths.                                                                                                                                                                                                      | ✅ Resolved — exact bounded correction approved; verification pending        |
| AR-P20 | Technical / existing scalar-constant contract repair (runtime)      | The final-inventory check correctly exposes an unnecessary private local home/store for an unplaced scalar constant. Frozen §3/§4.2 already requires compile-time initialization and zero declaration storage; the existing NMI constant/helper oracle cannot pass while the generic CFG producer emits this store. | **Best option:** pass the existing authoritative binding table into CFG construction and omit runtime initialization only for unplaced, non-loadable scalar/enum constants; new focused public ordinary-program RED first. Preserve mutable, materialized, aggregate and loadable behavior. No NMI exemption or optimizer.                                                                                                                                                                                  | Compiler/plan ruling under the user's standing AGENTS PRIME workflow rule 4: deterministic implementation of an already approved frozen contract, not a new product/scope fork. The independent simplicity challenger concurs; no new user approval is claimed. Exact owner/proof bookkeeping below precedes correction. | ✅ Resolved — existing-contract technical correction; implementation pending |
| AR-P21 | Frozen specification-test lookup mechanics (runtime)                | The AR-P20 author packet gives `Game.main` as the code-owner ID, but public evidence uses the source-qualified `src/game.blend::Game.main`. The immutable new oracle consequently cannot inspect the mutable control's code.                                                                                        | **Best option:** change only the four `functionBytes` call arguments in `test/rd05/local-scalar-constants.spec.test.ts` from `Game.main` to `src/game.blend::Game.main`, then re-freeze and rerun RED. Preserve all sources, storage, byte, ordering, cardinality and cost expectations; no compiler or fixture change.                                                                                                                                                                                     | User: “approve, proceed” on 2026-10-05, replying to the exact four-argument exception and continuation recommendation. No wider test exception is authorized.                                                                                                                                                            | ✅ Resolved — exact lookup correction approved                               |
| AR-P22 | Frozen specification-test entry fixture and value oracle (runtime)  | All four new fixtures measure `main` but require an ordinary `RTS`, contrary to frozen startup/cleanup rules. The mutable control also checks instruction presence without proving the assigned values reach its addressable storage and outputs.                                                                   | **Best option:** in only `test/rd05/local-scalar-constants.spec.test.ts`, move each unchanged measured body to ordinary `sample`, add `main` calling it, and update the four owner arguments. Preserve all existing native, storage and effect checks. Strengthen only the mutable control with distinct input/output value checks through the existing profile-project and sequential VICE fixtures. No new harness, decoder, dependency or compiler change.                                               | User: “I approve” on 2026-10-05, replying to this exact one-file repair and continuation recommendation. Only necessary imports, profile typing, local fixture wiring and timeout are included.                                                                                                                          | ✅ Resolved — exact fixture/value correction approved                        |
| AR-P23 | Technical / zero-byte private-storage marker (runtime)              | The selected final inventory contains a valid zero-length local array marker with zero bytes, but the new check rejects it as private storage.                                                                                                                                                                      | **Best option:** ignore only exact zero-byte requests for this rejection; preserve normal marker identity and all positive-width storage checks.                                                                                                                                                                                                                                                                                                                                                            | Compiler/plan ruling under PRIME workflow rule 4 and frozen Chapter 08 AR-2; no new user product approval or test exception claimed.                                                                                                                                                                                     | ✅ Resolved — deterministic existing-contract correction                     |
| AR-P24 | Technical / zero-byte debug correlation (runtime)                   | Actual native assembly of a legal zero-length local reaches debug generation, which wrongly requires an emitted instruction range for the erased zero-byte declaration.                                                                                                                                             | **Best option:** after an independent NMI regression/debug RED, require a nonempty live machine range only for positive-width homes and retain the existing zero-width optimized-away context marker. Preserve the independently prepassing ordinary controls and every positive-width check.                                                                                                                                                                                                               | Compiler/plan ruling under PRIME workflow rule 4 and frozen Chapter 08 AR-2. No user product choice, old oracle exception or new debug schema is claimed.                                                                                                                                                                | ✅ Resolved — deterministic existing-contract correction                     |
| AR-P25 | Technical / reference-only debug ownership (runtime)                | Public candidate builds of masked installed IRQ entries fail with `Final machine block has no semantic CFG owner`; their generated tail block lacks the existing semantic-entry label correlation.                                                                                                                  | **Best option:** give the existing generated reference tail its source-entry-qualified block label, preserving stable function/export identity and all bytes. Reuse existing final-machine/context facts for any separately demonstrated selected debug mismatch; no new debug schema or proof stage.                                                                                                                                                                                                       | Compiler/plan ruling under PRIME workflow rule 4. No old oracle edit, generated arrival or source restriction is authorized.                                                                                                                                                                                             | ✅ Resolved — necessary existing artifact-contract correction                |
| AR-P26 | Technical / canonical debug symbol labels (runtime)                 | The actual public raw-handler artifact fails the existing debug validator because its symbol labels follow internal machine-ID order rather than canonical emitted-label order.                                                                                                                                     | **Best option:** sort only each function symbol's existing emitted label list using the existing UTF-8 comparator. Preserve entry variant IDs/indexes and every validation check.                                                                                                                                                                                                                                                                                                                           | Compiler/plan ruling under PRIME workflow rule 4. No schema, code, proof or frozen-test edit.                                                                                                                                                                                                                            | ✅ Resolved — deterministic existing-contract correction                     |
| AR-P27 | Technical / selected-code debug correlation (runtime)               | Real public producer/native runs fail on masked-helper and nonreturning-path cases because the debug owner expects entries for every old source-call reachable declaration, including bodies that the shared proof correctly omits. It also attaches every original source call to every emitted variant.           | **Best option:** reuse actual reached-body, retained-emission and captured-selection facts to choose debug function owners; correlate call contexts only with source calls present in each final machine variant. Preserve missing-body errors for required emission. Mechanically move the unchanged range mapper before expanding its over-limit owner.                                                                                                                                                   | Compiler/plan ruling under PRIME workflow rule 4. Existing frozen independent cases are RED; no new analysis, proof context, schema, API, test edit or source restriction.                                                                                                                                               | ✅ Resolved — necessary existing artifact-contract correction                |
| AR-P28 | Frozen specification-test identity and proof mechanics (runtime)    | The current public set is 336 PASS / 112 FAIL. One hundred cases stop at bare owner-name lookups; twelve stop at over-specific aggregate-pointer, single-instruction address or declaration-overlap checks. Independent SFA review also exposes a latent reference-shell/body conflation.                           | **Best option:** approve only the 19 source-qualified name corrections in ten files and the four exact proof repairs in the two files enumerated below. Preserve all source fixtures, behavior, ownership, cost and negative requirements. No compiler, API, authority, source restriction or support machinery change.                                                                                                                                                                                     | User: “I approve - proceed” on 2026-10-05, accepting the exact twelve-file AR-P28 repair. No wider exception.                                                                                                                                                                                                            | ✅ Resolved — exact repair cleared; broader public gate remains              |
| AR-P29 | Frozen specification-test startup decode and main exit (runtime)    | Approved AR-P28 repairs expose 28 failures in three files: a whole startup block is mistaken for one instruction, and two source walkers follow main's normal exit into platform restoration.                                                                                                                       | **Best option:** only the three local helper repairs below, preserving actual bytes, ownership, all fixtures and every contract/cost assertion. Keep the patch local with the explicit at-most-400-line owner exception; no new harness or compiler changes.                                                                                                                                                                                                                                                | User: “I approve” on 2026-10-06, accepting the exact three-file AR-P29 correction and its bounded local-owner size exception.                                                                                                                                                                                            | ✅ Resolved — exact repair independently cleared; public GREEN               |
| AR-P30 | Technical / bounded output repair (runtime; complexity escalation)  | Complete expert comparison exposes callback-selection staging, redundant empty-loop jumps and duplicate equivalent terminal bodies. The new continuation oracle also needs a distinct-effect returning control.                                                                                                     | Bounded correction using existing owners; no expert-floor waiver, optimizer framework or source workaround.                                                                                                                                                                                                                                                                                                                                                                                                 | User approved scope and subsequently confirmed repair/verify before commit/push on 2026-10-06.                                                                                                                                                                                                                           | ✅ Resolved — bounded repair verified                                        |
| AR-P31 | Frozen new-oracle interface clarification (runtime)                 | Two new assertions mistake resident bytes for loaded bytes and source-role kind for interrupt ABI kind.                                                                                                                                                                                                             | Correct only those assertions against the existing public artifact contract; retain all fixtures, behavior, identity and cost requirements.                                                                                                                                                                                                                                                                                                                                                                 | User: “I approve” on 2026-10-06, accepting the exact two-file assertion correction and 350-line local-helper ceiling.                                                                                                                                                                                                    | ✅ Resolved                                                                  |

## AR-P31 — Correct two new artifact assumptions, not the compiler

The primary author used an incorrect interface packet from the main agent:
the sum of every resident interval's payload/padding is not the PRG size.
Frozen Chapter 15 requires trailing BSS to occupy RAM without being serialized.
The sixteen primary cases now pass their preceding continuation, callback,
volatile effect and ABI checks after MC-001, then fail only on this assertion:
50 resident-state bytes are incorrectly counted as loaded. Build and touched
production formatting pass. Capture:
`/tmp/blend65-nmi-ar21.0c36Fe/ar30-mc001-primary.log`.

The new selector-cost author separately assumed `entryVariants.kind` distinguishes
raw from firmware entry. It identifies the source role: both are `interrupt`.
Actual distinct labels, addresses and byte obligations prove ABI distinction;
a kind-string difference does not. The author reports this assumption explicitly,
without reading implementation. Its four loaded-prefix controls pass; twelve
selector/loop/home checks are genuinely RED; four kind checks need correction.

**Best option:** approve only these local corrections in the two new files:

- `nmi-route-nonreturning-arm-output.spec.test.ts`: change only
  `requireLoadedAccounting` to count the complete physical interval union inside
  `[PRG load address, load address + PRG payload length)`, compare it to the actual
  payload and `costs.totals.programBytes`, and preserve zero-fill assertions.
  Trailing resident state contributes no loaded bytes. Keep every fixture,
  callback/thunk/continuation/source-effect assertion unchanged.
- `nmi-route-nonreturning-selector-cost.spec.test.ts`: correct only the last
  case's erroneous different-kind assertion. Require the source role `interrupt`,
  retain distinct entry labels/addresses and at least two entries, and prove
  the retained raw register-save/binary-entry prefix separately from the masked
  firmware reference's indirect saved-vector tail. Use actual entry bytes and
  labels, not fixed output addresses. Keep all other cases and exact 11-byte,
  3-byte/3-cycle, zero-private-home and loaded-accounting expectations unchanged.

Keep the primary local helper in its existing file with a bounded 350-line
ceiling (currently 325), rather than introduce a shared harness or weaken proof.
The second file is 198 lines. No old oracle, compiler producer, public schema,
specification, expert skill, API or source restriction changes. This is a local
test-contract clarification; no extra implementation plan or framework is needed.

Frozen candidates: primary SHA256
`a90667b30d4ec24b1deaaa9e0c5a805bb69623d7fdca1e06ad207377517bbc6a`;
selector SHA256
`731b0d908d48ad7a09dff074f16c32bdabcc5ac5b158ef46f5926f39cdf4eae2`.
Neither is edited after the author reports the faulty assertion. MC-002–MC-004
remain unimplemented; their independent cost RED is retained. Task 2.3.3 pauses
for this exact exception; no ledger retirement, green commit or push is claimed.

User decision on 2026-10-06: “I approve”. The exact two-file correction and
350-line local-helper ceiling above are approved. The implementation-blind author
applies only those changes, records fresh results/hashes and freezes both files
again. Task 2.3.3 resumes; the remaining output repairs and full qualification
still precede the explicitly authorized commit/push.

## AR-P30 — Complete retained callback output must meet the expert floor

The task-2.3.3 independent full-routine comparison exposes a necessary output
gap that the local NMI-wrapper account did not cover. Actual H and four retained
terminal bodies total 110 code bytes; equivalent ordinary-call expert work uses 17. H takes 71/62 cycles to its callee and owns five SFA bytes; the expert selection
takes 12/13 cycles with no such homes. Empty terminal loops use nine code bytes and
six recurring cycles instead of three bytes/three cycles. Canonical raw identity,
selected ABI and call frames must remain correct; retention is not invocation.

With the existing immutable low-$47 boundary unchanged, removing those 93 code
bytes increases loaded fill by 93. The payload remains 872 bytes; resident RAM
would decrease from 931 to 926. This is a cycle/RAM/code floor failure, not a
claimed PRG win. Mandatory local-meet [issue #96](https://github.com/blendsdk/blend65/issues/96)
tracks the separate wrapper/padding path to a win; it does not waive this gap.

Original goal: qualify the already-approved cooperative NMI route with complete
equivalent expert costs. Extra system or support code: a bounded extension to
ordinary finite-call/empty-block/equivalent-body lowering before this slice may
qualify; no new optimizer pass, mode, framework, schema or dependency is proposed.
Why it may be needed: the current plan excludes an optimizer, but these concrete
generated paths are worse than equivalent expert work. Existing-owner corrections
must be explicitly bounded, not silently expanded into RD-08 implementation.
Evidence: `machine/lower-indirect.ts:202`, `machine/lower-function.ts:423`,
`semantic/lower-control.ts:93`, the existing direct interrupt-choice pattern at
`semantic/lower-calls.ts:204`, `machine/block-layout.ts:43`, and context variant
selection at `machine/interrupt-specialize.ts:89` / `machine/lower.ts:254`.
Smallest solution that still works: repair only witnessed single-consumer closed
callback choices, ordinary terminal-arm edges, empty-loop jump chains and exactly
equivalent storage-free terminal variants in existing owners, with independent
behavior/cost expectations before code. Keep returning, unknown, effectful,
identity-observed and context-dependent controls conservative. A separately owned
prerequisite repair is the viable alternative; qualification stays blocked then.
Extra cost: the necessary existing semantic/lowering/storage/debug owners plus
direct specification/implementation regressions; no new permanent subsystem.
Independent verdict: Justified — extend this plan narrowly rather than fragment
the same prerequisite work across plans. Sharing must be within one source
function and prove identical ABI, storage, links, context and identity obligations.
If that requires a new representation or cross-cutting redesign, stop and move
that prerequisite to a separately bounded plan. Confidence: Medium; exact
equivalence/applicability must pass independent specification and specialist
review. Challenger: converged. Direct user decision: approved on 2026-10-06,
with the order subsequently corrected by the user confirmation below.

**Best option:** approve only MC-001–MC-004's witnessed existing-owner repairs:
nonreturning continuation removal, single-consumer closed zero-argument/void
conditional-call lowering, effect-free empty-loop jump collapse, and same-source
storage-free leaf variant sharing. No source ban, cross-source function merging,
general optimizer, new pass/mode/schema/harness/API or dependency. Keep the
separate restoration-layout size/cold-cycle tradeoff with issue #96/RD-08.
Execution resumes only after this exact scope and the new oracle clarification
are approved. Independent behavior/bytes/cost RED cases precede production, and
fresh SFA/semantics/platform/output verification precedes native qualification.

User approval on 2026-10-06: “commit and push first the do the AR-P30”. This
accepts the exact bounded repair and new-oracle clarification, but requires the
checkpoint first. The guarded commit check runs both the new oracle and existing
ledger: 17 FAIL / 10 PASS in 5.32 seconds, exit 1. Twelve terminal-arm failures,
four over-specific returning controls and the one still-deferred chained row
remain expected unfinished work, not seventeen newly diagnosed compiler defects.
Capture: /tmp/blend65-nmi-ar21.0c36Fe/pre-ar30-commit-verification.log.
No staging, commit, push or implementation follows a failing checkpoint.
The user subsequently replied “i confirm” on 2026-10-06 to the recommended
order correction: repair AR-P30, verify the full phase, then commit and push.
The exact AR-P30 scope and oracle clarification remain approved. No failing
checkpoint is staged or committed. The four repairs are bounded substeps of
task 2.3.3; the existing 64/68 task count remains unchanged until qualification.

The new MC-001 continuation oracle is 238 lines at SHA-256
`014c724207481fc1e71005eb29e7518bf1c953c8634216e60b9ace38aa16efea`.
Its initial independent RED has twelve terminal-arm failures and four returning
controls with an over-specific direct-call predicate. An already-approved
canonical no-argument thunk may preserve ordinary-call ABI correctly; missing
direct JSRs are not themselves an implementation defect. The proposed exact
clarification gives potentially returning targets distinct volatile writes and
proves direct calls or that legal canonical thunk, preserving terminal-arm,
effect-order, dead-suffix and complete-loaded-accounting expectations. No existing
frozen oracle changes are proposed. No fixture change is used to outlaw thunks.
Do not change even this new frozen fixture before the bounded ruling is approved.
No production repair, ledger retirement, green commit or push while blocked.

## AR-P29 — Decode complete startup ranges and recognize the proved main exit

**Decision:** the user replies “I approve” on 2026-10-06, accepting the exact
three-file repair and bounded local-owner size exception below. AR-P28 remains
independently cleared; task 2.2.10 resumes within this additional exact permission.

**Best option:** one exact exception for the three existing frozen files below.
The baseline is tree `c91d637f0ec141784fad8605cbd015169c6ff19d`. Keep their
approved source-qualified identities. No file changes occur before approval.
All paths are under `test/rd05/`.

| File / bounded owner                                                                                 | Exact permitted correction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nmi-route-links.spec.test.ts`, `instructions()` and its owned-range selection                       | Decode every documented CPU instruction inside each selected debug range, rather than treating the entire range as one instruction. Preserve the existing source-span filter, PRG bounds, address-space and owner/context association, deduplication and address order. Each instruction must fit its range and PRG. Never discard startup ranges or loosen `operand()` to accept a block as an instruction. If an existing function filter selects only range starts, let it select instructions contained in that same function's ranges; it must not admit another owner. |
| `nmi-route-raw-installer-output.spec.test.ts`, `entries()` / `instructions()` and their local wiring | Only for the source `main` entry, recognize its final absolute JMP to the exact assembled `startup.restore` entry. Independently corroborate that target with the native labels, actual generated/platform-owned startup range and its complete decoded restore path ending in PLP/RTS. Keep the JMP in main's decoded code. Do not attribute restore bytes to main. Preserve same-owner placement-adapter following and every raw/helper terminal requirement.                                                                                                              |
| `nmi-route-raw-owner-continuation.spec.test.ts`, `publicEntries()` and its local wiring              | Apply the same exact main-only platform-exit recognition. Require actual target identity, generated/platform ownership, complete range/PRG bounds and the PLP/RTS endpoint. Preserve every source-call association, variant owner, same-owner adapter, raw/helper terminal and interprocedural ownership assertion.                                                                                                                                                                                                                                                          |

Reject all other outside-owner jumps or fallthroughs. Decoding may add only the
documented opcode widths needed by these actual startup/restore witnesses; an
unknown or truncated instruction remains an error. The independently corroborated
restore bytes are separate platform evidence, not extra source-owned effects.

All fixtures, four profiles, check/build success requirements, exact values,
MMIO order/count, immutable capture/publication/removal, no `$0318` writes,
function-owned no-CIA2-ICR reads, closed homes, stack/resource and output-cost
assertions remain unchanged. No product behavior, compiler/API, public shape,
frozen authority, source restriction, dependency or general decoder/harness is
authorized. Retention remains distinct from invocation/reentrancy proof.

**Bounded size exception:** the existing owners are 292/313/333 lines after
AR-P28's required formatting. Keep this repair local and each file at most 400
lines, rather than adding a shared test-support abstraction or splitting fixtures
solely to meet the usual 200–300-line test target. This exact exception waives no
assertion, documentation, independence, verification or review requirement.

Independent SFA review SF-005/SF-006 corroborates the five exact source fixtures
across all four profiles: twenty actual native artifacts pass all five validators
and unchanged cross-sidecar checks. The startup block is 345 bytes, not one
instruction. Returning main's generated exit follows the existing frozen
return-to-BASIC contract, not an SFA ownership escape. Exact artifacts, hashes and
endpoints are recorded in [the phase review](09-phase-review.md#ar-p28-clearance-and-the-next-exact-oracle-gate--2026-10-05).
The comparable public set is now 420 PASS / 28 FAIL across 24 files/448 cases;
all 28 failures are in these three owners. This does not predict GREEN after
repair or authorize any later newly exposed expectation change.

After approval, freeze the bounded diff and new hashes, run the three affected
files plus the complete 24-file public set, and obtain independent exact-exception
review. A real implementation failure is repaired in production, not covered by
this exception. Whole-phase, runtime/VICE, hardware and expert-cost gates remain.
No successor, green commit or push while this coupled endpoint is RED.

## AR-P28 — Correct test identity and proof mechanics without changing the contract

**Decision:** the user replies “I approve - proceed” on 2026-10-05. This authorizes
only the enumerated twelve-file repair. Implementation and exact exception review
must preserve the fixtures and all contract requirements below.

**Best option:** one exact exception for the following twelve frozen test files.
This is not permission to make a failing behavior or cost expectation easier.
The baseline is tree `bc8212a13cebc1006c8af8798511ef08c5b4959c`; every listed
file remains byte-identical to that baseline until approval. All paths below
are under `test/rd05/`.

### Source-qualified identity — nineteen replacements, ten files

Replace only the listed bare `Game.*` lookup/expected-owner strings with their
existing `src/game.blend::Game.*` identities. The negative unused-function check
also needs the real identity so it remains a meaningful absence assertion.
Keep all surrounding source fixtures and assertions unchanged.

| File                                                | Exact occurrences at the untouched baseline                         |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `nmi-route-raw-owner-continuation.spec.test.ts`     | Line 53: `Game.${name}`                                             |
| `nmi-route-raw-installer-output.spec.test.ts`       | Line 55: `Game.${name}`                                             |
| `nmi-route-raw-helper-context.spec.test.ts`         | Line 66: `Game.${name}`                                             |
| `nmi-route-raw-dependencies-output.spec.test.ts`    | Line 79: `Game.${name}`                                             |
| `nmi-route-exclusive-reference-output.spec.test.ts` | Lines 71, 89, 96: `Game.Q`                                          |
| `nmi-route-placement.spec.test.ts`                  | Lines 44, 53: `Game.handler`                                        |
| `nmi-route-output.spec.test.ts`                     | Lines 128, 150, 171: `Game.handler`; line 172: `Game.writeConstant` |
| `nmi-route-reference-entry-output.spec.test.ts`     | Lines 104, 183, 190: `Game.Q`                                       |
| `nmi-route-links.spec.test.ts`                      | Line 66: `Game.${name}`; line 236: `Game.unused`                    |
| `nmi-route-execution-selection.spec.test.ts`        | Line 100: `Game.${name}`                                            |

### Actual ABI and instruction-range proofs — two files

| File / bounded owner                                                                         | Exact permitted correction and requirements retained                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nmi-route-retained-call-abi.spec.test.ts`, aggregate destination proof around lines 203–233 | Retain existing direct-result and copied-pointer forms. Additionally accept the caller populating the same closed two-byte pointer home used by the callee's sole indirect element store. Prove both exact destination bytes before the selected JSR, no intervening pointer overwrite through that store, correct element offset and caller consumption of the destination. Keep values 7/9, selected parameter-home and callee checks, caller-owned destination, source fixture and all four profiles. Do not accept an arbitrary indirect store. |
| `nmi-route-retained-nonreturning.spec.test.ts`, `sourceRanges`                               | Require the correct `src/game.blend` source index and positive-width operation ranges contained within the requested expression, allowing its trailing semicolon. A whole-function declaration which merely overlaps the expression is not an emitted operation. Keep zero dead-effect assertions; corroborate them using actual H instruction ranges, including absence of dead vector/publication/removal and `$c014` writes. Keep returning and mixed-target controls.                                                                           |
| Same file, raw-address assertion around lines 109–120                                        | Decode the ordered, deduplicated union of the same operation's ranges, preserving source/context ownership. Prove the same actual raw entry's low and high bytes reach `$c010` and `$c011` in order. Keep separate raw/firmware entry identities and uniqueness. Do not concatenate unrelated contexts or accept only the presence of two immediates.                                                                                                                                                                                               |
| Same file, `noSuccessor`                                                                     | Keep the call-at-end requirement for every executing raw/body variant. Separately prove the masked selected reference-only entry is exactly the permitted jump-only shell with the correct captured predecessor and no body effects. Select it from the independently proved entry/address distinction; never skip a variant only because its expected call is absent. Keep H's and raw Q's nonreturning-call checks.                                                                                                                               |

The independent SFA auditor reports SF-001–SF-004 after inspecting exact native
artifacts for all four profiles. No ABI/storage or dead-source-effect defect was
found at these bounded endpoints. The aggregate caller already populates its
closed ZP destination pair; forcing a callee copy would add needless storage and
instructions. Debug ranges are per instruction, not per source expression.
Declaration provenance is broader than an operation. The masked CINV shell is
an address/capture obligation, not an executed Q body.

The all-finite artifact still contains one unreachable generic dispatch JMP:
three emitted bytes and zero executed cycles on its proved nonreturning paths.
That is real output, not a dead source effect. Task 2.3.3 must judge its expert
cost; this exception provides no output-parity waiver or optimization deferral.

Evidence and exact artifact identities are recorded in
[the phase review](09-phase-review.md#exact-frozen-oracle-approval-gate--2026-10-05).
After approval, capture the exact inverse diff against the baseline, freeze new
hashes, rerun the twelve affected files and then the complete 24-file public
candidate set. Any newly exposed implementation defect is fixed in production;
it does not grant another oracle exception. Required independent exception
review and the full phase checkpoint remain binding.

No fixtures, product behavior, diagnostics, public artifact shape, frozen
specification/expert authority, runtime or compiler code are authorized to change
by this request. General public GREEN, runtime, physical hardware and complete
expert parity remain unqualified. No commit or push occurs while the coupled
checkpoint is RED.

## AR-P27 — Debug follows selected and retained code, not old source reachability

The untouched execution-selection oracle already covers the masked helper,
terminal call and returning-alternative boundaries. Public-producer native
probes reproduce `Reachable function has no final machine entry` after genuine
assembly. The old call-graph reachability catalogue retains declarations whose
bodies have no reached or retained materialization; it is not final code demand.

Consume the existing actual reached blocks, separate retained ABI descriptors
and captured selected entries. These facts select source owners only; required
owners still fail when no machine entry exists. Do not manufacture contexts or
treat retained code as invocation proof. Source-call contexts must belong to the
particular final variant which emits their source operation, not a reference-only
shell or a dead suffix. Keep raw code and real returning alternatives.

The broader run exposes an applicability error in the first consumer correction:
legacy IRQ-only context catalogues contain no reached-point proof. Match lowering's
NMI-route condition; leave ordinary and IRQ-only owner selection unchanged.
Retained mainline variants also use `.main.root` as well as `.main.depth`.
Recognise both existing canonical mainline forms in debug function/block ownership
and the matching memory owner. Actual individually valid sidecars otherwise fail
their existing cross-sidecar consistency gate. Do not weaken that gate.

Before adding this bounded consumer correction, move the unchanged machine-range
mapper into `services/debug-machine-ranges.ts`. This is a mechanical size-boundary
extraction, not a new layer, pass, schema or pipeline stage. The existing public
oracles stay frozen; their separate source-qualified lookup mistakes require an
exact approval before edits. Whole public qualification remains pending.

## AR-P26 — Canonical symbol-label ordering

The public raw-body fixture in the frozen execution-selection oracle reaches
native ACME successfully but fails debug encoding. Direct inspection of the
actual derived records locates the unsorted label list: internal `fn` IDs precede
`interrupt` IDs, but their source-related emitted label spellings sort in the
opposite order. The validator already requires canonical UTF-8 label order.
Sort that list using `compareText`; do not reorder the indexed entry variants,
weaken the validator or change bytes. The diagnostic probe's borrowed header is
shape-location support only; qualification must use the real public producer.

## AR-P25 — Reference-only tails retain their source/debug owner

The 448-case public candidate run has 272 passes and 176 failures. Some failures
are lookup-only oracle mistakes; those must be separately approved before any
frozen edit. Actual artifact failures are compiler defects, not test exceptions.
The genuine public producer/ACME diagnostic reproduces
`Final machine block has no semantic CFG owner` on a masked installed IRQ shell.
Its function/export identity and three-byte terminal are correct, but the block
uses only the generated function ID rather than the existing semantic-entry
prefix consumed by debug correlation. Retain the source-entry prefix on that
one tail block. No instruction, arrival, source-body execution or schema changes.
Further mismatches require their own decisive source/consumer evidence; do not
hide missing machine bodies or invent reached contexts to make validation pass.

## AR-P24 — Zero-byte debug markers need no emitted instruction

Native source seam `nmi-layout-native-third.log` assembles the legal zero-length
local but fails in `deriveDebugRecords` with
“Storage request lifetime has no final machine range”. Frozen Chapter 08 AR-2
requires zero data bytes. The existing debug owner already represents such a
home as an optimized-away zero-byte position marker; the unconditional live-range
requirement contradicts that existing representation.

The smallest correction is to retain the nonempty-range requirement for every
positive-width home and allow the existing zero-byte marker its empty range.
The existing location validator must agree: only a zero-width optimized-away
symbol may keep its valid execution context without a live instruction range.
No positive-width or context/index check is relaxed.

Both independent ordinary-program probes prepass all eight cases, including a
declaration-only routine. Their frozen files remain unchanged as safety controls;
neither is falsely reported as RED. The public NMI-only zero-byte oracle must
freeze before any correction, first recording the existing admission guard and
then the actual debug boundary during candidate admission qualification. The
native empty-NMI failure remains direct supporting evidence. No existing oracle,
schema, storage identity, emitted code, language rule or runtime changes. This is
a deterministic compiler ruling under PRIME workflow rule 4, not fabricated
user approval or a new product choice.

## AR-P23 — Zero-byte array markers are not private storage

Independent storage review and a genuine-source final-inventory RED expose an
overbroad rejection: `let empty: byte[0] = [];` retains a local position marker
with `bytes === 0`, emits no private-home work, but the new NMI check rejects it.
Frozen Chapter 08 AR-2 explicitly makes this source valid and gives it zero data
bytes. Positive-width addresses/temporaries remain subject to the complete
selected private-storage proof.

**Best option:** skip only exact zero-byte requests in the existing pure check;
retain their identities and markers through normal closure. This is a
deterministic compiler correction under PRIME workflow rule 4, not an
undetermined product decision or a fabricated new user approval. No source ban,
test exception, new storage representation, pass or runtime is introduced.
The independent auditor supplies the counterexample; the parent reproduces it
through actual frontend/ownership/context/machine closure before correction.
One bounded fix-only storage review follows the rerun. Planned internal
private-storage hardening retains this zero-byte boundary regression.

Capture: `/tmp/blend65-nmi-ar21.0c36Fe/ar20-zero-length-private-red.log`.
First profile fails the exact expected non-rejection assertion; the existing
24-case PASS capture remains unchanged. Public admission is still guarded.

## AR-P22 — Ordinary routine fixture and independent mutable values

After only AR-P21's four authorized arguments change, the 195-line file freezes
at `86ed5f63e5aaaa5d196047ad13664280452641dc83233edd31438a8f0b3ca333`.
Fresh build and formatting pass. The corrected RED still has 12 genuine constant-
storage failures; four mutable controls now reach their terminal assertion and
fail because the valid main exit is `JMP startup.restore`, not `RTS`.
All three constant cases contain the same latent main/ordinary-ABI mismatch.
Frozen Chapter 10 §5.3 explicitly requires startup entry without `JSR main` /
ordinary `RTS`; Appendix C64 §5.1 requires restoration before the epilogue's
`RTS` to BASIC. No compiler return-policy correction is warranted.

One bounded independent correctness audit clears AR-P21's exact edit and reports
RV-009/RV-010 (reviewer-local RV-001/RV-002). The second finding's counterexample
redirects assignments away from `value`'s addressable home while leaving every
currently checked external access and storage interval present. It is an oracle
coverage defect, not evidence of a current compiler miscompile.

The proposed modification set is one existing oracle. Rename its four measured
functions `sample`, append `function main(): void { sample(); }` to each source,
and change the four owner arguments to `src/game.blend::Game.sample`. Keep every
measured statement, constant value, native byte/cost, storage and ordering check.
Use the existing VICE monitor for the mutable control: supply distinct bytes
`$13` and `$e3` at `$c010/$c011` before entering the measured body, then require
`$c020/$c021` to contain exactly those bytes after the body. This checks values
without prescribing home addresses or store/reload instructions and preserves
future legal optimization. Reuse current runtime/project fixtures unchanged;
no interpreter, instruction-dataflow validator or new runtime harness is proposed.
Keep all four selected profiles and sequential emulator execution.
Only the imports, literal profile typing, local fixture wiring and test timeout
needed for those checks are included. Existing project/runtime helpers remain
unchanged; the corrected file must stay below 300 lines.

Supporting actual native probes verify the main cleanup transfer, a 41-byte
ordinary immediate reference, and 12 four-profile ordinary reference/control
cases. These are not scalar feature GREEN, VICE execution, hardware proof or
whole-program parity. The ordinary test wrapper adds a normal call in test input;
its caller/startup costs remain separate from measured routine costs. The three
ordinary expectations stay 41 bytes/54 cycles, 1 byte/6 cycles and 26 bytes/36
cycles. No fixture/assertion or scalar production edit occurs before approval.
The user approves this exact repair on 2026-10-05. Independent specification
authoring and a fresh RED precede scalar lowering; RV-009/RV-010 fix verification
is bounded to this exact exception, not another full earlier-phase review.

## AR-P21 — Exact public code-owner lookup correction

The independent author's first RED run fails all 16 cases. Twelve constant cases
fail the zero-storage assertion on all four profiles: used constants have eight
intervals, unused declarations ten, and lexical shadowing three. These are genuine
implementation failures. Four mutable controls pass build and nonempty-storage
checks but stop at the mistaken owner lookup; their behavior endpoint is not
qualified. The log is `ar20-scalar-spec-red.log`; the 195-line oracle remains
unchanged at `1bd90ebe497870f95e349e7b936fe2b6c9fd74b14ea434515d19662da44a7cf8`.

Main verifies the common fixture source ID `src/game.blend`, the retained public
function identity in `services/evidence-records.ts:37–38`, and code ownership in
`services/memory-evidence-records.ts:206–223`. The proposed exception changes only
four lookup arguments, not the public API or any expected compiler behavior.
No scalar production correction precedes a qualified, mechanics-correct RED.

The user approves this exact exception on 2026-10-05. The previous temporary
evidence directory is absent on resume; its recorded results remain historical,
not fresh accessible captures. Fresh logs use `/tmp/blend65-nmi-ar21.0c36Fe`.
No other `/tmp` entry is removed, and no lost probe result is fabricated.

Process disclosure: after freezing, the author inspects agent statuses and the
status response unexpectedly includes a completed challenger's implementation
discussion. No forbidden file is opened, and all authored expectations predate
that exposure. The original hash is preserved; no new blind-baseline qualification
is claimed. The first failed run is retained, not relabeled as a passing control.

The same instruction explicitly covers the effort-confirmation handoffs for the
named remaining RD-05 batch. Recommendations still precede distinct tasks;
another effort pause is not required unless the scope or risk materially changes.
Verified local commits remain automatic. This continuation is not push authority.

## AR-P19 — Small IRQ applicability fix and exact fixture corrections

Independent bounded review of `da051a2b` → `9a6e3f38` finds three MAJOR
issues, recorded as RV-006–RV-008 in the phase evidence. The NMI direct,
transitive, finite-target and inactive-root native witnesses pass. However,
`storage/interference.ts:120` unconditionally consumes context analysis whose
IRQ-only producer returns an empty reached map (`interrupt-context-proof.ts:66–72`).
The new transitive walk therefore drops G from H → G. Main's public IRQ-only
build confirms `main.saved` and `G.inside` both at `$0b4f`; native execution and
hardware endpoints are not claimed. Existing inventory/lowering correctly
condition reached projection on an actual NMI route (`inventory.ts:335–336`,
`lower.ts:200–201`). Reuse that applicability condition, not map nonemptiness.

The new lifetime test's `byteHome` at line 172 and the earlier call-ABI test's
`memoryHomes` at lines 80–95 assume `symbol.name` is a lexical variable name.
The public contract promises text, not that spelling. Successful public builds
publish declaration identities through names and source origins. Match the
expected declaration by its public source span, scope and kind; fail clearly
on absent or ambiguous identity. Do not change the public debug API to fit
an accidental fixture assumption.

The lifetime test's line 244 also requires exactly one code entry. Its finite
target fixture legitimately retains a canonical address entry and an observed
depth entry using the same canonical private home. Replace only this code-entry
assumption and related entry-index call lookup with checks of actual selected
targets and their required shared homes. Every selected finite alternative must
remain covered. Preserve expected widths, caller/transitive live separation,
canonical private-home reuse, native call/argument accesses and source order.
Allowing arbitrary emitted targets is not an independent oracle.

**Best option — exact proposed modification set:**

| Path                                                       | Permitted correction, only after approval                                                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/compiler/src/storage/interference.ts`            | Consume executed-block proof only at its existing NMI applicability boundary; otherwise traverse the full callee body with the same selected descriptors.                                                       |
| New `test/rd05/irq-call-lifetimes.spec.test.ts`            | One independently authored IRQ-only main → H → G caller-live regression across the four existing profiles; use existing public project/artifact fixtures, below 300 lines, RED before the production fix.       |
| `test/rd05/nmi-route-retained-call-lifetimes.spec.test.ts` | Correct declaration lookup and code-entry/home mechanics described above, including necessary helper arguments and call-target lookups. Keep all source fixtures and behavior/storage/native-access assertions. |
| `test/rd05/nmi-route-retained-call-abi.spec.test.ts`       | Correct only declaration lookup and necessary helper arguments. Keep all marshalling, hidden-return-pointer, caller-owned destination and native instruction assertions.                                        |
| Active plan and feature roadmap                            | Record exact ruling, old/new oracle hashes, RED/GREEN, bounded review and task disposition.                                                                                                                     |

No other frozen test, specification, expert authority, API, code-selection rule,
runtime, generalized helper or analysis model is included. The current hashes
remain `4f1759ab` and `b8fd9750` until an exact exception is approved. The
independent author is not a reviewer of its own regression. Required base/SFA,
semantics, platform, emitted-output and host-performance lenses remain; one
fix-only rereview cycle does not reduce reviewer count or omit pending lenses.

## AR-P20 — Restore the existing zero-storage scalar-constant contract

The genuine-source final-inventory probe exposes a one-byte NMI-local home for
`const V: byte = 7`. Its selected wrapper emits `LDA #7 / STA private-V`, then
another `LDA #7 / STA $0411`. Name uses already become immediates in
`semantic/lower-expressions.ts:172–180`; `semantic/cfg.ts:178–204` nevertheless
initializes every typed variable statement with a runtime store. Frozen
Chapter 03 §4.2 requires unplaced scalar/enum constants to allocate no storage,
and §3 requires compile-time-only initializers. The existing frozen NMI
constant/helper source and native no-extra-home expectations remain unchanged.

This is not an undetermined language rule or new product capability. The user's
PRIME workflow rule 4 directs compiler/plan implementation decisions to proceed
without a prompt. It takes precedence over CodeOps' default technical-decision
pause. No user choice or direct approval of this correction is fabricated;
source-contract authority is the already approved frozen specification.

One fresh native design challenger independently recommends correction at CFG
declaration emission using the existing binding table. Its facts are relayed,
not independently inspected; it has no permitted filesystem reader and makes
no qualification verdict. A later store-elimination/inventory reconciliation
would touch more stages; a second declaration classification would duplicate
existing truth. Existing binding identity preserves shadowing. Required map
plumbing must fail closed on missing facts; no silent empty-map fallback.

| Exact owner                                         | Bounded change                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New `test/rd05/local-scalar-constants.spec.test.ts` | Independent ordinary-program four-profile no-home/native-byte RED, all scalar/enum categories and a mutable-initialization control; reuse existing public fixtures, below 300 lines. |
| `packages/compiler/src/semantic/cfg.ts`             | Use the existing read-only semantic binding map to omit only unplaced, non-loadable scalar/enum constant declaration initialization, before lowering its initializer.                |
| `packages/compiler/src/semantic/lower.ts`           | Supply the same authoritative map to both existing builder constructions; no copy, evaluator or new stage.                                                                           |
| `packages/compiler/src/semantic/cfg.impl.test.ts`   | Give the sole direct synthetic builder construction an explicit empty map; no expectation changes.                                                                                   |
| Active plan/feature roadmap/evidence                | Two prerequisites before resuming final-inventory verification; record authority, RED/GREEN, exact scope and evidence limits.                                                        |

Materialized/placed scalars, aggregates, loadable constants and mutable bindings
retain their existing paths. No source restriction, admission exemption, public
API, certificate field, runtime or general optimization pass is introduced.
No existing specification test changes. Independent review and full public NMI
qualification remain mandatory. The source correction is not implemented until
the new independent oracle exists and its before-fix RED is captured.

Confidence: High in the bounded direction, conditional on preserving exact
selected-target/home expectations. A governing lexical-name/single-entry
contract or a mixed-route counterexample would change it. Hardening: public
artifact counterexamples plus a fresh native independent design challenger;
the challenger converges on the narrow correction and warns against circular
target checks and weakening canonical reuse. It has no permitted filesystem
reader, so its code facts are relayed, not independently inspected; main reads
the governing routing/quality policy separately. The strongest objection is
changing production and test mechanics together; independent IRQ RED and
unchanged behavior/ABI/storage expectations address that risk. Proven code
sharing can be a separate optimization, not a reason to collapse link variants
here. No broader support surface is justified. Until approval the safe state
is blocked. No further production/oracle edit, RED commit, push or admission
promotion follows reviewed tree `9a6e3f38`.

The user replies “I approve” on 2026-10-04 to the sole exact AR-P19
recommendation. Its four named production/test paths and plan/roadmap evidence
are approved, including only the described fixture mechanics in the two frozen
oracles. All preserved source/behavior/native/storage assertions stay binding.
Baseline `6104639332aeadbe86cdfecc25da0c00e85bd7ba` retains the reviewed
candidate and validated stop record. One separately named independent IRQ
spec/RED task precedes the same-owner applicability fix, bringing the total
to 61 by test granularity only; current verified count remains 44. The named
effort waiver continues, with no push authority or public-admission promotion.

## AR-P18 — Selected callee reuse must preserve caller lifetimes

Fresh SFA review of correction tree
`bb11b0e6dc09b6c41e3e10ee73e8a9e91a9e0fe3` finds a necessary downstream
allocation defect. `machine/interrupt-specialize.ts:93` correctly selects an
observed canonical callee for a compatible retained caller, but
`storage/interference.ts:150–153` adds live-through-call conflicts only when
their activation roots match. Different roots do not prove different lifetimes.

Main confirms the final artifact counterexample: raw Q saves `peek($c020)`,
calls observed balanced H(9), then writes the saved byte to `$c022`. H also
keeps `inside = peek($c024)` live alongside its parameter. The final PAL/6581
certificate overlays Q.saved and H.inside at `$0bbd`, with H.x at `$0bbe`.
Native instructions write Q.saved, call H, overwrite that address in H, then
read the overwritten byte in Q. This fails one ordinary call without requiring
external preemption. `ar17-live-local-witness.log` records the failure after
native ACME; it stops at the first profile, not four-profile failure or runtime
proof. The narrower parameter-only control passes all four profiles because
consumed caller argument staging can legitimately be reused.

**Best option:** extend the bounded correction to the existing call-interference
owner, following the same selected callee descriptor for live-through-call
conflicts, including transitive calls and finite indirect alternatives. Share
the existing pure descriptor selector with its storage consumer rather than
copying selection rules or conservatively separating every same-domain variant.
Each transitive call must resolve from its selected caller context using the
existing call-site facts, not from the original request root. Reclose storage.
No new evaluator, graph registry, pass, runtime, API, source restriction or
blanket frame separation is proposed.

The exact proposed implementation set is
`packages/compiler/src/storage/interference.ts`, plus a mechanical extraction
of the existing selector between
`packages/compiler/src/machine/interrupt-specialize.ts` and
`packages/compiler/src/semantic/interrupt-context-facts.ts` for direct reuse.
One new independent
`test/rd05/nmi-route-retained-call-lifetimes.spec.test.ts` freezes focused
caller-live/direct/transitive/finite-target behavior and allocation expectations
before correction; it remains below 300 lines. No old oracle edit is requested.
The existing return-path and canonical-thunk controls must remain intact.
If the direct consumer instead needs a new fact model or support surface, stop
and reassess rather than implementing that machinery under this proposal.

The viable conservative alternative adds conflicts against all reachable
same-domain callee instances across roots. It prevents corruption but may
increase static bytes for variants the actual call never enters. It is not the
recommended final allocation model. The narrower canonical-main exception
duplicates selection once transitive calls are made sound, so it is not smaller.

Confidence: High in the reproduced defect and direction; implementation and
final costs remain unverified. Hardening: independent SFA finding, main-owned
positive/negative native witnesses and one fresh native design challenger.
Challenger: converged. The strongest risk is selecting from guessed context or
duplicating rules; reuse the existing selector and propagate the selected
context. Substantial new analysis being necessary would change the recommendation.
The selected byte-home model needs a distinct live home in the witness; no
runtime instruction or dynamic storage mechanism is inherently required. Exact
final RAM/ZP/code/cycle changes must be measured after correction, not assumed.

The user replies “I approve” on 2026-10-04 to this sole pending recommendation.
This authorizes exactly the owner set above, not a new fact model or oracle edit.
Baseline tree `da051a2bc2fce5c7b9f4aeef22316a41034bfb3f` preserves the reviewed
correction and stop record. Three small prerequisites precede the existing
wrapper/retention verification unit: independent regressions/RED, mechanical
selector sharing, then selected-call interference. Progress becomes 43/60 by
subdivision only; 13 later tasks remain not started. The existing effort waiver
applies. Public admission stays guarded; no RED commit or push is made.
RD-05 and DEF-7 remain open.

## AR-P17 — Retained calls must select one coherent ABI

Independent implementation review compares baseline tree
`85c7b561ecb7b1bce9471d780343fd780088ffff` with candidate
`d9d7a76a6ac03f63631bc325fecfa5bc9f1e857f`. SFA and semantics reviewers
identify three distinct MAJOR defects; the duplicated argument-storage finding
is counted once. Main confirms each using actual source, inventory, allocation,
lowering and storage consumers, without fabricated execution/capture facts or
removing the public guard. Each probe stops on its first PAL/6581 failure;
these are not four-profile failure claims.

| Finding                  | Grounded failure                                                                                                                                                                                                                                                          | Smallest proposed correction                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RV-002 (SF-003 / SM-001) | `machine/interrupt-specialize.ts:195` rewrites storage with the caller context while its JSR chooses a reusable observed callee context. A raw Q calling balanced H(byte) fails final storage binding; a separately supplied wrong home could silently lose the argument. | Use the selected callee ABI for its parameter/hidden-return homes and corresponding memory effects. Keep caller-owned staging in the caller context. No additional clone or source restriction.                                                         |
| RV-003 (SF-004)          | `semantic/interrupt-context-walk.ts:121` and `machine/lower.ts:258` retain the complete suffix after a call proved never to return. An unreachable install/restore then fails with “Interrupt restore has no active static link”.                                         | Reuse existing return summaries to omit only proved nonexecuting suffixes/successors consistently in retained demands and lowering. Returning, mixed and unknown target alternatives remain conservative; independent raw dependencies remain retained. |
| RV-004 (SM-002)          | `machine/lower-indirect.ts:71` tests actual execution variants only. A retained function-pointer H/K call can therefore JMP through a canonical source address even though that call requires a different retained installer-word variant.                                | Check the existing emission ABI catalogue/selected target before using the source-address thunk. Use the existing finite-target dispatch when the chosen variant differs. No new runtime selector.                                                      |

**Best option:** approve those three bounded necessary corrections and fresh
independent behavior/byte regressions, with RED recorded before implementation.
The exact owner set is the existing `machine/interrupt-specialize.ts`,
`machine/lower-indirect.ts`, `machine/lower.ts`, `storage/inventory.ts` and
`semantic/interrupt-context-walk.ts` / `interrupt-context-facts.ts`, using
existing ownership return summaries. Touch only consumers needed to make code,
data and executable-path selection agree. Keep the AR-P16 actual-proof versus
noncertifying-retention distinction and every frozen oracle/authority unchanged.
Re-review the correction before clearing this unit; later route/storage/output/
runtime tasks remain mandatory. No green commit or push at this RED checkpoint.

Confidence: High in the reproduced defects; Medium in the proposed corrections
until independent regressions and fix review pass. Hardening: two independent
domain reviews, duplicate merging, real producer/consumer witnesses and explicit
counter-checks. A superficially easy fallback (always add a new home/clone,
always disable indirect thunks, or invent depth zero for a dead operation) would
hide the mismatch or harm output. The correction must instead reuse the selected
ABI and return facts. This is necessary completion of the approved contract,
not optional functionality or an approved complexity escalation.

Review/probe details and the separate report-only test-size finding are in
[execution evidence](09-phase-review.md#ar-p16-implementation-review--ar-p17-stop-2026-10-04-1336).
The user explicitly replies “I approve” on 2026-10-04 to the sole bounded
AR-P17 recommendation. This authorizes the three corrections and fresh independent
regressions, not a change to any frozen oracle or authority. The former wrapper
unit is divided into four small sequential units: new independent cases/RED,
coherent direct/indirect call consumers, retained no-return projection, then
wrapper/retention verification and fix-only review. This is task granularity,
not new product scope or support machinery. The remaining named RD-05 effort
waiver applies to this corrective subdivision. Progress is 40/57 before execution;
no implementation is promoted by approval.

## AR-P16 — Retained raw code containing a typed installer

The corrected transitive raw dependency walk exposes one additional binding
boundary. Main installs empty NMI B, masks IRQ, installs Q and independently
materializes `word(&Q)`, then restores IRQ and B. Q is never observably entered;
its retained raw body calls ordinary H, whose body temporarily installs empty
NMI C. Frozen Chapter 06 §8 requires retaining Q/H source code without certifying
the external caller. The actual worklist correctly creates no H/C invocation or
capture. Its real mainline B capture cannot stand in for H's unobserved installer.

The real producer/consumer witness fails at the machine capture-identity check
(`raw-unobserved-install-probe.log`). This is behind the existing public E10245
guard; no unsafe program has been admitted. Keeping H's _actually observed_
context fixes the separately reviewed RV-002 case, but cannot solve this one.

The existing generated-route obligations still require coherent capture,
publication/removal, private-storage closure and live-link safety. A blanket new
source prohibition, imaginary arrival or arbitrary raw0/stock capture is not a
valid resolution. Assess the smallest physical entry/link materialization
contract separately from actual capture proof, in the existing facts, inventory
and lowering owners. No second registry, general evaluator or runtime manager.
Do not implement or infer acceptance until the contract/authority boundary is
resolved. Independent challenger assessment supports the bounded conditional
contract below; the entry unit pauses
under the repository's runtime-ambiguity rule. No new support surface or source
restriction is authorized by earlier generic continuation.

**Best option:** authorize qualification of a conditional materialization
contract through the current facts, inventory and lowering owners. A retained
installer needs its exact source/site, selected ABI, physical predecessor word
and local install/restore ownership effect. Its incoming predecessor remains
explicitly unknown, not a stock/null capture. Actual contexts, reached points
and captures remain execution evidence only. Prove the common word for
install/restore/chain, complete selected NMI ABI and placement, coherent vector
publication, immutable live-link behavior and complete pre-emission storage
closure. State every relied-on incoming condition and the uncertified external
boundary; do not weaken generated-route safety or introduce a new user restriction.
Freeze independent behavior/byte cases after that proof and before correction.
Implement only if this bounded proof succeeds; otherwise return the exact missing
obligation, retaining the existing guard. No parallel registry or general evaluator.

Confidence: Medium — the producer/consumer coupling is demonstrated; the
conditional live-link/publication proof remains to be established. Hardening:
independent semantics/SFA review and a separate design challenger agree that
materialization is not an arrival or capture. The strongest counter-argument is
that an unknown raw caller may violate the required incoming vector/link state.
Simply removing the binding checks is therefore not a fix. This is a bounded
contract/proof approval, not an external safety promise or a frozen-authority waiver.

### Approved qualification result — 2026-10-04 12:40

The user approved the proof-first direction. Independent SFA and semantics
reviewers qualify a **noncertifying retention contract**, not an immutable-link
certificate for an external caller. Frozen §6.8 permits retaining Q, ordinary H
and H's selected C entry with complete ABI/body/storage demands. H's exact
installer/restore site owns a distinct two-byte physical word L. Capture, restore
and C's chain use that same identity. L enters existing inventory and closure
before emission, with NMOS indirect-JMP page safety. C needs its full NMINV
wrapper, not a reference-only CINV shell. Actual observed H contexts still win.

The incoming predecessor remains symbolic/unknown. It is never `null` (stock),
B's capture, an invented invocation, or an entry in actual contexts, reached
points or `LinkCapture`. The exact fixture's valid hardware Q entry sets I;
Q/H contain no CLI and B/C do not call H. Those facts support a local balanced
install/restore theorem under the selected vector-ownership contract. They do
not prove arbitrary external ingress or a foreign predecessor's behavior.
Foreign re-entry can overwrite L with C's own address; incoming low != $47 can
break matching-low publication. These remain explicit uncertified raw-boundary
counterexamples, never a new serial-caller rule or an excuse for unsafe proved
generated execution.

Assessment lineage: expert 2.0.3/content `22cc5f00`, frozen Chapter 06 §§7.5–8,
Chapter 15 generated interrupt contracts, SFA final-storage closure and C64 entry
ABI; source keys `MOS-PGM-1976`, `MOS-HW-1976`, `MOS-6526-1981`,
`CBM-C64-KERNAL-03`. Both independent assessments report no findings against
this precisely separated contract, with status Verified partial. Final physical
binding/closure, complete bytes/layout/cost and runtime remain Unknown. Freeze
independent cases and RED before correcting the existing owners. Public
admission remains guarded until the later generated-route gates pass.

## AR-P15 — Preserve execution paths and selected entry materialization

The guarded wrapper unit exposes two independent MAJOR findings, SM-008/SM-009.
A real-source masked installation captures a canonical CINV entry but never
enters its source handler; `lower.ts` then emits no corresponding wrapper label.
Separately, the immutable nonreturning-path oracle requires successful publication
after a terminal call, but lowering still emits the unreachable later helper's
vector operations despite the absence of their proved execution bindings.
Normal source forms must remain expressible; these are compiler gaps, not reasons
to forbid masked installs or unreachable source declarations.

The existing proof worklist already knows selected entries and reached
operation/terminator points. Reusing those facts avoids a second evaluator.
However, merely inserting a never-entered handler into observable contexts would
invent arrivals and private-storage demand; merely deleting the machine fallback
would leave dead caller references. A reference-only selected entry needs an
explicit ABI/identity/placement policy and independent output expectation before
materialization. An arbitrary empty function or alias is not an established fix.

**Best option:** authorize a bounded specification-first correction in the
existing proof, inventory and lowering owners. Retain ordinary entry ABI and
canonical source identity/placement while omitting only code proved unreachable.
Record the exact reference-only construction, then freeze independent cases
before the producer and CFG-consumer fixes. Do not change any existing oracle,
qualified profile, language rule, runtime API or generalized optimization surface.
Split the necessary small units before execution; keep positive admission guarded
through storage/output/runtime qualification and create no RED commit.

Confidence: Medium — the execution-path defect and facts are established, but
the exact reference-only construction still needs its explicit bounded proof.
Hardening: independent semantics review rejected fabricated execution contexts
and unqualified placeholder labels. Strongest counter-argument: careless body
elimination could lose an observable address/placement obligation or a real
incoming edge; the independent identity, control-flow and output cases must
exclude that possibility before activation. No approval is inferred from the
cleanup request or this diagnostic probe. The current unit remains incomplete.

The user subsequently approved the bounded correction on 2026-10-04 by replying
“I do” to the sole explicit recommendation. This resolves the correction boundary,
not its evidence endpoint. Preserve the existing ordinary entry ABI and canonical
identity/placement; omit only proved-dead source body work and do not create a new
observable invocation. Retain any independently materialized raw/callable source
dependency through its existing entry path. Reference-only labels may not be
arbitrary aliases or fake runtime guards. The exact direct construction and its
behavior/byte expectations are qualified inside the approved correction before
activation. Five small units replace the former wrapper unit: independent cases,
proof payload, CFG projection, storage/lowering consumers and entry materialization.
No additional framework, public behavior or general optimizer is authorized.

Correction baseline tree: `e6a9ac81891b1a92005bf5d221c79268f976bdd2`.
This separates the approved fix from the earlier guarded Phase 2 work and supports
its independent review. The original Phase 2 baseline and all frozen oracle hashes
remain unchanged; local green checkpoint and no-push rules still apply.

## AR-P14 — Obsolete diagnostic-message expectation

The retained test at `test/rd04/diagnostics-alternate-placement.spec.test.ts:178`
requires “can overlap or consume hardware stack without a static bound — use a
bounded interrupt/callback design”. Frozen Chapter 14's E10245 registry instead
requires “has unbounded private-storage overlap, disallowed unbounded stack use,
or unproved generated reentrancy”. These assertions cannot both hold for ST-7.
AR-P11 explicitly preserved the old message, so the additional oracle edit was
requested directly rather than inferred from general continuation.

The user approved the exact correction: update only that regex to the frozen
canonical template while applying the already-approved balanced, genuinely
private-storage-bearing fixture. Keep code, severity, pointer, owning-install
span, empty related array and no-generation assertions unchanged. No frozen
language/specification change or wider oracle migration is authorized. The
canonical message is not weakened to accommodate compiler behavior.

The alternative of source-specific old/new templates violates the single registry;
broad migration is outside this slice. Confidence: High, grounded in the exact
registry and assertion. This standard one-assertion correction introduces no
complexity or new product choice beyond the explicitly granted oracle exception.

## AR-P13 — Runtime oracle endpoint clarification

The independent author stopped before writing because admission contracts also
name output facts, and ST-13's concrete witness did not specify its existing
source projection. This is a necessary clarification within the approved cases,
not permission to add evidence fields or inspect implementation for expectations.

Task 2.1.1 owns public admission, canonical failures, external uncertainty and
publication preservation. Task 2.1.2 additionally owns ST-8/ST-10/ST-13(a)/ST-15
output: ordinary helper calls and effects, exact finite costs, predecessor/link
bytes and preserved volatile writes. It uses the existing actual artifacts,
not invented link projections. Internal selected-save endpoints stay in 2.3.2.

ST-13(a)'s exact masked-main fixture retains one source PHP while its IRQ is
eligible. The cooperative IRQ entry is 7 bytes (CPU 3, firmware 3, wrapper P 1),
and its NMI install/restore transaction retains two PHP/PHA bytes until PLA/PLP.
The independent bounded peak is 10 = program 1 + system 9. Startup's separate
one-byte peak and the empty B/C entries' separate three-byte NMI peaks are not
added. This preserves the existing transaction ABI, rather than guessing a
status lifetime or a new save-elision contract.

ST-15's output endpoint counts/orders source-correlated actual store
instructions, allowing legal indirect stores in unoptimized output. The existing
native VICE owner in 2.3.3 proves actual targets/count/order: one write of 7 to
`$0400` for the constant-copy fixture, and one write of 9 to `$0401` for the
known-global-plus-one fixture; the combined straight-line fixture preserves
that order. Static indirect operands alone do not prove their effective target.
No early direct-store optimization, symbolic executor or new harness is needed.

For ST-13(b), E10245's primary span covers the changed-capture `setIRQ` call,
direct or in its helper. Related locations retain the main initial IRQ install,
the owning NMI install and the NMI-to-helper edge when present. The complete
ordered recurrence path must make the A-to-B capture witness understandable,
as frozen Chapter 14 §2 requires. Tests need not freeze internal identity strings,
separator wording or a new serialization. ST-7 retains its specified owning
`setNMI` primary location.
The changed-capture call appears twice in the ordered related path, once for
the first activation and once for its recurrence. Intermediate locations remain
allowed; this does not prescribe an exact array length or identity wording.

ST-14 public cases include a word beginning at `$0317` whose second byte touches
NMINV and a fixed-width unsigned computation that wraps into `$0318`. A literal
word store at `$ffff` also touches the processor port at `$0000`; this plan does
not invent its separate banking outcome. Task 2.3.1 covers actual second-byte
address wrap in the existing internal write-effect proof. No source restriction
or blanket computed-address ban follows from this split.

Output endpoint clarification: the stable debug entry label names the published
low-$47 entry; its range indexes cover the complete wrapper and any entry JMP.
Range function indexes and memory code owners correlate with the existing debug
function records. Actual chain-JMP operands identify the proved link homes;
the private-free fixtures permit no other unexplained function storage.

Each selected NMI variant has one existing-schema stack record with ID
`nmi-entry:<entry-variant-id>` and route prefix
`["per-entry:generated-nmi", "<entry-variant-id>"]`. Capacity is 236 and peak is
the CPU-inclusive selected entry/body/helper cost; headroom is capacity minus
peak. These are per-entry components, never aggregate external guarantees.
Keep exact main/IRQ rows separately; numeric cost is the maximum scoped finite
row peak. Task 2.2.5 includes the existing `services/evidence.ts` consumer because
it alone publishes these records. This completes the already-required reporting
endpoint, not a new reporter, public field or support surface.

ST-17's independent collision uses an empty complete handler fixed at `$2047`
and reachable three-byte constant data fixed at the same address. E10273 and no
partial publication are required; neither an entry JMP nor silent relocation can
cure two complete fixed objects claiming the same bytes. Default empty placement
separately requires a direct three-byte low-$47 wrapper; ST-16 owns successful
fixed-$2000/align-256 entry adaptation. No test accepts a menu of outcomes.

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
AR-P11 now owns the exact approved obsolete NMI acceptance corrections.

Earlier discovery and analytical sections below retain their original
pre-maintenance context. This binding record and current decision statuses
govern readiness; no historical unbounded-source fact changed.

## Discovery evidence

### Resumed planning — smallest proof and AR-P11 boundary

The independent challenger selected a bounded publication/link-lifetime proof
inside this same plan, immediately followed by the complete implementation plan.
This is an internal proof-order choice under the workflow prime directive, not
a new research phase, manager, source restriction or product decision.

Current source facts: `semantic/whole-program.ts:348` rejects every NMI install;
`machine/lower-c64-interrupt.ts:231–296` still captures/writes two bytes;
`machine/lower-platform.ts:102–113` binds NMI predecessors only by depth.
The strongest finite witness has main install chained B; B temporarily installs
chained C and restores it; C is empty. A second NMI entering C chains to B's
existing entry. That B re-entry uses the same temporary link, replaces predecessor
B with C, and both balanced restores then select C instead of B. Neither callback
pops a caller-owned prefix. The challenger independently confirmed the context
and chain wiring. This is an analytical counterexample, not a VICE result or an
admitted program. Prove equal-predecessor reuse separately; do not infer a ban
from the changed-predecessor failure. Complete lowering/layout costs remain Unknown.

Reporting is also a dependency: `services/evidence.ts:227–283,334–346` adds reserve
to stack use and emits proved safety/finite qualified headroom without external
NMI proof. The existing unproven status, machine-state effects and bounded-route
records suffice; no new schema or reporter is proposed. Correct the distinction for
no-hook cooperative programs too. Exact generated costs remain numeric and scoped;
external total, retained firmware and finite deadlines remain unproved.

| Discovery category      | Current disposition                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Feature gaps            | Chained admission needs the complete existing route proof; exclusive/CIA2 and keyboard work remain RD-05-owned.        |
| Behavioral gaps         | Exact restoration includes suspended observers, not merely balanced lexical depth.                                     |
| Scope ambiguities       | Four cooperative profiles only; no new entry condition for no-hook programs or new source/API ban.                     |
| Technical unknowns      | Settle the low-byte and immutable-link invariants before selecting implementation tasks.                               |
| Edge cases              | Equal/changed predecessors, nested arrivals, post-pop observers and unproved vector writers are distinct cases.        |
| Integration points      | Keep frontend checks independent of backend closure; build must prove all selected private storage and helper scratch. |
| Data and state          | Use existing selected-route, lifetime, SFA and evidence owners; no late function homes or hidden state.                |
| Security and compliance | Existing project/path and typed-input validation stays; no new host or network input.                                  |
| Non-functional gaps     | Independent behavior/assembly expectations and scoped finite costs; no external peak or deadline claim.                |
| UX and presentation     | Existing names and canonical errors stay; reports must not mislabel reserve or unproved totals.                        |
| Stakeholder conflicts   | Modern source and expert output remain separate obligations; no game-policy support is added.                          |
| Naming and terminology  | Reuse existing platform calls, proof owners and artifact fields; AR-P11 owns obsolete-test corrections only.           |

**AR-P11 exact proposed modification set:** `test/rd05/profile-interrupts.spec.test.ts`
changes only the balanced empty chained case to check/build success on all four
profiles; its empty exclusive case stays negative. `test/rd04/expressiveness-ledger.spec.test.ts`
and its JSON ledger keep the existing deferred row for exclusive installation,
add a separately probed retired chained row only after qualification, and preserve
all current negative mutations/IRQ/stack probes. `test/rd04/diagnostics-alternate-placement.spec.test.ts`
retains its E10245 code, shape, message and installation span, but its source becomes
balanced and retains five private byte samples across later stores, instead of an
empty handler with an unmatched main install. Every other expectation and fixture is unchanged.
AR-P14 separately approves updating its one obsolete E10245 message regex to
the current frozen Chapter 14 template; every other diagnostic assertion stays.
New specification cases must independently prove the qualified positive route and
reject unproved private storage, link lifetime (including B/C) or vector transitions.
No acceptance test or compiler file has changed. AR-P11 is approved; the bounded
proof below closes discovery for this stock-chained slice. Confidence: High
for the source facts/proof order; full admission remains Unknown. Hardening:
independent challenger against expert 2.0.3/content `22cc5f00`, the revision-pinned
NMI and SFA completion gates, and their existing primary-source keys.

Verification: formatting/whitespace, 71 local targets/eight anchors and all 12
foundation cases pass. Independent bounded planning review returns no findings.
Only the known portfolio 1/10 versus feature 4/10 drift remains; its write waits
for integration. This two-document checkpoint changes no tests or frozen authority.

### AR-P12 — Bounded publication and saved-link result

**Status: Verified partial / Inference.** This is a machine-boundary argument and
small analytical state check, not emitted assembly, ACME, VICE or silicon proof.
The current compiler still rejects NMI installs. The finite first slice retains
stock CIA2 acknowledgement; exclusive handoff and keyboard certainty remain
owned by RD-05, not deferred to another RD or marked complete.

The small state check observes six publication/removal boundaries selecting only
`$FE47` or `$2047`, with the full link initialized before the latter is visible.
The mismatched-low control exposes `$FE48`, neither complete target. The B/C check
restores C instead of B; specialization grows `C(B)`, `C(C(B))`, and so on.
Equal-predecessor writes remain unchanged. These analytical controls discriminate
the proposed invariants; they are not an implementation oracle.

The [component specification](03-nmi-route.md#publication-and-link-proof) owns
the exact publication, observer lifetime, placement, ABI and cost duties. The
[evidence specification](03-stack-evidence.md) owns honest external-stack status.
No runtime selector, link manager, private-home source ban or new report schema
is selected. Canonical W10180 stays unchanged; its finite scope is explicit in
existing evidence. CIA2 consuming reads remain firmware-owned in this first slice.

**Hardening:** The independent challenger confirmed the observer invariant,
finite mainline argument, B/C growth and bounded placement adaptation. Its
strongest counterargument is that exact context and final layout may require more
than the current implementation can prove. Execution must produce a concrete
witness and retain the guard there, never invent a source ban or support system.
Confidence: High for these analytical invariants; generated admission, full cost
and runtime behavior remain Unknown. Lineage: expert 2.0.3/content `22cc5f00`,
`sfa-and-abi.md#interrupt-route-completion-gate`,
`c64-memory-and-runtime.md#revision-pinned-nmi-contracts-and-costs`,
`6502-lowering-casebook.md#calls-returns-abi-and-helpers`; MOS-PGM-1976,
MOS-6526-1981 and CBM-C64-KERNAL-03. Pinned init/rs232nmi sources above govern ROM.

**Gate rescan:** All twelve discovery categories above are closed for this bounded
plan. AR-P12 records internal design under the higher-priority project directive;
the user's AR-P11 decision closes the last exact test-authority fork. This does
not close the separate keyboard AR-P2/AR-P3 or approve CIA2 exclusive ownership.

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

## AR-P32 — initializer execution-domain correction (runtime)

The whole-phase SFA audit finds an actual initializer/IRQ storage collision.
Initializer call staging and saved word-low bytes omit the known mainline domain;
machine-created initializer pointers and helper requests omit the same metadata.
The existing asynchronous interference rule therefore cannot separate these
requests from concurrently live IRQ storage. The retained dynamic-word witness
closes both the initializer low byte and an IRQ retained value at `$0BA4`.

**Best option:** carry the existing main execution descriptor through initializer
inventory and normalize initializer-discovered storage/helper requests exactly as
ordinary function requests are normalized. This is a necessary correction of
the frozen storage contract, decided under PRIME workflow rule 4, not a new
product or complexity choice. The modification set is `storage/inventory.ts`,
`machine/lower.ts`, two bounded independent existing-tier initializer specification
files, and this plan's evidence/progress documents. Independent RED precedes the
production correction. All existing oracles remain unchanged.

No startup masking, source restriction, storage model, runtime, dependency or
harness is introduced. Directed allocation/behavior checks, full verification,
and one fix-only independent SFA/correctness clearance are required. The phase
remains unverified and cannot be committed or pushed before GREEN.

Fix-only completion discovers the same missing-domain seam for initializer-only
ordinary callees without any NMI hook (SF-002). Preserve the union of existing
source-domain facts and the already computed initializer-inclusive execution
contexts when building every callee request. A focused blind regression must
retain the actual staged global load across a nested call. This is completion
of AR-P32, not new analysis, a source restriction or a new allocation model.

The same final ABI check exposes SF-003: a nested initializer call's returned
register value is lost while an earlier argument is loaded. The existing machine
lifetime owner must consult the already retained initializer lifetimes, not just
ordinary function lifetimes. Four blind actual-value VICE cases provide RED
(17 instead of 7), then unchanged GREEN. Add only that existing-owner lookup and
the focused native specification file; discovered storage still closes through
main-domain SFA. No new frame, runtime, masking or source restriction. The final
retention endpoint has its own measured cost, not the earlier domain-only cost.

## AR-P33 — selected-profile route identity (runtime)

The complete checkpoint retry passes every package suite but fails the retained
platform-ownership oracle: `interrupt-routes.ts` repeats a C64 vector address in
shared semantic code. The route is already identified by the selected sink's
qualified capability, variant and domain. Remove only the redundant address
literal; the selected-profile owner remains the authority for vector bytes.
This necessary boundary correction is decided under PRIME workflow rule 4.
The existing portability oracle supplies RED and is not changed. No new API,
profile fact, route or source acceptance rule is added. Directed route and
portability tests precede the required complete GREEN checkpoint.

## AR-P34 — direct owned-place write proof (runtime)

The independent whole-phase semantics review finds MAJOR SM-001: both local
and global `poke(word(&x), 1)` are rejected as raw vector writes during balanced
generated NMI ownership. Their direct owned-place origin is already present in
semantic operations, and the selected storage windows exclude the NMI vector.
The scoped publication contract already requires typed-place disjointness.

**Best option:** extend the existing focused address-fact owner to retain direct
owned-place addresses through bit-preserving word conversions, ordinary copies
and agreeing joins. Use existing selected storage windows or exact fixed global
placement to prove the complete byte/word write disjoint. Both current ownership
consumers use this same proof. Exact integer arithmetic and wrapping stay intact;
opaque/borrowed addresses, narrowing and unproved arithmetic stay unknown.
Placed `$0317` word writes must still hit the selected vector's low byte.

This necessary correction is decided under PRIME workflow rule 4. The independent
semantics reviewer confirms the remedy reuses existing `SemanticPlace` and
placement facts and needs no new IR, schema, alias framework or range-analysis
subsystem. The modification set is `semantic/interrupt-address-facts.ts`,
`interrupt-ownership.ts`, `interrupt-context-proof.ts`, one new independent
existing-tier specification file, and this plan's evidence documents. No public
API, profile, runtime, source workaround, dependency or harness is introduced.
Blind RED must precede production; all existing oracles and vector/wrap negatives
remain unchanged. Directed/full verification and one fix-only semantics and
correctness clearance remain required before the GREEN commit/push checkpoint.

Fix-only completion also witnesses false E10278 for an agreeing conditional
expression, not just agreeing mutable-place assignments. Populate an existing
merge result from each predecessor's selected value before the existing join;
only agreement across reachable edges survives. Eight blind positive cases
provide RED and four mixed-owned/vector controls already pass. This completes
AR-P34's agreeing-join contract without a new representation or analysis pass.

## AR-P35 — selected IRQ storage debug projection (runtime)

The independent AR-P32 oracle reaches actual available initializer storage but
finds no source-correlated IRQ local homes. Public memory intervals prove those
homes are emitted. `services/evidence-records.ts` compares a selected entry's
activation identity with a source binding identity, dropping its debug storage
records. The oracle is correct and remains frozen unchanged at `0458459c`.

**Best option:** match the existing captured selected-entry identity to its
canonical machine-entry label in that same debug producer. Keep separate source
and entry identities; do not broaden a private home to every handler variant.
This necessary metadata correction is decided under PRIME workflow rule 4 and
adds no public field, generated instruction, runtime or schema. The modification
set adds only `services/evidence-records.ts` to the existing correction unit.
The eight current RED cases supply the missing-projection regression. After
this correction, capture genuine allocator RED before AR-P32's storage repair.
Full verification and the single combined fix-only review remain required.

### Initializer oracle boundary

The first eight cases prove declared IRQ-local projection and helper-argument
separation. After AR-P35 they pass unchanged, before the domain correction; their
original hash remains frozen. A separate four-profile compiler-temporary case
must witness the saved IRQ sample as well as the initializer low byte and fail
their actual physical separation. Do not edit the passing cases to force RED or
claim declared-local-only coverage proves all compiler-created storage safety.

## AR-P36 — observer-scoped proof equality (runtime)

Independent host review finds MAJOR PE-001: sequential distinct IRQ scopes leave
inactive NMI captures in every equality key. Arrival/absence histories multiply
despite identical live routes. Actual in-memory closure probes complete K=4/6/8
with 14,493 / 62,789 / 274,525 map writes and 221 / 917 / 3,701 largest maps.
These are instrumented host measurements, not machine/runtime or deadline proof.

**Best option:** let the existing state-key function accept the existing reader
closure as a membership filter. Apply it at invocation, exit and CFG-point keys.
Retain the actual word values for observed slots, all other key fields, complete
operational states and the separate physical binding/capture catalogue. Close
protected captures' transitive tails in the existing observer function. Never
discard a word merely because its logical owner popped.

This necessary existing-owner correction is decided under PRIME workflow rule 4.
The modification set is `semantic/interrupt-context-facts.ts`,
`interrupt-context-proof.ts`, the existing implementation-tier lifetime file,
one new blind public sequential-scope specification file, and plan evidence.
No pass, runtime, schema, source limit, harness or dependency is introduced.
Independent behavior controls and before/after host-work measurements precede
full verification and one fix-only SFA/host-performance clearance.

Confidence: High conditional on complete reader closure. Hardening: key-only
projection avoids changing operational word facts. Challenger: converged,
packet-grounded only because its read-only role had no permitted filesystem
tool; it is not counted as independent code review. Ordinary install overwrites
before publishing a new reader; existing vectors, owners, active entries and
suspended readers retain every future typed read. Actual-source SFA review must
verify that non-revival invariant and all three key consumers.

PE-002/PE-003 are MINOR host-cost observations, not additional executable scope.
Record their existing-owner optimization directions in bounded closeout; no
unapproved call index or general SSA lifetime pass is added here.

### Necessary corrections — final disposition

AR-P32–AR-P36 now pass the complete GREEN checkpoint and their independent
bounded review gates. All seven corrective oracle hashes remain frozen; earlier
exact exceptions retain independent integrity clearance. No material ambiguity
remains in this bounded slice. The [closeout](08-closeout.md) records the
unclosed RD-05 obligations and measured RD-08 output debts separately; their
existence is not an expert-floor waiver or a claim this plan implements all RD-05.

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

Historical maintenance reopened planning, not executable work. AR-P12 above now
owns the completed discovery rescan. The plan and its preflight must pass before
implementation; this register alone adds no production machinery.

## Independent simplicity and safety challenge

Historical blind review compared immediate implementation, bounded proof-first
work and a separately approved source-restricted profile/runtime gate. It chose
proof first. A second challenge confirmed the original unchanged contract's
negative result; physical feasibility stayed Unknown. Neither review approved
a finite source bound, new profile/runtime system or RESTORE restriction.
Confidence was High for that negative certification result. AR-P7/AR-P10 later
qualified the narrower generated-route boundary; AR-P12 owns its fresh challenge.

The original matching-low idea was analytical only and did not settle live-link,
layout/padding, re-entry or CIA2 ownership. Its strongest counterargument was that
proof-first work might end without a usable capability. The exit remains a
specific unclosed fact, not indefinite research or a claim NMI is impossible.
DEF-7 stays RD-05-owned. AR-P12 and the component docs now govern the active design.

## Historical verification — original bounded check

20/20 existing interrupt tests passed with one worker; 47 links, six source keys,
four expert anchors, whitespace/freeze checks passed. Capture:
`/tmp/blend65-nmi-check-5H6m3D/profile-tests.log`. Historical feature count was 2/10;
portfolio 1/10 drift was left for integration. No compiler/oracle change or new
assembly, VICE, physical or whole-compiler qualification. Markdown exclusion retained.

## Verification — AR-P5 investigation

Two-document validation passed: 54 links, six keys, four anchors, nine original
hashes, pinned firmware, gates, whitespace/freeze and forced targeted formatting.
Captures: `/tmp/blend65-restore-safety.XTgULP/artifact-check.log`, `format-check.log`,
`roadmap-check.log`. Independent read-only correctness/maintainability/standards/
API/concurrency review: no findings. Feature 4/10; portfolio 1/10 drift waits for
integration. Docs/primary-source inspection only; no new runtime qualification.

## Verification — AR-P6 reconciliation

Two-document validation passed: 57 links/anchors, six keys, four expert anchors,
nine original hashes, pinned firmware, gates, formatting and freeze/oracle checks.
Captures: `/tmp/blend65-nmi-contract.YY4wl7/artifact-check.log`, `format-check.log`,
`roadmap-check.log`. Independent read-only review: no findings. Feature 4/10;
portfolio 1/10 drift waits for integration. Contract proposal only; no compiler,
test, frozen-authority, generated-code, VICE or physical qualification change.
