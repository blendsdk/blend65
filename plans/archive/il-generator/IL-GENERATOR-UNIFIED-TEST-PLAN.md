# IL Generator - Unified Test Plan

> **Status**: SINGLE SOURCE OF TRUTH for all IL Generator Testing  
> **Version**: 1.0 (Merged from comprehensive-test-plan.md + code-compliance-and-extreme-testing.md)  
> **Date**: January 20, 2026  
> **Total Tests**: ~3,000+ (Regular + Extreme)  
> **Replaces**: `il-generator-comprehensive-test-plan.md` and `00-code-compliance-and-extreme-testing.md`

---

## 🚨 THIS IS THE ONLY TEST PLAN - USE THIS DOCUMENT

This document merges:
1. **Regular Tests** (~590) - Component-focused tests from the comprehensive test plan
2. **Extreme Tests** (~2,930) - Phase-focused deep tests from the code compliance document

**DO NOT USE the other test documents - they are superseded by this unified plan.**

---

## Quick Reference: Phase → Test File Mapping

| Phase | Implementation Files | Test File(s) | Tests |
|-------|---------------------|--------------|-------|
| **Phase 1** | `types.ts`, `values.ts`, `instructions.ts` | `types.test.ts`, `values.test.ts`, `instructions.test.ts` | ~310 |
| **Phase 2** | `basic-block.ts`, `function.ts`, `module.ts`, `builder.ts`, `validator.ts` | `basic-block.test.ts`, `function.test.ts`, `module.test.ts`, `builder.test.ts`, `validator.test.ts` | ~350 |
| **Phase 3** | `generator/base.ts`, `generator/modules.ts`, `generator/declarations.ts`, `generator/statements.ts` | `generator-base.test.ts`, `generator-declarations.test.ts`, `generator-statements.test.ts` | ~500 |
| **Phase 4** | `generator/expressions.ts` | `generator-expressions.test.ts` | ~400 |
| **Phase 5** | `intrinsics/registry.ts` | `intrinsics.test.ts` | ~450 |
| **Phase 6** | `ssa/*.ts` | `ssa.test.ts` | ~280 |
| **Phase 7** | `optimization/*.ts` | `optimization.test.ts` | ~500 |
| **Phase 8** | Integration | `integration.test.ts` | ~350 |
| **TOTAL** | | **13 test files** | **~3,140** |

---

## Test File Location

All test files are located in:
```
packages/compiler/src/__tests__/il/
```

---

## PHASE 1: IL Type System (~310 tests)

**Implementation Files**: `types.ts`, `values.ts`, `instructions.ts`  
**Test Files**: `types.test.ts`, `values.test.ts`, `instructions.test.ts`  
**Phase Document**: [01-type-system.md](01-type-system.md)

---

### Test File: `types.test.ts` (~60 tests)

#### 1.1 Primitive Type Singletons (12 tests)

| Test | Description |
|------|-------------|
| 1 | IL_VOID singleton immutability |
| 2 | IL_VOID kind and sizeInBytes (0) |
| 3 | IL_BOOL singleton immutability |
| 4 | IL_BOOL kind and sizeInBytes (1) |
| 5 | IL_BYTE singleton immutability |
| 6 | IL_BYTE kind and sizeInBytes (1) |
| 7 | IL_WORD singleton immutability |
| 8 | IL_WORD kind and sizeInBytes (2) |
| 9 | Primitive types are frozen objects |
| 10 | Primitive types identical across imports |
| 11 | ILTypeKind enum has all expected values |
| 12 | Each primitive maps to correct ILTypeKind |

#### 1.2 Array Type Factory (15 tests)

| Test | Description |
|------|-------------|
| 1 | createArrayType(IL_BYTE, 10) fixed-size byte array |
| 2 | createArrayType(IL_WORD, 5) fixed-size word array |
| 3 | createArrayType(IL_BYTE, null) dynamic byte array |
| 4 | createArrayType(IL_WORD, null) dynamic word array |
| 5 | Array size calculation: byte[10] = 10 bytes |
| 6 | Array size calculation: word[10] = 20 bytes |
| 7 | Array with nested array element type |
| 8 | Array with 0 length (edge case) |
| 9 | Array with 1 length (edge case) |
| 10 | Array with 255 length (max byte index) |
| 11 | Array with 256 length (word index needed) |
| 12 | Array with 65535 length (max word) |
| 13 | Negative array length throws error |
| 14 | Array type is frozen/immutable |
| 15 | Array elementType property access |

#### 1.3 Pointer Type Factory (8 tests)

| Test | Description |
|------|-------------|
| 1 | createPointerType(IL_BYTE) pointer to byte |
| 2 | createPointerType(IL_WORD) pointer to word |
| 3 | createPointerType(IL_BOOL) pointer to bool |
| 4 | Pointer to array type |
| 5 | Pointer to pointer type (double pointer) |
| 6 | Pointer to function type |
| 7 | Pointer size is always 2 bytes |
| 8 | Pointer type is frozen/immutable |

#### 1.4 Function Type Factory (10 tests)

| Test | Description |
|------|-------------|
| 1 | createFunctionType([], IL_VOID) no-arg void function |
| 2 | createFunctionType([IL_BYTE], IL_BYTE) single param |
| 3 | createFunctionType([IL_BYTE, IL_WORD], IL_WORD) multi params |
| 4 | Function with array parameter type |
| 5 | Function with pointer parameter type |
| 6 | Function returning array type |
| 7 | Function returning pointer type |
| 8 | Function size is 2 bytes (function pointer) |
| 9 | Parameter types are copied (not shared) |
| 10 | Function type is frozen/immutable |

#### 1.5 Type Equality (15 tests)

| Test | Description |
|------|-------------|
| 1 | typesEqual(IL_BYTE, IL_BYTE) same primitive |
| 2 | typesEqual(IL_BYTE, IL_WORD) different primitives |
| 3 | typesEqual(IL_VOID, IL_VOID) void equality |
| 4 | Same array types are equal |
| 5 | Different element type arrays not equal |
| 6 | Different length arrays not equal |
| 7 | Dynamic vs fixed array not equal |
| 8 | Same pointer types are equal |
| 9 | Different pointee pointer types not equal |
| 10 | Same function types are equal |
| 11 | Different return type functions not equal |
| 12 | Different parameter count functions not equal |
| 13 | Different parameter type functions not equal |
| 14 | Deep nested type equality (array of pointers) |
| 15 | Complex function type equality |

---

### Test File: `values.test.ts` (~50 tests)

#### 2.1 VirtualRegister Class (15 tests)

| Test | Description |
|------|-------------|
| 1 | Create register with id and type |
| 2 | Create register with optional name |
| 3 | toString() without name: "v0" |
| 4 | toString() with name: "v0:counter" |
| 5 | equals() same id registers |
| 6 | equals() different id registers |
| 7 | Register id is readonly |
| 8 | Register type is readonly |
| 9 | Register name is readonly |
| 10 | Register with IL_BYTE type |
| 11 | Register with IL_WORD type |
| 12 | Register with array type |
| 13 | Sequential register IDs |
| 14 | Large register IDs (1000+) |
| 15 | Register with special characters in name |

#### 2.2 ILConstant Creation (10 tests)

| Test | Description |
|------|-------------|
| 1 | Create byte constant (0) |
| 2 | Create byte constant (255) |
| 3 | Create word constant (0) |
| 4 | Create word constant (65535) |
| 5 | Create bool constant (true = 1) |
| 6 | Create bool constant (false = 0) |
| 7 | Constant kind is 'constant' |
| 8 | Constant is frozen/immutable |
| 9 | Negative constant values |
| 10 | Constant with metadata access |

#### 2.3 ILLabel Creation (10 tests)

| Test | Description |
|------|-------------|
| 1 | Create label with name and blockId |
| 2 | Label kind is 'label' |
| 3 | Label is frozen/immutable |
| 4 | Label name uniqueness |
| 5 | Label blockId correctness |
| 6 | Label with special characters in name |
| 7 | Label with numeric suffix |
| 8 | Label with underscore prefix |
| 9 | Empty label name edge case |
| 10 | Very long label name |

