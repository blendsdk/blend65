# Chapter 00 — Introduction & Design Axioms

> **Version**: 4.0
> **Status**: draft  
> **Stability**: stable

---

## 1. What Is Blend65?

Blend65 is a statically typed systems language, ahead-of-time compiler, toolchain, and narrow
target-platform library for the MOS 6502 family. It provides a modern, C-like development
experience while generating machine code that meets the hard real-time and memory constraints of
8-bit hardware.

Blend65 supports games, renderers, demos, tools, and any other software its qualified machines can
run. It is purpose-built for machines that have:

- A single CPU running at 1–8 MHz
- Between 4 KB and 512 KB of RAM (often banked)
- No operating system, no virtual memory, no memory protection
- Display hardware that demands cycle-counted code on specific scanlines
- A 256-byte hardware stack shared between the program and the CPU

The language exists so that developers can write games, demos, tools, and system software for these machines in a structured, type-safe language — without sacrificing the control and efficiency that assembly language provides.

---

## 2. Qualified Targets and Product Boundary

Specification 4 qualifies only Commodore 64 profiles. The exact eight resident PRG identities and
one D64 identity are defined in Chapter 15 and Appendix A. One exact profile ID selects CPU, video,
ROM/startup, banking, interrupts, SID, memory, artifact, loader, exit, and evidence together.
Unknown, planned, partial, or mixed identities are rejected before lowering.

Core language semantics remain target-neutral and must pass on every qualified active target.
Hardware operations, external asset adapters, placement, and delivery live in the selected target
library and profile. Future-machine constraints are non-normative design pressure only; they do not
claim compiler support.

Blend65 is not a game engine, game framework, or gameplay library. It does not supply game loops,
entities or pools, collision, state dispatch, renderers, scene graphs, sprite multiplexers,
scrolling engines, buffer managers, audio schedulers, or mixers. Developers write those systems in
ordinary Blend65. The toolchain may ingest, validate, convert, type, place, and package external
assets and expose exact imported-player ABIs, but it does not own application policy. Examples and
game workloads are qualification evidence, not public game modules.

---

## 3. Design Axioms

These five axioms are **foundational decisions**, not features. They are givens that every language feature must respect. The Language Guard (§4) enforces them.

### A1 — C-Like Syntax

Blend65 uses curly braces for blocks, semicolons as statement terminators, `name: type` for type annotations, and C-style operators. A developer fluent in C, TypeScript, or JavaScript should be able to read Blend65 code without consulting the specification.

```blend65
function movePlayer(dx: sbyte, dy: sbyte): void {
    let newX: sword = sword(playerX) + sword(dx);
    if (newX >= 0 && newX < 320) {
        playerX = word(newX);
    }
}
```

### A2 — Static Frame Allocation (SFA)

All memory allocation is determined at compile time. There is no heap, no `malloc`, no garbage
collector, and no recursion. Each source function receives one static invocation-private home for
every execution-domain specialization required by the complete call/interruption graph. Functions
whose lifetimes cannot overlap may reuse storage; overlapping mainline/IRQ/NMI paths may not.
A local variable's address may be borrowed only while that local's dynamic source lifetime is
active. The compiler rejects any local-origin address or derived fragment that may outlive that
lifetime; persistent addresses use module-level or caller-owned storage instead.

**Why:** The 6502 has a 256-byte hardware stack, no frame pointer register, and no memory protection. Dynamic allocation on this hardware is fragile, non-deterministic, and wastes precious cycles. SFA guarantees that memory usage is predictable, bounded, and verifiable at build time.

→ Full SFA specification: Ch 11 (Memory Model & SFA)

### A3 — No Undefined Behavior

Every possible input to the compiler produces either:

1. A well-defined result (documented), or
2. A compile-time error with a specific error code and actionable message.

