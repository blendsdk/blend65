# Blend65 v3 — Future Considerations

> **Created**: May 25, 2026  
> **Purpose**: Living document tracking features explicitly deferred from v3 for potential inclusion in future versions.  
> **Rule**: Items are added here when a design decision consciously defers functionality. Each item records what was deferred, why, and under what conditions it should be reconsidered.

---

## How to Use This Document

- When a feature evaluation defers functionality (e.g., "not in v3 — keep it minimal"), add an entry here.
- Each entry has a **source** (the feature evaluation that created it), a **description**, and **reconsideration criteria**.
- Items are NOT promises — they are candidates for future evaluation against the Language Guard.

---

## Deferred Items

### FUT-001: Address-of on struct fields and array elements

> **Source**: F006 (Address-of Operator), Ambiguity AO-4  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: Allow `&myStruct.field` and `&buffer[5]` to return the memory address of a struct field or array element.

**Why deferred**: Keeps the `&` operator minimal in v3 (Language Guard L4). Computing field/element addresses can be done manually with `&variable + offset`, which works in all cases.

**Reconsideration criteria**:
- Real-world Blend65 code frequently needs field/element addresses
- A clean syntax exists that doesn't introduce pointer arithmetic ambiguities
- The codegen cost is predictable and documented

---

### FUT-002: Address-of on function parameters

> **Source**: F006 (Address-of Operator), Ambiguity AO-3  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow `&param` inside a function to get the address of a parameter.

**Why deferred**: In SFA, parameters have static addresses, so this is technically safe. However, it's confusing — the parameter's address is a compiler implementation detail, and exposing it encourages fragile code patterns. Simpler to copy the parameter to a local variable and take `&local`.

**Reconsideration criteria**:
- Compelling use case where copying to a local is insufficient
- Clear semantics that don't confuse beginners

---

### FUT-003: Typed function pointers (interrupt vs. regular)

> **Source**: F007 (Interrupt Functions), Ambiguity INT-2  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: Distinguish between `&regularFunction` and `&interruptFunction` at the type level, so that platform library functions like `setIRQ()` can only accept interrupt function addresses.

**Why deferred**: Requires a function pointer type system (e.g., `type IRQHandler = interrupt () => void;`). This is significant complexity for v3. In v3, `&anyFunction` returns `word` — the developer is responsible for only installing `interrupt` functions as handlers.

**Reconsideration criteria**:
- Users frequently make the mistake of installing non-interrupt functions as handlers
- A minimal type system for function pointers can be designed without excessive complexity
- The feature passes the full Language Guard evaluation

---

### FUT-004: Compile-time call-graph analysis for interrupt reentrancy

> **Source**: F007 (Interrupt Functions), Ambiguity INT-1  
> **Deferred from**: v3  
> **Priority**: High

**What**: The compiler analyzes the call graph and emits a warning/error when a function is reachable from both the main code path AND an interrupt handler. This would detect SFA reentrancy hazards at compile time.

**Why deferred**: Requires the compiler to build and analyze a complete call graph, distinguishing "main path" from "interrupt path." This is a significant compiler feature. In v3, the hazard is documented — the developer must avoid calling shared functions from interrupt handlers.

**Reconsideration criteria**:
- The SFA call graph is already computed for frame allocation (may be low incremental cost)
- Users report reentrancy bugs that are hard to diagnose
- The analysis can be implemented without false positives

---

### FUT-005: Platform library type-safety for interrupt installation

> **Source**: F007 (Interrupt Functions), Ambiguity INT-2  
> **Deferred from**: v3 (depends on FUT-003)  
> **Priority**: Medium

**What**: Platform library functions like `setIRQ(&handler)` enforce at the type level that only `interrupt` functions can be passed. Currently, any `word` is accepted.

**Why deferred**: Depends on typed function pointers (FUT-003). Without a function pointer type, the platform library can only accept `word`, and the type system cannot distinguish interrupt from regular function addresses.

**Reconsideration criteria**:
- FUT-003 (typed function pointers) is implemented
- Platform library design is mature enough to define type-safe APIs

---

### FUT-006: Labeled `break` for nested loops

> **Source**: F008 (For Loop), Ambiguity FOR-16  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow `break label;` to exit multiple nested loops at once, where a label is attached to an outer loop:

```blend65
outer: for (let y: byte = 0 to 25) {
    for (let x: byte = 0 to 40) {
        if (condition) {
            break outer;    // exits both loops
        }
    }
}
```

**Why deferred**: In v3, multi-level exit is handled with a flag variable (`let found = false; ... if (found) { break; }`). This is explicit, works everywhere, and doesn't require new syntax. Labeled `break` is a convenience feature — it saves a few lines but adds grammar complexity (label declarations, label scoping rules).

**Reconsideration criteria**:
- Real-world Blend65 code frequently uses deeply nested loops with multi-level exit
- A clean label syntax is designed that doesn't conflict with other language features
- The codegen cost is minimal (labeled break compiles to a single JMP, same as regular break)

---

