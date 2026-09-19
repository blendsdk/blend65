import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProject } from "../index.js";
import type { ProjectSnapshot, SourceRecord, SourceSpan } from "../project/types.js";
import { analyzeProject } from "./service.js";

const temporaryRoots: string[] = [];

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(sourceId: string, text: string, checkout = "/checkout"): SourceRecord {
  return {
    sourceId,
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: `${checkout}/${sourceId}`,
  };
}

function snapshot(
  sources: readonly SourceRecord[],
  options: { readonly target?: string; readonly checkout?: string } = {},
): ProjectSnapshot {
  const checkout = options.checkout ?? "/checkout";
  const manifestText = "{}";
  return {
    manifest: {
      schemaVersion: 1,
      name: "service-spec",
      sourceRoot: "src",
      entry: "Game",
      target: options.target ?? "test.target",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: source("blend65.json", manifestText, checkout),
    sources,
    inputSha256: hash(JSON.stringify(sources.map(({ sourceId, sha256 }) => [sourceId, sha256]))),
    projectRoot: checkout,
    sourceRoot: `${checkout}/src`,
    assetPaths: [],
    outDir: `${checkout}/out`,
    overrides: { target: null, entry: null },
    effectiveTarget: options.target ?? "test.target",
    effectiveEntry: "Game",
  };
}

function spanOf(sourceId: string, text: string, fragment: string): SourceSpan {
  const characterStart = text.indexOf(fragment);
  if (characterStart < 0) throw new Error(`Missing fixture fragment ${JSON.stringify(fragment)}`);
  const start = Buffer.byteLength(text.slice(0, characterStart), "utf8");
  return { sourceId, start, end: start + Buffer.byteLength(fragment, "utf8") };
}

function expectSafeObligation(obligation: {
  readonly span: SourceSpan | null;
  readonly message: string;
}): void {
  expect(obligation.span).not.toBeNull();
  expect(obligation.message.trim().length).toBeGreaterThan(0);
  expect(obligation.message).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u);
  expect(obligation.message).not.toMatch(/\n\s+at (?:\S+|file:)/u);
}

function expectSpanCovers(span: SourceSpan | null, expected: SourceSpan): void {
  expect(span).not.toBeNull();
  expect(span?.sourceId).toBe(expected.sourceId);
  expect(span?.start).toBeLessThanOrEqual(expected.start);
  expect(span?.end).toBeGreaterThanOrEqual(expected.end);
}

async function put(root: string, name: string, text: string): Promise<void> {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

async function tree(root: string): Promise<Readonly<Record<string, string>>> {
  const entries: Record<string, string> = {};
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else entries[relative(root, path)] = hash(await readFile(path, "utf8"));
    }
  }
  await visit(root);
  return entries;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("analysis service result states", () => {
  // An admitted program is exposed only after every required check has finished successfully.
  it("returns a complete result with a typed program for an ordinary main", () => {
    const text = "module Game; function main(): void {}";
    const result = analyzeProject(snapshot([source("src/game.blend", text)]));

    expect(result.kind).toBe("complete");
    expect(result.diagnostics).toEqual([]);
    expect(result).toHaveProperty("program");
    expect(result).not.toHaveProperty("obligations");
  });

  it.each([
    {
      name: "aggregate return",
      text: "module Game; struct Pair { x: byte; } function make(): Pair { return { x: 1 }; } function main(): void {}",
      kind: "implementation",
      fragment: "function make(): Pair { return { x: 1 }; }",
    },
    {
      name: "embedded asset",
      text: 'module Game; const DATA: byte[] = embed("table.bin"); function main(): void {}',
      kind: "asset",
      fragment: 'embed("table.bin")',
    },
    {
      name: "character encoding",
      text: "module Game; function main(): void { let x: byte = 'A'; }",
      kind: "profile",
      fragment: "'A'",
    },
    {
      name: "profile module",
      text: "module Game; import { setIRQ } from c64.system; function main(): void {}",
      kind: "profile",
      fragment: "c64.system",
    },
  ] as const)(
    "returns incomplete with a proving obligation for $name",
    ({ text, kind, fragment }) => {
      const sourceId = "src/game.blend";
      const result = analyzeProject(snapshot([source(sourceId, text)]));

      expect(result.kind).toBe("incomplete");
      expect(result).not.toHaveProperty("program");
      if (result.kind !== "incomplete") throw new Error(`Expected incomplete, got ${result.kind}`);
      const obligation = result.obligations.find((candidate) => candidate.kind === kind);
      expect(obligation).toBeDefined();
      if (obligation === undefined) throw new Error(`Missing ${kind} obligation`);
      expectSafeObligation(obligation);
      expectSpanCovers(obligation.span, spanOf(sourceId, text, fragment));
      expect(result.diagnostics.map(({ code }) => code)).not.toEqual(
        expect.arrayContaining(["E10093", "E10120"]),
      );
    },
  );

  // Pending support wins the result discriminator without hiding an independently proved name error.
  it("keeps an independent undeclared-name diagnostic when unsupported work remains", () => {
    const text = [
      "module Game;",
      "struct Pair { x: byte; }",
      "function make(): Pair { return { x: 1 }; }",
      "function main(): void { missingName; }",
    ].join("\n");
    const result = analyzeProject(snapshot([source("src/game.blend", text)]));

    expect(result.kind).toBe("incomplete");
    expect(result).not.toHaveProperty("program");
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10239");
    expect(result.diagnostics.map(({ code }) => code)).not.toEqual(
      expect.arrayContaining(["E10093", "E10120"]),
    );
    if (result.kind !== "incomplete") throw new Error(`Expected incomplete, got ${result.kind}`);
    expect(result.obligations).toContainEqual(
      expect.objectContaining({ kind: "implementation", span: expect.any(Object) }),
    );
  });
});

