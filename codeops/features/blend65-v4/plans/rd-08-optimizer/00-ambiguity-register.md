# Ambiguity Register: RD-08 Full Optimizer

> **Status**: ✅ GATE PASSED
> **Implements**: `blend65-v4/RD-08`
> **Created**: 2026-11-01
> **CodeOps Artifact Schema**: 1

This register records the decisions needed before the full RD-08 optimizer plan
is written. It does not authorize source implementation.

## Planning scope

| Boundary | Confirmed content |
|---|---|
| Planning target | Full RD-08 optimizer, split from the v4 correctness release track |
| Context artifacts | `requirements/RD-08-optimization-and-expert-output.md`, the stopped `whole-input-cost-closure` plan and evidence, compiler architecture and tests, `codeops/AGENTS.md` |
| Modification set | New plan documents under `codeops/features/blend65-v4/plans/rd-08-optimizer/` only; no requirements, specification, source or test edits during planning |
| Plan path | Nested layout; `00-index.md` declares `Implements: blend65-v4/RD-08` |

## Decisions

| ID | Category | Decision | Evidence / authority | Status |
|---|---|---|---|---|
| AR-001 | Scope | Plan the full RD-08 optimizer, not another bounded input-size slice. The stopped 29/40 slice remains historical evidence and a compatibility baseline. | User confirmed the scope and the `whole-input-cost-closure` stop. | ✅ Resolved |
| AR-002 | Release boundary | `none` is the v4 correctness release baseline. `size` remains experimental until the optimizer is measured and qualified. The unchanged 963/725 tests remain optimizer targets, not the correctness release gate. No limit or oracle is deleted. | User confirmed “Correctness ships first; size experimental.” | ✅ Resolved |
| AR-003 | Architecture | Use one immutable shared facts bundle and an explicit ordered machine-rule runner inside the existing lowering producer. No new IR, SSA, pass registry, plugin protocol, rule DSL, runtime or dependency. Preserve semantic source identity, SFA and platform boundaries. | User selected “Shared facts + ordered rules”; read-only architecture map at `packages/compiler/src/machine/lower.ts:552-598` and `machine/lowering-provenance.ts:267-303`. | ✅ Resolved |
| AR-004 | Modes | Implement and qualify `size` first (saved 725, acquisition 963), then qualify `balanced` and `speed` on the same complete B/R/T pipeline. Four-mode definitions remain RD-08 requirements; the first optimization milestone is size-only. | User selected “Size first, then balanced/speed”; RD-08 R8.1/R8.9. | ✅ Resolved |
| AR-005 | Milestones | Phase order is shared foundation → saved 725 → acquisition 963. Each milestone has a measured go/no-go; failure stops the plan and returns to scope decision instead of adding proof patches. | User selected “Foundation, saved, acquisition”; AR-P85 measured gaps. | ✅ Resolved |
| AR-006 | Support surface | Permit a bounded new optimizer module family under the existing compiler ownership: `machine/optimization-facts.ts` ≤600 lines, `machine/optimization-rules.ts` ≤700, `machine/optimization-cost.ts` ≤400, plus focused adjacent implementation tests ≤500/700/400. No new public export family, package, dependency or runtime. Exact integration changes remain in existing owners. | User approved “Bounded optimizer modules”; current 700-line hotspots at `services/size-observer-*` and `machine/byte-value-availability.ts` forbid existing-files-only growth. | ✅ Resolved |
| AR-007 | Proof model | Every new rule returns its own behavior, effect, alias, placement and cost obligations. The final verifier checks only changed/affected facts and requires untouched operations to retain the canonical fallback or an equivalent proof. Existing whole-program family gates may be replaced only where the new obligation fully covers them; no proof or oracle is weakened. | User-selected rule architecture; explorer finding that the current all-or-nothing observer chain rejects untouched code at `services/size-observer-effects.ts:601-626`. | ✅ Resolved |
| AR-008 | Integration seam | Run facts derivation and machine rules inside `lowerMachineProgramBody` before storage projection, then re-run the existing closeStorage/bind/draft-layout/final-closure sequence. Never optimize ACME text or a post-lowering sealed program. | Explorer mapping at `machine/lower.ts:552-598`, `services/shared-storage.ts:203-256`, `machine/lowering-provenance.ts:267-303`; RD-08 R8.25. | ✅ Resolved |
| AR-009 | Shared facts | Reuse pure existing queries for reachability, value/access lifetimes, interference, place/escape/raw footprint, ordinal bounds, fixed loops, closed objects, execution domains and effect summaries. Facts are immutable and derived once per checked source/candidate; no new semantic authority. | Explorer inventory in `semantic/value-lifetimes.ts`, `semantic/aggregate-place-proof.ts`, `semantic/fixed-loop-facts.ts`, `semantic/closed-object-facts.ts`, `frontend/semantic-analysis-types.ts`. | ✅ Resolved |
| AR-010 | Cost model | Use the existing v1 B/R/T evidence schema. `B` is final loadable layout bytes including padding/repair; `R` is zeroPage → residentRam → hardwareStack → scratch; `T` is comparable semantic-path cycles from machine costs and path classes. Size orders B→R→T; unknown is never zero, a win or a stable-ID tie. | RD-08 R8.5–R8.10; existing `services/evidence.ts:218-268` and `costs-evidence-validator.ts`. | ✅ Resolved |
| AR-011 | Verification | Plan verification is `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, complete `yarn test`, targeted optimizer/fixture specs, and sequential four-profile VICE cases. No emulator case runs in parallel. | User confirmed the gate; `AGENTS.md` commands; RD-08 test strategy; existing VICE helpers. | ✅ Resolved |
| AR-012 | Frozen boundaries | No edits to `spec/`, the frozen expert authority, behavior oracles, old expectations or security permissions. No source workaround, benchmark-name recognition, game policy, new runtime or dependency. | Project `AGENTS.md`; RD-08 product boundary. | ✅ Resolved |
| AR-013 | Exclusions | The plan does not implement keyboard/correctness tasks, public `size` release claims, loader/D64 expansion, game frameworks, or optimizations whose only justification is a benchmark name. | User scope confirmation; AGENTS product boundary. | ✅ Resolved |
| AR-014 | First optimization scope | Foundation includes facts, rule runner, per-rule obligations, B/R/T cost plumbing, explicit mode selection and provenance integration; it adds no benchmark-specific rules. Saved then adds synchronous loop/byte/object/ABI rules; acquisition then adds async/raw/MMIO/global-return/composed-rule classes. | Explorer phase proposal; RD-08 R8.13–R8.29; AR-P85 evidence. | ✅ Resolved |
| AR-015 | Qualification | Report `VICE-verified / hardware-unverified`, PAL/6581 only until separately qualified. Four cooperative profiles; physical hardware remains RD-10. | `AGENTS.md`; current native evidence. | ✅ Resolved |
| AR-016 | Planning-only edit | This planning run writes only the new plan folder. It does not change requirements, roadmap rows, source, tests, or the stopped slice until the plan is approved and executed. | User confirmed modification set. | ✅ Resolved |
| AR-017 | Plan schema | Use the full multi-document CodeOps plan schema, nested layout, with specification tests ordered before implementation and `99-execution-plan.md` as the sole progress authority. | `make-plan` skill; nested layout marker. | ✅ Resolved |
| AR-018 | Go/no-go | The saved and acquisition milestones must be measured on the real fixtures with complete B/R/T and accounting. If the foundation/first tranche cannot approach the target, stop and return to the user; do not weaken or delete the limits. | User two-track decision; AR-P85. | ✅ Resolved |

## Gate result

No open material decisions remain. The register is complete for plan authoring;
implementation still requires the normal execution and review gates. No item is
silently deferred.
