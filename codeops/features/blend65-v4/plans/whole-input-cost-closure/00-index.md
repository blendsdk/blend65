# Whole-input cost closure

> **Status**: Paused by user for machine restart — AR-P8 verified; remaining runtime specifications incomplete
> **Created**: 2026-10-12
> **Implements**: blend65-v4/RD-08, blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Minimum-sufficient baseline

**Original goal:** finish the existing ordinary-source keyboard and both-port
joystick qualification without weakening its complete expert-output bounds.
**Smallest viable design:** the bounded early RD-08 `size` prerequisite approved
in [AR-P4](00-ambiguity-register.md#ar-p4--exact-approved-complexity-decision).
Use existing semantic operations, machine selection, SFA, layout, startup and
artifact owners. One phase qualifies the interacting families together.
**Excluded machinery:** general optimizer/pass framework, alias solver, register
allocator, predicate-layout framework, inliner, runtime, dependency, test runner
and input-specific source recognition.
**Approved complexity:** AR-P4 and the three bounded preflight corrections
approved on 2026-10-12; unknown eligibility keeps ordinary source lowering.
The only context-contract expansion is PF-002's existing costs-evidence rule
and validator. No new support family, runtime or language restriction is added.

This plan implements only an early subset of RD-08 and unblocks the named input
gate in RD-05. It does not complete either RD or qualify `balanced`/`speed`,
assets, D64, raw takeover, unrestricted external interrupt behavior or physical
silicon. The rest of RD-08 keeps its RD-06/RD-07 prerequisites. The owning input
plan remains 38/48 until its own qualification tasks pass.

## Documents

<!-- prettier-ignore -->
| Document | Owner |
| --- | --- |
| [Decisions](00-ambiguity-register.md) | Scope, direct approval, exact oracle exception and analytical cost ledger |
| [Requirements delta](01-requirements.md) | RD subset and plan-local completion boundary |
| [Current state](02-current-state.md) | Observed producers/consumers and missing facts |
| [Source facts](03-01-source-facts.md) | Objects, footprints, lifetimes and fixed induction |
| [Machine selection](03-02-machine-selection.md) | Exact byte/flag/loop/address rules and storage recipes |
| [Closure and modes](03-03-closure-and-modes.md) | Finite alternatives, final observers, startup, public mode and evidence |
| [Tests](07-testing-strategy.md) | Independent behavior and cost expectations |
| [Preflight](00-preflight-report.md) | Complete rescan, verified corrections and remaining implementation evidence limits |
| [Execution](99-execution-plan.md) | Single task-progress authority |

## Specialist Agents

Existing specialist selection for the current phase is explicit below. This is
workflow metadata only: task 1.3.7 already requires all six independent review
lenses. Correctness, semantics/DX and host-performance review remain mandatory in
addition to these domain auditors. No new capability, compiler behavior, oracle
exception or review waiver is introduced.

<!-- prettier-ignore -->
| Role | Kind | Use | Authority |
| --- | --- | --- | --- |
| sfa-abi-auditor | reviewer | Phase 1 storage, calls, lifetimes and final closure | Existing task 1.3.7; project routing |
| target-platform-auditor | reviewer | Phase 1 interrupts, startup, visibility and runtime evidence | Existing task 1.3.7; project routing |
| machine-code-auditor | reviewer | Phase 1 equivalent assembly and complete artifact/resource costs | Existing task 1.3.7; project routing |

The OpenCode migration does not requalify the design or replace historical
preflight identities. Runtime checks, exact oracle gates and the existing
specification-first continuation remain unchanged.

## Usage

Ordinary Blend65 source and installed `c64.input` APIs do not change. The planned
public request is `buildProject({ project, optimization: "size" })`, or the
existing CLI's `build --optimization size`. `none` keeps direct lowering.
Availability of a manifest goal is not full optimizer qualification.

## Readiness

The design preflight remains historically PASSED. [AR-P5](00-ambiguity-register.md#ar-p5--new-fixture-inputs-must-not-prohibit-legal-optimization)
has the exact user ruling of 2026-10-13; its concrete input correction passes
one independent static fix review and directed source/RED checks. The two
reopened authoring completions are requalified. The remaining specification
groups and complete RED gate still precede implementation. No original expected
answer, cost limit or compiler behavior has been changed.
The user directly approved the exact AR-P6/AR-P7 corrections on 2026-10-13.
The execution owner records the necessary bounded baseline-host prerequisite
before the remaining frontier checks. Its scope is four existing files and
exact-result pruning only. Startup correction remains one test function.
AR-P7's exact host remedy qualifies with75 storage tests, fresh build/typecheck,
six unchanged artifact identities and bounded independent reviews. The
complete frontier group now has14 meaningful RED/13 justified baseline passes.
AR-P6's accounting correction is independently clear; native checks expose the
separate universal compact-instruction assertion recorded in AR-P8. The user
directly approved that exact conditional/comment amendment on 2026-10-15;
the concrete fix review is clear and all32normal startup/return cases pass,
with32meaningful unsupported-size failures. No producer or
other test expectation is changed under that ruling. No broader
fix or new framework is authorized; complete RED still precedes the main size
implementation. The exact AR-P4 output-mode amendment has five verified line
changes and12 meaningful unsupported-size failures, with every original limit
preserved.

Status: **Unknown** for implemented sufficiency; claim kind: **Recommendation**
for the approved design. The conditional cost ledger is owned by AR-P4, not a
compiler-run result. Before execution, the full plan must pass preflight. Before
any GREEN checkpoint, both behavior and complete assembled/resource gates must
pass and the phase must receive all configured independent reviews.

The current tree already contains uncommitted keyboard work. Preserve it and
snapshot the complete phase-start state. Do not commit a RED composite tree or
push automatically. The project effort confirmation is already standing for the
named RD-05 continuation; advise effort without repeated handoffs within it.
