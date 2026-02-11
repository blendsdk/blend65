# Interrupt/IRQ System - Research & Implementation Plan

**Feature**: Interrupt/IRQ System  
**Priority**: ⭐⭐⭐⭐⭐ Critical (Priority 1)  
**Status**: Research Complete  
**Date**: January 9, 2026

---

## Executive Summary

The Interrupt/IRQ System is a **Priority 1 Critical Feature** for Blend65. It enables hardware interrupts for raster effects, music playback, sprite multiplexing, and smooth animation - essential capabilities for professional C64 game development.

**Key Finding**: This is a **library/runtime feature** - the language already supports `callback` functions. What's needed is the **system infrastructure** to register callbacks with hardware interrupt vectors.

---

## What Is the Interrupt/IRQ System?

A comprehensive system for handling 6502 hardware interrupts:

1. **IRQ (Interrupt Request)** - Maskable hardware interrupts (VIC-II raster, CIA timers)
2. **NMI (Non-Maskable Interrupt)** - Critical interrupts (RESTORE key)
3. **Raster Interrupts** - Trigger callbacks at specific screen positions
4. **Timer Interrupts** - CIA timer-based periodic callbacks
5. **Interrupt Chaining** - Multiple handlers for different purposes

---

## Why Is This Critical? ⭐⭐⭐⭐⭐

### Essential for Advanced C64 Development

**Without Interrupts:**
- ❌ No raster effects (split screens, color bars)
- ❌ No sprite multiplexing (stuck with 8 sprites max)
- ❌ Music playback blocks game logic
- ❌ Jerky, imprecise timing
- ❌ Amateur-looking games

**With Interrupts:**
- ✅ Professional split-screen effects
- ✅ 20+ sprites via multiplexing
- ✅ Background music playback (non-blocking)
- ✅ Precise timing for smooth animation
- ✅ Professional-quality games

### Real-World Use Cases

Every major C64 game uses interrupts:
- **Parallax scrolling** - Change background colors per scanline
- **Status bars** - Different graphics mode for HUD
- **Sprite multiplexing** - Reuse sprites at different Y positions
- **Music drivers** - SID playback at 50Hz/60Hz
- **Color cycling** - Animate colors in background

---

## Current State in Blend65

### ✅ Already Supported (Language Level)

```js
// Callback function syntax exists
callback function myIRQ(): void
  vicBorderColor = 1;
end function

// Memory-mapped hardware access exists
@map vicIRQStatus at $D019: byte;
@map vicIRQEnable at $D01A: byte;

// Zero page for fast IRQ handlers
@zp let frameCount: byte = 0;
```

### ❌ What's Missing (System Level)

No infrastructure to actually USE these callbacks:
- No functions to register IRQ handlers
- No interrupt vector management ($FFFE/$FFFF)
- No automatic register save/restore
- No IRQ acknowledgment handling
- No hardware configuration helpers
- No interrupt chaining support

**Developers must manually:**
- Write assembly to set vectors
- Manually save/restore registers
- Handle IRQ acknowledgment
- Configure VIC-II/CIA registers
- Implement chaining themselves

---

## Proposed Solution: `c64.irq` Module

### Core IRQ Management

```js
module c64.irq

/**
 * Set raster interrupt at specific scanline
 * @param line - Raster line (0-311 PAL, 0-261 NTSC)
 * @param handler - Callback function to execute
 */
export function setRasterIRQ(line: word, handler: callback): void
  // Configure VIC-II for raster interrupt
  // Set IRQ vector to handler
  // Enable raster interrupt
end function

/**
 * Set vertical blank interrupt (end of frame)
 * @param handler - Callback function to execute
 */
export function setVBlankIRQ(handler: callback): void
  // Configure for scanline 0 or last line
  // Set IRQ vector
end function

/**
 * Add additional IRQ handler (chaining)
 * @param line - Raster line for trigger
 * @param handler - Callback function
 */
export function addIRQHandler(line: word, handler: callback): void
  // Add to interrupt chain
end function

/**
 * Remove IRQ handler
 * @param handler - Callback to remove
 */
export function removeIRQHandler(handler: callback): void
  // Remove from chain
end function

/**
 * Enable interrupts globally
 */
export function enableIRQ(): void
  // CLI instruction
end function

/**
 * Disable interrupts globally
 */
export function disableIRQ(): void
  // SEI instruction
end function

/**
 * Restore system IRQ handler
 */
export function restoreSystemIRQ(): void
  // Restore KERNAL IRQ vector
end function

end module
```

