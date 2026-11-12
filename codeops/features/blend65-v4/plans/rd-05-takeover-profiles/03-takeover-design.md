# Takeover Resident Profile Design

> **Parent**: [Index](00-index.md)
> **Authority**: Specification 4.0 appendix C64 §2, §3, §5.1, §9.2; RD-05 R5.1–R5.17
> **Updated**: 2026-11-12

## 1. Closed profile facts

The existing five-row table becomes a nine-row table with one new field:

```ts
readonly ownership: "cooperative" | "takeover";
```

Takeover rows use the same PAL/NTSC timing and SID model as their cooperative siblings and
the same `profileKind: "prg"`. They differ only in the closed delta:

| Field | Cooperative | Takeover |
|---|---|---|
| processor-port mapping (`$0001` low bits) | `$06` | `$05` |
| owned low mask (`$0000/$0001`) | `$07` | `$07` |
| hardware-stack reserve | 20 | 0 |
| KERNAL execution while app runs | present | absent |
| hardware vectors | KERNAL ROM `$FFFA/$FFFE` | RAM `$FFFA/$FFFE` |
| interrupt routing map | CINV/NMINV | raw IRQ/NMI |
| machine identity | `c64-{video}-kernal-901227-03-{sid}` | `c64-{video}-takeover-{sid}` |

`selectTargetProfile` composes the four new rows from the same immutable facts. No
selection path creates a profile from independent switches.

## 2. Machine and storage facts

`C64MachineFacts` gains:

```ts
readonly ownership: "cooperative" | "takeover";
readonly processorPortMapping: 0x06 | 0x05;
readonly rawIrqVector: 0xfffe;
readonly rawNmiVector: 0xfffa;
```

`TargetProfile.storage.hardwareStackReserve` is 20 for cooperative and 0 for takeover.
The remaining storage ranges are unchanged: zero page `$02–$8F`, RAM `$0801–$CFFF`,
hardware stack capacity 256.

The frozen `$05` mapping exposes RAM at `$E000–$FFFF` and, per the qualified selection
table (`HIRAM=0, LORAM=1`), also exposes RAM at `$A000–$BFFF`; BASIC ROM is banked out for
CPU accesses. The full frozen `$0801–$CFFF` range remains available for code, data, default
entries, handler wrappers and SFA. `startupVisibilityFailure` remains the existing guard
for the restore path where cooperative caller banking is restored.

## 3. Takeover startup

### 3.1 Entry and state

The PRG keeps the 12-byte `$0801` BASIC stub and enters at `$080D`. The takeover
constructor uses a dedicated startup state layout:

| Offset | Byte |
|---:|---|
| 0 | incoming A |
| 1 | incoming X |
| 2 | incoming Y |
| 3 | incoming status |
| 4 | incoming stack pointer |
| 5 | `$0000` DDR |
| 6 | `$0001` latch |
| 7 | `$DD02` CIA2 port-A direction |
| 8.. | actually borrowed BASIC zero-page bytes |

The object is `platform.startup-state`; its size is `8 + borrowed.length`. It closes
through the existing final SFA allocation, exactly like the cooperative object. The
borrowed-byte policy is the existing `borrowedBasicBytes` filter (`$03–$8F`), and every
borrowed byte is captured at entry and restored at exit.

### 3.2 Entry sequence

