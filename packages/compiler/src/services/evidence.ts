import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AcmeArtifactSet } from "../tools/acme.js";
import type { AcmeToolIdentity } from "../tools/discovery.js";
import type { CompleteC64Layout } from "../artifacts/acme-validate.js";
import {
  encodeAssetsEvidence,
  encodeBuildEvidence,
  encodeCostsEvidence,
  encodeDebugEvidence,
  encodeMemoryEvidence,
} from "../artifacts/evidence.js";
import type { EvidenceIdentity, EvidenceRecord } from "../artifacts/evidence-types.js";
import { canonicalEvidenceHash } from "../artifacts/evidence-validation.js";
import { BUILD_INFO } from "../build-info.js";
import type { ProjectSnapshot } from "../project/types.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { StorageClosureCertificate, StorageInventory } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import type { PublishedFileExpectation } from "../publication/publication.js";
import type { ServiceMeasurements } from "./types.js";
import { assetSymbolName, deriveDebugRecords } from "./evidence-records.js";
import { deriveMemoryIntervals, sfaClosureHash } from "./memory-evidence-records.js";

/** External NMI obligations not established by a finite generated-program/IRQ proof. */
const EXTERNAL_NMI_EFFECT_CLASS =
  "external-nmi-aggregate-stack+retained-nmi-firmware-completion+external-nmi-finite-deadline";

/** Complete sidecar preparation result used by one publication attempt. */
export type EvidencePreparationResult =
  | {
      readonly kind: "complete";
      readonly files: readonly PublishedFileExpectation[];
      readonly buildJsonSha256: string;
      readonly primaryArtifact: string;
    }
  | { readonly kind: "error"; readonly diagnostic: string };

/** Exact source range retained by one optimizer decision or rejection. */
export interface SizeCostSourceSite {
  /** Project-relative source identity. */
  readonly path: string;
  /** Inclusive first UTF-8 byte. */
  readonly startByte: number;
  /** Inclusive last UTF-8 byte. */
  readonly endByte: number;
}

/** One closed B/R/T vector used before and after final publication. */
export interface SizeCostVector {
  /** Loaded PRG payload bytes. */
  readonly programBytes: number;
  /** Ordered semantic path cycle measurements. */
  readonly pathCycles: readonly {
    readonly pathId: string;
    readonly cycles: { readonly kind: "unknown" };
  }[];
  /** Standard physical resources in their fixed comparison order. */
  readonly resources: readonly {
    readonly kind: "standard";
    readonly id: "zeroPage" | "residentRam" | "hardwareStack" | "scratch";
    readonly value: number;
  }[];
}

/** One hard reason that rejects a whole construction candidate. */
export interface SizeEvidenceRejection {
  /** Existing diagnostic family used by the costs validator. */
  readonly kind: string;
  /** Exact non-empty rejection detail. */
  readonly detail: string;
  /** Known source owners; empty when the failure has no source site. */
  readonly sourceSites: readonly SizeCostSourceSite[];
}

/** One exact feasible or rejected construction candidate. */
export interface SizeEvidenceCandidate {
  /** Stable source/recipe identity. */
  readonly id: string;
  /** Closed cost vector or exact hard rejection reasons. */
  readonly feasibility:
    | { readonly kind: "feasible"; readonly vector: SizeCostVector }
    | { readonly kind: "rejected"; readonly reasons: readonly SizeEvidenceRejection[] };
}

/** One whole-program size decision with its reference baseline and selected candidate. */
export interface SizeEvidenceDecision {
  /** Stable decision identity. */
  readonly id: string;
  /** Selected source scope. */
  readonly scope: string;
  /** Explicit optimized mode. */
  readonly mode: "balanced" | "speed" | "size";
  /** Source sites which caused the decision. */
  readonly sourceSites: readonly SizeCostSourceSite[];
  /** Closed after final shared layout. */
  readonly closurePoint: "postLayout";
  /** Canonical reference identity, feasible or rejected. */
  readonly baselineCandidateId: string;
  /** Feasible selected candidate identity. */
  readonly selectedCandidateId: string;
  /** Every admitted candidate in canonical identity order. */
  readonly candidates: readonly SizeEvidenceCandidate[];
  /** Higher-priority components whose comparison was genuinely unavailable. */
  readonly incomparableComponents: readonly string[];
  /** Exact-vector tie rule. */
  readonly tieBreak:
    | { readonly kind: "none" }
    | { readonly kind: "stableId"; readonly candidateIds: readonly string[] };
}

