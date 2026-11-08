# Current State: RD-06 Native Assets, Compile-Time Composition, and Resident Layout

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What exists

| Area | Current behavior | Evidence |
| --- | --- | --- |
| `embed()` syntax | Ordinary identifier parsed as a call; two literal arguments accepted; owner must be a module-level ordinary `const` or any `loadable const` | `packages/compiler/src/frontend/source-discovery.ts:197-313`, `packages/compiler/src/frontend/expressions.ts:244-294` |
| Raw reading | Bounded 65,535-byte read, source-relative then ordered `assetPaths`, containment, `O_NOFOLLOW`, identity/hash, cache revalidation | `packages/compiler/src/assets/raw-asset.ts:14-360` |
| Typed value | Only `EmbeddedValue` byte arrays; scalar selectors have no representation | `packages/compiler/src/assets/asset-types.ts:17-29` |
| Resident assumption | Every embedded declaration becomes a resident root and every reachable asset becomes a byte-backed layout object | `packages/compiler/src/semantic/lower.ts:250-258`, `packages/compiler/src/machine/lower-data.ts:150-165` |
| Native dispatch | Hardcoded extension regex; every readable native file returns E10204; `.ctm` without selector returns E10132 | `packages/compiler/src/frontend/service.ts:577-632` |
| Native handlers | None. No SpritePad, CharPad, PSID, Koala or player-adapter code exists | repository search; no `.spd/.ctm/.sid/.kla/.koa` fixtures |
| Asset identity | Raw identity only; handler/selector are always `raw`/`raw` | `packages/compiler/src/assets/raw-asset.ts:265-283`, `packages/compiler/src/services/evidence.ts:153-162` |
| Semantic assets | `SemanticAsset` carries path, hash, bytes, optional source placement; no handler provenance or handler constraints | `packages/compiler/src/assets/asset-types.ts:3-15` |
| Layout | Scalar first-fit over inclusive intervals; one selected VIC bank 0; sprite assets start at `$2000`; non-sprite assets use source placement | `packages/compiler/src/layout/c64-layout.ts:464-564`, `packages/compiler/src/layout/c64-layout-placement.ts:33-87` |
| VIC fields | Only `vicSpriteBlock` exists; charset/bitmap/screen selectors are spec-only | `packages/compiler/src/frontend/profile.ts:326`, `packages/compiler/src/layout/c64-layout-objects.ts:122-152` |
| Compile-time evaluation | `comptime function`, arrays/structs, aggregate returns, shared budget, no file/MMIO/runtime calls | `packages/compiler/src/frontend/comptime.ts:56-519`, `packages/compiler/src/frontend/comptime-budget.ts:4-9` |
| Evidence | `.assets.json`, `.memory.json`, `.costs.json`, `.debug.json` version-1 sidecars with validators and atomic publication | `packages/compiler/src/services/evidence.ts`, `packages/compiler/src/artifacts/*-validator.ts`, `packages/compiler/src/publication/publication.ts` |
| VICE harness | Pinned VICE identity, monitor API, keyboard/joystick injection, cleanup, profile fixtures | `test/m1/vice-runtime.ts`, `test/m1/vice-monitor.ts`, `test/rd05/profile-fixture.ts`, `test/rd05/gdb-vice-fixture.ts` |

### Relevant files

| File | Purpose | Changes needed |
| --- | --- | --- |
| `packages/compiler/src/frontend/service.ts` | Asset-aware analysis and native stub | Replace extension regex with profile-owned dispatch; pass owner kind; call handlers |
| `packages/compiler/src/frontend/source-discovery.ts` | Literal request discovery | Add owner kind and preserve selector/span |
| `packages/compiler/src/assets/asset-types.ts` | Embedded value and semantic asset | Add scalar value, handler provenance, constraints, input/output hashes |
| `packages/compiler/src/assets/raw-asset.ts` | Raw reader | Keep unchanged except shared input identity/hash helpers |
| `packages/compiler/src/frontend/builtin-calls.ts` | Injection of embedded values | Accept scalar and array variants; distinguish E10144 |
| `packages/compiler/src/frontend/aggregates.ts` | Array type checking | Route selector type mismatches to E10144 |
| `packages/compiler/src/frontend/profile.ts` | Frontend profile, capabilities and constants | Add `c64.audio` and `vicCharsetSelect`/`vicBitmapSelect`/`vicScreenSelect`; own the handler/extension map, reserved extensions and `c64.vic.bank0`; import pure handlers from `assets/c64/` |
| `packages/compiler/src/assets/c64/` | C64 native handlers | New SpritePad, CharPad, PSID, Koala, audio-contract and VIC-field modules |
| `packages/compiler/src/target/profile.ts` | Target machine facts | Keep machine facts only; no asset-handler functions |
| `packages/compiler/src/layout/` | Resident layout | Add VIC/Color RAM views, free intervals, asset constraints, PSID fixed load |
| `packages/compiler/src/services/evidence.ts` | Sidecar production | Populate handler/selector/constraints/placement/costs |
| `packages/compiler/src/machine/lower-c64.ts`, `packages/compiler/src/machine/lower-platform.ts`, `packages/compiler/src/machine/lower-call.ts` | Platform and call lowering | Add derived-field transforms and player-call lowering |
| `test/rd06/` | New qualification area | Fixtures, fixture tools, integration, examples and VICE tests |

### Code analysis

