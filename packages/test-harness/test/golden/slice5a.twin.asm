; The two-module calling-convention fixture, written by hand in 6502 for
; ACME. Observably identical to examples/slice5a (main.blend + math.blend):
; add(10,7) = 17 at $C000, triple(300) = 900 = $0384 little-endian at
; $C001/$C002, and combo(5) = 16 at $C003. Every call takes constant
; arguments, so a game developer writes the folded results — the frames,
; argument stores, and JSR chains the compiler emits are what the parity
; diff measures.
!to "slice5a-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #$11
        sta $c000           ; add(10, 7) = 17
        lda #$84
        sta $c001           ; triple(300) = 900 = $0384 - lo byte
        lda #$03
        sta $c002           ; hi byte
        lda #$10
        sta $c003           ; combo(5): t = add(5,3) = 8; t + t = 16
        rts
