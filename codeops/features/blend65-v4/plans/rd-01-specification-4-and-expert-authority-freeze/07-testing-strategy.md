# Testing Strategy: Specification 4.0 and Expert Authority Freeze

> **Parent**: [Index](00-index.md)
> **Method**: Direct acceptance checks on the real Markdown and expert-skill artifacts

## Principle

RD-01 changes authority documents, not executable compiler behavior. Its immutable oracle is the
accepted requirements and ambiguity registers. Validation therefore inspects real content and
existing skill cases directly. It does not create `tests/*.md`, pretend that prose is executable,
add a Vitest pair, or add a generalized documentation/evidence harness. AR-P10 is the explicit
RD-01-only exception to the generic CodeOps spec-test file/RED template.

## Acceptance Checks

| ID | Input and action | Required observable result | Owner |
|---|---|---|---|
| V-01 | Compare the active context with the Phase 0 handoff and recorded P3/expert inputs. | Directory, branch, source ancestry, parked tree, P3 identity, expert 1.0.0 identity/content commit, and AR-001–AR-050 all match before spec editing. | R1.1, AC-01 |
| V-02 | Inspect `spec/` membership and public version after reconciliation. | One active 4.0 tree exists; no parallel spec tree or unclassified retained file exists. | R1.2–R1.3, AC-02–AC-03 |
| V-03 | Recompute the central corpus digest twice under `LC_ALL=C`, then change a copied normative byte and a copied non-normative byte. | Recomputations match; the normative mutation changes the digest; the non-normative mutation does not; raw hashes detect both; no per-file identity stamp exists. | R1.4, AC-03, AC-25 |
| V-04 | Compare the pre-edit classified 50-path P3 baseline and Spec 4 additions with the four-column crosswalk; review the full semantic diff. | Source/destination membership is exact and every material change is explained by a governing decision; no hunk ledger is needed. | R1.5, AC-04 |
| V-05 | Inspect grammar, positive/boundary examples, invalid forms, diagnostics, and Guard results for every changed language group. | Syntax, semantics, diagnostics, and all 23 Guard results agree; no failed rule, stale range loop, E10101 use, or implementation-only restriction remains. | R1.6–R1.14, R1.19–R1.20, AC-06–AC-14, AC-17–AC-18 |
| V-06 | Independently regenerate both trigonometric tables from AR-050 and check representative phases. | Ranges, ten representative values, and SHA-256 fingerprints match AR-050 exactly on repeated runs. | R1.11, AC-11 |
| V-07 | Inspect the compile-time budget clause at each charged operation, N/N+1 boundary, short-circuit, alias/copy, release, shared-root, cache-equivalence, and depths 512/513. | One deterministic `comptime-budget-v1` meaning covers every case and emits no partial output on exhaustion. | R1.11, AC-11 |
| V-08 | Compare active target/profile/asset/intrinsic sets with the accepted exact sets and search for removed target/product claims. | Exactly nine C64 profiles, five native asset forms, and five `asm_*` controls remain; false targets and compiler-supplied game-policy claims are absent. | R1.13, R1.15–R1.18, AC-13, AC-15–AC-16 |
| V-09 | Review Koala and D64/KERNAL clauses against the hash-pinned primary records captured before freeze. | Full Koala bytes are preserved with low-nibble meaning; the standard 35-track, quiescence, publication, trusted-media, and `HLE-010` boundaries are exact. | R1.15, AC-15 |
| V-10 | Validate the isolated expert candidate's regular-file-only structure, links, anchors, source keys, version, Spec digest, and stale claims. | No symlink or non-regular entry exists; packaging and deterministic checks pass outside the live path; live 1.0.0 remains byte-identical. | R1.21–R1.23, AC-19, AC-22–AC-23 |
| V-11 | Validate every case identity/field; derive the changed/transitive dependency set and inherited-evidence set from exact input hashes. | All existing IDs plus required AR-046 cases are accounted for; every rerun/inheritance decision is mechanically explainable; no expectation is weaker. | R1.22, AC-20 |
| V-12 | Run changed/dependent cases and one fixed unchanged control per casebook with the existing filesystem-isolated evaluator method. | Every required case/control is green; packet reads succeed, repository reads fail, graders alone see oracles, and qualification blocks if those controls cannot be enforced. | R1.22, AC-20 |
| V-13 | Give one independent reviewer the changed knowledge, dependency closure, controls, and complete evidence packet. | Zero unresolved critical or major authority, domain, oracle, or coverage finding remains. | R1.22–R1.23, AC-21 |
| V-14 | Verify that recorded approval precedes every activation command and that the live-tree digest stays unchanged through that checkpoint; after approval, compare the complete copied tree before release binding and inspect the release-only delta. | No activation command precedes approval; the pre-approval live digest is unchanged; all non-release files remain byte-identical, `qualification/release.md` contains only the approved binding change, and only expert 2.0.0 is active. | R1.23–R1.24, AC-22, AC-24 |
| V-15 | Recompute final spec/skill hashes and walk all stated deferral rationales. | Hashes reproduce, `spec/` is frozen, every expired rationale has a named owner, and no compiler/runtime artifact changed. | R1.25, AC-25–AC-27 |
| V-16 | Validate all touched Markdown and plan topology. | Prettier, local links, plan parsing/task totals, and whitespace checks pass. | AC-23, AC-27 |

