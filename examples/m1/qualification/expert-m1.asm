; Independent hand-authored ACME 0.97 baseline for the complete M1 behavior.
; Documented NMOS 6502 instructions only; the C64's 6510 port is handled explicitly.

!cpu 6502

CPU_DDR = $0000
CPU_PORT = $0001

VIC_SPRITE_X0 = $d000
VIC_SPRITE_X_MSB = $d010
VIC_SPRITE_ENABLE = $d015
VIC_SPRITE_Y_EXPAND = $d017
VIC_MEMORY = $d018
VIC_SPRITE_PRIORITY = $d01b
VIC_SPRITE_MULTICOLOR = $d01c
VIC_SPRITE_X_EXPAND = $d01d
VIC_BORDER = $d020
VIC_BACKGROUND = $d021
VIC_SPRITE_COLOR0 = $d027
VIC_RASTER = $d012

CIA1_PORT_A = $dc00
CIA2_PORT_A = $dd00
CIA2_DDR_A = $dd02

SCREEN_SPRITE_POINTER0 = $07f8
SPRITE_BASE = $2000
SPRITE_BLOCK = SPRITE_BASE / 64

SLOT_IDLE = 0
SLOT_PROJECTILE = 1
SLOT_EXPLOSION = 2
OUTCOME_PLAYING = 0
OUTCOME_WON = 1
OUTCOME_LOST = 2

* = $0801
expert_prg_start:
    !word expert_basic_end
    !word 10
    !byte $9e
    !byte $32, $30, $36, $31 ; SYS 2061 ($080d)
    !byte 0
expert_basic_end:
    !word 0

expert_entry:
    sta saved_a
    stx saved_x
    sty saved_y
    php
    pla
    sta saved_status
    tsx
    stx saved_stack

    lda CPU_DDR
    sta saved_cpu_ddr
    lda CPU_PORT
    sta saved_cpu_port

    ; Keep KERNAL and I/O visible. Update the data latch before its direction.
    sei
    lda saved_cpu_port
    ora #$07
    sta CPU_PORT
    lda saved_cpu_ddr
    ora #$07
    sta CPU_DDR

    lda CIA2_PORT_A
    sta saved_cia2_port
    lda CIA2_DDR_A
    sta saved_cia2_ddr
    lda VIC_MEMORY
    sta saved_vic_memory
    lda VIC_SPRITE_ENABLE
    sta saved_sprite_enable
    lda VIC_SPRITE_X_MSB
    sta saved_sprite_x_msb
    lda VIC_SPRITE_Y_EXPAND
    sta saved_sprite_y_expand
    lda VIC_SPRITE_PRIORITY
    sta saved_sprite_priority
    lda VIC_SPRITE_MULTICOLOR
    sta saved_sprite_multicolor
    lda VIC_SPRITE_X_EXPAND
    sta saved_sprite_x_expand
    lda VIC_BORDER
    sta saved_border
    lda VIC_BACKGROUND
    sta saved_background

    ldx #15
expert_save_positions:
    lda VIC_SPRITE_X0,x
    sta saved_sprite_positions,x
    dex
    bpl expert_save_positions

    ldx #7
expert_save_colors_and_pointers:
    lda VIC_SPRITE_COLOR0,x
    sta saved_sprite_colors,x
    lda SCREEN_SPRITE_POINTER0,x
    sta saved_sprite_pointers,x
    dex
    bpl expert_save_colors_and_pointers

    ; Bank 0, screen at $0400, ROM charset at $1000, hires/unexpanded sprites.
    lda saved_cia2_port
    ora #$03
    sta CIA2_PORT_A
    lda saved_cia2_ddr
    ora #$03
    sta CIA2_DDR_A
    lda #$14
    sta VIC_MEMORY
    lda #0
    sta VIC_SPRITE_ENABLE
    sta VIC_SPRITE_Y_EXPAND
    sta VIC_SPRITE_PRIORITY
    sta VIC_SPRITE_MULTICOLOR
    sta VIC_SPRITE_X_EXPAND
    sta VIC_BORDER
    sta VIC_BACKGROUND

    cld
    cli

expert_main_loop:
    jsr expert_wait_next_frame

; The automated runtime observer stops here before supplying the next joystick sample.
expert_frame_checkpoint:
    lda CIA1_PORT_A
    sta joystick_sample

    lda #0
    sta current_fire
    sta fire_edge
    lda joystick_sample
    and #$10
    bne expert_fire_ready
    inc current_fire
    lda previous_fire
    bne expert_fire_ready
    inc fire_edge
