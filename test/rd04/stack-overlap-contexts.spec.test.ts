import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

const platform = "c64-pal-prg-kernal-6581";
const imports = "import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;";

/** Build a real selected-profile program while keeping generated files isolated per case. */
async function withBuild(
  source: string,
  inspect: (result: Awaited<ReturnType<typeof buildProject>>) => void,
) {
  const root = await mkdtemp(join(tmpdir(), "blend65-stack-overlap-contexts-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "stack-overlap-contexts",
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

/** Balanced PHP/PLP spans have a known peak without relying on compiler internals. */
function saves(count: number): string {
  return `${"asm_php(); ".repeat(count)}${"asm_plp(); ".repeat(count)}`;
}

/** Supply one ten-byte handler and one deep ordinary call for control-flow comparisons. */
function program(main: string, leafSaves = 226, extra = ""): string {
  return [
    "module Game;",
    imports,
    "const FLAG_ADDRESS: word = $0400;",
    `interrupt function onIRQ(): void { ${saves(10)} }`,
    `function leaf(): void { ${saves(leafSaves)} }`,
    extra,
    `function main(): void { asm_cli(); asm_nop(); ${main} }`,
  ].join("\n");
}

/** Exact public warning text independently fixes every component of the simultaneous peak. */
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

/** Reject a feasible overflow with its exact measured use and no published artifacts. */
function expectOverflow(result: Awaited<ReturnType<typeof buildProject>>): void {
  expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
  const errors = result.diagnostics.filter(({ severity }) => severity === "error");
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatchObject({ code: "E10238" });
  expect(errors[0]?.message).toMatch(
    /^Target resource budget exceeded for '[^']*[Ss]tack[^']*' — used 245, available 236 on 'c64-pal-prg-kernal-6581'$/u,
  );
  expect(result).not.toHaveProperty("generation");
}

describe("hardware-stack overlap across execution contexts", () => {
  // Chaining reaches the older body after the newer body's saves are popped; entry occurs once.
  it("charges the deepest reachable predecessor without summing sequential handler bodies", async () => {
    await withBuild(
      program(
        "setIRQ(&older); setIRQ(&onIRQ); leaf(); restoreIRQ(); restoreIRQ();",
        10,
        `interrupt function older(): void { ${saves(200)} }`,
      ),
      (result) => expectPeak(result, 219, 2, 7, 210),
    );
  }, 60_000);

  // An exclusive top terminates at the firmware restore tail instead of running its predecessor.
  it("excludes the saved predecessor while an exclusive handler owns the active vector", async () => {
    await withBuild(
      program(
        "setIRQ(&older); setIRQExclusive(&onIRQ); leaf(); restoreIRQ(); restoreIRQ();",
        210,
        `interrupt function older(): void { ${saves(200)} }`,
      ),
      (result) => expectPeak(result, 228, 2, 6, 220),
    );
  }, 60_000);

  // The precise two-target set is an ordinary call: one return address overlaps the active IRQ.
  it("includes a typed indirect call in the active handler interval", async () => {
    await withBuild(
      program(
        "setIRQ(&onIRQ); let action: fn(): void = peek(FLAG_ADDRESS) == 0 ? &leaf : &other; action(); restoreIRQ();",
        210,
        `function other(): void { ${saves(210)} }`,
      ),
      (result) => expectPeak(result, 229, 2, 7, 220),
    );
  }, 60_000);

  // Effectful initializers use the stable declaration-name schedule and transfer sink ownership.
  it.each([
    ["after", "install()", "leaf()", 221, 7, 210],
    ["before", "leaf()", "install()", 204, 0, 200],
  ] as const)(
    "counts the initializer call chain %s handler installation",
    async (_when, first, second, peak, entries, pushes) => {
      await withBuild(
        [
          "module Game;",
          imports,
          `let a: byte = ${first}; let b: byte = ${second};`,
          `interrupt function onIRQ(): void { ${saves(10)} }`,
          "function install(): byte { asm_cli(); asm_nop(); setIRQ(&onIRQ); return 0; }",
          `function leaf(): byte { ${saves(200)} return 1; }`,
          "function main(): void { restoreIRQ(); }",
        ].join("\n"),
        (result) => expectPeak(result, peak, 4, entries, pushes),
      );
    },
    60_000,
  );

  // Ordinary returns preserve a helper's new mask; they do not implicitly restore caller status.
  it("retains a disabled mask returned by a helper", async () => {
    await withBuild(
      program(
        "setIRQ(&onIRQ); disable(); leaf(); restoreIRQ();",
        226,
        "function disable(): void { asm_sei(); asm_nop(); }",
      ),
      (result) => expectPeak(result, 228, 2, 0, 226),
    );
  }, 60_000);

  // A helper enabling IRQ makes the caller's later deep call preemptible again.
  it("retains an enabled mask returned by a helper", async () => {
    await withBuild(
      program(
        "setIRQ(&onIRQ); asm_sei(); asm_nop(); enable(); leaf(); restoreIRQ();",
        226,
        "function enable(): void { asm_cli(); asm_nop(); }",
      ),
      expectOverflow,
    );
  }, 60_000);

  // A join must retain the enabled possibility even though another predecessor remains masked.
  it.each([
    ["branch", "if (peek(FLAG_ADDRESS) != 0) { asm_cli(); asm_nop(); }"],
    ["loop", "while (peek(FLAG_ADDRESS) != 0) { asm_cli(); asm_nop(); }"],
  ])(
    "preserves feasible IRQ overlap after a %s mask join",
    async (_kind, control) => {
      await withBuild(
        program(`setIRQ(&onIRQ); asm_sei(); asm_nop(); ${control} leaf(); restoreIRQ();`),
        expectOverflow,
      );
    },
    60_000,
  );

  // Moving CLI into an ordinary helper does not bound handler reentry or erase its stack effect.
  it("rejects unbounded IRQ reentry enabled through an ordinary helper", async () => {
    await withBuild(
      [
        "module Game;",
        imports,
        "function enable(): void { asm_cli(); asm_nop(); }",
        "interrupt function onIRQ(): void { enable(); }",
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
