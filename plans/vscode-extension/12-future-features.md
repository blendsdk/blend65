# Future Features

> **Document**: 12-future-features.md
> **Parent**: [Index](00-index.md)

## Overview

Features that are **not** in the current implementation plan but are desirable for future versions. These items require either significant additional infrastructure, external dependencies, or research before implementation.

---

## 1. Debugger Integration (VICE Emulator)

**Effort**: Major project (~10-15 sessions)
**Dependencies**: VICE monitor protocol, Debug Adapter Protocol (DAP)

### What It Would Provide
- Set breakpoints in `.blend` source files
- Step through code line-by-line
- Inspect variable values at runtime
- View 6502 register state (A, X, Y, SP, PC, flags)
- View memory contents
- Watch expressions

### Why It's Not In Scope Now
- Requires implementing a full **Debug Adapter Protocol (DAP)** server
- Needs **source maps** from compiler (mapping Blend65 lines → 6502 addresses)
- Requires integrating with **VICE monitor protocol** (remote debugging)
- The compiler doesn't yet emit source maps
- This is essentially a separate project of similar complexity to the language server

### Prerequisites
- Source map generation in the compiler pipeline
- VICE monitor protocol client library
- DAP server implementation
- Breakpoint address resolution

---

## 2. Memory Map Visualizer

**Effort**: ~3-5 sessions
**Dependencies**: Frame allocator data

### What It Would Provide
- Visual representation of C64 memory layout
- Show where variables, arrays, and function frames are allocated
- Color-coded regions: ZP, frame area, screen RAM, I/O
- Interactive: click a region to see what's there

### Prerequisites
- Frame allocation data exposed from compiler
- VS Code Webview panel implementation

---

## 3. Profiler Integration

**Effort**: ~5-8 sessions
**Dependencies**: VICE profiler, cycle counting

### What It Would Provide
- Cycle count estimation per function
- Hot-path highlighting (which code is slowest)
- Raster time budget visualization (important for C64 effects)

### Prerequisites
- Cycle count annotations in code generator
- VICE profiling data format parsing

---

## 4. Emulator Preview

**Effort**: ~5-8 sessions
**Dependencies**: VICE or custom WASM emulator

### What It Would Provide
- Compile and run directly from VS Code
- See C64 screen output in a VS Code panel
- Quick iteration loop: edit → compile → run

### Prerequisites
- Build task provider (Phase 6)
- VICE command-line integration or WASM C64 emulator

---

## 5. Workspace Symbol Search

**Effort**: ~2 sessions
**Dependencies**: Multi-module analysis

### What It Would Provide
- `Ctrl+T` workspace-wide symbol search
- Find any function, variable, enum, type across all `.blend` files

### Prerequisites
- Multi-module analysis in language server (Phase 5 partial)

---

## 6. Call Hierarchy

**Effort**: ~2 sessions
**Dependencies**: Call graph from semantic analyzer

### What It Would Provide
- "Show Incoming Calls" — who calls this function?
- "Show Outgoing Calls" — what does this function call?
- Visual call tree

### Prerequisites
- Call graph data exposed from compiler (already exists in semantic analyzer)

---

## 7. Inlay Hints

**Effort**: ~1-2 sessions
**Dependencies**: Type resolution data

### What It Would Provide
- Show inferred types inline (e.g., `let x = 5;` shows `: byte` after `x`)
- Show parameter names in function calls
- Show enum values inline

### Prerequisites
- Type resolution working in language server

---

## 8. Code Lens

**Effort**: ~1-2 sessions
**Dependencies**: Call graph, symbol references

### What It Would Provide
- Reference counts above functions ("3 references")
- "Run" lens above `main()` function
- Memory usage hints above declarations

### Prerequisites
- Find references implementation (Phase 7)

---

## Priority Order for Future Implementation

| Priority | Feature | Value | Effort |
|----------|---------|-------|--------|
| 1 | Call Hierarchy | High (leverages existing call graph) | Low |
| 2 | Inlay Hints | High (great DX) | Low |
| 3 | Workspace Symbol Search | Medium | Low |
| 4 | Code Lens | Medium | Low |
| 5 | Memory Map Visualizer | High (unique to C64 dev) | Medium |
| 6 | Emulator Preview | Very High | High |
| 7 | Debugger (VICE) | Very High | Very High |
| 8 | Profiler | Medium | High |
