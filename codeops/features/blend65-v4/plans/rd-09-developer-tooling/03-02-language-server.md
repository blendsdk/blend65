# Language Server: RD-09 Developer Tooling

> **Document**: 03-02-language-server.md
> **Parent**: [Index](00-index.md)

## Overview

The language server is the production editor protocol surface. It keeps the existing real stdio
transport, push diagnostics, project discovery, frontend-only imports, and supersession model, and
adds versioned document state, explicit query handlers, cancellation, project isolation, and one
bounded project-status notification to the thin VS Code client.

## Architecture

### Current Architecture

`packages/language-server/src/server.ts` is a single 361-line module. It:

- creates a stdio connection and one `TextDocuments` registry (`server.ts:39, 360`);
- maps each open document to the nearest project root and keeps one queue per root
  (`server.ts:41-54, 296-358`);
- loads a `ProjectSnapshot` with `loadProject`, applies open-document overlays, and calls
  `analyzeProjectOverlay` (`server.ts:186-204, 252-255`);
- publishes only `textDocument/publishDiagnostics` and drops superseded results by generation
  (`server.ts:92-106, 182-185, 208-239`);
- converts byte offsets to LSP positions with `byteOffsetToPosition` (`server.ts:109-115`).

It does not track document versions, advertise query capabilities, use request cancellation
tokens, or separate diagnostics from query logic.

### Proposed Changes

Split the server into focused modules under `packages/language-server/src/`:

| Module | Responsibility |
| ------ | -------------- |
| `server.ts` | Connection wiring only: create, register handlers, listen |
| `documents.ts` | URI ↔ source identity, version map, overlay construction, open/close state |
| `projects.ts` | Project contexts, snapshot loading, analysis scheduling, status |
| `diagnostics.ts` | Diagnostic normalization and publication |
| `positions.ts` | Byte ↔ protocol position conversion and range mapping |
| `queries/` | One module per capability family |
| `protocol.ts` | Capability object, custom notification shapes, documented bounds |
| `security.ts` | URI/containment validation, bounded payload helpers |

The split is organizational; there is still one server process, one project model, and one
analysis path.

## Implementation Details

### Document State

```ts
interface OpenDocument {
  readonly uri: string;
  readonly sourceId: string;
  readonly version: number;
  readonly text: string;
}
```

- `didOpen` records the version and text.
- `didChange` uses full synchronization, records the newest version, and rejects a version that is
  not greater than the current one.
- `didClose` removes the document and restores the saved snapshot view.
- The overlay passed to the compiler is still `{ sourceId, text }`; the version is server-local.

### Project Contexts

```ts
interface ProjectContext {
  readonly root: string;
  snapshot: ProjectSnapshot | null;
  analysis: AnalysisResult | null;
  index: ToolingIndex | null;
  generation: number;
  controller: AbortController | null;
  status: ProjectStatus;
  documents: Set<string>;
}
```

- One context per canonical manifest root.
- A document belongs to the nearest containing manifest found by RD-02 discovery.
- A context never reads or publishes another context's source or facts.
- A project-wide operation is scoped to its context root.
- Closing the last document releases the context's analysis and index but keeps no daemon.

### Scheduling

1. A change/open/save/file-watch event increments the context generation and aborts the previous
   controller.
2. A trailing `setImmediate` loads the saved snapshot (or reuses a prefetched one), applies the
   latest open overlays, analyzes once, builds the tooling index, and publishes diagnostics/status.
3. A result is publishable only if its generation is current and its controller is not aborted.
4. Query requests use the current index. If the index is stale for the requested document version,
   the server returns `null`/empty and schedules a refresh; it never answers from an older version.
5. Concurrent project contexts may analyze independently; there is no global serialization.

### Capabilities

`initialize` advertises exactly the implemented surface:

| Capability | Value |
| ---------- | ----- |
| `textDocumentSync` | `openClose: true`, `change: Full`, `save: true` |
| `completionProvider` | trigger characters `.`, `(`, `"`, `;`; `resolveProvider: false` |
| `hoverProvider` | `true` |
| `signatureHelpProvider` | trigger characters `(`, `,` |
| `definitionProvider` | `true` |
| `referencesProvider` | `true` |
| `renameProvider` | `prepareProvider: true` |
| `documentSymbolProvider` | `true` |
| `workspaceSymbolProvider` | `true` |
| `semanticTokensProvider` | fixed legend, full document, no range/on-type |
| `codeActionProvider` | `codeActionKinds: ["quickfix"]` |
| `documentFormattingProvider` | `true` |
| `workspace` | `workspaceFolders.supported: true`, `workspaceFolders.changeNotifications: true` |

No pull-diagnostics, inline-completion, inlay-hint, or range-formatting capability is advertised.

