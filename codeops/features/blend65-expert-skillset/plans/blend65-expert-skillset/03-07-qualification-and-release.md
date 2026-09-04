# Component Specification: Qualification and Release

> **Document**: 03-07-qualification-and-release.md
> **Parent**: [Index](00-index.md)
> **Owns**: `qualification/coverage-matrix.md`, five case files, `qualification/releases/v1.0.0.md`

## Objective

Prove that the skill is an expert decision baseline rather than a well-formatted reference set.
Qualification has three mandatory gates: structural validity, coverage/source traceability, and
adversarial behavior. All required cells and material cases must pass; percentages and aggregate
scores cannot compensate for one dangerous misconception.

## Gate 1 — Structural

The gate checks:

- `quick_validate.py` exits successfully;
- public name and folder remain exact;
- runtime tree contains exactly the thirteen accepted references;
- qualification tree contains exactly the accepted seven artifacts plus directories;
- every runtime reference is linked from `SKILL.md` with a concrete loading condition;
- no link escapes the skill directory or points to a missing file;
- no old broad reference remains after migration;
- `agents/openai.yaml` is valid and consistent; and
- no new dependency, executable framework, registry, README, catalog, or second skill appears.

This gate says nothing about expertise accuracy and can never substitute for Gates 2 or 3.

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

- all 50 frozen specification documents;
- architecture boundaries and every invariant in RD-01;
- SFA/ABI call graph, overlap, reentrancy, IRQ/NMI, ZP, stack, and budget concerns;
- all official NMOS 6502 instruction/addressing/effect categories and required silicon hazards;
- all Blend65 operation families in the lowering casebook;
- C64 memory/runtime, VIC-II, SID, CIA, PAL/NTSC, game-system, and zero-cost API concerns;
- ACME syntax/artifact and VICE observation boundaries;
- six-target portability constraint fields;
- evidence/parity/expressiveness/recovery/harness-value methods;
- source authority/conflict/offline-use rules; and
- routing, response shape, migration, freeze, and errata behavior.

The gate compares required and actual sets. A missing row, source, owner, case, or applicable depth
facet fails the release.

## Gate 3 — Adversarial Behavior

### Case File Contract

Each of the five case files contains immutable, requirement-derived cases with:

1. case ID and risk/coverage cells;
2. evaluator prompt;
3. permitted raw artifacts;
4. forbidden oracle, expected answer, or prior conclusion material;
5. expected decision invariants rather than required prose;
6. disqualifying outcomes;
7. evidence required to grade; and
8. final result fields completed only after evaluation.

The case author may know the oracle; the fresh evaluator may not receive it. Evaluator packets
copy the prompt and permitted artifacts only. Cases cover positive, boundary, negative,
cross-domain, source-conflict, routing, and selective-loading behavior.

### Concern Files

| File | Primary behaviors |
|---|---|
| `routing-and-evidence.md` | Activation/non-activation, selective loading, claim classification, source hierarchy, conflict, offline answers, minimal mechanism |
| `language-architecture-and-sfa.md` | Spec crosswalk, expressibility, modular boundaries, SFA/ABI/reentrancy, IL effect preservation, anti-prescription |
| `cpu-lowering-and-optimization.md` | Flags, signed comparison, arithmetic/compare/shift/helper choices, MMIO, cycles/bytes, 65C02 legality |
| `c64-platform-and-games.md` | Banking, CPU/VIC views, PAL/NTSC, IRQ ABI, VIC/SID/CIA, data placement, game systems, zero-cost APIs |
| `parity-recovery-and-portability.md` | Equivalent work, status classification, harness value, salvage, scaffolds, future-target seams, freeze/errata |

## Red Baseline

Before replacement knowledge is authored, run the high-risk subset against the current skill and
record results in the draft release file:

- stale-V signed comparison trap;
- SFA mainline/interrupt reentrancy and software-stack temptation;
- C64 CPU-view versus VIC-view banking case;
- KERNAL-vector versus raw-vector interrupt ABI;
- selective-loading and source-conflict response;
- equivalent-work parity with hidden data/ZP/helper cost; and
- placeholder non-C64 plugin classification.

A case may pre-pass. Record the evidence honestly. Qualification needs a demonstrated insufficiency
baseline, not artificially failing wording.

## Focused Green Runs

After each concern module is written, run its case file with a fresh context and only the router,
selected reference(s), and permitted artifacts. Record pass/fail and material findings. Fix
knowledge, source links, or routing before that concern checkpoint is considered green. Do not wait
until final release to discover that modules disagree.

## Final Blind Evaluation

The final suite uses fresh agents/sessions that did not author the knowledge. They receive:

- the user-style prompt;
- the released router through normal activation;
- raw spec/source/code/assembly inputs explicitly permitted by the case; and
- no expected answer, grading invariants, prior output, or author commentary.

An evaluator output is graded against the hidden invariants by an independent reviewer. The release
record identifies evaluator/reviewer roles, case result, evidence, and any rerun after correction.
Every mandatory case passes and no material finding remains open.

## Release Record

`qualification/releases/v1.0.0.md` records:

| Section | Required evidence |
|---|---|
| Identity | Version, date, branch, immutable skill-content commit |
| Scope | Qualified CPU/platform and explicit non-qualified targets |
| Structural gate | Command and output summary |
| Coverage gate | Required/complete counts by family, zero missing/conflict cells |
| Behavioral gate | Every case ID, evaluator, reviewer, result, evidence link |
| Red baseline | Initial failures/pre-passers and what each exposed |
| Migration | Ledger complete and superseded files absent |
| Verification | Focused checks, Prettier, full repository verify, `spec/` clean |
| Open findings | Must be zero material; non-material presentation notes identified |
| Freeze | Exact declaration and critical-errata procedure |

The draft record may exist before release, but it cannot claim pass or freeze. After all content and
qualification evidence are green, commit the skill content. Then insert that exact commit into the
record, rerun record/link/format checks and full verification, and commit the release record. This
avoids a self-referential hash.

## Independent Review Lenses

- factual hardware/tool accuracy and revision bounds;
- compiler-semantics and SFA completeness;
- lowering correctness, effects, and cost accounting;
- C64 commercial-game practicality and modern-source ergonomics;
- source traceability/conflict resolution;
- selective-loading/routing coherence;
- migration loss and internal contradictions;
- minimal-mechanism/overengineering audit; and
- spec-test integrity: qualification expectations were not weakened to match authored guidance.

## Pass/Fail Rule

Release passes only if:

- every mandatory structural assertion passes;
- every required coverage cell is complete;
- every material claim is traceable;
- every mandatory behavioral case passes blind evaluation;
- all reviewer material findings are resolved and rerun;
- old references are removed with every migration row resolved;
- full repository verification passes; and
- `spec/`, packages, examples, and CI remain untouched.

No percentage threshold, majority vote, “known issue,” or deadline exception can override the
rule. A blocked required source conflict blocks release.

## Failure Conditions

Qualification fails if authors grade their own unconstrained output, evaluators see the oracle,
cases are weakened after a failure, a broad aggregate hides a dangerous miss, the release hash does
not identify the content, an old authority remains, or a green structure check is reported as
expertise proof.