## Direct Commands

Run from the repository root. `<touched-markdown-files>` means the explicit file list reported by
the current phase; it must not expand to unrelated Markdown.

```bash
npx prettier --check <touched-markdown-files>
python3 /home/gevik/.codex/plugins/cache/codeops-marketplace/codeops/1.2.0/scripts/validate_markdown_links.py spec codeops/features/blend65-v4/plans/rd-01-specification-4-and-expert-authority-freeze/_candidate/blend65-domain-expert codeops/features/blend65-v4
python3 /home/gevik/.codex/plugins/cache/codeops-marketplace/codeops/1.2.0/scripts/validate_markdown_links.py spec .agents/skills/blend65-domain-expert codeops/features/blend65-v4
python3 /home/gevik/.codex/plugins/cache/codeops-marketplace/codeops/1.2.0/scripts/codeops_plan.py --root . --plan codeops/features/blend65-v4/plans/rd-01-specification-4-and-expert-authority-freeze --json
python3 /home/gevik/.codex/skills/.system/skill-creator/scripts/quick_validate.py codeops/features/blend65-v4/plans/rd-01-specification-4-and-expert-authority-freeze/_candidate/blend65-domain-expert
python3 /home/gevik/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/blend65-domain-expert
```

Inventory, digest, crosswalk, target-set, Guard, diagnostic, source-key, topology, dependency, and
case-field checks use `find`, `sort`, `sha256sum`, and `rg` directly against the named artifacts.
Record the exact commands and results in `08-closeout.md`. Temporary mutation copies must stay
outside the live spec and skill paths.

## Evidence Rules

- A mechanical check records its literal command, exit status, and result in `08-closeout.md`.
- A semantic check records the reviewed paths/headings, the requirement or AR used, and the
  independent review result. It does not create a per-example ledger.
- A case is rerun when its prompt/oracle fields or any named router, reference heading, or source key
  changes. Follow those explicit links transitively; if a dependency is unclear, rerun the case.
  Evidence is inherited only when every named input hash is unchanged.
- A model run records the visible packet hashes, isolation controls, output, separate grade, and
  case ID. The grader, not the evaluator, sees the oracle.

## Excluded Commands

Do not run Blend65 build, typecheck, lint, compiler tests, ACME, VICE, readiness, emulator,
game-corpus, feasibility, or repository-wide acceptance commands for RD-01. They cannot validate a
documentation-and-expert-authority transition and would add noise rather than evidence.
