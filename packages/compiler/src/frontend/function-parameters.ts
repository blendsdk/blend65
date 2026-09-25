import type { ProjectDiagnostic, SourceRecord, SourceSpan } from "../project/types.js";
import { duplicateDeclarationDiagnostic } from "./flow.js";
import { bindingIdentityKey, freezeSourceSpan } from "./semantic-types.js";
import type {
  BindingId,
  FunctionSignature,
  ScalarScope,
  ScalarValueState,
  SemanticBinding,
  SemanticType,
} from "./semantic-types.js";
import type { FunctionDeclaration } from "./syntax.js";

/** Services shared by ordinary and compile-time parameter binding. */
export interface FunctionParameterHost {
  /** Complete sources for a duplicate's first-declaration location. */
  readonly sources: ReadonlyMap<string, SourceRecord>;
  /** Ordered proving diagnostics. */
  readonly diagnostics: ProjectDiagnostic[];
  /** Mutable reaching states keyed by source identity. */
  readonly stateByKey: Map<string, ScalarValueState>;
  /** Publish a parameter binding without selecting a target home. */
  createBinding(
    name: string,
    span: SourceSpan,
    storage: "parameter",
    type: SemanticType,
    loadable: false,
    outerUnsized?: true,
  ): SemanticBinding;
}

/** Bind typed parameters to the function's initial lexical scope in source order. */
export function prepareFunctionParameters(
  declaration: FunctionDeclaration,
  signature: FunctionSignature,
  scope: ScalarScope,
  host: FunctionParameterHost,
): readonly BindingId[] {
  const parameters: BindingId[] = [];
  for (const [index, parameter] of declaration.parameters.entries()) {
    const shape = signature.parameters[index];
    if (shape === undefined) continue;
    const type = shape.type;
    const duplicate = scope.values.get(parameter.name);
    if (duplicate !== undefined) {
      host.diagnostics.push(
        duplicateDeclarationDiagnostic(
          parameter.name,
          parameter.nameSpan,
          duplicate,
          host.sources.get(duplicate.nameSpan.sourceId),
        ),
      );
      continue;
    }
    const binding = host.createBinding(
      parameter.name,
      parameter.span,
      "parameter",
      type,
      false,
      shape.outerUnsized,
    );
    const state: ScalarValueState = {
      binding,
      nameSpan: freezeSourceSpan(parameter.nameSpan),
      readonly: parameter.readonly,
      known: null,
      initialized: true,
      initializedRanges:
        type.kind === "array" ? Object.freeze([{ start: 0, end: type.length }]) : Object.freeze([]),
      initializedPaths: Object.freeze([]),
    };
    scope.values.set(parameter.name, state);
    host.stateByKey.set(bindingIdentityKey(binding.id), state);
    parameters.push(binding.id);
  }
  return Object.freeze(parameters);
}