describe("diagnostic retention and limits", () => {
  // Independent errors survive and sort by stable source span and code on every analysis.
  it("retains independent errors in deterministic order across repeated analysis", () => {
    const gameText = "module Game; function main(): void { missingGame; Other.f(); }";
    const otherText = "module Other; export function f(): void { missingOther; }";
    const project = snapshot([
      source("src/z-game.blend", gameText),
      source("src/a-other.blend", otherText),
    ]);
    const first = analyzeProject(project);
    const second = analyzeProject(project);
    const stable = (result: typeof first) =>
      result.diagnostics.map(({ code, primarySpan }) => ({ code, primarySpan }));

    expect(first.kind).toBe("error");
    expect(first).not.toHaveProperty("program");
    expect(stable(first)).toEqual([
      { code: "E10239", primarySpan: spanOf("src/a-other.blend", otherText, "missingOther") },
      { code: "E10239", primarySpan: spanOf("src/z-game.blend", gameText, "missingGame") },
    ]);
    expect(stable(second)).toEqual(stable(first));
  });

  // Reaching the error cap leaves unproved work explicit instead of claiming a finished invalid result.
  it("caps twenty-one independent errors and reports unfinished checking", () => {
    const reads = Array.from({ length: 21 }, (_, index) => `missing${index};`).join(" ");
    const text = `module Game; function main(): void { ${reads} }`;
    const result = analyzeProject(snapshot([source("src/game.blend", text)]));

    expect(result.kind).toBe("incomplete");
    expect(result).not.toHaveProperty("program");
    expect(result.diagnostics).toHaveLength(20);
    expect(result.diagnostics.every(({ code }) => code === "E10239")).toBe(true);
    if (result.kind !== "incomplete") throw new Error(`Expected incomplete, got ${result.kind}`);
    expect(result.obligations).toContainEqual(
      expect.objectContaining({ kind: "analysis-limit", message: expect.any(String) }),
    );
  });

  // Safe recovery preserves the later declaration and name error alongside the root syntax error.
  it("retains syntax and semantic diagnostics after safe missing-semicolon recovery", () => {
    const text =
      "module Game; function main(): void { " +
      "let broken: byte = 1 let kept: byte = 2; missingName; }";
    const result = analyzeProject(snapshot([source("src/game.blend", text)]));

    expect(result.kind).toBe("error");
    expect(result).not.toHaveProperty("program");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["PARSE_SYNTAX_ERROR", "E10239"]);
  });

  // An unsafe parser remainder is an outstanding syntax obligation, even when an error is known.
  it("returns incomplete when syntax recovery cannot prove the remainder", () => {
    const text = "module Game; function main(): void { let broken: byte = 1;";
    const result = analyzeProject(snapshot([source("src/game.blend", text)]));

    expect(result.kind).toBe("incomplete");
    expect(result).not.toHaveProperty("program");
    expect(result.diagnostics.map(({ code }) => code)).toContain("PARSE_SYNTAX_ERROR");
    if (result.kind !== "incomplete") throw new Error(`Expected incomplete, got ${result.kind}`);
    expect(result.obligations).toContainEqual(
      expect.objectContaining({ kind: "syntax", message: expect.any(String) }),
    );
  });
});

