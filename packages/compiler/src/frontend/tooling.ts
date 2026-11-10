import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { SemanticAsset } from "../assets/asset-types.js";
import type {
  BindingId,
  BindingStorage,
  EffectSummary,
  FunctionSignature,
  PlacementConstraints,
  SemanticBinding,
  SemanticType,
  TypedBlock,
  TypedDeclaration,
  TypedExpr,
  TypedStatement,
} from "./semantic-types.js";
import { bindingIdentityKey } from "./module-graph-types.js";
import type { Declaration, ImportDeclaration, SyntaxUnit } from "./syntax.js";
import type { LoadUnitRecord } from "./load-units.js";
import type { ProfileCapability, ProfileConstant } from "./profile.js";
import type { AnalysisResult, TypedProgram } from "./service.js";

/** Stable source position in UTF-8 bytes. */
export interface ToolingPosition {
  /** Exact project-relative source identity. */
  readonly sourceId: string;
  /** Half-open UTF-8 byte offset. */
  readonly offset: number;
}

/** What an editor needs to render one declaration. */
export interface ToolingSymbol {
  /** Stable symbol identity. */
  readonly id: string;
  /** Source declaration identity, or null for modules and generated facts. */
  readonly binding: BindingId | null;
  /** Source spelling. */
  readonly name: string;
  /** Module-qualified presentation name. */
  readonly qualifiedName: string;
  /** Closed editor symbol kind. */
  readonly kind:
    | "module"
    | "function"
    | "struct"
    | "enum"
    | "field"
    | "variable"
    | "constant"
    | "parameter"
    | "local";
  /** Resolved value or function type. */
  readonly type: SemanticType | null;
  /** Complete declaration span. */
  readonly declaration: SourceSpan;
  /** Exact declaration-name span. */
  readonly nameSpan: SourceSpan;
  /** Lexical visibility span. */
  readonly scope: SourceSpan;
  /** Declaration storage role, or `field` for a struct member. */
  readonly storage: BindingStorage | "field";
  /** Whether the declaration is exported from its module. */
  readonly exported: boolean;
  /** Whether writes through this declaration are forbidden. */
  readonly readonly: boolean;
  /** Proved compile-time value when known. */
  readonly constant: bigint | boolean | null;
  /** Source entry kind for a function. */
  readonly functionMode?: "ordinary" | "comptime" | "interrupt";
  /** Finite effects for a function. */
  readonly effects?: EffectSummary;
  /** Source placement constraints for a stored object. */
  readonly placement?: PlacementConstraints;
  /** Packaged load-unit facts for a loadable declaration. */
  readonly loadUnit?: LoadUnitRecord;
  /** Resident or compile-time asset facts for an asset declaration. */
  readonly asset?: SemanticAsset;
  /** Containing symbol for fields, parameters, and locals. */
  readonly parentId?: string;
}

/** One source occurrence of a symbol. */
export interface ToolingOccurrence {
  /** Exact occurrence span. */
  readonly span: SourceSpan;
  /** Symbol identity resolved at this span. */
  readonly symbolId: string;
  /** Occurrence role. */
  readonly role: "declaration" | "reference" | "import" | "field";
}

/** One imported name and its local spelling. */
export interface ToolingImport {
  /** Importing source identity. */
  readonly sourceId: string;
  /** Local spelling used by the importer. */
  readonly alias: string;
  /** Target declaration identity. */
  readonly targetId: string;
  /** Exact alias or imported-name span. */
  readonly nameSpan: SourceSpan;
  /** Whether the source wrote a different local alias. */
  readonly aliased: boolean;
}

/** Closed module facts used by completion and symbols. */
export interface ToolingModule {
  /** Exact qualified module name. */
  readonly name: string;
  /** Contributing source identities in source order. */
  readonly sourceIds: readonly string[];
  /** Exported declaration names. */
  readonly exports: readonly string[];
}

/** Selected-profile facts used by completion and hover. */
export interface ToolingProfile {
  /** Qualified profile identity. */
  readonly id: string;
  /** Source-visible platform operations. */
  readonly capabilities: readonly ProfileCapability[];
  /** Source-visible platform constants. */
  readonly constants: readonly ProfileConstant[];
  /** Placeable region identities. */
  readonly regions: readonly string[];
}

