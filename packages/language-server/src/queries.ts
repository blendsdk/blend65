import { readdir, realpath } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import {
  byteOffsetToPosition,
  completionAt,
  documentSymbols,
  formatBlend65,
  hoverAt,
  positionToByteOffset,
  referencesFor,
  renameEdits,
  semanticTokenFacts,
  signatureAt,
  symbolAt,
  workspaceSymbols,
} from "@blend65/compiler/frontend";
import type {
  CompletionFact,
  DocumentSymbolFact,
  SourceSpan,
  ToolingIndex,
  ToolingSymbol,
} from "@blend65/compiler/frontend";
import { CompletionItemKind, MarkupKind, SymbolKind } from "vscode-languageserver/node";
import type {
  CancellationToken,
  CodeActionParams,
  CompletionItem,
  Connection,
  DefinitionParams,
  DocumentSymbol,
  DocumentSymbolParams,
  Hover,
  HoverParams,
  Location,
  PrepareRenameParams,
  ReferenceParams,
  RenameParams,
  SemanticTokens,
  SemanticTokensParams,
  SignatureHelp,
  SignatureHelpParams,
  SymbolInformation,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
  WorkspaceSymbolParams,
} from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { ContextStore, ProjectContext } from "./contexts.js";

/** Standard semantic-token legend exposed by initialize. */
export const SEMANTIC_TOKEN_TYPES = Object.freeze([
  "namespace",
  "type",
  "struct",
  "enum",
  "function",
  "parameter",
  "variable",
  "property",
  "keyword",
  "string",
  "number",
  "operator",
]);

/** Standard semantic-token modifier legend exposed by initialize. */
export const SEMANTIC_TOKEN_MODIFIERS = Object.freeze([
  "declaration",
  "readonly",
  "static",
  "modification",
]);

/** List bounded asset-path candidates for one `embed("...")` cursor. */
async function assetPathCandidates(
  context: ProjectContext,
  document: TextDocument,
  offset: number,
): Promise<CompletionFact[]> {
  const before = Buffer.from(document.getText(), "utf8").subarray(0, offset).toString("utf8");
  const match = /\bembed\s*\(\s*"([^"]*)$/u.exec(before);
  if (match === null) return [];
  const sourceId = context.documentSources.get(document.uri);
  if (sourceId === undefined) return [];
  let projectRoot: string;
  try {
    projectRoot = await realpath(context.snapshot.projectRoot);
  } catch {
    return [];
  }
  const sourceDir = dirname(join(projectRoot, sourceId));
  const typed = match[1]!;
  const typedDir = typed.includes("/") ? typed.slice(0, typed.lastIndexOf("/") + 1) : "";
  const bases = [
    sourceDir,
    ...context.snapshot.manifest.assetPaths.map((path) => join(projectRoot, path)),
  ];
  const facts: CompletionFact[] = [];
  const seen = new Set<string>();
  for (const base of bases) {
    let directory: string;
    try {
      directory = await realpath(join(base, typedDir));
    } catch {
      continue;
    }
    if (directory !== projectRoot && !directory.startsWith(projectRoot + sep)) continue;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isSymbolicLink()) continue;
      if (!entry.isFile() && !entry.isDirectory()) continue;
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      facts.push({
        label: entry.name,
        kind: "asset-path",
        detail: entry.isDirectory() ? "asset directory" : "asset path",
        sortText: `5:${entry.name}`,
      });
      if (facts.length >= 200) return facts;
    }
  }
  return facts;
}

/** Return the exact text for one compiler source identity. */
function sourceText(context: ProjectContext, sourceId: string): string {
  return context.result.inputs.sources.find((source) => source.sourceId === sourceId)?.text ?? "";
}

/** Return the canonical file URI for one compiler source identity. */
function sourceUri(context: ProjectContext, sourceId: string): string | null {
  const source = context.result.inputs.sources.find((candidate) => candidate.sourceId === sourceId);
  return source === undefined ? null : pathToFileURL(source.resolvedPath).href;
}

/** Convert one compiler byte span to an LSP range. */
function rangeFor(context: ProjectContext, span: SourceSpan) {
  const text = sourceText(context, span.sourceId);
  return {
    start: byteOffsetToPosition(text, span.start),
    end: byteOffsetToPosition(text, span.end),
  };
}

/** Convert one compiler byte span to a definition location. */
function locationFor(context: ProjectContext, span: SourceSpan): Location | null {
  const uri = sourceUri(context, span.sourceId);
  if (uri === null) return null;
  return { uri, range: rangeFor(context, span) };
}

