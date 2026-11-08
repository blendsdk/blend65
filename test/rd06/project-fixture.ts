import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** One asset to write into a temporary fixture project. */
export interface ProjectAsset {
  /** Project-relative spelling with forward slashes. */
  readonly path: string;
  /** Exact bytes written without transformation. */
  readonly bytes: Uint8Array;
}

/** Build one temporary real project and run an inspection against it. */
export async function withProject<T>(
  source: string,
  assets: readonly ProjectAsset[],
  inspect: (project: string, root: string) => Promise<T>,
  target = "c64-pal-prg-kernal-6581",
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "blend65-rd06-"));
  try {
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "assets"), { recursive: true });
    await writeFile(join(root, "src/game.blend"), source);
    for (const asset of assets) {
      const path = join(root, "assets", ...asset.path.split("/"));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, asset.bytes);
    }
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "rd06-fixture",
        sourceRoot: "src",
        entry: "Game",
        target,
        assetPaths: ["assets"],
        outDir: "out",
        optimization: "none",
      }),
    );
    return await inspect(join(root, "blend65.json"), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Deterministic pseudo-random bytes without a runtime dependency. */
export function patternedBytes(length: number, seed = 0): Uint8Array {
  const bytes = new Uint8Array(length);
  let state = seed >>> 0 || 0x9e3779b9;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    bytes[index] = state & 0xff;
  }
  return bytes;
}
