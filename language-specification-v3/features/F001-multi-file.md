# F001 — Multi-file compilation

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)

## Description

The Blend65 compiler accepts multiple source files (`.blend`) as input and compiles them into a single binary. This is standard compiler behavior — no special syntax needed.

## Rules

- The compiler accepts one or more `.blend` source files
- All files are compiled together into a single output binary
- File names and directory structure have **no semantic meaning** — they do not affect module names, visibility, or compilation
- The compiler resolves cross-file references via the module/import system (see F002, F003)

## Language Guard Verdict

No ambiguities. Standard compiler capability. Passes all platform (P1–P4), hardware (H1–H5), and compiler (C1–C5) rules trivially.

