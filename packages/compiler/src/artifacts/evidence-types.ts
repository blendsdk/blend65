/** JSON scalar admitted by evidence records. */
export type EvidenceScalar = string | number | boolean;

/** Recursive JSON value admitted by a versioned evidence record. */
export type EvidenceValue =
  | EvidenceScalar
  | readonly EvidenceValue[]
  | { readonly [key: string]: EvidenceValue };

/** Closed JSON object used for record families populated by later compiler stages. */
export type EvidenceRecord = { readonly [key: string]: EvidenceValue };

/** Portable content identity shared by build and debug evidence. */
export interface EvidenceIdentity {
  /** Stable component name. */
  readonly name: string;
  /** Qualified release version. */
  readonly version: string;
  /** Lowercase SHA-256 content identity. */
  readonly sha256: string;
}

/** File digest retained in the semantic input inventory. */
export interface EvidenceDigest {
  /** Project-relative portable path. */
  readonly path: string;
  /** Exact byte count. */
  readonly bytes: number;
  /** Lowercase SHA-256 of the bytes. */
  readonly sha256: string;
}

/** Published artifact digest retained by build evidence. */
export interface EvidenceArtifactDigest extends EvidenceDigest {
  /** Artifact role in the exact generation. */
  readonly kind: "primary" | "assembly" | "labels" | "assets" | "memory" | "costs" | "debug";
}

/** Complete portable and host-separated successful-build evidence. */
export interface BuildEvidence {
  /** Sidecar discriminator. */
  readonly kind: "blend65.build";
  /** Independently versioned schema major. */
  readonly schemaVersion: 1;
  /** Canonical lowercase UUID v4 publication identity. */
  readonly generationId: string;
  /** Exact semantic inputs which can affect generated output. */
  readonly semanticInputs: {
    readonly projectName: string;
    readonly sourceRoot: string;
    readonly entryModule: string;
    readonly assetSearchPaths: readonly string[];
    readonly manifest: EvidenceDigest;
    readonly sources: readonly EvidenceDigest[];
    readonly assets: readonly EvidenceDigest[];
    readonly compiler: EvidenceIdentity;
    readonly specification: EvidenceIdentity;
    readonly expertSkill: EvidenceIdentity;
    readonly target: {
      readonly profileId: string;
      readonly cpuId: string;
      readonly emitterId: string;
      readonly packagerId: string;
    };
    readonly options: {
      readonly optimization: "none" | "balanced" | "speed" | "size";
      readonly boundsCheck: boolean;
      readonly divisionZeroCheck: boolean;
    };
    readonly overrides: readonly EvidenceRecord[];
  };
  /** Portable output-affecting tool identities and ordered options. */
  readonly portableTools: readonly {
    readonly name: string;
    readonly version: string;
    readonly semanticOptions: readonly string[];
  }[];
  /** Host-only provenance excluded from portable comparison. */
  readonly hostProvenance: {
    readonly platform: "linux" | "win32";
    readonly architecture: "x64";
    readonly nodeVersion: string;
    readonly tools: readonly {
      readonly name: string;
      readonly canonicalPath: string;
      readonly sha256: string;
    }[];
    readonly durationMilliseconds: number | "Unknown";
    readonly peakRssBytes: number | "Unknown";
  };
  /** Selected package facts. */
  readonly package: EvidenceRecord;
  /** Every published artifact except this build sidecar. */
  readonly artifacts: readonly EvidenceArtifactDigest[];
}

/** Selected asset values and their final placement evidence. */
export interface AssetsEvidence {
  /** Sidecar discriminator. */
  readonly kind: "blend65.assets";
  /** Independently versioned schema major. */
  readonly schemaVersion: 1;
  /** Canonically ordered selected asset records. */
  readonly assets: readonly EvidenceRecord[];
}

/** Reconciled physical memory and stack evidence. */
export interface MemoryEvidence {
  /** Sidecar discriminator. */
  readonly kind: "blend65.memory";
  /** Independently versioned schema major. */
  readonly schemaVersion: 1;
  /** Selected target profile identity. */
  readonly profileId: string;
  /** Hash of the ordered final SFA interval projection. */
  readonly sfaClosureSha256: string;
  /** Proof that ACME output was reconciled. */
  readonly acmeReconciled: true;
  /** Honest whole-program static memory-safety status. */
  readonly runtimeMemorySafety: "proved" | "unproven";
  /** Canonically ordered residency records. */
  readonly residencies: readonly EvidenceRecord[];
  /** Low-level effects outside the bounded ledger. */
  readonly unboundedEffects: readonly EvidenceRecord[];
  /** Canonically ordered physical intervals. */
  readonly intervals: readonly EvidenceRecord[];
  /** Reconciled consumer views. */
  readonly views: readonly EvidenceRecord[];
  /** Bounded hardware-stack routes. */
  readonly stackDomains: readonly EvidenceRecord[];
}

/** Final code, cycle, resource, and optimizer-decision evidence. */
export interface CostsEvidence {
  /** Sidecar discriminator. */
  readonly kind: "blend65.costs";
  /** Independently versioned schema major. */
  readonly schemaVersion: 1;
  /** Selected optimization mode. */
  readonly mode: "none" | "balanced" | "speed" | "size";
  /** Final selected cost vector. */
  readonly totals: {
    readonly programBytes: number;
    readonly pathCycles: readonly EvidenceRecord[];
    readonly resources: readonly EvidenceRecord[];
  };
  /** Canonically ordered final cost entries. */
  readonly entries: readonly EvidenceRecord[];
  /** Consequential optimizer decisions; empty in none mode. */
  readonly decisions: readonly EvidenceRecord[];
}

/** Source-to-machine debug and traceability evidence. */
export interface DebugEvidence {
  /** Sidecar discriminator. */
  readonly kind: "blend65.debug";
  /** Independently versioned schema major. */
  readonly schemaVersion: 1;
  /** Compiler content identity. */
  readonly compiler: EvidenceIdentity;
  /** Language specification content identity. */
  readonly specification: EvidenceIdentity;
  /** Expert authority content identity. */
  readonly expertSkill: EvidenceIdentity;
  /** Selected profile identity. */
  readonly profileId: string;
  /** Selected CPU identity. */
  readonly cpuId: string;
  /** Selected optimization mode. */
  readonly optimization: "none" | "balanced" | "speed" | "size";
  /** Enabled language safety checks. */
  readonly safety: { readonly boundsCheck: boolean; readonly divisionZeroCheck: boolean };
  /** Primary published artifact identity. */
  readonly primaryArtifact: {
    readonly path: string;
    readonly kind: string;
    readonly sha256: string;
  };
  /** Portable tool records. */
  readonly tools: readonly EvidenceRecord[];
  /** Source inventory. */
  readonly sources: readonly EvidenceRecord[];
  /** Raw asset input inventory. */
  readonly assets: readonly EvidenceRecord[];
  /** Machine address-space inventory. */
  readonly addressSpaces: readonly EvidenceRecord[];
  /** Reachable functions. */
  readonly functions: readonly EvidenceRecord[];
  /** Entry, call, and inlining contexts. */
  readonly contexts: readonly EvidenceRecord[];
  /** Source and generated symbols. */
  readonly symbols: readonly EvidenceRecord[];
  /** Symbol availability records. */
  readonly locations: readonly EvidenceRecord[];
  /** Final machine ranges. */
  readonly ranges: readonly EvidenceRecord[];
  /** Applied optimization records. */
  readonly optimizations: readonly EvidenceRecord[];
  /** Separately published load units. */
  readonly loadUnits: readonly EvidenceRecord[];
}
