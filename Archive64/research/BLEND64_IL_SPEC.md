# Blend64 v0.1 — Intermediate Representation (IL) Specification

Status: Mandatory
Audience: Compiler implementers
Target: MOS 6502 / 6510 (Commodore 64)
Compiler implementation language: TypeScript

---

## 1. Purpose

This document defines the **single mandatory Intermediate Representation (IL)** used by Blend64.

The IL is the **only representation** allowed between the **magic phase** and **6502 code emission**.

Its goals are:
- deterministic code generation
- explicit memory access
- explicit control flow
- explicit cycle and size costs
- provable reachability and dead-code elimination
- maximum achievable FPS on real C64 hardware

The IL is **not portable**, **not executable**, and **not a runtime**.

---

## 2. Non-Negotiable Constraints

The IL MUST:
- be target-specific (6502/6510)
- be ahead-of-time only
- be fully static
- be deterministic
- expose addressing modes explicitly
- preserve exact machine-level semantics

The IL MUST NOT:
- resemble LLVM IR or SSA
- abstract registers
- imply stack frames
- imply heap allocation
- introduce runtime services
- enable dynamic dispatch

---

## 3. Compiler Pipeline Position

Source → AST → Type Check → Magic Phase → **Blend64 IL** → Optimization → 6502 Emission → PRG

---

## 4. TypeScript Core Model

```ts
interface ILProgram {
  entryFunction: string
  functions: ILFunction[]
  dataSymbols: ILDataSymbol[]
}

interface ILDataSymbol {
  name: string
  storage: "zp" | "ram" | "data" | "const" | "io"
  size: number
  address?: number
}

interface ILFunction {
  name: string
  blocks: ILBlock[]
  attributes?: {
    hot?: boolean
    irq?: boolean
    inline?: boolean
    noinline?: boolean
  }
}

interface ILBlock {
  label: string
  instructions: ILInstruction[]
  terminator: ILTerminator
}

interface ILMeta {
  cyclesMin: number
  cyclesMax: number
  bytes: number
  zpReads: number
  zpWrites: number
  absReads: number
  absWrites: number
  clobbers: ("A" | "X" | "Y" | "P")[]
}
```

---

## 5. Addressing Modes

IMM, ZP, ABS, ABS_X, ABS_Y, IND, IND_X, IND_Y

Addressing mode selection is final at IL level.

---

## 6. Instruction Set (Summary)

- IL_LOAD
- IL_STORE
- IL_ADD8 / IL_ADD16
- IL_SUB8
- IL_AND / IL_OR / IL_XOR
- IL_SHL / IL_SHR
- IL_CMP8 / IL_CMP16
- IL_BRANCH
- IL_JMP
- IL_CALL
- IL_RETURN

Each instruction includes mandatory static metadata.

---

## 7. Reachability & Optimization

- Dead-code elimination operates only on IL
- Zero-page allocation is IL-driven
- Inlining is IL-level only
- Deterministic ordering is mandatory

---

## 8. Final Principle

If a behavior is not explicitly represented in the IL, it is not allowed in Blend64.

---

End of specification
