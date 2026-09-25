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

/** Mutable declaration tables receiving the selected profile's typed operations. */
export interface ProfileBindingHost {
  /** Every typed source and profile binding. */
  readonly bindings: SemanticBinding[];
  /** Lookup by stable source or profile identity. */
  readonly bindingByKey: Map<string, SemanticBinding>;
  /** Reaching state for every admitted operation. */
  readonly stateByKey: Map<string, ScalarValueState>;
  /** Qualified profile operations visible to source lookup. */
  readonly qualified: Map<string, ScalarValueState>;
  /** Import aliases keyed by source file. */
  readonly importsBySource: Map<string, Map<string, ScalarValueState>>;
  /** Exact profile operation signatures. */
  readonly profileSignatures: Map<string, FunctionSignature>;
  /** Import errors with source spans. */
  readonly diagnostics: ProjectDiagnostic[];
}

/** Add only the selected profile's closed typed operations to the source environment. */
export function addProfileBindings(
  profile: FrontendProfile | null,
  graph: ModuleGraph,
  host: ProfileBindingHost,
): void {
  if (profile === null) return;
  const profileModules = new Set(
    profile.capabilities.map(({ name }) => name.slice(0, name.lastIndexOf("."))),
  );
  profile.capabilities.forEach((capability, index) => {
    const name = capability.name.slice(capability.name.lastIndexOf(".") + 1);
    const span = Object.freeze({
      sourceId: `profile:${profile.id}`,
      start: index,
      end: index + 1,
    });
    const binding: SemanticBinding = Object.freeze({
      id: Object.freeze({ sourceId: span.sourceId, span }),
      name,
      qualifiedName: capability.name,
      declaration: span,
      exported: true,
      storage: "function",
      type: capability.returnType,
      operationEffect: capability.effect,
    });
    const state: ScalarValueState = {
      binding,
      nameSpan: span,
      readonly: false,
      known: null,
      initialized: true,
      initializedRanges: Object.freeze([]),
      initializedPaths: Object.freeze([]),
    };
    const key = bindingIdentityKey(binding.id);
    host.bindings.push(binding);
    host.bindingByKey.set(key, binding);
    host.stateByKey.set(key, state);
    host.qualified.set(capability.name, state);
    host.profileSignatures.set(
      key,
      Object.freeze({
        parameters: Object.freeze(
          capability.parameters.map((type) => Object.freeze({ type, readonly: false })),
        ),
        returnType: capability.returnType,
      }),
    );
  });
  for (const module of graph.modules) {
    for (const unit of module.units) {
      for (const imported of unit.imports) {
        if (!profileModules.has(imported.module)) continue;
        const aliases = host.importsBySource.get(unit.span.sourceId) ?? new Map();
        for (const item of imported.items) {
          const capability = host.qualified.get(`${imported.module}.${item.name}`);
          if (capability === undefined) {
            host.diagnostics.push(
              projectDiagnostic(
                "E10012",
                `'${item.name}' is not exported from module '${imported.module}'`,
                item.nameSpan,
              ),
            );
            continue;
          }
          aliases.set(item.alias ?? item.name, capability);
        }
        host.importsBySource.set(unit.span.sourceId, aliases);
      }
    }
  }
}
