# Blend65 Implementation Plan - Multi-Target 6502 Compiler

**Status:** Ready for execution **Target:** Complete multi-target 6502 compiler for Blend65 **Estimated Timeline:** 6-10
months **Context Window Requirement:** Each task designed for <30K tokens

---

## Overview

This implementation plan creates Blend65, a multi-target compiler that compiles the same source code to different
6502-based machines. The architecture separates universal 6502 language features from target-specific hardware APIs.

---

## Project Structure

```
blend65/
├── packages/
│   ├── lexer/              # Universal token recognition
│   ├── ast/               # Universal Abstract Syntax Tree
│   ├── parser/            # Universal recursive descent parser
│   ├── types/             # Universal type system
│   ├── target-system/     # Target resolution and validation
│   ├── magic-phase/       # Universal AST transformation
│   └── codegen/           # Target-specific 6502 code generation
├── targets/
│   ├── c64/              # Commodore 64 target definition
│   ├── x16/              # Commander X16 target definition
│   ├── vic20/            # VIC-20 target definition (planned)
│   └── template/         # Template for new targets
├── research/             # Language specifications
└── implementation-plan/  # This folder with task breakdown
```

---

## Architecture Overview

### **Universal Compiler Core**

```
Source Code
    ↓
Universal Lexer (6502 core language)
    ↓
Universal AST (target-agnostic)
    ↓
Universal Parser (control flow, functions, etc.)
    ↓
Universal Type System (byte, word, arrays, records)
    ↓
Target Selection (--target=MACHINE)
    ↓
Target System (hardware API resolution)
    ↓
Magic Phase (AST transformation + validation)
    ↓
Target-Specific Code Generation
    ↓
Native Binary (PRG/BIN/etc.)
```

### **Multi-Target Support**

-   **Universal Core**: Language features that work on all 6502 targets
-   **Target System**: Modular hardware API resolution per machine
-   **Hardware APIs**: Function-based abstractions for sprites, sound, input, etc.
-   **Memory Layouts**: Target-specific zero page and memory organization
-   **Code Generation**: Optimized 6502 assembly per target

---

## Phase Breakdown

### **Phase 1: Universal Language Core (2-3 weeks)**

**Goal:** Implement the 6502 language features that work on all targets **Input:** New implementation (no existing
codebase) **Output:** Universal lexer, AST, parser, and type system **Tasks:** 6 tasks

### **Phase 2: Target System (3-4 weeks)**

**Goal:** Build the multi-target architecture **Input:** Universal language core **Output:** Target definition system
and resolution engine **Tasks:** 7 tasks

### **Phase 3: C64 Target Implementation (2-3 weeks)**

**Goal:** Complete C64 target with hardware APIs **Input:** Target system + Universal core **Output:** Working C64
compiler **Tasks:** 5 tasks

### **Phase 4: Commander X16 Target (2-3 weeks)**

**Goal:** Second target to validate multi-target architecture **Input:** Working target system **Output:** Working X16
compiler **Tasks:** 5 tasks

### **Phase 5: Magic Phase & Optimization (4-6 weeks)**

**Goal:** AST transformation, validation, and optimization **Input:** Target-resolved AST **Output:** Validated,
optimized intermediate representation **Tasks:** 6 tasks

### **Phase 6: Code Generation & Output (6-8 weeks)**

**Goal:** Target-specific 6502 code generation **Input:** Magic phase output **Output:** Native binaries for each target
**Tasks:** 8 tasks

---

## Task Dependencies

```
Phase 1: Universal Language Core
├── 1.1 Universal Lexer (tokens, keywords, operators)
├── 1.2 Universal AST Definitions (nodes for all language constructs)
├── 1.3 Universal Parser (expressions, statements, functions)
├── 1.4 Universal Type System (primitives, arrays, records)
├── 1.5 Module System (imports, exports, namespacing)
└── 1.6 Core Language Integration Testing
    ↓
Phase 2: Target System
├── 2.1 Target Definition Schema (TOML format, validation)
├── 2.2 Target Registry (loading, discovery, management)
├── 2.3 Import Resolution Engine (target:* → machine:*)
├── 2.4 Hardware API Validation (function signature checking)
├── 2.5 Memory Layout System (zero page, program area)
├── 2.6 Compiler Integration (--target flag, error handling)
└── 2.7 Target System Testing
    ↓
Phase 3: C64 Target Implementation
├── 3.1 C64 Target Definition (capabilities, memory layout)
├── 3.2 C64 Hardware APIs (sprites, VIC-II, SID, input)
├── 3.3 C64 Code Generation Templates
├── 3.4 C64 Memory Management
└── 3.5 C64 Integration Testing
    ↓
Phase 4: Commander X16 Target
├── 4.1 X16 Target Definition (VERA, YM2151, memory)
├── 4.2 X16 Hardware APIs (VERA graphics, sound)
├── 4.3 X16 Code Generation Templates
├── 4.4 X16 Memory Management
└── 4.5 X16 Integration Testing
    ↓
Phase 5: Magic Phase & Optimization
├── 5.1 AST Transformation Pipeline
├── 5.2 Static Memory Analysis & Validation
├── 5.3 Call Graph Construction & Recursion Prevention
├── 5.4 Dead Code Elimination
├── 5.5 Hardware Function Inlining Analysis
└── 5.6 Intermediate Representation Generation
    ↓
Phase 6: Code Generation & Output
├── 6.1 6502 Instruction Templates
├── 6.2 Register Allocation & Zero Page Management
├── 6.3 Target-Specific Assembly Generation
├── 6.4 Memory Layout & Linking
├── 6.5 Binary Output (PRG/BIN formats)
├── 6.6 Debug Information & Memory Maps
├── 6.7 Optimization Passes
└── 6.8 Final Integration & Testing
```

