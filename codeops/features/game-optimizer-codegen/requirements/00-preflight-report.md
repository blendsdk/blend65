# Preflight Report: Commercial-Game Optimizer and Code Generator Requirements

> **Status**: ✅ PREFLIGHT PASSED — all 18 findings resolved
> **Iteration**: 2 — bounded full rescan after fixes
> **Artifact**: full requirements set at `codeops/features/game-optimizer-codegen/requirements/`
> **Graph Target**: `game-optimizer-codegen/REQ-SET`
> **Audited Revision**: commit `289e0788fe2bbc7a67265232b7747846e4a35c1b`;
> starting content `sha256:1bb928fb030a68909cb25fc52746b22d8c0e119cb7cce283cf6d323ee3cf3c5e`
> **Resolved Content**: `sha256:1ac6cc6764be2abac95059e0695dc37dd6b871df54725982bd74124e3727e2ae`
> **Codebase Grounded**: 31 source/test/config/context files examined; 64 references verified
> **Mode**: Auto-design, policy version 1
> **Root Invocation ID**: `game-optimizer-codegen-preflight-20260724-01`
> **Last Updated**: 2026-07-24

> **Same-workflow review note:** these requirements were authored immediately before this preflight.
> Five independent dimension auditors and one blind design challenger were used to reduce
> self-review bias. Human expert review remains valuable before implementation begins.

## Codebase Context Summary

**Tech stack:** TypeScript/NodeNext monorepo, Yarn v1/Turborepo/Vitest, ACME and local VICE.

**Architecture:** frontend analysis currently performs definitive SFA before immutable TAC lowering;
codegen runs immutable IL passes, direct instruction translation, an empty v1 peephole, unconditional
branch relaxation/runtime pruning and ACME serialization. Current cost reports are straight-line
min/max estimates. Compiler-readiness supplies generation identity/replay foundations but its
independent oracle, target execution and reduction providers are not yet shipped.

**Key files examined:** `packages/compiler/src/api/{run-frontend,emit,build}.ts`,
`packages/codegen/src/il/{cfg,instruction,lower}.ts`,
`packages/codegen/src/il/optimizer/{pass,optimize-il}.ts`,
`packages/codegen/src/instr/{peephole,relax-branches,function-costs}.ts`,
`packages/core/src/sfa/allocation-plan.ts`, `packages/core/src/platform/{platform-profile,platform-plugin}.ts`,
`packages/readiness/src/{case-identity,replay-input-model}.ts`, test-harness VICE drivers,
the parity corpus and the feasibility matrix.

**Deterministic evidence:** the declared target was `READY` at the audit gate. Global diagnostics
were confined to the concurrently evolving `compiler-readiness/RD-02` graph at the branch point and
were not findings against or modifications to this target.

## Scan Summary

| Dimension | Findings | Highest |
|---|---:|---|
| 1 Ambiguities | 3 | 🟠 |
| 2 Implicit assumptions | 2 | 🟠 |
| 3 Logical contradictions | 2 | 🟠 |
| 4 Completeness gaps | 3 | 🟠 |
| 5 Dependency issues | 2 | 🟠 |
| 6 Feasibility | 2 | 🟠 |
| 7 Testability | 3 | 🟠 |
| 8 Security | 1 | 🟠 |
| 9 Edge cases | 2 | 🟠 |
| 10 Scope creep | 1 | 🟠 |
| 11 Ordering | 2 | 🟠 |
| 12 Consistency | 3 | 🟠 |
| 13 Codebase alignment | 5 | 🟠 |

Overlapping symptoms were merged by root cause into 18 findings: 18 major, zero critical/minor/
observations after calibration. A blind independent challenger upheld every root cause and
resolution; it classified seven as critical in architectural consequence, but the report retains
MAJOR because each was correctable in requirements before implementation began.

## Findings and Resolutions

### PF-001: Candidate trades contradicted the final expert floor 🟠 MAJOR

**Dimensions:** Ambiguities, Logical Contradictions, Consistency
**Location:** `README.md`, Governing Acceptance Rules; `RD-01`, Must Have/AC; `RD-15`, Must Have/AC
**Problem:** one-axis Pareto trades, final routine ratios and meet-only debt described incompatible
pass states.

