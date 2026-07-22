/**
 * Emit-tier specification tests for per-declaration widths on a shared
 * frame slot.
 *
 * When two sibling scopes in one function body reuse a local name — the
 * `if` arm and the `else` arm, or two consecutive `for` loops — the two
 * declarations legally share a single frame slot. Each declaration keeps
 * its OWN type, though, so every use must lower at the width of the
 * declaration it belongs to, never at the width of whichever same-named
 * declaration happened to be seen last. Resolving the width by bare name
 * silently truncates a wide read, mis-sizes a loop counter, and can let a
 * word store spill into the neighbouring local's byte.
 *
 * These tests pin three observable consequences in the emitted ACME text:
 * a word read feeding `pokew` loads BOTH of its bytes from its own slot, a
 * loop counter compares/steps at its own declared width, and a word store
 * stays inside its own two-byte slot instead of clobbering the local laid
 * out next to it.
 *
 * Runs `emitAsm` only (no assembler, no emulator), so the suite is CI-safe
 * ungated.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitAsm, type EmitResult } from "@blend65/compiler";

/** Stages `source` as `main.blend` in a fresh temp dir and emits its ACME text. */
function emitSource(source: string): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-frame-slot-"));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** Reads a symbol's address out of the emitted symbol-definition header. */
function symbolAddress(asm: string, symbol: string): number {
  const match = asm.match(new RegExp(`^${symbol} = \\$([0-9A-Fa-f]+)$`, "m"));
  expect(match, `expected a symbol definition for ${symbol}`).not.toBeNull();
  return Number.parseInt((match as RegExpMatchArray)[1], 16);
}

describe("Specification: per-declaration width on a shared frame slot", () => {
  it("should load and store both bytes of a word local when a sibling arm redeclares its name at byte width", () => {
    const result = emitSource(
      `module Main;\n` +
        `function main(): void {\n` +
        `  let c: boolean = true;\n` +
        `  if (c) { let t: word = 300; pokew($D000, t); } else { let t: byte = 5; }\n` +
        `}\n`,
    );
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    const text = result.text ?? "";
    // The pokew sits in the WORD arm, so it must read both bytes of `t`.
    // The high byte must be a genuine load from `t`'s slot — an immediate
    // zero here would mean the read was truncated to the byte-arm width.
    expect(text).toMatch(/LD[AX] __frame_Main_main_t(?!\+)/);
    expect(text).toMatch(/LD[AX] __frame_Main_main_t\+1/);
    // And both bytes must reach the target: the low store plus a companion
    // store to the next hardware address.
    expect(text).toContain("STA $D000");
    expect(text).toMatch(/ST[AXY] \$D000\+1/);
  });

  it("should keep each loop counter at its own declared width when two consecutive loops reuse the counter name", () => {
    const result = emitSource(
      `module Main;\n` +
        `function main(): void {\n` +
        `  for (let i: byte = 0 to 9) { poke($D020, i); }\n` +
        `  for (let i: word = 0 to 9) { pokew($D000, i); }\n` +
        `}\n`,
    );
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    const text = result.text ?? "";
    const body = text.slice(text.indexOf("_main:"));

    // The byte loop's body pokes $D020; the word loop's body pokes $D000.
    // Those two hardware targets anchor the loop regions in emission order.
    const bytePoke = body.indexOf("$D020");
    const wordPoke = body.indexOf("$D000");
    expect(bytePoke).toBeGreaterThan(-1);
    expect(wordPoke).toBeGreaterThan(bytePoke);

    // Byte loop head (init + bound compare, everything before its body's
    // poke): the counter is touched, but never through a high byte — a
    // byte-wide counter has no `+1` half at all.
    const byteHead = body.slice(0, bytePoke);
    expect(byteHead).toMatch(/__frame_Main_main_i(?!\+)/);
    expect(byteHead).not.toContain("__frame_Main_main_i+1");

    // Byte loop step (between the body's poke and the jump back to the
    // loop head): increments the counter at byte width only.
    const afterBytePoke = body.slice(bytePoke, wordPoke);
    const jumpBack = afterBytePoke.indexOf("JMP");
    expect(jumpBack).toBeGreaterThan(-1);
    const byteStep = afterBytePoke.slice(0, jumpBack);
    expect(byteStep).toMatch(/__frame_Main_main_i(?!\+)/);
    expect(byteStep).not.toContain("__frame_Main_main_i+1");

    // Word loop tail (from its body's pokew to the end): the same slot now
    // backs a WORD counter, so its high byte genuinely participates.
    const wordTail = body.slice(wordPoke);
    expect(wordTail).toContain("__frame_Main_main_i+1");
  });

  it("should keep a word store inside its own slot when a sibling arm redeclares the name at byte width and another local follows", () => {
    const result = emitSource(
      `module Main;\n` +
        `function main(): void {\n` +
        `  let c: boolean = true;\n` +
        `  if (c) { let t: word = 300; } else { let t: byte = 5; }\n` +
        `  let u: byte = 7;\n` +
        `}\n`,
    );
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    const text = result.text ?? "";
    // The word declaration's initializer writes both of its bytes...
    expect(text).toMatch(/ST[AX] __frame_Main_main_t(?!\+)/);
    expect(text).toMatch(/ST[AX] __frame_Main_main_t\+1/);
    // ...and the neighbour is a real, separately written local.
    expect(text).toMatch(/ST[AX] __frame_Main_main_u(?!\+)/);
    // The shared slot must be sized for its widest declaration, so `u`'s
    // byte lies outside the two bytes the word store writes — otherwise
    // `STA/STX t+1` silently clobbers `u`.
    const tAddr = symbolAddress(text, "__frame_Main_main_t");
    const uAddr = symbolAddress(text, "__frame_Main_main_u");
    expect(uAddr).not.toBe(tAddr);
    expect(uAddr).not.toBe(tAddr + 1);
  });
});
