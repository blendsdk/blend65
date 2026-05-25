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
