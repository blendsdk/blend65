; ============================================================================
; Blend65 Generated Assembly - blend65_demo
; Target Platform: Commodore VIC-20
; Generated: 2026-01-05T21:59:05.945Z
; ============================================================================

!cpu 6502        ; Specify processor type
!to "blend65_demo.prg",cbm  ; Output format

; BASIC Stub: 10 SYS4112
* = $1001
        !word $100D  ; Next line pointer
        !word 10        ; Line number
        !byte $9E       ; SYS token
        !text "4112"
        !byte $00       ; End of line
        !word $0000     ; End of program

; Machine code starts here
* = $1010

; Global Data Section
Main_result: !byte 0  ; Variable
Main_magic_number = 42  ; Constant

; Module: Main

; Function: main
; Parameters: 0

Main_main:
    ; Line 1:1
    LDA #42    ; Load immediate 42
    ; Line 2:1
    LDA #42    ; Load left operand
    CLC              ; Clear carry for addition
    ADC #13    ; Add right operand
    ; Line 3:1
    LDA #55    ; Load left operand
    SEC              ; Set carry for subtraction
    SBC #5    ; Subtract right operand
    ; Line 4:1
    STA $C000  ; Store to address
    ; Line 5:1
    RTS              ; Return from subroutine

; Program cleanup
RTS              ; Return to BASIC
