; ============================================================================
; Blend65 Generated Assembly - HelloWorld
; Target Platform: Commodore 64
; Generated: 2026-01-06T00:24:11.359Z
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
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $400  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $401  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $402  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $403  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $404  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $405  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $406  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $407  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $408  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $409  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $40A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $40B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $40C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $40D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $40E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $40F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $410  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $411  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $412  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $413  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $414  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $415  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $416  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $417  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $418  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $419  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $41A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $41B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $41C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $41D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $41E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $41F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $420  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $421  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $422  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $423  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $424  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $425  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $426  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $427  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $428  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $429  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $42A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $42B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $42C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $42D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $42E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $42F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $430  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $431  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $432  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $433  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $434  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $435  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $436  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $437  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $438  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $439  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $43A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $43B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $43C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $43D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $43E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $43F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $440  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $441  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $442  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $443  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $444  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $445  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $446  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $447  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $448  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $449  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $44A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $44B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $44C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $44D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $44E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $44F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $450  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $451  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $452  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $453  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $454  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $455  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $456  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $457  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $458  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $459  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $45A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $45B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $45C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $45D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $45E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $45F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $460  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $461  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $462  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $463  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $464  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $465  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $466  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $467  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $468  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $469  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $46A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $46B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $46C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $46D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $46E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $46F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $470  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $471  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $472  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $473  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $474  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $475  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $476  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $477  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $478  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $479  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $47A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $47B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $47C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $47D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $47E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $47F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $480  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $481  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $482  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $483  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $484  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $485  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $486  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $487  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $488  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $489  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $48A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $48B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $48C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $48D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $48E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $48F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $490  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $491  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $492  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $493  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $494  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $495  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $496  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $497  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $498  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $499  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $49A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $49B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $49C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $49D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $49E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $49F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4A9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4AA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4AB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4AC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4AD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4AE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4AF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4B9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4BA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4BB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4BC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4BD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4BE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4BF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4C9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4CA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4CB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4CC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4CD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4CE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4CF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4D9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4DA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4DB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4DC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4DD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4DE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4DF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4E9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4EA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4EB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4EC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4ED  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4EE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4EF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4F9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4FA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4FB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4FC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4FD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4FE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $4FF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $500  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $501  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $502  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $503  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $504  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $505  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $506  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $507  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $508  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $509  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $50A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $50B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $50C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $50D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $50E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $50F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $510  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $511  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $512  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $513  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $514  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $515  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $516  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $517  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $518  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $519  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $51A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $51B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $51C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $51D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $51E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $51F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $520  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $521  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $522  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $523  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $524  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $525  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $526  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $527  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $528  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $529  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $52A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $52B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $52C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $52D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $52E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $52F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $530  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $531  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $532  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $533  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $534  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $535  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $536  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $537  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $538  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $539  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $53A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $53B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $53C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $53D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $53E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $53F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $540  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $541  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $542  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $543  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $544  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $545  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $546  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $547  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $548  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $549  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $54A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $54B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $54C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $54D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $54E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $54F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $550  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $551  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $552  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $553  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $554  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $555  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $556  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $557  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $558  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $559  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $55A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $55B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $55C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $55D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $55E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $55F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $560  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $561  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $562  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $563  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $564  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $565  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $566  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $567  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $568  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $569  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $56A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $56B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $56C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $56D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $56E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $56F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $570  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $571  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $572  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $573  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $574  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $575  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $576  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $577  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $578  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $579  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $57A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $57B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $57C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $57D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $57E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $57F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $580  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $581  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $582  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $583  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $584  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $585  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $586  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $587  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $588  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $589  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $58A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $58B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $58C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $58D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $58E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $58F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $590  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $591  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $592  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $593  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $594  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $595  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $596  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $597  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $598  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $599  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $59A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $59B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $59C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $59D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $59E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $59F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5A9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5AA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5AB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5AC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5AD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5AE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5AF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5B9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5BA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5BB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5BC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5BD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5BE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5BF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5C9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5CA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5CB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5CC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5CD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5CE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5CF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5D9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5DA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5DB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5DC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5DD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5DE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5DF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5E9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5EA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5EB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5EC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5ED  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5EE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5EF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5F9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5FA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5FB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5FC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5FD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5FE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $5FF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $600  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $601  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $602  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $603  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $604  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $605  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $606  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $607  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $608  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $609  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $60A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $60B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $60C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $60D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $60E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $60F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $610  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $611  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $612  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $613  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $614  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $615  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $616  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $617  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $618  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $619  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $61A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $61B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $61C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $61D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $61E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $61F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $620  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $621  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $622  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $623  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $624  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $625  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $626  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $627  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $628  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $629  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $62A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $62B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $62C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $62D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $62E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $62F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $630  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $631  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $632  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $633  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $634  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $635  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $636  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $637  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $638  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $639  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $63A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $63B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $63C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $63D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $63E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $63F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $640  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $641  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $642  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $643  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $644  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $645  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $646  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $647  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $648  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $649  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $64A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $64B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $64C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $64D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $64E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $64F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $650  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $651  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $652  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $653  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $654  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $655  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $656  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $657  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $658  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $659  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $65A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $65B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $65C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $65D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $65E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $65F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $660  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $661  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $662  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $663  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $664  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $665  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $666  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $667  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $668  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $669  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $66A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $66B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $66C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $66D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $66E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $66F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $670  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $671  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $672  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $673  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $674  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $675  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $676  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $677  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $678  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $679  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $67A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $67B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $67C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $67D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $67E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $67F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $680  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $681  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $682  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $683  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $684  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $685  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $686  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $687  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $688  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $689  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $68A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $68B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $68C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $68D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $68E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $68F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $690  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $691  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $692  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $693  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $694  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $695  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $696  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $697  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $698  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $699  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $69A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $69B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $69C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $69D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $69E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $69F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6A9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6AA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6AB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6AC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6AD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6AE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6AF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6B9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6BA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6BB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6BC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6BD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6BE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6BF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6C9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6CA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6CB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6CC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6CD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6CE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6CF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6D9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6DA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6DB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6DC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6DD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6DE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6DF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6E9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6EA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6EB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6EC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6ED  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6EE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6EF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6F9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6FA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6FB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6FC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6FD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6FE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $6FF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $700  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $701  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $702  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $703  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $704  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $705  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $706  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $707  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $708  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $709  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $70A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $70B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $70C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $70D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $70E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $70F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $710  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $711  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $712  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $713  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $714  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $715  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $716  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $717  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $718  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $719  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $71A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $71B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $71C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $71D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $71E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $71F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $720  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $721  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $722  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $723  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $724  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $725  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $726  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $727  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $728  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $729  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $72A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $72B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $72C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $72D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $72E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $72F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $730  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $731  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $732  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $733  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $734  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $735  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $736  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $737  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $738  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $739  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $73A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $73B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $73C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $73D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $73E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $73F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $740  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $741  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $742  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $743  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $744  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $745  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $746  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $747  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $748  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $749  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $74A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $74B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $74C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $74D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $74E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $74F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $750  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $751  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $752  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $753  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $754  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $755  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $756  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $757  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $758  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $759  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $75A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $75B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $75C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $75D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $75E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $75F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $760  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $761  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $762  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $763  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $764  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $765  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $766  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $767  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $768  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $769  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $76A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $76B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $76C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $76D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $76E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $76F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $770  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $771  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $772  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $773  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $774  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $775  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $776  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $777  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $778  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $779  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $77A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $77B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $77C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $77D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $77E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $77F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $780  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $781  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $782  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $783  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $784  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $785  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $786  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $787  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $788  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $789  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $78A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $78B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $78C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $78D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $78E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $78F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $790  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $791  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $792  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $793  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $794  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $795  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $796  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $797  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $798  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $799  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $79A  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $79B  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $79C  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $79D  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $79E  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $79F  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7A9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7AA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7AB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7AC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7AD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7AE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7AF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7B9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7BA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7BB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7BC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7BD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7BE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7BF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7C9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7CA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7CB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7CC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7CD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7CE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7CF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D7  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D8  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7D9  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7DA  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7DB  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7DC  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7DD  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7DE  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7DF  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7E0  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7E1  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7E2  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7E3  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7E4  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7E5  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7E6  ; Store to address
    ; Line 2:1
    LDA #32    ; Load value to store
    STA $7E7  ; Store to address
    ; Line 3:1
    LDA #6    ; Load value to store
    STA $D020  ; Store to address
    ; Line 4:1
    LDA #0    ; Load value to store
    STA $D021  ; Store to address
    ; Line 5:1
    LDA #72    ; Load value to store
    STA $400  ; Store to address
    ; Line 6:1
    LDA #69    ; Load value to store
    STA $401  ; Store to address
    ; Line 7:1
    LDA #76    ; Load value to store
    STA $402  ; Store to address
    ; Line 8:1
    LDA #76    ; Load value to store
    STA $403  ; Store to address
    ; Line 9:1
    LDA #79    ; Load value to store
    STA $404  ; Store to address
    ; Line 10:1
    LDA #32    ; Load value to store
    STA $405  ; Store to address
    ; Line 11:1
    LDA #66    ; Load value to store
    STA $406  ; Store to address
    ; Line 12:1
    LDA #76    ; Load value to store
    STA $407  ; Store to address
    ; Line 13:1
    LDA #69    ; Load value to store
    STA $408  ; Store to address
    ; Line 14:1
    LDA #78    ; Load value to store
    STA $409  ; Store to address
    ; Line 15:1
    LDA #68    ; Load value to store
    STA $40A  ; Store to address
    ; Line 16:1
    LDA #54    ; Load value to store
    STA $40B  ; Store to address
    ; Line 17:1
    LDA #53    ; Load value to store
    STA $40C  ; Store to address
    ; Line 18:1
    LDA #33    ; Load value to store
    STA $40D  ; Store to address
    ; Line 100:1
    RTS              ; Return from subroutine

; Program cleanup
RTS              ; Return to BASIC
