# Requirements: RD-06 Native Assets, Compile-Time Composition, and Resident Layout

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-06](../../requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- R6.1–R6.7: closed handler baseline, platform-owned dispatch, validation before values, literal
  source behavior, exact typed constants, requested-only emission, and resolved-identity aliasing.
- R6.8–R6.12: SpritePad SPD v5 validation, native records, optional selector surface, placement,
  and authentic producer evidence. Decoder execution is gated by AR-1.
- R6.13–R6.19: CharPad CTM v9 validation, exact selectors, canonical widths, packed-12, native
  placement, and authentic producer evidence. Decoder execution is gated by AR-1.
- R6.20–R6.26: PSID v1–v4 subset, load/entry metadata, compatibility sets, callable-audio split,
  GoatTracker 2.77 contract, source-owned audio policy, and independent audio evidence. The
  GoatTracker binding is gated by AR-2.
- R6.27–R6.31: classic Koala, four selectors, high-bit preservation, explicit display transfer, and
  strict raw fallback.
- R6.32–R6.37: ordinary `comptime function` composition, deterministic phase separation, explicit
  transformations, user-authored policy, Q-P15 artifact proof, and runtime-consumer proof.
- R6.38–R6.46: symbolic constraints, interval layout, one-copy placement, derived hardware fields,
  reservations, impossible-set rejection, placement overrides, ACME boundaries, and complete
  evidence.
- R6.47–R6.53: diagnostics, qualification, honest status, and deferral closeout.
- R6.54–R6.56: focused examples (including audio embed-only, aliasing and compile-time refinement),
  frontend asset metadata, and host observations.
- W10150 remains the frozen Specification 4 percentage warning; RD-06 adds no new percentage warning
  (AR-52).

### Deferred / out of this plan

- SpritePad and CharPad decoder implementation: blocked until the exact producer evidence checklist
  in [00-rd-06-producer-evidence-handoff.md](../../00-rd-06-producer-evidence-handoff.md) is complete
  (AR-1, AR-37, AR-50).
- GoatTracker 2.77 binding: blocked until exact archive/member hashes, exports, settings and ABI
  evidence are supplied (AR-2, AR-44).
- `loadable const`, D64 packaging, loaders, decompression, overlays, streaming, and nonresident
  delivery: RD-07 owns them (AR-3). Native loadable input fails closed with E10204 and a precise
  resident-only-profile message in RD-06; the restriction is recorded in the expressiveness ledger.
- Automatic representation selection, pre-shifting, compression, replication, or other cost-guided
  asset optimization: RD-08 owns them.
- Physical hardware listening, analog SID claims, and user-host qualification: RD-10 owns them.
- A public plugin/registry, asset graph DSL, scene/renderer API, audio scheduler/mixer, or game
  runtime: explicitly excluded by RD-06 and AR-038.

## Plan-local decisions

| Decision | Chosen | AR Ref |
| --- | --- | --- |
| Evidence-absent sequencing | Full plan; producer/player families blocked | AR-1, AR-2 |
| Native `loadable const` | E10204 + expressiveness ledger, RD-07 boundary | AR-3 |
| Handler module boundary | Core contract plus `assets/c64/` | AR-4, AR-49 |
| VIC bank scope | Selected bank 0, `c64.vic.bank0` region | AR-5 |
| Verify command | Project commands from `AGENTS.md` | AR-6 |
| Fixture location | `test/rd06/fixtures/` | AR-7 |
| Q-P15 location | Test-only qualification | AR-8 |
| Native identity | Full resolved identity | AR-9 |
| Scalar selectors | `EmbeddedScalarValue` | AR-10 |
| Placement errors | E10143 handler; E10273 source/interval | AR-11 |
| Parser budgets | Fixed limits | AR-12 |
| Audio overlap | Static domain overlap | AR-13 |
| Memory views | CPU, VIC bank 0, Color RAM | AR-14 |
| Fixture manifest | One JSON manifest | AR-15 |
| Planning-before-evidence | AR-51 boundary; no byte-level decoder design or task before the checkpoint | AR-51 |
| W10150 | Keep the frozen Specification 4 warning; R6.47 means no new percentage warning | AR-52 |
| Reserved native extensions | Fail closed with E10204 before raw fallback | AR-53 |

## Acceptance Criteria

The RD owns its acceptance criteria. This plan adds only these plan-local completion criteria:

1. Every unblocked phase completes with its specification tests written before implementation, a
   verified red phase, a green phase, implementation tests, and the project verification commands.
2. Every blocked phase carries a visible gate, an owner, and the exact evidence required to unblock
   it; no blocked phase is reported as verified or partially verified.
3. The complete unblocked RD-06 boundary suite runs once after the unblocked paths and layout
   integrate; the final producer-inclusive suite runs after Phases 8–10 pass.
4. The closeout records every remaining blocker honestly and can reach an explicit `Blocked` state
   without pretending that missing producer or player evidence is verified.
5. The roadmap and status text show `Plan Preflighted` until execution starts and `Done` only when
   every RD-06 acceptance criterion, including the blocked producer/player evidence, passes.
