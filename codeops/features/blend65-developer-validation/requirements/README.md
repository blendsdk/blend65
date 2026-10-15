# Blend65 Developer Validation — Requirements

> **Project**: A companion Blend65 game-developer skill and one licensed Slither port
> **Status**: Draft
> **Created**: 2026-10-15
> **Architecture**: Existing Blend65 public toolchain, native skill Markdown, ACME and VICE
> **CodeOps Artifact Schema**: 1

## Overview

This feature supplies application-authoring guidance and evidence from one
complete game port. It runs beside the active v4 compiler session, with separate
ownership, checkout, outputs and identity-bound evidence. It does not introduce
new compiler features or change the ten-RD v4 scope.

The user explicitly approved `blend65-developer-validation/RD-01`, the companion
developer skill and Slither pilot. Source, licence and original-build assessment
must pass first. If Slither fails, implementation stops for the user's replacement
decision rather than silently choosing another game.

## Minimum-Sufficient Baseline

**Original goal:** increase confidence in real Blend65 application development
using a capable authoring skill and an independently authored C64 game reference.

**Smallest viable design:** one companion skill, one complete ordinary-source
port, independent behavior and complete cost expectations, existing public tools
and focused existing-tier tests. Reference frozen authority; do not reproduce it.

**Excluded support machinery:** new compiler/runtime/game engine, agent roles,
test runners, generalized validators, services, CI, automatic tool installers,
disassembly systems, additional game ports and external publication.

**Approved complexity:** only the explicitly requested authoring skill and pilot
application. No material support layer beyond those deliverables is approved.
See [the decision register](00-ambiguity-register.md).

## Domain Lenses and Existing Coverage

| Lens | Evidence and boundary |
| --- | --- |
| Compiler/language | Frozen Specification 4, authored source, independent behavior and expert-output expectations. No compiler semantic or API change is owned here. |
| Distributed/concurrent | Two sessions and worktrees share a host/Git repository; explicit ownership and sequential VICE windows prevent interference. No scheduling service is added. |
| Data/migration | Immutable upstream/compiler/skill/input/artifact identities govern reuse and invalidation. No database or public sidecar-format migration is introduced. |

**Specialist check: None** — existing correctness, semantics/DX, SFA/ABI,
platform, output and security roles cover the required reviews through bounded
packets. A new native agent is not justified or authorized.

## Glossary

| Term | Meaning |
| --- | --- |
| Developer skill | Reusable instructions for writing normal Blend65 application source, not a new normative authority or permission sandbox. |
| Expert authority | The single active qualified `blend65-domain-expert` release and its bound content; currently 2.0.4/content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`. |
| Pilot | Exactly Slither, subject to its required source/licence/build assessment. |
| Independent oracle | Expected behavior/cost derived before implementation from the appropriate external source and normative semantics, not from compiler output. |
| Holdout exercise | An application-writing exercise absent from the skill's teaching examples and unknown to its authoring context until evaluation. |
| Pin | Exact immutable compiler/source/skill/tool/input identity used for one proof. |
| Qualified subset | The capabilities actually exercised through their required evidence endpoint; broader guidance is not automatically runtime-qualified. |

## Document Index

| ID | Document | Responsibility |
| --- | --- | --- |
| AR | [Decision register](00-ambiguity-register.md) | Approved scope, authority, failure, concurrency and evidence boundaries. |
| RD-01 | [Developer skill and Slither port](RD-01-developer-skill-and-slither-port.md) | Source assessment, companion skill, complete port and bounded qualification. |

## Dependencies and Implementation Order

```text
Frozen language/expert + existing public compiler foundation
  -> Slither source/licence/two-build assessment
  -> exact game/machine contract + independent oracles
  -> companion-skill authoring and unseen-work qualification
  -> complete ordinary-source Slither port
  -> assembled/runtime/expert-cost proof and local handoff
```

Skill preparation and upstream assessment can proceed without waiting for the
whole of v4/RD-05–RD-10. A missing required compiler capability blocks only its
dependent implementation or proof and returns to the existing owner. There is
no reciprocal requirement for a compiler RD to wait for this feature.

Use the [feature roadmap](../00-roadmap.md) for lifecycle and the future
implementing plan's checklist for task progress. Requirements preflight and an
approved/preflighted implementation plan precede skill/port implementation.
The source assessment may gather facts before that plan; it must not add port
code, skill content or a new harness under the label of research.

The RD is first committed on the current branch, then carried into the separate
worktree using the existing `git-worktree` command. Bootstrap does not make that
commit a qualified compiler baseline. The portfolio roll-up is deferred until
integration on `v3`; concurrent feature branches update only their own roadmap.