#### 2.4 Type Guards (10 tests)

| Test | Description |
|------|-------------|
| 1 | isVirtualRegister() on VirtualRegister |
| 2 | isVirtualRegister() on ILConstant |
| 3 | isVirtualRegister() on ILLabel |
| 4 | isILConstant() on VirtualRegister |
| 5 | isILConstant() on ILConstant |
| 6 | isILConstant() on ILLabel |
| 7 | isILLabel() on VirtualRegister |
| 8 | isILLabel() on ILConstant |
| 9 | isILLabel() on ILLabel |
| 10 | Type guards with undefined/null |

#### 2.5 ILValueFactory (15 tests)

| Test | Description |
|------|-------------|
| 1 | Factory createRegister increments ID |
| 2 | Factory createRegister with type |
| 3 | Factory createRegister with name |
| 4 | Factory createConstant |
| 5 | Factory createLabel assigns block ID |
| 6 | Factory createUniqueLabel with prefix |
| 7 | Factory createLabelForBlock specific ID |
| 8 | Factory reset() clears counters |
| 9 | Factory getNextRegisterId() |
| 10 | Factory getNextLabelId() |
| 11 | Factory getRegisterCount() |
| 12 | Factory getLabelCount() |
| 13 | Multiple factories are independent |
| 14 | Factory after many allocations |
| 15 | Factory label uniqueness guarantee |

---

### Test File: `instructions.test.ts` (~100 tests)

#### 3.1 ILOpcode Enum (10 tests)

| Test | Description |
|------|-------------|
| 1 | All arithmetic opcodes exist (ADD, SUB, MUL, DIV, MOD, NEG) |
| 2 | All bitwise opcodes exist (AND, OR, XOR, NOT, SHL, SHR) |
| 3 | All comparison opcodes exist (CMP_EQ, CMP_NE, CMP_LT, etc.) |
| 4 | All control flow opcodes exist (JUMP, BRANCH, RETURN, RETURN_VOID) |
| 5 | All memory opcodes exist (LOAD_VAR, STORE_VAR, etc.) |
| 6 | All call opcodes exist (CALL, CALL_VOID, CALL_INDIRECT) |
| 7 | All intrinsic opcodes exist (PEEK, POKE, PEEKW, POKEW) |
| 8 | All hardware opcodes exist (HARDWARE_READ, HARDWARE_WRITE) |
| 9 | SSA opcodes exist (PHI) |
| 10 | CPU instruction opcodes exist (SEI, CLI, NOP, BRK) |

#### 3.2 ILConstInstruction (12 tests)

| Test | Description |
|------|-------------|
| 1 | Create const instruction with byte value |
| 2 | Create const instruction with word value |
| 3 | Create const instruction with hex value |
| 4 | getOperands() returns empty |
| 5 | getUsedRegisters() returns empty |
| 6 | hasSideEffects() is false |
| 7 | isTerminator() is false |
| 8 | toString() format for small values |
| 9 | toString() format for hex values (>255) |
| 10 | Result register is set correctly |
| 11 | Metadata attachment |
| 12 | ID assignment |

#### 3.3 ILBinaryInstruction (20 tests)

| Test | Description |
|------|-------------|
| 1 | ADD instruction creation |
| 2 | SUB instruction creation |
| 3 | MUL instruction creation |
| 4 | DIV instruction creation |
| 5 | MOD instruction creation |
| 6 | AND instruction creation |
| 7 | OR instruction creation |
| 8 | XOR instruction creation |
| 9 | SHL instruction creation |
| 10 | SHR instruction creation |
| 11 | getOperands() returns [left, right] |
| 12 | getUsedRegisters() returns [left, right] |
| 13 | hasSideEffects() is false |
| 14 | isTerminator() is false |
| 15 | toString() format |
| 16 | Left operand access |
| 17 | Right operand access |
| 18 | Result register access |
| 19 | Metadata with source location |
| 20 | Comparison instructions (CMP_EQ, etc.) |

#### 3.4 ILUnaryInstruction (10 tests)

| Test | Description |
|------|-------------|
| 1 | NEG instruction creation |
| 2 | NOT instruction creation (bitwise) |
| 3 | LOGICAL_NOT instruction creation |
| 4 | getOperands() returns [operand] |
| 5 | getUsedRegisters() returns [operand] |
| 6 | hasSideEffects() is false |
| 7 | isTerminator() is false |
| 8 | toString() format |
| 9 | Operand access |
| 10 | Result register access |

#### 3.5 ILConvertInstruction (8 tests)

| Test | Description |
|------|-------------|
| 1 | ZERO_EXTEND instruction (byte → word) |
| 2 | TRUNCATE instruction (word → byte) |
| 3 | BOOL_TO_BYTE instruction |
| 4 | BYTE_TO_BOOL instruction |
| 5 | Source register access |
| 6 | Target type access |
| 7 | toString() format |
| 8 | getUsedRegisters() returns source |

#### 3.6 Control Flow Instructions (18 tests)

| Test | Description |
|------|-------------|
| 1 | ILJumpInstruction creation |
| 2 | Jump getOperands() returns [target label] |
| 3 | Jump getUsedRegisters() is empty |
| 4 | Jump isTerminator() is true |
| 5 | Jump getTargetBlockId() |
| 6 | Jump toString() format |
| 7 | ILBranchInstruction creation |
| 8 | Branch getOperands() returns [condition, then, else] |
| 9 | Branch getUsedRegisters() returns [condition] |
| 10 | Branch isTerminator() is true |
| 11 | Branch getThenBlockId() |
| 12 | Branch getElseBlockId() |
| 13 | Branch getSuccessorBlockIds() |
| 14 | ILReturnInstruction creation |
| 15 | Return getUsedRegisters() returns [value] |
| 16 | Return isTerminator() is true |
| 17 | ILReturnVoidInstruction creation |
| 18 | ReturnVoid getUsedRegisters() is empty |

#### 3.7 Memory Instructions (12 tests)

| Test | Description |
|------|-------------|
| 1 | ILLoadVarInstruction creation |
| 2 | LoadVar toString() format |
| 3 | LoadVar getOperands() is empty |
| 4 | ILStoreVarInstruction creation |
| 5 | StoreVar hasSideEffects() is true |
| 6 | StoreVar getUsedRegisters() returns [value] |
| 7 | ILLoadArrayInstruction creation |
| 8 | LoadArray getUsedRegisters() returns [index] |
| 9 | ILStoreArrayInstruction creation |
| 10 | StoreArray hasSideEffects() is true |
| 11 | StoreArray getUsedRegisters() returns [index, value] |
| 12 | Memory instruction toString() formats |

#### 3.8 Call Instructions (10 tests)

| Test | Description |
|------|-------------|
| 1 | ILCallInstruction creation with args |
| 2 | Call with no arguments |
| 3 | Call with multiple arguments |
| 4 | Call getUsedRegisters() returns all args |
| 5 | Call hasSideEffects() is true |
| 6 | Call toString() format |
| 7 | ILCallVoidInstruction creation |
| 8 | CallVoid hasSideEffects() is true |
| 9 | CallVoid result is null |
| 10 | Call with metadata |

---

### Phase 1 Extreme Tests (Additional ~100 tests)

These tests supplement the regular tests with edge cases and deep coverage:

#### 1.6 Type System Extreme Edge Cases (25 tests)

| Test | Description |
|------|-------------|
| 1 | Zero-length arrays |
| 2 | Maximum array length (65535) |
| 3 | Deeply nested array types (5+ levels) |
| 4 | Empty function types (no params, void return) |
| 5 | Maximum parameter count functions (20+) |
| 6 | Null length arrays (dynamic) |
| 7 | Type equality for complex nested structures |
| 8 | Type size overflow detection |
| 9 | Recursive type structures |
| 10 | Unicode in type names |
| 11-25 | Additional edge cases for all type operations |

