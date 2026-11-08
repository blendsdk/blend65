import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import type { ProjectSnapshot } from "@blend65/compiler/frontend";
import { withProject, type ProjectAsset } from "./project-fixture.js";

const MAIN = "\nfunction main(): void {}\n";
const fixtureRoot = join(process.cwd(), "test/rd06/fixtures/public/psid");

/** Read one committed PSID fixture as project asset bytes. */
function psid(name: string): ProjectAsset {
  return { path: "music.sid", bytes: readFileSync(join(fixtureRoot, `${name}.sid`)) };
}

/** Copy one fixture and apply one header mutation. */
function patchedPsid(name: string, patch: (bytes: Buffer) => void): ProjectAsset {
  const bytes = Buffer.from(readFileSync(join(fixtureRoot, `${name}.sid`)));
  patch(bytes);
  return { path: "music.sid", bytes };
}

/** Load one real project and return its immutable snapshot. */
async function snapshot(project: string): Promise<ProjectSnapshot> {
  const loaded = await loadProject({ project });
  if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
  return loaded.snapshot;
}

/** Check one source with one asset and return only its diagnostics. */
async function diagnostics(
  source: string,
  assets: readonly ProjectAsset[],
): Promise<readonly { readonly code: string; readonly message: string }[]> {
  return withProject(source, assets, async (project) => {
    const checked = await checkProject({ project });
    return checked.diagnostics;
  });
}

