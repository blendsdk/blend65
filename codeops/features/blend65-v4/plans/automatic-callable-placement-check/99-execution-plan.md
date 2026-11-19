# Automatic callable placement check (#164)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-164 / #164
> **Progress**: 1/4 tasks (25%)
> **Status**: Executing — planning chunk verified; public builds not started
> **Baseline**: `e9a374cf`, clean `feature/v4-rebuild`
> **Scope**: strict; classification only
> **Reasoning**: high — final storage placement and the compiler's known call target must agree
> **Created**: 2026-11-19

## Objective

Determine how the current public compiler handles a constant memory write that coincides with
an automatically placed function-pointer variable before that variable is called.
This is a small C64 compiler-correctness check, not a compiler repair or release approval.

**Planning target:** the [T-32 next check](../current-tree-release-readiness/99-execution-plan.md#next-bounded-task-recommendation).
**Context artifacts:** the referenced analysis, existing public-build examples and current
semantic source below. **Modification set:** this mini-plan and its T-164 roadmap row only.
Temporary source projects and generated output belong under `CODEOPS_TMPDIR`, not the repository.

**Smallest viable design:** use the existing `buildProject` public API and artifact files.
Compare one unrelated-address case with one matching-address case. Do not add a test framework,
dependency, shared helper or compiler change. Run only one small emulator observation if the
final output inspection cannot settle the classification.

## Contract and limits

- Use `c64-pal-prg-kernal-6581`, canonical `optimization: "none"` and ACME 0.97.
  If execution is needed, use the existing VICE 3.10 tools sequentially.
- Use a bare automatically placed `fn(): byte` global assigned a known function.
  Do not give the variable explicit placement or take its storage address in source.
  Taking the function's address for assignment is required and is a different operation.
- Perform the constant word write after assignment and before the call. Keep the same
  declarations, assignment, write width/value and call in both cases; change only the address.
- Establish each final variable interval from that build's own labels and storage evidence.
  An address found in a prior build is only a candidate, never proof of a match.
- Confirm that the unrelated-address control really is disjoint from the function-pointer
  variable and other program-owned storage. If addresses move, recheck before interpreting.
- Record diagnostics or safe relocation separately from accepted matching-address output.
  For accepted matching output, inspect the actual pointer stores, memory write and call path.
  Record whether the write really changes the pointer bytes; coincident addresses alone do
  not establish an outdated call-target assumption or wrong runtime behavior.
- Do not impose a new language rule or assume that rejection is the only valid solution.
  If the language conclusion is unresolved, retain Unknown and report the exact open question.
- Stop at classification. A repair, new restriction or renewed acceptance of risk requires
  separate bounded work and applicable authority. #168 and release qualification stay open.
- Keep source, existing tests, shared helpers, timeouts, ledger, `spec/`, expert authority and
  historical release approval unchanged. No existing oracle-edit exception applies.

## Evidence already inspected

| Evidence | What it establishes |
| --- | --- |
| [`function-targets.ts:172–182`](../../../../../packages/compiler/src/semantic/function-targets.ts) | The semantic absolute-range map includes explicitly placed globals. |
| [`raw-write-kills.ts:499–517`](../../../../../packages/compiler/src/semantic/raw-write-kills.ts) | A constant write is compared with those ranges; this does not prove the final build outcome. |
| [Existing specification cases](../../../../../test/rd04/raw-write-callable-invalidation.spec.test.ts) | Direct-address and explicitly placed cases already have immutable expectations; reuse the public-build pattern, not their address-taking setup. |
| [Existing artifact inspection](../../../../../test/rd04/interprocedural-kill-cost.impl.test.ts) | Public builds and output inspection already have a project pattern. |

Current end-to-end classification: **Unknown**. No diagnostic, artifact or runtime result has
been produced for this check. The historical T-30 ruling does not authorize a new waiver.
This investigation is not a bugfix: no implementation or new regression oracle is planned.
Any later repair requires independent specification-first tests and meaningful RED evidence.

## Small chunks

Complete at most one numbered chunk per run, then report the result.

- [x] T-164.1 Define this check, validate the documentation and obtain independent planning review. Verified 2026-11-19: formatting, local links, checklist and exact documentation-only scope pass; independent review reports no findings. No public build or emulator run.
- [ ] T-164.2 Build the unrelated-address control and record its exact source, compiler/options/tool identities, diagnostics and final variable interval.
- [ ] T-164.3 Build the matching-address case; confirm its own final interval and inspect the relevant emitted bytes and call path. If no matching final artifact is obtained, record that limitation rather than claim coverage.
- [ ] T-164.4 Classify the result, use the minimum sequential VICE observation only if needed, obtain applicable independent reviews, record evidence limits and clean owned temporary files. Commit GREEN documentation locally through the git-commit skill; never push.

**Task verify:** for T-164.1, targeted Prettier, local links, checklist/roadmap consistency and
an exact documentation-only diff. For T-164.2–3, successful public-build evidence or exact
diagnostics, final-artifact interval checks, source/artifact hashes and relevant output
inspection. Do not treat either case as a fresh compiler-suite or release checkpoint.

**Verify:** documentation checks plus the recorded two-case classification evidence.
T-164.4 needs base correctness review and relevant semantics, SFA/ABI and emitted-code reviews;
add platform review if runtime or machine-state conclusions are made. No new specialist role:
the existing routing already covers these boundaries. No full compiler suite is required for
this investigation while production source, tests, tools and their configuration stay unchanged.

## Planning review and verification

T-164.1: independent correctness review `ses_e0d24b56effeGd0WSzXhIcP7o5`, Astra/high,
returned **no findings**. It confirmed the small-chunk boundary, final-artifact requirements,
Unknown current outcome and unchanged oracle authority. This was a planning review, not a
compiler or runtime audit. Parent validation passed targeted formatting, local links, the
four-task checklist and the exact two-document scope. Owned validation scratch is removed.
Portfolio synchronization is deferred on `feature/v4-rebuild`, as required off integration.

Later chunk evidence is recorded here, not in a new evidence subsystem.
Preserve exact small source cases and decisive excerpts in this document before deleting
temporary projects; hashes alone cannot recreate deleted evidence. If intermediate artifacts
must survive until the next chunk, name their owned directory and explain why.

Knowledge lineage: expert `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`references/evidence-parity-and-recovery.md#evidence-boundary-rules`.
This planning chunk makes no new instruction, timing or physical-hardware claim.
