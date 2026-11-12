# Ambiguity Register — NMI Register-Only Source Reads

> **Status**: Closed for implementation; remaining restrictions recorded
> **Updated**: 2026-11-12

The frozen Specification 4.0, issue #100 and the existing NMI private-home proof are authority. This
register records implementation-shape decisions and the restrictions that remain.

## AR-N1 — Delivered source forms

**Decision:** Deliver exactly the two normal forms in issue #100 plus the already-working assignment
regression:

1. `pendingSources = readAndClearPendingSources();`
2. `if ((readAndClearPendingSources() & sourceTimerA) != 0) { finished = true; }`

A boolean value produced from the same bit test is **not** delivered. Making it build would emit eight
bytes more than the expert sequence, which the Prime Directive forbids shipping as a capability; it
stays a recorded restriction with a follow-up owner. The reversed operand order (`mask & read()`) is
verified because the bitwise lowering already commutes it.

**Rationale:** the issue's two witnesses are the acceptance bar. Extending scope to every comparison
shape would require a flag-ownership model that this slice does not need.

**Rejected:** implementing general local-storage elision or a new value-availability model in this
slice.

## AR-N2 — Forwarding rule and its proof

**Decision:** Extend `selectRegisterForwarding` with one rule. A byte result of a `call` or `platform`
operation is forwarded when all of the following hold in the same block:

- the result has exactly one use (`singleUseValues`);
- the next machine operation is a byte `&`, `|` or `^` whose left operand is that result;
- the right operand is a compile-time constant;
- the result type is one byte.

The rule grants A availability only. It never claims that the call or platform operation owns Z, and
it does not remove the read, its order, or its volatile effect.

**Rationale:** `lowerBitwise` loads the left operand into A and then applies the immediate ALU
operation, so a forwarded left costs no instruction and cannot clobber A before use. A constant right
operand is addressable without a load. The existing rule set already forwards loads and bitwise
results into the same consumer shape, so this closes the missing producer class rather than adding a
new mechanism.

**Rejected:** forwarding the call/platform result into a comparison directly (it does not own Z, and
the flag path would be unsound); forwarding into an arbitrary bitwise with a non-constant right
operand (the operand load may clobber A); moving the value into a shared global shadow (changes
program-visible state and alias behavior).

## AR-N3 — Private-home proof stays strict

**Decision:** `nmiPrivateStorageRoute` is unchanged. Any request that is not the exact installation
word still fails the route. This plan removes requests rather than exempting them.

**Rationale:** NMI is non-self-masking and externally unbounded; the frozen text withholds the
cooperative unbounded exception from takeover and permits the cooperative route only with a
private-home-free proof.

**Rejected:** allow-listing `temporary` requests under NMI; allowing one private byte "because it is
small"; relaxing the proof for register-adjacent values.

## AR-N4 — Remaining measured restrictions

**Decision:** Two ordinary forms still fail after this slice and are recorded in the expressiveness
ledger row `v4-nmi-retained-source-reads` with probes:

- a bare `if (readAndClearPendingSources() != 0)` — the platform read does not carry an explicit
  flag-ownership fact, so reusing Z would be unproved and the compiler still retains the value;
- a single-use local byte in an interrupt function — locals always receive an SFA home, so an NMI
  handler that declares one needs private storage. This is general local allocation, not an
  NMI-specific rule;
- a mask held in a non-constant operand, where the ALU operand load could clobber a forwarded A;
- a Boolean value assigned from the bit test, because its only current lowering is eight bytes worse
  than the expert sequence and shipping it would be a parity defect.

Several simultaneously retained samples stay in the same row, as before.

**Rationale:** both restrictions are real and user-hittable; hiding them would be worse than recording
them. Fixing either needs a separate bounded slice (producer flag facts, or local elision), not a
weaker NMI proof.

**Rejected:** silently dropping the row; claiming the whole row retired while these forms fail.

## AR-N4a — Ledger edit authority

**Decision:** Issue #100 explicitly instructs the update ("Add the exact user-visible restriction to
the existing expressiveness ledger under its normal scope/oracle gate"). That instruction authorizes
editing exactly two things: the `v4-nmi-retained-source-reads` row text in
`test/rd04/expressiveness-ledger.json`, and the `sources` of its existing probe entry in
`test/rd04/expressiveness-ledger.spec.test.ts`. The row stays `deferred` with the same diagnostic, and
the gate's own rules are not changed.

**Rationale:** the gate remains a real oracle; only the recorded restriction text and its probe
coverage are corrected to match measured behavior.

**Rejected:** changing the gate logic, adding an unprobed row, or retiring the row while probes fail.

## AR-N4b — Residual owner

**Decision:** Before issue #100 is closed, the residual forms move to a new follow-up issue; the ledger
row's `owner` points at it. A closed issue must not own live work.

**Rationale:** the repository's deferral-expiry rule forbids leaving deferred work owned by a closed
owner.

**Rejected:** keeping `issue #100` as the owner after closing it.

## AR-N5 — No frozen-specification change

**Decision:** No `spec/` file changes. The delivered behavior is an implementation of existing
language and platform rules: an ordinary assignment and an ordinary bit condition.

**Rationale:** `spec/` is frozen (decision D3); the defect is compiler-invented storage, not a
language rule.

**Rejected:** adding a source limitation or a new diagnostic to the frozen text.

## AR-N6 — Verification authority

**Decision:** VICE 3.10 `x64sc` is the runtime oracle, with the pinned executable and 901227-03 ROM
hashes already used by the profile matrix. The result is `VICE-verified / hardware-unverified`.

**Rationale:** no physical C64, drive or SID is available; physical qualification stays `V4-HW-1`.

**Rejected:** claiming physical CIA2 timing behavior from the emulator run.
