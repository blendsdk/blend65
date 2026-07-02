# RD-14: VS Code Extension & Language Server

> **Status**: 🟢 Authored
> **MVP Phase**: B
> **Depends On**: RD-03, RD-04
> **Implements**: `spec-v3.0` Ch 01 (lexical structure → syntax highlighting),
>   Ch 14 (diagnostics → squiggles); AR-14, AR-15, AR-40, AR-41, AR-72, AR-78
> **Owning package(s)**: `@blend65/language-server`, `@blend65/vscode`
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

---

## 1. Purpose

This document specifies the **VS Code extension** (`@blend65/vscode`) and the
**Language Server** (`@blend65/language-server`) that together deliver the developer
experience for Blend65 in Visual Studio Code. AR-14 mandates a **full LSP** — not just
syntax highlighting, but diagnostics (squiggles), completion, hover, and go-to-definition
— as a non-negotiable DX goal.

The language server is the Phase B payoff of every Phase A architecture decision that
was made "LSP-ready": the error-tolerant, library-first frontend (AR-15), the
`CompilerHost` buffer-overlay abstraction (AR-40), the structured `Diagnostic` record
with byte-offset spans and on-demand UTF-16 column conversion (AR-71/72), the
accumulating `DiagnosticBag` (AR-73), and the library-first compiler API returning
`Diagnostic[]` (AR-77). This RD specifies how those capabilities are wired into an
LSP server and VS Code extension.

---

## 2. Scope

**In scope:**

- VS Code extension packaging and activation
- TextMate grammar for syntax highlighting (tokenization)
- Language server: LSP protocol implementation
- LSP capabilities: diagnostics, completion, hover, go-to-definition, document symbols
- `CompilerHost` LSP implementation (open-buffer overlay + disk fallback, AR-40)
- Debounced whole-program recompilation strategy (AR-41)
- Span → LSP position conversion (byte offsets → UTF-16 line/column, AR-72)
- Extension configuration settings

**Out of scope (and where it lives instead):**

- The error-tolerant frontend itself → RD-02 (lexer), RD-03 (parser), RD-04 (semantic)
- Diagnostic engine and `DiagnosticBag` → RD-11
- `SourceMap`, `LineMap`, `SourceSpan` → RD-11
- Compiler configuration (`blend65.json`) → RD-16
- Build/compile commands (the extension does NOT invoke ACME or produce binaries) → RD-15
- Debugger / debug adapter → future (not in v3 scope)
- Code formatting / refactoring → future
- Incremental parsing / caching → future (AR-41: deferred past MVP)

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Extension Architecture

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Two-package architecture | The VS Code extension (`@blend65/vscode`) is the client; the language server (`@blend65/language-server`) is a separate Node process communicating via LSP JSON-RPC over stdio. The extension bundles the server | AR-20 |
| R2 | The language server depends only on frontend + core | `@blend65/language-server` imports from `@blend65/frontend` and `@blend65/core`. It does NOT depend on `@blend65/codegen`, `@blend65/compiler`, or `@blend65/cli` — this is the load-bearing frontend/backend boundary | AR-20 |
| R3 | The extension activates on `.blend` files | Activation events: `onLanguage:blend65`, plus workspace contains `blend65.json`. No eager activation | Design |
| R4 | The extension registers the `blend65` language ID | File associations: `*.blend` → `blend65` language. Icon: optional, not required for MVP | Design |

