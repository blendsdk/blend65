# Task T-03: Share CIA analysis with ordinary IRQ handlers

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Progress**: 1/1 tasks (100%)
> **Last Updated**: 2026-10-01 13:27 CEST
> **Phase baseline tree**: 286d2e42fd01a4da6bc2cd50e72fada7c7f14431
> **Scope mode**: strict

## Objective

Reduce repeated CIA ownership analysis when IRQ entry is enabled or a helper may
unmask it. Preserve handler discovery, caller mutation history, exact E10278 blame,
final handback identity and generated output. The user confirmed the previous
high-effort handoff by requesting this next item. This is one coherent host-speed
bugfix, not a new language feature.

**Smallest viable design:** Reuse the existing call/selected-handler effect
inventory to determine whether any selected IRQ handler can transitively call
`restoreIRQ()`. When none can, older mutation prefixes cannot affect handler
validation, so reuse the existing untouched-prefix cache. Retain exact caller
histories when a handler can restore an owner or its body is unproved. No discovery
replay, new pass, ABI change, runtime state, dependency or source restriction.

**Modification set:** this mini-plan and its T-03 roadmap row;
`packages/compiler/src/semantic/cia-ownership.ts`;
`packages/compiler/src/semantic/cia-memoization.impl.test.ts`;
`packages/compiler/test/cia-memoization-fixture.ts` (existing test helpers
moved with route input and complete integer facts, plus selected-handler setup);
`packages/compiler/src/semantic/cia-enabled-memoization.impl.test.ts`; one focused
`test/rd05/cia-enabled-memoization.spec.test.ts`. Existing spec tests, frozen
`spec/`, expert authority, portfolio and sibling plans remain unchanged.

## Task

- [x] T-03.1 Freeze independent source controls and record the enabled/unmasking count baseline; implement the narrow handler-effect guard; verify source controls; add deterministic depth-scaling and history-reading-handler controls; run full verification and independent correctness, semantics and performance review; record the bounded result and commit locally without pushing. (completed: 2026-10-01 13:27) Independent baseline and green source controls, 28 internal cases, install/build/typecheck and all 3,112 tests pass. Correctness, semantics and performance reviews report no findings. Frozen authorities and oracle hash are unchanged; local-only commit mode.

Ordering within this single outcome is specification tests → recorded semantic
baseline and red repeated-work probe → implementation → green source controls →
internal tests → full verification/review. Passing semantic controls before the fix
are expected: the defect is repeated host work, not changed language meaning.

**Verify:** Directed existing/new CIA Vitest cases and deterministic evaluation
counts; then `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`,
`yarn test`. VICE runs sequentially. Existing behavior and expert-output cases stay
independent oracles. Compare four-profile artifact identities before/after as
supporting evidence. Check targeted formatting, links, whitespace and unchanged
frozen authorities. No wall-clock test gate.

## Contract and bounded scope

RD-05 R5.15–R5.17 and frozen cooperative C64 contracts retain callback-only
handlers, exact owner stacks, selected entry variants, source effects and
stock-compatible final release. This fix changes host work only: intended runtime
bytes, cycles, ZP, SFA and stack deltas are zero. The conservative fallback for
history-reading handlers remains RD-05-owned; this task must not claim to eliminate
every possible analysis cost or close RD-05.

Expert version `2.0.1`, content commit
`1ce4852016e2a883cf1f733c6014c45e176bfc69`; references:
`compiler-architecture.md#required-pipeline-invariants`,
`sfa-and-abi.md#interrupt-route-completion-gate`,
`c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`,
`c64-memory-and-runtime.md#stock-cia1-service-on-final-exclusive-release`,
`c64-hardware.md#cia-register-effects-and-ownership`. Source keys:
`BLEND65-SPEC-4-1c2a2d75`, `MOS-6526-1981`, `CBM-C64-KERNAL-03`.

## Evidence

Independent source author froze 112 passing source cases before implementation;
SHA-256 `b01563c1a7408e4f19bde192963e792fdf27c2b7fec7362b1ebdb789b8664980`.
The dirty-handler fixture was isolated before freezing: two invalid restores had
no defined diagnostic priority, so main became nonreturning in dirty variants.
Error count, E10278, exact handler span and no-generation assertions did not
change. No implementation was read by the author; existing oracles are untouched.

All 216 existing/new directed source controls pass after implementation.
Real selected-handler depths 6/8 now use 33/43 enabled evaluations and 15/19
CLI/PLP evaluations. Four-profile PRG/assembly/memory/cost hash comparisons pass
exactly. Logs: `/tmp/blend65-cia-enabled-source-green.log`,
`/tmp/blend65-cia-enabled-count-after.log`,
`/tmp/blend65-cia-enabled-after.json`.

