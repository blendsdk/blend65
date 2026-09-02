# Ambiguity Register: RD-08 Complete C64 Rule Coverage Plan

> **Status**: ✅ GATE PASSED — all 8 items resolved
> **Last Updated**: 2026-09-02 10:40
> **Mode**: Normal

## Planning Scope Contract

| Boundary | Recorded boundary |
|---|---|
| Planning target | Implement the approved and preflighted `compiler-readiness/RD-08`, with the first phase centered on real generated Blend programs and independent semantics for arrays, calls, branches and bounded loops. |
| Context artifacts | RD-01–RD-08 requirements and plans; readiness and readiness-execution source, tests, publications and command graph; frozen v3.0 specification as read-only semantic authority; compiler/conformance/parity/optimizer ownership artifacts. |
| Modification set | This RD-08 plan directory and the compiler-readiness roadmaps. Planning does not authorize changes to requirements, `spec/`, production code, tests, publications or sibling feature artifacts. |

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| AR-1 | Scope | Does this plan implement all of RD-08 while preserving the mandatory first-phase priority and exclusions? | **Recommended:** yes—plan the full RD, but make phase 1 the smallest real-program vertical slice and keep generalized frameworks, unfinished RD-05/RD-07 work, readiness-execution expansion, compiler fixes and optimizer profiles out. | User accepted recommendation: full RD with the stated first-phase priority and exclusions. | ✅ Resolved |
| AR-2 | Behavioral | What concrete first-phase generated-program surface is sufficient? | **Recommended:** a bounded set of real programs covering fixed arrays with direct/computed reads and writes; zero/multiple-argument and nested scalar calls with return propagation; both branch outcomes plus nesting; and bounded loops with zero/one/multiple iterations. Include invalid neighbors and exact-bound/first-over-bound cases, but no denominator-wide expansion in phase 1. | User accepted recommendation: the bounded arrays/calls/branches/loops surface and named edges. | ✅ Resolved |
| AR-3 | Scope | How is the first vertical rule population kept exact without creating another manifest system? | **Recommended:** enumerate only the exact inventory IDs directly claimed by the phase-1 ST cases in the existing publication's `firstVerticalRuleIds`; validate lexical order, uniqueness, family membership and exact equality. Do not infer extra members from broad chapter/category predicates. | User accepted recommendation: explicit ST-owned IDs in the existing publication authority. | ✅ Resolved |
| AR-4 | Technical | Where should new structured IR validation and evaluation logic live given existing file sizes? | **Recommended:** minimally extend the central closed IR unions, but put array/call/control-flow validation, rendering and evaluation in focused companion modules invoked by the existing seams. Do not grow the 952-line validator, 735-line modeled generator or 654-line evaluator into larger monoliths. | User accepted recommendation: central union delta plus focused companion modules. | ✅ Resolved |
| AR-5 | Data & state | How should publication evolution be sequenced? | **Recommended:** phase 1 produces and proves cases without selecting a changed publication; phase 2 adds only the minimal version dispatch/migration/replay invalidation needed for the changed-format parent, then publishes through the existing separate parent/child pointers with fail-closed stale-pair recovery. | User accepted recommendation: cases first, minimal evolution before changed selection, existing pointers retained. | ✅ Resolved |
| AR-6 | Ordering | How should the denominator-wide remainder be divided after the vertical slice? | **Recommended:** proceed by reviewed rule families and evidence tier: terminal disposition/quality classification, remaining source families and non-source handlers, declared public-route campaigns, then atomic publication and closeout. Each phase stays independently bounded and specification-first. | User accepted recommendation: bounded family/tier phases through closeout. | ✅ Resolved |
| AR-7 | Verification | What command is authoritative before every commit and final completion? | **Recommended:** use the project command verbatim: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`, plus Prettier checks on touched files and `git status --porcelain spec/`. Exhaustive readiness and production VICE remain explicit phase acceptance commands, never part of normal `yarn test`. | User accepted recommendation: exact project verification and explicit exhaustive/emulator tiers. | ✅ Resolved |
| AR-8 | Naming & integration | What artifact/module naming and dependency policy should the plan enforce? | **Recommended:** plan folder `rd-08-complete-c64-rule-coverage`; use descriptive `structured-*`, `rule-family-*`, and `readiness-smoke-*` module names selected during task decomposition; add no dependency and preserve the bidirectional compiler/readiness import prohibition. | User accepted recommendation: descriptive local modules, no dependency, preserved boundary. | ✅ Resolved |

## Resolution Notes

The user explicitly accepted AR-1–AR-8 as one recommendation package on 2026-09-02.

**AR-1–AR-3:** The recommendation carries the user's explicit minimum-sufficient constraint and the
preflight-corrected first-publication contract into a plan-local execution boundary.

**AR-4:** Grounded in `packages/readiness/src/generator-ir-validator.ts` (952 lines),
`modeled-generators.ts` (735 lines) and `oracle-evaluator.ts` (654 lines). Focused companion modules
are the only viable minimum-sufficient direction under the repository's file-size standard; a new
generalized framework and further monolith growth were rejected.

**AR-5–AR-6:** These preserve RD-08's staged RD-05/RD-07 dependencies without resuming either
deferred plan.

**AR-7:** Detected verbatim from the user-supplied project instructions and root command graph.

## Systematic Gate Scan

| Category | Result |
|---|---|
| Feature gaps | Covered by upstream AR-11–AR-18 and plan AR-1–AR-3. |
| Behavioral gaps | Concrete vertical behavior is pending AR-2; later outcomes follow the RD's pass/fail/block evidence contract. |
| Scope ambiguities | Pending AR-1 and AR-6; strict scope prohibits optional additions. |
| Technical unknowns | Pending AR-4. |
| Edge cases | Exact/over-bound, invalid-neighbor, zero/one/multiple iteration and array-bound distinctions are included in AR-2. |
| Integration points | Pending AR-5 and AR-8; existing public compiler and publication seams remain authoritative. |
| Data & state | Pending AR-3 and AR-5; historical v1 bytes remain immutable. |
| Security & compliance | Upstream closed-input, canonical-path, subprocess and resource limits remain authoritative; no auth, credentials or PII are involved. |
| Non-functional gaps | Bounded smoke and explicit exhaustive tiers are pending confirmation in AR-7. |
| UX & presentation | No user-facing UI; existing CLI/result vocabulary remains unchanged. |
| Stakeholder conflicts | Upstream AR-17/AR-18 retain compiler, conformance, parity and optimizer ownership boundaries. |
| Naming & terminology | Pending AR-8. |
