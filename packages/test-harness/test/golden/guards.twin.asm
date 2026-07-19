; The guard catalogue, written by hand in 6502 for ACME: one frame-locked
; update body carrying four branch shapes - a compound unsigned window test,
; a negated flag, a signed velocity compare, and a short-circuit whose right
; clause reads a hardware port - each leaving its verdict in screen RAM.
; Observably identical to examples/guards/main.blend.
!to "guards-twin.prg", cbm

; ---- zero-page state ----
frame  = $02        ; frame counter
active = $03        ; 1 = the sprite has work this frame
armed  = $04        ; 1 = the input port may be read
dx     = $05        ; horizontal drift, signed
dy     = $06        ; vertical fall, signed

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0b,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        ; This loop owns the machine: silence CIA-1 so the KERNAL's keyboard
        ; scan stops rewriting port A, then drive the port and park it -
        ; column 7 down, every other line released - so the input guard
        ; reads a known value.
        lda #$7f
        sta $dc0d
        sta $dc00
        lda #$ff
        sta $dc02

        lda #0
        sta frame
        sta active          ; parked: nothing to animate
        lda #1
        sta armed
        lda #$fd            ; -3
        sta dx
        lda #2
        sta dy

mainloop:
        ; One update per PAL frame: hold until the raster reaches line 251.
raster: lda $d012
        cmp #251
        bne raster

        ; Frame body - entered exactly once per frame.
update:
        ; --- sprite window: count the column probes inside [8,40) ---
        ; A walks the probes, Y counts the hits. The probe indexes nothing,
        ; so it never needs to leave A. The upper bound is only asked about
        ; once the lower bound holds.
        lda #0
        ldy #0
band:   cmp #8
        bcc step            ; below the band
        cmp #40
        bcs step            ; at or past the top
        iny
step:   clc
        adc #8
        cmp #64
        bcc band
        sty $0400

        ; --- nothing to animate while the sprite is parked ---
        ldx #1
        lda active
        beq parked
        ldx #2
parked: stx $0401

        ; --- signed velocity: is the drift steeper than the fall? ---
        ldx #4
        lda dx
        sec
        sbc dy
        bvc sign            ; N is the sign of the difference...
        eor #$80            ; ...unless the subtraction overflowed
sign:   bpl steady
        ldx #3
steady: stx $0402

        ; --- the port is only read once the sprite is armed ---
        ldx #6
        lda armed
        beq quiet
        lda $dc00
        cmp #127
        bne quiet
        ldx #5
quiet:  stx $0403

        ; --- frame heartbeat in the border ---
        inc frame
        lda frame
        sta $d020
        jmp mainloop
