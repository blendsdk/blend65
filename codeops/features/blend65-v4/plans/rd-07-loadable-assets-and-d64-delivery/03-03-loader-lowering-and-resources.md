# Loader Lowering and Resources: RD-07 Loadable Assets and D64 Delivery

> **Document**: 03-03-loader-lowering-and-resources.md
> **Parent**: [Index](00-index.md)

## Overview

This component lowers the semantic load operation to the exact KERNAL 901227-03 sequence, validates
the returned end address, materializes the boolean result, and closes every resource the adapter
touches. It emits no staging buffer, relocation copy, checksum, or runtime registry.

## Architecture

### Current architecture

The machine stage lowers platform operations through `machine/lower-c64.ts` and binds symbolic
places through `machine/bind.ts`. Machine lowering produces the symbolic program first; the
shared-storage pass then closes SFA against that program, and final layout places the closed homes.

### Proposed changes

Add one machine operation lowering path for `load-unit`, one inline KERNAL sequence, one success
check, one name data object per unit, and one resource record consumed by storage and layout.

## Implementation Details

### Exact sequence

For a unit name of length `N`:

```asm
        lda #1                  ; logical file number 1
        ldx $ba                 ; boot device captured by KERNAL startup
        ldy #0                  ; secondary address 0 -> LOAD relocates
        jsr $ffba               ; SETLFS
        lda #N                  ; compiler-owned name length
        ldx #<unit_name         ; read-only data, never copied
        ldy #>unit_name
        jsr $ffbd               ; SETNAM
        stx scratch+0           ; destination is evaluated exactly once
        sty scratch+1
        cld
        txa
        clc
        adc #<size
        sta scratch+2           ; expected one-past end
        tya
        adc #>size
        sta scratch+3
        lda $9d                 ; MSGFLG
        sta scratch+8
        and #$3f                ; suppress KERNAL error/control messages
        sta $9d
        lda #0                  ; LOAD, not VERIFY
        ldx scratch+0
        ldy scratch+1
        jsr $ffd5               ; LOAD
        lda scratch+8
        sta $9d
        cld
        lda $90
        and #$0f                ; only the low error nibble is failure
        sta scratch+6
        txa
        eor scratch+2
        sta scratch+7
        tya
        eor scratch+3
        ora scratch+7
        ora scratch+6
        cmp #1
        lda #0
        adc #0
        eor #1
```

`scratch` is one compiler-owned absolute RAM object per unit. The KERNAL `LOAD` uses zero-page
scratch that overlaps the SFA window, so no cross-call value may live there. The stub is writable,
zero-initialized, and reported as a `scratch` memory interval owned by the load unit.

The logical file number is `1` because the boot program opens no other file. The device comes from
KERNAL `FA` (`$BA`), never from a source literal. The secondary address is `0`. The name is the
unpadded directory-name bytes; the directory's `$A0` padding is never passed to `SETNAM`.

The unit file begins with a 2-byte header (`$00 $00`; the boot uses `$01 $08`). Under secondary
address 0 the KERNAL consumes that header and ignores it for placement; X/Y supplies the
destination. The header is therefore part of the file payload and the block count, but not part of
the logical unit.

### Success check

`true` requires:

1. the low nibble of KERNAL `STATUS` (`$90 & $0F`) is zero;
2. returned `X` equals the low byte of `(destination + size) & $FFFF`;
3. returned `Y` equals the high byte.

The real KERNAL sets `STATUS` bit 6 (EOI, `$40`) on a successful transfer, so the full byte is not a
success indicator. A missing file enters the KERNAL error handler; clearing `MSGFLG` bits 6 and 7
around the call makes that handler return with carry instead of entering the BASIC warm-start path.
The saved `MSGFLG` byte is restored immediately after the call. An exact end at `$10000` compares
against `$0000`. A returned end beyond the interval is `false`, not a partial publication. The
boolean is materialized through the ordinary ABI; no exception, string, allocation, or dispatch
table is emitted. A zero-byte unit checks only the status nibble, because there is no loaded address
to compare.

### Effect retention

The machine operation keeps:

- unit identity and name bytes;
- fresh result identity;
- evaluated destination and candidate set;
- blocking write and KERNAL/IO effect;
- failure edge and quiescence requirement;
- profile and strategy identity.

