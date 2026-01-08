# Blend65 Parser Implementation Guide 00: Overview & Setup

> **Your Roadmap to Building a God-Level AST & Parser Foundation**

## Welcome! 👋

You're about to build the foundational machinery for a professional-grade compiler. This series of guides will teach you how to construct:
- A sophisticated Abstract Syntax Tree (AST) system
- A hybrid parser (Recursive Descent + Pratt Expression Parsing)
- Professional error handling and diagnostics
- Debugging and testing utilities

**Time investment:** ~14 hours total (spread across multiple sessions)
**Difficulty:** Intermediate to Advanced
**Prerequisites:** Understanding of TypeScript, basic compiler concepts

---

## 📚 Guide Series Overview

| Guide | Focus | Tasks | Est. Time |
|-------|-------|-------|-----------|
| **Guide 00** | Overview & Setup | 0.1 - 0.3 | 30 min |
| **Guide 01** | AST Base Foundation | 1.1 - 1.8 | 3 hours |
| **Guide 02** | Concrete AST Nodes | 2.1 - 2.20 | 5 hours |
| **Guide 03** | Parser Foundation | 3.1 - 3.12 | 4 hours |
| **Guide 04** | First Working Parser | 4.1 - 4.10 | 2 hours |

**Total:** 50 tasks, ~14 hours

---

## 🎯 What You'll Build

### **Phase 1: AST Foundation (Guides 01-02)**
A complete Abstract Syntax Tree system with:
- Base classes (`ASTNode`, `Expression`, `Statement`, `Declaration`)
- 20+ concrete node types (functions, variables, expressions, statements)
- Visitor pattern for traversal
- Source location tracking
- Diagnostic system for errors/warnings
- Pretty-printer for debugging

### **Phase 2: Parser Foundation (Guide 03)**
A base parser class with:
- Token stream management
- Error recovery (synchronization)
- Module scope tracking (ordering rules)
- Pratt expression infrastructure
- Diagnostic collection

### **Phase 3: Working Parser (Guide 04)**
Your first concrete parser that can parse:
```js
@zp let counter: byte = 5
let name: string = "Blend65"
```

And produce a complete AST you can inspect!

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  SOURCE CODE (Blend65)                          │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  LEXER (Already Built ✅)                       │
│  Converts text → tokens                         │
└─────────────────┬───────────────────────────────┘
                  │ Token[]
                  ▼
