import { describe, expect, it } from "vitest";
import { encodedLength, routineBody } from "./routine-reader.js";

/** Emitted text of `use` (two stores) followed by another label at `next`. */
function emitted(next: number, empty = false): string {
  return [
    "* = $0900",
    "b65_Game_use_0123456789abcdef:",
    ...(empty ? [] : ["  lda+1 $02", "  sta+2 b65_Game_first_0123456789abcdef"]),
    `* = $${next.toString(16)}`,
    "b65_startup_block_1_737461727475702e726573746f7265:",
    "  sei",
  ].join("\n");
}

describe("routine reader", () => {
  it("reports a fall-through only into a label that begins where the routine ends", () => {
    expect(routineBody(emitted(0x0905), "use").at(-1)).toBe("falls into b65_startup_block_1_");
    expect(routineBody(emitted(0x0906), "use").at(-1)).toBe("sta b65_Game_first_");
  });

  it("keeps rejecting a routine with no instructions unless the caller accepts one", () => {
    expect(() => routineBody(emitted(0x0900, true), "use")).toThrow(/Missing generated routine/u);
    expect(routineBody(emitted(0x0900, true), "use", true)).toEqual([
      "falls into b65_startup_block_1_",
    ]);
    expect(() => routineBody(emitted(0x0903, true), "use", true)).toThrow(/Missing/u);
  });

  it("measures the instruction forms the routines use", () => {
    expect(
      [
        "rts",
        "lda #$2a",
        "lda+1 $02",
        "sta+2 b65_x,y",
        "jmp+2 b65_y",
        "bcc b65_z",
        "sta ($02),y",
        "lda $08f3",
      ].map(encodedLength),
    ).toEqual([1, 2, 2, 3, 3, 2, 2, 3]);
  });
});
