; Hand-written expert twin for examples/boing-ball.
;
; The program implements the same visible behavior as src/main.blend:
; four unexpanded multicolor sprites in a 2x2 ball, pointer-swap animation
; with a colour inversion at the half cycle, 2px movement and 9-bit X bounce.
;
; It exists as the parity benchmark: the compiler output must meet or beat a
; competent hand-written version. Assemble with ACME from this directory:
;   acme -o twin.prg -f cbm twin.asm

!to "twin.prg", cbm
!cpu 6502

; 10 SYS 2061
* = $0801
!byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $31, $00, $00, $00

* = $080d

xlo = $02
xhi = $03
y = $04
right = $05
down = $06
frame = $07
swapped = $08
tick = $09
base = $0a
xrlo = $0b
xrhi = $0c
msb = $0d

start:
  lda #15
  sta $d01c
  lda #0
  sta $d017
  sta $d01d
  sta $d026
  lda #14
  sta $d021
  sta $d020
  lda #1
  sta $d025
  lda #2
  sta $d027
  sta $d028
  sta $d029
  sta $d02a

  ; ball.bin is placed at $2000, so the first block number is $80.
  lda #$80
  sta base
  lda #100
  sta xlo
  lda #0
  sta xhi
  lda #90
  sta y
  lda #1
  sta right
  sta down
  lda #0
  sta frame
  sta swapped
  sta tick

  jsr positions
  ; Enable before entering the pointer section: that section falls through
  ; into the per-frame tail, so it is the loop's entry, not a returnable call.
  lda #15
  sta $d015
  jsr pointers

loop:
wait:
  lda $d012
  cmp #$fb
  bne wait
framePoint:
  ; x += right ? 2 : -2
  lda right
  beq xleft
  lda xlo
  clc
  adc #2
  sta xlo
  bcc xdone
  inc xhi
  jmp xdone
xleft:
  lda xlo
  sec
  sbc #2
  sta xlo
  bcs xdone
  dec xhi
xdone:
  ; y += down ? 2 : -2
  lda down
  beq yup
  inc y
  inc y
  jmp ydone
yup:
  dec y
  dec y
ydone:
  ; right edge: x >= $0128
  lda xhi
  cmp #1
  bcc xcheckleft
  bne xsetleft
  lda xlo
  cmp #$28
  bcs xsetleft
xcheckleft:
  lda xhi
  bne xboundsdone
  lda xlo
  cmp #$19
  bcs xboundsdone
  lda #1
  sta right
  jmp xboundsdone
xsetleft:
  lda #0
  sta right
xboundsdone:
  ; bottom edge: y >= $bc
  lda y
  cmp #$bc
  bcc ychecktop
  lda #0
  sta down
  jmp yboundsdone
ychecktop:
  lda y
  cmp #$33
  bcs yboundsdone
  lda #1
  sta down
yboundsdone:
  inc tick
  lda tick
  cmp #2
  bcc afterrotate
  lda #0
  sta tick

  lda right
  beq rotateleft
  inc frame
  lda frame
  cmp #4
  bcc rotatecolors
  lda #0
  sta frame
  lda swapped
  eor #1
  sta swapped
  jmp rotatecolors
rotateleft:
  lda frame
  bne decframe
  lda #3
  sta frame
  lda swapped
  eor #1
  sta swapped
  jmp rotatecolors
decframe:
  dec frame

rotatecolors:
  lda swapped
  beq colorsnormal
  lda #2
  sta $d025
  lda #1
  sta $d027
  sta $d028
  sta $d029
  sta $d02a
  jmp pointers
colorsnormal:
  lda #1
  sta $d025
  lda #2
  sta $d027
  sta $d028
  sta $d029
  sta $d02a

pointers:
  lda frame
  asl
  asl
  clc
  adc base
  sta $07f8
  clc
  adc #1
  sta $07f9
  clc
  adc #1
  sta $07fa
  clc
  adc #1
  sta $07fb

afterrotate:
  jsr positions
  jmp loop

positions:
  lda xlo
  clc
  adc #24
  sta xrlo
  lda xhi
  adc #0
  sta xrhi

  lda #0
  sta msb
  lda xhi
  beq nolow
  lda #5
  sta msb
nolow:
  lda xrhi
  beq noright
  lda msb
  ora #10
  sta msb
noright:
  lda xlo
  sta $d000
  sta $d004
  lda xrlo
  sta $d002
  sta $d006
  lda y
  sta $d001
  sta $d003
  clc
  adc #21
  sta $d005
  sta $d007
  lda msb
  sta $d010
  rts
codeEnd:

* = $2000
!binary "assets/ball.bin"
