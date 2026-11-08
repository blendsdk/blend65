# Ambiguity Register: RD-06 Native Assets, Compile-Time Composition, and Resident Layout

> **Status**: ✅ GATE PASSED — all 59 items resolved
> **Last Updated**: 2026-11-07
> **CodeOps Artifact Schema**: 1

This register records the plan-local decisions for the RD-06 implementation plan. RD-06 itself
already resolves the product scope, exact handler identities, selector contracts, diagnostic
ownership, and placement doctrine; those rows cite the owning requirement instead of repeating it.

## Plan-local decisions (user-confirmed)

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-1 | Scope | With no SpritePad 3.80, CharPad 3.88 or GoatTracker 2.77 producer evidence on this Linux host, what does the first RD-06 plan cover? | Full RD-06 plan with explicit blocked family checkpoints / unblocked slices only / wait for all evidence | Full plan. The licensed applications and their vendor format manuals plus real example files are available at `/home/gevik/workdir/github/blend65.ri/apps`; SpritePad and CharPad are executable. GoatTracker is moved out of RD-06. | ✅ Resolved |
| AR-2 | Scope | Is the GoatTracker 2.77 callable-audio adapter a phase of this plan or a later separate plan? | Evidence-gated phase here / separate follow-up plan / exclude until evidence | Move the GoatTracker 2.77 adapter out of RD-06 to a later follow-up. RD-06 keeps the generic `c64.audio` surface, the empty contract map and E10256/E10257/E10258 analysis, and closes without the GT binding after the requirement amendment. | ✅ Resolved |
| AR-3 | Behavioral | May a native registered format appear in a `loadable const` initializer during RD-06? | Fail closed in RD-06 / parse natively but emit nothing / leave today's behavior | Fail closed in RD-06. The embed call reports E10204 on the call span with a precise resident-only-profile message and RD-07 as the owner. Raw `loadable const` behavior is unchanged. A temporary expressiveness-ledger entry records the restriction. | ✅ Resolved |
| AR-4 | Technical | Where does the generic asset-handler seam live, and where do C64-specific handlers live? | Target-neutral contract in `assets/` plus C64 implementations under `assets/c64/` / one `assets/native` module / hardcoded per-handler dispatch / `target/c64-assets/` | A target-neutral contract in `packages/compiler/src/assets/` and C64 implementations under `packages/compiler/src/assets/c64/`. The frontend profile owns the extension-to-handler map, reserved extensions and key/version data. `target/` remains machine facts only. This preserves the enforced frontend import boundary. No public plugin registry. | ✅ Resolved |
| AR-5 | Technical | Which VIC bank range does RD-06 place and prove? | Selected bank 0 only / all four VIC banks / reject `region` entirely | Selected bank 0 only. The profile exports one `c64.vic.bank0` region. Other bank regions are rejected as unavailable. Multi-bank selection remains later platform work. | ✅ Resolved |
| AR-6 | Non-functional | Which command set fills the plan's Verify lines? | Project commands from `AGENTS.md` / a different user-supplied command | `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`; package tests via `yarn workspace @blend65/compiler test src/...`, root tests via `yarn vitest run test/...`, directed tests during tasks, the complete RD-06 boundary suite at phase checkpoints, and sequential VICE cases. `yarn prettier --check` for touched Markdown and source. | ✅ Resolved |
| AR-7 | Naming & terminology | Where do producer and public-format fixtures and their manifest live? | `test/rd06/fixtures/` / package-local fixtures / planning-folder fixtures | `test/rd06/fixtures/manifest.json` with family folders under `test/rd06/fixtures/` and public-format fixtures under `test/rd06/fixtures/public/`. Helper tools live in `test/rd06/fixture-tools/`. | ✅ Resolved |
| AR-8 | Scope | Where does the Q-P15 Integrator-style qualification workload live? | Test-only `test/rd06/qualification/q-p15/` / public `examples/q-p15/` / both | Test-only `test/rd06/qualification/q-p15/`. It is qualification source, not emitted support or a public library. | ✅ Resolved |
| AR-9 | Data & state | Which canonical identity deduplicates native embedded objects? | Full resolved identity / old identity plus selector / output hash only | `blend65-asset-v1` hashes handler key, handler version, project-relative path, input SHA-256, resolved selector, representation and output SHA-256. Raw keeps `blend65-raw-v1`. The `.assets.json` evidence id is extended additively to include the input identity and representation so distinct files with equal output bytes remain distinct. | ✅ Resolved |
| AR-10 | Technical | How do scalar selectors enter the typed frontend? | Typed scalar embedded value / one-element array / inline numeric literal | Add an `EmbeddedScalarValue` union variant carrying exact Blend65 scalar type, compile-time value, asset identity and provenance. Scalar and zero-byte outputs are compile-time-only: they do not enter `residentAssetRoots`, layout, `.memory.json` or `.costs.json`. `.assets.json` records them with an additive `placement.kind:"compileTime"` variant. | ✅ Resolved |
| AR-11 | Behavioral | How are asset placement failures split between E10143 and E10273? | Split by source / E10273 for all / E10143 for all | E10143 for one object's handler-derived alignment or visibility failure. E10273 for source `place(...)`, cross-object, bank, character-ROM, reserved-range, impossible-set and interval conflicts. Both name every contributing requirement. | ✅ Resolved |
| AR-12 | Non-functional | What bounded resource rule do the native parsers use? | Fixed per-handler limits / keep 65,535-byte cap / configurable budget | Fixed constants: 1 MiB maximum native input, 256 sprite records, validated counts with overflow-safe arithmetic, exact EOF, and selected outputs at most 65,535 bytes. Raw input remains 65,535 bytes / E10265. Native input uses a separate bounded read with E10204 over-limit. No configurable budget; the existing snapshot cache is unchanged. | ✅ Resolved |
| AR-13 | Behavioral | How does E10258 detect unsafe non-reentrant player overlap? | Static domain overlap / direct handler calls only / runtime guard | Reject when a non-reentrant player operation is reachable from two concurrent domains or mainline plus interrupt, using existing whole-program reachability and SFA interrupt-domain facts. No runtime lock. | ✅ Resolved |
| AR-14 | Data & state | Which views should `.memory.json` report for RD-06? | Add VIC bank and Color RAM views / extend CPU view only / scalar totals only | Keep `cpu16-resident`, add a `vic-bank-0` view and a `color-ram` hardware view. Report free intervals, total free bytes and largest hole per view; screen 1024, Color RAM 1024, character ROM 4096. The CPU free partition is bounded to the allocatable resident window; the VIC view uses the same `cpu16` address space; Color RAM uses a separate `colorram4` space. | ✅ Resolved |
| AR-15 | Data & state | Which schema should the RD-06 fixture manifest use? | One JSON manifest / YAML / per-family manifests | `test/rd06/fixtures/manifest.json`, schema version 1: per-fixture id, family, path, provenance, producer version, settings, license, SHA-256, expected parse/selectors, and malformed derivation. | ✅ Resolved |

