# Current State: RD-10 Production Qualification and C64U Handoff

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

| Area | Current facts |
| ---- | ------------- |
| Prerequisite RDs | RD-01 through RD-09 are Done. RD-09 closed at 100/100 with a clean compiler suite (216 files, 3,659 passed / 2 skipped). |
| Public product | `@blend65/compiler`, `@blend65/cli` (`blendc`), `@blend65/language-server`, and `@blend65/vscode` version 0.1.0 (`packages/*/package.json`). |
| Project model | `loadProject`, immutable generations, current record, sidecars, and evidence validation are exported by `packages/compiler/src/index.ts`. |
| VICE harness | `test/m1/vice-runtime.ts` pins the `x64sc` SHA-256 and three ROM hashes, starts an attested binary monitor, and stops the owned process. |
| Resident profiles | `test/rd05/profiles-vice.spec.test.ts:8-13` runs four KERNAL profiles; `test/rd05/profile-pipeline.spec.test.ts:133-144` admits all nine manifest identities; takeover VICE representation is not yet a dedicated matrix. |
| D64 runtime | `test/rd07/d64-vice.spec.test.ts:159` runs only with `RD07_VICE=1`; its RD-07 record is 4/4 `VICE-verified / hardware-unverified`. |
| Assets | `test/rd06/vice-*.spec.test.ts` covers Koala, PSID, SpritePad producer, Q-P15, and sprite-pointer consumption. |
| Optimizer | `test/rd08/` has mode, selection, exact-output, and native cases; `input-startup-selection.spec.test.ts` starts VICE. |
| Root suite | `vitest.config.ts` includes all `test/**/*.{spec,impl}.test.ts` on local Linux; 299 root test files. `fileParallelism: false` serializes files. |
| CI | `.github/workflows/ci.yml` covers Ubuntu and Windows, foundation tier only, with no VICE and no macOS job. |
| C64U | `codeops/features/blend65-c64u/00-roadmap.md` exists; no discovery draft, requirements, or implementation. |
| Release record | `docs/releases/` does not exist. |

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `docs/releases/v4-production-qualification.md` | Release closeout index | Create |
| `test/rd05/profiles-vice.spec.test.ts` | Resident-profile VICE observations | Extend/run the eight-profile matrix |
| `test/rd05/profile-pipeline.spec.test.ts` | Nine-profile admission and fresh builds | Consume for artifact identity |
| `test/rd07/d64-vice.spec.test.ts` | D64 loader runtime | Run with `RD07_VICE=1` |
| `test/rd08/input-startup-selection.spec.test.ts` | Optimizer native case | Run in the release order |
| `packages/vscode/` | Local extension bundle | Produce and install a local VSIX |
| `codeops/features/blend65-c64u/requirements/_draft/discovery-notes.md` | Handoff packet | Create |
| `codeops/features/blend65-v4/00-roadmap.md` | Feature roadmap | Add `V4-HW-1`; update RD-10 lifecycle |
| `docs/tooling.md`, `docs/platform-libraries.md`, `docs/loadable-assets.md`, `docs/c64-cia2.md` | Existing user documentation | Reconcile with the final support statement |
| `.github/workflows/ci.yml` | Host CI | Do not treat as native host proof |

### Code Analysis

- The VICE harness already validates the exact executable and ROM identity, so RD-10 can reuse it
  instead of adding a new emulator launcher.
- The root configuration runs files sequentially but VICE suites are not all gated by one switch.
  The release order must not start concurrent `x64sc` instances.
- `profiles-vice.spec.test.ts` covers PAL/NTSC and 6581/8580 but only the four KERNAL profiles.
  RD-10 R10.21 asks for representative KERNAL and takeover artifacts per video standard; that is a
  real gap to close with focused VICE cases or a documented bounded substitute.
- The D64 suite is opt-in. The release order must set `RD07_VICE=1`.
- Asset VICE suites exist but require producer fixtures. The installed CharPad version mismatch from
  RD-06 remains a release qualification gap.
- No release record, physical limitation record, or C64U discovery seed exists.

## Gaps Identified

### Gap 1: No frozen candidate or release record

**Current Behavior:** RD-09 closed with a clean commit, but no release candidate binds the exact
identity set or links evidence by hash.

**Required Behavior:** R10.1, R10.6, R10.7.

**Fix Required:** Create the candidate record and the release index after the last blocking fix.

### Gap 2: No complete VICE matrix

**Current Behavior:** Four KERNAL profiles have a VICE observation; takeover profiles have build and
admission coverage but no dedicated runtime matrix; the D64 suite is opt-in.

**Required Behavior:** R10.15, R10.16, R10.21, AC-14, AC-15.

**Fix Required:** Run the eight-profile smoke matrix, add representable takeover observations, and
run the D64 suite sequentially with `RD07_VICE=1`.

### Gap 3: No native Windows/macOS proof

**Current Behavior:** CI uses a foundation tier with no VICE; no macOS job exists. The local host is
Linux x64.

**Required Behavior:** R10.11–R10.14, AC-10–AC-13.

**Fix Required:** Qualify Linux x64 locally. Record Windows/macOS as `Unknown` unless a native host
is available; exclude unqualified hosts from the support statement.

### Gap 4: No local package/VSIX qualification

**Current Behavior:** Packages build, but no `npm pack` or local VSIX install proof exists.

**Required Behavior:** R10.3, R10.28, AC-03, AC-26.

**Fix Required:** Pack the public packages, install them into a clean temporary prefix, build/check
a project through the installed CLI and library, start the LSP, and install the local VSIX.

### Gap 5: No C64U readiness or handoff artifact

**Current Behavior:** Only the successor roadmap exists.

**Required Behavior:** R10.29–R10.33, AC-27–AC-30.

**Fix Required:** Audit the twelve seams, fix only real v4 defects, and write the discovery seed.

### Gap 6: Physical evidence unavailable

**Current Behavior:** No physical C64, drive, or SID hardware.

**Required Behavior:** R10.21–R10.25, AC-20–AC-24, with the environment constraint recorded in the
owning RD.

**Fix Required:** Record every physical row `Unknown`, add `V4-HW-1`, and restrict the support
statement.

## Dependencies

### Internal Dependencies

- RD-01 through RD-09 closeouts and plans.
- RD-05 profile/device evidence and VICE harness.
- RD-06 producer fixtures and native assets.
- RD-07 D64/load evidence.
- RD-08 optimizer evidence.
- RD-09 CLI/LSP/VS Code/evidence surface.

All prerequisites are Done. No prerequisite is pending.

### External Dependencies

- Node 22+, Yarn classic, TypeScript 7, Turbo, Vitest.
- ACME 0.97 and VICE 3.10 `x64sc` on the qualification host.
- Native Windows x64 and macOS arm64/x64 hosts for any claim beyond Linux x64.
- No physical C64 for this candidate.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| VICE monitor startup timeout under load | Medium | Medium | Run sequentially, stop each process group, retry only the failed bounded case |
| Takeover runtime coverage is incomplete | Medium | High | Add a focused takeover VICE case or record the exact unverified boundary |
| Windows/macOS unavailable | High | High | Record `Unknown`; exclude from the support statement |
| Physical rows inferred as pass | Low | Critical | Release record must show `Unknown` and the support statement must say hardware-unverified |
| Qualification fixes invalidate evidence | Medium | Medium | Freeze after fixes; use the freshness matrix |
| Local package leaks source paths | Low | High | Install into a clean temporary prefix and exercise only public entries |
| C64U readiness becomes speculative abstraction | Medium | High | Record pressure only; no empty package or runtime dispatch |
