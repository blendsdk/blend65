# Component Specification: Qualification and Release

> **Document**: 03-07-qualification-and-release.md
> **Parent**: [Index](00-index.md)
> **Owns**: `qualification/coverage-matrix.md`, five case files, `qualification/release.md`

## Objective

Prove that the skill is an expert decision baseline rather than a well-formatted reference set.
Qualification has three mandatory release gates: structural validity, coverage/source
traceability, and adversarial behavior. All required cells and material cases must pass;
percentages and aggregate scores cannot compensate for one dangerous misconception.

## Gate 1 — Structural

The gate checks:

- `quick_validate.py` exits successfully for `SKILL.md` frontmatter, naming, basic body content,
  and unfinished scaffold markers only;
- public name and folder remain exact;
- runtime tree contains exactly the thirteen accepted references;
- qualification tree contains exactly one coverage matrix, five case files, and one `release.md`;
- every runtime reference is linked from `SKILL.md` with a concrete loading condition;
- no link escapes the skill directory or points to a missing file;
- `agents/openai.yaml` parses and remains consistent with the router;
- no old broad reference remains after migration; and
- no new dependency, executable framework, registry, README, catalog, or second skill appears.

Topology, link, metadata, source-key, and qualification checks are separate touched-surface checks;
none is attributed to `quick_validate.py`. Gate 1 says nothing about expertise accuracy and can
never substitute for Gates 2 or 3.

## Gate 2 — Coverage and Traceability

### Coverage Matrix Schema

Each row in `qualification/coverage-matrix.md` contains:

| Field | Meaning |
|---|---|
| Cell ID | Stable concern/topic identifier |
| Requirement/AC | RD-01 traceability |
| Knowledge owner | Exact reference heading |
| Depth facets | Eight booleans or explicit N/A reasons |
| Source keys | Primary/authoritative manifest entries |
| Case IDs | One or more discriminating behavioral cases |
| Status | Incomplete, blocked-conflict, or complete |
| Review evidence | Reviewer/date and material note |

The same file contains the controlled migration ledger because no additional qualification
artifact is authorized.

### Required Coverage Families

- all live frozen specification documents;
- architecture boundaries and every invariant in RD-01;
- SFA/ABI call graph, argument-marshalling lifetimes, overlap, final storage closure, reentrancy,
  IRQ/NMI, ZP, stack, budget, and the boundary from platform asset/global placement;
- all official NMOS 6502 instruction/addressing/effect categories and required silicon hazards;
- all Blend65 operation families in the lowering casebook;
- C64 memory/runtime, VIC-II, SID, CIA, PAL/NTSC, game-system, and zero-cost API concerns;
- ACME syntax/artifact and VICE observation boundaries;
- six-target portability constraint fields;
- evidence/parity/expressiveness/recovery/harness-value and optimization-proof methods;
- source authority/conflict/offline-use rules; and
- routing, response shape, migration, single-active-version, freeze, and errata behavior.

The gate compares required and actual sets. A missing row, source, owner, case, or applicable depth
facet fails the release. The optional game-feasibility snapshot is not a source, coverage family,
qualification input, or acceptance criterion.

## Qualification Oracle Lifecycle

Oracle fields are implementation-blind and have two authority gates:

1. In Phase 1, freeze RD-01/spec/project-derived expectations only where their governing sources
   agree. Run a bounded specification-consistency audit for duplicate assignments and direct
   cross-chapter contradictions. Conflicted semantic expectations remain `blocked-conflict` until
   explicit product rulings and a reconciled specification baseline exist.
2. Keep hardware, CPU, ACME, VICE, and other external-fact expectations explicitly `draft` until
   Phase 2 pins their primary/authoritative sources. Freeze each such expectation before dependent
   replacement knowledge is authored.

`qualification/coverage-matrix.md` owns the prerequisite register without adding another artifact:
each conflict records both exact spec locations, affected case/cell IDs, proposed ruling status,
product-decision evidence, reconciled spec commit, and closure status. The product owner supplies
the rulings and separately authorizes any `spec/` correction outside this plan. Phase 7 cannot begin
final semantic qualification until every required row is closed and the reconciled commit is pinned
in `source-manifest.md`.

The current compiler, its tests, legacy skill prose, roadmaps, readiness harness, scoreboards, and
feasibility snapshot never supply expected decisions. Oracle fields are immutable after their
governing authority gate. Final result fields are append-only through evaluation/review, freeze at
the Candidate Pre-delete Gate, and remain immutable in the content checkpoint.

## Gate 3 — Adversarial Behavior

### Case File Contract

Each of the five case files contains requirement-derived cases with:

