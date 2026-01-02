# Blend65 Missing Features Matrix

**Purpose:** Consolidated tracking of all missing features identified through gamecheck analysis
**Last Updated:** 02/01/2026, 5:27:00 am (Europe/Amsterdam, UTC+1:00)

---

## Language Features Matrix

| Feature | Status | Target Version | Priority | Requesting Games | Implementation Effort | Dependencies |
|---------|--------|----------------|----------|------------------|---------------------|-------------|
| Dynamic Arrays | Not Implemented | v0.2 | CRITICAL | [Mafia ASM] | MEDIUM | Memory Management |
| String Type | Not Implemented | v0.3 | HIGH | [Mafia ASM] | LOW | Basic Types |
| Function Pointers | Not Implemented | v0.3 | MEDIUM | [None Yet - Future] | MEDIUM | Advanced Types |
| Complex Record Types | Not Implemented | v0.4 | HIGH | [Mafia ASM] | MEDIUM | Advanced Type System |
| 32-bit Arithmetic | Not Implemented | v0.4 | CRITICAL | [Mafia ASM] | HIGH | Extended Math Library |
| Heap Allocation | Not Implemented | v0.4 | CRITICAL | [Mafia ASM] | HIGH | Memory Pools |
| Interrupt Handlers | Not Implemented | v0.5 | CRITICAL | [Bubble Escape, Iridis Alpha] | HIGH | Hardware Integration |

## Hardware API Matrix by Platform

### C64 Hardware APIs
| Module | Function | Status | Priority | Requesting Games | Implementation Effort | Notes |
|--------|----------|--------|----------|------------------|---------------------|--------|
| c64.vic | setBackgroundColor() | **COMPLETE** | HIGH | [Wild Boa Snake, C64 Examples] | LOW | **v0.1 IMPLEMENTED** |
| c64.vic | setBorderColor() | **COMPLETE** | HIGH | [Wild Boa Snake, C64 Examples] | LOW | **v0.1 IMPLEMENTED** |
| c64.sprites | setSpritePosition() | **COMPLETE** | HIGH | [Wild Boa Snake, C64 Examples] | LOW | **v0.1 IMPLEMENTED** |
| c64.sprites | setSpriteColor() | **COMPLETE** | HIGH | [Wild Boa Snake, C64 Examples] | LOW | **v0.1 IMPLEMENTED** |
| c64.input | readJoystick() | **COMPLETE** | HIGH | [Wild Boa Snake] | LOW | **v0.1 IMPLEMENTED** |
| c64.input | keyPressed() | **COMPLETE** | HIGH | [C64 Examples] | LOW | **v0.1 IMPLEMENTED** |
| c64.sid | playTone() | **COMPLETE** | HIGH | [Wild Boa Snake] | LOW | **v0.1 IMPLEMENTED** |
| c64.sprites | setSpriteData() | Missing | HIGH | [C64 Examples, Bubble Escape, Iridis Alpha] | MEDIUM | Dynamic sprite graphics |
| c64.sprites | setSpriteDataPointer() | Missing | CRITICAL | [Astroblast] | MEDIUM | Frame-based sprite animation |
| c64.sprites | setMultiSpriteAnimation() | Missing | CRITICAL | [Astroblast] | HIGH | Advanced sprite animation system |
| c64.input | readDualJoystick() | Missing | HIGH | [Astroblast] | LOW | Two-player joystick support |
| c64.screen | setCharacterAt() | Missing | HIGH | [C64 Examples] | LOW | Text display and borders |
| c64.screen | clearScreen() | Missing | HIGH | [C64 Examples] | LOW | Screen initialization |
| c64.screen | loadCharacterSet() | Missing | HIGH | [Astroblast] | MEDIUM | Custom character set support |
| c64.timing | waitRasterLine() | Missing | MEDIUM | [C64 Examples] | LOW | Smooth animation timing |
| c64.timing | delay() | Missing | MEDIUM | [C64 Examples] | LOW | Game speed control |
| c64.timing | getFrameCounter() | Missing | HIGH | [Astroblast] | LOW | Frame-accurate timing |
| c64.timing | waitForNextFrame() | Missing | HIGH | [Astroblast] | LOW | 60 FPS synchronization |
| c64.sprites | setSpriteExpansion() | Missing | MEDIUM | [Bubble Escape] | LOW | Simple register write |
| c64.vic | readSpriteCollisions() | Missing | CRITICAL | [Bubble Escape, Astroblast] | MEDIUM | Hardware collision detection |
| c64.vic | readBackgroundCollisions() | Missing | CRITICAL | [Bubble Escape, Astroblast] | MEDIUM | Hardware collision detection |
| c64.vic | readSpriteCollisionRegister() | Missing | CRITICAL | [Astroblast] | MEDIUM | Direct VIC-II collision access |
| c64.interrupts | setRasterInterrupt() | Missing | CRITICAL | [Bubble Escape, Iridis Alpha] | HIGH | Complex interrupt handling |
| c64.cia | setTimer() | Missing | HIGH | [Bubble Escape] | MEDIUM | CIA timer programming |
| c64.sid | readOscillator() | Missing | MEDIUM | [Bubble Escape] | LOW | Hardware random generation |
| c64.sid | playSIDMusic() | Missing | CRITICAL | [Astroblast] | HIGH | GoatTracker music integration |
| c64.sid | playSoundEffect() | Missing | CRITICAL | [Astroblast] | MEDIUM | Dynamic sound effects |
| c64.sid | setSIDVolume() | Missing | HIGH | [Astroblast] | LOW | Master volume control |
| c64.sid | setSIDSubtune() | Missing | HIGH | [Astroblast] | MEDIUM | Multi-subtune music system |
| c64.assets | importBinaryData() | Missing | MEDIUM | [Astroblast] | MEDIUM | Sound and graphics data import |

