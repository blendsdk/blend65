; ============================================================================
; Blend65 Generated Assembly - blend65_success
; Target Platform: Commodore VIC-20
; Generated: 2026-01-05T22:01:09.065Z
; ============================================================================

!cpu 6502        ; Specify processor type
!to "blend65_success.prg",cbm  ; Output format

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

; Module: Main

; Function: main
; Parameters: 0

Main_main:
    LDA #42    ; Load immediate 42
    RTS              ; Return from subroutine

; Program cleanup
RTS              ; Return to BASIC
