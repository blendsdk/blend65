# Execution plan: joystick and bundled C64 library

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-01 15:46 UTC
> **Progress**: 0/21 tasks (0%)
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

> **Phase baseline tree**: Record at execution start.
> **Lenses**: Compiler/language, API compatibility, source-input identity and installed-path safety.
> **Reference**: [Analysis inputs and ownership](03-joystick-library.md#analysis-inputs), AR-P1–AR-P4.

### Session 1.1: Specification tests

- [ ] 1.1.1 [spec-author] Write `test/rd05/bundled-input-library.spec.test.ts` from ST-1–ST-5.
- [ ] 1.1.2 [spec-author] Write `test/rd05/bundled-input-evidence.spec.test.ts` and `packages/language-server/src/bundled-input-library.spec.test.ts` from ST-6–ST-9.
- [ ] 1.1.3 Run the three named spec files and record valid RED in this plan; explain already-green profile/validation cases. Target: new phase-1 spec files and this plan's evidence.

**Verify:** Directed Vitest for the named files; fresh public declarations where necessary.
The package probe uses a detached tarball, not modified live checkout files. Failure must identify
the absent approved capability, not missing tools or a broken test setup.

### Session 1.2: Implementation

- [ ] 1.2.1 Factor the unchanged hash tuple into `packages/compiler/src/project/input-identity.ts` and reuse it in `project/snapshot.ts`; verify existing snapshot identity tests unchanged.
- [ ] 1.2.2 Add real documented constants in `packages/compiler/stdlib/c64/input.blend`, include `stdlib` in compiler `package.json`, and add fixed bounded preparation in `frontend/bundled-sources.ts`. Verify source grammar, packaged asset bytes and focused preparation behavior.
- [ ] 1.2.3 Integrate one preparation boundary and additive `AnalysisResult.inputs` in `frontend/service.ts`; clarify source-identity documentation in `project/types.ts`. Verify ST-1–ST-5/ST-7 through public analysis and unchanged source diagnostics.
- [ ] 1.2.4 Retain returned source inventory/hash at the existing `services/services.ts` check/build seam; verify ST-6/ST-8 and existing build/debug artifact validators without a schema change.
- [ ] 1.2.5 Use returned text/installed URI for bundled diagnostic locations in `packages/language-server/src/server.ts`; display installed-primary errors at the first related open user location or AR-P4's triggering/remaining-open-user fallback, preserve original primary/related evidence and aggregate before publication. Keep user-only overlays; verify ST-9's two source-ID orders, standalone library errors, close-triggered fallback, coexistence with normal errors and clearing, plus current LSP diagnostics.
- [ ] 1.2.6 Run all phase-1 spec files GREEN plus unchanged project-snapshot and import-boundary tests. Target: phase-1 specs and `test/import-boundary.spec.test.ts`; record evidence in this plan.

**Verify:** Task-directed tests and build/typecheck for touched packages. Dependent service/editor
cases may remain intentionally RED until their own integration task; do not commit that partial
tree. All three new files must be GREEN before Session 1.3. Fix implementation, not new oracles.

### Session 1.3: Implementation tests and checkpoint

- [ ] 1.3.1 Write `frontend/bundled-sources.impl.test.ts` and `packages/language-server/src/bundled-input-library.impl.test.ts` for bounded reads, immutable/repeated preparation controls, identity collisions and installed URI conversion; verify both directly.
- [ ] 1.3.2 Run AR-P6's complete checkpoint and required independent phase review; record evidence in this plan and `09-phase-review.md`, update the feature roadmap, and commit the green phase. No push.

**Verify:** `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`;
targeted formatting/links and frozen `spec/`/expert checks. Run emulator tests sequentially as usual.
Configured correctness review must clear critical/major findings; source-input security/API lenses
are included. No optimizer/performance claim is made by successful source bundling.

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
