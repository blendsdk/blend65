# Blend64 – Remaining Required Specifications & Deliverables (v0.1)

This document enumerates the remaining specification and design items required to fully implement Blend64 as a
deterministic, ahead-of-time compiled, assembler-plus language targeting the Commodore 64.

All items listed here are **mandatory** for a complete compiler toolchain that emits fast, minimal, predictable PRGs
with no implicit runtime.

---

## 1. Complete Language Reference (Grammar + Semantics)

A single authoritative reference that is precise enough to be implemented directly by a compiler written in TypeScript.

### Required Contents

-   Full lexical grammar (tokens, identifiers, literals, comments)
-   Full syntactic grammar (statements, expressions, declarations)
-   Attribute grammar and placement rules
-   Constant-expression rules
-   Compile-time vs runtime expression separation
-   Initialization semantics:
    -   Data emitted as bytes vs init code
    -   Reachability rules for init code
-   Record/struct layout rules:
    -   Packing and ordering
    -   Endianness (little-endian)
    -   Offset determinism
-   Array layout and indexing rules
-   Arithmetic and bitwise operator semantics:
    -   Overflow behavior
    -   Shift masking rules
    -   Division/modulo constraints
-   Error conditions that must be detected at compile time

### Outcome

A document that removes _all ambiguity_ from the language surface.

---

## 2. Attributes, Hotness, and Performance Annotations (Integrated Spec)

Performance-related constructs must be first-class citizens of the language spec, not add-ons.

### Required Contents

-   Formal definition of all attributes:
    -   `@hot`
    -   `@irq`
    -   `@inline` / `@noinline`
    -   `@unroll(N)`
    -   `@budget(cycles=N)`
-   Attribute placement rules and conflicts
-   `hotloop { ... }`:
    -   Syntax
    -   Restrictions
    -   Lowering rules
-   Hotness propagation algorithm:
    -   Root selection
    -   Transitive closure
    -   Deterministic ordering
-   Compile-time enforcement rules

### Outcome

Performance is explicit, analyzable, and compiler-enforced.

---

## 3. Intermediate Language (IL) – Full Specification

A complete, mandatory IL that all Blend64 code lowers into before 6502 codegen.

### Required Contents

-   Complete IL instruction set:
    -   Operands
    -   Addressing modes
    -   Typing rules
    -   Flag effects
-   Control-flow rules:
    -   Basic block structure
    -   Branch termination rules
    -   No implicit fallthrough
-   Calling convention encoding:
    -   Parameters
    -   Return values
    -   Register usage
-   Zero-page usage model:
    -   Allocation inputs
    -   Stability rules
-   IL metadata model:
    -   Hotness
    -   IRQ context
    -   Addressing constraints
-   Required optimizer passes:
    -   Dead code elimination
    -   Inlining
    -   Strength reduction
    -   Constant folding
    -   Jump table selection
-   Determinism guarantees

### Outcome

A stable, auditable IR that makes optimization and codegen predictable.

---

## 4. PRG, Segments, and Linker / Memory Model Specification

Defines how compiled output becomes a runnable C64 program.

### Required Contents

-   Segment definitions:
    -   Zero-page
    -   BSS
    -   Data
    -   Const
    -   IO
-   Default memory placement
-   Explicit placement using `@ $xxxx`
-   PRG load address rules
-   Entry-point and startup behavior
-   Assumptions about machine ownership (fast profile)
-   Optional ROM/RAM intent annotations
-   Artifact formats:
    -   `.prg`
    -   `.map`
    -   `.sym`
    -   `.lst`
    -   Performance report format

### Outcome

A fully deterministic binary layout and tooling ecosystem.

---

## 5. IRQ, Re-entrancy, and Static Temporary Rules

Formalizes correctness and safety in a no-stack, no-locals world.

### Required Contents

-   Definition of IRQ context boundaries
-   Rules for calling across IRQ/non-IRQ contexts
-   Static temporary allocation model:
    -   Main vs IRQ separation
    -   Naming / declaration syntax
-   Compile-time error rules for violations
-   Register preservation guarantees

### Outcome

Safe interrupt-driven code with zero runtime checks.

---

## 6. Minimal `c64:*` Module API Specifications (v0.1)

Defines the smallest possible set of standard modules required to build real games, without introducing a runtime.

### Required Modules

-   `c64:mem`
-   `c64:vic`
-   `c64:cia`
-   `c64:irq`
-   `c64:sprites`
-   `c64:sid` (optional but recommended)

### Required Per Module

-   Public API signatures
-   Side effects
-   Register clobbers
-   Memory usage
-   Reachability guarantees (tree-shaken)

### Outcome

Reusable, explicit, zero-magic building blocks for games.

---

## Final Goal

Once all six items are completed:

-   The language surface is frozen
-   The IL is stable
-   Codegen is deterministic
-   Performance is analyzable at compile time
-   The compiler can be implemented end-to-end in TypeScript
-   Blend64 becomes a true **assembler-plus language for serious C64 games**

---
