import type { FailureCategory, ProjectDiagnostic } from "@blend65/compiler";

/** One diagnostic with compiler byte spans. */
export interface CliJsonDiagnostic {
  /** Stable diagnostic code. */
  readonly code: string;
  /** Severity spelling. */
  readonly severity: "error" | "warning";
  /** Human-readable message. */
  readonly message: string;
  /** Exact primary byte span, or null. */
  readonly primarySpan: ProjectDiagnostic["primarySpan"];
  /** Ordered related spans. */
  readonly related: readonly {
    readonly span: ProjectDiagnostic["related"][number]["span"];
    readonly message: string;
  }[];
  /** Optional remedy. */
  readonly help: string | null;
  /** Optional JSON pointer. */
  readonly pointer: string | null;
}

/** Stable machine-readable CLI result. */
export interface CliJsonEnvelope {
  /** Envelope discriminator. */
  readonly kind: "blend65.cli";
  /** Version-one shape. */
  readonly schemaVersion: 1;
  /** Invoked command. */
  readonly command: "check" | "build" | "run" | "evidence" | "help" | "version";
  /** Closed outcome. */
  readonly outcome: "success" | "diagnostics" | "failure" | "invalid-arguments" | "cancelled";
  /** Process status. */
  readonly exitStatus: number;
  /** Selected profile when known. */
  readonly profileId?: string;
  /** Ordered diagnostics. */
  readonly diagnostics: readonly CliJsonDiagnostic[];
  /** Published generation when the command produced one. */
  readonly generation?: {
    readonly generationId: string;
    readonly directory: string;
    readonly buildJsonSha256: string;
    readonly primaryArtifact: string;
  };
  /** Run result when the command launched the emulator. */
  readonly run?: {
    readonly status: "exited";
    readonly verification: "interactive-unverified";
  };
  /** Failure category and safe summary. */
  readonly failure?: {
    readonly category: FailureCategory;
    readonly message: string;
  };
  /** Validated current evidence, when requested. */
  readonly evidence?: {
    readonly current: true;
    readonly generationId: string;
    readonly directory: string;
    readonly artifacts: readonly {
      readonly role: string;
      readonly path: string;
      readonly sha256: string;
    }[];
  };
}

/** Convert one compiler diagnostic to the machine-readable record. */
export function cliDiagnostic(diagnostic: ProjectDiagnostic): CliJsonDiagnostic {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    primarySpan: diagnostic.primarySpan,
    related: diagnostic.related.map(({ span, message }) => ({ span, message })),
    help: diagnostic.help,
    pointer: diagnostic.pointer,
  };
}

/** Serialize one envelope as exactly one canonical line. */
export function encodeEnvelope(envelope: CliJsonEnvelope): string {
  return JSON.stringify(envelope) + "\n";
}
