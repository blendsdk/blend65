# Design — NMI Residual Source Reads

> **Parent**: [Index](00-index.md)
> **Authority**: issue #147; frozen Specification 4.0; existing NMI private-home proof
> **Updated**: 2026-11-12

## 1. Four rules on existing seams

### 1.1 Direct-read Z ownership (bare zero test)

`machine/lower-register-forwarding.ts` gains a platform producer in the existing zero-test rule:

```
producer: platform, byte result, direct volatile byte read, single use
consumer: the next machine operation is == / != against the constant 0
          the comparison is the block's last machine operation
          the block terminates on that comparison
effect:   forwardedRegisterValues.add(producer.result)
          zeroFlagValues.add(producer.result)
```

`readOwnsZero` in `machine/lower-operation.ts` keeps its existing register-A/byte/fresh-value
conjuncts and **adds** `zeroFlagValues.has(operation.left)`. The existing load, memory-read and
byte-bitwise producers join the same set in the existing rule, so their behavior is unchanged. A
path-0 byte load is a label/storage value, not a register, so it still fails the register-A conjunct
and cannot reach a branch without an emitted `lda`.

The direct-read set is explicit and shared:

```
c64.cia1.readAndClearPendingSources
c64.cia2.readAndClearPendingSources
c64.input.readJoystick1
c64.input.readJoystick2
c64.vic.readAndClearSpriteSpriteCollisions
c64.vic.readAndClearSpriteBackgroundCollisions
```

Each lowers to one `lda absolute` whose `defines` includes Z. Z ownership uses this full set;
local elision uses the narrower forwardable subset because the existing machine selection keeps
CIA1's stable retained-value store path.

### 1.2 Boolean identity (constant mask 1)

```
producer: binary & with one compile-time constant operand equal to 1
          byte result, single use
consumer: == or != against the constant 0, single use
          the comparison is materialized, or is the block branch condition
following: a byte store, byte memory write with a constant address, or Boolean return
effect:   booleanValues.add(producer.result)
          forwardedRegisterValues.add(producer.result and comparison result)
```

`machine/lower-operation.ts` lowers the comparison as:

- branch condition: the existing `beq`/`bne` on the `AND` result's Z;
- materialized `!= 0`: the `AND` result itself, no `CMP`/`LDA`/`ADC`;
- materialized `== 0`: the `AND` result followed by one `EOR #$01`.

The bitwise lowering already emits `AND #$01`; the optional `EOR #$01` is the only added instruction.

### 1.3 Non-constant mask

The platform forwarding rule accepts a second operand that is:

- a compile-time constant, or
- a byte `load` from an empty-path place, whose selected ALU mode is a direct address.

The read must be the left operand. A constant left operand is already commuted by `lowerBitwise`. A
register or computed mask is not forwarded.

### 1.4 Single-use local elision under NMI

A shared semantic helper, `nmiRegisterOnlyLocals(function)`, returns the local bindings whose whole
life is one adjacent store/load pair:

```
- exactly one empty-path store and one empty-path load, same block, with only constants or
  conversions of constants between them;
- no place-address, no indexed access, no parameter/global/result-local;
- store value: single-use **forwardable** direct volatile byte read in the same block
  (CIA1 keeps its existing stable store path);
- load result: single-use, consumed by a byte store, a constant-address byte memory write,
  a byte &|^ with a constant/directly addressable peer, or a zero comparison.
```

`storage/inventory.ts` computes the helper once per NMI execution domain and records the binding keys
in `StorageInventory.elidedLocalBindings`. It omits the corresponding `local` request before
allocation. `machine/lower.ts` passes that exact set into `MachineLoweringInput`;
`machine/lower-function.ts` stores it, and `lower-operation.ts` skips the store and treats the load
value as register A. Lowering never recomputes the predicate, so the inventory and machine views
cannot disagree. A set member whose store/load shape does not match is a lowering failure, never a
silent global-label fallback.

The decision is made before allocation. No request is removed after SFA closure.

