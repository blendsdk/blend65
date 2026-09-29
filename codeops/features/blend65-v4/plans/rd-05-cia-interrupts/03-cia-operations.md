# CIA Operations: RD-05 Timer and Interrupt Slice

> **Document**: 03-cia-operations.md
> **Parent**: [Index](00-index.md)
> **Status**: Planned contract, not an implementation or runtime result

## Source API

The four selected cooperative profiles expose these typed operations. They are direct platform operations, not calls into a runtime (AR-P1, AR-P5–AR-P7).

| Namespace | Operation | Result | Availability |
|---|---|---|---|
| `c64.cia1`, `c64.cia2` | `readTimerACounter()` / `readTimerBCounter()` | `word` | Non-consuming observation on either CIA. |
| `c64.cia1`, `c64.cia2` | `writeTimerALatch(value: word)` / `writeTimerBLatch(value: word)` | `void` | CIA1 under exclusive IRQ ownership; CIA2 reports E10278. |
| `c64.cia1`, `c64.cia2` | `configureTimerA(flags: byte)` / `configureTimerB(flags: byte)` | `void` | CIA1 under exclusive IRQ ownership; CIA2 reports E10278. |
| `c64.cia1`, `c64.cia2` | `enableInterruptSources(mask: byte)` / `disableInterruptSources(mask: byte)` | `void` | CIA1 under exclusive IRQ ownership; CIA2 reports E10278. |
| `c64.cia1`, `c64.cia2` | `readAndClearPendingSources()` | `byte` | CIA1 under exclusive IRQ ownership; CIA2 reports E10278. |

`c64.cia1` also publishes immutable `byte` constants (AR-P5, AR-P7):

| Constant | Value | Use |
|---|---:|---|
| `timerStart`, `timerOneShot`, `timerLoad` | `$01`, `$08`, `$10` | Timer configuration; `timerLoad` is a write strobe. |
| `timerBCountAUnderflows` | `$40` | Timer B clock selection; omission selects PHI2. |
| `sourceTimerA`, `sourceTimerB`, `sourceTodAlarm`, `sourceSerial`, `sourceFlag` | `$01`, `$02`, `$04`, `$08`, `$10` | Returned pending bits; timer A/B are the only source-enable bits this slice can prove. |
| `sourceAll`, `sourceIrq` | `$1F`, `$80` | All five mask bits for disable; read-result interrupt-request status. `sourceIrq` is not an enable-mask bit. |

The control methods describe the full timer-owned mode on each call: an omitted mode bit is cleared. `configureTimerA(0)` stops A and selects continuous PHI2 counting; `configureTimerB(0)` does the same for B. Timer A accepts input bits `$19`; B accepts `$59`. Out-of-set constant bits are a source-linked E10278 ownership error. A dynamic argument is masked to the safe set before the write. CNT-dependent modes and non-timer enables are not silently made available by a cast or a dynamic byte (AR-P6–AR-P7).

## Device Effects

The selected machine facts own CIA1 base `$DC00` and CIA2 base `$DD00`. Timer A low/high are offsets `$04/$05`, B `$06/$07`, ICR `$0D`, and control A/B `$0E/$0F`. Every access is volatile and stays in source order (RD-05 R5.11–R5.13, AR-P3–AR-P6).

