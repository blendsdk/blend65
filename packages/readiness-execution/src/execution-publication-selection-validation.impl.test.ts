import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import type { PublishedExecutionReleaseDescriptorV1 } from "@blend65/readiness/execution-publication-internals";
import { afterEach, describe, expect, it } from "vitest";

import {
  readSelectedExecutionParentDigestV1,
  validateExactExecutionCatalogRowsV1,
  validateExecutionChildReleaseFilesV1,
  validateExecutionParentFreshnessFilesV1,
} from "./execution-publication-selection-validation.js";

const roots: string[] = [];
const DIGEST = `sha256:${"1".repeat(64)}`;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function descriptor(): Promise<PublishedExecutionReleaseDescriptorV1> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "blend65-selection-validation-"));
  roots.push(repositoryRoot);
  const executionPublicationRoot = join(repositoryRoot, "readiness/execution-publications");
  const executionReleaseRoot = join(executionPublicationRoot, "releases", DIGEST);
  await mkdir(executionReleaseRoot, { recursive: true });
  const childPath = join(executionReleaseRoot, "member.json");
  const childBytes = new TextEncoder().encode("child\n");
  await writeFile(childPath, childBytes);
  const childIdentity = await lstat(childPath, { bigint: true });
  const releaseIdentity = await lstat(executionReleaseRoot, { bigint: true });
  const parentPath = join(repositoryRoot, "parent.js");
  const parentBytes = new TextEncoder().encode("parent\n");
  await writeFile(parentPath, parentBytes);
  return Object.freeze({
    repositoryRoot,
    executionPublicationRoot,
    executionReleaseRoot,
    executionReleaseDevice: releaseIdentity.dev,
    executionReleaseInode: releaseIdentity.ino,
    executionPointerPath: join(executionPublicationRoot, "selected.json"),
    parentPointerPath: join(repositoryRoot, "parent-pointer.json"),
    digest: DIGEST,
    parentDigest: DIGEST,
    bindingDigest: DIGEST,
    bindings: Object.freeze([]),
    childReleaseFiles: Object.freeze([
      Object.freeze({
        path: relative(repositoryRoot, childPath),
        byteLength: childBytes.byteLength,
        digest: sha256(childBytes),
        device: childIdentity.dev,
        inode: childIdentity.ino,
      }),
    ]),
    parentFreshnessFiles: Object.freeze([
      Object.freeze({
        path: relative(repositoryRoot, parentPath),
        byteLength: parentBytes.byteLength,
        digest: sha256(parentBytes),
      }),
    ]),
  });
}

describe("execution selection validation", () => {
  it("revalidates exact child identity, inventory, and bytes", async () => {
    const passive = await descriptor();
    expect(validateExecutionChildReleaseFilesV1(passive)).toEqual({ ok: true, value: true });
    for (const changed of [
      { executionReleaseDevice: 0n },
      { executionReleaseInode: 0n },
      { childReleaseFiles: [] },
      {
        childReleaseFiles: passive.childReleaseFiles.map((file) => ({
          ...file,
          byteLength: file.byteLength + 1,
        })),
      },
      {
        childReleaseFiles: passive.childReleaseFiles.map((file) => ({
          ...file,
          digest: `sha256:${"0".repeat(64)}`,
        })),
      },
      { executionReleaseRoot: join(passive.repositoryRoot, "missing") },
    ]) {
      expect(validateExecutionChildReleaseFilesV1({ ...passive, ...changed })).toMatchObject({
        ok: false,
      });
    }
  });

  it("accepts only exact canonical parent pointer bytes", async () => {
    const passive = await descriptor();
    const path = passive.parentPointerPath;
    const canonical = new TextEncoder().encode(
      `${JSON.stringify({ schemaVersion: 1, publicationDigest: DIGEST })}\n`,
    );
    await writeFile(path, canonical);
    expect(readSelectedExecutionParentDigestV1(passive.repositoryRoot, path)).toEqual({
      ok: true,
      value: DIGEST,
    });
    for (const source of [
      "{not-json\n",
      "null\n",
      "[]\n",
      "{}\n",
      `${JSON.stringify({ schemaVersion: 2, publicationDigest: DIGEST })}\n`,
      `${JSON.stringify({ schemaVersion: 1, publicationDigest: 1 })}\n`,
      `${JSON.stringify({ schemaVersion: 1, publicationDigest: "bad" })}\n`,
      `${new TextDecoder().decode(canonical).trim()} \n`,
      `${JSON.stringify({ schemaVersion: 1, publicationDigest: DIGEST, extra: true })}\n`,
    ]) {
      await writeFile(path, source);
      expect(readSelectedExecutionParentDigestV1(passive.repositoryRoot, path)).toMatchObject({
        ok: false,
        issues: [{ path: "/parentDigest" }],
      });
    }
    expect(
      readSelectedExecutionParentDigestV1(
        passive.repositoryRoot,
        join(passive.repositoryRoot, "missing-pointer.json"),
      ),
    ).toMatchObject({ ok: false });
  });

  it("rejects noncanonical and stale parent freshness closures", async () => {
    const passive = await descriptor();
    expect(validateExecutionParentFreshnessFilesV1(passive)).toEqual({ ok: true, value: true });
    expect(
      validateExecutionParentFreshnessFilesV1({ ...passive, parentFreshnessFiles: [] }),
    ).toMatchObject({ ok: false });
    expect(
      validateExecutionParentFreshnessFilesV1({
        ...passive,
        parentFreshnessFiles: Array.from({ length: 513 }, () => passive.parentFreshnessFiles[0]!),
      }),
    ).toMatchObject({ ok: false });

    const exact = passive.parentFreshnessFiles[0]!;
    for (const changed of [
      { path: "" },
      { path: "bad\\path" },
      { path: "/absolute" },
      { path: "nested/../path" },
      { path: ".." },
      { path: "../path" },
      { path: "./path" },
      { byteLength: 1.5 },
      { byteLength: -1 },
      { byteLength: 8 * 1024 * 1024 + 1 },
      { digest: "bad" },
      { byteLength: exact.byteLength + 1 },
      { digest: `sha256:${"0".repeat(64)}` },
      { path: "missing.js" },
    ]) {
      expect(
        validateExecutionParentFreshnessFilesV1({
          ...passive,
          parentFreshnessFiles: [{ ...exact, ...changed }],
        }),
      ).toMatchObject({ ok: false });
    }
    expect(
      validateExecutionParentFreshnessFilesV1({
        ...passive,
        parentFreshnessFiles: [exact, exact],
      }),
    ).toMatchObject({ ok: false });
  });

  it("joins only exact ordered fixed catalog rows", () => {
    const row = {
      capabilityId: "acme",
      contractVersion: "1.0.0",
      implementationRevision: DIGEST,
      entryPath: "entry.js",
      dependencyPaths: [],
      dependencyDigests: {},
    };
    expect(validateExactExecutionCatalogRowsV1([row], [row])).toEqual({ ok: true, value: true });
    expect(validateExactExecutionCatalogRowsV1([], [row])).toMatchObject({ ok: false });
    for (const changed of [
      { capabilityId: "vice" },
      { contractVersion: "2.0.0" },
      { implementationRevision: `sha256:${"0".repeat(64)}` },
    ]) {
      expect(validateExactExecutionCatalogRowsV1([{ ...row, ...changed }], [row])).toMatchObject({
        ok: false,
      });
    }
    expect(validateExactExecutionCatalogRowsV1([,] as never, [row])).toMatchObject({ ok: false });
    expect(validateExactExecutionCatalogRowsV1([row], [,] as never)).toMatchObject({ ok: false });
  });
});
