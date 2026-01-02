# Blend65 v0.2 & v0.3+ Architecture Decisions

**Date:** 02/01/2026
**Purpose:** Comprehensive architectural roadmap based on lexer/parser/AST analysis and Missing Features Matrix cross-reference
**Status:** APPROVED - Core design decisions for next evolution phases

---

## Executive Summary

This document captures critical architectural decisions for Blend65's evolution from v0.1 to v0.3+. Based on analysis of the current lexer/parser/AST implementation and cross-referencing with our Missing Features Matrix, we've identified a focused v0.2 scope and a pragmatic v0.3+ local variable architecture that leverages 6502-native strategies without sacrificing language flexibility.

### Key Outcomes:

- **v0.2:** 3 high-impact language features with minimal complexity
- **v0.3+:** Conditional local-variable storage (ZP/scratch where safe, RAM stack frames when required)
- **Core principle:** Always support recursion; optimize away frames when possible

---

## Current State Analysis (Foundation Assessment)

### Lexer Status: ✅ EXCELLENT FOUNDATION

- **Complete token set:** All basic language constructs implemented
- **Storage classes:** ZP, RAM, DATA, CONST, IO fully supported
- **Operators:** Comprehensive arithmetic, logical, bitwise, comparison
- **Keywords:** Module system, control flow, function definitions complete
- **Assessment:** Ready for v0.2 feature additions

### AST Status: ✅ COMPREHENSIVE HIERARCHY

- **Expression system:** Complete binary/unary/call/member/index expressions
- **Statement system:** Full control flow (if/while/for/match/return)
- **Declaration system:** Functions, variables, types with storage classes
- **Type system:** Primitives, arrays, records with proper annotations
- **Import/Export:** Full module system support
- **Assessment:** Robust foundation for language feature expansion

### Parser Status: ✅ PRODUCTION READY

- **Recursive descent:** Clean, maintainable implementation
- **Module parsing:** Complete import/export/module declaration support
- **Function parsing:** Parameters, return types, body statements
- **Variable parsing:** All storage classes supported in function bodies
- **Expression parsing:** Full precedence handling with proper associativity
- **Assessment:** Can handle v0.2 features with minimal modifications

---

## v0.2 Implementation Decisions

### ✅ APPROVED FOR IMPLEMENTATION

#### 1. Break/Continue Statements (HIGH Priority)

**Decision:** IMPLEMENT - Essential for complex game loops
**Rationale:**

- Highly requested by analyzed games (Tetris C64, complex arcade games)
- Simple implementation - minimal parser/AST changes needed
- Immediate developer productivity improvement

**Implementation Requirements:**

- Add `BREAK`, `CONTINUE` tokens to lexer
- Add `BreakStatement`, `ContinueStatement` AST nodes
- Extend parser to handle break/continue within loop contexts only
- Add semantic validation (only valid inside loops)

**Syntax:**

```js
for i = 0 to 255
    if condition then
        break      // Exit loop entirely
    end if
    if otherCondition then
        continue   // Skip to next iteration
    end if
next i
```

#### 2. Complete Match Statement Implementation (MEDIUM Priority)

**Decision:** IMPLEMENT - Better than long if/else chains
**Rationale:**

- MATCH/CASE tokens already exist but parser/AST incomplete
- Provides clean pattern matching for game logic
- Natural fit for 6502 development patterns

**Implementation Requirements:**

- Complete `MatchStatement` and `MatchCase` AST implementation
- Add `DEFAULT` token for default case support
- Implement full pattern matching parser
- Add exhaustiveness checking in semantic analysis

**Syntax:**

```js
match gameState
    case MENU:
        showMenu()
    case PLAYING:
        updateGame()
    case GAME_OVER:
        showGameOver()
    default:
        handleError()
end match
```

#### 3. Enum Declarations (MEDIUM Priority)

**Decision:** IMPLEMENT - Code organization and readability
**Rationale:**

- Perfect for game states, colors, directions, input codes
- Improves code maintainability significantly
- Simple implementation with high developer value

**Implementation Requirements:**

