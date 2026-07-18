; The module+local scalar arithmetic fixture, written by hand in 6502 for
; ACME. Observably identical to examples/slice3b/main.blend: the byte
; result (5*3)+2 = 17 at $C000 and the word result 300*2 = 600 = $0258
; little-endian at $C001/$C002. Every operand is a compile-time constant,
; so a game developer folds the arithmetic at authoring time — the runtime
; multiply machinery the compiler emits is what the parity diff measures.
!to "slice3b-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #$11
        sta $c000           ; accB = (5*3)+2 = 17
        lda #$58
        sta $c001           ; accW = 600 = $0258 - lo byte
        lda #$02
        sta $c002           ; accW hi byte
        rts
