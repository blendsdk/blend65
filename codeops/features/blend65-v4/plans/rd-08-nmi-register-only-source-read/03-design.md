# Design — NMI Register-Only Source Reads

> **Parent**: [Index](00-index.md)
> **Authority**: issue #100; frozen Specification 4.0; existing NMI private-home proof
> **Updated**: 2026-11-12

## 1. The missing rule

`selectRegisterForwarding` (`packages/compiler/src/machine/lower-register-forwarding.ts`) already
forwards byte loads, byte fixed reads, byte bitwise results and byte complements into an adjacent
byte bitwise operand. The assignment witness works because a separate rule accepts `call` and
`platform` byte results into a direct fixed store.

Add one rule for the same consumer shape:

```
producer: operation.kind === "platform"
          typeBytes(producer.type) === 1
          singleUseValues.has(producer.result)
consumer: the next machine operation is binary with operator & | ^
          typeBytes(consumer.type) === 1
          one operand is producer.result and the other is a compile-time constant
effect:   forwardedRegisterValues.add(producer.result)
```

Either operand order is accepted because `lowerBitwise` already commutes a register-A right operand
with a constant left operand. A non-constant mask is not forwarded in this slice and stays recorded as
a remaining restriction.

Only the platform producer class is added. A byte-returning source call is not needed by issue #100
and would widen the callee/ABI surface, so it stays out of this slice.

## 2. Why the rule is sound

| Obligation | Evidence |
|---|---|
| A holds the value at the consumer | A byte platform operation lowers to a read whose result is in A. The existing direct-store rule already relies on the same fact. |
| The consumer cannot clobber A before use | `lowerBitwise` calls `appendLoadA(left)` first, then applies the immediate ALU operation. When the forwarded value is the right operand, the same commute it already performs for a register-A right with a constant left puts it in A first. A constant operand needs no load. |
| Read count and order | The platform read still emits exactly one volatile access at the same source point. The removed instructions are the materialization store and its reload, which have no device or memory effect. |
| Flags | The rule claims A availability only. The comparison path reuses Z only through `forwardedRegisterValues` on the comparison's own left operand, which is the byte `&` result. That `AND`/`ORA`/`EOR` instruction sets N/Z from A, so the existing `readOwnsZero` premise stays true. The call/platform producer never supplies Z. |
| Aliasing | No storage is created, moved or shared. The declared global store is still one store at the same source operation. |
| Source spans | Every retained instruction keeps its original span. The removed pair belongs to the same single-use value, so no source operation loses its last observable effect. |
| ABI | The handler wrapper, stack frame and `RTI` are unchanged. |
| SFA closure | The change removes a request before the inventory is built; nothing is added or moved after closure. |

## 3. Lowered sequences and costs

The cooperative exclusive NMI variant saves A and enters binary mode. The issue's expert target uses
the same A-only shape; the compiler already emits it for the assignment witness. X and Y are untouched
by both bodies, so the selected wrapper omits their pushes under the existing dead-register proof; the
full A/X/Y shape remains the rule for bodies that clobber them.

### 3.1 Assignment witness (already delivered; regression)

```asm
pha
cld
lda $dd0d
sta pendingSources
pla
rti
```

Measured at `a5717bc5`: 10 bytes, 23 cycles, 4 stack bytes (three-byte hardware frame plus A). This is
byte-for-byte the expert sequence in issue #100.

### 3.2 Conditional witness (this plan)

```asm
pha
cld
lda $dd0d
and #$01
beq done          ; taken/not-taken depends on the source arms
lda #1
sta finished
done:
pla
rti
```

Expected: 16 bytes, 29 cycles on the path that executes the store and 24 on the branch-taken path that
skips it (25 with the conservative page-cross allowance the cost model charges), 4 stack bytes. The mask
and branch replace the retained-value store/reload pair; no private home remains.

Exact measured values are recorded in the closeout after the change. Any divergence from this shape is
a defect, not an accepted alternative.

### 3.3 Boolean value form (not delivered)

`finished = ((read() & mask) != 0)` stays rejected. The only available materialized lowering adds
`EOR #0; CMP #1; LDA #0; ADC #0` after the mask, eight bytes and eight cycles more than the expert
`AND #1; STA finished`. Shipping that as a capability would violate the parity bar, so the form is
recorded as a remaining restriction and owned by a follow-up issue instead. Reaching expert parity
needs a proved "this value is already Boolean" fact, which is a separate slice.

## 4. Restrictions that stay

| Case | Result | Reason |
|---|---|---|
| Several simultaneously retained samples | `E10245` | They genuinely need private homes; no register-only chain exists |
| A single-use local in an interrupt function | `E10245` | Locals always receive an SFA home; removing that is local-elision work, not this rule |
| A bare `if (read() != 0)` | `E10245` | The platform result has no proved Z ownership, so the value is still retained |
| A non-constant mask, or both operands non-constant | `E10245` | The ALU operand load could clobber a forwarded A |
| Any real private home | `E10245` | The NMI proof is unchanged |

The first four are recorded with probes in `v4-nmi-retained-source-reads`.

## 5. Blast radius

The rule applies wherever the producer class, single use and constant-mask consumer hold, including
mainline code. That is intentional: the removed pair is dead in mainline too. Every affected case is
covered by the root `yarn test` run, not only the compiler package suite: the root corpus owns the
pinned optimizer artifacts, the expressiveness-ledger gate and the RD-05 route suites.
