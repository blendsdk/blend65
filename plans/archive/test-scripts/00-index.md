# Test Scripts Enhancement Implementation Plan

> **Feature**: Enhanced targeted test runner with AI rules integration
> **Status**: Planning Complete
> **Created**: 2026-01-26

## Overview

This plan implements an enhanced test runner script (`compiler-test`) that allows targeted testing of specific compiler components. With 6500+ tests, running all tests every time is time-consuming and often overkill. The new script enables running tests for specific components (lexer, parser, il, etc.) while maintaining the option to run all tests.

Additionally, this plan creates comprehensive testing rules in `.clinerules/testing.md` and updates all other `.clinerules` files to reference it, ensuring AI agents follow proper testing practices.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current testing setup |
| 03 | [Test Script](03-test-script.md) | compiler-test script specification |
| 04 | [Testing Rules](04-testing-rules.md) | .clinerules/testing.md specification |
| 05 | [Clinerules Updates](05-clinerules-updates.md) | Updates to existing .clinerules files |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Usage Examples

```bash
# Run all tests
./compiler-test

# Run parser tests only
./compiler-test parser

# Run lexer and IL tests
./compiler-test lexer il

# Run specific subdirectory tests
./compiler-test semantic/type
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Static vs Dynamic component list | Dynamic - accepts any pattern |
| Build behavior | Always clean+build before testing |
| Backward compatibility | Keep test-all.sh as alias |

## Related Files

**New Files:**
- `compiler-test` - New targeted test runner script
- `.clinerules/testing.md` - Testing rules for AI

**Modified Files:**
- `.clinerules/agents.md` - Reference testing.md
- `.clinerules/project.md` - Reference testing.md
- `.clinerules/code.md` - Reference testing.md