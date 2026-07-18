; The minimal frame-locked program, written by hand in 6502 for ACME:
; poll $D012 until the raster reaches line 251 (just below the visible
; area), run the frame body — heartbeat counter to screen RAM plus the
; border colour — and loop forever. Observably identical to
; examples/rasterpoll/main.blend. The update body outlasts one raster
; line, so it cannot double-fire within a frame.
!to "rasterpoll-twin.prg", cbm

; ---- zero-page state ----
count = $02          ; frame counter

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #0
        sta count

mainloop:
        ; One iteration per PAL frame: hold until raster line 251.
raster: lda $d012
        cmp #251
        bne raster

        ; Frame body - entered exactly once per frame.
update: inc count
        lda count
        sta $0400           ; heartbeat in screen RAM
        sta $d020           ; border colour: the classic raster-poll proof
        jmp mainloop
