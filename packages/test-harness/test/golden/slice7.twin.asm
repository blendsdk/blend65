; The aggregate-surface fixture (arrays, structs, enums, query folds),
; written by hand in 6502 for ACME. Observably identical to examples/slice7
; (main.blend + gfx.blend): every aggregate result from the indexed loop
; sum to the enum->word cast's low byte. All indices and members resolve at
; authoring time, so a game developer writes the folded results — the
; aggregate addressing machinery the compiler emits is what the parity
; diff measures.
!to "slice7-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #$0e
        sta $c000           ; 1+2+3+4+4 over byte[5] = [1,2,3;4]
        lda #$2a
        sta $c001           ; player.pos.y = 42
        lda #$08
        sta $c002           ; pts[1].x = 8 (runtime index * 2)
        lda #$02
        sta $c003           ; case Direction.DOWN -> 2
        sta $c005           ; sizeof(Point) = 2 (same value, one load)
        lda #$06
        sta $c004           ; length(TABLE) = 6
        lda #$01
        sta $c006           ; offsetof(Point, y) = 1
        lda #$14
        sta $c007           ; Gfx.TABLE[1] = 20
        lda #$0b
        sta $c008           ; b.x after b = a; a.x = 99 -> still 11 (copy)
        lda #$03
        sta $c009           ; <byte>(<word>(Direction.DOWN)) = 3
        rts
