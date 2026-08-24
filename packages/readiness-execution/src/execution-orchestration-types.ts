/** Inclusive route count that one version-one authority report can retain. */
export const EXECUTION_AUTHORITY_REPORT_ROUTE_LIMIT_V1 = 4_096;

/** Availability and bounded version evidence for local execution tools. */
export interface ExecutionEnvironmentCapabilitiesV1 {
  /** ACME assembler availability. */
  readonly acme: {
    /** Whether the assembler probe succeeded. */
    readonly available: boolean;
    /** Optional machine-neutral version returned by a successful probe. */
    readonly version?: string;
  };
  /** VICE emulator availability. */
  readonly vice: {
    /** Whether the emulator probe succeeded. */
    readonly available: boolean;
    /** Optional machine-neutral version returned by a successful probe. */
    readonly version?: string;
  };
}

/** One canonical local tool version retained in an execution authority report. */
export interface ExecutionToolVersionV1 {
  /** Stable tool identifier. */
  readonly tool: "node" | "acme" | "vice";
  /** Bounded version text or the stable availability classification. */
  readonly version: string;
}

/** Minimal process-independent command I/O boundary. */
export interface ExecutionCliIoV1 {
  /** Canonical repository root used as the command working directory. */
  readonly cwd: string;
  /** Writes one complete machine-neutral standard-output fragment. */
  writeOut(text: string): void;
  /** Writes one complete machine-neutral standard-error fragment. */
  writeErr(text: string): void;
}
