# Execution — direct constant nested construction

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-09 18:13 CEST
> **Progress**: 14/14 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Phase 1 — bounded producer-to-consumer correction

> **Phase baseline tree**: 6b1e165fb42d349d442d5a36db003cc01d9612be
> **Scope mode**: strict
> **Lenses**: semantics/DX, SFA/ABI, emitted output, platform preservation, host cost

Expected modification set: the seven plan documents and closeout; keyboard approval
metadata and feature roadmap; existing `semantic/{operations,cfg,lower-expressions,
value-lifetimes}.ts` and `machine/{lower-aggregate,lower-aggregate-build,lower-function}.ts`;
focused construction helper modules if necessary; the three named new spec files
and focused internal `.impl.test.ts` files. No old test or frozen-authority edit.

Tasks below are the sole progress authority: mark `[~]` immediately after work,
`[x]` only after its named verification passes; `[!]` records a material blocker.
Update progress/timestamp after each task. Resume `[~]` first, then the first `[ ]`.
Use green coherent local commits through the git-commit skill; never push.

### Step 1.1 — specification first

- [x] 1.1.1 [spec-author] Write the three new spec files from ST-1–ST-12; preserve all old oracles. Accepted 2026-10-09 17:22 CEST after independent draft-fixture review and corrected RED; blind authorship/formatting/traceability pass.
- [x] 1.1.2 Record directed RED and pre-passing controls before implementation. Verified 2026-10-09 17:22 CEST: 16 genuine missing-output failures, 20 pre-passing controls; all old/frozen files untouched.

Deliverables: immutable independent behavior and output/storage expectations.
Verify: the three directed new files, expected RED; review author independence and
plain-language traceability. No broken/red tree is committed.

### Step 1.2 — existing construction machinery

- [x] 1.2.1 Retain fresh-local destination proof in `semantic/operations.ts` and `semantic/cfg.ts`, using a focused whole-tree constant/purity helper; 03-01 Eligibility. Directed CFG/frontend aggregate tests pass; private `fresh-proof.log`. The first root-run selector found no package tests; rerun in the owning workspace.
- [x] 1.2.2a Add focused literal-member lowering with existing capture semantics and proved child destinations; 03-01 Representation. Compiler project build and helper formatting pass; private `literal-helper-build.log`.
- [x] 1.2.2b Wire the literal helper into `semantic/lower-expressions.ts`, remove the moved body, and complete `semantic/value-lifetimes.ts` index uses; 03-01 Representation. Compiler build and directed CFG/whole-program/aggregate-copy tests pass; private `literal-wire-{build,tests}.log`.
- [x] 1.2.3 Select certified fixed child subhomes in `machine/lower-aggregate.ts`; preserve existing unknown/borrowed fallback; 03-01 Representation. Existing address-plan helper extracted to keep file size bounded. Compiler build and 20 aggregate/copy/fill/page-loop tests pass; `subhome-{build,tests}.log`.
- [x] 1.2.4a Extract shared member-resolution helpers into a focused construction module; no behavior change. Helper formatting and compiler build pass; private `members-extract-build.log`.
- [x] 1.2.4b Use the extracted helpers in existing builders and remove their duplicated definitions; no behavior change. Compiler build and 20 directed copy/fill/page tests passed before restart; recovered complete logs verified at 17:30 CEST.
- [x] 1.2.4c Elide completed members and reuse proved literal loads in existing build/function consumers; 03-01 Representation/Safety. Compiler build, 44 aggregate/storage internals and 32/36 new cases pass. Remaining four mixed-type failures are three scalar unary homes, owned by the separate producer correction below; whole-spec GREEN remains 1.2.5.
- [x] 1.2.4d Use already-proved typed scalar constants within the fresh pure literal, avoiding runtime unary homes without evaluating new constants; R1/R2. Compiler build and all 36 immutable new specifications pass, including signed packed-byte and exact no-extra-home oracles; `spec-green.log`. This necessary one-file producer correction keeps each task within the approved edit budget.
- [x] 1.2.5 Verify new specifications GREEN and affected old aggregate/copy/ABI/closure cases unchanged. New 36/36 GREEN; 32 old aggregate/return/borrow specification cases and 83 old package internals pass without edits.

