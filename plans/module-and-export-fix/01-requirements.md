# Requirements: Module Declaration and Export Warning Fix

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Bug Descriptions

### Bug 1: Module Declaration Semicolon Error (P004)

**Reported Error:**
```
error[P004]: Unexpected token ';' at module scope. Only declarations (variables, functions, types, enums) and imports/exports are allowed at module level.
  --> @stdlib/common/system.blend:13:14
    |
 13 | module system;
```

**Source Code:**
```js
module system;
```

**Expected Behavior:** Module declarations with semicolons should parse successfully per language specification.

**Actual Behavior:** Parser treats semicolon as unexpected token.

**Severity:** HIGH - Blocks compilation of valid Blend code

---

### Bug 2: Export Variable "Never Read" Warning (S002)

**Reported Warning:**
```
warning[S002]: Variable 'COLOR_LIGHT_GREEN' is assigned but never read
  --> @stdlib/c64/common/hardware.blend:225:8
    |
225 | export const COLOR_LIGHT_GREEN: byte = 13;
```

**Source Code:**
```js
export const COLOR_LIGHT_GREEN: byte = 13;
```

**Expected Behavior:** Exported variables should not trigger "never read" warnings because they are explicitly exposed for external use.

**Actual Behavior:** Semantic analyzer warns about exported variables not being read locally.

**Severity:** MEDIUM - Creates noise in warnings, confuses users

## Language Specification Reference

### Module Declaration Syntax

From `docs/language-specification/04-module-system.md`:

```ebnf
module_decl = "module" , name , ";" ;
name = identifier , { "." , identifier } ;
```

**Key Point:** Module declarations MUST end with a semicolon.

### Export Semantics

From `docs/language-specification/04-module-system.md`:

> The `export` keyword makes declarations visible to other modules.

**Key Point:** Exported symbols are intentionally made available for external consumption. Their purpose is to be used by OTHER modules, not necessarily the declaring module.

## Functional Requirements

### Must Have

- [x] Module declarations ending with semicolon must parse successfully
- [x] Exported variables must not trigger "assigned but never read" warnings
- [x] All existing tests must continue to pass
- [x] No breaking changes to current behavior

### Should Have

- [x] Clear test cases for both fixes
- [x] Minimal code changes (single-line fixes)

### Won't Have

- Out of scope: Major refactoring of parser or semantic analyzer
- Out of scope: New error codes or diagnostic messages

## Acceptance Criteria

1. ✅ `module system;` parses without error
2. ✅ `module Game.Main;` parses without error
3. ✅ `export const FOO: byte = 1;` does not trigger S002 warning
4. ✅ Non-exported variables still trigger S002 warning when appropriate
5. ✅ All 6585+ existing tests pass
6. ✅ Library Loading System works with standard libraries

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Semicolon parsing | Optional vs Required | Required | Language spec says semicolon is required |
| Export check scope | Just variables vs all declarations | Just variables | Bug only reported for variables |