/** Return the current analyzed context for one document, or null when stale. */
function currentContext(
  documents: TextDocuments<TextDocument>,
  contexts: ContextStore,
  projectRootFor: (uri: string) => string | undefined,
  uri: string,
): { context: ProjectContext; document: TextDocument } | null {
  const root = projectRootFor(uri);
  if (root === undefined) return null;
  const context = contexts.get(root);
  const document = documents.get(uri);
  if (context === undefined || document === undefined || context.index === null) return null;
  if (context.analyzedVersions.get(uri) !== document.version) return null;
  return { context, document };
}

/** Convert one document position to a UTF-8 byte offset, or null when invalid. */
function offsetOf(
  document: TextDocument,
  position: { line: number; character: number },
): number | null {
  try {
    return positionToByteOffset(document.getText(), position);
  } catch {
    return null;
  }
}

/** Return the source identity for an open document. */
function sourceIdOf(context: ProjectContext, uri: string): string | null {
  return context.documentSources.get(uri) ?? null;
}

/** Look up one source symbol for richer completion kinds. */
function symbolFor(index: ToolingIndex, id: string | undefined): ToolingSymbol | null {
  return id === undefined ? null : (index.symbols.find((symbol) => symbol.id === id) ?? null);
}

/** Map one completion fact to the protocol item kind. */
function completionKind(index: ToolingIndex, fact: CompletionFact): CompletionItemKind {
  const symbol = symbolFor(index, fact.symbolId);
  if (symbol !== null) {
    switch (symbol.kind) {
      case "module":
        return CompletionItemKind.Module;
      case "function":
        return CompletionItemKind.Function;
      case "struct":
        return CompletionItemKind.Struct;
      case "enum":
        return CompletionItemKind.Enum;
      case "field":
        return CompletionItemKind.Field;
      case "constant":
        return CompletionItemKind.Constant;
      case "parameter":
      case "local":
      case "variable":
        return CompletionItemKind.Variable;
    }
  }
  switch (fact.kind) {
    case "keyword":
      return CompletionItemKind.Keyword;
    case "type":
      return CompletionItemKind.TypeParameter;
    case "profile":
      return CompletionItemKind.Function;
    case "region":
      return CompletionItemKind.Constant;
    case "asset-path":
      return CompletionItemKind.File;
    case "symbol":
      return CompletionItemKind.Variable;
  }
}

/** Map one debug/tooling symbol kind to a protocol symbol kind. */
function symbolKindOf(kind: ToolingSymbol["kind"]): SymbolKind {
  switch (kind) {
    case "module":
      return SymbolKind.Namespace;
    case "function":
      return SymbolKind.Function;
    case "struct":
      return SymbolKind.Struct;
    case "enum":
      return SymbolKind.Enum;
    case "field":
      return SymbolKind.Field;
    case "constant":
      return SymbolKind.Constant;
    case "parameter":
      return SymbolKind.Variable;
    case "local":
    case "variable":
      return SymbolKind.Variable;
  }
}

/** Convert one document symbol fact to the protocol tree. */
function documentSymbol(context: ProjectContext, fact: DocumentSymbolFact): DocumentSymbol {
  const symbol =
    context.index?.symbols.find(
      ({ name, kind, nameSpan }) =>
        name === fact.name &&
        kind === fact.kind &&
        nameSpan.start === fact.selectionSpan.start &&
        nameSpan.sourceId === fact.selectionSpan.sourceId,
    ) ?? null;
  const children = fact.children?.map((child) => documentSymbol(context, child));
  return {
    name: fact.name,
    kind: symbol === null ? SymbolKind.Variable : symbolKindOf(symbol.kind),
    range: rangeFor(context, fact.span),
    selectionRange: rangeFor(context, fact.selectionSpan),
    ...(children === undefined || children.length === 0 ? {} : { children }),
  };
}

