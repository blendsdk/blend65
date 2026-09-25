import type { AggregateRegistry } from "./aggregate-types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type {
  FunctionSignature,
  ModuleGraph,
  ScalarValueState,
  SemanticBinding,
} from "./semantic-types.js";
import type { Declaration, FunctionDeclaration } from "./syntax.js";

/** Function declaration facts collected before any body is checked. */
export interface FunctionInfo {
  /** Parsed declaration supplying the body. */
  readonly declaration: FunctionDeclaration;
  /** Stable semantic binding published to expressions. */
  readonly binding: SemanticBinding;
  /** Resolved direct-call signature, or null when its form is still pending. */
  readonly signature: FunctionSignature | null;
  /** Module owning the declaration. */
  readonly module: string;
}

/** Mutable lookup tables prepared once before declaration bodies are checked. */
export interface PreparedModuleBindings {
  /** Semantic bindings in graph order. */
  readonly bindings: SemanticBinding[];
  /** Bindings keyed by stable source identity. */
  readonly bindingByKey: Map<string, SemanticBinding>;
  /** Reaching states keyed by stable source identity. */
  readonly stateByKey: Map<string, ScalarValueState>;
  /** Function headers keyed by stable source identity. */
  readonly functionByKey: Map<string, FunctionInfo>;
  /** Value-only module scopes keyed by module name. */
  readonly moduleScopes: Map<string, Map<string, ScalarValueState>>;
  /** Qualified value names; type bindings are deliberately excluded. */
  readonly qualified: Map<string, ScalarValueState>;
  /** Value-only import aliases keyed by importing source. */
  readonly importsBySource: Map<string, Map<string, ScalarValueState>>;
}

/** Associate graph bindings with the parsed declarations at the same source span. */
export function collectDeclarationIndex(graph: ModuleGraph): Map<string, Declaration> {
  const declarations = new Map<string, Declaration>();
  for (const module of graph.modules) {
    for (const unit of module.units) {
      for (const declaration of unit.declarations.flatMap((item): readonly Declaration[] =>
        item.kind === "zeropage" ? item.variables : [item],
      )) {
        const binding = graph.bindings.find(
          (candidate) =>
            candidate.qualifiedName ===
              ("name" in declaration ? `${module.name}.${declaration.name}` : null) &&
            candidate.id.sourceId === declaration.span.sourceId &&
            candidate.id.span.start === declaration.span.start &&
            candidate.id.span.end === declaration.span.end,
        );
        if (binding !== undefined) {
          declarations.set(bindingIdentityKey(binding.id), declaration);
        }
      }
    }
  }
  return declarations;
}

/** Resolve declaration headers so body lookup is independent of source order. */
export function prepareModuleBindings(
  graph: ModuleGraph,
  declarations: ReadonlyMap<string, Declaration>,
  aggregates: AggregateRegistry,
): PreparedModuleBindings {
  const bindings: SemanticBinding[] = [];
  const bindingByKey = new Map<string, SemanticBinding>();
  const stateByKey = new Map<string, ScalarValueState>();
  const functionByKey = new Map<string, FunctionInfo>();
  const moduleScopes = new Map<string, Map<string, ScalarValueState>>();
  const qualified = new Map<string, ScalarValueState>();
  const importsBySource = new Map<string, Map<string, ScalarValueState>>();

  for (const binding of graph.bindings) {
    const declaration = declarations.get(bindingIdentityKey(binding.id));
    const moduleName =
      binding.qualifiedName === null
        ? ""
        : binding.qualifiedName.slice(0, -(binding.name.length + 1));
    const type =
      declaration === undefined ? null : aggregates.declarationType(declaration, moduleName);
    const semantic = Object.freeze({
      ...binding,
      type,
      ...(declaration?.kind === "function" ? { functionMode: declaration.mode } : {}),
      loadable: declaration?.kind === "variable" && declaration.loadable,
      materialized: declaration?.kind === "variable" && declaration.placement !== null,
      zeropage: declaration?.kind === "variable" && declaration.zeropage,
    });
    const state: ScalarValueState = {
      binding: semantic,
      nameSpan:
        declaration !== undefined && "nameSpan" in declaration
          ? declaration.nameSpan
          : binding.declaration,
      readonly: binding.storage === "constant",
      known: null,
      initialized: binding.storage === "function" || binding.storage === "type",
      initializedRanges: Object.freeze([]),
      initializedPaths: Object.freeze([]),
    };
    bindings.push(semantic);
    bindingByKey.set(bindingIdentityKey(semantic.id), semantic);
    stateByKey.set(bindingIdentityKey(semantic.id), state);
    if (semantic.qualifiedName !== null && semantic.storage !== "type") {
      qualified.set(semantic.qualifiedName, state);
      const scope = moduleScopes.get(moduleName) ?? new Map<string, ScalarValueState>();
      scope.set(semantic.name, state);
      moduleScopes.set(moduleName, scope);
    }
    if (declaration?.kind === "function") {
      functionByKey.set(bindingIdentityKey(semantic.id), {
        declaration,
        binding: semantic,
        signature: aggregates.functionSignature(declaration, moduleName, false),
        module: moduleName,
      });
    }
  }

  for (const resolvedImport of graph.imports) {
    const target = stateByKey.get(bindingIdentityKey(resolvedImport.binding));
    if (target === undefined || target.binding.storage === "type") continue;
    const aliases =
      importsBySource.get(resolvedImport.sourceSpan.sourceId) ??
      new Map<string, ScalarValueState>();
    aliases.set(resolvedImport.alias, target);
    importsBySource.set(resolvedImport.sourceSpan.sourceId, aliases);
  }

  return {
    bindings,
    bindingByKey,
    stateByKey,
    functionByKey,
    moduleScopes,
    qualified,
    importsBySource,
  };
}
