# Current State: Game-Developer Skill First

> **Snapshot**: `76a8aa0e9314ee699ee73806fb7bea8b4bd869ce`
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1

## Existing Surfaces

| File / authority | Observed use | Change in this slice |
| --- | --- | --- |
| `package.json:6–23`, `vitest.config.ts:8–18` | Node 22+, Yarn classic, TS 7, Vitest; local root tests include new `*.spec.test.ts`/`*.impl.test.ts`; files run sequentially | None |
| `packages/compiler/src/index.ts:6–37,48–50` | Public load/check/build/run and exported build result types | Consume package export only |
| `packages/compiler/src/services/types.ts:30–38,85–102` | Public `none` mode; interactive run explicitly unverified | No new mode or inference of runtime proof |
| `examples/m1/blend65.json` | Exact cooperative PAL/6581, `none`, checks disabled | Reuse this selection for exercises only |
| `test/m1/vice-runtime.ts:231–358` | Pinned VICE/ROM/socket attestation and owned shutdown | Import existing helper unchanged |
| `test/m1/vice-monitor.ts:65–103` | Execute checkpoints, side-effect-free memory reads, resource/CPU observations | Consume existing interface unchanged |
| `test/m1/vice-driver.ts:187–265` | Public debug source-span/global-location pattern | Reuse the small pattern locally; do not generalize M1's game driver |
| `test/rd05/profile-fixture.ts:95–108` | Read exact successful generation, not mutable current output | Reuse the generation-consumption rule |
| `packages/compiler/src/artifacts/evidence-types.ts:153–200` | Published debug source, symbol, location and range records | Inspect public sidecars, not import validators/backend internals |
| Specification 4 Ch02, Ch04, Ch06 FN-3/FN-4, Ch07–08 | Explicit widths, wrap, aggregate parameters/returns and source data types | Governing behavior, never modified |
| [OpenCode V2 skills](https://opencode.ai/v2/docs/skills) | `.opencode/skills/<id>/SKILL.md`; path-derived ID, description and explicit native load | Four-file payload planned; no config change |

These are static facts, not a fresh full compiler or exercise result. The new
payload, qualification tests and authored exercise modules do not yet exist.
The [requirements pass](../../requirements/00-preflight-report.md) applies to
its four exact input blobs, not to this plan. AR-S2, AR-S6–AR-S9.

## Constraints and Risks

| Risk | Treatment / owner |
| --- | --- |
| Primary knows the grader answers | Fresh payload and application writers; precise forbidden-input packets. AR-S5. |
| Model loads an override or stale skill | Native load/content identity check; no configuration scan or permission change to force success. AR-S3, AR-S9. |
| Observer cannot resolve final source locations | Unknown/fail, never use expected values as observations or force a compiler shape. Component owns the fixed-fixture protocol. AR-S6–AR-S7. |
| Skill changes after an exercise | Invalidate affected authoring claims; re-author in a fresh context, not merely rerun old source. AR-S9. |
| Missing compiler capability | Reduced source and actual diagnostics to existing owner; no source workaround or compiler fork. AR-S1–AR-S2. |
| Shared VICE unavailable | Wait for an agreed host-wide window; a process check alone is not reservation. AR-S10. |
| Skill success mistaken for game completion | Keep Slither's unresolved eligibility/player proof and remaining RD obligations explicit. AR-S11. |

No architecture documentation opt-in or unrelated tooling migration is needed
for this slice. Frozen expert evaluator files are not research inputs.
