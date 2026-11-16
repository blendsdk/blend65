import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { BOING_BALL_DIR } from "./boing-ball-fixture.js";
import { profileRecords, readProfileArtifacts } from "./profile-fixture.js";
import { sourceLibraryProfiles } from "./source-library-fixture.js";

/** Each variation changes one proof premise without making the source illegal. */
interface PublicationSource {
  readonly pointer?: string;
  readonly partialInitialization?: boolean;
  readonly extra?: string;
  readonly reverse?: string;
  readonly poll?: string;
  readonly operator?: "==" | "!=";
}

/** Preserve ordinary scalar updates and source-selected immutable sprite data. */
function publicationSource(options: PublicationSource = {}): string {
  const pointer = options.pointer ?? "base + step";
  const fourth = "poke($07FB, p + 3);";
  return `module Main;
const BALL: byte[] = embed("ball.bin");
function main(): void {
  let base: byte = c64.vic.vicSpriteBlock(&BALL);
  let frame: byte = 0;
  let step: byte = frame * 4;
  let p: byte = ${pointer};
  poke($07F8, p); poke($07F9, p + 1); poke($07FA, p + 2);
  ${options.partialInitialization ? `if (peek($DC02) != 0) { ${fourth} }` : fourth}
  poke($D015, 15);
  ${options.extra ?? ""}
  while (true) {
    ${options.poll ?? `while (peek($D012) ${options.operator ?? "!="} 251) {}`}
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

/** Run the real public none-mode build and ACME, then detach evidence before cleanup. */
async function buildPublication(profile: string, options: PublicationSource = {}) {
  const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "blend65-sprite-poll-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    await copyFile(join(BOING_BALL_DIR, "assets/ball.bin"), join(root, "assets/ball.bin"));
    expect((await readFile(join(root, "assets/ball.bin"))).length).toBe(1024);
    await writeFile(join(root, "src/main.blend"), publicationSource(options));
    const project = join(root, "blend65.json");
    await writeFile(
      project,
      JSON.stringify({
        schemaVersion: 1,
        name: "sprite-publication-poll",
        sourceRoot: "src",
        entry: "Main",
        target: profile,
        assetPaths: ["assets"],
        outDir: "out",
        optimization: "none",
      }),
    );
    const built = await buildProject({ project, optimization: "none" });
    expect(
      built.kind,
      built.kind === "success" ? undefined : JSON.stringify(built.diagnostics),
    ).toBe("success");
    if (built.kind !== "success") throw new Error("Expected accepted source and a real ACME build");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    return artifacts;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Find the real raster instruction only inside published executable intervals. */
function rasterRead(artifacts: Awaited<ReturnType<typeof readProfileArtifacts>>) {
  const code = profileRecords(artifacts.memory.intervals).filter((entry) => entry.kind === "code");
  expect(code.length).toBeGreaterThan(0);
  const load = artifacts.prg.readUInt16LE(0);
  const offsets: number[] = [];
  for (let offset = 2; offset + 2 < artifacts.prg.length; offset += 1) {
    const address = load + offset - 2;
    if (
      artifacts.prg[offset] === 0xad &&
      artifacts.prg[offset + 1] === 0x12 &&
      artifacts.prg[offset + 2] === 0xd0 &&
      code.some((entry) => Number(entry.start) <= address && Number(entry.end) >= address + 3)
    )
      offsets.push(offset);
  }
  expect(offsets, "one original volatile raster read instruction").toHaveLength(1);
  return { offset: offsets[0]!, address: load + offsets[0]! - 2, code };
}

/** LDA absolute, EOR immediate and a same-page taken branch cost 4 + 2 + 3 cycles. */
function expectForwardedPoll(
  artifacts: Awaited<ReturnType<typeof readProfileArtifacts>>,
  branch: 0xd0 | 0xf0,
): void {
  const { offset, address, code } = rasterRead(artifacts);
  expect(
    code.some((entry) => Number(entry.start) <= address && Number(entry.end) >= address + 7),
  ).toBe(true);
  expect([...artifacts.prg.subarray(offset, offset + 7)]).toEqual([
    0xad,
    0x12,
    0xd0,
    0x49,
    0xfb,
    branch,
    0xf9,
  ]);
  // This excludes branch page penalties, but makes no claim about IRQ service or VIC DMA.
  expect((address + 7) & 0xff00).toBe(address & 0xff00);
}

/** Require an ordinary memory capture, without fixing its allocated address or address width. */
function expectOrdinaryCapture(artifacts: Awaited<ReturnType<typeof readProfileArtifacts>>): void {
  const { offset } = rasterRead(artifacts);
  expect(
    [0x85, 0x8d],
    "the read byte must still be stored, in zero page or absolute memory",
  ).toContain(artifacts.prg[offset + 3]);
}

/** Keep both ordered volatile word reads and capture both registers, without choosing their homes. */
function expectOrdinaryWordCapture(
  artifacts: Awaited<ReturnType<typeof readProfileArtifacts>>,
): void {
  const { offset, address, code } = rasterRead(artifacts);
  const { prg } = artifacts;
  expect([...prg.subarray(offset, offset + 6)]).toEqual([0xad, 0x12, 0xd0, 0xae, 0x13, 0xd0]);
  const highReads: number[] = [];
  const load = prg.readUInt16LE(0);
  for (let candidate = 2; candidate + 2 < prg.length; candidate += 1) {
    const at = load + candidate - 2;
    if (
      prg[candidate] === 0xae &&
      prg[candidate + 1] === 0x13 &&
      prg[candidate + 2] === 0xd0 &&
      code.some((entry) => Number(entry.start) <= at && Number(entry.end) >= at + 3)
    )
      highReads.push(candidate);
  }
  expect(highReads, "one high-byte access, after the original low-byte access").toEqual([
    offset + 3,
  ]);

  const captures: { readonly register: "a" | "x"; readonly home: number }[] = [];
  let cursor = offset + 6;
  for (let byte = 0; byte < 2; byte += 1) {
    const opcode = prg[cursor];
    const register =
      opcode === 0x85 || opcode === 0x8d ? "a" : opcode === 0x86 || opcode === 0x8e ? "x" : null;
    expect(register, "both unchanged word-read registers must be captured").not.toBeNull();
    if (register === null) throw new Error("Expected an ordinary STA or STX word capture");
    const absolute = opcode === 0x8d || opcode === 0x8e;
    const home = absolute ? prg.readUInt16LE(cursor + 1) : prg[cursor + 1]!;
    captures.push({ register, home });
    cursor += absolute ? 3 : 2;
  }
  expect(captures.map((capture) => capture.register).sort()).toEqual(["a", "x"]);
  expect(new Set(captures.map((capture) => capture.home)).size).toBe(2);
  expect(
    code.some(
      (entry) => Number(entry.start) <= address && Number(entry.end) >= address + cursor - offset,
    ),
  ).toBe(true);
}

describe("asset-relative sprite publications and anonymous raster polls", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const [operator, branch] of [
      ["!=", 0xd0],
      ["==", 0xf0],
    ] as const) {
      it(`forwards the bounded asset publication poll ${operator} in seven bytes on ${profile}`, async () => {
        expectForwardedPoll(await buildPublication(profile, { operator }), branch);
      }, 120_000);
    }
  }

  const conservative: readonly {
    readonly name: string;
    readonly options: PublicationSource;
    readonly capture?: "word";
  }[] = [
    {
      name: "one pointer initialized on only one reachable branch",
      options: { partialInitialization: true },
    },
    { name: "numeric sprite pointers", options: { pointer: "$80" } },
    { name: "dynamic sprite pointers", options: { pointer: "peek($DC02)" } },
    { name: "a block just beyond the complete asset", options: { pointer: "base + 16" } },
    { name: "a negative asset-relative offset", options: { pointer: "base - 1" } },
    { name: "an unproved wrapped offset", options: { pointer: "base + 255" } },
    { name: "unguarded reverse underflow", options: { reverse: "frame = frame - 1;" } },
    { name: "an unbounded raw observer", options: { extra: "poke($D020, peek(peekw($DC02)));" } },
    { name: "a dynamic raw write", options: { extra: "poke(peekw($DC02), 0);" } },
    {
      name: "an indexed raw observer",
      options: { extra: "let address: word = peekw($DC02); poke($D020, peek(address + 1));" },
    },
    {
      name: "a runtime comparison operand",
      options: { poll: "while (peek($D012) != peek($DC02)) {}" },
    },
    { name: "a signed comparison", options: { poll: "while (sbyte(peek($D012)) != -5) {}" } },
    { name: "a wide read", options: { poll: "while (peekw($D012) != 251) {}" }, capture: "word" },
    {
      name: "a materialized comparison result",
      options: {
        poll: `while (true) {
        let waiting: boolean[1] = [peek($D012) != 251];
        if (!waiting[0]) { break; }
      }`,
      },
    },
    {
      name: "a multiply used captured byte",
      options: {
        poll: `while (true) {
        let sampled: byte = peek($D012);
        if (sampled == 251) { poke($D020, sampled); break; }
        poke($D021, sampled);
      }`,
      },
    },
    {
      name: "an intervening volatile write",
      options: {
        poll: `while (true) {
        let sampled: byte = peek($D012); poke($D020, 0);
        if (sampled == 251) { break; }
      }`,
      },
    },
  ];
  for (const address of ["$D018", "$DD00", "$DD02", "$0000", "$0001", "$D058", "$DD10", "$DD12"]) {
    it(`retains ordinary capture after a source selector or mirrored write at ${address}`, async () => {
      expectOrdinaryCapture(
        await buildPublication(sourceLibraryProfiles[0], { extra: `poke(${address}, 0);` }),
      );
    }, 120_000);
  }
  for (const { name, options, capture } of conservative) {
    it(`keeps accepted source and ordinary capture for ${name}`, async () => {
      const artifacts = await buildPublication(sourceLibraryProfiles[0], options);
      if (capture === "word") expectOrdinaryWordCapture(artifacts);
      else expectOrdinaryCapture(artifacts);
    }, 120_000);
  }
});
