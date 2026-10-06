import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildResult, CheckResult } from "@blend65/compiler";
import {
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

/** Each selected cooperative profile has the same qualified stock-chain contract. */
const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
/** Keep the frozen public wording while leaving compiler-owned execution-path spelling open. */
const reentrancyMessage =
  /^Execution path '[^']+' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy$/;
/** One opaque class carries all three unproved external obligations. */
const externalEffect =
  "external-nmi-aggregate-stack+retained-nmi-firmware-completion+external-nmi-finite-deadline";
/** Five simultaneously retained bytes cannot all live in the three CPU registers. */
const retainedReads = `let a: byte = peek($0400); let b: byte = peek($0401);
let c: byte = peek($0402); let d: byte = peek($0403); let e: byte = peek($0404);
poke($0410, a); poke($0411, b); poke($0412, c); poke($0413, d); poke($0414, e);`;

/** Keep the installed route balanced so only its selected reentrancy proof is at issue. */
function chainedSource(body: string, helper = ""): string {
  return `module Game;
import { setNMI, restoreNMI } from c64.system;
${helper}
interrupt function handler(): void { ${body} }
function main(): void { setNMI(&handler); restoreNMI(); }`;
}

/** Require one canonical root error in both services without a usable partial result. */
function expectRejected(
  results: readonly (BuildResult | CheckResult)[],
  source: string,
  code: string,
  primary?: string,
): void {
  for (const result of results) {
    expect(result.kind).toBe("failure");
    expect(result).not.toHaveProperty("generation");
    const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    expect(errors).toHaveLength(1);
    const diagnostic = errors[0]!;
    expect(diagnostic.code).toBe(code);
    expect(diagnostic.pointer).toBeNull();
    expect(diagnostic.help === null || typeof diagnostic.help === "string").toBe(true);
    if (code === "E10245") expect(diagnostic.message).toMatch(reentrancyMessage);
    if (code === "E10244")
      expect(diagnostic.message).toMatch(
        /^Ordinary function value 'ordinary' cannot be installed in interrupt-handler sink '[^']+' — use an interrupt function$/,
      );
    if (code === "E10247")
      expect(diagnostic.message).toMatch(
        /^Cannot prove the entry ABI of the value passed to function-address sink '[^']+' — pass a provenance-preserving function address or use an explicit raw hardware boundary$/,
      );
    if (code === "E10051")
      expect(diagnostic.message).toBe(
        "Cannot call interrupt function 'handler' directly — use '&handler' for installation in an interrupt-entry sink",
      );
    expect(diagnostic.primarySpan?.sourceId).toBe("src/game.blend");
    expect(diagnostic.primarySpan?.start).toBeGreaterThanOrEqual(0);
    expect(diagnostic.primarySpan?.end).toBeGreaterThan(diagnostic.primarySpan!.start);
    expect(diagnostic.primarySpan?.end).toBeLessThanOrEqual(Buffer.byteLength(source));
    if (primary !== undefined) expect(diagnostic.primarySpan).toEqual(profileSpan(source, primary));
    expect(Array.isArray(diagnostic.related)).toBe(true);
    for (const related of diagnostic.related) {
      expect(typeof related.span.sourceId).toBe("string");
      expect(related.span.sourceId.length).toBeGreaterThan(0);
      expect(related.span.start).toBeGreaterThanOrEqual(0);
      expect(related.span.end).toBeGreaterThan(related.span.start);
      expect(related.message.length).toBeGreaterThan(0);
    }
  }
}

