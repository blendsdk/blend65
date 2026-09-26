import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

const platform = "c64-pal-prg-kernal-6581";

/** Compile one complete program through the public service and the selected assembler. */
async function withBuild(
  source: string,
  inspect: (result: Awaited<ReturnType<typeof buildProject>>) => void,
) {
  const root = await mkdtemp(join(tmpdir(), "blend65-stack-overlap-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "stack-overlap",
        sourceRoot: "src",
        entry: "Game",
        target: platform,
        outDir: "out",
        optimization: "none",
      }),
    );
    inspect(await buildProject({ project: join(root, "blend65.json"), optimization: "none" }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** A balanced status span contributes exactly one byte per save until its matching pull. */
function saves(count: number, body = ""): string {
  return `${"asm_php(); ".repeat(count)}${body}${"asm_plp(); ".repeat(count)}`;
}

/** Keep handler, ordinary call, and ownership fixtures identical across overlap cases. */
function program(main: string, leafSaves = 226, extra = ""): string {
  return [
    "module Game;",
    "import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;",
    `interrupt function onIRQ(): void { ${saves(10)} }`,
    `function leaf(): void { ${saves(leafSaves)} }`,
    extra,
    `function main(): void { asm_cli(); asm_nop(); ${main} }`,
  ].join("\n");
}

/** Assert the public warning's complete decomposition, not just successful compilation. */
function expectPeak(
  result: Awaited<ReturnType<typeof buildProject>>,
  peak: number,
  calls: number,
  entries: number,
  pushes: number,
): void {
  expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
  expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
  const warnings = result.diagnostics.filter(({ code }) => code === "W10180");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]?.message).toBe(
    `Maximum simultaneous hardware-stack use is ${peak} bytes on '${platform}'; usable capacity is 236 (calls ${calls}, interrupt entries ${entries}, explicit pushes ${pushes})`,
  );
}

/** A feasible over-capacity route must fail before publishing an artifact generation. */
function expectOverflow(result: Awaited<ReturnType<typeof buildProject>>, peak: number): void {
  expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
  const errors = result.diagnostics.filter(({ severity }) => severity === "error");
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatchObject({ code: "E10238" });
  expect(errors[0]?.message).toMatch(
    new RegExp(
      `^Target resource budget exceeded for '[^']*[Ss]tack[^']*' — used ${peak}, available 236 on '${platform}'$`,
      "u",
    ),
  );
  expect(result).not.toHaveProperty("generation");
}

