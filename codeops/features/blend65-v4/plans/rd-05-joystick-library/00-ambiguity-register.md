# Joystick and Bundled C64 Library — Planning Decisions

> **CodeOps Artifact Schema**: 1
> **Status**: ❌ GATE BLOCKED — AR-P2 needs the user's scope decision
> **Last Updated**: 2026-10-01 14:07
> **Planning only**: No implementation or frozen-authority change is authorized by this document.

## Planning scope contract

| Boundary | Contract |
| --- | --- |
| Planning target | A bounded `blend65-v4/RD-05` joystick pilot based on R5.24/AC-19, applying the user's library-first decision. |
| Context artifacts | [Feature roadmap](../../00-roadmap.md), [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md), [RD-08](../../requirements/RD-08-optimization-and-expert-output.md), frozen Specification 4, qualified expert 2.0.1, current module/call/platform/distribution paths. |
| Modification set | This new plan's decision register during discovery; the rest of this plan only after the planning gate passes. No existing requirement, `spec/`, skill, compiler, test, package or roadmap change at this checkpoint. |

The user approved high-effort planning after requesting these outcomes:

- Apply library-first reasoning to joystick support.
- Ship platform-specific standard libraries as real Blend65 source included in the distribution.
- Consider a final analysis/refactoring RD if the pilot supports it; analysis must justify any refactoring.
- Update the expert skill through its qualified version/activation process after pilot evidence.

Those approvals establish product intent. They do not prove that ordinary source functions already
compile with the same cost as current intrinsics, authorize an early optimizer, or justify a broad rewrite.

## Ambiguity register

| ID | Category | Decision | Authority / recommendation | Status |
| --- | --- | --- | --- | --- |
| AR-P1 | Scope / product intent | Should ordinary platform helpers prefer shipped Blend65 source over compiler intrinsics where behavior and output are equally good? | User approved the library-first direction and included platform libraries, then approved high-effort planning. Keep required hardware semantics in the compiler; do not add gameplay policy or migrate by architectural preference alone. | ✅ Resolved |
| AR-P2 | Scope / sequencing | May this pilot establish bundled source constants/masks and correct joystick operations now, while source-function migration waits for the separately owned optimizer prerequisite? | **Recommended:** yes. Preserve current direct operations; add no name-based fake library, slower replacement, inline syntax or early optimizer. RD-08 already owns general inlining. Await the user's decision on this reduced first-pilot outcome. | ❌ Open |

## AR-P2 — Evidence and smallest viable direction

### Current facts

| Boundary | Evidence | Bounded conclusion |
| --- | --- | --- |
| Joystick API | `packages/compiler/src/frontend/profile.ts:242–245` | Current selected-profile declarations provide `readJoystick2` and fire/left/right predicates; port 1 and up/down are absent from this declaration inventory. |
| Direct lowering | `packages/compiler/src/machine/lower-c64.ts:395–443` | The existing read selects a hardware port access; predicate calls select masks and conditions without an ordinary source-function call. This is source inspection, not a new binary/runtime qualification. |
| Ordinary calls | `packages/compiler/src/machine/lower-call.ts:73–193` | Ordinary calls marshal parameter homes and emit `JSR`. Merely rewriting a predicate as a source function does not remove that overhead. |
| Current build boundary | `packages/compiler/src/services/services.ts:125–143`, `:165–250` | Explicit non-`none` build options are rejected. The checked pipeline has no optimizing call-expansion stage. No optimized-output claim is made. |
| Module inputs | `packages/compiler/src/frontend/modules.ts:164–176`; `packages/compiler/src/project/snapshot.ts:168–185` | Existing module resolution indexes supplied snapshot sources; source discovery currently supplies project inputs. There is no demonstrated bundled-source integration at these boundaries. |
| Distribution | `packages/compiler/package.json`, `packages/cli/package.json` | Both package file allowlists contain only `dist`; a real `.blend` library needs deliberate packaging and availability proof. |
| Existing optimization ownership | RD-08 R8.19 and AC-17; expert `references/il-and-optimization.md#optimization-modes-and-finite-frontier` | General inline/outline work is optimization, not a reason to silently redefine `none` during the joystick slice. |

