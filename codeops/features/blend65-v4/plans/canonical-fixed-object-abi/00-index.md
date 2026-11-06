# Canonical fixed-object ABI implementation plan

> **Feature**: Proof-backed returned-object calling convention in canonical lowering
> **Status**: Done — complete root suite green; T-18/DEF-17 closed
> **Created**: 2026-11-06
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Minimum-Sufficient Baseline

**Original goal:** finish root remediation without weakening behavior, resources
or artifact contracts, then resume RD-05 input qualification.

**Smallest viable design:** reuse existing unique-origin, returned-local,
early-publication, storage-selection and fixed-result/parameter consumers for
the narrowly eligible canonical representation. Keep Direct/Original selection
and the real generic construction as the proof/fallback reference.

**Excluded machinery:** general ABI specialization, alias/range solver, optimizer
activation in `none`, new pass, runtime, dependency or public surface.

**Approved complexity:** [AR-P6](00-ambiguity-register.md#ar-p6-visible-complexity-packet).
This plan owns DEF-17; the root checklist still owns root completion.
AR-P9 additionally approves metadata isolation and one residual-effects owner
for bounded unchanged-control/MMIO proof; see the same register and preflight.

## Document index

| Document | Owner |
| --- | --- |
| [Ambiguity register](00-ambiguity-register.md) | Exact approval, exclusions and discovery |
| [Requirements](01-requirements.md) | Required behavior and compatibility |
| [Current state](02-current-state.md) | Failure and existing machinery |
| [Representation boundary](03-01-representation-boundary.md) | Producer, closure and final consumer |
| [Testing strategy](07-testing-strategy.md) | Independent expectations and negatives |
| [Execution checklist](99-execution-plan.md) | Sole mutable task progress |

## Domain and Specialist Agents

Lenses: compiler/language, storage/interference and artifact compatibility.
Public schemas and pinned output identities stay fixed; there is no migration.

| Role | Required lens |
| --- | --- |
| correctness-reviewer | Bounded diff, standards, oracle authority and evidence |
| semantics-reviewer | Evaluation, snapshots, aliases, nested calls and unchanged source acceptance; semantic preservation and modern-source DX reported separately |
| sfa-abi-auditor | Complete calls, result backing, projection and interference |
| machine-code-auditor | Emitted effects, CPU state and complete expert costs |
| target-platform-auditor | BASIC borrows, startup preservation, MMIO/async visibility |
| performance-auditor | Fact derivation, construction cost and scaling |
| spec-test-author | Independent public contract cases before implementation |

**Specialist check: None additional.** Existing roles with bounded packets cover
the capabilities (`codeops/agent-routing.md:52–59`); a new role duplicates them.
At most three children run beside the primary. The primary owns commands and
tightly coupled implementation; VICE stays sequential.

Lineage: expert2.0.4, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
Specification4.0. Target: four cooperative C64 NMOS6510 profiles, ACME0.97,
VICE3.10. Runtime evidence is VICE-verified/hardware-unverified.
