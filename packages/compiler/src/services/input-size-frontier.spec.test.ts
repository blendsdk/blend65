import { buildProject, checkProject } from "@blend65/compiler";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { encodeCostsEvidence, validateCostsEvidence } from "../artifacts/evidence.js";
import {
  analyzeProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../../../../test/rd05/profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "../../../../test/rd05/source-library-fixture.js";
import type { LibraryArtifacts } from "../../../../test/rd05/source-library-fixture.js";

/** Construct an independent complete vector with one exact semantic path. */
function vector(bytes = 4, cycles = 6) {
  return {
    programBytes: bytes,
    pathCycles: [{ pathId: "main", cycles: { kind: "exact", value: cycles } }],
    resources: [
      { kind: "standard", id: "zeroPage", value: 0 },
      { kind: "standard", id: "residentRam", value: bytes },
      { kind: "standard", id: "hardwareStack", value: 0 },
      { kind: "standard", id: "scratch", value: 0 },
    ],
  };
}

/** Keep invalid mutations local to one fixture, without borrowing producer output. */
function costRecord(rejectedBaseline = false): Record<string, unknown> {
  const sourceSites = [{ path: "src/game.blend", startByte: 0, endByte: 1 }];
  const owner = { kind: "compiler", id: "fixture" };
  const byteEntry = (accounting: string) => ({
    kind: "bytes",
    id: `code-${accounting}`,
    owner,
    component: "code",
    accounting,
    bytes: 4,
    sourceSites,
    dependencyIds: [],
  });
  return {
    kind: "blend65.costs",
    schemaVersion: 1,
    mode: "size",
    totals: vector(),
    entries: [
      byteEntry("program"),
      byteEntry("residentRam"),
      {
        kind: "cycles",
        id: "main-cycles",
        owner,
        pathId: "main",
        cycles: { kind: "exact", value: 6 },
        traffic: [],
        sourceSites,
        dependencyIds: [],
      },
    ],
    decisions: [
      {
        id: "selection",
        scope: "src/game.blend::Game.main",
        mode: "size",
        sourceSites,
        closurePoint: "postLayout",
        baselineCandidateId: "baseline",
        selectedCandidateId: "selected",
        candidates: [
          {
            id: "baseline",
            feasibility: rejectedBaseline
              ? {
                  kind: "rejected",
                  reasons: [{ kind: "zeroPage", detail: "Capacity exceeded", sourceSites }],
                }
              : { kind: "feasible", vector: vector(8, 12) },
          },
          { id: "selected", feasibility: { kind: "feasible", vector: vector() } },
        ],
        incomparableComponents: [],
        tieBreak: { kind: "none" },
      },
    ],
  };
}

/** Resolve the single authored decision rather than assuming a production decision index. */
function fixtureDecision(record: Record<string, unknown>) {
  return profileRecords(record.decisions)[0]!;
}

/** Require both the encoder and reader to preserve precisely the authored value. */
function expectRoundTrip(record: Record<string, unknown>): void {
  const encoded = encodeCostsEvidence(record);
  expect(encoded.kind).toBe("complete");
  if (encoded.kind !== "complete") throw new Error(encoded.diagnostic);
  const decoded = validateCostsEvidence(encoded.bytes);
  expect(decoded.kind).toBe("complete");
  if (decoded.kind !== "complete") throw new Error(decoded.diagnostic);
  expect(decoded.value).toEqual(record);
}

/** Validate malformed values directly so encoder rejection cannot hide a permissive reader. */
function expectInvalid(record: Record<string, unknown>): void {
  expect(encodeCostsEvidence(record).kind).toBe("error");
  const decoded = validateCostsEvidence(new TextEncoder().encode(JSON.stringify(record)));
  expect(decoded.kind).toBe("error");
  if (decoded.kind !== "error") throw new Error("Invalid cost evidence was accepted");
  expect(decoded.diagnostic.length).toBeGreaterThan(0);
}

describe("closed version-one cost evidence", () => {
  // Feasible references keep their original record shape and accounting dimensions.
  it("should preserve a feasible baseline when version-one costs round-trip", () => {
    expectRoundTrip(costRecord());
  });

  // Resource failure has hard reasons, never an invented zero-valued before vector.
  it("should preserve a rejected baseline and feasible selection when costs round-trip", () => {
    expectRoundTrip(costRecord(true));
  });

  // Exact complete ties have one stable identity rule, independent of discovery order.
  it("should preserve identical complete vectors when stable identity breaks a tie", () => {
    const record = costRecord();
    const decision = fixtureDecision(record);
    profileRecords(decision.candidates)[0]!.feasibility = {
      kind: "feasible",
      vector: vector(),
    };
    decision.selectedCandidateId = "baseline";
    decision.tieBreak = { kind: "stableId", candidateIds: ["baseline", "selected"] };
    expectRoundTrip(record);
  });

  const invalidCases: readonly [string, boolean, (record: Record<string, unknown>) => void][] = [
    [
      "missing baseline identity",
      false,
      (record) => {
        fixtureDecision(record).baselineCandidateId = "missing";
      },
    ],
    [
      "duplicate candidate identity",
      false,
      (record) => {
        const candidates = profileRecords(fixtureDecision(record).candidates);
        candidates[1]!.id = candidates[0]!.id;
      },
    ],
    [
      "rejected selected candidate",
      true,
      (record) => {
        fixtureDecision(record).selectedCandidateId = "baseline";
      },
    ],
    [
      "fabricated rejected vector",
      true,
      (record) => {
        profileRecord(profileRecords(fixtureDecision(record).candidates)[0]!.feasibility).vector =
          vector();
      },
    ],
    [
      "unknown root field",
      false,
      (record) => {
        record.attemptCount = 37;
      },
    ],
    [
      "incorrect selected total",
      false,
      (record) => {
        profileRecord(record.totals).programBytes = 5;
      },
    ],
    [
      "nonexistent path reference",
      false,
      (record) => {
        fixtureDecision(record).incomparableComponents = ["T:missing"];
      },
    ],
    [
      "nonexistent resource reference",
      false,
      (record) => {
        fixtureDecision(record).incomparableComponents = ["R:missing"];
      },
    ],
    [
      "unequal stable identity tie",
      false,
      (record) => {
        const decision = fixtureDecision(record);
        decision.tieBreak = { kind: "stableId", candidateIds: ["baseline", "selected"] };
      },
    ],
  ];

  // Every original identity, union, reconciliation, and component guard remains binding.
  it.each(invalidCases)(
    "should reject %s in version-one costs",
    (_name, rejectedBaseline, mutate) => {
      const record = costRecord(rejectedBaseline);
      if (!rejectedBaseline) expectRoundTrip(record);
      mutate(record);
      expectInvalid(record);
    },
  );
});

/** Require nonnegative integral physical charges before comparing priority components. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("Expected a nonnegative integral cost");
  return value;
}

/** Compare known higher-priority byte and ordered physical-resource components. */
function comparePhysical(left: Record<string, unknown>, right: Record<string, unknown>): number {
  const bytes = integer(left.programBytes) - integer(right.programBytes);
  if (bytes !== 0) return bytes;
  const leftResources = profileRecords(left.resources);
  const rightResources = profileRecords(right.resources);
  expect(leftResources.map(({ kind, id }) => ({ kind, id }))).toEqual(
    rightResources.map(({ kind, id }) => ({ kind, id })),
  );
  for (let index = 0; index < leftResources.length; index += 1) {
    const difference = integer(leftResources[index]!.value) - integer(rightResources[index]!.value);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Inspect all published alternatives, including hard rejections and padding-inclusive totals. */
function expectCompleteComparison(artifacts: LibraryArtifacts): void {
  expectLibraryAccounting(artifacts);
  const decisions = profileRecords(artifacts.costs.decisions).filter((decision) =>
    ["wholeProgram", "postLayout", "postPackaging"].includes(String(decision.closurePoint)),
  );
  expect(decisions.length).toBeGreaterThan(0);
  for (const decision of decisions) {
    const candidates = profileRecords(decision.candidates);
    const ids = candidates.map((candidate) => candidate.id);
    expect(ids).toEqual([...new Set(ids)].sort());
    expect(candidates.length).toBeLessThanOrEqual(37);
    expect(ids).toContain(decision.baselineCandidateId);
    const selected = candidates.filter(
      (candidate) => candidate.id === decision.selectedCandidateId,
    );
    expect(selected).toHaveLength(1);
    const selectedFeasibility = profileRecord(selected[0]!.feasibility);
    expect(selectedFeasibility.kind).toBe("feasible");
    const selectedVector = profileRecord(selectedFeasibility.vector);
    expect(selectedVector).toEqual(artifacts.costs.totals);
    for (const candidate of candidates) {
      const feasibility = profileRecord(candidate.feasibility);
      if (feasibility.kind === "rejected") {
        expect(feasibility).not.toHaveProperty("vector");
        const reasons = profileRecords(feasibility.reasons);
        expect(reasons.length).toBeGreaterThan(0);
        for (const reason of reasons) expect(String(reason.detail).length).toBeGreaterThan(0);
        continue;
      }
      expect(feasibility.kind).toBe("feasible");
      const candidateVector = profileRecord(feasibility.vector);
      const physical = comparePhysical(selectedVector, candidateVector);
      expect(physical, String(candidate.id)).toBeLessThanOrEqual(0);
      if (physical !== 0) continue;
      const selectedPaths = profileRecords(selectedVector.pathCycles);
      const candidatePaths = profileRecords(candidateVector.pathCycles);
      expect(selectedPaths.map((path) => path.pathId)).toEqual(
        candidatePaths.map((path) => path.pathId),
      );
      const allExact = [...selectedPaths, ...candidatePaths].every(
        (path) => profileRecord(path.cycles).kind === "exact",
      );
      if (allExact) {
        const ordered = (paths: Record<string, unknown>[]) =>
          paths.map((path) => integer(profileRecord(path.cycles).value)).sort((a, b) => b - a);
        const selectedCycles = ordered(selectedPaths);
        const candidateCycles = ordered(candidatePaths);
        for (let index = 0; index < selectedCycles.length; index += 1) {
          if (selectedCycles[index] === candidateCycles[index]) continue;
          expect(selectedCycles[index], String(candidate.id)).toBeLessThan(candidateCycles[index]!);
          break;
        }
      } else {
        // A differing unavailable path cannot silently decide an otherwise equal comparison.
        for (let index = 0; index < selectedPaths.length; index += 1) {
          const left = profileRecord(selectedPaths[index]!.cycles);
          const right = profileRecord(candidatePaths[index]!.cycles);
          if (left.kind !== "unknown" && right.kind !== "unknown") continue;
          if (JSON.stringify(left) === JSON.stringify(right)) continue;
          expect(decision.incomparableComponents).toContain(`T:${selectedPaths[index]!.pathId}`);
          expect(profileRecord(decision.tieBreak).kind).toBe("none");
        }
      }
    }
    const tie = profileRecord(decision.tieBreak);
    if (tie.kind === "stableId") {
      if (!Array.isArray(tie.candidateIds)) throw new TypeError("Missing tied identities");
      expect(tie.candidateIds).toEqual([...new Set(tie.candidateIds)].sort());
      for (const id of tie.candidateIds) {
        const tied = candidates.filter((candidate) => candidate.id === id);
        expect(tied).toHaveLength(1);
        expect(profileRecord(tied[0]!.feasibility)).toEqual(selectedFeasibility);
      }
      expect(decision.selectedCandidateId).toBe(tie.candidateIds[0]);
    } else expect(tie.kind).toBe("none");
  }
}

/** Grow source sites while leaving the admitted whole-program recipe axes fixed. */
function repeatedSource(count: number): string {
  const functions = Array.from(
    { length: count },
    (_, index) => `function read${index}(p: const Pair): byte { return p.a; }`,
  ).join("\n");
  const calls = Array.from(
    { length: count },
    (_, index) => `answers[${index}] = read${index}(item);`,
  ).join("\n");
  return `module Game;
struct Pair { a: byte; b: byte; }
place(at: $3200) let item: Pair = { a: 7, b: 9 };
place(at: $3400) let answers: byte[${count}] = [; 0];
${functions}
function main(): void { ${calls} }`;
}

/** Ordinary aggregate result forwarding preserves one final caller-owned destination. */
function returnedChain(): string {
  const functions = Array.from({ length: 72 }, (_, index) =>
    index === 0
      ? "function f0(): Pair { return { a: 7, b: 9 }; }"
      : `function f${index}(): Pair { return f${index - 1}(); }`,
  ).join("\n");
  return `module Game;
struct Pair { a: byte; b: byte; }
place(at: $3200) let item: Pair = { a: 0, b: 0 };
${functions}
function main(): void { item = f71(); }`;
}

describe.each(sourceLibraryProfiles)("complete size frontier on %s", (profile) => {
  // More independently eligible calls cannot create a Cartesian choice per call site.
  it.each([32, 64])(
    "should close a bounded recipe inventory for %i ordinary sites",
    async (count) => {
      const source = repeatedSource(count);
      await withProfileProject(source, profile, async (project) => {
        const checked = await checkProject({ project });
        expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
        const build = async () => {
          const built = await buildProject({ project, optimization: "size" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected a complete size build");
          const artifacts = await readProfileArtifacts(built);
          expectCompleteComparison(artifacts);
          return { built, artifacts };
        };
        const first = await build();
        const second = await build();
        expect(second.artifacts.costs).toEqual(first.artifacts.costs);
        expect(second.artifacts.prg).toEqual(first.artifacts.prg);
        await withLibraryVice(second.built, second.artifacts, profile, async (monitor, stopAt) => {
          await stopAt(libraryStartup(second.artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0x3400, 0x3400 + count - 1))]).toEqual(
            Array.from({ length: count }, () => 7),
          );
        });
      });
    },
    300_000,
  );

  // A resource-rejected reference cannot make legal source permanently unbuildable in size mode.
  it("should fit an ordinary seventy-two-function returned pair despite a rejected reference", async () => {
    const source = returnedChain();
    const analyzed = await analyzeProfileSource(source, profile);
    expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
    expect(analyzed.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual(
      [],
    );
    await withProfileProject(source, profile, async (project, root) => {
      const reference = await buildProject({ project, optimization: "none" });
      expect(reference.kind).toBe("failure");
      expect(reference).not.toHaveProperty("generation");
      expect(reference.diagnostics.length).toBeGreaterThan(0);
      const output = await readdir(join(root, "out")).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
      expect(output).not.toContain("current.json");
      expect(output.filter((name) => /^[0-9a-f-]{36}$/u.test(name))).toEqual([]);
      const built = await buildProject({ project, optimization: "size" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected the admitted returned-pair fit");
      const artifacts = await readProfileArtifacts(built);
      expectCompleteComparison(artifacts);
      const rejectedReferences = profileRecords(artifacts.costs.decisions).filter((decision) => {
        const baseline = profileRecords(decision.candidates).find(
          (candidate) => candidate.id === decision.baselineCandidateId,
        );
        return baseline !== undefined && profileRecord(baseline.feasibility).kind === "rejected";
      });
      expect(rejectedReferences.length).toBeGreaterThan(0);
      for (const decision of rejectedReferences) {
        const baseline = profileRecords(decision.candidates).find(
          (candidate) => candidate.id === decision.baselineCandidateId,
        )!;
        expect(profileRecord(baseline.feasibility)).not.toHaveProperty("vector");
        expect(
          profileRecords(profileRecord(baseline.feasibility).reasons).some((reason) =>
            ["memory", "zeroPage", "stack", "sfa", "scratch", "layout"].includes(
              String(reason.kind),
            ),
          ),
        ).toBe(true);
      }
      await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
        await stopAt(libraryStartup(artifacts, "startup.restore"));
        expect([...(await monitor.readMemory(0x3200, 0x3201))]).toEqual([7, 9]);
      });
    });
  }, 300_000);
});

/** Preserve exact generation bytes, including every hidden sidecar and current pointer. */
async function generationFiles(directory: string, prefix = ""): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      for (const [path, bytes] of await generationFiles(join(directory, entry.name), relative))
        files.set(path, bytes);
    } else {
      expect(entry.isFile(), relative).toBe(true);
      files.set(relative, await readFile(join(directory, entry.name)));
    }
  }
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b, "en")));
}

