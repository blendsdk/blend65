import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";

const source = join(process.cwd(), "examples/rd07-loadable");

describe("RD-07 loadable example", () => {
  // The checked-in example builds one boot component and one composite load unit.
  it("should build a composite load example as a D64", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-rd07-example-"));
    try {
      await cp(source, root, { recursive: true });
      const built = await buildProject({ project: join(root, "blend65.json") });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected the example build");
      expect(built.generation.primaryArtifact).toBe("rd07-loadable.d64");
      const build = JSON.parse(
        await readFile(join(built.generation.directory, ".build.json"), "utf8"),
      ) as {
        package: {
          kind: string;
          imageBytes: number;
          loaderStrategyId: string;
          components: { id: string; blocks: number; bytes: number }[];
        };
      };
      expect(build.package.kind).toBe("d64");
      expect(build.package.imageBytes).toBe(174_848);
      expect(build.package.loaderStrategyId).toBe("kernal-sequential-uncompressed");
      // Boot plus the two reachable units; LEVEL_3_UNUSED is omitted.
      expect(build.package.components).toHaveLength(3);
      expect(build.package.components[0]!.id).toBe("boot");
      expect(build.package.components[1]!.bytes).toBe(2 + 32);
      expect(build.package.components[2]!.bytes).toBe(2 + 32);
      const memory = JSON.parse(
        await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
      ) as { loadStates: unknown[] };
      expect(memory.loadStates).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
