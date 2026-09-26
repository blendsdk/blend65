import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import type { BuildSuccess } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Isolate source, raw assets, and publication ownership for a real public build. */
async function project(source: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-terminal-backend-"));
  await mkdir(join(root, "src"));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "assets/data.bin"), Uint8Array.of(13, 29, 47));
  await writeFile(join(root, "src/game.blend"), source);
  await writeFile(
    join(root, "blend65.json"),
    JSON.stringify({
      schemaVersion: 1,
      name: "backend",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: ["assets"],
      outDir: "out",
      optimization: "none",
    }),
  );
  return root;
}

/** Hash actual artifact bytes rather than trusting another sidecar's claim. */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Validate JSON's outer shape before using externally written evidence. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected an evidence record");
  }
  return value as Record<string, unknown>;
}

/** Reject malformed collections before reconciling their independent accounting claims. */
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new TypeError("Expected an evidence record array");
  return value.map(record);
}

/** Canonical object-key order makes the storage projection hash independent of JSON formatting. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Load one published sidecar through the public build's exact generation path. */
async function evidence(build: BuildSuccess, name: string): Promise<Record<string, unknown>> {
  return record(JSON.parse(await readFile(join(build.generation.directory, name), "utf8")));
}

const completeSource = [
  "module Game;",
  "struct Pair { first: byte; second: word; }",
  'place(at: $3000) const DATA: byte[] = embed("data.bin");',
  "place(at: $3100, align: 256) const MARK: byte = 91;",
  "let total: word = 0;",
  "zeropage { cursor: byte = 0; }",
  "function pair(value: byte): Pair { return { first: value, second: word(value) + 256 }; }",
  "function quotient(value: word, divisor: word): word { return value / divisor; }",
  "function main(): void {",
  "  let value: Pair = pair(DATA[0]);",
  "  total = quotient(value.second, word(peek($0400)) + 1);",
  "  while (cursor < 3) { poke($0420 + word(cursor), DATA[cursor]); cursor += 1; }",
  "  if (peek($0401) != 0) {",
  // Repeated volatile writes supply branch-range stress only; the language workload uses the loop above.
  ...Array.from({ length: 40 }, (_, index) => `    poke($0500 + ${index}, MARK);`),
  "  }",
  "  poke($0423, value.first);",
  "}",
].join("\n");

