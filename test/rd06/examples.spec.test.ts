import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";

const source = join(process.cwd(), "examples/rd06-assets");

describe("RD-06 asset example", () => {
  // The checked-in example teaches raw, Koala and PSID consumption without a game runtime.
  it("should build every handler family with exact evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-rd06-example-"));
    try {
      await cp(source, root, { recursive: true });
      const built = await buildProject({ project: join(root, "blend65.json") });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected the example build");
      expect(built.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as {
        assets: {
          handler: string;
          selector: string;
          placement: { kind: string };
          payloadBytes: number;
        }[];
      };
      expect(
        assets.assets.map(({ handler, selector, placement }) => [
          handler,
          selector,
          placement.kind,
        ]),
      ).toEqual(
        expect.arrayContaining([
          ["raw", "raw", "single"],
          ["koala", "bitmap", "single"],
          ["koala", "screen", "single"],
          ["psid", "data", "single"],
          ["psid", "init_address", "compileTime"],
        ]),
      );
      const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
      expect(assembly).toContain("!byte");
      expect(assembly).not.toMatch(/!binary|!src/iu);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  // The focused producer examples build from committed synthetic SPD v5 and CTM v9 files.
  it.each(["rd06-spritepad", "rd06-charpad"])(
    "should build the %s example",
    async (name) => {
      const root = await mkdtemp(join(tmpdir(), `blend65-${name}-`));
      try {
        await cp(join(process.cwd(), "examples", name), root, { recursive: true });
        const built = await buildProject({ project: join(root, "blend65.json") });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error(`Expected ${name} build`);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    60_000,
  );
});
