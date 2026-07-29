import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { INVENTORY_V1_LIMITS } from "./limits.js";
import { createSourceRepository } from "./source-repository.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "blend65-source-repository-")));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("source repository implementation boundaries", () => {
  it("requires the specification root to remain inside the repository", async () => {
    const repositoryRoot = await temporaryRoot();
    const outsideRoot = await temporaryRoot();

    await expect(
      createSourceRepository({
        repositoryRoot,
        specRoot: outsideRoot,
        limits: INVENTORY_V1_LIMITS,
      }),
    ).rejects.toThrow("inside the repository");
  });

  it.each([
    ["depth", { maxDepth: 0 }, ["nested/file.md"]],
    ["entries", { maxArrayItems: 1 }, ["one.md", "two.md"]],
    ["sources", { maxSources: 1 }, ["one.md", "two.md"]],
  ] as const)("enforces the %s traversal budget", async (_name, overrides, paths) => {
    const root = await temporaryRoot();
    const specRoot = join(root, "spec");
    for (const path of paths) {
      const destination = join(specRoot, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, "# source\n");
    }
    const repository = await createSourceRepository({
      repositoryRoot: root,
      specRoot,
      limits: { ...INVENTORY_V1_LIMITS, ...overrides },
    });

    await expect(repository.listSpecFiles()).rejects.toThrow();
  });

  it("bounds aggregate bytes while caching and sharing completed reads", async () => {
    const root = await temporaryRoot();
    const specRoot = join(root, "spec");
    await mkdir(specRoot);
    await writeFile(join(specRoot, "one.md"), "123");
    await writeFile(join(specRoot, "two.md"), "456");
    const repository = await createSourceRepository({
      repositoryRoot: root,
      specRoot,
      limits: { ...INVENTORY_V1_LIMITS, maxInputBytes: 4 },
    });

    const [first, shared] = await Promise.all([
      repository.read("spec/one.md"),
      repository.read("spec/one.md"),
    ]);
    expect(first.bytes).toEqual(shared.bytes);
    expect((await repository.read("spec/one.md")).bytes).toEqual(first.bytes);
    await expect(repository.read("spec/two.md")).rejects.toThrow("Aggregate");
    await expect(repository.read("spec")).rejects.toThrow("not a file");
  });
});
