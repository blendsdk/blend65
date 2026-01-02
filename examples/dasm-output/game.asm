;===============================================================================
; C64 Game Example - Compiled from Blend65
;
; This is an example of what the Blend65 compiler would generate from the
; game.blend source file shown in the README. This demonstrates the target
; assembly output with proper C64 conventions and optimizations.
;
; Assembled with DASM: dasm game.asm -f3 -ogame.prg
;===============================================================================

    processor 6502
    org $0801                   ; Standard C64 program start

;===============================================================================
; BASIC Stub - Makes this a runnable PRG file
;===============================================================================
basic_stub:
    dc.w next_line              ; Pointer to next BASIC line
    dc.w 10                     ; Line number 10
    dc.b $9e, "2061", 0        ; SYS 2061 (our start address)
next_line:
    dc.w 0                      ; End of BASIC program

;===============================================================================
; Hardware Definitions - C64 Memory Map
;===============================================================================

; VIC-II Graphics Chip ($D000-$D3FF)
VIC_BASE            = $D000
VIC_SPRITE_ENABLE   = $D015     ; Sprite enable register
VIC_SPRITE_0_X      = $D000     ; Sprite 0 X position
VIC_SPRITE_0_Y      = $D001     ; Sprite 0 Y position
VIC_SPRITE_0_COLOR  = $D027     ; Sprite 0 color
VIC_BORDER_COLOR    = $D020     ; Border color
VIC_BACKGROUND_COLOR = $D021    ; Background color

; SID Sound Chip ($D400-$D7FF)
SID_BASE            = $D400
SID_FREQ_LO_1       = $D400     ; Voice 1 frequency low byte
SID_FREQ_HI_1       = $D401     ; Voice 1 frequency high byte
SID_CONTROL_1       = $D404     ; Voice 1 control register
SID_VOLUME          = $D418     ; Volume and filter control

; CIA-1 I/O ($DC00-$DCFF)
CIA1_DATA_PORT_A    = $DC00     ; Joystick port 2
CIA1_DATA_PORT_B    = $DC01     ; Joystick port 1

;===============================================================================
; Zero Page Variables - Fast Access Memory ($00-$FF)
;===============================================================================

; Blend65 storage class: zp var joystick: byte = 0
joystick            = $02       ; Zero page for fast access

; Temporary variables for calculations
temp_lo             = $03       ; Low byte for 16-bit operations
temp_hi             = $04       ; High byte for 16-bit operations

;===============================================================================
; Game Variables - Regular RAM Storage
;===============================================================================

; Blend65 storage class: var playerX: word = 160
playerX_lo          = $0810     ; Player X position (low byte)
playerX_hi          = $0811     ; Player X position (high byte)

; Blend65 storage class: var playerY: byte = 100
playerY             = $0812     ; Player Y position

; Blend65 storage class: var gameRunning: boolean = true
gameRunning         = $0813     ; Game state flag (0=false, 1=true)

;===============================================================================
; Program Entry Point
;===============================================================================

start:
    ; Clear screen and set up display
    jsr screen_clear

    ; Initialize game variables to their Blend65 default values
    jsr init_game_vars

    ; Initialize C64 hardware
    jsr init_hardware

    ; Main game loop
main_loop:
    ; Check if game is still running
    lda gameRunning
    beq exit_program            ; Branch if gameRunning == false

    ; Handle player input
    jsr handleInput

    ; Render game state
    jsr render

    ; Wait for next frame (simple timing)
    jsr wait_frame

    ; Continue main loop
    jmp main_loop

exit_program:
    rts                         ; Return to BASIC

;===============================================================================
; Initialize Game Variables
;
; Blend65 variable initialization:
; var playerX: word = 160
; var playerY: byte = 100
; zp var joystick: byte = 0
; var gameRunning: boolean = true
;===============================================================================

init_game_vars:
    ; playerX = 160 (word initialization)
    lda #160                    ; Low byte of 160
    sta playerX_lo
    lda #0                      ; High byte of 160
    sta playerX_hi

    ; playerY = 100 (byte initialization)
    lda #100
    sta playerY

    ; joystick = 0 (zero page byte initialization)
    lda #0
    sta joystick

    ; gameRunning = true (boolean initialization)
    lda #1                      ; true = 1, false = 0
    sta gameRunning

    rts

;===============================================================================
; Initialize C64 Hardware
;
; Blend65 hardware API calls:
; setBackgroundColor(0)  // Black background
; enableSprite(0, true)
; setSpriteColor(0, 1)   // White sprite
;===============================================================================

init_hardware:
    ; setBackgroundColor(0) - Set black background
    lda #0
    sta VIC_BACKGROUND_COLOR
    sta VIC_BORDER_COLOR        ; Also set border to black

    ; enableSprite(0, true) - Enable sprite 0
    lda VIC_SPRITE_ENABLE
    ora #%00000001              ; Set bit 0 (sprite 0)
    sta VIC_SPRITE_ENABLE

    ; setSpriteColor(0, 1) - Set sprite 0 to white
    lda #1                      ; White color
    sta VIC_SPRITE_0_COLOR

    ; Set initial sprite position to playerX, playerY
    jsr update_sprite_position

    rts

;===============================================================================
; Handle Input Function
;
; Blend65 source:
; function handleInput(): void
;     joystick = joystickRead(1)  // Read joystick port 2
;
;     if (joystick & 4) == 0 then  // Left
;         playerX = playerX - 2
;     end if
;     if (joystick & 8) == 0 then  // Right
;         playerX = playerX + 2
;     end if
;     if (joystick & 16) == 0 then // Fire
;         playNote(0, 440)  // Beep sound
;     end if
; end function
;===============================================================================

