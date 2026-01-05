; ============================================================================
; Blend65 Generated Assembly - hello_blend65
; Target Platform: Commodore 64
; Generated: 2026-01-05T22:50:08.643Z
; ============================================================================

!cpu 6502        ; Specify processor type
!to "hello_blend65.prg",cbm  ; Output format

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

; Module: Hello

; Function: main
; Parameters: 0

Hello_main:
    LDA #72    ; Load immediate 72
    STA $400  ; Store to address
    LDA #69    ; Load immediate 69
    STA $401  ; Store to address
    LDA #76    ; Load immediate 76
    STA $402  ; Store to address
    LDA #76    ; Load immediate 76
    STA $403  ; Store to address
    LDA #79    ; Load immediate 79
    STA $404  ; Store to address
    LDA #32    ; Load immediate 32
    STA $405  ; Store to address
    LDA #66    ; Load immediate 66
    STA $406  ; Store to address
    LDA #76    ; Load immediate 76
    STA $407  ; Store to address
    LDA #69    ; Load immediate 69
    STA $408  ; Store to address
    LDA #78    ; Load immediate 78
    STA $409  ; Store to address
    LDA #68    ; Load immediate 68
    STA $40A  ; Store to address
    LDA #54    ; Load immediate 54
    STA $40B  ; Store to address
    LDA #53    ; Load immediate 53
    STA $40C  ; Store to address
    LDA #33    ; Load immediate 33
    STA $40D  ; Store to address
    LDA #6    ; Load immediate 6
    STA $D020  ; Store to address
    LDA #0    ; Load immediate 0
    STA $D021  ; Store to address
    RTS              ; Return from subroutine

; Program cleanup
RTS              ; Return to BASIC
