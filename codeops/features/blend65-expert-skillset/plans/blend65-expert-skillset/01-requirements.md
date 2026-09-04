# Requirements Delta: Blend65 Expert Skillset

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Authority**: [RD-01 — C64-First Blend65 Domain Expert Baseline](../../requirements/RD-01-c64-first-domain-expert-baseline.md)

## Authority Rule

RD-01 is the complete requirements authority. This file does not restate or weaken it. It records
only the execution interpretation needed to make the implementation plan deterministic. If this
file and RD-01 ever disagree, RD-01 wins and execution stops to repair the plan.

## Confirmed Scope Delta

There is no product-scope delta. The plan implements all eighteen Must requirements and all
twenty-two acceptance criteria. No requirement is deferred, downgraded, or converted to an
aspirational note.

The following implementation interpretations are now fixed:

| RD concern | Execution interpretation |
|---|---|
| Runtime topology | Exactly thirteen reference files; no additional runtime README, alias, registry, or generated catalog. |
| Qualification topology | Exactly one coverage matrix, five concern-split case files, and one `v1.0.0` release result. |
| Spec-first order | Qualification expectations are authored from RD-01 and frozen `spec/` before replacement knowledge is written. |
| Red proof | The current four-reference baseline is evaluated against high-risk cases; known pre-passers are recorded, never forced red. |
| Knowledge depth | Coverage cells—not page or word counts—must satisfy the eight-part depth contract. |
| Crosswalk | All 50 current `spec/**/*.md` paths receive a mapped-guidance or explicit N/A row. |
| Source pinning | The manifest records revision/version, retrieval date, dependent sections, and conflicts; runtime guidance remains usable offline. |
| Migration | `qualification/coverage-matrix.md` owns the old-rule migration ledger to avoid adding an unauthorized artifact. |
| Release identity | Skill content is committed first; the release result is then completed and committed separately with the exact content hash. |
| Later recovery | The skill teaches audit criteria but freezes no current compiler-completeness claim or tentative concrete backend topology. |

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
| R16 Frozen release and errata | 03-01, 03-07 | 7 | Content commit, versioned release record, errata drill |
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
| 13–15 | Coverage set equality, red baseline, blind green evaluation, review record |
| 16–17 | Migration ledger, exact-tree audit, content hash, and freeze declaration |
| 18–19 | Response-shape and critical-erratum simulation cases |
| 20–22 | No-new-mechanism audit, full verify, frozen-tree/path boundaries, roadmap links |

## Out-of-Scope Enforcement

Execution stops if a proposed task requires compiler code, a language-spec edit, a new dependency,
an executable knowledge tool, a general research framework, or production qualification of a
non-C64 platform. Such work requires a later authorized feature; it cannot be smuggled into this
baseline as “supporting infrastructure.”