#### 1.7 Values Extreme Edge Cases (25 tests)

| Test | Description |
|------|-------------|
| 1 | Maximum register ID (before overflow) |
| 2 | Very long register names (1000+ chars) |
| 3 | Unicode in register names |
| 4 | Maximum constant values (65535) |
| 5 | Minimum constant values (0) |
| 6 | Negative values (signed interpretation) |
| 7 | Empty label names |
| 8 | Very long label names |
| 9 | Sequential ID generation (1000+ allocations) |
| 10 | Factory reset behavior verification |
| 11-25 | Additional edge cases |

#### 1.8 Instructions Extreme Edge Cases (50 tests)

| Test | Description |
|------|-------------|
| 1-10 | Each arithmetic op with edge values (0, 255, 65535) |
| 11-20 | Each bitwise op with edge values |
| 21-30 | Type preservation across all operations |
| 31-40 | Metadata preservation through all instruction types |
| 41-50 | toString() format verification for all instruction types |

---

## PHASE 2: CFG Infrastructure (~350 tests)

**Implementation Files**: `basic-block.ts`, `function.ts`, `module.ts`, `builder.ts`, `validator.ts`  
**Test Files**: `basic-block.test.ts`, `function.test.ts`, `module.test.ts`, `builder.test.ts`, `validator.test.ts`  
**Phase Document**: [02-cfg-infrastructure.md](02-cfg-infrastructure.md)

---

### Test File: `basic-block.test.ts` (~60 tests)

#### 4.1 Block Creation (10 tests)

| Test | Description |
|------|-------------|
| 1 | Create block with id and label |
| 2 | Create block with auto-generated label |
| 3 | Block id is readonly |
| 4 | Block label is readonly |
| 5 | Empty block has no instructions |
| 6 | isEmpty() on new block |
| 7 | getInstructionCount() on new block |
| 8 | hasTerminator() on new block |
| 9 | isExit() on new block |
| 10 | Block with single instruction |

#### 4.2 Instruction Management (15 tests)

| Test | Description |
|------|-------------|
| 1 | addInstruction() adds to end |
| 2 | addInstruction() multiple times maintains order |
| 3 | getInstructions() returns readonly array |
| 4 | getInstruction(index) correct index |
| 5 | getInstruction() out of bounds returns undefined |
| 6 | insertInstruction() at beginning |
| 7 | insertInstruction() in middle |
| 8 | insertInstruction() at end |
| 9 | insertInstruction() throws on invalid index |
| 10 | removeInstruction() removes and returns |
| 11 | removeInstruction() throws on invalid index |
| 12 | replaceInstruction() replaces and returns old |
| 13 | Adding after terminator throws error |
| 14 | Inserting after terminator throws error |
| 15 | Terminator tracking update on remove/replace |

#### 4.3 Terminator Handling (10 tests)

| Test | Description |
|------|-------------|
| 1 | Block without terminator |
| 2 | Block with JUMP terminator |
| 3 | Block with BRANCH terminator |
| 4 | Block with RETURN terminator |
| 5 | Block with RETURN_VOID terminator |
| 6 | getTerminator() returns terminator |
| 7 | getTerminator() returns undefined if no terminator |
| 8 | hasTerminator() true with terminator |
| 9 | hasTerminator() false without |
| 10 | Multiple terminators (should not happen - validation) |

#### 4.4 CFG Management (15 tests)

| Test | Description |
|------|-------------|
| 1 | addPredecessor() adds predecessor |
| 2 | getPredecessors() returns array |
| 3 | getPredecessorCount() correct count |
| 4 | hasPredecessor() check |
| 5 | removePredecessor() removes |
| 6 | addSuccessor() adds successor |
| 7 | getSuccessors() returns array |
| 8 | getSuccessorCount() correct count |
| 9 | hasSuccessor() check |
| 10 | removeSuccessor() removes |
| 11 | linkTo() updates both blocks |
| 12 | unlinkFrom() updates both blocks |
| 13 | Circular CFG detection |
| 14 | Self-referencing blocks (loops) |
| 15 | Multiple predecessors |

#### 4.5 Analysis Helpers (10 tests)

| Test | Description |
|------|-------------|
| 1 | isEntry() true when no predecessors |
| 2 | getPhiInstructions() returns phis at start |
| 3 | getNonPhiInstructions() returns rest |
| 4 | getLabel() creates ILLabel |
| 5 | toDetailedString() format |
| 6 | Very long instruction lists (1000+) |
| 7 | Deeply nested control flow |
| 8 | Unreachable blocks |
| 9 | Block with only phi instructions |
| 10 | Block with mixed phi and non-phi |

---

### Test File: `function.test.ts` (~70 tests)

#### 5.1 Function Creation (12 tests)

| Test | Description |
|------|-------------|
| 1 | Create function with name, params, return type |
| 2 | Entry block auto-created |
| 3 | Parameters stored correctly |
| 4 | Return type stored correctly |
| 5 | Function type computed correctly |
| 6 | isVoid() for void return |
| 7 | isVoid() for non-void return |
| 8 | Parameter registers created |
| 9 | Value factory created |
| 10 | Empty parameter list |
| 11 | Multiple parameters |
| 12 | Function with array parameter |

#### 5.2 Block Management (15 tests)

| Test | Description |
|------|-------------|
| 1 | createBlock() creates and adds |
| 2 | createBlock() assigns unique IDs |
| 3 | getBlock() by ID |
| 4 | getBlock() returns undefined for invalid ID |
| 5 | getEntryBlock() returns first block |
| 6 | getBlocks() returns all blocks |
| 7 | getBlockCount() correct count |
| 8 | removeBlock() removes block |
| 9 | removeBlock() entry block throws error |
| 10 | removeBlock() unlinks CFG edges |
| 11 | getExitBlocks() finds blocks with returns |
| 12 | Multiple exit blocks |
| 13 | Block reordering |
| 14 | Function with 100+ blocks |
| 15 | Empty function (entry only) |

#### 5.3 CFG Traversal (15 tests)

| Test | Description |
|------|-------------|
| 1 | getBlocksInReversePostorder() correct order |
| 2 | getBlocksInPostorder() correct order |
| 3 | getReachableBlocks() finds all reachable |
| 4 | getUnreachableBlocks() finds dead blocks |
| 5 | CFG with single block |
| 6 | CFG with linear chain |
| 7 | CFG with diamond (if/else) |
| 8 | CFG with loop (back edge) |
| 9 | CFG with nested loops |
| 10 | CFG with early returns |
| 11 | Deeply nested loops (10 levels) |
| 12 | Irreducible control flow |
| 13 | Multiple exit points |
| 14 | Dead block detection |
| 15 | Complex nested control flow |

#### 5.4 Dominator Analysis (15 tests)

| Test | Description |
|------|-------------|
| 1 | computeDominators() entry dominates self |
| 2 | Dominator of entry is entry |
| 3 | Linear blocks dominator chain |
| 4 | Diamond pattern dominators |
| 5 | Loop header dominators |
| 6 | computeDominanceFrontier() for join points |
| 7 | Dominance frontier for if/else |
| 8 | Dominance frontier for loops |
| 9 | Multiple predecessors join point |
| 10 | Complex CFG dominators |
| 11 | Nested loop dominators |
| 12 | Dominator tree correctness |
| 13 | Immediate dominator calculation |
| 14 | Post-dominator calculation |
| 15 | Dominance frontier iteration |

#### 5.5 Parameter and Register Access (13 tests)

| Test | Description |
|------|-------------|
| 1 | getParameterRegister() by index |
| 2 | getParameterRegister() out of bounds |
| 3 | getParameterRegisters() all params |
| 4 | getParameterRegisterByName() by name |
| 5 | getParameterRegisterByName() not found |
| 6 | createRegister() via function |
| 7 | getValueFactory() access |
| 8 | Parameter register types correct |
| 9 | setExported() and getExported() |
| 10 | setInterrupt() and getInterrupt() |
| 11 | setParameterStorageHint() and get |
| 12 | getInstructionCount() across blocks |
| 13 | getRegisterCount() total allocated |