- Add `ENUM` token to lexer
- Add `EnumDeclaration` AST node with named constants
- Add parser for enum syntax
- Generate compile-time constants in code generation

**Syntax:**

```js
enum GameState
    MENU = 0,
    PLAYING = 1,
    PAUSED = 2,
    GAME_OVER = 3
end enum

enum Direction
    UP, DOWN, LEFT, RIGHT    // Auto-incrementing values
end enum
```

### ❌ REJECTED FOR v0.2

#### 1. Range-Based For Loops

**Decision:** REJECT - Current syntax is adequate
**Rationale:**

- Wild Boa Snake (100% v0.1 compatible) uses `for i = 0 to 255` successfully
- C64 Examples use traditional counting loops without issues
- Adding `for x in range(0, 10)` is unnecessary complexity
- 6502/BASIC heritage makes current syntax more natural

#### 2. Assert Statements

**Decision:** REJECT - Not 6502-appropriate
**Rationale:**

- Traditional error handling problematic on 6502
- No exception mechanism on 6502
- Limited stack space for error handling
- Every byte of RAM matters
- Real-time constraints make error handling complex
- Analyzed games use return codes and flag variables instead

#### 3. Traditional Stack-Based Local Variables

**Decision:** REFRAME - Do not use the 6502 hardware stack ($0100 page) for general locals; do use a minimal software stack in RAM when needed
**Rationale:**

- The 6502 hardware stack is small (256 bytes) and heavily used for return addresses and ISR state; treating it as a general locals stack is fragile
- Fixed-address locals are fast but only safe for non-reentrant code paths
- A minimal software stack frame in RAM is a proven 6502 technique and is required if we want recursion and safe nested calls
- Blend65 can still optimize most functions to use zero frame bytes

---

## v0.3+ Local Variable Storage Architecture (Scratch + Software Stack Frames)

### Goal

Support a real programming-language mental model (including recursion) while remaining 6502/C64-realistic on memory and performance.

### Decision: Conditional Storage, Compiler-Chosen

Blend65 will support two local-storage modes and let the compiler select per function.

#### Mode A: Scratch Locals (fixed-address workspace)

Use a reserved workspace region for locals/temporaries when the compiler can prove the function is not re-entered concurrently.

**Properties:**

- Very fast addressing (typically absolute addressing)
- Extremely simple codegen
- Not safe if a function can be active more than once at the same time

#### Mode B: Frame Locals (software stack frames in RAM)

Use a minimal software stack for locals/spills when a function may have multiple active invocations.

**Properties:**

- Correct under recursion and nested calls
- Memory usage is proportional to actual live calls (bounded by reserved RAM)
- Access is typically via a ZP base pointer and `(zp),Y` (slower than absolute, but robust)

### When a Frame Is Required (conservative rules)

Generate a frame if any of the following hold:

- The function is recursive (directly or indirectly) or is part of a call cycle (SCC)
- A local's address can escape (future: `&local`, returning/storing references)
- The function is marked as IRQ/NMI-callable (future attribute) or otherwise re-entrant
- The compiler needs spill slots due to register/ZP pressure

If none hold, default to scratch locals and/or ZP temps.

### Memory Layout (conceptual; actual addresses are toolchain-configured)

```
$0000-$00FF: Zero Page (system + globals + compiler temps)
$0100-$01FF: 6502 hardware stack
$0200-.... : Program data / code / buffers (project-defined)

Optional reserved regions:
- Scratch Workspace: fixed region used for scratch locals (Mode A)
- Frame Stack Region: RAM area used for software stack frames (Mode B)
```

### Minimal Software Frame Mechanism (proven on 6502)

Maintain a 16-bit software stack pointer in ZP and allocate `frameSize` bytes on function entry.

**High-level prologue/epilogue:**

- Prologue: `softSP -= frameSize` ; set `frameBase = softSP`
- Epilogue: `softSP += frameSize`

Locals are addressed relative to `frameBase` using `(frameBase),Y` with compile-time offsets.

### IRQ/NMI Safety Policy (v0.3 explicit rules)

Interrupt handlers introduce reentrancy. Blend65 must define what code is safe to call from IRQ/NMI and how local storage behaves in that environment.

