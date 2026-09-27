import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type {
  FunctionSignature,
  ModuleGraph,
  ScalarValueState,
  SemanticBinding,
} from "./semantic-types.js";
import type { FrontendProfile } from "./profile.js";

/**
 * Create analysis-owned states with stable identities shared by early types and later expressions.
 * No source declaration, address or execution storage is manufactured for these scalar facts.
 * @example createProfileBindings(profile).map(({ binding }) => binding.qualifiedName)
 */
export function createProfileBindings(
  profile: FrontendProfile | null,
): readonly ScalarValueState[] {
  if (profile === null) return Object.freeze([]);
  const declarations = [
    ...profile.capabilities.map((capability) => ({
      name: capability.name,
      type: capability.returnType,
      effect: capability.effect,
    })),
    ...profile.constants,
  ];
  return Object.freeze(
    declarations.map((declaration, index): ScalarValueState => {
      const span = Object.freeze({
        sourceId: `profile:${profile.id}`,
        start: index,
        end: index + 1,
      });
      const constant = "value" in declaration;
      const binding: SemanticBinding = Object.freeze({
        id: Object.freeze({ sourceId: span.sourceId, span }),
        name: declaration.name.slice(declaration.name.lastIndexOf(".") + 1),
        qualifiedName: declaration.name,
        declaration: span,
        exported: true,
        storage: constant ? "constant" : "function",
        type: declaration.type,
        ...("effect" in declaration ? { operationEffect: declaration.effect } : {}),
      });
      return {
        binding,
        nameSpan: span,
        readonly: constant,
        known: "value" in declaration ? declaration.value : null,
        initialized: true,
        initializedRanges: Object.freeze([]),
        initializedPaths: Object.freeze([]),
      };
    }),
  );
}

/**
 * Find an early scalar fact through resolved imports or its qualified module name.
 * Lexical locals are checked by the caller first; real source declarations never get overwritten.
 */
export function resolveProfileConstant(
  states: readonly ScalarValueState[],
  graph: ModuleGraph,
  name: string,
  module: string,
  sourceId: string,
): ScalarValueState | null {
  const imported = graph.imports.find(
    (item) => item.sourceSpan.sourceId === sourceId && item.alias === name,
  );
  if (imported !== undefined) {
    return (
      states.find(
        ({ binding }) =>
          binding.storage === "constant" &&
          bindingIdentityKey(binding.id) === bindingIdentityKey(imported.binding),
      ) ?? null
    );
  }
  const qualifiedName = name.includes(".") ? name : `${module}.${name}`;
  if (graph.bindings.some((binding) => binding.qualifiedName === qualifiedName)) return null;
  return (
    states.find(
      ({ binding }) => binding.storage === "constant" && binding.qualifiedName === qualifiedName,
    ) ?? null
  );
}

/** Mutable declaration tables receiving the selected profile's typed declarations. */
export interface ProfileBindingHost {
  /** Every typed source and profile binding. */
  readonly bindings: SemanticBinding[];
  /** Lookup by stable source or profile identity. */
  readonly bindingByKey: Map<string, SemanticBinding>;
  /** Reaching state for every admitted declaration. */
  readonly stateByKey: Map<string, ScalarValueState>;
  /** Qualified profile declarations visible to source lookup. */
  readonly qualified: Map<string, ScalarValueState>;
  /** Module-local values, including selected constants in a source-contributed namespace. */
  readonly moduleScopes: Map<string, Map<string, ScalarValueState>>;
  /** Import aliases keyed by source file. */
  readonly importsBySource: Map<string, Map<string, ScalarValueState>>;
  /** Exact profile operation signatures. */
  readonly profileSignatures: Map<string, FunctionSignature>;
  /** Import errors with source spans. */
  readonly diagnostics: ProjectDiagnostic[];
}

/** Publish selected declarations and imports without replacing reserved source collisions. */
export function addProfileBindings(
  profile: FrontendProfile | null,
  graph: ModuleGraph,
  host: ProfileBindingHost,
  states: readonly ScalarValueState[] = createProfileBindings(profile),
): void {
  if (profile === null) return;
  for (const state of states) {
    const binding = state.binding;
    const qualifiedName = binding.qualifiedName!;
    const existing = host.bindings.find((item) => item.qualifiedName === qualifiedName);
    if (binding.storage === "constant" && existing !== undefined) {
      const source = host.stateByKey.get(bindingIdentityKey(existing.id));
      host.diagnostics.push(
        projectDiagnostic(
          "E10003",
          `Duplicate declaration '${binding.name}' in the same scope — also declared at ${state.nameSpan.sourceId}:1:${state.nameSpan.start + 1}`,
          source?.nameSpan ?? existing.declaration,
          null,
          [{ span: state.nameSpan, message: "Selected profile declaration is here" }],
        ),
      );
      continue;
    }
    const key = bindingIdentityKey(binding.id);
    host.bindings.push(binding);
    host.bindingByKey.set(key, binding);
    host.stateByKey.set(key, state);
    host.qualified.set(qualifiedName, state);
    if (binding.storage === "constant") {
      const moduleName = qualifiedName.slice(0, qualifiedName.lastIndexOf("."));
      const scope = host.moduleScopes.get(moduleName) ?? new Map<string, ScalarValueState>();
      scope.set(binding.name, state);
      host.moduleScopes.set(moduleName, scope);
    }
  }
  profile.capabilities.forEach((capability, index) => {
    host.profileSignatures.set(
      bindingIdentityKey(states[index]!.binding.id),
      Object.freeze({
        parameters: Object.freeze(
          capability.parameters.map((type) => Object.freeze({ type, readonly: false })),
        ),
        returnType: capability.returnType,
      }),
    );
  });
  // The module resolver already checked visibility and duplicate aliases. Reusing its
  // accepted identities keeps source and synthetic imports on the same lookup path.
  for (const imported of graph.imports) {
    const state = host.stateByKey.get(bindingIdentityKey(imported.binding));
    if (state === undefined || state.binding.storage === "type") continue;
    const aliases = host.importsBySource.get(imported.sourceSpan.sourceId) ?? new Map();
    aliases.set(imported.alias, state);
    host.importsBySource.set(imported.sourceSpan.sourceId, aliases);
  }
}
