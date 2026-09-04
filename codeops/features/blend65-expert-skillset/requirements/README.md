# Blend65 Expert Skillset — Requirements Documents

> **Project**: Blend65 Expert Skillset — frozen C64-first domain expertise for compiler recovery
> **Status**: Complete
> **Created**: 2026-09-04
> **Architecture**: One project-local Codex skill, thirteen Markdown knowledge modules, and a
> coverage-driven Markdown qualification suite
> **CodeOps Artifact Schema**: 1

---

## Overview

This requirement set defines the expert baseline that must exist before Blend65 compiler recovery
or redesign resumes. It turns the current structurally valid but shallow
`blend65-domain-expert` skill into a versioned, source-traceable body of operational expertise for
Blend65 semantics, constrained compiler engineering, NMOS 6502/6510 code generation, C64 game
systems, assembly parity, and evidence-based recovery.

The first release is deliberately C64-first. Future machines constrain the architecture boundary,
but C128, C64 Ultimate, Commander X16, Atari 8-bit, and Atari 7800 receive deep platform expertise
only through later researched and qualified releases. This prevents superficial breadth from
weakening the C64 baseline. (AR #3, #13, #14)

## Selected Domain Lenses

| Lens | Evidence |
|---|---|
| Compiler and language | The skill governs language semantics, SFA, IR, lowering, optimization, ABI, diagnostics, assembly emission, and compiler recovery. |
| Data and migration | The skill is a versioned artifact; the current four-reference form migrates in place, and frozen baselines have explicit compatibility and critical-errata rules. |

## Domain Glossary

| Term | Definition |
|---|---|
| Baseline | A qualified semantic version of the complete skill whose knowledge and rules remain fixed during one compiler-recovery journey. |
| Journey | One bounded compiler audit, redesign, and implementation program conducted under a frozen baseline. |
| Router | The concise `SKILL.md` entrypoint that establishes shared rules and selects only the references relevant to the request. |
| Knowledge module | One focused Markdown reference containing decision-changing facts, interactions, compiler consequences, expert idioms, failure modes, sources, and review rules. |
| SFA | Static Frame Allocation: the binding general function-frame model in which frame storage and overlap are determined at compile time. |
| CPU model | Opcode legality, addressing modes, registers, flags, stack behavior, timing, and silicon behavior for a processor variant. |
| Platform model | Machine memory map, banking, devices, startup, runtime ownership, encodings, budgets, and ABI constraints. |
| Emitter | Faithful serialization of selected machine instructions and directives into ACME source; it is not the owner of target semantics. |
| Artifact packaging | Conversion of assembled bytes and metadata into a machine-loadable container such as a C64 PRG. |
| Qualification case | A realistic prompt and oracle used to test whether the skill changes an agent's decision correctly; evaluators receive the prompt but not the oracle. |
| Material failure | A factual, semantic, safety, architecture, scope, or source-handling error that could change compiler or platform behavior. |
| Point release | A reviewed correction to a critical factual defect, accompanied by requalification and a targeted audit of affected downstream decisions. |

## Document Index

| # | Document | Description | Depends On |
|---|---|---|---|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Thirty-two confirmed decisions governing the baseline | — |
| **RD-01** | [C64-First Blend65 Domain Expert Baseline](RD-01-c64-first-domain-expert-baseline.md) | Creates, qualifies, versions, and freezes the first expert baseline | — |

## Dependency Graph

```text
RD-01 C64-First Blend65 Domain Expert Baseline
```

## Suggested Implementation Order

| Phase | Documents | Description |
|---|---|---|
| **A: Baseline** | RD-01 | Specify qualification first; research, author, validate, independently evaluate, and freeze v1.0.0. |

## Key Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Public capability | One `blend65-domain-expert` skill | Prevents partial activation and version drift while references remain selectively loadable. (AR #2) |
| Memory model | SFA is binding | Prior Blend65 work established it as the achievable general frame model for the target constraints. (AR #4) |
| Architecture doctrine | Proven invariants only | The later compiler audit must choose concrete IR/pass/backend shapes from evidence. (AR #11) |
| First target | NMOS 6502/6510 + C64 | Provides real depth now; 65C02 is represented only as a portability delta. (AR #3, #13) |
| Release identity | Semantic version + Git commit + qualification result | Creates an auditable freeze without a custom release framework. (AR #7, #29) |

## How to Use These Documents

1. Use RD-01 as the requirements authority for the implementation plan.
2. Preflight the resulting plan before execution.
3. Execute specification-first: qualification oracles and red baseline before knowledge rewrites.
4. Freeze `v1.0.0` only after every acceptance criterion and verification gate passes.
5. Use the frozen skill for the separate read-only compiler recovery audit.
