; The raster-interrupt fixture, written by hand in 6502 for ACME: a VIC
; raster IRQ bumps the border colour once per frame through a SATURATING
; zero-page counter — 100 bumps from the boot colour 14, then the handler
; goes quiet, so the border settles at (14+100) mod 16 = 2 and reads back
; $F2 forever. Observably identical to examples/slice8/main.blend; the
; saturation is genuine (the landmark must settle, not transiently match).
; Classic KERNAL-vector idiom: hook $0314, ack $D019, continue at $EA31.
!to "slice8-twin.prg", cbm

; ---- zero-page state ----
count = $02          ; interrupt counter, saturating at 100

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        sei
        lda #0
        sta count
        lda #$7f
        sta $dc0d           ; mute CIA#1 interrupts
        lda $dc0d           ; ack anything pending
        lda #1
        sta $d01a           ; enable VIC raster interrupts
        lda #251
        sta $d012           ; fire just below the visible area
        lda $d011
        and #$7f
        sta $d011           ; raster compare high bit = 0
        lda #<irq
        sta $0314
        lda #>irq
        sta $0315
        cli

        ; The mainline has nothing to do - the handler owns the border.
loop:   jmp loop

; ---- raster handler: bump the border until the counter saturates ----
irq:    lda count
        cmp #100
        bcs done            ; saturated - stop moving the border
        inc count
        inc $d020
done:   asl $d019           ; ack the VIC interrupt
        jmp $ea31           ; continue the KERNAL IRQ path
