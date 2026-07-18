; The pointer fixture (by-ref params, zero-page pairs, tier-2 word
; indexing), written by hand in 6502 for ACME. Observably identical to
; examples/slice7b (main.blend + game.blend): the by-ref mutation chain,
; the nested member write, the const-param sum, the runtime word index at
; 260 with its low-range integrity proof, and the whole-struct copy. Every
; path resolves at authoring time, so a game developer writes the folded
; results — the pointer-formation machinery the compiler emits is what the
; parity diff measures.
!to "slice7b-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #$00
        sta $c000           ; boss.hp after relay -> resetEnemy
        lda #$2a
        sta $c001           ; boss.pos.y = 42 through the pair
        lda #$0f
        sta $c002           ; sum(TABLE, length(TABLE)) = 3+5+7
        lda #$1d
        sta $c003           ; big[260] via the runtime word index
        lda #$11
        sta $c004           ; big[4] via the const index - not aliased by 260
        lda #$0b
        sta $c005           ; b.x after copyPoint(b, a); a.x = 99 -> still 11
        lda #$16
        sta $c006           ; b.y
        rts