expert_fire_ready:
    lda outcome
    bne expert_terminal_update

    jsr expert_update_player
    jsr expert_advance_slot
    jsr expert_advance_formation
    jsr expert_resolve_hit

    lda slot_state
    bne expert_no_spawn
    lda fire_edge
    beq expert_no_spawn
    jsr expert_spawn_projectile
expert_no_spawn:
    jsr expert_determine_outcome
    jmp expert_publish_frame

expert_terminal_update:
    jsr expert_advance_slot
    lda current_fire
    bne expert_terminal_maybe_exit
    lda #1
    sta terminal_saw_release
expert_terminal_maybe_exit:
    lda slot_state
    bne expert_publish_frame
    lda terminal_saw_release
    beq expert_publish_frame
    lda fire_edge
    beq expert_publish_frame
    lda #1
    sta exit_after_publish

expert_publish_frame:
    jsr expert_publish_state
    lda current_fire
    sta previous_fire
    lda exit_after_publish
    beq expert_main_loop
    jmp expert_restore_and_return

; Raster $fb occurs once per PAL frame and lies outside the visible badline window.
expert_wait_next_frame:
expert_wait_leave_line:
    lda VIC_RASTER
    cmp #$fb
    beq expert_wait_leave_line
expert_wait_enter_line:
    lda VIC_RASTER
    cmp #$fb
    bne expert_wait_enter_line
    rts

expert_update_player:
    lda joystick_sample
    and #$0c
    cmp #$08
    beq expert_move_player_left
    cmp #$04
    beq expert_move_player_right
expert_update_player_done:
    rts

expert_move_player_left:
    lda player_x_hi
    bne expert_decrement_player
    lda player_x_lo
    cmp #48
    bcc expert_update_player_done
    beq expert_update_player_done
expert_decrement_player:
    lda player_x_lo
    bne expert_decrement_player_low
    dec player_x_hi
expert_decrement_player_low:
    dec player_x_lo
    rts

expert_move_player_right:
    lda player_x_hi
    beq expert_increment_player
    cmp #1
    bne expert_update_player_done
    lda player_x_lo
    cmp #$28
    bcs expert_update_player_done
expert_increment_player:
    inc player_x_lo
    bne expert_update_player_done
    inc player_x_hi
    rts

expert_advance_slot:
    lda slot_state
    cmp #SLOT_PROJECTILE
    beq expert_advance_projectile
    cmp #SLOT_EXPLOSION
    beq expert_advance_explosion
    rts

expert_advance_projectile:
    sec
    lda slot_y
    sbc #4
    sta slot_y
    cmp #50
    bcs expert_advance_slot_done
    lda #SLOT_IDLE
    sta slot_state
expert_advance_slot_done:
    rts

expert_advance_explosion:
    lda slot_frame
    cmp #1
    bne expert_finish_explosion
    inc slot_frame
    rts
expert_finish_explosion:
    lda #SLOT_IDLE
    sta slot_state
    rts

expert_advance_formation:
    inc formation_counter
    lda formation_counter
    cmp #8
    bcs expert_formation_due
    rts
expert_formation_due:
    lda #0
    sta formation_counter

    ldx #0
expert_find_left_live:
    lda enemy_alive,x
    bne expert_left_live_found
    inx
    cpx #6
    bne expert_find_left_live
    rts
expert_left_live_found:
    lda enemy_x_lo,x
    sta edge_left_lo
    lda enemy_x_hi,x
    sta edge_left_hi

    ldx #5
expert_find_right_live:
    lda enemy_alive,x
    bne expert_right_live_found
    dex
    bpl expert_find_right_live
    rts
expert_right_live_found:
    lda enemy_x_lo,x
    sta edge_right_lo
    lda enemy_x_hi,x
    sta edge_right_hi

    lda formation_right
    beq expert_test_left_edge
    lda edge_right_hi
    cmp #1
    bcc expert_move_formation_right
    bne expert_descend_turn_left
    lda edge_right_lo
    cmp #$29
    bcs expert_descend_turn_left

expert_move_formation_right:
    ldx #0
expert_move_right_loop:
    lda enemy_alive,x
    beq expert_move_right_next
    inc enemy_x_lo,x
    bne expert_move_right_next
    inc enemy_x_hi,x