interface EvidencePreparationInput {
  readonly snapshot: ProjectSnapshot;
  readonly program: WholeProgram;
  readonly inventory: StorageInventory;
  readonly certificate: StorageClosureCertificate;
  readonly layout: CompleteC64Layout;
  readonly profile: TargetProfile;
  readonly tool: AcmeToolIdentity;
  readonly artifacts: AcmeArtifactSet;
  readonly stagingDirectory: string;
  readonly generationId: string;
  readonly measurements: ServiceMeasurements;
  /** Exact size selection; absent for none or direct builds. */
  readonly sizeDecision?: SizeEvidenceDecision;
}

/** Hash bytes using the common lowercase SHA-256 spelling. */
function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Build one portable authority identity without machine-local paths. */
function identity(name: string, version: string, content: string): EvidenceIdentity {
  return Object.freeze({ name, version, sha256: sha256(content) });
}

/** Write one already self-validated sidecar exclusively. */
async function writeEncoded(
  directory: string,
  name: string,
  encoded: ReturnType<typeof encodeAssetsEvidence>,
): Promise<PublishedFileExpectation | null> {
  if (encoded.kind !== "complete") return null;
  await writeFile(join(directory, name), encoded.bytes, { flag: "wx" });
  return Object.freeze({ path: name, bytes: encoded.bytes.byteLength, sha256: encoded.sha256 });
}

/** Produce the deterministic evidence identity used by the raw-asset sidecar schema. */
function rawAssetEvidenceId(asset: WholeProgram["semantic"]["assets"][number]): string {
  return canonicalEvidenceHash({
    handler: "raw",
    handlerVersion: "1",
    selector: "raw",
    logicalType: "const byte[]",
    shape: [asset.bytes.length],
    outputSha256: asset.sha256,
  });
}

/** Return the exact free partition around sorted, non-overlapping intervals. */
function freeIntervals(intervals: readonly EvidenceRecord[]): readonly EvidenceRecord[] {
  const free: EvidenceRecord[] = [];
  let cursor = 0;
  for (const interval of intervals) {
    const start = interval.start as number;
    const end = interval.end as number;
    if (cursor < start)
      free.push(Object.freeze({ start: cursor, end: start, size: start - cursor }));
    cursor = end;
  }
  if (cursor < 0x10000) {
    free.push(Object.freeze({ start: cursor, end: 0x10000, size: 0x10000 - cursor }));
  }
  return Object.freeze(free);
}

/** Create the complete CPU view used by the single-bank C64 PRG profile. */
function memoryView(intervals: readonly EvidenceRecord[]): EvidenceRecord {
  const free = freeIntervals(intervals);
  const sum = (field: "size" | "payloadBytes" | "paddingBytes" | "reservedBytes"): number =>
    intervals.reduce((total, interval) => total + (interval[field] as number), 0);
  const freeBytes = free.reduce((total, interval) => total + (interval.size as number), 0);
  const zeroPageBytes = intervals
    .filter(({ resourceClass }) => resourceClass === "zeroPage")
    .reduce((total, interval) => total + (interval.size as number), 0);
  return Object.freeze({
    id: "cpu16-resident",
    consumer: "cpu",
    addressSpaceId: "cpu16",
    start: 0,
    end: 0x10000,
    activeResidencyIds: Object.freeze(["resident"]),
    visibility: Object.freeze(["cpu"]),
    capacityBytes: 0x10000,
    occupiedBytes: sum("size"),
    payloadBytes: sum("payloadBytes"),
    paddingBytes: sum("paddingBytes"),
    reservedBytes: sum("reservedBytes"),
    zeroPageBytes,
    freeBytes,
    freeIntervals: free,
    largestFreeBytes: Math.max(0, ...free.map(({ size }) => size as number)),
  });
}

