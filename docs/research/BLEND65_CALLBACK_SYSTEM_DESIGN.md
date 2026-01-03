# Blend65 Callback Function System Design

**Purpose:** Design analysis and decisions for implementing callback function support in Blend65
**Date:** 03/01/2026
**Status:** Design Complete - Ready for Implementation
**Replaces:** Previous interrupt-only design with unified callback approach

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Unified Callback Design](#unified-callback-design)
3. [Game Pattern Analysis](#game-pattern-analysis)
4. [Language Design Decisions](#language-design-decisions)
5. [Type System Integration](#type-system-integration)
6. [Compilation Strategy](#compilation-strategy)
7. [Implementation Requirements](#implementation-requirements)

---

## Executive Summary

Based on analysis of C64 games and function pointer requirements, **callback functions provide a unified solution** for both hardware interrupts and function pointers. This document defines the callback system design for Blend65 that:

- **Unifies two needs**: Single solution for interrupts + function pointers
- **Simple language syntax**: Single `callback` keyword modifier
- **Flexible usage**: Callbacks work for interrupts, AI, menus, state machines
- **Type-safe**: `callback` as primitive type enables compile-time checking
- **6502-compilable**: Generates efficient function addresses and indirect calls

### Key Decision: Single Callback Solution

```js
// Simple unified syntax
callback function rasterHandler(): void
    updateSprites()
end function

callback function traderAI(): void
    findNearestStation()
end function

// Both use same type system
function setRasterInterrupt(line: byte, handler: callback): byte
function setShipAI(ship: byte, behavior: callback): void

// Usage
setRasterInterrupt(250, rasterHandler)  // Interrupt usage
setShipAI(0, traderAI)                  // Function pointer usage
```

---

## Unified Callback Design

### Hardware Interrupts vs Function Pointers - Same Solution

**Modern Developers Know:**
```typescript
// JavaScript callback pattern
button.addEventListener('click', () => {
    console.log('Button clicked!');
});

setTimeout(() => updateGame(), 16);
```

**6502 Games Need:**
```js
// Same pattern works for hardware AND software callbacks
callback function rasterHandler(): void
    // Hardware interrupt handler
    updateSprites()
end function

callback function aiHandler(): void
    // AI behavior callback
    attackPlayer()
end function

// Library functions use same callback type
setRasterInterrupt(250, rasterHandler)  // Hardware callback
setAI(shipID, aiHandler)                // Software callback
```

### Benefits of Unified Approach

1. **Single Language Feature**: One `callback` keyword solves both needs
2. **Familiar Pattern**: JavaScript/TypeScript developers understand callbacks
3. **Type Safety**: `callback` type provides compile-time checking
4. **Flexible Usage**: Same functions work for multiple purposes
5. **Simple Implementation**: Parser adds one keyword, one type

---

## Game Pattern Analysis

### Pattern 1: Hardware Interrupts (Bubble Escape Style)

```js
// Raster interrupt-driven game loop
callback function gameUpdate(): void
    updateBubblePosition()
    checkWallCollisions()
    updateEnemyPositions()
    checkEnemyCollisions()
    updateScore()
end function

function initGame(): void
    setRasterInterrupt(251, gameUpdate)  // Hardware calls gameUpdate 60 times/second
    enableRasterInterrupts()
end function

function main(): void
    initGame()
    while true
        // All game logic happens in interrupt handler
        // Main loop can be empty or handle background tasks
    end while
end function
```

### Pattern 2: AI Behavior Systems (Elite Style)

```js
// Different AI behaviors for different ship types
callback function traderAI(): void
    findNearestStation()
    dockIfSafe()
    tradeGoods()
end function

callback function pirateAI(): void
    scanForTargets()
    attackWeakestShip()
    evadeIfOutgunned()
end function

callback function policeAI(): void
    patrolArea()
    respondToDistressCalls()
    arrestCriminals()
end function

// AI dispatch table
var shipAI: callback[3] = [traderAI, pirateAI, policeAI]

function updateShip(shipID: byte): void
    var shipType: byte = ships[shipID].type
    shipAI[shipType]()  // Dynamic AI dispatch
end function
```

### Pattern 3: Menu/UI Systems (Astroblast Style)

```js
// Menu action callbacks
callback function startGame(): void
    initializePlayer()
    resetScore()
    switchToGameplay()
end function

callback function showOptions(): void
    displayOptionsMenu()
    waitForSelection()
end function

callback function quitGame(): void
    saveHighScore()
    exitToBasic()
end function

// Menu system
var menuActions: callback[3] = [startGame, showOptions, quitGame]

function handleMenuInput(): void
    if joystickUp() then
        selectedItem = (selectedItem - 1) % 3
    elsif joystickDown() then
        selectedItem = (selectedItem + 1) % 3
    elsif joystickFire() then
        menuActions[selectedItem]()  // Execute selected action
    end if
end function
```

### Pattern 4: State Machine Handlers (Complex Games)

```js
// Game state handlers
callback function handleMenu(): void
    processMenuInput()
    updateMenuGraphics()
end function

callback function handleGameplay(): void
    updatePlayer()
    updateEnemies()
    checkCollisions()
    updateGraphics()
end function

callback function handlePause(): void
    displayPauseMenu()
    if resumePressed() then
        currentState = PLAYING
    end if
end function

callback function handleGameOver(): void
    displayFinalScore()
    if restartPressed() then
        currentState = MENU
    end if
end function

// State machine
var stateHandlers: callback[4] = [handleMenu, handleGameplay, handlePause, handleGameOver]

function gameLoop(): void
    while true
        stateHandlers[currentState]()  // Dynamic state dispatch
    end while
end function
```

### Pattern 5: Mixed Usage (Real Game Example)

```js
// Complex game using callbacks for multiple purposes
module Game.ComplexExample

// Interrupt callbacks for hardware timing
callback function frameSync(): void
    frameCounter += 1
    readHardwareCollisions()
end function

callback function musicUpdate(): void
    updateSIDRegisters()
    advanceMusicPointer()
end function

// AI callbacks for behavior
callback function enemyAI(): void
    moveTowardPlayer()
    fireWeapons()
end function

// UI callbacks for menus
callback function mainMenuAction(): void
    startNewGame()
end function

// All use the same type system
function setupComplexGame(): void
    // Hardware callbacks
    setRasterInterrupt(250, frameSync)
    setTimerInterrupt(1000, musicUpdate)

    // AI callbacks
    for i = 0 to enemyCount - 1
        setEnemyAI(i, enemyAI)
    next i

    // Menu callbacks
    setMenuAction(0, mainMenuAction)

    enableInterrupts()
end function
```

---

## Language Design Decisions

### Core Principle: Unified Simplicity

**Design Decision: Single `callback` keyword for all use cases**

**Rejected Alternatives:**
```js
// REJECTED: Multiple keywords
interrupt function rasterHandler(): void    // For hardware only
ai function traderBehavior(): void          // For AI only
menu function startGame(): void             // For UI only

// REJECTED: Complex function types
function setRasterInterrupt(line: byte, handler: function(): void): byte
function setAI(ship: byte, behavior: function(): void): void
```

**Chosen Approach:**
```js
// UNIFIED: Single callback solution
callback function rasterHandler(): void     // Works for hardware
callback function traderAI(): void          // Works for AI
callback function menuAction(): void        // Works for UI

// Simple type system
function setRasterInterrupt(line: byte, handler: callback): byte
function setAI(ship: byte, behavior: callback): void
function setMenuAction(item: byte, action: callback): void
```

### Callback Function Semantics

**Flexible Design Philosophy:**
- `callback` functions **can have parameters** (unlike original interrupt restriction)
- `callback` functions **can return values** (enables getter callbacks)
- `callback` functions **can be exported** (enables callback libraries)
- `callback` functions **can be called directly** (dual usage pattern)

### Grammar Impact (Minimal)

```ebnf
// Only changes needed:
function_declaration = ["callback"] "function" identifier "(" parameter_list ")" [ ":" type_annotation ] ...
primitive_type = "byte" | "word" | "boolean" | "void" | "callback" ;
```

---

## Type System Integration

### Callback as Primitive Type

```js
// callback is a built-in primitive type (like byte, word, boolean)
var handler: callback = someCallbackFunction
var handlers: callback[10]                    // Array of callbacks
var currentAI: callback                       // Current AI behavior

// Type checking
function setRasterInterrupt(line: byte, handler: callback): byte
function processCallback(action: callback): void
```

### Function-to-Callback Assignment

```js
// Callback functions can be assigned to callback variables
callback function rasterHandler(): void
    updateSprites()
end function

callback function timerHandler(): void
    updateMusic()
end function

// Assignment
var currentHandler: callback = rasterHandler   // Valid assignment
currentHandler = timerHandler                  // Change at runtime

// Direct calls also work
rasterHandler()  // Direct call
currentHandler() // Indirect call through variable
```

### Mixed Function Usage

```js
// Regular and callback functions coexist
function normalFunction(): void
    // Regular function
end function

callback function callbackFunction(): void
    // Callback function
end function

// Only callback functions can be assigned to callback variables
var handler: callback = callbackFunction    // ✅ Valid
var invalid: callback = normalFunction      // ❌ Type error (future compiler validation)
```

### Arrays and Complex Usage

```js
// Arrays of callbacks
var aiHandlers: callback[4] = [traderAI, pirateAI, bountyHunterAI, policeAI]
var menuActions: callback[3] = [startGame, showOptions, quitGame]

// Callback parameters in functions
function executeCallback(action: callback): void
    action()  // Execute the callback
end function

// Callback return values
callback function getPlayerX(): byte
    return playerX
end function

var getter: callback = getPlayerX
var x: byte = getter()  // Call callback that returns value
```

---

## Compilation Strategy

### Callback Function Compilation

**Source Code:**
```js
callback function rasterHandler(): void
    updateSprites()
    setBackgroundColor(RED)
end function
```

**Generated 6502 Assembly:**
```assembly
; Callback functions compile to regular functions + address symbol
rasterHandler:
    JSR updateSprites       ; Function body
    LDA #$02                ; RED constant
    STA $D020               ; VIC background color
    RTS                     ; Regular function return

; Compiler also generates address symbol for callback usage
rasterHandler_addr:
    .word rasterHandler     ; Function address for callback variables
```

### Callback Variable Compilation

**Source Code:**
```js
var handler: callback = rasterHandler
handler()
```

**Generated 6502 Assembly:**
```assembly
; Callback variable stores function address
handler:    .word $0000     ; 16-bit function address

; Assignment: handler = rasterHandler
LDA #<rasterHandler
STA handler
LDA #>rasterHandler
STA handler+1

; Indirect call: handler()
JSR (handler)           ; 6502 indirect jump
```

### Library Function Implementation

**Source Code:**
```js
function setRasterInterrupt(line: byte, handler: callback): byte
```

**Generated Assembly Pseudocode:**
```assembly
setRasterInterrupt:
    ; Parameters: A = raster line, (handler) = function address
    ; Store handler address in interrupt dispatch table
    LDA handler         ; Low byte of callback function
    STA RASTER_HANDLER_LO
    LDA handler+1       ; High byte of callback function
    STA RASTER_HANDLER_HI

    ; Configure VIC-II hardware
    LDA raster_line_param
    STA $D012           ; Set raster line
    LDA #$01
    STA $D01A           ; Enable raster interrupt

    ; Return unique handle
    LDA NEXT_HANDLE
    INC NEXT_HANDLE
    RTS
```

### Interrupt Dispatch System

**Generated Runtime System:**
```assembly
; Hardware interrupt entry point calls callback functions
IRQ_ENTRY:
    PHA                     ; Save registers
    TXA
    PHA
    TYA
    PHA

    ; Check interrupt source
    LDA $D019               ; VIC interrupt register
    AND #$01
    BEQ CHECK_TIMER         ; Not raster interrupt

    ; Call raster callback function
    LDA RASTER_HANDLER_HI
    BEQ NO_HANDLER          ; No callback registered
    PHA                     ; Push high byte
    LDA RASTER_HANDLER_LO
    PHA                     ; Push low byte

    ; Restore registers for callback
    PLA
    TAY
    PLA
    TAX
    PLA
    RTS                     ; Jump to callback (callback will save/restore)

; Callback functions handle their own state preservation
rasterHandler:
    PHA                     ; Callback saves state
    TXA
    PHA
    ; ... callback body ...
    PLA                     ; Callback restores state
    TAX
    PLA
    RTI                     ; Return from interrupt
```

---

## Implementation Requirements

### 1. Language Specification Changes ✅ COMPLETED

**Grammar Updates:**
```ebnf
function_declaration = ["callback"] "function" identifier "(" parameter_list ")" [ ":" type_annotation ] ...
primitive_type = "byte" | "word" | "boolean" | "void" | "callback" ;
```

**Semantic Rules:**
- `callback` functions can have any parameters and return types
- `callback` functions can be exported
- `callback` modifier enables functions to be used as function pointers
- Both `callback` and regular functions can be called directly

### 2. Lexer Changes Required

**New Token:**
```typescript
CALLBACK = 'CALLBACK'

export const KEYWORDS = new Set([
  // existing keywords...
  'callback'
]);
```

### 3. AST Changes Required

**Function Declaration Enhancement:**
```typescript
export interface FunctionDeclaration extends Blend65ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  parameters: Parameter[];
  returnType: TypeAnnotation | null;
  body: Statement[];
  exported: boolean;
  callback: boolean;          // NEW: Callback function flag
}
```

**New Primitive Type:**
```typescript
export interface PrimitiveType extends TypeAnnotation {
  type: 'PrimitiveType';
  name: 'byte' | 'word' | 'boolean' | 'void' | 'callback';  // Add 'callback'
}
```

### 4. Parser Changes Required

**Function Declaration Parsing:**
```typescript
private parseDeclaration(): Declaration | null {
  const exported = this.match(TokenType.EXPORT);
  const callback = this.match(TokenType.CALLBACK);  // NEW: Handle callback keyword

  if (this.match(TokenType.FUNCTION)) {
    return this.parseFunctionDeclaration(exported, callback);
  }

  if (callback) {
    throw new Error("'callback' modifier can only be used with functions");
  }
  // ... rest of parsing
}
```

**Type Annotation Parsing:**
```typescript
private parseTypeAnnotation(): TypeAnnotation {
  if (this.checkLexeme('byte') || this.checkLexeme('word') ||
      this.checkLexeme('boolean') || this.checkLexeme('void') ||
      this.checkLexeme('callback')) {  // NEW: Handle callback type
    return this.parsePrimitiveType();
  }
  // ... rest of type parsing
}
```

---

## Complete Usage Examples

### Example 1: Interrupt-Driven Game (Bubble Escape Pattern)

```js
module Game.BubbleEscape
import setRasterInterrupt, enableInterrupts from c64.interrupts
import setSpritePosition, readCollisions from c64.vic

var bubbleX: byte = 100
var bubbleY: byte = 100
var gameRunning: boolean = true

// Hardware interrupt callback - called 60 times per second
callback function gameLoop(): void
    // Move bubble based on input
    if joystickLeft() then
        bubbleX -= 2
    elsif joystickRight() then
        bubbleX += 2
    end if

    setSpritePosition(0, bubbleX, bubbleY)

    // Check hardware collision detection
    var collisions: byte = readCollisions()
    if collisions != 0 then
        handleBubblePop()
    end if
end function

callback function handleBubblePop(): void
    playPopSound()
    respawnBubble()
end function

export function main(): void
    setRasterInterrupt(251, gameLoop)   // gameLoop called by hardware
    enableInterrupts()

    while gameRunning
        // Main loop can handle background tasks
        updateScore()
        checkLevelComplete()
    end while
end function
```

### Example 2: AI System (Elite Pattern)

```js
module Game.AISystem
import setSpritePosition from c64.sprites

// AI behavior callbacks
callback function traderAI(): void
    moveTowardStation()
    if nearStation() then
        dockAndTrade()
    end if
end function

callback function pirateAI(): void
    var target: byte = findWeakestTarget()
    if target != 255 then
        attackTarget(target)
    else
        patrolArea()
    end if
end function

callback function policeAI(): void
    if crimeDetected() then
        pursueTarget()
    else
        patrolRoute()
    end if
end function

// AI dispatch system using callback arrays
var aiTypes: callback[3] = [traderAI, pirateAI, policeAI]

function updateAllShips(): void
    for i = 0 to shipCount - 1
        if ships[i].active then
            var aiType: byte = ships[i].aiType
            aiTypes[aiType]()  // Execute AI for this ship type
        end if
    next i
end function
```

### Example 3: Menu System (General UI Pattern)

```js
module Game.MenuSystem

// Menu action callbacks
callback function newGame(): void
    resetPlayer()
    resetEnemies()
    currentState = PLAYING
end function

callback function loadGame(): void
    if savedGameExists() then
        loadPlayerData()
        currentState = PLAYING
    else
        showErrorMessage("No saved game")
    end if
end function

callback function showOptions(): void
    displayOptionsMenu()
    currentState = OPTIONS
end function

callback function quitToBasic(): void
    saveSettings()
    exitProgram()
end function

// Dynamic menu system
var mainMenuActions: callback[4] = [newGame, loadGame, showOptions, quitToBasic]
var selectedItem: byte = 0

function handleMainMenu(): void
    if joystickUp() then
        selectedItem = (selectedItem - 1) % 4
    elsif joystickDown() then
        selectedItem = (selectedItem + 1) % 4
    elsif joystickFire() then
        mainMenuActions[selectedItem]()  // Execute selected action
    end if
end function
```

### Example 4: Mixed Hardware + Software Callbacks

```js
module Game.CompleteExample
import setRasterInterrupt, setTimerInterrupt from c64.interrupts

// Hardware interrupt callbacks
callback function frameUpdate(): void
    updateAllSprites()
    checkHardwareCollisions()
end function

callback function musicDriver(): void
    playNextMusicFrame()
end function

// Game logic callbacks
callback function playerUpdate(): void
    handlePlayerInput()
    updatePlayerPhysics()
end function

callback function enemyUpdate(): void
    updateEnemyAI()
    updateEnemyPhysics()
end function

// System callbacks
callback function systemUpdate(): void
    updateScore()
    checkLevelComplete()
end function

function initGame(): void
    // Hardware callbacks - hardware will call these
    setRasterInterrupt(250, frameUpdate)  // 60 FPS graphics
    setTimerInterrupt(1000, musicDriver)  // 1kHz music

    // Software callbacks - we call these manually
    var updateCallbacks: callback[3] = [playerUpdate, enemyUpdate, systemUpdate]

    enableInterrupts()

    while gameRunning
        // Execute software callbacks in main loop
        for i = 0 to 2
            updateCallbacks[i]()
        next i
    end while
end function
```

---

## 6502 Assembly Pattern Mapping

### Real 6502 Jump Table Pattern

```assembly
; Traditional 6502 AI dispatch
AI_HANDLERS:
    .word TraderAI      ; Function addresses
    .word PirateAI
    .word PoliceAI

; Usage:
LDY ship_type       ; 0, 1, or 2
LDA AI_HANDLERS,Y   ; Get low byte
STA jump_addr
LDA AI_HANDLERS+1,Y ; Get high byte
STA jump_addr+1
JSR (jump_addr)     ; Call AI function
```

### Blend65 Callback Compilation

```js
// Blend65 source
var aiHandlers: callback[3] = [traderAI, pirateAI, policeAI]
aiHandlers[shipType]()
```

**Generated Assembly:**
```assembly
; Callback array compilation
aiHandlers:
    .word traderAI      ; Addresses of callback functions
    .word pirateAI
    .word policeAI

; Array access: aiHandlers[shipType]()
LDY shipType        ; Index into array
TYA
ASL                 ; Multiply by 2 (word size)
TAY
LDA aiHandlers,Y    ; Get function address low
STA temp_addr
LDA aiHandlers+1,Y  ; Get function address high
STA temp_addr+1
JSR (temp_addr)     ; Call callback function
```

---

## Implementation Phases

### Phase 1: Language Foundation (1 week)
- Add `CALLBACK` token to lexer
- Add `callback` primitive type to AST
- Update parser for callback function declarations
- Basic callback variable assignment

### Phase 2: Type System Integration (1 week)
- Callback type checking in semantic analysis
- Function-to-callback assignment validation
- Callback variable usage validation
- Array of callbacks support

### Phase 3: Code Generation (2 weeks)
- Function address resolution for callbacks
- Indirect function call generation
- Callback arrays and indexing
- Integration with interrupt dispatch system

### Phase 4: Library Integration (1 week)
- Implement `c64.interrupts` module with callback parameters
- Hardware API functions using callback types
- Testing with real interrupt handlers
- Documentation and examples

---

## Success Criteria

### Functional Requirements
- [x] Callback functions parse correctly with optional parameters/returns
- [ ] Callback variables can store callback function references
- [ ] Indirect function calls work through callback variables
- [ ] Callback arrays enable dynamic dispatch patterns
- [ ] Integration with interrupt system via library functions

### Game Pattern Support
- [ ] Hardware interrupts: `setRasterInterrupt(line, callback)`
- [ ] AI systems: `callback[4]` arrays for behavior dispatch
- [ ] Menu systems: Dynamic action selection with callbacks
- [ ] State machines: State handler dispatch with callbacks
- [ ] Mixed usage: Same callback functions for multiple purposes

### Type Safety
- [ ] Only callback functions can be assigned to callback variables
- [ ] Callback function calls are type-checked (future enhancement)
- [ ] Regular functions cannot be assigned to callback variables
- [ ] Array access bounds checking for callback arrays

### 6502 Compilation
- [ ] Callback functions generate proper 6502 function addresses
- [ ] Callback variables compile to 16-bit address storage
- [ ] Indirect calls generate efficient `JSR (address)` instructions
- [ ] Integration with hardware interrupt dispatch system

---

## Benefits of Callback Design

1. **Unified Solution**: Solves interrupts, AI, menus, state machines with one feature
2. **Developer Familiar**: Callback pattern known to all modern developers
3. **Type Safe**: `callback` type provides compile-time checking
4. **Flexible**: Can have parameters, return values, be exported
5. **6502 Efficient**: Maps directly to function addresses and indirect calls
6. **Future Extensible**: Can add signature validation later without syntax changes
7. **Simple Implementation**: Minimal parser changes, reuses existing type system

This design provides a **complete foundation** for both hardware interrupts and software function pointers with **maximum simplicity** and **minimum language complexity**.
