import { describe, expect, it } from 'vitest';
import { TokenType } from '../../lexer/types.js';
import {
  AstNodeKind,
  ParserDiagnosticCode,
  createParserState,
  parseTokens,
  type ParserOptions,
} from '../../parser/index.js';
import {
  ParserTestHarness,
  createStatefulParser,
  createToken,
  lexSource,
  parseSource,
} from './test-helpers.js';

describe('Parser state bookkeeping', () => {
  it('initializes deterministic defaults via factory helper', () => {
    const state = createParserState();

    expect(state).toMatchObject({
      hasExplicitModule: false,
      hasImplicitModule: false,
      sawMainFunction: false,
      exportedMainCount: 0,
    });
    expect(state.firstExportedMainSpan).toBeUndefined();
  });

  it('returns isolated state objects on each invocation', () => {
    const first = createParserState();
    const second = createParserState();

    expect(first).not.toBe(second);
  });

  it('attaches a fresh parser state per parser instance', () => {
    const parserA = createStatefulParser();
    const parserB = createStatefulParser();

    parserA.exposeState().hasExplicitModule = true;

    expect(parserB.exposeState().hasExplicitModule).toBe(false);
  });

  it('marks explicit modules when declaration parsing is triggered', () => {
    const parser = createStatefulParser([
      createToken(TokenType.MODULE),
      createToken(TokenType.IDENTIFIER, 'demo'),
      createToken(TokenType.EOF),
    ]);

    parser.parseProgram();

    expect(parser.exposeState().hasExplicitModule).toBe(true);
  });
});

describe('Parser declaration helper diagnostics', () => {
  it('emits duplicate module diagnostics on subsequent declarations', () => {
    const result = parseTokens([
      createToken(TokenType.MODULE, 'module'),
      createToken(TokenType.IDENTIFIER, 'first'),
      createToken(TokenType.MODULE, 'module'),
      createToken(TokenType.IDENTIFIER, 'second'),
      createToken(TokenType.EOF),
    ]);

    const duplicate = result.diagnostics.find(
      (diag) => diag.code === ParserDiagnosticCode.DuplicateModuleDeclaration
    );

    expect(duplicate).toBeDefined();
    expect(duplicate?.severity).toBeDefined();
  });

  it('emits missing from clause diagnostics when import lacks source', () => {
    const result = parseTokens([
      createToken(TokenType.IMPORT, 'import'),
      createToken(TokenType.IDENTIFIER, 'foo'),
      createToken(TokenType.EOF),
    ]);

    expect(result.diagnostics.some((diag) => diag.code === ParserDiagnosticCode.MissingFromClause)).toBe(
      true
    );
  });

  it('emits empty import list diagnostics when from appears before bindings', () => {
    const result = parseTokens([
      createToken(TokenType.IMPORT, 'import'),
      createToken(TokenType.FROM, 'from'),
      createToken(TokenType.IDENTIFIER, 'source'),
      createToken(TokenType.EOF),
    ]);

    expect(result.diagnostics.some((diag) => diag.code === ParserDiagnosticCode.EmptyImportList)).toBe(
      true
    );
  });

  it('emits implicit main export diagnostics when function main lacks export', () => {
    const result = parseTokens([
      createToken(TokenType.FUNCTION, 'function'),
      createToken(TokenType.IDENTIFIER, 'main'),
      createToken(TokenType.EOF),
    ]);

    expect(result.diagnostics.some((diag) => diag.code === ParserDiagnosticCode.ImplicitMainExport)).toBe(
      true
    );
  });
});


describe('Parser scaffolding (token level)', () => {
  it('returns an empty program when only EOF is provided', () => {
    const result = parseTokens([createToken(TokenType.EOF)]);

    expect(result.program.kind).toBe(AstNodeKind.Program);
    expect(result.program.body).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('emits diagnostics for unexpected tokens', () => {
    const result = parseTokens([
      createToken(TokenType.IDENTIFIER, 'foo'),
      createToken(TokenType.EOF),
    ]);

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe(ParserDiagnosticCode.MissingDeclarationKeyword);
    expect(result.diagnostics[0].message).toContain('declaration keyword');
  });

  it('recovers after diagnostics and continues parsing', () => {
    const result = parseTokens([
      createToken(TokenType.IDENTIFIER, 'foo'),
      createToken(TokenType.NEWLINE),
      createToken(TokenType.IDENTIFIER, 'bar'),
      createToken(TokenType.EOF),
    ]);

    expect(result.diagnostics).toHaveLength(2);
    expect(result.program.body).toHaveLength(0);
  });

  it('synthesizes an implicit EOF token when none are provided', () => {
    const result = parseTokens([]);

    expect(result.program.body).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('emits missing identifier diagnostics when declaration keyword lacks a name', () => {
    const parser = new ParserTestHarness(
      [createToken(TokenType.MODULE), createToken(TokenType.NEWLINE), createToken(TokenType.EOF)],
      {}
    );
    parser.parseProgram();

    expect(parser.diagnostics).toHaveLength(1);
    expect(parser.diagnostics[0].code).toBe(ParserDiagnosticCode.MissingIdentifier);
  });

  it('emits unexpected EOF diagnostics when declarations miss names', () => {
    const parser = new ParserTestHarness(
      [createToken(TokenType.MODULE), createToken(TokenType.EOF)],
      {}
    );
    parser.parseProgram();

    expect(parser.diagnostics).toHaveLength(1);
    expect(parser.diagnostics[0].code).toBe(ParserDiagnosticCode.UnexpectedEOF);
  });
});

describe('Parser end-to-end behavior (source → lexer → parser)', () => {
  it('parses an empty source file into an empty program', () => {
    const result = parseSource('');

    expect(result.program.body).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.program.span.start.offset).toBe(0);
    expect(result.program.span.end.offset).toBe(0);
  });

  it('skips trivia tokens such as comments and blank lines', () => {
    const source = `// greeting\n/* block comment */\n\n`;
    const result = parseSource(source);

    expect(result.program.body).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('emits diagnostics for unexpected top-level identifiers from real lexer output', () => {
    const result = parseSource('foo');

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe(ParserDiagnosticCode.MissingDeclarationKeyword);
    expect(result.diagnostics[0].message).toContain('declaration keyword');
  });

  it('recovers across newline boundaries without entering infinite loops', () => {
    const result = parseSource('foo\nbar');

    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0].code).toBe(ParserDiagnosticCode.MissingDeclarationKeyword);
    expect(result.diagnostics[1].code).toBe(ParserDiagnosticCode.MissingDeclarationKeyword);
    expect(result.program.body).toHaveLength(0);
  });

  it('synchronizes on declaration keywords such as module', () => {
    const result = parseSource('foo\nmodule\n');

    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0].code).toBe(ParserDiagnosticCode.MissingDeclarationKeyword);
    expect(result.diagnostics[1].code).toBe(ParserDiagnosticCode.MissingIdentifier);
    expect(result.program.body).toHaveLength(0);
  });

  it('computes a program span that covers the entire lexed input', () => {
    const source = 'foo\n';
    const result = parseSource(source);

    expect(result.program.span.start.line).toBe(1);
    expect(result.program.span.start.column).toBe(1);
    expect(result.program.span.end.line).toBe(2);
    expect(result.program.span.end.column).toBe(1);
  });

  it('passes parser options through without mutation', () => {
    const options: ParserOptions = { captureDocComments: true };
    const parser = new ParserTestHarness(lexSource(''), options);

    expect(parser.exposeOptions()).toEqual(options);
  });
});
