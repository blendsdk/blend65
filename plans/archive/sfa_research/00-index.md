# SFA Research: Static Frame Allocation for 6502

> **Project**: Blend65 Compiler v2
> **Status**: Research In Progress
> **Created**: 2025-01-31

## Overview

This research project analyzes how four mature 6502 compilers implement stack frame and variable allocation. The goal is to synthesize a "god-level" Static Frame Allocation (SFA) system for Blend65 that incorporates the best practices from each project while avoiding their pitfalls.

## Research Objectives

1. **Deep Analysis** - Understand how each compiler handles:
   - Local variable allocation
   - Parameter passing
   - Return values
   - Zero page usage
   - Call stack management
   - Recursion (or its prevention)

2. **Comparison** - Create a comprehensive comparison matrix identifying:
   - Strengths of each approach
   - Weaknesses and limitations
   - Edge cases handled
   - Edge cases NOT handled

3. **Synthesis** - Design a superior SFA system that:
   - Takes the best from all four compilers
   - Avoids known pitfalls
   - Fits Blend65's architecture
   - Supports comprehensive testing

## Source Projects

| Project | Language | Focus | Repository |
|---------|----------|-------|------------|
| **cc65** | C | Industry-standard C compiler for 6502 | `/sfa_learning/cc65/` |
| **KickC** | Java | Modern C compiler with SSA optimization | `/sfa_learning/kickc/` |
| **Oscar64** | C++ | Modern C compiler with advanced optimization | `/sfa_learning/oscar64/` |
| **Prog8** | Kotlin | Modern high-level language for 6502 | `/sfa_learning/prog8/` |

## Document Index

### Core Documents

| Doc | File | Description |
|-----|------|-------------|
| 00 | [00-index.md](00-index.md) | This document |
| 01 | [01-requirements.md](01-requirements.md) | Research requirements and scope |
| 99 | [99-execution-plan.md](99-execution-plan.md) | Session-by-session execution plan |

### CC65 Analysis

| Doc | File | Description |
|-----|------|-------------|
| - | [cc65/00-overview.md](cc65/00-overview.md) | Architecture overview |
| - | [cc65/01-stack-model.md](cc65/01-stack-model.md) | Stack handling approach |
| - | [cc65/02-locals-handling.md](cc65/02-locals-handling.md) | Local variable allocation |
| - | [cc65/03-parameter-passing.md](cc65/03-parameter-passing.md) | Function parameter handling |
| - | [cc65/04-code-generation.md](cc65/04-code-generation.md) | Code generation patterns |
| - | [cc65/05-strengths.md](cc65/05-strengths.md) | What they do well |
| - | [cc65/06-weaknesses.md](cc65/06-weaknesses.md) | Limitations and issues |

### KickC Analysis

| Doc | File | Description |
|-----|------|-------------|
| - | [kickc/00-overview.md](kickc/00-overview.md) | Architecture overview |
| - | [kickc/01-recursion-detection.md](kickc/01-recursion-detection.md) | Recursion detection mechanism |
| - | [kickc/02-call-stack-vars.md](kickc/02-call-stack-vars.md) | Call stack variable handling |
| - | [kickc/03-memory-coalesce.md](kickc/03-memory-coalesce.md) | Memory coalescing strategy |
| - | [kickc/04-zeropage-allocation.md](kickc/04-zeropage-allocation.md) | Zero page management |
| - | [kickc/05-strengths.md](kickc/05-strengths.md) | What they do well |
| - | [kickc/06-weaknesses.md](kickc/06-weaknesses.md) | Limitations and issues |

### Oscar64 Analysis

| Doc | File | Description |
|-----|------|-------------|
| - | [oscar64/00-overview.md](oscar64/00-overview.md) | Architecture overview |
| - | [oscar64/01-declaration-model.md](oscar64/01-declaration-model.md) | Declaration handling |
| - | [oscar64/02-intercode-vars.md](oscar64/02-intercode-vars.md) | Intermediate code variables |
| - | [oscar64/03-native-codegen.md](oscar64/03-native-codegen.md) | Native code generation |
| - | [oscar64/04-global-analysis.md](oscar64/04-global-analysis.md) | Global analyzer approach |
| - | [oscar64/05-strengths.md](oscar64/05-strengths.md) | What they do well |
| - | [oscar64/06-weaknesses.md](oscar64/06-weaknesses.md) | Limitations and issues |

### Prog8 Analysis

