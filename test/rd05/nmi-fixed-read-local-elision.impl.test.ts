import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";
/** Generated identity of the handler under test, as the memory map names its owners. */
const HANDLER = "src/game.blend::Game.handler";

/**
 * A chained-NMI handler body, wrapped in the smallest program that installs one.
 *
 * The chained installer is deliberate. It is the route that admits no invocation-private home at
 * all, so it is the only place where "this local needs no memory" and "this handler compiles" are
 * the same statement — which makes it a far sharper instrument than a byte count.
 */
function chained(body: string): string {
  return `module Game;
import { setNMI, restoreNMI } from c64.system;
interrupt function handler(): void { ${body} }
function main(): void { setNMI(&handler); restoreNMI(); }
`;
}

/** Build one handler body and return its memory evidence, failing loudly on a refusal. */
async function evidence(body: string) {
  return await withProfileProject(chained(body), PROFILE, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    return await readProfileArtifacts(built);
  });
}

/** Collect every invocation-private data interval the handler or its helpers own. */
function handlerPrivateHomes(artifacts: Awaited<ReturnType<typeof evidence>>): unknown[] {
  const privateKinds = new Set(["sfa", "zeroPage", "scratch"]);
  return profileRecords(artifacts.memory.intervals).filter((interval) => {
    if (!privateKinds.has(String(interval.kind))) return false;
    const owner = profileRecord(interval.owner);
    if (typeof owner.id !== "string") throw new TypeError("Missing interval owner identity");
    const owners: unknown = owner.id.startsWith("overlay:")
      ? JSON.parse(owner.id.slice("overlay:".length))
      : [owner.id];
    if (!Array.isArray(owners) || !owners.every((id) => typeof id === "string"))
      throw new TypeError("Malformed interval owner associations");
    return owners.some((id: string) => id === HANDLER || id.startsWith(`${HANDLER}::`));
  });
}

/**
 * Report which distinct diagnostics refuse one handler body.
 *
 * Both services are consulted, because a route refusal must be visible to the editor as well as to
 * the build. They report the same record, so the codes are reduced to a set rather than counted.
 */
async function refusal(body: string): Promise<readonly string[]> {
  return await withProfileProject(chained(body), PROFILE, async (project) => {
    const checked = await checkProject({ project });
    const built = await buildProject({ project, optimization: "none" });
    const diagnostics = [
      ...(checked.kind === "success" ? [] : checked.diagnostics),
      ...(built.kind === "success" ? [] : built.diagnostics),
    ];
    return [...new Set(diagnostics.map((diagnostic) => diagnostic.code))].sort();
  });
}

describe("an NMI local initialized by a fixed-address byte read", () => {
  it("should need no invocation-private home when its whole life is an adjacent pair", async () => {
    // The point of the rule, asserted on the memory map rather than on a size: the byte is read
    // into the accumulator and written straight out, so the home that would have parked it in
    // between is not merely unused but never requested.
    const artifacts = await evidence("let a: byte = peek($0400); poke($0411, a);");

    expect(handlerPrivateHomes(artifacts), "the elided local still has a home").toEqual([]);
  }, 180_000);

  it("should keep the read exactly once and in its original position", async () => {
    // Removing the home must not disturb the read itself. A fixed-address read can name a
    // hardware register, where a second occurrence or a move across the store would be a
    // behavioural change rather than a smaller program.
    const artifacts = await evidence("let a: byte = peek($D012); poke($0411, a);");
    const reads = artifacts.assembly
      .split("\n")
      .map((line) => line.split(";")[0]?.trim() ?? "")
      .filter((line) => /^lda(\+[12])? \$d012$/i.test(line));

    expect(reads, "the volatile read was duplicated or dropped").toHaveLength(1);
  }, 180_000);

  it("should reach a masked and a tested consumer, not only a direct write", async () => {
    // The gap between the read and its consumer may hold compile-time constants and one permitted
    // peer load. Both of these shapes exercise that allowance, and both would otherwise force a
    // home onto a byte that never needs one.
    const masked = await evidence("let a: byte = peek($0400); poke($0411, a & $0F);");
    const tested = await evidence("let a: byte = peek($0400); if (a == 0) { poke($0411, 1); }");

    expect([handlerPrivateHomes(masked), handlerPrivateHomes(tested)]).toEqual([[], []]);
  }, 180_000);

  it("should still refuse a local that genuinely needs memory", async () => {
    // The rule is about locals that need no storage, not about being permissive. A second use
    // means the byte must survive past the first consumer, and crossed lifetimes mean two bytes
    // must be live at once — neither fits in the accumulator, so each keeps its home and the
    // chained route keeps refusing the handler.
    const [twoUses, crossed] = await Promise.all([
      refusal("let a: byte = peek($0400); poke($0411, a); poke($0412, a);"),
      refusal(
        "let a: byte = peek($0400); let b: byte = peek($0401); poke($0411, b); poke($0412, a);",
      ),
    ]);

    expect([twoUses, crossed]).toEqual([["E10245"], ["E10245"]]);
  }, 180_000);

  it("should refuse a read whose address is not known at compile time", async () => {
    // A computed address builds a pointer and may route the byte through an index register, so the
    // value is not reliably in the accumulator and the home cannot be omitted.
    const computed = await refusal(
      "let at: word = $0400 + 1; let a: byte = peek(at); poke($0411, a);",
    );

    expect(computed, "a computed-address read was elided").toEqual(["E10245"]);
  }, 180_000);
});
