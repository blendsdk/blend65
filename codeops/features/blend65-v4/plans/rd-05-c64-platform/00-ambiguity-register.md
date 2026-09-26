# Ambiguity Register: RD-05 C64 Platform

> **Status**: ❌ GATE BLOCKED — AR-P2 resolved; AR-P3 awaits a staged-planning decision
> **Last Updated**: 2026-09-27
> **CodeOps Artifact Schema**: 1

## Planning Scope Contract

| Boundary | Authorized scope |
|---|---|
| Planning target | Blend65 v4 RD-05: the eight resident C64 PRG profiles, narrow hardware/platform operations, exact player adapters, and user-authored workload qualification already required by R5.1–R5.56. |
| Context artifacts | Frozen Specification 4 and expert 2.0.0; RD-05 and the requirements register/preflight; RD-03's current pipeline and API decisions; RD-04 closeout and carried deferrals; the current compiler, test facilities, manifests and project guidance. Reading these does not authorize changing them. |
| Modification set | This new plan folder, the active feature roadmap, and only the four RD-05 authority-wording locations approved in AR-P2. No compiler, test, frozen specification, expert-baseline, sibling-RD, or portfolio changes. |

## Decisions

| ID | Category | Decision or question | Authority | Status |
|---|---|---|---|---|
| AR-P1 | Scope / effort | Start RD-05 planning at XHigh using its existing scope. Keep application algorithms in self-contained qualification programs, not shipped gameplay modules. Keep native assets with RD-06, loading with RD-07, optional optimization with RD-08, tooling with RD-09, and Windows/physical qualification with RD-10. | User: “xhigh is confirmed, proceed to the next RD”; existing requirements AR-038 and Windows deferrals remain binding. | ✅ Resolved |
| AR-P2 | Scope / public API authority (sensitive) | Correct only the four named RD-05 authority-wording locations. Its plan owns missing library bindings/signatures for already-required behavior using existing language forms. Preserve frozen contracts, approved M1 APIs, safety and parity; add no new behavior or support framework. | User: “I approve. proceed” on 2026-09-27, accepting the single AR-P2 recommendation after independent challenge. | ✅ Resolved |
| AR-P3 | Behavioral / NMI safety and planning scope (sensitive) | Approve planning the independently settled RD-05 work first, while retaining the missing finite NMI-source/reentry and safe vector-update proof as unfinished RD-05 work. No complete RD-05 executable plan or closeout may be claimed before this proof is resolved. | Recommended after evidence review and independent challenge; awaiting user decision. AR-P2 does not authorize this staging, a frozen-spec change, new source assumption, runtime guard, or renewed deferral. | ❌ Open |

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
specifications and execution tasks remain unwritten until discovery and the complete gate close.

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

**Recommended: stage planning, not the safety contract.** Plan the independently settled work
first. Keep the NMI decision explicitly unfinished within RD-05; do not move it to another RD,
weaken R5.15–R5.17 or AC-12–AC-14, or imply that the full RD-05 plan is ready. Any operation whose
correctness depends on the missing NMI proof stays outside executable work. No compiler code,
runtime guard, dispatcher, new dependency, specification change, or arbitrary source bound is
authorized by this recommendation.

If approved, the named deferred decision is **the positive finite NMI-source/reentry and safe
install/restore contract**. Owner: RD-05 planning, with user approval for any changed product or
frozen-spec contract. Revisit: before admitting NMI-dependent executable work or declaring the
complete RD-05 plan ready, whichever comes first. RD-05 cannot close while this obligation remains
open. Approval would permit bounded planning only after the remaining discovery/gate checks for
that bounded scope; it would not itself authorize implementation.

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

Discovery still owes the twelve-category gate scan, selected domain lenses, exact component/API
contracts, specification-first cases and execution ordering. No executable plan, readiness claim,
new runtime qualification or RD completion claim is made.

Knowledge lineage: expert `2.0.0`, qualified content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`,
`references/blend65-semantics.md#authority-and-use` and
`references/compiler-architecture.md#target-composition`. Governing sources are the current
frozen Specification 4 Chapter 15/C64 appendix and the explicit project workflow/product rules.
The later approved diagnostic-only erratum does not supply the missing platform signatures.
