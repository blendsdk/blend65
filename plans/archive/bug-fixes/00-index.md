# Bug Fixes Implementation Plan

> **Feature**: Fix all known bugs and design issues from bug-list.md
> **Status**: Planning Complete
> **Created**: 2026-08-02

## Overview

This plan addresses all bugs and design issues documented in `bug-list.md`, plus a full audit of skipped tests across the codebase. Bugs are prioritized by severity: critical bugs first (broken codegen), then CLI usability bugs, then design improvements, and finally low-priority optimizations.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Bug descriptions and acceptance criteria |
| 02 | [Current State](02-current-state.md) | Source code analysis for each bug |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Bug Summary

| ID | Severity | Description | Component |
|----|----------|-------------|-----------|
| BUG-001 | 🔴 Critical | Double CMP destroys comparison flags | Code Generator |
| BUG-004 | 🔴 Critical | Duplicate labels across functions | Code Generator |
| BUG-005 | 🟡 Medium | CLI -O1 shorthand doesn't work | CLI |
| BUG-006 | 🟢 Low | CLI help missing optimization descriptions | CLI |
| BUG-007 | 🟡 Medium | Duplicate --optimization crashes compiler | CLI |
| BUG-002 | 🟢 Low | Redundant variable init before for-loop | Optimizer |
| BUG-003 | 🟢 Low | Misleading compiler-generated comments | Code Generator |
| DESIGN-001 | 🟡 Medium | Unsafe ZP address allocation | Frame Allocator |
| DESIGN-003 | 🟢 Low | Unnecessary JMP main | Code Generator |
| SKIP-AUDIT | 🟡 Medium | Enable all skipped tests | Testing |

### Key Files

| Component | Files |
|-----------|-------|
| Code Generator | `packages/compiler/src/codegen/generator/base.ts` and subclasses |
| CLI Build Command | `packages/cli/src/commands/build.ts` |
| Frame Allocator | `packages/compiler/src/frame/allocator/` |
| IL Builder | `packages/compiler/src/il/builder/base.ts` |

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Label uniqueness strategy | Global counter (never reset between functions) |
| CLI -O fix strategy | Remove 'O' prefix from choices, prepend in buildConfig |
| Duplicate --optimization | Last-wins (GCC behavior) |
| main() ordering | Emit main() first in code section, eliminate startup JMP |
