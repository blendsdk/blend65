# Technical specification: CIA2 proof and lowering

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P2–AR-P4; frozen Chapters 06/15 and Appendix C64 §9.2
> **Risk tags**: semantics, sfa-abi, target-platform, emitted-code, concurrency, host-perf
> **Domain lenses**: compiler/language; concurrent interrupt execution

## Existing public surface

Use `c64.system.setNMIExclusive(&handler)` and `restoreNMI()`, and the existing
`c64.cia2.readTimerACounter()`/B → `word`, `writeTimerALatch(word)`/B → `void`,
`configureTimerA(byte)`/B → `void`, `enableInterruptSources(byte)`/
`disableInterruptSources(byte)` → `void`, and
`readAndClearPendingSources()` → `byte`. Reuse the existing named CIA bit facts.
No operation inventory or public signature changes.

## Source ownership and finite facts

Extend the existing vector/context relation with optional focused CIA2 facts:
exact active lease/predecessor identity, per-owner configuration mutation,
proved mask initialization/possible source bits, and valid idle-stock handback
provenance. Key per-owner facts by the existing finite physical binding/entry
identities, never by an external nesting-depth stack. Equal re-entrant capture
must close without accumulating new device frames. Include these facts in state equality. Preserve separate alternatives
at joins and ordinary direct/finite-target calls. The existing worklist owns
convergence; add no second call/CFG solver or iteration budget.

Source memory writes use the existing address facts, including word boundaries,
CIA mirrors and `$02A1`. An unknown address cannot establish valid ownership.
Known raw timer/mask/control or firmware-enable changes must not be mistaken for
reconstructible typed state. Keep raw access expressible at its existing
unproved boundary; invalidate only the high-level proof actually affected.

Counter observations remain available without a lease. Typed CIA2 mutations and
consuming reads require a proved exclusive device owner, including ordinary
helpers and actual selected interrupt contexts. A chained callback cannot steal
the downstream exclusive/stock consumer's ICR. Walk the existing immutable
continuation to distinguish a stock chain from a chain forwarding to an existing
exclusive owner. Charge device mutations to their actual owner, not every older
saved link. Source code owns interpretation of the returned bitset; no general
branch-completeness checker or event dispatcher is added.

Preserve existing flag bounds: A `$19`, B `$59`, enable `$03`, disable `$1F`.
Constant unsupported bits produce source-linked E10278; dynamic flags retain
their existing bounded lowering. A full disable proves the unreadable mask;
partial/unknown clears do not invent it. Device masks do not prove NMI exclusion.

Clean nested releases restore the exact predecessor without idle shutdown.
Configuration-changing inner/nonstock releases require the real prior device
state to remain proved; unreadable latch/mask values are not guessed. Final
typed release is classified only for the exact qualified stock predecessor, no
surviving old device writer and intact idle provenance. Classify each restore in
its existing emitted function/context identity. An ordinary release helper may
perform a clean inner pop and final handback in its already-distinct specialized
bodies. Equal depth alone never proves equal ownership: sequential chained and
typed-exclusive leases may use the same release helper at depth one. Where
actual facts prove distinct release policies, distinguish them with a finite
proved release variant in the existing static specialization owner. Do not
reject a legal helper because the old emission key lacks that fact. Genuinely
unresolved ownership still reports E10278. Preserve the existing protected
post-pop observers and LIFO rules.

Remove the old CIA2 blanket guard only where this complete context proof takes
over. Programs with no exclusive candidate retain their current unowned errors;
ordinary CIA1 and no-NMI paths keep their current proof and costs.

## Producer-to-consumer transport

Record proved final CIA2 restores by source operation and existing emitted
context identity in the interrupt analysis. Carry those same identities to the
current platform binding and direct vector lowerer; never flatten them to a
source-operation-only set. A release variant records the proved policy at every
affected restore and call edge, not a single function-wide Boolean. Propagate
selection through ordinary wrapper helpers and finite call targets; caller and
callee must select the same body. Canonicalize identical finite variants and
reuse the current worklist and termination discipline. No external-depth stack,
second solver or general specialization pass is added. Branch/CFG alternatives
whose actual ownership remains unproved fail; the old emission-key merger is
not itself that proof failure. Preserve source identity, link requests, existing
domain/ABI homes and final closure; no variant creates late private storage.
The exact stock predecessor is `$FE47`. The flag is an
internal compile-time fact, not a public schema or runtime token. Clear it on
diagnostic failure; no consumer may invent it from source spelling/depth alone.

All cooperative NMI candidates still pass final SFA/private-storage closure.
Parameters, locals, return destinations, staging, spills and helper scratch are
included. Installation-owned words remain the existing narrowly proved exception;
ordinary helpers remain JSR/RTS. Callback identity and raw retained bodies remain
distinct. No private home is invented after closure or disguised as shared data.

## Direct output

Reuse the CIA lowering at the selected CIA2 base: counter low/high reads, latch
low/high writes, one LOAD control strobe, preserved A/B fields and direct mask
writes. One read-clear operation emits one absolute LDA, with no RMW or mask
reconstruction. Extend only the existing adjacent byte-to-fixed-store forwarding
for this result; no generic register allocator or cross-block optimizer is planned.

Use the existing selected NMI wrapper machinery for both cooperative variants.
Preserve every clobbered A/X/Y and establish binary arithmetic for nonempty
bodies. Exclusive exit uses RTI and no extra PHP/PLP; chain preservation is
unchanged. The full exclusive save wrapper remains the Appendix's 12-byte,
37-cycle reference; any smaller selected form needs independent exact proof.
Publish and restore only the high vector byte after coherent two-byte capture,
matching-$47 placement, complete visible entries and immutable-link proof.

## Final CIA2 shutdown

AR-P4 owns the sequence and machine-entry preconditions. The general preserving
form has 38 generated bytes and 56 nominal NMOS CPU cycles, excluding enclosing
call/return, intervening NMI, DMA and placement. It uses two temporary hardware
stack bytes and no RAM/ZP scratch. Its ordered volatile effects are:

`write $0319 → write $DD0D($1F) → read/write $DD0E → read/write $DD0F → read $DD0D`.

For this proved final stock handback, use `LDA #$FE; STA $0319`, not an absolute
load of the immutable saved high byte. This saves one byte and two cycles without
changing a volatile effect. Nonfinal restores still use their captured predecessor.

Control writes are `(CRA & $C6) | $08` and `(CRB & $86) | $08`; no LOAD, latch,
port, DDR, TOD or serial-data access is inserted. Source-written reload latches
remain programmed but stopped/masked. The ending epoch may be drained by stock
entries after publication as well; only the generated read count is exactly one.
IRQ is masked for this transaction and caller A/P is restored. SEI does not mask
NMI. No early quiesce permits an old application handler to undo shutdown.

## Errors, reports and evidence

E10278 identifies the affected NMI/device operation and missing ownership fact.
E10245 retains its frozen wording and actual selected-private/reentrancy witness.
All failed check/build paths retain no-generation/immutable-publication behavior.

Keep existing artifact fields, exact byte/resource reconciliation and scoped
per-entry stack accounting. CPU NMI entry contributes 7 cycles/3 stack bytes;
the existing KERNAL stub contributes 7 cycles/4 ROM bytes, not output bytes.
External aggregate stack, firmware completion and finite deadlines remain
unproved, including no-hook controls. VICE claims are bounded to pinned models;
physical CIA/RESTORE/cartridge QA remains RD-10.

Record any surviving ordinary-lowering parity gap against its existing RD-08
owner; no generic optimization work or production-grade output waiver is added.