/** One proved direct call retained for signature help. */
export interface ToolingCall {
  /** Complete call-expression span. */
  readonly span: SourceSpan;
  /** Proved signature. */
  readonly signature: FunctionSignature;
  /** Argument spans in source order. */
  readonly arguments: readonly SourceSpan[];
}

/** Derived facts shared by every editor query. */
export interface ToolingIndex {
  /** Whether the underlying analysis completed without error or obligation. */
  readonly complete: boolean;
  /** Exact consumed source text. */
  readonly sources: readonly {
    readonly sourceId: string;
    readonly text: string;
    /** True for a bundled installed-library source outside the project. */
    readonly installed: boolean;
  }[];
  /** All admitted symbols in deterministic order. */
  readonly symbols: readonly ToolingSymbol[];
  /** All admitted occurrences in deterministic order. */
  readonly occurrences: readonly ToolingOccurrence[];
  /** Reachable modules. */
  readonly modules: readonly ToolingModule[];
  /** Imported names and their local spellings. */
  readonly imports: readonly ToolingImport[];
  /** Proved direct calls in deterministic order. */
  readonly calls: readonly ToolingCall[];
  /** Selected-profile facts, when a profile was available. */
  readonly profile: ToolingProfile | null;
  /** Analysis diagnostics retained for bounded code actions. */
  readonly diagnostics: readonly ProjectDiagnostic[];
}

/** One completion candidate independent of the protocol. */
export interface CompletionFact {
  /** Display label. */
  readonly label: string;
  /** Closed candidate kind. */
  readonly kind: "symbol" | "keyword" | "type" | "profile" | "region" | "asset-path";
  /** Short type or signature detail. */
  readonly detail: string;
  /** Optional documentation. */
  readonly documentation?: string;
  /** Symbol identity when the candidate is a declaration. */
  readonly symbolId?: string;
  /** Stable sort key. */
  readonly sortText: string;
}

/** Hover facts independent of the protocol. */
export interface HoverFact {
  /** Markdown body. */
  readonly markdown: string;
  /** Exact interpreted span. */
  readonly span: SourceSpan;
}

/** One proved call signature. */
export interface SignatureFact {
  /** Parameters in source order. */
  readonly parameters: readonly { readonly name: string; readonly type: string }[];
  /** Return type spelling. */
  readonly returnType: string;
  /** Zero-based active parameter. */
  readonly activeParameter: number;
}

/** One hierarchical document symbol. */
export interface DocumentSymbolFact {
  /** Source spelling. */
  readonly name: string;
  /** Closed symbol kind. */
  readonly kind: ToolingSymbol["kind"];
  /** Complete declaration span. */
  readonly span: SourceSpan;
  /** Selection span. */
  readonly selectionSpan: SourceSpan;
  /** Nested declarations in source order. */
  readonly children?: readonly DocumentSymbolFact[];
}

/** One workspace-symbol result. */
export interface WorkspaceSymbolFact {
  /** Source spelling. */
  readonly name: string;
  /** Module-qualified name. */
  readonly qualifiedName: string;
  /** Closed symbol kind. */
  readonly kind: ToolingSymbol["kind"];
  /** Selection span. */
  readonly span: SourceSpan;
}

/** One semantic-token fact. */
export interface SemanticTokenFact {
  /** Exact token span. */
  readonly span: SourceSpan;
  /** Standard LSP token type spelling. */
  readonly type: string;
  /** Standard LSP token modifier spellings. */
  readonly modifiers: readonly string[];
}

/** One closed source edit. */
export interface ToolingEdit {
  /** Project-relative source identity. */
  readonly sourceId: string;
  /** Exact replacement span. */
  readonly span: SourceSpan;
  /** Replacement text. */
  readonly newText: string;
}

/** Rename result or a typed refusal. */
export type RenameResult =
  | { readonly kind: "edits"; readonly edits: readonly ToolingEdit[] }
  | { readonly kind: "rejected"; readonly reason: string };

