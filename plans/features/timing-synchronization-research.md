# Timing/Synchronization - Research & Implementation Plan

**Feature**: Timing/Synchronization  
**Priority**: ⭐⭐⭐⭐⭐ Critical (Priority 1)  
**Status**: Research Complete  
**Date**: January 9, 2026

---

## Executive Summary

Timing/Synchronization is a **Priority 1 Critical Feature** for Blend65. Every game needs frame synchronization, smooth animation timing, and screen tear prevention. This feature provides essential timing primitives through a standard library module.

**Key Finding**: This is a **library feature only** - NO language specification changes required. Uses existing Blend65 syntax and features.

---

## What Is Timing/Synchronization?

Essential timing operations for 6502/C64 game development:

1. **Frame synchronization** - Lock game loop to display refresh (50Hz PAL / 60Hz NTSC)
2. **Delays** - Wait for specific time periods
3. **Frame counting** - Track elapsed time/frames
4. **Raster synchronization** - Wait for specific screen positions (advanced effects)

---

## Why Is This Critical? ⭐⭐⭐⭐⭐

### Every Game Needs These

```js
function gameLoop(): void
  while true
    handleInput();
    updateGameLogic();
    drawGraphics();
    waitFrame();  // ← CRITICAL! Without this, game runs uncontrolled
  end while
end function
```

**Without `waitFrame()`:**
- ❌ Game runs at unpredictable speeds
- ❌ Different speed on PAL vs NTSC
- ❌ Screen tearing (graphics glitches)
- ❌ Wasted CPU cycles
- ❌ Music/sound timing breaks

**With `waitFrame()`:**
- ✅ Stable 50Hz/60Hz frame rate
- ✅ Smooth, predictable gameplay
- ✅ No screen tearing
- ✅ Consistent across systems
- ✅ Proper music/sound synchronization

---

## Current State in Blend65

### ✅ Already Supported (No Changes Needed)

Blend65 already has all the language features needed:

```js
// Callback functions for interrupts
callback function vblankIRQ(): void
  frameCount += 1;
end function

// Memory-mapped hardware access
@map rasterLine at $D012: byte;

// Zero page for performance
@zp let frameCount: word = 0;

// Module system
module system.timing
export function waitFrame(): void
end module
```

### ❌ What's Missing

No high-level timing API! Developers must:
- Manually implement VBlank waiting
- Set up raster interrupts manually
- Track frame counts manually
- Calculate delays manually

**This is tedious and error-prone.**

---

## Proposed Solution: `system.timing` Module

### Standard Library Module

```js
module system.timing

/**
 * Wait for next vertical blank (frame sync)
 * Locks game loop to 50Hz (PAL) or 60Hz (NTSC)
 * Called once per game loop iteration
 */
export function waitFrame(): void
  // Implementation: Poll $D012 or use VBlank interrupt
end function

/**
 * Delay for N frames
 * @param frames - Number of frames to wait
 */
export function delay(frames: byte): void
  for i = 0 to frames - 1
    waitFrame();
  next i
end function

/**
 * Get current frame count since start
 * @return Frame counter (wraps at 65535)
 */
export function getFrameCount(): word
  // Returns internal frame counter
end function

/**
 * Wait for specific raster line (advanced)
 * @param line - Raster line (0-311 PAL, 0-261 NTSC)
 */
export function waitRaster(line: byte): void
  // Polls $D012 until raster reaches line
end function

/**
 * Get current raster line (advanced)
 * @return Current raster beam position
 */
export function getRaster(): byte
  // Reads $D012 VIC-II register
end function

end module
```

---

## Usage Examples

### Example 1: Basic Game Loop

```js
import { waitFrame } from "system.timing"

function main(): void
  initGame();
  
  while true
    handleInput();
    updatePhysics();
    moveSprites();
    drawHUD();
    
    waitFrame();  // Lock to 50Hz/60Hz
  end while
end function
```

### Example 2: Timed Animation

