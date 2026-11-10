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
import { canonicalEvidenceHash, canonicalEvidenceJson } from "../artifacts/evidence-validation.js";
import type { ResidentAsset, ScalarAsset, SemanticAsset } from "../assets/asset-types.js";
import { freeIntervalsInWindow, storageIntervals } from "../layout/c64-layout-objects.js";
import { BUILD_INFO } from "../build-info.js";
import type { ProjectSnapshot } from "../project/types.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { StorageClosureCertificate, StorageInventory } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import type { PublishedFileExpectation } from "../publication/publication.js";
import type { ServiceMeasurements } from "./types.js";
import type { OptimizationCycleMeasurement } from "../machine/optimization-cost.js";
import { deriveEntryPathCycles } from "./entry-path-cycles.js";
import { assetSymbolName, deriveDebugRecords } from "./evidence-records.js";
import { deriveMemoryIntervals, sfaClosureHash } from "./memory-evidence-records.js";
import type { LoadDestinationEvidence } from "./memory-evidence-records.js";

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
    readonly cycles: OptimizationCycleMeasurement;
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

import { paddedD64Name } from "../packaging/d64/index.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type { D64Image } from "../packaging/d64/index.js";

interface D64EvidenceInput {
  /** Generation-relative `.d64` filename. */
  readonly path: string;
  /** Exact image bytes. */
  readonly bytes: Uint8Array;
  /** Lowercase SHA-256 of the image. */
  readonly sha256: string;
  /** Exact serializer result. */
  readonly image: D64Image;
  /** Boot component identity inside the image. */
  readonly bootComponentId: string;
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
  /** Present when the selected packager is `cbm-d64`. */
  readonly d64?: D64EvidenceInput;
  readonly stagingDirectory: string;
  readonly generationId: string;
  readonly measurements: ServiceMeasurements;
  /** Exact size selection; absent for none or direct builds. */
  readonly sizeDecision?: SizeEvidenceDecision;
}