There is no "undefined behavior" in Blend65. Integer overflow wraps deterministically (two's
complement). Every operation has defined control flow, width, effects, and cost obligations: it never
licenses the optimizer to delete or reorder surrounding code or to treat a possible result as
impossible. The only unspecified result bits are the explicitly registered hardware-limitation
exceptions for indeterminate storage and default runtime division by zero. Default unchecked array
indexing has an exact 16-bit effective-address rule even when it reaches unrelated memory or MMIO.

**Unspecified values are not undefined behavior.** A variable declared without an initializer (→ Ch 03, VAR-2) holds an **unspecified value** — whatever bytes already occupied that RAM, zero-page, or register location. Reading it is fully defined: it yields *some* valid value of the variable's type, of the correct width, with no other effect. The value is simply not *predictable*. This is a deliberate design choice — Blend65 does not auto-zero variables at startup, because doing so would cost cycles and bytes that the target hardware cannot spare. The distinction is:

- **Undefined behavior** (forbidden): the operation has no defined effect and may corrupt the program. Blend65 has none of this.
- **Unspecified value** (permitted only where registered): control flow, result width, and observable
  effects are fixed, but the particular result bits are not predictable. The optimizer may not invent
  additional assumptions from that fact.

**Why:** On a machine with no OS, no exception handler, and no debugger, undefined behavior means a hard crash, an infinite loop, or silent memory corruption — with zero diagnostic information. The cost of defining all behavior is far less than the cost of debugging undefined behavior on bare metal.

### A4 — Explicit Over Implicit

Blend65 requires explicit type annotations on every declaration. There is no type inference. Cross-signedness conversions require explicit casts. Narrowing conversions require explicit casts. The developer states their intent; the compiler enforces it.

**Why:** On the 6502, the difference between `byte` and `word` is the difference between 1-byte and 2-byte storage, between 4-cycle and 12-cycle arithmetic, between direct and indirect addressing. This is a design decision, not a detail to be inferred. Making it explicit documents the developer's intent for every reader of the code.

### A5 — Target-Neutral Core

Every core language feature must compile correctly on every qualified active target. Features that
are inherently platform-specific are not part of the core language; they belong in a qualified
platform library accessed through the module system.

The core specification never references specific hardware addresses, chip names, character encodings, or platform names. All such details are defined in platform profiles (→ Ch 15).

---

## 4. The Language Guard

The Language Guard is a 23-rule quality gate organized into five categories. Every language feature must pass all 23 rules (or invoke an explicit escape hatch) before entering the specification.

| Category | Rules | Focus |
|----------|-------|-------|
| **P** — Platform Universality | P1–P4 | Works on all targets; useful on all targets; no platform assumptions; resource-scalable |
| **H** — Hardware / 6502 Feasibility | H1–H5 | Compiles to 6502; cost is transparent; SFA compatible; memory footprint known; fully deterministic |
| **L** — Language Design Quality | L1–L9 | Unambiguous; consistent; beginner-friendly; minimal; non-redundant; error messages defined; compile-time failures preferred; interactions documented; documentable with examples |
| **C** — Compiler Implementability | C1–C5 | Lexable/parseable; semantic analysis defined; codegen strategy exists; unit-testable; runtime-verifiable in emulators |
| **F** — Future-Proofing | F1–F4 | Extensible; platform-profile ready; optimizer-friendly; stability-classified |

When a feature cannot pass all rules, one of five **escape hatch tiers** applies:

| Tier | Name | When Used |
|------|------|-----------|
| 1 | Platform Subset | Feature works but is constrained on some platforms → compiler warning |
| 2 | Platform Library | Feature is inherently platform-specific → not in core, provided as a library |
| 3 | Conditional Compilation | Behavior genuinely differs per platform → minimal `#if platform` directive |
| 4 | Feature Flag | Feature is too expensive for constrained platforms → opt-in via compiler flag |
| 5 | Reject / Defer | Feature fundamentally cannot work → removed or deferred to a future version |

