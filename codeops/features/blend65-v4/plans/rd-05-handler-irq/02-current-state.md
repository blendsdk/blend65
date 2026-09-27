# Current State: Handler-Side IRQ Updates

> **Parent**: [Index](00-index.md)
> **Baseline**: `497e4a47` — compiler unchanged since `5b6ef365`

## Grounded Inventory

Paths below are repository-relative. This is implementation evidence, not language authority.

| Current owner | Observed behavior / required seam |
|---|---|
| `packages/compiler/src/semantic/interrupt-ownership.ts:237` | Blanket handler-reachable update rejection precedes exact stack effects. Returning handlers currently receive a relative-depth check. |
| `packages/compiler/src/semantic/interrupt-contexts.ts:37` | Contexts use domain and total installation depth; installed handlers inherit growing depth. Removing the guard alone can make masked installation cycles expand forever. |
| `packages/compiler/src/semantic/interrupt-domains.ts:10` | Domains distinguish main/IRQ/NMI; warnings compare mainline with interrupt domains, not two overlapping IRQ roots. |
| `packages/compiler/src/storage/inventory.ts:284` | Private homes are inventoried per domain; saved links at line 407 use sink/depth and persistent storage. |
| `packages/compiler/src/storage/irq-stack.ts:92` | Existing walker follows installed chains, calls, mask delay, actual instruction sites and stack use. It lacks distinct suspended-root/link interference output. |
| `packages/compiler/src/storage/interference.ts:130` | Cross-domain conflicts do not distinguish two concurrently live IRQ roots. |
| `packages/compiler/src/storage/closure.ts:528` | Finite candidate requests already close before emission. Stack proof currently occurs after allocation; it must also supply conflicts before allocation. |
| `packages/compiler/src/machine/interrupt-specialize.ts` | Existing private-home and direct-call specialization preserves canonical function-value identity. |
| `packages/compiler/src/machine/lower-platform.ts:91` | Install/restore selects a saved word by sink and absolute depth. |
| `packages/compiler/src/machine/lower.ts:187` | Context-specific lowering constructs handler entries and the finite storage binder. |
| `packages/compiler/src/machine/lower-c64.ts` | Owns entry wrappers and vector transactions; currently 897 lines. Extract only its touched IRQ entry/transaction functions instead of growing it. |
| `packages/compiler/src/services/services.ts:224` | Provisional allocation → one symbolic instruction selection → SFA closure → binding. |
| `packages/compiler/src/services/shared-storage.ts:78` | Reuses the same symbolic program/binder for final RAM closure and asserts stable code shape. |
| `packages/compiler/src/machine/bind.ts` | Resolves homes/modes, validates code and shares exact duplicate byte-multiply helpers; it does not reselect source operations. |
| `packages/compiler/src/services/memory-evidence-records.ts:167` | Existing source/entry mapping must still identify context-specific machine functions. |

## Existing Qualification and Test Authority

| Evidence | Role |
|---|---|
| `test/rd04/expressiveness-ledger.spec.test.ts:105` | AR-P3 owns the exact positive/negative split. |
| `test/rd05/profile-interrupts.spec.test.ts:49` | AR-P6 owns the two obsolete IRQ expectations; NMI cases stay negative. |
| `test/rd04/diagnostics-resource-boundaries.spec.test.ts:65` | Unbalanced self-install retains its exact E10245 diagnostic and spans. |
| `test/rd04/stack-mask-boundary.spec.test.ts`, `stack-mask-return.spec.test.ts` | Existing NMOS instruction-boundary and epilogue cases are immutable regression coverage. |
| `test/rd04/stack-overlap-contexts.spec.test.ts`, `stack-nonreturn.spec.test.ts`, `stack-equivalent-contexts.spec.test.ts` | Preserve actual simultaneous peaks, nonreturning-chain reachability and equivalent-context reuse. |
| `test/rd04/vice.spec.test.ts`, `test/m1/vice-runtime.ts`, `test/m1/vice-monitor.ts` | Existing real IRQ/vector/stack observation and sequential VICE infrastructure. |
| `test/rd05/profile-fixture.ts`, `profiles-vice.spec.test.ts` | Existing four-profile temporary-project, artifact and emulator patterns. |

Baseline results and unchanged-oracle hashes live in the
[register's discovery checkpoint](00-ambiguity-register.md#discovery-checkpoint). Those passes
verify the current rejection, not the added capability. No new runtime measurement exists yet.

## Dependencies and Risk

Stage A and T-01 are verified prerequisites. No external dependency is added. ACME 0.97, VICE
3.10, Node 22 and the existing Yarn test commands remain the tools (AR-P5).

The high-risk failures are stale saved links, aliasing live private homes, nonterminating context
expansion and losing an IRQ-recognition opportunity during later binding. Their required remedies
are owned by [the design](03-handler-irq.md), not duplicated here. No unrelated refactor or
cleanup is authorized by this inventory.
