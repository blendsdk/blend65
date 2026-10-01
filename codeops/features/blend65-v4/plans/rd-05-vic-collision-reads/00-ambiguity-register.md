# Ambiguity Register: RD-05 VIC-II collision reads

> **Status**: ✅ GATE PASSED — four planning items and AR-P5 runtime correction resolved
> **Last Updated**: 2026-10-01 08:29
> **CodeOps Artifact Schema**: 1

## Planning boundary

| Boundary | Scope |
|---|---|
| Target | `blend65-v4/RD-05` R5.27 / AC-10: two named, consuming VIC-II collision reads on the four existing cooperative PRG profiles. User confirmed the named planning task and effort on 2026-10-01. |
| Context | Frozen Specification 4; RD-05 R5.11–R5.13/R5.27; approved missing-binding ownership in Stage A AR-P2; expert 2.0.1; current profile declarations, semantic platform operations, lowering, target facts and closed declaration tests. |
| Planning modification set | This plan directory and the feature roadmap only. No compiler, existing tests, requirements, frozen spec, expert authority, portfolio or sibling-plan changes during planning. |
| Product boundary | Hardware status reads only. No collision algorithm, gameplay policy, helper runtime, shadow, cache, scheduler, manager, new IR/pass, framework or dependency. |

## Decisions

| ID | Category | Question / contract | Recommendation or authority | Status |
|---|---|---|---|---|
| AR-P1 | Scope / effort | Which work is authorized? | User: “commit and push all we have. effor is confirmed, proceed further”, replying to the named collision-read planning task. Existing commits were pushed through `5970ed3b` before planning. Implementation remains a later gated task. | ✅ Resolved |
| AR-P2 | Naming / behavior / data | Exact missing source bindings? | User accepted recommendation: `c64.vic.readAndClearSpriteSpriteCollisions(): byte` and `c64.vic.readAndClearSpriteBackgroundCollisions(): byte`, with zero arguments and `volatile-read` effects. Read `$D01E` and `$D01F` respectively once; return the unchanged eight-bit sprite-participation mask. A read clears only that collision latch; it is not `$D019` IRQ acknowledgement. Repeated calls remain separate reads, including discarded results. New collisions may relatch bits between calls. | ✅ Resolved — user: “i approve”, 2026-10-01 |
| AR-P3 | Test authority / integration | Two existing specification tests require an exact complete declaration list. How can that list grow without weakening its oracle? | User accepted recommendation: authorize only two added declaration rows in each of `packages/compiler/src/frontend/profile.spec.test.ts` and `packages/compiler/src/frontend/profile-constants.spec.test.ts`, plus the latter's operation-count title update from thirty-five to thirty-seven. Preserve all existing rows, assertions, fixtures and test cases. Add separate independent specification tests before implementation; do not edit the old lists until this exception is explicitly approved. | ✅ Resolved — user: “i approve”, 2026-10-01 |
| AR-P4 | Verification / non-functional | Verification contract? | User accepted recommendation: directed source, lowering/output and existing sequential VICE cases during work; at the completed slice run `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`, targeted formatting, links and frozen-authority checks. Compare independent behavior and assembled expert cost expectations. No benchmark or new test runner. Windows and physical QA remain RD-10. | ✅ Resolved — user: “i approve”, 2026-10-01 |
| AR-P5 | Test authority (runtime) | The new API oracle assumes a profile binding stores its function signature in `binding.type`, but this field contains the operation's return type. May this misplaced comparison be corrected? | **Best option:** in `test/rd05/vic-collision-api.spec.test.ts`, remove only the misplaced `binding.type` comparison. Preserve its volatile-read check and the separate call checks for zero arguments, unsigned-byte integer facts and exact parameter/return signature. No compiler representation, approved API, fixture, case or other oracle change. Evidence: `frontend/profile-bindings.ts:25–46`, public semantic declaration and call signature, failing test at line 55. Independent implementation-blind author confirms the assumed binding representation is not part of the approved source contract; removing that comparison avoids introducing another representation constraint. | ✅ Resolved — user: “I approve”, 2026-10-01; exact correction only |

## Runtime correction evidence

Task 1.2.1 adds only approved declarations and named addresses. Fresh `yarn build` passes.
Directed API verification has five passes (all existing diagnostics) and eight failures at
the same new binding-shape comparison; source analysis itself is complete in all eight.
Log: `/tmp/blend65-vic-api-green.fGfaHc.log`. Existing profile bindings deliberately publish
`capability.returnType` in `binding.type` and keep signatures separately; this slice does
not authorize redesigning that representation. The call-level signature assertion already
checks the source contract. This is an oracle-location error, not a missing language feature.
The user explicitly approved the exact comparison removal before any new-oracle edit.
At approval, task 1.2.1 resumed with its acceptance obligations unchanged; tasks 1.2.2–1.3.3
had not started. Expected-RED work was held uncommitted until a coherent green checkpoint.
The [execution checklist](99-execution-plan.md) owns subsequent progress.

## Grounding and smallest design

The current frontend inventory at `packages/compiler/src/frontend/profile.ts:163–299`
has border/sprite operations but neither collision read. Its `volatile-read`
effect is already used for CIA consuming reads. Semantic lowering carries that
declared effect directly through `semantic/lower-calls.ts:173–185`; platform
lowering uses the existing `machine/lower-platform.ts` / `machine/lower-c64.ts`
path. Target device addresses remain owned by `target/c64-kernal.ts`.

The exact old declaration lists are at `frontend/profile.spec.test.ts:73–79`
and `frontend/profile-constants.spec.test.ts:60–66`. Additive API growth would
fail their equality checks; weakening equality or deleting existing rows is not
the remedy. AR-P3 is the only proposed existing-oracle exception.

Use the existing declaration, effect, target and instruction representations.
No interrupt installation, banking transaction, result cache or new ownership
checker is needed for two explicit consuming reads. Applications own when and
where they consume the shared hardware result; the compiler must not add hidden
masking or claim a read is an atomic snapshot of both registers.

Tests must distinguish sprite/sprite from sprite/background, zero from high-bit
results, retained from discarded results, and separate repeated calls. Runtime
proof uses actual sprite/display activity and reads results from ordinary RAM;
monitor inspection must not itself consume the collision latch. A second zero
result is valid only after preventing new collision events. No implementation,
assembled artifact, cost measurement or runtime pass is claimed yet.

## Gate scan and lineage

All twelve gate categories were checked: feature, behavior, scope, technical,
edge cases, integration, data/state, security, non-functional, presentation,
stakeholder and naming. All four rows above are resolved.
Closed profile/type/argument validation and structured instruction emission stay
on existing paths. No host input, command, public schema or dependency is added.
No complexity escalation is proposed. User approval of AR-P2–AR-P4 opens plan
authoring. No extra RD or broad platform plan is needed. Execution remains a
later task; no new capability is claimed as implemented.

Expert `2.0.1`, content `1ce4852016e2a883cf1f733c6014c45e176bfc69`;
`c64-hardware.md#vic-ii-sprites` / `#volatile-and-rmw-policy`,
`c64-memory-and-runtime.md#cpu-address-view`. Source keys:
`BLEND65-SPEC-4-1c2a2d75`, `CBM-C64-PRG-1982`, `CSG-6567-318014`.
Hardware semantics are authority; current compiler code is audit evidence only.
Future emulator qualification remains VICE-verified / hardware-unverified.
