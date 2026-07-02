# Current State: RD-16 Compiler Configuration

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

`@blend65/config` is still the RD-01 scaffolding stub: `packages/config/src/index.ts`
exports only `VERSION = "0.1.0"`, with a matching smoke test. The package is greenfield —
but everything it must integrate with already ships:

- **Diagnostics core (RD-11a)** — `createDiagnosticBag({maxErrors})` with dedup on
  `(code, sourceId, start)`, the E10000 truncation sentinel, deterministic sorting, and
  the never-throw `add*` API (`packages/core/src/diagnostics/diagnostic-bag.ts`).
  `SourceSpan = {sourceId, start, end}` byte offsets; the SourceMap registry that assigns
  real `sourceId`s is deferred to RD-11b (`source-span.ts` doc comment).
- **Diagnostic code registry** — `DiagCode` in
  `packages/core/src/diagnostics/diagnostic-codes.ts` is the single source of truth;
  codes are claimed additively (RD-09 precedent: `AcmeNotFound: "E10035"`).
- **Platform registry (RD-10)** — `PLATFORM_REGISTRY` (c64, c64u, cx16, a800xl, a7800)
  and `DEFAULT_PLATFORM = "c64"` in `packages/platforms/src/registry.ts`. Config never
  imports it — the caller injects `knownPlatforms` (RD-16 R21, preflight PF-001), and
  `DEFAULT_PLATFORM` is never a config default (R31).
- **Consumers-to-be** — `@blend65/cli` and `@blend65/compiler` already declare
  `@blend65/config` as a dependency (their `package.json`s), so the R15 boundary graph
  needs no change for RD-16.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/config/src/index.ts` | Stub (`VERSION` only) | Replace with public API re-exports |
| `packages/config/src/index.spec.test.ts` | Smoke test | Replace with public-API surface spec test |
| `packages/config/package.json` | deps: `@blend65/core` only | Add `jsonc-parser` (AR-P1) |
| `packages/core/src/diagnostics/diagnostic-codes.ts` | `DiagCode` registry | Add E10240–E10246, W10240–W10241 (AR-P3) |
| `packages/core/src/diagnostics/diagnostic-bag.ts` | Shared bag | **No change** — consumed as-is |
| `packages/platforms/src/registry.ts` | Platform names | **No change** — names injected by callers |

### Code Analysis

Two shipped behaviors shape the design (both verified in source):

1. **Dedup collapses same-code null-span diagnostics** —
   `diagnostic-bag.ts:89-93` keys on `(code, sourceId=-1, start=-1)` for null spans, so
   per-key reporting (R19/R20) *requires* distinct spans → AR-P2's synthetic spans.
2. **The E10230 decade is frozen for enums** — `spec/09-enums.md:281-287` claims
   E10230–E10236; the next unclaimed decade is E10240 → AR-P3's band.

The established integration pattern is dependency injection into a context object
(`packages/frontend/src/semantics/analyze.ts` injects registry/profile; parser carries
`readonly bag`); `LoadConfigOptions` follows it (`bag`, `knownPlatforms`).

## Gaps Identified

### Gap 1: No config loader exists
**Current Behavior:** nothing reads `blend65.json`; the pipeline is driven by tests only.
**Required Behavior:** `loadConfig()` per RD-16 §4.2/§4.3.
**Fix Required:** the whole of this plan (modules per AR-P6).

### Gap 2: No config diagnostic codes
**Current Behavior:** `DiagCode` has no config band.
**Required Behavior:** E10240–E10246 + W10240/W10241 registered with doc comments.
**Fix Required:** additive edit to `diagnostic-codes.ts` (AR-P3), mirroring the RD-09
E10035 precedent comment style.

### Gap 3: No JSONC capability in the workspace
**Current Behavior:** zero external runtime dependencies anywhere; no JSONC parser.
**Required Behavior:** tolerant, offset-reporting JSONC parsing (R2, AR-P2/P4).
**Fix Required:** add `jsonc-parser` to `packages/config` (AR-P1); verify NodeNext
resolution at the first task (checkpoint from the AR-P1 challenger).

## Dependencies

### Internal Dependencies
- `@blend65/core` — `DiagnosticBag`, `SourceSpan`, `DiagCode` (existing dep edge)
- RD-01 scaffolding (build/test/lint wiring) — complete

### External Dependencies
- `jsonc-parser` (Microsoft; zero transitive deps) — NEW, `packages/config` only (AR-P1)

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| `jsonc-parser` ESM entry misbehaves under NodeNext | Low-Med | Low | First-task checkpoint; namespace-import fallback; vendoring is the documented fallback (AR-P1) |
| Recovered-tree validation cascades noisy diagnostics on garbled files | Med | Low | Bag cap bounds volume; build exits 2 regardless; accepted trade-off (AR-P4) |
| `CONFIG_SOURCE_ID` sentinel leaks into the RD-11b renderer unresolved | Med | Low | Documented special-case cost in AR-P2; `LoadConfigOptions.sourceId` lets RD-11b supply a real id without API break |
| Discovery "not found" test walks above the temp dir and hits a stray `blend65.json` | Low | Low | Walk-up is a pure helper with an injected `fileExists` predicate — hermetic unit tests (AR-P7); temp-dir integration tests assert found-below-temp cases only |
| First-external-dep precedent creeps into other packages | Low | Med | Dep is scoped to `packages/config/package.json`; ESLint boundary rules unchanged |
