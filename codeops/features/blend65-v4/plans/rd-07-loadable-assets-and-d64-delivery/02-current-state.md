# Current State: RD-07 Loadable Assets and D64 Delivery

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What exists

| Area | Current state | Evidence |
| ---- | ------------- | -------- |
| `loadable` syntax | Lexer, parser, module/local/for-header forms, `place(...)` rejection | `packages/compiler/src/frontend/tokens.ts:57`, `parser-declarations.ts:250`, `statements.ts:372` |
| Typed declaration | `loadable` boolean retained on binding/declaration; exact type and initializer retained | `frontend/semantic-types.ts:141`, `semantic-analysis-types.ts:11`, `analyzer.ts:408` |
| Initializer bytes | Scalars, packed aggregates, encoded bytes, embedded asset values | `frontend/constant-bytes.ts:33`, `assets/asset-types.ts:10` |
| Illegal resident use | E10274 for read/index/address/argument; E10272 for `place` | `frontend/scalar-expressions.ts:341`, `parser.ts:455` |
| Load rejection | E10275 for PRG profiles; E10204 for native assets under loadable | `frontend/scalar-expressions.ts:192`, `assets/asset-dispatch.ts:69` |
| D64 profile identity | Manifest allowlist and frozen spec; target selection rejects it | `project/manifest.ts:30`, `target/profile.ts:215`, `spec/15-platform-profile.md:38` |
| Artifact publication | Eight-file immutable generation, current record, predecessor, pins, lock, cleanup | `publication/publication.ts:215`, `publication/current-record.ts:326`, `publication/cleanup.ts:16` |
| Sidecars | `.asm`, `.labels`, `.assets.json`, `.memory.json`, `.costs.json`, `.debug.json`, `.build.json` | `services/evidence.ts:951`, `publication/publication.ts:36` |
| Evidence schemas | Version 1, hand-written validators; D64 package and loadable/loader records admitted but not produced | `artifacts/build-evidence-validator.ts:168`, `assets-evidence-validator.ts:469`, `debug-evidence-records.ts:583` |
| Layout | Greedy first-fit over intervals; SFA homes already closed; VIC windows; free-space utility | `layout/c64-layout.ts:218`, `layout/c64-layout-placement.ts:57`, `services/evidence.ts:250` |
| SFA | Machine lowering produces the symbolic program; shared-storage closure then closes SFA and final layout places it | `storage/closure.ts:386`, `services/shared-storage.ts:203` |
| VICE run | Fresh build, pin, `x64sc` argv, autostart PRG, cancellation, cleanup | `services/services.ts:802`, `services/vice.ts:259` |

### Relevant files

| File | Purpose | Change needed |
| ---- | ------- | ------------- |
| `packages/compiler/src/frontend/analyzer.ts` | Module analysis and initializer bytes | Retain loadable units |
| `packages/compiler/src/frontend/analyzer-scalars.ts` | Local const analysis | Materialize local loadable units |
| `packages/compiler/src/frontend/scalar-expressions.ts` | E10274/E10275 | Add load operation acceptance |
| `packages/compiler/src/frontend/flow-facts.ts` | Reaching facts and conditional effect | Add load publication facts |
| `packages/compiler/src/frontend/semantic-types.ts` | Binding/place/fact types | Add load capture facts |
| `packages/compiler/src/semantic/lower.ts` | Semantic globals and assets | Add unit inventory and operation |
| `packages/compiler/src/semantic/whole-program.ts` | Reachability and effects | Include reachable load units |
| `packages/compiler/src/semantic/operations.ts` | Semantic operation union | Add `load-unit` operation |
| `packages/compiler/src/machine/lower-c64.ts` | Platform lowering | Emit KERNAL sequence |
| `packages/compiler/src/storage/` | SFA closure | Reserve loader workspace |
| `packages/compiler/src/layout/` | Placement | Add destination/loader intervals |
| `packages/compiler/src/target/profile.ts` | Profile composition | Add D64 profile |
| `packages/compiler/src/packaging/d64/` | New | Pure serializer |
| `packages/compiler/src/services/evidence.ts` | Sidecar producer | Add D64/load records |
| `packages/compiler/src/services/vice.ts` | VICE argv | Add drive-8 mount |
| `packages/compiler/src/publication/` | Primary artifact | Accept D64 |

### Code analysis

The current build pipeline is:

```text
snapshot -> frontend -> semantic lower -> whole-program -> machine lower
  -> shared-storage draft/final close -> final layout -> ACME -> evidence -> publish
```

