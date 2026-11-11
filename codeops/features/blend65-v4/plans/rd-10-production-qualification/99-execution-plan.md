# Execution Plan: RD-10 Production Qualification and C64U Handoff

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-12 00:16
> **Progress**: 32/82 tasks (39%)
> **CodeOps Artifact Schema**: 1

## Overview

Qualify one candidate in eight phases. RD-10 adds no product capability; it freezes, runs, and
records the evidence owned by RD-01 through RD-09. VICE 3.10 `x64sc` is the sole runtime oracle.
Physical-only rows are `Unknown` with the `V4-HW-1` owner.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Candidate freeze and prerequisites | 10 |
| 2 | Linux host and public path | 10 |
| 3 | Profile and VICE matrix | 13 |
| 4 | Language, assets, and optimizer | 10 |
| 5 | Tooling, package, and VSIX | 9 |
| 6 | C64U readiness and handoff | 10 |
| 7 | Physical status, docs, and release record | 10 |
| 8 | Reviews, deferrals, and approval | 10 |

**Total: 82 tasks across 8 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once. On implementation mark `[~]` with a timestamp; on verify pass promote to
> `[x]`. Update the Progress header and Last Updated after every task. Resume at the first `[~]`,
> else the first `[ ]`. On blocker mark `[!]` and name the reason.

---

## Phase 1: Candidate Freeze and Prerequisites

> **Reasoning**: high — one exact candidate gates every later claim.
> **Lenses**: correctness, evidence integrity.
> **Reference**: [03-01](03-01-candidate-and-release-evidence.md) · ST-1–ST-10

### Step 1.1: Prerequisite Audit

- [x] 1.1.1 Verify RD-01–RD-09 are Done with approved requirements, completed plans, and closeouts — `codeops/features/blend65-v4/00-roadmap.md` ✅ (completed: 2026-11-11 10:14)
- [x] 1.1.2 Confirm no unresolved critical/major finding remains open from the RD-09 reviews or earlier closeouts — `codeops/features/*/plans/*/09-closeout.md` ✅ (completed: 2026-11-11 10:14)
- [x] 1.1.3 Record the Specification 4 hash and active expert-skill version/content commit — `spec/`, `.agents/skills/blend65-domain-expert/qualification/release.md` ✅ (completed: 2026-11-11 10:14)
- [x] 1.1.4 Record Node, TypeScript, Yarn, Turbo, Vitest, ACME 0.97, and VICE 3.10 executable/ROM hashes — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-11 10:14)
- [x] 1.1.5 Confirm `git status --porcelain` is empty and record the candidate HEAD after all blocking fixes — repository root ✅ (completed: 2026-11-11 10:14)

### Step 1.2: Release Record Skeleton

- [x] 1.2.1 Create the release record with all twelve required sections and the bounded-statement placeholder — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-11 10:14)
- [x] 1.2.2 Record the evidence-reuse identity fields and the freshness rule — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-11 10:14)
- [x] 1.2.3 Record the nine profile IDs and the exact artifact inventory contract — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-11 10:14)

### Step 1.3: Atomic Failure Replay

- [x] 1.3.1 Replay seeded compiler, ACME, packager, and cancellation failures; confirm no new generation and no prior artifact launch — `packages/compiler/src/publication/publication.spec.test.ts`, `packages/compiler/src/publication/terminal-failure.spec.test.ts` ✅ (completed: 2026-11-11 10:14)
- [x] 1.3.2 Replay a post-commit VICE failure or cancellation; confirm the generation survives and build/run are reported separately — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-11 10:14)

**Deliverables**: candidate identity, prerequisite audit, release-record skeleton, atomic-failure
record.

**Verify**: every identity is exact; `git status --porcelain` is empty.

---

## Phase 2: Linux Host and Public Path

> **Reasoning**: high — the public path must work from installed packages, not the source tree.
> **Lenses**: integration, security, packaging.
> **Reference**: [03-02](03-02-host-and-package-qualification.md) · ST-3, ST-11, ST-14

### Step 2.1: Linux Installation and Build

