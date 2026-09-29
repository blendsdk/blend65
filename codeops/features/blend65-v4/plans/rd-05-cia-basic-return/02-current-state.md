# Current State: CIA1 Return to BASIC

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing implementation

| Boundary | Current fact | Relevant file |
|---|---|---|
| Normative return | Cooperative `main` balances handlers and restores exact captured state before BASIC `RTS`; this cannot literally include arbitrary CIA1 write-only state. | [C64 appendix](../../../../../spec/appendix-c64.md) |
| Existing CIA1 guard | Typed CIA1 writes and known raw register writes set one `dirty` fact; dirty `restoreIRQ()` and BASIC return report E10278. | [CIA ownership](../../../../../packages/compiler/src/semantic/cia-ownership.ts), [facts](../../../../../packages/compiler/src/semantic/cia-ownership-facts.ts) |
| Vector release | `restoreIRQ()` already saves status/A, masks IRQ, restores the two-byte saved CINV predecessor, then restores A/status. | [C64 interrupt lowering](../../../../../packages/compiler/src/machine/lower-c64-interrupt.ts) |
| Machine handoff | Semantic interrupt-ownership results reach lowering through the whole-program record and `interruptBinding`; no CIA1 handback classification is currently carried. | [ownership](../../../../../packages/compiler/src/semantic/interrupt-ownership.ts), [platform lowering](../../../../../packages/compiler/src/machine/lower-platform.ts) |
| BASIC epilogue | Startup restores compiler-owned port/CIA2/VIC state and returns after `main`; it does not restore CIA1. | [startup](../../../../../packages/compiler/src/layout/startup.ts) |
| Profile facts | Four exact cooperative profile rows distinguish PAL/NTSC and 6581/8580 but do not yet carry the pinned KERNAL Timer A reload value. | [profiles](../../../../../packages/compiler/src/profile/c64-kernal.ts) |

## Decisive hardware evidence

The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) defines the timer reload latch and interrupt mask as write-only; their read addresses expose the running counter and consuming pending data respectively. The pinned [901227-03 KERNAL initialization](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/init) uses Timer A reload `16421` for PAL and `17045` for NTSC. Its complete `IOINIT` also changes CIA2, SID, ports, and CPU mapping, so reusing it as an exit routine would violate this slice's preservation boundary. The KERNAL [PIOKEY path](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/irqfile) enables only Timer A and starts it while retaining the TOD control bit. These facts justify a direct, focused handback rather than a device snapshot or a ROM reset (AR-P2–AR-P3).

## Gaps and risks

| Gap/risk | Smallest planned resolution |
|---|---|
| A single global dirty bit cannot distinguish a safe nested vector-only pop from the final CIA1 lease release. | Track the relevant dirty epoch at route depth and mark only a proved final handback (AR-P3). |
| Machine lowering cannot tell which restore needs CIA1 work. | Carry one compile-time handback set through the existing ownership result/support callback; emit no runtime tag (AR-P3). |
| Enabling Timer A before the saved vector is restored could invoke a mismatched predecessor. | Keep IRQ masked; clear game sources, restore exact CINV, enable/start the stock Timer A source, then restore status (AR-P3). |
| Changed Specification 4 identity would invalidate a silently unchanged expert release. | Run the existing targeted version/qualification/activation procedure before compiler implementation (AR-P5). |

No new dependency, UI, persistent data format, user input path, or external service is involved. The prior CIA plan and [closeout](../rd-05-cia-interrupts/08-closeout.md) remain the verified starting checkpoint, not authority for the corrected product contract.
