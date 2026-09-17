import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryRoots: string[] = [];

/** Create a native project with opaque source bytes; loading must not compile them. */
export async function projectFixture(name = "Game Ω 1.2"): Promise<string> {
  const root = await emptyFixture();
  await mkdir(join(root, "src", "nested"), { recursive: true });
  await writeFile(join(root, "src", "main.blend"), "opaque foundation input\n");
  await writeFile(join(root, "src", "second.blend"), "second opaque input\n");
  await writeFile(join(root, "src", "ignored.BLEND"), "ignored\n");
  await writeFile(
    join(root, "blend65.json"),
    JSON.stringify({
      schemaVersion: 1,
      name,
      sourceRoot: "src",
      entry: "Foundation",
      target: "c64-pal-prg-kernal-6581",
      outDir: "out",
      optimization: "none",
    }),
  );
  return root;
}

/** Create a native directory outside any project, tracked for test cleanup. */
export async function emptyFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-cli-"));
  temporaryRoots.push(root);
  return root;
}

/** Snapshot raw manifest bytes to prove invocation overrides never rewrite input. */
export async function manifestBytes(root: string): Promise<Buffer> {
  return readFile(join(root, "blend65.json"));
}

/** Remove only the exact temporary directories created by this test helper. */
export async function cleanupFixtures(): Promise<void> {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
}
