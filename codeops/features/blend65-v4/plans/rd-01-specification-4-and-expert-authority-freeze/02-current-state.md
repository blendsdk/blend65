# Current State: Specification 4.0 and Expert Authority Freeze

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The active `spec/` tree is the frozen Specification 3 input. It contains 50 Markdown files: core
chapters, one grammar, feature evaluations, five platform appendices, and historical workflow or
migration documents. Its content identity is `BLEND65-SPEC-P3-4bf8a989`.

The active expert skill is version `1.0.0`, bound to qualified content commit
`a96cfd3c41a456d4d4f983021cf43535a1d5bdaa`. It has one router, 13 references, five casebooks,
107 unique cases, one coverage matrix, and one active release record. Its qualification method is
already implementation-blind and evidence-composed.

The v4 requirement set and its AR-001–AR-048 register are preflighted. Phase 0 prepared
`feature/v4-rebuild` from the exact v3 source, parked the prior v3 worktree, and prohibited compiler
skeleton work before RD-01 freezes authority.

### Relevant Files

| File or set | Current purpose | Required change |
|---|---|---|
| `spec/00-feature-index.md` | Discovery-only v3 index | Non-normative Spec 4 transition navigation |
| `spec/00-introduction.md` through `spec/15-platform-profile.md` | Core v3 language | Reconcile approved Spec 4 behavior |
| `spec/grammar.ebnf.md` | Formal grammar | Match every retained/changed syntax form |
| `spec/evaluations/*.md` | Guard-oriented feature analyses | Reconcile changed features and Spec identity |
| `spec/appendix-c64.md` | C64 target facts | Own the exact nine-profile C64 authority |
| Four non-C64 appendices | Provisional target claims | Remove from the active tree |
| `.clinerules/language-guard.md` | v3/five-target Guard | Identify Spec 4 and qualified active targets |
| `.agents/skills/blend65-domain-expert/` | Active v1.0/P3 expert | Reconcile and qualify v2.0/Spec 4 atomically |
| `08-closeout.md` | Absent | Create P3→4 crosswalk, approval, hashes, and freeze record |

## Gaps Identified

### Gap 1: No Self-Describing Normative Corpus

**Current behavior:** P3 hashes every `spec/**/*.md` file, including non-normative history, and its
identity is recorded outside `spec/`.

**Required behavior:** Inventory-selected normative files must each name one reproducible Spec 4
identity.

**Fix required:** Implement AR-P5's fixed-field normalization and record raw at-rest hashes in the
closeout.

### Gap 2: Approved V4 Semantics Are Not Yet the Active Specification

**Current behavior:** The active text contains obsolete loop, scope, array, aggregate-return,
target, intrinsic, safety, asset, and platform claims.

**Required behavior:** RD-01 R1.5–R1.20 and the v4 AR register govern one coherent Spec 4 corpus.

**Fix required:** Reconcile clauses, grammar, examples, evaluations, Guard, and diagnostic registry
in the bounded ownership groups defined by the component documents.

### Gap 3: Expert Authority Is Bound to P3

**Current behavior:** Router, references, cases, coverage, and release evidence identify v1.0/P3
and include product-boundary or target statements that RD-01 changes.

**Required behavior:** One qualified v2.0 authority must bind exactly to Spec 4 and preserve all 107
existing case identities plus required AR-046 cases.

**Fix required:** Reconcile only affected knowledge, qualify by blast radius plus one complete blind
sample, commit candidate content, obtain approval, then update the sole release record.

## Dependencies

### Internal Dependencies

- Phase 0 handoff and exact source commit.
- V4 requirements AR-001–AR-048 and RD-01.
- Active P3 specification and expert v1.0 content as frozen inputs.
- Language Guard's 23 rules and the expert skill's current evidence method.

### External Dependencies

- GNU `find`, `sort`, and `sha256sum` for reproducible hashes.
- The installed `skill-creator` packaging validator for structural smoke validation only.
- Model evaluation and independent grading only where an existing qualification case requires it.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A changed clause conflicts with an unchanged summary | High | High | Exact crosswalk, owner map, whole-tree stale-claim scan |
| Shared grammar/diagnostics drift between semantic phases | Medium | High | Disjoint production/code ownership and phase-local integrity checks |
| Self-referential identity becomes irreproducible | Medium | High | AR-P5 normalization, exactly-one-field check, independent recomputation |
| Skill evidence is relabelled from P3 | Medium | High | Invalidate affected evidence; preserve identities; fresh composed qualification |
| Release record changes before approval | Low | Critical | Immutable content checkpoint and explicit Phase 8 stop |
| Non-C64 text is mistaken for support | Medium | High | Delete appendices; inventory and future text mark constraints non-normative |
| Plan grows a new framework | Low | Medium | Direct commands and Markdown artifacts only under AR-P3/AR-P4 |
