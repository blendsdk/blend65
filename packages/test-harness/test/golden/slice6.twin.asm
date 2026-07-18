; The expression-system fixture, written by hand in 6502 for ACME.
; Observably identical to examples/slice6/main.blend: mixed-width promotion
; (1255 = $04E7), cast/shift/bitwise/complement ($DA), signed negation (5),
; the short-circuit ternary (7), the suppression witnesses (0 then 1), and
; the variable-count word shift ($0044). Every expression folds at
; authoring time, so a game developer writes the results directly — the
; expression machinery the compiler emits is what the parity diff measures.
!to "slice6-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #$e7
        sta $c000           ; base + a += 55 = 1255 = $04E7 - lo byte
        lda #$04
        sta $c001           ; hi byte
        lda #$da
        sta $c002           ; ~((<byte>($0304) << 3) | 5) = ~37 = $DA
        lda #$05
        sta $c003           ; <byte>(-(-5)) = 5
        lda #$07
        sta $c004           ; (a < base) && (s < 0) ? 7 : 9 = 7
        lda #$00
        sta $c005           ; bump() suppressed twice: witness untouched
        sta $c008           ; $0044 hi byte (same value, one load)
        lda #$01
        sta $c006           ; bump() ran exactly once
        lda #$44
        sta $c007           ; $0011 << 2 = $0044 - lo byte
        rts
