# Task T-04: Keyboard scan ownership proof

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Progress**: 1/1 tasks (100%)
> **Last Updated**: 2026-10-02 22:59 CEST
> **Phase baseline tree**: f158903640187c5258f3439cbc8bbe360bd5adf5
> **Scope mode**: strict

## Objective

Answer the ownership question before accepting positive keyboard support. The user approved
the proof-only boundary in [AR-P4](../rd-05-keyboard-input/00-ambiguity-register.md).
High effort remains confirmed for this outcome.

**Smallest viable design:** Use the pinned stock KERNAL and existing VICE/debugging facilities
for a temporary, focused assembly probe. Record the independent source-derived predictions
before replay. No persistent harness, monitor-driver extension, compiler/library API, state
manager, NMI replacement, optimizer, upstream requirement or frozen-authority change.

**Expected modification set:** This mini-plan, the keyboard discovery register and the feature
roadmap. Temporary probe files and logs are diagnostic evidence, not shipped product code.
Portfolio synchronization is deferred on this non-integration branch.

## Task

- [x] T-04.1 Replay the bounded keyboard ownership cases and record their observed or Unknown results. ✅ (completed: 2026-10-02 22:59)
      **Deliverable:** Confirm the exact matrix/NMI injection mechanism first. Check a no-NMI control,
      the single returning stock NMI, the challenged two-NMI/final-PA comparison, both incoming I
      states, known latch/direction restoration and timer PB6/PB7 output ownership. Bind source,
      ROM, executable, machine settings, observation points and limitations. Keep AR-P2/AR-P3 open
      unless their actual product decisions are separately resolved; no positive API acceptance.
      **Verify:** Sequential pinned VICE observations against the predictions below; targeted
      Markdown formatting, links, source identities, frozen-path checks and independent correctness
      review. The compiler suite is not required for a documentation-only result.

## Predictions before replay

Primary authority: MOS-6526-1981 port/timer semantics; CBM-C64-KERNAL-03 at content
`01bd60f162ef92212ef0cb67546ae8f42be34168`, `time::UD60/UD70/UD80/UD90` and
`rs232nmi::NNMI19`. VICE-310-SOURCE governs injection and configured-emulator behavior only.
Expert baseline: `2.0.1`, qualified content `1ce4852016e2a883cf1f733c6014c45e176bfc69`.

| Case                                                                                 | Independent expectation                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No NMI, PA=$FE, Cursor U/D + Left Shift                                              | PB7 is low under PA0; the selected PA write remains $FE.                                                                                                                                                                                      |
| Same keys, one returning stock RESTORE/NMI before the row read                       | UD60 writes PA=$BD then its earlier PB sample, not the interrupted column. SEI does not exclude this path. A changed drive can invalidate the intended row.                                                                                   |
| PA=$7F, STOP + Left Shift + Q; NMI1; release Q, press £; row sample; release £; NMI2 | Source predicts PA=$3F during the row sample and PA=$7F at the later comparison; PB0 can falsely appear to be key 1. Replay must establish both genuine returning NMI paths and the exact key sequence before confirming this counterexample. |
| Incoming I=0 and I=1                                                                 | PHP/SEI/PLP restores the respective incoming I bit; NMI remains possible inside either transaction.                                                                                                                                           |
| Known PA/PB latches and readable DDRs                                                | Explicit writes can restore the known state at a stated instruction boundary. Pin reads cannot establish an arbitrary old hidden latch. Later firmware mutation is a separate boundary.                                                       |
| Timer PBON                                                                           | CRA/CRB PBON can override PB6/PB7 even with DDRB=$00; the keyboard contract must not infer input ownership from DDRB alone.                                                                                                                   |

These are predictions, not executed qualification. If existing facilities cannot perform a case,
record Unknown and the exact missing mechanism; do not add a driver to turn it into a pass.

## Results

**VICE-verified / hardware-unverified**, bounded to PAL/6569R3, SID6581, old CIA models and
stock KERNAL revision 3. This is a diagnostic ROM/hardware replay, not compiler output or
four-profile keyboard qualification. No production bytes/cycles, positive keyboard API,
arbitrary-latch restoration, atomic input snapshot or universal silicon result is claimed.

