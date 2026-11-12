# Preflight Report — NMI Residual Source Reads

> **Target**: [Plan index](00-index.md) and the full plan set
> **Status**: PASS WITH FIXES — all critical and major findings dispositioned before implementation
> **Date**: 2026-11-12

## Method

An independent read-only preflight auditor compared the plan against issue #147, the frozen NMI
private-home contract, the qualified expert references, and the real lowering, storage, closure and
test seams. A second independent design challenge evaluated the local-elision seam against three
alternatives. Neither reviewer modified files, ran the suite or launched VICE.

## Findings and dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| PA-1 | Critical | The issue #100 spec oracle still pins the four now-delivered forms as negatives; no task authorized retiring them, so the suite could not go green honestly. | Fixed: AR-R5b records the authorized retirement; task 1.1.7 routes the edit through the independent spec author and keeps the five-sample negative. |
| PA-2 | Major | The plan said `readOwnsZero` would replace A availability with `zeroFlagValues`; dropping the register-A conjunct would let an address-only load branch with no `lda`. | Fixed: `zeroFlagValues` is an additional conjunct; the register-A/byte guard stays and existing producers are backfilled. |
| PA-3 | Major | The authored oracle requires a memory-write local consumer that the plan did not authorize. | Fixed: AR-R1/AR-R5 and §1.4 include a constant-address byte memory write, with the same A-live proof. |
| PA-4 | Major | The design listed `bne done` with the store on fallthrough, which is inverted, and the oracle accepted any branch. | Fixed: the design uses `beq done`; ST-R3 pins the branch opcode/target relationship; the oracle correction requires it. |
| PA-5 | Major | The ledger task did not name the final probe set or set the new owner before running the gate. | Fixed: task 4.4.3 opens the owner first; 4.4.4 keeps the five-sample probe, replaces mask one with mask two, and removes the delivered probes. |
| PA-6 | Major | AR-R7 falsely claimed issue #147 authorizes arbitrary ledger edits and put a spec-test edit in the executor's set. | Fixed: AR-R7 cites the gate's own rule, routes the probe edit through the independent spec author, and records an explicit authorization. |
| PA-7 | Minor | The `== 0` Boolean inverse was unpinned and could ship the larger materialization. | Fixed: it is delivered as `AND #1; EOR #1; STA`, with an impl case and a spec positive. |
| PA-8 | Minor | Inventory and lowering could evaluate different block views, and `loweredPlace` silently falls back to a global label. | Fixed: the inventory records `elidedLocalBindings` once; lowering consumes that exact set, never recomputes; a mismatch fails loudly. |
| PA-9 | Minor | The direct-read set includes CIA1, which a different forwarding rule deliberately excludes. | Fixed: the set is for Z ownership only; the existing sample→store allowlist is unchanged and the plan states it. |
| PA-10 | Minor | The release record names #147 as the residual owner; the plan's modification set did not include it. | Fixed: task 4.4.6 updates the release record to the follow-up owner. |
| DC-1 | Major | Recomputing the elision predicate in lowering is not equivalent to inventory because the two block views differ; a mismatch can bind the access to a mainline home or a fabricated global label. | Fixed by PA-8's single-decision-owner handoff. |
| DC-2 | Major | Post-lowering `permitted`/`omitted` removal is inert on the optimization-none path and cannot satisfy the zero-home evidence. | Rejected with evidence; the plan keeps pre-SFA inventory omission. |
| DC-3 | Minor | Keeping a dead request and teaching the NMI proof to ignore it would publish a false memory home and weaken the proof. | Rejected; the request is omitted before allocation. |
| DC-4 | Minor | Local elision for bitwise/zero consumers adds proof sites without an oracle witness. | Kept, with explicit spec positives for the local store, memory write, bitwise and zero consumers; the load value is already A, so the consumer proof is the existing rule, not a new one. |

## Residual risk

- The zero-ownership rule changes mainline output for direct reads; the root affected suites and
  pinned optimizer artifacts are the guard.
- The local helper must match the frontend's actual semantic shape; task 3.3.1 verifies the emitted
  operation order before relying on it.
- The `== 0` inverse is a small scope addition; it is pinned by cost and impl tests.

## Gate verdict

**PASS WITH FIXES** — every critical and major finding is dispositioned; implementation may start
after the independent spec oracle is corrected and RED is re-captured.