```asm
startup.entry:            ; $080D
    STA state+a
    STX state+x
    STY state+y
    PHP
    SEI
    PLA
    STA state+status
    TSX
    STX state+stack
    CLD

    LDA $0000
    STA state+cpuDirection
    LDA $0001
    STA state+cpuPort
    LDA $DD02
    STA state+cia2Direction

    ; Capture every actually borrowed BASIC zero-page byte.
    LDA $03
    STA state+borrowed+0
    ; ... one store per borrowed address ...

    ; KERNAL ROM still supplies reads; writes reach underlying RAM.
    LDA #<startup.rawNmiDefault
    STA $FFFA
    LDA #>startup.rawNmiDefault
    STA $FFFB
    LDA #<startup.rawIrqDefault
    STA $FFFE
    LDA #>startup.rawIrqDefault
    STA $FFFF

    ; Preserve unowned bits; own low three bits, and establish VIC bank zero
    ; through the owned CIA2 direction bits.
    LDA state+cpuPort
    AND #$F8
    ORA #$05
    STA $0001
    LDA state+cpuDirection
    ORA #$07
    STA $0000
    LDA state+cia2Direction
    AND #$FC
    STA $DD02

    CLI
    JSR initializer...
    JMP main                 ; or fall through for the compact main entry
```

The CIA2 DDR transaction follows the cooperative constructor: clear the low two direction
bits so the external pull-ups select VIC bank zero, while preserving unrelated direction
bits. The unreadable `$DD00` output latch is not captured or reconstructed.

`SEI` is set before the vector writes because the active ROM IRQ route is still valid but
the program is about to replace the source of the vector; no NMI can be suppressed, so
both vector bytes are complete before the mapping write.

The mapping write order follows the frozen contract: latch first, then DDR. If the owned
DDR bits were inputs at entry, the mapping changes on the DDR write; both sides of that
single transition have a complete valid vector.

### 3.3 Default raw entries

`startup.rawIrqDefault` is a separate machine function, not a block of the startup path:

```asm
startup.rawIrqDefault:
    PHA
    LDA $DC0D          ; consume CIA1 pending flags once
    LDA $D019          ; capture VIC raster flags
    STA $D019          ; write-one-to-clear the observed bits
    PLA
    RTI
```

It saves only A because X/Y are untouched, acknowledges the stock CIA1 source and the VIC
raster source, and changes no write-only CIA state. It is the baseline route when source
installs no raw IRQ handler.

`startup.rawNmiDefault` consumes any inherited CIA2 pending state once and returns:

```asm
startup.rawNmiDefault:
    BIT $DD0D          ; consume inherited CIA2 pending flags once; A preserved
    RTI
```

It explicitly replaces RESTORE/NMI behavior with "ignore" and changes no write-only CIA2
mask. Source-installed raw NMI is deferred (AR-T6); a typed CIA2 source operation without
a proved raw NMI owner is rejected. The default NMI entry is marked
`nmiPublicationEntry` and placed at low byte `$47` so any future raw NMI publication can
update only `$FFFB`.

### 3.4 Return sequence

```asm
startup.restore:
    SEI
    LDA state+cia2Direction
    STA $DD02
    ; restore each borrowed BASIC zero-page byte
    LDA state+borrowed+0
    STA $03
    ; ...
    LDA state+cpuPort
    STA $0001
    LDA state+cpuDirection
    STA $0000
    LDX state+stack
    TXS
    LDA state+status
    PHA
    LDA state+a
    LDX state+x
    LDY state+y
    PLP
    RTS
```

Restoring the latch before the DDR matches the cooperative restore order and keeps every
observable port value/direction exact. CIA2 DDR is restored before the CPU port so the
VIC bank is still visible while the restore code runs. The RAM vectors at
`$FFFA–$FFFF` become inactive when KERNAL ROM is selected again; their previous values
were not readable while ROM was visible, so they are not part of the captured state.

Borrowed BASIC zero-page bytes are restored before the final status/register restoration,
using the existing `borrowedBasicBytes` policy. No initialized loader bytes are copied.

### 3.5 Normal versus nonreturning exits

A source path that does not return from `main` is legal and skips the restore sequence.
A returning path must have balanced raw installs and no dirty CIA1 state; otherwise the
existing ownership analysis raises `E10278`. There is no runtime ownership flag.

## 4. Raw interrupt variants and sinks

Add one source-installable variant:

| Variant | Save owner | Body stack | D on body entry | Terminal | Static link |
|---|---|---:|---|---|---:|
| `c64_raw_irq` | compiler | 6 | binary | `rti` | 0 |

