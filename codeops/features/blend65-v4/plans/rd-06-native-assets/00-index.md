# RD-06 Native Assets, Compile-Time Composition, and Resident Layout — Implementation Plan

> **Feature**: Native C64 asset import, compile-time refinement, and resident interval layout
> **Status**: Plan Preflighted
> **Created**: 2026-11-07
> **Implements**: blend65-v4/RD-06
> **CodeOps Artifact Schema**: 1

## Overview

RD-06 makes `embed()` truthful for real C64 assets. A Blend65 program can import a SpritePad 3.80
SPD v5 project, a CharPad 3.80 CTM v9 project, a qualified PSID v1–v4 tune, a classic Koala file,
or an unregistered raw file, select one exact typed component, and place that component where the
hardware consumer can read it. The compiler owns parsing, validation, typing, provenance,
compile-time evaluation, placement, packaging, diagnostics, and evidence. The program owns what the
data means and every runtime consumer.

SpritePad and CharPad are unblocked by the licensed applications' official format manuals and real
producer example files in `/home/gevik/workdir/github/blend65.ri/apps`. The SPD v5 and CTM v9 schemas
are exact vendor documentation, not guesses. The real examples are local-only evidence because the
EULA does not grant redistribution; the repository carries a manifest with paths, versions and
SHA-256 values plus synthetic fixtures generated from the manual. The GoatTracker 2.77 adapter is
moved out of RD-06 to a later follow-up; RD-06 keeps the generic audio seam and empty contract map.

This is asset integration, not a game engine. No handler, compiler pass, example, or report supplies
a renderer, scheduler, mixer, scene runtime, or gameplay policy.

## Minimum-Sufficient Baseline

**Original goal:** Consume current C64 authoring-tool files directly, expose exact typed selectors,
prove compile-time refinement, and place every resident byte legally.

**Smallest viable design:** One target-neutral handler contract, one profile-owned extension map,
four explicit C64 handlers, the existing typed frontend and compile-time evaluator, and an extension
of the existing interval layout rather than a second allocator. Producer-gated families reuse the
same seam with the vendor manuals and selected real examples.

**Excluded machinery:** A public plugin registry, a generic asset graph/query language, a runtime
asset loader, a scene or renderer API, an audio scheduler/mixer, a new build system, a configurable
parser budget, and a second layout solver.

**Approved architecture decisions:** AR-2 (generic `c64.audio` surface; GoatTracker adapter moved to a follow-up),
AR-4 (target-neutral seam plus `assets/c64/` handlers), AR-5 (selected VIC bank 0), AR-10 (typed scalar
embedded values), AR-13 (static audio-overlap proof), AR-14 (two additional memory views), and AR-44
(closed audio-contract record). No other material support surface is approved.

## Document Index

| File | Description |
| --- | --- |
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail) |
| [00-index.md](00-index.md) | This document — overview and navigation |
| [00-preflight-report.md](00-preflight-report.md) | Preflight findings and dispositions |
| [01-requirements.md](01-requirements.md) | RD-06 delta view and plan-local decisions |
| [02-current-state.md](02-current-state.md) | Existing asset, layout, evidence and test facts |
| [03-01-asset-handler-core.md](03-01-asset-handler-core.md) | Dispatch, typed outputs, identity, diagnostics |
| [03-02-spritepad-charpad.md](03-02-spritepad-charpad.md) | Producer-gated native project handlers |
| [03-03-psid-and-player-adapters.md](03-03-psid-and-player-adapters.md) | PSID parsing, compatibility, callable audio |
| [03-04-koala.md](03-04-koala.md) | Classic Koala components and VIC placement |
| [03-05-comptime-and-qp15.md](03-05-comptime-and-qp15.md) | Composition, Q-P15 workload, no runtime |
| [03-06-resident-layout-evidence.md](03-06-resident-layout-evidence.md) | Interval proof, derived fields, reports |
| [03-07-fixtures-qualification.md](03-07-fixtures-qualification.md) | Manifest, public fixtures, VICE, status |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-cases and verification |
| `08-host-observations.md` | Per-handler host observations (created during execution) |
| `09-closeout.md` | Deferral-expiry answer and closeout (created during execution) |
| [99-execution-plan.md](99-execution-plan.md) | Phases, sessions and task checklist |

