# Blend65 Project Status

> **Last Updated:** January 27, 2026  
> **Version:** 0.1.0-alpha  
> **Overall Progress:** ~85% Complete  
> **Test Status:** 6,996/6,998 passing (99.97%)

---

## What is Blend65?

Blend65 is a modern programming language and compiler designed specifically for creating software for the **Commodore 64** (and related 8-bit computers using the 6502 processor).

**Design Philosophy:**
- **Explicit over Implicit** - Memory placement, types, and control flow are always explicit
- **Zero Cost Abstractions** - High-level constructs compile to efficient 6502 code
- **Hardware First** - Language features map directly to 6502 capabilities
- **Readable Assembly Alternative** - More maintainable than raw assembly, as efficient as hand-written code

**Think of it as:** A structured, type-safe alternative to 6502 assembly that gives you direct hardware control.

---

## Project Status at a Glance

| Component | Status | What it means |
|-----------|--------|---------------|
| 🟢 **Language Design** | ✅ Complete | The language syntax and features are fully designed |
| 🟢 **Lexer** | ✅ Complete | Can read and understand source code text |
| 🟢 **Parser** | ✅ Complete | Can understand the structure of programs |
| 🟢 **Semantic Analyzer** | ✅ Complete | Can check programs for errors and gather information |
| 🟢 **IL Generator** | ✅ Complete | Can convert programs to internal format |
| 🟢 **Code Generator** | ✅ Complete (Basic) | Can produce assembly code |
| 🟡 **Optimizer** | 📋 Planning Complete | 103+ design documents ready, implementation not started |
| 🟢 **Config System** | ✅ Complete | Project configuration works |
| 🟡 **CLI Tool** | ⏳ Partial | Basic build/check commands work, more features planned |
| 🟡 **Documentation** | ⏳ Partial | User guides and tutorials needed |

---

## Test Coverage Summary

| Area | Tests | Status |
|------|-------|--------|
| Lexer | 150+ | ✅ All Passing |
| Parser | 400+ | ✅ All Passing |
| AST | 100+ | ✅ All Passing |
| Semantic Analysis | 1,500+ | ✅ All Passing |
| IL Generator | 2,000+ | ✅ All Passing |
| Code Generator | 500+ | ✅ All Passing |
| ASM-IL | 500+ | ✅ All Passing |
| E2E & Integration | 1,800+ | ✅ All Passing |
| CLI | 10 | ✅ All Passing |
| **Total** | **6,998** | **6,996 passing (2 skipped)** |

### Skipped Tests (2)

| Test | Reason | Location |
|------|--------|----------|
| Power-of-2 multiply strength reduction | Optimizer not implemented | `optimizer-metrics.test.ts` |
| Performance consistency test | Test flakiness/timing | `performance.test.ts` |

---

## What's Working Now?

### ✅ You Can Currently:

1. **Write Blend65 Programs**
   - Variables, functions, loops, conditions
   - Type annotations (`byte`, `word`, `bool`)
   - Hardware access (`@map` for memory-mapped I/O)
   - Modules and imports
   - **Ternary expressions** (`condition ? then : else`)
   - **Address-of operator** (`@variable` to get memory address)
   - **Callback parameters** (pass function addresses)
   - **Array types** (`byte[N]`, `word[256]`)

2. **Compile to Assembly**
   - The compiler generates ACME assembler output
   - Programs compile to working 6502 assembly
   - Expressions: arithmetic, bitwise, comparisons, logical
   - Control flow: if/else, while, for loops
   - Functions with parameters and return values

3. **Get Helpful Error Messages**
   - Shows exactly where errors are in your code
   - Displays the problematic line with markers
   - Suggests fixes when possible

### 🎮 Example of What Works:

```js
// A simple Blend65 program
module Main;

@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;

// Function that can be called via callback
function flashBorder(): void {
    borderColor = borderColor + 1;
}

// Function accepting a callback parameter
function callHandler(handler: callback): void {
    handler();  // Invoke the callback
}

export function main(): void {
    borderColor = 0;      // Black border
    backgroundColor = 6;  // Blue background
    
    // Ternary operator for conditional values
    let a: byte = 10;
    let b: byte = 5;
    let max: byte = (a > b) ? a : b;
    
    // Address-of operator - get function address
    let handlerAddr: @address = @flashBorder;
    
    // Pass function as callback
    callHandler(@flashBorder);
    
    // Use length() with string literals
    let len: byte = length("hello"); // Returns 5
}
```

---

## What's Still Being Built?

### 🔧 Optimizer (Next Major Feature)