The complete Language Guard with all 23 rules, escape hatch definitions, and the feature evaluation template is maintained as a separate operational document (`.clinerules/language-guard.md`). The guard is not part of the language specification — it is the process by which the specification is validated.

---

## 5. Stability Classifications

Every language feature carries a stability classification that sets expectations for users:

| Classification | Meaning | Contract |
|----------------|---------|----------|
| **stable** | Fully designed, will not change | Breaking changes require a major version bump |
| **provisional** | Designed but may be refined | Minor syntax/semantic adjustments possible in the next version |
| **experimental** | Exploratory, may be removed | No stability guarantee; may disappear entirely. Compiler warns on use |

All features in Specification 4 are classified **stable** unless explicitly noted otherwise.

---

## 6. Specification Structure

This specification is organized into 16 chapters:

| Ch | Title | Scope |
|----|-------|-------|
| 00 | Introduction & Design Axioms | This chapter |
| 01 | Lexical Structure | Tokens, keywords, literals, comments |
| 02 | Type System | Types, promotion, casting, mixing rules |
| 03 | Variables & Constants | `let`, `const`, initialization, zero-page placement |
| 04 | Expressions & Operators | Operators, precedence, address-of, intrinsics |
| 05 | Statements & Control Flow | Blocks, `if`/`else`, `while`, `do-while`, `for`, `switch` |
| 06 | Functions | Declaration, calling, SFA frames, recursion prohibition, interrupts |
| 07 | Structs | Struct types, fields, literals, restrictions |
| 08 | Arrays & Strings | Array types, string literals, char literals, fill syntax |
| 09 | Enums | Byte-backed nominal types, asymmetric conversion |
| 10 | Modules & Multi-File | Module declarations, imports/exports, entry point |
| 11 | Memory Model & SFA | Static frame allocation, zero-page budget, address model |
| 12 | CPU Control & Intrinsics | Five exact CPU controls, explicit packed BCD, and memory intrinsics |
| 13 | Data Inclusion & Asset Embedding | `embed()`, format selectors, const-only placement |
| 14 | Diagnostics: Error & Warning Registry | Complete E1xxxx / W1xxxx tables |
| 15 | Conformance & Platform Profile Contract | What a platform profile must define |

**Notation conventions:**

- `→ Ch NN` — cross-reference to another chapter.
- Rule IDs (e.g., TS-4, ST-1) reference the canonical rule in its owning chapter.
- Error codes use the format `E1xxxx` (errors) and `W1xxxx` (warnings), 5 digits starting at 10000.
- EBNF grammar fragments appear inline where relevant; the complete grammar is a separate document.
- Source files use the `.blend` extension (→ Ch 01, §2.1). Code examples in this specification are tagged `blend65` purely as a syntax-highlighting hint; the tag is not a file extension.

---

## 7. Conventions in Code Examples

All code examples in this specification are valid Blend65 4 programs or program fragments unless marked otherwise. Invalid examples are annotated with the specific error code they produce:

```blend65
let x: byte = 200;          // ✅ Valid
let y = 200;                 // ❌ E10150: type annotation required
```

Platform-specific examples are normative only when their owning C64 appendix or evaluation says
so. Core examples do not turn a C64 address or device into universal language meaning.

---

## 8. Document History

| Date | Change |
|------|--------|
| May 2026 | v3 specification created from 23 accepted feature evaluations (F001–F024, F023 retired) |
| September 2026 | Specification 4 reconciled modern language semantics and one exact C64 profile set |

---

## 9. Related Documents

| Document | Purpose |
|----------|---------|
| Feature evaluations (`evaluations/F001–F024`) | The *why* behind each language feature — rationale, alternatives considered, Language Guard evaluation |
| Future considerations (`future-considerations.md`) | Deferred and resolved `FUT-NNN` entries, plus rejected features (REJ-001, REJ-002) |
| Language Guard (`.clinerules/language-guard.md`) | The 23-rule quality gate and evaluation template |