**Only viable resolution:** separate intermediate candidate policy from final commercial policy.
Intermediate one-axis trades may survive only with an objective and budgets; final output must have
both byte and cycle ratios ≤1.0 per covered routine, exact meets file debt, and each complete program
strictly beats its expert workload contract. Weakening either floor was rejected because it changes
the user's explicit product acceptance.

**Delegated resolution:** applied under AR-16 and AR-30.
**Confidence:** High. **Hardening:** challenger converged.

### PF-002: Four unrelated artifacts were overloaded as “profile” 🟠 MAJOR

**Dimensions:** Ambiguities, Consistency
**Location:** `README.md`, Domain Glossary; `RD-03`; `RD-12`; `RD-17`; `RD-18`
**Problem:** execution composition, objectives, PGO observations, target facts and safety limits
could share ambiguous identity/invalidation language.

**Only viable resolution:** distinct closed execution, objective, PGO, target and resource-limit
profile types with independent schemas/revisions, plus normative CLI-to-execution mapping. One
generic envelope was rejected because the artifacts have different trust and invalidation rules.

**Delegated resolution:** applied.
**Confidence:** High. **Hardening:** challenger converged.

### PF-003: Optimizer assurance named the wrong oracle and no provider milestone 🟠 MAJOR

**Dimensions:** Consistency, Dependency Issues, Codebase Alignment
**Location:** `RD-14`, Must Have/Integration/AC
**Codebase evidence:** compiler-readiness roadmap and `packages/readiness/src/index.ts`
**Problem:** “RD-03 oracle” resolved locally to the pass manager, while required readiness oracle,
execution and reducer providers are not shipped.

**Only viable resolution:** bind assurance to versioned `compiler-readiness/RD-02` through RD-05
provider contracts and keep dependency direction through a harness adapter. A local oracle was
rejected as competing semantic authority.

**Delegated resolution:** applied.
**Confidence:** High. **Hardening:** challenger converged.

### PF-004: Provider-owned libraries/assets had implementation verbs here 🟠 MAJOR

**Dimensions:** Logical Contradictions, Scope Creep
**Location:** `RD-07`, Should Have; `RD-13`, Must/Should Have; `RD-17`, Won't Have
**Problem:** the optimizer appeared to offer platform primitives and compression rather than consume
provider-owned implementations.

**Only viable resolution:** providers own APIs/representations; this feature consumes, costs,
lowers/selects and certifies them at zero overhead. Expanding feature ownership was rejected.

**Delegated resolution:** applied.
**Confidence:** High. **Hardening:** challenger converged.

### PF-005: Corpus completeness counted undefined prose categories 🟠 MAJOR

**Dimensions:** Ambiguities, Testability
**Location:** `RD-15`, Must Have/Technical Requirements/AC-2
**Problem:** slash-separated prose yielded multiple plausible counts for “all eleven.”

**Only viable resolution:** a closed table of eleven stable workload IDs referenced by manifests.
Numbered prose was rejected because it remains fragile under wording changes.

**Delegated resolution:** applied under AR-30.
**Confidence:** High. **Hardening:** challenger converged.

### PF-006: Pass lifecycle had no failed-assurance withdrawal 🟠 MAJOR

**Dimensions:** Ambiguities, Edge Cases
**Location:** `RD-03`, lifecycle requirement/AC
**Problem:** a failed experimental/assured pass could neither disappear without breaking replay nor
leave production through a defined failure path.

**Only viable resolution:** terminal `withdrawn` with reason/replay tombstone; remediation re-enters
experimental. `retired` remains deliberate end-of-life.

**Delegated resolution:** applied.
**Confidence:** High. **Hardening:** challenger converged.

### PF-007: Requirements inverted the immutable IL contract 🟠 MAJOR

**Dimensions:** Implicit Assumptions, Codebase Alignment
**Location:** `README.md`, glossary; ambiguity register AR-6; `RD-02`
**Codebase evidence:** `packages/codegen/src/il/cfg.ts`, `lower.ts`, optimizer pass contract
**Problem:** “mutable TAC” contradicted readonly/frozen copy-on-write IL.

