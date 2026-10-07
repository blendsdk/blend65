import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { CIA2_PROFILES, cia2Lease, expectCia2Accepted } from "./cia2-fixture.js";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;
type Route = "nmi" | "irq";

/** A temporary storage-free interrupt writes while the copied mask is live. */
function temporaryInterruptSource(route: Route, address: string, snapshot = false): string {
  const expose =
    route === "nmi"
      ? "setNMI(&corrupt); restoreNMI();"
      : "asm_cli(); asm_nop(); asm_sei(); asm_nop();";
  const body = snapshot
    ? "apply(mask, temporarilyExpose());"
    : "temporarilyExpose(); disableInterruptSources(mask);";
  const main =
    route === "nmi"
      ? "disable($1F); enableInterruptSources($01);"
      : "asm_sei(); setIRQExclusive(&corrupt); disable($1F); enableInterruptSources($01); restoreIRQ();";
  const source = cia2Lease(
    main,
    "",
    `interrupt function corrupt(): void { poke(${address}, $01); }
    function temporarilyExpose(): byte { ${expose} return $00; }
    ${snapshot ? "function apply(copied: byte, ignored: byte): void { disableInterruptSources(copied); }" : ""}
    function disable(mask: byte): void { ${body} }`,
  );
  return route === "nmi"
    ? source
    : source.replace(
        "module Game;",
        "module Game;\nimport { setIRQExclusive, restoreIRQ } from c64.system;",
      );
}

/** Select the one-byte copied parameter from published function-owned memory evidence. */
function maskHome(artifacts: Artifacts): number {
  const qualifiedName = "src/game.blend::Game.disable";
  expect(
    profileRecords(artifacts.debug.functions).some((row) => row.qualifiedName === qualifiedName),
  ).toBe(true);
  expect(artifacts.memory.acmeReconciled).toBe(true);
  const homes = profileRecords(artifacts.memory.intervals).filter((interval) => {
    if (!["sfa", "zeroPage"].includes(String(interval.kind))) return false;
    const owner = profileRecord(interval.owner);
    return (
      owner.kind === "function" &&
      owner.id === qualifiedName &&
      typeof interval.id === "string" &&
      interval.id.includes(":parameter:")
    );
  });
  expect(homes).toHaveLength(1);
  const home = homes[0]!;
  expect(home.addressSpaceId).toBe("cpu16");
  expect(home.mutability).toBe("mutable");
  expect(home.size).toBe(1);
  expect(typeof home.start).toBe("number");
  const address = home.start as number;
  expect(Number.isInteger(address)).toBe(true);
  expect(address).toBeGreaterThanOrEqual(0);
  expect(address).toBeLessThan(65536);
  expect(home.end).toBe(address + 1);
  return address;
}

/** Prove the temporarily reachable interrupt and exposure helper have no private homes. */
function expectStorageFreeExposure(artifacts: Artifacts): void {
  const names = ["src/game.blend::Game.corrupt", "src/game.blend::Game.temporarilyExpose"];
  const functions = profileRecords(artifacts.debug.functions);
  for (const name of names)
    expect(functions.some(({ qualifiedName }) => qualifiedName === name)).toBe(true);
  const homes = profileRecords(artifacts.memory.intervals).filter((interval) => {
    if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) return false;
    if (String(interval.id).startsWith("interrupt-link:")) return false;
    const owner = profileRecord(interval.owner);
    const ids: unknown = String(owner.id).startsWith("overlay:")
      ? JSON.parse(String(owner.id).slice("overlay:".length))
      : [owner.id];
    if (!Array.isArray(ids)) throw new Error("Missing private-home owner associations");
    return ids.some((id) =>
      names.some((name) => id === name || String(id).startsWith(`${name}::`)),
    );
  });
  expect(homes).toEqual([]);
}

/** Replace only the raw operand, retaining its source width and absolute addressing class. */
function aliasSource(source: string, address: number): string {
  const operand = `$${address.toString(16).toUpperCase().padStart(4, "0")}`;
  expect(operand).toHaveLength(5);
  expect(address).toBeGreaterThan(255);
  expect(source.split("poke($0400, $01)")).toHaveLength(2);
  const changed = source.replace("poke($0400, $01)", `poke(${operand}, $01)`);
  expect(Buffer.byteLength(changed)).toBe(Buffer.byteLength(source));
  return changed;
}

describe.each(CIA2_PROFILES)("CIA2 physical-home effects on %s", (target) => {
  describe.each(["nmi", "irq"] as const)("temporary %s exposure", (route) => {
    it("accepts a disjoint raw write while a copied mask is live", async () => {
      const source = temporaryInterruptSource(route, "$0400");
      const artifacts = await buildProfileSource(source, target);
      expect(maskHome(artifacts)).not.toBe(0x0400);
      expectStorageFreeExposure(artifacts);
      await expectCia2Accepted(source, target);
    });

    it("rejects a disable mask corrupted through its exact published physical home", async () => {
      const reference = temporaryInterruptSource(route, "$0400");
      const artifacts = await buildProfileSource(reference, target);
      const address = maskHome(artifacts);
      expect(address).not.toBe(0x0400);
      expectStorageFreeExposure(artifacts);
      const source = aliasSource(reference, address);
      await withProfileProject(source, target, async (project, root) => {
        const checked = await checkProject({ project });
        const built = await buildProject({ project });
        // Unexpected acceptance must still prove the substituted address hit the same home.
        if (built.kind === "success") {
          const changed = await readProfileArtifacts(built);
          expect(maskHome(changed)).toBe(address);
          expectStorageFreeExposure(changed);
        }
        for (const result of [checked, built]) {
          expect(result.kind).toBe("failure");
          expect(
            result.diagnostics
              .filter(({ severity }) => severity === "error")
              .map(({ code }) => code),
          ).toEqual(["E10278"]);
        }
        await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
      });
    });

    it("preserves an already evaluated copied argument after its original home is corrupted", async () => {
      const reference = temporaryInterruptSource(route, "$0400", true);
      const artifacts = await buildProfileSource(reference, target);
      const address = maskHome(artifacts);
      expect(address).not.toBe(0x0400);
      expectStorageFreeExposure(artifacts);
      const source = aliasSource(reference, address);
      const changed = await buildProfileSource(source, target);
      expect(maskHome(changed)).toBe(address);
      expectStorageFreeExposure(changed);
      await expectCia2Accepted(source, target);
    });
  });
});
