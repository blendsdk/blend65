; Cycle-measurement demo: a phase-locked window spanning its own raster IRQ.
;
; Hand-written ACME source (assemble: acme --cpu 6510 --format cbm
; --vicelabels demo.lbl -o demo.prg measure-irq-demo.asm). PAL C64.
;
; The program takes over the machine (interrupts masked, ROMs banked out,
; display blanked), installs its own raster interrupt at line 100, then
; synchronises to raster line 250 before entering the measured window
; demo_from..demo_to. Because the window entry is raster-synced, the display
; is blanked (no badline DMA stalls), and the only interrupt source is the
; VIC raster IRQ, the window's elapsed machine-cycle count is identical on
; every fresh emulator process — and fully hand-computable:
;
;   straight-line sum demo_from..demo_to  = 51441 cycles   (loop math below)
;   raster IRQs inside the window         = 3 × 31 cycles  (7-cycle interrupt
;                                           sequence + 24-cycle handler)
;   expected measured total               = 51534 cycles
;
; The window spans ~2.6 PAL frames (19656 cycles each); the first IRQ falls
; ~10.2k cycles after entry and the third ~2k cycles before exit, so the
; count of 3 is safe against the few-cycle raster-sync jitter.
;
; All loop branches stay inside one page (no page-cross penalty applies).

counter = $02                   ; frames seen by the IRQ handler
marker  = $03                   ; window-exit marker

* = $0801
; BASIC stub: 10 SYS 2061
!byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $31, $00, $00, $00

start   sei
        lda #$35                ; bank out BASIC+KERNAL, keep I/O ($D000-$DFFF)
        sta $01                 ; hardware vectors now read from RAM
        lda #$7f
        sta $dc0d               ; mask every CIA-1 interrupt source
        sta $dd0d               ; and every CIA-2 NMI source
        lda $dc0d               ; ack anything already pending
        lda $dd0d
        lda #$0b                ; display off (DEN=0), text mode, raster MSB=0
        sta $d011
        lda #100
        sta $d012               ; raster interrupt at line 100
        lda #<irq
        sta $fffe
        lda #>irq
        sta $ffff               ; hardware IRQ vector -> our handler
        lda #$01
        sta $d01a               ; enable the raster interrupt
        sta $d019               ; ack any pending raster interrupt
        lda #$00
        sta counter
        cli

; Phase-lock: enter the window at raster line 250 (far from the IRQ line),
; so the window sees the same interrupt phase on every fresh process.
        lda #250
sync    cmp $d012
        bne sync

; ---- measured window ------------------------------------------------------
; ldy #40                                    2
; 40 outer iterations:
;   ldx #0                                   2
;   inner: 256 x (dex 2 + bne 3/2) = 255*5+4 = 1279
;   dey                                      2
;   bne outer            3 taken (x39) / 2 on the final fall-through
; total: 2 + 39*1286 + 1285 = 51441
demo_from
        ldy #40
outer   ldx #0
inner   dex
        bne inner
        dey
        bne outer
demo_to
        lda #$ff                ; executed once, right after the window
        sta marker
demo_idle
        nop                     ; 2 \ 5-cycle idle traversal, one full loop
        jmp demo_idle           ; 3 /  per arrival at demo_idle

demo_unreached
        rts                     ; a real symbol the program never reaches

; Raster IRQ handler: ack, count the frame, return.
; 24 cycles: pha 3, lda # 2, sta abs 4, inc zp 5, pla 4, rti 6
; (+7 for the CPU interrupt sequence = 31 per interrupt).
irq     pha
        lda #$01
        sta $d019               ; ack the raster interrupt
        inc counter
        pla
        rti
