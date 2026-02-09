# Build Integration & Error Navigation

> **Document**: 08-build-integration.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete
> **Priority**: Phase 8 (Future)

## Overview

Build integration allows users to compile Blend65 projects from within VS Code and navigate to errors. This is a **future phase** — the initial release focuses on editing features (syntax highlighting, IntelliSense, diagnostics).

## Planned Features

### Build Task Provider

Register a VS Code task provider that auto-detects Blend65 projects:

```jsonc
// contributes.taskDefinitions in package.json
{
  "taskDefinitions": [{
    "type": "blend65",
    "properties": {
      "target": { "type": "string", "description": "Target platform (c64)" },
      "entry": { "type": "string", "description": "Entry .blend file" },
      "output": { "type": "string", "description": "Output file path" }
    }
  }]
}
```

### Problem Matcher

Parse compiler output and link errors to source locations:

```jsonc
{
  "problemMatchers": [{
    "name": "blend65",
    "owner": "blend65",
    "pattern": [{
      "regexp": "^(error|warning)\\[(.+)\\]: (.+)$",
      "severity": 1, "code": 2, "message": 3
    }, {
      "regexp": "^\\s+-->\\s+(.+):(\\d+):(\\d+)$",
      "file": 1, "line": 2, "column": 3
    }]
  }]
}
```

### Status Bar Integration

Show compilation status in the status bar:
- 🟢 "Blend65: OK" — no errors
- 🔴 "Blend65: 3 errors" — click to show problems panel

## Implementation Notes

- Invoke `@blend65/cli` via `blend65 build` command
- Parse structured compiler output (JSON mode)
- Map output diagnostics to LSP problem matcher format
- Auto-detect `blend65.config.json` or `package.json` with Blend65 config
