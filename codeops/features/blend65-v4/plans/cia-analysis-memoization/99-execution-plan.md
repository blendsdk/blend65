# Task T-02: Share CIA ownership analysis without losing caller facts

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Progress**: 4/4 tasks (100%)
> **Last Updated**: 2026-10-01 01:12
> **Phase baseline tree**: 1fff1774ffbc574c83590b4cc5eafd2b25524199
> **Scope mode**: strict

## Objective

Fix [PE-001](../rd-05-cia-basic-return/08-closeout.md#expert-parity-and-remaining-debt):
avoid exponential repeated CIA ownership checks through mutation-bearing helper
diamonds while IRQ entry remains masked. Keep caller mutation facts, diagnostics,
exact handback classifications, source-operation identities and generated output
unchanged.

The user confirmed effort and continuation for this named outcome on 2026-10-01.
Its checklist is one bounded bugfix, not a batch of new product tasks.

**Smallest viable design:** Extend the existing successful-call cache with the
length of the caller mutation prefix that the body never reaches. Compare the
remaining suffix and reattach the current caller's untouched prefix on a hit.
Propagate the touched boundary through calls. Share across differing prefixes only
while IRQ entry stays masked throughout the helper; reuse the existing call-effect
inventory to conservatively detect possible IRQ unmasking. Otherwise keep exact
mutation contexts, so cached calls cannot lose handler-entry discovery effects.
No additional analysis pass, runtime state, public API, dependency or general
transfer/dataflow framework. The existing full route/handler, mask/source,
stock-predecessor and CPU masking facts remain part of the key.

**Modification set:** this mini-plan; the feature roadmap; the CIA1 return
closeout's PE-001 disposition; `packages/compiler/src/semantic/cia-ownership.ts`;
one focused `cia-memoization.impl.test.ts`; one new independent
`test/rd05/cia-memoization.spec.test.ts`. Existing specification tests, frozen
`spec/`, expert authority, portfolio and sibling plans remain unchanged.

## Tasks

- [x] T-02.1 [spec-author] Freeze independent source regressions for clean/typed/raw caller prefixes, caller-owned pops through direct/indirect helpers, branch/loop joins and IRQ-enabled helper effects. Run before implementation; document existing semantic passes rather than forcing a false red. (completed: 2026-10-01 00:49) All 104 semantic controls pre-pass; performance is independently red. Author's final frozen SHA-256 `6e6420b9991368744c17595124e010746ee3700c65ab7abe7f80682bcb1a3af8`; log `/tmp/blend65-cia-memo-v3fC6r/spec-baseline.log`. No implementation read by author; existing oracles unchanged.
- [x] T-02.2 Reproduce the deterministic repeated-analysis count; implement the focused prefix-aware cache and prove the unchanged independent regressions pass. (completed: 2026-10-01 00:51) Build and 272 directed source/output cases pass; oracle hash unchanged. Depth-16 probe falls from 131,072 to 34 evaluations (1,827 ms to 4.58 ms in this run). Four-profile PRG, assembly, memory and cost hashes exactly match the pre-fix builds. Documentation and whitespace checks clean. Logs `/tmp/blend65-cia-memo-v3fC6r/{build-green,source-green,probe-after,artifacts-after}.log`.
- [x] T-02.3 Add internal deterministic depth-scaling, nonreturning, prefix-rebinding and IRQ-unmasking fallback tests. Validate unchanged four-profile artifact bytes/resources/costs using existing qualification cases. (completed: 2026-10-01 00:55) All 37 directed internal cases pass (nine new); depth 8/16/24 masked cases use 18/34/50 evaluations. Direct/finite-indirect nonreturning sharing, returning-prefix rebinding and both transitive unmasking/already-enabled exact-context fallbacks covered. Three touched TypeScript files pass formatting; documentation/whitespace/frozen-authority checks clean. Four-profile artifact hash comparison passes. Log `/tmp/blend65-cia-memo-v3fC6r/internal.log`.
- [x] T-02.4 Run full project verification, independent correctness/semantics and performance review, documentation/format/link/frozen-authority checks; record the bounded result and commit without pushing. (completed: 2026-10-01 01:12) Install/build/typecheck and all 2,902 tests pass. All three independent reviews report no findings. Targeted formatting, whitespace, 50 local links/anchors, unchanged oracle hash and frozen-authority checks pass. Current bounded disposition and remaining owner are recorded; commit mode is local-only, with no push.

**Verify:** Directed Vitest runs during the bugfix, then
`yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`.
VICE cases run sequentially. Targeted TypeScript formatting, local Markdown links,
whitespace and frozen-authority checks apply. Test timing is not the performance
oracle: count relevant analysis-key evaluations to prove bounded sharing.

## Contract and lineage

Frozen `spec/appendix-c64.md` §Cooperative KERNAL profiles requires clean inner
LIFO restores, rejects dirty inner/raw/nonstock restores with E10278, and gives
only the final exclusive release its stock handback. `spec/14-diagnostics.md`
owns E10278. Existing public check/build APIs and fixtures are reused.

Expert `2.0.1`, content commit `1ce4852016e2a883cf1f733c6014c45e176bfc69`;
`compiler-architecture.md#required-pipeline-invariants`,
`sfa-and-abi.md#interrupt-route-completion-gate`,
`c64-memory-and-runtime.md#stock-cia1-service-on-final-exclusive-release`,
`c64-hardware.md#cia-register-effects-and-ownership`. Governing source keys:
`BLEND65-SPEC-4-1c2a2d75`, `MOS-6526-1981`, `CBM-C64-KERNAL-03`.
This is host-analysis sharing, not a runtime optimization or new hardware proof.

## Evidence

The independent author owns only the new source-regression file and has no
implementation access. Its semantic cases are expected to pre-pass because
the existing defect is repeated host work, not wrong ownership semantics.
The separate deterministic baseline probe reproduces 131,072 key evaluations
at depth 16 (18 synthetic semantic functions), 1,827 ms and about 71 MB observed
heap in this run. Elapsed time and heap are supporting observations, not gates.
Log: `/tmp/blend65-cia-memo-v3fC6r/probe-before.log`.
Four fresh selected-profile returning builds captured exact PRG/assembly/memory/
cost hashes before the cache change, each PRG 957 bytes:
`/tmp/blend65-cia-memo-v3fC6r/artifacts-before.log`.

The same depth-16 probe now uses **34 evaluations**, 4.58 ms and about 4.8 MB
observed heap. Independent performance review reproduces 18/34/50 evaluations
at depths 8/16/24. This proves linear evaluation count for these masked helper
diamonds, not linear whole-compiler time: route/key serialization and returning
prefix copies still scale with route depth. Review measured cumulative serialized
key text at 2,202/6,242/12,202 characters, showing that vector work grows
quadratically across these depths. Cache variants are local to one check; lookup
compares each required suffix and returning hits copy the mutation vector.

IRQ-enabled entries and helpers that can transitively unmask IRQ retain exact
mutation histories. Their existing worst-case repeated work remains owned by
RD-05 analysis hardening; depth-6 enabled/unmasking probes each use 128
evaluations. Sharing those contexts would require preserving handler discovery,
which is outside this bounded fix. No general replay framework was added.

Four-profile PRG, assembly, memory and cost hashes match exactly before/after;
each PRG remains 957 bytes. Generated runtime bytes, cycles and storage have
**zero delta** for these fixtures. This host-analysis change adds no runtime
optimization claim and does not close the RD-08 output debts in issues #92/#93.

The full checkpoint passes: compiler 1,603; root 1,217; CLI 62; language server
14; VS Code 6 — **2,902 tests**, including sequential VICE cases. Logs:
`/tmp/blend65-cia-memo-v3fC6r/full-{install,build,typecheck,test}.log`.
The final rebuild after comment-only clarifications passes in `final-build.log`.
Runtime evidence remains VICE-verified / hardware-unverified.
All three touched TypeScript files pass targeted formatting. Fifty local Markdown
links and heading anchors resolve; whitespace checks pass. The independent
oracle's frozen hash is unchanged, no existing specification test changed, and
`spec/`, expert authority and portfolio have no working-tree changes.

| Independent review | Result | Scope |
|---|---|---|
| Correctness / maintainability / standards / API | No findings | Complete task diff, frozen oracle, cache rebinding, diagnostics and output identity |
| Semantics | No findings | Direct/indirect calls, joins/loops, nonreturning paths, IRQ discovery and source-operation handback identities; additional admission/rejection probes |
| Performance | No findings | Independently reproduced masked key counts and exact-context fallback; retained route-depth/variant costs stated above |

No architectural component, public contract, integration or infrastructure changed;
no additional technical-documentation set or AGENTS.md refresh is needed for this
local cache fix. RD-05 remains Executing and the feature count remains 2/10.
Portfolio numerical cascade remains deferred until integration under branch
policy; the roadmap engine still reports that pre-existing roll-up difference.
The progress helper derives Done and 4/4 correctly but exits 1 because it requires
`00-index.md`/`Implements` even for this single-file task. The skill's lightweight
task contract explicitly has no `00–07` set, as with T-01; do not add documents
solely to satisfy that full-plan parser limitation.