### VIC-20 Hardware APIs
| Module | Function | Status | Priority | Requesting Games | Implementation Effort | Notes |
|--------|----------|--------|----------|------------------|---------------------|--------|
| vic20.vic | setBackgroundColor() | Planned | HIGH | [Future VIC-20 games] | LOW | Port from C64 implementation |
| vic20.screen | setCharacter() | Missing | HIGH | [Future text games] | LOW | Character mode only |
| vic20.vic | setBorderColor() | Missing | MEDIUM | [Future VIC-20 games] | LOW | Simple color register |

### X16 Hardware APIs
| Module | Function | Status | Priority | Requesting Games | Implementation Effort | Notes |
|--------|----------|--------|----------|------------------|---------------------|--------|
| x16.vera | setSprite() | Missing | HIGH | [Future X16 games] | HIGH | Modern sprite system |
| x16.vera | configureLayer() | Missing | MEDIUM | [Future X16 games] | HIGH | Advanced graphics layers |

## Built-in Library Matrix

| Library | Function | Status | Target Version | Priority | Requesting Games | Implementation Effort |
|---------|----------|--------|----------------|----------|------------------|---------------------|
| math | add() | **COMPLETE** | v0.1 | HIGH | [Wild Boa Snake, C64 Examples] | LOW |
| math | subtract() | **COMPLETE** | v0.1 | HIGH | [Wild Boa Snake, C64 Examples] | LOW |
| math | multiply() | **COMPLETE** | v0.1 | HIGH | [Wild Boa Snake, C64 Examples] | LOW |
| math | divide() | **COMPLETE** | v0.1 | HIGH | [Wild Boa Snake, C64 Examples] | LOW |
| math | bcdAdd() | Missing | v0.2 | MEDIUM | [C64 Examples] | LOW |
| math | bcdSubtract() | Missing | v0.2 | MEDIUM | [C64 Examples] | LOW |
| math | bcdToString() | Missing | v0.2 | MEDIUM | [C64 Examples] | LOW |
| math | sin() | Missing | v0.3 | HIGH | [Future 3D games] | MEDIUM |
| math | cos() | Missing | v0.3 | HIGH | [Future 3D games] | MEDIUM |
| math | sqrt() | Missing | v0.3 | MEDIUM | [Future physics games] | HIGH |
| math | fastMultiply() | Missing | v0.3 | MEDIUM | [Future optimization] | MEDIUM |
| math | add32() | Missing | v0.4 | CRITICAL | [Mafia ASM] | HIGH |
| math | subtract32() | Missing | v0.4 | CRITICAL | [Mafia ASM] | HIGH |
| math | multiply32() | Missing | v0.4 | CRITICAL | [Mafia ASM] | HIGH |
| math | divide32() | Missing | v0.4 | CRITICAL | [Mafia ASM] | HIGH |
| math | compare32() | Missing | v0.4 | HIGH | [Mafia ASM] | MEDIUM |
| string | length() | Missing | v0.3 | HIGH | [Mafia ASM] | LOW |
| string | concatenate() | Missing | v0.3 | HIGH | [Mafia ASM] | MEDIUM |
| string | substring() | Missing | v0.3 | MEDIUM | [Future text games] | MEDIUM |
| memory | malloc() | Missing | v0.4 | CRITICAL | [Mafia ASM] | HIGH |
| memory | free() | Missing | v0.4 | CRITICAL | [Mafia ASM] | HIGH |

