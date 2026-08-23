import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupSecureSelectionFileV1,
  pinSecureSelectionDirectoryV1,
  readSecureSelectionFileV1,
  synchronizeSecureSelectionDirectoryV1,
  verifySecureSelectionDirectoryV1,
  writeSecureSelectionFileV1,
} from "./execution-publication-secure-filesystem.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function root(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "blend65-secure-selection-"));
  roots.push(path);
  return path;
}

describe("secure selection filesystem", () => {
  it("pins only canonical directories and detects replacement", async () => {
    const repositoryRoot = await root();
    const directoryPath = join(repositoryRoot, "selection");
    await mkdir(directoryPath);
    const pinned = pinSecureSelectionDirectoryV1(directoryPath);
    expect(pinned.ok).toBe(true);
    if (!pinned.ok) throw new TypeError(pinned.issues[0].message);
    expect(verifySecureSelectionDirectoryV1(pinned.value)).toBe(true);

    const linkedPath = join(repositoryRoot, "linked");
    await symlink(directoryPath, linkedPath);
    expect(pinSecureSelectionDirectoryV1(linkedPath)).toMatchObject({ ok: false });
    expect(pinSecureSelectionDirectoryV1(join(repositoryRoot, "missing"))).toMatchObject({
      ok: false,
    });

    await rename(directoryPath, `${directoryPath}.retained`);
    await mkdir(directoryPath);
    expect(verifySecureSelectionDirectoryV1(pinned.value)).toBe(false);
    await rm(directoryPath, { recursive: true });
    expect(verifySecureSelectionDirectoryV1(pinned.value)).toBe(false);
  });

  it("reads only bounded canonical single-link files with retained identity", async () => {
    const repositoryRoot = await root();
    const path = join(repositoryRoot, "record.json");
    await writeFile(path, "exact\n", { mode: 0o600 });
    const exact = readSecureSelectionFileV1(repositoryRoot, path, 64);
    expect(exact.ok).toBe(true);
    if (!exact.ok) throw new TypeError(exact.issues[0].message);
    expect(new TextDecoder().decode(exact.value)).toBe("exact\n");
    const identity = await lstat(path, { bigint: true });

    expect(readSecureSelectionFileV1(join(repositoryRoot, "missing"), path, 64)).toMatchObject({
      ok: false,
    });
    expect(readSecureSelectionFileV1(repositoryRoot, "relative.json", 64)).toMatchObject({
      ok: false,
    });
    expect(readSecureSelectionFileV1(repositoryRoot, path, 1)).toMatchObject({ ok: false });
    expect(
      readSecureSelectionFileV1(repositoryRoot, path, 64, {
        device: 0n,
        inode: 0n,
        size: exact.value.byteLength,
      }),
    ).toMatchObject({ ok: false });
    expect(
      readSecureSelectionFileV1(repositoryRoot, path, 64, {
        device: identity.dev,
        inode: 0n,
        size: exact.value.byteLength,
      }),
    ).toMatchObject({ ok: false });
    expect(
      readSecureSelectionFileV1(repositoryRoot, path, 64, {
        device: identity.dev,
        inode: identity.ino,
        size: exact.value.byteLength + 1,
      }),
    ).toMatchObject({ ok: false });
    expect(
      readSecureSelectionFileV1(repositoryRoot, join(repositoryRoot, "missing.json"), 64),
    ).toMatchObject({ ok: false });

    const linked = join(repositoryRoot, "linked.json");
    await symlink(path, linked);
    expect(readSecureSelectionFileV1(repositoryRoot, linked, 64)).toMatchObject({ ok: false });
    const hardLinked = join(repositoryRoot, "hard-linked.json");
    await link(path, hardLinked);
    expect(readSecureSelectionFileV1(repositoryRoot, path, 64)).toMatchObject({ ok: false });
    expect(readSecureSelectionFileV1(repositoryRoot, repositoryRoot, 64)).toMatchObject({
      ok: false,
    });
    expect(pinSecureSelectionDirectoryV1(path)).toMatchObject({ ok: false });
  });

  it("retains exclusive temporary identity and cleans only within the pinned directory", async () => {
    const repositoryRoot = await root();
    const directoryPath = join(repositoryRoot, "selection");
    await mkdir(directoryPath);
    const pinned = pinSecureSelectionDirectoryV1(directoryPath);
    if (!pinned.ok) throw new TypeError(pinned.issues[0].message);
    const temporary = join(directoryPath, "temporary.json");
    const bytes = new TextEncoder().encode("temporary\n");
    const written = writeSecureSelectionFileV1(pinned.value, temporary, bytes);
    expect(written.ok).toBe(true);
    if (!written.ok) throw new TypeError(written.issues[0].message);
    expect(new Uint8Array(await readFile(temporary))).toEqual(bytes);
    expect(writeSecureSelectionFileV1(pinned.value, temporary, bytes)).toMatchObject({
      ok: false,
    });
    expect(
      writeSecureSelectionFileV1(pinned.value, join(repositoryRoot, "outside.json"), bytes),
    ).toMatchObject({ ok: false });

    expect(cleanupSecureSelectionFileV1(temporary, pinned.value)).toEqual({
      ok: true,
      value: true,
    });
    expect(cleanupSecureSelectionFileV1(temporary, pinned.value)).toEqual({
      ok: true,
      value: true,
    });

    const replacementTemporary = join(directoryPath, "replacement.json");
    await writeFile(replacementTemporary, bytes);
    await rename(directoryPath, `${directoryPath}.retained`);
    await mkdir(directoryPath);
    expect(
      writeSecureSelectionFileV1(pinned.value, join(directoryPath, "changed.json"), bytes),
    ).toMatchObject({ ok: false });
    expect(cleanupSecureSelectionFileV1(replacementTemporary, pinned.value)).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity" }],
    });

    const current = pinSecureSelectionDirectoryV1(directoryPath);
    if (!current.ok) throw new TypeError(current.issues[0].message);
    const directoryAsFile = join(directoryPath, "not-a-file");
    await mkdir(directoryAsFile);
    expect(cleanupSecureSelectionFileV1(directoryAsFile, current.value)).toMatchObject({
      ok: false,
      issues: [{ code: "execution.io" }],
    });
  });

  it("retries directory durability once and fails closed when both attempts are unproven", async () => {
    const repositoryRoot = await root();
    const directoryPath = join(repositoryRoot, "selection");
    await mkdir(directoryPath);
    const pinned = pinSecureSelectionDirectoryV1(directoryPath);
    if (!pinned.ok) throw new TypeError(pinned.issues[0].message);
    const attempts: number[] = [];
    expect(
      synchronizeSecureSelectionDirectoryV1(pinned.value, (attempt) => {
        attempts.push(attempt);
        return attempt === 1;
      }),
    ).toEqual({ ok: true, value: true });
    expect(attempts).toEqual([1, 2]);
    expect(synchronizeSecureSelectionDirectoryV1(pinned.value, () => true)).toMatchObject({
      ok: false,
      issues: [{ code: "execution.reconciliation" }],
    });

    await rename(directoryPath, `${directoryPath}.retained`);
    await mkdir(directoryPath);
    expect(synchronizeSecureSelectionDirectoryV1(pinned.value, () => false)).toMatchObject({
      ok: false,
    });
  });
});
