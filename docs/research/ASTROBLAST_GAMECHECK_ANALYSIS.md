# Game Analysis Report: Astroblast

## Executive Summary
- **Repository:** https://github.com/nealvis/astroblast.git
- **Analysis Date:** 02/01/2026
- **Target Platform:** Commodore 64 (NTSC)
- **Project Size:** 9,521 lines of code across 33 ASM files
- **Portability Status:** PARTIALLY PORTABLE - Needs Version 0.5
- **Primary Blockers:** Hardware collision detection, interrupt-based timing, advanced sprite control
- **Recommended Blend65 Version:** v0.5 (hardware-intensive features required)
- **Implementation Effort:** HIGH

---

## Technical Analysis

### Assembly Game Analysis: Astroblast

**Target Platform:** Commodore 64 (NTSC)
**Assembly Style:** Kick Assembler with custom macro library (nv_c64_util)
**Code Size:** 9,521 lines across 33 files
**Game Type:** Two-player competitive arcade game

### Hardware Usage Patterns:

#### Graphics (VIC-II):
- **Sprites:** Extensive use of 8 sprites for ships, asteroids, bullets, black holes
- **Sprite Animation:** Frame-based animation system with sprite data pointer tables
- **Custom Character Set:** Uses custom charset (astro_charset.bin) loaded at $3000
- **Screen Modes:** Character mode with custom charset
- **Collision Detection:** Hardware sprite collision registers ($D01E)

#### Sound (SID):
- **Music System:** GoatTracker v2.76 generated music with multiple subtunes
- **Sound Effects:** Individual instrument-based sound effects
- **Multi-channel:** Uses all 3 SID voices for music and effects
- **Dynamic Control:** Master volume control, effect interruption

#### Input (CIA):
- **Dual Joystick:** Both joystick ports used simultaneously
- **Keyboard:** Title screen configuration keys
- **Real-time Input:** Frame-based input polling

#### Memory Management:
- **Static Layout:** Fixed memory regions ($0800 BASIC, $1000 main, $3000 charset, $8000 sound)
- **Zero Page Usage:** Efficient use of zero page for sprite data and counters
- **No Dynamic Allocation:** All memory statically allocated

#### Timing and Control:
- **Frame-based Loop:** 60 FPS main loop with frame counting
- **Second Counters:** BCD-based time tracking for game duration
- **Effect Timing:** Frame-based effect durations and animations

### Blend65 Hardware API Requirements:

#### Critical Missing APIs (v0.5 Features):

**Advanced Sprite Control:**
```blend65
// Required sprite APIs not in v0.1:
import setMultiSpriteAnimation from c64.sprites
import setSpriteDataPointer from c64.sprites
import setSpriteAnimationFrame from c64.sprites
```

**Hardware Collision Detection:**
```blend65
// Essential for arcade gameplay:
import readSpriteCollisions from c64.vic
import checkSpriteHit from c64.vic
function checkAllCollisions(): byte
```

**Sound System Integration:**
```blend65
// SID integration needed:
import playSIDMusic from c64.sid
import playSoundEffect from c64.sid
import setSIDVolume from c64.sid
import stopAllSounds from c64.sid
```

**Precise Timing:**
```blend65
// Frame-accurate timing required:
import getFrameCounter from c64.system
import waitForNextFrame from c64.system
```

### Current Blend65 v0.1 Gaps:

**Language Features (Currently Unsupported):**
1. **Complex Macro Systems:** Game relies heavily on Kick Assembler macros
2. **Namespace Support:** Uses namespaces for sprite organization
3. **Advanced Memory Layout:** Precise memory region control needed
4. **Binary Data Import:** Custom character sets and sound data import

**Hardware APIs (Missing in v0.1):**
1. **Sprite Collision Detection:** Core gameplay mechanic
2. **Multi-sprite Management:** 8+ sprites with individual control
3. **SID Music/Sound:** Integrated music and sound effect system
4. **Precise Frame Timing:** 60 FPS game loop synchronization
5. **Advanced VIC-II Control:** Custom character sets, memory banking

### Portability Assessment:

