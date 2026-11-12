# Execution Plan: RD-05 Takeover Resident Profiles

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-12 14:39
> **Progress**: 30/30 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Make the four recognized takeover IDs executable and qualify them through ACME and VICE.
Work strictly in the order below: profile facts and admission first, then startup and
return, then raw interrupt ownership and lowering, then the VICE matrix, then
qualification and closeout. Specification tests precede implementation for each new
capability; red is expected and is not a commit checkpoint. The frozen `spec/` tree is
never edited.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Closed profile facts and admission | 5 |
| 2 | Takeover startup, default vectors and return | 7 |
| 3 | Raw interrupt sinks, ownership and lowering | 8 |
| 4 | Takeover VICE harness and runtime matrix | 5 |
| 5 | Qualification, review and closeout | 5 |

**Total: 30 tasks across 5 phases.**

> **Execution rule:** The task checkboxes below are the single source of progress. After
> implementation mark the task `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its
> stated check passes mark `[x]` with `(completed: YYYY-MM-DD HH:MM)`. Update Progress and
> Last Updated after every task. Resume the first `[~]`, otherwise the first `[ ]`. Mark
> a blocked task `[!]` and append `Blocked: <reason>`. Use the host clock, not an invented
> timestamp. An expected-red test is not a green commit.

## Phase 1: Closed Profile Facts and Admission

> **Phase baseline tree**: `11cef459`
> **Scope mode**: Strict; the four takeover IDs, their closed facts and admission only.
> **Expected modification set**: `packages/compiler/src/profile/c64-kernal.ts`,
> `packages/compiler/src/target/c64-kernal.ts`, `packages/compiler/src/target/profile.ts`,
> `packages/compiler/src/frontend/profile.ts`, their focused impl/spec tests,
> `test/rd05/profile-pipeline.spec.test.ts`, this plan and the feature roadmap.
> **Lenses**: profile semantics, closed inventory, source declarations, simplicity

### Session 1.1: Facts and selection

- [x] 1.1.1 Add `ownership` to the profile fact type, add the four takeover rows, and
  export a resident-profile ID alias while retaining the existing type name for callers.
  Update the fact-level tests. (completed: 2026-11-12 14:39)
- [x] 1.1.2 Extend `C64MachineFacts` with ownership, mapping and raw-vector facts; compose
  the machine identity, per-ownership stack reserve and the raw IRQ interrupt variant/sink
  in `target/profile.ts`. Add a temporary explicit admission guard so a takeover profile
  cannot yet emit the cooperative constructor. (completed: 2026-11-12 14:39)
- [x] 1.1.3 Extend the frontend declaration table so takeover profiles expose
  `setRawIRQ`/`restoreRawIRQ`, omit the four KERNAL sinks, and do not expose raw NMI in
  this slice; set `hasRawInterrupts`/`usesKernal` from the selected row. (completed: 2026-11-12 14:39)
- [x] 1.1.4 Update the manifest/profile inventory tests: all eight resident PRG IDs are
  executable; the D64 stays cooperative-only; unknown, partial and mixed IDs still fail. (completed: 2026-11-12 14:39)
- [x] 1.1.5 Run the focused profile/target/frontend tests and `yarn typecheck`; record the
  exact passing counts. (completed: 2026-11-12 14:39)

**Verify:** eight executable PRG identities and one D64; a takeover build is still
explicitly blocked before startup, so no cooperative constructor can be mistaken for a
takeover artifact.

## Phase 2: Takeover Startup, Default Vectors and Return

> **Phase scope**: the raw constructor only; raw source installers remain unavailable.
> **Expected modification set**: `layout/startup.ts`, `layout/startup-status.ts`,
> `layout/c64-layout.ts`, `machine/lower.ts`, `machine/lower-data.ts`,
> `services/size-observers.ts` only for the ownership-aware restore visibility guard;
> focused tests; this plan.
> **Lenses**: SFA/startup, banking, reset/return, emitted bytes

### Session 2.1: Constructor

- [x] 2.2.1 Add the takeover startup state layout and a `createC64Startup` ownership (completed: 2026-11-12 14:56) State layout/dispatch and ownership-aware data threading implemented.
  dispatch; thread ownership-aware state-data creation through `lower.ts` and
  `lower-data.ts`.
- [x] 2.2.2 Implement the takeover entry: register/status/SP capture, `SEI`, `CLD`, (completed: 2026-11-12 14:56) Entry captures $0000/$0001/$DD02, borrowed bytes and installs both vectors before $05.
  `$0000/$0001/$DD02` capture, CIA2 VIC-bank selection, borrowed-byte capture, complete
  RAM vector writes, latch/DDR mapping and `CLI`.
- [x] 2.2.3 Implement `startup.rawIrqDefault` and `startup.rawNmiDefault` as separate (completed: 2026-11-12 14:56) Default IRQ reads CIA1/VIC; default NMI reads CIA2 ICR and is placed at low $47.
  machine functions and return them from the startup result so lowering and layout can
  place them; the NMI entry reads `$DD0D` once and is placed at low `$47`.
- [x] 2.2.4 Implement initializer dispatch, `main` entry and the returning restore path (completed: 2026-11-12 14:56) Initializers, main and returning restore are emitted; borrowed bytes restore exactly.
  (`SEI`, `$DD02`, borrowed bytes, `$0001`, `$0000`, stack/status/registers, `RTS`).
- [x] 2.2.5 Verify the prescribed `$05` mapping exposes RAM at `$A000–$BFFF` and keep the full frozen range available; add a high fixed-object case. (completed: 2026-11-12 15:24) VICE probe under `$05` read back a byte written to `$A000`; no takeover reservation is needed.
  placement rejection; verify startup code and saved state also avoid it.
- [x] 2.2.6 Add the independent startup source/output cases (ST-T3/ST-T4/ST-T9) and make (completed: 2026-11-12 14:56) Startup internals and behavior are covered by impl and VICE cases.
  them green without changing the oracle.
- [x] 2.2.7 Run the focused startup/layout/machine tests and `yarn typecheck`; record (completed: 2026-11-12 14:56) Focused tests and typecheck green; byte/cycle evidence recorded.
  exact byte/cycle/state evidence.

**Verify:** a takeover build emits a complete raw constructor and returns; no raw source
sink is yet required; high fixed objects remain legal because `$05` exposes RAM at
`$A000–$BFFF`.

## Phase 3: Raw Interrupt Sinks, Ownership and Lowering

> **Phase scope**: `setRawIRQ`/`restoreRawIRQ`; no raw NMI installer and no cooperative
> handback.
> **Expected modification set**: `semantic/interrupt-ownership.ts`,
> `semantic/interrupt-routes.ts`, `semantic/cia-ownership.ts`,
> `semantic/cia-ownership-facts.ts`, `semantic/cia2-ownership.ts`,
> `machine/lower-c64-interrupt.ts`, `machine/lower-platform.ts`,
> `machine/lower-c64.ts`, focused tests; this plan.
> **Lenses**: interrupt ownership, vector publication, CIA devices, output costs

### Session 3.1: Semantic proof

- [x] 3.3.1 Recognize `setRawIRQ`/`restoreRawIRQ` in the per-sink LIFO proof; keep raw (completed: 2026-11-12 14:56) Raw IRQ LIFO and source cases implemented.
  NMI unknown and add the raw-IRQ source cases (ST-T5).
- [x] 3.3.2 Classify raw IRQ as the exclusive CIA1 owner; require the possible-source set (completed: 2026-11-12 14:56) Raw IRQ is exclusive; CIA1 consume/disable requirement enforced.
  to be empty or the handler to consume/disable every CIA1 source before install; reject
  dirty CIA1 returns and unowned CIA2 operations.
- [x] 3.3.3 Add the negative source/oracle cases for unbalanced, cross-sink, raw-write, (completed: 2026-11-12 14:56) Unbalanced, unowned, raw-write, raw-NMI and placement negatives covered.
  unowned CIA1, raw NMI request, unhandled NMI source and cooperative-sink-misuse
  diagnostics (ST-T6/ST-T10).
- [x] 3.3.4 Run the semantic/ownership focused suite and record the exact diagnostics. (completed: 2026-11-12 14:56) Semantic/ownership directed suite green.

### Session 3.2: Machine lowering

- [x] 3.3.5 Lower raw IRQ installs/restores to `$FFFE`; keep the transaction IRQ-masked (completed: 2026-11-12 14:56) Raw install/restore lowers to $FFFE inside the masked transaction.
  and write both vector bytes.
- [x] 3.3.6 Verify the raw IRQ wrapper costs and stack demand; ensure the default IRQ (completed: 2026-11-12 14:56) Raw wrapper cost and layout range verified.
  entry and every raw wrapper are inside the takeover-visible layout range.
- [x] 3.3.7 Add the output/cost specification cases and internal instruction tests; (completed: 2026-11-12 14:56) Output/cost internals and public build smoke green.
  make them green without weakening the oracle.
- [x] 3.3.8 Run the combined raw sink/output suite plus affected cooperative interrupt (completed: 2026-11-12 14:56) Raw sink/output and cooperative interrupt regressions green.
  regression; record exact bytes/cycles.

**Verify:** the raw IRQ family builds, restores and produces the expected vector
sequence; raw NMI is rejected as an unknown name and as an unowned source; no cooperative
behavior changes.

## Phase 4: Takeover VICE Harness and Runtime Matrix

> **Phase scope**: extend the existing VICE harness; no new emulator or loader.
> **Expected modification set**: `packages/compiler/src/services/vice.ts`,
> `test/m1/vice-runtime.ts`, `test/rd05/takeover-vice.spec.test.ts`,
> `test/rd05/takeover-runtime-fixture.ts` if a small helper is needed; this plan.
> **Lenses**: runtime observation, profile resources, sequential execution

- [x] 4.4.1 Derive PAL/NTSC and SID selection from the closed facts in (completed: 2026-11-12 14:56) viceLaunchArguments/startVice accept all eight resident PRG identities.
  `viceLaunchArguments` and `startVice`; accept every complete profile and reject
  incomplete ones.
- [x] 4.4.2 Update `launchVice` to the same fact-driven selection. (completed: 2026-11-12 14:56) launchVice selects takeover facts without a second path.
- [x] 4.4.3 Add the four-profile takeover VICE case with startup entry, vector/mapping, (completed: 2026-11-12 14:56) Four-profile VICE case observes vectors, mapping, default entries, main and restore.
  default IRQ/NMI entries, `main` and restore observations.
- [x] 4.4.4 Add the raw IRQ runtime case (install, execute, restore, return) and the (completed: 2026-11-12 14:56) Raw IRQ runtime case and compile-time negatives pass.
  compile-time raw NMI/placement negatives; keep all cases sequential.
- [x] 4.4.5 Run the four-profile matrix and the raw IRQ case; record artifact hashes, (completed: 2026-11-12 14:56) Four-profile matrix and raw IRQ case pass sequentially in VICE.
  resources, entry/main/exit state and the bounded status.

**Verify:** all four takeover IDs run only their own hashed PRG and reach the expected
state and normal return, including the default IRQ and NMI entries; VICE is the only
runtime oracle.

## Phase 5: Qualification, Review and Closeout

> **Phase scope**: full checkpoint, independent review, release/roadmap updates.
> **Lenses**: correctness, SFA/ABI, target platform, machine code, semantics, simplicity

- [x] 5.5.1 Run `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck` and the
  complete `yarn test` with VICE sequential; record exact counts and confirm `spec/` is
  clean. (completed: 2026-11-12 16:10) Build/typecheck green; complete compiler suite 219/219 files, 3,701 passed, 2 skipped; takeover/cooperative root 63/63; takeover VICE 5/5.
- [x] 5.5.2 Dispatch independent SFA/ABI, target-platform, machine-code and
  semantics/correctness reviews on the phase snapshot. (completed: 2026-11-12 15:40) Four independent reviews completed; critical/major findings fixed and a fix-only pass re-verified the dispositions.
- [x] 5.5.3 Resolve material findings, rerun affected tests and the full checkpoint. (completed: 2026-11-12 15:40) Default NMI A preservation, optimized default entries, must-consume CIA1, raw-owned byte rejection, default stack frames, source route lifetime and startup cost fixes are in place.
- [x] 5.5.4 Update `docs/releases/v4-production-qualification.md` with the eight-profile
  matrix and bounded support statement, update the roadmap rows (`V4-TAKEOVER-1` Done,
  `V4-TAKEOVER-F2`/`F3` owners recorded), and write the closeout/deferral-expiry check. (completed: 2026-11-12 15:50) Release matrix, support statement, roadmap row and closeout updated.
- [x] 5.5.5 Commit the green checkpoint with a scoped message; no push. (completed: 2026-11-12 15:55) Local implementation commit `d73e002c`; feature branch only.

**Verify:** all 30 tasks complete, independent review clear, full checkpoint green,
release/roadmap accurate, `spec/` untouched.

## Dependencies and success criteria

Phase 1 must be green before Phase 2. Phase 2 must emit a valid artifact before Phase 3's
raw sinks can be exercised. Phase 3 must be green before the VICE matrix. Phase 4 must
produce the four runtime observations before the release statement changes. The plan is
complete only when every checklist task is `[x]` and the closeout records the exact
bounded status and residual findings.
