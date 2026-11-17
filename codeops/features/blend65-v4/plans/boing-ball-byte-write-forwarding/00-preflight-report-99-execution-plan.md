# Preflight: anonymous byte-write forwarding

> **Status**: ✅ PREFLIGHT PASSED — clean scan, 0 findings
> **Audit target**: `99-execution-plan.md` only
> **Audited SHA-256**: `c4fe6120d7eebfffcd21594dd05e38c2e2e2ff22e8666cd094eacacb7ba50c50`
> **Baseline**: `4e116829`
> **Scope**: strict

SAME-SESSION REVIEW: the primary authored this valid single-file mini-plan. Five fresh independent
review contexts own the dimension clusters. Related requirements, predecessor plans and compiler
files are context, not additional audit targets. No specification or implementation exists yet.

## Reconnaissance

| Existing seam                     | Grounded context                                                                                                                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arithmetic A producer             | `machine/lower-arithmetic.ts:57–85`; byte result already ends in A.                                                                                                                                                                            |
| Retention and raw-write consumers | `machine/lower-state.ts:680–687`, `lower-operation.ts:1000–1005`, `lower-memory.ts:472–494`; the existing forwarding set supplies both obligations.                                                                                            |
| Selection owner                   | `machine/lower-function.ts:203–207,334–343`; original source identities and forwarding-set union already exist.                                                                                                                                |
| Complete observer premises        | `machine/sprite-publication-proof.ts:253–339,506–546`; exact main-only source, all raw accesses disjoint from full SFA windows, firmware-routing veto and contained immutable sprite fetches. The read-specific observer query is not widened. |
| Full use inventory                | `semantic/value-lifetimes.ts:89–111`, `semantic/lower-control.ts:12–37`; include operand occurrences and separate branch/return operands.                                                                                                      |
| Existing test ownership           | Public detached build fixtures, serialized `test/m1/vice-monitor.ts:66–112` and `vice-runtime.ts`; root tiers classify imports without runner changes.                                                                                         |

The post-commit trace in the target includes all four actual candidates, sole adjacent uses and
fresh retained-value homes. Independent challenge confirms unchanged premises cover that exact
anonymous arithmetic class, not a general temporary-store waiver. This is context for adversarial
preflight, not its verdict. Compiler/language is the selected domain lens; no persisted-schema,
concurrency-service, financial or web surface is introduced.

## Coverage and findings

| Cluster   | Dimensions                                     | Status                                                                                                                                       |
| --------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Soundness | 1 / 3 / 12 plus compiler semantic preservation | No findings; exact identities, full use counts, observer/flags and fallback contracts checked.                                               |
| Grounding | 2 / 13, all ten alignment checks               | No findings; all ten grounded against actual producer/consumer, fixture and closure paths.                                                   |
| Delivery  | 4 / 5 / 11                                     | No findings; existing fixtures, dependency graph, pre-emission handoff and specification-first/checkpoint ordering checked.                  |
| Risk      | 6 / 8 / 9                                      | No findings; fixed-query feasibility, unchanged safety barriers, wrap/alias/source/usage edge cases and existing monitor boundaries checked. |
| Fit       | 7 / 10                                         | No findings; measurable independent cases and existing monitor APIs suffice without a new support subsystem.                                 |

All thirteen dimensions and the compiler/language semantic lens are covered by the five clustered
independent assessments. The grounding cluster checked all ten alignment subchecks. No findings
or user-owned decision remain; source acceptance, named stores, observation rules and `none`
policy are unchanged. New code and independently authored tests still precede qualification.
Frozen Specification 4 and qualified expert `2.0.4`, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, remain authority; implementation and measurements
remain audit subjects. No new oracle exception or material support surface is authorized.

## Authority, adversarial checks and limits

The direct-store and arithmetic contracts are governed by Specification 4 memory effects and
fixed-width arithmetic, plus supplied expert Optimization Contract, Loads/Stores,
Addition/Subtraction and CPU Instruction Effects excerpts. Under the existing D=0 startup
contract, ADC's N/Z describe the byte that LDA would reload; STA preserves flags and LDA does not
change C/V. The existing full-window and immutable-publication premises exclude observations of
the omitted anonymous home independently of its producer. The read-specific exemption is not
generalized. Complete use counting establishes lifetime, not invisibility; both proofs remain.

Adversarial checks covered hidden branch/return/merge uses, unreachable extra uses, stale source
and block identities, index/alias escape, unknown raw accesses and firmware routing, incorrectly
assuming a named store was anonymous, new storage after closure, flags under wrap, code-only
sampling, and accidental four-profile runtime or whole-frame cost claims. No counterexample
survived within the exact planned class. No general analyzer, runtime, observer waiver, source
restriction or new test runner is needed.

Reviewers inspected actual producer, retention/raw-store consumers, closure and fixture APIs.
Execution-owner hashes, source/home traces, predecessor command totals and future output were not
independently executed by reviewers. Risk review's incidental historical routing summaries were
excluded. Missing external workflow-read authority was handled using authorized parent excerpts;
no denied path was retried. Future meaningful RED, exact post-store sampling, storage closure,
assembled cost and runtime behavior remain execution obligations, not this preflight's results.

Physical hardware, whole-frame cycles and external aggregate IRQ/NMI stack, reentrancy/completion
and deadlines remain Unknown. No new generated interrupt route or `$FE47` entry condition follows.
Source keys: `BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `CBM-C64-PRG-1982`.

The five independent scans used design hash
`155712b0a0b78cc7cf7e58a19d2d2d636ab7f793b733a128b19d2618a69f55f6`.
The primary checked the sole subsequent target edit: its status line now records the passing
preflight rather than requiring it. No signature, behavior, ownership, dependency or task changed;
the current binding above includes that metadata-only edit. Later crash-safe task/status updates
do not amend the audited design.

At execution entry, the primary checked the clean plan checkpoint `27ebf448` and recorded its
complete Git tree as the phase baseline. The target's only entry changes record that baseline
and mark specification authoring started. Scope, signature, acceptance and ordering are unchanged;
no implementation or specification was present at entry.

## Bounded pre-freeze test-granularity check

Formatting expanded the independently authored selector specification to 509 lines. Before freeze
or production implementation, the handoff was split into positive/shape and usage/identity/observer
specification files. One small component-local real-source fixture and typed mutation adapter
reuses the original author's setup for those two immediate consumers; no existing helper, shared
runner or infrastructure changes. The primary owns that mechanical extraction because the native
spec author writes only specification files. All 58 selector cases and assertions must remain.

The independent fit reviewer checked only this amendment and its direct consequences, finding no
D7/D10 defect or material support escalation. It did not inspect the partitioning files while the
author was editing them; exact reconciliation and freeze remain the execution owner's obligation.
The two root specifications and all production/scope/observer contracts are unchanged. Public
existing-build RED is seven assembly failures/15 acceptance passes; the independent 257-write
VICE behavior case passes. Those are primary execution results, not reviewer execution.
