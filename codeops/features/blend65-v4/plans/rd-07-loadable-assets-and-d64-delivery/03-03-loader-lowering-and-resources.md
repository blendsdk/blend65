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
places through `machine/bind.ts`. Storage closure happens before machine lowering
(`storage/closure.ts:386`), and final layout places closed homes (`layout/c64-layout.ts:218`). The
current profile has no loader capability.

### Proposed changes

Add one machine operation lowering path for `load-unit`, one inline KERNAL sequence, one success
check, one name data object per unit, and one resource record consumed by storage and layout.

## Implementation Details

### Exact sequence

For a static destination and a unit name of length `N`:

```asm
        lda #1                  ; logical file number 1
        ldx $ba                 ; boot device captured by KERNAL startup
        ldy #0                  ; secondary address 0 -> LOAD relocates
        jsr $ffba               ; SETLFS
        lda #N                  ; compiler-owned name length
        ldx #<unit_name
        ldy #>unit_name
        jsr $ffbd               ; SETNAM
        lda #0                  ; LOAD, not VERIFY
        ldx #<destination
        ldy #>destination
        jsr $ffd5               ; LOAD
        bcs .failed
        cpx #<expected_end
        bne .failed
        cpy #>expected_end
        bne .failed
        lda #1
        bne .done               ; always taken; materializes true
.failed:
        lda #0
.done:
```

For a dynamic destination, the destination is evaluated once into a compiler temporary pair; the
`ldx #<destination`/`ldy #>destination` loads become temporary loads, and `expected_end` is computed
once as `destination + size` (16-bit add) before the comparison. The size is the exact unit length.

The logical file number is `1` because the boot program opens no other file. The device comes from
KERNAL `FA` (`$BA`), never from a source literal. The secondary address is `0`. The name is the
unpadded directory-name bytes; the directory's `$A0` padding is never passed to `SETNAM`.

### Success check

`true` requires:

1. carry clear after `JSR $FFD5`;
2. returned `X` equals the low byte of `(destination + size) & $FFFF`;
3. returned `Y` equals the high byte.

An exact end at `$10000` therefore compares against `$0000`. A returned end beyond the interval is
`false`, not a partial publication. The boolean is materialized through the ordinary ABI; no
exception, string, allocation, or dispatch table is emitted.

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
| Registers | A/X/Y and flags are clobbered; live values are not kept across the call |
| KERNAL workspace | `STATUS $90`, `VERCK $93`, `EAL/EAH $AE/$AF`, `FNLEN $B7`, `LA $B8`, `SA $B9`, `FA $BA`, `FNADR $BB/$BC`, `MEMUSS $C3/$C4` may change |
| Zero page | All documented workspace lies above the SFA window `$02–$8F`; no SFA re-window is needed |
| Stack | The KERNAL `LOAD` call adds a measured hardware-stack peak; the existing peak analysis includes it |
| ROM/IO | KERNAL ROM `$E000–$FFFF` stays visible; I/O `$D000–$DFFF` is not a destination |
| Mapping | `$0801–$CFFF` is RAM with BASIC ROM banked out; `$A000–$BFFF` is legal under that mapping |
| Code/data | Exact emitted bytes plus one name object per unit; no staging or copy buffer |
| Timing | The 27-byte/37-cycle setup is reported separately from variable KERNAL/device time; unknown time is `Unknown` |

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
