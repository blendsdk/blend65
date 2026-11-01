# Testing Strategy: Full RD-08 Optimizer

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Coverage goals: optimizer facts/rules/cost ≥90% of reachable branches; existing
compiler/public surfaces ≥80%; CLI/evidence glue ≥60%. Security scope is N/A for
new server/auth/data paths because this plan adds none; existing source/asset
input validation, path confinement, option validation and permission boundaries
remain in force and are regression-tested.

Tests are split by authority:

- **specification tests** derive from RD-08 and this plan’s public behavior;
- **implementation tests** cover facts, rules, obligations, cost and provenance;
- **integration tests** cover lowering → projection → closure → layout → evidence;
- **native tests** cover actual behavior and artifact accounting on four profiles;
- **expert baselines** cover local assembly/cost parity.

The existing `none` suite, 27/27 frontier and stopped-slice fixtures remain
regression oracles. No expectation is changed to make an optimizer rule pass.

## 🚨 Specification Test Cases (MANDATORY)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-1 | A legal source built with `none` before and after optimizer changes | Byte-identical artifacts, diagnostics, resources and sidecars; no optional facts/rules are derived | R8.2 |
| ST-2 | Same source built with `none`, `size`, `balanced` and `speed` once qualified | Mode is recorded exactly; `none` has no decisions; optimized modes use only complete legal decisions | R8.1, R8.9 |
| ST-3 | Fact bundle derived twice from the same checked source, and once from a foreign/stale source | Deterministic identity/content; foreign/stale facts are rejected before any rule | R8.13, AR-009 |
| ST-4 | A rule changes only its declared site; a mutation changes an undeclared site | Declared change closes; undeclared change fails with no publication | R8.25, AR-007 |
| ST-5 | A rule changes code size after the producer/sealed-program boundary | Must close inside the producer; no post-seal rewrite or stale SFA/layout | R8.39, AR-008 |
| ST-6 | Exact, range, symbolic and unknown T terms; B/R/T ordering | Exact/range/symbolic compose; unknown cannot become zero, a win or a stable-ID tie | R8.5–R8.10 |
| ST-7 | Size candidates with equal B/R and exact ties | Stable ID only for identical complete vectors; candidate IDs deterministic and unique | R8.9–R8.10 |
| ST-8 | Existing saved-query caller on four profiles | Payload ≤725, general ≤745, ZP ≤14, combined ≤759, stack ≤5; all original behavior/accounting | R8.9, R8.39, ST-25/26 |
| ST-9 | Saved LowByte/loop rules with source globals, aggregate calls and native observation | Correct values/effects/order and saved bytes; no async/raw/MMIO regression | R8.15–R8.22 |
| ST-10 | Existing acquisition/library caller on four profiles | Payload ≤963, general ≤984, ZP ≤14, combined ≤998, stack ≤10; all original behavior/accounting | R8.9, R8.39, ST-25 |
| ST-11 | Acquisition NMI/raw CIA/MMIO/global aggregate return | Exact NMI publication/removal/restore, raw order/count, caller-owned result, no stale aliases | R8.27–R8.38 |
| ST-12 | Candidate with a B/R/T tradeoff under balanced/speed/size | Balanced retains baseline unless complete Pareto win; speed and size follow their exact orders | R8.7–R8.9 |
| ST-13 | Applied/rejected candidate evidence and debug records | Exact candidate IDs/reasons/vectors; actual rematerialization/optimized-away locations only; totals match | R8.12, R8.58 |
| ST-14 | Rule/cost/certificate/ACME failure during publication | No partial generation; last-good bytes preserved; exact failure evidence | R8.39, R8.52 |

## Test Categories

### Specification Tests

| Test File | ST Cases | Component |
|---|---|---|
| `test/rd08/optimizer-selection.spec.test.ts` | ST-2, ST-6, ST-7, ST-12 | Cost/selection |
| `test/rd08/optimizer-saved-output.spec.test.ts` | ST-8, ST-9 | Saved milestone |
| `test/rd08/optimizer-acquisition-output.spec.test.ts` | ST-10, ST-11 | Acquisition milestone |
| `test/rd08/optimizer-evidence.spec.test.ts` | ST-13, ST-14 | Evidence/publication |
| `packages/compiler/src/machine/optimization-*.spec.test.ts` | ST-3–ST-5 | Facts/rules/provenance |

### Implementation Tests

| Test File | Description | Priority |
|---|---|---|
| `machine/optimization-facts.impl.test.ts` | Fact identity, stale-source rejection, deterministic order | High |
| `machine/optimization-rules.impl.test.ts` | Rule matching, declared-site containment, fallback, obligation closure | High |
| `machine/optimization-cost.impl.test.ts` | B/R/T composition, unknown/tie rules | High |
| `services/size-observer-*.impl.test.ts` | Existing family regressions after per-rule integration | High |

### Integration and Native Tests

| Test | Components | Description |
|---|---|---|
| Lower → storage → layout → evidence | Rules, SFA, shared storage | Re-close after code shape changes |
| Four-profile input behavior | Saved/acquisition, VICE | Values, effects, MMIO, NMI/restore, resources |
| Expert baselines | RD-04 fixtures | Local assembly/cost parity for applied rules |
| Reproducibility | Build/evidence | Repeat size builds yield identical portable artifacts |

## Test Data and Fixtures

- Existing saved/acquisition fixtures under `test/rd05/`.
- Existing `test/rd08/` object, loop, byte, startup and size frontier fixtures.
- Existing `test/rd04/expert/` hand-written baselines.
- Real ACME 0.97 and sequential VICE 3.10 `x64sc`; no mocks for native behavior.
- New fixtures only when a rule needs a smallest counterexample; no benchmark-name
  branches in production.

## Verification Checklist

- [ ] All ST cases have concrete input/output and a source reference.
- [ ] Spec tests are written before implementation and fail for the expected reason.
- [ ] Rule behavior and assembly/cost oracles are independent.
- [ ] `none` artifacts remain byte-identical.
- [ ] Saved 725 and acquisition 963 milestones are measured on all four profiles.
- [ ] Balanced/speed modes are qualified only after size stability.
- [ ] Complete `yarn test`, build, typecheck, targeted specs and sequential VICE pass.
- [ ] Host-time/RSS and line-size gates pass.
- [ ] No spec, expert, oracle or security boundary is weakened.