---

### Test File: `module.test.ts` (~40 tests)

#### 6.1 Module Creation (5 tests)

| Test | Description |
|------|-------------|
| 1 | Create module with name |
| 2 | Empty module has no functions |
| 3 | Empty module has no globals |
| 4 | Empty module has no imports/exports |
| 5 | Module name access |

#### 6.2 Function Management (10 tests)

| Test | Description |
|------|-------------|
| 1 | createFunction() creates and adds |
| 2 | createFunction() duplicate throws |
| 3 | addFunction() adds existing |
| 4 | addFunction() duplicate throws |
| 5 | getFunction() by name |
| 6 | getFunction() not found |
| 7 | getFunctions() all functions |
| 8 | getFunctionNames() all names |
| 9 | hasFunction() check |
| 10 | removeFunction() removes |

#### 6.3 Global Variable Management (10 tests)

| Test | Description |
|------|-------------|
| 1 | createGlobal() with options |
| 2 | addGlobal() adds global |
| 3 | addGlobal() duplicate throws |
| 4 | getGlobal() by name |
| 5 | getGlobals() all globals |
| 6 | getGlobalsByStorageClass() filtered |
| 7 | ZeroPage globals |
| 8 | RAM globals |
| 9 | Data globals |
| 10 | Map globals with address |

#### 6.4 Import/Export Management (10 tests)

| Test | Description |
|------|-------------|
| 1 | createImport() adds import |
| 2 | getImport() by local name |
| 3 | getImports() all imports |
| 4 | getImportsFromModule() filtered |
| 5 | createExport() adds export |
| 6 | getExport() by exported name |
| 7 | getExports() all exports |
| 8 | getExportsByKind() filtered |
| 9 | Function exports |
| 10 | Variable exports |

#### 6.5 Entry Point and Validation (5 tests)

| Test | Description |
|------|-------------|
| 1 | setEntryPoint() sets |
| 2 | setEntryPoint() throws if function missing |
| 3 | getEntryPoint() returns function |
| 4 | hasEntryPoint() check |
| 5 | validate() returns errors |

---

### Test File: `builder.test.ts` (~80 tests)

#### 7.1 Function Lifecycle (10 tests)

| Test | Description |
|------|-------------|
| 1 | beginFunction() creates function |
| 2 | beginFunction() while building throws |
| 3 | endFunction() returns function |
| 4 | endFunction() without begin throws |
| 5 | getCurrentFunction() access |
| 6 | Function added to module |
| 7 | Entry block set as current |
| 8 | Instruction ID reset |
| 9 | enterFunction() enters existing function |
| 10 | exitFunction() cleans up state |

#### 7.2 Block Management (10 tests)

| Test | Description |
|------|-------------|
| 1 | createBlock() creates block |
| 2 | setCurrentBlock() sets current |
| 3 | getCurrentBlock() access |
| 4 | appendBlock() creates and sets |
| 5 | Block linking via linkToBlock() |
| 6 | Multiple blocks in function |
| 7 | Block with label |
| 8 | Switching between blocks |
| 9 | Block ordering preservation |
| 10 | Block removal from builder |

#### 7.3 Constant Emission (10 tests)

| Test | Description |
|------|-------------|
| 1 | emitConstByte() creates CONST |
| 2 | emitConstWord() creates CONST |
| 3 | emitConstBool(true) emits 1 |
| 4 | emitConstBool(false) emits 0 |
| 5 | emitUndef() creates UNDEF |
| 6 | Constant with correct type |
| 7 | Constant added to current block |
| 8 | Instruction ID increments |
| 9 | Constant with metadata |
| 10 | Multiple constants in sequence |

#### 7.4 Arithmetic Emission (15 tests)

| Test | Description |
|------|-------------|
| 1 | emitAdd() creates ADD |
| 2 | emitSub() creates SUB |
| 3 | emitMul() creates MUL |
| 4 | emitDiv() creates DIV |
| 5 | emitMod() creates MOD |
| 6 | emitNeg() creates NEG |
| 7 | Result register created |
| 8 | Result type matches operand type |
| 9 | Operands recorded correctly |
| 10 | Metadata attached |
| 11 | Chained arithmetic operations |
| 12 | Arithmetic with constants |
| 13 | Arithmetic with mixed types |
| 14 | Arithmetic result register naming |
| 15 | Multiple arithmetic in block |

#### 7.5 Bitwise and Comparison Emission (15 tests)

| Test | Description |
|------|-------------|
| 1 | emitAnd() creates AND |
| 2 | emitOr() creates OR |
| 3 | emitXor() creates XOR |
| 4 | emitNot() creates NOT |
| 5 | emitShl() creates SHL |
| 6 | emitShr() creates SHR |
| 7 | emitCmpEq() creates CMP_EQ |
| 8 | emitCmpNe() creates CMP_NE |
| 9 | emitCmpLt() creates CMP_LT |
| 10 | emitCmpLe() creates CMP_LE |
| 11 | emitCmpGt() creates CMP_GT |
| 12 | emitCmpGe() creates CMP_GE |
| 13 | Comparison result is bool |
| 14 | Bitwise result type preserved |
| 15 | Shift amount validation |

#### 7.6 Control Flow Emission (10 tests)

| Test | Description |
|------|-------------|
| 1 | emitJump() creates JUMP and links |
| 2 | emitBranch() creates BRANCH and links |
| 3 | emitReturn() creates RETURN |
| 4 | emitReturnVoid() creates RETURN_VOID |
| 5 | Jump links current to target |
| 6 | Branch links to both targets |
| 7 | Terminator ends block |
| 8 | Cannot emit after terminator |
| 9 | Multiple terminators error |
| 10 | Control flow with phi nodes |

#### 7.7 Memory and Call Emission (10 tests)

| Test | Description |
|------|-------------|
| 1 | emitLoadVar() creates LOAD_VAR |
| 2 | emitStoreVar() creates STORE_VAR |
| 3 | emitLoadArray() creates LOAD_ARRAY |
| 4 | emitStoreArray() creates STORE_ARRAY |
| 5 | emitCall() creates CALL |
| 6 | emitCallVoid() creates CALL_VOID |
| 7 | Call with arguments |
| 8 | Call with no arguments |
| 9 | Memory operations with metadata |
| 10 | Indirect call emission |

---

### Test File: `validator.test.ts` (~50 tests)

#### 8.1 Module Validation (10 tests)

| Test | Description |
|------|-------------|
| 1 | Valid module passes |
| 2 | Missing entry point function |
| 3 | Export references missing function |
| 4 | Export references missing global |
| 5 | All functions validated |
| 6 | Error accumulation |
| 7 | Warning accumulation |
| 8 | Multiple errors collected |
| 9 | Module with no functions |
| 10 | Module with circular imports |

#### 8.2 Function Validation (15 tests)

| Test | Description |
|------|-------------|
| 1 | Valid function passes |
| 2 | Block without terminator |
| 3 | CFG inconsistency (missing predecessor) |
| 4 | CFG inconsistency (missing successor) |
| 5 | Unreachable blocks warning |
| 6 | Entry block required |
| 7 | Terminator in middle of block |
| 8 | Empty block error |
| 9 | Multiple exit blocks valid |
| 10 | No exit blocks (infinite loop) warning |
| 11 | Return type mismatch |
| 12 | Parameter count mismatch |
| 13 | Missing return in non-void |
| 14 | Function with 100+ blocks |
| 15 | Complex CFG validation |

#### 8.3 Type Validation (15 tests)

| Test | Description |
|------|-------------|
| 1 | Binary op type mismatch |
| 2 | Binary op result type mismatch |
| 3 | Comparison result must be bool |
| 4 | Unary op type mismatch |
| 5 | ZERO_EXTEND source must be byte |
| 6 | ZERO_EXTEND target must be word |
| 7 | TRUNCATE source must be word |
| 8 | TRUNCATE target must be byte |
| 9 | Return value in void function |
| 10 | Branch condition type |
| 11 | Call argument type mismatch |
| 12 | Store type mismatch |
| 13 | Array index type validation |
| 14 | Pointer dereference type |
| 15 | Function pointer type |

