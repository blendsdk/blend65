import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { buildProfileSource, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-takeover-6581",
  "c64-pal-prg-takeover-8580",
  "c64-ntsc-prg-takeover-6581",
  "c64-ntsc-prg-takeover-8580",
] as const;

const rawIrqSource = `module Game;
import { setRawIRQ, restoreRawIRQ } from c64.system;
interrupt function onIRQ(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
}
function main(): void {
  setRawIRQ(&onIRQ);
  restoreRawIRQ();
}`;

const target = "c64-pal-prg-takeover-6581";

/** Run the public build boundary so semantic and layout admission both participate. */
async function buildResult(source: string, profile = target) {
  return withProfileProject(source, profile, async (project) =>
    buildProject({ project, optimization: "none" }),
  );
}

describe("takeover negative admission", () => {
  it("rejects a raw IRQ handler that does not own CIA1", async () => {
    const result = await buildResult(
      `module Game;
import { setRawIRQ, restoreRawIRQ } from c64.system;
interrupt function onIRQ(): void { poke($d020, 1); }
function main(): void { setRawIRQ(&onIRQ); restoreRawIRQ(); }`,
    );
    expect(result.kind, JSON.stringify(result)).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected raw IRQ ownership rejection");
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10278");
  });

  it("rejects a conditional CIA1 consume that can return without acknowledging", async () => {
    const result = await buildResult(
      `module Game;
import { setRawIRQ, restoreRawIRQ } from c64.system;
interrupt function onIRQ(): void {
  if (peek($0420) != 0) { let pending: byte = c64.cia1.readAndClearPendingSources(); }
}
function main(): void { setRawIRQ(&onIRQ); restoreRawIRQ(); }`,
    );
    expect(result.kind, JSON.stringify(result)).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected conditional consume rejection");
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10278");
  });

  it.each([
    ["processor port", "poke($0001, 5);"],
    ["raw IRQ vector", "pokew($fffe, 0);"],
    ["raw NMI vector", "pokew($fffa, 0);"],
    ["CIA2 VIC bank", "poke($dd02, 0);"],
  ])("rejects a source write to the takeover-owned %s", async (_name, write) => {
    const result = await buildResult(`module Game; function main(): void { ${write} }`);
    expect(result.kind, JSON.stringify(result)).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected takeover-owned write rejection");
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10278");
  });

  it("rejects the deferred raw NMI installer as an unknown name", async () => {
    const result = await buildResult(
      `module Game;
import { setRawNMI } from c64.system;
interrupt function onNMI(): void { poke($d020, 1); }
function main(): void { setRawNMI(&onNMI); }`,
    );
    expect(result.kind, JSON.stringify(result)).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected unknown raw NMI rejection");
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10012");
  });

  it("allows a takeover placement in the $A000-$BFFF RAM view", async () => {
    const artifacts = await buildProfileSource(
      "module Game; place(at: $a000) const DATA: byte[3] = [1, 2, 3]; function main(): void {}",
      target,
    );
    expect([...artifacts.prg.subarray(2 + 0xa000 - 0x0801, 2 + 0xa003 - 0x0801)]).toEqual([
      1, 2, 3,
    ]);
  });
});

describe.each(profiles)("takeover build smoke for %s", (target) => {
  it("builds the empty program through the raw constructor", async () => {
    const artifacts = await buildProfileSource("module Game; function main(): void {}", target);
    expect([...artifacts.prg.subarray(0, 14)]).toEqual([
      1, 8, 0x0b, 8, 10, 0, 0x9e, 0x32, 0x30, 0x36, 0x31, 0, 0, 0,
    ]);
    expect(artifacts.labels).toMatch(
      new RegExp(`_${Buffer.from("startup.entry").toString("hex")}\\s*=\\s*\\$0*80d`, "iu"),
    );
    expect(artifacts.assembly).toMatch(/\bcli\b/u);
    expect(artifacts.assembly).toMatch(/\bsta \$fffe\b/u);
    expect(artifacts.assembly).toMatch(/\bsta\+1 \$01\b/u);
    console.info("Takeover smoke", target, artifacts.costs.totals, artifacts.prg.length);
  }, 60_000);

  it("keeps a high fixed function inside the resident range", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
place(at: $C000) function high(): void { poke($0427, 1); }
function main(): void { high(); }`,
      target,
    );
    const labels = artifacts.labels;
    expect(labels).toMatch(/\$c000/iu);
  }, 60_000);

  it("keeps a high fixed object outside the BASIC window", async () => {
    const artifacts = await buildProfileSource(
      "module Game; place(at: $C000) const DATA: byte[3] = [1, 2, 3]; function main(): void {}",
      target,
    );
    expect([...artifacts.prg.subarray(2 + 0xc000 - 0x0801, 2 + 0xc003 - 0x0801)]).toEqual([
      1, 2, 3,
    ]);
    expect(Number(artifacts.costs.totals.programBytes)).toBe(artifacts.prg.length - 2);
  }, 60_000);

  it.each(["none", "balanced", "speed", "size"] as const)(
    "keeps both default entries under %s optimization",
    async (optimization) => {
      const artifacts = await buildProfileSource(
        "module Game; function main(): void {}",
        target,
        optimization,
      );
      for (const name of ["startup.rawIrqDefault", "startup.rawNmiDefault"]) {
        const encoded = Buffer.from(name).toString("hex");
        expect(artifacts.labels, name).toContain(encoded);
      }
      expect(artifacts.assembly).toMatch(/\bsta \$fffe\b/u);
      expect(artifacts.assembly).toMatch(/\bsta \$fffa\b/u);
    },
    60_000,
  );

  it("builds nested raw IRQ installs and LIFO restores", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
import { setRawIRQ, restoreRawIRQ } from c64.system;
interrupt function first(): void { let p: byte = c64.cia1.readAndClearPendingSources(); }
interrupt function second(): void { let p: byte = c64.cia1.readAndClearPendingSources(); }
function main(): void {
  setRawIRQ(&first);
  setRawIRQ(&second);
  restoreRawIRQ();
  restoreRawIRQ();
}`,
      target,
    );
    expect(artifacts.assembly.match(/sta \$fffe/gu)?.length).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("builds a matched raw IRQ install and restore", async () => {
    const artifacts = await buildProfileSource(rawIrqSource, target);
    expect(artifacts.assembly).toMatch(/\bsta \$fffe\b/u);
    expect(artifacts.assembly).toMatch(/\blda \$dc0d\b/u);
    expect(artifacts.assembly).toMatch(/\brti\b/u);
    const resources = artifacts.costs.totals.resources as {
      readonly id: string;
      readonly value: number;
    }[];
    expect(resources.find(({ id }) => id === "hardwareStack")?.value).toBeGreaterThanOrEqual(10);
  }, 60_000);
});
