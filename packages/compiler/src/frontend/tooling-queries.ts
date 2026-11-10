import type { SourceSpan } from "../project/types.js";
import { lexSource } from "./lexer.js";
import { TokenKind } from "./tokens.js";
import { bindingIdentityKey } from "./module-graph-types.js";
import type {
  CodeActionFact,
  CompletionFact,
  DocumentSymbolFact,
  HoverFact,
  RenameResult,
  SemanticTokenFact,
  SignatureFact,
  ToolingEdit,
  ToolingIndex,
  ToolingSymbol,
  WorkspaceSymbolFact,
} from "./tooling.js";
import { renderSemanticType, renderSymbol } from "./tooling.js";

/** Read the exact text for one indexed source. */
function sourceText(index: ToolingIndex, sourceId: string): string {
  return index.sources.find((source) => source.sourceId === sourceId)?.text ?? "";
}

/** Convert one UTF-8 byte offset to a string index for the same source. */
function textBefore(index: ToolingIndex, sourceId: string, offset: number): string {
  return Buffer.from(sourceText(index, sourceId), "utf8").subarray(0, offset).toString("utf8");
}

/** Return the symbol with one stable identity. */
function symbolById(index: ToolingIndex, id: string): ToolingSymbol | null {
  return index.symbols.find((symbol) => symbol.id === id) ?? null;
}

/** Return whether one span contains a byte offset. */
function contains(span: SourceSpan, offset: number): boolean {
  return span.start <= offset && offset <= span.end;
}

/** Find the nearest symbol occurrence at one position. */
export function symbolAt(
  index: ToolingIndex,
  position: { sourceId: string; offset: number },
): ToolingSymbol | null {
  let best: { span: SourceSpan; symbolId: string } | null = null;
  for (const occurrence of index.occurrences) {
    if (occurrence.span.sourceId !== position.sourceId) continue;
    if (!contains(occurrence.span, position.offset)) continue;
    if (
      best === null ||
      occurrence.span.end - occurrence.span.start < best.span.end - best.span.start
    ) {
      best = occurrence;
    }
  }
  if (best !== null) return symbolById(index, best.symbolId);
  for (const symbol of index.symbols) {
    if (
      symbol.nameSpan.sourceId === position.sourceId &&
      contains(symbol.nameSpan, position.offset)
    ) {
      return symbol;
    }
  }
  return null;
}

/** Return every occurrence of one symbol in source order. */
export function referencesFor(
  index: ToolingIndex,
  symbolId: string,
  includeDeclaration = true,
): readonly SourceSpan[] {
  return index.occurrences
    .filter(
      (occurrence) =>
        occurrence.symbolId === symbolId &&
        (includeDeclaration || occurrence.role !== "declaration"),
    )
    .map(({ span }) => span);
}

/** Return visible declarations at one position, innermost first. */
export function visibleSymbols(
  index: ToolingIndex,
  sourceId: string,
  offset: number,
): readonly ToolingSymbol[] {
  const visible = new Map<string, ToolingSymbol>();
  const isLocal = (symbol: ToolingSymbol): boolean =>
    symbol.kind === "local" || symbol.kind === "parameter";
  for (const symbol of index.symbols) {
    if (symbol.scope.sourceId !== sourceId) continue;
    if (!contains(symbol.scope, offset)) continue;
    if (isLocal(symbol) && symbol.nameSpan.start > offset) continue;
    visible.set(symbol.id, symbol);
  }
  for (const imported of index.imports) {
    if (imported.sourceId !== sourceId) continue;
    const target = symbolById(index, imported.targetId);
    if (target !== null) visible.set(`${imported.alias}:${target.id}`, target);
  }
  return [...visible.values()].sort((left, right) => {
    const leftWidth = left.scope.end - left.scope.start;
    const rightWidth = right.scope.end - right.scope.start;
    return (
      leftWidth - rightWidth ||
      right.nameSpan.start - left.nameSpan.start ||
      left.name.localeCompare(right.name)
    );
  });
}

