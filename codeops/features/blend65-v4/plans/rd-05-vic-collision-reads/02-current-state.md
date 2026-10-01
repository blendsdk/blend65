# Current state: VIC-II collision reads

> **Parent**: [Index](00-index.md)
> **Inspected baseline**: 273ee95c; compiler content unchanged from 5970ed3b

## Reusable implementation

| Existing file under `packages/compiler/src/` | Evidence / role |
|---|---|
| `frontend/profile.ts:163–299` | Closed cooperative operation declarations; CIA consuming reads already use `volatile-read`. Collision bindings are absent. |
| `semantic/lower-calls.ts:173–185` | Carries the declared operation effect into the existing structured platform operation. |
| `machine/lower-platform.ts:81–159` | Dispatches target operations and retains their results through existing storage handling. |
| `machine/lower-c64.ts` | Existing direct VIC lowering owner. |
| `target/c64-kernal.ts` | Owns typed device addresses; collision facts are absent. |
| `frontend/profile.spec.test.ts` | Complete operation inventory, covered by AR-P3. |
| `frontend/profile-constants.spec.test.ts` | Exact signature/effect inventory, covered by AR-P3. |
| `frontend/profile-constants.impl.test.ts:89–101` | Existing binding-count/boundary assertions also change; approved PF-001 adjustment in task 1.3.1. |

Existing `test/rd05/cia-api.spec.test.ts`, `cia-output.spec.test.ts` and `cia-vice.spec.test.ts`
show source, assembled-output and runtime test patterns. Reuse those patterns, not their device
expectations. Test authors derive collision expectations from the approved contract/hardware.

## Dependencies and risks

No dependency or public host-command change is needed. ACME 0.97 and VICE 3.10 are existing
execution tools. Current declarations are audit evidence, not language authority.

The main risks are elimination of an unused consuming read, accidental rereads during result
retention, confusing collision clearing with IRQ acknowledgement, and a runtime oracle that
consumes the latch itself. The testing strategy owns their counterexamples.