No generic call or byte-copy operation may erase these facts before analysis, layout, lowering, and
evidence.

### Link only when reached

The loader code and name data are emitted only when the whole-program pass finds a reachable
`load-unit` operation. A resident-only D64 program and every PRG program contain no loader code,
name bytes, KERNAL-call scaffolding, load-unit entries, or loader reservations. No fastloader,
decompressor, drive code, registry, or general runtime is present.

### Resource contract

| Resource | Contract |
| -------- | -------- |
| Registers | A/X/Y and flags are clobbered. The compiler spills live source values before the operation; the boolean result is materialized in A. The adapter does not save/restore program registers. |
| KERNAL workspace | `STATUS $90`, `VERCK $93`, `EAL/EAH $AE/$AF`, `FNLEN $B7`, `LA $B8`, `SA $B9`, `FA $BA`, `FNADR $BB/$BC`, `MEMUSS $C3/$C4` may change |
| Zero page | KERNAL `LOAD` clobbers zero-page scratch that overlaps the SFA window `$02–$8F`. The loader keeps every cross-call value in its own absolute RAM object; `STATUS $90`, `MSGFLG $9D` and `FA $BA` are read/written directly |
| Stack | The inline `JSR $FFD5` frame, the measured KERNAL `LOAD` internal peak, and a conservative stock IRQ/NMI frame are added to the SFA certificate and `stackDomains` |
| ROM/IO | KERNAL ROM `$E000–$FFFF` stays visible; I/O `$D000–$DFFF` is not a destination |
| Mapping | `$0801–$CFFF` is RAM with BASIC ROM banked out; `$A000–$BFFF` is legal under that mapping |
| Code/data | Exact emitted bytes plus one read-only name object and one RAM scratch object per unit; no staging data copy |
| Timing | The 27-byte/37-cycle setup is reported separately from variable KERNAL/device time; unknown time is the measured-value `{kind:"unknown"}` record |

The loader does not silently pause, restart, or reconstruct application callbacks, audio, effects,
frame counters, or gameplay state. It makes no raster/frame/audio cadence promise.

### Destination mapping

The profile already banks BASIC ROM out and keeps KERNAL ROM visible. A destination in
`$0801–$CFFF` is writable under that mapping, including `$A000–$BFFF`. The loader rejects:

- `$D000–$DFFF` I/O and MMIO;
- `$E000–$FFFF` KERNAL ROM while it is visible;
- any range that hides loader or serial-bus resources;
- any destination whose later read/fetch mapping differs from the write mapping.

VIC-visible destinations are legal when the VIC bank/pointer fields are derived from the destination
and the destination does not overlap an active screen/character-ROM window.

### Failure behavior

On `false`, the destination bytes are indeterminate and cannot be read until fully reassigned or a
later successful load. A dynamic destination invalidates only the captured range; a proved
unselected initialized candidate remains readable. Source owns retry, error display, menu return, or
termination. The compiler supplies no modal UI, retry loop, error text, disk prompt, or policy
engine.

## Integration Points

| Stage | Use |
| ----- | --- |
| Semantic lowering | Preserve the `load-unit` operation and its effect |
| Machine lowering | Emit the sequence and success check |
| Storage closure | Include loader temporaries and stack peak |
| Layout | Place loader code/name data and every destination candidate |
| Evidence | Report exact bytes, KERNAL ROM as existing zero-output code, and timing as known/unknown |

## Error Handling

| Error case | Handling | AR Ref |
| ---------- | -------- | ------ |
| Destination beyond `$10000` | E10275 before emission | AR-P21 |
| I/O/ROM destination | E10275 with the mapping reason | AR-P7 |
| Active user route | E10275 with the route and remedy | AR-P5 |
| KERNAL carry set | Runtime `false`; no publication | AR-P7 |
| Short/unexpected end | Runtime `false`; no publication | AR-P7 |
| Loader code unreachable | Emit nothing | AR-P6 |

## Testing Requirements

- Assembly expectation for the exact static sequence, bytes, and cycles.
- Dynamic destination evaluation-once and runtime end-address check.
- `$10000` exact-end and beyond-end cases.
- No loader bytes when no load call is reachable.
- Resource/stack/KERNAL-workspace evidence.
- VICE success/failure/short-load/canary cases.