describe.each(profiles)("cooperative NMI admission on %s", (profile) => {
  // A complete private-home-free chain is expressible, without certifying unrestricted arrivals.
  it.each([
    ["an empty handler is balanced", chainedSource("")],
    [
      "a local constant and ordinary void helper have no private homes",
      chainedSource(
        "const VALUE: byte = 7; poke($0411, VALUE); writeConstant();",
        "function writeConstant(): void { poke($0410, 9); }",
      ),
    ],
  ])("should admit a stock chain when %s", async (_condition, source) => {
    await withProfileProject(source, profile, async (project) => {
      const checked = await checkProject({ project });
      expect.soft(checked.kind).toBe("success");
      const built = await buildProject({ project, optimization: "none" });
      expect.soft(built.kind).toBe("success");
      if (built.kind !== "success") return;
      const artifacts = await readProfileArtifacts(built);
      expect(artifacts.memory.runtimeMemorySafety).toBe("unproven");
      expect(artifacts.memory.acmeReconciled).toBe(true);
      expect(
        profileRecords(artifacts.memory.unboundedEffects).filter(
          (effect) => effect.effectClass === externalEffect,
        ),
      ).toHaveLength(1);
    });
  });

  // Exclusive ownership and selected private storage remain distinct rejection conditions.
  it.each([
    [
      "exclusive ownership is unproved",
      `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
interrupt function handler(): void {}
function main(): void { setNMIExclusive(&handler); restoreNMI(); }`,
      undefined,
    ],
    ["the handler retains five samples", chainedSource(retainedReads), "setNMI(&handler)"],
    [
      "an ordinary helper retains five samples",
      chainedSource("retainSamples();", `function retainSamples(): void { ${retainedReads} }`),
      "setNMI(&handler)",
    ],
  ] as const)(
    "should reject with a canonical reentrancy error when %s",
    async (_condition, source, primary) => {
      await withProfileProject(source, profile, async (project, root) => {
        const checked = await checkProject({ project });
        const built = await buildProject({ project, optimization: "none" });
        expectRejected([checked, built], source, "E10245", primary);
        await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
      });
    },
  );

  // Handler kind and ABI provenance are never repaired by admitting a chained route.
  it.each([
    [
      "an ordinary function is passed to the sink",
      `module Game;
import { setNMI, restoreNMI } from c64.system;
function ordinary(): void {}
function main(): void { setNMI(&ordinary); restoreNMI(); }`,
      "E10244",
    ],
    [
      "a handler address is erased to a word",
      `module Game;
import { setNMI, restoreNMI } from c64.system;
interrupt function handler(): void {}
function main(): void { setNMI(word(&handler)); restoreNMI(); }`,
      "E10247",
    ],
    [
      "source code calls a handler",
      "module Game; interrupt function handler(): void {} function main(): void { handler(); }",
      "E10051",
    ],
  ])("should preserve the callback guard when %s", async (_condition, source, code) => {
    await withProfileProject(source, profile, async (project, root) => {
      const checked = await checkProject({ project });
      const built = await buildProject({ project, optimization: "none" });
      expectRejected([checked, built], source, code);
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  // A later failed proof must preserve every byte and publication entry of the earlier generation.
  it("should preserve the published generation when a later route proof fails", async () => {
    await withProfileProject(
      "module Game; function main(): void {}",
      profile,
      async (project, root) => {
        const first = await buildProject({ project, optimization: "none" });
        expect(first.kind).toBe("success");
        if (first.kind !== "success") return;
        const out = join(root, "out");
        const entries = (await readdir(out, { recursive: true })).sort();
        const bytes = await Promise.all(
          entries.map(async (entry) =>
            (await stat(join(out, entry))).isFile() ? readFile(join(out, entry)) : null,
          ),
        );
        const invalid = chainedSource(retainedReads);
        await writeFile(join(root, "src/game.blend"), invalid);
        const checked = await checkProject({ project });
        const built = await buildProject({ project, optimization: "none" });
        expectRejected([checked, built], invalid, "E10245", "setNMI(&handler)");
        expect((await readdir(out, { recursive: true })).sort()).toEqual(entries);
        for (const [index, entry] of entries.entries()) {
          if (bytes[index] !== null) expect(await readFile(join(out, entry))).toEqual(bytes[index]);
        }
      },
    );
  });
});
