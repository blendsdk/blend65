# Requirements: proved returned-local destination

> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md)

## Scope delta

This plan implements only the ordinary returned-local prerequisite approved by
[AR-1](00-ambiguity-register.md), in support of RD-05 R5.25/AC-20. The RD owns
the public input behavior. Frozen [FN-4/FN-5](../../../../../spec/06-functions.md#fn-4--return-value-types)
own aggregate value delivery and effect/alias preservation. This task neither
adds the input API nor completes that acceptance criterion.

Out of this plan, per AR-1: ordinary read forwarding, dead initialization,
condition/index/inlining optimization, T-10 callable assignment, T-13 host cost,
other RD-08 debts and positive keyboard/runtime qualification. No old-oracle,
specification or expert amendment is granted. The ordinary return correction is
not a new source restriction or a waiver of the expert floor.

## Plan-local acceptance

| ID  | Required result                                                                                                                                                                                                                   | Authority                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| A-1 | A qualified whole function constructs its returned local directly in the existing caller result, without a second complete local object or final full-object copy.                                                                | AR-1; FN-4/FN-5                      |
| A-2 | Every admitted access, later write and return names the same object; value, evaluation/effect order, volatile count/order, lifetime and applicable ABI state are preserved.                                                       | AR-1; frozen value/effect rules      |
| A-3 | Any failed proof retains the whole current function/copy and legal source behavior, without a new diagnostic, forced temporary or per-call variant.                                                                               | AR-1                                 |
| A-4 | All pointers, spills and helper scratch close through existing SFA before emission; no anonymous or post-closure storage appears.                                                                                                 | AR-1; AGENTS SFA boundary            |
| A-5 | Independent assembled output and runtime evidence show the ordinary witness has a net improvement, not a copy moved into other access costs. Complete artifact/resource costs and remaining parity debts are reported separately. | AR-1; AGENTS parity directive        |
| A-6 | The actual selected PA-only acquisition-shaped source is assessed for eligibility and net costs before claiming this prerequisite solves its return debt. An old DDR-writing candidate cannot substitute for it.                  | AR-1; accepted acquisition direction |

Coverage means every proof guard has a positive or fallback case; no invented
coverage percentage or new coverage infrastructure. Existing input validation,
path/process boundaries, diagnostic suppression and artifact schemas are
unchanged. Authentication, rate limiting, encryption and deployment changes are
not applicable to this internal compiler correction.

If A-5 or A-6 needs machinery excluded by AR-1, stop and reopen that support
decision. Do not declare the defect fixed merely because one copy disappeared.