## Quick Reference

### Usage Examples

```blend65
module Assets;

// Raw unregistered inclusion
const TABLE: byte[] = embed("table.bin");

// PSID data and entry metadata; callable use needs an exact player contract
const MUSIC: byte[] = embed("music.sid", "data");
const MUSIC_INIT: word = embed("music.sid", "init_address");
const MUSIC_PLAY: word = embed("music.sid", "play_address");

// Koala components; Color RAM transfer stays explicit source work
const BITMAP: byte[] = embed("level.kla", "bitmap");
const SCREEN: byte[] = embed("level.kla", "screen");
const COLORS: byte[] = embed("level.kla", "color_ram");
const BACKGROUND: byte = embed("level.kla", "background");
```

```blend65
// Producer-gated families use the same source surface once authenticity passes
const SPRITES: byte[] = embed("player.spd");                 // default "sprites"
const SPRITE_COUNT: word = embed("player.spd", "count");
const CHARSET: byte[] = embed("level.ctm", "charset");       // no default; selector required
const MAP: byte[] = embed("level.ctm", "map");               // byte[] or word[] by max index
```

### Key Decisions

| Decision | Outcome | AR |
| --- | --- | --- |
| Producer evidence | Official vendor manuals + selected real examples; local-only files, synthetic committed fixtures | AR-1, AR-54–AR-57 |
| GoatTracker | Generic audio surface now; GT 2.77 adapter moved to a follow-up | AR-2, AR-58 |
| Native `loadable const` | Fail closed with E10204 + ledger; RD-07 owns delivery | AR-3 |
| Handler architecture | Core contract, `assets/c64/` handlers, profile-owned map | AR-4, AR-49 |
| VIC bank | Selected bank 0 only | AR-5 |
| Asset identity | Handler + version + path + input hash + selector + representation + output hash | AR-9 |
| Scalar selectors | Typed `EmbeddedScalarValue` | AR-10 |
| Placement errors | E10143 for handler constraints; E10273 for source/interval conflicts | AR-11 |
| Parser budgets | Fixed 1 MiB input and format-specific counts | AR-12 |
| Audio overlap | Static domain-overlap proof; no runtime lock | AR-13 |
| Memory views | CPU, VIC bank 0 and Color RAM | AR-14 |
| Fixtures | `test/rd06/fixtures/manifest.json` | AR-7, AR-15 |

## Specialist Agents

| Role | Kind | Use | AR Ref |
| --- | --- | --- | --- |
| `machine-code-auditor` | reviewer | Lowering of `vic*Select`, player calls, and final artifact cost | AR-30, AR-34 |
| `sfa-abi-auditor` | reviewer | Player call ABI, writable state, interrupt overlap, stack obligations | AR-13, AR-44 |
| `target-platform-auditor` | reviewer | VIC visibility, bank/alignment, MMIO, SID topology, packaging | AR-5, AR-29–AR-32 |

_Detection evidence: the project already registers these three specialists in
`codeops/specialists/` and requires them for lowering, SFA/ABI, and platform output in
`codeops/agent-routing.md`. The capability-gap check found no new standing specialist: the three
cover emitted code, function storage/ABI, and target hardware. `semantics-reviewer` remains a
phase-review role for the frozen `embed()`/selector semantics, not a new standing specialist._

## Related Files

- `codeops/features/blend65-v4/requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md`
- `codeops/features/blend65-v4/00-rd-06-producer-evidence-handoff.md`
- `/home/gevik/workdir/github/blend65.ri/apps/` (licensed SpritePad/CharPad manuals and examples)
- `packages/compiler/src/assets/`
- `packages/compiler/src/assets/c64/`
- `packages/compiler/src/target/`
- `packages/compiler/src/layout/`
- `packages/compiler/src/services/`
- `test/rd06/`
- `spec/13-data-inclusion.md`, `spec/14-diagnostics.md`, `spec/appendix-c64.md`