| Case                                                                      | Observation                                                                                                                                                                                             | Conclusion                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No NMI; Cursor U/D + Left Shift, incoming I=0 / I=1                       | Stored `(PB, PA, pushed P)` is `($7F,$FC,$30)` / `($7F,$FC,$34)`. The PA latch remains $FE; connected keys pull the PA1 pin low.                                                                        | Intended PB7 observation works; PA pin reads are not latch reads. Both incoming I states return, with SP=$F3.                                                                                                                             |
| One returning RESTORE, same keys, incoming I=0 / I=1                      | ROM writes `$BD` then `$7F` to PA; stored result is `($FF,$7F,$30)` / `($FF,$7F,$34)`.                                                                                                                  | IRQ masking alone does not preserve the selected column. The row can miss Cursor U/D. Both I states return.                                                                                                                               |
| Original two-NMI proposal, STOP + Left Shift retained                     | NMI1 writes `$BD,$3F`; the £ interval produces PB=$7E. NMI2 writes `$BD,$7F`; final PA pin read is **$7D**, not $7F. Stored result `($7E,$7D,$34)`.                                                     | The original matching-PA prediction was wrong: this exact trace is rejected by a $7F comparison. Do not cite it as a false acceptance.                                                                                                    |
| Same two-NMI sequence, release all keys after NMI2 and before the PA read | The saved PB remains $7E; final PA is $7F. Stored result `($7E,$7F,$30)`. Key 1 was never pressed.                                                                                                      | A final matching PA observation does not certify the column used earlier when keys can change at these boundaries. This extra release is essential to this observed counterexample. No fixed-key or nested-NMI counterexample is claimed. |
| Known-state restoration at the done checkpoint                            | Debugger read-only inspection: PA/PB latches=$7F/$A5, DDRA/DDRB=$FF/$00. Port-B pin read is $FF with no keys, not its $A5 latch. CIA2 PA/PB/DDRA/DDRB remain $97/$FF/$3F/$00; CPU port remains $2F/$37. | Explicit known-state writes restore at this boundary. They do not recover an arbitrary old latch from pins.                                                                                                                               |
| Another RESTORE after the done checkpoint                                 | With STOP + Left Shift + Q, ROM writes `$BD,$3F`, returns via RTI, and the inspected PA latch is $3F.                                                                                                   | Subsequent firmware action is distinct from the completed restoration boundary.                                                                                                                                                           |
| Stopped timers, DDRB=$00, no keys                                         | PB observations: both PBON off=$FF; CRA=$06 gives $BF; CRA off and CRB=$06 gives $7F; both off again=$FF.                                                                                               | PB6/PB7 timer outputs override the input-direction assumption. No running-timer edge/timing claim.                                                                                                                                        |

All scored NMI paths used the genuine emulator RESTORE input and unchanged
`$FFFA/$FFFB → $FE43 → ($0318=$FE47)` route. Tracepoints observed `$FE43/$FE44/$FE47`,
the `$F6C9/$F6D4` PA stores and the stock `$FEC1 RTI`. Two-event cases used sequential
returning events, not handler nesting. STKEY was deliberately initialized to $FF by the probe;
the held shift path leaves it unchanged, so STOP does not abort the diagnostic.

### Identity and observation method

| Item                                       | Bound evidence                                                                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VICE                                       | 3.10 `x64sc`, executable SHA-256 `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`                                                                                                                                        |
| Runtime resources                          | `VICIIModel=0`, `SidModel=0`, `CIA1Model=0`, `CIA2Model=0`, `KernalRev=3`, read from the running monitor                                                                                                                                   |
| KERNAL / BASIC / chargen SHA-256           | `83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721` / `89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d` / `fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420`                               |
| Input-only assembly / PRG SHA-256          | `8e7470d15f32a62b7d66d2f470a436c66ef35ea20cab90a409ba9ba970e68967` / `bf2a50bbfa08cd512f1a1f2682b4c2151f122ac583389975d7994ac73b93868d`                                                                                                    |
| Assembly / PRG with separate timer control | `ac595b7a7c6f776f9efe08658ec656a9907841c120b10a9744c50d7340c254fd` / `7aad986adcb4e9164b379ea83dfff7d1f2f710012b8731e6a8c94755b41bb7b5`                                                                                                    |
| Session evidence directory                 | `/tmp/blend65-keyboard-proof.B6G83I`; `monitor-pal6581-final.log` SHA-256 `89e192c3db89624d2d2ce26b0e024a567b0b1807ab107e984b611ffbf6618ba8`; `gdb-pal6581.log` SHA-256 `b053b11fcb3eb190577dd8c871776e94e7a7009d37be037d10038f32b0326a9a` |

