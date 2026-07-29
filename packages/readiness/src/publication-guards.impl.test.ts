import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  getPublishedBinding,
  getPublishedBindingRows,
  getPublishedInventory,
  getPublishedMetadata,
  prepareBindingPublicationReview,
} from "./index.js";
import { installPublishedBindingLookup } from "./publication-binding-lookup.js";
import { loadPublicationCandidateCatalog } from "./publication-candidates.js";
import {
  runWithPublicationConformance,
  validatePublicationModuleBoundary,
} from "./publication-conformance-v1.js";
import {
  ensurePublicationChildDirectory,
  pinPublicationDirectory,
  readPublicationDirectoryNames,
  readPublicationRegularFile,
  removePublicationEntry,
  renamePublicationEntry,
  syncPublicationDirectory,
  verifyPublicationDirectory,
  writePublicationRegularFile,
} from "./publication-filesystem.js";
import {
  PUBLICATION_MEMBER_PATHS,
  PUBLICATION_V1_LIMITS,
  computePublicationDigest,
  digestPublicationBytes,
  inspectPublicationLimits,
  parsePublicationBindings,
  parsePublicationJson,
  parsePublicationManifest,
  parsePublicationPointer,
  publicationDiagnostic,
  renderPublicationJson,
  renderPublicationManifest,
  renderPublicationPointer,
  type PublicationManifestV1,
  type PublicationRelease,
} from "./publication-model.js";
import { commitPublicationPointer, promotePublicationRelease } from "./publication-pointer.js";
import {
  resolvePublishedReleaseDigest,
  resolvePublishedSnapshot,
  resolvePublishedSnapshotByDigest,
  getPublishedSnapshotAuthority,
} from "./publication-resolver.js";
import type { InventoryV1 } from "./model.js";

const encoder = new TextEncoder();
const DIGEST = `sha256:${"1".repeat(64)}` as const;
const REPOSITORY_ROOT = resolve(process.cwd(), "../..");
const temporaryRoots: string[] = [];
const EMPTY_INVENTORY: InventoryV1 = {
  schemaVersion: 1,
  inventoryVersion: "1.0.0",
  specRevision: DIGEST,
  identityLedgerHead: DIGEST,
  fragmentationProfile: {
    profileId: "markdown-ebnf-v1",
    version: 1,
    contentHashAlgorithm: "sha256",
    newlinePolicy: "lf",
  },
  normativeSources: [],
  handlerDeclarations: [],
  evidenceCapabilityDeclarations: [],
  clauseLedger: [],
  conflicts: [],
  rules: [],
  evolutionGate: null,
};

function jsonBytes(value: unknown): Uint8Array {
  return renderPublicationJson(value);
}

function expectInvalid(result: { readonly ok: boolean }): void {
  expect(result.ok).toBe(false);
}

async function temporaryRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "blend65-publication-guards-")));
  temporaryRoots.push(root);
  return root;
}

function validManifest(): PublicationManifestV1 {
  return {
    schemaVersion: 1,
    inventoryGenerationDigest: DIGEST,
    members: PUBLICATION_MEMBER_PATHS.map((path) => ({
      path,
      byteLength: 0,
      digest: digestPublicationBytes(new Uint8Array()),
    })),
  };
}

function syntheticRelease(
  members = new Map(PUBLICATION_MEMBER_PATHS.map((path) => [path, new Uint8Array()])),
): PublicationRelease {
  const manifest = validManifest();
  const publicationDigest = computePublicationDigest(manifest);
  return {
    inventory: EMPTY_INVENTORY,
    inventoryGenerationDigest: DIGEST,
    bindings: [],
    members,
    manifest,
    manifestBytes: renderPublicationManifest(manifest),
    publicationDigest,
  };
}

async function selectedSkeleton(
  manifest: PublicationManifestV1,
): Promise<{ readonly root: string; readonly releaseRoot: string }> {
  const root = await temporaryRoot();
  const publicationDigest = computePublicationDigest(manifest);
  const releaseRoot = join(root, "readiness/publications/releases", publicationDigest);
  await mkdir(releaseRoot, { recursive: true });
  await writeFile(
    join(root, "readiness/publications/current-publication.json"),
    renderPublicationPointer(publicationDigest),
  );
  await writeFile(join(releaseRoot, "manifest.json"), renderPublicationManifest(manifest));
  return { root, releaseRoot };
}