**Policy options (all proven patterns on 6502):**

1. **Dedicated IRQ scratch + no general calls (minimal, common in games)**
   - IRQ/NMI code uses a dedicated, fixed scratch area (and/or a dedicated set of ZP temps)
   - IRQ/NMI code is restricted: no calling into general functions unless they are explicitly marked IRQ-safe
   - Lowest overhead and easiest to reason about

2. **Separate IRQ frame stack (robust, still simple)**
   - Maintain a second software stack pointer for IRQ/NMI frames
   - IRQ-marked functions allocate frames from the IRQ stack region, not the main frame stack
   - Keeps recursion/nesting correct even if IRQ fires inside main code

3. **Save/restore main frame state on interrupt (robust, higher overhead)**
   - IRQ prologue saves the main `softSP`/`frameBase` state (and any required temps), restores on exit
   - Works, but adds cycle cost and complexity; usually avoided in tight raster IRQ loops

**v0.3 recommendation:** Implement option (1) by default, and keep the design open to option (2) later.

**Concrete v0.3 rule:** Functions are _not_ IRQ-callable unless explicitly marked (future attribute). Unmarked functions may assume non-reentrancy for scratch locals. Marked IRQ-safe functions must avoid scratch locals or use the IRQ-dedicated scratch/stack strategy.

### Frame Stack Sizing (v0.3 pragmatic version)

Instead of cross-module liveness/register-allocation research, start with a simple whole-program call graph estimate:

- Compute maximum software-frame stack usage along call paths (conservative)
- Reserve that many bytes (plus headroom) for the frame stack region

This delivers predictable memory planning without requiring advanced dataflow analysis.

### Return Value Management: Critical Design Decision

#### The Problem:

```js
function createBuffer(): byte[16]
    var buffer: byte[16]           // Allocated in scratch/frame storage
    return buffer                  // PROBLEM: buffer lifetime ends on return
end function

function main()
    var result: byte[16] = createBuffer()  // DANGLING POINTER!
end function
```

#### Multi-Strategy Solution:

**1. Small Values: Return by Value (Copy)**

```js
function getScore(): word          // 2 bytes - efficient to copy
    var temp: word = calculateScore()
    return temp                    // Copied via CPU registers
end function
```

**2. Medium Values: Static Return Buffers**

```js
function getCurrentSprite(): byte[24]  // 24 bytes - static buffer
    static var spriteBuffer: byte[24]  // Function-specific static storage
    // ... build sprite in static buffer
    return spriteBuffer               // Return pointer to static buffer
end function
```

**3. Large Values: Caller-Allocated Storage**

```js
function loadLevel(levelData: byte[512]): void  // Caller provides storage
    // Initialize provided levelData array
    // No return value needed
end function

function main()
    var myLevel: byte[512]        // Caller allocates
    loadLevel(myLevel)           // Pass storage to function
end function
```

#### Automatic Strategy Selection:

```typescript
function getReturnStrategy(returnType: TypeAnnotation): ReturnStrategy {
  const size = calculateTypeSize(returnType);

  if (size <= 2) {
    return ReturnStrategy.BY_VALUE; // byte, word
  } else if (size <= 16) {
    return ReturnStrategy.STATIC_BUFFER; // Small arrays
  } else {
    return ReturnStrategy.CALLER_ALLOCATED; // Large data
  }
}
```

### String Variables: Special Considerations

#### String Pool Strategy:

```
Memory Layout:
$XXXX-$XXXX: Scalar scratch/frame storage (implementation-defined)
$YYYY-$YYYY: String scratch/frame storage (optional; implementation-defined)
$ZZZZ+: Regular program memory (implementation-defined)
```

#### String Allocation Strategies:

```js
// v0.3: Fixed-size string locals
var name: string[16] = "Player"    // Fixed allocation in string pool

// v0.4: Dynamic string management
var message: string = loadText()   // Compiler manages sizing

// v0.5: Full optimization
var greeting: string = "Hello"     // Compile-time constant in ROM
```

---

## Optimization Architecture (Future Research, Not v0.3-Blocking)