expert_move_right_next:
    inx
    cpx #6
    bne expert_move_right_loop
    jmp expert_toggle_animation

expert_test_left_edge:
    lda edge_left_hi
    bne expert_move_formation_left
    lda edge_left_lo
    cmp #49
    bcc expert_descend_turn_right

expert_move_formation_left:
    ldx #0
expert_move_left_loop:
    lda enemy_alive,x
    beq expert_move_left_next
    lda enemy_x_lo,x
    bne expert_move_left_low
    dec enemy_x_hi,x
expert_move_left_low:
    dec enemy_x_lo,x
expert_move_left_next:
    inx
    cpx #6
    bne expert_move_left_loop
    jmp expert_toggle_animation

expert_descend_turn_left:
    lda #0
    sta formation_right
    jmp expert_descend_formation

expert_descend_turn_right:
    lda #1
    sta formation_right

expert_descend_formation:
    ldx #0
expert_descend_loop:
    lda enemy_alive,x
    beq expert_descend_next
    clc
    lda enemy_y,x
    adc #8
    sta enemy_y,x
expert_descend_next:
    inx
    cpx #6
    bne expert_descend_loop

expert_toggle_animation:
    lda animation_phase
    eor #1
    sta animation_phase
expert_formation_done:
    rts

expert_resolve_hit:
    lda slot_state
    cmp #SLOT_PROJECTILE
    beq expert_prepare_collision
    rts

expert_prepare_collision:
    clc
    lda slot_x_lo
    adc #11
    sta collision_left_lo
    lda slot_x_hi
    adc #0
    sta collision_left_hi
    clc
    lda slot_x_lo
    adc #12
    sta collision_right_lo
    lda slot_x_hi
    adc #0
    sta collision_right_hi

    ldx #0
expert_collision_loop:
    lda enemy_alive,x
    beq expert_collision_next

    clc
    lda slot_y
    adc #7
    cmp enemy_y,x
    bcc expert_collision_next
    clc
    lda enemy_y,x
    adc #20
    cmp slot_y
    bcc expert_collision_next

    lda collision_right_hi
    cmp enemy_x_hi,x
    bcc expert_collision_next
    bne expert_collision_second_x
    lda collision_right_lo
    cmp enemy_x_lo,x
    bcc expert_collision_next

expert_collision_second_x:
    clc
    lda enemy_x_lo,x
    adc #23
    sta edge_right_lo
    lda enemy_x_hi,x
    adc #0
    sta edge_right_hi
    lda collision_left_hi
    cmp edge_right_hi
    bcc expert_collision_hit
    bne expert_collision_next
    lda collision_left_lo
    cmp edge_right_lo
    bcc expert_collision_hit
    beq expert_collision_hit

expert_collision_next:
    inx
    cpx #6
    beq expert_collision_done
    jmp expert_collision_loop

expert_collision_hit:
    lda #0
    sta enemy_alive,x
    dec alive_count
    lda #SLOT_EXPLOSION
    sta slot_state
    lda #1
    sta slot_frame
    lda enemy_x_lo,x
    sta slot_x_lo
    lda enemy_x_hi,x
    sta slot_x_hi
    lda enemy_y,x
    sta slot_y
expert_collision_done:
    rts

expert_spawn_projectile:
    lda #SLOT_PROJECTILE
    sta slot_state
    lda player_x_lo
    sta slot_x_lo
    lda player_x_hi
    sta slot_x_hi
    lda #199
    sta slot_y
    rts

expert_determine_outcome:
    lda alive_count
    beq expert_set_win
    ldx #0
expert_loss_loop:
    lda enemy_alive,x
    beq expert_loss_next
    lda enemy_y,x
    cmp #200
    bcs expert_set_loss
expert_loss_next:
    inx
    cpx #6
    bne expert_loss_loop
    rts

expert_set_win:
    lda #OUTCOME_WON
    bne expert_set_outcome
expert_set_loss:
    lda #OUTCOME_LOST
expert_set_outcome:
    sta outcome
    lda current_fire
    eor #1
    sta terminal_saw_release
    rts

; Publish sprite 0, sprites 1..6, sprite 7, then the result border.
expert_publish_state:
    lda VIC_SPRITE_ENABLE
    ora #$01
    sta VIC_SPRITE_ENABLE
    lda player_x_lo
    sta VIC_SPRITE_X0
    lda #220
    sta VIC_SPRITE_X0 + 1
    lda player_x_hi
    beq expert_clear_player_msb
    lda VIC_SPRITE_X_MSB
    ora #$01
    bne expert_store_player_msb
