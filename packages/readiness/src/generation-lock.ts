import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { join, parse, resolve } from "node:path";

interface LockMetadata {
  readonly pid: number;
  readonly token: string;
}

export interface GenerationLock {
  readonly token: string;
  release(): Promise<void>;
}

interface GenerationLockTestHooks {
  readonly beforeOwnerLink?: () => void | Promise<void>;
  readonly afterDeadOwnerObserved?: () => void | Promise<void>;
  readonly afterReclamationClaimed?: () => void | Promise<void>;
}

function processIsLive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "EPERM";
  }
}

function validToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9-]{36}$/u.test(token);
}

async function metadata(path: string): Promise<LockMetadata | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (
      typeof value === "object" &&
      value !== null &&
      "pid" in value &&
      Number.isInteger(value.pid) &&
      Number(value.pid) > 0 &&
      "token" in value &&
      validToken(value.token)
    ) {
      return { pid: Number(value.pid), token: value.token };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function rejectSymlinkComponents(path: string): Promise<void> {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  const parts = absolute.slice(root.length).split("/").filter(Boolean);
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const entry = await lstat(current);
    if (entry.isSymbolicLink())
      throw new Error(`Symlink path component is not allowed: ${current}`);
  }
}

async function ensureLockDirectory(path: string): Promise<void> {
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "EEXIST" ||
      !(await lstat(path)).isDirectory()
    ) {
      throw error;
    }
  }
}

function alreadyExists(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EEXIST" || error.code === "EACCES")
  );
}

async function publishFile(
  path: string,
  target: string,
  owner: LockMetadata,
  beforeLink?: () => void | Promise<void>,
): Promise<boolean> {
  const candidate = `${path}.candidate.${owner.token}`;
  await writeFile(candidate, `${JSON.stringify(owner)}\n`, { flag: "wx", mode: 0o600 });
  try {
    await beforeLink?.();
    await link(candidate, target);
    return true;
  } catch (error) {
    if (alreadyExists(error)) return false;
    throw error;
  } finally {
    await unlink(candidate).catch(() => undefined);
  }
}

async function activeReclamation(path: string): Promise<boolean> {
  for (const name of await readdir(path)) {
    if (!name.startsWith("reclaim.")) continue;
    const marker = join(path, name);
    const owner = await metadata(marker);
    if (owner === undefined || processIsLive(owner.pid)) return true;
    await unlink(marker).catch(() => undefined);
  }
  return false;
}

function lockFor(path: string, ownerPath: string, owner: LockMetadata): GenerationLock {
  return {
    token: owner.token,
    async release() {
      const current = await metadata(ownerPath);
      if (current?.token === owner.token) await unlink(ownerPath).catch(() => undefined);
      await rm(path).catch(() => undefined);
    },
  };
}

/** Acquires one canonical owner through exclusive links and token-specific reclamation. */
export async function acquireGenerationLock(
  path: string,
  testHooks?: GenerationLockTestHooks,
): Promise<GenerationLock | undefined> {
  await rejectSymlinkComponents(path);
  await ensureLockDirectory(path);
  const ownerPath = join(path, "owner.json");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await activeReclamation(path)) return undefined;
    const owner = { pid: process.pid, token: randomUUID() };
    if (await publishFile(path, ownerPath, owner, testHooks?.beforeOwnerLink)) {
      return lockFor(path, ownerPath, owner);
    }

    const observed = await metadata(ownerPath);
    if (observed === undefined || processIsLive(observed.pid)) return undefined;
    await testHooks?.afterDeadOwnerObserved?.();
    const marker = join(path, `reclaim.${observed.token}.json`);
    const claimant = { pid: process.pid, token: randomUUID() };
    if (!(await publishFile(path, marker, claimant))) continue;
    try {
      await testHooks?.afterReclamationClaimed?.();
      const current = await metadata(ownerPath);
      if (current?.token !== observed.token) continue;
      await unlink(ownerPath);
      if (await publishFile(path, ownerPath, owner)) return lockFor(path, ownerPath, owner);
    } finally {
      await unlink(marker).catch(() => undefined);
    }
  }
  return undefined;
}
