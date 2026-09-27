import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject, parseManifest } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const emptySource = "module Game; function main(): void {}";

/** Hash complete bytes independently of the compiler's sidecar claims. */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Public version-one records must retain exactly their declared top-level keys. */
function expectClosedKeys(value: Record<string, unknown>, keys: readonly string[]) {
  expect(Object.keys(value).sort()).toEqual([...keys].sort());
}

/** Validate selected identities and unchanged closed record shapes without internal validators. */
function expectEvidence(
  artifacts: Awaited<ReturnType<typeof readProfileArtifacts>>,
  target: string,
) {
  const { build, memory, costs, debug } = artifacts;
  for (const record of [build, memory, costs, debug]) expect(record.schemaVersion).toBe(1);
  expectClosedKeys(build, [
    "kind",
    "schemaVersion",
    "generationId",
    "semanticInputs",
    "portableTools",
    "hostProvenance",
    "package",
    "artifacts",
  ]);
  expectClosedKeys(memory, [
    "kind",
    "schemaVersion",
    "profileId",
    "sfaClosureSha256",
    "acmeReconciled",
    "runtimeMemorySafety",
    "residencies",
    "unboundedEffects",
    "intervals",
    "views",
    "stackDomains",
  ]);
  expectClosedKeys(costs, ["kind", "schemaVersion", "mode", "totals", "entries", "decisions"]);
  expectClosedKeys(debug, [
    "kind",
    "schemaVersion",
    "compiler",
    "specification",
    "expertSkill",
    "profileId",
    "cpuId",
    "optimization",
    "safety",
    "primaryArtifact",
    "tools",
    "sources",
    "assets",
    "addressSpaces",
    "functions",
    "contexts",
    "symbols",
    "locations",
    "ranges",
    "optimizations",
    "loadUnits",
  ]);
  const inputs = profileRecord(build.semanticInputs);
  expectClosedKeys(inputs, [
    "projectName",
    "sourceRoot",
    "entryModule",
    "assetSearchPaths",
    "manifest",
    "sources",
    "assets",
    "compiler",
    "specification",
    "expertSkill",
    "target",
    "options",
    "overrides",
  ]);
  expect(inputs.target).toEqual({
    profileId: target,
    cpuId: "nmos6510",
    emitterId: "acme-0.97",
    packagerId: "cbm-prg",
  });
  expect(memory).toMatchObject({ kind: "blend65.memory", profileId: target, acmeReconciled: true });
  expect(debug).toMatchObject({
    kind: "blend65.debug",
    profileId: target,
    cpuId: "nmos6510",
    optimization: "none",
  });
  expect(costs).toMatchObject({ kind: "blend65.costs", mode: "none", decisions: [] });
  expect(build.kind).toBe("blend65.build");
}

/** Normalize only assembler symbol spelling, leaving every opcode and literal operand intact. */
function executableLines(assembly: string): string[] {
  return assembly.split(/\r?\n/u).flatMap((line) => {
    const match = /^\s*([a-z]{3})\b\s*(.*?)\s*$/iu.exec(line.split(";")[0]!);
    return match
      ? [
          `${match[1]!.toLowerCase()} ${match[2]!.replace(/b65_[A-Za-z0-9_]+/gu, "LABEL").toLowerCase()}`.trim(),
        ]
      : [];
  });
}

describe("fresh cooperative profile generations", () => {
  // Declarative recognition remains broader than executable admission.
  it("should retain the same nine manifest profile identities", () => {
    const inventory = [
      ...profiles,
      "c64-pal-prg-takeover-6581",
      "c64-pal-prg-takeover-8580",
      "c64-ntsc-prg-takeover-6581",
      "c64-ntsc-prg-takeover-8580",
      "c64-pal-d64-kernal-6581",
    ];
    for (const target of inventory) {
      expect(
        parseManifest(
          JSON.stringify({
            schemaVersion: 1,
            name: "profile-build",
            sourceRoot: "src",
            entry: "Game",
            target,
            outDir: "out",
          }),
        ).kind,
      ).toBe("success");
    }
    for (const target of [
      "c64-pal",
      "c64-pal-d64-kernal-8580",
      "c64-ntsc-d64-kernal-6581",
      "C64-PAL-PRG-KERNAL-6581",
    ])
      expect(
        parseManifest(
          JSON.stringify({
            schemaVersion: 1,
            name: "profile-build",
            sourceRoot: "src",
            entry: "Game",
            target,
            outDir: "out",
          }),
        ).kind,
      ).toBe("failure");
  });

  // Every invocation reselects facts from its own inputs, including a temporary target override.
  it("should rebuild PAL then NTSC then PAL with exact fresh identities and repeatable artifacts", async () => {
    await withProfileProject(
      "module Game; function main(): void { poke($0420, c64.profile.cyclesPerLine); }",
      profiles[0],
      async (project) => {
        const runs = [];
        for (const target of [profiles[0], profiles[3], profiles[0]]) {
          const checked = await checkProject({ project, target });
          expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
          if (checked.kind !== "success") throw new Error("Expected a complete profile check");
          expect(checked.profileId).toBe(target);
          const built = await buildProject({ project, target });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected a complete profile build");
          const artifacts = await readProfileArtifacts(built);
          expectEvidence(artifacts, target);
          expect(artifacts.build.generationId).toBe(built.generation.generationId);
          expect(sha256(await readFile(join(built.generation.directory, ".build.json")))).toBe(
            built.generation.buildJsonSha256,
          );
          for (const digest of profileRecords(artifacts.build.artifacts)) {
            if (typeof digest.path !== "string") throw new Error("Missing artifact path");
            const bytes = await readFile(join(built.generation.directory, digest.path));
            expect(digest).toMatchObject({ bytes: bytes.length, sha256: sha256(bytes) });
          }
          runs.push({ snapshot: checked.snapshotSha256, artifacts });
        }
        expect(new Set(runs.map(({ artifacts }) => artifacts.build.generationId)).size).toBe(3);
        expect(runs[0]!.snapshot).not.toBe(runs[1]!.snapshot);
        expect(runs[0]!.snapshot).toBe(runs[2]!.snapshot);
        expect(runs[0]!.artifacts.prg).toEqual(runs[2]!.artifacts.prg);
        expect(runs[0]!.artifacts.build.artifacts).toEqual(runs[2]!.artifacts.build.artifacts);
        const unchanged = profileRecord(JSON.parse(await readFile(project, "utf8")));
        expect(unchanged.target).toBe(profiles[0]);
        const checked = await checkProject({ project });
        expect(checked).toMatchObject({ kind: "success", profileId: profiles[0] });
      },
    );
  }, 60_000);
});