expert_clear_player_msb:
    lda VIC_SPRITE_X_MSB
    and #$fe
expert_store_player_msb:
    sta VIC_SPRITE_X_MSB
    lda #SPRITE_BLOCK
    sta SCREEN_SPRITE_POINTER0
    lda #3
    sta VIC_SPRITE_COLOR0

    ldx #0
expert_publish_enemy_loop:
    lda enemy_alive,x
    beq expert_disable_enemy
    lda VIC_SPRITE_ENABLE
    ora enemy_bits,x
    jmp expert_store_enemy_enable
expert_disable_enemy:
    lda VIC_SPRITE_ENABLE
    and enemy_clear_bits,x
expert_store_enemy_enable:
    sta VIC_SPRITE_ENABLE

    lda enemy_vic_offsets,x
    tay
    lda enemy_x_lo,x
    sta VIC_SPRITE_X0 + 2,y
    lda enemy_y,x
    sta VIC_SPRITE_X0 + 3,y
    lda enemy_x_hi,x
    beq expert_clear_enemy_msb
    lda VIC_SPRITE_X_MSB
    ora enemy_bits,x
    jmp expert_store_enemy_msb
expert_clear_enemy_msb:
    lda VIC_SPRITE_X_MSB
    and enemy_clear_bits,x
expert_store_enemy_msb:
    sta VIC_SPRITE_X_MSB

    lda enemy_design,x
    asl
    clc
    adc animation_phase
    clc
    adc #(SPRITE_BLOCK + 1)
    sta SCREEN_SPRITE_POINTER0 + 1,x
    lda #5
    sta VIC_SPRITE_COLOR0 + 1,x
    inx
    cpx #6
    beq expert_publish_slot7
    jmp expert_publish_enemy_loop

expert_publish_slot7:
    lda slot_state
    beq expert_disable_slot7
    lda VIC_SPRITE_ENABLE
    ora #$80
    bne expert_store_slot7_enable
expert_disable_slot7:
    lda VIC_SPRITE_ENABLE
    and #$7f
expert_store_slot7_enable:
    sta VIC_SPRITE_ENABLE

    lda slot_state
    beq expert_slot7_idle_position
    lda slot_x_lo
    sta VIC_SPRITE_X0 + 14
    lda slot_y
    sta VIC_SPRITE_X0 + 15
    lda slot_x_hi
    jmp expert_slot7_msb
expert_slot7_idle_position:
    lda #0
    sta VIC_SPRITE_X0 + 14
    sta VIC_SPRITE_X0 + 15
expert_slot7_msb:
    beq expert_clear_slot7_msb
    lda VIC_SPRITE_X_MSB
    ora #$80
    bne expert_store_slot7_msb
expert_clear_slot7_msb:
    lda VIC_SPRITE_X_MSB
    and #$7f
expert_store_slot7_msb:
    sta VIC_SPRITE_X_MSB

    lda slot_state
    cmp #SLOT_EXPLOSION
    beq expert_slot7_explosion_art
    lda #(SPRITE_BLOCK + 5)
    sta SCREEN_SPRITE_POINTER0 + 7
    lda #1
    bne expert_store_slot7_color
expert_slot7_explosion_art:
    lda slot_frame
    clc
    adc #(SPRITE_BLOCK + 5)
    sta SCREEN_SPRITE_POINTER0 + 7
    lda #8
expert_store_slot7_color:
    sta VIC_SPRITE_COLOR0 + 7

    lda outcome
    cmp #OUTCOME_WON
    beq expert_publish_win_border
    cmp #OUTCOME_LOST
    beq expert_publish_loss_border
    lda #0
    beq expert_store_border
expert_publish_win_border:
    lda #5
    bne expert_store_border
expert_publish_loss_border:
    lda #2
expert_store_border:
    sta VIC_BORDER
    rts

expert_restore_and_return:
    sei
    lda #0
    sta VIC_SPRITE_ENABLE

    ldx #15
expert_restore_positions:
    lda saved_sprite_positions,x
    sta VIC_SPRITE_X0,x
    dex
    bpl expert_restore_positions

    ldx #7