---

## Target Implementation Priority

### **Tier 1: Initial Targets (Phases 3-4)**

-   **Commodore 64** - Most popular, complete hardware feature set
-   **Commander X16** - Modern 6502, validates architecture scalability

### **Tier 2: Validation Targets (Post v1.0)**

-   **VIC-20** - Limited hardware (no sprites), tests feature subsetting
-   **Atari 2600** - Extreme constraints, validates minimal hardware support

### **Tier 3: Extended Family (Future)**

-   Commodore Plus/4, C128, CBM/PET series
-   Atari 5200, 7800
-   Apple II series
-   MEGA 65

---

## Success Criteria

### **Phase 1-2: Universal Foundation**

-   [ ] Parses all universal 6502 language constructs
-   [ ] Validates target-agnostic programs
-   [ ] Resolves target-specific imports correctly
-   [ ] Generates clear error messages for unsupported features

### **Phase 3-4: Multi-Target Validation**

-   [ ] Compiles same source code to both C64 and X16
-   [ ] Hardware API functions work correctly on real hardware
-   [ ] Target-specific optimizations applied appropriately
-   [ ] Memory layouts respect target constraints

### **Phase 5-6: Complete Compiler**

-   [ ] Produces working PRG/BIN files for real hardware
-   [ ] Meets performance requirements (optimal 6502 code)
-   [ ] Generates required artifacts (.map, .lst, etc.)
-   [ ] Handles error cases gracefully

---

## Development Workflow

### **For Each Task:**

1. **Read task specification** (single .md file in phase directory)
2. **Implement required functionality** as precisely specified
3. **Write comprehensive tests** for all new functionality
4. **Validate against success criteria** before proceeding
5. **Document any architectural decisions** or deviations

### **Context Management:**

-   Each task file is **self-contained** with clear requirements
-   **No cross-task dependencies** within phases
-   **Clear handoff artifacts** between phases
-   **Incremental validation** throughout development

### **Quality Assurance:**

-   **Unit tests** for all compiler components
-   **Integration tests** at phase boundaries
-   **Real hardware validation** for target implementations
-   **Performance benchmarking** against hand-written assembly

---

## Multi-Target Benefits

### **For Developers:**

-   **Write once, compile anywhere** - same code works on multiple machines
-   **Hardware abstraction** - clean APIs instead of register manipulation
-   **Type safety** - function signatures prevent hardware errors
-   **Performance** - zero-overhead hardware function inlining

### **For Language Evolution:**

-   **Easy target addition** - new 6502 machines added via target definitions
-   **Hardware innovation** - new chips supported without language changes
-   **Community contributions** - target definitions can be community-maintained
-   **Future-proof** - language outlives any single machine

### **For Ecosystem:**

-   **Consistent development** - same tools and patterns across machines
-   **Knowledge transfer** - skills apply to entire 6502 family
-   **Code sharing** - libraries work across different hardware
-   **Documentation** - unified reference for all supported machines

---

## Technical Innovations

### **1. Function-Based Hardware APIs**

```
// Instead of raw register access
import setSpritePosition, enableSprite from target:sprites
setSpritePosition(0, playerX, playerY)

// Compiles to optimal register sequences per target
```

### **2. Zero-Overhead Abstraction**

```
// Hardware function calls inline to direct register access
// No runtime overhead for abstraction
```

### **3. Target-Aware Type System**

```
// Memory constraints enforced per target
zp var counter: byte  // Uses available zero page per machine
```

### **4. Modular Architecture**

```
targets/c64/modules/sprites.blend65    // C64 VIC-II sprites
targets/x16/modules/vera.blend65       // X16 VERA sprites
targets/vic20/modules/screen.blend65   // VIC-20 character mode
```

---

## Getting Started

### **Prerequisites:**

-   Understanding of 6502 assembly language
-   Knowledge of target machine hardware (C64, X16)
-   Familiarity with compiler design principles

### **First Steps:**

1. **Start with Phase 1, Task 1.1** (Universal Lexer)
2. **Follow task instructions precisely**
3. **Write tests for each component**
4. **Validate before proceeding** to next task

### **Development Environment:**

-   **Version Control:** Git with feature branches per task
-   **Testing:** Automated tests + real hardware validation
-   **Documentation:** Update specs as implementation proceeds

---

## Notes for Implementation

-   **Incremental development** - each task builds on previous
-   **Test-driven approach** - write tests before implementation
-   **Real hardware focus** - validate on actual machines when possible
-   **Performance-conscious** - 6502 cycles matter for real-time code
-   **Modular design** - clean separation between universal and target-specific

---

## Risk Mitigation

### **Technical Risks:**

-   **Hardware API complexity** - Start simple, add features incrementally
-   **Target variations** - Design system for differences from day one
-   **Performance regression** - Benchmark against hand-written assembly
-   **Memory constraints** - Test on most restrictive target (Atari 2600)

### **Project Risks:**

-   **Scope creep** - Stick to defined phases and success criteria
-   **Target proliferation** - Focus on Tier 1 targets first
-   **Feature requests** - Defer non-essential features to post-v1.0
-   **Quality issues** - Maintain comprehensive test suite

---

Next: Start with `phase-1-core/TASK_1.1_UNIVERSAL_LEXER.md`

```

```
