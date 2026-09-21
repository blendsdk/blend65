import { canonicalEvidenceJson } from "../artifacts/evidence-validation.js";
import type {
  AssetsEvidence,
  BuildEvidence,
  CostsEvidence,
  DebugEvidence,
  MemoryEvidence,
} from "../artifacts/evidence-types.js";

/** Compare two JSON-safe values through their canonical evidence spelling. */
function sameValue(left: unknown, right: unknown): boolean {
  return canonicalEvidenceJson(left) === canonicalEvidenceJson(right);
}

/** Return whether every source site resolves inside the exact build source inventory. */
function sourceSitesMatchBuild(
  sites: readonly Record<string, unknown>[],
  sourceBytes: ReadonlyMap<string, number>,
): boolean {
  return sites.every((site) => {
    const bytes = sourceBytes.get(String(site.path));
    return bytes !== undefined && (site.endByte as number) <= bytes;
  });
}

/** Collect every source site carried by memory and cost evidence. */
function evidenceSourceSites(
  memory: MemoryEvidence,
  costs: CostsEvidence,
): Record<string, unknown>[] {
  const memorySites = (memory.intervals as Record<string, unknown>[]).flatMap((interval) => {
    const origin = interval.origin as Record<string, unknown>;
    return origin.kind === "source" ? [origin.site as Record<string, unknown>] : [];
  });
  memorySites.push(
    ...(memory.unboundedEffects as Record<string, unknown>[]).map(
      ({ site }) => site as Record<string, unknown>,
    ),
  );
  const costSites = (costs.entries as Record<string, unknown>[]).flatMap(
    ({ sourceSites }) => sourceSites as Record<string, unknown>[],
  );
  for (const decision of costs.decisions as Record<string, unknown>[]) {
    costSites.push(...(decision.sourceSites as Record<string, unknown>[]));
    for (const candidate of decision.candidates as Record<string, unknown>[]) {
      const feasibility = candidate.feasibility as Record<string, unknown>;
      if (feasibility.kind !== "rejected") continue;
      for (const reason of feasibility.reasons as Record<string, unknown>[]) {
        costSites.push(...(reason.sourceSites as Record<string, unknown>[]));
      }
    }
  }
  return [...memorySites, ...costSites];
}

/** Derive the four standard cost resources from the final memory and stack ledger. */
function standardMemoryResources(memory: MemoryEvidence): ReadonlyMap<string, number> {
  const intervals = memory.intervals as Record<string, unknown>[];
  const views = (memory.views as Record<string, unknown>[]).filter(
    ({ consumer }) => consumer === "cpu",
  );
  const activeTotal = (
    view: Record<string, unknown>,
    include: (interval: Record<string, unknown>) => boolean,
  ): number => {
    const active = new Set(view.activeResidencyIds as string[]);
    return intervals
      .filter(
        (interval) =>
          interval.addressSpaceId === view.addressSpaceId &&
          interval.bankId === view.bankId &&
          (interval.start as number) >= (view.start as number) &&
          (interval.end as number) <= (view.end as number) &&
          (interval.residencyIds as string[]).some((id) => active.has(id)) &&
          include(interval),
      )
      .reduce((sum, interval) => sum + (interval.size as number), 0);
  };
  const maximum = (values: readonly number[]): number => Math.max(0, ...values);
  const residentRam = maximum(
    views.map((view) =>
      activeTotal(
        view,
        (interval) => interval.kind !== "existingRom" && interval.resourceClass !== "device",
      ),
    ),
  );
  const scratch = maximum(
    views.map((view) => activeTotal(view, (interval) => interval.kind === "scratch")),
  );
  const zeroPage = maximum(views.map(({ zeroPageBytes }) => zeroPageBytes as number));
  const hardwareStack = maximum(
    (memory.stackDomains as Record<string, unknown>[]).map(({ peakBytes }) => peakBytes as number),
  );
  return new Map([
    ["zeroPage", zeroPage],
    ["residentRam", residentRam],
    ["hardwareStack", hardwareStack],
    ["scratch", scratch],
  ]);
}

