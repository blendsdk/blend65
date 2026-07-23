# Preflight continuity notes

- Audit target: `codeops/features/asm-parity/00-roadmap.md`
- Target blob at scan start: `65311a7ccd167493f6390755175de1164eb02a10`
- Artifact type: ad-hoc strategic roadmap
- Context only: asm-parity requirements/plans, conformance roadmap and triage, conformance RD-01
  execution plan, parity scoreboard and manifests, compiler/frontend/codegen implementation and
  tests, project/portfolio guidance
- Modification set: this preflight report only; no roadmap or code fixes authorized
- Domain lenses: compiler/language; data/migration

## Reconnaissance complete

- TypeScript monorepo with frontend semantic model, AST-to-IL lowering, IL-to-instruction
  translation, optional empty peephole stage, unconditional branch relaxation, ACME emission, and
  VICE-backed acceptance tests.
- The asm-parity roadmap is 72 KB and mixes a current tracker with a long chronological narrative.
- Seven of sixteen asm-parity RDs are marked done. Completed work produced measurable, tested
  improvements: placement, fused branches, block layout, symbolic-address folding, and alignment
  granularity.
- Current scoreboard: 15 pairs, 3.54x aggregate bytes and 4.65x aggregate static cycles; only
  `balloon` has a committed measured runtime window. Fourteen pairs are synthetic slices or small
  probes.
- The roadmap itself acknowledges the corpus is not game-shaped and postpones the `boing-ball`
  twin until conformance P6.
- Conformance triage identifies that the parity scoreboard cannot see programs that do not compile
  and proposes correctness/expressiveness work ahead of local optimization.
- Conformance RD-01 is already 37/52 tasks (71%) complete. The current code contains the loop-wrap,
  poke-width, and per-declaration-width fixes, so the triage's original P0 findings are partly
  historical rather than current.
- No structured CodeOps outcome events exist. Process conclusions must come from committed
  artifacts and git history, not outcome metrics.
- The full project verify was green immediately before this audit, including VICE-backed suites.

## Dimensions

- Completed: 1 Ambiguities; 2 Implicit Assumptions; 3 Logical Contradictions;
  4 Completeness Gaps; 5 Dependency Issues; 11 Ordering & Sequencing; 12 Consistency;
  13 Codebase Alignment; 6 Feasibility; 7 Testability; 8 Security; 9 Edge Cases;
  10 Scope Creep
- Completed: synthesis and independent challenger reconciliation
- Pending: user rulings on PF-001 through PF-009

## Findings so far

- Major: pause/resume policy contradicts its “parallel-safe now” list.
- Major: stale Resume/header chronology conflicts with the tracker and provides no valid current
  decision point.
- Major: cross-lane blockers, absorptions, and re-scope obligations are missing from tracker rows.
- Major: no measurable definition of asm-parity completion.
- Major: no ordered decision queue or reassessment gate for the remaining work.
- Major: the first game-shaped twin is delayed while optimization choices may continue against a
  corpus the roadmap itself calls unrepresentative.
- Major: #70 ownership/measurement return path is absent from the asm-parity tracker.
- Major: RD-08 overlaps conformance ownership without an acceptance boundary.
- Major: the aggregate cycle KPI is a one-pass static instruction-cost sum, not a runtime
  performance oracle; only `balloon` has a measured hot window.
- Major: optimizer/memory/ABI work lacks a shared MMIO-volatility and interrupt-isolation gate.
- Minor: project guidance still points to removed `CLAUDE.md`.
- Minor: superseded codebase claims remain presented as current inside the chronology.
- Minor: malformed-input/no-throw behavior is not carried as a global invariant into broad future
  lowering and optimization sweeps.

## Preliminary risks to test

- The roadmap resumes parity before memory-access/game-expressiveness work, while delaying the
  first realistic game-shaped twin; this may optimize an unrepresentative benchmark.
- Correctness, expressiveness, and performance priorities are split across overlapping roadmaps
  with prose-only dependency rules.
- The Prime Directive's whole-program “beat expert” goal is not an operational acceptance function
  for semantically equivalent, representative programs.
- Historical narrative and current state are interleaved, making the roadmap difficult to use as
  a decision surface and allowing stale claims to survive.