## 2. Why the rules are sound

| Obligation | Evidence |
|---|---|
| Read count and order | Every rule removes only retention or local-home instructions. The volatile `lda` stays at the same source point, once. |
| A at the consumer | A direct read leaves its byte in A; `AND #imm`, `AND addr`, `LSR`-free identity and a byte store consume A directly. Nothing that can clobber A is emitted between the producer and consumer. |
| Z ownership | Only the explicit direct-read set and the existing fresh-load/bitwise producers own Z. The read's single `lda` defines Z; `readOwnsZero` still requires a register-A byte value, so an address-only load cannot borrow it. |
| Boolean value | `x & 1` is exactly `0` or `1`; `!= 0` is identity and `== 0` is one `EOR #$01`. No flags are reused for the materialized path. |
| Non-constant mask | `AND addr` reads the operand from memory without loading A. The mask value is an empty-path byte place with a direct address. |
| Local elision | The local has no address, one store and one load with only constants/conversions between them, so no other local's store or load can interleave. Its value cannot be observed between them. The request is omitted before allocation by the single inventory decision, and lowering consumes that exact set. |
| Aliasing | No storage is created, moved or shared. The declared destination store is unchanged. |
| Source spans | Every retained instruction keeps its original span. Removed instructions belong to the same single-use value or the elided local. |
| ABI | NMI wrapper, stack frame and `RTI` are unchanged. |
| SFA closure | The local request never enters the inventory. No storage is added or removed after closure. |

## 3. Lowered sequences and costs

Wrapper for every sequence: `PHA` (1 byte/3 cycles), `CLD` (1/2), body, `PLA` (1/4), `RTI` (1/6):
4 bytes, 15 cycles, 4 stack bytes. X and Y are untouched, so the existing dead-register proof omits
their pushes.

### 3.1 Bare zero test

```asm
pha
cld
lda $dd0d
beq done
lda #$01
sta flag
done:
pla
rti
```

14 bytes. Store path 27 cycles; branch-taken skip path 22 cycles (plus the cost model's page-cross
allowance on the branch).

### 3.2 Boolean value, mask 1

```asm
pha
cld
lda $dd0d
and #$01
sta flag
pla
rti
```

12 bytes, 25 cycles. The `== 0` inverse inserts `eor #$01` before the store: 14 bytes, 27 cycles.

### 3.3 Non-constant mask

```asm
pha
cld
lda $dd0d
and maskValue
beq done
lda #$01
sta flag
done:
pla
rti
```

17 bytes with an absolute mask and flag. Store path 31 cycles; skip path 26 (plus the cost model's
page-cross allowance on the branch). A zero-page mask or flag reduces bytes and cycles by the selected
addressing mode.

### 3.4 Single-use local

```asm
pha
cld
lda $dd0d
sta sampleOut
pla
rti
```

10 bytes, 23 cycles, 4 stack bytes: byte-for-byte the issue #100 assignment target.

## 4. Restrictions that stay

| Case | Result | Reason |
|---|---|---|
| Boolean value from a mask other than `1` | `E10245` | The masked value is not already `0`/`1`; materializing it larger than the expert would be a parity defect |
| Several simultaneously retained samples | `E10245` | They genuinely need private homes; no register-only chain exists |
| Any real private home | `E10245` | The NMI proof is unchanged |
| Local with an address, indexed access, cross-block life or non-direct initializer | `E10245` | No elision proof exists for it |

The first two are recorded in `v4-nmi-retained-source-reads` with probes and a follow-up owner.

## 5. Blast radius

- Rules 1.1 and 1.2 change mainline output wherever the exact producer/consumer shapes appear.
- Rule 1.3 changes mainline output for a direct read masked by a directly addressable byte.
- Rule 1.4 is restricted to the NMI execution domain.

The root `yarn test` corpus owns the pinned optimizer artifacts and the ledger gate. Every affected
root suite must pass; a moved pinned artifact is a defect to explain, not a baseline to update
silently.