---

## Usage Examples

### Example 1: Simple Raster IRQ

```js
import { setRasterIRQ, enableIRQ } from "c64.irq"

@map vicBorderColor at $D020: byte;
@zp let colorIndex: byte = 0;

callback function rasterIRQ(): void
  // Change border color at raster line 100
  vicBorderColor = colorIndex;
  colorIndex += 1;
end function

export function main(): void
  setRasterIRQ(100, rasterIRQ);
  enableIRQ();
  
  // Main loop continues
  while true
    // Game logic here
  end while
end function
```

### Example 2: Music Playback

```js
import { setVBlankIRQ, enableIRQ } from "c64.irq"
import { playMusicFrame } from "sound.music"

callback function musicIRQ(): void
  // Called every frame (50Hz PAL)
  playMusicFrame();
end function

export function main(): void
  initMusic();
  setVBlankIRQ(musicIRQ);
  enableIRQ();
  
  // Game runs, music plays in background
  gameLoop();
end function
```

### Example 3: Split Screen Effect

```js
import { addIRQHandler, enableIRQ } from "c64.irq"

@map vicBackgroundColor at $D021: byte;
@map vicBorderColor at $D020: byte;

callback function topScreenIRQ(): void
  // Top area - game graphics
  vicBackgroundColor = 0;  // Black
  vicBorderColor = 0;
end function

callback function statusBarIRQ(): void
  // Bottom area - status bar
  vicBackgroundColor = 5;  // Green
  vicBorderColor = 5;
end function

export function main(): void
  addIRQHandler(50, topScreenIRQ);
  addIRQHandler(200, statusBarIRQ);
  enableIRQ();
  
  gameLoop();
end function
```

### Example 4: Sprite Multiplexing

```js
import { setRasterIRQ } from "c64.irq"

@map vicSpriteY0 at $D001: byte;
@map vicSpriteY1 at $D003: byte;

let spriteData: byte[20];  // 20 logical sprites
@zp let currentSprite: byte = 0;

callback function multiplexIRQ(): void
  // Reposition sprites for next batch
  if currentSprite < 8 then
    vicSpriteY0 = spriteData[currentSprite];
    vicSpriteY1 = spriteData[currentSprite + 1];
    currentSprite += 2;
  else
    currentSprite = 0;
  end if
end function

export function main(): void
  setRasterIRQ(100, multiplexIRQ);
  setRasterIRQ(150, multiplexIRQ);
  setRasterIRQ(200, multiplexIRQ);
  enableIRQ();
  
  gameLoop();
end function
```

---

## Implementation Architecture

### Phase 1: Basic IRQ Support

**Goal:** Single IRQ handler, no chaining

**Components:**

1. **IRQ Vector Management**
   - Save original KERNAL vector
   - Set new vector to runtime handler
   - Restore on exit

2. **Register Save/Restore**
   - Automatic push/pop of A, X, Y
   - Status register handling
   - Stack management

3. **Hardware Configuration**
   - VIC-II raster interrupt setup
   - IRQ acknowledgment ($D019)
   - Enable/disable raster IRQ

4. **Runtime Handler**
   - Entry point for all IRQs
   - Call user callback
   - Acknowledge interrupt
   - Return via RTI

**Deliverables:**
- Single handler registration
- Raster IRQ support
- Basic VBlank support

---

### Phase 2: IRQ Chaining

**Goal:** Multiple handlers at different raster lines

**Components:**

1. **Handler Chain**
   - Linked list of handlers
   - Sorted by raster line
   - Dynamic add/remove

2. **Smart Dispatcher**
   - Check which line triggered
   - Call appropriate handler(s)
   - Set next raster line

3. **Line Management**
   - Handle 9th bit of raster ($D011)
   - Wrap around at 312/263 lines
   - Race condition prevention

**Deliverables:**
- Multiple handlers per frame
- Add/remove handlers dynamically
- Raster line sorting

---

### Phase 3: CIA Timer Interrupts

**Goal:** Time-based interrupts (not just raster)

**Components:**

1. **CIA Timer Setup**
   - Configure CIA1/CIA2 timers
   - Set timer intervals
   - NMI vs IRQ selection

