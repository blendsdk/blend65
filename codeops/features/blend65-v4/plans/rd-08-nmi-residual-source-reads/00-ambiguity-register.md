# Ambiguity Register — NMI Residual Source Reads

> **Status**: Closed for implementation; remaining restrictions recorded
> **Updated**: 2026-11-12

The frozen Specification 4.0, issue #147 and the existing NMI private-home proof are authority. This
register records implementation-shape decisions and the restrictions that remain.

## AR-R1 — Delivered source forms

**Decision:** Deliver these forms:

1. `if (readAndClearPendingSources() != 0) { ... }`;
2. `flag = ((readAndClearPendingSources() & 1) != 0);` and the `== 0` inverse, which adds one
   `EOR #$01` after the `AND`;
3. `if ((readAndClearPendingSources() & maskGlobal) != 0) { ... }` with a directly addressable mask;
4. `let sample: byte = readAndClearPendingSources();` followed in the same block by a byte store, a
   constant-address byte memory write, a byte `&`/`|`/`^` with a constant or addressable peer, or a
   zero comparison.

The `& 1` Boolean form is delivered only for the constant mask `1`, because that mask makes the value
identity exact and matches the expert `AND #1; STA flag`. The `== 0` inverse is `AND #1; EOR #1; STA`,
which still beats the expert branch form.

**Rationale:** these are the four forms in issue #147's table plus the symmetric inverse and the
adjacent local consumers that fall out of the same A-live proof. Extending the Boolean identity to
other masks needs a different materialization and a separate cost argument.

**Rejected:** delivering a materialized Boolean that is larger than the expert sequence; treating the
multi-retained negative as delivered; a local consumer that is not adjacent.

## AR-R2 — Z ownership for a direct read

**Decision:** A single-use byte result from a **direct volatile byte read** capability may own Z for an
adjacent `== 0`/`!= 0` comparison whose result is the block branch condition. The capability set is
explicit: CIA1/CIA2 `readAndClearPendingSources`, `readJoystick1/2`, and the two VIC collision reads.
Every member lowers to exactly one `lda absolute` with a volatile read effect.

`readOwnsZero` keeps its existing register-A/byte/fresh-value conjuncts and adds
`zeroFlagValues.has(operation.left)` as an **additional** requirement. Existing load, memory-read and
byte-bitwise producers are added to the same set by the existing zero-test rule, so their behavior is
unchanged.

**Rationale:** A-only forwarding is not flag ownership. The existing rule implicitly relied on the
producer's fresh `lda`; making the set explicit prevents a future platform operation with a computed
or multi-instruction result from inheriting an unproved Z. Dropping the register-A conjunct would let
an address-only byte load reach a branch with no `lda` at all.

**Rejected:** inferring Z ownership from the result type alone; allowing any `platform` operation;
adding a runtime flag capture; removing the register-A conjunct.

## AR-R3 — Boolean identity

**Decision:** `(x & 1) != 0` lowers to the value of `x & 1` itself, with no comparison instructions.
The mask must be the compile-time constant `1`. The value is then consumed by a byte store, a byte
memory write, or a Boolean return.

**Rationale:** `x & 1` is exactly `0` or `1`, so the comparison is identity. The expert sequence is
`AND #1; STA flag`; a materialized comparison adds `CMP #1; LDA #0; ADC #0` and is a parity defect.

**Rejected:** identity for masks other than `1` (the value is `0` or `mask`, not `0` or `1`); a
branch-based materialization that changes block layout.

## AR-R4 — Non-constant mask

**Decision:** A direct byte read stays in A when the other operand of an adjacent `&`, `|` or `^` is
either a compile-time constant or a byte load from an empty-path place (global, local or parameter)
that the selected ALU instruction can address directly. The read must be the left operand; a
constant left operand is already commuted by the existing bitwise lowering.

**Rationale:** `AND addr` reads the mask without loading A, so the sample survives. A register or
computed mask would need an A load and stays unforwarded.

**Rejected:** forwarding into a non-constant mask held in a register or produced by a call; extending
the bitwise commute to arbitrary values.

## AR-R5 — Single-use local elision under NMI

**Decision:** In an NMI execution domain, a byte local is eliminated before SFA closure when all of
the following hold:

- it is not a parameter, global, or returned-local destination;
- it has exactly one empty-path store and one empty-path load, in the same block, with only
  compile-time constants or conversions of constants between them;
