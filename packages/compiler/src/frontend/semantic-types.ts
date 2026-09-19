import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { ModuleHeader, SyntaxUnit } from "./syntax.js";

/** Stable reasons why a later analysis stage cannot yet finish. */
export const ANALYSIS_OBLIGATION_KIND = Object.freeze({
  /** Source syntax remains incomplete. */
  syntax: "syntax",
  /** The admitted compiler slice does not implement the source form yet. */
  implementation: "implementation",
  /** A named source dependency is unavailable. */
  dependency: "dependency",
  /** A target profile must provide the requested declaration. */
  profile: "profile",
  /** An asset must be loaded before analysis can finish. */
  asset: "asset",
  /** A defensive analysis bound was reached. */
  analysisLimit: "analysis-limit",
} as const);

/** One explicit reason why analysis is incomplete without inventing a diagnostic. */
export interface AnalysisObligation {
  /** Stable obligation category. */
  readonly kind: (typeof ANALYSIS_OBLIGATION_KIND)[keyof typeof ANALYSIS_OBLIGATION_KIND];
  /** Responsible source region, or null when no source location exists. */
  readonly span: SourceSpan | null;
  /** Human-readable description of the remaining work. */
  readonly message: string;
}

/** One source file contributing declarations to a named module. */
export interface ModuleContribution {
  /** Exact project-relative source identity. */
  readonly sourceId: string;
  /** Header discovered without parsing the source body. */
  readonly header: ModuleHeader;
}

/** All source contributions grouped by exact, case-sensitive module name. */
export interface ModuleIndex {
  /** Modules sorted by the UTF-8 bytes of their names. */
  readonly modules: readonly {
    /** Exact qualified module name. */
    readonly name: string;
    /** Contributions sorted by the UTF-8 bytes of their source identities. */
    readonly contributions: readonly ModuleContribution[];
  }[];
}

/** Result of header-only module discovery. */
export interface ModuleIndexResult {
  /** Usable index of every successfully discovered header. */
  readonly index: ModuleIndex;
  /** Proving header diagnostics in deterministic order. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Whether every source header was checked successfully. */
  readonly complete: boolean;
  /** Remaining non-diagnostic work needed for completion. */
  readonly obligations: readonly AnalysisObligation[];
}

/** Stable declaration identity based only on source facts. */
export interface BindingId {
  /** Source containing the declaration. */
  readonly sourceId: string;
  /** Complete declaration span. */
  readonly span: SourceSpan;
}

/** Storage role known before body type analysis. */
export type BindingStorage = "module" | "local" | "parameter" | "constant" | "function" | "type";

/** One declaration admitted into a module scope. */
export interface Binding {
  /** Stable source-based declaration identity. */
  readonly id: BindingId;
  /** Unqualified declaration name. */
  readonly name: string;
  /** Module-qualified presentation name, or null for a local binding. */
  readonly qualifiedName: string | null;
  /** Complete declaration span. */
  readonly declaration: SourceSpan;
  /** Whether other modules may name the declaration. */
  readonly exported: boolean;
  /** Declaration's storage role. */
  readonly storage: BindingStorage;
}

/** One resolved named import and its source-local spelling. */
export interface ResolvedImport {
  /** Complete imported item span. */
  readonly sourceSpan: SourceSpan;
  /** Name visible in the importing module. */
  readonly alias: string;
  /** Identity of the exported target declaration. */
  readonly binding: BindingId;
}

/** Parsed source graph reachable from the selected entry module. */
export interface ModuleGraph {
  /** Reachable modules in deterministic name order. */
  readonly modules: readonly {
    /** Exact qualified module name. */
    readonly name: string;
    /** Parsed contributions in deterministic source order. */
    readonly units: readonly SyntaxUnit[];
  }[];
  /** Admitted module declarations in source-span order. */
  readonly bindings: readonly Binding[];
  /** Resolved named imports in source-span order. */
  readonly imports: readonly ResolvedImport[];
  /** Accepted program entry declaration, or null. */
  readonly entry: BindingId | null;
}

/** Result of selecting and resolving a source module graph. */
export interface ModuleGraphResult {
  /** Intermediate graph, or null when no selected graph can be formed. */
  readonly graph: ModuleGraph | null;
  /** Proving module diagnostics in deterministic order. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Whether every module-graph obligation completed without error. */
  readonly complete: boolean;
  /** Remaining non-diagnostic work needed for completion. */
  readonly obligations: readonly AnalysisObligation[];
}