2. **Timer Callbacks**
   - Register timer handlers
   - Periodic callbacks
   - One-shot vs continuous

**Deliverables:**
- CIA timer support
- Time-based callbacks
- NMI support

---

### Phase 4: Advanced Features

**Goal:** Professional features for complex games

**Components:**

1. **Priority System**
   - Handler priorities
   - Preemption support
   - Critical section handling

2. **Performance Optimization**
   - Fast dispatch
   - Minimal overhead
   - Zero-page optimization

3. **Debugging Support**
   - IRQ statistics
   - Missed interrupt detection
   - Performance profiling

**Deliverables:**
- Priority-based dispatch
- Debugging tools
- Performance metrics

---

## Technical Implementation Details

### IRQ Vector Setup (C64)

```js
// IRQ vectors
@map irqVectorLo at $FFFE: byte;
@map irqVectorHi at $FFFF: byte;

function setIRQVector(handler: word): void
  disableIRQ();
  
  // Save original vector
  originalIRQLo = irqVectorLo;
  originalIRQHi = irqVectorHi;
  
  // Set new vector
  irqVectorLo = handler & $FF;
  irqVectorHi = (handler >> 8) & $FF;
  
  enableIRQ();
end function
```

### VIC-II Raster Setup

```js
@map vicControl1 at $D011: byte;
@map vicRasterLine at $D012: byte;
@map vicIRQStatus at $D019: byte;
@map vicIRQEnable at $D01A: byte;

function setupRasterIRQ(line: word): void
  // Set raster line (lower 8 bits)
  vicRasterLine = line & $FF;
  
  // Set 9th bit if needed
  if line > 255 then
    vicControl1 = vicControl1 | $80;
  else
    vicControl1 = vicControl1 & $7F;
  end if
  
  // Enable raster interrupt
  vicIRQEnable = $01;
  
  // Acknowledge any pending
  vicIRQStatus = $01;
end function
```

### IRQ Handler Template

```asm
; Runtime IRQ handler (generated code)
IRQHandler:
    ; Save registers
    PHA
    TXA
    PHA
    TYA
    PHA
    
    ; Call user callback
    JSR UserCallback
    
    ; Acknowledge VIC-II interrupt
    LDA #$01
    STA $D019
    
    ; Restore registers
    PLA
    TAY
    PLA
    TAX
    PLA
    
    ; Return from interrupt
    RTI
```

---

## Platform-Specific Considerations

### Commodore 64

| Aspect | Details |
|--------|---------|
| **IRQ Vector** | $FFFE/$FFFF |
| **NMI Vector** | $FFFA/$FFFB |
| **Raster Lines** | 312 (PAL) / 263 (NTSC) |
| **VIC-II IRQ** | Raster, sprite collision, light pen |
| **CIA1 IRQ** | Timer A, Timer B, TOD, serial, flag |
| **CIA2 NMI** | Timer A, flag pin |

### VIC-20

Similar to C64 but:
- VIC chip (not VIC-II)
- Fewer interrupt sources
- Different raster line count

### Commander X16

Modern hardware:
- VERA chip interrupts
- More sophisticated
- Multiple IRQ sources
- Better hardware support

---

## Testing Strategy

### Unit Tests

```js
// Test handler registration
test("Register single IRQ handler", function(): void
  let called = false;
  
  callback function testIRQ(): void
    called = true;
  end function
  
  setRasterIRQ(100, testIRQ);
  triggerIRQ();  // Test helper
  
  assert(called);
end test);

// Test multiple handlers
test("Multiple IRQ handlers", function(): void
  let count = 0;
  
  callback function irq1(): void
    count += 1;
  end function
  
  callback function irq2(): void
    count += 10;
  end function
  
  addIRQHandler(50, irq1);
  addIRQHandler(100, irq2);
  
  triggerIRQAt(50);
  assert(count == 1);
  
  triggerIRQAt(100);
  assert(count == 11);
end test);
```

### Integration Tests

- Test on VICE emulator
- Test on real C64 hardware
- Verify timing accuracy
- Check for race conditions
- Test handler chaining
- Verify acknowledge works

### Performance Tests

- Measure IRQ overhead (cycles)
- Test maximum handlers
- Stress test chaining
- Profile dispatch time
- Check for missed interrupts

---

## Implementation Phases - Detailed Task Breakdown

### Phase 1: Core IRQ Infrastructure (2-3 weeks)

