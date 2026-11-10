/**
 * Structural mirror of the CLI `blend65.cli` schema-version 1 envelope.
 *
 * The extension must not import `@blend65/cli` in source: that package owns the
 * compiler backend, and a source edge would make the thin editor transitively
 * reach lowering and code generation. The CLI binary is resolved at runtime and
 * spawned as a child process; this file carries only the wire shape.
 */

/** One diagnostic with compiler byte spans. */
export interface CliJsonDiagnostic {
  /** Stable diagnostic code. */
  readonly code: string;
  /** Severity spelling. */
  readonly severity: "error" | "warning";
  /** Human-readable message. */
  readonly message: string;
  /** Exact primary byte span, or null. */
  readonly primarySpan: {
    readonly sourceId: string;
    readonly start: number;
    readonly end: number;
  } | null;
  /** Ordered related spans. */
  readonly related: readonly {
    readonly span: { readonly sourceId: string; readonly start: number; readonly end: number };
    readonly message: string;
  }[];
  /** Optional remedy. */
  readonly help: string | null;
  /** Optional JSON pointer. */
  readonly pointer: string | null;
}

/** Stable machine-readable CLI result consumed by the extension. */
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
    readonly category: string;
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