/** Map one loaded interval to its direct program-byte accounting component. */
function programComponent(kind: CompleteC64Layout["intervals"][number]["kind"]): string {
  if (kind === "stub") return "startup";
  if (kind === "code") return "code";
  if (kind === "asset") return "asset";
  if (kind === "fill") return "padding";
  return "initializedData";
}

/** Derive the common B/R/T vector from one actually closed layout and certificate. */
export function sizeCostVector(
  layout: CompleteC64Layout,
  certificate: StorageClosureCertificate,
): SizeCostVector {
  const intervals = layout.intervals;
  const size = (interval: CompleteC64Layout["intervals"][number]) =>
    interval.end - interval.start + 1;
  const helperIds = new Set(
    certificate.helperCalls.flatMap(({ helperRequestIds }) => helperRequestIds),
  );
  const zeroPage = intervals
    .filter(({ start, end }) => start >= 0 && end < 0x100)
    .reduce((total, interval) => total + size(interval), 0);
  const residentRam = intervals.reduce((total, interval) => total + size(interval), 0);
  const scratch = intervals
    .filter(({ kind, start, end }) => {
      if (kind !== "sfa" || end >= 0x100) return false;
      const homes = certificate.homes.filter(
        (home) => home.address <= end && home.address + home.bytes - 1 >= start,
      );
      return homes.length > 0 && homes.every(({ requestId }) => helperIds.has(requestId));
    })
    .reduce((total, interval) => total + size(interval), 0);
  const nmiEntryPeaks = certificate.nmiEntryPeaks ?? [];
  const hardwareStack = nmiEntryPeaks.reduce(
    (peak, entry) => Math.max(peak, entry.bytes),
    certificate.hardwareStackPeak,
  );
  return Object.freeze({
    programBytes: intervals
      .filter(({ bytes }) => bytes !== null)
      .reduce((total, interval) => total + size(interval), 0),
    pathCycles: Object.freeze([
      Object.freeze({
        pathId: "program.entry-to-return",
        cycles: Object.freeze({ kind: "unknown" as const }),
      }),
    ]),
    resources: Object.freeze([
      Object.freeze({ kind: "standard" as const, id: "zeroPage" as const, value: zeroPage }),
      Object.freeze({ kind: "standard" as const, id: "residentRam" as const, value: residentRam }),
      Object.freeze({
        kind: "standard" as const,
        id: "hardwareStack" as const,
        value: hardwareStack,
      }),
      Object.freeze({ kind: "standard" as const, id: "scratch" as const, value: scratch }),
    ]),
  });
}

