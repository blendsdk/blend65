# Research Requirements: SFA for 6502

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Research Scope

### In Scope

1. **Stack Frame Allocation Strategies**
   - Static frame allocation (no recursion)
   - Software stack for recursion support
   - Hybrid approaches

2. **Memory Regions**
   - Zero page allocation and management
   - RAM allocation for frames
   - Hardware stack usage patterns

3. **Variable Allocation**
   - Local variable placement
   - Parameter passing mechanisms
   - Return value handling
   - Temporary storage

4. **Optimization Techniques**
   - Frame reuse via call graph analysis
   - Memory coalescing
   - Register allocation (A, X, Y)
   - Zero page optimization

5. **Edge Cases**
   - Nested function calls
   - Large local variables
   - Arrays in local scope
   - Pointers to locals

### Out of Scope

1. Global variable allocation (separate concern)
2. Interrupt handling frames (future research)
3. Multi-threading/coroutines
4. Cross-module optimization

## Research Questions

### Q1: Stack Model

**Question**: How does each compiler handle the 6502's limited 256-byte hardware stack?

**Areas to investigate**:
- Do they use the hardware stack for locals?
- Do they implement a software stack?
- How do they avoid stack overflow?

### Q2: Zero Page Strategy

**Question**: How is zero page ($00-$FF) utilized for variables?

**Areas to investigate**:
- Which bytes are reserved for compiler use?
- How are ZP locations assigned to variables?
- Is usage analysis performed to prioritize hot variables?

### Q3: Parameter Passing

**Question**: How are function parameters passed?

**Areas to investigate**:
- Register-based (A, X, Y)?
- Zero page locations?
- Software stack?
- Hybrid approach?

### Q4: Return Values

**Question**: How are return values handled?

**Areas to investigate**:
- Register return (A for byte, A/X for word)?
- Memory location return?
- Multiple return value support?

### Q5: Recursion

**Question**: How is recursion handled (or prevented)?

**Areas to investigate**:
- Is recursion detected at compile time?
- Is there a software stack for recursive calls?
- What error messages are produced?

### Q6: Frame Reuse

**Question**: Do compilers reuse frame memory for non-overlapping call paths?

**Areas to investigate**:
- Is call graph analysis performed?
- How are non-overlapping functions identified?
- How much memory is saved by reuse?

### Q7: Large Locals

**Question**: How are large local variables (arrays, structs) handled?

**Areas to investigate**:
- Maximum local size limits?
- Heap allocation fallback?
- Compile-time errors for oversized locals?

## Success Criteria

### For Each Project Analysis

- [ ] Identified core stack/frame allocation approach
- [ ] Documented zero page usage strategy
- [ ] Documented parameter passing mechanism
- [ ] Documented return value handling
- [ ] Documented recursion handling
- [ ] Documented frame reuse (if any)
- [ ] Listed strengths with evidence
- [ ] Listed weaknesses with evidence
- [ ] Extracted relevant code patterns

### For Synthesis

- [ ] Created comparison matrix of all approaches
- [ ] Identified best practices from each project
- [ ] Identified anti-patterns to avoid
- [ ] Documented edge cases and how each handles them

### For God-Level SFA Design

- [ ] Designed allocation algorithm
- [ ] Defined data structures (Frame, Slot, etc.)
- [ ] Defined zero page strategy
- [ ] Defined frame reuse approach
- [ ] Defined recursion handling approach
- [ ] Defined testing strategy

### For Blend Integration

- [ ] Created TypeScript type definitions
- [ ] Mapped to Blend compiler phases
- [ ] Identified integration points
- [ ] Created test specifications

## Key Files to Analyze

### CC65 (`/sfa_learning/cc65/src/cc65/`)

| File | Purpose |
|------|---------|
| `locals.c/h` | Local variable handling |
| `stackptr.c/h` | Stack pointer management |
| `function.c/h` | Function frame setup |
| `codegen.c/h` | Code generation |
| `symtab.c/h` | Symbol table (variable tracking) |

### KickC (`/sfa_learning/kickc/src/main/java/dk/camelot64/kickc/passes/`)

| File | Purpose |
|------|---------|
| `Pass1AssertNoRecursion.java` | Recursion detection |
| `Pass1CallStack.java` | Call stack handling |
| `Pass1CallStackVarConvert.java` | Stack variable conversion |
| `Pass1CallStackVarPrepare.java` | Stack variable preparation |
| `Pass4MemoryCoalesce*.java` | Memory coalescing |
| `Pass4AssertZeropageAllocation.java` | ZP validation |

### Oscar64 (`/sfa_learning/oscar64/oscar64/`)

| File | Purpose |
|------|---------|
| `Declaration.cpp/h` | Variable/function declarations |
| `InterCode.cpp/h` | Intermediate code |
| `InterCodeGenerator.cpp/h` | IC generation with locals |
| `NativeCodeGenerator.cpp/h` | Native code generation |
| `GlobalAnalyzer.cpp/h` | Global analysis |

### Prog8 (`/sfa_learning/prog8/codeGenCpu6502/src/prog8/codegen/cpu6502/`)

| File | Purpose |
|------|---------|
| `VariableAllocator.kt` | Variable allocation |
| `ProgramAndVarsGen.kt` | Program/variable generation |
| `FunctionCallAsmGen.kt` | Function call generation |

## Deliverables

1. **Analysis Documents** - One per project with detailed findings
2. **Comparison Matrix** - Side-by-side feature comparison
3. **Best Practices Document** - Consolidated best practices
4. **Anti-Patterns Document** - What to avoid and why
5. **God-Level SFA Specification** - The superior design
6. **Blend Integration Plan** - How to implement in Blend

---

**Next Step**: See [99-execution-plan.md](99-execution-plan.md) for session-by-session execution.