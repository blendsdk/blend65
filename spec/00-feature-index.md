# Blend65 Specification 4 — Reader Index

> **Role**: Non-normative navigation
> **Authority**: Follow links to the normative chapters, grammar, appendix, and diagnostic registry.

This file helps readers find Specification 4 material. It does not define language behavior,
diagnostic wording, target support, or corpus membership. The exact normative set and frozen corpus
identity are in [the normative inventory](00-normative-inventory.md).

## Normative Language and Platform Documents

| Topic | Normative owner |
|-------|-----------------|
| Scope, product boundary, and axioms | [00-introduction.md](00-introduction.md) |
| Lexical structure and reserved names | [01-lexical-structure.md](01-lexical-structure.md) |
| Types and conversions | [02-type-system.md](02-type-system.md) |
| Variables, constants, placement, and initialization | [03-variables.md](03-variables.md) |
| Expressions and operators | [04-expressions-operators.md](04-expressions-operators.md) |
| Statements, blocks, loops, and switch | [05-statements-control-flow.md](05-statements-control-flow.md) |
| Functions, calls, compile-time evaluation, and SFA | [06-functions.md](06-functions.md) |
| Structs | [07-structs.md](07-structs.md) |
| Arrays, strings, indexing, and encodings | [08-arrays-strings.md](08-arrays-strings.md) |
| Enums | [09-enums.md](09-enums.md) |
| Modules, imports, exports, and visibility | [10-modules.md](10-modules.md) |
| Memory, lifetimes, aliasing, and stack behavior | [11-memory-model.md](11-memory-model.md) |
| Core and CPU-control intrinsics | [12-intrinsics.md](12-intrinsics.md) |
| Embedded/loadable data and assets | [13-data-inclusion.md](13-data-inclusion.md) |
| Public diagnostics | [14-diagnostics.md](14-diagnostics.md) |
| Qualified target profiles | [15-platform-profile.md](15-platform-profile.md) |
| Commodore 64 platform and library contract | [appendix-c64.md](appendix-c64.md) |
| Master syntax | [grammar.ebnf.md](grammar.ebnf.md) |

Specification 4 qualifies Commodore 64 profiles only. Future-machine notes are non-normative and do
not activate target IDs or claim compiler support.

## Feature Evaluations

These files preserve design reasoning. They are subordinate to the normative owners above.

| ID | Topic | Evaluation |
|----|-------|------------|
| F001 | Multi-file compilation | [F001](evaluations/F001-multi-file.md) |
| F002 | Module declarations | [F002](evaluations/F002-modules.md) |
| F003 | Module contents and visibility | [F003](evaluations/F003-module-contents.md) |
| F004 | Program entry point | [F004](evaluations/F004-entry-point.md) |
| F005 | Memory placement | [F005](evaluations/F005-memory-placement.md) |
| F006 | Address-of operator | [F006](evaluations/F006-address-of.md) |
| F007 | Interrupt functions | [F007](evaluations/F007-interrupt-functions.md) |
| F008 | `for` loop | [F008](evaluations/F008-for-loop.md) |
| F009 | `switch` statement | [F009](evaluations/F009-switch-statement.md) |
| F010 | Signed integer types | [F010](evaluations/F010-signed-types.md) |
| F011 | Structs | [F011](evaluations/F011-structs.md) |
| F012 | CPU-control and packed-BCD intrinsics | [F012](evaluations/F012-cpu-control-intrinsics.md) |
| F013 | Control flow and block scope | [F013](evaluations/F013-control-flow.md) |
| F014 | Arrays, strings, characters, and const parameters | [F014](evaluations/F014-arrays.md) |
| F015 | Data inclusion and assets | [F015](evaluations/F015-data-inclusion.md) |
| F016 | Type-system rules | [F016](evaluations/F016-type-system.md) |
| F017 | Arithmetic, bitwise, logical, and comparison operators | [F017](evaluations/F017-operators.md) |
| F018 | Functions, calls, SFA, and recursion prohibition | [F018](evaluations/F018-functions.md) |
| F019 | Variables, constants, and startup initialization | [F019](evaluations/F019-variables.md) |
| F020 | Memory and layout intrinsics | [F020](evaluations/F020-memory-intrinsics.md) |
| F021 | Lexical structure | [F021](evaluations/F021-lexical-structure.md) |
| F022 | Enums | [F022](evaluations/F022-enums.md) |
| F024 | Conditional operator | [F024](evaluations/F024-conditional-operator.md) |
| F025 | Compile-time functions and trigonometry | [F025](evaluations/F025-comptime-functions.md) |

F023 is retired because transparent type aliases were rejected. The `type` keyword remains
reserved. See [REJ-001](future-considerations.md#rej-001-type-aliases-type-name--existingtype).

## Supporting Records

| Record | Purpose |
|--------|---------|
| [Normative inventory](00-normative-inventory.md) | Exact membership and corpus identity |
| [Future considerations](future-considerations.md) | Deferred, resolved, and rejected ideas |
| [Language Guard](../.clinerules/language-guard.md) | Design-review checklist and Specification 4 transition result |

Chapter 14 is the sole registry for diagnostic codes, severities, templates, spans, and retirement.
This index intentionally does not copy that registry.
