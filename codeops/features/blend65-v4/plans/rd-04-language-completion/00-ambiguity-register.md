# Ambiguity Register: RD-04 Language Completion

> **Status**: ✅ GATE PASSED — all 9 planning decisions resolved
> **Last Updated**: 2026-09-23 15:04 CEST
> **CodeOps Artifact Schema**: 1

## Planning Scope Contract

| Boundary | Authorized scope |
|---|---|
| Planning target | The complete RD-04 core language and correct `optimization: none` compiler for the first qualified C64 profile |
| Context artifacts | Frozen Specification 4, active `blend65-domain-expert` 2.0.0, RD-04 and its accepted requirements preflight, completed RD-01 through RD-03 artifacts, current compiler/CLI/LSP source and tests, ACME 0.97 and VICE 3.10 evidence |
| Modification set | This plan folder, the Blend65 v4 feature/portfolio roadmaps at lifecycle transitions, and the user-authorized AC-34/AC-37 correction already committed to RD-04; Specification 4 and sibling RDs remain read-only |

## Decisions

| ID | Category | Decision | Authority | Status |
|---|---|---|---|---|
| AR-P1 | Scope | Plan every RD-04 Must/Should requirement and acceptance criterion. Do not pull forward RD-05 platform systems, RD-06 native asset formats, RD-07 loaders/disk delivery, RD-08 optional optimization, or RD-09 production editor features. | User approved the recommended planning baseline on 2026-09-23. | ✅ Resolved |
| AR-P2 | Technical / plan partition (complex) | Use one plan folder with nine ordered phases. Each language-family phase carries specification tests through the existing semantic/SFA/machine/ACME/VICE path where runtime behavior applies; do not split the RD into duplicate plan workflows or separate frontend/backend programs. | User approved on 2026-09-23. Independent challenger converged with High confidence: one plan avoids duplicated gates and fragmented shared-seam ownership; phase boundaries control size. | ✅ Resolved |
| AR-P3 | Verification | Use focused family/package checks during implementation. At integration boundaries run `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`, plus applicable ACME/VICE qualification, touched-file Prettier, whitespace checks, and a read-only frozen-`spec/` proof. Claim no lint result because the actual checkout has no lint script, Turbo task, or ESLint executable. | User approved the recommended planning baseline on 2026-09-23. | ✅ Resolved |
| AR-P4 | Expert-output boundary | Keep direct `optimization: none` lowering free of alternative search or parity-selection logic, while independent qualification requires every implemented operation family to meet or beat an equal-contract expert reference. A meet-only result creates an authorized actionable issue; a worse result blocks RD-04. | User authorized the AC-34/AC-37 correction on 2026-09-23; committed as `4801ac0`. | ✅ Resolved |
| AR-P5 | Native Windows evidence | Implement platform-independent semantics now and prove them on Linux plus pure deterministic cases. Defer native Node 22 Windows x64 execution to RD-10 when the user supplies access; this does not block Linux RD-04 implementation or RD-05 through RD-09 work, but the missing native evidence remains explicit. | User's standing direction places Windows at the end; the approved planning baseline retained that boundary on 2026-09-23. | ✅ Resolved |
| AR-P6 | Completion crosswalk | Keep one checked static JSON crosswalk under `test/rd04/` and one direct Vitest which compares its source keys with the frozen grammar productions, named semantic rules, active diagnostics, and applicable conformance clauses. Each row names only its implementation owner, decisive proof, and status. Add no generator, service, dashboard, or second specification. | User approved the recommendation on 2026-09-23. Required by RD-04 R4.2; no equivalent artifact exists in the current tree. | ✅ Resolved |
| AR-P7 | Qualification layout | Keep focused specification and implementation tests beside the existing compiler/CLI/LSP modules. Put only cross-stage fixtures, independent behavior oracles, expert references, ACME checks, and bounded sequential VICE cases under `test/rd04/`, reusing the public compiler and the RD-03 VICE protocol. Add no package or general test framework. | User approved the recommendation on 2026-09-23. This follows the current co-located compiler tests and root `test/m1/` qualification boundary. | ✅ Resolved |
| AR-P8 | Source structure | Extend the existing frontend → semantic → SFA → machine → artifact path. When a phase touches an existing file already above roughly 700 lines, first move its current responsibility into a focused module in the same directory, then add the required behavior there. Do not pre-split smaller files, change package topology, or add a pass/plugin framework. | User approved the recommendation on 2026-09-23. `parser.ts`, `analyzer.ts`, `semantic/lower.ts`, and `machine/lower.ts` are already 766–857 lines; RD-04 forbids a new framework. | ✅ Resolved |
| AR-P9 | Expressiveness-ledger location | Keep the conformance feature as the ownership destination, but place RD-04's v4 ledger and executable expiry gate at `test/rd04/expressiveness-ledger.json` and `test/rd04/expressiveness-ledger.spec.test.ts`, beside the other approved cross-stage evidence. Do not recreate the absent `packages/test-harness` package. The gate compiles each recorded restriction and turns red when the restriction disappears so closeout must retire or re-own it. | User approved on 2026-09-23. The named `packages/test-harness` package/file does not exist in this checkout; the conformance roadmap records the older ledger pattern. | ✅ Resolved |

## Resolution Notes

### AR-P2 — Why one plan is simpler

RD-04 has many language families but one connected compiler. Separate plan folders would duplicate
ambiguity gates, preflights, closeouts and ownership of shared representations. One plan keeps a
single progress authority. Its nine phases remain independently reviewable and qualify complete
families instead of postponing all backend integration to the end.

The strongest counterargument is that later task detail may become stale as earlier representation
work lands. The plan therefore fixes phase contracts and tests, while each phase re-evaluates its
current implementation before execution as required by the project workflow.

**Confidence:** High. **Hardening:** Independent challenger converged; no better partition was
identified.
