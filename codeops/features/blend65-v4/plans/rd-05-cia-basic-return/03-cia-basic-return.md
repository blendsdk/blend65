# CIA1 BASIC Handback: RD-05

> **Document**: 03-cia-basic-return.md
> **Parent**: [Index](00-index.md)

## Contract and boundary

On the four cooperative `*-prg-kernal-*` profiles, the existing `c64.system.restoreIRQ()` remains a LIFO vector restore. If it pops the final compiler-owned `setIRQExclusive` route to the profile's stock KERNAL predecessor, it also performs a direct CIA1 stock Timer A handback before reenabling IRQ entry. This is a compile-time-selected sequence, not a runtime conditional, new source API, or device-state manager (AR-P2–AR-P3). The selected profile's stock BASIC/KERNAL entry precondition excludes resident software that installed a custom IRQ/CIA1 service before the PRG ran. The saved predecessor vector is still restored exactly; it is never replaced with a guessed ROM address. A normal `main` return still requires all high-level vector stacks empty. No automatic handback is placed in the later startup epilogue, where it would be too late for an earlier `restoreIRQ()` (AR-P3).

An inner restore only changes its vector when that inner route did not modify CIA1 configuration. If it did, restoring the outer handler would expose that handler to the wrong timer/mask state; E10278 remains the safe outcome. A final exclusive restore always performs the stock handback, including when source made no typed CIA1 write: exclusive execution skipped the old KERNAL handler, and no path-dependent runtime flag is needed. A chained route never acquires the exclusive handback behavior. Counter observation alone creates no exclusive lease; if source installs and finally restores an exclusive route, the handback occurs even when its CIA1 work consisted only of counter reads (AR-P2–AR-P3; PF-003). Known raw writes to CIA1 timer/control/ICR registers cannot be treated as a restorable typed timer lease unless their entire effect is proved; the current caller-owned opaque-address `poke()` boundary remains explicit. This plan does not grant CIA2/NMI or VIC-raster source ownership (AR-P1, AR-P3).

## Direct machine transaction

The selected 901227-03 [KERNAL init](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/init) and [PIOKEY path](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/irqfile) supply the stock Timer A reload and control/mask behavior. The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) supplies the ICR and latch effects. Under the existing `PHP; PHA; SEI` transaction, lower the handback inline in this order (AR-P2–AR-P3):

1. Disable all five CIA1 ICR mask sources with one `$1F` write; stop Timer A while retaining its TOD-input control bit, and stop Timer B in the pinned stock mode. This prevents a game timer from creating another pending event while the device changes.
2. Read `$DC0D` exactly once after the timers stop to consume old pending source bits. The normal-exit contract discards these ending-game events; it does not infer the unreadable prior mask from the read.
3. Program Timer A reload low then high from the selected profile fact: PAL `16421` (`$4025`), NTSC `17045` (`$4295`). No timer-latch read or generic `word` store is implied.
4. Restore the exact saved CINV low/high bytes while IRQ entry remains masked. Then enable only Timer A with one `$81` ICR write, start/load Timer A in the pinned KERNAL mode while preserving the TOD bit, and finally run the existing `PLA; PLP`. The restored CPU status, including I and D, decides when IRQs resume.

The final emitted sequence must be checked against the pinned ROM instruction order, not inferred solely from this prose. No whole-ROM `IOINIT` call is permitted because it would alter CIA2, SID, ports and mapping. The operation does not save an impossible prior mask/latch. Other compiler-owned port, VIC, stack, register and status restoration remains with the existing startup path (AR-P2–AR-P3, AR-P5).

## Compiler integration

Extend the focused [CIA ownership facts](../../../../../packages/compiler/src/semantic/cia-ownership-facts.ts) and [checker](../../../../../packages/compiler/src/semantic/cia-ownership.ts) from one global dirty bit to the minimum per-route mutation fact needed to distinguish safe inner pops from an outer handback. Keep call, branch, loop, selected-handler, and helper propagation. Return a set of source `restoreIRQ()` operations proved to be final exclusive handbacks; this is a compile-time fact only. At joins or call sites, a restore must have one safe route classification or produce E10278. Ordinary source branches and calls are legal; no runtime ownership flag is emitted (AR-P3).

Carry that fact through the existing [interrupt ownership](../../../../../packages/compiler/src/semantic/interrupt-ownership.ts) result and [platform lowering](../../../../../packages/compiler/src/machine/lower-platform.ts) callback to [direct interrupt lowering](../../../../../packages/compiler/src/machine/lower-c64-interrupt.ts). Keep the existing link storage and route selection; do not insert function storage after SFA closure. Put the PAL/NTSC reload value in the existing selected-profile facts rather than duplicating a magic immediate in unrelated passes. Current `restoreIRQ()` source syntax and frontend declarations are unchanged (AR-P3).

An implementation may split a focused module before the project's 500-line limit, but no new generalized pass, runtime registry, persistent shadow mask, or scheduler is justified. The optimizer must preserve every volatile CIA access in direction/count/order while remaining free to optimize nonvolatile computation around the transaction (AR-P3).

## Diagnostics and proof obligations

| Case | Required result | Authority |
|---|---|---|
| Nested route changed CIA1 before its vector-only pop | Source-linked E10278 before emission | AR-P3 |
| Route owner or stock-entry precondition not qualified, or raw high-level-vector write invalidated ownership | E10278; no speculative stock reset | AR-P1, AR-P3 |
| Returning `main` with an unreleased handler | Existing E10278 ownership failure | RD-05 R5.16; AR-P3 |
| Final exclusive route under qualified stock predecessor | Inline handback and exact saved-vector pop; no new source call | AR-P2–AR-P3 |

The review ledger must enumerate source/entry/ack/terminal owners, enabled peer sources, bank visibility, re-entry, SFA homes, saved link, hardware-stack peak, emitted bytes, separate existing-ROM bytes, and full path cycles. Existing default-chain and exclusive-CINV wrappers keep their previously qualified `PHP/CLD/PLP` or `CLD`/`$EA81`/`RTI` status rules; callback-only handlers remain non-`JSR` targets. The returned program's mainline exit cost is measured separately from IRQ body cost. Local equal-contract expert delta must be **0 bytes / 0 cycles or better**, with complete artifact/resource costs recorded. VICE 3.10 evidence is bounded `VICE-verified / hardware-unverified`; physical CIA-edge/revision QA stays with RD-10 (AR-P3–AR-P4).