### 3.2 Syntax Highlighting

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R5 | TextMate grammar provides syntax highlighting | A `.tmLanguage.json` grammar defines token scopes for Blend65 syntax. This runs in the VS Code renderer (no server round-trip needed for highlighting) | Ch 01 |
| R6 | Highlighted elements include all Ch 01 lexical categories | Keywords (32), operators, numeric literals (decimal/hex/binary), string literals, char literals, comments (single-line `//` and block `/* */`), identifiers, type names, function names, module names | Ch 01, F021 |
| R7 | Contextual keywords are highlighted as keywords when in context | `to`, `downto`, `until`, `step` are highlighted as keywords only in `for`-loop headers. Outside that context they are identifiers. The TextMate grammar uses match patterns for this | Ch 01 §1.3 |
| R8 | String escape sequences are highlighted distinctly | `\n`, `\t`, `\\`, `\'`, `\"`, `\0`, `\xHH` within string/char literals receive `constant.character.escape` scope | Ch 01 §1.7 |

### 3.3 LSP Capabilities — Diagnostics

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R9 | Real-time diagnostics (squiggles) | On every document change (debounced), the server runs the frontend pipeline (lex → parse → semantic) and publishes diagnostics to the client as `textDocument/publishDiagnostics` notifications | AR-14, AR-15 |
| R10 | Diagnostics map to LSP severity | `Diagnostic.severity: 'error'` → `DiagnosticSeverity.Error`; `'warning'` → `DiagnosticSeverity.Warning`. ICE diagnostics (`E9xxxx`) → `DiagnosticSeverity.Error` | AR-71 |
| R11 | Diagnostic spans convert to LSP positions | `SourceSpan` byte offsets are converted to LSP `Position` (0-based line, UTF-16 column) using `LineMap.getUtf16Column()` (AR-72). Multi-line spans produce a `Range` | AR-72 |
| R12 | Diagnostic codes are included | Each published diagnostic carries the `E10xxx`/`W10xxx` code as the `Diagnostic.code` field, enabling "search for error code" workflows | AR-70 |
| R13 | Related information is included | `Diagnostic.secondarySpans` map to LSP `DiagnosticRelatedInformation[]` with location + message | AR-71 |
| R14 | Multi-file diagnostics are supported | Diagnostics from all files in the workspace are published. Each diagnostic targets the correct document URI via `SourceMap.getPath()` | AR-39 |

### 3.4 LSP Capabilities — Completion

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R15 | Identifier completion from the scope chain | At the cursor position, the server resolves the enclosing scope (function/block/module/global) and offers all visible symbols as completion items | AR-14 |
| R16 | Completion item kinds | Variables → `Variable`, constants → `Constant`, functions → `Function`, structs → `Struct`, enums → `Enum`, enum members → `EnumMember`, modules → `Module`, intrinsics → `Function` (with detail "intrinsic") | Design |
| R17 | Keyword completion | All 32 keywords are offered as `CompletionItemKind.Keyword` when the parser context allows a statement or declaration start | Ch 01 |
| R18 | Type name completion | In type-annotation positions (after `:`), the server offers type names: `byte`, `sbyte`, `word`, `sword`, `bool`, `void`, plus user-defined struct and enum names | Ch 02 |
| R19 | Module-qualified completion | After typing `ModuleName.`, the server offers the module's exported symbols | Ch 10 §2 |
| R20 | Intrinsic completion | Core intrinsics (T1–T3, ambient) are always offered. Platform intrinsics (T4) are offered only if the corresponding import is present | AR-31 |
| R21 | Signature help on function calls | When typing `functionName(`, the server provides `signatureHelp` showing the function's parameter names and types | AR-14 |

### 3.5 LSP Capabilities — Hover

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R22 | Hover shows type information | Hovering over a variable shows its type (`let x: byte`). Hovering over a function shows its full signature. Hovering over a struct field shows the field type and containing struct | AR-14 |
| R23 | Hover shows intrinsic documentation | Hovering over an intrinsic name shows the intrinsic's signature, tier, description, and cost metadata (cycles/bytes) from the descriptor registry (AR-29) | AR-14, AR-29 |
| R24 | Hover shows enum values | Hovering over an enum member shows its resolved numeric value | Ch 09 |
| R25 | Hover shows constant values | Hovering over a `const` shows its compile-time-evaluated value | Ch 03 §3 |
| R26 | Hover content is Markdown | Hover responses use Markdown for formatting: code blocks for signatures, bold for type names | Design |