**Status:** Verified partial. **Claim kind:** Fact for the inspected paths; recommendation for the
staged direction. Future library behavior, artifact bytes, runtime behavior and equal-cost
source-function expansion are not verified by this inspection.

Knowledge lineage: `skillVersion=2.0.1`, qualified content commit
`1ce4852016e2a883cf1f733c6014c45e176bfc69`;
`references/compiler-architecture.md#target-composition`,
`references/il-and-optimization.md#optimization-modes-and-finite-frontier`,
`references/c64-hardware.md#ports-and-data-direction`.
Governing authorities are Specification 4 Chapter 10 module/import rules, project product/output
policy, RD-05 R5.24/R5.50 and RD-08 R8.19. Input hardware facts route to
`MOS-6526-1981` and `CBM-C64-PRG-1982` in the expert source manifest.

### Independent challenge

One blind `design-challenger` assessed the supplied repository packet. It did not independently
open source files; this record does not claim that it did.

- **Recommended direction:** source constants/masks plus direct operations now; source-function
  migration has a separately owned optimizer prerequisite.
- **Bundling verdict:** `Simplify`. Use existing module machinery and a small explicit bundled
  inventory. A package manager, extensible framework or runtime is unnecessary.
- **Early-inlining verdict:** `Unnecessary` inside this joystick pilot. If ordinary callable
  helpers must be proved now, optimizer work becomes a separate prerequisite requiring an explicit
  scope/order decision.
- **Strongest counterargument:** a constants-only library proves distribution and constant use,
  not successful migration of ordinary function helpers.
- **Confidence:** High under the inspected `none`/call boundaries. Qualified general call
  expansion or a user-approved change in milestone ordering would change the recommendation.
- **Hardening:** the conditional source-function proposal was narrowed after inspecting the
  missing optimization prerequisite; parent and challenger converged on the staged boundary.

No early inliner, extra optimization mode, annotation, support framework or compiler refactoring is
included in executable artifacts. There are no executable artifacts yet. If such machinery is
later proposed, its exact scope/cost requires the applicable complexity and authority gates.

## Discovery still required after the scope decision

The full plan must resolve these concrete details before becoming executable. They are not
assumptions or approvals hidden in this register:

- Exact public source-module contents and compatibility with existing `c64.input` names.
- Minimal trusted bundled-source loading, deterministic input identity, diagnostics and editor
  visibility, package inclusion, declaration collision behavior and target availability.
- Exact joystick snapshot/port-state contract, keyboard shared-line effects, concurrent ownership,
  DDR/latch preservation and safe direct-read preconditions. A port read must not be sold as an
  electrically isolated joystick reading under arbitrary keyboard/device state. Full R5.25
  keyboard scanning is not silently included.
- Independent all-32-control-combination expectations per port, upper-bit preservation, call/effect
  order, source-library imports/constants and unused-code evidence, complete assembly/resource
  expectations, sequential four-profile VICE cases and regression compatibility.
- Existing impact-based verification: directed checks during tasks; install/build/typecheck/full
  owned tests at phase checkpoints; targeted document formatting/link validation during planning.
- A named completion trigger and landing owner for the source-function migration if AR-P2 is
  approved. Do not create or change RD-08 requirements without exact authority.
- Whether pilot evidence justifies a final review RD and the separately qualified skill update.
  Neither is recorded as created or completed here.

## Systematic planning scan

All twelve ambiguity categories were considered for discovery. Scope/technical/integration,
behavior/edge cases, data/state, performance and naming remain covered by AR-P2 and the pending
discovery list. Source loading must retain existing input-validation and trust boundaries; this
adds no web service, authentication or network package fetch. User-facing docs must distinguish
bundled source, hardware primitives and unsupported source-function migration. The stakeholder
boundary remains modern source ergonomics plus expert output, not a game engine.

Domain lenses: compiler/language; data/migration for source/API compatibility and deterministic
distributed inputs. Hardware/interrupt coexistence is a concrete C64 proof obligation, not an
authorization for a new concurrency framework.

The gate stays blocked until the user decides AR-P2 and subsequent discovery closes material
questions. No `00-index.md`, component document or execution plan may be presented as ready before
that point.
