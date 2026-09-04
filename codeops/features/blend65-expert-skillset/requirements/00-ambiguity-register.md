# Ambiguity Register: C64-First Blend65 Domain Expert Baseline

> **Status**: ✅ GATE PASSED — all 32 items resolved
> **Last Updated**: 2026-09-04 13:25
> **Imported authority**: [Confirmed plan-discovery register](../plans/blend65-expert-skillset/00-ambiguity-register.md)

These decisions were explicitly resolved and finally confirmed by the user during the preceding
`make-plan` discovery. They are imported unchanged so creation of the single lifecycle RD does not
restart or reinterpret discovery.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Feature ownership | New feature / existing asm-parity | New `blend65-expert-skillset` feature | ✅ Resolved |
| 2 | Technical | Public skill shape | One modular skill / several top-level skills | One `blend65-domain-expert` skill with modular references | ✅ Resolved |
| 3 | Scope | First-baseline platform depth | C64-first / all future platforms equally | Deep C64 first; future targets later | ✅ Resolved |
| 4 | Technical | General frame model | SFA invariant / reopen alternatives | SFA is the binding general frame model | ✅ Resolved |
| 5 | Scope | Compiler changes in this feature | Skill only / mixed implementation work | Skill first; audit and compiler changes later | ✅ Resolved |
| 6 | Integration | Expertise delivery | Knowledge layer / new framework | Instructions, directives, knowledge, and qualification over CodeOps | ✅ Resolved |
| 7 | Data & state | Mid-journey changes | Versioned critical errata / absolute immutability | Frozen baseline with controlled point releases and impact audit | ✅ Resolved |
| 8 | Data & state | Evidence policy | Distilled cited guidance / embedded manuals | Claim-level citations and pinned source manifest | ✅ Resolved |
| 9 | Behavioral | Qualification layers | Three gates / structural review only | Structural, coverage, and adversarial behavioral gates | ✅ Resolved |
| 10 | Scope | Knowledge decomposition | Thirteen focused modules / four broad references | Thirteen modules under one router | ✅ Resolved |
| 11 | Technical | Architecture prescription | Proven invariants / freeze tentative topology | Invariants only; topology decided after audit | ✅ Resolved |
| 12 | Integration | Language-spec treatment | Crosswalk / duplicated specification | Exhaustive crosswalk; `spec/` remains normative | ✅ Resolved |
| 13 | Scope | CPU-family depth | NMOS expert + CMOS delta / equal production depth | NMOS 6502/6510 expert; 65C02 portability delta only | ✅ Resolved |
| 14 | Data & state | Future platform additions | Versioned same-skill releases / mutation or unrelated skills | Add qualified modules between journeys through new releases | ✅ Resolved |
| 15 | Non-functional | Depth proof | Coverage contract / word count | Coverage cells, interactions, consequences, evidence, and cases | ✅ Resolved |
| 16 | Scope | C64 subject boundary | Compiler/game concerns / exhaustive machine encyclopedia | Deep compiler-relevant C64 systems and game engineering | ✅ Resolved |
| 17 | Dependencies | Runtime Internet dependency | Self-contained / browse during ordinary work | Frozen baseline is locally self-contained | ✅ Resolved |
| 18 | Data & state | Existing-reference migration | Replace in place / retain shadow copy | Migrate valid rules, then remove superseded references | ✅ Resolved |
| 19 | Behavioral | Qualification threshold | Zero material failures / percentage score | All mandatory cases and coverage cells pass | ✅ Resolved |
| 20 | Integration | Mutable code facts | Reinspect live code / freeze current status | Durable expertise only; live implementation is reinspected | ✅ Resolved |
| 21 | Scope | Requirements ownership | Standalone plan / separate requirements cycle | Superseded by AR-31: one RD owns requirements | ✅ Resolved |
| 22 | Integration | Feature roadmap | Create / omit | Create a minimal per-feature roadmap | ✅ Resolved |
| 23 | Non-functional | Verification | Targeted plus full verify / skill-only | Targeted checks and mandatory full repository verify | ✅ Resolved |
| 24 | Stakeholder conflicts | Source versus output audience | Modern input + expert output / one audience | Modern programmer ergonomics; expert 6502/C64 output | ✅ Resolved |
| 25 | Security & compliance | Authority of external content | Reference-only / executable instructions | Treat sources as untrusted reference material; no expanded authority | ✅ Resolved |
| 26 | Naming & terminology | Public identity | Preserve / rename or alias | Preserve project-local `blend65-domain-expert` and automatic discovery | ✅ Resolved |
| 27 | Edge cases | Conflicting sources | Explicit authority and block / silent selection | Apply authority order; material uncertainty blocks release or is scoped unknown | ✅ Resolved |
| 28 | Naming & terminology | File topology | Fixed runtime/qualification layout / ad hoc growth | Thirteen named references plus minimal qualification tree | ✅ Resolved |
| 29 | Data & state | Baseline identity | Version + Git + result / release framework | Semantic version, immutable commit, versioned qualification result | ✅ Resolved |
| 30 | Behavioral | Case selection | Risk/coverage-driven / quota | High-risk invariants and module integrations drive cases | ✅ Resolved |
| 31 | Integration | Roadmap identity | One RD / omit roadmap | `blend65-expert-skillset/RD-01` owns the plan lifecycle | ✅ Resolved |
| 32 | Naming & terminology | Exact concern partitions for behavioral qualification cases | Five named case files grouped by routing/evidence, language/architecture/SFA, CPU/lowering/optimization, C64/platform/games, and parity/recovery/portability (recommended) / one monolithic case file | User chose the five named concern partitions. | ✅ Resolved |

### Resolution Notes

The full rationale for AR-1 through AR-31 is preserved in the imported-authority register linked
above. The user reviewed and confirmed that complete register after the systematic 12-category
scan, then explicitly selected the RD-01 lifecycle correction surfaced during template authoring.

**AR-32:** Files under `qualification/cases/` are
`routing-and-evidence.md`, `language-architecture-and-sfa.md`,
`cpu-lowering-and-optimization.md`, `c64-platform-and-games.md`, and
`parity-recovery-and-portability.md`. This keeps each evaluator packet bounded while preserving
cross-domain cases inside the concern that owns the expected decision.
