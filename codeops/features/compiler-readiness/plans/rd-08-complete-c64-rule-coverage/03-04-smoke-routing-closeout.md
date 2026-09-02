# Smoke, Defect Routing and Closeout: RD-08

> **Document**: 03-04-smoke-routing-closeout.md
> **Parent**: [Index](00-index.md)

## Overview

This component keeps ordinary development fast, publishes deterministic summaries, routes defects
without fixing them in RD-08 and performs the mandatory deferral-expiry audit. (AR-1, AR-7)

## Bounded smoke selection

`readiness-smoke-selection.ts` validates an explicit versioned list of case identities:

- no more than 4 cases from any included family;
- no more than 16 generated cases total;
- no implicit membership when a family grows;
- no exhaustive command or production readiness VICE route reachable from the root smoke graph;
- deterministic lexical order and unique identities.

The fifth case in one family and seventeenth total are rejected. The selector does not discover
files, schedule work or execute cases; existing Vitest configs and commands retain those jobs.
(AR-7)

## Explicit campaigns

Full non-emulator readiness can be invoked by family, evidence tier or complete denominator.
Emulator campaigns are separately bounded/local. Neither command enters Turbo's normal test graph.
The compiler test-harness emulator tier remains independently owned and unchanged.

## Result summaries and ownership

Summaries count modeled, passing, failing, blocking and non-source evidence per family and retain
rule-level drill-down. Semantic failures route to compiler recovery/conformance; cost-only rows
route to assembly parity/optimizer ownership. A semantically passing case cannot claim expert
parity without independent cost evidence. (AR-1, AR-6)

## Closeout

The reusable closeout validator has an early specification case for missing/repaired ownership,
but that synthetic case is not ST-32 and cannot satisfy RD closeout. Authoritative ST-32 runs last
against the real `08-closeout.md`, campaign evidence and roadmap state only after all preceding
acceptance work is complete.

Before RD-08 reaches 100%, execution must:

1. prove all 2,112 inventory IDs have a valid terminal join;
2. prove all required routes have decisive evidence or explicit blocker;
3. preserve `spec/` byte identity and historical v1 publication bytes;
4. answer whether RD-08 expired a deferral rationale in the compiler-readiness ambiguity register,
   every RD Won't-Have section, `spec/future-considerations.md` and the expressiveness ledger;
5. reopen every expired item with an explicit owner;
6. ensure no array/call/branch/loop or loop-unrolling deferral still names RD-08 as future work.
7. run the readiness and readiness-execution coverage commands and meet the module mappings and
   thresholds in `07-testing-strategy.md`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Fifth case in a family | Reject smoke manifest | AR-7 |
| Seventeenth total case | Reject smoke manifest | AR-7 |
| Exhaustive/VICE command reachable from smoke | Boundary test fails | AR-7 |
| Semantic and cost result conflated | Reject projection | AR-6 |
| Expired deferral lacks owner | Block closeout | AR-1 |

## Testing Requirements

- ST-28–ST-31 cover smoke ceilings/topology and result ownership; the synthetic closeout-validator
  case proves validation behavior earlier, and authoritative ST-32 alone proves real closeout last.
- Time the readiness portion of root smoke and record the bounded case count; do not add a broad
  timing framework or flaky wall-clock assertion.
- Final exact full verification follows AR-7.