```js
import { getFrameCount } from "system.timing"

@zp let lastAnimFrame: byte = 0;
let currentSprite: byte = 0;

function updateAnimation(): void
  let frame = getFrameCount();
  
  // Change sprite every 5 frames
  if (frame - lastAnimFrame) >= 5 then
    currentSprite = (currentSprite + 1) % 4;
    setSpriteData(0, sprites[currentSprite]);
    lastAnimFrame = frame;
  end if
end function
```

### Example 3: Splash Screen

```js
import { delay } from "system.timing"

function showSplashScreen(): void
  drawTitleScreen();
  delay(150);  // 3 seconds @ 50Hz
  clearScreen();
end function
```

### Example 4: Raster Effects

```js
import { waitRaster } from "system.timing"

function drawSplitScreen(): void
  // Game area (top)
  vic.backgroundColor = 0;  // Black
  
  // Wait for status bar
  waitRaster(200);
  
  // Status bar (bottom)
  vic.backgroundColor = 5;  // Green
end function
```

---

## Implementation Approaches

### Approach 1: VBlank Polling (Simple) ⭐ Phase 1

**For waitFrame():**

```js
@map rasterLine at $D012: byte;

export function waitFrame(): void
  // Wait for raster to reach bottom
  while rasterLine < 250
    // Busy wait
  end while
  
  // Wait for raster to reach top
  while rasterLine >= 250
    // Busy wait
  end while
end function
```

**Pros:**
- ✅ Simple implementation
- ✅ No interrupt setup needed
- ✅ Works immediately

**Cons:**
- ⚠️ Burns CPU cycles (busy waiting)
- ⚠️ Can't do background tasks

**Status:** **Recommended for Phase 1** - Get it working fast

---

### Approach 2: Raster Interrupt (Efficient) ⭐ Phase 2

**Setup:**

```js
@zp let frameReady: boolean = false;
@zp let frameCount: word = 0;

callback function vblankIRQ(): void
  frameReady = true;
  frameCount += 1;
  
  // Optional: Call music player
  if musicEnabled then
    playMusicFrame();
  end if
end function

export function waitFrame(): void
  frameReady = false;
  while not frameReady
    // Could do other work here
  end while
end function

export function getFrameCount(): word
  return frameCount;
end function
```

**Pros:**
- ✅ Efficient - no CPU waste
- ✅ Allows background tasks
- ✅ Professional approach

**Cons:**
- ⚠️ Requires interrupt setup
- ⚠️ More complex

**Status:** **Recommended for Phase 2** - Optimize later

---

## Platform-Specific Considerations

### Commodore 64 (Primary Target)

| Aspect | Details |
|--------|---------|
| **VBlank frequency** | 50Hz (PAL) / 60Hz (NTSC) |
| **Raster lines** | 312 (PAL) / 263 (NTSC) |
| **Safe VBlank** | Lines 251-311 (PAL) |
| **Raster register** | `$D012` (VIC-II) |
| **Interrupt** | Raster IRQ via VIC-II |

### VIC-20

Similar to C64, different VIC chip but same timing concepts.

### Commander X16

- VERA chip (different from VIC-II)
- 60Hz default
- Has VBlank interrupt
- More sophisticated timing

### Platform Abstraction

The `system.timing` module **abstracts platform differences**:

```js
// Same code works everywhere
import { waitFrame } from "system.timing"

// Compiler generates platform-specific code:
// - C64: VIC-II $D012 polling or raster IRQ
// - VIC-20: VIC polling
// - X16: VERA VBlank interrupt
```

---

## Implementation Roadmap

### Phase 1: Core Functions (1 week) ⭐ PRIORITY

**Goal:** Get basic timing working

**Tasks:**
1. Create `system.timing` module file
2. Implement `waitFrame()` - polling-based
3. Implement `delay(frames)` - uses waitFrame()
4. Implement `getFrameCount()` - global counter
5. Add C64-specific memory-mapped registers
6. Write basic tests

**Deliverables:**
- Working `system.timing` module
- Basic polling implementation
- Unit tests
- Documentation

**Dependencies:** None - uses existing language features

---

### Phase 2: Raster Functions (1 week)

**Goal:** Advanced raster control

**Tasks:**
1. Implement `waitRaster(line)` - poll $D012
2. Implement `getRaster()` - read $D012
3. Add raster validation (line ranges)
4. Test raster effects
5. Document raster usage