ACME 0.97 assembled with `--cpu 6502 --strict-segments -f cbm`, explicit output/report/symbol
paths. The PRG load header is `$2000`; body ends at $2902. The input-only image ran the first
four controls and the released-key two-event trace. The separate timer section was then added
at $2400 without changing any input instructions. The final image ran the timer control, the
complete original held-key trace and the post-restoration event. The reconstructed input-only
image was independently reassembled and hash-checked, not presented as a second runtime run.

Run under `gdb -q -nx /home/gevik/.local/bin/x64sc` with a host breakpoint at
`mon_keyboard_feed`, then:

```text
run -default -model c64 -pal -VICIImodel 6569 -sidmodel 0 -ciamodel 0 -kernal /home/gevik/.local/share/vice/C64/kernal-901227-03.bin -basic /home/gevik/.local/share/vice/C64/basic-901226-01.bin -chargen /home/gevik/.local/share/vice/C64/chargen-901225-01.bin -console -nativemonitor +sound +warp -controlport1device 0 -controlport2device 0 -limitcycles 100000000 -initbreak ready
```

At stock BASIC readiness, the native monitor loaded the diagnostic PRG with device 0, not via
the compiler or a disk loader. CPU checkpoints: $2105, $2205/$2206/$220C/$220D and $2900.
Results are at $3000–$3002; the timer control uses $3040–$3043. `r fl=$20` / `r fl=$24`
selects caller I, then `g $2000` establishes the transaction; selecting `g $2200` from the
$2105 stop enters the two-event case without another PHP. `x` resumes between checkpoints.

The native monitor's `keybuf` is **not** a matrix injector. At a stopped CPU, `keybuf ""`
only reached the debugger breakpoint. In that emulation thread, the debugger called the
unmodified `keyboard_event_playback(0, $matrix)` and, when required,
`machine_set_restore_key(1)`. It then forced `mon_keyboard_feed` to return without feeding
its string and continued. Neither ROM bytes, CPU interrupt frames nor vectors were patched.
The 16 host integers are VICE's `(PA index → PB bit mask)` input, with unused entries zero:

| Input                   | Nonzero matrix entries      |
| ----------------------- | --------------------------- |
| Cursor U/D + Left Shift | `[0]=$80, [1]=$80`          |
| STOP + Left Shift + Q   | `[1]=$80, [7]=$C0`          |
| STOP + Left Shift + £   | `[1]=$80, [6]=$01, [7]=$80` |
| STOP + Left Shift       | `[1]=$80, [7]=$80`          |
| All released            | none                        |

The official VICE tag's `keyboard.c::keyboard_event_playback` updates both matrix views;
`c64keyboard.c::c64keyboard_restore_key` raises and releases the RESTORE NMI source.
Installed `keyboard.c` matches the pinned official content SHA-256
`6dfe726f939433aed9685ea0b8cd1f23873570b127fa6410c680763d4c3c4a60`.
Primary source: [VICE 3.10 keyboard source](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/keyboard.c)
and [RESTORE source](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/c64/c64keyboard.c).
This deterministic diagnostic injection does not qualify host key mapping, physical key bounce,
RESTORE pulse circuitry, plausible human event cadence or a physical CIA revision.

Setup-only failures are excluded: the initial GTK monitor did not provide the native prompt;
Ctrl-C in a subsequent native prompt ended that attempt; an early Q input was mistakenly
placed at PA6 rather than PA7 and was corrected before the scored two-event sequences.
The final owned VICE process exited normally; no user process was stopped.

