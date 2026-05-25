# Blend65 Language Guard

> **Version**: 1.0  
> **Date**: May 25, 2026  
> **Purpose**: Quality gate for every language feature in the Blend65 v3 specification.  
> **Rule**: No feature enters the specification without passing this guard.

---

## How to Use This Document

1. **Before adding any feature** to the v3 spec, create a Feature Evaluation (see template below)
2. **Check the feature against all 23 rules** across 5 categories
3. **Mark each rule** as ✅ Pass, ⚠️ Conditional (explain), or ❌ Fail
4. **If a rule fails**, apply an Escape Hatch (Tier 1-5) or reject the feature
5. **Record the verdict** and the reasoning — this creates a permanent decision log

---

## Target Platforms

All rules apply against these platforms unless an Escape Hatch is invoked:

| Platform | CPU | RAM | Notes |
|----------|-----|-----|-------|
| Commodore 64 | 6502 @ 1MHz | 64KB | Primary target, largest community |
| C64 Ultimate | 6502 + extensions | 64KB+ | C64 variant with hardware extensions (REU, etc.) |
| Commander X16 | 65C02 @ 8MHz | 512KB+ banked | Modern 6502 design, generous resources |
| Atari 800XL | 6502 @ 1.79MHz | 64KB | Different I/O architecture (ANTIC/GTIA/POKEY) |
| Atari 7800 | 6502C @ 1.19MHz | 4KB (+cart RAM) | Tightest constraints, DMA display (MARIA) |

---

## Category 1: Platform Universality (P)

> *"Does this feature work everywhere Blend65 targets?"*

### P1 — Cross-Platform Compilable

The feature must be compilable to working machine code on **all** target platforms. The compiler must be able to generate correct code for this feature regardless of which `--platform` flag is set.

**What this means in practice:**
- The feature cannot depend on hardware that only one platform has
- The feature cannot require memory layouts specific to one platform
- If the feature uses different codegen strategies per platform, each strategy must be defined

**What this does NOT mean:**
- It does NOT mean the feature must be equally *efficient* on all platforms
- It does NOT mean the feature must be equally *practical* on all platforms (see P2)
- Resource limits (e.g., 4KB on 7800) are a P4 concern, not a P1 failure

### P2 — Platform-Meaningful

The feature must be practically useful on all target platforms. It is not enough to be technically compilable — the feature must solve real problems developers face on each platform.

**Test:** Can you write a meaningful code example using this feature for each target platform? If the answer is "technically yes, but nobody would ever do this on platform X," the feature fails P2 for that platform.

### P3 — No Platform Assumptions in Core

The feature's core language definition must not reference any specific hardware, memory address, register, character encoding, or platform name. All platform-specific details belong exclusively in platform profiles and platform libraries.

**Red flags that violate P3:**
- Any hex address in a core spec document (e.g., `$D020`, `$0400`)
- Any hardware chip name (VIC-II, SID, ANTIC, MARIA, POKEY, TIA)
- Any character encoding name (PETSCII, ATASCII)
- Any platform name in a core language rule

### P4 — Resource-Scalable

The feature must degrade gracefully across platforms with different resource levels. The compiler must **warn** when resource limits are approached, not silently generate broken code.

**Resource dimensions to consider:**
- RAM: 4KB (7800) → 64KB (C64, 800XL) → 512KB+ (CX16)
- Zero page: varies by platform and KERNAL usage
- ROM/binary size: cartridge limits on 7800, disk-based on C64
- CPU speed: 1MHz (C64) → 1.19MHz (7800) → 1.79MHz (800XL) → 8MHz (CX16)

**The rule:** The language supports the feature everywhere. The platform profile defines the practical limits. The compiler enforces those limits with clear diagnostics.

---

## Category 2: Hardware / 6502 Feasibility (H)

> *"Can this actually compile to efficient 6502 code?"*

### H1 — 6502 Implementable

The feature must be compilable to standard 6502 machine code without requiring hardware capabilities the CPU does not have.

**The 6502 does NOT have:**
- Hardware multiply or divide
- Floating point
- A stack larger than 256 bytes
- More than 3 registers (A, X, Y) — all 8-bit
- 16-bit arithmetic (must be synthesized from 8-bit ops)
- Virtual memory or memory protection
- Hardware-assisted function call frames

