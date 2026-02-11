# Blend65 Language Features - Short List

**Date:** January 8, 2026  
**Purpose:** Comprehensive list of language features for C64-like game development  
**Status:** Planning Document

---

## ✅ Already Planned/Implemented

| # | Feature | Status | Document |
|---|---------|--------|----------|
| 1 | **Sprite/Graphics Importing** | Planned | `sprite-system-research.md` |
| 2 | **Memory-Mapped Variables (@map)** | In Progress | `map-codegen-architecture.md` |
| 3 | **Address-Of Operator (@variable)** | Planned | `address-of-operator-design.md` |
| 4 | **Inline Assembly Blocks** | Designed | `inline-assembly-design.md` |
| 5 | **Storage Classes** (@zp, @ram, @data) | ✅ Implemented | Language spec |
| 6 | **Module System** (import/export) | ✅ Implemented | Language spec |
| 7 | **Type System** (byte, word, void, etc.) | ✅ Implemented | Language spec |
| 8 | **Callback Functions** | ✅ Implemented | Language spec |
| 9 | **Control Flow** (if/while/for/match) | ✅ Implemented | Language spec |
| 10 | **Enums and Type Aliases** | ✅ Implemented | Language spec |

---

## 🔴 Priority 1: Critical Missing Features

### Hardware & System

| # | Feature | Criticality | Description |
|---|---------|-------------|-------------|
| 10 | **Interrupt/IRQ System** ✅ Researched | ⭐⭐⭐⭐⭐ | Raster interrupts, music, smooth animation (see `interrupt-irq-system-research.md`) |
| 11 | **Inline Assembly Blocks** ✅ Designed | ⭐⭐⭐⭐⭐ | Raw 6502 for performance-critical code (see `inline-assembly-design.md`) |
| 12 | **Bit Manipulation Operators** ✅ Researched | ⭐⭐⭐⭐⭐ | Bit test/set/clear, bitfields for hardware (see `bit-manipulation-research.md`) |
| 13 | **Joystick/Input System** | ⭐⭐⭐⭐⭐ | Player control, keyboard, mouse |
| 14 | **Timing/Synchronization** ✅ Researched | ⭐⭐⭐⭐⭐ | waitFrame(), delay(), frame counters (see `timing-synchronization-research.md`) |

### Math & Data

| # | Feature | Criticality | Description |
|---|---------|-------------|-------------|
| 15 | **Fixed-Point Math** | ⭐⭐⭐⭐ | Smooth movement, velocities, physics |
| 16 | **Random Number Generator** | ⭐⭐⭐⭐ | Enemy spawning, procedural generation |
| 17 | **Lookup Table Generation** | ⭐⭐⭐ | Compile-time sin/cos/multiply tables |

---

## 🟡 Priority 2: Important Features

### Graphics & Display

| # | Feature | Criticality | Description |
|---|---------|-------------|-------------|
| 18 | **Sprite Collision Detection** | ⭐⭐⭐ | Hardware collision helpers |
| 19 | **Charset/Character Set Manipulation** | ⭐⭐⭐ | Custom fonts, tile sets |
| 20 | **Color Palette Management** | ⭐⭐⭐ | Color cycling, palette effects |
| 21 | **Screen Buffer Management** | ⭐⭐ | Double buffering, page flipping |
| 22 | **Raster Split Helpers** | ⭐⭐ | Split-screen effects, status bars |

### Text & Data

| # | Feature | Criticality | Description |
|---|---------|-------------|-------------|
| 23 | **String/Text Utilities** | ⭐⭐⭐ | PETSCII conversion, text rendering, number formatting |
| 24 | **Data Structures** | ⭐⭐ | Linked lists, stacks, queues for game logic |
| 25 | **Binary Data Packing** | ⭐⭐ | Efficient level data, bit-packed flags |

### Memory & Storage