#### 8.4 SSA and Phi Validation (10 tests)

| Test | Description |
|------|-------------|
| 1 | Use before definition |
| 2 | Multiple definitions warning |
| 3 | Phi at start of block |
| 4 | Phi after non-phi error |
| 5 | Phi missing predecessor entry |
| 6 | Phi references non-predecessor |
| 7 | Phi source type mismatch |
| 8 | Phi with all predecessors |
| 9 | SSA form verification |
| 10 | Definition dominates all uses |

---

### Phase 2 Extreme Tests (Additional ~50 tests)

#### 2.6 CFG Extreme Edge Cases (25 tests)

| Test | Description |
|------|-------------|
| 1-5 | Functions with 100+ blocks |
| 6-10 | Deeply nested loops (10+ levels) |
| 11-15 | Complex irreducible control flow |
| 16-20 | Pathological CFG shapes |
| 21-25 | Maximum predecessor/successor counts |

#### 2.7 Builder Extreme Edge Cases (25 tests)

| Test | Description |
|------|-------------|
| 1-5 | Building functions with 1000+ instructions |
| 6-10 | Rapid block switching |
| 11-15 | Maximum register allocation |
| 16-20 | Complex phi node construction |
| 21-25 | Builder state consistency under stress |

---

## PHASE 3: Generator Core (~500 tests)

**Implementation Files**: `generator/base.ts`, `generator/modules.ts`, `generator/declarations.ts`, `generator/statements.ts`  
**Test Files**: `generator-base.test.ts`, `generator-declarations.test.ts`, `generator-statements.test.ts`  
**Phase Documents**: [03a-generator-base.md](03a-generator-base.md), [03b-generator-declarations.md](03b-generator-declarations.md), [03c-generator-statements.md](03c-generator-statements.md)

---

### Test File: `generator-base.test.ts` (~100 tests)

#### 9.1 Type Conversion (25 tests)

| Test | Description |
|------|-------------|
| 1 | convertType() Void → IL_VOID |
| 2 | convertType() Boolean → IL_BOOL |
| 3 | convertType() Byte → IL_BYTE |
| 4 | convertType() Word → IL_WORD |
| 5 | convertType() String → Pointer to byte |
| 6 | convertType() Array with element type |
| 7 | convertType() Array with size |
| 8 | convertType() Callback → Function type |
| 9 | convertType() Unknown → IL_VOID with warning |
| 10 | convertTypeAnnotation() "byte" |
| 11 | convertTypeAnnotation() "word" |
| 12 | convertTypeAnnotation() "bool" |
| 13 | convertTypeAnnotation() "byte[10]" |
| 14 | convertTypeAnnotation() "word[]" |
| 15 | convertStorageClass() all storage classes |
| 16 | Nested type conversion |
| 17 | Complex callback type conversion |
| 18 | Array of arrays conversion |
| 19 | Pointer type conversion |
| 20 | Function type with multiple params |
| 21 | Type conversion with metadata |
| 22 | Invalid type handling |
| 23 | Unknown type fallback |
| 24 | Type conversion caching |
| 25 | Recursive type handling |

#### 9.2 Symbol Resolution (25 tests)

| Test | Description |
|------|-------------|
| 1 | Resolve local variable |
| 2 | Resolve global variable |
| 3 | Resolve function parameter |
| 4 | Resolve imported symbol |
| 5 | Resolve @zp storage class variable |
| 6 | Resolve @ram storage class variable |
| 7 | Resolve @data storage class variable |
| 8 | Resolve @map variable |
| 9 | Symbol not found error |
| 10 | Scope resolution (inner shadows outer) |
| 11 | Function symbol resolution |
| 12 | Cross-module symbol resolution |
| 13 | Export visibility checking |
| 14 | Symbol type retrieval |
| 15 | Symbol address retrieval (@map) |
| 16 | Parameter index retrieval |
| 17 | Local variable index retrieval |
| 18 | Global variable module reference |
| 19 | Nested scope resolution |
| 20 | Symbol metadata access |
| 21 | Ambiguous symbol handling |
| 22 | Symbol alias resolution |
| 23 | Circular reference detection |
| 24 | Symbol definition location |
| 25 | Symbol usage tracking |

#### 9.3 Module Generation (25 tests)

| Test | Description |
|------|-------------|
| 1 | Generate empty module |
| 2 | Generate module with single function |
| 3 | Generate module with multiple functions |
| 4 | Generate module with global variable |
| 5 | Generate module with @zp variable |
| 6 | Generate module with @ram variable |
| 7 | Generate module with @data constant |
| 8 | Generate module with simple @map |
| 9 | Generate module with range @map |
| 10 | Generate module with sequential struct @map |
| 11 | Generate module with explicit struct @map |
| 12 | Generate module with enum |
| 13 | Generate module with import |
| 14 | Generate module with export |
| 15 | Generate module with entry point detection |
| 16 | Module validation passes |
| 17 | Module stats correct |
| 18 | Module globals by storage class |
| 19 | Module function lookup |
| 20 | Module symbol resolution |
| 21 | Multi-import module |
| 22 | Multi-export module |
| 23 | Complex module (all features) |
| 24 | Module with circular dependencies |
| 25 | Module error handling |

#### 9.4 Error Handling (25 tests)

| Test | Description |
|------|-------------|
| 1 | Undefined symbol reference error |
| 2 | Type resolution failure error |
| 3 | Invalid AST structure error |
| 4 | Missing semantic analysis data |
| 5 | Type mismatch error |
| 6 | Invalid storage class error |
| 7 | Invalid address error |
| 8 | Function signature mismatch |
| 9 | Duplicate symbol error |
| 10 | Import resolution failure |
| 11 | Export conflict error |
| 12 | Circular dependency error |
| 13 | Error location reporting |
| 14 | Error recovery behavior |
| 15 | Multiple error accumulation |
| 16 | Warning vs error distinction |
| 17 | Fatal vs recoverable errors |
| 18 | Error context information |
| 19 | Error suggestion generation |
| 20 | Error code assignment |
| 21 | Nested error handling |
| 22 | Cross-module error propagation |
| 23 | Error formatting |
| 24 | Error severity levels |
| 25 | Error suppression |

---

### Test File: `generator-declarations.test.ts` (~150 tests)

#### 10.1 Function Stub Generation (30 tests)

| Test | Description |
|------|-------------|
| 1 | Generate void function stub |
| 2 | Generate function with return value stub |
| 3 | Generate function with parameters stub |
| 4 | Parameter-to-register mapping |
| 5 | Stub function (intrinsic) detection |
| 6 | Exported function stub |
| 7 | Function type in module |
| 8 | Function with complex parameters |
| 9 | Function with array parameter |
| 10 | Function with callback parameter |
| 11 | Multiple parameters mapping |
| 12 | Parameter storage hints |
| 13 | Function visibility flags |
| 14 | Function naming conventions |
| 15 | Stub validation |
| 16 | Stub metadata |
| 17 | Intrinsic function recognition |
| 18 | External function stubs |
| 19 | Interrupt function stubs |
| 20 | Inline function stubs |
| 21 | Recursive function stubs |
| 22 | Function overload stubs |
| 23 | Generic function stubs |
| 24 | Closure function stubs |
| 25 | Anonymous function stubs |
| 26 | Stub ordering |
| 27 | Stub dependency tracking |
| 28 | Stub modification prevention |
| 29 | Stub serialization |
| 30 | Stub deserialization |

#### 10.2 Function Body Generation (40 tests)

