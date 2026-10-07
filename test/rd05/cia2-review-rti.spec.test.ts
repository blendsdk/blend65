import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { CIA2_PROFILES, expectCia2Accepted } from "./cia2-fixture.js";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;
type MaskUse = "live" | "masked" | "snapshot" | "repeated";

/** A quiet NMI may return between IRQ unmasking and the next copied-mask read. */
function returnBoundarySource(use: MaskUse): string {
  const clear =
    use === "masked"
      ? "asm_sei(); disableInterruptSources(mask); asm_sei();"
      : use === "snapshot"
        ? "apply(mask, expose());"
        : "asm_cli(); disableInterruptSources(mask); asm_sei();";
  const calls = use === "repeated" ? "clear($1F); clear($1F); clear($1F);" : "clear($1F);";
  return `module Game;
import { setNMIExclusive, restoreNMI, setIRQExclusive, restoreIRQ } from c64.system;
import { enableInterruptSources, disableInterruptSources } from c64.cia2;
interrupt function quiet(): void {}
interrupt function corrupt(): void { poke($0400, $01); peek($DC0D); }
${
  use === "snapshot"
    ? `function expose(): byte { asm_cli(); asm_nop(); asm_sei(); asm_nop(); return $00; }
function apply(copied: byte, ignored: byte): void { disableInterruptSources(copied); }`
    : ""
}
function clear(mask: byte): void { ${clear} }
function main(): void {
  asm_sei();
  setNMIExclusive(&quiet);
  setIRQExclusive(&corrupt);
  ${calls}
  enableInterruptSources($01);
  restoreIRQ();
  restoreNMI();
}`;
}

/** Discover the actual copied byte from reconciled, function-owned public memory evidence. */
function copiedMaskHome(artifacts: Artifacts): number {
  const name = "src/game.blend::Game.clear";
  expect(profileRecords(artifacts.debug.functions).some((row) => row.qualifiedName === name)).toBe(
    true,
  );
  expect(artifacts.memory.acmeReconciled).toBe(true);
  const homes = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return (
      ["sfa", "zeroPage"].includes(String(interval.kind)) &&
      owner.kind === "function" &&
      owner.id === name &&
      String(interval.id).includes(":parameter:")
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
  expect(address).not.toBe(0x0400);
  return address;
}

/** Returning handlers qualify without any invocation-private RAM or zero-page homes. */
function expectPrivateHomeFreeHandlers(artifacts: Artifacts): void {
  const names = ["src/game.blend::Game.quiet", "src/game.blend::Game.corrupt"];
  const functions = profileRecords(artifacts.debug.functions);
  for (const name of names) expect(functions.some((row) => row.qualifiedName === name)).toBe(true);
  const homes = profileRecords(artifacts.memory.intervals).filter((interval) => {
    if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) return false;
    if (String(interval.id).startsWith("interrupt-link:")) return false;
    const owner = profileRecord(interval.owner);
    const owners: unknown = String(owner.id).startsWith("overlay:")
      ? JSON.parse(String(owner.id).slice("overlay:".length))
      : [owner.id];
    if (!Array.isArray(owners)) throw new Error("Missing private-home owner associations");
    return owners.some((id) =>
      names.some((name) => id === name || String(id).startsWith(`${name}::`)),
    );
  });
  expect(homes).toEqual([]);
}

/** Change just one fixed-width raw operand to the published copied-mask home. */
function aliasCopiedMask(source: string, address: number): string {
  const operand = `$${address.toString(16).toUpperCase().padStart(4, "0")}`;
  expect(operand).toHaveLength(5);
  expect(source.split("poke($0400, $01)")).toHaveLength(2);
  const changed = source.replace("poke($0400, $01)", `poke(${operand}, $01)`);
  expect(Buffer.byteLength(changed)).toBe(Buffer.byteLength(source));
  return changed;
}

/** Derive an exact raw alias without assuming an allocation address. */
async function sourceWithPublishedAlias(use: MaskUse, target: string) {
  const reference = returnBoundarySource(use);
  const artifacts = await buildProfileSource(reference, target);
  expectPrivateHomeFreeHandlers(artifacts);
  const address = copiedMaskHome(artifacts);
  return { source: aliasCopiedMask(reference, address), address };
}

describe.each(CIA2_PROFILES)("CIA2 quiet NMI return boundaries on %s", (target) => {
  it("accepts an acknowledged IRQ write disjoint from the live copied mask", async () => {
    const source = returnBoundarySource("live");
    const artifacts = await buildProfileSource(source, target);
    copiedMaskHome(artifacts);
    expectPrivateHomeFreeHandlers(artifacts);
    await expectCia2Accepted(source, target);
  });

  it("rejects a live mask corrupted by IRQ after a quiet NMI restores I clear", async () => {
    const { source, address } = await sourceWithPublishedAlias("live", target);
    await withProfileProject(source, target, async (project, root) => {
      const checked = await checkProject({ project });
      const built = await buildProject({ project });
      // Unexpected success must still prove that the raw write hits the copied byte.
      if (built.kind === "success") {
        const artifacts = await readProfileArtifacts(built);
        expect(copiedMaskHome(artifacts)).toBe(address);
        expectPrivateHomeFreeHandlers(artifacts);
      }
      for (const result of [checked, built]) {
        expect(result.kind).toBe("failure");
        expect(
          result.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
        ).toEqual(["E10278"]);
      }
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  it("accepts the exact raw alias when a quiet NMI restores I set", async () => {
    const { source, address } = await sourceWithPublishedAlias("masked", target);
    const artifacts = await buildProfileSource(source, target);
    expect(copiedMaskHome(artifacts)).toBe(address);
    expectPrivateHomeFreeHandlers(artifacts);
    await expectCia2Accepted(source, target);
  });

  it("preserves a scalar evaluated before a later argument exposes the corrupting IRQ", async () => {
    const { source, address } = await sourceWithPublishedAlias("snapshot", target);
    const artifacts = await buildProfileSource(source, target);
    expect(copiedMaskHome(artifacts)).toBe(address);
    expectPrivateHomeFreeHandlers(artifacts);
    await expectCia2Accepted(source, target);
  });

  it("accepts repeated disable calls with arbitrarily returning private-home-free quiet NMIs", async () => {
    const source = returnBoundarySource("repeated");
    const artifacts = await buildProfileSource(source, target);
    copiedMaskHome(artifacts);
    expectPrivateHomeFreeHandlers(artifacts);
    await expectCia2Accepted(source, target);
  });
});
