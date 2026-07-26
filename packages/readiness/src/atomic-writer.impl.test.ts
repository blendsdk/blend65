import { spawn } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { replaceFileAtomically } from "./atomic-writer.js";
import { READINESS_PATHS, runReadinessCommand } from "./cli.js";
import { acquireGenerationLock } from "./generation-lock.js";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
const temporaryRoots: string[] = [];
const DEAD_TOKEN = "00000000-0000-4000-8000-000000000000";

async function temporaryDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("generation lock", () => {
  it("should preserve token ownership and reject a live competing owner", async () => {
    const root = await temporaryDirectory("blend65-lock-");
    const path = join(root, "lock");
    const owner = await acquireGenerationLock(path);
    expect(owner).toBeDefined();
    expect(await acquireGenerationLock(path)).toBeUndefined();
    const ownerFile = (await readdir(path)).find((name) => name.startsWith("owner."));
    expect(ownerFile).toBeDefined();
    await writeFile(
      join(path, ownerFile!),
      `${JSON.stringify({ pid: process.pid, token: DEAD_TOKEN })}\n`,
    );
    await owner?.release();
    expect((await stat(path)).isDirectory()).toBe(true);
  });

  it("should quarantine a dead owner before acquiring a new token", async () => {
    const root = await temporaryDirectory("blend65-dead-lock-");
    const path = join(root, "lock");
    await mkdir(path);
    await writeFile(
      join(path, "owner.json"),
      `${JSON.stringify({ pid: 2_147_483_647, token: DEAD_TOKEN })}\n`,
    );
    const owner = await acquireGenerationLock(path);
    expect(owner).toBeDefined();
    expect((await readdir(root)).filter((name) => name.includes("abandoned"))).toEqual([]);
    await owner?.release();
  });

  it("should conservatively reject malformed ownership and propagate acquisition errors", async () => {
    const root = await temporaryDirectory("blend65-malformed-lock-");
    const path = join(root, "lock");
    await mkdir(path);
    await writeFile(join(path, "owner.json"), "{not-json");
    expect(await acquireGenerationLock(path)).toBeUndefined();
    await expect(acquireGenerationLock(join(root, "missing-parent", "lock"))).rejects.toMatchObject(
      {
        code: "ENOENT",
      },
    );
  });

  it("should reject incomplete ownership and ignore unrelated quarantine directories", async () => {
    const root = await temporaryDirectory("blend65-incomplete-lock-");
    const incomplete = join(root, "incomplete");
    await mkdir(incomplete);
    await writeFile(join(incomplete, "owner.json"), "{}");
    expect(await acquireGenerationLock(incomplete)).toBeUndefined();

    const blocked = join(root, "blocked");
    await mkdir(blocked);
    await writeFile(
      join(blocked, "owner.json"),
      `${JSON.stringify({ pid: 2_147_483_647, token: DEAD_TOKEN })}\n`,
    );
    await mkdir(`${blocked}.abandoned.dead`);
    await writeFile(join(`${blocked}.abandoned.dead`, "occupied"), "occupied");
    const owner = await acquireGenerationLock(blocked);
    expect(owner).toBeDefined();
    await owner?.release();
  });

  it("should allow only one of two concurrent dead-owner reclaimers to acquire", async () => {
    const root = await temporaryDirectory("blend65-reclaim-race-");
    const path = join(root, "lock");
    await mkdir(path);
    await writeFile(
      join(path, "owner.json"),
      `${JSON.stringify({ pid: 2_147_483_647, token: DEAD_TOKEN })}\n`,
    );
    const contenders = await Promise.all([
      acquireGenerationLock(path),
      acquireGenerationLock(path),
    ]);
    expect(contenders.filter((owner) => owner !== undefined)).toHaveLength(1);
    await Promise.all(contenders.map((owner) => owner?.release()));
  });

  it("should not let a stale contender displace a replacement live owner", async () => {
    const root = await temporaryDirectory("blend65-replacement-race-");
    const path = join(root, "lock");
    await mkdir(path);
    await writeFile(
      join(path, "owner.json"),
      `${JSON.stringify({ pid: 2_147_483_647, token: DEAD_TOKEN })}\n`,
    );
    let resumeStale: (() => void) | undefined;
    const staleBlocked = new Promise<void>((resolveBlocked) => {
      resumeStale = resolveBlocked;
    });
    let staleObserved: (() => void) | undefined;
    const observed = new Promise<void>((resolveObserved) => {
      staleObserved = resolveObserved;
    });
    const stale = acquireGenerationLock(path, {
      afterDeadOwnerObserved() {
        staleObserved?.();
        return staleBlocked;
      },
    });
    await observed;
    const replacement = await acquireGenerationLock(path);
    expect(replacement).toBeDefined();
    resumeStale?.();
    const [staleResult, contender] = await Promise.all([stale, acquireGenerationLock(path)]);
    expect(staleResult).toBeUndefined();
    expect(contender).toBeUndefined();
    expect(await readdir(path)).toEqual(["owner.json"]);
    await replacement?.release();
  });

  it("should not let a delayed candidate publish after a live owner returns", async () => {
    const root = await temporaryDirectory("blend65-delayed-candidate-");
    const path = join(root, "lock");
    let resumeDelayed: (() => void) | undefined;
    const delayedBlocked = new Promise<void>((resolveBlocked) => {
      resumeDelayed = resolveBlocked;
    });
    let candidateReady: (() => void) | undefined;
    const ready = new Promise<void>((resolveReady) => {
      candidateReady = resolveReady;
    });
    const delayed = acquireGenerationLock(path, {
      beforeOwnerLink() {
        candidateReady?.();
        return delayedBlocked;
      },
    });
    await ready;
    const owner = await acquireGenerationLock(path);
    expect(owner).toBeDefined();
    resumeDelayed?.();
    const [delayedResult, contender] = await Promise.all([delayed, acquireGenerationLock(path)]);
    expect(delayedResult).toBeUndefined();
    expect(contender).toBeUndefined();
    expect(await readdir(path)).toEqual(["owner.json"]);
    await owner?.release();
  });

  it("should ignore an ownerless unpublished candidate directory", async () => {
    const root = await temporaryDirectory("blend65-ownerless-candidate-");
    const path = join(root, "lock");
    await mkdir(`${path}.candidate.interrupted`);
    const owner = await acquireGenerationLock(path);
    expect(owner).toBeDefined();
    await owner?.release();
  });

  it("should reject a symlinked generation-lock parent", async () => {
    const root = await temporaryDirectory("blend65-lock-link-");
    const outside = await temporaryDirectory("blend65-lock-outside-");
    await symlink(outside, join(root, "generated"));
    await expect(acquireGenerationLock(join(root, "generated/lock"))).rejects.toThrow(
      "Symlink path component",
    );
    expect(await readdir(outside)).toEqual([]);
  });

  it("should reject a non-directory lock path", async () => {
    const root = await temporaryDirectory("blend65-lock-file-");
    const path = join(root, "lock");
    await writeFile(path, "not a lock directory");
    await expect(acquireGenerationLock(path)).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("should propagate publication failures and remove the private candidate", async () => {
    const root = await temporaryDirectory("blend65-link-failure-");
    const path = join(root, "lock");
    await expect(
      acquireGenerationLock(path, {
        beforeOwnerLink() {
          throw new Error("injected publication failure");
        },
      }),
    ).rejects.toThrow("injected publication failure");
    expect(await readdir(root)).toEqual(["lock"]);
    expect(await readdir(path)).toEqual([]);
  });

  it("should reclaim a dead exclusive reclamation marker", async () => {
    const root = await temporaryDirectory("blend65-dead-marker-");
    const path = join(root, "lock");
    await mkdir(path);
    await writeFile(
      join(path, `reclaim.${DEAD_TOKEN}.json`),
      `${JSON.stringify({ pid: 2_147_483_647, token: DEAD_TOKEN })}\n`,
    );
    const owner = await acquireGenerationLock(path);
    expect(owner).toBeDefined();
    expect(await readdir(path)).toEqual(["owner.json"]);
    await owner?.release();
  });

  it("should leave an already-removed owned lock harmless on release", async () => {
    const root = await temporaryDirectory("blend65-removed-lock-");
    const path = join(root, "lock");
    const owner = await acquireGenerationLock(path);
    await rm(path, { recursive: true });
    await expect(owner?.release()).resolves.toBeUndefined();
  });
});

describe("atomic replacement", () => {
  it("should remove only its exclusive temporary after an injected ordinary failure", async () => {
    const root = await temporaryDirectory("blend65-atomic-");
    const target = join(root, "target.ts");
    await writeFile(target, "old");
    await expect(
      replaceFileAtomically(target, new TextEncoder().encode("new"), "declarations", {
        afterTemporaryFileSynced() {
          throw new Error("injected failure");
        },
      }),
    ).rejects.toThrow("injected failure");
    expect(await readFile(target, "utf8")).toBe("old");
    expect(await readdir(root)).toEqual(["target.ts"]);
  });

  it("should reject a symlinked output parent", async () => {
    const root = await temporaryDirectory("blend65-atomic-link-");
    const outside = await temporaryDirectory("blend65-atomic-outside-");
    await symlink(outside, join(root, "generated"));
    await expect(
      replaceFileAtomically(
        join(root, "generated/target.ts"),
        new TextEncoder().encode("new"),
        "declarations",
      ),
    ).rejects.toThrow("Symlink path component");
    expect(await readdir(outside)).toEqual([]);
  });
});

async function isolatedRepository(): Promise<string> {
  const root = await temporaryDirectory("blend65-crash-");
  await cp(join(REPOSITORY_ROOT, "spec"), join(root, "spec"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "readiness"), join(root, "readiness"), { recursive: true });
  const declaration = join(root, READINESS_PATHS.declarations);
  await mkdir(dirname(declaration), { recursive: true });
  await cp(join(REPOSITORY_ROOT, READINESS_PATHS.declarations), declaration);
  return root;
}

function waitForMarker(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolveMarker, rejectMarker) => {
    child.once("error", rejectMarker);
    child.stdout?.once("data", () => resolveMarker());
    child.once("exit", (code) => {
      if (code !== null) rejectMarker(new Error(`Crash fixture exited early with ${code}.`));
    });
  });
}