async function stagedReleaseFromMembers(
  members: ReadonlyMap<(typeof PUBLICATION_MEMBER_PATHS)[number], Uint8Array>,
): Promise<{
  readonly root: string;
  readonly publicationDigest: `sha256:${string}`;
}> {
  const root = await temporaryRoot();
  const manifest: PublicationManifestV1 = {
    schemaVersion: 1,
    inventoryGenerationDigest: DIGEST,
    members: PUBLICATION_MEMBER_PATHS.map((path) => {
      const bytes = members.get(path);
      if (bytes === undefined) throw new TypeError(`missing test member ${path}`);
      return {
        path,
        byteLength: bytes.byteLength,
        digest: digestPublicationBytes(bytes),
      };
    }),
  };
  const publicationDigest = computePublicationDigest(manifest);
  const releaseRoot = join(root, "readiness/publications/releases", publicationDigest);
  await mkdir(releaseRoot, { recursive: true });
  await writeFile(join(releaseRoot, "manifest.json"), renderPublicationManifest(manifest));
  await Promise.all([...members].map(([path, bytes]) => writeFile(join(releaseRoot, path), bytes)));
  return { root, publicationDigest };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("publication wire guards", () => {
  it("rejects malformed, ambiguous and resource-exhausting strict JSON", () => {
    const invalidInputs = [
      new Uint8Array([0xff, 0x0a]),
      encoder.encode("{}"),
      encoder.encode("{}\n\n"),
      encoder.encode("{}\r\n"),
      encoder.encode('{"duplicate":1,"duplicate":2}\n'),
      encoder.encode('{"comment":1/* no */}\n'),
      encoder.encode('{"broken":}\n'),
      encoder.encode(`${"[".repeat(17)}0${"]".repeat(17)}\n`),
      encoder.encode(`${'{"nested":'.repeat(17)}0${"}".repeat(17)}\n`),
      jsonBytes({ ["x".repeat(PUBLICATION_V1_LIMITS.maxStringBytes + 1)]: true }),
      jsonBytes("x".repeat(PUBLICATION_V1_LIMITS.maxStringBytes + 1)),
      jsonBytes(Array.from({ length: PUBLICATION_V1_LIMITS.maxJsonValues }, () => null)),
    ];
    for (const bytes of invalidInputs) {
      expectInvalid(parsePublicationJson(bytes));
    }
    expect(parsePublicationJson(jsonBytes({ exact: true }))).toMatchObject({ ok: true });
    expect(publicationDiagnostic("publication.io", "/", "x".repeat(1_024)).message).toHaveLength(
      512,
    );

    const invalidJson = encoder.encode("{\n");
    expectInvalid(parsePublicationPointer(invalidJson));
    expectInvalid(parsePublicationManifest(invalidJson));
    expectInvalid(parsePublicationBindings(invalidJson));
  });

  it("enforces exact pointer, manifest and binding schemas", () => {
    for (const value of [
      null,
      {},
      { schemaVersion: 2, publicationDigest: DIGEST },
      { schemaVersion: 1, publicationDigest: "not-a-digest" },
      { schemaVersion: 1, publicationDigest: DIGEST, extra: true },
    ]) {
      expectInvalid(parsePublicationPointer(jsonBytes(value)));
    }
    expect(parsePublicationPointer(renderPublicationPointer(DIGEST))).toMatchObject({ ok: true });

    const manifest = validManifest();
    for (const value of [
      null,
      {},
      { ...manifest, schemaVersion: 2 },
      { ...manifest, inventoryGenerationDigest: "invalid" },
      { ...manifest, members: [] },
      {
        ...manifest,
        members: manifest.members.map((member, index) =>
          index === 0 ? { ...member, path: "../bindings-v1.json" } : member,
        ),
      },
      {
        ...manifest,
        members: manifest.members.map((member, index) =>
          index === 0 ? { ...member, byteLength: -1 } : member,
        ),
      },
      {
        ...manifest,
        members: manifest.members.map((member, index) =>
          index === 0 ? { ...member, digest: "invalid" } : member,
        ),
      },
    ]) {
      expectInvalid(parsePublicationManifest(jsonBytes(value)));
    }
    expect(parsePublicationManifest(renderPublicationManifest(manifest))).toMatchObject({
      ok: true,
    });

    const row = {
      handlerId: "generator.valid",
      kind: "generator",
      contractVersion: "1.0.0",
      implementationRevision: DIGEST,
    };
    for (const value of [
      null,
      {},
      { schemaVersion: 2, bindings: [] },
      { schemaVersion: 1, bindings: "invalid" },
      {
        schemaVersion: 1,
        bindings: Array.from({ length: PUBLICATION_V1_LIMITS.maxBindings + 1 }, () => row),
      },
      { schemaVersion: 1, bindings: [null] },
      { schemaVersion: 1, bindings: [{ ...row, kind: "invalid" }] },
      { schemaVersion: 1, bindings: [{ ...row, contractVersion: "" }] },
      { schemaVersion: 1, bindings: [{ ...row, implementationRevision: "invalid" }] },
      { schemaVersion: 1, bindings: [row, row] },
    ]) {
      expectInvalid(parsePublicationBindings(jsonBytes(value)));
    }
    expect(
      parsePublicationBindings(jsonBytes({ schemaVersion: 1, bindings: [row] })),
    ).toMatchObject({ ok: true });
  });

  it("rejects unsafe numeric limit inputs independently of upper bounds", () => {
    const exact = {
      pointerBytes: 0,
      manifestBytes: 0,
      bindingBytes: 0,
      semanticReviewBytes: 0,
      memberCount: 0,
      memberBytes: 0,
      totalReleaseBytes: 0,
    };
    for (const key of Object.keys(exact) as (keyof typeof exact)[]) {
      expectInvalid(inspectPublicationLimits({ ...exact, [key]: -1 }));
      expectInvalid(inspectPublicationLimits({ ...exact, [key]: Number.NaN }));
    }
  });
});

describe("selected-publication filesystem guards", () => {
  it("requires one canonical absolute repository root", async () => {
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: "." }));
    const root = await temporaryRoot();
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: join(root, "missing") }));
    const linkPath = `${root}-link`;
    temporaryRoots.push(linkPath);
    await symlink(root, linkPath);
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: linkPath }));
  });

  it("rejects missing, linked and oversized pointer artifacts", async () => {
    const root = await temporaryRoot();
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    await mkdir(join(root, "readiness"), { recursive: true });
    await symlink(root, join(root, "readiness/publications"));
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    await rm(join(root, "readiness/publications"));
    await mkdir(join(root, "readiness/publications/releases"), { recursive: true });
    const pointerPath = join(root, "readiness/publications/current-publication.json");
    await writeFile(pointerPath, new Uint8Array(PUBLICATION_V1_LIMITS.maxPointerBytes + 1));
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    await rm(pointerPath);
    await writeFile(pointerPath, renderPublicationPointer(DIGEST));
    await link(pointerPath, join(root, "readiness/publications/pointer-hardlink.json"));
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
  });

  it("rejects malformed pointers and unsafe release or manifest paths", async () => {
    const root = await temporaryRoot();
    const publicationRoot = join(root, "readiness/publications");
    const releasesRoot = join(publicationRoot, "releases");
    await mkdir(releasesRoot, { recursive: true });
    const pointerPath = join(publicationRoot, "current-publication.json");
    await writeFile(
      pointerPath,
      encoder.encode(`{"schemaVersion":1, "publicationDigest":"${DIGEST}"}\n`),
    );
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    await writeFile(pointerPath, jsonBytes({ schemaVersion: 1, publicationDigest: "invalid" }));
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    await writeFile(pointerPath, renderPublicationPointer(DIGEST));
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    await symlink(root, join(releasesRoot, DIGEST));
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    await rm(join(releasesRoot, DIGEST));
    await mkdir(join(releasesRoot, DIGEST));
    await writeFile(
      join(releasesRoot, DIGEST, "manifest.json"),
      new Uint8Array(PUBLICATION_V1_LIMITS.maxManifestBytes + 1),
    );
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
  });

  it("rejects non-canonical pointers and missing package candidate closure", async () => {
    const root = await temporaryRoot();
    await mkdir(join(root, "readiness/publications/releases"), { recursive: true });
    const pointerPath = join(root, "readiness/publications/current-publication.json");
    await writeFile(
      pointerPath,
      encoder.encode(`{ "schemaVersion": 1, "publicationDigest": "${DIGEST}" }\n`),
    );
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    await writeFile(pointerPath, renderPublicationPointer(DIGEST));
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
  });

  it("rejects malformed and content-address-mismatched manifests before member parsing", async () => {
    const root = await temporaryRoot();
    const releaseRoot = join(root, "readiness/publications/releases", DIGEST);
    await mkdir(releaseRoot, { recursive: true });
    await writeFile(
      join(root, "readiness/publications/current-publication.json"),
      renderPublicationPointer(DIGEST),
    );
    const manifestPath = join(releaseRoot, "manifest.json");
    await writeFile(manifestPath, jsonBytes({ schemaVersion: 1 }));
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    await writeFile(manifestPath, renderPublicationManifest(validManifest()));
    expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    expect(await readFile(manifestPath)).not.toHaveLength(0);
  });

  it("rejects missing, hard-linked, oversized, length-changed and digest-changed members", async () => {
    {
      const { root } = await selectedSkeleton(validManifest());
      expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    }
    {
      const { root, releaseRoot } = await selectedSkeleton(validManifest());
      const memberPath = join(releaseRoot, PUBLICATION_MEMBER_PATHS[0]);
      await writeFile(memberPath, new Uint8Array());
      await link(memberPath, join(releaseRoot, "outside-hardlink"));
      expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    }
    {
      const { root, releaseRoot } = await selectedSkeleton(validManifest());
      await writeFile(
        join(releaseRoot, PUBLICATION_MEMBER_PATHS[0]),
        new Uint8Array(PUBLICATION_V1_LIMITS.maxBindingBytes + 1),
      );
      expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    }
    {
      const { root, releaseRoot } = await selectedSkeleton(validManifest());
      await writeFile(join(releaseRoot, PUBLICATION_MEMBER_PATHS[0]), encoder.encode("changed"));
      expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    }
    {
      const changed = encoder.encode("changed");
      const manifest = validManifest();
      const changedManifest: PublicationManifestV1 = {
        ...manifest,
        members: manifest.members.map((member, index) =>
          index === 0
            ? {
                ...member,
                byteLength: changed.byteLength,
                digest: digestPublicationBytes(encoder.encode("different")),
              }
            : member,
        ),
      };
      const { root, releaseRoot } = await selectedSkeleton(changedManifest);
      await writeFile(join(releaseRoot, PUBLICATION_MEMBER_PATHS[0]), changed);
      expectInvalid(await resolvePublishedSnapshot({ repositoryRoot: root }));
    }
  });

  it("guards direct staged resolution before binding joins", async () => {
    expectInvalid(await resolvePublishedReleaseDigest(".", DIGEST, []));
    const missing = await temporaryRoot();
    expectInvalid(await resolvePublishedReleaseDigest(missing, DIGEST, []));

    const manifest = validManifest();
    const overLimit: PublicationManifestV1 = {
      ...manifest,
      members: manifest.members.map((member, index) =>
        index === 0
          ? {
              ...member,
              byteLength: PUBLICATION_V1_LIMITS.maxBindingBytes + 1,
            }
          : member,
      ),
    };
    const { root } = await selectedSkeleton(overLimit);
    expectInvalid(
      await resolvePublishedReleaseDigest(root, computePublicationDigest(overLimit), []),
    );
  });

  it("fails staged member semantics in deterministic dependency order", async () => {
    const emptyMembers: Map<(typeof PUBLICATION_MEMBER_PATHS)[number], Uint8Array> = new Map(
      PUBLICATION_MEMBER_PATHS.map((path) => [path, new Uint8Array()] as const),
    );
    {
      const staged = await stagedReleaseFromMembers(emptyMembers);
      expectInvalid(await resolvePublishedReleaseDigest(staged.root, staged.publicationDigest, []));
    }

    const strictMembers = new Map(emptyMembers);
    strictMembers.set("rule-models-v1-review.json", jsonBytes({}));
    strictMembers.set("semantic-review-v1.json", jsonBytes({}));
    strictMembers.set("bindings-v1.json", jsonBytes({ schemaVersion: 1, bindings: [] }));
    {
      const staged = await stagedReleaseFromMembers(strictMembers);
      expectInvalid(await resolvePublishedReleaseDigest(staged.root, staged.publicationDigest, []));
    }

    const authorityMembers = new Map(strictMembers);
    authorityMembers.set(
      "compiler-readiness-v1.json",
      await readFile(join(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json")),
    );
    {
      const staged = await stagedReleaseFromMembers(authorityMembers);
      expectInvalid(await resolvePublishedReleaseDigest(staged.root, staged.publicationDigest, []));
    }

    authorityMembers.set(
      "rule-models-v1.json",
      await readFile(join(REPOSITORY_ROOT, "readiness/rule-models/rule-models-v1.json")),
    );
    authorityMembers.set(
      "bindings-v1.json",
      encoder.encode('{ "schemaVersion": 1, "bindings": [] }\n'),
    );
    {
      const staged = await stagedReleaseFromMembers(authorityMembers);
      expectInvalid(await resolvePublishedReleaseDigest(staged.root, staged.publicationDigest, []));
    }

    authorityMembers.set(
      "bindings-v1.json",
      jsonBytes({
        schemaVersion: 1,
        bindings: [
          {
            handlerId: "generator.compiler-cases",
            kind: "generator",
            contractVersion: "1.0.0",
            implementationRevision: DIGEST,
          },
        ],
      }),
    );
    {
      const staged = await stagedReleaseFromMembers(authorityMembers);
      expectInvalid(await resolvePublishedReleaseDigest(staged.root, staged.publicationDigest, []));
    }
  });
});