Advanced liveness-based reuse and cross-module allocation are valuable but are explicitly out of scope for the first working implementation.

**v0.3 intent:**

- Conservative call-graph-based sizing for the frame stack region
- Straightforward allocation of scratch locals for functions proven non-reentrant

**Future (v0.4+):**

- Lifetime-based reuse (register allocation techniques applied to scratch slots)
- Library-aware resource metadata (if an ecosystem emerges)

---

## Implementation Complexity Analysis

### v0.2 Features: MANAGEABLE (2-3 months with AI help)

**Break/Continue Statements: 3/10 EASY**

- Simple parser extensions
- Straightforward AST nodes
- Basic semantic validation
- **AI can easily help with implementation**

**Match Statements: 4/10 MODERATE**

- Parser extension for case handling
- AST completion for pattern matching
- Exhaustiveness checking in semantic analysis
- **AI can help with most aspects**

**Enum Declarations: 4/10 MODERATE**

- New AST node type
- Constant value generation
- Name resolution in semantic analysis
- **AI can handle implementation effectively**

### v0.3+ Conditional Locals: MODERATE COMPLEXITY

**Conditional Locals (Scratch + Frame Stack): 6/10 MODERATE**

- Scratch workspace allocation for non-reentrant functions
- Minimal software stack frames in RAM for recursive/reentrant/spill-heavy functions
- Clear rules for IRQ safety (even if initially "not supported" without explicit attributes)

**Advanced Lifetime Optimization: 8/10 VERY HARD (6-12 months)**

- Requires dataflow analysis expertise
- Graph coloring / allocation algorithms for scratch-slot reuse
- Cross-function dependency resolution
- **Needs PhD-level compiler knowledge**

### Not Recommended for v0.3: Cross-Module Liveness Optimization

**Full IL Analyzer: 9/10 EXTREMELY HARD (12+ months)**

- Whole-program dataflow analysis across modules
- Precise liveness + reuse decisions with hard edge cases
- Library integration complexity
- Not recommended until the compiler backend exists and v0.3 is proven in real programs

---

## Strategic Recommendations

### Phase 1: v0.2 Core Language Features (Months 1-3)

1. **Break/Continue statements** - Essential developer productivity
2. **Complete Match statements** - Better game logic organization
3. **Enum declarations** - Code clarity and maintainability
4. **Comprehensive testing** - Validate against Wild Boa Snake patterns

### Phase 2: v0.3 Conditional Locals (Months 4-6)

1. **Conditional locals** - Scratch workspace where safe; RAM frame stack where required
2. **Hybrid zp allocation** - Honor `zp var` requests; use scratch/frame otherwise
3. **Conservative sizing** - Call-graph-based maximum frame stack usage estimate
4. **Return value strategies** - Automatic strategy selection by data type
5. **Basic string support** - Fixed-size string locals (implementation-defined storage)

### Phase 3: v0.4+ Advanced Features (Future)

1. **Lifetime optimization** - Scratch-slot reuse through liveness analysis
2. **Cross-module integration** - Library-aware resource metadata and budgeting
3. **Dynamic strings** - Advanced string handling with explicit memory strategy
4. **Performance profiling** - Measure scratch vs frame overhead and validate assumptions

---

## Success Metrics

### v0.2 Success Criteria:

- **All three features implemented** and fully tested
- **Zero breaking changes** to existing v0.1 functionality
- **Wild Boa Snake compatibility maintained**
- **Comprehensive test suite** covering edge cases
- **Clear documentation** with practical examples

### v0.3 Success Criteria:

- **Local variables work** with familiar syntax
- **Correctness under recursion** demonstrated (frame locals)
- **Performance baseline** demonstrated (scratch locals stay low overhead)
- **Memory planning** validated (conservative frame-stack sizing works)
- **Zero page optimization** functional with `zp var`
- **Return value management** transparent to developers
- **String locals** working for basic use cases

### Long-term Vision:

- **Industry-leading 6502 compiler** with sophisticated optimization
- **Zero page intelligence** unmatched by other 6502 tools
- **Cross-module optimization** enabling complex multi-file projects
- **Library ecosystem** with intelligent resource management

