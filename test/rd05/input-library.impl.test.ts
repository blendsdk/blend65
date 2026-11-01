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

/** Require every private interval to name an actual selected source function. */
function selectedHomeClosure(
  artifacts: Awaited<ReturnType<typeof buildFixture>>["artifacts"],
): void {
  const functions = profileRecords(artifacts.debug.functions);
  const intervals = profileRecords(artifacts.memory.intervals);
  expect(artifacts.memory.acmeReconciled).toBe(true);
  expect(String(artifacts.memory.sfaClosureSha256)).toMatch(/^[0-9a-f]{64}$/);

  for (const interval of intervals) {
    if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) continue;
    const start = Number(interval.start);
    const end = Number(interval.end);
    const size = Number(interval.size);
    expect(Number.isSafeInteger(start) && Number.isSafeInteger(end)).toBe(true);
    expect(end).toBeGreaterThan(start);
    expect(size).toBe(end - start);
    const owner = profileRecord(interval.owner);
    if (owner.kind !== "function" || owner.functionIndex === undefined) continue;
    const functionIndex = Number(owner.functionIndex);
    expect(functions[functionIndex], String(interval.id)).toBeDefined();
    expect(
      profileRecords(artifacts.debug.ranges).some((range) => {
        const rangeOwner = profileRecord(range.owner);
        return rangeOwner.kind === "function" && Number(rangeOwner.functionIndex) === functionIndex;
      }),
    ).toBe(true);
  }
}

describe("input library implementation closure", () => {
  it("keeps the saved query private helpers reachable and the callback absent", async () => {
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
  });

  it("keeps acquisition helpers and the callback-only route without private homes", async () => {
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

    const callbackIndex = profileRecords(artifacts.debug.functions).findIndex(
      (fn) => fn.qualifiedName === `${LIBRARY}interruptScan`,
    );
    expect(callbackIndex).toBeGreaterThanOrEqual(0);
    const callbackHomes = profileRecords(artifacts.memory.intervals).filter((interval) => {
      if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) return false;
      const owner = profileRecord(interval.owner);
      return owner.kind === "function" && Number(owner.functionIndex) === callbackIndex;
    });
    expect(callbackHomes).toEqual([]);
  });
});
