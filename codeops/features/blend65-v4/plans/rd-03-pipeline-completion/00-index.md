# RD-03 Pipeline Completion Implementation Plan

> **Feature**: Playable M1 complete compiler pipeline
> **Status**: Preflight passed — ready to execute
> **Created**: 2026-09-20
> **Implements**: blend65-v4/RD-03
> **Coverage**: Remaining parent RD after the completed frontend-first plan
> **CodeOps Artifact Schema**: 1

## Overview

Complete the smallest real vertical compiler slice from the accepted RD-02 project snapshot and
finished RD-03 frontend through a playable C64 PRG. The plan adds only two representations inside
the compiler, Static Frame Allocation (SFA), one selected C64 profile, raw sprite ingestion,
documented 6510 lowering, terminal ACME emission, direct generation publication, truthful CLI and
diagnostics-only editor consumers, and one ACME/VICE-qualified M1 program (AR-C1–AR-C12).

Native SpritePad import remains in RD-06. Native Windows execution remains the approved RD-10
qualification deferral; it does not block Linux compiler work (AR-C1, AR-C16).

## Minimum-Sufficient Baseline

**Original goal:** Finish RD-03 as one useful, playable end-to-end compiler milestone.

**Smallest viable design:** Focused modules inside `@blend65/compiler`; one backend-free frontend
subpath; only the required language-server and VS Code workspaces; one raw asset; direct selected
profile facts; one bounded storage-closure loop; one direct publisher; one fixed qualification
workload (AR-C2–AR-C10).

**Excluded machinery:** Stage workspaces, pass/target/plugin/asset/schema frameworks, readiness
service, persistent daemon, general runtime, emulator abstraction, game engine, native asset parser
and speculative targets (AR-C1–AR-C8).

## Document Index

| Document | Owner |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Scope, decisions, simplicity and VICE mechanism proof |
| [Requirements](01-requirements.md) | Remaining RD-03 delta and local acceptance |
| [Current state](02-current-state.md) | Live repository baseline and gaps |
| [Semantic pipeline](03-01-semantic-pipeline.md) | Typed operations, CFG and whole-program facts |
| [SFA and ABI](03-02-sfa-and-abi.md) | Storage inventory, closure and diagnostics |
| [Target and layout](03-03-target-assets-lowering-layout.md) | Profile, raw asset, 6510 lowering and C64 placement |
| [Artifacts and publication](03-04-artifacts-and-publication.md) | ACME, PRG, sidecars, generation/pin lifecycle and VICE process |
| [Public consumers](03-05-public-consumers.md) | Compiler services, CLI, language server and VS Code extension |
| [M1 qualification](03-06-m1-qualification.md) | Game fixture, independent oracle, expert twin and runtime proof |
| [Testing strategy](07-testing-strategy.md) | Immutable ST cases and verification tiers |
| [Execution plan](99-execution-plan.md) | Sole mutable task-progress authority |

## Quick Reference

| Consumer | Public route | Owns |
|---|---|---|
| Library/CLI | `@blend65/compiler` | Load, check, build, publish and run services |
| Language server | `@blend65/compiler/frontend` | Project/frontend diagnostics and in-memory source overlay only |
| VS Code | `@blend65/language-server` | Stdio diagnostics server; no backend import |
| M1 qualification | Direct test helpers and built artifacts | Fixed trace, ACME/VICE evidence and bounded status |

## Key Decisions

| Decision | Outcome |
|---|---|
| Sprite source | One exact raw 512-byte fixture now; SpritePad in RD-06 (AR-C1, AR-C6) |
| Compiler topology | Internal responsibility modules, not responsibility workspaces (AR-C2) |
| Representations | One semantic CFG plus one machine CFG; no framework (AR-C3) |
| Allocation | SFA-only, bounded feedback and final storage certificate (AR-C4) |
| Target | One composed C64 PAL/KERNAL/6581 + documented 6510 + ACME + PRG selection (AR-C5) |
| Publication | Direct immutable generation/current record/pins; no transaction service (AR-C8) |
| VICE input | Binary-monitor I/O simulation on port 2 at one frame checkpoint (AR-C11) |
| Windows | Native execution at RD-10; portable code and Linux proof now (AR-C16) |

## Related Files

- Existing source stays under `packages/compiler/src/`; backend areas are added as focused folders.
- New products live at `packages/language-server/` and `packages/vscode/`.
- M1 lives under `examples/m1/` with its raw asset, source, reference oracle and expert ACME twin.
- Existing `test/import-boundary.ts` is extended for the real frontend subpath and editor workspaces.
- `spec/` remains byte-for-byte untouched.
