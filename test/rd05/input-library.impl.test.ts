import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
} from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";
const LIBRARY = "@blend65/stdlib/c64/input.blend::c64.input.";

/** Read one checked fixture through the existing public build/evidence path. */
async function buildFixture(name: "input-saved-caller" | "input-caller") {
  const source = await readFile(
    new URL(`./fixtures/${name}.blend`, import.meta.url),
    "utf8",
  );
  return { source, artifacts: await buildProfileSource(source, PROFILE) };
}

/** Return the exact reachable library helper names, without inferring from source text. */
function libraryFunctions(artifacts: Awaited<ReturnType<typeof buildFixture>>["artifacts"]) {
  return profileRecords(artifacts.debug.functions)
    .map((fn) => String(fn.qualifiedName))
    .filter((name) => name.startsWith(LIBRARY))
    .map((name) => name.slice(LIBRARY.length));
}

/** Decode a normal function owner or the retained overlay owner spelling. */
function ownerNames(owner: Record<string, unknown>): string[] {
  const id = String(owner.id ?? "");
  if (!id.startsWith("overlay:")) return id.length === 0 ? [] : [id];
  const parsed: unknown = JSON.parse(id.slice("overlay:".length));
  return Array.isArray(parsed) && parsed.every((name) => typeof name === "string")
    ? parsed
    : [];
}

/** Resolve an owner against a debug function name without relying on array positions. */
function resolvesTo(name: string, functionName: string): boolean {
  return name === functionName || name.startsWith(`${functionName}::`);
}

/** Require every private interval to name an actual selected source function. */
function selectedHomeClosure(
  artifacts: Awaited<ReturnType<typeof buildFixture>>["artifacts"],
): void {
  const functionNames = profileRecords(artifacts.debug.functions).map((fn) =>
    String(fn.qualifiedName),
  );
  const intervals = profileRecords(artifacts.memory.intervals);
  expect(artifacts.memory.acmeReconciled).toBe(true);
  expect(String(artifacts.memory.sfaClosureSha256)).toMatch(/^[0-9a-f]{64}$/);

  let resolved = 0;
  for (const interval of intervals) {
    if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) continue;
    const start = Number(interval.start);
    const end = Number(interval.end);
    const size = Number(interval.size);
    expect(Number.isSafeInteger(start) && Number.isSafeInteger(end)).toBe(true);
    expect(end).toBeGreaterThan(start);
    expect(size).toBe(end - start);
    const owner = profileRecord(interval.owner);
    if (owner.kind !== "function") continue;
    const names = ownerNames(owner);
    expect(names.length, String(interval.id)).toBeGreaterThan(0);
    for (const name of names)
      expect(
        functionNames.some((functionName) => resolvesTo(name, functionName)),
        `${String(interval.id)} owner ${name}`,
      ).toBe(true);
    resolved += 1;
  }
  expect(resolved).toBeGreaterThan(0);

  for (const row of profileRecords(artifacts.memory.stackDomains)) {
    const peak = Number(row.peakBytes);
    const headroom = Number(row.headroomBytes);
    const capacity = Number(row.capacityBytes);
    expect(Number.isSafeInteger(peak) && peak >= 0).toBe(true);
    expect(peak + headroom).toBe(capacity);
  }
  const resources = profileRecords(artifacts.costs.totals.resources);
  expect(resources.map(({ id }) => String(id))).toEqual([
    "zeroPage",
    "residentRam",
    "hardwareStack",
    "scratch",
  ]);
  expect(resources.some(({ id, value }) => String(id) === "hardwareStack" && Number(value) >= 0)).toBe(
    true,
  );
}

describe("input library implementation closure", () => {
  it(
    "keeps the saved query private helpers reachable and the callback absent",
    async () => {
      const { artifacts } = await buildFixture("input-saved-caller");
      const functions = libraryFunctions(artifacts);

      expect(functions).toEqual(
        expect.arrayContaining([
          "joystickState",
          "keyState",
          "snapshotCompatible",
          "soleGroundSource",
        ]),
      );
      expect(functions).not.toContain("interruptScan");
      expect(functions).not.toContain("readInputSnapshot");
      selectedHomeClosure(artifacts);
    },
    120_000,
  );

  it(
    "keeps acquisition helpers and the callback-only route without private homes",
    async () => {
      const { artifacts } = await buildFixture("input-caller");
      const functions = libraryFunctions(artifacts);

      expect(functions).toEqual(
        expect.arrayContaining([
          "interruptScan",
          "readInputSnapshot",
          "snapshotCompatible",
          "soleGroundSource",
          "keyState",
          "joystickState",
        ]),
      );
      selectedHomeClosure(artifacts);

      const callbackName = `${LIBRARY}interruptScan`;
      const callbackHomes = profileRecords(artifacts.memory.intervals).filter((interval) => {
        if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) return false;
        const owner = profileRecord(interval.owner);
        return (
          owner.kind === "function" &&
          ownerNames(owner).some((name) => resolvesTo(name, callbackName))
        );
      });
      expect(callbackHomes).toEqual([]);
    },
    120_000,
  );
});