/** Return whether every selected asset placement is the same placement recorded by memory. */
function assetPlacementsMatchMemory(
  assets: readonly Record<string, unknown>[],
  memory: MemoryEvidence,
): boolean {
  const intervals = memory.intervals as Record<string, unknown>[];
  const residencyIds = new Set(
    (memory.residencies as Record<string, unknown>[]).map(({ id }) => String(id)),
  );
  return assets.every((asset) => {
    const placement = asset.placement as Record<string, unknown>;
    const ranges =
      placement.kind === "single"
        ? [placement.range as Record<string, unknown>]
        : placement.kind === "replicated"
          ? (placement.copies as Record<string, unknown>[])
          : (placement.destinations as Record<string, unknown>[]);
    const owned = intervals.filter((interval) => {
      const owner = interval.owner as Record<string, unknown>;
      const origin = interval.origin as Record<string, unknown>;
      return (
        owner.kind === "asset" &&
        owner.id === asset.id &&
        origin.kind === "asset" &&
        origin.assetId === asset.id
      );
    });
    return (
      owned.length === ranges.length &&
      ranges.every((range) => {
        if (!residencyIds.has(String(range.residencyId))) return false;
        const writable = range.writableRanges as Record<string, unknown>[];
        return owned.some((interval) => {
          const vic = interval.vic as Record<string, unknown> | undefined;
          return (
            interval.addressSpaceId === range.addressSpaceId &&
            interval.bankId === range.bankId &&
            interval.start === range.start &&
            interval.end === range.end &&
            interval.payloadBytes === asset.payloadBytes &&
            (interval.residencyIds as string[]).includes(String(range.residencyId)) &&
            sameValue(vic?.visibility ?? [], range.visibility) &&
            (writable.length === 0
              ? interval.mutability === "immutable"
              : interval.mutability === "mutable")
          );
        });
      })
    );
  });
}

/** Reconcile every debug machine range with the physical memory ledger. */
function debugRangesMatchMemory(
  debug: DebugEvidence,
  memory: MemoryEvidence,
  assets: readonly Record<string, unknown>[],
): boolean {
  const addressSpaces = debug.addressSpaces as Record<string, unknown>[];
  const loadUnits = debug.loadUnits as Record<string, unknown>[];
  const functions = debug.functions as Record<string, unknown>[];
  const contexts = debug.contexts as Record<string, unknown>[];
  const symbols = debug.symbols as Record<string, unknown>[];
  const intervals = memory.intervals as Record<string, unknown>[];
  const assetByAlias = new Map(
    assets.flatMap((asset) =>
      (asset.aliases as string[]).map((alias) => [alias, String(asset.id)] as const),
    ),
  );
  const matches = (
    machine: Record<string, unknown>,
    owner?: Record<string, unknown>,
    requiredOwner?: (owner: Record<string, unknown>) => boolean,
  ): boolean => {
    const addressSpace = addressSpaces[machine.addressSpaceIndex as number]!;
    const banks = addressSpace.banks as Record<string, unknown>[];
    const bankId =
      machine.bankIndex === undefined ? undefined : banks[machine.bankIndex as number]!.id;
    const loadUnitId =
      machine.loadUnitIndex === undefined
        ? undefined
        : loadUnits[machine.loadUnitIndex as number]!.name;
    return intervals.some((interval) => {
      if (
        interval.addressSpaceId !== addressSpace.id ||
        interval.bankId !== bankId ||
        interval.loadUnitId !== loadUnitId ||
        (interval.start as number) > (machine.start as number) ||
        (interval.end as number) < (machine.end as number)
      ) {
        return false;
      }
      const memoryOwner = interval.owner as Record<string, unknown>;
      if (requiredOwner !== undefined && !requiredOwner(memoryOwner)) return false;
      if (owner === undefined) return true;
      if (owner.kind === "function") {
        return (
          memoryOwner.kind === "function" &&
          memoryOwner.id === functions[owner.functionIndex as number]!.qualifiedName
        );
      }
      if (owner.kind === "symbol") {
        return (
          memoryOwner.kind === "symbol" &&
          memoryOwner.id === symbols[owner.symbolIndex as number]!.qualifiedName
        );
      }
      return memoryOwner.kind === "platform" && memoryOwner.id === owner.name;
    });
  };
  for (const range of debug.ranges as Record<string, unknown>[]) {
    if (
      !matches(range.machine as Record<string, unknown>, range.owner as Record<string, unknown>)
    ) {
      return false;
    }
  }
  for (const location of debug.locations as Record<string, unknown>[]) {
    const availability = location.availability as Record<string, unknown>;
    if (availability.kind !== "available" && availability.kind !== "split") continue;
    const symbol = symbols[location.symbolIndex as number]!;
    const requiredOwner = (owner: Record<string, unknown>): boolean => {
      if (location.contextIndex !== undefined) {
        const context = contexts[location.contextIndex as number]!;
        const functionName = functions[context.functionIndex as number]!.qualifiedName;
        return (
          (owner.kind === "function" && owner.id === functionName) ||
          (symbol.kind === "helperScratch" &&
            owner.kind === "helper" &&
            owner.id === symbol.qualifiedName)
        );
      }
      if (symbol.kind === "asset") {
        const assetId = assetByAlias.get(String(symbol.qualifiedName));
        return assetId !== undefined && owner.kind === "asset" && owner.id === assetId;
      }
      if (symbol.kind === "function") {
        return owner.kind === "function" && owner.id === symbol.qualifiedName;
      }
      return owner.kind === "symbol" && owner.id === symbol.qualifiedName;
    };
    for (const piece of availability.pieces as Record<string, unknown>[]) {
      if (
        piece.kind === "memory" &&
        !matches(piece.machine as Record<string, unknown>, undefined, requiredOwner)
      ) {
        return false;
      }
    }
  }
  return (debug.loadUnits as Record<string, unknown>[]).every((loadUnit) =>
    (loadUnit.residence as Record<string, unknown>[]).every((machine) => matches(machine)),
  );
}

