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

/** Immutable decoded input with a raw-byte content hash and separate host path. */
export interface SourceRecord {
  /** Exact project-relative input spelling. */
  readonly sourceId: SourceId;
  /** Exact UTF-8 text, including any leading BOM and original line endings. */
  readonly text: string;
  /** Lowercase SHA-256 of the original bytes. */
  readonly sha256: string;
  /** Raw byte count, not UTF-16 character count. */
  readonly byteLength: number;
  /** Canonical host path; never an input to the combined content identity. */
  readonly resolvedPath: string;
}

/** Complete observed and revalidated input set; not a filesystem transaction. */
export interface ProjectSnapshot {
  /** Exact declarative values with defaults applied. */
  readonly manifest: ProjectManifest;
  /** Original manifest input, without normalization. */
  readonly manifestSource: SourceRecord;
  /** Exact-name, bytewise-sorted accepted source inputs. */
  readonly sources: readonly SourceRecord[];
  /** Versioned hash of relative names, raw hashes and invocation overrides. */
  readonly inputSha256: string;
  /** Canonical manifest directory. */
  readonly projectRoot: string;
  /** Canonical source directory. */
  readonly sourceRoot: string;
  /** Canonical asset directories in manifest order; asset contents are not read. */
  readonly assetPaths: readonly string[];
  /** Validated output location, not created by loading. */
  readonly outDir: string;
  /** Invocation selections, kept separate from the unchanged manifest. */
  readonly overrides: {
    /** Explicit qualified target profile, or null if omitted. */
    readonly target: string | null;
    /** Explicit qualified entry module, or null if omitted. */
    readonly entry: string | null;
  };
  /** Manifest target after applying a valid invocation override. */
  readonly effectiveTarget: string;
  /** Manifest entry after applying a valid invocation override. */
  readonly effectiveEntry: string;
}

/** Host invocation options; paths are interpreted on the actual native host. */
export interface ProjectLoadOptions {
  /** Starting directory; omitted means process.cwd(). */
  readonly cwd?: string;
  /** Authoritative manifest selector, relative to cwd or absolute. */
  readonly project?: string;
  /** Invocation-only qualified target profile. */
  readonly target?: string;
  /** Invocation-only qualified module identity, not a filename. */
  readonly entry?: string;
  /** Optional cancellation for bounded host discovery and source reads. */
  readonly signal?: AbortSignal;
}

/** A complete immutable snapshot, or diagnostics with no usable partial input. */
export type ProjectLoadResult =
  | {
      /** The complete input set passed validation and revalidation. */
      readonly kind: "success";
      /** Accepted immutable source and manifest records. */
      readonly snapshot: ProjectSnapshot;
      /** Non-error host observations excluded from input identity. */
      readonly observations: readonly ProjectDiagnostic[];
    }
  | {
      /** No snapshot is available. */
      readonly kind: "failure";
      /** Deterministically ordered root failures. */
      readonly diagnostics: readonly ProjectDiagnostic[];
    };

/** Private host-safety bounds, not target resource or manifest settings. */
export interface ProjectLimits {
  /** Maximum raw manifest bytes. */
  readonly manifestBytes: number;
  /** Maximum raw bytes in each source. */
  readonly sourceBytes: number;
  /** Maximum unique manifest/source bytes admitted per attempt. */
  readonly totalBytes: number;
  /** Maximum source inputs per attempt. */
  readonly sourceFiles: number;
  /** Maximum visited source directory entries per attempt. */
  readonly visitedEntries: number;
  /** Maximum source-tree depth, with its root at zero. */
  readonly depth: number;
  /** Maximum complete attempts, including the first. */
  readonly attempts: number;
}

/** Private awaited boundaries for deterministic mutation of real test fixtures. */
export interface LoadCheckpoint {
  /** Exact loader boundary; input boundaries also occur during revalidation. */
  readonly phase:
    | "after-manifest"
    | "after-paths"
    | "after-inventory"
    | "before-open"
    | "after-open"
    | "after-read"
    | "before-revalidation"
    | "after-revalidation-inventory"
    | "after-revalidation-read";
  /** One-based complete attempt number. */
  readonly attempt: number;
  /** Exact input spelling, or null at an aggregate boundary. */
  readonly sourceId: SourceId | null;
}

/** Trusted private controls; no host, reader, handle or hash is replaceable. */
export interface ProjectLoadControls {
  /** Integer reductions of the fixed production limits only. */
  readonly limits?: Partial<ProjectLimits>;
  /** Awaited fixture mutation; exceptions propagate as programmer failures. */
  readonly onCheckpoint?: (point: LoadCheckpoint) => void | Promise<void>;
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
