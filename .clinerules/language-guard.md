# Blend65 Language Guard

> **Version**: 2.0
> **Date**: September 13, 2026
> **Purpose**: Quality gate for every changed language feature in Blend65 Specification 4.
> **Rule**: No feature enters the specification without passing this guard.

---

## How to Use This Document

1. **Before adding any feature** to Specification 4, create a Feature Evaluation (see template below)
2. **Check the feature against all 27 named rules** across 5 categories
3. **Mark each rule** as ✅ Pass, ⚠️ Conditional (explain), or ❌ Fail
4. **If a rule fails**, apply one authorized resolution or reject the feature
5. **Record the verdict** and the reasoning — this creates a permanent decision log

---

## Qualified Target Scope

The guard applies to every qualified active profile in
[`spec/15-platform-profile.md`](../spec/15-platform-profile.md). Specification 4 has one qualified
target family: the Commodore 64. It contains eight PRG profiles covering PAL/NTSC, KERNAL/takeover,
and 6581/8580 combinations, plus the bounded `c64-pal-d64-kernal-6581` disk profile.

Future-target constraints in `spec/future-considerations.md` receive a separate portability review.
They are non-normative, are not selectable target IDs, and do not create a support claim.

---

## Category 1: Platform Universality (P)

> *"Does this feature work everywhere Blend65 targets?"*

### P1 — Cross-Profile Compilable

The feature must compile to working machine code for every qualified active profile. Selecting a
profile must not change core-language meaning.

**What this means in practice:**
- A core feature cannot depend on hardware available in only one profile
- A core feature cannot require a profile-specific memory layout
- If lowering varies by profile, every qualified variation must be defined

**What this does NOT mean:**
- It does NOT mean the feature must be equally *efficient* in every profile
- It does NOT mean target-platform library operations belong in the core language
- Resource limits are a P4 concern, not a P1 failure

### P2 — Profile-Meaningful

The feature must be practically useful across the qualified active profiles. It is not enough to be
technically compilable.

**Test:** Can you write a meaningful C64 example using the feature without relying on one accidental
profile configuration? If not, the feature fails P2.

### P3 — No Platform Assumptions in Core

The feature's core language definition must not make any target-specific hardware, address,
register, character encoding, or platform identity part of universal semantics. Such details belong
only in platform profiles and platform libraries.

**Red flags that violate P3:**
- A target address or register made part of a universal core rule
- A hardware chip made part of core semantics instead of a target-library contract
- A character encoding selected by the core language instead of the profile
- A platform example presented as the only legal source form

### P4 — Resource-Scalable

The feature must remain correct across qualified profiles with different reserved ranges, firmware
ownership, artifact forms, and timing. The compiler must diagnose an unsatisfied hard limit and may
warn when a documented soft threshold is approached; it must never silently generate broken code.

**Resource dimensions to consider:**
- RAM and zero page available after profile reservations
- KERNAL or takeover ownership of memory, vectors, and I/O
- PRG or D64 packaging limits
- PAL/NTSC timing and 6581/8580 compatibility requirements

**The rule:** Core language meaning is stable. The selected profile defines practical limits and
target-library availability. The compiler enforces both with clear diagnostics.

---

## Category 2: Hardware / 6502 Feasibility (H)

> *"Can this actually compile to efficient 6502 code?"*

### H1 — 6502 Implementable

The feature must compile to legal NMOS 6510/6502 machine code for every qualified Specification 4
profile without requiring capabilities the CPU does not have.

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
- 63 CPU cycles per PAL scanline and 65 per NTSC scanline on the qualified C64 models

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
- The call graph is statically bounded, including every finite function-value target set
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

Every material interaction with existing language features must be explicitly defined. Do not
create a pairwise checklist for combinations that cannot affect syntax, types, effects, storage,
control flow, or cost.

**For each material interaction, answer:**
- Can they be combined? (e.g., struct inside array? For-loop inside switch? Asm block inside function?)
- If yes, what is the semantics?
- If no, is this enforced at compile time with a clear error?
- Are there any surprising interactions?

**This rule exists because:** The v2 spec had many features defined in isolation, but their interactions were undefined, leading to contradictions.

### L9 — Documentable with Examples

The feature must be explainable with:
1. A **short prose description**
2. A **representative positive example**
3. A **boundary or invalid example** where one exists

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
- Does the codegen vary per qualified profile? If so, how?

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

The generated code for this feature must be testable in VICE 3.10 with **deterministic expected
results** across every qualified profile:

- Write a `.blend` program using the feature
- Compile for each qualified profile
- Run the bounded program in VICE 3.10; add targeted real-hardware QA where silicon-sensitive
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

## Authorized Resolutions

When a proposed feature cannot pass all 27 rules, use the smallest applicable resolution below.
These resolutions classify or constrain a feature; they do not silently waive a failed rule.

### Tier 1: Profile Constraint

**When:** A core feature is valid across the qualified profiles but one profile has a smaller
documented resource limit.