describe("publication pointer implementation guards", () => {
  it("rejects incomplete releases and unwritable staging roots", async () => {
    const root = await temporaryRoot();
    const incomplete = syntheticRelease(new Map());
    expectInvalid(await promotePublicationRelease(root, incomplete));

    const blockedRoot = await temporaryRoot();
    await writeFile(join(blockedRoot, "readiness"), encoder.encode("not a directory"));
    expectInvalid(await promotePublicationRelease(blockedRoot, syntheticRelease()));
  });

  it("rejects pointer commit before a publication root exists", async () => {
    const root = await temporaryRoot();
    expectInvalid(await commitPublicationPointer(root, syntheticRelease()));
  });

  it("rejects every linked publication parent before writing outside the repository", async () => {
    for (const linkedPath of [
      "readiness",
      "readiness/publications",
      "readiness/publications/releases",
    ]) {
      const root = await temporaryRoot();
      const outside = await temporaryRoot();
      const parent = linkedPath.split("/").slice(0, -1).join("/");
      if (parent !== "") await mkdir(join(root, parent), { recursive: true });
      await symlink(outside, join(root, linkedPath));

      expectInvalid(await promotePublicationRelease(root, syntheticRelease()));
      expect(await readdir(outside)).toEqual([]);
    }
  });

  it("detects release-parent replacement before and after the rename boundary", async () => {
    for (const replacementPoint of ["before-release-rename", "after-release-rename"]) {
      const root = await temporaryRoot();
      const releasesRoot = join(root, "readiness/publications/releases");
      const replacedRoot = join(root, "readiness/publications/replaced-releases");
      const result = await runWithPublicationConformance(
        {
          atFaultPoint: async (point) => {
            if (String(point) !== replacementPoint) return;
            await rename(releasesRoot, replacedRoot);
            await mkdir(releasesRoot);
          },
        },
        () => promotePublicationRelease(root, syntheticRelease()),
      );
      expectInvalid(result);
    }
  });

  it("synchronizes newly created parents and byte-identical reused releases", async () => {
    const root = await temporaryRoot();
    const release = syntheticRelease();
    const creationPoints: string[] = [];
    expect(
      await runWithPublicationConformance(
        {
          atFaultPoint(point) {
            creationPoints.push(point);
          },
        },
        () => promotePublicationRelease(root, release),
      ),
    ).toMatchObject({ ok: true });
    expect(
      creationPoints.filter((point) => point === "after-publication-directory-sync"),
    ).toHaveLength(3);

    const reusePoints: string[] = [];
    expect(
      await runWithPublicationConformance(
        {
          atFaultPoint(point) {
            reusePoints.push(point);
          },
        },
        () => promotePublicationRelease(root, release),
      ),
    ).toMatchObject({
      ok: true,
      value: { reusedExistingRelease: true },
    });
    expect(reusePoints).toContain("after-releases-directory-sync");
  });

  it("cleans staging and pointer temporaries after injected operation failures", async () => {
    const root = await temporaryRoot();
    const promoted = await runWithPublicationConformance(
      {
        atFaultPoint(point) {
          if (point === "after-member-sync") throw new Error("injected");
        },
      },
      () => promotePublicationRelease(root, syntheticRelease()),
    );
    expectInvalid(promoted);

    await mkdir(join(root, "readiness/publications"), { recursive: true });
    const committed = await runWithPublicationConformance(
      {
        atFaultPoint(point) {
          if (point === "after-pointer-temporary-sync") throw new Error("injected");
        },
      },
      () => commitPublicationPointer(root, syntheticRelease()),
    );
    expectInvalid(committed);
  });

  it("classifies unequal existing release layouts and bytes as collisions", async () => {
    const release = syntheticRelease();
    for (const variant of ["extra-name", "wrong-name", "manifest-bytes", "member-bytes"]) {
      const root = await temporaryRoot();
      const releaseRoot = join(root, "readiness/publications/releases", release.publicationDigest);
      await mkdir(releaseRoot, { recursive: true });
      for (const [path, bytes] of release.members) {
        await writeFile(join(releaseRoot, path), bytes);
      }
      await writeFile(join(releaseRoot, "manifest.json"), release.manifestBytes);
      if (variant === "extra-name") {
        await writeFile(join(releaseRoot, "extra"), new Uint8Array());
      } else if (variant === "wrong-name") {
        await rm(join(releaseRoot, PUBLICATION_MEMBER_PATHS[0]));
        await writeFile(join(releaseRoot, "wrong-name"), new Uint8Array());
      } else if (variant === "manifest-bytes") {
        await writeFile(join(releaseRoot, "manifest.json"), encoder.encode("different"));
      } else {
        await writeFile(
          join(releaseRoot, PUBLICATION_MEMBER_PATHS[0]),
          encoder.encode("different"),
        );
      }
      expect(await promotePublicationRelease(root, release)).toMatchObject({
        ok: false,
        kind: "collision",
      });
    }
  });

  it("rejects a byte-identical collision preimage supplied through a member symlink", async () => {
    const root = await temporaryRoot();
    const release = syntheticRelease();
    const releaseRoot = join(root, "readiness/publications/releases", release.publicationDigest);
    await mkdir(releaseRoot, { recursive: true });
    for (const [path, bytes] of release.members) {
      await writeFile(join(releaseRoot, path), bytes);
    }
    await writeFile(join(releaseRoot, "manifest.json"), release.manifestBytes);
    const memberPath = join(releaseRoot, PUBLICATION_MEMBER_PATHS[0]);
    const outsidePath = join(root, "outside-member");
    const expected = release.members.get(PUBLICATION_MEMBER_PATHS[0]);
    if (expected === undefined) throw new TypeError("Synthetic release member is missing.");
    await writeFile(outsidePath, expected);
    await rm(memberPath);
    await symlink(outsidePath, memberPath);

    expect(await promotePublicationRelease(root, release)).toMatchObject({
      ok: false,
      kind: "collision",
    });
  });
});

