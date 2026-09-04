# Requirements Delta: Blend65 Expert Skillset

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Authority**: [RD-01 — C64-First Blend65 Domain Expert Baseline](../../requirements/RD-01-c64-first-domain-expert-baseline.md)

## Authority Rule

RD-01 remains the product-scope authority. The explicit user decisions recorded in this plan's
`00-preflight-report.md` are later controlling refinements for implementation mechanics,
qualification, versioning, evidence boundaries, and verification. Where an accepted PF ruling and
the older RD text differ, the PF ruling wins; this plan applies it without expanding product scope.
The RD itself is a context document outside this preflight modification set and is not silently
rewritten. A future requirements-maintenance action may synchronize its wording, but execution does
not revert to superseded RD mechanics in the meantime.

## Confirmed Scope Delta

There is no product-scope delta. The plan implements all eighteen Must requirements and all
twenty-two acceptance criteria. No requirement is deferred, downgraded, or converted to an
aspirational note.

The following implementation interpretations are now fixed:

| RD concern | Execution interpretation |
|---|---|
| Runtime topology | Exactly thirteen reference files; no additional runtime README, alias, registry, or generated catalog. |
| Qualification topology | Exactly one coverage matrix, five concern-split case files, and one active `qualification/release.md`. |
| Semantic authority prerequisite | Spec/project-derived expectations may freeze in Phase 1 only where the frozen documents agree. Duplicate assignments and direct cross-chapter conflicts receive an independent, bounded consistency audit and explicit product ruling before final semantic qualification. No compiler behavior resolves them. |
| External-oracle order | Hardware/tool expectations remain draft until Phase 2 pins the governing primary evidence; they freeze before dependent knowledge is authored. |
| Red proof | The current four-reference baseline is evaluated against a high-risk subset, including Q-R12; known pre-passers and draft-expectation observations are recorded, never forced red or treated as final qualification. |
| Knowledge depth | Coverage cells—not page or word counts—must satisfy the eight-part depth contract. |
| Crosswalk | All 50 current `spec/**/*.md` paths receive a mapped-guidance or explicit N/A row. |
| Source pinning | The manifest records revision/version, retrieval date, dependent sections, and conflicts; runtime guidance remains usable offline. |
| Migration | `qualification/coverage-matrix.md` owns the old-rule migration ledger to avoid adding an unauthorized artifact. |
| Release identity | One active semantic version is declared in the router. Final skill content and qualification evidence are committed first; `qualification/release.md` then binds the exact content commit. Every later substantive change bumps and requalifies the single active version; Git preserves history. |
| Later recovery | The skill teaches audit criteria but freezes no current compiler-completeness claim, readiness result, feasibility-matrix claim, or tentative concrete backend topology. Material later conclusions cite skill version, content commit, knowledge heading, and source keys. |
| Technique realization | Game-development techniques are decision knowledge, not decorative lore. Each is mapped to recognizable compiler facts, one deterministic compiler/API disposition, preconditions, complete costs, hazards, and independent behavior plus assembly/cost proof. Q-P15 explicitly exercises an Integrator-style compile-time asset/scene workflow without requiring a new editor or framework. The shipped compiler has no AI or skill-runtime dependency. |
| Verification | Checks are selected by touched surface. Skill/Markdown work uses formatting, topology, links, source/spec set checks, and relevant qualification cases; it does not run the compiler suite. |

## Requirement-to-Plan Traceability

| Requirement | Owning specification | Execution phase | Primary acceptance evidence |
|---|---|---:|---|
| R1 Stable public router | 03-01 | 7 | Router cases, `quick_validate.py`, link audit |
| R2 Fixed knowledge topology | 03-01, 03-07 | 1, 7 | Exact-tree audit, coverage matrix |
| R3 Blend65 semantic crosswalk | 03-02 | 3 | 50-path set equality and architecture cases |
| R4 SFA and ABI doctrine | 03-02 | 3 | SFA adversarial cases and coverage cells |
| R5 Architecture decision discipline | 03-02 | 3 | Boundary and anti-prescription cases |
| R6 NMOS 6502/6510 expert model | 03-03 | 4 | CPU coverage matrix and silicon cases |
| R7 6502 lowering casebook | 03-03 | 4 | Operation-family cases and cost ledgers |
| R8 C64 platform/game expertise | 03-04 | 5 | PAL/NTSC, chip, banking, and game-system cases |
| R9 ACME/artifact expertise | 03-05 | 6 | ACME 0.97 probes and VICE 3.10 observations |
| R10 Target portability model | 03-05 | 6 | Six-target constraint matrix and non-claim cases |
| R11 Evidence/parity/recovery | 03-05 | 2, 6 | Audit, parity, expressiveness, salvage cases |
| R12 Pinned evidence manifest | 03-06 | 2 | Manifest completeness and claim-link audit |
| R13 Coverage-driven qualification | 03-07 | 1–7 | Every mandatory matrix row green |
| R14 Blind independent evaluation | 03-07 | 7 | Sanitized packets, evaluator outputs, reviewer result |
| R15 Controlled in-place migration | 03-01, 03-07 | 1, 7 | Old-rule ledger, exact-tree audit, Git diff |
| R16 Frozen release and errata | 03-01, 03-07 | 7 | Content commit, active release record, version-bump and impact-audit drill |
| R17 Evidence-shaped responses | 03-01, 03-05 | 2, 7 | Response-shape and uncertainty cases |
| R18 Minimal mechanism | All | 1–7 | Dependency/tree audit and full verification |

## Acceptance Ownership

| RD-01 AC | Owning proof |
|---:|---|
| 1–3 | Router validation, exact topology, and selective-loading cases |
| 4 | Deterministic spec crosswalk set comparison and frozen-tree check |
| 5–6 | Language/architecture/SFA cases and anti-prescription checks |
| 7 | CPU completeness grid plus signed-compare, decimal, wrap, RMW, and delta cases |
| 8 | C64 coverage grid plus PAL/NTSC and hardware/game cross-domain cases |
| 9 | Pinned ACME probes, byte inspection, PRG and VICE observations |
| 10 | Target constraint matrix and qualified-scope labels |
| 11–12 | Evidence/parity/recovery rules and source-manifest validation |
| 13–15 | Coverage set equality, partial red baseline, isolated blind evaluation, review record |
| 16–17 | Migration ledger, exact-tree audit, content hash, and freeze declaration |
| 18–19 | Response-shape and critical-erratum simulation cases |
| 20–22 | No-new-mechanism audit, complete skill qualification, frozen-tree/path boundaries, roadmap links |

## Out-of-Scope Enforcement

Execution stops if a proposed task requires compiler code, a language-spec edit, a new dependency,
an executable knowledge tool, a general research framework, or production qualification of a
non-C64 platform. Such work requires a later authorized feature; it cannot be smuggled into this
baseline as “supporting infrastructure.”
