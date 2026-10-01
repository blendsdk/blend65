# Requirements: VIC-II collision reads

> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md)

## Scope delta

The RD remains the owning requirements document. This plan implements R5.27 and only the
collision-latch portion of AC-10 on the four existing cooperative PRG profiles (AR-P1/AR-P2).
R5.11–R5.13 supply existing volatile-access obligations; they are not new whole-RD deliverables.

Other sprite/display APIs, user-authored collision algorithms, NMI support and all unrelated
RD-05 coverage remain with their existing owners. Native Windows and physical qualification
remain at RD-10 under AR-P4. No new deferral is introduced by this plan.

## Plan-local decisions

API names and consuming behavior are owned by AR-P2. The narrow inventory-test exception is
owned by AR-P3. Verification and output-quality checks are owned by AR-P4.

## Acceptance

All [ST cases](07-testing-strategy.md) pass without weakening an oracle. Independent review,
full verification and bounded runtime evidence are recorded in the execution plan. Closeout
states which R5.27 obligations were proved and checks deferral expiry without claiming RD-05 Done.