## Decisions owned by RD-06 (pre-resolved upstream)

| # | Category | Ambiguity / Gap | Authority | Status |
|---|----------|-----------------|-----------|--------|
| AR-16 | Feature gaps | Which native handlers and exact producer/interchange identities are in scope? | RD-06 R6.1, R6.8, R6.13, R6.20, R6.27; AR-040 | ✅ Resolved |
| AR-17 | Behavioral gaps | How are handlers selected and when is a file validated? | RD-06 R6.3; Specification 4 Ch 13 EMB-5/6 | ✅ Resolved |
| AR-18 | Behavioral gaps | What happens on an unregistered extension? | RD-06 R6.31; Specification 4 Ch 13 §2.1 | ✅ Resolved |
| AR-19 | Data & state | What is the exact SpritePad selector surface? | RD-06 R6.9–R6.11; Specification 4 Appendix C64 §7.1 | ✅ Resolved |
| AR-20 | Data & state | What is the exact CharPad selector surface? | RD-06 R6.14–R6.18; Specification 4 Appendix C64 §7.2 | ✅ Resolved |
| AR-21 | Data & state | What is the exact PSID selector surface and load-address rule? | RD-06 R6.20–R6.22; Specification 4 Appendix C64 §7.3 | ✅ Resolved |
| AR-22 | Data & state | What is the exact Koala selector surface and high-bit rule? | RD-06 R6.27–R6.30; Specification 4 Appendix C64 §7.4; AR-039, AR-041 | ✅ Resolved |
| AR-23 | Behavioral gaps | What types may a handler return? | RD-06 R6.5; Specification 4 Ch 13 EMB-1 | ✅ Resolved |
| AR-24 | Behavioral gaps | Which handlers have defaults and what are they? | RD-06 R6.9, R6.13, R6.21, R6.27; Appendix C64 §7 | ✅ Resolved |
| AR-25 | Behavioral gaps | Are unselected components emitted? | RD-06 R6.6; AC-05; Specification 4 Ch 13 §4 | ✅ Resolved |
| AR-26 | Data & state | What aliasing is legal? | RD-06 R6.7; AC-06; Specification 4 Ch 13 §4 | ✅ Resolved |
| AR-27 | Integration points | How does compile-time refinement compose without a game engine? | RD-06 R6.32–R6.35; AR-019, AR-038 | ✅ Resolved |
| AR-28 | Scope ambiguities | What must the Q-P15 workload prove? | RD-06 R6.36–R6.37; AC-26/27; expert `c64-game-engineering.md` §Q-P15 | ✅ Resolved |
| AR-29 | Technical unknowns | What layout model replaces scalar-only placement? | RD-06 R6.38–R6.40; AC-28/29 | ✅ Resolved |
| AR-30 | Technical unknowns | Which hardware fields derive from final placement? | RD-06 R6.41; AC-10/23; Appendix C64 §7.1–7.4 | ✅ Resolved |
| AR-31 | Non-functional gaps | How are screen, Color RAM and reserved intervals reported? | RD-06 R6.42; AC-31; expert `c64-game-engineering.md` §Q-P15 | ✅ Resolved |
| AR-32 | Edge cases | What happens when a resident set cannot fit? | RD-06 R6.43; AC-10/30 | ✅ Resolved |
| AR-33 | Behavioral gaps | Can source `place(...)` weaken handler or profile constraints? | RD-06 R6.44; Specification 4 Ch 11 §2.3 | ✅ Resolved |
| AR-34 | Integration points | What may ACME receive? | RD-06 R6.45; AC-29 | ✅ Resolved |
| AR-35 | Data & state | Which evidence fields must be published? | RD-06 R6.46; AC-31 | ✅ Resolved |
| AR-36 | UX & presentation | Which diagnostics and message qualities are required? | RD-06 R6.47–R6.48; AC-33; Specification 4 Ch 14 | ✅ Resolved |
| AR-37 | Data & state | What must the fixture manifest record? | RD-06 R6.49; AC-32 | ✅ Resolved |
| AR-38 | Non-functional gaps | What test tiers are required and what is forbidden? | RD-06 R6.50–R6.51; AC-34 | ✅ Resolved |
| AR-39 | UX & presentation | How is public qualification status reported? | RD-06 R6.52; AC-35 | ✅ Resolved |
| AR-40 | Scope ambiguities | What must closeout prove about deferrals? | RD-06 R6.53; AC-37 | ✅ Resolved |
| AR-41 | Integration points | What frontend asset metadata is exposed to RD-09? | RD-06 R6.55 | ✅ Resolved |
| AR-42 | Scope ambiguities | Are focused examples required? | RD-06 R6.54 | ✅ Resolved |
| AR-43 | Non-functional gaps | What host observations are recorded? | RD-06 R6.56; AR-026 | ✅ Resolved |
| AR-44 | Technical unknowns | What is the audio-player contract record shape? | RD-06 R6.23–R6.25; Appendix C64 §7.3.1. A closed typed record with placement, entries, writable/self-modifying ranges, banking, register/flag/decimal/interrupt-state/$01/stack/RAM/ZP/MMIO effects, inventories, voice mapping, priority/replacement/resume/same-frame rules, video/SID topology, cadence, call domains, interrupt/CIA/SID ownership, feature-dependent sizes and costs. The baseline map is empty. | ✅ Resolved |
| AR-45 | Data & state | How is `sprite_attributes` derived? | RD-06 R6.9–R6.10; Appendix C64 §7.1. It is the packed attribute byte (record byte 63) extracted from each native 64-byte record into its own contiguous table. | ✅ Resolved |
| AR-46 | Data & state | How is packed-12 formed? | RD-06 R6.17; AC-13; Appendix C64 §7.2. Low bytes first, then `ceil(N/2)` high-nibble bytes; the absent odd partner contributes zero. | ✅ Resolved |
| AR-47 | Data & state | How does a PSID fixed load address interact with source placement? | RD-06 R6.21, R6.44. The effective load address is a handler constraint; source `place(...)` may only strengthen it. A source conflict is E10273; a handler-only failure is E10143. | ✅ Resolved |
| AR-48 | Naming & terminology | What names identify the new modules, tests and plan? | Plan convention: `assets/asset-handler.ts`, `assets/asset-dispatch.ts`, `assets/c64/*`, `test/rd06/*.spec.test.ts`, `test/rd06/*.impl.test.ts`, `test/rd06/fixture-tools/*`, plan folder `rd-06-native-assets`. Forced by AR-4 and the repository naming rules. | ✅ Resolved |
| AR-49 | Technical unknowns | How is the frontend given the selected profile for asset dispatch? | The frontend profile (`frontend/profile.ts`) owns the asset facts: extension map, reserved extensions, handler keys/versions, `c64.vic.bank0` region and empty player contracts. It imports the pure handlers from `assets/c64/`; no frontend file imports `target/` or another backend path. The target profile remains machine facts only. | ✅ Resolved |
| AR-50 | Data & state | Which malformed and adjacent-version derivations are required? | RD-06 R6.12/R6.19 and AC-09/AC-15: v4/v6 or v8/v10 headers, every block truncation, count/index mismatch, wrong block order, trailing bytes, and exact-field failures. Derived from authentic fixtures, never hand-authored substitutes. | ✅ Resolved |
| AR-51 | Scope | RD-06 R6.1 says producer evidence must exist before implementation planning, but this plan started without it. What is the planning boundary? | Define contract/gate only / enforce R6.1 literally / stop planning | The vendor manuals and selected real producer examples in `/home/gevik/workdir/github/blend65.ri/apps` satisfy the evidence boundary. The SPD v5 and CTM v9 parser designs may now be concrete; no guessed schema remains. | ✅ Resolved |
| AR-52 | UX & presentation | RD-06 R6.47 says there is no percentage-based embedded-data warning, but frozen Specification 4 defines W10150 and the compiler emits it. Which authority wins? | Keep W10150 / retire W10150 | Keep the frozen Specification 4 W10150 unchanged. Interpret R6.47 as "no new percentage warning beyond the existing W10150"; record the interpretation in the plan and closeout. | ✅ Resolved |
| AR-53 | Behavioral | How are reserved-but-unimplemented native extensions handled before their handler registration? | Raw fallback / fail-closed reserved set / placeholder handler | The frontend profile declares a closed `reservedExtensions` set. `.spd` and `.ctm` return E10204 before raw fallback until their handlers are registered in Phases 7/8. A malformed registered file never bypasses its handler. | ✅ Resolved |
| AR-54 | Data & state | Which schema authority governs SPD v5 and CTM v9 parsing? | Vendor manual + real examples / web notes / comparative parser | Use the official installed vendor manuals `File Format - SPD (V5).htm` and `File Format - CTM (V9).htm` as the exact field/block authority, plus selected real producer examples as acceptance fixtures. No comparative parser or guessed schema. | ✅ Resolved |
| AR-55 | Data & state | The installed CharPad is 3.80 Pro, while RD-06 pinned 3.88. Which producer version is authoritative? | 3.80 / 3.88 / any CTM v9 writer | Use the installed CharPad C64 Pro 3.80. CTM v9 is the format contract (introduced in CharPad 3.5); record the actual 3.80 producer version and amend the RD pin to 3.80+ with CTM v9. | ✅ Resolved |
| AR-56 | Data & state | Can the vendor example files be committed? | Commit originals / local-only + synthetic fixtures / ignore | Treat the real examples as local-only evidence because the EULA does not grant redistribution of the bundled files. Commit a producer-evidence manifest with paths, versions and SHA-256 values plus synthetic fixtures generated from the official format manuals. | ✅ Resolved |
| AR-57 | Data & state | Is the full MIN/ALL/WIDE/optional matrix still required? | Full matrix / selected real examples + synthetic coverage | Replace the full manual matrix with selected real producer examples and synthetic coverage derived from the official manual: optional components, truncation, adjacent versions, boundary counts and display/color/tile combinations. | ✅ Resolved |
| AR-58 | Scope | Does RD-06 still need the GoatTracker 2.77 adapter to close? | Keep as blocker / move to follow-up / drop entirely | Move the adapter to a follow-up. Amend RD-06 R6.24–R6.26/AC-19/AC-20 to a later owned feature; RD-06 closes with the generic audio seam and empty contract map. | ✅ Resolved |
| AR-59 (runtime) | Behavioral | With an empty audio contract map, no legal callable-audio operation exists. Should Phase 2 still implement lowering and whole-program E10258 integration? | Implement dead lowering now / gate lowering and E10258 activation on the first contract | Authority: AI — delegated by --auto-design. Eligibility: implementation mechanism inside the approved generic-audio seam; no product behavior change. Decision: keep the typed contract record, contract lookup, E10257 validation and domain-overlap primitive; do not add unreachable lowering or whole-program E10258 wiring. Every source call is E10256 before lowering. T-19 adds the contract, lowering and E10258 activation together. Evidence: empty `AUDIO_PLAYER_CONTRACTS`; E10256 precedes any operation; dead lowering would violate the no-dead-code standard. Rejected: unreachable lowering now (dead code, untested); runtime contract injection (new product surface). Strongest counterargument: the plan text names lowering; however an operation without a contract has no entry address, ABI or writable ranges to lower, so the code would be unverifiable. Confidence: High. Policy version: 1. Root invocation ID: rd06-exec-2026-11-08. Reopen triggers: a contract is registered or T-19 starts. | ✅ Resolved |

