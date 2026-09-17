# RD-02 Foundation Implementation Plan

> **Feature**: Clean v4 foundation and deterministic project loading
> **Status**: Executing — Phases 1–2 complete; next is the CLI and native host qualification
> **Created**: 2026-09-17
> **Implements**: blend65-v4/RD-02
> **CodeOps Artifact Schema**: 1

## Overview

Replace the inherited v3 implementation with a small, buildable foundation.
The public library validates a manifest and loads a contained, immutable source
snapshot. The CLI uses that library. It does not compile Blend65 yet.

## Minimum-Sufficient Baseline

**Original goal:** Implement [RD-02](../../requirements/RD-02-clean-v4-foundation-and-deterministic-project-model.md)
without importing v3's architecture or creating machinery for later RDs.

**Smallest viable design:** Two behavior-owning packages at completion:
`@blend65/compiler` and its real consumer `@blend65/cli`. The first green checkpoint
contains only the compiler package's complete manifest/diagnostic behavior; the CLI
package appears only when its real command shell is implemented. Keep project,
host, and diagnostic code as focused internal modules. Reuse the existing JSONC
dependency and approved Yarn/TypeScript/Turbo/Vitest roles. See AR-P3–AR-P7.

**Excluded machinery:** No compiler-pass packages, general host/service framework,
custom runner, generated architecture registry, replacement linter, bundler,
watcher, daemon, persistent compiler cache, readiness system, or artifact publisher.

**Approved complexity:** Existing requirements AR-036 owns Turbo/toolchain retention.
No new complexity escalation is introduced by this plan.

## Documents

| Document | Owns |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Scope approval and project-authorized planning choices |
| [Requirements](01-requirements.md) | Thin scope view; the RD remains authoritative |
| [Current state](02-current-state.md) | Observed inherited implementation and risks |
| [Salvage inventory](04-salvage-inventory.md) | Complete inherited-path decisions and actual checkpoint bindings |
| [Phase 1 evidence](05-phase-1-verification.md) | Red/green verification, immutable test hashes and independent review |
| [Phase 2 evidence](06-phase-2-verification.md) | Entry checks and contained-service execution evidence |
| [Foundation transition](03-01-foundation-transition.md) | Inventory, removals, packages, toolchain, and boundary proof |
| [Project service](03-02-project-service.md) | Manifest, paths, snapshots, hashes, diagnostics, and public signatures |
| [CLI and qualification](03-03-cli-and-qualification.md) | Truthful command shell, host evidence, and closeout |
| [Testing strategy](07-testing-strategy.md) | Concrete independent specification oracles |
| [Execution plan](99-execution-plan.md) | Sole task-progress authority |

The execution plan has three phases. Each delivers real behavior before the next
begins. Planning does not delete inherited code or install the new toolchain.

The whole-plan [preflight](00-preflight-report.md) passed iteration 2 after the
approved bounded corrections. Execution started on the user's instruction
"proceed further". The execution checklist owns current task progress.
