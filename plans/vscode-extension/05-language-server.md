# Language Server: LSP Server & Diagnostics

> **Document**: 05-language-server.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete

## Overview

The LSP server is the core engine of the extension. It runs as a separate Node.js process communicating via stdio, imports `@blend65/compiler` to perform lexing, parsing, and semantic analysis, and pushes results back to VS Code as diagnostics, completions, hover info, etc.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ VS Code Extension Host                                           │
│  ┌──────────────┐                                                │
│  │ extension.ts  │──creates──▶ LanguageClient (stdio transport)  │
│  └──────────────┘                    │                           │
└──────────────────────────────────────│───────────────────────────┘
                                  stdio │
┌──────────────────────────────────────│───────────────────────────┐
│ LSP Server Process (server.ts)       │                           │
│  ┌───────────────┐              ┌────▼─────┐                     │
│  │ document-      │◀─events────│ LSP       │                     │
│  │ manager.ts     │            │ Connection │                     │
│  │ (cache AST,    │            └────┬─────┘                     │
│  │  symbols, etc) │                 │                            │
│  └───────┬───────┘                 │ requests                   │
│          │                         │                             │
│  ┌───────▼───────┐    ┌───────────▼────────────┐                │
│  │ diagnostics.ts │    │ completion.ts           │                │
│  │ (Lexer+Parser  │    │ hover.ts                │                │
│  │  +Semantic →   │    │ definition.ts           │                │
│  │  LSP diags)    │    │ signature-help.ts       │                │
│  └───────┬───────┘    │ symbols.ts              │                │
│          │            │ references.ts            │                │
│  ┌───────▼───────┐    │ rename.ts               │                │
│  │ @blend65/     │    │ formatting.ts           │                │
│  │ compiler      │    │ code-actions.ts         │                │
│  │ (bundled)     │    │ semantic-tokens.ts      │                │
│  └───────────────┘    │ folding.ts              │                │
│                       └─────────────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

## Server Initialization (`server.ts`)

### Capabilities Declaration

The server declares which LSP features it supports during the `initialize` handshake:

```typescript
connection.onInitialize((params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: ['.', '@', '"', "'"],
        resolveProvider: true,
      },
      hoverProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ['(', ','],
      },
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      renameProvider: { prepareProvider: true },
      documentFormattingProvider: true,
      codeActionProvider: true,
      foldingRangeProvider: true,
      semanticTokensProvider: {
        legend: semanticTokensLegend,
        full: true,
        delta: false,
      },
    },
  };
});
```

### Document Sync

The server uses **incremental sync** — VS Code sends only the changed portions of the document. The `document-manager.ts` module handles:

1. **`onDidOpen`** — parse document, run semantic analysis, push diagnostics
2. **`onDidChangeContent`** — debounced re-parse (250ms), update cache, push diagnostics
3. **`onDidSave`** — full analysis (including cross-module), push diagnostics
4. **`onDidClose`** — clear diagnostics for document, remove from cache

## Document Manager (`document-manager.ts`)

### Cached Analysis State

For each open document, the manager maintains:

```typescript
interface DocumentState {
  uri: string;                    // Document URI
  version: number;                // Document version (for staleness check)
  source: string;                 // Current document text
  tokens: Token[] | null;         // Cached lexer tokens
  ast: Program | null;            // Cached AST
  symbolTable: SymbolTable | null; // Cached symbol table
  diagnostics: Diagnostic[];      // Current diagnostics
  analysisTimestamp: number;       // When last analyzed
}
```

### Analysis Pipeline

When a document changes:

```
1. Get document text from TextDocuments manager
2. Run Lexer → tokens (catch lexer errors)
3. Run Parser → AST + parse diagnostics (catch parse errors)
4. Run SemanticAnalyzer → AnalysisResult (symbol table, type info, diagnostics)
5. Cache all results in DocumentState
6. Convert compiler Diagnostics → LSP Diagnostics
7. Push LSP diagnostics to client via connection.sendDiagnostics()
```

### Error Resilience

The analysis must **never crash the server**:

```typescript
try {
  const lexer = new Lexer(source, { skipComments: false });
  const tokens = lexer.tokenize();
  // ... parser, semantic ...
} catch (error) {
  // Log error, push a single "internal error" diagnostic
  // Keep previous cached state if available
}
```

If the lexer throws (unterminated string, etc.), the server catches and reports a diagnostic at the error position. The parser's error recovery allows it to produce a partial AST even with syntax errors.

## Diagnostics Mapping (`diagnostics.ts`)

### Compiler → LSP Diagnostic Conversion

```typescript
function mapDiagnostic(compilerDiag: CompilerDiagnostic): LspDiagnostic {
  return {
    severity: mapSeverity(compilerDiag.severity),
    range: {
      start: {
        line: compilerDiag.location.start.line - 1,    // Compiler is 1-indexed
        character: compilerDiag.location.start.column - 1,
      },
      end: {
        line: compilerDiag.location.end.line - 1,
        character: compilerDiag.location.end.column - 1,
      },
    },
    message: compilerDiag.message,
    source: 'blend65',
    code: compilerDiag.code,
  };
}
```

### Severity Mapping

| Compiler Severity | LSP Severity | VS Code Display |
|-------------------|-------------|-----------------|
| `Error` | `DiagnosticSeverity.Error` | Red squiggle |
| `Warning` | `DiagnosticSeverity.Warning` | Yellow squiggle |
| `Info` | `DiagnosticSeverity.Information` | Blue squiggle |
| `Hint` | `DiagnosticSeverity.Hint` | Faded text / dots |

### Position Offset

The compiler uses **1-indexed** lines and columns. LSP uses **0-indexed**. The mapping subtracts 1 from both line and column:

```
Compiler: line=1, column=1 → LSP: line=0, character=0
Compiler: line=5, column=10 → LSP: line=4, character=9
```

### Diagnostic Categories

| Source | Error Examples |
|--------|---------------|
| Lexer | Unexpected character, unterminated string, invalid number literal |
| Parser | Expected semicolon, unexpected token, missing closing brace |
| Semantic | Undeclared variable, type mismatch, wrong argument count, recursion detected |

## Performance Considerations

### Debouncing

Document changes trigger analysis after a **250ms debounce** to avoid running the compiler on every keystroke:

```typescript
let debounceTimer: NodeJS.Timeout | null = null;

documents.onDidChangeContent((change) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    analyzeDocument(change.document);
  }, 250);
});
```

### Target Performance

| Operation | Target Latency | Strategy |
|-----------|---------------|----------|
| Diagnostics on save | < 500ms | Full pipeline |
| Diagnostics on change | < 500ms (debounced) | Debounce 250ms + full pipeline |
| Completion | < 200ms | Use cached symbol table |
| Hover | < 100ms | Use cached symbol table + AST |
| Go-to-definition | < 100ms | Use cached AST node locations |

### Caching Strategy

- **Per-document cache** — AST, tokens, symbol table cached per open document
- **Invalidation** — cache invalidated on document change (version mismatch)
- **Shared type system** — `TypeSystem` instance shared across documents (immutable built-in types)
- **Lazy analysis** — only analyze open documents, not entire workspace
