# Execution plan: cooperative NMI qualification

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-04
> **Progress**: 0/28 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Baseline and execution rules

The register and plan preflight have passed. Scope is the
[requirements delta](01-requirements.md), not whole RD-05 completion.
Named remaining RD-05 effort handoffs are waived; state a task-specific effort
recommendation, but do not pause for effort alone. Commit coherent green units
through the git-commit skill without asking. Never push without a new user request.

This checklist is the only task-progress authority. After implementation mark
`[~]` with the actual implemented timestamp. After its specified verification
passes mark `[x]` with the completed timestamp; update this header immediately.
Only `[x]` counts. Resume the first `[~]`, otherwise the first `[ ]`. A real blocker
is `[!]` with its reason. Timestamps come from the host clock. Do not duplicate
task checklists in another document. Spec-author tasks read only contracts/ST
packets and public interfaces, never implementation logic.

## Phases

| Phase | Objective                                                             | Tasks |
| ----- | --------------------------------------------------------------------- | ----- |
| 1     | Correct finite-component evidence without changing generated behavior | 7     |
| 2     | Prove, emit and qualify stock-chained NMI routes                      | 21    |

Total: 28 tasks, two phases. Each code/test unit targets 1–3 files and roughly
50–150 changed lines. Split any actual larger unit before execution; do not add
a broader framework or expand scope. Dependencies are Phase 1 → Phase 2; tasks
inside each step follow checklist order. Partial implementation remains behind
the old guard until the complete candidate path qualifies.

## Phase 1: finite-component evidence

> **Lenses**: compiler/language, concurrency, artifact compatibility, simplicity

### Step 1.1: Specification tests

Reference: [ST-1–ST-4](07-testing-strategy.md), AR-P3/AR-P7/AR-P12.

- [ ] 1.1.1 [spec-author] Write independent evidence specification cases — `test/rd05/nmi-stack-evidence.spec.test.ts`; ST-1–ST-4.
- [ ] 1.1.2 Capture directed RED and already-passing boundary justifications — phase review record `09-phase-review.md`; ST-1–ST-4.

Verify: `yarn vitest run test/rd05/nmi-stack-evidence.spec.test.ts --maxWorkers=1 --minWorkers=1` (expected RED; no implementation or broken commit).

### Step 1.2: Implementation

Reference: [stack evidence](03-stack-evidence.md), AR-P7/AR-P12.

- [ ] 1.2.1 Correct existing status/effects/reserve/component accounting — `packages/compiler/src/services/evidence.ts`; 03-stack-evidence.
- [ ] 1.2.2 Verify immutable evidence cases GREEN and retained warning/validator cases — `test/rd05/nmi-stack-evidence.spec.test.ts`; ST-1–ST-4.

Verify: directed evidence cases plus existing `test/rd04/selected-resource-evidence.spec.test.ts`, `test/rd04/diagnostics-resource-boundaries.spec.test.ts` and package evidence-validator tests; one worker.

### Step 1.3: Implementation tests and hardening

- [ ] 1.3.1 Add internal single-record/source/order/reserve arithmetic regressions and correct only obsolete reserve/capacity assertions in `packages/compiler/src/services/services.impl.test.ts` — `packages/compiler/src/services/nmi-stack-evidence.impl.test.ts`; 03-stack-evidence. Retain unrelated implementation assertions.
- [ ] 1.3.2 Run full checkpoint and independent read-only review; record exact evidence — `09-phase-review.md`; AR-P3 and quality profile.
- [ ] 1.3.3 Reconcile phase status/links/formatting, preserve frozen/oracle paths and create a green local checkpoint — `99-execution-plan.md`, `../../00-roadmap.md`; git-commit skill, no push.

Verify: frozen-lockfile install, build, typecheck, complete `yarn test`, touched-file formatting and independent correctness review. Fix only implementation defects; old specification oracles remain untouched.

## Phase 2: generated stock-chained route

> **Lenses**: compiler/language, concurrency, artifact compatibility, expert output, simplicity

### Step 2.1: Specification tests

Reference: [ST-5–ST-24](07-testing-strategy.md), AR-P11/AR-P12.

- [ ] 2.1.1 [spec-author] Write independent admission/provenance/lifetime cases — `test/rd05/nmi-route-admission.spec.test.ts`; ST-5–ST-15/ST-24.
- [ ] 2.1.2 [spec-author] Write independent final-byte/placement/ABI/resource expectations — `test/rd05/nmi-route-output.spec.test.ts`; ST-16–ST-19.
- [ ] 2.1.3 [spec-author] Apply only the approved old chained/diagnostic fixture corrections — `test/rd05/profile-interrupts.spec.test.ts`, `test/rd04/diagnostics-alternate-placement.spec.test.ts`; AR-P11/ST-5–ST-7.
- [ ] 2.1.4 [spec-author] Split only the approved chained/exclusive ledger probes and deferred rows; do not retire chained yet — `test/rd04/expressiveness-ledger.spec.test.ts`, `test/rd04/expressiveness-ledger.json`; AR-P11/ST-23.
- [ ] 2.1.5 Record RED per case plus pre-existing-pass reasons and runtime predictions — `09-phase-review.md`; ST-5–ST-24.

Verify: all five named specification files with one worker. Expected RED for new capability; exact unchanged negatives/fixtures audited. No broken RED commit or premature ledger qualification claim.

### Step 2.2: Implementation

