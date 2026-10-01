# Execution plan: joystick and bundled C64 library

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-01 19:11 UTC
> **Progress**: 11/21 tasks (52%)
> **CodeOps Artifact Schema**: 1

## Implementation Phases

| Phase | Title | Tasks |
| --- | --- | --- |
| 1 | Real bundled source through existing analysis and distribution | 11 |
| 2 | Both-port joystick operations and qualification | 10 |

The phase checklists are the sole progress authority; each task appears once. Mark implemented
work `[~]` with the real timestamp, then verified work `[x]` with completion timestamp. Update
Progress and Last Updated immediately after each task; only `[x]` counts. Resume the first `[~]`,
otherwise the first `[ ]`; mark blockers `[!]` with `Blocked: reason` on that same line.
Each phase follows spec tests → valid RED → implementation → GREEN → implementation tests → full
verification. No implementation may precede its specification tests.

Commit coherent green checkpoints through git-commit without asking, never automatically push.
AGENTS.md effort handoffs still apply before each new named execution task unless the user grants
an explicit named-batch waiver. This plan's approved high-effort planning is not an execution waiver.
Record each phase's baseline tree and exact modification set when execution starts. Stop for any
new material ambiguity or support mechanism; log its next AR-P entry before expanding implementation.

## Phase 1: Real bundled source through existing analysis and distribution