describe.each(profiles)("real terminal admission on %s", (target) => {
  // Complete startup overhead is compared separately from any profile-selected source body.
  it("should preserve cooperative startup and return with no profile or SID setup cost", async () => {
    const actual = await buildProfileSource(emptySource, target);
    const baseline = await buildProfileSource(emptySource, profiles[0]);
    expectEvidence(actual, target);
    expect([...actual.prg.subarray(0, 14)]).toEqual([
      1, 8, 0x0b, 8, 10, 0, 0x9e, 0x32, 0x30, 0x36, 0x31, 0, 0, 0,
    ]);
    expect(actual.labels).toMatch(
      new RegExp(`_${Buffer.from("startup.entry").toString("hex")}\\s*=\\s*\\$0*80d`, "iu"),
    );
    const code = executableLines(actual.assembly);
    for (const opcode of ["php", "cld", "plp", "rts"]) expect(code).toContain(opcode);
    expect(code).not.toContain("sei");
    expect(code).not.toContain("cli");
    for (const address of [0x0000, 0x0001, 0xdd00, 0xd018, 0xd015]) {
      const operand = `(?:\\+[12] )?\\$0*${address.toString(16)}`;
      expect(
        code.some((line) => new RegExp(`^lda ${operand}$`, "u").test(line)),
        `read ${address.toString(16)}`,
      ).toBe(true);
      expect(
        code.some((line) => new RegExp(`^sta ${operand}$`, "u").test(line)),
        `write ${address.toString(16)}`,
      ).toBe(true);
    }
    expect(code.some((line) => /\$d4[0-1][0-9a-f]/u.test(line))).toBe(false);
    expect(code).toEqual(executableLines(baseline.assembly));
    expect(actual.prg).toEqual(baseline.prg);
    expect(actual.costs.totals).toEqual(baseline.costs.totals);
    console.info(
      "Complete empty-program startup and return cost",
      target,
      JSON.stringify(actual.costs.totals),
    );
  }, 60_000);

  // The loader places initialized bytes at their final address; startup must never copy them again.
  it("should load initialized fixed data once inside the common resident layout", async () => {
    const initialized = await buildProfileSource(
      "module Game; place(at: $3000) const DATA: byte[3] = [13, 29, 47]; function main(): void {}",
      target,
    );
    const empty = await buildProfileSource(emptySource, target);
    expectEvidence(initialized, target);
    expect([...initialized.prg.subarray(2 + 0x3000 - 0x0801, 2 + 0x3003 - 0x0801)]).toEqual([
      13, 29, 47,
    ]);
    expect(initialized.prg.length - 2).toBeLessThanOrEqual(51199);
    expect(executableLines(initialized.assembly)).toEqual(executableLines(empty.assembly));
    const intervals = profileRecords(initialized.memory.intervals);
    expect(intervals.some(({ start, end }) => start === 0x3000 && end === 0x3003)).toBe(true);
    for (const interval of intervals) {
      expect(typeof interval.start).toBe("number");
      expect(typeof interval.end).toBe("number");
      if (Number(interval.start) >= 0x0801)
        expect(Number(interval.end)).toBeLessThanOrEqual(0xd000);
    }
    expect(initialized.memory.stackDomains).toEqual(empty.memory.stackDomains);
    expect(profileRecord(initialized.costs.totals).pathCycles).toEqual(
      profileRecord(empty.costs.totals).pathCycles,
    );
  }, 60_000);
});
