/** Exact project-relative input spelling; separators are forward slashes. */
export type SourceId = string;

/** Fixed result discriminators shared by project validators. */
export const RESULT_KIND = Object.freeze({
  /** A complete accepted value is available. */
  success: "success",
  /** Only proving diagnostics or a failed name predicate are available. */
  failure: "failure",
});

/** Optimization preference recorded by a manifest, not an implemented optimizer. */
export type OptimizationGoal = "none" | "balanced" | "speed" | "size";

/** An exclusive-end span in the input's raw UTF-8 bytes. */
export interface SourceSpan {
  /** Exact input identity, without an absolute host root. */
  readonly sourceId: SourceId;
  /** Inclusive zero-based byte offset. */
  readonly start: number;
  /** Exclusive zero-based byte offset. */
  readonly end: number;
}

/** Declarative project configuration with all defaults made explicit. */
export interface ProjectManifest {
  /** Supported declarative schema identity. */
  readonly schemaVersion: 1;
  /** Literal artifact basename; never normalized or rewritten. */
  readonly name: string;
  /** Native-host source directory spelling, relative to the manifest. */
  readonly sourceRoot: string;
  /** Qualified ASCII module name, not a source filename. */
  readonly entry: string;
  /** Complete qualified platform-profile identity. */
  readonly target: string;
  /** Ordered native-host asset search directory spellings. */
  readonly assetPaths: readonly string[];
  /** Native-host output directory spelling, relative to the manifest. */
  readonly outDir: string;
  /** Requested optimization goal. */
  readonly optimization: OptimizationGoal;
  /** Whether later compilation should check bounds. */
  readonly boundsCheck: boolean;
  /** Whether later compilation should check division by zero. */
  readonly divisionZeroCheck: boolean;
}

/** Structured host-service failure or observation, suitable for CLI/editor consumers. */
export interface ProjectDiagnostic {
  /** Stable host identifier, or the normative compiler identifier for a profile error. */
  readonly code: string;
  /** Errors prevent acceptance; warnings are observations. */
  readonly severity: "error" | "warning";
  /** Safe human-readable explanation without host stacks or full source content. */
  readonly message: string;
  /** Proving raw-byte span, or null when no trusted span is available. */
  readonly primarySpan: SourceSpan | null;
  /** Additional proving locations, such as a duplicate key's first occurrence. */
  readonly related: readonly {
    /** Additional raw-byte location. */
    readonly span: SourceSpan;
    /** Explanation of that location. */
    readonly message: string;
  }[];
  /** Optional corrective guidance; never a silently rewritten value. */
  readonly help: string | null;
  /** JSON pointer to a responsible field, or null for a non-field failure. */
  readonly pointer: string | null;
}

/** Complete manifest acceptance or diagnostics; failures never expose a partial manifest. */
export type ManifestParseResult =
  | {
      /** A fully valid pure schema result. */
      readonly kind: "success";
      /** Accepted exact field values and explicit defaults. */
      readonly manifest: ProjectManifest;
    }
  | {
      /** No usable configuration is available. */
      readonly kind: "failure";
      /** Deterministically ordered proving errors. */
      readonly diagnostics: readonly ProjectDiagnostic[];
    };

/** Exact portable basename acceptance or the first predicate that failed. */
export type NameValidationResult =
  | {
      /** The spelling can be preserved literally. */
      readonly kind: "success";
    }
  | {
      /** The spelling cannot be used without alteration. */
      readonly kind: "failure";
      /** Predicate checked in a fixed order, without host-dependent normalization. */
      readonly reason:
        | "empty"
        | "ill-formed-unicode"
        | "forbidden-character"
        | "trailing-character"
        | "dot-name"
        | "reserved-device-stem";
      /** Raw offending spelling; null only for an empty name. */
      readonly offending: string | null;
    };
