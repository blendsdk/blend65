; The local-byte fixture, written by hand in 6502 for ACME: the program's
; one observable is the border driven to colour 5. Observably identical to
; examples/slice3a/main.blend — its local variable and frame slot are
; compile-time machinery with a constant result, so a game developer writes
; the direct store; the diff measures everything the compiler adds.
!to "slice3a-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #5
        sta $d020           ; border colour = green
        rts
