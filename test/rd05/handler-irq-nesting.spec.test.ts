import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileSpan, readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const primaryProfile = profiles[0];

/** Put selected handler declarations into a returning cooperative IRQ program. */
function program(declarations: string, mainBody?: string): string {
  return `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
${declarations}
function main(): void {
  ${mainBody ?? "setIRQ(&A); asm_cli(); asm_nop(); asm_sei(); restoreIRQ();"}
}`;
}

/** Check and build one profile, reading only the generation returned by that build. */
async function expectAccepted(source: string, profile = primaryProfile) {
  return withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    expect(checked.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    if (checked.kind !== "success") throw new Error("Expected successful IRQ check");
    expect(checked.profileId).toBe(profile);

    const built = await buildProject({ project });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    expect(built.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    if (built.kind !== "success") throw new Error("Expected successful IRQ build");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory.profileId).toBe(profile);
    expect(artifacts.prg.length).toBeGreaterThan(2);
    return { checked, built, artifacts };
  });
}

/** Require a source diagnostic from both public services without artifact publication. */
async function expectRejected(source: string, code: "E10245" | "E10278") {
  await withProfileProject(source, primaryProfile, async (project, root) => {
    for (const result of [await checkProject({ project }), await buildProject({ project })]) {
      expect(result.kind).toBe("failure");
      const errorCodes = result.diagnostics
        .filter(({ severity }) => severity === "error")
        .map(({ code }) => code);
      expect(errorCodes).toContain(code);
      expect(errorCodes).not.toContain(code === "E10245" ? "E10278" : "E10245");
      expect(result).not.toHaveProperty("generation");
    }
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });
}

describe("finite IRQ nesting through selected C64 handlers", () => {
  // A masked B cannot recursively interrupt A even when B is installed inside A.
  it.each(profiles)(
    "accepts a finite exclusive A/B overlap on %s",
    async (profile) => {
      await expectAccepted(
        program(`interrupt function B(): void {}
interrupt function A(): void {
  setIRQExclusive(&B);
  asm_cli(); asm_nop(); asm_sei(); asm_nop();
  restoreIRQ();
}`),
        profile,
      );
    },
    60_000,
  );

  // Chaining B into the suspended A exposes a repeatable overlap cycle.
  it("rejects a chained B that re-enters suspended A", async () => {
    await expectRejected(
      program(`interrupt function B(): void {}
interrupt function A(): void {
  setIRQ(&B);
  asm_cli(); asm_nop(); asm_sei(); asm_nop();
  restoreIRQ();
}`),
      "E10245",
    );
  }, 60_000);

  // Three simultaneously live IRQ invocations require three distinct private storage roots.
  it("accepts finite exclusive A/B/C nesting", async () => {
    await expectAccepted(
      program(`interrupt function C(): void {}
interrupt function B(): void {
  setIRQExclusive(&C);
  asm_cli(); asm_nop(); asm_sei(); asm_nop();
  restoreIRQ();
}
interrupt function A(): void {
  setIRQExclusive(&B);
  asm_cli(); asm_nop(); asm_sei(); asm_nop();
  restoreIRQ();
}`),
    );
  }, 60_000);

  // The same A body can run twice in one chain, each time restoring its own B predecessor.
  it("accepts two sequential A chain entries with a temporary B install", async () => {
    await expectAccepted(
      program(
        `interrupt function B(): void {}
interrupt function A(): void { setIRQExclusive(&B); restoreIRQ(); }`,
        `setIRQ(&A); setIRQ(&A);
  asm_cli(); asm_nop(); asm_sei();
  restoreIRQ(); restoreIRQ();`,
      ),
    );
  }, 60_000);

  // Main, A and B can keep separate parameter, local and result homes in one ordinary helper.
  it("builds one storage-bearing helper for overlapping main/A/B invocations", async () => {
    const source = program(
      `let mainResult: byte = 0;
let aResult: byte = 0;
let bResult: byte = 0;
function increment(value: byte): byte {
  let saved: byte = value;
  let offset: byte = peek($0401);
  if (value != 33) { asm_cli(); asm_nop(); asm_sei(); }
  saved += offset;
  saved -= offset;
  return saved + 1;
}
interrupt function B(): void { bResult = increment(33); }
interrupt function A(): void {
  setIRQExclusive(&B);
  aResult = increment(17);
  restoreIRQ();
}`,
      `setIRQ(&A);
  mainResult = increment(77);
  asm_sei(); restoreIRQ();`,
    );
    await expectAccepted(source);
  }, 60_000);

  // A net install returned from a helper needs a separate live predecessor for each caller.
  it("accepts overlapping calls to one conditional installer", async () => {
    await expectAccepted(
      program(`interrupt function C(): void {}
interrupt function B(): void { installChoice(); restoreIRQ(); }
function installChoice(): void {
  if (peek($0400) == 0) { setIRQExclusive(&B); }
  else { setIRQExclusive(&C); }
}
interrupt function A(): void {
  installChoice();
  asm_cli(); asm_nop(); asm_sei();
  restoreIRQ();
}`),
    );
  }, 60_000);
});

