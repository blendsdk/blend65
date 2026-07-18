; The switch fixture, written by hand in 6502 for ACME. Observably
; identical to examples/slice4b/main.blend: Switch A's multi-value case +
; fallthrough + auto-break result (25) at $C000, Switch B's default-path
; result (7) at $C001. Both selectors are compile-time constants, so a
; game developer writes the folded results — the compare-chain dispatch
; the compiler emits is what the parity diff measures.
!to "slice4b-twin.prg", cbm

; ---- BASIC stub: 10 SYS 2061 ----
* = $0801
        !byte $0c,$08, $0a,$00, $9e, $32,$30,$36,$31, $00, $00,$00

; ---- program entry ($080d) ----
* = $080d
start:
        lda #$19
        sta $c000           ; case 2,3 (20) --fallthrough--> case 4 (+5) = 25
        lda #$07
        sta $c001           ; sel2=9 matches no case -> default -> 7
        rts