### 3.6 LSP Capabilities — Go-to-Definition

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R27 | Go-to-definition for local variables | Navigates to the `let`/`const` declaration | AR-14 |
| R28 | Go-to-definition for functions | Navigates to the `function` declaration | AR-14 |
| R29 | Go-to-definition for struct types | Navigates to the `struct` declaration | AR-14 |
| R30 | Go-to-definition for enum types and members | Navigates to the `enum` declaration or specific member | AR-14 |
| R31 | Go-to-definition for module-qualified names | `Module.name` navigates to the declaration of `name` in the target module's source file | Ch 10 §2, AR-14 |
| R32 | Go-to-definition for imports | Navigating to an imported name goes to its declaration in the source module | Ch 10 §2.1 |
| R33 | Intrinsics have no definition location | Core intrinsics (T1–T3) are ambient — go-to-definition returns no result. A hover (R23) provides documentation instead | AR-31 |

### 3.7 LSP Capabilities — Document Symbols

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R34 | Document symbols show the outline | The outline view shows modules, functions, structs, enums, and module-level variables/constants declared in the current file | AR-14 |
| R35 | Symbol kinds match the declaration type | Functions → `SymbolKind.Function`, structs → `SymbolKind.Struct`, enums → `SymbolKind.Enum`, variables → `SymbolKind.Variable`, constants → `SymbolKind.Constant`, modules → `SymbolKind.Module` | Design |

### 3.8 CompilerHost — LSP Implementation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R36 | LSP `CompilerHost` uses an open-buffer overlay | For files open in the editor, the server uses the in-memory buffer content (including unsaved changes). For files not open, it falls back to reading from disk | AR-40 |
| R37 | Buffer overlay is updated on `textDocument/didChange` | The server tracks open documents and their current content via LSP lifecycle notifications (`didOpen`, `didChange`, `didClose`) | AR-40 |
| R38 | File discovery uses the same logic as the CLI | The LSP `CompilerHost` discovers `.blend` files using the same strategy as the CLI: `blend65.json` `include` globs → default `**/*.blend` from the workspace root | AR-39 |

### 3.9 Recompilation Strategy

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R39 | Full whole-program reparse on every change | The server re-runs the complete frontend pipeline (lex all files → parse → semantic) on every document change. No incremental parsing | AR-41 |
| R40 | Recompilation is debounced | Changes are debounced with a ~200 ms delay (configurable). Rapid typing does not trigger a recompile per keystroke | AR-41 |
| R41 | Recompilation runs only the frontend | The server runs lex → parse → semantic analysis (and optionally SFA for resource info). It does NOT run IL lowering, codegen, or ACME. The frontend is sufficient for diagnostics, completion, hover, and navigation | AR-20, AR-78 |
| R42 | Diagnostics are cleared and re-published after each recompile | The server publishes the complete diagnostic set for each file after every recompile. Previously published diagnostics are replaced, not accumulated | AR-73 |
| R43 | Compilation does not block LSP protocol handling | The recompilation runs asynchronously. The server remains responsive to cancellation and new change notifications during compilation | Design |

### 3.10 Extension Configuration

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R44 | Extension exposes configuration settings | Settings under `blend65.*` in VS Code settings: `blend65.acmePath` (path to ACME, for future build task), `blend65.maxErrors` (maps to `--max-errors`), `blend65.debounceMs` (recompilation debounce delay) | AR-62, AR-73 |
| R45 | Extension configuration is optional | All settings have sensible defaults. The extension works without any configuration for pure editing/diagnostics | Design |

---

## 4. Design Detail

### 4.1 Package Structure