### Query Handlers

| Method | Behavior |
| ------ | -------- |
| `textDocument/completion` | `completionAt` with the current index; maps facts to LSP items; returns `null` when no reliable context exists |
| `textDocument/hover` | `symbolAt` + `hoverAt`; Markdown with a fenced type block and source-first explanation |
| `textDocument/signatureHelp` | `signatureAt`; active parameter from the byte offset; `null` for poisoned/ambiguous calls |
| `textDocument/definition` | `symbolAt`; declaration name span or module header |
| `textDocument/references` | `referencesFor`; includes declaration only when requested |
| `textDocument/prepareRename` | Range + placeholder for an eligible symbol; rejection reason otherwise |
| `textDocument/rename` | `renameEdits`; revalidates every affected document version before returning |
| `textDocument/documentSymbol` | `documentSymbols`; hierarchical `DocumentSymbol[]` |
| `workspace/symbol` | `workspaceSymbols`; 100-result bound |
| `textDocument/semanticTokens/full` | `semanticTokenFacts`; relative encoding |
| `textDocument/codeAction` | Always `[]`; no current diagnostic supplies a proved edit |
| `textDocument/formatting` | Frontend formatter; `null` when syntax-invalid; one full-document edit |

Every handler:

- checks the request's cancellation token before and after index work;
- resolves the document from the server-owned open state;
- returns a bounded empty result on an unknown document or unavailable fact;
- never imports or invokes lowering, optimization, codegen, ACME, packaging, or VICE.

### Custom Status Notification

The server sends `blend65/projectStatus` with:

```ts
interface ProjectStatusNotification {
  readonly kind: "blend65.projectStatus";
  readonly schemaVersion: 1;
  readonly state: "no-project" | "invalid" | "analyzing" | "ready" | "error" | "cancelled";
  readonly projectName: string | null;
  readonly profileId: string | null;
  readonly documentUri: string | null;
}
```

It is sent after analysis, on discovery failure, on close, and on cancellation. It never claims
`ready` for a stale, incomplete, or poisoned result; `incomplete` maps to `analyzing` while a new
analysis is scheduled, otherwise `error`.

### Coordinate Conversion

- Add `positionToByteOffset(text, position)` next to `byteOffsetToPosition` in
  `packages/compiler/src/frontend/positions.ts`.
- Use UTF-16 code units for LSP positions and UTF-8 byte offsets for compiler spans.
- Clamp only to the valid document range; never silently map an out-of-range position into another
  token.
- Handle CRLF, LF, tabs, astral characters, empty files, and EOF.

### Cancellation

- `onRequest` handlers receive the LSP cancellation token; adapt it to an `AbortController`.
- An aborted request returns the protocol-correct empty result, not an error.
- Analysis cancellation aborts the snapshot load and discards the generation.
- The server never holds a request beyond its document version's lifetime.

### Protocol Robustness

- Cap open documents at 256 and total overlay bytes at the existing frontend limit; reject further
  opens with a bounded diagnostic.
- Cap workspace symbols at 100, completion at 200, references at 2,000, and semantic tokens at the
  document byte limit. A cap returns a deterministic prefix; no unbounded array is retained.
- Treat unknown methods, malformed params, absent documents, bad versions, and internal exceptions
  as bounded protocol errors or empty results. Log only a bounded message; never a stack or absolute
  path in a user-visible response.
- The standard LSP library owns message framing and shutdown; the server keeps its existing
  `shutdown`/`exit` behavior.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Unknown/non-file/non-`.blend` URI | Ignore; no context, no diagnostics | AR-5 |
| Open document outside any project | Publish shared `PROJECT_NOT_FOUND` diagnostic; status `no-project` | AR-5 |
| Manifest invalid | Publish project diagnostic; status `invalid` | AR-5 |
| Document version regression | Ignore the change; keep the newest version | AR-5 |
| Stale query after change | Return empty; schedule refresh | AR-5 |
| Query on error-only analysis | Return empty/null; diagnostics remain authoritative | AR-4 |
| Request cancellation | Return protocol empty result; no publication | AR-5 |
| Oversized document/project | Bounded rejection diagnostic; no partial analysis | AR-14 |
| Internal exception | Bounded `InternalError`; no stack/path leak | AR-14 |

## Testing Requirements

- Real-stdio tests for every advertised method.
- Version/stale/cancel tests with a controlled slow analysis.
- Two-project isolation tests.
- Coordinate fixtures for ASCII, two- and three-byte UTF-8, astral characters, tabs, LF, CRLF,
  empty files, and EOF.
- Protocol robustness tests for unknown methods, malformed params, absent documents, bad versions,
  and oversized payloads.
- Existing diagnostics, bundled-library, and canonical-diagnostics suites stay unchanged.
