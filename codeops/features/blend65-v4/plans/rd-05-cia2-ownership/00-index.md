# CIA2 ownership implementation plan

> **Status**: Preflighted — ready for execution
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

| Document                                        | Owner                            |
| ----------------------------------------------- | -------------------------------- |
| [Decisions](00-ambiguity-register.md)           | Approved contract and exceptions |
| [Requirements](01-requirements.md)              | Thin RD-05 scope delta           |
| [Current state](02-current-state.md)            | Verified existing owners         |
| [CIA2 proof and lowering](03-cia2-ownership.md) | Technical contract               |
| [Testing](07-testing-strategy.md)               | Independent input/output cases   |
| [Execution](99-execution-plan.md)               | Sole task-progress authority     |

Independent [preflight](00-preflight-report.md) resolves three necessary
corrections within the existing compiler and qualification owners. It does not
qualify the exclusive capability; that requires the executable tasks below.

RD-05 and DEF-7 remain open after this slice. Keyboard/coexistence, takeover
profiles and remaining platform work retain their current owners. User-host and
physical-silicon qualification remain RD-10. The expert and specification stay
frozen; the lineage is expert 2.0.3/content `22cc5f00` and Specification 4.