Internal count tests are split by concern and reuse the existing test fixtures;
there is no production instrumentation or new harness. All 28 internal tests pass,
including 19 selected-handler cases at depths 8/16/24, direct/finite-indirect
ordinary calls, direct/helper/finite-indirect handler restores, and an unproved
body fallback. Enabled counts follow `5 * depth + 3`; CLI/PLP counts follow
`2 * depth + 3`. These count bounds are not a linear whole-compiler-time claim:
serialized route vectors still cost work proportional to route depth.

The first full build caught a moved test fixture inside production `src/` (and an
existing incomplete synthetic integer fact). The fixture now follows the existing
`packages/compiler/test/` convention, with complete integer facts; no build config
changed. Four accidentally emitted fixture outputs were moved to a temporary
directory, outside publishable `dist/`. Full verification is rerunning in
`/tmp/blend65-cia-enabled.1Gbk19/{install,build,typecheck,test}-final.log`.
Full package suites pass: compiler 1,640 (two native-Windows-only skips), CLI 62,
language server 14 and VS Code 6. The root sequential runtime suite is still
running. Formatting, whitespace, local links, frozen-authority status and the
independent oracle hash pass.

Correctness/maintainability/standards/API review reports no findings. Performance
review also reports no findings and independently reproduces old/new counts;
depth 48 confirms the same count formulas. Cumulative serialized key text grows
from 9,290 characters at depth 8 to 218,050 at depth 48, consistent with roughly
quadratic route-vector work, not constant work per evaluation. The additional
fact needs O(F) storage and retains the existing O(F·E) effect-closure bound.

The dedicated performance-agent spawn and old-agent resume hit the thread limit.
The completed independent correctness reviewer therefore received a separate
bounded performance packet and ran the audit read-only. Reviewer independence
from the implementer and every gate are preserved. Semantics review and the
full checkpoint were pending when the other reviews completed.

Semantics review now reports no findings. Its additional read-only in-memory
comparison of 270 baseline/current cases preserves complete diagnostic records
and actual-source handback spans across returning/nonreturning, caller pops,
branches/loops, direct/finite-indirect calls, enabled/CLI/PLP entries, restoring
handlers and missing inventory.

## Verified result

The complete fresh checkpoint passes: install, build, typecheck and all **3,112**
tests (compiler 1,640; root 1,390; CLI 62; language server 14; VS Code 6).
Two native-Windows-only compiler cases are correctly skipped on Linux. All 109
root files pass, including sequential VICE; runtime claims remain
VICE-verified / hardware-unverified. The captured final test command exits zero.
No failing or skipped owned Linux tier is hidden by CI selection or cached tests.

All five touched TypeScript files pass targeted formatting; whitespace, local
links, unchanged independent oracle hash, existing-oracle integrity and frozen
spec/expert/portfolio checks pass. No architectural/public-contract/integration
change requires a technical-docs or AGENTS.md rewrite.

The bounded ordinary-handler enabled/unmasking residual is closed. Restoring or
unproved handlers retain complete histories and their existing worst-case host
cost, still owned by RD-05 analysis hardening. There is no hidden runtime flag,
function storage, discovery-replay machinery or source workaround. Generated
PRG/assembly/memory/cost hashes match exactly on all four cooperative profiles;
runtime bytes, cycles, ZP, SFA and stack have zero delta for that workload.

RD-05 remains Executing; the feature remains 4/10. The roadmap engine reports only
the pre-existing portfolio 1/10 versus feature 4/10 difference; numerical cascade
is deliberately deferred on this nonintegration branch. T-03 is Done, not an
unqualified RD-05 closeout. Commit is local only; no push is authorized here.

Existing nine internal controls pass before implementation. A one-off probe with
a real selected exclusive IRQ handler reproduces repeated work: enabled depths
6/8 use 318/1,278 key evaluations; transitive CLI and PLP depths 6/8 each use
192/768. Diagnostics are empty. The count is red against the intended bounded
sharing, while existing semantics pass. Log:
`/tmp/blend65-cia-enabled-count-before.log`.

Four-profile PRG, assembly, memory and cost hashes are captured in
`/tmp/blend65-cia-enabled-before.json` using the same returning source program
with a selected IRQ handler, repeated clean helper installs, unmasking and a typed
outer CIA1 write. This document is the sole mutable progress authority.