**NOT PORTABLE with v0.1:**
- Requires hardware collision detection for core gameplay
- Needs advanced sprite animation system
- Requires integrated SID sound system
- Complex timing requirements

**PARTIALLY PORTABLE with v0.5:**
- Hardware collision detection implemented
- Advanced sprite control available
- Integrated sound system
- Precise timing control

### Version 0.5 Requirements:

**Hardware Collision System:**
```blend65
// Essential for Astroblast gameplay
import readSpriteCollisionRegister from c64.vic
import checkSpriteToSpriteCollision from c64.vic

// Game loop integration:
function mainGameLoop(): void
    var collisions: byte = readSpriteCollisionRegister()
    if collisions != 0 then
        handleCollisions(collisions)
    end if
end function
```

**Advanced Sprite Animation:**
```blend65
// Multi-frame sprite animation system
type SpriteAnimation
    frames: byte[]
    currentFrame: byte
    frameDelay: byte
    frameCounter: byte
end type

// Required for black hole, ship, and asteroid animations
function animateSprite(sprite: byte, animation: SpriteAnimation): void
    if animation.frameCounter >= animation.frameDelay then
        animation.currentFrame = (animation.currentFrame + 1) % length(animation.frames)
        setSpriteDataPointer(sprite, animation.frames[animation.currentFrame])
        animation.frameCounter = 0
    else
        animation.frameCounter = animation.frameCounter + 1
    end if
end function
```

**Integrated Sound System:**
```blend65
// SID integration for music and effects
import playSIDFile from c64.sid
import playSoundEffect from c64.sid
import setSIDSubtune from c64.sid

// Multiple sound channels needed:
function initGameAudio(): void
    playSIDFile("astro_sound.bin", 0)  // Main game music
end function

function playCollisionSound(): void
    playSoundEffect("ship_hit_asteroid.bin", 1)  // Effect on channel 1
end function
```

### Implementation Priority Updates:

**Critical Priority (Required for Astroblast):**
1. **Hardware Collision Detection** - Core gameplay requirement
2. **Advanced Sprite Control** - 8 sprites with individual animation
3. **SID Music Integration** - Music and sound effects essential
4. **Frame-accurate Timing** - 60 FPS game loop precision

**High Priority (Significantly improves compatibility):**
1. **Custom Character Set Support** - Enhanced graphics
2. **Dual Joystick Input** - Two-player gameplay
3. **BCD Arithmetic** - Score and timer management
4. **Memory Layout Control** - Precise memory organization

---

## Code Examples

### Original Game Code:
```asm
// Main game loop (from astroblast.asm)
MainLoop:
    nv_adc16x_mem_immed(frame_counter, 1, frame_counter)
    nv_adc16x_mem_immed(second_partial_counter, 1, second_partial_counter)

    // Hardware collision detection
    nv_sprite_raw_get_sprite_collisions_in_a()
    sta sprite_collision_reg_value

    // Check ship collisions
    jsr CheckCollisionsUpdateScoreShip1
    jsr CheckCollisionsUpdateScoreShip2

    // Update all sprites
    jsr ship_1.MoveInExtraData
    jsr ship_2.MoveInExtraData
    jsr asteroid_1.MoveInExtraData

    // Timing and effects
    jsr StarStep
    jsr WindStep
    jsr DoHoleStep
    jsr TurretStep

    jmp MainLoop
```

```asm
// Collision detection macro (from astroblast.asm)
.macro check_collisions_update_score_sr(ship, ship_death_count, ship_num, next_possible_bounce_frame, sound_fx_ship_hit_asteroid)
{
    jsr ship.CheckShipCollision   // sets ship.collision_sprite
    lda ship.collision_sprite     // closest_sprite, will be $FF
    bpl HandleCollisionShip       // if no collisions so check minus
    jmp NoCollisionShip
HandleCollisionShip:
    lda ship_death_count          // if ship is dead then ignore collisions
    beq NoDeath
    jmp NoCollisionShip
NoDeath:
    // Handle specific collision types
    ldy ship.collision_sprite
    cpy blackhole.sprite_num
    bne CollisionNotHole
    jsr HoleForceStop
    jsr SlowMoStart
    jsr SoundPlaySilenceFX
}
```

