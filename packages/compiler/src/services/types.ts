import type { ProjectDiagnostic, ProjectLoadOptions } from "../project/types.js";
import type { PublishedGeneration } from "../publication/publication.js";

/** Stable failure categories shared by the library and command-line interface. */
export type FailureCategory =
  | "source"
  | "compiler"
  | "assembler"
  | "packaging"
  | "tool-discovery"
  | "emulator-start"
  | "emulator-runtime"
  | "cancelled"
  | "recovery-required";

/** Bounded host measurements that never pretend unavailable evidence is known. */
export interface ServiceMeasurements {
  /** Elapsed wall-clock milliseconds, or `Unknown` when the host cannot report it. */
  readonly durationMilliseconds: number | "Unknown";
  /** Peak resident bytes, or `Unknown` when the host cannot report it portably. */
  readonly peakRssBytes: number | "Unknown";
}

/** Project discovery and cancellation inputs accepted by a semantic check. */
export interface CheckOptions extends ProjectLoadOptions {
  /** Caller-owned cancellation signal. */
  readonly signal?: AbortSignal;
}

/** Build inputs with an optional code-size optimization selection. */
export interface BuildOptions extends CheckOptions {
  /** Override the manifest goal with direct lowering, balanced, speed or size optimization. */
  readonly optimization?: "none" | "balanced" | "speed" | "size";
  /** Override the manifest's bounds-check setting. */
  readonly boundsCheck?: boolean;
  /** Override the manifest's division-by-zero check setting. */
  readonly divisionZeroCheck?: boolean;
  /**
   * Optional absolute ACME executable selected by the caller's machine-local tools file.
   * When present it wins over `PATH` and an invalid path fails without fallback.
   */
  readonly acmePath?: string;
}

/** Run inputs are exactly the inputs accepted by a fresh build plus the VICE selection. */
export interface RunOptions extends BuildOptions {
  /**
   * Optional absolute VICE `x64sc` executable selected by the caller's machine-local tools file.
   * When present it wins over `PATH` and an invalid path fails without fallback.
   */
  readonly x64scPath?: string;
}

/** One expected service failure with structured diagnostics. */
export interface ServiceFailure {
  /** Failure discriminator. */
  readonly kind: "failure";
  /** Stable category used by non-text consumers. */
  readonly category: FailureCategory;
  /** Safe proving diagnostics in deterministic order. */
  readonly diagnostics: readonly ProjectDiagnostic[];
}

/** Successful complete compiler check. */
export interface CheckSuccess {
  /** Success discriminator. */
  readonly kind: "success";
  /** Fresh immutable project-input identity. */
  readonly snapshotSha256: string;
  /** Exact selected target profile. */
  readonly profileId: string;
  /** Non-error observations retained from project loading. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Bounded host measurements for this invocation. */
  readonly measurements: ServiceMeasurements;
}

/** Complete check result with no partial success variant. */
export type CheckResult = ServiceFailure | CheckSuccess;

/** Successful immutable build publication. */
export interface BuildSuccess {
  /** Success discriminator. */
  readonly kind: "success";
  /** Exact generation committed by this build. */
  readonly generation: PublishedGeneration;
  /** Non-error observations retained from project loading. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Bounded host measurements for this invocation. */
  readonly measurements: ServiceMeasurements;
}

/** Complete build result with expected failures represented as data. */
export type BuildResult = ServiceFailure | BuildSuccess;

/** Successful interactive emulator session after its owned process exits. */
export interface RunSuccess {
  /** Success discriminator. */
  readonly kind: "success";
  /** Exact generation built and launched by this invocation. */
  readonly generation: PublishedGeneration;
  /** Interactive run completion state. */
  readonly status: "exited";
  /** Interactive execution is intentionally not an automated behavior proof. */
  readonly verification: "interactive-unverified";
  /** Non-error observations retained from project loading. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Bounded host measurements for the complete build-and-run invocation. */
  readonly measurements: ServiceMeasurements;
}

/** Complete run result with expected failures represented as data. */
export type RunResult = ServiceFailure | RunSuccess;