| # | Feature | Criticality | Description |
|---|---------|-------------|-------------|
| 26 | **Bank Switching** | ⭐⭐ | Access >64KB memory on C128/X16 |
| 27 | **Memory Management Helpers** | ⭐⭐ | Heap allocation, memory pools (optional) |
| 28 | **Compression/Decompression** | ⭐ | Exomizer, RLE, LZ4 support |

---

## 🟢 Priority 3: Nice-to-Have Features

### Audio

| # | Feature | Criticality | Description |
|---|---------|-------------|-------------|
| 29 | **Music/Sound System** | ⭐⭐⭐ | High-level SID API, music playback |
| 30 | **Sound Effect System** | ⭐⭐ | Simple SFX triggers, samples |

### Advanced Graphics

| # | Feature | Criticality | Description |
|---|---------|-------------|-------------|
| 31 | **Sprite Multiplexing** | ⭐⭐ | >8 sprites via IRQ multiplexing |
| 32 | **Bitmap Graphics Helpers** | ⭐⭐ | Line, circle, fill algorithms |
| 33 | **Scroll Engine** | ⭐⭐ | Hardware scrolling, parallax |

### Game Development Tools

| # | Feature | Criticality | Description |
|---|---------|-------------|-------------|
| 34 | **Save/Load Game State** | ⭐⭐ | Serialize to disk/tape |
| 35 | **Debugging Support** | ⭐⭐⭐ | Assertions, debug output, breakpoints |
| 36 | **Profiling/Performance** | ⭐⭐ | Cycle counting, memory usage |
| 37 | **Unit Testing Framework** | ⭐⭐ | Test game logic |

### Code Organization

| # | Feature | Criticality | Description |
|---|---------|-------------|-------------|
| 38 | **Macros/Code Generation** | ⭐⭐ | Compile-time code generation |
| 39 | **Conditional Compilation** | ⭐⭐ | Platform-specific code, debug builds |
| 40 | **Link-Time Optimization** | ⭐ | Dead code elimination, inlining |

---

## 🔵 Platform-Specific Features

### C64-Specific

| # | Feature | Description |
|---|---------|-------------|
| 41 | **VIC-II Chip Helpers** | Direct register manipulation, sprites, scrolling |
| 42 | **SID Chip Helpers** | Sound synthesis, filters, waveforms |
| 43 | **CIA Chip Helpers** | Timers, interrupts, I/O ports |
| 44 | **Disk Drive Commands** | Fast loaders, directory access |
| 45 | **Tape I/O** | Turbo loaders, tape markers |

### Commander X16-Specific

| # | Feature | Description |
|---|---------|-------------|
| 46 | **VERA Graphics Chip** | Advanced sprites, layers, tile maps |
| 47 | **Banked RAM Access** | 2MB RAM banking |
| 48 | **YM2151 Sound Chip** | FM synthesis |
| 49 | **Mouse Support** | X16-specific mouse API |

### VIC-20-Specific

| # | Feature | Description |
|---|---------|-------------|
| 50 | **VIC Chip Helpers** | Character graphics, colors |
| 51 | **Memory Expansion** | 3K/8K/16K+ RAM expansion handling |
| 52 | **Character-Based Sprites** | Software sprite system |

---

## 🟣 Standard Library Modules (Suggested)

### Core Modules

| Module | Description |
|--------|-------------|
| `system.memory` | copyMemory(), fillMemory(), compareMemory() |
| `system.random` | random(), randomSeed(), randomBool() |
| `system.timing` | waitFrame(), delay(), getFrameCount() |
| `system.input` | readJoystick(), readKeyboard() |
| `system.math` | fixedMul(), fixedDiv(), sqrt(), abs() |

### Hardware Modules (C64)

| Module | Description |
|--------|-------------|
| `c64.vic` | Sprite control, screen setup, raster IRQs |
| `c64.sid` | Sound playback, music, SFX |
| `c64.cia` | Timers, interrupts, port I/O |
| `c64.graphics` | Screen clear, charset, colors |
| `c64.sprites` | Sprite setup, collision, multiplexing |