/** Format one PETSCII byte sequence as lowercase hex. */
function hexBytes(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Build one exact D64 package record from the packager output. */
function d64PackageEvidence(input: D64EvidenceInput, artifactPath: string) {
  return Object.freeze({
    kind: "d64" as const,
    artifactPath,
    imageBytes: 174_848 as const,
    dosType: "2A" as const,
    diskLabelPetsciiHex: hexBytes(input.image.label),
    diskIdPetsciiHex: hexBytes(input.image.diskId),
    bamSha256: input.image.bamSha256,
    directorySha256: input.image.directorySha256,
    allocationPolicyId: input.image.allocationPolicyId,
    loaderStrategyId: "kernal-sequential-uncompressed" as const,
    freeBlocks: input.image.freeBlocks,
    bootComponentId: input.bootComponentId,
    components: Object.freeze(
      input.image.files.map((placed) => {
        const logicalSha256 = sha256(Uint8Array.from(placed.file.body));
        return Object.freeze({
          id: placed.file.id,
          logicalSha256,
          source: Object.freeze({
            kind: "generated" as const,
            identity: placed.file.id,
            sha256: logicalSha256,
          }),
          outputSha256: sha256(Uint8Array.from(placed.bytes)),
          directoryNamePetsciiHex: hexBytes(paddedD64Name(placed.file.name)),
          fileType: "PRG" as const,
          loadAddress: placed.file.loadAddress,
          startTrack: placed.sectors[0]!.track,
          startSector: placed.sectors[0]!.sector,
          endTrack: placed.sectors.at(-1)!.track,
          endSector: placed.sectors.at(-1)!.sector,
          blocks: placed.blocks,
          bytes: placed.bytes.length,
          destinationCalls: Object.freeze(
            placed.file.destinationCalls.map(({ sourceId, start, end }) =>
              Object.freeze({ path: sourceId, startByte: start, endByte: end }),
            ),
          ),
          aliases: placed.file.aliases,
        });
      }),
    ),
  });
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

/** Exact source-language type of one selected asset. */
function assetLogicalType(asset: SemanticAsset): string {
  const arrayType =
    asset.kind === "resident-asset"
      ? asset.arrayType
      : asset.scalarType === null
        ? asset.arrayType
        : undefined;
  if (arrayType !== undefined)
    return `const ${arrayType.element.kind === "scalar" ? arrayType.element.name : "byte"}[]`;
  return asset.kind === "resident-asset" ? "const byte[]" : `const ${asset.scalarType!.name}`;
}

/** Exact logical shape of one selected asset. */
function assetShape(asset: SemanticAsset): readonly number[] {
  if (asset.kind === "resident-asset") return [asset.arrayType.length];
  return asset.scalarType === null && asset.arrayType !== undefined ? [asset.arrayType.length] : [];
}

/** Produce the deterministic evidence identity used by the asset sidecar schema. */
function assetEvidenceId(asset: SemanticAsset): string {
  return canonicalEvidenceHash({
    handler: asset.handler.handlerKey,
    handlerVersion: asset.handler.handlerVersion,
    selector: asset.handler.selector,
    representation: asset.handler.representation,
    logicalType: assetLogicalType(asset),
    shape: assetShape(asset),
    outputSha256: asset.outputSha256,
    inputs: [{ path: asset.sourcePath, sha256: asset.inputSha256 }],
  });
}

/** Merge handler and source placement evidence for one resident asset. */
function assetConstraints(asset: ResidentAsset): readonly Record<string, unknown>[] {
  const constraints: Record<string, unknown>[] = asset.constraints.map((constraint) => ({
    ...constraint,
  }));
  const placement = asset.placement;
  if (placement !== undefined) {
    const hasAt = constraints.some(({ kind, start }) => kind === "at" && start === placement.at);
    if (placement.at !== null && !hasAt) {
      constraints.push({
        kind: "at",
        origin: "source",
        addressSpaceId: "cpu16",
        start: placement.at,
      });
    }
    if (
      placement.align > 1 &&
      !constraints.some(({ kind, bytes }) => kind === "align" && Number(bytes) >= placement.align)
    ) {
      constraints.push({ kind: "align", origin: "source", bytes: placement.align });
    }
    if (
      placement.noCross !== null &&
      !constraints.some(
        ({ kind, boundaryBytes }) =>
          kind === "noCross" && Number(boundaryBytes) <= placement.noCross!,
      )
    ) {
      constraints.push({
        kind: "noCross",
        origin: "source",
        boundaryBytes: placement.noCross,
      });
    }
    if (
      placement.region !== null &&
      !constraints.some(({ kind, regionId }) => kind === "region" && regionId === placement.region)
    ) {
      constraints.push({ kind: "region", origin: "source", regionId: placement.region });
    }
  }
  return constraints.sort((left, right) =>
    Buffer.compare(
      Buffer.from(`${String(left.kind)}\0${String(left.origin)}\0${canonicalEvidenceJson(left)}`),
      Buffer.from(
        `${String(right.kind)}\0${String(right.origin)}\0${canonicalEvidenceJson(right)}`,
      ),
    ),
  );
}

/** Build one consistent memory view from the intervals it covers exactly. */
function buildView(
  id: string,
  consumer: "cpu" | "vic",
  addressSpaceId: string,
  start: number,
  end: number,
  covered: readonly EvidenceRecord[],
  visibility: readonly string[],
  bankId?: string,
  activeResidencyIds: readonly string[] = ["resident"],
): EvidenceRecord {
  const free = freeIntervalsInWindow(
    start,
    end,
    covered.map((interval) => ({
      start: interval.start as number,
      end: (interval.end as number) - 1,
    })),
  );
  const sum = (field: "size" | "payloadBytes" | "paddingBytes" | "reservedBytes"): number =>
    covered.reduce((total, interval) => total + (interval[field] as number), 0);
  return Object.freeze({
    id,
    consumer,
    addressSpaceId,
    ...(bankId === undefined ? {} : { bankId }),
    start,
    end,
    activeResidencyIds: Object.freeze([...activeResidencyIds].sort()),
    visibility: Object.freeze([...visibility]),
    capacityBytes: end - start,
    occupiedBytes: sum("size"),
    payloadBytes: sum("payloadBytes"),
    paddingBytes: sum("paddingBytes"),
    reservedBytes: sum("reservedBytes"),
    zeroPageBytes: covered
      .filter(({ resourceClass }) => resourceClass === "zeroPage")
      .reduce((total, interval) => total + (interval.size as number), 0),
    freeBytes: free.reduce((total, range) => total + range.size, 0),
    freeIntervals: free,
    largestFreeBytes: Math.max(0, ...free.map(({ size }) => size)),
  });
}

/** One compiler-owned reserved hardware/ROM interval with no PRG payload. */
function reservation(
  id: string,
  start: number,
  end: number,
  addressSpaceId = "cpu16",
): EvidenceRecord {
  const size = end - start;
  return Object.freeze({
    id,
    addressSpaceId,
    start,
    end,
    size,
    owner: Object.freeze({ kind: "compiler", id }),
    kind: "reservation",
    origin: Object.freeze({ kind: "generated", identity: id }),
    mutability: "immutable",
    alignmentBytes: 1,
    contiguity: Object.freeze({ kind: "single" }),
    residencyIds: Object.freeze(["resident"]),
    cpuMappings: Object.freeze([]),
    resourceClass: "device",
    payloadBytes: 0,
    paddingBytes: 0,
    reservedBytes: size,
  });
}

/** Fill one bounded window with reservations for every still-uncovered gap. */
function reserveUncovered(
  prefix: string,
  start: number,
  end: number,
  covered: readonly { readonly start: number; readonly end: number }[],
): readonly EvidenceRecord[] {
  return freeIntervalsInWindow(start, end, covered).map((gap) =>
    reservation(
      `${prefix}.${gap.start.toString(16).padStart(4, "0")}`,
      gap.start,
      gap.end,
      "cpu16",
    ),
  );
}

/** Resize one evidence record to a clipped half-open range without changing its class. */
function resizeRecord(record: EvidenceRecord, start: number, end: number): EvidenceRecord {
  const size = end - start;
  const padding = record.kind === "padding";
  const reserved =
    record.kind === "reservation" || record.kind === "scratch" || record.kind === "sfa";
  return Object.freeze({
    ...record,
    start,
    end,
    size,
    payloadBytes: padding || reserved ? 0 : size,
    paddingBytes: padding ? size : 0,
    reservedBytes: reserved ? size : 0,
  });
}

/** Project one CPU record into the VIC bank with an explicit bank identity. */
function vicProjection(record: EvidenceRecord): EvidenceRecord {
  const clipped = resizeRecord(
    record,
    Math.max(0, record.start as number),
    Math.min(0x4000, record.end as number),
  );
  return Object.freeze({
    ...clipped,
    id: `vic.${String(record.id)}`,
    addressSpaceId: "cpu16-vic",
    bankId: "vic-bank-0",
  });
}

/** Replace one reservation window in a VIC projection with one explicit record. */
function overlayVicReservation(
  records: readonly EvidenceRecord[],
  windowStart: number,
  windowEnd: number,
  id: string,
): readonly EvidenceRecord[] {
  if (windowEnd <= 0 || windowStart >= 0x4000) return records;
  const start = Math.max(0, windowStart);
  const end = Math.min(0x4000, windowEnd);
  if (end <= start) return records;
  const result: EvidenceRecord[] = [];
  for (const record of records) {
    const recordStart = record.start as number;
    const recordEnd = record.end as number;
    if (recordEnd <= start || recordStart >= end) {
      result.push(record);
      continue;
    }
    if (recordStart < start) {
      result.push({
        ...resizeRecord(record, recordStart, start),
        id: `${String(record.id)}.before`,
      });
    }
    if (recordEnd > end) {
      result.push({
        ...resizeRecord(record, end, recordEnd),
        id: `${String(record.id)}.after`,
      });
    }
  }
  result.push(
    Object.freeze({
      ...reservation(id, start, end),
      addressSpaceId: "cpu16-vic",
      bankId: "vic-bank-0",
    }),
  );
  return Object.freeze(
    result.sort((left, right) => (left.start as number) - (right.start as number)),
  );
}

/** Return whether one interval is owned by a compiler helper routine. */
function helperOwned(interval: EvidenceRecord): boolean {
  const owner = interval.owner;
  return typeof owner === "object" && owner !== null && "kind" in owner && owner.kind === "helper";
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
  // Scratch is the complete all-helper physical view. Counting grouped
  // intervals avoids double-counting helper homes that overlay across calls.
  const helperIntervals = (storageIntervals(certificate) ?? []).filter(({ kind, start, end }) => {
    if (kind !== "sfa") return false;
    const homes = certificate.homes.filter(
      (home) => home.address <= end && home.address + home.bytes - 1 >= start,
    );
    return homes.length > 0 && homes.every(({ requestId }) => helperIds.has(requestId));
  });
  const scratch = helperIntervals.reduce(
    (total, interval) => total + (interval.end - interval.start + 1),
    0,
  );
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
        cycles: deriveEntryPathCycles(layout.program),
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
  const primaryArtifact = input.d64?.path ?? basename(input.artifacts.prg.path);
  const primaryBytes = input.d64?.bytes ?? (await readFile(input.artifacts.prg.path));
  const programBytes =
    input.d64 === undefined
      ? Math.max(0, primaryBytes.byteLength - 2)
      : (input.d64.image.files.find(({ file }) => file.id === input.d64!.bootComponentId)?.file.body
          .length ?? 0);
  const semanticAssets = input.program.semantic.assets
    .filter(
      (asset): asset is ResidentAsset =>
        asset.kind === "resident-asset" && input.program.reachableAssets.includes(asset.id),
    )
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.sourcePath), Buffer.from(right.sourcePath)),
    );
  const scalarAssets = input.program.semantic.assets
    .filter((asset): asset is ScalarAsset => asset.kind === "scalar-asset")
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.sourcePath), Buffer.from(right.sourcePath)),
    );
  const assetIds = new Map(semanticAssets.map((asset) => [asset.id, assetEvidenceId(asset)]));
  const loadedPayloads = input.layout.intervals
    .filter(({ kind, bytes }) => kind !== "fill" && bytes !== null)
    .sort((left, right) => left.start - right.start);
  const paddingBefore = (start: number): number => {
    const previous = loadedPayloads.filter(({ end }) => end < start).at(-1);
    return previous === undefined
      ? Math.max(0, start - input.layout.loadRange.start)
      : Math.max(0, start - previous.end - 1);
  };
  const residentRecords = semanticAssets.map((asset) => {
    const placement = input.layout.intervals.find(({ id }) => id === `asset.${asset.id}`);
    if (placement === undefined) throw new Error("Reachable asset has no final placement");
    const data = input.layout.program.data.find(({ id }) => id === placement.id);
    const vicVisible = data?.vicVisible === true;
    const visibility = vicVisible ? ["vic"] : [];
    const handlerConstraints = assetConstraints(asset);
    const alignmentBytes =
      placement.requiredAlignment ??
      Math.max(
        1,
        ...handlerConstraints
          .filter(({ kind }) => kind === "align")
          .map(({ bytes }) => Number(bytes)),
      );
    const evidenceId = assetIds.get(asset.id)!;
    return Object.freeze({
      id: evidenceId,
      inputs: Object.freeze([
        Object.freeze({
          path: asset.sourcePath,
          bytes: asset.inputBytes,
          sha256: asset.inputSha256,
        }),
      ]),
      handler: asset.handler.handlerKey,
      handlerVersion: asset.handler.handlerVersion,
      selector: asset.handler.selector,
      representation: asset.handler.representation,
      logicalType: assetLogicalType(asset),
      shape: Object.freeze(assetShape(asset)),
      outputSha256: asset.outputSha256,
      payloadBytes: asset.bytes.length,
      emittedBytes: asset.bytes.length,
      aliases: Object.freeze([assetSymbolName(asset.id)]),
      constraints: Object.freeze(handlerConstraints.map((constraint) => Object.freeze(constraint))),
      placement: Object.freeze({
        kind: "single",
        range: Object.freeze({
          addressSpaceId: "cpu16",
          start: placement.start,
          end: placement.end + 1,
          alignmentBytes,
          paddingBeforeBytes: paddingBefore(placement.start),
          residencyId: "resident",
          visibility: Object.freeze(visibility),
          writableRanges: Object.freeze([]),
        }),
      }),
    });
  });
  const scalarRecords = scalarAssets.map((asset) =>
    Object.freeze({
      id: assetEvidenceId(asset),
      inputs: Object.freeze([
        Object.freeze({
          path: asset.sourcePath,
          bytes: asset.inputBytes,
          sha256: asset.inputSha256,
        }),
      ]),
      handler: asset.handler.handlerKey,
      handlerVersion: asset.handler.handlerVersion,
      selector: asset.handler.selector,
      representation: asset.handler.representation,
      logicalType: assetLogicalType(asset),
      shape: Object.freeze(assetShape(asset)),
      outputSha256: asset.outputSha256,
      payloadBytes: 0,
      emittedBytes: 0,
      aliases: Object.freeze([assetSymbolName(asset.id)]),
      constraints: Object.freeze([]),
      placement: Object.freeze({ kind: "compileTime", outputSha256: asset.outputSha256 }),
    }),
  );
  // An embedded load unit is a disk-only asset. Its destinations are the proved mutable
  // ranges in the resident image, never the unit bytes themselves.
  const d64Artifact = input.d64;
  const loadableAssetRecords =
    d64Artifact === undefined
      ? []
      : input.program.semantic.loadUnits.flatMap((unit) => {
          const provenance = unit.provenance;
          if (provenance.kind !== "embedded" || !input.program.reachableLoadUnits.includes(unit.id))
            return [];
          const asset = input.program.semantic.assets.find(
            (candidate): candidate is ResidentAsset =>
              candidate.kind === "resident-asset" && candidate.id === provenance.assetId,
          );
          if (asset === undefined) return [];
          const destinations: EvidenceRecord[] = [];
          for (const fn of input.program.semantic.functions) {
            if (
              !input.program.reachableFunctions.some(
                (id) => bindingIdentityKey(id) === bindingIdentityKey(fn.id),
              )
            )
              continue;
            for (const block of fn.blocks) {
              for (const operation of block.operations) {
                if (operation.kind !== "load-unit" || operation.unitId !== unit.id) continue;
                const key = bindingIdentityKey(operation.destinationBinding);
                const interval = input.layout.intervals.find(({ id }) => id.includes(key));
                if (interval === undefined) continue;
                const start = interval.start + operation.destinationRange.start;
                const end = interval.start + operation.destinationRange.end;
                if (end - start !== unit.size) continue;
                if (destinations.some((range) => range.start === start && range.end === end))
                  continue;
                destinations.push(
                  Object.freeze({
                    addressSpaceId: "cpu16",
                    start,
                    end,
                    alignmentBytes: interval.requiredAlignment ?? 1,
                    paddingBeforeBytes: 0,
                    residencyId: "resident",
                    visibility: Object.freeze(["cpu"]),
                    writableRanges: Object.freeze([]),
                  }),
                );
              }
            }
          }
          if (destinations.length === 0) return [];
          return [
            Object.freeze({
              id: assetEvidenceId(asset),
              inputs: Object.freeze([
                Object.freeze({
                  path: asset.sourcePath,
                  bytes: asset.inputBytes,
                  sha256: asset.inputSha256,
                }),
              ]),
              handler: asset.handler.handlerKey,
              handlerVersion: asset.handler.handlerVersion,
              selector: asset.handler.selector,
              representation: asset.handler.representation,
              logicalType: assetLogicalType(asset),
              shape: Object.freeze(assetShape(asset)),
              outputSha256: sha256(Uint8Array.from(unit.bytes)),
              payloadBytes: unit.size,
              emittedBytes: unit.size,
              aliases: Object.freeze([]),
              constraints: Object.freeze(
                assetConstraints(asset).map((constraint) => Object.freeze(constraint)),
              ),
              placement: Object.freeze({
                kind: "loadable",
                loadUnitId: unit.id,
                artifactPath: d64Artifact.path,
                destinations: Object.freeze(
                  destinations.sort(
                    (left, right) => (left.start as number) - (right.start as number),
                  ),
                ),
              }),
            }),
          ];
        });
  const assetEvidence = Object.freeze({
    kind: "blend65.assets",
    schemaVersion: 1,
    assets: Object.freeze(
      [...residentRecords, ...scalarRecords, ...loadableAssetRecords].sort((left, right) =>
        Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
      ),
    ),
  });
  const globalSizes = new Map(
    input.program.semantic.globals.map(
      (global) => [bindingIdentityKey(global.id), semanticTypeSize(global.type)] as const,
    ),
  );
  const loadDestinations = new Map<string, LoadDestinationEvidence>();
  for (const fn of input.program.semantic.functions) {
    if (
      !input.program.reachableFunctions.some(
        (id) => bindingIdentityKey(id) === bindingIdentityKey(fn.id),
      )
    )
      continue;
    for (const block of fn.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "load-unit") continue;
        const key = bindingIdentityKey(operation.destinationBinding);
        const size = globalSizes.get(key);
        if (size === undefined) continue;
        const wholeRoot =
          operation.destinationRange.start === 0 && operation.destinationRange.end === size;
        const existing = loadDestinations.get(key);
        loadDestinations.set(
          key,
          Object.freeze({
            range: Object.freeze({ ...operation.destinationRange }),
            unitIds: Object.freeze(
              [...new Set([...(existing?.unitIds ?? []), operation.unitId])].sort(),
            ),
            wholeRoot: (existing?.wholeRoot ?? true) && wholeRoot,
          }),
        );
      }
    }
  }
  const layoutIntervals = deriveMemoryIntervals(
    input.layout,
    input.inventory,
    input.certificate,
    assetIds,
    loadDestinations,
  );
  // Color RAM is a separate 4-bit hardware space. Screen and character-ROM
  // reservations are layout constraints, but cannot become CPU intervals while
  // the contiguous PRG legitimately spans those addresses as RAM.
  const colorRam = reservation("color-ram.hardware", 0, 0x400, "colorram4");
  const cpuLayout = layoutIntervals.filter(({ addressSpaceId }) => addressSpaceId === "cpu16");
  const reserved: EvidenceRecord[] = [];
  const reserveGaps = (prefix: string, start: number, end: number): void => {
    reserved.push(
      ...reserveUncovered(
        prefix,
        start,
        end,
        [...cpuLayout, ...reserved].map(({ start: itemStart, end: itemEnd }) => ({
          start: itemStart as number,
          end: (itemEnd as number) - 1,
        })),
      ),
    );
  };
  // The CPU free partition is bounded to the allocatable resident window.
  // Everything outside it is reported as reserved hardware/OS address space.
  reserveGaps("platform.cpu-low", 0x0000, 0x0400);
  reserveGaps("platform.screen", 0x0400, 0x0800);
  reserveGaps("platform.cpu-low", 0x0800, 0x0801);
  reserveGaps("platform.character-rom", 0x1000, 0x2000);
  reserveGaps("platform.cpu-high", 0xd000, 0x10000);
  const baseIntervals = [...layoutIntervals, ...reserved, colorRam];
  const cpu = baseIntervals.filter(({ addressSpaceId }) => addressSpaceId === "cpu16");
  const screenStarts = input.layout.program.data
    .filter(({ vicScreenRole }) => vicScreenRole === true)
    .map(({ id }) => input.layout.intervals.find((interval) => interval.id === id)?.start)
    .filter((start): start is number => start !== undefined);
  const activeScreens =
    screenStarts.length === 0 ? [input.profile.machine.screenAddress] : [...new Set(screenStarts)];
  const projections = cpu
    .filter(({ start, end }) => (start as number) < 0x4000 && (end as number) > 0)
    .map(vicProjection);
  let vic: readonly EvidenceRecord[] = projections;
  for (const screenStart of activeScreens) {
    vic = overlayVicReservation(
      vic,
      screenStart,
      screenStart + 0x400,
      `vic.screen.${screenStart.toString(16)}`,
    );
  }
  vic = overlayVicReservation(
    vic,
    input.profile.machine.characterRomStart,
    input.profile.machine.characterRomEnd + 1,
    `vic.character-rom.${input.profile.machine.characterRomStart.toString(16)}`,
  );
  const intervals = Object.freeze(
    [...baseIntervals, ...vic].sort((left, right) => {
      const text = (value: unknown): Buffer => Buffer.from(String(value ?? ""));
      const address = Buffer.compare(text(left.addressSpaceId), text(right.addressSpaceId));
      if (address !== 0) return address;
      const bank = Buffer.compare(text(left.bankId), text(right.bankId));
      if (bank !== 0) return bank;
      const start = (left.start as number) - (right.start as number);
      if (start !== 0) return start;
      const end = (left.end as number) - (right.end as number);
      if (end !== 0) return end;
      const leftOwner = left.owner as { readonly kind: string; readonly id: string };
      const rightOwner = right.owner as { readonly kind: string; readonly id: string };
      return (
        Buffer.compare(text(left.kind), text(right.kind)) ||
        Buffer.compare(text(leftOwner.kind), text(rightOwner.kind)) ||
        Buffer.compare(text(leftOwner.id), text(rightOwner.id)) ||
        Buffer.compare(text(left.id), text(right.id))
      );
    }),
  );
  const loadStateGroups = [...loadDestinations.entries()]
    .filter(([, destination]) => destination.wholeRoot)
    .sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const loadStateViews = loadStateGroups.flatMap(([key, destination], index) => {
    const group = `load-state:${key}`;
    return [
      buildView(
        `cpu16-load-${index}-unloaded`,
        "cpu",
        "cpu16",
        0,
        0x10000,
        cpu,
        ["cpu"],
        undefined,
        ["resident", `${group}:unloaded`],
      ),
      ...destination.unitIds.map((unitId: string) =>
        buildView(
          `cpu16-load-${index}-unit-${unitId.slice(0, 8)}`,
          "cpu",
          "cpu16",
          0,
          0x10000,
          cpu,
          ["cpu"],
          undefined,
          ["resident", `${group}:unit:${unitId}`],
        ),
      ),
    ];
  });
  const views = Object.freeze(
    [
      buildView("color-ram", "vic", "colorram4", 0, 0x400, [colorRam], ["color-ram"]),
      buildView("cpu16-resident", "cpu", "cpu16", 0, 0x10000, cpu, ["cpu"]),
      buildView("vic-bank-0", "vic", "cpu16-vic", 0, 0x4000, vic, ["vic"], "vic-bank-0"),
      ...loadStateViews,
    ].sort((left, right) =>
      Buffer.compare(Buffer.from(String(left.id)), Buffer.from(String(right.id))),
    ),
  );
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
    residencies: Object.freeze(
      [
        Object.freeze({ kind: "always", id: "resident" as const }),
        ...loadStateGroups.flatMap(([key, destination]) => {
          const group = `load-state:${key}`;
          return [
            Object.freeze({ kind: "exclusive" as const, id: `${group}:unloaded`, group }),
            ...destination.unitIds.map((unitId: string) =>
              Object.freeze({
                kind: "exclusive" as const,
                id: `${group}:unit:${unitId}`,
                group,
              }),
            ),
          ];
        }),
      ].sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id))),
    ),
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
    loadStates: Object.freeze(
      input.program.semantic.functions
        .filter((fn) =>
          input.program.reachableFunctions.some(
            (id) => bindingIdentityKey(id) === bindingIdentityKey(fn.id),
          ),
        )
        .flatMap((fn) =>
          fn.blocks.flatMap((block) =>
            block.operations
              .filter(
                (operation): operation is Extract<typeof operation, { kind: "load-unit" }> =>
                  operation.kind === "load-unit",
              )
              .map((operation) => {
                const key = bindingIdentityKey(operation.destinationBinding);
                const destination = intervals.find((interval) => String(interval.id).includes(key));
                const site = Object.freeze({
                  path: operation.span.sourceId,
                  startByte: operation.span.start,
                  endByte: operation.span.end,
                });
                return Object.freeze({
                  callSite: site,
                  unitId: operation.unitId,
                  destinationIntervalIds: Object.freeze(
                    destination === undefined ? [] : [String(destination.id)],
                  ),
                  quiescence: Object.freeze({
                    routes: Object.freeze([]),
                    status: "proved" as const,
                  }),
                  publicationPoint: Object.freeze({
                    callSite: site,
                    resultEdge: "true" as const,
                  }),
                });
              }),
          ),
        ),
    ),
    views,
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
  // Split the inline loader setup and the call-site result handling out of the
  // containing function code so each emitted byte is attributed exactly once.
  const roleBytes = new Map<string, { loader: number; callSite: number }>();
  for (const fn of input.layout.program.functions) {
    for (const block of fn.blocks) {
      const origin = block.origin;
      if (origin === undefined) continue;
      let address = origin;
      for (const instruction of block.instructions) {
        const role = instruction.loadUnitRole;
        if (role !== undefined) {
          const current = address;
          const interval = loaded.find(({ start, end }) => current >= start && current <= end);
          if (interval !== undefined) {
            const counts = roleBytes.get(interval.id) ?? { loader: 0, callSite: 0 };
            counts[role] += instruction.cost.bytes;
            roleBytes.set(interval.id, counts);
          }
        }
        address += instruction.cost.bytes;
      }
    }
  }
  const residentCostEntries = loaded.flatMap((interval) => {
    const size = interval.end - interval.start + 1;
    const role = roleBytes.get(interval.id);
    const plainBytes = size - (role?.loader ?? 0) - (role?.callSite ?? 0);
    const entry = (component: string, bytes: number, suffix: string) =>
      Object.freeze({
        kind: "bytes" as const,
        id: `program:${interval.id}${suffix}`,
        owner: Object.freeze({ kind: "compiler" as const, id: interval.id }),
        component,
        accounting: "program" as const,
        bytes,
        sourceSites: Object.freeze([]),
        dependencyIds: Object.freeze([]),
      });
    return [
      ...(plainBytes > 0 ? [entry(programComponent(interval.kind), plainBytes, "")] : []),
      ...((role?.loader ?? 0) > 0 ? [entry("loader", role!.loader, ":loader")] : []),
      ...((role?.callSite ?? 0) > 0 ? [entry("callSite", role!.callSite, ":callSite")] : []),
    ];
  });
  const compileTimeCostEntries = scalarAssets.map((asset) =>
    Object.freeze({
      kind: "bytes" as const,
      id: `compile-time:${asset.id}`,
      owner: Object.freeze({ kind: "symbol" as const, id: assetSymbolName(asset.id) }),
      component: "initializedData" as const,
      accounting: "program" as const,
      bytes: 0,
      sourceSites: Object.freeze([]),
      dependencyIds: Object.freeze([]),
    }),
  );
  const diskCostEntries =
    input.d64 === undefined
      ? []
      : [
          Object.freeze({
            kind: "bytes" as const,
            id: "loader:kernal-existing-rom",
            owner: Object.freeze({ kind: "platform" as const, id: "kernal-load" }),
            component: "existingRom" as const,
            accounting: "existingRom" as const,
            bytes: 0,
            sourceSites: Object.freeze([]),
            dependencyIds: Object.freeze([]),
          }),
          ...input.d64.image.files
            .filter(({ file }) => file.id !== input.d64!.bootComponentId)
            .map(({ file }) =>
              Object.freeze({
                kind: "bytes" as const,
                id: `disk-file:${file.id}`,
                owner: Object.freeze({ kind: "loadUnit" as const, id: file.id }),
                component: "diskFile" as const,
                accounting: "diskFile" as const,
                bytes: file.body.length,
                sourceSites: Object.freeze([]),
                dependencyIds: Object.freeze([]),
              }),
            ),
          Object.freeze({
            kind: "blocks" as const,
            id: "disk:d64-container",
            owner: Object.freeze({ kind: "compiler" as const, id: "packager" }),
            component: "sectorOverhead" as const,
            blocks: input.d64.image.usedBlocks,
            sourceSites: Object.freeze([]),
            dependencyIds: Object.freeze([]),
          }),
        ];
  const costEntries = [...residentCostEntries, ...compileTimeCostEntries, ...diskCostEntries].sort(
    (left, right) => {
      const leftKey = `${left.kind}\0${"accounting" in left ? left.accounting : ""}\0${left.component}\0${left.owner.kind}\0${left.owner.id}\0${left.id}`;
      const rightKey = `${right.kind}\0${"accounting" in right ? right.accounting : ""}\0${right.component}\0${right.owner.kind}\0${right.owner.id}\0${right.id}`;
      return Buffer.compare(Buffer.from(leftKey), Buffer.from(rightKey));
    },
  );
  const completePathId = "program.entry-to-return";
  const unknownMeasurement = Object.freeze({ kind: "unknown" as const });
  const finalPathCycles = sizeCostVector(input.layout, input.certificate).pathCycles;
  const cycleEntry = Object.freeze({
    kind: "cycles",
    id: `cycles:${completePathId}`,
    owner: Object.freeze({ kind: "compiler", id: "pipeline" }),
    pathId: completePathId,
    cycles: finalPathCycles[0]?.cycles ?? unknownMeasurement,
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
  // Final resources reconcile with the CPU program image. Hardware
  // reservations live in their own address space and never inflate program RAM.
  const residentRam = intervals
    .filter(
      ({ addressSpaceId, bankId, kind }) =>
        addressSpaceId === "cpu16" && bankId === undefined && kind !== "reservation",
    )
    .reduce((total, interval) => total + (interval.size as number), 0);
  const zeroPage = intervals
    .filter(
      ({ addressSpaceId, bankId, resourceClass }) =>
        addressSpaceId === "cpu16" && bankId === undefined && resourceClass === "zeroPage",
    )
    .reduce((total, interval) => total + (interval.size as number), 0);
  const scratch = intervals
    .filter(
      (interval) =>
        interval.addressSpaceId === "cpu16" &&
        interval.bankId === undefined &&
        (interval.kind === "scratch" || helperOwned(interval)),
    )
    .reduce((total, interval) => total + (interval.size as number), 0);
  const finalVector: SizeCostVector = Object.freeze({
    programBytes,
    pathCycles: finalPathCycles,
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
      sha256: input.d64?.sha256 ?? input.artifacts.prg.sha256,
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
      [
        ...[...semanticAssets, ...scalarAssets].map((asset) => ({
          sourcePath: asset.sourcePath,
          handler: asset.handler,
          inputSha256: asset.inputSha256,
        })),
        ...loadableAssetRecords.map((record) => ({
          sourcePath: String((record.inputs[0] as { path: unknown }).path),
          handler: {
            handlerKey: String(record.handler),
            handlerVersion: String(record.handlerVersion),
            selector: String(record.selector),
          },
          inputSha256: String((record.inputs[0] as { sha256: unknown }).sha256),
        })),
      ]
        .sort(
          (left, right) =>
            Buffer.compare(Buffer.from(left.sourcePath), Buffer.from(right.sourcePath)) ||
            Buffer.compare(
              Buffer.from(left.handler.handlerKey),
              Buffer.from(right.handler.handlerKey),
            ) ||
            Buffer.compare(Buffer.from(left.handler.selector), Buffer.from(right.handler.selector)),
        )
        .map((asset) =>
          Object.freeze({
            path: asset.sourcePath,
            sha256: asset.inputSha256,
            handler: asset.handler.handlerKey,
            handlerVersion: asset.handler.handlerVersion,
            selector: asset.handler.selector,
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
    loadUnits: Object.freeze(
      input.d64 === undefined
        ? []
        : input.d64.image.files
            .map(({ file }) => {
              const boot = file.id === input.d64!.bootComponentId;
              return Object.freeze({
                name: file.id,
                kind: boot ? ("resident" as const) : ("loadable" as const),
                publication: boot ? ("primary" as const) : ("contained" as const),
                artifact: Object.freeze({
                  path: primaryArtifact,
                  kind: boot ? ("primary" as const) : ("contained" as const),
                  sha256: input.d64!.sha256,
                }),
                residence: Object.freeze([]),
              });
            })
            .sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name))),
    ),
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
        bytes: primaryBytes.byteLength,
        sha256: input.d64?.sha256 ?? input.artifacts.prg.sha256,
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
          [
            ...new Map([
              ...[...semanticAssets, ...scalarAssets].map(
                (asset) =>
                  [
                    `${asset.sourcePath}\0${asset.inputSha256}`,
                    Object.freeze({
                      path: asset.sourcePath,
                      bytes: asset.inputBytes,
                      sha256: asset.inputSha256,
                    }),
                  ] as const,
              ),
              ...loadableAssetRecords.flatMap((record) =>
                record.inputs.map(
                  (assetInput) =>
                    [
                      `${String(assetInput.path)}\0${String(assetInput.sha256)}`,
                      Object.freeze({
                        path: String(assetInput.path),
                        bytes: Number(assetInput.bytes),
                        sha256: String(assetInput.sha256),
                      }),
                    ] as const,
                ),
              ),
            ]).values(),
          ].sort(
            (left, right) =>
              Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)) ||
              Buffer.compare(Buffer.from(left.sha256), Buffer.from(right.sha256)),
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
      package:
        input.d64 === undefined
          ? Object.freeze({
              kind: "prg",
              artifactPath: primaryArtifact,
              loadAddress: primaryBytes[0]! | (primaryBytes[1]! << 8),
              endAddress:
                (primaryBytes[0]! | (primaryBytes[1]! << 8)) + primaryBytes.byteLength - 2,
            })
          : d64PackageEvidence(input.d64, primaryArtifact),
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
