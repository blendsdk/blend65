# KickC Recursion Detection

> **Document**: 01-recursion-detection.md
> **Parent**: [KickC Overview](00-overview.md)
> **Created**: 2025-01-31
> **Status**: Complete

## Overview

KickC detects and prevents recursion for its default PHI_CALL calling convention. This is critical for static frame allocation because recursive functions would require dynamic stack allocation.

## Detection Architecture

### Where It Happens

Recursion detection occurs in `Pass1AssertNoRecursion.java`, which runs during the SSA generation phase (Pass1), specifically **after** procedure inlining but **before** the final SSA form is generated.

### Call Graph Construction

The call graph is built by `PassNCalcCallGraph.java` and stored in the `Program` object. It tracks:

1. **Call Blocks** - One per scope (procedure or root)
2. **Calls** - Individual call statements with:
   - Statement index
   - Calling scope
   - Called procedure

## The Detection Algorithm

### Step 1: Build Call Graph

```java
// PassNCalcCallGraph builds the graph by visiting all call statements
public class CallBlock {
    private ScopeRef scopeLabel;  // The procedure/scope
    private List<Call> calls;      // All calls made from this scope
    
    public void addCall(ProcedureRef procedureLabel, StatementCalling call) {
        this.calls.add(new Call(procedureLabel, call, scopeLabel));
    }
}
```

### Step 2: Compute Recursive Closure

For each procedure, compute the transitive closure of all called procedures:

```java
/**
 * Get the closure of all procedures called from a specific scope.
 * This includes the recursive closure of calls (ie. sub-calls and their sub-calls).
 */
public Collection<ScopeRef> getRecursiveCalls(ScopeRef scopeRef) {
    ArrayList<ScopeRef> closure = new ArrayList<>();
    CallBlock callBlock = getCallBlock(scopeRef);
    if(callBlock != null) {
        for(CallBlock.Call call : callBlock.getCalls()) {
            addRecursiveCalls(call.getProcedure(), closure);
        }
    }
    return closure;
}

private void addRecursiveCalls(ScopeRef scopeRef, Collection<ScopeRef> found) {
    if(found.contains(scopeRef)) {
        // Recursion detected - stop here (but don't throw yet)
        return;
    }
    found.add(scopeRef);
    CallBlock callBlock = getCallBlock(scopeRef);
    if(callBlock != null) {
        for(CallBlock.Call call : callBlock.getCalls()) {
            addRecursiveCalls(call.getProcedure(), found);
        }
    }
}
```

**This is a depth-first search (DFS) with a visited set.** If we encounter a node already in the visited set, we've found a cycle.

### Step 3: Check for Self-Recursion

The assertion pass checks if any procedure is in its own closure:

```java
public boolean step() {
    CallGraph callGraph = getProgram().getCallGraph();
    Collection<Procedure> procedures = getProgramScope().getAllProcedures(true);
    for(Procedure procedure : procedures) {
        Collection<ScopeRef> recursiveCalls = callGraph.getRecursiveCalls(procedure.getRef());
        if(recursiveCalls.contains(procedure.getRef()) && 
           !Procedure.CallingConvention.STACK_CALL.equals(procedure.getCallingConvention())) {
            throw new CompileError("ERROR! Recursion not allowed! Occurs in " + procedure.getRef());
        }
    }
    return false;
}
```

**Key Logic:**
- Get closure of all procedures called from this procedure
- If closure contains the procedure itself → recursion!
- Exception: STACK_CALL convention is allowed to recurse

## Recursion Types Detected

### Direct Recursion

```c
void foo() {
    foo();  // Direct self-call
}
```

**Detection:** `foo` is in `foo`'s closure.

### Indirect (Mutual) Recursion

```c
void foo() {
    bar();
}

void bar() {
    foo();  // Indirect recursion via bar
}
```

**Detection:**
- `foo`'s closure = {bar, foo} (because bar calls foo)
- `foo` is in its own closure → recursion detected