**The 6502 DOES have:**
- Fast zero-page addressing (256 bytes of fast memory)
- Efficient indexed addressing (arrays, tables)
- Carry flag for multi-byte arithmetic
- Decimal mode (BCD)
- IRQ and NMI interrupts
- 151 CPU cycles per PAL scanline, 113 per NTSC scanline

### H2 — Cost Transparency

The cycle count and byte count of the generated code for this feature must be predictable and documentable. Developers must be able to reason about performance.

**Requirements:**
- The spec should document the typical code pattern generated for the feature
- If the feature triggers a runtime support routine (e.g., software multiply), that cost must be stated
- No hidden expensive operations — if it looks cheap in source but is expensive in code, document it

### H3 — SFA Compatible

The feature must work within the Static Frame Allocation model:
- All memory allocation is determined at compile time
- No dynamic allocation (no malloc, no heap)
- No recursion (each function has exactly one frame instance)
- The call graph is statically known
- Frame memory can be reused for functions with non-overlapping lifetimes

### H4 — Memory Footprint Documented

The RAM, ROM/binary, and zero-page cost of the feature must be quantifiable:
- **RAM cost**: How many bytes of RAM does this feature consume at runtime?
- **ROM cost**: How many bytes of generated code does this feature produce? Include runtime support routines (e.g., multiply subroutine = ~40-80 bytes of ROM).
- **ZP cost**: Does this feature require zero-page bytes? How many?

The compiler must be able to report total resource usage in a build summary.

### H5 — Fully Deterministic

The feature must have defined behavior in **all** cases. There is no "undefined behavior" in Blend65.

**Why this is non-negotiable on 6502:**
- There is no operating system to catch errors
- There is no exception handling
- There is no memory protection
- Undefined behavior = hard crash, infinite loop, or silent memory corruption with **zero diagnostic information**

**Every input to the feature must produce either:**
1. A well-defined result (documented), OR
2. A compile-time error (with a specific error code and message)

**Examples of what must be defined:**
- Integer overflow → wrapping (natural 6502 behavior)
- Array out-of-bounds → compile-time error if detectable; if not, defined behavior (wrapping index or bounds check)
- Division by zero → compile-time error if constant; runtime behavior must be defined

---

## Category 3: Language Design Quality (L)

> *"Is this a well-designed language feature?"*

### L1 — Unambiguous Syntax

The feature's syntax must be formally definable in the EBNF grammar with **zero** parsing ambiguities. One syntax, one parse tree, one meaning.

**Requirements:**
- The feature must be added to the master EBNF grammar document
- The grammar must remain LL(k) or LR(1) parseable — no context-sensitive hacks
- No tokenization ambiguities (the v2 `@` problem: storage class vs address-of vs type alias)

### L2 — Consistent with Existing Features

The syntax and semantics must follow patterns established by existing features. No special cases.

**Consistency checks:**
- Does it use the same punctuation conventions? (braces for blocks, semicolons for terminators, etc.)
- Does it follow the same type annotation style? (`name: type`)
- Does it compose the same way as similar features?
- Would a developer guess the syntax correctly based on knowing similar features?

### L3 — Beginner-Friendly

A developer familiar with C, TypeScript, or JavaScript should be able to read and understand code using this feature **without consulting the specification**.

**Test:** Show a code example using this feature to a C/TypeScript developer. Can they tell you what it does?

### L4 — Minimal Feature

The feature must be the **simplest version** that solves the problem. No Swiss-army-knife features.

**Principles:**
- Prefer a simple feature that covers 80% of use cases over a complex one that covers 100%
- Features can be extended in future versions — start small
- If a feature needs a paragraph of caveats, it's too complex

### L5 — No Redundancy

The feature must not duplicate functionality already provided by another feature. If two features overlap, one must be removed or the overlap must be formally resolved (one is syntactic sugar for the other).

### L6 — Error Messages Defined

Every way the feature can be **misused** must produce a specific, documented error:
- **Error code**: Unique identifier (e.g., `E0042`)
- **Error message**: Clear, actionable human-readable message
- **Example**: A code snippet that triggers this error
- **Fix**: How to correct the code