- [x] 2.1.1 Run `yarn install --frozen-lockfile`, `yarn build`, and `yarn typecheck` on clean `linux/x64` — repository root ✅ (completed: 2026-11-11 10:16)
- [x] 2.1.2 Record the host identity, Node identity, and locked dependency identity — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-11 10:16)
- [x] 2.1.3 Run the complete compiler and root suites sequentially; record the exact counts and failures (if any) — `packages/compiler`, root `test/` ✅ (completed: 2026-11-12 00:09; compiler 217 files / 3,683 passed / 2 skipped; root 325 files / 6,567 passed / 3 VICE retries / 4 skipped; every retry passed alone)
  - Final root failures were monitor-ownership, monitor-startup, and frame-wait load cases. Each passed alone (4/4, 1/1, 4/4). No product defect was inferred and no skip counted as a pass.

### Step 2.2: Installed Public Path

- [x] 2.2.1 Pack the compiler, CLI, and language-server tarballs; install them into a clean temporary prefix — temporary prefix outside the repository ✅ (completed: 2026-11-11 21:10; 3 tarballs, 9 installed packages, hashes in the release record)
- [x] 2.2.2 Run `blendc check`, `build`, and fresh `run` from the installed CLI against a frozen project — installed prefix ✅ (completed: 2026-11-11 21:10; check/build success; run launched VICE and cancelled with exit 130 and no residue)
- [x] 2.2.3 Use the installed compiler library and `frontend` entry; confirm no private source path or backend leak — installed prefix ✅ (completed: 2026-11-11 21:10; both entries resolve inside the prefix, no backend exports, private imports rejected)
- [x] 2.2.4 Start the installed language server and complete initialize, diagnostics, completion, hover, and formatting — installed prefix ✅ (completed: 2026-11-11 21:10; 92 completion labels, hover, one format edit, one error diagnostic)
- [x] 2.2.5 Prove ACME/VICE discovery precedence, exact versions, missing-tool failure, and owned-process cancellation — installed prefix ✅ (completed: 2026-11-11 21:10; explicit path wins over empty PATH, invalid path fails without fallback, missing ACME/VICE fail their operation, SIGTERM leaves no `x64sc`)

### Step 2.3: Host Evidence

- [x] 2.3.1 Record the Linux host journey and any failed claim in the release record — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-11 17:18; boundary counts, three fixed defects, and the VIC-collision retry recorded)
- [x] 2.3.2 Record `win32/x64`, `darwin/arm64`, and `darwin/x64` as verified or `Unknown`; do not synthesize a host — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-11 17:18; all three remain `Unknown`; no physical or cross-host inference)

**Deliverables**: Linux host evidence, installed public path, discovery/cancellation proof, host
status table.

**Verify**: installed CLI/LSP/library/VSIX work without the source tree.

---

## Phase 3: Profile and VICE Matrix

> **Reasoning**: high — every runtime claim comes from VICE.
> **Lenses**: platform, machine cost, correctness.
> **Reference**: [03-03](03-03-c64-artifact-and-vice.md) · ST-15, ST-16, ST-21

### Step 3.1: Resident Profiles

- [x] 3.1.1 Build and byte-validate all four KERNAL resident PRG profiles through the public compiler — `test/rd05/profile-pipeline.spec.test.ts` ✅ (completed: 2026-11-12 00:10; 10/10 tests, fresh builds and terminal admission)
- [x] 3.1.2 Run the four KERNAL profile VICE matrix sequentially and record exact identity/observations — `test/rd05/profiles-vice.spec.test.ts` ✅ (completed: 2026-11-12 00:10; 4/4 profiles, exact VICE/ROM identity, normal return at cycle 57,671)
- [x] 3.1.3 Record the four takeover profiles as `Unknown` under `V4-TAKEOVER-1`; no takeover runtime case exists ✅ (closed: 2026-11-11; user-approved deferral, AR-18)
- [x] 3.1.4 Reserve no takeover runtime observation and make no takeover banking/vector/interrupt claim ✅ (closed: 2026-11-11; the matrix is limited to four KERNAL profiles)
- [ ] 3.1.5 Confirm no profile result substitutes for another dimension and record the four-KERNAL-plus-D64 matrix — `docs/releases/v4-production-qualification.md`

### Step 3.2: D64

