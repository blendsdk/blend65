# RD-07 Loadable Assets and D64 Delivery — Implementation Plan

> **Feature**: Nonresident typed load units, KERNAL-first transfer, and one deterministic D64 artifact
> **Status**: Done
> **Created**: 2026-11-10
> **Implements**: blend65-v4/RD-07
> **CodeOps Artifact Schema**: 1

## Overview

RD-07 makes `loadable const` a real delivery boundary. A program can keep an exact typed value out
of the resident PRG, package it as one closed PRG component on a standard 35-track D64, and load it
once into any proved mutable destination through `c64.loader.load(unit, destination): boolean`.
The compiler owns unit identity, bytes, disk names, loader code, interval proof, publication facts,
packaging, and evidence. The program owns what the data means, when to load it, and every recovery
or gameplay decision.

The first disk profile is exactly `c64-pal-d64-kernal-6581`. Its primary artifact is one
`<name>.d64` containing the BASIC-startable boot PRG and every reachable uncompressed unit. The
first transport is the built-in `kernal-sequential-uncompressed` strategy, linked only when a load
call is reachable. The stock KERNAL `LOAD` path is trusted-media only (`HLE-010`); runtime failure
returns `false`, and no staging, compression, fastloader, or hostile-media containment is claimed.

This is compiler delivery, not a game engine. No example, package, or runtime supplies a VFS, asset
manager, loading screen, scene system, renderer, scheduler, or gameplay policy.

## Minimum-Sufficient Baseline

**Original goal:** deliver `loadable const`, the selected KERNAL loader, and one exact D64 artifact
without duplicating resident data or adding a runtime asset system.

**Smallest viable design:** reuse the existing typed frontend initializer bytes and flow facts; add
one semantic `load-unit` effect, one inline KERNAL sequence, one pure D64 serializer, and extensions
to the existing version-1 evidence families. The D64 profile is a composed target profile, not a
parallel build system.

**Excluded machinery:** a loader plugin registry, fastloader, drive code, compressor/decompressor,
staging buffer, generic VFS, external packager, `c1541` dependency, second layout solver, global
theorem solver, and a new debug format. Each is excluded by RD-07 or the ambiguity register.

**Approved complexity:** AR-P22 records that the packager, inline adapter, flow-fact extension, and
independent test decoder are the direct requested implementation, not a Complexity Escalation.

## Document Index

| #   | Document | Description |
| --- | -------- | ----------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions and delegated provenance |
| PF  | [Preflight Report](00-preflight-report.md) | Post-creation audit and finding dispositions |
| 00  | [Index](00-index.md) | This document — overview and navigation |
| 01  | [Requirements](01-requirements.md) | RD-07 delta scope and plan-local decisions |
| 02  | [Current State](02-current-state.md) | What exists today and what is missing |
| 03-01 | [Loadable Unit Model](03-01-loadable-unit-model.md) | Unit identity, bytes, provenance, reachability |
| 03-02 | [Load Operation and Publication](03-02-load-operation-and-publication.md) | Destination proof, capture, aliases, quiescence |
| 03-03 | [Loader Lowering and Resources](03-03-loader-lowering-and-resources.md) | KERNAL sequence, success check, SFA/resource contract |
| 03-04 | [Joint Layout and Memory](03-04-joint-layout-and-memory.md) | Destination intervals, reservations, mappings, memory evidence |
| 03-05 | [D64 Packager](03-05-d64-packager.md) | Geometry, BAM, directory, allocation, names, capacity |
| 03-06 | [Artifact, Publication, and Run](03-06-artifact-publication-and-run.md) | D64 profile, primary artifact, atomic publication, VICE mount |
| 03-07 | [Evidence and Costs](03-07-evidence-and-costs.md) | Sidecar records, costs, debug load units, reconciliation |
| 07  | [Testing Strategy](07-testing-strategy.md) | Specification cases and verification |
| 09  | [Closeout](09-closeout.md) | Delivered slice, deferral scan, verification |
| 09a | [Allocation measurement](09-allocation-measurement.md) | Multi-block D64 load observation |
| 99  | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Usage

