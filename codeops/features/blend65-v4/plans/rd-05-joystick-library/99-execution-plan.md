# Execution plan: joystick and bundled C64 library

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-02 07:54 UTC
> **Progress**: 21/21 tasks (100%)
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

> **Phase baseline tree**: `d8bf67fbc1c5a1761bb211c3b7f8659f4a987c7e`
> **Scope mode**: strict; high effort is confirmed for task 2.1.1 and the remaining named batch
> 2.1.2–2.3.3. The user explicitly answered “Yes, waive for 2.1.2->END” to that batch's
> effort-pause question on 2026-10-01. State recommendations without repeated effort stops;
> material authority gates remain. Commit only at coherent green checkpoints; never push.
> **Expected modification set**: `test/rd05/joystick-api-output.spec.test.ts`,
> `test/rd05/joystick-vice.spec.test.ts`, `test/m1/vice-monitor.ts`,
> `test/m1/vice-runtime.ts`, `packages/compiler/src/frontend/profile.ts`,
> `packages/compiler/src/target/c64-kernal.ts`,
> `packages/compiler/src/frontend/profile.spec.test.ts`,
> `packages/compiler/src/frontend/profile-constants.spec.test.ts` (only the exact AR-P8 exception),
> `packages/compiler/src/machine/lower-c64.ts`,
> `packages/compiler/src/machine/lower-register-forwarding.ts`,
> `packages/compiler/src/machine/joystick.impl.test.ts`,
> `packages/compiler/src/machine/vic-collision.impl.test.ts`,
> `packages/compiler/src/frontend/profile-constants.impl.test.ts`,
> `docs/platform-libraries.md`, this plan's `00-ambiguity-register.md` (runtime gates only),
> `00-index.md`, `01-requirements.md`, `03-joystick-library.md`, `07-testing-strategy.md`,
> `00-preflight-report.md` (runtime amendment attribution only), `99-execution-plan.md`, `08-closeout.md`, `09-phase-review.md`,
> and the feature roadmap. No frozen authority, new framework or portfolio write.
> **Lenses**: Compiler/language, volatile hardware effects, interrupt coexistence and expert output cost.
> **Reference**: [Source/output contracts](03-joystick-library.md#source-and-hardware-contracts), AR-P3/AR-P5–AR-P8.

### Session 2.1: Specification tests

- [x] 2.1.1 [spec-author] Write `test/rd05/joystick-api-output.spec.test.ts` from ST-10–ST-12/ST-16–ST-18; derive independent bytes, behavior and complete-cost expectations. ✅ (completed: 2026-10-01 20:40 UTC; 220 cases, 160 valid assertion RED and 60 existing-behavior GREEN; owned types and formatting verified)
- [x] 2.1.2 [spec-author] Write `test/rd05/joystick-vice.spec.test.ts` from ST-13–ST-15 using existing bounded sequential VICE utilities and explicit fixture-state ownership; add AR-P6's port-1 injection method in `test/m1/vice-monitor.ts` and opt-in `-controlport1device 37` activation in `test/m1/vice-runtime.ts`, preserving port-2 behavior and existing startup defaults. Prove active-device selection and both port identities/polarity through compiled samples. ✅ (completed: 2026-10-01 21:19 UTC; 32 cases, 8 four-profile setup controls GREEN and 24 valid missing-capability RED; strict types, formatting and documentation self-check pass)
- [x] 2.1.3 Run both named files and record valid RED in this plan, explaining existing port-2/predicate/validation passes; no absent tool, setup or timeout counts as RED. ✅ (completed: 2026-10-01 21:23 UTC; combined 252 cases: 184 valid feature/output RED, 68 justified GREEN; no setup/timeout failure; frozen identities unchanged)

**Verify:** Directed Vitest and existing ACME/VICE tools. Specification authors are implementation
blind; fixture utilities are allowed. Existing passing capabilities are regression controls, not
permission to weaken new port-1/up/down expectations.

### Session 2.2: Implementation

Task 2.1.1 authoring evidence: the original implementation-blind author supplied the complete
draft before behavioral verification. A server restart followed the first completed run; a fresh
implementation-blind author recovered only that file. Before oracle freeze, unsupported fixture
assumptions were corrected: main is located by authored source/declaration spans rather than
unspecified qualified-name formatting; resource totals and SFA are checked against final physical
memory/stack evidence rather than optional duplicate cost dimensions. These corrections change
no byte, cycle, Boolean or MMIO expectation.

The original frozen oracle blob is `0fa623d4d4192608b070b353d6ad629b1161e853`
(SHA-256 `0183a3adfbdc97e9d491406387d9e5c6930831a3b09575971609e9d5b38db749`).
The user's exact AR-P10 fixture correction produces frozen blob
`fea1b92b5a92961ca32c87631e8323592bb78eb7`
(SHA-256 `1006802dba4a1b574a9f1875ed600a7ccc9b3167dcbf81fa84b0e2c4d3ecf071`).
A read-only inverse-patch proof reproduces the original blob exactly; no behavior or cost
expectation changed.
The final directed run has 220 cases: 160 genuine feature/output assertion RED and 60 GREEN
controls. Missing port-1/up/down imports qualify RED; rejected programs make no runtime claim.
Existing port-2 read output, saved-byte branch output and escaping Boolean output also fail the
independently derived expert floor; those expectations remain fixed. Existing argument checks,
unknown-export rejection, all six immediate masks and neutral unused imports are GREEN controls.
The retained two-store sample requires the expert's 9 bytes/12 cycles before the common RTS and
zero stable storage; if the approved bounded seam cannot meet it, implementation must stop for
the exact required authority, not weaken this oracle or introduce an optimizer silently.

No setup, collection, timeout or unavailable tool counts as RED. Evidence:
`/tmp/blend65-joystick-phase2.Lkb8GS/api-output-recovery-red.json` and its log.
Prettier and the documentation self-check pass. Isolated strict TypeScript has no owned-file
diagnostics; its 14 TS7006 diagnostics belong to the unchanged external VICE monitor fixture.
The existing package typecheck passes, but does not claim strict root-fixture coverage.
Both authors' read audits report no forbidden implementation, existing oracle or golden access.
No production or existing test changed. The full two-file RED gate remains task 2.1.3.
Runtime gate AR-P10 is resolved by the user's exact approval. The two stopped-PC comparisons and
unused completion-ID binding alone changed; all behavior and expert floors stay fixed. The new
physical-input oracle is now frozen after its setup controls and valid RED pass.

Task 2.1.2 authoring evidence: the implementation-blind recovery author owns only the new runtime
file; the parent owns the two allowed external-tool fixtures. Before freeze, controls corrected
unsupported stopped-ID and simulation-upper-bit assumptions. Pinned VICE device 37 returns the
five-bit stimulus with upper bits low; disconnected devices return released pins. Eight compiled
raw-peek controls pass across four profiles: both simulated ports/indexes/polarities and all 32
switch combinations, plus disconnected-port upper bits, known latch/DDRs, shared-line interference
and both caller interrupt states. Each operation window has exactly the expected port reads and
preserves interrupt/decimal state. Tool/model/PRG/ROM identities are retained in the log; this is
VICE-verified / hardware-unverified setup proof, not yet joystick-feature runtime proof.

The existing startup helper keeps omitted first-port selection and second-port device 37 unchanged.
New explicit false flags select disconnected devices only for fixtures that own them. The same
bounded monitor command serves either port with unchanged port-2 wire values and validation.
Explicit contextual typing also repairs 14 pre-existing TS7006 fixture diagnostics without changing
runtime behavior or compiler options. Both new files and fixtures now pass isolated strict typing.

The physical-input frozen blob is `ceacfdb9c3c69aa2036f0a5adea675c408883e52`; SHA-256 is
`5e01dcf869c96580b8a29fa29c3888a2855e39c8f2bfbd518789d368a5bb0afd`.
The final directed run has 32 cases: 8 GREEN setup controls and 24 ordinary missing-import RED.
Earlier stop-ID and simulation-pin setup failures are excluded, not feature failures.
Evidence: `/tmp/blend65-joystick-phase2.Lkb8GS/joystick-vice-controls-final.json`,
`joystick-vice-final-red.json`, corresponding identity-retaining logs, `phase2-spec-types.log`
and `phase2-spec-format.log`. The parent read the whole new file and checked durable fixture docs,
no unsafe casts and no ephemeral code-comment references. No production code changed.
The author's final read audit confirms only allowed authority, public declarations, fixtures and
its own file/artifacts were read; no forbidden implementation or existing oracle was accessed.

Task 2.1.3 RED gate: the fresh combined sequential run reproduces both authoring results exactly:
220 API/output cases (160 RED, 60 GREEN) and 32 runtime cases (24 RED, 8 GREEN). The 184 valid RED
include 132 assertion mismatches and 52 explicit public-build rejections containing only E10012
missing-export diagnostics; those are absent capability, not tool/setup errors. Existing arity/type
checks, unknown-export rejection, source-mask immediate folding/unused neutrality and the eight
independently proved VICE controls explain all 68 GREEN. Both frozen blobs remain unchanged.
Evidence: `/tmp/blend65-joystick-phase2.Lkb8GS/phase2-red-gate.json` and `.log`. Strict types,
formatting, local links, documentation self-check, diff and frozen-authority checks pass.

- [x] 2.2.1 Add AR-P3 declarations in `frontend/profile.ts` and the named port-1 fact in `target/c64-kernal.ts`; verify new API/signature cases. ✅ (completed: 2026-10-01 22:17 UTC; 56 four-profile API/signature/argument/error cases pass; fresh build, 39 target-profile controls, strict types and formatting pass; exact AR-P11 correction only)
- [x] 2.2.2 Apply only AR-P8's exact additions to `frontend/profile.spec.test.ts` and `profile-constants.spec.test.ts`; verify both unchanged inventories plus the three rows. ✅ (completed: 2026-10-01 22:19 UTC; 55 inventory/behavior cases pass; only three rows and the approved title differ; formatting and documentation self-check pass)
- [x] 2.2.3 Extend direct selection in `machine/lower-c64.ts`, remove the redundant port-2 transfer and admit both joystick read producers in `lower-register-forwarding.ts` through its existing sole-use, adjacent same-block byte/fixed-store guards. Preserve CIA exclusions and all negative guards; verify both-port output/resource/effect oracles under approved AR-P12's pilot-only canonical acceptance and exact test correction, without introducing an optimization pass. ✅ (completed: 2026-10-02 06:50 UTC; all 124 directed output cases and nine unchanged seam controls pass; strict types, formatting, 78 links and exact outside-region oracle proof pass).
- [x] 2.2.4 Verify GREEN for ST-10–ST-18 and both inventory files; run four-profile VICE cases sequentially and inspect assembled complete costs. Target: new phase-2 specs, inventories and this plan's evidence. ✅ (completed: 2026-10-02 07:00 UTC; all 252 source/output/runtime cases and 55 inventory cases pass; frozen oracle identities and complete physical accounting verified).

**Verify:** Directed tests, fresh compiler declarations/artifacts, operation-window traces and
independent costs. Exact direct-operation floors remain; approved AR-P12 assigns general local/
condition/layout deltas to RD-08. Stop if a larger mechanism is required.
No new runtime storage after SFA closure, hidden keyboard scan or new IRQ/port-state analyzer.

Task 2.2.1 completion: AR-P11's user-approved lookup-only correction has frozen blob
`537e0d4d10db5b7937ee70da11db9ef54ab8f03a`, SHA-256
`e69bb863a743144398355f92f738844b4bb11a4bbc1938216d243efb5519904a`.
The inverse-block proof reproduces prior blob `fea1b92b5a92961ca32c87631e8323592bb78eb7` exactly.
All 56 API/signature/error cases now pass; 164 downstream output/runtime cases were intentionally
excluded from this API-only run, not claimed GREEN. The 39 unchanged target-profile controls and
fresh compiler build pass. Strict types, formatting and documentation self-check pass. Evidence:
`/tmp/blend65-joystick-phase2.Lkb8GS/approved-signatures-green.log`,
`approved-signature-types.log`, `api-declarations-build.log` and `target-profiles-green.log`.

Task 2.2.2 ownership clarification: AR-P8 explicitly names the two exhaustive frontend API
inventories. The expected modification set's accidental root `test/rd05/profile-constants` path
is corrected to that already-approved frontend inventory. The root file is a different profile
constant behavior suite, has no operation inventory or thirty-seven title, and remains untouched.
This is a plan-path correction, not additional oracle authority.
Both frontend inventories pass all 55 cases. The reviewed diff contains only the three approved
operation rows in each inventory and the thirty-seven→forty title. Existing rows, source fixtures,
behavior assertions and the root profile-constant suite remain unchanged. Evidence:
`/tmp/blend65-joystick-phase2.Lkb8GS/inventories-green.log` and `inventories-format.log`.

Task 2.2.3 bounded verification: fresh compiler build, touched-code formatting and nine existing
machine controls pass. The API/output run is 96 pass/124 fail; all new capability admission,
saved-byte semantics and ordered-read behavior pass, but retained-local/predicate output floors
and function-owned numeric cycle expectations exceed the authorized two-file seam. All 32
physical-input cases pass sequentially across the four profiles. The independent simplicity
challenger recommends keeping general optimizer/report work outside this pilot. AR-P12 owns the
required direct acceptance/test-authority decision. Neither frozen oracle has changed beyond
the already-approved AR-P10/AR-P11 corrections, and no extra mechanism is implemented.
Evidence: `joystick-authorized-seam.json`, `joystick-seam-controls.log`,
`joystick-seam-measurements.log` and `joystick-narrow-runtime.json` in the phase scratch directory.
Task 2.2.3 remains unverified; the task count stays 16/21. No green Phase 2 commit is claimed.

Task 2.2.3 resumed completion: the user directly approved AR-P12's sole pending staging packet.
Only its cycle-helper and two output-cost regions changed. A read-only byte comparison against
frozen blob `537e0d4d10db5b7937ee70da11db9ef54ab8f03a` proves every byte outside those regions
is unchanged. Corrected frozen blob: `e43cc234a0d5a0f69d825cce56c09d672bd89492`.
The physical-input blob remains `ceacfdb9c3c69aa2036f0a5adea675c408883e52`. No source fixture,
semantic/runtime block, direct-operation floor or immutable authority changed. The 124 selected
output cases pass; 96 other cases were deliberately excluded here, not claimed passed. Nine
unchanged machine controls, isolated strict types, touched formatting, documentation self-check,
78 local links/anchors and frozen-authority checks pass. The initial isolated type command's
missing `--ignoreConfig` was a tool-invocation error, excluded from feature evidence; the corrected
strict invocation passes. Full source/runtime qualification is the next task.
Measured expert comparisons retain 12-byte/15-cycle/zero-SFA retained-main, 15-byte/17-worst-cycle/
zero-SFA branch and 16-byte/19-worst-cycle/zero-SFA escaping targets. Each includes the equal-contract
three-byte/three-cycle restoration transfer. Existing canonical deltas are explicit RD-08 input,
not new accepted goldens or optimized/game-grade qualification. No optimizer or reporter was added.
Evidence: `ar12-output-green.json`, `ar12-seam-controls.log`, `ar12-spec-types.log`,
`ar12-format-check.log`, `ar12-links.log` and `ar12-plan-check.json` in the phase scratch directory.

### Session 2.3: Implementation tests and closeout

Task 2.2.4 complete gate: all 220 API/output cases and 32 sequential physical-input cases pass
across all four profiles. Both unchanged inventories plus AR-P8's exact additions pass all 55
cases. The frozen API/output and physical-input identities match the approved blobs above.
Complete program/resource accounting remains active; assembled nominal cycle bounds include
actual branch page penalties and the equal-contract restoration transfer. Public whole-program
unknown cycles remain unknown, not zero. Retained-local/condition/layout expert targets remain
RD-08-owned under AR-P12; this is canonical pilot qualification, not optimized/game-grade proof.
Strict types, formatting and documentation checks from 2.2.3 remain valid with no subsequent
code change; diff and frozen-authority checks pass. Evidence: `phase2-spec-green.json`,
`phase2-spec-green.log` and `phase2-inventories-green.log` in the phase scratch directory.
Status: VICE-verified / hardware-unverified. Implementation tests may now begin.

- [x] 2.3.1 Write `machine/joystick.impl.test.ts` for exact masks/effects/result retention and negative forwarding guards; adapt only the obsolete port-2 forwarding assertion in `machine/vic-collision.impl.test.ts`, preserving its CIA exclusion and existing negative guards; update `frontend/profile-constants.impl.test.ts` binding count 62→65 and function/constant boundaries 37→40. Verify all three directly; source masks remain ordinary, not synthetic profile constants. ✅ (completed: 2026-10-02 07:06 UTC; 55 directed implementation cases, fresh build/typecheck, formatting and documentation self-check pass).
- [x] 2.3.2 Run AR-P6's full checkpoint and independent phase review; record bounded runtime/output/resource evidence and explicit AR-P8 review exception in `09-phase-review.md`. All critical/major findings must be resolved. ✅ (completed: 2026-10-02 07:34 UTC; install/build/typecheck and all 3,421 tests pass; two independent reviews clear the implementation; mandatory oracle-edit finding has its exact prior user ruling recorded).
- [x] 2.3.3 Write `08-closeout.md` and durable `docs/platform-libraries.md`; answer deferral expiry and conditional final-RD/skill follow-ups under AR-P7, preserve remaining RD-05 owners, update the feature roadmap and commit the green pilot. No automatic push; the separate single safekeeping request in the index remains authorized. ✅ (completed: 2026-10-02 07:54 UTC; exact guide source builds on four profiles, final 91 links and roadmap counters pass; final document review has no new findings; green checkpoint prepared for commit).

**Verify:** Full project checkpoint as in phase 1; then impact-based document/link/format checks for
closeout-only edits. Use configured semantic/performance review when the changed paths require it.
If output only meets locally, file the exact measured path-to-beat issue as durably authorized by
AGENTS.md; this does not authorize a repository push or a below-floor capability.

Task 2.3.1: 19 new joystick implementation cases, 17 preserved collision cases and 19 profile
internal cases pass. Both port loads have exact volatile effects, A/N/Z results and 3-byte/4-cycle
cost. All five saved-byte predicates select the exact AND mask and active-low zero condition with
no extra hardware read. Stable storage retains a first-port sample across a second-port read.
Dynamic addresses, multiple uses, word/different-value stores, intervening reads and cross-block
consumers are excluded from forwarding. The existing CIA exclusion and all collision negatives
remain. Synthetic bindings contain 40 functions and 25 facts; all six actual source-mask names
are explicitly absent. Fresh build/typecheck, touched formatting and documentation self-check
pass. Evidence: `impl-green.log`, `impl-build.log`, `impl-typecheck.log`, `impl-format-check.log`.

Task 2.3.2 full gate: compiler 1,671 pass/two unchanged native-host skips, CLI 62, language server
21, editor 6 and root 1,661; total 3,421 pass. Install/build/typecheck and touched formatting,
83 local links/anchors, plan structure and frozen-authority checks pass. Root VICE cases run
sequentially. The first complete run passed 3,420 and failed one existing CIA1 pre-release stopped
address assertion; all four unchanged cases and the complete unchanged-command retry pass.
No source, fixture, timeout or assertion changed for that retry. Both independent reviews find
no new implementation defect; the correctness role's mandatory oracle-edit finding is retained
with the exact existing user approvals and independent boundary checks in `09-phase-review.md`.
Historical AR-P10/AR-P11 inverse proofs are honestly parent evidence; the reviewer independently
checks current identities, exact AR-P8 edits and AR-P12's stored-blob outside-region proof.
All 28 semantic counterexample probes pass. No new critical/major ruling remains, no fix-only
re-review is required and no optimizer/reporting subsystem was added. Only closeout remains.

Task 2.3.3 completion: closeout answers expiry against actual current registers, exclusions,
future triggers and the current root expressiveness ledger. Remaining owners stay RD-05/RD-08/
RD-10; no deferred item lands in a future slice of this completed pilot. The final analysis RD
and expert-skill candidate have their separate gates under AR-P7; neither is created or activated.
Issue #95 records the exact direct local meet and measured RD-08 path-to-win, without duplicating
the separate collision issue #94. The durable guide's exact source builds through the public
compiler and ACME on all four profiles. All final 91 local Markdown links/anchors, feature count 4/10,
diff/authority checks and semantic documentation self-check pass. Final document review reports
no new findings and proves all 13 production/test diff sections unchanged from the original
reviewed snapshot. No documentation framework or unrelated AGENTS.md rewrite is added.
The pilot is 21/21; RD-05 remains Executing. The high-effort named-batch waiver is fulfilled.
Evidence: `guide-example-builds.log`, `closeout-doc-checks.log`, `phase2-doc-completion.diff` and
`phase2-final-review.diff` in the phase scratch directory. Commit follows the green task loop;
the separate explicit safekeeping request authorizes one push, not continuing automatic pushes.
Final completion-bookkeeping validation: `final-doc-checks.log` and `final-plan-check.json` pass.

## Dependencies and success

Phase 2 depends on verified phase 1. Within each phase, sessions run in listed order; implementation
tests follow GREEN. Reuse existing test utilities; a necessary small fixture extension must stay
within the same stated contract and be recorded in the phase modification set, not become a new harness.

Success is all 21 tasks verified, unchanged frozen authority, cleared independent review, real
outside-checkout library availability and the bounded joystick evidence. RD-05 remains Executing.
Callable-helper migration, combined keyboard policy and RD-10 release proof are not disguised
completion conditions or delivered capabilities of this pilot.
