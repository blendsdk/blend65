import { projectDiagnostic } from "../project/diagnostics.js";
import type { SourceSpan } from "../project/types.js";
import { scalarSyntaxType } from "./constants.js";
import { bindingIdentityKey, freezeSourceSpan } from "./semantic-types.js";
import { semanticTypeSize } from "./semantic-type-relations.js";
import type { AggregateRegistryHost, BindingId, StructType } from "./semantic-types.js";
import type { StructDeclaration, TypeSyntax } from "./syntax.js";

/** Locate a forbidden `void` element inside a stored array type. */
export function voidTypeSpan(type: TypeSyntax): SourceSpan | null {
  if (type.kind === "named-type") return type.name === "void" ? type.span : null;
  return type.kind === "array-type" ? voidTypeSpan(type.element) : null;
}

/** Build the current packed scalar-field struct shape without adding padding. */
export function buildScalarStruct(
  declaration: StructDeclaration,
  binding: BindingId,
  host: AggregateRegistryHost,
  deferredStructs: Set<string>,
): StructType | null {
  if (declaration.fields.length === 0) return null;
  let offset = 0;
  const fields: StructType["fields"][number][] = [];
  for (const field of declaration.fields) {
    if (field.type?.kind === "named-type" && field.type.name === "void") {
      host.diagnose(
        projectDiagnostic(
          "SEMANTIC_ERROR",
          "Type 'void' cannot be used as a struct field",
          field.type.span,
        ),
      );
      return null;
    }
    const voidElement = field.type?.kind === "array-type" ? voidTypeSpan(field.type.element) : null;
    if (voidElement !== null) {
      host.diagnose(
        projectDiagnostic(
          "SEMANTIC_ERROR",
          "Type 'void' cannot be used as an array element",
          voidElement,
        ),
      );
      return null;
    }
    const type = scalarSyntaxType(field.type);
    if (type === null) {
      deferredStructs.add(bindingIdentityKey(binding));
      host.defer(field.span, "Non-scalar struct field layout remains pending");
      return null;
    }
    fields.push(Object.freeze({ name: field.name, type, offset }));
    offset += semanticTypeSize(type);
  }
  if (offset > 65535) {
    host.diagnose(
      projectDiagnostic(
        "E10265",
        `Type '${declaration.name}' requires ${offset} bytes — fixed array and struct types are limited to 65535 bytes`,
        declaration.span,
      ),
    );
    return null;
  }
  return Object.freeze({
    kind: "struct",
    binding: Object.freeze({ sourceId: binding.sourceId, span: freezeSourceSpan(binding.span) }),
    size: offset,
    fields: Object.freeze(fields),
  });
}
