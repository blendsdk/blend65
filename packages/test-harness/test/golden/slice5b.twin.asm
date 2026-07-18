; The module-system fixture (one module across two files, qualified access,
; cross-module initializer ordering), written by hand in 6502 for ACME.
; Observably identical to examples/slice5b: add(2,3)=5, Math.twice(4)=8,
; combo=7 (initialized from Math.scaled+1 BEFORE main), Math.base=$0102 and
; base+1=$0103 little-endian. Everything reduces to constants at authoring
; time, so a game developer writes the folded results — the merged-module
; init routine the compiler emits is what the parity diff measures.
!to "slice5b-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #$05
        sta $c000           ; add(2, 3) = 5
        lda #$08
        sta $c001           ; Math.twice(4) = add(4, 4) = 8
        lda #$07
        sta $c002           ; combo = Math.scaled + 1 = 7 (initializer order)
        lda #$02
        sta $c003           ; Math.base = $0102 - lo byte
        lda #$01
        sta $c004           ; Math.base hi byte
        sta $c006           ; Math.base + 1 hi byte (same value, one load)
        lda #$03
        sta $c005           ; Math.base + 1 = $0103 - lo byte
        rts