1. case ID and risk/coverage cells;
2. evaluator prompt;
3. permitted raw artifacts;
4. forbidden oracle, expected answer, prior conclusion, and author-history material;
5. expected decision invariants rather than required prose;
6. disqualifying outcomes;
7. evidence required to grade; and
8. append-only baseline/focused/final result fields.

Cases cover positive, boundary, negative, cross-domain, source-conflict, routing, and
selective-loading behavior. The case author may know the oracle; evaluators may not.

### Concern Files

| File | Primary behaviors |
|---|---|
| `routing-and-evidence.md` | Activation/non-activation, selective loading, claim classification, source hierarchy, conflict, offline answers, minimal mechanism |
| `language-architecture-and-sfa.md` | Spec semantics, modern expressibility, modular boundaries, SFA/ABI/reentrancy/closure, IL effect preservation, anti-prescription |
| `cpu-lowering-and-optimization.md` | Flags, signed comparison, arithmetic/compare/shift/helper choices, MMIO, optimization behavior and cost, 65C02 legality |
| `c64-platform-and-games.md` | Banking, CPU/VIC views, PAL/NTSC, IRQ ABI, VIC/SID/CIA, data placement, game systems, zero-cost APIs |
| `parity-recovery-and-portability.md` | Equivalent work, status classification, harness value, salvage, scaffolds, future-target seams, versioning/errata |

## Red Baseline

Before replacement knowledge is authored, pin the untouched legacy skill tree's Git commit and
content hashes. Run the high-risk subset against an isolated copy of that exact identity and record
results in the draft `qualification/release.md`:

- stale-V signed comparison trap;
- SFA mainline/interrupt reentrancy and software-stack temptation;
- C64 CPU-view versus VIC-view banking case;
- KERNAL-vector versus raw-vector interrupt ABI;
- selective-loading and source-conflict responses, including Q-R12;
- equivalent-work parity with hidden data/ZP/helper cost; and
- placeholder non-C64 plugin classification.

A case may pre-pass. Record evidence honestly. External-fact cases whose oracle is still draft are
observations, not pass/fail release evidence. This baseline demonstrates insufficiency; it does not
make legacy prose authoritative.

After recording the baseline, mark the public legacy router as `0.1.0-legacy-quarantine`,
unqualified for decisions, and retain the four pinned old references read-only as migration
evidence until the atomic replacement.

## Focused Content Runs

After each concern module is written, use a fresh context and manually allowlist only that module,
related completed modules, and permitted raw artifacts. Grade factual accuracy, depth, evidence,
and cross-module consistency. Phase 2 through Phase 6 do not claim router activation, selective
loading, response-shape, freeze, or release behavior; those facets remain pending until the
integrated Phase-7 candidate router exists.

Record pass/fail and material findings in the applicable case result fields. Fix knowledge or
source links before that content checkpoint is green. Focused runs are evidence for reviewers; they
are not the definitive complete blind suite.

## Blind Isolation Contract

Every blind evaluation uses a newly created temporary directory outside the working tree. Run the
evaluator as a fresh one-shot process inside an operating-system filesystem sandbox, using
`/usr/bin/bwrap` or an equivalently enforced boundary. Mount only the evaluation packet and the
minimum read-only system/model-client paths required to execute it; do not mount the repository,
the normal workspace, or broader user-data paths. Do not inherit author conversation/history. Copy
only:

- the exact candidate/live `SKILL.md`, `agents/openai.yaml`, and thirteen runtime references;
- the user-style prompt extracted without oracle/history fields; and
- raw artifacts explicitly allowlisted by that case.

Do not copy `qualification/`, CodeOps plans/reports, legacy references, prior outputs, hidden
invariants, or grading notes. Before accepting a run, execute a positive control that reads a
permitted packet file and a negative control that attempts to read a known repository-only path;
the latter must fail. Record the exact sandbox command, effective mounted paths, controls, copied
paths, and content hashes, then remove the temporary directory after capturing the evaluator
output. A separate grader receives the frozen oracle plus that captured output. If this access
boundary or either control cannot be enforced, the blind gate is blocked; a same-workspace promise
not to read files is insufficient. This is a manual, ephemeral procedure; no permanent runner or
framework is created.

## Review, Migration, and Final Evaluation Order

1. Integrate the candidate router and metadata in the isolated candidate tree and run focused
   routing/content checks.
2. Perform independent factual, semantic, SFA, lowering, C64-game, source, routing, migration, and
   anti-overengineering review. Apply all material corrections and rerun affected focused cases.
3. Run the definitive complete five-file blind suite once against the exact no-further-content-
   change isolated candidate, using the isolation contract, then complete independent grading and
   every evaluator, grader, packet, and review evidence write.
4. If the suite exposes a defect, correct it, independently review the changed surface, and repeat
   the complete suite. Targeted reruns alone cannot qualify changed final content.