```
packages/
├── @blend65/language-server/
│   ├── src/
│   │   ├── server.ts           — LSP server entry point (createConnection, listen)
│   │   ├── lsp-compiler-host.ts — CompilerHost implementation (buffer overlay + disk)
│   │   ├── capabilities.ts     — Capability registration (diagnostics, completion, hover, etc.)
│   │   ├── diagnostics.ts      — Diagnostic → LSP Diagnostic conversion
│   │   ├── completion.ts       — textDocument/completion handler
│   │   ├── hover.ts            — textDocument/hover handler
│   │   ├── definition.ts       — textDocument/definition handler
│   │   ├── symbols.ts          — textDocument/documentSymbol handler
│   │   └── debounce.ts         — Debounced recompilation scheduler
│   └── package.json            — deps: @blend65/frontend, @blend65/core
│
└── @blend65/vscode/
    ├── src/
    │   └── extension.ts        — Activate/deactivate, spawn language server
    ├── syntaxes/
    │   └── blend65.tmLanguage.json — TextMate grammar
    ├── language-configuration.json — Brackets, comments, auto-closing pairs
    └── package.json            — VS Code extension manifest (contributes, activationEvents)
```

### 4.2 LSP Server Lifecycle

```typescript
// server.ts — entry point
import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: ['.'] },
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      signatureHelpProvider: { triggerCharacters: ['(', ','] },
    },
  };
});

// Debounced recompilation on document changes
documents.onDidChangeContent((change) => {
  scheduleRecompilation(change.document);
});

documents.listen(connection);
connection.listen();
```

### 4.3 LSP CompilerHost (Buffer Overlay)

```typescript
import { CompilerHost } from '@blend65/frontend';

/**
 * CompilerHost for the language server.
 * Open editor buffers take priority over disk; closed files fall back to disk.
 */
class LspCompilerHost implements CompilerHost {
  private openDocuments: Map<string, string>;  // URI → content

  constructor(private workspaceRoot: string) {
    this.openDocuments = new Map();
  }

  /** Update buffer content on didChange */
  updateDocument(uri: string, content: string): void {
    this.openDocuments.set(uri, content);
  }

  /** Remove buffer on didClose */
  closeDocument(uri: string): void {
    this.openDocuments.delete(uri);
  }

  /** Read file: open buffer → disk fallback */
  readFile(path: string): string | undefined {
    const uri = pathToUri(path);
    if (this.openDocuments.has(uri)) {
      return this.openDocuments.get(uri);
    }
    // Fall back to disk
    return readFileFromDisk(path);
  }

  /** List .blend files in the workspace */
  listSourceFiles(): string[] {
    // Uses blend65.json include globs or default **/*.blend
    return discoverBlendFiles(this.workspaceRoot);
  }
}
```

### 4.4 Diagnostic Conversion

```typescript
import { Diagnostic as BlendDiagnostic, SourceSpan } from '@blend65/core';
import { Diagnostic as LspDiagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';

function toLspDiagnostic(
  diag: BlendDiagnostic,
  sourceMap: SourceMap
): LspDiagnostic {
  const range = spanToRange(diag.primarySpan, sourceMap);
  return {
    range,
    severity: diag.severity === 'error'
      ? DiagnosticSeverity.Error
      : DiagnosticSeverity.Warning,
    code: diag.code,
    source: 'blend65',
    message: diag.message,
    relatedInformation: diag.secondarySpans.map(s => ({
      location: {
        uri: sourceMap.getPath(s.span.sourceId),
        range: spanToRange(s.span, sourceMap),
      },
      message: s.label,
    })),
  };
}

/** Convert SourceSpan to LSP Range using UTF-16 columns */
function spanToRange(span: SourceSpan | null, sourceMap: SourceMap): Range {
  if (!span) {
    return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  }
  const lineMap = sourceMap.getLineMap(span.sourceId);
  const startLC = lineMap.getLineCol(span.start);
  const endLC = lineMap.getLineCol(span.end);
  return {
    start: {
      line: startLC.line - 1,           // LSP is 0-based
      character: lineMap.getUtf16Column(span.start),
    },
    end: {
      line: endLC.line - 1,
      character: lineMap.getUtf16Column(span.end),
    },
  };
}
```