### Required Blend65 Syntax (v0.5):
```blend65
// Main game loop in Blend65
function mainGameLoop(): void
    frameCounter = frameCounter + 1
    secondPartialCounter = secondPartialCounter + 1

    // Hardware collision detection
    var collisions: byte = readSpriteCollisionRegister()

    if collisions != 0 then
        checkCollisionsUpdateScoreShip1(collisions)
        checkCollisionsUpdateScoreShip2(collisions)
    end if

    // Update sprite positions
    ship1.moveInExtraData()
    ship2.moveInExtraData()
    asteroid1.moveInExtraData()

    // Update effects
    starStep()
    windStep()
    holeStep()
    turretStep()
end function

// Collision handling
function checkShipCollision(ship: Sprite): byte
    var collisionSprite: byte = checkSpriteToSpriteCollision(ship.spriteNum)

    if collisionSprite != $FF then
        if collisionSprite == blackhole.spriteNum then
            holeForceStop()
            slowMoStart()
            playSoundEffect("silence.bin")
            return 0
        else
            // Handle asteroid collision
            playCollisionSound()
            updateScore(ship.playerNum)
            return 1
        end if
    end if

    return 0
end function

// Sprite animation system
type SpriteAnimData
    frames: byte[8]
    currentFrame: byte
    frameDelay: byte
    frameCounter: byte
end type

function animateSprite(spriteNum: byte, animData: SpriteAnimData): void
    if animData.frameCounter >= animData.frameDelay then
        animData.currentFrame = (animData.currentFrame + 1) % 8
        setSpriteDataPointer(spriteNum, animData.frames[animData.currentFrame])
        animData.frameCounter = 0
    else
        animData.frameCounter = animData.frameCounter + 1
    end if
end function

// Game initialization
function initGame(): void
    // Load custom character set
    loadCharacterSet("astro_charset.bin", $3000)

    // Initialize sprites
    for i = 0 to 7
        enableSprite(i)
        setSpriteColor(i, getDefaultSpriteColor(i))
    next i

    // Initialize sound system
    playSIDMusic("astro_sound.bin", 0)  // Main game music
    setSIDVolume(7)  // Default volume

    // Setup game state
    frameCounter = 0
    secondCounter = 0
    gameTime = 120  // 2 minute game
end function

// Input handling for two players
function handleInput(): void
    // Player 1 (Joystick port 1)
    if joystickUp(1) then
        ship1.increaseSpeed()
    end if
    if joystickDown(1) then
        ship1.decreaseSpeed()
    end if
    if joystickFire(1) then
        fireTurret(1)
    end if

    // Player 2 (Joystick port 2)
    if joystickUp(2) then
        ship2.increaseSpeed()
    end if
    if joystickDown(2) then
        ship2.decreaseSpeed()
    end if
    if joystickFire(2) then
        fireTurret(2)
    end if
end function
```

---

## Evolution Impact

### Roadmap Classification:
**Version 0.5 - CRITICAL - HIGH Implementation Effort**

Astroblast represents a classic arcade-style C64 game that heavily depends on hardware-specific features. Supporting this type of game would significantly expand Blend65's capabilities for:

1. **Arcade Game Development** - Hardware collision detection enables classic gameplay
2. **Multi-player Games** - Dual joystick support for competitive games
3. **Audio-rich Games** - Integrated SID music and sound effects
4. **Animation-heavy Games** - Advanced sprite animation systems

### Missing Features Identified:

**Hardware Integration (v0.5):**
- Hardware sprite collision detection
- SID music and sound effect integration
- Precise frame timing and synchronization
- Advanced VIC-II memory management

**Development Tools (Future):**
- Kick Assembler macro compatibility layer
- Binary asset import system
- Memory layout specification tools

### Implementation Recommendations:

1. **Prioritize collision detection** - Essential for arcade games
2. **Develop sprite animation framework** - Enables complex visual effects
3. **Create SID integration layer** - Critical for audio-rich games
4. **Build timing synchronization system** - Required for smooth gameplay

Supporting Astroblast would make Blend65 capable of creating sophisticated arcade-style games with the full feature set expected by C64 game developers.