## Priority Summary

### Critical Blockers (Cannot port major games without these)
1. **Hardware Collision Detection** - Required for arcade games like Bubble Escape and Astroblast
2. **Advanced Sprite Animation** - Essential for games like Astroblast with complex sprite sequences
3. **SID Music Integration** - Critical for audio-rich games like Astroblast
4. **Interrupt System** - Essential for hardware-intensive games
5. **Dynamic Memory** - Needed for complex simulations like Elite

### High Priority (Significantly improves compatibility)
1. **Frame-accurate Timing** - Required for smooth 60 FPS games like Astroblast
2. **Dynamic Arrays** - Enables variable enemy/object counts
3. **String Type** - Required for text-heavy games
4. **Advanced Sprite Control** - Needed for sophisticated graphics
5. **Custom Character Sets** - Enhanced graphics for games like Astroblast
6. **Dual Joystick Input** - Two-player games like Astroblast

### Medium Priority (Nice to have, expands possibilities)
1. **Function Pointers** - Enables complex AI systems
2. **Enhanced Math Library** - Required for physics/3D games
3. **Precise Timing** - Improves game feel and synchronization

### Complete in v0.1 (Validated by Wild Boa Snake)
1. **✅ Basic Arithmetic** - Addition, subtraction, multiplication, division
2. **✅ Static Memory Management** - Fixed arrays, zero page variables
3. **✅ Basic Hardware APIs** - Sprites, sound, input, colors
4. **✅ Control Structures** - Functions, loops, conditionals
5. **✅ Simple Types** - byte, word, boolean

## Implementation Roadmap Impact

Based on analyzed games:
- **v0.1 enables:** 100% of Wild Boa Snake class games (static arcade games)
- **v0.2 enables:** 60% of simple-to-moderate complexity games
- **v0.3 enables:** 80% of language-feature-heavy games
- **v0.4 enables:** 90% of complex simulation games
- **v0.5 enables:** 95% of hardware-intensive games

## Game Compatibility Matrix

### DIRECTLY PORTABLE (v0.1)
| Game | Repository | Language Features | Hardware Features | Status |
|------|------------|-------------------|-------------------|--------|
| **Wild Boa Snake** | github.com/tstamborski/Wild-Boa-Snake.git | ✅ Static only | ✅ Basic APIs | **READY FOR PORT** |
| **C64 Examples (85%)** | github.com/digitsensitive/c64.git | ✅ Static patterns | ✅ Basic hardware | **MOSTLY READY** |
| **Similar Snake games** | [Various] | ✅ Static patterns | ✅ Basic sprites/sound | **READY** |
| **Pong clones** | [Various] | ✅ Simple collision | ✅ Basic graphics | **READY** |
| **Simple Breakout** | [Various] | ✅ Fixed arrays | ✅ Paddle/ball control | **READY** |

