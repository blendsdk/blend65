# Debug Evidence: RD-09 Developer Tooling

> **Document**: 03-06-debug-evidence.md
> **Parent**: [Index](00-index.md)

## Overview

RD-09 consumes the frozen Debug JSON version 1 contract and completes the facts a later debugger
needs: final load-unit residence, helper scratch, bank/load identity where a selected profile
produces it, cross-artifact coherence, and proof that debug emission adds no target cost. It does
not add a schema version, a debugger, a DAP service, or target instrumentation.

## Architecture

### Current Architecture

- `.debug.json` is assembled in `packages/compiler/src/services/evidence.ts:1265-1356` and derived
  by `evidence-records.ts`.
- The closed contract lives in
  `codeops/features/blend65-v4/requirements/RD-03-playable-m1-complete-pipeline.md:868-980`.
- The validator lives in `packages/compiler/src/artifacts/debug-evidence-validator.ts` and
  `debug-evidence-records.ts`.
- D64 `loadUnits[].residence` is always empty (`evidence.ts:1336-1355`).
- Helper-owned storage requests are skipped (`evidence-records.ts:649-660`).
- `.memory.json` already records `loadStates` with call site, unit id, destination interval ids,
  quiescence, and publication point (`evidence.ts:974-1017`).
- RD-07 memory intervals record exact `loadDestination` ranges.
- SFA availability already records `available`, `optimizedAway`, `constant`, `rematerializable`,
  `unavailable`, and `notMaterialized`/`notRepresentable` reasons.

### Proposed Changes

| Change | Owner |
| ------ | ----- |
| Populate `loadUnits[].residence` from memory load destinations | `services/evidence.ts` |
| Emit helper-scratch symbols for certified helper requests | `services/evidence-records.ts` |
| Emit `split` only when a real multi-piece availability exists | `services/evidence-records.ts` |
| Add an internal test observer that skips debug derivation | `services/services.ts` |
| Add cross-artifact and zero-cost tests | `test/rd09/` |
| Add the bounded adapter probe report | `docs/rd09-debug-adapter-probe.md` |

No new schema field is added.

## Implementation Details

### Load-Unit Residence

For each D64 component in `input.d64.image.files`:

1. Find the `load-unit` operations in `.memory.json` `loadStates` whose `unitId` matches the
   component id.
2. Resolve each `destinationIntervalIds` entry to the exact memory interval.
3. Emit one residence record per destination:
   `{ addressSpaceIndex: 0, start, end: interval.end + 1 }`.
4. Sort residence records by address space, bank, start. Deduplicate identical intervals.
5. A resident boot component keeps an empty residence list, because its bytes are already in the
   primary image; a loadable component with no proved destination keeps an empty list rather than
   inventing an address.

`bankIndex` is added only when the selected profile's address-space record has banks and the
destination interval names one. The current C64 profiles use `cpu16` with no banks, so no synthetic
bank index is emitted.

### Helper Scratch

For each `helperCalls[].helperRequestIds` request with a certified home:

1. Add one generated symbol with `kind: "helperScratch"`, a generated origin
   `{ kind: "generated", cause: "helper-scratch" }`, the request's exact type and byte width, and
   no source declaration span.
2. Add one location with `availability` from the certified home and the context of the owning
   function/entry variant.
3. Do not merge helper scratch with a same-spelled source binding; the ids are distinct.
4. If the request has no home or no owning context, skip it rather than emit an untruthful record.

### Availability

- Keep `available` for one contiguous or register piece.
- Emit `split` only when the producer actually has two or more pieces for one value (for example,
  a value retained in both a register and memory across a split lifetime). The validator already
  requires at least two pieces for `split`.
- Never claim `available` for a value the producer knows is not materialized; keep the existing
  `unavailable` reasons.

### Zero-Cost Observer

Add an internal (not public) build path:

```ts
interface BuildObserver {
  readonly includeDebugEvidence: boolean;
}

async function buildFresh(
  options: BuildOptions,
  pinForRun: boolean,
  observer: BuildObserver = { includeDebugEvidence: true },
): Promise<BuildResult>;
```

The public `buildProject` always passes `{ includeDebugEvidence: true }`. The package test imports
`buildFresh` directly and runs the same frozen project twice, once with `false`. It compares:

- `.asm` bytes;
- primary PRG/D64 bytes and hash;
- `.labels` and `.memory.json` target intervals;
- target symbol/memory/ZP/SFA/stack totals;
- one bounded VICE behavior observation when the fixture has a runtime path.

Only host-side `.debug.json` observation differs. The test observer is not exported from
`packages/compiler/src/index.ts` and is unavailable to users.

### Cross-Artifact Coherence

Extend the existing validation with tests that assert:

- every debug symbol/range agrees with `.labels`, `.memory.json`, `.assets.json`, `.build.json`,
  and the hashed primary artifact;
- every load-unit residence equals a memory `loadDestination` interval;
- each sidecar validates independently under its own version;
- `.build.json` hashes every other artifact but not itself;
- changing any address, bank, range, hash, generation identity, required field, or schema major
  fails validation.

### Adapter Probe

`docs/rd09-debug-adapter-probe.md` records:

- exact VICE 3.10 `x64sc` identity and debug-schema version;
- the adapter(s) available in the environment, with exact version/commit;
- source breakpoint, source/instruction step, and available-variable mapping results, each marked
  `supported`, `lossy`, or `unsupported`;
- the exact commands and fixture used;
- the translation gap from `.debug.json` to the adapter's expected input.

The probe is an interoperability test, not a product integration. No adapter is bundled, started by
the extension, or promised. If no maintained adapter is installed, the report records that result
with the checked commands and the mapping table; that is an honest `unsupported` outcome, not a
deferral of the report.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Load state without destination interval | Empty residence; no guessed address | AR-9 |
| Unknown bank | Omit `bankIndex`; no synthetic bank | AR-9 |
| Helper request without home | Skip; no untruthful location | AR-9 |
| Multi-piece value | `split` only when ≥2 real pieces; otherwise existing state | AR-9 |
| Debug observation disabled | Host-only difference; target bytes identical | AR-10 |
| No adapter installed | Report `unsupported` with exact versions/commands | AR-11 |
| Schema mismatch | Existing E10267/E10268 validation; no new precedence | AR-9 |

## Testing Requirements

- D64 fixture with sequential loads: every loadable unit has the exact residence interval, boot has
  none, and no bank is invented.
- Helper-scratch fixture: generated symbol, exact home, owning context, distinct identity.
- Split fixture only if a real split exists; otherwise record `N/A` with the evidence.
- Zero-cost observer comparison on a frozen project.
- Cross-artifact mutation tests for address, bank, load unit, range, hash, generation, and schema
  major.
- Adapter probe report presence and exact version fields.
- Portable-root test: two byte-identical projects at different roots produce identical normalized
  debug evidence.
