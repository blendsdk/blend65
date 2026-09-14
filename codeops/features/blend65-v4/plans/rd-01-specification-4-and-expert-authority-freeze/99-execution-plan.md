# Execution Plan: Specification 4.0 and Expert Authority Freeze

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-14 02:18
> **Progress**: 30/31 tasks (97%)
> **CodeOps Artifact Schema**: 1

## Overview

Execute RD-01 in five outcome-oriented phases. The requirements and ambiguity registers are the
immutable oracle. Each phase runs the direct checks assigned in
[Testing Strategy](07-testing-strategy.md); it does not create passive test artifacts or run the
compiler/emulator suites. AR-P10 explicitly keeps this documentation-only RD outside the generic
CodeOps spec-test file/RED template.

**Update this document immediately after each completed task.**

## Phases

| Phase | Outcome | Tasks |
|---|---|---:|
| 1 | Baseline and exact semantic oracles | 5 |
| 2 | Complete language reconciliation | 8 |
| 3 | C64 authority and frozen Specification 4 | 7 |
| 4 | Qualified isolated expert 2.0.0 candidate | 7 |
| 5 | Approval, atomic activation, and closeout | 4 |

**Total: 31 tasks across 5 phases.**

> **Execution rule:** `[ ]` is pending, `[~]` is implemented but not verified, `[x]` is verified,
> and `[!]` is blocked. Add the completion timestamp on the task line, update the progress header,
> and resume the first `[~]` task otherwise the first `[ ]` task. The exec-plan workflow commits
> each coherent green checkpoint under the repository's automatic-commit rule and never pushes.

---

## Phase 1: Baseline and Exact Semantic Oracles

> **Lenses**: input authority, determinism, scope containment
> **Checks**: V-01, V-06, V-07, V-16
> **Phase baseline tree**: `80803ebbebc89f82e482b1652e74531c2b25aae4`
> **Expected modification set**: `08-closeout.md`, this execution plan, and the feature roadmap
> **Scope mode**: strict — RD-01 authority work only

- [x] 1.1.1 Verify the Phase 0 worktree, branch, ancestry, parked-v3 status, P3 identity, expert 1.0.0 identity/content commit, and resolved AR-001–AR-050 set; freeze the current 50 `spec/` paths, raw hashes, and authority roles before any `spec/` or skill edit — `08-closeout.md` ✅ (completed: 2026-09-13 12:31)
- [x] 1.1.2 Record the exact AR-050 trigonometric formula, ranges, representative vectors, byte encodings, and two canonical fingerprints as the implementation-independent oracle — `08-closeout.md` ✅ (completed: 2026-09-13 12:34)
- [x] 1.1.3 Record the three `comptime-budget-v1` limits and exact charging/lifetime/boundary examples that later normative prose must satisfy — `08-closeout.md` ✅ (completed: 2026-09-13 12:35)
- [x] 1.1.4 Capture and hash-pin the primary D64/1541 geometry, C64 KERNAL loader, and Koala records needed by the C64 clauses before those facts freeze — `08-closeout.md` ✅ (completed: 2026-09-13 12:45)
- [x] 1.1.5 Run Phase 1 direct formatting, link, identity, oracle-reproduction, baseline-membership, source-record, scope, and plan checks; require no `spec/` or live expert-skill change — `08-closeout.md`, `99-execution-plan.md` ✅ (completed: 2026-09-13 12:48)

**Phase gate:** Input identities and exact semantic oracles reproduce. No `spec/`, compiler, or live
expert artifact changed.

---

## Phase 2: Complete Language Reconciliation

> **Lenses**: formal semantics, modern ergonomics, SFA/ABI, diagnostics
> **Checks**: V-05 semantic/grammar/diagnostic portions, V-06–V-07, V-16
> **Phase baseline tree**: `6fef4ce0d7848bc3e14c175045866364cc6986ed`