expert_restore_colors_and_pointers:
    lda saved_sprite_colors,x
    sta VIC_SPRITE_COLOR0,x
    lda saved_sprite_pointers,x
    sta SCREEN_SPRITE_POINTER0,x
    dex
    bpl expert_restore_colors_and_pointers

    lda saved_sprite_x_msb
    sta VIC_SPRITE_X_MSB
    lda saved_sprite_y_expand
    sta VIC_SPRITE_Y_EXPAND
    lda saved_sprite_priority
    sta VIC_SPRITE_PRIORITY
    lda saved_sprite_multicolor
    sta VIC_SPRITE_MULTICOLOR
    lda saved_sprite_x_expand
    sta VIC_SPRITE_X_EXPAND
    lda saved_border
    sta VIC_BORDER
    lda saved_background
    sta VIC_BACKGROUND
    lda saved_vic_memory
    sta VIC_MEMORY
    lda saved_sprite_enable
    sta VIC_SPRITE_ENABLE

    ; Restore each output latch before its data-direction register.
    lda saved_cia2_port
    sta CIA2_PORT_A
    lda saved_cia2_ddr
    sta CIA2_DDR_A
    lda saved_cpu_port
    sta CPU_PORT
    lda saved_cpu_ddr
    sta CPU_DDR

    ldx saved_stack
    txs
    lda saved_status
    pha
    lda saved_a
    ldx saved_x
    ldy saved_y
    plp
    rts

expert_code_end:

expert_tables_start:
enemy_bits:
    !byte $02, $04, $08, $10, $20, $40
enemy_clear_bits:
    !byte $fd, $fb, $f7, $ef, $df, $bf
enemy_vic_offsets:
    !byte 0, 2, 4, 6, 8, 10
expert_tables_end:

expert_state_start:
enemy_x_lo:
    !byte <72, <112, <152, <192, <232, <272
enemy_x_hi:
    !byte >72, >112, >152, >192, >232, >272
enemy_y:
    !byte 72, 72, 72, 72, 72, 72
enemy_alive:
    !byte 1, 1, 1, 1, 1, 1
enemy_design:
    !byte 0, 1, 0, 1, 0, 1

player_x_lo:
    !byte <160
player_x_hi:
    !byte >160
formation_counter:
    !byte 0
formation_right:
    !byte 1
animation_phase:
    !byte 0

slot_state:
    !byte SLOT_IDLE
slot_x_lo:
    !byte 0
slot_x_hi:
    !byte 0
slot_y:
    !byte 0
slot_frame:
    !byte 0

previous_fire:
    !byte 0
current_fire:
    !byte 0
fire_edge:
    !byte 0
terminal_saw_release:
    !byte 0
outcome:
    !byte OUTCOME_PLAYING
alive_count:
    !byte 6
joystick_sample:
    !byte $1f
exit_after_publish:
    !byte 0

edge_left_lo:
    !byte 0
edge_left_hi:
    !byte 0
edge_right_lo:
    !byte 0
edge_right_hi:
    !byte 0
collision_left_lo:
    !byte 0
collision_left_hi:
    !byte 0
collision_right_lo:
    !byte 0
collision_right_hi:
    !byte 0
expert_state_end:

expert_saved_state_start:
saved_a:
    !byte 0
saved_x:
    !byte 0
saved_y:
    !byte 0
saved_stack:
    !byte 0
saved_status:
    !byte 0
saved_cpu_ddr:
    !byte 0
saved_cpu_port:
    !byte 0
saved_cia2_port:
    !byte 0
saved_cia2_ddr:
    !byte 0
saved_vic_memory:
    !byte 0
saved_sprite_enable:
    !byte 0
saved_sprite_x_msb:
    !byte 0
saved_sprite_y_expand:
    !byte 0
saved_sprite_priority:
    !byte 0
saved_sprite_multicolor:
    !byte 0
saved_sprite_x_expand:
    !byte 0
saved_border:
    !byte 0
saved_background:
    !byte 0
saved_sprite_positions:
    !fill 16, 0
saved_sprite_colors:
    !fill 8, 0
saved_sprite_pointers:
    !fill 8, 0
expert_saved_state_end:

expert_resident_end:

!if expert_resident_end > SPRITE_BASE {
    !error "Expert program overlaps its resident sprite data"
}

!fill SPRITE_BASE - *, 0
expert_sprite_data_start:
    !binary "examples/m1/assets/sprites.bin"
expert_sprite_data_end:

!if expert_sprite_data_end - expert_sprite_data_start != 512 {
    !error "Expert sprite data must contain exactly 512 bytes"
}

expert_prg_end:
