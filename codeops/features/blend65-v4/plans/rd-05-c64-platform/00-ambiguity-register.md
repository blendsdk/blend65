# Ambiguity Register: RD-05 C64 Platform

> **Status**: Phases 1–2 verified; AR-P10 correction complete. AR-P3 remains deferred within RD-05; AR-P9 closed without a timeout change.
> **Last Updated**: 2026-09-27
> **CodeOps Artifact Schema**: 1

## Planning Scope Contract

| Boundary | Authorized scope |
|---|---|
| Planning target | Staged Blend65 v4 RD-05 planning under AR-P3. Plan independently settled work from R5.1–R5.56 first; keep NMI-dependent work outside executable scope until its proof is resolved. The complete RD remains the eight resident C64 PRG profiles, narrow hardware/platform operations, exact player adapters, and user-authored workload qualification. |
| Context artifacts | Frozen Specification 4 and expert 2.0.0; RD-05 and the requirements register/preflight; RD-03's current pipeline and API decisions; RD-04 closeout and carried deferrals; the current compiler, test facilities, manifests and project guidance. Reading these does not authorize changing them. |
| Modification set | This new plan folder, the active feature roadmap, and only the four RD-05 authority-wording locations approved in AR-P2. No compiler, test, frozen specification, expert-baseline, sibling-RD, or portfolio changes. |

## Decisions

| ID | Category | Decision or question | Authority | Status |
|---|---|---|---|---|
| AR-P1 | Scope / effort | Start RD-05 planning at XHigh using its existing scope. Keep application algorithms in self-contained qualification programs, not shipped gameplay modules. Keep native assets with RD-06, loading with RD-07, optional optimization with RD-08, tooling with RD-09, and Windows/physical qualification with RD-10. | User: “xhigh is confirmed, proceed to the next RD”; existing requirements AR-038 and Windows deferrals remain binding. | ✅ Resolved |
| AR-P2 | Scope / public API authority (sensitive) | Correct only the four named RD-05 authority-wording locations. Its plan owns missing library bindings/signatures for already-required behavior using existing language forms. Preserve frozen contracts, approved M1 APIs, safety and parity; add no new behavior or support framework. | User: “I approve. proceed” on 2026-09-27, accepting the single AR-P2 recommendation after independent challenge. | ✅ Resolved |
| AR-P3 | Behavioral / NMI safety and planning scope (sensitive) | Plan independently settled RD-05 work first. Defer the positive finite NMI-source/reentry and safe install/restore contract within RD-05. Owner: RD-05 planning, with the user deciding any product/frozen-spec change. Revisit before admitting NMI-dependent executable work or declaring the complete RD-05 plan ready, whichever comes first. | User: “I approve” on 2026-09-27, accepting the single staged-planning recommendation. No frozen-spec change, source assumption, runtime guard, implementation, or RD closeout is authorized. | ⏸ Deferred — named NMI decision; staging approved |
| AR-P4 | Delivery order / profile composition (complex) | Stage A covers the four cooperative KERNAL PRG profiles and their immutable source facts. Retain current interrupt behavior and memory/startup ownership; no takeover, scoped banking or new interrupt route enters this stage. Other required platform work remains owned by later RD-05 planning, not dropped or transferred. | AR-P3 staging approval plus project workflow directive 4 for dependency-derived plan order. Frozen appendix §§1, 5.1, 9.1 and 10 define the cooperative deltas. | ✅ Resolved — plan-owned selection |
| AR-P5 | API names / scalar representation | Use one `c64.profile` constant namespace, existing scalar types and ordinary import/const rules. Represent exact frame rate as an integer part plus a reduced proper fraction; represent clock frequency as whole kilohertz plus remaining hertz. No wide integer, float, aggregate descriptor or arithmetic helper is added. Exact bindings belong to the component specification. | AR-P2 explicitly delegates missing names/signatures; R5.3 requires exact facts; Chapters 02/03 retain 16-bit limits and zero-storage scalar constants. Project workflow directive 4. | ✅ Resolved — plan-owned selection |
| AR-P6 | Implementation boundary / simplicity | One closed, pure four-row fact module serves frontend declarations and backend selection. Extend the current constant bindings, evaluator, CFG, selected-target, startup/layout and VICE paths directly. Preserve M1 signatures and immutable spec tests. Update the obsolete 8580 rejection only in `profile.impl.test.ts`. | Existing consumers: `frontend/profile.ts`, `profile-bindings.ts`, `target/profile.ts`, `layout/startup.ts`, `services/vice.ts`; AR-P2 and project workflow directive 4. No new general subsystem. | ✅ Resolved — plan-owned selection |
| AR-P7 | Compatibility / failure behavior | Keep manifest and evidence version 1 shapes unchanged. Preserve the nine-ID manifest inventory, admitting only the four staged IDs for execution. Carry the exact selected identity through diagnostics and evidence, with no fallback. Preserve E10245 for NMI and the existing handler-side IRQ gap. | Frozen diagnostics and existing versioned contracts; AR-P3; project workflow directive 4. | ✅ Resolved — plan-owned selection |
| AR-P8 | Verification / qualification boundary | Use existing install/build/typecheck/test commands, targeted Prettier, immutable specification-first tests and sequential VICE 3.10. Add only a profile argument and a bounded integer-resource read to the existing monitor helper; retain old PAL defaults. Verify four fresh PRGs and unchanged M1 behavior. Windows and physical QA remain RD-10. | User-provided AGENTS.md command/QA rules; AR-P1/AR-P3; project workflow directive 4. Required direct test controls reuse the existing harness, not a new runner or qualification service. | ✅ Resolved — plan-owned selection |
| AR-P9 | Runtime / verification modification set | Allow the bounded wall-clock increases below if still needed; first rerun the six cases after the user reduced host load. Assertions, emulated cycle limits and compiler behavior stay unchanged. | User explicitly approved timeout increases if needed and requested the six retries after reducing host load (2026-09-27). | ✅ Resolved — all six and full suite passed; allowance unused |
| AR-P10 | Runtime / test authority | Invalidate mutable reaching facts across every runtime call until a callee-effect proof permits retaining them. Approve only the two analysis-precision expectation changes below; retain all fixtures, types, evaluation-order and behavior assertions. No new effect-analysis framework or frozen-language change. | User: “proceed” on 2026-09-27, accepting the preceding explicit AR-P10 correction and two-expectation approval request. | ✅ Resolved — implemented; all 2,387 tests pass |

## AR-P10 — Sound Values Across Runtime Calls

**Recommended:** use the existing all-mutable invalidation helper for every runtime call. A call
without arguments can still write a numeric address that overlaps caller-local storage. Independent
correctness and semantics reviewers reproduced `change() { poke($0acd, 2); }` followed by a caller
read of a local allocated at `$0ACD`: current folding emits `2` for `value + 1`, but the required
result is `3`. The frozen raw-memory contract has no exemption for SFA storage.

The smallest safe change needs no new tracking state, callee-effect analysis, runtime helper or
source restriction. It may retain computation for mutable values that a later sound optimization
can prove unchanged. Immutable/profile constants remain foldable, and the symbolic loads/stores,
effects and calls remain available to future optimization. This is a correctness boundary, not a
permanent optimization barrier. SR-002's separate shared-module/IRQ fix is already cleared.

The first all-call correction exposed two old precision expectations. They ask the frontend to
retain a value across a call without the required effect proof. Approved exact oracle changes:

| File / case | Approved change | Preserved obligations |
|---|---|---|
| `packages/compiler/src/frontend/aggregates.spec.test.ts`, “should preserve index barriers and evaluate a compound indexed assignment once”, post-`g()` index | Change only that index's `constant: 265n` to `constant: null`. | Keep the entire source fixture, word-width ordinal type, earlier 9-valued cast/storage barriers, compound-place/RHS evaluation order and all other assertions. The runtime index still evaluates to 265. |
| `packages/compiler/src/frontend/scalars.impl.test.ts`, “keeps branch, short-circuit, function, and call-visible facts isolated”, `body.statements[10]` | Change only `initializer.constant: 1n` to `null`. | Keep its fixture, diagnostics, branch/short-circuit facts and other assertions. Actual program values do not change. |

Approved execution: remove the unsafe no-argument exception, apply only these two expectation changes,
add the concrete raw-write regression and a behavior check that the safe example's index remains
265, then run directed and full verification. Record the authorized ruling and resolved finding
evidence. The one permitted focused re-review has completed; do not start a third review without
separate explicit authority. Do not substitute green tests for closure of the known counterexample.