| Operation | Exact device contract |
|---|---|
| Counter read | Read low then high and return the observed pair as a `word`. A running timer may decrement between reads; this is not an atomic snapshot. No ICR read or timer write occurs. |
| Latch write | Write low then high. When stopped, the high-byte write loads the counter from the latch; while running it updates the reload latch, not the present count. `LOAD` in a later control write forces transfer at that point. |
| `configureTimerA` | One CRA read and one CRA write: `(old & $C6) | (flags & $19)`. Preserve PB6 output, serial direction and TOD clock bits; clear unsupported CNT clock selection. A written `timerLoad` strobes once and does not persist on readback. Changing Timer A's period/mode also changes an active serial-output clock; preserving the direction bit does not preserve serial timing. |
| `configureTimerB` | One CRB read and one CRB write: `(old & $86) | (flags & $59)`. Preserve PB7 output and TOD/alarm selection; clear unsupported CNT-dependent clock choice. `$40` selects A-underflow clock. |
| Enable sources | One ICR write with bit 7 set and selected timer A/B bits; no ICR read. Constant masks outside `$03` fail E10278; dynamic masks are bounded to `$03`. |
| Disable sources | One ICR write with bit 7 clear and selected bits `$00..$1F`; no ICR read. `sourceAll` clears all five enables. Constant masks outside `$1F` fail E10278; dynamic masks are bounded to `$1F`. |
| Read and clear | Exactly one ICR read, returning all five latched source bits and bit 7. It clears all returned pending bits, even masked ones. Source code acts on the returned byte; the compiler neither rereads nor invents a branch-service checker. |

The ICR read is **not** a mask read. No optimizer may duplicate, eliminate, merge, hoist or sink volatile CIA accesses across their ordered effects. Revision-sensitive edge timing requires later physical QA; the planned VICE runs prove the configured emulator only (RD-05 R5.20, AR-P3).

A control-register read/modify/write is not atomic against an IRQ writer of the same register. One writer per configured timer is a **precondition of the qualified programs**, not a compiler-enforced restriction on every source program or a concurrent-write guarantee; RD-05 R5.18 retains shared-state warnings and explicit critical-section work. Timer A reprogramming also requires its other consumers, including active serial output, to be quiescent or explicitly owned. This slice does not prove that external-device condition or silently protect it with a runtime manager. No hidden interrupt masking is added (AR-P1, AR-P6, PF-004).

## Ownership and Integration

Reuse the current selected-profile declarations, target-neutral `PlatformOperation`, vector ownership proof, direct C64 lowering and SFA closure. A focused CIA check over reachable source operations tracks the active top IRQ route and the five possible CIA1 enable bits through calls, branches and loops. It accepts state-changing CIA1 operations and a consuming CIA1 ICR read only while the active route is `setIRQExclusive`; balanced paths must agree on the owner. No new generalized dataflow framework or runtime mask shadow is introduced (AR-P3–AR-P4, AR-P7).

Immediately after an exclusive install, the current CIA1 mask cannot be read back: all five sources must be considered potentially enabled. The qualified source-visible handoff saves status with `asm_php()`, disables maskable IRQs with `asm_sei()`, installs the exclusive handler, calls `disableInterruptSources(sourceAll)`, reads pending sources once with `readAndClearPendingSources()`, explicitly decides what to do with that returned status, and restores status with `asm_plp()` on every reachable path. This prevents the old Timer A IRQ from entering an unprepared new handler between vector installation and mask clear. The setup uses existing balanced intrinsics, not hidden masking or a new API. A program that instead permits IRQs during installation must already have a handler safe for every potentially enabled source; that alternative is not qualified by this slice (PF-001).

The full disable establishes a known mask before timer sources are selectively enabled. A raw write whose address is statically known to be CIA1 ICR invalidates that mask; an ICR read cannot reconstruct it. A runtime-address `poke()` remains legal and volatile, including ordinary game-memory writes: an unresolved address is a caller-owned hardware escape, not a proved non-alias or a reason to reject every dynamic write. The typed CIA mask/ownership guarantee assumes such opaque accesses do not actually touch CIA1 registers. An enabled source may not be carried into a route that cannot own it. The source code, not a compiler branch checker, handles each consumed pending bit (AR-P3, AR-P7, PF-005).