describe("feasible simultaneous hardware-stack usage", () => {
  // Inactive handler execution cannot overlap a two-byte call with 226 live status saves.
  it.each([
    ["before installation", "leaf(); setIRQ(&onIRQ); restoreIRQ();"],
    ["after restoration", "setIRQ(&onIRQ); restoreIRQ(); leaf();"],
  ])(
    "keeps the deep call separate from the handler %s",
    async (_name, main) => {
      await withBuild(program(main), (result) => expectPeak(result, 228, 2, 0, 226));
    },
    60_000,
  );

  // Moving only the call into the installed interval adds 7 entry bytes and 10 handler saves.
  it("rejects the same deep call while the chained handler is installed", async () => {
    await withBuild(program("setIRQ(&onIRQ); leaf(); restoreIRQ();"), (result) =>
      expectOverflow(result, 245),
    );
  }, 60_000);

  // Both selected entry variants charge their exact ABI bytes at the same live call point.
  it.each([
    ["setIRQ", 7, 229],
    ["setIRQExclusive", 6, 228],
  ] as const)(
    "reports the exact active %s overlap",
    async (installer, entries, peak) => {
      await withBuild(program(`${installer}(&onIRQ); leaf(); restoreIRQ();`, 210), (result) =>
        expectPeak(result, peak, 2, entries, 220),
      );
    },
    60_000,
  );

  // Returning from an installer transfers its ownership effect to the caller.
  it("carries an installed handler through an ordinary helper return", async () => {
    await withBuild(
      program(
        "install(); leaf(); restoreIRQ();",
        226,
        "function install(): void { setIRQ(&onIRQ); }",
      ),
      (result) => expectOverflow(result, 245),
    );
  }, 60_000);

  // A restoring helper's effect likewise survives its return and excludes later preemption.
  it("excludes the handler after a restoring helper returns", async () => {
    await withBuild(
      program(
        "setIRQ(&onIRQ); uninstall(); leaf();",
        226,
        "function uninstall(): void { restoreIRQ(); }",
      ),
      (result) => expectPeak(result, 228, 2, 0, 226),
    );
  }, 60_000);

  // Main is tail-entered: only the actual leaf call adds a return address to its live PHP span.
  it("adds main status saves, one live call, and the active handler at the same point", async () => {
    await withBuild(
      program(`setIRQ(&onIRQ); ${saves(100, "leaf(); ")} restoreIRQ();`, 100),
      (result) => expectPeak(result, 219, 2, 7, 210),
    );
  }, 60_000);

  // A deep retired handler and the current shallow handler run in distinct ownership intervals.
  it("does not carry a retired deep handler into the next handler's active call", async () => {
    await withBuild(
      program(
        "setIRQ(&deepIRQ); restoreIRQ(); setIRQ(&onIRQ); leaf(); restoreIRQ();",
        210,
        `interrupt function deepIRQ(): void { ${saves(200)} }`,
      ),
      (result) => expectPeak(result, 229, 2, 7, 220),
    );
  }, 60_000);

  // SEI prevents this maskable entry; NOP puts the deep call beyond instruction-boundary delay.
  it("excludes an installed IRQ during a masked deep call", async () => {
    await withBuild(
      program("setIRQ(&onIRQ); asm_sei(); asm_nop(); leaf(); restoreIRQ();"),
      (result) => expectPeak(result, 228, 2, 0, 226),
    );
  }, 60_000);

  // The main status save remains live across the call, then PLP restores the previous enabled mask.
  it("counts a saved status while its critical section masks the installed handler", async () => {
    await withBuild(
      program("setIRQ(&onIRQ); asm_php(); asm_sei(); asm_nop(); leaf(); asm_plp(); restoreIRQ();"),
      (result) => expectPeak(result, 229, 2, 0, 227),
    );
  }, 60_000);

  // PLP restores the saved I bit, not the mask of the instruction immediately before the pull.
  it("restores a disabled mask after a temporary enabled interval", async () => {
    await withBuild(
      program(
        "setIRQ(&onIRQ); asm_sei(); asm_php(); asm_cli(); asm_nop(); asm_plp(); asm_nop(); leaf(); restoreIRQ();",
      ),
      (result) => expectPeak(result, 228, 2, 0, 226),
    );
  }, 60_000);

  // Restoring an enabled status makes subsequent deep stack use preemptible again.
  it("rejects a deep call after PLP restores IRQ recognition", async () => {
    await withBuild(
      program(
        "setIRQ(&onIRQ); asm_php(); asm_sei(); asm_nop(); asm_plp(); asm_nop(); leaf(); restoreIRQ();",
      ),
      (result) => expectOverflow(result, 245),
    );
  }, 60_000);

  // A handler that enables its own unbounded source has no finite simultaneous stack peak.
  it("rejects an installed IRQ handler that enables unbounded self-reentry", async () => {
    await withBuild(
      [
        "module Game;",
        "import { setIRQ, restoreIRQ } from c64.system;",
        "interrupt function onIRQ(): void { asm_cli(); asm_nop(); }",
        "function main(): void { asm_cli(); asm_nop(); setIRQ(&onIRQ); asm_nop(); restoreIRQ(); }",
      ].join("\n"),
      (result) => {
        expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
        expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([
          expect.objectContaining({ code: "E10245" }),
        ]);
        expect(result).not.toHaveProperty("generation");
      },
    );
  }, 60_000);
});
