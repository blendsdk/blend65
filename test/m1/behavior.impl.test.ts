import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createSpriteBytes } from "../../examples/m1/qualification/sprite-recipe.js";
import { runBehaviorOracle } from "../../examples/m1/qualification/oracle.js";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("M1 fixture implementation", () => {
  it("regenerates the checked-in raw bytes with native record boundaries", async () => {
    const generated = Uint8Array.from(createSpriteBytes());
    const checkedIn = await readFile(
      fileURLToPath(new URL("../../examples/m1/assets/sprites.bin", import.meta.url)),
    );

    expect([...checkedIn]).toEqual([...generated]);
    expect(sha256(generated)).toBe(
      "c590c49d0e0aae8a20b39e2f6246c530bb7f52fe8b4c21131ec09a442509f68a",
    );
    expect(Array.from({ length: 8 }, (_, index) => generated[index * 64 + 63])).toEqual(
      Array.from({ length: 8 }, () => 0),
    );
  });

  it("returns equal immutable observations for the same input sequence", () => {
    const input = Object.freeze([0x1f, 0x1b, 0x17, 0x0f, 0x0f, 0x1f]);
    const first = runBehaviorOracle(input);
    const second = runBehaviorOracle(input);

    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.frames)).toBe(true);
    expect(first.frames.every((frame) => Object.isFrozen(frame.state))).toBe(true);
  });

  it("records each sprite enable position pointer and color operation in order", () => {
    const run = runBehaviorOracle([0x0f]);
    const operations = run.frames[0]!.deviceIntents.filter(({ kind }) =>
      kind.startsWith("set-sprite-"),
    );

    expect(operations).toHaveLength(32);
    expect(operations.slice(0, 4)).toEqual([
      { kind: "set-sprite-enabled", index: 0, enabled: true },
      { kind: "set-sprite-position", index: 0, x: 160, y: 220 },
      { kind: "set-sprite-pointer", index: 0, block: 0, art: "player" },
      { kind: "set-sprite-color", index: 0, color: 3 },
    ]);
    expect(operations.slice(-4)).toEqual([
      { kind: "set-sprite-enabled", index: 7, enabled: true },
      { kind: "set-sprite-position", index: 7, x: 160, y: 199 },
      { kind: "set-sprite-pointer", index: 7, block: 5, art: "projectile" },
      { kind: "set-sprite-color", index: 7, color: 1 },
    ]);
  });
});