The optimizer will make your programs:
- **Faster** - Uses efficient 6502 instructions
- **Smaller** - Removes unnecessary code
- **Better** - Takes advantage of hardware features

**Status:** 
- ✅ **103+ design documents complete** - Comprehensive planning done
- 📋 **Implementation not started** - Ready to begin coding

### 🖥️ CLI Improvements (dx-features plan)
- Better project scaffolding (`blend65 init myproject`)
- VICE emulator integration (`blend65 run`)
- Watch mode for development (`blend65 watch`)
- Source maps for debugging

### 📚 Documentation
- Getting started guide
- Language tutorial
- API reference
- Example projects

---

## Active Development Plans

### Priority 1: Major Features

| Plan | Status | Description |
|------|--------|-------------|
| `optimizer/` | 📋 Docs Complete | 103+ documents ready for implementation |
| `dx-features/` | 📋 Ready | CLI, VICE integration, source maps |
| `native-assembler/` | 📋 Planning | Direct .prg generation (future) |

### Research (Future)

| Plan | Status | Description |
|------|--------|-------------|
| `features/` | 📋 Research | Inline assembly, interrupts, sprites |

---

## Recently Completed

### ✅ All Bug Fix Plans Complete (January 27, 2026)

**Phase 2 (Bug Fixes & Stabilization) is COMPLETE!**

- ✅ **CALL_VOID Bug** - Functions returning values now correctly use CALL
- ✅ **length() String Support** - `length("hello")` now returns 5
- ✅ **All 6 Intrinsic Handlers** - brk, barrier, lo/hi, volatile ops
- ✅ **Array Initializers** - Correct initialization values
- ✅ **Local Variable Codegen** - Proper zero page allocation
- ✅ **Branch Selection** - Correct BNE/BEQ selection
- ✅ **Data Directives** - Correct `!fill` generation

### ✅ Previous Milestones

- ✅ C-Style Syntax Refactor (January 2026)
- ✅ Ternary Operator Support (January 2026)
- ✅ Configuration System (January 2026)
- ✅ Address-of Operator (January 2026)
- ✅ Library Loading System (January 2026)
- ✅ Module/Export System Fix (January 2026)

---

## Roadmap

### Phase 1: Core Compiler ✅ (COMPLETE)
- [x] Language specification
- [x] Lexer (tokenization)
- [x] Parser (syntax analysis)
- [x] AST (program representation)
- [x] Semantic analyzer (error checking)
- [x] IL generator (intermediate language)
- [x] Code generator (assembly output)
- [x] C-style syntax refactor
- [x] Ternary operator support
- [x] Configuration system
- [x] Address-of operator (`@`)
- [x] Library loading system
- [x] Module/export system

### Phase 2: Bug Fixes & Stabilization ✅ (COMPLETE)
- [x] Fix CALL_VOID bug
- [x] Fix length() with string literals
- [x] Complete missing intrinsic handlers
- [x] Fix array initializers
- [x] Fix local variable codegen
- [x] Fix branch instruction selection

### Phase 3: Optimization 🔜 (NEXT MAJOR FOCUS)
- [ ] IL optimization passes
- [ ] Peephole optimization
- [ ] Dead code elimination
- [ ] Constant folding

### Phase 4: Developer Experience 📋 (PLANNED)
- [ ] Improved CLI (init, run, watch)
- [ ] Project templates
- [ ] VICE integration
- [ ] Source maps for debugging

### Phase 5: Documentation & Examples 📋 (PLANNED)
- [ ] User documentation
- [ ] Tutorials
- [ ] Example games
- [ ] API reference

---

## Target Platforms

| Platform | Status |
|----------|--------|
| **Commodore 64** | ✅ Primary target |
| Commodore 128 | 🔄 Planned |
| Commander X16 | 🔄 Planned |

---

## Getting Started (For Developers)

```bash
# Clone the repository
git clone https://github.com/blendsdk/blend65.git
cd blend65

# Install dependencies
yarn install

# Build the compiler
yarn build

# Run tests
./compiler-test
```

---

## Questions?

- **GitHub:** https://github.com/blendsdk/blend65
- **Issues:** https://github.com/blendsdk/blend65/issues

---

## Summary

**Blend65 is a functional compiler** that can already compile programs for the Commodore 64. The core compilation pipeline is complete and well-tested with **99.97% test pass rate** (6,996/6,998 tests).

**Phase 2 (Bug Fixes & Stabilization) is COMPLETE!**

**Next priority:** Optimizer implementation - 103+ design documents ready

The project is actively developed and getting closer to a 1.0 release!