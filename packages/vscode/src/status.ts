/** Truthful project states sent by the language server. */
export type ProjectStatusState =
  | "no-project"
  | "invalid"
  | "analyzing"
  | "ready"
  | "error"
  | "cancelled";

/** Narrow status notification consumed by the extension. */
export interface ProjectStatusParams {
  /** Stable discriminator. */
  readonly kind: "blend65.projectStatus";
  /** Version-one shape. */
  readonly schemaVersion: 1;
  /** Truthful state. */
  readonly state: ProjectStatusState;
  /** Project name when known. */
  readonly projectName: string | null;
  /** Effective profile when known. */
  readonly profileId: string | null;
  /** Triggering document URI. */
  readonly documentUri: string | null;
}

/** Return whether a value is a project state spelling. */
function isState(value: unknown): value is ProjectStatusState {
  return (
    value === "no-project" ||
    value === "invalid" ||
    value === "analyzing" ||
    value === "ready" ||
    value === "error" ||
    value === "cancelled"
  );
}

/** Parse one untrusted notification payload. */
export function parseProjectStatus(value: unknown): ProjectStatusParams | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.kind !== "blend65.projectStatus" ||
    record.schemaVersion !== 1 ||
    !isState(record.state) ||
    (record.projectName !== null && typeof record.projectName !== "string") ||
    (record.profileId !== null && typeof record.profileId !== "string") ||
    (record.documentUri !== null && typeof record.documentUri !== "string")
  ) {
    return null;
  }
  return value as ProjectStatusParams;
}

/** Render one compact status-bar line. */
export function statusText(status: ProjectStatusParams): string {
  switch (status.state) {
    case "no-project":
      return "Blend65: no project";
    case "invalid":
      return "Blend65: invalid project";
    case "analyzing":
      return "Blend65: analyzing…";
    case "ready": {
      const details = [status.projectName, status.profileId].filter(
        (value): value is string => value !== null,
      );
      return details.length === 0 ? "Blend65: ready" : `Blend65: ready — ${details.join(" · ")}`;
    }
    case "error":
      return "Blend65: error";
    case "cancelled":
      return "Blend65: cancelled";
  }
}
