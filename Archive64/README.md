# Blend64

> ⚠️ **WORK IN PROGRESS — EARLY DEVELOPMENT** ⚠️  
>
> **Blend64 is in a very early design and prototyping stage.**  
> The language specification, compiler architecture, Intermediate Representation (IL), and performance rules are **not finalized** and **will change**.  
> Nothing in this repository should be considered stable, complete, or production-ready.

---

## What Is Blend64?

**Blend64** is an **assembler-plus, ahead-of-time compiled language** designed specifically for **high-performance Commodore 64 game development**.

It is inspired by the original *Blend* syntax but deliberately **cuts away modern-language abstractions** that do not map cleanly to 6502 hardware.

Blend64 exists for developers who want:

- predictable memory usage
- deterministic performance
- maximum possible FPS on real C64 hardware
- zero implicit runtime or standard library
- full control over memory layout without writing assembly

> **Blend64 is what experienced C64 developers wish assembly looked like.**

---

## Core Design Goals

- Ahead-of-time compilation to a single C64 PRG
- No implicit runtime
- Reachability-based dead-code elimination
- Static memory only
- Deterministic output
- Performance-first lowering

---

## What Blend64 Is NOT

- Not a VM or bytecode language
- Not an interpreter
- Not a C replacement
- Not a BASIC replacement
- Not a scripting language
- Not portable

---

## Compiler Architecture (High Level)

Source  
→ AST  
→ Type Checking  
→ **Lowering & Validation Phase**  
→ Blend64 IL  
→ Optimization  
→ 6502 Codegen  
→ PRG

### Lowering & Validation Phase

The **Lowering & Validation Phase** is a mandatory compiler stage that:

- removes high-level syntax sugar
- enforces static memory rules
- rejects unsupported constructs
- selects helper routines
- builds the call graph
- prepares IL input

---

## Status

This project is **spec-first** and **under active design**.

Expect breaking changes.

---

## License

TBD