describe("shared state across nested IRQ roots", () => {
  // A and B share globals, so their byte updates can lose an increment and word access can tear.
  it("reports both conflicting sites for byte RMW and multi-byte access", async () => {
    const source = program(`let count: byte = 0;
let position: word = 0;
let published: byte = 0;
interrupt function B(): void {
  count += 1;
  pokew($0404, position);
  published = 1;
}
interrupt function A(): void {
  setIRQExclusive(&B);
  asm_cli(); asm_nop();
  count += 1;
  position = peekw($0402);
  published = 2;
  asm_sei(); asm_nop();
  restoreIRQ();
}`);
    const { checked, built } = await expectAccepted(source);
    for (const diagnostics of [checked.diagnostics, built.diagnostics]) {
      const rmw = diagnostics.filter(({ code }) => code === "W10211");
      const tear = diagnostics.filter(({ code }) => code === "W10212");
      expect(rmw).toHaveLength(1);
      expect(tear).toHaveLength(1);
      expect(rmw[0]?.message).toBe(
        "Shared 'count' has an unprotected cross-domain read-modify-write that can lose an update",
      );
      expect(tear[0]?.message).toMatch(/^Shared multi-byte 'position' can tear across /u);
      const sites = (diagnostic: (typeof diagnostics)[number]) => [
        diagnostic.primarySpan,
        ...diagnostic.related.map(({ span }) => span),
      ];
      expect(sites(rmw[0]!)).toEqual(
        expect.arrayContaining([
          profileSpan(source, "count += 1", 0),
          profileSpan(source, "count += 1", 1),
        ]),
      );
      expect(sites(tear[0]!)).toEqual(
        expect.arrayContaining([
          profileSpan(source, "position", 1),
          profileSpan(source, "position = peekw($0402)"),
        ]),
      );
      expect(
        diagnostics.filter(
          ({ code, message }) => code === "W10212" && message.includes("published"),
        ),
      ).toEqual([]);
    }
  }, 60_000);
});

describe("unsafe IRQ ownership across nested handlers", () => {
  // A raw CINV write invalidates the predecessor saved by a temporary installer.
  it("rejects a raw vector write before restoring a temporary install", async () => {
    await expectRejected(
      program(`interrupt function B(): void {}
interrupt function A(): void {
  setIRQExclusive(&B);
  poke($0314, peek($0314));
  restoreIRQ();
}`),
      "E10278",
    );
  }, 60_000);

  // Both branches must leave the same saved-predecessor ownership for their caller.
  it("rejects a conditional install left live on only one path", async () => {
    await expectRejected(
      program(`interrupt function B(): void {}
interrupt function A(): void {
  if (peek($0400) == 0) { setIRQExclusive(&B); }
}`),
      "E10278",
    );
  }, 60_000);
});
