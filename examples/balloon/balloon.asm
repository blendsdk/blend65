; The bouncing balloon, written by hand in 6502 for ACME.
; Functionally identical to examples/balloon/main.blend, but the
; sprite copy is a real 4-instruction loop instead of 63 unrolled stores.
!to "balloon-asm.prg", cbm

; ---- zero-page state ----
xlo  = $fb          ; sprite X, low byte
xhi  = $fc          ; sprite X, high byte (only bit 0 ever used: X is 0..320)
ypos = $fd          ; sprite Y
xdir = $fe          ; 1 = moving right, 0 = moving left
ydir = $02          ; 1 = moving down,  0 = moving up

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        ; Copy the 63 sprite bytes into $0340. THIS is the loop the
        ; 63 pokes stand in for — one indexed store, X from 62 down to 0.
        ldx #62
copy:   lda balloon,x
        sta $0340,x
        dex
        bpl copy

        ; Configure sprite 0.
        lda #13
        sta $07f8           ; pointer: block 13 * 64 = $0340
        lda #%00000001
        sta $d015           ; enable sprite 0
        lda #1
        sta $d027           ; colour = white
        lda #0
        sta $d017           ; no vertical expand
        sta $d01c           ; hi-res (not multicolour)
        sta $d01d           ; no horizontal expand

        ; Initial position 172,139 drifting down-right.
        lda #<172
        sta xlo
        lda #>172
        sta xhi
        lda #139
        sta ypos
        lda #1
        sta xdir
        sta ydir

mainloop:
        ; One update per frame: hold until raster reaches line 251.
raster: lda $d012
        cmp #251
        bne raster

        ; --- advance X by the current direction (16-bit inc/dec) ---
        lda xdir
        beq xleft
        inc xlo
        bne xdone
        inc xhi
        jmp xdone
xleft:  lda xlo
        bne xnb
        dec xhi
xnb:    dec xlo
xdone:

        ; --- advance Y ---
        lda ydir
        beq yup
        inc ypos
        jmp ydone
yup:    dec ypos
ydone:

        ; --- bounce X at 320 ($0140) and 24 ---
        lda xhi
        cmp #$01
        bne chk24
        lda xlo
        cmp #$40
        bne chk24
        lda #0
        sta xdir            ; hit right edge -> go left
chk24:  lda xhi
        bne chky            ; xhi != 0 can't equal 24
        lda xlo
        cmp #24
        bne chky
        lda #1
        sta xdir            ; hit left edge -> go right

        ; --- bounce Y at 229 and 50 ---
chky:   lda ypos
        cmp #229
        bne chk50
        lda #0
        sta ydir
chk50:  lda ypos
        cmp #50
        bne vic
        lda #1
        sta ydir

        ; --- write position to the VIC ---
vic:    lda xlo
        sta $d000
        lda xhi
        sta $d010           ; bit 0 = sprite 0 X MSB
        lda ypos
        sta $d001
        jmp mainloop

; the same 63 bytes the Blend65 demo embeds
balloon:
        !bin "balloon.bin"
