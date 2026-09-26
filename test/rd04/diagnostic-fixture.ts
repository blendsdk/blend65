import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import type { SourceSpan } from "@blend65/compiler/frontend";

/** Analyze one real source with a two-byte raw asset through the frontend-only public boundary. */
export async function analyzeDiagnosticSource(source: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-diagnostic-source-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(join(root, "assets/data.bin"), Uint8Array.of(7, 8));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "diagnostic-source",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: ["assets"],
        outDir: "out",
        optimization: "none",
      }),
    );
    const loaded = await loadProject({ cwd: root });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    return await analyzeProjectOverlay(loaded.snapshot, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Locate one literal proving construct using zero-based occurrence and raw UTF-8 byte offsets. */
export function diagnosticSpan(source: string, proof: string, occurrence = 0): SourceSpan {
  let index = -1;
  for (let n = 0; n <= occurrence; n += 1) index = source.indexOf(proof, index + 1);
  if (index < 0) throw new Error(`Missing diagnostic proof: ${proof}`);
  const start = Buffer.byteLength(source.slice(0, index));
  return { sourceId: "src/game.blend", start, end: start + Buffer.byteLength(proof) };
}