**Resolution:**
- The feature remains in the core language
- The platform profile defines the exact limit
- An unsatisfied hard limit is a compile-time error
- A warning is used only for a documented soft threshold

### Tier 2: Platform Library (Not Core Language)

**When:** The operation is inherently target-specific, such as VIC-II display control or SID audio.

**Resolution:**
- NOT a core language feature — it's a **platform library**
- Accessed through the typed C64 platform library
- The core language provides the building blocks (peek, poke, structs, arrays) that platform libraries use
- Platform libraries are documented in the C64 appendix, not as universal core semantics

### Tier 3: Reject or Defer

**When:** A proposal cannot meet the language, hardware, or qualified-profile contract.

**Resolution:**
- The feature is absent from Specification 4 or deferred to a future version
- A **rejection document** is written explaining:
  - What the feature was
  - Why it was rejected
  - What alternatives exist
  - Under what conditions it might be reconsidered

---

## Feature Evaluation Template

Every language feature must be evaluated using this template before being included in Specification
4. Completed evaluations are stored in `spec/evaluations/`.

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

## Authorized Resolutions Applied

[None, or list which tier(s) were applied and why]

## Verdict

**[✅ ACCEPTED / ⚠️ ACCEPTED WITH CONDITIONS / ❌ REJECTED]**

[Summary of reasoning — 2-3 sentences]
```

---

## Specification 4 Transition Evaluation

This is the complete Guard result for the feature groups changed while creating Specification 4.
Every code in **Passed rules** is ✅ Pass. Every code in **Conditional rules** is ⚠️ Conditional
with its authorized resolution stated below. No rule failed.

| Group | Changed feature group | Passed rules | Conditional rules |
|-------|-----------------------|--------------|-------------------|
| G1 | Three-clause loops, effect/exit ordering, lexical shadowing, declaration identity | P1–P4, H1–H5, L1–L9, C1–C5, F1–F4 | None |
| G2 | Fixed-width arithmetic, direct-subscript promotion, fixed arrays | P1–P4, H1–H5, L1–L9, C1–C5, F1–F4 | None |
| G3 | Aggregate assignment/return, caller-owned destinations, addressable places | P1–P4, H1–H5, L1–L9, C1–C5, F1–F4 | None |
| G4 | Typed finite function values, indirect calls, interrupt installation ownership | P1–P4, H1–H5, L1–L9, C1–C5, F1–F4 | None |
| G5 | Typed compile-time functions and bounded trigonometric evaluation | P1–P4, H1–H5, L1–L9, C1–C5, F1–F4 | None |
| G6 | `place(...)`, `loadable const`, captured-range publication and invalidation | P1–P4, H1–H5, L1–L9, C1–C5, F1–F4 | None |
| G7 | Five `asm_*` controls, variable-address PEEK/POKE, checked/unchecked arithmetic safety | P1–P4, H1–H5, L1–L9, C1–C5, F1–F4 | None |
| G8 | Nine qualified C64 profiles and the typed target-library boundary | P3–P4, H1–H5, L1–L9, C1–C5, F1–F4 | P1, P2 — Tier 2: target-specific operations stay outside the core language and are available only through a selected qualified profile |
| G9 | Raw/SPD/CTM/PSID/Koala assets and bounded D64 loading | P3–P4, H1–H5, L1–L9, C1–C5, F1–F4 | P1, P2 — Tier 2: formats and loading are selected-profile services, not universal core semantics |

The portability review also passes. G1–G7 keep target-specific hardware out of core semantics. G8
and G9 deliberately isolate C64 facts behind profile and platform-library boundaries. A future
target must qualify its own CPU, memory, artifact, library, asset, emulator, and hardware evidence;
these C64 contracts do not become its defaults.

---

## Rule Summary (Quick Reference)

| Category | # | Rule | One-Line Summary |
|----------|---|------|------------------|
| Platform | P1 | Cross-profile compilable | Must compile for every qualified profile |
| Platform | P2 | Profile-meaningful | Must be useful across qualified profiles |
| Platform | P3 | No platform assumptions | Core spec never mentions specific hardware |
| Platform | P4 | Resource-scalable | Diagnose hard limits; warn only at documented soft thresholds |
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
| Language | L8 | Feature interaction documented | Every material interaction is defined |
| Language | L9 | Documentable with examples | Short prose plus positive and boundary/invalid examples |
| Compiler | C1 | Lexer/parser implementable | Standard tokenization and parsing |
| Compiler | C2 | Semantic analysis defined | Types, scope, validation fully spec'd |
| Compiler | C3 | Code generation strategy | Known 6502 codegen approach exists |
| Compiler | C4 | Unit testable | Test cases at every compiler stage |
| Compiler | C5 | Runtime verifiable | VICE-testable across qualified profiles |
| Future | F1 | Extensible | No breaking changes to extend later |
| Future | F2 | Platform-profile ready | Variations via profile, not hardcoded |
| Future | F3 | Optimizer-friendly | Doesn't block future optimization |
| Future | F4 | Stability classification | Labeled stable/provisional/experimental |
