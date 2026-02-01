# Prog8 Function Calls Analysis

> **Document**: prog8/02-function-calls.md
> **Parent**: [Phase 4 Execution Plan](../99d-phase4-prog8.md)
> **Status**: Complete
> **Source**: `FunctionCallAsmGen.kt` (~300 lines)

## Overview

Prog8's function call mechanism is fundamentally different from stack-based compilers. All parameter passing uses **static variables** or **CPU registers** - there is no software stack involved.

---

## Calling Convention Summary

| Parameters | Mechanism |
|------------|-----------|
| 1 byte | A register |
| 1 word | AY registers |
| 2 bytes | A and Y registers |
| Complex/many | Static variables |

**Return values:** Always via A (byte), AY (word), or FAC1 (float)

---

## Parameter Passing Mechanisms

### 1. CPU Register Optimization

For simple cases (1-2 integer arguments), Prog8 passes via registers:

```kotlin
internal fun optimizeIntArgsViaCpuRegisters(params: List<PtSubroutineParameter>): Boolean {
    return when (params.size) {
        1 -> params[0].register == null && 
             (params[0].type.isWordOrByteOrBool || params[0].type.isPointer)
        2 -> params[0].type.isByteOrBool && 
             params[1].type.isByteOrBool && 
             params[0].register == null && 
             params[1].register == null
        else -> false
    }
}
```

**Generated code for 1 byte param:**
```asm
; call myFunc(5)
lda  #5        ; Load argument into A
jsr  myFunc    ; Call - function receives in A
```

**Generated code for 2 byte params:**
```asm
; call myFunc(5, 3)
lda  #5        ; First param in A
ldy  #3        ; Second param in Y
jsr  myFunc    ; Function receives A=5, Y=3
```

### 2. Static Variable Assignment

For all other cases, parameters become static variables:

```kotlin
private fun argumentViaVariable(sub: PtSub, parameter: PtSubroutineParameter, value: PtExpression) {
    val reg = parameter.register
    if(reg != null) {
        // Virtual register (cx16.r0-r15)
        val varName = "cx16.${reg.name.lowercase()}"
        asmgen.assignExpressionToVariable(value, varName, parameter.type)
    } else {
        // Static parameter variable
        val varName = asmgen.asmVariableName(sub.scopedName + "." + parameter.name)
        asmgen.assignExpressionToVariable(value, varName, parameter.type)
    }
}
```

**Generated code:**
```asm
; call complexFunc(a, b, c, d)
lda  arg_a_value
sta  complexFunc.a      ; Store to static param var
lda  arg_b_value  
sta  complexFunc.b      ; Store to static param var
lda  arg_c_value
sta  complexFunc.c      ; Store to static param var
lda  arg_d_value
sta  complexFunc.d      ; Store to static param var
jsr  complexFunc        ; Call with params in static vars
```

---

## Subroutine Entry Code

When a subroutine receives parameters via registers, it may need to save them:

```kotlin
if(functioncallAsmGen.optimizeIntArgsViaCpuRegisters(parameters)) {
    // Parameters arrived in registers - store to parameter variables
    when(params.size) {
        1 -> {
            val target = AsmAssignTarget(VARIABLE, varname = params[0].name)
            if(dt.isByteOrBool)
                asmgen.assignRegister(RegisterOrPair.A, target)
            else
                asmgen.assignRegister(RegisterOrPair.AY, target)
        }
        2 -> {
            // First param from A, second from Y
            asmgen.assignRegister(RegisterOrPair.A, target1)
            asmgen.assignRegister(RegisterOrPair.Y, target2)
        }
    }
}
```

**Generated subroutine:**
```asm
myFunc .proc
    ; Received: A = first param, Y = second param
    sta  myFunc.a        ; Save A to static var
    sty  myFunc.b        ; Save Y to static var
    
    ; ... function body uses myFunc.a, myFunc.b ...
    
    rts
    
    .section BSS
myFunc.a    .byte ?
myFunc.b    .byte ?
    .send BSS
.pend
```

---

## Assembly Subroutines (PtAsmSub)

For `asmsub` definitions, Prog8 supports explicit register specifications:

```kotlin
private fun argumentsViaRegisters(sub: PtAsmSub, call: PtFunctionCall) {
    val registersUsed = mutableListOf<RegisterOrStatusflag>()
    
    // Evaluate arguments in optimal order to avoid register conflicts
    val optimalEvalOrder = asmsub6502ArgsEvalOrder(sub)
    optimalEvalOrder.forEach {
        val param = sub.parameters[it]
        val arg = call.args[it]
        
        // If evaluation clobbers already-used registers, save/restore them
        if(usesOtherRegistersWhileEvaluating(arg)) {
            if(usedX()) asmgen.saveRegisterStack(CpuRegister.X, usedA())
            if(usedY()) asmgen.saveRegisterStack(CpuRegister.Y, usedA())
            if(usedA()) asmgen.saveRegisterStack(CpuRegister.A, usedA())
            
            argumentViaRegister(sub, param, arg)
            
            if(usedA()) asmgen.restoreRegisterStack(CpuRegister.A, false)
            if(usedY()) asmgen.restoreRegisterStack(CpuRegister.Y, true)
            if(usedX()) asmgen.restoreRegisterStack(CpuRegister.X, true)
        } else {
            argumentViaRegister(sub, param, arg)
        }
    }
}
```