#### Task 1.1: IRQ Vector Management
- [ ] Implement setIRQVector() function
- [ ] Save original KERNAL vector
- [ ] Restore vector on cleanup
- [ ] Test vector setup/restore
- [ ] Handle edge cases

#### Task 1.2: Register Save/Restore
- [ ] Implement register push/pop
- [ ] Handle status register
- [ ] Optimize stack usage
- [ ] Test register preservation
- [ ] Document calling convention

#### Task 1.3: VIC-II Raster Setup
- [ ] Implement raster line configuration
- [ ] Handle 9th bit ($D011)
- [ ] Enable/disable raster IRQ
- [ ] Acknowledge interrupt ($D019)
- [ ] Test on different raster lines

#### Task 1.4: Basic Handler Registration
- [ ] Implement setRasterIRQ()
- [ ] Implement setVBlankIRQ()
- [ ] Implement enableIRQ()
- [ ] Implement disableIRQ()
- [ ] Test basic registration

#### Task 1.5: Runtime Dispatcher
- [ ] Create IRQ entry point
- [ ] Call user callback
- [ ] Acknowledge hardware
- [ ] Return via RTI
- [ ] Test complete flow

**Dependencies:** None (uses existing language features)

---

### Phase 2: IRQ Chaining (2 weeks)

#### Task 2.1: Handler Chain Data Structure
- [ ] Design linked list structure
- [ ] Implement add handler
- [ ] Implement remove handler
- [ ] Sort by raster line
- [ ] Test chain operations

#### Task 2.2: Smart Dispatcher
- [ ] Check current raster line
- [ ] Find matching handler(s)
- [ ] Set next raster line
- [ ] Handle race conditions
- [ ] Test dispatcher logic

#### Task 2.3: Dynamic Management
- [ ] Implement addIRQHandler()
- [ ] Implement removeIRQHandler()
- [ ] Handle empty chain
- [ ] Test add/remove during IRQ
- [ ] Document limitations

**Dependencies:** Phase 1 complete

---

### Phase 3: CIA Timer Interrupts (1-2 weeks)

#### Task 3.1: CIA Timer Setup
- [ ] Implement timer configuration
- [ ] Set timer intervals
- [ ] Enable timer IRQ
- [ ] Handle CIA1/CIA2
- [ ] Test timer accuracy

#### Task 3.2: Timer Callbacks
- [ ] Register timer handlers
- [ ] Periodic vs one-shot
- [ ] Acknowledge CIA interrupt
- [ ] Test timer callbacks
- [ ] Document timing precision

#### Task 3.3: NMI Support
- [ ] Implement NMI vector setup
- [ ] Handle RESTORE key
- [ ] NMI handler registration
- [ ] Test NMI functionality
- [ ] Document NMI usage

**Dependencies:** Phase 1 complete

---

### Phase 4: Advanced Features (1-2 weeks)

#### Task 4.1: Priority System
- [ ] Design priority levels
- [ ] Implement priority sorting
- [ ] Test preemption
- [ ] Document priority rules
- [ ] Optimize dispatch

#### Task 4.2: Debugging Tools
- [ ] IRQ call counter
- [ ] Missed interrupt detection
- [ ] Performance profiling
- [ ] Debug output helpers
- [ ] Test debugging features

#### Task 4.3: Optimization
- [ ] Profile current implementation
- [ ] Optimize dispatcher
- [ ] Use zero page efficiently
- [ ] Minimize overhead
- [ ] Benchmark improvements

**Dependencies:** Phase 1-3 complete

---

## File Structure

```
packages/compiler/src/stdlib/
  c64/
    irq.b65                 # Main IRQ module
    irq-vectors.b65         # Vector management
    irq-dispatcher.b65      # Runtime dispatcher
    irq-vic.b65             # VIC-II helpers
    irq-cia.b65             # CIA timer helpers

packages/compiler/src/runtime/
  6502/
    irq-entry.asm           # Assembly IRQ entry point
    irq-dispatch.asm        # Dispatch logic
    register-save.asm       # Register preservation

packages/compiler/src/__tests__/stdlib/
  irq-basic.test.ts         # Basic functionality
  irq-chain.test.ts         # Chaining tests
  irq-timing.test.ts        # Timing tests
  irq-integration.test.ts   # Full integration

docs/stdlib/
  c64-irq.md                # IRQ system documentation
  irq-examples.md           # Usage examples
  irq-performance.md        # Performance guide
```

