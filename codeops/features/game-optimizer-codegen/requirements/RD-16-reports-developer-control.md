# RD-16: Optimization Reports and Developer Control

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-03, RD-15
> **Complexity**: L
> **CodeOps Artifact Schema**: 1

## Feature Overview

Explain what the compiler optimized, why it declined a transform, where resources went and which
budgets remain. Ordinary users select intent and budgets rather than pass order or 6502 mechanics;
compiler developers receive deterministic pass traces and bisection tools.

## Functional Requirements

### Must Have

- [ ] Produce machine-readable JSON and human-readable Markdown/text from one validated result
  model.
- [ ] Report compiler/tool/pass-manifest plus distinct execution, objective, PGO, target and
  resource-limit profile identities, budgets and assurance status.
- [ ] Report before/after linked cost vectors by program, routine, hot path and pass.
- [ ] Report pass hits, missed opportunities with stable reason codes, analysis/search fallbacks,
  padding, runtime helpers and unresolved parity debt.
- [ ] Show critical frame/IRQ paths, exact budget, measured/worst cost and remaining slack.
- [ ] Provide developer-only isolated/prefix/bisect controls without making arbitrary pass order a
  supported user contract. (AR-18, AR-20)
- [ ] Keep public optimization controls modern: named objective/profile and resource budgets, not
  register choices, instruction templates or magic addresses.
- [ ] Make reports deterministic, path-sanitized, bounded and diff-friendly.
- [ ] Distinguish semantic correctness, output quality and external capability blockers.
- [ ] Emit actionable diagnostics for unavailable proof/profile/tool evidence.

### Should Have

- [ ] Link source spans to selected hot paths/missed opportunities where stable.
- [ ] Produce a concise default summary and opt-in detailed report.

### Won't Have

- Public arbitrary pass ordering or rule injection.
- Raw user source, absolute paths, environment values or unbounded subprocess logs in reports.
- Suggestions that force users to hand-write hardware lore the compiler/platform library should own.

## Technical Requirements

Stable reason families include legality/effect, profitability, hard budget, proof unavailable,
search fallback, profile stale, capability missing and parity debt. Ordering is canonical by
program/routine/source/pass ID.

## Integration Points

- Consumes RD-01 cost, RD-03 trace, RD-12 profiles, RD-13 timing, RD-14 assurance and RD-15 corpus.
- CLI/config integration remains compatible with existing optimize Boolean until a versioned
  objective/profile surface is approved.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| User abstraction | Intent/objective/budget | AR-20 |
| Developer isolation | Internal profiles/bisection | AR-18 |
| Report dimensions | Semantic, quality, capability separate | AR-3, AR-5 |

## Security Considerations

All output paths remain beneath canonical requested roots. Report values are bounded and redact
host-specific paths/environment. JSON rendering escapes content and never embeds executable HTML
or shell fragments.

## Acceptance Criteria

1. [ ] JSON and Markdown contain identical compiler/profile/pass IDs, status, costs, budgets and
   blocker counts.
2. [ ] Two fresh reports over identical evidence are byte-identical except an explicitly excluded
   wall-clock timestamp field, which is absent from canonical JSON.
3. [ ] Every declined candidate has one stable reason code and enough bounded context to identify
   the semantic unit.
4. [ ] A search-budget fallback and a proof-unavailable case remain visible and cannot claim
   optimal/assured output.
5. [ ] A timing report names the critical path, exact budget, cost and slack/delta.
6. [ ] Semantic failure, expert parity debt and missing streamed-data capability render in separate
   sections/status fields.
7. [ ] Public configuration cannot name pass IDs/order; the developer surface can reproduce an
   isolated/prefix profile by exact identity.
8. [ ] Reports contain no absolute paths, environment-variable values or unbounded source/log data.
9. [ ] The default summary remains readable without 6502 expertise and directs advanced users to
   detailed evidence.