describe("PSID frontend integration", () => {
  // The default selector is an ordinary resident array with the handler's fixed address.
  it("should embed PSID data at its declared load address", async () => {
    const source = `module Game;\n\nconst MUSIC: byte[] = embed("music.sid");\n${MAIN}`;
    await withProject(source, [psid("psid-v1-fixed")], async (project) => {
      const analyzed = await analyzeProjectOverlay(await snapshot(project), []);
      expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
      if (analyzed.kind !== "complete") throw new Error("Expected complete analysis");
      const asset = analyzed.program.assets[0]!;
      expect(asset.kind).toBe("resident-asset");
      if (asset.kind !== "resident-asset") throw new Error("Expected resident PSID data");
      expect(asset.handler).toMatchObject({
        handlerKey: "psid",
        handlerVersion: "1-4",
        selector: "data",
        representation: "psid-data",
      });
      expect(asset.bytes).toHaveLength(8);
      expect(asset.placement).toMatchObject({ at: 0xc000 });
      expect(asset.constraints).toEqual([
        { kind: "at", origin: "handler", addressSpaceId: "cpu16", start: 0xc000 },
      ]);
    });
  });

  // A scalar selector owns no resident bytes and is usable as an ordinary word constant.
  it("should expose a scalar PSID address with no resident object", async () => {
    const source = `module Game;\n\nconst INIT: word = embed("music.sid", "init_address");\n${MAIN}`;
    await withProject(source, [psid("psid-v1-fixed")], async (project) => {
      const analyzed = await analyzeProjectOverlay(await snapshot(project), []);
      expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
      if (analyzed.kind !== "complete") throw new Error("Expected complete analysis");
      const asset = analyzed.program.assets[0]!;
      expect(asset.kind).toBe("scalar-asset");
      if (asset.kind !== "scalar-asset") throw new Error("Expected scalar PSID address");
      expect(asset.scalarType).toEqual({ kind: "scalar", name: "word" });
      expect(asset.scalarValue).toBe(0xc000n);
    });
  });

  // A scalar selector can size a fixed array through early constant evaluation.
  it("should use a PSID scalar in a fixed array extent", async () => {
    const source = `module Game;\n\nconst COUNT: word = embed("music.sid", "init_address");\nlet buffer: byte[COUNT];\n${MAIN}`;
    const asset = patchedPsid("psid-v1-fixed", (bytes) => {
      bytes.writeUInt16BE(0x3000, 0x08);
      bytes.writeUInt16BE(0x3000, 0x0a);
      bytes.writeUInt16BE(0x3003, 0x0c);
    });
    await withProject(source, [asset], async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    });
  });

  // A scalar selector in a byte declaration is an exact-type error, not a narrowing.
  it("should reject a word selector declared as byte", async () => {
    const source = `module Game;\n\nconst BAD: byte = embed("music.sid", "init_address");\n${MAIN}`;
    const result = await diagnostics(source, [psid("psid-v1-fixed")]);
    expect(result.map(({ code }) => code)).toContain("E10144");
  });

  // Resident data cannot initialize a scalar declaration.
  it("should reject resident PSID data where a scalar is required", async () => {
    const source = `module Game;\n\nconst BAD: byte = embed("music.sid");\n${MAIN}`;
    const result = await diagnostics(source, [psid("psid-v1-fixed")]);
    expect(result.map(({ code }) => code)).toContain("E10142");
  });

  // Embedded data in an operator expression reports E10142, not a generic array error.
  it("should reject embedded PSID data in an operator expression", async () => {
    const source = `module Game;\n\nconst BAD: byte = embed("music.sid") + 1;\n${MAIN}`;
    const result = await diagnostics(source, [psid("psid-v1-fixed")]);
    expect(result.map(({ code }) => code)).toContain("E10142");
  });

  // The fixed load participates in the ordinary placement intersection.
  it("should reject a source address that contradicts the PSID load address", async () => {
    const source = `module Game;\n\nplace(at: $C100) const MUSIC: byte[] = embed("music.sid");\n${MAIN}`;
    const result = await diagnostics(source, [psid("psid-v1-fixed")]);
    const conflict = result.find(({ code }) => code === "E10273");
    expect(conflict).toBeDefined();
    expect(conflict?.message).toContain("$c000");
    expect(conflict?.message).not.toMatch(/null-byte/iu);
  });

  // A fixed load outside the resident window fails with the handler address, not a source clause.
  it("should reject a PSID load outside the resident window", async () => {
    const source = `module Game;\n\nconst MUSIC: byte[] = embed("music.sid");\n${MAIN}`;
    const asset = patchedPsid("psid-v1-fixed", (bytes) => {
      bytes.writeUInt16BE(0xe000, 0x08);
      bytes.writeUInt16BE(0xe000, 0x0a);
      bytes.writeUInt16BE(0xe003, 0x0c);
    });
    await withProject(source, [asset], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind).toBe("failure");
      const conflict = built.diagnostics.find(({ code }) => code === "E10273");
      expect(conflict).toBeDefined();
      expect(conflict?.message).toContain("$e000");
      expect(conflict?.message).not.toMatch(/explicit/iu);
    });
  });

  // A matching source address strengthens nothing and remains legal.
  it("should accept a source address equal to the PSID load address", async () => {
    const source = `module Game;\n\nplace(at: $C000) const MUSIC: byte[] = embed("music.sid");\n${MAIN}`;
    await withProject(source, [psid("psid-v1-fixed")], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected a successful build");
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as {
        assets: { handler: string; selector: string; placement: { range: { start: number } } }[];
      };
      expect(assets.assets[0]).toMatchObject({
        handler: "psid",
        selector: "data",
        placement: { kind: "single", range: { start: 0xc000 } },
      });
    });
  });

  // Every callable-audio operation requires an exact contract; none is registered.
  it("should reject a callable audio operation on a plain PSID", async () => {
    const operations = [
      ["audioInitDefault", "&MUSIC"],
      ["audioInit", "&MUSIC, 0"],
      ["audioInitNamed", "&MUSIC, 0"],
      ["audioTick", "&MUSIC"],
      ["audioTriggerSfx", "&MUSIC, 0"],
      ["audioTriggerSfxOn", "&MUSIC, 0, 0"],
    ] as const;
    for (const [operation, arguments_] of operations) {
      const source = `module Game;\nimport { ${operation} } from c64.audio;\nconst MUSIC: byte[] = embed("music.sid");\nfunction main(): void { ${operation}(${arguments_}); }\n`;
      const result = await diagnostics(source, [psid("psid-v1-fixed")]);
      const audio = result.filter(({ code }) => code === "E10256");
      expect(audio, operation).toHaveLength(1);
      expect(audio[0]?.message).toMatch(/contract/iu);
    }
  });

  // A profile operation has no address and cannot escape the audio gate.
  it("should reject address-of a profile audio operation", async () => {
    const source = `module Game;\nimport { audioTick } from c64.audio;\nconst MUSIC: byte[] = embed("music.sid");\nfunction main(): void { let pointer: word = &audioTick; }\n`;
    const result = await diagnostics(source, [psid("psid-v1-fixed")]);
    expect(result.map(({ code }) => code)).toContain("E10043");
  });

  // A compile-time function can read the selected scalar value.
  it("should read a PSID scalar in a compile-time function", async () => {
    const source = `module Game;\n\nconst INIT: word = embed("music.sid", "init_address");\ncomptime function get(): word { return INIT; }\nconst VALUE: word = get();\n${MAIN}`;
    await withProject(source, [psid("psid-v1-fixed")], async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    });
  });
});
