import { writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const WIDTH = 24;
const HEIGHT = 21;
const RECORD_BYTES = 64;

type PixelRule = (x: number, y: number) => boolean;

/** Encode one high-resolution C64 sprite bitmap plus its unused attribute byte. */
function record(rule: PixelRule): readonly number[] {
  const bytes: number[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let byte = 0; byte < 3; byte++) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) {
        if (rule(byte * 8 + bit, y)) value |= 0x80 >> bit;
      }
      bytes.push(value);
    }
  }
  bytes.push(0);
  return Object.freeze(bytes);
}

/** Mirror a horizontal predicate around the 24-pixel sprite center. */
function symmetric(x: number, minimum: number, maximum: number): boolean {
  return (x >= minimum && x <= maximum) || (x >= WIDTH - 1 - maximum && x <= WIDTH - 1 - minimum);
}

const RECORDS: readonly (readonly number[])[] = Object.freeze([
  record(
    (x, y) =>
      (y >= 4 && y <= 17 && Math.abs(x - 11.5) <= (y - 2) / 2) ||
      (y >= 17 && y <= 19 && x >= 3 && x <= 20),
  ),
  record(
    (x, y) =>
      (y >= 4 && y <= 15 && x >= 4 && x <= 19) ||
      (y >= 2 && y <= 5 && symmetric(x, 6, 8)) ||
      (y >= 16 && y <= 19 && symmetric(x, 3, 6)) ||
      (y >= 8 && y <= 10 && symmetric(x, 7, 8)),
  ),
  record(
    (x, y) =>
      (y >= 4 && y <= 15 && x >= 4 && x <= 19) ||
      (y >= 2 && y <= 5 && symmetric(x, 6, 8)) ||
      (y >= 16 && y <= 19 && symmetric(x, 7, 10)) ||
      (y >= 8 && y <= 10 && symmetric(x, 7, 8)),
  ),
  record(
    (x, y) =>
      (y >= 3 && y <= 16 && x >= 3 && x <= 20 && (x + y) % 3 !== 0) ||
      (y >= 17 && y <= 19 && symmetric(x, 2, 5)),
  ),
  record(
    (x, y) =>
      (y >= 3 && y <= 16 && x >= 3 && x <= 20 && (x + y + 1) % 3 !== 0) ||
      (y >= 17 && y <= 19 && symmetric(x, 8, 10)),
  ),
  record((x, y) => y >= 2 && y <= 18 && x >= 10 && x <= 13),
  record(
    (x, y) =>
      (Math.abs(x - 11.5) + Math.abs(y - 10) <= 8 && (x + y) % 2 === 0) ||
      (y === 10 && x >= 1 && x <= 22),
  ),
  record(
    (x, y) =>
      (Math.abs(x - 11.5) <= 2 && y >= 1 && y <= 19) ||
      (Math.abs(y - 10) <= 2 && x >= 1 && x <= 22) ||
      x + y === 13 ||
      x - y === 2,
  ),
]);

/**
 * Produce the exact eight 64-byte native sprite records used by M1.
 * The final byte of each record is retained as zero because M1 uses separate color operations.
 */
export function createSpriteBytes(): readonly number[] {
  const bytes = Object.freeze(RECORDS.flatMap((sprite) => sprite));
  if (bytes.length !== RECORDS.length * RECORD_BYTES) {
    throw new Error("The M1 sprite recipe must produce exactly 512 bytes");
  }
  return bytes;
}

/** Write the checked-in fixture when this module is run directly. */
async function main(): Promise<void> {
  const output = fileURLToPath(new URL("../assets/sprites.bin", import.meta.url));
  await writeFile(output, Uint8Array.from(createSpriteBytes()));
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  await main();
}
