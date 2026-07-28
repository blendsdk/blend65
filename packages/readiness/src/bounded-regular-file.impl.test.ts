import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { readBoundedRegularFileNoFollow } from "./bounded-regular-file.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-bounded-authority-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("bounded regular authority files", () => {
  it("reads a stable regular file and rejects a final-path symlink", async () => {
    const root = await temporaryRoot();
    const target = join(root, "target.json");
    const link = join(root, "authority.json");
    await writeFile(target, "{}");
    await symlink(target, link);

    const bytes = await readBoundedRegularFileNoFollow(pathToFileURL(target), 2);
    expect(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).toBe("{}");
    await expect(readBoundedRegularFileNoFollow(pathToFileURL(link), 2)).rejects.toThrow();
  });

  it("rejects an oversized regular file before retaining its bytes", async () => {
    const root = await temporaryRoot();
    const path = join(root, "authority.json");
    await writeFile(path, "12345");

    await expect(readBoundedRegularFileNoFollow(pathToFileURL(path), 4)).rejects.toThrow(
      "bounded regular file",
    );
  });
});
