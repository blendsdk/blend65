; The MVP gate program, written by hand in 6502 for ACME: set the border to
; colour 5 (green) and hand control back to BASIC. Observably identical to
; examples/gate/main.blend — for a compile-time-constant program a game
; developer writes the direct store; the machinery a compiler emits around
; it is exactly what the parity diff measures.
!to "gate-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #5
        sta $d020           ; border colour = green
        rts
