import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeProjectOverlay, loadProject } from "../frontend/index.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import type { MemoryReadOperation, SemanticFunction } from "../semantic/operations.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { selectTargetProfile } from "../target/profile.js";
import { hasUnobservedByteCapture } from "./byte-capture-observers.js";
import type { MachineLoweringInput } from "./machine-types.js";
import { proveSpritePublications } from "./sprite-publication-proof.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

/** Unsupported publication premises remain legal source, with no proof exemption. */
interface PublicationCase {
  readonly pointer?: string;
  readonly partialInitialization?: boolean;
  readonly extra?: string;
  readonly reverse?: string;
}

/** A reachable mainline owner with both bounded update directions and unchanged iterations. */
function sourceFor(options: PublicationCase): string {
  const pointer = options.pointer ?? "base + step";
  return `module Main;
const BALL: byte[] = embed("ball.bin");
function main(): void {
  let base: byte = c64.vic.vicSpriteBlock(&BALL);
  let frame: byte = 0;
  let step: byte = frame * 4;
  let p: byte = ${pointer};
  poke($07F8, p); poke($07F9, p + 1); poke($07FA, p + 2);
  ${options.partialInitialization ? "if (peek($DC02) != 0) { poke($07FB, p + 3); }" : "poke($07FB, p + 3);"}
  poke($D015, 15);
  ${options.extra ?? ""}
  while (true) {
    while (peek($D012) != 251) {}
    if (peek($DC00) != 0) {
      if (peek($DC01) != 0) {
        frame = frame + 1;
        if (frame >= 4) { frame = 0; }
      } else {
        ${options.reverse ?? "if (frame == 0) { frame = 3; } else { frame = frame - 1; }"}
      }
    }
    step = frame * 4;
    p = ${pointer};
    poke($07F8, p); poke($07F9, p + 1); poke($07FA, p + 2); poke($07FB, p + 3);
  }
}`;
}

/** Use the real asset-aware frontend and unchanged semantic pipeline, without machine emission. */
async function publicationInput(options: PublicationCase = {}, profileId: string = profiles[0]) {
  const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "blend65-sprite-proof-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    await copyFile(
      new URL("../../../../examples/boing-ball/assets/ball.bin", import.meta.url),
      join(root, "assets/ball.bin"),
    );
    expect((await readFile(join(root, "assets/ball.bin"))).length).toBe(1024);
    await writeFile(join(root, "src/main.blend"), sourceFor(options));
    const project = join(root, "blend65.json");
    await writeFile(
      project,
      JSON.stringify({
        schemaVersion: 1,
        name: "sprite-publication-proof",
        sourceRoot: "src",
        entry: "Main",
        target: profileId,
        assetPaths: ["assets"],
        outDir: "out",
        optimization: "none",
      }),
    );
    const loaded = await loadProject({ project });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    const analysis = await analyzeProjectOverlay(loaded.snapshot, []);
    expect(analysis.kind, JSON.stringify(analysis.diagnostics)).toBe("complete");
    if (analysis.kind !== "complete") throw new Error("Expected valid publication source");
    const semantic = buildSemanticProgram(analysis);
    if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
    const selected = selectTargetProfile(profileId);
    if (selected.kind !== "complete") throw new Error("Expected a cooperative C64 profile");
    const closed = closeWholeProgram(
      semantic.program,
      selected.profile.interrupts,
      selected.profile.storage,
    );
    if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
    const input: MachineLoweringInput = { program: closed.program, profile: selected.profile };
    const source = input.program.semantic.functions.find(
      (fn) => bindingIdentityKey(fn.id) === bindingIdentityKey(input.program.semantic.main),
    );
    if (source === undefined) throw new Error("Expected the actual reachable main function");
    return { input, source };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Select the actual byte-read object by its literal address definition, not a fabricated value ID. */
function rasterCapture(source: SemanticFunction): MemoryReadOperation {
  const operations = source.blocks.flatMap((block) => block.operations);
  const capture = operations.find(
    (operation): operation is MemoryReadOperation =>
      operation.kind === "memory-read" &&
      operation.width === 1 &&
      operations.some(
        (definition) =>
          definition.kind === "constant" &&
          definition.result === operation.address &&
          definition.value === 0xd012n,
      ),
  );
  if (capture === undefined)
    throw new Error("Expected the actual literal-address raster byte read");
  return capture;
}