### Planning consequence

The proof corrects the exact counterexample but does not accept the current final-PA guard
as a general acquisition certificate. AR-P2/AR-P3 remain open. A known-state transaction must
separate latch restoration, concurrent firmware ownership, timer output ownership and
electrical/input ambiguity. No NMI adapter, latch service or source restriction follows
automatically from this evidence; any positive contract still needs its material decision.

### Verification and independent review

Targeted Markdown formatting (with the repository's Markdown ignore explicitly bypassed),
relative links, the retained exact assembly hash, five source keys, seven recorded observation
signatures and runtime identities pass. Whitespace checks pass; frozen spec/expert paths are
unchanged. The progress helper displays `1/1 tasks (100%)` but exits 1 because it requires
`00-index.md` even for a lightweight task. The skill explicitly forbids that extra mini-plan
document: no index was added merely to satisfy the helper. Direct task/header validation passes.
The roadmap engine reports only the expected portfolio
cascade drift, deferred on this non-integration branch; the feature counter is unchanged.
Independent whole-task correctness review (`keyboard_proof_review`, correctness, maintainability
and standards) reports **no findings**; it independently checked artifact hashes, raw logs and
the bounded interpretations against pinned ROM source. Security and performance auditors are
skipped because the persistent diff is documentation-only. No compiler suite is needed for this
approved documentation-only diagnostic outcome. No frozen authority or spec-test file changed.

## Reproducible diagnostic source

The complete final source below is retained here rather than adding a test framework or shipped
support file. For the input-only identity, omit the section beginning `; Timer-output` through
end of file. Assembled input code is identical in both images.

```asm
; Diagnostic only: the stock ROM owns the NMI vector throughout this probe.
; Results at $3000 preserve row and PA observations; $3002 records caller I.
!cpu 6502
CIA1_PA = $dc00
CIA1_PB = $dc01
CIA1_DDRA = $dc02
CIA1_DDRB = $dc03
CIA1_ICR = $dc0d
CIA1_CRA = $dc0e
CIA1_CRB = $dc0f
STKEY = $91
* = $2000
entry:
    cld
    php
    sei
    lda #$1f
    sta CIA1_ICR
    lda #0
    sta CIA1_CRA
    lda #$08
    sta CIA1_CRB
    lda CIA1_ICR
    lda #$ff
    sta CIA1_DDRA
    sta STKEY
    lda #0
    sta CIA1_DDRB
    lda #$a5
    sta CIA1_PB
    lda #$7f
    sta CIA1_PA
    jmp single
* = $2100
single:
    lda #$fe
    sta CIA1_PA
single_before_row:
    nop
    lda CIA1_PB
    sta $3000
    lda CIA1_PA
    sta $3001
    jmp restore
* = $2200
double:
    lda #$7f
    sta CIA1_PA
double_before_row:
    nop
    lda CIA1_PB
    sta $3000
double_before_pa:
    nop
    lda CIA1_PA
    sta $3001
    jmp restore
* = $2300
restore:
    lda #$7f
    sta CIA1_PA
    lda #$a5
    sta CIA1_PB
    lda #$ff
    sta CIA1_DDRA
    lda #0
    sta CIA1_DDRB
    plp
    php
    pla
    sta $3002
    jmp done
* = $2900
done:
    jmp done
; Timer-output ownership is tested separately from the keyboard/NMI cases.
; Both timers stay stopped. Toggle mode exposes the initial low timer output.
* = $2400
timer_probe:
    php
    sei
    lda #0
    sta CIA1_DDRB
    sta CIA1_CRA
    lda #$08
    sta CIA1_CRB
    lda CIA1_PB
    sta $3040
    lda #$06
    sta CIA1_CRA
    lda CIA1_PB
    sta $3041
    lda #0
    sta CIA1_CRA
    lda #$06
    sta CIA1_CRB
    lda CIA1_PB
    sta $3042
    lda #$08
    sta CIA1_CRB
    lda CIA1_PB
    sta $3043
    plp
    jmp done
```
