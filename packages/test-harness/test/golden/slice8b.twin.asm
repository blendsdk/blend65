; The strings/embed data-surface fixture, written by hand in 6502 for ACME.
; Observably identical to examples/slice8b/main.blend: the PETSCII title on
; screen RAM, the embedded bit-mask table staged to $C000, the mutated
; banner at $C010, and the comparison flag at $C020 as the last write.
; Data lives in tables and moves through indexed copy loops — the idiom the
; fixture's unrolled surface stands in for. The table bytes are inlined
; (the same eight powers of two the example embeds from its binary asset).
!to "slice8b-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        ; Title "HELLO C64!" to screen RAM.
        ldx #9
copyt:  lda title,x
        sta $0400,x
        dex
        bpl copyt

        ; The embedded table to $C000.
        ldx #7
copyb:  lda table,x
        sta $c000,x
        dex
        bpl copyb

        ; The banner: 'B','I', then six fill dots.
        ldx #7
copyn:  lda banner,x
        sta $c010,x
        dex
        bpl copyn

        ; The comparison flag - main's last write.
        lda #1
        sta $c020
        rts

; ---- data (rows capped at eight bytes) ----
title:  !byte $48,$45,$4c,$4c,$4f,$20,$43,$36           ; "HELLO C6"
        !byte $34,$21                                   ; "4!"
table:  !byte $01,$02,$04,$08,$10,$20,$40,$80           ; bit masks
banner: !byte $42,$49,$2e,$2e,$2e,$2e,$2e,$2e           ; B, I, ......