- [x] 2.1.1 Reconcile three-clause loops, effect/exit ordering, fixed-width wrap, lexical shadowing, the shared parameter/outermost-body duplicate domain, stable declaration identity, examples, grammar, and E10101 retirement — `spec/03-variables.md`, `spec/05-statements-control-flow.md`, `spec/06-functions.md`, `spec/grammar.ebnf.md`, `spec/14-diagnostics.md`, `spec/evaluations/F008-for-loop.md`, `spec/evaluations/F013-control-flow.md`, `spec/evaluations/F018-functions.md`, `spec/evaluations/F019-variables.md`, `spec/evaluations/F021-lexical-structure.md` ✅ (completed: 2026-09-13 13:18)
- [x] 2.1.2 Reconcile fixed-width arithmetic, direct-subscript promotion, narrow barriers, fixed-array extents/layout/queries/value rules, examples, grammar, and diagnostics — `spec/02-type-system.md`, `spec/04-expressions-operators.md`, `spec/08-arrays-strings.md`, `spec/grammar.ebnf.md`, `spec/14-diagnostics.md`, `spec/evaluations/F014-arrays.md`, `spec/evaluations/F016-type-system.md`, `spec/evaluations/F017-operators.md` ✅ (completed: 2026-09-13 15:18)
- [x] 2.1.3 Reconcile struct/array assignment and return, caller-owned destinations, alias-safe copies, addressable places, lifetime/provenance/escape, examples, grammar, and diagnostics — `spec/04-expressions-operators.md`, `spec/06-functions.md`, `spec/07-structs.md`, `spec/11-memory-model.md`, `spec/grammar.ebnf.md`, `spec/14-diagnostics.md`, `spec/evaluations/F006-address-of.md`, `spec/evaluations/F011-structs.md`, `spec/evaluations/F018-functions.md` ✅ (completed: 2026-09-13 15:48)
- [x] 2.1.4 Reconcile typed finite function values, target-set widening, handler kinds, per-sink LIFO install/restore ownership, raw-vector invalidation, lexical/type owners, examples, grammar, and diagnostics — `spec/01-lexical-structure.md`, `spec/02-type-system.md`, `spec/04-expressions-operators.md`, `spec/06-functions.md`, `spec/07-structs.md`, `spec/08-arrays-strings.md`, `spec/grammar.ebnf.md`, `spec/14-diagnostics.md`, `spec/evaluations/F006-address-of.md`, `spec/evaluations/F007-interrupt-functions.md`, `spec/evaluations/F016-type-system.md`, `spec/evaluations/F018-functions.md`, `spec/evaluations/F021-lexical-structure.md` ✅ (completed: 2026-09-13 16:10)
- [x] 2.1.5 Reconcile typed compile-time functions, exact AR-050 results, `comptime-budget-v1` charging and failure behavior, lexical owners, examples, grammar, diagnostics E10269–E10271, and the owning Guard evaluation — `spec/01-lexical-structure.md`, `spec/04-expressions-operators.md`, `spec/06-functions.md`, `spec/grammar.ebnf.md`, `spec/14-diagnostics.md`, `spec/evaluations/F021-lexical-structure.md`, `spec/evaluations/F025-comptime-functions.md` ✅ (completed: 2026-09-13 16:25)
- [x] 2.1.6 Reconcile `place(...)`, `loadable const`, declaration owners, captured-range publication/invalidation, must-alias flow, examples, grammar, and diagnostics — `spec/01-lexical-structure.md`, `spec/03-variables.md`, `spec/11-memory-model.md`, `spec/13-data-inclusion.md`, `spec/grammar.ebnf.md`, `spec/14-diagnostics.md`, `spec/evaluations/F005-memory-placement.md`, `spec/evaluations/F015-data-inclusion.md`, `spec/evaluations/F019-variables.md`, `spec/evaluations/F021-lexical-structure.md` ✅ (completed: 2026-09-13 17:02)
- [x] 2.1.7 Reconcile the exact five `asm_*` controls, their reserved lexical names, variable-address PEEK/POKE, checked/unchecked bounds and division, no-runtime boundary, examples, grammar, and diagnostics — `spec/01-lexical-structure.md`, `spec/04-expressions-operators.md`, `spec/08-arrays-strings.md`, `spec/12-intrinsics.md`, `spec/grammar.ebnf.md`, `spec/14-diagnostics.md`, `spec/evaluations/F012-cpu-control-intrinsics.md`, `spec/evaluations/F017-operators.md`, `spec/evaluations/F020-memory-intrinsics.md`, `spec/evaluations/F021-lexical-structure.md` ✅ (completed: 2026-09-13 17:23)
- [x] 2.1.8 Run the whole-language semantic, grammar, diagnostic, stale-restriction, link, and formatting checks; repair only derived inconsistencies and record the Phase 2 portions of V-05–V-07 — `spec/`, `08-closeout.md`, `99-execution-plan.md` ✅ (completed: 2026-09-13 17:35)

> **Phase quality review**: Passed after authorized corrections and final independent re-review;
> no finding remains and no `*.spec.test.*` file changed.

**Phase gate:** Every approved language decision has one consistent normative meaning, grammar,
diagnostic, evaluation, and representative modern/game example. Unchanged P3 behavior remains.

---

## Phase 3: C64 Authority and Frozen Specification 4

> **Lenses**: C64 accuracy, product boundary, corpus integrity, reproducibility
> **Checks**: V-02–V-09, V-16
> **Phase baseline tree**: `12b547ec09d6ebe65f6c5d54dddce03b07f0817f`
> **Expected modification set**: `spec/`, `.clinerules/language-guard.md`, `08-closeout.md`, and
> this execution plan
> **Scope mode**: strict — C64 authority and Specification 4 freeze only

