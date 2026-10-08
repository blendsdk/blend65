# Current state: source-library reachability

> **Parent**: [Index](00-index.md)

Inspected baseline: `16e6d793`. Source facts only; artifact costs remain unmeasured.

| Existing file                                                       | Relevant current boundary                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `frontend/bundled-sources.ts:93–126`, `frontend/modules.ts:296–448` | Installed source preparation and entry-reachable module selection are separate. Neither needs changing. |
| `semantic/whole-program.ts:201–225`                                 | Every ordinary exported function becomes a callable root.                                               |
| `semantic/function-targets.ts:289–309`                              | Export also creates an independent incoming-assignment seed.                                            |
| `semantic/lower.ts:106–195`, `semantic/operations.ts:434`           | Global construction lacks private/public provenance for safe cold-data selection.                       |
| `semantic/whole-program.ts:488–620`                                 | Roots/effects/contexts are closed before downstream storage.                                            |
| `services/zero-page-globals.ts:18`, `machine/lower.ts:73–98`        | Consumers reserve/place retained globals independently of function selection.                           |
| CLI arguments, manifest and services                                | Current ordinary build requires main; no implemented binary-library export mode found.                  |

The approved correction and its uncertainty boundaries are owned by AR-2 through AR-5, not
this evidence table. Internal metadata is reconstructed per compilation; no serialized schema,
mixed-version artifact format or cache migration is introduced. Keep published debug/cost/layout
evidence consistent with the actual selected artifact.

Dependencies: existing analysis, identities, finite target sets, reachable-block helper, SFA,
ACME artifact build and sequential VICE tests. No new dependency or harness. Highest risks are
erased initializer/address dependencies, raw aliasing and metadata reaching only one consumer;
ST-3 through ST-15 and independent reviews own their checks.
