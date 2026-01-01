# Blend64 v0.1 — Intermediate Representation (IL) Addendum

**Status:** Mandatory **Applies to:** All Blend64 compilers **Scope:** Compiler architecture and guarantees **Purpose:**
Enable deterministic optimization, performance analysis, and correct code emission for Commodore 64

---

## 0. Purpose of This Addendum

This document formally defines the requirement, scope, and constraints of the **Blend64 Intermediate Representation
(IL)**.

The IL exists to:

-   enforce Blend64’s static and deterministic guarantees
-   enable aggressive performance optimization (maximum FPS)
-   make memory usage, control flow, and cycle costs explicit
-   simplify compiler implementation by removing ad-hoc logic

The IL is **not** a runtime, VM, or portability layer.

---

## 1. IL Is Mandatory

### Rule

A conforming Blend64 compiler **MUST** introduce a single, explicit **Intermediate Representation (IL)** after the magic
phase and before final 6502 code emission.

This IL is the **only** input to:

-   reachability analysis
-   dead-code elimination
-   inlining decisions
-   zero-page allocation
-   cycle-cost estimation
-   final PRG emission

Direct AST → 6502 code generation is **non-conforming**.

---

## 2. What the Blend64 IL Is NOT

The Blend64 IL **MUST NOT**:

-   be portable across architectures
-   resemble LLVM IR, SSA, or bytecode
-   imply or require a runtime
-   introduce a VM or interpreter
-   abstract away 6502-specific behavior
-   allow dynamic memory, heap, or stack allocation

Any IL that could theoretically target another CPU **violates the Blend64 design goals**.

---

## 3. What the Blend64 IL IS

The Blend64 IL is:

-   **Target-specific** (MOS 6502 / 6510)
-   **Ahead-of-time only**
-   **Non-executable**
-   **Fully static**
-   **Deterministic**

It represents a **lowered, structured form of 6502 semantics**, suitable for analysis and emission.

> Conceptually: _“structured assembly with guarantees”_

---

## 4. Position in the Compiler Pipeline

A conforming compiler pipeline is:

No phase may bypass the IL.

---

## 5. Responsibilities of the Magic Phase (Reaffirmed)

The magic phase **MUST** lower all high-level constructs into IL-compatible forms:

-   flatten `extends` in records
-   desugar `match`, `for`, `hotloop`
-   resolve storage classes and placements
-   select helper routines
-   reject unsupported or unsafe constructs
-   finalize static memory shapes
-   build an initial call graph

After this phase, **no high-level language features remain**.

---

## 6. Required Properties of the IL

The IL **MUST** make the following explicit:

### 6.1 Control Flow

-   basic blocks
-   labels
-   conditional and unconditional jumps
-   loop back-edges
-   function boundaries

### 6.2 Memory Access

-   zero-page vs absolute addressing
-   read vs write
-   static symbol identity
-   array indexing lowering
-   pointer/address usage

### 6.3 Calling Semantics

-   parameter passing locations (A/X/Y/ZP)
-   return value locations
-   clobbered registers
-   call targets

### 6.4 Helper Routines

-   helper identity (e.g. `mul16`, `hex8`)
-   explicit call sites
-   no implicit linkage

---

## 7. Cycle and Size Accounting (Mandatory)

Each IL instruction **MUST** carry static metadata:

-   `cycles_min`
-   `cycles_max` (branch taken / page crossing)
-   `bytes`
-   register clobbers (A/X/Y/flags)
-   memory reads/writes (zp / abs)

This metadata is used to compute:

-   per-basic-block cycle ranges
-   per-function hot-path estimates
-   per-`hotloop` iteration cost
-   performance reports required by fast profile

The IL is the **sole source of truth** for performance reporting.

---

## 8. Reachability and Dead-Code Elimination

Reachability analysis **MUST** operate on the IL.

Rules:

-   only IL blocks reachable from entry points are emitted
-   unused helper routines are discarded
-   unreachable functions are eliminated
-   unused static data is not emitted

Dead-code elimination **MUST NOT** operate on the AST or source-level constructs.

---

## 9. Zero-Page Allocation Depends on IL

Zero-page policy enforcement **MUST** be based on IL analysis:

-   frequency of access
-   addressing mode selection
-   hotness propagation
-   call-graph influence

The compiler **MUST NOT** allocate zero-page purely from source-level heuristics.

IL-level memory access analysis is mandatory.

---

## 10. Inlining and Specialization

Inlining decisions **MUST** be made on IL functions and blocks, not AST nodes.

Inlining is permitted to increase code size if:

-   the call site is hot
-   the callee is small
-   cycle cost is reduced

Inlining **MUST** update:

-   IL control flow
-   call graph
-   cycle accounting
-   reachability information

---

## 11. Determinism Requirement

For identical source input and compiler configuration:

-   the IL **MUST** be identical
-   instruction ordering **MUST NOT** depend on hash maps, memory layout, or non-deterministic iteration
-   all allocation decisions must be stable

Deterministic IL guarantees deterministic PRG output.

---

## 12. Debugging and Auditability

The compiler **MUST** be able to emit:

-   a textual IL dump
-   IL annotated with cycle/size metadata
-   a mapping from IL blocks to source constructs

This is required to allow:

-   manual performance inspection
-   verification against hand-written assembly
-   trust in compiler output

---

## 13. Design Principle (Reaffirmed)

> **The IL reduces magic — it does not add it.**

All non-trivial compiler decisions must operate on a representation where:

-   costs are explicit
-   memory is explicit
-   control flow is explicit

Anything else is a violation of Blend64’s assembler-plus philosophy.

---

## End of Addendum
