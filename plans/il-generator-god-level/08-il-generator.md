# IL Generator: Beyond God-Level IL Generator

> **Document**: 08-il-generator.md
> **Parent**: [Index](00-index.md)

---

## Overview

The **ILGenerator** transforms the AST into IL instructions using slot-centric operands. It orchestrates the entire generation process.

---

## Class Design

```typescript
import { FunctionDecl, VariableDecl, Program } from '../ast/declarations.js';
import { Expression, Statement } from '../ast/base.js';
import { Frame } from '../frame/allocator/frame-calculator.js';
import { FrameSlot } from '../frame/types.js';
import { SlotLocation } from '../frame/enums.js';
import { SymbolTable } from '../semantic/symbol-table.js';
import { ILBuilder } from './builder.js';
import { ILProgram, ILFunction, ILLoop, createILFunction } from './types.js';

/**
 * Generates IL from AST with full SFA context.
 */
export class ILGenerator {
  /** IL instruction builder */
  protected builder: ILBuilder;
  
  /** Frame map from SFA */
  protected frameMap: Map<string, Frame>;
  
  /** Symbol table for lookups */
  protected symbolTable: SymbolTable;
  
  /** Current function being generated */
  protected currentFunction: string | null = null;
  
  /** Current loop depth (for hot path hints) */
  protected currentLoopDepth: number = 0;
  
  /** Detected loops in current function */
  protected loops: ILLoop[] = [];
  
  /** Max loop depth in current function */
  protected maxLoopDepth: number = 0;

  constructor(frameMap: Map<string, Frame>, symbolTable: SymbolTable) {
    this.builder = new ILBuilder();
    this.frameMap = frameMap;
    this.symbolTable = symbolTable;
  }

  // ═══════════════════════════════════════════════════════════════
  // Main Entry Point
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate IL for entire program.
   */
  generate(program: Program): ILProgram {
    const functions: ILFunction[] = [];
    const globalInit: ILInstruction[] = [];

    for (const decl of program.getDeclarations()) {
      if (isFunctionDecl(decl)) {
        // Skip stubs (no body)
        if (!decl.isStubFunction()) {
          functions.push(this.generateFunction(decl));
        }
      } else if (isVariableDecl(decl)) {
        // Global variable initialization
        this.generateGlobalInit(decl, globalInit);
      }
    }

    return {
      moduleName: program.getName(),
      functions,
      globalInit,
      entryPoint: 'main',
      instructionCount: this.countInstructions(functions, globalInit),
      totalEstimatedCycles: this.sumCycles(functions, globalInit),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Function Generation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate IL for a function.
   */
  protected generateFunction(func: FunctionDecl): ILFunction {
    this.currentFunction = func.getName();
    this.builder.clear();
    this.loops = [];
    this.currentLoopDepth = 0;
    this.maxLoopDepth = 0;

    const frame = this.frameMap.get(func.getName());
    if (!frame) {
      throw new Error(`No frame for function: ${func.getName()}`);
    }

    // Generate body
    const body = func.getBody();
    if (body) {
      for (const stmt of body) {
        this.generateStatement(stmt);
      }
    }

    // Ensure return for void functions
    const returnType = func.getReturnType();
    if (returnType === 'void' || !returnType) {
      this.builder.return_();
    }

    return createILFunction(func.getName(), frame, {
      instructions: this.builder.getInstructions(),
      loops: this.loops,
      maxLoopDepth: this.maxLoopDepth,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Statement Generation
  // ═══════════════════════════════════════════════════════════════

  protected generateStatement(stmt: Statement): void {
    if (isVariableDecl(stmt)) {
      this.generateVariableDecl(stmt);
    } else if (isIfStatement(stmt)) {
      this.generateIf(stmt);
    } else if (isWhileStatement(stmt)) {
      this.generateWhile(stmt);
    } else if (isForStatement(stmt)) {
      this.generateFor(stmt);
    } else if (isReturnStatement(stmt)) {
      this.generateReturn(stmt);
    } else if (isExpressionStatement(stmt)) {
      this.generateExpression(stmt.expression);
    } else if (isBlockStatement(stmt)) {
      for (const s of stmt.getStatements()) {
        this.generateStatement(s);
      }
    }
  }

  protected generateVariableDecl(decl: VariableDecl): void {
    if (decl.getInitializer()) {
      this.generateExpression(decl.getInitializer());
      const slot = this.resolveVariable(decl.getName());
      this.builder.storeSlot(slot, `let ${decl.getName()}`);
    }
  }

  protected generateIf(stmt: IfStatement): void {
    const elseLabel = this.builder.newLabel('else');
    const endLabel = this.builder.newLabel('endif');
    const hasElse = stmt.getElseBranch() !== null;

    this.generateExpression(stmt.getCondition());
    this.builder.cmpImm(0);
    this.builder.jumpEq(hasElse ? elseLabel : endLabel);

    // Then branch
    for (const s of stmt.getThenBranch()) {
      this.generateStatement(s);
    }

    if (hasElse) {
      this.builder.jump(endLabel);
      this.builder.label(elseLabel);
      for (const s of stmt.getElseBranch()) {
        this.generateStatement(s);
      }
    }

    this.builder.label(endLabel);
  }

  protected generateWhile(stmt: WhileStatement): void {
    const loopLabel = this.builder.newLabel('while');
    const exitLabel = this.builder.newLabel('endwhile');

    this.builder.label(loopLabel);
    this.currentLoopDepth++;
    this.maxLoopDepth = Math.max(this.maxLoopDepth, this.currentLoopDepth);

    this.generateExpression(stmt.getCondition());
    this.builder.cmpImm(0);
    this.builder.jumpEq(exitLabel);

    for (const s of stmt.getBody()) {
      this.generateStatement(s);
    }

    this.builder.jump(loopLabel);
    this.builder.label(exitLabel);
    this.currentLoopDepth--;

    this.loops.push({
      headerLabel: loopLabel,
      exitLabel: exitLabel,
      depth: this.currentLoopDepth + 1,
      isCountedLoop: false,
    });
  }

  protected generateFor(stmt: ForStatement): void {
    const loopLabel = this.builder.newLabel('for');
    const exitLabel = this.builder.newLabel('endfor');

    // Initializer
    if (stmt.getInitializer()) {
      this.generateStatement(stmt.getInitializer());
    }

    this.builder.label(loopLabel);
    this.currentLoopDepth++;
    this.maxLoopDepth = Math.max(this.maxLoopDepth, this.currentLoopDepth);

    // Condition
    if (stmt.getCondition()) {
      this.generateExpression(stmt.getCondition());
      this.builder.cmpImm(0);
      this.builder.jumpEq(exitLabel);
    }

    // Body
    for (const s of stmt.getBody()) {
      this.generateStatement(s);
    }

    // Update
    if (stmt.getUpdate()) {
      this.generateExpression(stmt.getUpdate());
    }

    this.builder.jump(loopLabel);
    this.builder.label(exitLabel);
    this.currentLoopDepth--;

    // Analyze for counted loop info
    const loopInfo = this.analyzeForLoop(stmt);
    this.loops.push({
      headerLabel: loopLabel,
      exitLabel: exitLabel,
      depth: this.currentLoopDepth + 1,
      isCountedLoop: loopInfo?.isCounted ?? false,
      counterSlot: loopInfo?.counterSlot,
      boundValue: loopInfo?.boundValue,
      estimatedIterations: loopInfo?.boundValue,
    });
  }

  protected generateReturn(stmt: ReturnStatement): void {
    if (stmt.getValue()) {
      this.generateExpression(stmt.getValue());
      const frame = this.frameMap.get(this.currentFunction!);
      const returnSlot = frame?.slots.find(s => s.name === '__return');
      if (returnSlot) {
        this.builder.storeSlot(returnSlot);
      }
    }
    this.builder.return_();
  }

  // ═══════════════════════════════════════════════════════════════
  // Expression Generation
  // ═══════════════════════════════════════════════════════════════

  protected generateExpression(expr: Expression): void {
    if (isLiteralExpr(expr)) {
      this.builder.loadImm(expr.getValue() as number);
    } else if (isIdentifierExpr(expr)) {
      this.generateIdentifier(expr);
    } else if (isBinaryExpr(expr)) {
      this.generateBinary(expr);
    } else if (isUnaryExpr(expr)) {
      this.generateUnary(expr);
    } else if (isCallExpr(expr)) {
      this.generateCall(expr);
    } else if (isAssignmentExpr(expr)) {
      this.generateAssignment(expr);
    }
  }

  protected generateIdentifier(expr: IdentifierExpr): void {
    const slot = this.resolveVariable(expr.getName());
    
    // Register parameter - no memory load needed!
    if (slot.location === SlotLocation.Register) {
      if (slot.register === 'X') {
        this.builder.transferXA();
      } else if (slot.register === 'Y') {
        this.builder.transferYA();
      }
      // 'A' already in accumulator
      return;
    }
    
    // Memory slot
    this.builder.loadSlot(slot, `load ${expr.getName()}`);
  }

  protected generateBinary(expr: BinaryExpr): void {
    // Generate left operand
    this.generateExpression(expr.getLeft());
    
    const right = expr.getRight();
    const op = expr.getOperator();
    
    // Optimize: immediate right operand
    if (isLiteralExpr(right)) {
      const value = right.getValue() as number;
      switch (op) {
        case '+': this.builder.addImm(value); return;
        case '-': this.builder.subImm(value); return;
        case '&': this.builder.emit(ILOpcode.AND_IMM, [createImmediateOperand(value)]); return;
        case '|': this.builder.emit(ILOpcode.OR_IMM, [createImmediateOperand(value)]); return;
        case '^': this.builder.emit(ILOpcode.XOR_IMM, [createImmediateOperand(value)]); return;
      }
    }
    
    // Optimize: slot right operand
    if (isIdentifierExpr(right)) {
      const slot = this.resolveVariable(right.getName());
      switch (op) {
        case '+': this.builder.addSlot(slot); return;
        case '-': this.builder.subSlot(slot); return;
        case '&': this.builder.andSlot(slot); return;
        case '|': this.builder.orSlot(slot); return;
        case '^': this.builder.xorSlot(slot); return;
      }
    }
    
    // Complex right operand - need temp storage
    // Save left to stack, generate right, then operate
    this.builder.emit(ILOpcode.PUSH_A, []);
    this.generateExpression(right);
    // A now has right value, stack has left
    // Need to swap - this is where 6502 gets tricky
    // For now, use a temp slot if available
  }

  protected generateUnary(expr: UnaryExpr): void {
    this.generateExpression(expr.getOperand());
    switch (expr.getOperator()) {
      case '-': 
        // Negate: 0 - value
        this.builder.emit(ILOpcode.PUSH_A, []);
        this.builder.loadImm(0);
        this.builder.emit(ILOpcode.POP_A, []); // TODO: fix logic
        break;
      case '!':
      case '~':
        this.builder.not();
        break;
    }
  }

  protected generateCall(expr: CallExpr): void {
    const funcName = expr.getCallee().getName();
    const calleeFrame = this.frameMap.get(funcName);
    
    if (!calleeFrame) {
      // Intrinsic or external
      this.generateIntrinsic(funcName, expr.getArguments());
      return;
    }

    // Generate arguments
    const args = expr.getArguments();
    for (let i = 0; i < args.length; i++) {
      const paramSlot = calleeFrame.slots[i];
      
      this.generateExpression(args[i]);
      
      if (paramSlot.location === SlotLocation.Register) {
        if (paramSlot.register === 'X') {
          this.builder.transferAX();
        } else if (paramSlot.register === 'Y') {
          this.builder.transferAY();
        }
      } else {
        this.builder.storeSlot(paramSlot);
      }
    }

    this.builder.call(funcName, calleeFrame.isCallback, calleeFrame.coalesceGroup);

    // Load return value if needed
    const returnSlot = calleeFrame.slots.find(s => s.name === '__return');
    if (returnSlot) {
      this.builder.loadSlot(returnSlot);
    }
  }

  protected generateAssignment(expr: AssignmentExpr): void {
    this.generateExpression(expr.getValue());
    const slot = this.resolveVariable(expr.getTarget().getName());
    this.builder.storeSlot(slot, `${expr.getTarget().getName()} =`);
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  protected resolveVariable(name: string): FrameSlot {
    const frame = this.frameMap.get(this.currentFunction!);
    if (!frame) throw new Error(`No frame for: ${this.currentFunction}`);
    const slot = frame.slots.find(s => s.name === name);
    if (!slot) throw new Error(`Unknown variable: ${name}`);
    return slot;
  }

  protected generateIntrinsic(name: string, args: Expression[]): void {
    switch (name) {
      case 'peek':
        this.generateExpression(args[0]);
        this.builder.emit(ILOpcode.PEEK, []);
        break;
      case 'poke':
        // TODO: Handle two operands
        break;
      // Add more intrinsics...
    }
  }

  protected analyzeForLoop(stmt: ForStatement): CountedLoopInfo | null {
    // Simplified detection - expand as needed
    return null;
  }
}
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Slot-centric operands | Full SFA context preserved |
| Register param detection | Avoid memory round-trips |
| Loop structure tracking | Enable loop optimizations |
| Immediate optimization | Faster code for constants |

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [07-il-builder.md](07-il-builder.md) | Builder used |
| [04-slot-integration.md](04-slot-integration.md) | Slot flow |
| [09-testing-strategy.md](09-testing-strategy.md) | How to test |