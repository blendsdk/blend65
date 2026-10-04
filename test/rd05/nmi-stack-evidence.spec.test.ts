import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const externalEffectClass =
  "external-nmi-aggregate-stack+retained-nmi-firmware-completion+external-nmi-finite-deadline";
const boundedScope = "bounded-component:generated-program-and-irq";
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Hold every status save simultaneously before restoring the balanced entry state. */
function statusSaves(depth: number): string {
  return "asm_php();\n".repeat(depth) + "asm_plp();\n".repeat(depth);
}

/** Construct a mainline-only source with an independently known live stack depth. */
function mainSource(depth: number): string {
  return `module Game;\nfunction main(): void {\n${statusSaves(depth)}}`;
}

/** Keep external arrival and firmware guarantees unproved while retaining static reconciliation. */
function expectExternalUncertainty(source: string, artifacts: Artifacts): void {
  const memory = artifacts.memory;
  expect.soft(memory.schemaVersion).toBe(1);
  expect.soft(memory.acmeReconciled).toBe(true);
  expect.soft(memory.sfaClosureSha256).toMatch(/^[0-9a-f]{64}$/);
  expect.soft(memory.runtimeMemorySafety).toBe("unproven");
  const declaration = source.slice(source.indexOf("function main"), source.lastIndexOf("}") + 1);
  const span = profileSpan(source, declaration);
  const mainSite = { path: span.sourceId, startByte: span.start, endByte: span.end };
  const effects = profileRecords(memory.unboundedEffects);
  expect
    .soft(effects.filter((effect) => effect.effectClass === externalEffectClass))
    .toEqual([{ kind: "machineState", site: mainSite, effectClass: externalEffectClass }]);
  expect
    .soft(
      effects.filter((effect) => {
        const site = profileRecord(effect.site);
        return (
          effect.kind === "machineState" &&
          site.path === mainSite.path &&
          site.startByte === mainSite.startByte &&
          site.endByte === mainSite.endByte
        );
      }),
    )
    .toHaveLength(1);
  const keys = effects.map((effect): [string, number, number, string] => {
    const site = profileRecord(effect.site);
    expect.soft(typeof site.path).toBe("string");
    expect.soft(Number.isInteger(site.startByte)).toBe(true);
    expect.soft(Number.isInteger(site.endByte)).toBe(true);
    expect.soft(typeof effect.kind).toBe("string");
    return [String(site.path), Number(site.startByte), Number(site.endByte), String(effect.kind)];
  });
  expect.soft(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(keys.length);
  const sorted = [...keys].sort((left, right) => {
    if (left[0] !== right[0]) return left[0] < right[0] ? -1 : 1;
    return (
      left[1] - right[1] ||
      left[2] - right[2] ||
      (left[3] === right[3] ? 0 : left[3] < right[3] ? -1 : 1)
    );
  });
  expect.soft(keys).toEqual(sorted);
}

/** Check exact finite use against usable capacity without treating firmware reserve as executed use. */
function expectFiniteAccounting(artifacts: Artifacts, peak: number): void {
  const rows = profileRecords(artifacts.memory.stackDomains);
  expect.soft(rows.map((row) => row.id)).not.toContain("platform-reserve");
  expect.soft(rows.map((row) => row.id)).not.toContain("qualified-capacity");
  expect.soft(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  const combined = rows.filter((row) => row.id === "bounded-component-capacity");
  expect
    .soft(combined)
    .toEqual([
      expect.objectContaining({ capacityBytes: 236, peakBytes: peak, headroomBytes: 236 - peak }),
    ]);
  for (const row of rows) {
    expect.soft(Number.isInteger(row.capacityBytes)).toBe(true);
    expect.soft(Number.isInteger(row.peakBytes)).toBe(true);
    expect.soft(Number.isInteger(row.headroomBytes)).toBe(true);
    expect.soft(row.peakBytes).toBeGreaterThanOrEqual(0);
    expect.soft(row.headroomBytes).toBeGreaterThanOrEqual(0);
    expect.soft(row.capacityBytes).toBe(Number(row.peakBytes) + Number(row.headroomBytes));
    expect.soft(Array.isArray(row.route)).toBe(true);
    if (Array.isArray(row.route)) {
      expect.soft(row.route.length).toBeGreaterThan(0);
      for (const step of row.route) {
        expect.soft(typeof step).toBe("string");
        expect.soft(step).not.toBe("");
        expect.soft(step).not.toMatch(/reserve/i);
      }
      if (row.id === "bounded-component-capacity") {
        expect.soft(row.route[0]).toBe(boundedScope);
        expect.soft(row.route.length).toBeGreaterThan(1);
      }
    }
  }
  const maximum = Math.max(...rows.map((row) => Number(row.peakBytes)));
  expect.soft(maximum).toBe(peak);
  expect.soft(artifacts.costs.schemaVersion).toBe(1);
  expect.soft(artifacts.costs.mode).toBe("none");
  const resources = profileRecords(profileRecord(artifacts.costs.totals).resources);
  expect
    .soft(resources.filter((resource) => resource.id === "hardwareStack"))
    .toEqual([{ kind: "standard", id: "hardwareStack", value: maximum }]);
}

describe("cooperative external NMI and finite stack evidence", () => {
  it.each(profiles)(
    "should retain static reconciliation and report one external uncertainty record when %s has no hook",
    async (profile) => {
      const source = "module Game; function main(): void {}";
      await withProfileProject(source, profile, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const artifacts = await readProfileArtifacts(built);
        expect.soft(artifacts.memory.profileId).toBe(profile);
        expectExternalUncertainty(source, artifacts);
      });
    },
    60_000,
  );

  it.each(profiles)(
    "should count ten live status saves without counting reserved capacity when %s has no hook",
    async (profile) => {
      const source = mainSource(10);
      await withProfileProject(source, profile, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const artifacts = await readProfileArtifacts(built);
        expectFiniteAccounting(artifacts, 10);
        expectExternalUncertainty(source, artifacts);
      });
    },
    60_000,
  );

  it.each(profiles)(
    "should preserve the exact finite IRQ warning and 195-byte component when %s overlaps 188 saves",
    async (profile) => {
      // The IRQ holds three CPU bytes, three firmware saves and one wrapper status save.
      const source = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
interrupt function onIRQ(): void {}
function main(): void {
asm_sei(); asm_nop(); setIRQ(&onIRQ);
${"asm_php();\n".repeat(188)}asm_cli(); asm_nop();
${"asm_plp();\n".repeat(188)}restoreIRQ();
}`;
      await withProfileProject(source, profile, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        expect
          .soft(built.diagnostics.filter((diagnostic) => diagnostic.code === "W10180"))
          .toEqual([
            expect.objectContaining({
              code: "W10180",
              message: `Maximum simultaneous hardware-stack use is 195 bytes on '${profile}'; usable capacity is 236 (calls 0, interrupt entries 7, explicit pushes 188)`,
            }),
          ]);
        const artifacts = await readProfileArtifacts(built);
        expectFiniteAccounting(artifacts, 195);
        const rows = profileRecords(artifacts.memory.stackDomains);
        expect
          .soft(rows.filter((row) => row.id === "interrupt-entry-save"))
          .toEqual([expect.objectContaining({ peakBytes: 7 })]);
        expect.soft(rows.filter((row) => row.id === "program")).toHaveLength(1);
        expectExternalUncertainty(source, artifacts);
      });
    },
    60_000,
  );

  it.each(profiles)(
    "should accept the finite capacity boundary with zero headroom when %s holds 236 saves",
    async (profile) => {
      const source = mainSource(236);
      await withProfileProject(source, profile, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const artifacts = await readProfileArtifacts(built);
        expectFiniteAccounting(artifacts, 236);
        expectExternalUncertainty(source, artifacts);
      });
    },
    60_000,
  );

  it.each(profiles)(
    "should reject the finite component without publishing output when %s holds 237 saves",
    async (profile) => {
      await withProfileProject(mainSource(237), profile, async (project, root) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("failure");
        expect(built).not.toHaveProperty("generation");
        const errors = built.diagnostics.filter((diagnostic) => diagnostic.code === "E10238");
        expect(errors).toHaveLength(1);
        expect(errors[0]!.message).toMatch(
          new RegExp(
            `^Target resource budget exceeded for '[^']+' — used 237, available 236 on '${profile}'$`,
          ),
        );
        await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
      });
    },
    60_000,
  );
});