**Minimum error classes for each feature:**
- Syntax errors (malformed usage)
- Type errors (wrong types)
- Scope errors (used in wrong context)
- Resource errors (exceeds platform limits)

### L7 — Compile-Time Failure Preferred

Errors caused by feature misuse should be caught at **compile time** wherever possible. Runtime failures on 6502 are catastrophic and undiagnosable.

**Priority order:**
1. Catch at compile time → emit error → refuse to compile (BEST)
2. Catch at compile time → emit warning → generate defensive code (ACCEPTABLE)
3. Fail at runtime with defined behavior (LAST RESORT — document thoroughly)

### L8 — Feature Interaction Documented

How this feature interacts with **every other language feature** must be explicitly defined.

**For each existing feature, answer:**
- Can they be combined? (e.g., struct inside array? For-loop inside switch? Asm block inside function?)
- If yes, what is the semantics?
- If no, is this enforced at compile time with a clear error?
- Are there any surprising interactions?

**This rule exists because:** The v2 spec had many features defined in isolation, but their interactions were undefined, leading to contradictions.

### L9 — Documentable with Examples

The feature must be explainable with:
1. A **short prose description** (1-2 paragraphs max)
2. A **basic usage example** (the common case)
3. A **pattern example** (a real-world use case, e.g., game loop, sprite handling)
4. An **edge case example** (boundary conditions, limits)

If you cannot write clear, concise examples for the feature, the feature is too complex.

---

## Category 4: Compiler Implementability (C)

> *"Can we actually build this?"*

### C1 — Lexer/Parser Implementable

The feature must be:
- **Tokenizable**: The lexer can produce tokens for this feature using standard lexer techniques (regular expressions / DFA)
- **Parseable**: The parser can construct an AST for this feature using standard parsing techniques (recursive descent, Pratt parsing for expressions)
- **No context-sensitivity**: The lexer/parser should not need to consult a symbol table or semantic information to tokenize/parse this feature

### C2 — Semantic Analysis Defined

All semantic rules for the feature must be **fully specified** before implementation:
- **Type checking rules**: What types are valid? What type does the expression produce?
- **Scope rules**: Where is this feature valid? What does it introduce into scope?
- **Validation rules**: What constraints must be checked? (e.g., array sizes must be compile-time constants)
- **SFA implications**: How does this feature affect frame allocation?

No "figure it out during implementation" is allowed.

### C3 — Code Generation Strategy Exists

There must be a **known, documented approach** to generating 6502 machine code for this feature:
- What 6502 instructions are used?
- What is the typical code pattern?
- Are runtime support routines needed? If so, what are they?
- Does the codegen vary per platform? If so, how?

This does NOT need to be optimized code — it needs to be **correct** code with a documented strategy.

### C4 — Unit Testable

The feature must have clear, enumerable test cases at **every compiler stage**:

| Stage | Test Type | Example |
|-------|-----------|---------|
| Lexer | Token output | `"for" → KW_FOR, "(" → LPAREN, ...` |
| Parser | AST shape | `for-stmt node with init, condition, update, body` |
| Semantic | Type/scope validation | `type mismatch: expected byte, got word → E0015` |
| Codegen | Assembly output | `for-loop → LDX #$00 / CMP / BNE / INX pattern` |

**Edge cases must be enumerable**: What are the boundary conditions? What inputs trigger each error path?

### C5 — Runtime Verifiable

The generated code for this feature must be testable in an emulator with **deterministic expected results** across all target platforms:

- Write a `.blend` program using the feature
- Compile for each target platform
- Run in the platform's emulator (VICE, x16emu, Altirra, Stella/7800)
- Verify that memory locations / register values / output match expected results

This ensures the feature doesn't just compile — it **runs correctly**.

---

## Category 5: Future-Proofing (F)

> *"Will we regret this in 2 years?"*

### F1 — Extensible

The feature must not block future language evolution. Adding capabilities later should not require breaking changes to existing code.

**Questions to ask:**
- If we want to extend this feature later, can we do so without changing the syntax of existing valid programs?
- Does this feature reserve syntax space that might be needed for other features?
- Does this feature's semantics leave room for future refinement?

