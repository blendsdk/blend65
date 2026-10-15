# Game-Developer Skill: First Implementation Plan

> **Feature**: Companion authoring guidance and two independent core-source exercises
> **Status**: Planning Complete — bounded skill slice
> **Created**: 2026-10-16
> **Implements**: blend65-developer-validation/RD-01
> **Coverage**: R1.5–R1.8; applicable portions of R1.12 and R1.19–R1.21 only
> **CodeOps Artifact Schema**: 1

## Overview

Create the approved companion skill without waiting for Slither's unresolved
player prerequisites. This plan implements only the skill-first slice chosen by
the user. It does not implement the game, qualify rendering/audio/interrupt
support, close RD-01 or advance any v4 owner.

The [confirmed register](00-ambiguity-register.md) governs scope and independence.
The primary has seen the exercise answers and therefore cannot write the actual
skill payload. Fresh writers receive bounded packets, not this plan or grader
answers. Independent reviewers and actual public builds/execution determine
the qualified subset; a skill file's presence is not success.

## Minimum-Sufficient Baseline

**Original goal:** help a modern programmer write normal Blend65 application
source, with evidence stronger than instruction text or compiler status claims.

**Smallest viable design:** four native Markdown files, two small authored-source
exercises, focused tests in the existing Vitest tier and existing VICE helpers.
Native subagent calls remain workflow actions, never a new automated model runner.

**Excluded machinery:** new compiler/stdlib code, adapters, engines, agents,
services, generalized validators/runners, extra dependencies and publication.

**Approved complexity:** only the explicitly requested companion skill and its
bounded qualification; no additional support subsystem. AR-S1, AR-S3–AR-S7.

## Document Index

| Document | Owner of |
| --- | --- |
| [Register](00-ambiguity-register.md) | Scope, authority and isolation decisions |
| [Requirements delta](01-requirements.md) | Exact RD coverage and remaining ownership |
| [Current state](02-current-state.md) | Observed reusable surfaces and gaps |
| [Skill and qualification](03-skill-and-qualification.md) | Payload, interfaces, fresh-context protocol and failure handling |
| [Testing strategy](07-testing-strategy.md) | Independent expected results and Verify commands |
| [Execution plan](99-execution-plan.md) | Sole task-progress checklist |

## Domain Lenses

Compiler/language governs ordinary-source semantics and independent expectations.
Concurrency governs fresh-context roles, shared worktrees and emulator ownership.
Data/migration governs exact identities, stale results and failed-attempt retention.
No database, web application or financial system is introduced. AR-S2, AR-S5,
AR-S9–AR-S10.

## Specialist Agents

**Additional specialist check: None.** Existing configured roles plus bounded
packets cover this slice; no new standing role is justified. Evidence:
`codeops/agent-routing.md:52–65,83–93` and the public services/test surfaces in
[current state](02-current-state.md). AR-S12.

| Existing role | Assigned responsibility |
| --- | --- |
| `spec-test-author` | Independent new specification tests; no implementation or payload reads |
| `executor` | Separate fresh payload writer and fresh application authors; never oracle editors |
| `correctness-reviewer` | Base correctness, maintainability, authority and evidence scope |
| `semantics-reviewer` | Oracle correctness, ordinary-source DX and honest qualification claims |
| `security-auditor` | Native instruction boundaries, untrusted inputs/links and path/process ownership |
| `target-platform-auditor` | Exercise machine, runtime observation and retained-firmware limits |
| `sfa-abi-auditor`, `machine-code-auditor` | Select only if an actual finding/claim requires storage closure or expert-output qualification; neither endpoint is presumed passed here |

## Next Owner After This Slice

The assessment lead retains the
[full-port discovery](../developer-skill-and-slither-port/00-ambiguity-register.md)
and [player dependency handoff](../../research/slither-player-dependency-handoff.md).
Reopen detailed port planning when its actual rights, player ABI, compatible
runtime and public support gates are established. A finished skill checklist is
not a finished RD. AR-S11.
