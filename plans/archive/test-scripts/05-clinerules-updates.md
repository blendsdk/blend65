# Clinerules Updates Specification

> **Document**: 05-clinerules-updates.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the changes needed to existing `.clinerules` files to reference the new `testing.md` as the single source of truth for testing rules.

## Files to Update

| File | Section to Update | Change |
|------|-------------------|--------|
| `.clinerules/agents.md` | Rule 1 (Shell Commands) | Replace test command, add reference |
| `.clinerules/project.md` | Build/Test section | Replace test command, add reference |
| `.clinerules/code.md` | Section 2 (Testing) | Add reference to testing.md |

---

## Update 1: agents.md

### Current Content (Rule 1)

The current Rule 1 mentions `./test-all.sh` as the standard test command.

### Required Change

Replace the test command reference and add a reference to `testing.md`.

### Updated Section

Find the "Standard test command" line and update it to:

```markdown
**Standard Test Command:** See `testing.md` for complete testing rules and commands.

**Quick Reference:**
- Targeted tests: `./compiler-test <component>` (e.g., `./compiler-test parser`)
- All tests: `./compiler-test`
```

---

## Update 2: project.md

### Current Content

```markdown
### Build, Test, and Terminal

**Shell Commands:** See `agents.md Rule 1` for all shell command requirements (clear prefix, yarn usage).

**Standard Test Command:** From project root: `clear && yarn clean && yarn build && yarn test`
```

### Required Change

Replace the standard test command with reference to testing.md.

### Updated Content

```markdown
### Build, Test, and Terminal

**Shell Commands:** See `agents.md Rule 1` for all shell command requirements (clear prefix, yarn usage).

**Testing:** See `testing.md` for all testing rules and commands.

**Quick Reference:**
- Targeted tests: `./compiler-test <component>`
- All tests: `./compiler-test`
```

---

## Update 3: code.md

### Current Content (Section 2: Testing Requirements)

The section contains detailed testing rules (Rules 4-8) with inline commands.

### Required Change

Add a cross-reference to `testing.md` at the beginning of Section 2.

### Addition to Make

Add at the top of "## 2. Testing Requirements":

```markdown
## 2. Testing Requirements

**📖 See `testing.md` for complete testing commands and workflow rules.**

The following rules define testing standards for code quality. For specific commands
and AI workflow guidance, refer to `testing.md`.
```

---

## Update 4: Cross-References Section

### Files with Cross-References

At the end of several `.clinerules` files, there's a "## Cross-References" section.

### Updates Needed

**agents.md** - Add to cross-references:
```markdown
- See **testing.md** for complete testing commands and workflow rules
```

**code.md** - Add to cross-references:
```markdown
- See **testing.md** for test script usage and AI testing workflow
```

**project.md** - Add cross-references section if missing:
```markdown
---

## **Cross-References**

- See **agents.md** for shell command rules
- See **testing.md** for test commands and workflow
- See **code.md** for testing standards and requirements
```

---

## Verification Checklist

After updates:

- [ ] `agents.md` references `testing.md`
- [ ] `project.md` references `testing.md`
- [ ] `code.md` references `testing.md`
- [ ] All cross-references sections updated
- [ ] No duplicate/conflicting test command information
- [ ] `testing.md` is the single source of truth for test commands