- [x] 3.1.1 Reconcile the exact nine C64 profiles and common/profile-specific CPU, video, startup, banking, IRQ, SID, artifact, exit, loader, resource, and evidence contracts — `spec/15-platform-profile.md`, `spec/appendix-c64.md` ✅ (completed: 2026-09-13 18:30)
- [x] 3.1.2 Reconcile the exact native-asset set, full-byte/low-nibble Koala meaning, standard 35-track D64/KERNAL sequential-load ABI, quiescence, publication, trusted-media boundary, and `HLE-010` against Phase 1's pinned primary records — `spec/13-data-inclusion.md`, `spec/appendix-c64.md`, `spec/evaluations/F015-data-inclusion.md`, `08-closeout.md` ✅ (completed: 2026-09-13 18:36)
- [x] 3.1.3 Reconcile the C64-only public/product statement and non-normative future-target constraints, then record dispositions and remove the four false-target appendices plus obsolete active workflow/migration files — `spec/00-introduction.md`, `spec/future-considerations.md`, `spec/appendix-c64u.md`, `spec/appendix-cx16.md`, `spec/appendix-a800xl.md`, `spec/appendix-a7800.md`, `spec/build-plan.md`, `spec/preflight-report.md`, `spec/v2-to-v3-migration.md`, `08-closeout.md` ✅ (completed: 2026-09-13 18:39)
- [x] 3.1.4 Update the Language Guard for Specification 4/qualified-target wording and complete every named rule result for every changed feature; close whole-tree grammar, diagnostic, example, link, target, and product-boundary consistency — `.clinerules/language-guard.md`, `spec/` ✅ (completed: 2026-09-13 18:56)
- [x] 3.1.5 Publish the exact normative/non-normative inventory and reproducible central corpus digest, rejecting symlinks/out-of-tree paths and recording raw final hashes without per-file identity stamps — `spec/00-normative-inventory.md`, `08-closeout.md` ✅ (completed: 2026-09-13 19:00)
- [x] 3.1.6 Complete the four-column P3→4 crosswalk, prove source/destination membership equality, rewrite the feature index as non-normative navigation, and record the final semantic-diff review — `spec/00-feature-index.md`, `08-closeout.md` ✅ (completed: 2026-09-13 19:04)
- [x] 3.1.7 Run V-02–V-09 and V-16, including digest mutation controls, exact set checks, complete Guard coverage, stale-claim searches, formatting, links, and raw hashes; freeze the resulting Specification 4 identity — `spec/`, `.clinerules/language-guard.md`, `08-closeout.md`, `99-execution-plan.md` ✅ (completed: 2026-09-13 19:13)

> **Phase quality review**: Passed after the user-authorized bounded correction pass. The final
> independent re-review reported no findings; security and performance audits were not applicable
> to this documentation-only diff, and no `*.spec.test.*` file changed.

**Phase gate:** One internally consistent C64-only Specification 4 corpus is frozen with a
reproducible digest, complete concise transition record, and zero unexplained semantic change.

---

## Phase 4: Qualified Isolated Expert 2.0.0 Candidate

> **Lenses**: expert correctness, source authority, dependency closure, evaluation isolation
> **Checks**: V-10–V-13, V-16
> **Phase baseline tree**: `f1535538e0a33f9495607654b6bcfe1b811bb2b6`
> **Expected modification set**: `_candidate/blend65-domain-expert/`, `08-closeout.md`, and this
> execution plan
> **Scope mode**: strict — isolated expert candidate and impact-based qualification only