Any CIA1 timer-latch/control or ICR-mask write in an exclusive epoch makes its prior device state unprovable for a reverse handoff. The focused ownership check carries that fact through calls, branches and loops. A selected exclusive IRQ handler's possible writes, including writes in its helpers or a handler it installs temporarily, dirty the active epoch as well; restoring a nested vector does not clean the device. The check reports source-linked E10278 on `restoreIRQ()` or a BASIC-returning path after such a mutation, even if `sourceAll` left every source disabled. An IRQ handler's own return is not a BASIC return. Counter-only reads in main or a handler do not set this fact. A statically identified raw write to a CIA1 timer/control/ICR register also dirties the device; an unresolved raw address remains the caller's responsibility under the opaque-access boundary above. This temporary rule prevents a broken BASIC return; it does not claim `restoreIRQ()` restored device configuration and does not add an implicit device snapshot or reset. DEF-14, owned by RD-05 before its closeout, must prove a safe bounded hand-back for game programs that quit normally (PF-002).

The selected KERNAL IRQ wrapper, callback-only handler identity, `CLD`/status restoration, saved-link placement, helper `JSR`/`RTS`, source acknowledgement, SFA interference, stack peak, banking visibility and `$EA81` terminal owner retain the existing qualified route contract. Only sink-reachable variants are emitted, and ROM bytes are reported separately from output bytes. This slice does not install an NMI handler or consume CIA2 ICR. DEF-7 still owns the complete CIA2/RESTORE/re-entry proof (AR-P4).

Use the existing E10278 template for failed interrupt-source ownership, unproved exclusive routes, unprovable CIA1 reverse handoffs, CIA2 state-changing calls, and constant flags that would touch unowned fields. Name the sink and operation and give a source-linked detail; do not throw an internal lowering error for expected invalid source. Ordinary arity/type errors keep the existing frontend diagnostics. No new diagnostic code or frozen-spec edit is planned (AR-P3–AR-P7, PF-002).

## Lowering and Cost

The compiler emits direct NMOS 6510 instructions using selected-profile addresses. These are **independent output expectations**, not claimed measurements:

| Constant/simple case | Expert sequence | Instruction-only bytes/cycles |
|---|---|---:|
| Read counter into `A`/`X` | `LDA $DC04; LDX $DC05` (or selected B/CIA2 addresses) | 6 bytes / 8 cycles |
| Enable Timer A | `LDA #$81; STA $DC0D` | 5 bytes / 6 cycles |
| Disable all CIA1 sources | `LDA #$1F; STA $DC0D` | 5 bytes / 6 cycles |
| Read pending byte into `A` | `LDA $DC0D` | 3 bytes / 4 cycles |
| Configure A with constant mode | `LDA $DC0E; AND #$C6; ORA #mode; STA $DC0E` | 10 bytes / 12 cycles before legal no-op instruction removal |

The complete artifact comparison includes argument evaluation, any dynamic-mask scratch, address mode, output bytes, SFA/ZP homes, hardware stack, helper calls, ROM path and path cycles. A dynamic configuration may need one SFA-owned byte staged before reading the control register; it may not invent storage after closure. Constant cases above must not gain a helper call, lookup table, duplicate MMIO access or hidden mask read. Any measured routine worse than equivalent expert assembly is a defect; a measured meet without a program-scale win path is tracked under the project parity directive, not declared sufficient.

## Authority and Uncertainty

Claim kind: the register effects and 901227-03 route facts are facts from [MOS 6526](https://myoldcomputer.nl/Files/mos_6526_cia.pdf), the pinned [KERNAL IRQ/NMI sources](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/irqfile) and the frozen Specification 4; the sequences above are test expectations, not current output. Current compiler capability status for this new source API is **Unknown until execution**, since declarations and artifacts do not yet exist. Physical edge behavior remains **Unknown** pending targeted hardware QA. Expert lineage: `skillVersion=2.0.0`, content `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`, `references/c64-hardware.md#CIA-register-effects-and-ownership`, `references/c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`, `references/sfa-and-abi.md#interrupt-route-completion-gate`; primary keys MOS-6526-1981 and CBM-C64-KERNAL-03.