### FUT-007: Range cases in switch statements

> **Source**: F009 (Switch Statement), Ambiguity SW-10  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow range expressions in switch case values:

```blend65
switch (score) {
    case 0..9:
        showRankF();
    case 10..49:
        showRankC();
    case 50..89:
        showRankB();
    case 90..100:
        showRankA();
}
```

**Why deferred**: Adds grammar complexity (`..` range operator in case context), requires the compiler to expand ranges into value sets or generate range-check code (CMP + BCS/BCC patterns). The same functionality can be achieved with `if/else if` chains or multiple comma-separated values. Keeping switch minimal in v3 (Language Guard L4).

**Reconsideration criteria**:
- Real-world Blend65 code frequently switches on value ranges (score tiers, ASCII character classes, etc.)
- A clean `..` range syntax is designed that doesn't conflict with other language features
- The codegen can efficiently generate range checks (CMP low / BCC skip / CMP high+1 / BCS skip — 8 bytes per range)
- Interaction with `fallthrough` is clearly defined

---

### FUT-008: Const struct parameters

> **Source**: F011 (Structs), Rule SR-3  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: Allow `function display(e: const Enemy): void` — a `const` qualifier on struct parameters that makes the parameter read-only inside the function, enabling const structs to be passed without copying.

**Why deferred**: Adds a new parameter qualifier keyword and const-checking rules to semantic analysis. In v3, const structs must be copied to a mutable variable before passing to functions. This is explicit and simple (Language Guard L4).

**Reconsideration criteria**:
- Real-world code frequently needs read-only struct access in functions
- A clean `const` parameter qualifier is designed that doesn't conflict with existing `const` declaration syntax
- The semantic analysis can propagate const-ness through field access and nested calls

---

### FUT-009: Address-of on struct fields

> **Source**: F011 (Structs), Ambiguity SR-A5  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: Allow `&player.hp` to return the address of a specific struct field. For module-level structs, the address is compile-time constant. For by-reference parameters, requires runtime address calculation.

**Why deferred**: Overlaps with FUT-001. For by-reference struct parameters, computing `&(param.field)` requires runtime pointer arithmetic. In v3, developers can use `&struct + offset` with `sizeof` for manual calculation.

**Reconsideration criteria**:
- FUT-001 is implemented (address-of on sub-expressions)
- Common enough pattern in real-world code to justify compiler support
- Runtime address calculation cost is documented and acceptable

---

### FUT-010: Struct return values

> **Source**: F011 (Structs), Rule SR-2  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow functions to return struct types: `function createEnemy(): Enemy`. The compiler would copy the struct from the function's frame to the caller's destination.

**Why deferred**: Requires hidden byte copying from callee frame to caller, which has non-transparent cost (violates H2 and A4). The by-reference parameter pattern achieves the same result explicitly.

**Reconsideration criteria**:
- A syntax is designed that makes the copy cost explicit (e.g., `let e: Enemy = createEnemy();` clearly assigns)
- The compiler can optimize out the copy in common cases (return value optimization / RVO)
- Community feedback indicates the by-reference parameter pattern is too verbose

---

### FUT-011: External assembly linking (`extern function`)

> **Source**: F012 (CPU Control Intrinsics), Ambiguity CC-A9  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow declaring functions implemented in external assembly files, enabling Blend65 programs to call hand-written assembly routines:

```blend65
extern function fastClear(addr: word, count: byte): void;
extern function rasterEffect(): void;
```

The assembly is written in a real assembler (KickAssembler, ca65, DASM) and linked with the Blend65 compiler output.

**Why deferred**: Requires a linker, a defined binary/object format, a calling convention specification, and external tool dependency. The curated `asm_*()` intrinsics + language features + memory intrinsics cover all game development needs without external assembly. The only use cases that genuinely require hand-written assembly are demo-scene effects (FLD, VSP, AGSP, FLI) — cycle-counted techniques not used in commercial games.

**Reconsideration criteria**:
- Real-world Blend65 users need cycle-counted assembly sequences (demo scene, advanced raster effects)
- A simple object format and calling convention can be defined
- A linker can be implemented without excessive complexity
- The feature passes the full Language Guard evaluation

---

## Summary Table

| ID | Description | Priority | Depends On |
|----|-------------|----------|------------|
| FUT-001 | `&` on struct fields / array elements | Medium | — |
| FUT-002 | `&` on function parameters | Low | — |
| FUT-003 | Typed function pointers | Medium | — |
| FUT-004 | Call-graph reentrancy analysis | High | — |
| FUT-005 | Type-safe interrupt installation | Medium | FUT-003 |
| FUT-006 | Labeled `break` for nested loops | Low | — |
| FUT-007 | Range cases in switch statements | Low | — |
| FUT-008 | Const struct parameters | Medium | F011 |
| FUT-009 | Address-of on struct fields | Medium | FUT-001, F011 |
| FUT-010 | Struct return values | Low | F011 |
| FUT-011 | External assembly linking (`extern function`) | Low | F012 |