/** Validate references shared by independently versioned generation sidecars. */
export function sidecarReferencesAgree(
  build: BuildEvidence,
  assets: AssetsEvidence,
  memory: MemoryEvidence,
  costs: CostsEvidence,
  debug: DebugEvidence,
): boolean {
  const sourceBytes = new Map(
    build.semanticInputs.sources.map(({ path, bytes }) => [path, bytes] as const),
  );
  const packageValue = build.package as Record<string, unknown>;
  const artifactDigests = new Map(
    build.artifacts.map(({ path, sha256 }) => [path, sha256] as const),
  );
  const components =
    packageValue.kind === "d64" ? (packageValue.components as Record<string, unknown>[]) : [];
  const loadUnitIds = new Set(components.map(({ id }) => String(id)));
  const assetRecords = assets.assets as Record<string, unknown>[];
  const assetIds = new Set(assetRecords.map(({ id }) => String(id)));
  const intervals = memory.intervals as Record<string, unknown>[];
  const entries = costs.entries as Record<string, unknown>[];
  const functions = new Set(
    (debug.functions as Record<string, unknown>[]).map(({ qualifiedName }) =>
      String(qualifiedName),
    ),
  );
  const symbols = new Set(
    (debug.symbols as Record<string, unknown>[]).map(({ qualifiedName }) => String(qualifiedName)),
  );
  const candidateIds = new Set(
    (costs.decisions as Record<string, unknown>[]).flatMap((decision) =>
      (decision.candidates as Record<string, unknown>[]).map(({ id }) => String(id)),
    ),
  );
  const ownerResolves = (owner: Record<string, unknown>): boolean => {
    if (owner.kind === "function") return functions.has(String(owner.id));
    if (owner.kind === "symbol") return symbols.has(String(owner.id));
    if (owner.kind === "asset") return assetIds.has(String(owner.id));
    if (owner.kind === "loadUnit") return loadUnitIds.has(String(owner.id));
    if (owner.kind === "candidate") return candidateIds.has(String(owner.id));
    return true;
  };
  if (!sourceSitesMatchBuild(evidenceSourceSites(memory, costs), sourceBytes)) return false;
  if (
    components.some(
      ({ destinationCalls }) =>
        !sourceSitesMatchBuild(destinationCalls as Record<string, unknown>[], sourceBytes),
    ) ||
    intervals.some((interval) => {
      const owner = interval.owner as Record<string, unknown>;
      const origin = interval.origin as Record<string, unknown>;
      return (
        !ownerResolves(owner) ||
        (origin.kind === "asset" && !assetIds.has(String(origin.assetId))) ||
        (interval.loadUnitId !== undefined && !loadUnitIds.has(String(interval.loadUnitId)))
      );
    }) ||
    entries.some(({ owner }) => !ownerResolves(owner as Record<string, unknown>)) ||
    assetRecords.some((asset) => {
      const placement = asset.placement as Record<string, unknown>;
      return (
        (asset.aliases as string[]).some((alias) => !symbols.has(alias)) ||
        (placement.kind === "loadable" &&
          (!loadUnitIds.has(String(placement.loadUnitId)) ||
            placement.artifactPath !== packageValue.artifactPath))
      );
    }) ||
    (debug.loadUnits as Record<string, unknown>[]).some((loadUnit) => {
      const artifact = loadUnit.artifact as Record<string, unknown>;
      return (
        !loadUnitIds.has(String(loadUnit.name)) ||
        artifactDigests.get(String(artifact.path)) !== artifact.sha256
      );
    }) ||
    !assetPlacementsMatchMemory(assetRecords, memory) ||
    !debugRangesMatchMemory(debug, memory, assetRecords)
  ) {
    return false;
  }
  const expectedResources = standardMemoryResources(memory);
  return (
    Array.isArray((costs.totals as Record<string, unknown>).resources) &&
    ((costs.totals as Record<string, unknown>).resources as Record<string, unknown>[])
      .filter(({ kind }) => kind === "standard")
      .every(({ id, value }) => expectedResources.get(String(id)) === value)
  );
}
