# Bounded sprite-publication proof — execution

> **CodeOps Artifact Schema**: 1
> **Progress**: 8/8 tasks (100%)
> **Status**: Complete — bounded proof/poll checkpoint green; #168 continues
> **Created**: 2026-11-16 14:17
> **Reasoning**: high — source-selected hardware observation, finite proof and function-storage closure

## Entry gates

The [register](00-ambiguity-register.md) closes the user-approved bounded scope. The component's
feasibility argument and complete producer/consumer handoff must pass independent preflight before
implementation. New and frozen specification evidence precedes code. Broader analysis reopens the
reserved complexity gate; approval of this support scope is not permission to expand it.

## Phase 1 — bounded proof and anonymous consumer

> **Reasoning**: high — a hardware-publication exemption must be proved, identity-bound and fail closed

### Session 1 — independent specifications and RED

- [x] 1.1.1 Independently author the three new specification files in the testing strategy from ST-1–ST-12 and the component signatures; qualify adapters without implementation exposure. Complete; the independent author corrected the wide-read adapter before freeze, preserving both ordered byte reads and both captures.
- [x] 1.1.2 Run/freeze new oracles and reproduce parent ST-13/14 poll RED; record the exact feasibility/preflight clearance before code. New public suite: 8 meaningful RED / 24 conservative controls pass. Two unit suites are missing-module setup RED only. Parent nine-case RED is unchanged. See [verification evidence](08-verification.md); no production code existed at freeze.

### Session 2 — implementation and GREEN

- [x] 1.2.1 Implement the finite counter query in `sprite-publication-proof.ts`; verify the counter-interface assertions of ST-1–ST-5. Counter specifications 7/7 pass; targeted formatting and compiler reference build pass. Public poll cases remain expected RED until 1.2.3.
- [x] 1.2.2 Add asset-relative provenance, publication initialization and the optional identity-bound observer handoff in the helper and `byte-capture-observers.ts`; verify only the proof/observer-interface assertions of ST-6–ST-12, with default named/aggregate guards unchanged. Counter/eligibility and existing capture suites pass 57/57; compiler build and targeted formatting pass. Public seven-byte acceptance remains for the next task.
- [x] 1.2.3 Add anonymous comparison selection in the helper and combine its values in `lower-function.ts`; verify the complete public acceptance of ST-6–ST-14 and all frozen parent poll/VICE oracles GREEN, then measure the parent cost pin decrease. Public poll/forwarding 41/41, serialized parent VICE 5/5 and measured cost 1/1 pass. Canonical code 1,599→1,593; payload/ZP/twin unchanged. Poll is seven bytes / nine same-page nominal cycles with EOR; complete phase checkpoint remains pending.

### Session 3 — implementation controls, review and checkpoint

- [x] 1.3.1 Add implementation controls for finite convergence, stale identities, aliases, mirrors, width/flags/use counts and long inputs in existing tiers; run affected compiler/optimizer controls. After TP-001/PE-001/002 corrections, six directed compiler files pass 79/79 and public output/cost passes 42/42. Twenty hardening and two scale controls include firmware routing/CIA boundaries, generated IRQ mutation, named/aggregate barriers, stale decrement RHS, an 8,000-operation chain, a 600-root CFG and 500-predecessor joined-input visit bounds. Prior complete compiler run: 239 files / 3,985 passed / 2 skipped before those corrections; post-fix complete checkpoint remains the last task.
- [x] 1.3.2 Obtain independent correctness, semantics, SFA/ABI, target-platform, emitted-code and host-performance reviews in bounded waves; resolve/reverify findings without expanding AR-1. All six review lenses clear. TP-001 and PE-001/002 accepted under AR-P11/12, corrected, directed-verified and independently fix-reviewed; no observer waiver or broader engine. See [findings](05-findings.md).
- [x] 1.3.3 Run the impact-based host and complete phase checkpoint, record evidence/limits and deferral-expiry result, resume parent PF-001 tasks, sync derived roadmap and commit a coherent green checkpoint through the git-commit skill; never push. Install/build/typecheck, changed+host, `yarn test` and actual `yarn test:full` pass. Full gate exit zero: root host 246 files/5,153; serialized VICE 130 passed files + 1 skipped, 2,379 passed + 4 skipped tests, 5,101.66 s. Scoped deferral assessment and residual costs are in the verification record. Parent PF-001 is closed by this bounded delivery, not waived; local checkpoint commit follows immediately.

**Execution rule:** this checklist alone owns task progress. Mark implementation `[~]` immediately,
promote to `[x]` only after its directed verification passes, and update this header immediately.
Resume a pending `[~]` before another task. A blocked task is `[!]` with a reason. Do not duplicate
task checkboxes elsewhere or mark the parent issue complete from this support plan.

**Verify:** [testing strategy](07-testing-strategy.md#hardening-and-verification). Primary owns shell
and expensive verification. Reviewers are read-only; specification authors are implementation-blind.