handleInput:
    ; joystickRead(1) - Read joystick port 2 (CIA1_DATA_PORT_A)
    ; Note: Joystick bits are inverted (0 = pressed, 1 = not pressed)
    lda CIA1_DATA_PORT_A
    sta joystick                ; Store in zero page variable

    ; Check left movement: if (joystick & 4) == 0
check_left:
    lda joystick
    and #%00000100              ; Isolate bit 2 (left)
    bne check_right             ; Branch if bit is set (not pressed)

    ; Left pressed - playerX = playerX - 2
    sec                         ; Set carry for subtraction
    lda playerX_lo              ; Load low byte
    sbc #2                      ; Subtract 2
    sta playerX_lo              ; Store result
    lda playerX_hi              ; Load high byte
    sbc #0                      ; Subtract borrow if any
    sta playerX_hi              ; Store result

    ; Keep playerX >= 0 (boundary check)
    bpl check_right             ; Branch if positive
    lda #0                      ; Set to minimum value
    sta playerX_lo
    sta playerX_hi

check_right:
    ; Check right movement: if (joystick & 8) == 0
    lda joystick
    and #%00001000              ; Isolate bit 3 (right)
    bne check_fire              ; Branch if bit is set (not pressed)

    ; Right pressed - playerX = playerX + 2
    clc                         ; Clear carry for addition
    lda playerX_lo              ; Load low byte
    adc #2                      ; Add 2
    sta playerX_lo              ; Store result
    lda playerX_hi              ; Load high byte
    adc #0                      ; Add carry if any
    sta playerX_hi              ; Store result

    ; Keep playerX <= 320 (screen boundary check)
    cmp #1                      ; Check if high byte > 0
    bcc check_fire              ; Branch if < 256
    lda playerX_lo              ; Check if >= 320 (320 = $140)
    cmp #64                     ; 320 - 256 = 64
    bcc check_fire              ; Branch if < 320
    lda #63                     ; Set to maximum valid value
    sta playerX_lo              ; 319 = $13F
    lda #1
    sta playerX_hi

check_fire:
    ; Check fire button: if (joystick & 16) == 0
    lda joystick
    and #%00010000              ; Isolate bit 4 (fire)
    bne input_done              ; Branch if bit is set (not pressed)

    ; Fire pressed - playNote(0, 440)
    jsr play_beep_sound

input_done:
    rts

;===============================================================================
; Render Function
;
; Blend65 source:
; function render(): void
;     setSpritePosition(0, playerX, playerY)
; end function
;===============================================================================

render:
    ; setSpritePosition(0, playerX, playerY)
    jsr update_sprite_position
    rts

;===============================================================================
; Hardware API Implementations
;===============================================================================

; setSpritePosition(0, playerX, playerY) - Position sprite 0
update_sprite_position:
    ; Set sprite Y position (simple 8-bit)
    lda playerY
    sta VIC_SPRITE_0_Y

    ; Set sprite X position (9-bit value split across registers)
    lda playerX_lo              ; Get X position low byte
    sta VIC_SPRITE_0_X          ; Set VIC register

    ; Handle 9th bit for X position (for coordinates > 255)
    lda VIC_BASE + $10          ; Read sprite X MSB register
    and #%11111110              ; Clear bit 0 (sprite 0 X MSB)
    sta temp_lo                 ; Save modified value

    lda playerX_hi              ; Check if X position > 255
    beq sprite_x_low            ; Branch if high byte is 0

    ; Set 9th bit for sprite 0 X position
    lda temp_lo
    ora #%00000001              ; Set bit 0
    sta VIC_BASE + $10
    rts

sprite_x_low:
    ; Clear 9th bit for sprite 0 X position
    lda temp_lo
    sta VIC_BASE + $10
    rts

; playNote(0, 440) - Play 440Hz tone on SID voice 1
play_beep_sound:
    ; Calculate SID frequency value for 440Hz
    ; SID freq = (desired_freq * 65536) / 985248
    ; For 440Hz: freq_value = 28633 ($6FD9)

    ; Set voice 1 frequency
    lda #$D9                    ; Low byte of 28633
    sta SID_FREQ_LO_1
    lda #$6F                    ; High byte of 28633
    sta SID_FREQ_HI_1

    ; Set volume to maximum
    lda #15                     ; Volume 15 (maximum)
    sta SID_VOLUME

    ; Start the note (sawtooth wave)
    lda #%00100001              ; Sawtooth wave + gate on
    sta SID_CONTROL_1

    ; Brief delay to let note sound
    jsr short_delay

    ; Stop the note
    lda #%00100000              ; Sawtooth wave + gate off
    sta SID_CONTROL_1

    rts

;===============================================================================
; Utility Functions
;===============================================================================

; Simple screen clear
screen_clear:
    lda #147                    ; Clear screen character
    jsr $FFD2                   ; CHROUT kernal routine
    rts

; Wait for vertical retrace (simple timing)
wait_frame:
    lda #60                     ; Wait counter
wait_loop:
    cmp VIC_BASE + $12          ; Compare with raster line
    bne wait_loop
    rts

; Short delay for sound
short_delay:
    ldx #255
delay_outer:
    ldy #100
delay_inner:
    dey
    bne delay_inner
    dex
    bne delay_outer
    rts

;===============================================================================
; End of Program
;===============================================================================