---

## Architectural Principles

### 6502-Native Design Philosophy:

1. **Performance where it matters** - Prefer ZP/absolute addressing when safe; use frames only when required
2. **Memory efficiency** - Small reserved scratch; bounded RAM stack for frames; conservative sizing first
3. **Programmer control** - `zp var` for critical performance needs
4. **Hardware awareness** - Leverage absolute addressing strengths
5. **Predictability** - Explicit memory regions and clear rules for reentrancy/IRQ safety

### Compiler Intelligence:

1. **Automatic selection** - Scratch vs frame locals; conservative sizing
2. **Clear feedback** - Warning messages explain allocation decisions
3. **Graceful degradation** - Fallback strategies when resources exhausted
4. **Future-proof architecture** - Foundation for advanced optimizations when the backend exists

### Developer Experience:

1. **Familiar syntax** - Local variables work as expected
2. **Performance transparency** - Clear model of what's fast vs slow
3. **Flexible control** - Override compiler decisions when needed
4. **Rich diagnostics** - Understand resource usage and conflicts
5. **Incremental adoption** - Can use features gradually

---

## Risk Assessment

### v0.2 Risks: LOW

- **Well-understood features** with clear implementation paths
- **Minimal parser changes** required
- **No breaking changes** to existing functionality
- **Strong AI assistance** available for implementation

### v0.3 Risks: MODERATE

- **New memory management** paradigm requires careful testing
- **Return value strategies** need comprehensive validation
- **Performance claims** must be empirically verified
- **String handling** adds complexity to local storage decisions

### Long-term Risks: HIGH

- **Advanced optimization** requires deep compiler expertise
- **Cross-module analysis** has exponential complexity growth
- **Library ecosystem** coordination becomes complex
- **Backward compatibility** pressure increases with adoption

---

## Decision Rationale Summary

### Why These Decisions Are Optimal:

**v0.2 Focus:**

- **High impact, low risk** feature selection
- **Immediate developer value** without architectural complexity
- **Proven demand** from game analysis (break/continue/match/enum all requested)
- **Foundation building** for v0.3+ without premature optimization

**Conditional Locals Architecture:**

- **6502-native optimization** leveraging ZP/absolute addressing where safe
- **Robustness** via software stack frames in RAM when recursion/reentrancy requires it
- **Scalable design** from conservative call-graph sizing to future lifetime-based reuse
- **Developer-friendly** familiar syntax with clear performance rules

**Rejected Alternatives:**

- **Range syntax:** Current `for i = 0 to 255` works perfectly for target games
- **Assert statements:** 6502 constraints make traditional error handling impractical
- **6502 hardware-stack locals:** Fragile due to tiny $0100 stack and ISR interaction
- **Always-frame locals:** Unnecessary overhead for common game-loop code paths
- **Full cross-module liveness optimization:** PhD-level complexity inappropriate for v0.3 timeline

### Competitive Advantage:

This architecture positions Blend65 as a practical, high-performance 6502 language that stays honest about C64 constraints while still feeling like a modern language to users.

---

## Implementation Dependencies

### Prerequisites for v0.2:

- Current lexer/parser/AST (✅ READY)
- Basic semantic analysis framework
- Test infrastructure expansion
- Documentation system for new features

### Prerequisites for v0.3:

- v0.2 features complete and stable
- Backend IR / lowering plan sufficient for stack-frame codegen
- Call graph construction (conservative) for frame-stack sizing
- Memory layout configuration for scratch workspace + frame-stack region
- ABI decisions for temp ZP usage, frame base pointer, and IRQ safety rules

### Prerequisites for v0.4+:

- v0.3 conditional locals proven in real projects
- Performance benchmarking infrastructure
- Dataflow analysis framework
- Library integration specification (only if an ecosystem emerges)
- Advanced debugging tools

---

**This document represents the definitive architectural roadmap for Blend65's next evolution phases. All decisions are based on thorough analysis of current capabilities, cross-reference with Missing Features Matrix, and careful consideration of 6502-specific constraints and opportunities.**

**Status: APPROVED for implementation planning and resource allocation.**