**Only viable resolution:** preserve immutable canonical TAC and require pure replacement/no-input-
mutation tests. Introducing mutation was rejected as a regression in replay/cache safety.

**Delegated resolution:** applied under AR-6.
**Confidence:** High. **Hardening:** challenger converged.

### PF-008: No migration existed from pre-IL SFA to late allocation 🟠 MAJOR

**Dimensions:** Completeness Gaps, Codebase Alignment
**Location:** `RD-02`; `RD-08`; ambiguity register AR-6/AR-10
**Codebase evidence:** `run-frontend.ts`, IL `cfg.ts`/operands, `AllocationPlan`, compiler results
**Problem:** current IL is plan-backed, but the required optimizer needs allocation after global
optimization.

**Only viable resolution:** allocation-neutral virtual storage and one authoritative late allocator
that materializes the existing public plan shape. A persistent provisional+final dual authority was
rejected for drift risk.

**Delegated resolution:** applied as AR-27.
**Confidence:** High. **Hardening:** challenger converged.

### PF-009: The advertised linear DAG hid backend feedback cycles 🟠 MAJOR

**Dimensions:** Dependency Issues, Ordering
**Location:** `README.md`, dependency graph/order; RD-06/RD-08/RD-11/RD-15/RD-16
**Problem:** allocation, selection, layout, timing, reports and corpus ownership created back-edges
with no convergence owner or bootstrap contract.

**Only viable resolution:** foundation interfaces first and one bounded deterministic
allocation-selection-layout coordinator; PGO refines later and provisional results cannot satisfy
commercial/optimal claims. A vague global iteration protocol was rejected.

**Delegated resolution:** applied as AR-28.
**Confidence:** High. **Hardening:** challenger converged.

### PF-010: Target-machine authority arrived after its consumers 🟠 MAJOR

**Dimensions:** Dependency Issues, Ordering, Codebase Alignment
**Location:** `README.md`, order; `RD-17`, target contract
**Codebase evidence:** duplicated interim/canonical platform profiles and `run-frontend.ts` use of
`DEFAULT_PROFILE`
**Problem:** effects/allocation/selection could be built against incomplete or C64-leaking facts.

**Only viable resolution:** an early minimal `TargetMachineContract` plus profile consolidation;
RD-17 later completes capability integration/certification.

**Delegated resolution:** applied as part of AR-28.
**Confidence:** High. **Hardening:** challenger converged.

### PF-011: Assurance/evolution were scheduled after governed passes 🟠 MAJOR

**Dimensions:** Ordering, Completeness Gaps
**Location:** `README.md`, order; `RD-14`; `RD-18`
**Problem:** pass-first delivery contradicted specification-first, identity, limits, migration and
publication requirements.

**Only viable resolution:** early proof/evolution/broker/governor foundations, per-pass evidence,
then final interaction/stress campaigns. Retrofitting later was rejected.

**Delegated resolution:** applied as part of AR-28.
**Confidence:** High. **Hardening:** challenger converged.

### PF-012: New peepholes conflicted with the immutable empty-v1 oracle 🟠 MAJOR

**Dimensions:** Codebase Alignment, Compatibility
**Location:** `RD-03`; `RD-10`
**Codebase evidence:** `peephole.ts` and immutable `peephole.spec.test.ts`
**Problem:** adding rules to the existing omitted-options entry point would invalidate v1 spec tests.

**Only viable resolution:** preserve v1 and add a versioned catalog runner/manifest seam; compiler
defaults switch only after assurance. Replacing immutable tests was rejected.

**Delegated resolution:** applied as AR-29.
**Confidence:** High. **Hardening:** challenger converged.

### PF-013: Commercial fidelity/expert baseline was not operational 🟠 MAJOR

**Dimensions:** Testability, Completeness Gaps
**Location:** `RD-15`, manifest/technical/AC
**Problem:** “faithful” and “realistic expert result” lacked scenario, observation, reviewer,
provenance, objective and mutation contracts.

**Only viable resolution:** versioned `CommercialWorkloadContract` per complete program with
negative fidelity mutations. Reviewer prose alone was rejected as unfalsifiable.