| Test | Description |
|------|-------------|
| 1 | Generate simple void function body |
| 2 | Generate function body with return |
| 3 | Generate function body with parameters |
| 4 | Local variable processing |
| 5 | Entry block setup |
| 6 | Implicit void return |
| 7 | Function body with @map access |
| 8 | Function body with arithmetic |
| 9 | Function body with control flow |
| 10 | Function body with loops |
| 11 | Function body with nested blocks |
| 12 | Function body with multiple returns |
| 13 | Function body with break/continue |
| 14 | Complex function body |
| 15 | Function calling other functions |
| 16 | Recursive function body |
| 17 | Function with arrays |
| 18 | Function with structs |
| 19 | Builder context synchronization |
| 20 | Block creation during body generation |
| 21 | CFG construction verification |
| 22 | Dominator calculation |
| 23 | Local variable storage hints |
| 24 | Register allocation tracking |
| 25 | Instruction ordering |
| 26 | Block terminator verification |
| 27 | Exit block detection |
| 28 | Unreachable code detection |
| 29 | Body validation |
| 30 | Body optimization hints |
| 31 | Inline expansion |
| 32 | Tail call optimization |
| 33 | Exception handling |
| 34 | Debug info generation |
| 35 | Source map creation |
| 36 | Comment preservation |
| 37 | Body complexity metrics |
| 38 | Body size limits |
| 39 | Body generation stats |
| 40 | Body generation performance |

#### 10.3 Variable Declaration Generation (40 tests)

| Test | Description |
|------|-------------|
| 1 | Simple let declaration |
| 2 | Declaration with initializer |
| 3 | Declaration without initializer |
| 4 | Const declaration |
| 5 | @zp variable declaration |
| 6 | @ram variable declaration |
| 7 | @data variable declaration |
| 8 | Array declaration |
| 9 | Array with size inference |
| 10 | Array with explicit size |
| 11 | @map simple declaration |
| 12 | @map range declaration |
| 13 | @map struct declaration |
| 14 | @map sequential struct |
| 15 | Exported variable declaration |
| 16 | Type annotation parsing |
| 17 | Initial value evaluation |
| 18 | Default value generation |
| 19 | Variable address assignment |
| 20 | Storage class verification |
| 21 | Variable alignment |
| 22 | Variable size calculation |
| 23 | Nested struct declaration |
| 24 | Union declaration |
| 25 | Enum declaration |
| 26 | Typedef handling |
| 27 | Volatile variable |
| 28 | Const variable |
| 29 | Static variable |
| 30 | External variable |
| 31 | Global variable ordering |
| 32 | Variable initialization order |
| 33 | Variable lifetime tracking |
| 34 | Variable scope tracking |
| 35 | Variable usage tracking |
| 36 | Variable modification tracking |
| 37 | Variable alias detection |
| 38 | Variable renaming |
| 39 | Variable metadata |
| 40 | Variable validation |

#### 10.4 Parameter Handling (40 tests)

| Test | Description |
|------|-------------|
| 1 | Single byte parameter |
| 2 | Single word parameter |
| 3 | Multiple parameters |
| 4 | Array parameter |
| 5 | Callback parameter |
| 6 | Parameter register assignment |
| 7 | Parameter type preservation |
| 8 | Parameter default values |
| 9 | Optional parameters |
| 10 | Rest parameters |
| 11 | Named parameters |
| 12 | Parameter destructuring |
| 13 | Parameter validation |
| 14 | Parameter passing conventions |
| 15 | Parameter stack allocation |
| 16 | Parameter register spilling |
| 17 | Parameter liveness |
| 18 | Parameter modification detection |
| 19 | Parameter aliasing |
| 20 | Parameter const checking |
| 21-40 | Additional parameter edge cases |

---

### Test File: `generator-statements.test.ts` (~200 tests)

#### 11.1 Return Statements (25 tests)

| Test | Description |
|------|-------------|
| 1 | Return statement with byte value |
| 2 | Return statement with word value |
| 3 | Return statement with bool value |
| 4 | Return void statement |
| 5 | Return with expression |
| 6 | Return with function call |
| 7 | Return in nested block |
| 8 | Early return |
| 9 | Return type coercion |
| 10 | Multiple return paths |
| 11-25 | Additional return edge cases |

#### 11.2 If Statements (40 tests)

| Test | Description |
|------|-------------|
| 1 | Simple if (then only) |
| 2 | If with else |
| 3 | If-elseif chain |
| 4 | If-elseif-else chain |
| 5 | Nested if statements |
| 6 | Complex conditions |
| 7 | Empty blocks |
| 8 | Single statement vs block |
| 9 | If with return |
| 10 | If with break |
| 11 | If with continue |
| 12 | If with multiple conditions (&&) |
| 13 | If with multiple conditions (||) |
| 14 | If with negated condition |
| 15 | If condition type coercion |
| 16 | Deeply nested if |
| 17 | If CFG verification |
| 18 | If block ordering |
| 19 | If phi node generation |
| 20 | If branch optimization hints |
| 21-40 | Additional if edge cases |

#### 11.3 While Loops (40 tests)

| Test | Description |
|------|-------------|
| 1 | Simple while loop |
| 2 | While with counter |
| 3 | Nested while loops |
| 4 | While with break |
| 5 | While with continue |
| 6 | While with multiple breaks |
| 7 | While with complex condition |
| 8 | Infinite loop detection |
| 9 | While loop with early exit |
| 10 | While CFG verification |
| 11 | While loop unrolling hints |
| 12 | While invariant hoisting |
| 13 | While condition optimization |
| 14 | While body optimization |
| 15 | While with nested if |
| 16 | While with function calls |
| 17 | While with array access |
| 18 | While with @map access |
| 19 | While loop depth tracking |
| 20 | While loop metadata |
| 21-40 | Additional while edge cases |

#### 11.4 For Loops (40 tests)

| Test | Description |
|------|-------------|
| 1 | Simple for loop |
| 2 | For loop lowering to while |
| 3 | For with break |
| 4 | For with continue |
| 5 | Nested for loops |
| 6 | For with complex bounds |
| 7 | For with step |
| 8 | For over arrays |
| 9 | For with multiple variables |
| 10 | For CFG verification |
| 11 | For loop optimization hints |
| 12 | For loop unrolling |
| 13 | For loop vectorization hints |
| 14 | For loop invariant hoisting |
| 15 | For with function calls |
| 16 | For with early exit |
| 17 | For backward iteration |
| 18 | For with conditional step |
| 19 | For loop depth tracking |
| 20 | For loop metadata |
| 21-40 | Additional for edge cases |

#### 11.5 Match Statements (30 tests)

| Test | Description |
|------|-------------|
| 1 | Match single case |
| 2 | Match multiple cases |
| 3 | Match with default |
| 4 | Match nested |
| 5 | Match with expressions |
| 6 | Match with fall-through |
| 7 | Match exhaustiveness |
| 8 | Match CFG verification |
| 9 | Match optimization hints |
| 10 | Match jump table generation |
| 11-30 | Additional match edge cases |

#### 11.6 Block and Expression Statements (25 tests)

| Test | Description |
|------|-------------|
| 1 | Block statement scoping |
| 2 | Nested block statements |
| 3 | Expression statement |
| 4 | Assignment statement |
| 5 | Compound assignment |
| 6 | Increment/decrement |
| 7 | Function call statement |
| 8 | Void expression |
| 9-25 | Additional block/expression edge cases |

---

### Phase 3 Extreme Tests (Additional ~50 tests)

#### 3.6 Generator Extreme Edge Cases (50 tests)

| Test | Description |
|------|-------------|
| 1-10 | Functions with 50+ local variables |
| 11-20 | Deeply nested control flow (10+ levels) |
| 21-30 | Complex @map struct hierarchies |
| 31-40 | Large module generation (100+ functions) |
| 41-50 | Cross-module dependency chains |

---

## PHASE 4: Expression Translation (~400 tests)

**Implementation Files**: `generator/expressions.ts`  
**Test File**: `generator-expressions.test.ts`  
**Phase Document**: [04-expressions.md](04-expressions.md)

---

### Test File: `generator-expressions.test.ts` (~400 tests)

#### 12.1 Literal Expressions (40 tests)