/** Candidate rank used by deterministic completion ordering. */
const COMPLETION_RANK: Readonly<Record<CompletionFact["kind"], number>> = Object.freeze({
  symbol: 0,
  profile: 1,
  region: 2,
  type: 3,
  keyword: 4,
  "asset-path": 5,
});

/** Language keywords offered by ordinary completion. */
const KEYWORDS = Object.freeze([
  "module",
  "import",
  "from",
  "export",
  "function",
  "return",
  "interrupt",
  "comptime",
  "fn",
  "if",
  "else",
  "while",
  "do",
  "for",
  "switch",
  "case",
  "default",
  "fallthrough",
  "break",
  "continue",
  "let",
  "const",
  "loadable",
  "place",
  "zeropage",
  "struct",
  "byte",
  "sbyte",
  "word",
  "sword",
  "boolean",
  "void",
  "true",
  "false",
  "enum",
  "type",
  "embed",
]);

/** Return the candidate kind label for one source symbol. */
function completionKind(symbol: ToolingSymbol): CompletionFact["kind"] {
  return symbol.kind === "struct" || symbol.kind === "enum" ? "type" : "symbol";
}

/** Build one completion fact from a source symbol. */
function symbolCandidate(symbol: ToolingSymbol, label = symbol.name): CompletionFact {
  const detail =
    symbol.kind === "function" && symbol.type !== null
      ? renderSemanticType(symbol.type)
      : symbol.type === null
        ? symbol.kind
        : renderSemanticType(symbol.type);
  return {
    label,
    kind: completionKind(symbol),
    detail,
    documentation: symbol.qualifiedName,
    symbolId: symbol.id,
    sortText: `${COMPLETION_RANK[completionKind(symbol)]}:${label}`,
  };
}

