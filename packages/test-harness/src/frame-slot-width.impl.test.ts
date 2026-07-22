/**
 * Emit-tier implementation tests for the width ONE use of a shared frame slot
 * lowers at.
 *
 * When sibling blocks declare the same name at different widths they share a
 * slot, and that slot is sized to the widest of them. Sizing alone is not
 * enough: the narrow declaration's uses still have to lower narrow. Reading the
 * slot's width instead would emit a high-byte load for a variable that has no
 * high byte — harmless to the result, but a byte of waste in the inner loop an
 * assembly programmer would never write, and the same reasoning that lets a
 * wide read truncate when the widths are the other way round.
 *
 * Runs `emitAsm` only (no assembler, no emulator), so these are CI-safe.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitAsm, type EmitResult } from "@blend65/compiler";

/** Stages `source` as `main.blend` in a fresh temp dir and emits its ACME text. */
function emitSource(source: string): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-frame-width-impl-"));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** Emits `source`, asserting it compiles cleanly, and returns the assembly. */
function emitClean(source: string): string {
  const result = emitSource(source);
  expect(result.hasErrors).toBe(false);
  expect(result.text).toBeDefined();
  return result.text ?? "";
}

describe("shared frame slot — the narrow declaration still lowers narrow", () => {
  it("emits no high-byte access for a byte declaration sharing a widened slot", () => {
    // `t` is a 2-byte slot because the other arm declares it `word`. That arm
    // is left uninitialised so it emits nothing at all — every instruction in
    // this program therefore belongs to the BYTE declaration, which owns only
    // the low byte of the shared slot.
    const asm = emitClean(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let t: word; }\n" +
        "else { let t: byte = 5; poke($D020, t); } }\n",
    );

    expect(asm).toContain("STA __frame_Main_main_t");
    // The high byte belongs to the other arm's declaration — this one must
    // neither read nor write it.
    expect(asm).not.toContain("__frame_Main_main_t+1");
  });

  it("emits a byte-wide counter for the byte loop of a reused counter name", () => {
    const asm = emitClean(
      "module Main;\nfunction main(): void {\n" +
        "for (let i: byte = 0 to 9) { poke($D020, i); }\n" +
        "for (let i: word = 0 to 9) { pokew($D000, i); } }\n",
    );

    // The word loop needs the high byte; the byte loop's step and compare must
    // not touch it, so the count of high-byte references stays small — every
    // one of them belongs to the word loop.
    const highByte = asm.match(/__frame_Main_main_i\+1/g) ?? [];
    const lowByte = asm.match(/__frame_Main_main_i(?!\+)/g) ?? [];
    expect(highByte.length).toBeGreaterThan(0); // the word loop uses it
    expect(lowByte.length).toBeGreaterThan(highByte.length); // the byte loop does not
  });

  it("emits no high-byte access for an enum declaration sharing a widened slot", () => {
    // An enum is a one-byte value. Sharing a slot with a `word` sibling must
    // not give it a high byte: the extra store would land on whatever follows
    // the target address — here the register next to $D020.
    const asm = emitClean(
      "module Main;\nenum Colors { Red = 1, Blue = 2 }\n" +
        "function main(): void { let c: boolean = true;\n" +
        "if (c) { let e: word; }\n" +
        "else { let e: Colors = Colors.Red; poke($D020, e); } }\n",
    );

    expect(asm).toContain("STA $D020");
    expect(asm).not.toContain("__frame_Main_main_e+1");
    expect(asm).not.toContain("STX $D020+1");
  });

  it("keeps the enum arm narrow whichever order the two declarations appear in", () => {
    const asm = emitClean(
      "module Main;\nenum Colors { Red = 1, Blue = 2 }\n" +
        "function main(): void { let c: boolean = true;\n" +
        "if (c) { let e: Colors = Colors.Red; poke($D020, e); }\n" +
        "else { let e: word; } }\n",
    );

    // Anchor that the arm emitted its store at all, so the absence assertions
    // below cannot pass by the poke simply having vanished.
    expect(asm).toContain("STA $D020");
    expect(asm).not.toContain("__frame_Main_main_e+1");
    expect(asm).not.toContain("STX $D020+1");
  });

  it("keeps a byte store inside the low byte when the slot was widened", () => {
    const asm = emitClean(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let t: word = 300; } else { let t: byte = 5; }\n" +
        "let u: byte = 7; poke($D021, u); }\n",
    );

    // `u` follows the widened slot, so it must sit past both of `t`'s bytes.
    const t = /__frame_Main_main_t\s*=\s*\$([0-9A-Fa-f]+)/.exec(asm);
    const u = /__frame_Main_main_u\s*=\s*\$([0-9A-Fa-f]+)/.exec(asm);
    expect(t).not.toBeNull();
    expect(u).not.toBeNull();
    const tAddr = parseInt(t?.[1] ?? "0", 16);
    const uAddr = parseInt(u?.[1] ?? "0", 16);
    expect(uAddr).toBe(tAddr + 2);
  });
});