5. Run the **Candidate Pre-delete Gate** on the qualified isolated candidate: exact topology,
   complete source/coverage/migration sets, frozen oracles, final evaluation/grade evidence, review
   resolution, and zero material conflict.
6. Replace the live router/metadata/references and delete the four old references as one coherent
   change. Run formal live-tree Gates 1–3 by checking live structure and proving the live runtime and
   qualification payload hashes are identical to the candidate whose Gate-2/3 evidence passed.

Any later change to router, metadata, runtime reference, source/coverage/migration content, case
oracle, or result evidence invalidates the definitive run. After the Candidate Pre-delete Gate,
that evidence is verified but never finalized or otherwise changed. A candidate-to-live hash
mismatch also invalidates qualification; formal Gate 3 may reuse the isolated evaluation only for
byte-identical content.

## Optimization Qualification Rule

Every optimization case has two expectations: an independent behavioral oracle and the intended
assembly/cost result. Observable behavior includes values, memory, MMIO identity/count/order, live
ABI/flag/interrupt state, and timing when timing is explicitly observable. Use exhaustive states
where tractable, adversarial boundaries, direct reference oracles, assembled execution, or VICE as
appropriate. Optimized-versus-unoptimized differential execution is supporting evidence only.

## Immutable Content Checkpoint

The checkpoint includes exactly:

- `SKILL.md` and `agents/openai.yaml`;
- all thirteen runtime references;
- `qualification/coverage-matrix.md`, including the resolved migration ledger;
- all five finalized case files with frozen oracle fields and final append-only evaluation results;
  and
- evaluation packet identities, outputs, grading, and independent-review evidence stored in those
  authorized qualification artifacts.

Complete Q-A15 and every case/result write before this commit. Mark the seven delivery phases
complete in `99-execution-plan.md` before creating the checkpoint. Afterward, the exact allowed
working-tree delta is only `qualification/release.md`, the feature roadmap, and the portfolio
roadmap. This makes the content commit stable without a self-referential record.

## Active Release Record

`qualification/release.md` records:

| Section | Required evidence |
|---|---|
| Identity | Active version, date, branch, immutable skill-content commit, superseded version |
| Scope | Qualified CPU/platform and explicit non-qualified targets |
| Structural gate | Commands and output summaries, with `quick_validate.py` scope stated narrowly |
| Coverage gate | Required/complete counts by family, zero missing/conflict cells |
| Behavioral gate | Every case ID, evaluator, grader/reviewer, result, and evidence location |
| Red baseline | Initial failures/pre-passers/draft observations and what each exposed |
| Migration | Ledger complete and superseded files absent |
| Verification | Touched Prettier, topology/links/metadata/source/spec/path/freeze checks, complete skill qualification, `spec/` clean |
| Open findings | Zero material; non-material presentation notes identified |
| Freeze | Exact single-active-version declaration and substantive-change/errata procedure |
| Impact audit | For later versions, changed rules and each dependent record's `unaffected`, `revalidated`, `corrected`, or `invalidated/reopened` disposition |

The record may be a draft before release, but it cannot claim pass or freeze. After the content
checkpoint, fill only commit-binding/release bookkeeping and update only the allowed paths. This
bookkeeping does not trigger another version bump. Historical release records remain in Git, not as
parallel working-tree files.

## Independent Review Lenses

- factual hardware/tool accuracy and revision bounds;
- compiler-semantics and SFA completeness;
- lowering correctness, effects, optimization proof, and cost accounting;
- C64 commercial-game practicality and modern-source ergonomics;
- source traceability/conflict resolution;
- selective-loading/routing coherence;
- migration loss and internal contradictions;
- minimal-mechanism/overengineering audit; and
- oracle integrity: expectations were not weakened to match authored guidance.

## Pass/Fail Rule

Release passes only if:

- the specification-consistency prerequisite has reconciled every material required conflict;
- every mandatory structural assertion passes;
- every required coverage cell is complete and every material claim is traceable;
- independent review precedes the definitive suite and all material findings are resolved;
- every mandatory behavioral case passes isolated blind evaluation on the final candidate;
- old references are removed with every migration row resolved;
- complete skill-specific qualification and touched-surface checks pass; and
- `spec/`, packages, examples, dependencies, and CI remain untouched.

No percentage threshold, majority vote, known issue, or deadline exception overrides the rule. A
blocked required source/spec conflict blocks release. The compiler's unrelated 3,000+ tests are not
run for this skill/Markdown-only feature.

## Failure Conditions

Qualification fails if authors grade their own unconstrained output, evaluators can read the
oracle/history, external-fact oracles freeze before sources, cases are weakened after a failure, a
broad aggregate hides a dangerous miss, a definitive run predates final review/corrections, an old
authority remains, release identity is ambiguous, or structural green is reported as expertise.