**Deliverables:**
- Raster control functions
- Raster effect examples
- Integration tests

**Dependencies:** Phase 1 complete

---

### Phase 3: Interrupt-Based (2 weeks)

**Goal:** Efficient interrupt-driven timing

**Tasks:**
1. Design interrupt handler setup
2. Implement VBlank IRQ handler
3. Replace polling with interrupt wait
4. Automatic frame counting via IRQ
5. Music player integration support
6. Test interrupt stability

**Deliverables:**
- Interrupt-based waitFrame()
- IRQ handler infrastructure
- Performance tests

**Dependencies:** Phase 1 complete, Interrupt/IRQ System (#10)

---

### Phase 4: Platform Support (1 week)

**Goal:** Cross-platform compatibility

**Tasks:**
1. Add platform detection
2. Implement VIC-20 support
3. Implement X16 support
4. Platform-specific optimizations
5. Cross-platform tests

**Deliverables:**
- Multi-platform timing library
- Platform-specific code generation
- Compatibility tests

**Dependencies:** Phase 2 complete

---

## Testing Strategy

### Unit Tests

```js
// Test frame counting
let start = getFrameCount();
waitFrame();
let end = getFrameCount();
assert(end == start + 1);

// Test delay
let before = getFrameCount();
delay(10);
let after = getFrameCount();
assert(after >= before + 10);

// Test raster
let raster = getRaster();
assert(raster >= 0 and raster <= 311);
```

### Integration Tests

- Real C64 hardware testing
- Emulator testing (VICE)
- PAL vs NTSC timing verification
- Music player synchronization
- Frame rate stability measurement

### Performance Tests

- Measure `waitFrame()` CPU overhead
- Compare polling vs interrupt approaches
- Timing accuracy (use CIA timer as reference)
- Jitter measurement

---

## File Structure

```
packages/compiler/src/stdlib/
  system/
    timing.b65              # Main module implementation
    timing-c64.b65          # C64-specific implementation
    timing-vic20.b65        # VIC-20-specific
    timing-x16.b65          # Commander X16-specific

packages/compiler/src/__tests__/stdlib/
  timing.test.ts            # Unit tests
  timing-integration.test.ts # Integration tests
```

---

## Dependencies

### Language Features Required (All Exist ✅)

- ✅ Module system (`module`/`export`)
- ✅ Function declarations
- ✅ Basic types (`byte`, `word`, `boolean`, `void`)
- ✅ Callback functions (`callback`)
- ✅ Memory-mapped variables (`@map`)
- ✅ Storage classes (`@zp`)
- ✅ Control flow (`while`, `for`, `if`)

### External Dependencies

- **Phase 1-2:** None
- **Phase 3:** Interrupt/IRQ System (#10) - can work independently or wait

### Integration Points

Works with other Priority 1 features:

| Feature | Integration |
|---------|-------------|
| **Interrupt/IRQ System (#10)** | Phase 3 uses VBlank interrupt |
| **Inline Assembly (#11)** | Can optimize timing loops |
| **Joystick/Input (#13)** | Input polling needs frame sync |
| **Fixed-Point Math (#15)** | Smooth movement uses frame timing |
| **Music/Sound (#29)** | Music drivers need stable timing |

---

## Comparison with Other Languages

### CC65 (C for 6502)

```c
#include <c64.h>
void waitFrame() {
    while (VIC.rasterline != 0);
    while (VIC.rasterline == 0);
}
```

### Kick Assembler

```asm
WaitFrame:
    lda $d012
.loop:
    cmp $d012
    beq .loop
    rts
```

### Blend65 (Proposed)

```js
import { waitFrame } from "system.timing"
waitFrame();
```

**Advantage:** High-level, clean API with platform abstraction.

---

## Documentation Requirements

### API Documentation

Each function needs JSDoc:
- Purpose description
- Parameter descriptions
- Return value description
- Usage examples
- Performance notes
- Platform notes

### User Guide Sections

1. **Introduction** - Why timing matters
2. **Basic Usage** - waitFrame() examples
3. **Frame Counting** - Animation timing
4. **Raster Effects** - Advanced techniques
5. **Platform Differences** - PAL/NTSC, C64/VIC20/X16
6. **Performance** - Polling vs interrupt
7. **Best Practices** - Common patterns

### Code Examples

Complete working examples:
- Basic game loop
- Animated sprites
- Splash screens with delays
- Raster split effects
- Smooth scrolling

---

## Success Criteria

### Phase 1 Complete When:

- [x] `waitFrame()` works on C64
- [x] `delay(frames)` works correctly
- [x] `getFrameCount()` increments properly
- [x] No screen tearing in test game
- [x] Frame rate stable at 50Hz/60Hz
- [x] Unit tests pass
- [x] Documentation complete

### Phase 2 Complete When:

- [x] `waitRaster(line)` works correctly
- [x] Raster effects render properly
- [x] No timing glitches
- [x] Raster tests pass

### Phase 3 Complete When:

- [x] Interrupt-based timing works
- [x] Lower CPU overhead than polling
- [x] Music integration works
- [x] Stable under load

### Phase 4 Complete When:

- [x] Works on C64, VIC-20, X16
- [x] Automatic platform detection
- [x] Cross-platform tests pass

---

## Risk Assessment

### Low Risk ✅

- **Library-only feature** - No language changes
- **Well-understood problem** - Standard C64 technique
- **Simple implementation** - Polling approach straightforward
- **No breaking changes** - Pure addition

### Medium Risk ⚠️

- **Platform differences** - PAL vs NTSC, different hardware
- **Interrupt complexity** - Phase 3 needs careful testing
- **Performance tuning** - Optimize polling overhead

### Mitigation

- Start with simple polling (Phase 1)
- Test on real hardware early
- Provide both polling and interrupt options
- Extensive documentation and examples

---

## Open Questions

1. **Should we provide both polling and interrupt versions?**
   - Let users choose based on needs?
   - Or auto-detect best approach?

2. **How to handle PAL/NTSC detection?**
   - Runtime detection?
   - Compile-time flag?
   - Both?

3. **Music player integration?**
   - Automatic music playback in waitFrame()?
   - User callback registration?
   - Separate music module?

4. **Frame skip detection?**
   - Should we detect if frame took too long?
   - Warning or error?

---

## Next Steps

### Immediate Actions (This Week)

1. **Create module file** - `system.timing.b65`
2. **Implement Phase 1 functions** - Polling-based
3. **Write unit tests** - Basic functionality
4. **Create documentation** - API docs and examples
5. **Test on emulator** - VICE emulator testing

### Short Term (Next 2 Weeks)

6. **Implement Phase 2** - Raster functions
7. **Real hardware testing** - Test on actual C64
8. **Create examples** - Complete game demos
9. **Performance profiling** - Measure overhead

### Medium Term (Next Month)

10. **Implement Phase 3** - Interrupt-based (if IRQ system ready)
11. **Platform support** - VIC-20 and X16
12. **Integration** - Connect with other features
13. **Polish** - Optimize and refine

---

## References

### Hardware Documentation

- VIC-II chip datasheet
- C64 Programmer's Reference Guide
- Raster interrupt timing diagrams

### Existing Tools

- VICE emulator (for testing)
- CIA timer documentation
- Music player implementations (reSID)

### Community Resources

- Lemon64 forums
- C64 Scene Database (CSdb)
- 6502.org timing discussions

---

## Summary

**Timing/Synchronization** is essential for Blend65:

✅ **No language changes needed** - Pure library feature  
✅ **Clear implementation path** - 4 phases, each deliverable  
✅ **Low risk** - Well-understood problem  
✅ **High value** - Every game needs this  
✅ **Foundation for others** - Enables music, animation, input  

**Recommended Approach:**
1. Start with **Phase 1** - Simple polling (1 week)
2. Validate with real games
3. Add **Phase 2** - Raster control (1 week)
4. Optimize with **Phase 3** - Interrupts (2 weeks)
5. Expand to **Phase 4** - Multi-platform (1 week)

**Total Estimated Effort:** 5 weeks for complete implementation

---

**Document Status:** Research Complete - Ready for Implementation  
**Last Updated:** January 9, 2026  
**Next Action:** Begin Phase 1 implementation