/** Find the identifier immediately before a dot at the cursor. */
function memberRoot(before: string): string | null {
  const match = /([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*$/u.exec(before);
  return match?.[1] ?? null;
}

/** Return completion candidates at one position. */
export function completionAt(
  index: ToolingIndex,
  sourceId: string,
  offset: number,
  _options: { readonly directory?: string; readonly assetRoots?: readonly string[] } = {},
): readonly CompletionFact[] {
  const before = textBefore(index, sourceId, offset);
  const root = memberRoot(before);
  if (root !== null) {
    const rootOffset = offset - Buffer.byteLength(before.slice(before.lastIndexOf(root)));
    const owner = symbolAt(index, { sourceId, offset: rootOffset });
    if (owner !== null) {
      if (owner.type?.kind === "struct") {
        return owner.type.fields
          .map((field) => ({
            label: field.name,
            kind: "symbol" as const,
            detail: renderSemanticType(field.type),
            documentation: `${owner.name}.${field.name}`,
            sortText: `0:${field.name}`,
          }))
          .sort((left, right) => left.label.localeCompare(right.label));
      }
      if (owner.kind === "enum" || owner.type?.kind === "enum") {
        const enumId = owner.binding === null ? owner.id : bindingIdentityKey(owner.binding);
        return index.symbols
          .filter(({ parentId }) => parentId === enumId)
          .map((symbol) => symbolCandidate(symbol))
          .sort((left, right) => left.label.localeCompare(right.label));
      }
      if (owner.kind === "module") {
        const module = index.modules.find(({ name }) => name === owner.name);
        return index.symbols
          .filter(
            (symbol) =>
              module?.sourceIds.includes(symbol.declaration.sourceId) === true &&
              symbol.exported &&
              (symbol.kind === "function" ||
                symbol.kind === "variable" ||
                symbol.kind === "constant" ||
                symbol.kind === "struct" ||
                symbol.kind === "enum"),
          )
          .map((symbol) => symbolCandidate(symbol))
          .sort((left, right) => left.label.localeCompare(right.label));
      }
    }
  }

  const candidates: CompletionFact[] = [];
  const seen = new Set<string>();
  for (const symbol of visibleSymbols(index, sourceId, offset)) {
    if (seen.has(symbol.name)) continue;
    seen.add(symbol.name);
    candidates.push(symbolCandidate(symbol));
  }
  for (const imported of index.imports) {
    if (imported.sourceId !== sourceId) continue;
    const target = symbolById(index, imported.targetId);
    if (target === null || seen.has(imported.alias)) continue;
    seen.add(imported.alias);
    candidates.push(symbolCandidate(target, imported.alias));
  }
  if (index.profile !== null) {
    for (const capability of index.profile.capabilities) {
      if (seen.has(capability.name)) continue;
      seen.add(capability.name);
      candidates.push({
        label: capability.name,
        kind: "profile",
        detail: `fn(${capability.parameters.map(renderSemanticType).join(", ")}): ${renderSemanticType(capability.returnType)}`,
        documentation: `Selected profile ${index.profile.id}`,
        sortText: `${COMPLETION_RANK.profile}:${capability.name}`,
      });
    }
    if (/\bregion\s*:\s*[A-Za-z0-9_.]*$/u.test(before)) {
      for (const region of index.profile.regions) {
        if (seen.has(region)) continue;
        seen.add(region);
        candidates.push({
          label: region,
          kind: "region",
          detail: "placement region",
          sortText: `${COMPLETION_RANK.region}:${region}`,
        });
      }
    }
  }
  for (const keyword of KEYWORDS) {
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    candidates.push({
      label: keyword,
      kind: "keyword",
      detail: "keyword",
      sortText: `${COMPLETION_RANK.keyword}:${keyword}`,
    });
  }
  return candidates
    .sort(
      (left, right) =>
        COMPLETION_RANK[left.kind] - COMPLETION_RANK[right.kind] ||
        left.label.localeCompare(right.label),
    )
    .slice(0, 200);
}

/** Build exact hover Markdown for one symbol. */
export function hoverAt(index: ToolingIndex, symbolId: string): HoverFact {
  const symbol = symbolById(index, symbolId);
  if (symbol === null) {
    return { markdown: "", span: { sourceId: "", start: 0, end: 0 } };
  }
  const lines = ["```blend65", renderSymbol(symbol), "```", ""];
  lines.push(
    symbol.exported
      ? `Exported from \`${symbol.qualifiedName.split(".").slice(0, -1).join(".")}\`.`
      : "Module-private declaration.",
  );
  if (symbol.constant !== null) lines.push(`Compile-time value: \`${String(symbol.constant)}\`.`);
  if (symbol.functionMode !== undefined) lines.push(`Entry kind: \`${symbol.functionMode}\`.`);
  if (symbol.effects !== undefined) {
    const effects = [
      ...symbol.effects.operationEffects,
      ...(symbol.effects.opaque ? ["opaque"] : []),
      ...(symbol.effects.reads.length > 0 ? ["reads"] : []),
      ...(symbol.effects.writes.length > 0 ? ["writes"] : []),
    ];
    if (effects.length > 0) lines.push(`Effects: ${effects.join(", ")}.`);
  }
  if (symbol.placement !== undefined) {
    const placement = [
      symbol.placement.at === null ? null : `at ${symbol.placement.at}`,
      symbol.placement.align === 0 ? null : `align ${symbol.placement.align}`,
      symbol.placement.noCross === null ? null : `noCross ${symbol.placement.noCross}`,
      symbol.placement.region === null ? null : `region ${symbol.placement.region}`,
    ].filter((part): part is string => part !== null);
    if (placement.length > 0) lines.push(`Placement: ${placement.join(", ")}.`);
  }
  if (symbol.loadUnit !== undefined) {
    lines.push(
      `Loadable unit \`${symbol.loadUnit.id}\`, ${symbol.loadUnit.size} bytes, disk name \`${symbol.loadUnit.diskName}\`.`,
    );
  }
  lines.push(`Declared in \`${symbol.nameSpan.sourceId}\`.`);
  return { markdown: lines.join("\n"), span: symbol.nameSpan };
}

/** Return the proved signature at one call position. */
export function signatureAt(
  index: ToolingIndex,
  sourceId: string,
  offset: number,
): SignatureFact | null {
  let best: (typeof index.calls)[number] | null = null;
  for (const call of index.calls) {
    if (call.span.sourceId !== sourceId || !contains(call.span, offset)) continue;
    if (best === null || call.span.end - call.span.start < best.span.end - best.span.start) {
      best = call;
    }
  }
  if (best === null) return null;
  let activeParameter = 0;
  for (const argument of best.arguments) {
    if (argument.start < offset) activeParameter += 1;
  }
  if (best.arguments.length > 0) {
    activeParameter = Math.min(activeParameter, best.arguments.length - 1);
  }
  return {
    parameters: best.signature.parameters.map((parameter) => ({
      name: parameter.name ?? "",
      type: renderSemanticType(parameter.type),
    })),
    returnType: renderSemanticType(best.signature.returnType),
    activeParameter,
  };
}

/** Build the hierarchical document-symbol view for one source. */
export function documentSymbols(
  index: ToolingIndex,
  sourceId: string,
): readonly DocumentSymbolFact[] {
  const sameSource = index.symbols.filter(({ declaration }) => declaration.sourceId === sourceId);
  const roots = sameSource.filter(({ parentId }) => parentId === undefined);
  const build = (symbol: ToolingSymbol): DocumentSymbolFact => {
    const children = sameSource
      .filter(({ parentId }) => parentId === symbol.id)
      .sort((left, right) => left.declaration.start - right.declaration.start)
      .map(build);
    return {
      name: symbol.name,
      kind: symbol.kind,
      span: symbol.declaration,
      selectionSpan: symbol.nameSpan,
      ...(children.length === 0 ? {} : { children }),
    };
  };
  return roots.sort((left, right) => left.declaration.start - right.declaration.start).map(build);
}

/** Return deterministic project-scoped workspace symbols. */
export function workspaceSymbols(
  index: ToolingIndex,
  query: string,
  limit: number,
): readonly WorkspaceSymbolFact[] {
  return index.symbols
    .filter(
      ({ name, qualifiedName }) =>
        query.length === 0 || name.includes(query) || qualifiedName.includes(query),
    )
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.declaration.start - right.declaration.start ||
        left.declaration.sourceId.localeCompare(right.declaration.sourceId),
    )
    .slice(0, Math.max(0, limit))
    .map(({ name, qualifiedName, kind, nameSpan }) => ({
      name,
      qualifiedName,
      kind,
      span: nameSpan,
    }));
}

/** Keywords and reserved spellings that cannot become a rename target. */
const RESERVED_NAMES: ReadonlySet<string> = new Set(KEYWORDS);

/** Build a safe project-wide rename or a typed refusal. */
export function renameEdits(index: ToolingIndex, symbolId: string, newName: string): RenameResult {
  const symbol = symbolById(index, symbolId);
  if (symbol === null) return { kind: "rejected", reason: "Unknown symbol" };
  if (symbol.binding === null) return { kind: "rejected", reason: "Generated or module symbol" };
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(newName)) {
    return { kind: "rejected", reason: "Invalid identifier" };
  }
  if (RESERVED_NAMES.has(newName)) return { kind: "rejected", reason: "Reserved name" };
  const projectSources = new Set(index.sources.map(({ sourceId }) => sourceId));
  if (!projectSources.has(symbol.nameSpan.sourceId)) {
    return { kind: "rejected", reason: "Installed-library declaration" };
  }
  if (index.imports.some(({ targetId, aliased }) => targetId === symbolId && aliased)) {
    return { kind: "rejected", reason: "Imported under a different alias" };
  }
  const occurrences = index.occurrences.filter(({ symbolId: id }) => id === symbolId);
  if (occurrences.some(({ span }) => !projectSources.has(span.sourceId))) {
    return { kind: "rejected", reason: "Reference outside the project" };
  }
  const collision = visibleSymbols(index, symbol.nameSpan.sourceId, symbol.declaration.start).find(
    (candidate) => candidate.id !== symbolId && candidate.name === newName,
  );
  if (collision !== undefined) return { kind: "rejected", reason: "Name collision" };
  const edits: ToolingEdit[] = [];
  const seen = new Set<string>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.span.sourceId}:${occurrence.span.start}:${occurrence.span.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edits.push({ sourceId: occurrence.span.sourceId, span: occurrence.span, newText: newName });
  }
  edits.sort(
    (left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.span.start - right.span.start,
  );
  return { kind: "edits", edits };
}