- [x] 3.2.1 Build and structurally validate the one D64 profile image — `test/rd07/d64-publication.spec.test.ts` ✅ (completed: 2026-11-12 00:16; 3/3)
- [x] 3.2.2 Run `RD07_VICE=1 yarn vitest run test/rd07/d64-vice.spec.test.ts` sequentially and record all four cases — `test/rd07/d64-vice.spec.test.ts` ✅ (completed: 2026-11-12 00:16; 4/4, self-contained fixture variants)
- [x] 3.2.3 Record the D64 boot/load/canary/publication/quiescence/BASIC-return result and `HLE-010` — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-12 00:16)

### Step 3.3: Device and Runtime Matrix

- [x] 3.3.1 Run the enabled CIA/IRQ/NMI/runtime-switch/VIC-collision/joystick VICE cases sequentially — `test/rd05/` ✅ (completed: 2026-11-12 00:16; all families pass, collision frame-wait retried 4/4)
- [x] 3.3.2 Run the asset VICE cases (Koala, PSID, SpritePad, Q-P15, sprite pointer) sequentially — `test/rd06/` ✅ (completed: 2026-11-12 00:16; 7/7 asset VICE cases)
- [x] 3.3.3 Run the optimizer native case and any other enabled VICE case sequentially — `test/rd08/` ✅ (completed: 2026-11-12 00:16; startup/saved/acquisition/size suites pass, byte-selection monitor case retried 4/4)
- [x] 3.3.4 Record every pass, bounded timeout, retry, and `Unknown`; no skip contributes a pass — `docs/releases/v4-production-qualification.md` ✅ (completed: 2026-11-12 00:16; three retries recorded, no skip counted)
- [x] 3.3.5 Stop every owned VICE process group and confirm no monitor/port residue — host process table ✅ (completed: 2026-11-12 00:16; `pgrep x64sc` empty)

**Deliverables**: four-KERNAL-plus-D64 artifact/VICE matrix, takeover `Unknown` record, D64 result,
device/runtime results, clean process state.

**Verify**: every runtime case ran through VICE 3.10, sequentially.

---

## Phase 4: Language, Assets, and Optimizer

> **Reasoning**: high — complete-language and expert-output claims need independent oracles.
> **Lenses**: semantics, machine code, platform.
> **Reference**: [03-03](03-03-c64-artifact-and-vice.md) · ST-9, ST-17–ST-20

### Step 4.1: Language and Assets

- [ ] 4.1.1 Run the complete compiler suite and record the language-family coverage — `packages/compiler`
- [ ] 4.1.2 Confirm at least one required case per normative family reaches assembled bytes and applicable VICE behavior — `test/rd04/`, `test/rd05/`
- [ ] 4.1.3 Run the exact asset producer/format fixtures and record the CharPad 3.80/3.88 gap — `test/rd06/`, `docs/releases/v4-production-qualification.md`
- [ ] 4.1.4 Run the compiler-not-engine workload inspection and record the result — `examples/`, package/binary inspection
- [ ] 4.1.5 Record complete language-family coverage and any expressiveness gap — `docs/releases/v4-production-qualification.md`

### Step 4.2: Optimizer and Parity

- [ ] 4.2.1 Run the four optimizer modes and record behavior, cost, and resource evidence — `test/rd08/`
- [ ] 4.2.2 Verify no local selected-objective ratio exceeds 1.0 and every meet-only result links an issue — `test/rd08/`, GitHub issues
- [ ] 4.2.3 Record the realistic whole-program win for `balanced`, `speed`, and `size` and the `none` direct-lowering identity — `docs/releases/v4-production-qualification.md`
- [ ] 4.2.4 Record the optimizer parity-debt and linked-issue inventory — `docs/releases/v4-production-qualification.md`
- [ ] 4.2.5 Verify final debug/evidence identities match the selected artifacts — `test/rd09/`, `docs/releases/v4-production-qualification.md`

**Deliverables**: complete-language evidence, asset fixture result, optimizer/mode record,
compiler-not-engine proof.

**Verify**: independent oracles are named; no local loss or untracked meet remains.

---

## Phase 5: Tooling, Package, and VSIX

> **Reasoning**: high — the release claim includes the editor and machine-readable surfaces.
> **Lenses**: integration, security, UX.
> **Reference**: [03-02](03-02-host-and-package-qualification.md) · ST-3, ST-14, ST-22