- it has no `place-address` access and no other access;
- the store value is a single-use **forwardable** direct volatile byte read in the same block
  (CIA1 keeps its existing stable store path and is not elided);
- the load result is single-use and its only consumer is a byte store, a constant-address byte memory
  write, a byte `&`/`|`/`^` with a constant or directly addressable peer, or a zero comparison.

**One decision owner.** `inventoryStorage` computes the helper result and records the elided binding
keys in `StorageInventory.elidedLocalBindings`. Machine lowering reads that exact set from
`MachineLoweringInput` and does not recompute the predicate. The inventory omits the request; the
lowering skips the store and keeps the load value in A. A binding in the set that does not match the
expected store/load shape is a lowering failure, never a silent global-label fallback.

**Rationale:** the NMI proof rejects private homes. A temporary whose entire life is one adjacent
store/load pair has no observable home; eliminating it is the exact "register-only single-use local"
the issue asks for. Deciding once before inventory keeps SFA closure authoritative and avoids two
block views disagreeing.

**Rejected:** post-closure request removal; recomputing the predicate independently in lowering;
general local elision in mainline; eliding a local whose address is taken, that crosses a block or
call, or whose initializer is not a direct read.

## AR-R5b — Issue #100 oracle retirement

**Decision:** Four negative cases in `test/rd08/nmi-source-read.spec.test.ts` pin the forms this plan
delivers: bare zero, non-constant mask, Boolean mask one, and single-use local. They were recorded as
remaining restrictions explicitly owned by issue #147. Closing #147 requires retiring exactly those
four cases and keeping the five-retained-sample negative. The edit is executed by the independent
spec author, not the implementation session, and is recorded in the execution plan.

**Rationale:** the spec oracle is immutable while its requirement stands; the requirement changes
only because #147 is the named owner of the restriction. No other oracle assertion is relaxed.

**Rejected:** leaving the old negatives red; editing the old oracle from the implementation session.

## AR-R6 — Remaining restrictions

**Decision:** Two forms remain `E10245` and are recorded in `v4-nmi-retained-source-reads` with probes:

- a Boolean value from a bit test whose constant mask is not `1` (the value is not already `0`/`1`);
- several simultaneously retained sampled bytes, which genuinely need a private home and must stay a
  real negative.

The row is owned by a follow-up issue opened before #147 closes. The row's probe entry keeps the
five-sample source and replaces the delivered mask-one source with a constant-mask-two source; the
bare-zero, non-constant-mask and local probes are removed because those forms now build.

**Rationale:** both are real and user-hittable. Hiding them or relaxing the NMI proof would be worse.
The multi-sample case is a storage requirement, not compiler-invented scratch; the Boolean case needs
a separate materialization and cost proof.

**Rejected:** retiring the row while either probe still fails; keeping #147 as the owner after
closure; claiming the multi-sample negative is supported.

## AR-R7 — Ledger edit authority

**Decision:** The repository's expressiveness-ledger gate requires every deferred row to stay tied to
a failing probe and a live owner, and every retired row to build. Issue #147 changes the measured
behavior, so the row and its probe entry must be narrowed as part of the closeout. The probe edit is
routed through the independent spec author, and the row owner moves to a new follow-up issue before
the gate runs. The gate logic and the frozen specification are not changed.

**Rationale:** the gate remains a real oracle; only the recorded restriction text and probe coverage
are corrected to measured behavior. Issue #147 records the work; it does not itself grant a general
oracle-edit license.

**Rejected:** changing the gate's rules; adding an unprobed row; retiring a row whose probes fail;
claiming issue #147 authorizes arbitrary ledger edits.

## AR-R8 — No frozen-specification change

**Decision:** No `spec/` file changes. The delivered behavior implements existing language and
platform rules.

**Rationale:** `spec/` is frozen (decision D3); the defect is compiler-invented storage, not a
language rule.

**Rejected:** adding a source limitation or a new diagnostic to the frozen text.

## AR-R9 — Verification authority

**Decision:** VICE 3.10 `x64sc` is the runtime oracle, with the pinned executable and ROM hashes
already used by the profile matrix. The result is `VICE-verified / hardware-unverified`.

**Rationale:** no physical C64, drive or SID is available; physical qualification stays `V4-HW-1`.

**Rejected:** claiming physical CIA2 timing behavior from the emulator run.