### Deep Indirect Recursion

```c
void a() { b(); }
void b() { c(); }
void c() { a(); }  // Deep cycle
```

**Detection:**
- `a`'s closure = {b, c, a}
- `a` is in its own closure → recursion detected

## Exception: STACK_CALL Convention

KickC allows recursion when explicitly requested:

```c
__stackcall int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);  // Allowed!
}
```

The check skips procedures with `STACK_CALL` calling convention:
```java
!Procedure.CallingConvention.STACK_CALL.equals(procedure.getCallingConvention())
```

## Error Messages

When recursion is detected:

```
ERROR! Recursion not allowed! Occurs in myfunction
```

Simple but clear. The user must either:
1. Refactor to eliminate recursion
2. Add `__stackcall` attribute

## Timing in Compilation

```
Pass1...
  └── Pass1ProcedureInline     ← Inlining might reveal hidden recursion
  └── Pass1AssertNoRecursion   ← Detection happens HERE
  └── Pass1CallStackVarPrepare
  └── ...
```

**Important:** Detection happens **after inlining** because inlining might eliminate what looked like recursion, or reveal recursion that was hidden behind inlined calls.

## Algorithm Complexity

| Operation | Complexity |
|-----------|------------|
| Build call graph | O(S) where S = statements |
| Compute one closure | O(P) where P = procedures |
| Check all procedures | O(P²) worst case |

For typical programs with ~100 procedures, this is negligible.

## Implications for Blend

### What Blend Should Adopt

1. **DFS-based closure computation** - Simple and effective
2. **Check after inlining** - Catches all cases
3. **Clear error messages** - Tell user which function has the problem
4. **Consider future STACK_CALL** - Design for optional recursion support

### What Blend Can Improve

1. **Better error messages** - Show the call chain that forms the cycle
2. **Suggestion system** - "Consider using iteration instead of recursion"
3. **Call graph visualization** - Help user understand the issue

### Example Improved Error Message

```
ERROR: Recursion detected in function 'factorial'

Call chain forming cycle:
  factorial → helper → factorial

Suggestion: Blend65 requires non-recursive functions for optimal 6502 code.
Consider refactoring to use iteration, or use @stackcall if recursion is required.
```

## Code References

### Pass1AssertNoRecursion.java (Complete)

```java
package dk.camelot64.kickc.passes;

import dk.camelot64.kickc.model.CallGraph;
import dk.camelot64.kickc.model.CompileError;
import dk.camelot64.kickc.model.Program;
import dk.camelot64.kickc.model.symbols.Procedure;
import dk.camelot64.kickc.model.values.ScopeRef;

import java.util.Collection;

/** Asserts that the program has no recursive calls */
public class Pass1AssertNoRecursion extends Pass1Base {

   public Pass1AssertNoRecursion(Program program) {
      super(program);
   }

   @Override
   public boolean step() {
      CallGraph callGraph = getProgram().getCallGraph();
      Collection<Procedure> procedures = getProgramScope().getAllProcedures(true);
      for(Procedure procedure : procedures) {
         Collection<ScopeRef> recursiveCalls = callGraph.getRecursiveCalls(procedure.getRef());
         if(recursiveCalls.contains(procedure.getRef()) && 
            !Procedure.CallingConvention.STACK_CALL.equals(procedure.getCallingConvention())) {
            throw new CompileError("ERROR! Recursion not allowed! Occurs in " + procedure.getRef());
         }
      }
      return false;
   }
}
```

## Summary

| Aspect | KickC Approach |
|--------|----------------|
| **Algorithm** | DFS closure + self-membership check |
| **Timing** | After inlining, before SSA finalization |
| **Direct recursion** | ✅ Detected |
| **Mutual recursion** | ✅ Detected |
| **Deep cycles** | ✅ Detected |
| **Exception** | STACK_CALL functions allowed |
| **Complexity** | O(P²) worst case, fast in practice |