Reference: [NMI route](03-nmi-route.md), AR-P7/AR-P10–AR-P12.

- [ ] 2.2.1 Materialize qualified chained candidates while preserving all remaining guards — `packages/compiler/src/semantic/whole-program.ts`; 03-nmi-route §Admission and ownership.
- [ ] 2.2.2 Close finite predecessor/observer context transitions for both sinks reached from NMI, including helpers, and concrete failure witnesses — `packages/compiler/src/semantic/interrupt-contexts.ts`, `packages/compiler/src/semantic/interrupt-ownership.ts`; 03-nmi-route §Publication and link proof/ST-13. Preserve ordinary IRQ-only behavior.
- [ ] 2.2.3 Allocate and consume the same proved finite link bindings — `packages/compiler/src/storage/inventory.ts`, `packages/compiler/src/machine/lower-platform.ts`, `packages/compiler/src/machine/lower.ts`; 03-nmi-route §Existing compiler seams and internal facts.
- [ ] 2.2.4 Enforce complete selected NMI private-storage closure and canonical source failures — `packages/compiler/src/storage/closure.ts`, `packages/compiler/src/services/services.ts`; 03-nmi-route §Existing compiler seams and internal facts.
- [ ] 2.2.5 Preserve exact finite IRQ facts alongside separately scoped NMI entry costs — `packages/compiler/src/storage/irq-stack.ts`, `packages/compiler/src/storage/closure.ts`; 03-nmi-route mixed-route accounting.
- [ ] 2.2.6 Emit coherent capture and high-byte-only publication/restoration — `packages/compiler/src/machine/lower-c64-interrupt.ts`; 03-nmi-route §Publication and link proof.
- [ ] 2.2.7 Construct demanded-save NMI entries from selected transitive clobber facts and propagate semantic placement onto the complete wrapper before entry adaptation — `packages/compiler/src/machine/lower.ts`, `packages/compiler/src/machine/lower-c64-interrupt.ts`; 03-nmi-route §ABI and placement.
- [ ] 2.2.8 Carry actual selected entry stack/publication facts before storage closure — `packages/compiler/src/machine/machine-types.ts`, `packages/compiler/src/storage/storage-types.ts`, `packages/compiler/src/machine/lower.ts`; 03-nmi-route §ABI and placement.
- [ ] 2.2.9 Honor complete source placement with low-$47 direct entries or required JMP adaptation — `packages/compiler/src/layout/c64-layout.ts`, `packages/compiler/src/layout/c64-layout-placement.ts`; 03-nmi-route §ABI and placement.
- [ ] 2.2.10 Verify immutable public check/build/byte cases GREEN — the four Phase 2 specification files other than the ledger suite; ST-5–ST-19/ST-24. ST-23 GREEN waits for 2.3.3; full A/X/Y construction also has the internal endpoint in 2.3.2.

Verify: directed immutable cases and retained IRQ/CIA/placement tests after each affected unit; the Phase 2 directed set other than ST-23 is GREEN before internal hardening. The intermediate deferred-ledger/build disagreement is not committed. No emitter/storage workaround, new source ban or old oracle edit outside AR-P11.

### Step 2.3: Implementation tests and hardening

- [ ] 2.3.1 Add internal equality/change/post-pop observer and word-wrap regressions — `packages/compiler/src/semantic/nmi-lifetime.impl.test.ts`; ST-10–ST-15.
- [ ] 2.3.2 Add selected-save/private-scratch and real placement/cost regressions; update only the obsolete implementation-tier NMI fixture — `packages/compiler/src/machine/nmi-entry.impl.test.ts`, `packages/compiler/src/machine/interrupt-domains.impl.test.ts`, `packages/compiler/src/layout/nmi-placement.impl.test.ts`; 03-nmi-route.
- [ ] 2.3.3 Run sequential four-profile genuine-source VICE and equivalent expert cost qualification, then retire only the approved chained ledger row and verify ST-23 GREEN — `09-phase-review.md`, `test/rd04/expressiveness-ledger.json`; ST-19–ST-23 and complete cost ledger. Record fresh generation/artifact/sidecar digests and compiler commit. File mandatory local-meet debt when applicable; no push.
- [ ] 2.3.4 Run full checkpoint and independent correctness/semantics review; audit exact AR-P11 exception and all untouched negatives — `09-phase-review.md`; AR-P3/AR-P11 and quality profile.
- [ ] 2.3.5 Write bounded closeout, deferral-expiry and immediate remaining RD-05 ownership — `08-closeout.md`, `00-index.md`, `../../00-roadmap.md`; no RD-05/DEF-7 closure.
- [ ] 2.3.6 Validate final docs/freeze/task counts and make the green local checkpoint — `99-execution-plan.md`; git-commit skill, no push.

Verify: install/build/typecheck/complete `yarn test`; touched-file formatting, raw
frozen-authority/spec-test integrity, exact AR-P11 inverse-diff checks and independent
reviews. Native source proofs must not be skipped or presented as silicon proof.

## Completion

All 28 verified tasks, immutable oracles, full checkpoints, independent reviews,
final measured costs and bounded closeout are required. Report limitations plainly.
Answer the mandatory deferral-expiry question and re-own anything whose rationale
expires. RD-05 remains Executing and DEF-7 open until their remaining obligations
are separately delivered. No new capability is claimed merely because this plan
or an analytical proof exists.
