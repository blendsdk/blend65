# Current State: RD-05 Stage A

> **Parent**: [Index](00-index.md)
> **Observed baseline**: `f0acbb35`, 2026-09-27

## Relevant Implementation

Paths below are repository-relative; abbreviated paths within the same row share the preceding
`packages/compiler/src/` prefix. Line numbers refer to the observed baseline.

| Evidence | Observed fact | Change owner |
|---|---|---|
| `packages/compiler/src/project/manifest.ts:22` | Manifest validation already recognizes nine complete profile IDs. | Preserve; 03-02 §Selected identities |
| `packages/compiler/src/frontend/profile.ts:9`, `:214` | Only PAL/KERNAL/6581 has a declaration environment; capabilities are functions. | 03-01 §Integration |
| `packages/compiler/src/frontend/profile-bindings.ts:30` | Injects synthetic operation bindings and import aliases. | 03-01 §Integration |
| `packages/compiler/src/frontend/analyzer.ts:119` | Compile-time evaluation already reads the same binding-state map. | Reuse; no second evaluator |
| `packages/compiler/src/frontend/profile.ts:119`, `frontend/service.ts:296`, `frontend/scalar-expressions.ts:179` | Encoding diagnostics and resident-loader checks contain one-profile assumptions. | 03-01 §Diagnostics and compatibility |
| `packages/compiler/src/semantic/cfg.ts:257`, `:321`, `:375`, `:452`; `semantic/lower-calls.ts:231` | Known conditions already select branches during mandatory lowering. | Preserve; 03-01 §No runtime cost |
| `packages/compiler/src/semantic/lower.ts:207` | Global storage is formed from source declarations, not every synthetic binding. | Preserve zero-storage constants |
| `packages/compiler/src/target/profile.ts:76`, `:199` | Backend identity, storage profile and selection are single-profile. | 03-02 §Target and layout |
| `packages/compiler/src/target/c64-pal-kernal.ts:1`, `:77` | Machine facts and resource budgets are already separate from CPU/serializer facts. | 03-02 §Target and layout |
| `packages/compiler/src/layout/startup.ts:162`, `layout/c64-layout.ts:69` | Startup/layout guards admit only the original profile. | 03-02 §Target and layout |
| `packages/compiler/src/services/services.ts:66`, `:594`, `:626` | A fresh pinned build owns the run, but its private result drops the target before launch. | 03-02 §Emulator launch |
| `packages/compiler/src/services/vice.ts:138` | Interactive launch always requests PAL/6581. | 03-02 §Emulator launch |
| `packages/compiler/src/artifacts/build-evidence-validator.ts:432` | Evidence has a closed version-1 target shape with string identities. | Preserve; 03-02 §Evidence and failures |
| `test/m1/vice-runtime.ts:9`, `:232`; `test/m1/vice-monitor.ts` | Existing test tools attest VICE/ROMs and own one monitor/process; launch is PAL-only. | 03-02 §Qualification |
| `test/import-boundary.ts:27` | Actual and synthetic imports enforce frontend/backend separation. | Preserve boundary unchanged |

`frontend/profile.spec.test.ts` asserts the existing 17-operation surface, and
`target/profile.spec.test.ts` asserts the original machine identity. Both remain immutable.
Only `frontend/profile.impl.test.ts:134` has an obsolete 8580-rejection fixture (AR-P6).

## Dependencies and Risks

RD-04 is closed. Existing TypeScript/Node/Yarn/Vitest, ACME 0.97 and VICE 3.10 suffice; no
package, tool installation or new infrastructure is planned. Current tests are sequential at
the root and compiler workspace; emulator suites must remain sequential.

| Risk | Consequence | Required check |
|---|---|---|
| Treating a recognized ID as executable | False capability claim or target fallback | ST-1, ST-13 |
| Injecting facts as variables | RAM/SFA cost or runtime dispatch | ST-14–ST-15 |
| Reusing PAL identity after selection | Wrong diagnostics, artifacts or emulator | ST-11, ST-16, ST-19–ST-21 |
| A VICE model preset changes more than SID/video | Qualification of the wrong CIA/ROM/model | ST-23–ST-24 |
| Extending capability admission weakens interrupt safety | Unbounded nesting or unsafe vector update | ST-17 |
| A second expected-value table is copied from implementation | Shared defects pass both tests | Independent frozen-spec oracles in 07 |

These are review targets, not claims that a new failure has been demonstrated. The existing
negative NMI safety baseline is verified; positive NMI remains Unknown under AR-P3. No new
four-profile runtime result is claimed by this planning document.
