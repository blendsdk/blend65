# Rich Diagnostic Output Implementation Plan

> **Status**: Ready for Implementation
> **Created**: 2026-01-24
> **Objective**: Implement rich error/warning output with source code snippets and caret markers

## Problem Statement

Currently, compiler diagnostics show "unknown:1:1" for source locations:

```
warning: PEEK intrinsic not yet implemented - waiting for optimizer
  --> unknown:1:1
```

We need rich diagnostics like Rust/TypeScript compilers:

```
error: Unknown type 'bite[]'
  --> examples/simple/main.blend:5:24
   |
 5 | function process(param: bite[]): void
   |                         ^^^^^^
```

## Root Cause Analysis

1. **File path not tracked**: `codegen-phase.ts` uses `ilModule.name` (module name) instead of file path
2. **Location hardcoded**: Line/column hardcoded to 1:1 instead of actual source location
3. **No source text access**: Formatter cannot show code snippets without original source text

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Compiler Pipeline                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Parser    │───▶│   IL Gen    │───▶│     Code Gen        │ │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘ │
│         │                  │                      │             │
│         ▼                  ▼                      ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Source    │    │ IL Metadata │    │  Codegen Warnings   │ │
│  │   Text +    │    │  (location) │    │   (with location)   │ │
│  │   Location  │    └──────┬──────┘    └──────────┬──────────┘ │
│  └──────┬──────┘           │                      │             │
│         │                  │                      │             │
│         ▼                  ▼                      ▼             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Source Registry                         │  │
│  │            (maps file path → source text)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                Enhanced Formatter                         │  │
│  │    - Extract source line                                  │  │
│  │    - Generate caret markers                               │  │
│  │    - Format rich diagnostic output                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Source Text Registry

**Session 1 | ~45 minutes | Low Risk**

### Objective
Create a registry to store original source text for snippet extraction.

### Files to Create/Modify

1. **Create**: `packages/compiler/src/utils/source-registry.ts`
   - `SourceRegistry` class
   - Methods: `register(filePath, sourceText)`, `get(filePath)`, `getLine(filePath, lineNum)`
   - Singleton pattern for global access

2. **Modify**: `packages/compiler/src/pipeline/parse-phase.ts`
   - Register source text after reading file
   - Pass registry reference through pipeline

3. **Modify**: `packages/cli/src/commands/build.ts`
   - Pass registry to compiler

### Task Breakdown

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Create SourceRegistry class with register/get methods | [ ] |
| 1.2 | Add getLine method for extracting specific lines | [ ] |
| 1.3 | Integrate registry into parse phase | [ ] |
| 1.4 | Pass registry through compiler pipeline | [ ] |
| 1.5 | Add unit tests for SourceRegistry | [ ] |

### Deliverables
- `SourceRegistry` class with full test coverage
- Integration into compile pipeline
- Source text accessible by file path

---

## Phase 2: Enhanced Diagnostic Formatter

**Session 2 | ~60 minutes | Medium Risk**

### Objective
Update the formatter to show source code snippets with caret markers.

### Files to Modify

1. **Modify**: `packages/cli/src/output/formatter.ts`
   - Add `formatDiagnosticWithSnippet()` function
   - Add `extractSourceLine()` helper
   - Add `generateCaretMarker()` helper
   - Update `formatDiagnostic()` to use snippets when source available

2. **Modify**: `packages/compiler/src/ast/diagnostics.ts` (if needed)
   - Potentially add source text reference to Diagnostic interface

### Output Format

```
error: Unknown type 'bite[]'
  --> examples/simple/main.blend:5:24
   |
 5 | function process(param: bite[]): void
   |                         ^^^^^^
   |
   = help: Did you mean 'byte[]'?
```

### Task Breakdown

| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Add extractSourceLine helper function | [ ] |
| 2.2 | Add generateCaretMarker helper function | [ ] |
| 2.3 | Create formatDiagnosticWithSnippet function | [ ] |
| 2.4 | Handle edge cases (multi-line, tabs, long lines) | [ ] |
| 2.5 | Update formatDiagnostic to use snippets | [ ] |
| 2.6 | Add unit tests for formatter enhancements | [ ] |