### 4.5 Debounced Recompilation

```typescript
const DEFAULT_DEBOUNCE_MS = 200;

class RecompilationScheduler {
  private timer: NodeJS.Timeout | null = null;
  private debounceMs: number;

  constructor(
    private host: LspCompilerHost,
    private connection: Connection,
    debounceMs?: number,
  ) {
    this.debounceMs = debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  /** Schedule a recompilation (debounced) */
  schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), this.debounceMs);
  }

  private run(): void {
    // Run the complete frontend pipeline
    const result = compileFrontend(this.host);

    // Group diagnostics by file and publish
    const byFile = groupDiagnosticsByFile(result.diagnostics, result.sourceMap);
    for (const [uri, diags] of byFile) {
      this.connection.sendDiagnostics({
        uri,
        diagnostics: diags.map(d => toLspDiagnostic(d, result.sourceMap)),
      });
    }

    // Clear diagnostics for files that no longer have any
    for (const previousUri of this.previousFiles) {
      if (!byFile.has(previousUri)) {
        this.connection.sendDiagnostics({ uri: previousUri, diagnostics: [] });
      }
    }
    this.previousFiles = new Set(byFile.keys());
  }
}
```

### 4.6 TextMate Grammar (Sketch)

```jsonc
// blend65.tmLanguage.json (abbreviated)
{
  "scopeName": "source.blend65",
  "patterns": [
    { "include": "#comments" },
    { "include": "#strings" },
    { "include": "#numbers" },
    { "include": "#keywords" },
    { "include": "#types" },
    { "include": "#identifiers" }
  ],
  "repository": {
    "keywords": {
      "match": "\\b(module|import|from|export|function|let|const|var|if|else|while|do|for|switch|case|default|break|continue|return|struct|enum|as|interrupt|asm|zeropage|fallthrough|true|false)\\b",
      "name": "keyword.control.blend65"
    },
    "types": {
      "match": "\\b(byte|sbyte|word|sword|bool|void)\\b",
      "name": "storage.type.blend65"
    },
    "comments": {
      "patterns": [
        { "name": "comment.line.double-slash.blend65",
          "match": "//.*$" },
        { "name": "comment.block.blend65",
          "begin": "/\\*", "end": "\\*/" }
      ]
    },
    "strings": {
      "patterns": [
        { "name": "string.quoted.double.blend65",
          "begin": "\"", "end": "\"",
          "patterns": [
            { "name": "constant.character.escape.blend65",
              "match": "\\\\[ntr0'\"\\\\]|\\\\x[0-9a-fA-F]{2}" }
          ]
        },
        { "name": "string.quoted.single.blend65",
          "begin": "'", "end": "'",
          "patterns": [
            { "name": "constant.character.escape.blend65",
              "match": "\\\\[ntr0'\"\\\\]|\\\\x[0-9a-fA-F]{2}" }
          ]
        }
      ]
    },
    "numbers": {
      "patterns": [
        { "name": "constant.numeric.hex.blend65",
          "match": "(?:0x|\\$)[0-9a-fA-F][0-9a-fA-F_]*" },
        { "name": "constant.numeric.binary.blend65",
          "match": "0b[01][01_]*" },
        { "name": "constant.numeric.decimal.blend65",
          "match": "\\b[0-9][0-9_]*\\b" }
      ]
    }
  }
}
```

### 4.7 Extension Manifest (Sketch)

