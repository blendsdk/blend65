# Slither Player Dependency Handoff

> **Status**: Open — assessment and existing-owner disposition required
> **Date**: 2026-10-18 11:43 CEST
> **Compiler/source snapshot**: `76a8aa0e`; no compiler changes in this feature
> **CodeOps Artifact Schema**: 1

## Fixture and Requested Boundary

The [runtime/player assessment](slither-runtime-and-player-assessment.md) owns
the observed facts. Its exact music fixture is upstream commit
`31347444d9547210f698ac98961e794ea671d276`, `data/slither_r.sid`, SHA-256
`239a2cae4feeca8408381196a33eaa212491b985d746cd9cf86d17773c4c446a`.
The PSID v2 payload is loaded at `$1000`, with init/play entries `$1000/$1003`.
Its flags declare PAL/MOS8580. The original game calls play from its raster IRQ
and uses direct SID crash effects; header metadata does not close that contract.

The full ordinary-source port must retain the music and effects. Existing
v4/RD-06 R6.23 owns exact callable-player contracts, and R6.24's GoatTracker
adapter does not by itself establish this SidTracker64 export. This handoff
requests that owner's disposition; it does not assign accepted work to another
session, authorize an extra adapter, or modify a compiler requirement.

## Missing Evidence

| Boundary | Evidence needed before dependent port work |
| --- | --- |
| Provenance | Applicable rights for the selected exported player/content, with notices and any actual third-party restrictions distinguished from the repository's declared MIT licence. |
| Exact external ABI | Entry conditions, register/status clobbers, writable and self-modifying ranges, ZP/stack, banking, reentrancy, IRQ/NMI interaction, original cadence and music/SFX coexistence. |
| Public compiler support | A qualified public path for the selected contract and profile, or an explicit existing-owner blocker. Raw byte inclusion is not a callable-player ABI. |
| Runtime and costs | Declaration-compatible PAL/8580 evidence, independent behavior/device expectations and complete applicable resource costs; earlier 6581 control-flow samples do not supply these. |

These are open prerequisites, not fabricated public compiler failures. There is
no new executable rejection case or diagnostic expectation in this handoff.
No compiler code, old oracle, player binary, skill or port source is changed.

## Bounded Public Provenance Follow-up

On 2026-10-15, the primary inspected the
[App Store product listing](https://apps.apple.com/us/app/sidtracker64/id955421205).
It identifies Daniel Larsson, reports copyright 2015, advertises `.sid` and
`.prg` export, and describes an emulated 8580 R5. Those statements identify the
product and its export feature; they do not state the licence of an exported
player. No conclusion about infringement or clearance follows from that gap.

The listing's old `sidtracker64.com` developer link now returned unrelated
gambling content. It is not accepted as current developer or licensing
authority. No links, forms, downloads or accounts on that site were used.
Bounded public searches did not find conclusive export-player terms or the
exact player source. Search misses do not prove such evidence does not exist.
No vendor, upstream author or third party was contacted.

## Specific Next Evidence

The [PAL/8580 follow-up](slither-pal8580-followup.md) now establishes bounded
movement/collision/restart on the declaration-compatible model and one actual
player tick. It does not clear rights, full player ABI/costs or public support.
Source-owned raster cadence, direct crash effects and the unproved D-set player
entry are recorded there for the existing owner. No previous compiler capability
or qualification status advances.

The next public enquiry is specific and currently **unsent**. It would ask the
Slither author or SidTracker64 vendor:

1. Who authored `data/slither_r.sid`'s tune and exported player in the pinned
   Slither commit, and what exact licence permits use, modification and
   redistribution of each? Does the repository MIT notice cover those bytes?
2. Where are the applicable export-player terms, required notices and versioned
   player source or authoritative documentation for SidTracker64 v1.0?
3. Is there authoritative init/play documentation covering D-set entry, clobbers,
   writable/self-modifying ranges, ZP/stack, PAL cadence and interrupt exclusion?

No message is sent, issue filed or third party contacted without explicit user
approval. No rights failure is inferred from a missing document or search miss.
Separately, v4/RD-06 must disposition this exact export's qualified public path;
GoatTracker or raw embedding cannot silently stand in for it.

## Continuation Boundary

Further enquiry should answer a specific missing fact through an authorized
source, not repeat broad searches. The user's standing VICE authority permits
reserving another window without asking again, after checking actual availability
and announcing ownership; it does not permit overlapping a foreign emulator.
Preserving an explicit blocker is preferable to silently removing
music, guessing an ABI, importing another session's output or adding an assembly
escape. The complete Slither port remains owned by this feature and cannot be
declared complete by an independent skill milestone.