### Edge Cases to Handle
- Multi-line spans (show first and last line with ellipsis)
- Tab characters (expand to spaces for alignment)
- Very long lines (truncate with context)
- Missing source text (graceful fallback)

### Deliverables
- Rich diagnostic output with source snippets
- Caret markers pointing to exact error location
- Graceful fallback when source unavailable

---

## Phase 3: Codegen Location Tracking

**Session 3 | ~30 minutes | Low Risk**

### Objective
Pass actual source locations from IL instructions to codegen warnings.

### Files to Modify

1. **Modify**: `packages/compiler/src/codegen/base-generator.ts`
   - Update `addWarning` to accept optional `SourceLocation`
   - Store warnings as objects with location, not just strings

2. **Modify**: `packages/compiler/src/codegen/instruction-generator.ts`
   - Pass `instr.metadata.location` when calling `addWarning`
   - Update PEEK/POKE warning calls

3. **Modify**: `packages/compiler/src/pipeline/codegen-phase.ts`
   - Use actual location from warning objects
   - Fall back to module location if not available

### Task Breakdown

| Task | Description | Status |
|------|-------------|--------|
| 3.1 | Update addWarning signature in base-generator.ts | [ ] |
| 3.2 | Create warning object type with message + location | [ ] |
| 3.3 | Update instruction-generator.ts to pass locations | [ ] |
| 3.4 | Update codegen-phase.ts to use warning locations | [ ] |
| 3.5 | Test warnings show correct source locations | [ ] |

### Deliverables
- Codegen warnings show actual source file and location
- IL instruction locations properly propagated

---

## Implementation Checklist

| Phase | Task | Description | Status |
|-------|------|-------------|--------|
| 1 | 1.1 | Create SourceRegistry class | [ ] |
| 1 | 1.2 | Add getLine method | [ ] |
| 1 | 1.3 | Integrate into parse phase | [ ] |
| 1 | 1.4 | Pass through pipeline | [ ] |
| 1 | 1.5 | Unit tests | [ ] |
| 2 | 2.1 | extractSourceLine helper | [ ] |
| 2 | 2.2 | generateCaretMarker helper | [ ] |
| 2 | 2.3 | formatDiagnosticWithSnippet | [ ] |
| 2 | 2.4 | Edge case handling | [ ] |
| 2 | 2.5 | Update formatDiagnostic | [ ] |
| 2 | 2.6 | Formatter unit tests | [ ] |
| 3 | 3.1 | Update addWarning signature | [ ] |
| 3 | 3.2 | Create warning object type | [ ] |
| 3 | 3.3 | Update instruction-generator | [ ] |
| 3 | 3.4 | Update codegen-phase | [ ] |
| 3 | 3.5 | Integration testing | [ ] |

---

## Testing Strategy

### Unit Tests
- SourceRegistry: register, get, getLine
- Formatter: extractSourceLine, generateCaretMarker, formatDiagnosticWithSnippet

### Integration Tests
- Full compile with intentional error → verify rich output
- Codegen warning → verify source location shown

### Manual Testing
- Compile `examples/simple/*.blend` with errors
- Verify output matches expected format

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Source text memory usage | Low | Only store during compilation, not persistent |
| Performance | Low | Source registry lookup is O(1) hash map |
| Breaking changes | Low | Formatter changes are additive |
| Edge cases | Medium | Comprehensive edge case handling in Phase 2 |

---

## Success Criteria

1. ✅ Compiler warnings show actual file path (not "unknown")
2. ✅ Compiler warnings show actual line/column (not "1:1")  
3. ✅ Error output includes source code snippet
4. ✅ Caret markers point to exact error location
5. ✅ Graceful fallback when source not available
6. ✅ All existing tests pass
7. ✅ New tests added for all new functionality

---

## Dependencies

- None external
- Builds on existing `SourceLocation` interface
- Builds on existing `Diagnostic` interface

## References

- `.clinerules/agents.md` - Multi-session task rules
- `packages/cli/src/output/formatter.ts` - Current formatter
- `packages/compiler/src/ast/diagnostics.ts` - Diagnostic types
- `packages/compiler/src/pipeline/codegen-phase.ts` - Warning conversion