┌─────────────────────────────────────────────────┐
│  PARSER (You're Building 🔨)                    │
│  Converts tokens → AST                          │
│  - Recursive Descent (statements/declarations)  │
│  - Pratt Parser (expressions)                   │
└─────────────────┬───────────────────────────────┘
                  │ AST
                  ▼
┌─────────────────────────────────────────────────┐
│  AST (You're Building 🔨)                       │
│  Tree representation of program structure       │
│  - Nodes (Program, Function, Expression, etc.)  │
│  - Visitor pattern (traversal/transformation)   │
│  - Source locations (error reporting)           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
        [Future: Semantic Analyzer]
                  ▼
        [Future: IL Generator]
                  ▼
        [Future: Optimizer]
                  ▼
        [Future: 6502 Code Generator]
```

---

## 📁 File Structure You'll Create

```
packages/compiler/src/
├── lexer/              (Already exists ✅)
│   ├── lexer.ts
│   ├── types.ts
│   └── ...
│
├── ast/                (You'll create 🔨)
│   ├── base.ts         # Base classes, enums, visitor pattern
│   ├── nodes.ts        # All concrete node types
│   ├── diagnostics.ts  # Error/warning system
│   ├── printer.ts      # AST pretty-printer (debugging)
│   ├── utils.ts        # Position helpers, type guards
│   └── index.ts        # Public API exports
│
├── parser/             (You'll create 🔨)
│   ├── base.ts         # Base parser class
│   ├── config.ts       # Parser configuration
│   ├── precedence.ts   # Operator precedence table
│   └── index.ts        # Public API exports
│
└── __tests__/
    └── parser/         (You'll create 🔨)
        ├── ast-base.test.ts
        ├── simple-parser.test.ts
        └── fixtures/
```

---

## 🎓 Key Concepts You'll Learn

### **1. Abstract Syntax Trees (ASTs)**
- How to model programming language constructs as objects
- Immutable structure vs mutable metadata
- Why visitor pattern is essential for compilers

### **2. Recursive Descent Parsing**
- One function per grammar rule
- Top-down parsing strategy
- Error recovery with synchronization points

### **3. Pratt Parser (Precedence Climbing)**
- Elegant solution for operator precedence
- How `2 + 3 * 4` becomes `2 + (3 * 4)`
- Binding power and associativity

### **4. Professional Error Handling**
- Structured diagnostics (not just thrown errors)
- Error codes and severity levels
- IDE-ready error reporting

### **5. Compiler Design Patterns**
- Visitor pattern (traversal/transformation)
- Factory pattern (node creation)
- Builder pattern (complex object construction)

---

## ⚙️ Setup Tasks

### Task 0.1: Verify Lexer Works ⏱️ 5 minutes

**Objective:** Ensure your lexer is functioning correctly before building the parser.

**Steps:**
1. [ ] Navigate to repo root: `/home/gevik/workdir/blend65/native`
2. [ ] Run tests:
   ```bash
   clear && yarn test packages/compiler/src/__tests__/lexer
   ```
3. [ ] Verify all lexer tests pass ✅
4. [ ] If any fail, fix before proceeding

**Expected output:**
```
✓ packages/compiler/src/__tests__/lexer/lexer.test.ts
✓ packages/compiler/src/__tests__/lexer/lexer-additional.test.ts
✓ ... (all lexer tests passing)
```

**Why this matters:** The parser consumes tokens from the lexer. If the lexer is broken, the parser will fail mysteriously.

---

### Task 0.2: Create Directory Structure ⏱️ 5 minutes

**Objective:** Set up the file structure for AST and parser code.

**Steps:**
1. [ ] Create directories:
   ```bash
   mkdir -p packages/compiler/src/ast
   mkdir -p packages/compiler/src/parser
   mkdir -p packages/compiler/src/__tests__/parser/fixtures
   ```

2. [ ] Verify structure:
   ```bash
   ls -la packages/compiler/src/
   ```

**Expected output:**
```
drwxr-xr-x ast/
drwxr-xr-x lexer/
drwxr-xr-x parser/
drwxr-xr-x __tests__/
```

---

### Task 0.3: Understand the Architecture ⏱️ 20 minutes

**Objective:** Familiarize yourself with the design before implementing.

**Steps:**
1. [ ] Read this document completely (you are here!)
2. [ ] Review the file structure diagram above
3. [ ] Understand the parsing pipeline:
   - **Lexer** → Tokens
   - **Parser** → AST
   - **Future stages** → Analysis, optimization, code gen

4. [ ] Understand the two parsing strategies:
   - **Recursive Descent**: For statements, declarations (if, while, function, etc.)
   - **Pratt Parser**: For expressions (2 + 3 * 4, function calls, etc.)

5. [ ] Review your coding standards (`.clinerules/`):
   - No `private` members (use `protected`)
   - Comprehensive JSDoc on all public APIs
   - DRY code (no duplicated logic/constants)
   - Comments explain "why", not just "what"

**Self-check questions:**
- Q: What does the lexer produce?
- A: An array of tokens (`Token[]`)

- Q: What does the parser produce?
- A: An Abstract Syntax Tree (`Program` node, the root)

- Q: Why two parsing strategies?
- A: Recursive descent is natural for statements/declarations. Pratt is elegant for operator precedence in expressions.

- Q: What's the visitor pattern for?
- A: Traversing and transforming the AST (type checking, optimization, code generation, etc.)

---

## 📋 Completion Checklist

Before proceeding to Guide 01, verify:

- [ ] All lexer tests pass (`Task 0.1`)
- [ ] Directory structure created (`Task 0.2`)
- [ ] Architecture understood (`Task 0.3`)
- [ ] Coding standards reviewed (`.clinerules/`)
- [ ] Ready to write code!

---

## 🚀 Next Steps

**Ready to start building?** Proceed to:

➡️ **[Guide 01: AST Base Foundation](./parser-impl-guide-01-ast-base.md)**

In Guide 01, you'll create:
- `ASTNodeType` enum (all node types)
- `ASTNode` base class (foundation)
- `Expression`, `Statement`, `Declaration` abstract classes
- `ASTVisitor<R>` interface (visitor pattern)

**Estimated time:** 3 hours
**Complexity:** Medium (core concepts, heavily documented)

---

## 🆘 Getting Help

If you get stuck:
1. Review the "Common Mistakes" section in each task
2. Check the "Self-Review Questions"
3. Ask your AI coach (me!) for clarification
4. Review the language spec: `docs/language-specification.md`

---

## 💡 Pro Tips

1. **Work in small increments**: Complete one task at a time, don't skip ahead
2. **Test frequently**: Run `yarn build` after each task
3. **Read the comments**: The code includes educational notes
4. **Ask "why"**: Understanding design decisions > memorizing code
5. **Take breaks**: This is a marathon, not a sprint

---

## 🎯 Success Metrics

By the end of all guides, you will have:
- ✅ A complete AST system (20+ node types)
- ✅ A base parser class (reusable foundation)
- ✅ A working parser (can parse simple Blend65 code)
- ✅ Professional error handling (diagnostic system)
- ✅ Debugging tools (AST pretty-printer)
- ✅ Deep understanding of compiler frontend architecture

**Let's build something legendary!** 🔥

---

_Guide created: 2026-01-07_
_Blend65 Compiler Project_