This ensures correct evaluation order when arguments have side effects.

---

## Carry Flag Parameter (Special Case)

Prog8 supports passing boolean values via the CPU Carry flag:

```kotlin
if (statusflag == Statusflag.Pc) {
    when(value) {
        is PtNumber -> {
            val carrySet = value.number.toInt() != 0
            asmgen.out(if(carrySet) "  sec" else "  clc")
        }
        is PtIdentifier -> {
            asmgen.out("""
                pha
                clc
                lda  $sourceName
                beq  +
                sec  
+               pla""")
        }
    }
}
```

**Generated code:**
```asm
; asmsub myRomCall(ubyte value @A, bool flag @Pc)
lda  #$42       ; Value in A
sec             ; Boolean true in Carry
jsr  myRomCall
```

---

## Virtual Registers (Commander X16)

On Commander X16, Prog8 can use the Rx virtual registers:

```kotlin
if(reg != null) {
    require(reg in Cx16VirtualRegisters)
    val varName = "cx16.${reg.name.lowercase()}"
    asmgen.assignExpressionToVariable(value, varName, parameter.type)
}
```

**Generated code:**
```asm
; Using cx16.r0 for parameter
lda  #<$1234
sta  cx16.r0
lda  #>$1234
sta  cx16.r0+1
jsr  myFunc
```

---

## Return Values

Return values use the same register conventions:

| Type | Register |
|------|----------|
| byte/bool | A |
| word | AY |
| long | Combined registers (cx16) |
| float | FAC1 |

**Generated return code:**
```asm
; return value (byte)
lda  result
rts

; return value (word)
lda  result
ldy  result+1
rts
```

---

## Argument Evaluation Order

Prog8 computes optimal argument evaluation order:

```kotlin
private fun usesOtherRegistersWhileEvaluating(arg: PtExpression): Boolean {
    return when(arg) {
        is PtBuiltinFunctionCall -> {
            if (arg.name in arrayOf("lsb", "msb", "lsw", "msw"))
                usesOtherRegistersWhileEvaluating(arg.args[0])
            else
                !arg.isSimple()
        }
        is PtAddressOf, is PtIdentifier, is PtNumber, is PtBool -> false
        is PtMemoryByte -> arg.address !is PtNumber && arg.address !is PtIdentifier
        else -> true
    }
}
```

**Simple args first, complex args last** - to minimize register save/restore.

---

## Complete Call Sequence Example

**Prog8 source:**
```
sub calculate(ubyte x, ubyte y, uword z) -> uword {
    return (x as uword) + (y as uword) + z
}

sub main() {
    uword result = calculate(10, 20, 1000)
}
```

**Generated assembly:**

```asm
; Caller (main)
main .proc
    lda  #10
    sta  calculate.x        ; Static param 1
    lda  #20
    sta  calculate.y        ; Static param 2
    lda  #<1000
    sta  calculate.z        ; Static param 3 (LSB)
    lda  #>1000
    sta  calculate.z+1      ; Static param 3 (MSB)
    jsr  calculate
    ; Result in AY
    sta  main.result
    sty  main.result+1
    rts

    .section BSS
main.result .word ?
    .send BSS
.pend

; Callee (calculate)
calculate .proc
    ; x, y, z already in static vars
    lda  calculate.x
    ldy  #0
    clc
    adc  calculate.y
    bcc  +
    iny
+   clc
    adc  calculate.z
    pha
    tya
    adc  calculate.z+1
    tay
    pla
    rts
    
    .section BSS
calculate.x  .byte ?
calculate.y  .byte ?
calculate.z  .word ?
    .send BSS
.pend
```

---

## Why No Recursion?

The static parameter model means each function has **exactly one copy** of its parameters:

```
First call: calculate(10, 20, 1000)
  → calculate.x = 10, calculate.y = 20, calculate.z = 1000
  
If calculate calls itself: calculate(5, 10, 500)
  → calculate.x = 5, calculate.y = 10, calculate.z = 500
  → OVERWRITES the original parameters!
  → When inner call returns, outer call's state is LOST
```

**This is by design** - Prog8 optimizes for game development where recursion is rare.

---

## Comparison with Other Compilers

| Aspect | CC65 | Oscar64 | KickC | Prog8 |
|--------|------|---------|-------|-------|
| Default | Stack | Fastcall | Static | **Static** |
| Recursion | Yes | Auto-detect | Limited | **No** |
| Register passing | Minimal | Extensive | Extensive | **Simple** |
| Complexity | High | High | High | **Low** |

---

## Strengths

1. **Zero Overhead** - No stack manipulation
2. **Predictable** - Variables at fixed addresses
3. **Fast Access** - Direct memory addressing
4. **Simple Debug** - Can inspect parameters easily

## Weaknesses

1. **No Recursion** - Fundamental limitation
2. **No Re-entrancy** - ISR can't call same function
3. **More Static Memory** - Each function needs param space
4. **Code Size** - Explicit stores at each call site

---

## Implications for Blend65

### Consider Hybrid Model

```
// Default: Static (Prog8 style) - fast, no overhead
fn fast_function(a: byte, b: byte): byte { ... }

// Opt-in: Stack (for recursion)
recursive fn factorial(n: byte): word { ... }
```

### Register Optimization Worth Adopting

The A/Y/AY convention for 1-2 simple args is efficient:
- Avoids memory access for simple cases
- Compatible with 6502 calling conventions
- Easy to implement