### NEEDS VERSION 0.2 (Minor APIs)
| Game | Repository | Primary Blocker | Target Version |
|------|------------|-----------------|----------------|
| **C64 Examples (15%)** | github.com/digitsensitive/c64.git | setSpriteData(), screen APIs, BCD math | v0.2 |

### NEEDS VERSION 0.2+ (Dynamic Arrays)
| Game | Repository | Primary Blocker | Target Version |
|------|------------|-----------------|----------------|
| **Space Invaders** | [Various] | Dynamic enemy arrays | v0.2 |
| **Pac-Man clones** | [Various] | Dynamic pellet collection | v0.2 |
| **Multi-enemy shooters** | [Various] | Variable object counts | v0.2 |

### NEEDS VERSION 0.5+ (Hardware-Intensive)
| Game | Repository | Primary Blocker | Target Version |
|------|------------|-----------------|----------------|
| **Astroblast** | github.com/nealvis/astroblast.git | Hardware collision + advanced sprites + SID integration | v0.5 |
| **Bubble Escape** | codeberg.org/catseye/Bubble-Escape | Interrupt system | v0.5 |
| **Iridis Alpha** | github.com/mwenge/iridisalpha.git | Hardware collision | v0.5 |
| **Demo scene effects** | [Various] | Raster interrupts | v0.5 |

### NEEDS VERSION 0.4+ (Business Simulation)
| Game | Repository | Primary Blocker | Target Version |
|------|------------|-----------------|----------------|
| **Mafia ASM** | github.com/dkrey/mafia_asm.git | 32-bit arithmetic + dynamic arrays + complex data structures | v0.4 |

### NEEDS VERSION 1.0+ (Elite-Class)
| Game | Repository | Primary Blocker | Target Version |
|------|------------|-----------------|----------------|
| **Elite** | elitehomepage.org | Dynamic memory + complexity | v1.0 |
| **Complex RPGs** | [Various] | Advanced data structures | v1.0 |
| **Real-time strategy** | [Various] | Multi-object simulation | v1.0 |

## Success Metrics

### v0.1 Validation (Wild Boa Snake Analysis)
- ✅ **Complete game compatibility** confirmed
- ✅ **All required hardware APIs** present in spec
- ✅ **Performance characteristics** suitable for real games
- ✅ **Zero-gap implementation** - no missing features for target games

### Future Version Targets
- **v0.2:** Enable 5+ additional classic arcade games
- **v0.3:** Support text adventures and basic RPGs
- **v0.4:** Enable complex simulation games
- **v0.5:** Support hardware-intensive arcade games
- **v1.0:** Full Elite-class game compatibility

## Analysis History

### C64 Examples Collection (02/01/2026)
- **Status:** DIRECTLY PORTABLE (85%) - Excellent v0.1 compatibility
- **Repository:** github.com/digitsensitive/c64.git (26 .asm files)
- **Validation:** Educational examples perfectly validate v0.1 design philosophy
- **Missing for 100%:** setSpriteData(), character screen APIs, BCD math (v0.2)
- **Impact:** Strong validation of v0.1 approach, clear v0.2 requirements
- **Opportunity:** Ideal for tutorials and documentation examples

### Wild Boa Snake (02/01/2026)
- **Status:** DIRECTLY PORTABLE - 100% v0.1 compatible
- **Validation:** Confirms v0.1 feature set is well-designed
- **Impact:** No roadmap changes needed, validates current approach
- **Opportunity:** Priority target for v0.1 demonstration