/** Register every bounded editor query handler on one connection. */
export function registerQueryHandlers(
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  contexts: ContextStore,
  projectRootFor: (uri: string) => string | undefined,
): void {
  connection.onCompletion(async (params, token: CancellationToken) => {
    const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
    if (current === null || token.isCancellationRequested) return null;
    const sourceId = sourceIdOf(current.context, params.textDocument.uri);
    const offset = offsetOf(current.document, params.position);
    if (sourceId === null || offset === null) return null;
    const assets = await assetPathCandidates(current.context, current.document, offset);
    if (token.isCancellationRequested) return null;
    if (assets.length > 0) {
      return {
        isIncomplete: false,
        items: assets.map((fact) => ({
          label: fact.label,
          kind: CompletionItemKind.File,
          detail: fact.detail,
          sortText: fact.sortText,
          insertText: fact.label,
        })),
      };
    }
    const facts = completionAt(current.context.index!, sourceId, offset, {});
    if (token.isCancellationRequested) return null;
    const items: CompletionItem[] = facts.map((fact) => ({
      label: fact.label,
      kind: completionKind(current.context.index!, fact),
      detail: fact.detail,
      ...(fact.documentation === undefined ? {} : { documentation: fact.documentation }),
      sortText: fact.sortText,
      insertText: fact.label,
      ...(fact.symbolId === undefined ? {} : { data: { symbolId: fact.symbolId } }),
    }));
    return { isIncomplete: false, items };
  });

  connection.onHover(async (params: HoverParams, token: CancellationToken) => {
    const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
    if (current === null || token.isCancellationRequested) return null;
    const sourceId = sourceIdOf(current.context, params.textDocument.uri);
    const offset = offsetOf(current.document, params.position);
    if (sourceId === null || offset === null) return null;
    const symbol = symbolAt(current.context.index!, { sourceId, offset });
    if (symbol === null) return null;
    const fact = hoverAt(current.context.index!, symbol.id);
    if (fact.markdown.length === 0 || token.isCancellationRequested) return null;
    return {
      contents: { kind: MarkupKind.Markdown, value: fact.markdown },
      range: rangeFor(current.context, fact.span),
    } satisfies Hover;
  });

  connection.onSignatureHelp(async (params: SignatureHelpParams, token: CancellationToken) => {
    const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
    if (current === null || token.isCancellationRequested) return null;
    const sourceId = sourceIdOf(current.context, params.textDocument.uri);
    const offset = offsetOf(current.document, params.position);
    if (sourceId === null || offset === null) return null;
    const fact = signatureAt(current.context.index!, sourceId, offset);
    if (fact === null || token.isCancellationRequested) return null;
    return {
      signatures: [
        {
          label: `fn(${fact.parameters.map(({ type }) => type).join(", ")}): ${fact.returnType}`,
          parameters: fact.parameters.map((parameter) => ({
            label:
              parameter.name.length === 0 ? parameter.type : `${parameter.name}: ${parameter.type}`,
          })),
        },
      ],
      activeSignature: 0,
      activeParameter: fact.activeParameter,
    } satisfies SignatureHelp;
  });

  connection.onDefinition(async (params: DefinitionParams, token: CancellationToken) => {
    const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
    if (current === null || token.isCancellationRequested) return null;
    const sourceId = sourceIdOf(current.context, params.textDocument.uri);
    const offset = offsetOf(current.document, params.position);
    if (sourceId === null || offset === null) return null;
    const symbol = symbolAt(current.context.index!, { sourceId, offset });
    if (symbol === null) return null;
    const location = locationFor(current.context, symbol.nameSpan);
    return location === null ? null : [location];
  });

  connection.onReferences(async (params: ReferenceParams, token: CancellationToken) => {
    const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
    if (current === null || token.isCancellationRequested) return null;
    const sourceId = sourceIdOf(current.context, params.textDocument.uri);
    const offset = offsetOf(current.document, params.position);
    if (sourceId === null || offset === null) return null;
    const symbol = symbolAt(current.context.index!, { sourceId, offset });
    if (symbol === null) return null;
    const locations = referencesFor(
      current.context.index!,
      symbol.id,
      params.context.includeDeclaration,
    )
      .map((span) => locationFor(current.context, span))
      .filter((location): location is Location => location !== null);
    return token.isCancellationRequested ? null : locations;
  });

  connection.onPrepareRename(async (params: PrepareRenameParams, token: CancellationToken) => {
    const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
    if (current === null || token.isCancellationRequested) return null;
    const sourceId = sourceIdOf(current.context, params.textDocument.uri);
    const offset = offsetOf(current.document, params.position);
    if (sourceId === null || offset === null) return null;
    const symbol = symbolAt(current.context.index!, { sourceId, offset });
    if (symbol === null) return null;
    const renamable =
      symbol.binding !== null ||
      symbol.kind === "field" ||
      (symbol.kind === "constant" && symbol.parentId !== undefined);
    const source = current.context.index!.sources.find(
      ({ sourceId: candidate }) => candidate === symbol.nameSpan.sourceId,
    );
    if (!renamable || source === undefined || source.installed) return null;
    return { range: rangeFor(current.context, symbol.nameSpan), placeholder: symbol.name };
  });

  connection.onRenameRequest(async (params: RenameParams, token: CancellationToken) => {
    const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
    if (current === null || token.isCancellationRequested) return null;
    const sourceId = sourceIdOf(current.context, params.textDocument.uri);
    const offset = offsetOf(current.document, params.position);
    if (sourceId === null || offset === null) return null;
    const symbol = symbolAt(current.context.index!, { sourceId, offset });
    if (symbol === null) return null;
    const result = renameEdits(current.context.index!, symbol.id, params.newName);
    if (result.kind !== "edits" || token.isCancellationRequested) return null;
    const changes: Record<string, TextEdit[]> = {};
    for (const edit of result.edits) {
      const uri = sourceUri(current.context, edit.sourceId);
      if (uri === null) return null;
      const path = fileURLToPath(uri);
      const root = current.context.snapshot.projectRoot;
      if (path !== root && !path.startsWith(root + sep)) return null;
      const open = [...current.context.documentSources].find(
        ([documentUri, source]) => documentUri === uri && source === edit.sourceId,
      );
      if (open !== undefined) {
        const document = documents.get(open[0]);
        if (
          document === undefined ||
          current.context.analyzedVersions.get(open[0]) !== document.version
        ) {
          return null;
        }
      }
      (changes[uri] ??= []).push({
        range: rangeFor(current.context, edit.span),
        newText: edit.newText,
      });
    }
    return { changes } satisfies WorkspaceEdit;
  });

  connection.onDocumentSymbol(async (params: DocumentSymbolParams, token: CancellationToken) => {
    const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
    if (current === null || token.isCancellationRequested) return null;
    const sourceId = sourceIdOf(current.context, params.textDocument.uri);
    if (sourceId === null) return null;
    return documentSymbols(current.context.index!, sourceId).map((fact) =>
      documentSymbol(current.context, fact),
    );
  });

  connection.onWorkspaceSymbol(async (params: WorkspaceSymbolParams, token: CancellationToken) => {
    const results: SymbolInformation[] = [];
    const seenRoots = new Set<string>();
    for (const document of documents.all()) {
      const root = projectRootFor(document.uri);
      if (root === undefined || seenRoots.has(root)) continue;
      const current = currentContext(documents, contexts, projectRootFor, document.uri);
      if (current === null) continue;
      seenRoots.add(root);
      for (const fact of workspaceSymbols(current.context.index!, params.query, 100)) {
        const location = locationFor(current.context, fact.span);
        if (location === null) continue;
        results.push({
          name: fact.qualifiedName,
          kind: symbolKindOf(fact.kind),
          location,
        });
      }
      if (results.length >= 100) break;
    }
    return token.isCancellationRequested ? null : results.slice(0, 100);
  });

  connection.onRequest(
    "textDocument/semanticTokens/full",
    async (params: SemanticTokensParams, token: CancellationToken): Promise<SemanticTokens> => {
      const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
      if (current === null || token.isCancellationRequested) return { data: [] };
      const sourceId = sourceIdOf(current.context, params.textDocument.uri);
      if (sourceId === null) return { data: [] };
      const facts = semanticTokenFacts(current.context.index!, sourceId);
      const data: number[] = [];
      let previousLine = 0;
      let previousCharacter = 0;
      for (const fact of facts) {
        const start = byteOffsetToPosition(sourceText(current.context, sourceId), fact.span.start);
        const end = byteOffsetToPosition(sourceText(current.context, sourceId), fact.span.end);
        if (start.line !== end.line) continue;
        const deltaLine = start.line - previousLine;
        const deltaCharacter =
          deltaLine === 0 ? start.character - previousCharacter : start.character;
        const typeIndex = SEMANTIC_TOKEN_TYPES.indexOf(
          fact.type as (typeof SEMANTIC_TOKEN_TYPES)[number],
        );
        if (typeIndex < 0) continue;
        let modifierMask = 0;
        for (const modifier of fact.modifiers) {
          const modifierIndex = SEMANTIC_TOKEN_MODIFIERS.indexOf(
            modifier as (typeof SEMANTIC_TOKEN_MODIFIERS)[number],
          );
          if (modifierIndex >= 0) modifierMask |= 1 << modifierIndex;
        }
        data.push(
          deltaLine,
          deltaCharacter,
          end.character - start.character,
          typeIndex,
          modifierMask,
        );
        previousLine = start.line;
        previousCharacter = start.character;
      }
      return { data };
    },
  );

  connection.onDocumentFormatting(async (params, token: CancellationToken) => {
    const current = currentContext(documents, contexts, projectRootFor, params.textDocument.uri);
    if (current === null || token.isCancellationRequested) return null;
    const sourceId = sourceIdOf(current.context, params.textDocument.uri);
    if (sourceId === null) return null;
    const syntaxFailure = current.context.result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "PARSE_SYNTAX_ERROR" && diagnostic.primarySpan?.sourceId === sourceId,
    );
    if (syntaxFailure) return null;
    const formatted = formatBlend65(current.document.getText());
    if (formatted.kind !== "formatted" || token.isCancellationRequested) return null;
    if (formatted.text === current.document.getText()) return [];
    return [
      {
        range: {
          start: { line: 0, character: 0 },
          end: current.document.positionAt(current.document.getText().length),
        },
        newText: formatted.text,
      },
    ];
  });

  connection.onCodeAction(async (_params: CodeActionParams, token: CancellationToken) => {
    // No current Specification 4 diagnostic supplies a closed, proved source edit.
    return token.isCancellationRequested ? null : [];
  });
}
