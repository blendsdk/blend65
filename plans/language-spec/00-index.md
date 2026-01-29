# Blend65 Language Specification Completion Plan

> **Project**: Complete Blend65 Language Specification
> **Status**: Planning Complete
> **Created**: January 29, 2026

## Overview

This plan describes the completion of the Blend65 language specification. The goal is to create a complete, standalone language specification that documents all language features, syntax, and semantics.

## Key Requirements

1. **Complete documentation** - All 11 specification documents
2. **No version references** - No "v1", "v2", "lite", "simplified"
3. **Standalone** - Self-contained, no references to previous versions
4. **Accurate** - Reflects the actual language features

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview |
| 99 | [Execution Plan](99-execution-plan.md) | Phases and sessions |

## Target Documents

The final specification will contain these documents:

| # | File | Description | Source |
|---|------|-------------|--------|
| README | README.md | Language overview, quick reference | Update existing |
| 00 | overview.md | Introduction, design goals | Copy from v1, update |
| 01 | lexical-structure.md | Tokens, keywords, literals | Copy from v1, update |
| 02 | types.md | Type system | Copy from v1 |
| 03 | variables.md | Variable declarations, storage classes | Copy from v1, remove @map |
| 04 | expressions.md | Operators, precedence | Extract from v1 |
| 05 | statements.md | Control flow | Extract from v1 |
| 06 | functions.md | Function declarations, callbacks | Copy from v1, add restrictions |
| 07 | modules.md | Import/export system | Copy from v1 |
| 08 | intrinsics.md | Built-in functions | Update existing |
| 09 | asm-functions.md | 6502 instruction functions | NEW |
| 10 | compiler.md | SFA architecture, pipeline | Update existing |

## Changes from Current State

### Features to Remove

| Feature | Reason | Alternative |
|---------|--------|-------------|
| `@map` syntax (all 4 forms) | Complexity | Use `const` + `peek()`/`poke()` |
| Recursion support | SFA architecture | Use iteration |
| sei/cli/nop/brk intrinsics | Redundant | Use `asm_*()` functions |
| pha/pla/php/plp intrinsics | Redundant | Use `asm_*()` functions |

### New Content

| Feature | Document |
|---------|----------|
| Recursion prohibition | 06-functions.md |
| All 56 asm_*() functions | 09-asm-functions.md |
| SFA architecture details | 10-compiler.md |
| Updated intrinsics (10 core) | 08-intrinsics.md |

## Estimated Effort

| Category | Documents | Sessions | Time |
|----------|-----------|----------|------|
| Update existing | 3 | 2-3 | 2-3 hours |
| Copy and modify | 6 | 4-5 | 4-5 hours |
| Create new | 2 | 2-3 | 2-3 hours |
| **Total** | **11** | **8-11** | **8-11 hours** |

## Quick Start

To begin implementation:

1. Read [99-execution-plan.md](99-execution-plan.md)
2. Start new chat session
3. Reference: "Implement Phase 1, Session 1.1 per plans/language-spec/99-execution-plan.md"

## Success Criteria

The specification is complete when:

1. ✅ All 11 documents created
2. ✅ No references to v1/v2/versions
3. ✅ No @map syntax documented
4. ✅ Recursion prohibition documented
5. ✅ All asm_*() functions documented
6. ✅ Old specification archived