- [x] 4.1.1 Create a regular-file-only `_candidate/blend65-domain-expert/`, seeded byte-for-byte from active expert 1.0.0; reject symlinks/non-regular entries and record the live-tree and candidate seed hashes — `_candidate/blend65-domain-expert/`, `08-closeout.md` ✅ (completed: 2026-09-13 20:30)
- [x] 4.1.2 Reconcile candidate router/metadata and language, compiler, SFA/ABI, diagnostic, and routing references to expert 2.0.0 and the frozen Spec 4 digest — `_candidate/blend65-domain-expert/SKILL.md`, `_candidate/blend65-domain-expert/agents/`, `_candidate/blend65-domain-expert/references/` ✅ (completed: 2026-09-13 20:39)
- [x] 4.1.3 Reconcile C64/D64/KERNAL/Koala, product-boundary, portability, evidence, and AR-045/AR-046 optimizer knowledge; copy Phase 1's pinned source records into source governance without importing a framework or game-policy API — `_candidate/blend65-domain-expert/references/`, `08-closeout.md` ✅ (completed: 2026-09-13 20:51)
- [x] 4.1.4 Update only affected casebook expectations, add or strengthen the required AR-046 cases, and validate every existing case identity/required field without deleting or weakening one — `_candidate/blend65-domain-expert/qualification/cases/`, `_candidate/blend65-domain-expert/qualification/coverage-matrix.md` ✅ (completed: 2026-09-13 20:59)
- [x] 4.1.5 Derive and record the byte-level router/reference/source/oracle dependency closure, changed/dependent case set, fixed unchanged controls, and strictly eligible inherited-evidence set — `_candidate/blend65-domain-expert/qualification/`, `08-closeout.md` ✅ (completed: 2026-09-13 21:08)
- [x] 4.1.6 Run deterministic candidate validation and the existing filesystem-isolated model procedure for every changed/dependent case plus one fixed unchanged control per casebook; require packet-read success, repository-read failure, a separate oracle-bearing grader, and fail-closed behavior, then record outputs, grades, and hashes — `_candidate/blend65-domain-expert/qualification/`, `08-closeout.md` ✅ (completed: 2026-09-14 00:45)
- [x] 4.1.7 Obtain one final independent evidence/domain review, resolve and re-review any critical/major finding, then commit and freeze the exact candidate digest and approval evidence packet while confirming the live skill is unchanged — `_candidate/blend65-domain-expert/`, `08-closeout.md`, `99-execution-plan.md` ✅ (completed: 2026-09-14 01:37)

**Phase gate:** The isolated candidate and impact-based evidence are complete, independently
reviewed, immutable, and ready for a user decision. The live expert remains 1.0.0.

---

## Phase 5: Approval, Atomic Activation, and Closeout

> **Lenses**: explicit authority, atomic release, rollback, deferral expiry
> **Checks**: V-14–V-16
> **Phase baseline tree**: `fbe9c58f7dff43364a17e2af0dc4ca0597f82116`
> **Expected modification set**: `.agents/skills/blend65-domain-expert/`,
> `_candidate/blend65-domain-expert/`, `08-closeout.md`, `99-execution-plan.md`, and
> `../../00-roadmap.md`
> **Scope mode**: strict; activate only the already-qualified candidate and close RD-01

- [x] 5.1.1 Present the exact candidate/evidence packet, verify that no activation command has run and the live-tree digest is unchanged, stop for explicit activation approval, and record the approved Spec/candidate identities; do not treat earlier RD or plan acceptance as activation approval — `08-closeout.md` ✅ (completed: 2026-09-14 02:14)
- [x] 5.1.2 After approval only, reject symlinks/non-regular entries, copy the candidate into the live skill, compare the complete trees byte-for-byte, and commit the content checkpoint while its release record remains candidate/not active — `_candidate/blend65-domain-expert/`, `.agents/skills/blend65-domain-expert/` ✅ (completed: 2026-09-14 02:16)
- [x] 5.1.3 Update only the release record to bind the preceding immutable content commit and Spec 4 digest, require every other file to remain byte-identical, mark expert 2.0.0 as the sole active baseline, and commit the bookkeeping record; on failure restore 1.0.0 — `.agents/skills/blend65-domain-expert/qualification/release.md`, `08-closeout.md` ✅ (completed: 2026-09-14 02:18)
- [ ] 5.1.4 Remove the plan-local candidate after the release tail passes, then finalize raw hashes, zero-findings and freeze proofs, the mandatory deferral-expiry answer/owners, direct verification log, and feature-roadmap transition to Done — `_candidate/blend65-domain-expert/`, `08-closeout.md`, `../../00-roadmap.md`, `99-execution-plan.md`

**Phase gate:** Exactly one approved expert 2.0.0 release and one frozen Specification 4 authority
share the recorded identity. RD-02 is unblocked.

## Dependency Flow

```text
verified inputs and exact oracles
  → reconciled language
  → C64-only frozen Specification 4
  → isolated qualified expert candidate
  → explicit approval and atomic activation
  → freeze/deferral closeout and RD-02
```

## Success Criteria

1. All 31 tasks and RD-01 AC-01–AC-27 pass.
2. The central Spec 4 digest and all raw final hashes reproduce.
3. The concise crosswalk has exact membership and the semantic-diff review has no unexplained
   change.
4. Every changed feature passes the Language Guard and grammar/diagnostic closure.
5. Every expert case is structurally valid; changed/dependent cases and five fixed controls have
   fresh isolated green evidence; inherited evidence has byte-identical inputs.
6. One final independent review has no unresolved critical or major finding.
7. The user approves the exact candidate before activation; all non-release bytes remain identical,
   and the release record contains only the approved binding change.
8. Deferral expiry is answered with owners, `spec/` is frozen, only the feature roadmap is updated
   on this non-integration branch, and no excluded compiler/emulator command ran.
