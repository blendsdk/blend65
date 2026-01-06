; ============================================================================
; Blend65 Generated Assembly - HelloWorld
; Target Platform: Commodore 64
; Generated: 2026-01-06T00:50:38.259Z
; ============================================================================

!cpu 6502        ; Specify processor type
!to "helloworld.prg",cbm  ; Output format

; BASIC Stub: 10 SYS2064
* = $0801
        !word $080D  ; Next line pointer
        !word 10        ; Line number
        !byte $9E       ; SYS token
        !text "2064"
        !byte $00       ; End of line
        !word $0000     ; End of program

; Machine code starts here
* = $0810

; Module: Hello.World

; Function: main
; Parameters: 0

Hello_World_main:
    ; Line 1:1
    JSR $E544      ; Call routine
    ; Line 1:1
    LDA #6    ; Load value to store
    STA $D020  ; Store to address
    ; Line 2:1
    LDA #0    ; Load value to store
    STA $D021  ; Store to address
    ; Line 4:1
    LDA #8    ; Load value to store
    STA $400  ; Store to address
    ; Line 5:1
    LDA #5    ; Load value to store
    STA $401  ; Store to address
    ; Line 6:1
    LDA #12    ; Load value to store
    STA $402  ; Store to address
    ; Line 7:1
    LDA #12    ; Load value to store
    STA $403  ; Store to address
    ; Line 8:1
    LDA #15    ; Load value to store
    STA $404  ; Store to address
    ; Line 9:1
    LDA #32    ; Load value to store
    STA $405  ; Store to address
    ; Line 10:1
    LDA #2    ; Load value to store
    STA $406  ; Store to address
    ; Line 11:1
    LDA #12    ; Load value to store
    STA $407  ; Store to address
    ; Line 12:1
    LDA #5    ; Load value to store
    STA $408  ; Store to address
    ; Line 13:1
    LDA #14    ; Load value to store
    STA $409  ; Store to address
    ; Line 14:1
    LDA #4    ; Load value to store
    STA $40A  ; Store to address
    ; Line 15:1
    LDA #54    ; Load value to store
    STA $40B  ; Store to address
    ; Line 16:1
    LDA #53    ; Load value to store
    STA $40C  ; Store to address
    ; Line 17:1
    LDA #33    ; Load value to store
    STA $40D  ; Store to address
    ; Line 100:1
    RTS              ; Return from subroutine

; Program cleanup
RTS              ; Return to BASIC
