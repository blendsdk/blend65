# CIA2 ownership implementation plan

> **Status**: Complete — bounded CIA2 slice qualified; RD-05 and DEF-7 remain open
> **Created**: 2026-10-06
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Minimum-Sufficient Baseline

**Original goal:** finish the remaining CIA2 ownership work on the four existing
cooperative C64 PRG profiles, with modern source and expert-quality output.

**Smallest viable design:** extend the existing interrupt-context proof and
direct CIA/vector lowering. Add focused finite CIA2 facts to that proof, not a
second solver. Use the existing private-storage gate, wrapper, placement,
register-forwarding, artifact and VICE owners. The approved contract and exact
old-oracle exception live in [AR-P1–AR-P4](00-ambiguity-register.md).

**Excluded machinery:** new API/profile, source syntax, runtime manager,
dispatcher, shadow state, nesting guard, generic optimizer, framework, dependency
or harness. **Approved complexity:** none beyond the necessary focused facts in
the existing analysis. No game policy becomes a toolchain API.

## Documents

| Document                                        | Owner                                             |
| ----------------------------------------------- | ------------------------------------------------- |
| [Decisions](00-ambiguity-register.md)           | Approved contract and exceptions                  |
| [Requirements](01-requirements.md)              | Thin RD-05 scope delta                            |
| [Current state](02-current-state.md)            | Verified existing owners                          |
| [CIA2 proof and lowering](03-cia2-ownership.md) | Technical contract                                |
| [Testing](07-testing-strategy.md)               | Independent input/output cases                    |
| [Execution](99-execution-plan.md)               | Sole task-progress authority                      |
| [Qualification/closeout](08-closeout.md)        | Bounded native and resource proof                 |
| [Independent review](09-phase-review.md)        | Findings, bounded corrections and remaining gates |

Independent [preflight](00-preflight-report.md) resolves three necessary
corrections within the existing compiler and qualification owners. It does not
qualify the exclusive capability; that requires the executable tasks below.

RD-05 and DEF-7 remain open after this slice. Keyboard/coexistence, takeover
profiles and remaining platform work retain their current owners. User-host and
physical-silicon qualification remain RD-10. The expert and specification stay
frozen; the lineage is expert 2.0.3/content `22cc5f00` and Specification 4.

All twenty tasks are verified. The final checkpoint passes install/build/typecheck
and 5,106 tests, with two existing skips; six independent fix-review
responsibilities are clear. The [public CIA2 note](../../../../../docs/c64-cia2.md)
and [deferral check](08-closeout.md#deferral-expiry-check) record the exact
qualified boundary and still-open work. Normal NMI global assignment/bit-condition
admission debt is explicit in [#100](https://github.com/blendsdk/blend65/issues/100),
not hidden behind the private-storage contract. Mandatory T-09 startup preservation
is the next bounded RD-05 owner; no startup implementation is authorized by this
completed slice. Local green checkpoint only; no push.