```jsonc
// package.json for @blend65/vscode
{
  "name": "blend65",
  "displayName": "Blend65",
  "description": "Blend65 language support for VS Code",
  "version": "0.1.0",
  "publisher": "blendsdk",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Programming Languages"],
  "activationEvents": [
    "onLanguage:blend65",
    "workspaceContains:**/blend65.json"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "languages": [{
      "id": "blend65",
      "aliases": ["Blend65", "blend65"],
      "extensions": [".blend"],
      "configuration": "./language-configuration.json"
    }],
    "grammars": [{
      "language": "blend65",
      "scopeName": "source.blend65",
      "path": "./syntaxes/blend65.tmLanguage.json"
    }],
    "configuration": {
      "title": "Blend65",
      "properties": {
        "blend65.acmePath": {
          "type": "string",
          "default": "",
          "description": "Path to the ACME assembler executable"
        },
        "blend65.maxErrors": {
          "type": "number",
          "default": 20,
          "description": "Maximum number of errors to report"
        },
        "blend65.debounceMs": {
          "type": "number",
          "default": 200,
          "description": "Debounce delay (ms) before recompilation"
        }
      }
    }
  }
}
```

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | **Package structure**: `@blend65/language-server` and `@blend65/vscode` are two of the 10 packages; the load-bearing boundary forbids `language-server` → `codegen` |
| RD-02 | **Consumer**: the server invokes the lexer to tokenize all source files |
| RD-03 | **Consumer**: the server invokes the parser to produce ASTs; uses the AST node model for completion/hover/navigation |
| RD-04 | **Consumer**: the server invokes semantic analysis to get the `SemanticModel` (symbol table, types, call graph); this is the primary data source for hover, completion, and go-to-def |
| RD-11 | **Consumer**: the server consumes `Diagnostic[]` from the `DiagnosticBag` and `SourceSpan` → LSP `Position` conversion via `LineMap.getUtf16Column()` |
| RD-13 | **Constrained by**: LSP reparse latency target < 250ms (R2), no compiler-internal jargon in diagnostics (R16) |
| RD-15 | **Boundary**: the CLI and the LSP are two separate consumers of the same library-first frontend API (AR-77). The extension does NOT invoke the CLI |
| RD-16 | **Consumer**: the server reads `blend65.json` for file discovery globs and platform selection |
| RD-17 | **Consumer**: the server uses the intrinsic descriptor registry (AR-29) for completion and hover on intrinsic names |

---

## 6. Acceptance Criteria

- [ ] AC-01: The VS Code extension activates when a `.blend` file is opened
- [ ] AC-02: Syntax highlighting correctly colorizes keywords, types, literals, comments,
      strings, and operators per Ch 01
- [ ] AC-03: Contextual keywords (`to`, `downto`, `until`, `step`) are highlighted as
      keywords in `for`-loop context and as identifiers elsewhere
- [ ] AC-04: Diagnostics (squiggles) appear within ~200ms of stopping typing
- [ ] AC-05: Diagnostic locations are correct (spans point to the right source text)
- [ ] AC-06: Multi-file diagnostics work: an error in `module A` caused by an import
      from `module B` shows the error in the correct file
- [ ] AC-07: Completion offers variables, functions, structs, enums, modules, intrinsics,
      and keywords appropriate to the cursor context
- [ ] AC-08: Module-qualified completion works: typing `Module.` offers that module's exports
- [ ] AC-09: Hover on a variable shows its type; hover on a function shows its signature
- [ ] AC-10: Hover on an intrinsic shows its signature, description, and cost metadata
- [ ] AC-11: Go-to-definition navigates to the declaration for variables, functions,
      structs, enums, and imports (including cross-file)
- [ ] AC-12: Document symbols (outline) shows modules, functions, structs, enums, and
      module-level declarations
- [ ] AC-13: The language server does NOT depend on `@blend65/codegen` (package boundary)
- [ ] AC-14: Unsaved editor changes are used for diagnostics (buffer overlay, not just disk)
- [ ] AC-15: Extension configuration settings (`acmePath`, `maxErrors`, `debounceMs`) are
      read and applied
- [ ] AC-16: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

None.