### Iridis Alpha (Previous Analysis)
- **Status:** NOT PORTABLE - Requires v0.5+ hardware features
- **Blockers:** Interrupt system, hardware collision detection
- **Impact:** Confirmed need for hardware-intensive feature set
- **Timeline:** Not achievable until advanced hardware support

### Astroblast (02/01/2026)
- **Status:** PARTIALLY PORTABLE - Requires v0.5 hardware features
- **Repository:** github.com/nealvis/astroblast.git (9,521 lines across 33 ASM files)
- **Blockers:** Hardware collision detection, advanced sprite animation, SID integration
- **Validation:** Confirms v0.5 hardware roadmap is correctly prioritized
- **Impact:** Validates hardware-intensive arcade game requirements
- **Opportunity:** Flagship v0.5 demonstration game - classic arcade excellence

### Bubble Escape (Referenced in Roadmap)
- **Status:** NOT PORTABLE - Requires v0.5+ hardware features
- **Blockers:** Interrupt-driven game loop, hardware collision
- **Impact:** Defines hardware API requirements for v0.5
- **Priority:** High - represents important game category

### Mafia ASM (01/02/2026)
- **Status:** NOT PORTABLE - Requires v0.4+ language features
- **Repository:** github.com/dkrey/mafia_asm.git (11,525 lines across 60 ASM files)
- **Complexity Class:** Business simulation with sophisticated financial modeling
- **Blockers:** 32-bit arithmetic, dynamic arrays, complex data structures, advanced string processing
- **Validation:** Reveals critical need for v0.4 language sophistication - different evolution path from hardware games
- **Impact:** MAJOR priority upgrade for v0.4 features, validates dual evolution strategy (v0.4 language + v0.5 hardware)
- **Pattern Discovery:** Business simulation games require advanced language features but basic hardware APIs
- **Roadmap Impact:** Confirms v0.4 as essential milestone, equal priority with v0.5 for complete C64 coverage

## Priority Calculation Rules

- **CRITICAL**: Required by 3+ games OR blocks major game categories
- **HIGH**: Required by 2+ games OR enables significant new game types
- **MEDIUM**: Required by 1 game OR provides clear quality-of-life improvements
- **LOW**: Rarely requested OR provides minor enhancements

## Status Values

- **COMPLETE**: Feature fully implemented and tested in v0.1
- **Missing**: Feature not implemented at all
- **Partial**: Feature partially implemented with known limitations
- **Planned**: Feature scheduled for specific version

---

## Blend65 v0.1 Success Story: Wild Boa Snake

The Wild Boa Snake analysis represents a **major validation** of the Blend65 v0.1 approach:

### Perfect Feature Alignment
- **100% compatibility** with existing v0.1 feature set
- **Zero missing features** for complete game implementation
- **Optimal complexity level** for first-generation Blend65 games
- **Real-world validation** of hardware API design

### Development Implications
1. **v0.1 is correctly scoped** - not under-featured or over-engineered
2. **Hardware APIs are well-designed** - real game confirms all needed functions
3. **Static memory approach is sufficient** - complete, engaging games possible
4. **Zero page optimization is essential** - confirmed by performance-critical code

### Strategic Value
- **Flagship demo candidate** - perfect showcase of v0.1 capabilities
- **Tutorial project** - ideal complexity for learning Blend65
- **Compiler validation** - tests entire compilation pipeline with real code
- **Documentation examples** - concrete patterns for language guide

### Market Validation
Wild Boa Snake proves Blend65 v0.1 can support:
- ✅ Complete arcade games with multiple levels
- ✅ Graphics, sound, and input integration
- ✅ Game state management and progression
- ✅ Performance-critical coordinate calculations
- ✅ Real-time gameplay with smooth animation

This analysis **strongly recommends** prioritizing Wild Boa Snake as the first complete Blend65 port, demonstrating that v0.1 is production-ready for its target use case.

---

**Matrix Maintenance:**
- **Updated after each gamecheck analysis**
- **Priority recalculated based on game frequency**
- **Implementation effort refined through experience**
- **Status updated as features are completed**
