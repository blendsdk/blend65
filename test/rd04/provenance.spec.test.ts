import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Build a small source program through the public compiler entry point. */
async function buildSource(text: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-place-provenance-"));
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "blend65.json"),
    JSON.stringify({
      schemaVersion: 1,
      name: "place-provenance",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      outDir: "out",
      optimization: "none",
    }),
  );
  await writeFile(join(root, "src/game.blend"), text);
  return {
    root,
    result: await buildProject({ project: join(root, "blend65.json"), optimization: "none" }),
  };
}

describe("closed source placement", () => {
  // A fixed address materializes the scalar in the resident image at that exact byte.
  it("should honor compatible at, align and noCross constraints", async () => {
    const { root, result } = await buildSource(
      "module Game; place(at: $2000, align: 256, noCross: 4096) const MARK: byte = $A5; function main(): void { poke($0400, MARK); }",
    );
    try {
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") throw new Error("Expected a placed resident constant");
      const image = await readFile(
        join(result.generation.directory, result.generation.primaryArtifact),
      );
      expect(image.readUInt16LE(0)).toBe(0x0801);
      expect(image[2 + 0x2000 - 0x0801]).toBe(0xa5);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  // Explicit addresses still obey alignment, complete-object windows and reserved hardware ranges.
  it.each([
    ["alignment", "place(at: $2001, align: 256) const DATA: byte = 1;"],
    ["crossing window", "place(at: $20FF, noCross: 256) const DATA: byte[2] = [1, 2];"],
    ["reserved I/O", "place(at: $D020) let data: byte;"],
  ])("should report a placement conflict with %s", async (_case, declaration) => {
    const { root, result } = await buildSource(
      `module Game; ${declaration} function main(): void {}`,
    );
    try {
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected a placement conflict");
      expect(result.diagnostics.map(({ code }) => code)).toContain("E10273");
    } finally {
      await rm(root, { recursive: true });
    }
  });
});

describe("borrowed local addresses", () => {
  // A callee that only reads through an address may use it before the local dies.
  it("should permit a local address passed to a proven non-retaining call", async () => {
    const { root, result } = await buildSource(
      "module Game; function inspect(address: word): byte { return peek(address); } function main(): void { let value: byte = 7; poke($0400, inspect(&value)); }",
    );
    try {
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
    } finally {
      await rm(root, { recursive: true });
    }
  });

  // Integer-looking derivations cannot hide the local lifetime from the first escape.
  it.each([
    ["copy", "let address: word = &value; return address;", "word"],
    ["cast", "return word(&value);", "word"],
    ["selection", "return choose ? &value : 0;", "word"],
    ["low-byte extraction", "return lo(&value);", "byte"],
    ["high-byte extraction", "return hi(&value);", "byte"],
  ])(
    "should reject escape through %s at the first retaining use",
    async (_case, body, returnType) => {
      const { root, result } = await buildSource(
        `module Game; function leak(choose: boolean): ${returnType} { let value: byte = 7; ${body} } function main(): void {}`,
      );
      try {
        expect(result.kind).toBe("failure");
        if (result.kind !== "failure") throw new Error("Expected a borrowed-address escape");
        expect(result.diagnostics.map(({ code }) => code)).toContain("E10260");
      } finally {
        await rm(root, { recursive: true });
      }
    },
  );

  // Reading the pointed-to byte is data, not a borrowed address fragment.
  it("should allow returning data read through a local address", async () => {
    const { root, result } = await buildSource(
      "module Game; function sample(): byte { let value: byte = 7; return peek(&value); } function main(): void { poke($0400, sample()); }",
    );
    try {
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