| Test | Description |
|------|-------------|
| 1 | Decimal byte literal (0) |
| 2 | Decimal byte literal (255) |
| 3 | Decimal word literal (0) |
| 4 | Decimal word literal (65535) |
| 5 | Hex byte literal ($00) |
| 6 | Hex byte literal ($FF) |
| 7 | Hex word literal ($0000) |
| 8 | Hex word literal ($FFFF) |
| 9 | Binary literal (%00000000) |
| 10 | Binary literal (%11111111) |
| 11 | Boolean true literal |
| 12 | Boolean false literal |
| 13 | String literal (empty) |
| 14 | String literal (ASCII) |
| 15 | String literal (escape sequences) |
| 16 | Maximum byte value |
| 17 | Maximum word value |
| 18 | Overflow detection |
| 19 | Literal type inference |
| 20 | Literal metadata |
| 21-40 | Additional literal edge cases |

#### 12.2 Identifier Expressions (30 tests)

| Test | Description |
|------|-------------|
| 1 | Local variable reference |
| 2 | Global variable reference |
| 3 | Parameter reference |
| 4 | Function reference |
| 5 | Imported symbol reference |
| 6 | Exported symbol reference |
| 7 | @map variable reference |
| 8 | @zp variable reference |
| 9 | Const variable reference |
| 10 | Array variable reference |
| 11 | Struct field reference |
| 12 | Enum value reference |
| 13 | Nested scope reference |
| 14 | Shadowed variable reference |
| 15 | Undefined variable error |
| 16-30 | Additional identifier edge cases |

#### 12.3 Binary Expressions (80 tests)

| Test | Description |
|------|-------------|
| 1-10 | Arithmetic: ADD with various types |
| 11-20 | Arithmetic: SUB with various types |
| 21-25 | Arithmetic: MUL with various types |
| 26-30 | Arithmetic: DIV with various types |
| 31-35 | Arithmetic: MOD with various types |
| 36-45 | Bitwise: AND, OR, XOR |
| 46-55 | Bitwise: SHL, SHR |
| 56-65 | Comparison: EQ, NE, LT, LE, GT, GE |
| 66-75 | Mixed type operations |
| 76-80 | Complex nested expressions |

#### 12.4 Unary Expressions (30 tests)

| Test | Description |
|------|-------------|
| 1 | Negation (NEG) byte |
| 2 | Negation (NEG) word |
| 3 | Bitwise NOT byte |
| 4 | Bitwise NOT word |
| 5 | Logical NOT |
| 6 | Unary plus (no-op) |
| 7 | Address-of operator |
| 8 | Dereference operator |
| 9 | Nested unary operators |
| 10 | Unary with literals |
| 11-30 | Additional unary edge cases |

#### 12.5 Call Expressions (50 tests)

| Test | Description |
|------|-------------|
| 1 | Call with no arguments |
| 2 | Call with single argument |
| 3 | Call with multiple arguments |
| 4 | Call with expression arguments |
| 5 | Void function call |
| 6 | Function call with return |
| 7 | Recursive call |
| 8 | Indirect call |
| 9 | Intrinsic call |
| 10 | External call |
| 11 | Method call |
| 12 | Callback invocation |
| 13 | Nested calls |
| 14 | Call with type coercion |
| 15 | Call argument ordering |
| 16-50 | Additional call edge cases |

#### 12.6 Index Expressions (30 tests)

| Test | Description |
|------|-------------|
| 1 | Array index with literal |
| 2 | Array index with variable |
| 3 | Array index with expression |
| 4 | Multi-dimensional array |
| 5 | @map range index |
| 6 | String index |
| 7 | Bounds checking |
| 8 | Index type coercion |
| 9 | Negative index handling |
| 10 | Index optimization hints |
| 11-30 | Additional index edge cases |

#### 12.7 Assignment Expressions (40 tests)

| Test | Description |
|------|-------------|
| 1 | Simple assignment |
| 2 | Compound add assignment (+=) |
| 3 | Compound sub assignment (-=) |
| 4 | Compound mul assignment (*=) |
| 5 | Compound div assignment (/=) |
| 6 | Compound mod assignment (%=) |
| 7 | Compound and assignment (&=) |
| 8 | Compound or assignment (\|=) |
| 9 | Compound xor assignment (^=) |
| 10 | Compound shl assignment (<<=) |
| 11 | Compound shr assignment (>>=) |
| 12 | Array element assignment |
| 13 | @map field assignment |
| 14 | Struct field assignment |
| 15 | Chained assignment |
| 16 | Type coercion in assignment |
| 17 | Const assignment error |
| 18 | Assignment side effects |
| 19 | Assignment ordering |
| 20 | Assignment optimization |
| 21-40 | Additional assignment edge cases |

#### 12.8 Short-Circuit Expressions (50 tests)

| Test | Description |
|------|-------------|
| 1 | && true && true |
| 2 | && true && false |
| 3 | && false && true |
| 4 | && false && false |
| 5 | \|\| true \|\| true |
| 6 | \|\| true \|\| false |
| 7 | \|\| false \|\| true |
| 8 | \|\| false \|\| false |
| 9 | Short-circuit evaluation verified |
| 10 | Side effects respected |
| 11 | Nested && |
| 12 | Nested \|\| |
| 13 | Mixed && and \|\| |
| 14 | Short-circuit with function calls |
| 15 | Short-circuit with assignments |
| 16 | Complex boolean expressions |
| 17 | Short-circuit CFG verification |
| 18 | Short-circuit optimization |
| 19 | De Morgan's law application |
| 20 | Boolean expression simplification |
| 21-50 | Additional short-circuit edge cases |

#### 12.9 Type Coercion (50 tests)

| Test | Description |
|------|-------------|
| 1 | byte → word (ZERO_EXTEND) |
| 2 | word → byte (TRUNCATE) |
| 3 | bool → byte |
| 4 | byte → bool |
| 5 | Implicit coercion detection |
| 6 | Explicit coercion |
| 7 | Coercion in binary ops |
| 8 | Coercion in function calls |
| 9 | Coercion in assignments |
| 10 | Coercion in return statements |
| 11 | Chained coercions |
| 12 | Coercion optimization |
| 13 | Coercion error detection |
| 14 | Coercion warnings |
| 15 | Coercion metadata |
| 16-50 | Additional coercion edge cases |

---

## PHASE 5: Intrinsics (~450 tests)

**Implementation Files**: `intrinsics/registry.ts`  
**Test File**: `intrinsics.test.ts`  
**Phase Documents**: [05-intrinsics.md](05-intrinsics.md), [05a-intrinsics-library.md](05a-intrinsics-library.md)

---

### Test File: `intrinsics.test.ts` (~450 tests)

#### 13.1 Memory Intrinsics (100 tests)

| Test | Description |
|------|-------------|
| 1-25 | peek() with various addresses (ZP, RAM, hardware, ROM) |
| 26-50 | poke() with various addresses and values |
| 51-75 | peekw() word reads (alignment, cross-page, endianness) |
| 76-100 | pokew() word writes (alignment, endianness) |

#### 13.2 @map Access (100 tests)

| Test | Description |
|------|-------------|
| 1-25 | Simple @map variable access |
| 26-50 | @map struct field access |
| 51-75 | @map range indexed access |
| 76-100 | Complex @map hierarchies |

#### 13.3 CPU Intrinsics (80 tests)

| Test | Description |
|------|-------------|
| 1-20 | Interrupt control (sei, cli) |
| 21-40 | Stack operations (pha, pla, php, plp) |
| 41-60 | Timing (nop, cycle counting) |
| 61-80 | Utility (lo, hi, sizeof, length) |

#### 13.4 Optimization Barriers (50 tests)

| Test | Description |
|------|-------------|
| 1-20 | OPT_BARRIER prevents reordering |
| 21-40 | VOLATILE_READ not eliminated |
| 41-50 | VOLATILE_WRITE not eliminated |

#### 13.5 Hardware-Specific (70 tests)

| Test | Description |
|------|-------------|
| 1-20 | VIC-II register access patterns |
| 21-40 | SID register access patterns |
| 41-60 | CIA register access patterns |
| 61-70 | Memory bank switching |