### Step 5.1: Local Packages

- [ ] 5.1.1 Produce local `npm pack` tarballs for compiler, CLI, and language server and inspect their contents — temporary directory
- [ ] 5.1.2 Build the local VSIX and inspect the manifest, bundled server, and externalized CLI — `packages/vscode/`
- [ ] 5.1.3 Install the VSIX into a clean extension host or the closest real host available; record the exact boundary — temporary VS Code profile
- [ ] 5.1.4 Record the tarball/VSIX hashes and installed identities — `docs/releases/v4-production-qualification.md`

### Step 5.2: Tooling Journeys

- [ ] 5.2.1 Run Build, Run in VICE, and Open Build Evidence from the installed extension — temporary VS Code profile
- [ ] 5.2.2 Verify trust denial, selective save-or-abort, progress, diagnostics, output, and artifact containment — `packages/vscode/src/`
- [ ] 5.2.3 Verify the language server starts from the installed package and preserves project isolation/status — installed prefix
- [ ] 5.2.4 Record every tooling result and any `Unknown` host boundary — `docs/releases/v4-production-qualification.md`
- [ ] 5.2.5 Record the exact extension-host boundary and any unavailable host detail — `docs/releases/v4-production-qualification.md`

**Deliverables**: local tarballs, local VSIX, installed tooling journey, package inspection.

**Verify**: no source-tree-only path is required for the claimed host.

---

## Phase 6: C64U Readiness and Handoff

> **Reasoning**: high — readiness must be real, not an empty abstraction.
> **Lenses**: architecture, portability, product honesty.
> **Reference**: [03-04](03-04-c64u-readiness-and-handoff.md) · ST-23, ST-24

### Step 6.1: Readiness Audit

- [ ] 6.1.1 Audit the twelve readiness rows against real files/types and existing C64 consumers — `packages/compiler/src/`, `spec/`
- [ ] 6.1.2 Fix any real v4 seam defect found by the audit; rerun affected C64 evidence — owning v4 files
- [ ] 6.1.3 Record each passed row or explicit blocker with file/type evidence — `docs/releases/v4-production-qualification.md`
- [ ] 6.1.4 Confirm no selectable `c64u` ID, package, stub, emulator case, or support claim exists — public packages, manifests, docs

### Step 6.2: Handoff

- [ ] 6.2.1 Create the eight-section discovery seed under the existing successor owner — `codeops/features/blend65-c64u/requirements/_draft/discovery-notes.md`
- [ ] 6.2.2 Link the candidate/spec/expert identities and passed readiness rows — handoff packet
- [ ] 6.2.3 Record every unknown, primary-source need, activation gate, and one native proof seed — handoff packet
- [ ] 6.2.4 Update the successor roadmap with the handoff artifact and dependency — `codeops/features/blend65-c64u/00-roadmap.md`
- [ ] 6.2.5 Verify C64 behavior/artifacts are unchanged by any readiness correction — `test/rd05/`, `test/rd07/`, `test/rd08/`
- [ ] 6.2.6 Record the readiness result and handoff link — `docs/releases/v4-production-qualification.md`

**Deliverables**: twelve-row readiness record, handoff packet, successor roadmap update, C64
preservation proof.

**Verify**: readiness uses real seams; no C64U implementation or speculative abstraction.

---

## Phase 7: Physical Status, Docs, and Release Record

> **Reasoning**: high — the release statement must be honest about absent hardware.
> **Lenses**: documentation, product honesty, modern-developer UX.
> **Reference**: [03-05](03-05-physical-and-release-record.md) · ST-21, ST-22, ST-25, ST-27

### Step 7.1: Physical Status

- [ ] 7.1.1 Add the `V4-HW-1` physical qualification backlog row to the feature roadmap — `codeops/features/blend65-v4/00-roadmap.md`
- [ ] 7.1.2 Record every physical row as `Unknown` with its exact future evidence and `V4-HW-1` owner — `docs/releases/v4-production-qualification.md`
- [ ] 7.1.3 Record emulator/hardware disagreement as untested and keep the VICE observation only — release record

### Step 7.2: Documentation and Support Statement