Loadable declarations are analyzed and their initializer bytes are computed, but
`semantic/lower.ts:225-238` omits them from semantic globals, `semantic/whole-program.ts:443-479`
never makes them reachable, and `machine/lower-data.ts:150-154` emits only resident assets. The
result is truthful zero residency but no delivery path.

The existing flow facts already model conditional success:
`ScalarConditionalEffect` carries a result identity, destination state, and captured range
(`frontend/semantic-types.ts:543`), `mergeScalarFacts` intersects initialized ranges and drops
disagreeing effects (`flow-facts.ts:66`), and `creditConditionalSuccess` credits a true edge
(`flow-facts.ts:103`). No production producer exists yet.

The layout interval model has no address-space field; `cpu16` and `cpu16-vic` are evidence strings
(`services/evidence.ts:346`). The D64 packager therefore owns disk geometry, not a new memory model.

## Gaps Identified

### Gap 1: No loadable unit inventory

**Current behavior:** loadable declarations are dropped before semantic globals.
**Required behavior:** every reachable declaration has an exact unit identity, type, bytes, hash,
provenance, and placement constraints.
**Fix required:** collect units in the frontend/semantic boundary and retain them through lowering.

### Gap 2: No load operation or destination proof

**Current behavior:** every load call on a PRG profile is E10275; the D64 profile is not executable.
**Required behavior:** the D64 profile accepts `c64.loader.load` and proves every possible complete
destination interval.
**Fix required:** add the profile capability, semantic operation, place capture, candidate-set
proof, and E10275 reasons.

### Gap 3: No publication/alias analysis producer

**Current behavior:** the conditional-effect data structure exists but is never produced.
**Required behavior:** success/failure edges, joins, loops, retries, stored results, and aliases
prove exact initialization without runtime state.
**Fix required:** produce and consume load capture facts in the existing flow analysis.

### Gap 4: No loader lowering or resource contract

**Current behavior:** no `c64.loader` capability, no KERNAL sequence, no loader reservations.
**Required behavior:** exact SETLFS/SETNAM/LOAD, carry/end-address validation, direct placement,
quiescence, and closed resources.
**Fix required:** add the capability, inline lowering, success check, and SFA/layout reservations.

### Gap 5: No D64 packager

**Current behavior:** no D64 writer, reader, allocator, BAM, directory, or name encoder.
**Required behavior:** one deterministic 174,848-byte image with exact geometry and an independent
oracle.
**Fix required:** add the pure packager and test-only decoder.

### Gap 6: No D64 artifact/publication/run path

**Current behavior:** publication requires `package.kind: "prg"`; VICE only autostarts a PRG.
**Required behavior:** `<name>.d64` is the primary artifact, and `run` mounts it as drive 8.
**Fix required:** compose the D64 target profile, extend publication, and add the exact VICE argv.

### Gap 7: No D64 evidence

**Current behavior:** D64 package, loadable asset, loader, destination, and load-unit records are
validator-only.
**Required behavior:** every RD-07 field is produced and reconciles across sidecars.
**Fix required:** extend the existing version-1 producers and cross-sidecar checks.

## Dependencies

### Internal dependencies

- RD-01 frozen Specification 4 and expert `2.0.4`.
- RD-02 project snapshot, atomic publication, pins, and `run`.
- RD-03 artifact/evidence schemas and VICE observation boundary.
- RD-04 typed frontend and unoptimized lowering.
- RD-05 KERNAL startup, IRQ/NMI ownership, audio routes, and platform profiles.
- RD-06 embedded/composed values, asset evidence, interval layout, and VIC fields.
- RD-08 `none` correctness and optimizer cost contract.

### External dependencies

- Node 22+, TypeScript 7.0.2, Yarn classic, ACME 0.97, VICE 3.10 `x64sc`.
- No new npm dependency, no `c1541`, no shell packager.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Flow/alias analysis grows into a general solver | Medium | High | Sparse binding-relative ranges only; no element enumeration; AR-P4 |
| Loader ZP reservation breaks existing programs | Medium | High | Reserve only when a load call is reachable; draft/final layout stability check |
| D64 serializer and decoder share a defect | Medium | High | Independent decoder imports no production serializer; byte-level oracles |
| VICE differ from a real 1541 | High | Medium | Record `VICE-verified / hardware-unverified`; RD-10 owns physical QA |
| Inline loader duplicates code | Low | Low | Measure; share only if a real workload proves a win |
| Diagnostic registry gap | High | Medium | Use frozen source codes plus stable packaging identities; record the literal gap |
| Publication D64 breaks M1/PRG | Low | High | Keep PRG path unchanged; separate profile and packager identity |
