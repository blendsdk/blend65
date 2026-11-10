import type { AnalysisResult, ProjectSnapshot, ToolingIndex } from "@blend65/compiler/frontend";

/** Truthful editor-facing project states. */
export type ProjectState = "no-project" | "invalid" | "analyzing" | "ready" | "error" | "cancelled";

/** One analyzed project context retained for editor queries. */
export interface ProjectContext {
  /** Immutable saved snapshot used for this analysis. */
  readonly snapshot: ProjectSnapshot;
  /** Complete or partial frontend result. */
  readonly result: AnalysisResult;
  /** Tooling facts, or null when the result has no admitted typed program. */
  readonly index: ToolingIndex | null;
  /** Monotonic analysis generation. */
  readonly generation: number;
  /** Document versions consumed by this analysis. */
  readonly analyzedVersions: ReadonlyMap<string, number>;
  /** Document URI to project-relative source identity. */
  readonly documentSources: ReadonlyMap<string, string>;
}

/** Status payload sent to the thin VS Code client. */
export interface ProjectStatusNotification {
  /** Stable discriminator. */
  readonly kind: "blend65.projectStatus";
  /** Version-one protocol shape. */
  readonly schemaVersion: 1;
  /** Truthful state. */
  readonly state: ProjectState;
  /** Project name when known. */
  readonly projectName: string | null;
  /** Effective profile when known. */
  readonly profileId: string | null;
  /** Triggering document URI. */
  readonly documentUri: string | null;
}

/** Retain one context per canonical project root and bound their lifetime. */
export class ContextStore {
  private readonly contexts = new Map<string, ProjectContext>();

  /** Replace the context for one root. */
  set(root: string, context: ProjectContext): void {
    this.contexts.set(root, context);
  }

  /** Read one context without creating a placeholder. */
  get(root: string): ProjectContext | undefined {
    return this.contexts.get(root);
  }

  /** Drop one project's retained facts. */
  delete(root: string): void {
    this.contexts.delete(root);
  }

  /** Drop every retained context. */
  clear(): void {
    this.contexts.clear();
  }

  /** Number of retained contexts. */
  get size(): number {
    return this.contexts.size;
  }

  /** Build the truthful status payload for one context. */
  status(root: string, documentUri: string | null, state: ProjectState): ProjectStatusNotification {
    const context = this.contexts.get(root);
    return {
      kind: "blend65.projectStatus",
      schemaVersion: 1,
      state,
      projectName: context?.snapshot.manifest.name ?? null,
      profileId: context?.snapshot.effectiveTarget ?? null,
      documentUri,
    };
  }
}
