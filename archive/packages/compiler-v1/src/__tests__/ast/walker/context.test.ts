/**
 * Tests for Context Management (WalkerContext and ContextWalker)
 *
 * Tests Phase 0 Task 0.4: Context-aware walker with scope tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WalkerContext, ContextType, ContextWalker } from '../../../ast/walker/context.js';
import {
  Program,
  ModuleDecl,
  FunctionDecl,
  WhileStatement,
  ForStatement,
  MatchStatement,
  BlockStatement,
  LiteralExpression,
  IdentifierExpression,
  ReturnStatement,
  BreakStatement,
  ExpressionStatement,
} from '../../../ast/nodes.js';
import { ASTNodeType, SourceLocation } from '../../../ast/base.js';

// Test helper: Create source location
function loc(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

describe('WalkerContext', () => {
  let context: WalkerContext;

  beforeEach(() => {
    context = new WalkerContext();
  });

  describe('Basic Context Management', () => {
    it('should start with empty context stack', () => {
      expect(context.getDepth()).toBe(0);
      expect(context.getCurrentContext()).toBeUndefined();
    });

    it('should enter and exit contexts', () => {
      const node = new ModuleDecl(['test'], loc(), true);

      context.enterContext(ContextType.PROGRAM, node);
      expect(context.getDepth()).toBe(1);
      expect(context.getCurrentContext()?.type).toBe(ContextType.PROGRAM);

      const exited = context.exitContext();
      expect(exited?.type).toBe(ContextType.PROGRAM);
      expect(context.getDepth()).toBe(0);
    });

    it('should handle nested contexts', () => {
      const programNode = new ModuleDecl(['test'], loc(), true);
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());

      context.enterContext(ContextType.PROGRAM, programNode);
      context.enterContext(ContextType.FUNCTION, functionNode);

      expect(context.getDepth()).toBe(2);
      expect(context.getCurrentContext()?.type).toBe(ContextType.FUNCTION);

      context.exitContext();
      expect(context.getCurrentContext()?.type).toBe(ContextType.PROGRAM);

      context.exitContext();
      expect(context.getDepth()).toBe(0);
    });

    it('should return undefined when exiting empty stack', () => {
      const exited = context.exitContext();
      expect(exited).toBeUndefined();
    });
  });

  describe('Context Access', () => {
    it('should get current context', () => {
      const node = new ModuleDecl(['test'], loc(), true);
      context.enterContext(ContextType.PROGRAM, node);

      const current = context.getCurrentContext();
      expect(current?.type).toBe(ContextType.PROGRAM);
      expect(current?.node).toBe(node);
    });

    it('should get parent context', () => {
      const programNode = new ModuleDecl(['test'], loc(), true);
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());

      context.enterContext(ContextType.PROGRAM, programNode);
      context.enterContext(ContextType.FUNCTION, functionNode);

      const parent = context.getParentContext();
      expect(parent?.type).toBe(ContextType.PROGRAM);
      expect(parent?.node).toBe(programNode);
    });

    it('should return undefined for parent when only one context', () => {
      const node = new ModuleDecl(['test'], loc(), true);
      context.enterContext(ContextType.PROGRAM, node);

      expect(context.getParentContext()).toBeUndefined();
    });

    it('should get ancestor contexts', () => {
      const programNode = new ModuleDecl(['test'], loc(), true);
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      const loopNode = new WhileStatement(new LiteralExpression(true, loc()), [], loc());

      context.enterContext(ContextType.PROGRAM, programNode);
      context.enterContext(ContextType.FUNCTION, functionNode);
      context.enterContext(ContextType.LOOP, loopNode);

      // Level 1 = parent (function)
      expect(context.getAncestorContext(1)?.type).toBe(ContextType.FUNCTION);
      // Level 2 = grandparent (program)
      expect(context.getAncestorContext(2)?.type).toBe(ContextType.PROGRAM);
      // Level 3 = doesn't exist
      expect(context.getAncestorContext(3)).toBeUndefined();
    });
  });

  describe('Context Finding', () => {
    beforeEach(() => {
      // Setup nested contexts: program → function → loop → block
      const programNode = new ModuleDecl(['test'], loc(), true);
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      const loopNode = new WhileStatement(new LiteralExpression(true, loc()), [], loc());
      const blockNode = new BlockStatement([], loc());

      context.enterContext(ContextType.PROGRAM, programNode);
      context.enterContext(ContextType.FUNCTION, functionNode);
      context.enterContext(ContextType.LOOP, loopNode);
      context.enterContext(ContextType.BLOCK, blockNode);
    });

    it('should find nearest context of specific type', () => {
      const loopCtx = context.findContext(ContextType.LOOP);
      expect(loopCtx?.type).toBe(ContextType.LOOP);

      const functionCtx = context.findContext(ContextType.FUNCTION);
      expect(functionCtx?.type).toBe(ContextType.FUNCTION);

      const programCtx = context.findContext(ContextType.PROGRAM);
      expect(programCtx?.type).toBe(ContextType.PROGRAM);
    });

    it('should return undefined when context type not found', () => {
      const matchCtx = context.findContext(ContextType.MATCH_CASE);
      expect(matchCtx).toBeUndefined();
    });

    it('should find all contexts of specific type', () => {
      // Add another loop
      const innerLoop = new WhileStatement(new LiteralExpression(true, loc()), [], loc());
      context.enterContext(ContextType.LOOP, innerLoop);

      const loops = context.findAllContexts(ContextType.LOOP);
      expect(loops).toHaveLength(2);
      expect(loops[0].type).toBe(ContextType.LOOP);
      expect(loops[1].type).toBe(ContextType.LOOP);
    });

    it('should return empty array when no contexts match', () => {
      const matches = context.findAllContexts(ContextType.MATCH_CASE);
      expect(matches).toHaveLength(0);
    });
  });

  describe('Context Queries', () => {
    it('should check if in specific context type', () => {
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      context.enterContext(ContextType.FUNCTION, functionNode);

      expect(context.isInContext(ContextType.FUNCTION)).toBe(true);
      expect(context.isInContext(ContextType.LOOP)).toBe(false);
    });

    it('should check if in function', () => {
      expect(context.isInFunction()).toBe(false);

      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      context.enterContext(ContextType.FUNCTION, functionNode);

      expect(context.isInFunction()).toBe(true);
    });

    it('should check if in loop', () => {
      expect(context.isInLoop()).toBe(false);

      const loopNode = new WhileStatement(new LiteralExpression(true, loc()), [], loc());
      context.enterContext(ContextType.LOOP, loopNode);

      expect(context.isInLoop()).toBe(true);
    });

    it('should check if in loop without function boundary', () => {
      const loopNode = new WhileStatement(new LiteralExpression(true, loc()), [], loc());

      // Case 1: Loop without function boundary
      context.enterContext(ContextType.LOOP, loopNode);
      expect(context.isInLoopWithoutFunctionBoundary()).toBe(true);

      // Case 2: Function inside loop (still valid)
      context.reset();
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      context.enterContext(ContextType.LOOP, loopNode);
      context.enterContext(ContextType.FUNCTION, functionNode);
      expect(context.isInLoopWithoutFunctionBoundary()).toBe(false);

      // Case 3: Loop inside function (valid)
      context.reset();
      context.enterContext(ContextType.FUNCTION, functionNode);
      context.enterContext(ContextType.LOOP, loopNode);
      expect(context.isInLoopWithoutFunctionBoundary()).toBe(true);
    });

    it('should return false for loop check when no loop', () => {
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      context.enterContext(ContextType.FUNCTION, functionNode);

      expect(context.isInLoop()).toBe(false);
      expect(context.isInLoopWithoutFunctionBoundary()).toBe(false);
    });
  });

  describe('Nesting Levels', () => {
    it('should get correct depth', () => {
      expect(context.getDepth()).toBe(0);

      const programNode = new ModuleDecl(['test'], loc(), true);
      context.enterContext(ContextType.PROGRAM, programNode);
      expect(context.getDepth()).toBe(1);

      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      context.enterContext(ContextType.FUNCTION, functionNode);
      expect(context.getDepth()).toBe(2);
    });

    it('should get nesting level for specific type', () => {
      const loop1 = new WhileStatement(new LiteralExpression(true, loc()), [], loc());
      const loop2 = new WhileStatement(new LiteralExpression(true, loc()), [], loc());

      context.enterContext(ContextType.LOOP, loop1);
      expect(context.getNestingLevel(ContextType.LOOP)).toBe(1);

      context.enterContext(ContextType.LOOP, loop2);
      expect(context.getNestingLevel(ContextType.LOOP)).toBe(2);

      expect(context.getNestingLevel(ContextType.FUNCTION)).toBe(0);
    });
  });

  describe('Metadata Management', () => {
    beforeEach(() => {
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      context.enterContext(ContextType.FUNCTION, functionNode);
    });

    it('should set and get metadata on current context', () => {
      context.setMetadata('returnType', 'word');
      context.setMetadata('hasReturn', false);

      expect(context.getMetadata('returnType')).toBe('word');
      expect(context.getMetadata('hasReturn')).toBe(false);
    });

    it('should return undefined for non-existent metadata', () => {
      expect(context.getMetadata('nonExistent')).toBeUndefined();
    });

    it('should get metadata with type assertion', () => {
      context.setMetadata('returnType', 'word');
      context.setMetadata('count', 42);

      const returnType = context.getMetadataAs<string>('returnType');
      const count = context.getMetadataAs<number>('count');

      expect(returnType).toBe('word');
      expect(count).toBe(42);
    });

    it('should check if metadata exists', () => {
      expect(context.hasMetadata('returnType')).toBe(false);

      context.setMetadata('returnType', 'word');
      expect(context.hasMetadata('returnType')).toBe(true);
    });

    it('should set metadata on specific context type', () => {
      const loopNode = new WhileStatement(new LiteralExpression(true, loc()), [], loc());
      context.enterContext(ContextType.LOOP, loopNode);

      // Set on function context (not current loop context)
      context.setMetadataOn(ContextType.FUNCTION, 'hasReturn', true);

      // Current loop context shouldn't have it
      expect(context.getMetadata('hasReturn')).toBeUndefined();

      // But function context should
      expect(context.getMetadataFrom(ContextType.FUNCTION, 'hasReturn')).toBe(true);
    });

    it('should get metadata from specific context type', () => {
      context.setMetadata('functionData', 'test');

      const loopNode = new WhileStatement(new LiteralExpression(true, loc()), [], loc());
      context.enterContext(ContextType.LOOP, loopNode);
      context.setMetadata('loopData', 'loop');

      // Get from function context
      expect(context.getMetadataFrom(ContextType.FUNCTION, 'functionData')).toBe('test');
      // Get from current loop context
      expect(context.getMetadata('loopData')).toBe('loop');
    });

    it('should get metadata from specific context with type assertion', () => {
      context.setMetadata('count', 42);

      const count = context.getMetadataFromAs<number>(ContextType.FUNCTION, 'count');
      expect(count).toBe(42);
    });

    it('should handle metadata on non-existent context type', () => {
      context.setMetadataOn(ContextType.MATCH_CASE, 'test', 'value');
      expect(context.getMetadataFrom(ContextType.MATCH_CASE, 'test')).toBeUndefined();
    });

    it('should isolate metadata between contexts', () => {
      context.setMetadata('data', 'function');

      const loopNode = new WhileStatement(new LiteralExpression(true, loc()), [], loc());
      context.enterContext(ContextType.LOOP, loopNode);
      context.setMetadata('data', 'loop');

      // Current context has loop data
      expect(context.getMetadata('data')).toBe('loop');
      // Function context still has function data
      expect(context.getMetadataFrom(ContextType.FUNCTION, 'data')).toBe('function');
    });
  });

  describe('Stack Operations', () => {
    it('should reset all contexts', () => {
      const node1 = new ModuleDecl(['test'], loc(), true);
      const node2 = new FunctionDecl('test', [], 'void', [], loc());

      context.enterContext(ContextType.PROGRAM, node1);
      context.enterContext(ContextType.FUNCTION, node2);
      expect(context.getDepth()).toBe(2);

      context.reset();
      expect(context.getDepth()).toBe(0);
      expect(context.getCurrentContext()).toBeUndefined();
    });

    it('should get stack snapshot', () => {
      const programNode = new ModuleDecl(['test'], loc(), true);
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      const loopNode = new WhileStatement(new LiteralExpression(true, loc()), [], loc());

      context.enterContext(ContextType.PROGRAM, programNode);
      context.enterContext(ContextType.FUNCTION, functionNode);
      context.enterContext(ContextType.LOOP, loopNode);

      const stack = context.getStack();
      expect(stack).toEqual(['program', 'function', 'loop']);
    });

    it('should get detailed stack snapshot', () => {
      const functionNode = new FunctionDecl('test', [], 'void', [], loc());
      context.enterContext(ContextType.FUNCTION, functionNode);
      context.setMetadata('returnType', 'word');

      const detailed = context.getDetailedStack();
      expect(detailed).toHaveLength(1);
      expect(detailed[0].type).toBe('function');
      expect(detailed[0].nodeType).toBe(ASTNodeType.FUNCTION_DECL);
      expect(detailed[0].metadata.returnType).toBe('word');
    });
  });
});

describe('ContextWalker', () => {
  /**
   * Test walker that collects context information during traversal
   */
  class TestContextWalker extends ContextWalker {
    public contextLog: string[] = [];
    public metadataLog: Array<{ type: string; metadata: Record<string, unknown> }> = [];

    visitFunctionDecl(node: FunctionDecl): void {
      this.contextLog.push(`enter:function:${node.getName()}`);

      // Manually enter context and set metadata (before visiting body)
      this.context.enterContext(ContextType.FUNCTION, node);
      this.context.setMetadata('returnType', node.getReturnType());

      // Visit body statements
      for (const stmt of node.getBody()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }

      // Exit context
      this.context.exitContext();
      this.contextLog.push(`exit:function:${node.getName()}`);
    }

    visitWhileStatement(node: WhileStatement): void {
      this.contextLog.push('enter:loop:while');
      super.visitWhileStatement(node);
      this.contextLog.push('exit:loop:while');
    }

    visitForStatement(node: ForStatement): void {
      this.contextLog.push('enter:loop:for');
      super.visitForStatement(node);
      this.contextLog.push('exit:loop:for');
    }

    visitBreakStatement(node: BreakStatement): void {
      const inLoop = this.context.isInLoopWithoutFunctionBoundary();
      this.contextLog.push(`break:inLoop=${inLoop}`);
      super.visitBreakStatement(node);
    }

    visitReturnStatement(node: ReturnStatement): void {
      const inFunction = this.context.isInFunction();
      const returnType = this.context.getMetadataFrom(ContextType.FUNCTION, 'returnType');
      this.contextLog.push(`return:inFunction=${inFunction}:type=${returnType}`);
      super.visitReturnStatement(node);
    }
  }

  describe('Automatic Context Management', () => {
    it('should automatically manage program context', () => {
      const walker = new TestContextWalker();
      const program = new Program(new ModuleDecl(['test'], loc(), true), [], loc());

      walker.walk(program);

      // Context should be reset after walk
      expect(walker.context.getDepth()).toBe(0);
    });

    it('should automatically manage function context', () => {
      const walker = new TestContextWalker();
      const func = new FunctionDecl(
        'testFunc',
        [],
        'word',
        [new ReturnStatement(new LiteralExpression(42, loc()), loc())],
        loc(),
        false,
        false
      );

      const program = new Program(new ModuleDecl(['test'], loc(), true), [func], loc());

      walker.walk(program);

      expect(walker.contextLog).toContain('enter:function:testFunc');
      expect(walker.contextLog).toContain('return:inFunction=true:type=word');
      expect(walker.contextLog).toContain('exit:function:testFunc');
    });

    it('should automatically manage loop context', () => {
      const walker = new TestContextWalker();
      const loop = new WhileStatement(
        new LiteralExpression(true, loc()),
        [new BreakStatement(loc())],
        loc()
      );

      const func = new FunctionDecl('test', [], 'void', [loop], loc());
      const program = new Program(new ModuleDecl(['test'], loc(), true), [func], loc());

      walker.walk(program);

      expect(walker.contextLog).toContain('enter:loop:while');
      expect(walker.contextLog).toContain('break:inLoop=true');
      expect(walker.contextLog).toContain('exit:loop:while');
    });

    it('should detect break outside loop', () => {
      const walker = new TestContextWalker();
      const func = new FunctionDecl(
        'test',
        [],
        'void',
        [new BreakStatement(loc())],
        loc(),
        false,
        false
      );

      const program = new Program(new ModuleDecl(['test'], loc(), true), [func], loc());

      walker.walk(program);

      expect(walker.contextLog).toContain('break:inLoop=false');
    });

    it('should handle nested loops', () => {
      const walker = new TestContextWalker();
      const innerLoop = new WhileStatement(
        new LiteralExpression(true, loc()),
        [new BreakStatement(loc())],
        loc()
      );
      // ForStatement(variable, variableType, start, end, direction, step, body, location)
      const outerLoop = new ForStatement(
        'i',
        null,
        new LiteralExpression(0, loc()),
        new LiteralExpression(10, loc()),
        'to',
        null,
        [innerLoop],
        loc()
      );

      const func = new FunctionDecl('test', [], 'void', [outerLoop], loc());
      const program = new Program(new ModuleDecl(['test'], loc(), true), [func], loc());

      walker.walk(program);

      expect(walker.contextLog).toContain('enter:loop:for');
      expect(walker.contextLog).toContain('enter:loop:while');
      expect(walker.contextLog).toContain('break:inLoop=true');
      expect(walker.contextLog).toContain('exit:loop:while');
      expect(walker.contextLog).toContain('exit:loop:for');
    });

    it('should detect break crossing function boundary', () => {
      const walker = new TestContextWalker();

      // Break inside nested function inside loop (invalid)
      const nestedFunc = new FunctionDecl(
        'nested',
        [],
        'void',
        [new BreakStatement(loc())],
        loc(),
        false,
        false
      );

      const loop = new WhileStatement(
        new LiteralExpression(true, loc()),
        [new ExpressionStatement(new IdentifierExpression('dummy', loc()), loc())],
        loc()
      );

      const outerFunc = new FunctionDecl('outer', [], 'void', [loop], loc());

      // We'll need to manually trigger the nested function visit
      // This is a limitation of the test - in real usage, nested functions
      // would be declarations, not statements
      const program = new Program(
        new ModuleDecl(['test'], loc(), true),
        [outerFunc, nestedFunc],
        loc()
      );

      walker.walk(program);

      // When walking nestedFunc separately, break should be outside loop
      const breakLogs = walker.contextLog.filter(log => log.startsWith('break:'));
      expect(breakLogs.some(log => log.includes('inLoop=false'))).toBe(true);
    });
  });

  describe('Metadata Propagation', () => {
    it('should propagate metadata through contexts', () => {
      class MetadataWalker extends ContextWalker {
        public results: Array<{ name: string; returnType: string | null }> = [];

        visitFunctionDecl(node: FunctionDecl): void {
          // Manually enter context and set metadata
          this.context.enterContext(ContextType.FUNCTION, node);
          this.context.setMetadata('returnType', node.getReturnType());

          // Visit body
          for (const stmt of node.getBody()) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }

          // Exit context
          this.context.exitContext();
        }

        visitReturnStatement(node: ReturnStatement): void {
          const returnType = this.context.getMetadataFromAs<string>(
            ContextType.FUNCTION,
            'returnType'
          );
          const functionCtx = this.context.findContext(ContextType.FUNCTION);
          const functionNode = functionCtx?.node as FunctionDecl;

          this.results.push({
            name: functionNode?.getName() || 'unknown',
            returnType: returnType || null,
          });

          super.visitReturnStatement(node);
        }
      }

      const walker = new MetadataWalker();
      const func1 = new FunctionDecl(
        'getWord',
        [],
        'word',
        [new ReturnStatement(new LiteralExpression(42, loc()), loc())],
        loc(),
        false,
        false
      );
      const func2 = new FunctionDecl(
        'getByte',
        [],
        'byte',
        [new ReturnStatement(new LiteralExpression(10, loc()), loc())],
        loc(),
        false,
        false
      );

      const program = new Program(new ModuleDecl(['test'], loc(), true), [func1, func2], loc());

      walker.walk(program);

      expect(walker.results).toHaveLength(2);
      expect(walker.results[0]).toEqual({ name: 'getWord', returnType: 'word' });
      expect(walker.results[1]).toEqual({ name: 'getByte', returnType: 'byte' });
    });
  });

  describe('Complex Context Scenarios', () => {
    it('should handle match statement contexts', () => {
      class MatchWalker extends ContextWalker {
        public contextLog: string[] = [];

        visitMatchStatement(node: MatchStatement): void {
          this.contextLog.push('enter:match');
          super.visitMatchStatement(node);
          this.contextLog.push('exit:match');
        }

        visitBreakStatement(node: BreakStatement): void {
          const inLoop = this.context.isInLoopWithoutFunctionBoundary();
          const inMatch = this.context.isInContext(ContextType.MATCH_CASE);
          this.contextLog.push(`break:inLoop=${inLoop}:inMatch=${inMatch}`);
          super.visitBreakStatement(node);
        }
      }

      const walker = new MatchWalker();
      const match = new MatchStatement(
        new IdentifierExpression('value', loc()),
        [
          {
            value: new LiteralExpression(1, loc()),
            body: [new BreakStatement(loc())],
            location: loc(),
          },
        ],
        null,
        loc()
      );

      const func = new FunctionDecl('test', [], 'void', [match], loc());
      const program = new Program(new ModuleDecl(['test'], loc(), true), [func], loc());

      walker.walk(program);

      expect(walker.contextLog).toContain('enter:match');
      expect(walker.contextLog).toContain('break:inLoop=true:inMatch=true');
      expect(walker.contextLog).toContain('exit:match');
    });

    it('should handle block statement contexts', () => {
      class BlockWalker extends ContextWalker {
        public blockDepth: number = 0;
        public maxDepth: number = 0;

        visitBlockStatement(node: BlockStatement): void {
          // Enter context first, then check nesting level
          this.context.enterContext(ContextType.BLOCK, node);
          this.blockDepth = this.context.getNestingLevel(ContextType.BLOCK);
          this.maxDepth = Math.max(this.maxDepth, this.blockDepth);

          // Visit statements
          for (const stmt of node.getStatements()) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }

          // Exit context
          this.context.exitContext();
        }
      }

      const walker = new BlockWalker();
      const innerBlock = new BlockStatement([], loc());
      const outerBlock = new BlockStatement([innerBlock], loc());

      const func = new FunctionDecl('test', [], 'void', [outerBlock], loc());
      const program = new Program(new ModuleDecl(['test'], loc(), true), [func], loc());

      walker.walk(program);

      expect(walker.maxDepth).toBe(2); // Two nested blocks
    });
  });

  describe('Context Reset', () => {
    it('should reset context between walk calls', () => {
      const walker = new TestContextWalker();
      const func = new FunctionDecl('test', [], 'void', [], loc());
      const program = new Program(new ModuleDecl(['test'], loc(), true), [func], loc());

      walker.walk(program);
      expect(walker.context.getDepth()).toBe(0);

      walker.walk(program);
      expect(walker.context.getDepth()).toBe(0);
    });

    it('should clear metadata between walks', () => {
      class MetadataCheckWalker extends ContextWalker {
        public metadataFound: boolean = false;

        visitFunctionDecl(node: FunctionDecl): void {
          // Check if metadata from previous walk exists (it shouldn't)
          if (this.context.hasMetadata('previousRun')) {
            this.metadataFound = true;
          }

          this.context.setMetadata('previousRun', true);
          super.visitFunctionDecl(node);
        }
      }

      const walker = new MetadataCheckWalker();
      const func = new FunctionDecl('test', [], 'void', [], loc());
      const program = new Program(new ModuleDecl(['test'], loc(), true), [func], loc());

      walker.walk(program);
      expect(walker.metadataFound).toBe(false);

      walker.walk(program);
      expect(walker.metadataFound).toBe(false); // Should still be false
    });
  });
});