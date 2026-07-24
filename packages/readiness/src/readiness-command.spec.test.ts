import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { READINESS_PATHS, runReadinessCommand } from "./index.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

async function isolatedRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-readiness-"));
  for (const path of ["spec", "readiness"]) {
    await cp(join(REPOSITORY_ROOT, path), join(root, path), { recursive: true });
  }
  const declarationPath = join(root, READINESS_PATHS.declarations);
  const markdownPath = join(root, READINESS_PATHS.markdown);
  await mkdir(dirname(declarationPath), { recursive: true });
  await mkdir(dirname(markdownPath), { recursive: true });
  await writeFile(declarationPath, new Uint8Array());
  await writeFile(markdownPath, new Uint8Array());
  return root;
}

async function artifactDigests(root: string): Promise<Map<string, string>> {
  const paths = [
    READINESS_PATHS.inventory,
    READINESS_PATHS.identityLedger,
    READINESS_PATHS.reviewEvidence,
    READINESS_PATHS.declarations,
    READINESS_PATHS.markdown,
  ];
  return new Map(
    await Promise.all(
      paths.map(async (path) => {
        const digest = createHash("sha256")
          .update(await readFile(join(root, path)))
          .digest("hex");
        return [path, digest] as const;
      }),
    ),
  );
}

describe("readiness repository command", () => {
  it("should accept real authority only when both projections are current and never mutate in check mode", async () => {
    const root = await isolatedRepository();
    expect((await runReadinessCommand("generate", root)).ok).toBe(true);
    const before = await artifactDigests(root);
    const first = await runReadinessCommand("check", root);
    const second = await runReadinessCommand("check", root);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, diagnostics: [] });
    expect(await artifactDigests(root)).toEqual(before);

    for (const path of [READINESS_PATHS.declarations, READINESS_PATHS.markdown]) {
      const currentBytes = await readFile(join(root, path));
      await writeFile(join(root, path), new Uint8Array([...currentBytes, 0]));
      const staleBefore = await artifactDigests(root);
      const stale = await runReadinessCommand("check", root);
      expect(stale.ok).toBe(false);
      expect(stale.diagnostics.some(({ code }) => code.startsWith("projection."))).toBe(true);
      expect(await artifactDigests(root)).toEqual(staleBefore);
      await writeFile(join(root, path), currentBytes);
    }
  });

  it("should report publication failure without success and repair a mixed projection pair", async () => {
    const root = await isolatedRepository();
    expect((await runReadinessCommand("generate", root)).ok).toBe(true);
    const currentInventoryDigest = createHash("sha256")
      .update(await readFile(join(root, READINESS_PATHS.inventory)))
      .digest("hex");

    await writeFile(join(root, READINESS_PATHS.markdown), new Uint8Array([0]));
    const failed = await runReadinessCommand("generate", root, {
      publication: {
        afterTargetRenamed(target) {
          if (target === "declarations") {
            throw new Error("injected crash after first rename");
          }
        },
      },
    });
    expect(failed.ok).toBe(false);
    expect(failed.diagnostics.some(({ code }) => code.startsWith("publication."))).toBe(true);

    const mixed = await runReadinessCommand("check", root);
    expect(mixed.ok).toBe(false);
    expect(mixed.diagnostics.some(({ code }) => code.startsWith("projection."))).toBe(true);

    expect((await runReadinessCommand("generate", root)).ok).toBe(true);
    expect(await runReadinessCommand("check", root)).toMatchObject({ ok: true, diagnostics: [] });
    expect(
      createHash("sha256")
        .update(await readFile(join(root, READINESS_PATHS.inventory)))
        .digest("hex"),
    ).toBe(currentInventoryDigest);
  });

  it("should serialize concurrent writers and never publish a mixed pair from different authority revisions", async () => {
    const root = await isolatedRepository();
    let releaseFirst: (() => void) | undefined;
    const paused = new Promise<void>((resolvePause) => {
      releaseFirst = resolvePause;
    });
    let firstWriterPaused: (() => void) | undefined;
    const firstPaused = new Promise<void>((resolvePause) => {
      firstWriterPaused = resolvePause;
    });

    const first = runReadinessCommand("generate", root, {
      publication: {
        async afterTemporaryFileSynced(target) {
          if (target === "declarations") {
            firstWriterPaused?.();
            await paused;
          }
        },
      },
    });
    await firstPaused;

    const inventoryPath = join(root, READINESS_PATHS.inventory);
    await writeFile(inventoryPath, new Uint8Array([...(await readFile(inventoryPath)), 0x20]));
    const second = runReadinessCommand("generate", root);
    releaseFirst?.();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(false);
    expect(secondResult.diagnostics.some(({ code }) => code.startsWith("generation-lock."))).toBe(
      true,
    );
    const check = await runReadinessCommand("check", root);
    expect(check.diagnostics.some(({ code }) => code.startsWith("projection."))).toBe(false);
  });
});