### F2 — Platform-Profile Ready

If the feature has **any** behavior that varies by platform, that variation must be expressible through the platform profile system — not hardcoded in the compiler.

**Examples:**
- Available zero-page range → defined in platform profile
- Maximum array size → constrained by platform profile's RAM definition
- Character encoding for strings → platform profile setting
- Output binary format → platform profile setting

### F3 — Optimizer-Friendly

The feature must not make future optimization passes impossible or unreasonably difficult.

**Considerations:**
- Can a peephole optimizer improve the generated code for this feature?
- Does the feature's IL representation allow standard optimization passes (constant folding, dead code elimination, strength reduction)?
- Does the feature introduce patterns that are inherently hard to optimize? (e.g., indirect jumps, computed goto)

### F4 — Stability Classification

Each feature must be classified at the time it enters the spec:

| Classification | Meaning | Contract |
|----------------|---------|----------|
| **Stable** | Fully designed, will not change | Breaking changes require a major version bump |
| **Provisional** | Designed but may be refined | Minor syntax/semantic adjustments possible in next version |
| **Experimental** | Exploratory, may be removed | No stability guarantee; may disappear entirely |

This sets clear expectations for anyone writing Blend65 code. Experimental features should emit a compiler warning when used.

---

## Escape Hatches

When a feature **cannot** pass all 23 rules, apply the appropriate escape hatch:

### Tier 1: Platform Subset (Compiler Warning)