describe("crash recovery", () => {
  it("should detect and repair a child killed after the first atomic rename", async () => {
    const root = await isolatedRepository();
    const writerUrl = pathToFileURL(
      join(REPOSITORY_ROOT, "packages/readiness/dist/atomic-writer.js"),
    ).href;
    const lockUrl = pathToFileURL(
      join(REPOSITORY_ROOT, "packages/readiness/dist/generation-lock.js"),
    ).href;
    const script = `
      import { readFile } from "node:fs/promises";
      import { replaceFileAtomically } from ${JSON.stringify(writerUrl)};
      import { acquireGenerationLock } from ${JSON.stringify(lockUrl)};
      const root = process.argv[1];
      const lock = await acquireGenerationLock(root + "/${READINESS_PATHS.lock}");
      if (lock === undefined) process.exit(2);
      const target = root + "/${READINESS_PATHS.declarations}";
      const bytes = new Uint8Array([...(await readFile(target)), 0]);
      await replaceFileAtomically(target, bytes, "declarations");
      process.stdout.write("renamed\\n");
      setInterval(() => {}, 1000);
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", script, root], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForMarker(child);
    child.kill("SIGKILL");
    await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));

    const mixed = await runReadinessCommand("source-check", root);
    expect(mixed.ok).toBe(false);
    expect(mixed.diagnostics.some(({ code }) => code.startsWith("projection."))).toBe(true);
    expect(await runReadinessCommand("generate", root)).toMatchObject({
      ok: true,
      diagnostics: [],
    });
    expect(await runReadinessCommand("source-check", root)).toMatchObject({
      ok: true,
      diagnostics: [],
    });
  });
});