---

## Dependencies & Integration

### Language Features Required (All Exist ✅)

- ✅ `callback` functions
- ✅ Memory-mapped variables (`@map`)
- ✅ Zero page variables (`@zp`)
- ✅ Module system
- ✅ Function pointers (callback type)

### Integration with Other Features

| Feature | Integration Point |
|---------|------------------|
| **Timing/Synchronization (#14)** | Uses IRQ for frame sync |
| **Music/Sound (#29)** | Music playback via IRQ |
| **Sprite Multiplexing (#31)** | Raster IRQ for sprite reuse |
| **Raster Split (#22)** | Multiple IRQ handlers |
| **Inline Assembly (#11)** | Optimize IRQ handlers |

### External Dependencies

- **Phase 1-2:** None
- **Phase 3:** CIA chip documentation
- **Phase 4:** Performance profiling tools

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Single IRQ handler works
- [ ] Raster interrupt triggers correctly
- [ ] VBlank interrupt works
- [ ] Registers preserved properly
- [ ] Clean enable/disable
- [ ] Tests pass
- [ ] Documentation complete

### Phase 2 Complete When:
- [ ] Multiple handlers work
- [ ] Dynamic add/remove works
- [ ] Handlers sorted by line
- [ ] No missed interrupts
- [ ] Race conditions handled
- [ ] Chain tests pass

### Phase 3 Complete When:
- [ ] CIA timer IRQ works
- [ ] NMI support functional
- [ ] Timer accuracy verified
- [ ] All tests pass

### Phase 4 Complete When:
- [ ] Priority system works
- [ ] Debugging tools functional
- [ ] Performance optimized
- [ ] Full test coverage

---

## Risk Assessment

### High Risk ⚠️

- **Timing-critical code** - Must be cycle-accurate
- **Hardware complexity** - VIC-II quirks, race conditions
- **Register corruption** - Improper save/restore breaks system
- **Interrupt storms** - Too many handlers, missed interrupts

### Medium Risk ⚠️

- **Platform differences** - PAL vs NTSC timing
- **Chaining complexity** - Multiple handlers difficult to debug
- **Performance overhead** - IRQ dispatch must be fast

### Low Risk ✅

- **Language support** - Callback syntax already exists
- **Well-documented** - VIC-II IRQ well understood
- **Community support** - Many examples available

### Mitigation Strategies

1. **Start simple** - Phase 1 single handler first
2. **Extensive testing** - Real hardware and emulator
3. **Safety checks** - Detect missed interrupts
4. **Documentation** - Clear examples and warnings
5. **Performance budget** - Profile early, optimize often

---

## Open Questions

1. **Should we support KERNAL IRQ chaining?**
   - Chain to system IRQ for compatibility?
   - Or take full control?

2. **How to handle IRQ during handler?**
   - Re-entrant handlers?
   - Or disable IRQ during execution?

3. **Memory allocation for chain?**
   - Static allocation (limited handlers)?
   - Dynamic allocation (more complex)?

4. **CIA timer defaults?**
   - What frequency for music (50Hz/60Hz)?
   - Configurable or automatic?

5. **Error handling strategy?**
   - What if handler registration fails?
   - Return error code or panic?

---

## Comparison with Other Languages

### CC65 (C for 6502)

```c
#include <c64.h>

void __interrupt myIRQ(void) {
    VIC.bordercolor++;
    VIC.int_flag = 0x01;
}

void setup() {
    SEI();
    *((unsigned short*)0xfffe) = (unsigned short)&myIRQ;
    VIC.imr = 0x01;
    CLI();
}
```

### Kick Assembler

```asm
SetupIRQ:
    sei
    lda #<IRQHandler
    sta $fffe
    lda #>IRQHandler
    sta $ffff
    lda #$01
    sta $d01a
    cli
    rts

IRQHandler:
    pha
    inc $d020
    lda #$01
    sta $d019
    pla
    rti
```

### Blend65 (Proposed)

```js
import { setRasterIRQ, enableIRQ } from "c64.irq"

callback function myIRQ(): void
  vicBorderColor += 1;
end function

setRasterIRQ(100, myIRQ);
enableIRQ();
```

**Advantages:**
- ✅ High-level, clean API
- ✅ Automatic register handling
- ✅ Type-safe callbacks
- ✅ No manual hardware setup
- ✅ Platform abstraction

---

## Documentation Requirements

### API Documentation

Complete JSDoc for all functions:
- Purpose and behavior
- Parameters and types
- Return values
- Side effects
- Performance notes
- Platform-specific notes
- Examples

### User Guide Sections

1. **Introduction**
   - What are interrupts?
   - When to use IRQ system
   - Basic concepts

2. **Quick Start**
   - Simple raster IRQ example
   - VBlank music player
   - Step-by-step tutorial

3. **Advanced Usage**
   - Multiple handlers
   - Sprite multiplexing
   - Split-screen effects
   - Performance optimization

4. **Hardware Details**
   - VIC-II registers
   - CIA timers
   - Timing diagrams
   - Race conditions

5. **Troubleshooting**
   - Common problems
   - Debugging techniques
   - Performance issues
   - Hardware quirks

### Code Examples

Complete working examples:
- Basic raster effect
- Music player integration
- Split-screen game
- Sprite multiplexer
- Color cycling demo

---

## Timeline & Resources

### Estimated Effort

| Phase | Duration | Complexity |
|-------|----------|------------|
| Phase 1: Core IRQ | 2-3 weeks | Medium |
| Phase 2: Chaining | 2 weeks | Medium |
| Phase 3: CIA/NMI | 1-2 weeks | Low |
| Phase 4: Advanced | 1-2 weeks | Medium |
| **Total** | **6-9 weeks** | - |

### Resource Requirements

- C64 hardware or accurate emulator (VICE)
- VIC-II documentation
- CIA chip documentation
- Timing diagrams
- Test ROMs for validation

### Prerequisites

- Existing callback syntax (✅ Complete)
- Memory-mapped variables (✅ Complete)
- Module system (✅ Complete)
- Basic code generation (✅ Complete)

---

## Next Steps

### Immediate Actions (This Week)

1. **Create module structure** - Set up file hierarchy
2. **Design handler registration API** - Finalize function signatures
3. **Prototype Phase 1** - Basic single handler
4. **Write initial tests** - Test framework setup
5. **Document hardware details** - VIC-II register reference

### Short Term (Next 2 Weeks)

6. **Implement Phase 1** - Core IRQ infrastructure
7. **Test on emulator** - VICE testing
8. **Create examples** - Basic raster IRQ demos
9. **Real hardware testing** - Test on actual C64
10. **Documentation** - API docs and user guide

### Medium Term (Next 1-2 Months)

11. **Implement Phase 2** - IRQ chaining
12. **Implement Phase 3** - CIA timers
13. **Implement Phase 4** - Advanced features
14. **Integration testing** - With other features
15. **Performance optimization** - Profile and optimize
16. **Polish** - Bug fixes, edge cases, documentation

---

## References

### Hardware Documentation

- Commodore 64 Programmer's Reference Guide
- VIC-II chip datasheet
- CIA 6526 chip datasheet
- Raster timing diagrams

### Existing Implementations

- CC65 interrupt support
- VICE emulator source code
- Kick Assembler IRQ macros
- Classic C64 game disassemblies

### Community Resources

- Lemon64 forums
- C64 Scene Database (CSdb)
- 6502.org interrupt discussions
- Codebase64 wiki

---

## Summary

The **Interrupt/IRQ System** is critical for professional C64 game development:

✅ **Language support exists** - `callback` functions already implemented  
✅ **Clear architecture** - 4 phases, incremental delivery  
✅ **Well-documented problem** - Extensive hardware documentation  
✅ **High value** - Enables advanced effects and music  
✅ **Foundation for other features** - Required by many Priority 1 features

**Recommended Approach:**
1. Start with **Phase 1** - Core single handler (2-3 weeks)
2. Validate with real games and effects
3. Add **Phase 2** - Chaining for complex effects (2 weeks)
4. Expand to **Phase 3** - CIA timers (1-2 weeks)
5. Polish with **Phase 4** - Advanced features (1-2 weeks)

**Total Estimated Effort:** 6-9 weeks for complete implementation

**Critical Success Factors:**
- Cycle-accurate timing
- Robust register handling
- Extensive hardware testing
- Clear documentation and examples

---

**Document Status:** Research Complete - Ready for Implementation  
**Last Updated:** January 9, 2026  
**Next Action:** Begin Phase 1 implementation - Core IRQ infrastructure