/** Prepare and write the five exact generation sidecars, with build evidence last. */
export async function prepareEvidence(
  input: EvidencePreparationInput,
): Promise<EvidencePreparationResult> {
  const compiler = identity("blend65", BUILD_INFO.version, JSON.stringify(BUILD_INFO));
  const specification = identity("blend65-language", "4.0", BUILD_INFO.specificationId);
  const expertSkill = identity(
    "blend65-domain-expert",
    BUILD_INFO.expertVersion,
    BUILD_INFO.expertContentCommit,
  );
  const primaryArtifact = basename(input.artifacts.prg.path);
  const primaryBytes = await readFile(input.artifacts.prg.path);
  const semanticAssets = input.program.semantic.assets
    .filter(({ id }) => input.program.reachableAssets.includes(id))
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.sourcePath), Buffer.from(right.sourcePath)),
    );
  const assetIds = new Map(semanticAssets.map((asset) => [asset.id, rawAssetEvidenceId(asset)]));
  const assetEvidence = Object.freeze({
    kind: "blend65.assets",
    schemaVersion: 1,
    assets: Object.freeze(
      semanticAssets
        .map((asset) => {
          const placement = input.layout.intervals.find(({ id }) => id === `asset.${asset.id}`);
          if (placement === undefined) throw new Error("Reachable asset has no final placement");
          const vicSpriteBlocks =
            input.layout.program.data.find(({ id }) => id === placement.id)?.vicSpriteBlocks !==
            false;
          const evidenceId = assetIds.get(asset.id)!;
          return Object.freeze({
            id: evidenceId,
            inputs: Object.freeze([
              Object.freeze({
                path: asset.sourcePath,
                bytes: asset.bytes.length,
                sha256: asset.sha256,
              }),
            ]),
            handler: "raw",
            handlerVersion: "1",
            selector: "raw",
            logicalType: "const byte[]",
            shape: Object.freeze([asset.bytes.length]),
            outputSha256: asset.sha256,
            payloadBytes: asset.bytes.length,
            emittedBytes: asset.bytes.length,
            aliases: Object.freeze([assetSymbolName(asset.id)]),
            constraints: Object.freeze(
              vicSpriteBlocks
                ? [
                    Object.freeze({ kind: "align", origin: "profile", bytes: 64 }),
                    Object.freeze({
                      kind: "visibility",
                      origin: "profile",
                      consumer: "vic",
                      conditionId: "vic",
                    }),
                  ]
                : [],
            ),
            placement: Object.freeze({
              kind: "single",
              range: Object.freeze({
                addressSpaceId: "cpu16",
                start: placement.start,
                end: placement.end + 1,
                alignmentBytes: vicSpriteBlocks ? 64 : 1,
                paddingBeforeBytes: 0,
                residencyId: "resident",
                visibility: Object.freeze(vicSpriteBlocks ? ["vic"] : []),
                writableRanges: Object.freeze([]),
              }),
            }),
          });
        })
        .sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id))),
    ),
  });
  const intervals = deriveMemoryIntervals(
    input.layout,
    input.inventory,
    input.certificate,
    assetIds,
  );
  const view = memoryView(intervals);
  const stackCapacity = input.profile.storage.hardwareStackCapacity ?? 0x100;
  const platformStackReserve = input.profile.storage.hardwareStackReserve ?? 0;
  const usableStackCapacity = stackCapacity - platformStackReserve;
  const boundedStackBytes = input.certificate.hardwareStackPeak;
  const nmiEntryPeaks = input.certificate.nmiEntryPeaks ?? [];
  const componentStackBytes = nmiEntryPeaks.reduce(
    (peak, entry) => Math.max(peak, entry.bytes),
    boundedStackBytes,
  );
  const main = input.program.semantic.main;
  const memoryEvidence = Object.freeze({
    kind: "blend65.memory",
    schemaVersion: 1,
    profileId: input.profile.id,
    sfaClosureSha256: sfaClosureHash(intervals),
    acmeReconciled: true,
    // The retained stock NMI route has no external arrival/completion bound, even
    // when no generated handler is installed. This does not weaken static closure.
    runtimeMemorySafety: "unproven",
    residencies: Object.freeze([Object.freeze({ kind: "always", id: "resident" })]),
    unboundedEffects: Object.freeze([
      Object.freeze({
        kind: "machineState",
        site: Object.freeze({
          path: main.sourceId,
          startByte: main.span.start,
          endByte: main.span.end,
        }),
        effectClass: EXTERNAL_NMI_EFFECT_CLASS,
      }),
    ]),
    intervals,
    views: Object.freeze([view]),
    stackDomains: Object.freeze(
      [
        Object.freeze({
          id: "interrupt-entry-save",
          route: Object.freeze(["c64.interrupt-entry", "c64.kernal-register-save"]),
          capacityBytes: stackCapacity,
          peakBytes: input.certificate.hardwareStackSystemPeak,
          headroomBytes: stackCapacity - input.certificate.hardwareStackSystemPeak,
        }),
        Object.freeze({
          id: "program",
          route: input.certificate.hardwareStackRoute,
          capacityBytes: stackCapacity,
          peakBytes: input.certificate.hardwareStackProgramPeak,
          headroomBytes: stackCapacity - input.certificate.hardwareStackProgramPeak,
        }),
        Object.freeze({
          id: "bounded-component-capacity",
          route: Object.freeze([
            "bounded-component:generated-program-and-irq",
            ...input.certificate.hardwareStackRoute,
          ]),
          // Reserve is withheld capacity, not a live stack frame or a route use.
          capacityBytes: usableStackCapacity,
          peakBytes: boundedStackBytes,
          headroomBytes: usableStackCapacity - boundedStackBytes,
        }),
        ...nmiEntryPeaks.map((entry) =>
          Object.freeze({
            id: `nmi-entry:${entry.id}`,
            route: Object.freeze(["per-entry:generated-nmi", entry.id, ...entry.route]),
            capacityBytes: usableStackCapacity,
            peakBytes: entry.bytes,
            headroomBytes: usableStackCapacity - entry.bytes,
          }),
        ),
      ].sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id))),
    ),
  });
  const loaded = input.layout.intervals.filter(({ bytes }) => bytes !== null);
  const costEntries = loaded
    .map((interval) =>
      Object.freeze({
        kind: "bytes",
        id: `program:${interval.id}`,
        owner: Object.freeze({ kind: "compiler", id: interval.id }),
        component: programComponent(interval.kind),
        accounting: "program",
        bytes: interval.end - interval.start + 1,
        sourceSites: Object.freeze([]),
        dependencyIds: Object.freeze([]),
      }),
    )
    .sort((left, right) => {
      const leftKey = `${left.accounting}\0${left.component}\0${left.owner.kind}\0${left.owner.id}\0${left.id}`;
      const rightKey = `${right.accounting}\0${right.component}\0${right.owner.kind}\0${right.owner.id}\0${right.id}`;
      return Buffer.compare(Buffer.from(leftKey), Buffer.from(rightKey));
    });
  const completePathId = "program.entry-to-return";
  const unknownMeasurement = Object.freeze({ kind: "unknown" as const });
  const cycleEntry = Object.freeze({
    kind: "cycles",
    id: `cycles:${completePathId}`,
    owner: Object.freeze({ kind: "compiler", id: "pipeline" }),
    pathId: completePathId,
    cycles: unknownMeasurement,
    traffic: Object.freeze([
      Object.freeze({
        kind: "read",
        target: "c64.joystick2",
        count: unknownMeasurement,
      }),
      Object.freeze({ kind: "read", target: "c64.vic", count: unknownMeasurement }),
      Object.freeze({ kind: "write", target: "c64.vic", count: unknownMeasurement }),
    ]),
    sourceSites: Object.freeze([]),
    dependencyIds: Object.freeze([]),
  });
  const residentRam = intervals.reduce((total, interval) => total + (interval.size as number), 0);
  const zeroPage = intervals
    .filter(({ resourceClass }) => resourceClass === "zeroPage")
    .reduce((total, interval) => total + (interval.size as number), 0);
  const scratch = intervals
    .filter(({ kind }) => kind === "scratch")
    .reduce((total, interval) => total + (interval.size as number), 0);
  const finalVector: SizeCostVector = Object.freeze({
    programBytes: Math.max(0, primaryBytes.byteLength - 2),
    pathCycles: Object.freeze([
      Object.freeze({
        pathId: completePathId,
        cycles: Object.freeze({ kind: "unknown" as const }),
      }),
    ]),
    resources: Object.freeze([
      Object.freeze({ kind: "standard" as const, id: "zeroPage" as const, value: zeroPage }),
      Object.freeze({ kind: "standard" as const, id: "residentRam" as const, value: residentRam }),
      Object.freeze({
        kind: "standard" as const,
        id: "hardwareStack" as const,
        value: componentStackBytes,
      }),
      Object.freeze({ kind: "standard" as const, id: "scratch" as const, value: scratch }),
    ]),
  });
  const decisions =
    input.sizeDecision === undefined
      ? Object.freeze([])
      : Object.freeze([
          Object.freeze({
            ...input.sizeDecision,
            candidates: Object.freeze(
              input.sizeDecision.candidates.map((candidate) =>
                candidate.id === input.sizeDecision!.selectedCandidateId &&
                candidate.feasibility.kind === "feasible"
                  ? Object.freeze({
                      ...candidate,
                      feasibility: Object.freeze({
                        kind: "feasible" as const,
                        vector: finalVector,
                      }),
                    })
                  : candidate,
              ),
            ),
          }),
        ]);
  const costsEvidence = Object.freeze({
    kind: "blend65.costs",
    schemaVersion: 1,
    mode: input.snapshot.manifest.optimization,
    totals: Object.freeze({
      programBytes: finalVector.programBytes,
      pathCycles: finalVector.pathCycles,
      resources: finalVector.resources,
    }),
    entries: Object.freeze([...costEntries, cycleEntry]),
    decisions,
  });
  const portableTools = Object.freeze([
    Object.freeze({
      name: "acme",
      version: input.tool.version,
      semanticOptions: Object.freeze(["--cpu=6502", "--strict-segments", "--format=cbm"]),
    }),
  ]);
  const debug = deriveDebugRecords({
    snapshot: input.snapshot,
    program: input.program,
    inventory: input.inventory,
    certificate: input.certificate,
    layout: input.layout,
  });
  const debugEvidence = Object.freeze({
    kind: "blend65.debug",
    schemaVersion: 1,
    compiler,
    specification,
    expertSkill,
    profileId: input.profile.id,
    cpuId: input.profile.cpu.id,
    optimization: input.snapshot.manifest.optimization,
    safety: Object.freeze({
      boundsCheck: input.snapshot.manifest.boundsCheck,
      divisionZeroCheck: input.snapshot.manifest.divisionZeroCheck,
    }),
    primaryArtifact: Object.freeze({
      path: primaryArtifact,
      kind: "primary",
      sha256: input.artifacts.prg.sha256,
    }),
    tools: portableTools,
    sources: Object.freeze(
      input.snapshot.sources.map((source) =>
        Object.freeze({
          path: source.sourceId,
          byteLength: source.byteLength,
          sha256: source.sha256,
        }),
      ),
    ),
    assets: Object.freeze(
      semanticAssets.map((asset) =>
        Object.freeze({
          path: asset.sourcePath,
          sha256: asset.sha256,
          handler: "raw",
          handlerVersion: "1",
          selector: "raw",
        }),
      ),
    ),
    addressSpaces: debug.addressSpaces,
    functions: debug.functions,
    contexts: debug.contexts,
    symbols: debug.symbols,
    locations: debug.locations,
    ranges: debug.ranges,
    optimizations: debug.optimizations,
    loadUnits: Object.freeze([]),
  });

  try {
    const encodings = [
      [".assets.json", encodeAssetsEvidence(assetEvidence)],
      [".memory.json", encodeMemoryEvidence(memoryEvidence)],
      [".costs.json", encodeCostsEvidence(costsEvidence)],
      [".debug.json", encodeDebugEvidence(debugEvidence)],
    ] as const;
    const invalid = encodings.find(([, encoded]) => encoded.kind === "error");
    if (invalid?.[1].kind === "error") {
      return Object.freeze({
        kind: "error",
        diagnostic: `${invalid[0]}: ${invalid[1].diagnostic}`,
      });
    }
    const sidecars = await Promise.all([
      ...encodings.map(([name, encoded]) => writeEncoded(input.stagingDirectory, name, encoded)),
    ]);
    if (sidecars.some((sidecar) => sidecar === null)) {
      return Object.freeze({ kind: "error", diagnostic: "Artifact evidence is inconsistent" });
    }
    const artifactKinds = new Map([
      [primaryArtifact, "primary"],
      [".asm", "assembly"],
      [".labels", "labels"],
      [".assets.json", "assets"],
      [".memory.json", "memory"],
      [".costs.json", "costs"],
      [".debug.json", "debug"],
    ] as const);
    const filesBeforeBuild = [
      Object.freeze({
        path: primaryArtifact,
        bytes: input.artifacts.prg.bytes,
        sha256: input.artifacts.prg.sha256,
      }),
      Object.freeze({
        path: ".asm",
        bytes: input.artifacts.assembly.bytes,
        sha256: input.artifacts.assembly.sha256,
      }),
      Object.freeze({
        path: ".labels",
        bytes: input.artifacts.labels.bytes,
        sha256: input.artifacts.labels.sha256,
      }),
      ...sidecars.filter((sidecar): sidecar is PublishedFileExpectation => sidecar !== null),
    ];
    const buildArtifacts = filesBeforeBuild
      .map((file) => Object.freeze({ ...file, kind: artifactKinds.get(file.path)! }))
      .sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
    const overrides: EvidenceRecord[] = [];
    if (
      input.snapshot.overrides.target !== null &&
      input.snapshot.overrides.target !== input.snapshot.manifest.target
    ) {
      overrides.push(Object.freeze({ name: "target", value: input.snapshot.overrides.target }));
    }
    if (
      input.snapshot.overrides.entry !== null &&
      input.snapshot.overrides.entry !== input.snapshot.manifest.entry
    ) {
      overrides.push(Object.freeze({ name: "entry", value: input.snapshot.overrides.entry }));
    }
    const buildEvidence = Object.freeze({
      kind: "blend65.build",
      schemaVersion: 1,
      generationId: input.generationId,
      semanticInputs: Object.freeze({
        projectName: input.snapshot.manifest.name,
        sourceRoot: input.snapshot.manifest.sourceRoot,
        entryModule: input.snapshot.effectiveEntry,
        assetSearchPaths: input.snapshot.manifest.assetPaths,
        manifest: Object.freeze({
          path: input.snapshot.manifestSource.sourceId,
          bytes: input.snapshot.manifestSource.byteLength,
          sha256: input.snapshot.manifestSource.sha256,
        }),
        sources: Object.freeze(
          input.snapshot.sources.map((source) =>
            Object.freeze({
              path: source.sourceId,
              bytes: source.byteLength,
              sha256: source.sha256,
            }),
          ),
        ),
        assets: Object.freeze(
          semanticAssets.map((asset) =>
            Object.freeze({
              path: asset.sourcePath,
              bytes: asset.bytes.length,
              sha256: asset.sha256,
            }),
          ),
        ),
        compiler,
        specification,
        expertSkill,
        target: Object.freeze({
          profileId: input.profile.id,
          cpuId: input.profile.cpu.id,
          emitterId: input.profile.serializer.id,
          packagerId: input.profile.packager.id,
        }),
        options: Object.freeze({
          optimization: input.snapshot.manifest.optimization,
          boundsCheck: input.snapshot.manifest.boundsCheck,
          divisionZeroCheck: input.snapshot.manifest.divisionZeroCheck,
        }),
        overrides: Object.freeze(overrides),
      }),
      portableTools,
      hostProvenance: Object.freeze({
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.versions.node,
        tools: Object.freeze([
          Object.freeze({
            name: "acme",
            canonicalPath: input.tool.executable,
            sha256: input.tool.sha256,
          }),
        ]),
        durationMilliseconds: input.measurements.durationMilliseconds,
        peakRssBytes: input.measurements.peakRssBytes,
      }),
      package: Object.freeze({
        kind: "prg",
        artifactPath: primaryArtifact,
        loadAddress: primaryBytes[0]! | (primaryBytes[1]! << 8),
        endAddress: (primaryBytes[0]! | (primaryBytes[1]! << 8)) + primaryBytes.byteLength - 2,
      }),
      artifacts: Object.freeze(buildArtifacts),
    });
    const build = encodeBuildEvidence(buildEvidence);
    const buildFile = await writeEncoded(input.stagingDirectory, ".build.json", build);
    if (buildFile === null) {
      return Object.freeze({ kind: "error", diagnostic: "Build evidence is inconsistent" });
    }
    return Object.freeze({
      kind: "complete",
      files: Object.freeze(
        [...filesBeforeBuild, buildFile].sort((left, right) =>
          Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)),
        ),
      ),
      buildJsonSha256: buildFile.sha256,
      primaryArtifact,
    });
  } catch {
    return Object.freeze({ kind: "error", diagnostic: "Artifact evidence could not be written" });
  }
}