describe("publication filesystem identity guards", () => {
  it("pins, synchronizes and detects replacement of real directories", async () => {
    const root = await temporaryRoot();
    const pinnedRoot = await pinPublicationDirectory(root);
    expect(pinnedRoot).toMatchObject({ ok: true });
    if (!pinnedRoot.ok) throw new TypeError("Temporary root was not pinned.");
    const rootIdentity = pinnedRoot.value;

    expectInvalid(await pinPublicationDirectory(join(root, "missing")));
    const ordinaryFile = join(root, "ordinary");
    await writeFile(ordinaryFile, encoder.encode("file"));
    expectInvalid(await pinPublicationDirectory(ordinaryFile));
    const linkedDirectory = join(root, "linked-directory");
    await symlink(root, linkedDirectory);
    expectInvalid(await pinPublicationDirectory(linkedDirectory));
    for (const name of ["", ".", "..", "nested/child", "nested\\child"]) {
      expectInvalid(await ensurePublicationChildDirectory(rootIdentity, name));
    }
    expectInvalid(
      await verifyPublicationDirectory({
        ...rootIdentity,
        device: rootIdentity.device + 1n,
      }),
    );
    expectInvalid(
      await verifyPublicationDirectory({
        ...rootIdentity,
        inode: rootIdentity.inode + 1n,
      }),
    );

    const child = await ensurePublicationChildDirectory(rootIdentity, "child");
    expect(child).toMatchObject({ ok: true, value: { created: true } });
    if (!child.ok) throw new TypeError("Child directory was not created.");
    expect(await ensurePublicationChildDirectory(rootIdentity, "child")).toMatchObject({
      ok: true,
      value: { created: false },
    });
    expect(await syncPublicationDirectory(child.value.identity)).toMatchObject({ ok: true });

    await rename(join(root, "child"), join(root, "replaced-child"));
    await mkdir(join(root, "child"));
    expectInvalid(await verifyPublicationDirectory(child.value.identity));
    expectInvalid(await syncPublicationDirectory(child.value.identity));
  });

  it("bounds regular-file reads and rejects linked or unequal identities", async () => {
    const root = await temporaryRoot();
    const pinned = await pinPublicationDirectory(root);
    if (!pinned.ok) throw new TypeError("Temporary root was not pinned.");
    const bytes = encoder.encode("guarded");

    for (const name of ["", ".", "..", "nested/member", "nested\\member"]) {
      expectInvalid(await writePublicationRegularFile(pinned.value, name, bytes));
    }
    expect(await writePublicationRegularFile(pinned.value, "member", bytes)).toMatchObject({
      ok: true,
    });
    expect(
      await writePublicationRegularFile(pinned.value, "mode-member", bytes, 0o640),
    ).toMatchObject({ ok: true });
    expectInvalid(await writePublicationRegularFile(pinned.value, "member", bytes));
    expect(await readPublicationRegularFile(join(root, "member"), bytes.byteLength)).toMatchObject({
      ok: true,
      value: { size: bytes.byteLength },
    });
    expectInvalid(
      await readPublicationRegularFile(
        join(root, "member"),
        bytes.byteLength,
        bytes.byteLength + 1,
      ),
    );
    expectInvalid(await readPublicationRegularFile(join(root, "member"), bytes.byteLength - 1));
    expectInvalid(await readPublicationRegularFile(join(root, "missing"), bytes.byteLength));
    expectInvalid(await readPublicationRegularFile(root, bytes.byteLength));

    await link(join(root, "member"), join(root, "member-link"));
    expectInvalid(await readPublicationRegularFile(join(root, "member"), bytes.byteLength));
    await rm(join(root, "member"));
    await rm(join(root, "member-link"));
    await symlink(root, join(root, "member"));
    expectInvalid(await readPublicationRegularFile(join(root, "member"), bytes.byteLength));
  });

  it("bounds enumeration, renames within pinned parents and guards cleanup names", async () => {
    const root = await temporaryRoot();
    const pinned = await pinPublicationDirectory(root);
    if (!pinned.ok) throw new TypeError("Temporary root was not pinned.");
    const left = await ensurePublicationChildDirectory(pinned.value, "left");
    const right = await ensurePublicationChildDirectory(pinned.value, "right");
    if (!left.ok || !right.ok) throw new TypeError("Child directories were not created.");
    await writeFile(join(left.value.identity.path, "one"), encoder.encode("1"));
    await writeFile(join(left.value.identity.path, "two"), encoder.encode("2"));

    expectInvalid(await readPublicationDirectoryNames(left.value.identity, 1));
    expect(await readPublicationDirectoryNames(left.value.identity, 2)).toMatchObject({
      ok: true,
      value: expect.arrayContaining(["one", "two"]),
    });
    expectInvalid(
      await renamePublicationEntry(left.value.identity, "..", right.value.identity, "one"),
    );
    expectInvalid(
      await renamePublicationEntry(left.value.identity, "one", right.value.identity, ".."),
    );
    expect(
      await renamePublicationEntry(left.value.identity, "one", right.value.identity, "one"),
    ).toMatchObject({ ok: true });
    expectInvalid(
      await renamePublicationEntry(left.value.identity, "missing", right.value.identity, "x"),
    );
    await mkdir(join(left.value.identity.path, "source-directory"));
    await mkdir(join(right.value.identity.path, "destination-directory"));
    await writeFile(
      join(right.value.identity.path, "destination-directory", "occupied"),
      encoder.encode("occupied"),
    );
    expect(
      await renamePublicationEntry(
        left.value.identity,
        "source-directory",
        right.value.identity,
        "destination-directory",
      ),
    ).toMatchObject({ ok: false, kind: "collision" });
    expectInvalid(await removePublicationEntry(right.value.identity, ".."));
    expectInvalid(
      await removePublicationEntry(
        {
          ...right.value.identity,
          inode: right.value.identity.inode + 1n,
        },
        "one",
      ),
    );
    expect(await removePublicationEntry(right.value.identity, "one")).toMatchObject({ ok: true });
  });

  it("detects injected substitutions and classifies unsupported synchronization", async () => {
    {
      const root = await temporaryRoot();
      const target = join(root, "target");
      await mkdir(target);
      let replaced = false;
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point, context) {
            if (point !== "after-directory-lstat" || context.path !== target || replaced) return;
            replaced = true;
            await rename(target, join(root, "old-target"));
            await mkdir(target);
          },
        },
        () => pinPublicationDirectory(target),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const directoryResult = await runWithPublicationConformance(
        {
          atFilesystemPoint(point) {
            if (point === "after-directory-lstat") {
              throw Object.assign(new Error("linked"), { code: "ELOOP" });
            }
          },
        },
        () => pinPublicationDirectory(root),
      );
      expect(directoryResult).toMatchObject({
        ok: false,
        diagnostics: [{ code: "publication.path.invalid" }],
      });
      const member = join(root, "member");
      await writeFile(member, encoder.encode("member"));
      const fileResult = await runWithPublicationConformance(
        {
          atFilesystemPoint(point) {
            if (point === "after-file-lstat") {
              throw Object.assign(new Error("linked"), { code: "ELOOP" });
            }
          },
        },
        () => readPublicationRegularFile(member, 16),
      );
      expect(fileResult).toMatchObject({
        ok: false,
        diagnostics: [{ code: "publication.path.invalid" }],
      });
    }

    {
      const root = await temporaryRoot();
      const pinned = await pinPublicationDirectory(root);
      if (!pinned.ok) throw new TypeError("Temporary root was not pinned.");
      const result = await runWithPublicationConformance(
        {
          atFilesystemPoint(point) {
            if (point !== "before-directory-sync") return;
            throw Object.assign(new Error("unsupported"), { code: "EINVAL" });
          },
        },
        () => syncPublicationDirectory(pinned.value),
      );
      expect(result).toMatchObject({
        ok: false,
        kind: "durability-unsupported",
        diagnostics: [{ code: "publication.durability-unsupported" }],
      });
    }

    {
      const root = await temporaryRoot();
      const path = join(root, "member");
      await writeFile(path, encoder.encode("first"));
      await writeFile(join(root, "replacement"), encoder.encode("second"));
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point) {
            if (point !== "after-file-lstat") return;
            await rename(path, join(root, "old-member"));
            await rename(join(root, "replacement"), path);
          },
        },
        () => readPublicationRegularFile(path, 16),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const path = join(root, "member");
      await writeFile(path, encoder.encode("member"));
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point) {
            if (point === "after-file-open") {
              await link(path, join(root, "member-hardlink"));
            }
          },
        },
        () => readPublicationRegularFile(path, 16),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const path = join(root, "member");
      await writeFile(path, encoder.encode("member"));
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point) {
            if (point === "before-file-read") await writeFile(path, new Uint8Array());
          },
        },
        () => readPublicationRegularFile(path, 16),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const pinned = await pinPublicationDirectory(root);
      if (!pinned.ok) throw new TypeError("Temporary root was not pinned.");
      expectInvalid(
        await syncPublicationDirectory({
          ...pinned.value,
          inode: pinned.value.inode + 1n,
        }),
      );
      expectInvalid(
        await ensurePublicationChildDirectory(
          { ...pinned.value, inode: pinned.value.inode + 1n },
          "child",
        ),
      );
      await writeFile(join(root, "file-child"), encoder.encode("file"));
      expectInvalid(await ensurePublicationChildDirectory(pinned.value, "file-child"));
      expectInvalid(await ensurePublicationChildDirectory(pinned.value, "bad-mode", -1));
      expectInvalid(
        await writePublicationRegularFile(
          { ...pinned.value, inode: pinned.value.inode + 1n },
          "member",
          encoder.encode("member"),
        ),
      );
      expectInvalid(
        await readPublicationDirectoryNames({ ...pinned.value, inode: pinned.value.inode + 1n }, 1),
      );
      expectInvalid(
        await renamePublicationEntry(
          { ...pinned.value, inode: pinned.value.inode + 1n },
          "file-child",
          pinned.value,
          "renamed",
        ),
      );
    }

    {
      const root = await temporaryRoot();
      const pinned = await pinPublicationDirectory(root);
      if (!pinned.ok) throw new TypeError("Temporary root was not pinned.");
      const path = join(root, "member");
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point) {
            if (point === "after-file-sync") {
              await writeFile(path, encoder.encode("changed-after-sync"));
            }
          },
        },
        () => writePublicationRegularFile(pinned.value, "member", encoder.encode("bytes")),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const pinned = await pinPublicationDirectory(root);
      if (!pinned.ok) throw new TypeError("Temporary root was not pinned.");
      const path = join(root, "member");
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point) {
            if (point === "after-output-open") {
              await link(path, join(root, "member-hardlink"));
            }
          },
        },
        () => writePublicationRegularFile(pinned.value, "member", encoder.encode("bytes")),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const oldRoot = `${root}-old`;
      temporaryRoots.push(oldRoot);
      const pinned = await pinPublicationDirectory(root);
      if (!pinned.ok) throw new TypeError("Temporary root was not pinned.");
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point) {
            if (point !== "after-file-sync") return;
            await rename(root, oldRoot);
            await mkdir(root);
          },
        },
        () => writePublicationRegularFile(pinned.value, "member", encoder.encode("bytes")),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const path = join(root, "member");
      await writeFile(path, encoder.encode("first"));
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point) {
            if (point === "after-file-read") await writeFile(path, encoder.encode("changed-size"));
          },
        },
        () => readPublicationRegularFile(path, 16),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const pinned = await pinPublicationDirectory(root);
      if (!pinned.ok) throw new TypeError("Temporary root was not pinned.");
      const path = join(root, "member");
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point) {
            if (point !== "after-file-sync") return;
            await rename(path, join(root, "old-member"));
            await symlink(root, path);
          },
        },
        () => writePublicationRegularFile(pinned.value, "member", encoder.encode("bytes")),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const childPath = join(root, "child");
      await mkdir(childPath);
      await writeFile(join(childPath, "entry"), encoder.encode("entry"));
      const child = await pinPublicationDirectory(childPath);
      if (!child.ok) throw new TypeError("Child directory was not pinned.");
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point) {
            if (point !== "after-directory-enumeration") return;
            await rename(childPath, join(root, "old-child"));
            await mkdir(childPath);
          },
        },
        () => readPublicationDirectoryNames(child.value, 2),
      );
      expectInvalid(result);
    }

    {
      const root = await temporaryRoot();
      const pinned = await pinPublicationDirectory(root);
      if (!pinned.ok) throw new TypeError("Temporary root was not pinned.");
      await writeFile(join(root, "member"), encoder.encode("member"));
      const result = await runWithPublicationConformance(
        {
          atFilesystemPoint(point) {
            if (point === "before-remove") throw new Error("blocked");
          },
        },
        () => removePublicationEntry(pinned.value, "member"),
      );
      expect(result).toMatchObject({
        ok: false,
        kind: "io",
        diagnostics: [{ code: "publication.io" }],
      });
    }
  });
});