The current raw path ends in a frozen `EmbeddedValue` with `kind: "embedded"` and an `ArrayType`.
The typer injects that value only for the exact call span (`builtin-calls.ts:43-54`). Any native
handler that returns a scalar must therefore add a second value variant and teach the typer,
injection, constant evaluation, and evidence writer about it. A one-element array would be a type
lie and would break `const COUNT: word = embed(...)`.

The current dispatch is hardcoded in `service.ts`. It knows the five native extensions, but the
selected profile does not own the map. RD-06 R6.2 requires the selected platform to own handler
identity, so the plan moves the map into the frontend profile and leaves the core service with a
generic lookup. The C64 parser implementations live in `assets/c64/`, not `target/`, because
`test/import-boundary.ts` treats `target` as backend and scans real frontend sources.

The current layout is already interval-based for occupancy, but it has one CPU view and one bank.
It does not skip the character-ROM window for ordinary data, does not enforce 2-KiB charset or
8-KiB bitmap alignment, and does not pair Koala bitmap/screen visibility. The plan extends the
existing first-fit with explicit constraints and views; it does not add a second allocator.

## Gaps Identified

### Gap 1: No native handler seam or typed scalar values

**Current behavior:** Every native extension is rejected with E10204; only raw arrays exist.
**Required behavior:** A profile-owned handler map returns exact scalar or fixed-array outputs with
provenance, constraints and selector inventory.
**Fix required:** AR-4 seam, AR-9 identity, AR-10 scalar value, dispatch and typing changes.

### Gap 2: Producer-gated families have no authentic evidence

**Current behavior:** No `.spd`, `.ctm`, `.sid`, `.kla` or `.koa` fixture exists; no GoatTracker
export exists.
**Required behavior:** SpritePad/CharPad decoders and the GT adapter are implemented only after
their exact evidence checkpoints pass.
**Fix required:** Keep those phases blocked; create public PSID/Koala/raw fixtures now.

### Gap 3: Resident layout lacks asset-specific alignment, visibility and views

**Current behavior:** Sprite assets are 64-byte aligned inside bank 0; ordinary data does not skip
character ROM; `.memory.json` has one CPU view; sprite first-fit starts at `$2000` and only moves
upward.
**Required behavior:** 64/1,024/2,048/8,192-byte alignment, VIC visibility, global character-ROM
avoidance, same-bank pairing, full-bank sprite hole search, bank-relative free intervals, and honest
reservation accounting.
**Fix required:** AR-14 and the layout/evidence component.

### Gap 4: Evidence still reports every asset as raw

**Current behavior:** `.assets.json` always writes `handler:"raw"`, `selector:"raw"`, empty
constraints except sprite alignment, and a single placement.
**Required behavior:** Exact handler, version, selector, input/output hashes, constraints,
placement, aliases, writable ranges and zero/runtime costs.
**Fix required:** Populate the existing version-1 records and validate them.

### Gap 5: Callable audio and VIC selectors are absent

**Current behavior:** No `c64.audio` module, no `vicCharsetSelect`, `vicBitmapSelect` or
`vicScreenSelect`, no player contract, no E10256/E10257/E10258/E10261.
**Required behavior:** Empty contract map with E10256 for plain PSID; exact `$D018` derivations;
blocked GT binding.
**Fix required:** Generic audio surface and VIC field operations; GT binding after evidence.

## Dependencies

### Internal dependencies

- RD-03 version-1 evidence schemas, publication and ACME reconciliation.
- RD-04 typed fixed arrays/structs, aggregate returns, `comptime function`, diagnostics.
- RD-05 C64 profiles, typed hardware operations, interrupt domains, startup/bank 0, VICE harness.
- Existing raw asset reader, path containment, snapshot and cache.

### External dependencies

- ACME 0.97 is version-pinned and its discovered executable SHA-256 is recorded.
- VICE 3.10 is version-pinned; the Linux executable is recorded/verified by banner and the Windows
  bundle is SHA-256 pinned. Four cooperative profiles are in use.
- SpritePad 3.80 and CharPad 3.80 official manuals and real examples under `/home/gevik/workdir/github/blend65.ri/apps`; GoatTracker is a follow-up.
- HVSC `SID_file_format.txt` SHA-256 `b89a78d3c1d90d0b8c6b4cfd2001be026ad6c2c31b73cdbab857c627a60779f0`.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Producer evidence never arrives | Medium | High | Explicit blocked phases; RD-06 cannot close; no guessed schema |
| Scalar selector change breaks raw typing | Medium | High | Separate `EmbeddedScalarValue`; keep raw array path unchanged |
| Layout extension changes existing output | Medium | High | Preserve `none` artifacts except programs that cross the character-ROM window; audit and regression-test existing M1/RD-05 fixtures |
| Evidence schema drift | Low | High | Reuse version-1 field sets; validator tests; no new sidecar family |
| VIC bank 0 only is read as full banking support | Medium | Medium | Honest status text; reject other regions; record the boundary |
| Audio overlap analysis over-rejects | Medium | Medium | Reuse existing domain facts; prove with positive and negative fixtures |
| Blocked phases are mistaken for verified work | Low | High | `[!]` markers, status text, and closeout gate |

## Relevant evidence

- RD-05 closeout: `codeops/features/blend65-v4/plans/rd-05-keyboard-input/09-closeout.md`
- RD-03 evidence: `codeops/features/blend65-v4/plans/rd-03-pipeline-completion/08-closeout.md`
- RD-04 evidence: `codeops/features/blend65-v4/plans/rd-04-language-completion/08-closeout.md`
- Specification 4: `spec/13-data-inclusion.md`, `spec/14-diagnostics.md`, `spec/appendix-c64.md`
