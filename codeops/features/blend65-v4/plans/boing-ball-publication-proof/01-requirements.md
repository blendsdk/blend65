# Requirements: bounded sprite-publication proof

> **Parent**: [Index](00-index.md)
> **Context**: RD-08; the user-approved #168 support scope, not a revision of that RD.

## Must have

| ID  | Requirement                                                                                                                                                                                                                        | Authority         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| R-1 | Establish the actual workload's bounded frame values at pointer publication, including initialization, both direction arms and unchanged iterations. Do not assert the bound at a transient incremented value of four.             | AR-1, AR-3        |
| R-2 | Establish exact immutable asset identity and complete 64-byte fetch containment for every possibly enabled sprite, before enable and after all pointer updates. Keep uncertain numerical pointers/configuration conservative.      | AR-2, AR-4, AR-5  |
| R-3 | Reuse the existing full observer/domain checks; narrow only their publication veto for exact proved source operations. Named-local/aggregate eligibility remains unchanged.                                                        | AR-2, AR-5        |
| R-4 | Forward the exact anonymous unsigned byte only through its adjacent constant equality/inequality into a sole terminal branch, preserving EOR and the original volatile read.                                                       | AR-6              |
| R-5 | Existing 9-case poll specification passes at seven bytes / nine same-page nominal cycles, and all unchanged/new boing behavior, startup and trace checks pass. Measured compiler cost decreases without substituting another mode. | AR-6, AR-8        |
| R-6 | Missing/stale/unsupported proof preserves ordinary accepted source behavior and existing diagnostics. No new source restriction, public API or runtime cost.                                                                       | AR-5, AR-7, AR-10 |
| R-7 | Analysis is finite, indexed and local to this actual source/program identity. No per-read repeated whole-program scan, guessed iteration limit or broad path-state engine.                                                         | AR-3, AR-8, AR-9  |

## Non-functional and compatibility requirements

No new dependency, parser, serialization format, cache, process or host-input surface is added.
Security validation concerns analysis ownership and adversarial source size/shape, not invented
web authentication or infrastructure. Existing `none` policy, storage closure, compiler package
boundaries and profile identities remain unchanged. Core proof/selection logic receives granular
positive, negative and boundary coverage; use the repository's existing test infrastructure.

## Out of scope

Whole-program byte/cycle parity, general ZP allocation, outlining, startup optimization and the
parent issue's later output units remain parent-owned. So do existing compiler observer debt and
unrelated issue waves. Do not alter their oracles or claims while implementing this proof.

## Acceptance

R-1–R-7 have independent specification evidence, implementation controls and applicable independent
reviews. The full impact-based checkpoint passes; frozen paths remain unchanged. The parent task
can then resume its blocked consumer/review/checkpoint tasks. This support plan alone does not
close #168 or qualify physical hardware.