#### 13.6 Intrinsics Extreme Tests (50 tests)

| Test | Description |
|------|-------------|
| 1-10 | All VIC-II registers |
| 11-20 | All SID registers |
| 21-30 | Raster-critical timing |
| 31-40 | Complex hardware interaction |
| 41-50 | Multi-hardware coordination |

---

## PHASE 6: SSA Construction (~280 tests)

**Implementation Files**: `ssa/*.ts`  
**Test File**: `ssa.test.ts`  
**Phase Document**: [06-ssa-construction.md](06-ssa-construction.md)

---

### Test File: `ssa.test.ts` (~280 tests)

#### 14.1 Dominator Tree (50 tests)

| Test | Description |
|------|-------------|
| 1-15 | Simple CFG dominator calculation |
| 16-30 | Complex CFG dominator calculation |
| 31-40 | Edge cases (single block, loops, diamonds) |
| 41-50 | Performance with large CFGs |

#### 14.2 Dominance Frontiers (50 tests)

| Test | Description |
|------|-------------|
| 1-15 | Simple dominance frontier calculation |
| 16-30 | Complex CFG frontiers |
| 31-40 | Loop frontiers |
| 41-50 | Nested structure frontiers |

#### 14.3 Phi Function Placement (60 tests)

| Test | Description |
|------|-------------|
| 1-15 | Single variable phi placement |
| 16-30 | Multiple variable phi placement |
| 31-45 | Loop header phi placement |
| 46-60 | Critical edge handling |

#### 14.4 Variable Renaming (70 tests)

| Test | Description |
|------|-------------|
| 1-20 | Simple variable renaming |
| 21-40 | Complex renaming across loops |
| 41-55 | Phi operand renaming |
| 56-70 | SSA verification after renaming |

#### 14.5 SSA Verification (50 tests)

| Test | Description |
|------|-------------|
| 1-15 | SSA invariant verification |
| 16-30 | Definition dominates use |
| 31-40 | Phi correctness verification |
| 41-50 | Edge case verification |

---

## PHASE 7: IL Optimization (~500 tests)

**Implementation Files**: `optimization/*.ts`  
**Test File**: `optimization.test.ts`  
**Phase Document**: [07-optimizations.md](07-optimizations.md)

---

### Test File: `optimization.test.ts` (~500 tests)

#### 15.1 Dead Code Elimination (80 tests)

| Test | Description |
|------|-------------|
| 1-20 | Simple dead code removal |
| 21-40 | Dead code with dependencies |
| 41-60 | Side effect preservation |
| 61-80 | Volatile preservation |

#### 15.2 Constant Folding (80 tests)

| Test | Description |
|------|-------------|
| 1-20 | Arithmetic constant folding |
| 21-40 | Bitwise constant folding |
| 41-60 | Comparison constant folding |
| 61-80 | Overflow and edge case handling |

#### 15.3 Constant Propagation (80 tests)

| Test | Description |
|------|-------------|
| 1-20 | Simple constant propagation |
| 21-40 | Propagation through phi functions |
| 41-60 | Partial propagation |
| 61-80 | Cross-block propagation |

#### 15.4 Copy Propagation (60 tests)

| Test | Description |
|------|-------------|
| 1-20 | Simple copy propagation |
| 21-40 | Chained copy propagation |
| 41-60 | Register pressure reduction |

#### 15.5 Common Subexpression Elimination (60 tests)

| Test | Description |
|------|-------------|
| 1-20 | Simple CSE |
| 21-40 | Complex expression CSE |
| 41-60 | Hash collision handling |

#### 15.6 6502-Specific Optimizations (80 tests)

| Test | Description |
|------|-------------|
| 1-20 | Strength reduction |
| 21-40 | Zero-page promotion |
| 41-60 | Indexed addressing optimization |
| 61-80 | Bounds elimination |

#### 15.7 Optimization Pipeline (60 tests)

| Test | Description |
|------|-------------|
| 1-20 | Pass ordering effects |
| 21-40 | Fixed-point iteration |
| 41-60 | Performance benchmarks |

---

## PHASE 8: Integration & Testing (~350 tests)

**Implementation Files**: Integration  
**Test File**: `integration.test.ts`  
**Phase Document**: [08-testing.md](08-testing.md)

---

### Test File: `integration.test.ts` (~350 tests)

#### 16.1 End-to-End Pipeline (100 tests)

| Test | Description |
|------|-------------|
| 1-25 | Source → Lexer → Parser → Semantic → IL |
| 26-50 | Simple function generation |
| 51-75 | Complex program generation |
| 76-100 | Multi-module generation |

#### 16.2 Real C64 Patterns (100 tests)

| Test | Description |
|------|-------------|
| 1-20 | VIC-II programming patterns |
| 21-40 | SID music patterns |
| 41-60 | Sprite handling patterns |
| 61-80 | Raster interrupt patterns |
| 81-100 | Game loop patterns |

#### 16.3 Complex Patterns (100 tests)

| Test | Description |
|------|-------------|
| 1-20 | Nested loops with multiple variables |
| 21-40 | Deeply nested control flow |
| 41-60 | State machine patterns |
| 61-80 | Memory manipulation patterns |
| 81-100 | Real-world game patterns |

#### 16.4 Performance Benchmarks (50 tests)

| Test | Description |
|------|-------------|
| 1-10 | 100 LOC < 100ms |
| 11-20 | 500 LOC < 500ms |
| 21-30 | 1000 LOC < 1000ms |
| 31-40 | Memory usage benchmarks |
| 41-50 | Optimization time benchmarks |

---

## Summary: Test Count by Phase

| Phase | Test File(s) | Regular | Extreme | Total |
|-------|--------------|---------|---------|-------|
| **1** | types, values, instructions | 210 | 100 | 310 |
| **2** | basic-block, function, module, builder, validator | 300 | 50 | 350 |
| **3** | generator-base, declarations, statements | 450 | 50 | 500 |
| **4** | generator-expressions | 400 | 0 | 400 |
| **5** | intrinsics | 400 | 50 | 450 |
| **6** | ssa | 280 | 0 | 280 |
| **7** | optimization | 500 | 0 | 500 |
| **8** | integration | 350 | 0 | 350 |
| **TOTAL** | **13 files** | **2,890** | **250** | **~3,140** |

---

## Implementation Order

Implement tests in this order, matching the phase implementation:

1. **Phase 1**: `types.test.ts` → `values.test.ts` → `instructions.test.ts`
2. **Phase 2**: `basic-block.test.ts` → `function.test.ts` → `module.test.ts` → `builder.test.ts` → `validator.test.ts`
3. **Phase 3**: `generator-base.test.ts` → `generator-declarations.test.ts` → `generator-statements.test.ts`
4. **Phase 4**: `generator-expressions.test.ts`
5. **Phase 5**: `intrinsics.test.ts`
6. **Phase 6**: `ssa.test.ts`
7. **Phase 7**: `optimization.test.ts`
8. **Phase 8**: `integration.test.ts`

---

## Quality Checklist (ALL Tests)

Before completing any test file, verify:

- [ ] **Rule 4**: All tests pass
- [ ] **Rule 6**: Maximum coverage achieved
- [ ] **Rule 7**: End-to-end tests included where applicable
- [ ] **Rule 8**: Tests are granular (one behavior per test)
- [ ] **Rule 9**: Complex test logic is commented
- [ ] **Rule 11**: Helper functions have JSDoc
- [ ] **Rule 25**: No mocking real objects
- [ ] **Rule 26**: No `as any` type bypassing
- [ ] **Rule 27**: Complete interface compliance

---

## Document Status

| Document | Status |
|----------|--------|
| `il-generator-comprehensive-test-plan.md` | **SUPERSEDED** - Do not use |
| `00-code-compliance-and-extreme-testing.md` | **SUPERSEDED** - Do not use |
| `IL-GENERATOR-UNIFIED-TEST-PLAN.md` | **ACTIVE** - Single source of truth |

---