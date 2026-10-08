# C64 CIA2 timers and interrupt ownership

CIA2 is a C64 hardware device with two timers. Blend65 exposes its registers through
typed operations, not a timer scheduler or game framework. The compiler proves who
may change the device and generates direct hardware access.

This support applies to `c64-pal-prg-kernal-6581`, `c64-pal-prg-kernal-8580`,
`c64-ntsc-prg-kernal-6581` and `c64-ntsc-prg-kernal-8580`.

## Operations

Import the following operations from `c64.cia2`:

| Operation                                             | Contract                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `readTimerACounter()` / `readTimerBCounter()`         | Returns a `word`; reads low then high. A running timer can change between the reads, so this is not an atomic snapshot. No exclusive installation is needed. |
| `writeTimerALatch(value)` / `writeTimerBLatch(value)` | Writes a `word` reload value, low then high.                                                                                                                 |
| `configureTimerA(flags)` / `configureTimerB(flags)`   | Writes the supported control fields. `timerLoad` is a load strobe, not a persistent mode. Unrelated control bits are preserved.                              |
| `enableInterruptSources(mask)`                        | Enables supported timer sources. It does not clear pending events.                                                                                           |
| `disableInterruptSources(mask)`                       | Disables the selected sources. It does not clear pending events.                                                                                             |
| `readAndClearPendingSources()`                        | Returns one `byte` from one consuming read. The read clears **all** latched sources, not just the bits tested afterward.                                     |

Timer modes and source bits are shared CIA constants currently exported from
`c64.cia1`: `timerStart`, `timerOneShot`, `timerLoad`, `timerBCountAUnderflows`,
`sourceTimerA`, `sourceTimerB`, `sourceTodAlarm`, `sourceSerial`, `sourceFlag`,
`sourceAll` and `sourceIrq`. Importing these constants does not access CIA1.
Timer A accepts `timerStart | timerOneShot | timerLoad`; timer B also accepts
`timerBCountAUnderflows`. Enabling sources supports Timer A and Timer B;
disabling may use `sourceAll`. Other constant control/source choices are rejected,
not silently enabled. A dynamic argument does not prove a known device state.

## Owning the device

Use `setNMIExclusive(&handler)` from `c64.system` to install the exclusive handler,
and balance it with `restoreNMI()` on every returning path. NMI means a
non-maskable interrupt: disabling ordinary IRQ interrupts does not block it.
Only a proved exclusive owner may mutate CIA2 or consume its pending sources.
Ordinary helper calls can perform these operations when their actual caller owns
the device. A chained handler cannot consume the downstream owner's events.

The installation is not a saved copy of the old device configuration. Its
interrupt mask cannot be read back, and a timer counter is not its reload latch.
Before programming the device, use `disableInterruptSources(sourceAll)` to
establish a known mask. Decide explicitly whether to discard old pending events
with `readAndClearPendingSources()`.

After establishing ownership and a known mask, program a reload value, enable
the needed sources and start the timer with the named control bits. Balance the
installation after the application's work; the compiler does not insert a wait
or event loop. If several sources are enabled,
read once and handle every relevant returned bit using ordinary Blend65 code;
simultaneous events can set several bits. The compiler does not supply a dispatcher
or guarantee that application branches handle every event.

## Release and safety boundaries

Balanced nested installations are supported. A clean inner release restores its
exact predecessor. An inner release after changing device configuration requires
proof of the real prior state; the compiler does not guess unreadable values.
For the proved final handback to stock firmware, `restoreNMI()` restores the vector
first, disables all sources, stops both timers and performs one consuming read.
Source-written reload latches remain programmed, but timers are stopped and masked.

Programs using generated NMI installation require the qualified stock KERNAL
901227-03 entry at program start, without another resident vector owner. The
compiler does not probe or repair an arbitrary RS-232, cartridge or resident setup.
Programs with no generated NMI installation gain no such entry precondition.

The current cooperative NMI contract accepts only generated paths proved reentrant
without invocation-private RAM or zero-page storage. This is a final storage proof,
not a syntax ban on locals or helpers. The compiler reports E10245 when that proof
fails, and E10278 when device ownership or handback state is unproved. Ordinary
assignment of the consuming read to a global, and a simple conditional after that
read, currently hit E10245 in the generated NMI route. The compiler needs private
scratch where an expert implementation would not. These are implementation
limitations to remove, not language restrictions or recommended source workarounds;
[issue #100](https://github.com/blendsdk/blend65/issues/100) owns their repair.

Qualification is **VICE-verified / hardware-unverified**. Unrestricted external
nesting and aggregate stack capacity, retained-firmware completion, and hard timing
deadlines are not proved. The timer operations do not touch the ports or their
direction registers. Keyboard sharing and takeover profiles are separate
unfinished work.

## Startup bank and normal return

The four cooperative profiles select VIC bank 0 by making CIA2's two bank-select
pins inputs with pull-ups. Startup saves DDRA, clears only its low two bits and
restores the saved byte on normal return. It never reads or writes PRA, whose
hidden output latch cannot be recovered from physical pin readback. The former
STOP/RESTORE then SYS startup-latch defect is repaired in the qualified VICE cases,
including changed external serial-bus inputs. This is not universal silicon or
whole-program startup proof.

Raw register writes remain legal and follow those input/output directions. A PRA
write alone does not select another VIC bank while the bank bits are inputs.
Deliberate raw bank switching must establish its required output directions;
a future typed bank operation must own that detail. No general bank-switching API
is supplied by this repair. Zero startup PRA accesses preserve the latch against
startup's own operations, not deliberate source or firmware PRA writes.

Stock STOP/RESTORE warm-start is a terminal firmware path, not a normal application
return. Re-entry through BASIC SYS captures the new machine state; startup does
not try to restore a program abandoned by that terminal path.

See [platform libraries](platform-libraries.md) for the library boundary and
[CIA2 qualification](../codeops/features/blend65-v4/plans/rd-05-cia2-ownership/08-closeout.md)
for the timer/NMI models, artifacts, resource costs and remaining obligations.
The [startup repair evidence](../codeops/features/blend65-v4/plans/cia2-startup-preservation/99-execution-plan.md)
records the separate bank/latch transaction, exact return cases and its limits.