- [ ] 7.2.1 Reconcile tooling, platform-library, loadable-asset, and CIA documentation with the qualified surface — `docs/`
- [ ] 7.2.2 Exercise every claimed install/command/path example on the qualified host — `docs/`
- [ ] 7.2.3 Write the bounded support statement: qualified identities, `VICE-verified / hardware-unverified`, explicit non-claims — `docs/releases/v4-production-qualification.md`
- [ ] 7.2.4 Record phase-separated responsiveness trends for the qualified host with no pass/fail threshold — `docs/releases/v4-production-qualification.md`
- [ ] 7.2.5 Record the security negative matrix and its owning evidence — `docs/releases/v4-production-qualification.md`

### Step 7.3: Release Record

- [ ] 7.3.1 Complete all twelve release-record sections and hash-bind each reused evidence item — `docs/releases/v4-production-qualification.md`
- [ ] 7.3.2 Verify there is no readiness percentage, feasibility score, copied log dump, or second evidence database — release record

**Deliverables**: `V4-HW-1`, physical `Unknown` table, reconciled docs, bounded statement,
responsiveness/security records, complete release record.

**Verify**: the statement claims only evidence that exists.

---

## Phase 8: Reviews, Deferrals, and Approval

> **Reasoning**: high — independent qualification and explicit user approval close the release.
> **Lenses**: correctness, security, platform, SFA/ABI, semantics.
> **Reference**: RD AC-31–AC-34 · ST-25, ST-26, ST-28

### Step 8.1: Independent Reviews

- [ ] 8.1.1 Run the SFA/ABI and machine-code reviews of the final artifact/debug/optimizer claims — review records
- [ ] 8.1.2 Run the target-platform review of VICE identity, profile matrix, physical wording, and tool discovery — review records
- [ ] 8.1.3 Run the security review of host/package/trust/cancellation/evidence boundaries — review records
- [ ] 8.1.4 Run the semantics review of modern-source claims, limitations, and support statement — review records
- [ ] 8.1.5 Fix every critical/major finding and rerun only the affected evidence — owning files

### Step 8.2: Deferral and Final Boundary

- [ ] 8.2.1 Run the mandatory deferral-expiry scan across ambiguities, Won't Have, future considerations, expert deferrals, hardware limits, expressiveness, parity, and C64U unknowns — `docs/releases/v4-production-qualification.md`
- [ ] 8.2.2 Reassign every due item to `V4-HW-1`, a concrete RD, or an authorized issue; no orphan remains — roadmap/issues
- [ ] 8.2.3 Run the final complete release boundary once and record exact counts/identities — repository root
- [ ] 8.2.4 Present the exact support statement, release record, limitations/debt, physical `Unknown` rows, C64U handoff, and local package result to the user — release record
- [ ] 8.2.5 Record explicit user approval or keep RD-10 in review; do not change the production lifecycle without it — release record, roadmap

**Deliverables**: independent review records, deferral disposition, final boundary, explicit
approval decision.

**Verify**: all reviews complete; no critical/major finding open; approval recorded.

---

## Dependencies

```text
Phase 1 (candidate)
    ↓
Phase 2 (host/public path) → Phase 5 (tooling/package)
    ↓
Phase 3 (profiles/VICE) → Phase 4 (language/assets/optimizer)
    ↓
Phase 6 (C64U)
    ↓
Phase 7 (physical/docs/release record)
    ↓
Phase 8 (reviews/approval)
```

## Success Criteria

1. ✅ All 82 tasks `[x]` or explicitly closed with evidence.
2. ✅ One clean candidate identity with no dirty-tree or authority mismatch.
3. ✅ Every claimed host has native evidence; unavailable hosts are `Unknown`.
4. ✅ Four KERNAL resident profiles and one D64 profile have sequential VICE observations; the four
   takeover profiles are `Unknown` under `V4-TAKEOVER-1`.
5. ✅ Language, assets, optimizer, and compiler-not-engine claims pass with independent oracles.
6. ✅ Local packages and VSIX work from installed artifacts.
7. ✅ C64U readiness and handoff are complete without implementation.
8. ✅ Physical rows are `Unknown` with `V4-HW-1`; the statement says `VICE-verified / hardware-unverified`.
9. ✅ Deferrals and limitations have no orphaned owner.
10. ✅ Independent reviews are complete and explicit user approval is recorded.