describe("last-good size publication", () => {
  // Source invalidity remains terminal even when a canonical resource reference would fail.
  it.each(["none", "size"] as const)(
    "should preserve every last-good byte after a source failure in %s",
    async (mode) => {
      await withProfileProject(
        "module Game; function main(): void { poke($C100, 7); }",
        sourceLibraryProfiles[0],
        async (project, root) => {
          const good = await buildProject({ project, optimization: "none" });
          expect(good.kind, JSON.stringify(good.diagnostics)).toBe("success");
          const before = await generationFiles(join(root, "out"));
          await writeFile(
            join(root, "src/game.blend"),
            `${returnedChain()}\nfunction broken(): byte { return; }`,
          );
          const failed = await buildProject({ project, optimization: mode });
          expect(failed.kind).toBe("failure");
          expect(failed).not.toHaveProperty("generation");
          expect(failed.diagnostics.length).toBeGreaterThan(0);
          expect(failed.diagnostics.some((diagnostic) => diagnostic.code === "E10174")).toBe(true);
          expect(await generationFiles(join(root, "out"))).toEqual(before);
        },
      );
    },
    120_000,
  );

  // Cancellation preserves the publication transaction, even before any candidate starts.
  it("should preserve every last-good byte when a size build is already cancelled", async () => {
    await withProfileProject(
      "module Game; function main(): void { poke($C100, 7); }",
      sourceLibraryProfiles[0],
      async (project, root) => {
        const good = await buildProject({ project, optimization: "none" });
        expect(good.kind, JSON.stringify(good.diagnostics)).toBe("success");
        const before = await generationFiles(join(root, "out"));
        const controller = new AbortController();
        controller.abort();
        const failed = await buildProject({
          project,
          optimization: "size",
          signal: controller.signal,
        });
        expect(failed.kind).toBe("failure");
        expect(failed).toMatchObject({ category: "cancelled" });
        expect(failed).not.toHaveProperty("generation");
        expect(await generationFiles(join(root, "out"))).toEqual(before);
      },
    );
  }, 120_000);
});
