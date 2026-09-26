import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { diagnosticSpan } from "./diagnostic-fixture.js";

/** Build an actual profile-selected program while retaining its independently inspectable bytes. */
async function withBuild<T>(
  source: string,
  bytes: Uint8Array,
  inspect: (result: Awaited<ReturnType<typeof buildProject>>) => Promise<T> | T,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "blend65-resource-records-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(join(root, "assets/data.bin"), bytes);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "resource-records",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: ["assets"],
        outDir: "out",
        optimization: "none",
      }),
    );
    return await inspect(
      await buildProject({ project: join(root, "blend65.json"), optimization: "none" }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("canonical selected-profile resource boundaries", () => {
  // Finite explicit status saves beyond usable capacity are a budget failure, not unbounded reentry.
  it("should report E10238 when source status saves exceed 236 usable stack bytes", async () => {
    const source = `module Game; function main(): void { ${"asm_php(); ".repeat(237)}${"asm_plp(); ".repeat(237)} }`;
    await withBuild(source, Uint8Array.of(7), (result) => {
      expect(result.kind).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10238"]);
      expect(errors[0]).toMatchObject({
        code: "E10238",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(
          /^Target resource budget exceeded for '[^']*[Ss]tack[^']*' — used \d+, available 236 on 'c64-pal-prg-kernal-6581'$/u,
        ),
        primarySpan: diagnosticSpan(source, "main"),
        related: [],
      });
      const match = / — used (\d+), available 236 /u.exec(errors[0]?.message ?? "");
      expect(Number(match?.[1])).toBeGreaterThanOrEqual(237);
      expect(result).not.toHaveProperty("generation");
    });
  }, 60_000);

  // Repeated handler-side installs cannot acquire an unbounded chain of saved predecessor links.
  it("should report E10245 for handler-side interrupt installation without a static overlap bound", async () => {
    const source =
      "module Game; import { setIRQ, restoreIRQ } from c64.system; interrupt function handler(): void { setIRQ(&handler); } function main(): void { setIRQ(&handler); restoreIRQ(); }";
    await withBuild(source, Uint8Array.of(7), (result) => {
      expect(result.kind).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10245"]);
      expect(errors[0]).toMatchObject({
        code: "E10245",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(
          /^Execution path '[^']*handler[^']*' can overlap or consume hardware stack without a static bound — use a bounded interrupt\/callback design$/u,
        ),
        primarySpan: diagnosticSpan(source, "setIRQ(&handler)"),
      });
      expect(errors[0]?.related.map(({ span }) => span)).toEqual([
        diagnosticSpan(source, "setIRQ(&handler)", 1),
      ]);
    });
  }, 60_000);

  // The source pushes alone reach the advisory boundary; compiler-owned stack use must also be reported.
  it("should report W10180 with a numeric simultaneous-stack decomposition", async () => {
    const source = `module Game; function main(): void { ${"asm_php(); ".repeat(188)}${"asm_plp(); ".repeat(188)} }`;
    await withBuild(source, Uint8Array.of(7), (result) => {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      const warnings = result.diagnostics.filter(({ code }) => code === "W10180");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: "W10180",
        severity: "warning",
        pointer: null,
        primarySpan: diagnosticSpan(source, "main"),
        related: [],
      });
      const match =
        /^Maximum simultaneous hardware-stack use is (\d+) bytes on 'c64-pal-prg-kernal-6581'; usable capacity is 236 \(calls (\d+), interrupt entries (\d+), explicit pushes (\d+)\)$/u.exec(
          warnings[0]?.message ?? "",
        );
      expect(match).not.toBeNull();
      const [peak, calls, entries, pushes] = (match?.slice(1) ?? []).map(Number);
      expect(peak).toBeGreaterThanOrEqual(188);
      expect(peak).toBeLessThanOrEqual(236);
      expect(pushes).toBeGreaterThanOrEqual(188);
      expect(calls).toBe(0);
      expect(entries).toBe(0);
      expect(peak).toBe(calls! + entries! + pushes!);
    });
  }, 60_000);

  // An uninitialized module buffer consumes RAM without adding initialization bytes to the binary.
  it("should report W10033 when a fixed buffer reaches the RAM warning threshold", async () => {
    const source =
      "module Game; let values: byte[38400]; function main(): void { values[0] = 7; poke($0400, values[0]); }";
    await withBuild(source, Uint8Array.of(7), (result) => {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      const warnings = result.diagnostics.filter(({ code }) => code === "W10033");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: "W10033",
        severity: "warning",
        pointer: null,
        primarySpan: diagnosticSpan(source, "values"),
        related: [],
      });
      const match =
        /^RAM usage is (\d+(?:\.\d+)?)% of platform 'c64-pal-prg-kernal-6581' budget$/u.exec(
          warnings[0]?.message ?? "",
        );
      expect(match).not.toBeNull();
      const displayed = match?.[1] ?? "";
      const precision = displayed.split(".")[1]?.length ?? 0;
      expect(Number(displayed) + 10 ** -precision).toBeGreaterThan((100 * 38_400) / 51_199);
      expect(Number(displayed)).toBeLessThanOrEqual(100);
    });
  }, 60_000);

  // A 143-byte source object cannot fit in the inclusive $02-$8F range of 142 bytes.
  it("should report E10032 for one byte beyond the complete zero-page budget", async () => {
    const source =
      "module Game; zeropage { values: byte[143]; } function main(): void { values[0] = 7; poke($0400, values[0]); }";
    await withBuild(source, Uint8Array.of(7), (result) => {
      expect(result.kind).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10032"]);
      expect(errors[0]).toMatchObject({
        code: "E10032",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(
          /^Zero-page budget exceeded — used 143 bytes; platform 'c64-pal-prg-kernal-6581' allows 142 bytes \((?:\$02|0x02|2)–(?:\$8[Ff]|0x8[Ff]|143)\)$/u,
        ),
        primarySpan: diagnosticSpan(source, "values"),
        related: [],
      });
    });
  }, 60_000);

  // The embedded byte count is known from the input, without reading any diagnostic as an oracle.
  it("should report W10150 at the exact embedded-data threshold", async () => {
    const source =
      'module Game; const DATA: byte[] = embed("data.bin"); function main(): void { poke($0400, DATA[0]); }';
    const bytes = new Uint8Array(38_400).fill(7);
    await withBuild(source, bytes, (result) => {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      const warnings = result.diagnostics.filter(({ code }) => code === "W10150");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: "W10150",
        severity: "warning",
        pointer: null,
        primarySpan: diagnosticSpan(source, "DATA"),
        related: [],
      });
      const match =
        /^Embedded data uses 38400 bytes \((\d+(?:\.\d+)?)% of 'c64-pal-prg-kernal-6581' binary-size budget\)$/u.exec(
          warnings[0]?.message ?? "",
        );
      expect(match).not.toBeNull();
      const displayed = match?.[1] ?? "";
      const precision = displayed.split(".")[1]?.length ?? 0;
      // Both rounding and truncation are valid presentations; the threshold itself is exact.
      expect(Math.abs(Number(displayed) - (100 * bytes.length) / 51_199)).toBeLessThan(
        10 ** -precision,
      );
    });
  }, 60_000);

  // The raw payload alone exceeds the binary budget, independently of code or layout choices.
  it("should report E10034 for an oversized raw payload with its selected binary budget", async () => {
    const source =
      'module Game; const DATA: byte[] = embed("data.bin"); function main(): void { poke($0400, DATA[0]); }';
    const oversized = new Uint8Array(65_535).fill(7);
    await withBuild(source, oversized, (result) => {
      expect(result.kind).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10034"]);
      expect(errors[0]).toMatchObject({
        code: "E10034",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(
          /^Output binary \(\d+ bytes\) exceeds platform 'c64-pal-prg-kernal-6581' maximum binary size \(51199 bytes\)$/u,
        ),
        primarySpan: diagnosticSpan(source, "DATA"),
        related: [],
      });
      const match = /^Output binary \((\d+) bytes\)/u.exec(errors[0]?.message ?? "");
      expect(Number(match?.[1])).toBeGreaterThanOrEqual(oversized.length);
      expect(result).not.toHaveProperty("generation");
    });
  }, 60_000);
});