> **Phase baseline tree**: `b593e6970797cec2919b183b77b6a9785706702d`
> **Scope mode**: strict; high effort is confirmed for Phase 1 tasks 1.1.2–1.3.2,
> with the user's explicit per-task effort-pause waiver for this named batch. Material gates remain.
> **Expected modification set**: `test/rd05/bundled-input-library.spec.test.ts`,
> `test/rd05/bundled-input-evidence.spec.test.ts`,
> `packages/language-server/src/bundled-input-library.spec.test.ts`,
> `packages/compiler/src/project/input-identity.ts`, `packages/compiler/src/project/snapshot.ts`,
> `packages/compiler/stdlib/c64/input.blend`, `packages/compiler/package.json`,
> `packages/compiler/src/frontend/bundled-sources.ts`, `packages/compiler/src/frontend/service.ts`,
> `packages/compiler/src/frontend/declaration-order.ts` (bounded pre-existing duplicate-order repair),
> `packages/compiler/src/project/types.ts`, `packages/compiler/src/services/services.ts`,
> `packages/language-server/src/server.ts`,
> `packages/compiler/src/frontend/bundled-sources.impl.test.ts`,
> `packages/language-server/src/bundled-input-library.impl.test.ts`,
> `test/rd04/shared-storage.impl.test.ts` (bounded padded-image host-wait repair),
> this plan's `00-ambiguity-register.md` (mandatory runtime gate bookkeeping), `00-index.md`,
> `99-execution-plan.md`, `09-phase-review.md`, and the feature roadmap.
> **Lenses**: Compiler/language, API compatibility, source-input identity and installed-path safety.
> **Reference**: [Analysis inputs and ownership](03-joystick-library.md#analysis-inputs), AR-P1–AR-P4.

### Session 1.1: Specification tests

- [x] 1.1.1 [spec-author] Write `test/rd05/bundled-input-library.spec.test.ts` from ST-1–ST-5. ✅ (completed: 2026-10-01 16:55 UTC; valid RED, type safety and formatting verified)
- [x] 1.1.2 [spec-author] Write `test/rd05/bundled-input-evidence.spec.test.ts` and `packages/language-server/src/bundled-input-library.spec.test.ts` from ST-6–ST-9. ✅ (completed: 2026-10-01 17:47 UTC; 10 valid assertion RED, strict types and formatting pass)
- [x] 1.1.3 Run the three named spec files and record valid RED in this plan; explain already-green profile/validation cases. Target: new phase-1 spec files and this plan's evidence. ✅ (completed: 2026-10-01 17:49 UTC; 24 tests, 23 assertion RED and 1 justified existing-validation GREEN)

**Verify:** Directed Vitest for the named files; fresh public declarations where necessary.
The package probe uses a detached tarball, not modified live checkout files. Failure must identify
the absent approved capability, not missing tools or a broken test setup.

Execution entry on 2026-10-01: all seven planning blobs match the passing preflight, AR-P1–AR-P8
are resolved, the checklist preserves specification-first ordering, and frozen authority is clean.
Baseline/status entries are execution bookkeeping, not a change to the passed feature contract.
Expected RED specification files remain uncommitted until a coherent green checkpoint.

Task 1.1.1 authoring evidence (2026-10-01): a fresh implementation-blind specification author wrote
only the owned new file. It read contract excerpts, existing public fixtures and generated type
declarations, not actual compiler implementation logic. A planned ownership/output table was exposed
and disclosed; it supplied no implementation logic for ST-1–ST-5. The parent checked contract coverage,
source boundaries and the completed read audit. The current oracle's Git blob is
`45db89094093a4c7087a802b53832f9c135c00c7`.

| Cases | Final directed result | Proving reason |
| --- | --- | --- |
| ST-1: four profiles × imported/qualified forms | 8 RED | Real source masks are absent; complete analysis is rejected with E10012 (qualified uses also expose E10239). |
| ST-2: sync/async/compiler/overlay agreement | 1 RED | The absent source mask prevents complete analysis; the oracle retains later input/hash and non-mutation checks. |
| ST-3: duplicate and ordinary merge | 2 RED | Duplicate incorrectly completes without a library conflict; ordinary merge lacks the library masks. |
| ST-4: repeated identity collisions and reordered sources | 1 RED | The library mask is absent; the oracle retains exact user IDs, triple-`@` library identity and deterministic inventory/hash checks. |
| ST-5: neutral input and unknown-profile control | 1 RED, 1 GREEN | Neutral analysis completes but lacks consumed-input metadata; existing E10279 rejection is the justified green regression control. |

Final public-API Vitest run: 14 tests, 13 expected assertion failures, 1 pass; no collection/setup,
tool or timeout failure qualifies as RED. An initial Vitest `import.meta.resolve` collection failure
was repaired using Node's public package resolver and excluded from this evidence. An unsupported
assumption that parsed spans begin at the export modifier was removed before oracle freeze; normal
declaration text, exported visibility and exact values/types/installed bytes remain required.
Fresh compiler declarations build, isolated strict TypeScript check, targeted formatting and
documentation-ban check pass. No compiler or existing test changed; frozen specification/expert
authority remains clean. This verifies the authoring task, not the missing feature's implementation.
Final evidence is captured in `/tmp/blend65-bundled-input-spec.pbJPiW/final-vitest.json` and
`final-vitest.log`; the full three-file RED gate remains task 1.1.3.

Task 1.1.2 authoring evidence: the same implementation-blind author supplied five installed-package
cases and five real-stdio editor cases. Frozen blobs are `35d61b218d8170955c8ee66cbea0b9744844e0b3`
(evidence) and `cd7c7a3066566e37aa44b488fabf47e4a791b29b` (editor). All ten cases fail ordinary
feature assertions; strict isolated types and formatting pass. Detached server dependencies were
copied from installed package manifests after two setup failures; those initial failures are excluded.
The malformed-initializer parser code/message/span comes from the already-approved frontend syntax
contract, not implementation logic. A documentation-ban authoring self-check preceded the implemented
mark; qualification began only after it. No production or existing oracle changed.

Task 1.1.3 final gate: root files 19 cases (18 assertion RED, 1 existing E10279 control GREEN),
editor 5 cases (all assertion RED); no setup, tool, collection or timeout failure. All three frozen
oracle blobs above remain unchanged. Evidence: `/tmp/blend65-bundled-phase1.0gQxfT/gate-root-red.json`
and `gate-lsp-red.json`. Production implementation starts only after this valid gate.

Task 1.2.3 scope attribution: the real library exposed an existing constant-order defect.
`declaration-order.ts` built its qualified dependency map from rejected duplicate declarations,
whereas the resolver's bindings keep the accepted declaration. Use the already-existing bound
constant map as the qualified map's input; no new analyzer, pass or support surface. This is
required by ST-3 and Chapter 14 §2.1 cascade suppression, not a changed source restriction or
oracle. The additional production path is explicitly included in the phase modification set.

### Session 1.2: Implementation

- [x] 1.2.1 Factor the unchanged hash tuple into `packages/compiler/src/project/input-identity.ts` and reuse it in `project/snapshot.ts`; verify existing snapshot identity tests unchanged. ✅ (completed: 2026-10-01 17:49 UTC; 36 unchanged snapshot/host/race tests, build and formatting pass)
- [x] 1.2.2 Add real documented constants in `packages/compiler/stdlib/c64/input.blend`, include `stdlib` in compiler `package.json`, and add fixed bounded preparation in `frontend/bundled-sources.ts`. Verify source grammar, packaged asset bytes and focused preparation behavior. ✅ (completed: 2026-10-01 17:51 UTC; real grammar, immutable repeated preparation, exact tarball bytes, build and formatting pass)
- [x] 1.2.3 Integrate one preparation boundary and additive `AnalysisResult.inputs` in `frontend/service.ts`; clarify source-identity documentation in `project/types.ts`. Verify ST-1–ST-5/ST-7 through public analysis and unchanged source diagnostics. ✅ (completed: 2026-10-01 17:57 UTC; 13 library cases, 3 package-fault cases and 74 unchanged frontend/module/constant controls pass; dependent service-hash cases await 1.2.4)
- [x] 1.2.4 Retain returned source inventory/hash at the existing `services/services.ts` check/build seam; verify ST-6/ST-8 and existing build/debug artifact validators without a schema change. ✅ (completed: 2026-10-01 18:10 UTC; 19 new cases GREEN, 41 unchanged service/artifact controls pass; exact AR-P9 correction only)
- [x] 1.2.5 Use returned text/installed URI for bundled diagnostic locations in `packages/language-server/src/server.ts`; display installed-primary errors at the first related open user location or AR-P4's triggering/remaining-open-user fallback, preserve original primary/related evidence and aggregate before publication. Keep user-only overlays; verify ST-9's two source-ID orders, standalone library errors, close-triggered fallback, coexistence with normal errors and clearing, plus current LSP diagnostics. ✅ (completed: 2026-10-01 18:15 UTC; all 19 editor cases pass, including 5 new immutable oracles; build and typecheck pass)
- [x] 1.2.6 Run all phase-1 spec files GREEN plus unchanged project-snapshot and import-boundary tests. Target: phase-1 specs and `test/import-boundary.spec.test.ts`; record evidence in this plan. ✅ (completed: 2026-10-01 18:18 UTC; all 24 phase-1 oracles GREEN, 36 root boundary cases and 36 snapshot/host/race controls pass; all frozen identities match)

**Verify:** Task-directed tests and build/typecheck for touched packages. Dependent service/editor
cases may remain intentionally RED until their own integration task; do not commit that partial
tree. All three new files must be GREEN before Session 1.3. Fix implementation, not new oracles.

AR-P9 correction evidence: the user explicitly approved the constant-only filter, with all fixtures
and assertions preserved. Corrected frozen evidence blob: `1b15b8b35699434bc5bce08e6fb3402101ad02ce`.
The other two oracle identities are unchanged. Public frontend/check/build hashes agree, relocation
is portable, changed installed bytes change the compiler hash, and actual tarball assets and both
sidecar schemas contain exact consumed library byte lengths/hashes. No artifact schema changed.
Evidence: `/tmp/blend65-bundled-phase1.0gQxfT/corrected-evidence-green.log`.

### Session 1.3: Implementation tests and checkpoint

Checkpoint attribution: the first full run passed 3,148 tests but two existing padded-image
shared-storage cases exceeded their 50-second VICE host wait. An unchanged directed retry repeated
two timeouts while host load was about 25. All three padded PRGs built with the pre-phase compiler
at `bb753d63` and the current compiler are byte-identical (50,940/50,941/50,946 bytes), so this is
not an output regression. Extend only these implementation cases' finite host wait to 90 seconds
and outer test budget to 100 seconds. Small-image waits remain 50/60 seconds; checkpoint addresses,
cycle limits, runtime assertions and all specification tests remain unchanged. This necessary
verification-fixture repair is explicitly in the modification set, not a new compiler capability
or support surface. Evidence: `padding-output-comparison.log` and `shared-storage-retry.log` in
the phase scratch directory. The complete checkpoint must pass after this repair.

- [x] 1.3.1 Write `frontend/bundled-sources.impl.test.ts` and `packages/language-server/src/bundled-input-library.impl.test.ts` for bounded reads, immutable/repeated preparation controls, identity collisions and installed URI conversion; verify both directly. ✅ (completed: 2026-10-01 18:33 UTC; 12 compiler and 2 editor implementation cases pass; strict types and formatting pass)
- [x] 1.3.2 Run AR-P6's complete checkpoint and required independent phase review; record evidence in this plan and `09-phase-review.md`, update the feature roadmap, and commit the green phase. No push. ✅ (completed: 2026-10-01 19:11 UTC; install/build/typecheck and all 3,150 tests pass; independent review has no findings; phase records and local green checkpoint complete)

**Verify:** `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`;
targeted formatting/links and frozen `spec/`/expert checks. Run emulator tests sequentially as usual.
Configured correctness review must clear critical/major findings; source-input security/API lenses
are included. No optimizer/performance claim is made by successful source bundling.

Phase 1 checkpoint: 11/11 verified. The complete retry passes all 3,150 tests with two unchanged
native-host skips; the independent correctness reviewer reports no findings through all assigned
lenses and independently verifies the exact AR-P9 oracle correction. Touched-code/config formatting,
local Markdown links/anchors, task/source identities, diff checks and frozen-authority checks pass.
See [phase review](09-phase-review.md) for the bounded host-wait repair, binary comparison and
qualification limits. Phase 2 remains unstarted; no new joystick operation, callable migration,
optimizer or runtime input system is claimed. The Phase 1 named-batch effort waiver is fulfilled.

## Phase 2: Both-port joystick operations and qualification

> **Phase baseline tree**: Record at execution start after phase-1 verification.
> **Lenses**: Compiler/language, volatile hardware effects, interrupt coexistence and expert output cost.
> **Reference**: [Source/output contracts](03-joystick-library.md#source-and-hardware-contracts), AR-P3/AR-P5–AR-P8.

### Session 2.1: Specification tests

- [ ] 2.1.1 [spec-author] Write `test/rd05/joystick-api-output.spec.test.ts` from ST-10–ST-12/ST-16–ST-18; derive independent bytes, behavior and complete-cost expectations.
- [ ] 2.1.2 [spec-author] Write `test/rd05/joystick-vice.spec.test.ts` from ST-13–ST-15 using existing bounded sequential VICE utilities and explicit fixture-state ownership; add AR-P6's port-1 injection method in `test/m1/vice-monitor.ts` and opt-in `-controlport1device 37` activation in `test/m1/vice-runtime.ts`, preserving port-2 behavior and existing startup defaults. Prove active-device selection and both port identities/polarity through compiled samples.
- [ ] 2.1.3 Run both named files and record valid RED in this plan, explaining existing port-2/predicate/validation passes; no absent tool, setup or timeout counts as RED.

**Verify:** Directed Vitest and existing ACME/VICE tools. Specification authors are implementation
blind; fixture utilities are allowed. Existing passing capabilities are regression controls, not
permission to weaken new port-1/up/down expectations.

### Session 2.2: Implementation

- [ ] 2.2.1 Add AR-P3 declarations in `frontend/profile.ts` and the named port-1 fact in `target/c64-kernal.ts`; verify new API/signature cases.
- [ ] 2.2.2 Apply only AR-P8's exact additions to `frontend/profile.spec.test.ts` and `profile-constants.spec.test.ts`; verify both unchanged inventories plus the three rows.
- [ ] 2.2.3 Extend direct selection in `machine/lower-c64.ts`, remove the redundant port-2 transfer and admit both joystick read producers in `lower-register-forwarding.ts` through its existing sole-use, adjacent same-block byte/fixed-store guards. Preserve CIA exclusions and all negative guards; verify both-port output/resource/effect oracles without introducing an optimization pass.
- [ ] 2.2.4 Verify GREEN for ST-10–ST-18 and both inventory files; run four-profile VICE cases sequentially and inspect assembled complete costs. Target: new phase-2 specs, inventories and this plan's evidence.

**Verify:** Directed tests, fresh compiler declarations/artifacts, operation-window traces and
independent costs. Fix below-floor output before closeout; stop if a larger mechanism is required.
No new runtime storage after SFA closure, hidden keyboard scan or new IRQ/port-state analyzer.

### Session 2.3: Implementation tests and closeout

- [ ] 2.3.1 Write `machine/joystick.impl.test.ts` for exact masks/effects/result retention and negative forwarding guards; adapt only the obsolete port-2 forwarding assertion in `machine/vic-collision.impl.test.ts`, preserving its CIA exclusion and existing negative guards; update `frontend/profile-constants.impl.test.ts` binding count 62→65 and function/constant boundaries 37→40. Verify all three directly; source masks remain ordinary, not synthetic profile constants.
- [ ] 2.3.2 Run AR-P6's full checkpoint and independent phase review; record bounded runtime/output/resource evidence and explicit AR-P8 review exception in `09-phase-review.md`. All critical/major findings must be resolved.
- [ ] 2.3.3 Write `08-closeout.md` and durable `docs/platform-libraries.md`; answer deferral expiry and conditional final-RD/skill follow-ups under AR-P7, preserve remaining RD-05 owners, update the feature roadmap and commit the green pilot. No push.

**Verify:** Full project checkpoint as in phase 1; then impact-based document/link/format checks for
closeout-only edits. Use configured semantic/performance review when the changed paths require it.
If output only meets locally, file the exact measured path-to-beat issue as durably authorized by
AGENTS.md; this does not authorize a repository push or a below-floor capability.

## Dependencies and success

Phase 2 depends on verified phase 1. Within each phase, sessions run in listed order; implementation
tests follow GREEN. Reuse existing test utilities; a necessary small fixture extension must stay
within the same stated contract and be recorded in the phase modification set, not become a new harness.

Success is all 21 tasks verified, unchanged frozen authority, cleared independent review, real
outside-checkout library availability and the bounded joystick evidence. RD-05 remains Executing.
Callable-helper migration, combined keyboard policy and RD-10 release proof are not disguised
completion conditions or delivered capabilities of this pilot.