describe("snapshot-only integration and typed output boundary", () => {
  // Analysis consumes the loaded immutable snapshot and neither rereads inputs nor writes host files.
  it("analyzes a real merged project without changing its snapshot or filesystem", async () => {
    const root = await import("node:fs/promises").then(({ mkdtemp }) =>
      mkdtemp(join(tmpdir(), "blend65-service-spec-")),
    );
    temporaryRoots.push(root);
    await put(
      root,
      "blend65.json",
      JSON.stringify({
        schemaVersion: 1,
        name: "service-integration",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: ["assets"],
        outDir: "out",
      }),
    );
    await put(
      root,
      "src/game-main.blend",
      "module Game; import { f } from Math; function main(): void { helper(); f(); }",
    );
    await put(root, "src/game-helper.blend", "module Game; function helper(): void {} ");
    await put(root, "src/math.blend", "module Math; export function f(): void {} ");
    await put(root, "assets/unrelated.bin", "must not be read by source analysis");

    const loaded = await loadProject({ cwd: root });
    expect(loaded.kind).toBe("success");
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    const project = loaded.snapshot;
    const snapshotBefore = JSON.stringify(project);
    await writeFile(join(root, "src/game-main.blend"), "not valid source after snapshot");
    await rm(join(root, "assets/unrelated.bin"));
    const filesBefore = await tree(root);

    const result = analyzeProject(project);

    expect(result.kind).toBe("complete");
    expect(result.diagnostics).toEqual([]);
    expect(JSON.stringify(project)).toBe(snapshotBefore);
    expect(await tree(root)).toEqual(filesBefore);
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    if (result.kind !== "complete") throw new Error(`Expected complete, got ${result.kind}`);
    expect(result.program.bindings.map(({ qualifiedName }) => qualifiedName)).toEqual(
      expect.arrayContaining(["Game.helper", "Game.main", "Math.f"]),
    );
  });

  // Typed output retains symbolic frontend facts and never admits backend placement or instruction data.
  it("keeps calls arrays dynamic memory and effects symbolic in the completed program", () => {
    const text = [
      "module Game;",
      "let data: byte[2] = [1, 2];",
      "function helper(value: byte): byte { return value + 1; }",
      "function operate(address: word, index: byte): void {",
      "  data[index] = helper(peek(address));",
      "  poke(address, data[index]);",
      "}",
      "function main(): void {}",
    ].join("\n");
    const result = analyzeProject(snapshot([source("src/game.blend", text)]));

    expect(result.kind).toBe("complete");
    expect(result.diagnostics).toEqual([]);
    if (result.kind !== "complete") throw new Error(`Expected complete, got ${result.kind}`);
    expect(result.program.bindings.length).toBeGreaterThan(0);
    expect(result.program.declarations.length).toBeGreaterThan(0);
    expect(result.program.calls.length).toBeGreaterThan(0);
    expect(result.program.effects.length).toBeGreaterThan(0);
    expect(
      result.program.bindings.every(
        ({ id }) =>
          typeof id.sourceId === "string" &&
          id.span.sourceId === id.sourceId &&
          Number.isInteger(id.span.start) &&
          Number.isInteger(id.span.end),
      ),
    ).toBe(true);
    expect(
      JSON.stringify(result.program, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toMatch(/"(?:opcode|mmio|actualAddress|sfaHome|artifact)"\s*:/i);
  });
});