## Resolution Notes

**AR-1 / AR-51:** RD-06 R6.1, R6.12, R6.19, R6.49 and R6.52 make producer evidence a hard
prerequisite for the SpritePad and CharPad decoder families. The handoff checklist is
[00-rd-06-producer-evidence-handoff.md](../../00-rd-06-producer-evidence-handoff.md). AR-51 records
the planning boundary explicitly; it does not waive the execution gate.

**AR-2:** RD-06 R6.24 and AC-19 require GoatTracker 2.77 as the first qualified adapter, but no
exported player or tune evidence exists in the checkout. The generic audio surface can be built and
tested with the empty contract map; the GoatTracker binding remains blocked.

**AR-3:** RD-06 is resident-only; RD-07 owns `loadable const`, D64 packaging and loaders. E10204 is
used as a temporary resident-only boundary because E10275 is a load-call diagnostic. The
expressiveness ledger records the restriction until RD-07 lands.

**AR-4 / AR-49:** The import-boundary test treats `target` as backend and scans real frontend
sources. C64 handlers therefore live under `assets/c64/`, which is a pure parser layer, while the
frontend profile owns the handler keys and extensions as data. `target/` remains machine facts.

**AR-9 / AR-10:** The existing raw identity stays stable. Native identity includes every input that
can change the selected output. Scalar and zero-byte outputs are compile-time-only and never enter
resident layout; `.assets.json` records them with an additive `compileTime` placement variant.

**AR-11:** E10143 is the one-object alignment/visibility diagnostic. E10273 owns source
`place(...)`, cross-object, bank, character-ROM, reserved-range and impossible-set conflicts. A
failure involving both reports the specific contributor as primary with related spans.

**AR-12:** The limits are parser safety constants, not a configurable budget. Raw input stays at
65,535 bytes; native input has a separate 1 MiB read and a 65,535-byte selected-output gate.

**AR-13:** The existing whole-program reachability and SFA interrupt-domain analysis already
distinguishes mainline, IRQ, NMI and nested domains. E10258 reuses those facts.

**AR-14:** The `cpu16-resident` view keeps its existing meaning but bounds free/hole reporting to
the allocatable resident window. The new `vic-bank-0` view uses the same `cpu16` address space. The
`color-ram` view uses a separate `colorram4` space and one reserved hardware interval.

**AR-51:** No byte-level SPD/CTM schema is invented before the producer files arrive. The selector
tables come from Specification 4 and remain type-level contracts.