Deliverables: R1–R5, no new representation kind/pass/runtime or source restriction.
Verify: targeted compiler semantic/machine internals after each producer change;
after complete consumers, all three new files and affected old aggregate suites.
Tasks needing a helper stay within one concern; if a task exceeds three files or
200 changed lines, split its checkbox before proceeding, without expanding scope.

### Step 1.3 — internal hardening and complete checkpoint

- [x] 1.3.1a Add focused semantic `.impl.test.ts` cases for purity and destination-index liveness. Nine new cases plus 26 CFG controls pass; compiler build passes. Unknown effectful qualifiers now conservatively fail the existing purity proof; no source restriction added.
- [x] 1.3.1b Add focused machine `.impl.test.ts` cases for ownership, fixed offsets, exact member elision and unknown fallback. All ten new cases pass; private `machine-internals.log`. Large-offset direct homes, retained pointer fallback, same-home load reuse and instruction/volatile barriers are covered.
- [x] 1.3.2 Run full project verification, independent routed review, complete costs and bounded deferral check; write `08-closeout.md` and update T-12 only when all gates pass. Completed 2026-10-09 18:13 CEST: install/build/typecheck and all 5,921 tests pass, two existing skips; six native reviews complete, PE-001 MINOR report-only owned by T-13. Actual row 26 bytes/34 nominal cycles, complete costs/limits and expiry in [closeout](08-closeout.md). Final formatting/links/authority guards pass; no push.

Deliverables: R6 and truthful completed/Unknown boundaries; six relevant independent
review lenses in waves of at most three children, no duplicate expensive checks.
Verify: install/build/typecheck/full tests and targeted formatting/authority guards;
full suite and every local VICE case sequential. Findings follow current authority gates.

## Dependencies and limits

Steps 1.1 → 1.2 → 1.3; no sibling task advances automatically. Expert 2.0.4 and
frozen Specification 4.0 remain unchanged. Current public artifact schema stays
compatible. RD-05/DEF-7 and keyboard AR-P10 remain open; do not close issue #102
without separate external-action authority. No user-host or physical proof is claimed.

## Planning validation

Fresh native base-correctness and separate SFA/ABI planning reviews: no findings.
This clears the bounded plan only, not implementation, output or runtime. Fresh
foundation 12/12, forced touched Markdown formatting, 115 local file-target links,
nine unique ordered tasks, whitespace and unchanged frozen-authority guards pass.
The base reviewer accidentally saw short historical evaluation heading matches;
they were unused. Decisive reads were normative, with no qualification answers/maps.
Private logs: `nested-constant-fix.6ev3Cu` under this worktree's Git metadata.
No production/test edit or push occurred in this planning checkpoint.

Execution preparation splits two implementation checkboxes into bounded helper and
consumer edits (12 tasks total). This keeps the existing expression class and
aggregate builder within file-size rules and each edit below the task budget.
The approved correction, representations and qualification contract are unchanged.

## Specification authoring validation

The primary rejected the unaccepted draft ST-11 input before implementation: its
raw `$C000` RAM observer correctly retained 64 cold bytes, as the upstream approved
witness already records. Independent base review RV-001 and the implementation-blind
author agree that the exact observation-call repair to
`c64.vic.setBorderColor(readSaved())` restores the qualifying device-observer input.
Every assertion and other fixture remains unchanged; no existing oracle exception
or production expansion is needed. Corrected directed RED: 16 expected output/storage
failures and 20 passing behavior/safety/cold-query controls across all four profiles,
45.09 seconds; private `spec-red.log`. Files are now accepted and immutable.