/** Map one source symbol kind to a standard LSP token type. */
function tokenType(symbol: ToolingSymbol): string {
  switch (symbol.kind) {
    case "module":
      return "namespace";
    case "function":
      return "function";
    case "struct":
      return "struct";
    case "enum":
      return "enum";
    case "field":
      return "property";
    case "parameter":
      return "parameter";
    case "local":
    case "variable":
    case "constant":
      return "variable";
  }
}

/** Build semantic-token facts with lexical fallback for unproved tokens. */
export function semanticTokenFacts(
  index: ToolingIndex,
  sourceId: string,
): readonly SemanticTokenFact[] {
  const text = sourceText(index, sourceId);
  const facts: SemanticTokenFact[] = [];
  const covered = new Set<string>();
  for (const occurrence of index.occurrences) {
    if (occurrence.span.sourceId !== sourceId) continue;
    const symbol = symbolById(index, occurrence.symbolId);
    if (symbol === null) continue;
    covered.add(`${occurrence.span.start}:${occurrence.span.end}`);
    const modifiers: string[] = [];
    if (occurrence.role === "declaration") modifiers.push("declaration");
    if (symbol.readonly || symbol.storage === "constant") modifiers.push("readonly");
    if (symbol.storage === "module" || symbol.storage === "function") modifiers.push("static");
    facts.push({
      span: occurrence.span,
      type: tokenType(symbol),
      modifiers: Object.freeze(modifiers),
    });
  }
  const lexical = lexSource({
    sourceId,
    text,
    sha256: "0".repeat(64),
    byteLength: Buffer.byteLength(text),
    resolvedPath: sourceId,
  });
  for (const token of lexical.tokens) {
    if (token.kind === TokenKind.EOF) continue;
    const key = `${token.span.start}:${token.span.end}`;
    if (covered.has(key)) continue;
    if (token.kind === TokenKind.IDENTIFIER) continue;
    if (token.kind === TokenKind.NUMBER) {
      facts.push({ span: token.span, type: "number", modifiers: [] });
    } else if (token.kind === TokenKind.STRING || token.kind === TokenKind.CHAR) {
      facts.push({ span: token.span, type: "string", modifiers: [] });
    } else if (token.kind.startsWith("KW_")) {
      facts.push({ span: token.span, type: "keyword", modifiers: [] });
    }
  }
  return facts.sort(
    (left, right) => left.span.start - right.span.start || left.span.end - right.span.end,
  );
}

/** Return only the unique missing-import quick fix at one position. */
export function codeActionsAt(
  index: ToolingIndex,
  sourceId: string,
  offset: number,
): readonly CodeActionFact[] {
  void index;
  void sourceId;
  void offset;
  // No Specification 4 diagnostic currently supplies a closed, proved source edit.
  // Advertising a speculative refactor or a workaround would violate the bounded
  // code-action contract, so the provider deliberately returns no action.
  return [];
}