describe("publication capability and module-boundary guards", () => {
  it("keeps forged snapshot and duplicate lookup installation inert", () => {
    expect(Reflect.apply(getPublishedBinding, undefined, [null, "handler"])).toBeUndefined();
    expect(Reflect.apply(getPublishedBinding, undefined, [{}, 1])).toBeUndefined();
    expect(Reflect.apply(getPublishedInventory, undefined, [null])).toBeUndefined();
    expect(Reflect.apply(getPublishedMetadata, undefined, [null])).toBeUndefined();
    expect(Reflect.apply(getPublishedBindingRows, undefined, [null])).toBeUndefined();
    expect(Reflect.apply(getPublishedSnapshotAuthority, undefined, [null])).toBeUndefined();
    expect(Reflect.apply(getPublishedBindingRows, undefined, [{}])).toBeUndefined();
    expect(Reflect.apply(getPublishedSnapshotAuthority, undefined, [{}])).toBeUndefined();
    expect(() => installPublishedBindingLookup(() => undefined)).toThrow(
      "Published binding lookup is already installed.",
    );
  });

  it("rejects hostile and absent named-release inputs without reading the selected pointer", async () => {
    const root = await temporaryRoot();
    await mkdir(join(root, "readiness/publications/releases"), { recursive: true });
    const invalidInputs: readonly unknown[] = [
      null,
      [],
      {},
      { repositoryRoot: root },
      { repositoryRoot: root, publicationDigest: "invalid" },
      { repositoryRoot: root, publicationDigest: DIGEST, extra: true },
      Object.defineProperty(
        { repositoryRoot: root, publicationDigest: DIGEST },
        "publicationDigest",
        {
          enumerable: true,
          get(): never {
            throw new Error("must not execute");
          },
        },
      ),
    ];
    const revoked = Proxy.revocable({ repositoryRoot: root, publicationDigest: DIGEST }, {});
    revoked.revoke();
    for (const input of invalidInputs) {
      const result = await Reflect.apply(resolvePublishedSnapshotByDigest, undefined, [input]);
      expect(result).toMatchObject({
        ok: false,
        kind: "invalid",
        diagnostics: [{ code: "publication.input.invalid" }],
      });
    }
    expect(
      await Reflect.apply(resolvePublishedSnapshotByDigest, undefined, [revoked.proxy]),
    ).toMatchObject({
      ok: false,
      kind: "invalid",
      diagnostics: [{ code: "publication.input.invalid" }],
    });
    expect(
      await resolvePublishedSnapshotByDigest({
        repositoryRoot: ".",
        publicationDigest: DIGEST,
      }),
    ).toMatchObject({
      ok: false,
      kind: "invalid",
      diagnostics: [{ code: "publication.path.invalid" }],
    });

    expect(
      await resolvePublishedSnapshotByDigest({
        repositoryRoot: root,
        publicationDigest: DIGEST,
      }),
    ).toMatchObject({
      ok: false,
      kind: "not-found",
      diagnostics: [{ code: "publication.release.not-found" }],
    });
    const nonDirectoryRoot = await temporaryRoot();
    await mkdir(join(nonDirectoryRoot, "readiness/publications"), { recursive: true });
    await writeFile(join(nonDirectoryRoot, "readiness/publications/releases"), new Uint8Array());
    expect(
      await resolvePublishedSnapshotByDigest({
        repositoryRoot: nonDirectoryRoot,
        publicationDigest: DIGEST,
      }),
    ).toMatchObject({
      ok: false,
      kind: "not-found",
      diagnostics: [{ code: "publication.release.not-found" }],
    });
    await symlink(root, join(root, "readiness/publications/releases", DIGEST));
    expect(
      await resolvePublishedSnapshotByDigest({
        repositoryRoot: root,
        publicationDigest: DIGEST,
      }),
    ).toMatchObject({
      ok: false,
      kind: "invalid",
      diagnostics: [{ code: "publication.path.invalid" }],
    });
  });

  it("rejects unbounded, duplicate and authority-leaking production-file records", () => {
    expectInvalid(
      validatePublicationModuleBoundary(
        Array.from({ length: 513 }, (_, index) => ({
          path: `file-${index}.ts`,
          source: "",
        })),
      ),
    );
    expectInvalid(
      validatePublicationModuleBoundary([
        { path: "same.ts", source: "" },
        { path: "same.ts", source: "" },
      ]),
    );
    expectInvalid(
      validatePublicationModuleBoundary([
        { path: "ordinary.ts", source: 'const path = "readiness/publications";' },
      ]),
    );
    expectInvalid(
      validatePublicationModuleBoundary([
        { path: "ordinary.ts", source: "const forged: PublishedSnapshot = {};" },
      ]),
    );
    expect(
      validatePublicationModuleBoundary([
        { path: "publication-resolver.ts", source: 'const path = "readiness/publications";' },
      ]),
    ).toMatchObject({ ok: true });
    expectInvalid(
      validatePublicationModuleBoundary([
        {
          path: "nested/publication-resolver.ts",
          source: 'const path = "readiness/publications";',
        },
      ]),
    );
  });

  it("validates the complete real production source closure", async () => {
    const sourceRoot = join(REPOSITORY_ROOT, "packages/readiness/src");
    const entries = await readdir(sourceRoot, { recursive: true, withFileTypes: true });
    const paths = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          extname(entry.name) === ".ts" &&
          !entry.name.endsWith(".test.ts") &&
          !entry.parentPath.includes(`${join("src", "test-fixtures")}`),
      )
      .map((entry) => join(entry.parentPath, entry.name))
      .sort();
    const files = await Promise.all(
      paths.map(async (path) => ({
        path: relative(sourceRoot, path).replaceAll("\\", "/"),
        source: await readFile(path, "utf8"),
      })),
    );

    expect(files.length).toBeGreaterThan(50);
    expect(files.map(({ path }) => path)).toContain("publication-model.ts");
    expect(validatePublicationModuleBoundary(files)).toMatchObject({ ok: true });
  });

  it("fails closed for invalid preparation roots and missing package source closure", async () => {
    expectInvalid(await prepareBindingPublicationReview({ repositoryRoot: "." }));
    expectInvalid(
      await prepareBindingPublicationReview({
        repositoryRoot: "/definitely/missing/blend65-readiness-root",
      }),
    );
    const root = await temporaryRoot();
    const linkPath = `${root}-prepare-link`;
    temporaryRoots.push(linkPath);
    await symlink(root, linkPath);
    expectInvalid(await prepareBindingPublicationReview({ repositoryRoot: linkPath }));
    expectInvalid(await prepareBindingPublicationReview({ repositoryRoot: root }));
    expectInvalid(await loadPublicationCandidateCatalog(root));
  });
});