The existing wrapper builder already emits exactly this shape: `PHA; TXA; PHA; TYA; PHA;
CLD; body; PLA; TAY; PLA; TAX; PLA; RTI` — 12 output bytes, 37 cycles plus body, six stack
bytes. The body is callback-only and ends in `RTI`, never a firmware tail.

Takeover source sink:

| Capability | Variant | Domain | Vector |
|---|---|---|---|
| `c64.system.setRawIRQ` | `c64_raw_irq` | irq | `$FFFE` |

The matching restore is `c64.system.restoreRawIRQ`. It pops the per-sink LIFO stack and
writes back the exact saved predecessor.

Raw IRQ publication writes both bytes inside `SEI`; the IRQ line is masked for the whole
transaction, so no torn IRQ entry is reachable. NMI cannot use the IRQ vector.

Source-installed raw NMI is deferred (AR-T6). The startup default NMI entry is still
placed at low byte `$47`, is a complete RAM vector before the mapping change, and reads
CIA2 ICR once to consume any inherited pending state. A future raw NMI installer can reuse
the same matching-low publication rule: install captures the two-byte predecessor and
writes only `$FFFB`; restore writes only `$FFFB` from the captured word.

## 5. Ownership and proof rules

| Rule | Diagnostic |
|---|---|
| Raw IRQ install pushes one predecessor word; matching restore pops only the current top; joins and loops must agree | `E10278` |
| A restore with no matching top, cross-sink restore, or pop below a handler prefix | `E10278` |
| Raw vector write after an install invalidates the high-level proof | `E10278` |
| Source raw write to the compiler-owned `$0000/$0001/$DD00/$DD02/$FFFA–$FFFF` bytes | `E10278` |
| Raw IRQ install without an empty possible-source set or a handler that consumes/disables every CIA1 source on every path | `E10278` |
| Raw IRQ route that leaves typed CIA1 state changed on a returning path | `E10278` |
| CIA2 typed state/source operation without a proved exclusive NMI owner | `E10278` |
| Cooperative KERNAL sink used under takeover, or raw IRQ sink under cooperative/D64 | frontend unknown-name diagnostic |

The raw IRQ route counts as `exclusive` for CIA1. Source-installed raw NMI is not exposed,
so no takeover route can claim exclusive CIA2 ownership in this slice. The cooperative
stock Timer A handback is not emitted for takeover.

## 6. Costs and evidence

| Item | Expected output cost |
|---|---|
| Takeover startup entry (state + CIA2 + vectors + mapping) | measured from emitted assembly; no estimate is accepted as proof |
| Default raw IRQ entry | 12 bytes / 25 nominal cycles plus hardware acceptance |
| Default raw NMI entry | 4 bytes / 10 nominal cycles plus hardware acceptance |
| Raw IRQ wrapper | 12 bytes / 37 cycles plus body; 6 stack bytes; hardware acceptance adds 7 cycles and 3 stack bytes |
| Raw IRQ install/restore | measured from emitted assembly; includes `PHP; PHA; SEI` and two vector writes |
| Startup restore | measured from emitted assembly |

Every selected profile records identity, artifact hash, VICE/ROM hashes, selected
resources, entry/stop state, vector/mapping observation and `VICE-verified /
hardware-unverified`.

## 7. Tooling changes

- `selectC64KernalFacts` and `selectFrontendProfile` gain the four rows.
- `viceLaunchArguments` and `startVice` accept the closed eight-ID resident-PRG pattern
  and derive `pal`/`ntsc` from it; the D64 identity remains outside this PRG harness.
- `services/vice.ts` already derives from `selectC64KernalFacts`; it only needs the new
  facts to be present.
- `startVice` accepts any complete profile selected from the closed table.
- No VICE argument or ROM identity changes; takeover still uses the pinned 901227-03 ROM
  files for the emulated machine, even though the program does not call KERNAL.
