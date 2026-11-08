# Requirements: RD-06 Native Assets, Compile-Time Composition, and Resident Layout

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-06](../../requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- R6.1–R6.7: closed handler baseline, platform-owned dispatch, validation before values, literal
  source behavior, exact typed constants, requested-only emission, and resolved-identity aliasing.
- R6.8–R6.12: SpritePad SPD v5 validation, native records, optional selector surface and placement,
  using the official 3.80 vendor manual and selected real SPD v5 examples.
- R6.13–R6.19: CharPad CTM v9 validation, exact selectors, canonical widths, packed-12 and native
  placement, using the official 3.80 vendor manual and selected real CTM v9 examples.
- R6.20–R6.23: PSID v1–v4 subset, load/entry metadata, compatibility sets and the callable-audio
  split. The generic audio seam and empty contract map remain; GoatTracker is a follow-up.
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
- The vendor manuals and examples are available at
  `/home/gevik/workdir/github/blend65.ri/apps`; no further manual producer matrix is required.

### Deferred / out of this plan

- The full SpritePad/CharPad `MIN`/`ALL`/`WIDE`/optional matrix: replaced by selected real vendor
  examples plus synthetic coverage derived from the official manuals (AR-54–AR-57).
- GoatTracker 2.77 binding: moved to a follow-up feature; RD-06 closes with the generic audio seam
  and empty contract map (AR-2, AR-58).
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
| Evidence availability | Vendor manuals + selected real examples; local-only files, synthetic fixtures | AR-1, AR-54–AR-57 |
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
| Producer schema authority | Official vendor manuals + selected real examples; local-only files | AR-54–AR-57 |
| CharPad version | Installed 3.80 Pro with CTM v9; RD pin amended to 3.80+ | AR-55 |
| Real fixture retention | Local-only; commit manifest + synthetic fixtures | AR-56 |
| GoatTracker | Moved out of RD-06 to a follow-up | AR-58 |
| W10150 | Keep the frozen Specification 4 warning; R6.47 means no new percentage warning | AR-52 |
| Reserved native extensions | Fail closed with E10204 before raw fallback | AR-53 |

## Acceptance Criteria

The RD owns its acceptance criteria. This plan adds only these plan-local completion criteria:

1. Every active phase completes with its specification tests written before implementation, a
   verified red phase, a green phase, implementation tests, and the project verification commands.
2. SpritePad and CharPad evidence is recorded from the official vendor manuals and local real
   examples; no guessed schema or comparative parser is used.
3. The complete RD-06 boundary suite runs once after all active phases integrate; the final
   closeout runs after Phase 10.2.
4. If the vendor example path is unavailable on a later host, the closeout records that fact
   honestly and does not claim producer verification; it may use the committed synthetic fixtures
   but must say so.
5. The roadmap and status text show `Plan Preflighted` until execution starts and `Done` only when
   every active RD-06 acceptance criterion passes. GoatTracker AC-19/AC-20 are moved to the
   follow-up feature (AR-58) and are not reported as RD-06 verification.