**Delegated resolution:** applied as AR-30.
**Confidence:** High. **Hardening:** challenger converged.

### PF-014: Optimizer closure was conflated with complete toolchain readiness 🟠 MAJOR

**Dimensions:** Scope Creep, Consistency
**Location:** `RD-15`; `RD-17`; README gate rules
**Codebase evidence:** feasibility matrix shows streaming/overlays as independent unplanned systems
**Problem:** the optimizer feature could never close without unrelated providers or would absorb
their implementation.

**Only viable resolution:** separate `optimizer-commercial-quality` from portfolio
`commercial-toolchain-ready`; boundary fixtures never claim providers shipped.

**Delegated resolution:** applied as AR-31.
**Confidence:** High. **Hardening:** challenger converged.

### PF-015: Exact RSS/time boundary tests were nondeterministic 🟠 MAJOR

**Dimensions:** Feasibility, Testability
**Location:** `RD-18`, resource table/AC-2
**Codebase evidence:** hosted Node CI has no deterministic RSS/scheduler environment
**Problem:** exact 2–4 GiB and exact deadline boundary success cannot be portable/reliable.

**Only viable resolution:** exact injected logical governors; injected clock/resource telemetry for
state-machine tests; bounded real stress with margins for operational ceilings. Exact host
allocation was rejected.

**Delegated resolution:** applied without changing frozen ceilings.
**Confidence:** High. **Hardening:** challenger converged.

### PF-016: “Optimal” lacked a completeness certificate 🟠 MAJOR

**Dimensions:** Testability, Feasibility
**Location:** `RD-09`; `RD-10`
**Problem:** equivalence and sample tests could pass while the enumerator omitted a cheaper sequence.

**Only viable resolution:** machine-checkable search-domain/frontier certificate, independent
small-domain enumeration and omitted-candidate mutation; otherwise label `best-found`.

**Delegated resolution:** applied as AR-33.
**Confidence:** High. **Hardening:** challenger converged.

### PF-017: 6502 architectural/bus/interrupt observables were incomplete 🟠 MAJOR

**Dimensions:** Edge Cases, Feasibility
**Location:** `RD-02`; `RD-10`; `RD-13`
**Codebase evidence:** legal opcode surface includes stack, decimal, CPU-control and interrupt forms
**Problem:** an internally exhaustive proof could omit SP/PC/flags/stack, dummy bus cycles, RMW
double writes or interrupt sampling and still claim equivalence.

**Only viable resolution:** mechanically closed architectural/opcode coverage plus target bus/
interrupt model; enforce a restricted subset where full proof is infeasible.

**Delegated resolution:** applied as AR-32.
**Confidence:** High. **Hardening:** challenger converged.

### PF-018: Host subprocess/filesystem/cancellation authority was fragmented 🟠 MAJOR

**Dimensions:** Security, Edge Cases, Distributed/Concurrent
**Location:** `RD-18`; RD-12/RD-14 security sections
**Codebase evidence:** current ACME/VICE calls inherit environment/arguments and expose incomplete
process-tree cancellation
**Problem:** executable provenance, environment, symlink TOCTOU, descendant cleanup and
cancellation/publication races were under-specified.

**Only viable resolution:** one broker with private roots, canonical executable identity, typed
options/minimal environment, process-group ownership, exact quotas and a linearized run state
machine. Per-tool ad hoc hardening was rejected.

**Delegated resolution:** applied as AR-34.
**Confidence:** High. **Hardening:** challenger converged.

## Iteration 2 Verification

- All 18 original root causes were rechecked against their changed sections and direct dependency
  surface.
- All 13 dimensions and the compiler/language, data/migration and distributed/concurrent lenses
  were rescanned.
- No unresolved critical, major, minor or observation finding remains.
- The user's fixed product intent is unchanged: modern source, expert assembly output, both local
  floors, strict whole-program win, C64-first target-parametric design, independent providers and
  no copyrighted acceptance material.

## Verdict

✅ **PREFLIGHT PASSED — all 18 findings resolved.** The set is ready for implementation planning,
subject to the explicit provider milestones and foundation-first order now recorded.