/** One bounded code action. */
export interface CodeActionFact {
  /** User-facing title. */
  readonly title: string;
  /** Only quick fixes are advertised. */
  readonly kind: "quickfix";
  /** Authoritative diagnostic code. */
  readonly diagnosticCode: string;
  /** Closed edits. */
  readonly edits: readonly ToolingEdit[];
}

/** Locate one declaration binding by its complete declaration span. */
function declarationKey(span: SourceSpan): string {
  return `${span.sourceId}:${span.start}:${span.end}`;
}

/** Compare two source spans for exact identity. */
function sameSpan(left: SourceSpan, right: SourceSpan): boolean {
  return left.sourceId === right.sourceId && left.start === right.start && left.end === right.end;
}

/** Read the exact source bytes covered by one span. */
function sourceSlice(text: string, span: SourceSpan): string {
  return Buffer.from(text, "utf8").subarray(span.start, span.end).toString("utf8");
}

/** Escape one literal for a RegExp constructor. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Find the first exact identifier inside a declaration span. */
function findNameSpan(text: string, span: SourceSpan, name: string): SourceSpan {
  const slice = sourceSlice(text, span);
  const match = new RegExp(`\\b${escapeRegExp(name)}\\b`, "u").exec(slice);
  if (match === null) return { ...span };
  const start = span.start + Buffer.byteLength(slice.slice(0, match.index));
  return { sourceId: span.sourceId, start, end: start + Buffer.byteLength(name) };
}

/** Find the last exact identifier inside a member expression span. */
function findMemberSpan(text: string, span: SourceSpan, name: string): SourceSpan {
  const slice = sourceSlice(text, span);
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "gu");
  let last: RegExpExecArray | null = null;
  for (let match = pattern.exec(slice); match !== null; match = pattern.exec(slice)) {
    last = match;
  }
  if (last === null) return { ...span };
  const start = span.start + Buffer.byteLength(slice.slice(0, last.index));
  return { sourceId: span.sourceId, start, end: start + Buffer.byteLength(name) };
}

/** Full-source scope for module-level declarations. */
function fullSource(sourceId: string, text: string): SourceSpan {
  return { sourceId, start: 0, end: Buffer.byteLength(text) };
}

/** Render one semantic type in source spelling. */
export function renderSemanticType(type: SemanticType): string {
  switch (type.kind) {
    case "scalar":
      return type.name;
    case "enum":
      return `enum ${type.name}`;
    case "struct":
      return `struct ${type.name ?? "<anonymous>"}`;
    case "array":
      return `${renderSemanticType(type.element)}[${type.length}]`;
    case "function":
      return `fn(${type.parameters
        .map(
          (parameter) =>
            `${parameter.readonly ? "const " : ""}${renderSemanticType(parameter.type)}${
              parameter.outerUnsized && parameter.type.kind === "array" ? "[]" : ""
            }`,
        )
        .join(", ")}): ${renderSemanticType(type.returnType)}`;
    case "interrupt-handler":
      return "interrupt-handler";
  }
}

/** Render one symbol as a source-like declaration. */
export function renderSymbol(symbol: ToolingSymbol): string {
  if (symbol.kind === "function" && symbol.type?.kind === "function") {
    return `${symbol.functionMode === "comptime" ? "comptime " : ""}${
      symbol.functionMode === "interrupt" ? "interrupt " : ""
    }function ${symbol.qualifiedName}${renderSemanticType(symbol.type).slice(2)}`;
  }
  if (symbol.kind === "module") return `module ${symbol.name}`;
  if (symbol.kind === "struct") return `struct ${symbol.name}`;
  if (symbol.kind === "enum") return `enum ${symbol.name}`;
  const readonly = symbol.readonly ? "const " : "";
  const type = symbol.type === null ? "" : `: ${renderSemanticType(symbol.type)}`;
  return `${readonly}${symbol.kind} ${symbol.qualifiedName}${type}`;
}