describe("sprite publication proof eligibility before anonymous comparison selection", () => {
  for (const profile of profiles) {
    it(`certifies the exact initialized asset publications on ${profile}`, async () => {
      const { input, source } = await publicationInput({}, profile);
      const proof = proveSpritePublications(input, source);
      expect(proof).not.toBeNull();
      if (proof === null) throw new Error("Expected a complete asset-relative publication proof");
      expect(proof.program).toBe(input.program);
      expect(proof.source).toBe(source);
      const writes = source.blocks
        .flatMap((block) => block.operations)
        .filter((operation) => operation.kind === "memory-write");
      expect(writes).toHaveLength(9);
      expect(proof.writes.size).toBe(writes.length);
      for (const write of writes) {
        expect(proof.writes.has(write)).toBe(true);
        expect(proof.writes.has({ ...write })).toBe(false);
      }
    });
  }

  const rejected: readonly { readonly name: string; readonly options: PublicationCase }[] = [
    {
      name: "a missing initialization on a reachable enable path",
      options: { partialInitialization: true },
    },
    { name: "a numeric pointer without immutable asset provenance", options: { pointer: "$80" } },
    {
      name: "a dynamic pointer without immutable asset provenance",
      options: { pointer: "peek($DC02)" },
    },
    { name: "the first 64-byte block beyond the asset extent", options: { pointer: "base + 16" } },
    { name: "a negative relative offset", options: { pointer: "base - 1" } },
    { name: "an offset whose byte addition can wrap", options: { pointer: "base + 255" } },
    {
      name: "a reverse path that can underflow at zero",
      options: { reverse: "frame = frame - 1;" },
    },
    { name: "an unbounded raw read", options: { extra: "poke($D020, peek(peekw($DC02)));" } },
    { name: "an unbounded raw write", options: { extra: "poke(peekw($DC02), 0);" } },
    {
      name: "an indexed raw read",
      options: { extra: "let address: word = peekw($DC02); poke($D020, peek(address + 1));" },
    },
  ];
  for (const { name, options } of rejected) {
    it(`does not certify ${name}`, async () => {
      const { input, source } = await publicationInput(options);
      expect(proveSpritePublications(input, source)).toBeNull();
    });
  }
  for (const address of ["$D018", "$DD00", "$DD02", "$0000", "$0001", "$D058", "$DD10", "$DD12"]) {
    it(`does not certify a source selector or mirrored write at ${address}`, async () => {
      const { input, source } = await publicationInput({ extra: `poke(${address}, 0);` });
      expect(proveSpritePublications(input, source)).toBeNull();
    });
  }

  it("does not accept an equal-looking source owned by a different semantic program", async () => {
    const first = await publicationInput();
    const second = await publicationInput();
    expect(bindingIdentityKey(first.source.id)).toBe(bindingIdentityKey(second.source.id));
    expect(first.source).not.toBe(second.source);
    expect(proveSpritePublications(first.input, second.source)).toBeNull();
    expect(proveSpritePublications(second.input, first.source)).toBeNull();
  });

  it("does not inherit publication eligibility through replacement function and operation objects", async () => {
    const { input, source } = await publicationInput();
    const replacement = {
      ...source,
      blocks: source.blocks.map((block) => ({
        ...block,
        operations: block.operations.map((operation) => ({ ...operation })),
      })),
    };
    expect(proveSpritePublications(input, replacement)).toBeNull();
    expect(proveSpritePublications(input, { ...source })).toBeNull();
  });

  for (const mismatch of ["program", "source", "operations"] as const) {
    it(`does not exempt publications using a proof with different ${mismatch} identities`, async () => {
      const { input, source } = await publicationInput();
      const other = await publicationInput();
      const capture = rasterCapture(source);
      const proof = proveSpritePublications(input, source);
      expect(proof).not.toBeNull();
      if (proof === null)
        throw new Error("Expected the valid proof before checking stale identities");
      expect(hasUnobservedByteCapture(input, source, capture)).toBe(false);
      expect(hasUnobservedByteCapture(input, source, capture, proof)).toBe(true);
      const stale = {
        program: mismatch === "program" ? other.input.program : proof.program,
        source: mismatch === "source" ? other.source : proof.source,
        writes:
          mismatch === "operations"
            ? new Set([...proof.writes].map((write) => ({ ...write })))
            : proof.writes,
      };
      expect(hasUnobservedByteCapture(input, source, capture, stale)).toBe(false);
    });
  }
});