| Doc | File | Description |
|-----|------|-------------|
| - | [prog8/00-overview.md](prog8/00-overview.md) | Architecture overview |
| - | [prog8/01-variable-allocator.md](prog8/01-variable-allocator.md) | VariableAllocator analysis |
| - | [prog8/02-function-calls.md](prog8/02-function-calls.md) | Function call generation |
| - | [prog8/03-memory-layout.md](prog8/03-memory-layout.md) | Memory layout strategy |
| - | [prog8/04-zeropage-strategy.md](prog8/04-zeropage-strategy.md) | Zero page handling |
| - | [prog8/05-strengths.md](prog8/05-strengths.md) | What they do well |
| - | [prog8/06-weaknesses.md](prog8/06-weaknesses.md) | Limitations and issues |

### Synthesis

| Doc | File | Description |
|-----|------|-------------|
| - | [synthesis/00-comparison-matrix.md](synthesis/00-comparison-matrix.md) | Feature comparison |
| - | [synthesis/01-best-practices.md](synthesis/01-best-practices.md) | Collected best practices |
| - | [synthesis/02-anti-patterns.md](synthesis/02-anti-patterns.md) | What NOT to do |
| - | [synthesis/03-edge-cases.md](synthesis/03-edge-cases.md) | Edge cases catalog |

### God-Level SFA Design

| Doc | File | Description |
|-----|------|-------------|
| - | [god-level-sfa/00-overview.md](god-level-sfa/00-overview.md) | Design philosophy |
| - | [god-level-sfa/01-data-structures.md](god-level-sfa/01-data-structures.md) | Core types |
| - | [god-level-sfa/02-allocation-algorithm.md](god-level-sfa/02-allocation-algorithm.md) | Allocation algorithm |
| - | [god-level-sfa/03-zeropage-strategy.md](god-level-sfa/03-zeropage-strategy.md) | ZP optimization |
| - | [god-level-sfa/04-call-graph-reuse.md](god-level-sfa/04-call-graph-reuse.md) | Frame reuse |
| - | [god-level-sfa/05-recursion-handling.md](god-level-sfa/05-recursion-handling.md) | Recursion approach |
| - | [god-level-sfa/06-edge-cases.md](god-level-sfa/06-edge-cases.md) | Edge case handling |
| - | [god-level-sfa/07-testing-strategy.md](god-level-sfa/07-testing-strategy.md) | Testing approach |

### Blend Integration

| Doc | File | Description |
|-----|------|-------------|
| - | [blend-integration/00-overview.md](blend-integration/00-overview.md) | Integration strategy |
| - | [blend-integration/01-frame-types.md](blend-integration/01-frame-types.md) | Type definitions |
| - | [blend-integration/02-allocator-impl.md](blend-integration/02-allocator-impl.md) | Implementation |
| - | [blend-integration/03-semantic-integration.md](blend-integration/03-semantic-integration.md) | Semantic phase |
| - | [blend-integration/04-il-integration.md](blend-integration/04-il-integration.md) | IL generator |
| - | [blend-integration/05-codegen-integration.md](blend-integration/05-codegen-integration.md) | Code generator |

## Quick Start

To begin research, see [99-execution-plan.md](99-execution-plan.md) for the session-by-session approach.

## Key Decisions Tracking

| Decision | Status | Outcome |
|----------|--------|---------|
| Recursion support |  DECIDED | **Static-only** - No recursion allowed, simplest and fastest for 6502 |
| Zero page priority |  DECIDED | **Combined** - Automatic analysis + explicit `@zp` override |
| Call graph analysis |  DECIDED | **Full analysis** - Maximum RAM savings via frame reuse |
| Target platforms |  DECIDED | **Multi-platform** - C64, X16, NES, Atari, Apple II, etc. |
| Research timeline |  DECIDED | **Deep** - 20+ sessions for maximum thoroughness |

### Decision Details

**Q1: Recursion Support - Static-only**
- No recursion support needed
- Enables pure static frame allocation
- Maximum performance, predictable memory usage
- Compiler will reject recursive function calls

**Q2: Zero Page Priority - Combined Strategy**
- Automatic analysis determines "hotness" of variables
- Developer can use `@zp` annotation to force ZP allocation
- Small types (byte, word) get priority over larger types
- Inner loop variables prioritized automatically

**Q3: Call Graph Analysis - Full**
- Build complete call graph at compile time
- Identify non-overlapping call paths
- Enable aggressive frame memory reuse
- Functions that cannot be active simultaneously share frame addresses

**Q4: Target Platforms - Multi-platform**
- Abstract frame allocation from specific memory maps
- Platform-specific configuration for ZP regions, frame regions
- Support C64, Commander X16, NES, Atari, Apple II, etc.
- Configurable via target definition files

**Q5: Research Timeline - Deep (20+ sessions)**
- Maximum thoroughness in analyzing all four compilers
- Extra sessions for edge cases, benchmarks, and cross-comparisons
- ~30-40 hours total research time

---

**Next Step**: Read [01-requirements.md](01-requirements.md) for detailed research scope.