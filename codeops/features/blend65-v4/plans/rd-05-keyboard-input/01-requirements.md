# Requirements: keyboard and combined input

> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) — owning requirements document

## Scope delta

| In this plan                          | Authority                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| R5.25 / AC-20                         | Keyboard acquisition and saved-observation API; AR-P2/AR-P3/AR-P10               |
| Remaining R5.24 / AC-19               | Both joystick ports' keyboard coexistence; preserve completed raw/predicate APIs |
| Necessary compiler output corrections | Exact AR-P12 three-family modification set                                       |
| One old inventory amendment           | Exact AR-P6 nine-name extension only                                             |
| Two old timer setup corrections       | Exact AR-P13 four-profile/eight-status-case CRA read/write pairs only; all substantive test behavior unchanged |

Other RD-05 slices, T-10/T-13/T-15/T-17, existing RD-08 optimization debts, asset work,
raw/D64 admission, final user-host and physical QA are outside this plan. They
are neither silently fixed nor waived. Completed T-11/T-12/T-14 are prerequisites,
not keyboard qualification. No requirement or frozen-authority edit is planned.

## Completion evidence

The [test strategy](07-testing-strategy.md) owns concrete acceptance cases.
Completion requires all execution tasks verified, all new specification cases
executed without skips, complete generated/expert cost accounting, sequential
four-profile runtime evidence, independent applicable reviews and documentation
in the existing [platform library guide](../../../../../docs/platform-libraries.md).
No keyboard output waiver is imported from the joystick pilot.

The closeout must answer whether these deliverables expire a deferral's reason.
Inspect RD-05/DEF-7's registers, the RD Won't Have section, the expressiveness
ledger and frozen future-consideration triggers without modifying frozen files.
Reassign newly due work to an explicit owner. This slice alone does not close
RD-05 or DEF-7; their other obligations remain separately owned.

Security scope is local typed source and trusted bundled input. Validate legal
unnamed enum values before access; preserve existing installed-path/hash/overlay
protections. Web authentication, encryption, rate limiting, deployment and data
migration are N/A: this change introduces none of those boundaries.
