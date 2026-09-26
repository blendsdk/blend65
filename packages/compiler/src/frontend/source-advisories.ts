import type { ProjectDiagnostic } from "../project/types.js";
import { scalarWarning } from "./constants.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type { ScalarValueState } from "./semantic-types.js";
import type { FunctionInfo } from "./module-bindings.js";
import type { FrontendProfile } from "./profile.js";

/**
 * Report source declarations that have no use. References are captured during name
 * resolution, before constant evaluation can erase a source-level dependency.
 * The empty owner key holds module initializers and type-query dependencies.
 */
export function diagnoseUnusedDeclarations(
  states: ReadonlyMap<string, ScalarValueState>,
  functions: ReadonlyMap<string, FunctionInfo>,
  references: ReadonlyMap<string, ReadonlySet<string>>,
): readonly ProjectDiagnostic[] {
  const used = new Set<string>();
  for (const targets of references.values()) for (const target of targets) used.add(target);
  const reachable = new Set<string>();
  const pending = [""];
  for (const [key, info] of functions) {
    if (info.binding.exported || info.binding.name === "main") pending.push(key);
  }
  while (pending.length > 0) {
    const key = pending.pop()!;
    if (reachable.has(key)) continue;
    reachable.add(key);
    for (const target of references.get(key) ?? []) pending.push(target);
  }
  const diagnostics: ProjectDiagnostic[] = [];
  for (const [key, info] of functions) {
    if (!reachable.has(key))
      diagnostics.push(
        scalarWarning(
          "W10181",
          `Function '${info.binding.name}' is never called and not exported`,
          info.declaration.nameSpan,
        ),
      );
  }
  for (const [key, state] of states) {
    const binding = state.binding;
    if (
      binding.storage === "function" ||
      binding.storage === "type" ||
      binding.type === null ||
      binding.exported ||
      used.has(key)
    )
      continue;
    diagnostics.push(
      scalarWarning(
        "W10191",
        `Variable '${binding.name}' is declared but never used`,
        state.nameSpan,
      ),
    );
  }
  return Object.freeze(diagnostics);
}

/** Report per-declaration resource costs using only concrete selected-profile thresholds. */
export function diagnoseDeclarationResources(
  states: ReadonlyMap<string, ScalarValueState>,
  profile: FrontendProfile | null,
): readonly ProjectDiagnostic[] {
  if (profile === null) return Object.freeze([]);
  const diagnostics: ProjectDiagnostic[] = [];
  const seen = new Set<string>();
  for (const state of states.values()) {
    const binding = state.binding;
    const key = bindingIdentityKey(binding.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const type = binding.type;
    if (binding.zeropage && type?.kind === "struct" && type.size >= profile.warnStructZpSize) {
      diagnostics.push(
        scalarWarning(
          "W10110",
          `Struct '${binding.name}' uses ${type.size} zero-page bytes`,
          state.nameSpan,
        ),
      );
    }
    if (
      !state.readonly &&
      binding.storage !== "parameter" &&
      type?.kind === "array" &&
      profile.warnArraySize !== null &&
      type.size >= profile.warnArraySize
    ) {
      diagnostics.push(
        scalarWarning(
          "W10143",
          `Mutable array '${binding.name}' uses ${type.size} RAM bytes on platform '${profile.id}'`,
          state.nameSpan,
        ),
      );
    }
  }
  return Object.freeze(diagnostics);
}
