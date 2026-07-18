; The conditionals+loops fixture, written by hand in 6502 for ACME.
; Observably identical to examples/slice4a/main.blend: the loop sum
; (a for-loop with break/continue plus a while-loop = 21) at $C000 and the
; two-armed if's `then` marker (21 > 20 -> 1) at $C001. Every control path
; runs over constants, so a game developer writes the folded results — the
; compiler's block/branch machinery is what the parity diff measures.
!to "slice4a-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #$15
        sta $c000           ; (1+2+4+5+6) + (1+1+1) = 21
        lda #1
        sta $c001           ; 21 > 20 -> the then arm
        rts
