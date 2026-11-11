# RD-10 Production Qualification and C64U Handoff Implementation Plan

> **Feature**: Production qualification over the completed v4 compiler, tooling, and C64 surface
> **Status**: Planning Complete
> **Created**: 2026-11-11 10:10
> **Implements**: blend65-v4/RD-10
> **CodeOps Artifact Schema**: 1

## Overview

RD-10 closes the v4 production boundary by proving the public product that RD-01 through RD-09
already built. It adds no language feature, target, runtime, engine, readiness product, or debugger.
It binds one clean candidate commit to one Specification 4 identity, one active expert skill, exact
tool identities, the qualified hosts, nine C64 profiles, and the evidence owned by each prerequisite
RD.

The user has no physical C64 at this time. VICE 3.10 `x64sc` is therefore the sole runtime oracle and
every runtime test runs through VICE. Physical-only requirements remain in the record as `Unknown`,
with a named post-release hardware backlog row. No physical timing, analogue SID, serial, real-drive,
or silicon-sensitive claim is made for this candidate. The bounded support statement uses
`VICE-verified / hardware-unverified` wherever physical evidence is absent.

The plan also runs the C64U architecture-readiness gate against the real shipped architecture and
hands one discovery packet to the existing `blend65-c64u` owner. It does not implement C64U.

## Minimum-Sufficient Baseline

**Original goal:** prove that the completed v4 public path is a bounded, reproducible, honest C64
production release.

**Smallest viable design:** one candidate freeze; one evidence-bound host matrix; one sequential
VICE matrix over the four KERNAL PRG profiles and the one D64 profile; the four takeover profiles
are `Unknown` under `V4-TAKEOVER-1`; focused requalification of the
language, assets, optimizer, tooling, and packages; one C64U readiness/handoff packet; one release
record; one explicit user approval.

**Excluded machinery:** no readiness service, dashboard, score, evidence database, generic release
framework, new test runner, new compiler capability, physical-QA inference, or C64U implementation.

**Approved complexity:** none beyond RD-10's own XL qualification obligations. No Complexity
Escalation packet is raised.

## Document Index

| #   | Document                                                              | Description                                                |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                        | Zero-Ambiguity Gate decisions                              |
| 00  | [Index](00-index.md)                                                  | This document                                              |
| 01  | [Requirements](01-requirements.md)                                    | RD-10 delta view and plan-local decisions                  |
| 02  | [Current State](02-current-state.md)                                  | Audited qualification surface and gaps                     |
| 03  | [Candidate and Release Evidence](03-01-candidate-and-release-evidence.md) | Freeze, identity, evidence reuse, release record      |
| 03  | [Host and Package Qualification](03-02-host-and-package-qualification.md) | Native hosts, tools, public path, local packaging     |
| 03  | [C64 Artifact and VICE Qualification](03-03-c64-artifact-and-vice.md) | Eight profiles, D64, language, assets, optimizer, VICE     |
| 03  | [C64U Readiness and Handoff](03-04-c64u-readiness-and-handoff.md)     | Twelve seams, discovery packet, ownership                  |
| 03  | [Physical Status and Release Record](03-05-physical-and-release-record.md) | `Unknown` physical rows, support statement, limitations |
| 07  | [Testing Strategy](07-testing-strategy.md)                            | Specification and implementation cases                     |
| 99  | [Execution Plan](99-execution-plan.md)                                | Phases, tasks, and verification                            |

## Quick Reference

### Release record

```text
docs/releases/v4-production-qualification.md
```

### Runtime oracle

```text
VICE 3.10 x64sc — sole runtime oracle for this candidate
```

### Local package checks

```text
yarn build
yarn typecheck
yarn test
npm pack --dry-run
```

### Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Physical hardware | `Unknown` with `V4-HW-1` owner; claim stays hardware-unverified |
| Runtime oracle | VICE 3.10 `x64sc`, sequential |
| Hosts | Only hosts with native evidence are claimed; others `Unknown` |
| Release record | One Markdown closeout, no readiness product |
| Candidate | One clean commit after qualification-blocking fixes |
| C64U | Readiness and handoff only; no implementation |

## Specialist Agents

| Role | Kind | Use | AR Ref |
| ---- | ---- | --- | ------ |
| `sfa-abi-auditor` | reviewer | Final SFA/ABI claims, debug evidence, ABI identity | AR-5, AR-7 |
| `target-platform-auditor` | reviewer | VICE identity, profile matrix, physical boundary wording | AR-1, AR-2, AR-3 |
| `machine-code-auditor` | reviewer | Artifact identity, expert parity, optimizer evidence | AR-7 |
| `security-auditor` | reviewer | Host, package, trust, cancellation, evidence containment | AR-6, AR-8 |
| `semantics-reviewer` | reviewer | Modern-source claims, limitation register, support statement | AR-1, AR-13 |

_Detection evidence: RD-10 touches final emitted artifacts and profile smokes
(`test/m1/vice-runtime.ts`, `test/rd05/profiles-vice.spec.test.ts`), SFA/debug claims from RD-09,
native packaging (`packages/vscode/`), cross-host/public behavior (`packages/`), and the C64U
handoff (`codeops/features/blend65-c64u/`). These roles already exist for exactly these domains._

## Related Files

| File | Purpose |
| ---- | ------- |
| `codeops/features/blend65-v4/requirements/RD-10-production-qualification-and-c64u-handoff.md` | Owning requirements |
| `test/m1/vice-runtime.ts` | Exact VICE executable/ROM identity and lifecycle |
| `test/rd05/profiles-vice.spec.test.ts` | Resident-profile VICE observations |
| `test/rd05/profile-pipeline.spec.test.ts` | Eight profile builds and terminal admission |
| `test/rd07/d64-vice.spec.test.ts` | Opt-in D64 loader runtime |
| `test/rd08/` | Optimizer output, selection, and native cases |
| `packages/vscode/` | Thin client and local extension bundle |
| `docs/releases/` | Release qualification record (created by this plan) |
| `codeops/features/blend65-c64u/` | Successor ownership and handoff |