### Game Development Modules

| Module | Description |
|--------|-------------|
| `game.collision` | AABB, circle, sprite collision detection |
| `game.entity` | Entity management, component system |
| `game.particles` | Simple particle effects |
| `game.tilemap` | Tile-based level loading and rendering |

---

## 📋 Additional Features to Consider

### Error Handling

| # | Feature | Description |
|---|---------|-------------|
| 53 | **Error Handling** | Basic try/catch or error return values |
| 54 | **Panic/Fatal Error** | Controlled program termination |

### Advanced Language Features

| # | Feature | Description |
|---|---------|-------------|
| 55 | **Generics** | Generic functions and types (future) |
| 56 | **Traits/Interfaces** | Abstract behaviors (future) |
| 57 | **Lambda Functions** | Anonymous callbacks (future) |
| 58 | **Coroutines** | Cooperative multitasking (future) |

### Tooling

| # | Feature | Description |
|---|---------|-------------|
| 59 | **Debugger Integration** | VICE debugger support |
| 60 | **Emulator Automation** | Automated testing in emulators |
| 61 | **Asset Pipeline** | Integrated sprite/music conversion |
| 62 | **Live Reload** | Hot-swap code during development |

---

## 🎯 Implementation Priority Matrix

### Phase 1: Core Game Development (3-6 months)
- Interrupts/IRQ system
- Inline assembly
- Bit manipulation
- Joystick input
- Timing functions
- Fixed-point math
- Random number generator

### Phase 2: Graphics & Polish (2-4 months)
- Sprite collision
- Charset manipulation
- String utilities
- Lookup tables
- Screen buffer management

### Phase 3: Advanced Features (2-3 months)
- Bank switching
- Sound/music system
- Sprite multiplexing
- Debugging tools
- Standard library modules

### Phase 4: Platform-Specific (Ongoing)
- Platform-specific optimizations
- Additional hardware support
- Extended standard library

---

## 📊 Feature Comparison with Other Languages

| Feature | Blend65 | Kick Assembler | CC65 | LLVM-MOS |
|---------|---------|----------------|------|----------|
| Memory-mapped vars | ✅ @map | ❌ Manual | ❌ Manual | ❌ Manual |
| Sprites import | ✅ Planned | ✅ Yes | ❌ No | ❌ No |
| Type system | ✅ Strong | ❌ Weak | ✅ C types | ✅ C types |
| Modules | ✅ Yes | ⚠️ Limited | ⚠️ C headers | ⚠️ C headers |
| Inline asm | 🔲 Planned | ✅ Native | ✅ Yes | ✅ Yes |
| Interrupts | 🔲 Planned | ✅ Yes | ⚠️ Manual | ⚠️ Manual |

---

## 📝 Notes

### Design Philosophy
- **Zero-cost abstractions**: High-level features compile to optimal 6502 code
- **Type safety**: Catch errors at compile time
- **Readability**: Code should be self-documenting
- **Platform integration**: Embrace hardware, don't hide it
- **Modern syntax**: Familiar to contemporary developers

### Compatibility Goals
- **C64**: Primary target, full hardware support
- **C128**: C64 mode + extended features
- **VIC-20**: Core features, adapted for limitations
- **PET**: Text-based features
- **Commander X16**: Modern target with extended capabilities

---

## 🔗 Related Documents

- Language Specification: `docs/language-specification.md`
- Sprite System: `plans/features/sprite-system-research.md`
- Memory Mapping: `plans/features/map-codegen-architecture.md`
- Address-Of Operator: `plans/features/address-of-operator-design.md`

---

**Document Status:** Comprehensive Feature List  
**Last Updated:** January 8, 2026  
**Next Steps:** Prioritize and create detailed design documents for Priority 1 features