/** Walk one typed expression and every typed child in source order. */
function walkExpr(expression: TypedExpr | null, visit: (node: TypedExpr) => void): void {
  if (expression === null) return;
  visit(expression);
  const child = (value: unknown): void => {
    if (value !== null && typeof value === "object" && "kind" in value && "type" in value) {
      walkExpr(value as TypedExpr, visit);
    }
  };
  switch (expression.kind) {
    case "unary":
    case "cast":
      child(expression.operand);
      break;
    case "binary":
      child(expression.left);
      child(expression.right);
      break;
    case "conditional":
      child(expression.condition);
      child(expression.whenTrue);
      child(expression.whenFalse);
      break;
    case "assignment":
      child(expression.target);
      child(expression.value);
      break;
    case "call":
      child(expression.callee);
      for (const argument of expression.arguments ?? []) child(argument);
      if (expression.loadUnit) child(expression.loadUnit.destination);
      break;
    case "index":
      child(expression.object);
      child(expression.index);
      break;
    case "member":
      child(expression.object);
      break;
    case "array-literal":
      for (const element of expression.elements ?? []) child(element);
      child(expression.fill);
      break;
    case "struct-literal":
      for (const field of expression.fields ?? []) child(field.value);
      break;
    case "length":
      child(expression.operand);
      break;
    default:
      break;
  }
}

/** Walk one typed statement and every nested statement/expression. */
function walkStatement(
  statement: TypedStatement,
  visit: (node: TypedExpr) => void,
  nested: (block: TypedBlock) => void,
): void {
  switch (statement.kind) {
    case "variable":
      walkExpr(statement.initializer, visit);
      break;
    case "expression-statement":
      walkExpr(statement.expression, visit);
      break;
    case "block":
      nested(statement);
      break;
    case "if":
      walkExpr(statement.condition, visit);
      nested(statement.then);
      if (statement.otherwise?.kind === "block") nested(statement.otherwise);
      else if (statement.otherwise !== null) walkStatement(statement.otherwise, visit, nested);
      break;
    case "while":
      walkExpr(statement.condition, visit);
      nested(statement.body);
      break;
    case "do-while":
      nested(statement.body);
      walkExpr(statement.condition, visit);
      break;
    case "for":
      if (statement.initializer !== null && !("kind" in statement.initializer)) {
        const expressions: readonly TypedExpr[] = statement.initializer;
        for (const expression of expressions) walkExpr(expression, visit);
      }
      walkExpr(statement.condition, visit);
      for (const expression of statement.update ?? []) walkExpr(expression, visit);
      nested(statement.body);
      break;
    case "switch":
      walkExpr(statement.value, visit);
      for (const clause of statement.clauses) {
        for (const value of clause.values ?? []) walkExpr(value, visit);
        nested(clause.body);
      }
      break;
    case "break":
    case "continue":
      break;
    case "return":
      walkExpr(statement.value ?? null, visit);
      break;
  }
}