```blend
struct LevelData {
    map: byte[1200];
    charset: byte[2048];
    colors: byte[1000];
    collision: byte[300];
}

loadable const LEVEL_2: LevelData = buildLevel(
    embed("level2.ctm", "map"),
    embed("level2.ctm", "charset"),
    embed("level2.ctm", "colors")
);

let currentLevel: LevelData;

function enterLevel2(): boolean {
    c64.system.restoreIRQ();
    c64.system.restoreNMI();

    if (!c64.loader.load(LEVEL_2, currentLevel)) {
        return false;
    }

    c64.system.setIRQ(frameIRQ);
    return true;
}
```

The example shows the ownership and control flow, not a promise of these placeholder spellings.
The loader requires every user IRQ/NMI route restored; mainline audio/player ticks cannot run during
the blocking call, so they are quiescent by construction. No `c64.audio.stop` API is added.

### Key decisions

| Decision | Outcome |
| -------- | ------- |
| Loadable type set | Scalars, fixed arrays, fixed structs, and RD-06 embedded/composed values |
| Load operation | `c64.loader.load(unit, destination): boolean` on the D64 profile only |
| Destination | Any proved mutable fixed place; finite fixed-array candidate set for a runtime index |
| Publication | Sparse half-open ranges; true edge initializes, false edge invalidates, no runtime state |
| Transport | Inline `SETLFS`/`SETNAM`/`LOAD`; no helper ABI, no staging |
| D64 | 174,848 bytes, 35 tracks, DOS `2A`, 664 blocks, 144 entries, `$00` fill |
| Allocation | `cbm-dos-1541-interleave-v1` (file interleave 10, directory interleave 3), measured before serializer code |
| Names | Spec-policy uppercase PETSCII boot name; units `L` + 12 identity hex |
| Diagnostics | E10274/E10275/E10276/E10279 plus `D64_NAME`/`D64_CAPACITY`/`D64_STRUCTURE`; no spec edit |
| Evidence | Version-1 families plus additive `loaderStrategyId` and `loadStates` |
| Hardware status | `VICE-verified / hardware-unverified`; RD-10 owns physical QA |

## Specialist Agents

| Role | Kind | Use | AR Ref |
| ---- | ---- | --- | ------ |
| `sfa-abi-auditor` | reviewer | Destination capture, loader temporaries, interrupt interference, final SFA closure | AR-P4, AR-P7 |
| `machine-code-auditor` | reviewer | Exact SETLFS/SETNAM/LOAD sequence, success check, bytes/cycles, no hidden copy | AR-P6, AR-P7 |
| `target-platform-auditor` | reviewer | KERNAL workspace, quiescence, D64 geometry, VICE mount, visibility/timing claims | AR-P5, AR-P11, AR-P20 |
| `semantics-reviewer` | reviewer | Loadable source contract, modern developer diagnostics, phase separation | AR-P1, AR-P3 |
| `security-auditor` | reviewer | Build input containment, D64 structural integrity, no shell/plugin path | AR-P13, AR-P14 |
| `correctness-reviewer` | reviewer | Final phase correctness and oracle-edit authority | All |

_Detection evidence: RD-07 touches lowering, function storage, platform contracts, and a new
artifact format; the four standing auditors already cover those domains. No new specialist gap was
found, so no additional role is proposed._

## Related Files

- `packages/compiler/src/frontend/` — loadable declarations, initializer bytes, flow facts, diagnostics, handoff.
- `packages/compiler/src/semantic/` — unit inventory, load operation, reachability, whole-program facts.
- `packages/compiler/src/machine/` — loader lowering, destination evaluation, success check.
- `packages/compiler/src/storage/` — SFA closure and loader reservation interference.
- `packages/compiler/src/layout/` — destination intervals, joint placement, visibility.
- `packages/compiler/src/packaging/d64/` — new pure D64 serializer and allocator.
- `packages/compiler/src/target/` — D64 profile composition and packager identity.
- `packages/compiler/src/services/` — build/run orchestration, evidence, VICE, build handoff.
- `packages/compiler/src/artifacts/` — version-1 sidecar validators and D64 package records.
- `packages/compiler/src/publication/` — primary D64 generation and sidecar consistency.
- `test/rd07/` — new specification, codec, evidence, security, and VICE suites.
- `examples/rd07-loadable/` — focused source examples.
- `docs/loadable-assets.md` — user-facing trusted-media boundary.
