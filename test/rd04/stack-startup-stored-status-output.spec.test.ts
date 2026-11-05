import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords, readProfileArtifacts } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** The modes whose existing candidate policies must remain unchanged. */
type Optimization = "none" | "size" | "balanced" | "speed";

/** Actual public artifacts belonging to one successful generation. */
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Nest every push before its matching pull to reach exactly 188 source bytes. */
function pressureSource(): string {
  return (
    "module Game;function main():void{" + "asm_php();".repeat(188) + "asm_plp();".repeat(188) + "}"
  );
}

/** Build a real project in an owned temporary directory and always remove it. */
async function withArtifacts(
  profile: (typeof sourceLibraryProfiles)[number],
  optimization: Optimization,
  inspect: (artifacts: Artifacts) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(
    join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "blend65-stored-status-output-"),
  );
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "game.blend"), pressureSource());
    const project = join(root, "blend65.json");
    await writeFile(
      project,
      JSON.stringify({
        schemaVersion: 1,
        name: "stack-startup-stored-status-output",
        sourceRoot: "src",
        entry: "Game",
        target: profile,
        outDir: "out",
        optimization,
      }),
    );
    const result = await buildProject({ project, optimization });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") throw new Error("Expected a successful pressure build.");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    await inspect(await readProfileArtifacts(result));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Reject absent, fractional or negative resource evidence instead of defaulting to zero. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Expected a nonnegative integer in the generated report.");
  }
  return value;
}

/** Resolve exactly one charged standard resource by its public identity. */
function resource(totals: Record<string, unknown>, id: string): number {
  const rows = profileRecords(totals.resources).filter(
    (row) => row.kind === "standard" && row.id === id,
  );
  expect(rows, id).toHaveLength(1);
  return integer(rows[0]!.value);
}

/**
 * Reconcile physical resident addresses without double-counting overlaid rows.
 * Every interval must describe its complete, exclusive-end physical extent.
 */
function residentBytes(intervals: Record<string, unknown>[]): number {
  const addresses = new Set<number>();
  for (const interval of intervals) {
    const start = integer(interval.start);
    const end = integer(interval.end);
    expect(end).toBeGreaterThanOrEqual(start);
    expect(end).toBeLessThanOrEqual(0x10000);
    expect(integer(interval.size)).toBe(end - start);
    if (interval.resourceClass !== "general") continue;
    for (let address = start; address < end; address += 1) addresses.add(address);
  }
  expect(addresses.size).toBeGreaterThan(0);
  return addresses.size;
}

describe("stored-status startup whole-artifact resource bounds", () => {
  for (const profile of sourceLibraryProfiles) {
    it(`fits the equal-stack artifact and memory bounds on ${profile}`, async () => {
      await withArtifacts(profile, "none", async (artifacts) => {
        const totals = profileRecord(artifacts.costs.totals);
        expect(artifacts.prg.length).toBeGreaterThan(2);
        const payload = artifacts.prg.length - 2;
        expect(integer(totals.programBytes)).toBe(payload);
        expect(payload).toBeLessThanOrEqual(477);
        expect(resource(totals, "zeroPage")).toBe(0);
        expect(resource(totals, "scratch")).toBe(0);
        expect(resource(totals, "hardwareStack")).toBe(188);

        const intervals = profileRecords(artifacts.memory.intervals);
        const startup = intervals.filter((row) => row.id === "platform.startup-state");
        expect(startup).toHaveLength(1);
        // A, X, Y, P, CPU DDR/port and CIA2 DDRA need seven saved bytes.
        // This source borrows no BASIC workspace and needs no display state.
        expect(startup[0]).toMatchObject({
          kind: "bss",
          resourceClass: "general",
          size: 7,
          payloadBytes: 7,
        });
        const resident = resource(totals, "residentRam");
        expect(resident).toBe(residentBytes(intervals));
        expect(resident).toBeLessThanOrEqual(484);
        const zeroPage = intervals.filter((row) => row.resourceClass === "zeroPage");
        expect(zeroPage.reduce((sum, row) => sum + integer(row.size), 0)).toBe(0);

        const bounded = profileRecords(artifacts.memory.stackDomains).filter(
          (row) => row.id === "bounded-component-capacity",
        );
        expect(bounded).toHaveLength(1);
        expect(bounded[0]).toMatchObject({
          capacityBytes: 236,
          peakBytes: 188,
          headroomBytes: 48,
        });
        expect(profileRecords(artifacts.costs.decisions)).toEqual([]);
      });
    }, 120_000);
  }

  for (const mode of ["size", "balanced", "speed"] as const) {
    it(`keeps the established ${mode} candidate policy`, async () => {
      await withArtifacts("c64-pal-prg-kernal-6581", mode, async (artifacts) => {
        const decisions = profileRecords(artifacts.costs.decisions);
        expect(decisions).toHaveLength(1);
        const decision = decisions[0]!;
        expect(decision.mode).toBe(mode);
        const candidates = profileRecords(decision.candidates);
        expect(candidates.length).toBeGreaterThan(0);
        for (const candidate of candidates) {
          expect(typeof candidate.id).toBe("string");
          if (typeof candidate.id !== "string") throw new TypeError("Missing candidate ID.");
          expect(candidate.id.endsWith(":compact-stored")).toBe(false);
          expect(candidate.id).toMatch(/:(?:full|compact-unrolled|compact-looped)$/u);
        }
        expect(typeof decision.selectedCandidateId).toBe("string");
        if (typeof decision.selectedCandidateId !== "string") {
          throw new TypeError("Missing selected candidate ID.");
        }
        expect(decision.selectedCandidateId.endsWith(":compact-stored")).toBe(false);
        expect(decision.selectedCandidateId).toMatch(/:(?:full|compact-unrolled|compact-looped)$/u);
        expect(candidates.some((row) => row.id === decision.selectedCandidateId)).toBe(true);
      });
    }, 120_000);
  }
});
