import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSourceRepository, fragmentSource, INVENTORY_V1_LIMITS } from "./index.js";
import { contentHash, sectionIdentity } from "./source-bytes.js";

const PROFILE = {
  profileId: "markdown-ebnf-v1",
  version: 1,
  contentHashAlgorithm: "sha256",
  newlinePolicy: "lf",
} as const;
const encoder = new TextEncoder();
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("fragment scanner internals", () => {
  it("should reject unsupported profiles and non-canonical source paths", () => {
    const unsupportedProfile = { ...PROFILE };
    Object.defineProperty(unsupportedProfile, "version", { value: 2 });
    const unsupported = fragmentSource(
      { path: "spec/file.md", bytes: encoder.encode("# File\n") },
      unsupportedProfile,
      INVENTORY_V1_LIMITS,
    );
    const unsafe = fragmentSource(
      { path: "../file.md", bytes: encoder.encode("# File\n") },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    expect(unsupported).toEqual(expect.objectContaining({ ok: false, fragments: [] }));
    expect(unsafe).toEqual(expect.objectContaining({ ok: false, fragments: [] }));
  });

  it("should enforce the fragment limit at the exact boundary", () => {
    const source = { path: "spec/limit.md", bytes: encoder.encode("# One\n# Two\n") };
    expect(fragmentSource(source, PROFILE, { ...INVENTORY_V1_LIMITS, maxFragments: 2 }).ok).toBe(
      true,
    );
    expect(fragmentSource(source, PROFILE, { ...INVENTORY_V1_LIMITS, maxFragments: 1 })).toEqual(
      expect.objectContaining({ ok: false, fragments: [] }),
    );
  });

  it("should normalize BOM, newline form, and canonical Unicode for hashes only", () => {
    const composed = encoder.encode("# Café\n");
    const decomposedCrLf = Uint8Array.from(
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("# Cafe\u0301\r\n")]),
    );

    expect(contentHash(decomposedCrLf.subarray(0, decomposedCrLf.length - 2), true)).toBe(
      contentHash(composed.subarray(0, composed.length - 1), true),
    );
  });

  it("should keep trailing horizontal whitespace significant", () => {
    expect(contentHash(encoder.encode("value"), false)).not.toBe(
      contentHash(encoder.encode("value "), false),
    );
  });

  it("should normalize ancestry Unicode in section identities", () => {
    expect(sectionIdentity(["Café"], 0)).toBe(sectionIdentity(["Cafe\u0301"], 0));
    expect(sectionIdentity(["Café"], 0)).not.toBe(sectionIdentity(["Café"], 1));
  });

  it("should distinguish repeated identical fragments by scan occurrence", () => {
    const result = fragmentSource(
      { path: "spec/repeated.md", bytes: encoder.encode("# A\nsame\n\nsame\n") },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );
    const paragraphs = result.fragments.filter((fragment) => fragment.kind === "paragraph");

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.contentHash).toBe(paragraphs[1]?.contentHash);
    expect(paragraphs[0]?.fragmentId).not.toBe(paragraphs[1]?.fragmentId);
  });

  it("should reject malformed UTF-8 without partial fragments", () => {
    const result = fragmentSource(
      { path: "spec/invalid.md", bytes: Uint8Array.from([0xc3, 0x28]) },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        fragments: [],
        diagnostics: [expect.objectContaining({ code: "source.invalid-utf8" })],
      }),
    );
  });

  it("should reject a source before scanning when its byte limit is exceeded", () => {
    const result = fragmentSource(
      { path: "spec/large.md", bytes: encoder.encode("12345") },
      PROFILE,
      { ...INVENTORY_V1_LIMITS, maxInputBytes: 4 },
    );

    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "source.byte-limit" })]);
  });

  it("should account non-EBNF fences as residual source", () => {
    const result = fragmentSource(
      { path: "spec/code.md", bytes: encoder.encode("```ts\nconst x = 1;\n```\n") },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    expect(result.fragments.map((fragment) => fragment.kind)).toEqual([
      "residual",
      "paragraph",
      "residual",
    ]);
  });

  it("should trim closing heading markers and maintain nested ancestry", () => {
    const result = fragmentSource(
      { path: "spec/headings.md", bytes: encoder.encode("# Root ###\n## Child\n###\n") },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    expect(result.fragments.map((fragment) => fragment.headingAncestry)).toEqual([
      ["Root"],
      ["Root", "Child"],
      ["Root", "Child", ""],
    ]);
  });

  it("should recognize numeric items and stop continuations at a heading", () => {
    const result = fragmentSource(
      {
        path: "spec/list.md",
        bytes: encoder.encode("1) item\n   continuation\n# Heading\n"),
      },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    expect(result.fragments.map((fragment) => fragment.kind)).toEqual(["list-item", "heading"]);
  });

  it("should treat thematic breaks and block syntax as residual", () => {
    const result = fragmentSource(
      { path: "spec/residual.md", bytes: encoder.encode("---\n> quote\n<tag>\n") },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    expect(result.fragments.map((fragment) => fragment.kind)).toEqual([
      "residual",
      "residual",
      "residual",
    ]);
  });

  it("should parse a tilde fence case-insensitively and allow a longer closer", () => {
    const result = fragmentSource(
      {
        path: "spec/tilde.md",
        bytes: encoder.encode('~~~ EBNF\nrule = "\\\\\\";" ;\n~~~~\n'),
      },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    expect(result.fragments.map((fragment) => fragment.kind)).toEqual([
      "ebnf-fence",
      "residual",
      "ebnf-production",
      "residual",
    ]);
  });

  it("should extend an unterminated production to the last fence content line", () => {
    const result = fragmentSource(
      {
        path: "spec/open-production.md",
        bytes: encoder.encode("```ebnf\nrule = first\n  second\n"),
      },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    const fence = result.fragments.find((fragment) => fragment.kind === "ebnf-fence");
    const production = result.fragments.find((fragment) => fragment.kind === "ebnf-production");

    expect(production).toEqual(expect.objectContaining({ endByte: 29 }));
    expect(production?.startByte).toBeGreaterThanOrEqual(
      fence?.startByte ?? Number.MAX_SAFE_INTEGER,
    );
    expect(production?.endByte).toBeLessThanOrEqual(fence?.endByte ?? -1);
  });

  it("should preserve non-whitespace after an EBNF production terminator", () => {
    const result = fragmentSource(
      {
        path: "spec/suffix.md",
        bytes: encoder.encode('```ebnf\nrule = "x"; trailing\n```\n'),
      },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    const residualText = result.fragments
      .filter((fragment) => fragment.kind === "residual")
      .map((fragment) =>
        new TextDecoder().decode(
          encoder
            .encode('```ebnf\nrule = "x"; trailing\n```\n')
            .subarray(fragment.startByte, fragment.endByte),
        ),
      );
    expect(residualText).toContain("trailing");
  });

  it("should count canonically equivalent repeated headings as occurrences of one section", () => {
    const result = fragmentSource(
      { path: "spec/unicode.md", bytes: encoder.encode("# Café\n# Cafe\u0301\n") },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );
    const headings = result.fragments.filter((fragment) => fragment.kind === "heading");

    expect(headings).toHaveLength(2);
    expect(headings[0]?.sectionIdentity).not.toBe(headings[1]?.sectionIdentity);
  });

  it("should leave a non-table delimiter candidate as a paragraph", () => {
    const result = fragmentSource(
      { path: "spec/not-table.md", bytes: encoder.encode("A | B\n-- | --\n") },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0]?.kind).toBe("paragraph");
  });

  it("should support tables without outer pipes and empty cells", () => {
    const result = fragmentSource(
      { path: "spec/table.md", bytes: encoder.encode("A |  | B\n---|---|---\nx || y\n") },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );

    expect(result.fragments.filter((fragment) => fragment.kind === "table-row")).toHaveLength(3);
    expect(result.fragments.filter((fragment) => fragment.kind === "table-cell")).toHaveLength(7);
  });

  it("should remove at most one ASCII space from table cells and preserve tabs", () => {
    const text = "A |  B\t | C\n---|---|---\n";
    const bytes = encoder.encode(text);
    const result = fragmentSource(
      { path: "spec/table-spacing.md", bytes },
      PROFILE,
      INVENTORY_V1_LIMITS,
    );
    const cells = result.fragments
      .filter((fragment) => fragment.kind === "table-cell")
      .map((fragment) =>
        new TextDecoder().decode(bytes.subarray(fragment.startByte, fragment.endByte)),
      );

    expect(cells).toContain(" B\t");
  });
});

describe("source repository resource accounting", () => {
  it("should enforce the aggregate byte budget across distinct files", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-readiness-aggregate-"));
    temporaryRoots.push(root);
    await mkdir(join(root, "spec"));
    await writeFile(join(root, "spec/a.md"), "123");
    await writeFile(join(root, "spec/b.md"), "456");
    const repository = await createSourceRepository({
      repositoryRoot: root,
      specRoot: join(root, "spec"),
      limits: { ...INVENTORY_V1_LIMITS, maxInputBytes: 5 },
    });

    await expect(repository.read("spec/a.md")).resolves.toEqual(
      expect.objectContaining({ path: "spec/a.md" }),
    );
    await expect(repository.read("spec/b.md")).rejects.toThrow(/aggregate/i);
  });

  it("should not double-count a cached canonical source", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-readiness-cache-"));
    temporaryRoots.push(root);
    await mkdir(join(root, "spec"));
    await writeFile(join(root, "spec/a.md"), "123");
    const repository = await createSourceRepository({
      repositoryRoot: root,
      specRoot: join(root, "spec"),
      limits: { ...INVENTORY_V1_LIMITS, maxInputBytes: 3 },
    });

    const first = await repository.read("spec/a.md");
    await expect(repository.read("spec/a.md")).resolves.toEqual(first);
  });

  it("should share one bounded read across concurrent callers", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-readiness-concurrent-"));
    temporaryRoots.push(root);
    await mkdir(join(root, "spec"));
    await writeFile(join(root, "spec/a.md"), "123");
    const repository = await createSourceRepository({
      repositoryRoot: root,
      specRoot: join(root, "spec"),
      limits: { ...INVENTORY_V1_LIMITS, maxInputBytes: 3 },
    });

    const [first, second] = await Promise.all([
      repository.read("spec/a.md"),
      repository.read("spec/a.md"),
    ]);
    expect(second).toEqual(first);
  });

  it("should reject an allowed root outside the repository root", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-readiness-root-"));
    const outside = await mkdtemp(join(tmpdir(), "blend65-readiness-outside-"));
    temporaryRoots.push(root, outside);

    await expect(
      createSourceRepository({
        repositoryRoot: root,
        specRoot: outside,
        limits: INVENTORY_V1_LIMITS,
      }),
    ).rejects.toThrow(/inside/i);
  });
});
