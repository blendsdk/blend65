import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The committed boing-ball example and its hand-written twin. */
export const BOING_BALL_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "examples",
  "boing-ball",
);

/** Read an address label map from a compiler `.labels` file or an ACME symbol list. */
export function labels(text: string): Map<string, number> {
  return new Map(
    [...text.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Find the first instruction after the raster-251 wait in the compiled assembly. */
export function exampleFramePoint(asm: string, map: ReadonlyMap<string, number>): number {
  const lines = asm.split("\n");
  const wait = lines.findIndex((line) => /^\s+eor #\$fb$/iu.test(line));
  expect(wait).toBeGreaterThanOrEqual(0);
  for (const line of lines.slice(wait + 1)) {
    const match = /^(b65_[A-Za-z0-9_]+):$/u.exec(line.trim());
    if (match === null) continue;
    const address = map.get(match[1]!);
    if (address === undefined) throw new Error(`missing label ${match[1]}`);
    return address;
  }
  throw new Error("no label after the raster wait");
}

/** The assembled twin and its symbol list, with scratch-directory cleanup. */
export interface AssembledTwin {
  /** The CBM PRG path. */
  readonly prg: string;
  /** The ACME symbol list text. */
  readonly symbol: string;
  /** Remove the scratch directory. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Assemble the committed twin in a scratch directory so the repository never
 * receives a generated PRG. The twin includes `assets/ball.bin` relative to its
 * own directory, so the scratch copy preserves that layout.
 * @returns The assembled PRG and symbol list.
 */
export async function assembleTwin(): Promise<AssembledTwin> {
  const root = await mkdtemp(join(tmpdir(), "blend65-boing-twin-"));
  await mkdir(join(root, "assets"));
  await copyFile(join(BOING_BALL_DIR, "twin.asm"), join(root, "twin.asm"));
  await copyFile(join(BOING_BALL_DIR, "assets", "ball.bin"), join(root, "assets", "ball.bin"));
  const assembled = spawnSync(
    "acme",
    ["-o", "twin.prg", "-f", "cbm", "-l", "twin.sym", "twin.asm"],
    { cwd: root, encoding: "utf8" },
  );
  expect(assembled.status, assembled.stderr).toBe(0);
  return {
    prg: join(root, "twin.prg"),
    symbol: await readFile(join(root, "twin.sym"), "utf8"),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