**When:** Feature works on most platforms but is constrained on one or more (e.g., large arrays on 7800's 4KB RAM).

**Resolution:**
- Feature is included in the core language
- The compiler emits a **warning** when targeting constrained platforms
- The platform profile defines the specific limits
- Code still compiles — the developer is informed, not blocked

**Example:** `warning[W0103]: array of 256 bytes exceeds recommended frame size for platform 'a7800' (max: 128 bytes)`

### Tier 2: Platform Library (Not Core Language)

**When:** Feature is inherently platform-specific (e.g., VIC-II sprites, MARIA display lists, SID music).

**Resolution:**
- NOT a core language feature — it's a **platform library**
- Accessed via `import { ... } from c64.vic` / `import { ... } from a7800.maria`
- The core language provides the building blocks (peek, poke, structs, arrays) that platform libraries use
- Platform libraries are documented in platform profile appendixes, not in the core spec

### Tier 3: Conditional Compilation

**When:** Feature behavior genuinely differs per platform in ways a library can't abstract.

**Resolution:**
- Minimal `#if platform` / `#elif` / `#endif` preprocessor directive
- Use **sparingly** — heavy use of conditional compilation indicates a design problem
- If more than 10% of a codebase needs conditional compilation, the abstraction layer needs improvement

### Tier 4: Feature Flag (Opt-In)

**When:** Feature is powerful but too expensive or complex for constrained platforms.

**Resolution:**
- Feature is available but **opt-in** via compiler flag (e.g., `--enable-multiply-operator`)
- Disabled by default on constrained platforms, enabled by default on capable ones
- The platform profile sets the default for each flag
- When disabled, using the feature produces a clear compile-time error explaining why and how to opt in

### Tier 5: Reject / Defer

**When:** Feature fundamentally cannot work on a target platform and no workaround exists.

**Resolution:**
- Feature is **removed** from the v3 spec or **deferred** to a future version
- A **rejection document** is written explaining:
  - What the feature was
  - Why it was rejected
  - What alternatives exist
  - Under what conditions it might be reconsidered

---

## Feature Evaluation Template

Every language feature must be evaluated using this template before being included in the v3 specification. Completed evaluations are stored in `language-specification-v3/evaluations/`.

```markdown
# Feature Evaluation: [Feature Name]

> **Date**: [Date]  
> **Status**: ✅ ACCEPTED / ⚠️ ACCEPTED WITH CONDITIONS / ❌ REJECTED  
> **Stability**: stable / provisional / experimental

## Description

[One paragraph describing the feature and what problem it solves]

## Syntax

```blend65
[Code example showing the feature's syntax]
```

## Alternatives Considered

| Alternative | Why Rejected |
|------------|--------------|
| [Alternative 1] | [Reason] |
| [Alternative 2] | [Reason] |

## Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅/⚠️/❌ | |
| P2 Platform-meaningful | ✅/⚠️/❌ | |
| P3 No platform assumptions | ✅/⚠️/❌ | |
| P4 Resource-scalable | ✅/⚠️/❌ | |

## Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅/⚠️/❌ | |
| H2 Cost transparency | ✅/⚠️/❌ | |
| H3 SFA compatible | ✅/⚠️/❌ | |
| H4 Memory footprint documented | ✅/⚠️/❌ | |
| H5 Fully deterministic | ✅/⚠️/❌ | |

## Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅/⚠️/❌ | |
| L2 Consistent with existing | ✅/⚠️/❌ | |
| L3 Beginner-friendly | ✅/⚠️/❌ | |
| L4 Minimal feature | ✅/⚠️/❌ | |
| L5 No redundancy | ✅/⚠️/❌ | |
| L6 Error messages defined | ✅/⚠️/❌ | |
| L7 Compile-time failure preferred | ✅/⚠️/❌ | |
| L8 Feature interaction documented | ✅/⚠️/❌ | |
| L9 Documentable with examples | ✅/⚠️/❌ | |

## Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅/⚠️/❌ | |
| C2 Semantic analysis defined | ✅/⚠️/❌ | |
| C3 Code generation strategy | ✅/⚠️/❌ | |
| C4 Unit testable | ✅/⚠️/❌ | |
| C5 Runtime verifiable | ✅/⚠️/❌ | |

## Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅/⚠️/❌ | |
| F2 Platform-profile ready | ✅/⚠️/❌ | |
| F3 Optimizer-friendly | ✅/⚠️/❌ | |
| F4 Stability classification | ✅/⚠️/❌ | |

## Escape Hatches Applied

[None, or list which tier(s) were applied and why]

## Verdict

**[✅ ACCEPTED / ⚠️ ACCEPTED WITH CONDITIONS / ❌ REJECTED]**

[Summary of reasoning — 2-3 sentences]
```

---

## Rule Summary (Quick Reference)

| Category | # | Rule | One-Line Summary |
|----------|---|------|------------------|
| Platform | P1 | Cross-platform compilable | Must compile on all target platforms |
| Platform | P2 | Platform-meaningful | Must be useful, not just possible |
| Platform | P3 | No platform assumptions | Core spec never mentions specific hardware |
| Platform | P4 | Resource-scalable | Warn on constraint, don't break |
| Hardware | H1 | 6502 implementable | Must compile without absent hardware |
| Hardware | H2 | Cost transparency | Cycle/byte cost must be predictable |
| Hardware | H3 | SFA compatible | Must work with static frame allocation |
| Hardware | H4 | Memory footprint documented | RAM, ROM, ZP cost quantifiable |
| Hardware | H5 | Fully deterministic | No undefined behavior — ever |
| Language | L1 | Unambiguous syntax | One syntax, one parse tree, one meaning |
| Language | L2 | Consistent with existing | Follows established patterns |
| Language | L3 | Beginner-friendly | Readable by C/TS developers |
| Language | L4 | Minimal feature | Simplest version that works |
| Language | L5 | No redundancy | No duplicate functionality |
| Language | L6 | Error messages defined | Every misuse has a specific error |
| Language | L7 | Compile-time failure preferred | Catch errors before runtime |
| Language | L8 | Feature interaction documented | All combinations explicitly defined |
| Language | L9 | Documentable with examples | Prose + 3 code examples minimum |
| Compiler | C1 | Lexer/parser implementable | Standard tokenization and parsing |
| Compiler | C2 | Semantic analysis defined | Types, scope, validation fully spec'd |
| Compiler | C3 | Code generation strategy | Known 6502 codegen approach exists |
| Compiler | C4 | Unit testable | Test cases at every compiler stage |
| Compiler | C5 | Runtime verifiable | Emulator-testable on all platforms |
| Future | F1 | Extensible | No breaking changes to extend later |
| Future | F2 | Platform-profile ready | Variations via profile, not hardcoded |
| Future | F3 | Optimizer-friendly | Doesn't block future optimization |
| Future | F4 | Stability classification | Labeled stable/provisional/experimental |