describe("complete direct backend publication", () => {
  // Routine and data names remain recognizable in stable assembler-safe labels and boundary comments.
  it("should expose readable source-related labels and routine/data boundary comments", async () => {
    const root = await project(
      "module Game; const MESSAGE: byte[3] = [7, 8, 9]; function sample(index: byte): byte { return MESSAGE[index]; } function main(): void { poke($0400, sample(peek($0401))); }",
    );
    try {
      const result = await buildProject({ project: join(root, "blend65.json") });
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      if (result.kind !== "success") throw new Error("Expected readable assembly build");
      const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
      const labels = [...assembly.matchAll(/^([A-Za-z_][A-Za-z0-9_]*):\s*$/gm)].map(
        (match) => match[1]!,
      );
      expect(labels.length).toBeGreaterThan(0);
      expect(new Set(labels).size).toBe(labels.length);
      for (const name of ["main", "sample", "MESSAGE"]) {
        expect(
          labels.some((label) => label.toLowerCase().includes(name.toLowerCase())),
          name,
        ).toBe(true);
        expect(assembly, `${name} boundary comment`).toMatch(
          new RegExp(`^\\s*;[^\\n]*${name}`, "mi"),
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  // Unavailable targets, native formats and resident-profile transfers never become stub products.
  it.each([
    ["unknown target", "module Game; function main(): void {}", "future-machine", "E10279"],
    [
      "native format",
      'module Game; const DATA: byte[] = embed("data.spd", "sprites"); function main(): void { poke($0400, DATA[0]); }',
      "c64-pal-prg-kernal-6581",
      null,
    ],
    [
      "resident transfer",
      "module Game; loadable const DATA: byte[2] = [1, 2]; let target: byte[2]; function main(): void { c64.loader.load(DATA, target); }",
      "c64-pal-prg-kernal-6581",
      "E10275",
    ],
  ])(
    "should reject an unavailable %s without publishing a package",
    async (_name, source, target, code) => {
      const root = await project(source);
      try {
        await writeFile(
          join(root, "assets/data.spd"),
          Uint8Array.from([0x53, 0x50, 0x44, 5, 0, 0, 0, 0]),
        );
        const result = await buildProject({ project: join(root, "blend65.json"), target });
        expect(result.kind).toBe("failure");
        expect(result.diagnostics.some(({ severity }) => severity === "error")).toBe(true);
        if (code !== null)
          expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
        expect(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n")).not.toMatch(
          /internal compiler error|not yet lowered/i,
        );
        const names = await readdir(join(root, "out")).catch(() => [] as string[]);
        expect(names).not.toContain("current.json");
        expect(names.filter((name) => name.startsWith(".staging-"))).toEqual([]);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  // A real failing external assembler cannot leave a current image or owned staging behind.
  it("should clean staging and publish nothing after the assembler process fails", async () => {
    const root = await project("module Game; function main(): void { poke($0400, 7); }");
    const previousPath = process.env.PATH;
    try {
      const bin = join(root, "bin");
      await mkdir(bin);
      const executable = join(bin, "acme");
      const invocationLog = join(root, "assembler-arguments.json");
      await writeFile(
        executable,
        `#!${process.execPath}\nconst fs = require("node:fs");\nconst args = process.argv.slice(2);\nif (!args.includes("--cpu")) { process.stdout.write("ACME, release 0.97\\n"); process.exit(0); }\nfs.writeFileSync(${JSON.stringify(invocationLog)}, JSON.stringify(args));\nprocess.stderr.write("Error: injected assembler failure\\n");\nprocess.exit(1);\n`,
      );
      await chmod(executable, 0o755);
      process.env.PATH = bin;
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result).toMatchObject({ kind: "failure", category: "assembler" });
      const args: unknown = JSON.parse(await readFile(invocationLog, "utf8"));
      expect(args).toEqual(expect.arrayContaining(["--cpu", "6502"]));
      const names = await readdir(join(root, "out")).catch(() => [] as string[]);
      expect(names).not.toContain("current.json");
      expect(names.filter((name) => name.startsWith(".staging-"))).toEqual([]);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  // Ordinary aggregates, calls, loops, dynamic division and a long branch share one reconciled image.
  it("should publish deterministic none artifacts for combined language and placement demands", async () => {
    const root = await project(completeSource);
    try {
      const first = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(first.kind, JSON.stringify(first.diagnostics)).toBe("success");
      if (first.kind !== "success") throw new Error("Expected the complete-language build");
      const expected = [
        ".asm",
        ".assets.json",
        ".build.json",
        ".costs.json",
        ".debug.json",
        ".labels",
        ".memory.json",
        "backend.prg",
      ];
      expect((await readdir(first.generation.directory)).sort()).toEqual(expected);
      const image = await readFile(join(first.generation.directory, "backend.prg"));
      expect(image.readUInt16LE(0)).toBe(0x0801);
      expect([...image.subarray(2 + 0x3000 - 0x0801, 2 + 0x3003 - 0x0801)]).toEqual([13, 29, 47]);
      expect(image[2 + 0x3100 - 0x0801]).toBe(91);
      const costs = await evidence(first, ".costs.json");
      expect(costs).toMatchObject({ schemaVersion: 1, mode: "none", decisions: [] });
      expect(record(costs.totals).programBytes).toBe(image.length - 2);
      expect(costs.entries).not.toEqual([]);
      const memory = await evidence(first, ".memory.json");
      expect(memory).toMatchObject({ schemaVersion: 1, acmeReconciled: true });
      expect(memory.sfaClosureSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(memory.intervals).not.toEqual([]);
      const intervals = records(memory.intervals);
      const views = records(memory.views);
      expect(views.length).toBeGreaterThan(0);
      for (const interval of intervals) {
        expect(interval.end).toBeTypeOf("number");
        expect(interval.start).toBeTypeOf("number");
        expect(interval.size).toBe(Number(interval.end) - Number(interval.start));
        expect(interval.size).toBe(
          Number(interval.payloadBytes) +
            Number(interval.paddingBytes) +
            Number(interval.reservedBytes),
        );
      }
      for (const view of views) {
        if (!Array.isArray(view.activeResidencyIds))
          throw new TypeError("Expected active residencies");
        const active = intervals.filter(
          (interval) =>
            interval.addressSpaceId === view.addressSpaceId &&
            interval.bankId === view.bankId &&
            Array.isArray(interval.residencyIds) &&
            interval.residencyIds.some((id) => view.activeResidencyIds.includes(id)) &&
            Number(interval.start) < Number(view.end) &&
            Number(interval.end) > Number(view.start),
        );
        const partition = [
          ...active.map((interval) => ({
            start: Math.max(Number(interval.start), Number(view.start)),
            end: Math.min(Number(interval.end), Number(view.end)),
          })),
          ...records(view.freeIntervals).map((interval) => ({
            start: Number(interval.start),
            end: Number(interval.end),
          })),
        ].sort((a, b) => a.start - b.start || a.end - b.end);
        let cursor = Number(view.start);
        for (const interval of partition) {
          expect(interval.start, `No overlapping or missing bytes in ${view.id}`).toBe(cursor);
          expect(interval.end).toBeGreaterThanOrEqual(interval.start);
          cursor = interval.end;
        }
        expect(cursor).toBe(view.end);
        expect(Number(view.occupiedBytes) + Number(view.freeBytes)).toBe(view.capacityBytes);
      }
      const closure = intervals
        .filter(
          (interval) =>
            ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)) &&
            ["function", "helper"].includes(String(record(interval.owner).kind)),
        )
        .map((interval) =>
          Object.fromEntries(
            [
              "id",
              "addressSpaceId",
              "bankId",
              "start",
              "end",
              "owner",
              "kind",
              "resourceClass",
              "residencyIds",
            ]
              .filter((key) => Object.hasOwn(interval, key))
              .map((key) => [key, interval[key]]),
          ),
        );
      expect(closure.length).toBeGreaterThan(0);
      expect(memory.sfaClosureSha256).toBe(sha256(Buffer.from(canonical(closure))));
      const programBytes = records(costs.entries)
        .filter((entry) => entry.kind === "bytes" && entry.accounting === "program")
        .reduce((sum, entry) => sum + Number(entry.bytes), 0);
      expect(programBytes).toBe(image.length - 2);
      const debug = await evidence(first, ".debug.json");
      expect(debug).toMatchObject({ schemaVersion: 1, optimization: "none", optimizations: [] });
      for (const field of ["sources", "functions", "symbols", "locations", "ranges"]) {
        expect(debug[field], field).not.toEqual([]);
      }
      const build = await evidence(first, ".build.json");
      expect(Array.isArray(build.artifacts)).toBe(true);
      for (const item of build.artifacts as unknown[]) {
        const digest = record(item);
        if (typeof digest.path !== "string") throw new TypeError("Expected an artifact path");
        const bytes = await readFile(join(first.generation.directory, digest.path));
        expect(digest).toMatchObject({ bytes: bytes.length, sha256: sha256(bytes) });
      }
      // Successful publication may reclaim an unpinned older generation; retain its bytes first.
      const deterministicFiles = expected.filter((name) => name !== ".build.json");
      const firstBytes = new Map(
        await Promise.all(
          deterministicFiles.map(
            async (name) => [name, await readFile(join(first.generation.directory, name))] as const,
          ),
        ),
      );
      const second = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(second.kind, JSON.stringify(second.diagnostics)).toBe("success");
      if (second.kind !== "success") throw new Error("Expected repeat build");
      for (const name of deterministicFiles) {
        expect(await readFile(join(second.generation.directory, name)), name).toEqual(
          firstBytes.get(name),
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  // Failure at each source-to-layout boundary must leave no first successful generation or owned staging.
  it.each([
    ["lexical", "module Game; function main(): void { ` }"],
    ["semantic", "module Game; function main(): void { missing(); }"],
    [
      "layout",
      "module Game; place(at: $2000) let a: byte; place(at: $2000) let b: byte; function main(): void { poke($0400, a + b); }",
    ],
  ])("should publish no current generation after a %s failure", async (_stage, source) => {
    const root = await project(source);
    try {
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind).toBe("failure");
      expect(result.diagnostics.some(({ severity }) => severity === "error")).toBe(true);
      const names = await readdir(join(root, "out")).catch(() => [] as string[]);
      expect(names).not.toContain("current.json");
      expect(names.filter((name) => name.startsWith(".staging-"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