Confidence: High. Hardening: two independent reviewers established the same final-layout
counterexample; the performance auditor found no new framework, asymptotic cost or permanent
optimization barrier. A new effect-summary system could recover more precision, but is not
authorized or necessary to finish this bounded phase. The user approved the correction and these
two expectation edits on 2026-09-27. Commit only at a coherent green checkpoint under project
policy. No push, third review or Phase 3 start is authorized by this decision.

Completed on 2026-09-27 at 17:11: exactly the two approved assertions changed; the numeric-address
VICE regression failed with 2 before the correction and passes with 3 afterward. The safe array
case still reads index 265, distinguished from wrapped index 9. The complete 2,387-test checkpoint
passes with original limits. See [Phase 2 execution evidence](99-execution-plan.md#phase-2-cooperative-builds-and-output-proof)
for review dispositions, immutable hashes and logs. No frozen specification or expert file changed.

## AR-P9 — Integration-Test Waiting Time Under Host Load

**Approved if needed:** extend only the existing host waiting limits below. No new harness,
dependency, retry mechanism, production change or specification-test edit is proposed.

| Exact proposed modification set | Proposed bounded change |
|---|---|
| `packages/compiler/src/services/services.impl.test.ts` | Give the fresh-generation and SFA live-range integration cases explicit 30-second limits instead of the implicit 5 seconds. |
| `test/rd04/expert-calls.impl.test.ts` | Give its build-and-VICE case an explicit 30-second limit instead of the implicit 5 seconds. |
| `test/rd04/shared-storage.impl.test.ts` | Extend checkpoint waiting from 50 to 120 seconds and the enclosing cases from 60 to 150 seconds. Retain the 300-million emulated-cycle cap. |

Evidence and logs are in [Phase 1 execution](99-execution-plan.md#phase-1-frontend-constants).
Six existing cases have now timed out under the current load. All new tests and the full M1
journey pass, but uncompleted assertions remain unverified. These limits measure host elapsed
time, not generated-code cycles or expert parity. If approved, preserve every expected result,
memory/assembly/cost check and emulator configuration, then rerun the failed cases and the full
verification command. A continuing failure must be investigated, not excused as host load.
The user approved this exact allowance on 2026-09-27 after pausing other heavy processes.
Rerun with original limits first; use the approved changes only if required. Approval does
not mark any test verified or authorize work beyond Phase 1.

**Outcome at 10:33:** all six cases pass with their original limits after the user reduced
host load. No timeout edit was needed; the three named test files remain unchanged. Full
Phase 1 verification subsequently passed all 2,261 tests at 10:41, as recorded in the execution
plan. This allowance is closed unused; no test file or timeout was changed for AR-P9.

## AR-P2 — Missing Library Bindings, Not Missing Language Syntax

**Status: Verified partial. Claim kind: Fact.** The frozen appendix defines the complete profile
identities and many machine contracts, names the interrupt setters, and illustrates the six audio
operations. It does not provide the full public hardware-library signature inventory claimed by
RD-05. This finding is about contract coverage, not a new hardware diagnosis or a compiler failure.

| Evidence | Consequence |
|---|---|
| [RD-05 R5.3](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md), lines 76–80 | Source-visible profile facts are required, but their binding names/types are not supplied there. |
| RD-05 R5.10–R5.11, lines 118–128 | Scoped banking and the full named-device surface are attributed to Specification 4. |
| RD-05 “Profile composition contract”, lines 466–469, and “Scope Decisions” traceability, lines 577–579 | The missing exact API spellings are assigned to the already-frozen appendix/RD-01 rather than to this implementation plan. |
| [C64 appendix](../../../../../spec/appendix-c64.md), §§5, 7.3.1, 9.2 and 10; [Chapter 15](../../../../../spec/15-platform-profile.md) | Profiles, startup, interrupt and audio contracts exist. Searching the active normative corpus finds no complete keyboard-scanning or scoped-banking public signature table. |
| [RD-03 AR-C17](../rd-03-pipeline-completion/00-ambiguity-register.md) | An explicit precedent: missing M1 convenience names/signatures were plan-owned under workflow directive 4, with direct inline lowering and no runtime library. |
| [RD-04 AR-P19](../rd-04-language-completion/00-ambiguity-register.md) | The user already transferred source-visible profile facts to RD-05 because the frozen specification supplies no source binding or spelling. |
| `packages/compiler/src/frontend/profile.ts` and `profile-bindings.ts`; `target/profile.ts` | The existing implementation admits one complete profile and a small explicit list of typed operations. It is an extension point, not authority for the missing product contract. |

### Bounded candidate resolutions

1. Correct only the missing-library-authority wording in RD-05. The plan becomes the single
   owner of signatures absent from frozen Specification 4, constrained to the already-required
   behavior and existing language forms. Published specification contracts and approved M1
   signatures remain unchanged. This does not authorize new syntax, a runtime, a plugin system,
   a game framework, or a weaker safety/parity contract.
2. Reopen the frozen specification through a separately authorized, bounded specification
   revision and affected expert requalification before completing this plan. This gives the
   signatures a normative home but expands the modification and qualification scope.

The exact approved requirement edit set for candidate 1 is R5.10's “Specification 4 C64 banking
operation” attribution, R5.11's exact-signature ownership, the “Profile composition contract”
ownership paragraph, and the “Scope Decisions” traceability paragraph. Every behavioral
requirement, acceptance criterion, profile fact and sibling RD remains unchanged. These four
wording corrections were applied after the user's approval on 2026-09-27. Downstream API
specifications and execution tasks were withheld until the bounded Stage A gate closed; they
are now linked from the [Stage A index](00-index.md).

**Recommended: candidate 1.** It corrects the authority mismatch while retaining the already
approved behavior and the frozen language. Choosing names cannot override a hardware obligation,
weaken safety, or introduce new semantics. The one owning component document should distinguish
inherited signatures from newly specified bindings; no extra API registry or parallel contract
system is needed.

Confidence: High for this bounded authority correction. A signature that requires changed frozen
semantics would reopen that affected item. Hardening: the blind independent challenger converged
on candidate 1 and tightened the boundary against new behavior or safety exceptions. Its review
used the supplied file/line evidence packet, not a separate repository inspection. The strongest
counterargument is split public-API ownership; explicit references from the one owning plan
document keep inherited and missing contracts distinct. With a larger budget, a normative API
revision is possible, but is not necessary just to name existing required operations.

The user approved candidate 1 on 2026-09-27. Normal make-plan mode remains active. Project
workflow directive 4 permits plan-owned technical choices; the explicit AR-P2 ruling supplies
the narrow requirement-edit authority. Discovery resumes without reopening the frozen language.

## AR-P3 — Safe NMI Support Is Not Yet Proved

NMI is an interrupt that the CPU's normal interrupt-disable flag cannot block. Two distinct
proofs are missing: safe replacement/restoration of its two-byte handler address, and a finite
maximum number of handlers that can interrupt one another. Solving the address update alone does
not solve nesting or storage safety.

| Evidence | Bounded conclusion |
|---|---|
| [Chapter 15](../../../../../spec/15-platform-profile.md), lines 266–271; [C64 appendix](../../../../../spec/appendix-c64.md), lines 856–864 | The profile declares unbounded NMI self-preemption. A reachable cycle without a finite external bound must reject with E10245. |
| C64 appendix §9.2, lines 760–761; expert `references/c64-memory-and-runtime.md`, lines 353–359 | The common installer wording requires an interrupt-disabled section, but does not say this alone makes NMI updates safe. Additional quiescence or a proved safe update is needed. No contradiction requiring a frozen-spec edit has been demonstrated. |
| `packages/compiler/src/semantic/whole-program.ts`, lines 348–356 | Current lowering is not reached for an unmasked, unbounded sink: semantic analysis reports E10245. This is the approved conservative baseline, not usable NMI support. |
| RD-05 R5.15–R5.17 and AC-12–AC-14; RD-04 AR-P16 / DEF-7 | Positive NMI support remains an RD-05 obligation. The existing rejection cannot count as completion. |
| [Pinned 901227-03 KERNAL source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi) | The firmware establishes dispatch and acknowledgement behavior, not a maximum arrival rate across CIA2, RESTORE and other enabled sources. No combined-source nesting bound was established by this investigation. |
| [Commodore C64 service manual](https://www.commodore.ca/manuals/funet/cbm/schematics/computers/c64/manual-html/Page_12.html); [MOS 6526 CIA data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) | RESTORE reaches the processor's NMI line through a separate timer/inverter circuit. CIA2 ICR masking controls CIA2's output, not RESTORE; therefore masking CIA2 plus `SEI` cannot make a cooperative two-byte `NMINV` update quiescent. |

**2026-09-29 revisit — DEF-7 remains open.** The smallest proposed CIA2-only critical
section fails the direct RESTORE path above. Writing either byte of an arbitrary old-to-new
`NMINV` address first can expose a mixed address; no valid intermediate target is established
for an unknown prior vector. A same-low-byte, one-write specialization would need a proved prior
vector and matching placed entry, and does not by itself bound NMI re-entry. Preloading a raw
vector under KERNAL ROM and exposing it with one processor-port change addresses the vector
transition only in a takeover profile; it does not bound RESTORE or another enabled source.
The [pinned KERNAL source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi)
also shows that its prior handler consumes CIA2 ICR and can re-enable CIA2 masks, so a chain
cannot silently take ownership of that read or claim a stable mask from an unreadable ICR.

No positive finite-source and update/restore witness covers all selected-profile sources yet.
Keep E10245 for unproved NMI routes and keep R5.15–R5.17/AC-12–AC-14 with RD-05. Do not
weaken the frozen spec, add a runtime dispatcher, or silently treat a RESTORE-free emulator
run as a hardware guarantee. The smallest decisive follow-up is one concrete selected-profile
source/installer sequence with its complete prior-handler, vector-intermediate, pending-edge,
re-entry, SFA, stack and cycle proof, followed by VICE and targeted RESTORE/CIA hardware QA.

**Recommended: stage planning, not the safety contract.** Plan the independently settled work
first. Keep the NMI decision explicitly unfinished within RD-05; do not move it to another RD,
weaken R5.15–R5.17 or AC-12–AC-14, or imply that the full RD-05 plan is ready. Any operation whose
correctness depends on the missing NMI proof stays outside executable work. No compiler code,
runtime guard, dispatcher, new dependency, specification change, or arbitrary source bound is
authorized by this recommendation.

The user approved this staging on 2026-09-27. The named deferred decision is **the positive finite
NMI-source/reentry and safe
install/restore contract**. Owner: RD-05 planning, with user approval for any changed product or
frozen-spec contract. Revisit: before admitting NMI-dependent executable work or declaring the
complete RD-05 plan ready, whichever comes first. RD-05 cannot close while this obligation remains
open. Approval permits bounded planning only after the remaining discovery/gate checks for
that bounded scope; it does not itself authorize implementation.

Confidence: Medium. Hardening: the independent challenger recommended staging and rejected an
immediate spec erratum as unnecessary on the evidence available. Its review used the supplied
file/line and primary-source packet rather than a separate repository inspection. The strongest
counterargument is that a concrete program/hardware proof could remove the need to stage. Such a
proof must cover every enabled source, the complete prior-handler route where present, banking,
bus denial, finite SFA/stack demand and safe update/restore states. A CIA2 timer interval alone or
an assumption that RESTORE will not be pressed is insufficient. No such witness is established;
positive NMI capability and complete route costs remain **Unknown**, not proven impossible.

Directed verification on 2026-09-27: the existing
`test/rd04/diagnostics-alternate-placement.spec.test.ts` and
`test/rd04/expressiveness-ledger.spec.test.ts` suites pass **22/22** cases. These preserve the
negative safety baseline only; they are not a new positive NMI or hardware qualification.
Expert lineage remains `2.0.0`, content `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`, specifically
`references/sfa-and-abi.md#interrupt-route-completion-gate` and
`references/c64-memory-and-runtime.md#revision-pinned-nmi-contracts-and-costs`.

## Existing Handoffs — Do Not Drop or Reapprove

| Owner | Obligation retained for RD-05 |
|---|---|
| RD-04 AR-P16 / roadmap DEF-7 | Establish a qualified finite NMI-source and vector-update contract before claiming usable NMI installation; any needed frozen-spec correction is separately authorized. |
| RD-04 AR-P17 / roadmap DEF-8 | Support balanced handler-side IRQ installation/restoration with distinct live predecessor storage and complete chain/reentry proof. |
| RD-04 AR-P19 | Define and implement selected-profile source facts and compile-time branch removal. |
| Requirements AR-038 / project product boundary | Workloads prove ordinary source expressibility; no engine, renderer, pool, collision, scrolling, multiplexer, buffer-manager or audio-scheduler product is added. |
| Project prime directive / RD-04 closeout | Preserve expert assembly quality and future optimization opportunities. Reuse applicable tracked cost gaps; the plan must not interpret RD-05's `none` scope as permission for hidden overhead or untracked parity debt. |

## Simplicity and Verification Baseline

Reuse the existing compiler pipeline, explicit profile declarations, symbolic machine operations,
SFA closure, layout, evidence records, Vitest and sequential VICE facilities. No dependency,
generic registry, new test runner, readiness service or speculative future-target layer is proposed.
Any necessary larger support surface must pass the separate complexity-approval gate before it
enters this plan.

The existing verification commands remain install with the frozen lockfile, build, typecheck,
workspace/root tests and targeted formatting. Directed tests run during implementation; complete
owned checks run at coherent phase checkpoints. This discovery checkpoint is Markdown-only and
requires formatting, local-link and source-reference validation, not a compiler-suite rerun.

## Stage A Gate Review

The user approved the only changed scope decision (AR-P3). AR-P4–AR-P8 apply the explicit
project directive that the plan makes its own technical choices; they do not claim auto-design
authority or a new user ruling. This gate permits authoring the bounded Stage A documents only.
Full RD-05 planning and all NMI-dependent executable work remain incomplete.

| Gate category | Closure for Stage A |
|---|---|
| Feature gaps | R5.1–R5.7 are addressed only for the cooperative family and inherited operations; the requirements delta retains every other R5 key under RD-05. |
| Behavior | Exact constants, ordinary imports/const rules, branch removal, startup/return and selected identity are owned by the two component specifications. |
| Scope | AR-P3/AR-P4 exclude new interrupt and banking behavior; no game API or sibling-RD deliverable is added. |
| Technical unknowns | Four closed facts reuse existing representations. Assembly and emulator outcomes are future tests, not assumed results. |
| Edge cases | Wrong/partial IDs, scalar range, duplicate names, read-only/address use, inactive effects, stale profile selection and mismatched execution configuration are specified. |
| Integration | Frontend stays independent of backend imports; compiler, CLI, pinned generation and existing VICE helper carry the same identity. |
| Data/state | No wire-schema change or migration. Profile constants have no storage; initialized user data and private SFA retain normal ownership. |
| Security | Closed profile allowlist, fixed argv with shell disabled, untrusted monitor-length checks and existing process cleanup. No network product, auth, secrets or new infrastructure. |
| Non-functional | Zero profile-dispatch cost; direct literal and independent semantic oracles; complete startup/resource delta checks. No optional optimizer or benchmark framework. |
| UX | Source facts use ordinary scalar names; diagnostics name the selected profile. No runtime target string or hardware-shaped user workaround. |
| Stakeholders | Modern source ergonomics, expert output and the frozen spec all remain binding. Scope/authority decisions stay user-owned. |
| Naming | New source bindings, internal file owners, spec/impl test locations and public compatibility boundaries are fixed in the component documents. |

Domain lenses: compiler/language (constant and branch semantics), data/migration (unchanged
version-1 artifacts and selected-profile identity), concurrency (snapshot isolation, unchanged
interrupt proof, sequential emulator ownership). Financial/web lenses are inapplicable.

**Simplicity check:** no custom profile language, configurable registry, new optimization pass,
runtime rational object, new evidence schema, new runner or dispatcher. A single pure fact module
has two immediate consumers. The existing monitor gains one direct read needed to distinguish
selected settings from actual emulator settings. These are ordinary feature data/controls, not
a material support subsystem.

Hardening for AR-P4–AR-P8: consider facts-only on the original PAL profile (smaller but leaves the
required PAL/NTSC comparison untested) and all eight profiles at once (blocked by AR-P3). The four
cooperative profiles are the smallest useful complete comparison without raw ownership. A larger
budget would qualify later RD-05 slices, not justify a new framework. The strongest counterargument
is accidental dependence on PAL-only startup assumptions; explicit target guards, encoding/loader
diagnostics, exact emulator settings, four fresh smokes and the unchanged M1 journey cover that
boundary. Confidence: Medium pending preflight and execution. Challenger: budget exhausted (the
two allowed reviews covered AR-P2 and AR-P3); no independent Stage A review is claimed.

Knowledge lineage: expert `2.0.0`, qualified content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`,
`references/blend65-semantics.md#authority-and-use` and
`references/compiler-architecture.md#target-composition`. Governing sources are the current
frozen Specification 4 Chapter 15/C64 appendix and the explicit project workflow/product rules.
The later approved diagnostic-only erratum does not supply the missing platform signatures.
