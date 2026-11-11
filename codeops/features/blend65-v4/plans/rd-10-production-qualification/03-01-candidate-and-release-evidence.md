# Candidate and Release Evidence: RD-10

> **Document**: 03-01-candidate-and-release-evidence.md
> **Parent**: [Index](00-index.md)

## Overview

RD-10 must prove one exact candidate. This document defines the candidate identity, the evidence
reuse rule, the release record shape, and the atomic-failure checks. It adds no release service.

## Candidate identity

The release record names:

| Fact | Source |
| ---- | ------ |
| Clean Git commit | `git rev-parse HEAD` with an empty `git status --porcelain` |
| Specification identity | `spec/` version/hash recorded by `BUILD_INFO` |
| Expert-skill identity | active `blend65-domain-expert` version and content commit |
| Runtime versions | Node, TypeScript, Yarn, Turbo, Vitest |
| Tools | ACME 0.97 executable hash, VICE 3.10 `x64sc` executable and ROM hashes |
| Hosts | exact `process.platform`/`arch` for each host with native evidence |
| Profiles | the nine manifest profile IDs |
| Artifacts | primary PRG/D64 hashes and sidecar hashes per generation |

A dirty tree, mutable version range, mismatched authority, or later code change invalidates only
the intersecting evidence; release stays blocked until the affected family is refreshed.

## Evidence reuse

Reuse a lower-RD result only when all of these match:

- candidate commit and specification/expert identities;
- source, asset, and manifest hashes;
- compiler version and build identity;
- profile, optimization mode, bounds/division checks, and tool identity;
- host platform/architecture and artifact hashes.

A mismatch reruns the smallest intersecting family. Unrelated complete suites are not rerun.

## Release record

Create `docs/releases/v4-production-qualification.md` with these sections:

1. Candidate identity and clean-tree proof.
2. Prerequisite RD closeout links and unresolved-finding status.
3. Host matrix: verified or `Unknown`, with exact native evidence links.
4. Profile/artifact matrix: eight PRG profiles and one D64 profile.
5. Language, assets, optimizer, and compiler-not-engine results.
6. ACME and VICE identities and sequential run results.
7. Physical-evidence status: every row `Unknown`, `V4-HW-1` owner, no inferred pass.
8. Tooling/package/VSIX local qualification.
9. C64U readiness rows and handoff packet link.
10. Security, responsiveness, deferrals, limitations, and debt.
11. Final bounded support statement.
12. Explicit user approval record.

The record links and hashes existing evidence. It does not copy full logs or create a second
evidence database.

## Atomic failure

Seeded failures before publication must publish no new generation and launch no prior artifact:

- compiler diagnostic;
- ACME failure;
- packager failure;
- tool mismatch or missing VICE;
- evidence/hash mismatch;
- cancellation before commit.

A deterministic post-commit VICE failure or cancellation preserves the committed generation, reports
build success separately, and terminates only owned execution. The existing RD-02/RD-09 publication
tests are the owning evidence; RD-10 records the release-boundary replay.

## Error handling

| Case | Handling |
| ---- | -------- |
| Dirty tree | No candidate identity; stop |
| Mutable or mismatched authority | Invalidate intersecting evidence |
| Missing host | Record `Unknown`; exclude from support statement |
| Missing VICE | `Unknown` for runtime claims; no pass count |
| Later fix | Rerun the affected family only |
| Post-commit VICE failure | Keep generation; report build/run separately |