/** Build one derived tooling index from an admitted analysis result. */
export function buildToolingIndex(result: AnalysisResult): ToolingIndex | null {
  if (result.kind !== "complete") return null;
  const program: TypedProgram = result.program;
  const sources = result.inputs.sources.map(({ sourceId, text }) => ({
    sourceId,
    text,
    installed: sourceId.startsWith("@blend65/"),
  }));
  const textBySource = new Map(sources.map(({ sourceId, text }) => [sourceId, text]));
  const declarations = new Map<string, TypedDeclaration>();
  for (const declaration of program.declarations) {
    if (declaration.kind === "typed") {
      declarations.set(bindingIdentityKey(declaration.binding), declaration);
    }
  }
  const bindings = new Map<string, SemanticBinding>();
  for (const binding of program.bindings) bindings.set(bindingIdentityKey(binding.id), binding);
  const bindingsByDeclaration = new Map<string, SemanticBinding[]>();
  for (const binding of program.bindings) {
    const key = declarationKey(binding.declaration);
    const list = bindingsByDeclaration.get(key) ?? [];
    list.push(binding);
    bindingsByDeclaration.set(key, list);
  }
  const effects = new Map<string, EffectSummary>();
  for (const effect of program.effects) effects.set(bindingIdentityKey(effect.function), effect);
  const loadUnits = new Map<string, LoadUnitRecord>();
  for (const unit of program.loadUnits) loadUnits.set(bindingIdentityKey(unit.binding), unit);

  const symbols: ToolingSymbol[] = [];
  const occurrences: ToolingOccurrence[] = [];
  const modules: ToolingModule[] = [];
  const imports: ToolingImport[] = [];
  const calls: ToolingCall[] = [];
  const moduleIds = new Map<string, string>();

  /** Choose the narrowest source binding for one declaration span. */
  const sourceBinding = (span: SourceSpan): SemanticBinding | null => {
    const candidates = bindingsByDeclaration.get(declarationKey(span)) ?? [];
    return (
      candidates.find(({ storage }) => storage === "module") ??
      candidates.find(({ storage }) => storage === "function") ??
      candidates.find(({ storage }) => storage === "type") ??
      candidates[0] ??
      null
    );
  };

  /** Add one symbol and its declaration occurrence. */
  const add = (symbol: ToolingSymbol): string => {
    symbols.push(symbol);
    occurrences.push({ span: symbol.nameSpan, symbolId: symbol.id, role: "declaration" });
    return symbol.id;
  };

  /** Resolve the typed declaration for one binding. */
  const typedFor = (binding: BindingId | null): TypedDeclaration | null =>
    binding === null ? null : (declarations.get(bindingIdentityKey(binding)) ?? null);

  /** Add one local variable symbol and its initializer references. */
  const addLocal = (
    statement: Extract<TypedStatement, { kind: "variable" }>,
    scope: SourceSpan,
    parentId: string,
    sourceId: string,
  ): void => {
    const binding = bindings.get(bindingIdentityKey(statement.binding));
    const text = textBySource.get(sourceId) ?? "";
    const nameSpan = statement.nameSpan ?? findNameSpan(text, statement.span, statement.name);
    const readonly = binding?.storage === "constant";
    add({
      id: bindingIdentityKey(statement.binding),
      binding: statement.binding,
      name: statement.name,
      qualifiedName: statement.name,
      kind: readonly ? "constant" : "local",
      type: statement.type,
      declaration: statement.span,
      nameSpan,
      scope,
      storage: binding?.storage ?? "local",
      exported: false,
      readonly,
      constant: readonly ? (statement.initializer?.constant ?? null) : null,
      parentId,
    });
    walkExpr(statement.initializer, (node) => visitExpression(node, sourceId));
  };

  /** Walk a typed block, recording locals and expression occurrences. */
  const walkBlock = (block: TypedBlock, parentId: string, sourceId: string): void => {
    const nested = (child: TypedBlock): void => walkBlock(child, parentId, sourceId);
    for (const statement of block.statements) {
      if (statement.kind === "variable") {
        addLocal(statement, block.span, parentId, sourceId);
        continue;
      }
      if (
        statement.kind === "for" &&
        statement.initializer !== null &&
        "kind" in statement.initializer &&
        statement.initializer.kind === "variable"
      ) {
        addLocal(statement.initializer, statement.span, parentId, sourceId);
      }
      walkStatement(statement, (node) => visitExpression(node, sourceId), nested);
    }
  };

  /** Record one expression occurrence against the nearest stable symbol. */
  const visitExpression = (expression: TypedExpr, sourceId: string): void => {
    const text = textBySource.get(sourceId) ?? "";
    if (expression.kind === "call" && expression.signature !== undefined) {
      calls.push({
        span: expression.span,
        signature: expression.signature,
        arguments: Object.freeze((expression.arguments ?? []).map(({ span }) => span)),
      });
    }
    if (expression.kind === "name" && expression.binding !== null) {
      occurrences.push({
        span: expression.span,
        symbolId: bindingIdentityKey(expression.binding),
        role: "reference",
      });
      if (expression.qualifiedModule !== undefined) {
        const moduleId = moduleIds.get(expression.qualifiedModule.name);
        if (moduleId !== undefined) {
          occurrences.push({
            span: expression.qualifiedModule.span,
            symbolId: moduleId,
            role: "reference",
          });
        }
      }
      return;
    }
    if (expression.kind === "struct-literal" && expression.type.kind === "struct") {
      for (const field of expression.fields ?? []) {
        occurrences.push({
          span: field.nameSpan,
          symbolId: `field:${bindingIdentityKey(expression.type.binding)}:${field.name}`,
          role: "field",
        });
      }
      return;
    }
    if (expression.kind !== "member") return;
    const memberSpan = findMemberSpan(text, expression.span, expression.member ?? "");
    const objectType = expression.object?.type;
    if (objectType?.kind === "struct" && expression.member !== undefined) {
      const field = objectType.fields.find(({ name }) => name === expression.member);
      if (field !== undefined) {
        occurrences.push({
          span: memberSpan,
          symbolId: `field:${bindingIdentityKey(objectType.binding)}:${field.name}`,
          role: "field",
        });
      }
    } else if (expression.binding !== null) {
      occurrences.push({
        span: memberSpan,
        symbolId: bindingIdentityKey(expression.binding),
        role: "reference",
      });
    }
    if (expression.qualifiedModule !== undefined) {
      const moduleId = moduleIds.get(expression.qualifiedModule.name);
      if (moduleId !== undefined) {
        occurrences.push({
          span: expression.qualifiedModule.span,
          symbolId: moduleId,
          role: "reference",
        });
      }
    }
  };
  for (const module of program.modules) {
    const sourceIds = module.units.flatMap(({ header }) =>
      header === null ? [] : [header.nameSpan.sourceId],
    );
    const exports = program.bindings
      .filter(
        ({ exported, qualifiedName }) =>
          exported && qualifiedName !== null && qualifiedName.startsWith(`${module.name}.`),
      )
      .map(({ name }) => name)
      .sort();
    modules.push({ name: module.name, sourceIds, exports });
    for (const unit of module.units) {
      const header = unit.header;
      if (header === null) continue;
      const sourceId = unit.span.sourceId;
      const text = textBySource.get(sourceId) ?? "";
      const id = `module:${sourceId}:${module.name}`;
      moduleIds.set(module.name, id);
      add({
        id,
        binding: null,
        name: module.name,
        qualifiedName: module.name,
        kind: "module",
        type: null,
        declaration: header.span,
        nameSpan: header.nameSpan,
        scope: fullSource(sourceId, text),
        storage: "module",
        exported: true,
        readonly: true,
        constant: null,
      });
    }
  }

  // Declarations are the source authority for exact names and nesting.
  for (const module of program.modules) {
    for (const unit of module.units) {
      const sourceId = unit.header?.nameSpan.sourceId ?? unit.span.sourceId;
      const text = textBySource.get(sourceId) ?? "";
      for (const declaration of unit.declarations) {
        addDeclaration(module.name, sourceId, text, declaration, unit);
      }
    }
  }

  /** Add one parsed declaration and its children. */
  function addDeclaration(
    moduleName: string,
    sourceId: string,
    text: string,
    declaration: Declaration,
    unit: SyntaxUnit,
  ): void {
    switch (declaration.kind) {
      case "variable": {
        const binding = sourceBinding(declaration.span);
        if (binding === null) return;
        const typed = typedFor(binding.id);
        add({
          id: bindingIdentityKey(binding.id),
          binding: binding.id,
          name: declaration.name,
          qualifiedName: `${moduleName}.${declaration.name}`,
          kind: declaration.declarationKind === "const" ? "constant" : "variable",
          type: typed?.type ?? binding.type,
          declaration: declaration.span,
          nameSpan: declaration.nameSpan,
          scope: fullSource(sourceId, text),
          storage: binding.storage,
          exported: declaration.exported,
          readonly: declaration.declarationKind === "const",
          constant:
            declaration.declarationKind === "const" ? (typed?.initializer?.constant ?? null) : null,
          ...(typed?.placement === undefined || typed.placement === null
            ? {}
            : { placement: typed.placement }),
          ...(loadUnits.has(bindingIdentityKey(binding.id))
            ? { loadUnit: loadUnits.get(bindingIdentityKey(binding.id))! }
            : {}),
        });
        walkExpr(typed?.initializer ?? null, (node) => visitExpression(node, sourceId));
        return;
      }
      case "function": {
        const binding = sourceBinding(declaration.span);
        if (binding === null) return;
        const typed = typedFor(binding.id);
        const functionId = bindingIdentityKey(binding.id);
        const parameterBindings = declaration.parameters.map(
          (parameter) =>
            program.bindings.find(
              ({ storage, declaration: span }) =>
                storage === "parameter" &&
                (sameSpan(span, parameter.span) || sameSpan(span, parameter.nameSpan)),
            ) ?? null,
        );
        const returnType: SemanticType = typed?.type ??
          binding.type ?? { kind: "scalar", name: "void" };
        const signature: SemanticType = {
          kind: "function",
          parameters: declaration.parameters.map((parameter, index) => ({
            name: parameter.name,
            nameSpan: parameter.nameSpan,
            type: parameterBindings[index]?.type ?? { kind: "scalar", name: "byte" },
            readonly: parameter.readonly,
            ...(parameterBindings[index]?.outerUnsized === true
              ? { outerUnsized: true as const }
              : {}),
          })),
          returnType,
        };
        add({
          id: functionId,
          binding: binding.id,
          name: declaration.name,
          qualifiedName: `${moduleName}.${declaration.name}`,
          kind: "function",
          type: signature,
          declaration: declaration.span,
          nameSpan: declaration.nameSpan,
          scope: fullSource(sourceId, text),
          storage: binding.storage,
          exported: declaration.exported,
          readonly: true,
          constant: null,
          functionMode: binding.functionMode ?? declaration.mode,
          ...(effects.has(functionId) ? { effects: effects.get(functionId)! } : {}),
        });
        const parameters = signature?.kind === "function" ? signature.parameters : ([] as const);
        declaration.parameters.forEach((parameter, index) => {
          const parameterBinding =
            program.bindings.find(
              ({ storage, declaration: span }) =>
                storage === "parameter" &&
                (sameSpan(span, parameter.span) || sameSpan(span, parameter.nameSpan)),
            ) ?? null;
          add({
            id:
              parameterBinding === null
                ? `${functionId}:param:${index}`
                : bindingIdentityKey(parameterBinding.id),
            binding: parameterBinding?.id ?? null,
            name: parameter.name,
            qualifiedName: parameter.name,
            kind: "parameter",
            type: parameters[index]?.type ?? parameterBinding?.type ?? null,
            declaration: parameter.span,
            nameSpan: parameter.nameSpan,
            scope: declaration.body.span,
            storage: "parameter",
            exported: false,
            readonly: parameter.readonly,
            constant: null,
            parentId: functionId,
          });
        });
        if (typed?.body !== null && typed?.body !== undefined) {
          walkBlock(typed.body, functionId, sourceId);
        }
        return;
      }
      case "struct": {
        const binding = sourceBinding(declaration.span);
        if (binding === null) return;
        const typed = typedFor(binding.id);
        const structId = bindingIdentityKey(binding.id);
        const structType = typed?.type.kind === "struct" ? typed.type : null;
        add({
          id: structId,
          binding: binding.id,
          name: declaration.name,
          qualifiedName: `${moduleName}.${declaration.name}`,
          kind: "struct",
          type: typed?.type ?? binding.type,
          declaration: declaration.span,
          nameSpan: declaration.nameSpan,
          scope: fullSource(sourceId, text),
          storage: binding.storage,
          exported: declaration.exported,
          readonly: true,
          constant: null,
        });
        for (const fieldDeclaration of declaration.fields) {
          const field = structType?.fields.find(({ name }) => name === fieldDeclaration.name);
          add({
            id: `field:${structId}:${fieldDeclaration.name}`,
            binding: null,
            name: fieldDeclaration.name,
            qualifiedName: `${moduleName}.${declaration.name}.${fieldDeclaration.name}`,
            kind: "field",
            type: field?.type ?? null,
            declaration: fieldDeclaration.span,
            nameSpan: fieldDeclaration.nameSpan,
            scope: declaration.span,
            storage: "field",
            exported: declaration.exported,
            readonly: false,
            constant: null,
            parentId: structId,
          });
        }
        return;
      }
      case "enum": {
        const binding = sourceBinding(declaration.span);
        if (binding === null) return;
        const typed = typedFor(binding.id);
        const enumId = bindingIdentityKey(binding.id);
        add({
          id: enumId,
          binding: binding.id,
          name: declaration.name,
          qualifiedName: `${moduleName}.${declaration.name}`,
          kind: "enum",
          type: typed?.type ?? binding.type,
          declaration: declaration.span,
          nameSpan: declaration.nameSpan,
          scope: fullSource(sourceId, text),
          storage: binding.storage,
          exported: declaration.exported,
          readonly: true,
          constant: null,
        });
        for (const member of declaration.members) {
          add({
            id: `enum-member:${enumId}:${member.name}`,
            binding: null,
            name: member.name,
            qualifiedName: `${moduleName}.${declaration.name}.${member.name}`,
            kind: "constant",
            type: typed?.type ?? binding.type,
            declaration: member.span,
            nameSpan: member.nameSpan,
            scope: declaration.span,
            storage: "constant",
            exported: declaration.exported,
            readonly: true,
            constant: member.value?.kind === "number" ? member.value.value : null,
            parentId: enumId,
          });
        }
        return;
      }
      case "zeropage": {
        for (const variable of declaration.variables) {
          addDeclaration(moduleName, sourceId, text, variable, unit);
        }
        return;
      }
      case "poison":
      case "unchecked":
        return;
      default:
        return;
    }
  }

  // Imports are references to exported declarations, not new bindings.
  for (const module of program.modules) {
    for (const unit of module.units) {
      const sourceId = unit.header?.nameSpan.sourceId ?? unit.span.sourceId;
      for (const importDeclaration of unit.imports) {
        addImport(sourceId, importDeclaration);
      }
    }
  }

  /** Resolve one import item against the exported target. */
  function addImport(sourceId: string, declaration: ImportDeclaration): void {
    for (const item of declaration.items) {
      const target = program.bindings.find(
        ({ exported, qualifiedName, name }) =>
          exported && name === item.name && qualifiedName === `${declaration.module}.${item.name}`,
      );
      if (target === undefined) continue;
      const targetId = bindingIdentityKey(target.id);
      const nameSpan = item.aliasSpan ?? item.nameSpan;
      imports.push({
        sourceId,
        alias: item.alias ?? item.name,
        targetId,
        nameSpan,
        aliased: item.alias !== null && item.alias !== item.name,
      });
      occurrences.push({ span: nameSpan, symbolId: targetId, role: "import" });
    }
  }

  // Sort deterministically and freeze the derived view.
  const sourceOrder = new Map(sources.map(({ sourceId }, index) => [sourceId, index]));
  const compareSpans = (left: SourceSpan, right: SourceSpan): number =>
    (sourceOrder.get(left.sourceId) ?? 0) - (sourceOrder.get(right.sourceId) ?? 0) ||
    left.start - right.start ||
    left.end - right.end;
  symbols.sort(
    (left, right) =>
      compareSpans(left.declaration, right.declaration) ||
      Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
  );
  occurrences.sort(
    (left, right) =>
      compareSpans(left.span, right.span) ||
      Buffer.compare(Buffer.from(left.symbolId), Buffer.from(right.symbolId)),
  );
  calls.sort(
    (left, right) =>
      compareSpans(left.span, right.span) ||
      left.signature.parameters.length - right.signature.parameters.length,
  );
  const profile = program.profile;
  return Object.freeze({
    complete: result.kind === "complete",
    sources: Object.freeze(sources),
    symbols: Object.freeze(symbols),
    occurrences: Object.freeze(occurrences),
    modules: Object.freeze(modules),
    imports: Object.freeze(imports),
    calls: Object.freeze(calls),
    profile:
      profile === null
        ? null
        : Object.freeze({
            id: profile.id,
            capabilities: profile.capabilities,
            constants: profile.constants,
            regions: Object.freeze([...profile.assets.regions].sort()),
          }),
    diagnostics: result.diagnostics,
  });
}
